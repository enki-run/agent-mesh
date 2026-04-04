import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { initDatabase } from "./services/db.js";
import { NatsService } from "./services/nats.js";
import { AgentService } from "./services/agent.js";
import { ActivityService } from "./services/activity.js";
import { RateLimiter } from "./services/ratelimit.js";
import {
  authMiddleware,
  hashToken,
  timingSafeEqual,
  generateCsrfToken,
  validateCsrfToken,
  generateSessionCookie,
  getCookieSecret,
} from "./auth.js";
import { createMcpServer } from "./mcp/server.js";
import { createOAuthRoutes, cleanupExpiredOAuthTokens } from "./oauth.js";
import { RATE_LIMIT_PER_MINUTE, VERSION, LIMITS, MESSAGE_RETENTION_DAYS, ACTIVITY_RETENTION_DAYS } from "./types.js";
import type { Env, AppVariables, MessagePriority } from "./types.js";

// --- Views ---
import { LoginPage } from "./views/login.js";
import { HomePage } from "./views/home.js";
import { AgentsPage } from "./views/agents.js";
import { MessagesPage } from "./views/messages.js";
import { ActivityPage } from "./views/activity.js";

// --- Initialize services ---
const dbPath = process.env.DATABASE_PATH || "./mesh.db";
const db = initDatabase(dbPath);
const nats = new NatsService(process.env.NATS_URL || "nats://localhost:4222");
const activity = new ActivityService(db);
const agents = new AgentService(db, activity);
const rateLimiter = new RateLimiter(RATE_LIMIT_PER_MINUTE);

// --- In-memory flash store (UUID -> { data, expiresAt }) ---
interface FlashEntry {
  newToken?: string;
  error?: string;
  expiresAt: number;
}
const flashStore = new Map<string, FlashEntry>();
const FLASH_TTL_MS = 60_000; // 60s

function setFlash(data: Omit<FlashEntry, "expiresAt">): string {
  const key = crypto.randomUUID();
  flashStore.set(key, { ...data, expiresAt: Date.now() + FLASH_TTL_MS });
  setTimeout(() => flashStore.delete(key), FLASH_TTL_MS + 1000);
  return key;
}

function getFlash(key: string | undefined): Omit<FlashEntry, "expiresAt"> | null {
  if (!key) return null;
  const entry = flashStore.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    flashStore.delete(key);
    return null;
  }
  flashStore.delete(key);
  const { expiresAt: _exp, ...data } = entry;
  return data;
}

// --- DB row type for messages (column names differ from Message type) ---
interface MessageRow {
  id: string;
  from_agent: string;
  to_agent: string;
  type: string;
  payload: string;
  context: string;
  correlation_id: string | null;
  reply_to: string | null;
  priority: string;
  ttl_seconds: number;
  created_at: string;
}

function listMessages(params: { limit: number; offset: number; agent?: string }) {
  const { limit, offset, agent } = params;
  const conditions: string[] = [];
  const bindings: unknown[] = [];

  if (agent) {
    conditions.push("(from_agent = ? COLLATE NOCASE OR to_agent = ? COLLATE NOCASE)");
    bindings.push(agent, agent);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM messages${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...bindings, limit, offset) as MessageRow[];

  const countRow = db
    .prepare(`SELECT COUNT(*) as total FROM messages${where}`)
    .get(...bindings) as { total: number } | undefined;

  const total = countRow?.total ?? 0;
  const data = rows.map((row) => ({
    id: row.id,
    from: row.from_agent,
    to: row.to_agent,
    type: row.type,
    payload: row.payload,
    context: row.context,
    correlation_id: row.correlation_id,
    reply_to: row.reply_to,
    priority: row.priority as MessagePriority,
    ttl_seconds: row.ttl_seconds,
    created_at: row.created_at,
  }));

  return {
    data,
    has_more: offset + data.length < total,
    total,
    limit,
    offset,
  };
}

// --- Conversation threading ---
interface ThreadSummary {
  thread_id: string;
  started_at: string;
  last_activity: string;
  message_count: number;
}

interface ConversationThread {
  thread_id: string;
  started_at: string;
  last_activity: string;
  message_count: number;
  first_payload: string;
  first_context: string | null;
  participants: string[];
  messages: Array<{
    id: string;
    from: string;
    to: string;
    type: string;
    payload: string;
    context: string;
    correlation_id: string | null;
    reply_to: string | null;
    priority: MessagePriority;
    ttl_seconds: number;
    created_at: string;
  }>;
}

function listConversations(params: { limit: number; offset: number }) {
  const { limit, offset } = params;

  // Count total threads
  const countRow = db
    .prepare("SELECT COUNT(*) as total FROM (SELECT DISTINCT COALESCE(correlation_id, id) FROM messages)")
    .get() as { total: number } | undefined;
  const total = countRow?.total ?? 0;

  // Get thread summaries (paginated)
  const summaries = db
    .prepare(
      `SELECT
        COALESCE(correlation_id, id) AS thread_id,
        MIN(created_at) AS started_at,
        MAX(created_at) AS last_activity,
        COUNT(*) AS message_count
      FROM messages
      GROUP BY COALESCE(correlation_id, id)
      ORDER BY MAX(created_at) DESC
      LIMIT ? OFFSET ?`
    )
    .all(limit, offset) as ThreadSummary[];

  if (summaries.length === 0) {
    return { data: [] as ConversationThread[], has_more: false, total, limit, offset };
  }

  // Fetch all messages for visible threads
  const placeholders = summaries.map(() => "?").join(",");
  const threadIds = summaries.map((s) => s.thread_id);
  const rows = db
    .prepare(
      `SELECT * FROM messages
      WHERE COALESCE(correlation_id, id) IN (${placeholders})
      ORDER BY created_at ASC`
    )
    .all(...threadIds) as MessageRow[];

  // Group messages by thread
  const messagesByThread = new Map<string, MessageRow[]>();
  for (const row of rows) {
    const tid = row.correlation_id ?? row.id;
    if (!messagesByThread.has(tid)) messagesByThread.set(tid, []);
    messagesByThread.get(tid)!.push(row);
  }

  // Build conversation threads
  const data: ConversationThread[] = summaries.map((s) => {
    const msgs = messagesByThread.get(s.thread_id) ?? [];
    const participantSet = new Set<string>();
    for (const m of msgs) {
      participantSet.add(m.from_agent);
      participantSet.add(m.to_agent);
    }
    const first = msgs[0];
    return {
      thread_id: s.thread_id,
      started_at: s.started_at,
      last_activity: s.last_activity,
      message_count: s.message_count,
      first_payload: first?.payload ?? "",
      first_context: first?.context ?? null,
      participants: Array.from(participantSet),
      messages: msgs.map((row) => ({
        id: row.id,
        from: row.from_agent,
        to: row.to_agent,
        type: row.type,
        payload: row.payload,
        context: row.context,
        correlation_id: row.correlation_id,
        reply_to: row.reply_to,
        priority: row.priority as MessagePriority,
        ttl_seconds: row.ttl_seconds,
        created_at: row.created_at,
      })),
    };
  });

  return { data, has_more: offset + data.length < total, total, limit, offset };
}

// --- Hono app ---
type HonoEnv = { Bindings: Env; Variables: AppVariables };
const app = new Hono<HonoEnv>();

// --- Inject env bindings from process.env ---
app.use("*", async (c, next) => {
  c.env = {
    NATS_URL: process.env.NATS_URL || "nats://localhost:4222",
    MESH_ADMIN_TOKEN: process.env.MESH_ADMIN_TOKEN || "",
    MESH_ADMIN_TOKEN_PREVIOUS: process.env.MESH_ADMIN_TOKEN_PREVIOUS,
    MESH_COOKIE_SECRET: process.env.MESH_COOKIE_SECRET,
    OAUTH_SECRET: process.env.OAUTH_SECRET,
    DATABASE_PATH: process.env.DATABASE_PATH,
  };
  await next();
});

// --- Security headers ---
app.use("*", async (c, next) => {
  await next();
  c.header("X-Mesh-Version", VERSION);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
});

// --- Static files (no auth) ---
app.get("/avatars/:file", async (c) => {
  const file = c.req.param("file");
  if (!/^avatar-\d{2}\.png$/.test(file)) return c.text("Not found", 404);
  const { readFile } = await import("fs/promises");
  const { join, dirname } = await import("path");
  const { fileURLToPath } = await import("url");
  const currentDir = dirname(fileURLToPath(import.meta.url));
  try {
    let filePath = join(currentDir, "../public/avatars", file);
    try { await import("fs/promises").then(f => f.access(filePath)); } catch {
      filePath = join(currentDir, "../../public/avatars", file);
    }
    const data = await readFile(filePath);
    return new Response(data, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600" } });
  } catch {
    return c.text("Not found", 404);
  }
});

// --- Health endpoint (no auth) ---
app.get("/health", async (c) => {
  const natsOk = await nats.ping();
  let dbOk = false;
  try {
    db.prepare("SELECT 1").get();
    dbOk = true;
  } catch {
    // DB not accessible
  }
  const ok = natsOk && dbOk;
  return c.json(
    {
      status: ok ? "ok" : "degraded",
      nats: natsOk ? "connected" : "disconnected",
      db: dbOk ? "ok" : "error",
    },
    ok ? 200 : 503,
  );
});

// --- Login page (no auth) ---
app.get("/login", (c) => {
  const cookieSecret = getCookieSecret(c.env as unknown as Record<string, string | undefined>);
  const csrfToken = generateCsrfToken(cookieSecret);
  const error = c.req.query("error") === "1";
  return c.html(<LoginPage error={error} csrfToken={csrfToken} />);
});

app.post("/login", async (c) => {
  const cookieSecret = getCookieSecret(c.env as unknown as Record<string, string | undefined>);
  const body = await c.req.parseBody();
  const token = body["token"] as string;
  const csrf = body["csrf"] as string;

  if (!validateCsrfToken(csrf, cookieSecret)) {
    return c.redirect("/login?error=1");
  }

  const adminToken = c.env.MESH_ADMIN_TOKEN;
  const adminTokenPrev = c.env.MESH_ADMIN_TOKEN_PREVIOUS;
  const hash = hashToken(token);

  let resolvedName: string | null = null;

  if (timingSafeEqual(hash, hashToken(adminToken))) {
    resolvedName = "admin";
  } else if (adminTokenPrev && timingSafeEqual(hash, hashToken(adminTokenPrev))) {
    resolvedName = "admin";
  } else {
    const foundAgent = agents.getByTokenHash(hash);
    if (foundAgent && foundAgent.is_active) {
      resolvedName = foundAgent.name;
    }
  }

  if (!resolvedName) {
    return c.redirect("/login?error=1");
  }

  const sessionValue = generateSessionCookie(resolvedName, cookieSecret);
  setCookie(c, "mesh_session", sessionValue, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return c.redirect("/");
});

// --- Auth middleware on all other routes ---
app.use("*", authMiddleware(agents, nats, activity));

// --- Logout ---
app.post("/logout", (c) => {
  deleteCookie(c, "mesh_session", { path: "/" });
  return c.redirect("/login");
});

app.get("/logout", (c) => {
  deleteCookie(c, "mesh_session", { path: "/" });
  return c.redirect("/login");
});

// --- MCP endpoint ---
app.all("/mcp", async (c) => {
  if (
    c.req.method !== "POST" &&
    c.req.method !== "GET" &&
    c.req.method !== "DELETE"
  ) {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      },
      405,
    );
  }

  const agent = c.get("agent");
  const agentName = agent?.name ?? "anonymous";

  // Ensure NATS consumers exist for this agent
  try {
    await nats.ensureConsumer(agentName);
  } catch {
    // Non-fatal — consumer creation may fail on first request, retry on next
  }

  const server = createMcpServer(
    nats,
    agents,
    activity,
    rateLimiter,
    agentName,
    db,
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — new transport per request
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    const response = await transport.handleRequest(c.req.raw);
    return response;
  } catch {
    return c.json(
      {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      },
      500,
    );
  } finally {
    await transport.close();
    await server.close();
  }
});

// --- Helper: cookie secret ---
function cookieSecretFor(env: Env): string {
  return getCookieSecret(env as unknown as Record<string, string | undefined>);
}

// --- Dashboard: Home ---
app.get("/", (c) => {
  const agent = c.get("agent");
  const csrfToken = generateCsrfToken(cookieSecretFor(c.env));

  const totalAgentsRow = db.prepare("SELECT COUNT(*) as count FROM agents").get() as { count: number };
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const onlineAgentsRow = db
    .prepare("SELECT COUNT(*) as count FROM agents WHERE is_active = 1 AND last_seen_at > ?")
    .get(tenMinAgo) as { count: number };
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentMessagesRow = db
    .prepare("SELECT COUNT(*) as count FROM messages WHERE created_at > ?")
    .get(dayAgo) as { count: number };

  const activityResult = activity.list({ limit: 5, offset: 0 });
  const allAgents = agents.list();

  return c.html(
    <HomePage
      stats={{
        totalAgents: totalAgentsRow.count,
        onlineAgents: onlineAgentsRow.count,
        recentMessages: recentMessagesRow.count,
      }}
      activities={activityResult.data}
      agents={allAgents}
      userRole={agent?.role ?? undefined}
      csrfToken={csrfToken}
      agentAvatars={Object.fromEntries(allAgents.filter(a => a.avatar).map(a => [a.name, a.avatar!]))}
    />,
  );
});

// --- Dashboard: Home JSON (for polling) ---
app.get("/api/home", (c) => {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const totalAgentsRow = db.prepare("SELECT COUNT(*) as count FROM agents").get() as { count: number };
  const onlineAgentsRow = db
    .prepare("SELECT COUNT(*) as count FROM agents WHERE is_active = 1 AND last_seen_at > ?")
    .get(tenMinAgo) as { count: number };
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentMessagesRow = db
    .prepare("SELECT COUNT(*) as count FROM messages WHERE created_at > ?")
    .get(dayAgo) as { count: number };

  const allAgents = agents.list();
  const activityResult = activity.list({ limit: 5, offset: 0 });

  return c.json({
    stats: {
      totalAgents: totalAgentsRow.count,
      onlineAgents: onlineAgentsRow.count,
      recentMessages: recentMessagesRow.count,
    },
    agents: allAgents.map((a) => ({
      name: a.name,
      role: a.role,
      avatar: a.avatar,
      working_on: a.working_on,
      last_seen_at: a.last_seen_at,
      is_active: a.is_active,
    })),
    activities: activityResult.data,
  });
});

// --- Dashboard: Agents (admin only) ---
app.get("/agents", (c) => {
  const agent = c.get("agent");
  if (agent?.role !== "admin") {
    return c.redirect("/");
  }

  const csrfToken = generateCsrfToken(cookieSecretFor(c.env));
  const flashKey = c.req.query("flash");
  const flash = getFlash(flashKey);

  return c.html(
    <AgentsPage
      agents={agents.list()}
      csrfToken={csrfToken}
      newToken={flash?.newToken}
      error={flash?.error}
      userRole={agent.role}
    />,
  );
});

app.post("/agents/create", async (c) => {
  const agent = c.get("agent");
  if (agent?.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const cookieSecret = cookieSecretFor(c.env);
  const body = await c.req.parseBody();
  const name = (body["name"] as string)?.trim();
  const avatar = (body["avatar"] as string)?.trim() || undefined;
  const csrf = body["csrf"] as string;

  if (!validateCsrfToken(csrf, cookieSecret)) {
    const flashKey = setFlash({ error: "Ungültiger CSRF-Token." });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  if (!name) {
    const flashKey = setFlash({ error: "Name ist erforderlich." });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  try {
    const { plaintextToken } = agents.create(name, avatar, agent.name);
    const flashKey = setFlash({ newToken: plaintextToken });
    return c.redirect(`/agents?flash=${flashKey}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    const flashKey = setFlash({ error: msg });
    return c.redirect(`/agents?flash=${flashKey}`);
  }
});

app.post("/agents/revoke", async (c) => {
  const agent = c.get("agent");
  if (agent?.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const cookieSecret = cookieSecretFor(c.env);
  const body = await c.req.parseBody();
  const id = body["id"] as string;
  const csrf = body["csrf"] as string;

  if (!validateCsrfToken(csrf, cookieSecret)) {
    const flashKey = setFlash({ error: "Ungültiger CSRF-Token." });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  agents.revokeById(id, agent.name);
  return c.redirect("/agents");
});

app.post("/agents/reactivate", async (c) => {
  const agent = c.get("agent");
  if (agent?.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const cookieSecret = cookieSecretFor(c.env);
  const body = await c.req.parseBody();
  const id = body["id"] as string;
  const csrf = body["csrf"] as string;

  if (!validateCsrfToken(csrf, cookieSecret)) {
    const flashKey = setFlash({ error: "Ungültiger CSRF-Token." });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  const result = agents.reactivate(id, agent.name);
  if (result) {
    const flashKey = setFlash({ newToken: result.plaintextToken });
    return c.redirect(`/agents?flash=${flashKey}`);
  }
  return c.redirect("/agents");
});

app.post("/agents/rename", async (c) => {
  const agent = c.get("agent");
  if (agent?.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const cookieSecret = cookieSecretFor(c.env);
  const body = await c.req.parseBody();
  const id = body["id"] as string;
  const name = (body["name"] as string)?.trim();
  const csrf = body["csrf"] as string;

  if (!validateCsrfToken(csrf, cookieSecret)) {
    const flashKey = setFlash({ error: "Ungültiger CSRF-Token." });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  if (!name) {
    const flashKey = setFlash({ error: "Name ist erforderlich." });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  try {
    agents.rename(id, name, agent.name);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
    const flashKey = setFlash({ error: msg });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  return c.redirect("/agents");
});

app.post("/agents/reset-token", async (c) => {
  const agent = c.get("agent");
  if (agent?.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const cookieSecret = cookieSecretFor(c.env);
  const body = await c.req.parseBody();
  const id = body["id"] as string;
  const csrf = body["csrf"] as string;

  if (!validateCsrfToken(csrf, cookieSecret)) {
    const flashKey = setFlash({ error: "Ungültiger CSRF-Token." });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  const result = agents.resetToken(id, agent.name);
  if (result) {
    const flashKey = setFlash({ newToken: result.plaintextToken });
    return c.redirect(`/agents?flash=${flashKey}`);
  }
  return c.redirect("/agents");
});

app.post("/agents/delete", async (c) => {
  const agent = c.get("agent");
  if (agent?.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const cookieSecret = cookieSecretFor(c.env);
  const body = await c.req.parseBody();
  const id = body["id"] as string;
  const csrf = body["csrf"] as string;

  if (!validateCsrfToken(csrf, cookieSecret)) {
    const flashKey = setFlash({ error: "Ungültiger CSRF-Token." });
    return c.redirect(`/agents?flash=${flashKey}`);
  }

  agents.deleteById(id, agent.name);
  return c.redirect("/agents");
});

app.post("/agents/set-avatar", async (c) => {
  const agent = c.get("agent");
  if (agent?.role !== "admin") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.parseBody();
  const id = body["id"] as string;
  const avatar = (body["avatar"] as string)?.trim() || null;
  const csrf = body["csrf"] as string;
  const cookieSecret = cookieSecretFor(c.env);

  if (!validateCsrfToken(csrf, cookieSecret)) return c.redirect("/agents");

  if (id && avatar) {
    db.prepare("UPDATE agents SET avatar = ?, updated_at = ? WHERE id = ?").run(avatar, new Date().toISOString(), id);
  }
  return c.redirect("/agents");
});

// --- Dashboard: Messages ---
app.get("/messages", (c) => {
  const agent = c.get("agent");
  const csrfToken = generateCsrfToken(cookieSecretFor(c.env));

  const filterAgent = c.req.query("agent") || undefined;
  const offsetParam = parseInt(c.req.query("offset") ?? "0", 10);
  const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;
  const limit = LIMITS.PAGINATION_DEFAULT;

  const result = listMessages({ limit, offset, agent: filterAgent });

  // Build agent name -> avatar map
  const agentAvatars: Record<string, string> = {};
  for (const a of agents.list()) {
    if (a.avatar) agentAvatars[a.name] = a.avatar;
  }

  return c.html(
    <MessagesPage
      result={result}
      userRole={agent?.role ?? undefined}
      csrfToken={csrfToken}
      filterAgent={filterAgent}
      agentAvatars={agentAvatars}
    />,
  );
});

// --- Dashboard: Activity Log ---
app.get("/activity", (c) => {
  const agent = c.get("agent");
  const csrfToken = generateCsrfToken(cookieSecretFor(c.env));

  const offsetParam = parseInt(c.req.query("offset") ?? "0", 10);
  const offset = isNaN(offsetParam) || offsetParam < 0 ? 0 : offsetParam;
  const limit = LIMITS.PAGINATION_DEFAULT;

  const result = activity.list({ limit, offset });

  return c.html(
    <ActivityPage
      result={result}
      userRole={agent?.role ?? undefined}
      csrfToken={csrfToken}
      agentAvatars={Object.fromEntries(agents.list().filter(a => a.avatar).map(a => [a.name, a.avatar!]))}
    />,
  );
});

// --- OAuth routes ---
app.route("/", createOAuthRoutes(agents, db));

// --- Start server + graceful shutdown ---
async function start() {
  // Rotate old data on startup
  const oauthCleaned = cleanupExpiredOAuthTokens(db);
  if (oauthCleaned > 0) {
    console.log(`Cleaned up ${oauthCleaned} expired OAuth tokens`);
  }
  const msgRotated = activity.rotateMessages(MESSAGE_RETENTION_DAYS);
  const actRotated = activity.rotate(ACTIVITY_RETENTION_DAYS);
  if (msgRotated > 0 || actRotated > 0) {
    console.log(`Rotated: ${msgRotated} messages, ${actRotated} activity entries`);
  }

  await nats.connect();
  console.log("Connected to NATS");

  const port = parseInt(process.env.PORT || "3000", 10);
  const server = serve({ fetch: app.fetch, port });
  console.log(`Agent Mesh v${VERSION} listening on :${port}`);

  const shutdown = async () => {
    console.log("Shutting down...");
    server.close();
    await nats.close();
    db.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});

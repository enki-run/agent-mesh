import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { initDatabase } from "./services/db.js";
import { NatsService } from "./services/nats.js";
import { AgentService } from "./services/agent.js";
import { ActivityService } from "./services/activity.js";
import { RateLimiter } from "./services/ratelimit.js";
import { authMiddleware } from "./auth.js";
import { createMcpServer } from "./mcp/server.js";
import { RATE_LIMIT_PER_MINUTE, VERSION } from "./types.js";
import type { Env, AppVariables } from "./types.js";

// --- Initialize services ---
const dbPath = process.env.DATABASE_PATH || "./mesh.db";
const db = initDatabase(dbPath);
const nats = new NatsService(process.env.NATS_URL || "nats://localhost:4222");
const activity = new ActivityService(db);
const agents = new AgentService(db, activity);
const rateLimiter = new RateLimiter(RATE_LIMIT_PER_MINUTE);

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

// --- Auth middleware on all other routes ---
app.use("*", authMiddleware(agents, nats));

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

// --- Dashboard placeholder routes ---
app.get("/", (c) => c.text("Agent Mesh Dashboard - coming soon"));
app.get("/login", (c) => c.text("Login - coming soon"));

// --- Start server + graceful shutdown ---
async function start() {
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

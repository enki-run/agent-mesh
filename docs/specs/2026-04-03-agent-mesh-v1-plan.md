# Agent Mesh V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server that enables AI agents to communicate asynchronously via NATS JetStream, deployed on Coolify at mesh.enki.run.

**Architecture:** TypeScript/Hono MCP server with NATS JetStream backend, SQLite for agent registry + message index, OAuth 2.1 + Bearer token auth. Monolith with clean internal layers (MCP, NATS, Storage). Pattern follows buddy/ernie codebases.

**Tech Stack:** TypeScript, Hono, @hono/node-server, @modelcontextprotocol/sdk, nats.js, better-sqlite3, ulidx, zod, Docker

**Spec:** `docs/specs/2026-04-03-agent-mesh-v1-design.md`

**Reference codebases:** `/Users/nico/Workspace/ernie` (auth, oauth, MCP patterns, views), `/Users/nico/Workspace/buddy-v3` (single-user variant)

---

## File Structure

```
agent-mesh/
  src/
    index.ts              — Hono App, routes, NATS connect, server start
    auth.ts               — Bearer token + cookie auth, CSRF, IP hashing
    oauth.ts              — OAuth 2.1 + PKCE (adapted from ernie)
    types.ts              — All interfaces, constants, enums
    mcp/
      server.ts           — MCP server factory (creates per-agent instance)
      tools/
        messaging.ts      — mesh_send, mesh_receive, mesh_reply
        registry.ts       — mesh_status, mesh_register
        history.ts        — mesh_history
    services/
      db.ts               — SQLite init + migration runner
      agent.ts            — Agent CRUD, token management, presence
      nats.ts             — NATS client, stream/consumer/KV management
      message.ts          — Message envelope creation, validation, TTL
      activity.ts         — Activity/audit log
      ratelimit.ts        — Token-bucket rate limiter per agent
    views/
      layout.tsx          — Base HTML layout with nav
      home.tsx            — Dashboard (online agents, recent messages)
      agents.tsx          — Agent management (admin only)
      messages.tsx        — Message log viewer
      login.tsx           — OAuth token entry form
  migrations/
    0001_initial.sql      — agents, messages, activity_log tables
  tests/
    services/
      agent.test.ts
      message.test.ts
      ratelimit.test.ts
  docker-compose.yml
  Dockerfile
  package.json
  tsconfig.json
  .gitignore
  CLAUDE.md
  README.md
  .github/workflows/ci.yml
```

---

### Task 1: Repo Scaffold + Docker Setup

**Files:**
- Create: `package.json`, `tsconfig.json`, `Dockerfile`, `docker-compose.yml`, `.gitignore`, `CLAUDE.md`

- [ ] **Step 1: Init git repo**

```bash
cd /Users/nico/Workspace/agent-mesh
git init
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "agent-mesh",
  "version": "1.0.0",
  "description": "MCP server for async agent-to-agent communication via NATS",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.0",
    "better-sqlite3": "^11.0.0",
    "hono": "^4.7.0",
    "@hono/node-server": "^1.13.0",
    "nats": "^2.28.0",
    "ulidx": "^2.4.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^6.0.2",
    "vitest": "^3.2.4"
  },
  "license": "Apache-2.0"
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["node_modules", "tests", "dist"]
}
```

- [ ] **Step 4: Create Dockerfile**

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc --outDir dist

FROM node:22-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY migrations ./migrations
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Note: `wget` needed for healthcheck. `better-sqlite3` is a native module — the builder and runtime stages must use the same platform (both Alpine).

- [ ] **Step 5: Create docker-compose.yml**

```yaml
services:
  mesh:
    build: .
    environment:
      - NATS_URL=nats://nats:4222
      - MESH_ADMIN_TOKEN=${MESH_ADMIN_TOKEN}
      - MESH_COOKIE_SECRET=${MESH_COOKIE_SECRET}
      - OAUTH_SECRET=${OAUTH_SECRET}
      - DATABASE_PATH=/data/mesh.db
    volumes:
      - mesh-data:/data
    ports:
      - "3000:3000"
    depends_on:
      nats:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  nats:
    image: nats:2-alpine
    command: ["-js", "-sd", "/data", "-m", "8222"]
    volumes:
      - nats-data:/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:8222/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  mesh-data:
  nats-data:
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
*.db
.env
```

- [ ] **Step 7: Create CLAUDE.md**

```markdown
# Agent Mesh

## What
MCP server for async agent-to-agent communication via NATS JetStream.
Agents (Claude Code, Claude Desktop, Gemini CLI) connect via MCP and exchange messages.

## Tech Stack
TypeScript, Hono, @hono/node-server, @modelcontextprotocol/sdk, nats.js, better-sqlite3

## Commands
- `npm run dev` — Dev server with hot reload (needs NATS running)
- `npm test` — Run tests
- `npx tsc --noEmit` — Type check
- `docker compose up` — Full stack (mesh + NATS)

## Architecture
- `src/mcp/` — MCP server + 6 tools (mesh_send, mesh_receive, mesh_reply, mesh_status, mesh_register, mesh_history)
- `src/services/` — Business logic (nats, agent, message, ratelimit, activity)
- `src/views/` — Dashboard (Hono JSX, server-rendered)
- `src/auth.ts` — Bearer token + cookie auth
- `src/oauth.ts` — OAuth 2.1 + PKCE for interactive clients

## Patterns
Follows ernie/buddy patterns: Hono routes, MCP SDK tools with Zod validation,
server-rendered JSX views, ULID IDs, SHA-256 token hashing, timing-safe comparison.

## Key Design Decisions
- NATS is internal only (not exposed). MCP server is the only NATS client.
- Messages stored in both NATS (delivery) and SQLite (history/lookup).
- context field is mandatory — describes sender's current project/task/status.
- Rate limit: 60 messages/minute per agent (token bucket).
- Payload max: 64 KB per message.
- Presence TTL: 300s (auto-updated on every MCP interaction).

## Commits
Conventional Commits: feat:, fix:, chore:, docs:, refactor:
```

- [ ] **Step 8: npm install and verify**

```bash
npm install
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: initial project scaffold with Docker + NATS setup"
```

---

### Task 2: Types + Constants

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create types.ts**

All interfaces and constants as defined in the spec. See spec Section 4 (Message Envelope), Section 5 (Agent-Identity). Key types: `Env`, `Message`, `Agent`, `RequestAgent`, `Activity`, `AppVariables`, `PaginatedResult`. Key constants: `VERSION`, `MESSAGE_PRIORITIES`, `DEFAULT_TTL_SECONDS`, `MAX_PAYLOAD_BYTES`, `RATE_LIMIT_PER_MINUTE`, `PRESENCE_TTL_SECONDS`, `RECOMMENDED_MESSAGE_TYPES`, `LIMITS`.

Reference: ernie's `src/types.ts` for pattern (const arrays + type extraction, validation matrix approach).

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: types, message envelope, and constants"
```

---

### Task 3: SQLite Database + Migrations

**Files:**
- Create: `src/services/db.ts`
- Create: `migrations/0001_initial.sql`

- [ ] **Step 1: Create migration 0001_initial.sql**

Three tables: `agents` (registry + auth), `messages` (envelope storage for history/lookup), `activity_log` (audit). See spec Section 5 for agents schema, Section 4 for message fields.

The `messages` table stores full message content — NATS handles delivery, SQLite handles history and thread lookup (`mesh_history`, `mesh_reply` thread resolution).

```sql
CREATE TABLE IF NOT EXISTS agents (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  role         TEXT,
  capabilities TEXT,
  token_hash   TEXT NOT NULL,
  is_active    INTEGER NOT NULL DEFAULT 1,
  working_on   TEXT,
  last_seen_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_token_hash ON agents(token_hash);
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(is_active);

CREATE TABLE IF NOT EXISTS messages (
  id             TEXT PRIMARY KEY,
  from_agent     TEXT NOT NULL,
  to_agent       TEXT NOT NULL,
  type           TEXT NOT NULL,
  payload        TEXT NOT NULL,
  context        TEXT NOT NULL,
  correlation_id TEXT,
  reply_to       TEXT,
  priority       TEXT NOT NULL DEFAULT 'normal',
  ttl_seconds    INTEGER NOT NULL DEFAULT 86400,
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_correlation ON messages(correlation_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

CREATE TABLE IF NOT EXISTS activity_log (
  id          TEXT PRIMARY KEY,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  summary     TEXT,
  agent_name  TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
```

- [ ] **Step 2: Create db.ts — SQLite wrapper with auto-migration**

Initializes SQLite with WAL mode, runs migrations from `migrations/` directory, tracks applied migrations in `_migrations` table. Pattern: read all `.sql` files sorted by name, skip already-applied ones.

- [ ] **Step 3: Commit**

```bash
git add src/services/db.ts migrations/
git commit -m "feat: SQLite database with migration runner"
```

---

### Task 4: Core Services (Agent, Activity, Message, Rate Limiter)

**Files:**
- Create: `src/services/agent.ts`
- Create: `src/services/activity.ts`
- Create: `src/services/message.ts`
- Create: `src/services/ratelimit.ts`
- Create: `tests/services/agent.test.ts`
- Create: `tests/services/message.test.ts`
- Create: `tests/services/ratelimit.test.ts`

- [ ] **Step 1: Create activity.ts**

Follow ernie's `src/services/activity.ts`. Methods: `log()`, `list()`, `logAsync()` (fire-and-forget for dead letter logging — must not block NATS ack). Uses `better-sqlite3` synchronous API.

- [ ] **Step 2: Create agent.ts**

Follow ernie's `src/services/user.ts` pattern. Key difference: agents have `role`, `capabilities`, `working_on` fields. Methods:
- `create(name)` → generates token, returns plaintext once
- `list()` → all agents without token_hash
- `getByName(name)` → lookup for mesh_send target validation
- `getByTokenHash(hash)` → lookup for auth
- `revokeById(id)`, `reactivate(id)`, `rename(id, newName)`, `resetToken(id)`
- `updatePresence(id, { role?, capabilities?, working_on? })` → updates fields + last_seen_at
- All mutations log to ActivityService

Token format: `bt_` + 32 chars base36 from 32 random bytes. Hash: SHA-256 via `crypto.createHash`.

- [ ] **Step 3: Create message.ts**

Functions: `createMessage(params)` → builds Message with ULID, validates payload size (64 KB). `isMessageExpired(msg)` → checks TTL. `serializeMessage(msg)` / `deserializeMessage(data)` → JSON encode/decode to Uint8Array.

- [ ] **Step 4: Create ratelimit.ts**

Token-bucket: 60 tokens per agent, refills every 60 seconds. `check(agentName)` → `{ allowed, retryAfterSeconds? }`.

- [ ] **Step 5: Write tests**

- `agent.test.ts`: create, duplicate rejection, token lookup, deactivate, presence update
- `message.test.ts`: creation, payload size validation, TTL expiry, serialization roundtrip
- `ratelimit.test.ts`: under limit, over limit with retryAfter, independent per agent

Use `better-sqlite3` with `:memory:` database for tests. Read migration SQL from file.

- [ ] **Step 6: Run tests**

```bash
npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add src/services/ tests/
git commit -m "feat: agent, activity, message, and rate limiter services"
```

---

### Task 5: NATS Service

**Files:**
- Create: `src/services/nats.ts`

- [ ] **Step 1: Create nats.ts**

NATS client wrapper using `nats` npm package. Methods:
- `connect()` — connects, ensures MESH_MESSAGES stream exists (subjects: `mesh.agents.>`, `mesh.broadcast`; MaxAge 7 days; 1 GB; dedup window 5 min), creates `mesh-presence` KV bucket (TTL 300s)
- `publish(subject, data, msgId)` — JetStream publish with msg-ID for dedup
- `ensureConsumer(agentName)` — creates durable consumer for inbox + broadcast (if not exists)
- `deleteConsumer(agentName)` — removes consumers on agent deactivation
- `pullMessages(agentName, limit)` — fetches from inbox + broadcast consumers, returns raw messages with ack callbacks
- `updatePresence(agentName, data)` — KV put
- `getPresence()` — KV scan, returns Map of agent name → presence data
- `ping()` — flush connection, returns boolean

Note: NATS integration tests require a running NATS instance. Mark with `describe.skipIf(!process.env.NATS_URL)`.

- [ ] **Step 2: Commit**

```bash
git add src/services/nats.ts
git commit -m "feat: NATS JetStream service with streams, consumers, KV presence"
```

---

### Task 6: Auth Middleware

**Files:**
- Create: `src/auth.ts`

- [ ] **Step 1: Create auth.ts**

Adapt ernie's `src/auth.ts` for Node.js (use `crypto` module instead of Web Crypto API where needed). Key functions:
- `hashToken(token)` — SHA-256 via `crypto.createHash`
- `timingSafeEqual(a, b)` — use `crypto.timingSafeEqual` (Node.js native)
- `authMiddleware(db, agents, nats)` — Hono middleware:
  - Skip public paths: `/health`, `/login`, `/oauth/*`, `/.well-known/*`
  - Check `Authorization: Bearer` → hash → `agents.getByTokenHash()` → role "agent"
  - Check admin token (MESH_ADMIN_TOKEN) → role "admin"
  - Fall back to cookie session
  - Update `last_seen_at` + NATS presence on every auth'd request
  - Set `c.set("agent", { name, role })`
- `generateCsrfToken(secret)`, `validateCsrfToken(token, secret)` — HMAC-signed nonce+timestamp
- `generateSessionCookie(agentName, secret)`, `getCookieSecret(env)`

Node.js differences from ernie: use `crypto.createHash` instead of `crypto.subtle.digest`, use `crypto.timingSafeEqual` instead of HMAC-based comparison, use `crypto.randomBytes` instead of `crypto.getRandomValues`.

- [ ] **Step 2: Commit**

```bash
git add src/auth.ts
git commit -m "feat: auth middleware with Bearer token, cookie, CSRF"
```

---

### Task 7: MCP Server + All 6 Tools

**Files:**
- Create: `src/mcp/server.ts`
- Create: `src/mcp/tools/messaging.ts`
- Create: `src/mcp/tools/registry.ts`
- Create: `src/mcp/tools/history.ts`

- [ ] **Step 1: Create server.ts — MCP server factory**

Creates a `McpServer` per authenticated agent. Registers all 6 tools. The `agentName` is passed in from auth and used as `from` in all messages (server-enforced identity).

Instructions string tells agents about context field requirements and how to use the tools.

Follow ernie's `src/mcp/server.ts` pattern for structure.

- [ ] **Step 2: Create messaging.ts — mesh_send, mesh_receive, mesh_reply**

**mesh_send:**
- Zod schema: `to` (string), `type` (string), `payload` (string, max 65536), `context` (string), `correlation_id` (string, optional), `priority` (enum, optional), `ttl_seconds` (number, optional)
- Rate limit check → error with retryAfterSeconds if exceeded
- Validate target agent exists and is active (unless broadcast) → error if not
- Create message via `createMessage()`, publish to NATS, store in SQLite `messages` table
- Update NATS presence
- Log to activity
- Return `{ id, to, type, created_at }`

**mesh_receive:**
- Zod schema: `limit` (number, optional), `type` (string, optional)
- Pull from NATS consumers (inbox + broadcast)
- Filter expired messages (ack silently)
- Filter by type if specified (don't ack non-matching — leave for later)
- Update NATS presence
- Return `{ messages: [...], count }` or `{ messages: [], hint: "No new messages." }`

**mesh_reply:**
- Zod schema: `message_id` (string), `payload` (string, max 65536), `context` (string)
- Rate limit check
- Look up original message in SQLite `messages` table
- Determine thread root: if original has `correlation_id`, use it; otherwise use `message_id` as root
- Create reply message with `correlation_id` = thread root, `reply_to` = message_id
- Publish to NATS (to original sender's inbox), store in SQLite
- Update presence, log activity
- Return confirmation

- [ ] **Step 3: Create registry.ts — mesh_status, mesh_register**

**mesh_status:**
- No params
- Get all agents from SQLite (`agents.list()`)
- Get NATS presence map
- Merge: add `online` boolean (true if presence key exists)
- Return agent list with online status

**mesh_register:**
- Zod schema: `role` (string, optional), `capabilities` (string[], optional), `working_on` (string, optional)
- Update agent in SQLite via `agents.updatePresence()`
- Update NATS KV presence
- Return confirmation

- [ ] **Step 4: Create history.ts — mesh_history**

**mesh_history:**
- Zod schema: `correlation_id` (string), `limit` (number, optional, default 50)
- Query SQLite `messages` table: `WHERE correlation_id = ? OR id = ? ORDER BY created_at ASC LIMIT ?`
- Return chronological message list

- [ ] **Step 5: Wire MCP transport in index.ts**

Use `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js`. Mount at `/mcp`. Create per-request MCP server instance with the authenticated agent's name.

Reference: MCP SDK docs for Streamable HTTP transport setup with Hono.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/
git commit -m "feat: MCP server with all 6 tools (send, receive, reply, status, register, history)"
```

---

### Task 8: Hono App + Health Endpoint

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create index.ts — main application entry**

- Initialize SQLite via `initDatabase()`
- Initialize NatsService, connect on startup
- Initialize AgentService, ActivityService, RateLimiter
- Create Hono app
- Mount: `GET /health` (checks NATS ping + SQLite SELECT 1, returns 200/503)
- Mount: auth middleware on `*`
- Mount: MCP transport at `/mcp`
- Mount: OAuth routes
- Mount: Dashboard routes (GET `/`, `/agents`, `/messages`, `/login`)
- Mount: Admin POST routes (`/agents/create`, `/agents/revoke`, `/agents/reactivate`, `/agents/rename`, `/agents/reset-token`)
- Start server via `@hono/node-server` `serve()` on port 3000
- Graceful shutdown: close NATS on SIGTERM

- [ ] **Step 2: Verify dev server starts**

```bash
docker run -d --name nats-dev -p 4222:4222 -p 8222:8222 nats:2-alpine -js -m 8222
MESH_ADMIN_TOKEN=dev-token-32chars-placeholder npm run dev
curl http://localhost:3000/health
```

Expected: `{"status":"ok","nats":"connected","db":"ok"}`

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: Hono app with health, auth, MCP transport, routes"
```

---

### Task 9: OAuth 2.1

**Files:**
- Create: `src/oauth.ts`

- [ ] **Step 1: Create oauth.ts**

Adapt ernie's `src/oauth.ts` (366 lines). Changes:
- Branding: `ernie` → `agent-mesh`
- Token names: `ERNIE_ADMIN_TOKEN` → `MESH_ADMIN_TOKEN`
- User resolution: use `AgentService` for token lookup (agents are the users in agent-mesh)
- Cookie secret: `MESH_COOKIE_SECRET`
- OAuth secret: `OAUTH_SECRET` (for HMAC-signed authorization codes)
- Keep: `isAllowedRedirectUri` (localhost only + improved error message with rejected URI)
- Keep: PKCE S256 enforcement
- Keep: stateless authorization codes (HMAC-signed timestamps)
- Keep: client registration endpoint
- Adapt: Node.js crypto (same as auth.ts)

Register in index.ts: `app.route("/", createOAuthRoutes())`

- [ ] **Step 2: Commit**

```bash
git add src/oauth.ts
git commit -m "feat: OAuth 2.1 + PKCE for interactive MCP clients"
```

---

### Task 10: Dashboard Views

**Files:**
- Create: `src/views/layout.tsx`
- Create: `src/views/home.tsx`
- Create: `src/views/agents.tsx`
- Create: `src/views/messages.tsx`
- Create: `src/views/login.tsx`

- [ ] **Step 1: Create layout.tsx — base template**

Follow ernie's `src/views/layout.tsx` pattern. Nav items: Home, Agents (admin only), Messages. Design tokens (CSS variables) same as ernie for visual consistency across the enki.run ecosystem.

- [ ] **Step 2: Create home.tsx — dashboard**

Show: count of online agents (from NATS presence), total registered agents, recent messages (last 10 from SQLite), last 5 activity entries.

- [ ] **Step 3: Create agents.tsx — agent management (admin only)**

Follow ernie's `src/views/admin.tsx` pattern exactly — create form, token display, agent table with rename/deactivate/reactivate/token-reset buttons. Same styling and UX.

- [ ] **Step 4: Create messages.tsx — message log viewer**

Table: from, to, type, context (truncated to 80 chars), priority badge, created_at (German locale). Filter by agent name (query param `?agent=X`). Pagination (offset-based, same as ernie's activity view).

- [ ] **Step 5: Create login.tsx — OAuth authorize page**

Follow ernie's authorize page (in oauth.ts `authorizePageHTML`). Same minimal design.

- [ ] **Step 6: Wire dashboard routes in index.ts**

Add GET routes for `/`, `/agents`, `/messages` and POST routes for agent management.

- [ ] **Step 7: Commit**

```bash
git add src/views/
git commit -m "feat: dashboard with agent management and message log"
```

---

### Task 11: CI + README + GitHub Repo

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `README.md`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit
```

- [ ] **Step 2: Create README.md**

Sections: What (1 paragraph), Quick Start (docker compose), Agent Connection (MCP config JSON), MCP Tools Reference (table with all 6 tools), Architecture (brief), Deployment (Coolify instructions).

- [ ] **Step 3: Create GitHub repo and push**

```bash
gh repo create enki-run/agent-mesh --private --source=. --push
```

- [ ] **Step 4: Commit and push**

```bash
git add .github/ README.md
git commit -m "chore: CI workflow, README, GitHub repo"
git push origin main
```

---

### Task 12: Deploy to Coolify

**Files:** none (Coolify configuration via browser)

- [ ] **Step 1: Coolify setup — provide instructions to user**

Dashboard URL, settings:
- New Resource → Docker Compose
- Git Repository: `enki-run/agent-mesh`, Branch: `main`
- Environment variables:
  - `MESH_ADMIN_TOKEN` — `openssl rand -hex 32`
  - `MESH_COOKIE_SECRET` — `openssl rand -hex 32`
  - `OAUTH_SECRET` — `openssl rand -hex 32`
  - `DATABASE_PATH` — `/data/mesh.db`
  - `NATS_URL` — `nats://nats:4222`
- Domain: `mesh.enki.run`
- Persistent volumes: `mesh-data`, `nats-data`

- [ ] **Step 2: Verify deployment**

```bash
curl https://mesh.enki.run/health
# Expected: {"status":"ok","nats":"connected","db":"ok"}
```

- [ ] **Step 3: Create first agents and test**

1. Log in with admin token at `https://mesh.enki.run/login`
2. Create agents: `agent-a`, `agent-b` → copy tokens
3. Configure Claude Code MCP for both:

```json
{
  "mcpServers": {
    "mesh": {
      "type": "streamable-http",
      "url": "https://mesh.enki.run/mcp",
      "headers": { "Authorization": "Bearer bt_xxxx..." }
    }
  }
}
```

4. End-to-end test from one Claude Code session:
   - `mesh_register(role: "developer")` → success
   - `mesh_send(to: "agent-b", type: "info", payload: "Hello!", context: "Testing mesh")` → returns msg ID
   - `mesh_status()` → shows both agents
   - `mesh_history(correlation_id: msg_id)` → shows the message

- [ ] **Step 4: Update buddy project tasks**

Complete buddy tasks: "GitHub Repo enki-run/agent-mesh anlegen und Skeleton pushen", "go mod tidy + erster lokaler Build-Test" (N/A — TypeScript instead of Go).

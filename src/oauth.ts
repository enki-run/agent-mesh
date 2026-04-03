import crypto from "node:crypto";
import { Hono } from "hono";
import { hashToken, timingSafeEqual, getCookieSecret } from "./auth.js";
import type { AgentService } from "./services/agent.js";
import type { Env, AppVariables } from "./types.js";

// OAuth 2.1 for MCP server
// Uses MESH_ADMIN_TOKEN as the basis for all crypto operations
// Stateless: authorization codes are HMAC-signed timestamps
// PKCE (S256) is REQUIRED per OAuth 2.1
// Multi-user: accepts admin token OR personal agent tokens

const OAUTH_CLIENT_ID = "agent-mesh-mcp-client";
const CODE_EXPIRY_MS = 300_000; // 5 minutes

// In-memory token store: code -> { token, expiresAt }
// Replaces Cloudflare KV — auto-cleaned up after 5 min
const tokenStore = new Map<string, { token: string; expiresAt: number }>();

function storeToken(code: string, token: string): void {
  const expiresAt = Date.now() + CODE_EXPIRY_MS;
  tokenStore.set(code, { token, expiresAt });

  // Schedule cleanup
  setTimeout(() => {
    const entry = tokenStore.get(code);
    if (entry && Date.now() >= entry.expiresAt) {
      tokenStore.delete(code);
    }
  }, CODE_EXPIRY_MS + 1000);
}

function retrieveToken(code: string): string | null {
  const entry = tokenStore.get(code);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    tokenStore.delete(code);
    return null;
  }
  tokenStore.delete(code);
  return entry.token;
}

// --- Redirect URI validation ---
// Only allow localhost/loopback origins (MCP clients run locally)
function isAllowedRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    const hostname = url.hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

// --- HMAC signing (Node.js crypto) ---
function hmacSign(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

// --- Stateless authorization code: timestamp.sig ---
function generateCode(secret: string): string {
  const timestamp = Date.now().toString();
  const sig = hmacSign(`code:${timestamp}`, secret);
  return `${timestamp}.${sig}`;
}

function verifyCode(code: string, secret: string): boolean {
  const parts = code.split(".");
  if (parts.length !== 2) return false;
  const [timestamp, sig] = parts;
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age > CODE_EXPIRY_MS || age < 0) return false;
  const expected = hmacSign(`code:${timestamp}`, secret);
  return timingSafeEqual(sig, expected);
}

// --- HTML escape ---
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// --- Authorize page HTML ---
function authorizePageHTML(params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  error?: boolean;
}): string {
  const { redirectUri, state, codeChallenge, codeChallengeMethod, error } =
    params;
  const errorBlock = error
    ? '<div class="error">Ungültiger Token</div>'
    : "";
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>agent-mesh — Authorize</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .box { background: #fff; border: 1px solid #e0e0e0; padding: 32px; border-radius: 8px; width: 340px; box-shadow: 0 12px 32px rgba(0,0,0,0.06); }
    h1 { font-family: 'JetBrains Mono', monospace; font-size: 18px; margin-bottom: 8px; }
    p { font-size: 13px; color: #666; margin-bottom: 20px; }
    input { width: 100%; padding: 9px 12px; border: 1px solid #e0e0e0; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 13px; margin-bottom: 14px; }
    input:focus { outline: none; border-color: #444; }
    button { width: 100%; padding: 9px; background: #111; color: #fff; border: none; border-radius: 6px; font-weight: 600; font-size: 12px; cursor: pointer; }
    button:hover { background: #222; }
    .error { color: #904040; font-size: 12px; background: #fdf5f5; padding: 6px; border-radius: 6px; border: 1px solid #c08080; margin-bottom: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="box">
    <h1>agent-mesh</h1>
    <p>MCP-Zugriff autorisieren</p>
    ${errorBlock}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(state)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(codeChallengeMethod)}">
      <input name="token" type="password" placeholder="Token eingeben..." autofocus autocomplete="current-password">
      <button type="submit">Autorisieren</button>
    </form>
  </div>
</body>
</html>`;
}

// --- Resolve user from token ---
// Returns true if the token is valid (admin or active agent)
function resolveUser(
  token: string,
  agents: AgentService,
  adminToken: string,
  adminTokenPrev: string | undefined,
): boolean {
  const hash = hashToken(token);
  const adminHash = hashToken(adminToken);

  if (timingSafeEqual(hash, adminHash)) return true;
  if (adminTokenPrev && timingSafeEqual(hash, hashToken(adminTokenPrev))) {
    return true;
  }

  const agent = agents.getByTokenHash(hash);
  return agent !== null && agent.is_active === 1;
}

// --- OAuth sub-app ---
type HonoEnv = { Bindings: Env; Variables: AppVariables };

export function createOAuthRoutes(agents: AgentService) {
  const oauth = new Hono<HonoEnv>();

  // RFC 8414 — OAuth Authorization Server Metadata
  oauth.get("/.well-known/oauth-authorization-server", (c) => {
    const origin = new URL(c.req.url).origin;
    return c.json({
      issuer: origin,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
      code_challenge_methods_supported: ["S256"],
    });
  });

  // Dynamic Client Registration (MCP spec requires this)
  // SECURITY: Never return real tokens — client_secret is a placeholder.
  // Users authenticate via the /oauth/authorize form with their personal token.
  oauth.post("/oauth/register", async (c) => {
    const body = await c.req.json();
    return c.json(
      {
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_ID,
        client_name: body.client_name || "MCP Client",
        redirect_uris: body.redirect_uris || [],
      },
      201,
    );
  });

  // Authorization endpoint — shows token-entry form, issues code
  oauth.get("/oauth/authorize", async (c) => {
    const redirectUri = c.req.query("redirect_uri");
    const state = c.req.query("state") ?? "";
    const codeChallenge = c.req.query("code_challenge") ?? "";
    const codeChallengeMethod = c.req.query("code_challenge_method") ?? "";

    if (!redirectUri) {
      return c.text("Missing redirect_uri", 400);
    }

    if (!isAllowedRedirectUri(redirectUri)) {
      return c.json(
        {
          error: "invalid_request",
          error_description: `redirect_uri must be localhost (got: ${redirectUri})`,
        },
        400,
      );
    }

    // OAuth 2.1: PKCE S256 is REQUIRED
    if (!codeChallenge || codeChallengeMethod !== "S256") {
      return c.json(
        {
          error: "invalid_request",
          error_description:
            "PKCE is required. Provide code_challenge with code_challenge_method=S256",
        },
        400,
      );
    }

    return c.html(
      authorizePageHTML({
        redirectUri,
        state,
        codeChallenge,
        codeChallengeMethod,
      }),
    );
  });

  oauth.post("/oauth/authorize", async (c) => {
    const body = await c.req.parseBody();
    const token = body["token"] as string;
    const redirectUri = body["redirect_uri"] as string;
    const state = body["state"] as string;
    const codeChallenge = body["code_challenge"] as string;
    const codeChallengeMethod = body["code_challenge_method"] as string;

    if (!isAllowedRedirectUri(redirectUri)) {
      return c.json(
        {
          error: "invalid_request",
          error_description: `redirect_uri must be localhost (got: ${redirectUri})`,
        },
        400,
      );
    }

    // OAuth 2.1: PKCE S256 is REQUIRED
    if (!codeChallenge || codeChallengeMethod !== "S256") {
      return c.json(
        {
          error: "invalid_request",
          error_description:
            "PKCE is required. Provide code_challenge with code_challenge_method=S256",
        },
        400,
      );
    }

    const adminToken = process.env.MESH_ADMIN_TOKEN ?? "";
    const adminTokenPrev = process.env.MESH_ADMIN_TOKEN_PREVIOUS;

    const valid = resolveUser(token, agents, adminToken, adminTokenPrev);

    if (!valid) {
      return c.html(
        authorizePageHTML({
          redirectUri,
          state,
          codeChallenge,
          codeChallengeMethod,
          error: true,
        }),
        401,
      );
    }

    // Generate authorization code (stateless, HMAC-signed)
    const code = generateCode(adminToken);

    // SECURITY: Store token server-side in memory (5min TTL), never in the URL.
    // The token exchange retrieves it by code key.
    const fullCode = `${code}:${codeChallenge}`;
    storeToken(code, token);

    const url = new URL(redirectUri);
    url.searchParams.set("code", fullCode);
    if (state) url.searchParams.set("state", state);

    return c.redirect(url.toString());
  });

  // Token endpoint — exchanges code for access token
  oauth.post("/oauth/token", async (c) => {
    const contentType = c.req.header("content-type") ?? "";
    let grantType: string;
    let code: string;
    let codeVerifier: string;

    if (contentType.includes("application/json")) {
      const body = await c.req.json();
      grantType = body.grant_type;
      code = body.code;
      codeVerifier = body.code_verifier;
    } else {
      const body = await c.req.parseBody();
      grantType = body["grant_type"] as string;
      code = body["code"] as string;
      codeVerifier = body["code_verifier"] as string;
    }

    if (grantType !== "authorization_code") {
      return c.json({ error: "unsupported_grant_type" }, 400);
    }

    if (!code) {
      return c.json(
        { error: "invalid_grant", error_description: "Missing code" },
        400,
      );
    }

    // Extract code and code_challenge from format: timestamp.sig:challenge
    const colonIdx = code.lastIndexOf(":");
    let actualCode = code;
    let storedChallenge = "";

    if (colonIdx !== -1) {
      actualCode = code.substring(0, colonIdx);
      storedChallenge = code.substring(colonIdx + 1);
    }

    const adminToken = process.env.MESH_ADMIN_TOKEN ?? "";

    const valid = verifyCode(actualCode, adminToken);
    if (!valid) {
      return c.json(
        {
          error: "invalid_grant",
          error_description: "Invalid or expired code",
        },
        400,
      );
    }

    // OAuth 2.1: PKCE verification is REQUIRED
    if (!storedChallenge || !codeVerifier) {
      return c.json(
        {
          error: "invalid_grant",
          error_description: "PKCE code_verifier is required",
        },
        400,
      );
    }

    // Verify PKCE S256: SHA256(code_verifier) base64url === stored challenge
    const digest = crypto
      .createHash("sha256")
      .update(codeVerifier)
      .digest();
    const computed = digest
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    if (computed !== storedChallenge) {
      return c.json(
        {
          error: "invalid_grant",
          error_description: "PKCE verification failed",
        },
        400,
      );
    }

    // Retrieve the user's token from in-memory store (stored during authorize step)
    // SECURITY: Token is never exposed in URLs — only stored server-side.
    const storedToken = retrieveToken(actualCode);
    const accessToken = storedToken ?? adminToken;

    return c.json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 2592000, // 30 days
    });
  });

  return oauth;
}

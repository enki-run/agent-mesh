import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NatsService } from "../../services/nats.ts";
import type { AgentService } from "../../services/agent.ts";
import type { PresenceService } from "../../services/presence.ts";
import { log } from "../../services/logger.ts";
import {
  computePresenceState,
  PRESENCE_THRESHOLDS,
  type Presence,
} from "../../services/presence.ts";

function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

interface PresenceEntry {
  role?: string;
  capabilities?: string[];
  working_on?: string;
  timestamp?: string;
}

// ─── Backward-compat re-exports ──────────────────────────────────────
// These shims keep existing imports working while call sites migrate to
// `src/services/presence.ts`. Removed in the final cleanup commit of
// the presence-service refactor.

/** @deprecated Import from `src/services/presence.ts` instead. */
export type { Presence };

/** @deprecated Import `PRESENCE_THRESHOLDS.staleMs` from `src/services/presence.ts`. */
export const STALE_THRESHOLD_MS = PRESENCE_THRESHOLDS.staleMs;

/** @deprecated Use `computePresenceState` from `src/services/presence.ts`. */
export function computePresence(
  inPresenceKV: boolean,
  lastSeenAt: string | null,
  now: number = Date.now(),
  staleThresholdMs: number = PRESENCE_THRESHOLDS.staleMs,
): Presence {
  return computePresenceState(inPresenceKV, lastSeenAt, now, {
    staleMs: staleThresholdMs,
  });
}

export function registerRegistryTools(
  server: McpServer,
  nats: NatsService,
  agents: AgentService,
  presence: PresenceService,
  agentName: string,
): void {
  // ── mesh_status ───────────────────────────────────────────────
  server.tool(
    "mesh_status",
    "See which agents are online and what they are working on. No parameters needed.",
    {},
    { readOnlyHint: true },
    async () => {
      const allAgents = agents.list();
      // C4: If NATS is unavailable, degrade gracefully to DB-only presence.
      // Agents still show up with their last_seen_at, just without the
      // "live" KV signal — computePresence handles the empty Map correctly.
      let presence: Map<string, unknown>;
      try {
        presence = await nats.getPresence();
      } catch (err) {
        log("warn", "nats presence read failed in mesh_status", {
          err: String(err),
        });
        presence = new Map();
      }

      const agentList = allAgents.map((agent) => {
        const p = presence.get(agent.name) as PresenceEntry | undefined;
        const inPresenceKV = presence.has(agent.name);
        // Prefer the NATS KV timestamp when the agent is live; otherwise
        // fall back to the SQLite last_seen_at (which is touched by authMiddleware).
        const effectiveLastSeen = p?.timestamp ?? agent.last_seen_at ?? null;
        const presenceState = computePresence(inPresenceKV, effectiveLastSeen);
        return {
          name: agent.name,
          avatar: agent.avatar ?? null,
          role: p?.role ?? agent.role ?? null,
          capabilities: p?.capabilities ?? (agent.capabilities ? JSON.parse(agent.capabilities) : null),
          is_active: agent.is_active === 1,
          // `online` kept for backward compatibility — equivalent to presence === "live"
          online: inPresenceKV,
          presence: presenceState,
          working_on: p?.working_on ?? agent.working_on ?? null,
          last_seen_at: effectiveLastSeen,
        };
      });

      return ok({ agents: agentList, count: agentList.length });
    },
  );

  // ── mesh_register ─────────────────────────────────────────────
  server.tool(
    "mesh_register",
    "Announce your role, capabilities, and current task so other agents can discover you.",
    {
      role: z.string().optional().describe("Your role (e.g. 'deploy-agent', 'code-reviewer')"),
      capabilities: z.array(z.string()).optional().describe("List of capabilities (e.g. ['deploy', 'rollback', 'monitor'])"),
      working_on: z.string().optional().describe("What you are currently working on"),
    },
    async (params) => {
      // Single presence write-path: SQLite + NATS KV updated atomically
      // (from the caller's perspective). NATS KV failures are logged
      // internally by the service and never surface here.
      await presence.touch(agentName, {
        role: params.role,
        capabilities: params.capabilities,
        working_on: params.working_on,
      });

      return ok({
        agent: agentName,
        registered: true,
        role: params.role ?? null,
        capabilities: params.capabilities ?? null,
        working_on: params.working_on ?? null,
      });
    },
  );
}

/**
 * Agent Presence — single source of truth.
 *
 * Presence is a derived 4-state signal combining two backing stores:
 *
 * - **NATS KV `mesh-presence` bucket** (auto-expires after `liveMs`): the
 *   "is the agent currently running" signal. Written on any agent
 *   interaction (auth middleware, MCP tool calls). Missing ⇒ not live.
 * - **SQLite `agents.last_seen_at`** (persistent, never cleared): the
 *   audit-trail of when the agent was last seen ever. Used to distinguish
 *   "recently dead" (stale) from "long gone" (offline) from "never used"
 *   (never).
 *
 * Together the two stores derive the `Presence` state via the pure
 * `computePresenceState` function below. This is the ONLY place presence
 * is computed — views, the `/mesh_status` MCP tool, the home dashboard
 * stats and the `/agents` admin table all funnel through here.
 *
 * The `is_active` column on `agents` is NOT part of presence. It's a pure
 * authentication signal ("does the token still work"). Mixing it into
 * presence queries is a bug — a revoked-but-recently-seen agent is still
 * "stale", not "online", and a never-revoked-but-never-seen agent is
 * "never", not "online".
 *
 * Subsequent commits in this refactor add a `PresenceService` class on
 * top of this pure layer that owns the single write-path (`touch()`) and
 * the single read-path (`list()` / `countByState()`).
 */

import type { Agent } from "../types.js";

export type Presence = "live" | "stale" | "offline" | "never";

/**
 * Time windows that define the state transitions. Centralised so that
 * changing the NATS KV TTL in one place (`nats.ts`) and the stale
 * threshold here gives a consistent answer everywhere.
 *
 * - `liveMs`  — matches the NATS KV bucket TTL (600s = 10min). If the
 *   agent is present in KV, it's live. This is authoritative.
 * - `staleMs` — how long after the last signal an agent still counts as
 *   "recently dead" before being declared offline. 24h is a compromise
 *   between "quick cleanup" and "don't lose context during a maintenance
 *   window".
 */
export const PRESENCE_THRESHOLDS = {
  liveMs: 600_000, // 10 min, equals KV_TTL_MS in nats.ts
  staleMs: 24 * 60 * 60 * 1000, // 24h
} as const;

export interface PresenceMeta {
  role?: string;
  capabilities?: string[];
  working_on?: string;
}

/** An agent joined with its computed presence state — the shape every
 *  view/API layer should consume once the service class is wired in. */
export interface AgentWithPresence {
  agent: Agent;
  presence: Presence;
  /** NATS KV metadata if the agent is live, otherwise null. */
  liveMeta: PresenceMeta | null;
  /** Effective last-seen timestamp: NATS KV `timestamp` if live,
   *  otherwise the SQLite `last_seen_at`. Null only if truly never seen. */
  effectiveLastSeen: string | null;
}

/**
 * Pure presence-state calculation. Takes the KV presence signal and the
 * last_seen_at timestamp; returns the 4-state. Kept pure so it's trivial
 * to unit-test without NATS or SQLite.
 */
export function computePresenceState(
  inPresenceKV: boolean,
  lastSeenAt: string | null,
  now: number = Date.now(),
  thresholds: { staleMs: number } = PRESENCE_THRESHOLDS,
): Presence {
  if (inPresenceKV) return "live";
  if (!lastSeenAt) return "never";
  const lastSeenMs = Date.parse(lastSeenAt);
  if (Number.isNaN(lastSeenMs)) return "never";
  if (now - lastSeenMs < thresholds.staleMs) return "stale";
  return "offline";
}

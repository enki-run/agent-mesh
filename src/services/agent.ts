import crypto from "node:crypto";
import { ulid } from "ulidx";
import type Database from "better-sqlite3";
import type { Agent } from "../types";
import { MAX_AGENTS } from "../types";
import type { ActivityService } from "./activity";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// In-memory cache: token_hash -> Agent (cleared on mutations)
let tokenCache = new Map<string, Agent>();

export function clearTokenCache(): void {
  tokenCache = new Map();
}

function generateToken(): string {
  const bytes = crypto.randomBytes(32);
  return (
    "bt_" +
    Array.from(bytes)
      .map((b) => b.toString(36))
      .join("")
      .slice(0, 32)
  );
}

export class AgentService {
  constructor(
    private db: Database.Database,
    private activity: ActivityService,
  ) {}

  create(
    name: string,
    adminName?: string,
  ): { agent: Agent; plaintextToken: string } {
    // Check max agents limit
    const count = this.db
      .prepare("SELECT COUNT(*) as cnt FROM agents WHERE is_active = 1")
      .get() as { cnt: number };
    if (count.cnt >= MAX_AGENTS) {
      throw new Error(`Maximum number of agents (${MAX_AGENTS}) reached`);
    }

    const id = ulid();
    const now = new Date().toISOString();
    const plaintextToken = generateToken();
    const token_hash = hashToken(plaintextToken);

    this.db
      .prepare(
        `INSERT INTO agents (id, name, token_hash, is_active, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`,
      )
      .run(id, name, token_hash, now, now);

    clearTokenCache();

    this.activity.log({
      action: "agent_created",
      entity_type: "agent",
      entity_id: id,
      summary: `Agent "${name}" created`,
      agent_name: adminName,
    });

    const agent: Agent = {
      id,
      name,
      role: null,
      capabilities: null,
      token_hash,
      is_active: 1,
      working_on: null,
      last_seen_at: null,
      created_at: now,
      updated_at: now,
    };

    return { agent, plaintextToken };
  }

  list(): Omit<Agent, "token_hash">[] {
    return this.db
      .prepare(
        "SELECT id, name, role, capabilities, is_active, working_on, last_seen_at, created_at, updated_at FROM agents ORDER BY name",
      )
      .all() as Omit<Agent, "token_hash">[];
  }

  getByName(name: string): Agent | null {
    const row = this.db
      .prepare("SELECT * FROM agents WHERE name = ? COLLATE NOCASE")
      .get(name) as Agent | undefined;
    return row ?? null;
  }

  getByTokenHash(hash: string): Agent | null {
    // Check cache first
    const cached = tokenCache.get(hash);
    if (cached) return cached;

    const row = this.db
      .prepare("SELECT * FROM agents WHERE token_hash = ? AND is_active = 1")
      .get(hash) as Agent | undefined;

    if (row) {
      tokenCache.set(hash, row);
    }

    return row ?? null;
  }

  revokeById(id: string, adminName?: string): boolean {
    const agent = this.db
      .prepare("SELECT name FROM agents WHERE id = ?")
      .get(id) as { name: string } | undefined;

    if (!agent) return false;

    const now = new Date().toISOString();
    const result = this.db
      .prepare("UPDATE agents SET is_active = 0, updated_at = ? WHERE id = ?")
      .run(now, id);

    clearTokenCache();

    if (result.changes > 0) {
      this.activity.log({
        action: "agent_revoked",
        entity_type: "agent",
        entity_id: id,
        summary: `Agent "${agent.name}" revoked`,
        agent_name: adminName,
      });
      return true;
    }

    return false;
  }

  reactivate(
    id: string,
    adminName?: string,
  ): { plaintextToken: string } | null {
    const agent = this.db
      .prepare("SELECT name, is_active FROM agents WHERE id = ?")
      .get(id) as { name: string; is_active: number } | undefined;

    if (!agent || agent.is_active === 1) return null;

    const now = new Date().toISOString();
    const plaintextToken = generateToken();
    const token_hash = hashToken(plaintextToken);

    this.db
      .prepare(
        "UPDATE agents SET is_active = 1, token_hash = ?, updated_at = ? WHERE id = ?",
      )
      .run(token_hash, now, id);

    clearTokenCache();

    this.activity.log({
      action: "agent_reactivated",
      entity_type: "agent",
      entity_id: id,
      summary: `Agent "${agent.name}" reactivated with new token`,
      agent_name: adminName,
    });

    return { plaintextToken };
  }

  rename(id: string, newName: string, adminName?: string): boolean {
    const agent = this.db
      .prepare("SELECT name FROM agents WHERE id = ?")
      .get(id) as { name: string } | undefined;

    if (!agent) return false;

    const now = new Date().toISOString();
    const result = this.db
      .prepare("UPDATE agents SET name = ?, updated_at = ? WHERE id = ?")
      .run(newName, now, id);

    clearTokenCache();

    if (result.changes > 0) {
      this.activity.log({
        action: "agent_renamed",
        entity_type: "agent",
        entity_id: id,
        summary: `Agent "${agent.name}" renamed to "${newName}"`,
        agent_name: adminName,
      });
      return true;
    }

    return false;
  }

  resetToken(
    id: string,
    adminName?: string,
  ): { plaintextToken: string } | null {
    const agent = this.db
      .prepare("SELECT name, is_active FROM agents WHERE id = ?")
      .get(id) as { name: string; is_active: number } | undefined;

    if (!agent || agent.is_active !== 1) return null;

    const now = new Date().toISOString();
    const plaintextToken = generateToken();
    const token_hash = hashToken(plaintextToken);

    this.db
      .prepare("UPDATE agents SET token_hash = ?, updated_at = ? WHERE id = ?")
      .run(token_hash, now, id);

    clearTokenCache();

    this.activity.log({
      action: "agent_token_reset",
      entity_type: "agent",
      entity_id: id,
      summary: `Token reset for agent "${agent.name}"`,
      agent_name: adminName,
    });

    return { plaintextToken };
  }

  updatePresence(
    name: string,
    fields: { role?: string; capabilities?: string; working_on?: string },
  ): boolean {
    const now = new Date().toISOString();
    const sets: string[] = ["last_seen_at = ?", "updated_at = ?"];
    const bindings: unknown[] = [now, now];

    if (fields.role !== undefined) {
      sets.push("role = ?");
      bindings.push(fields.role);
    }
    if (fields.capabilities !== undefined) {
      sets.push("capabilities = ?");
      bindings.push(fields.capabilities);
    }
    if (fields.working_on !== undefined) {
      sets.push("working_on = ?");
      bindings.push(fields.working_on);
    }

    bindings.push(name);

    const result = this.db
      .prepare(
        `UPDATE agents SET ${sets.join(", ")} WHERE name = ? COLLATE NOCASE`,
      )
      .run(...bindings);

    if (result.changes > 0) {
      clearTokenCache();
      return true;
    }

    return false;
  }
}

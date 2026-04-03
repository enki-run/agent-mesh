import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { readFileSync, readdirSync } from "fs";
import { AgentService, hashToken } from "../../src/services/agent";
import { ActivityService } from "../../src/services/activity";

function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  const migrationFiles = readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort();
  for (const file of migrationFiles) {
    db.exec(readFileSync(`migrations/${file}`, "utf-8"));
  }
  return db;
}

describe("AgentService", () => {
  let db: Database.Database;
  let activity: ActivityService;
  let agents: AgentService;

  beforeEach(() => {
    db = createTestDb();
    activity = new ActivityService(db);
    agents = new AgentService(db, activity);
  });

  it("creates agent with token", () => {
    const result = agents.create("agent-a");
    expect(result.agent.name).toBe("agent-a");
    expect(result.plaintextToken).toMatch(/^bt_/);
    expect(result.plaintextToken.length).toBeGreaterThanOrEqual(35);
  });

  it("rejects duplicate names case-insensitively", () => {
    agents.create("Agent-A");
    expect(() => agents.create("agent-a")).toThrow();
  });

  it("finds agent by token hash", () => {
    const { plaintextToken } = agents.create("agent-a");
    const hash = hashToken(plaintextToken);
    const found = agents.getByTokenHash(hash);
    expect(found?.name).toBe("agent-a");
  });

  it("deactivated agent not found by token", () => {
    const { agent, plaintextToken } = agents.create("agent-a");
    agents.revokeById(agent.id);
    const found = agents.getByTokenHash(hashToken(plaintextToken));
    expect(found).toBeNull();
  });

  it("finds agent by name case-insensitively", () => {
    agents.create("Agent-A");
    const found = agents.getByName("agent-a");
    expect(found?.name).toBe("Agent-A");
  });

  it("updates presence", () => {
    const { agent } = agents.create("agent-a");
    agents.updatePresence(agent.name, {
      role: "developer",
      working_on: "feature X",
    });
    const list = agents.list();
    expect(list[0].role).toBe("developer");
    expect(list[0].working_on).toBe("feature X");
    expect(list[0].last_seen_at).toBeTruthy();
  });

  it("reactivates with new token", () => {
    const { agent } = agents.create("agent-a");
    agents.revokeById(agent.id);
    const result = agents.reactivate(agent.id);
    expect(result).not.toBeNull();
    expect(result!.plaintextToken).toMatch(/^bt_/);
    const found = agents.getByTokenHash(hashToken(result!.plaintextToken));
    expect(found?.is_active).toBe(1);
  });

  it("resets token", () => {
    const { agent, plaintextToken: oldToken } = agents.create("agent-a");
    const result = agents.resetToken(agent.id);
    expect(result).not.toBeNull();
    expect(agents.getByTokenHash(hashToken(oldToken))).toBeNull();
    expect(
      agents.getByTokenHash(hashToken(result!.plaintextToken))?.name,
    ).toBe("agent-a");
  });

  it("renames agent", () => {
    const { agent } = agents.create("agent-a");
    const renamed = agents.rename(agent.id, "agent-b");
    expect(renamed).toBe(true);
    const found = agents.getByName("agent-b");
    expect(found?.name).toBe("agent-b");
    expect(agents.getByName("agent-a")).toBeNull();
  });

  it("lists agents without token_hash", () => {
    agents.create("agent-b");
    agents.create("agent-a");
    const list = agents.list();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("agent-a");
    expect(list[1].name).toBe("agent-b");
    expect((list[0] as any).token_hash).toBeUndefined();
  });
});

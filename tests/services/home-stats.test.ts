import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { initDatabase } from "../../src/services/db";
import { AgentService } from "../../src/services/agent";
import { ActivityService } from "../../src/services/activity";
import { createMessage, persistMessage } from "../../src/services/message";
import { getHomeStats } from "../../src/services/home-stats";

function createTestDb(): Database.Database {
  return initDatabase(":memory:");
}

describe("getHomeStats", () => {
  let db: Database.Database;
  let activity: ActivityService;
  let agents: AgentService;

  beforeEach(() => {
    db = createTestDb();
    activity = new ActivityService(db);
    agents = new AgentService(db, activity);
  });

  it("returns zeros when the DB is empty", () => {
    const stats = getHomeStats(db);
    expect(stats).toEqual({
      totalAgents: 0,
      onlineAgents: 0,
      recentMessages: 0,
    });
  });

  it("counts total agents regardless of is_active", () => {
    agents.create("a");
    const b = agents.create("b");
    agents.revokeById(b.agent.id); // deactivate b
    agents.create("c");

    const stats = getHomeStats(db);
    expect(stats.totalAgents).toBe(3);
  });

  it("counts online agents as: is_active AND last_seen_at within 10 minutes", () => {
    const a = agents.create("a");
    const b = agents.create("b");
    agents.create("c"); // never seen

    // Simulate last_seen_at updates by directly touching the DB
    const now = new Date();
    const recentIso = now.toISOString();
    const oldIso = new Date(now.getTime() - 20 * 60 * 1000).toISOString(); // 20 min ago

    db.prepare("UPDATE agents SET last_seen_at = ? WHERE id = ?").run(recentIso, a.agent.id);
    db.prepare("UPDATE agents SET last_seen_at = ? WHERE id = ?").run(oldIso, b.agent.id);

    const stats = getHomeStats(db);
    expect(stats.onlineAgents).toBe(1); // only a
  });

  it("counts recentMessages within the last 24h", () => {
    // 2 recent messages
    for (let i = 0; i < 2; i++) {
      const m = createMessage({
        from: "alpha",
        to: "beta",
        type: "info",
        payload: `p${i}`,
        context: "t",
      });
      persistMessage(db, m);
    }
    // 1 old message (> 24h ago)
    const old = createMessage({
      from: "alpha",
      to: "beta",
      type: "info",
      payload: "old",
      context: "t",
    });
    old.created_at = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    persistMessage(db, old);

    const stats = getHomeStats(db);
    expect(stats.recentMessages).toBe(2);
  });
});

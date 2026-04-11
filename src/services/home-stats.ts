import type Database from "better-sqlite3";

/**
 * Aggregate counts for the dashboard home page. Extracted from
 * `src/index.tsx` to remove duplication between the HTML (`/`) and JSON
 * (`/api/home`) routes — both render the same three numbers and were
 * running the identical SQL triplet inline.
 */

export interface HomeStats {
  /** Total agents ever registered (active + revoked). */
  totalAgents: number;
  /** Agents currently active with a `last_seen_at` within the last 10 minutes. */
  onlineAgents: number;
  /** Messages created within the last 24 hours. */
  recentMessages: number;
}

export function getHomeStats(db: Database.Database): HomeStats {
  const totalAgentsRow = db
    .prepare("SELECT COUNT(*) as count FROM agents")
    .get() as { count: number };

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const onlineAgentsRow = db
    .prepare(
      "SELECT COUNT(*) as count FROM agents WHERE is_active = 1 AND last_seen_at > ?",
    )
    .get(tenMinAgo) as { count: number };

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recentMessagesRow = db
    .prepare("SELECT COUNT(*) as count FROM messages WHERE created_at > ?")
    .get(dayAgo) as { count: number };

  return {
    totalAgents: totalAgentsRow.count,
    onlineAgents: onlineAgentsRow.count,
    recentMessages: recentMessagesRow.count,
  };
}

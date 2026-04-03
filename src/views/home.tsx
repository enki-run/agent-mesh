import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { Activity } from "../types.js";

interface HomeStats {
  totalAgents: number;
  onlineAgents: number;
  recentMessages: number;
}

interface HomeProps {
  stats: HomeStats;
  activities: Activity[];
  userRole?: string;
  csrfToken?: string;
  agentAvatars?: Record<string, string>;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avatarUrl(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return `/avatars/${avatarId}.png`;
}

export const HomePage: FC<HomeProps> = ({ stats, activities, userRole, csrfToken, agentAvatars }) => {
  return (
    <Layout title="Dashboard" activePath="/" userRole={userRole} csrfToken={csrfToken}>
      <h1 style="font-size: 1.38rem; margin-bottom: 1.23rem;">Dashboard</h1>

      {/* Stats boxes */}
      <div style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
        <div class="stat-box">
          <div class="stat-value">{stats.totalAgents}</div>
          <div class="stat-label">Agents gesamt</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">{stats.onlineAgents}</div>
          <div class="stat-label">Online (5 min)</div>
        </div>
        <div class="stat-box">
          <div class="stat-value">{stats.recentMessages}</div>
          <div class="stat-label">Messages (24h)</div>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <h2>Letzte Aktivitäten</h2>
        {activities.length === 0 ? (
          <p class="empty">Noch keine Aktivitäten.</p>
        ) : (
          <ul class="activity-list">
            {activities.map((a) => (
              <li>
                <time>{fmtDate(a.created_at)}</time>
                <span style="display: inline-flex; align-items: center; gap: 0.23rem; font-size: 0.69rem; color: var(--color-ghost); margin-right: 0.31rem;">
                  {a.agent_name && avatarUrl(agentAvatars?.[a.agent_name]) && (
                    <img src={avatarUrl(agentAvatars?.[a.agent_name])!} style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;" />
                  )}
                  {a.agent_name ?? "System"}
                </span>
                {a.summary ?? a.action}
              </li>
            ))}
          </ul>
        )}
        {activities.length > 0 && (
          <div style="margin-top: 0.77rem;">
            <a href="/activity" style="font-size: 0.85rem; color: var(--color-subtle);">
              Alle Aktivitäten anzeigen →
            </a>
          </div>
        )}
      </div>
    </Layout>
  );
};

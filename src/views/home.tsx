import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { Activity, Agent } from "../types.js";

interface HomeStats {
  totalAgents: number;
  onlineAgents: number;
  recentMessages: number;
}

interface HomeProps {
  stats: HomeStats;
  activities: Activity[];
  agents?: Omit<Agent, "token_hash">[];
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

function relativeTime(iso: string | null): string {
  if (!iso) return "\u2014";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? "en" : ""}`;
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

export const HomePage: FC<HomeProps> = ({ stats, activities, agents, userRole, csrfToken, agentAvatars }) => {
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

      {/* Agent cards */}
      {agents && agents.length > 0 && (
        <div style="margin-bottom: 2rem;">
          <h2>Agents</h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.77rem;">
            {agents.map((a) => {
              const online = isOnline(a.last_seen_at);
              return (
                <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.46rem; padding: 0.77rem; display: flex; gap: 0.62rem; align-items: flex-start;">
                  <div style="flex-shrink: 0;">
                    {a.avatar ? (
                      <img src={avatarUrl(a.avatar)!} style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;" />
                    ) : (
                      <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--color-border);" />
                    )}
                  </div>
                  <div style="min-width: 0; flex: 1;">
                    <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                      {a.name}
                    </div>
                    {a.role && (
                      <div style="font-size: 0.69rem; color: var(--color-subtle); margin-top: 0.1rem;">
                        {a.role}
                      </div>
                    )}
                    <div style="margin-top: 0.31rem;">
                      {online ? (
                        <span style="font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600; padding: 1px 6px; border-radius: 3px; background: #e8f0e8; color: #4a7a4a;">Online</span>
                      ) : (
                        <span style="font-family: var(--font-mono); font-size: 0.62rem; font-weight: 600; padding: 1px 6px; border-radius: 3px; background: #ececec; color: #888;">Offline</span>
                      )}
                    </div>
                    {a.working_on && (
                      <div style="font-size: 0.69rem; color: var(--color-muted); margin-top: 0.31rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        {a.working_on}
                      </div>
                    )}
                    <div style="font-family: var(--font-mono); font-size: 0.62rem; color: var(--color-light); margin-top: 0.23rem;">
                      {relativeTime(a.last_seen_at)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

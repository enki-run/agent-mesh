import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { Activity, PaginatedResult } from "../types.js";

interface ActivityPageProps {
  result: PaginatedResult<Activity>;
  userRole?: string;
  csrfToken?: string;
}

const ACTION_ICONS: Record<string, string> = {
  agent_created: "●",
  agent_revoked: "○",
  agent_reactivated: "◉",
  agent_renamed: "◐",
  agent_token_reset: "◑",
  message_sent: "→",
  message_received: "←",
  login_success: "▷",
  login_failure: "▸",
  logout: "◁",
};

const ACTION_COLOR: Record<string, string> = {
  agent_created: "var(--color-status-active-text)",
  agent_reactivated: "var(--color-status-active-text)",
  agent_revoked: "#904040",
  login_failure: "#904040",
};

export const ActivityPage: FC<ActivityPageProps> = ({ result, userRole, csrfToken }) => {
  const { data: activities, total, has_more, offset, limit } = result;

  // Group by date
  const grouped: Record<string, Activity[]> = {};
  for (const a of activities) {
    const date = new Date(a.created_at).toLocaleDateString("de-DE", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(a);
  }

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <Layout title="Aktivitätslog" activePath="/activity" userRole={userRole} csrfToken={csrfToken}>
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.23rem; flex-wrap: wrap;">
        <h1 style="font-size: 1.38rem;">Aktivitätslog</h1>
        <span style="font-family: var(--font-mono); font-size: 0.77rem; color: var(--color-subtle);">{total} gesamt</span>
      </div>

      {activities.length === 0 ? (
        <p class="empty">Keine Aktivitäten.</p>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div style="margin-bottom: 1.85rem;">
            <div style="font-family: var(--font-mono); font-size: 0.77rem; font-weight: 600; color: var(--color-subtle); text-transform: uppercase; letter-spacing: 0.06em; padding-bottom: 0.46rem; border-bottom: 1px solid var(--color-divider); margin-bottom: 0.62rem;">
              {date}
            </div>
            {items.map((a) => (
              <div style="display: flex; gap: 0.77rem; padding: 0.46rem 0; align-items: flex-start;">
                <span style={`font-family: var(--font-mono); font-size: 0.85rem; color: ${ACTION_COLOR[a.action] || "var(--color-ghost)"}; min-width: 1.2rem; text-align: center; line-height: 1.6;`}>
                  {ACTION_ICONS[a.action] || "·"}
                </span>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 0.92rem; color: var(--color-body);">
                    {a.summary ?? a.action}
                  </div>
                  <div style="font-family: var(--font-mono); font-size: 0.69rem; color: var(--color-light); margin-top: 0.15rem;">
                    <span style="color: var(--color-subtle);">{a.agent_name ?? "System"}</span>
                    <span style="margin: 0 0.31rem;">·</span>
                    {new Date(a.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                    <span style="margin-left: 0.62rem; color: var(--color-ghost);">{a.entity_type}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Pagination */}
      {(offset > 0 || has_more) && (
        <div class="pagination">
          {offset > 0 ? (
            <a href={`/activity?offset=${prevOffset}`}>&#8592; Neuere</a>
          ) : (
            <span style="color: var(--color-ghost);">&#8592; Neuere</span>
          )}
          <span class="current">{offset + 1}–{Math.min(offset + limit, total)} von {total}</span>
          {has_more ? (
            <a href={`/activity?offset=${nextOffset}`}>Ältere &#8594;</a>
          ) : (
            <span style="color: var(--color-ghost);">Ältere &#8594;</span>
          )}
        </div>
      )}
    </Layout>
  );
};

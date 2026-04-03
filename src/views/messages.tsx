import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { Message, PaginatedResult } from "../types.js";

interface MessagesPageProps {
  result: PaginatedResult<Message>;
  userRole?: string;
  csrfToken?: string;
  filterAgent?: string;
  agentAvatars?: Record<string, string>; // name -> avatar ID
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

function avatarUrl(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return `/avatars/${avatarId}.png`;
}

function priorityBadgeClass(priority: string): string {
  if (priority === "high") return "badge badge-high";
  if (priority === "low") return "badge badge-low";
  return "badge badge-normal";
}

export const MessagesPage: FC<MessagesPageProps> = ({ result, userRole, csrfToken, filterAgent, agentAvatars }) => {
  const { data: messages, total, has_more, offset, limit } = result;

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  // Build filter URL helper
  function pageUrl(off: number): string {
    const params = new URLSearchParams();
    if (filterAgent) params.set("agent", filterAgent);
    params.set("offset", String(off));
    return `/messages?${params.toString()}`;
  }

  return (
    <Layout title="Messages" activePath="/messages" userRole={userRole} csrfToken={csrfToken}>
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.23rem; flex-wrap: wrap;">
        <h1 style="font-size: 1.38rem;">Messages</h1>
        <span style="font-family: var(--font-mono); font-size: 0.77rem; color: var(--color-subtle);">
          {total} gesamt
        </span>
      </div>

      {/* Filter bar */}
      <form method="get" action="/messages" class="filter-bar">
        <input
          type="text"
          name="agent"
          placeholder="Nach Agent filtern..."
          value={filterAgent ?? ""}
          style="font-family: var(--font-mono); font-size: 0.85rem; min-width: 200px;"
        />
        <button
          type="submit"
          style="font-family: var(--font-mono); font-size: 0.77rem; padding: 0.31rem 0.77rem; background: none; border: 1px solid var(--color-border); border-radius: 0.46rem; color: var(--color-body); cursor: pointer;"
        >
          Filtern
        </button>
        {filterAgent && (
          <a
            href="/messages"
            style="font-family: var(--font-mono); font-size: 0.77rem; padding: 0.31rem 0.77rem; border: 1px solid var(--color-border); border-radius: 0.46rem; color: var(--color-subtle);"
          >
            Filter entfernen
          </a>
        )}
      </form>

      {messages.length === 0 ? (
        <p class="empty">Keine Nachrichten gefunden.</p>
      ) : (
        <div class="table-wrapper">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--color-divider); text-align: left;">
                <th style="padding: 0.46rem 0.62rem;">Von</th>
                <th style="padding: 0.46rem 0.62rem;">An</th>
                <th style="padding: 0.46rem 0.62rem;">Typ</th>
                <th style="padding: 0.46rem 0.62rem;">Kontext</th>
                <th style="padding: 0.46rem 0.62rem;">Priorität</th>
                <th style="padding: 0.46rem 0.62rem;">Erstellt am</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr style="border-bottom: 1px solid var(--color-divider);">
                  <td style="padding: 0.46rem 0.62rem; font-family: var(--font-mono); font-size: 0.77rem; font-weight: 600;">
                    <span style="display: inline-flex; align-items: center; gap: 0.31rem;">
                      {avatarUrl(agentAvatars?.[m.from]) && (
                        <img src={avatarUrl(agentAvatars?.[m.from])!} style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; vertical-align: middle;" />
                      )}
                      {m.from}
                    </span>
                  </td>
                  <td style="padding: 0.46rem 0.62rem; font-family: var(--font-mono); font-size: 0.77rem; color: var(--color-muted);">
                    <span style="display: inline-flex; align-items: center; gap: 0.31rem;">
                      {avatarUrl(agentAvatars?.[m.to]) && (
                        <img src={avatarUrl(agentAvatars?.[m.to])!} style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; vertical-align: middle;" />
                      )}
                      {m.to}
                    </span>
                  </td>
                  <td style="padding: 0.46rem 0.62rem; font-family: var(--font-mono); font-size: 0.77rem;">
                    {m.type}
                  </td>
                  <td style="padding: 0.46rem 0.62rem; color: var(--color-muted); max-width: 300px;">
                    {truncate(m.context, 80)}
                  </td>
                  <td style="padding: 0.46rem 0.62rem;">
                    <span class={priorityBadgeClass(m.priority)}>{m.priority}</span>
                  </td>
                  <td style="padding: 0.46rem 0.62rem; font-family: var(--font-mono); font-size: 0.77rem; color: var(--color-light); white-space: nowrap;">
                    {fmtDate(m.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {(offset > 0 || has_more) && (
        <div class="pagination">
          {offset > 0 ? (
            <a href={pageUrl(prevOffset)}>&#8592; Neuere</a>
          ) : (
            <span style="color: var(--color-ghost);">&#8592; Neuere</span>
          )}
          <span class="current">
            {offset + 1}–{Math.min(offset + limit, total)} von {total}
          </span>
          {has_more ? (
            <a href={pageUrl(nextOffset)}>Ältere &#8594;</a>
          ) : (
            <span style="color: var(--color-ghost);">Ältere &#8594;</span>
          )}
        </div>
      )}
    </Layout>
  );
};

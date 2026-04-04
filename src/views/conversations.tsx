import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { MessagePriority, PaginatedResult } from "../types.js";

// --- Types (mirroring index.tsx ConversationThread) ---
interface ThreadMessage {
  id: string;
  from: string;
  to: string;
  type: string;
  payload: string;
  context: string;
  correlation_id: string | null;
  reply_to: string | null;
  priority: MessagePriority;
  ttl_seconds: number;
  created_at: string;
}

interface ConversationThread {
  thread_id: string;
  started_at: string;
  last_activity: string;
  message_count: number;
  first_payload: string;
  first_context: string | null;
  participants: string[];
  messages: ThreadMessage[];
}

interface ConversationsPageProps {
  result: PaginatedResult<ConversationThread>;
  userRole?: string;
  csrfToken?: string;
  agentAvatars?: Record<string, string>;
}

// --- Helpers ---

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "\u2026";
}

function avatarUrl(avatarId: string | null | undefined): string | null {
  if (!avatarId) return null;
  return `/avatars/${avatarId}.png`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "gerade eben";
  if (mins < 60) return `vor ${mins} Min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tag${days > 1 ? "en" : ""}`;
}

// --- Component ---

export const ConversationsPage: FC<ConversationsPageProps> = ({
  result,
  userRole,
  csrfToken,
  agentAvatars,
}) => {
  const { data: threads, total, has_more, offset, limit } = result;

  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  function pageUrl(off: number): string {
    const params = new URLSearchParams();
    params.set("offset", String(off));
    return `/conversations?${params.toString()}`;
  }

  return (
    <Layout title="Conversations" activePath="/conversations" userRole={userRole} csrfToken={csrfToken}>
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.23rem; flex-wrap: wrap;">
        <h1 style="font-size: 1.38rem;">Conversations</h1>
        <span style="font-family: var(--font-mono); font-size: 0.77rem; color: var(--color-subtle);">
          {total} Threads
        </span>
      </div>

      {threads.length === 0 ? (
        <p class="empty">Keine Konversationen gefunden.</p>
      ) : (
        <div style="display: flex; flex-direction: column; gap: 0.62rem;">
          {threads.map((thread) => {
            const leftAgent = thread.messages[0]?.from ?? thread.participants[0] ?? "?";

            return (
              <details
                style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.46rem; overflow: hidden;"
              >
                <summary
                  style="padding: 0.77rem 1rem; cursor: pointer; display: flex; align-items: center; gap: 0.62rem; flex-wrap: wrap; list-style: none; user-select: none;"
                >
                  {/* Expand indicator */}
                  <span style="font-size: 0.69rem; color: var(--color-subtle); flex-shrink: 0; transition: transform 0.12s;">&#9654;</span>
                  {/* Participant avatars */}
                  <div style="display: flex; flex-shrink: 0;">
                    {thread.participants.map((name, i) => {
                      const avId = agentAvatars?.[name];
                      const avSrc = avatarUrl(avId);
                      return avSrc ? (
                        <img
                          src={avSrc}
                          alt=""
                          title={name}
                          style={`width: 28px; height: 28px; border-radius: 50%; object-fit: cover; border: 2px solid var(--color-surface);${i > 0 ? " margin-left: -8px;" : ""}`}
                        />
                      ) : (
                        <div
                          title={name}
                          style={`width: 28px; height: 28px; border-radius: 50%; background: var(--color-border); border: 2px solid var(--color-surface);${i > 0 ? " margin-left: -8px;" : ""}`}
                        />
                      );
                    })}
                  </div>

                  {/* Participant names */}
                  <span style="font-family: var(--font-mono); font-size: 0.77rem; font-weight: 600; color: var(--color-ink);">
                    {thread.participants.join(" \u2194 ")}
                  </span>

                  {/* Thread title (first payload truncated) */}
                  <span style="color: var(--color-muted); font-size: 0.85rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    {truncate(thread.first_payload, 100)}
                  </span>

                  {/* Message count badge */}
                  <span class="badge badge-normal" style="flex-shrink: 0;">
                    {thread.message_count} {thread.message_count === 1 ? "Msg" : "Msgs"}
                  </span>

                  {/* Last activity */}
                  <span style="font-family: var(--font-mono); font-size: 0.69rem; color: var(--color-light); flex-shrink: 0; white-space: nowrap;">
                    {relativeTime(thread.last_activity)}
                  </span>
                </summary>

                {/* Chat messages */}
                <div style="padding: 0.62rem 1rem 1rem; border-top: 1px solid var(--color-divider); display: flex; flex-direction: column; gap: 0.46rem;">
                  {thread.messages.map((msg) => {
                    const isLeft = msg.from === leftAgent;
                    const avId = agentAvatars?.[msg.from];
                    const avSrc = avatarUrl(avId);

                    return (
                      <div
                        style={`display: flex; flex-direction: column; align-items: ${isLeft ? "flex-start" : "flex-end"}; max-width: 80%;${isLeft ? "" : " align-self: flex-end;"}`}
                      >
                        {/* Name + time header */}
                        <div style="display: flex; align-items: center; gap: 0.31rem; margin-bottom: 0.15rem;">
                          {avSrc && (
                            <img
                              src={avSrc}
                              alt=""
                              style="width: 18px; height: 18px; border-radius: 50%; object-fit: cover;"
                            />
                          )}
                          <span style="font-family: var(--font-mono); font-size: 0.69rem; font-weight: 600; color: var(--color-ink);">
                            {msg.from}
                          </span>
                          <span style="font-family: var(--font-mono); font-size: 0.62rem; color: var(--color-light);">
                            {fmtTime(msg.created_at)}
                          </span>
                        </div>

                        {/* Message bubble */}
                        <div
                          style={`padding: 0.46rem 0.77rem; border-radius: 0.46rem; font-size: 0.85rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word; background: ${isLeft ? "var(--color-surface)" : "var(--color-ghost)"}; color: var(--color-body);`}
                        >
                          {msg.payload}
                        </div>

                        {/* Context (if present) */}
                        {msg.context && (
                          <div style="font-size: 0.69rem; color: var(--color-light); margin-top: 0.15rem; font-style: italic;">
                            {truncate(msg.context, 120)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Thread metadata footer */}
                  <div style="font-family: var(--font-mono); font-size: 0.62rem; color: var(--color-light); margin-top: 0.31rem; padding-top: 0.31rem; border-top: 1px solid var(--color-divider);">
                    Thread gestartet {fmtDate(thread.started_at)}
                  </div>
                </div>
              </details>
            );
          })}
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

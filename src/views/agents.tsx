import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { Agent } from "../types.js";

interface AgentsPageProps {
  agents: Omit<Agent, "token_hash">[];
  csrfToken: string;
  newToken?: string;
  error?: string;
  userRole?: string;
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

export const AgentsPage: FC<AgentsPageProps> = ({ agents, csrfToken, newToken, error, userRole }) => {
  return (
    <Layout title="Agent-Verwaltung" activePath="/agents" userRole={userRole} csrfToken={csrfToken}>
      <h1 style="font-size: 1.38rem; margin-bottom: 1.23rem;">Agent-Verwaltung</h1>

      {/* Error message */}
      {error && (
        <div style="padding: 0.77rem 1rem; background: #f5e4e4; border: 1px solid #c08080; border-radius: 0.46rem; margin-bottom: 1.23rem; font-size: 0.85rem; color: #7a2a2a;">
          {error}
        </div>
      )}

      {/* Token display after creation / reset */}
      {newToken && (
        <div style="padding: 1rem; background: var(--color-surface); border: 2px solid #4a7a4a; border-radius: 0.46rem; margin-bottom: 1.23rem;">
          <div style="font-weight: 600; font-size: 0.92rem; color: #4a7a4a; margin-bottom: 0.46rem;">
            Neuer Token erstellt
          </div>
          <code style="font-family: var(--font-mono); font-size: 0.85rem; background: var(--color-bg); padding: 0.31rem 0.62rem; border-radius: 3px; border: 1px solid var(--color-border); display: inline-block; word-break: break-all;">
            {newToken}
          </code>
          <div style="font-size: 0.77rem; color: #904040; margin-top: 0.46rem; font-weight: 600;">
            Token wird nur einmal angezeigt!
          </div>
        </div>
      )}

      {/* Create agent form */}
      <div style="padding: 1rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.46rem; margin-bottom: 1.85rem;">
        <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-subtle); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.62rem;">
          Neuer Agent
        </div>
        <form method="post" action="/agents/create" style="display: flex; gap: 0.62rem; align-items: center; flex-wrap: wrap;">
          <input type="hidden" name="csrf" value={csrfToken} />
          <input
            type="text"
            name="name"
            placeholder="Agent-Name"
            required
            style="font-family: var(--font-mono); font-size: 0.85rem; padding: 0.38rem 0.62rem; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-page); color: var(--color-body); min-width: 180px;"
          />
          <button
            type="submit"
            style="font-family: var(--font-mono); font-size: 0.77rem; padding: 0.38rem 1rem; background: #4a7a4a; color: #fff; border: none; border-radius: 3px; cursor: pointer;"
          >
            Erstellen
          </button>
        </form>
      </div>

      {/* Agent list */}
      {agents.length === 0 ? (
        <p class="empty">Keine Agents vorhanden.</p>
      ) : (
        <div class="table-wrapper">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid var(--color-divider); text-align: left;">
                <th style="padding: 0.46rem 0.62rem;">Name</th>
                <th style="padding: 0.46rem 0.62rem;">Status</th>
                <th style="padding: 0.46rem 0.62rem;">Zuletzt gesehen</th>
                <th style="padding: 0.46rem 0.62rem;">Erstellt am</th>
                <th style="padding: 0.46rem 0.62rem; text-align: right;">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr style="border-bottom: 1px solid var(--color-divider);">
                  <td style="padding: 0.46rem 0.62rem; font-weight: 500;">
                    <form method="post" action="/agents/rename" style="display: flex; gap: 0.31rem; align-items: center;">
                      <input type="hidden" name="csrf" value={csrfToken} />
                      <input type="hidden" name="id" value={a.id} />
                      <input
                        type="text"
                        name="name"
                        value={a.name}
                        required
                        style="font-family: var(--font-mono); font-size: 0.85rem; padding: 2px 6px; border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--color-body); width: 140px;"
                        onfocus="this.style.borderColor='var(--color-border)';this.style.background='var(--color-page)'"
                        onblur="this.style.borderColor='transparent';this.style.background='transparent'"
                      />
                      <button
                        type="submit"
                        style="font-family: var(--font-mono); font-size: 0.62rem; padding: 1px 5px; background: none; border: 1px solid var(--color-border); color: var(--color-subtle); border-radius: 3px; cursor: pointer; opacity: 0.6;"
                        title="Umbenennen"
                      >
                        &#x270E;
                      </button>
                    </form>
                  </td>
                  <td style="padding: 0.46rem 0.62rem;">
                    {a.is_active ? (
                      <span class="badge badge-active-status">Aktiv</span>
                    ) : (
                      <span class="badge badge-inactive-status">Deaktiviert</span>
                    )}
                  </td>
                  <td style="padding: 0.46rem 0.62rem; font-family: var(--font-mono); font-size: 0.77rem; color: var(--color-light);">
                    {a.last_seen_at ? fmtDate(a.last_seen_at) : "—"}
                  </td>
                  <td style="padding: 0.46rem 0.62rem; font-family: var(--font-mono); font-size: 0.77rem; color: var(--color-light);">
                    {fmtDate(a.created_at)}
                  </td>
                  <td style="padding: 0.46rem 0.62rem; text-align: right;">
                    <div style="display: flex; gap: 0.31rem; justify-content: flex-end; flex-wrap: wrap;">
                      {a.is_active ? (
                        <>
                          <form method="post" action="/agents/reset-token" style="display: inline;">
                            <input type="hidden" name="csrf" value={csrfToken} />
                            <input type="hidden" name="id" value={a.id} />
                            <button
                              type="submit"
                              style="font-family: var(--font-mono); font-size: 0.69rem; padding: 2px 8px; background: none; border: 1px solid var(--color-border); color: var(--color-body); border-radius: 3px; cursor: pointer;"
                            >
                              Token Reset
                            </button>
                          </form>
                          <form method="post" action="/agents/revoke" style="display: inline;">
                            <input type="hidden" name="csrf" value={csrfToken} />
                            <input type="hidden" name="id" value={a.id} />
                            <button
                              type="submit"
                              style="font-family: var(--font-mono); font-size: 0.69rem; padding: 2px 8px; background: none; border: 1px solid #c08080; color: #904040; border-radius: 3px; cursor: pointer;"
                            >
                              Deaktivieren
                            </button>
                          </form>
                        </>
                      ) : (
                        <form method="post" action="/agents/reactivate" style="display: inline;">
                          <input type="hidden" name="csrf" value={csrfToken} />
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            type="submit"
                            style="font-family: var(--font-mono); font-size: 0.69rem; padding: 2px 8px; background: none; border: 1px solid #4a7a4a; color: #4a7a4a; border-radius: 3px; cursor: pointer;"
                          >
                            Reaktivieren
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
};

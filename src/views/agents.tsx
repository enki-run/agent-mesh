import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { Agent } from "../types.js";

const AVATAR_IDS = Array.from({ length: 24 }, (_, i) => `avatar-${String(i + 1).padStart(2, "0")}`);

function avatarUrl(avatarId: string | null): string | null {
  if (!avatarId) return null;
  return `/avatars/${avatarId}.png`;
}

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

      {error && (
        <div style="padding: 0.77rem 1rem; background: #f5e4e4; border: 1px solid #c08080; border-radius: 0.46rem; margin-bottom: 1.23rem; font-size: 0.85rem; color: #7a2a2a;">
          {error}
        </div>
      )}

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

          <div style="margin-top: 1rem; font-size: 0.77rem; color: var(--color-subtle); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">
            Einrichtung
          </div>

          <div style="margin-top: 0.46rem;">
            <div style="font-size: 0.77rem; font-weight: 600; margin-bottom: 0.23rem;">Claude Code / Gemini CLI</div>
            <pre style="font-family: var(--font-mono); font-size: 0.69rem; background: var(--color-bg); padding: 0.62rem; border-radius: 3px; border: 1px solid var(--color-border); overflow-x: auto; white-space: pre; line-height: 1.5;">{`// ~/.claude/settings.json → mcpServers
"mesh": {
  "type": "streamable-http",
  "url": "https://mesh.enki.run/mcp",
  "headers": {
    "Authorization": "Bearer ${newToken}"
  }
}`}</pre>
          </div>

          <div style="margin-top: 0.62rem;">
            <div style="font-size: 0.77rem; font-weight: 600; margin-bottom: 0.23rem;">Claude Desktop</div>
            <pre style="font-family: var(--font-mono); font-size: 0.69rem; background: var(--color-bg); padding: 0.62rem; border-radius: 3px; border: 1px solid var(--color-border); overflow-x: auto; white-space: pre; line-height: 1.5;">{`// claude_desktop_config.json → mcpServers
"mesh": {
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://mesh.enki.run/mcp"]
}
// OAuth-Flow: Token "${newToken}" im Browser eingeben`}</pre>
          </div>

          <div style="margin-top: 0.62rem;">
            <div style="font-size: 0.77rem; font-weight: 600; margin-bottom: 0.23rem;">mesh-cli</div>
            <pre style="font-family: var(--font-mono); font-size: 0.69rem; background: var(--color-bg); padding: 0.62rem; border-radius: 3px; border: 1px solid var(--color-border); overflow-x: auto; white-space: pre; line-height: 1.5;">{`export MESH_TOKEN="${newToken}"
./mesh-cli status`}</pre>
          </div>
        </div>
      )}

      <div style="padding: 1rem; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.46rem; margin-bottom: 1.85rem;">
        <div style="font-weight: 600; font-size: 0.85rem; color: var(--color-subtle); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.62rem;">
          Neuer Agent
        </div>
        <form method="post" action="/agents/create">
          <input type="hidden" name="csrf" value={csrfToken} />
          <input type="hidden" name="avatar" id="avatar-input" value="" />
          <div style="display: flex; gap: 0.62rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.77rem;">
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
          </div>
          <div style="font-size: 0.77rem; color: var(--color-subtle); margin-bottom: 0.38rem;">Avatar (optional):</div>
          <div style="display: grid; grid-template-columns: repeat(6, 48px); gap: 6px;">
            {AVATAR_IDS.map((id) => (
              <img
                src={`/avatars/${id}.png`}
                data-avatar-id={id}
                class="avatar-option"
                style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; border: 2px solid transparent; cursor: pointer; transition: border-color 0.12s;"
                onclick="document.getElementById('avatar-input').value=this.dataset.avatarId;document.querySelectorAll('.avatar-option').forEach(function(e){e.style.borderColor='transparent'});this.style.borderColor='#4a7a4a'"
              />
            ))}
          </div>
        </form>
      </div>

      {agents.length === 0 ? (
        <p class="empty">Keine Agents vorhanden.</p>
      ) : (
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
                    <div style="position: relative; flex-shrink: 0;">
                      {a.avatar ? (
                        <img
                          src={avatarUrl(a.avatar)!}
                          style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; cursor: pointer;"
                          onclick={`var p=document.getElementById('avatar-picker-${a.id}');p.style.display=p.style.display==='none'?'block':'none'`}
                          title="Avatar ändern"
                        />
                      ) : (
                        <div
                          style="width: 32px; height: 32px; border-radius: 50%; background: var(--color-border); cursor: pointer;"
                          onclick={`var p=document.getElementById('avatar-picker-${a.id}');p.style.display=p.style.display==='none'?'block':'none'`}
                          title="Avatar setzen"
                        />
                      )}
                      <div
                        id={`avatar-picker-${a.id}`}
                        style="display: none; position: absolute; top: 36px; left: 0; z-index: 50; background: var(--color-page); border: 1px solid var(--color-border); border-radius: 0.46rem; padding: 0.46rem; box-shadow: 0 4px 12px rgba(0,0,0,0.12); width: 228px;"
                      >
                        <div style="font-size: 0.62rem; color: var(--color-subtle); margin-bottom: 0.31rem; font-weight: 600;">Avatar wählen</div>
                        <div style="display: grid; grid-template-columns: repeat(6, 32px); gap: 4px;">
                          {AVATAR_IDS.map((avId) => (
                            <form method="post" action="/agents/set-avatar" style="display: inline;">
                              <input type="hidden" name="csrf" value={csrfToken} />
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="avatar" value={avId} />
                              <button
                                type="submit"
                                style="padding: 0; border: none; background: none; cursor: pointer; display: block;"
                              >
                                <img
                                  src={`/avatars/${avId}.png`}
                                  style={`width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid ${a.avatar === avId ? '#4a7a4a' : 'transparent'}; transition: border-color 0.12s;`}
                                />
                              </button>
                            </form>
                          ))}
                        </div>
                      </div>
                    </div>
                    <input type="hidden" name="csrf" value={csrfToken} />
                    <input type="hidden" name="id" value={a.id} />
                    <input
                      type="text"
                      name="name"
                      value={a.name}
                      required
                      style="font-family: var(--font-mono); font-size: 0.85rem; padding: 2px 6px; border: 1px solid var(--color-border); border-radius: 3px; background: var(--color-page); color: var(--color-body); width: 140px;"
                    />
                    <button
                      type="submit"
                      style="font-family: var(--font-mono); font-size: 0.69rem; padding: 2px 8px; background: none; border: 1px solid var(--color-border); color: var(--color-body); border-radius: 3px; cursor: pointer;"
                    >
                      Speichern
                    </button>
                  </form>
                </td>
                <td style="padding: 0.46rem 0.62rem;">
                  {a.is_active ? (
                    <span style="font-family: var(--font-mono); font-size: 0.69rem; font-weight: 600; padding: 2px 8px; border-radius: 3px; background: #e8f0e8; color: #4a7a4a;">Aktiv</span>
                  ) : (
                    <span style="font-family: var(--font-mono); font-size: 0.69rem; font-weight: 600; padding: 2px 8px; border-radius: 3px; background: #f5e4e4; color: #904040;">Deaktiviert</span>
                  )}
                </td>
                <td style="padding: 0.46rem 0.62rem; font-family: var(--font-mono); font-size: 0.77rem; color: var(--color-light);">
                  {a.last_seen_at ? fmtDate(a.last_seen_at) : "\u2014"}
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
                          <button type="submit" style="font-family: var(--font-mono); font-size: 0.69rem; padding: 2px 8px; background: none; border: 1px solid var(--color-border); color: var(--color-body); border-radius: 3px; cursor: pointer;">
                            Token Reset
                          </button>
                        </form>
                        <form method="post" action="/agents/revoke" style="display: inline;">
                          <input type="hidden" name="csrf" value={csrfToken} />
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" style="font-family: var(--font-mono); font-size: 0.69rem; padding: 2px 8px; background: none; border: 1px solid #c08080; color: #904040; border-radius: 3px; cursor: pointer;">
                            Deaktivieren
                          </button>
                        </form>
                      </>
                    ) : (
                      <form method="post" action="/agents/reactivate" style="display: inline;">
                        <input type="hidden" name="csrf" value={csrfToken} />
                        <input type="hidden" name="id" value={a.id} />
                        <button type="submit" style="font-family: var(--font-mono); font-size: 0.69rem; padding: 2px 8px; background: none; border: 1px solid #4a7a4a; color: #4a7a4a; border-radius: 3px; cursor: pointer;">
                          Reaktivieren
                        </button>
                      </form>
                    )}
                    <form method="post" action="/agents/delete" style="display: inline;" onsubmit="return confirm('Agent wirklich löschen? Der Name kann danach wiederverwendet werden.')">
                      <input type="hidden" name="csrf" value={csrfToken} />
                      <input type="hidden" name="id" value={a.id} />
                      <button type="submit" style="font-family: var(--font-mono); font-size: 0.69rem; padding: 2px 8px; background: #904040; border: 1px solid #904040; color: #fff; border-radius: 3px; cursor: pointer;">
                        Löschen
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  );
};

import type { FC } from "hono/jsx";
import { raw } from "hono/html";
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
  return Date.now() - new Date(lastSeen).getTime() < 10 * 60 * 1000;
}

export const HomePage: FC<HomeProps> = ({ stats, activities, agents, userRole, csrfToken, agentAvatars }) => {
  return (
    <Layout title="Dashboard" activePath="/" userRole={userRole} csrfToken={csrfToken}>
      <h1 style="font-size: 1.38rem; margin-bottom: 1.23rem;">Dashboard</h1>

      {/* Stats boxes */}
      <div style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
        <div class="stat-box">
          <div class="stat-value" id="stat-total">{stats.totalAgents}</div>
          <div class="stat-label">Agents gesamt</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" id="stat-online">{stats.onlineAgents}</div>
          <div class="stat-label">Online (10 min)</div>
        </div>
        <div class="stat-box">
          <div class="stat-value" id="stat-messages">{stats.recentMessages}</div>
          <div class="stat-label">Messages (24h)</div>
        </div>
      </div>

      {/* Agent cards */}
      {agents && agents.length > 0 && (
        <div style="margin-bottom: 2rem;">
          <h2>Agents</h2>
          <div id="agents-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.77rem;">
            {agents.map((a) => {
              const online = isOnline(a.last_seen_at);
              return (
                <div style={online
                  ? "background: var(--color-surface); border: 2px solid #4a9a6a; border-radius: 0.46rem; padding: 0.77rem; display: flex; gap: 0.62rem; align-items: flex-start; box-shadow: 0 0 8px rgba(74,154,106,0.15);"
                  : "background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 0.46rem; padding: 0.77rem; display: flex; gap: 0.62rem; align-items: flex-start; opacity: 0.5;"
                }>
                  <div style="flex-shrink: 0; position: relative;">
                    {a.avatar ? (
                      <img src={avatarUrl(a.avatar)!} style={online
                        ? "width: 48px; height: 48px; border-radius: 50%; object-fit: cover;"
                        : "width: 48px; height: 48px; border-radius: 50%; object-fit: cover; filter: grayscale(0.7);"
                      } />
                    ) : (
                      <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--color-border);" />
                    )}
                    {online && (
                      <div style="position: absolute; bottom: 1px; right: 1px; width: 12px; height: 12px; background: #4a9a6a; border-radius: 50%; border: 2px solid var(--color-surface);" />
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
      <div id="activity-section">
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

      {raw(`<script>
(function(){
  var POLL_MS = 15000;
  var TEN_MIN = 10 * 60 * 1000;

  function relTime(iso) {
    if (!iso) return '\\u2014';
    var d = Date.now() - new Date(iso).getTime(), m = Math.floor(d/60000);
    if (m < 1) return 'gerade eben';
    if (m < 60) return 'vor ' + m + ' Min';
    var h = Math.floor(m/60);
    if (h < 24) return 'vor ' + h + ' Std';
    var dd = Math.floor(h/24);
    return 'vor ' + dd + ' Tag' + (dd > 1 ? 'en' : '');
  }

  function fmtD(iso) {
    return new Date(iso).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function buildCard(a) {
    var on = a.last_seen_at && (Date.now() - new Date(a.last_seen_at).getTime() < TEN_MIN);
    var av = a.avatar ? '/avatars/' + a.avatar + '.png' : null;
    var s = on
      ? 'background:var(--color-surface);border:2px solid #4a9a6a;border-radius:0.46rem;padding:0.77rem;display:flex;gap:0.62rem;align-items:flex-start;box-shadow:0 0 8px rgba(74,154,106,0.15);'
      : 'background:var(--color-surface);border:1px solid var(--color-border);border-radius:0.46rem;padding:0.77rem;display:flex;gap:0.62rem;align-items:flex-start;opacity:0.5;';
    var imgStyle = on
      ? 'width:48px;height:48px;border-radius:50%;object-fit:cover;'
      : 'width:48px;height:48px;border-radius:50%;object-fit:cover;filter:grayscale(0.7);';
    var dot = on ? '<div style="position:absolute;bottom:1px;right:1px;width:12px;height:12px;background:#4a9a6a;border-radius:50%;border:2px solid var(--color-surface);"></div>' : '';
    var badge = on
      ? '<span style="font-family:var(--font-mono);font-size:0.62rem;font-weight:600;padding:1px 6px;border-radius:3px;background:#e8f0e8;color:#4a7a4a;">Online</span>'
      : '<span style="font-family:var(--font-mono);font-size:0.62rem;font-weight:600;padding:1px 6px;border-radius:3px;background:#ececec;color:#888;">Offline</span>';
    var avHtml = av
      ? '<img src="' + av + '" style="' + imgStyle + '" />'
      : '<div style="width:48px;height:48px;border-radius:50%;background:var(--color-border);"></div>';
    return '<div style="' + s + '">'
      + '<div style="flex-shrink:0;position:relative;">' + avHtml + dot + '</div>'
      + '<div style="min-width:0;flex:1;">'
      + '<div style="font-weight:600;font-size:0.85rem;color:var(--color-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(a.name) + '</div>'
      + (a.role ? '<div style="font-size:0.69rem;color:var(--color-subtle);margin-top:0.1rem;">' + esc(a.role) + '</div>' : '')
      + '<div style="margin-top:0.31rem;">' + badge + '</div>'
      + (a.working_on ? '<div style="font-size:0.69rem;color:var(--color-muted);margin-top:0.31rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(a.working_on) + '</div>' : '')
      + '<div style="font-family:var(--font-mono);font-size:0.62rem;color:var(--color-light);margin-top:0.23rem;">' + relTime(a.last_seen_at) + '</div>'
      + '</div></div>';
  }

  function poll() {
    fetch('/api/home',{credentials:'same-origin'}).then(function(r){ return r.json(); }).then(function(d){
      var st = document.getElementById('stat-total');
      var so = document.getElementById('stat-online');
      var sm = document.getElementById('stat-messages');
      if (st) st.textContent = d.stats.totalAgents;
      if (so) so.textContent = d.stats.onlineAgents;
      if (sm) sm.textContent = d.stats.recentMessages;

      var grid = document.getElementById('agents-grid');
      if (grid && d.agents) {
        grid.innerHTML = d.agents.map(buildCard).join('');
      }

      var sec = document.getElementById('activity-section');
      if (sec && d.activities) {
        var h2 = '<h2>Letzte Aktivit\\u00e4ten</h2>';
        if (d.activities.length === 0) {
          sec.innerHTML = h2 + '<p class="empty">Noch keine Aktivit\\u00e4ten.</p>';
        } else {
          var items = d.activities.map(function(a) {
            var avImg = '';
            var agentAvatar = d.agents && d.agents.find(function(ag){ return ag.name === a.agent_name; });
            if (agentAvatar && agentAvatar.avatar) {
              avImg = '<img src="/avatars/' + agentAvatar.avatar + '.png" style="width:18px;height:18px;border-radius:50%;object-fit:cover;" />';
            }
            return '<li><time>' + fmtD(a.created_at) + '</time>'
              + '<span style="display:inline-flex;align-items:center;gap:0.23rem;font-size:0.69rem;color:var(--color-ghost);margin-right:0.31rem;">'
              + avImg + esc(a.agent_name || 'System')
              + '</span>' + esc(a.summary || a.action) + '</li>';
          }).join('');
          sec.innerHTML = h2 + '<ul class="activity-list">' + items + '</ul>'
            + '<div style="margin-top:0.77rem;"><a href="/activity" style="font-size:0.85rem;color:var(--color-subtle);">Alle Aktivit\\u00e4ten anzeigen \\u2192</a></div>';
        }
      }
    }).catch(function(){});
  }

  setInterval(poll, POLL_MS);
})();
</script>`)}
    </Layout>
  );
};

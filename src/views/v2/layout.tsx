// V2 page layout — Light-Brutalist app shell with brand, top-nav, ⌘K search button.
// Used by the v2 dashboard pages (Home, Agents, Conversations, Messages, Activity).

import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { V2_CSS } from "./tokens.js";

export type V2NavKey = "HOME" | "AGENTS" | "CONVOS" | "MESSAGES" | "LOG";

interface V2LayoutProps {
  title?: string;
  active?: V2NavKey;
  userRole?: string;
  csrfToken?: string;
  children?: any;
}

const V2_NAV: ReadonlyArray<readonly [V2NavKey, string, string, boolean]> = [
  ["HOME",     "Overview",      "/",              false],
  ["AGENTS",   "Agents",        "/agents",        true ],
  ["CONVOS",   "Conversations", "/conversations", false],
  ["MESSAGES", "Messages",      "/messages",      false],
  ["LOG",      "Activity",      "/activity",      false],
];

const FAVICON = raw(
  '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,' +
  '%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E' +
  '%3Crect width=\'32\' height=\'32\' rx=\'6\' fill=\'%23ff3d2e\'/%3E' +
  '%3Ctext x=\'16\' y=\'22\' text-anchor=\'middle\' fill=\'%23fff\' ' +
  "font-family='monospace' font-size='18' font-weight='800'%3Em%3C/text%3E" +
  "%3C/svg%3E\">"
);

// Cmd+K palette is wired up in PR #7 — the button just opens the placeholder for now.
const PALETTE_HINT = raw(`<script>
(function(){
  document.addEventListener('keydown', function(e){
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
      e.preventDefault();
      var btn = document.querySelector('[data-v2-search]');
      if(btn) btn.click();
    }
  });
})();
</script>`);

export const V2Layout: FC<V2LayoutProps> = ({ title, active, userRole, csrfToken, children }) => {
  const adminOnly = (key: V2NavKey) => {
    const entry = V2_NAV.find((e) => e[0] === key);
    return entry?.[3] ?? false;
  };

  return (
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} — agent.mesh` : "agent.mesh"}</title>
        {FAVICON}
        {/* Fonts via Google CDN. Self-hosting is queued for PR #7 polish. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {raw(`<style>${V2_CSS}</style>`)}
      </head>
      <body>
        <div class="v2-shell">
          <header class="v2-topbar">
            <div class="v2-brand">
              <div class="v2-brand-mark">m</div>
              <span class="v2-brand-name">agent.mesh</span>
            </div>
            <div class="v2-divider-v" />
            <nav class="v2-nav">
              {V2_NAV.map(([key, label, href, requiresAdmin]) => {
                if (requiresAdmin && userRole !== "admin") return null;
                const isActive = active === key;
                return (
                  <a key={key} href={href} class={isActive ? "active" : ""}>
                    <span>{label}</span>
                  </a>
                );
              })}
            </nav>
            <button data-v2-search class="v2-search-btn" type="button">
              <span style="color:var(--v2-text-mute)">⌕</span>
              <span style="flex:1;text-align:left">Search…</span>
              <kbd class="v2-kbd">⌘K</kbd>
            </button>
            {csrfToken && (
              <form method="post" action="/logout" style="margin-left:8px">
                <input type="hidden" name="csrf" value={csrfToken} />
                <button type="submit" class="v2-btn v2-btn--ghost" style="font-size:12px">Logout</button>
              </form>
            )}
          </header>
          <main>{children}</main>
        </div>
        {PALETTE_HINT}
      </body>
    </html>
  );
};

import type { FC } from "hono/jsx";
import { raw } from "hono/html";
import { CSS } from "../styles/tokens.js";

interface LayoutProps {
  title?: string;
  children: any;
  activePath?: string;
  userRole?: string;
  csrfToken?: string;
}

const INIT_SCRIPT = raw(`<script>
(function(){
  var t = localStorage.getItem('mesh-theme');
  if (!t) {
    t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', t);
})();
</script>`);

const BODY_SCRIPT = raw(`<script>
(function(){
  window.toggleTheme = function() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mesh-theme', next);
    var moonEl = document.getElementById('theme-moon');
    var sunEl = document.getElementById('theme-sun');
    if (moonEl) moonEl.style.display = next === 'dark' ? 'none' : 'block';
    if (sunEl) sunEl.style.display = next === 'dark' ? 'block' : 'none';
  };
  // Init theme icons
  var currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  var moonEl = document.getElementById('theme-moon');
  var sunEl = document.getElementById('theme-sun');
  if (moonEl) moonEl.style.display = currentTheme === 'dark' ? 'none' : 'block';
  if (sunEl) sunEl.style.display = currentTheme === 'dark' ? 'block' : 'none';
})();
</script>`);

const MOON_SVG = raw('<svg id="theme-moon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>');
const SUN_SVG = raw('<svg id="theme-sun" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>');

export const Layout: FC<LayoutProps> = ({ title, children, activePath, userRole, csrfToken }) => {
  return (
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ? `${title} — agent-mesh` : "agent-mesh"}</title>
        {raw('<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 32 32\'%3E%3Ccircle cx=\'16\' cy=\'16\' r=\'14\' fill=\'%23222\' stroke=\'%234a9a6a\' stroke-width=\'2\'/%3E%3Ctext x=\'16\' y=\'22\' text-anchor=\'middle\' fill=\'%234a9a6a\' font-family=\'monospace\' font-size=\'18\' font-weight=\'700\'%3Em%3C/text%3E%3C/svg%3E">')}
        {raw(`<style>${CSS}</style>`)}
        {INIT_SCRIPT}
      </head>
      <body>
        <nav>
          <a href="/" class="brand">agent-mesh</a>
          <button class="nav-toggle" onclick="document.querySelector('.nav-links').classList.toggle('open')" aria-label="Menu">
            {raw('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>')}
          </button>
          <div class="nav-links">
            <a href="/" class={activePath === "/" ? "active" : ""}>Home</a>
            {userRole === "admin" && (
              <a href="/agents" class={activePath === "/agents" ? "active" : ""}>Agents</a>
            )}
            <a href="/messages" class={activePath === "/messages" ? "active" : ""}>Messages</a>
            <a href="/conversations" class={activePath === "/conversations" ? "active" : ""}>Conversations</a>
            <a href="/activity" class={activePath === "/activity" ? "active" : ""}>Log</a>
            <div class="controls">
              <button class="ctrl-btn" onclick="toggleTheme()" aria-label="Theme wechseln">
                {MOON_SVG}
                {SUN_SVG}
              </button>
              <form method="post" action="/logout" style="display: inline; margin-left: 8px;">
                {csrfToken && <input type="hidden" name="csrf" value={csrfToken} />}
                <button type="submit" class="ctrl-btn" aria-label="Logout" style="font-size: 9px; width: auto; padding: 0 8px;">Logout</button>
              </form>
            </div>
          </div>
        </nav>
        <div class="container">
          {children}
        </div>
        {BODY_SCRIPT}
      </body>
    </html>
  );
};

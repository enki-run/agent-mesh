// Light-Brutalist v2 design tokens.
// Source: claude.ai/design bundle kjI2iyAWDJsMNJ3HXERE2Q (mesh-dashboard).
// Spec: plexus entities:f77d45zwjjtlak4wn1rf

export const V2_FONT_FAMILY_SANS = "'Inter', -apple-system, system-ui, sans-serif";
export const V2_FONT_FAMILY_MONO = "'JetBrains Mono', ui-monospace, monospace";

export const V2_TOKENS = {
  bg: "#f4f3ee",
  surface: "#ffffff",
  surface2: "#eeede6",
  surface3: "#e3e2da",
  text: "#0a0a0a",
  textDim: "rgba(10,10,10,0.66)",
  textMute: "rgba(10,10,10,0.42)",
  line: "rgba(0,0,0,0.10)",
  line2: "rgba(0,0,0,0.22)",
  accent: "#ff3d2e",
  accent2: "#1f6f3a",
  warn: "#a86700",
  danger: "#c62020",
  info: "#1f4ea8",
  radius: 10,
  radiusXL: 16,
  shellWidth: 1280,
} as const;

// Glass-surface helpers (paper-glass character).
export const V2_GLASS = {
  bg: "linear-gradient(180deg, rgba(255,255,255,0.78), rgba(255,255,255,0.62))",
  bg2: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))",
  border: "1px solid rgba(20,16,8,0.08)",
  shadow:
    "0 14px 36px rgba(20,16,8,0.10), 0 2px 6px rgba(20,16,8,0.06), inset 0 1px 0 rgba(255,255,255,0.7)",
  shadowSm: "0 4px 14px rgba(20,16,8,0.06), inset 0 1px 0 rgba(255,255,255,0.7)",
  blur: "blur(18px) saturate(150%)",
} as const;

// Full CSS string injected into V2 pages via <style>.
export const V2_CSS = `
:root {
  --v2-bg: ${V2_TOKENS.bg};
  --v2-surface: ${V2_TOKENS.surface};
  --v2-surface-2: ${V2_TOKENS.surface2};
  --v2-surface-3: ${V2_TOKENS.surface3};
  --v2-text: ${V2_TOKENS.text};
  --v2-text-dim: ${V2_TOKENS.textDim};
  --v2-text-mute: ${V2_TOKENS.textMute};
  --v2-line: ${V2_TOKENS.line};
  --v2-line-2: ${V2_TOKENS.line2};
  --v2-accent: ${V2_TOKENS.accent};
  --v2-accent-2: ${V2_TOKENS.accent2};
  --v2-warn: ${V2_TOKENS.warn};
  --v2-danger: ${V2_TOKENS.danger};
  --v2-info: ${V2_TOKENS.info};
  --v2-radius: ${V2_TOKENS.radius}px;
  --v2-radius-xl: ${V2_TOKENS.radiusXL}px;
  --v2-glass-bg: ${V2_GLASS.bg};
  --v2-glass-bg-2: ${V2_GLASS.bg2};
  --v2-glass-border: ${V2_GLASS.border};
  --v2-glass-shadow: ${V2_GLASS.shadow};
  --v2-glass-shadow-sm: ${V2_GLASS.shadowSm};
  --v2-glass-blur: ${V2_GLASS.blur};
  --v2-font-sans: ${V2_FONT_FAMILY_SANS};
  --v2-font-mono: ${V2_FONT_FAMILY_MONO};
}

html, body {
  margin: 0; padding: 0;
  background: var(--v2-bg);
  color: var(--v2-text);
  font-family: var(--v2-font-sans);
  font-size: 13.5px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
*, *::before, *::after { box-sizing: border-box; }
button { font-family: inherit; }
a { color: inherit; text-decoration: none; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(20,16,8,0.18); border-radius: 0; }
::-webkit-scrollbar-thumb:hover { background: rgba(20,16,8,0.32); }

/* ── Shell ─────────────────────────────────────────────────────── */
.v2-shell {
  width: ${V2_TOKENS.shellWidth}px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
  background:
    radial-gradient(900px 600px at 12% 8%, rgba(255,61,46,0.07), transparent 60%),
    radial-gradient(700px 500px at 88% 92%, rgba(31,111,58,0.06), transparent 60%),
    var(--v2-bg);
}
.v2-topbar {
  margin: 14px 14px 0;
  padding: 10px 14px;
  display: flex; align-items: center; gap: 10px;
  background: var(--v2-glass-bg);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  backdrop-filter: blur(18px) saturate(140%);
  border-radius: 14px;
  box-shadow:
    0 10px 28px rgba(20,16,8,0.08),
    0 1px 3px rgba(20,16,8,0.05),
    0 0 0 1px rgba(20,16,8,0.06),
    inset 0 1px 0 rgba(255,255,255,0.7);
  position: sticky; top: 14px; z-index: 40;
}
.v2-brand { display: flex; align-items: center; gap: 9px; padding: 0 6px 0 4px; }
.v2-brand-mark {
  width: 22px; height: 22px; border-radius: var(--v2-radius);
  background: var(--v2-accent); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 13px; font-family: var(--v2-font-mono);
  letter-spacing: -0.05em;
}
.v2-brand-name { font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; }
.v2-divider-v { width: 1px; height: 22px; background: var(--v2-line); margin: 0 4px; }

.v2-nav { display: flex; align-items: center; gap: 2px; flex: 1; }
.v2-nav a {
  padding: 7px 13px; border-radius: 10px; font-size: 13;
  display: flex; align-items: center; gap: 7px;
  color: var(--v2-text-dim); font-weight: 500;
  transition: background 0.15s;
}
.v2-nav a:hover { background: rgba(255,255,255,0.5); color: var(--v2-text); }
.v2-nav a.active {
  background: rgba(255,255,255,0.92);
  color: var(--v2-text); font-weight: 600;
  box-shadow: 0 1px 2px rgba(20,16,8,0.08), inset 0 1px 0 rgba(255,255,255,0.7);
}
.v2-nav-badge {
  font-size: 10.5px; font-family: var(--v2-font-mono);
  background: rgba(0,0,0,0.05); color: var(--v2-text-mute);
  padding: 1px 7px; border-radius: 999px;
}
.v2-nav a.active .v2-nav-badge {
  background: rgba(255,61,46,0.14); color: var(--v2-accent);
}

.v2-search-btn {
  background: rgba(255,255,255,0.7);
  border: 1px solid rgba(0,0,0,0.08);
  color: var(--v2-text-dim);
  border-radius: 10px; padding: 7px 12px;
  font-size: 12.5px; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  min-width: 220px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
}
.v2-search-btn .v2-kbd {
  font-size: 10.5px; color: var(--v2-text-mute);
  font-family: var(--v2-font-mono);
}

/* ── Card ──────────────────────────────────────────────────────── */
.v2-card {
  background: var(--v2-glass-bg);
  -webkit-backdrop-filter: var(--v2-glass-blur);
  backdrop-filter: var(--v2-glass-blur);
  border: var(--v2-glass-border);
  border-radius: var(--v2-radius-xl);
  overflow: hidden;
  box-shadow: var(--v2-glass-shadow);
}
.v2-card.lift-sm { box-shadow: var(--v2-glass-shadow-sm); }
.v2-card-head {
  padding: 12px 16px;
  border-bottom: 1px solid var(--v2-line);
  display: flex; align-items: center; gap: 10px;
}
.v2-card-title {
  font-size: 12px; font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase;
}
.v2-card-sub { font-size: 11.5px; color: var(--v2-text-mute); margin-top: 2px; }

/* ── Buttons ───────────────────────────────────────────────────── */
.v2-btn {
  font-family: inherit; font-size: 13px; cursor: pointer;
  padding: 6px 12px; border-radius: var(--v2-radius);
  background: var(--v2-glass-bg-2);
  -webkit-backdrop-filter: var(--v2-glass-blur);
  backdrop-filter: var(--v2-glass-blur);
  border: var(--v2-glass-border);
  color: var(--v2-text);
  box-shadow: var(--v2-glass-shadow-sm);
}
.v2-btn--primary {
  background: var(--v2-accent); border: 1px solid transparent; color: #fff;
  font-weight: 600; padding: 7px 14px; letter-spacing: 0.01em;
  box-shadow:
    0 4px 14px rgba(255,61,46,0.30),
    inset 0 1px 0 rgba(255,255,255,0.20);
}
.v2-btn--ghost {
  background: transparent; border: none; padding: 6px 10px;
  color: var(--v2-text); box-shadow: none;
}
.v2-btn--danger-outline {
  background: transparent; color: var(--v2-danger);
  border: 1px solid rgba(198,32,32,0.4);
  box-shadow: none;
}

/* ── Tag ───────────────────────────────────────────────────────── */
.v2-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  font-family: var(--v2-font-mono); letter-spacing: 0.02em;
  border: 1px solid currentColor;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
  display: inline-flex; align-items: center; gap: 4px;
}

/* ── Dot (presence) ────────────────────────────────────────────── */
.v2-dot {
  display: inline-block; border-radius: 50%;
}

/* ── Page heading ──────────────────────────────────────────────── */
.v2-h1 {
  font-size: 24px; font-weight: 700; margin: 0;
  letter-spacing: -0.025em;
}
.v2-page-sub {
  color: var(--v2-text-dim); font-size: 13px; margin-top: 4px;
  font-family: var(--v2-font-mono);
}
.v2-page-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 20px;
}

/* ── Inputs ────────────────────────────────────────────────────── */
.v2-input {
  background: rgba(255,255,255,0.7);
  border: var(--v2-glass-border); color: var(--v2-text);
  padding: 8px 12px; font-size: 13px;
  font-family: var(--v2-font-sans);
  border-radius: var(--v2-radius); outline: none;
  width: 100%;
}
.v2-input--mono { font-family: var(--v2-font-mono); }
`;

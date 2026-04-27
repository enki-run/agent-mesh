// Paper Glass design tokens (Light-Brutalist v2 evolution).
// Source: claude.ai/design bundle OcvGOdSlAcwuAbOD7H8kYg (mesh-dashboard).
// Spec: plexus entities:f77d45zwjjtlak4wn1rf
//
// Concept: brutalist typography on warm-paper bg, with glossy-glass surfaces.
// Cards/buttons get a specular sheen overlay + anchored brutalist shadow,
// so the result feels both grounded and reflective.

export const V2_FONT_FAMILY_SANS = "'Inter', -apple-system, system-ui, sans-serif";
export const V2_FONT_FAMILY_MONO = "'JetBrains Mono', ui-monospace, monospace";

export const V2_TOKENS = {
  bg: "#f1efe6",       // warm paper, slightly more saturated than v1 lightBrutal
  surface: "#ffffff",
  surface2: "#ebe9df",
  surface3: "#e0ddd0",
  text: "#0a0a0a",
  textDim: "rgba(10,10,10,0.66)",
  textMute: "rgba(10,10,10,0.42)",
  line: "rgba(20,16,8,0.10)",  // warm-tinted black
  line2: "rgba(20,16,8,0.22)",
  accent: "#ff3d2e",
  accent2: "#1f6f3a",
  warn: "#a86700",
  danger: "#c62020",
  info: "#1f4ea8",
  radius: 10,
  radiusXL: 16,
  shellWidth: 1280,
  shellWidthCompact: 1024,
  compactBreakpoint: 1180,
} as const;

// Glossy surface tokens.
// glassShadow is 5-layer: top-highlight inset + bottom-shade inset + drop +
// soft drop + 1px under-edge anchor — gives the "anchored brutalist" feel.
export const V2_GLASS = {
  bg: "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.78) 28%, rgba(255,253,247,0.66) 100%)",
  bg2: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.86) 30%, rgba(255,253,247,0.74) 100%)",
  border: "1px solid rgba(20,16,8,0.10)",
  shadow:
    "0 1px 0 rgba(255,255,255,0.95) inset," +
    " 0 -1px 0 rgba(20,16,8,0.06) inset," +
    " 0 18px 36px rgba(20,16,8,0.10)," +
    " 0 4px 10px rgba(20,16,8,0.07)," +
    " 0 1px 0 rgba(20,16,8,0.18)",
  shadowSm:
    "0 1px 0 rgba(255,255,255,0.85) inset," +
    " 0 6px 16px rgba(20,16,8,0.07)," +
    " 0 1px 0 rgba(20,16,8,0.12)",
  blur: "blur(20px) saturate(160%)",
  // Specular sheen overlay — applied as an absolutely-positioned div above
  // a glossy surface (mix-blend: screen) for the wet-glass top highlight.
  sheen: "radial-gradient(140% 70% at 50% -10%, rgba(255,255,255,0.55), rgba(255,255,255,0) 55%)",
} as const;

// Button gradients + 4-layer shadows for primary (red) and secondary (white).
export const V2_BTN = {
  primaryBg: "linear-gradient(180deg, #ff5a45 0%, #ff3d2e 50%, #e6321f 100%)",
  primaryShadow:
    "0 1px 0 rgba(255,255,255,0.40) inset," +
    " 0 -1px 0 rgba(0,0,0,0.18) inset," +
    " 0 8px 18px rgba(255,61,46,0.30)," +
    " 0 1px 0 rgba(20,16,8,0.30)",
  secondaryBg: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.78))",
  secondaryShadow:
    "0 1px 0 rgba(255,255,255,0.95) inset," +
    " 0 -1px 0 rgba(20,16,8,0.06) inset," +
    " 0 4px 10px rgba(20,16,8,0.07)," +
    " 0 1px 0 rgba(20,16,8,0.14)",
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
  --v2-sheen: ${V2_GLASS.sheen};
  --v2-btn-primary-bg: ${V2_BTN.primaryBg};
  --v2-btn-primary-shadow: ${V2_BTN.primaryShadow};
  --v2-btn-secondary-bg: ${V2_BTN.secondaryBg};
  --v2-btn-secondary-shadow: ${V2_BTN.secondaryShadow};
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
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
*, *::before, *::after { box-sizing: border-box; }
button { font-family: inherit; }
a { color: inherit; text-decoration: none; }

::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background: rgba(20,16,8,0.20); border-radius: 0;
  border: 2px solid transparent; background-clip: padding-box;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(20,16,8,0.40);
  border: 2px solid transparent; background-clip: padding-box;
}

/* ── Stage (warm paper background with three radial gradients) ─────── */
.v2-stage {
  min-height: 100vh;
  padding: 28px 0;
  background:
    radial-gradient(900px 600px at 12% 8%, rgba(255,61,46,0.10), transparent 60%),
    radial-gradient(700px 500px at 88% 92%, rgba(31,111,58,0.08), transparent 60%),
    radial-gradient(600px 400px at 50% 50%, rgba(255,200,140,0.06), transparent 70%),
    var(--v2-bg);
}

/* Responsive scaler: design renders at fixed width and scales down on
   narrow viewports via CSS transform. JS in V2Layout updates --v2-scale
   and the wrapper height so the document scrolls correctly. */
.v2-scaler {
  margin: 0 auto;
  transform-origin: top center;
  transition: transform 0.08s linear;
  will-change: transform;
}

/* ── Shell ─────────────────────────────────────────────────────── */
.v2-shell {
  width: var(--v2-design-width, ${V2_TOKENS.shellWidth}px);
  min-height: 100vh;
  position: relative;
}
.v2-topbar {
  position: relative;
  margin: 14px 14px 0;
  padding: 10px 14px;
  display: flex; align-items: center; gap: 10px;
  background: var(--v2-glass-bg-2);
  -webkit-backdrop-filter: var(--v2-glass-blur);
  backdrop-filter: var(--v2-glass-blur);
  border: var(--v2-glass-border);
  border-radius: 14px;
  box-shadow: var(--v2-glass-shadow);
  z-index: 40;
}
/* Specular sheen overlay (absolute, mix-blend: screen). */
.v2-sheen {
  position: absolute; inset: 0; pointer-events: none;
  background: var(--v2-sheen);
  mix-blend-mode: screen;
  border-radius: inherit;
}
.v2-brand { position: relative; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 4px; }
.v2-brand-mark {
  width: 24px; height: 24px; border-radius: var(--v2-radius);
  background: var(--v2-btn-primary-bg); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 14px; font-family: var(--v2-font-mono);
  letter-spacing: -0.05em;
  box-shadow: var(--v2-btn-primary-shadow);
  text-shadow: 0 1px 0 rgba(0,0,0,0.25);
}
.v2-brand-name { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; }
.v2-divider-v {
  position: relative;
  width: 1px; height: 22px;
  background: var(--v2-line-2);
  margin: 0 4px;
}

.v2-nav { position: relative; display: flex; align-items: center; gap: 2px; flex: 1; }
.v2-nav a {
  padding: 7px 13px; border-radius: 10px; font-size: 13px;
  display: flex; align-items: center; gap: 7px;
  color: var(--v2-text-dim); font-weight: 500;
  border: 1px solid transparent;
  transition: background 0.15s;
}
.v2-nav a:hover { background: rgba(255,255,255,0.5); color: var(--v2-text); }
.v2-nav a.active {
  background: var(--v2-btn-secondary-bg);
  color: var(--v2-text); font-weight: 700;
  border: var(--v2-glass-border);
  box-shadow: var(--v2-btn-secondary-shadow);
}
.v2-nav-badge {
  font-size: 10.5px; font-family: var(--v2-font-mono);
  background: rgba(0,0,0,0.05); color: var(--v2-text-mute);
  padding: 1px 7px; border-radius: 999px; font-weight: 700;
}
.v2-nav a.active .v2-nav-badge {
  background: var(--v2-btn-primary-bg); color: #fff;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.30);
}

.v2-search-btn {
  position: relative;
  background: var(--v2-btn-secondary-bg);
  border: var(--v2-glass-border);
  color: var(--v2-text-dim);
  border-radius: 10px; padding: 7px 12px;
  font-size: 12.5px; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  min-width: 220px;
  box-shadow: var(--v2-btn-secondary-shadow);
}
.v2-search-btn .v2-kbd {
  font-size: 10.5px; color: var(--v2-text-mute);
  font-family: var(--v2-font-mono);
}

/* ── Footer strip ─────────────────────────────────────────────── */
.v2-footer {
  position: relative;
  margin: 14px;
  padding: 8px 16px;
  background: var(--v2-glass-bg-2);
  -webkit-backdrop-filter: var(--v2-glass-blur);
  backdrop-filter: var(--v2-glass-blur);
  border: var(--v2-glass-border);
  border-radius: 10px;
  box-shadow: var(--v2-glass-shadow-sm);
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  font-size: 11px; color: var(--v2-text-mute);
  font-family: var(--v2-font-mono);
  letter-spacing: 0.02em;
}
.v2-footer > * { position: relative; }
.v2-footer-sep { color: var(--v2-line-2); }
.v2-footer-domain {
  display: inline-flex; align-items: center; gap: 6px;
  color: var(--v2-text); font-weight: 600;
}
.v2-footer-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--v2-accent-2);
  box-shadow: 0 0 0 3px rgba(31,111,58,0.20), inset 0 1px 0 rgba(255,255,255,0.40);
}
.v2-footer-warn { color: var(--v2-warn); font-weight: 600; }
.v2-footer-spacer { flex: 1; }

/* ── Card ──────────────────────────────────────────────────────── */
.v2-card {
  position: relative;
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
  position: relative;
  padding: 12px 16px;
  border-bottom: 1px solid var(--v2-line);
  display: flex; align-items: center; gap: 10px;
}
.v2-card-body { position: relative; }
.v2-card-title {
  font-size: 12px; font-weight: 700;
  letter-spacing: 0.06em; text-transform: uppercase;
}
.v2-card-sub { font-size: 11.5px; color: var(--v2-text-mute); margin-top: 2px; }

/* ── Buttons ───────────────────────────────────────────────────── */
.v2-btn {
  font-family: inherit; font-size: 13px; cursor: pointer;
  padding: 6px 12px; border-radius: var(--v2-radius);
  background: var(--v2-btn-secondary-bg);
  border: var(--v2-glass-border);
  color: var(--v2-text); font-weight: 600;
  box-shadow: var(--v2-btn-secondary-shadow);
}
.v2-btn--primary {
  background: var(--v2-btn-primary-bg);
  border: 1px solid rgba(20,16,8,0.20);
  color: #fff;
  font-weight: 700; padding: 7px 14px; letter-spacing: 0.01em;
  box-shadow: var(--v2-btn-primary-shadow);
  text-shadow: 0 1px 0 rgba(0,0,0,0.20);
}
.v2-btn--ghost {
  background: transparent; border: none; padding: 6px 10px;
  color: var(--v2-text); box-shadow: none; font-weight: 500;
}
.v2-btn--danger-outline {
  background: transparent; color: var(--v2-danger);
  border: 1px solid rgba(198,32,32,0.4);
  box-shadow: none;
}

/* ── Tag ───────────────────────────────────────────────────────── */
.v2-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  font-family: var(--v2-font-mono); letter-spacing: 0.02em; font-weight: 600;
  border: 1px solid currentColor;
  display: inline-flex; align-items: center; gap: 4px;
}

/* ── Dot (presence) ────────────────────────────────────────────── */
.v2-dot { display: inline-block; border-radius: 50%; }

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
  background: var(--v2-btn-secondary-bg);
  border: var(--v2-glass-border); color: var(--v2-text);
  padding: 8px 12px; font-size: 13px;
  font-family: var(--v2-font-sans);
  border-radius: var(--v2-radius); outline: none;
  width: 100%;
  box-shadow: inset 0 2px 4px rgba(20,16,8,0.04), inset 0 1px 0 rgba(255,255,255,0.7);
}
.v2-input--mono { font-family: var(--v2-font-mono); }
`;

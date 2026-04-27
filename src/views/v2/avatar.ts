// Deterministic 32×32 pixel-portrait avatar.
// Pure-function port of the canvas-based pixel-avatar.js prototype
// from claude.ai/design bundle kjI2iyAWDJsMNJ3HXERE2Q.
// Output: SVG string. No DOM, no canvas, server-renderable.

// ── FNV-1a 32-bit hash ───────────────────────────────────────────
function hash32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], h: number, salt: string): T {
  const x = (h ^ hash32(salt)) >>> 0;
  return arr[x % arr.length]!;
}

// ── Palettes ─────────────────────────────────────────────────────
const SKIN: ReadonlyArray<readonly [string, string, string]> = [
  ["#f2cfa6", "#d9a87a", "#a87146"],
  ["#e8b88e", "#c89668", "#8a5a30"],
  ["#c69472", "#9c6c4a", "#5e3820"],
  ["#8a5a3a", "#623d22", "#3a2210"],
  ["#f4d4b0", "#dba27a", "#9a6238"],
];

const HAIR = [
  "#1a1612", "#3b2516", "#6b3e1c", "#a8651f", "#d49b3a",
  "#e8d28a", "#7a3a3a", "#3a4a6e", "#5a3a6e", "#2a5a3a",
] as const;

const SHIRT = [
  "#c8311b", "#1f5a8e", "#2d6e3a", "#a86700",
  "#5a3a8a", "#1a1612", "#c8a23a", "#7a3a3a",
  "#3a6e8e", "#8e3a6e", "#4a4a4a", "#2a2a3a",
] as const;

const BG = [
  "#f4d68a", "#a8d4a8", "#f4a8a8", "#a8c4f4",
  "#d4a8f4", "#f4c4a8", "#a8e4d4", "#e4d4a8",
  "#c4c4d4", "#f4e4c4", "#d4e4f4", "#e4c4d4",
] as const;

// ── Role kit table ───────────────────────────────────────────────
type Kit = { accessory: Accessory; collar: Collar; tint: string };

type Accessory =
  | "headset" | "glasses" | "shades" | "visor" | "hardhat"
  | "cap" | "beanie" | "beret" | "antenna" | "tie" | "none";

type Collar =
  | "hoodie" | "jacket" | "tech" | "sweater" | "turtle"
  | "overalls" | "workshirt" | "suit" | "shirt" | "polo";

const ROLE_KITS: Record<string, Kit> = {
  "dev-assistant":   { accessory: "headset",  collar: "hoodie",    tint: "#3a4a6e" },
  "triage-agent":    { accessory: "glasses",  collar: "jacket",    tint: "#1f5a8e" },
  "cortex-local":    { accessory: "visor",    collar: "tech",      tint: "#2d6e3a" },
  "product-manager": { accessory: "glasses",  collar: "sweater",   tint: "#a86700" },
  "infra":           { accessory: "hardhat",  collar: "overalls",  tint: "#a86700" },
  "alert-source":    { accessory: "antenna",  collar: "tech",      tint: "#c8311b" },
  "maintenance":     { accessory: "cap",      collar: "overalls",  tint: "#4a4a4a" },
  "security":        { accessory: "shades",   collar: "suit",      tint: "#1a1612" },
  "worker":          { accessory: "beanie",   collar: "workshirt", tint: "#6b3e1c" },
  "dev-ops":         { accessory: "headset",  collar: "hoodie",    tint: "#2d6e3a" },
  "engineer":        { accessory: "cap",      collar: "tech",      tint: "#3a6e8e" },
  "data-scientist":  { accessory: "glasses",  collar: "sweater",   tint: "#5a3a8a" },
  "designer":        { accessory: "beret",    collar: "turtle",    tint: "#1a1612" },
  "ai-researcher":   { accessory: "glasses",  collar: "turtle",    tint: "#3a4a6e" },
  "support":         { accessory: "headset",  collar: "polo",      tint: "#2d6e3a" },
  "sales":           { accessory: "tie",      collar: "suit",      tint: "#1a1612" },
  "marketing":       { accessory: "beret",    collar: "jacket",    tint: "#c8311b" },
  "qa":              { accessory: "glasses",  collar: "shirt",     tint: "#a86700" },
  "manager":         { accessory: "tie",      collar: "suit",      tint: "#3a4a6e" },
  "ceo":             { accessory: "tie",      collar: "suit",      tint: "#1a1612" },
  "finance":         { accessory: "tie",      collar: "shirt",     tint: "#2a5a3a" },
  "legal":           { accessory: "glasses",  collar: "suit",      tint: "#1a1612" },
  "hr":              { accessory: "none",     collar: "sweater",   tint: "#c8311b" },
  "analyst":         { accessory: "glasses",  collar: "shirt",     tint: "#3a6e8e" },
  "researcher":      { accessory: "glasses",  collar: "turtle",    tint: "#5a3a8a" },
  "sre":             { accessory: "visor",    collar: "tech",      tint: "#c8311b" },
  "ml":              { accessory: "visor",    collar: "turtle",    tint: "#3a4a6e" },
  "oncall":          { accessory: "cap",      collar: "jacket",    tint: "#c8311b" },
  "backend":         { accessory: "beanie",   collar: "hoodie",    tint: "#2d6e3a" },
  "frontend":        { accessory: "headset",  collar: "hoodie",    tint: "#5a3a8a" },
  "mobile":          { accessory: "cap",      collar: "tech",      tint: "#3a6e8e" },
  "platform":        { accessory: "visor",    collar: "jacket",    tint: "#2d6e3a" },
};

function kitFor(role: string | undefined): Kit {
  const r = role?.toLowerCase() ?? "";
  if (ROLE_KITS[r]) return ROLE_KITS[r]!;
  if (/dev|code|engineer/.test(r))   return ROLE_KITS["dev-assistant"]!;
  if (/sec|trust/.test(r))            return ROLE_KITS["security"]!;
  if (/work/.test(r))                 return ROLE_KITS["worker"]!;
  if (/maint/.test(r))                return ROLE_KITS["maintenance"]!;
  if (/infra|deploy/.test(r))         return ROLE_KITS["infra"]!;
  if (/alert/.test(r))                return ROLE_KITS["alert-source"]!;
  if (/triage|incident/.test(r))      return ROLE_KITS["triage-agent"]!;
  if (/manag|pm|prod/.test(r))        return ROLE_KITS["product-manager"]!;
  if (/cortex|local|kg/.test(r))      return ROLE_KITS["cortex-local"]!;
  return { accessory: "cap", collar: "shirt", tint: "#3a6e8e" };
}

// ── Color helpers ────────────────────────────────────────────────
function darken(hex: string, f: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${Math.floor(r * f)},${Math.floor(g * f)},${Math.floor(b * f)})`;
}

// ── Avatar spec (pure data) ──────────────────────────────────────
export interface AvatarSpec {
  skin: readonly [string, string, string];
  hairColor: string;
  hairVariant: number; // 0-7
  eyeVariant: number;  // 0-3
  mouthVariant: number; // 0-3
  bg: string;
  kit: Kit;
  shirt: string;
}

export function deriveAvatarSpec(agentId: string, role?: string): AvatarSpec {
  const seed = hash32(agentId || "x");
  const kit = kitFor(role);
  return {
    skin: pick(SKIN, seed, "skin"),
    hairColor: pick(HAIR, seed, "hairc"),
    hairVariant: hash32(agentId + "h") % 8,
    eyeVariant: hash32(agentId + "e") % 4,
    mouthVariant: hash32(agentId + "m") % 4,
    bg: pick(BG, seed, "bg"),
    kit,
    shirt: kit.tint || pick(SHIRT, seed, "shirt"),
  };
}

// ── SVG painter ──────────────────────────────────────────────────
type Rect = string;

const rect = (x: number, y: number, w: number, h: number, c: string): Rect =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;

const px = (x: number, y: number, c: string): Rect => rect(x, y, 1, 1, c);

function drawHair(out: Rect[], variant: number, col: string): void {
  const dark = darken(col, 0.55);
  switch (variant) {
    case 0: // short messy
      out.push(rect(10, 9, 13, 4, col));
      out.push(px(10, 13, col), px(22, 13, col));
      out.push(px(13, 8, col), px(17, 8, col), px(19, 8, col));
      for (let x = 10; x <= 22; x++) out.push(px(x, 13, dark));
      break;
    case 1: // mop top
      out.push(rect(9, 9, 15, 5, col));
      out.push(rect(9, 14, 2, 2, col), rect(22, 14, 2, 2, col));
      out.push(px(11, 8, col), px(14, 8, col), px(18, 8, col), px(21, 8, col));
      break;
    case 2: // side part
      out.push(rect(10, 9, 13, 4, col));
      out.push(rect(11, 13, 4, 1, col));
      out.push(rect(10, 8, 5, 1, col));
      break;
    case 3: // spiky
      out.push(rect(10, 10, 13, 3, col));
      out.push(px(11, 9, col), px(13, 8, col), px(15, 9, col));
      out.push(px(17, 8, col), px(19, 9, col), px(21, 8, col));
      out.push(px(12, 9, col), px(16, 9, col), px(20, 9, col));
      break;
    case 4: // bowl cut
      out.push(rect(9, 9, 15, 5, col));
      out.push(rect(9, 14, 1, 2, col), rect(23, 14, 1, 2, col));
      out.push(rect(11, 14, 11, 1, col));
      break;
    case 5: // long, frames face
      out.push(rect(10, 9, 13, 4, col));
      out.push(rect(9, 13, 2, 6, col), rect(22, 13, 2, 6, col));
      out.push(px(13, 8, col), px(19, 8, col));
      break;
    case 6: // curly/poof
      out.push(rect(9, 9, 15, 4, col));
      out.push(px(9, 8, col), px(11, 7, col), px(14, 7, col));
      out.push(px(17, 7, col), px(20, 7, col), px(22, 8, col));
      out.push(px(10, 13, col), px(22, 13, col));
      break;
    default: // 7: bald + side fringe
      out.push(rect(11, 10, 4, 3, col));
      out.push(px(10, 10, col));
  }
}

function drawAccessory(out: Rect[], kind: Accessory): void {
  const ink = "#0a0a08";
  switch (kind) {
    case "headset":
      out.push(rect(9, 11, 15, 1, ink));
      out.push(px(8, 12, ink), px(24, 12, ink));
      out.push(rect(7, 13, 2, 4, ink));
      out.push(rect(9, 17, 1, 3, ink), px(10, 19, ink));
      break;
    case "glasses":
      out.push(rect(11, 16, 3, 3, ink), rect(18, 16, 3, 3, ink));
      out.push(rect(12, 17, 1, 1, "#cfe4f4"), rect(19, 17, 1, 1, "#cfe4f4"));
      out.push(px(14, 17, ink), px(17, 17, ink));
      break;
    case "shades":
      out.push(rect(11, 16, 3, 2, ink), rect(18, 16, 3, 2, ink));
      out.push(px(14, 17, ink), px(17, 17, ink));
      out.push(px(12, 16, "#fff"), px(19, 16, "#fff"));
      break;
    case "visor":
      out.push(rect(9, 15, 15, 3, ink));
      out.push(rect(10, 16, 13, 1, "#3ad4ff"));
      out.push(px(12, 16, "#fff"), px(20, 16, "#fff"));
      break;
    case "hardhat":
      out.push(rect(9, 9, 15, 3, "#f4c43a"));
      out.push(rect(8, 12, 17, 1, "#f4c43a"));
      out.push(rect(8, 13, 17, 1, "#a87a1a"));
      out.push(px(16, 9, ink));
      break;
    case "cap":
      out.push(rect(10, 8, 13, 4, "#1a3a5a"));
      out.push(rect(22, 11, 4, 1, "#1a3a5a"));
      out.push(px(16, 10, "#fff"));
      break;
    case "beanie":
      out.push(rect(9, 8, 15, 5, "#5a3a8a"));
      out.push(rect(9, 12, 15, 1, "#3a2a5a"));
      out.push(px(16, 6, "#5a3a8a"), px(16, 7, "#5a3a8a"));
      break;
    case "beret":
      out.push(rect(9, 8, 15, 4, "#1a1612"));
      out.push(px(23, 8, "#1a1612"));
      out.push(px(8, 11, "#1a1612"), px(8, 10, "#1a1612"));
      break;
    case "antenna":
      out.push(rect(16, 4, 1, 5, ink));
      out.push(px(16, 3, "#c8311b"));
      out.push(rect(10, 11, 13, 1, "#c8311b"));
      break;
    case "tie":
      out.push(rect(16, 24, 1, 4, "#c8311b"));
      out.push(px(15, 24, "#c8311b"), px(17, 24, "#c8311b"));
      out.push(px(16, 28, "#c8311b"));
      break;
    case "none":
      break;
  }
}

function drawCollar(out: Rect[], kind: Collar, color: string): void {
  const dark = darken(color, 0.7);
  out.push(rect(6, 25, 21, 7, color));
  for (let x = 6; x <= 26; x++) out.push(px(x, 32, dark));

  switch (kind) {
    case "hoodie":
      out.push(rect(6, 22, 3, 4, color), rect(24, 22, 3, 4, color));
      out.push(px(14, 26, "#fff"), px(18, 26, "#fff"));
      out.push(px(14, 27, "#fff"), px(18, 27, "#fff"));
      break;
    case "jacket":
      out.push(rect(13, 24, 6, 1, dark));
      out.push(px(12, 25, dark), px(19, 25, dark));
      out.push(rect(16, 25, 1, 7, dark));
      break;
    case "tech":
      out.push(rect(16, 25, 1, 7, "#3ad4ff"));
      out.push(rect(7, 25, 2, 1, "#3ad4ff"), rect(24, 25, 2, 1, "#3ad4ff"));
      break;
    case "sweater":
      out.push(px(15, 25, dark), px(17, 25, dark), px(16, 26, dark));
      for (let x = 8; x <= 24; x += 2) out.push(px(x, 31, dark));
      break;
    case "turtle":
      out.push(rect(13, 23, 7, 2, color), rect(13, 25, 7, 1, dark));
      break;
    case "overalls":
      out.push(rect(12, 25, 1, 7, dark), rect(20, 25, 1, 7, dark));
      out.push(px(12, 27, "#f4c43a"), px(20, 27, "#f4c43a"));
      break;
    case "workshirt":
      out.push(rect(9, 27, 3, 3, dark));
      break;
    case "suit":
      out.push(rect(10, 25, 4, 5, dark), rect(19, 25, 4, 5, dark));
      out.push(rect(14, 25, 5, 5, "#fff"), rect(14, 24, 5, 1, "#fff"));
      break;
    case "shirt":
      out.push(px(14, 24, "#fff"), px(18, 24, "#fff"));
      out.push(rect(14, 25, 5, 1, "#fff"));
      out.push(px(16, 27, dark), px(16, 30, dark));
      break;
    case "polo":
      out.push(rect(14, 24, 5, 1, dark));
      out.push(px(13, 25, dark), px(19, 25, dark));
      out.push(rect(16, 25, 1, 3, dark));
      break;
  }
}

function drawEyes(out: Rect[], variant: number): void {
  const ink = "#0a0a08";
  switch (variant) {
    case 0: out.push(px(13, 17, ink), px(19, 17, ink)); break;
    case 1:
      out.push(rect(12, 16, 2, 2, "#fff"), rect(18, 16, 2, 2, "#fff"));
      out.push(px(13, 17, ink), px(19, 17, ink)); break;
    case 2:
      out.push(rect(12, 17, 2, 1, ink), rect(18, 17, 2, 1, ink)); break;
    default:
      out.push(px(13, 17, ink), px(19, 17, ink));
      out.push(px(12, 17, ink), px(20, 17, ink));
  }
}

function drawMouth(out: Rect[], variant: number): void {
  const ink = "#0a0a08";
  switch (variant) {
    case 0: out.push(rect(15, 21, 3, 1, ink)); break;
    case 1: out.push(px(16, 21, ink)); break;
    case 2:
      out.push(rect(14, 21, 5, 1, ink));
      out.push(px(14, 22, ink), px(18, 22, ink)); break;
    default: out.push(rect(16, 21, 3, 1, ink));
  }
}

// ── Public API ───────────────────────────────────────────────────
export interface AvatarRenderOptions {
  size?: number;       // pixel-display size, default 32
  rounded?: boolean;   // border-radius 50%, default false
  ringColor?: string;  // optional 1.5px outline ring
}

/**
 * Render the avatar's pixel-art rectangles in the 0–32 coordinate space,
 * without any wrapping <svg> tag. Useful for embedding the avatar inside
 * another SVG (e.g. the mesh-topology nodes) via:
 *   `<g transform="translate(cx - N/2, cy - N/2) scale(N/32)">{inner}</g>`
 */
export function renderAvatarSvgInner(agentId: string, role?: string): string {
  const spec = deriveAvatarSpec(agentId, role);
  const rects: Rect[] = [];

  // Background + bottom shading
  rects.push(rect(0, 0, 32, 32, spec.bg));
  rects.push(rect(0, 24, 32, 8, darken(spec.bg, 0.85)));

  // Collar / body
  drawCollar(rects, spec.kit.collar, spec.shirt);

  // Neck
  rects.push(rect(14, 22, 5, 3, spec.skin[1]));
  rects.push(rect(14, 25, 5, 1, darken(spec.skin[1], 0.7)));

  // Head — 3 rects so the corners stay clipped at the rounded silhouette.
  rects.push(rect(12, 10, 9, 1, spec.skin[0]));
  rects.push(rect(11, 11, 11, 11, spec.skin[0]));
  rects.push(rect(12, 22, 9, 1, spec.skin[0]));

  // Ears
  rects.push(rect(10, 16, 1, 3, spec.skin[1]));
  rects.push(rect(22, 16, 1, 3, spec.skin[1]));

  // Jaw shadow + cheek
  rects.push(rect(12, 22, 9, 1, darken(spec.skin[0], 0.85)));
  rects.push(px(12, 19, darken(spec.skin[0], 0.92)));
  rects.push(px(21, 19, darken(spec.skin[0], 0.92)));

  drawHair(rects, spec.hairVariant, spec.hairColor);
  drawEyes(rects, spec.eyeVariant);
  drawMouth(rects, spec.mouthVariant);
  drawAccessory(rects, spec.kit.accessory);

  return rects.join("");
}

export function renderAvatarSvg(
  agentId: string,
  role?: string,
  opts: AvatarRenderOptions = {}
): string {
  const size = opts.size ?? 32;
  const inner = renderAvatarSvgInner(agentId, role);

  const ringAttr = opts.ringColor
    ? ` style="filter:drop-shadow(0 0 0 ${opts.ringColor})"`
    : "";
  const radiusAttr = opts.rounded ? ` rx="16" ry="16"` : "";

  // Wrap in a background-clipping rect for rounded variant.
  const clip = opts.rounded
    ? `<defs><clipPath id="r"><rect x="0" y="0" width="32" height="32"${radiusAttr}/></clipPath></defs><g clip-path="url(#r)">`
    : "";
  const clipEnd = opts.rounded ? "</g>" : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 32 32" width="${size}" height="${size}" ` +
    `shape-rendering="crispEdges"${ringAttr}>` +
    clip + inner + clipEnd +
    `</svg>`
  );
}

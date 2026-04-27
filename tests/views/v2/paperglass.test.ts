// Smoke tests for the Paper Glass refresh: new sheen primitive, footer
// strip, responsive scaler markup, updated tokens.

import { describe, it, expect } from "vitest";
import { V2Layout } from "../../../src/views/v2/layout";
import { V2_TOKENS, V2_GLASS, V2_BTN } from "../../../src/views/v2/tokens";

async function render(props: Parameters<typeof V2Layout>[0]): Promise<string> {
  return String(await Promise.resolve(V2Layout(props)));
}

describe("Paper Glass tokens", () => {
  it("uses warm-paper bg #f1efe6", () => {
    expect(V2_TOKENS.bg).toBe("#f1efe6");
  });

  it("uses warm-tinted lines (rgba(20,16,8,...))", () => {
    expect(V2_TOKENS.line).toContain("20,16,8");
    expect(V2_TOKENS.line2).toContain("20,16,8");
  });

  it("exposes glossy primary button gradient", () => {
    expect(V2_BTN.primaryBg).toContain("linear-gradient");
    expect(V2_BTN.primaryBg).toContain("#ff");
  });

  it("glassShadow is multi-layer (inset highlight + drops + anchor)", () => {
    expect(V2_GLASS.shadow).toContain("inset");
    expect(V2_GLASS.shadow).toContain("rgba(20,16,8");
    // 5 commas-separated shadow layers
    const layers = V2_GLASS.shadow.split(",").length;
    expect(layers).toBeGreaterThanOrEqual(5);
  });

  it("provides a sheen radial-gradient", () => {
    expect(V2_GLASS.sheen).toContain("radial-gradient");
    expect(V2_GLASS.sheen).toContain("rgba(255,255,255");
  });
});

describe("V2Layout — Paper Glass refresh", () => {
  it("wraps the shell in a responsive scaler", async () => {
    const html = await render({ active: "HOME", children: "x" });
    expect(html).toContain('class="v2-stage"');
    expect(html).toContain('class="v2-scaler"');
    expect(html).toContain('class="v2-shell"');
  });

  it("adds sheen overlay to top-bar and footer", async () => {
    const html = await render({ active: "HOME", children: "x" });
    // At least two v2-sheen divs (topbar + footer + cards inside, but min 2 here)
    const matches = html.match(/class="v2-sheen"/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("renders the footer with stack chain + warn marker", async () => {
    const html = await render({ active: "HOME", children: "x" });
    expect(html).toContain('class="v2-footer"');
    expect(html).toContain("mesh.enki.run");
    expect(html).toContain("Hono · TypeScript");
    expect(html).toContain("NATS JetStream");
    expect(html).toContain("Apache 2.0");
    expect(html).toContain("NATS · single-node");
  });

  it("ships the responsive scaler script", async () => {
    const html = await render({ active: "HOME", children: "x" });
    expect(html).toContain("v2-design-width");
    expect(html).toContain("ResizeObserver");
    expect(html).toContain(String(V2_TOKENS.compactBreakpoint));
  });

  it("title mentions Paper Glass when no page title", async () => {
    const html = await render({ active: "HOME", children: "x" });
    expect(html).toContain("Paper Glass");
  });
});

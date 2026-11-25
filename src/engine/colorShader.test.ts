import { describe, expect, it } from "vitest";
import {
  compileShaderParams,
  isNativeColorableAsset,
  recolorPixelRgb01,
  resolveEffectiveRecolorMode,
} from "./colorShader";
import { DEFAULT_RECOLOR, type RgbRecolor, type VaultAsset } from "@/types/map";

function makeAsset(partial: Partial<VaultAsset>): VaultAsset {
  return {
    id: "test/asset",
    sourceId: "src-1",
    sourceName: "Test Pack",
    sourceKind: "dungeondraft_pack",
    internalPath: "test/asset.png",
    url: "/test.png",
    thumbUrl: "/test.png",
    displayName: "Test Asset",
    category: "object",
    widthPx: 256,
    heightPx: 256,
    defaultPpi: 256,
    drawMode: "normal",
    dominantHex: "#808080",
    castsShadow: true,
    isFavorite: false,
    tags: [],
    ...partial,
  };
}

describe("colorShader — Dungeondraft Parity & Studio Colorizer", () => {
  it("auto-detects Dungeondraft red-mask, Wonderdraft ink-tint, and 3-channel RGB modes", () => {
    const ddAsset = makeAsset({
      sourceKind: "dungeondraft_pack",
      drawMode: "rgb_channels",
      tags: ["colorable"],
    });
    const wdTint = makeAsset({
      sourceKind: "wonderdraft",
      drawMode: "sample_color",
    });
    const wdRgb = makeAsset({
      sourceKind: "wonderdraft",
      drawMode: "rgb_channels",
    });
    const normalAsset = makeAsset({ sourceKind: "dcpack", drawMode: "normal" });

    expect(isNativeColorableAsset(ddAsset)).toBe(true);
    expect(isNativeColorableAsset(wdTint)).toBe(true);
    expect(isNativeColorableAsset(normalAsset)).toBe(false);

    expect(resolveEffectiveRecolorMode(undefined, ddAsset)).toBe("dd_red");
    expect(resolveEffectiveRecolorMode(undefined, wdTint)).toBe("tint");
    expect(resolveEffectiveRecolorMode(undefined, wdRgb)).toBe("rgb_channels");
    expect(resolveEffectiveRecolorMode(undefined, normalAsset)).toBe("universal");
  });

  it("dd_red replaces pure red, dark red shadows, and pink highlights while leaving ink and brown wood untouched", () => {
    const recolor: RgbRecolor = {
      ...DEFAULT_RECOLOR,
      enabled: true,
      mode: "dd_red",
      tintHex: "#00B4D8", // bright cyan
      strength: 1,
    };
    const p = compileShaderParams(recolor);

    // 1. Pure red (1, 0, 0) -> exact target cyan (0, 0.706, 0.847)
    const [r1, g1, b1] = recolorPixelRgb01(1, 0, 0, p);
    expect(r1).toBeCloseTo(0, 2);
    expect(g1).toBeCloseTo(0xb4 / 255, 2);
    expect(b1).toBeCloseTo(0xd8 / 255, 2);

    // 2. Dark shaded red (0.5, 0, 0) -> half-brightness cyan (preserves artist shading!)
    const [r2, g2, b2] = recolorPixelRgb01(0.5, 0, 0, p);
    expect(r2).toBeCloseTo(0, 2);
    expect(g2).toBeCloseTo((0xb4 / 255) * 0.5, 2);
    expect(b2).toBeCloseTo((0xd8 / 255) * 0.5, 2);

    // 3. Light pink highlight (1, 0.5, 0.5) -> lifted bright cyan highlight
    const [r3, g3, b3] = recolorPixelRgb01(1, 0.5, 0.5, p);
    expect(r3).toBeCloseTo(0.5, 2);
    expect(g3).toBeCloseTo(0.5 + 0.5 * (0xb4 / 255), 2);
    expect(b3).toBeCloseTo(0.5 + 0.5 * (0xd8 / 255), 2);

    // 4. Black ink outline (0.04, 0.04, 0.04) -> untouched!
    const [r4, g4, b4] = recolorPixelRgb01(0.04, 0.04, 0.04, p);
    expect(r4).toBeCloseTo(0.04, 3);
    expect(g4).toBeCloseTo(0.04, 3);
    expect(b4).toBeCloseTo(0.04, 3);

    // 5. Blue/green non-red detail (0.2, 0.55, 0.3) -> untouched!
    const [r5, g5, b5] = recolorPixelRgb01(0.2, 0.55, 0.3, p);
    expect(r5).toBeCloseTo(0.2, 3);
    expect(g5).toBeCloseTo(0.55, 3);
    expect(b5).toBeCloseTo(0.3, 3);

    // 6. Warm golden-oak wood (0.55, 0.42, 0.20 -> hue ~38 deg) -> untouched!
    const [r6, g6, b6] = recolorPixelRgb01(0.55, 0.42, 0.2, p);
    expect(r6).toBeCloseTo(0.55, 2);
    expect(g6).toBeCloseTo(0.42, 2);
    expect(b6).toBeCloseTo(0.2, 2);
  });

  it("rgb_channels replaces R, G, and B channels independently while keeping neutral gray ink intact", () => {
    const recolor: RgbRecolor = {
      ...DEFAULT_RECOLOR,
      enabled: true,
      mode: "rgb_channels",
      channelR: "#2563EB",
      channelG: "#F59E0B",
      channelB: "#10B981",
      strength: 1,
    };
    const p = compileShaderParams(recolor);

    const [rr, rg, rb] = recolorPixelRgb01(1, 0, 0, p);
    expect(rr).toBeCloseTo(0x25 / 255, 2);
    expect(rg).toBeCloseTo(0x63 / 255, 2);
    expect(rb).toBeCloseTo(0xeb / 255, 2);

    const [gr, gg, gb] = recolorPixelRgb01(0, 1, 0, p);
    expect(gr).toBeCloseTo(0xf5 / 255, 2);
    expect(gg).toBeCloseTo(0x9e / 255, 2);
    expect(gb).toBeCloseTo(0x0b / 255, 2);

    const [br, bg, bb] = recolorPixelRgb01(0, 0, 1, p);
    expect(br).toBeCloseTo(0x10 / 255, 2);
    expect(bg).toBeCloseTo(0xb9 / 255, 2);
    expect(bb).toBeCloseTo(0x81 / 255, 2);

    const [kr, kg, kb] = recolorPixelRgb01(0.2, 0.2, 0.2, p);
    expect(kr).toBeCloseTo(0.2, 3);
    expect(kg).toBeCloseTo(0.2, 3);
    expect(kb).toBeCloseTo(0.2, 3);
  });

  it("tint preserves black ink lines while richly coloring white/gray fills (Wonderdraft sample_color)", () => {
    const recolor: RgbRecolor = {
      ...DEFAULT_RECOLOR,
      enabled: true,
      mode: "tint",
      tintHex: "#D97706",
      strength: 1,
    };
    const p = compileShaderParams(recolor);

    // Pure black ink stays pure black
    expect(recolorPixelRgb01(0, 0, 0, p)).toEqual([0, 0, 0]);
    // Pure white fill becomes exact target gold
    const [wr, wg, wb] = recolorPixelRgb01(1, 1, 1, p);
    expect(wr).toBeCloseTo(0xd9 / 255, 2);
    expect(wg).toBeCloseTo(0x77 / 255, 2);
    expect(wb).toBeCloseTo(0x06 / 255, 2);
  });
});

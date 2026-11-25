import { describe, expect, it } from "vitest";
import { computeAmbientLightmapRgb } from "@/engine/sceneRenderer";

describe("computeAmbientLightmapRgb", () => {
  it("darkens monotonically with ambientIntensity even for bright warm presets like Golden Hour", () => {
    const bright = computeAmbientLightmapRgb("#FFE6BF", 0.9);
    const medium = computeAmbientLightmapRgb("#FFE6BF", 0.5);
    const dark = computeAmbientLightmapRgb("#FFE6BF", 0.15);

    expect(bright[0]).toBeGreaterThan(medium[0]);
    expect(medium[0]).toBeGreaterThan(dark[0]);
    expect(dark[0]).toBeLessThan(60);
    // Warm tint preserved (R > G > B)
    expect(medium[0]).toBeGreaterThan(medium[1]);
    expect(medium[1]).toBeGreaterThan(medium[2]);
  });

  it("preserves cool blue twilight tint without crushing dark hex swatches to zero", () => {
    const [r, g, b] = computeAmbientLightmapRgb("#162038", 0.44);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(95);
    expect(b).toBeLessThan(130);
  });

  it("returns pure neutral dark at zero intensity and handles black tint safely", () => {
    expect(computeAmbientLightmapRgb("#FFE6BF", 0)).toEqual([0, 0, 0]);
    expect(computeAmbientLightmapRgb("#000000", 0.5)).toEqual([128, 128, 128]);
  });
});

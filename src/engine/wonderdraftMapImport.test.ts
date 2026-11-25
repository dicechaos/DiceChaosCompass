import { describe, expect, it } from "vitest";
import { decodeMaskB64 } from "@/engine/worldEngine";
import { importWonderdraftMapData } from "@/engine/wonderdraftMapImport";
import type { VaultAsset } from "@/types/map";

function makeWorldVault(): VaultAsset[] {
  const mk = (id: string, name: string, group: VaultAsset["worldGroup"], tags: string[], drawMode: VaultAsset["drawMode"] = "normal"): VaultAsset => ({
    id,
    sourceId: "src-world-atlas-cc0",
    sourceName: "DiceChaos World Atlas CC0",
    sourceKind: "dcpack",
    internalPath: id,
    url: `/${id}`,
    thumbUrl: `/${id}`,
    displayName: name,
    category: "symbol",
    worldGroup: group,
    widthPx: 256,
    heightPx: 256,
    defaultPpi: 256,
    drawMode,
    dominantHex: "#556B2F",
    castsShadow: true,
    isFavorite: false,
    tags,
  });

  return [
    mk("world/pine_1.png", "Alpine Pine 1", "trees", ["world", "trees", "pine", "set_pine"]),
    mk("world/pine_2.png", "Alpine Pine 2", "trees", ["world", "trees", "pine", "set_pine"]),
    mk("world/castle_1.png", "Human Castle", "settlements", ["world", "settlements", "castle", "set_medieval_towns"], "rgb_channels"),
    mk("world/mtn_1.png", "Alpine Peak", "mountains", ["world", "mountains", "peak", "set_alpine_peaks"]),
  ];
}

describe("wonderdraftMapImport", () => {
  it("converts Wonderdraft mask (A=land, R=freshwater), Line2D paths, labels, and symbols into an editable World Atlas", () => {
    const mw = 400;
    const mh = 250;
    const rgba = new Uint8Array(mw * mh * 4);
    // Paint central island (A=240) with a narrow vertical freshwater river (R=220) down the middle!
    for (let y = 50; y < 200; y++) {
      for (let x = 80; x < 320; x++) {
        const off = (y * mw + x) * 4;
        rgba[off + 3] = 240; // Land
        if (Math.abs(x - 200) <= 2) {
          rgba[off] = 220; // Freshwater river channel
        }
      }
    }

    const fakeWd = {
      version: 9,
      map_width: 4000,
      map_height: 2500,
      water_level: 0.5,
      mask: {
        _godotType: "Object",
        className: "Image",
        props: {
          data: { width: mw, height: mh, format: "RGBA8", data: rgba },
        },
      },
      paths: [
        {
          _godotType: "Object",
          className: "Line2D",
          props: {
            visible: true,
            position: { _godotType: "Vector2", x: -1000, y: -500 },
            points: [
              { x: 2000, y: 1500 },
              { x: 2500, y: 1750 },
              { x: 3000, y: 1600 },
            ],
            start_width: 8,
            default_color: { _godotType: "Color", r: 0.2, g: 0.15, b: 0.1, a: 1 },
          },
        },
      ],
      labels: [
        {
          text: "Twirl'mire",
          position: { _godotType: "Vector2", x: 2000, y: 1250 },
          size: 54,
          rotation: 0.15,
          curve: 0.25,
          font: "East Sea Dokdo",
          color: { _godotType: "Color", r: 0, g: 0, b: 0, a: 1 },
          outline_size: 2,
          outline_color: { _godotType: "Color", r: 0.9, g: 0.85, b: 0.65, a: 1 },
        },
      ],
      symbols: [
        {
          texture: "res://sprites/trees/hatch_pine/hatch_pine_01",
          type: "tree",
          position: { _godotType: "Vector2", x: 1600, y: 1000 },
          offset: { _godotType: "Vector2", x: 0, y: -40 },
          scale: { _godotType: "Vector2", x: 0.25, y: 0.25 },
          radius: 80,
          rotation: 0,
          z_index: 0,
          mirror: false,
        },
        {
          texture: "user://assets/myassets/sprites/symbols/premium_buildings_human/h_big_castle",
          type: "symbol",
          position: { _godotType: "Vector2", x: 2000, y: 1250 },
          offset: { _godotType: "Vector2", x: 0, y: -100 },
          scale: { _godotType: "Vector2", x: 0.2, y: 0.2 },
          radius: 180,
          rotation: 0,
          z_index: 2,
          mirror: true,
          custom_color_mode: 2,
          custom_colors: [
            { _godotType: "Color", r: 0.8, g: 0.2, b: 0.1, a: 1 },
            { _godotType: "Color", r: 0.1, g: 0.6, b: 0.2, a: 1 },
            { _godotType: "Color", r: 0.2, g: 0.3, b: 0.8, a: 1 },
          ],
        },
      ],
      scale: {
        position: { _godotType: "Vector2", x: 600, y: 2100 },
        size: { _godotType: "Vector2", x: 200, y: 18 },
        segments: 3,
        segment_distance: 100,
      },
      frame: { enabled: true },
    };

    const { doc, summary } = importWonderdraftMapData(fakeWd, makeWorldVault(), {
      fileName: "Trofraderra.wonderdraft_map",
      policy: "cc0_only",
      spreadVariants: true,
    });

    expect(doc.mode).toBe("world");
    expect(doc.canvas.widthCells).toBe(48);
    expect(doc.canvas.heightCells).toBe(30);
    expect(summary.counts.hasHeightmap).toBe(true);
    expect(summary.counts.labels).toBe(1);
    expect(summary.counts.trailsOrPaths).toBe(1);
    expect(summary.counts.symbolsOrObjects).toBe(2);

    // Verify landmass & freshwater river channel were preserved in masks!
    const w = doc.world!;
    const hm = decodeMaskB64(w.heightmapB64, w.gridW * w.gridH);
    const centerIdx = Math.floor(w.gridH / 2) * w.gridW + Math.floor(w.gridW / 2);
    expect(hm[0]).toBeLessThan(128); // Corner ocean
    expect(hm[centerIdx]).toBeGreaterThanOrEqual(200); // Central island
    expect(w.freshwaterB64).toBeTruthy();
    const fw = decodeMaskB64(w.freshwaterB64!, w.gridW * w.gridH);
    expect(fw[centerIdx]).toBeGreaterThanOrEqual(180); // Narrow river preserved via max-pooling!

    // Verify Line2D position + points transform: (-1000+2000)/4000 * 48 = 12.0, (-500+1500)/2500 * 30 = 12.0
    expect(w.trails[0].points[0].x).toBeCloseTo(12, 2);
    expect(w.trails[0].points[0].y).toBeCloseTo(12, 2);

    // Verify label coordinates, curve & text
    expect(w.labels[0].text).toBe("Twirl'mire");
    expect(w.labels[0].x).toBeCloseTo(24, 2);
    expect(w.labels[0].y).toBeCloseTo(15, 2);
    expect(w.labels[0].curveBend).toBeCloseTo(0.25, 2);

    // Verify Z-layer separation (z_index 0 vs z_index 2) and custom RGB recolor on castle
    const mainLayer = doc.layers.find((l) => l.id === "layer-wd-symbols")!;
    const overLayer = doc.layers.find((l) => l.id === "layer-wd-overhead")!;
    expect(mainLayer.objects).toHaveLength(1);
    expect(overLayer.objects).toHaveLength(1);
    expect(overLayer.objects![0].flipX).toBe(true);
    expect(overLayer.objects![0].recolor.enabled).toBe(true);
    expect(overLayer.objects![0].recolor.mode).toBe("rgb_channels");
    expect(overLayer.objects![0].importedSourceRef).toContain("h_big_castle");
  });
});

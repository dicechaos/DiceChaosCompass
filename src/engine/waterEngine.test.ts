import { describe, expect, it } from "vitest";
import {
  WATER_BIOME_PRESETS,
  brushStrokeOverlapsWaterRegion,
  buildRiverPolygon,
  buildWaterBrushPolygon,
  buildWaterBrushShape,
  computeUnifiedWaterLayerOutline,
  computeWaterOutline,
  createLiveWaterSculptSession,
  getWaterPreset,
  perturbShoreline,
  pointInWaterRegion,
  stepLiveWaterSculptSession,
  subtractBrushFromWaterRegion,
  unionWaterRegionsWithBrush,
} from "./waterEngine";
import { createHiddenSloopMap } from "@/data/hiddenSloopMap";
import type { Point2D, WaterRegion } from "@/types/map";

function segmentsCross(a: Point2D, b: Point2D, c: Point2D, d: Point2D): boolean {
  const ccw = (p1: Point2D, p2: Point2D, p3: Point2D) =>
    (p3.y - p1.y) * (p2.x - p1.x) - (p2.y - p1.y) * (p3.x - p1.x);
  const d1 = ccw(a, b, c);
  const d2 = ccw(a, b, d);
  const d3 = ccw(c, d, a);
  const d4 = ccw(c, d, b);
  return ((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) &&
    ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6));
}

function hasSelfIntersection(poly: Point2D[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      const c = poly[j];
      const d = poly[(j + 1) % n];
      if (segmentsCross(a, b, c, d)) return true;
    }
  }
  return false;
}

describe("Water Studio Engine", () => {
  it("provides 8 curated water biome presets with valid colors and fallback", () => {
    expect(WATER_BIOME_PRESETS.length).toBeGreaterThanOrEqual(8);
    for (const p of WATER_BIOME_PRESETS) {
      expect(p.deepColorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.shallowColorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.rimColorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
    expect(getWaterPreset("tropical_lagoon").kind).toBe("water");
    expect(getWaterPreset("volcanic_lava").kind).toBe("lava");
    expect(getWaterPreset("unknown_id").id).toBe("alpine_lake");
  });

  it("expands a river centerline spline into a smooth closed polygon containing centerline points", () => {
    const poly = buildRiverPolygon(
      [
        { x: 2, y: 5 },
        { x: 10, y: 7 },
        { x: 18, y: 5 },
      ],
      3.0,
      true,
    );
    expect(poly.length).toBeGreaterThan(20);
    expect(hasSelfIntersection(poly)).toBe(false);

    const region: WaterRegion = {
      id: "river-1",
      kind: "water",
      shape: "river",
      widthCells: 3.0,
      curved: true,
      points: [
        { x: 2, y: 5 },
        { x: 10, y: 7 },
        { x: 18, y: 5 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    expect(pointInWaterRegion({ x: 10, y: 7 }, region)).toBe(true);
    expect(pointInWaterRegion({ x: 10, y: 12 }, region)).toBe(false);
  });

  it("handles hairpin sharp-bend River Path cleanly without self-intersecting bow-ties", () => {
    const hairpinPoly = buildRiverPolygon(
      [
        { x: 4, y: 6 },
        { x: 12, y: 6 },
        { x: 6, y: 7 },
        { x: 14, y: 9 },
      ],
      3.2,
      true,
    );
    expect(hairpinPoly.length).toBeGreaterThan(20);
    expect(hasSelfIntersection(hairpinPoly)).toBe(false);
  });

  it("excludes carved dry islands (cutouts) from water hit-testing", () => {
    const lake: WaterRegion = {
      id: "lake-island",
      kind: "water",
      shape: "polygon",
      curved: false,
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
      ],
      cutouts: [
        [
          { x: 8, y: 8 },
          { x: 12, y: 8 },
          { x: 12, y: 12 },
          { x: 8, y: 12 },
        ],
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    expect(pointInWaterRegion({ x: 3, y: 3 }, lake)).toBe(true);
    expect(pointInWaterRegion({ x: 10, y: 10 }, lake)).toBe(false);
    expect(computeWaterOutline(lake).holes.length).toBe(1);
  });

  it("perturbs shorelines deterministically and builds freehand brush lake capsules", () => {
    const pts = [
      { x: 5, y: 5 },
      { x: 12, y: 5 },
      { x: 12, y: 12 },
      { x: 5, y: 12 },
    ];
    const runA = perturbShoreline(pts, 0.35, 99, true);
    const runB = perturbShoreline(pts, 0.35, 99, true);
    expect(runA).toEqual(runB);
    expect(runA).not.toEqual(pts);

    const brushPoly = buildWaterBrushPolygon(
      [
        { x: 4, y: 4 },
        { x: 6, y: 5 },
        { x: 9, y: 6 },
      ],
      1.8,
      0.25,
      42,
    );
    expect(brushPoly.length).toBeGreaterThan(16);
    expect(hasSelfIntersection(brushPoly)).toBe(false);
  });

  it("converts self-intersecting figure-8 / loop Lake Brush strokes into sparse manifold polygons without bow-ties", () => {
    const figure8: Point2D[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = (i / 32) * Math.PI * 2;
      figure8.push({
        x: 15 + Math.sin(t) * 4.5,
        y: 12 + Math.sin(t * 2) * 2.5,
      });
    }
    const shapes = buildWaterBrushShape(figure8, 1.3, 0.15, 77);
    expect(shapes.length).toBe(1);
    const outer = shapes[0].points;
    expect(outer.length).toBeLessThan(95);
    expect(hasSelfIntersection(outer)).toBe(false);

    const region: WaterRegion = {
      id: "fig8",
      kind: "water",
      shape: "polygon",
      curved: true,
      points: outer,
      cutouts: shapes[0].cutouts,
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
      organicRoughness: 0,
    };
    // Center crossover and loop wings are submerged; closed holes remain dry
    expect(pointInWaterRegion({ x: 15, y: 12 }, region)).toBe(true);
    expect(pointInWaterRegion({ x: 19.5, y: 12 }, region)).toBe(true);
    expect(pointInWaterRegion({ x: 5, y: 5 }, region)).toBe(false);
    expect(shapes[0].cutouts.length).toBe(2);
    expect(pointInWaterRegion({ x: 17.8, y: 12 }, region)).toBe(false);
  });

  it("unions two separate lakes cleanly when bridged by a Lake Brush stroke", () => {
    const lakeA: WaterRegion = {
      id: "lake-a",
      kind: "water",
      presetId: "alpine_lake",
      shape: "polygon",
      curved: false,
      points: [
        { x: 4, y: 6 },
        { x: 10, y: 6 },
        { x: 10, y: 12 },
        { x: 4, y: 12 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    const lakeB: WaterRegion = {
      id: "lake-b",
      kind: "water",
      presetId: "alpine_lake",
      shape: "polygon",
      curved: false,
      points: [
        { x: 14, y: 6 },
        { x: 20, y: 6 },
        { x: 20, y: 12 },
        { x: 14, y: 12 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    const bridgeStroke = [
      { x: 9, y: 9 },
      { x: 15, y: 9 },
    ];
    expect(brushStrokeOverlapsWaterRegion(lakeA, bridgeStroke, 1.5)).toBe(true);
    expect(brushStrokeOverlapsWaterRegion(lakeB, bridgeStroke, 1.5)).toBe(true);

    const merged = unionWaterRegionsWithBrush(
      [lakeA, lakeB],
      bridgeStroke,
      1.5,
      0.1,
      12,
    );
    expect(merged.length).toBe(1);
    expect(hasSelfIntersection(merged[0].points)).toBe(false);

    const unified: WaterRegion = {
      ...lakeA,
      curved: true,
      points: merged[0].points,
      cutouts: merged[0].cutouts,
    };
    expect(pointInWaterRegion({ x: 6, y: 9 }, unified)).toBe(true);
    expect(pointInWaterRegion({ x: 12, y: 9 }, unified)).toBe(true);
    expect(pointInWaterRegion({ x: 18, y: 9 }, unified)).toBe(true);
  });

  it("carves interior islands, merges overlapping island strokes without XOR flips, and trims outer shores cleanly", () => {
    const lake: WaterRegion = {
      id: "lake-sculpt",
      kind: "water",
      shape: "polygon",
      curved: false,
      points: [
        { x: 6, y: 6 },
        { x: 22, y: 6 },
        { x: 22, y: 18 },
        { x: 6, y: 18 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.95,
    };

    // 1. First interior island punch
    const firstCarve = subtractBrushFromWaterRegion(
      lake,
      [{ x: 12, y: 12 }],
      1.8,
      0.1,
      5,
    );
    expect(firstCarve.changed).toBe(true);
    expect(firstCarve.shapes.length).toBe(1);
    expect(firstCarve.shapes[0].cutouts.length).toBe(1);

    const afterFirst: WaterRegion = {
      ...lake,
      curved: true,
      points: firstCarve.shapes[0].points,
      cutouts: firstCarve.shapes[0].cutouts,
    };
    expect(pointInWaterRegion({ x: 12, y: 12 }, afterFirst)).toBe(false);

    // 2. Overlapping second island punch -> MUST stay 1 merged dry island, never XOR back to water!
    const secondCarve = subtractBrushFromWaterRegion(
      afterFirst,
      [{ x: 14, y: 12 }],
      1.8,
      0.1,
      9,
    );
    expect(secondCarve.changed).toBe(true);
    expect(secondCarve.shapes.length).toBe(1);
    expect(secondCarve.shapes[0].cutouts.length).toBe(1);

    const afterSecond: WaterRegion = {
      ...lake,
      curved: true,
      points: secondCarve.shapes[0].points,
      cutouts: secondCarve.shapes[0].cutouts,
    };
    expect(pointInWaterRegion({ x: 12, y: 12 }, afterSecond)).toBe(false);
    expect(pointInWaterRegion({ x: 13, y: 12 }, afterSecond)).toBe(false);
    expect(pointInWaterRegion({ x: 14, y: 12 }, afterSecond)).toBe(false);

    // 3. Erase overlapping outside shoreline -> recesses shore cleanly, NEVER turns dry exterior into water!
    const shoreTrim = subtractBrushFromWaterRegion(
      afterSecond,
      [
        { x: 5.5, y: 12 },
        { x: 8.5, y: 12 },
      ],
      1.6,
      0.08,
      15,
    );
    expect(shoreTrim.changed).toBe(true);
    expect(shoreTrim.shapes.length).toBe(1);
    const trimmedRegion: WaterRegion = {
      ...lake,
      curved: true,
      points: shoreTrim.shapes[0].points,
      cutouts: shoreTrim.shapes[0].cutouts,
    };
    // Dry land outside west shore stayed dry, AND carved bay became dry
    expect(pointInWaterRegion({ x: 4, y: 12 }, trimmedRegion)).toBe(false);
    expect(pointInWaterRegion({ x: 7.5, y: 12 }, trimmedRegion)).toBe(false);
    // Remaining north/south basin still submerged
    expect(pointInWaterRegion({ x: 10, y: 8 }, trimmedRegion)).toBe(true);
  });

  it("splits a lake into 2 bodies when bisected and removes a tiny pond completely when erased", () => {
    const rectLake: WaterRegion = {
      id: "split-lake",
      kind: "water",
      shape: "polygon",
      curved: false,
      points: [
        { x: 6, y: 8 },
        { x: 18, y: 8 },
        { x: 18, y: 14 },
        { x: 6, y: 14 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    const split = subtractBrushFromWaterRegion(
      rectLake,
      [
        { x: 12, y: 5 },
        { x: 12, y: 17 },
      ],
      1.5,
      0,
      3,
    );
    expect(split.changed).toBe(true);
    expect(split.shapes.length).toBe(2);

    const tinyPond: WaterRegion = {
      id: "tiny-pond",
      kind: "water",
      shape: "polygon",
      curved: false,
      points: [
        { x: 10, y: 10 },
        { x: 12, y: 10 },
        { x: 12, y: 12 },
        { x: 10, y: 12 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    const erasedAll = subtractBrushFromWaterRegion(
      tinyPond,
      [{ x: 11, y: 11 }],
      3.0,
      0,
      1,
    );
    expect(erasedAll.changed).toBe(true);
    expect(erasedAll.shapes.length).toBe(0);
  });

  it("preserves map-overflow border anchor coordinates when sculpting open coastline lakes", () => {
    const openLake: WaterRegion = {
      id: "open-coast",
      kind: "water",
      shape: "polygon",
      curved: false,
      points: [
        { x: 30, y: 2 },
        { x: 49.5, y: 2 },
        { x: 49.5, y: 28.5 },
        { x: 30, y: 28.5 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    const sculpted = unionWaterRegionsWithBrush(
      [openLake],
      [
        { x: 28, y: 12 },
        { x: 32, y: 12 },
      ],
      1.5,
      0.1,
      44,
      48,
      27,
    );
    expect(sculpted.length).toBe(1);
    const maxX = Math.max(...sculpted[0].points.map((p) => p.x));
    const maxY = Math.max(...sculpted[0].points.map((p) => p.y));
    expect(maxX).toBeGreaterThanOrEqual(49.25);
    expect(maxY).toBeGreaterThanOrEqual(28.25);
  });

  it("prevents trapped thin horizontal dry sliver holes when erasing and repainting along a shoreline", () => {
    const doc = createHiddenSloopMap();
    const wl = doc.layers.find((l) => l.id === "hs-layer-lake-water")!;
    const main = wl.waterRegions!.find((r) => r.id === "hs-water-tarn-main")!;

    const erased = subtractBrushFromWaterRegion(
      main,
      [
        { x: 36, y: 6 },
        { x: 41, y: 6 },
      ],
      3.2,
      0.28,
      200,
      48,
      27,
    );
    expect(erased.changed).toBe(true);
    expect(erased.shapes.length).toBeGreaterThanOrEqual(1);

    const afterErase: WaterRegion = {
      ...main,
      points: erased.shapes[0].points,
      cutouts: erased.shapes[0].cutouts,
      curved: true,
      organicRoughness: 0,
    };
    const repainted = unionWaterRegionsWithBrush(
      [afterErase],
      [
        { x: 42, y: 6 },
        { x: 30, y: 6 },
      ],
      3.2,
      0.28,
      300,
      48,
      27,
    );
    expect(repainted.length).toBe(1);
    // Zero thin horizontal dry slits (< 0.45 height) trapped along the north shore!
    for (const hole of repainted[0].cutouts) {
      const h = Math.max(...hole.map((p) => p.y)) - Math.min(...hole.map((p) => p.y));
      const w = Math.max(...hole.map((p) => p.x)) - Math.min(...hole.map((p) => p.x));
      expect(Math.min(w, h)).toBeGreaterThan(0.45);
    }
  });

  it("deletes degenerate ultra-thin (< 1 subcell) water slivers instead of leaving un-erasable ghosts", () => {
    const ghostSliver: WaterRegion = {
      id: "ghost-sliver",
      kind: "water",
      shape: "polygon",
      curved: false,
      points: [
        { x: 2, y: 2.71 },
        { x: 14, y: 2.71 },
        { x: 14, y: 2.77 },
        { x: 2, y: 2.77 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    const res = subtractBrushFromWaterRegion(
      ghostSliver,
      [{ x: 6, y: 2.74 }],
      2.5,
      0.2,
      11,
      48,
      27,
    );
    expect(res.changed).toBe(true);
    expect(res.shapes.length).toBe(0);
  });

  it("returns split water shapes sorted largest-area-first and supports zero-erosion LiveWaterSculptSession drags", () => {
    const asymLake: WaterRegion = {
      id: "asym-lake",
      kind: "water",
      presetId: "alpine_lake",
      shape: "polygon",
      curved: false,
      points: [
        { x: 4, y: 6 },
        { x: 26, y: 6 },
        { x: 26, y: 16 },
        { x: 4, y: 16 },
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };

    // Slice off a small left lobe (x=4..7) from a big right basin (x=10..26) -> shapes[0] MUST be the big basin!
    const split = subtractBrushFromWaterRegion(
      asymLake,
      [
        { x: 8.5, y: 4 },
        { x: 8.5, y: 18 },
      ],
      1.3,
      0,
      7,
      48,
      27,
    );
    expect(split.shapes.length).toBe(2);
    const maxX0 = Math.max(...split.shapes[0].points.map((p) => p.x));
    const maxX1 = Math.max(...split.shapes[1].points.map((p) => p.x));
    expect(maxX0).toBeGreaterThan(maxX1);

    // LiveWaterSculptSession incremental paint & erase
    const paintSess = createLiveWaterSculptSession({
      mode: "paint",
      radiusCells: 1.8,
      organicRoughness: 0.15,
      seed: 99,
      canvasW: 48,
      canvasH: 27,
      layers: [{ id: "lyr-w", waterRegions: [asymLake] }],
      paintLayerId: "lyr-w",
      paintStyle: {
        kind: "water",
        presetId: "alpine_lake",
        textureAssetId: "modular-suite/terrain/water_alpine_crystal.png",
        deepColorHex: "#0B3D5E",
        shallowColorHex: "#2799B8",
        rimColorHex: "#E6FAFF",
        opacity: 0.94,
        rippleIntensity: 0.72,
        causticsIntensity: 0.62,
        depthFeather: 0.65,
        shoreBankIntensity: 0.55,
      },
    });
    const s1 = stepLiveWaterSculptSession(paintSess, [{ x: 25, y: 11 }]);
    expect(s1.changed).toBe(true);
    const s2 = stepLiveWaterSculptSession(paintSess, [{ x: 29, y: 11 }]);
    expect(s2.changed).toBe(true);
    const paintedRegs = s2.updates.get("lyr-w")!;
    expect(paintedRegs.length).toBe(1);
    expect(pointInWaterRegion({ x: 29, y: 11 }, paintedRegs[0])).toBe(true);
    expect(pointInWaterRegion({ x: 8, y: 11 }, paintedRegs[0])).toBe(true);
  });

  it("meshes multi-biome regions into one shared shoreline via computeUnifiedWaterLayerOutline and carves cross-biome paint cleanly", () => {
    const alpine: WaterRegion = {
      id: "w-alpine",
      kind: "water",
      presetId: "alpine_lake",
      shape: "polygon",
      curved: false,
      points: [
        { x: 6, y: 6 },
        { x: 20, y: 6 },
        { x: 20, y: 18 },
        { x: 6, y: 18 },
      ],
      cutouts: [
        [
          { x: 10, y: 10 },
          { x: 14, y: 10 },
          { x: 14, y: 14 },
          { x: 10, y: 14 },
        ],
      ],
      deepColorHex: "#0B3D5E",
      rimColorHex: "#E6FAFF",
      opacity: 0.94,
    };
    const tropical: WaterRegion = {
      id: "w-tropical",
      kind: "water",
      presetId: "tropical_lagoon",
      shape: "polygon",
      curved: false,
      points: [
        { x: 18, y: 14 },
        { x: 28, y: 14 },
        { x: 28, y: 22 },
        { x: 18, y: 22 },
      ],
      deepColorHex: "#086A87",
      rimColorHex: "#F0FDFA",
      opacity: 0.92,
    };

    // 1. Unified outline merges both overlapping biomes into ONE shared outer shoreline while preserving the untouched island
    const unified = computeUnifiedWaterLayerOutline([alpine, tropical], 48, 27);
    expect(unified.length).toBe(1);
    expect(unified[0].holes.length).toBe(1);

    // 2. Painting Tropical Lagoon onto Alpine Lake with meshSameLayer=true carves the painted footprint out of Alpine
    const sess = createLiveWaterSculptSession({
      mode: "paint",
      meshSameLayer: true,
      radiusCells: 2.2,
      organicRoughness: 0.1,
      seed: 55,
      canvasW: 48,
      canvasH: 27,
      layers: [{ id: "lyr-w", waterRegions: [alpine] }],
      paintLayerId: "lyr-w",
      paintStyle: {
        kind: "water",
        presetId: "tropical_lagoon",
        textureAssetId: "modular-suite/terrain/water_tropical_lagoon.png",
        deepColorHex: "#086A87",
        shallowColorHex: "#2DD4BF",
        rimColorHex: "#F0FDFA",
        opacity: 0.92,
        rippleIntensity: 0.68,
        causticsIntensity: 0.84,
        depthFeather: 0.78,
        shoreBankIntensity: 0.45,
      },
    });
    const res = stepLiveWaterSculptSession(sess, [
      { x: 18, y: 16 },
      { x: 23, y: 16 },
    ]);
    expect(res.changed).toBe(true);
    const updated = res.updates.get("lyr-w")!;
    expect(updated.length).toBe(2);
    const carvedAlpine = updated.find((r) => r.presetId === "alpine_lake")!;
    const addedTropical = updated.find((r) => r.presetId === "tropical_lagoon")!;
    // Alpine was cleanly carved where Tropical was painted, while untouched Alpine stays submerged!
    expect(pointInWaterRegion({ x: 8, y: 8 }, carvedAlpine)).toBe(true);
    expect(pointInWaterRegion({ x: 18, y: 16 }, carvedAlpine)).toBe(false);
    expect(pointInWaterRegion({ x: 18, y: 16 }, addedTropical)).toBe(true);
    expect(pointInWaterRegion({ x: 23, y: 16 }, addedTropical)).toBe(true);
  });
});

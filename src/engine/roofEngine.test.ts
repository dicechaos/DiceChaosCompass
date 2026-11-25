import { describe, expect, it } from "vitest";
import { createBlankMap } from "@/data/funicularShowcaseMap";
import {
  buildBoxRoofParams,
  computeAutoRoomRoof,
  computeRoofGeometry,
  getRoofWidthHandles,
  pointInRoof,
  ROOF_MATERIAL_PRESETS,
} from "@/engine/roofEngine";
import type { RoofStructure } from "@/types/map";

function makeBaseRoof(overrides: Partial<RoofStructure> = {}): RoofStructure {
  return {
    id: "rf-test",
    style: "gable",
    assetId: "modular-suite/terrain/roof_terracotta_barrel_tiles.png",
    points: [
      { x: 4, y: 8 },
      { x: 14, y: 8 },
    ],
    widthCells: 6,
    curved: false,
    flipSlope: false,
    sunAngleDeg: 225,
    slopeShade: 0.55,
    ridgeCapStyle: "matching",
    ridgeCapWidthCells: 0.28,
    eaveTrim: true,
    dropShadow: 0.6,
    shadowDistanceCells: 0.45,
    textureScale: 1,
    weathering: 0.25,
    opacity: 1,
    ...overrides,
  };
}

describe("roofEngine", () => {
  it("provides 10 distinct hand-inked roof material presets pointing to new seamless roof PNGs", () => {
    expect(ROOF_MATERIAL_PRESETS.length).toBe(10);
    const ids = new Set(ROOF_MATERIAL_PRESETS.map((p) => p.assetId));
    expect(ids.size).toBe(10);
    for (const p of ROOF_MATERIAL_PRESETS) {
      expect(p.assetId).toMatch(/^modular-suite\/terrain\/roof_.+\.png$/);
    }
  });

  it("computes gable, L-bent gable, hip, square pyramid hip, shed, mansard, and cone geometry cleanly", () => {
    // 1. Straight Gable: 2 opposing slope facets + 1 main ridge
    const gable = computeRoofGeometry(makeBaseRoof({ style: "gable" }));
    expect(gable.facets.length).toBe(2);
    expect(gable.footprint.length).toBe(4);
    expect(gable.ridgeLines.some((r) => r.isMainRidge)).toBe(true);
    // Downhill vectors on opposite sides of the horizontal ridge should oppose along Y
    expect(gable.facets[0].downhillDir.y * gable.facets[1].downhillDir.y).toBeLessThan(-0.9);

    // 2. L-shaped Bent Gable: mitered outer/inner corners + diagonal hip/valley seam
    const lGable = computeRoofGeometry(
      makeBaseRoof({
        style: "gable",
        points: [
          { x: 4, y: 8 },
          { x: 12, y: 8 },
          { x: 12, y: 16 },
        ],
      }),
    );
    expect(lGable.facets.length).toBe(4);
    expect(lGable.ridgeLines.length).toBeGreaterThanOrEqual(2);

    // 3. Hip roof: 2 side trapezoids + 2 end hip triangles = 4 facets + 4 diagonal hips + 1 ridge
    const hip = computeRoofGeometry(makeBaseRoof({ style: "hip", hipInsetRatio: 0.5 }));
    expect(hip.facets.length).toBe(4);
    expect(hip.ridgeLines.length).toBe(5);

    // 4. Square Hip roof degenerates cleanly to a 4-sided pyramid meeting at a single apex
    const pyramid = computeRoofGeometry(
      makeBaseRoof({
        style: "hip",
        points: [
          { x: 6, y: 6 },
          { x: 10, y: 6 },
        ],
        widthCells: 4,
        hipInsetRatio: 1.0,
      }),
    );
    expect(pyramid.facets.length).toBe(4);
    expect(pyramid.finialCenter).toBeDefined();

    // 5. Shed single-slope lean-to flips downhill vector cleanly when flipSlope toggles
    const shedR = computeRoofGeometry(makeBaseRoof({ style: "shed", flipSlope: false }));
    const shedL = computeRoofGeometry(makeBaseRoof({ style: "shed", flipSlope: true }));
    expect(shedR.facets.length).toBe(1);
    expect(shedL.facets.length).toBe(1);
    expect(shedR.facets[0].downhillDir.y * shedL.facets[0].downhillDir.y).toBeLessThan(-0.9);

    // 6. Mansard roof: 4 sloped skirts + 1 central flat crown
    const mansard = computeRoofGeometry(makeBaseRoof({ style: "mansard", mansardCrownRatio: 0.45 }));
    expect(mansard.facets.length).toBe(5);
    expect(mansard.facets.filter((f) => f.isFlatCrown).length).toBe(1);

    // 7. Cone / Turret: round (16 wedges) & octagonal (8 facets) + apex finial
    const coneRound = computeRoofGeometry(
      makeBaseRoof({
        style: "cone",
        points: [
          { x: 10, y: 10 },
          { x: 14, y: 10 },
        ],
        coneFacets: 0,
      }),
    );
    expect(coneRound.facets.length).toBe(16);
    expect(coneRound.finialCenter).toEqual({ x: 10, y: 10 });

    const coneOct = computeRoofGeometry(
      makeBaseRoof({
        style: "cone",
        points: [
          { x: 10, y: 10 },
          { x: 14, y: 10 },
        ],
        coneFacets: 8,
      }),
    );
    expect(coneOct.facets.length).toBe(8);
  });

  it("builds oriented box roof params with overhang and 90-degree ridge rotation", () => {
    const horiz = buildBoxRoofParams({ x: 2, y: 4 }, { x: 12, y: 8 }, 0.5, false);
    expect(horiz).not.toBeNull();
    // Longer X axis (10 sq) -> horizontal ridge spanning 1.5 .. 12.5, width = 4 + 1 = 5
    expect(horiz!.points[0].x).toBeCloseTo(1.5, 4);
    expect(horiz!.points[1].x).toBeCloseTo(12.5, 4);
    expect(horiz!.widthCells).toBeCloseTo(5, 4);

    // Rotating ridge 90 degrees switches to vertical spine spanning 3.5 .. 8.5, width = 10 + 1 = 11
    const rot = buildBoxRoofParams({ x: 2, y: 4 }, { x: 12, y: 8 }, 0.5, true);
    expect(rot).not.toBeNull();
    expect(rot!.points[0].y).toBeCloseTo(3.5, 4);
    expect(rot!.points[1].y).toBeCloseTo(8.5, 4);
    expect(rot!.widthCells).toBeCloseTo(11, 4);
  });

  it("auto-roofs enclosed walled rooms on 1F and also detects 1F walls when working on the ROOF level", () => {
    const doc = createBlankMap();
    const wallLayer = doc.layers.find((l) => l.kind === "walls")!;
    wallLayer.walls = [
      {
        id: "w-house",
        assetId: "walls/grunderzeit_brick_wall.png",
        points: [
          { x: 6, y: 6 },
          { x: 14, y: 6 },
          { x: 14, y: 12 },
          { x: 6, y: 12 },
        ],
        closed: true,
        curved: false,
        thicknessCells: 0.28,
        blocksLight: true,
      },
    ];

    // Inside room on 1F -> wraps ~8x6 room + 0.5 overhang => ~9x7
    const fit1F = computeAutoRoomRoof(doc, { x: 10, y: 9 }, 0.5);
    expect(fit1F).not.toBeNull();
    expect(fit1F!.widthCells).toBeGreaterThan(6);
    expect(fit1F!.areaSq).toBeGreaterThan(30);

    // Outside room -> returns null (not enclosed by walls)
    expect(computeAutoRoomRoof(doc, { x: 2, y: 2 }, 0.5)).toBeNull();

    // Switch active level to ROOF (which has no walls of its own) -> detects 1F walls beneath!
    doc.activeLevelId = "lvl-roofs";
    const fitRoofLevel = computeAutoRoomRoof(doc, { x: 10, y: 9 }, 0.5);
    expect(fitRoofLevel).not.toBeNull();
    expect(fitRoofLevel!.widthCells).toBeCloseTo(fit1F!.widthCells, 2);
  });

  it("hit-tests roof footprints and computes interactive eave-span width handles", () => {
    const rf = makeBaseRoof({ widthCells: 6 });
    expect(pointInRoof({ x: 9, y: 8 }, rf)).toBe(true);
    expect(pointInRoof({ x: 9, y: 10.5 }, rf)).toBe(true);
    expect(pointInRoof({ x: 9, y: 14 }, rf)).toBe(false);

    const handles = getRoofWidthHandles(rf);
    expect(handles.length).toBe(2);
    expect(Math.abs(handles[0].pos.y - 8)).toBeCloseTo(3, 3);
    expect(Math.abs(handles[1].pos.y - 8)).toBeCloseTo(3, 3);

    const shedHandles = getRoofWidthHandles(makeBaseRoof({ style: "shed", widthCells: 5 }));
    expect(shedHandles.length).toBe(1);
    expect(Math.abs(shedHandles[0].pos.y - 8)).toBeCloseTo(5, 3);
  });
});

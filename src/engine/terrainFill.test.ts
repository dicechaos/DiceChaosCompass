import { describe, expect, it } from "vitest";
import {
  buildWallBarrierGrid,
  computeSmartFloodFill,
  makeClosedWallPolygon,
  makeRectPolygon,
} from "@/engine/terrainFill";
import type { WallSegment } from "@/types/map";

function makeWall(
  id: string,
  points: Array<{ x: number; y: number }>,
  closed = true,
  curved = false,
): WallSegment {
  return {
    id,
    assetId: "walls/grunderzeit_brick_wall.png",
    points,
    closed,
    curved,
    thicknessCells: 0.34,
    blocksLight: true,
  };
}

describe("terrainFill smart wall flood fill & polygons", () => {
  it("fills inside a closed rectangular room and stops cleanly at its walls", () => {
    const room = makeWall("w1", [
      { x: 5, y: 5 },
      { x: 15, y: 5 },
      { x: 15, y: 12 },
      { x: 5, y: 12 },
    ]);
    const barrier = buildWallBarrierGrid([room], 30, 20, 4);
    const res = computeSmartFloodFill({ x: 10, y: 8 }, barrier);
    expect(res).not.toBeNull();
    expect(res!.boundedByWalls).toBe(true);
    expect(res!.holes.length).toBe(0);
    // 10 x 7 = 70 sq (minus thin centerline rasterization)
    expect(res!.areaSq).toBeGreaterThan(60);
    expect(res!.areaSq).toBeLessThan(75);
    // Simplified rectangle should stay lightweight
    expect(res!.outer.length).toBeLessThanOrEqual(8);
  });

  it("handles a building split into two rooms by an interior partition wall", () => {
    const outer = makeWall("w-outer", [
      { x: 4, y: 4 },
      { x: 16, y: 4 },
      { x: 16, y: 12 },
      { x: 4, y: 12 },
    ]);
    const divider = makeWall(
      "w-div",
      [
        { x: 10, y: 4 },
        { x: 10, y: 12 },
      ],
      false,
    );
    const barrier = buildWallBarrierGrid([outer, divider], 24, 18, 4);
    const leftRoom = computeSmartFloodFill({ x: 7, y: 8 }, barrier);
    const rightRoom = computeSmartFloodFill({ x: 13, y: 8 }, barrier);
    expect(leftRoom).not.toBeNull();
    expect(rightRoom).not.toBeNull();
    // Each half is 6 x 8 = 48 sq
    expect(leftRoom!.areaSq).toBeGreaterThan(40);
    expect(leftRoom!.areaSq).toBeLessThan(52);
    expect(rightRoom!.areaSq).toBeGreaterThan(40);
    expect(rightRoom!.areaSq).toBeLessThan(52);
    // Left fill must not leak past x = 10.5
    expect(Math.max(...leftRoom!.outer.map((p) => p.x))).toBeLessThanOrEqual(10.5);
  });

  it("flows around an enclosed building as a hole when filling the exterior yard", () => {
    const house = makeWall("w-house", [
      { x: 8, y: 6 },
      { x: 14, y: 6 },
      { x: 14, y: 12 },
      { x: 8, y: 12 },
    ]);
    const barrier = buildWallBarrierGrid([house], 24, 18, 4);
    const yard = computeSmartFloodFill({ x: 2, y: 2 }, barrier);
    expect(yard).not.toBeNull();
    expect(yard!.boundedByWalls).toBe(false);
    expect(yard!.holes.length).toBe(1);
    // Total 24*18 = 432 minus 6*6 = 36 house => ~396 sq
    expect(yard!.areaSq).toBeGreaterThan(370);
    expect(yard!.areaSq).toBeLessThan(410);
  });

  it("fills inside a curved circular turret room smoothly", () => {
    const turret = makeWall(
      "w-turret",
      [
        { x: 10, y: 4 },
        { x: 16, y: 10 },
        { x: 10, y: 16 },
        { x: 4, y: 10 },
      ],
      true,
      true,
    );
    const barrier = buildWallBarrierGrid([turret], 24, 20, 4);
    const res = computeSmartFloodFill({ x: 10, y: 10 }, barrier);
    expect(res).not.toBeNull();
    expect(res!.boundedByWalls).toBe(true);
    expect(res!.areaSq).toBeGreaterThan(80);
    expect(res!.areaSq).toBeLessThan(130);
  });

  it("constructs exact 4-point rectangles and closed wall polygons", () => {
    const rect = makeRectPolygon({ x: 12, y: 9 }, { x: 4, y: 3 });
    expect(rect).toEqual([
      { x: 4, y: 3 },
      { x: 12, y: 3 },
      { x: 12, y: 9 },
      { x: 4, y: 9 },
    ]);
    const curvedWall = makeWall(
      "w-c",
      [
        { x: 2, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 8 },
        { x: 2, y: 8 },
      ],
      true,
      true,
    );
    const poly = makeClosedWallPolygon(curvedWall);
    expect(poly.length).toBeGreaterThan(12);
  });
});

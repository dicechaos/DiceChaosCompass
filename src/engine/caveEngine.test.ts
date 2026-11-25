import { describe, expect, it } from "vitest";
import {
  computeCaveGeometry,
  createDefaultCaveSystem,
  snapEntranceToCavePerimeter,
} from "@/engine/caveEngine";

describe("caveEngine — Boolean Union, Interior Pillars, Entrance Cutting & Perimeter Snapping", () => {
  it("auto-merges two overlapping dungeon rooms into a single continuous perimeter (dissolving shared wall)", () => {
    const sys = createDefaultCaveSystem("stone_dungeon");
    sys.operations = [
      { id: "r1", kind: "rect", points: [{ x: 4, y: 4 }, { x: 10, y: 10 }], seed: 1 },
      { id: "r2", kind: "rect", points: [{ x: 8, y: 6 }, { x: 15, y: 12 }], seed: 2 },
    ];
    const geom = computeCaveGeometry(sys, 24, 18, "layer-cave");
    // Two overlapping rectangles merge into 1 outer floor loop and 1 closed wall loop!
    expect(geom.floorLoops).toHaveLength(1);
    expect(geom.wallSegments).toHaveLength(1);
    expect(geom.wallSegments[0].closed).toBe(true);
    expect(geom.wallSegments[0].blocksLight).toBe(true);
  });

  it("carves an interior rock pillar (hole) inside a chamber using erase_brush", () => {
    const sys = createDefaultCaveSystem("granite_cavern");
    sys.operations = [
      { id: "c1", kind: "rect", points: [{ x: 3, y: 3 }, { x: 17, y: 15 }], seed: 10 },
      {
        id: "e1",
        kind: "erase_brush",
        points: [{ x: 10, y: 9 }],
        radiusCells: 1.6,
        organicRoughness: 0.4,
        seed: 20,
      },
    ];
    const geom = computeCaveGeometry(sys, 24, 18, "layer-cave");
    // Outer cavern perimeter + inner carved rock pillar = 2 loops & 2 closed wall segments!
    expect(geom.floorLoops).toHaveLength(2);
    expect(geom.wallSegments).toHaveLength(2);
  });

  it("cuts a clean wall opening for an Entrance / Exit and builds an outward fade-to-terrain apron", () => {
    const sys = createDefaultCaveSystem("granite_cavern");
    sys.operations = [
      { id: "r1", kind: "rect", points: [{ x: 6, y: 5 }, { x: 16, y: 13 }], seed: 1 },
    ];
    const before = computeCaveGeometry(sys, 24, 18, "layer-cave");
    // Snap near the South wall (x=11, y=13.2) -> normal should point South (+PI/2)
    const snapped = snapEntranceToCavePerimeter({ x: 11, y: 13.2 }, before, 2.5);
    expect(snapped).not.toBeNull();
    expect(snapped!.y).toBeCloseTo(13, 0);
    expect(Math.sin(snapped!.normalRad)).toBeGreaterThan(0.8);

    const sysWithEntrance = {
      ...sys,
      entrances: [
        {
          id: "ent-1",
          x: snapped!.x,
          y: snapped!.y,
          normalRad: snapped!.normalRad,
          widthCells: 2.8,
          fadeLengthCells: 3.0,
          thresholdStyle: "rock_mouth" as const,
          markerLabel: "CAVE ENTRANCE",
          showMarker: true,
          markerDmOnly: false,
        },
      ],
    };
    const after = computeCaveGeometry(sysWithEntrance, 24, 18, "layer-cave");
    // The closed perimeter loop is now broken open into an open wall segment!
    expect(after.wallSegments.length).toBeGreaterThanOrEqual(1);
    expect(after.wallSegments.every((w) => w.closed === false)).toBe(true);
    expect(after.fadeAprons).toHaveLength(1);
    expect(after.fadeAprons[0].gradEnd.y).toBeGreaterThan(after.fadeAprons[0].gradStart.y + 2.0);
  });
});

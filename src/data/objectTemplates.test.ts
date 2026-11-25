import { describe, expect, it } from "vitest";
import { createHiddenSloopMap } from "@/data/hiddenSloopMap";
import {
  BUILTIN_OBJECT_TEMPLATES,
  buildTemplateFromObjects,
  expandTemplateAtPoint,
} from "@/data/objectTemplates";
import { DEFAULT_RECOLOR, type ObjectStamp } from "@/types/map";

describe("Object Templates & Hidden Cove Stolen Sloop Map", () => {
  it("provides curated premade object group templates with multiple items", () => {
    expect(BUILTIN_OBJECT_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    for (const tpl of BUILTIN_OBJECT_TEMPLATES) {
      expect(tpl.items.length).toBeGreaterThanOrEqual(3);
      expect(tpl.isBuiltIn).toBe(true);
    }
  });

  it("normalizes saved object groups around their bounding-box midpoint", () => {
    const objs: ObjectStamp[] = [
      {
        id: "a",
        assetId: "core-fantasy/hero/hero_campfire_lit.png",
        x: 10,
        y: 20,
        widthCells: 1.5,
        heightCells: 1.5,
        rotationRad: 0,
        flipX: false,
        flipY: false,
        opacity: 1,
        castsShadow: true,
        locked: false,
        recolor: { ...DEFAULT_RECOLOR },
        zOrder: 14,
      },
      {
        id: "b",
        assetId: "modular-suite/props/camp_travel/cmp_tied_bedroll.png",
        x: 14,
        y: 22,
        widthCells: 1.2,
        heightCells: 0.8,
        rotationRad: 0.5,
        flipX: false,
        flipY: false,
        opacity: 1,
        castsShadow: true,
        locked: false,
        recolor: { ...DEFAULT_RECOLOR },
        zOrder: 15,
      },
    ];
    const tpl = buildTemplateFromObjects(objs, "Test Camp");
    expect(tpl.name).toBe("Test Camp");
    expect(tpl.isBuiltIn).toBe(false);
    expect(tpl.items[0].dx).toBeCloseTo(-2, 3);
    expect(tpl.items[0].dy).toBeCloseTo(-1, 3);
    expect(tpl.items[1].dx).toBeCloseTo(2, 3);
    expect(tpl.items[1].dy).toBeCloseTo(1, 3);
  });

  it("rotates and scales expanded template items cleanly around the placement point", () => {
    const tpl = buildTemplateFromObjects(
      [
        {
          id: "left",
          assetId: "core-fantasy/objects/ale_barrel.png",
          x: 0,
          y: 0,
          widthCells: 1,
          heightCells: 1,
          rotationRad: 0,
          flipX: false,
          flipY: false,
          opacity: 1,
          castsShadow: true,
          locked: false,
          recolor: { ...DEFAULT_RECOLOR },
          zOrder: 14,
        },
        {
          id: "right",
          assetId: "core-fantasy/objects/wooden_crate.png",
          x: 4,
          y: 0,
          widthCells: 1,
          heightCells: 1,
          rotationRad: 0,
          flipX: false,
          flipY: false,
          opacity: 1,
          castsShadow: true,
          locked: false,
          recolor: { ...DEFAULT_RECOLOR },
          zOrder: 15,
        },
      ],
      "Pair",
    );
    // Midpoint is (2,0) so offsets are (-2,0) and (+2,0).
    // Rotate +90° (PI/2) and scale 1.5x around (10, 10) -> (10, 7) and (10, 13).
    const expanded = expandTemplateAtPoint(tpl, 10, 10, Math.PI / 2, 1.5, "test");
    expect(expanded[0].x).toBeCloseTo(10, 3);
    expect(expanded[0].y).toBeCloseTo(7, 3);
    expect(expanded[1].x).toBeCloseTo(10, 3);
    expect(expanded[1].y).toBeCloseTo(13, 3);
    expect(expanded[0].widthCells).toBeCloseTo(1.5, 3);
  });

  it("constructs the Hidden Cove & Stolen Magi-Punk Sloop map with 4 playable floors and 2 carved islets", () => {
    const doc = createHiddenSloopMap();
    expect(doc.levels.map((l) => l.shortCode)).toEqual(["B1", "1F", "2F", "ROOF"]);
    const waterLayer = doc.layers.find((l) => l.id === "hs-layer-lake-water");
    const mainTarn = waterLayer?.waterRegions?.find((r) => r.id === "hs-water-tarn-main");
    expect(mainTarn?.cutouts?.length).toBe(2);
    const objLayer = doc.layers.find((l) => l.id === "hs-layer-objects");
    expect((objLayer?.objects?.length ?? 0)).toBeGreaterThan(100);
  });
});

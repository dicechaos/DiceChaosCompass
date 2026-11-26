import { describe, expect, it } from "vitest";
import {
  buildFloorBarrierGrid,
  buildWallBarrierGrid,
  computeSmartFloodFill,
  hitTestTerrainAtPoint,
  isTerrainStrokeCoveredByFlood,
  makeClosedWallPolygon,
  makeRectPolygon,
  summarizeUsedTerrains,
} from "@/engine/terrainFill";
import { useDocumentStore } from "@/store/documentStore";
import type { TerrainStroke, WallSegment, WaterRegion } from "@/types/map";

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
    const barrier = buildWallBarrierGrid([room], 30, 20, 6);
    const res = computeSmartFloodFill({ x: 10, y: 8 }, barrier);
    expect(res).not.toBeNull();
    expect(res!.boundedByWalls).toBe(true);
    expect(res!.holes.length).toBe(0);
    expect(res!.areaSq).toBeGreaterThan(62);
    expect(res!.areaSq).toBeLessThan(74);
    expect(res!.outer.length).toBeLessThanOrEqual(8);
  });

  it("collapses 45-degree diagonal wall staircases into crisp lightweight contours", () => {
    const diamond = makeWall("w-diamond", [
      { x: 12, y: 4 },
      { x: 18, y: 10 },
      { x: 12, y: 16 },
      { x: 6, y: 10 },
    ]);
    const barrier = buildWallBarrierGrid([diamond], 24, 20, 6);
    const res = computeSmartFloodFill({ x: 12, y: 10 }, barrier);
    expect(res).not.toBeNull();
    expect(res!.boundedByWalls).toBe(true);
    // Smooth staircase collapse should produce a super clean polygon (~4-10 vertices, NOT 60+ jagged teeth!)
    expect(res!.outer.length).toBeLessThanOrEqual(12);
    expect(res!.areaSq).toBeGreaterThan(64);
    expect(res!.areaSq).toBeLessThan(80);
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
    const barrier = buildWallBarrierGrid([outer, divider], 24, 18, 6);
    const leftRoom = computeSmartFloodFill({ x: 7, y: 8 }, barrier);
    const rightRoom = computeSmartFloodFill({ x: 13, y: 8 }, barrier);
    expect(leftRoom).not.toBeNull();
    expect(rightRoom).not.toBeNull();
    expect(leftRoom!.areaSq).toBeGreaterThan(40);
    expect(leftRoom!.areaSq).toBeLessThan(52);
    expect(rightRoom!.areaSq).toBeGreaterThan(40);
    expect(rightRoom!.areaSq).toBeLessThan(52);
    expect(Math.max(...leftRoom!.outer.map((p) => p.x))).toBeLessThanOrEqual(10.5);
  });

  it("flows around an enclosed building as a hole when filling the exterior yard", () => {
    const house = makeWall("w-house", [
      { x: 8, y: 6 },
      { x: 14, y: 6 },
      { x: 14, y: 12 },
      { x: 8, y: 12 },
    ]);
    const barrier = buildWallBarrierGrid([house], 24, 18, 6);
    const yard = computeSmartFloodFill({ x: 2, y: 2 }, barrier);
    expect(yard).not.toBeNull();
    expect(yard!.boundedByWalls).toBe(false);
    expect(yard!.holes.length).toBe(1);
    expect(yard!.areaSq).toBeGreaterThan(375);
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
    const barrier = buildWallBarrierGrid([turret], 24, 20, 6);
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

  it("multi-barrier flood fill respects Water shorelines when enabled and ignores them when disabled", () => {
    const st = useDocumentStore.getState();
    st.newDocument("Barrier Test", 24, 16);
    const canal: WaterRegion = {
      id: "water-canal",
      kind: "water",
      shape: "polygon",
      points: [
        { x: 10, y: 0 },
        { x: 14, y: 0 },
        { x: 14, y: 16 },
        { x: 10, y: 16 },
      ],
      curved: false,
      deepColorHex: "#0B3B5E",
      rimColorHex: "#38BDF8",
      opacity: 0.9,
      organicRoughness: 0,
    };
    st.addWaterRegion(canal);
    const doc = useDocumentStore.getState().getActiveDoc();

    const withWater = buildFloorBarrierGrid(doc, doc.activeLevelId, {
      walls: true,
      caves: true,
      water: true,
    });
    const leftWithWater = computeSmartFloodFill({ x: 4, y: 8 }, withWater);
    expect(leftWithWater).not.toBeNull();
    // Stops cleanly at west bank x=10 (area ~ 10 * 16 = 160 sq)
    expect(Math.max(...leftWithWater!.outer.map((p) => p.x))).toBeLessThanOrEqual(10.5);

    const withoutWater = buildFloorBarrierGrid(doc, doc.activeLevelId, {
      walls: true,
      caves: true,
      water: false,
    });
    const allWithoutWater = computeSmartFloodFill({ x: 4, y: 8 }, withoutWater);
    expect(allWithoutWater!.areaSq).toBeGreaterThan(350);
  });

  it("hitTestTerrainAtPoint respects stroke z-order, layer-scoped erase cutouts, and transparent 1F base", () => {
    const st = useDocumentStore.getState();
    st.newDocument("Hit Test Map", 20, 16);
    st.setBaseTerrainAsset("terrain/berlin_wet_cobble.png");

    // Bare base hit
    let doc = useDocumentStore.getState().getActiveDoc();
    const baseHit = hitTestTerrainAtPoint({ x: 10, y: 8 }, doc, doc.activeLevelId);
    expect(baseHit?.kind).toBe("base");
    expect(baseHit?.assetId).toBe("terrain/berlin_wet_cobble.png");

    // Paint a wooden floor polygon from (4,4) to (12,12)
    st.addTerrainStroke({
      id: "wood-1",
      assetId: "terrain/herringbone_parquet.png",
      points: makeRectPolygon({ x: 4, y: 4 }, { x: 12, y: 12 }),
      radiusCells: 0,
      opacity: 1,
      softness: 0,
      shape: "polygon",
    });
    doc = useDocumentStore.getState().getActiveDoc();
    const woodHit = hitTestTerrainAtPoint({ x: 8, y: 8 }, doc, doc.activeLevelId);
    expect(woodHit?.kind).toBe("stroke");
    expect(woodHit?.assetId).toBe("terrain/herringbone_parquet.png");

    // Erase a cutout hole from (6,6) to (10,10) -> center falls through cleanly to 1F base!
    st.addTerrainStroke({
      id: "erase-1",
      assetId: "terrain/herringbone_parquet.png",
      points: makeRectPolygon({ x: 6, y: 6 }, { x: 10, y: 10 }),
      radiusCells: 0,
      opacity: 1,
      softness: 0,
      shape: "polygon",
      erase: true,
    });
    doc = useDocumentStore.getState().getActiveDoc();
    const holeHit = hitTestTerrainAtPoint({ x: 8, y: 8 }, doc, doc.activeLevelId);
    expect(holeHit?.kind).toBe("base");
    // Rim at (5,5) is still wood!
    const rimHit = hitTestTerrainAtPoint({ x: 5, y: 5 }, doc, doc.activeLevelId);
    expect(rimHit?.kind).toBe("stroke");

    // Enable Transparent Void on 1F -> cutout hole now returns null (pure alpha void)!
    st.setBaseTerrainTransparent(true);
    doc = useDocumentStore.getState().getActiveDoc();
    expect(hitTestTerrainAtPoint({ x: 8, y: 8 }, doc, doc.activeLevelId)).toBeNull();
  });

  it("store Replace, Clean Flood Prune, Bulk Layer/Floor Swap & Wall Auto-Refit work end-to-end", () => {
    const st = useDocumentStore.getState();
    st.newDocument("Replace & Auto-Refit", 24, 18);
    st.setBaseTerrainAsset("terrain/berlin_wet_cobble.png");

    // Add a closed brick wall room and fill it via fillWallInterior (links sourceWallId!)
    const roomWall = makeWall("w-room-1", [
      { x: 4, y: 4 },
      { x: 12, y: 4 },
      { x: 12, y: 10 },
      { x: 4, y: 10 },
    ]);
    st.addWall(roomWall);
    let doc = useDocumentStore.getState().getActiveDoc();
    const wallLayer = doc.layers.find((l) => l.walls?.some((w) => w.id === "w-room-1"))!;
    expect(st.fillWallInterior(wallLayer.id, "w-room-1", "terrain/herringbone_parquet.png")).toBe(true);

    // Curve section #0 of that wall outward -> linked floor must auto-refit to include bowed apex!
    st.setEntitySegmentCurve({ kind: "wall", layerId: wallLayer.id, id: "w-room-1" }, 0, -2.5, true);
    doc = useDocumentStore.getState().getActiveDoc();
    const terrainLayer = doc.layers.find((l) => l.kind === "terrain" && l.levelId === doc.activeLevelId)!;
    const linkedFill = terrainLayer.terrainStrokes!.find((s) => s.sourceWallId === "w-room-1")!;
    expect(linkedFill).toBeDefined();
    expect(Math.min(...linkedFill.points.map((p) => p.y))).toBeCloseTo(1.5, 1);

    // Re-filling the same room replaces the linked stroke in place (NO duplicate stack!)
    st.fillWallInterior(wallLayer.id, "w-room-1", "terrain/alpine_slate_rock.png");
    doc = useDocumentStore.getState().getActiveDoc();
    const tLayer2 = doc.layers.find((l) => l.id === terrainLayer.id)!;
    expect(tLayer2.terrainStrokes!.filter((s) => s.sourceWallId === "w-room-1")).toHaveLength(1);
    expect(tLayer2.terrainStrokes![0].assetId).toBe("terrain/alpine_slate_rock.png");

    // Replace stroke preserving rotation/style by default
    st.replaceTerrainStroke(tLayer2.id, tLayer2.terrainStrokes![0].id, "terrain/herringbone_parquet.png", false);
    doc = useDocumentStore.getState().getActiveDoc();
    expect(
      doc.layers.find((l) => l.id === tLayer2.id)!.terrainStrokes![0].assetId,
    ).toBe("terrain/herringbone_parquet.png");

    // Used terrains summary includes both parquet & 1F base
    const used = summarizeUsedTerrains(doc, doc.activeLevelId);
    expect(used.some((u) => u.assetId === "terrain/herringbone_parquet.png" && u.count === 1)).toBe(true);
    expect(used.some((u) => u.assetId === "terrain/berlin_wet_cobble.png" && u.isBase)).toBe(true);

    // Replace all terrain on floor (re-skins existing stroke + 1F base!)
    const swapped = st.replaceAllTerrainOnScope("terrain/alpine_slate_rock.png", "floor", false);
    expect(swapped).toBe(2);
    doc = useDocumentStore.getState().getActiveDoc();
    expect(doc.canvas.baseTerrainAssetId).toBe("terrain/alpine_slate_rock.png");
    expect(doc.layers.find((l) => l.id === tLayer2.id)!.terrainStrokes![0].assetId).toBe(
      "terrain/alpine_slate_rock.png",
    );

    // Prune buried room strokes during Smart Flood Fill
    const tinyPatch: TerrainStroke = {
      id: "tiny-inner",
      assetId: "terrain/herringbone_parquet.png",
      points: makeRectPolygon({ x: 6, y: 6 }, { x: 8, y: 8 }),
      radiusCells: 0,
      opacity: 1,
      softness: 0,
      shape: "polygon",
    };
    const bigBox = makeRectPolygon({ x: 4, y: 4 }, { x: 12, y: 10 });
    expect(isTerrainStrokeCoveredByFlood(tinyPatch, bigBox, [])).toBe(true);
    st.addTerrainStroke(tinyPatch);
    st.addTerrainStroke(
      {
        id: "big-replace",
        assetId: "terrain/berlin_wet_cobble.png",
        points: bigBox,
        radiusCells: 0,
        opacity: 1,
        softness: 0,
        shape: "polygon",
      },
      { pruneContained: true },
    );
    doc = useDocumentStore.getState().getActiveDoc();
    const afterPrune = doc.layers.find((l) => l.id === tLayer2.id)!.terrainStrokes!;
    expect(afterPrune.some((s) => s.id === "tiny-inner")).toBe(false);
    expect(afterPrune.some((s) => s.id === "big-replace")).toBe(true);

    // Clear layer cleanly & undo restores it!
    const cleared = st.clearTerrainLayer(tLayer2.id);
    expect(cleared).toBeGreaterThan(0);
    expect(
      useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === tLayer2.id)!.terrainStrokes,
    ).toHaveLength(0);
    st.undo();
    expect(
      useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === tLayer2.id)!.terrainStrokes!.length,
    ).toBeGreaterThan(0);
  });
});

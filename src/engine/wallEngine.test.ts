import { describe, expect, it } from "vitest";
import {
  computeDefaultWallEdgeBulge,
  convertLegacyWallCurveToSegments,
  cutWallSegmentsForPortals,
  distanceToWall,
  extractLightOccluders,
  findNearestWallSnap,
  insertWallVertexWithCurves,
  removeWallVertexWithCurves,
  sampleWallPoints,
} from "./geometry";
import { makeClosedWallPolygon } from "./terrainFill";
import {
  buildBoxWallPoints,
  buildCircleOrPolygonWallPoints,
  buildCorridorWalls,
  buildThreePointArcWallPoints,
  carveWallBreachAtArcLength,
  constrainAngle45Deg,
  findWallCutHit,
  findWallSnapTarget,
  splitWallAtArcLength,
} from "./wallEngine";
import { useDocumentStore } from "@/store/documentStore";
import type { MapLayer, PortalNode, WallSegment } from "@/types/map";

describe("Wall Geometry Engine (wallEngine)", () => {
  it("builds axis-aligned, square-locked, center-out, and rotated Box Room polygons cleanly", () => {
    // Corner-to-corner 6 x 4 room
    const box = buildBoxWallPoints({ x: 2, y: 3 }, { x: 8, y: 7 })!;
    expect(box).not.toBeNull();
    expect(box.points).toHaveLength(4);
    expect(box.width).toBeCloseTo(6, 3);
    expect(box.height).toBeCloseTo(4, 3);
    expect(box.center).toEqual({ x: 5, y: 5 });

    // Tiny degenerate click returns null
    expect(buildBoxWallPoints({ x: 5, y: 5 }, { x: 5.1, y: 5.1 })).toBeNull();

    // Square lock forces width === height
    const sq = buildBoxWallPoints({ x: 0, y: 0 }, { x: 6, y: 2 }, { square: true })!;
    expect(sq.width).toBeCloseTo(6, 3);
    expect(sq.height).toBeCloseTo(6, 3);

    // Center-out doubles half-extents around start point
    const centered = buildBoxWallPoints(
      { x: 10, y: 10 },
      { x: 13, y: 12 },
      { fromCenter: true },
    )!;
    expect(centered.center).toEqual({ x: 10, y: 10 });
    expect(centered.width).toBeCloseTo(6, 3);
    expect(centered.height).toBeCloseTo(4, 3);

    // 45-degree rotated box preserves exact side lengths & right angles
    const rot = buildBoxWallPoints({ x: 0, y: 0 }, { x: 4, y: 4 }, { rotationDeg: 45 })!;
    expect(rot).toBeNull(); // collinear along 45° axis -> dv = 0
    const rotValid = buildBoxWallPoints({ x: 0, y: 0 }, { x: 6, y: 0 }, { rotationDeg: 45 })!;
    expect(rotValid.points).toHaveLength(4);
    expect(rotValid.rotationDeg).toBe(45);
    expect(rotValid.width).toBeCloseTo(Math.SQRT2 * 3, 2);
    expect(rotValid.height).toBeCloseTo(Math.SQRT2 * 3, 2);
  });

  it("builds smooth Round, Oval, Hex (6), Octagon (8), and Dodecagon (12) tower walls", () => {
    const round = buildCircleOrPolygonWallPoints({ x: 10, y: 10 }, { x: 14, y: 10 }, "round")!;
    expect(round.curved).toBe(true);
    expect(round.points).toHaveLength(16);
    expect(round.radiusX).toBeCloseTo(4, 3);

    const oval = buildCircleOrPolygonWallPoints({ x: 10, y: 10 }, { x: 15, y: 13 }, "oval")!;
    expect(oval.curved).toBe(true);
    expect(oval.points).toHaveLength(16);
    expect(oval.radiusX).toBeCloseTo(5, 3);
    expect(oval.radiusY).toBeCloseTo(3, 3);

    const hex = buildCircleOrPolygonWallPoints({ x: 10, y: 10 }, { x: 13, y: 10 }, "hex")!;
    expect(hex.curved).toBe(false);
    expect(hex.points).toHaveLength(6);

    const oct = buildCircleOrPolygonWallPoints({ x: 10, y: 10 }, { x: 13, y: 10 }, "octagon")!;
    expect(oct.curved).toBe(false);
    expect(oct.points).toHaveLength(8);

    const dod = buildCircleOrPolygonWallPoints({ x: 10, y: 10 }, { x: 13, y: 10 }, "dodecagon")!;
    expect(dod.curved).toBe(false);
    expect(dod.points).toHaveLength(12);
  });

  it("builds exact 3-Point circular Arc walls including Shift 90° and 180° preset snaps", () => {
    // Exact semicircle through (0,0), (6,0) with sagitta = 3 -> R = 3, sweep = 180°
    const semi = buildThreePointArcWallPoints({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 3 })!;
    expect(semi.curved).toBe(true);
    expect(semi.radius).toBeCloseTo(3, 2);
    expect(semi.sweepDeg).toBe(180);
    expect(semi.points[0]).toEqual({ x: 0, y: 0 });
    expect(semi.points[semi.points.length - 1]).toEqual({ x: 6, y: 0 });
    // Every point sits on the circle of radius 3 centered at (3, 0)
    for (const p of semi.points) {
      expect(Math.hypot(p.x - 3, p.y - 0)).toBeCloseTo(3, 2);
    }

    // Shift preset snaps near-90° bulge cleanly to exact 90°
    const quarter = buildThreePointArcWallPoints(
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 3, y: 1.35 },
      { snapArcPreset: true },
    )!;
    expect(quarter.sweepDeg).toBe(90);

    // Nearly flat bulge collapses cleanly to straight 2-point wall
    const flat = buildThreePointArcWallPoints({ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 3, y: 0.02 })!;
    expect(flat.curved).toBe(false);
    expect(flat.points).toHaveLength(2);
    expect(flat.sweepDeg).toBe(0);
  });

  it("builds open parallel and sealed-cap Corridor hallway walls with interior floor polygon", () => {
    const lCenterline = [
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 8 },
    ];
    const openCorr = buildCorridorWalls(lCenterline, 2.0, { curved: false, capEnds: false })!;
    expect(openCorr.walls).toHaveLength(2);
    expect(openCorr.walls[0].closed).toBe(false);
    expect(openCorr.walls[1].closed).toBe(false);
    expect(openCorr.floorPolygon).toHaveLength(6);

    // Mitered L-corner maintains exact 2.0 sq perpendicular hallway width
    expect(Math.abs(openCorr.walls[0].points[0].y - openCorr.walls[1].points[0].y)).toBeCloseTo(2.0, 2);
    expect(Math.abs(openCorr.walls[0].points[2].x - openCorr.walls[1].points[2].x)).toBeCloseTo(2.0, 2);

    const sealedCorr = buildCorridorWalls(lCenterline, 2.0, { curved: false, capEnds: true })!;
    expect(sealedCorr.walls).toHaveLength(1);
    expect(sealedCorr.walls[0].closed).toBe(true);
    expect(sealedCorr.walls[0].points).toHaveLength(6);
  });

  it("constrains 45° angle lock and magnetically snaps to wall vertices ahead of mid-edges", () => {
    const locked = constrainAngle45Deg({ x: 4, y: 4 }, { x: 8, y: 4.5 });
    expect(locked.y).toBeCloseTo(4, 2);
    expect(locked.x).toBeGreaterThan(7.5);

    const wall: WallSegment = {
      id: "w1",
      assetId: "walls/stone.png",
      points: [
        { x: 2, y: 2 },
        { x: 10, y: 2 },
      ],
      closed: false,
      curved: false,
      thicknessCells: 0.4,
      blocksLight: true,
    };

    // Near vertex (2, 2) -> snaps to vertex
    const vHit = findWallSnapTarget({ x: 2.2, y: 2.15 }, [wall], 0.45)!;
    expect(vHit.kind).toBe("vertex");
    expect(vHit.point).toEqual({ x: 2, y: 2 });

    // Near middle of wall (6, 2.2) -> snaps onto edge at (6, 2)
    const eHit = findWallSnapTarget({ x: 6, y: 2.2 }, [wall], 0.45)!;
    expect(eHit.kind).toBe("edge");
    expect(eHit.point).toEqual({ x: 6, y: 2 });
  });

  it("splits and carves clean breaches out of both open walls and closed Box Rooms", () => {
    const openWall: WallSegment = {
      id: "w-open",
      assetId: "walls/stone.png",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      closed: false,
      curved: false,
      thicknessCells: 0.4,
      blocksLight: true,
    };

    // Split open wall at s = 4 -> [0..4] and [4..10]
    const splitOpen = splitWallAtArcLength(openWall, 4);
    expect(splitOpen).toHaveLength(2);
    expect(splitOpen[0].points).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
    ]);
    expect(splitOpen[1].points).toEqual([
      { x: 4, y: 0 },
      { x: 10, y: 0 },
    ]);

    // Breach open wall centered at s = 5, width = 2 -> [0..4] and [6..10]
    const breachedOpen = carveWallBreachAtArcLength(openWall, 5, 2);
    expect(breachedOpen).toHaveLength(2);
    expect(breachedOpen[0].points[1]).toEqual({ x: 4, y: 0 });
    expect(breachedOpen[1].points[0]).toEqual({ x: 6, y: 0 });

    // Closed 6 x 4 Box Room (perimeter = 20)
    const boxWall: WallSegment = {
      id: "w-box",
      assetId: "walls/stone.png",
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 4 },
        { x: 0, y: 4 },
      ],
      closed: true,
      curved: false,
      thicknessCells: 0.4,
      blocksLight: true,
    };

    // Split closed box opens a clean seam (closed -> false)
    const openedBox = splitWallAtArcLength(boxWall, 3);
    expect(openedBox).toHaveLength(1);
    expect(openedBox[0].closed).toBe(false);
    expect(openedBox[0].points[0]).toEqual({ x: 3, y: 0 });
    expect(openedBox[0].points[openedBox[0].points.length - 1]).toEqual({ x: 3, y: 0 });

    // Breach closed box at top midpoint s = 3 with width = 2 -> open C-wall from (4,0) around to (2,0)!
    const breachedBox = carveWallBreachAtArcLength(boxWall, 3, 2);
    expect(breachedBox).toHaveLength(1);
    expect(breachedBox[0].closed).toBe(false);
    expect(breachedBox[0].points[0]).toEqual({ x: 4, y: 0 });
    expect(breachedBox[0].points[breachedBox[0].points.length - 1]).toEqual({ x: 2, y: 0 });

    // findWallCutHit locates active-floor wall accurately and ignores locked/other-floor layers
    const layers: MapLayer[] = [
      {
        id: "l-walls",
        name: "Walls",
        kind: "walls",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId: "lvl-ground",
        walls: [boxWall],
      },
    ];
    const hit = findWallCutHit({ x: 3, y: 0.15 }, layers, "lvl-ground")!;
    expect(hit).not.toBeNull();
    expect(hit.wall.id).toBe("w-box");
    expect(hit.arcLength).toBeCloseTo(3, 2);
  });

  it("samples mixed Straight + Curved wall sections without rounding straight corners, and keeps portals, light occluders & room fills synced", () => {
    // 6 x 4 room where ONLY top edge (edge 0: (0,0)->(6,0)) bows outward into an exact semicircle (sagitta = -3 -> apex at (3,-3))
    const mixedRoom: WallSegment = {
      id: "w-mixed",
      assetId: "walls/stone.png",
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 4 },
        { x: 0, y: 4 },
      ],
      closed: true,
      curved: false,
      segmentCurves: [-3, null, null, null],
      thicknessCells: 0.4,
      blocksLight: true,
    };

    const sampled = sampleWallPoints(mixedRoom, 8);
    // Edge 0 emits circular arc points whose apex reaches y = -3; edges 1, 2, 3 remain crisp single segments
    const minY = Math.min(...sampled.map((p) => p.y));
    expect(minY).toBeCloseTo(-3, 2);
    // All 4 original corners must be preserved verbatim (zero Catmull-Rom corner rounding!)
    expect(sampled.some((p) => Math.abs(p.x - 6) < 1e-4 && Math.abs(p.y - 4) < 1e-4)).toBe(true);
    expect(sampled.some((p) => Math.abs(p.x - 0) < 1e-4 && Math.abs(p.y - 4) < 1e-4)).toBe(true);
    // Bottom edge (6,4)->(0,4) has NO intermediate points bent below y = 4
    expect(Math.max(...sampled.map((p) => p.y))).toBeCloseTo(4, 4);

    // distanceToWall identifies the exact control edge index even at the bowed apex (3, -3)
    const apexHit = distanceToWall({ x: 3, y: -2.9 }, mixedRoom);
    expect(apexHit.segmentIndex).toBe(0);
    expect(apexHit.dist).toBeLessThan(0.2);

    const southHit = distanceToWall({ x: 3, y: 4.1 }, mixedRoom);
    expect(southHit.segmentIndex).toBe(2);
    expect(southHit.dist).toBeCloseTo(0.1, 2);

    // Portal snaps flush to the curved bay apex and cuts a crisp opening there
    const snap = findNearestWallSnap({ x: 3, y: -2.8 }, [mixedRoom], 1.0)!;
    expect(snap).not.toBeNull();
    expect(snap.y).toBeCloseTo(-3, 1);

    const door: PortalNode = {
      id: "p1",
      assetId: "portals/door.png",
      kind: "door",
      wallId: mixedRoom.id,
      x: snap.x,
      y: snap.y,
      rotationRad: snap.rotationRad,
      widthCells: 1.4,
      closed: false,
      locked: false,
      blocksLightWhenClosed: true,
    };
    const carved = cutWallSegmentsForPortals(mixedRoom, [door]);
    // Ensure a doorway gap was actually carved near (3, -3)
    expect(carved.every(([a, b]) => Math.hypot((a.x + b.x) * 0.5 - 3, (a.y + b.y) * 0.5 + 3) > 0.25)).toBe(true);

    // 2D light occluders & closed room fill polygon hug the bowed bay apex
    const occluders = extractLightOccluders([mixedRoom], []);
    expect(Math.min(...occluders.map((s) => Math.min(s.ay, s.by)))).toBeCloseTo(-3, 2);

    const fillPoly = makeClosedWallPolygon(mixedRoom);
    expect(Math.min(...fillPoly.map((p) => p.y))).toBeCloseTo(-3, 2);
  });

  it("preserves exact circular sub-arcs when splitting/breaching curved sections and keeps curve arrays synced on vertex edits", () => {
    // computeDefaultWallEdgeBulge always bows OUTWARD on both CW and CCW closed boxes
    const cwBox: WallSegment = {
      id: "cw",
      assetId: "walls/stone.png",
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 4 },
        { x: 0, y: 4 },
      ],
      closed: true,
      curved: false,
      thicknessCells: 0.4,
      blocksLight: true,
    };
    // Edge 0 (0,0)->(6,0) left normal is (0,+1) inward -> outward bulge must be negative
    expect(computeDefaultWallEdgeBulge(cwBox, 0, "90")).toBeLessThan(0);

    const ccwBox: WallSegment = { ...cwBox, points: [...cwBox.points].reverse() };
    const ccwBulge = computeDefaultWallEdgeBulge(ccwBox, 0, "90");
    expect(Math.abs(ccwBulge)).toBeGreaterThan(0.5);

    // Single-edge semicircular arc wall (0,0)->(6,0), sagitta = +3 (R = 3, center = (3,0))
    const arcWall: WallSegment = {
      id: "w-arc-seg",
      assetId: "walls/stone.png",
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
      ],
      closed: false,
      curved: false,
      segmentCurves: [3],
      thicknessCells: 0.4,
      blocksLight: true,
    };
    const workingPts = sampleWallPoints(arcWall, 8);
    let workingLen = 0;
    for (let i = 0; i < workingPts.length - 1; i++) {
      workingLen += Math.hypot(workingPts[i + 1].x - workingPts[i].x, workingPts[i + 1].y - workingPts[i].y);
    }

    // Splitting at exact midpoint produces two editable 90° sub-arcs (NOT baked into 16 straight vertices!)
    const splitArc = splitWallAtArcLength(arcWall, workingLen * 0.5);
    expect(splitArc).toHaveLength(2);
    expect(splitArc[0].points).toHaveLength(2);
    expect(splitArc[1].points).toHaveLength(2);
    expect(splitArc[0].points[1].x).toBeCloseTo(3, 1);
    expect(splitArc[0].points[1].y).toBeCloseTo(3, 1);
    expect(splitArc[0].segmentCurves?.[0]).toBeGreaterThan(0.5);
    expect(splitArc[1].segmentCurves?.[0]).toBeGreaterThan(0.5);

    // Vertex insertion & removal keep unaffected edges' curves intact
    const curvedMixed: WallSegment = {
      ...cwBox,
      segmentCurves: [-1.2, null, 0.9, null],
    };
    const inserted = insertWallVertexWithCurves(curvedMixed, 1, { x: 6, y: 2 });
    expect(inserted.points).toHaveLength(5);
    expect(inserted.segmentCurves?.[0]).toBeCloseTo(-1.2, 3);
    expect(inserted.segmentCurves?.[3]).toBeCloseTo(0.9, 3);

    const removed = removeWallVertexWithCurves(
      { ...curvedMixed, points: inserted.points, segmentCurves: inserted.segmentCurves },
      2,
    );
    expect(removed.points).toHaveLength(4);
    expect(removed.segmentCurves?.[0]).toBeCloseTo(-1.2, 3);
    expect(removed.segmentCurves?.[2]).toBeCloseTo(0.9, 3);

    // Converting a legacy whole-wall curved loop keeps curve approximations on every side
    const legacyCurved: WallSegment = { ...cwBox, curved: true, segmentCurves: undefined };
    const converted = convertLegacyWallCurveToSegments(legacyCurved);
    expect(converted).toHaveLength(4);
    expect(converted.every((v) => typeof v === "number" && Math.abs(v) > 0.1)).toBe(true);
  });

  it("tracks the last 3 unique floor types used and supports per-section wall toggles & multi-floor room fills in documentStore", () => {
    const st = useDocumentStore.getState();
    st.setBrushParams({ activeTerrainAssetId: "terrain/floor_alpha.png" });
    st.setBrushParams({ activeTerrainAssetId: "terrain/floor_beta.png" });
    st.setBrushParams({ activeTerrainAssetId: "terrain/floor_gamma.png" });
    st.setBrushParams({ activeTerrainAssetId: "terrain/floor_delta.png" });

    const recents = useDocumentStore.getState().recentTerrainAssetIds;
    expect(recents).toEqual([
      "terrain/floor_delta.png",
      "terrain/floor_gamma.png",
      "terrain/floor_beta.png",
    ]);

    // Add a closed box wall, toggle ONLY section 0 curved, then fill interior with an older recent floor!
    const wallId = `w-store-test-${Date.now()}`;
    st.addWall({
      id: wallId,
      assetId: "walls/grunderzeit_brick_wall.png",
      points: [
        { x: 4, y: 4 },
        { x: 10, y: 4 },
        { x: 10, y: 8 },
        { x: 4, y: 8 },
      ],
      closed: true,
      curved: false,
      thicknessCells: 0.38,
      blocksLight: true,
    });
    const sel = useDocumentStore.getState().selection!;
    expect(sel.kind).toBe("wall");

    const nowCurved = useDocumentStore.getState().toggleWallSegmentCurve(sel.layerId, wallId, 0, "90");
    expect(nowCurved).toBe(true);
    const updatedWall = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.find((l) => l.id === sel.layerId)
      ?.walls?.find((w) => w.id === wallId)!;
    expect(updatedWall.curved).toBe(false);
    expect(Math.abs(updatedWall.segmentCurves?.[0] ?? 0)).toBeGreaterThan(0.5);
    expect(updatedWall.segmentCurves?.[1]).toBeNull();
    expect(updatedWall.segmentCurves?.[2]).toBeNull();
    expect(updatedWall.segmentCurves?.[3]).toBeNull();

    // Fill interior with specific recent floor ("terrain/floor_beta.png") -> promotes it to #1 recent!
    const filled = useDocumentStore
      .getState()
      .fillWallInterior(sel.layerId, wallId, "terrain/floor_beta.png");
    expect(filled).toBe(true);
    expect(useDocumentStore.getState().recentTerrainAssetIds[0]).toBe("terrain/floor_beta.png");
  });
});

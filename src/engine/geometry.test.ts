import { describe, expect, it } from "vitest";
import {
  buildUvttPayload,
  computeTvCalibration,
  computeVisibilityPolygon,
  cutWallSegmentsForPortals,
  distanceToPolyline,
  extractLightOccluders,
  findNearestWallSnap,
  generateScatterPlacements,
  sampleCatmullRom,
} from "./geometry";
import { DEFAULT_RECOLOR, type DcMapDocument, type LightNode, type PortalNode, type WallSegment } from "@/types/map";

describe("DiceChaosDisplay TV Calibration", () => {
  it("computes exact 1-inch physical scale for a 55-inch 4K UHD TV", () => {
    const cal = computeTvCalibration(55, 3840, 2160);
    expect(cal.exactPpi).toBeCloseTo(80.11, 1);
    expect(cal.recommendedGridCols).toBe(48);
    expect(cal.recommendedGridRows).toBe(27);
  });

  it("computes exact scale for a 43-inch 4K TV", () => {
    const cal = computeTvCalibration(43, 3840, 2160);
    expect(cal.exactPpi).toBeCloseTo(102.46, 1);
    expect(cal.recommendedGridCols).toBe(37);
    expect(cal.recommendedGridRows).toBe(21);
  });
});

describe("Walls, Snapping Portals & 2D Raycast Shadows", () => {
  const wall: WallSegment = {
    id: "w1",
    assetId: "walls/alpine_stone_wall.png",
    points: [
      { x: 5, y: 2 },
      { x: 5, y: 10 },
    ],
    closed: false,
    curved: false,
    thicknessCells: 0.35,
    blocksLight: true,
  };

  it("snaps a portal onto the nearest wall with aligned tangent angle", () => {
    const snap = findNearestWallSnap({ x: 5.3, y: 6.0 }, [wall], 1.0);
    expect(snap).not.toBeNull();
    expect(snap!.wallId).toBe("w1");
    expect(snap!.x).toBeCloseTo(5.0, 4);
    expect(snap!.y).toBeCloseTo(6.0, 4);
    expect(Math.abs(snap!.rotationRad)).toBeCloseTo(Math.PI / 2, 4);
  });

  it("cuts open portals out of wall light occluders while closed portals stay opaque", () => {
    const closedDoor: PortalNode = {
      id: "p1",
      assetId: "portals/station_oak_door.png",
      kind: "door",
      wallId: "w1",
      x: 5,
      y: 6,
      rotationRad: Math.PI / 2,
      widthCells: 1.0,
      closed: true,
      locked: false,
      blocksLightWhenClosed: true,
    };
    expect(extractLightOccluders([wall], [closedDoor])).toHaveLength(1);

    const openDoor = { ...closedDoor, closed: false };
    const split = extractLightOccluders([wall], [openDoor]);
    expect(split).toHaveLength(2);
    expect(split[0].by).toBeCloseTo(5.5, 3);
    expect(split[1].ay).toBeCloseTo(6.5, 3);
  });

  it("physically cuts wall geometry around both closed and open doors/windows for true inset rendering", () => {
    const windowPortal: PortalNode = {
      id: "win1",
      assetId: "portals/magiglass_window.png",
      kind: "window",
      wallId: "w1",
      x: 5,
      y: 6,
      rotationRad: Math.PI / 2,
      widthCells: 1.5,
      closed: true,
      locked: false,
      blocksLightWhenClosed: false,
    };
    const segments = cutWallSegmentsForPortals(wall, [windowPortal]);
    expect(segments).toHaveLength(2);
    expect(segments[0][1].y).toBeCloseTo(5.34, 2);
    expect(segments[1][0].y).toBeCloseTo(6.66, 2);
  });

  it("accurately hit-tests placed straight and curved polylines for Wall & Path editing", () => {
    const hit = distanceToPolyline({ x: 5.2, y: 6.0 }, wall.points, false, false);
    expect(hit.dist).toBeCloseTo(0.2, 4);
    const far = distanceToPolyline({ x: 9.0, y: 6.0 }, wall.points, false, false);
    expect(far.dist).toBeGreaterThan(3.5);
  });

  it("clips 2D visibility rays cleanly against a blocking wall", () => {
    const light: LightNode = {
      id: "l1",
      name: "Torch",
      x: 2,
      y: 6,
      radiusCells: 8,
      intensity: 1,
      colorHex: "#FFAA33",
      castShadows: true,
      coneAngleDeg: 360,
      directionRad: 0,
      flicker: false,
    };
    const poly = computeVisibilityPolygon(light, extractLightOccluders([wall], []));
    // Rays heading strictly east (y ≈ 6) must stop at x = 5, not reach x = 10
    const eastPoints = poly.filter((p) => p.x > 4.9 && Math.abs(p.y - 6) < 1.2);
    expect(eastPoints.length).toBeGreaterThan(0);
    for (const ep of eastPoints) {
      expect(ep.x).toBeLessThanOrEqual(5.05);
    }
  });
});

describe("Smart Scatter Zones & Splines", () => {
  it("generates deterministic Poisson-disc placements avoiding paths", () => {
    const zone = {
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      assetIds: ["objects/alpine_pine_snow.png", "objects/mountain_boulder_a.png"],
      seed: 42,
      minSpacingCells: 1.8,
      minScale: 0.8,
      maxScale: 1.2,
      avoidWalls: true,
      avoidPaths: true,
    };
    const path = {
      id: "track",
      assetId: "paths/funicular_rail_track.png",
      points: [
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ],
      widthCells: 1.8,
      taperEnds: false,
      fadeEnds: false,
      opacity: 1,
      blocksScatter: true,
    };
    const runA = generateScatterPlacements(zone, [], [path]);
    const runB = generateScatterPlacements(zone, [], [path]);
    expect(runA).toEqual(runB);
    expect(runA.length).toBeGreaterThan(4);
    for (const p of runA) {
      expect(Math.abs(p.y - 5)).toBeGreaterThanOrEqual(1.4);
    }
  });

  it("keeps doorways and placed objects clear of smart scatter", () => {
    const zone = {
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      assetIds: ["objects/crate.png"],
      seed: 12345,
      minSpacingCells: 1.0,
      minScale: 0.9,
      maxScale: 1.1,
      avoidWalls: true,
      avoidPaths: true,
    };
    const door = {
      id: "door-1",
      assetId: "portals/door.png",
      kind: "door" as const,
      x: 5,
      y: 2,
      rotationRad: 0,
      widthCells: 1.6,
      closed: false,
      locked: false,
      blocksLightWhenClosed: true,
    };
    const table = {
      id: "table-1",
      assetId: "objects/cafe_table.png",
      x: 5,
      y: 7,
      widthCells: 2.0,
      heightCells: 2.0,
      rotationRad: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      castsShadow: true,
      locked: false,
      recolor: { ...DEFAULT_RECOLOR },
      zOrder: 10,
    };
    const placements = generateScatterPlacements(zone, [], [], [door], [table]);
    expect(placements.length).toBeGreaterThan(6);
    for (const p of placements) {
      // Clear of doorway (half-width 0.8 + 1.15 = 1.95)
      expect(Math.hypot(p.x - door.x, p.y - door.y)).toBeGreaterThanOrEqual(1.94);
      // Clear of table box (half-extents 1.0 + 0.55 clearance)
      const dx = Math.max(0, Math.abs(p.x - table.x) - 1.0);
      const dy = Math.max(0, Math.abs(p.y - table.y) - 1.0);
      expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(0.54);
    }
  });

  it("samples smooth Catmull-Rom curves cleanly", () => {
    const pts = sampleCatmullRom(
      [
        { x: 0, y: 0 },
        { x: 5, y: 2 },
        { x: 10, y: 0 },
      ],
      8,
    );
    expect(pts.length).toBe(17);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 10, y: 0 });
  });
});

describe("Universal VTT Export", () => {
  it("strips DM-only layers and exports walls, portals, and lights", () => {
    const doc: DcMapDocument = {
      schemaVersion: "1.0.0",
      id: "test",
      mode: "battlemap",
      meta: { title: "Test", author: "GM", createdAt: "", updatedAt: "" },
      canvas: {
        widthCells: 48,
        heightCells: 27,
        ppi: 256,
        baseTerrainAssetId: "terrain/alpine_slate_rock.png",
        grid: { type: "square", visible: true, colorHex: "#FFFFFF", opacity: 0.15 },
      },
      levels: [{ id: "lvl-1", shortCode: "1F", name: "Ground", kind: "ground", elevationFt: 0, visible: true }],
      activeLevelId: "lvl-1",
      activeLayerId: "l-walls",
      layers: [
        {
          id: "l-walls",
          name: "Walls",
          kind: "walls",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: "lvl-1",
          walls: [
            {
              id: "w1",
              assetId: "walls/alpine_stone_wall.png",
              points: [
                { x: 1, y: 1 },
                { x: 6, y: 1 },
              ],
              closed: false,
              curved: false,
              thicknessCells: 0.3,
              blocksLight: true,
            },
          ],
          portals: [
            {
              id: "p1",
              assetId: "portals/oak_tavern_door.png",
              kind: "door",
              wallId: "w1",
              x: 3.5,
              y: 1,
              rotationRad: 0,
              widthCells: 1.4,
              closed: true,
              locked: false,
              blocksLightWhenClosed: true,
            },
          ],
        },
        {
          id: "l-dm",
          name: "DM Secret",
          kind: "walls",
          visible: true,
          locked: false,
          dmOnly: true,
          opacity: 1,
          blendMode: "normal",
          levelId: "lvl-1",
          walls: [
            {
              id: "w-secret",
              assetId: "walls/alpine_stone_wall.png",
              points: [
                { x: 2, y: 2 },
                { x: 4, y: 2 },
              ],
              closed: false,
              curved: false,
              thicknessCells: 0.3,
              blocksLight: true,
            },
          ],
        },
      ],
      lighting: {
        enabled: true,
        activePresetId: "night",
        ambientColorHex: "#1E293B",
        ambientIntensity: 0.35,
        shadowSoftness: 0.5,
        presets: [],
      },
    };
    const uvtt = buildUvttPayload(doc, "BASE64PNG", 80.11);
    expect(uvtt.resolution.pixels_per_grid).toBe(80);
    // Wall 1..6 is carved cleanly into 2 segments around doorway at x=3.5 (width 1.4), and DM wall is stripped!
    expect(uvtt.line_of_sight).toHaveLength(2);
    expect(uvtt.portals).toHaveLength(1);
  });

  it("samples non-uniform closed polygons with Centripetal Catmull-Rom without overshoot whip-back loops", () => {
    // 16-cell straight horizontal edge next to tiny 0.35-cell corner step
    const nonUniform = [
      { x: 28, y: 4.5 },
      { x: 29.2, y: 3.5 },
      { x: 29.0, y: 3.25 },
      { x: 45.0, y: 3.25 },
      { x: 45.2, y: 3.5 },
      { x: 46, y: 4.5 },
      { x: 46, y: 10 },
      { x: 28, y: 10 },
    ];
    const sampled = sampleCatmullRom(nonUniform, 10, true);
    const minY = Math.min(...sampled.map((p) => p.y));
    expect(minY).toBeGreaterThan(2.6);

    // Specifically inspect the 10 subdivided samples on the tiny corner segment (idx 10..20):
    // Uniform Catmull-Rom whips this 0.32-cell segment multiple cells sideways; Centripetal stays tightly bounded!
    const tinyCornerSamples = sampled.slice(10, 21);
    for (const pt of tinyCornerSamples) {
      expect(pt.x).toBeGreaterThan(28.85);
      expect(pt.x).toBeLessThan(29.35);
      expect(pt.y).toBeGreaterThan(3.2);
      expect(pt.y).toBeLessThan(3.55);
    }
  });
});

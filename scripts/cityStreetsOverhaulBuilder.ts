/**
 * Overhauls ALL 7 non-tram city street corridors (+ Eisenbahnstraße outer road
 * shoulders & Grand Crossroads) so the entire urban road network seamlessly
 * matches the aged hand-inked granite-sett quality of Eisenbahnstraße:
 *
 *   - Area 1: West Avenue beside Postamt Nr. 4 (x=0..9.5, y=7.5..25.5)
 *   - Area 2: North Service Alley & East Rear Lane between Tenement 1F & Wachturm Ost
 *   - Area 3: Watchtower South Alley (x=29..48.2, y=17.8..22.6)
 *   - Area 4: East Winding Canal Alley (x=42.4..47.5, y=19.8..29.5)
 *   - Area 5: SW Cathedral Side Alley (x=10..27.5, y=44.5..54.5)
 *   - Area 6: SE Souverän-Allee Boulevard beside Rowhouses 2–4
 *   - Area 7: Central Souverän-Allee Cathedral Vigil Plaza & Shop Forecourt
 *
 * Layering Strategy:
 *   1. Splices exact curb-to-curb aged granite-sett / damp-basalt road polygons
 *      and soft sidewalk-edge cleanup patches into `layer-dd-terrain-1` right
 *      AFTER `dd-splat-1-*` and BEFORE `dd-shape-floor-1-*`, so 100% of every
 *      building's interior floor stays mathematically protected on top.
 *   2. Lays directional Harmony street paths (carriage wheel-ruts, central stone
 *      alley drainage runnels, dressed granite curbs, and gutter grime) in
 *      `layer-dd-paths-1` BEFORE Eisenbahnstraße's girder tram tracks so the
 *      steel rails and crossing plates always render cleanly on top.
 *   3. Adds subtle ground weathering & patina overlays across all 7 corridors
 *      matching Eisenbahnstraße's decades-worn atmosphere.
 */

import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type Point2D,
  type SplinePath,
  type TerrainStroke,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

const Q = Math.PI / 4; // 45°

function pts(coords: Array<[number, number]>): Point2D[] {
  return coords.map(([x, y]) => ({
    x: Math.round(x * 1000) / 1000,
    y: Math.round(y * 1000) / 1000,
  }));
}

function ovalPoly(cx: number, cy: number, rx: number, ry: number, segs = 20): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push({
      x: Math.round((cx + Math.cos(a) * rx) * 1000) / 1000,
      y: Math.round((cy + Math.sin(a) * ry) * 1000) / 1000,
    });
  }
  return out;
}

export function buildCityStreetsOverhaul(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
): void {
  const groundTerrain = doc.layers.find((l) => l.id === "layer-dd-terrain-1");
  let seq = 0;
  const uid = (tag: string) => `cs-1f-${tag}-${++seq}`;

  const roadTerrains: TerrainStroke[] = [];

  const roadPoly = (
    assetId: string,
    coords: Array<[number, number]>,
    opts: { opacity?: number; softness?: number } = {},
  ) => {
    roadTerrains.push({
      id: uid("road"),
      assetId,
      shape: "polygon",
      points: pts(coords),
      radiusCells: 0,
      opacity: opts.opacity ?? 0.98,
      softness: opts.softness ?? 0.04,
    });
  };

  const edgePatch = (
    assetId: string,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    opts: { opacity?: number; softness?: number } = {},
  ) => {
    roadTerrains.push({
      id: uid("edge"),
      assetId,
      shape: "polygon",
      points: ovalPoly(cx, cy, rx, ry, 20),
      radiusCells: 0,
      opacity: opts.opacity ?? 0.90,
      softness: opts.softness ?? 0.34,
    });
  };

  const path = (
    assetId: string,
    coords: Array<[number, number]>,
    widthCells: number,
    opts: { curved?: boolean; opacity?: number; fadeEnds?: boolean } = {},
  ) => {
    const p: SplinePath = {
      id: uid("pth"),
      assetId,
      points: pts(coords),
      widthCells,
      curved: opts.curved ?? true,
      taperEnds: false,
      fadeEnds: opts.fadeEnds ?? true,
      opacity: opts.opacity ?? 0.90,
      blocksScatter: false,
    };
    f1Out.paths.push(p);
  };

  const obj = (
    assetId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    rot = 0,
    opts: { z?: number; shadow?: boolean; opacity?: number } = {},
  ) => {
    f1Out.objects.push({
      id: uid("obj"),
      assetId,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      widthCells: w,
      heightCells: h,
      rotationRad: rot,
      flipX: false,
      flipY: false,
      opacity: opts.opacity ?? 1,
      castsShadow: opts.shadow ?? false,
      locked: false,
      recolor: { ...DEFAULT_RECOLOR },
      zOrder: opts.z ?? 44,
    });
  };

  const GRANITE_ROAD = "modular-suite/terrain/city_streets/terr_berlin_aged_granite_setts.png";
  const ALLEY_COBBLE = "modular-suite/terrain/city_streets/terr_alley_damp_basalt_cobbles.png";
  const SIDEWALK_SCREE = "modular-suite/terrain/terrain_mountain_scree_talus.png";

  // =========================================================================
  // 1. SIDEWALK-EDGE TERRAIN CLEANUP PATCHES (SOFTEN HARSH CLAY/SAND BLEEDS!)
  // =========================================================================
  // Area 1: Smooth out raw bright orange clay corner outside Postamt Nr. 4 curb & NW crossroads lamp
  edgePatch(SIDEWALK_SCREE, 6.85, 19.85, 1.55, 1.45, { opacity: 0.92, softness: 0.38 });
  edgePatch(SIDEWALK_SCREE, 9.25, 20.15, 1.15, 0.80, { opacity: 0.90, softness: 0.36 });
  // Area 2: Smooth out the gaping raw orange clay crater at the east alley mouth & yard verge
  edgePatch(SIDEWALK_SCREE, 36.20, 12.15, 2.40, 1.35, { opacity: 0.94, softness: 0.36 });
  edgePatch(SIDEWALK_SCREE, 37.65, 14.35, 2.15, 1.55, { opacity: 0.94, softness: 0.38 });
  edgePatch(SIDEWALK_SCREE, 34.45, 11.75, 1.85, 0.95, { opacity: 0.88, softness: 0.35 });
  // Area 4: Soften pale yellow sand bleed behind west curb of East Winding Canal Alley
  edgePatch(SIDEWALK_SCREE, 44.55, 23.65, 1.25, 2.25, { opacity: 0.88, softness: 0.38 });
  // Area 5: Soften raw orange clay & pale sand blobs flanking the Cathedral SE apse & churchyard verge
  edgePatch(SIDEWALK_SCREE, 20.45, 47.75, 1.35, 1.20, { opacity: 0.92, softness: 0.38 });
  edgePatch(SIDEWALK_SCREE, 23.55, 44.85, 1.55, 1.45, { opacity: 0.92, softness: 0.38 });
  // Area 6: Soften harsh pale sandy smear right beside Rowhouse 4 SE corner
  edgePatch(SIDEWALK_SCREE, 46.25, 50.85, 2.10, 2.25, { opacity: 0.78, softness: 0.42 });

  // =========================================================================
  // 2. EXACT CURB-TO-CURB AGED GRANITE-SETT & BASALT-COBBLE ROAD POLYGONS
  // =========================================================================
  // Eisenbahnstraße full curb-to-curb granite roadbed (replaces sterile pale gravel shoulders beside tram rails!)
  roadPoly(GRANITE_ROAD, [
    [-0.5, 30.10],
    [4.01, 25.97],
    [4.61, 24.97],
    [7.53, 20.72],
    [8.95, 20.64],
    [10.03, 19.87],
    [16.30, 14.05],
    [20.98, 8.98],
    [26.20, 4.11],
    [28.06, 2.01],
    [30.90, -0.50],
    [36.50, -0.50],
    [34.88, 0.86],
    [33.37, 2.31],
    [30.15, 5.35],
    [27.74, 8.34],
    [25.01, 10.72],
    [22.00, 13.95],
    [17.94, 17.87],
    [11.53, 24.58],
    [10.00, 28.00],
    [8.00, 28.00],
    [6.00, 30.00],
    [2.00, 34.00],
    [0.00, 36.00],
    [-0.50, 35.87],
  ], { opacity: 0.96, softness: 0.03 });

  // Area 1: West Avenue beside Postamt Nr. 4 (exact polygon between dd-wall-1-17 east & dd-wall-1-18 west!)
  roadPoly(GRANITE_ROAD, [
    [-0.50, 7.40],
    [-0.22, 7.89],
    [6.97, 20.06],
    [7.53, 20.72],
    [8.95, 20.64],
    [7.20, 23.60],
    [4.61, 24.97],
    [4.59, 22.92],
    [0.00, 15.17],
    [-0.50, 14.30],
  ], { opacity: 0.98, softness: 0.03 });

  // Areas 6 & 7: Souverän-Allee Grand Boulevard (exact polygon between dd-wall-1-14 NE & dd-wall-1-16/15 SW!)
  roadPoly(GRANITE_ROAD, [
    [11.53, 24.58],
    [11.60, 25.50],
    [14.26, 28.25],
    [17.82, 31.12],
    [21.03, 34.22],
    [25.40, 37.72],
    [28.93, 41.37],
    [31.40, 43.35],
    [36.90, 47.01],
    [42.62, 50.48],
    [45.20, 52.43],
    [46.15, 54.50],
    [41.50, 54.50],
    [40.18, 52.52],
    [37.90, 50.72],
    [34.95, 48.86],
    [29.92, 46.01],
    [28.00, 45.00],
    [27.00, 45.00],
    [25.00, 45.00],
    [25.00, 43.00],
    [20.50, 38.50],
    [18.00, 36.00],
    [17.00, 35.00],
    [14.00, 32.00],
    [10.00, 28.00],
    [8.00, 28.00],
  ], { opacity: 0.98, softness: 0.03 });

  // Area 2: North Service Alley (between dd-wall-1-13 & dd-wall-1-14) seamlessly continuing into East Rear Service Lane!
  roadPoly(ALLEY_COBBLE, [
    [27.74, 8.34],
    [27.84, 9.42],
    [31.00, 12.73],
    [31.89, 13.21],
    [33.13, 13.35],
    [33.93, 13.00],
    [35.00, 12.79],
    [36.02, 12.73],
    [37.40, 11.40],
    [39.00, 11.12],
    [48.35, 11.12],
    [48.35, 12.95],
    [39.00, 12.95],
    [37.40, 13.67],
    [35.91, 14.48],
    [33.12, 15.11],
    [31.99, 15.47],
    [31.07, 15.24],
    [30.01, 14.78],
    [26.90, 11.42],
    [25.82, 10.78],
    [25.01, 10.72],
  ], { opacity: 0.98, softness: 0.05 });

  // Area 3: Watchtower South Alley (exact polygon between dd-wall-1-12 north & dd-wall-1-10 south!)
  roadPoly(ALLEY_COBBLE, [
    [28.80, 21.07],
    [32.99, 20.96],
    [35.94, 20.69],
    [41.33, 19.61],
    [46.30, 18.41],
    [48.35, 17.85],
    [48.35, 19.72],
    [46.54, 20.27],
    [43.63, 20.41],
    [40.13, 21.30],
    [36.75, 21.50],
    [33.71, 22.58],
    [31.61, 22.50],
    [29.10, 22.57],
  ], { opacity: 0.98, softness: 0.04 });

  // Area 4: East Winding Canal Alley (exact polygon between dd-wall-1-10 west & dd-wall-1-11 east!)
  roadPoly(ALLEY_COBBLE, [
    [43.63, 20.41],
    [46.54, 20.27],
    [46.27, 21.44],
    [46.60, 22.24],
    [47.33, 25.19],
    [47.41, 26.28],
    [46.14, 27.58],
    [44.96, 28.39],
    [44.29, 29.08],
    [43.24, 29.43],
    [41.80, 29.65],
    [41.80, 27.95],
    [42.47, 27.64],
    [44.71, 26.47],
    [45.57, 25.11],
    [45.18, 22.94],
    [45.07, 21.47],
  ], { opacity: 0.98, softness: 0.05 });

  // Area 5: SW Cathedral Side Alley (exact polygon between dd-wall-1-16 north & dd-wall-1-15 south!)
  roadPoly(ALLEY_COBBLE, [
    [25.00, 45.00],
    [27.00, 45.00],
    [26.00, 46.00],
    [21.00, 51.00],
    [18.00, 53.50],
    [15.00, 53.50],
    [12.96, 54.50],
    [10.10, 54.50],
    [10.38, 54.22],
    [15.00, 52.00],
    [18.00, 52.00],
    [21.00, 49.00],
  ], { opacity: 0.98, softness: 0.04 });

  // Splice road polygons right AFTER base outdoor splats (`dd-splat-1-*`) and BEFORE all building floors!
  if (groundTerrain?.terrainStrokes) {
    let insertIdx = 0;
    for (let i = 0; i < groundTerrain.terrainStrokes.length; i++) {
      if (groundTerrain.terrainStrokes[i].id.startsWith("dd-splat-")) {
        insertIdx = i + 1;
      }
    }
    groundTerrain.terrainStrokes.splice(insertIdx, 0, ...roadTerrains);
  } else {
    f1Out.terrain.push(...roadTerrains);
  }

  // =========================================================================
  // 3. DIRECTIONAL HARMONY STREET PATHS (WHEEL RUTS, CURBS & ALLEY RUNNELS!)
  // =========================================================================
  const AVE_TRACKS = "modular-suite/paths/city_streets/path_avenue_carriage_tracks.png";
  const ALLEY_GUTTER = "modular-suite/paths/city_streets/path_alley_central_drain_gutter.png";
  const CURB_TRIM = "modular-suite/paths/city_streets/path_granite_curb_gutter_edge.png";
  const GUTTER_GRIME = "modular-suite/paths/streetcar/path_aged_curb_gutter_grime.png";

  // Area 1: West Avenue directional granite carriageway + flanking dressed granite curb edges
  path(AVE_TRACKS, [[-0.25, 11.45], [2.35, 15.85], [5.15, 20.65], [6.85, 22.85]], 2.65, {
    curved: true, opacity: 0.88, fadeEnds: true,
  });
  path(CURB_TRIM, [[-0.10, 8.20], [3.35, 14.05], [6.80, 19.95]], 0.44, {
    curved: false, opacity: 0.82, fadeEnds: true,
  });
  path(CURB_TRIM, [[4.45, 22.85], [2.25, 19.10], [0.05, 15.35]], 0.44, {
    curved: false, opacity: 0.82, fadeEnds: true,
  });

  // Areas 6 & 7: Souverän-Allee directional granite carriageway + curb gutter trim & silt ribbons!
  path(AVE_TRACKS, [
    [10.25, 26.55], [13.95, 30.05], [17.45, 33.25], [21.05, 36.45],
    [24.95, 39.95], [28.35, 43.15], [32.35, 45.75], [36.45, 48.25],
    [40.45, 50.85], [43.95, 53.95],
  ], 2.55, { curved: true, opacity: 0.88, fadeEnds: true });
  path(CURB_TRIM, [
    [11.75, 25.75], [14.40, 28.45], [17.95, 31.35], [21.15, 34.45],
    [25.45, 37.95], [28.95, 41.55], [31.50, 43.55], [36.95, 47.18],
    [42.60, 50.65], [45.10, 52.55],
  ], 0.44, { curved: true, opacity: 0.80, fadeEnds: true });
  path(CURB_TRIM, [
    [41.45, 53.95], [40.05, 52.35], [37.75, 50.55], [34.80, 48.65],
    [29.80, 45.80], [27.95, 44.80],
  ], 0.44, { curved: true, opacity: 0.80, fadeEnds: true });
  path(GUTTER_GRIME, [
    [10.30, 27.95], [14.15, 31.85], [17.15, 34.85], [20.65, 38.35], [24.85, 42.65],
  ], 0.56, { curved: true, opacity: 0.72, fadeEnds: true });

  // Area 2: North Service Alley central dressed-stone drainage runnel curving into the rear service lane!
  path(ALLEY_GUTTER, [
    [26.55, 9.95], [29.25, 12.65], [31.65, 14.32], [33.85, 14.08],
    [36.15, 13.48], [38.15, 12.25], [41.50, 12.05], [47.85, 12.05],
  ], 1.04, { curved: true, opacity: 0.90, fadeEnds: true });

  // Area 3: Watchtower South Alley central stone drainage runnel
  path(ALLEY_GUTTER, [
    [29.25, 21.82], [33.25, 21.72], [36.55, 21.02],
    [40.85, 20.38], [44.85, 19.50], [48.10, 18.78],
  ], 0.98, { curved: true, opacity: 0.90, fadeEnds: true });

  // Area 4: East Winding Canal Alley central stone drainage runnel
  path(ALLEY_GUTTER, [
    [45.55, 20.15], [45.75, 21.60], [45.95, 22.85],
    [46.45, 25.15], [46.05, 26.45], [44.85, 27.55], [43.25, 28.45],
  ], 0.90, { curved: true, opacity: 0.88, fadeEnds: true });

  // Area 5: SW Cathedral Side Alley central stone drainage runnel
  path(ALLEY_GUTTER, [
    [25.95, 45.10], [21.05, 50.00], [18.00, 52.75], [15.00, 52.75], [11.65, 54.30],
  ], 0.94, { curved: true, opacity: 0.90, fadeEnds: true });

  // =========================================================================
  // 4. COHESIVE GROUND WEATHERING & PATINA OVERLAYS ACROSS ALL 7 STREETS
  //    (Exact native aspect ratios preserved <= 1.05x!)
  // =========================================================================
  // Muddy wheel smears along West Ave & Souverän-Allee (2.64 x 1.20)
  for (const [wx, wy, rot, op] of [
    [1.85, 15.10, 1.04, 0.64],
    [4.45, 19.45, 1.04, 0.62],
    [15.45, 31.45, Q, 0.62],
    [22.45, 37.85, Q, 0.64],
    [30.25, 44.55, 0.58, 0.62],
    [38.65, 49.65, 0.58, 0.60],
  ] as Array<[number, number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_muddy_wheel_track_smear.png", wx, wy, 2.42, 1.10, rot, {
      z: 44, opacity: op,
    });
  }

  // Tar-sealed cobble cracks on weathered intersections & alleys (1.80 x 1.40)
  for (const [cx, cy, rot] of [
    [3.65, 18.25, 0.85],
    [21.65, 36.85, 0.40],
    [34.65, 47.25, -0.35],
    [32.65, 14.15, 0.15],
    [37.85, 20.85, -0.22],
    [19.25, 51.65, -0.68],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_tar_cobble_crack_network.png", cx, cy, 1.62, 1.26, rot, {
      z: 44, opacity: 0.80,
    });
  }

  // Curb-hugging moss/weed tufts & grit scatter along all 7 street edges (1.92 x 0.96)
  for (const [mx, my, rot] of [
    [0.95, 16.55, 1.04],
    [30.35, 14.35, 0.45],
    [35.25, 14.55, -0.20],
    [31.15, 21.15, -0.05],
    [42.55, 20.55, -0.22],
    [45.35, 24.45, 1.48],
    [15.85, 52.15, 0.02],
    [22.45, 47.65, -Q],
    [34.25, 48.25, 0.56],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_curb_moss_weed_tufts.png", mx, my, 1.72, 0.86, rot, {
      z: 45, opacity: 0.84,
    });
  }

  // Translucent reflective rain sheen & damp seepage inside alley gutters (1.80 x 1.30 / 2.16 x 1.80)
  for (const [px, py, rot] of [
    [33.15, 14.25, -0.15],
    [40.45, 20.45, -0.20],
    [46.15, 25.85, 1.25],
    [18.45, 52.65, -0.15],
    [28.85, 43.85, 0.58],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_puddle_rain_film_sheen.png", px, py, 1.56, 1.12, rot, {
      z: 46, opacity: 0.78,
    });
  }

  // Vintage mismatched brick street repair patches on boulevards (1.44 x 0.90)
  obj("modular-suite/props/aged_streetcar_line/st_track_cobble_repair_patch.png", 35.85, 47.85, 1.44, 0.90, 0.58, {
    z: 42, opacity: 0.90,
  });
  obj("modular-suite/props/aged_streetcar_line/st_track_cobble_repair_patch.png", 2.95, 16.45, 1.44, 0.90, 1.04, {
    z: 42, opacity: 0.88,
  });
}

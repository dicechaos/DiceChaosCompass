/**
 * Builds the Aged Berlin-Magipunk Streetcar Line ("Eisenbahnstraße"), Audited Municipal
 * Manhole & Storm-Drain Network, and Multi-Layer Ground + Object Weathering / Grime Pass
 * across `1F` of `Cathedral of the Sovereign (5F)`.
 *
 * Key Art Director & Architectural Upgrades:
 *  1. Replaces the 5 early-era Dungeondraft mine-cart track paths (`dd-path-1-6..10`:
 *     raw wooden ties, bright yellow flat rectangle stripe, and flat brown wagon ruts)
 *     with 5 true-parallel 45° painterly Harmony streetcar paths:
 *       - Twin embedded granite-sett steel girder tram tracks (`x+y = 32.10` & `33.80`)
 *       - Weathered dark-basalt cobblestone center median w/ faded ochre markers (`x+y = 32.95`)
 *       - Soft feathered outer curb-gutter silt & brake-dust ribbons (`x+y = 30.85` & `35.05`)
 *  2. Upgrades the entire streetcar corridor furniture to Harmony quality & exact clearances:
 *       - Weathered Streetcar #14 (`st_aged_magipunk_tram_car`) dead-centered on SE rail
 *       - Cast-iron & dusty-glass Haltestelle shelters strictly clear of rail envelopes
 *       - Standalone modular "H" tram stop signpost across from Steam & Scoop Express
 *       - Riveted iron & brass tram semaphores, fluted overhead catenary wire poles,
 *         dual-rail cast-iron crossing plates, switch point boxes, brick/tar repair patches,
 *         and chipped granite block crosswalks
 *  3. Relocates EVERY municipal manhole & curb storm drain out of the steel rail envelope
 *     into realistic curb/roadway utility lanes — PLUS aligns 2 alley manholes directly over
 *     the B2 Flooded Municipal Brick Sewer Canal (`x = 34.75, y = 12.05` & `y = 21.75`)!
 *  4. Showcases ALL 28 feathered Weathering & Grime Overlays (`props/weathering_overlays/`)
 *     both ON THE GROUND (track oil drips, coal soot, tar cracks, curb moss/weeds, damp
 *     seepage, puddles, grit, mortar crumbs, autumn leaves) AND ON TOP OF EXISTING OBJECTS
 *     (tram roof soot & scuffs, shelter dust & verdigris, iron rust streaks, paint spray,
 *     wood water-rings, and wispy alley cobwebs)!
 */

import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type LightNode,
  type ObjectStamp,
  type RgbRecolor,
  type SplinePath,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

const Q = Math.PI / 4; // 45°

// Exact true-parallel 45° Eisenbahnstraße streetcar geometry (c = x + y):
//   NW Curb wall (`dd-wall-1-17`/`18`)  ≈ 30.00
//   NW Rail center                      = 32.10  (occupies 31.31..32.89)
//   Basalt Track Median center          = 32.95
//   SE Rail center                      = 33.80  (occupies 33.01..34.59)
//   SE Curb wall (`dd-wall-1-14`/`16`)  ≈ 35.85
export const TRAM_NW_SUM = 32.10;
export const TRAM_MID_SUM = 32.95;
export const TRAM_SE_SUM = 33.80;

function tint(hex: string, strength = 0.85): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

const GRIME_OCHRE_DUST = tint("#7A6A52", 0.85);
const GRIME_PITCH_TAR = tint("#2E2824", 0.90);
const GRIME_OLIVE_MOSS = tint("#546B38", 0.85);
const GRIME_MUD_STREAK = tint("#5C4834", 0.84);

export function buildAgedStreetcarLineAndWeathering(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
): void {
  const groundPaths = doc.layers.find((l) => l.id === "layer-dd-paths-1");

  // 1. Remove the 5 legacy Dungeondraft early-era street track paths (`dd-path-1-6..10`)
  const legacyRailPathIds = new Set([
    "dd-path-1-6",
    "dd-path-1-7",
    "dd-path-1-8",
    "dd-path-1-9",
    "dd-path-1-10",
  ]);
  if (groundPaths?.paths) {
    groundPaths.paths = groundPaths.paths.filter((p) => !legacyRailPathIds.has(p.id));
  }

  let seq = 0;
  const uid = (tag: string) => `st-1f-${tag}-${++seq}`;

  const addPath = (
    assetId: string,
    sumConst: number,
    widthCells: number,
    opacity = 0.96,
  ) => {
    // Runs cleanly from off-canvas SW (-0.6, sum+0.6) to off-canvas NE (sum+0.6, -0.6)
    const p: SplinePath = {
      id: uid("pth"),
      assetId,
      points: [
        { x: -0.6, y: Math.round((sumConst + 0.6) * 1000) / 1000 },
        { x: Math.round((sumConst + 0.6) * 1000) / 1000, y: -0.6 },
      ],
      widthCells,
      curved: false,
      taperEnds: false,
      fadeEnds: false,
      opacity,
      blocksScatter: false,
    };
    f1Out.paths.push(p);
  };

  const obj = (
    assetId: string,
    x: number,
    y: number,
    widthCells: number,
    heightCells: number,
    rotationRad = 0,
    opts: { z?: number; shadow?: boolean; flipX?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    const o: ObjectStamp = {
      id: uid("obj"),
      assetId,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      widthCells,
      heightCells,
      rotationRad,
      flipX: Boolean(opts.flipX),
      flipY: false,
      opacity: opts.opacity ?? 1,
      castsShadow: opts.shadow ?? true,
      locked: false,
      recolor: opts.recolor ?? { ...DEFAULT_RECOLOR },
      zOrder: opts.z ?? 60,
    };
    f1Out.objects.push(o);
  };

  const light = (
    name: string,
    x: number,
    y: number,
    radiusCells: number,
    colorHex: string,
    intensity: number,
    opts: { flicker?: boolean; castShadows?: boolean; coneAngleDeg?: number; directionRad?: number } = {},
  ) => {
    const ln: LightNode = {
      id: uid("lgt"),
      name,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      radiusCells,
      colorHex,
      intensity,
      castShadows: opts.castShadows ?? true,
      coneAngleDeg: opts.coneAngleDeg ?? 360,
      directionRad: opts.directionRad ?? 0,
      flicker: opts.flicker ?? false,
    };
    f1Out.lights.push(ln);
  };

  // =========================================================================
  // 1. TRUE-PARALLEL 45° AGED EMBEDDED GRANITE-SETT STREETCAR RAIL CORRIDOR
  // =========================================================================
  // Softly feathered gutter grime ribbons flanking the outer street shoulders
  addPath("modular-suite/paths/streetcar/path_aged_curb_gutter_grime.png", 30.85, 0.72, 0.80);
  addPath("modular-suite/paths/streetcar/path_aged_curb_gutter_grime.png", 35.05, 0.72, 0.80);
  // Weathered dark-basalt cobblestone track median with antique faded ochre markers
  addPath("modular-suite/paths/streetcar/path_aged_tram_median_cobbles.png", TRAM_MID_SUM, 0.58, 0.96);
  // Twin embedded granite-sett steel girder tram tracks (NW southbound + SE northbound!)
  addPath("modular-suite/paths/streetcar/path_aged_streetcar_cobble_track.png", TRAM_NW_SUM, 1.12, 0.98);
  addPath("modular-suite/paths/streetcar/path_aged_streetcar_cobble_track.png", TRAM_SE_SUM, 1.12, 0.98);

  // =========================================================================
  // 2. AGED STREETCAR #14, HALTESTELLEN, CROSSING PLATES, SWITCHES & POLES
  // =========================================================================
  // Weathered Prussian-blue & cream Berlin-Magipunk Streetcar #14 dead-centered on SE rail (x+y = 33.80)!
  obj("modular-suite/props/aged_streetcar_line/st_aged_magipunk_tram_car.png", 24.30, 9.50, 4.20, 1.50, -Q, { z: 76 });
  light("Tram #14 Warm Headlamp Beam", 22.75, 11.05, 5.4, "#FFD685", 0.86, {
    castShadows: false,
    coneAngleDeg: 68,
    directionRad: (3 * Math.PI) / 4,
  });
  light("Tram #14 Aether Pantograph Spark", 24.30, 9.50, 3.6, "#6BE2FF", 0.54, { castShadows: false });

  // Cast-iron dual-rail street crossing apron plates at Grand Crossroads & NE Crossing (x+y = 32.95)
  obj("modular-suite/props/aged_streetcar_line/st_tram_crossing_iron_plates.png", 9.15, 23.80, 2.88, 2.40, -Q, { z: 43, shadow: false });
  obj("modular-suite/props/aged_streetcar_line/st_tram_crossing_iron_plates.png", 28.25, 4.70, 2.88, 2.40, -Q, { z: 43, shadow: false });

  // Recessed cast-iron tramway switch boxes & point lever pits cleanly on outer rail shoulders!
  obj("modular-suite/props/aged_streetcar_line/st_rail_switch_point_box.png", 12.65, 18.20, 0.96, 0.80, -Q, { z: 45, shadow: false });
  obj("modular-suite/props/aged_streetcar_line/st_rail_switch_point_box.png", 26.65, 8.65, 0.96, 0.80, -Q, { z: 45, shadow: false });

  // Mismatched red-brick & tar municipal street-repair trench patches cleanly on flat paved roadways (zero curb wall overlap!)
  obj("modular-suite/props/aged_streetcar_line/st_track_cobble_repair_patch.png", 17.25, 17.65, 1.52, 0.95, -Q + 0.06, { z: 42, shadow: false, opacity: 0.94 });
  obj("modular-suite/props/aged_streetcar_line/st_track_cobble_repair_patch.png", 7.35, 21.85, 1.44, 0.90, Q - 0.12, { z: 42, shadow: false, opacity: 0.92 });
  obj("modular-suite/props/aged_streetcar_line/st_track_cobble_repair_patch.png", 23.85, 7.15, 1.44, 0.90, -Q - 0.05, { z: 42, shadow: false, opacity: 0.92 });

  // Two Aged Cast-Iron & Dusty-Glass Haltestelle Shelters strictly clear of rail envelopes AND stone curb walls!
  // NW North Plaza Bay (100% cleanly behind stone curb dd-wall-1-17 x+y=30.0 & south of round building y=5.0!)
  obj("modular-suite/props/aged_streetcar_line/st_aged_tram_stop_shelter.png", 21.15, 7.20, 2.24, 1.12, -Q + Math.PI, { z: 68 });
  // NE Tenement Forecourt Bay (cleanly on forecourt apron between curb dd-wall-1-13 & Tenement facade!)
  obj("modular-suite/props/aged_streetcar_line/st_aged_tram_stop_shelter.png", 31.85, 4.85, 2.24, 1.12, -Q, { z: 68 });
  // Modular standalone Berlin "H" Tram Stop Signpost & worn bench centered on the NW cobble sidewalk across from Steam & Scoop!
  obj("modular-suite/props/aged_streetcar_line/st_aged_tram_stop_signpost.png", 14.80, 14.45, 0.78, 0.78, -Q + Math.PI, { z: 68 });
  obj("modular-suite/props/neighborhood_park/pk_worn_park_bench.png", 13.65, 15.55, 1.38, 0.62, -Q + Math.PI, { z: 64 });

  // Weathered Iron & Brass Tram Semaphore Signals cleanly behind outer curbs (replacing starter flat icons!)
  obj("modular-suite/props/aged_streetcar_line/st_aged_tram_semaphore_signal.png", 11.75, 26.85, 0.92, 0.92, -Q, { z: 74 });
  obj("modular-suite/props/aged_streetcar_line/st_aged_tram_semaphore_signal.png", 26.25, 3.65, 0.92, 0.92, -Q + Math.PI, { z: 74 });

  // Fluted Cast-Iron Overhead Catenary Wire Support Poles paired along the outer sidewalks!
  // NW sidewalk (x+y ≈ 29.75, arm reaching SE toward tracks: rot = Q)
  for (const [px, py] of [
    [2.15, 27.60],
    [11.45, 18.30],
    [18.85, 10.90],
    [27.45, 2.30],
  ] as Array<[number, number]>) {
    obj("modular-suite/props/aged_streetcar_line/st_overhead_catenary_pole.png", px, py, 0.90, 0.72, Q, { z: 75 });
  }
  // SE sidewalk (x+y ≈ 36.10, arm reaching NW toward tracks: rot = -3*Q)
  for (const [px, py] of [
    [5.85, 30.25],
    [19.25, 16.85],
    [24.35, 11.75],
    [33.15, 2.95],
  ] as Array<[number, number]>) {
    obj("modular-suite/props/aged_streetcar_line/st_overhead_catenary_pole.png", px, py, 0.90, 0.72, -3 * Q, { z: 75 });
  }

  // Worn & Chipped Granite Block Crosswalks (upgrading all 5 sterile flat white crosswalks!)
  obj("modular-suite/props/aged_streetcar_line/st_aged_granite_crosswalk.png", 6.75, 20.65, 3.00, 1.35, -0.52, { z: 43, shadow: false });
  obj("modular-suite/props/aged_streetcar_line/st_aged_granite_crosswalk.png", 13.75, 29.25, 3.00, 1.35, -Q, { z: 43, shadow: false });
  obj("modular-suite/props/aged_streetcar_line/st_aged_granite_crosswalk.png", 18.55, 33.85, 3.00, 1.35, -Q, { z: 43, shadow: false });
  obj("modular-suite/props/aged_streetcar_line/st_aged_granite_crosswalk.png", 27.95, 42.45, 3.00, 1.35, -Q, { z: 43, shadow: false });
  obj("modular-suite/props/aged_streetcar_line/st_aged_granite_crosswalk.png", 28.05, 8.65, 2.70, 1.22, -Q + 0.08, { z: 43, shadow: false });

  // Soot-Rimmed Municipal Sidewalk Steam/Aether Vent Grates flush on open paved aprons (zero curb wall straddling!)
  obj("modular-suite/props/aged_streetcar_line/st_street_steam_grate_vent.png", 15.60, 19.55, 0.88, 0.72, -Q, { z: 45, shadow: false });
  obj("modular-suite/props/aged_streetcar_line/st_street_steam_grate_vent.png", 23.10, 12.15, 0.88, 0.72, -Q, { z: 45, shadow: false });

  // =========================================================================
  // 3. AUDITED MUNICIPAL MANHOLES & CURB STORM DRAINS (ZERO RAIL OVERLAP!)
  // =========================================================================
  // Every manhole sits cleanly in a street utility lane or directly over the B2 Sewer Canal!
  const manholes: Array<[number, number, number]> = [
    // Eisenbahnstraße utility shoulders — 100% clear of BOTH steel rails (x+y <= 30.6 or >= 35.4)!
    [6.65, 22.85, 0.15],   // Crossroads NW approach shoulder (x+y = 29.50)
    [12.25, 25.95, -0.25], // Crossroads SE approach shoulder (x+y = 38.20)
    [27.35, 10.35, 0.40],  // NE Tenement street-mouth utility shaft (x+y = 37.70)
    [3.25, 32.35, 0.10],   // SW Cathedral-side road shoulder (x+y = 35.60)
    // Vertically aligned DIRECTLY ABOVE the B2 Flooded Brick Sewer Canal (x = 34.75, y ∈ [11.4..23.5])!
    [34.75, 12.05, 0.0],   // North Service Alley B2 Sewer Access Manhole
    [34.75, 21.75, -0.15], // East Winding Alley B2 Sewer Junction Manhole
    // Souverän-Allee (Cathedral Boulevard) open road utility lanes
    [2.65, 14.35, 0.25],
    [17.15, 31.45, -0.20],
    [25.15, 39.45, 0.30],
    [33.05, 47.05, -0.15],
    [40.85, 52.05, 0.20],
  ];
  for (const [mx, my, mrot] of manholes) {
    obj("modular-suite/props/aged_streetcar_line/st_street_manhole_granite_collar.png", mx, my, 0.92, 0.92, mrot, {
      z: 45,
      shadow: false,
    });
  }

  // Mossy Cast-Iron Curb Storm Drain Catch-Basins tucked tightly along road gutters (ZERO in tracks!)
  const stormDrains: Array<[number, number, number]> = [
    // Tram Avenue NW curb gutter (x+y ≈ 30.70)
    [5.20, 24.40, Q],
    [13.25, 17.45, -Q], // Relocated out of the track center to NW gutter!
    [22.10, 8.65, -Q],
    // Tram Avenue SE curb gutter (x+y ≈ 35.35)
    [5.45, 29.90, -Q + Math.PI],
    [19.15, 16.20, -Q + Math.PI],
    [26.35, 10.65, -Q],
    // Souverän-Allee & Side-Street curb gutters
    [8.50, 19.80, 0.55],
    [11.80, 27.60, -Q],
    [15.40, 31.40, Q],
    [22.60, 36.20, Q],
    [29.60, 43.20, Q],
    [37.40, 49.70, Q],
    [3.80, 17.60, 0.58],
    [18.60, 48.60, -Q],
  ];
  for (const [gx, gy, gr] of stormDrains) {
    obj("modular-suite/props/aged_streetcar_line/st_curb_storm_drain_basin.png", gx, gy, 0.77, 0.56, gr, {
      z: 45,
      shadow: false,
    });
  }

  // =========================================================================
  // 4. LAYERABLE GROUND & TRACK WEATHERING / GRIME OVERLAY PASS (Groups A, B, D)
  // =========================================================================
  // Track-bed axle-grease & coal-soot smears down the rails & beneath Tram #14
  for (const [ox, oy, rot, op] of [
    [5.20, 28.60, -Q, 0.80],
    [11.40, 22.40, -Q, 0.82],
    [17.60, 16.20, -Q, 0.78],
    [24.30, 9.50, -Q, 0.88],  // Directly under Tram #14 axle boxes!
    [28.90, 4.90, -Q, 0.76],
    [15.80, 16.30, -Q, 0.76], // NW track outside Steam & Scoop stop
    [21.60, 10.50, -Q, 0.82], // NW track at North Haltestelle braking zone
  ] as Array<[number, number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_axle_grease_oil_drip_strip.png", ox, oy, 2.40, 1.08, rot, {
      z: 46, shadow: false, opacity: op,
    });
  }
  for (const [sx, sy, rot, op] of [
    [2.40, 29.70, -Q, 0.74],
    [8.20, 23.90, -Q, 0.78],
    [14.20, 17.90, -Q, 0.76],
    [22.50, 11.30, -Q, 0.82],
    [26.20, 7.60, -Q, 0.80],
    [30.60, 1.50, -Q, 0.74],
  ] as Array<[number, number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_soot_cinder_smear_band.png", sx, sy, 2.64, 1.20, rot, {
      z: 46, shadow: false, opacity: op,
    });
  }

  // Broad feathered ground dust/grime washes & damp seepage across crossroads & outer road shoulders
  for (const [gx, gy, gw, gh, rot, op] of [
    [8.50, 22.40, 2.50, 2.00, 0.25, 0.72],
    [11.60, 25.40, 2.50, 2.00, -0.40, 0.70],
    [20.20, 14.80, 2.25, 1.80, 0.55, 0.68],
    [27.60, 9.20, 2.50, 2.00, -0.20, 0.72],
    [18.20, 32.80, 2.50, 2.00, 0.35, 0.66],
    [29.80, 6.40, 2.25, 1.80, 0.15, 0.66],
    [4.80, 25.90, 2.25, 1.80, -Q, 0.62],
    [14.40, 16.50, 2.25, 1.80, -Q + 0.15, 0.60],
    [19.40, 11.40, 2.25, 1.80, -Q - 0.12, 0.60],
    [15.00, 20.10, 2.25, 1.80, -Q, 0.62],
    [19.80, 15.20, 2.25, 1.80, -Q + 0.20, 0.62],
    [24.80, 10.20, 2.25, 1.80, -Q - 0.18, 0.60],
  ] as Array<[number, number, number, number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_grime_dust_wash_lg.png", gx, gy, gw, gh, rot, {
      z: 41, shadow: false, opacity: op,
    });
  }
  for (const [dx, dy, rot, op] of [
    [10.80, 26.80, 0.30, 0.74],
    [22.20, 13.10, -0.45, 0.72],
    [28.60, 8.50, 0.18, 0.70],
    [4.40, 26.80, -0.25, 0.72],
  ] as Array<[number, number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_damp_seepage_stain_lg.png", dx, dy, 2.16, 1.80, rot, {
      z: 41, shadow: false, opacity: op,
    });
  }

  // Muddy wheel tracks curving across the Grand Crossroads & NE street mouth
  obj("modular-suite/props/weathering_overlays/wth_muddy_wheel_track_smear.png", 8.25, 22.65, 2.64, 1.20, Q - 0.12, { z: 44, shadow: false, opacity: 0.72 });
  obj("modular-suite/props/weathering_overlays/wth_muddy_wheel_track_smear.png", 11.45, 26.15, 2.64, 1.20, Q + 0.08, { z: 44, shadow: false, opacity: 0.70 });
  obj("modular-suite/props/weathering_overlays/wth_muddy_wheel_track_smear.png", 28.45, 10.65, 2.42, 1.10, Q + 0.18, { z: 44, shadow: false, opacity: 0.68 });

  // Feathered organic oil spills, rust-oxide runoffs around drains/switches & aether-arc scorches!
  obj("modular-suite/props/weathering_overlays/wth_oil_slick_stain_organic.png", 23.15, 10.65, 1.38, 1.20, 0.35, { z: 46, shadow: false, opacity: 0.86 });
  obj("modular-suite/props/weathering_overlays/wth_oil_slick_stain_organic.png", 10.65, 24.45, 1.27, 1.10, -0.45, { z: 46, shadow: false, opacity: 0.80 });
  for (const [rx, ry, rot] of [
    [12.65, 18.20, 0.25], // Around NW rail switch box
    [26.65, 8.65, -0.35], // Around SE rail switch box
    [22.10, 8.65, 0.50],  // Around NW storm drain
    [19.15, 16.20, -0.20],// Around SE storm drain
    [3.25, 32.35, 0.15],  // Around SW manhole
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_rust_oxide_runoff_stain.png", rx, ry, 1.35, 1.08, rot, {
      z: 44, shadow: false, opacity: 0.78,
    });
  }
  obj("modular-suite/props/weathering_overlays/wth_scorch_aether_arc_burn.png", 25.90, 7.90, 1.40, 1.30, 0.20, { z: 47, shadow: false, opacity: 0.72 });
  obj("modular-suite/props/weathering_overlays/wth_scorch_aether_arc_burn.png", 9.80, 23.15, 1.29, 1.20, -0.40, { z: 47, shadow: false, opacity: 0.64 });

  // Branching tar-sealed pavement cracks across intersections & roadway shoulders
  for (const [cx, cy, rot] of [
    [7.40, 24.85, 0.15],
    [14.85, 19.65, -0.55],
    [20.60, 14.35, 0.40],
    [26.95, 6.05, -0.30],
    [16.20, 30.65, 0.65],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_tar_cobble_crack_network.png", cx, cy, 1.80, 1.40, rot, {
      z: 44, shadow: false, opacity: 0.86,
    });
  }

  // Curb-hugging silt streaks, moss/weed crack tufts, mortar crumbs, rain puddles, grit & autumn leaf drifts!
  for (const [kx, ky, rot] of [
    [4.20, 26.35, -Q],
    [12.85, 17.75, -Q],
    [19.65, 10.95, -Q],
    [25.20, 5.40, -Q],
    [15.40, 20.15, -Q + Math.PI],
    [22.40, 13.15, -Q + Math.PI],
    [29.85, 5.70, -Q + Math.PI],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_gutter_silt_runoff_streak.png", kx, ky, 2.40, 1.08, rot, {
      z: 42, shadow: false, opacity: 0.80,
    });
  }
  for (const [mx, my, rot] of [
    [1.80, 28.45, -Q],
    [14.15, 16.05, -Q],
    [17.85, 12.35, -Q],
    [23.80, 6.40, -Q],
    [18.25, 17.55, -Q + Math.PI],
    [24.95, 10.95, -Q + Math.PI],
    [31.85, 3.85, -Q + Math.PI],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_curb_moss_weed_tufts.png", mx, my, 1.92, 0.96, rot, {
      z: 46, shadow: false, opacity: 0.90,
    });
  }
  for (const [bx, by, rot] of [
    [11.80, 16.80, -Q],
    [16.80, 11.80, -Q],
    [21.65, 14.95, -Q + Math.PI],
    [30.95, 6.15, -Q + Math.PI],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_crumbled_mortar_gravel_edge.png", bx, by, 1.92, 0.96, rot, {
      z: 45, shadow: false, opacity: 0.86,
    });
  }
  for (const [lx, ly, rot] of [
    [14.65, 15.15, 0.25],
    [20.45, 8.65, -0.40],
    [32.45, 4.15, 0.35],
    [6.15, 29.85, -0.20],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_damp_lichen_moss_film.png", lx, ly, 1.60, 1.40, rot, {
      z: 44, shadow: false, opacity: 0.72,
    });
  }
  for (const [cx, cy, rot] of [
    [6.45, 24.15, 0.20],
    [13.95, 18.65, -0.35],
    [21.95, 12.45, 0.45],
    [27.45, 7.85, -0.15],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_street_grit_cinder_scatter.png", cx, cy, 1.60, 1.30, rot, {
      z: 46, shadow: false, opacity: 0.86,
    });
  }
  // Translucent reflective rain puddles letting cobbles & stone show through!
  for (const [px, py, rot] of [
    [5.85, 23.65, 0.25],
    [16.95, 18.45, -0.55],
    [24.15, 11.45, 0.40],
    [29.15, 6.95, -0.25],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_puddle_rain_film_sheen.png", px, py, 1.80, 1.30, rot, {
      z: 47, shadow: false, opacity: 0.86,
    });
  }
  // Transparent painterly autumn leaves curb drifts (replaces opaque gray-polygon legacy leaves!)
  for (const [ax, ay, rot] of [
    [5.80, 20.30, -0.52],
    [12.80, 28.40, -Q],
    [21.80, 36.80, Q],
    [29.80, 44.80, Q],
    [26.15, 4.45, -Q],
    [16.80, 50.80, -Q],
    [42.65, 19.85, -0.28],
    [16.25, 13.95, -Q + 0.15],
  ] as Array<[number, number, number]>) {
    obj("modular-suite/props/weathering_overlays/wth_autumn_leaves_curb_drift.png", ax, ay, 1.80, 1.10, rot, {
      z: 47, shadow: false, opacity: 0.92,
    });
  }

  // All 4 Universal Colorable (`dd_red`) Grime & Weathering Overlays showcased cleanly!
  obj("modular-suite/props/weathering_overlays/wth_colorable_grime_wash.png", 9.85, 21.85, 2.00, 1.75, 0.25, {
    z: 42, shadow: false, opacity: 0.62, recolor: GRIME_OCHRE_DUST,
  });
  obj("modular-suite/props/weathering_overlays/wth_colorable_drip_stain.png", 26.85, 9.15, 1.20, 1.20, -0.35, {
    z: 46, shadow: false, opacity: 0.78, recolor: GRIME_PITCH_TAR,
  });
  obj("modular-suite/props/weathering_overlays/wth_colorable_moss_lichen_veil.png", 12.15, 17.55, 1.50, 1.30, 0.40, {
    z: 45, shadow: false, opacity: 0.74, recolor: GRIME_OLIVE_MOSS,
  });
  obj("modular-suite/props/weathering_overlays/wth_colorable_scuff_streak_band.png", 10.65, 24.85, 2.20, 1.10, Q, {
    z: 45, shadow: false, opacity: 0.68, recolor: GRIME_MUD_STREAK,
  });

  // =========================================================================
  // 5. OBJECT-TOP AGING & GRIME OVERLAY PASS (Group C — layered ON TOP of props!)
  // =========================================================================
  // Layered directly ON TOP of Streetcar #14 roof (z=79 > tram z=76) for authentic 30-year service wear!
  obj("modular-suite/props/weathering_overlays/wth_obj_soot_smudge_cap.png", 24.95, 8.85, 1.40, 1.20, -Q, {
    z: 79, shadow: false, opacity: 0.56,
  });
  obj("modular-suite/props/weathering_overlays/wth_obj_scuff_scratch_patina.png", 23.65, 10.15, 1.50, 1.20, -Q, {
    z: 79, shadow: false, opacity: 0.62,
  });
  obj("modular-suite/props/weathering_overlays/wth_obj_paint_peel_splatter.png", 24.30, 9.50, 1.26, 1.08, -Q + 0.15, {
    z: 79, shadow: false, opacity: 0.48,
  });
  // Layered directly ON TOP of both Aged Tram Stop Shelters (z=71 > shelter z=68)!
  obj("modular-suite/props/weathering_overlays/wth_obj_dust_film_veil.png", 21.15, 7.20, 1.20, 1.20, 0.25, {
    z: 71, shadow: false, opacity: 0.58,
  });
  obj("modular-suite/props/weathering_overlays/wth_obj_verdigris_copper_patina.png", 31.85, 4.85, 1.28, 1.10, -Q, {
    z: 71, shadow: false, opacity: 0.54,
  });
  // Layered ON TOP of iron crossing plates & switch box (z=48 > plates z=43)!
  obj("modular-suite/props/weathering_overlays/wth_obj_rust_patina_streaks.png", 9.15, 23.80, 1.40, 1.20, -Q, {
    z: 48, shadow: false, opacity: 0.62,
  });
  obj("modular-suite/props/weathering_overlays/wth_obj_rust_patina_streaks.png", 28.25, 4.70, 1.40, 1.20, -Q + 0.1, {
    z: 48, shadow: false, opacity: 0.58,
  });
  // Layered ON TOP of waiting bench & curb crates/tables (z=67 > bench z=64)!
  obj("modular-suite/props/weathering_overlays/wth_obj_water_ring_mildew.png", 13.65, 15.55, 1.10, 1.10, -Q, {
    z: 67, shadow: false, opacity: 0.60,
  });
  // Delicate dusty corner cobweb tucked into the shaded shelter/building eave corner (z=74)!
  obj("modular-suite/props/weathering_overlays/wth_obj_cobweb_dust_corner.png", 30.85, 6.25, 1.05, 1.05, Math.PI, {
    z: 74, shadow: false, opacity: 0.72,
  });

  // =========================================================================
  // 6. STORY-RICH DM NOTE FOR EISENBAHNSTRASSE & SEWER ACCESS MANHOLES
  // =========================================================================
  f1Out.dmNotes.push({
    id: uid("note"),
    x: 24.30,
    y: 9.50,
    badge: "NOTE",
    title: "1F · Eisenbahnstraße Streetcar #14 & Sewer Manholes",
    body: "Decades-worn granite-sett girder rails carry Prussian-blue Streetcar #14 past Steam & Scoop Express and the Grand Crossroads. All municipal manholes sit clear of the steel rails in road utility shoulders — and the two embossed alley manholes in the North Service Alley (34.75, 12.05) and East Winding Alley (34.75, 21.75) drop straight down iron rungs into the B2 Flooded Brick Sewer Canal!",
    colorHex: "#38BDF8",
  });
}

/**
 * Builds all 4 Multi-Story Dark-Magipunk Boulevard Rowhouses lining SE Souverän-Allee
 * (12 complete lived-in interior floors + upgraded distinct Berlin roofs on ROOF!):
 *
 *  - Building #1 (`dd-shape-floor-1-6`, 3 Stories: 1F–3F, 7.07×7.07 @ (24.0, 31.0)):
 *      1F: "Keller & Kron Vintner's & Fine Spirits Emporium" (aligned B1 Wine Cellar stair!)
 *      2F: Counting House & Secret Velvet-Engine Broker's Parlour
 *      3F: Wine Merchant's Penthouse Suite & Attic Study
 *  - Building #2 (`dd-shape-floor-1-5`, 4 Stories: 1F–4F, 7.07×8.49 @ (30.5, 35.5)):
 *      1F: "Dampf & Glanz Magipunk Steam Press & Garment Laundry" (aligned B1 Wash-Cellar stair!)
 *      2F: Volksbad Herbal Steam Bathhouse (3 tiled soaking alcoves + warm lounge)
 *      3F: Working-Class Boardinghouse Flats (Tram Conductor 3A + Seamstress 3B)
 *      4F: Top-Floor Timber Attic Garret & Rainy-Day Drying Loft
 *  - Building #3 (`dd-shape-floor-1-4`, 3 Stories: 1F–3F, 7.07×5.66 @ (36.0, 41.0)):
 *      1F: "Eulenblick Antiquarian Bookshop, Curiosities & Horology" (aligned B1 Relic Cellar stair!)
 *      2F: Clockwork Horology Restoration Studio & Rare Folio Reading Gallery
 *      3F: Eccentric Antiquarian's Collector Flat & Cathedral-Orrery Telescope Nook
 *  - Building #4 (`dd-shape-floor-1-3`, 2 Stories: 1F–2F, 7.78×6.36 @ (43.0, 45.5)):
 *      1F: "Seide & Sohle Bespoke Tailor, Milliner & Cobbler Atelier" (aligned B1 Dye-Cellar stair!)
 *      2F: Master Tailor's Living Flat & Suspicious Pale-Root Mortar Study
 *
 * Every exterior storefront has Boulevard doors, bay display windows, scalloped striped
 * awnings, backyard Hinterhof service doors, vertically aligned stairwells (B1↔1F↔2F↔3F↔4F),
 * location-matched `harmony_lighting` fixtures, and subtle `weathering_overlays` wear.
 */

import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type DmNotePin,
  type LightNode,
  type ObjectStamp,
  type Point2D,
  type PortalNode,
  type RgbRecolor,
  type RoofStructure,
  type TerrainStroke,
  type WallSegment,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

const S = Math.SQRT1_2;
const Q = Math.PI / 4; // 45°

// Cardinal rotations for front-down (+Y) top-down sprites in the 45°-rotated boulevard frame:
// Local frame: +u = (+S, +S) [SE along boulevard], +v = (+S, -S) [NE toward backyard]
const FACE_SW = Q;          // Front faces -v (SW toward Souverän-Allee)
const FACE_NE = -3 * Q;     // Front faces +v (NE toward Hinterhof backyard)
const FACE_SE = -Q;         // Front faces +u (SE toward next rowhouse)
const FACE_NW = 3 * Q;      // Front faces -u (NW toward previous rowhouse)
const PORTAL_U = Q;         // Wall running parallel to boulevard (constant v, varying u)
const PORTAL_V = -Q;        // Wall running perpendicular to boulevard (constant u, varying v)

function tint(hex: string, strength = 0.9): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

const CRIMSON = tint("#8E1B2E", 0.92);
const ROYAL_PLUM = tint("#6B265C", 0.92);
const EMERALD = tint("#227252", 0.90);
const PRUSSIAN = tint("#284B78", 0.90);
const ROYAL_VIOLET = tint("#6D28D9", 0.90);
const ANTIQUE_GOLD = tint("#C49438", 0.88);
const WARM_TEAL = tint("#2B7D82", 0.90);

interface RowhouseSpec {
  id: string;
  floorStrokeId: string;
  wallId: string;
  roofId: string;
  roofAssetId: string;
  cx: number;
  cy: number;
  halfU: number; // half-width along boulevard (+u = SE)
  halfV: number; // half-depth toward backyard (+v = NE)
  stories: number;
}

const ROW_SPECS: readonly RowhouseSpec[] = [
  {
    id: "r1",
    floorStrokeId: "dd-shape-floor-1-6",
    wallId: "dd-wall-1-20",
    roofId: "dd-roof-0-5",
    roofAssetId: "modular-suite/terrain/harmony/roof_burgundy_diamond_slate.png",
    cx: 24.0,
    cy: 31.0,
    halfU: 5.0 * S, // 3.5355
    halfV: 5.0 * S, // 3.5355
    stories: 3,
  },
  {
    id: "r2",
    floorStrokeId: "dd-shape-floor-1-5",
    wallId: "dd-wall-1-24",
    roofId: "dd-roof-0-13",
    roofAssetId: "modular-suite/terrain/harmony/roof_berlin_charcoal_mansard.png",
    cx: 30.5,
    cy: 35.5,
    halfU: 5.0 * S, // 3.5355
    halfV: 6.0 * S, // 4.2426
    stories: 4,
  },
  {
    id: "r3",
    floorStrokeId: "dd-shape-floor-1-4",
    wallId: "dd-wall-1-25",
    roofId: "dd-roof-0-16",
    roofAssetId: "modular-suite/terrain/harmony/roof_emerald_fishscale_tile.png",
    cx: 36.0,
    cy: 41.0,
    halfU: 5.0 * S, // 3.5355
    halfV: 4.0 * S, // 2.8284
    stories: 3,
  },
  {
    id: "r4",
    floorStrokeId: "dd-shape-floor-1-3",
    wallId: "dd-wall-1-26",
    roofId: "dd-roof-0-14",
    roofAssetId: "modular-suite/terrain/harmony/roof_warm_aged_copper.png",
    cx: 43.0,
    cy: 45.5,
    halfU: 5.5 * S, // 3.8891
    halfV: 4.5 * S, // 3.1820
    stories: 2,
  },
];

function rowPt(spec: RowhouseSpec, u: number, v: number): Point2D {
  return {
    x: Math.round((spec.cx + u * S + v * S) * 1000) / 1000,
    y: Math.round((spec.cy + u * S - v * S) * 1000) / 1000,
  };
}

function rowRect(spec: RowhouseSpec, u0: number, v0: number, u1: number, v1: number): Point2D[] {
  return [
    rowPt(spec, u0, v0),
    rowPt(spec, u1, v0),
    rowPt(spec, u1, v1),
    rowPt(spec, u0, v1),
  ];
}

function makeRoomHelper(spec: RowhouseSpec, floorTag: string, bundle: IceCreamBuildBundle) {
  let seq = 0;
  const uid = (k: string) => `row-${spec.id}-${floorTag}-${k}-${++seq}`;

  const floor = (assetId: string, u0 = -spec.halfU, v0 = -spec.halfV, u1 = spec.halfU, v1 = spec.halfV) => {
    const t: TerrainStroke = {
      id: uid("flr"),
      assetId,
      shape: "polygon",
      points: rowRect(spec, u0, v0, u1, v1),
      radiusCells: 0,
      opacity: 1,
      softness: 0,
    };
    bundle.terrain.push(t);
  };

  const wall = (
    assetId: string,
    uvs: Array<[number, number]>,
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean } = {},
  ): string => {
    const id = uid("wal");
    const w: WallSegment = {
      id,
      assetId,
      points: uvs.map(([u, v]) => rowPt(spec, u, v)),
      closed: Boolean(opts.closed),
      curved: false,
      thicknessCells: opts.thickness ?? 0.2,
      blocksLight: opts.blocksLight ?? true,
    };
    bundle.walls.push(w);
    return id;
  };

  const portal = (
    assetId: string,
    u: number,
    v: number,
    rot: number,
    kind: PortalNode["kind"],
    widthCells: number,
    closed: boolean,
    wallId?: string,
  ) => {
    const p = rowPt(spec, u, v);
    bundle.portals.push({
      id: uid("prt"),
      assetId,
      kind,
      wallId,
      x: p.x,
      y: p.y,
      rotationRad: rot,
      widthCells,
      closed,
      locked: false,
      blocksLightWhenClosed: kind !== "window",
    });
  };

  const obj = (
    assetId: string,
    u: number,
    v: number,
    w: number,
    h: number,
    rot = FACE_SW,
    opts: { z?: number; shadow?: boolean; flipX?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    const p = rowPt(spec, u, v);
    const o: ObjectStamp = {
      id: uid("obj"),
      assetId,
      x: p.x,
      y: p.y,
      widthCells: w,
      heightCells: h,
      rotationRad: rot,
      flipX: Boolean(opts.flipX),
      flipY: false,
      opacity: opts.opacity ?? 1,
      castsShadow: opts.shadow ?? true,
      locked: false,
      recolor: opts.recolor ?? { ...DEFAULT_RECOLOR },
      zOrder: opts.z ?? 62,
    };
    bundle.objects.push(o);
  };

  const objWorld = (
    assetId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    rot = 0,
    opts: { z?: number; shadow?: boolean; flipX?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    bundle.objects.push({
      id: uid("obj"),
      assetId,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      widthCells: w,
      heightCells: h,
      rotationRad: rot,
      flipX: Boolean(opts.flipX),
      flipY: false,
      opacity: opts.opacity ?? 1,
      castsShadow: opts.shadow ?? true,
      locked: false,
      recolor: opts.recolor ?? { ...DEFAULT_RECOLOR },
      zOrder: opts.z ?? 62,
    });
  };

  const light = (
    name: string,
    u: number,
    v: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.88,
    flicker = false,
  ) => {
    const p = rowPt(spec, u, v);
    const ln: LightNode = {
      id: uid("lgt"),
      name,
      x: p.x,
      y: p.y,
      radiusCells,
      colorHex,
      intensity,
      castShadows: true,
      coneAngleDeg: 360,
      directionRad: 0,
      flicker,
    };
    bundle.lights.push(ln);
  };

  const note = (
    badge: DmNotePin["badge"],
    u: number,
    v: number,
    title: string,
    body: string,
    colorHex = "#F59E0B",
  ) => {
    const p = rowPt(spec, u, v);
    bundle.dmNotes.push({
      id: uid("note"),
      x: p.x,
      y: p.y,
      badge,
      title,
      body,
      colorHex,
    });
  };

  /** Standard 4-wall exterior perimeter with optional storefront / upper-floor windows & rear door */
  const buildShell = (
    wallAsset: string,
    opts: {
      frontDoor?: { asset: string; u: number; w?: number };
      frontWindows?: Array<{ asset: string; u: number; w?: number }>;
      rearDoor?: { asset: string; u: number; w?: number };
      rearWindows?: Array<{ asset: string; u: number; w?: number }>;
      thickness?: number;
    },
  ) => {
    const hu = spec.halfU;
    const hv = spec.halfV;
    const wExt = wall(
      wallAsset,
      [
        [-hu, -hv],
        [hu, -hv],
        [hu, hv],
        [-hu, hv],
      ],
      { closed: true, thickness: opts.thickness ?? 0.22 },
    );
    if (opts.frontDoor) {
      portal(opts.frontDoor.asset, opts.frontDoor.u, -hv, PORTAL_U, "door", opts.frontDoor.w ?? 1.2, false, wExt);
    }
    for (const fw of opts.frontWindows ?? []) {
      portal(fw.asset, fw.u, -hv, PORTAL_U, "window", fw.w ?? 1.35, true, wExt);
    }
    if (opts.rearDoor) {
      portal(opts.rearDoor.asset, opts.rearDoor.u, hv, PORTAL_U, "door", opts.rearDoor.w ?? 1.0, true, wExt);
    }
    for (const rw of opts.rearWindows ?? []) {
      portal(rw.asset, rw.u, hv, PORTAL_U, "window", rw.w ?? 1.25, true, wExt);
    }
    return wExt;
  };

  return { floor, wall, portal, obj, objWorld, light, note, buildShell };
}

export interface BoulevardRowhousePolys {
  row1Poly: Point2D[]; // 1F–3F
  row2Poly: Point2D[]; // 1F–4F
  row3Poly: Point2D[]; // 1F–3F
  row4Poly: Point2D[]; // 1F–2F
}

export function buildBoulevardRowhouses(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
  f2Out: IceCreamBuildBundle,
  f3Out: IceCreamBuildBundle,
  f4Out: IceCreamBuildBundle,
): BoulevardRowhousePolys {
  const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1");
  const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs");

  // Replace the 4 legacy windowless Dungeondraft outer wall shells with Harmony storefronts!
  const replacedWallIds = new Set(ROW_SPECS.map((s) => s.wallId));
  if (groundWalls?.walls) {
    groundWalls.walls = groundWalls.walls.filter((w) => !replacedWallIds.has(w.id));
  }

  // Upgrade the 4 existing ROOF polygons to distinct Berlin historic slate/copper/tile finishes!
  if (roofLayer?.roofs) {
    for (const spec of ROW_SPECS) {
      const r: RoofStructure | undefined = roofLayer.roofs.find((x) => x.id === spec.roofId);
      if (r) {
        r.assetId = spec.roofAssetId;
      }
    }
  }

  // =========================================================================
  // BUILDING #1 (`dd-shape-floor-1-6`, 3 STORIES: 1F–3F)
  // "Keller & Kron Vintner's & Fine Spirits Emporium"
  //   Center: (24.0, 31.0), 7.07 × 7.07 | B1 Cellar Stair: (24.40, 28.10)
  //   Aligned 1F↔2F↔3F Oak Stairwell: u = +2.15, v = +2.15
  // =========================================================================
  const R1 = ROW_SPECS[0];
  const r1StairU = 2.15;
  const r1StairV = 2.15;

  // --- R1 · 1F: Keller & Kron Vintner's & Fine Spirits Emporium ---
  {
    const f = makeRoomHelper(R1, "1f", f1Out);
    f.floor("modular-suite/terrain/harmony/flr_dark_walnut_parquet.png");
    f.buildShell("modular-suite/walls/harmony/wall_berlin_ochre_stucco_brick.png", {
      frontDoor: { asset: "modular-suite/portals/harmony/door_grunderzeit_double_glass.png", u: -0.35, w: 1.35 },
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_bay_crimson_cafe.png", u: -2.15, w: 1.4 },
        { asset: "modular-suite/portals/harmony/win_bay_crimson_cafe.png", u: 1.85, w: 1.45 },
      ],
      rearDoor: { asset: "modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", u: 0.25, w: 1.0 },
    });
    // Interior partition separating Front Wine Bar & Tasting Room from Rear Cellar/Stair Hall
    const wDiv = f.wall("modular-suite/walls/harmony/wall_oak_wainscot_parlor.png", [[-3.53, 1.05], [3.53, 1.05]], { thickness: 0.16 });
    f.portal("modular-suite/portals/harmony/arch_roman_brick_open.png", 0.25, 1.05, PORTAL_U, "archway", 1.15, false, wDiv);
    // Scalloped Burgundy Boulevard Awning hanging outside over Souverän-Allee sidewalk!
    f.obj("modular-suite/props/boulevard_shops/bs_vintner_awning_burgundy.png", 0.0, -4.08, 3.04, 1.12, FACE_SW, { z: 86 });
    // Front Wine Tasting Room: crimson rug, tasting bar + stools, wine bottle wall racks, tasting barrels & cheese tables!
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", -0.55, -1.25, 3.2, 2.2, FACE_SW, { z: 46, shadow: false, recolor: CRIMSON });
    f.obj("modular-suite/props/boulevard_shops/bs_vintner_tasting_bar.png", 2.38, -1.05, 2.56, 1.15, FACE_NW, { z: 64 });
    for (const sv of [-2.0, -1.05, -0.1]) {
      f.obj("modular-suite/colorable/col_bar_stool_padded.png", 1.38, sv, 0.54, 0.54, 0, { z: 60, recolor: CRIMSON });
    }
    f.obj("modular-suite/props/boulevard_shops/bs_vintner_bottle_wall_rack.png", -2.92, -0.95, 2.24, 0.98, FACE_SE, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_vintner_wine_barrel_display.png", -1.65, -2.55, 1.40, 1.00, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_vintner_cork_crate_bottles.png", -2.55, 0.35, 0.99, 0.81, FACE_SW + 0.15, { z: 62 });
    // Cozy bistro wine-tasting table topped with cheese & charcuterie board!
    f.obj("modular-suite/modular/bare_oak_round_table.png", -0.85, -1.05, 1.10, 1.10, 0, { z: 62 });
    f.obj("modular-suite/props/boulevard_shops/bs_vintner_cheese_charcuterie_board.png", -0.85, -1.05, 0.65, 0.52, 0.35, { z: 68, shadow: false });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -1.68, -1.05, 0.62, 0.66, FACE_SE, { z: 58 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -0.02, -1.05, 0.62, 0.66, FACE_NW, { z: 58 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_beeswax_saucer_cluster.png", 2.32, -1.55, 0.40, 0.40, 0, { z: 70, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_banquet_brass_chandelier.png", -0.25, -1.25, 1.10, 1.10, 0, { z: 90, opacity: 0.86, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", -3.28, -2.55, 0.52, 0.52, FACE_SE, { z: 76, shadow: false });
    // Subtle lived-in wine-shop floor wear
    f.obj("modular-suite/props/weathering_overlays/wth_obj_scuff_scratch_patina.png", -0.35, -2.85, 1.40, 1.12, FACE_SW, { z: 48, shadow: false, opacity: 0.45 });
    // Rear Cellar & Stair Hall: EXACT B1-aligned cellar stair at (24.40, 28.10) + 1F→2F oak stairwell!
    f.objWorld("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 24.40, 28.10, 0.99, 1.44, Q, { z: 54 });
    f.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", r1StairU, r1StairV, 0.97, 1.50, FACE_SW, { z: 54 });
    f.obj("modular-suite/props/subterranean_caves/sub_dusty_wine_bottle_shelf.png", 0.25, 2.05, 1.42, 0.76, FACE_SW, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_sconce_oil_reflector_wall.png", 0.95, 3.25, 0.50, 0.50, FACE_SW, { z: 76, shadow: false });
    f.light("R1 1F Vintner Chandelier", -0.25, -1.25, 6.2, "#FFBD66", 0.94, true);
    f.light("R1 1F Stair Hall Sconce", 0.45, 2.35, 4.6, "#FFA94D", 0.80, true);
    f.note("NOTE", -0.55, -0.35, "1F · Keller & Kron Vintner's & Wine Bar (3F)", "Warm neighborhood wine shop & tasting bar right beside Steam & Scoop Express. The rear stone stair descends directly to the B1 Wine Cellar — which hides the secret trapdoor into B2 'The Velvet Engine' Speakeasy!", "#E11D48");
  }

  // --- R1 · 2F: Counting House & Velvet-Engine Broker's Parlour ---
  {
    const f = makeRoomHelper(R1, "2f", f2Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png");
    f.buildShell("modular-suite/walls/harmony/wall_berlin_ochre_stucco_brick.png", {
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.85, w: 1.3 },
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: 1.65, w: 1.3 },
      ],
      rearWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.45, w: 1.25 },
      ],
    });
    const wOff = f.wall("modular-suite/walls/harmony/wall_oak_wainscot_parlor.png", [[-0.25, -3.53], [-0.25, 1.15], [3.53, 1.15]], { thickness: 0.16 });
    f.portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", -0.25, 0.15, PORTAL_V, "door", 0.95, false, wOff);
    f.portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", 0.85, 1.15, PORTAL_U, "door", 0.95, false, wOff);
    // NW Counting Office: safe cabinet, clerk desk, banker lamp, strongbox, wine rack
    f.obj("modular-suite/props/boulevard_shops/bs_vintner_counting_safe_cabinet.png", -2.35, -2.25, 1.46, 1.01, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/post_office/po_bare_clerk_desk.png", -1.95, -0.35, 1.50, 1.00, FACE_SE, { z: 62 });
    f.obj("modular-suite/props/post_office/po_open_ledger.png", -1.95, -0.45, 0.52, 0.39, FACE_SE, { z: 68, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", -1.85, 0.05, 0.42, 0.42, 0, { z: 70, shadow: false });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -2.75, -0.35, 0.62, 0.66, FACE_SE, { z: 58 });
    f.obj("modular-suite/props/harmony_arch/int_radiator_iron_short.png", -1.85, -3.18, 1.00, 0.50, FACE_NE, { z: 60 });
    f.obj("modular-suite/props/harmony_arch/int_washroom_marble_vanity.png", -2.25, 2.85, 1.36, 0.68, FACE_SW, { z: 62 });
    // SE Velvet Broker's Parlour: crimson medallion rug, velvet sofa, armchairs, coffee table & floor lamp!
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 1.65, -1.25, 2.4, 2.4, 0, { z: 46, shadow: false, recolor: CRIMSON });
    f.obj("core-fantasy/hero/hero_velvet_sofa.png", 2.35, -1.55, 1.85, 1.08, FACE_NW, { z: 64 });
    f.obj("modular-suite/colorable/col_armchair_club.png", 0.75, -2.25, 0.88, 0.88, FACE_SE, { z: 62, recolor: CRIMSON });
    f.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 1.55, -1.25, 0.95, 0.95, 0, { z: 62 });
    f.obj("modular-suite/props/boulevard_shops/bs_vintner_cheese_charcuterie_board.png", 1.55, -1.25, 0.55, 0.44, -0.3, { z: 68, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_floor_tiffany_stained_lamp.png", 2.75, -2.75, 0.78, 0.78, 0, { z: 70 });
    f.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", r1StairU, r1StairV, 0.97, 1.50, FACE_SW, { z: 54 });
    f.light("R1 2F Counting Desk Lamp", -1.95, -0.35, 5.4, "#FFC26B", 0.88);
    f.light("R1 2F Broker Parlour Tiffany", 1.95, -1.65, 5.8, "#FF9E64", 0.88);
    f.note("SECRET", -2.35, -2.25, "2F · Keller & Kron Counting Vault", "The merchant's dual-entry cipher ledger inside the brass-dial safe records nightly payments from 'The Velvet Engine' speakeasy two floors straight down.", "#F59E0B");
  }

  // --- R1 · 3F: Wine Merchant's Penthouse Suite ---
  {
    const f = makeRoomHelper(R1, "3f", f3Out);
    f.floor("modular-suite/terrain/harmony/flr_dark_walnut_parquet.png");
    f.buildShell("modular-suite/walls/harmony/wall_berlin_ochre_stucco_brick.png", {
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.65, w: 1.3 },
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: 1.65, w: 1.3 },
      ],
      rearWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.45, w: 1.25 },
      ],
    });
    const wBath = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[-3.53, 0.65], [-0.45, 0.65], [-0.45, 3.53]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", -0.45, 1.95, PORTAL_V, "door", 0.90, true, wBath);
    // Master bedroom facing Souverän-Allee
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 0.55, -1.25, 3.0, 2.2, FACE_SW, { z: 46, shadow: false, recolor: ROYAL_PLUM });
    f.obj("core-fantasy/hero/hero_noble_canopy_bed.png", 1.55, -1.55, 1.80, 1.91, FACE_NW, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 2.65, -2.85, 0.66, 0.63, FACE_SW, { z: 60 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png", 2.65, -2.85, 0.40, 0.40, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", -2.55, -2.45, 1.26, 1.08, FACE_SE, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_vanity_mirror_brush.png", -1.05, -2.65, 1.16, 0.89, FACE_NE, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 2.75, -0.05, 0.68, 0.64, 0.2, { z: 64 });
    // Private copper bathhouse alcove (NW rear)
    f.obj("modular-suite/props/bedroom_home/home_copper_bathtub.png", -2.05, 2.35, 1.72, 0.99, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_volksbad_towel_warmer_rack.png", -2.25, 1.20, 1.05, 0.70, FACE_NE, { z: 62 });
    f.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", r1StairU, r1StairV, 0.97, 1.50, FACE_SW, { z: 54 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 0.45, -1.05, 0.92, 0.92, 0, { z: 90, opacity: 0.84, shadow: false });
    f.light("R1 3F Penthouse Pendant", 0.45, -1.05, 6.0, "#FFD08A", 0.90);
    f.light("R1 3F Private Bath Glow", -2.05, 2.15, 4.4, "#FFB86C", 0.78);
  }

  // =========================================================================
  // BUILDING #2 (`dd-shape-floor-1-5`, 4 STORIES: 1F–4F — TALLEST TOWNHOUSE!)
  // "Dampf & Glanz Magipunk Steam Press, Laundry & Volksbad"
  //   Center: (30.5, 35.5), 7.07 × 8.49 | B1 Wash-Cellar Stair: (31.10, 32.20)
  //   Aligned 1F↔2F↔3F↔4F Tenement Switchback Stairwell: u = +2.15, v = +2.85
  // =========================================================================
  const R2 = ROW_SPECS[1];
  const r2StairU = 2.15;
  const r2StairV = 2.85;

  // --- R2 · 1F: Dampf & Glanz Magipunk Steam Press & Garment Laundry ---
  {
    const f = makeRoomHelper(R2, "1f", f1Out);
    f.floor("modular-suite/terrain/harmony/flr_bleached_pine_workshop.png");
    f.buildShell("modular-suite/walls/harmony/wall_berlin_dressed_sandstone.png", {
      frontDoor: { asset: "modular-suite/portals/harmony/door_shop_teal_parlor.png", u: 0.0, w: 1.3 },
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_bay_parlor_marble.png", u: -2.05, w: 1.4 },
        { asset: "modular-suite/portals/harmony/win_bay_parlor_marble.png", u: 2.05, w: 1.4 },
      ],
      rearDoor: { asset: "modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", u: 0.2, w: 1.05 },
    });
    // Partition separating Steam Press Workshop from Rear Cellar/Stair Core
    const wRear = f.wall("modular-suite/walls/harmony/wall_subway_white_tile.png", [[-3.53, 1.65], [3.53, 1.65]], { thickness: 0.16 });
    f.portal("modular-suite/portals/harmony/arch_limestone_classic.png", 0.2, 1.65, PORTAL_U, "archway", 1.2, false, wRear);
    // Scalloped Teal & Cream Boulevard Awning hanging outside over sidewalk!
    f.obj("modular-suite/props/boulevard_shops/bs_laundry_awning_teal.png", 0.0, -4.78, 3.04, 1.12, FACE_SW, { z: 86 });
    // Front Customer Drop-Off Counter & Pressed Garment Racks
    f.obj("modular-suite/props/boulevard_shops/bs_laundry_dropoff_counter.png", -0.85, -2.15, 2.40, 1.20, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_hanging_garment_rack_brass.png", 2.45, -2.55, 2.00, 0.875, FACE_NW, { z: 66 });
    f.obj("modular-suite/props/boulevard_shops/bs_hanging_garment_rack_brass.png", -2.75, -0.35, 2.00, 0.875, FACE_SE, { z: 66 });
    f.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 1.55, -3.35, 0.78, 0.72, 0.25, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", -2.55, -3.25, 0.78, 0.72, -0.35, { z: 62 });
    // Mid-Floor Hero Magipunk Steam Garment Press Machines & Ironing Boards!
    f.obj("modular-suite/props/boulevard_shops/bs_steam_garment_press_machine.png", -0.75, 0.25, 2.34, 1.43, FACE_SW, { z: 66 });
    f.obj("modular-suite/props/boulevard_shops/bs_ironing_board_flatiron.png", 1.75, -0.55, 1.54, 0.88, FACE_NW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_ironing_board_flatiron.png", 1.75, 0.68, 1.54, 0.88, FACE_NW, { z: 64 });
    f.obj("modular-suite/props/kitchen/kit_soapy_washtub.png", -2.55, 0.95, 0.88, 0.88, 0.2, { z: 62 });
    f.obj("modular-suite/props/weathering_overlays/wth_damp_seepage_stain_lg.png", -0.85, 0.45, 2.16, 1.80, 0.2, { z: 48, shadow: false, opacity: 0.48 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", -0.75, 0.15, 0.98, 0.98, 0, { z: 90, opacity: 0.86, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 1.65, -2.15, 0.95, 0.95, 0, { z: 90, opacity: 0.86, shadow: false });
    // Rear Stair Core: EXACT B1-aligned cellar stair at (31.10, 32.20) + 4-story switchback stairwell!
    f.objWorld("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 31.10, 32.20, 0.99, 1.44, Q, { z: 54 });
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", r2StairU, r2StairV, 1.20, 1.50, FACE_SW, { z: 54 });
    f.obj("modular-suite/props/harmony_arch/int_radiator_iron_long.png", 0.15, 2.05, 1.44, 0.48, FACE_NE, { z: 60 });
    f.light("R2 1F Aether Steam Press Glow", -0.75, 0.25, 5.4, "#6BE2FF", 0.84);
    f.light("R2 1F Laundry Shop Pendant", 0.65, -2.25, 6.2, "#FFD280", 0.92);
    f.light("R2 1F Rear Stair Hall", 0.55, 2.85, 4.6, "#FFBE6B", 0.78);
    f.note("NOTE", -0.75, -0.65, "1F · Dampf & Glanz Steam Press & Laundry (4F)", "Aether-heated copper boilers in the B1 cellar power twin rotary steam garment presses on 1F and pipe free fragrant herbal steam straight upstairs to the 2F Volksbad Bathhouse!", "#06B6D4");
  }

  // --- R2 · 2F: Volksbad Herbal Steam Bathhouse ---
  {
    const f = makeRoomHelper(R2, "2f", f2Out);
    f.floor("modular-suite/terrain/harmony/flr_cobalt_bathhouse_mosaic.png");
    f.buildShell("modular-suite/walls/harmony/wall_berlin_dressed_sandstone.png", {
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_bay_iron_conservatory.png", u: -1.85, w: 1.35 },
        { asset: "modular-suite/portals/harmony/win_bay_iron_conservatory.png", u: 1.85, w: 1.35 },
      ],
      rearWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.45, w: 1.25 },
      ],
    });
    // Mint-teal glazed ceramic bathhouse stall partitions creating 3 private soaking alcoves!
    const wB1 = f.wall("modular-suite/walls/harmony/wall_bathhouse_mint_tile.png", [[-3.53, -1.15], [-0.45, -1.15]], { thickness: 0.15 });
    const wB2 = f.wall("modular-suite/walls/harmony/wall_bathhouse_mint_tile.png", [[-3.53, 1.55], [-0.45, 1.55]], { thickness: 0.15 });
    const wB3 = f.wall("modular-suite/walls/harmony/wall_bathhouse_mint_tile.png", [[0.65, -1.15], [3.53, -1.15]], { thickness: 0.15 });
    void wB1; void wB2; void wB3;
    // 3 Hero Ceramic Steam Soaking Tubs + Copper Heated Towel Racks + Resting Lounge!
    f.obj("modular-suite/props/boulevard_shops/bs_volksbad_tiled_soaking_tub.png", -2.05, -2.75, 2.08, 1.30, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_volksbad_tiled_soaking_tub.png", -2.05, 0.20, 2.08, 1.30, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_volksbad_tiled_soaking_tub.png", 1.95, -2.75, 2.08, 1.30, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_volksbad_towel_warmer_rack.png", -2.25, 2.95, 1.26, 0.84, FACE_SW, { z: 62 });
    f.obj("modular-suite/props/boulevard_shops/bs_volksbad_towel_warmer_rack.png", 2.65, 0.05, 1.26, 0.84, FACE_NW, { z: 62 });
    f.obj("modular-suite/props/harmony_arch/int_washroom_marble_vanity.png", -0.65, 3.65, 1.44, 0.72, FACE_SW, { z: 62 });
    f.obj("modular-suite/props/bare_furniture/bare_rustic_bench.png", 1.45, 0.45, 1.44, 0.48, FACE_NW, { z: 60 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 0.05, -3.55, 0.72, 0.68, 0.3, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 2.85, 1.25, 0.72, 0.68, -0.4, { z: 64 });
    f.obj("modular-suite/props/weathering_overlays/wth_puddle_rain_film_sheen.png", -0.25, -0.35, 1.80, 1.30, 0.25, { z: 48, shadow: false, opacity: 0.58 });
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", r2StairU, r2StairV, 1.20, 1.50, FACE_SW, { z: 54 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 0.0, -1.65, 0.96, 0.96, 0, { z: 90, opacity: 0.85, shadow: false });
    f.light("R2 2F Volksbad Steam Glow", -0.25, -1.55, 6.8, "#8BE8E8", 0.92);
    f.light("R2 2F Volksbad Lounge Warm", 1.35, 1.65, 5.2, "#FFD28A", 0.84);
    f.note("NOTE", 0.0, -0.65, "2F · Volksbad Herbal Steam Bathhouse", "Beloved neighborhood public bathhouse tiled in mint ceramic & cobalt mosaic. Locals trade city gossip over eucalyptus steam while a secret loose floor tile drains down into the 1F boiler flue.", "#38BDF8");
  }

  // --- R2 · 3F: Working-Class Boardinghouse (2 Cozy Flats: 3A Front + 3B Rear) ---
  {
    const f = makeRoomHelper(R2, "3f", f3Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png");
    f.buildShell("modular-suite/walls/harmony/wall_berlin_dressed_sandstone.png", {
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.85, w: 1.3 },
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: 1.85, w: 1.3 },
      ],
      rearWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.65, w: 1.25 },
      ],
    });
    const w3 = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[-3.53, 0.15], [1.15, 0.15], [1.15, 4.24]], { thickness: 0.15 });
    const w3b = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[1.15, 0.15], [3.53, 0.15]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", 2.15, 0.15, PORTAL_U, "door", 0.92, true, w3b);
    f.portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", 1.15, 2.25, PORTAL_V, "door", 0.92, true, w3);
    // Flat 3A (Front, Tram #14 Conductor's Suite)
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 0.15, -2.05, 2.6, 1.8, FACE_SW, { z: 46, shadow: false, recolor: PRUSSIAN });
    f.obj("modular-suite/props/watchtower_garrison/wt_garrison_bunk_cot.png", -2.35, -2.35, 1.04, 1.60, FACE_SE, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", -2.65, -0.75, 0.64, 0.61, FACE_SE, { z: 60 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png", -2.65, -0.75, 0.40, 0.40, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/bare_furniture/bare_pine_worktable.png", 0.55, -2.15, 1.32, 0.86, FACE_SW, { z: 62 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 0.55, -1.25, 0.62, 0.66, FACE_SW, { z: 58 });
    f.obj("modular-suite/props/kitchen/kit_iron_cookstove.png", 2.55, -2.75, 1.12, 0.99, FACE_NW, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 2.65, -0.95, 1.16, 1.00, FACE_NW, { z: 64 });
    // Flat 3B (Rear-West, Seamstress's Cozy Suite)
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", -1.15, 2.25, 2.1, 2.1, 0, { z: 46, shadow: false, recolor: WARM_TEAL });
    f.obj("modular-suite/props/doctor_apothecary/doc_infirmary_cot.png", -2.25, 2.85, 1.50, 0.90, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_treadle_sewing_machine_desk.png", -0.35, 3.15, 1.30, 0.90, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_washstand_basin.png", -2.55, 1.05, 0.96, 0.76, FACE_SE, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png", -0.25, 1.05, 0.40, 0.40, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", -0.25, 1.05, 0.64, 0.61, FACE_SW, { z: 60 });
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", r2StairU, r2StairV, 1.20, 1.50, FACE_SW, { z: 54 });
    f.light("R2 3F Flat 3A Warm Lamp", -0.25, -2.05, 5.8, "#FFC26B", 0.88, true);
    f.light("R2 3F Flat 3B Sewing Lamp", -1.15, 2.15, 5.2, "#FFB85C", 0.84, true);
  }

  // --- R2 · 4F: Top-Floor Timber Attic Garret & Rainy-Day Drying Loft ---
  {
    const f = makeRoomHelper(R2, "4f", f4Out);
    f.floor("modular-suite/terrain/harmony/flr_weathered_attic_planks.png");
    f.buildShell("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", {
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: 0.0, w: 1.35 },
      ],
      rearWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.35, w: 1.25 },
      ],
      thickness: 0.18,
    });
    // Rainy-day indoor laundry drying lines + boarder cots + steamer trunks + dusty attic cobwebs!
    f.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", -1.55, -1.95, 1.70, 1.01, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_hanging_garment_rack_brass.png", 1.55, -2.25, 2.00, 0.875, FACE_SW, { z: 66 });
    f.obj("modular-suite/props/doctor_apothecary/doc_infirmary_cot.png", -2.25, 1.55, 1.50, 0.90, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/doctor_apothecary/doc_infirmary_cot.png", -2.25, 2.95, 1.50, 0.90, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_brass_footlocker.png", -0.65, 2.25, 1.05, 0.77, FACE_NW, { z: 62 });
    f.obj("modular-suite/props/subterranean_caves/sub_cellar_rolled_carpets_trunk.png", 0.35, -0.25, 1.30, 1.04, 0.25, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 2.35, -0.35, 0.78, 0.72, -0.3, { z: 62 });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_dust_film_veil.png", -0.85, 0.15, 1.80, 1.80, 0.2, { z: 72, shadow: false, opacity: 0.45 });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_cobweb_dust_corner.png", -2.85, -3.55, 1.10, 1.10, FACE_SW, { z: 75, shadow: false, opacity: 0.72 });
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", r2StairU, r2StairV, 1.20, 1.50, FACE_SW, { z: 54 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_iron_dome_pendant.png", 0.0, -0.45, 0.96, 0.96, 0, { z: 90, opacity: 0.85, shadow: false });
    f.light("R2 4F Attic Drying Loft", 0.0, -0.45, 6.2, "#FFB860", 0.86, true);
    f.note("NOTE", -0.25, -0.55, "4F · Dampf & Glanz Attic Drying Loft (+42ft)", "Sloped timber garret where boarders sleep beside steam-warmed rainy-day laundry racks, overlooking both the Cathedral Spires and the sunny SE Hinterhof gardens.", "#F59E0B");
  }

  // =========================================================================
  // BUILDING #3 (`dd-shape-floor-1-4`, 3 STORIES: 1F–3F)
  // "Eulenblick Antiquarian Bookshop, Curiosities & Horology"
  //   Center: (36.0, 41.0), 7.07 × 5.66 | B1 Relic Cellar Stair: (35.80, 38.40)
  //   Aligned 1F↔2F↔3F Oak Stairwell: u = +2.25, v = +1.55
  // =========================================================================
  const R3 = ROW_SPECS[2];
  const r3StairU = 2.25;
  const r3StairV = 1.55;

  // --- R3 · 1F: Eulenblick Antiquarian Bookshop & Curiosities ---
  {
    const f = makeRoomHelper(R3, "1f", f1Out);
    f.floor("modular-suite/terrain/harmony/flr_dark_walnut_parquet.png");
    f.buildShell("modular-suite/walls/harmony/wall_flemish_cream_crimson_brick.png", {
      frontDoor: { asset: "modular-suite/portals/harmony/door_shop_emerald_glass.png", u: 0.0, w: 1.25 },
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_bay_apothecary_emerald.png", u: -2.05, w: 1.4 },
        { asset: "modular-suite/portals/harmony/win_bay_apothecary_emerald.png", u: 2.05, w: 1.4 },
      ],
      rearDoor: { asset: "modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", u: 0.25, w: 0.95 },
    });
    // Scalloped Emerald & Gold Bookshop Awning outside over Souverän-Allee!
    f.obj("modular-suite/props/boulevard_shops/bs_bookshop_awning_emerald.png", 0.0, -3.37, 3.04, 1.12, FACE_SW, { z: 86 });
    // Center royal violet medallion rug + curved beveled-glass curio display cases!
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 0.0, -0.65, 2.5, 2.5, 0, { z: 46, shadow: false, recolor: ROYAL_VIOLET });
    f.obj("modular-suite/props/boulevard_shops/bs_curio_glass_display_case.png", -1.65, -1.65, 2.00, 1.00, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_curio_glass_display_case.png", 1.75, -1.65, 2.00, 1.00, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_antiquarian_appraisal_desk.png", -0.15, 0.35, 1.87, 1.10, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_tiffany_sovereign_lamp.png", 0.35, 0.25, 0.44, 0.44, 0, { z: 70, shadow: false });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -0.15, 1.25, 0.62, 0.66, FACE_SW, { z: 58 });
    // Floor-to-ceiling bookcases, grandfather clock & towering floor book stacks!
    f.obj("core-fantasy/hero/hero_library_bookcase.png", -2.95, -0.35, 1.54, 1.00, FACE_SE, { z: 64 });
    f.obj("core-fantasy/hero/hero_library_bookcase.png", 2.95, -0.35, 1.54, 1.00, FACE_NW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_grandfather_orrery_clock.png", 1.15, 2.05, 0.90, 0.81, FACE_SW, { z: 66 });
    f.obj("modular-suite/props/boulevard_shops/bs_rare_books_stack_pedestal.png", -1.75, -0.15, 1.02, 0.85, 0.25, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_tiffany_stained_pendant.png", 0.0, -0.75, 0.98, 0.98, 0, { z: 90, opacity: 0.86, shadow: false });
    // EXACT B1-aligned Relic Cellar Stair at (35.80, 38.40) + 1F→2F→3F Oak Stairwell!
    f.objWorld("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 35.80, 38.40, 0.99, 1.44, Q, { z: 54 });
    f.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", r3StairU, r3StairV, 0.97, 1.50, FACE_SW, { z: 54 });
    f.light("R3 1F Bookshop Tiffany Glow", 0.0, -0.65, 6.2, "#FFC26B", 0.92, true);
    f.light("R3 1F Appraisal Lamp", 0.25, 0.45, 4.4, "#8CE4FF", 0.64);
    f.note("NOTE", 0.0, -0.25, "1F · Eulenblick Antiquarian Bookshop & Curios (3F)", "Dusty leather folios, beveled-glass relic cases, and chiming celestial clocks fill this shop opposite the Cathedral. Rear stairs drop straight to the B1 Relic Cellar!", "#A855F7");
  }

  // --- R3 · 2F: Clockwork Horology Studio & Rare Folio Reading Gallery ---
  {
    const f = makeRoomHelper(R3, "2f", f2Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png");
    f.buildShell("modular-suite/walls/harmony/wall_flemish_cream_crimson_brick.png", {
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.85, w: 1.3 },
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: 1.85, w: 1.3 },
      ],
      rearWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.35, w: 1.2 },
      ],
    });
    const wDiv = f.wall("modular-suite/walls/harmony/wall_oak_wainscot_parlor.png", [[-0.25, -2.82], [-0.25, 0.75]], { thickness: 0.15 });
    void wDiv;
    // NW Clockwork Horology Restoration Studio
    f.obj("modular-suite/props/boulevard_shops/bs_clockmaker_horology_bench.png", -1.95, -1.55, 2.08, 1.10, FACE_NE, { z: 64 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -1.95, -0.55, 0.62, 0.66, FACE_SW, { z: 58 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_articulated_brass_lamp.png", -2.55, -1.65, 0.44, 0.44, 0.4, { z: 70, shadow: false });
    f.obj("modular-suite/props/boulevard_shops/bs_rare_books_stack_pedestal.png", -2.45, 1.45, 1.02, 0.85, -0.25, { z: 62 });
    f.obj("modular-suite/props/ship_captain_cabin/ship_brass_armillary_globe.png", -0.85, 1.85, 0.86, 0.86, 0.2, { z: 64 });
    // SE Rare Folio & Cartography Reading Gallery
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 1.55, -0.95, 2.4, 1.8, FACE_SW, { z: 46, shadow: false, recolor: EMERALD });
    f.obj("modular-suite/colorable/col_armchair_club.png", 0.75, -1.75, 0.88, 0.88, FACE_SE, { z: 62, recolor: EMERALD });
    f.obj("modular-suite/colorable/col_armchair_club.png", 2.45, -1.75, 0.88, 0.88, FACE_NW, { z: 62, recolor: EMERALD });
    f.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 1.60, -1.55, 0.88, 0.88, 0, { z: 62 });
    f.obj("modular-suite/colorable/col_spellbook_tome.png", 1.60, -1.55, 0.44, 0.44, 0.3, { z: 68, shadow: false, recolor: ROYAL_VIOLET });
    f.obj("core-fantasy/hero/hero_library_bookcase.png", 2.95, -0.35, 1.45, 0.94, FACE_NW, { z: 64 });
    f.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", r3StairU, r3StairV, 0.97, 1.50, FACE_SW, { z: 54 });
    f.light("R3 2F Horology Cyan Lens", -1.95, -1.35, 5.2, "#7AE6FF", 0.86);
    f.light("R3 2F Reading Gallery Lamp", 1.55, -1.15, 5.4, "#FFC470", 0.88);
  }

  // --- R3 · 3F: Eccentric Antiquarian's Collector Flat & Telescope Nook ---
  {
    const f = makeRoomHelper(R3, "3f", f3Out);
    f.floor("modular-suite/terrain/harmony/flr_weathered_attic_planks.png");
    f.buildShell("modular-suite/walls/harmony/wall_flemish_cream_crimson_brick.png", {
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_bay_iron_conservatory.png", u: -1.65, w: 1.4 },
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: 1.65, w: 1.25 },
      ],
      rearWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.35, w: 1.2 },
      ],
    });
    // Brass Refractor Telescope pointed right out the front SW window at the Cathedral Astral Orrery!
    f.obj("modular-suite/props/boulevard_shops/bs_telescope_brass_tripod.png", -1.65, -1.65, 1.21, 0.99, FACE_SW + Math.PI / 2, { z: 66 });
    f.obj("modular-suite/props/music_theater_tea/mus_brass_gramophone.png", -2.65, -0.25, 0.80, 0.76, 0.4, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_rare_books_stack_pedestal.png", -2.45, 1.55, 1.02, 0.85, 0.1, { z: 62 });
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 0.35, -0.35, 2.2, 2.2, 0, { z: 46, shadow: false, recolor: ANTIQUE_GOLD });
    f.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 0.25, -0.45, 0.56, 0.56, 0.4, { z: 62 });
    f.obj("modular-suite/props/watchtower_garrison/wt_garrison_bunk_cot.png", 2.05, -1.35, 1.04, 1.60, FACE_NW, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 0.75, -2.05, 0.64, 0.61, FACE_SW, { z: 60 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", 0.75, -2.05, 0.40, 0.40, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_copper_bathtub.png", -0.65, 1.95, 1.56, 0.90, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", r3StairU, r3StairV, 0.97, 1.50, FACE_SW, { z: 54 });
    f.light("R3 3F Collector Flat Lamp", 0.15, -0.85, 5.8, "#FFBE6B", 0.88, true);
    f.note("SECRET", -1.65, -1.65, "3F · Antiquarian's Orrery Telescope", "Fixed permanently on the Cathedral's 5F Brass Astral Orrery across Souverän-Allee, the old horologist's notebook tracks anomalous violet leyline surges every third midnight.", "#A855F7");
  }

  // =========================================================================
  // BUILDING #4 (`dd-shape-floor-1-3`, 2 STORIES: 1F–2F — CORNER ATELIER!)
  // "Seide & Sohle Bespoke Tailor, Milliner & Cobbler Atelier"
  //   Center: (43.0, 45.5), 7.78 × 6.36 | B1 Dye-Cellar Stair: (43.20, 42.30)
  //   Aligned 1F↔2F Oak Stairwell: u = +2.55, v = +1.95
  // =========================================================================
  const R4 = ROW_SPECS[3];
  const r4StairU = 2.55;
  const r4StairV = 1.95;

  // --- R4 · 1F: Seide & Sohle Bespoke Tailor & Cobbler Atelier ---
  {
    const f = makeRoomHelper(R4, "1f", f1Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png");
    f.buildShell("modular-suite/walls/harmony/wall_fachwerk_brick_infill.png", {
      frontDoor: { asset: "modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", u: 0.0, w: 1.3 },
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_bay_bakery_warm.png", u: -2.25, w: 1.45 },
        { asset: "modular-suite/portals/harmony/win_bay_bakery_warm.png", u: 2.25, w: 1.45 },
      ],
      rearDoor: { asset: "modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", u: 0.35, w: 1.0 },
    });
    // Colorable Boulevard Shop Awning tinted royal plum hanging outside over Souverän-Allee!
    f.obj("modular-suite/props/boulevard_shops/bs_shop_colorable_boulevard_awning.png", 0.0, -3.72, 3.04, 1.12, FACE_SW, {
      z: 86, recolor: ROYAL_PLUM,
    });
    // Centerpiece Mahogany Tailor's Cutting & Pattern Table + Fitting Podium + Mannequins!
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 1.65, -1.55, 2.3, 2.3, 0, { z: 46, shadow: false, recolor: ROYAL_PLUM });
    f.obj("modular-suite/props/boulevard_shops/bs_tailor_cutting_pattern_table.png", -0.25, -0.55, 2.28, 1.20, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_tailor_dressmaker_mannequins.png", -1.95, -2.35, 1.10, 0.90, FACE_SW, { z: 66 });
    f.obj("modular-suite/props/boulevard_shops/bs_tailor_fitting_mirror_platform.png", 1.75, -1.75, 1.43, 1.10, FACE_NW, { z: 66 });
    f.obj("modular-suite/props/boulevard_shops/bs_treadle_sewing_machine_desk.png", 0.55, 1.45, 1.30, 0.90, FACE_SW, { z: 64 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 0.55, 2.25, 0.62, 0.66, FACE_SW, { z: 58 });
    // Colorable silk & wool fabric bolt display shelves (emerald + Prussian navy!) + cobbler bootmaker bench!
    f.obj("modular-suite/props/boulevard_shops/bs_tailor_colorable_cloth_display.png", 3.15, 0.15, 1.65, 0.88, FACE_NW, { z: 64, recolor: EMERALD });
    f.obj("modular-suite/props/boulevard_shops/bs_tailor_colorable_cloth_display.png", -0.55, 2.55, 1.65, 0.88, FACE_SW, { z: 64, recolor: PRUSSIAN });
    f.obj("modular-suite/props/boulevard_shops/bs_cobbler_bootmaker_bench.png", -2.95, -0.15, 1.88, 1.06, FACE_SE, { z: 64 });
    f.obj("modular-suite/props/market_tailor/mkt_sewing_basket.png", 1.25, -0.35, 0.58, 0.58, 0.25, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_banquet_brass_chandelier.png", 0.15, -0.85, 1.08, 1.08, 0, { z: 90, opacity: 0.86, shadow: false });
    // EXACT B1-aligned Dye-Cellar Stair at (43.20, 42.30) + 1F→2F Oak Stairwell!
    f.objWorld("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 43.20, 42.30, 0.99, 1.44, Q, { z: 54 });
    f.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", r4StairU, r4StairV, 0.97, 1.50, FACE_SW, { z: 54 });
    f.light("R4 1F Tailor Atelier Chandelier", 0.15, -0.85, 6.4, "#FFC672", 0.94, true);
    f.light("R4 1F Cobbler Bench Glow", -2.45, 0.15, 4.6, "#FFB347", 0.78);
    f.note("NOTE", -0.25, -0.55, "1F · Seide & Sohle Bespoke Tailor & Cobbler (2F)", "Vibrant neighborhood tailoring & bootmaking atelier displaying bespoke coats in the bay window. The rear stone stair descends to the B1 Dye Cellar — where fresh mortar hides a bricked-up doorway to the B2 Shrine of the Pale Root!", "#10B981");
  }

  // --- R4 · 2F: Master Tailor's Living Flat & Suspicious Pale-Root Mortar Study ---
  {
    const f = makeRoomHelper(R4, "2f", f2Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png");
    f.buildShell("modular-suite/walls/harmony/wall_fachwerk_brick_infill.png", {
      frontWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -2.05, w: 1.3 },
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: 2.05, w: 1.3 },
      ],
      rearWindows: [
        { asset: "modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", u: -1.65, w: 1.25 },
      ],
    });
    // Interior walls dividing Master Bedroom (SW), Family Kitchen/Dining (SE), and Locked Back Study (NW-rear)!
    const wStudy = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[-3.88, 0.25], [-0.45, 0.25], [-0.45, 3.18]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", -0.45, 1.65, PORTAL_V, "door", 0.92, true, wStudy);
    // Master Bedroom (front-NW)
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", -1.95, -1.25, 2.6, 1.8, FACE_SW, { z: 46, shadow: false, recolor: CRIMSON });
    f.obj("core-fantasy/hero/hero_noble_canopy_bed.png", -2.35, -1.20, 1.80, 1.91, FACE_SE, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", -0.75, -2.40, 1.16, 1.00, FACE_NE, { z: 64 });
    // Family Kitchen & Dining Room (front-SE)
    f.obj("modular-suite/props/kitchen/kit_iron_cookstove.png", 2.95, -2.15, 1.12, 0.99, FACE_NW, { z: 64 });
    f.obj("modular-suite/props/bare_furniture/bare_pine_worktable.png", 1.35, -1.35, 1.48, 0.96, FACE_SW, { z: 62 });
    f.obj("modular-suite/props/bakery/bak_lattice_cherry_pie.png", 1.35, -1.35, 0.44, 0.44, 0.2, { z: 68, shadow: false });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 1.35, -2.25, 0.62, 0.66, FACE_NE, { z: 58 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 1.35, -0.45, 0.62, 0.66, FACE_SW, { z: 58 });
    f.obj("modular-suite/props/bedroom_home/home_washstand_basin.png", 2.95, -0.45, 0.96, 0.76, FACE_NW, { z: 62 });
    // Suspicious Locked Back Study (NW-rear): mortar dust, clerk desk, emerald banker lamp & pale-root notes!
    f.obj("modular-suite/props/post_office/po_bare_clerk_desk.png", -2.35, 1.85, 1.44, 0.96, FACE_SE, { z: 64 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", -2.25, 2.15, 0.42, 0.42, 0, { z: 70, shadow: false });
    f.obj("modular-suite/colorable/col_spellbook_tome.png", -2.35, 1.65, 0.44, 0.44, -0.25, { z: 68, shadow: false, recolor: EMERALD });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -1.45, 1.85, 0.62, 0.66, FACE_NW, { z: 58 });
    f.obj("modular-suite/props/weathering_overlays/wth_crumbled_mortar_gravel_edge.png", -2.15, 0.85, 1.60, 0.80, FACE_SW, { z: 48, shadow: false, opacity: 0.76 });
    f.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", r4StairU, r4StairV, 0.97, 1.50, FACE_SW, { z: 54 });
    f.light("R4 2F Tailor Living Room", 0.35, -1.35, 6.2, "#FFC26B", 0.90, true);
    f.light("R4 2F Locked Study Lamp", -2.15, 1.85, 4.6, "#34D399", 0.74);
    f.note("SECRET", -2.15, 1.85, "2F · Tailor's Locked Pale-Root Study", "White lime-mortar dust coats a pair of leather boots beside a locked desk holding pressed bone-white roots and sketches of the B1 dye-cellar false brick wall below!", "#10B981");
  }

  // Export slightly padded outer polygons (+0.18) for automated upper-floor bounds validation
  const padPoly = (spec: RowhouseSpec) =>
    rowRect(spec, -spec.halfU - 0.18, -spec.halfV - 0.18, spec.halfU + 0.18, spec.halfV + 0.18);

  return {
    row1Poly: padPoly(R1),
    row2Poly: padPoly(R2),
    row3Poly: padPoly(R3),
    row4Poly: padPoly(R4),
  };
}

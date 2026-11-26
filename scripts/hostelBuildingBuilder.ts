/**
 * Builds the 3-Story Canal-Side Shared-Living Hostel ("Wanderer's Hearth" / Herberge am Kanal)
 * inside the east-edge diagonal 7-vertex footprint (`dd-wall-1-23` / `dd-roof-0-2`):
 *
 *  "Wanderer's Hearth Hostel" (3 Stories: 1F–3F + Weathered Cedar Shakes Roof + B1 Cellar Tie-In):
 *   - 1F (0ft): Reception & Check-In Desk, Entryway Backpack/Boot Cubby, "Wanderer's Hearth"
 *       Communal Lounge & Long Dining/Map Table, Brick Kettle Fireplace, Self-Catering
 *       Shared Kitchen Galley, Backyard Firewood Door, and Secret Cellar Descent Hatch
 *       aligned directly over `B1`'s illicit Moonshine Copper Still (`(45.6, 29.8)`)!
 *   - 2F (+14ft): Main Shared 8-Bed Bunk Dormitory (4 colorable double-decker bunks with
 *       side ladders & privacy curtains), Padlock Gear Locker Bank, Berlin Kachelofen Stove,
 *       Traveler Clutter & Book-Swap Nook, plus a Partitioned Communal Multi-Tap Washroom & WC!
 *   - 3F (+28ft): Weathered Attic Timber Floor divided by Cream Fachwerk Partitions into a
 *       SW Quiet Attic Dorm (2 privacy-curtained bunks = 4 berths), a NE Private Budget Garret
 *       Room, and a Central Shared Floor-Cushion Hangout & Tea Loft with drying clothesline!
 *   - ROOF (+70ft): Upgrades `dd-roof-0-2` to Weathered Cedar Shakes (`roof_weathered_cedar_shakes.png`).
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

// Exact 7-vertex east-edge diagonal footprint of `dd-wall-1-23`
export const HOSTEL_POLY: Point2D[] = [
  { x: 47.5, y: 32.0 },
  { x: 46.0, y: 32.0 },
  { x: 42.0, y: 36.0 },
  { x: 40.0, y: 36.0 },
  { x: 40.0, y: 33.0 },
  { x: 46.0, y: 28.0 },
  { x: 47.5, y: 28.0 },
];

// Exterior edge alignment angles (radians)
const ANG_NW = Math.atan2(-5.0, 6.0); // E4: (40,33)->(46,28) (-39.81°) — back flush against NW wall!
const ANG_SE = -Math.PI / 4; // E1: (42,36)->(46,32) (-45°) — add Math.PI for back flush against SE wall!

// Aligned 3-story hostel switchback stairwell center (1F ↔ 2F ↔ 3F)
export const HOSTEL_STAIR_X = 46.82;
export const HOSTEL_STAIR_Y = 31.18;

// Existing B1 cellar stone stair center (`sub-b1-obj-309`) directly beneath the 1F kitchen pantry
export const HOSTEL_B1_STAIR_X = 45.6;
export const HOSTEL_B1_STAIR_Y = 29.8;

function tint(hex: string, strength = 0.9): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

// Cozy mismatched hostel quilt & textile palettes
const H_TERRACOTTA = tint("#B85038", 0.90);
const H_TEAL = tint("#2E7A7E", 0.90);
const H_SAGE = tint("#4D7E58", 0.90);
const H_MUSTARD = tint("#C68E2E", 0.90);
const H_INDIGO = tint("#3C4F82", 0.90);
const H_PLUM = tint("#7A3E6A", 0.90);
const H_ROSE = tint("#A64A62", 0.90);
const H_AMBER = tint("#B66A34", 0.88);

function makeFloorHelper(floorTag: string, bundle: IceCreamBuildBundle) {
  let seq = 0;
  const uid = (k: string) => `hs-${floorTag}-${k}-${++seq}`;

  const floor = (assetId: string, points: Point2D[] = HOSTEL_POLY) => {
    const t: TerrainStroke = {
      id: uid("flr"),
      assetId,
      shape: "polygon",
      points: points.map((p) => ({ x: p.x, y: p.y })),
      radiusCells: 0,
      opacity: 1,
      softness: 0,
    };
    bundle.terrain.push(t);
  };

  const wall = (
    assetId: string,
    pts: Array<[number, number]>,
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean } = {},
  ): string => {
    const id = uid("wal");
    const w: WallSegment = {
      id,
      assetId,
      points: pts.map(([x, y]) => ({ x, y })),
      closed: Boolean(opts.closed),
      curved: false,
      thicknessCells: opts.thickness ?? 0.16,
      blocksLight: opts.blocksLight ?? true,
    };
    bundle.walls.push(w);
    return id;
  };

  const portal = (
    assetId: string,
    x: number,
    y: number,
    rot: number,
    kind: PortalNode["kind"],
    widthCells: number,
    closed: boolean,
    wallId?: string,
  ) => {
    bundle.portals.push({
      id: uid("prt"),
      assetId,
      kind,
      wallId,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      rotationRad: rot,
      widthCells,
      closed,
      locked: false,
      blocksLightWhenClosed: kind !== "window",
    });
  };

  const obj = (
    assetId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    rot = 0,
    opts: { z?: number; shadow?: boolean; flipX?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    const o: ObjectStamp = {
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
    };
    bundle.objects.push(o);
  };

  const light = (
    name: string,
    x: number,
    y: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.88,
    flicker = false,
  ) => {
    const ln: LightNode = {
      id: uid("lgt"),
      name,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
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
    x: number,
    y: number,
    title: string,
    body: string,
    colorHex = "#F59E0B",
  ) => {
    bundle.dmNotes.push({
      id: uid("note"),
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      badge,
      title,
      body,
      colorHex,
    });
  };

  /** Builds the 7-vertex warm river-stone/timber hostel shell with sunlit windows */
  const buildOuterShell = (isGround: boolean) => {
    const extId = wall(
      isGround
        ? "modular-suite/walls/harmony/wall_river_stone_cottage.png"
        : "modular-suite/walls/harmony/wall_fachwerk_cream_oak.png",
      HOSTEL_POLY.map((p) => [p.x, p.y] as [number, number]),
      { closed: true, thickness: 0.21 },
    );

    if (isGround) {
      // West Main Hostel Entrance off the cobblestone garden path (E3)
      portal("modular-suite/portals/harmony/door_cottage_sage_dutch.png", 40.0, 34.5, Math.PI / 2, "door", 1.05, false, extId);
      // SE Backyard Firewood & Garden Door (E1)
      portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", 44.15, 33.85, ANG_SE, "door", 0.95, false, extId);
      // Sunlit NW Laundry-Yard & SE Garden Windows
      portal("modular-suite/portals/harmony/win_flowerbox_cottage_rose.png", 42.10, 31.25, ANG_NW, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 44.65, 29.12, ANG_NW, "window", 1.10, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_cottage_rose.png", 42.75, 35.25, ANG_SE, "window", 1.10, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 45.25, 32.75, ANG_SE, "window", 1.00, true, extId);
    } else {
      // Upper-story dormitory & attic windows facing the laundry yard, canal & backyard trees
      portal("modular-suite/portals/harmony/win_flowerbox_cottage_rose.png", 40.0, 34.5, Math.PI / 2, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_cottage_rose.png", 41.95, 31.38, ANG_NW, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 43.95, 29.71, ANG_NW, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 45.35, 28.54, ANG_NW, "window", 0.95, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_cottage_rose.png", 43.10, 34.90, ANG_SE, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 44.90, 33.10, ANG_SE, "window", 1.10, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_dark.png", 41.0, 36.0, 0, "window", 0.95, true, extId);
    }
    return extId;
  };

  return { floor, wall, portal, obj, light, note, buildOuterShell };
}

export function buildSharedLivingHostel(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
  f2Out: IceCreamBuildBundle,
  f3Out: IceCreamBuildBundle,
): { hostelPoly: Point2D[] } {
  // Replace legacy Dungeondraft windowless wall `dd-wall-1-23` with warm Harmony stone/timber shell!
  const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1");
  if (groundWalls?.walls) {
    groundWalls.walls = groundWalls.walls.filter((w) => w.id !== "dd-wall-1-23");
  }

  // Upgrade the diagonal gable roof `dd-roof-0-2` to warm Weathered Cedar Shakes!
  const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs");
  if (roofLayer?.roofs) {
    const r: RoofStructure | undefined = roofLayer.roofs.find((x) => x.id === "dd-roof-0-2");
    if (r) {
      r.assetId = "modular-suite/terrain/harmony/roof_weathered_cedar_shakes.png";
    }
  }

  // =========================================================================
  // 1F (0ft): RECEPTION, WANDERER'S HEARTH LOUNGE, SHARED KITCHEN & B1 CELLAR HATCH
  // =========================================================================
  {
    const f = makeFloorHelper("1f", f1Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", HOSTEL_POLY);
    // Terracotta kitchen quarry tile in the NE communal self-catering kitchen corner
    f.floor("modular-suite/terrain/harmony/flr_terracotta_kitchen_quarry.png", [
      { x: 44.6, y: 29.17 },
      { x: 46.0, y: 28.0 },
      { x: 47.5, y: 28.0 },
      { x: 47.5, y: 30.45 },
      { x: 44.9, y: 30.45 },
    ]);
    f.buildOuterShell(true);

    // --- EXTERIOR WEST PATH & BACKYARD HOSTEL FRONTAGE ---
    f.obj("modular-suite/props/hostel_living/hs_hostel_awning_terracotta_stripe.png", 39.62, 34.50, 1.88, 0.73, Math.PI / 2, { z: 86 });
    f.obj("modular-suite/props/harmony_arch/facade_sign_inn_lantern.png", 39.56, 33.18, 0.78, 0.62, Math.PI / 2, { z: 82 });
    f.obj("modular-suite/props/harmony_arch/str_noticeboard_civic.png", 44.95, 33.48, 1.05, 0.45, ANG_SE + Math.PI, { z: 66 });

    // --- SW CHECK-IN FOYER & TRAVELER CUBBY (x = 40.2..42.6, y = 32.0..35.8) ---
    f.obj("modular-suite/props/harmony_arch/floor_doormat_coir_rustic.png", 40.50, 34.50, 0.78, 0.52, Math.PI / 2, { z: 48, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_woven_doormat.png", 43.88, 33.58, 0.68, 0.45, ANG_SE, { z: 48, shadow: false });
    f.obj("modular-suite/props/hostel_living/hs_hostel_reception_desk.png", 41.72, 32.32, 1.80, 0.90, ANG_NW, { z: 64 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", 41.42, 32.52, 0.36, 0.36, 0, { z: 72, shadow: false });
    f.obj("modular-suite/props/hostel_living/hs_traveler_backpack_cubby.png", 41.05, 35.48, 1.44, 0.67, Math.PI, { z: 64 });
    f.obj("modular-suite/props/school_courtroom/sch_coat_rack_stand.png", 40.45, 33.42, 0.54, 0.54, 0.2, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 42.10, 35.35, 0.56, 0.53, -0.3, { z: 64 });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_scuff_scratch_patina.png", 41.15, 34.30, 1.50, 1.20, 0.15, { z: 48, shadow: false, opacity: 0.46 });

    // --- CENTRAL "WANDERER'S HEARTH" COMMUNAL LOUNGE & DINING SPINE ---
    f.obj("modular-suite/colorable/col_rug_rect_woven.png", 43.35, 32.85, 2.35, 2.05, ANG_NW, { z: 46, shadow: false, recolor: H_TERRACOTTA });
    f.obj("modular-suite/props/hostel_living/hs_communal_hostel_table.png", 43.25, 33.15, 2.16, 1.08, ANG_NW, { z: 64 });
    f.obj("modular-suite/props/harmony_arch/int_fireplace_brick_kettle.png", 43.71, 30.64, 1.36, 0.85, ANG_NW, { z: 64 });
    f.obj("modular-suite/props/kitchen/kit_kindling_basket.png", 42.82, 31.32, 0.50, 0.44, 0.3, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 44.32, 31.32, 0.50, 0.49, 0.4, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_rocking_chair.png", 45.28, 31.42, 0.72, 0.83, -2.3, { z: 62 });
    f.obj("modular-suite/colorable/col_study_settee.png", 42.72, 34.48, 1.08, 1.08, ANG_SE + Math.PI, { z: 62, recolor: H_TEAL });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_lute.png", 43.38, 34.25, 0.58, 0.59, 0.55, { z: 66 });
    f.obj("modular-suite/props/camp_travel/cmp_leather_backpack.png", 44.95, 32.52, 0.48, 0.58, -0.4, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_copper_kitchen_pendant.png", 43.30, 33.05, 0.86, 0.86, 0, { z: 90, opacity: 0.84, shadow: false });

    // --- NE SELF-CATERING COMMUNAL KITCHEN & ALIGNED B1 CELLAR STAIR HATCH ---
    f.obj("modular-suite/props/hostel_living/hs_shared_kitchen_galley.png", 46.92, 29.22, 2.08, 0.875, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/kitchen/kit_butcher_block.png", 45.65, 28.72, 0.72, 0.73, 0, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_rush_seat_stool.png", 45.20, 29.20, 0.44, 0.49, 0.2, { z: 58 });
    f.obj("modular-suite/props/kitchen/kit_sourdough_boule.png", 45.55, 28.62, 0.34, 0.32, 0.2, { z: 68, shadow: false });
    f.obj("modular-suite/props/kitchen/kit_vegetable_basket.png", 45.82, 28.88, 0.42, 0.42, -0.25, { z: 68, shadow: false });
    // Secret cellar descent stairs aligned 100% directly above B1's `sub-b1-obj-309`!
    f.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", HOSTEL_B1_STAIR_X, HOSTEL_B1_STAIR_Y, 0.94, 1.36, Math.PI / 2, { z: 52 });
    f.obj("modular-suite/props/kitchen/kit_grain_sack.png", 44.78, 30.05, 0.50, 0.50, 0.25, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_dirty_plates_pan_stack.png", 46.22, 28.42, 0.46, 0.42, 0.15, { z: 64 });

    // --- SE-EAST ALIGNED 3-STORY HOSTEL STAIRWELL (1F ↔ 2F ↔ 3F) ---
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", HOSTEL_STAIR_X, HOSTEL_STAIR_Y, 1.04, 1.30, 0, { z: 54 });
    f.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 46.15, 31.68, 0.48, 0.48, Math.PI, { z: 76, shadow: false });

    // 1F Lights & DM Notes
    f.light("Hostel 1F Hearth Fire", 43.75, 30.95, 5.4, "#FFAE52", 0.94, true);
    f.light("Hostel 1F Reception Lamp", 41.45, 32.75, 4.6, "#FFC874", 0.86, true);
    f.light("Hostel 1F Shared Kitchen", 46.10, 29.35, 4.8, "#FFD48A", 0.86);
    f.light("Hostel 1F Porch Lantern", 39.45, 34.40, 4.2, "#FFB85C", 0.82, true);
    f.note(
      "NOTE",
      43.25,
      33.15,
      "1F · Wanderer's Hearth Hostel (3F)",
      "Warm canal-side shared hostel welcoming wanderers, apprentices, and couriers. Features a bustling check-in desk, brick-kettle hearth, communal map & dining table, and a self-catering galley kitchen opening to the firewood garden.",
      "#F59E0B",
    );
    f.note(
      "SECRET",
      HOSTEL_B1_STAIR_X,
      HOSTEL_B1_STAIR_Y,
      "1F · Pantry Cellar Steps → B1 Moonshine Still",
      "The stone pantry steps behind the kitchen grain sack descend straight into the hostel keeper's hidden B1 copper moonshine still and dusty wine cellar!",
      "#A855F7",
    );
  }

  // =========================================================================
  // 2F (+14ft): 8-BED SHARED BUNK DORMITORY, LOCKERS & MULTI-TAP WASHROOM
  // =========================================================================
  {
    const f = makeFloorHelper("2f", f2Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", HOSTEL_POLY);
    // Slate tiled floor inside the partitioned NE Shared Washroom
    f.floor("modular-suite/terrain/harmony/flr_dark_slate_hall_slabs.png", [
      { x: 44.7, y: 29.08 },
      { x: 46.0, y: 28.0 },
      { x: 47.5, y: 28.0 },
      { x: 47.5, y: 30.35 },
      { x: 44.7, y: 30.35 },
    ]);
    f.buildOuterShell(false);

    // Partition wall sealing the NE Shared Multi-Tap Washroom & WC (watertight into E4 at (44.7, 29.08))
    const w2Wash = f.wall("modular-suite/walls/harmony/wall_subway_white_tile.png", [
      [44.7, 29.08],
      [44.7, 30.35],
      [47.5, 30.35],
    ], { thickness: 0.14 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 46.05, 30.35, 0, "door", 0.78, true, w2Wash);

    // --- NE SHARED MULTI-TAP WASHROOM & WC ---
    f.obj("modular-suite/props/hostel_living/hs_shared_wash_trough_mirrors.png", 47.00, 29.20, 1.70, 0.70, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_blue_bathmat_rug.png", 45.32, 29.88, 0.56, 0.41, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_toilet_wc_stall.png", 45.32, 29.36, 0.74, 0.88, 0, { z: 62 });
    f.obj("modular-suite/props/harmony_arch/floor_drain_brass_bathhouse.png", 46.15, 29.28, 0.46, 0.46, 0, { z: 48, shadow: false });

    // --- ALIGNED 2F STAIRWELL + LANDING DETAILS ---
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", HOSTEL_STAIR_X, HOSTEL_STAIR_Y, 1.04, 1.30, 0, { z: 54 });
    f.obj("modular-suite/props/bedroom_home/home_woven_doormat.png", 46.02, 30.72, 0.64, 0.42, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_emerald.png", 45.08, 30.88, 0.78, 0.78, 0, { z: 64 });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_scuff_scratch_patina.png", 45.75, 31.25, 1.35, 1.08, 0.2, { z: 48, shadow: false, opacity: 0.45 });

    // --- MAIN 8-BED SHARED BUNK DORMITORY (4 DOUBLE-DECKER BUNKS = 8 BERTHS!) ---
    f.obj("modular-suite/colorable/col_rug_rect_woven.png", 43.05, 32.75, 2.40, 1.35, ANG_NW, { z: 46, shadow: false, recolor: H_AMBER });
    // Bunk #1 (SW West Wall, Terracotta Quilt)
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_bed_colorable.png", 40.70, 34.72, 1.04, 1.44, 0, { z: 64, recolor: H_TERRACOTTA });
    // Bunk #2 (NW Wall West Bay, Teal Privacy Curtain)
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_curtain_colorable.png", 41.85, 32.58, 1.12, 1.44, ANG_NW, { z: 64, recolor: H_TEAL });
    // Bunk #3 (NW Wall East Bay, Sage Quilt)
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_bed_colorable.png", 43.65, 31.08, 1.04, 1.44, ANG_NW, { z: 64, recolor: H_SAGE });
    // Bunk #4 (SE Wall Bay, Mustard Privacy Curtain)
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_curtain_colorable.png", 43.02, 33.76, 1.12, 1.44, ANG_SE + Math.PI, { z: 64, recolor: H_MUSTARD });

    // Padlock Gear Locker Bank flush along SE Wall near the stairs
    f.obj("modular-suite/props/hostel_living/hs_padlock_locker_bank.png", 45.00, 32.32, 1.60, 0.70, ANG_SE + Math.PI, { z: 64 });

    // Rich Lived-In Backpacker Clutter & Shared Dorm Book-Swap Nook
    f.obj("modular-suite/props/bedroom_home/home_brass_footlocker.png", 41.55, 35.42, 0.84, 0.62, 0, { z: 62 });
    f.obj("modular-suite/props/camp_travel/cmp_leather_backpack.png", 40.68, 33.48, 0.48, 0.58, 0.4, { z: 62 });
    f.obj("modular-suite/props/camp_travel/cmp_tied_bedroll.png", 42.72, 31.65, 0.64, 0.35, ANG_NW, { z: 62 });
    f.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 42.75, 32.18, 0.74, 0.74, 0, { z: 62 });
    f.obj("modular-suite/colorable/col_book_stack.png", 42.65, 32.10, 0.36, 0.36, 0.25, { z: 68, shadow: false, recolor: H_INDIGO });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png", 42.88, 32.26, 0.34, 0.34, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 41.68, 34.48, 0.62, 0.54, -0.3, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_scattered_socks_pair.png", 43.92, 32.55, 0.40, 0.34, 0.45, { z: 60, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_bare_metal_wastebasket.png", 44.38, 30.52, 0.38, 0.38, 0, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 44.52, 31.18, 0.46, 0.46, -Math.PI / 2, { z: 76, shadow: false });

    // 2F Lights & DM Note
    f.light("Hostel 2F Dorm Center Lamp", 42.85, 32.35, 5.4, "#FFC06A", 0.88, true);
    f.light("Hostel 2F Landing Sconce", 45.65, 31.25, 4.4, "#FFC670", 0.84, true);
    f.light("Hostel 2F Shared Washroom", 46.15, 29.25, 3.8, "#DCEEFF", 0.84);
    f.note(
      "NOTE",
      42.75,
      32.18,
      "2F · Main 8-Bed Shared Bunk Dorm & Washroom",
      "Four double-decker timber bunks (8 berths) with mismatched quilts, padlock gear lockers, backpack clutter, and a tiled 3-tap communal washroom & WC.",
      "#38BDF8",
    );
  }

  // =========================================================================
  // 3F (+28ft): ATTIC QUIET DORM (4 BERTHS), PRIVATE GARRET & CUSHION LOFT
  // =========================================================================
  {
    const f = makeFloorHelper("3f", f3Out);
    f.floor("modular-suite/terrain/harmony/flr_weathered_attic_planks.png", HOSTEL_POLY);
    f.buildOuterShell(false);

    // Cream Fachwerk Partitions:
    // 1) NE Private Budget Garret Room stacked cleanly over 2F washroom
    const w3Priv = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [
      [44.7, 29.08],
      [44.7, 30.35],
      [47.5, 30.35],
    ], { thickness: 0.14 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 46.05, 30.35, 0, "door", 0.80, true, w3Priv);

    // 2) SW Quiet Attic Dorm partition sealing cleanly between E4 (42.95, 30.54) and E1 (42.95, 35.05)
    const w3Dorm = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [
      [42.95, 30.54],
      [42.95, 35.05],
    ], { thickness: 0.14 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 42.95, 33.15, Math.PI / 2, "door", 0.84, true, w3Dorm);

    // --- ZONE 3A (SW QUIET ATTIC DORM — 2 PRIVACY-CURTAINED BUNKS = 4 BERTHS!) ---
    f.obj("modular-suite/colorable/col_rug_round_braid.png", 41.72, 34.25, 1.55, 1.55, 0, { z: 46, shadow: false, recolor: H_INDIGO });
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_curtain_colorable.png", 40.70, 34.72, 1.12, 1.44, 0, { z: 64, recolor: H_INDIGO });
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_curtain_colorable.png", 41.78, 32.65, 1.12, 1.44, ANG_NW, { z: 64, recolor: H_PLUM });
    f.obj("modular-suite/props/hostel_living/hs_padlock_locker_bank.png", 42.50, 34.30, 1.44, 0.63, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/camp_travel/cmp_leather_backpack.png", 40.68, 33.42, 0.46, 0.55, -0.35, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 41.58, 35.42, 0.52, 0.50, 0, { z: 60 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_amber_lamp.png", 41.58, 35.42, 0.36, 0.36, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/camp_travel/cmp_tied_bedroll.png", 42.42, 31.68, 0.62, 0.34, ANG_NW, { z: 62 });

    // --- ZONE 3B (NE PRIVATE BUDGET ATTIC ROOM — COZY COUPLE'S/SOLO GARRET) ---
    f.obj("modular-suite/colorable/col_rug_round_braid.png", 46.12, 29.55, 1.35, 1.35, 0, { z: 46, shadow: false, recolor: H_ROSE });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 46.58, 28.86, 1.04, 1.46, Math.PI / 2, { z: 64, recolor: H_ROSE });
    f.obj("modular-suite/props/bedroom_home/home_washstand_basin.png", 45.28, 29.42, 0.74, 0.59, 0, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 46.96, 29.85, 0.48, 0.46, 0, { z: 60 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_rose_lamp.png", 46.96, 29.85, 0.34, 0.34, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 45.55, 28.58, 0.52, 0.49, 0.25, { z: 64 });

    // --- ZONE 3C (CENTRAL ATTIC CUSHION HANGOUT LOFT, DRYING LINE & ALIGNED STAIR) ---
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", HOSTEL_STAIR_X, HOSTEL_STAIR_Y, 1.04, 1.30, 0, { z: 54 });
    f.obj("modular-suite/props/hostel_living/hs_hostel_floor_cushion_nook.png", 44.18, 31.82, 1.56, 1.56, 0.25, { z: 60 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_lute.png", 43.45, 30.82, 0.58, 0.59, -0.45, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", 45.28, 32.16, 1.12, 0.67, ANG_SE + Math.PI, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 43.72, 33.48, 0.58, 0.54, 0.2, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_cardboard_box_open.png", 44.30, 30.65, 0.50, 0.50, 0.15, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 45.48, 30.95, 0.72, 0.63, -0.25, { z: 60, shadow: false });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_dust_film_veil.png", 44.45, 32.05, 1.50, 1.50, 0.1, { z: 72, shadow: false, opacity: 0.34 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 44.18, 31.82, 0.82, 0.82, 0, { z: 90, opacity: 0.84, shadow: false });

    // 3F Lights
    f.light("Hostel 3F Quiet Dorm Lamp", 41.65, 34.45, 4.6, "#FFBC66", 0.84, true);
    f.light("Hostel 3F Attic Cushion Loft", 44.32, 31.95, 5.2, "#FFD28C", 0.88);
    f.light("Hostel 3F Private Garret", 46.25, 29.25, 4.2, "#FFAF96", 0.84, true);
  }

  return { hostelPoly: HOSTEL_POLY };
}

/**
 * Builds the 2-Story Overcrowded Multi-Family Tenement ("The Crowded Nest" / Kinderhaus-Hof)
 * inside the stepped horizontal 8-vertex footprint (`dd-wall-1-22` / `dd-roof-0-3`), sitting
 * directly east of the Community Kid Theater and north of the shared backyard clotheslines:
 *
 *  "The Crowded Nest" (2 Stories: 1F–2F + Tuscan Terracotta Barrel Roof + B1 Cellar Tie-In):
 *   - 1F (0ft):
 *       * Central Pram-Jam Stairwell Hall (`x = 36.2..38.0`): North alley & south laundry-yard
 *         doors, red pull-wagon & tricycle jammed under the stairs, plus parked baby pram &
 *         chalk hopscotch right outside the back door!
 *       * Flat 1A (West — The Brenner Family, Parents + 4 Kids Including Twins): Crammed double
 *         bed with a kid's pillow wedged between the parents, TWO wooden baby cribs, aligned B1
 *         brewery-cellar stone stairs (`(31.4, 25.0)`), family dining table with twin high chairs,
 *         two sibling floor sleeping mats right next to the table, and exploded wooden blocks!
 *       * Flat 1B (East — The Kovacs Family, Grandparents, Parents & 4 Kids): Sardine-tin north
 *         bunk room jammed with 3 double-decker bunks + baby crib + toy chest & train track,
 *         plus a south kitchen-lounge whose sofa has been hijacked into a kids' blanket fort!
 *   - 2F (+14ft):
 *       * Shared Landing, Parked Baby Pram & Tiled Family WC (`x = 36.2..38.0`).
 *       * Flat 2A (West — The Morales Family, Parents + 5 Kids — Ringleaders of the Kid Theater
 *         Next Door!): 2 bunks + floor sleeping mats buried in cardboard swords, fairy wings &
 *         costume trunk, plus a parents' bed-crib-kitchenette room with a tricycle parked inside!
 *       * Flat 2B (East — The Lindqvist Sisters & 4 Young Kids): Double bed + crib + bunk +
 *         floor sleeping mats + indoor drying clothesline strung right over the nursery, plus
 *         a bustling dining table with baby high chairs and laundry mountain!
 *   - ROOF (+70ft): Upgrades `dd-roof-0-3` to Tuscan Terracotta Barrel Tile (`roof_tuscan_terracotta_barrel.png`).
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

// Exact 8-vertex stepped horizontal footprint of `dd-wall-1-22`
export const CROWDED_FAMILY_POLY: Point2D[] = [
  { x: 42.0, y: 27.0 },
  { x: 30.0, y: 27.0 },
  { x: 30.0, y: 23.0 },
  { x: 38.0, y: 23.0 },
  { x: 38.0, y: 22.0 },
  { x: 44.0, y: 22.0 },
  { x: 44.0, y: 25.0 },
  { x: 42.0, y: 25.0 },
];

// Vertically aligned 2-story tenement stairwell center (1F ↔ 2F)
export const CROWDED_FAMILY_STAIR_X = 37.10;
export const CROWDED_FAMILY_STAIR_Y = 24.40;

// Existing B1 brewery-cellar stone stairs (`sub-b1-obj-291`) directly beneath Flat 1A
export const CROWDED_FAMILY_B1_STAIR_X = 31.40;
export const CROWDED_FAMILY_B1_STAIR_Y = 25.00;

function tint(hex: string, strength = 0.9): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

// Lively, mismatched family quilt & bunk palettes
const F_CORAL = tint("#C45448", 0.90);
const F_MUSTARD = tint("#CC922E", 0.90);
const F_SKY = tint("#3E82A8", 0.90);
const F_TEAL = tint("#2E7E7C", 0.90);
const F_SAGE = tint("#4D8256", 0.90);
const F_INDIGO = tint("#3E5088", 0.90);
const F_PLUM = tint("#7E4270", 0.90);
const F_ROSE = tint("#B0506C", 0.90);

function makeFloorHelper(floorTag: string, bundle: IceCreamBuildBundle) {
  let seq = 0;
  const uid = (k: string) => `cf-${floorTag}-${k}-${++seq}`;

  const floor = (assetId: string, points: Point2D[] = CROWDED_FAMILY_POLY) => {
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
      thicknessCells: opts.thickness ?? 0.15,
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

  /** Builds the 8-vertex warm red-brick & cream-plaster family tenement shell */
  const buildOuterShell = (isGround: boolean) => {
    const extId = wall(
      isGround
        ? "modular-suite/walls/harmony/wall_berlin_dressed_sandstone.png"
        : "modular-suite/walls/harmony/wall_fachwerk_cream_oak.png",
      CROWDED_FAMILY_POLY.map((p) => [p.x, p.y] as [number, number]),
      { closed: true, thickness: 0.21 },
    );

    if (isGround) {
      // North Alley Entrance & South Backyard Laundry-Yard Entrance into Shared Central Hall
      portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 37.10, 23.0, 0, "door", 0.96, false, extId);
      portal("modular-suite/portals/harmony/door_cottage_painted_red.png", 36.82, 27.0, 0, "door", 0.96, false, extId);
      // Warm tenement sash & flowerbox windows overlooking Kid Theater (West), Alley (North), & Laundry Yard (South)
      portal("modular-suite/portals/harmony/win_flowerbox_cottage_rose.png", 30.0, 25.0, Math.PI / 2, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 31.4, 23.0, 0, "window", 1.10, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 34.4, 23.0, 0, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 33.8, 27.0, 0, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 39.8, 27.0, 0, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 40.5, 22.0, 0, "window", 1.20, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 44.0, 23.5, Math.PI / 2, "window", 1.10, true, extId);
    } else {
      // Upper-story family windows overlooking the Kid Theater & clotheslines
      portal("modular-suite/portals/harmony/win_flowerbox_cottage_rose.png", 30.0, 25.0, Math.PI / 2, "window", 1.20, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 31.6, 23.0, 0, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 34.5, 23.0, 0, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 37.1, 23.0, 0, "window", 1.00, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 33.8, 27.0, 0, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 39.8, 27.0, 0, "window", 1.15, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 40.6, 22.0, 0, "window", 1.20, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 44.0, 23.5, Math.PI / 2, "window", 1.10, true, extId);
    }
    return extId;
  };

  return { floor, wall, portal, obj, light, note, buildOuterShell };
}

export function buildCrowdedMultiFamilyTenement(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
  f2Out: IceCreamBuildBundle,
): { crowdedFamilyPoly: Point2D[] } {
  // Replace legacy Dungeondraft windowless wall `dd-wall-1-22` with warm Harmony tenement shell!
  const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1");
  if (groundWalls?.walls) {
    groundWalls.walls = groundWalls.walls.filter((w) => w.id !== "dd-wall-1-22");
  }

  // Upgrade the gable roof `dd-roof-0-3` to warm Tuscan Terracotta Barrel Tile!
  const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs");
  if (roofLayer?.roofs) {
    const r: RoofStructure | undefined = roofLayer.roofs.find((x) => x.id === "dd-roof-0-3");
    if (r) {
      r.assetId = "modular-suite/terrain/harmony/roof_tuscan_terracotta_barrel.png";
    }
  }

  // =========================================================================
  // 1F (0ft): CENTRAL PRAM-JAM HALL + FLAT 1A (BRENNER FAMILY) + FLAT 1B (KOVACS FAMILY)
  // =========================================================================
  {
    const f = makeFloorHelper("1f", f1Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", CROWDED_FAMILY_POLY);
    // Scuffed dark slate hall slabs in the central shared hallway
    f.floor("modular-suite/terrain/harmony/flr_dark_slate_hall_slabs.png", [
      { x: 36.2, y: 23.0 },
      { x: 38.0, y: 23.0 },
      { x: 38.0, y: 27.0 },
      { x: 36.2, y: 27.0 },
    ]);
    f.buildOuterShell(true);

    // Interior Structural Walls on 1F
    const w1HallW = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [[36.2, 23.0], [36.2, 27.0]], { thickness: 0.14 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 36.2, 25.35, Math.PI / 2, "door", 0.86, true, w1HallW);

    const w1HallE = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_ochre.png", [[38.0, 23.0], [38.0, 27.0]], { thickness: 0.14 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 38.0, 25.35, Math.PI / 2, "door", 0.86, true, w1HallE);

    // Flat 1A interior room divider (separating cramped nursery/parents alcove from kitchen-playroom)
    const w1AMid = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [[32.55, 23.0], [32.55, 27.0]], { thickness: 0.13 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 32.55, 24.65, Math.PI / 2, "door", 0.82, true, w1AMid);

    // Flat 1B interior room divider (separating north sardine-tin kids' bunk room from south lounge/kitchen)
    const w1BMid = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_ochre.png", [[38.0, 24.55], [42.0, 24.55]], { thickness: 0.13 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 39.25, 24.55, 0, "door", 0.82, true, w1BMid);

    // --- EXTERIOR BACKYARD STOOP & KID CHAOS SPILLING OUTSIDE (y = 27.2..27.8) ---
    f.obj("modular-suite/props/crowded_family/cf_wicker_baby_pram.png", 35.28, 27.55, 0.72, 1.01, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_kids_tricycle_wagon.png", 31.35, 27.58, 0.94, 0.72, -0.22, { z: 64 });
    f.obj("modular-suite/props/community_kid_theater/kt_chalk_hopscotch_stars_decal.png", 38.55, 27.62, 1.40, 0.90, 0.08, { z: 48, shadow: false });
    f.obj("modular-suite/props/harmony_arch/facade_awning_mustard_walnut.png", 36.85, 27.38, 1.85, 0.70, Math.PI, { z: 84 });

    // --- 1F SHARED CENTRAL STAIRWELL HALL (PRAM & TRIKE OBSTACLE COURSE!) ---
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", CROWDED_FAMILY_STAIR_X, CROWDED_FAMILY_STAIR_Y, 1.12, 1.40, 0, { z: 54 });
    f.obj("modular-suite/props/harmony_arch/floor_doormat_coir_rustic.png", 36.82, 26.62, 0.74, 0.49, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/harmony_arch/floor_doormat_coir_rustic.png", 37.10, 23.38, 0.74, 0.49, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/crowded_family/cf_kids_tricycle_wagon.png", 37.54, 26.22, 0.86, 0.66, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_scuff_scratch_patina.png", 37.05, 25.55, 1.40, 1.12, 0, { z: 48, shadow: false, opacity: 0.48 });
    f.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 36.42, 23.58, 0.46, 0.46, Math.PI / 2, { z: 76, shadow: false });

    // --- 1F FLAT 1A (WEST): THE BRENNER FAMILY (PARENTS + 4 KIDS INCLUDING BABY TWINS!) ---
    // West room: cramped parents' bed + TWO baby cribs + aligned B1 brewery cellar stairs + laundry mountain
    f.obj("modular-suite/props/crowded_family/cf_crowded_parent_double_bed.png", 30.92, 23.86, 1.36, 1.44, 0, { z: 64, recolor: F_ROSE });
    f.obj("modular-suite/props/crowded_family/cf_wooden_baby_crib.png", 32.04, 23.62, 0.78, 1.01, 0, { z: 64 });
    f.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", CROWDED_FAMILY_B1_STAIR_X, CROWDED_FAMILY_B1_STAIR_Y, 0.99, 1.44, -Math.PI / 2, { z: 52 });
    f.obj("modular-suite/props/crowded_family/cf_wooden_baby_crib.png", 30.65, 26.32, 0.78, 1.01, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_overflowing_family_laundry.png", 31.88, 26.32, 0.94, 0.80, -0.15, { z: 64 });

    // East room: kitchenette + crowded family dining table (w/ 2 high chairs!) + 2 sibling floor mats + exploded toys!
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 33.52, 23.52, 1.52, 0.76, 0, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_dirty_plates_pan_stack.png", 34.56, 23.46, 0.48, 0.43, 0.2, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 35.08, 23.48, 0.46, 0.46, 0, { z: 62 });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_ochre.png", 35.70, 23.52, 0.76, 0.76, 0, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_crowded_family_dining_table.png", 34.68, 24.68, 1.76, 1.27, 0, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_kids_floor_sleeping_mats.png", 33.42, 26.22, 1.22, 1.13, 0, { z: 62 });
    f.obj("modular-suite/props/crowded_family/cf_scattered_toys_blocks_mess.png", 34.68, 26.18, 1.06, 0.98, 0.25, { z: 60, shadow: false });
    f.obj("modular-suite/props/crowded_family/cf_overflowing_toy_chest.png", 35.62, 26.42, 1.02, 0.71, Math.PI, { z: 64 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 34.65, 24.85, 0.84, 0.84, 0, { z: 90, opacity: 0.84, shadow: false });

    // --- 1F FLAT 1B (EAST): THE KOVACS FAMILY (GRANDPARENTS, PARENTS & 4 KIDS!) ---
    // North sardine-tin kids' bunk room: 3 double-decker bunks + baby crib + toy chest + train track!
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_bed_colorable.png", 38.66, 22.92, 1.02, 1.41, 0, { z: 64, recolor: F_MUSTARD });
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_bed_colorable.png", 40.08, 22.92, 1.02, 1.41, 0, { z: 64, recolor: F_SKY });
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_curtain_colorable.png", 43.10, 22.74, 1.08, 1.39, Math.PI / 2, { z: 64, recolor: F_CORAL });
    f.obj("modular-suite/props/crowded_family/cf_wooden_baby_crib.png", 43.28, 24.20, 0.78, 1.01, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_overflowing_toy_chest.png", 41.52, 22.52, 1.02, 0.71, 0, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_scattered_toys_blocks_mess.png", 41.48, 23.72, 1.12, 1.03, -0.2, { z: 60, shadow: false });
    f.obj("modular-suite/props/community_kid_theater/kt_prop_cardboard_crown_sword.png", 39.42, 23.96, 0.54, 0.49, 0.4, { z: 62, shadow: false });

    // South grandparents' living-kitchen hijacked by a kids' blanket couch fort!
    f.obj("modular-suite/props/crowded_family/cf_couch_pillow_fort.png", 39.72, 26.26, 1.44, 1.08, Math.PI, { z: 64 });
    f.obj("modular-suite/props/community_kid_theater/kt_floor_cushions_cluster.png", 39.02, 25.48, 0.66, 0.55, 0.25, { z: 60 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 41.48, 25.85, 1.48, 0.74, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/bare_furniture/bare_white_kitchen_table.png", 40.42, 25.18, 0.98, 0.72, 0, { z: 62 });
    f.obj("modular-suite/props/tavern_clutter/tav_hot_stew_bowl.png", 40.42, 25.18, 0.36, 0.40, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/community_kid_theater/kt_milk_crate_stool_painted.png", 39.75, 25.18, 0.42, 0.42, 0.2, { z: 58 });
    f.obj("modular-suite/props/crowded_family/cf_overflowing_family_laundry.png", 38.58, 26.32, 0.94, 0.80, 0.18, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 38.65, 25.05, 0.48, 0.47, -0.35, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_copper_kitchen_pendant.png", 40.35, 25.55, 0.84, 0.84, 0, { z: 90, opacity: 0.84, shadow: false });

    // 1F Lights & DM Notes
    f.light("CF 1F Flat 1A Nursery", 31.35, 24.45, 4.6, "#FFBC70", 0.84, true);
    f.light("CF 1F Flat 1A Kitchen", 34.65, 24.85, 5.2, "#FFD284", 0.90, true);
    f.light("CF 1F Hallway Gas Sconce", 37.10, 24.85, 4.4, "#FFC26B", 0.82, true);
    f.light("CF 1F Flat 1B Bunkroom", 41.25, 23.35, 5.0, "#FFCB7C", 0.86, true);
    f.light("CF 1F Flat 1B Lounge", 40.25, 25.75, 4.8, "#FFB866", 0.88, true);
    f.note(
      "NOTE",
      34.85,
      24.85,
      "1F · The Crowded Nest (Multi-Family Tenement, 2F)",
      "Four lively working families and over a dozen kids packed cheek-by-jowl right beside the Community Kid Theater! Cribs wedged against parents' beds, sibling floor mats next to dinner tables, blanket couch forts, and strollers blocking the stairwell.",
      "#F59E0B",
    );
    f.note(
      "SECRET",
      CROWDED_FAMILY_B1_STAIR_X,
      CROWDED_FAMILY_B1_STAIR_Y,
      "1F · Brenner Pantry Steps → B1 Neighborhood Brewery Cellar",
      "The stone cellar stairs tucked behind the Brenners' baby cribs descend directly into the B1 copper mash tuns and wine-cask brewery cellar (`sub-b1-obj-291`).",
      "#A855F7",
    );
  }

  // =========================================================================
  // 2F (+14ft): FLAT 2A (MORALES FAMILY + KID THEATER KIDS) + FLAT 2B (LINDQVIST FAMILY) + SHARED WC
  // =========================================================================
  {
    const f = makeFloorHelper("2f", f2Out);
    f.floor("modular-suite/terrain/harmony/flr_weathered_attic_planks.png", CROWDED_FAMILY_POLY);
    // Dark slate slabs in the 2F shared hall & tiny family WC
    f.floor("modular-suite/terrain/harmony/flr_dark_slate_hall_slabs.png", [
      { x: 36.2, y: 23.0 },
      { x: 38.0, y: 23.0 },
      { x: 38.0, y: 27.0 },
      { x: 36.2, y: 27.0 },
    ]);
    f.buildOuterShell(false);

    // Interior Structural Walls on 2F
    const w2HallW = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[36.2, 23.0], [36.2, 27.0]], { thickness: 0.14 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 36.2, 25.15, Math.PI / 2, "door", 0.86, true, w2HallW);

    const w2HallE = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[38.0, 23.0], [38.0, 27.0]], { thickness: 0.14 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 38.0, 25.35, Math.PI / 2, "door", 0.86, true, w2HallE);

    // Tiny Shared 2F Family WC tucked at south end of stair landing (x=36.2..37.25, y=25.75..27.0)
    const w2Wc = f.wall("modular-suite/walls/harmony/wall_subway_white_tile.png", [[36.2, 25.75], [37.35, 25.75], [37.35, 27.0]], { thickness: 0.12 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 36.78, 25.75, 0, "door", 0.72, true, w2Wc);

    // Flat 2A interior divider
    const w2AMid = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[33.25, 23.0], [33.25, 27.0]], { thickness: 0.13 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 33.25, 25.35, Math.PI / 2, "door", 0.82, true, w2AMid);

    // Flat 2B interior divider
    const w2BMid = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[38.0, 24.55], [42.0, 24.55]], { thickness: 0.13 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 39.25, 24.55, 0, "door", 0.82, true, w2BMid);

    // --- 2F CENTRAL STAIR LANDING, PARKED PRAM & SHARED FAMILY WC ---
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", CROWDED_FAMILY_STAIR_X, CROWDED_FAMILY_STAIR_Y, 1.12, 1.40, 0, { z: 54 });
    // Baby pram parked horizontally right under the north hallway window!
    f.obj("modular-suite/props/crowded_family/cf_wicker_baby_pram.png", 37.10, 23.42, 0.68, 0.95, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_scattered_socks_pair.png", 37.62, 23.82, 0.38, 0.32, 0.4, { z: 60, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_woven_doormat.png", 37.64, 25.35, 0.60, 0.40, Math.PI / 2, { z: 48, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_blue_bathmat_rug.png", 36.78, 26.22, 0.56, 0.41, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_toilet_wc_stall.png", 36.78, 26.48, 0.76, 0.90, Math.PI, { z: 62 });

    // --- 2F FLAT 2A (WEST): THE MORALES FAMILY (PARENTS + 5 KIDS — KID THEATER RINGLEADERS!) ---
    // West 5-kid chaos bunk room overlooking the Kid Theater
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_bed_colorable.png", 30.68, 23.90, 1.02, 1.41, 0, { z: 64, recolor: F_CORAL });
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_bed_colorable.png", 32.55, 23.90, 1.02, 1.41, 0, { z: 64, recolor: F_SAGE });
    f.obj("modular-suite/props/crowded_family/cf_kids_floor_sleeping_mats.png", 30.92, 26.18, 1.22, 1.13, Math.PI / 2, { z: 62 });
    f.obj("modular-suite/props/community_kid_theater/kt_costume_trunk_overflowing.png", 32.42, 26.42, 1.04, 0.74, Math.PI, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_scattered_toys_blocks_mess.png", 31.62, 24.52, 1.00, 0.92, 0.35, { z: 60, shadow: false });
    f.obj("modular-suite/props/community_kid_theater/kt_prop_fairy_wings_cape.png", 31.48, 25.38, 0.60, 0.49, -0.35, { z: 62, shadow: false });
    f.obj("modular-suite/props/community_kid_theater/kt_prop_cardboard_crown_sword.png", 32.38, 25.42, 0.54, 0.49, 0.25, { z: 62, shadow: false });

    // East parents' bed + crib + kitchenette + tricycle parked inside the flat!
    f.obj("modular-suite/props/crowded_family/cf_crowded_parent_double_bed.png", 34.18, 23.88, 1.36, 1.44, 0, { z: 64, recolor: F_INDIGO });
    f.obj("modular-suite/props/crowded_family/cf_wooden_baby_crib.png", 35.48, 23.72, 0.78, 1.01, 0, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 34.25, 26.45, 1.48, 0.74, Math.PI, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_overflowing_family_laundry.png", 35.52, 26.35, 0.94, 0.80, -0.2, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_kids_tricycle_wagon.png", 34.68, 25.32, 0.94, 0.72, 0.15, { z: 64 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_amber_lamp.png", 35.45, 24.65, 0.36, 0.36, 0, { z: 68, shadow: false });

    // --- 2F FLAT 2B (EAST): THE LINDQVIST SISTERS & 4 YOUNG KIDS ---
    // North crammed sleeping & indoor clothesline forest!
    f.obj("modular-suite/props/crowded_family/cf_crowded_parent_double_bed.png", 38.92, 22.92, 1.36, 1.44, 0, { z: 64, recolor: F_TEAL });
    f.obj("modular-suite/props/crowded_family/cf_wooden_baby_crib.png", 40.18, 22.72, 0.78, 1.01, 0, { z: 64 });
    f.obj("modular-suite/props/hostel_living/hs_hostel_bunk_curtain_colorable.png", 43.10, 22.74, 1.08, 1.39, Math.PI / 2, { z: 64, recolor: F_PLUM });
    f.obj("modular-suite/props/crowded_family/cf_kids_floor_sleeping_mats.png", 41.55, 23.15, 1.18, 1.10, 0, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", 43.15, 24.18, 1.16, 0.70, 0, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_overflowing_toy_chest.png", 40.32, 24.02, 0.98, 0.68, Math.PI, { z: 64 });

    // South family kitchen, crowded dining table w/ high chairs, toys & laundry mountain!
    f.obj("modular-suite/props/crowded_family/cf_crowded_family_dining_table.png", 39.08, 26.12, 1.64, 1.18, 0, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 41.48, 25.85, 1.48, 0.74, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/crowded_family/cf_scattered_toys_blocks_mess.png", 40.48, 25.35, 0.98, 0.90, -0.25, { z: 60, shadow: false });
    f.obj("modular-suite/props/crowded_family/cf_overflowing_family_laundry.png", 40.48, 26.48, 0.88, 0.74, 0.2, { z: 64 });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_emerald.png", 38.48, 25.02, 0.72, 0.72, 0, { z: 64 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 40.15, 25.75, 0.82, 0.82, 0, { z: 90, opacity: 0.84, shadow: false });

    // 2F Lights
    f.light("CF 2F Flat 2A Kids Room", 31.65, 24.85, 4.8, "#FFCA7A", 0.86, true);
    f.light("CF 2F Flat 2A Parents", 34.75, 24.95, 4.6, "#FFC06E", 0.86, true);
    f.light("CF 2F Stair Landing", 37.10, 24.95, 4.0, "#FFC670", 0.82, true);
    f.light("CF 2F Flat 2B Nursery", 41.25, 23.35, 5.0, "#FFCE82", 0.86, true);
    f.light("CF 2F Flat 2B Kitchen", 40.15, 25.85, 4.8, "#FFD084", 0.88, true);
  }

  return { crowdedFamilyPoly: CROWDED_FAMILY_POLY };
}

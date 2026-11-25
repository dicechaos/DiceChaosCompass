/**
 * Builds the Outdoor Neighborhood Community Kid Theater ("The Cardboard Crown Courtyard" —
 * Tonight's Dusk Matinee: "Sir Scoop vs. the Clockwork Dragon"!) in the diamond stone
 * courtyard directly behind the Ice Cream Express (`x ∈ [20.5..29.8], y ∈ [17.0..28.8]`).
 *
 * Replaces the central fountain, generic produce stall, and legacy zigzag SE deck with:
 *  - Raised SE Community Theater Stage facing NW toward the Ice Cream Express, complete with
 *    low painted timber steps, patchwork proscenium curtain arch, tin-can candle footlights,
 *    kid-painted cardboard castle & forest flats, paper-maché Clockwork Dragon, folding
 *    hand-puppet booth, jar-lens tin-can spotlights, messy backstage costume/prop wing,
 *    and a pried loose stageboard hiding the kids' Clubhouse Treasure Box!
 *  - Layered Audience Courtyard: front-row patchwork & colorable quilts, floor pillows,
 *    painted milk-crate stools, spilled popcorn & ice cream snacks, parents' park benches &
 *    Ice Cream Express marble sundae tables in back, and pastel sidewalk chalk playbills &
 *    hopscotch leading straight from the Ice Cream Express back steps!
 *  - East Kid-Run "Tickets, Popcorn & Lemonade" Theater Booth + overhead pennant bunting &
 *    glowing mason-jar fairy light garlands!
 */

import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type LightNode,
  type ObjectStamp,
  type Point2D,
  type RgbRecolor,
  type SplinePath,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

const S = Math.SQRT1_2;
const Q = Math.PI / 4;

// Stage center in the SE courtyard corner, facing NW directly toward the audience & Ice Cream Shop!
const STAGE_CX = 27.55;
const STAGE_CY = 26.25;
// Front (+Y) of sprites faces NW (-0.707, -0.707) when rotated by +135° (3*PI/4)!
const FACE_NW = (3 * Math.PI) / 4;
const FACE_SE = -Math.PI / 4;
const FACE_SW = Math.PI / 4;
const FACE_NE = (-3 * Math.PI) / 4;
const FACE_W = Math.PI / 2;

/**
 * Local stage coordinates `(right, forward)` anchored at `(STAGE_CX, STAGE_CY)`:
 *  - `+forward` moves NW toward the audience (`(-S, -S)`)
 *  - `+right` moves NE toward Stage Right / Puppet Booth (`(+S, -S)`)
 */
function stagePt(right: number, forward: number): Point2D {
  return {
    x: Math.round((STAGE_CX + right * S - forward * S) * 1000) / 1000,
    y: Math.round((STAGE_CY - right * S - forward * S) * 1000) / 1000,
  };
}

function tint(hex: string, strength = 0.9): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

const QUILT_TEAL = tint("#2D8A96", 0.9);
const QUILT_MUSTARD = tint("#C99632", 0.88);
const CUSHION_CORAL = tint("#D95B5B", 0.9);
const CUSHION_SKY = tint("#4698C8", 0.9);
const CUSHION_PLUM = tint("#8E56AA", 0.9);

export function buildCommunityKidTheater(doc: DcMapDocument, f1Out: IceCreamBuildBundle): void {
  const groundObjects = doc.layers.find((l) => l.id === "layer-dd-objects-1");
  const groundPaths = doc.layers.find((l) => l.id === "layer-dd-paths-1");

  // Remove legacy SE zigzag L-counters & old wood stairs (`dd-obj-1-1`, `dd-obj-1-2`, `dd-obj-1-37`)
  // so our real raised Community Theater Stage & low painted front steps replace them cleanly!
  const legacyStageIds = new Set(["dd-obj-1-1", "dd-obj-1-2", "dd-obj-1-37"]);
  if (groundObjects?.objects) {
    groundObjects.objects = groundObjects.objects.filter((o) => !legacyStageIds.has(o.id));
  }
  // Remove legacy crooked courtyard string light `dd-path-1-5` so our crisp overhead bunting garlands shine cleanly
  if (groundPaths?.paths) {
    groundPaths.paths = groundPaths.paths.filter((p) => p.id !== "dd-path-1-5");
  }

  let seq = 0;
  const uid = (tag: string) => `kt-1f-${tag}-${++seq}`;

  const obj = (
    assetId: string,
    x: number,
    y: number,
    widthCells: number,
    heightCells: number,
    rotationRad = 0,
    opts: { z?: number; shadow?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    const o: ObjectStamp = {
      id: uid("obj"),
      assetId,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      widthCells,
      heightCells,
      rotationRad,
      flipX: false,
      flipY: false,
      opacity: opts.opacity ?? 1,
      castsShadow: opts.shadow ?? true,
      locked: false,
      recolor: opts.recolor ?? { ...DEFAULT_RECOLOR },
      zOrder: opts.z ?? 62,
    };
    f1Out.objects.push(o);
  };

  const stageObj = (
    assetId: string,
    right: number,
    forward: number,
    widthCells: number,
    heightCells: number,
    rotOffset = 0,
    opts: { z?: number; shadow?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    const p = stagePt(right, forward);
    obj(assetId, p.x, p.y, widthCells, heightCells, FACE_NW + rotOffset, opts);
  };

  const path = (assetId: string, coords: Array<[number, number]>, widthCells: number) => {
    const sp: SplinePath = {
      id: uid("pth"),
      assetId,
      points: coords.map(([x, y]) => ({ x, y })),
      widthCells,
      curved: true,
      taperEnds: false,
      fadeEnds: false,
      opacity: 0.94,
      blocksScatter: false,
    };
    f1Out.paths.push(sp);
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
  // 1. RAISED SE COMMUNITY THEATER STAGE & "SIR SCOOP VS. CLOCKWORK DRAGON"
  // =========================================================================
  // Bare Timber Stage Deck (384x256 -> exact 1.50:1 = 3.60 x 2.40!)
  stageObj("modular-suite/props/community_kid_theater/kt_bare_community_stage_deck.png", 0, 0, 3.60, 2.40, 0, { z: 50 });
  // Low Painted-Wood Theater Stage Steps (160x128 -> exact 1.25:1 = 1.15 x 0.92!)
  stageObj("modular-suite/props/community_kid_theater/kt_stage_front_steps_wood.png", 0, 1.52, 1.15, 0.92, 0, { z: 52 });
  // Patched Patchwork Proscenium Curtain Arch framing the front lip cleanly behind footlights (368x112 -> 3.55 x 1.08!)
  stageObj("modular-suite/props/community_kid_theater/kt_patchwork_curtain_arch.png", 0, 0.78, 3.55, 1.08, 0, { z: 86 });
  // Twin Scavenged Tin-Can & Candle Footlight Rows gleaming cleanly in front of the curtain lip (256x80 -> 1.08 x 0.34!)
  stageObj("modular-suite/props/community_kid_theater/kt_tin_can_footlight_bar.png", -1.04, 1.18, 1.08, 0.34, 0, { z: 66, shadow: false });
  stageObj("modular-suite/props/community_kid_theater/kt_tin_can_footlight_bar.png", 1.04, 1.18, 1.08, 0.34, 0, { z: 66, shadow: false });

  // On-Stage Scenery Flats & Performers' Play Props!
  // Cardboard Castle Flat upstage left (256x112 -> 1.72 x 0.75!)
  stageObj("modular-suite/props/community_kid_theater/kt_cardboard_castle_flat.png", -0.58, -0.68, 1.72, 0.75, 0.08, { z: 64 });
  // Cardboard Trees & Cotton-Cloud Flat upstage right (224x112 -> 1.40 x 0.70!)
  stageObj("modular-suite/props/community_kid_theater/kt_cardboard_forest_cloud_flat.png", 0.96, -0.62, 1.40, 0.70, -0.12, { z: 64 });
  // Hero Paper-Maché & Cardboard Clockwork Dragon Prop center-right (240x176 -> 1.44 x 1.056!)
  stageObj("modular-suite/props/community_kid_theater/kt_cardboard_dragon_prop.png", 0.54, 0.04, 1.44, 1.056, -0.22, { z: 70 });
  // Foil Cardboard Crown & Wooden Toy Sword at Sir Scoop's hero mark (160x144 -> 0.70 x 0.63!)
  stageObj("modular-suite/props/community_kid_theater/kt_prop_cardboard_crown_sword.png", -0.82, 0.16, 0.70, 0.63, 0.25, { z: 68 });
  // Secret Pried Stageboard Kids' Clubhouse Treasure Box tucked behind Upstage Left curtain! (160x160 -> 0.72 x 0.72)
  stageObj("modular-suite/props/community_kid_theater/kt_loose_stageboard_clubhouse_stash.png", -1.40, -0.78, 0.72, 0.72, 0.12, { z: 54, shadow: false });

  // Folding Striped Hand-Puppet Booth angled cleanly at Stage Right facing WNW toward the kids! (208x144 -> 1.30 x 0.90!)
  obj("modular-suite/props/community_kid_theater/kt_folding_puppet_booth.png", 28.88, 24.18, 1.30, 0.90, FACE_W + 0.38, { z: 66 });

  // Scavenged Magipunk Jar-Lens Tin-Can Stage Spotlights aimed straight onto stage center (27.55, 26.25)!
  obj("modular-suite/props/community_kid_theater/kt_mason_jar_spotlight_stand.png", 24.95, 25.55, 0.72, 0.72, -1.31, { z: 72 });
  obj("modular-suite/props/community_kid_theater/kt_mason_jar_spotlight_stand.png", 27.65, 23.62, 0.72, 0.72, 0.04, { z: 72 });

  // =========================================================================
  // 2. BACKSTAGE MESSY COSTUME & PROP PREP WING (Spacious Open SE Backstage Pocket!)
  // =========================================================================
  // Overflowing Costume Trunk & Backstage Prop Rack neatly along East building wall (clear of x=30.0!)
  obj("modular-suite/props/community_kid_theater/kt_costume_trunk_overflowing.png", 29.12, 26.72, 1.12, 0.80, FACE_W, { z: 64 });
  obj("modular-suite/props/community_kid_theater/kt_backstage_prop_rack.png", 29.26, 25.32, 1.12, 0.56, FACE_W, { z: 64 });
  // Kids' Paint Cans & Drop Cloth + Bare Open Prop Trunk & Wire Fairy Wings cleanly in open SE backstage!
  obj("modular-suite/props/community_kid_theater/kt_prop_paint_buckets_brushes.png", 29.15, 27.95, 0.88, 0.72, -0.25, { z: 60 });
  obj("modular-suite/props/community_kid_theater/kt_bare_costume_trunk_open.png", 28.05, 28.35, 1.04, 0.72, FACE_NW + 0.15, { z: 62 });
  obj("modular-suite/props/community_kid_theater/kt_prop_fairy_wings_cape.png", 27.12, 28.45, 0.78, 0.64, 0.35, { z: 62 });

  // =========================================================================
  // 3. LAYERED AUDIENCE FLOOR — QUILTS, PILLOWS, MILK-CRATE STOOLS & SNACKS
  // =========================================================================
  // 3 Front-Row Cozy Audience Quilts fanned in a gentle semicircle facing SE toward the stage!
  obj("modular-suite/props/community_kid_theater/kt_patchwork_quilt_blanket.png", 25.55, 22.35, 1.66, 1.35, FACE_SE, { z: 44, shadow: false });
  obj("modular-suite/props/community_kid_theater/kt_colorable_audience_quilt.png", 23.95, 23.85, 1.60, 1.30, FACE_SE + 0.12, { z: 44, shadow: false, recolor: QUILT_TEAL });
  obj("modular-suite/props/community_kid_theater/kt_colorable_audience_quilt.png", 26.65, 20.85, 1.48, 1.20, FACE_SE - 0.16, { z: 44, shadow: false, recolor: QUILT_MUSTARD });

  // Scattered Plump Kids' Floor Pillows & Colorable Tufted Cushions on the Quilts!
  obj("modular-suite/props/community_kid_theater/kt_floor_cushions_cluster.png", 25.55, 22.35, 0.90, 0.75, 0.25, { z: 54 });
  obj("modular-suite/props/community_kid_theater/kt_floor_cushions_cluster.png", 23.85, 23.95, 0.86, 0.72, -0.45, { z: 54 });
  obj("modular-suite/props/community_kid_theater/kt_colorable_floor_cushion.png", 26.55, 20.95, 0.56, 0.56, 0.2, { z: 54, recolor: CUSHION_CORAL });
  obj("modular-suite/props/community_kid_theater/kt_colorable_floor_cushion.png", 27.05, 20.65, 0.54, 0.54, -0.35, { z: 54, recolor: CUSHION_SKY });
  obj("modular-suite/props/community_kid_theater/kt_colorable_floor_cushion.png", 24.45, 23.45, 0.54, 0.54, 0.5, { z: 54, recolor: CUSHION_PLUM });

  // Painted Upturned Milk-Crate Kid Stools curving along the sides of the blankets
  obj("modular-suite/props/community_kid_theater/kt_milk_crate_stool_painted.png", 26.75, 22.75, 0.56, 0.56, 0.18, { z: 58 });
  obj("modular-suite/props/community_kid_theater/kt_milk_crate_stool_painted.png", 24.95, 24.55, 0.56, 0.56, -0.24, { z: 58 });
  obj("modular-suite/props/community_kid_theater/kt_milk_crate_stool_painted.png", 24.45, 21.35, 0.56, 0.56, 0.42, { z: 58 });
  obj("modular-suite/props/community_kid_theater/kt_milk_crate_stool_painted.png", 25.65, 20.25, 0.56, 0.56, -0.15, { z: 58 });

  // Showtime Snacks on Blankets (popcorn + Steam & Scoop Express sundaes & waffle cones!)
  obj("modular-suite/props/community_kid_theater/kt_popcorn_kettle_bags.png", 25.95, 22.85, 0.56, 0.50, -0.3, { z: 58 });
  obj("modular-suite/props/ice_cream_train/ic_sundae_bowl_strawberry.png", 24.35, 24.25, 0.36, 0.36, 0.2, { z: 58, shadow: false });
  obj("modular-suite/props/ice_cream_train/ic_waffle_cone_napkin.png", 26.25, 21.15, 0.36, 0.36, -0.4, { z: 58, shadow: false });

  // =========================================================================
  // 4. PARENTS' BACK ROW — BENCHES, ICE CREAM EXPRESS TABLES & CHALK ART
  // =========================================================================
  // Curved Parents' Benches along the North stone edge facing SE toward the stage
  obj("modular-suite/props/neighborhood_park/pk_worn_park_bench.png", 25.35, 19.35, 1.38, 0.62, -0.25, { z: 62 });
  obj("modular-suite/props/neighborhood_park/pk_worn_park_bench.png", 23.65, 20.15, 1.38, 0.62, -0.68, { z: 62 });
  // Parents' Ice Cream Express Marble Bistro Sundae Tables right along the West edge!
  obj("modular-suite/props/ice_cream_train/ic_parlor_bistro_sundae_table.png", 22.35, 21.55, 1.18, 1.18, 0.25, { z: 64 });
  obj("modular-suite/props/ice_cream_train/ic_parlor_bistro_sundae_table.png", 22.95, 24.15, 1.18, 1.18, -0.35, { z: 64 });
  // Chalkboard Playbill Easel welcoming families arriving from the Ice Cream Express patio!
  obj("modular-suite/props/community_kid_theater/kt_chalkboard_playbill_easel.png", 23.55, 25.35, 0.80, 0.73, FACE_NW - 0.25, { z: 64 });

  // Pastel Sidewalk Chalk Playbill & Arrow Decal cleanly on open courtyard flagstones (zero wall overlap!)
  obj("modular-suite/props/community_kid_theater/kt_chalk_courtyard_playbill_decal.png", 22.65, 22.85, 1.38, 1.035, 0.45, { z: 42, shadow: false, opacity: 0.94 });
  // Pastel Sidewalk Chalk Hopscotch & Star-Border Decal near the North courtyard stoop entrance!
  obj("modular-suite/props/community_kid_theater/kt_chalk_hopscotch_stars_decal.png", 25.05, 18.18, 1.48, 0.95, -0.05, { z: 42, shadow: false, opacity: 0.94 });

  // =========================================================================
  // 5. KID-RUN "TICKETS, POPCORN & LEMONADE" BOOTH (EAST COURTYARD EDGE)
  // =========================================================================
  // Full Striped Theater Ticket, Popcorn & Lemonade Booth facing West into the courtyard!
  obj("modular-suite/props/community_kid_theater/kt_ticket_popcorn_booth_full.png", 28.45, 21.45, 2.16, 1.44, FACE_W, { z: 68 });
  // Side modular kid-height Lemonade & Ticket Counter right beside the booth!
  obj("modular-suite/props/community_kid_theater/kt_bare_ticket_counter_wood.png", 28.15, 22.85, 1.12, 0.60, FACE_W + 0.2, { z: 64 });
  obj("modular-suite/props/community_kid_theater/kt_lemonade_pitcher_cups.png", 28.12, 22.66, 0.48, 0.43, 0.2, { z: 68, shadow: false });
  obj("modular-suite/props/community_kid_theater/kt_ticket_box_roll_stubs.png", 28.22, 23.08, 0.44, 0.39, -0.25, { z: 68, shadow: false });
  // Tidy parked neighborhood bicycle & trash barrel tucked clear at the NE edge
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 28.35, 19.95, 1.08, 0.68, 0.65, { z: 64 });
  obj("modular-suite/props/sewers_alleys/sew_alley_trash_barrel.png", 29.05, 20.35, 0.68, 0.68, 0.15, { z: 62 });

  // =========================================================================
  // 6. OVERHEAD PENNANT BUNTING, MASON-JAR FAIRY LIGHTS & DUSK LIGHTING!
  // =========================================================================
  // 3 Overhead Festive Pennant Bunting & Glowing Mason-Jar Fairy Light Garlands forming a crisp theater canopy!
  obj("modular-suite/props/community_kid_theater/kt_jar_fairy_bunting_garland.png", 25.15, 24.55, 3.30, 1.15, -Q, { z: 88, shadow: false });
  obj("modular-suite/props/community_kid_theater/kt_jar_fairy_bunting_garland.png", 24.85, 20.55, 3.20, 1.12, -0.18, { z: 88, shadow: false });
  obj("modular-suite/props/community_kid_theater/kt_jar_fairy_bunting_garland.png", 27.35, 20.45, 2.50, 0.875, 0.72, { z: 88, shadow: false });
  // Overhead warm cafe string-light catenary arching across the whole seating bowl!
  path("modular-suite/paths/harmony/path_cafe_warm_string_lights.png", [[22.1, 20.4], [25.3, 21.5], [28.3, 22.9]], 0.26);

  // Warm Dusk Showtime Lighting (strictly valid LightNode fields with directional spotlight beams!)
  const footCenter = stagePt(0, 0.92);
  light("Kid Theater Tin-Can Footlights", footCenter.x, footCenter.y, 6.2, "#FFB854", 0.96, { flicker: true });
  light("Kid Theater Stage Jar-Spotlight L", 24.95, 25.55, 6.8, "#FFE094", 0.94, {
    castShadows: false,
    coneAngleDeg: 58,
    directionRad: 0.26,
  });
  light("Kid Theater Stage Jar-Spotlight R", 27.65, 23.62, 6.8, "#93E5FF", 0.86, {
    castShadows: false,
    coneAngleDeg: 58,
    directionRad: 1.61,
  });
  light("Kid Theater Overhead Fairy Lights", 25.35, 22.45, 6.6, "#FFCA74", 0.86, { flicker: true, castShadows: false });
  light("Kid Theater Ticket & Popcorn Booth", 28.05, 21.45, 4.8, "#FFBA60", 0.88, { flicker: true });

  // =========================================================================
  // 7. STORY-RICH DM NOTE (WHOLESOME HEART + CLUBHOUSE TREASURE HOOK!)
  // =========================================================================
  f1Out.dmNotes.push({
    id: uid("note"),
    x: 26.85,
    y: 25.65,
    badge: "NOTE",
    title: "1F · The Cardboard Crown Kid Theater",
    body: "Tonight's dusk matinee: 'Sir Scoop vs. the Clockwork Dragon' (1 copper at the East Popcorn & Lemonade Booth — free mini-cone at Steam & Scoop Express with every playbill!). Behind the Stage Left curtain, a pried loose stageboard hides the kids' Clubhouse Treasure Box: glass marbles, chalk stubs, a crayon district map, and a shiny brass key they found dropped in the East Watchtower alley!",
    colorHex: "#F59E0B",
  });
}

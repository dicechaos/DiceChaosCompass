/**
 * Builds the 3-Story V-Courtyard Civic Post Office & Single-Occupant Public Housing
 * wrapping the southern edge of the Neighborhood Park (`dd-shape-floor-1-13` / `dd-wall-1-33`):
 *
 *  "Postamt Nr. 4 & Parkblick Ledigenheim" (3 Stories: 1F–3F + Prussian Slate Roof):
 *   - 1F (0ft):
 *       * South Apex (`y = 14..19`): Civic Post Office with gleaming Brass P.O. Box Lobby,
 *         customer letter-writing stand, brass teller grille counter, back mail-sorting
 *         worktable, rolling canvas mailbag hand-truck & direct tramway courier rear door!
 *       * Central Park Foyer (`x = 6.2..11.2, y = 11..14`): Park-facing residential entrance,
 *         tenant mailbox rack, community share/notice table & aligned 3-story switchback stair.
 *       * Unit 1A (NW Wing): Retired Mail-Carrier's cozy ground-floor studio (tabby cat, rocking
 *         chair, Prussian-blue bed, kitchenette, shared 1F WC alcove).
 *       * Unit 1B (NE Wing): Night-Shift Tram Brakeman's ground studio (railroad lantern, cards,
 *         rust-ochre bed, kitchenette & hallway janitor/mop utility nook).
 *   - 2F (+14ft): 4 lived-in single-occupant studios around the central stair & shared 2F WC:
 *       * Unit 2A (NW): Arcane-Engineering Student's cluttered wire/pizza studio
 *       * Unit 2B (SW): Seamstress & Milliner's sunny treadle-sewing studio
 *       * Unit 2C (SE): Street Musician's lute & brass-gramophone flat
 *       * Unit 2D (NE): Baker's Apprentice's warm park-view studio
 *   - 3F (+28ft): 4 lived-in attic-eave single studios + shared top-floor laundry drying alcove & WC:
 *       * Unit 3A (NW): Investigative Journalist's garret (SECRET DM hook tied to P.O. Box #44!)
 *       * Unit 3B (SW): Park Gardener & Botanist's fern-filled flat
 *       * Unit 3C (SE): Off-Duty Watchtower Scout's spartan studio
 *       * Unit 3D (NE): Retired Cartographer & Pensioner's cozy cat-and-reading flat
 *   - ROOF (+70ft): Upgrades `dd-roof-0-9` to Prussian Fishscale Slate (`roof_prussian_fishscale_slate.png`).
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

// Exact 11-vertex V-courtyard outer footprint of `dd-shape-floor-1-13` / `dd-wall-1-33`
export const POST_HOUSING_POLY: Point2D[] = [
  { x: 7.0, y: 11.0 },
  { x: 10.0, y: 11.0 },
  { x: 14.0, y: 6.0 },
  { x: 16.0, y: 6.0 },
  { x: 19.0, y: 8.0 },
  { x: 19.0, y: 9.5 },
  { x: 9.5, y: 19.0 },
  { x: 7.5, y: 19.0 },
  { x: 0.0, y: 7.0 },
  { x: 0.0, y: 6.0 },
  { x: 3.5, y: 4.5 },
];

// Central slate foyer / upper landing floor polygon flush with angled park courtyard walls E10 & E01
const CENTRAL_HALL_POLY: Point2D[] = [
  { x: 6.1, y: 9.33 },
  { x: 7.0, y: 11.0 },
  { x: 10.0, y: 11.0 },
  { x: 11.4, y: 9.25 },
  { x: 11.4, y: 14.0 },
  { x: 6.1, y: 14.0 },
];

// Exterior edge alignment angles (radians)
const ANG_E00 = 0; // Park south wall (7,11)->(10,11)
const ANG_E01 = Math.atan2(-5.0, 4.0); // Park east wall (10,11)->(14,6) (-51.34°)
const ANG_E03 = Math.atan2(2.0, 3.0); // NE bevel (16,6)->(19,8) (+33.69°)
const ANG_E05 = -Math.PI / 4; // SE tramway facade (9.5,19)->(19,9.5) (-45°)
const ANG_E07 = Math.atan2(12.0, 7.5); // SW avenue facade (0,7)->(7.5,19) (+58.0°)
const ANG_E09 = Math.atan2(-1.5, 3.5); // NW bevel (0,6)->(3.5,4.5) (-23.2°)
const ANG_E10 = Math.atan2(6.5, 3.5); // Park west wall (3.5,4.5)->(7,11) (+61.7°)

// Aligned 3-story residential switchback stairwell center (1F ↔ 2F ↔ 3F)
export const POST_HOUSING_STAIR_X = 8.65;
export const POST_HOUSING_STAIR_Y = 12.65;

function tint(hex: string, strength = 0.9): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

// Distinct quilt & rug palettes so every single-resident studio feels uniquely personal!
const Q_PRUSSIAN = tint("#2D5686", 0.90);
const Q_RUST = tint("#A84B2A", 0.90);
const Q_SAGE = tint("#4A7A58", 0.90);
const Q_ROSE = tint("#A84E6A", 0.90);
const Q_PLUM = tint("#6B3678", 0.90);
const Q_OCHRE = tint("#C48A2C", 0.90);
const Q_EMERALD = tint("#2A7858", 0.90);
const Q_BURGUNDY = tint("#882236", 0.92);
const Q_AMBER = tint("#B86E2E", 0.90);
const Q_TEAL = tint("#2E7880", 0.90);
const Q_SLATE = tint("#425474", 0.90);

function makeFloorHelper(floorTag: string, bundle: IceCreamBuildBundle) {
  let seq = 0;
  const uid = (k: string) => `ph-${floorTag}-${k}-${++seq}`;

  const floor = (assetId: string, points: Point2D[] = POST_HOUSING_POLY) => {
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
    colorHex = "#38BDF8",
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

  /** Builds the 11-vertex dressed sandstone exterior shell with windows for any story */
  const buildOuterShell = (isGround: boolean) => {
    const extId = wall(
      "modular-suite/walls/harmony/wall_berlin_dressed_sandstone.png",
      POST_HOUSING_POLY.map((p) => [p.x, p.y] as [number, number]),
      { closed: true, thickness: 0.22 },
    );

    if (isGround) {
      // 1F Post Office Main Entrance (SW Avenue), Bay Windows, Courier Tram Door, & Park Foyer Door
      portal("modular-suite/portals/harmony/door_grunderzeit_double_glass.png", 5.75, 16.20, ANG_E07, "door", 1.35, false, extId);
      portal("modular-suite/portals/harmony/win_bay_parlor_marble.png", 6.80, 17.88, ANG_E07, "window", 1.35, true, extId);
      portal("modular-suite/portals/harmony/win_bay_parlor_marble.png", 11.35, 17.15, ANG_E05, "window", 1.35, true, extId);
      portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", 13.05, 15.45, ANG_E05, "door", 1.05, false, extId);
      // Park-facing Residential Foyer Entrance on E00
      portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", 8.50, 11.00, ANG_E00, "door", 1.15, false, extId);
      // Ground studio windows (1A NW wing + 1B NE wing)
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 1.85, 9.96, ANG_E07, "window", 1.25, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 4.75, 6.82, ANG_E10, "window", 1.20, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 16.50, 12.00, ANG_E05, "window", 1.25, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 12.20, 8.25, ANG_E01, "window", 1.20, true, extId);
    } else {
      // Upper-story residential windows around park courtyard, avenue, and tramway
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 8.50, 11.00, ANG_E00, "window", 1.25, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 1.85, 9.96, ANG_E07, "window", 1.25, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 4.75, 6.82, ANG_E10, "window", 1.20, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 5.85, 16.36, ANG_E07, "window", 1.25, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 11.45, 17.05, ANG_E05, "window", 1.25, true, extId);
      portal("modular-suite/portals/harmony/win_flowerbox_berlin_geranium.png", 16.50, 12.00, ANG_E05, "window", 1.25, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 12.20, 8.25, ANG_E01, "window", 1.20, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_dark.png", 17.50, 7.00, ANG_E03, "window", 1.10, true, extId);
      portal("modular-suite/portals/harmony/win_tenement_sash_dark.png", 1.75, 5.25, ANG_E09, "window", 1.10, true, extId);
    }
    return extId;
  };

  return { floor, wall, portal, obj, light, note, buildOuterShell };
}

export function buildPostOfficeAndPublicHousing(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
  f2Out: IceCreamBuildBundle,
  f3Out: IceCreamBuildBundle,
): { postHousingPoly: Point2D[] } {
  // Replace legacy Dungeondraft windowless castle-ashlar wall `dd-wall-1-33` with Harmony sandstone!
  const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1");
  if (groundWalls?.walls) {
    groundWalls.walls = groundWalls.walls.filter((w) => w.id !== "dd-wall-1-33");
  }

  // Upgrade the V-building gable roof `dd-roof-0-9` to Prussian Fishscale Slate!
  const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs");
  if (roofLayer?.roofs) {
    const r: RoofStructure | undefined = roofLayer.roofs.find((x) => x.id === "dd-roof-0-9");
    if (r) {
      r.assetId = "modular-suite/terrain/harmony/roof_prussian_fishscale_slate.png";
    }
  }

  // =========================================================================
  // 1F (0ft): POSTAMT NR. 4 (POST OFFICE & BRASS P.O. BOXES) + PARK FOYER + UNITS 1A & 1B
  // =========================================================================
  {
    const f = makeFloorHelper("1f", f1Out);
    // Warm honey-oak base across residential wings, overlaid by encaustic civic tile in Post Office & Foyer!
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", POST_HOUSING_POLY);
    f.floor("modular-suite/terrain/harmony/flr_victorian_foyer_encaustic.png", [
      { x: 4.45, y: 14.0 },
      { x: 14.45, y: 14.0 },
      { x: 9.5, y: 19.0 },
      { x: 7.5, y: 19.0 },
    ]);
    f.floor("modular-suite/terrain/harmony/flr_dark_slate_hall_slabs.png", CENTRAL_HALL_POLY);
    f.buildOuterShell(true);

    // Interior structural walls on 1F:
    // 1) Fire-separation wall between Post Office (South) and Public Housing Foyer/Wings (y = 14.0)
    const wPostSep = f.wall("modular-suite/walls/harmony/wall_oak_wainscot_parlor.png", [[4.45, 14.0], [14.45, 14.0]], { thickness: 0.16 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 10.65, 14.0, 0, "door", 0.90, true, wPostSep);

    // 2) Post Office Teller Partition separating Public P.O. Box Lobby (West) from Back Sorting Room (East)
    const wTeller = f.wall("modular-suite/walls/harmony/wall_oak_wainscot_parlor.png", [[9.75, 14.0], [9.75, 18.75]], { thickness: 0.14 });
    f.portal("modular-suite/portals/harmony/gate_bank_brass_teller.png", 9.75, 16.05, Math.PI / 2, "door", 1.35, true, wTeller);
    f.portal("modular-suite/portals/harmony/door_bakery_warm_oak_glass.png", 9.75, 17.85, Math.PI / 2, "door", 0.85, true, wTeller);

    // 3) Unit 1A partition (West Wing, sealed flush to E10 at y=9.33) + Shared 1F WC cubicle at (4.6..6.1, 12.65..14.0)
    const w1A = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [[6.10, 9.33], [6.10, 14.0]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 6.10, 11.85, Math.PI / 2, "door", 0.92, true, w1A);
    const w1AWc = f.wall("modular-suite/walls/harmony/wall_subway_white_tile.png", [[4.60, 12.65], [6.10, 12.65]], { thickness: 0.13 });
    void w1AWc;
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 6.10, 13.35, Math.PI / 2, "door", 0.78, true, w1A);

    // 4) Unit 1B partition (East Wing, sealed flush to E01 at y=9.25)
    const w1B = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_ochre.png", [[11.40, 9.25], [11.40, 14.0]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 11.40, 11.95, Math.PI / 2, "door", 0.92, true, w1B);

    // --- EXTERIOR STREET-SIDE POST OFFICE DRESSING (Avenue Sidewalk!) ---
    f.obj("modular-suite/props/post_housing/ph_postal_awning_prussian_gold.png", 5.08, 16.62, 2.98, 1.10, ANG_E07, { z: 86 });
    f.obj("modular-suite/props/harmony_arch/facade_sign_post_office.png", 4.72, 15.20, 0.95, 0.76, ANG_E07, { z: 82 });
    f.obj("modular-suite/props/harmony_arch/str_letterbox_prussian_blue.png", 4.32, 15.65, 0.66, 0.66, ANG_E07, { z: 68 });
    f.obj("modular-suite/props/harmony_arch/str_noticeboard_civic.png", 6.42, 18.60, 1.12, 0.48, ANG_E07, { z: 66 });

    // --- 1F POSTAMT NR. 4: PUBLIC P.O. BOX LOBBY (x = 5.4..9.6, y = 14.1..18.8) ---
    f.obj("modular-suite/props/post_housing/ph_po_box_brass_wall_bank.png", 7.35, 14.62, 2.30, 0.895, 0, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_po_box_wall_bank_corner.png", 8.45, 18.36, 1.92, 0.84, Math.PI, { z: 64 });
    // Freestanding central letter-writing stand with generous walk-in clearance from SW glass doors & teller queue
    f.obj("modular-suite/props/post_housing/ph_postal_writing_kiosk_stand.png", 7.25, 16.35, 1.47, 0.84, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/post_office/po_tied_letter_stack.png", 7.28, 16.10, 0.36, 0.27, 0.15, { z: 70, shadow: false });
    f.obj("modular-suite/props/post_office/po_quill_inkwell.png", 7.22, 16.65, 0.30, 0.34, -0.2, { z: 70, shadow: false });
    f.obj("modular-suite/props/post_housing/ph_postal_teller_counter_grille.png", 9.08, 16.05, 2.40, 1.08, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", 9.05, 15.48, 0.42, 0.42, 0, { z: 72, shadow: false });
    f.obj("modular-suite/props/post_office/po_brass_desk_bell.png", 8.95, 16.58, 0.32, 0.32, 0, { z: 72, shadow: false });
    f.obj("modular-suite/props/harmony_arch/floor_doormat_coir_rustic.png", 6.18, 15.92, 0.84, 0.56, ANG_E07, { z: 48, shadow: false });
    f.obj("modular-suite/props/bare_furniture/bare_rustic_bench.png", 5.58, 14.85, 1.38, 0.46, ANG_E07, { z: 60 });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_scuff_scratch_patina.png", 7.45, 16.20, 1.80, 1.44, 0.25, { z: 48, shadow: false, opacity: 0.48 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 7.65, 16.15, 0.94, 0.94, 0, { z: 90, opacity: 0.86, shadow: false });

    // --- 1F POSTAMT NR. 4: BACK MAIL SORTING ROOM (x = 9.9..13.6, y = 14.1..17.6) ---
    f.obj("modular-suite/props/post_housing/ph_mail_sorting_table_bins.png", 11.65, 14.72, 2.16, 1.20, 0, { z: 64 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 11.35, 15.42, 0.62, 0.66, Math.PI, { z: 58 });
    f.obj("modular-suite/props/post_housing/ph_mail_sack_canvas_cart.png", 11.65, 16.05, 1.36, 0.94, ANG_E05, { z: 64 });
    f.obj("modular-suite/props/post_office/po_mail_pigeonholes.png", 10.42, 16.65, 1.05, 0.94, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/post_office/po_iron_strongbox.png", 10.42, 17.65, 0.74, 0.68, 0.15, { z: 64 });
    f.obj("modular-suite/props/post_office/po_brown_parcel.png", 13.05, 14.55, 0.52, 0.40, 0.25, { z: 62 });
    f.obj("modular-suite/props/post_office/po_leather_mail_satchel.png", 10.35, 14.68, 0.54, 0.41, -0.35, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_billiard_green_pendant.png", 11.55, 15.45, 0.92, 0.92, 0, { z: 90, opacity: 0.86, shadow: false });

    // --- 1F CENTRAL PARK RESIDENTIAL FOYER & STAIRWELL (x = 6.2..11.3, y = 10.2..13.9) ---
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", POST_HOUSING_STAIR_X, POST_HOUSING_STAIR_Y, 1.20, 1.50, 0, { z: 54 });
    f.obj("modular-suite/props/harmony_arch/floor_doormat_coir_rustic.png", 8.50, 11.42, 0.84, 0.56, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_woven_doormat.png", 10.90, 11.95, 0.72, 0.48, Math.PI / 2, { z: 48, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 6.55, 10.85, 0.58, 0.55, 0.2, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_tenant_mailbox_key_rack.png", 7.05, 13.52, 1.47, 0.63, Math.PI, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_community_bulletin_board_table.png", 10.42, 12.60, 1.40, 0.80, -Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 7.15, 11.25, 0.50, 0.50, 0, { z: 76, shadow: false });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_scuff_scratch_patina.png", 8.55, 11.75, 1.50, 1.20, 0, { z: 48, shadow: false, opacity: 0.45 });

    // --- 1F SHARED HALLWAY WC CUBICLE (x = 4.6..6.0, y = 12.7..13.9) ---
    f.obj("modular-suite/props/messy_apartment/apt_blue_bathmat_rug.png", 5.55, 13.30, 0.62, 0.46, Math.PI / 2, { z: 48, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_toilet_wc_stall.png", 5.20, 13.30, 0.85, 1.02, Math.PI / 2, { z: 62 });

    // --- 1F UNIT 1A (NW WING): RETIRED MAIL-CARRIER'S COZY STUDIO ---
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 3.65, 9.55, 2.0, 2.0, 0, { z: 46, shadow: false, recolor: Q_PRUSSIAN });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 2.65, 6.25, 1.06, 1.50, ANG_E09, { z: 64, recolor: Q_PRUSSIAN });
    f.obj("modular-suite/props/bedroom_home/home_patchwork_quilts.png", 2.95, 7.25, 0.54, 0.48, 0.25, { z: 66, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 1.35, 6.90, 0.56, 0.54, ANG_E07, { z: 60 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_amber_lamp.png", 1.35, 6.90, 0.38, 0.38, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 2.16, 9.40, 1.64, 0.82, ANG_E07 + Math.PI, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 4.32, 7.65, 1.16, 1.00, ANG_E10 + Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_washstand_basin.png", 5.28, 8.65, 0.78, 0.62, ANG_E10, { z: 62 });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_cobalt.png", 5.45, 9.75, 0.84, 0.84, 0, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_rocking_chair.png", 4.45, 9.65, 0.76, 0.88, -2.2, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 3.65, 9.55, 0.54, 0.53, 0.4, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_single_open_newspaper.png", 3.95, 10.45, 0.48, 0.42, 0.3, { z: 60, shadow: false });
    f.obj("modular-suite/props/bare_furniture/bare_white_kitchen_table.png", 4.25, 11.45, 1.06, 0.78, 0.1, { z: 62 });
    f.obj("modular-suite/props/post_office/po_tied_letter_stack.png", 4.10, 11.35, 0.40, 0.30, 0.25, { z: 68, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_coffee_mug.png", 4.48, 11.55, 0.26, 0.26, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_rush_seat_stool.png", 3.45, 11.45, 0.46, 0.52, 0.2, { z: 58 });
    f.obj("modular-suite/props/messy_apartment/apt_bare_metal_wastebasket.png", 3.35, 10.75, 0.42, 0.42, 0, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 3.40, 5.25, 0.60, 0.57, 0.2, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_hallway_shoe_coat_bench.png", 5.35, 11.65, 1.24, 0.62, Math.PI / 2, { z: 62 });

    // --- 1F UNIT 1B (NE WING): NIGHT-SHIFT TRAM BRAKEMAN'S STUDIO + HALL JANITOR NOOK ---
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 14.85, 9.65, 2.3, 1.6, ANG_E05, { z: 46, shadow: false, recolor: Q_RUST });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 16.05, 7.65, 1.06, 1.50, ANG_E03, { z: 64, recolor: Q_RUST });
    f.obj("modular-suite/props/bedroom_home/home_brass_footlocker.png", 17.35, 7.95, 0.94, 0.69, ANG_E03, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 13.75, 7.80, 1.16, 1.00, ANG_E01, { z: 64 });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_ochre.png", 12.05, 10.35, 0.84, 0.84, 0, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 16.68, 10.82, 1.64, 0.82, ANG_E05 + Math.PI, { z: 64 });
    f.obj("modular-suite/props/bare_furniture/bare_pine_worktable.png", 14.35, 10.25, 1.24, 0.93, ANG_E05, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_lantern_railroad_brass.png", 14.55, 10.05, 0.38, 0.38, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_ashtray_playing_cards.png", 14.15, 10.45, 0.48, 0.42, 0.3, { z: 68, shadow: false });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 13.45, 10.35, 0.60, 0.64, Math.PI / 2, { z: 58 });
    f.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 15.65, 8.75, 0.74, 0.65, -0.25, { z: 62 });
    f.obj("modular-suite/props/bare_furniture/bare_oak_sideboard.png", 13.95, 13.45, 1.35, 0.60, Math.PI, { z: 64 });
    f.obj("modular-suite/props/tavern_clutter/tav_wine_bottle_goblet.png", 13.70, 13.42, 0.36, 0.37, 0.1, { z: 70, shadow: false });
    f.obj("modular-suite/props/kitchen/kit_ceramic_plate_stack.png", 14.22, 13.44, 0.36, 0.38, -0.1, { z: 70, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_cardboard_box_sealed.png", 15.15, 12.45, 0.54, 0.54, 0.25, { z: 62 });
    f.obj("modular-suite/props/harmony_arch/int_radiator_iron_short.png", 17.85, 9.15, 0.92, 0.46, ANG_E05 + Math.PI, { z: 60 });
    f.obj("modular-suite/props/messy_apartment/apt_scattered_socks_pair.png", 17.35, 9.40, 0.42, 0.36, -0.4, { z: 62, shadow: false });
    f.obj("modular-suite/props/post_housing/ph_hallway_shoe_coat_bench.png", 12.65, 11.90, 1.24, 0.62, Math.PI, { z: 62 });
    // Hallway janitor/utility corner inside 1B entry alcove
    f.obj("modular-suite/props/tavern_clutter/tav_mop_water_bucket.png", 12.15, 13.35, 0.56, 0.61, 0.2, { z: 62 });
    f.obj("modular-suite/props/tavern_clutter/tav_straw_broom.png", 12.82, 13.35, 0.62, 0.64, -0.4, { z: 62 });

    // 1F Lights & DM Notes
    f.light("PH 1F Post Office Lobby Glow", 7.65, 16.15, 6.4, "#FFD080", 0.94, true);
    f.light("PH 1F Sorting Room Pendant", 11.65, 15.35, 5.2, "#A8F0C6", 0.84);
    f.light("PH 1F Park Foyer Gas Sconce", 8.55, 12.35, 5.2, "#FFC26B", 0.86, true);
    f.light("PH 1F Unit 1A Lamp", 3.35, 8.65, 5.4, "#FFB85C", 0.86, true);
    f.light("PH 1F Unit 1B Brakeman Lantern", 15.15, 9.65, 5.6, "#FFB85C", 0.86, true);
    f.note("NOTE", 7.65, 15.65, "1F · Postamt Nr. 4 & Brass P.O. Boxes (3F)", "Busy neighborhood Post Office right at the avenue crosswalk & streetcar stop. Brass P.O. Box #44 receives unmarked midnight letters from the Cathedral — watched closely by the journalist in Unit 3A upstairs!", "#38BDF8");
    f.note("NOTE", 8.55, 11.85, "1F · Parkblick Ledigenheim (Single Housing)", "Three-story municipal public housing for single working residents, entered from the sunny Neighborhood Park courtyard with 10 uniquely lived-in single studios across 1F–3F.", "#F59E0B");
  }

  // =========================================================================
  // 2F (+14ft): 4 SINGLE-OCCUPANT PUBLIC HOUSING STUDIOS (2A, 2B, 2C, 2D) + SHARED WC
  // =========================================================================
  {
    const f = makeFloorHelper("2f", f2Out);
    f.floor("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", POST_HOUSING_POLY);
    f.floor("modular-suite/terrain/harmony/flr_dark_slate_hall_slabs.png", CENTRAL_HALL_POLY);
    f.buildOuterShell(false);

    // 2F Corridor & 4 Studio Partition Walls + Shared 2F Hallway WC!
    const w2South = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_ochre.png", [[4.45, 14.0], [14.45, 14.0]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 7.35, 14.0, 0, "door", 0.88, true, w2South);
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 10.25, 14.0, 0, "door", 0.88, true, w2South);
    const w2Mid = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[9.0, 14.0], [9.0, 19.0]], { thickness: 0.14 });
    void w2Mid;

    const w2W = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [[6.10, 9.33], [6.10, 14.0]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 6.10, 12.15, Math.PI / 2, "door", 0.90, true, w2W);

    const w2E = f.wall("modular-suite/walls/harmony/wall_tenement_peeling_ochre.png", [[11.40, 9.25], [11.40, 14.0]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 11.40, 12.85, Math.PI / 2, "door", 0.90, true, w2E);

    // Shared 2F Hallway WC cubicle tucked in NE corner of landing (x=10.0..11.4, y=11.0..12.25)
    const w2Wc = f.wall("modular-suite/walls/harmony/wall_subway_white_tile.png", [[10.0, 11.0], [10.0, 12.25], [11.40, 12.25]], { thickness: 0.13 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 10.65, 12.25, 0, "door", 0.78, true, w2Wc);

    // Central 2F Stairwell & Hallway Lived-In Details
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", POST_HOUSING_STAIR_X, POST_HOUSING_STAIR_Y, 1.20, 1.50, 0, { z: 54 });
    f.obj("modular-suite/props/messy_apartment/apt_blue_bathmat_rug.png", 10.65, 11.92, 0.58, 0.43, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_toilet_wc_stall.png", 10.72, 11.55, 0.82, 0.98, 0, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 6.55, 10.85, 0.58, 0.55, -0.2, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 7.35, 12.85, 0.72, 0.63, 0.25, { z: 60, shadow: false });
    f.obj("modular-suite/props/harmony_arch/floor_doormat_coir_rustic.png", 6.62, 12.15, 0.72, 0.48, Math.PI / 2, { z: 48, shadow: false });
    f.obj("modular-suite/props/harmony_arch/floor_doormat_coir_rustic.png", 7.35, 13.52, 0.72, 0.48, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/harmony_arch/floor_doormat_coir_rustic.png", 10.25, 13.52, 0.72, 0.48, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_scuff_scratch_patina.png", 8.65, 11.55, 1.50, 1.20, 0, { z: 48, shadow: false, opacity: 0.46 });
    f.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 7.25, 11.22, 0.50, 0.50, 0, { z: 76, shadow: false });

    // --- UNIT 2A (NW WING): ARCANE-ENGINEERING STUDENT'S CLUTTERED STUDIO ---
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 3.45, 8.95, 2.1, 1.5, ANG_E07, { z: 46, shadow: false, recolor: Q_SAGE });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 2.65, 6.25, 1.06, 1.50, ANG_E09, { z: 64, recolor: Q_SAGE });
    f.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 1.55, 7.25, 0.74, 0.65, 0.35, { z: 62 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 2.16, 9.40, 1.64, 0.82, ANG_E07 + Math.PI, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_dirty_plates_pan_stack.png", 2.72, 10.20, 0.50, 0.45, -0.2, { z: 66 });
    f.obj("modular-suite/props/bare_furniture/bare_pine_worktable.png", 4.35, 8.55, 1.28, 0.96, ANG_E10 + Math.PI / 2, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_rush_seat_stool.png", 3.52, 8.68, 0.46, 0.52, 0.25, { z: 58 });
    f.obj("modular-suite/props/messy_apartment/apt_tangled_aether_wires.png", 4.42, 8.50, 0.76, 0.71, 0.4, { z: 68, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_aether_cyan_desk.png", 4.15, 8.15, 0.40, 0.40, 0, { z: 70, shadow: false });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_emerald.png", 5.45, 9.75, 0.82, 0.82, 0, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_open_pizza_box.png", 3.55, 9.75, 0.52, 0.52, 0.35, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 4.85, 10.45, 0.54, 0.54, 0, { z: 62 });
    f.obj("modular-suite/props/bare_furniture/bare_oak_sideboard.png", 3.45, 11.45, 1.30, 0.58, ANG_E07 + Math.PI, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 4.30, 12.65, 0.86, 0.75, 0.15, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_cardboard_box_open.png", 5.20, 13.15, 0.64, 0.64, 0.25, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_coffee_mug.png", 4.15, 8.85, 0.28, 0.28, 0, { z: 70, shadow: false });
    f.obj("modular-suite/props/post_housing/ph_hallway_shoe_coat_bench.png", 5.35, 11.45, 1.20, 0.60, Math.PI / 2, { z: 62 });

    // --- UNIT 2B (SW-SOUTH WING): SEAMSTRESS & MILLINER'S SUNNY STUDIO ---
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 7.35, 16.05, 1.9, 1.9, 0, { z: 46, shadow: false, recolor: Q_ROSE });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 8.02, 17.55, 1.06, 1.50, 0, { z: 64, recolor: Q_ROSE });
    f.obj("modular-suite/props/bedroom_home/home_patchwork_quilts.png", 7.55, 16.85, 0.52, 0.46, -0.25, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 5.95, 14.58, 1.56, 0.78, 0, { z: 64 });
    f.obj("modular-suite/props/boulevard_shops/bs_treadle_sewing_machine_desk.png", 6.26, 15.95, 1.24, 0.86, ANG_E07 + Math.PI, { z: 64 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 6.95, 15.55, 0.58, 0.62, ANG_E07, { z: 58 });
    f.obj("modular-suite/props/market_tailor/mkt_sewing_basket.png", 6.72, 16.65, 0.54, 0.54, 0.2, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_folded_laundry_bundle.png", 8.35, 14.62, 0.54, 0.48, 0.15, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_blue_flower_vase.png", 6.92, 17.18, 0.44, 0.41, 0, { z: 66 });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_rose_lamp.png", 7.22, 17.85, 0.38, 0.38, 0, { z: 68, shadow: false });

    // --- UNIT 2C (SE-SOUTH WING): STREET MUSICIAN'S LUTE & GRAMOPHONE FLAT ---
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 10.85, 15.65, 1.9, 1.9, 0, { z: 46, shadow: false, recolor: Q_PLUM });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 9.72, 17.05, 1.06, 1.50, 0, { z: 64, recolor: Q_PLUM });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 12.15, 14.58, 1.56, 0.78, 0, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 11.25, 15.85, 1.24, 0.78, ANG_E05, { z: 64 });
    f.obj("modular-suite/props/tavern_clutter/tav_wine_bottle_goblet.png", 11.35, 15.75, 0.36, 0.37, 0.2, { z: 70, shadow: false });
    f.obj("modular-suite/props/tavern_clutter/tav_round_bar_stool.png", 10.45, 16.05, 0.46, 0.45, 0, { z: 58 });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_lute.png", 10.65, 16.65, 0.66, 0.67, 0.55, { z: 66 });
    f.obj("modular-suite/props/music_theater_tea/mus_brass_gramophone.png", 12.35, 15.65, 0.72, 0.68, -0.5, { z: 66 });
    f.obj("modular-suite/props/messy_apartment/apt_crumpled_paper_litter.png", 10.15, 15.45, 0.52, 0.46, 0.3, { z: 60, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_floor_tiffany_stained_lamp.png", 9.55, 14.68, 0.66, 0.66, 0, { z: 70 });

    // --- UNIT 2D (NE WING): BAKER'S APPRENTICE'S WARM PARK-VIEW STUDIO ---
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 14.85, 9.65, 2.2, 1.6, ANG_E05, { z: 46, shadow: false, recolor: Q_OCHRE });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 16.05, 7.65, 1.06, 1.50, ANG_E03, { z: 64, recolor: Q_OCHRE });
    f.obj("modular-suite/props/bedroom_home/home_washstand_basin.png", 15.20, 6.65, 0.78, 0.62, 0, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 13.75, 7.80, 1.16, 1.00, ANG_E01, { z: 64 });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_ivory_gold.png", 12.05, 10.35, 0.84, 0.84, 0, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 16.68, 10.82, 1.64, 0.82, ANG_E05 + Math.PI, { z: 64 });
    f.obj("modular-suite/props/kitchen/kit_sourdough_boule.png", 16.72, 10.60, 0.36, 0.34, 0.2, { z: 70, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_dirty_plates_pan_stack.png", 15.85, 11.55, 0.50, 0.45, 0.25, { z: 64 });
    f.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 14.45, 10.15, 0.90, 0.90, 0, { z: 62 });
    f.obj("modular-suite/props/tavern_clutter/tav_hot_stew_bowl.png", 14.45, 10.15, 0.38, 0.42, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 13.55, 10.15, 0.60, 0.64, Math.PI / 2, { z: 58 });
    f.obj("modular-suite/props/bare_furniture/bare_oak_sideboard.png", 13.95, 13.45, 1.35, 0.60, Math.PI, { z: 64 });
    f.obj("modular-suite/props/kitchen/kit_vegetable_basket.png", 13.95, 13.42, 0.46, 0.46, 0.15, { z: 70, shadow: false });
    f.obj("modular-suite/props/kitchen/kit_grain_sack.png", 15.20, 12.50, 0.56, 0.56, -0.25, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 17.55, 9.15, 0.66, 0.61, -0.3, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 12.65, 9.45, 0.60, 0.57, 0.2, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_hallway_shoe_coat_bench.png", 12.65, 12.55, 1.20, 0.60, Math.PI, { z: 62 });

    // 2F Lights
    f.light("PH 2F Hallway Sconce", 8.55, 12.25, 4.8, "#FFC26B", 0.84, true);
    f.light("PH 2F Unit 2A Cyan Desk", 4.15, 8.35, 5.2, "#7AE6FF", 0.84);
    f.light("PH 2F Unit 2B Rose Lamp", 7.25, 16.35, 4.8, "#FFAF96", 0.86, true);
    f.light("PH 2F Unit 2C Tiffany Glow", 10.75, 15.65, 5.0, "#FFB86C", 0.86, true);
    f.light("PH 2F Unit 2D Warm Flat", 15.15, 9.65, 5.4, "#FFC672", 0.88, true);
  }

  // =========================================================================
  // 3F (+28ft): TOP-FLOOR ATTIC SINGLE STUDIOS (3A, 3B, 3C, 3D) + LAUNDRY ALCOVE
  // =========================================================================
  {
    const f = makeFloorHelper("3f", f3Out);
    f.floor("modular-suite/terrain/harmony/flr_weathered_attic_planks.png", POST_HOUSING_POLY);
    f.floor("modular-suite/terrain/harmony/flr_dark_slate_hall_slabs.png", CENTRAL_HALL_POLY);
    f.buildOuterShell(false);

    // Same crisp 4-studio + landing structural layout stacked cleanly above 2F!
    const w3South = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[4.45, 14.0], [14.45, 14.0]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 7.35, 14.0, 0, "door", 0.88, true, w3South);
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 10.25, 14.0, 0, "door", 0.88, true, w3South);
    const w3Mid = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[9.0, 14.0], [9.0, 19.0]], { thickness: 0.14 });
    void w3Mid;

    const w3W = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[6.10, 9.33], [6.10, 14.0]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 6.10, 12.15, Math.PI / 2, "door", 0.90, true, w3W);

    const w3E = f.wall("modular-suite/walls/harmony/wall_fachwerk_cream_oak.png", [[11.40, 9.25], [11.40, 14.0]], { thickness: 0.15 });
    f.portal("modular-suite/portals/harmony/door_tenement_weathered_blue.png", 11.40, 12.85, Math.PI / 2, "door", 0.90, true, w3E);

    const w3Wc = f.wall("modular-suite/walls/harmony/wall_subway_white_tile.png", [[10.0, 11.0], [10.0, 12.25], [11.40, 12.25]], { thickness: 0.13 });
    f.portal("modular-suite/portals/harmony/door_tenement_peeling_green.png", 10.65, 12.25, 0, "door", 0.78, true, w3Wc);

    // Central 3F Stairwell + Shared Top-Floor Laundry Drying Alcove & Hallway WC!
    f.obj("modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png", POST_HOUSING_STAIR_X, POST_HOUSING_STAIR_Y, 1.20, 1.50, 0, { z: 54 });
    f.obj("modular-suite/props/messy_apartment/apt_blue_bathmat_rug.png", 10.65, 11.92, 0.58, 0.43, 0, { z: 48, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_toilet_wc_stall.png", 10.72, 11.55, 0.82, 0.98, 0, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", 6.95, 11.75, 1.38, 0.83, Math.PI / 2, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 7.15, 13.15, 0.64, 0.59, 0.25, { z: 62 });
    f.obj("modular-suite/props/weathering_overlays/wth_obj_dust_film_veil.png", 8.65, 11.85, 1.60, 1.60, 0.15, { z: 72, shadow: false, opacity: 0.38 });

    // --- UNIT 3A (NW WING): RECLUSIVE INVESTIGATIVE JOURNALIST'S GARRET (SECRET DM HOOK!) ---
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 3.45, 8.95, 2.1, 1.5, ANG_E07, { z: 46, shadow: false, recolor: Q_SLATE });
    f.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 2.65, 6.25, 1.12, 1.52, ANG_E09, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 2.16, 9.40, 1.64, 0.82, ANG_E07 + Math.PI, { z: 64 });
    f.obj("modular-suite/props/bare_furniture/bare_blotter_desk.png", 4.32, 8.65, 1.32, 0.80, ANG_E10 + Math.PI / 2, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_rush_seat_stool.png", 3.60, 8.75, 0.46, 0.52, 0.2, { z: 58 });
    f.obj("modular-suite/props/post_office/po_open_ledger.png", 4.25, 8.55, 0.46, 0.35, 0.2, { z: 68, shadow: false });
    f.obj("modular-suite/props/post_office/po_wax_sealed_envelope.png", 4.42, 8.98, 0.40, 0.29, -0.35, { z: 68, shadow: false });
    f.obj("modular-suite/props/post_office/po_spectacles_magnifier.png", 4.18, 8.18, 0.36, 0.33, 0.1, { z: 68, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_coffee_mug.png", 4.52, 8.65, 0.26, 0.26, 0, { z: 70, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", 4.52, 8.22, 0.38, 0.38, 0, { z: 70, shadow: false });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_cobalt.png", 5.45, 9.75, 0.82, 0.82, 0, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 4.95, 9.05, 0.50, 0.50, 0, { z: 62 });
    f.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 4.65, 10.65, 0.90, 0.79, 0.3, { z: 60, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 4.25, 12.55, 0.86, 0.75, -0.15, { z: 62 });
    f.obj("modular-suite/props/post_housing/ph_hallway_shoe_coat_bench.png", 5.35, 11.45, 1.20, 0.60, Math.PI / 2, { z: 62 });

    // --- UNIT 3B (SW-SOUTH WING): PARK GARDENER & BOTANIST'S PLANT-FILLED FLAT ---
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 7.35, 16.05, 1.9, 1.9, 0, { z: 46, shadow: false, recolor: Q_EMERALD });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 8.02, 17.55, 1.06, 1.50, 0, { z: 64, recolor: Q_EMERALD });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 5.95, 14.58, 1.56, 0.78, 0, { z: 64 });
    f.obj("modular-suite/props/kitchen/kit_vegetable_basket.png", 7.55, 15.12, 0.48, 0.48, 0.2, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_rush_seat_stool.png", 6.05, 15.55, 0.46, 0.52, -0.2, { z: 58 });
    f.obj("modular-suite/props/bedroom_home/home_rocking_chair.png", 6.65, 16.05, 0.76, 0.88, 0.7, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 6.72, 16.82, 0.62, 0.59, 0.2, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_potted_fern.png", 8.35, 14.68, 0.60, 0.57, -0.4, { z: 64 });
    f.obj("modular-suite/props/bedroom_home/home_blue_flower_vase.png", 7.22, 17.85, 0.44, 0.41, 0, { z: 66 });
    f.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 7.25, 16.15, 0.86, 0.86, 0, { z: 90, opacity: 0.84, shadow: false });

    // --- UNIT 3C (SE-SOUTH WING): OFF-DUTY WATCHTOWER SCOUT'S SPARTAN STUDIO ---
    f.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 10.85, 15.65, 1.9, 1.4, ANG_E05, { z: 46, shadow: false, recolor: Q_BURGUNDY });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 9.72, 17.05, 1.06, 1.50, 0, { z: 64, recolor: Q_BURGUNDY });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 12.15, 14.58, 1.56, 0.78, 0, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_bare_metal_wastebasket.png", 11.15, 14.55, 0.42, 0.42, 0, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_brass_footlocker.png", 11.45, 16.35, 0.94, 0.69, ANG_E05, { z: 64 });
    f.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 12.15, 15.65, 0.68, 0.60, 0.3, { z: 62 });
    f.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 10.65, 15.35, 0.86, 0.86, 0, { z: 62 });
    f.obj("modular-suite/props/tavern_clutter/tav_leather_dice_cup.png", 10.52, 15.25, 0.36, 0.29, 0.2, { z: 68, shadow: false });
    f.obj("modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png", 10.82, 15.48, 0.38, 0.38, 0, { z: 68, shadow: false });
    f.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 9.80, 15.35, 0.58, 0.62, Math.PI / 2, { z: 58 });

    // --- UNIT 3D (NE WING): RETIRED CARTOGRAPHER & PENSIONER'S COZY FLAT ---
    f.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 14.95, 9.75, 2.2, 2.2, 0, { z: 46, shadow: false, recolor: Q_TEAL });
    f.obj("modular-suite/props/post_housing/ph_single_bed_quilted_colorable.png", 16.05, 7.65, 1.06, 1.50, ANG_E03, { z: 64, recolor: Q_AMBER });
    f.obj("modular-suite/props/bedroom_home/home_vanity_mirror_brush.png", 15.05, 6.65, 0.78, 0.60, 0, { z: 62 });
    f.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 13.75, 7.80, 1.16, 1.00, ANG_E01, { z: 64 });
    f.obj("modular-suite/props/harmony_arch/int_kachelofen_ivory_gold.png", 12.05, 10.35, 0.84, 0.84, 0, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 16.68, 10.82, 1.64, 0.82, ANG_E05 + Math.PI, { z: 64 });
    f.obj("modular-suite/colorable/col_armchair_club.png", 13.85, 10.05, 0.86, 0.86, 0.6, { z: 62, recolor: Q_TEAL });
    f.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 14.85, 10.35, 0.86, 0.86, 0, { z: 62 });
    f.obj("modular-suite/props/harmony_lighting/lgt_floor_brass_reading_lamp.png", 13.15, 9.45, 0.64, 0.64, 0, { z: 70 });
    f.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 15.15, 9.40, 0.54, 0.53, -0.35, { z: 62 });
    f.obj("modular-suite/props/bare_furniture/bare_oak_sideboard.png", 13.95, 13.45, 1.35, 0.60, Math.PI, { z: 64 });
    f.obj("modular-suite/props/post_office/po_open_ledger.png", 13.72, 13.42, 0.46, 0.35, 0.1, { z: 70, shadow: false });
    f.obj("modular-suite/props/post_office/po_quill_inkwell.png", 14.22, 13.42, 0.34, 0.39, -0.15, { z: 70, shadow: false });
    f.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 14.35, 11.75, 0.78, 0.68, 0.25, { z: 60, shadow: false });
    f.obj("modular-suite/props/bedroom_home/home_brass_footlocker.png", 17.45, 9.15, 0.94, 0.69, ANG_E05 + Math.PI, { z: 64 });
    f.obj("modular-suite/props/post_housing/ph_hallway_shoe_coat_bench.png", 12.65, 12.55, 1.20, 0.60, Math.PI, { z: 62 });

    // 3F Lights & DM Secret Hook
    f.light("PH 3F Top Landing Glow", 8.55, 12.25, 4.8, "#FFC26B", 0.84, true);
    f.light("PH 3F Unit 3A Banker Lamp", 4.35, 8.55, 5.2, "#FFC26B", 0.88, true);
    f.light("PH 3F Unit 3B Milkglass", 7.25, 16.15, 5.0, "#FFD699", 0.86);
    f.light("PH 3F Unit 3C Oil Lamp", 10.75, 15.55, 4.8, "#FFB35C", 0.84, true);
    f.light("PH 3F Unit 3D Reading Lamp", 14.85, 9.85, 5.4, "#FFC876", 0.88, true);
    f.note("SECRET", 4.35, 8.65, "3F · Unit 3A Journalist's P.O. Box #44 Dossier", "A reclusive investigative reporter tracks midnight deliveries to Brass P.O. Box #44 downstairs — wax-sealed envelopes stamped with the Sovereign Cathedral's violet seal lie under a magnifier on this desk!", "#A855F7");
  }

  return { postHousingPoly: POST_HOUSING_POLY };
}

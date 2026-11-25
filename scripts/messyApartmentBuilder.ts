/**
 * Builds the 4-Story Gloriously Messy Dark-Magipunk Apartment Building
 * ("42 Eisenbahnstraße Tenement" — 15 unique lived-in messy apartment units + 1F mailroom
 * lobby + overflowing rear alley trash yard) directly onto the stepped NE block
 * (`dd-shape-floor-1-15`, x ∈ [30.5..47.9], y ∈ [0.5..11.0]) across 1F, 2F, 3F, and 4F!
 *
 * Every unit features a distinct messy tenant persona:
 *  - 1F: Mailroom Lobby, Rear Trash Alley + 1A Sleepless Tram Conductor, 1B Packrat Hoarder, 1C Baker & Card Sharks
 *  - 2F: 2A Chaotic Magipunk Tinkerer, 2B Bohemian Painter & Violinist, 2C Exhausted Young Parents & Cats, 2D Night-Shift Printer Studio
 *  - 3F: 3A Bootleg Aether-Alchemist, 3B Conspiracy Journalist, 3C Retired Opera Singer & Cats, 3D Unpacked Courier Studio
 *  - 4F: 4A Underground Smuggler, 4B Burned-Out Arcane Student, 4C Clockwork Tailor Workshop, 4D Rooftop Stargazer Studio
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
  type SplinePath,
  type TerrainStroke,
  type WallSegment,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

// Exact 10-vertex orthogonal perimeter of `dd-shape-floor-1-15` cleanly bounded inside map width 48.0:
export const APT_POLY: Point2D[] = [
  { x: 47.85, y: 0.5 },
  { x: 47.85, y: 7.0 },
  { x: 42.5, y: 7.0 },
  { x: 42.5, y: 11.0 },
  { x: 30.5, y: 11.0 },
  { x: 30.5, y: 6.5 },
  { x: 34.0, y: 6.5 },
  { x: 34.0, y: 3.0 },
  { x: 37.0, y: 3.0 },
  { x: 37.0, y: 0.5 },
];

function rect(x0: number, y0: number, x1: number, y1: number): Point2D[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function tint(hex: string, mode: "dd_red" | "tint" = "dd_red", strength = 0.88): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode, tintHex: hex, strength };
}

const FADED_RUST = tint("#8E3B33", "dd_red", 0.88);
const DUSTY_TEAL = tint("#2D6B74", "dd_red", 0.88);
const MUSTARD_GOLD = tint("#C08D34", "dd_red", 0.86);
const OLIVE_MOSS = tint("#556B45", "dd_red", 0.86);
const WORN_PLUM = tint("#63335A", "dd_red", 0.88);
const SLATE_BLUE = tint("#364D6E", "dd_red", 0.88);
const CREAM_LINEN = tint("#EFE4CE", "dd_red", 0.82);

// Standard orthogonal sprite rotations (front = +Y at rot 0):
const FACE_S = 0;
const FACE_W = Math.PI / 2;
const FACE_N = Math.PI;
const FACE_E = -Math.PI / 2;

function makeAptFloorBuilder(floorTag: string) {
  let seq = 0;
  const uid = (p: string) => `apt-${floorTag}-${p}-${++seq}`;
  const b: IceCreamBuildBundle = {
    terrain: [],
    paths: [],
    walls: [],
    portals: [],
    objects: [],
    lights: [],
    dmNotes: [],
  };

  const floorPoly = (assetId: string, points: Point2D[], opacity = 1, recolor?: RgbRecolor) => {
    b.terrain.push({
      id: uid("flr"),
      assetId,
      shape: "polygon",
      points,
      radiusCells: 0,
      opacity,
      softness: 0,
      recolor,
    });
  };

  const wall = (
    assetId: string,
    points: Point2D[],
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean } = {},
  ) => {
    const id = uid("wall");
    b.walls.push({
      id,
      assetId,
      points,
      closed: Boolean(opts.closed),
      curved: false,
      thicknessCells: opts.thickness ?? 0.14,
      blocksLight: opts.blocksLight ?? true,
    });
    return id;
  };

  const portal = (
    assetId: string,
    x: number,
    y: number,
    rot: number,
    kind: PortalNode["kind"],
    widthCells = 0.95,
    closed = true,
    wallId?: string,
  ) => {
    b.portals.push({
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
    b.objects.push({
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
      zOrder: opts.z ?? 60,
    });
  };

  const light = (
    name: string,
    x: number,
    y: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.85,
    opts: { castShadows?: boolean; flicker?: boolean } = {},
  ) => {
    b.lights.push({
      id: uid("lgt"),
      name,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      radiusCells,
      intensity,
      colorHex,
      castShadows: opts.castShadows ?? true,
      coneAngleDeg: 360,
      directionRad: 0,
      flicker: opts.flicker ?? true,
    });
  };

  const note = (
    badge: DmNotePin["badge"],
    x: number,
    y: number,
    title: string,
    body: string,
    colorHex: string,
  ) => {
    b.dmNotes.push({
      id: uid("note"),
      x,
      y,
      badge,
      title,
      body,
      colorHex,
    });
  };

  return { b, floorPoly, wall, portal, obj, light, note };
}

type AptBuilder = ReturnType<typeof makeAptFloorBuilder>;

/**
 * Builds the shared architectural shell, exterior windows, interior apartment demising walls,
 * central hallway, aligned vertical wooden stairwell, and WC/bath tile floors for a single floor (1F–4F).
 */
function buildFloorArchitecture(fb: AptBuilder, floorNum: 1 | 2 | 3 | 4) {
  // Base aged floors across footprint (varied floorboards per wing so every apartment reads distinctly!)
  if (floorNum > 1) {
    fb.floorPoly("core-fantasy/terrain/tavern_oak_planks.png", APT_POLY);
  }
  // Distinct flooring per unit so adjacent apartments never visually blur together!
  fb.floorPoly(
    floorNum % 2 === 1
      ? "core-fantasy/terrain/aged_dark_floorboards.png"
      : "modular-suite/terrain/funeral_dark_parquet.png",
    rect(30.55, 6.55, 38.0, 10.95),
  ); // Unit A
  fb.floorPoly(
    floorNum % 2 === 0
      ? "core-fantasy/terrain/aged_dark_floorboards.png"
      : "core-fantasy/terrain/tavern_oak_planks.png",
    rect(37.05, 0.55, 41.2, 5.2),
  ); // Unit B north
  fb.floorPoly(
    floorNum % 2 === 0
      ? "core-fantasy/terrain/aged_dark_floorboards.png"
      : "core-fantasy/terrain/tavern_oak_planks.png",
    rect(34.05, 3.05, 37.1, 5.2),
  ); // Unit B west
  fb.floorPoly(
    floorNum % 2 === 1
      ? "modular-suite/terrain/funeral_dark_parquet.png"
      : "core-fantasy/terrain/aged_dark_floorboards.png",
    rect(41.2, 0.55, 47.8, 6.95),
  ); // Unit C

  // Central Tenement Hallway & Stairwell Landing (scuffed stone/flagstone)
  fb.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", rect(38.0, 5.2, 42.45, floorNum === 1 ? 10.95 : 8.2));
  if (floorNum > 1) {
    fb.floorPoly("core-fantasy/terrain/tavern_oak_planks.png", rect(38.0, 8.2, 42.45, 10.95)); // Unit D micro-studio
  }

  // White Ceramic Bathroom Tile in Unit A WC (30.55..32.25, 6.55..8.15) & Unit C WC/Bath (45.85..47.8, 0.55..2.45)
  fb.floorPoly("modular-suite/terrain/clinic_white_tile.png", rect(30.55, 6.55, 32.25, 8.15));
  fb.floorPoly("modular-suite/terrain/clinic_white_tile.png", rect(45.85, 0.55, 47.8, 2.45));

  // Exterior Gründerzeit Brick Perimeter Wall (light-blocking!)
  const wPerim = fb.wall("walls/grunderzeit_brick_wall.png", APT_POLY, {
    closed: true,
    thickness: 0.18,
    blocksLight: true,
  });

  // Exterior Gaslit Tenement Windows ringing all 4 sides!
  for (const wx of [32.4, 35.8, 40.2]) {
    if (floorNum === 1 && wx === 40.2) continue; // Main entrance door sits here on 1F!
    fb.portal("portals/slum_grimy_window.png", wx, 11.0, 0, "window", 1.2, true, wPerim);
  }
  fb.portal("portals/slum_grimy_window.png", 30.5, 9.2, Math.PI / 2, "window", 1.15, true, wPerim);
  fb.portal("portals/slum_grimy_window.png", 34.0, 4.75, Math.PI / 2, "window", 1.15, true, wPerim);
  fb.portal("portals/slum_grimy_window.png", 37.0, 1.8, Math.PI / 2, "window", 1.05, true, wPerim);
  for (const wx of [39.1, 43.4, 46.6]) {
    fb.portal("portals/slum_grimy_window.png", wx, 0.5, 0, "window", 1.15, true, wPerim);
  }
  fb.portal("portals/slum_grimy_window.png", 44.8, 7.0, 0, "window", 1.2, true, wPerim);

  if (floorNum === 1) {
    // 1F Main Street Entry Double-Width Brass Door (closed so door leaf never sticks out under 2D–4D!) + Rear Alley Door
    fb.portal("portals/jugendstil_brass_door.png", 40.2, 11.0, 0, "door", 1.35, true, wPerim);
    fb.portal("portals/tenement_slum_door.png", 42.5, 9.2, Math.PI / 2, "door", 0.95, true, wPerim);
  } else {
    // Upper-floor south corridor window overlooking alley notch
    fb.portal("portals/slum_grimy_window.png", 42.5, 9.5, Math.PI / 2, "window", 1.0, true, wPerim);
  }

  // Interior Tenement Plaster Demising Walls separating Units A, B, C, Hallway & (2F–4F) Unit D:
  // 1) Unit A east wall separating Unit A from Hallway/Lobby (x = 38.0, y: 5.2..11.0)
  const wA = fb.wall("walls/tenement_plaster_wall.png", [{ x: 38.0, y: 5.2 }, { x: 38.0, y: 11.0 }], { thickness: 0.14 });
  // 2) Horizontal wall separating Unit B (north) from Unit A & Hallway (y = 5.2, x: 34.0..41.2)
  const wB = fb.wall("walls/tenement_plaster_wall.png", [{ x: 34.0, y: 5.2 }, { x: 41.2, y: 5.2 }], { thickness: 0.14 });
  // Also extend short stub x = 34.0, y: 5.2..6.5 so Unit A & Unit B meet cleanly at step!
  fb.wall("walls/tenement_plaster_wall.png", [{ x: 34.0, y: 6.5 }, { x: 38.0, y: 6.5 }], { thickness: 0.14 });
  // Wait: x: 34.0..38.0, y: 5.2..6.5 becomes a cozy walk-in closet / hallway storage pantry OR part of Unit B!
  // Let's keep y = 5.2 as Unit B's south wall over x: 38.0..41.2 and y = 6.5 over x: 34.0..38.0 — ZERO wasted dead pocket!
  // Let's remove the duplicate stub above and route Unit B cleanly down to y = 6.5 on its west wing!
  fb.b.walls.pop(); // pop the stub we just tested
  fb.b.walls.pop(); // pop straight wB
  const wBSouth = fb.wall(
    "walls/tenement_plaster_wall.png",
    [
      { x: 34.0, y: 6.5 },
      { x: 38.0, y: 6.5 },
      { x: 38.0, y: 5.2 },
      { x: 41.2, y: 5.2 },
    ],
    { thickness: 0.14 },
  );
  // Make sure Unit B west floor fills y: 3.0..6.5 cleanly!
  fb.floorPoly(
    floorNum % 2 === 0
      ? "core-fantasy/terrain/aged_dark_floorboards.png"
      : "core-fantasy/terrain/tavern_oak_planks.png",
    rect(34.05, 5.15, 37.98, 6.48),
  );

  // 3) Unit C west & south demising walls (x = 41.2, y: 0.5..7.0 and y = 7.0, x: 41.2..42.5 sealing Unit C from stairwell shaft!)
  const wC = fb.wall("walls/tenement_plaster_wall.png", [{ x: 41.2, y: 0.5 }, { x: 41.2, y: 7.0 }], { thickness: 0.14 });
  fb.wall("walls/tenement_plaster_wall.png", [{ x: 41.2, y: 7.0 }, { x: 42.5, y: 7.0 }], { thickness: 0.14 });

  // 4) Interior WC nook walls (Unit A WC & Unit C WC) + Unit A bedroom divider
  const wAwc = fb.wall(
    "walls/tenement_plaster_wall.png",
    [
      { x: 32.25, y: 6.5 },
      { x: 32.25, y: 8.15 },
      { x: 30.5, y: 8.15 },
    ],
    { thickness: 0.11 },
  );
  const wCwc = fb.wall(
    "walls/tenement_plaster_wall.png",
    [
      { x: 45.85, y: 0.5 },
      { x: 45.85, y: 2.45 },
      { x: 47.85, y: 2.45 },
    ],
    { thickness: 0.11 },
  );

  // Apartment Unit Entry Doors from the Central Stairwell Hallway!
  fb.portal("portals/tenement_slum_door.png", 38.0, 7.35, Math.PI / 2, "door", 0.92, floorNum !== 2, wA); // Unit A door
  fb.portal("portals/tenement_slum_door.png", 39.25, 5.2, 0, "door", 0.92, true, wBSouth); // Unit B door
  fb.portal("portals/tenement_slum_door.png", 41.2, 5.72, Math.PI / 2, "door", 0.9, floorNum === 3, wC); // Unit C door (crisp stair clearance!)
  // WC interior doors
  fb.portal("portals/station_oak_door.png", 32.25, 7.4, Math.PI / 2, "door", 0.72, true, wAwc);
  fb.portal("portals/station_oak_door.png", 45.85, 1.55, Math.PI / 2, "door", 0.72, false, wCwc);

  // 2F–4F Unit D Front Micro-Studio partition at y = 8.2 (x: 38.0..42.5)
  if (floorNum > 1) {
    const wD = fb.wall("walls/tenement_plaster_wall.png", [{ x: 38.0, y: 8.2 }, { x: 42.5, y: 8.2 }], { thickness: 0.14 });
    fb.portal("portals/tenement_slum_door.png", 39.45, 8.2, 0, "door", 0.9, floorNum !== 4, wD);
  }

  // Aligned Central Tenement Wooden Stairwell (1.00x native aspect, tucked cleanly inside x: 40.72..42.25, y: 7.09..8.11 stairwell bay, opening West onto the hall landing!)
  fb.obj("objects/wood_interior_stairs.png", 41.48, 7.6, 1.02, 1.53, FACE_W, { z: 54 });
  fb.obj("modular-suite/props/bedroom_home/home_woven_doormat.png", 38.52, 7.35, 0.65, 0.44, FACE_W, { z: 42, shadow: false });
  fb.obj("modular-suite/props/bedroom_home/home_woven_doormat.png", 39.25, 5.65, 0.65, 0.44, FACE_S, { z: 42, shadow: false });
  fb.obj("modular-suite/props/messy_apartment/apt_toilet_wc_stall.png", 31.35, 7.22, 0.92, 1.1, FACE_S, { z: 58 });
  fb.obj("modular-suite/props/messy_apartment/apt_toilet_wc_stall.png", 46.95, 1.25, 0.92, 1.1, FACE_S, { z: 58 });
  fb.obj("modular-suite/props/bedroom_home/home_washstand_basin.png", 46.3, 2.08, 0.72, 0.56, FACE_N, { z: 58 });

  // Wall-mounted Berlin Jugendstil Gaslight Sconce anchored flush on the open north masonry hallway wall (all 4 floors!)
  fb.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 40.35, 5.44, 0.56, 0.56, FACE_S, {
    z: 76,
    shadow: false,
  });
  fb.light(`Apt ${floorNum}F Hallway Gaslight`, 40.35, 5.75, 4.8, "#FFBE6B", 0.8, { flicker: true });
}

/** Populate all 4 floors (15 distinct gloriously messy apartment units + 1F lobby & rear trash alley!) */
export function buildMessyApartmentBuilding(
  doc: DcMapDocument,
  f1: IceCreamBuildBundle,
  f2: IceCreamBuildBundle,
  f3: IceCreamBuildBundle,
  f4: IceCreamBuildBundle,
): { aptPoly: Point2D[] } {
  const groundTerrainLayer = doc.layers.find((l) => l.id === "layer-dd-terrain-1")!;
  const groundWallsLayer = doc.layers.find((l) => l.id === "layer-dd-walls-1")!;

  // Clip the original 1F floor shape `dd-shape-floor-1-15` cleanly to x <= 47.85 and remove plain `dd-wall-1-28`
  const baseFloor = groundTerrainLayer.terrainStrokes!.find((s) => s.id === "dd-shape-floor-1-15");
  if (baseFloor) {
    baseFloor.points = structuredClone(APT_POLY);
  }
  const oldWallIdx = groundWallsLayer.walls!.findIndex((w) => w.id === "dd-wall-1-28");
  if (oldWallIdx >= 0) {
    groundWallsLayer.walls!.splice(oldWallIdx, 1);
  }

  // =========================================================================
  // FLOOR 1 (0ft) — MAILROOM LOBBY, REAR TRASH ALLEY + UNITS 1A, 1B, 1C
  // =========================================================================
  const a1 = makeAptFloorBuilder("1f");
  buildFloorArchitecture(a1, 1);

  // 1F Lobby & Mailboxes (x: 38.1..42.4, y: 8.2..10.9)
  a1.obj("modular-suite/props/post_office/po_mail_pigeonholes.png", 38.62, 9.55, 0.82, 1.55, FACE_E, { z: 62 });
  a1.obj("modular-suite/props/post_office/po_brown_parcel.png", 39.15, 9.85, 0.62, 0.56, 0.35, { z: 64 });
  a1.obj("modular-suite/props/post_office/po_tied_letter_stack.png", 39.2, 9.15, 0.45, 0.42, -0.4, { z: 64 });
  a1.obj("modular-suite/props/bedroom_home/home_woven_doormat.png", 40.2, 10.45, 1.1, 0.68, FACE_N, { z: 42, shadow: false });
  a1.obj("modular-suite/props/tavern_clutter/tav_mop_water_bucket.png", 41.78, 10.22, 0.68, 0.68, 0.4, { z: 62 });
  a1.obj("modular-suite/props/tavern_clutter/tav_straw_broom.png", 41.95, 8.95, 0.38, 1.1, -0.22, { z: 62 });
  a1.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 39.65, 8.65, 1.05, 0.92, 0.2, { z: 46, shadow: false });

  // 1F SE REAR ALLEY TRASH YARD (outside back door: x: 43.0..47.4, y: 7.4..10.5)
  a1.obj("objects/street_refuse_barrels.png", 43.65, 7.65, 1.35, 1.05, 0.15, { z: 62 });
  a1.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 45.15, 7.62, 0.92, 0.92, -0.3, { z: 64 });
  a1.obj("modular-suite/props/sewers_alleys/sew_burlap_trash_sack.png", 46.2, 7.75, 0.85, 0.85, 0.5, { z: 62 });
  a1.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 44.3, 8.65, 0.95, 0.85, 0.2, { z: 48, shadow: false });
  a1.obj("modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png", 45.8, 9.25, 1.45, 1.05, -0.15, { z: 38, shadow: false });
  a1.obj("modular-suite/props/sewers_alleys/sew_broken_crate_debris.png", 43.55, 10.15, 1.1, 0.95, 0.4, { z: 54 });
  a1.obj("modular-suite/props/harmony_lighting/lgt_street_aether_cyan_post.png", 46.85, 8.2, 0.84, 0.84, 0, { z: 76 });

  // UNIT 1A (SW — "The Sleepless Tram Conductor": x: 30.6..37.9, y: 6.6..10.9)
  a1.obj("objects/threadbare_rug.png", 34.4, 9.0, 2.35, 1.75, 0.08, { z: 38, shadow: false });
  a1.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 31.65, 9.55, 1.35, 1.82, FACE_E, { z: 60 });
  a1.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 33.15, 10.18, 1.12, 0.98, 0.35, { z: 62 });
  a1.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 34.55, 9.05, 1.38, 0.88, -0.1, { z: 62 });
  a1.obj("modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png", 34.45, 9.02, 0.44, 0.44, 0, { z: 68, shadow: false });
  a1.obj("core-fantasy/colorable/velvet_sofa_colorable.png", 34.55, 7.65, 1.85, 0.92, FACE_S, { z: 60, recolor: FADED_RUST });
  a1.obj("modular-suite/props/harmony_lighting/lgt_floor_parlor_pleated_cream.png", 33.32, 7.95, 0.76, 0.76, 0, { z: 66 });
  a1.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 36.85, 10.22, 1.55, 0.86, FACE_N, { z: 62 });
  a1.obj("objects/potbelly_cast_stove.png", 37.25, 8.75, 0.88, 0.88, 0, { z: 62 });
  a1.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 35.65, 10.35, 0.76, 0.76, 0.2, { z: 63 });
  a1.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 33.35, 7.55, 1.05, 0.92, -0.3, { z: 46, shadow: false });
  a1.obj("modular-suite/props/tavern_clutter/tav_spilled_ale_mug.png", 35.4, 9.45, 0.55, 0.52, 0.6, { z: 64, shadow: false });
  a1.obj("modular-suite/props/blacksmith/bs_open_toolbox.png", 36.3, 7.3, 0.85, 0.68, 0.25, { z: 60 });
  a1.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 33.15, 6.95, 1.15, 0.72, FACE_S, { z: 62 });
  a1.obj("modular-suite/props/school_courtroom/sch_coat_rack_stand.png", 37.35, 6.95, 0.68, 0.68, 0.2, { z: 64 });
  a1.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 36.15, 8.75, 0.88, 0.78, -0.3, { z: 52, shadow: false });

  // UNIT 1B (NW — "The Packrat Junk-Peddler / Hoarder": x: 34.1..41.1, y: 0.6..6.4)
  a1.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 38.45, 1.65, 1.28, 1.72, FACE_S, { z: 60 });
  a1.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 40.15, 1.65, 1.35, 1.18, 0.2, { z: 64 });
  a1.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 35.25, 4.1, 1.35, 1.18, -0.3, { z: 64 });
  a1.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 36.55, 5.55, 1.25, 1.1, 0.45, { z: 64 });
  a1.obj("modular-suite/props/sewers_alleys/sew_burlap_trash_sack.png", 34.85, 5.65, 0.82, 0.82, 0.2, { z: 62 });
  a1.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 37.8, 3.85, 1.25, 1.1, 0.15, { z: 46, shadow: false });
  a1.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 39.95, 3.25, 1.08, 0.94, -0.4, { z: 62 });
  a1.obj("objects/worn_dining_table.png", 36.65, 3.8, 1.32, 0.95, 0.12, { z: 58 });
  a1.obj("modular-suite/props/school_courtroom/sch_brass_wall_clock.png", 36.65, 3.8, 0.55, 0.55, 0.4, { z: 66, shadow: false });
  a1.obj("objects/luggage_trunk_stack.png", 38.9, 4.35, 1.15, 0.88, -0.18, { z: 62 });
  a1.obj("objects/wooden_wardrobe_shelf.png", 39.85, 0.95, 1.35, 0.65, FACE_S, { z: 60 });
  a1.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 37.9, 2.85, 0.88, 0.78, 0.5, { z: 50, shadow: false });
  a1.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 40.35, 4.55, 0.75, 0.75, 0, { z: 64 });
  a1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 37.8, 3.6, 1.0, 1.0, 0, {
    z: 90,
    opacity: 0.88,
    shadow: false,
  });
  a1.obj("modular-suite/modular/dec_cobweb_span.png", 37.55, 0.95, 0.95, 0.95, 0, { z: 75, shadow: false, opacity: 0.72 });

  // UNIT 1C (East — "The Struggling Baker & Late-Night Card Sharks": x: 41.3..47.8, y: 0.6..6.9)
  a1.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 44.3, 4.9, 2.8, 2.0, 0.05, { z: 38, shadow: false, recolor: MUSTARD_GOLD });
  a1.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 42.65, 1.75, 1.4, 1.88, FACE_S, { z: 60 });
  a1.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 44.85, 1.15, 1.2, 0.78, FACE_S, { z: 62 });
  a1.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 44.55, 2.55, 1.08, 0.94, 0.3, { z: 62 });
  a1.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 42.45, 5.95, 1.15, 1.0, -0.35, { z: 46, shadow: false });
  a1.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", 42.75, 3.7, 1.48, 0.9, 0.15, { z: 64 });
  // Card-shark kitchen table buried in playing cards, dice, spilled ale & empty wine bottles!
  a1.obj("modular-suite/modular/bare_oak_banquet_table.png", 44.35, 4.95, 1.85, 1.05, -0.06, { z: 58 });
  a1.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 43.75, 4.18, 0.65, 0.65, 0.25, { z: 55 });
  a1.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 44.95, 4.15, 0.65, 0.65, -0.3, { z: 55 });
  a1.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 44.15, 5.75, 0.65, 0.65, Math.PI + 0.35, { z: 55 });
  a1.obj("modular-suite/props/tavern_clutter/tav_playing_cards.png", 44.2, 4.88, 0.55, 0.45, 0.3, { z: 66, shadow: false });
  a1.obj("modular-suite/props/tavern_clutter/tav_leather_dice_cup.png", 44.8, 5.05, 0.45, 0.45, -0.4, { z: 66, shadow: false });
  a1.obj("modular-suite/props/tavern_clutter/tav_wine_bottle_goblet.png", 43.75, 5.1, 0.48, 0.48, 0.2, { z: 66, shadow: false });
  a1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_billiard_green_pendant.png", 44.35, 4.95, 1.12, 1.12, 0, {
    z: 90,
    opacity: 0.88,
    shadow: false,
  });
  a1.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 45.65, 5.85, 0.95, 0.85, -0.25, { z: 52, shadow: false });
  a1.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 46.85, 4.15, 1.55, 0.88, FACE_W, { z: 62 });
  a1.obj("modular-suite/props/kitchen/kit_iron_cookstove.png", 46.85, 5.75, 1.15, 0.98, FACE_W, { z: 62 });
  a1.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 46.05, 6.35, 0.78, 0.78, 0.1, { z: 64 });
  a1.obj("modular-suite/props/bakery/bak_flour_sack.png", 46.8, 3.05, 0.75, 0.75, 0.3, { z: 62 });

  a1.light("Apt 1A Gas Lamp", 34.4, 8.9, 5.4, "#FFB85C", 0.9);
  a1.light("Apt 1B Cluttered Bulb", 37.8, 3.6, 5.0, "#FFA94D", 0.82);
  a1.light("Apt 1C Card Table Lamp", 44.4, 4.9, 6.0, "#FFC26B", 0.95);
  a1.light("1F Rear Alley Streetlamp", 46.2, 8.5, 5.2, "#38BDF8", 0.82, { flicker: false });

  a1.note(
    "NOTE",
    45.2,
    9.4,
    "1F · 42 Eisenbahnstraße Apartments",
    "Gritty 4-story Berlin magipunk tenement. 1F holds the cluttered mailroom lobby, overflowing rear trash alley, and 3 messy ground flats: 1A Sleepless Tram Conductor, 1B Packrat Hoarder, and 1C Card-Shark Baker.",
    "#F59E0B",
  );

  // =========================================================================
  // FLOOR 2 (+14ft) — UNITS 2A, 2B, 2C, 2D
  // =========================================================================
  const a2 = makeAptFloorBuilder("2f");
  buildFloorArchitecture(a2, 2);

  // UNIT 2A (SW — "The Chaotic Magipunk Tinkerer": x: 30.6..37.9, y: 6.6..10.9)
  a2.obj("objects/tool_workbench.png", 35.85, 7.28, 2.05, 1.02, FACE_S, { z: 62 });
  a2.obj("modular-suite/props/harmony_lighting/lgt_table_articulated_brass_lamp.png", 35.2, 7.28, 0.48, 0.48, FACE_S, { z: 68, shadow: false });
  a2.obj("modular-suite/props/harmony_lighting/lgt_table_aether_cyan_desk.png", 36.4, 7.24, 0.46, 0.46, 0, { z: 68, shadow: false });
  a2.obj("modular-suite/props/messy_apartment/apt_tangled_aether_wires.png", 35.55, 8.85, 1.55, 1.45, 0.35, { z: 54, shadow: false });
  a2.obj("modular-suite/props/messy_apartment/apt_tangled_aether_wires.png", 33.85, 7.65, 1.25, 1.18, -0.7, { z: 54, shadow: false });
  a2.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 31.65, 9.6, 1.32, 1.78, FACE_E, { z: 60 });
  a2.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 33.95, 9.65, 1.32, 0.84, 0.14, { z: 62 });
  a2.obj("modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png", 33.78, 9.6, 0.44, 0.44, 0, { z: 68, shadow: false });
  a2.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 36.85, 10.22, 1.52, 0.85, FACE_N, { z: 62 });
  a2.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 35.55, 10.3, 0.78, 0.78, -0.4, { z: 64 });
  a2.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 32.85, 8.45, 1.05, 0.92, 0.5, { z: 62 });
  a2.obj("modular-suite/props/blacksmith/bs_open_toolbox.png", 36.85, 8.65, 0.85, 0.68, -0.4, { z: 62 });
  a2.obj("objects/slum_scrap_crates.png", 33.15, 7.05, 1.15, 0.82, 0.1, { z: 62 });
  a2.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 34.45, 8.35, 1.05, 0.92, -0.25, { z: 46, shadow: false });
  a2.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 35.85, 8.2, 0.62, 0.62, Math.PI + 0.35, { z: 58 });

  // UNIT 2B (NW — "The Starving Bohemian Painter & Violinist": x: 34.1..41.1, y: 0.6..6.4)
  a2.obj("core-fantasy/colorable/woven_oval_rug_colorable.png", 36.4, 4.85, 2.25, 1.6, -0.15, { z: 38, shadow: false, recolor: DUSTY_TEAL });
  a2.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 38.65, 1.75, 1.38, 1.82, FACE_S, { z: 60 });
  a2.obj("modular-suite/props/music_theater_tea/mus_violin_bow.png", 38.8, 1.95, 0.85, 0.45, 0.55, { z: 68, shadow: false });
  a2.obj("modular-suite/props/music_theater_tea/mus_artist_palette.png", 35.45, 4.35, 0.68, 0.68, 0.4, { z: 64 });
  a2.obj("modular-suite/props/music_theater_tea/mus_artist_palette.png", 36.85, 5.55, 0.65, 0.65, -0.8, { z: 64 });
  a2.obj("modular-suite/props/sewers_alleys/sew_scaffold_planks.png", 35.4, 3.65, 1.55, 0.82, 0.1, { z: 58 }); // paint-splattered drop boards!
  a2.obj("modular-suite/props/harmony_lighting/lgt_floor_industrial_arc_lamp.png", 36.75, 4.25, 0.82, 0.82, 0.35, { z: 66 });
  a2.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 40.15, 2.15, 1.05, 0.92, 0.6, { z: 62 });
  a2.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 40.05, 4.55, 1.48, 0.82, FACE_N, { z: 62 });
  a2.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 37.55, 4.45, 0.92, 0.82, 0.3, { z: 52, shadow: false });
  a2.obj("modular-suite/props/school_courtroom/sch_leather_armchair.png", 35.15, 5.65, 0.95, 0.9, -0.5, { z: 60 });
  a2.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 38.55, 3.55, 1.25, 0.8, -0.15, { z: 60 });
  a2.obj("modular-suite/props/school_courtroom/sch_framed_world_map.png", 40.15, 3.4, 1.05, 0.82, 0.35, { z: 58 });
  a2.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 38.15, 4.55, 0.72, 0.72, 0.2, { z: 64 });
  a2.obj("modular-suite/props/tavern_clutter/tav_spilled_ale_mug.png", 36.4, 4.85, 0.52, 0.5, 0.4, { z: 64, shadow: false });

  // UNIT 2C (East — "Exhausted Young Couple with Toddlers & 2 Cats": x: 41.3..47.8, y: 0.6..6.9)
  a2.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 42.85, 1.75, 1.58, 1.92, FACE_S, { z: 60 });
  a2.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 42.95, 1.95, 0.62, 0.62, 0.4, { z: 68 });
  a2.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 44.85, 0.95, 1.2, 0.72, FACE_S, { z: 62 });
  a2.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 44.95, 2.35, 1.08, 0.95, -0.25, { z: 46, shadow: false });
  a2.obj("modular-suite/props/ice_cream_train/ic_kids_bunk_bed_train.png", 43.35, 4.15, 2.15, 1.55, FACE_E, { z: 60 });
  a2.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", 45.45, 3.45, 1.55, 0.92, -0.18, { z: 64 });
  a2.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 42.45, 5.95, 1.18, 1.02, 0.25, { z: 62 });
  a2.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 46.85, 4.35, 1.55, 0.88, FACE_W, { z: 62 });
  a2.obj("modular-suite/props/kitchen/kit_iron_cookstove.png", 46.85, 5.85, 1.15, 0.95, FACE_W, { z: 62 });
  a2.obj("modular-suite/props/kitchen/kit_copper_stockpot.png", 46.8, 5.8, 0.45, 0.45, 0, { z: 68, shadow: false });
  a2.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 44.65, 5.85, 1.38, 0.88, 0.08, { z: 62 });
  a2.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_rose_lamp.png", 44.55, 5.8, 0.44, 0.44, 0, { z: 68, shadow: false });
  a2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_parlor_pleated_pendant.png", 44.5, 4.6, 1.06, 1.06, 0, {
    z: 90,
    opacity: 0.88,
    shadow: false,
  });
  a2.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 45.9, 6.25, 0.78, 0.72, 0.3, { z: 64 });
  a2.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 45.15, 1.55, 0.62, 0.62, -1.1, { z: 64 });

  // UNIT 2D (South Micro-Studio — "Night-Shift Printer's Apprentice": x: 38.1..42.4, y: 8.3..10.9)
  a2.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 41.35, 9.55, 1.22, 1.68, FACE_S, { z: 60 });
  a2.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 39.85, 9.85, 1.25, 1.08, 0.25, { z: 48, shadow: false });
  a2.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 39.25, 9.0, 1.1, 0.95, -0.45, { z: 48, shadow: false });
  a2.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 38.95, 10.15, 1.22, 0.78, 0.1, { z: 62 });
  a2.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", 38.95, 10.12, 0.44, 0.44, FACE_N, { z: 68, shadow: false });
  a2.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 40.35, 8.8, 0.72, 0.72, 0.3, { z: 64 });

  a2.light("Apt 2A Aether Tinkerer Lamp", 36.2, 7.5, 5.5, "#38BDF8", 1.05, { flicker: false });
  a2.light("Apt 2A Warm Oil Lamp", 33.8, 9.6, 4.2, "#FFC26B", 0.75);
  a2.light("Apt 2B Painter Studio Arc Lamp", 36.75, 4.25, 5.2, "#FFC26B", 0.88);
  a2.light("Apt 2C Family Nursery Pendant", 44.5, 4.6, 6.2, "#FFD280", 0.95);
  a2.light("Apt 2D Printer Desk Lamp", 39.0, 10.1, 4.2, "#FFB347", 0.82);

  a2.note(
    "NOTE",
    45.2,
    9.4,
    "2F · Tenement Units 2A–2D",
    "2A Chaotic Magipunk Tinkerer (tangled glowing aether wires & workbench), 2B Bohemian Painter & Violinist, 2C Exhausted Young Parents (drying rack, laundry pile & 2 sleeping cats), 2D Night-Shift Printer's newspaper-buried studio.",
    "#38BDF8",
  );

  // =========================================================================
  // FLOOR 3 (+28ft) — UNITS 3A, 3B, 3C, 3D
  // =========================================================================
  const a3 = makeAptFloorBuilder("3f");
  buildFloorArchitecture(a3, 3);

  // UNIT 3A (SW — "The Bootleg Aether-Alchemist": x: 30.6..37.9, y: 6.6..10.9)
  a3.obj("objects/alchemy_worktable.png", 35.75, 7.35, 2.0, 1.05, FACE_S, { z: 62 });
  a3.obj("modular-suite/props/harmony_lighting/lgt_table_apothecaries_spirit_lamp.png", 35.12, 7.35, 0.44, 0.44, 0, {
    z: 68,
    shadow: false,
  });
  a3.obj("modular-suite/props/library_alchemy/arc_alembic_still.png", 35.65, 7.3, 0.72, 0.72, 0.2, { z: 68, shadow: false });
  a3.obj("modular-suite/props/library_alchemy/arc_potion_trio.png", 36.4, 7.35, 0.58, 0.58, -0.3, { z: 68, shadow: false });
  a3.obj("modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png", 34.45, 8.85, 1.5, 1.08, 0.2, { z: 42, shadow: false });
  a3.obj("modular-suite/props/messy_apartment/apt_tangled_aether_wires.png", 35.55, 9.15, 1.35, 1.25, -0.3, { z: 54, shadow: false });
  a3.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 31.65, 9.55, 1.35, 1.82, FACE_E, { z: 60 });
  a3.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 32.68, 9.55, 0.56, 0.56, FACE_E, { z: 58 });
  a3.obj("modular-suite/props/harmony_lighting/lgt_table_tavern_wine_bottle_candle.png", 32.68, 9.55, 0.42, 0.42, 0.4, {
    z: 66,
    shadow: false,
  });
  a3.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 36.85, 10.22, 1.52, 0.85, FACE_N, { z: 62 });
  a3.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 33.4, 10.35, 0.78, 0.78, 0.5, { z: 64 });
  a3.obj("modular-suite/props/doctor_apothecary/doc_specimen_jar.png", 33.6, 7.3, 0.45, 0.52, 0, { z: 65 });
  a3.obj("modular-suite/props/library_alchemy/arc_glowing_mortar.png", 34.25, 10.1, 0.62, 0.62, 0.3, { z: 64 });
  a3.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 32.85, 8.55, 1.05, 0.92, -0.35, { z: 62 });
  a3.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 37.05, 8.65, 1.15, 1.0, 0.15, { z: 62 });
  a3.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 35.3, 10.25, 0.88, 0.78, 0.4, { z: 52, shadow: false });

  // UNIT 3B (NW — "The Conspiracy Journalist / Red-String Detective": x: 34.1..41.1, y: 0.6..6.4)
  a3.obj("core-fantasy/hero/hero_scholar_desk.png", 35.55, 3.85, 1.65, 1.15, FACE_S, { z: 60 });
  a3.obj("modular-suite/props/post_office/po_green_banker_lamp.png", 35.95, 3.65, 0.52, 0.52, 0.2, { z: 68, shadow: false });
  a3.obj("modular-suite/props/school_courtroom/sch_framed_world_map.png", 36.75, 5.45, 1.25, 0.92, -0.15, { z: 56 });
  a3.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 35.5, 5.4, 1.28, 1.12, 0.3, { z: 48, shadow: false });
  a3.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 37.95, 3.65, 1.28, 1.12, -0.35, { z: 48, shadow: false });
  a3.obj("modular-suite/props/school_courtroom/sch_legal_ledger_stack.png", 37.25, 3.45, 0.68, 0.68, 0.4, { z: 64 });
  a3.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 38.65, 1.7, 1.32, 1.75, FACE_S, { z: 60 });
  a3.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 40.25, 1.7, 1.25, 1.1, -0.2, { z: 62 });
  a3.obj("modular-suite/props/school_courtroom/sch_card_catalog.png", 40.35, 3.05, 1.15, 0.78, FACE_W, { z: 62 });
  a3.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 38.95, 2.95, 1.02, 0.9, 0.35, { z: 60 });
  a3.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 39.85, 4.25, 1.28, 0.82, 0.12, { z: 62 });
  a3.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 34.7, 5.85, 0.74, 0.74, 0.2, { z: 64 });

  // UNIT 3C (East — "Retired Opera Singer & Her Three Cats": x: 41.3..47.8, y: 0.6..6.9)
  a3.obj("core-fantasy/hero/hero_noble_carpet.png", 44.3, 4.85, 2.85, 1.95, 0.04, { z: 38, shadow: false });
  a3.obj("core-fantasy/colorable/inn_double_bed_colorable.png", 42.75, 1.75, 1.55, 1.85, FACE_S, { z: 60, recolor: WORN_PLUM });
  a3.obj("modular-suite/props/bedroom_home/home_patchwork_quilts.png", 43.1, 2.25, 0.75, 0.68, 0.4, { z: 66 });
  a3.obj("modular-suite/props/bedroom_home/home_vanity_mirror_brush.png", 44.85, 1.15, 1.15, 0.82, FACE_S, { z: 62 });
  a3.obj("modular-suite/props/music_theater_tea/mus_velvet_curtain.png", 44.85, 2.55, 1.05, 0.88, 0.3, { z: 60 });
  a3.obj("modular-suite/props/music_theater_tea/mus_feathered_mask.png", 45.0, 1.25, 0.48, 0.42, -0.4, { z: 68, shadow: false });
  a3.obj("core-fantasy/hero/hero_velvet_sofa.png", 44.1, 3.85, 1.95, 1.05, FACE_S, { z: 60 });
  a3.obj("modular-suite/props/harmony_lighting/lgt_floor_tiffany_stained_lamp.png", 45.32, 3.85, 0.82, 0.82, 0, { z: 66 });
  a3.obj("modular-suite/props/harmony_lighting/lgt_ceiling_tiffany_stained_pendant.png", 44.2, 4.6, 1.12, 1.12, 0, {
    z: 90,
    opacity: 0.88,
    shadow: false,
  });
  a3.obj("modular-suite/props/music_theater_tea/mus_mahogany_harp.png", 42.15, 4.85, 0.95, 0.95, 0.35, { z: 64 });
  a3.obj("modular-suite/props/music_theater_tea/mus_brass_gramophone.png", 42.3, 3.45, 0.78, 0.78, -0.2, { z: 64 });
  a3.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 44.2, 5.25, 1.38, 0.88, -0.08, { z: 62 });
  a3.obj("modular-suite/props/music_theater_tea/tea_pastry_stand.png", 44.15, 5.2, 0.52, 0.52, 0, { z: 68, shadow: false });
  a3.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 42.45, 6.15, 1.15, 0.98, 0.2, { z: 62 });
  a3.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 46.85, 4.45, 1.52, 0.85, FACE_W, { z: 62 });
  a3.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", 46.25, 6.15, 1.45, 0.86, 0.1, { z: 64 });
  // Three sleeping cats!!
  a3.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 44.3, 3.9, 0.58, 0.58, 0.5, { z: 68 });
  a3.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 42.5, 1.65, 0.58, 0.58, -0.7, { z: 68 });
  a3.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 45.25, 5.85, 0.58, 0.58, 1.2, { z: 66 });

  // UNIT 3D (South Micro-Studio — "Freshly Moved-In Courier": x: 38.1..42.4, y: 8.3..10.9)
  a3.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 41.35, 9.55, 1.22, 1.68, FACE_S, { z: 60 });
  a3.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 39.15, 9.95, 1.38, 1.2, 0.18, { z: 64 });
  a3.obj("modular-suite/props/harmony_lighting/lgt_lantern_railroad_brass.png", 39.32, 9.85, 0.44, 0.44, 0, {
    z: 68,
    shadow: false,
  });
  a3.obj("modular-suite/props/post_office/po_leather_mail_satchel.png", 40.35, 8.95, 0.65, 0.58, -0.5, { z: 64 });
  a3.obj("modular-suite/props/post_office/po_brown_parcel.png", 38.75, 8.85, 0.62, 0.56, 0.3, { z: 64 });
  a3.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 40.35, 10.35, 0.72, 0.72, 0, { z: 64 });

  a3.light("Apt 3A Alchemy Spirit Lamp", 35.15, 7.35, 5.5, "#34D399", 1.05, { flicker: false });
  a3.light("Apt 3A Warm Bedside Bottle Candle", 32.68, 9.55, 4.2, "#FFB85C", 0.78);
  a3.light("Apt 3B Journalist Green Banker Lamp", 35.95, 3.65, 5.2, "#A3E635", 0.85, { flicker: false });
  a3.light("Apt 3C Opera Parlor Tiffany Pendant", 44.2, 4.6, 6.2, "#FFB86B", 0.95);
  a3.light("Apt 3D Courier Railroad Lantern", 39.32, 9.85, 4.2, "#FFD08A", 0.82);

  a3.note(
    "SECRET",
    45.2,
    9.4,
    "3F · Tenement Units 3A–3D",
    "3A Bootleg Aether-Alchemist (bubbling alembic & oil-stained lab flat), 3B Conspiracy Journalist (maps & newspapers wall-to-wall), 3C Retired Opera Singer & her 3 sleeping cats, 3D Freshly Moved-In Courier still drowning in taped moving boxes.",
    "#34D399",
  );

  // =========================================================================
  // FLOOR 4 (+42ft) — TOP-FLOOR UNITS 4A, 4B, 4C, 4D
  // =========================================================================
  const a4 = makeAptFloorBuilder("4f");
  buildFloorArchitecture(a4, 4);

  // UNIT 4A (SW — "The Underground Smuggler & Fence": x: 30.6..37.9, y: 6.6..10.9)
  a4.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 31.65, 9.55, 1.35, 1.82, FACE_E, { z: 60 });
  a4.obj("core-fantasy/hero/hero_open_treasure_chest.png", 33.45, 7.45, 1.15, 0.95, 0.2, { z: 64 });
  a4.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 35.25, 7.45, 1.35, 1.18, -0.15, { z: 64 });
  a4.obj("modular-suite/props/post_office/po_iron_strongbox.png", 36.75, 7.25, 0.78, 0.58, 0.3, { z: 64 });
  a4.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 34.45, 9.35, 1.38, 0.88, -0.12, { z: 62 });
  a4.obj("modular-suite/props/harmony_lighting/lgt_lantern_hooded_iron.png", 34.45, 9.32, 0.46, 0.46, 0.6, {
    z: 68,
    shadow: false,
  });
  a4.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 33.25, 9.95, 0.92, 0.82, 0.4, { z: 54, shadow: false });
  a4.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 36.85, 10.22, 1.52, 0.85, FACE_N, { z: 62 });
  a4.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 35.55, 10.35, 0.76, 0.76, 0.3, { z: 64 });
  a4.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 32.85, 8.65, 1.02, 0.9, 0.4, { z: 62 });
  a4.obj("core-fantasy/objects/ale_barrel.png", 36.75, 8.55, 0.8, 0.8, 0, { z: 62 });
  a4.obj("modular-suite/props/tavern_clutter/tav_spilled_ale_mug.png", 34.4, 8.55, 0.52, 0.5, -0.4, { z: 62, shadow: false });
  a4.obj("modular-suite/modular/dec_cobweb_span.png", 30.95, 10.45, 0.95, 0.95, 0.8, { z: 75, shadow: false, opacity: 0.7 });

  // UNIT 4B (NW — "Burned-Out Arcane University Student": x: 34.1..41.1, y: 0.6..6.4)
  a4.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 38.65, 1.72, 1.35, 1.8, FACE_S, { z: 60 });
  a4.obj("core-fantasy/hero/hero_library_bookcase.png", 40.55, 1.85, 1.65, 0.78, FACE_W, { z: 62 });
  a4.obj("modular-suite/props/library_alchemy/arc_stacked_tomes.png", 39.45, 2.85, 0.72, 0.72, 0.2, { z: 64 });
  a4.obj("modular-suite/props/library_alchemy/arc_stacked_tomes.png", 38.45, 3.05, 0.68, 0.68, -0.5, { z: 64 });
  a4.obj("modular-suite/props/library_alchemy/arc_stacked_tomes.png", 35.15, 5.65, 0.72, 0.72, 0.4, { z: 64 });
  a4.obj("modular-suite/modular/bare_walnut_study_desk.png", 35.65, 3.65, 1.55, 0.92, FACE_S, { z: 60 });
  a4.obj("modular-suite/props/library_alchemy/arc_glowing_grimoire.png", 35.42, 3.65, 0.58, 0.44, 0.15, { z: 68, shadow: false });
  a4.obj("modular-suite/props/harmony_lighting/lgt_table_aether_violet_lamp.png", 36.12, 3.62, 0.46, 0.46, 0, {
    z: 68,
    shadow: false,
  });
  a4.obj("modular-suite/props/library_alchemy/arc_ribbon_scrolls.png", 36.75, 4.85, 0.62, 0.58, 0.6, { z: 62 });
  a4.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 37.65, 4.1, 1.25, 1.08, -0.25, { z: 48, shadow: false });
  a4.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 39.85, 4.05, 1.12, 0.98, 0.4, { z: 62 });
  a4.obj("modular-suite/props/messy_apartment/apt_messy_coffee_table.png", 35.55, 4.95, 1.25, 0.78, 0.1, { z: 62 });
  a4.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 34.7, 3.6, 0.72, 0.72, 0, { z: 64 });

  // UNIT 4C (East — "Eccentric Clockwork-Doll & Tailor Workshop Flat": x: 41.3..47.8, y: 0.6..6.9)
  a4.obj("core-fantasy/colorable/woven_oval_rug_colorable.png", 44.3, 4.8, 2.6, 1.9, -0.08, { z: 38, shadow: false, recolor: OLIVE_MOSS });
  a4.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 42.75, 1.75, 1.45, 1.88, FACE_S, { z: 60 });
  a4.obj("modular-suite/props/music_theater_tea/mus_velvet_curtain.png", 44.2, 1.25, 1.0, 0.85, -0.2, { z: 62 });
  a4.obj("modular-suite/props/blacksmith/bs_carpenter_workbench.png", 44.55, 3.95, 1.85, 0.95, 0.06, { z: 60 });
  a4.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 44.55, 4.1, 1.08, 1.08, 0, {
    z: 90,
    opacity: 0.88,
    shadow: false,
  });
  a4.obj("modular-suite/props/messy_apartment/apt_tangled_aether_wires.png", 44.45, 5.45, 1.48, 1.38, 0.45, { z: 54, shadow: false });
  a4.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", 42.65, 4.55, 1.48, 0.88, Math.PI / 2 - 0.12, { z: 64 });
  a4.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 42.75, 6.1, 1.12, 0.96, -0.3, { z: 62 });
  a4.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 45.85, 3.15, 1.1, 0.95, 0.25, { z: 48, shadow: false });
  a4.obj("modular-suite/props/messy_apartment/apt_dirty_dishes_sink.png", 46.85, 4.35, 1.52, 0.85, FACE_W, { z: 62 });
  a4.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 46.85, 5.85, 0.78, 0.78, 0.2, { z: 64 });
  a4.obj("modular-suite/props/bedroom_home/home_patchwork_quilts.png", 45.15, 1.25, 0.78, 0.72, 0.25, { z: 62 });
  a4.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 44.65, 2.45, 0.62, 0.62, 0.8, { z: 64 });

  // UNIT 4D (South Micro-Studio — "The Stargazing Rooftop Lookout": x: 38.1..42.4, y: 8.3..10.9)
  a4.obj("modular-suite/props/messy_apartment/apt_unmade_messy_bed.png", 41.35, 9.55, 1.22, 1.68, FACE_S, { z: 60 });
  a4.obj("modular-suite/props/library_alchemy/arc_brass_telescope.png", 39.75, 9.85, 1.05, 1.0, FACE_S + 0.15, { z: 66 });
  a4.obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 39.65, 9.0, 1.15, 1.0, 0.3, { z: 48, shadow: false });
  a4.obj("modular-suite/props/messy_apartment/apt_dirty_laundry_pile.png", 38.65, 9.0, 0.92, 0.82, -0.4, { z: 62 });
  a4.obj("modular-suite/props/messy_apartment/apt_overflowing_trash_bin.png", 38.75, 10.25, 0.7, 0.7, 0.1, { z: 64 });
  a4.obj("modular-suite/props/library_alchemy/arc_brass_astrolabe.png", 40.35, 10.2, 0.52, 0.52, 0.2, { z: 65 });
  a4.obj("modular-suite/props/harmony_lighting/lgt_floor_jugendstil_torchiere.png", 40.32, 8.92, 0.72, 0.72, 0, { z: 66 });

  a4.light("Apt 4A Smuggler Hooded Lantern", 34.45, 9.32, 5.2, "#FFA94D", 0.86);
  a4.light("Apt 4B Arcane Violet Desk Lamp", 36.12, 3.62, 5.2, "#A855F7", 0.92, { flicker: false });
  a4.light("Apt 4C Tailor Workshop Pendant", 44.55, 4.1, 6.2, "#FFCA7A", 0.94);
  a4.light("Apt 4D Stargazer Torchiere", 40.32, 8.92, 4.2, "#FFD68A", 0.82);

  a4.note(
    "AMBUSH",
    45.2,
    9.4,
    "4F · Top-Floor Units 4A–4D",
    "4A Smuggler's Fence (contraband chest, strongbox & bottles), 4B Burned-Out Arcane Student (glowing spellbook & book piles), 4C Clockwork Tailor Workshop (wires, quilts & drying rack), 4D Rooftop Lookout with brass telescope watching the Cathedral.",
    "#A855F7",
  );

  // Merge all 4 floors cleanly into the main map's 1F, 2F, 3F, and 4F bundles!
  const merge = (dst: IceCreamBuildBundle, src: IceCreamBuildBundle) => {
    dst.terrain.push(...src.terrain);
    dst.paths.push(...src.paths);
    dst.walls.push(...src.walls);
    dst.portals.push(...src.portals);
    dst.objects.push(...src.objects);
    dst.lights.push(...src.lights);
    dst.dmNotes.push(...src.dmNotes);
  };
  merge(f1, a1.b);
  merge(f2, a2.b);
  merge(f3, a3.b);
  merge(f4, a4.b);

  return { aptPoly: APT_POLY };
}

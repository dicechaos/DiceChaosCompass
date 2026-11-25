/**
 * Builds the 5-Story + Battlement Crown Dark-Magipunk District Watchtower
 * ("Wachturm Ost — Eastgate Aether-Watch Tower") directly onto the existing circular
 * stone tower (`dd-wall-1-30` / `dd-shape-floor-1-11`, centered at (34.75, 17.75), r = 2.75)
 * across 1F, 2F, 3F, 4F, 5F, and ROOF — seamlessly linked to the B1 Municipal Pump-House Shaft below!
 *
 * Vertical Floorplan (all stairs, speaking tubes & pump hatches vertically aligned!):
 *  - B1 (-14ft): Existing Municipal Brass Pump-House & Iron Shaft Ladder at (36.25, 17.75)
 *  - 1F (0ft):   Gatehouse Duty Room, Booking Desk, Holding Cell, Padlocked Pump Hatch (36.25, 17.75)
 *                & Fortified East Courtyard Guard Stoop + Curfew Notice Board
 *  - 2F (+14ft): Garrison Armory Cage, Aether-Carbine Rack, Armorer's Bench & Ready-Room Card Nook
 *  - 3F (+28ft): Lived-In Watchmen's Bunkhouse (3 radial cots), Shift-Change Mess & Boot Drying Bench
 *  - 4F (+42ft): Watch Captain's Command Office, Illuminated Tactical District Map Table & Aether-Telegraph
 *  - 5F (+56ft): Open-Air Crenelated Stone Battlement Crown, Swiveling Aether Searchlight Turret,
 *                District Alarm Bell, Brass Rangefinder, Sandbag Cover & Semaphore Signal Post
 *  - ROOF (+70ft): 12-Faceted Conical Prussian-Slate & Copper Watchtower Spire (replaces legacy square hip!)
 */

import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type LightNode,
  type ObjectStamp,
  type Point2D,
  type PortalNode,
  type RgbRecolor,
  type RoofStructure,
  type SplinePath,
  type TerrainStroke,
  type WallSegment,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

export const WT_CX = 34.75;
export const WT_CY = 17.75;
export const WT_RADIUS = 2.75;
export const WT_STAIR_X = 33.32;
export const WT_STAIR_Y = 17.75;
export const WT_STAIR_SIZE = 1.68;
export const WT_HATCH_X = 36.25;
export const WT_HATCH_Y = 17.75;

export function makeWatchtowerCircle(r = WT_RADIUS, segs = 32): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push({
      x: Math.round((WT_CX + Math.cos(a) * r) * 1000) / 1000,
      y: Math.round((WT_CY + Math.sin(a) * r) * 1000) / 1000,
    });
  }
  return out;
}

export const WATCHTOWER_POLY: Point2D[] = makeWatchtowerCircle(WT_RADIUS + 0.15, 32);

function tint(hex: string, mode: "dd_red" | "tint" = "dd_red", strength = 0.9): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode, tintHex: hex, strength };
}

const PRUSSIAN_NAVY = tint("#284574", "dd_red", 0.9);
const SOVEREIGN_CRIMSON = tint("#8E1B2E", "dd_red", 0.92);
const GARRISON_SLATE = tint("#364D6E", "dd_red", 0.88);

// Standard orthogonal sprite rotations (front = +Y at rot 0):
const FACE_S = 0;
const FACE_W = Math.PI / 2;
const FACE_N = Math.PI;
const FACE_E = -Math.PI / 2;

function makeWtFloorBuilder(tag: string) {
  let seq = 0;
  const uid = (p: string) => `wt-${tag}-${p}-${++seq}`;
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
    const t: TerrainStroke = {
      id: uid("flr"),
      assetId,
      shape: "polygon",
      points,
      radiusCells: 0,
      opacity,
      softness: 0,
      recolor,
    };
    b.terrain.push(t);
  };

  const wall = (
    assetId: string,
    points: Point2D[],
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean } = {},
  ): string => {
    const id = uid("wall");
    const w: WallSegment = {
      id,
      assetId,
      points,
      closed: Boolean(opts.closed),
      curved: false,
      thicknessCells: opts.thickness ?? 0.22,
      blocksLight: opts.blocksLight ?? true,
    };
    b.walls.push(w);
    return id;
  };

  const portal = (
    assetId: string,
    x: number,
    y: number,
    rotationRad: number,
    kind: PortalNode["kind"],
    widthCells: number,
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
      rotationRad,
      widthCells,
      closed,
      locked: false,
      blocksLightWhenClosed: kind !== "window",
    });
  };

  /** Places a door/window/arrow-slit flush on the circular tower rim at angle `deg` (0°=East, 90°=South, -90°=North). */
  const rimPortal = (
    assetId: string,
    deg: number,
    kind: PortalNode["kind"],
    widthCells: number,
    wallId?: string,
    closed = true,
    radius = WT_RADIUS,
  ) => {
    const rad = (deg * Math.PI) / 180;
    const x = WT_CX + Math.cos(rad) * radius;
    const y = WT_CY + Math.sin(rad) * radius;
    portal(assetId, x, y, rad + Math.PI / 2, kind, widthCells, closed, wallId);
  };

  const spline = (
    assetId: string,
    points: Point2D[],
    widthCells: number,
    opts: { curved?: boolean; opacity?: number } = {},
  ) => {
    const sp: SplinePath = {
      id: uid("pth"),
      assetId,
      points,
      widthCells,
      curved: opts.curved ?? true,
      taperEnds: false,
      fadeEnds: false,
      opacity: opts.opacity ?? 1,
      blocksScatter: false,
    };
    b.paths.push(sp);
  };

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
      zOrder: opts.z ?? 60,
    };
    b.objects.push(o);
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
    b.lights.push(ln);
  };

  const note = (
    badge: "TRAP" | "SECRET" | "HAZARD" | "AMBUSH" | "NOTE",
    x: number,
    y: number,
    title: string,
    body: string,
    colorHex: string,
  ) => {
    b.dmNotes.push({
      id: uid("note"),
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      title,
      body,
      badge,
      colorHex,
    });
  };

  return { b, floorPoly, wall, portal, rimPortal, spline, obj, light, note };
}

function mergeInto(target: IceCreamBuildBundle, src: IceCreamBuildBundle) {
  target.terrain.push(...src.terrain);
  target.paths.push(...src.paths);
  target.walls.push(...src.walls);
  target.portals.push(...src.portals);
  target.objects.push(...src.objects);
  target.lights.push(...src.lights);
  target.dmNotes.push(...src.dmNotes);
}

export function buildWatchtowerGarrison(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
  f2Out: IceCreamBuildBundle,
  f3Out: IceCreamBuildBundle,
  f4Out: IceCreamBuildBundle,
  f5Out: IceCreamBuildBundle,
): { watchtowerPoly: Point2D[] } {
  const groundTerrain = doc.layers.find((l) => l.id === "layer-dd-terrain-1");
  const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1");
  const roofLayer = doc.layers.find((l) => l.id === "layer-dd-roofs-0");

  // Upgrade 1F circular tower floor (`dd-shape-floor-1-11`) to fortified dark dungeon flagstone
  const towerFloor1F = groundTerrain?.terrainStrokes?.find((t) => t.id === "dd-shape-floor-1-11");
  if (towerFloor1F) {
    towerFloor1F.assetId = "core-fantasy/terrain/dungeon_flagstone.png";
  }

  // Upgrade 1F circular tower wall (`dd-wall-1-30`) to painterly Heavy Granite Fortress Masonry
  const towerWall1F = groundWalls?.walls?.find((w) => w.id === "dd-wall-1-30");
  if (towerWall1F) {
    towerWall1F.assetId = "modular-suite/walls/harmony/wall_granite_fortress_parapet.png";
    towerWall1F.thicknessCells = 0.22;
  }

  // Replace legacy square clay hip roof (`dd-roof-0-12`) with a 12-faceted Conical Prussian-Slate Watchtower Spire!
  if (roofLayer?.roofs) {
    const idx = roofLayer.roofs.findIndex((r) => r.id === "dd-roof-0-12");
    const spire: RoofStructure = {
      id: "wt-roof-watchtower-spire",
      style: "cone",
      assetId: "modular-suite/terrain/harmony/roof_prussian_fishscale_slate.png",
      points: [
        { x: WT_CX, y: WT_CY },
        { x: WT_CX + 3.08, y: WT_CY },
      ],
      widthCells: 6.16,
      coneFacets: 12,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.56,
      ridgeCapStyle: "copper",
      ridgeColorHex: "#488B7D",
      eaveTrim: true,
      eaveTrimHex: "#1B2634",
      dropShadow: 0.64,
      opacity: 1,
    };
    if (idx >= 0) {
      roofLayer.roofs[idx] = spire;
    } else {
      roofLayer.roofs.push(spire);
    }
  }

  const circleWallPts = makeWatchtowerCircle(WT_RADIUS, 32);
  const battlementWallPts = makeWatchtowerCircle(WT_RADIUS + 0.08, 32);

  // =========================================================================
  // 1F (0ft) — GATEHOUSE DUTY ROOM, BOOKING DESK, HOLDING CELL & GUARD STOOP
  // =========================================================================
  const f1 = makeWtFloorBuilder("1f");
  const w1Id = towerWall1F?.id ?? "dd-wall-1-30";

  // Fortified East main entrance + 4 beveled fortress arrow-slit embrasures (clear of N alley wall!)
  f1.rimPortal("modular-suite/portals/harmony/door_dungeon_oak_reinforced.png", 0, "door", 1.15, w1Id, true);
  for (const deg of [-52, -140, 140, 48]) {
    f1.rimPortal("modular-suite/portals/harmony/win_castle_murder_slit.png", deg, "window", 0.78, w1Id, true);
  }

  // South Arc Drunk-Tank Holding Cell (iron bars chord sealed cleanly wall-to-wall + barred prison gate)
  const wCell1 = f1.wall(
    "core-fantasy/walls/dungeon_iron_bars.png",
    [
      { x: 32.36, y: 19.05 },
      { x: 37.14, y: 19.05 },
    ],
    { thickness: 0.13, blocksLight: false },
  );
  f1.portal("core-fantasy/portals/prison_cell_gate.png", 35.15, 19.05, 0, "gate", 0.92, true, wCell1);

  // Vertically aligned West Spiral Staircase + Padlocked Iron Pump-Shaft Hatch aligned directly over B1!
  f1.obj("modular-suite/props/watchtower_garrison/wt_fortress_spiral_stair.png", WT_STAIR_X, WT_STAIR_Y, WT_STAIR_SIZE, WT_STAIR_SIZE, 0, { z: 54, shadow: false });
  f1.obj("modular-suite/props/watchtower_garrison/wt_iron_pump_hatch_padlocked.png", WT_HATCH_X, WT_HATCH_Y, 0.94, 0.94, 0, { z: 44, shadow: false });

  // Duty Sergeant's Booking Station (North-Center)
  f1.obj("modular-suite/props/watchtower_garrison/wt_duty_booking_desk.png", 35.12, 16.45, 1.44, 0.90, FACE_S, { z: 62 });
  f1.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 35.12, 15.72, 0.56, 0.59, FACE_S, { z: 58 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", 34.68, 16.24, 0.40, 0.40, 0, { z: 68, shadow: false });
  f1.obj("modular-suite/props/watchtower_garrison/wt_key_cabinet_wall.png", 36.32, 16.12, 0.72, 0.50, Math.PI / 4, { z: 66, shadow: false });
  f1.obj("modular-suite/props/watchtower_garrison/wt_speaking_tube_pipe.png", 33.86, 15.82, 0.56, 0.56, -Math.PI / 4, { z: 66, shadow: false });

  // Holding Cell Interior (South Arc)
  f1.obj("modular-suite/props/armory_dungeon/arm_prison_cot.png", 34.35, 19.68, 0.68, 1.12, FACE_E, { z: 58 });
  f1.obj("modular-suite/props/armory_dungeon/arm_rusty_bucket.png", 35.92, 19.56, 0.48, 0.44, 0.2, { z: 58 });
  f1.obj("modular-suite/props/armory_dungeon/arm_iron_shackles.png", 35.18, 19.95, 0.46, 0.46, 0.4, { z: 56, shadow: false });

  // Guardhouse Ceiling Pendant + Wall Torch Sconce
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_iron_dome_pendant.png", 35.02, 17.75, 0.88, 0.88, 0, { z: 90, opacity: 0.88, shadow: false });
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_iron.png", 36.92, 16.82, 0.50, 0.50, -2.4, { z: 76, shadow: false });

  // EXTERIOR FORTIFIED EAST COURTYARD GUARD STOOP & CHECKPOINT (clear of Coachhouse x>=39 & alley wall!)
  f1.obj("modular-suite/props/stairs_architectural/stair_berlin_stoop_stone.png", 37.98, 17.75, 1.06, 1.06, FACE_E, { z: 46, shadow: false });
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_alley_gas_bracket.png", 37.55, 16.88, 0.54, 0.54, FACE_E, { z: 76, shadow: false });
  f1.obj("modular-suite/props/watchtower_garrison/wt_wanted_curfew_board.png", 39.85, 17.28, 1.12, 0.64, FACE_S, { z: 66 });
  f1.obj("modular-suite/props/armory_dungeon/arm_spiked_barricade.png", 38.75, 19.22, 1.08, 0.95, -0.35, { z: 62 });
  f1.obj("modular-suite/props/armory_dungeon/arm_halberd_spear.png", 37.72, 18.72, 0.46, 0.88, 0.45, { z: 62 });

  f1.light("1F Wachturm Guardhouse Pendant", 35.02, 17.75, 5.4, "#FFB85C", 0.9, { flicker: true });
  f1.light("1F Watchtower Entry Gaslight", 37.95, 17.05, 5.6, "#FFCA7A", 0.92, { flicker: true });
  f1.note(
    "SECRET",
    36.25,
    17.75,
    "1F · Wachturm Ost Gatehouse & Pump Hatch",
    "Eastgate Aether-Watch Tower duty room & holding cell. Beneath the sergeant's padlocked iron hatch (DC 16 Thieves' Tools or key from the NE wall cabinet) an iron ladder drops straight into the B1 Municipal Pump-House, B2 Sewer Cistern, and B3 Crystal Lake!",
    "#38BDF8",
  );

  // =========================================================================
  // 2F (+14ft) — GARRISON ARMORY, MUNITIONS LOCKER & WATCHMEN'S READY ROOM
  // =========================================================================
  const f2 = makeWtFloorBuilder("2f");
  f2.floorPoly("modular-suite/terrain/harmony/flr_weathered_attic_planks.png", circleWallPts);
  const w2Outer = f2.wall("modular-suite/walls/harmony/wall_granite_fortress_parapet.png", circleWallPts, {
    closed: true,
    thickness: 0.22,
  });
  for (const deg of [-90, -28, 32, 92, 142]) {
    f2.rimPortal("modular-suite/portals/harmony/win_castle_murder_slit.png", deg, "window", 0.78, w2Outer, true);
  }

  // North Armory Security Cage (sealed cleanly wall-to-wall!)
  const w2Cage = f2.wall(
    "core-fantasy/walls/dungeon_iron_bars.png",
    [
      { x: 32.18, y: 16.78 },
      { x: 37.32, y: 16.78 },
    ],
    { thickness: 0.12, blocksLight: false },
  );
  f2.portal("core-fantasy/portals/prison_cell_gate.png", 35.25, 16.78, 0, "gate", 0.92, true, w2Cage);

  // West Spiral Staircase (exact shaft alignment!)
  f2.obj("modular-suite/props/watchtower_garrison/wt_fortress_spiral_stair.png", WT_STAIR_X, WT_STAIR_Y, WT_STAIR_SIZE, WT_STAIR_SIZE, 0, { z: 54, shadow: false });

  // Inside Armory Cage (North Arc)
  f2.obj("modular-suite/props/watchtower_garrison/wt_garrison_armory_rack.png", 34.92, 15.65, 1.44, 0.81, FACE_S, { z: 62 });
  f2.obj("modular-suite/props/watchtower_garrison/wt_sentry_gear_stand.png", 36.22, 16.12, 0.84, 0.77, FACE_W, { z: 62 });
  f2.obj("modular-suite/props/watchtower_garrison/wt_signal_flare_crate.png", 33.86, 16.12, 0.78, 0.65, 0.25, { z: 62 });

  // East Rim Armorer's Bench & Powder Munitions
  f2.obj("modular-suite/props/watchtower_garrison/wt_armorer_cleaning_bench.png", 36.68, 17.85, 1.40, 0.875, FACE_W, { z: 62 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_table_articulated_brass_lamp.png", 36.75, 17.42, 0.38, 0.38, FACE_W, { z: 68, shadow: false });
  f2.obj("modular-suite/props/armory_dungeon/arm_gunpowder_keg.png", 36.32, 19.04, 0.58, 0.58, 0, { z: 62 });
  f2.obj("modular-suite/props/armory_dungeon/arm_oil_barrel.png", 35.68, 19.55, 0.60, 0.61, 0.2, { z: 62 });

  // South-Center Off-Duty Ready Nook (Card Table + Potbelly Stove, generous aisle below armory cage!)
  f2.obj("modular-suite/modular/bare_oak_round_table.png", 35.05, 18.60, 0.90, 0.90, 0, { z: 60 });
  f2.obj("modular-suite/props/tavern_clutter/tav_playing_cards.png", 34.92, 18.54, 0.36, 0.35, 0.3, { z: 66, shadow: false });
  f2.obj("modular-suite/props/tavern_clutter/tav_leather_dice_cup.png", 35.22, 18.64, 0.34, 0.27, -0.2, { z: 66, shadow: false });
  f2.obj("modular-suite/props/tavern_clutter/tav_foamy_ale_mug.png", 35.12, 18.34, 0.30, 0.23, 0.5, { z: 66, shadow: false });
  f2.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 34.34, 18.92, 0.56, 0.59, -0.8, { z: 56 });
  f2.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 35.66, 18.22, 0.56, 0.59, 2.2, { z: 56 });
  f2.obj("objects/potbelly_cast_stove.png", 34.48, 19.74, 0.78, 0.78, 0, { z: 64 });

  // 2F Lighting Fixtures & Dynamic Lights
  f2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 35.08, 17.75, 0.90, 0.90, 0, { z: 90, opacity: 0.88, shadow: false });
  f2.obj("modular-suite/props/harmony_lighting/lgt_sconce_dungeon_iron_brazier.png", 34.75, 15.22, 0.48, 0.48, FACE_S, { z: 76, shadow: false });
  f2.light("2F Watchtower Armory Pendant", 35.08, 17.75, 5.4, "#FFD088", 0.88);
  f2.light("2F Armory Potbelly Stove", 34.48, 19.72, 3.8, "#FF7A2F", 0.78, { flicker: true });
  f2.note(
    "HAZARD",
    36.32,
    19.04,
    "2F · Garrison Armory & Flare Munitions",
    "Locked steel armory cage housing percussion rifles, 2 Magipunk Aether-Carbines, and red/cyan signal flares. Igniting the SE gunpowder keg & oil barrel deals 4d6 fire damage across the tower interior!",
    "#F59E0B",
  );

  // =========================================================================
  // 3F (+28ft) — LIVED-IN WATCHMEN'S BUNKHOUSE & SHIFT-CHANGE MESS
  // =========================================================================
  const f3 = makeWtFloorBuilder("3f");
  f3.floorPoly("modular-suite/terrain/harmony/flr_weathered_attic_planks.png", circleWallPts);
  const w3Outer = f3.wall("modular-suite/walls/harmony/wall_granite_fortress_parapet.png", circleWallPts, {
    closed: true,
    thickness: 0.22,
  });
  for (const deg of [-68, 0, 68, 138]) {
    f3.rimPortal("modular-suite/portals/harmony/win_prison_barred_iron.png", deg, "window", 0.92, w3Outer, true);
  }

  // Prussian-Slate Circular Woven Floor Rug
  f3.obj("modular-suite/props/watchtower_garrison/wt_colorable_garrison_rug.png", 35.12, 17.75, 2.55, 2.55, 0, { z: 38, shadow: false, recolor: GARRISON_SLATE });
  // West Spiral Staircase
  f3.obj("modular-suite/props/watchtower_garrison/wt_fortress_spiral_stair.png", WT_STAIR_X, WT_STAIR_Y, WT_STAIR_SIZE, WT_STAIR_SIZE, 0, { z: 54, shadow: false });

  // 3 Lived-In Radial Watchmen's Bunks + Personal Footlockers (zero overlap with boot rack!)
  f3.obj("modular-suite/props/watchtower_garrison/wt_garrison_bunk_cot.png", 34.78, 15.82, 0.82, 1.27, FACE_E, { z: 60 });
  f3.obj("modular-suite/props/watchtower_garrison/wt_garrison_bunk_cot.png", 36.56, 17.75, 0.82, 1.27, FACE_S, { z: 60 });
  f3.obj("modular-suite/props/watchtower_garrison/wt_garrison_bunk_cot.png", 34.92, 19.62, 0.82, 1.27, FACE_W, { z: 60 });
  f3.obj("modular-suite/props/bedroom_home/home_brass_footlocker.png", 35.72, 15.84, 0.64, 0.47, 0.42, { z: 60 });
  f3.obj("modular-suite/props/bedroom_home/home_brass_footlocker.png", 36.02, 19.25, 0.68, 0.50, -0.75, { z: 60 });

  // Shift-Change Mess Table, Cookstove, Boot Rack & Patrol Roster
  f3.obj("modular-suite/props/watchtower_garrison/wt_mess_ration_table.png", 35.10, 17.72, 1.18, 0.865, FACE_S, { z: 62 });
  f3.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 35.10, 17.02, 0.54, 0.57, FACE_S, { z: 58 });
  f3.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 35.10, 18.42, 0.54, 0.57, FACE_N, { z: 58 });
  f3.obj("modular-suite/props/watchtower_garrison/wt_greatcoat_boot_rack.png", 36.42, 16.64, 0.88, 0.50, 0.96, { z: 62 });
  f3.obj("modular-suite/props/watchtower_garrison/wt_patrol_roster_table.png", 33.76, 19.25, 0.94, 0.67, 0.65, { z: 62 });
  f3.obj("modular-suite/props/kitchen/kit_iron_cookstove.png", 33.78, 16.22, 0.78, 0.69, 0.75, { z: 62 });
  f3.obj("modular-suite/colorable/col_enamel_kettle.png", 33.82, 16.18, 0.36, 0.36, 0.2, { z: 68, shadow: false, recolor: PRUSSIAN_NAVY });
  f3.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 33.12, 19.02, 0.52, 0.48, 0.2, { z: 60 });

  // 3F Lighting
  f3.obj("modular-suite/props/harmony_lighting/lgt_ceiling_iron_dome_pendant.png", 35.10, 17.72, 0.88, 0.88, 0, { z: 90, opacity: 0.88, shadow: false });
  f3.obj("modular-suite/props/harmony_lighting/lgt_sconce_oil_reflector_wall.png", 36.98, 17.75, 0.48, 0.48, FACE_W, { z: 76, shadow: false });
  f3.light("3F Bunkhouse Mess Pendant", 35.10, 17.72, 5.4, "#FFC26B", 0.88, { flicker: true });
  f3.light("3F Bunkhouse Cookstove Glow", 33.78, 16.22, 3.6, "#FF8A3D", 0.72, { flicker: true });
  f3.note(
    "NOTE",
    35.10,
    17.72,
    "3F · Off-Duty Watchmen's Bunkhouse",
    "Smells of damp wool greatcoats, chicory coffee, and rye bread. The SW Patrol Shift Roster reveals the exact 20-minute blind gap when guards rotate between the Cathedral stairs and the Hinterhof alleys.",
    "#F59E0B",
  );

  // =========================================================================
  // 4F (+42ft) — WATCH CAPTAIN'S COMMAND OFFICE, TACTICAL MAP & TELEGRAPH
  // =========================================================================
  const f4 = makeWtFloorBuilder("4f");
  f4.floorPoly("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", circleWallPts);
  const w4Outer = f4.wall("modular-suite/walls/harmony/wall_berlin_dressed_sandstone.png", circleWallPts, {
    closed: true,
    thickness: 0.22,
  });
  for (const deg of [-90, -28, 32, 92, 145]) {
    f4.rimPortal("modular-suite/portals/harmony/win_factory_multipane_iron.png", deg, "window", 0.98, w4Outer, true);
  }

  // Deep Sovereign-Crimson Circular Carpet + Aether Conduit feeding Telegraph & 5F Searchlight
  f4.obj("modular-suite/props/watchtower_garrison/wt_colorable_garrison_rug.png", 35.20, 17.75, 2.75, 2.75, 0, { z: 38, shadow: false, recolor: SOVEREIGN_CRIMSON });
  f4.spline(
    "paths/aether_power_conduit.png",
    [
      { x: 35.65, y: 19.35 },
      { x: 36.55, y: 18.65 },
      { x: 36.92, y: 17.75 },
    ],
    0.18,
    { curved: true },
  );

  // West Spiral Staircase + Vertical Brass Speaking Tube (exact shaft alignment with 1F & 5F!)
  f4.obj("modular-suite/props/watchtower_garrison/wt_fortress_spiral_stair.png", WT_STAIR_X, WT_STAIR_Y, WT_STAIR_SIZE, WT_STAIR_SIZE, 0, { z: 54, shadow: false });
  f4.obj("modular-suite/props/watchtower_garrison/wt_speaking_tube_pipe.png", 33.86, 15.82, 0.56, 0.56, -Math.PI / 4, { z: 66, shadow: false });

  // Hero Centerpiece: Illuminated Circular Tactical District War-Map Table!
  f4.obj("modular-suite/props/watchtower_garrison/wt_tactical_district_map_table.png", 35.22, 17.75, 1.72, 1.72, 0, { z: 64 });

  // North Arc: Watch Captain's Mahogany Blotter Desk & Suspect Dossier Cabinet
  f4.obj("modular-suite/props/bare_furniture/bare_blotter_desk.png", 35.02, 16.02, 1.24, 0.75, FACE_S, { z: 62 });
  f4.obj("modular-suite/props/harmony_lighting/lgt_table_banker_crimson_desk.png", 34.58, 15.88, 0.38, 0.38, 0, { z: 68, shadow: false });
  f4.obj("modular-suite/props/post_office/po_open_ledger.png", 35.06, 16.04, 0.44, 0.33, 0.05, { z: 68, shadow: false });
  f4.obj("modular-suite/props/school_courtroom/sch_legal_ledger_stack.png", 35.48, 15.92, 0.36, 0.36, -0.2, { z: 68, shadow: false });
  f4.obj("modular-suite/props/watchtower_garrison/wt_captain_dossier_cabinet.png", 36.42, 16.52, 1.06, 0.61, 0.85, { z: 62 });

  // SE Arc: Magipunk Aether-Telegraph & Pneumatic Dispatch Station + Interior Garrison Banner
  f4.obj("modular-suite/props/watchtower_garrison/wt_aether_telegraph_console.png", 35.58, 19.35, 1.32, 0.825, -0.45, { z: 64 });
  f4.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 34.82, 19.12, 0.54, 0.57, -1.2, { z: 58 });
  f4.obj("modular-suite/props/watchtower_garrison/wt_colorable_watch_banner_flag.png", 36.88, 17.75, 0.54, 0.72, FACE_W, { z: 64, recolor: PRUSSIAN_NAVY });

  // 4F Lighting (Jugendstil wall sconces frame the room so the hero Tactical District Map shines 100% unobstructed!)
  f4.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 32.55, 16.42, 0.52, 0.52, -0.55, { z: 76, shadow: false });
  f4.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 36.96, 17.15, 0.52, 0.52, 1.35, { z: 76, shadow: false });
  f4.light("4F Tactical Map Table Glow", 35.22, 17.75, 5.8, "#FFD88A", 0.96);
  f4.light("4F Aether-Telegraph Console", 35.58, 19.35, 4.4, "#38BDF8", 0.88);
  f4.note(
    "SECRET",
    35.22,
    17.75,
    "4F · Watch Captain's Command & Aether-Telegraph",
    "The illuminated Tactical Map pins track smuggling runs between the Ice Cream Express, Unit 4A of 42 Eisenbahnstraße, and the Cathedral Crypts. Intercepting the pneumatic dispatch tube reveals tomorrow night's Inquisition raid orders!",
    "#38BDF8",
  );

  // =========================================================================
  // 5F (+56ft) — OPEN-AIR CRENELATED BATTLEMENT CROWN & AETHER SEARCHLIGHT!
  // =========================================================================
  const f5 = makeWtFloorBuilder("5f");
  f5.floorPoly("core-fantasy/terrain/castle_keep_ashlar.png", battlementWallPts);
  // Open-air chest-high crenellated granite battlement parapet (blocksLight: false so searchlight sweeps the city!)
  f5.wall("modular-suite/walls/harmony/wall_granite_fortress_parapet.png", battlementWallPts, {
    closed: true,
    thickness: 0.25,
    blocksLight: false,
  });

  // High-voltage copper-cyan aether feed cable from East Capacitor Dynamo into Searchlight Turret!
  f5.spline(
    "paths/aether_power_conduit.png",
    [
      { x: 36.75, y: 17.65 },
      { x: 36.05, y: 17.78 },
      { x: 35.32, y: 17.82 },
    ],
    0.22,
    { curved: true },
  );

  // West Spiral Staircase Landing + Vertical Speaking Tube (exact shaft alignment!)
  f5.obj("modular-suite/props/watchtower_garrison/wt_fortress_spiral_stair.png", WT_STAIR_X, WT_STAIR_Y, WT_STAIR_SIZE, WT_STAIR_SIZE, 0, { z: 54, shadow: false });
  f5.obj("modular-suite/props/watchtower_garrison/wt_speaking_tube_pipe.png", 33.86, 15.82, 0.56, 0.56, -Math.PI / 4, { z: 66, shadow: false });

  // Hero Centerpiece: 360° Swiveling Magipunk Aether Searchlight Turret aimed SW across the Plaza & Cathedral!
  f5.obj("modular-suite/props/watchtower_garrison/wt_searchlight_turret_aether.png", 35.28, 17.82, 1.66, 1.66, Math.PI / 4, { z: 72 });

  // High-Voltage Searchlight Capacitor Dynamo (East), Alarm Bell (North), Brass Rangefinder (South), Semaphore Locker (SE)
  f5.obj("modular-suite/props/watchtower_garrison/wt_searchlight_capacitor_bank.png", 36.72, 17.65, 1.08, 0.72, FACE_W, { z: 66 });
  f5.obj("modular-suite/props/watchtower_garrison/wt_district_alarm_bell.png", 34.86, 15.86, 1.08, 1.08, 0, { z: 70 });
  f5.obj("modular-suite/props/watchtower_garrison/wt_observatory_rangefinder.png", 34.86, 19.65, 1.02, 1.02, 0.35, { z: 68 });
  f5.obj("modular-suite/props/watchtower_garrison/wt_semaphore_signal_rack.png", 36.18, 19.12, 0.96, 0.665, -0.72, { z: 64 });

  // Signal Beacon Brazier (ENE) + 2 Curved Sandbag Battlement Cover Arcs hugging circular parapet + 2 Wind-Streaming Garrison Flags!
  f5.obj("modular-suite/props/harmony_lighting/lgt_brazier_bronze_temple_tripod.png", 36.56, 16.58, 0.74, 0.74, 0, { z: 68 });
  f5.obj("modular-suite/props/watchtower_garrison/wt_sandbag_embrasure_arc.png", 33.72, 19.58, 1.22, 0.65, -2.52, { z: 64 });
  f5.obj("modular-suite/props/watchtower_garrison/wt_sandbag_embrasure_arc.png", 35.84, 15.62, 1.18, 0.63, 0.44, { z: 64 });
  f5.obj("modular-suite/props/watchtower_garrison/wt_colorable_watch_banner_flag.png", 32.72, 15.96, 0.66, 0.88, Math.PI / 4, { z: 74, recolor: PRUSSIAN_NAVY });
  f5.obj("modular-suite/props/watchtower_garrison/wt_colorable_watch_banner_flag.png", 32.68, 19.52, 0.66, 0.88, Math.PI / 4, { z: 74, recolor: SOVEREIGN_CRIMSON });

  // 5F Dramatic Open-Air Directional Aether Searchlight Beam + Beacon Lighting!
  f5.light("5F Aether Searchlight Turret Beam", 35.12, 17.98, 16.0, "#38BDF8", 1.45, {
    castShadows: false,
    coneAngleDeg: 54,
    directionRad: (3 * Math.PI) / 4,
  });
  f5.light("5F Searchlight Turret Halo", 35.28, 17.82, 4.6, "#7DD3FC", 0.95, { castShadows: false });
  f5.light("5F Searchlight Capacitor Glow", 36.72, 17.65, 4.5, "#38BDF8", 0.92);
  f5.light("5F Battlement Signal Brazier", 36.56, 16.58, 5.4, "#FF8C3B", 0.92, { flicker: true });
  f5.note(
    "AMBUSH",
    35.28,
    17.82,
    "5F · Wachturm Ost Battlements & Aether Searchlight (+56 ft)",
    "Open-air crenellated watchtower crown with 360° sightlines over the entire district. Swiveling the Magipunk Aether Searchlight illuminates a 120 ft cone (revealing stealthed intruders); pulling the North Bronze Alarm Bell rallies the district watch in 2 rounds!",
    "#38BDF8",
  );

  // Merge all 5 floors into the master map bundles!
  mergeInto(f1Out, f1.b);
  mergeInto(f2Out, f2.b);
  mergeInto(f3Out, f3.b);
  mergeInto(f4Out, f4.b);
  mergeInto(f5Out, f5.b);

  return { watchtowerPoly: WATCHTOWER_POLY };
}

/**
 * Builds 3 full, richly lived-in Subterranean Levels beneath `Cathedral of the Sovereign (5F)`:
 *
 *  - B1 (-14ft): 11 District Building Basements, Cathedral Crypts, Cryo-Icehouse, Tenement Coal &
 *                Kellerabteile Storage, Bakery Root Cellar, Municipal Pump-Well, Brewery, Laundry,
 *                Merchant Wine Cellar, Antiquarian Vault & Bootlegger Still (with secret hatches/doors!)
 *  - B2 (-28ft): Hidden 2nd-Level Sub-Basements — Cathedral Inquisition Black-Site & Heretic Gaol,
 *                "The Velvet Engine" Underground Speakeasy, Tenement Smuggler Counterfeit Cache,
 *                SE Cult of the Pale Root Shrine, linked by the Flooded Municipal Brick Sewer Canal!
 *  - B3 (-42ft): 3rd-Level Deep Primordial Sovereign Vault & Leyline Heart breached directly into
 *                a sprawling 4-chamber Natural Underground Cave Network (Native CaveDungeonSystem +
 *                Shimmering Underground Crystal River & Lake + Bioluminescent Fungal Grotto +
 *                Abandoned Magipunk Aether-Crystal Mine + NW Hanging-Root Monster Lair)!
 *
 * Every vertical shaft, stair, lift, hatch & sinkhole aligns precisely with the floor above it,
 * and every lighting fixture uses our true top-down `harmony_lighting` suite.
 */

import {
  DEFAULT_RECOLOR,
  type CaveDungeonSystem,
  type DcMapDocument,
  type DmNotePin,
  type LightNode,
  type MapLayer,
  type ObjectStamp,
  type Point2D,
  type PortalNode,
  type RgbRecolor,
  type SplinePath,
  type TerrainStroke,
  type WallSegment,
  type WaterRegion,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

const S = Math.SQRT1_2;
const Q = Math.PI / 4;

// Cathedral local (u, v) coordinate frame matching build_sovereign_temple_map.ts
const NAVE_X = 9.0;
const NAVE_Y = 44.0;
function cathPt(u: number, v: number): Point2D {
  return {
    x: Math.round((NAVE_X - S * u + S * v) * 1000) / 1000,
    y: Math.round((NAVE_Y + S * u + S * v) * 1000) / 1000,
  };
}
function cathRect(u0: number, v0: number, u1: number, v1: number): Point2D[] {
  return [cathPt(u0, v0), cathPt(u0, v1), cathPt(u1, v1), cathPt(u1, v0)];
}
function cathCircle(cu: number, cv: number, r: number, segs = 24): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push(cathPt(cu + Math.cos(a) * r, cv + Math.sin(a) * r));
  }
  return out;
}

// Ice Cream Express local (su, sv) frame matching iceCreamTrainBuilder.ts
const SHOP_OX = 20.0;
const SHOP_OY = 22.0;
function shopPt(su: number, sv: number): Point2D {
  return {
    x: Math.round((SHOP_OX - S * su + S * sv) * 1000) / 1000,
    y: Math.round((SHOP_OY + S * su + S * sv) * 1000) / 1000,
  };
}

// Cardinal orientations for front-down (+Y) top-down sprites:
const FACE_S = 0;
const FACE_N = Math.PI;
const FACE_E = -Math.PI / 2;
const FACE_W = Math.PI / 2;

const FACE_APSE = Math.PI / 4;
const FACE_DOOR = (-3 * Math.PI) / 4;
const FACE_SE = -Math.PI / 4;
const FACE_NW = (3 * Math.PI) / 4;
const PORTAL_ALONG_V = Math.PI / 4;
const PORTAL_ALONG_U = -Math.PI / 4;

function rect(x0: number, y0: number, x1: number, y1: number): Point2D[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function worldCircle(cx: number, cy: number, r: number, segs = 24): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push({
      x: Math.round((cx + Math.cos(a) * r) * 1000) / 1000,
      y: Math.round((cy + Math.sin(a) * r) * 1000) / 1000,
    });
  }
  return out;
}

/** Shrink a polygon slightly inward toward its centroid so basement walls sit cleanly beneath 1F walls */
function insetPoly(pts: Point2D[], factor = 0.92): Point2D[] {
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
  return pts.map((p) => ({
    x: Math.round((cx + (p.x - cx) * factor) * 1000) / 1000,
    y: Math.round((cy + (p.y - cy) * factor) * 1000) / 1000,
  }));
}

function tint(hex: string, mode: "dd_red" | "tint" = "dd_red", strength = 0.88): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode, tintHex: hex, strength };
}

const VELVET_CRIMSON = tint("#8E1B2E", "dd_red", 0.9);
const ROYAL_VIOLET = tint("#6D28D9", "dd_red", 0.9);
const EMERALD_CULT = tint("#1B7A58", "dd_red", 0.88);
const SLATE_PRISON = tint("#3B4758", "dd_red", 0.88);
const AMBER_CRYSTAL = tint("#F59E0B", "dd_red", 0.92);

interface SubLevelBundle extends IceCreamBuildBundle {
  water: WaterRegion[];
  caveSystem?: CaveDungeonSystem;
}

function makeSubBuilder(prefix: string) {
  let seq = 1;
  const uid = (tag: string) => `sub-${prefix}-${tag}-${seq++}`;

  const b: SubLevelBundle = {
    terrain: [],
    paths: [],
    walls: [],
    portals: [],
    objects: [],
    lights: [],
    dmNotes: [],
    water: [],
  };

  const floorPoly = (assetId: string, points: Point2D[], opts: { opacity?: number; softness?: number } = {}) => {
    b.terrain.push({
      id: uid("flr"),
      assetId,
      points,
      radiusCells: 0.4,
      opacity: opts.opacity ?? 1,
      softness: opts.softness ?? 0.02,
      shape: "polygon",
    });
  };

  const wall = (
    assetId: string,
    points: Point2D[],
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean } = {},
  ): string => {
    const id = uid("wal");
    b.walls.push({
      id,
      assetId,
      points,
      closed: opts.closed ?? false,
      thicknessCells: opts.thickness ?? 0.2,
      blocksLight: opts.blocksLight ?? true,
    });
    return id;
  };

  const wallCath = (
    assetId: string,
    uvs: Array<[number, number]>,
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean } = {},
  ): string => wall(assetId, uvs.map(([u, v]) => cathPt(u, v)), opts);

  const portal = (
    assetId: string,
    x: number,
    y: number,
    rotationRad: number,
    kind: PortalNode["kind"],
    widthCells = 1.0,
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

  const portalCath = (
    assetId: string,
    u: number,
    v: number,
    rotationRad: number,
    kind: PortalNode["kind"],
    widthCells = 1.0,
    closed = true,
    wallId?: string,
  ) => {
    const p = cathPt(u, v);
    portal(assetId, p.x, p.y, rotationRad, kind, widthCells, closed, wallId);
  };

  const spline = (
    assetId: string,
    points: Point2D[],
    widthCells: number,
    opts: { curved?: boolean; opacity?: number; fadeEnds?: boolean } = {},
  ) => {
    b.paths.push({
      id: uid("pth"),
      assetId,
      points,
      widthCells,
      curved: opts.curved ?? false,
      taperEnds: false,
      fadeEnds: opts.fadeEnds ?? false,
      opacity: opts.opacity ?? 1,
      blocksScatter: false,
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

  const objCath = (
    assetId: string,
    u: number,
    v: number,
    w: number,
    h: number,
    rot = 0,
    opts: { z?: number; shadow?: boolean; flipX?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    const p = cathPt(u, v);
    obj(assetId, p.x, p.y, w, h, rot, opts);
  };

  const light = (
    name: string,
    x: number,
    y: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.9,
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
      flicker: opts.flicker ?? false,
    });
  };

  const lightCath = (
    name: string,
    u: number,
    v: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.9,
    opts: { castShadows?: boolean; flicker?: boolean } = {},
  ) => {
    const p = cathPt(u, v);
    light(name, p.x, p.y, radiusCells, colorHex, intensity, opts);
  };

  const note = (
    badge: DmNotePin["badge"],
    x: number,
    y: number,
    title: string,
    body: string,
    colorHex = "#A855F7",
  ) => {
    b.dmNotes.push({
      id: uid("note"),
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      badge,
      title,
      body,
      colorHex,
    });
  };

  const noteCath = (
    badge: DmNotePin["badge"],
    u: number,
    v: number,
    title: string,
    body: string,
    colorHex = "#A855F7",
  ) => {
    const p = cathPt(u, v);
    note(badge, p.x, p.y, title, body, colorHex);
  };

  return { b, floorPoly, wall, wallCath, portal, portalCath, spline, obj, objCath, light, lightCath, note, noteCath };
}

export interface SubterraneanResult {
  b1Layers: MapLayer[];
  b2Layers: MapLayer[];
  b3Layers: MapLayer[];
}

export function buildSubterraneanDistrict(
  doc: DcMapDocument,
  f1Bundle: IceCreamBuildBundle,
  templePoly: Point2D[],
  shopPoly: Point2D[],
  aptPoly: Point2D[],
): SubterraneanResult {
  // Look up real 1F building floor polygons from the imported MrRogers map so every basement sits
  // directly beneath its matching surface building!
  const groundTerrain = doc.layers.find((l) => l.id === "layer-dd-terrain-1")!;
  const getBuildingPoly = (id: string): Point2D[] => {
    const hit = (groundTerrain.terrainStrokes ?? []).find((s) => s.id === id);
    return hit ? structuredClone(hit.points) : [];
  };

  // Add subtle ground-floor (1F) cellar entry hatches so players on 1F can discover the basements!
  const icHatchPt = shopPt(1.05, 1.95);
  f1Bundle.objects.push({
    id: "sub-1f-ic-cellar-hatch",
    assetId: "modular-suite/props/subterranean_caves/sub_secret_floor_trapdoor_rug.png",
    x: icHatchPt.x,
    y: icHatchPt.y,
    widthCells: 0.92,
    heightCells: 0.92,
    rotationRad: Q,
    flipX: false,
    flipY: false,
    opacity: 1,
    castsShadow: false,
    locked: false,
    recolor: { ...DEFAULT_RECOLOR },
    zOrder: 44,
  });
  // Add an exterior coal chute hatch beside the NW Corner Block & Merchant House on 1F
  f1Bundle.objects.push({
    id: "sub-1f-nw-coal-chute",
    assetId: "modular-suite/props/sewers_alleys/sew_coal_chute_hatch.png",
    x: 11.4,
    y: 16.9,
    widthCells: 0.88,
    heightCells: 0.88,
    rotationRad: -Q,
    flipX: false,
    flipY: false,
    opacity: 1,
    castsShadow: false,
    locked: false,
    recolor: { ...DEFAULT_RECOLOR },
    zOrder: 46,
  });

  // =========================================================================
  // LEVEL B1 (-14ft) — DISTRICT BASEMENTS, CATHEDRAL CRYPTS & COLD CELLARS
  // =========================================================================
  const b1 = makeSubBuilder("b1");

  // -------------------------------------------------------------------------
  // B1-1. CATHEDRAL OF THE SOVEREIGN — OSSUARY CRYPTS, COAL VAULT & WINE CELLAR
  // -------------------------------------------------------------------------
  b1.floorPoly("core-fantasy/terrain/crypt_mossy_cobble.png", templePoly);
  b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", cathCircle(-7.07, -7.07, 2.85, 24));
  b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", cathCircle(-7.07, 7.07, 2.85, 24));
  b1.floorPoly("modular-suite/terrain/forge_soot_flagstone.png", cathRect(-4.2, -6.9, 3.4, -3.2));
  b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", cathCircle(6.364, 0, 4.35, 30));

  b1.wall("core-fantasy/walls/crypt_mossy_wall.png", templePoly, { closed: true, thickness: 0.24 });
  // Interior crypt partition walls: NW Coal Boiler Vault + SE Clerics' Wine Cellar + SW Saint's Mausoleum
  const wB1Coal = b1.wallCath("core-fantasy/walls/dungeon_stone_wall.png", [[-4.2, -7.0], [-4.2, -3.2], [3.5, -3.2], [3.5, -7.0]], { thickness: 0.18 });
  const wB1Wine = b1.wallCath("modular-suite/walls/wall_cellar_brick.png", [[-4.2, 7.0], [-4.2, 3.2], [3.5, 3.2], [3.5, 7.0]], { thickness: 0.18 });
  const wB1Apse = b1.wallCath("core-fantasy/walls/crypt_mossy_wall.png", [[3.8, -3.9], [3.8, 3.9]], { thickness: 0.22 });
  // Hidden sub-stair vestibule behind SE wine rack!
  const wB1Sec = b1.wallCath("modular-suite/walls/wall_cellar_brick.png", [[1.8, 3.2], [1.8, 7.0]], { thickness: 0.16 });

  b1.portalCath("core-fantasy/portals/iron_dungeon_door.png", -0.8, -3.2, PORTAL_ALONG_U, "door", 1.05, true, wB1Coal);
  b1.portalCath("core-fantasy/portals/oak_tavern_door.png", -1.2, 3.2, PORTAL_ALONG_U, "door", 1.05, false, wB1Wine);
  b1.portalCath("modular-suite/portals/harmony/door_crypt_mossy_slab.png", 3.8, 0, PORTAL_ALONG_V, "door", 1.65, true, wB1Apse);
  // SECRET PIVOTING STONE WALL behind the wine bottles leading to B2 Inquisition Black-Site stair!
  b1.portalCath("modular-suite/portals/harmony/door_secret_stone_pivot.png", 1.8, 5.1, PORTAL_ALONG_V, "door", 1.05, true, wB1Sec);

  // Vertically aligned North Spiral Stair (-6.35, -6.35) & East Aether-Lift (-7.07, +7.07)
  b1.objCath("objects/brass_spiral_staircase.png", -6.35, -6.35, 2.4, 2.4, Math.PI, { z: 45 });
  b1.objCath("modular-suite/props/sovereign_temple/sov_aether_lift_cage.png", -7.07, 7.07, 2.65, 2.65, FACE_NW + Q, { z: 48 });
  // Dress the North Tower Circular Crypt Landing with vigil cairn, funerary urns, cobwebs & floor drain!
  b1.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", -8.35, -8.35, 1.42, 0.9, FACE_APSE, { z: 64 });
  b1.objCath("modular-suite/props/funeral/fun_marble_cremation_urn.png", -8.65, -6.1, 0.72, 0.62, 0.2, { z: 64 });
  b1.objCath("modular-suite/props/funeral/fun_marble_cremation_urn.png", -6.1, -8.65, 0.72, 0.62, -0.3, { z: 64 });
  b1.objCath("modular-suite/modular/crate_walnut_iron.png", -8.1, -5.4, 0.85, 0.85, 0.4, { z: 62 });
  b1.objCath("modular-suite/modular/dec_cobweb_corner.png", -8.9, -7.8, 0.95, 0.95, 0.2, { z: 75, shadow: false, opacity: 0.7 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", -5.4, -7.1, 0.98, 0.83, FACE_APSE, { z: 42, shadow: false });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_iron_triple.png", -6.84, -3.55, 0.58, 0.58, FACE_APSE, { z: 76, shadow: false });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_iron_triple.png", -9.45, -7.07, 0.56, 0.56, FACE_APSE, { z: 76, shadow: false });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", -6.84, 3.55, 0.58, 0.58, FACE_APSE, { z: 76, shadow: false });

  // Central Nave Crypt: Sarcophagi, Skull Ossuary Alcoves, Vigil Cairns, Ritual Braziers & Candelabras!
  b1.spline("modular-suite/paths/path_cemetery_stones.png", [cathPt(-6.4, 0), cathPt(3.6, 0)], 1.6);
  for (const u of [-3.2, -0.6, 1.9]) {
    b1.objCath("modular-suite/props/subterranean_caves/sub_stone_sarcophagus_carved.png", u, -1.9, 1.6, 1.0, FACE_SE, { z: 62 });
    if (u === 1.9) {
      b1.objCath("modular-suite/props/subterranean_caves/sub_sarcophagus_lid_ajar.png", u, 1.9, 1.6, 1.1, FACE_NW, { z: 62 });
    } else {
      b1.objCath("modular-suite/props/subterranean_caves/sub_stone_sarcophagus_carved.png", u, 1.9, 1.6, 1.0, FACE_NW, { z: 62 });
    }
  }
  b1.objCath("modular-suite/props/subterranean_caves/sub_ossuary_skull_alcove.png", -5.4, -2.5, 1.5, 0.8, FACE_APSE, { z: 64 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_ossuary_skull_alcove.png", -5.4, 2.5, 1.5, 0.8, FACE_APSE, { z: 64 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", -1.9, -2.85, 1.38, 0.87, FACE_SE, { z: 64 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", 0.65, 2.85, 1.38, 0.87, FACE_NW, { z: 64 });
  b1.objCath("modular-suite/props/district_streets/vigil_candle_cluster_lit.png", 3.1, -2.6, 0.72, 0.72, 0.2, { z: 66 });
  b1.objCath("modular-suite/props/district_streets/vigil_candle_cluster_lit.png", 3.1, 2.6, 0.72, 0.72, -0.3, { z: 66 });
  b1.objCath("modular-suite/modular/dec_stone_crack_moss.png", -2.1, 0.5, 1.1, 1.1, 0.5, { z: 40, shadow: false, opacity: 0.78 });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_iron.png", -4.4, -1.35, 0.86, 0.86, 0, { z: 68 });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_iron.png", -4.4, 1.35, 0.86, 0.86, 0, { z: 68 });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_brazier_bronze_temple_tripod.png", 2.9, -1.35, 0.84, 0.84, 0, { z: 68 });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_brazier_bronze_temple_tripod.png", 2.9, 1.35, 0.84, 0.84, 0, { z: 68 });
  b1.objCath("modular-suite/props/mining_cavern/min_corner_cobweb.png", -3.9, -2.9, 0.85, 0.85, 0, { z: 75, shadow: false, opacity: 0.72 });

  // NW Coal & Auxiliary Boiler Vault (u: -4.0..+3.2, v: -6.8..-3.4)
  b1.objCath("objects/steam_boiler_furnace.png", -2.3, -5.5, 1.95, 1.46, FACE_SE, { z: 64 });
  b1.objCath("objects/coal_hopper_bin.png", 0.3, -5.8, 1.32, 1.32, FACE_SE, { z: 62 });
  b1.objCath("objects/coal_sack_pile.png", 2.1, -5.6, 1.12, 0.98, 0.3, { z: 62 });
  b1.objCath("modular-suite/props/district_streets/str_coal_heap_shovel.png", -0.8, -5.7, 1.05, 0.86, FACE_SE, { z: 62 });
  b1.objCath("modular-suite/props/district_streets/str_split_firewood_rack.png", -3.65, -4.75, 1.26, 0.73, FACE_APSE, { z: 62 });
  b1.objCath("modular-suite/props/armory_dungeon/arm_oil_barrel.png", 1.35, -4.05, 0.82, 0.83, 0, { z: 62 });
  b1.objCath("modular-suite/props/blacksmith/bs_open_toolbox.png", -2.5, -3.9, 0.78, 0.75, 0.4, { z: 62 });
  b1.objCath("modular-suite/props/sewers_alleys/sew_pipe_wheel_valve.png", 2.5, -4.1, 0.72, 0.72, 0, { z: 64 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 0.1, -4.2, 0.96, 0.81, FACE_SE, { z: 42, shadow: false });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_iron.png", 0.2, -3.48, 0.56, 0.56, FACE_NW, { z: 76, shadow: false });
  // Route cyan aether power conduit cleanly along the NE exterior crypt wall (NEVER crossing tombs!)
  b1.spline("paths/aether_power_conduit.png", [
    cathPt(-2.3, -4.8), cathPt(-4.0, -4.2), cathPt(-6.1, -2.6), cathPt(-6.6, 0.0), cathPt(-6.4, 3.8), cathPt(-7.0, 6.6),
  ], 0.22, { curved: true });

  // SE Clerics' Wine & Preserves Cellar + Hidden Secret Stair Vestibule down to B2!
  b1.objCath("modular-suite/props/subterranean_caves/sub_wine_cask_rack_double.png", -2.6, 5.7, 1.75, 1.2, FACE_NW, { z: 62 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_wine_cask_rack_double.png", -0.4, 5.7, 1.75, 1.2, FACE_NW, { z: 62 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_dusty_wine_bottle_shelf.png", 1.28, 4.35, 1.4, 0.75, FACE_DOOR, { z: 62 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_preserved_jars_pantry_shelf.png", -3.55, 4.5, 1.35, 0.77, FACE_APSE, { z: 62 });
  b1.objCath("modular-suite/modular/barrel_lying_dark.png", 1.0, 6.2, 1.12, 0.77, FACE_DOOR, { z: 62 });
  b1.objCath("modular-suite/modular/crate_pine_slatted.png", -2.6, 4.05, 0.84, 0.84, 0.2, { z: 62 });
  b1.objCath("modular-suite/modular/dec_cobweb_corner.png", -3.85, 6.55, 0.85, 0.85, 0, { z: 75, shadow: false, opacity: 0.72 });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_sconce_oil_reflector_wall.png", -1.4, 3.48, 0.54, 0.54, FACE_SE, { z: 76, shadow: false });
  // Behind the secret pivoting stone wall (u: 1.9..3.4, v: 3.4..6.8): Descending stone stair straight to B2 Black-Site!
  b1.objCath("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 2.65, 5.1, 1.1, 1.6, FACE_SE, { z: 54 });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_iron_triple.png", 3.22, 5.1, 0.52, 0.52, FACE_DOOR, { z: 76, shadow: false });

  // SW High Saint's Mausoleum Apse (u: 4.0..10.5)
  b1.objCath("modular-suite/props/subterranean_caves/sub_stone_sarcophagus_carved.png", 6.8, 0, 2.25, 1.4, FACE_DOOR, { z: 66 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_ossuary_skull_alcove.png", 5.8, -3.1, 1.45, 0.77, FACE_SE + 0.4, { z: 64 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_ossuary_skull_alcove.png", 5.8, 3.1, 1.45, 0.77, FACE_NW - 0.4, { z: 64 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", 8.6, -2.55, 1.38, 0.87, FACE_SE - 0.5, { z: 64 });
  b1.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", 8.6, 2.55, 1.38, 0.87, FACE_NW + 0.5, { z: 64 });
  b1.objCath("modular-suite/props/funeral/fun_closed_coffin.png", 7.6, -2.9, 0.82, 1.35, FACE_SE - 0.2, { z: 62 });
  b1.objCath("modular-suite/props/funeral/fun_marble_cremation_urn.png", 4.55, -2.6, 0.74, 0.64, 0, { z: 64 });
  b1.objCath("modular-suite/props/funeral/fun_marble_cremation_urn.png", 4.55, 2.6, 0.74, 0.64, 0, { z: 64 });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_floor_sovereign_aether_torchiere.png", 5.4, -1.8, 0.88, 0.88, 0, { z: 70 });
  b1.objCath("modular-suite/props/harmony_lighting/lgt_floor_sovereign_aether_torchiere.png", 5.4, 1.8, 0.88, 0.88, 0, { z: 70 });
  // Secret trapdoor hidden behind the Saint's Tomb descending directly to B2 Inquisition Black-Site!
  b1.objCath("modular-suite/props/subterranean_caves/sub_secret_floor_trapdoor_rug.png", 8.8, 0, 1.05, 1.05, FACE_DOOR, { z: 48, shadow: false });

  b1.lightCath("B1 N-Tower Crypt Sconce", -7.8, -7.2, 5.8, "#FFB85C", 0.88, { flicker: true });
  b1.lightCath("B1 N-Tower Entry Sconce", -6.4, -3.55, 5.2, "#FFB85C", 0.82, { flicker: true });
  b1.lightCath("B1 E-Tower Aether Lift", -7.07, 7.07, 6.2, "#38BDF8", 0.9);
  b1.lightCath("B1 Nave Crypt Candelabras", -4.4, 0, 6.8, "#FFB347", 0.88, { flicker: true });
  b1.lightCath("B1 Nave Apse Braziers", 2.9, 0, 6.5, "#FF8C3B", 0.86, { flicker: true });
  b1.lightCath("B1 Boiler Furnace Glow", -2.3, -5.5, 5.8, "#FF6B2B", 0.92, { flicker: true });
  b1.lightCath("B1 Wine Cellar Oil Sconce", -1.4, 4.2, 5.2, "#FFC26B", 0.82, { flicker: true });
  b1.lightCath("B1 Saint Mausoleum Torchieres", 6.6, 0, 7.2, "#A855F7", 0.95);
  b1.noteCath("SECRET", 1.8, 5.1, "B1 · Secret Wine-Rack Pivot to B2", "Pulling the 1894 Sovereign Reserve bottle rotates the masonry slab, revealing a narrow stone staircase down to the B2 Inquisition Black-Site (DC 15 Investigation).", "#F59E0B");
  b1.noteCath("NOTE", 6.8, 2.6, "B1 · Cathedral Crypts & Coal Vault", "Underground catacombs below the Grand Nave. Behind the High Saint's sarcophagus lies a concealed rug trapdoor dropping directly into the B2 Heretic Gaol.", "#A855F7");

  // -------------------------------------------------------------------------
  // B1-2. ICE CREAM EXPRESS — CRYO-ICEHOUSE COLD CELLAR (under dd-shape-floor-1-8)
  // -------------------------------------------------------------------------
  const icB1Poly = insetPoly(shopPoly, 0.96);
  b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", icB1Poly);
  b1.wall("modular-suite/walls/wall_cellar_brick.png", icB1Poly, { closed: true, thickness: 0.2 });
  // Descending stone cellar stair aligned right under 1F counter trapdoor!
  const icStairPt = shopPt(1.05, 1.85);
  b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", icStairPt.x, icStairPt.y, 0.99, 1.44, FACE_NW, { z: 54 });
  const icChillerPt = shopPt(2.2, -1.2);
  b1.obj("modular-suite/props/subterranean_caves/sub_cryo_brine_chiller_vat.png", icChillerPt.x, icChillerPt.y, 1.65, 1.44, FACE_SE, { z: 64 });
  const icIcePt = shopPt(4.2, 1.15);
  b1.obj("modular-suite/props/subterranean_caves/sub_ice_block_sawdust_pile.png", icIcePt.x, icIcePt.y, 1.65, 1.24, FACE_NW, { z: 62 });
  const icMilkPt = shopPt(3.8, -1.75);
  b1.obj("modular-suite/props/subterranean_caves/sub_milk_cream_can_rack.png", icMilkPt.x, icMilkPt.y, 1.42, 0.91, FACE_SE, { z: 62 });
  const icJarsPt = shopPt(1.3, -1.8);
  b1.obj("modular-suite/props/subterranean_caves/sub_preserved_jars_pantry_shelf.png", icJarsPt.x, icJarsPt.y, 1.25, 0.72, FACE_SE, { z: 62 });
  // Rich icehouse cold-storage dressing: ice crate, brine barrel, meltwater drain, syrup crate & puddles!
  const icCratePt = shopPt(2.55, 1.6);
  b1.obj("modular-suite/modular/crate_open_ice.png", icCratePt.x, icCratePt.y, 0.88, 0.88, 0.2, { z: 62 });
  const icBrinePt = shopPt(4.65, -1.25);
  b1.obj("modular-suite/modular/barrel_open_brine.png", icBrinePt.x, icBrinePt.y, 0.84, 0.84, 0, { z: 62 });
  const icDrainPt = shopPt(3.2, 0.05);
  b1.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", icDrainPt.x, icDrainPt.y, 0.92, 0.78, FACE_NW, { z: 42, shadow: false });
  const icPudPt = shopPt(3.9, 0.3);
  b1.obj("modular-suite/modular/dec_water_puddle_lg.png", icPudPt.x, icPudPt.y, 1.15, 1.15, 0.4, { z: 40, shadow: false, opacity: 0.72 });
  const icSyrPt = shopPt(1.85, 0.65);
  b1.obj("modular-suite/modular/crate_pine_slatted.png", icSyrPt.x, icSyrPt.y, 0.78, 0.78, -0.3, { z: 62 });
  // HIDDEN SECRET TRAPDOOR under rug in the curved SW nose dropping down to B2 "The Velvet Engine" Speakeasy!
  const icSecPt = shopPt(5.45, -0.35);
  b1.obj("modular-suite/props/subterranean_caves/sub_secret_floor_trapdoor_rug.png", icSecPt.x, icSecPt.y, 1.02, 1.02, FACE_APSE, { z: 48, shadow: false });
  const icBulkPt = shopPt(3.1, 2.38);
  b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_brass.png", icBulkPt.x, icBulkPt.y, 0.56, 0.56, FACE_NW, { z: 76, shadow: false });
  b1.light("B1 Cryo-Icehouse Frost Glow", icChillerPt.x, icChillerPt.y, 5.4, "#38BDF8", 0.92);
  b1.light("B1 Icehouse Bulkhead Lamp", icBulkPt.x, icBulkPt.y, 4.8, "#FFD08A", 0.82);
  b1.note("SECRET", icSecPt.x, icSecPt.y, "B1 · Grandma's Speakeasy Hatch", "Hidden under a burlap mat in the curved icehouse nose, an iron-ringed hatch drops straight down into B2 'The Velvet Engine' underground bootleg speakeasy!", "#38BDF8");

  // -------------------------------------------------------------------------
  // B1-3. 42 EISENBAHNSTRASSE TENEMENT — BOILER ROOM & BERLIN KELLERABTEILE
  // -------------------------------------------------------------------------
  const aptB1Poly = insetPoly(aptPoly, 0.98);
  b1.floorPoly("modular-suite/terrain/dungeon_floor_sewer_brick.png", aptB1Poly);
  b1.floorPoly("modular-suite/terrain/forge_soot_flagstone.png", rect(41.2, 0.7, 47.6, 6.8));
  b1.wall("modular-suite/walls/wall_cellar_brick.png", aptB1Poly, { closed: true, thickness: 0.2 });
  // Central cellar corridor walls & slatted tenant storage cage partitions
  const wAptB1Boiler = b1.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 41.2, y: 0.65 }, { x: 41.2, y: 6.85 }, { x: 42.4, y: 6.85 }], { thickness: 0.16 });
  const wAptB1West = b1.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 37.9, y: 0.65 }, { x: 37.9, y: 6.5 }, { x: 30.7, y: 6.5 }], { thickness: 0.16 });
  const wAptB1Cage = b1.wall("core-fantasy/walls/dungeon_iron_bars.png", [{ x: 35.5, y: 6.5 }, { x: 35.5, y: 10.8 }], { thickness: 0.12, blocksLight: false });
  b1.portal("core-fantasy/portals/iron_dungeon_door.png", 41.2, 5.2, Math.PI / 2, "door", 1.0, true, wAptB1Boiler);
  b1.portal("portals/tenement_slum_door.png", 37.9, 5.4, Math.PI / 2, "door", 0.95, false, wAptB1West);
  b1.portal("core-fantasy/portals/prison_cell_gate.png", 35.5, 7.6, Math.PI / 2, "gate", 0.9, true, wAptB1Cage);

  // Vertically aligned Central Tenement Stairwell at EXACT (41.48, 7.6)!
  b1.obj("objects/wood_interior_stairs.png", 41.48, 7.6, 1.02, 1.53, FACE_W, { z: 54 });
  b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_iron.png", 40.3, 5.45, 0.56, 0.56, FACE_S, { z: 76, shadow: false });
  // East Boiler & Coal Room (x: 41.5..47.4, y: 0.9..6.6)
  b1.obj("objects/steam_boiler_furnace.png", 45.6, 2.4, 2.0, 1.5, FACE_W, { z: 64 });
  b1.obj("objects/coal_hopper_bin.png", 45.8, 5.2, 1.35, 1.35, FACE_N, { z: 62 });
  b1.obj("objects/coal_sack_pile.png", 43.2, 5.6, 1.12, 0.98, 0.3, { z: 62 });
  b1.obj("modular-suite/props/district_streets/str_coal_heap_shovel.png", 44.3, 5.8, 1.05, 0.86, 0.2, { z: 62 });
  b1.obj("modular-suite/props/district_streets/str_split_firewood_rack.png", 46.8, 4.0, 1.2, 0.7, FACE_W, { z: 62 });
  b1.obj("modular-suite/props/armory_dungeon/arm_oil_barrel.png", 42.1, 3.6, 0.82, 0.83, 0, { z: 62 });
  b1.obj("modular-suite/props/blacksmith/bs_open_toolbox.png", 42.3, 4.5, 0.78, 0.75, -0.3, { z: 62 });
  b1.obj("modular-suite/props/subterranean_caves/sub_copper_wash_boiler_tub.png", 43.1, 2.1, 1.3, 1.1, 0, { z: 62 });
  b1.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 41.9, 1.65, 0.82, 0.76, 0.2, { z: 62 });
  b1.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 44.2, 3.4, 0.98, 0.83, 0, { z: 42, shadow: false });
  b1.obj("modular-suite/props/sewers_alleys/sew_mossy_puddle.png", 44.1, 3.9, 1.14, 1.06, 0.2, { z: 42, shadow: false });
  b1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 43.9, 3.8, 1.0, 1.0, 0, { z: 90, opacity: 0.88, shadow: false });
  // Authentic Berlin Kellerabteile Slatted Pine Tenant Storage Dividers + Packed Clutter!
  b1.obj("modular-suite/props/subterranean_caves/sub_cellar_wooden_slatted_partition.png", 39.4, 3.25, 2.25, 0.75, 0, { z: 64 });
  b1.obj("modular-suite/props/subterranean_caves/sub_cellar_wooden_slatted_partition.png", 38.8, 8.9, 2.4, 0.8, Math.PI / 2, { z: 64 });
  // NW Tenant Storage Cages & Root/Jar Shelves (x: 34.4..37.6, y: 3.3..6.2 & 37.3..40.9, y: 0.9..5.0)
  b1.obj("modular-suite/props/subterranean_caves/sub_slatted_keller_storage_pile.png", 39.2, 1.85, 1.55, 1.24, 0, { z: 62 });
  b1.obj("modular-suite/props/subterranean_caves/sub_cellar_rolled_carpets_trunk.png", 37.0, 4.0, 1.35, 1.08, 0.1, { z: 62 });
  b1.obj("modular-suite/props/subterranean_caves/sub_preserved_jars_pantry_shelf.png", 39.4, 4.35, 1.4, 0.8, FACE_N, { z: 62 });
  b1.obj("modular-suite/props/subterranean_caves/sub_slatted_keller_storage_pile.png", 35.3, 5.2, 1.48, 1.18, 0.15, { z: 62 });
  b1.obj("modular-suite/modular/crate_open_coal.png", 34.7, 3.8, 0.85, 0.85, 0.25, { z: 62 });
  b1.obj("modular-suite/modular/barrel_open_water.png", 40.2, 2.2, 0.78, 0.78, 0, { z: 62 });
  b1.obj("modular-suite/props/armory_dungeon/arm_rusty_bucket.png", 36.7, 5.7, 0.64, 0.59, 0.3, { z: 62 });
  b1.obj("modular-suite/modular/dec_cobweb_corner.png", 34.5, 3.4, 0.9, 0.9, 0, { z: 75, shadow: false, opacity: 0.72 });
  b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_iron.png", 34.45, 4.8, 0.54, 0.54, FACE_E, { z: 76, shadow: false });
  // SW Locked Unit 4A Smuggler's Storage Cage (x: 30.8..35.3, y: 6.7..10.7) -> HIDDEN TRAPDOOR TO B2 SMUGGLER CACHE!
  b1.obj("objects/slum_scrap_crates.png", 31.8, 7.6, 1.05, 1.05, 0.1, { z: 62 });
  b1.obj("modular-suite/props/subterranean_caves/sub_cellar_rolled_carpets_trunk.png", 31.8, 9.75, 1.38, 1.1, -0.1, { z: 62 });
  b1.obj("modular-suite/modular/crate_walnut_iron.png", 34.3, 7.45, 0.88, 0.88, 0.2, { z: 62 });
  b1.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 33.4, 7.3, 0.82, 0.78, 0.4, { z: 54, shadow: false });
  b1.obj("modular-suite/props/subterranean_caves/sub_secret_floor_trapdoor_rug.png", 33.2, 8.9, 1.08, 1.08, 0, { z: 48, shadow: false });
  b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_oil_reflector_wall.png", 34.8, 9.8, 0.52, 0.52, FACE_W, { z: 76, shadow: false });
  // Central & East Kellerabteile Hallway Clutter (x: 36..41.8, y: 6.8..10.6)
  b1.obj("modular-suite/props/messy_apartment/apt_cardboard_moving_boxes.png", 37.3, 9.65, 1.35, 1.18, -0.2, { z: 62 });
  b1.obj("modular-suite/props/subterranean_caves/sub_cellar_rolled_carpets_trunk.png", 40.3, 9.8, 1.35, 1.08, 0.1, { z: 62 });
  b1.obj("modular-suite/modular/crate_pine_slatted.png", 36.8, 7.5, 0.84, 0.84, 0.15, { z: 62 });
  b1.obj("modular-suite/modular/sack_burlap_lg.png", 37.7, 7.4, 0.82, 0.82, -0.3, { z: 62 });
  b1.obj("modular-suite/props/district_streets/str_split_firewood_rack.png", 41.3, 9.9, 1.24, 0.72, 0, { z: 62 });
  b1.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 39.8, 7.6, 0.94, 0.8, 0, { z: 42, shadow: false });

  b1.light("B1 Tenement Boiler Furnace", 45.2, 2.5, 6.8, "#FF742E", 0.95, { flicker: true });
  b1.light("B1 Tenement NW Cages Bulkhead", 35.6, 4.8, 5.0, "#FFBE6B", 0.82);
  b1.light("B1 Tenement Hallway Bulkhead", 40.1, 6.4, 5.6, "#FFBE6B", 0.86);
  b1.light("B1 Smuggler Cage Oil Lamp", 34.2, 9.3, 4.8, "#FFA94D", 0.8, { flicker: true });
  b1.note("SECRET", 33.2, 8.9, "B1 · Unit 4A Smuggler Trapdoor", "Inside the padlocked SW cellar cage of 42 Eisenbahnstraße, a frayed carpet hides a steel-hinged hatch descending directly to the B2 Counterfeit & Smuggler Cache!", "#F59E0B");

  // -------------------------------------------------------------------------
  // B1-4. NW CORNER BLOCK — BAKERY FLOUR VAULT & ROOT CELLAR (under dd-shape-floor-1-13)
  // -------------------------------------------------------------------------
  const nwPoly = insetPoly(getBuildingPoly("dd-shape-floor-1-13"), 0.88);
  if (nwPoly.length >= 4) {
    b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", nwPoly);
    b1.wall("modular-suite/walls/wall_cellar_brick.png", nwPoly, { closed: true, thickness: 0.2 });
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 8.8, 14.4, 1.02, 1.48, -Q, { z: 54 });
    // West Wing (x: 2..7, y: 6..13): Flour barrels, dough trough, root bins, firewood & wine rack!
    b1.obj("modular-suite/props/subterranean_caves/sub_root_cellar_potato_bins.png", 5.2, 10.6, 1.65, 1.18, 0.55, { z: 62 });
    b1.obj("modular-suite/props/subterranean_caves/sub_wine_cask_rack_double.png", 3.6, 8.4, 1.6, 1.1, 0.6, { z: 62 });
    b1.obj("modular-suite/props/bakery/bak_open_flour_barrel.png", 2.3, 6.9, 0.88, 0.89, 0, { z: 62 });
    b1.obj("modular-suite/modular/barrel_open_grain.png", 3.2, 6.4, 0.84, 0.84, 0, { z: 62 });
    b1.obj("modular-suite/modular/dec_flour_spill.png", 3.0, 7.3, 1.1, 1.1, 0.4, { z: 42, shadow: false, opacity: 0.85 });
    b1.obj("modular-suite/props/bakery/bak_dough_trough.png", 4.7, 8.2, 1.24, 0.8, 0.55, { z: 62 });
    b1.obj("modular-suite/props/bakery/bak_flour_sack.png", 7.2, 12.5, 0.85, 0.85, 0.2, { z: 62 });
    b1.obj("modular-suite/props/bakery/bak_flour_sack.png", 6.3, 12.1, 0.85, 0.85, -0.4, { z: 62 });
    b1.obj("modular-suite/modular/sack_flour_white.png", 6.7, 13.4, 0.82, 0.82, 0.5, { z: 62 });
    b1.obj("modular-suite/props/bakery/bak_wooden_bread_peel.png", 7.6, 15.8, 0.42, 1.06, 0.6, { z: 62 });
    b1.obj("modular-suite/props/district_streets/str_split_firewood_rack.png", 9.4, 16.5, 1.32, 0.76, -Q, { z: 62 });
    // East Wing (x: 10.5..17.2, y: 7.2..13.4): Pickled jars, potato bins, jam crates, sacks & drain!
    b1.obj("modular-suite/props/subterranean_caves/sub_root_cellar_potato_bins.png", 12.6, 11.2, 1.65, 1.18, -Q, { z: 62 });
    b1.obj("modular-suite/props/subterranean_caves/sub_preserved_jars_pantry_shelf.png", 14.6, 8.8, 1.45, 0.83, -Q, { z: 62 });
    b1.obj("modular-suite/modular/crate_pine_slatted.png", 15.8, 9.6, 0.86, 0.86, -Q, { z: 62 });
    b1.obj("modular-suite/modular/barrel_open_flour.png", 16.5, 8.8, 0.84, 0.84, 0, { z: 62 });
    b1.obj("modular-suite/modular/sack_burlap_lg.png", 14.4, 10.6, 0.84, 0.84, 0.3, { z: 62 });
    b1.obj("modular-suite/props/bakery/bak_jam_honey_jars.png", 11.3, 12.6, 0.88, 0.45, -Q, { z: 64 });
    b1.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 9.6, 12.6, 0.94, 0.8, 0, { z: 42, shadow: false });
    b1.obj("modular-suite/modular/dec_cobweb_corner.png", 17.0, 8.2, 0.9, 0.9, 0.4, { z: 75, shadow: false, opacity: 0.72 });
    // Tree roots from Kiezpark poking through the damp north masonry wall!
    b1.obj("modular-suite/props/subterranean_caves/sub_cave_hanging_roots_canopy.png", 8.6, 11.4, 1.4, 1.3, 0.2, { z: 68 });
    b1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_copper_kitchen_pendant.png", 9.6, 12.6, 1.0, 1.0, 0, { z: 90, opacity: 0.88, shadow: false });
    b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_oil_reflector_wall.png", 4.8, 9.4, 0.54, 0.54, 0.55, { z: 76, shadow: false });
    b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_oil_reflector_wall.png", 14.8, 10.8, 0.54, 0.54, -Q, { z: 76, shadow: false });
    b1.light("B1 Bakery Root Cellar Pendant", 9.6, 12.6, 6.2, "#FFC26B", 0.88, { flicker: true });
    b1.light("B1 NW Cellar Wine Alcove", 4.8, 9.6, 5.2, "#FFB347", 0.82, { flicker: true });
    b1.light("B1 NE Bakery Pantry Wing", 14.8, 9.8, 5.2, "#FFC26B", 0.82, { flicker: true });
  }

  // -------------------------------------------------------------------------
  // B1-5. TRAMWAY SHOP CELLAR (1-12) + SECRET TUNNEL TO ROUND PUMP-HOUSE (1-11)!
  // -------------------------------------------------------------------------
  const shop12Poly = insetPoly(getBuildingPoly("dd-shape-floor-1-12"), 0.88);
  const pump11Center = { x: 34.75, y: 17.75 };
  const pump11Poly = worldCircle(pump11Center.x, pump11Center.y, 2.55, 24);
  if (shop12Poly.length >= 4) {
    b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", shop12Poly);
    b1.floorPoly("modular-suite/terrain/dungeon_floor_sewer_brick.png", pump11Poly);
    // Secret brick utility tunnel linking Shop 1-12 cellar to Round Pump-House 1-11!
    b1.floorPoly("modular-suite/terrain/dungeon_floor_sewer_brick.png", rect(28.4, 16.7, 32.5, 18.7));
    const wS12 = b1.wall("modular-suite/walls/wall_cellar_brick.png", shop12Poly, { closed: true, thickness: 0.18 });
    const wP11 = b1.wall("walls/aether_conduit_bulkhead.png", pump11Poly, { closed: true, thickness: 0.22 });
    b1.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 29.1, y: 16.7 }, { x: 32.3, y: 16.7 }], { thickness: 0.16 });
    b1.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 29.1, y: 18.7 }, { x: 32.3, y: 18.7 }], { thickness: 0.16 });
    // Secret bookcase pivot aligned flush along Shop 1-12's SE diagonal wall edge + steel hatch into Pump-House
    b1.portal("modular-suite/portals/harmony/door_secret_library_walnut.png", 29.1, 17.7, -Q, "door", 1.15, true, wS12);
    b1.portal("core-fantasy/portals/iron_dungeon_door.png", 32.22, 17.75, Math.PI / 2, "door", 1.05, true, wP11);

    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 25.0, 14.0, 0.99, 1.44, Q, { z: 54 });
    b1.obj("objects/tool_workbench.png", 22.8, 16.8, 1.85, 0.95, -Q, { z: 62 });
    b1.obj("modular-suite/props/harmony_lighting/lgt_table_articulated_brass_lamp.png", 22.7, 16.7, 0.46, 0.46, -Q, { z: 68, shadow: false });
    b1.obj("modular-suite/props/blacksmith/bs_open_toolbox.png", 21.1, 18.1, 0.8, 0.77, 0.3, { z: 62 });
    b1.obj("modular-suite/props/armory_dungeon/arm_oil_barrel.png", 20.5, 17.4, 0.82, 0.83, 0, { z: 62 });
    b1.obj("modular-suite/props/blacksmith/bs_chain_rope_coil.png", 28.1, 17.9, 0.78, 0.81, 0.2, { z: 62 });
    b1.obj("modular-suite/modular/crate_walnut_iron.png", 24.4, 15.5, 0.88, 0.88, -Q, { z: 62 });
    b1.obj("modular-suite/props/subterranean_caves/sub_dusty_wine_bottle_shelf.png", 27.6, 15.8, 1.35, 0.72, Q, { z: 62 });
    b1.obj("modular-suite/modular/crate_oak_md.png", 26.2, 15.6, 0.95, 0.95, 0.3, { z: 62 });
    b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_oil_reflector_wall.png", 28.4, 16.9, 0.52, 0.52, FACE_S, { z: 76, shadow: false });

    // Round Pump-House B1: Monumental Brass Gear Pump-Well + Descending Iron Shaft Ladder to B2 & B3!
    b1.obj("modular-suite/props/subterranean_caves/sub_aether_pump_gear_well.png", pump11Center.x, pump11Center.y, 2.7, 2.7, 0, { z: 56 });
    b1.obj("modular-suite/props/subterranean_caves/sub_iron_shaft_ladder_down.png", 36.25, 17.75, 0.82, 0.82, FACE_W, { z: 66, shadow: false });
    b1.obj("modular-suite/props/sewers_alleys/sew_pipe_wheel_valve.png", 33.4, 16.3, 0.72, 0.72, 0.3, { z: 64 });
    b1.obj("modular-suite/modular/dec_water_puddle_lg.png", 33.8, 19.3, 1.15, 1.15, 0.2, { z: 42, shadow: false, opacity: 0.74 });
    b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", 34.75, 15.45, 0.56, 0.56, FACE_S, { z: 76, shadow: false });
    b1.light("B1 Clockmaker Cellar Workbench", 22.8, 16.8, 5.4, "#FFD08A", 0.86);
    b1.light("B1 Secret Tunnel Sconce", 28.8, 17.6, 4.4, "#FFB85C", 0.76, { flicker: true });
    b1.light("B1 Municipal Pump-House Shaft", pump11Center.x, pump11Center.y, 5.8, "#38BDF8", 0.92);
    b1.note("SECRET", 34.75, 17.75, "B1 · Watchtower Pump-House Shaft (B3 ↔ 1F)", "Spinning brass gears drive the district's water mains directly beneath Wachturm Ost. The east-rim iron ladder climbs UP through a padlocked floor hatch into the 1F Watchtower Guardroom — and descends DOWN to the B2 Brick Sewer Cistern and B3 Underground Crystal Lake!", "#38BDF8");
  }

  // -------------------------------------------------------------------------
  // B1-5b. EAST COURTYARD COACHHOUSE & WHEELWRIGHT CELLAR (12th basement, under dd-shape-floor-1-14!)
  // -------------------------------------------------------------------------
  const b114Poly = insetPoly(getBuildingPoly("dd-shape-floor-1-14"), 0.88);
  if (b114Poly.length >= 4) {
    b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", b114Poly);
    b1.wall("modular-suite/walls/wall_cellar_brick.png", b114Poly, { closed: true, thickness: 0.18 });
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 40.4, 15.0, 0.96, 1.4, FACE_E, { z: 54 });
    b1.obj("modular-suite/props/subterranean_caves/sub_cellar_rolled_carpets_trunk.png", 42.3, 14.3, 1.32, 1.06, 0.08, { z: 62 });
    b1.obj("modular-suite/props/district_streets/str_split_firewood_rack.png", 44.3, 14.0, 1.28, 0.74, 0, { z: 62 });
    b1.obj("modular-suite/modular/barrel_lying_oak.png", 46.2, 14.2, 1.15, 0.79, 0, { z: 62 });
    b1.obj("modular-suite/props/armory_dungeon/arm_oil_barrel.png", 47.0, 15.6, 0.82, 0.83, 0, { z: 62 });
    b1.obj("modular-suite/modular/crate_open_straw.png", 45.2, 15.8, 0.86, 0.86, 0.2, { z: 62 });
    b1.obj("modular-suite/props/blacksmith/bs_open_toolbox.png", 43.2, 15.8, 0.8, 0.77, -0.3, { z: 62 });
    b1.obj("modular-suite/modular/sack_burlap_lg.png", 41.8, 15.9, 0.84, 0.84, 0.4, { z: 62 });
    b1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 44.0, 15.0, 1.0, 1.0, 0, { z: 90, opacity: 0.88, shadow: false });
    b1.light("B1 Coachhouse Cellar Pendant", 44.0, 15.0, 5.8, "#FFC26B", 0.86);
  }

  // -------------------------------------------------------------------------
  // B1-6. 4 DIAGONAL BOULEVARD TOWNHOUSES (1-6, 1-5, 1-4, 1-3) + BREWERY (1-10) + STILL (1-7)
  // -------------------------------------------------------------------------
  // 1-6: Merchant's Wine Cellar & Counting Vault (with hidden stairs down to B2 Velvet Engine Speakeasy!)
  const b16Poly = insetPoly(getBuildingPoly("dd-shape-floor-1-6"), 0.84);
  if (b16Poly.length >= 4) {
    b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", b16Poly);
    b1.wall("modular-suite/walls/wall_cellar_brick.png", b16Poly, { closed: true, thickness: 0.18 });
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 24.4, 28.1, 0.99, 1.44, Q, { z: 54 });
    b1.obj("modular-suite/props/subterranean_caves/sub_wine_cask_rack_double.png", 21.8, 30.8, 1.65, 1.13, Q, { z: 62 });
    b1.obj("modular-suite/props/subterranean_caves/sub_dusty_wine_bottle_shelf.png", 26.2, 30.8, 1.5, 0.8, -Q, { z: 62 });
    b1.obj("modular-suite/modular/barrel_lying_dark.png", 22.4, 29.3, 1.12, 0.77, -Q, { z: 62 });
    b1.obj("core-fantasy/objects/chest_closed.png", 25.4, 32.8, 1.04, 0.78, -Q, { z: 62 });
    b1.obj("modular-suite/modular/crate_open_straw.png", 21.8, 32.4, 0.84, 0.84, 0.3, { z: 62 });
    b1.obj("modular-suite/modular/bare_oak_round_table.png", 24.0, 31.4, 1.05, 1.05, 0, { z: 60 });
    b1.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 23.1, 31.4, 0.66, 0.7, FACE_E, { z: 56 });
    b1.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 24.9, 31.4, 0.66, 0.7, FACE_W, { z: 56 });
    b1.obj("modular-suite/colorable/col_wine_carafe.png", 24.3, 31.2, 0.42, 0.42, 0.2, { z: 66, shadow: false, recolor: VELVET_CRIMSON });
    b1.obj("modular-suite/props/harmony_lighting/lgt_table_beeswax_saucer_cluster.png", 23.85, 31.5, 0.44, 0.44, 0, { z: 68, shadow: false });
    b1.obj("modular-suite/props/subterranean_caves/sub_secret_floor_trapdoor_rug.png", 23.6, 33.4, 1.0, 1.0, -Q, { z: 48, shadow: false });
    b1.obj("modular-suite/modular/dec_cobweb_corner.png", 20.6, 31.0, 0.85, 0.85, 0, { z: 75, shadow: false, opacity: 0.7 });
    b1.light("B1 Merchant Wine Cellar", 24.0, 31.4, 5.4, "#FFB85C", 0.86, { flicker: true });
  }

  // 1-5: Working-Class Laundry & Coal Wash-Cellar
  const b15Poly = insetPoly(getBuildingPoly("dd-shape-floor-1-5"), 0.84);
  if (b15Poly.length >= 4) {
    b1.floorPoly("modular-suite/terrain/dungeon_floor_sewer_brick.png", b15Poly);
    b1.wall("modular-suite/walls/wall_cellar_brick.png", b15Poly, { closed: true, thickness: 0.18 });
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 31.1, 32.2, 0.99, 1.44, Q, { z: 54 });
    b1.obj("modular-suite/props/subterranean_caves/sub_copper_wash_boiler_tub.png", 28.4, 35.6, 1.35, 1.14, 0, { z: 62 });
    b1.obj("modular-suite/props/messy_apartment/apt_clothesline_drying_rack.png", 31.4, 36.2, 1.55, 0.92, -Q, { z: 64 });
    b1.obj("objects/coal_sack_pile.png", 32.8, 34.4, 1.12, 0.98, 0.4, { z: 62 });
    b1.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 29.5, 37.6, 0.86, 0.79, 0.25, { z: 62 });
    b1.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 30.6, 38.4, 0.82, 0.76, -0.4, { z: 62 });
    b1.obj("modular-suite/props/bedroom_home/home_washstand_basin.png", 27.6, 34.0, 1.02, 0.81, -Q, { z: 62 });
    b1.obj("modular-suite/modular/barrel_open_water.png", 29.4, 33.4, 0.82, 0.82, 0, { z: 62 });
    b1.obj("modular-suite/props/armory_dungeon/arm_rusty_bucket.png", 28.4, 36.9, 0.64, 0.59, 0.2, { z: 62 });
    b1.obj("modular-suite/props/district_streets/str_split_firewood_rack.png", 33.6, 35.5, 1.2, 0.7, -Q, { z: 62 });
    b1.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 30.1, 35.4, 0.96, 0.81, -Q, { z: 42, shadow: false });
    b1.obj("modular-suite/modular/dec_water_puddle_lg.png", 29.6, 36.2, 1.2, 1.2, 0.3, { z: 40, shadow: false, opacity: 0.75 });
    b1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 30.5, 35.5, 1.0, 1.0, 0, { z: 90, opacity: 0.88, shadow: false });
    b1.light("B1 Wash-Cellar Pendant", 30.5, 35.5, 5.4, "#FFD280", 0.86);
  }

  // 1-4: Antiquarian's Dusty Crate & Relic Cellar
  const b14Poly = insetPoly(getBuildingPoly("dd-shape-floor-1-4"), 0.84);
  if (b14Poly.length >= 4) {
    b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", b14Poly);
    b1.wall("modular-suite/walls/wall_cellar_brick.png", b14Poly, { closed: true, thickness: 0.18 });
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 35.8, 38.4, 0.99, 1.44, Q, { z: 54 });
    b1.obj("modular-suite/props/subterranean_caves/sub_slatted_keller_storage_pile.png", 34.2, 41.2, 1.55, 1.24, Q, { z: 62 });
    b1.obj("modular-suite/props/subterranean_caves/sub_cellar_rolled_carpets_trunk.png", 34.0, 39.4, 1.35, 1.08, -Q, { z: 62 });
    b1.obj("core-fantasy/hero/hero_library_bookcase.png", 37.9, 39.8, 1.45, 0.94, Q, { z: 64 });
    b1.obj("modular-suite/props/temple_ritual/tmp_stone_gargoyle.png", 37.8, 41.6, 1.1, 0.95, -Q, { z: 64 });
    b1.obj("modular-suite/props/funeral/fun_marble_cremation_urn.png", 36.1, 40.3, 0.72, 0.62, 0.3, { z: 62 });
    b1.obj("core-fantasy/objects/chest_closed.png", 35.3, 42.9, 1.02, 0.77, Q, { z: 62 });
    b1.obj("modular-suite/modular/crate_oak_md.png", 36.6, 42.8, 1.0, 1.0, 0.3, { z: 62 });
    b1.obj("modular-suite/colorable/col_spellbook_tome.png", 36.4, 42.6, 0.44, 0.44, -0.3, { z: 66, shadow: false, recolor: ROYAL_VIOLET });
    b1.obj("modular-suite/props/harmony_lighting/lgt_lantern_brass_camp.png", 36.75, 42.9, 0.44, 0.44, 0, { z: 68, shadow: false });
    b1.obj("modular-suite/modular/dec_cobweb_corner.png", 32.8, 40.6, 0.9, 0.9, 0.2, { z: 75, shadow: false, opacity: 0.72 });
    b1.light("B1 Antiquarian Cellar Lantern", 36.4, 42.0, 5.4, "#FFB85C", 0.86, { flicker: true });
  }

  // 1-3: Cobbler/Tailor Dye Cellar + SECRET BRICKED-UP ARCHWAY down to B2 Cult of the Pale Root Shrine!
  const b13Poly = insetPoly(getBuildingPoly("dd-shape-floor-1-3"), 0.84);
  if (b13Poly.length >= 4) {
    b1.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", b13Poly);
    const wB13 = b1.wall("modular-suite/walls/wall_cellar_brick.png", b13Poly, { closed: true, thickness: 0.18 });
    // False partition hiding the ancient cult descent stair on the SW side!
    const wCultSec = b1.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 40.6, y: 45.6 }, { x: 43.2, y: 43.0 }], { thickness: 0.16 });
    b1.portal("modular-suite/portals/harmony/door_secret_stone_pivot.png", 41.9, 44.3, -Q, "door", 1.05, true, wCultSec);
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 43.2, 42.3, 0.99, 1.44, Q, { z: 54 });
    // Secret descending stair behind false brick wall leading directly to B2 Cult Shrine!
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 40.8, 46.2, 1.02, 1.48, -3 * Q, { z: 54 });
    b1.obj("modular-suite/props/subterranean_caves/sub_copper_wash_boiler_tub.png", 45.2, 45.2, 1.3, 1.1, 0, { z: 62 });
    // Tailor's colorful dye vats & stacked wool/silk fabric bolts!
    b1.obj("modular-suite/colorable/col_dye_vat_jar.png", 43.9, 44.4, 0.78, 0.78, 0, { z: 62, recolor: VELVET_CRIMSON });
    b1.obj("modular-suite/colorable/col_dye_vat_jar.png", 44.7, 43.7, 0.78, 0.78, 0.4, { z: 62, recolor: ROYAL_VIOLET });
    b1.obj("modular-suite/colorable/col_dye_vat_jar.png", 46.2, 45.8, 0.78, 0.78, -0.3, { z: 62, recolor: AMBER_CRYSTAL });
    b1.obj("modular-suite/colorable/col_fabric_bolt_a.png", 43.1, 46.6, 0.74, 0.74, -Q, { z: 62, recolor: VELVET_CRIMSON });
    b1.obj("modular-suite/colorable/col_fabric_bolt_b.png", 43.8, 47.6, 0.74, 0.74, Q, { z: 62, recolor: EMERALD_CULT });
    b1.obj("modular-suite/modular/barrel_open_water.png", 45.9, 44.4, 0.82, 0.82, 0, { z: 62 });
    b1.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 43.8, 45.6, 0.92, 0.78, -Q, { z: 42, shadow: false });
    b1.obj("modular-suite/props/blacksmith/bs_carpenter_workbench.png", 44.8, 47.2, 1.68, 1.1, -Q, { z: 62 });
    b1.obj("modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png", 44.8, 47.2, 0.44, 0.44, 0, { z: 68, shadow: false });
    b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_iron_triple.png", 42.4, 48.2, 0.54, 0.54, -Q, { z: 76, shadow: false });
    b1.light("B1 Tailor Dye-Cellar Lamp", 44.6, 46.4, 5.6, "#FFB85C", 0.88, { flicker: true });
    b1.note("SECRET", 41.9, 44.3, "B1 · Bricked-Up Cult Archway to B2", "Fresh mortar hides a pivoting brick slab in the SW corner of the tailor's dye cellar, opening onto wet stone stairs descending to the B2 Cult of the Pale Root Shrine!", "#10B981");
    void wB13;
  }

  // 1-10: Courtyard Brewery Keg-Aging & Copper Mash Tun Cellar
  const b110Poly = insetPoly(getBuildingPoly("dd-shape-floor-1-10"), 0.9);
  if (b110Poly.length >= 4) {
    b1.floorPoly("modular-suite/terrain/dungeon_floor_sewer_brick.png", b110Poly);
    b1.wall("modular-suite/walls/wall_cellar_brick.png", b110Poly, { closed: true, thickness: 0.18 });
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 31.4, 25.0, 0.99, 1.44, FACE_E, { z: 54 });
    // Twin bubbling copper mash tuns + oak keg racks + hops & malt sacks + drainage grate!
    b1.obj("modular-suite/props/subterranean_caves/sub_brewery_copper_mash_tun.png", 33.8, 25.0, 1.65, 1.65, 0, { z: 64 });
    b1.obj("modular-suite/props/subterranean_caves/sub_brewery_copper_mash_tun.png", 41.8, 23.6, 1.55, 1.55, 0.9, { z: 64 });
    for (const bx of [36.2, 38.6]) {
      b1.obj("modular-suite/props/subterranean_caves/sub_wine_cask_rack_double.png", bx, 24.4, 1.75, 1.2, 0, { z: 62 });
    }
    b1.obj("modular-suite/modular/barrel_lying_oak.png", 36.2, 26.0, 1.12, 0.77, 0, { z: 62 });
    b1.obj("modular-suite/modular/barrel_open_grain.png", 38.6, 26.0, 0.84, 0.84, 0, { z: 62 });
    b1.obj("modular-suite/modular/sack_burlap_lg.png", 40.3, 25.9, 0.85, 0.85, 0.25, { z: 62 });
    b1.obj("modular-suite/modular/sack_burlap_lg.png", 40.9, 25.2, 0.82, 0.82, -0.4, { z: 62 });
    b1.obj("core-fantasy/objects/ale_barrel.png", 39.8, 23.5, 0.88, 0.88, 0, { z: 62 });
    b1.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 35.1, 25.6, 0.96, 0.81, 0, { z: 42, shadow: false });
    b1.obj("modular-suite/modular/dec_water_puddle_lg.png", 37.4, 25.6, 1.15, 1.15, 0.2, { z: 40, shadow: false, opacity: 0.72 });
    b1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_iron_dome_pendant.png", 34.8, 25.0, 1.0, 1.0, 0, { z: 90, opacity: 0.88, shadow: false });
    b1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_iron_dome_pendant.png", 40.2, 24.4, 1.0, 1.0, 0, { z: 90, opacity: 0.88, shadow: false });
    b1.light("B1 Brewery Mash Pendant W", 34.8, 25.0, 5.8, "#FFB85C", 0.88, { flicker: true });
    b1.light("B1 Brewery Mash Pendant E", 40.4, 24.4, 5.8, "#FF9E48", 0.88, { flicker: true });
  }

  // 1-7: SE Hinterhof Bootlegger's Moonshine Still Cellar
  const b17Poly = insetPoly(getBuildingPoly("dd-shape-floor-1-7"), 0.86);
  if (b17Poly.length >= 4) {
    b1.floorPoly("modular-suite/terrain/forge_soot_flagstone.png", b17Poly);
    b1.wall("modular-suite/walls/wall_cellar_brick.png", b17Poly, { closed: true, thickness: 0.18 });
    b1.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 45.6, 29.8, 0.94, 1.36, FACE_W, { z: 54 });
    b1.obj("modular-suite/props/subterranean_caves/sub_moonshine_copper_still.png", 42.6, 33.4, 1.85, 1.38, -Q, { z: 64 });
    b1.obj("modular-suite/props/subterranean_caves/sub_dusty_wine_bottle_shelf.png", 44.6, 32.0, 1.35, 0.72, -Q, { z: 62 });
    b1.obj("modular-suite/modular/barrel_lying_oak.png", 43.6, 31.0, 1.12, 0.77, -Q, { z: 62 });
    b1.obj("modular-suite/modular/sack_burlap_lg.png", 41.2, 34.8, 0.84, 0.84, 0.3, { z: 62 });
    b1.obj("modular-suite/modular/crate_pine_slatted.png", 42.2, 34.9, 0.82, 0.82, -0.2, { z: 62 });
    b1.obj("modular-suite/props/district_streets/str_split_firewood_rack.png", 44.4, 30.2, 1.14, 0.66, -Q, { z: 62 });
    b1.obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 41.6, 34.1, 0.88, 0.84, 0.4, { z: 54, shadow: false });
    b1.obj("modular-suite/props/harmony_lighting/lgt_sconce_oil_reflector_wall.png", 41.3, 33.8, 0.54, 0.54, FACE_E, { z: 76, shadow: false });
    b1.light("B1 Bootlegger Still Glow", 42.6, 33.4, 5.4, "#FF9442", 0.88, { flicker: true });
  }

  // =========================================================================
  // LEVEL B2 (-28ft) — HIDDEN 2ND-LEVEL VAULTS, BLACK-SITE, SPEAKEASY & SEWERS
  // =========================================================================
  const b2 = makeSubBuilder("b2");

  // -------------------------------------------------------------------------
  // B2-1. MUNICIPAL FLOODED BRICK SEWER CANAL & PUMP CISTERN (connecting B2 secrets!)
  // -------------------------------------------------------------------------
  // Main sewer corridor winding beneath the district from Tenement Breach -> Pump Cistern -> Central Courtyard -> Speakeasy Grate!
  b2.floorPoly("modular-suite/terrain/dungeon_floor_sewer_brick.png", rect(33.2, 11.2, 36.4, 24.5));
  b2.floorPoly("modular-suite/terrain/dungeon_floor_sewer_brick.png", rect(22.5, 22.0, 36.4, 25.0));
  b2.floorPoly("modular-suite/terrain/dungeon_floor_sewer_brick.png", worldCircle(34.75, 17.75, 3.3, 24));
  // Dark murky sewer water canal running down the middle of the vaulted brick tunnel!
  b2.b.water.push(
    {
      id: "sub-b2-sewer-canal-ns",
      kind: "swamp",
      shape: "river",
      widthCells: 1.65,
      curved: false,
      textureAssetId: "core-fantasy/terrain/deep_pond_water.png",
      points: [
        { x: 34.75, y: 11.4 },
        { x: 34.75, y: 23.5 },
        { x: 22.7, y: 23.5 },
      ],
      deepColorHex: "#13292C",
      shallowColorHex: "#244745",
      rimColorHex: "#3C6356",
      opacity: 0.92,
      rippleIntensity: 0.35,
      causticsIntensity: 0.18,
      depthFeather: 0.35,
      shoreBankIntensity: 0.45,
      coastRoughness: 0.12,
    },
  );
  // Brick sewer tunnel walls + outfall grates + iron footbridges!
  b2.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 33.2, y: 11.2 }, { x: 33.2, y: 15.0 }], { thickness: 0.22 });
  b2.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 36.4, y: 11.2 }, { x: 36.4, y: 15.0 }], { thickness: 0.22 });
  b2.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 33.2, y: 20.5 }, { x: 33.2, y: 22.0 }, { x: 22.5, y: 22.0 }], { thickness: 0.22 });
  b2.wall("modular-suite/walls/wall_cellar_brick.png", [{ x: 36.4, y: 20.5 }, { x: 36.4, y: 25.0 }, { x: 22.5, y: 25.0 }], { thickness: 0.22 });
  b2.obj("modular-suite/props/subterranean_caves/sub_aether_pump_gear_well.png", 34.75, 17.75, 2.75, 2.75, 0.35, { z: 58 });
  b2.obj("modular-suite/props/subterranean_caves/sub_iron_shaft_ladder_down.png", 36.35, 17.75, 0.82, 0.82, FACE_W, { z: 68, shadow: false });
  b2.obj("modular-suite/props/subterranean_caves/sub_sewer_iron_catwalk_bridge.png", 34.75, 13.6, 2.35, 1.4, 0, { z: 64 });
  b2.obj("modular-suite/props/subterranean_caves/sub_sewer_iron_catwalk_bridge.png", 29.2, 23.5, 2.35, 1.4, Math.PI / 2, { z: 64 });
  b2.obj("modular-suite/props/subterranean_caves/sub_sewer_pipe_outfall_grate.png", 34.75, 11.55, 1.4, 1.05, FACE_S, { z: 64, shadow: false });
  // Rich municipal sewer atmosphere: sump grates, pipe valves, drifted barrels/crates, puddles & cobwebs!
  b2.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 33.6, 17.8, 0.96, 0.81, 0, { z: 44, shadow: false });
  b2.obj("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 31.8, 22.6, 0.92, 0.78, 0, { z: 44, shadow: false });
  b2.obj("modular-suite/props/sewers_alleys/sew_pipe_wheel_valve.png", 33.4, 16.0, 0.72, 0.72, 0.4, { z: 64 });
  b2.obj("modular-suite/modular/barrel_lying_dark.png", 32.8, 19.6, 1.08, 0.74, 0.6, { z: 62 });
  b2.obj("modular-suite/modular/crate_open_straw.png", 25.4, 22.5, 0.82, 0.82, -0.2, { z: 62 });
  b2.obj("modular-suite/modular/dec_stone_crack_moss.png", 26.8, 24.4, 1.15, 1.15, 0.3, { z: 42, shadow: false, opacity: 0.82 });
  b2.obj("modular-suite/modular/dec_cobweb_corner.png", 36.0, 24.5, 0.9, 0.9, 0.5, { z: 75, shadow: false, opacity: 0.75 });
  b2.obj("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_iron.png", 33.48, 13.5, 0.56, 0.56, FACE_E, { z: 76, shadow: false });
  b2.obj("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_iron.png", 29.2, 22.26, 0.56, 0.56, FACE_S, { z: 76, shadow: false });
  b2.obj("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_iron.png", 24.2, 22.26, 0.56, 0.56, FACE_S, { z: 76, shadow: false });
  b2.light("B2 Pump Cistern Aether Glow", 34.75, 17.75, 6.5, "#38BDF8", 0.9);
  b2.light("B2 Sewer Junction Bulkhead", 29.2, 23.5, 5.5, "#9BE8C8", 0.76);
  b2.light("B2 Sewer Speakeasy Grate Lamp", 24.2, 23.4, 4.6, "#9BE8C8", 0.72);

  // -------------------------------------------------------------------------
  // B2-2. CATHEDRAL DEEP B2 (2 LEVELS DEEP!) — SOVEREIGN INQUISITION BLACK-SITE & HERETIC GAOL
  // -------------------------------------------------------------------------
  b2.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", cathRect(-4.4, -6.4, 4.2, 6.4));
  b2.floorPoly("modular-suite/terrain/underdark_shale.png", cathCircle(6.364, 0, 4.3, 28));
  b2.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", cathCircle(-7.07, 7.07, 2.75, 24));
  // Connecting corridor from East Aether-Lift (-7.07, +7.07) into Black-Site
  b2.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", cathRect(-6.8, 2.4, -4.2, 6.8));

  // Perimeter stone walls (joining cleanly to the Violet Apse bulkhead at u=3.8 & Aether-Lift iris at u=-4.4!)
  b2.wallCath("core-fantasy/walls/dungeon_stone_wall.png", [
    [-4.4, 2.4], [-4.4, -6.4], [3.8, -6.4], [3.8, -3.55],
  ], { closed: false, thickness: 0.24 });
  b2.wallCath("core-fantasy/walls/dungeon_stone_wall.png", [
    [3.8, 3.55], [3.8, 6.4], [-4.4, 6.4],
  ], { closed: false, thickness: 0.24 });
  // East Aether-Lift connecting corridor side walls + keyed Aether-Iris security bulkhead!
  b2.wallCath("walls/aether_conduit_bulkhead.png", [[-6.8, 4.4], [-6.8, 2.4], [-4.4, 2.4]], { thickness: 0.2 });
  const wB2LiftGate = b2.wallCath("walls/aether_conduit_bulkhead.png", [[-4.4, 2.4], [-4.4, 6.4]], { thickness: 0.2 });
  b2.portalCath("modular-suite/portals/harmony/door_magipunk_aether_iris.png", -4.4, 4.4, PORTAL_ALONG_V, "door", 1.35, true, wB2LiftGate);
  // Open circular arc for the SW Cursed Relic Quarantine Apse joining EXACTLY at (3.8, -3.45) and (3.8, +3.45)!
  const b2ApseArc: Point2D[] = [];
  for (let i = 0; i <= 28; i++) {
    const rad = -2.21 + (i / 28) * 4.42;
    b2ApseArc.push(cathPt(6.364 + Math.cos(rad) * 4.3, Math.sin(rad) * 4.3));
  }
  b2.wall("core-fantasy/walls/dungeon_stone_wall.png", b2ApseArc, { closed: false, thickness: 0.24 });
  // Open circular arc for East Aether-Lift Chamber joining EXACTLY to (-4.4, +6.4) and (-6.8, +4.4)!
  const b2EastLiftArc: Point2D[] = [];
  for (let i = 0; i <= 24; i++) {
    const rad = -0.25 + (i / 24) * 5.06;
    b2EastLiftArc.push(cathPt(-7.07 + Math.cos(rad) * 2.75, 7.07 + Math.sin(rad) * 2.75));
  }
  b2.wall("walls/aether_conduit_bulkhead.png", b2EastLiftArc, { closed: false, thickness: 0.2 });

  // 5 Iron-Barred Heretic Prison Cells (3 along NW wall v=-6.4..-2.4, 2 along SE wall v=+2.4..+6.4)
  const wCellNW = b2.wallCath("core-fantasy/walls/dungeon_iron_bars.png", [[-3.8, -2.4], [3.6, -2.4]], { thickness: 0.14, blocksLight: false });
  const wCellSE = b2.wallCath("core-fantasy/walls/dungeon_iron_bars.png", [[-3.8, 2.4], [1.6, 2.4]], { thickness: 0.14, blocksLight: false });
  for (const cu of [-1.4, 1.1]) {
    b2.wallCath("core-fantasy/walls/dungeon_stone_wall.png", [[cu, -6.4], [cu, -2.4]], { thickness: 0.16 });
  }
  b2.wallCath("core-fantasy/walls/dungeon_stone_wall.png", [[-1.1, 2.4], [-1.1, 6.4]], { thickness: 0.16 });
  b2.wallCath("core-fantasy/walls/dungeon_stone_wall.png", [[1.6, 2.4], [1.6, 6.4]], { thickness: 0.16 });
  // Iron cell gates, straw pallets, iron shackles, chamber buckets & dried blood trails!
  for (const gu of [-2.6, -0.15, 2.35]) {
    b2.portalCath("core-fantasy/portals/prison_cell_gate.png", gu, -2.4, PORTAL_ALONG_U, "gate", 0.95, true, wCellNW);
    b2.objCath("modular-suite/props/subterranean_caves/sub_iron_barred_cell_pallet.png", gu, -5.0, 1.38, 0.95, FACE_SE, { z: 60 });
    b2.objCath("modular-suite/props/armory_dungeon/arm_rusty_bucket.png", gu + 0.65, -3.55, 0.56, 0.52, 0.2, { z: 60 });
  }
  b2.objCath("modular-suite/props/armory_dungeon/arm_iron_shackles.png", -0.5, -3.6, 0.68, 0.68, 0.4, { z: 58, shadow: false });
  b2.objCath("modular-suite/props/subterranean_caves/sub_scattered_skeleton_remains.png", 2.1, -3.6, 1.05, 0.96, -0.4, { z: 54, shadow: false });
  for (const gu of [-2.4, 0.25]) {
    b2.portalCath("core-fantasy/portals/prison_cell_gate.png", gu, 2.4, PORTAL_ALONG_U, "gate", 0.95, true, wCellSE);
    b2.objCath("modular-suite/props/subterranean_caves/sub_iron_barred_cell_pallet.png", gu, 5.0, 1.38, 0.95, FACE_NW, { z: 60 });
    b2.objCath("modular-suite/props/armory_dungeon/arm_iron_shackles.png", gu - 0.5, 3.6, 0.68, 0.68, -0.3, { z: 58, shadow: false });
  }
  const wB2ApseDoor = b2.wallCath("walls/aether_conduit_bulkhead.png", [[3.8, -3.55], [3.8, 3.55]], { thickness: 0.22 });
  b2.portalCath("modular-suite/portals/harmony/door_magipunk_violet_vault.png", 3.8, 0, PORTAL_ALONG_V, "door", 1.5, true, wB2ApseDoor);

  // Vertically aligned East Aether-Lift (-7.07, 7.07) + Secret Stair landing from B1 Wine Cellar (2.65, 5.1)!
  b2.objCath("modular-suite/props/sovereign_temple/sov_aether_lift_cage.png", -7.07, 7.07, 2.65, 2.65, FACE_NW + Q, { z: 48 });
  b2.objCath("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 2.65, 5.1, 1.1, 1.6, FACE_NW, { z: 54 });
  // Warden's Gaol Desk + Shackled Inquisition Interrogation Table + Weapon Rack + Clockwork Sentinel!
  b2.objCath("modular-suite/modular/bare_walnut_study_desk.png", -2.6, -0.5, 1.55, 0.92, FACE_APSE, { z: 58 });
  b2.objCath("modular-suite/props/harmony_lighting/lgt_table_aether_cyan_desk.png", -2.4, -0.8, 0.44, 0.44, 0, { z: 68, shadow: false });
  b2.objCath("modular-suite/colorable/col_ledger_book.png", -2.5, -0.25, 0.44, 0.44, 0.2, { z: 66, shadow: false, recolor: VELVET_CRIMSON });
  b2.objCath("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -3.45, -0.5, 0.68, 0.72, FACE_APSE, { z: 55 });
  b2.objCath("core-fantasy/hero/hero_weapon_rack.png", -3.45, 1.3, 1.12, 1.04, FACE_APSE, { z: 62 });
  b2.objCath("modular-suite/props/subterranean_caves/sub_inquisition_interrogation_table.png", 0.05, 0.0, 1.78, 1.1, FACE_SE, { z: 64 });
  b2.objCath("modular-suite/modular/dec_blood_spatter.png", 0.25, 0.85, 0.92, 0.92, 0.4, { z: 44, shadow: false, opacity: 0.78 });
  b2.objCath("modular-suite/props/subterranean_caves/sub_sewer_overflow_sludge_grate.png", 0.05, -1.25, 0.96, 0.81, FACE_SE, { z: 42, shadow: false });
  b2.objCath("modular-suite/props/armory_dungeon/arm_wooden_stocks.png", 2.1, 1.15, 1.35, 0.81, FACE_DOOR, { z: 62 });
  b2.objCath("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", 2.65, -1.05, 1.15, 1.05, FACE_DOOR, { z: 74 });
  b2.objCath("modular-suite/props/harmony_lighting/lgt_sconce_aether_violet_sovereign.png", 3.48, -1.55, 0.56, 0.56, FACE_DOOR, { z: 76, shadow: false });
  b2.objCath("modular-suite/props/harmony_lighting/lgt_sconce_aether_violet_sovereign.png", 3.48, 1.55, 0.56, 0.56, FACE_DOOR, { z: 76, shadow: false });
  b2.objCath("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", -5.6, 2.7, 0.54, 0.54, FACE_SE, { z: 76, shadow: false });

  // SW Apse: Cursed Relic Faraday Quarantine Vault + Confiscated Heretic Library + EXACT B2->B3 IRON SHAFT AT (4.5, 0)!
  b2.objCath("modular-suite/props/subterranean_caves/sub_cursed_relic_containment_cage.png", 6.2, -2.4, 1.35, 1.35, 0, { z: 68 });
  b2.objCath("modular-suite/props/subterranean_caves/sub_cursed_relic_containment_cage.png", 6.2, 2.4, 1.35, 1.35, 0, { z: 68 });
  b2.objCath("core-fantasy/hero/hero_library_bookcase.png", 7.8, -3.15, 1.45, 0.94, FACE_SE - 0.3, { z: 64 });
  b2.objCath("core-fantasy/hero/hero_library_bookcase.png", 7.8, 3.15, 1.45, 0.94, FACE_NW + 0.3, { z: 64 });
  b2.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", 9.45, -1.25, 1.36, 0.86, FACE_DOOR + 0.35, { z: 64 });
  b2.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", 9.45, 1.25, 1.36, 0.86, FACE_DOOR - 0.35, { z: 64 });
  b2.objCath("core-fantasy/colorable/arcane_ritual_circle_colorable.png", 6.8, 0, 2.6, 2.6, 0, { z: 42, shadow: false, recolor: ROYAL_VIOLET });
  b2.objCath("modular-suite/props/subterranean_caves/sub_iron_shaft_ladder_down.png", 4.5, 0, 1.05, 1.05, FACE_APSE, { z: 54, shadow: false });
  b2.objCath("modular-suite/props/subterranean_caves/sub_secret_floor_trapdoor_rug.png", 8.8, 0, 1.0, 1.0, FACE_DOOR, { z: 48, shadow: false });
  b2.objCath("modular-suite/props/harmony_lighting/lgt_brazier_sovereign_violet_fire.png", 8.2, -2.1, 0.86, 0.86, 0, { z: 70 });
  b2.objCath("modular-suite/props/harmony_lighting/lgt_brazier_sovereign_violet_fire.png", 8.2, 2.1, 0.86, 0.86, 0, { z: 70 });

  b2.lightCath("B2 Black-Site E-Lift Override", -7.07, 7.07, 6.2, "#38BDF8", 0.92);
  b2.lightCath("B2 Warden Desk Cyan Lamp", -2.2, -0.2, 6.4, "#38BDF8", 0.84);
  b2.lightCath("B2 Interrogation Ember Glow", 0.05, 0.0, 5.2, "#FF7A38", 0.86, { flicker: true });
  b2.lightCath("B2 Gaol Corridor Violet Sconces", 3.0, 0, 5.8, "#C084FC", 0.88);
  b2.lightCath("B2 Cursed Relic Vault Glow", 6.8, 0, 8.6, "#A855F7", 1.18);
  b2.noteCath("AMBUSH", -0.8, -1.75, "B2 · Sovereign Inquisition Black-Site (-28ft)", "Hidden 2nd sub-level below the Cathedral Crypts. Five iron-barred heretic cells, a shackled interrogation table, a patrolling Clockwork Inquisitor, and the Faraday Quarantine Vault hiding an iron descent shaft straight down to the 3rd-level-deep B3 Primordial Leyline Vault!", "#C084FC");

  // -------------------------------------------------------------------------
  // B2-3. "THE VELVET ENGINE" UNDERGROUND SPEAKEASY & THIEVES' GUILD VAULT
  //       (Spans secretly under Ice Cream Express 1-8 AND Merchant House 1-6 + exits to Sewer!)
  // -------------------------------------------------------------------------
  const spkPoly: Point2D[] = [
    { x: 13.8, y: 24.4 }, { x: 18.8, y: 21.8 }, { x: 23.0, y: 23.4 },
    { x: 26.8, y: 29.8 }, { x: 24.4, y: 34.4 }, { x: 20.6, y: 32.8 }, { x: 14.2, y: 27.6 },
  ];
  b2.floorPoly("modular-suite/terrain/funeral_dark_parquet.png", spkPoly);
  const wSpk = b2.wall("modular-suite/walls/wall_cellar_brick.png", spkPoly, { closed: true, thickness: 0.22 });
  // Hidden steel escape grate opening straight into the B2 Brick Sewer Canal at (22.6, 23.5)!
  b2.portal("core-fantasy/portals/iron_sewer_grate.png", 22.6, 23.5, Math.PI / 2, "gate", 1.15, true, wSpk);

  // Aligned entry hatches from B1 Ice Cream Express (15.69, 25.18) AND B1 Merchant Wine Cellar (23.6, 33.4)!
  b2.obj("modular-suite/props/subterranean_caves/sub_iron_shaft_ladder_down.png", 15.69, 25.18, 0.88, 0.88, Q, { z: 54, shadow: false });
  b2.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 23.6, 33.0, 0.99, 1.44, FACE_NW, { z: 54 });
  // Opulent 1920s dark-magipunk speakeasy: Green-Baize Poker Table, Jazz Piano, Velvet Booths, Absinthe Bar & Smuggled Casks!
  b2.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", 19.6, 27.2, 4.4, 2.8, Q, { z: 38, shadow: false, recolor: VELVET_CRIMSON });
  b2.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 22.2, 30.2, 2.6, 2.6, 0, { z: 39, shadow: false, recolor: ROYAL_VIOLET });
  b2.obj("modular-suite/props/subterranean_caves/sub_smuggler_speakeasy_bar.png", 18.4, 24.0, 2.6, 1.44, -Q + 0.15, { z: 62 });
  for (const [sx, sy] of [[17.6, 25.15], [18.55, 24.65], [19.5, 24.15], [20.4, 23.7]]) {
    b2.obj("modular-suite/colorable/col_bar_stool_padded.png", sx, sy, 0.58, 0.58, 0, { z: 58, recolor: VELVET_CRIMSON });
  }
  // SHOWSTOPPER: Octagonal Green-Baize Poker Table surrounded by 4 chairs under green billiard pendant!
  b2.obj("modular-suite/props/subterranean_caves/sub_speakeasy_poker_table_felt.png", 20.3, 27.7, 1.62, 1.62, 0.2, { z: 62 });
  for (const [cx0, cy0, rot] of [
    [19.25, 27.1, -0.5], [21.35, 28.3, 2.6], [19.75, 28.75, 0.9], [20.9, 26.65, -2.2],
  ]) {
    b2.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", cx0, cy0, 0.66, 0.7, rot, { z: 56 });
  }
  b2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_billiard_green_pendant.png", 20.3, 27.7, 1.15, 1.15, 0, { z: 90, opacity: 0.88, shadow: false });
  // West VIP Velvet Lounge Corner (sofa, club armchairs, cabaret coffee table + candle saucer + Tiffany lamp)
  b2.obj("core-fantasy/hero/hero_velvet_sofa.png", 16.5, 28.2, 1.9, 1.11, -Q, { z: 60 });
  b2.obj("modular-suite/colorable/col_armchair_club.png", 17.8, 29.8, 0.95, 0.95, 2.2, { z: 60, recolor: VELVET_CRIMSON });
  b2.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 17.6, 28.6, 0.95, 0.95, 0, { z: 60 });
  b2.obj("modular-suite/colorable/col_wine_carafe.png", 17.8, 28.5, 0.4, 0.4, 0.3, { z: 66, shadow: false, recolor: EMERALD_CULT });
  b2.obj("modular-suite/props/harmony_lighting/lgt_table_beeswax_saucer_cluster.png", 17.45, 28.7, 0.42, 0.42, 0, { z: 68, shadow: false });
  b2.obj("modular-suite/props/harmony_lighting/lgt_floor_tiffany_stained_lamp.png", 15.5, 27.2, 0.82, 0.82, 0, { z: 66 });
  // East Cabaret Booth + Jazz Grand Piano + Brass Gramophone!
  b2.obj("modular-suite/colorable/col_booth_seat.png", 22.8, 25.4, 1.15, 1.15, -Q, { z: 60, recolor: VELVET_CRIMSON });
  b2.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 22.2, 26.3, 0.95, 0.95, 0, { z: 60 });
  b2.obj("modular-suite/props/harmony_lighting/lgt_table_tiffany_sovereign_lamp.png", 22.2, 26.3, 0.44, 0.44, 0, { z: 68, shadow: false });
  b2.obj("core-fantasy/hero/hero_grand_piano.png", 22.6, 29.5, 2.05, 2.05, -Q - 0.3, { z: 64 });
  b2.obj("modular-suite/props/music_theater_tea/mus_brass_gramophone.png", 24.4, 27.8, 0.84, 0.8, 0.4, { z: 64 });
  // South Bootleg Stash & Smuggled Casks near Merchant Cellar stairs + Sewer Grate!
  b2.obj("modular-suite/props/subterranean_caves/sub_moonshine_copper_still.png", 25.1, 30.2, 1.65, 1.24, Q, { z: 62 });
  b2.obj("modular-suite/props/subterranean_caves/sub_wine_cask_rack_double.png", 19.6, 31.3, 1.6, 1.1, -Q, { z: 62 });
  b2.obj("modular-suite/modular/crate_walnut_iron.png", 21.5, 24.2, 0.84, 0.84, 0.3, { z: 62 });
  b2.obj("core-fantasy/hero/hero_open_treasure_chest.png", 21.6, 31.8, 1.12, 1.06, -Q, { z: 64 });
  b2.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 16.4, 23.4, 0.56, 0.56, FACE_SE, { z: 76, shadow: false });
  b2.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 25.6, 28.4, 0.56, 0.56, FACE_NW, { z: 76, shadow: false });
  b2.light("B2 Velvet Engine Absinthe Bar", 18.6, 24.5, 6.2, "#34D399", 0.92);
  b2.light("B2 Velvet Engine Poker Pendant", 20.3, 27.7, 6.6, "#FFB85C", 0.96, { flicker: true });
  b2.light("B2 Velvet Engine Tiffany Corner", 15.8, 27.4, 5.2, "#FF9E64", 0.88);
  b2.light("B2 Velvet Engine Jazz Piano Glow", 23.0, 29.8, 5.6, "#FFC26B", 0.88, { flicker: true });
  b2.note("NOTE", 20.6, 26.2, "B2 · 'The Velvet Engine' Underground Speakeasy (-28ft)", "Hidden 2nd-level smuggler jazz lounge beneath the Ice Cream Express & Merchant Wine Cellar! Serves illegal glowing green aether-absinthe, hosts high-stakes underground poker, features a baby grand piano, and hides a barred escape grate straight into the B2 Brick Sewer Canal.", "#34D399");

  // -------------------------------------------------------------------------
  // B2-4. 42 EISENBAHNSTRASSE TENEMENT B2 (HIDDEN 2ND LEVEL!) — SMUGGLER CACHE & SINKHOLE TO B3 CAVES!
  // -------------------------------------------------------------------------
  const smgPoly = rect(31.2, 7.0, 41.2, 11.4);
  b2.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", smgPoly);
  const wSmg = b2.wall("modular-suite/walls/wall_cellar_brick.png", smgPoly, { closed: true, thickness: 0.22 });
  // Breached archway into B2 Brick Sewer Canal at (34.75, 11.4)!
  b2.portal("core-fantasy/portals/iron_sewer_grate.png", 34.75, 11.4, 0, "gate", 1.35, false, wSmg);
  // Vertically aligned iron shaft ladder arriving straight from B1 Unit 4A Trapdoor (33.2, 8.9)!
  b2.obj("modular-suite/props/subterranean_caves/sub_iron_shaft_ladder_down.png", 33.2, 8.9, 0.88, 0.88, 0, { z: 54, shadow: false });
  // Counterfeit Banknote Press + Stolen Weapons + Black-Market Crates + Gold + ROPE SINKHOLE TO B3 CAVES!
  b2.obj("modular-suite/props/subterranean_caves/sub_counterfeit_printing_press.png", 35.8, 8.2, 1.75, 1.28, 0, { z: 62 });
  b2.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", 35.2, 7.9, 0.44, 0.44, 0, { z: 68, shadow: false });
  b2.obj("core-fantasy/hero/hero_weapon_rack.png", 32.2, 7.75, 1.12, 1.04, 0, { z: 62 });
  b2.obj("objects/dynamite_supply_crate.png", 32.3, 10.4, 0.95, 0.95, 0.2, { z: 62 });
  b2.obj("modular-suite/modular/crate_walnut_iron.png", 33.4, 10.4, 0.88, 0.88, -0.15, { z: 62 });
  b2.obj("modular-suite/modular/crate_pine_slatted.png", 37.6, 7.75, 0.86, 0.86, 0.2, { z: 62 });
  b2.obj("modular-suite/props/subterranean_caves/sub_cellar_rolled_carpets_trunk.png", 31.9, 9.2, 1.18, 0.94, Math.PI / 2, { z: 62 });
  b2.obj("core-fantasy/hero/hero_open_treasure_chest.png", 36.8, 10.2, 1.08, 1.02, -0.25, { z: 64 });
  b2.obj("core-fantasy/objects/coin_hoard.png", 35.7, 10.4, 0.82, 0.82, 0.3, { z: 60, shadow: false });
  b2.obj("modular-suite/props/blacksmith/bs_chain_rope_coil.png", 37.9, 10.2, 0.78, 0.81, 0.2, { z: 62 });
  b2.obj("modular-suite/props/subterranean_caves/sub_rope_sinkhole_descent.png", 39.2, 9.2, 1.85, 1.85, 0, { z: 48, shadow: false });
  b2.obj("modular-suite/modular/dec_cobweb_corner.png", 40.5, 7.6, 0.9, 0.9, 0.2, { z: 75, shadow: false, opacity: 0.72 });
  b2.obj("modular-suite/props/harmony_lighting/lgt_sconce_alley_gas_bracket.png", 39.2, 7.26, 0.54, 0.54, FACE_S, { z: 76, shadow: false });
  b2.light("B2 Counterfeit Press Desk Lamp", 35.4, 8.2, 5.8, "#FFB85C", 0.94);
  b2.light("B2 Smuggler Sinkhole Sconce", 39.2, 8.4, 5.4, "#FFA94D", 0.88, { flicker: true });
  b2.note("SECRET", 39.2, 9.2, "B2 · Smuggler Sinkhole to B3 Caves", "Tenement smugglers knocked through an earthen sinkhole and staked a knotted rope dropping 14 ft straight down into the B3 Abandoned Aether-Crystal Mine & Underground River!", "#F59E0B");

  // -------------------------------------------------------------------------
  // B2-5. SE BOULEVARD B2 (HIDDEN 2ND LEVEL!) — CULT OF THE PALE ROOT SHRINE (under 1-3 & 1-4)
  // -------------------------------------------------------------------------
  const cultPoly: Point2D[] = [
    { x: 35.8, y: 41.2 }, { x: 42.4, y: 39.6 }, { x: 46.4, y: 44.6 },
    { x: 42.8, y: 49.4 }, { x: 36.6, y: 46.4 },
  ];
  b2.floorPoly("core-fantasy/terrain/crypt_mossy_cobble.png", cultPoly);
  b2.wall("core-fantasy/walls/crypt_mossy_wall.png", cultPoly, { closed: true, thickness: 0.24 });
  // Aligned stone stair arriving from B1 Tailor Bricked Archway (40.8, 46.2)
  b2.obj("modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png", 41.2, 46.2, 1.02, 1.48, Q, { z: 54 });
  // SHOWSTOPPER: Cult Ritual Circle crowned by the Bone-Vine Pale Root Altar, Hanging Roots, Glowing Tidepool & Reliquaries!
  b2.obj("core-fantasy/colorable/arcane_ritual_circle_colorable.png", 42.4, 43.4, 3.2, 3.2, 0, { z: 42, shadow: false, recolor: EMERALD_CULT });
  b2.obj("modular-suite/props/subterranean_caves/sub_cult_pale_root_altar.png", 42.4, 43.4, 1.95, 1.58, -0.25, { z: 66 });
  b2.obj("modular-suite/props/subterranean_caves/sub_cave_hanging_roots_canopy.png", 40.4, 40.8, 1.55, 1.45, 0.3, { z: 72 });
  b2.obj("modular-suite/props/subterranean_caves/sub_cave_bioluminescent_tidepool.png", 39.2, 46.6, 1.5, 1.31, 0.4, { z: 44, shadow: false });
  b2.obj("modular-suite/props/subterranean_caves/sub_cave_moss_lichen_patch.png", 43.4, 46.8, 1.55, 1.33, -0.3, { z: 44, shadow: false });
  b2.obj("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_cyan.png", 44.8, 44.8, 1.35, 1.25, 0.3, { z: 64 });
  b2.obj("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_violet.png", 42.2, 40.6, 1.25, 1.15, -0.4, { z: 64 });
  b2.obj("modular-suite/props/subterranean_caves/sub_ossuary_skull_alcove.png", 44.2, 42.2, 1.4, 0.75, Q, { z: 64 });
  b2.obj("modular-suite/props/funeral/fun_closed_coffin.png", 37.2, 42.0, 0.82, 1.35, 0.35, { z: 62 });
  b2.obj("modular-suite/props/subterranean_caves/sub_scattered_skeleton_remains.png", 42.6, 47.9, 1.15, 1.05, 0.6, { z: 54, shadow: false });
  b2.obj("modular-suite/props/district_streets/vigil_candle_cluster_lit.png", 40.4, 44.4, 0.72, 0.72, 0.2, { z: 66 });
  b2.obj("modular-suite/props/district_streets/vigil_candle_cluster_lit.png", 44.2, 43.8, 0.72, 0.72, -0.3, { z: 66 });
  b2.obj("modular-suite/colorable/col_spellbook_tome.png", 42.4, 41.9, 0.46, 0.46, 0.2, { z: 66, shadow: false, recolor: EMERALD_CULT });
  b2.obj("modular-suite/props/subterranean_caves/sub_rope_sinkhole_descent.png", 38.4, 43.6, 1.95, 1.95, 0.8, { z: 48, shadow: false });
  b2.obj("modular-suite/props/harmony_lighting/lgt_brazier_cyan_aether_basin.png", 40.4, 42.2, 0.86, 0.86, 0, { z: 68 });
  b2.obj("modular-suite/props/harmony_lighting/lgt_brazier_cyan_aether_basin.png", 43.8, 46.0, 0.86, 0.86, 0, { z: 68 });
  b2.light("B2 Cult Pale Root Ritual Glow", 42.4, 43.4, 7.6, "#34D399", 1.1);
  b2.light("B2 Cult Cave Fissure Sinkhole", 38.4, 43.6, 5.4, "#38BDF8", 0.86);
  b2.note("HAZARD", 42.4, 40.9, "B2 · Shrine of the Pale Root (-28ft)", "Hidden 2nd-level subterranean cult sanctuary beneath the SE Boulevard rowhouses. Bone-white roots strangle an emerald ichor altar while glowing spores drift up from a jagged rock sinkhole dropping straight into the B3 Fungal Grotto Caves!", "#10B981");

  // =========================================================================
  // LEVEL B3 (-42ft) — 3RD-LEVEL PRIMORDIAL VAULT & NATURAL UNDERGROUND CAVES!
  // =========================================================================
  const b3 = makeSubBuilder("b3");

  // 1. NATIVE `CaveDungeonSystem` CARVING A SPRAWLING 4-CHAMBER LIVING CAVE NETWORK!
  b3.b.caveSystem = {
    id: "sub-b3-natural-caves",
    themeId: "mossy_grotto",
    floorAssetId: "modular-suite/terrain/cave_floor_wet_grotto.png",
    wallAssetId: "modular-suite/walls/cave_mossy_grotto.png",
    wallThicknessCells: 0.72,
    outerRimCells: 0.65,
    outerRimColorHex: "#2F3D36",
    roughness: 0.76,
    blocksLight: true,
    undergroundFill: false,
    undergroundColorHex: "#090D14",
    operations: [
      // Chamber 1 (NE): Abandoned Magipunk Aether-Crystal Mine (directly under B2 Smuggler Sinkhole 39.2, 9.2!)
      {
        id: "cav-op-mine-main",
        kind: "brush",
        points: [{ x: 35.5, y: 8.5 }, { x: 40.5, y: 9.2 }, { x: 42.5, y: 12.5 }, { x: 38.0, y: 15.2 }],
        radiusCells: 3.4,
        organicRoughness: 0.72,
        seed: 3101,
      },
      // Chamber 2 (Center): Giant Flooded Subterranean Crystal Lake & Underground River (directly under Pump-House 34.75, 17.75!)
      {
        id: "cav-op-lake-center",
        kind: "brush",
        points: [
          { x: 35.5, y: 17.5 }, { x: 31.0, y: 21.5 }, { x: 25.5, y: 24.5 },
          { x: 27.5, y: 29.5 }, { x: 34.5, y: 27.0 }, { x: 37.5, y: 21.5 },
        ],
        radiusCells: 4.1,
        organicRoughness: 0.8,
        seed: 3102,
      },
      // Chamber 3 (NW, under Kiezpark!): Hanging-Root Monster Lair & Bone Hoard + Winding Passage from Central Lake!
      {
        id: "cav-op-nw-tunnel",
        kind: "brush",
        points: [{ x: 24.5, y: 23.0 }, { x: 18.5, y: 18.0 }, { x: 13.5, y: 14.5 }, { x: 9.2, y: 12.2 }],
        radiusCells: 2.2,
        organicRoughness: 0.78,
        seed: 3103,
      },
      {
        id: "cav-op-nw-lair",
        kind: "brush",
        points: [{ x: 8.2, y: 11.2 }, { x: 12.5, y: 11.8 }, { x: 10.5, y: 15.8 }],
        radiusCells: 3.3,
        organicRoughness: 0.82,
        seed: 3104,
      },
      // Chamber 4 (SE, under B2 Cult Shrine 38.4, 43.6!): Bioluminescent Fungal Grotto!
      {
        id: "cav-op-se-tunnel",
        kind: "brush",
        points: [{ x: 33.5, y: 29.5 }, { x: 36.5, y: 35.5 }, { x: 38.5, y: 41.5 }],
        radiusCells: 2.35,
        organicRoughness: 0.78,
        seed: 3105,
      },
      {
        id: "cav-op-se-grotto",
        kind: "brush",
        points: [{ x: 38.5, y: 42.5 }, { x: 33.5, y: 44.0 }, { x: 28.5, y: 40.5 }, { x: 32.5, y: 36.5 }],
        radiusCells: 3.8,
        organicRoughness: 0.84,
        seed: 3106,
      },
      // Western Cavern Breach Tunnel cutting ALL THE WAY through the shattered east wall of Cathedral B3 Primordial Vault!
      {
        id: "cav-op-west-breach",
        kind: "brush",
        points: [
          { x: 28.0, y: 40.6 }, { x: 22.8, y: 41.2 }, { x: 17.5, y: 41.8 }, { x: 13.4, y: 42.2 }, { x: 11.1, y: 42.5 },
        ],
        radiusCells: 2.15,
        organicRoughness: 0.75,
        seed: 3107,
      },
      // Carve a natural rock pillar island right in the middle of the Central Underground Lake!
      {
        id: "cav-op-island-erase",
        kind: "erase_brush",
        points: [{ x: 30.8, y: 24.4 }],
        radiusCells: 1.55,
        organicRoughness: 0.82,
        seed: 3108,
      },
    ],
    entrances: [
      {
        id: "cav-ent-vault-breach",
        x: 9.25,
        y: 42.5,
        normalRad: Math.PI,
        widthCells: 4.0,
        fadeLengthCells: 1.8,
        thresholdStyle: "rock_mouth",
        markerLabel: "Vault Breach",
        showMarker: false,
        markerDmOnly: true,
      },
    ],
  };

  // 2. SHIMMERING UNDERGROUND CRYSTAL RIVER & FLOODED CAVERN LAKE (`WaterRegion` on B3!)
  b3.b.water.push(
    {
      id: "sub-b3-crystal-lake",
      kind: "water",
      shape: "polygon",
      textureAssetId: "modular-suite/terrain/water_alpine_crystal.png",
      points: [
        { x: 24.5, y: 22.8 }, { x: 29.8, y: 19.6 }, { x: 34.4, y: 20.6 },
        { x: 35.8, y: 25.8 }, { x: 32.0, y: 29.2 }, { x: 26.2, y: 29.0 }, { x: 23.6, y: 25.6 },
      ],
      deepColorHex: "#0B3A4D",
      shallowColorHex: "#1E8FA8",
      rimColorHex: "#5EEAD4",
      opacity: 0.9,
      rippleIntensity: 0.6,
      causticsIntensity: 0.58,
      depthFeather: 0.55,
      shoreBankIntensity: 0.45,
      coastRoughness: 0.42,
    },
    {
      id: "sub-b3-grotto-stream",
      kind: "water",
      shape: "river",
      widthCells: 1.9,
      curved: true,
      textureAssetId: "modular-suite/terrain/water_alpine_crystal.png",
      points: [
        { x: 31.5, y: 27.5 },
        { x: 34.8, y: 33.8 },
        { x: 34.5, y: 39.8 },
        { x: 29.6, y: 41.2 },
        { x: 23.4, y: 41.2 },
      ],
      deepColorHex: "#0B3A4D",
      shallowColorHex: "#2094A8",
      rimColorHex: "#5EEAD4",
      opacity: 0.88,
      rippleIntensity: 0.55,
      causticsIntensity: 0.52,
      depthFeather: 0.48,
      shoreBankIntensity: 0.4,
      coastRoughness: 0.36,
    },
  );

  // 3. CATHEDRAL B3 (3 LEVELS DEEP!) — THE PRIMORDIAL SOVEREIGN VAULT & LEYLINE HEART!
  b3.floorPoly("modular-suite/terrain/underdark_shale.png", cathCircle(6.364, 0, 5.1, 30));
  b3.floorPoly("core-fantasy/terrain/volcanic_basalt.png", cathRect(-2.2, -4.4, 4.8, 4.4));
  // Ancient cyclopean obsidian vault walls WITH A WIDE SHATTERED BREACH OPENING AT u=-2.2, v=-1.4..+1.8 STRAIGHT INTO THE CAVES!
  b3.wallCath("core-fantasy/walls/dungeon_stone_wall.png", [
    [-2.2, -1.5], [-2.2, -4.4], [4.5, -4.4], [4.5, -3.8],
  ], { thickness: 0.28 });
  b3.wallCath("core-fantasy/walls/dungeon_stone_wall.png", [
    [-2.2, 1.8], [-2.2, 4.4], [4.5, 4.4], [4.5, 3.8],
  ], { thickness: 0.28 });
  // Curved SW apse obsidian sanctuary wall joining cleanly to u=4.5, v=±4.4!
  const b3ApseArc: Point2D[] = [];
  for (let i = 0; i <= 28; i++) {
    const rad = -1.96 + (i / 28) * 3.92;
    b3ApseArc.push(cathPt(6.364 + Math.cos(rad) * 5.05, Math.sin(rad) * 5.05));
  }
  b3.wall("core-fantasy/walls/dungeon_stone_wall.png", b3ApseArc, { closed: false, thickness: 0.3 });
  // Vertically aligned iron shaft ladder arriving straight from B2 Cursed Relic Quarantine Vault (4.5, 0)!
  b3.objCath("modular-suite/props/subterranean_caves/sub_iron_shaft_ladder_down.png", 4.5, 0, 1.05, 1.05, FACE_APSE, { z: 54, shadow: false });
  // SHOWSTOPPER: The Blazing Primordial Obsidian Aether Leyline Rift feeding the entire 5-story Cathedral above!
  b3.objCath("modular-suite/props/subterranean_caves/sub_primordial_leyline_rift.png", 7.3, 0, 3.8, 3.04, FACE_DOOR, { z: 52, shadow: false });
  b3.objCath("modular-suite/props/subterranean_caves/sub_cave_ancient_runestone_shrine.png", 0.5, 0, 2.3, 2.3, 0, { z: 60 });
  b3.objCath("modular-suite/props/subterranean_caves/sub_sarcophagus_lid_ajar.png", 6.2, -3.2, 1.75, 1.2, FACE_SE, { z: 64 });
  b3.objCath("modular-suite/props/subterranean_caves/sub_stone_sarcophagus_carved.png", 6.2, 3.2, 1.75, 1.1, FACE_NW, { z: 64 });
  b3.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", 9.6, -2.1, 1.4, 0.89, FACE_SE - 0.5, { z: 64 });
  b3.objCath("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", 9.6, 2.1, 1.4, 0.89, FACE_NW + 0.5, { z: 64 });
  b3.objCath("core-fantasy/hero/hero_open_treasure_chest.png", 3.2, -3.4, 1.12, 1.06, FACE_SE, { z: 64 });
  b3.objCath("core-fantasy/objects/coin_hoard.png", 3.2, 3.4, 1.05, 1.05, 0.3, { z: 60, shadow: false });
  b3.objCath("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", 2.2, -2.5, 1.2, 1.1, FACE_SE, { z: 74 });
  b3.objCath("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", 2.2, 2.5, 1.2, 1.1, FACE_NW, { z: 74 });
  b3.objCath("modular-suite/props/harmony_lighting/lgt_brazier_sovereign_violet_fire.png", -0.8, -2.6, 0.92, 0.92, 0, { z: 68 });
  b3.objCath("modular-suite/props/harmony_lighting/lgt_brazier_sovereign_violet_fire.png", -0.8, 2.6, 0.92, 0.92, 0, { z: 68 });
  // SHATTERED BREACH THRESHOLD: Tumbled obsidian masonry rubble, crystals & cavern rocks framing the seamless passage into the caves!
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_breached_masonry_rubble.png", 10.6, 40.6, 2.35, 1.48, 0.35, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_breached_masonry_rubble.png", 12.2, 44.0, 2.35, 1.48, -0.45, { z: 66 });
  b3.obj("modular-suite/props/mining_cavern/min_cavern_rubble.png", 13.8, 41.2, 1.2, 1.19, 0.4, { z: 56, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_crystal_vein_amethyst_lg.png", 15.2, 40.3, 1.5, 1.3, 0.4, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_stalagmite_cluster_lg.png", 16.0, 43.8, 1.45, 1.45, -0.3, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_violet.png", 19.6, 42.6, 1.25, 1.15, 0.2, { z: 64 });
  // FIXED BRIDGE ORIENTATION: Spans cleanly NORTH-TO-SOUTH across the horizontal underground blue river!
  b3.obj("modular-suite/props/subterranean_caves/sub_rickety_cave_plank_bridge.png", 23.4, 41.2, 2.55, 1.35, Math.PI / 2, { z: 66 });

  // 4. POPULATE ALL 4 NATURAL UNDERGROUND CAVE CHAMBERS WITH RICH LIVED-IN DETAILS!
  // ── Chamber 1 (NE): Abandoned Magipunk Aether-Crystal Mine (under Tenement B2 Sinkhole!) ──
  // Rail spline cleanly routed SOUTH of the (39.2, 9.2) Rope Sinkhole so rails never cross the open shaft!
  b3.spline("modular-suite/paths/path_mine_cart_rails.png", [
    { x: 34.4, y: 10.4 }, { x: 38.2, y: 11.4 }, { x: 42.0, y: 12.8 }, { x: 38.4, y: 15.6 },
  ], 1.15, { curved: true });
  b3.obj("modular-suite/props/subterranean_caves/sub_rope_sinkhole_descent.png", 39.2, 9.2, 1.75, 1.75, 0, { z: 48, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_mine_wooden_ore_chute_hopper.png", 42.2, 10.6, 1.65, 1.43, 0.35, { z: 64 });
  b3.obj("modular-suite/props/mining_cavern/min_mine_cart_ore.png", 41.2, 12.5, 1.25, 1.0, 0.55, { z: 64 });
  b3.obj("modular-suite/props/mining_cavern/min_mine_cart_empty.png", 36.2, 10.9, 1.18, 0.98, 0.22, { z: 64 });
  b3.obj("modular-suite/props/mining_cavern/min_rail_bumper_stop.png", 34.1, 10.3, 1.0, 0.95, FACE_W, { z: 62 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_crystal_vein_cyan_lg.png", 43.4, 12.4, 1.7, 1.47, -0.3, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_crystal_vein_cyan_lg.png", 36.2, 8.6, 1.45, 1.26, 0.7, { z: 66 });
  b3.obj("modular-suite/props/mining_cavern/min_timber_support_beam.png", 40.4, 14.3, 1.5, 0.67, -0.5, { z: 64 });
  b3.obj("modular-suite/props/mining_cavern/min_timber_support_beam.png", 35.6, 12.5, 1.5, 0.67, 0.25, { z: 64 });
  b3.obj("modular-suite/props/mining_cavern/min_ore_coal_mound.png", 41.6, 8.1, 1.35, 1.1, 0.2, { z: 62 });
  b3.obj("modular-suite/props/mining_cavern/min_cavern_rubble.png", 37.6, 14.2, 1.18, 1.17, 0.3, { z: 54, shadow: false });
  b3.obj("modular-suite/modular/crate_open_coal.png", 36.6, 7.6, 0.88, 0.88, 0.2, { z: 62 });
  b3.obj("modular-suite/props/armory_dungeon/arm_gunpowder_keg.png", 38.8, 7.4, 0.82, 0.82, 0, { z: 62 });
  b3.obj("objects/dynamite_supply_crate.png", 37.8, 7.6, 0.95, 0.95, 0.3, { z: 62 });
  b3.obj("modular-suite/props/blacksmith/bs_open_toolbox.png", 39.8, 13.0, 0.78, 0.75, -0.4, { z: 62 });
  b3.obj("modular-suite/props/mining_cavern/min_iron_pickaxe.png", 39.2, 12.6, 0.75, 0.75, 0.5, { z: 65 });
  b3.obj("modular-suite/props/harmony_lighting/lgt_floor_tavern_iron_tripod.png", 38.2, 10.2, 0.84, 0.84, 0, { z: 68 });
  b3.obj("modular-suite/props/harmony_lighting/lgt_lantern_railroad_brass.png", 37.8, 7.6, 0.44, 0.44, 0, { z: 68, shadow: false });

  // ── Chamber 2 (Center): Subterranean Crystal Lake, Smuggler Pier Jetty, Pump Ladder & Rowboat! ──
  b3.obj("modular-suite/props/subterranean_caves/sub_iron_shaft_ladder_down.png", 34.75, 17.75, 0.92, 0.92, 0, { z: 64, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_wooden_smuggler_jetty.png", 33.9, 19.65, 2.2, 1.34, -0.55, { z: 62 });
  b3.obj("modular-suite/props/subterranean_caves/sub_smuggler_rowboat_moored.png", 31.8, 21.1, 2.15, 1.21, -0.5, { z: 66 });
  b3.obj("modular-suite/props/docks_streets/doc_coiled_hawser.png", 35.2, 19.1, 0.8, 0.81, 0.2, { z: 64 });
  b3.obj("modular-suite/props/docks_streets/doc_crossed_oars.png", 35.8, 20.3, 0.95, 0.94, -0.4, { z: 64 });
  b3.obj("modular-suite/modular/crate_walnut_iron.png", 36.2, 18.6, 0.88, 0.88, 0.3, { z: 62 });
  b3.obj("modular-suite/modular/barrel_lying_oak.png", 37.1, 21.2, 1.12, 0.77, -0.35, { z: 62 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_stepping_stones_wet.png", 26.2, 26.4, 1.85, 1.32, 0.3, { z: 54, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_pillar_column.png", 30.8, 24.4, 2.35, 2.35, 0.2, { z: 72 });
  b3.obj("core-fantasy/objects/coin_hoard.png", 28.8, 25.0, 1.05, 1.05, 0.4, { z: 46, opacity: 0.68, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_crystal_vein_cyan_lg.png", 24.8, 21.8, 1.55, 1.34, 0.5, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_crystal_vein_amethyst_lg.png", 36.8, 23.6, 1.55, 1.34, -0.4, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_colorable_crystal_cluster.png", 29.8, 28.4, 1.35, 1.35, 0.2, { z: 66, recolor: AMBER_CRYSTAL });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_bioluminescent_tidepool.png", 36.2, 26.4, 1.65, 1.44, 0.2, { z: 46, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_stalagmite_cluster_lg.png", 37.8, 19.6, 1.5, 1.5, 0.4, { z: 66 });
  b3.obj("core-fantasy/objects/mossy_boulder.png", 27.6, 20.2, 1.25, 1.25, 0.3, { z: 64 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_moss_lichen_patch.png", 25.4, 24.4, 1.7, 1.46, 0.3, { z: 46, shadow: false });

  // ── Chamber 3 (NW, under Kiezpark): Hanging-Root Monster Lair & Buried Hoard! ──
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_hanging_roots_canopy.png", 9.4, 10.6, 2.1, 1.96, 0.3, { z: 74 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_hanging_roots_canopy.png", 12.6, 13.4, 1.8, 1.68, -0.6, { z: 74 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_bone_hoard_pile.png", 10.4, 13.6, 1.95, 1.67, 0.2, { z: 64 });
  b3.obj("core-fantasy/objects/coin_hoard.png", 9.2, 14.8, 1.05, 1.05, -0.4, { z: 60, shadow: false });
  b3.obj("core-fantasy/objects/chest_closed.png", 11.4, 15.6, 1.06, 0.8, 0.35, { z: 62 });
  b3.obj("modular-suite/props/subterranean_caves/sub_scattered_skeleton_remains.png", 15.8, 16.4, 1.35, 1.24, -0.5, { z: 54, shadow: false });
  b3.obj("modular-suite/props/mining_cavern/min_spider_egg_sac.png", 7.8, 13.6, 1.1, 1.1, 0.3, { z: 64 });
  b3.obj("modular-suite/props/mining_cavern/min_spider_egg_sac.png", 11.4, 9.8, 0.95, 0.95, -0.4, { z: 64 });
  b3.obj("modular-suite/props/mining_cavern/min_corner_cobweb.png", 7.2, 10.4, 1.15, 1.15, 0, { z: 75, shadow: false, opacity: 0.78 });
  b3.obj("modular-suite/modular/dec_cobweb_span.png", 14.6, 14.8, 1.35, 1.35, 0.6, { z: 75, shadow: false, opacity: 0.72 });
  b3.obj("core-fantasy/hero/hero_boulder_cluster.png", 7.4, 12.2, 1.48, 1.41, 0.4, { z: 64 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_moss_lichen_patch.png", 12.2, 12.2, 1.6, 1.37, 0.2, { z: 46, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_stalagmite_cluster_lg.png", 13.2, 10.4, 1.55, 1.55, 0.5, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_violet.png", 18.4, 18.2, 1.35, 1.25, 0.2, { z: 64 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_violet.png", 9.0, 12.6, 1.15, 1.06, -0.5, { z: 64 });

  // ── Chamber 4 (SE, under Cult Shrine B2): Bioluminescent Fungal Grotto! ──
  b3.obj("modular-suite/props/subterranean_caves/sub_rope_sinkhole_descent.png", 38.4, 43.6, 1.85, 1.85, 0.8, { z: 48, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_cyan.png", 35.6, 44.8, 1.75, 1.62, 0.2, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_cyan.png", 31.6, 45.2, 1.45, 1.34, -0.5, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_violet.png", 31.6, 37.8, 1.75, 1.62, -0.4, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_colorable_glow_shrooms.png", 39.8, 40.6, 1.55, 1.43, 0.5, { z: 66, recolor: EMERALD_CULT });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_bioluminescent_tidepool.png", 37.6, 38.6, 1.75, 1.53, -0.3, { z: 46, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_bioluminescent_tidepool.png", 29.4, 43.6, 1.65, 1.44, 0.5, { z: 46, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_moss_lichen_patch.png", 33.4, 42.6, 1.9, 1.63, -0.3, { z: 46, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_moss_lichen_patch.png", 28.6, 39.2, 1.75, 1.5, 0.6, { z: 46, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_stalagmite_cluster_lg.png", 36.2, 36.4, 1.5, 1.5, 0.2, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_pillar_column.png", 31.2, 43.2, 1.85, 1.85, -0.4, { z: 70 });
  b3.obj("modular-suite/props/mining_cavern/min_glowing_pool.png", 36.6, 41.2, 1.6, 1.45, 0.3, { z: 48, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_crystal_vein_amethyst_lg.png", 27.4, 42.2, 1.5, 1.3, 0.7, { z: 66 });
  b3.obj("modular-suite/props/subterranean_caves/sub_cave_crystal_vein_cyan_lg.png", 34.4, 32.8, 1.45, 1.26, -0.3, { z: 66 });
  b3.obj("core-fantasy/objects/mossy_boulder.png", 38.4, 46.0, 1.25, 1.25, 0.2, { z: 64 });
  b3.obj("modular-suite/modular/crate_open_straw.png", 39.8, 42.8, 0.92, 0.92, -0.2, { z: 62 });
  b3.obj("modular-suite/props/harmony_lighting/lgt_lantern_brass_camp.png", 39.8, 42.8, 0.44, 0.44, 0, { z: 68, shadow: false });
  b3.obj("modular-suite/props/subterranean_caves/sub_scattered_skeleton_remains.png", 33.8, 39.4, 1.3, 1.2, 0.8, { z: 54, shadow: false });

  // B3 Atmospheric Bioluminescent, Crystal, Mine-Lantern & Primordial Leyline Dynamic Lighting!
  b3.lightCath("B3 Primordial Leyline Rift", 7.3, 0, 10.5, "#A855F7", 1.35);
  b3.lightCath("B3 Ancient Sovereign Runestone", 0.5, 0, 7.6, "#38BDF8", 1.02);
  b3.light("B3 Vault Breach Violet Glimmer", 12.2, 42.4, 6.2, "#C084FC", 0.92);
  b3.light("B3 Abandoned Mine Tripod Lantern", 38.2, 10.2, 7.4, "#FFB85C", 0.95, { flicker: true });
  b3.light("B3 Mine Cyan Crystal Vein", 42.6, 11.4, 7.2, "#38BDF8", 0.98);
  b3.light("B3 Crystal Lake Central Glow", 30.2, 23.6, 9.8, "#38BDF8", 1.08);
  b3.light("B3 Smuggler Jetty & Boat Lantern", 33.4, 20.2, 6.0, "#FFD08A", 0.9, { flicker: true });
  b3.light("B3 Fungal Grotto Cyan Mushrooms", 35.6, 44.4, 8.8, "#2DD4BF", 1.1);
  b3.light("B3 Fungal Grotto Violet Spore Glow", 31.6, 38.2, 8.0, "#C084FC", 0.98);
  b3.light("B3 NW Monster Lair Spore Glimmer", 10.4, 13.4, 7.2, "#A78BFA", 0.84);

  b3.noteCath("HAZARD", 7.1, 2.8, "B3 · Primordial Sovereign Leyline Rift (-42ft)", "Three full levels below the Cathedral! A raw obsidian tear in the earth powers the Sovereign's entire temple 100 ft overhead. The east wall collapsed straight into the natural underground caves.", "#A855F7");
  b3.note("NOTE", 30.6, 21.8, "B3 · Subterranean Crystal Lake & Smuggler Boat", "Flooded limestone cavern fed by the underground aquifer. A moored rowboat lets explorers cross between the Abandoned Aether Mine (NE), Bioluminescent Fungal Grotto (SE), Hanging-Root Lair (NW), and Cathedral Breach (SW).", "#38BDF8");
  b3.note("AMBUSH", 10.4, 12.2, "B3 · Hanging-Root Monster Lair", "Roots from Kiezpark pierce the damp earthen ceiling above a bone-strewn hoard of lost coins & rusted gear. Egg sacs pulse in the dark alcoves.", "#F59E0B");
  b3.note("SECRET", 38.4, 43.6, "B3 · Bioluminescent Fungal Grotto", "A jagged rope sinkhole links straight up to the B2 Cult of the Pale Root Shrine, bathing the cavern in eerie turquoise and violet fungal light.", "#2DD4BF");

  // =========================================================================
  // ASSEMBLE PER-LEVEL LAYER STACKS FOR B1, B2 & B3 (ALL initially visible: false!)
  // =========================================================================
  const buildLayers = (levelId: string, code: string, bundle: SubLevelBundle, includeCaves: boolean, includeWater: boolean): MapLayer[] => {
    const out: MapLayer[] = [
      {
        id: `layer-sov-terrain-${code.toLowerCase()}`,
        name: `${code} Cellar & Vault Floors`,
        kind: "terrain",
        visible: false,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        terrainStrokes: bundle.terrain,
      },
    ];
    if (includeCaves && bundle.caveSystem) {
      out.push({
        id: `layer-sov-caves-${code.toLowerCase()}`,
        name: `${code} Natural Underground Caves`,
        kind: "caves",
        visible: false,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        caveSystem: bundle.caveSystem,
      });
    }
    if (includeWater && bundle.water.length > 0) {
      out.push({
        id: `layer-sov-water-${code.toLowerCase()}`,
        name: `${code} Subterranean Water & Canals`,
        kind: "water",
        visible: false,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        waterRegions: bundle.water,
        waterMeshEnabled: true,
        waterBlendRadiusCells: 1.0,
      });
    }
    out.push(
      {
        id: `layer-sov-paths-${code.toLowerCase()}`,
        name: `${code} Rails, Runners & Conduits`,
        kind: "paths",
        visible: false,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        paths: bundle.paths,
      },
      {
        id: `layer-sov-walls-${code.toLowerCase()}`,
        name: `${code} Masonry Walls & Secret Doors`,
        kind: "walls",
        visible: false,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        walls: bundle.walls,
        portals: bundle.portals,
      },
      {
        id: `layer-sov-objects-${code.toLowerCase()}`,
        name: `${code} Subterranean Props & Fixtures`,
        kind: "objects",
        visible: false,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        objects: bundle.objects,
      },
      {
        id: `layer-sov-lights-${code.toLowerCase()}`,
        name: `${code} Lights`,
        kind: "lights",
        visible: false,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        lights: bundle.lights,
      },
      {
        id: `layer-sov-dm-${code.toLowerCase()}`,
        name: `${code} DM Secrets & Notes`,
        kind: "dm_notes",
        visible: false,
        locked: false,
        dmOnly: true,
        opacity: 1,
        blendMode: "normal",
        levelId,
        dmNotes: bundle.dmNotes,
      },
    );
    return out;
  };

  // Avoid unused import warnings on `SLATE_PRISON`
  void SLATE_PRISON;

  return {
    b1Layers: buildLayers("lvl-sov-b1", "B1", b1.b, false, false),
    b2Layers: buildLayers("lvl-sov-b2", "B2", b2.b, false, true),
    b3Layers: buildLayers("lvl-sov-b3", "B3", b3.b, true, true),
  };
}

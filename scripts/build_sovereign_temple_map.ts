/**
 * Builds the 5-Story Dark Magipunk "Cathedral of the Sovereign" directly atop the
 * live-imported `MrRogers.dungeondraft_map`, preserving 100% of the surrounding city
 * streets, tram rails, café, courtyard, gardens, and city roofs while transforming the
 * SW Trefoil Sanctuary into 5 richly lived-in vertical stories (+ Spire Roof):
 *
 *   - 1F (0ft):   Grand Nave, Confessionals, Reliquary Apse & Sovereign High Altar
 *   - 2F (+14ft): Open-Atrium Choir Gallery, Brass Pipe Organ, Scriptorium & Refectory
 *   - 3F (+28ft): Cleric Dormitories, Bathhouse, Apothecary Infirmary & Aether-Core Dynamo
 *   - 4F (+42ft): Forbidden Arcane Archives, High Priest's Suite & Inquisition Scrying Apse
 *   - 5F (+56ft): Open-Air Sky-Walk Terrace, Sovereign's Crown Sanctum, Astral Orrery & Belfry
 *   - ROOF (+70ft): All 17 MrRogers City Roofs + Verdigris Copper & Slate Cathedral Spires
 *
 * Writes:
 *   1. `src/data/sovereignTempleDoc.json` (bundled synchronously for instant tab open)
 *   2. `Temple_of_the_Sovereign.dcmap` (standalone project file in workspace root)
 */

import fs from "node:fs";
import path from "node:path";
import { importDungeondraftMapData } from "@/engine/dungeondraftMapImport";
import { pointInPolygon } from "@/engine/geometry";
import { buildIceCreamTrainShopAndFlat, type IceCreamBuildBundle } from "./iceCreamTrainBuilder";
import { buildMessyApartmentBuilding } from "./messyApartmentBuilder";
import { buildNeighborhoodPark } from "./neighborhoodParkBuilder";
import { buildDistrictStreetsAndVigilStairs } from "./districtStreetsBuilder";
import { buildSubterraneanDistrict } from "./subterraneanBasementsBuilder";
import { buildWatchtowerGarrison } from "./watchtowerBuilder";
import { buildCommunityKidTheater } from "./kidTheaterBuilder";
import { buildAgedStreetcarLineAndWeathering } from "./streetcarLineBuilder";
import { buildBoulevardRowhouses } from "./boulevardRowhousesBuilder";
import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type DmNotePin,
  type LightNode,
  type MapLayer,
  type MapLevel,
  type ObjectStamp,
  type Point2D,
  type PortalNode,
  type RgbRecolor,
  type RoofStructure,
  type SplinePath,
  type TerrainStroke,
  type VaultAsset,
  type WallSegment,
} from "@/types/map";

const S = Math.SQRT1_2; // 0.7071067811865476
const NAVE_X = 9.0;
const NAVE_Y = 44.0;

/**
 * Local temple frame `(u, v)` anchored at Central Nave `(9.0, 44.0)`:
 *  - `+u` runs SW along the sacred nave axis (Entrance Doors = -7.07, Nave = 0, SW Apse Center = +6.36, Apse Back = +10.86)
 *  - `+v` runs SE along the transept axis (N Tower = -7.07, Centerline = 0, E Tower = +7.07)
 */
function pt(u: number, v: number): Point2D {
  return {
    x: Math.round((NAVE_X - S * u + S * v) * 1000) / 1000,
    y: Math.round((NAVE_Y + S * u + S * v) * 1000) / 1000,
  };
}

function rectPoly(u0: number, v0: number, u1: number, v1: number): Point2D[] {
  return [pt(u0, v0), pt(u0, v1), pt(u1, v1), pt(u1, v0)];
}

function circlePoly(cu: number, cv: number, r: number, segs = 28): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push(pt(cu + Math.cos(a) * r, cv + Math.sin(a) * r));
  }
  return out;
}

function octPoly(cu: number, cv: number, r: number): Point2D[] {
  return circlePoly(cu, cv, r, 8);
}

// Cardinal orientations for front-down (+Y) top-down sprites in the 45°-rotated temple:
const FACE_APSE = Math.PI / 4; // Front faces +u (SW toward Apse)
const FACE_DOOR = (-3 * Math.PI) / 4; // Front faces -u (NE toward Entrance Doors)
const FACE_SE = -Math.PI / 4; // Front faces +v (SE across Nave; backs onto NW wall)
const FACE_NW = (3 * Math.PI) / 4; // Front faces -v (NW across Nave; backs onto SE wall)

// Portal/wall alignments (rotationRad = 0 runs along +X):
const PORTAL_ALONG_V = Math.PI / 4; // Wall running parallel to entrance (constant u, varying v)
const PORTAL_ALONG_U = -Math.PI / 4; // Wall running parallel to nave axis (constant v, varying u)

function tint(hex: string, mode: "dd_red" | "tint" = "dd_red", strength = 0.88): RgbRecolor {
  return {
    ...DEFAULT_RECOLOR,
    enabled: true,
    mode,
    tintHex: hex,
    strength,
  };
}

const IMPERIAL_CRIMSON = tint("#8E1B2E", "dd_red", 0.92);
const ROYAL_VIOLET = tint("#6D28D9", "dd_red", 0.92);
const SOVEREIGN_PLUM = tint("#4C1D57", "dd_red", 0.9);
const ANTIQUE_GOLD = tint("#C9973E", "dd_red", 0.88);
const SLATE_NAVY = tint("#2D3A54", "dd_red", 0.9);
const IVORY_WAX = tint("#F5EAD6", "dd_red", 0.85);
const EMERALD_TINCTURE = tint("#10B981", "dd_red", 0.9);

function loadAllCc0VaultAssets(): VaultAsset[] {
  const packs: Array<{ dir: string; prefix: string; srcId: string; srcName: string }> = [
    { dir: "public/assets/starter-cc0", prefix: "", srcId: "src-starter", srcName: "Starter CC0" },
    { dir: "public/assets/core-fantasy-cc0", prefix: "core-fantasy/", srcId: "src-core", srcName: "Core Fantasy CC0" },
    { dir: "public/assets/modular-suite-cc0", prefix: "modular-suite/", srcId: "src-modular", srcName: "Modular Suite CC0" },
  ];
  const out: VaultAsset[] = [];
  for (const p of packs) {
    const manifest = JSON.parse(fs.readFileSync(path.join(p.dir, "manifest.json"), "utf8"));
    for (const a of manifest.assets ?? []) {
      const rel = a.path || a.internalPath || a.id;
      const id = `${p.prefix}${a.id || rel}`;
      out.push({
        id,
        sourceId: p.srcId,
        sourceName: p.srcName,
        sourceKind: "dcpack",
        internalPath: rel,
        url: `/${p.dir.replace(/^public\//, "")}/${rel}`,
        thumbUrl: `/${p.dir.replace(/^public\//, "")}/${rel}`,
        displayName: a.displayName || a.name || rel,
        category: a.category,
        widthPx: a.widthPx || 256,
        heightPx: a.heightPx || 256,
        defaultPpi: a.defaultPpi || 256,
        drawMode: a.drawMode || "normal",
        dominantHex: a.dominantHex || "#64748B",
        castsShadow: a.castsShadow !== false,
        isFavorite: false,
        tags: a.tags || [],
      });
    }
  }
  return out;
}

interface FloorBundle {
  terrain: TerrainStroke[];
  paths: SplinePath[];
  walls: WallSegment[];
  portals: PortalNode[];
  objects: ObjectStamp[];
  lights: LightNode[];
  dmNotes: DmNotePin[];
}

function makeFloorBuilder(tag: string) {
  let seq = 0;
  const uid = (p: string) => `sov-${tag}-${p}-${++seq}`;
  const b: FloorBundle = {
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
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean; recolor?: RgbRecolor } = {},
  ) => {
    const id = uid("wall");
    b.walls.push({
      id,
      assetId,
      points,
      closed: Boolean(opts.closed),
      curved: false,
      thicknessCells: opts.thickness ?? 0.16,
      blocksLight: opts.blocksLight ?? true,
      recolor: opts.recolor,
    });
    return id;
  };

  const wallUV = (
    assetId: string,
    uvPts: Array<[number, number]>,
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean; recolor?: RgbRecolor } = {},
  ) => wall(assetId, uvPts.map(([u, v]) => pt(u, v)), opts);

  const portal = (
    assetId: string,
    u: number,
    v: number,
    rotationRad: number,
    kind: PortalNode["kind"],
    widthCells = 1.15,
    closed = true,
    wallId?: string,
  ) => {
    const p = pt(u, v);
    b.portals.push({
      id: uid("prt"),
      assetId,
      kind,
      wallId,
      x: p.x,
      y: p.y,
      rotationRad,
      widthCells,
      closed,
      locked: false,
      blocksLightWhenClosed: kind !== "window",
    });
  };

  const spline = (
    assetId: string,
    uvPts: Array<[number, number]>,
    widthCells: number,
    opts: { curved?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    b.paths.push({
      id: uid("pth"),
      assetId,
      points: uvPts.map(([u, v]) => pt(u, v)),
      widthCells,
      curved: opts.curved ?? false,
      taperEnds: false,
      fadeEnds: false,
      opacity: opts.opacity ?? 1,
      blocksScatter: false,
      recolor: opts.recolor,
    });
  };

  const obj = (
    assetId: string,
    u: number,
    v: number,
    w: number,
    h: number,
    rot: number,
    opts: {
      z?: number;
      shadow?: boolean;
      flipX?: boolean;
      opacity?: number;
      recolor?: RgbRecolor;
    } = {},
  ) => {
    const p = pt(u, v);
    b.objects.push({
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
      zOrder: opts.z ?? 60,
    });
  };

  const light = (
    name: string,
    u: number,
    v: number,
    radiusCells: number,
    colorHex: string,
    intensity = 1.0,
    opts: { castShadows?: boolean; flicker?: boolean } = {},
  ) => {
    const p = pt(u, v);
    b.lights.push({
      id: uid("lgt"),
      name,
      x: p.x,
      y: p.y,
      radiusCells,
      intensity,
      colorHex,
      castShadows: opts.castShadows ?? true,
      coneAngleDeg: 360,
      directionRad: 0,
      flicker: opts.flicker ?? false,
    });
  };

  const note = (
    badge: DmNotePin["badge"],
    u: number,
    v: number,
    title: string,
    body: string,
    colorHex = "#A855F7",
  ) => {
    const p = pt(u, v);
    b.dmNotes.push({
      id: uid("note"),
      x: p.x,
      y: p.y,
      badge,
      title,
      body,
      colorHex,
    });
  };

  return { b, floorPoly, wall, wallUV, portal, spline, obj, light, note };
}

/** Add stained-glass lancet windows along the outer gothic walls of a floor */
function addGothicCathedralWindows(
  fb: ReturnType<typeof makeFloorBuilder>,
  perimWallId: string,
  includeSideAisles = true,
) {
  if (includeSideAisles) {
    // NW outer wall (v = -7.071)
    for (const u of [-2.4, 0.2, 2.6]) {
      fb.portal("modular-suite/portals/portal_stained_lancet.png", u, -7.071, PORTAL_ALONG_U, "window", 1.5, true, perimWallId);
    }
    // SE outer wall (v = +7.071)
    for (const u of [-2.4, 0.2, 2.6]) {
      fb.portal("modular-suite/portals/portal_stained_lancet.png", u, 7.071, PORTAL_ALONG_U, "window", 1.5, true, perimWallId);
    }
  }
  // SW Main Apse radial lancets (r = 4.5 around (6.364, 0))
  for (const deg of [-55, -20, 20, 55]) {
    const rad = (deg * Math.PI) / 180;
    const u = 6.364 + Math.cos(rad) * 4.48;
    const v = Math.sin(rad) * 4.48;
    // Tangent angle along circle in world space: world angle of radial is (3*pi/4 - rad)
    const tangWorld = Math.PI / 4 - rad;
    fb.portal("modular-suite/portals/portal_stained_lancet.png", u, v, tangWorld, "window", 1.35, true, perimWallId);
  }
}

/** Shared vertical North Spiral Staircase & East Aether-Lift Core anchored identically on all 5 floors */
function addVerticalTowers(
  fb: ReturnType<typeof makeFloorBuilder>,
  floorNum: 1 | 2 | 3 | 4 | 5,
) {
  // NORTH TOWER: Grand Brass Spiral Staircase anchored identically at (-6.35, -6.35) across all 5 floors (1.00x scale, open entry mouth facing DUE SOUTH into Cathedral interior!)
  fb.obj("objects/brass_spiral_staircase.png", -6.35, -6.35, 2.4, 2.4, Math.PI, { z: 45 });
  // Wall-mounted Gothic brass twin-candle sconce anchored flush against the solid NE masonry wall right by the North Tower stair mouth!
  fb.obj("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_brass_twin.png", -6.84, -3.55, 0.60, 0.60, FACE_APSE, {
    z: 76,
    shadow: false,
  });
  fb.light(`N-Tower Sconce (${floorNum}F)`, -6.55, -3.55, 5.5, "#FFB85C", 0.85, { flicker: true });

  // EAST TOWER: Magipunk Vertical Aether-Lift Cage at exact center (-7.07, +7.07), open side facing SW toward Nave!
  fb.obj("modular-suite/props/sovereign_temple/sov_aether_lift_cage.png", -7.07, 7.07, 2.65, 2.65, FACE_NW + Math.PI / 4, {
    z: 48,
  });
  // Wall-mounted cyan aether sconce anchored flush against the solid NE masonry wall right by the East Tower lift mouth!
  fb.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", -6.84, 3.55, 0.60, 0.60, FACE_APSE, {
    z: 76,
    shadow: false,
  });
  fb.light(`E-Tower Aether Lift (${floorNum}F)`, -7.07, 7.07, 6.2, "#38BDF8", 0.92);
}

function main() {
  const vaultAssets = loadAllCc0VaultAssets();
  const validAssetIds = new Set(vaultAssets.map((a) => a.id));

  const rawDd = JSON.parse(fs.readFileSync("MrRogers.dungeondraft_map", "utf8"));
  const { doc } = importDungeondraftMapData(rawDd, vaultAssets, {
    fileName: "MrRogers.dungeondraft_map",
    policy: "cc0_only",
  });

  // Extract the exact 123-vertex SW Trefoil Temple polygon from the imported ground terrain layer
  const groundTerrainLayer = doc.layers.find((l) => l.id === "layer-dd-terrain-1")!;
  const groundWallsLayer = doc.layers.find((l) => l.id === "layer-dd-walls-1")!;
  const groundPathsLayer = doc.layers.find((l) => l.id === "layer-dd-paths-1")!;
  const groundObjectsLayer = doc.layers.find((l) => l.id === "layer-dd-objects-1")!;
  const roofLayer = doc.layers.find((l) => l.kind === "roofs")!;

  const templeFloorIdx = groundTerrainLayer.terrainStrokes!.findIndex(
    (s) => s.id === "dd-shape-floor-1-2",
  );
  if (templeFloorIdx < 0) {
    throw new Error("Could not locate SW Temple polygon (dd-shape-floor-1-2) in imported MrRogers doc!");
  }
  const templePoly: Point2D[] = structuredClone(
    groundTerrainLayer.terrainStrokes![templeFloorIdx].points,
  );

  // Locate & remove the original plain SW Temple wall (123 pts) & its 2 old doors so we replace with dark Gothic chapel stone + brass double doors + stained lancet windows
  const oldTempleWallIdx = groundWallsLayer.walls!.findIndex((w) => w.points.length >= 100);
  if (oldTempleWallIdx >= 0) {
    const oldWallId = groundWallsLayer.walls![oldTempleWallIdx].id;
    groundWallsLayer.walls!.splice(oldTempleWallIdx, 1);
    groundWallsLayer.portals = (groundWallsLayer.portals ?? []).filter((p) => p.wallId !== oldWallId);
  }

  // Upgrade the 1F temple base floor from plain gravel to Veined Grey Mausoleum Marble
  groundTerrainLayer.terrainStrokes![templeFloorIdx].assetId = "modular-suite/terrain/mausoleum_marble.png";

  // =========================================================================
  // FLOOR 1 (0ft) — GRAND NAVE, CONFESSIONALS, RELIQUARY APSE & HIGH ALTAR
  // =========================================================================
  const f1 = makeFloorBuilder("1f");

  // Accent floors inside 1F temple: checkered marble towers + raised Temple Mosaic Apse Dais
  f1.floorPoly("core-fantasy/terrain/mansion_checkered_marble.png", circlePoly(-7.07, -7.07, 2.85, 24));
  f1.floorPoly("core-fantasy/terrain/mansion_checkered_marble.png", circlePoly(-7.07, 7.07, 2.85, 24));
  f1.floorPoly("modular-suite/terrain/temple_mosaic_atrium.png", circlePoly(6.364, 0, 4.35, 32));
  f1.floorPoly("core-fantasy/terrain/castle_keep_ashlar.png", rectPoly(3.5, -3.9, 4.4, 3.9));

  // Perimeter Gothic Chapel Stone Wall (light-blocking!) with grand brass double entry doors & stained lancets
  const w1Perim = f1.wall("modular-suite/walls/wall_chapel_stone.png", templePoly, {
    closed: true,
    thickness: 0.2,
    blocksLight: true,
  });
  // Main Entrance Grand Brass Double Doors at exact portico threshold
  f1.portal("portals/jugendstil_brass_door.png", -7.071, -0.52, PORTAL_ALONG_V, "door", 1.1, true, w1Perim);
  f1.portal("portals/jugendstil_brass_door.png", -7.071, 0.52, PORTAL_ALONG_V, "door", 1.1, true, w1Perim);
  addGothicCathedralWindows(f1, w1Perim, true);

  // Subtle apse chancel railings flanking central steps into the High Altar dais
  f1.wallUV("walls/jugendstil_iron_balustrade.png", [[3.55, -3.85], [3.55, -1.65]], { thickness: 0.12, blocksLight: false });
  f1.wallUV("walls/jugendstil_iron_balustrade.png", [[3.55, 1.65], [3.55, 3.85]], { thickness: 0.12, blocksLight: false });

  // Tower archway frames (short stone pilasters framing N & E rotunda entrances)
  f1.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-4.1, -7.05], [-4.1, -5.6]], { thickness: 0.18, blocksLight: true });
  f1.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-4.1, 5.6], [-4.1, 7.05]], { thickness: 0.18, blocksLight: true });

  // Ceremonial paths: Royal Crimson Processional Carpet + Glowing Twin Aether Conduit Veins
  f1.spline("core-fantasy/paths/royal_crimson_runner.png", [[-6.8, 0], [5.2, 0]], 1.9);
  f1.spline("paths/aether_power_conduit.png", [[-6.5, 6.4], [-4.6, 4.6], [-4.6, 1.15], [5.8, 1.15], [6.6, 0.4]], 0.24, { curved: true });
  f1.spline("paths/aether_power_conduit.png", [[-4.6, -1.15], [5.8, -1.15], [6.6, -0.4]], 0.24, { curved: true });
  // Wide 3:1 Alabaster Marble & Brass Dais Steps spanning the central chancel opening (1.00x native aspect, stepping UP from Nave onto High Altar Dais!)
  f1.obj("modular-suite/props/stairs_architectural/stair_marble_dais_steps.png", 3.55, 0, 3.15, 1.05, FACE_DOOR, {
    z: 44,
  });

  // Vertical tower infrastructure (N Spiral Stair + E Aether-Lift)
  addVerticalTowers(f1, 1);

  // North Tower lived-in vestibule clutter (coat rack, candle crate, sleeping tabby cat on cushion)
  f1.obj("modular-suite/props/school_courtroom/sch_coat_rack_stand.png", -8.8, -7.4, 0.85, 0.85, 0.2, { z: 62 });
  f1.obj("modular-suite/modular/crate_oak_sm.png", -8.5, -5.6, 0.9, 0.9, FACE_APSE + 0.15, { z: 60 });
  f1.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", -5.6, -8.3, 0.72, 0.72, 1.1, { z: 64 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_floor_votive_stand_brass.png", -4.95, -7.65, 0.86, 0.86, FACE_SE, { z: 66 });

  // East Tower Tithe-Collector & Aether Capacitor Substation (clean perimeter clearance around lift cage!)
  f1.obj("objects/crystal_capacitor_bank.png", -8.95, 7.1, 1.35, 0.82, FACE_APSE, { z: 62 });
  f1.obj("modular-suite/modular/bare_walnut_straight_counter.png", -5.4, 5.4, 1.75, 0.7, FACE_APSE + Math.PI / 4, { z: 58 });
  f1.obj("modular-suite/props/post_office/po_open_ledger.png", -5.3, 5.3, 0.55, 0.44, FACE_APSE + 0.8, { z: 68, shadow: false });
  f1.obj("modular-suite/props/post_office/po_brass_desk_bell.png", -5.6, 5.7, 0.36, 0.36, 0, { z: 69, shadow: false });
  f1.obj("modular-suite/modular/chest_iron_md.png", -6.2, 8.95, 0.95, 0.72, FACE_NW, { z: 62 });

  // Entrance Vestibule (u = -6.0..-4.6): Anointing Fonts, Alms, Guardian Statues, Welcome Mats, Clockwork Sentinels
  f1.obj("modular-suite/props/temple_ritual/tmp_baptismal_font.png", -5.6, -2.6, 1.3, 1.3, 0, { z: 62 });
  f1.obj("modular-suite/props/temple_ritual/tmp_baptismal_font.png", -5.6, 2.6, 1.3, 1.3, 0, { z: 62 });
  f1.obj("modular-suite/props/temple_ritual/tmp_offering_plate.png", -6.1, -1.6, 0.65, 0.65, 0, { z: 65 });
  f1.obj("modular-suite/props/temple_ritual/tmp_offering_plate.png", -6.1, 1.6, 0.65, 0.65, 0, { z: 65 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_floor_votive_stand_brass.png", -6.2, -3.5, 0.92, 0.92, FACE_APSE, { z: 66 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_floor_votive_stand_brass.png", -6.2, 3.5, 0.92, 0.92, FACE_APSE, { z: 66 });
  f1.obj("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", -5.2, -1.5, 1.25, 1.15, FACE_DOOR, { z: 75 });
  f1.obj("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", -5.2, 1.5, 1.25, 1.15, FACE_DOOR, { z: 75 });

  // Central Nave Floor Medallion at exact nave center (0, 0)
  f1.obj("modular-suite/props/sovereign_temple/sov_sovereign_seal_floor.png", -0.3, 0, 3.2, 3.2, FACE_DOOR, {
    z: 35,
    shadow: false,
    opacity: 0.92,
  });

  // Two Symmetric Ranks of Carved Oak Chapel Pews (5 rows × 2 sides) + lived-in hymnals, cushions & candles!
  const pewU = [-3.6, -2.3, -1.0, 0.3, 1.6];
  for (let i = 0; i < pewU.length; i++) {
    const u = pewU[i];
    // NW Bank (v = -2.8)
    f1.obj("modular-suite/props/temple_ritual/tmp_wooden_pew.png", u, -2.95, 2.35, 0.95, FACE_APSE, { z: 58 });
    f1.obj("modular-suite/colorable/col_pew_pad.png", u, -2.95, 1.95, 0.55, FACE_APSE, {
      z: 60,
      shadow: false,
      recolor: IMPERIAL_CRIMSON,
    });
    // SE Bank (v = +2.8)
    f1.obj("modular-suite/props/temple_ritual/tmp_wooden_pew.png", u, 2.95, 2.35, 0.95, FACE_APSE, { z: 58 });
    f1.obj("modular-suite/colorable/col_pew_pad.png", u, 2.95, 1.95, 0.55, FACE_APSE, {
      z: 60,
      shadow: false,
      recolor: IMPERIAL_CRIMSON,
    });
    // Lived-in hymnals & forgotten prayer items on select pews
    if (i === 1 || i === 3) {
      f1.obj("modular-suite/props/temple_ritual/tmp_ritual_bell_hymnal.png", u - 0.1, -2.4, 0.48, 0.4, FACE_APSE + 0.25, {
        z: 65,
        shadow: false,
      });
    }
    if (i === 0 || i === 4) {
      f1.obj("modular-suite/colorable/col_hymnal_book.png", u - 0.05, 3.3, 0.42, 0.42, FACE_APSE - 0.3, {
        z: 65,
        shadow: false,
        recolor: SOVEREIGN_PLUM,
      });
    }
  }

  // 6 Massive Nave Stone Pillars + Lit Bronze Temple Tripod Braziers + Overhead Cathedral Wheel Chandeliers + Side Aisle Wall Sconces
  for (const u of [-3.3, -0.5, 2.3]) {
    for (const v of [-4.6, 4.6]) {
      f1.obj("core-fantasy/objects/stone_pillar.png", u, v, 1.1, 1.1, FACE_APSE, { z: 78 });
      f1.obj("modular-suite/props/harmony_lighting/lgt_brazier_bronze_temple_tripod.png", u, v > 0 ? v - 0.9 : v + 0.9, 0.86, 0.86, 0, {
        z: 66,
      });
    }
  }
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_gothic_bronze_wheel.png", -2.2, 0, 2.15, 2.15, FACE_APSE, { z: 92, opacity: 0.88, shadow: false });
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_gothic_bronze_wheel.png", 1.5, 0, 2.15, 2.15, FACE_APSE, { z: 92, opacity: 0.88, shadow: false });
  // Wall-mounted brass cathedral sconces along the NW and SE side aisle walls
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_brass_twin.png", -0.35, -6.78, 0.62, 0.62, FACE_SE, { z: 76, shadow: false });
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_brass_twin.png", -0.35, 6.78, 0.62, 0.62, FACE_NW, { z: 76, shadow: false });

  // NW & SE Side Aisles: Bespoke Gothic Confession Booths + Memorial Reliquaries & Guardian Lions
  f1.obj("modular-suite/props/sovereign_temple/sov_confession_booth.png", -1.9, -5.95, 2.3, 1.55, FACE_SE, { z: 64 });
  f1.obj("modular-suite/props/sovereign_temple/sov_confession_booth.png", 1.2, -5.95, 2.3, 1.55, FACE_SE, { z: 64 });
  f1.obj("modular-suite/props/sovereign_temple/sov_confession_booth.png", -1.9, 5.95, 2.3, 1.55, FACE_NW, { z: 64 });
  f1.obj("modular-suite/props/temple_ritual/tmp_golden_reliquary.png", 1.1, 5.95, 1.25, 0.9, FACE_NW, { z: 64 });
  f1.obj("modular-suite/props/funeral/fun_vigil_candles_roses.png", 2.3, 6.0, 0.72, 0.72, 0, { z: 66 });
  f1.obj("modular-suite/props/temple_ritual/tmp_ornate_prayer_rug.png", 1.1, 5.0, 1.1, 1.55, FACE_SE, {
    z: 42,
    shadow: false,
  });
  // SW Shoulder niches: Carved Weeping Angel & Memorial Urns
  f1.obj("modular-suite/props/funeral/fun_weeping_angel.png", 3.3, -5.8, 1.25, 1.35, FACE_SE + 0.5, { z: 68 });
  f1.obj("modular-suite/props/funeral/fun_weeping_angel.png", 3.3, 5.8, 1.25, 1.35, FACE_NW - 0.5, { z: 68 });

  // SW MAIN APSE (6.364, 0, r=4.5): THE HIGH ALTAR OF THE SOVEREIGN
  f1.obj("modular-suite/props/sovereign_temple/sov_high_altar_aether.png", 7.15, 0, 3.9, 2.0, FACE_DOOR, { z: 72 });
  f1.obj("modular-suite/props/temple_ritual/tmp_wooden_pulpit.png", 4.9, -2.4, 1.35, 1.25, FACE_DOOR + 0.35, { z: 68 });
  f1.obj("modular-suite/props/temple_ritual/tmp_golden_reliquary.png", 6.2, -3.0, 1.25, 0.92, FACE_DOOR + 0.6, { z: 66 });
  f1.obj("modular-suite/props/temple_ritual/tmp_golden_reliquary.png", 6.2, 3.0, 1.25, 0.92, FACE_DOOR - 0.6, { z: 66 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_brass.png", 7.55, -2.45, 0.98, 0.98, 0, { z: 70 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_brass.png", 7.55, 2.45, 0.98, 0.98, 0, { z: 70 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_floor_paschal_altar_pillar.png", 5.95, -2.15, 0.72, 0.72, 0, { z: 70 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_floor_paschal_altar_pillar.png", 5.95, 2.15, 0.72, 0.72, 0, { z: 70 });
  f1.obj("modular-suite/props/temple_ritual/tmp_smoking_censer.png", 5.5, -1.65, 0.72, 0.68, 0.4, { z: 68 });
  f1.obj("modular-suite/props/temple_ritual/tmp_smoking_censer.png", 5.5, 1.65, 0.72, 0.68, -0.4, { z: 68 });
  f1.obj("modular-suite/props/temple_ritual/tmp_lion_statue.png", 4.35, -3.25, 1.1, 1.4, FACE_DOOR, { z: 68 });
  f1.obj("modular-suite/props/temple_ritual/tmp_lion_statue.png", 4.35, 3.25, 1.1, 1.4, FACE_DOOR, { z: 68 });
  f1.obj("core-fantasy/colorable/heraldic_banner_colorable.png", 9.15, -1.55, 0.95, 1.35, FACE_DOOR + 0.28, {
    z: 62,
    recolor: IMPERIAL_CRIMSON,
  });
  f1.obj("core-fantasy/colorable/heraldic_banner_colorable.png", 9.15, 1.55, 0.95, 1.35, FACE_DOOR - 0.28, {
    z: 62,
    recolor: ROYAL_VIOLET,
  });
  f1.obj("modular-suite/props/temple_ritual/tmp_ornate_prayer_rug.png", 5.55, 0, 1.6, 2.15, FACE_DOOR, {
    z: 40,
    shadow: false,
  });

  // Exterior Portico Guardians & Aether Streetlamps (right outside 1F entrance stairs!)
  f1.obj("modular-suite/props/harmony_lighting/lgt_street_aether_cyan_post.png", -8.6, -2.5, 0.95, 0.95, 0, { z: 78 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_street_aether_cyan_post.png", -8.6, 2.5, 0.95, 0.95, 0, { z: 78 });
  f1.obj("modular-suite/props/temple_ritual/tmp_stone_gargoyle.png", -7.8, -3.4, 1.15, 1.0, FACE_DOOR, { z: 72 });
  f1.obj("modular-suite/props/temple_ritual/tmp_stone_gargoyle.png", -7.8, 3.4, 1.15, 1.0, FACE_DOOR, { z: 72 });

  // 1F Dynamic Lighting (Warm candlelight & braziers + pulsing Sovereign Violet-Cyan High Altar glow + Portico streetlamps!)
  f1.light("High Altar Aether Relic", 7.15, 0, 8.5, "#A855F7", 1.25);
  f1.light("High Altar Candelabra NW", 7.55, -2.45, 5.0, "#FFB347", 0.9, { flicker: true });
  f1.light("High Altar Candelabra SE", 7.55, 2.45, 5.0, "#FFB347", 0.9, { flicker: true });
  f1.light("Nave Chandelier North", -2.2, 0, 7.5, "#FFBE6B", 1.05, { flicker: true });
  f1.light("Nave Chandelier South", 1.5, 0, 7.5, "#FFBE6B", 1.05, { flicker: true });
  f1.light("Vestibule Brazier NW", -3.3, -3.7, 5.0, "#FF8C3B", 0.8, { flicker: true });
  f1.light("Vestibule Brazier SE", -3.3, 3.7, 5.0, "#FF8C3B", 0.8, { flicker: true });
  f1.light("Portico Aether Lamp NW", -8.6, -2.5, 6.5, "#38BDF8", 0.9);
  f1.light("Portico Aether Lamp SE", -8.6, 2.5, 6.5, "#38BDF8", 0.9);

  f1.note(
    "NOTE",
    5.4,
    3.1,
    "1F · High Altar of the Sovereign",
    "Black obsidian altar channeling violet aether directly from the 3F Dynamo. Two Clockwork Inquisitors guard the entry doors; tithe strongbox sits in the East Aether-Lift tower.",
    "#A855F7",
  );
  f1.note(
    "SECRET",
    -0.4,
    -5.85,
    "1F · Wired Confessionals",
    "Hidden brass acoustic tubes inside the confession booths pipe whispered secrets up to the 4F Inquisition Scrying Chamber (DC 15 Investigation).",
    "#F59E0B",
  );

  // Merge 1F additions into the imported MrRogers ground floor layers!
  groundTerrainLayer.terrainStrokes!.push(...f1.b.terrain);
  groundPathsLayer.paths!.push(...f1.b.paths);
  groundWallsLayer.walls!.push(...f1.b.walls);
  groundWallsLayer.portals!.push(...f1.b.portals);
  groundObjectsLayer.objects!.push(...f1.b.objects);

  // =========================================================================
  // FLOOR 2 (+14ft) — OPEN-ATRIUM CHOIR GALLERY, PIPE ORGAN, SCRIPTORIUM & REFECTORY
  // =========================================================================
  const f2 = makeFloorBuilder("2f");

  // 2F Floor Polygons built AROUND an Open Central Atrium Void (u ∈ [-4.2, +2.8], v ∈ [-2.4, +2.4])
  // so clicking 2F lets players literally look DOWN 14 ft into the lit 1F Grand Nave below!!
  f2.floorPoly("modular-suite/terrain/funeral_dark_parquet.png", circlePoly(-7.07, -7.07, 2.95, 24));
  f2.floorPoly("modular-suite/terrain/funeral_dark_parquet.png", circlePoly(-7.07, 7.07, 2.95, 24));
  // NE Entrance Bridge Gallery (u: -7.07..-4.2, v: -7.07..+7.07)
  f2.floorPoly("modular-suite/terrain/mausoleum_marble.png", rectPoly(-7.07, -7.07, -4.2, 7.07));
  // NW Wing: Sovereign's Scriptorium (u: -4.2..+4.24, v: -7.07..-2.4)
  f2.floorPoly("modular-suite/terrain/funeral_dark_parquet.png", rectPoly(-4.2, -7.07, 4.24, -2.4));
  // SE Wing: Clerics' Refectory & Pantry (u: -4.2..+4.24, v: +2.4..+7.07)
  f2.floorPoly("core-fantasy/terrain/tavern_oak_planks.png", rectPoly(-4.2, 2.4, 4.24, 7.07));
  // SW Apse Choir & Pipe Organ Loft (u: +2.8..+4.24 spanning v: -3.9..+3.9 + full SW Apse circle!)
  f2.floorPoly("modular-suite/terrain/funeral_dark_parquet.png", rectPoly(2.8, -4.0, 4.35, 4.0));
  f2.floorPoly("modular-suite/terrain/funeral_dark_parquet.png", circlePoly(6.364, 0, 4.45, 32));

  // 2F Perimeter Walls + Stained-Glass Lancets
  const w2Perim = f2.wall("modular-suite/walls/wall_chapel_stone.png", templePoly, {
    closed: true,
    thickness: 0.2,
    blocksLight: true,
  });
  addGothicCathedralWindows(f2, w2Perim, true);
  // Front NE clerestory stained-glass windows over the 1F portico
  f2.portal("modular-suite/portals/portal_stained_lancet.png", -7.071, -2.0, PORTAL_ALONG_V, "window", 1.5, true, w2Perim);
  f2.portal("modular-suite/portals/portal_stained_lancet.png", -7.071, 0, PORTAL_ALONG_V, "window", 1.8, true, w2Perim);
  f2.portal("modular-suite/portals/portal_stained_lancet.png", -7.071, 2.0, PORTAL_ALONG_V, "window", 1.5, true, w2Perim);

  // Open Central Atrium Balustrade Railing overlooking 1F Nave (blocksLight: false so 1F & 2F interplay feels airy!)
  f2.wallUV(
    "walls/jugendstil_iron_balustrade.png",
    [[-4.2, -2.4], [-4.2, 2.4], [2.8, 2.4], [2.8, -2.4]],
    { closed: true, thickness: 0.14, blocksLight: false },
  );

  // Subtle partition dividing Refectory kitchen alcove on SE corner
  const w2Kit = f2.wallUV("modular-suite/walls/wall_chapel_stone.png", [[1.4, 3.6], [1.4, 7.0]], {
    thickness: 0.14,
    blocksLight: true,
  });
  f2.portal("portals/station_oak_door.png", 1.4, 4.6, PORTAL_ALONG_V, "door", 1.0, false, w2Kit);

  // Glowing aether air-pressure conduit running from East Tower bellows to the SW Brass Pipe Organ
  f2.spline("paths/aether_power_conduit.png", [[-6.5, 6.2], [-5.2, 4.6], [-5.2, 2.8], [3.4, 2.8], [7.2, 1.5]], 0.22, { curved: true });

  addVerticalTowers(f2, 2);

  // NE Bridge Overlook: Prayer rug, lectern, true top-down cathedral floor candelabras & wall sconces flanking the lancet windows!
  f2.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", -5.6, 0, 3.4, 1.5, FACE_APSE, {
    z: 38,
    shadow: false,
    recolor: IMPERIAL_CRIMSON,
  });
  f2.obj("modular-suite/props/library_alchemy/arc_wooden_lectern.png", -4.9, 0, 1.05, 0.9, FACE_APSE, { z: 64 });
  f2.obj("modular-suite/props/library_alchemy/arc_glowing_grimoire.png", -4.9, 0, 0.55, 0.4, FACE_APSE, {
    z: 68,
    shadow: false,
  });
  f2.obj("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_brass.png", -5.6, -2.55, 0.94, 0.94, 0, { z: 66 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_brass.png", -5.6, 2.55, 0.94, 0.94, 0, { z: 66 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_brass_twin.png", -6.84, -1.05, 0.58, 0.58, FACE_APSE, { z: 76, shadow: false });
  f2.obj("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_brass_twin.png", -6.84, 1.05, 0.58, 0.58, FACE_APSE, { z: 76, shadow: false });

  // NW WING — SOVEREIGN'S SCRIPTORIUM & EDICT REGISTRY
  f2.obj("core-fantasy/hero/hero_library_bookcase.png", -2.4, -6.35, 2.1, 0.95, FACE_SE, { z: 62 });
  f2.obj("core-fantasy/hero/hero_library_bookcase.png", 0.3, -6.35, 2.1, 0.95, FACE_SE, { z: 62 });
  f2.obj("modular-suite/props/school_courtroom/sch_card_catalog.png", 2.7, -6.3, 1.35, 0.95, FACE_SE, { z: 62 });
  // 3 Cluttered Scribe Desks with chairs, open ledgers, inkwells, stacked tomes, scrolls & candle drips
  for (const [idx, du] of [-2.4, -0.2, 2.0].entries()) {
    f2.obj("modular-suite/modular/bare_walnut_study_desk.png", du, -4.3, 1.65, 1.0, FACE_SE, { z: 58 });
    f2.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", du, -3.4, 0.72, 0.72, FACE_NW + (idx - 1) * 0.18, { z: 56 });
    f2.obj("modular-suite/props/post_office/po_open_ledger.png", du - 0.25, -4.35, 0.58, 0.45, FACE_SE + 0.1, { z: 65, shadow: false });
    f2.obj("modular-suite/props/post_office/po_quill_inkwell.png", du + 0.35, -4.45, 0.42, 0.42, 0.3, { z: 66, shadow: false });
    const deskLamp =
      idx === 1
        ? "modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png"
        : idx === 0
          ? "modular-suite/props/harmony_lighting/lgt_table_beeswax_saucer_cluster.png"
          : "modular-suite/props/harmony_lighting/lgt_table_hurricane_oil_lamp.png";
    f2.obj(deskLamp, du + 0.44, -4.12, 0.46, 0.46, FACE_SE, { z: 66, shadow: false });
  }
  f2.obj("modular-suite/props/library_alchemy/arc_scroll_cubby.png", 3.5, -5.0, 1.0, 1.0, FACE_DOOR, { z: 62 });
  f2.obj("modular-suite/props/library_alchemy/arc_stacked_tomes.png", -3.4, -5.4, 0.65, 0.65, 0.4, { z: 64 });
  f2.obj("modular-suite/props/library_alchemy/arc_ribbon_scrolls.png", 0.8, -5.2, 0.58, 0.55, -0.5, { z: 64 });

  // SE WING — CLERICS' LIVED-IN REFECTORY & ABBEY KITCHEN
  f2.obj("modular-suite/modular/bare_oak_banquet_table.png", -1.4, 4.7, 3.3, 1.35, FACE_SE, { z: 58 });
  for (const cu of [-2.4, -1.4, -0.4]) {
    f2.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", cu, 3.7, 0.72, 0.72, FACE_SE + 0.1, { z: 55 });
    f2.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", cu, 5.7, 0.72, 0.72, FACE_NW - 0.12, { z: 55 });
    f2.obj("modular-suite/props/tavern_clutter/tav_pewter_place_setting.png", cu, 4.4, 0.55, 0.42, FACE_SE, { z: 65, shadow: false });
    f2.obj("modular-suite/props/tavern_clutter/tav_pewter_place_setting.png", cu, 5.0, 0.55, 0.42, FACE_NW, { z: 65, shadow: false });
  }
  f2.obj("modular-suite/props/tavern_clutter/tav_wine_bottle_goblet.png", -1.9, 4.7, 0.5, 0.5, 0.3, { z: 66, shadow: false });
  f2.obj("modular-suite/modular/basket_bread_cloth.png", -0.8, 4.7, 0.65, 0.65, -0.2, { z: 66, shadow: false });
  f2.obj("modular-suite/props/music_theater_tea/tea_silver_candelabra.png", -1.4, 4.7, 0.56, 0.56, 0, { z: 67, shadow: false });
  f2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_banquet_brass_chandelier.png", -1.4, 4.7, 1.68, 1.68, FACE_SE, {
    z: 92,
    opacity: 0.86,
    shadow: false,
  });
  // Kitchen & Pantry behind SE partition (u: 1.7..3.8, v: 3.8..6.7)
  f2.obj("modular-suite/props/kitchen/kit_iron_cookstove.png", 2.5, 6.2, 1.45, 1.25, FACE_NW, { z: 62 });
  f2.obj("modular-suite/props/kitchen/kit_butcher_block.png", 2.7, 4.5, 1.0, 1.0, FACE_DOOR, { z: 60 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_copper_kitchen_pendant.png", 2.7, 4.5, 0.96, 0.96, 0, {
    z: 90,
    opacity: 0.88,
    shadow: false,
  });
  f2.obj("modular-suite/props/kitchen/kit_ceramic_plate_stack.png", 2.6, 4.4, 0.52, 0.52, 0, { z: 66, shadow: false });
  f2.obj("modular-suite/props/kitchen/kit_vegetable_basket.png", 3.5, 5.4, 0.78, 0.78, 0.4, { z: 62 });
  f2.obj("core-fantasy/objects/ale_barrel.png", 3.5, 6.3, 0.85, 0.85, 0, { z: 62 });
  f2.obj("core-fantasy/hero/hero_wine_rack.png", 0.6, 6.25, 1.5, 1.15, FACE_NW, { z: 62 });

  // SW APSE (6.364, 0) — GRAND CHOIR LOFT & MAGIPUNK BRASS PIPE ORGAN
  f2.obj("modular-suite/props/sovereign_temple/sov_aether_pipe_organ.png", 8.05, 0, 4.05, 2.75, FACE_DOOR, { z: 72 });
  f2.obj("modular-suite/props/school_courtroom/sch_carved_podium.png", 4.1, 0, 1.1, 1.0, FACE_APSE, { z: 66 });
  f2.obj("modular-suite/props/temple_ritual/tmp_wooden_pew.png", 5.2, -2.5, 2.0, 0.82, FACE_DOOR + 0.55, { z: 60 });
  f2.obj("modular-suite/props/temple_ritual/tmp_wooden_pew.png", 5.2, 2.5, 2.0, 0.82, FACE_DOOR - 0.55, { z: 60 });
  f2.obj("modular-suite/props/temple_ritual/tmp_ritual_bell_hymnal.png", 5.2, -2.5, 0.45, 0.38, FACE_DOOR + 0.55, { z: 66, shadow: false });
  f2.obj("modular-suite/props/temple_ritual/tmp_bronze_gong.png", 6.3, -3.45, 1.2, 1.2, FACE_SE, { z: 66 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_brass.png", 6.35, 3.35, 0.94, 0.94, 0, { z: 68 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_gothic_bronze_wheel.png", 5.2, 0, 1.85, 1.85, FACE_DOOR, {
    z: 92,
    opacity: 0.85,
    shadow: false,
  });
  f2.obj("core-fantasy/colorable/medallion_round_rug_colorable.png", 5.2, 0, 2.8, 2.8, FACE_DOOR, {
    z: 38,
    shadow: false,
    recolor: SOVEREIGN_PLUM,
  });

  // East Tower 2F Organ Bellows & North Tower Linen/Parchment Landing (clear of lift cage!)
  f2.obj("objects/gear_winch_assembly.png", -8.95, 7.1, 1.35, 0.9, FACE_APSE, { z: 62 });
  f2.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", -8.6, -6.5, 0.82, 0.78, 0.4, { z: 62 });
  f2.obj("modular-suite/modular/crate_oak_md.png", -5.5, -8.3, 0.95, 0.95, FACE_SE, { z: 62 });

  // 2F Dynamic Lighting (aligned directly onto each chandelier, wall sconce, desk lamp & floor candelabra!)
  f2.light("Pipe Organ Aether Glow", 8.0, 0, 7.5, "#38BDF8", 1.1);
  f2.light("Choir Loft Chandelier", 5.2, 0, 6.5, "#FFBE6B", 0.95, { flicker: true });
  f2.light("Scriptorium Desk Lamps", -0.2, -4.12, 6.8, "#FFB84D", 0.95, { flicker: true });
  f2.light("Refectory Banquet Chandelier", -1.4, 4.7, 6.5, "#FFB347", 0.95, { flicker: true });
  f2.light("Refectory Cookstove Hearth", 2.5, 6.1, 4.8, "#FF7B29", 0.85, { flicker: true });
  f2.light("Bridge Overlook Candelabra NW", -5.6, -2.55, 5.2, "#FFBE6B", 0.82, { flicker: true });
  f2.light("Bridge Overlook Candelabra SE", -5.6, 2.55, 5.2, "#FFBE6B", 0.82, { flicker: true });

  f2.note(
    "HAZARD",
    5.4,
    3.1,
    "2F · Aether-Driven Pipe Organ",
    "When played, sub-audible aether resonances rattle the Nave below and impose Disadvantage on Concentration checks unless silenced at the East Tower bellows.",
    "#38BDF8",
  );
  f2.note(
    "NOTE",
    -1.2,
    -2.9,
    "2F · Edict Scriptorium & Refectory",
    "Open-railed mezzanine overlooking the 1F Grand Nave (14 ft drop). Clerics transcribe Sovereign tax decrees on the NW wing and share hot stew on the SE wing.",
    "#F59E0B",
  );

  // =========================================================================
  // FLOOR 3 (+28ft) — ACOLYTE DORMITORIES, BATHHOUSE, INFIRMARY & AETHER-CORE DYNAMO
  // =========================================================================
  const f3 = makeFloorBuilder("3f");

  // Full sealed solid 3F floor (sealing the Nave ceiling completely!)
  f3.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", templePoly);
  // Warm aged wood floorboards in Dormitories & Infirmary
  f3.floorPoly("core-fantasy/terrain/aged_dark_floorboards.png", rectPoly(-6.9, -6.9, 4.1, -1.6));
  f3.floorPoly("core-fantasy/terrain/aged_dark_floorboards.png", rectPoly(-3.2, 1.6, 4.1, 6.9));
  // Bathhouse ceramic tile in NE alcove
  f3.floorPoly("modular-suite/terrain/clinic_white_tile.png", rectPoly(-6.9, 1.6, -3.2, 4.6));
  // Industrial riveted iron deck in the SW Main Apse Aether-Core Dynamo!
  f3.floorPoly("terrain/riveted_iron_plate.png", circlePoly(6.364, 0, 4.45, 32));
  f3.floorPoly("terrain/riveted_iron_plate.png", rectPoly(3.4, -3.9, 4.4, 3.9));

  // Perimeter Gothic Chapel Stone Wall + Windows
  const w3Perim = f3.wall("modular-suite/walls/wall_chapel_stone.png", templePoly, {
    closed: true,
    thickness: 0.2,
    blocksLight: true,
  });
  addGothicCathedralWindows(f3, w3Perim, true);

  // Interior Walls: Central Spine Corridor (v = -1.6 and v = +1.6) + 3 Dorm Cells + Bathhouse + Infirmary + Iron Bulkhead to Dynamo Apse!
  const w3SpineNW = f3.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-4.0, -1.6], [3.5, -1.6]], { thickness: 0.14 });
  const w3SpineSE = f3.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-6.9, 1.6], [3.5, 1.6]], { thickness: 0.14 });
  // Dorm cell cross-dividers on NW wing (3 generous lived-in chambers!)
  f3.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-1.5, -7.0], [-1.5, -1.6]], { thickness: 0.14 });
  f3.wallUV("modular-suite/walls/wall_chapel_stone.png", [[1.1, -7.0], [1.1, -1.6]], { thickness: 0.14 });
  // Bathhouse / Infirmary divider on SE wing
  f3.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-3.1, 1.6], [-3.1, 7.0]], { thickness: 0.14 });
  // Heavy Magipunk Iron Bulkhead sealing off the SW Apse Dynamo Room!
  const w3Dynamo = f3.wallUV("walls/aether_conduit_bulkhead.png", [[3.5, -3.9], [3.5, 3.9]], { thickness: 0.18 });

  // Working Interior Doors for every single room on 3F!
  f3.portal("portals/station_oak_door.png", -2.8, -1.6, PORTAL_ALONG_U, "door", 0.95, true, w3SpineNW);
  f3.portal("portals/station_oak_door.png", -0.2, -1.6, PORTAL_ALONG_U, "door", 0.95, false, w3SpineNW);
  f3.portal("portals/station_oak_door.png", 2.3, -1.6, PORTAL_ALONG_U, "door", 0.95, true, w3SpineNW);
  f3.portal("portals/station_oak_door.png", -5.0, 1.6, PORTAL_ALONG_U, "door", 0.95, true, w3SpineSE);
  f3.portal("portals/station_oak_door.png", -0.8, 1.6, PORTAL_ALONG_U, "door", 0.95, false, w3SpineSE);
  f3.portal("portals/aether_sliding_gate.png", 3.5, 0, PORTAL_ALONG_V, "gate", 1.8, true, w3Dynamo);

  // Glowing Aether Conduits feeding from SW Reactor Core straight up the spine to the East Tower Lift!
  f3.spline("paths/aether_power_conduit.png", [[6.4, 0], [3.5, 0], [-5.2, 0], [-5.6, 5.2], [-6.8, 6.8]], 0.28, { curved: true });
  f3.spline("paths/aether_power_conduit.png", [[6.4, 0], [5.8, -3.2]], 0.22);
  f3.spline("paths/aether_power_conduit.png", [[6.4, 0], [5.8, 3.2]], 0.22);

  addVerticalTowers(f3, 3);

  // NE DORMITORY COMMON LOUNGE & STUDY NOOK (u: -6.5..-4.1, v: -6.2..-1.8) — lived-in acolyte tea & coat alcove!
  f3.obj("core-fantasy/colorable/woven_oval_rug_colorable.png", -5.3, -4.1, 2.2, 1.65, FACE_APSE, { z: 42, shadow: false, recolor: SOVEREIGN_PLUM });
  f3.obj("objects/grand_tea_table.png", -5.3, -4.1, 1.35, 0.95, FACE_SE, { z: 58 });
  f3.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -6.2, -4.1, 0.7, 0.7, FACE_APSE, { z: 55 });
  f3.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -4.4, -4.1, 0.7, 0.7, FACE_DOOR, { z: 55 });
  f3.obj("modular-suite/props/harmony_lighting/lgt_table_beeswax_saucer_cluster.png", -5.3, -4.1, 0.44, 0.44, 0, { z: 66, shadow: false });
  f3.obj("modular-suite/props/harmony_lighting/lgt_ceiling_iron_dome_pendant.png", -5.3, -4.1, 1.02, 1.02, 0, { z: 90, opacity: 0.86, shadow: false });
  f3.obj("modular-suite/props/school_courtroom/sch_coat_rack_stand.png", -6.4, -2.5, 0.82, 0.82, 0.3, { z: 62 });
  f3.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", -4.5, -2.4, 1.15, 0.82, FACE_NW, { z: 62 });
  f3.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", -5.75, -4.85, 0.78, 0.75, 0.2, { z: 62 });
  // Central Spine Corridor lived-in supply runner, linen chest & wall-mounted cyan aether corridor sconces!
  f3.obj("core-fantasy/colorable/parlor_rug_rect_colorable.png", -1.2, 0, 4.2, 1.25, FACE_SE, { z: 38, shadow: false, recolor: SLATE_NAVY });
  f3.obj("modular-suite/modular/crate_oak_sm.png", -4.6, -0.8, 0.85, 0.85, FACE_APSE, { z: 60 });
  f3.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", -3.0, -1.32, 0.56, 0.56, FACE_SE, { z: 76, shadow: false });
  f3.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", -3.0, 1.32, 0.56, 0.56, FACE_NW, { z: 76, shadow: false });
  f3.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", 1.5, -1.32, 0.56, 0.56, FACE_SE, { z: 76, shadow: false });
  f3.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", 1.5, 1.32, 0.56, 0.56, FACE_NW, { z: 76, shadow: false });

  // NW WING — 3 LIVED-IN ACOLYTE DORMITORY CELLS
  // Cell 1 (u: -3.9..-1.6, v: -6.8..-1.8)
  f3.obj("objects/tenement_iron_bed.png", -2.8, -5.6, 1.15, 1.85, FACE_SE, { z: 58 });
  f3.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", -1.9, -6.2, 0.65, 0.65, FACE_SE, { z: 58 });
  f3.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_cream_lamp.png", -1.9, -6.2, 0.44, 0.44, 0, { z: 66, shadow: false });
  f3.obj("modular-suite/props/bedroom_home/home_brass_footlocker.png", -2.8, -4.1, 1.05, 0.72, FACE_SE, { z: 60 });
  f3.obj("modular-suite/props/bedroom_home/home_washstand_basin.png", -3.4, -2.5, 0.95, 0.75, FACE_APSE, { z: 60 });
  f3.obj("modular-suite/props/temple_ritual/tmp_ornate_prayer_rug.png", -2.1, -3.2, 0.9, 1.35, FACE_SE, { z: 42, shadow: false });

  // Cell 2 (u: -1.4..+1.0, v: -6.8..-1.8) — Double acolyte cell with hanging monastic iron pendant & sleeping cat!
  f3.obj("core-fantasy/colorable/inn_single_bed_colorable.png", -0.8, -5.6, 1.15, 1.85, FACE_SE, { z: 58, recolor: SOVEREIGN_PLUM });
  f3.obj("core-fantasy/colorable/inn_single_bed_colorable.png", 0.5, -5.6, 1.15, 1.85, FACE_SE, { z: 58, recolor: SLATE_NAVY });
  f3.obj("modular-suite/props/harmony_lighting/lgt_ceiling_iron_dome_pendant.png", -0.2, -4.5, 0.96, 0.96, 0, { z: 90, opacity: 0.86, shadow: false });
  f3.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 0.5, -2.4, 1.2, 0.85, FACE_NW, { z: 62 });
  f3.obj("modular-suite/props/bedroom_home/home_patchwork_quilts.png", -0.9, -3.7, 0.7, 0.65, 0.3, { z: 62 });
  f3.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 0.4, -5.4, 0.65, 0.65, -0.7, { z: 66 });
  f3.obj("modular-suite/props/bedroom_home/home_chamber_pot.png", -1.1, -2.3, 0.48, 0.45, 0, { z: 60 });

  // Cell 3 (u: +1.2..+3.8, v: -6.8..-1.8) — Senior Deacon's Quarters (Amber Banker's Desk Lamp + Brass Reading Floor Lamp!)
  f3.obj("core-fantasy/colorable/inn_double_bed_colorable.png", 2.5, -5.5, 1.6, 1.95, FACE_SE, { z: 58, recolor: IMPERIAL_CRIMSON });
  f3.obj("modular-suite/modular/bare_oak_study_desk.png", 3.3, -2.9, 1.4, 0.85, FACE_DOOR, { z: 58 });
  f3.obj("modular-suite/props/harmony_lighting/lgt_table_banker_amber_desk.png", 3.3, -2.62, 0.46, 0.46, FACE_DOOR, { z: 66, shadow: false });
  f3.obj("modular-suite/props/harmony_lighting/lgt_floor_brass_reading_lamp.png", 2.1, -4.25, 0.76, 0.76, FACE_APSE, { z: 66 });
  f3.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 2.5, -2.9, 0.7, 0.7, FACE_APSE, { z: 55 });
  f3.obj("modular-suite/props/library_alchemy/arc_stacked_tomes.png", 3.3, -3.2, 0.5, 0.5, 0.2, { z: 65, shadow: false });
  f3.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 1.6, -2.4, 1.2, 0.85, FACE_APSE, { z: 62 });
  f3.obj("core-fantasy/colorable/woven_oval_rug_colorable.png", 2.4, -3.9, 1.65, 1.15, FACE_SE, { z: 42, shadow: false, recolor: ANTIQUE_GOLD });

  // NE ALCOVE — CLERICS' BATHHOUSE & VESTMENT LAUNDRY (Waterproof Caged Brass Bulkhead Wall Lamp!)
  f3.obj("modular-suite/props/bedroom_home/home_copper_bathtub.png", -5.8, 3.5, 1.65, 0.98, FACE_APSE, { z: 60 });
  f3.obj("modular-suite/props/harmony_lighting/lgt_sconce_caged_bulkhead_brass.png", -4.85, 1.88, 0.58, 0.58, FACE_SE, { z: 76, shadow: false });
  f3.obj("modular-suite/props/kitchen/kit_soapy_washtub.png", -4.1, 3.7, 0.95, 0.95, 0, { z: 60 });
  f3.obj("modular-suite/props/bedroom_home/home_laundry_basket.png", -3.9, 2.5, 0.85, 0.78, 0.5, { z: 62 });
  f3.obj("modular-suite/colorable/col_folded_towels.png", -6.2, 2.3, 0.6, 0.6, 0.2, { z: 62, recolor: IVORY_WAX });
  f3.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", -5.1, 4.4, 1.2, 0.85, FACE_NW, { z: 62 });

  // SE WING — TEMPLE INFIRMARY & ALCHEMICAL APOTHECARY
  f3.obj("modular-suite/props/doctor_apothecary/doc_infirmary_cot.png", -2.0, 5.5, 1.85, 1.1, FACE_NW, { z: 58 });
  f3.obj("modular-suite/props/doctor_apothecary/doc_infirmary_cot.png", -0.3, 5.5, 1.85, 1.1, FACE_NW, { z: 58 });
  f3.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", -1.15, 5.82, 0.58, 0.58, FACE_NW, { z: 58 });
  f3.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_cream_lamp.png", -1.15, 5.82, 0.44, 0.44, 0, { z: 66, shadow: false });
  f3.obj("modular-suite/props/harmony_lighting/lgt_floor_brass_reading_lamp.png", -0.8, 4.45, 0.74, 0.74, FACE_SE, { z: 66 });
  f3.obj("modular-suite/props/doctor_apothecary/doc_exam_table.png", 1.5, 4.2, 1.0, 1.9, FACE_APSE, { z: 60 });
  f3.obj("modular-suite/props/doctor_apothecary/doc_leather_stool.png", 1.5, 3.0, 0.62, 0.65, 0, { z: 58 });
  f3.obj("modular-suite/props/doctor_apothecary/doc_apothecary_cabinet.png", -1.2, 2.3, 1.65, 0.82, FACE_SE, { z: 60 });
  f3.obj("modular-suite/props/doctor_apothecary/doc_mortar_pestle.png", -1.4, 2.3, 0.45, 0.45, 0, { z: 66, shadow: false });
  f3.obj("modular-suite/props/doctor_apothecary/doc_specimen_jar.png", -0.7, 2.3, 0.36, 0.45, 0, { z: 66, shadow: false });
  f3.obj("core-fantasy/hero/hero_alchemy_bench.png", 2.9, 5.5, 2.25, 1.45, FACE_NW, { z: 62 });
  f3.obj("modular-suite/props/harmony_lighting/lgt_table_apothecaries_spirit_lamp.png", 2.6, 5.15, 0.46, 0.46, 0, { z: 68, shadow: false });
  f3.obj("modular-suite/props/library_alchemy/arc_alembic_still.png", 2.6, 5.4, 0.68, 0.72, 0, { z: 68, shadow: false });
  f3.obj("modular-suite/props/library_alchemy/arc_potion_trio.png", 3.3, 5.6, 0.55, 0.55, 0, { z: 68, shadow: false });
  f3.obj("modular-suite/colorable/col_elixir_decanter.png", 2.1, 2.5, 0.45, 0.45, 0, { z: 66, recolor: EMERALD_TINCTURE });

  // SW MAIN APSE (6.364, 0) — THE AETHER-CORE DYNAMO CHAMBER (DARK MAGIPUNK ENGINE!)
  f3.obj("modular-suite/props/sovereign_temple/sov_aether_reactor_core.png", 6.4, 0, 3.85, 3.85, FACE_DOOR, { z: 70 });
  f3.obj("objects/steam_boiler_furnace.png", 8.7, -1.85, 1.95, 1.35, FACE_DOOR + 0.5, { z: 66 });
  f3.obj("objects/crystal_capacitor_bank.png", 8.7, 1.85, 1.85, 1.15, FACE_DOOR - 0.5, { z: 66 });
  f3.obj("objects/clockwork_automaton_dock.png", 5.3, -2.8, 1.28, 1.28, FACE_SE, { z: 64 });
  f3.obj("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", 5.3, -2.8, 1.12, 1.02, FACE_SE, { z: 74 });
  f3.obj("objects/clockwork_automaton_dock.png", 5.3, 2.8, 1.28, 1.28, FACE_NW, { z: 64 });
  f3.obj("objects/alchemy_worktable.png", 4.5, 1.65, 1.65, 0.98, FACE_DOOR, { z: 62 });
  f3.obj("modular-suite/props/ship_cargo_hold/cargo_aether_crystal_cage.png", 7.3, -3.15, 1.15, 1.15, 0.3, { z: 64 });
  f3.obj("modular-suite/props/sewers_alleys/sew_pipe_wheel_valve.png", 7.4, 3.15, 0.78, 0.78, 0, { z: 66 });

  // 3F Dynamic Lighting
  f3.light("Aether-Core Reactor Surge", 6.4, 0, 9.0, "#A855F7", 1.3);
  f3.light("Boiler Furnace Glow", 8.7, -1.85, 5.2, "#FF6B2B", 0.88, { flicker: true });
  f3.light("Capacitor Bank Cyan Arc", 8.7, 1.85, 5.5, "#38BDF8", 0.9);
  f3.light("Corridor Aether Sconce N", -3.0, 0, 6.2, "#38BDF8", 0.72);
  f3.light("Corridor Aether Sconce S", 1.5, 0, 6.2, "#38BDF8", 0.72);
  f3.light("Dormitory Lounge Lamp", -5.3, -4.1, 5.5, "#FFB84D", 0.85, { flicker: true });
  f3.light("Dormitory Candlelight", -0.2, -4.5, 5.5, "#FFB84D", 0.8, { flicker: true });
  f3.light("Deacon Desk Lamp", 3.3, -2.62, 5.0, "#FFB84D", 0.82, { flicker: true });
  f3.light("Infirmary Apothecary Glow", 2.6, 5.15, 5.2, "#34D399", 0.62);
  f3.light("Infirmary Bedside Lamp", -0.8, 4.45, 4.8, "#FFCF86", 0.58, { flicker: true });
  f3.light("Bathhouse Steam Bulkhead", -4.85, 2.2, 4.8, "#FFD08A", 0.76, { flicker: true });

  f3.note(
    "HAZARD",
    5.4,
    3.1,
    "3F · Cathedral Aether-Core Reactor",
    "Drives the East Aether-Lift, 1F High Altar, 2F Pipe Organ, and 5F Crown Throne. Sabotaging the 4 pressure valves drops all cathedral arcane defenses and alerts the Clockwork Inquisitors.",
    "#A855F7",
  );
  f3.note(
    "NOTE",
    -2.6,
    0,
    "3F · Cleric Quarters & Infirmary",
    "Lived-in acolyte dormitories & tea lounge (NW), steam bathhouse & vestment laundry (NE), and alchemical apothecary infirmary (SE) treating aether-burn casualties.",
    "#10B981",
  );

  // =========================================================================
  // FLOOR 4 (+42ft) — FORBIDDEN ARCHIVES, HIGH PRIEST'S SUITE & INQUISITION APSE
  // =========================================================================
  const f4 = makeFloorBuilder("4f");

  f4.floorPoly("core-fantasy/terrain/mansion_checkered_marble.png", templePoly);
  // Rich dark walnut parquet in the Forbidden Archives (NW) and High Priest's Suite (SE)
  f4.floorPoly("modular-suite/terrain/funeral_dark_parquet.png", rectPoly(-6.8, -6.8, 3.6, -1.6));
  f4.floorPoly("modular-suite/terrain/funeral_dark_parquet.png", rectPoly(-5.6, 1.6, 3.6, 6.8));
  // Dark hewn dungeon flagstone inside the grim SW Inquisition Apse
  f4.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", circlePoly(6.364, 0, 4.45, 32));
  f4.floorPoly("core-fantasy/terrain/dungeon_flagstone.png", rectPoly(3.5, -3.9, 4.4, 3.9));

  const w4Perim = f4.wall("modular-suite/walls/wall_chapel_stone.png", templePoly, {
    closed: true,
    thickness: 0.2,
    blocksLight: true,
  });
  addGothicCathedralWindows(f4, w4Perim, true);

  // Interior walls: Spine gallery + Locked Archive Vault + High Priest Private Suite + Heavy Inquisition Chamber
  const w4Arch = f4.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-4.2, -1.6], [3.5, -1.6]], { thickness: 0.16 });
  const w4Suite = f4.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-5.6, 1.6], [3.5, 1.6]], { thickness: 0.16 });
  f4.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-5.6, 1.6], [-5.6, 4.5]], { thickness: 0.16 });
  const w4Inq = f4.wallUV("modular-suite/walls/wall_chapel_stone.png", [[3.5, -3.9], [3.5, 3.9]], { thickness: 0.18 });
  // Secret-feeling locked treasure/edict vault alcove at NW back corner of Archives
  const w4Vault = f4.wallUV("walls/aether_conduit_bulkhead.png", [[1.3, -7.0], [1.3, -4.0], [4.1, -4.0]], { thickness: 0.16 });

  // Portals on 4F
  f4.portal("portals/jugendstil_brass_door.png", -1.2, -1.6, PORTAL_ALONG_U, "door", 1.1, true, w4Arch);
  f4.portal("modular-suite/portals/portal_bank_vault.png", 1.3, -5.4, PORTAL_ALONG_V, "door", 1.15, true, w4Vault);
  f4.portal("portals/jugendstil_brass_door.png", -2.2, 1.6, PORTAL_ALONG_U, "door", 1.1, true, w4Suite);
  f4.portal("portals/tenement_slum_door.png", 3.5, 0, PORTAL_ALONG_V, "door", 1.4, true, w4Inq);

  f4.spline("core-fantasy/paths/royal_crimson_runner.png", [[-6.2, 0], [3.4, 0]], 1.4);
  f4.spline("paths/aether_power_conduit.png", [[-6.5, 6.2], [-5.8, 0.8], [3.5, 0.8], [6.4, 0.8]], 0.2, { curved: true });

  addVerticalTowers(f4, 4);

  // Spine Antechamber: Clockwork Inquisitor standing watch outside the Inquisition Chamber + Armor Stand
  f4.obj("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", 2.3, -0.8, 1.25, 1.15, FACE_DOOR, { z: 75 });
  f4.obj("core-fantasy/hero/hero_plate_armor_stand.png", -5.2, -0.9, 1.1, 1.1, FACE_APSE, { z: 66 });

  // NW WING — THE FORBIDDEN ARCANE ARCHIVES & CARTOGRAPHY VAULT
  f4.obj("core-fantasy/hero/hero_library_bookcase.png", -3.4, -6.35, 2.0, 0.95, FACE_SE, { z: 62 });
  f4.obj("core-fantasy/hero/hero_library_bookcase.png", -0.8, -6.35, 2.0, 0.95, FACE_SE, { z: 62 });
  f4.obj("objects/arcane_bookshelf_cabinet.png", -3.8, -3.2, 2.0, 0.95, FACE_APSE, { z: 62 });
  f4.obj("core-fantasy/hero/hero_war_map_table.png", -1.1, -3.8, 2.4, 1.75, FACE_SE, { z: 62 });
  f4.obj("modular-suite/props/school_courtroom/sch_leather_armchair.png", -2.5, -3.8, 1.0, 0.95, FACE_APSE, { z: 58 });
  f4.obj("modular-suite/props/school_courtroom/sch_leather_armchair.png", 0.3, -3.8, 1.0, 0.95, FACE_DOOR, { z: 58 });
  f4.obj("modular-suite/props/ship_captain_cabin/ship_brass_armillary_globe.png", -1.1, -3.8, 0.65, 0.65, 0, { z: 68, shadow: false });
  f4.obj("modular-suite/props/harmony_lighting/lgt_table_banker_crimson_desk.png", -0.45, -3.45, 0.46, 0.46, FACE_SE, { z: 68, shadow: false });
  f4.obj("modular-suite/props/harmony_lighting/lgt_ceiling_billiard_green_pendant.png", -1.1, -3.8, 1.24, 1.24, 0, { z: 90, opacity: 0.86, shadow: false });
  f4.obj("modular-suite/props/library_alchemy/arc_wooden_lectern.png", 0.4, -2.4, 0.95, 0.85, FACE_NW, { z: 62 });
  f4.obj("modular-suite/props/library_alchemy/arc_glowing_grimoire.png", 0.4, -2.4, 0.5, 0.38, FACE_NW, { z: 67, shadow: false });
  // Oak side pedestal supporting the candle skull (never bare floor!)
  f4.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 2.4, -2.4, 0.72, 0.72, FACE_NW, { z: 58 });
  f4.obj("modular-suite/props/library_alchemy/arc_candle_skull.png", 2.4, -2.4, 0.46, 0.54, 0.5, { z: 66, shadow: false });
  // Inside Locked Forbidden Vault (u: 1.6..3.8, v: -6.7..-4.3)
  f4.obj("core-fantasy/hero/hero_open_treasure_chest.png", 2.85, -5.65, 1.2, 1.0, FACE_DOOR, { z: 64 });
  f4.obj("modular-suite/props/temple_ritual/tmp_golden_reliquary.png", 3.3, -4.75, 1.1, 0.82, FACE_NW, { z: 64 });
  f4.obj("modular-suite/props/library_alchemy/arc_runestone_obelisk.png", 2.15, -4.85, 0.7, 0.9, 0, { z: 66 });

  // SE WING — HIGH PRIEST / ARCH-VICAR'S PRIVATE APARTMENTS (lavish lived-in luxury!)
  f4.obj("core-fantasy/hero/hero_noble_carpet.png", -1.4, 4.2, 3.2, 2.15, FACE_SE, { z: 38, shadow: false });
  f4.obj("core-fantasy/hero/hero_noble_canopy_bed.png", 1.8, 4.95, 2.1, 2.2, FACE_DOOR, { z: 64 });
  f4.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 2.85, 3.85, 0.72, 0.72, FACE_DOOR, { z: 60 });
  f4.obj("modular-suite/props/harmony_lighting/lgt_table_bedside_amber_lamp.png", 2.85, 3.85, 0.46, 0.46, 0, { z: 66, shadow: false });
  f4.obj("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 2.6, 2.35, 1.3, 0.92, FACE_SE, { z: 62 });
  f4.obj("modular-suite/props/bedroom_home/home_vanity_mirror_brush.png", 0.75, 2.35, 1.2, 0.92, FACE_SE, { z: 60 });
  f4.obj("core-fantasy/hero/hero_velvet_sofa.png", -2.8, 5.75, 2.05, 1.12, FACE_NW, { z: 60 });
  f4.obj("modular-suite/props/harmony_lighting/lgt_floor_parlor_fringed_crimson.png", -1.55, 5.75, 0.84, 0.84, 0, { z: 66 });
  f4.obj("objects/grand_tea_table.png", -2.8, 4.3, 1.4, 0.95, FACE_SE, { z: 60 });
  f4.obj("modular-suite/props/music_theater_tea/tea_crystal_decanter.png", -2.8, 4.3, 0.55, 0.5, 0.3, { z: 66, shadow: false });
  f4.obj("core-fantasy/hero/hero_scholar_desk.png", -4.4, 3.2, 1.75, 1.3, FACE_APSE, { z: 60 });
  f4.obj("modular-suite/props/harmony_lighting/lgt_table_tiffany_sovereign_lamp.png", -4.18, 3.25, 0.48, 0.48, 0, { z: 68, shadow: false });
  f4.obj("modular-suite/props/school_courtroom/sch_leather_armchair.png", -3.4, 3.2, 0.95, 0.9, FACE_DOOR, { z: 58 });
  f4.obj("modular-suite/props/harmony_arch/int_fireplace_gothic_lit.png", -0.6, 6.42, 1.7, 1.0, FACE_NW, { z: 62 });
  f4.obj("modular-suite/props/bedroom_home/home_fireplace_tools.png", 0.4, 6.25, 0.55, 0.65, 0, { z: 64 });
  f4.obj("objects/potted_palm_urn.png", -4.5, 5.8, 1.0, 1.0, 0, { z: 64 });
  // Wall sconces in the 4F Spine Gallery & Inquisition Chamber
  f4.obj("modular-suite/props/harmony_lighting/lgt_sconce_cathedral_brass_twin.png", -2.5, -1.32, 0.58, 0.58, FACE_SE, { z: 76, shadow: false });
  f4.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_violet_sovereign.png", 3.82, -2.35, 0.58, 0.58, FACE_APSE, { z: 76, shadow: false });
  f4.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_violet_sovereign.png", 3.82, 2.35, 0.58, 0.58, FACE_APSE, { z: 76, shadow: false });

  // SW MAIN APSE (6.364, 0) — THE INQUISITION & CITY-SURVEILLANCE SCRYING CHAMBER
  f4.obj("modular-suite/props/sovereign_temple/sov_inquisition_chair.png", 6.25, 0, 3.1, 3.1, FACE_DOOR, { z: 70 });
  f4.obj("modular-suite/props/sovereign_temple/sov_scrying_console.png", 8.9, 0, 2.85, 1.45, FACE_DOOR, { z: 68 });
  f4.obj("modular-suite/props/school_courtroom/sch_witness_barrier.png", 4.55, -2.15, 1.6, 0.55, FACE_DOOR + 0.55, { z: 60 });
  f4.obj("modular-suite/props/school_courtroom/sch_witness_barrier.png", 4.55, 2.15, 1.6, 0.55, FACE_DOOR - 0.55, { z: 60 });
  f4.obj("modular-suite/props/library_alchemy/arc_crystal_ball.png", 6.4, -3.15, 0.78, 0.82, 0, { z: 68 });
  f4.obj("modular-suite/props/library_alchemy/arc_brass_hourglass.png", 6.4, 3.15, 0.68, 0.68, 0, { z: 68 });
  f4.obj("core-fantasy/hero/hero_iron_brazier.png", 4.7, -3.25, 0.92, 0.92, 0, { z: 66 });
  f4.obj("core-fantasy/hero/hero_iron_brazier.png", 4.7, 3.25, 0.92, 0.92, 0, { z: 66 });
  f4.obj("modular-suite/props/school_courtroom/sch_legal_ledger_stack.png", 8.15, -2.45, 0.65, 0.65, 0.4, { z: 64 });
  f4.obj("modular-suite/props/school_courtroom/sch_legal_ledger_stack.png", 8.15, 2.45, 0.65, 0.65, -0.3, { z: 64 });

  // 4F Dynamic Lighting
  f4.light("Inquisition Mind-Scrying Chair", 6.25, 0, 7.5, "#C084FC", 1.25);
  f4.light("Scrying Surveillance Console", 8.9, 0, 6.2, "#38BDF8", 1.1);
  f4.light("Inquisition Brazier NW", 4.7, -3.25, 4.8, "#FF7A2F", 0.85, { flicker: true });
  f4.light("Inquisition Brazier SE", 4.7, 3.25, 4.8, "#FF7A2F", 0.85, { flicker: true });
  f4.light("Forbidden Archives Reading Glow", -1.1, -3.8, 7.0, "#FFB84D", 0.95, { flicker: true });
  f4.light("Vault Runestone Glow", 2.4, -5.0, 4.2, "#38BDF8", 0.9);
  f4.light("High Priest Hearth Fire", -0.6, 6.1, 6.8, "#FF9A3C", 1.0, { flicker: true });
  f4.light("High Priest Study Lamp", -4.1, 3.2, 5.2, "#FFD280", 0.85, { flicker: true });

  f4.note(
    "SECRET",
    5.2,
    3.1,
    "4F · Inquisition & Scrying Dome",
    "The brass Scrying Console lets inquisitors watch every tram line and alleyway in the district—and eavesdrop on the 1F Confessionals below.",
    "#C084FC",
  );
  f4.note(
    "TRAP",
    2.5,
    -6.3,
    "4F · Sealed Edict Vault",
    "Heavy steel bank-vault door (DC 20 Thieves' Tools or the Arch-Vicar's key from the SE Suite) protects the Sovereign's original blood-compact charters and relic coffers.",
    "#F59E0B",
  );

  // =========================================================================
  // FLOOR 5 (+56ft) — OPEN-AIR SKY-WALK TERRACE, CROWN SANCTUM & ASTRAL OBSERVATORY
  // =========================================================================
  const f5 = makeFloorBuilder("5f");

  // Outer open-air parapeted Sky-Walk Terrace across full trefoil footprint!
  f5.floorPoly("core-fantasy/terrain/castle_keep_ashlar.png", templePoly);
  // Inner elevated Crown Sanctum & Observatory (stepped inward cleanly for dizzying 56ft sky-walk!)
  const sanctumOuter = rectPoly(-4.6, -4.8, 4.2, 4.8);
  f5.floorPoly("core-fantasy/terrain/mansion_checkered_marble.png", sanctumOuter);
  f5.floorPoly("modular-suite/terrain/temple_mosaic_atrium.png", circlePoly(6.364, 0, 4.35, 32));
  f5.floorPoly("core-fantasy/terrain/castle_keep_ashlar.png", circlePoly(-7.07, -7.07, 2.85, 24));
  f5.floorPoly("core-fantasy/terrain/castle_keep_ashlar.png", circlePoly(-7.07, 7.07, 2.85, 24));

  // Outer Crenellated Gothic Parapet Wall around the open Sky-Walk Terrace (low parapet: blocksLight: false!)
  f5.wall("walls/jugendstil_iron_balustrade.png", templePoly, {
    closed: true,
    thickness: 0.16,
    blocksLight: false,
  });

  // Inner Enclosed Crown Sanctum Walls (light-blocking!) with grand brass doors & tall stained lancet windows
  const w5SanctumNE = f5.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-4.6, -4.8], [-4.6, 4.8]], { thickness: 0.2 });
  const w5SanctumNW = f5.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-4.6, -4.8], [4.2, -4.8], [4.2, -3.9]], { thickness: 0.2 });
  const w5SanctumSE = f5.wallUV("modular-suite/walls/wall_chapel_stone.png", [[-4.6, 4.8], [4.2, 4.8], [4.2, 3.9]], { thickness: 0.2 });
  // Curved SW Apse Sanctuary Wall
  const apseArcPts: Point2D[] = [];
  for (let i = 0; i <= 24; i++) {
    const rad = -1.08 + (i / 24) * 2.16; // spans the SW apse arc cleanly between v=-3.95 and v=+3.95
    apseArcPts.push(pt(6.364 + Math.cos(rad) * 4.45, Math.sin(rad) * 4.45));
  }
  const w5Apse = f5.wall("modular-suite/walls/wall_chapel_stone.png", apseArcPts, {
    closed: false,
    thickness: 0.22,
    blocksLight: true,
  });

  // Grand Brass Double Doors entering the 5F Crown Sanctum from the Sky-Walk Terrace
  f5.portal("portals/jugendstil_brass_door.png", -4.6, -0.55, PORTAL_ALONG_V, "door", 1.1, true, w5SanctumNE);
  f5.portal("portals/jugendstil_brass_door.png", -4.6, 0.55, PORTAL_ALONG_V, "door", 1.1, true, w5SanctumNE);
  // Stained-glass lancet windows ringing the 5F Crown Sanctum
  for (const u of [-2.4, 0.0, 2.4]) {
    f5.portal("modular-suite/portals/portal_stained_lancet.png", u, -4.8, PORTAL_ALONG_U, "window", 1.4, true, w5SanctumNW);
    f5.portal("modular-suite/portals/portal_stained_lancet.png", u, 4.8, PORTAL_ALONG_U, "window", 1.4, true, w5SanctumSE);
  }
  addGothicCathedralWindows(f5, w5Apse, false);

  // Ceremonial carpet + blazing aether conduits converging on the Sovereign's Throne!
  f5.spline("core-fantasy/paths/royal_crimson_runner.png", [[-4.4, 0], [5.8, 0]], 1.8);
  f5.spline("paths/aether_power_conduit.png", [[-6.8, 6.8], [-5.6, 2.0], [-4.6, 2.0], [5.2, 2.0], [7.2, 0.8]], 0.26, { curved: true });
  f5.spline("paths/aether_power_conduit.png", [[-6.8, -6.8], [-5.6, -2.0], [-4.6, -2.0], [5.2, -2.0], [7.2, -0.8]], 0.26, { curved: true });

  // Vertical Towers on 5F:
  // North Tower: Vertically aligned Spiral Stair (-6.35, -6.35, 2.40x2.40 matching 1F-4F!) + Monumental Cathedral Aether Bell Belfry (100% clear of parapet!)
  f5.obj("objects/brass_spiral_staircase.png", -6.35, -6.35, 2.4, 2.4, Math.PI, { z: 45 });
  f5.obj("modular-suite/props/sovereign_temple/sov_cathedral_bell_coil.png", -8.05, -8.05, 2.04, 2.04, 0, { z: 74 });
  // East Tower: Top Terminal of the Aether-Lift + Storm Capacitor Array (zero overlap with lift cage!)
  f5.obj("modular-suite/props/sovereign_temple/sov_aether_lift_cage.png", -7.07, 7.07, 2.65, 2.65, FACE_NW + Math.PI / 4, { z: 50 });
  f5.obj("objects/crystal_capacitor_bank.png", -8.95, 7.1, 1.35, 0.82, FACE_APSE, { z: 66 });

  // Open-Air Sky-Walk Terrace Gargoyles & Braziers overlooking the city 56 ft below!
  f5.obj("modular-suite/props/temple_ritual/tmp_stone_gargoyle.png", -6.2, -3.4, 1.15, 1.0, FACE_DOOR, { z: 72 });
  f5.obj("modular-suite/props/temple_ritual/tmp_stone_gargoyle.png", -6.2, 3.4, 1.15, 1.0, FACE_DOOR, { z: 72 });
  f5.obj("modular-suite/props/temple_ritual/tmp_stone_gargoyle.png", 3.2, -6.1, 1.15, 1.0, FACE_NW, { z: 72 });
  f5.obj("modular-suite/props/temple_ritual/tmp_stone_gargoyle.png", 3.2, 6.1, 1.15, 1.0, FACE_SE, { z: 72 });
  f5.obj("modular-suite/props/harmony_lighting/lgt_brazier_bronze_temple_tripod.png", -5.8, -1.8, 0.94, 0.94, 0, { z: 68 });
  f5.obj("modular-suite/props/harmony_lighting/lgt_brazier_bronze_temple_tripod.png", -5.8, 1.8, 0.94, 0.94, 0, { z: 68 });
  f5.obj("modular-suite/props/library_alchemy/arc_brass_telescope.png", -0.8, -6.0, 1.25, 1.2, FACE_NW, { z: 68 });
  f5.obj("modular-suite/props/library_alchemy/arc_brass_telescope.png", -0.8, 6.0, 1.25, 1.2, FACE_SE, { z: 68 });

  // CENTRAL CROWN AUDIENCE HALL: Sovereign Floor Sigil + Grand Astral Orrery + Honor Guards + Banners + Sovereign Gilded Chandelier!
  f5.obj("modular-suite/props/sovereign_temple/sov_sovereign_seal_floor.png", -1.75, 0, 3.5, 3.5, FACE_DOOR, {
    z: 36,
    shadow: false,
  });
  f5.obj("modular-suite/props/sovereign_temple/sov_astral_orrery.png", 2.35, 0, 2.95, 2.95, FACE_DOOR, { z: 68 });
  f5.obj("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", -2.9, -2.7, 1.25, 1.15, FACE_SE, { z: 76 });
  f5.obj("modular-suite/props/sovereign_temple/sov_clockwork_inquisitor.png", -2.9, 2.7, 1.25, 1.15, FACE_NW, { z: 76 });
  f5.obj("modular-suite/props/library_alchemy/arc_runestone_obelisk.png", 0.35, -3.5, 0.9, 1.15, 0, { z: 70 });
  f5.obj("modular-suite/props/library_alchemy/arc_runestone_obelisk.png", 0.35, 3.5, 0.9, 1.15, 0, { z: 70 });
  f5.obj("core-fantasy/colorable/heraldic_banner_colorable.png", -3.8, -3.8, 1.05, 1.45, FACE_SE, { z: 64, recolor: IMPERIAL_CRIMSON });
  f5.obj("core-fantasy/colorable/heraldic_banner_colorable.png", -3.8, 3.8, 1.05, 1.45, FACE_NW, { z: 64, recolor: ROYAL_VIOLET });
  f5.obj("modular-suite/props/harmony_lighting/lgt_ceiling_sovereign_gilded_chandelier.png", -1.75, 0, 2.35, 2.35, FACE_APSE, {
    z: 92,
    opacity: 0.88,
    shadow: false,
  });
  f5.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_violet_sovereign.png", -4.36, -1.72, 0.58, 0.58, FACE_APSE, { z: 76, shadow: false });
  f5.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_violet_sovereign.png", -4.36, 1.72, 0.58, 0.58, FACE_APSE, { z: 76, shadow: false });

  // SW MAIN APSE (6.364, 0) — THE THRONE OF THE SOVEREIGN!
  f5.obj("modular-suite/props/sovereign_temple/sov_iron_throne_dais.png", 7.05, 0, 4.1, 4.0, FACE_DOOR, { z: 72 });
  f5.obj("modular-suite/props/harmony_lighting/lgt_floor_sovereign_aether_torchiere.png", 6.4, -3.05, 0.96, 0.96, 0, { z: 72 });
  f5.obj("modular-suite/props/harmony_lighting/lgt_floor_sovereign_aether_torchiere.png", 6.4, 3.05, 0.96, 0.96, 0, { z: 72 });
  f5.obj("modular-suite/props/harmony_lighting/lgt_brazier_sovereign_violet_fire.png", 4.35, -3.1, 0.88, 0.88, 0, { z: 70 });
  f5.obj("modular-suite/props/harmony_lighting/lgt_brazier_sovereign_violet_fire.png", 4.35, 3.1, 0.88, 0.88, 0, { z: 70 });
  f5.obj("modular-suite/props/temple_ritual/tmp_smoking_censer.png", 5.05, -2.4, 0.78, 0.72, 0.2, { z: 70 });
  f5.obj("modular-suite/props/temple_ritual/tmp_smoking_censer.png", 5.05, 2.4, 0.78, 0.72, -0.2, { z: 70 });
  f5.obj("modular-suite/props/temple_ritual/tmp_golden_chalice.png", 8.65, -2.05, 0.55, 0.55, 0, { z: 70 });
  f5.obj("modular-suite/props/temple_ritual/tmp_golden_reliquary.png", 8.65, 2.05, 1.15, 0.82, FACE_DOOR - 0.5, { z: 68 });
  f5.obj("core-fantasy/colorable/heraldic_banner_colorable.png", 9.2, -1.35, 1.0, 1.4, FACE_DOOR + 0.22, { z: 64, recolor: IMPERIAL_CRIMSON });
  f5.obj("core-fantasy/colorable/heraldic_banner_colorable.png", 9.2, 1.35, 1.0, 1.4, FACE_DOOR - 0.22, { z: 64, recolor: IMPERIAL_CRIMSON });
  f5.obj("modular-suite/props/bedroom_home/home_bare_nightstand.png", 9.0, -2.05, 0.78, 0.78, FACE_DOOR, { z: 64 });

  // 5F Dynamic Lighting (Dramatic Sovereign Crown Violet-Gold + Celestial Orrery + Belfry Cyan Storm Coils!)
  f5.light("Throne of the Sovereign Aura", 7.05, 0, 9.5, "#A855F7", 1.32);
  f5.light("Grand Astral Orrery Sun", 2.35, 0, 7.8, "#FBBF24", 1.15);
  f5.light("Crown Sanctum Chandelier", -1.75, 0, 7.0, "#FFB84D", 0.92, { flicker: true });
  f5.light("Cathedral Aether Bell Coils", -8.05, -8.05, 7.0, "#38BDF8", 1.12);
  f5.light("East Spire Lift Terminal", -7.07, 7.07, 6.5, "#38BDF8", 1.0);
  f5.light("Sky-Walk Brazier NW", -5.8, -1.8, 5.5, "#FF8C3B", 0.9, { flicker: true });
  f5.light("Sky-Walk Brazier SE", -5.8, 1.8, 5.5, "#FF8C3B", 0.9, { flicker: true });

  f5.note(
    "NOTE",
    5.4,
    3.1,
    "5F · Throne of the Sovereign (+56 ft)",
    "Pinnacle of the Cathedral. The Sovereign's Obsidian Throne channels violet leyline lightning from the 3F Reactor while the Grand Astral Orrery tracks planar conjunctions.",
    "#A855F7",
  );
  f5.note(
    "AMBUSH",
    -9.0,
    -6.4,
    "5F · Aether Bell Belfry",
    "Tolling the rune-etched bronze bell unleashes a 60 ft thunder/psychic shockwave across the open-air Sky-Walk Terrace and alerts the city garrison.",
    "#38BDF8",
  );

  // =========================================================================
  // CATHEDRAL SPIRE ROOFS ON `ROOF` (+70ft) ALONGSIDE ALL 17 MRROGERS CITY ROOFS!
  // =========================================================================
  const spireRoofs: RoofStructure[] = [
    // Main Gothic Nave Ridge Roof (Verdigris Copper Standing-Seam running NE→SW along nave axis!)
    {
      id: "sov-roof-nave",
      style: "hip",
      assetId: "modular-suite/terrain/roof_oxidized_verdigris_copper.png",
      points: [pt(-7.2, 0), pt(4.4, 0)],
      widthCells: 14.4,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.56,
      ridgeCapStyle: "copper",
      ridgeColorHex: "#488B7D",
      eaveTrim: true,
      eaveTrimHex: "#1D3B35",
      dropShadow: 0.62,
      opacity: 1,
    },
    // SW Grand Apse Conical Spire Dome (Weathered Alpine Slate, 12 faceted gothic spire ribs!)
    {
      id: "sov-roof-apse-dome",
      style: "cone",
      assetId: "modular-suite/terrain/roof_weathered_slate_shingles.png",
      points: [pt(6.364, 0), pt(6.364 + 4.75, 0)],
      widthCells: 9.5,
      coneFacets: 12,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.58,
      ridgeCapStyle: "stone",
      ridgeColorHex: "#4E5D6C",
      eaveTrim: true,
      eaveTrimHex: "#1E252D",
      dropShadow: 0.65,
      opacity: 1,
    },
    // North Belfry Tower Conical Spire (Verdigris Copper)
    {
      id: "sov-roof-ntower-spire",
      style: "cone",
      assetId: "modular-suite/terrain/roof_oxidized_verdigris_copper.png",
      points: [pt(-7.07, -7.07), pt(-7.07, -7.07 - 3.28)],
      widthCells: 6.56,
      coneFacets: 12,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.56,
      ridgeCapStyle: "copper",
      ridgeColorHex: "#488B7D",
      eaveTrim: true,
      eaveTrimHex: "#1D3B35",
      dropShadow: 0.6,
      opacity: 1,
    },
    // East Aether-Lift Tower Conical Spire (Verdigris Copper)
    {
      id: "sov-roof-etower-spire",
      style: "cone",
      assetId: "modular-suite/terrain/roof_oxidized_verdigris_copper.png",
      points: [pt(-7.07, 7.07), pt(-7.07, 7.07 + 3.28)],
      widthCells: 6.56,
      coneFacets: 12,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.56,
      ridgeCapStyle: "copper",
      ridgeColorHex: "#488B7D",
      eaveTrim: true,
      eaveTrimHex: "#1D3B35",
      dropShadow: 0.6,
      opacity: 1,
    },
  ];
  roofLayer.roofs = [...(roofLayer.roofs ?? []), ...spireRoofs];

  // =========================================================================
  // BUILD 1F TRAIN-ENGINE ICE CREAM PARLOR ("STEAM & SCOOP EXPRESS"),
  // 2F LIVED-IN FAMILY APARTMENT & LOCOMOTIVE ROOF ON `ROOF`!
  // =========================================================================
  const ic1: IceCreamBuildBundle = {
    terrain: [],
    paths: [],
    walls: [],
    portals: [],
    objects: [],
    lights: [],
    dmNotes: [],
  };
  const { shopPoly, patioPoly } = buildIceCreamTrainShopAndFlat(doc, ic1, f2.b);
  // Upgrade the 5 imported Central Market Courtyard outdoor steps (dd-obj-1-37..41) from oversized
  // nautical quarterdeck steps to unified Berlin Granite Courtyard Stoops (plus warm oak steps for
  // the SE wooden market deck dd-obj-1-37!) at crisp 1.00x native scale!
  const courtyardStoopSizes: Record<string, number> = {
    "dd-obj-1-38": 1.48,
    "dd-obj-1-39": 1.48,
    "dd-obj-1-40": 1.48,
    "dd-obj-1-41": 1.38,
  };
  for (const o of groundObjectsLayer.objects ?? []) {
    const stoopSz = courtyardStoopSizes[o.id];
    if (stoopSz) {
      o.assetId = "modular-suite/props/stairs_architectural/stair_berlin_stoop_stone.png";
      o.widthCells = stoopSz;
      o.heightCells = stoopSz;
      if (o.id === "dd-obj-1-41") {
        o.y = 17.12;
      }
    } else if (o.id === "dd-obj-1-37") {
      // SE wooden market deck steps: match warm oak L-deck & pull flush with outer SE rim (zero corner clip!)
      o.assetId = "modular-suite/modular/arch_stairs_wood_wide.png";
      o.x = 28.08;
      o.y = 27.25;
      o.widthCells = 1.18;
      o.heightCells = 1.18;
    }
  }
  // Replace the 4 light-blocking Dungeondraft wall-bar hack segments (dd-wall-1-1..4) in the courtyard
  // entrance alley (19.5, 20.0) with a true hand-inked painterly stone staircase (2.12x2.12, 1.00x scale)!
  const hackStepWallIds = new Set(["dd-wall-1-1", "dd-wall-1-2", "dd-wall-1-3", "dd-wall-1-4"]);
  groundWallsLayer.walls = (groundWallsLayer.walls ?? []).filter((w) => !hackStepWallIds.has(w.id));
  groundObjectsLayer.objects!.push({
    id: "sov-1f-courtyard-alley-stairs",
    assetId: "modular-suite/modular/arch_stairs_stone_wide.png",
    x: 19.5,
    y: 20.0,
    widthCells: 2.12,
    heightCells: 2.12,
    rotationRad: (3 * Math.PI) / 4,
    flipX: false,
    flipY: false,
    opacity: 1,
    castsShadow: false,
    locked: false,
    recolor: { ...DEFAULT_RECOLOR },
    zOrder: 44,
  });
  const { aptPoly } = buildMessyApartmentBuilding(doc, ic1, f2.b, f3.b, f4.b);
  buildNeighborhoodPark(ic1);
  buildDistrictStreetsAndVigilStairs(ic1);
  buildAgedStreetcarLineAndWeathering(doc, ic1);
  buildCommunityKidTheater(doc, ic1);
  const { watchtowerPoly } = buildWatchtowerGarrison(doc, ic1, f2.b, f3.b, f4.b, f5.b);
  const { row1Poly, row2Poly, row3Poly, row4Poly } = buildBoulevardRowhouses(doc, ic1, f2.b, f3.b, f4.b);
  const { b1Layers, b2Layers, b3Layers } = buildSubterraneanDistrict(doc, ic1, templePoly, shopPoly, aptPoly);
  groundTerrainLayer.terrainStrokes!.push(...ic1.terrain);
  groundPathsLayer.paths!.push(...ic1.paths);
  groundWallsLayer.walls!.push(...ic1.walls);
  groundWallsLayer.portals!.push(...ic1.portals);
  groundObjectsLayer.objects!.push(...ic1.objects);
  f1.b.lights.push(...ic1.lights);
  f1.b.dmNotes.push(...ic1.dmNotes);

  // =========================================================================
  // ASSEMBLE 9 CLEAN LEVELS (B3, B2, B1, 1F, 2F, 3F, 4F, 5F, ROOF) & LAYER STACK
  // =========================================================================
  const lvl1Id = "lvl-dd-1";
  const lvlRoofId = "lvl-dd-0";
  const levels: MapLevel[] = [
    { id: "lvl-sov-b3", shortCode: "B3", name: "Deep Primordial Vault & Underground Caves", kind: "underground", elevationFt: -42, visible: false },
    { id: "lvl-sov-b2", shortCode: "B2", name: "Hidden Black-Site, Speakeasy & Sewers", kind: "underground", elevationFt: -28, visible: false },
    { id: "lvl-sov-b1", shortCode: "B1", name: "District Basements, Crypts & Cold Cellars", kind: "underground", elevationFt: -14, visible: false },
    { id: lvl1Id, shortCode: "1F", name: "Cathedral, Ice Cream Express & Tenement 1F", kind: "ground", elevationFt: 0, visible: true },
    { id: "lvl-sov-2f", shortCode: "2F", name: "Choir Gallery, Family Flat & Tenement 2F", kind: "upper", elevationFt: 14, visible: false },
    { id: "lvl-sov-3f", shortCode: "3F", name: "Dormitories, Dynamo & Tenement 3F", kind: "upper", elevationFt: 28, visible: false },
    { id: "lvl-sov-4f", shortCode: "4F", name: "Archives, Inquisition & Tenement 4F", kind: "upper", elevationFt: 42, visible: false },
    { id: "lvl-sov-5f", shortCode: "5F", name: "Sovereign's Crown Sanctum & Observatory", kind: "upper", elevationFt: 56, visible: false },
    { id: lvlRoofId, shortCode: "ROOF", name: "Cathedral Spires & City Roofs", kind: "roof", elevationFt: 70, visible: false },
  ];

  const makeUpperFloorLayers = (levelId: string, code: string, fb: FloorBundle): MapLayer[] => [
    {
      id: `layer-sov-terrain-${code.toLowerCase()}`,
      name: `${code} Floor & Masonry`,
      kind: "terrain",
      visible: false,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId,
      terrainStrokes: fb.terrain,
    },
    {
      id: `layer-sov-paths-${code.toLowerCase()}`,
      name: `${code} Carpets & Conduits`,
      kind: "paths",
      visible: false,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId,
      paths: fb.paths,
    },
    {
      id: `layer-sov-walls-${code.toLowerCase()}`,
      name: `${code} Walls & Portals`,
      kind: "walls",
      visible: false,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId,
      walls: fb.walls,
      portals: fb.portals,
    },
    {
      id: `layer-sov-objects-${code.toLowerCase()}`,
      name: `${code} Props & Furniture`,
      kind: "objects",
      visible: false,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId,
      objects: fb.objects,
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
      lights: fb.lights,
    },
  ];

  // Add 1F Lights layer right above 1F objects, plus unified DM Notes pins across all 5 floors!
  const f1LightsLayer: MapLayer = {
    id: "layer-sov-lights-1f",
    name: "1F Lights",
    kind: "lights",
    visible: true,
    locked: false,
    dmOnly: false,
    opacity: 1,
    blendMode: "normal",
    levelId: lvl1Id,
    lights: f1.b.lights,
  };

  // Update existing DM notes layer on 1F + add per-floor DM note layers for 2F–5F so notes match active floor!
  const dmNotes1F = doc.layers.find((l) => l.kind === "dm_notes")!;
  dmNotes1F.dmNotes = f1.b.dmNotes;

  const makeDmLayer = (levelId: string, code: string, notes: DmNotePin[]): MapLayer => ({
    id: `layer-sov-dm-${code.toLowerCase()}`,
    name: `${code} DM Notes`,
    kind: "dm_notes",
    visible: false,
    locked: false,
    dmOnly: true,
    opacity: 1,
    blendMode: "normal",
    levelId,
    dmNotes: notes,
  });

  // Cleanly re-order all layers bottom-to-top: B3 → B2 → B1 → 1F → 2F → 3F → 4F → 5F → ROOF
  const existing1FLayers = doc.layers.filter((l) => l.levelId === lvl1Id && l.kind !== "dm_notes");
  const newLayers: MapLayer[] = [
    ...b3Layers,
    ...b2Layers,
    ...b1Layers,
    ...existing1FLayers,
    f1LightsLayer,
    dmNotes1F,
    ...makeUpperFloorLayers("lvl-sov-2f", "2F", f2.b),
    makeDmLayer("lvl-sov-2f", "2F", f2.b.dmNotes),
    ...makeUpperFloorLayers("lvl-sov-3f", "3F", f3.b),
    makeDmLayer("lvl-sov-3f", "3F", f3.b.dmNotes),
    ...makeUpperFloorLayers("lvl-sov-4f", "4F", f4.b),
    makeDmLayer("lvl-sov-4f", "4F", f4.b.dmNotes),
    ...makeUpperFloorLayers("lvl-sov-5f", "5F", f5.b),
    makeDmLayer("lvl-sov-5f", "5F", f5.b.dmNotes),
    { ...roofLayer, name: "ROOF Cathedral Spires & City Roofs", visible: false },
  ];

  // Configure Dark Magipunk Lighting & Presets
  const finalDoc: DcMapDocument = {
    ...doc,
    id: "map-sovereign-temple-5f",
    meta: {
      title: "Cathedral of the Sovereign (5F)",
      author: "Dice Chaos Maps · Dark Magipunk Edition",
      createdAt: "2026-11-24T08:00:00.000Z",
      updatedAt: new Date().toISOString(),
    },
    levels,
    activeLevelId: lvl1Id,
    layers: newLayers,
    activeLayerId: groundObjectsLayer.id,
    lighting: {
      enabled: true,
      activePresetId: "sovereign_dusk",
      ambientColorHex: "#7A85A8",
      ambientIntensity: 0.64,
      shadowSoftness: 0.48,
      presets: [
        { id: "sovereign_dusk", name: "Dark Magipunk Dusk", ambientColorHex: "#7A85A8", ambientIntensity: 0.64 },
        { id: "midnight_vigil", name: "Midnight Vigil", ambientColorHex: "#242D4A", ambientIntensity: 0.28 },
        { id: "day", name: "Overcast Daylight", ambientColorHex: "#EAEFF7", ambientIntensity: 0.94 },
      ],
    },
  };

  // =========================================================================
  // AUTOMATED VALIDATION: ZERO MISSING ASSETS & ZERO WALL-CLIPPING OBJECTS!
  // =========================================================================
  const missingAssets = new Set<string>();
  const checkAsset = (id: string) => {
    if (!validAssetIds.has(id)) missingAssets.add(id);
  };
  checkAsset(finalDoc.canvas.baseTerrainAssetId);
  for (const l of finalDoc.layers) {
    for (const s of l.terrainStrokes ?? []) checkAsset(s.assetId);
    if (l.caveSystem) {
      checkAsset(l.caveSystem.floorAssetId);
      checkAsset(l.caveSystem.wallAssetId);
    }
    for (const w of l.waterRegions ?? []) {
      if (w.textureAssetId) checkAsset(w.textureAssetId);
    }
    for (const p of l.paths ?? []) checkAsset(p.assetId);
    for (const w of l.walls ?? []) checkAsset(w.assetId);
    for (const po of l.portals ?? []) checkAsset(po.assetId);
    for (const o of l.objects ?? []) checkAsset(o.assetId);
    for (const r of l.roofs ?? []) checkAsset(r.assetId);
  }
  if (missingAssets.size > 0) {
    throw new Error(`Invalid / missing Vault assetIds detected:\n  - ${[...missingAssets].join("\n  - ")}`);
  }

  // Verify every upper-floor object center lies cleanly inside its building polygon!
  let outsideWarnings = 0;
  for (const [code, fb] of [["2F", f2.b], ["3F", f3.b], ["4F", f4.b], ["5F", f5.b]] as const) {
    for (const o of fb.objects) {
      const p = { x: o.x, y: o.y };
      const inside =
        pointInPolygon(p, templePoly) ||
        pointInPolygon(p, watchtowerPoly) ||
        (code === "2F" && (pointInPolygon(p, shopPoly) || pointInPolygon(p, patioPoly) || pointInPolygon(p, row4Poly))) ||
        ((code === "2F" || code === "3F") && (pointInPolygon(p, row1Poly) || pointInPolygon(p, row3Poly))) ||
        ((code === "2F" || code === "3F" || code === "4F") && (pointInPolygon(p, aptPoly) || pointInPolygon(p, row2Poly)));
      if (!inside) {
        console.warn(`WARNING: ${code} object ${o.id} (${o.assetId}) at (${o.x}, ${o.y}) is OUTSIDE building bounds!`);
        outsideWarnings++;
      }
    }
  }
  if (outsideWarnings > 0) {
    throw new Error(`${outsideWarnings} upper-floor objects landed outside the cathedral walls!`);
  }

  // Write both outputs!
  const jsonText = JSON.stringify(finalDoc);
  fs.mkdirSync("src/data", { recursive: true });
  fs.writeFileSync("src/data/sovereignTempleDoc.json", jsonText, "utf8");
  fs.writeFileSync("Temple_of_the_Sovereign.dcmap", JSON.stringify(finalDoc, null, 2), "utf8");

  console.log("=== CATHEDRAL OF THE SOVEREIGN (5 FLOORS + ROOF) BUILT & VALIDATED ===");
  for (const lv of levels) {
    const lvLayers = finalDoc.layers.filter((l) => l.levelId === lv.id);
    const objs = lvLayers.reduce((n, l) => n + (l.objects?.length ?? 0), 0);
    const walls = lvLayers.reduce((n, l) => n + (l.walls?.length ?? 0), 0);
    const portals = lvLayers.reduce((n, l) => n + (l.portals?.length ?? 0), 0);
    const lights = lvLayers.reduce((n, l) => n + (l.lights?.length ?? 0), 0);
    const roofs = lvLayers.reduce((n, l) => n + (l.roofs?.length ?? 0), 0);
    console.log(
      `  ${lv.shortCode.padEnd(4)} (+${String(lv.elevationFt).padStart(2)}ft) ${lv.name.padEnd(40)} | objs=${String(objs).padStart(3)} walls=${String(walls).padStart(2)} portals=${String(portals).padStart(2)} lights=${String(lights).padStart(2)} roofs=${roofs}`,
    );
  }
  console.log(
    `Output sizes: src/data/sovereignTempleDoc.json (${(jsonText.length / 1024).toFixed(1)} KB), Temple_of_the_Sovereign.dcmap`,
  );
}

main();

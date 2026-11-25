/**
 * Builds the 2-Story Dark Magipunk Train-Engine Ice Cream Parlor ("The Steam & Scoop Express")
 * with its continuous miniature perimeter delivery train on 1F, the warm lived-in Gelato-Maker
 * Family Apartment & Sunny Balcony directly above it on 2F, and a custom Slate & Verdigris
 * Copper Locomotive Roof on ROOF (+70ft).
 *
 * Coordinates anchor directly to `dd-shape-floor-1-8` (28-vertex rounded-nose building)
 * and `dd-pat-1-1` (adjacent SE red-brick patio) from `MrRogers.dungeondraft_map`.
 */

import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type DmNotePin,
  type LightNode,
  type MapLayer,
  type ObjectStamp,
  type Point2D,
  type PortalNode,
  type RgbRecolor,
  type RoofStructure,
  type SplinePath,
  type TerrainStroke,
  type WallSegment,
} from "@/types/map";

const S = Math.SQRT1_2;
const SHOP_OX = 20.0;
const SHOP_OY = 22.0;
const NOSE_CX = 15.5;
const NOSE_CY = 25.5;

/**
 * Local shop frame `(su, sv)` anchored at center of the NE back wall `(20.0, 22.0)`:
 *  - `+su` runs SW along locomotive axis (`su = 0` at NE wall, `su = 5.657` at nose center, `su ≈ 8.15` at SW nose tip)
 *  - `+sv` runs SE across locomotive width (`sv = -2.828` at NW straight wall, `sv = +2.828` at SE wall, `sv = +5.657` at SE brick patio outer edge)
 */
export function shopPt(su: number, sv: number): Point2D {
  return {
    x: Math.round((SHOP_OX - S * su + S * sv) * 1000) / 1000,
    y: Math.round((SHOP_OY + S * su + S * sv) * 1000) / 1000,
  };
}

function shopRect(su0: number, sv0: number, su1: number, sv1: number): Point2D[] {
  return [shopPt(su0, sv0), shopPt(su0, sv1), shopPt(su1, sv1), shopPt(su1, sv0)];
}

function worldCircle(cx: number, cy: number, r: number, segs = 24): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push({
      x: Math.round((cx + Math.cos(a) * r) * 1000) / 1000,
      y: Math.round((cy + Math.sin(a) * r) * 1000) / 1000,
    });
  }
  return pts;
}

// Cardinal orientations for front-down (+Y) top-down sprites in the 45°-rotated shop frame:
const FACE_SW = Math.PI / 4; // Front faces +su (SW toward curved locomotive nose)
const FACE_NE = (-3 * Math.PI) / 4; // Front faces -su (NE toward courtyard back wall)
const FACE_SE = -Math.PI / 4; // Front faces +sv (SE toward brick patio; backs onto NW wall)
const FACE_NW = (3 * Math.PI) / 4; // Front faces -sv (NW toward tramway; backs onto SE wall)

const PORTAL_ALONG_SV = Math.PI / 4; // Wall running constant su (NE back wall, interior cross partitions)
const PORTAL_ALONG_SU = -Math.PI / 4; // Wall running constant sv (NW & SE long walls)

function tint(hex: string, mode: "dd_red" | "tint" = "dd_red", strength = 0.88): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode, tintHex: hex, strength };
}

const PARLOR_CRIMSON = tint("#9B1D2E", "dd_red", 0.9);
const KID_TEAL = tint("#1D8A99", "dd_red", 0.9);
const WARM_MUSTARD = tint("#C99236", "dd_red", 0.88);
const IVORY_LINEN = tint("#F4EBDC", "dd_red", 0.84);
const COZY_PLUM = tint("#6B2D5C", "dd_red", 0.88);

export interface IceCreamBuildBundle {
  terrain: TerrainStroke[];
  paths: SplinePath[];
  walls: WallSegment[];
  portals: PortalNode[];
  objects: ObjectStamp[];
  lights: LightNode[];
  dmNotes: DmNotePin[];
}

function makeScopedBuilder(prefix: string) {
  let seq = 0;
  const uid = (p: string) => `ic-${prefix}-${p}-${++seq}`;
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
  ) => wall(assetId, uvPts.map(([u, v]) => shopPt(u, v)), opts);

  const portalWorld = (
    assetId: string,
    x: number,
    y: number,
    rotationRad: number,
    kind: PortalNode["kind"],
    widthCells = 1.05,
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

  const portalUV = (
    assetId: string,
    su: number,
    sv: number,
    rotationRad: number,
    kind: PortalNode["kind"],
    widthCells = 1.05,
    closed = true,
    wallId?: string,
  ) => {
    const p = shopPt(su, sv);
    portalWorld(assetId, p.x, p.y, rotationRad, kind, widthCells, closed, wallId);
  };

  const splineWorld = (
    assetId: string,
    points: Point2D[],
    widthCells: number,
    opts: { curved?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    b.paths.push({
      id: uid("pth"),
      assetId,
      points,
      widthCells,
      curved: opts.curved ?? false,
      taperEnds: false,
      fadeEnds: false,
      opacity: opts.opacity ?? 1,
      blocksScatter: false,
      recolor: opts.recolor,
    });
  };

  const objWorld = (
    assetId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    rot: number,
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

  const objUV = (
    assetId: string,
    su: number,
    sv: number,
    w: number,
    h: number,
    rot: number,
    opts: { z?: number; shadow?: boolean; flipX?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    const p = shopPt(su, sv);
    objWorld(assetId, p.x, p.y, w, h, rot, opts);
  };

  const lightWorld = (
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

  const lightUV = (
    name: string,
    su: number,
    sv: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.9,
    opts: { castShadows?: boolean; flicker?: boolean } = {},
  ) => {
    const p = shopPt(su, sv);
    lightWorld(name, p.x, p.y, radiusCells, colorHex, intensity, opts);
  };

  const noteUV = (
    badge: DmNotePin["badge"],
    su: number,
    sv: number,
    title: string,
    body: string,
    colorHex: string,
  ) => {
    const p = shopPt(su, sv);
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

  return {
    b,
    floorPoly,
    wall,
    wallUV,
    portalWorld,
    portalUV,
    splineWorld,
    objWorld,
    objUV,
    lightWorld,
    lightUV,
    noteUV,
  };
}

/**
 * Adds the 1F Train-Engine Ice Cream Parlor ("The Steam & Scoop Express"),
 * its continuous miniature perimeter brass delivery train, the 2F Lived-In Family Apartment
 * & Sunny Balcony directly above it, and the custom Locomotive Roof on ROOF (+70ft).
 */
export function buildIceCreamTrainShopAndFlat(
  doc: DcMapDocument,
  f1Bundle: IceCreamBuildBundle,
  f2Bundle: IceCreamBuildBundle,
): { shopPoly: Point2D[]; patioPoly: Point2D[] } {
  const groundTerrainLayer = doc.layers.find((l) => l.id === "layer-dd-terrain-1")!;
  const groundWallsLayer = doc.layers.find((l) => l.id === "layer-dd-walls-1")!;
  const groundObjectsLayer = doc.layers.find((l) => l.id === "layer-dd-objects-1")!;
  const roofLayer = doc.layers.find((l) => l.kind === "roofs")!;

  const shopFloorStroke = groundTerrainLayer.terrainStrokes!.find((s) => s.id === "dd-shape-floor-1-8");
  const patioFloorStroke = groundTerrainLayer.terrainStrokes!.find((s) => s.id === "dd-pat-1-1");
  if (!shopFloorStroke || !patioFloorStroke) {
    throw new Error("Could not locate Ice Cream Shop (dd-shape-floor-1-8) or SE Patio (dd-pat-1-1)!");
  }
  const shopPoly: Point2D[] = structuredClone(shopFloorStroke.points);
  const patioPoly: Point2D[] = structuredClone(patioFloorStroke.points);

  // Remove old plain perimeter wall (dd-wall-1-19) & its 3 plain doors so we upgrade to warm
  // Bakery Red Brick + brass doors + storefront display glass windows!
  const oldWallIdx = groundWallsLayer.walls!.findIndex((w) => w.id === "dd-wall-1-19");
  if (oldWallIdx >= 0) {
    groundWallsLayer.walls!.splice(oldWallIdx, 1);
    groundWallsLayer.portals = (groundWallsLayer.portals ?? []).filter((p) => p.wallId !== "dd-wall-1-19");
  }

  // Remove the 7 generic DD placeholder objects inside/around the shop (bare L-counters & blank circles)
  const placeholderIds = new Set([
    "dd-obj-1-3",
    "dd-obj-1-4",
    "dd-obj-1-5",
    "dd-obj-1-33",
    "dd-obj-1-34",
    "dd-obj-1-35",
    "dd-obj-1-36",
  ]);
  groundObjectsLayer.objects = (groundObjectsLayer.objects ?? []).filter((o) => !placeholderIds.has(o.id));

  // Align the existing courtyard wooden stairs (`dd-obj-1-38`) cleanly with the shop's NE courtyard door!
  const courtyardStairs = groundObjectsLayer.objects.find((o) => o.id === "dd-obj-1-38");
  if (courtyardStairs) {
    courtyardStairs.x = 20.68;
    courtyardStairs.y = 21.38;
  }

  // =========================================================================
  // 1F — "THE STEAM & SCOOP EXPRESS" (TRAIN-ENGINE ICE CREAM PARLOR)
  // =========================================================================
  const s1 = makeScopedBuilder("1f");

  // Vintage checkered marble parlor bay inlay inside the curved SW locomotive boiler nose!
  s1.floorPoly(
    "core-fantasy/terrain/mansion_checkered_marble.png",
    worldCircle(NOSE_CX, NOSE_CY, 2.08, 28),
    0.85,
  );

  // Upgraded Warm Red-Brick Storefront Perimeter Wall + Brass/Oak Doors + Parlor Glass Windows!
  const w1Shop = s1.wall("modular-suite/walls/wall_bakery_brick.png", shopPoly, {
    closed: true,
    thickness: 0.17,
    blocksLight: true,
  });

  // 3 Doors in the exact original openings:
  // 1) SW Boulevard Customer Entrance (cracked welcomingly open!)
  s1.portalWorld("portals/jugendstil_brass_door.png", 16.48, 28.48, (-3 * Math.PI) / 4, "door", 1.1, false, w1Shop);
  // 2) SE Summer Tender Patio Door (open to brick terrace!)
  s1.portalWorld("portals/station_oak_door.png", 18.32, 27.68, (3 * Math.PI) / 4, "door", 1.0, false, w1Shop);
  // 3) NE Courtyard Back Door
  s1.portalWorld("portals/station_oak_door.png", 20.03, 22.03, Math.PI / 4, "door", 1.0, true, w1Shop);

  // Storefront Display Windows along NW tram-side wall, SE patio wall, and the curved SW boiler nose!
  s1.portalUV("modular-suite/portals/portal_bakery_window.png", 1.55, -2.828, PORTAL_ALONG_SU, "window", 1.45, true, w1Shop);
  s1.portalUV("modular-suite/portals/portal_bakery_window.png", 3.35, -2.828, PORTAL_ALONG_SU, "window", 1.35, true, w1Shop);
  s1.portalUV("modular-suite/portals/portal_bakery_window.png", 2.85, 2.828, PORTAL_ALONG_SU, "window", 1.55, true, w1Shop);
  // 3 curved bay windows around the semicircular locomotive boiler nose!
  for (const deg of [118, 175, 228]) {
    const rad = (deg * Math.PI) / 180;
    const wx = NOSE_CX + Math.cos(rad) * 2.5;
    const wy = NOSE_CY + Math.sin(rad) * 2.5;
    s1.portalWorld("modular-suite/portals/portal_bakery_window.png", wx, wy, rad + Math.PI / 2, "window", 1.2, true, w1Shop);
  }

  // ── SIGNATURE FEATURE: CONTINUOUS MINIATURE BRASS PERIMETER TRAIN TRACK ──
  // Hugs cleanly inside the ENTIRE locomotive shop edge (closed oval/D-loop with crisp window & door clearance)!
  const rTrack = 1.84;
  const noseArcPt = (deg: number): Point2D => {
    const rad = (deg * Math.PI) / 180;
    return {
      x: Math.round((NOSE_CX + Math.cos(rad) * rTrack) * 1000) / 1000,
      y: Math.round((NOSE_CY + Math.sin(rad) * rTrack) * 1000) / 1000,
    };
  };

  const trackLoopPts: Point2D[] = [
    // SW curved boiler nose arc (clockwise: South → SW → West → NW)
    noseArcPt(78),
    noseArcPt(105),
    noseArcPt(132),
    noseArcPt(160),
    noseArcPt(188),
    noseArcPt(216),
    noseArcPt(244),
    // Straight NW street-window wall run back toward NE corner
    shopPt(3.85, -2.14),
    shopPt(2.15, -2.14),
    shopPt(0.88, -2.08),
    // Smooth NE back-wall sweep
    shopPt(0.62, -1.48),
    shopPt(0.62, 0.0),
    shopPt(0.62, 1.48),
    // Smooth SE patio-wall straight run (inset cleanly clear of open door leaf!)
    shopPt(0.92, 2.12),
    shopPt(2.6, 2.14),
    shopPt(4.5, 2.14),
    shopPt(6.0, 2.02),
    shopPt(6.4, 1.38),
    // Close the loop seamlessly!
    noseArcPt(78),
  ];
  s1.splineWorld("modular-suite/paths/ic_mini_brass_track.png", trackLoopPts, 0.48, { curved: true });

  // ── 4-CAR MINIATURE BRASS & CRIMSON DELIVERY TRAIN CHUGGING AROUND THE EDGE! ──
  // Placed cleanly ON the curved nose rail arc with exact clockwise tangent rotation (`rad + Math.PI / 2`)!
  const placeTrainCarOnArc = (
    assetId: string,
    deg: number,
    lenCells: number,
    widCells: number,
    zOrder: number,
  ) => {
    const rad = (deg * Math.PI) / 180;
    const cx = NOSE_CX + Math.cos(rad) * rTrack;
    const cy = NOSE_CY + Math.sin(rad) * rTrack;
    s1.objWorld(assetId, cx, cy, lenCells, widCells, rad + Math.PI / 2, { z: zOrder });
    return { cx, cy };
  };

  // Lead Miniature Steam Engine steaming clockwise around the curved front boiler nose!
  const enginePos = placeTrainCarOnArc("modular-suite/props/ice_cream_train/ic_mini_train_engine.png", 214, 1.12, 0.41, 74);
  // Car 2: Sundae & Banana Split Flatcar
  placeTrainCarOnArc("modular-suite/props/ice_cream_train/ic_mini_train_sundae_car.png", 178, 0.96, 0.42, 73);
  // Car 3: Milkshake & Copper Cream Tanker Car
  placeTrainCarOnArc("modular-suite/props/ice_cream_train/ic_mini_train_milkshake_car.png", 142, 0.98, 0.34, 73);
  // Car 4: Second Sundae Delivery Flatcar trailing smoothly behind!
  placeTrainCarOnArc("modular-suite/props/ice_cream_train/ic_mini_train_sundae_car.png", 107, 0.96, 0.42, 72);

  // Tiny Brass Semaphore Signal right beside the back-counter mini-train dispatch stop!
  s1.objUV("objects/semaphore_signal_post.png", 1.05, -1.62, 0.52, 0.52, FACE_SW, { z: 75 });

  // ── INTERIOR TRAIN-ENGINE ICE CREAM SERVICE ISLAND & CUSTOMER SEATING ──
  // Hero Centerpiece: Curved Brass & Riveted Iron Locomotive Boiler Ice Cream Showcase Counter!
  s1.objUV("modular-suite/props/ice_cream_train/ic_locomotive_scoop_counter.png", 2.9, 0.12, 2.7, 1.06, FACE_SW, {
    z: 66,
  });
  // Waffle Cone & Sundae Topping Bar tucked right behind the counter for the family scooping crew!
  s1.objUV("modular-suite/props/ice_cream_train/ic_waffle_cone_station.png", 1.58, -0.64, 1.88, 0.85, FACE_SW, {
    z: 64,
  });
  // Magipunk Cryo-Aether Steam-Boiler Ice Cream Churner humming with icy cyan coils in the back prep corner!
  s1.objUV("modular-suite/props/ice_cream_train/ic_cryo_aether_churner.png", 1.65, 1.04, 1.35, 1.0, FACE_SW, {
    z: 65,
  });
  // Counter service bell & freshly frosted strawberry parlor cake + cookies!
  s1.objUV("modular-suite/props/post_office/po_brass_desk_bell.png", 2.75, 1.24, 0.35, 0.35, 0, { z: 70, shadow: false });
  s1.objUV("modular-suite/props/bakery/bak_strawberry_cake.png", 1.52, -1.2, 0.5, 0.5, 0.3, { z: 68, shadow: false });
  s1.objUV("modular-suite/props/bakery/bak_cookie_cooling_rack.png", 2.3, 1.4, 0.62, 0.52, FACE_NW, { z: 62 });
  // Brass shopkeeper strongbox tucked safely behind the counter
  s1.objUV("modular-suite/props/post_office/po_iron_strongbox.png", 2.25, -1.4, 0.65, 0.5, FACE_SE, { z: 60 });

  // Customer Bar Stools pulled right up to the Locomotive Gelato Counter!
  s1.objUV("modular-suite/props/tavern_clutter/tav_round_bar_stool.png", 3.8, -0.45, 0.58, 0.58, 0, { z: 60 });
  s1.objUV("modular-suite/props/tavern_clutter/tav_round_bar_stool.png", 3.8, 0.28, 0.58, 0.58, 0, { z: 60 });
  s1.objUV("modular-suite/props/tavern_clutter/tav_round_bar_stool.png", 3.8, 1.0, 0.58, 0.58, 0, { z: 60 });

  // Two Bespoke Marble Parlor Bistro Tables with Sundaes inside the rounded SW boiler nose (clean clearance from mini train!)
  s1.objUV("modular-suite/props/ice_cream_train/ic_parlor_bistro_sundae_table.png", 5.05, -0.95, 1.48, 0.88, FACE_SW, {
    z: 64,
  });
  s1.objUV("modular-suite/props/ice_cream_train/ic_parlor_bistro_sundae_table.png", 5.35, 0.58, 1.48, 0.88, FACE_SE + 0.35, {
    z: 64,
  });
  // Coir welcome doormat just inside the street customer entrance
  s1.objUV("modular-suite/props/bedroom_home/home_woven_doormat.png", 6.55, 1.95, 0.85, 0.55, FACE_NE, {
    z: 42,
    shadow: false,
  });

  // ── EXTERIOR LOCOMOTIVE STOREFRONT FACADE, AWNINGS & SUMMER "TENDER" BRICK PATIO ──
  // Showstopping Brass & Crimson Locomotive Cowcatcher + Glowing Golden Headlamp mounted right on the curved nose!
  s1.objWorld(
    "modular-suite/props/ice_cream_train/ic_locomotive_cowcatcher_facade.png",
    12.78,
    25.48,
    2.65,
    1.62,
    Math.PI / 2 - 0.14,
    { z: 78 },
  );

  // Striped Crimson & Cream Storefront Awnings hugging NW tram-side windows and SE Tender Patio!
  s1.objUV("modular-suite/props/ice_cream_train/ic_striped_parlor_awning.png", 2.1, -3.28, 2.85, 1.02, FACE_NW, {
    z: 84,
  });
  s1.objUV("modular-suite/props/ice_cream_train/ic_striped_parlor_awning.png", 4.3, 3.22, 2.9, 1.02, FACE_SE, {
    z: 84,
  });

  // Outdoor NW sidewalk marble sundae bistro table + potted fern clearly visible right beside the NW awning!
  s1.objUV("modular-suite/props/ice_cream_train/ic_parlor_bistro_sundae_table.png", 4.05, -3.55, 1.38, 0.82, FACE_NW, {
    z: 64,
  });
  s1.objUV("modular-suite/props/bedroom_home/home_potted_fern.png", 0.3, -3.35, 0.78, 0.78, 0.2, { z: 66 });

  // SE Red-Brick "Coal Tender" Summer Ice Cream Patio (su: 0.71..6.36, sv: 2.83..5.66):
  // Private family oak staircase with burgundy runner hugging the SE shop wall (1.00x native aspect, climbing SW straight up to 2F Family Flat door!)
  s1.objUV("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", 1.9, 3.44, 1.0, 1.545, FACE_NE, { z: 58 });
  // Two sunny patio Marble Sundae Bistro Tables peeking cleanly outside the striped awning!
  s1.objUV("modular-suite/props/ice_cream_train/ic_parlor_bistro_sundae_table.png", 3.5, 4.48, 1.52, 0.9, FACE_SW, {
    z: 64,
  });
  s1.objUV("modular-suite/props/ice_cream_train/ic_parlor_bistro_sundae_table.png", 5.38, 4.58, 1.52, 0.9, FACE_SE, {
    z: 64,
  });
  s1.objUV("modular-suite/props/bedroom_home/home_potted_fern.png", 6.0, 3.25, 0.78, 0.78, 0.4, { z: 66 });
  s1.objUV("modular-suite/props/music_theater_tea/tea_rose_basket.png", 5.95, 5.2, 0.7, 0.7, -0.3, { z: 66 });
  s1.objUV("modular-suite/props/music_theater_tea/mus_festival_bunting.png", 3.5, 5.25, 2.5, 0.62, FACE_NW, {
    z: 86,
    shadow: false,
  });
  s1.objUV("objects/station_lamp_post.png", 2.4, 5.2, 0.82, 0.82, 0, { z: 80 });

  // 1F Overhead Cafe Pendants, Storefront Gooseneck Wall Lamp & Dynamic Lighting for the Train-Engine Ice Cream Parlor!
  s1.objUV("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 3.1, 0.1, 1.15, 1.15, FACE_SW, {
    z: 90,
    opacity: 0.9,
    shadow: false,
  });
  s1.objUV("modular-suite/props/harmony_lighting/lgt_ceiling_victorian_amber_pendant.png", 5.2, -0.2, 1.1, 1.1, FACE_SW, {
    z: 90,
    opacity: 0.9,
    shadow: false,
  });
  s1.objUV("modular-suite/props/harmony_lighting/lgt_sconce_storefront_gooseneck.png", 3.5, 3.04, 0.58, 0.58, FACE_SE, {
    z: 78,
    shadow: false,
  });
  s1.lightWorld("Locomotive Nose Golden Headlamp", 12.15, 25.45, 6.2, "#FFD166", 1.15);
  s1.lightWorld("Mini-Train Engine Headlight", enginePos.cx, enginePos.cy, 3.6, "#FFBE5C", 0.9, { flicker: true });
  s1.lightUV("Gelato Showcase Warm Pendant", 3.1, 0.1, 6.4, "#FFE0A3", 1.05);
  s1.lightUV("Cryo-Aether Churner Frost Glow", 1.62, 1.08, 4.0, "#38BDF8", 0.85);
  s1.lightUV("Parlor Bay Window Pendant", 5.2, -0.2, 5.2, "#FFCC70", 0.9, { flicker: true });
  s1.lightUV("Tender Patio Station Lamp", 3.5, 4.6, 6.0, "#FFA94D", 0.95, { flicker: true });

  s1.noteUV(
    "NOTE",
    5.8,
    5.0,
    "1F · Steam & Scoop Express",
    "Locomotive-themed dark-magipunk ice cream parlor. A miniature brass steam train runs continuously around the shop's perimeter rails delivering sundaes & milkshakes; private back stairs on the brick Tender Patio lead up to the family's 2F flat.",
    "#F59E0B",
  );

  // =========================================================================
  // 2F (+14ft) — GELATO-MAKER FAMILY'S LIVED-IN APARTMENT & SUNNY BALCONY!
  // =========================================================================
  const s2 = makeScopedBuilder("2f");

  // Full sealed 2F floor over the entire rounded-nose shop footprint + Sunny Wooden Balcony over SE Brick Patio!
  s2.floorPoly("core-fantasy/terrain/aged_dark_floorboards.png", shopPoly);
  s2.floorPoly("modular-suite/terrain/clinic_white_tile.png", shopRect(0.08, 1.15, 1.85, 2.78));
  s2.floorPoly("core-fantasy/terrain/tavern_oak_planks.png", patioPoly);

  // Exterior 2F Red-Brick Apartment Walls + Windows
  const w2Shop = s2.wall("modular-suite/walls/wall_bakery_brick.png", shopPoly, {
    closed: true,
    thickness: 0.17,
    blocksLight: true,
  });
  // Private Family Entry Door from the 2F Sunny Balcony into the Family Kitchen/Living Parlor!
  s2.portalUV("portals/station_oak_door.png", 3.35, 2.828, PORTAL_ALONG_SU, "door", 1.0, false, w2Shop);
  // Warm apartment windows overlooking the tramway, courtyard & curved SW bay!
  s2.portalUV("modular-suite/portals/portal_bakery_window.png", 1.5, -2.828, PORTAL_ALONG_SU, "window", 1.35, true, w2Shop);
  s2.portalUV("modular-suite/portals/portal_bakery_window.png", 3.4, -2.828, PORTAL_ALONG_SU, "window", 1.2, true, w2Shop);
  s2.portalUV("modular-suite/portals/portal_bakery_window.png", 0.0, -0.5, PORTAL_ALONG_SV, "window", 1.25, true, w2Shop);
  for (const deg of [118, 175, 228]) {
    const rad = (deg * Math.PI) / 180;
    s2.portalWorld(
      "modular-suite/portals/portal_bakery_window.png",
      NOSE_CX + Math.cos(rad) * 2.5,
      NOSE_CY + Math.sin(rad) * 2.5,
      rad + Math.PI / 2,
      "window",
      1.15,
      true,
      w2Shop,
    );
  }

  // Open-Railed Wrought-Iron Family Balcony Guardrail around the 3 outer sides of the SE Balcony (blocksLight: false!)
  s2.wallUV(
    "walls/jugendstil_iron_balustrade.png",
    [
      [0.71, 2.83],
      [0.71, 5.66],
      [6.36, 5.66],
      [6.36, 2.83],
    ],
    { closed: false, thickness: 0.13, blocksLight: false },
  );

  // Cozy Interior Room Partition Walls:
  // 1) Kids' "Caboose" Bedroom divider across the rounded SW boiler nose (su = 4.25)
  const w2Kids = s2.wallUV("modular-suite/walls/wall_bakery_brick.png", [[4.25, -2.8], [4.25, 2.8]], {
    thickness: 0.13,
    blocksLight: true,
  });
  s2.portalUV("portals/station_oak_door.png", 4.25, 0.95, PORTAL_ALONG_SV, "door", 0.92, false, w2Kids);

  // 2) Parents' Master Bedroom divider on NW side (sv = -0.55, su = 0..4.25)
  const w2Parents = s2.wallUV("modular-suite/walls/wall_bakery_brick.png", [[0.0, -0.55], [4.25, -0.55]], {
    thickness: 0.13,
    blocksLight: true,
  });
  s2.portalUV("portals/station_oak_door.png", 2.45, -0.55, PORTAL_ALONG_SU, "door", 0.9, true, w2Parents);

  // 3) Small Family Washroom alcove in NE corner (su = 0..1.85, sv = 1.15..2.8)
  const w2Bath = s2.wallUV("modular-suite/walls/wall_bakery_brick.png", [[0.0, 1.15], [1.85, 1.15], [1.85, 2.8]], {
    thickness: 0.12,
    blocksLight: true,
  });
  s2.portalUV("portals/station_oak_door.png", 1.85, 1.95, PORTAL_ALONG_SV, "door", 0.85, true, w2Bath);

  // ── ROOM 1: KIDS' "CABOOSE" BEDROOM IN THE CURVED SW BOILER NOSE! ──
  // Bespoke Kids' Patchwork Bed, Teddy Bear & Wooden Toy Train Playmat right in the sunlit curved bay!
  s2.objUV("modular-suite/props/ice_cream_train/ic_kids_bunk_bed_train.png", 5.85, -0.82, 2.45, 1.78, FACE_SW, {
    z: 62,
  });
  // Younger sibling's cheerful teal twin bed along the SE side of the kids' room
  s2.objUV("core-fantasy/colorable/inn_single_bed_colorable.png", 5.85, 1.65, 1.15, 1.8, FACE_NW, {
    z: 60,
    recolor: KID_TEAL,
  });
  // Toy chest, kids' bedside nightstand + amber lamp, cozy floor lamp, paint palette & blue flower vase!
  s2.objUV("modular-suite/props/bedroom_home/home_brass_footlocker.png", 4.78, -2.05, 0.95, 0.65, FACE_SE, { z: 62 });
  s2.objUV("modular-suite/props/bedroom_home/home_bare_nightstand.png", 4.75, 1.45, 0.56, 0.56, FACE_SW, { z: 58 });
  s2.objUV("modular-suite/props/harmony_lighting/lgt_table_bedside_amber_lamp.png", 4.75, 1.45, 0.42, 0.42, 0, {
    z: 66,
    shadow: false,
  });
  s2.objUV("modular-suite/props/harmony_lighting/lgt_floor_parlor_pleated_cream.png", 6.65, 0.25, 0.72, 0.72, 0, { z: 66 });
  s2.objUV("modular-suite/props/music_theater_tea/mus_artist_palette.png", 4.85, 2.15, 0.55, 0.55, 0.4, { z: 65 });
  s2.objUV("modular-suite/props/bedroom_home/home_blue_flower_vase.png", 7.35, -0.65, 0.55, 0.55, 0, { z: 65 });

  // ── ROOM 2: PARENTS' COZY MASTER BEDROOM (NW WING) ──
  s2.objUV("core-fantasy/colorable/woven_oval_rug_colorable.png", 2.1, -1.6, 2.1, 1.45, FACE_SE, {
    z: 40,
    shadow: false,
    recolor: WARM_MUSTARD,
  });
  s2.objUV("core-fantasy/colorable/inn_double_bed_colorable.png", 1.15, -1.7, 1.55, 1.8, FACE_SW, {
    z: 60,
    recolor: PARLOR_CRIMSON,
  });
  s2.objUV("modular-suite/props/bedroom_home/home_bare_nightstand.png", 0.52, -0.92, 0.58, 0.58, FACE_SW, { z: 60 });
  s2.objUV("modular-suite/props/harmony_lighting/lgt_table_bedside_cream_lamp.png", 0.52, -0.92, 0.44, 0.44, 0, {
    z: 66,
    shadow: false,
  });
  s2.objUV("modular-suite/props/bedroom_home/home_oak_wardrobe.png", 3.62, -2.18, 1.12, 0.78, FACE_NE, { z: 62 });
  s2.objUV("modular-suite/props/bedroom_home/home_vanity_mirror_brush.png", 3.62, -1.05, 1.05, 0.75, FACE_NE, { z: 62 });
  s2.objUV("modular-suite/props/bedroom_home/home_patchwork_quilts.png", 2.45, -2.35, 0.65, 0.62, 0.25, { z: 62 });
  // Curled orange family tabby cat snoozing peacefully on the bedroom rug!
  s2.objUV("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 2.15, -1.4, 0.68, 0.68, -0.6, { z: 66 });

  // ── ROOM 3: FAMILY WASHROOM ALCOVE (NE TILED CORNER) ──
  s2.objUV("modular-suite/props/bedroom_home/home_copper_bathtub.png", 0.72, 2.02, 1.38, 0.85, FACE_SW, { z: 60 });
  s2.objUV("modular-suite/props/bedroom_home/home_washstand_basin.png", 1.38, 1.48, 0.78, 0.62, FACE_SE, { z: 60 });
  s2.objUV("modular-suite/colorable/col_folded_towels.png", 0.55, 1.48, 0.52, 0.52, 0.2, {
    z: 62,
    recolor: IVORY_LINEN,
  });

  // ── ROOM 4: HEART OF THE HOME — FAMILY KITCHEN, DINING & PARLOR LOUNGE! ──
  s2.objUV("core-fantasy/colorable/parlor_rug_rect_colorable.png", 2.95, 0.55, 2.35, 1.55, FACE_SW, {
    z: 40,
    shadow: false,
    recolor: COZY_PLUM,
  });
  // Lived-in Family Kitchen Dining Table with 4 casual chairs, cherry pie, porcelain tea set, jam jars & shop ledger!
  s2.objUV("modular-suite/modular/bare_oak_banquet_table.png", 2.95, 0.55, 1.75, 0.98, FACE_SW, { z: 58 });
  s2.objUV("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 2.2, 0.22, 0.65, 0.65, FACE_SW + 0.14, { z: 55 });
  s2.objUV("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 2.2, 0.92, 0.65, 0.65, FACE_SW - 0.12, { z: 55 });
  s2.objUV("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 3.68, 0.22, 0.65, 0.65, FACE_NE - 0.16, { z: 55 });
  s2.objUV("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 3.68, 0.92, 0.65, 0.65, FACE_NE + 0.1, { z: 55 });
  s2.objUV("modular-suite/props/bakery/bak_lattice_cherry_pie.png", 2.88, 0.35, 0.48, 0.48, 0.2, {
    z: 66,
    shadow: false,
  });
  s2.objUV("modular-suite/props/music_theater_tea/tea_porcelain_set.png", 3.15, 0.72, 0.55, 0.48, FACE_SW, {
    z: 66,
    shadow: false,
  });
  s2.objUV("modular-suite/props/post_office/po_open_ledger.png", 2.68, 0.85, 0.48, 0.38, FACE_SE, {
    z: 66,
    shadow: false,
  });
  s2.objUV("modular-suite/props/harmony_lighting/lgt_ceiling_parlor_pleated_pendant.png", 2.95, 0.55, 1.12, 1.12, 0, {
    z: 90,
    opacity: 0.88,
    shadow: false,
  });

  // Family Kitchenette (cast-iron cookstove, copper soup pot, butcher block, fresh sourdough — clean door clearance!)
  s2.objUV("modular-suite/props/kitchen/kit_iron_cookstove.png", 2.38, 2.25, 1.1, 0.92, FACE_NW, { z: 62 });
  s2.objUV("modular-suite/props/kitchen/kit_copper_stockpot.png", 2.36, 2.2, 0.44, 0.44, 0, { z: 68, shadow: false });
  s2.objUV("modular-suite/props/kitchen/kit_butcher_block.png", 3.88, 2.08, 0.76, 0.7, FACE_NW, { z: 60 });
  s2.objUV("modular-suite/props/kitchen/kit_sourdough_boule.png", 3.86, 2.04, 0.4, 0.4, 0.3, {
    z: 66,
    shadow: false,
  });
  // Entry hall gramophone, coat rack & coir doormat!
  s2.objUV("modular-suite/props/music_theater_tea/mus_brass_gramophone.png", 0.62, 0.28, 0.72, 0.72, FACE_SW, { z: 64 });
  s2.objUV("modular-suite/props/school_courtroom/sch_coat_rack_stand.png", 1.35, 0.08, 0.7, 0.7, 0.2, { z: 64 });
  s2.objUV("modular-suite/props/bedroom_home/home_woven_doormat.png", 3.35, 2.38, 0.72, 0.48, FACE_NW, {
    z: 42,
    shadow: false,
  });

  // ── ROOM 5: SUNNY OPEN-RAILED 2F FAMILY BALCONY (ABOVE SE BRICK PATIO!) ──
  // Vertically aligned Oak Runner Stairs arriving directly up from 1F Tender Patio right beside the 2F entry door!
  s2.objUV("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", 1.9, 3.44, 1.0, 1.545, FACE_NE, { z: 58 });
  s2.objUV("modular-suite/props/bedroom_home/home_rocking_chair.png", 5.25, 4.75, 1.0, 0.95, FACE_NE, { z: 62 });
  s2.objUV("modular-suite/modular/bare_oak_round_table.png", 4.15, 4.75, 0.9, 0.9, 0, { z: 58 });
  s2.objUV("modular-suite/props/bakery/bak_jam_honey_jars.png", 4.02, 4.82, 0.46, 0.4, 0.3, { z: 65, shadow: false });
  s2.objUV("modular-suite/props/harmony_lighting/lgt_lantern_brass_camp.png", 4.32, 4.62, 0.42, 0.42, 0, {
    z: 66,
    shadow: false,
  });
  s2.objUV("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 4.3, 3.04, 0.56, 0.56, FACE_SE, {
    z: 78,
    shadow: false,
  });
  s2.objUV("modular-suite/props/bedroom_home/home_laundry_basket.png", 2.85, 4.95, 0.85, 0.78, 0.4, { z: 62 });
  s2.objUV("modular-suite/props/bedroom_home/home_potted_fern.png", 5.85, 3.45, 0.78, 0.78, 0.2, { z: 64 });
  s2.objUV("modular-suite/props/bedroom_home/home_potted_fern.png", 1.25, 5.1, 0.78, 0.78, -0.4, { z: 64 });

  // 2F Dynamic Lighting for the Cozy Family Apartment!
  s2.lightUV("Family Dining Warm Pendant", 2.95, 0.55, 6.2, "#FFC978", 1.0, { flicker: true });
  s2.lightUV("Family Cookstove Hearth", 2.48, 2.15, 4.2, "#FF8533", 0.8, { flicker: true });
  s2.lightUV("Parents Bedroom Lamp", 0.52, -0.92, 4.8, "#FFB85C", 0.85, { flicker: true });
  s2.lightUV("Kids Toy-Train Room Lamp", 6.65, 0.25, 5.5, "#FFD68A", 0.92, { flicker: true });
  s2.lightUV("Family Balcony Lantern", 4.32, 4.62, 5.2, "#FFB347", 0.85, { flicker: true });

  s2.noteUV(
    "NOTE",
    6.95,
    5.4,
    "2F · Gelato-Maker Family Flat",
    "Cozy upstairs home of the family who runs the Steam & Scoop Express: parents' master bedroom (NW), kids' curved boiler-nose bedroom with wooden toy train playmat (SW), warm family kitchen & dining room, washroom, and sunny open-railed balcony.",
    "#F59E0B",
  );

  // =========================================================================
  // MERGE 1F & 2F INTO MAIN MAP BUNDLES + CUSTOM LOCOMOTIVE ROOF ON `ROOF`!
  // =========================================================================
  f1Bundle.terrain.push(...s1.b.terrain);
  f1Bundle.paths.push(...s1.b.paths);
  f1Bundle.walls.push(...s1.b.walls);
  f1Bundle.portals.push(...s1.b.portals);
  f1Bundle.objects.push(...s1.b.objects);
  f1Bundle.lights.push(...s1.b.lights);
  f1Bundle.dmNotes.push(...s1.b.dmNotes);

  f2Bundle.terrain.push(...s2.b.terrain);
  f2Bundle.paths.push(...s2.b.paths);
  f2Bundle.walls.push(...s2.b.walls);
  f2Bundle.portals.push(...s2.b.portals);
  f2Bundle.objects.push(...s2.b.objects);
  f2Bundle.lights.push(...s2.b.lights);
  f2Bundle.dmNotes.push(...s2.b.dmNotes);

  // Replace plain `dd-roof-0-4` over the Ice Cream Shop with a themed Locomotive Slate & Verdigris Boiler Roof!
  // Also trim neighboring SE terracotta roof `dd-roof-0-5` back to its actual building boundary (20.8, 27.8)
  // so it never overlaps the Ice Cream Shop's locomotive cab or Tender Balcony roof!
  roofLayer.roofs = (roofLayer.roofs ?? []).filter((r) => r.id !== "dd-roof-0-4");
  const seNeighborRoof = roofLayer.roofs.find((r) => r.id === "dd-roof-0-5");
  if (seNeighborRoof && seNeighborRoof.points.length >= 2) {
    seNeighborRoof.points = [
      { x: 21.1, y: 28.1 },
      { x: 27.0, y: 33.5 },
    ];
  }
  const locomotiveRoofs: RoofStructure[] = [
    // Main Weathered Slate Locomotive Cab Roof running cleanly along the shop axis
    {
      id: "ic-roof-loco-cab",
      style: "hip",
      assetId: "modular-suite/terrain/roof_weathered_slate_shingles.png",
      points: [shopPt(-0.15, 0.0), shopPt(5.55, 0.0)],
      widthCells: 6.1,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.56,
      ridgeCapStyle: "copper",
      ridgeColorHex: "#488B7D",
      eaveTrim: true,
      eaveTrimHex: "#1E252D",
      dropShadow: 0.58,
      opacity: 1,
    },
    // Rounded Conical Verdigris Copper Boiler-Nose Dome right over the curved SW nose!
    {
      id: "ic-roof-loco-boiler-dome",
      style: "cone",
      assetId: "modular-suite/terrain/roof_oxidized_verdigris_copper.png",
      points: [
        { x: NOSE_CX, y: NOSE_CY },
        { x: NOSE_CX - 2.72, y: NOSE_CY },
      ],
      widthCells: 5.44,
      coneFacets: 12,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.56,
      ridgeCapStyle: "copper",
      ridgeColorHex: "#488B7D",
      eaveTrim: true,
      eaveTrimHex: "#1D3B35",
      dropShadow: 0.58,
      opacity: 1,
    },
    // Verdigris Copper Shed Awning Roof sloping smoothly SE over the 2F Family Balcony / Tender Porch!
    {
      id: "ic-roof-tender-balcony",
      style: "shed",
      assetId: "modular-suite/terrain/roof_oxidized_verdigris_copper.png",
      points: [shopPt(0.55, 2.85), shopPt(6.45, 2.85)],
      widthCells: 3.05,
      flipSlope: false,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.52,
      ridgeCapStyle: "copper",
      ridgeColorHex: "#488B7D",
      eaveTrim: true,
      eaveTrimHex: "#1D3B35",
      dropShadow: 0.48,
      opacity: 1,
    },
  ];
  roofLayer.roofs.push(...locomotiveRoofs);

  return { shopPoly, patioPoly };
}

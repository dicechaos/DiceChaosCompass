/**
 * Builds the 3-Story Circular Berlin-Magipunk North Tram-Terminus Pavilion
 * ("Bahnhofspavillon Nord — Grand Tram Rotunda, Steam-Espresso Café & Aether Dispatch")
 * directly onto the existing circular rotunda (`dd-wall-1-32` / `dd-shape-floor-1-16`,
 * centered at (20.50, 1.50), r = 3.50) across 1F, 2F, 3F, and ROOF, plus its cobbled
 * outdoor café forecourt terrace and smooth terrain-edge cleanup beside Kiezpark & Eisenbahnstraße!
 *
 * Vertical Floorplan (exact 1F ↔ 2F ↔ 3F spiral staircase alignment at (22.45, 1.25)):
 *  - 1F (0ft):   Grand Tramway Ticket Hall & Steam-Espresso Rotunda Café:
 *                  Curved mahogany & marble espresso/ticket bar, twin-boiler brass espresso
 *                  machine, curved glass Berliner pastry showcase, tram-ticket dispenser,
 *                  mechanical Linie 14 flip-flap timetable board, Viennese marble bistro tables,
 *                  forest-green & cream pavilion awnings, outdoor sidewalk café terrace &
 *                  wrought-iron broadsheet newsstand rack!
 *  - 2F (+14ft): Panorama Coffeehouse Reading Salon & Chess Gallery:
 *                  Curved tufted velvet banquettes (emerald & burgundy dd_red), Viennese
 *                  Zeitungshalter newspaper-stick rack, chess & porcelain tea service salon,
 *                  walnut tea credenza, brass gramophone corner & warm brass chandelier.
 *  - 3F (+28ft): Municipal Aether-Tram Dispatch & Pneumatic Signal Control Tower:
 *                  Central circular brass & glowing cyan-aether Eisenbahnstraße telemetry
 *                  switchboard, riveted brass pneumatic dispatch tube bank (linked underground
 *                  to Postamt Nr. 4!), master orrery clock regulator, brass observation telescope
 *                  tracking Streetcar #14, dispatcher's shift desk & locker corner.
 *  - ROOF (+70ft): 16-Faceted Conical Prussian-Slate & Verdigris-Copper Rotunda Dome
 *                  (replaces broken 2-point legacy clay strip `dd-roof-0-17`!).
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
  type SplinePath,
  type TerrainStroke,
  type WallSegment,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

export const ROT_CX = 20.50;
export const ROT_CY = 1.50;
export const ROT_RADIUS = 3.50;
export const ROT_STAIR_X = 22.45;
export const ROT_STAIR_Y = 1.25;
export const ROT_STAIR_SIZE = 1.42;

export function makeRotundaCircle(r = ROT_RADIUS, segs = 48): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push({
      x: Math.round((ROT_CX + Math.cos(a) * r) * 1000) / 1000,
      y: Math.round((ROT_CY + Math.sin(a) * r) * 1000) / 1000,
    });
  }
  return out;
}

export const ROTUNDA_POLY: Point2D[] = makeRotundaCircle(ROT_RADIUS + 0.12, 48);

function ovalPoly(cx: number, cy: number, rx: number, ry: number, segs = 20): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push({
      x: Math.round((cx + Math.cos(a) * rx) * 1000) / 1000,
      y: Math.round((cy + Math.sin(a) * ry) * 1000) / 1000,
    });
  }
  return out;
}

function tint(hex: string, strength = 0.90): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

const BANQUETTE_EMERALD = tint("#1F6B54", 0.90);
const BANQUETTE_BURGUNDY = tint("#8C2838", 0.90);
const CONDUCTOR_NAVY = tint("#264874", 0.90);

function makeRotFloorHelper(tag: string, bundle: IceCreamBuildBundle) {
  let seq = 0;
  const uid = (p: string) => `rot-${tag}-${p}-${++seq}`;

  const floorPoly = (assetId: string, points: Point2D[], opacity = 1, softness = 0) => {
    const t: TerrainStroke = {
      id: uid("flr"),
      assetId,
      shape: "polygon",
      points,
      radiusCells: 0,
      opacity,
      softness,
    };
    bundle.terrain.push(t);
  };

  const wall = (
    assetId: string,
    points: Point2D[],
    opts: { closed?: boolean; thickness?: number; blocksLight?: boolean } = {},
  ): string => {
    const id = uid("wal");
    const w: WallSegment = {
      id,
      assetId,
      points,
      closed: opts.closed ?? true,
      curved: false,
      thicknessCells: opts.thickness ?? 0.20,
      blocksLight: opts.blocksLight ?? true,
    };
    bundle.walls.push(w);
    return id;
  };

  const rimPortal = (
    assetId: string,
    angleDeg: number,
    kind: PortalNode["kind"],
    widthCells: number,
    closed: boolean,
    wallId: string,
    r = ROT_RADIUS,
  ) => {
    const rad = (angleDeg * Math.PI) / 180;
    const x = Math.round((ROT_CX + Math.cos(rad) * r) * 1000) / 1000;
    const y = Math.round((ROT_CY + Math.sin(rad) * r) * 1000) / 1000;
    const tangent = rad + Math.PI / 2;
    const p: PortalNode = {
      id: uid("prt"),
      assetId,
      kind,
      wallId,
      x,
      y,
      rotationRad: Math.round(tangent * 1000) / 1000,
      widthCells,
      closed,
      locked: false,
      blocksLightWhenClosed: kind !== "window",
    };
    bundle.portals.push(p);
  };

  const spline = (
    assetId: string,
    pts: Array<[number, number]>,
    widthCells: number,
    opts: { curved?: boolean; opacity?: number } = {},
  ) => {
    const sp: SplinePath = {
      id: uid("pth"),
      assetId,
      points: pts.map(([x, y]) => ({ x, y })),
      widthCells,
      curved: opts.curved ?? true,
      taperEnds: false,
      fadeEnds: false,
      opacity: opts.opacity ?? 0.94,
      blocksScatter: false,
    };
    bundle.paths.push(sp);
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
      rotationRad: Math.round(rot * 1000) / 1000,
      flipX: Boolean(opts.flipX),
      flipY: false,
      opacity: opts.opacity ?? 1,
      castsShadow: opts.shadow ?? true,
      locked: false,
      recolor: opts.recolor ?? { ...DEFAULT_RECOLOR },
      zOrder: opts.z ?? 60,
    };
    bundle.objects.push(o);
  };

  const light = (
    name: string,
    x: number,
    y: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.92,
    opts: { flicker?: boolean; castShadows?: boolean } = {},
  ) => {
    const l: LightNode = {
      id: uid("lgt"),
      name,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      radiusCells,
      colorHex,
      intensity,
      castShadows: opts.castShadows ?? true,
      coneAngleDeg: 360,
      directionRad: 0,
      flicker: opts.flicker ?? false,
    };
    bundle.lights.push(l);
  };

  const note = (
    badge: DmNotePin["badge"],
    x: number,
    y: number,
    title: string,
    body: string,
    colorHex: string,
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

  return { floorPoly, wall, rimPortal, spline, obj, light, note };
}

export function buildTramRotundaPavilion(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
  f2Out: IceCreamBuildBundle,
  f3Out: IceCreamBuildBundle,
): { rotundaPoly: Point2D[] } {
  const groundTerrain = doc.layers.find((l) => l.id === "layer-dd-terrain-1");
  const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1");
  const roofLayer = doc.layers.find((l) => l.id === "layer-dd-roofs-0");

  // -------------------------------------------------------------------------
  // 0. UPGRADE 1F ROTUNDA FLOOR, WALL, ROOF DOME & CLEAN PLAZA TERRAIN EDGES!
  // -------------------------------------------------------------------------
  // Upgrade 1F circular floor (`dd-shape-floor-1-16`) to grand dark slate rim + Victorian encaustic mosaic medallion!
  const rotFloor1F = groundTerrain?.terrainStrokes?.find((t) => t.id === "dd-shape-floor-1-16");
  if (rotFloor1F) {
    rotFloor1F.assetId = "modular-suite/terrain/harmony/flr_dark_slate_hall_slabs.png";
  }

  // Splice soft outdoor plaza edge-cleanup patches BEFORE building floors so zero bleed enters Kiezpark or Rotunda!
  if (groundTerrain?.terrainStrokes) {
    let insertIdx = 0;
    for (let i = 0; i < groundTerrain.terrainStrokes.length; i++) {
      if (groundTerrain.terrainStrokes[i].id.startsWith("dd-splat-") || groundTerrain.terrainStrokes[i].id.startsWith("cs-1f-")) {
        insertIdx = i + 1;
      }
    }
    const edgeCleanups: TerrainStroke[] = [
      // Heal raw NW orange-clay smear between Kiezpark playground & Rotunda west curve
      {
        id: "rot-edge-nw-lawn",
        assetId: "modular-suite/terrain/terrain_trimmed_park_lawn.png",
        shape: "polygon",
        points: ovalPoly(14.55, 0.85, 1.50, 1.35, 20),
        radiusCells: 0,
        opacity: 0.90,
        softness: 0.40,
      },
      {
        id: "rot-edge-nw-cobble",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(16.05, 1.05, 1.55, 1.65, 20),
        radiusCells: 0,
        opacity: 0.92,
        softness: 0.38,
      },
      // Heal pale sandy blotch beneath the tram semaphore & catenary pole on the SE curb
      {
        id: "rot-edge-se-cobble",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(26.85, 2.95, 1.45, 1.35, 20),
        radiusCells: 0,
        opacity: 0.94,
        softness: 0.38,
      },
      // Heal the last orange clay speck right behind the North Haltestelle Tram Shelter
      {
        id: "rot-edge-haltestelle-cobble",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(21.75, 7.75, 1.25, 0.98, 20),
        radiusCells: 0,
        opacity: 0.94,
        softness: 0.38,
      },
    ];
    groundTerrain.terrainStrokes.splice(insertIdx, 0, ...edgeCleanups);
  }

  // Upgrade 1F circular wall (`dd-wall-1-32`) to Imperial Berlin Dressed Sandstone!
  const rotWall1F = groundWalls?.walls?.find((w) => w.id === "dd-wall-1-32");
  if (rotWall1F) {
    rotWall1F.assetId = "modular-suite/walls/harmony/wall_berlin_dressed_sandstone.png";
    rotWall1F.thicknessCells = 0.22;
  }

  // Replace broken 2-point clay strip `dd-roof-0-17` with a 16-Faceted Conical Prussian-Slate & Copper Rotunda Dome!
  if (roofLayer?.roofs) {
    const idx = roofLayer.roofs.findIndex((r) => r.id === "dd-roof-0-17");
    const dome: RoofStructure = {
      id: "rot-roof-tram-pavilion-dome",
      style: "cone",
      assetId: "modular-suite/terrain/harmony/roof_prussian_fishscale_slate.png",
      points: [
        { x: ROT_CX, y: ROT_CY },
        { x: ROT_CX + 3.82, y: ROT_CY },
      ],
      widthCells: 7.64,
      coneFacets: 16,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.54,
      ridgeCapStyle: "copper",
      ridgeColorHex: "#488B7D",
      eaveTrim: true,
      eaveTrimHex: "#1E2B38",
      dropShadow: 0.62,
      opacity: 1,
    };
    if (idx >= 0) {
      roofLayer.roofs[idx] = dome;
    } else {
      roofLayer.roofs.push(dome);
    }
  }

  const f1 = makeRotFloorHelper("1f", f1Out);
  const f2 = makeRotFloorHelper("2f", f2Out);
  const f3 = makeRotFloorHelper("3f", f3Out);
  const wallId1F = rotWall1F?.id ?? "dd-wall-1-32";

  // =========================================================================
  // 1F (0ft) — GRAND TRAMWAY TICKET HALL, STEAM-ESPRESSO BAR & CAFÉ TERRACE
  // =========================================================================
  // Inner Victorian encaustic mosaic tile medallion inset cleanly inside the dark slate perimeter border!
  f1.floorPoly("modular-suite/terrain/harmony/flr_victorian_foyer_encaustic.png", makeRotundaCircle(ROT_RADIUS - 0.55, 40));

  // Portals on 1F circular sandstone drum: SE Grand Tram Doors, SW Park Terrace Door + 3 Panoramic Café Windows!
  f1.rimPortal("modular-suite/portals/harmony/door_grunderzeit_double_glass.png", 52, "door", 1.38, false, wallId1F);
  f1.rimPortal("modular-suite/portals/harmony/door_shop_emerald_glass.png", 132, "door", 1.12, false, wallId1F);
  f1.rimPortal("modular-suite/portals/harmony/win_bay_crimson_cafe.png", 12, "window", 1.42, true, wallId1F);
  f1.rimPortal("modular-suite/portals/harmony/win_bay_bakery_warm.png", 92, "window", 1.56, true, wallId1F);
  f1.rimPortal("modular-suite/portals/harmony/win_bay_crimson_cafe.png", 168, "window", 1.42, true, wallId1F);

  // Curved Mahogany & Brass Rotunda Ticket & Steam-Espresso Service Counter (exact 2.00:1 ratio!)
  f1.obj("modular-suite/props/tram_rotunda/rot_curved_espresso_ticket_bar.png", 19.78, 1.52, 2.96, 1.48, -0.06, { z: 60 });
  // Barista & Ticket-Clerk Hero Equipment cleanly seated along the curved marble counter top:
  f1.obj("modular-suite/props/tram_rotunda/rot_brass_espresso_machine.png", 18.78, 1.42, 0.85, 0.68, 0.42, { z: 68 });
  f1.obj("modular-suite/props/tram_rotunda/rot_pastry_glass_dome_case.png", 19.82, 1.72, 0.90, 0.63, -0.04, { z: 68 });
  f1.obj("modular-suite/props/tram_rotunda/rot_ticket_punch_dispenser.png", 20.84, 1.42, 0.78, 0.61, -0.46, { z: 68 });
  // Barista back-prep tea/espresso mugs & wrapped fresh pastry parcels tucked inside the northern counter bay
  f1.obj("modular-suite/props/hostel_living/hs_enamel_teapot_mugs_set.png", 19.35, 0.62, 0.54, 0.48, 0.20, { z: 64 });
  f1.obj("modular-suite/props/boulevard_shops/bs_wrapped_linen_parcels.png", 20.38, 0.58, 0.62, 0.56, -0.15, { z: 64 });

  // Two Viennese Marble Bistro Table Sets inside the sunlit south & SW rotunda bay windows!
  f1.obj("modular-suite/props/tram_rotunda/rot_marble_bistro_table_set.png", 18.68, 3.05, 1.34, 1.34, 0.45, { z: 62 });
  f1.obj("modular-suite/props/tram_rotunda/rot_marble_bistro_table_set.png", 20.62, 3.72, 1.34, 1.34, -0.18, { z: 62 });

  // Mechanical Brass Flip-Flap Tram Departure Timetable Board mounted along east wall clear of double door swing!
  f1.obj("modular-suite/props/tram_rotunda/rot_tram_timetable_board.png", 23.22, 2.42, 1.19, 0.51, 1.48, { z: 66 });

  // Warm Brass Floor Lamp by West Park Window + Milkglass Café Pendant + Aligned Spiral Staircase to 2F!
  f1.obj("modular-suite/props/harmony_lighting/lgt_floor_brass_reading_lamp.png", 17.78, 2.02, 0.58, 0.58, 0, { z: 70 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 20.15, 2.42, 0.76, 0.76, 0, { z: 84, shadow: false });
  f1.obj("modular-suite/props/watchtower_garrison/wt_fortress_spiral_stair.png", ROT_STAIR_X, ROT_STAIR_Y, ROT_STAIR_SIZE, ROT_STAIR_SIZE, 0, { z: 56, shadow: false });

  // -------------------------------------------------------------------------
  // 1F OUTDOOR COBBLED CAFÉ FORECOURT TERRACE & TRAM PLAZA FIXTURES
  // -------------------------------------------------------------------------
  // Forest-Green & Cream Striped Berlin Pavilion Awnings hugging BOTH curved masonry entrances flush!
  f1.obj("modular-suite/props/tram_rotunda/rot_pavilion_striped_awning.png", 22.88, 4.55, 2.00, 0.80, -0.66, { z: 76, shadow: false });
  f1.obj("modular-suite/props/tram_rotunda/rot_pavilion_striped_awning.png", 17.95, 4.35, 1.80, 0.72, 0.73, { z: 76, shadow: false });

  // Outdoor Sidewalk Viennese Café Bistro Terrace cleanly clear of Postamt Nr. 4 roof eaves!
  f1.obj("modular-suite/props/tram_rotunda/rot_marble_bistro_table_set.png", 15.65, 3.85, 1.34, 1.34, 0.30, { z: 62 });
  f1.obj("modular-suite/props/tram_rotunda/rot_marble_bistro_table_set.png", 18.65, 5.65, 1.34, 1.34, -0.35, { z: 62 });

  // Wrought-Iron Commuter Broadsheet Newsstand Rack & Sidewalk Menu Chalkboard flanking the tram approach!
  f1.obj("modular-suite/props/tram_rotunda/rot_street_newsstand_rack.png", 24.22, 4.88, 1.10, 0.70, -0.68, { z: 64 });
  f1.obj("modular-suite/props/market_tailor/mkt_sidewalk_chalkboard.png", 21.55, 5.42, 0.68, 0.68, 0.22, { z: 64 });

  // Carved Limestone Shrub Planters framing the West Kiezpark entry & East Tram Plaza rim!
  f1.obj("modular-suite/props/city_streets/st_stone_boulevard_planter.png", 15.55, 2.25, 1.04, 0.66, 1.48, { z: 62 });
  f1.obj("modular-suite/props/city_streets/st_stone_boulevard_planter.png", 24.55, 1.45, 1.04, 0.66, 1.52, { z: 62 });

  // Warm Jugendstil Exterior Wall Sconces casting amber café welcome across the cobbled terrace!
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 20.42, 5.18, 0.56, 0.56, 0, { z: 78 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_berlin_jugendstil_gas.png", 16.82, 2.15, 0.56, 0.56, Math.PI / 2, { z: 78 });

  // 1F Warm Coffeehouse & Outdoor Terrace Lighting + DM Story Note
  f1.light("1F Rotunda Espresso Bar Warm Glow", 20.05, 2.15, 6.2, "#FFC978", 1.05, { flicker: true });
  f1.light("1F Rotunda SW Café Terrace Lamp", 17.65, 4.85, 5.8, "#FFBE6B", 0.88, { flicker: true });
  f1.light("1F Rotunda SE Tram Entry Sconce", 22.85, 4.65, 5.6, "#FFD084", 0.90, { flicker: true });
  f1.note(
    "NOTE",
    20.15,
    2.45,
    "1F · Bahnhofspavillon Nord — Tram Ticket & Espresso Rotunda (0 ft)",
    "A beloved circular 1900s Berlin-Magipunk tram-terminus pavilion linking Eisenbahnstraße's North Haltestelle with Hinterhof-Kiezpark. Commuters grab brass-punched Linie 14 passes, hot espresso from the twin-boiler steam engine, powdered Berliner doughnuts, and broadsheets from the sidewalk rack before hopping Streetcar #14.",
    "#F59E0B",
  );

  // =========================================================================
  // 2F (+14ft) — PANORAMA COFFEEHOUSE READING SALON, CHESS & TEA GALLERY
  // =========================================================================
  const circlePts = makeRotundaCircle(ROT_RADIUS, 48);
  f2.floorPoly("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", circlePts);
  const w2 = f2.wall("modular-suite/walls/harmony/wall_berlin_dressed_sandstone.png", circlePts, {
    closed: true,
    thickness: 0.22,
  });

  // 4 Tall Arched Jugendstil Stained-Glass Windows encircling the 2F coffeehouse gallery!
  for (const ang of [12, 62, 118, 168]) {
    f2.rimPortal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", ang, "window", 1.48, true, w2);
  }

  // Woven Round Braided Medallion Rug anchoring the central reading salon floor!
  f2.obj("modular-suite/props/hostel_living/hs_bare_round_braided_rug.png", 20.15, 2.25, 2.10, 2.10, 0.2, { z: 46, shadow: false });

  // Two Curved Tufted Velvet Banquettes (dd_red colorable -> Imperial Emerald & Viennese Burgundy!)
  // Rotated so their tufted backrests hug the curved outer windows & guests sit facing inward toward center!
  f2.obj("modular-suite/props/tram_rotunda/rot_curved_velvet_banquette_colorable.png", 18.48, 3.48, 2.04, 1.02, 0.76 + Math.PI, {
    z: 62,
    recolor: BANQUETTE_EMERALD,
  });
  f2.obj("modular-suite/props/tram_rotunda/rot_curved_velvet_banquette_colorable.png", 22.02, 3.58, 2.04, 1.02, -0.62 + Math.PI, {
    z: 62,
    recolor: BANQUETTE_BURGUNDY,
  });

  // Central Coffeehouse Chess Table (round oak table + mid-game chess board) + Marble Tea Bistro Table!
  f2.obj("modular-suite/props/watchtower_garrison/wt_bare_round_command_table.png", 19.38, 2.38, 1.12, 1.12, 0, { z: 60 });
  f2.obj("modular-suite/props/music_theater_tea/tea_chess_board.png", 19.38, 2.38, 0.66, 0.66, 0.25, { z: 66, shadow: false });
  f2.obj("modular-suite/props/tram_rotunda/rot_marble_bistro_table_set.png", 21.18, 2.52, 1.26, 1.26, -0.45, { z: 62 });

  // Viennese Zeitungshalter Newspaper-Stick Rack hugging the sunny west window curve!
  f2.obj("modular-suite/props/tram_rotunda/rot_newspaper_stick_rack.png", 18.02, 1.62, 1.00, 0.70, 1.44, { z: 64 });

  // Walnut Tea & Pastry Self-Serve Credenza along North Curve + Porcelain Tea Service & Enamel Pot!
  f2.obj("modular-suite/props/boulevard_shops/bs_bare_walnut_tasting_bar.png", 20.12, 0.62, 1.80, 0.81, 0, { z: 60 });
  f2.obj("modular-suite/props/hostel_living/hs_enamel_teapot_mugs_set.png", 19.62, 0.62, 0.56, 0.50, 0.15, { z: 66 });
  f2.obj("modular-suite/props/music_theater_tea/tea_porcelain_set.png", 20.62, 0.62, 0.58, 0.58, -0.20, { z: 66 });

  // Brass Gramophone Music Nook cleanly clear of East Window + Floor Reading Lamp + Brass Chandelier + Aligned Spiral Stair!
  f2.obj("modular-suite/props/music_theater_tea/mus_brass_gramophone.png", 22.75, 2.58, 0.84, 0.84, -1.95, { z: 66 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_floor_brass_reading_lamp.png", 17.95, 2.65, 0.58, 0.58, 0, { z: 70 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_banquet_brass_chandelier.png", 20.28, 2.15, 0.96, 0.96, 0, { z: 84, shadow: false });
  f2.obj("modular-suite/props/watchtower_garrison/wt_fortress_spiral_stair.png", ROT_STAIR_X, ROT_STAIR_Y, ROT_STAIR_SIZE, ROT_STAIR_SIZE, 0, { z: 56, shadow: false });

  f2.light("2F Coffeehouse Brass Chandelier", 20.28, 2.15, 6.4, "#FFC872", 1.02, { flicker: true });
  f2.light("2F Emerald Banquette Reading Lamp", 18.25, 2.85, 4.4, "#FFB962", 0.82, { flicker: true });
  f2.note(
    "NOTE",
    20.28,
    2.15,
    "2F · Panorama Reading Salon & Chess Gallery (+14 ft)",
    "Quiet circular Viennese coffeehouse mezzanine overlooking Kiezpark and the tram terminus. Regulars linger for hours on tufted emerald and burgundy velvet banquettes with bamboo-mounted broadsheets, mid-game chess boards, porcelain tea service, and soft gramophone waltzes.",
    "#10B981",
  );

  // =========================================================================
  // 3F (+28ft) — MUNICIPAL AETHER-TRAM DISPATCH & PNEUMATIC SIGNAL TOWER
  // =========================================================================
  f3.floorPoly("modular-suite/terrain/harmony/flr_dark_slate_hall_slabs.png", circlePts);
  const w3 = f3.wall("modular-suite/walls/harmony/wall_navy_gold_observatory.png", circlePts, {
    closed: true,
    thickness: 0.22,
  });

  // 4 Panoramic Cast-Iron Observatory Windows watching Eisenbahnstraße & Kiezpark!
  for (const ang of [12, 62, 118, 168]) {
    f3.rimPortal("modular-suite/portals/harmony/win_bay_iron_conservatory.png", ang, "window", 1.56, true, w3);
  }

  // Glowing Cyan Aether Telemetry Conduits radiating across the slate floor from the central switchboard!
  f3.spline("paths/aether_power_conduit.png", [[20.25, 2.15], [19.45, 2.85], [18.58, 3.45]], 0.20, { curved: true });
  f3.spline("paths/aether_power_conduit.png", [[20.25, 2.15], [20.32, 1.35], [20.35, 0.65]], 0.20, { curved: true });
  f3.spline("paths/aether_power_conduit.png", [[20.25, 2.15], [21.35, 2.75], [22.35, 3.25]], 0.18, { curved: true });

  // Centerpiece Hero: Circular Brass & Cyan-Aether Streetcar Switchboard Console!
  f3.obj("modular-suite/props/tram_rotunda/rot_aether_tram_switchboard.png", 20.25, 2.15, 1.86, 1.86, 0, { z: 68 });

  // Riveted Brass Pneumatic Dispatch Tube Manifold along SW curve (nozzles facing inward toward dispatcher!)
  f3.obj("modular-suite/props/tram_rotunda/rot_pneumatic_tube_manifold.png", 18.55, 3.48, 1.56, 0.78, 0.72 + Math.PI, { z: 66 });

  // Master Horology Clockwork Regulator along North Curve
  f3.obj("modular-suite/props/boulevard_shops/bs_grandfather_orrery_clock.png", 20.35, 0.62, 0.88, 0.79, 0, { z: 66 });

  // Chief Dispatcher's Sloped Log Desk along West Curve w/ Patrol/Route Roster & Clockwork Loupe!
  f3.obj("modular-suite/props/post_housing/ph_bare_sloped_writing_desk.png", 18.22, 1.48, 1.26, 0.72, 1.32, { z: 62 });
  f3.obj("modular-suite/props/watchtower_garrison/wt_patrol_map_roster_papers.png", 18.28, 1.58, 0.56, 0.45, 1.28, { z: 68, shadow: false });
  f3.obj("modular-suite/props/boulevard_shops/bs_clockwork_gears_loupe.png", 18.12, 1.15, 0.44, 0.35, 0.40, { z: 68, shadow: false });

  // Brass Observation Telescope aimed SE down Eisenbahnstraße toward Streetcar #14!
  f3.obj("modular-suite/props/boulevard_shops/bs_telescope_brass_tripod.png", 22.38, 3.25, 1.04, 0.85, 0.74, { z: 68 });

  // Conductors' Shift Locker Cabinet & Folded Prussian-Navy Uniform Greatcoat along South Curve!
  f3.obj("modular-suite/props/hostel_living/hs_bare_locker_cabinet.png", 20.68, 4.18, 1.44, 0.63, Math.PI, { z: 62 });
  f3.obj("modular-suite/props/watchtower_garrison/wt_folded_greatcoat.png", 20.68, 4.18, 0.54, 0.43, 0.12, {
    z: 68,
    recolor: CONDUCTOR_NAVY,
  });

  // Wall-mounted Cyan Aether Sconces (keeps central switchboard telemetry screen 100% unobstructed!) + Aligned Spiral Stair!
  f3.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", 17.42, 2.38, 0.54, 0.54, -Math.PI / 2, { z: 78 });
  f3.obj("modular-suite/props/harmony_lighting/lgt_sconce_aether_cyan_bracket.png", 23.48, 2.35, 0.54, 0.54, Math.PI / 2, { z: 78 });
  f3.obj("modular-suite/props/watchtower_garrison/wt_fortress_spiral_stair.png", ROT_STAIR_X, ROT_STAIR_Y, ROT_STAIR_SIZE, ROT_STAIR_SIZE, 0, { z: 56, shadow: false });

  f3.light("3F Aether-Tram Switchboard Glow", 20.25, 2.15, 5.8, "#56D8FF", 1.05, { castShadows: false });
  f3.light("3F Dispatcher Desk Warm Lamp", 18.35, 1.55, 4.5, "#FFB962", 0.85, { flicker: true });
  f3.light("3F Observatory Telescope Warm Glow", 22.35, 3.25, 4.2, "#FFBE6B", 0.76, { flicker: true });
  f3.note(
    "SECRET",
    20.25,
    2.15,
    "3F · Aether-Tram Signal Dispatch & Pneumatic Hub (+28 ft)",
    "The secret nerve center of Eisenbahnstraße: a humming cyan-aether telemetry table throws every streetcar switch and semaphore along the line, while a 5-tube brass pneumatic manifold shoots sealed dispatch canisters underground straight to Postamt Nr. 4's sorting room!",
    "#38BDF8",
  );

  return { rotundaPoly: ROTUNDA_POLY };
}

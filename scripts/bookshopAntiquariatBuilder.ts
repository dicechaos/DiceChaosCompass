/**
 * Builds the 2-Story Curved Bow-Window Antiquarian Bookshop & Upstairs Bookbindery
 * ("Antiquariat & Buchhandlung Silberblatt") directly onto the sweeping west-edge
 * crescent building (`dd-wall-1-31` / `dd-shape-floor-1-9`, vertical ellipse centered
 * at (0.00, 22.50), rx = 2.00, ry = 6.00) directly across the Grand Crossroads from
 * Steam & Scoop Express and Postamt Nr. 4!
 *
 * Vertical Floorplan (exact 1F ↔ 2F walnut stair alignment at (0.76, 18.65)):
 *  - 1F (0ft):   Curved Bow-Window Antiquarian Bookshop & Sidewalk Penny-Book Promenade:
 *                  4 glowing curved bay display windows & central double-glass entry shaded
 *                  by a burgundy-and-cream striped awning, packed floor-to-ceiling mahogany
 *                  bookcases with brass rolling-ladder rail, bow-window terrestrial globe &
 *                  illuminated folio display table, walnut bookseller's wrapping desk with
 *                  brass cash register & sleeping shop tabby cat, antique map/print cradle,
 *                  outdoor wooden penny-book browsing troughs, wrought-iron reading bench,
 *                  sidewalk chalkboard & healed cobble promenade edges!
 *  - 2F (+14ft): Master Bookbindery, Lithography Studio & Sunlit Reading Gallery:
 *                  Craftsman oak bookbinding screw-press workbench, uncut folio signatures,
 *                  emerald-tinted tufted wingback reading armchair & footstool facing the
 *                  Grand Crossroads, brass & Tiffany floor lamps, Viennese newspaper rack,
 *                  archival mahogany stacks & print portfolio easel.
 *  - ROOF (+70ft): Upgraded Burgundy Diamond Slate roof (`dd-roof-0-8`) with verdigris
 *                  copper ridge cap harmonizing with the burgundy awning & Grand Crossroads.
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
  type TerrainStroke,
  type WallSegment,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

export const BK_CX = 0.0;
export const BK_CY = 22.5;
export const BK_RX = 2.0;
export const BK_RY = 6.0;
export const BK_STAIR_X = 0.76;
export const BK_STAIR_Y = 18.65;

export function makeBookshopEllipse(rx = BK_RX, ry = BK_RY, segs = 60): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    out.push({
      x: Math.round((BK_CX + Math.cos(a) * rx) * 1000) / 1000,
      y: Math.round((BK_CY + Math.sin(a) * ry) * 1000) / 1000,
    });
  }
  return out;
}

export const BOOKSHOP_POLY: Point2D[] = makeBookshopEllipse(BK_RX + 0.12, BK_RY + 0.12, 60);

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

function ellipsePointAndAngles(t: number): { x: number; y: number; tangent: number; outward: number; nx: number; ny: number } {
  const x = BK_CX + BK_RX * Math.cos(t);
  const y = BK_CY + BK_RY * Math.sin(t);
  const dx = -BK_RX * Math.sin(t);
  const dy = BK_RY * Math.cos(t);
  const tangent = Math.atan2(dy, dx);
  // Outward east-pointing normal on the right half (t ∈ [-π/2, π/2]) is (dy, -dx) = (ry cos t, rx sin t)
  const rawNx = dy;
  const rawNy = -dx;
  const len = Math.hypot(rawNx, rawNy) || 1;
  const nx = rawNx / len;
  const ny = rawNy / len;
  const outward = Math.atan2(ny, nx);
  return { x, y, tangent, outward, nx, ny };
}

function tint(hex: string, strength = 0.90): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

const ARMCHAIR_COGNAC = tint("#A44B22", 0.92);

function makeBookshopFloorHelper(tag: string, bundle: IceCreamBuildBundle) {
  let seq = 0;
  const uid = (p: string) => `bk-${tag}-${p}-${++seq}`;

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
      thicknessCells: opts.thickness ?? 0.22,
      blocksLight: opts.blocksLight ?? true,
    };
    bundle.walls.push(w);
    return id;
  };

  const curvePortal = (
    assetId: string,
    tParam: number,
    kind: PortalNode["kind"],
    widthCells: number,
    closed: boolean,
    wallId: string,
  ) => {
    const { x, y, tangent } = ellipsePointAndAngles(tParam);
    const p: PortalNode = {
      id: uid("prt"),
      assetId,
      kind,
      wallId,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      rotationRad: Math.round(tangent * 1000) / 1000,
      widthCells,
      closed,
      locked: false,
      blocksLightWhenClosed: kind !== "window",
    };
    bundle.portals.push(p);
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

  return { floorPoly, wall, curvePortal, obj, light, note };
}

export function buildBookshopAntiquariat(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
  f2Out: IceCreamBuildBundle,
): { bookshopPoly: Point2D[] } {
  const groundTerrain = doc.layers.find((l) => l.id === "layer-dd-terrain-1");
  const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1");
  const roofLayer = doc.layers.find((l) => l.id === "layer-dd-roofs-0");

  // -------------------------------------------------------------------------
  // 0. UPGRADE 1F FLOOR, MASONRY WALL, BURGUNDY SLATE ROOF & HEAL SAND EDGES
  // -------------------------------------------------------------------------
  const bkFloor1F = groundTerrain?.terrainStrokes?.find((t) => t.id === "dd-shape-floor-1-9");
  if (bkFloor1F) {
    bkFloor1F.assetId = "modular-suite/terrain/harmony/flr_dark_walnut_parquet.png";
  }

  // Splice feathered wet-cobble edge cleanups BEFORE building floors (`dd-shape-floor-*`)
  // to smoothly heal the pale yellow sand smears hugging the SE curb bend & curved wall base!
  if (groundTerrain?.terrainStrokes) {
    let insertIdx = 0;
    for (let i = 0; i < groundTerrain.terrainStrokes.length; i++) {
      if (
        groundTerrain.terrainStrokes[i].id.startsWith("dd-splat-") ||
        groundTerrain.terrainStrokes[i].id.startsWith("cs-1f-") ||
        groundTerrain.terrainStrokes[i].id.startsWith("rot-edge-")
      ) {
        insertIdx = i + 1;
      }
    }
    const edgeCleanups: TerrainStroke[] = [
      {
        id: "bk-edge-se-curb-sand",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(3.42, 26.25, 1.05, 1.15, 20),
        radiusCells: 0,
        opacity: 0.94,
        softness: 0.40,
      },
      {
        id: "bk-edge-sw-curb-sand",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(2.15, 27.65, 1.18, 0.95, 20),
        radiusCells: 0,
        opacity: 0.94,
        softness: 0.40,
      },
      {
        id: "bk-edge-wall-curve-sand",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(2.05, 23.75, 0.72, 1.10, 20),
        radiusCells: 0,
        opacity: 0.92,
        softness: 0.38,
      },
      {
        id: "bk-edge-south-tip-sand",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(1.15, 28.45, 0.85, 0.65, 20),
        radiusCells: 0,
        opacity: 0.94,
        softness: 0.38,
      },
    ];
    groundTerrain.terrainStrokes.splice(insertIdx, 0, ...edgeCleanups);
  }

  // Upgrade 1F curved wall (`dd-wall-1-31`) to Flemish Cream-and-Crimson Brick!
  const bkWall1F = groundWalls?.walls?.find((w) => w.id === "dd-wall-1-31");
  if (bkWall1F) {
    bkWall1F.assetId = "modular-suite/walls/harmony/wall_flemish_cream_crimson_brick.png";
    bkWall1F.thicknessCells = 0.22;
  }

  // Upgrade existing roof (`dd-roof-0-8`) from mossy medieval clay to Hipped Burgundy Diamond Slate + Copper Ridge!
  const bkRoof = roofLayer?.roofs?.find((r) => r.id === "dd-roof-0-8");
  if (bkRoof) {
    bkRoof.style = "hip";
    bkRoof.points = [
      { x: 0.0, y: 17.25 },
      { x: 0.0, y: 27.75 },
    ];
    bkRoof.widthCells = 4.30;
    bkRoof.assetId = "modular-suite/terrain/harmony/roof_burgundy_diamond_slate.png";
    bkRoof.ridgeCapStyle = "copper";
    bkRoof.ridgeColorHex = "#488B7D";
    bkRoof.eaveTrim = true;
    bkRoof.eaveTrimHex = "#2B1419";
    bkRoof.slopeShade = 0.54;
    bkRoof.dropShadow = 0.58;
  }

  const f1 = makeBookshopFloorHelper("1f", f1Out);
  const f2 = makeBookshopFloorHelper("2f", f2Out);
  const wallId1F = bkWall1F?.id ?? "dd-wall-1-31";
  const ellipsePts = bkWall1F?.points && bkWall1F.points.length >= 16 ? bkWall1F.points : makeBookshopEllipse(BK_RX, BK_RY, 60);

  // =========================================================================
  // 1F (0ft) — CURVED BOW-WINDOW ANTIQUARIAN BOOKSHOP & SIDEWALK BOOKSTALLS
  // =========================================================================

  // Warm crimson woven parlor carpet runner inset cleanly inside the walnut parquet gallery (crisp wood border along bookcases!)
  f1.floorPoly(
    "modular-suite/terrain/harmony/flr_crimson_parlor_carpet.png",
    [
      { x: 0.68, y: 19.75 },
      { x: 1.48, y: 19.90 },
      { x: 1.62, y: 22.50 },
      { x: 1.48, y: 25.10 },
      { x: 0.68, y: 25.25 },
    ],
    0.96,
  );

  // 5 Curved East-Facade Portals facing across the Grand Crossroads toward Steam & Scoop Express!
  // Central Grand Double Glass Entrance at the exact apex (2.00, 22.50) — propped invitingly open!
  f1.curvePortal("modular-suite/portals/harmony/door_grunderzeit_double_glass.png", 0.0, "door", 1.24, false, wallId1F);
  // 4 Glowing Curved Bow Display Windows flanking north & south of the grand entrance
  f1.curvePortal("modular-suite/portals/harmony/win_bay_crimson_cafe.png", -0.32, "window", 1.28, true, wallId1F);
  f1.curvePortal("modular-suite/portals/harmony/win_bay_bakery_warm.png", -0.66, "window", 1.18, true, wallId1F);
  f1.curvePortal("modular-suite/portals/harmony/win_bay_crimson_cafe.png", 0.32, "window", 1.28, true, wallId1F);
  f1.curvePortal("modular-suite/portals/harmony/win_bay_bakery_warm.png", 0.66, "window", 1.18, true, wallId1F);

  // 1F↔2F Oak Runner Staircase tucked neatly in the northern curved alcove (exact vertical match on 2F!)
  f1.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", BK_STAIR_X, BK_STAIR_Y, 0.78, 1.20, 0, { z: 54 });

  // Packed Floor-to-Ceiling Mahogany Bookcases with Brass Rolling-Ladder Rail along the west spine (ratio 2.667:1)
  f1.obj("modular-suite/props/bookshop_antiquariat/bk_mahogany_bookcase_packed.png", 0.36, 21.15, 1.60, 0.60, -Math.PI / 2, { z: 62 });
  f1.obj("modular-suite/props/bookshop_antiquariat/bk_mahogany_bookcase_packed.png", 0.36, 23.85, 1.60, 0.60, -Math.PI / 2, { z: 62 });
  f1.obj("modular-suite/props/bookshop_antiquariat/bk_mahogany_bookcase_packed.png", 0.36, 25.85, 1.44, 0.54, -Math.PI / 2, { z: 62 });

  // Bookseller's Walnut Checkout & Kraft-Parcel Wrapping Desk inside the north inner bow window (ratio 1.750:1)
  f1.obj("modular-suite/props/bookshop_antiquariat/bk_bookseller_checkout_desk.png", 1.20, 20.68, 1.33, 0.76, -1.70, { z: 64 });
  f1.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 0.78, 20.38, 0.56, 0.59, -1.55, { z: 60 });

  // Bow-Window Terrestrial Brass Globe & Open Illuminated Folio Display Table in the south inner bow window (ratio 1.444:1)
  f1.obj("modular-suite/props/bookshop_antiquariat/bk_curved_folio_globe_table.png", 1.26, 24.30, 1.17, 0.81, -1.42, { z: 64 });

  // Curled-Up Shop Tabby Cat ("Herr Gutenberg") napping in the warm front window sunbeam!
  f1.obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 1.44, 23.46, 0.48, 0.47, 0.35, { z: 66 });

  // Antique Map & Lithograph Print Portfolio Browsing Cradle in the south outer bow window (ratio 1.571:1)
  f1.obj("modular-suite/props/bookshop_antiquariat/bk_print_portfolio_easel_rack.png", 1.12, 25.75, 1.04, 0.66, -1.28, { z: 64 });

  // Wrapped twine book deliveries & stacked secondhand volumes tucked into north/south alcoves
  f1.obj("modular-suite/props/boulevard_shops/bs_wrapped_linen_parcels.png", 1.22, 19.55, 0.56, 0.50, 0.22, { z: 62 });
  f1.obj("modular-suite/props/post_housing/ph_paper_flyers_books_pile.png", 0.82, 27.02, 0.55, 0.44, -0.35, { z: 62 });

  // Warm Victorian Amber Ceiling Pendants lighting the interior aisles
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_victorian_amber_pendant.png", 1.06, 21.75, 0.52, 0.52, 0, { z: 76, shadow: false });
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_victorian_amber_pendant.png", 1.06, 23.55, 0.52, 0.52, 0, { z: 76, shadow: false });

  // -------------------------------------------------------------------------
  // 1F OUTDOOR SCENIC PROMENADE (DIRECTLY VISIBLE FROM STEAM & SCOOP EXPRESS!)
  // -------------------------------------------------------------------------
  // Burgundy & Vintage-Cream Striped Storefront Awning mounted flush to the brick apex wall (ratio 2.500:1)
  f1.obj("modular-suite/props/bookshop_antiquariat/bk_bookshop_burgundy_awning.png", 2.28, 22.50, 1.85, 0.74, -Math.PI / 2, { z: 84 });

  // Brass Storefront Gooseneck Sconces mounted right on the brick piers flanking the burgundy awning!
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_storefront_gooseneck.png", 2.06, 21.48, 0.48, 0.48, -Math.PI / 2, { z: 80 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_storefront_gooseneck.png", 2.06, 23.52, 0.48, 0.48, -Math.PI / 2, { z: 80 });

  // Paired Outdoor Sidewalk Penny-Book Browsing Bins nestled flush against the curved north & south brick facade (ratio 1.833:1)
  const northStall = ellipsePointAndAngles(-0.45);
  f1.obj(
    "modular-suite/props/bookshop_antiquariat/bk_sidewalk_book_bin_stall.png",
    northStall.x + northStall.nx * 0.31,
    northStall.y + northStall.ny * 0.31,
    1.10,
    0.60,
    northStall.outward - Math.PI / 2,
    { z: 68 },
  );
  const southStall = ellipsePointAndAngles(0.36);
  f1.obj(
    "modular-suite/props/bookshop_antiquariat/bk_sidewalk_book_bin_stall.png",
    southStall.x + southStall.nx * 0.31,
    southStall.y + southStall.ny * 0.31,
    1.10,
    0.60,
    southStall.outward - Math.PI / 2,
    { z: 68 },
  );

  // Sidewalk A-Frame Bookshop Chalkboard ("NEU EINGETROFFEN · 10 Pf.") flanking the south awning edge
  f1.obj("modular-suite/props/market_tailor/mkt_sidewalk_chalkboard.png", 2.46, 23.68, 0.54, 0.60, -1.72, { z: 68 });

  // Wrought-Iron Promenade Reading Bench angled SE toward Steam & Scoop Express & the Grand Crossroads! (ratio 2.278:1)
  f1.obj("modular-suite/props/neighborhood_park/pk_worn_park_bench.png", 3.45, 22.05, 1.32, 0.58, -1.35, { z: 66 });

  // Carved Limestone Shrub Planter framing the south promenade curve cleanly between Tram Lamp & wall (ratio 1.571:1)
  f1.obj("modular-suite/props/city_streets/st_stone_boulevard_planter.png", 2.48, 26.62, 1.04, 0.66, -0.78, { z: 66 });

  // Warm Golden Amber Gallery & Curved Bow-Window Spill Lights (illuminating the promenade across from the ice cream shop!)
  f1.light("Silberblatt 1F North Bow-Window Glow", 1.18, 20.65, 5.4, "#FFBE62", 0.94);
  f1.light("Silberblatt 1F Center Gallery Warmth", 1.28, 22.50, 5.8, "#FFCA72", 0.98);
  f1.light("Silberblatt 1F South Folio-Window Glow", 1.18, 24.45, 5.4, "#FFBE62", 0.94);
  f1.light("Silberblatt Awning & Bookstall Promenade Spill", 2.68, 22.50, 5.6, "#FFC86E", 0.78, { flicker: true, castShadows: false });

  f1.note(
    "NOTE",
    2.75,
    22.50,
    "1F · Antiquariat & Buchhandlung Silberblatt",
    "Curved bow-window rare-bookshop & print dealer directly across the Grand Crossroads from Steam & Scoop Express. Burgundy striped awning, sidewalk 10-Pfennig browsing troughs, packed mahogany stacks with brass ladder rail, terrestrial globe display table, kraft-parcel counter, and sleeping shop tabby Herr Gutenberg.",
    "#C86A42",
  );

  // =========================================================================
  // 2F (+14ft) — MASTER BOOKBINDERY, LITHOGRAPHY STUDIO & SUNLIT READING NOOK
  // =========================================================================
  f2.floorPoly("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", ellipsePts, 1);
  f2.floorPoly(
    "modular-suite/terrain/harmony/flr_emerald_grand_carpet.png",
    [
      { x: 0.68, y: 22.45 },
      { x: 1.62, y: 22.55 },
      { x: 1.52, y: 24.85 },
      { x: 0.68, y: 24.95 },
    ],
    0.96,
  );

  const wallId2F = f2.wall("modular-suite/walls/harmony/wall_flemish_cream_crimson_brick.png", ellipsePts, {
    closed: true,
    thickness: 0.22,
  });

  // 4 Upper Jugendstil Stained-Glass Windows overlooking Steam & Scoop Express and the Grand Crossroads!
  f2.curvePortal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", -0.60, "window", 1.16, true, wallId2F);
  f2.curvePortal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", -0.22, "window", 1.24, true, wallId2F);
  f2.curvePortal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", 0.22, "window", 1.24, true, wallId2F);
  f2.curvePortal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", 0.60, "window", 1.16, true, wallId2F);

  // Exact vertically aligned 2F oak stair landing!
  f2.obj("modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png", BK_STAIR_X, BK_STAIR_Y, 0.78, 1.20, 0, { z: 54 });

  // Craftsman Oak Bookbinder's Screw-Press Workbench bathed in north window light (ratio 1.750:1)
  f2.obj("modular-suite/props/bookshop_antiquariat/bk_bookbinder_press_bench.png", 1.22, 21.05, 1.40, 0.80, -1.66, { z: 64 });
  f2.obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 0.72, 21.12, 0.56, 0.59, -1.62, { z: 60 });
  f2.obj("modular-suite/props/post_housing/ph_paper_flyers_books_pile.png", 0.52, 20.12, 0.55, 0.44, 0.24, { z: 62 });

  // Plush Warm Cognac-Leather Tufted Wingback Reading Armchair & Footstool popping crisply over the emerald carpet (dd_red, ratio 1.000:1)
  f2.obj("modular-suite/props/bookshop_antiquariat/bk_tufted_reading_armchair_colorable.png", 1.14, 23.36, 0.94, 0.94, -1.45, {
    z: 66,
    recolor: ARMCHAIR_COGNAC,
  });

  // Warm Brass Floor Reading Lamp & Tiffany Stained-Glass Floor Lamp framing the reading gallery
  f2.obj("modular-suite/props/harmony_lighting/lgt_floor_brass_reading_lamp.png", 1.50, 22.62, 0.54, 0.54, 0.2, { z: 68 });
  f2.obj("modular-suite/props/harmony_lighting/lgt_floor_tiffany_stained_lamp.png", 1.42, 25.02, 0.54, 0.54, -0.3, { z: 68 });

  // Viennese Zeitungshalter Newspaper-Stick Rack + Small Round Parlor Side Table holding the Enamel Tea Service!
  f2.obj("modular-suite/props/tram_rotunda/rot_newspaper_stick_rack.png", 1.38, 24.42, 0.78, 0.55, -1.35, { z: 64 });
  f2.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 0.90, 24.30, 0.56, 0.56, 0, { z: 64 });
  f2.obj("modular-suite/props/hostel_living/hs_enamel_teapot_mugs_set.png", 0.90, 24.30, 0.42, 0.37, 0.18, { z: 68, shadow: false });

  // Archival Mahogany Bookcases along the west spine + Lithograph Print Portfolio Cradle in the south alcove
  f2.obj("modular-suite/props/bookshop_antiquariat/bk_mahogany_bookcase_packed.png", 0.36, 22.90, 1.60, 0.60, -Math.PI / 2, { z: 62 });
  f2.obj("modular-suite/props/bookshop_antiquariat/bk_mahogany_bookcase_packed.png", 0.36, 24.95, 1.60, 0.60, -Math.PI / 2, { z: 62 });
  f2.obj("modular-suite/props/bookshop_antiquariat/bk_print_portfolio_easel_rack.png", 1.04, 25.98, 1.04, 0.66, -1.25, { z: 64 });
  f2.obj("modular-suite/props/boulevard_shops/bs_wrapped_linen_parcels.png", 0.78, 26.95, 0.56, 0.50, -0.22, { z: 62 });

  // Warm amber reading-gallery & bindery lighting on 2F
  f2.light("Silberblatt 2F Bookbindery Bench Lamp", 1.15, 21.05, 5.2, "#FFC978", 0.92);
  f2.light("Silberblatt 2F Emerald Reading Nook Lamp", 1.24, 23.45, 5.4, "#FFBF66", 0.94);
  f2.light("Silberblatt 2F South Print Gallery Lamp", 1.08, 25.65, 4.6, "#FFBA60", 0.86);

  f2.note(
    "NOTE",
    1.15,
    23.35,
    "2F · Silberblatt Bookbindery & Reading Gallery",
    "Sunlit upper workshop & private collector's reading nook overlooking Steam & Scoop Express. Features an oak hand-binding screw press, fresh sewn folio signatures, cognac-leather tufted wingback armchair with brass reading lamp, parlor tea table, and rare district lithographs.",
    "#226A4E",
  );

  return { bookshopPoly: BOOKSHOP_POLY };
}

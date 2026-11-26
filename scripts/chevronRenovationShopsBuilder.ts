/**
 * Builds the 3-Story Chevron Corner Building ("25 Eisenbahnstraße — Alte Kronen-Apotheke,
 * Zahnrad & Puppe Clockwork Toymaker & Two Family Apartments Under Active Renovation")
 * directly onto `dd-wall-1-21` / `dd-shape-floor-1-12` (6-vertex 45°-rotated L-chevron
 * cradling the Cardboard Crown Community Kid Theater!) across 1F, 2F, 3F, and ROOF,
 * while also healing the raw orange-clay smears and fleshing out the Kid Theater's
 * northern courtyard plaza!
 *
 * Exact Local 45° Frame `(a, b)` anchored at North Crown `V5 = (25.5, 11.5)`:
 *   - `x(a, b) = 25.5 - a*S + b*S`,  `y(a, b) = 11.5 + a*S + b*S`  (`S = √2/2`)
 *   - West Wing: `a ∈ [3.536..9.192], b ∈ [0..2.828]`  (5.66 × 2.83 cells)
 *   - Central Hub: `a ∈ [0..3.536], b ∈ [0..3.850]`     (3.54 × 3.85 cells)
 *   - East Wing: `a ∈ [0..3.536], b ∈ [3.850..7.778]`   (3.54 × 3.93 cells)
 *
 * Vertical Floorplan (exact 1F ↔ 2F ↔ 3F shared stairwell alignment at `pt(1.45, 2.85)` = `(26.49, 14.54)`
 * + exact B1 ↔ 1F cellar stair alignment over `sub-b1-obj-193` at `(25.00, 14.00)`!):
 *  - 1F (0ft):   Two Street-Access Corner Businesses + Shared Central Stairwell (`Flur & Treppenhaus`):
 *                  • West Wing: "Alte Kronen-Apotheke" — Neighborhood Apothecary & Magipunk Herbalist
 *                    (direct street door & emerald striped awning on Eisenbahnstraße, rear stoop door
 *                    to SW Kid Theater stair `dd-obj-1-39`).
 *                  • East Wing: "Zahnrad & Puppe" — Clockwork Watchmaker, Toymaker & Puppet Workshop
 *                    (direct street door & ochre-gold striped awning on North Street, courtyard workshop
 *                    door straight onto SE Kid Theater stair `dd-obj-1-40`).
 *                  • Central Hub: Shared Residential Stairwell & Vestibule with street entry door on
 *                    North Street, courtyard door onto Center Stoop `dd-obj-1-41`, tenant mailboxes,
 *                    aligned B1 cellar descent steps & 1F↔2F↔3F wooden switchback staircase.
 *                  • Kid Theater North Alcove: Healed courtyard cobbles, Kid-Built Marquee Showbill
 *                    Kiosk & Chalk Bucket, Puppet-Craft Bench, overhead fairy-jar bunting & dusk glow.
 *  - 2F (+14ft): "Apartment 2A" — Full-Floor Family Flat Under Early Structural Renovation:
 *                  5 panoramic courtyard-facing windows looking straight down over the Kid Theater!
 *                  Stripped attic subfloor planks, exposed plank repair patches, paint-splattered drop
 *                  cloth, gypsum plaster mixing trough & sacks, contractor's sawhorse chevron-blueprint
 *                  table, stacked lumber & pipe bundles, crated uninstalled porcelain clawfoot tub in
 *                  the bath rough-in, open stepladder & canvas-draped sofa waiting for move-in!
 *  - 3F (+28ft): "Apartment 3A" — Full-Floor Family Flat Nearing Finish (Painting & Move-In Prep):
 *                  5 panoramic courtyard-facing overlook windows above the Kid Theater!
 *                  Newly laid honey-oak herringbone floors protected by splattered drop cloths,
 *                  wallpaper pasting trestle w/ floral rolls, painter's stepladder, canvas-draped
 *                  parlor sofa & armchairs, stacked moving/fixture crates, freshly installed kitchen
 *                  cabinetry & warm workshop pendants — ready for the party to claim & occupy!
 *  - ROOF (+70ft): Upgraded Emerald Fishscale Tile gable roof (`dd-roof-0-6`) w/ warm copper ridge!
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

const S = Math.SQRT1_2;
const Q = Math.PI / 4; // 45°

// Rotations for standard wide sprites (front = +Y, back = -Y, width = X):
const FACE_SE = -Q;          // +b (into West Wing from NW street, or out SW courtyard wall)
const FACE_NW = 3 * Q;       // -b (out onto Eisenbahnstraße, or from SW courtyard toward NW street)
const FACE_SW = Q;           // +a (into East Wing from NE street, or out SE courtyard wall)
const FACE_NE = -3 * Q;      // -a (out onto North Street, or from SE courtyard toward NE street)

// Portal tangent orientations along the 4 diagonal walls:
const WALL_NW_SW_ROT = -Q;   // parallel to V5->V4 and V2->V3
const WALL_NE_SE_ROT = Q;    // parallel to V5->V0 and V2->V1

export const CHEV_A_MID = 3.5355; // inner chevron apex a-coord
export const CHEV_B_MID = 2.8284; // inner chevron apex b-coord
export const CHEV_A_MAX = 9.1924; // SW tip length (6.5 * sqrt(2))
export const CHEV_B_MAX = 7.7782; // SE tip length (5.5 * sqrt(2))

export function chevPt(a: number, b: number): Point2D {
  return {
    x: Math.round((25.5 - a * S + b * S) * 1000) / 1000,
    y: Math.round((11.5 + a * S + b * S) * 1000) / 1000,
  };
}

// Exact shared 1F↔2F↔3F residential switchback stair anchor!
export const CHEV_STAIR_PT = chevPt(1.42, 2.82); // (26.49, 14.50)
// Exact B1↔1F cellar descent stair anchor matching `sub-b1-obj-193`!
export const CHEV_CELLAR_X = 25.0;
export const CHEV_CELLAR_Y = 14.0;

export const CHEV_OUTER_VERTS: Point2D[] = [
  { x: 31.0, y: 17.0 },
  { x: 28.5, y: 19.5 },
  { x: 25.0, y: 16.0 },
  { x: 21.0, y: 20.0 },
  { x: 19.0, y: 18.0 },
  { x: 25.5, y: 11.5 },
];

// Slightly padded polygon (+0.14 cells outward) for upper-floor validation
export const CHEV_POLY: Point2D[] = [
  { x: 31.18, y: 17.0 },
  { x: 28.5, y: 19.68 },
  { x: 25.0, y: 16.18 },
  { x: 21.0, y: 20.18 },
  { x: 18.82, y: 18.0 },
  { x: 25.5, y: 11.32 },
];

function ovalPoly(cx: number, cy: number, rx: number, ry: number, segs = 20): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const ang = (i / segs) * Math.PI * 2;
    out.push({
      x: Math.round((cx + Math.cos(ang) * rx) * 1000) / 1000,
      y: Math.round((cy + Math.sin(ang) * ry) * 1000) / 1000,
    });
  }
  return out;
}

function rectPoly(a0: number, b0: number, a1: number, b1: number): Point2D[] {
  return [chevPt(a0, b0), chevPt(a1, b0), chevPt(a1, b1), chevPt(a0, b1)];
}

function tint(hex: string, strength = 0.90): RgbRecolor {
  return { ...DEFAULT_RECOLOR, enabled: true, mode: "dd_red", tintHex: hex, strength };
}

const AWNING_APOTHECARY_EMERALD = tint("#1F6B50", 0.92);
const AWNING_TOYMAKER_OCHRE = tint("#C48224", 0.92);
const CUSHION_MINT = tint("#3CA07E", 0.88);

function makeChevHelper(tag: string, bundle: IceCreamBuildBundle) {
  let seq = 0;
  const uid = (p: string) => `chv-${tag}-${p}-${++seq}`;

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
      closed: opts.closed ?? false,
      curved: false,
      thicknessCells: opts.thickness ?? 0.16,
      blocksLight: opts.blocksLight ?? true,
    };
    bundle.walls.push(w);
    return id;
  };

  const portal = (
    assetId: string,
    a: number,
    b: number,
    rot: number,
    kind: PortalNode["kind"],
    widthCells: number,
    closed: boolean,
    wallId: string,
  ) => {
    const p = chevPt(a, b);
    bundle.portals.push({
      id: uid("prt"),
      assetId,
      kind,
      wallId,
      x: p.x,
      y: p.y,
      rotationRad: Math.round(rot * 1000) / 1000,
      widthCells,
      closed,
      locked: false,
      blocksLightWhenClosed: kind !== "window",
    });
  };

  const obj = (
    assetId: string,
    a: number,
    b: number,
    w: number,
    h: number,
    rot = 0,
    opts: { z?: number; shadow?: boolean; flipX?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    const p = chevPt(a, b);
    bundle.objects.push({
      id: uid("obj"),
      assetId,
      x: p.x,
      y: p.y,
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
    });
  };

  const worldObj = (
    assetId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    rot = 0,
    opts: { z?: number; shadow?: boolean; flipX?: boolean; opacity?: number; recolor?: RgbRecolor } = {},
  ) => {
    bundle.objects.push({
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
    });
  };

  const light = (
    name: string,
    a: number,
    b: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.90,
    opts: { flicker?: boolean; castShadows?: boolean } = {},
  ) => {
    const p = chevPt(a, b);
    bundle.lights.push({
      id: uid("lgt"),
      name,
      x: p.x,
      y: p.y,
      radiusCells,
      colorHex,
      intensity,
      castShadows: opts.castShadows ?? true,
      coneAngleDeg: 360,
      directionRad: 0,
      flicker: opts.flicker ?? false,
    });
  };

  const worldLight = (
    name: string,
    x: number,
    y: number,
    radiusCells: number,
    colorHex: string,
    intensity = 0.86,
    opts: { flicker?: boolean; castShadows?: boolean } = {},
  ) => {
    bundle.lights.push({
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
    });
  };

  const note = (
    badge: DmNotePin["badge"],
    a: number,
    b: number,
    title: string,
    body: string,
    colorHex: string,
  ) => {
    const p = chevPt(a, b);
    bundle.dmNotes.push({
      id: uid("note"),
      x: p.x,
      y: p.y,
      badge,
      title,
      body,
      colorHex,
    });
  };

  return { floorPoly, wall, portal, obj, worldObj, light, worldLight, note };
}

export function buildChevronRenovationAndShops(
  doc: DcMapDocument,
  f1Out: IceCreamBuildBundle,
  f2Out: IceCreamBuildBundle,
  f3Out: IceCreamBuildBundle,
): { chevronPoly: Point2D[] } {
  const groundTerrain = doc.layers.find((l) => l.id === "layer-dd-terrain-1");
  const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1");
  const roofLayer = doc.layers.find((l) => l.id === "layer-dd-roofs-0");

  // -------------------------------------------------------------------------
  // 0. UPGRADE 1F PERIMETER WALL, FLOOR BASE, EMERALD ROOF & COURTYARD EDGES!
  // -------------------------------------------------------------------------
  const chvFloor1F = groundTerrain?.terrainStrokes?.find((t) => t.id === "dd-shape-floor-1-12");
  if (chvFloor1F) {
    chvFloor1F.assetId = "modular-suite/terrain/harmony/flr_victorian_foyer_encaustic.png";
  }

  // Heal raw orange-clay smears inside the Cardboard Crown Kid Theater North Alcove & SE edge
  // (spliced strictly BEFORE `dd-shape-floor-*` so ZERO cobble can bleed inside buildings!)
  if (groundTerrain?.terrainStrokes) {
    let insertIdx = 0;
    for (let i = 0; i < groundTerrain.terrainStrokes.length; i++) {
      if (
        groundTerrain.terrainStrokes[i].id.startsWith("dd-splat-") ||
        groundTerrain.terrainStrokes[i].id.startsWith("cs-1f-") ||
        groundTerrain.terrainStrokes[i].id.startsWith("rot-edge-") ||
        groundTerrain.terrainStrokes[i].id.startsWith("bk-edge-")
      ) {
        insertIdx = i + 1;
      }
    }
    const theaterHealPatches: TerrainStroke[] = [
      {
        id: "chv-edge-theater-apex-cobble",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(25.10, 17.65, 2.05, 1.35, 20),
        radiusCells: 0,
        opacity: 0.94,
        softness: 0.42,
      },
      {
        id: "chv-edge-theater-east-cobble",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(26.45, 18.75, 1.45, 1.15, 20),
        radiusCells: 0,
        opacity: 0.92,
        softness: 0.42,
      },
      {
        id: "chv-edge-theater-se-stoop-cobble",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(28.25, 19.95, 1.45, 1.25, 20),
        radiusCells: 0,
        opacity: 0.94,
        softness: 0.40,
      },
      {
        id: "chv-edge-theater-booth-cobble",
        assetId: "modular-suite/terrain/terrain_mountain_scree_talus.png",
        shape: "polygon",
        points: ovalPoly(28.85, 22.15, 1.20, 1.35, 20),
        radiusCells: 0,
        opacity: 0.90,
        softness: 0.42,
      },
    ];
    groundTerrain.terrainStrokes.splice(insertIdx, 0, ...theaterHealPatches);
  }

  // Upgrade 1F chevron exterior masonry wall (`dd-wall-1-21`) to Berlin Ochre Stucco & Brick!
  const chvWall1F = groundWalls?.walls?.find((w) => w.id === "dd-wall-1-21");
  if (chvWall1F) {
    chvWall1F.assetId = "modular-suite/walls/harmony/wall_berlin_ochre_stucco_brick.png";
    chvWall1F.thicknessCells = 0.22;
  }

  // Upgrade `dd-roof-0-6` from mossy clay to Emerald Fishscale Tile w/ Warm Copper Ridge Cap!
  const chvRoof = roofLayer?.roofs?.find((r) => r.id === "dd-roof-0-6");
  if (chvRoof) {
    chvRoof.assetId = "modular-suite/terrain/harmony/roof_emerald_fishscale_tile.png";
    chvRoof.ridgeCapStyle = "copper";
    chvRoof.ridgeColorHex = "#C4844E";
    chvRoof.eaveTrim = true;
    chvRoof.eaveTrimHex = "#1B2E28";
    chvRoof.slopeShade = 0.54;
    chvRoof.dropShadow = 0.60;
  }

  const f1 = makeChevHelper("1f", f1Out);
  const f2 = makeChevHelper("2f", f2Out);
  const f3 = makeChevHelper("3f", f3Out);
  const wallId1F = chvWall1F?.id ?? "dd-wall-1-21";

  // =========================================================================
  // 1F (0ft) — TWO STREET-ACCESS BUSINESSES + SHARED STAIRWELL + KID THEATER
  // =========================================================================

  // Distinct flooring zones inside 1F (Center stairwell keeps encaustic mosaic tile!):
  // West Wing — "Alte Kronen-Apotheke" emerald & cream checkered apothecary tile!
  f1.floorPoly("modular-suite/terrain/harmony/flr_emerald_parlor_checker.png", rectPoly(CHEV_A_MID, 0.0, CHEV_A_MAX, CHEV_B_MID));
  // East Wing — "Zahnrad & Puppe" bleached pine clockwork & puppet workshop planks!
  f1.floorPoly("modular-suite/terrain/harmony/flr_bleached_pine_workshop.png", rectPoly(0.0, 3.85, CHEV_A_MID, CHEV_B_MAX));

  // Two solid interior partition walls isolating the Shared Central Stairwell (`a ∈ [0..3.54], b ∈ [0..3.85]`)
  // cleanly from both ground-floor businesses!
  f1.wall("modular-suite/walls/harmony/wall_oak_wainscot_parlor.png", [chevPt(CHEV_A_MID, 0.0), chevPt(CHEV_A_MID, CHEV_B_MID)], { thickness: 0.16 });
  f1.wall("modular-suite/walls/harmony/wall_oak_wainscot_parlor.png", [chevPt(0.0, 3.85), chevPt(CHEV_A_MID, 3.85)], { thickness: 0.16 });

  // -------------------------------------------------------------------------
  // 1F CENTER HUB — SHARED RESIDENTIAL STAIRWELL & VESTIBULE (`Flur & Treppenhaus`)
  // -------------------------------------------------------------------------
  // Street entry door on NE street wall + Courtyard entry door onto Center Kid Theater stoop `dd-obj-1-41`!
  f1.portal("modular-suite/portals/harmony/door_grunderzeit_mahogany.png", 0.0, 1.55, WALL_NE_SE_ROT, "door", 1.12, false, wallId1F);
  f1.portal("modular-suite/portals/harmony/door_grunderzeit_mahogany.png", CHEV_A_MID, 3.36, WALL_NE_SE_ROT, "door", 1.06, false, wallId1F);
  // Street-side hallway frosted window illuminating the shared stairwell!
  f1.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 1.55, 0.0, WALL_NW_SW_ROT, "window", 1.10, true, wallId1F);

  // EXACT vertically aligned 1F↔2F↔3F residential switchback staircase! (288x360 -> 0.800:1)
  f1.worldObj(
    "modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png",
    CHEV_STAIR_PT.x,
    CHEV_STAIR_PT.y,
    1.12,
    1.40,
    FACE_SE,
    { z: 56 },
  );
  // EXACT B1↔1F cellar descent stair aligned directly over `sub-b1-obj-193` at (25.00, 14.00)! (220x320 -> 0.688:1)
  f1.worldObj(
    "modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png",
    CHEV_CELLAR_X,
    CHEV_CELLAR_Y,
    0.99,
    1.44,
    Q,
    { z: 54 },
  );
  // Tenant mailbox & key rack mounted right inside the street-side foyer wall! (224x96 -> 2.333:1)
  f1.obj("modular-suite/props/post_housing/ph_tenant_mailbox_key_rack.png", 0.52, 0.65, 1.05, 0.45, FACE_SE, { z: 62 });
  // Renovation notice & contractor's waiting boxes tucked neatly in the stairwell corner!
  f1.obj("modular-suite/props/post_housing/ph_paper_flyers_books_pile.png", 2.95, 2.38, 0.50, 0.40, 0.4, { z: 62 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 1.75, 1.90, 0.48, 0.48, 0, { z: 76, shadow: false });
  f1.light("Shared Stairwell 1F Foyer Lantern", 1.75, 1.90, 5.2, "#FFD282", 0.88);

  // -------------------------------------------------------------------------
  // 1F BUSINESS 1 (WEST WING) — "ALTE KRONEN-APOTHEKE" (APOTHECARY & HERBALIST)
  // -------------------------------------------------------------------------
  // Street access onto Eisenbahnstraße (NW wall) + glowing display bays + SW Kid Theater stoop door!
  f1.portal("modular-suite/portals/harmony/door_shop_emerald_glass.png", 6.20, 0.0, WALL_NW_SW_ROT, "door", 1.20, false, wallId1F);
  f1.portal("modular-suite/portals/harmony/win_bay_apothecary_emerald.png", 4.65, 0.0, WALL_NW_SW_ROT, "window", 1.26, true, wallId1F);
  f1.portal("modular-suite/portals/harmony/win_bay_apothecary_emerald.png", 7.75, 0.0, WALL_NW_SW_ROT, "window", 1.26, true, wallId1F);
  // Courtyard-facing window & rear stoop door opening onto existing SW stair `dd-obj-1-39`!
  f1.portal("modular-suite/portals/harmony/win_bay_apothecary_emerald.png", 5.65, CHEV_B_MID, WALL_NW_SW_ROT, "window", 1.26, true, wallId1F);
  f1.portal("modular-suite/portals/harmony/door_shop_emerald_glass.png", 8.09, CHEV_B_MID, WALL_NW_SW_ROT, "door", 1.12, false, wallId1F);

  // Exterior Forest-Emerald Striped Shopfront Awning (flush to brick facade!) & Hanging Flask Sign on Eisenbahnstraße!
  f1.obj("modular-suite/props/renovation_shops/ren_apothecary_toymaker_awning_colorable.png", 6.20, -0.28, 1.85, 0.74, FACE_NW, {
    z: 84,
    recolor: AWNING_APOTHECARY_EMERALD,
  });
  f1.obj("modular-suite/props/harmony_arch/facade_sign_apothecary_flask.png", 5.02, -0.32, 0.70, 0.56, FACE_NW, { z: 82 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_storefront_gooseneck.png", 7.28, -0.20, 0.44, 0.44, FACE_NW, { z: 80 });

  // Inside Alte Kronen-Apotheke:
  // Twin Walnut Apothecary Drawer Wall Cabinets packed w/ cobalt jars & elixirs along interior walls! (256x96 -> 2.667:1)
  f1.obj("modular-suite/props/renovation_shops/ren_apothecary_drawer_wall_cabinet.png", 3.92, 1.42, 1.76, 0.66, FACE_SW, { z: 62 });
  f1.obj("modular-suite/props/renovation_shops/ren_apothecary_drawer_wall_cabinet.png", 6.55, 2.40, 1.60, 0.60, FACE_NW, { z: 62 });
  // Main Apothecary Sales & Compounding Counter facing the Eisenbahnstraße door! (234x183 -> 1.279:1)
  f1.obj("modular-suite/props/market_tailor/mkt_bare_shop_counter.png", 5.55, 1.38, 1.15, 0.90, FACE_NW, { z: 62 });
  f1.obj("modular-suite/props/library_alchemy/arc_glowing_mortar.png", 5.25, 1.35, 0.44, 0.47, 0.3, { z: 68, shadow: false });
  f1.obj("modular-suite/props/harmony_lighting/lgt_table_apothecaries_spirit_lamp.png", 5.82, 1.32, 0.46, 0.46, 0, { z: 68, shadow: false });
  f1.obj("modular-suite/props/doctor_apothecary/doc_leather_stool.png", 5.55, 2.02, 0.46, 0.56, FACE_NW, { z: 60 });
  // Alchemical Distillation Worktable & Window Elixir Pedestal (zero bare-floor vials or stills!)
  f1.obj("modular-suite/props/doctor_apothecary/doc_apothecary_cabinet.png", 8.58, 1.35, 1.45, 0.74, FACE_NE, { z: 62 });
  f1.obj("modular-suite/props/bare_furniture/bare_pine_worktable.png", 7.42, 1.22, 1.12, 0.84, FACE_NW, { z: 60 });
  f1.obj("modular-suite/props/library_alchemy/arc_alembic_still.png", 7.22, 1.22, 0.54, 0.57, 0.25, { z: 68, shadow: false });
  f1.obj("modular-suite/props/doctor_apothecary/doc_medicine_vials.png", 7.68, 1.18, 0.42, 0.44, -0.2, { z: 68, shadow: false });
  f1.obj("modular-suite/props/bare_furniture/bare_round_cafe_table.png", 4.65, 0.70, 0.62, 0.62, 0, { z: 60 });
  f1.obj("modular-suite/props/library_alchemy/arc_potion_trio.png", 4.65, 0.70, 0.44, 0.43, -0.3, { z: 68, shadow: false });
  f1.obj("modular-suite/props/doctor_apothecary/doc_dried_lavender.png", 4.65, 2.28, 0.38, 0.64, 0.45, { z: 64 });
  // Emerald billiard-shade apothecary ceiling pendants & glowing warm-emerald shop lighting!
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_billiard_green_pendant.png", 5.60, 1.40, 0.50, 0.50, 0, { z: 76, shadow: false });
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_billiard_green_pendant.png", 7.55, 1.40, 0.50, 0.50, 0, { z: 76, shadow: false });
  f1.light("Alte Kronen-Apotheke Main Glow", 5.85, 1.40, 5.8, "#B8F2C6", 0.88);
  f1.light("Alte Kronen-Apotheke Alembic Glow", 7.80, 1.45, 5.2, "#FFD078", 0.86, { flicker: true });

  // -------------------------------------------------------------------------
  // 1F BUSINESS 2 (EAST WING) — "ZAHNRAD & PUPPE" (CLOCKWORK TOYMAKER & PUPPETS)
  // -------------------------------------------------------------------------
  // Street access onto North Street (NE wall) + glowing showcase bays + SE Kid Theater workshop door!
  f1.portal("modular-suite/portals/harmony/door_grunderzeit_double_glass.png", 0.0, 5.65, WALL_NE_SE_ROT, "door", 1.24, false, wallId1F);
  f1.portal("modular-suite/portals/harmony/win_bay_crimson_cafe.png", 0.0, 4.35, WALL_NE_SE_ROT, "window", 1.12, true, wallId1F);
  f1.portal("modular-suite/portals/harmony/win_bay_crimson_cafe.png", 0.0, 6.95, WALL_NE_SE_ROT, "window", 1.12, true, wallId1F);
  // Courtyard-facing showcase window & direct workshop door onto existing SE Kid Theater stoop `dd-obj-1-40`!
  f1.portal("modular-suite/portals/harmony/win_bay_crimson_cafe.png", CHEV_A_MID, 5.05, WALL_NE_SE_ROT, "window", 1.26, true, wallId1F);
  f1.portal("modular-suite/portals/harmony/door_shop_emerald_glass.png", CHEV_A_MID, 6.67, WALL_NE_SE_ROT, "door", 1.12, false, wallId1F);

  // Exterior Warm Ochre-Gold Striped Toymaker Awning (flush to brick!) & Hanging Clockmaker Gear Sign on North Street!
  f1.obj("modular-suite/props/renovation_shops/ren_apothecary_toymaker_awning_colorable.png", -0.28, 5.65, 1.85, 0.74, FACE_NE, {
    z: 84,
    recolor: AWNING_TOYMAKER_OCHRE,
  });
  f1.obj("modular-suite/props/harmony_arch/facade_sign_clockmaker_gear.png", -0.32, 4.48, 0.70, 0.56, FACE_NE, { z: 82 });
  f1.obj("modular-suite/props/harmony_lighting/lgt_sconce_storefront_gooseneck.png", -0.20, 6.72, 0.44, 0.44, FACE_NE, { z: 80 });

  // Inside Zahnrad & Puppe Clockwork Toymaker & Puppet Workshop (spacious open thoroughfare between street & Kid Theater doors!):
  // Hero Clockwork Toymaker & Marionette Carving Workbench facing the Kid Theater window! (240x128 -> 1.875:1)
  f1.obj("modular-suite/props/renovation_shops/ren_puppet_toymaker_workbench.png", 2.60, 5.55, 1.65, 0.88, FACE_NE, { z: 64 });
  f1.obj("modular-suite/props/doctor_apothecary/doc_leather_stool.png", 1.78, 5.55, 0.46, 0.56, FACE_SW, { z: 60 });
  // Master Clockmaker's Horology & Spring-Winding Bench along the inner partition wall! (272x144 -> 1.889:1)
  f1.obj("modular-suite/props/boulevard_shops/bs_clockmaker_horology_bench.png", 1.48, 4.34, 1.60, 0.85, FACE_SE, { z: 64 });
  // Grandfather Orrery Clock & Wooden Toy Train Display Table in the sunlit NE showcase windows!
  f1.obj("modular-suite/props/boulevard_shops/bs_grandfather_orrery_clock.png", 0.62, 4.55, 0.78, 0.70, FACE_SE, { z: 66 });
  f1.obj("modular-suite/props/bare_furniture/bare_pine_worktable.png", 0.88, 6.92, 1.12, 0.84, FACE_SW, { z: 60 });
  f1.obj("modular-suite/props/ice_cream_train/ic_wooden_toy_train_oval.png", 0.88, 6.92, 0.68, 0.92, FACE_NE, { z: 68, shadow: false });
  // Spare clockwork gears resting cleanly on horology bench + half-built wooden puppet booth near SE workshop door!
  f1.obj("modular-suite/props/boulevard_shops/bs_clockwork_gears_loupe.png", 2.02, 4.34, 0.44, 0.44, 0.3, { z: 68, shadow: false });
  f1.obj("modular-suite/props/community_kid_theater/kt_bare_puppet_booth_frame.png", 2.15, 7.25, 1.15, 0.80, FACE_NW, { z: 62 });
  // Warm amber & industrial enamel workshop pendants!
  f1.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 1.80, 5.65, 0.50, 0.50, 0, { z: 76, shadow: false });
  f1.light("Zahnrad & Puppe Toymaker Warm Glow", 1.75, 5.65, 6.0, "#FFC86B", 0.94);

  // -------------------------------------------------------------------------
  // 1F KID THEATER NORTH PLAZA EXPANSION (FLESHING OUT THE COURTYARD SCENE!)
  // -------------------------------------------------------------------------
  // Kid-built painted Marquee Showbill Kiosk, Crayon Posters, Chalk Bucket & Pinwheel in the NW chevron alcove! (208x112 -> 1.857:1)
  f1.worldObj("modular-suite/props/renovation_shops/ren_kid_theater_marquee_chalk_kiosk.png", 23.58, 18.28, 1.45, 0.78, FACE_SE, { z: 66 });
  // Kids' Puppet-Repair & Cardboard Shield Craft Bench tucked neatly beside Zahnrad & Puppe's SE stoop (clear of center stoop cheek!)
  f1.worldObj("modular-suite/props/bare_furniture/bare_pine_worktable.png", 26.44, 18.18, 1.06, 0.80, FACE_SW, { z: 62 });
  f1.worldObj("modular-suite/props/community_kid_theater/kt_prop_paint_buckets_brushes.png", 26.24, 18.04, 0.56, 0.46, 0.25, { z: 68, shadow: false });
  f1.worldObj("modular-suite/props/community_kid_theater/kt_prop_cardboard_crown_sword.png", 26.64, 18.34, 0.46, 0.41, -0.35, { z: 68, shadow: false });
  f1.worldObj("modular-suite/props/community_kid_theater/kt_milk_crate_stool_painted.png", 25.96, 18.82, 0.48, 0.48, 0.2, { z: 60 });
  // Kids' sidewalk crayon drawing sheet & mint floor cushion near the SW alcove (clear of SW stoop `22.15, 19.59`!)
  f1.worldObj("modular-suite/props/crowded_family/cf_crayon_drawing_sheet.png", 23.68, 19.12, 0.62, 0.55, -0.32, { z: 48, shadow: false });
  f1.worldObj("modular-suite/props/community_kid_theater/kt_colorable_floor_cushion.png", 24.32, 19.05, 0.50, 0.50, 0.18, {
    z: 56,
    recolor: CUSHION_MINT,
  });
  // Festive overhead mason-jar fairy light bunting strung across the newly framed chevron north alcove! (320x112 -> 2.857:1)
  f1.worldObj("modular-suite/props/community_kid_theater/kt_jar_fairy_bunting_garland.png", 25.05, 18.35, 2.75, 0.96, 0.04, {
    z: 84,
    shadow: false,
  });
  f1.worldLight("Kid Theater North Alcove Fairy Glow", 25.05, 18.25, 5.4, "#FFD27A", 0.84, { flicker: true, castShadows: false });

  // 1F DM Notes for both businesses & shared stairwell!
  f1.note(
    "NOTE",
    6.20,
    1.45,
    "1F · Alte Kronen-Apotheke (West Shop)",
    "Warm emerald-tiled neighborhood apothecary & herbalist with street entry on Eisenbahnstraße and a rear courtyard stoop to the Kid Theater. Packed walnut herb-drawer walls, cobalt elixir jars, glowing alembic still, and brass compounding counter.",
    "#1F6B50",
  );
  f1.note(
    "NOTE",
    1.85,
    5.65,
    "1F · Zahnrad & Puppe (Clockwork Toymaker)",
    "North-street clockwork watchmaker, wooden toymaker & marionette-carving workshop whose courtyard workshop door opens straight into the Cardboard Crown Kid Theater—the neighborhood craftsman who helps the kids build their Clockwork Dragon and puppets.",
    "#C48224",
  );

  // =========================================================================
  // 2F (+14ft) — "APARTMENT 2A" FULL-FLOOR FAMILY FLAT UNDER EARLY RENOVATION
  //              (Continuous Single-Family Flat Behind 1 Private Door off Shared Landing!)
  // =========================================================================
  // Raw weathered subfloor planks across the entire continuous 2F family apartment!
  f2.floorPoly("modular-suite/terrain/harmony/flr_weathered_attic_planks.png", CHEV_OUTER_VERTS);
  // Compact enclosed shared stairwell encaustic tile landing (`a ∈ [0..2.30], b ∈ [1.85..3.85]`)
  f2.floorPoly("modular-suite/terrain/harmony/flr_victorian_foyer_encaustic.png", rectPoly(0.0, 1.85, 2.30, 3.85));
  // Half-tiled Jugendstil hex mosaic in the East-End Kitchen/Bath Rough-In (`b ∈ [5.55..7.78]`)!
  f2.floorPoly("modular-suite/terrain/harmony/flr_jugendstil_hex_mosaic.png", rectPoly(0.0, 5.55, CHEV_A_MID, CHEV_B_MAX));

  // Exterior 2F walls
  const wallId2F = f2.wall("modular-suite/walls/harmony/wall_berlin_ochre_stucco_brick.png", CHEV_OUTER_VERTS, {
    closed: true,
    thickness: 0.22,
  });

  // 5 PANORAMIC KID-THEATER OVERLOOK WINDOWS along BOTH inner courtyard walls (so 2F residents look straight down!)
  f2.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", 4.75, CHEV_B_MID, WALL_NW_SW_ROT, "window", 1.24, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", 6.45, CHEV_B_MID, WALL_NW_SW_ROT, "window", 1.24, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", 8.15, CHEV_B_MID, WALL_NW_SW_ROT, "window", 1.18, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", CHEV_A_MID, 4.55, WALL_NE_SE_ROT, "window", 1.28, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", CHEV_A_MID, 6.45, WALL_NE_SE_ROT, "window", 1.28, true, wallId2F);
  // Street-side windows along NW & NE facades (including North Crown corner & stairwell landing!)
  f2.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 1.55, 0.0, WALL_NW_SW_ROT, "window", 1.10, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 5.20, 0.0, WALL_NW_SW_ROT, "window", 1.22, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 7.60, 0.0, WALL_NW_SW_ROT, "window", 1.22, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 0.0, 0.95, WALL_NE_SE_ROT, "window", 1.04, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 0.0, 2.85, WALL_NE_SE_ROT, "window", 1.04, true, wallId2F);
  f2.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 0.0, 5.45, WALL_NE_SE_ROT, "window", 1.24, true, wallId2F);

  // Compact Shared Stairwell Enclosure (`a ∈ [0..2.30], b ∈ [1.85..3.85]`) w/ ONE private front door into Flat 2A!
  // Leaves a continuous private inner corridor (`a ∈ [2.30..3.54], b ∈ [1.85..3.85]`) linking West Wing ↔ North Crown ↔ East Wing!
  f2.wall("modular-suite/walls/harmony/wall_tenement_peeling_ochre.png", [chevPt(0.0, 1.85), chevPt(2.30, 1.85)], { thickness: 0.16 });
  const f2StairFrontWall = f2.wall("modular-suite/walls/harmony/wall_tenement_peeling_ochre.png", [chevPt(2.30, 1.85), chevPt(2.30, 3.85)], {
    thickness: 0.16,
  });
  f2.wall("modular-suite/walls/harmony/wall_tenement_peeling_ochre.png", [chevPt(0.0, 3.85), chevPt(2.30, 3.85)], { thickness: 0.16 });
  // ONE propped-open private apartment front door from shared landing directly into Flat 2A's inner foyer!
  f2.portal("modular-suite/portals/harmony/door_grunderzeit_mahogany.png", 2.30, 2.78, WALL_NE_SE_ROT, "door", 1.02, false, f2StairFrontWall);

  // Half-framed interior timber partition walls (future West Master Bedroom & East Bath/Kitchen)
  f2.wall("modular-suite/walls/harmony/wall_mine_timber_shoring.png", [chevPt(6.75, 0.0), chevPt(6.75, 1.85)], { thickness: 0.14 });
  f2.wall("modular-suite/walls/harmony/wall_mine_timber_shoring.png", [chevPt(0.0, 5.55), chevPt(2.35, 5.55)], { thickness: 0.14 });

  // EXACT vertically aligned 2F shared switchback staircase!
  f2.worldObj(
    "modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png",
    CHEV_STAIR_PT.x,
    CHEV_STAIR_PT.y,
    1.12,
    1.40,
    FACE_SE,
    { z: 56 },
  );

  // 2F Newly Unlocked Sunlit North-Crown Room (`a ∈ [0..3.54], b ∈ [0..1.85]`) — Contractor Lumber & Tile Staging!
  f2.obj("modular-suite/props/ship_cargo_hold/cargo_strapped_lumber_spars.png", 1.78, 0.72, 1.53, 0.70, FACE_SE, { z: 62 });
  f2.obj("modular-suite/modular/crate_pine_slatted.png", 0.68, 1.25, 0.66, 0.66, FACE_SE, { z: 60 });
  f2.obj("modular-suite/modular/crate_oak_md.png", 2.95, 0.92, 0.64, 0.64, FACE_SE + 0.18, { z: 60 });

  // 2F West Wing — Stripped Great Room & Plastering Zone overlooking the Kid Theater!
  f2.obj("modular-suite/props/ship_ornaments_damage/ship_plank_repair_patch.png", 4.45, 1.85, 0.96, 0.92, FACE_SE, { z: 48, shadow: false });
  f2.obj("modular-suite/props/renovation_shops/ren_paint_drop_cloth_splattered.png", 5.50, 1.48, 1.75, 1.40, FACE_SE + 0.08, { z: 50, shadow: false });
  // Gypsum plaster mixing trough, trowels & whitewash sacks! (clean spacing now that lumber moved to North Crown!)
  f2.obj("modular-suite/props/renovation_shops/ren_plaster_mortar_tub_trowels.png", 5.10, 0.80, 1.10, 0.90, FACE_SE, { z: 64 });
  // Open wooden painter's stepladder & sage paint can right beside the courtyard window! (160x144 -> 1.111:1)
  f2.obj("modular-suite/props/renovation_shops/ren_folded_step_ladder_paint_can.png", 5.95, 2.08, 0.90, 0.81, FACE_NW + 0.15, { z: 66 });
  f2.obj("modular-suite/props/blacksmith/bs_open_toolbox.png", 6.22, 0.72, 0.54, 0.52, -0.3, { z: 64 });

  // 2F Far-West Future Master Bedroom (`a ∈ [6.75..9.19]`) — Sawhorse, Stacked Planks & Dust-Sheet-Draped Sofa!
  f2.obj("modular-suite/props/renovation_shops/ren_sheet_draped_furniture_sofa.png", 8.05, 0.85, 1.54, 0.88, FACE_SE, { z: 64 });
  f2.obj("modular-suite/props/shipyard_building/yard_carpenter_sawhorse.png", 7.85, 2.05, 1.26, 0.60, FACE_NW, { z: 62 });
  f2.obj("modular-suite/props/shipyard_building/yard_pine_deck_planks.png", 8.75, 2.02, 0.96, 0.74, FACE_SW, { z: 60 });

  // 2F East Wing — Courtyard-Overlook Blueprint Table + Kitchen/Bath Plumbing Rough-In!
  // Contractor's Sawhorse Chevron-Blueprint Table right beside the Kid Theater overlook window! (240x128 -> 1.875:1)
  f2.obj("modular-suite/props/renovation_shops/ren_contractor_blueprint_sawhorse_table.png", 2.10, 4.78, 1.65, 0.88, FACE_SW, { z: 64 });
  f2.obj("modular-suite/props/shipyard_building/yard_hull_paint_tray.png", 0.72, 4.72, 0.64, 0.42, FACE_SW + 0.25, { z: 60 });
  // East-End Kitchen/Bath Rough-In (`b ∈ [5.55..7.78]`): Uninstalled Crated Enamel Clawfoot Tub & Copper Pipes! (224x144 -> 1.556:1)
  f2.obj("modular-suite/props/renovation_shops/ren_uninstalled_porcelain_tub_pipes.png", 1.78, 6.72, 1.40, 0.90, FACE_SW, { z: 64 });
  f2.obj("modular-suite/props/ship_cargo_hold/cargo_brass_pipe_bundle.png", 0.68, 6.65, 1.05, 0.68, FACE_SW, { z: 62 });
  f2.obj("modular-suite/props/sewers_alleys/sew_builder_ladder.png", 2.88, 6.55, 1.34, 0.54, FACE_SW, { z: 62 });

  // Bare industrial worklights casting warm golden contractor lighting across 2F!
  f2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 5.55, 1.45, 0.48, 0.48, 0, { z: 76, shadow: false });
  f2.obj("modular-suite/props/harmony_lighting/lgt_ceiling_enamel_workshop_pendant.png", 1.85, 5.20, 0.48, 0.48, 0, { z: 76, shadow: false });
  f2.light("Flat 2A Renovation Worklight West", 5.65, 1.45, 6.2, "#FFCA72", 0.90);
  f2.light("Flat 2A Renovation Worklight Bedroom", 8.00, 1.45, 4.8, "#FFBE62", 0.82);
  f2.light("Flat 2A Renovation Worklight North", 1.85, 0.95, 4.8, "#FFCA72", 0.84);
  f2.light("Flat 2A Renovation Worklight East", 1.85, 5.45, 5.8, "#FFCA72", 0.90);
  f2.light("Shared Stairwell 2F Landing Light", 1.30, 2.80, 4.2, "#FFD282", 0.84);

  f2.note(
    "NOTE",
    5.45,
    1.50,
    "2F · Flat 2A (Family Apartment — Early Renovation)",
    "Continuous 1-family apartment behind a single front door off the shared stairwell, with 5 panoramic windows overlooking the Kid Theater courtyard. Stripped floorboards, gypsum plaster trough, timber framing partitions, contractor's sawhorse chevron-blueprint table, lumber staging in the north corner room, and crated clawfoot tub ready for plumbing—available for the party to claim or customize!",
    "#E5A93C",
  );

  // =========================================================================
  // 3F (+28ft) — "APARTMENT 3A" FULL-FLOOR FAMILY FLAT NEARING FINISH
  //              (Continuous Single-Family Flat Behind 1 Private Door off Shared Landing!)
  // =========================================================================
  // Newly installed honey-oak herringbone parquet across the entire continuous 3F apartment!
  f3.floorPoly("modular-suite/terrain/harmony/flr_honey_oak_herringbone.png", CHEV_OUTER_VERTS);
  // Compact enclosed shared stairwell encaustic tile landing (`a ∈ [0..2.30], b ∈ [1.85..3.85]`)
  f3.floorPoly("modular-suite/terrain/harmony/flr_victorian_foyer_encaustic.png", rectPoly(0.0, 1.85, 2.30, 3.85));
  // Newly tiled Jugendstil kitchen/bath mosaic at the east end (`b ∈ [5.55..7.78]`)
  f3.floorPoly("modular-suite/terrain/harmony/flr_jugendstil_hex_mosaic.png", rectPoly(0.0, 5.55, CHEV_A_MID, CHEV_B_MAX));

  // Exterior 3F walls
  const wallId3F = f3.wall("modular-suite/walls/harmony/wall_berlin_ochre_stucco_brick.png", CHEV_OUTER_VERTS, {
    closed: true,
    thickness: 0.22,
  });

  // 5 PANORAMIC KID-THEATER OVERLOOK WINDOWS along BOTH inner courtyard walls on 3F!
  f3.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", 4.75, CHEV_B_MID, WALL_NW_SW_ROT, "window", 1.24, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", 6.45, CHEV_B_MID, WALL_NW_SW_ROT, "window", 1.24, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", 8.15, CHEV_B_MID, WALL_NW_SW_ROT, "window", 1.18, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", CHEV_A_MID, 4.55, WALL_NE_SE_ROT, "window", 1.28, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_jugendstil_amber_teal.png", CHEV_A_MID, 6.45, WALL_NE_SE_ROT, "window", 1.28, true, wallId3F);
  // Street-side windows along NW & NE facades
  f3.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 1.55, 0.0, WALL_NW_SW_ROT, "window", 1.10, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 5.20, 0.0, WALL_NW_SW_ROT, "window", 1.22, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 7.60, 0.0, WALL_NW_SW_ROT, "window", 1.22, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 0.0, 0.95, WALL_NE_SE_ROT, "window", 1.04, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 0.0, 2.85, WALL_NE_SE_ROT, "window", 1.04, true, wallId3F);
  f3.portal("modular-suite/portals/harmony/win_tenement_sash_lit.png", 0.0, 5.45, WALL_NE_SE_ROT, "window", 1.24, true, wallId3F);

  // Compact Shared Stairwell Enclosure (`a ∈ [0..2.30], b ∈ [1.85..3.85]`) w/ ONE private front door into Flat 3A!
  f3.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [chevPt(0.0, 1.85), chevPt(2.30, 1.85)], { thickness: 0.16 });
  const f3StairFrontWall = f3.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [chevPt(2.30, 1.85), chevPt(2.30, 3.85)], {
    thickness: 0.16,
  });
  f3.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [chevPt(0.0, 3.85), chevPt(2.30, 3.85)], { thickness: 0.16 });
  f3.portal("modular-suite/portals/harmony/door_grunderzeit_mahogany.png", 2.30, 2.78, WALL_NE_SE_ROT, "door", 1.02, false, f3StairFrontWall);

  // Completed interior bedroom & kitchen partition walls with open doorways
  const f3BedWall = f3.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [chevPt(6.75, 0.0), chevPt(6.75, CHEV_B_MID)], {
    thickness: 0.14,
  });
  f3.portal("modular-suite/portals/harmony/door_grunderzeit_mahogany.png", 6.75, 1.55, WALL_NE_SE_ROT, "door", 0.96, false, f3BedWall);
  const f3KitWall = f3.wall("modular-suite/walls/harmony/wall_tenement_peeling_sage.png", [chevPt(0.0, 5.55), chevPt(CHEV_A_MID, 5.55)], {
    thickness: 0.14,
  });
  f3.portal("modular-suite/portals/harmony/door_grunderzeit_mahogany.png", 1.85, 5.55, WALL_NW_SW_ROT, "door", 0.96, false, f3KitWall);

  // EXACT vertically aligned 3F shared switchback staircase!
  f3.worldObj(
    "modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png",
    CHEV_STAIR_PT.x,
    CHEV_STAIR_PT.y,
    1.12,
    1.40,
    FACE_SE,
    { z: 56 },
  );

  // 3F Sunlit North-Crown Room (`a ∈ [0..3.54], b ∈ [0..1.85]`) — Unpacking Foyer & Draped Reading Alcove!
  f3.obj("modular-suite/props/renovation_shops/ren_sheet_draped_armchair_boxes.png", 1.65, 0.92, 1.00, 0.90, FACE_SE, { z: 64 });
  f3.obj("modular-suite/modular/crate_open_straw.png", 0.68, 1.22, 0.66, 0.66, FACE_SE, { z: 60 });
  f3.obj("modular-suite/props/boulevard_shops/bs_wrapped_linen_parcels.png", 2.85, 0.88, 0.56, 0.50, 0.25, { z: 60 });

  // 3F West Wing — Freshly Primed Family Parlor (Drop Cloths, Wallpaper Pasting Trestle & Sheet-Draped Furniture!)
  f3.obj("modular-suite/props/renovation_shops/ren_paint_drop_cloth_splattered.png", 5.25, 1.48, 1.75, 1.40, FACE_SE - 0.08, { z: 50, shadow: false });
  // Wallpaper pasting trestle w/ unrolled vintage sage-and-gold botanical roll! (256x112 -> 2.286:1)
  f3.obj("modular-suite/props/renovation_shops/ren_wallpaper_pasting_trestle.png", 5.25, 0.75, 1.76, 0.77, FACE_SE, { z: 64 });
  // Open painter's stepladder & paint tin right beneath the Kid Theater overlook windows!
  f3.obj("modular-suite/props/renovation_shops/ren_folded_step_ladder_paint_can.png", 5.82, 2.08, 0.90, 0.81, FACE_NW - 0.12, { z: 66 });
  // Dust-sheet-draped armchair & taped moving box waiting to be uncovered! (160x144 -> 1.111:1)
  f3.obj("modular-suite/props/renovation_shops/ren_sheet_draped_armchair_boxes.png", 4.35, 2.02, 1.00, 0.90, FACE_NW, { z: 64 });

  // 3F Far-West Future Master Bedroom (`a ∈ [6.75..9.19]`) — Draped Parlor Sofa & Moving Crates!
  f3.obj("modular-suite/props/renovation_shops/ren_sheet_draped_furniture_sofa.png", 8.05, 0.88, 1.54, 0.88, FACE_SE, { z: 64 });
  f3.obj("modular-suite/props/renovation_shops/ren_sheet_draped_armchair_boxes.png", 8.02, 2.02, 1.00, 0.90, FACE_NW + 0.15, { z: 64 });

  // 3F East Wing — Sunlit Overlook Dining Salon + Newly Installed Kitchen Cabinetry!
  f3.obj("modular-suite/props/renovation_shops/ren_paint_drop_cloth_splattered.png", 1.85, 4.72, 1.45, 1.16, FACE_SW + 0.12, { z: 50, shadow: false });
  f3.obj("modular-suite/props/shipyard_building/yard_carpenter_sawhorse.png", 2.48, 4.65, 1.26, 0.60, FACE_NE, { z: 64 });
  f3.obj("modular-suite/props/community_kid_theater/kt_prop_paint_buckets_brushes.png", 0.85, 4.65, 0.72, 0.59, 0.35, { z: 64 });
  f3.obj("modular-suite/props/blacksmith/bs_open_toolbox.png", 1.42, 4.35, 0.52, 0.50, -0.25, { z: 64 });
  // East-End Newly Installed Kitchenette & Countertop awaiting final appliance unboxing (`b ∈ [5.55..7.78]`)!
  f3.obj("modular-suite/props/post_housing/ph_single_studio_kitchenette.png", 0.68, 6.72, 1.50, 0.75, FACE_SW, { z: 64 });
  f3.obj("modular-suite/props/post_housing/ph_bare_compact_counter.png", 2.75, 6.72, 1.40, 0.70, FACE_NE, { z: 64 });
  f3.obj("modular-suite/modular/crate_open_empty_pine.png", 1.78, 6.95, 0.66, 0.66, FACE_SW + 0.2, { z: 62 });

  // Warm newly wired pendants illuminating 3F!
  f3.obj("modular-suite/props/harmony_lighting/lgt_ceiling_victorian_amber_pendant.png", 5.35, 1.45, 0.48, 0.48, 0, { z: 76, shadow: false });
  f3.obj("modular-suite/props/harmony_lighting/lgt_ceiling_copper_kitchen_pendant.png", 1.78, 6.65, 0.48, 0.48, 0, { z: 76, shadow: false });
  f3.light("Flat 3A Fresh Parlor Warm Glow", 5.45, 1.45, 6.4, "#FFD280", 0.92);
  f3.light("Flat 3A West Bedroom Warm Glow", 8.00, 1.45, 4.8, "#FFC66D", 0.84);
  f3.light("Flat 3A North Corner Alcove Glow", 1.85, 0.95, 4.8, "#FFD280", 0.86);
  f3.light("Flat 3A East Dining & Kitchen Glow", 1.85, 5.85, 6.0, "#FFD280", 0.92);
  f3.light("Shared Stairwell 3F Landing Light", 1.30, 2.80, 4.2, "#FFD282", 0.84);

  f3.note(
    "NOTE",
    5.45,
    1.50,
    "3F · Flat 3A (Family Apartment — Finishing & Move-In Prep)",
    "Continuous top-floor 1-family flat behind a single front door off the shared stairwell, with 5 panoramic windows overlooking the Kid Theater courtyard. Newly laid honey-oak parquet under splattered painter's drop cloths, botanical wallpaper pasting trestle, A-frame stepladder, dust-sheet-draped sofa & armchairs, sunlit north unpacking alcove, and newly fitted kitchen cabinets—primed for the party to move right in!",
    "#3CA07E",
  );

  return { chevronPoly: CHEV_POLY };
}

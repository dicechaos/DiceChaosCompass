/**
 * Builds the cute, lived-in working-class / lower-middle-class neighborhood pocket park
 * ("Hinterhof-Kiezpark") tucked behind the NW V-shaped corner building (`dd-shape-floor-1-13`,
 * x ∈ [0.4..15.5], y ∈ [0.4..10.6]):
 *  - Winding crushed gravel footpath & pastel sidewalk chalk hopscotch court
 *  - Mossy stone neighborhood duck pond with lily pads, mallard ducks & sunning turtles
 *  - Homemade raised community vegetable garden beds (tomatoes, cabbages, pumpkins, watering can)
 *  - Kids' playground (scuffed timber swing set, painted seesaw & wooden sandbox with sandcastle)
 *  - Sheltered V-nook picnic blanket, retirees' concrete chess table, cast-iron hand-pump spigot,
 *    weathered green benches, Berlin Litfass community poster pillar, shady trees & warm gaslamps!
 */

import {
  DEFAULT_RECOLOR,
  type DmNotePin,
  type LightNode,
  type ObjectStamp,
  type Point2D,
  type RgbRecolor,
  type SplinePath,
  type TerrainStroke,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

function organicOval(cx: number, cy: number, rx: number, ry: number, segs = 24): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const wobble = 1.0 + 0.08 * Math.sin(a * 3 + 0.5) + 0.05 * Math.cos(a * 5 - 0.3);
    pts.push({
      x: Math.round((cx + Math.cos(a) * rx * wobble) * 1000) / 1000,
      y: Math.round((cy + Math.sin(a) * ry * wobble) * 1000) / 1000,
    });
  }
  return pts;
}

export function buildNeighborhoodPark(f1: IceCreamBuildBundle): void {
  let seq = 0;
  const uid = (p: string) => `pk-nw-${p}-${++seq}`;

  const floorPoly = (
    assetId: string,
    points: Point2D[],
    opts: { opacity?: number; softness?: number; recolor?: RgbRecolor } = {},
  ) => {
    f1.terrain.push({
      id: uid("flr"),
      assetId,
      shape: "polygon",
      points,
      radiusCells: 0,
      opacity: opts.opacity ?? 1,
      softness: opts.softness ?? 0.08,
      recolor: opts.recolor,
    });
  };

  const path = (
    assetId: string,
    pts: Array<[number, number]>,
    widthCells: number,
    opts: { curved?: boolean; opacity?: number; fadeEnds?: boolean } = {},
  ) => {
    f1.paths.push({
      id: uid("pth"),
      assetId,
      points: pts.map(([x, y]) => ({ x, y })),
      widthCells,
      curved: opts.curved ?? true,
      taperEnds: false,
      fadeEnds: opts.fadeEnds ?? true,
      opacity: opts.opacity ?? 0.96,
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
    f1.objects.push({
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
    intensity = 0.88,
    flicker = true,
  ) => {
    f1.lights.push({
      id: uid("lgt"),
      name,
      x,
      y,
      radiusCells,
      intensity,
      colorHex,
      castShadows: true,
      coneAngleDeg: 360,
      directionRad: 0,
      flicker,
    });
  };

  // =========================================================================
  // 1. LUSH POCKET LAWN SOFTENING, CRUSHED GRAVEL FOOTPATHS & COZY DUCK POND
  // =========================================================================
  // Soft wildflower-dotted meadow grass blend right into the sheltered V-pocket!
  floorPoly("core-fantasy/terrain/wildflower_meadow.png", organicOval(8.45, 8.78, 2.25, 1.75, 22), {
    opacity: 0.76,
    softness: 0.24,
  });
  floorPoly("modular-suite/terrain/terrain_trimmed_park_lawn.png", organicOval(7.6, 4.4, 4.8, 3.2, 24), {
    opacity: 0.55,
    softness: 0.28,
  });

  // Winding neighborhood crushed-gravel footpath linking the East alley entry, duck pond, playground,
  // community vegetable beds, and sheltered V-nook!
  path(
    "modular-suite/paths/path_garden_gravel.png",
    [
      [15.65, 4.76],
      [14.55, 4.78],
      [13.2, 4.82],
      [10.8, 5.22],
      [8.3, 5.88],
      [6.1, 4.82],
      [4.15, 2.55],
      [2.55, 1.92],
      [1.05, 1.92],
    ],
    1.16,
    { curved: true, fadeEnds: true },
  );
  // Southern gravel spur into the sheltered V-nook picnic & water-pump alcove
  path(
    "modular-suite/paths/path_garden_gravel.png",
    [
      [8.3, 5.88],
      [8.45, 7.2],
      [9.4, 7.7],
    ],
    1.05,
    { curved: true, fadeEnds: true },
  );

  // Cozy Mossy Stone Neighborhood Duck Pond (center-north: x = 7.75, y = 2.65)!
  // Muddy mossy pebble bank + shimmering pond water!
  floorPoly("modular-suite/terrain/terrain_pebbled_loam_gravel.png", organicOval(7.75, 2.65, 2.28, 1.58, 28), {
    opacity: 0.9,
    softness: 0.14,
  });
  floorPoly("core-fantasy/terrain/deep_pond_water.png", organicOval(7.75, 2.65, 1.98, 1.32, 28), {
    opacity: 0.96,
    softness: 0.08,
  });

  // Pond wildlife, lily pads, mossy rocks & reeds!
  obj("modular-suite/props/water_flora_banks/wat_lily_lotus_pink.png", 6.65, 2.35, 1.15, 1.05, 0.35, { z: 46, shadow: false });
  obj("modular-suite/props/water_flora_banks/wat_lily_pad_bed.png", 8.85, 2.95, 1.05, 0.95, -0.5, { z: 46, shadow: false });
  obj("modular-suite/props/water_flora_banks/wat_duckweed_mat.png", 7.35, 1.78, 1.0, 0.72, 0.2, { z: 45, shadow: false, opacity: 0.8 });
  obj("modular-suite/props/water_wildlife_submerged/wat_mallard_ducks.png", 7.85, 2.55, 1.15, 1.05, 0.4, { z: 54, shadow: false });
  obj("modular-suite/props/water_wildlife_submerged/wat_turtles_on_log.png", 8.85, 2.05, 1.1, 0.85, -0.35, { z: 52, shadow: false });
  obj("modular-suite/props/water_flora_banks/wat_wet_cobble_cluster.png", 5.85, 2.85, 0.95, 0.78, 0.25, { z: 50 });
  obj("modular-suite/props/water_flora_banks/wat_shore_granite_wet.png", 9.65, 2.45, 0.92, 0.82, -0.4, { z: 50 });
  obj("modular-suite/props/water_flora_banks/wat_cattail_tuft_top.png", 6.25, 1.65, 0.88, 0.88, 0.1, { z: 58 });
  obj("modular-suite/props/water_flora_banks/wat_marsh_marigold.png", 9.2, 3.65, 0.82, 0.82, 0.5, { z: 56 });
  obj("modular-suite/props/water_flora_banks/wat_stepping_stone_trio.png", 7.65, 4.15, 0.75, 0.97, Math.PI / 2 + 0.1, { z: 44, shadow: false });

  // =========================================================================
  // 2. WORKING-CLASS COMMUNITY VEGETABLE GARDEN (NW SUNNY CORNER)
  // =========================================================================
  obj("modular-suite/props/neighborhood_park/pk_community_garden_bed.png", 2.38, 1.02, 2.08, 1.24, 0.03, { z: 58 });
  obj("modular-suite/props/neighborhood_park/pk_community_garden_bed.png", 2.45, 2.75, 2.08, 1.24, -0.04, { z: 58 });
  obj("modular-suite/props/sewers_alleys/sew_wooden_handbarrow.png", 4.05, 1.05, 1.05, 0.75, 0.42, { z: 60 });
  obj("modular-suite/modular/basket_herb_green.png", 3.72, 1.95, 0.62, 0.62, 0.2, { z: 60 });
  obj("modular-suite/props/kitchen/kit_grain_sack.png", 0.78, 1.92, 0.65, 0.65, -0.3, { z: 60 });

  // =========================================================================
  // 3. KIDS' NEIGHBORHOOD PLAYGROUND & CHALK HOPSCOTCH COURT (EAST LAWN)
  // =========================================================================
  obj("modular-suite/props/neighborhood_park/pk_wooden_swing_set.png", 12.55, 1.38, 2.55, 1.48, 0.08, { z: 66 });
  obj("modular-suite/props/neighborhood_park/pk_kids_sandbox.png", 13.55, 3.25, 1.78, 1.78, -0.06, { z: 58 });
  obj("modular-suite/props/neighborhood_park/pk_wooden_seesaw.png", 11.35, 3.55, 2.25, 0.82, -0.22, { z: 62 });
  // Adorable pastel sidewalk chalk hopscotch drawn right on the gravel park hub!
  obj("modular-suite/props/neighborhood_park/pk_chalk_hopscotch_court.png", 9.65, 5.5, 2.05, 0.92, -0.26, {
    z: 48,
    shadow: false,
  });

  // =========================================================================
  // 4. SHELTERED V-NOOK PICNIC, CHESS TABLE, BENCHES, PUMP & COMMUNITY LIFE
  // =========================================================================
  // Retirees' concrete chess table & stools mid-game!
  obj("modular-suite/props/neighborhood_park/pk_concrete_chess_table.png", 6.55, 7.15, 1.85, 1.28, 0.42, { z: 62 });
  // Cozy faded plaid picnic blanket & wicker basket on the V-nook grass!
  obj("modular-suite/props/neighborhood_park/pk_picnic_blanket_basket.png", 8.55, 9.02, 2.0, 1.75, -0.14, {
    z: 46,
    shadow: false,
  });
  // Cast-iron Berlin neighborhood hand-pump water spigot beside the V-nook path!
  obj("modular-suite/props/neighborhood_park/pk_iron_water_pump.png", 10.25, 7.62, 1.05, 1.05, -0.45, { z: 62 });

  // Three weathered green slatted neighborhood park benches!
  obj("modular-suite/props/neighborhood_park/pk_worn_park_bench.png", 5.2, 3.85, 1.52, 0.68, 0.68, { z: 62 });
  obj("modular-suite/props/neighborhood_park/pk_worn_park_bench.png", 8.3, 4.78, 1.52, 0.68, -0.12, { z: 62 });
  obj("modular-suite/props/neighborhood_park/pk_worn_park_bench.png", 11.35, 6.22, 1.52, 0.68, -0.76, { z: 62 });

  // Lived-in working-class neighborhood touches:
  // Sleeping orange tabby cat curled in the sunny grass beside the pond bench + forgotten newspaper + wooden park trash bin + Litfass poster pillar!
  obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 4.52, 3.62, 0.58, 0.58, 0.35, { z: 66 });
  obj("modular-suite/props/messy_apartment/apt_scattered_newspapers.png", 8.4, 4.72, 0.72, 0.62, 0.25, { z: 66, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_alley_trash_barrel.png", 12.15, 5.25, 0.72, 0.72, 0.2, { z: 62 });
  obj("modular-suite/props/city_streets/st_berlin_litfass_column.png", 14.18, 4.95, 1.04, 1.04, 0.3, { z: 72 });
  // Cheerful neighborhood paper bunting strung high between the north oak & apple orchard trees above the duck pond!
  obj("modular-suite/props/music_theater_tea/mus_festival_bunting.png", 7.72, 0.82, 3.15, 0.62, -0.02, {
    z: 88,
    shadow: false,
  });

  // =========================================================================
  // 5. SHADY TREES, WILDFLOWERS, BUSHES & WARM EVENING GASLAMPS
  // =========================================================================
  // Wildflowers, ferns & blossoming shrubs tucked warmly along the park corners & V-walls!
  obj("modular-suite/props/flora/flora_yellow_wildflowers.png", 0.75, 0.95, 0.92, 0.92, 0.2, { z: 54, shadow: false });
  obj("modular-suite/props/flora/flora_lavender_clump.png", 3.68, 0.72, 0.88, 0.88, -0.4, { z: 54, shadow: false });
  obj("modular-suite/props/flora/bush_white_blossom.png", 5.15, 5.18, 1.08, 1.08, 0.3, { z: 64 });
  obj("modular-suite/props/flora/flora_woodland_fern.png", 5.7, 6.25, 0.88, 0.88, 0.5, { z: 54, shadow: false });
  obj("modular-suite/props/flora/flora_yellow_wildflowers.png", 7.52, 9.65, 0.92, 0.92, -0.2, { z: 54, shadow: false });
  obj("modular-suite/props/flora/flora_yellow_wildflowers.png", 9.05, 9.92, 0.82, 0.82, 0.65, { z: 54, shadow: false });
  obj("modular-suite/props/flora/bush_blueberry.png", 9.62, 9.48, 1.02, 1.02, 0.6, { z: 64 });
  obj("modular-suite/props/flora/flora_lavender_clump.png", 11.45, 7.2, 0.88, 0.88, 0.15, { z: 54, shadow: false });
  obj("modular-suite/props/flora/bush_round_green.png", 14.52, 2.12, 1.05, 1.05, -0.3, { z: 64 });
  obj("modular-suite/modular/dec_cherry_petals.png", 1.22, 3.78, 1.55, 1.35, 0.25, { z: 45, shadow: false, opacity: 0.85 });

  // 4 Shady Perimeter Trees framing the park cleanly inside both 1F walls and ROOF eaves!
  obj("modular-suite/props/trees_deciduous/tree_cherry_blossom.png", 0.88, 3.62, 1.82, 1.82, 0.4, { z: 86 });
  obj("modular-suite/props/trees_deciduous/tree_oak_broad.png", 5.15, 0.95, 2.75, 2.75, -0.3, { z: 86 });
  obj("modular-suite/props/trees_deciduous/tree_apple_orchard.png", 10.25, 0.88, 2.35, 2.35, 0.5, { z: 86 });
  obj("modular-suite/props/trees_deciduous/tree_birch_silver.png", 12.72, 5.72, 2.0, 2.0, -0.2, { z: 86 });

  // 4 Warm Working-Class Park Bollards & Gate Gaslamp casting inviting amber pools at dusk!
  obj("modular-suite/props/harmony_lighting/lgt_street_park_bollard_lamp.png", 5.85, 5.25, 0.78, 0.78, 0, { z: 78 });
  obj("modular-suite/props/harmony_lighting/lgt_street_park_bollard_lamp.png", 10.65, 4.85, 0.78, 0.78, 0, { z: 78 });
  obj("modular-suite/props/harmony_lighting/lgt_street_park_bollard_lamp.png", 8.5, 8.6, 0.74, 0.74, 0, { z: 78 });
  obj("modular-suite/props/harmony_lighting/lgt_street_berlin_single_gas.png", 13.85, 4.52, 0.84, 0.84, 0, { z: 78 });

  light("Kiezpark Pond & Chess Bollard", 5.85, 5.25, 6.8, "#FFBE6B", 0.95, true);
  light("Kiezpark Playground & Hopscotch Bollard", 10.65, 4.85, 6.8, "#FFC878", 0.95, true);
  light("Kiezpark V-Nook Picnic Bollard", 8.5, 8.6, 5.4, "#FFB35C", 0.82, true);
  light("Kiezpark East Gate Gaslamp", 13.85, 4.52, 5.8, "#FFBE6B", 0.86, true);

  const notePin: DmNotePin = {
    id: uid("note"),
    x: 7.75,
    y: 0.42,
    badge: "NOTE",
    title: "1F · Hinterhof-Kiezpark",
    body: "Beloved working-class neighborhood pocket park tucked behind the corner block: homemade community tomato/pumpkin garden beds, mossy duck pond, squeaky wooden swing set & sandbox, pastel chalk hopscotch, retirees' concrete chess table, plaid picnic blanket & cast-iron hand-pump.",
    colorHex: "#10B981",
  };
  f1.dmNotes.push(notePin);
}

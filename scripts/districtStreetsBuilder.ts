/**
 * Builds the district-wide Berlin dark-magipunk streetscape across the 48×54 map:
 *   1. Cathedral of the Sovereign Vigil Stairs ("Stairs of the Remembered"):
 *      Decades of cascading melted wax crusts, hundreds of vigil candles in every burn stage,
 *      colored memorial jars, wilted & fresh flowers, prayer slips, and warm flickering light.
 *   2. Roads, Tram Boulevard (Eisenbahnstraße), Souverän-Allee, Narrow Alleys & Streetlights:
 *      Vintage Prussian-blue magipunk streetcar, Berlin "H" tram stops, cobble crosswalks,
 *      mourners' candle & flower cart, manholes, storm drains, steam vents, cellar doors,
 *      postboxes, hydrants, bollards, puddles, autumn leaves, bicycles, alley bins & 20 lamps.
 *   3. District Yards & Courtyards:
 *      Solemn Cathedral perimeter grounds (4 pockets), lively Central Market Courtyard
 *      (behind the Ice Cream Express), and working-class SE Hinterhof backyards
 *      (clotheslines, coal & firewood shed, washtubs, veggie patch, yard tables & porch glow).
 */

import {
  DEFAULT_RECOLOR,
  type DmNotePin,
  type Point2D,
  type RgbRecolor,
} from "@/types/map";
import type { IceCreamBuildBundle } from "./iceCreamTrainBuilder";

const Q = Math.PI / 4; // 45°

export function buildDistrictStreetsAndVigilStairs(f1: IceCreamBuildBundle): void {
  let seq = 0;
  const uid = (p: string) => `dst-${p}-${++seq}`;

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
      opacity: opts.opacity ?? 0.94,
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
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
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
  // 1. CATHEDRAL VIGIL STAIRS — "STAIRS OF THE REMEMBERED"
  //    Forked stone grand stairs (x ∈ [13.2..19.2], y ∈ [33.8..39.7])
  //    Decades of layered melted wax, burning tapers, memorial jars & flowers!
  // =========================================================================

  // Layer A: Ancient dripped wax splatters, melted stubs & scattered petals right across the stone treads!
  // Leaves a narrow worn footpath down the middle while soaking the whole stairway in decades of wax!
  obj("modular-suite/props/district_streets/vigil_wax_puddle_stubs.png", 14.55, 38.45, 1.85, 1.55, Q, { z: 52, shadow: false });
  obj("modular-suite/props/district_streets/vigil_wax_puddle_stubs.png", 15.65, 37.35, 2.05, 1.72, -Q, { z: 52, shadow: false });
  obj("modular-suite/props/district_streets/vigil_wax_puddle_stubs.png", 15.32, 35.62, 1.95, 1.65, -Q + 0.15, { z: 52, shadow: false });
  obj("modular-suite/props/district_streets/vigil_wax_puddle_stubs.png", 17.32, 37.62, 1.95, 1.65, -Q - 0.18, { z: 52, shadow: false, flipX: true });
  // Street curb spillover wax drips right at the bottom of both stair wings
  obj("modular-suite/props/district_streets/vigil_wax_puddle_stubs.png", 16.52, 34.32, 1.32, 1.10, Q, { z: 51, shadow: false, opacity: 0.92 });
  obj("modular-suite/props/district_streets/vigil_wax_puddle_stubs.png", 18.45, 36.72, 1.32, 1.10, Q, { z: 51, shadow: false, flipX: true, opacity: 0.92 });

  // Layer B: Thick, decades-old cascading melted-wax & candle drifts hugging EVERY stair parapet & wall cheek!
  // NW outer parapet wall: (15.78, 33.86) -> (13.34, 36.30)
  obj("modular-suite/props/district_streets/vigil_candle_wax_drift.png", 14.84, 35.34, 2.68, 1.14, -Q, { z: 68 });
  // SE outer parapet wall: (19.14, 37.21) -> (16.68, 39.68)
  obj("modular-suite/props/district_streets/vigil_candle_wax_drift.png", 17.66, 38.18, 2.68, 1.14, -Q + Math.PI, { z: 68, flipX: true });
  // NW inner return wall: (13.34, 36.30) -> (14.30, 37.29)
  obj("modular-suite/props/district_streets/vigil_candle_wax_drift.png", 14.12, 36.52, 1.62, 0.84, Q, { z: 68 });
  // SE inner return wall: (16.68, 39.68) -> (15.72, 38.67)
  obj("modular-suite/props/district_streets/vigil_candle_wax_drift.png", 16.42, 38.88, 1.62, 0.84, Q + Math.PI, { z: 68, flipX: true });
  // Central divided stone cheeks: (17.0, 35.0)->(16.0, 36.0) & (18.0, 36.0)->(17.0, 37.0)
  obj("modular-suite/props/district_streets/vigil_candle_wax_drift.png", 16.22, 35.42, 1.62, 0.82, -Q, { z: 69 });
  obj("modular-suite/props/district_streets/vigil_candle_wax_drift.png", 17.58, 36.82, 1.62, 0.82, -Q + Math.PI, { z: 69, flipX: true });
  // Upper Cathedral doorway threshold flanks (leaving a clear worn center entrance!)
  obj("modular-suite/props/district_streets/vigil_candle_wax_drift.png", 13.92, 38.15, 1.38, 0.72, -Q, { z: 69 });
  obj("modular-suite/props/district_streets/vigil_candle_wax_drift.png", 14.88, 39.12, 1.38, 0.72, -Q + Math.PI, { z: 69 });

  // Layer C: Overflowing multi-year memorial shrine mounds in the central U-niche & both wing corners!
  obj("modular-suite/props/district_streets/vigil_candle_niche_shrine.png", 16.88, 36.12, 1.72, 1.62, -Q, { z: 73 });
  obj("modular-suite/props/district_streets/vigil_candle_niche_shrine.png", 14.34, 36.20, 1.18, 1.12, 0.35, { z: 72 });
  obj("modular-suite/props/district_streets/vigil_candle_niche_shrine.png", 16.76, 38.78, 1.18, 1.12, -0.45, { z: 72, flipX: true });

  // Layer D: Fresh & wilted floral tributes, modular vigil candle clusters & colored memorial glass jars!
  obj("modular-suite/props/funeral/fun_vigil_candles_roses.png", 16.08, 34.45, 0.98, 0.98, 0.2, { z: 74 });
  obj("modular-suite/props/funeral/fun_vigil_candles_roses.png", 18.45, 36.92, 0.98, 0.98, -0.35, { z: 74 });
  obj("modular-suite/props/funeral/fun_vigil_candles_roses.png", 14.42, 37.78, 0.82, 0.82, 0.5, { z: 74 });
  obj("modular-suite/props/district_streets/vigil_candle_cluster_lit.png", 15.15, 34.85, 0.62, 0.62, 0.3, { z: 75 });
  obj("modular-suite/props/district_streets/vigil_memorial_glass_jar_red.png", 16.45, 35.15, 0.36, 0.36, 0.1, { z: 75, shadow: false });
  obj("modular-suite/props/district_streets/vigil_memorial_glass_jar_amber.png", 17.85, 36.45, 0.36, 0.36, -0.2, { z: 75, shadow: false });
  obj("modular-suite/props/funeral/fun_white_lily_wreath.png", 17.42, 35.58, 0.82, 0.82, -0.25, { z: 75 });
  obj("modular-suite/props/funeral/fun_white_lily_wreath.png", 15.84, 34.52, 0.76, 0.76, 0.4, { z: 75 });
  obj("modular-suite/props/harmony_lighting/lgt_floor_votive_stand_brass.png", 14.38, 35.62, 0.84, 0.84, -Q, { z: 73 });
  obj("modular-suite/props/harmony_lighting/lgt_floor_votive_stand_brass.png", 17.18, 38.68, 0.84, 0.84, -Q, { z: 73 });

  // Layer E: Warm flickering amber-gold candlelight sea pouring down the stone stairs!
  light("Vigil Stairs Central Shrine Candlelight", 16.65, 36.35, 6.4, "#FFAA3B", 1.05, true);
  light("Vigil Stairs NW Wing Candlelight", 14.85, 35.55, 5.2, "#FFB84D", 0.92, true);
  light("Vigil Stairs SE Wing & Threshold Glow", 16.45, 38.45, 5.4, "#FF9E38", 0.94, true);

  const stairsNote: DmNotePin = {
    id: uid("note"),
    x: 18.6,
    y: 33.4,
    badge: "NOTE",
    title: "1F · Stairs of the Remembered",
    body: "For decades, citizens have left vigil candles, memorial glass jars, dried roses, and pebble-weighted notes across the Cathedral's forked stone stairs for lost loved ones. Thick yellowed wax crusts coat every parapet and the central U-niche shrine, still warm and freshly tended every dusk.",
    colorHex: "#F59E0B",
  };
  f1.dmNotes.push(stairsNote);

  // =========================================================================
  // 2. MAIN ROADS, TRAM BOULEVARD (EISENBAHNSTRASSE) & SOUVERÄN-ALLEE
  //    (Aged Streetcar #14, Haltestellen, Crosswalks, Semaphores, Manholes,
  //     Curb Storm Drains & Weathering Overlays are built in streetcarLineBuilder.ts!)
  // =========================================================================

  // Mourners' Wooden Candle & Flower Seller's Cart parked cleanly on the NE boulevard curb across from the Candle Stairs!
  obj("modular-suite/props/district_streets/str_flower_candle_cart.png", 20.42, 35.38, 2.35, 1.56, Q, { z: 68 });
  obj("modular-suite/props/district_streets/str_flower_bucket_roses.png", 19.65, 34.55, 0.52, 0.52, 0.25, { z: 66 });
  obj("modular-suite/props/market_tailor/mkt_sidewalk_chalkboard.png", 19.25, 33.85, 0.72, 0.72, Q + 0.15, { z: 64 });
  obj("modular-suite/props/tavern_clutter/tav_round_bar_stool.png", 21.55, 36.25, 0.56, 0.56, 0.2, { z: 64 });

  // Paired cast-iron bollards & draped curb chains framing the Cathedral Vigil Stairs + corner bollards (100% clear of rails!)
  obj("modular-suite/props/city_streets/st_iron_bollard_chain_pair.png", 15.55, 33.05, 1.68, 0.60, Q, { z: 66 });
  obj("modular-suite/props/city_streets/st_iron_bollard_chain_pair.png", 20.15, 37.55, 1.68, 0.60, Q, { z: 66 });
  for (const [bx, by] of [
    [11.95, 24.45], [25.35, 10.45],
  ] as Array<[number, number]>) {
    obj("modular-suite/props/sewers_alleys/sew_iron_bollard.png", bx, by, 0.44, 0.44, 0, { z: 66 });
  }

  // Prussian-blue Berlin postboxes & crimson cast-iron fire hydrants strictly on sidewalk curbs
  obj("modular-suite/props/district_streets/str_berlin_postbox.png", 11.45, 19.35, 0.76, 0.76, 0.25, { z: 66 });
  obj("modular-suite/props/district_streets/str_berlin_postbox.png", 22.65, 35.15, 0.76, 0.76, Q, { z: 66 });
  obj("modular-suite/props/district_streets/str_berlin_postbox.png", 29.85, 6.25, 0.76, 0.76, -Q, { z: 66 });

  obj("modular-suite/props/district_streets/str_iron_fire_hydrant.png", 4.15, 23.35, 0.62, 0.62, 0.2, { z: 65 });
  obj("modular-suite/props/district_streets/str_iron_fire_hydrant.png", 14.55, 32.05, 0.62, 0.62, Q, { z: 65 });
  obj("modular-suite/props/district_streets/str_iron_fire_hydrant.png", 28.35, 8.85, 0.62, 0.62, -Q, { z: 65 });
  obj("modular-suite/props/district_streets/str_iron_fire_hydrant.png", 34.65, 44.85, 0.62, 0.62, Q, { z: 65 });

  // Verdigris-domed Berlin Litfaßsäule poster columns & carved limestone shrub planters STRICTLY on wide sidewalks!
  obj("modular-suite/props/city_streets/st_berlin_litfass_column.png", 3.25, 25.25, 1.06, 1.06, 0.2, { z: 72 });
  obj("modular-suite/props/city_streets/st_berlin_litfass_column.png", 32.15, 48.45, 1.06, 1.06, -0.3, { z: 72 });
  obj("modular-suite/props/city_streets/st_stone_boulevard_planter.png", 16.95, 29.75, 1.10, 0.70, Q, { z: 62 });
  obj("modular-suite/props/city_streets/st_stone_boulevard_planter.png", 23.15, 42.15, 1.10, 0.70, Q, { z: 62 });
  obj("modular-suite/props/city_streets/st_stone_boulevard_planter.png", 30.35, 47.35, 1.10, 0.70, 0.56, { z: 62 });
  obj("modular-suite/props/city_streets/st_stone_boulevard_planter.png", 36.95, 51.35, 1.10, 0.70, 0.60, { z: 62 });

  // Curbside delivery handcarts, brass luggage trolley & sidewalk-parked commuter bicycles (ZERO mid-road clutter!)
  obj("core-fantasy/hero/hero_supply_handcart.png", 24.75, 37.95, 1.72, 1.12, Q + 0.04, { z: 65 });
  obj("modular-suite/props/city_streets/st_brass_porter_luggage_cart.png", 25.15, 3.75, 1.46, 0.90, -Q, { z: 65 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 17.95, 17.25, 1.16, 0.72, -Q + 0.1, { z: 64 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 30.15, 41.35, 1.16, 0.72, Q - 0.06, { z: 64 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 30.85, 11.55, 1.16, 0.72, 0.15, { z: 64 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 33.45, 49.15, 1.16, 0.72, 0.58, { z: 64 });

  // Stone-framed flush sidewalk cellar flap doors strictly on building sidewalk aprons (ZERO mid-road cellar hatches!)
  // Moved north to the bookshop service apron (1.98, 18.35) so Antiquariat Silberblatt's center awning & doorway are 100% unobstructed!
  obj("modular-suite/props/city_streets/st_sidewalk_cellar_hatch_flush.png", 1.98, 18.35, 0.94, 0.77, 0.32, { z: 48, shadow: false });
  obj("modular-suite/props/city_streets/st_sidewalk_cellar_hatch_flush.png", 26.15, 37.45, 1.10, 0.90, Q, { z: 48, shadow: false });
  obj("modular-suite/props/city_streets/st_sidewalk_cellar_hatch_flush.png", 37.25, 46.25, 1.10, 0.90, 0.62, { z: 48, shadow: false });
  obj("modular-suite/props/city_streets/st_sidewalk_cellar_hatch_flush.png", 19.65, 46.85, 1.10, 0.90, -Q, { z: 48, shadow: false });

  // Natural gutter puddles & oil slicks tucked strictly inside curb gutters (NEVER straddling walls or mid-road!)
  for (const [px, py, pw, ph, rot, asset] of [
    [5.35, 23.55, 1.32, 0.92, 0.25, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
    [23.35, 40.75, 1.32, 0.94, Q, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
    [32.25, 44.65, 1.34, 0.94, 0.58, "modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png"],
    [31.55, 45.95, 1.18, 0.84, 0.55, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
    [37.35, 49.85, 1.44, 0.98, 0.56, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
    [20.42, 50.52, 1.06, 0.74, -Q, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
  ] as Array<[number, number, number, number, number, string]>) {
    obj(asset, px, py, pw, ph, rot, { z: 46, shadow: false, opacity: 0.82 });
  }

  // =========================================================================
  // 3. NARROW ALLEYS (100% INSIDE PAVED ALLEY RIBBONS & CLEAR OF WALKWAYS!)
  // =========================================================================

  // Area 3 (Watchtower South Alley) & Area 4 (East Winding Canal Alley) — zero blocked throats, zero out-of-place bunting!
  obj("modular-suite/props/sewers_alleys/sew_storm_drain_grate.png", 33.45, 22.18, 0.66, 0.46, -0.05, { z: 45, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_storm_drain_grate.png", 43.85, 19.32, 0.66, 0.46, -0.24, { z: 45, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png", 31.85, 22.12, 1.04, 0.72, 0.08, { z: 46, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_mossy_puddle.png", 38.95, 21.08, 1.02, 0.72, -0.14, { z: 46, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png", 46.72, 24.45, 0.98, 0.70, 1.40, { z: 46, shadow: false });
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 30.45, 21.35, 1.02, 0.76, 0.0, { z: 62 });
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 45.35, 27.65, 1.08, 0.80, -0.62, { z: 62 });
  obj("modular-suite/props/city_streets/st_cast_iron_alley_steam_vent.png", 41.65, 20.22, 0.72, 0.72, -0.22, { z: 54, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 32.75, 22.18, 0.58, 0.58, 0.4, { z: 56, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_wooden_handbarrow.png", 46.55, 26.25, 0.96, 0.68, 2.05, { z: 62 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 45.85, 25.35, 1.08, 0.66, 1.65, { z: 64 });

  // Area 2: North Service Alley (ACTUAL paved alley curve y=13.5..14.7 + East Rear Service Lane y=11.1..12.9!)
  obj("modular-suite/props/sewers_alleys/sew_storm_drain_grate.png", 32.55, 14.75, 0.66, 0.46, -0.22, { z: 45, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_storm_drain_grate.png", 42.15, 12.15, 0.66, 0.46, -0.05, { z: 45, shadow: false });
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 37.65, 11.45, 1.10, 0.82, 0.0, { z: 62 });
  obj("modular-suite/props/sewers_alleys/sew_brick_pallet.png", 40.25, 12.55, 0.96, 0.70, 0.0, { z: 60 });
  obj("modular-suite/props/sewers_alleys/sew_coal_chute_hatch.png", 35.85, 11.42, 0.72, 0.58, 0, { z: 48, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_coal_chute_hatch.png", 42.55, 11.42, 0.72, 0.58, 0, { z: 48, shadow: false });
  obj("modular-suite/props/city_streets/st_cast_iron_alley_steam_vent.png", 30.45, 13.48, 0.72, 0.72, 0.76, { z: 54, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_mossy_puddle.png", 31.45, 14.65, 1.06, 0.74, -0.15, { z: 46, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_mossy_puddle.png", 45.35, 12.25, 1.12, 0.78, 0.12, { z: 46, shadow: false });
  obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 44.05, 11.55, 0.56, 0.56, -0.4, { z: 64 });

  // Area 1, Area 5 & Area 6 Sidewalk Curb Bins & Barrels (tucked neatly against curbs/walls, zero road blockages!)
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 2.65, 13.15, 1.08, 0.80, 1.04, { z: 62 });
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 16.65, 52.45, 1.08, 0.80, 0.0, { z: 62 });
  obj("modular-suite/props/sewers_alleys/sew_alley_trash_barrel.png", 23.75, 35.95, 0.72, 0.72, 0.2, { z: 62 });
  obj("modular-suite/props/sewers_alleys/sew_burlap_trash_sack.png", 38.15, 46.85, 0.68, 0.68, 0.3, { z: 60 });

  // =========================================================================
  // 4. DISTRICT-WIDE STREETLIGHT NETWORK (20 Sidewalk-Curb & Wall-Mounted Lamps!)
  // =========================================================================
  const lamps: Array<[string, string, number, number, number, string, number, boolean, number?]> = [
    // Tram Avenue (Eisenbahnstraße) — Grand Berlin Double-Globe & Single Gaslamps + Magipunk Aether Lamp (100% clear of steel rails!)
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Tram Ave SW Gaslamp", 3.55, 26.45, 7.2, "#FFBE6B", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Grand Crossroads NW Lamp", 9.45, 20.45, 8.2, "#FFD078", 0.95, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Grand Crossroads SE Lamp", 14.05, 27.65, 7.4, "#FFC470", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Tram Ave Mid-NW Lamp", 17.75, 12.25, 7.6, "#FFBE6B", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_aether_cyan_post.png", "Tram Ave Magipunk Aether Lamp", 22.45, 14.05, 6.6, "#5ED4F5", 0.74, false],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Tram Stop Haltestelle Lamp", 29.45, 6.35, 7.8, "#FFC675", 0.92, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_single_gas.png", "Tram Ave North Entry Lamp", 25.45, 2.25, 6.8, "#FFBE6B", 0.86, true],
    // West Avenue & Grand Boulevard (Souverän-Allee) — STRICTLY ON SIDEWALK CURBS (ZERO MID-ROAD LAMPS!)
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "NW Boulevard Entry Lamp", 2.65, 20.85, 7.4, "#FFBE6B", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Cathedral Crossing Flower-Cart Lamp", 18.65, 31.35, 7.8, "#FFC472", 0.94, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "SE Boulevard Mid Gaslamp", 28.75, 40.55, 7.8, "#FFBE6B", 0.92, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "SE Boulevard South Corner Lamp", 34.55, 49.65, 7.8, "#FFBE6B", 0.92, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_single_gas.png", "SE Boulevard Far Corner Lamp", 43.45, 50.45, 7.0, "#FFB85C", 0.88, true],
    // Narrow Alleys & Side Streets — Curbside Posts & Wall-Mounted Alley Lantern Brackets (ZERO lane obstructions!)
    ["modular-suite/props/harmony_lighting/lgt_street_gothic_iron_post.png", "SW Cathedral Side-Street Lamp", 19.55, 49.75, 6.5, "#FFA94D", 0.84, true],
    ["modular-suite/props/city_streets/st_alley_wall_lantern_bracket.png", "North Service Alley Wall Lantern", 35.55, 12.82, 6.2, "#FFB054", 0.86, true, Math.PI / 2],
    ["modular-suite/props/city_streets/st_alley_wall_lantern_bracket.png", "Watchtower South Alley Wall Lantern", 39.75, 19.92, 6.4, "#FFB85C", 0.86, true, Math.PI / 2 - 0.22],
    ["modular-suite/props/harmony_lighting/lgt_street_aether_cyan_post.png", "East Alley Aether Lamp", 44.75, 22.95, 6.2, "#5ED4F5", 0.76, false],
    // Courtyards, Hinterhof Yards & Cathedral Grounds — Sandstone Pillar Lanterns, Garden Lantern & Gothic Iron Post!
    ["modular-suite/props/harmony_lighting/lgt_street_courtyard_pillar_lantern.png", "Kid Theater NE Courtyard Lantern", 26.85, 19.55, 7.2, "#FFC878", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_courtyard_pillar_lantern.png", "SE Hinterhof North Yard Lantern", 36.15, 30.85, 6.8, "#FFBE6B", 0.88, true],
    ["modular-suite/props/harmony_lighting/lgt_street_garden_stone_lantern.png", "SE Hinterhof East Garden Lantern", 44.55, 38.05, 6.6, "#FFB85C", 0.86, true],
    ["modular-suite/props/harmony_lighting/lgt_street_gothic_iron_post.png", "Cathedral NW Grounds Lantern", 4.25, 33.85, 5.8, "#FFBA60", 0.84, true],
  ];
  for (const [asset, name, lx, ly, rad, col, inten, flk, lrot] of lamps) {
    const sz = asset.includes("wall_lantern") ? 0.72 : 0.88;
    obj(asset, lx, ly, sz, sz, lrot ?? 0, { z: 78 });
    light(name, lx, ly, rad, col, inten, flk);
  }

  // =========================================================================
  // 5. CATHEDRAL PERIMETER GROUNDS (4 SOLEMN SANCTUARY YARD POCKETS)
  // =========================================================================

  // Pocket 1: NW Cathedral Lawn (x ∈ [1.2..5.8], y ∈ [31.5..37.2])
  obj("modular-suite/props/trees_biomes/tree_cypress_spire.png", 3.25, 34.25, 1.85, 1.85, 0.3, { z: 85 });
  obj("modular-suite/props/trees_biomes/tree_cypress_spire.png", 5.35, 32.35, 1.55, 1.55, -0.4, { z: 85 });
  obj("modular-suite/props/funeral/fun_mossy_tombstone.png", 2.75, 35.55, 0.95, 0.78, -Q, { z: 62 });
  obj("modular-suite/props/funeral/fun_white_lily_wreath.png", 3.45, 36.15, 0.78, 0.78, 0.25, { z: 64 });
  obj("modular-suite/props/docks_streets/str_park_bench.png", 4.65, 34.85, 1.48, 0.68, -Q, { z: 62 });
  obj("modular-suite/props/flora/flora_woodland_fern.png", 1.85, 35.25, 0.92, 0.92, 0.2, { z: 54, shadow: false });
  obj("modular-suite/props/flora/flora_lavender_clump.png", 5.25, 33.25, 0.88, 0.88, -0.3, { z: 54, shadow: false });

  // Pocket 2: North Forecourt Lawn (just NW of the Candle Stairs, x ∈ [10.8..14.4], y ∈ [30.2..35.0])
  path("modular-suite/paths/path_cemetery_stones.png", [[12.1, 32.0], [13.9, 33.9]], 0.95, { curved: true, fadeEnds: true });
  obj("modular-suite/props/trees_biomes/tree_cypress_spire.png", 11.75, 30.85, 1.75, 1.75, 0.5, { z: 85 });
  obj("modular-suite/props/funeral/fun_weeping_angel.png", 12.55, 33.25, 1.32, 1.32, Q, { z: 72 });
  obj("modular-suite/props/funeral/fun_vigil_candles_roses.png", 13.25, 33.85, 0.88, 0.88, 0.15, { z: 74 });
  obj("modular-suite/props/docks_streets/str_park_bench.png", 12.35, 34.35, 1.38, 0.64, Q, { z: 62 });
  obj("modular-suite/props/flora/flora_lavender_clump.png", 13.45, 32.25, 0.85, 0.85, 0.4, { z: 54, shadow: false });

  // Pocket 3: East Forecourt Apron (just SE of the Candle Stairs, x ∈ [17.4..23.2], y ∈ [38.2..44.2])
  obj("modular-suite/props/trees_biomes/tree_cypress_spire.png", 21.45, 41.25, 1.85, 1.85, -0.25, { z: 85 });
  obj("modular-suite/props/harmony_lighting/lgt_street_gothic_iron_post.png", 19.85, 40.35, 0.84, 0.84, 0, { z: 74 });
  obj("modular-suite/props/docks_streets/str_park_bench.png", 18.65, 39.85, 1.42, 0.66, Q, { z: 62 });
  obj("modular-suite/props/funeral/fun_vigil_candles_roses.png", 18.25, 38.65, 0.90, 0.90, -0.2, { z: 74 });
  obj("modular-suite/props/flora/flora_lavender_clump.png", 22.45, 42.95, 0.88, 0.88, 0.3, { z: 54, shadow: false });

  // Pocket 4: Quiet SE Sanctuary Pocket Garden (x ∈ [13.6..20.5], y ∈ [46.2..52.2])
  obj("modular-suite/props/trees_deciduous/tree_weeping_willow.png", 17.65, 49.35, 2.25, 2.25, 0.4, { z: 85 });
  obj("modular-suite/props/water_bridges_structures/wat_lakeside_wishing_well.png", 15.25, 49.55, 1.42, 1.42, 0.2, { z: 66 });
  obj("modular-suite/props/flora/bush_white_blossom.png", 14.35, 51.25, 1.05, 1.05, -0.3, { z: 64 });
  obj("modular-suite/props/flora/flora_yellow_wildflowers.png", 16.45, 50.85, 0.92, 0.92, 0.2, { z: 54, shadow: false });
  obj("modular-suite/props/flora/flora_lavender_clump.png", 16.15, 48.25, 0.88, 0.88, -0.2, { z: 54, shadow: false });

  // =========================================================================
  // 6. CENTRAL COURTYARD (UPGRADED TO OUTDOOR COMMUNITY KID THEATER IN kidTheaterBuilder.ts!)
  //    x ∈ [22.2..29.2], y ∈ [19.2..25.6]
  // =========================================================================

  // =========================================================================
  // 7. SE WORKING-CLASS HINTERHOF BACKYARDS (100% CLEAR OF 1F WALLS & ROOF EAVES!)
  // =========================================================================

  // Winding backyard gravel & stepping walk linking the sunlit Hinterhof meadows
  path("modular-suite/paths/path_garden_gravel.png", [
    [34.5, 30.2], [36.8, 31.8], [38.8, 34.4], [41.5, 37.8],
  ], 0.90, { curved: true, fadeEnds: true });

  // Backyard A (North-Central Open Sunlit Clearing, x ∈ [34.2..42.4], y ∈ [27.8..32.6])
  obj("modular-suite/props/district_streets/str_backyard_coal_shed.png", 34.85, 28.75, 2.25, 1.62, 0.0, { z: 68 });
  obj("modular-suite/props/district_streets/str_split_firewood_rack.png", 36.65, 28.45, 1.08, 0.62, 0.05, { z: 64 });
  obj("modular-suite/props/district_streets/str_backyard_clothesline.png", 40.15, 28.95, 2.85, 1.18, 0.08, { z: 80, shadow: false });
  obj("modular-suite/props/kitchen/kit_soapy_washtub.png", 38.85, 29.85, 0.82, 0.82, 0.25, { z: 62 });
  obj("modular-suite/props/bedroom_home/home_laundry_basket.png", 39.75, 30.25, 0.68, 0.68, -0.3, { z: 62 });
  obj("modular-suite/props/sewers_alleys/sew_alley_trash_barrel.png", 32.85, 28.65, 0.72, 0.72, 0.1, { z: 62 });
  obj("modular-suite/props/flora/flora_yellow_wildflowers.png", 34.85, 30.45, 0.86, 0.86, 0.3, { z: 54, shadow: false });
  obj("modular-suite/props/flora/bush_blueberry.png", 41.45, 28.45, 0.96, 0.96, -0.2, { z: 64 });

  // Backyard B (Central SE Vegetable Patch & Neighbors' Card Table Pocket, x ∈ [36.0..41.2], y ∈ [31.6..38.4])
  obj("modular-suite/props/bare_furniture/bare_pine_worktable.png", 38.65, 31.75, 1.32, 0.86, 0.12, { z: 62 });
  obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 37.75, 31.65, 0.66, 0.66, 1.6, { z: 60 });
  obj("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 39.55, 31.85, 0.66, 0.66, -1.4, { z: 60 });
  obj("modular-suite/props/tavern_clutter/tav_playing_cards.png", 38.65, 31.75, 0.48, 0.48, 0.3, { z: 66, shadow: false });
  obj("modular-suite/props/neighborhood_park/pk_community_garden_bed.png", 37.85, 34.25, 2.02, 1.20, -0.22, { z: 58 });
  obj("modular-suite/props/farm_stable/frm_wheelbarrow.png", 36.45, 32.85, 1.08, 0.76, 0.45, { z: 62 });
  obj("modular-suite/props/farm_stable/frm_watering_can.png", 38.95, 33.45, 0.56, 0.56, -0.3, { z: 62 });
  obj("modular-suite/props/farm_stable/frm_orange_pumpkin.png", 39.05, 35.15, 0.58, 0.58, 0.2, { z: 60 });
  obj("modular-suite/props/flora/flora_yellow_wildflowers.png", 36.85, 35.35, 0.86, 0.86, -0.2, { z: 54, shadow: false });
  obj("modular-suite/props/flora/flora_lavender_clump.png", 39.65, 36.85, 0.85, 0.85, 0.4, { z: 54, shadow: false });

  // Backyard C (East Sunlit Hinterhof Garden Wedge, x ∈ [42.6..47.4], y ∈ [36.0..41.8])
  obj("modular-suite/props/district_streets/str_backyard_clothesline.png", 45.25, 38.65, 2.85, 1.18, -0.35, { z: 80, shadow: false });
  obj("modular-suite/props/camp_travel/cmp_firewood_log_stack.png", 44.15, 37.15, 1.22, 0.82, -0.3, { z: 62 });
  obj("modular-suite/props/camp_travel/cmp_chopping_stump_axe.png", 45.45, 36.95, 0.85, 0.85, 0.4, { z: 62 });
  obj("modular-suite/props/neighborhood_park/pk_iron_water_pump.png", 43.25, 38.35, 0.98, 0.98, 0.35, { z: 62 });
  obj("modular-suite/props/neighborhood_park/pk_worn_park_bench.png", 46.05, 40.35, 1.42, 0.65, -0.55, { z: 62 });
  obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 44.85, 39.85, 0.56, 0.56, 0.25, { z: 64 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 43.85, 39.55, 1.12, 0.70, 0.65, { z: 64 });
  obj("modular-suite/props/flora/bush_blueberry.png", 46.25, 41.25, 0.98, 0.98, 0.3, { z: 64 });
  obj("modular-suite/props/flora/flora_yellow_wildflowers.png", 44.05, 36.35, 0.85, 0.85, -0.3, { z: 54, shadow: false });

  // District Courtyard & Yard DM Note
  const yardNote: DmNotePin = {
    id: uid("note"),
    x: 38.6,
    y: 28.0,
    badge: "NOTE",
    title: "1F · SE Hinterhof Yards",
    body: "Working-class rear courtyards linked by narrow cobblestone alleys: hanging laundry lines, corrugated-tin coal & firewood shed, soapy washtubs, kitchen vegetable patch, chained bicycles, and neighbors' backyard card table.",
    colorHex: "#38BDF8",
  };
  f1.dmNotes.push(yardNote);
}

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

  // Mourners' Wooden Candle & Flower Seller's Cart parked cleanly on the open boulevard curb across from the Candle Stairs!
  obj("modular-suite/props/district_streets/str_flower_candle_cart.png", 19.95, 34.45, 2.35, 1.56, Q, { z: 68 });
  obj("modular-suite/props/district_streets/str_flower_bucket_roses.png", 19.25, 33.75, 0.52, 0.52, 0.25, { z: 66 });
  obj("modular-suite/props/market_tailor/mkt_sidewalk_chalkboard.png", 18.75, 33.15, 0.72, 0.72, Q + 0.15, { z: 64 });
  obj("modular-suite/props/tavern_clutter/tav_round_bar_stool.png", 21.05, 35.35, 0.56, 0.56, 0.2, { z: 64 });

  // Protective cast-iron curb bollards guarding the Cathedral Vigil Stairs & curb corners (100% clear of rails!)
  for (const [bx, by] of [
    [15.25, 32.85], [16.35, 33.75], [19.55, 36.85], [20.55, 37.85],
    [11.95, 24.45], [25.35, 10.45],
  ] as Array<[number, number]>) {
    obj("modular-suite/props/sewers_alleys/sew_iron_bollard.png", bx, by, 0.44, 0.44, 0, { z: 66 });
  }

  // Prussian-blue Berlin postboxes & crimson cast-iron fire hydrants cleanly along open sidewalk curbs
  obj("modular-suite/props/district_streets/str_berlin_postbox.png", 11.45, 19.35, 0.76, 0.76, 0.25, { z: 66 });
  obj("modular-suite/props/district_streets/str_berlin_postbox.png", 21.75, 36.45, 0.76, 0.76, Q, { z: 66 });
  obj("modular-suite/props/district_streets/str_berlin_postbox.png", 29.85, 6.25, 0.76, 0.76, -Q, { z: 66 });

  obj("modular-suite/props/district_streets/str_iron_fire_hydrant.png", 5.35, 21.85, 0.62, 0.62, 0.2, { z: 65 });
  obj("modular-suite/props/district_streets/str_iron_fire_hydrant.png", 15.15, 31.65, 0.62, 0.62, Q, { z: 65 });
  obj("modular-suite/props/district_streets/str_iron_fire_hydrant.png", 27.05, 9.25, 0.62, 0.62, -Q, { z: 65 });
  obj("modular-suite/props/district_streets/str_iron_fire_hydrant.png", 33.05, 45.25, 0.62, 0.62, Q, { z: 65 });

  // Berlin Litfass community poster kiosks & sidewalk flower planters (100% clear of BOTH 1F walls & ROOF eaves!)
  obj("objects/berlin_litfass_kiosk.png", 3.95, 25.35, 1.05, 1.05, 0.2, { z: 72 });
  obj("objects/berlin_litfass_kiosk.png", 33.25, 48.35, 1.05, 1.05, -0.3, { z: 72 });
  obj("objects/city_planter_box.png", 16.45, 30.85, 1.02, 0.68, Q, { z: 62 });
  obj("objects/city_planter_box.png", 23.05, 37.55, 1.02, 0.68, Q, { z: 62 });
  obj("objects/city_planter_box.png", 29.25, 43.95, 1.02, 0.68, Q, { z: 62 });
  obj("objects/city_planter_box.png", 36.15, 50.65, 1.02, 0.68, Q, { z: 62 });

  // Curbside delivery handcarts & parked commuter bicycles (100% on open streets/curbs!)
  obj("core-fantasy/hero/hero_supply_handcart.png", 24.15, 38.85, 1.72, 1.12, Q + 0.08, { z: 65 });
  obj("objects/luggage_hand_cart.png", 25.15, 3.75, 1.35, 0.92, -Q, { z: 65 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 17.95, 17.25, 1.16, 0.72, -Q + 0.1, { z: 64 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 25.65, 40.35, 1.16, 0.72, Q - 0.12, { z: 64 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 30.85, 11.55, 1.16, 0.72, 0.15, { z: 64 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 33.55, 46.85, 1.16, 0.72, Q + 0.08, { z: 64 });

  // Sidewalk cellar storm doors cleanly on exposed sidewalk aprons (zero wall/roof collisions!)
  obj("modular-suite/props/district_streets/str_cellar_storm_doors.png", 3.35, 16.05, 1.05, 0.92, 0.56, { z: 48, shadow: false });
  obj("modular-suite/props/district_streets/str_cellar_storm_doors.png", 26.85, 41.35, 1.12, 0.98, Q, { z: 48, shadow: false });
  obj("modular-suite/props/district_streets/str_cellar_storm_doors.png", 35.05, 48.25, 1.12, 0.98, Q, { z: 48, shadow: false });
  obj("modular-suite/props/district_streets/str_cellar_storm_doors.png", 20.65, 48.25, 1.12, 0.98, -Q, { z: 48, shadow: false });

  // Natural gutter puddles & oil slicks along outer boulevards (transparent autumn leaf drifts live in streetcarLineBuilder.ts!)
  for (const [px, py, pw, ph, rot, asset] of [
    [5.35, 22.85, 1.48, 1.05, 0.3, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
    [16.8, 30.8, 1.45, 1.05, -0.4, "modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png"],
    [23.5, 38.2, 1.50, 1.05, 0.5, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
    [31.0, 45.8, 1.45, 1.02, -0.2, "modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png"],
    [37.8, 51.4, 1.65, 1.12, 0.4, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
    [20.6, 50.4, 1.48, 1.02, 0.2, "modular-suite/props/sewers_alleys/sew_mossy_puddle.png"],
  ] as Array<[number, number, number, number, number, string]>) {
    obj(asset, px, py, pw, ph, rot, { z: 46, shadow: false, opacity: 0.82 });
  }

  // =========================================================================
  // 3. NARROW ALLEYS (DEAD-CENTERED ALONG EXACT ALLEY RIBBONS!)
  // =========================================================================

  // East Winding Narrow Alley (between dd-wall-1-12 north & dd-wall-1-10 south + East stub dd-wall-1-11)
  obj("modular-suite/props/sewers_alleys/sew_storm_drain_grate.png", 33.45, 21.85, 0.66, 0.46, -0.15, { z: 45, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_storm_drain_grate.png", 43.85, 19.75, 0.66, 0.46, -0.25, { z: 45, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png", 31.65, 21.85, 1.12, 0.78, 0.15, { z: 46, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_mossy_puddle.png", 39.45, 20.55, 1.12, 0.78, -0.25, { z: 46, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_oil_slick_puddle.png", 46.35, 24.35, 1.18, 0.84, 0.35, { z: 46, shadow: false });
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 36.15, 21.35, 1.05, 0.78, -0.25, { z: 62 });
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 45.75, 26.75, 1.18, 0.88, 1.45, { z: 62 });
  obj("objects/alley_steam_vent.png", 41.35, 20.25, 0.78, 0.78, -0.2, { z: 54 });
  obj("modular-suite/props/sewers_alleys/sew_scattered_bottles.png", 32.85, 21.75, 0.62, 0.62, 0.4, { z: 56, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_wooden_handbarrow.png", 45.95, 21.95, 0.96, 0.68, 1.5, { z: 62 });
  obj("modular-suite/props/district_streets/str_vintage_bicycle.png", 46.35, 25.45, 1.08, 0.66, 1.45, { z: 64 });
  // Overhead alley laundry banner lines bridging cleanly across the narrow East alley!
  path("paths/laundry_banner_line.png", [[38.1, 20.2], [39.5, 21.2]], 0.24, { curved: false, fadeEnds: false });
  path("paths/laundry_banner_line.png", [[42.8, 19.2], [44.2, 20.4]], 0.24, { curved: false, fadeEnds: false });

  // North Service Alley (centered cleanly at y ≈ 11.9–12.1 between Tenement y=11.0 & dd-wall-1-13 y=13.0)
  obj("modular-suite/props/sewers_alleys/sew_storm_drain_grate.png", 33.45, 12.05, 0.66, 0.46, 0.08, { z: 45, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_storm_drain_grate.png", 42.15, 12.05, 0.66, 0.46, -0.08, { z: 45, shadow: false });
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 37.35, 12.05, 1.18, 0.88, 0.05, { z: 62 });
  obj("modular-suite/props/sewers_alleys/sew_brick_pallet.png", 40.25, 12.15, 1.02, 0.74, -0.05, { z: 60 });
  obj("modular-suite/props/sewers_alleys/sew_coal_chute_hatch.png", 35.85, 11.42, 0.72, 0.58, 0, { z: 48, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_coal_chute_hatch.png", 42.55, 11.42, 0.72, 0.58, 0, { z: 48, shadow: false });
  obj("objects/alley_steam_vent.png", 32.85, 12.15, 0.82, 0.82, 0.25, { z: 54 });
  obj("modular-suite/props/sewers_alleys/sew_mossy_puddle.png", 31.35, 11.95, 1.12, 0.78, -0.15, { z: 46, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_mossy_puddle.png", 45.35, 11.95, 1.18, 0.84, 0.2, { z: 46, shadow: false });
  obj("modular-suite/props/bedroom_home/home_sleeping_tabby_cat.png", 44.05, 11.55, 0.56, 0.56, -0.4, { z: 64 });

  // NW & SW Side-Alley Clutter + SE Sidewalk Curb Barrels (cleanly outside building walls!)
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 2.35, 13.15, 1.18, 0.88, 0.55, { z: 62 });
  obj("modular-suite/props/district_streets/str_alley_bin_cluster.png", 17.25, 52.35, 1.18, 0.88, -0.65, { z: 62 });
  obj("modular-suite/props/sewers_alleys/sew_alley_trash_barrel.png", 23.65, 38.15, 0.72, 0.72, 0.2, { z: 62 });
  obj("modular-suite/props/sewers_alleys/sew_mossy_puddle.png", 31.55, 46.45, 1.12, 0.78, -0.4, { z: 46, shadow: false });
  obj("modular-suite/props/sewers_alleys/sew_burlap_trash_sack.png", 38.65, 46.85, 0.68, 0.68, 0.3, { z: 60 });

  // =========================================================================
  // 4. DISTRICT-WIDE STREETLIGHT NETWORK (20 Location-Matched Street, Alley, Courtyard & Precinct Lamps!)
  // =========================================================================
  const lamps: Array<[string, string, number, number, number, string, number, boolean]> = [
    // Tram Avenue (Eisenbahnstraße) — Grand Berlin Double-Globe & Single Gaslamps + Magipunk Aether Lamp (100% clear of steel rails!)
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Tram Ave SW Gaslamp", 3.55, 26.45, 7.2, "#FFBE6B", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Grand Crossroads NW Lamp", 9.45, 20.45, 8.2, "#FFD078", 0.95, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Grand Crossroads SE Lamp", 13.25, 28.15, 7.4, "#FFC470", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Tram Ave Mid-NW Lamp", 17.75, 12.25, 7.6, "#FFBE6B", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_aether_cyan_post.png", "Tram Ave Magipunk Aether Lamp", 22.45, 14.05, 6.6, "#5ED4F5", 0.74, false],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Tram Stop Haltestelle Lamp", 29.45, 6.35, 7.8, "#FFC675", 0.92, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_single_gas.png", "Tram Ave North Entry Lamp", 25.45, 2.25, 6.8, "#FFBE6B", 0.86, true],
    // Grand Boulevard (Souverän-Allee)
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "NW Boulevard Entry Lamp", 3.45, 15.65, 7.0, "#FFBE6B", 0.88, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "Cathedral Crossing Flower-Cart Lamp", 18.45, 32.15, 7.6, "#FFC472", 0.94, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "SE Boulevard Mid Gaslamp", 27.45, 40.65, 7.6, "#FFBE6B", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_double_globe.png", "SE Boulevard South Corner Lamp", 34.45, 47.65, 7.6, "#FFBE6B", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_single_gas.png", "SE Boulevard Far Corner Lamp", 41.85, 52.85, 6.8, "#FFB85C", 0.86, true],
    // Narrow Alleys & Side Streets — Classic Single Gaslamps & Aether Post
    ["modular-suite/props/harmony_lighting/lgt_street_gothic_iron_post.png", "SW Cathedral Side-Street Lamp", 18.45, 49.45, 6.5, "#FFA94D", 0.84, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_single_gas.png", "North Service Alley Gaslamp", 36.55, 12.05, 5.8, "#FFB054", 0.82, true],
    ["modular-suite/props/harmony_lighting/lgt_street_berlin_single_gas.png", "East Winding Alley Gaslamp", 39.85, 20.55, 6.0, "#FFB85C", 0.84, true],
    ["modular-suite/props/harmony_lighting/lgt_street_aether_cyan_post.png", "East Alley Aether Lamp", 45.85, 22.85, 5.8, "#5ED4F5", 0.72, false],
    // Courtyards, Hinterhof Yards & Cathedral Grounds — Sandstone Pillar Lanterns, Garden Lantern & Gothic Iron Post!
    ["modular-suite/props/harmony_lighting/lgt_street_courtyard_pillar_lantern.png", "Kid Theater NE Courtyard Lantern", 26.85, 19.55, 7.2, "#FFC878", 0.90, true],
    ["modular-suite/props/harmony_lighting/lgt_street_courtyard_pillar_lantern.png", "SE Hinterhof North Yard Lantern", 36.15, 30.85, 6.8, "#FFBE6B", 0.88, true],
    ["modular-suite/props/harmony_lighting/lgt_street_garden_stone_lantern.png", "SE Hinterhof East Garden Lantern", 44.55, 38.05, 6.6, "#FFB85C", 0.86, true],
    ["modular-suite/props/harmony_lighting/lgt_street_gothic_iron_post.png", "Cathedral NW Grounds Lantern", 4.25, 33.85, 5.8, "#FFBA60", 0.84, true],
  ];
  for (const [asset, name, lx, ly, rad, col, inten, flk] of lamps) {
    obj(asset, lx, ly, 0.88, 0.88, 0, { z: 78 });
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

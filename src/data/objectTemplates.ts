import {
  DEFAULT_RECOLOR,
  type ObjectStamp,
  type ObjectTemplate,
  type ObjectTemplateCategory,
  type ObjectTemplateItem,
} from "@/types/map";

const item = (
  assetId: string,
  dx: number,
  dy: number,
  w: number,
  h: number,
  opts?: {
    rot?: number;
    z?: number;
    shadow?: boolean;
    opacity?: number;
    tintHex?: string;
    flipX?: boolean;
    flipY?: boolean;
  },
): ObjectTemplateItem => ({
  assetId,
  dx,
  dy,
  widthCells: w,
  heightCells: h,
  rotationRad: opts?.rot ?? 0,
  flipX: opts?.flipX ?? false,
  flipY: opts?.flipY ?? false,
  opacity: opts?.opacity ?? 1,
  castsShadow: opts?.shadow ?? true,
  zOrder: opts?.z ?? 14,
  recolor: opts?.tintHex
    ? { ...DEFAULT_RECOLOR, enabled: true, mode: "auto", tintHex: opts.tintHex, strength: 0.95 }
    : { ...DEFAULT_RECOLOR },
});

const BUILTIN_TIMESTAMP = "2026-01-01T00:00:00.000Z";

/**
 * Curated built-in premade groups of objects (prefabs) ready to drop onto any map
 * in a single click — with live multi-prop ghost preview, rotation, and scaling.
 */
export const BUILTIN_OBJECT_TEMPLATES: ObjectTemplate[] = [
  {
    id: "tpl-stealth-camp",
    name: "Stealth Forest Camp",
    category: "camp_wilds",
    description: "Lit campfire, iron pot, firewood, chopping stump, 3 bedrolls, backpacks & stools.",
    accentHex: "#F59E0B",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("core-fantasy/hero/hero_campfire_lit.png", 0, 0, 1.45, 1.45, { z: 15 }),
      item("modular-suite/props/camp_travel/cmp_iron_camp_pot.png", 0.8, -0.45, 0.72, 0.72, { z: 15 }),
      item("modular-suite/props/camp_travel/cmp_firewood_log_stack.png", -1.45, -1.15, 1.25, 0.95, { rot: 0.2, z: 14 }),
      item("modular-suite/props/camp_travel/cmp_chopping_stump_axe.png", -1.9, -0.15, 1.0, 1.0, { z: 14 }),
      item("modular-suite/props/camp_travel/cmp_tied_bedroll.png", -1.45, 1.1, 1.35, 0.82, { rot: 0.55, z: 14 }),
      item("modular-suite/props/camp_travel/cmp_tied_bedroll.png", -0.1, 1.85, 1.35, 0.82, { rot: -0.1, z: 14 }),
      item("modular-suite/props/camp_travel/cmp_tied_bedroll.png", 1.35, 1.3, 1.35, 0.82, { rot: -0.75, z: 14 }),
      item("modular-suite/props/camp_travel/cmp_canvas_stool.png", -0.95, 0.15, 0.72, 0.72, { z: 14 }),
      item("modular-suite/props/camp_travel/cmp_canvas_stool.png", 1.05, 0.4, 0.72, 0.72, { rot: 0.6, z: 14 }),
      item("modular-suite/props/camp_travel/cmp_leather_backpack.png", 1.35, -1.2, 0.82, 0.82, { rot: -0.4, z: 14 }),
    ],
  },
  {
    id: "tpl-smuggler-stash",
    name: "Smuggler Heist Cache",
    category: "camp_wilds",
    description: "Stolen paymaster strongbox, aether crystal cage, diplomat trunk, weapons & false crates.",
    accentHex: "#38BDF8",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/ship_cargo_hold/cargo_paymaster_strongbox.png", -0.55, -0.55, 1.15, 0.95, { rot: 0.2, z: 15 }),
      item("modular-suite/props/ship_cargo_hold/cargo_aether_crystal_cage.png", 0.75, -0.7, 1.2, 1.05, { rot: -0.15, z: 15 }),
      item("modular-suite/props/ship_cargo_hold/cargo_diplomat_trunk.png", -0.85, 0.55, 1.12, 1.0, { rot: 0.35, z: 14 }),
      item("modular-suite/props/ship_cargo_hold/cargo_weapons_long_crate.png", 0.6, 0.65, 1.55, 0.82, { rot: -0.2, z: 14 }),
      item("modular-suite/props/ship_cargo_hold/cargo_smuggler_false_crate.png", 1.65, -0.05, 1.1, 0.95, { rot: 0.12, z: 14 }),
      item("modular-suite/props/camp_travel/cmp_folded_canvas_tarp.png", -1.65, -0.15, 1.25, 0.95, { rot: -0.4, z: 14 }),
    ],
  },
  {
    id: "tpl-beached-dinghy",
    name: "Beached Dinghy Landing",
    category: "water_ships",
    description: "Wooden rowboat dinghy, crossed oars, bailer bucket, paddles & folded camouflage tarp.",
    accentHex: "#14B8A6",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/water_ripples_foam/wat_ripple_oval_hull.png", 0.65, 0.05, 2.8, 1.8, { rot: -0.15, opacity: 0.45, shadow: false, z: 8 }),
      item("modular-suite/props/ship_boats_oars/boat_wooden_rowboat_dinghy.png", 0.3, 0, 1.34, 2.81, { rot: 1.42, z: 14 }),
      item("modular-suite/props/ship_boats_oars/boat_pair_wooden_oars.png", -1.15, 0.65, 0.68, 1.81, { rot: 1.97, z: 13 }),
      item("modular-suite/props/ship_boats_oars/boat_bailer_scoop_bucket.png", -0.85, -0.65, 0.72, 0.53, { z: 13 }),
      item("modular-suite/props/camp_travel/cmp_folded_canvas_tarp.png", -1.55, -0.35, 1.3, 1.0, { rot: -0.25, z: 13 }),
    ],
  },
  {
    id: "tpl-aether-engine-bay",
    name: "Aether Engine Bay Core",
    category: "magipunk",
    description: "Glowing aether furnace core, levitation coil ring, crystal battery, tank & flywheel.",
    accentHex: "#38BDF8",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/skyship_engines/sky_aether_furnace_core.png", 0, 0, 1.8, 1.8, { z: 16 }),
      item("modular-suite/props/skyship_engines/sky_levitation_coil_ring.png", 1.3, -1.4, 1.08, 1.08, { z: 15 }),
      item("modular-suite/props/skyship_engines/sky_violet_crystal_battery.png", 1.3, 1.4, 1.08, 0.95, { z: 15 }),
      item("modular-suite/props/skyship_engines/sky_pressurized_aether_tank.png", -1.25, -1.3, 1.18, 0.85, { z: 15 }),
      item("modular-suite/props/skyship_engines/sky_flywheel_belt_drive.png", -1.2, 1.35, 1.18, 1.08, { z: 15 }),
    ],
  },
  {
    id: "tpl-sloop-helm-station",
    name: "Sloop Helm & Nav Station",
    category: "magipunk",
    description: "Aether helm console, binnacle compass, brass engine telegraph & glowing crystal nav orb.",
    accentHex: "#A78BFA",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/ship_helm_nav/sky_aether_helm_console.png", -0.25, 0, 1.54, 1.19, { rot: Math.PI / 2, z: 16 }),
      item("modular-suite/props/ship_helm_nav/ship_binnacle_compass.png", 0.45, 0, 0.72, 0.49, { z: 16 }),
      item("modular-suite/props/ship_helm_nav/ship_engine_telegraph.png", 0.05, -0.95, 0.68, 0.5, { z: 16 }),
      item("modular-suite/props/ship_helm_nav/sky_crystal_nav_orb.png", 0.05, 0.95, 0.68, 0.68, { z: 16 }),
    ],
  },
  {
    id: "tpl-outrigger-turbine",
    name: "Aether Turbine Outrigger",
    category: "magipunk",
    description: "Hydrofoil wing, brass aether turbine pod, 4-blade propeller & waterline ripple ring.",
    accentHex: "#0EA5E9",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/water_ripples_foam/wat_ripple_concentric.png", 0, -0.35, 2.35, 1.65, { opacity: 0.46, shadow: false, z: 8 }),
      item("modular-suite/props/water_yacht_luxury/wat_aether_hydrofoil.png", 0, 0.45, 2.31, 1.7, { z: 13 }),
      item("modular-suite/props/skyship_engines/sky_aether_turbine_pod.png", 0, -0.35, 1.85, 1.86, { z: 16 }),
      item("modular-suite/props/skyship_engines/sky_propeller_4blade.png", -1.35, -0.35, 1.05, 1.05, { z: 17 }),
    ],
  },
  {
    id: "tpl-captains-salon",
    name: "Captain's Salon & Chart Set",
    category: "interiors",
    description: "Crimson medallion rug, captain's chart table, armillary globe, tea tray, liquor cabinet & bench.",
    accentHex: "#DC2626",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("core-fantasy/colorable/medallion_round_rug_colorable.png", 0, 0, 3.1, 2.6, { shadow: false, z: 11, tintHex: "#7F1D1D" }),
      item("modular-suite/props/ship_captain_cabin/ship_captain_chart_table.png", 0.1, -1.55, 1.8, 1.45, { z: 15 }),
      item("modular-suite/props/ship_captain_cabin/ship_captain_tea_tray.png", 0.1, -1.55, 0.65, 0.55, { z: 17 }),
      item("modular-suite/props/ship_captain_cabin/ship_brass_armillary_globe.png", 1.55, -1.5, 0.9, 0.9, { z: 16 }),
      item("modular-suite/props/ship_captain_cabin/ship_officer_liquor_cabinet.png", -1.55, -1.55, 1.15, 0.85, { z: 15 }),
      item("modular-suite/props/ship_captain_cabin/ship_stern_velvet_bench.png", 0.15, 1.75, 1.29, 1.54, { z: 15 }),
    ],
  },
  {
    id: "tpl-lakeside-cabana",
    name: "Lakeside Firepit & Cabana",
    category: "water_ships",
    description: "River-stone firepit ring, beach cabana canopy, towels, wicker picnic hamper & teak cooler.",
    accentHex: "#F97316",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/water_yacht_luxury/wat_stone_firepit_ring.png", 0.85, 0, 1.75, 1.75, { z: 14 }),
      item("modular-suite/props/water_bridges_structures/wat_beach_cabana_canopy.png", -1.55, 0.2, 2.35, 2.35, { rot: 0.25, z: 18 }),
      item("modular-suite/props/water_yacht_luxury/wat_striped_beach_towels.png", 0.9, 1.45, 1.14, 1.36, { rot: -0.2, shadow: false, z: 12 }),
      item("modular-suite/props/water_yacht_luxury/wat_wicker_picnic_hamper.png", 2.05, 0.95, 0.95, 0.8, { rot: 0.3, z: 14 }),
      item("modular-suite/props/water_yacht_luxury/wat_teak_cooler_chest.png", -0.25, -1.35, 1.2, 0.72, { rot: 0.15, z: 14 }),
    ],
  },
  {
    id: "tpl-pier-fishing",
    name: "Pier Fishing & Crab Station",
    category: "water_ships",
    description: "Fish-cleaning bench, lobster traps, crab trap, open tackle box, bamboo rods & fish bucket.",
    accentHex: "#06B6D4",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/water_docks_fishing/wat_fish_cleaning_bench.png", 0, -0.35, 1.85, 1.05, { z: 15 }),
      item("modular-suite/props/water_docks_fishing/wat_wooden_lobster_traps.png", 1.35, 0.25, 1.1, 1.18, { rot: 0.15, z: 15 }),
      item("modular-suite/props/water_docks_fishing/wat_wicker_crab_trap.png", -1.25, 0.35, 1.03, 0.79, { z: 15 }),
      item("modular-suite/props/water_docks_fishing/wat_open_tackle_box.png", -0.5, 0.55, 0.78, 0.68, { rot: -0.25, z: 15 }),
      item("modular-suite/props/water_docks_fishing/wat_bamboo_fishing_rods.png", 0.45, 0.55, 1.14, 0.74, { rot: 0.2, z: 15 }),
      item("modular-suite/props/water_docks_fishing/wat_bucket_of_fish.png", -1.2, -0.45, 0.68, 0.68, { z: 15 }),
    ],
  },
  {
    id: "tpl-lily-koi-cove",
    name: "Lily Pad & Koi Cove",
    category: "water_ships",
    description: "Pink lotus cluster, lily pad bed, koi fish school, cattail reeds & subtle water caustics.",
    accentHex: "#22C55E",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/water_ripples_foam/wat_caustics_patch.png", 0, 0, 3.4, 2.8, { opacity: 0.25, shadow: false, z: 3 }),
      item("modular-suite/props/water_wildlife_submerged/wat_koi_school.png", 0.65, -0.45, 1.53, 1.65, { rot: 0.25, opacity: 0.88, shadow: false, z: 7 }),
      item("modular-suite/props/water_flora_banks/wat_lily_lotus_pink.png", -0.85, -0.35, 1.95, 1.75, { rot: 0.2, shadow: false, z: 9 }),
      item("modular-suite/props/water_flora_banks/wat_lily_pad_bed.png", 0.55, 0.95, 2.1, 1.75, { rot: -0.35, shadow: false, z: 9 }),
      item("modular-suite/props/water_flora_banks/wat_cattail_tuft_top.png", -1.5, 0.85, 1.35, 1.3, { rot: 0.5, z: 12 }),
    ],
  },
  {
    id: "tpl-sunken-ruins",
    name: "Sunken Ruins & Mana Relics",
    category: "water_ships",
    description: "Submerged marble column, glowing lakebed crystals, sunken chest, amphora & brass gear.",
    accentHex: "#22D3EE",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/water_wildlife_submerged/wat_sunken_pillar.png", -0.9, -0.35, 2.24, 1.4, { rot: 0.35, opacity: 0.74, shadow: false, z: 5 }),
      item("modular-suite/props/water_wildlife_submerged/wat_submerged_crystals.png", 1.15, -0.45, 1.85, 1.75, { rot: 0.25, opacity: 0.84, shadow: false, z: 6 }),
      item("modular-suite/props/water_wildlife_submerged/wat_sunken_chest_amphora.png", 0.15, 0.75, 1.5, 1.35, { rot: -0.2, opacity: 0.76, shadow: false, z: 5 }),
      item("modular-suite/props/water_wildlife_submerged/wat_sunken_brass_gear.png", -1.1, 0.9, 1.6, 1.6, { rot: 0.4, opacity: 0.68, shadow: false, z: 5 }),
    ],
  },
  {
    id: "tpl-tavern-nook",
    name: "Tavern Table & Hearth Nook",
    category: "interiors",
    description: "Round tavern dining set, roaring hearth, ale keg rack & warm wooden stools.",
    accentHex: "#E5A93C",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("core-fantasy/hero/hero_tavern_round_set.png", 0.2, 0.25, 2.5, 2.5, { z: 15 }),
      item("core-fantasy/hero/hero_tavern_hearth.png", -1.7, -1.1, 1.86, 1.46, { z: 15 }),
      item("core-fantasy/hero/hero_ale_keg_rack.png", 1.75, -1.05, 1.5, 1.3, { rot: 0.12, z: 15 }),
      item("core-fantasy/objects/ale_barrel.png", 1.85, 0.65, 0.9, 0.9, { z: 14 }),
    ],
  },
  {
    id: "tpl-speakeasy-lounge",
    name: "Speakeasy Poker & Absinthe Lounge",
    category: "interiors",
    description: "Octagonal green-baize poker table, crimson rug, absinthe bar, stools & parlor lamp.",
    accentHex: "#10B981",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("core-fantasy/colorable/parlor_rug_rect_colorable.png", 0, 0.2, 3.6, 2.4, { shadow: false, z: 11, tintHex: "#8E1B2E" }),
      item("modular-suite/props/subterranean_caves/sub_speakeasy_poker_table_felt.png", 0, 0.35, 1.55, 1.55, { z: 15 }),
      item("modular-suite/props/subterranean_caves/sub_smuggler_speakeasy_bar.png", 0, -1.75, 2.4, 1.33, { z: 15 }),
      item("modular-suite/props/tavern_clutter/tav_wooden_chair.png", -1.15, 0.35, 0.66, 0.7, { rot: -Math.PI / 2, z: 14 }),
      item("modular-suite/props/tavern_clutter/tav_wooden_chair.png", 1.15, 0.35, 0.66, 0.7, { rot: Math.PI / 2, z: 14 }),
      item("modular-suite/props/harmony_lighting/lgt_floor_tiffany_stained_lamp.png", -1.9, -0.85, 0.8, 0.8, { z: 16 }),
    ],
  },
  {
    id: "tpl-cathedral-crypt-shrine",
    name: "Cathedral Crypt & Vigil Shrine",
    category: "interiors",
    description: "Carved limestone sarcophagus, skull ossuary niche, wax-crusted vigil cairn & iron candelabras.",
    accentHex: "#A855F7",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/subterranean_caves/sub_stone_sarcophagus_carved.png", 0, 0, 1.8, 1.12, { z: 15 }),
      item("modular-suite/props/subterranean_caves/sub_ossuary_skull_alcove.png", 0, -1.45, 1.55, 0.83, { z: 15 }),
      item("modular-suite/props/subterranean_caves/sub_crypt_wall_candle_cairn.png", 0, 1.35, 1.42, 0.9, { z: 15 }),
      item("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_iron.png", -1.45, -0.55, 0.84, 0.84, { z: 16 }),
      item("modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_iron.png", 1.45, -0.55, 0.84, 0.84, { z: 16 }),
    ],
  },
  {
    id: "tpl-crystal-cave-dock",
    name: "Underground Cave Jetty & Crystal Cove",
    category: "camp_wilds",
    description: "Moss-slick smuggler jetty, moored rowboat, cyan aether crystals, glowing mushrooms & tidepool.",
    accentHex: "#38BDF8",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/subterranean_caves/sub_cave_wooden_smuggler_jetty.png", -0.35, -0.45, 2.2, 1.34, { z: 14 }),
      item("modular-suite/props/subterranean_caves/sub_smuggler_rowboat_moored.png", 0.35, 1.1, 2.1, 1.18, { rot: -0.2, z: 15 }),
      item("modular-suite/props/subterranean_caves/sub_cave_crystal_vein_cyan_lg.png", -1.9, 0.6, 1.45, 1.26, { rot: 0.3, z: 16 }),
      item("modular-suite/props/subterranean_caves/sub_cave_glow_shroom_cluster_cyan.png", 1.85, -0.55, 1.35, 1.25, { z: 16 }),
      item("modular-suite/props/subterranean_caves/sub_cave_bioluminescent_tidepool.png", -1.85, -1.25, 1.5, 1.31, { shadow: false, z: 12 }),
    ],
  },
  {
    id: "tpl-parlor-sundae-booth",
    name: "Ice Cream Express Parlor Table Set",
    category: "magipunk",
    description: "Marble bistro table set with strawberry & chocolate sundaes, parlor chairs & milk-glass pendant.",
    accentHex: "#F472B6",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/ice_cream_train/ic_bare_marble_bistro_table.png", 0, 0, 1.35, 1.35, { z: 15 }),
      item("modular-suite/props/ice_cream_train/ic_sundae_bowl_strawberry.png", -0.28, -0.05, 0.44, 0.44, { shadow: false, z: 17 }),
      item("modular-suite/props/ice_cream_train/ic_sundae_bowl_chocolate.png", 0.28, 0.08, 0.44, 0.44, { shadow: false, z: 17 }),
      item("modular-suite/props/ice_cream_train/ic_parlor_bistro_chair.png", -1.05, 0, 0.7, 0.7, { rot: -Math.PI / 2, z: 14 }),
      item("modular-suite/props/ice_cream_train/ic_parlor_bistro_chair.png", 1.05, 0, 0.7, 0.7, { rot: Math.PI / 2, z: 14 }),
      item("modular-suite/props/ice_cream_train/ic_parlor_bistro_chair.png", 0, -1.05, 0.7, 0.7, { z: 14 }),
      item("modular-suite/props/harmony_lighting/lgt_ceiling_cafe_milkglass_pendant.png", 0, 0, 0.9, 0.9, { opacity: 0.85, shadow: false, z: 22 }),
    ],
  },
  {
    id: "tpl-watchtower-battlement",
    name: "Watchtower Battlement & Searchlight Post",
    category: "magipunk",
    description: "Swiveling cyan aether searchlight turret, capacitor dynamo, bronze alarm bell, rangefinder & sandbags.",
    accentHex: "#38BDF8",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/watchtower_garrison/wt_searchlight_turret_aether.png", 0, 0, 1.72, 1.72, { rot: Math.PI / 4, z: 16 }),
      item("modular-suite/props/watchtower_garrison/wt_searchlight_capacitor_bank.png", 1.55, -0.15, 1.14, 0.76, { rot: Math.PI / 2, z: 15 }),
      item("modular-suite/props/watchtower_garrison/wt_district_alarm_bell.png", -0.25, -1.65, 1.1, 1.1, { z: 16 }),
      item("modular-suite/props/watchtower_garrison/wt_observatory_rangefinder.png", -0.15, 1.65, 1.04, 1.04, { rot: 0.35, z: 15 }),
      item("modular-suite/props/watchtower_garrison/wt_semaphore_signal_rack.png", 1.25, 1.2, 0.98, 0.68, { rot: -0.7, z: 15 }),
      item("modular-suite/props/watchtower_garrison/wt_sandbag_embrasure_arc.png", -1.45, 1.15, 1.26, 0.67, { rot: -2.35, z: 15 }),
    ],
  },
  {
    id: "tpl-community-kid-theater",
    name: "Community Kid Theater & Puppet Stage",
    category: "camp_wilds",
    description: "Timber community stage, patchwork curtains, cardboard castle & clockwork dragon, puppet booth, quilts & footlights.",
    accentHex: "#F59E0B",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/community_kid_theater/kt_bare_community_stage_deck.png", 0, -1.0, 3.6, 2.4, { z: 12 }),
      item("modular-suite/props/community_kid_theater/kt_stage_front_steps_wood.png", 0, 0.52, 1.15, 0.92, { z: 13 }),
      item("modular-suite/props/community_kid_theater/kt_cardboard_castle_flat.png", -0.58, -1.68, 1.72, 0.75, { z: 15 }),
      item("modular-suite/props/community_kid_theater/kt_cardboard_dragon_prop.png", 0.55, -0.92, 1.44, 1.056, { rot: -0.2, z: 16 }),
      item("modular-suite/props/community_kid_theater/kt_patchwork_curtain_arch.png", 0, -0.08, 3.55, 1.08, { z: 20 }),
      item("modular-suite/props/community_kid_theater/kt_tin_can_footlight_bar.png", -1.05, 0.04, 1.18, 0.37, { shadow: false, z: 17 }),
      item("modular-suite/props/community_kid_theater/kt_patchwork_quilt_blanket.png", -0.95, 1.95, 1.6, 1.3, { shadow: false, z: 11 }),
      item("modular-suite/props/community_kid_theater/kt_floor_cushions_cluster.png", -0.95, 1.95, 0.88, 0.73, { z: 14 }),
      item("modular-suite/props/community_kid_theater/kt_folding_puppet_booth.png", 2.25, -0.65, 1.3, 0.9, { rot: -0.35, z: 16 }),
    ],
  },
  {
    id: "tpl-aged-streetcar-stop",
    name: "Aged Streetcar Stop & Utility Crossing",
    category: "magipunk",
    description: "Dusty-glass iron Haltestelle shelter, granite crosswalk, crossing iron plates, switch box, granite-collar manhole, storm drain & layered oil/grime overlays.",
    accentHex: "#94A3B8",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/aged_streetcar_line/st_tram_crossing_iron_plates.png", 0, 0, 2.88, 2.4, { shadow: false, z: 11 }),
      item("modular-suite/props/aged_streetcar_line/st_aged_tram_stop_shelter.png", -0.15, -2.05, 2.24, 1.12, { rot: Math.PI, z: 15 }),
      item("modular-suite/props/aged_streetcar_line/st_aged_granite_crosswalk.png", 0, 2.05, 2.8, 1.26, { shadow: false, z: 11 }),
      item("modular-suite/props/aged_streetcar_line/st_rail_switch_point_box.png", 1.95, -0.95, 0.96, 0.8, { shadow: false, z: 12 }),
      item("modular-suite/props/aged_streetcar_line/st_street_manhole_granite_collar.png", -2.15, 1.55, 0.92, 0.92, { shadow: false, z: 12 }),
      item("modular-suite/props/aged_streetcar_line/st_curb_storm_drain_basin.png", 1.95, 1.45, 0.77, 0.56, { shadow: false, z: 12 }),
      item("modular-suite/props/aged_streetcar_line/st_overhead_catenary_pole.png", -2.05, -1.95, 0.9, 0.72, { rot: Math.PI / 2, z: 16 }),
      item("modular-suite/props/weathering_overlays/wth_axle_grease_oil_drip_strip.png", 0, 0, 2.4, 1.08, { shadow: false, opacity: 0.82, z: 13 }),
      item("modular-suite/props/weathering_overlays/wth_obj_dust_film_veil.png", -0.15, -2.05, 1.2, 1.2, { shadow: false, opacity: 0.58, z: 18 }),
    ],
  },
  {
    id: "tpl-vintner-tasting-bar",
    name: "Vintner's Wine Bar & Tasting Room",
    category: "interiors",
    description: "Walnut & brass wine tasting bar, mahogany bottle wall rack, tasting casks, cheese & charcuterie table, stools & crimson rug.",
    accentHex: "#E11D48",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("core-fantasy/colorable/parlor_rug_rect_colorable.png", -0.4, 0, 3.0, 2.1, { shadow: false, z: 11, tintHex: "#8E1B2E" }),
      item("modular-suite/props/boulevard_shops/bs_vintner_tasting_bar.png", 1.35, 0, 2.56, 1.15, { rot: Math.PI / 2, z: 15 }),
      item("modular-suite/props/boulevard_shops/bs_vintner_bottle_wall_rack.png", -1.65, 0, 2.24, 0.98, { rot: -Math.PI / 2, z: 15 }),
      item("modular-suite/props/boulevard_shops/bs_vintner_wine_barrel_display.png", -0.45, -1.45, 1.4, 1.0, { z: 15 }),
      item("modular-suite/modular/bare_oak_round_table.png", -0.35, 0.25, 1.1, 1.1, { z: 14 }),
      item("modular-suite/props/boulevard_shops/bs_vintner_cheese_charcuterie_board.png", -0.35, 0.25, 0.65, 0.52, { shadow: false, z: 17 }),
      item("modular-suite/props/boulevard_shops/bs_vintner_cork_crate_bottles.png", -0.45, 1.55, 0.99, 0.81, { z: 14 }),
    ],
  },
  {
    id: "tpl-tailor-cobbler-atelier",
    name: "Bespoke Tailor & Cobbler Atelier",
    category: "interiors",
    description: "Mahogany pattern-cutting table, dressmaker mannequins, gilt fitting mirror podium, treadle sewing desk, cobbler bench & silk bolt shelf.",
    accentHex: "#7C3AED",
    isBuiltIn: true,
    createdAt: BUILTIN_TIMESTAMP,
    items: [
      item("modular-suite/props/boulevard_shops/bs_tailor_cutting_pattern_table.png", 0, 0, 2.28, 1.2, { z: 15 }),
      item("modular-suite/props/boulevard_shops/bs_tailor_dressmaker_mannequins.png", -1.55, -1.15, 1.1, 0.9, { z: 16 }),
      item("modular-suite/props/boulevard_shops/bs_tailor_fitting_mirror_platform.png", 1.75, -0.75, 1.43, 1.1, { rot: Math.PI / 2, z: 16 }),
      item("modular-suite/props/boulevard_shops/bs_treadle_sewing_machine_desk.png", 0.35, 1.45, 1.3, 0.9, { z: 15 }),
      item("modular-suite/props/boulevard_shops/bs_cobbler_bootmaker_bench.png", -1.95, 0.55, 1.88, 1.06, { rot: -Math.PI / 2, z: 15 }),
      item("modular-suite/props/boulevard_shops/bs_tailor_colorable_cloth_display.png", 1.75, 1.15, 1.65, 0.88, { rot: Math.PI / 2, z: 15, tintHex: "#227252" }),
      item("modular-suite/props/market_tailor/mkt_sewing_basket.png", 0.95, 0.25, 0.58, 0.58, { z: 15 }),
    ],
  },
];

/**
 * Convert an arbitrary list of placed ObjectStamps into a reusable ObjectTemplate
 * centered around the group's bounding-box midpoint.
 */
export function buildTemplateFromObjects(
  objects: ObjectStamp[],
  name: string,
  category: ObjectTemplateCategory = "saved",
  description?: string,
  accentHex = "#E5A93C",
): ObjectTemplate {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const o of objects) {
    if (o.x < minX) minX = o.x;
    if (o.x > maxX) maxX = o.x;
    if (o.y < minY) minY = o.y;
    if (o.y > maxY) maxY = o.y;
  }
  const cx = objects.length > 0 ? (minX + maxX) / 2 : 0;
  const cy = objects.length > 0 ? (minY + maxY) / 2 : 0;

  return {
    id: `tpl-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "Saved Object Group",
    category,
    description:
      description?.trim() ||
      `Saved group of ${objects.length} object${objects.length === 1 ? "" : "s"}.`,
    accentHex,
    isBuiltIn: false,
    createdAt: new Date().toISOString(),
    items: objects.map((o) => ({
      assetId: o.assetId,
      dx: Number((o.x - cx).toFixed(3)),
      dy: Number((o.y - cy).toFixed(3)),
      widthCells: o.widthCells,
      heightCells: o.heightCells,
      rotationRad: o.rotationRad,
      flipX: o.flipX,
      flipY: o.flipY,
      opacity: o.opacity,
      castsShadow: o.castsShadow,
      recolor: { ...DEFAULT_RECOLOR, ...(o.recolor ?? {}) },
      zOrder: o.zOrder,
    })),
  };
}

/**
 * Expand a premade ObjectTemplate into world-space ObjectStamps centered at (x, y)
 * with group rotation and uniform scale applied cleanly around the template origin.
 */
export function expandTemplateAtPoint(
  template: ObjectTemplate,
  x: number,
  y: number,
  rotationRad = 0,
  scale = 1,
  idPrefix = `tpl-${Date.now()}`,
): ObjectStamp[] {
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  const safeScale = Math.max(0.25, Math.min(4, scale));
  return template.items.map((it, idx) => {
    const sx = it.dx * safeScale;
    const sy = it.dy * safeScale;
    const rx = sx * cos - sy * sin;
    const ry = sx * sin + sy * cos;
    return {
      id: `${idPrefix}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
      assetId: it.assetId,
      x: x + rx,
      y: y + ry,
      widthCells: it.widthCells * safeScale,
      heightCells: it.heightCells * safeScale,
      rotationRad: (it.rotationRad ?? 0) + rotationRad,
      flipX: Boolean(it.flipX),
      flipY: Boolean(it.flipY),
      opacity: it.opacity ?? 1,
      castsShadow: it.castsShadow ?? true,
      locked: false,
      recolor: { ...DEFAULT_RECOLOR, ...(it.recolor ?? {}) },
      zOrder: it.zOrder ?? 14 + idx,
    };
  });
}

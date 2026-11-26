#!/usr/bin/env python3
"""
Clean-Room CC0 World Atlas Asset Suite Builder (1,290 Assets) for Dice Chaos Compass v1.5.

Segments all 52 cohesive hand-inked vintage cartography sprite plates
(14 2x2 hero plates + 38 3x3 collection & species plates = 398 unique hand-inked icons)
with perimeter-BFS alpha stripping, halo defringing, and species family tagging (`set_*`),
and generates:
  - 398 Full-Color Hand-Inked Vintage Watercolor Atlas sprites (`normal`)
  - 398 Wonderdraft Ground-Sampled Biome Paintable sprites (`sample_color`)
  - 398 Antique Sepia-Ink Engraved Tintable sprites (`tint`)
  -  72 Y-Sorted Multi-Icon Natural Forest, Mountain Range, Dune, Cliff & Fleet Clusters (`normal` + `sample_color`)
  -  24 Seamless 512x512 World Paper, Vellum & Ocean Textures
Total: 1,290 100% hand-inked clean-room CC0 World Atlas assets!

Outputs:
  - public/assets/world-atlas-cc0/<group>/*.png
  - public/assets/world-atlas-cc0/manifest.json
  - public/assets/DiceChaos_World_Atlas_CC0.dcpack
  - 4 Visual QA contact sheets in scratch/
"""

from __future__ import annotations

import collections
import json
import math
import pathlib
import random
import shutil
import zipfile
from typing import Any

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = pathlib.Path(
    r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae"
)
OUT_DIR = ROOT / "public" / "assets" / "world-atlas-cc0"
DCPACK_PATH = ROOT / "public" / "assets" / "DiceChaos_World_Atlas_CC0.dcpack"
SCRATCH_DIR = ARTIFACTS_DIR / "scratch"

# (filename, grid_cols, grid_rows, [(slug, displayName, worldGroup, tags, anchorYFrac, punchInterior), ...])
# Every icon includes a `set_<species>` tag so the Multi-Variant Paint-In Brush cycles strictly
# among cohesive hand-drawn variants of the same tree/mountain/hill/dune/cliff/city family!
PLATES: list[tuple[str, int, int, list[tuple[str, str, str, list[str], float, bool]]]] = [
    # ════════════════════════════════════════════════════════════════════════
    # PART 1: 14 2x2 Hero Plates (56 Icons — Preserving all v1.5 Showcase paths!)
    # ════════════════════════════════════════════════════════════════════════
    (
        "world_hero_settlements_a_1795415966662.jpg", 2, 2,
        [
            ("hero_walled_capital_city", "Grand Walled Capital City", "settlements", ["set_medieval_towns", "city", "capital", "castle", "walled", "human", "hero"], 0.88, False),
            ("hero_elven_spire_citadel", "Elven Tree-Spire Citadel", "settlements", ["set_fantasy_cities", "elven", "elf", "citadel", "spire", "city", "hero"], 0.90, False),
            ("hero_dwarven_mountain_gate", "Dwarven Mountain Gate", "settlements", ["set_fantasy_cities", "dwarven", "dwarf", "mountain", "fortress", "gate", "hero"], 0.90, False),
            ("hero_coastal_harbor_castle", "Coastal Harbor Castle", "settlements", ["set_medieval_towns", "coastal", "harbor", "port", "castle", "lighthouse", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_settlements_b_1795415966776.jpg", 2, 2,
        [
            ("hero_desert_oasis_palace", "Desert Oasis Palace", "settlements", ["set_world_cities", "desert", "palace", "dome", "oasis", "city", "hero"], 0.90, False),
            ("hero_eastern_jade_pagoda", "Eastern Jade Pagoda", "settlements", ["set_world_cities", "eastern", "pagoda", "temple", "jade", "city", "hero"], 0.90, False),
            ("hero_wizard_observatory_spire", "Wizard Observatory Tower", "settlements", ["set_fantasy_cities", "wizard", "mage", "tower", "arcane", "hero"], 0.92, False),
            ("hero_gothic_overgrown_ruins", "Ancient Overgrown Ruins", "landmarks", ["set_landmarks", "ruins", "ancient", "gothic", "arch", "dungeon", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_landmarks_1795415968538.jpg", 2, 2,
        [
            ("hero_alpine_massif_peak", "Snow-Capped Alpine Massif", "mountains", ["set_alpine_peaks", "mountain", "alpine", "snow", "peak", "range", "hero"], 0.86, False),
            ("hero_smoking_volcano_peak", "Smoking Volcano Caldera", "mountains", ["set_volcanic", "volcano", "mountain", "lava", "smoke", "crater", "hero"], 0.88, False),
            ("hero_red_sandstone_mesa", "Red Sandstone Mesa Butte", "mountains", ["set_desert_dunes", "mesa", "butte", "desert", "cliff", "canyon", "hero"], 0.88, False),
            ("hero_pirate_island_fort", "Pirate Crag Island Fort", "settlements", ["set_world_cities", "pirate", "island", "fort", "cove", "harbor", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_maritime_1795415970293.jpg", 2, 2,
        [
            ("hero_sailing_galleon_ship", "Three-Masted Galleon", "maritime", ["set_ships", "ship", "galleon", "sail", "navy", "ocean", "hero"], 0.84, False),
            ("hero_viking_dragon_longship", "Nordic Dragon Longship", "maritime", ["set_ships", "ship", "viking", "nordic", "longship", "hero"], 0.84, False),
            ("hero_sky_dirigible_airship", "Brass Sky-Dirigible Airship", "maritime", ["set_ships", "airship", "skyship", "steampunk", "magipunk", "hero"], 0.55, False),
            ("hero_headland_lighthouse", "Rocky Headland Lighthouse", "maritime", ["set_sea_hazards", "lighthouse", "coast", "beacon", "tower", "hero"], 0.90, False),
        ],
    ),
    (
        "world_hero_monsters_1795415972313.jpg", 2, 2,
        [
            ("hero_horned_sea_serpent", "Horned Sea Serpent", "maritime", ["set_sea_hazards", "monster", "serpent", "sea", "ocean", "hazard", "hero"], 0.82, False),
            ("hero_giant_kraken", "Giant Ocean Kraken", "maritime", ["set_sea_hazards", "monster", "kraken", "octopus", "sea", "hazard", "hero"], 0.72, False),
            ("hero_spouting_great_whale", "Cartographic Great Whale", "maritime", ["set_sea_hazards", "whale", "sea", "ocean", "wildlife", "hero"], 0.76, False),
            ("hero_heraldic_map_dragon", "Heraldic Crag Dragon", "landmarks", ["set_beasts", "dragon", "monster", "lair", "hazard", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_ornaments_1795415975398.jpg", 2, 2,
        [
            ("hero_ornate_compass_rose", "Ornate 16-Point Compass Rose", "cartography", ["set_compasses", "compass", "rose", "north", "nautical", "hero"], 0.50, True),
            ("hero_celestial_windrose", "Celestial Star Windrose", "cartography", ["set_compasses", "compass", "windrose", "star", "celestial", "hero"], 0.50, True),
            ("hero_parchment_title_scroll", "Curled Parchment Title Scroll", "cartography", ["set_banners", "scroll", "banner", "title", "ribbon", "hero"], 0.50, False),
            ("hero_acanthus_cartouche_frame", "Acanthus Oval Cartouche", "cartography", ["set_banners", "cartouche", "frame", "banner", "title", "hero"], 0.50, True),
        ],
    ),
    (
        "world_hero_forests_1795415977509.jpg", 2, 2,
        [
            ("hero_alpine_pine_grove", "Alpine Pine & Fir Grove", "trees", ["set_pine", "tree", "pine", "fir", "forest", "conifer", "hero"], 0.88, False),
            ("hero_broadleaf_oak_copse", "Broadleaf Oak Copse", "trees", ["set_oak", "tree", "oak", "forest", "woods", "deciduous", "hero"], 0.88, False),
            ("hero_tropical_palm_cluster", "Tropical Palm & Jungle Grove", "trees", ["set_tropical", "tree", "palm", "jungle", "tropical", "hero"], 0.88, False),
            ("hero_mossy_deadwood_swamp", "Mossy Deadwood Swamp Trees", "trees", ["set_deadwood", "tree", "dead", "swamp", "marsh", "haunted", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_poi_1795416003413.jpg", 2, 2,
        [
            ("hero_druid_monolith_circle", "Standing Druid Stone Circle", "landmarks", ["set_landmarks", "druid", "stone", "circle", "monolith", "hero"], 0.86, False),
            ("hero_arched_stone_aqueduct", "Grand Stone Aqueduct Bridge", "settlements", ["set_medieval_towns", "bridge", "aqueduct", "stone", "river", "hero"], 0.86, False),
            ("hero_thatched_hamlet_windmill", "Thatched Hamlet & Windmill", "settlements", ["set_medieval_towns", "village", "hamlet", "windmill", "farm", "hero"], 0.88, False),
            ("hero_orcish_palisade_fort", "Orcish Timber Palisade Fort", "settlements", ["set_dark_forts", "orc", "fort", "palisade", "stronghold", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_mountains_b_1795416029245.jpg", 2, 2,
        [
            ("hero_triple_alpine_ridge", "Triple-Peak Alpine Ridge", "mountains", ["set_alpine_peaks", "mountain", "ridge", "range", "snow", "hero"], 0.86, False),
            ("hero_twin_granite_peaks", "Twin Granite Peaks & Pines", "mountains", ["set_rocky_peaks", "mountain", "granite", "twin", "peak", "hero"], 0.88, False),
            ("hero_rolling_green_foothills", "Rolling Grassy Foothills", "mountains", ["set_hills", "hills", "foothills", "downs", "meadow", "hero"], 0.84, False),
            ("hero_terraced_cliff_plateau", "Terraced Highland Plateau", "mountains", ["set_cliffs", "cliff", "plateau", "highland", "escarpment", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_towns_1795416029314.jpg", 2, 2,
        [
            ("hero_stone_watchtower_keep", "Hilltop Stone Watchtower", "settlements", ["set_medieval_towns", "tower", "watchtower", "keep", "fort", "hero"], 0.90, False),
            ("hero_countryside_windmill", "Countryside Grain Windmill", "settlements", ["set_medieval_towns", "windmill", "farm", "mill", "rural", "hero"], 0.90, False),
            ("hero_walled_market_town", "Walled Medieval Market Town", "settlements", ["set_medieval_towns", "town", "market", "walled", "city", "hero"], 0.88, False),
            ("hero_gothic_cathedral_abbey", "Gothic Twin-Tower Cathedral", "settlements", ["set_medieval_towns", "cathedral", "abbey", "temple", "gothic", "hero"], 0.90, False),
        ],
    ),
    (
        "world_hero_biomes_1795416031385.jpg", 2, 2,
        [
            ("hero_giant_mushroom_grove", "Giant Fey Mushroom Grove", "trees", ["set_fey_flora", "mushroom", "fungi", "fey", "forest", "hero"], 0.88, False),
            ("hero_autumn_maple_grove", "Golden Autumn Maple Grove", "trees", ["set_autumn", "tree", "autumn", "maple", "birch", "forest", "hero"], 0.88, False),
            ("hero_snowy_spruce_cluster", "Snow-Laden Winter Spruces", "trees", ["set_snow_trees", "tree", "snow", "winter", "spruce", "tundra", "hero"], 0.88, False),
            ("hero_arcane_crystal_spires", "Arcane Crystal Monoliths", "landmarks", ["set_landmarks", "crystal", "magic", "arcane", "spire", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_exotic_1795416033410.jpg", 2, 2,
        [
            ("hero_desert_stepped_ziggurat", "Stepped Desert Ziggurat", "settlements", ["set_world_cities", "desert", "ziggurat", "pyramid", "temple", "hero"], 0.88, False),
            ("hero_nordic_longhouse_village", "Nordic Viking Longhouse Hall", "settlements", ["set_world_cities", "nordic", "viking", "village", "snow", "hero"], 0.88, False),
            ("hero_pirate_harbor_pier", "Pirate Harbor Pier & Tavern", "settlements", ["set_world_cities", "pirate", "harbor", "pier", "dock", "port", "hero"], 0.86, False),
            ("hero_sunken_sea_temple", "Sunken Sea Temple Arch", "landmarks", ["set_landmarks", "sunken", "ruins", "temple", "sea", "ocean", "hero"], 0.86, False),
        ],
    ),
    (
        "world_hero_adventures_1795416050218.jpg", 2, 2,
        [
            ("hero_mine_cave_entrance", "Timbered Mine & Cave Mouth", "landmarks", ["set_landmarks", "mine", "cave", "dungeon", "entrance", "hero"], 0.88, False),
            ("hero_arcane_rune_portal", "Glowing Arcane Rune Portal", "landmarks", ["set_landmarks", "portal", "gate", "magic", "arcane", "hero"], 0.90, False),
            ("hero_adventurer_wagon_camp", "Adventurer Wagon Camp", "landmarks", ["set_landmarks", "camp", "tent", "wagon", "caravan", "hero"], 0.86, False),
            ("hero_battlefield_memorial", "Ancient Battlefield Cairn", "landmarks", ["set_landmarks", "battle", "swords", "memorial", "cairn", "hero"], 0.88, False),
        ],
    ),
    (
        "world_hero_sea_hazards_1795416037431.jpg", 2, 2,
        [
            ("hero_ocean_maelstrom_vortex", "Ocean Maelstrom Whirlpool", "maritime", ["set_sea_hazards", "maelstrom", "whirlpool", "vortex", "hazard", "hero"], 0.55, False),
            ("hero_drifting_arctic_iceberg", "Drifting Glacial Iceberg", "maritime", ["set_sea_hazards", "iceberg", "arctic", "ice", "glacier", "hero"], 0.82, False),
            ("hero_coral_galleon_shipwreck", "Shipwreck on Coral Shoals", "maritime", ["set_sea_hazards", "shipwreck", "wreck", "reef", "pirate", "hero"], 0.82, False),
            ("hero_nautical_heraldic_crest", "Nautical Heraldic Anchor Crest", "cartography", ["set_heraldry", "crest", "shield", "heraldry", "anchor", "hero"], 0.50, False),
        ],
    ),

    # ════════════════════════════════════════════════════════════════════════
    # PART 2: Original 12 3x3 Collection Plates (108 Icons)
    # ════════════════════════════════════════════════════════════════════════
    (
        "world_sheet_mountains_1795416424495.jpg", 3, 3,
        [
            ("mtn_snow_alpine_peak", "Snow Alpine Peak", "mountains", ["set_alpine_peaks", "mountain", "alpine", "snow", "peak"], 0.86, False),
            ("mtn_twin_rocky_peaks", "Twin Rocky Peaks", "mountains", ["set_rocky_peaks", "mountain", "twin", "granite", "peak"], 0.86, False),
            ("mtn_three_peak_massif", "Three-Peak Massif Range", "mountains", ["set_alpine_peaks", "mountain", "massif", "range", "snow"], 0.86, False),
            ("mtn_matterhorn_spire", "Matterhorn Granite Spire", "mountains", ["set_alpine_peaks", "mountain", "spire", "tall", "peak"], 0.88, False),
            ("mtn_craggy_low_ridge", "Low Craggy Mountain Ridge", "mountains", ["set_rocky_peaks", "mountain", "ridge", "crag", "rock"], 0.84, False),
            ("mtn_glacial_ice_range", "Glacial Ice Mountain Range", "mountains", ["set_alpine_peaks", "mountain", "glacier", "ice", "snow", "arctic"], 0.86, False),
            ("mtn_eroded_mossy_peak", "Mossy Eroded Highland Peak", "mountains", ["set_rocky_peaks", "mountain", "moss", "old", "highland"], 0.86, False),
            ("mtn_obsidian_volcanic_ridge", "Obsidian Volcanic Ridge", "mountains", ["set_volcanic", "mountain", "volcanic", "obsidian", "dark"], 0.86, False),
            ("mtn_twin_pass_saddle", "Mountain Pass Saddle", "mountains", ["set_rocky_peaks", "mountain", "pass", "valley", "gap"], 0.86, False),
        ],
    ),
    (
        "world_sheet_hills_1795416394193.jpg", 3, 3,
        [
            ("hill_single_meadow", "Single Meadow Hill", "mountains", ["set_hills", "hill", "meadow", "grass", "knoll"], 0.84, False),
            ("hill_paired_downs", "Paired Grassy Downs", "mountains", ["set_hills", "hill", "downs", "pair", "grass"], 0.84, False),
            ("hill_layered_foothills", "Layered Rolling Foothills", "mountains", ["set_hills", "hill", "foothills", "cluster", "range"], 0.84, False),
            ("land_red_sandstone_mesa", "Flat-Topped Sandstone Mesa", "mountains", ["set_desert_dunes", "mesa", "desert", "red", "butte"], 0.86, False),
            ("land_desert_rock_hoodoo", "Desert Rock Spire Hoodoo", "mountains", ["set_desert_dunes", "hoodoo", "spire", "desert", "canyon"], 0.88, False),
            ("land_stepped_canyon_cliff", "Red Canyon Escarpment", "mountains", ["set_desert_dunes", "canyon", "cliff", "desert", "escarpment"], 0.86, False),
            ("land_highland_moor_ridge", "Highland Moor Escarpment", "mountains", ["set_cliffs", "moor", "highland", "ridge", "cliff"], 0.84, False),
            ("land_coastal_sea_bluff", "Coastal Sea-Cliff Bluff", "mountains", ["set_cliffs", "cliff", "coast", "bluff", "rock"], 0.86, False),
            ("land_dormant_crater_caldera", "Dormant Volcanic Caldera", "mountains", ["set_volcanic", "crater", "caldera", "volcano", "basin"], 0.82, False),
        ],
    ),
    (
        "world_sheet_conifers_1795416395258.jpg", 3, 3,
        [
            ("tree_alpine_pine_single", "Single Alpine Pine", "trees", ["set_pine", "tree", "pine", "conifer", "single"], 0.90, False),
            ("tree_slender_spruce_single", "Single Slender Spruce", "trees", ["set_pine", "tree", "spruce", "fir", "single"], 0.90, False),
            ("tree_dark_pine_pair", "Dark Forest Pine Pair", "trees", ["set_pine", "tree", "pine", "pair", "forest"], 0.90, False),
            ("tree_dense_fir_trio", "Dense Evergreen Fir Trio", "trees", ["set_pine", "tree", "fir", "trio", "forest"], 0.90, False),
            ("tree_five_pine_woodland", "Five-Pine Woodland Cluster", "trees", ["set_pine", "tree", "pine", "cluster", "woods"], 0.88, False),
            ("tree_snow_pine_single", "Snow-Dusted Winter Pine", "trees", ["set_snow_trees", "tree", "snow", "winter", "pine"], 0.90, False),
            ("tree_arctic_spruce_trio", "Arctic Snowy Spruce Trio", "trees", ["set_snow_trees", "tree", "snow", "arctic", "spruce"], 0.88, False),
            ("tree_coastal_cypress", "Tall Coastal Cypress", "trees", ["set_pine", "tree", "cypress", "mediterranean", "single"], 0.90, False),
            ("tree_mountain_cedar_cluster", "Weathered Mountain Cedars", "trees", ["set_pine", "tree", "cedar", "mountain", "cluster"], 0.88, False),
        ],
    ),
    (
        "world_sheet_broadleaf_1795416396057.jpg", 3, 3,
        [
            ("tree_grand_oak_single", "Grand Spreading Oak", "trees", ["set_oak", "tree", "oak", "broadleaf", "single"], 0.90, False),
            ("tree_broadleaf_pair", "Broadleaf Woodland Pair", "trees", ["set_oak", "tree", "oak", "pair", "woods"], 0.90, False),
            ("tree_four_oak_copse", "Four-Oak Forest Copse", "trees", ["set_oak", "tree", "oak", "copse", "forest"], 0.88, False),
            ("tree_autumn_maple_single", "Golden Autumn Maple", "trees", ["set_autumn", "tree", "autumn", "maple", "fall"], 0.90, False),
            ("tree_silver_birch_trio", "Silver-Bark Birch Trio", "trees", ["set_autumn", "tree", "birch", "woods", "trio"], 0.90, False),
            ("tree_coconut_palm_single", "Curved Coconut Palm", "trees", ["set_tropical", "tree", "palm", "tropical", "island"], 0.90, False),
            ("tree_savanna_acacia", "Flat-Top Savanna Acacia", "trees", ["set_desert_flora", "tree", "acacia", "savanna", "plains"], 0.90, False),
            ("tree_swamp_deadwood", "Gnarled Swamp Deadwood", "trees", ["set_deadwood", "tree", "dead", "swamp", "bog"], 0.90, False),
            ("tree_desert_cacti_scrub", "Desert Saguaro & Scrub", "trees", ["set_desert_flora", "cactus", "desert", "scrub", "flora"], 0.88, False),
        ],
    ),
    (
        "world_sheet_villages_1795416399898.jpg", 3, 3,
        [
            ("settle_thatched_cottage", "Rustic Thatched Cottage", "settlements", ["set_medieval_towns", "cottage", "house", "village", "rural"], 0.88, False),
            ("settle_three_cottage_hamlet", "Three-Cottage Hamlet", "settlements", ["set_medieval_towns", "hamlet", "village", "cottages", "rural"], 0.86, False),
            ("settle_crossroads_inn", "Crossroads Coaching Inn", "settlements", ["set_medieval_towns", "inn", "tavern", "road", "stable"], 0.88, False),
            ("settle_fortified_manor", "Fortified Stone Manor", "settlements", ["set_medieval_towns", "manor", "estate", "noble", "house"], 0.88, False),
            ("settle_river_watermill", "Wooden River Watermill", "settlements", ["set_medieval_towns", "watermill", "mill", "river", "farm"], 0.86, False),
            ("settle_square_fortress_keep", "Stone Fortress Keep", "settlements", ["set_medieval_towns", "keep", "castle", "fortress", "stone"], 0.88, False),
            ("settle_arched_stream_bridge", "Stone Arched Bridge", "settlements", ["set_medieval_towns", "bridge", "stone", "river", "crossing"], 0.82, False),
            ("settle_frontier_watchtower", "Timber Frontier Watchtower", "settlements", ["set_medieval_towns", "watchtower", "palisade", "tower", "frontier"], 0.88, False),
            ("settle_country_chapel", "Stone Country Chapel", "settlements", ["set_medieval_towns", "chapel", "church", "temple", "village"], 0.90, False),
        ],
    ),
    (
        "world_sheet_cultures_1795416402878.jpg", 3, 3,
        [
            ("cult_elven_watchtower", "Elven White-Stone Tower", "settlements", ["set_fantasy_cities", "elven", "tower", "spire", "watch"], 0.90, False),
            ("cult_elven_tree_hall", "Elven Woodland Tree-Hall", "settlements", ["set_fantasy_cities", "elven", "treehouse", "hall", "forest"], 0.90, False),
            ("cult_dwarven_bastion", "Dwarven Stone Bastion", "settlements", ["set_fantasy_cities", "dwarven", "bastion", "fort", "mountain"], 0.88, False),
            ("cult_dwarven_iron_foundry", "Dwarven Iron Foundry", "settlements", ["set_fantasy_cities", "dwarven", "forge", "foundry", "mine"], 0.88, False),
            ("cult_desert_oasis_village", "Desert Mudbrick Village", "settlements", ["set_world_cities", "desert", "oasis", "village", "mudbrick"], 0.86, False),
            ("cult_desert_bazaar_minaret", "Desert Domed Bazaar", "settlements", ["set_world_cities", "desert", "bazaar", "minaret", "dome"], 0.88, False),
            ("cult_eastern_torii_gate", "Eastern Torii Shrine Gate", "settlements", ["set_world_cities", "eastern", "torii", "shrine", "gate"], 0.90, False),
            ("cult_nordic_turf_longhouse", "Nordic Turf Longhouse", "settlements", ["set_world_cities", "nordic", "viking", "longhouse", "house"], 0.88, False),
            ("cult_orcish_war_camp", "Orcish Bone & War Tent Camp", "settlements", ["set_dark_forts", "orc", "camp", "war", "tent"], 0.86, False),
        ],
    ),
    (
        "world_sheet_ruins_1795416455537.jpg", 3, 3,
        [
            ("ruin_broken_castle_tower", "Crumbling Castle Tower", "landmarks", ["set_landmarks", "ruin", "tower", "broken", "castle"], 0.90, False),
            ("ruin_standing_obelisk", "Weathered Ancient Obelisk", "landmarks", ["set_landmarks", "obelisk", "monolith", "ancient", "stone"], 0.90, False),
            ("ruin_fallen_colonnade", "Mossy Fallen Colonnade", "landmarks", ["set_landmarks", "ruin", "pillars", "columns", "temple"], 0.86, False),
            ("ruin_stone_cairn_marker", "Standing Stone Waymarker", "landmarks", ["set_landmarks", "cairn", "waystone", "marker", "trail"], 0.90, False),
            ("ruin_tomb_crypt_mouth", "Ancient Crypt Entrance", "landmarks", ["set_landmarks", "crypt", "tomb", "dungeon", "grave"], 0.88, False),
            ("ruin_guardian_statue", "Carved Stone Guardian Statue", "landmarks", ["set_landmarks", "statue", "monument", "ancient", "landmark"], 0.90, False),
            ("ruin_flooded_archway", "Flooded Sunken Archway", "landmarks", ["set_landmarks", "sunken", "arch", "ruin", "water"], 0.86, False),
            ("ruin_overgrown_well_shrine", "Overgrown Stone Well Shrine", "landmarks", ["set_landmarks", "well", "shrine", "ruin", "magic"], 0.88, False),
            ("ruin_broken_aqueduct", "Ruined Stone Aqueduct", "landmarks", ["set_landmarks", "aqueduct", "ruin", "arches", "ancient"], 0.86, False),
        ],
    ),
    (
        "world_sheet_adventures_1795416455794.jpg", 3, 3,
        [
            ("poi_caravan_covered_wagon", "Trade Caravan Wagon", "landmarks", ["set_landmarks", "wagon", "caravan", "trade", "road"], 0.86, False),
            ("poi_medieval_campfire", "Traveler Campfire Ring", "landmarks", ["set_landmarks", "campfire", "camp", "rest", "wild"], 0.82, False),
            ("poi_crossroads_signpost", "Crossroads Wooden Signpost", "landmarks", ["set_landmarks", "signpost", "crossroads", "trail", "road"], 0.92, False),
            ("poi_dwarven_mine_cart", "Timbered Mine & Ore Cart", "landmarks", ["set_landmarks", "mine", "ore", "dwarven", "cave"], 0.88, False),
            ("poi_goblin_cave_mouth", "Smoking Mountain Cave Mouth", "landmarks", ["set_landmarks", "cave", "lair", "dungeon", "goblin"], 0.88, False),
            ("poi_forest_witch_hut", "Swamp Witch Hut on Stilts", "landmarks", ["set_landmarks", "hut", "witch", "hag", "swamp", "forest"], 0.90, False),
            ("poi_crossed_swords_battle", "Crossed-Swords Battlefield", "landmarks", ["set_heraldry", "battle", "swords", "war", "marker"], 0.55, False),
            ("poi_red_treasure_x_mark", "Red-Ink Treasure X Mark", "landmarks", ["set_heraldry", "treasure", "x", "pirate", "marker"], 0.50, False),
            ("poi_purple_crystal_rift", "Arcane Crystal Rift Crater", "landmarks", ["set_landmarks", "rift", "crystal", "magic", "crater"], 0.84, False),
        ],
    ),
    (
        "world_sheet_ships_1795416460463.jpg", 3, 3,
        [
            ("ship_fishing_rowboat", "Wooden Fishing Rowboat", "maritime", ["set_ships", "boat", "rowboat", "fishing", "river"], 0.78, False),
            ("ship_merchant_sloop", "Single-Mast Merchant Sloop", "maritime", ["set_ships", "ship", "sloop", "merchant", "sail"], 0.82, False),
            ("ship_pirate_brigantine", "Two-Mast Pirate Brigantine", "maritime", ["set_ships", "ship", "pirate", "brigantine", "sail"], 0.84, False),
            ("ship_exploration_caravel", "Grand Exploration Caravel", "maritime", ["set_ships", "ship", "caravel", "explorer", "sail"], 0.84, False),
            ("ship_eastern_junk", "Eastern Curved-Sail Junk", "maritime", ["set_ships", "ship", "eastern", "junk", "sail"], 0.84, False),
            ("ship_mediterranean_galley", "Oared War Galley", "maritime", ["set_ships", "ship", "galley", "oars", "navy"], 0.82, False),
            ("ship_wooden_fishing_dock", "Wooden Harbor Pier Dock", "maritime", ["set_ships", "dock", "pier", "harbor", "coast"], 0.82, False),
            ("ship_stone_coastal_quay", "Stone Mooring Quay", "maritime", ["set_ships", "quay", "harbor", "port", "coast"], 0.82, False),
            ("ship_canvas_airship_skiff", "Canvas Airship Skiff", "maritime", ["set_ships", "airship", "skiff", "flying", "sky"], 0.55, False),
        ],
    ),
    (
        "world_sheet_ocean_1795416459959.jpg", 3, 3,
        [
            ("sea_inked_wave_crests", "Hand-Inked Ocean Waves", "maritime", ["set_sea_hazards", "waves", "ocean", "sea", "texture"], 0.65, False),
            ("sea_coastal_rock_shoals", "Coastal Sea Stacks & Shoals", "maritime", ["set_sea_hazards", "rocks", "shoals", "hazard", "coast"], 0.84, False),
            ("sea_coral_reef_outcrop", "Coral Reef Outcrop", "maritime", ["set_sea_hazards", "coral", "reef", "tropical", "hazard"], 0.80, False),
            ("sea_swirling_whirlpool", "Swirling Ocean Whirlpool", "maritime", ["set_sea_hazards", "whirlpool", "vortex", "hazard", "sea"], 0.55, False),
            ("sea_arctic_ice_floes", "Drifting Arctic Ice Floes", "maritime", ["set_sea_hazards", "ice", "arctic", "floe", "glacier"], 0.72, False),
            ("sea_sunken_ship_mast", "Submerged Shipwreck Mast", "maritime", ["set_sea_hazards", "shipwreck", "mast", "hazard", "sea"], 0.82, False),
            ("sea_leaping_dolphins", "Leaping Ocean Dolphins", "maritime", ["set_sea_hazards", "dolphin", "wildlife", "sea", "ocean"], 0.75, False),
            ("sea_giant_turtle", "Giant Swimming Sea Turtle", "maritime", ["set_sea_hazards", "turtle", "wildlife", "sea", "ocean"], 0.65, False),
            ("sea_merfolk_serpent_emblem", "Merfolk Serpent Sea Emblem", "maritime", ["set_sea_hazards", "merfolk", "serpent", "emblem", "monster"], 0.65, False),
        ],
    ),
    (
        "world_sheet_cartography_1795416462570.jpg", 3, 3,
        [
            ("carto_north_arrow_4pt", "Antique 4-Point North Arrow", "cartography", ["set_compasses", "compass", "north", "arrow", "minimal"], 0.50, True),
            ("carto_nautical_compass_8pt", "Classic 8-Point Nautical Compass", "cartography", ["set_compasses", "compass", "nautical", "rose", "north"], 0.50, True),
            ("carto_starburst_windrose", "Starburst Filigree Windrose", "cartography", ["set_compasses", "compass", "windrose", "starburst", "ornament"], 0.50, True),
            ("carto_wavy_ribbon_banner", "Wavy Parchment Ribbon Banner", "cartography", ["set_banners", "banner", "ribbon", "scroll", "title"], 0.50, False),
            ("carto_notched_scroll_banner", "Notched Medieval Scroll Banner", "cartography", ["set_banners", "banner", "scroll", "medieval", "title"], 0.50, False),
            ("carto_iron_nameplate_plaque", "Riveted Iron Title Plaque", "cartography", ["set_banners", "plaque", "title", "iron", "steampunk"], 0.50, False),
            ("carto_baroque_corner_filigree", "Baroque Border Corner Filigree", "cartography", ["set_banners", "frame", "corner", "border", "ornament"], 0.50, True),
            ("carto_heraldic_ribbon_crest", "Blank Heraldic Ribbon Crest", "cartography", ["set_heraldry", "crest", "heraldry", "shield", "banner"], 0.50, False),
            ("carto_scale_divider_flourish", "Vintage Scale Divider Flourish", "cartography", ["set_banners", "divider", "flourish", "scale", "ornament"], 0.50, False),
        ],
    ),
    (
        "world_sheet_markers_1795416481528.jpg", 3, 3,
        [
            ("pin_gold_capital_star", "Gold Capital Star Marker", "cartography", ["set_heraldry", "marker", "pin", "capital", "star", "city"], 0.50, False),
            ("pin_crimson_town_dot", "Crimson Ringed Town Pin", "cartography", ["set_heraldry", "marker", "pin", "town", "dot", "city"], 0.50, False),
            ("pin_royal_gold_crown", "Royal Crown Capital Emblem", "cartography", ["set_heraldry", "marker", "pin", "crown", "kingdom", "capital"], 0.50, False),
            ("pin_iron_port_anchor", "Iron Anchor Port Marker", "cartography", ["set_heraldry", "marker", "pin", "anchor", "port", "harbor"], 0.50, False),
            ("pin_crossed_pickaxes_mine", "Crossed Pickaxes Mine Marker", "cartography", ["set_heraldry", "marker", "pin", "mine", "pickaxe", "dwarf"], 0.50, False),
            ("pin_heraldic_kite_shield", "Heraldic Fortress Shield Pin", "cartography", ["set_heraldry", "marker", "pin", "shield", "fort", "faction"], 0.50, False),
            ("pin_skull_hazard_marker", "Skull & Bones Hazard Marker", "cartography", ["set_heraldry", "marker", "pin", "skull", "danger", "dungeon"], 0.50, False),
            ("pin_arcane_eye_marker", "Arcane All-Seeing Eye Pin", "cartography", ["set_heraldry", "marker", "pin", "magic", "eye", "arcane"], 0.50, False),
            ("pin_merchant_scales_trade", "Merchant Scales Trade Emblem", "cartography", ["set_heraldry", "marker", "pin", "trade", "gold", "market"], 0.50, False),
        ],
    ),

    # ════════════════════════════════════════════════════════════════════════
    # PART 3: 26 NEW 3x3 Expansion Species & Regional Atlas Plates (234 Icons!)
    # ════════════════════════════════════════════════════════════════════════

    # ── Batch A: 8 Multi-Variant Tree & Flora Species Plates (72 New Icons) ──
    (
        "exp_trees_pine_set_1795419107919.jpg", 3, 3,
        [
            ("exp_pine_tall_narrow", "Tall Narrow Alpine Pine", "trees", ["set_pine", "tree", "pine", "conifer", "evergreen"], 0.90, False),
            ("exp_pine_windswept_ridge", "Wind-Swept Ridge Fir", "trees", ["set_pine", "tree", "fir", "pine", "windswept"], 0.90, False),
            ("exp_pine_young_bushy", "Compact Young Evergreen Pine", "trees", ["set_pine", "tree", "pine", "young", "conifer"], 0.90, False),
            ("exp_pine_old_growth_spruce", "Old-Growth Towering Spruce", "trees", ["set_pine", "tree", "spruce", "pine", "tall"], 0.90, False),
            ("exp_pine_twin_forest", "Twin Forest Pines Pair", "trees", ["set_pine", "tree", "pine", "pair", "woods"], 0.90, False),
            ("exp_pine_clump_four", "Evergreen Fir Clump", "trees", ["set_pine", "tree", "fir", "pine", "clump"], 0.88, False),
            ("exp_pine_five_cluster", "Dense Five-Pine Thicket", "trees", ["set_pine", "tree", "pine", "thicket", "forest"], 0.88, False),
            ("exp_pine_hillside_group", "Hillside Staggered Pines", "trees", ["set_pine", "tree", "pine", "group", "forest"], 0.88, False),
            ("exp_pine_ragged_mountain", "Ragged Mountain Pine Pair", "trees", ["set_pine", "tree", "pine", "mountain", "pair"], 0.90, False),
        ],
    ),
    (
        "exp_trees_oak_set_1795419109006.jpg", 3, 3,
        [
            ("exp_oak_spreading_grand", "Spreading Ancient Oak", "trees", ["set_oak", "tree", "oak", "deciduous", "broadleaf"], 0.90, False),
            ("exp_oak_slender_elm", "Tall Woodland Elm", "trees", ["set_oak", "tree", "elm", "deciduous", "woods"], 0.90, False),
            ("exp_oak_round_beech", "Round-Crowned Lush Beech", "trees", ["set_oak", "tree", "beech", "oak", "broadleaf"], 0.90, False),
            ("exp_oak_twin_pair", "Twin Woodland Oaks", "trees", ["set_oak", "tree", "oak", "pair", "forest"], 0.90, False),
            ("exp_oak_trio_copse", "Three-Tree Deciduous Copse", "trees", ["set_oak", "tree", "oak", "copse", "woods"], 0.88, False),
            ("exp_oak_five_clump", "Five-Tree Broadleaf Clump", "trees", ["set_oak", "tree", "oak", "forest", "clump"], 0.88, False),
            ("exp_oak_mossy_hollow", "Gnarled Mossy Hollow Oak", "trees", ["set_oak", "tree", "oak", "ancient", "moss"], 0.90, False),
            ("exp_oak_sapling_trio", "Leafy Sapling Trio", "trees", ["set_oak", "tree", "sapling", "oak", "woods"], 0.90, False),
            ("exp_oak_meadow_ash", "Gentle Meadow Ash Tree", "trees", ["set_oak", "tree", "ash", "oak", "meadow"], 0.90, False),
        ],
    ),
    (
        "exp_trees_snow_set_1795419148762.jpg", 3, 3,
        [
            ("exp_snow_heavy_fir", "Snow-Laden Alpine Fir", "trees", ["set_snow_trees", "tree", "snow", "winter", "fir"], 0.90, False),
            ("exp_snow_frost_spruce", "Frost-Tipped Narrow Spruce", "trees", ["set_snow_trees", "tree", "snow", "spruce", "taiga"], 0.90, False),
            ("exp_snow_blizzard_pine", "Blizzard-Bent Winter Pine", "trees", ["set_snow_trees", "tree", "snow", "pine", "arctic"], 0.90, False),
            ("exp_snow_twin_pines", "Twin Snow-Covered Pines", "trees", ["set_snow_trees", "tree", "snow", "pine", "pair"], 0.90, False),
            ("exp_snow_taiga_thicket", "Dense Snowy Taiga Thicket", "trees", ["set_snow_trees", "tree", "snow", "taiga", "forest"], 0.88, False),
            ("exp_snow_winter_birch", "Snow-Dusted Bare Birch Pair", "trees", ["set_snow_trees", "tree", "snow", "birch", "winter"], 0.90, False),
            ("exp_snow_frosted_cedar", "Frosted Windswept Cedar", "trees", ["set_snow_trees", "tree", "snow", "cedar", "alpine"], 0.90, False),
            ("exp_snow_arctic_scrub", "Arctic Snow Scrub Pines", "trees", ["set_snow_trees", "tree", "snow", "arctic", "tundra"], 0.88, False),
            ("exp_snow_triple_spruce", "Frozen Tundra Spruce Trio", "trees", ["set_snow_trees", "tree", "snow", "spruce", "trio"], 0.88, False),
        ],
    ),
    (
        "exp_trees_tropical_set_1795419115400.jpg", 3, 3,
        [
            ("exp_trop_curved_palm", "Curved Coastal Coconut Palm", "trees", ["set_tropical", "tree", "palm", "tropical", "beach"], 0.90, False),
            ("exp_trop_twin_palms", "Leaning Twin Beach Palms", "trees", ["set_tropical", "tree", "palm", "pair", "island"], 0.90, False),
            ("exp_trop_triple_palms", "Triple Island Palm Grove", "trees", ["set_tropical", "tree", "palm", "grove", "tropical"], 0.88, False),
            ("exp_trop_banana_ferns", "Jungle Banana & Fern Clump", "trees", ["set_tropical", "jungle", "fern", "tropical", "flora"], 0.88, False),
            ("exp_trop_rainforest_dome", "Dense Rainforest Canopy", "trees", ["set_tropical", "jungle", "rainforest", "tree", "canopy"], 0.88, False),
            ("exp_trop_banyan_roots", "Wide Banyan Aerial-Root Tree", "trees", ["set_tropical", "banyan", "jungle", "tree", "tropical"], 0.90, False),
            ("exp_trop_mangrove_single", "Stilt-Root Coastal Mangrove", "trees", ["set_tropical", "mangrove", "swamp", "coast", "tree"], 0.90, False),
            ("exp_trop_mangrove_cluster", "Five-Tree Mangrove Swamp", "trees", ["set_tropical", "mangrove", "swamp", "cluster", "jungle"], 0.88, False),
            ("exp_trop_palm_jungle_trio", "Palm & Jungle Undergrowth", "trees", ["set_tropical", "palm", "jungle", "trio", "tropical"], 0.88, False),
        ],
    ),
    (
        "exp_trees_autumn_sakura_set_1795419116777.jpg", 3, 3,
        [
            ("exp_aut_orange_maple", "Burnt-Orange Autumn Maple", "trees", ["set_autumn", "tree", "autumn", "maple", "fall"], 0.90, False),
            ("exp_aut_crimson_oak", "Crimson Fall Oak Tree", "trees", ["set_autumn", "tree", "autumn", "oak", "crimson"], 0.90, False),
            ("exp_aut_golden_birch", "Golden Autumn Birch Pair", "trees", ["set_autumn", "tree", "autumn", "birch", "gold"], 0.90, False),
            ("exp_aut_mixed_copse", "Red-Gold Autumn Copse", "trees", ["set_autumn", "tree", "autumn", "copse", "forest"], 0.88, False),
            ("exp_aut_sakura_single", "Flowering Cherry Blossom", "trees", ["set_autumn", "tree", "sakura", "cherry", "blossom"], 0.90, False),
            ("exp_aut_sakura_twin", "Twin Sakura Blossom Trees", "trees", ["set_autumn", "tree", "sakura", "eastern", "blossom"], 0.90, False),
            ("exp_aut_weeping_willow", "Riverside Weeping Willow", "trees", ["set_autumn", "tree", "willow", "river", "woods"], 0.90, False),
            ("exp_aut_silver_aspen", "Silver-Bark Aspen Trio", "trees", ["set_autumn", "tree", "aspen", "birch", "trio"], 0.90, False),
            ("exp_aut_windswept_gold", "Wind-Swept Golden Hillside Tree", "trees", ["set_autumn", "tree", "autumn", "gold", "hill"], 0.90, False),
        ],
    ),
    (
        "exp_trees_swamp_dead_set_1795419118101.jpg", 3, 3,
        [
            ("exp_dead_gnarled_oak", "Gnarled Twisted Dead Oak", "trees", ["set_deadwood", "tree", "dead", "blight", "haunted"], 0.90, False),
            ("exp_dead_moss_cypress", "Dripping Moss Swamp Cypress", "trees", ["set_deadwood", "tree", "cypress", "swamp", "moss"], 0.90, False),
            ("exp_dead_bleached_snag", "Bleached Bone-White Snag", "trees", ["set_deadwood", "tree", "dead", "snag", "wasteland"], 0.90, False),
            ("exp_dead_charred_trio", "Charred Burnt Forest Trunks", "trees", ["set_deadwood", "tree", "burnt", "charred", "ash"], 0.90, False),
            ("exp_dead_haunted_willow", "Hollow Haunted Swamp Willow", "trees", ["set_deadwood", "tree", "haunted", "willow", "spooky"], 0.90, False),
            ("exp_dead_briar_tree", "Thorny Briar-Wrapped Deadwood", "trees", ["set_deadwood", "tree", "thorns", "briar", "dark"], 0.90, False),
            ("exp_dead_bog_cypress", "Murky Bog Cypress Cluster", "trees", ["set_deadwood", "tree", "swamp", "bog", "cluster"], 0.88, False),
            ("exp_dead_thicket_clump", "Twisted Deadwood Thicket", "trees", ["set_deadwood", "tree", "dead", "thicket", "cursed"], 0.88, False),
            ("exp_dead_lightning_stump", "Lightning-Shattered Stump", "trees", ["set_deadwood", "stump", "dead", "ruined", "tree"], 0.88, False),
        ],
    ),
    (
        "exp_trees_desert_savanna_set_1795419120370.jpg", 3, 3,
        [
            ("exp_des_saguaro_tall", "Tall Branching Saguaro", "trees", ["set_desert_flora", "cactus", "desert", "saguaro", "arid"], 0.90, False),
            ("exp_des_prickly_pear", "Prickly Pear & Desert Rocks", "trees", ["set_desert_flora", "cactus", "desert", "rocks", "scrub"], 0.88, False),
            ("exp_des_joshua_tree", "Gnarled Arid Joshua Tree", "trees", ["set_desert_flora", "tree", "desert", "joshua", "arid"], 0.90, False),
            ("exp_des_sagebrush", "Dry Desert Sagebrush Scrub", "trees", ["set_desert_flora", "scrub", "bush", "desert", "steppe"], 0.86, False),
            ("exp_des_acacia_wide", "Wide Savanna Acacia Tree", "trees", ["set_desert_flora", "tree", "acacia", "savanna", "plains"], 0.90, False),
            ("exp_des_acacia_twin", "Twin Savanna Acacias", "trees", ["set_desert_flora", "tree", "acacia", "pair", "savanna"], 0.90, False),
            ("exp_des_baobab_stout", "Stout Bottle-Trunk Baobab", "trees", ["set_desert_flora", "tree", "baobab", "savanna", "ancient"], 0.90, False),
            ("exp_des_agave_tuft", "Arid Canyon Agave & Grass", "trees", ["set_desert_flora", "agave", "desert", "tuft", "canyon"], 0.86, False),
            ("exp_des_oasis_palms", "Desert Oasis Date-Palm Trio", "trees", ["set_desert_flora", "palm", "oasis", "desert", "trio"], 0.88, False),
        ],
    ),
    (
        "exp_trees_fey_marsh_set_1795419126621.jpg", 3, 3,
        [
            ("exp_fey_red_mushrooms", "Giant Red-Cap Toadstools", "trees", ["set_fey_flora", "mushroom", "fungi", "fey", "red"], 0.88, False),
            ("exp_fey_glow_fungi", "Bioluminescent Teal Fungi Grove", "trees", ["set_fey_flora", "mushroom", "fungi", "glow", "underdark"], 0.88, False),
            ("exp_fey_mossy_log", "Mossy Fallen Shelf-Fungi Log", "trees", ["set_fey_flora", "log", "moss", "fungi", "forest"], 0.84, False),
            ("exp_fey_cattail_reeds", "Marshland Cattail Reeds", "trees", ["set_fey_flora", "reeds", "marsh", "swamp", "cattails"], 0.88, False),
            ("exp_fey_lily_bog_grass", "Swamp Grass & Lily-Pad Tuft", "trees", ["set_fey_flora", "lily", "marsh", "bog", "grass"], 0.84, False),
            ("exp_fey_steppe_grass", "Rolling Steppe Grass Tufts", "trees", ["set_fey_flora", "grass", "plains", "steppe", "tuft"], 0.84, False),
            ("exp_fey_wildflower_patch", "Wildflower Meadow Patch", "trees", ["set_fey_flora", "flowers", "meadow", "grass", "bush"], 0.84, False),
            ("exp_fey_heather_shrub", "Highland Heather Moor Shrub", "trees", ["set_fey_flora", "heather", "moor", "shrub", "highland"], 0.86, False),
            ("exp_fey_crystal_tree", "Crystal-Veined Ancient Fey Tree", "trees", ["set_fey_flora", "fey", "crystal", "magic", "tree"], 0.90, False),
        ],
    ),

    # ── Batch B: 7 Multi-Variant Mountain, Hill, Dune, Volcano, Cliff & Landform Plates (63 New Icons) ──
    (
        "exp_mtns_alpine_set_1795419196785.jpg", 3, 3,
        [
            ("exp_alp_jagged_horn", "Jagged Horn Snow Peak", "mountains", ["set_alpine_peaks", "mountain", "alpine", "snow", "peak"], 0.86, False),
            ("exp_alp_twin_sweep", "Sweeping Twin Alpine Peaks", "mountains", ["set_alpine_peaks", "mountain", "twin", "snow", "peak"], 0.86, False),
            ("exp_alp_triple_massif", "Broad Three-Summit Massif", "mountains", ["set_alpine_peaks", "mountain", "massif", "snow", "range"], 0.86, False),
            ("exp_alp_sawtooth_ridge", "Sawtooth Triple Snow Ridge", "mountains", ["set_alpine_peaks", "mountain", "sawtooth", "ridge", "snow"], 0.86, False),
            ("exp_alp_low_snow_ridge", "Low Snow-Dusted Ridge", "mountains", ["set_alpine_peaks", "mountain", "ridge", "low", "snow"], 0.84, False),
            ("exp_alp_asymmetric_summit", "Wind-Carved Alpine Summit", "mountains", ["set_alpine_peaks", "mountain", "summit", "snow", "peak"], 0.86, False),
            ("exp_alp_high_pass", "High Mountain Pass Twin Horns", "mountains", ["set_alpine_peaks", "mountain", "pass", "twin", "snow"], 0.86, False),
            ("exp_alp_towering_central", "Massive Central Snow Peak", "mountains", ["set_alpine_peaks", "mountain", "tall", "snow", "peak"], 0.88, False),
            ("exp_alp_foothill_spurs", "Snow-Capped Foothill Spurs", "mountains", ["set_alpine_peaks", "mountain", "spur", "foothill", "snow"], 0.84, False),
        ],
    ),
    (
        "exp_mtns_rocky_set_1795419198723.jpg", 3, 3,
        [
            ("exp_rock_granite_dome", "Weathered Granite Dome Peak", "mountains", ["set_rocky_peaks", "mountain", "granite", "rock", "dome"], 0.86, False),
            ("exp_rock_shale_crag", "Jagged Dark Shale Crag", "mountains", ["set_rocky_peaks", "mountain", "shale", "crag", "dark"], 0.86, False),
            ("exp_rock_layered_ridge", "Layered Highland Rock Ridge", "mountains", ["set_rocky_peaks", "mountain", "ridge", "rock", "highland"], 0.84, False),
            ("exp_rock_mossy_ancient", "Eroded Mossy Mountain Peak", "mountains", ["set_rocky_peaks", "mountain", "moss", "eroded", "peak"], 0.86, False),
            ("exp_rock_slate_fangs", "Twin Dark Slate Fangs", "mountains", ["set_rocky_peaks", "mountain", "slate", "fang", "dark"], 0.88, False),
            ("exp_rock_ironspine_range", "Craggy Triple Ironspine Range", "mountains", ["set_rocky_peaks", "mountain", "ironspine", "range", "crag"], 0.86, False),
            ("exp_rock_boulder_massif", "Boulder-Strewn Rocky Massif", "mountains", ["set_rocky_peaks", "mountain", "massif", "boulder", "rock"], 0.86, False),
            ("exp_rock_canyon_peak", "Weathered Canyon Stone Peak", "mountains", ["set_rocky_peaks", "mountain", "canyon", "arid", "rock"], 0.86, False),
            ("exp_rock_solitary_spire", "Solitary Jagged Rock Spire", "mountains", ["set_rocky_peaks", "mountain", "spire", "rock", "peak"], 0.88, False),
        ],
    ),
    (
        "exp_mtns_hills_set_1795419230669.jpg", 3, 3,
        [
            ("exp_hill_gentle_knoll", "Gentle Single Meadow Knoll", "mountains", ["set_hills", "hill", "knoll", "meadow", "grass"], 0.84, False),
            ("exp_hill_wide_smooth", "Wide Smooth Grassy Hill", "mountains", ["set_hills", "hill", "wide", "grass", "downs"], 0.84, False),
            ("exp_hill_paired_rolling", "Paired Rolling Green Hills", "mountains", ["set_hills", "hill", "pair", "rolling", "grass"], 0.84, False),
            ("exp_hill_four_downs", "Clustered Four-Mound Downs", "mountains", ["set_hills", "hill", "downs", "cluster", "meadow"], 0.84, False),
            ("exp_hill_rocky_highland", "Rocky-Topped Highland Hill", "mountains", ["set_hills", "hill", "rocky", "highland", "crag"], 0.84, False),
            ("exp_hill_wooded_foothills", "Wooded Rolling Foothills", "mountains", ["set_hills", "hill", "foothills", "wooded", "trees"], 0.84, False),
            ("exp_hill_burial_barrow", "Ancient Stone Barrow Mound", "mountains", ["set_hills", "hill", "barrow", "tomb", "mound"], 0.84, False),
            ("exp_hill_terraced_slope", "Stepped Terraced Hillside", "mountains", ["set_hills", "hill", "terrace", "slope", "green"], 0.84, False),
            ("exp_hill_moorland_rise", "Sweeping Moorland Ridge", "mountains", ["set_hills", "hill", "moor", "ridge", "heather"], 0.84, False),
        ],
    ),
    (
        "exp_mtns_desert_dunes_set_1795419202981.jpg", 3, 3,
        [
            ("exp_dune_crescent", "Sweeping Crescent Sand Dune", "mountains", ["set_desert_dunes", "dune", "sand", "desert", "erg"], 0.82, False),
            ("exp_dune_triple_field", "Layered Triple Sand Dunes", "mountains", ["set_desert_dunes", "dune", "sand", "desert", "field"], 0.82, False),
            ("exp_dune_wind_ridge", "Wind-Rippled Sand Ridge", "mountains", ["set_desert_dunes", "dune", "ridge", "desert", "sand"], 0.82, False),
            ("exp_dune_wide_mesa", "Wide Flat-Topped Red Mesa", "mountains", ["set_desert_dunes", "mesa", "red", "desert", "plateau"], 0.86, False),
            ("exp_dune_twin_buttes", "Twin Terracotta Desert Buttes", "mountains", ["set_desert_dunes", "butte", "mesa", "desert", "twin"], 0.86, False),
            ("exp_dune_stone_arch", "Carved Red-Rock Desert Arch", "mountains", ["set_desert_dunes", "arch", "canyon", "desert", "rock"], 0.88, False),
            ("exp_dune_spire_hoodoo", "Tall Sandstone Canyon Hoodoo", "mountains", ["set_desert_dunes", "hoodoo", "spire", "canyon", "desert"], 0.88, False),
            ("exp_dune_canyon_cliff", "Cracked Canyon Escarpment", "mountains", ["set_desert_dunes", "cliff", "canyon", "desert", "escarpment"], 0.86, False),
            ("exp_dune_rock_outcrop", "Sun-Baked Desert Outcrop", "mountains", ["set_desert_dunes", "rocks", "outcrop", "desert", "badlands"], 0.84, False),
        ],
    ),
    (
        "exp_mtns_volcanic_set_1795419205705.jpg", 3, 3,
        [
            ("exp_volc_erupting_plume", "Erupting Ash-Plume Volcano", "mountains", ["set_volcanic", "volcano", "erupting", "lava", "ash"], 0.88, False),
            ("exp_volc_magma_caldera", "Glowing Magma Caldera Crater", "mountains", ["set_volcanic", "caldera", "lava", "volcano", "crater"], 0.84, False),
            ("exp_volc_obsidian_fang", "Jagged Obsidian Fang Peak", "mountains", ["set_volcanic", "obsidian", "spire", "dark", "mountain"], 0.88, False),
            ("exp_volc_fumarole_vents", "Smoking Fumarole Rock Vents", "mountains", ["set_volcanic", "vents", "smoke", "volcanic", "geothermal"], 0.86, False),
            ("exp_volc_basalt_plateau", "Cracked Basalt Lava Plateau", "mountains", ["set_volcanic", "basalt", "plateau", "volcanic", "cliff"], 0.86, False),
            ("exp_volc_twin_spires", "Twin Black Volcanic Spires", "mountains", ["set_volcanic", "obsidian", "spires", "twin", "volcanic"], 0.88, False),
            ("exp_volc_geyser_mound", "Steaming Hot-Spring Geyser", "mountains", ["set_volcanic", "geyser", "steam", "geothermal", "spring"], 0.88, False),
            ("exp_volc_lava_ridge", "Cooled Lava-Flow Ridge", "mountains", ["set_volcanic", "lava", "ridge", "volcanic", "obsidian"], 0.86, False),
            ("exp_volc_sulfur_pit", "Sulfur-Rimmed Volcanic Pit", "mountains", ["set_volcanic", "sulfur", "crater", "volcano", "hazard"], 0.84, False),
        ],
    ),
    (
        "exp_cliffs_canyons_set_1795419207062.jpg", 3, 3,
        [
            ("exp_cliff_coast_left", "Sheer Coastal Cliff (Left)", "mountains", ["set_cliffs", "cliff", "coast", "rock", "bluff"], 0.86, False),
            ("exp_cliff_coast_right", "Sheer Coastal Cliff (Right)", "mountains", ["set_cliffs", "cliff", "coast", "rock", "bluff"], 0.86, False),
            ("exp_cliff_inland_wall", "Curved Inland Stone Cliff Wall", "mountains", ["set_cliffs", "cliff", "wall", "escarpment", "plateau"], 0.86, False),
            ("exp_cliff_canyon_gorge", "Stepped Canyon Gorge Ravine", "mountains", ["set_cliffs", "canyon", "gorge", "ravine", "cliff"], 0.86, False),
            ("exp_cliff_waterfall_single", "Cascading Mountain Waterfall", "mountains", ["set_cliffs", "waterfall", "cliff", "river", "cascade"], 0.88, False),
            ("exp_cliff_waterfall_twin", "Twin Terraced Cliff Waterfalls", "mountains", ["set_cliffs", "waterfall", "twin", "cliff", "cascade"], 0.88, False),
            ("exp_cliff_abyssal_chasm", "Jagged Abyssal Earth Chasm", "mountains", ["set_cliffs", "chasm", "rift", "fissure", "canyon"], 0.72, False),
            ("exp_cliff_glacial_wall", "Towering Glacial Ice Cliff", "mountains", ["set_cliffs", "glacier", "ice", "cliff", "arctic"], 0.86, False),
            ("exp_cliff_highland_ledge", "Stepped Highland Rock Ledge", "mountains", ["set_cliffs", "ledge", "cliff", "highland", "escarpment"], 0.86, False),
        ],
    ),
    (
        "exp_terrain_features_set_1795419207315.jpg", 3, 3,
        [
            ("exp_feat_desert_oasis", "Turquoise Desert Palm Oasis", "landmarks", ["set_terrain_features", "oasis", "desert", "water", "palm"], 0.80, False),
            ("exp_feat_swamp_bog", "Bubbling Swamp Bog Pool", "landmarks", ["set_terrain_features", "swamp", "bog", "marsh", "pool"], 0.78, False),
            ("exp_feat_rice_terraces", "Stepped Hillside Rice Paddies", "landmarks", ["set_terrain_features", "farm", "terraces", "rice", "eastern"], 0.82, False),
            ("exp_feat_wheat_fields", "Patchwork Golden Wheat Fields", "landmarks", ["set_terrain_features", "farm", "wheat", "fields", "rural"], 0.78, False),
            ("exp_feat_fruit_orchard", "Neat Countryside Fruit Orchard", "landmarks", ["set_terrain_features", "orchard", "farm", "trees", "rural"], 0.82, False),
            ("exp_feat_alpine_glacier", "Cracked Alpine Glacier Icefield", "mountains", ["set_terrain_features", "glacier", "ice", "arctic", "tundra"], 0.80, False),
            ("exp_feat_stone_quarry", "Open-Pit Stepped Stone Quarry", "landmarks", ["set_terrain_features", "quarry", "mine", "stone", "industry"], 0.82, False),
            ("exp_feat_natural_bridge", "Massive Natural Rock Bridge", "mountains", ["set_terrain_features", "bridge", "arch", "rock", "canyon"], 0.86, False),
            ("exp_feat_leyline_spring", "Glowing Arcane Ley-Line Spring", "landmarks", ["set_terrain_features", "leyline", "magic", "spring", "arcane"], 0.82, False),
        ],
    ),

    # ── Batch C: 5 Settlement, Cultural City, Dark Stronghold & Epic POI Plates (45 New Icons) ──
    (
        "exp_settle_medieval_set_1795419275716.jpg", 3, 3,
        [
            ("exp_med_barn_farmstead", "Timber Barn & Silo Farmstead", "settlements", ["set_medieval_towns", "farm", "barn", "silo", "rural"], 0.86, False),
            ("exp_med_walled_abbey", "Walled Stone Abbey Monastery", "settlements", ["set_medieval_towns", "abbey", "monastery", "church", "walled"], 0.88, False),
            ("exp_med_star_citadel", "Star-Shaped Stone Citadel", "settlements", ["set_medieval_towns", "citadel", "fortress", "bastion", "star"], 0.86, False),
            ("exp_med_hilltop_keep", "Hilltop Pennant Castle Keep", "settlements", ["set_medieval_towns", "castle", "keep", "fortress", "hill"], 0.90, False),
            ("exp_med_covered_bridge", "Covered Timber River Bridge", "settlements", ["set_medieval_towns", "bridge", "wood", "river", "crossing"], 0.84, False),
            ("exp_med_lumber_sawmill", "Timber Lumber Camp & Sawmill", "settlements", ["set_medieval_towns", "lumber", "sawmill", "wood", "camp"], 0.86, False),
            ("exp_med_road_tollgate", "Fortified Road Tollgate Arch", "settlements", ["set_medieval_towns", "gate", "toll", "arch", "road"], 0.88, False),
            ("exp_med_fishing_village", "Coastal Fishing Pier Village", "settlements", ["set_medieval_towns", "fishing", "village", "pier", "coast"], 0.86, False),
            ("exp_med_market_tents", "Medieval Market Tent Square", "settlements", ["set_medieval_towns", "market", "bazaar", "tents", "town"], 0.86, False),
        ],
    ),
    (
        "exp_settle_fantasy_cultures_set_1795419276160.jpg", 3, 3,
        [
            ("exp_fan_elven_palace", "Gilded High-Elven Dome Palace", "settlements", ["set_fantasy_cities", "elven", "palace", "marble", "city"], 0.90, False),
            ("exp_fan_elven_harbor", "White-Stone Elven Swan Harbor", "settlements", ["set_fantasy_cities", "elven", "harbor", "port", "swan"], 0.88, False),
            ("exp_fan_dwarven_hall", "Carved Dwarven Hall Archway", "settlements", ["set_fantasy_cities", "dwarven", "hall", "mountain", "gate"], 0.90, False),
            ("exp_fan_dwarven_dam", "Monumental Dwarven Stone Dam", "settlements", ["set_fantasy_cities", "dwarven", "dam", "aqueduct", "river"], 0.88, False),
            ("exp_fan_halfling_burrows", "Halfling Green-Hill Burrows", "settlements", ["set_fantasy_cities", "halfling", "shire", "village", "hill"], 0.86, False),
            ("exp_fan_gnome_clockwork", "Gnome Clockwork Windmill Tower", "settlements", ["set_fantasy_cities", "gnome", "clockwork", "tower", "steampunk"], 0.90, False),
            ("exp_fan_fey_tree_citadel", "Fey Living-Tree Crystal Citadel", "settlements", ["set_fantasy_cities", "fey", "tree", "crystal", "citadel"], 0.90, False),
            ("exp_fan_sky_island_citadel", "Floating Cloud-Giant Sky Citadel", "settlements", ["set_fantasy_cities", "floating", "sky", "island", "citadel"], 0.72, False),
            ("exp_fan_dragonborn_fort", "Dragonborn Cliffside Bastion", "settlements", ["set_fantasy_cities", "dragonborn", "fortress", "cliff", "bastion"], 0.90, False),
        ],
    ),
    (
        "exp_settle_global_cultures_set_1795419278243.jpg", 3, 3,
        [
            ("exp_glob_yurt_camp", "Steppe Nomadic Yurt Camp", "settlements", ["set_world_cities", "yurt", "nomad", "steppe", "camp"], 0.84, False),
            ("exp_glob_eastern_castle", "Eastern Tiered Imperial Castle", "settlements", ["set_world_cities", "eastern", "castle", "pagoda", "fortress"], 0.90, False),
            ("exp_glob_stilt_village", "Bamboo Stilt Fishing Village", "settlements", ["set_world_cities", "bamboo", "stilt", "village", "tropical"], 0.86, False),
            ("exp_glob_jungle_pyramid", "Jungle Stepped Stone Pyramid", "settlements", ["set_world_cities", "pyramid", "jungle", "temple", "ancient"], 0.88, False),
            ("exp_glob_nordic_hillfort", "Nordic Palisade Mead-Hall Fort", "settlements", ["set_world_cities", "nordic", "viking", "fort", "palisade"], 0.88, False),
            ("exp_glob_caravanserai", "Sandstone Desert Caravanserai", "settlements", ["set_world_cities", "desert", "caravanserai", "fort", "trade"], 0.86, False),
            ("exp_glob_gothic_chateau", "Gothic Vampire Mountain Chateau", "settlements", ["set_world_cities", "gothic", "vampire", "castle", "spires"], 0.90, False),
            ("exp_glob_steampunk_foundry", "Magi-Punk Brass Foundry City", "settlements", ["set_world_cities", "steampunk", "magipunk", "foundry", "city"], 0.88, False),
            ("exp_glob_airship_dock", "Brass Airship Mooring Sky-Dock", "settlements", ["set_world_cities", "airship", "dock", "tower", "steampunk"], 0.90, False),
        ],
    ),
    (
        "exp_settle_dark_evil_set_1795419279704.jpg", 3, 3,
        [
            ("exp_dark_obsidian_citadel", "Black Obsidian Dark Citadel", "settlements", ["set_dark_forts", "dark", "obsidian", "citadel", "evil"], 0.90, False),
            ("exp_dark_skull_lair", "Skull-Carved Mountain Lair", "landmarks", ["set_dark_forts", "skull", "lair", "cave", "evil"], 0.88, False),
            ("exp_dark_bone_spire", "Necromancer Bone-Spire Tower", "settlements", ["set_dark_forts", "necromancer", "bone", "tower", "undead"], 0.92, False),
            ("exp_dark_haunted_graveyard", "Gothic Haunted Graveyard Crypts", "landmarks", ["set_dark_forts", "graveyard", "cemetery", "crypt", "undead"], 0.86, False),
            ("exp_dark_orc_siege_fort", "Spiked Orcish Siege Fortress", "settlements", ["set_dark_forts", "orc", "fortress", "spiked", "siege"], 0.88, False),
            ("exp_dark_goblin_shanty", "Goblin Canyon Shanty Camp", "settlements", ["set_dark_forts", "goblin", "camp", "canyon", "shanty"], 0.88, False),
            ("exp_dark_swamp_keep", "Cursed Sunken Swamp Keep", "settlements", ["set_dark_forts", "swamp", "cursed", "keep", "ruin"], 0.88, False),
            ("exp_dark_crimson_rift_fort", "Demonic Crimson-Rift Fortress", "settlements", ["set_dark_forts", "demon", "rift", "fortress", "volcanic"], 0.90, False),
            ("exp_dark_island_prison", "Iron-Barred Rock Island Prison", "settlements", ["set_dark_forts", "prison", "island", "tower", "fort"], 0.90, False),
        ],
    ),
    (
        "exp_landmarks_pois_set_1795419298302.jpg", 3, 3,
        [
            ("exp_poi_harbor_colossus", "Colossal Bronze Harbor Statue", "landmarks", ["set_landmarks", "colossus", "statue", "harbor", "monument"], 0.90, False),
            ("exp_poi_ruined_colosseum", "Ruined Stone Arena Colosseum", "landmarks", ["set_landmarks", "colosseum", "arena", "ruins", "ancient"], 0.86, False),
            ("exp_poi_stonehenge_ring", "Trilithon Stonehenge Ring", "landmarks", ["set_landmarks", "stonehenge", "druid", "circle", "monolith"], 0.86, False),
            ("exp_poi_floating_orb_tower", "Levitating Wizard Orb Sanctuary", "landmarks", ["set_landmarks", "wizard", "orb", "floating", "arcane"], 0.90, False),
            ("exp_poi_dragon_graveyard", "Bleached Dragon Bone Graveyard", "landmarks", ["set_landmarks", "dragon", "skeleton", "bones", "graveyard"], 0.84, False),
            ("exp_poi_titan_sword", "Buried Giant Titan Sword", "landmarks", ["set_landmarks", "sword", "titan", "monument", "ancient"], 0.90, False),
            ("exp_poi_cliff_monastery", "Mountain Monastery Staircase", "landmarks", ["set_landmarks", "monastery", "stairs", "cliff", "temple"], 0.88, False),
            ("exp_poi_bandit_tower", "Wooden Bandit Ambush Tower", "landmarks", ["set_landmarks", "bandit", "tower", "ambush", "road"], 0.90, False),
            ("exp_poi_crater_ruin_city", "Shattered Crater Ruin City", "landmarks", ["set_landmarks", "crater", "ruins", "city", "cataclysm"], 0.84, False),
        ],
    ),

    # ── Batch D: 6 Maritime, Beasts, Compasses, Scrolls & Heraldry Plates (54 New Icons) ──
    (
        "exp_maritime_fleets_set_1795419350976.jpg", 3, 3,
        [
            ("exp_ship_man_of_war", "Triple-Deck Man-of-War Flagship", "maritime", ["set_ships", "ship", "warship", "flagship", "navy"], 0.84, False),
            ("exp_ship_swift_schooner", "Swift Two-Mast Schooner", "maritime", ["set_ships", "ship", "schooner", "sail", "fast"], 0.84, False),
            ("exp_ship_merchant_cog", "Medieval Square-Sail Cog", "maritime", ["set_ships", "ship", "cog", "merchant", "trade"], 0.84, False),
            ("exp_ship_desert_dhow", "Lateen-Sail Desert Dhow", "maritime", ["set_ships", "ship", "dhow", "desert", "sail"], 0.84, False),
            ("exp_ship_elven_swan", "Elven White Swan-Prow Galley", "maritime", ["set_ships", "ship", "elven", "swan", "galley"], 0.84, False),
            ("exp_ship_dwarf_ironclad", "Dwarven Ironclad Paddle-Steamer", "maritime", ["set_ships", "ship", "dwarven", "ironclad", "steam"], 0.84, False),
            ("exp_ship_ghost_vessel", "Eerie Tattered-Sail Ghost Ship", "maritime", ["set_ships", "ship", "ghost", "undead", "pirate"], 0.84, False),
            ("exp_ship_sky_galleon", "Ornate Passenger Sky-Galleon", "maritime", ["set_ships", "airship", "galleon", "skyship", "steampunk"], 0.58, False),
            ("exp_ship_scout_balloon", "Scouting Hot-Air Balloon", "maritime", ["set_ships", "balloon", "airship", "sky", "scout"], 0.65, False),
        ],
    ),
    (
        "exp_maritime_hazards_set_1795419351186.jpg", 3, 3,
        [
            ("exp_sea_horned_leviathan", "Coiled Horned Leviathan", "maritime", ["set_sea_hazards", "leviathan", "serpent", "monster", "ocean"], 0.78, False),
            ("exp_sea_winged_dragon", "Breaching Winged Sea-Dragon", "maritime", ["set_sea_hazards", "dragon", "sea", "monster", "ocean"], 0.78, False),
            ("exp_sea_siren_mermaid", "Mermaid on Siren Shoals", "maritime", ["set_sea_hazards", "mermaid", "siren", "shoals", "coast"], 0.84, False),
            ("exp_sea_narwhal_pair", "Spouting Arctic Narwhal Pair", "maritime", ["set_sea_hazards", "narwhal", "whale", "arctic", "wildlife"], 0.75, False),
            ("exp_sea_giant_crab", "Giant Armored Ocean Crab", "maritime", ["set_sea_hazards", "crab", "monster", "sea", "coast"], 0.80, False),
            ("exp_sea_stacks_cluster", "Jagged Coastal Sea-Stacks", "maritime", ["set_sea_hazards", "rocks", "stacks", "coast", "hazard"], 0.86, False),
            ("exp_sea_treacherous_reef", "Treacherous Rocky Coral Reef", "maritime", ["set_sea_hazards", "reef", "rocks", "hazard", "shoals"], 0.78, False),
            ("exp_sea_harbor_bell_buoy", "Weathered Harbor Bell-Buoy", "maritime", ["set_sea_hazards", "buoy", "bell", "harbor", "nautical"], 0.84, False),
            ("exp_sea_storm_squall", "Ocean Storm Squall & Lightning", "maritime", ["set_sea_hazards", "storm", "lightning", "weather", "hazard"], 0.65, False),
        ],
    ),
    (
        "exp_fauna_beasts_set_1795419353066.jpg", 3, 3,
        [
            ("exp_beast_griffin", "Soaring Heraldic Griffin", "landmarks", ["set_beasts", "griffin", "beast", "monster", "heraldry"], 0.72, False),
            ("exp_beast_wyvern", "Perched Mountain Wyvern", "landmarks", ["set_beasts", "wyvern", "dragon", "mountain", "monster"], 0.86, False),
            ("exp_beast_giant_roc", "Giant Diving Roc Bird", "landmarks", ["set_beasts", "roc", "eagle", "bird", "monster"], 0.68, False),
            ("exp_beast_mammoths", "Tundra Wooly Mammoth Pair", "landmarks", ["set_beasts", "mammoth", "tundra", "arctic", "wildlife"], 0.86, False),
            ("exp_beast_sandworm", "Colossal Desert Sandworm", "landmarks", ["set_beasts", "sandworm", "desert", "monster", "hazard"], 0.86, False),
            ("exp_beast_forest_stag", "Noble Antlered Forest Stag", "landmarks", ["set_beasts", "stag", "deer", "forest", "wildlife"], 0.88, False),
            ("exp_beast_wolf_pack", "Howling Highland Wolf Pair", "landmarks", ["set_beasts", "wolf", "pack", "highland", "wildlife"], 0.88, False),
            ("exp_beast_phoenix", "Blazing Rising Phoenix", "landmarks", ["set_beasts", "phoenix", "fire", "magic", "beast"], 0.78, False),
            ("exp_beast_treant", "Ancient Mossy Woodland Treant", "landmarks", ["set_beasts", "treant", "ent", "forest", "monster"], 0.90, False),
        ],
    ),
    (
        "exp_carto_compass_frames_set_1795419356066.jpg", 3, 3,
        [
            ("exp_comp_gothic_iron", "Gothic Iron 8-Point Compass", "cartography", ["set_compasses", "compass", "gothic", "iron", "north"], 0.50, True),
            ("exp_comp_brass_sextant", "Brass Compass & Crossed Sextant", "cartography", ["set_compasses", "compass", "sextant", "nautical", "brass"], 0.50, True),
            ("exp_comp_astrolabe", "Celestial Armillary Astrolabe", "cartography", ["set_compasses", "astrolabe", "celestial", "brass", "ornament"], 0.50, True),
            ("exp_comp_north_pointer", "Engraved Antique North Pointer", "cartography", ["set_compasses", "north", "arrow", "pointer", "minimal"], 0.50, True),
            ("exp_comp_sun_face", "Vintage Golden Sun-Face Emblem", "cartography", ["set_compasses", "sun", "celestial", "medallion", "ornament"], 0.50, True),
            ("exp_comp_crescent_moon", "Crescent Moon & Stars Medallion", "cartography", ["set_compasses", "moon", "stars", "night", "celestial"], 0.50, True),
            ("exp_comp_wind_cherub", "Antique Map Wind-Blower Cherub", "cartography", ["set_compasses", "wind", "cherub", "nautical", "ornament"], 0.50, False),
            ("exp_comp_hourglass", "Antique Brass Sand Hourglass", "cartography", ["set_compasses", "hourglass", "time", "brass", "ornament"], 0.50, True),
            ("exp_comp_quill_spyglass", "Crossed Quill & Brass Spyglass", "cartography", ["set_compasses", "quill", "spyglass", "cartographer", "ornament"], 0.50, True),
        ],
    ),
    (
        "exp_carto_banners_scrolls_set_1795419357705.jpg", 3, 3,
        [
            ("exp_ban_arched_ribbon", "Arched Curved Parchment Ribbon", "cartography", ["set_banners", "banner", "ribbon", "scroll", "title"], 0.50, False),
            ("exp_ban_twintail_scroll", "Twin-Tail Heraldic Scroll Banner", "cartography", ["set_banners", "banner", "scroll", "heraldry", "title"], 0.50, False),
            ("exp_ban_wooden_signboard", "Hanging Wooden Signboard Plaque", "cartography", ["set_banners", "sign", "wood", "plaque", "title"], 0.50, False),
            ("exp_ban_deckled_strip", "Deckled Antique Parchment Strip", "cartography", ["set_banners", "parchment", "strip", "title", "scroll"], 0.50, False),
            ("exp_ban_laurel_cartouche", "Laurel-Wreath Oval Cartouche", "cartography", ["set_banners", "cartouche", "laurel", "frame", "title"], 0.50, True),
            ("exp_ban_rope_title_box", "Nautical Rope-Framed Title Box", "cartography", ["set_banners", "rope", "nautical", "box", "title"], 0.50, False),
            ("exp_ban_stone_tablet", "Chiseled Stone Monument Tablet", "cartography", ["set_banners", "stone", "tablet", "plaque", "title"], 0.50, False),
            ("exp_ban_gothic_banner", "Gothic Iron-Studded Banner Frame", "cartography", ["set_banners", "gothic", "iron", "banner", "frame"], 0.50, False),
            ("exp_ban_wax_seal_scroll", "Royal Wax-Sealed Title Scroll", "cartography", ["set_banners", "scroll", "wax", "royal", "title"], 0.50, False),
        ],
    ),
    (
        "exp_carto_heraldry_pins_set_1795419373329.jpg", 3, 3,
        [
            ("exp_her_lion_flag", "Crimson Royal Lion Banner Flag", "cartography", ["set_heraldry", "flag", "banner", "lion", "faction"], 0.92, False),
            ("exp_her_eagle_pennant", "Azure Silver Eagle Pennant", "cartography", ["set_heraldry", "flag", "pennant", "eagle", "faction"], 0.92, False),
            ("exp_her_stag_shield", "Emerald Golden Stag Shield", "cartography", ["set_heraldry", "shield", "stag", "heraldry", "faction"], 0.50, False),
            ("exp_her_sunburst_crest", "Gold Sunburst Imperial Crest", "cartography", ["set_heraldry", "shield", "sun", "imperial", "crest"], 0.50, False),
            ("exp_her_crossed_swords", "Crossed Swords Battle Marker", "cartography", ["set_heraldry", "swords", "battle", "war", "marker"], 0.50, False),
            ("exp_her_siege_war_camp", "Military Siege War Tent Camp", "cartography", ["set_heraldry", "camp", "army", "siege", "tents"], 0.86, False),
            ("exp_her_coin_trade_pin", "Gold Coin Pouch Trade Pin", "cartography", ["set_heraldry", "trade", "gold", "coin", "marker"], 0.50, False),
            ("exp_her_arcane_hat_pin", "Wizard Hat & Star Arcane Pin", "cartography", ["set_heraldry", "wizard", "magic", "arcane", "marker"], 0.50, False),
            ("exp_her_tavern_tankard", "Tavern Tankard Waystation Pin", "cartography", ["set_heraldry", "tavern", "inn", "waystation", "marker"], 0.50, False),
        ],
    ),
    # --- Tro'fraderra & Regional Atlas Clean-Room Master Expansion (+108 assets -> ~1,398 total!) ---
    (
        "exp_clouds_sky_set_1795420696075.jpg", 3, 3,
        [
            ("exp_cld_ivory_cumulus", "Billowing Ivory Cumulus Cloud Bank", "cartography", ["set_clouds", "cloud", "sky", "cumulus", "currents"], 0.65, False),
            ("exp_cld_golden_ribbon", "Golden Sunlit Trade-Wind Cloud Ribbon", "cartography", ["set_clouds", "cloud", "sky", "wind", "currents"], 0.65, False),
            ("exp_cld_lavender_puff", "Compact Cream & Lavender Cloud Puff", "cartography", ["set_clouds", "cloud", "sky", "puff", "currents"], 0.65, False),
            ("exp_cld_storm_cluster", "Broad Slate-Blue Storm Cloud Cluster", "cartography", ["set_clouds", "cloud", "storm", "weather", "currents"], 0.65, False),
            ("exp_cld_ring_forest_isle", "Cloud-Wreathed Floating Forest Island", "landmarks", ["set_clouds", "cloud", "sky_island", "floating", "forest"], 0.55, False),
            ("exp_cld_floating_peak_isle", "Floating Mountain Sky-Isle on Clouds", "landmarks", ["set_clouds", "cloud", "sky_island", "floating", "mountain"], 0.65, False),
            ("exp_cld_ochre_trade_cloud", "Warm Ochre Trade-Wind Cloud Bank", "cartography", ["set_clouds", "cloud", "ochre", "amber", "currents"], 0.65, False),
            ("exp_cld_mist_wisp_bank", "Swirling Misty Cartographic Cloud Bank", "cartography", ["set_clouds", "cloud", "mist", "fog", "currents"], 0.60, False),
            ("exp_cld_thunderhead_pillar", "Tall Stacked Thunderhead Cloud Pillar", "cartography", ["set_clouds", "cloud", "thunderhead", "tower", "currents"], 0.78, False),
        ],
    ),
    (
        "exp_steppe_hills_detail_set_1795420699259.jpg", 3, 3,
        [
            ("exp_stp_single_ridge", "Minimalist Steppe Ridge Hump", "mountains", ["set_hills", "hill", "ridge", "steppe", "minimal"], 0.85, False),
            ("exp_stp_triple_ridges", "Trio of Low Olive Rolling Ridges", "mountains", ["set_hills", "hill", "ridge", "rolling", "plains"], 0.85, False),
            ("exp_stp_grass_tufts", "Sparse Steppe Grass & Scrub Tufts", "trees", ["set_terrain_features", "grass", "scrub", "steppe", "plains"], 0.75, True),
            ("exp_stp_shadow_pines", "Dense Dark Shadow-Pine Taiga Clump", "trees", ["set_pine", "pine", "dark", "shadow", "taiga", "forest"], 0.90, False),
            ("exp_stp_arcane_grove", "Glowing Amethyst Arcane Woodland Grove", "trees", ["set_fey_flora", "arcane", "purple", "violet", "magic", "forest"], 0.88, False),
            ("exp_stp_glacial_caldera", "Snow-Ringed Glacial Mountain Spire", "mountains", ["set_alpine_peaks", "glacier", "snow", "ice", "peak"], 0.88, False),
            ("exp_stp_blue_sea_crags", "Jagged Steel-Blue Sea Spire Crags", "mountains", ["set_cliffs", "crag", "blue", "sea_stack", "jagged", "mountain"], 0.90, False),
            ("exp_stp_shadow_fangs", "Twin Frost-Faced Coastal Mountain Fangs", "mountains", ["set_cliffs", "crag", "coastal", "jagged", "fangs"], 0.90, False),
            ("exp_stp_misty_tarn", "Sunken Mossy Swamp Tarn & Reeds", "trees", ["set_deadwood", "swamp", "marsh", "tarn", "reeds"], 0.75, False),
        ],
    ),
    (
        "exp_engraved_beasts_compass_set_1795420698540.jpg", 3, 3,
        [
            ("exp_eng_leviathan_ship", "Engraved Leviathan Coiling Galleon", "maritime", ["set_sea_hazards", "leviathan", "serpent", "ship", "engraved"], 0.78, True),
            ("exp_eng_sea_plesiosaur", "Engraved Swan-Necked Sea Serpent", "maritime", ["set_sea_hazards", "serpent", "plesiosaur", "ocean", "engraved"], 0.75, True),
            ("exp_eng_frost_sea_giant", "Engraved Northern Frost Sea-Colossus", "maritime", ["set_sea_hazards", "giant", "colossus", "northern", "engraved"], 0.85, True),
            ("exp_eng_mourning_rings", "Concentric Sea-Ring Reef Vortex", "maritime", ["set_sea_hazards", "vortex", "rings", "atoll", "whirlpool"], 0.50, True),
            ("exp_eng_starburst_compass", "Ivory 16-Point Starburst Compass Rose", "cartography", ["set_compasses", "compass", "starburst", "north", "rose"], 0.50, False),
            ("exp_eng_portolan_windrose", "Engraved Portolan 8-Point Windrose", "cartography", ["set_compasses", "compass", "portolan", "engraved", "rose"], 0.50, True),
            ("exp_eng_baroque_whale", "Engraved Spouting Baroque Great Whale", "maritime", ["set_sea_hazards", "whale", "ocean", "engraved", "beast"], 0.72, True),
            ("exp_eng_twin_sea_dragons", "Engraved Twin Sea-Dragons & Caravel", "maritime", ["set_sea_hazards", "dragon", "serpent", "ship", "engraved"], 0.78, True),
            ("exp_eng_abyssal_maelstrom", "Engraved Abyssal Ocean Maelstrom Pit", "maritime", ["set_sea_hazards", "maelstrom", "abyss", "vortex", "engraved"], 0.55, True),
        ],
    ),
    (
        "exp_arcane_settlements_set_1795420702167.jpg", 3, 3,
        [
            ("exp_arc_violet_citadel", "Amethyst-Spire Arcane Elven Citadel", "settlements", ["set_fantasy_cities", "arcane", "violet", "elven", "citadel"], 0.88, False),
            ("exp_arc_crystal_sanctuary", "Ruined Violet Crystal Woodland Spire", "landmarks", ["set_landmarks", "arcane", "crystal", "ruin", "violet"], 0.88, False),
            ("exp_arc_cathedral_capital", "Walled Cathedral Capital City", "settlements", ["set_medieval_towns", "capital", "city", "cathedral", "walled"], 0.88, False),
            ("exp_arc_harbor_port", "Fortified Breakwater Harbor Port City", "settlements", ["set_medieval_towns", "port", "harbor", "lighthouse", "city"], 0.85, False),
            ("exp_arc_stone_viaduct", "Ancient Multi-Arch Stone Viaduct", "landmarks", ["set_landmarks", "bridge", "viaduct", "arch", "monument"], 0.85, False),
            ("exp_arc_hill_keep_town", "Medieval Hill-Town & Stone Keep", "settlements", ["set_medieval_towns", "town", "keep", "hill", "village"], 0.88, False),
            ("exp_arc_frost_citadel", "Snow-Bound Mountain Crag Citadel", "settlements", ["set_fantasy_cities", "frost", "snow", "mountain", "citadel"], 0.88, False),
            ("exp_arc_golden_palace", "Domed Golden Eastern Palace City", "settlements", ["set_world_cities", "palace", "dome", "golden", "eastern"], 0.88, False),
            ("exp_arc_mini_hamlet", "Miniature Regional Village Hamlet", "settlements", ["set_medieval_towns", "hamlet", "village", "mini", "cottages"], 0.88, False),
        ],
    ),
    (
        "exp_micro_towns_markers_set_1795422373799.jpg", 3, 3,
        [
            ("exp_mic_crossroads_village", "Tiny Crossroads Village & Inn", "settlements", ["set_medieval_towns", "village", "hamlet", "inn", "mini"], 0.88, False),
            ("exp_mic_palisade_tower", "Compact Palisade Watchtower Keep", "settlements", ["set_medieval_towns", "tower", "keep", "palisade", "mini"], 0.88, False),
            ("exp_mic_red_walled_town", "Small Walled Red-Roofed Town", "settlements", ["set_medieval_towns", "town", "walled", "red_roof", "mini"], 0.88, False),
            ("exp_mic_cove_jetty", "Tiny Seaside Cove Harbor Hamlet", "settlements", ["set_medieval_towns", "harbor", "cove", "jetty", "port"], 0.85, False),
            ("exp_mic_white_spire_abbey", "Slender White-Stone Hilltop Abbey", "settlements", ["set_medieval_towns", "abbey", "spire", "white", "fort"], 0.88, False),
            ("exp_mic_bridge_fort", "Fortified Twin-Tower River Bridge", "landmarks", ["set_landmarks", "bridge", "river", "crossing", "fort"], 0.86, False),
            ("exp_mic_sea_lighthouse", "Isolated Sea-Stack Lighthouse Tower", "maritime", ["set_ships", "lighthouse", "sea", "beacon", "tower"], 0.90, False),
            ("exp_mic_blue_arcane_spire", "Glowing Blue Arcane Wizard Spire", "landmarks", ["set_landmarks", "arcane", "blue", "crystal", "spire"], 0.90, False),
            ("exp_mic_gold_amphitheater", "Circular Golden Amphitheater Citadel", "settlements", ["set_world_cities", "arena", "amphitheater", "citadel", "gold"], 0.88, False),
        ],
    ),
    # --- High-Resolution Pen-and-Ink Master Plates (420px crispness at 500%+ zoom!) ---
    (
        "hq_ink_terrain_foliage_plate_1795425217799.jpg", 3, 3,
        [
            ("hq_ink_single_ridge", "Engraved Curved Steppe Ridge", "mountains", ["set_hills", "hill", "ridge", "steppe", "ink", "hq"], 0.86, False),
            ("hq_ink_triple_ridges", "Staggered Curved Steppe Ridges Trio", "mountains", ["set_hills", "hill", "ridge", "steppe", "ink", "hq"], 0.86, False),
            ("hq_ink_meadow_hills", "Cross-Hatched Rolling Meadow Hills", "mountains", ["set_hills", "hill", "meadow", "rolling", "hq"], 0.86, False),
            ("hq_ink_taiga_spruces", "Jet-Ink Needle Spruce Taiga Clump", "trees", ["set_pine", "pine", "taiga", "dark", "spruce", "hq"], 0.90, True),
            ("hq_ink_emerald_canopy", "Hand-Inked Emerald Woodland Canopy", "trees", ["set_oak", "oak", "forest", "canopy", "emerald", "hq"], 0.88, False),
            ("hq_ink_mixed_forest", "Dense Mixed Pine & Broadleaf Grove", "trees", ["set_pine", "forest", "pine", "oak", "woodland", "hq"], 0.88, False),
            ("hq_ink_alpine_trio", "Engraved Sunlit Alpine Peak Trio", "mountains", ["set_alpine_peaks", "mountain", "alpine", "snow", "hq"], 0.88, False),
            ("hq_ink_alpine_massif", "Towering Interlocking Alpine Massif", "mountains", ["set_alpine_peaks", "mountain", "massif", "range", "hq"], 0.88, False),
            ("hq_ink_bridge_mill", "Inked Stone River Bridge & Millhouse", "landmarks", ["set_landmarks", "bridge", "mill", "river", "crossing", "hq"], 0.86, False),
        ],
    ),
    (
        "hq_ink_towns_citadels_plate_1795425218487.jpg", 3, 3,
        [
            ("hq_twn_hamlet", "Detailed Medieval Crossroads Hamlet", "settlements", ["set_medieval_towns", "hamlet", "village", "cottages", "hq"], 0.88, False),
            ("hq_twn_walled_hill", "Fortified Walled Hill-Town & Spire", "settlements", ["set_medieval_towns", "town", "walled", "keep", "hq"], 0.88, False),
            ("hq_twn_fishing_port", "Coastal Fishing Port & Timber Pier", "settlements", ["set_medieval_towns", "port", "harbor", "dock", "hq"], 0.85, False),
            ("hq_twn_grand_capital", "Grand Sprawling Walled Capital City", "settlements", ["set_medieval_towns", "capital", "city", "cathedral", "hq"], 0.88, False),
            ("hq_twn_marble_citadel", "White-Marble Highland Citadel Palace", "settlements", ["set_world_cities", "palace", "marble", "citadel", "hq"], 0.88, False),
            ("hq_twn_amethyst_enclave", "Amethyst-Spired Arcane Forest Enclave", "settlements", ["set_fantasy_cities", "arcane", "elven", "violet", "hq"], 0.88, False),
            ("hq_twn_frost_citadel", "Glacial Ice-Spire Caldera Citadel", "settlements", ["set_fantasy_cities", "frost", "snow", "glacier", "citadel", "hq"], 0.88, False),
            ("hq_twn_sun_arena", "Weathered Sandstone Sun-Colosseum", "settlements", ["set_world_cities", "arena", "colosseum", "amphitheater", "hq"], 0.88, False),
            ("hq_twn_stone_viaduct", "Monumental Highland Stone Aqueduct", "landmarks", ["set_landmarks", "viaduct", "aqueduct", "bridge", "arch", "hq"], 0.86, False),
        ],
    ),
]


def strip_white_bg_perimeter(im: Image.Image, punch_interior_holes: bool = False, max_dim: int = 280) -> Image.Image:
    rgba = im.convert("RGBA")
    arr = np.asarray(rgba, dtype=np.uint8).copy()
    h, w, _ = arr.shape
    r = arr[:, :, 0].astype(np.int16)
    g = arr[:, :, 1].astype(np.int16)
    b = arr[:, :, 2].astype(np.int16)
    lum = (r * 30 + g * 59 + b * 11) // 100
    sat = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    is_bg_cand = (lum >= 234) & (sat <= 24)

    visited = np.zeros((h, w), dtype=bool)
    q: collections.deque[tuple[int, int]] = collections.deque()

    for x in range(w):
        if is_bg_cand[0, x]:
            visited[0, x] = True
            q.append((0, x))
        if is_bg_cand[h - 1, x]:
            visited[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(1, h - 1):
        if is_bg_cand[y, 0]:
            visited[y, 0] = True
            q.append((y, 0))
        if is_bg_cand[y, w - 1]:
            visited[y, w - 1] = True
            q.append((y, w - 1))

    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg_cand[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))

    if punch_interior_holes:
        visited |= (lum >= 247) & (sat <= 12)

    alpha = np.where(visited, 0, 255).astype(np.float32)

    edge_band = np.zeros((h, w), dtype=bool)
    edge_band[1:, :] |= visited[:-1, :] & (~visited[1:, :])
    edge_band[:-1, :] |= visited[1:, :] & (~visited[:-1, :])
    edge_band[:, 1:] |= visited[:, :-1] & (~visited[:, 1:])
    edge_band[:, :-1] |= visited[:, 1:] & (~visited[:, :-1])

    fringe = edge_band & (lum >= 188) & (sat <= 36)
    taper = np.clip((242.0 - lum) / 56.0, 0.0, 1.0)
    alpha = np.where(fringe, alpha * taper, alpha)
    for c in range(3):
        arr[:, :, c] = np.where(
            fringe,
            np.clip(arr[:, :, c].astype(np.float32) * 0.62, 0, 255).astype(np.uint8),
            arr[:, :, c],
        )

    arr[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)

    # Prune tiny disconnected neighbor-cell bleed slivers touching the raw slice edge
    fg = arr[:, :, 3] > 24
    comp_seen = np.zeros((h, w), dtype=bool)
    comps: list[tuple[int, bool, list[tuple[int, int]]]] = []
    for sy in range(h):
        for sx in range(w):
            if fg[sy, sx] and not comp_seen[sy, sx]:
                comp_seen[sy, sx] = True
                stack = [(sy, sx)]
                pixels: list[tuple[int, int]] = []
                touches_edge = False
                while stack:
                    cy, cx = stack.pop()
                    pixels.append((cy, cx))
                    if cy <= 1 or cy >= h - 2 or cx <= 1 or cx >= w - 2:
                        touches_edge = True
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if 0 <= ny < h and 0 <= nx < w and fg[ny, nx] and not comp_seen[ny, nx]:
                            comp_seen[ny, nx] = True
                            stack.append((ny, nx))
                comps.append((len(pixels), touches_edge, pixels))
    if len(comps) > 1:
        max_area = max(c[0] for c in comps)
        for area, touches_edge, pixels in comps:
            if touches_edge and area < max(120, int(max_area * 0.045)):
                for py, px in pixels:
                    arr[py, px, 3] = 0

    out = Image.fromarray(arr, "RGBA")

    bbox = out.getbbox()
    if not bbox:
        return out
    x0, y0, x1, y1 = bbox
    pad = 6
    cropped = out.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))
    cw, ch = cropped.size
    if max(cw, ch) > max_dim:
        scale = max_dim / max(cw, ch)
        cropped = cropped.resize(
            (max(16, int(round(cw * scale))), max(16, int(round(ch * scale)))),
            Image.Resampling.LANCZOS,
        )
    return cropped


def make_seamless_toroidal_texture(src_path: pathlib.Path, size: int = 768) -> Image.Image:
    """Convert a high-res flat texture into a mathematically seamless toroidal tile via cosine edge cross-fade."""
    im = Image.open(src_path).convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
    arr = np.asarray(im, dtype=np.float32)

    # Offset by half width/height so original outer edges move to center, then smooth-blend the center seam!
    def blend_1d(img: np.ndarray, axis: int, band_frac: float = 0.22) -> np.ndarray:
        n = img.shape[axis]
        half = n // 2
        rolled = np.roll(img, half, axis=axis)
        bw = max(16, int(n * band_frac))
        # Blend original (seam-free in the middle) over rolled (which has the raw edge at middle)
        coords = np.arange(n, dtype=np.float32)
        dist_center = np.abs(coords - half)
        t = np.clip(1.0 - dist_center / bw, 0.0, 1.0)
        w = 0.5 - 0.5 * np.cos(math.pi * t)
        if axis == 1:
            w = w[None, :, None]
        else:
            w = w[:, None, None]
        return rolled * (1.0 - w) + img * w

    seam_free = blend_1d(blend_1d(arr, axis=1, band_frac=0.22), axis=0, band_frac=0.22)
    rgb = np.clip(seam_free, 0, 255).astype(np.uint8)
    rgba = np.dstack([rgb, np.full((size, size), 255, dtype=np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def make_sample_color_variant(rgba: Image.Image) -> Image.Image:
    """Wonderdraft `sample_color` paintable neutral-ink sprite (inherits sampled biome ground color)."""
    arr = np.asarray(rgba.convert("RGBA"), dtype=np.float32)
    lum = (0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]) / 255.0
    pos = np.maximum(0.0, lum - 0.32)
    lifted = np.where(lum < 0.32, lum * 0.82, 0.262 + (pos / 0.68) ** 0.72 * 0.72)
    v = np.clip(lifted * 255.0, 0, 255).astype(np.uint8)
    out = np.stack([v, v, v, arr[:, :, 3].astype(np.uint8)], axis=-1)
    return Image.fromarray(out, "RGBA")


def make_sepia_ink_engraving(rgba: Image.Image) -> Image.Image:
    """Antique monochrome woodcut/sepia-ink engraving variant (great for Parchment, Feudal & Blueprint themes!)."""
    arr = np.asarray(rgba.convert("RGBA"), dtype=np.float32)
    lum = (0.299 * arr[:, :, 0] + 0.587 * arr[:, :, 1] + 0.114 * arr[:, :, 2]) / 255.0
    k = np.clip((lum - 0.14) / 0.80, 0.0, 1.0) ** 0.88
    r = np.clip(38.0 + k * (240.0 - 38.0), 0, 255).astype(np.uint8)
    g = np.clip(29.0 + k * (229.0 - 29.0), 0, 255).astype(np.uint8)
    b = np.clip(22.0 + k * (206.0 - 22.0), 0, 255).astype(np.uint8)
    out = np.stack([r, g, b, arr[:, :, 3].astype(np.uint8)], axis=-1)
    return Image.fromarray(out, "RGBA")


def compose_natural_cluster(
    sprites: list[Image.Image],
    seed: int,
    count: int = 4,
    spread_x: float = 1.45,
    spread_y: float = 0.55,
    max_dim: int = 320,
) -> Image.Image:
    """Assemble lush Y-sorted multi-sprite mountain ranges & woodland groves directly from our hand-inked icons!"""
    rng = random.Random(seed)
    canvas = Image.new("RGBA", (540, 420), (0, 0, 0, 0))
    placements: list[tuple[float, float, float, bool, Image.Image]] = []
    for i in range(count):
        sp = rng.choice(sprites)
        t = (i / max(1, count - 1)) - 0.5 if count > 1 else 0.0
        px = 270 + t * 185 * spread_x + rng.uniform(-24, 24)
        py = 250 + rng.uniform(-58, 58) * spread_y + (abs(t) * -18)
        sc = rng.uniform(0.66, 1.04) * (1.0 - abs(t) * 0.18)
        flip = rng.random() < 0.5
        placements.append((px, py, sc, flip, sp))
    placements.sort(key=lambda p: p[1])  # Y-sort back-to-front!

    for px, py, sc, flip, sp in placements:
        s_im = sp.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if flip else sp
        nw = max(24, int(round(s_im.width * sc)))
        nh = max(24, int(round(s_im.height * sc)))
        s_im = s_im.resize((nw, nh), Image.Resampling.LANCZOS)
        canvas.alpha_composite(s_im, (int(round(px - nw * 0.5)), int(round(py - nh * 0.86))))

    bbox = canvas.getbbox()
    if not bbox:
        return canvas.resize((128, 128), Image.Resampling.LANCZOS)
    x0, y0, x1, y1 = bbox
    pad = 8
    cropped = canvas.crop((max(0, x0 - pad), max(0, y0 - pad), min(canvas.width, x1 + pad), min(canvas.height, y1 + pad)))
    cw, ch = cropped.size
    if max(cw, ch) > max_dim:
        scale = max_dim / max(cw, ch)
        cropped = cropped.resize((max(16, int(round(cw * scale))), max(16, int(round(ch * scale)))), Image.Resampling.LANCZOS)
    return cropped


def generate_seamless_paper_texture(
    seed: int,
    base_rgb: tuple[int, int, int],
    stain_rgb: tuple[int, int, int],
    style: str,
    size: int = 512,
) -> Image.Image:
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    field = np.zeros((size, size), dtype=np.float32)
    for freq, amp in ((1, 0.32), (2, 0.24), (3, 0.16), (5, 0.11), (8, 0.08), (14, 0.05), (24, 0.04)):
        for _ in range(3):
            kx = int(rng.integers(-freq, freq + 1))
            ky = int(rng.integers(-freq, freq + 1))
            if kx == 0 and ky == 0:
                kx = freq
            phase = float(rng.uniform(0, 2 * math.pi))
            field += amp * np.cos(2 * math.pi * (kx * xx + ky * yy) + phase)
    field = (field - field.min()) / max(1e-5, field.max() - field.min())
    fine = rng.normal(0.0, 0.03, (size, size)).astype(np.float32)
    t = np.clip(field + fine, 0.0, 1.0)
    b = np.array(base_rgb, dtype=np.float32)
    s = np.array(stain_rgb, dtype=np.float32)
    rgb = b[None, None, :] * (1.0 - t[:, :, None] * 0.65) + s[None, None, :] * (t[:, :, None] * 0.65)

    if style == "waves":
        wave = np.sin(2 * math.pi * (14 * yy + 0.25 * np.sin(2 * math.pi * 6 * xx)))
        crest = np.clip((wave - 0.86) * 6.0, 0.0, 1.0)
        rgb = rgb * (1.0 - crest[:, :, None] * 0.14)
    elif style == "blueprint":
        gx = (np.abs(np.sin(2 * math.pi * 8 * xx)) < 0.03).astype(np.float32)
        gy = (np.abs(np.sin(2 * math.pi * 8 * yy)) < 0.03).astype(np.float32)
        rgb = np.clip(rgb + np.maximum(gx, gy)[:, :, None] * 28.0, 0, 255)
    elif style == "stipple":
        dots = (rng.random((size, size)) > 0.965).astype(np.float32)
        rgb = rgb * (1.0 - dots[:, :, None] * 0.14)
    elif style == "linen":
        weave = 0.03 * np.sin(2 * math.pi * 64 * xx) + 0.03 * np.sin(2 * math.pi * 64 * yy)
        rgb = np.clip(rgb * (1.0 + weave[:, :, None]), 0, 255)
    elif style == "stars":
        stars = (rng.random((size, size)) > 0.9975).astype(np.float32)
        rgb = np.clip(rgb + stars[:, :, None] * 185.0, 0, 255)

    arr = np.clip(rgb, 0, 255).astype(np.uint8)
    rgba = np.dstack([arr, np.full((size, size), 255, dtype=np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def dominant_hex(im: Image.Image) -> str:
    arr = np.asarray(im.convert("RGBA"), dtype=np.float32)
    mask = arr[:, :, 3] > 64
    if not np.any(mask):
        return "#8A7A66"
    r, g, b = arr[:, :, :3][mask].mean(axis=0)
    return f"#{int(round(r)):02X}{int(round(g)):02X}{int(round(b)):02X}"


def main() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)

    manifest_assets: list[dict[str, Any]] = []
    cut_by_slug: dict[str, Image.Image] = {}
    qa_flora: list[tuple[str, Image.Image]] = []
    qa_geo: list[tuple[str, Image.Image]] = []
    qa_civ: list[tuple[str, Image.Image]] = []
    qa_modes: list[tuple[str, Image.Image]] = []

    def register(
        rel_path: str,
        im: Image.Image,
        display_name: str,
        category: str,
        world_group: str,
        draw_mode: str,
        tags: list[str],
        anchor_y_frac: float = 0.86,
    ) -> None:
        full = OUT_DIR / rel_path
        full.parent.mkdir(parents=True, exist_ok=True)
        im.save(full, "PNG", optimize=True)
        w, h = im.size
        offset_y = int(round((0.5 - anchor_y_frac) * h))
        all_tags = list(dict.fromkeys(["world", "atlas", world_group] + tags))
        manifest_assets.append(
            {
                "path": rel_path.replace("\\", "/"),
                "displayName": display_name,
                "category": category,
                "worldGroup": world_group,
                "widthPx": w,
                "heightPx": h,
                "defaultPpi": 256 if category == "terrain" else 128,
                "drawMode": draw_mode,
                "dominantHex": dominant_hex(im),
                "castsShadow": False,
                "anchorOffsetX": 0,
                "anchorOffsetY": offset_y,
                "tags": all_tags,
            }
        )

    # ── 1. Segment all 52 hand-inked illustrated plates (398 unique icons x 3 modes = 1,194 assets!) ──
    missing_plates: list[str] = []
    for plate_file, cols, rows, items in PLATES:
        src = ARTIFACTS_DIR / plate_file
        if not src.exists():
            missing_plates.append(plate_file)
            print(f"[WARN] Missing plate: {src}")
            continue
        plate = Image.open(src).convert("RGB")
        pw, ph = plate.size
        cw = pw / cols
        ch = ph / rows
        is_exp = plate_file.startswith("exp_")
        is_hq = plate_file.startswith("hq_")
        for idx, (slug, title, wgroup, tags, anc_y, punch) in enumerate(items):
            r_i, c_i = divmod(idx, cols)
            box = (
                int(round(c_i * cw)),
                int(round(r_i * ch)),
                int(round((c_i + 1) * cw)),
                int(round((r_i + 1) * ch)),
            )
            crop = plate.crop(box)
            norm_im = strip_white_bg_perimeter(
                crop,
                punch_interior_holes=punch,
                max_dim=420 if is_hq else 280,
            )
            cut_by_slug[slug] = norm_im

            # (a) Full-color vintage watercolor illustrated sprite (`normal`)
            register(f"{wgroup}/{slug}.png", norm_im, title, "symbol", wgroup, "normal", tags, anc_y)
            # (b) Wonderdraft Ground-Sampled Paintable sprite (`sample_color`)
            samp_im = make_sample_color_variant(norm_im)
            register(
                f"{wgroup}/{slug}_paintable.png",
                samp_im,
                f"{title} (Paintable)",
                "symbol",
                wgroup,
                "sample_color",
                tags + ["paintable", "sample_color"],
                anc_y,
            )
            # (c) Antique Sepia-Ink Engraved Tintable sprite (`tint`)
            ink_im = make_sepia_ink_engraving(norm_im)
            register(
                f"{wgroup}/{slug}_ink.png",
                ink_im,
                f"{title} (Engraved Ink)",
                "symbol",
                wgroup,
                "tint",
                tags + ["ink", "monochrome", "engraved", "tintable"],
                anc_y,
            )

            # Collect representative samples across ALL 26 new expansion plates for visual QA
            if is_exp:
                if plate_file.startswith("exp_trees_") and idx in (0, 4, 8) and len(qa_flora) < 24:
                    qa_flora.append((title, norm_im))
                elif (
                    plate_file.startswith(("exp_mtns_", "exp_cliffs_", "exp_terrain_"))
                    and idx in (0, 3, 6, 8)
                    and len(qa_geo) < 24
                ):
                    qa_geo.append((title, norm_im))
                elif (
                    plate_file.startswith(("exp_settle_", "exp_landmarks_", "exp_maritime_", "exp_fauna_", "exp_carto_"))
                    and idx in (0, 4, 8)
                    and len(qa_civ) < 24
                ):
                    qa_civ.append((title, norm_im))
                if slug in (
                    "exp_pine_old_growth_spruce",
                    "exp_oak_spreading_grand",
                    "exp_alp_jagged_horn",
                    "exp_dune_stone_arch",
                    "exp_fan_elven_palace",
                    "exp_ship_man_of_war",
                    "exp_comp_astrolabe",
                    "exp_her_lion_flag",
                ):
                    qa_modes.append((f"{title[:16]} [Col]", norm_im))
                    qa_modes.append((f"{title[:16]} [Bmp]", samp_im))
                    qa_modes.append((f"{title[:16]} [Ink]", ink_im))

    # ── 2. Composed Y-Sorted Hand-Inked Multi-Sprite Ranges & Woodland Patches (72 assets!) ──
    cluster_recipes: list[tuple[str, str, str, list[str], list[str], int, float]] = [
        ("range_alpine_peaks", "Alpine Mountain Range", "mountains", ["mtn_snow_alpine_peak", "mtn_twin_rocky_peaks", "mtn_three_peak_massif", "exp_alp_jagged_horn", "exp_alp_twin_sweep", "exp_alp_towering_central"], ["set_alpine_peaks", "mountain", "range", "alpine", "cluster"], 4, 1.5),
        ("range_glacial_peaks", "Glacial Peak Range", "mountains", ["mtn_glacial_ice_range", "mtn_snow_alpine_peak", "exp_alp_sawtooth_ridge", "exp_alp_high_pass"], ["set_alpine_peaks", "mountain", "range", "arctic", "glacier", "cluster"], 4, 1.45),
        ("range_ironspine_crags", "Dark Ironspine Mountain Range", "mountains", ["exp_rock_shale_crag", "exp_rock_slate_fangs", "exp_rock_ironspine_range", "exp_rock_solitary_spire", "mtn_craggy_low_ridge"], ["set_rocky_peaks", "mountain", "range", "crag", "dark", "cluster"], 4, 1.5),
        ("range_rolling_hills", "Rolling Foothills Belt", "mountains", ["hill_single_meadow", "hill_paired_downs", "hill_layered_foothills", "exp_hill_wide_smooth", "exp_hill_wooded_foothills"], ["set_hills", "hills", "foothills", "cluster"], 4, 1.5),
        ("range_desert_dunes", "Rolling Desert Sand Dune Sea", "mountains", ["exp_dune_crescent", "exp_dune_triple_field", "exp_dune_wind_ridge"], ["set_desert_dunes", "dune", "sand", "desert", "cluster"], 4, 1.55),
        ("range_red_badlands", "Red Rock Canyon Badlands", "mountains", ["land_red_sandstone_mesa", "land_desert_rock_hoodoo", "land_stepped_canyon_cliff", "exp_dune_wide_mesa", "exp_dune_twin_buttes"], ["set_desert_dunes", "mesa", "badlands", "desert", "cluster"], 4, 1.45),
        ("range_volcanic_peaks", "Volcanic Obsidian Ridge Belt", "mountains", ["exp_volc_erupting_plume", "exp_volc_obsidian_fang", "exp_volc_twin_spires", "exp_volc_lava_ridge"], ["set_volcanic", "volcano", "obsidian", "ridge", "cluster"], 4, 1.5),
        ("range_cliff_escarpment", "Highland Cliff Escarpment Belt", "mountains", ["exp_cliff_inland_wall", "exp_cliff_highland_ledge", "land_highland_moor_ridge", "exp_cliff_canyon_gorge"], ["set_cliffs", "cliff", "escarpment", "canyon", "cluster"], 3, 1.55),
        ("forest_dense_pines", "Dense Pine Forest Patch", "trees", ["tree_alpine_pine_single", "tree_slender_spruce_single", "exp_pine_tall_narrow", "exp_pine_old_growth_spruce", "exp_pine_twin_forest", "exp_pine_five_cluster"], ["set_pine", "forest", "pine", "conifer", "cluster"], 6, 1.35),
        ("forest_winter_taiga", "Winter Snowy Taiga Patch", "trees", ["tree_snow_pine_single", "tree_arctic_spruce_trio", "exp_snow_heavy_fir", "exp_snow_frost_spruce", "exp_snow_taiga_thicket"], ["set_snow_trees", "forest", "snow", "winter", "taiga", "cluster"], 5, 1.35),
        ("forest_oak_woodland", "Broadleaf Oak Woodland Patch", "trees", ["tree_grand_oak_single", "tree_broadleaf_pair", "exp_oak_spreading_grand", "exp_oak_round_beech", "exp_oak_trio_copse"], ["set_oak", "forest", "oak", "woods", "cluster"], 6, 1.35),
        ("forest_autumn_woods", "Autumn Maple & Birch Woods", "trees", ["tree_autumn_maple_single", "tree_silver_birch_trio", "exp_aut_orange_maple", "exp_aut_crimson_oak", "exp_aut_golden_birch"], ["set_autumn", "forest", "autumn", "maple", "cluster"], 5, 1.35),
        ("forest_sakura_grove", "Cherry Blossom Sakura Grove", "trees", ["exp_aut_sakura_single", "exp_aut_sakura_twin", "exp_aut_weeping_willow"], ["set_autumn", "forest", "sakura", "blossom", "eastern", "cluster"], 5, 1.35),
        ("forest_tropical_jungle", "Tropical Palm Jungle Patch", "trees", ["tree_coconut_palm_single", "exp_trop_curved_palm", "exp_trop_rainforest_dome", "exp_trop_banyan_roots", "exp_trop_banana_ferns"], ["set_tropical", "forest", "jungle", "palm", "tropical", "cluster"], 5, 1.35),
        ("forest_mangrove_swamp", "Coastal Mangrove Swamp Thicket", "trees", ["exp_trop_mangrove_single", "exp_trop_mangrove_cluster", "exp_dead_moss_cypress", "exp_fey_cattail_reeds"], ["set_tropical", "mangrove", "swamp", "coast", "cluster"], 5, 1.35),
        ("forest_haunted_deadwood", "Haunted Deadwood Blight Woods", "trees", ["tree_swamp_deadwood", "exp_dead_gnarled_oak", "exp_dead_charred_trio", "exp_dead_haunted_willow", "exp_dead_thicket_clump"], ["set_deadwood", "forest", "dead", "swamp", "haunted", "cluster"], 5, 1.35),
        ("forest_savanna_scrub", "Savanna Acacia & Desert Scrub", "trees", ["exp_des_acacia_wide", "exp_des_acacia_twin", "exp_des_baobab_stout", "exp_des_sagebrush", "exp_des_saguaro_tall"], ["set_desert_flora", "savanna", "desert", "acacia", "cluster"], 5, 1.45),
        ("forest_fey_mushrooms", "Giant Fey Fungal Forest Grove", "trees", ["hero_giant_mushroom_grove", "exp_fey_red_mushrooms", "exp_fey_glow_fungi", "exp_fey_crystal_tree"], ["set_fey_flora", "fey", "mushroom", "forest", "magic", "cluster"], 5, 1.35),
    ]
    for slug_base, title_base, wgroup, src_slugs, tags, n_items, sx in cluster_recipes:
        pool = [cut_by_slug[s] for s in src_slugs if s in cut_by_slug]
        if not pool:
            continue
        for v_i in (1, 2):
            seed = (sum(ord(c) for c in slug_base) * 997 + v_i * 7919) & 0xFFFFFFFF
            cl_im = compose_natural_cluster(pool, seed, count=n_items, spread_x=sx)
            register(f"{wgroup}/{slug_base}_{v_i:02d}.png", cl_im, f"{title_base} #{v_i}", "symbol", wgroup, "normal", tags, 0.88)
            cl_samp = make_sample_color_variant(cl_im)
            register(f"{wgroup}/{slug_base}_{v_i:02d}_paintable.png", cl_samp, f"{title_base} #{v_i} (Paintable)", "symbol", wgroup, "sample_color", tags + ["paintable", "sample_color"], 0.88)

    # ── 3. 24 Seamless 512x512 World Atlas Paper, Vellum & Ocean Textures ──
    tex_specs = [
        ("world_paper_aged_parchment", "Aged Parchment Paper", (226, 206, 168), (182, 152, 110), "smooth"),
        ("world_paper_antique_vellum", "Antique Vellum Sheet", (236, 224, 198), (198, 178, 146), "linen"),
        ("world_paper_vibrant_atlas", "Crisp Atlas Ivory Paper", (234, 228, 206), (204, 196, 170), "smooth"),
        ("world_paper_worn_pirate", "Worn Pirate Chart Linen", (204, 176, 134), (146, 112, 74), "linen"),
        ("world_paper_ink_wash", "Eastward Ink-Wash Rice Paper", (238, 232, 220), (196, 188, 174), "stipple"),
        ("world_paper_feudal_mono", "Feudal Monochrome Paper", (232, 228, 220), (188, 182, 174), "stipple"),
        ("world_paper_pastel_story", "Storybook Cream Paper", (244, 236, 222), (218, 204, 188), "smooth"),
        ("world_paper_obsidian_night", "Obsidian Night Slate Paper", (42, 48, 62), (26, 30, 42), "stipple"),
        ("world_paper_tundra_frost", "Arctic Tundra Frost Paper", (224, 234, 238), (186, 204, 214), "stipple"),
        ("world_paper_desert_ochre", "Sun-Baked Desert Ochre Vellum", (228, 198, 146), (186, 142, 86), "linen"),
        ("world_paper_volcanic_ash", "Volcanic Ash Charcoal Paper", (74, 68, 66), (44, 38, 36), "stipple"),
        ("world_paper_fey_sylvan", "Fey Sylvan Sage Linen", (214, 224, 198), (172, 190, 156), "linen"),
        ("world_paper_cartographer_grid", "Cartographer Blueprint Vellum", (46, 78, 118), (32, 56, 92), "blueprint"),
        ("world_ocean_parchment_sea", "Parchment Tea-Stained Ocean", (174, 184, 176), (132, 146, 140), "waves"),
        ("world_ocean_azure_atlas", "Vibrant Azure Atlas Ocean", (102, 158, 186), (62, 112, 146), "waves"),
        ("world_ocean_deep_nautical", "Deep Bathymetry Sea", (58, 102, 134), (34, 68, 96), "waves"),
        ("world_ocean_pirate_sepia", "Antique Pirate Sea Chart", (166, 148, 118), (124, 104, 78), "waves"),
        ("world_ocean_blueprint", "Nautical Blueprint Ocean", (32, 66, 108), (22, 46, 82), "blueprint"),
        ("world_ocean_ink_monochrome", "Engraved Monochrome Ocean", (196, 192, 184), (154, 150, 142), "waves"),
        ("world_ocean_midnight_abyss", "Obsidian Midnight Ocean", (22, 32, 48), (12, 18, 30), "waves"),
        ("world_ocean_freshwater", "Freshwater Inland Lake", (128, 184, 198), (86, 146, 166), "smooth"),
        ("world_ocean_coral_lagoon", "Tropical Coral Lagoon Shallows", (92, 182, 186), (52, 136, 148), "waves"),
        ("world_ocean_stormy_indigo", "Stormy North Indigo Sea", (52, 74, 98), (30, 44, 64), "waves"),
        ("world_ocean_celestial_stars", "Astral Starfield Celestial Sea", (20, 26, 46), (10, 14, 28), "stars"),
    ]
    for idx, (slug, title, base_c, stain_c, sty) in enumerate(tex_specs):
        im = generate_seamless_paper_texture(7000 + idx, base_c, stain_c, sty, 512)
        register(
            f"textures/{slug}.png",
            im,
            title,
            "terrain",
            "textures",
            "normal",
            ["world_texture", "paper" if "paper" in slug else "ocean", sty],
            0.50,
        )

    # ── 4. High-Resolution 768x768 Seamless Rag-Vellum & Watercolor Sea Master Textures ──
    hq_textures = [
        (
            "hq_antique_vellum_paper_1795425225634.jpg",
            "world_paper_antique_rag_hq",
            "Museum Antique Cotton-Rag Vellum (HQ)",
            ["world_texture", "paper", "vellum", "antique", "hq"],
        ),
        (
            "hq_weathered_ocean_wash_1795425211634.jpg",
            "world_ocean_weathered_vellum_hq",
            "Weathered Watercolor Antique Ocean (HQ)",
            ["world_texture", "ocean", "watercolor", "antique", "hq"],
        ),
    ]
    for src_name, slug, title, t_tags in hq_textures:
        src_p = ARTIFACTS_DIR / src_name
        if src_p.exists():
            hq_im = make_seamless_toroidal_texture(src_p, 768)
            register(f"textures/{slug}.png", hq_im, title, "terrain", "textures", "normal", t_tags, 0.50)
        else:
            print(f"[WARN] Missing HQ texture: {src_p}")

    manifest = {
        "name": "Dice Chaos World Atlas CC0",
        "version": "1.6.0",
        "license": "CC0-1.0",
        "assetCount": len(manifest_assets),
        "assets": manifest_assets,
    }
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_STORED) as zf:
        zf.write(OUT_DIR / "manifest.json", "manifest.json")
        for a in manifest_assets:
            fp = OUT_DIR / a["path"]
            if fp.exists():
                zf.write(fp, a["path"])

    def save_contact_sheet(items: list[tuple[str, Image.Image]], out_path: pathlib.Path) -> None:
        cols, rows = 6, 4
        cell = 160
        pad = 12
        sheet = Image.new("RGB", (cols * cell + (cols + 1) * pad, rows * (cell + 22) + (rows + 1) * pad), (232, 218, 190))
        sd = ImageDraw.Draw(sheet)
        for idx, (lbl, sprite) in enumerate(items[: cols * rows]):
            r_i, c_i = divmod(idx, cols)
            x0 = pad + c_i * (cell + pad)
            y0 = pad + r_i * (cell + 22 + pad)
            sd.rectangle([x0, y0, x0 + cell, y0 + cell], fill=(238, 226, 200), outline=(170, 152, 124))
            sp = sprite.copy()
            sp.thumbnail((cell - 14, cell - 14), Image.Resampling.LANCZOS)
            sheet.paste(sp, (x0 + (cell - sp.width) // 2, y0 + (cell - sp.height) // 2), sp)
            sd.text((x0 + 4, y0 + cell + 4), lbl[:23], fill=(42, 32, 24))
        sheet.save(out_path, "PNG")

    save_contact_sheet(qa_flora, SCRATCH_DIR / "world_atlas_exp_flora_qa.png")
    save_contact_sheet(qa_geo, SCRATCH_DIR / "world_atlas_exp_geo_qa.png")
    save_contact_sheet(qa_civ, SCRATCH_DIR / "world_atlas_exp_civ_qa.png")
    save_contact_sheet(qa_modes, SCRATCH_DIR / "world_atlas_exp_modes_qa.png")

    by_group: dict[str, int] = {}
    by_mode: dict[str, int] = {}
    by_set: dict[str, int] = {}
    for a in manifest_assets:
        by_group[a["worldGroup"]] = by_group.get(a["worldGroup"], 0) + 1
        by_mode[a["drawMode"]] = by_mode.get(a["drawMode"], 0) + 1
        if a["drawMode"] == "normal":
            for t in a["tags"]:
                if t.startswith("set_"):
                    by_set[t] = by_set.get(t, 0) + 1
    print(f"Built {len(manifest_assets)} 100% hand-inked CC0 World Atlas assets -> {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024*1024):.2f} MB)")
    print("  Missing plates:", len(missing_plates))
    print("  By group:", by_group)
    print("  By drawMode:", by_mode)
    print("  Species brush sets (normal base variants each):", dict(sorted(by_set.items())))


if __name__ == "__main__":
    main()

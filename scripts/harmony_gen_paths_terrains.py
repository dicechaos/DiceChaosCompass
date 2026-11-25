"""
Step 5A — Generates 140 Brand-New Unique Painterly Paths, Floors, Streets & Roofs:
  - 80 Unique Paths in modular-suite-cc0/paths/harmony/ (category: "path", horizontally seamless!)
  - 60 Unique Seamless 512x512 Terrains & Roofs in modular-suite-cc0/terrain/harmony/ (category: "terrain", 2D periodic!)

Updates modular-suite-cc0/manifest.json and exports dark-checkerboard QA contact sheets!
"""

from __future__ import annotations

import math
import random
from typing import Any

import numpy as np
from PIL import Image, ImageDraw

from harmony_arch_generators import render_path
from harmony_art_engine import (
    DD_RED_BASE,
    DD_RED_DEEP,
    INK,
    INK_MID,
    INK_WARM,
    MOD_DIR,
    SCRATCH_DIR,
    apply_painterly_finish,
    blend_rgb,
    clamp8,
    dominant_hex,
    draw_beveled_rect,
    draw_foliage_cluster,
    draw_stone_block,
    draw_wood_planks_box,
    fbm_periodic,
    save_qa_sheet,
    shade_rgb,
    upsert_manifest_entries,
    vary_rgb,
)

PATHS_DIR = MOD_DIR / "paths" / "harmony"
TERR_DIR = MOD_DIR / "terrain" / "harmony"


# =============================================================================
# 1. 80 BRAND-NEW UNIQUE ARCHITECTURAL PATHS
# =============================================================================
NEW_PATHS: list[tuple[str, str, list[str], dict]] = [
    # --- A. 18 Streets, Sidewalks & Stone Walkways ---
    ("path_berlin_granite_cobbles", "Berlin Granite Sett Cobblestone Lane", ["path", "berlin", "cobble", "street", "stone", "harmony"],
     dict(kind="cobble_lane", base=(128, 132, 140), bed_rgb=(74, 76, 82), stones=48)),
    ("path_rain_slick_cobbles", "Rain-Slick Dark Basalt Street Cobbles", ["path", "cobble", "wet", "dark", "street", "harmony"],
     dict(kind="cobble_lane", base=(88, 96, 108), bed_rgb=(46, 52, 62), stones=48)),
    ("path_berlin_sidewalk_curb", "Berlin Cut-Stone Flagstone Sidewalk & Curb", ["path", "sidewalk", "curb", "berlin", "stone", "harmony"],
     dict(kind="curb_stone", base=(166, 162, 154), rows=2, cols=10, gutter=True)),
    ("path_herringbone_brick_walk", "Warm Red Herringbone Brick Promenade", ["path", "brick", "sidewalk", "promenade", "harmony"],
     dict(kind="curb_stone", base=(168, 86, 62), rows=3, cols=12, moss=0.05)),
    ("path_yellow_klinker_walk", "Berlin Yellow Klinker-Brick Alley Walkway", ["path", "brick", "yellow", "berlin", "alley", "harmony"],
     dict(kind="curb_stone", base=(196, 166, 98), rows=3, cols=11, moss=0.08)),
    ("path_mossy_garden_stones", "Mossy Woodland Stepping-Stone Trail", ["path", "stepping", "stones", "moss", "garden", "park", "harmony"],
     dict(kind="cobble_lane", base=(152, 150, 140), bed=False, stepping=True, stones=14, moss=0.65)),
    ("path_marble_colonnade_walk", "Veined Marble Temple Colonnade Walkway", ["path", "marble", "temple", "walkway", "harmony"],
     dict(kind="curb_stone", base=(224, 218, 206), rows=2, cols=10, moss=0.0)),
    ("path_iron_drain_gutter", "Cast-Iron Street Drainage Grate Gutter", ["path", "drain", "gutter", "iron", "street", "berlin", "harmony"],
     dict(kind="curb_stone", base=(92, 98, 106), rows=1, cols=14, gutter=True)),
    ("path_berlin_tram_double_rail", "Berlin Streetcar Twin-Rail Granite Track", ["path", "tram", "rail", "track", "berlin", "harmony"],
     dict(kind="rail_track", w=512, h=192, base=(142, 148, 156), trim=(116, 118, 122), ballast=True, ties=14)),
    ("path_brass_mini_tram_rail", "Ornate Brass & Mahogany Miniature Rail Track", ["path", "rail", "brass", "train", "magipunk", "harmony"],
     dict(kind="rail_track", w=512, h=128, base=(212, 174, 72), trim=(122, 72, 42), ballast=False, ties=16)),
    ("path_sandstone_desert_walk", "Warm Sandstone Desert Flagstone Path", ["path", "sandstone", "desert", "stone", "harmony"],
     dict(kind="curb_stone", base=(202, 174, 124), rows=2, cols=10, moss=0.0)),
    ("path_ruined_cobble_causeway", "Cracked & Overgrown Ruined Causeway", ["path", "ruin", "cobble", "moss", "dungeon", "harmony"],
     dict(kind="cobble_lane", base=(124, 126, 122), bed_rgb=(78, 86, 68), stones=32, moss=0.55)),
    ("path_slate_garden_edging", "Slate-Stone Park Bed Edging Strip", ["path", "slate", "edging", "curb", "park", "harmony"],
     dict(kind="curb_stone", base=(108, 114, 124), rows=1, cols=14, moss=0.22)),
    ("path_park_gravel_edged", "Ochre Gravel Park Path with Timber Curb", ["path", "gravel", "park", "garden", "harmony"],
     dict(kind="cobble_lane", base=(192, 178, 148), bed_rgb=(166, 150, 118), stones=44)),
    ("path_muddy_wagon_lane", "Rain-Soaked Muddy Farm Wagon Track", ["path", "mud", "dirt", "wagon", "road", "harmony"],
     dict(kind="dirt_ruts", base=(106, 78, 54))),
    ("path_snowy_footpath", "Crisp Boot-Tracked Winter Snow Footpath", ["path", "snow", "winter", "trail", "harmony"],
     dict(kind="dirt_ruts", base=(214, 226, 238))),
    ("path_wooden_boardwalk", "Weathered Timber Promenade Boardwalk", ["path", "wood", "boardwalk", "pier", "park", "harmony"],
     dict(kind="wood_deck", base=(146, 106, 68), trim=(104, 72, 44), rails=True, planks=24, gap=3)),
    ("path_iron_catwalk_bridge", "Riveted Industrial Iron Catwalk Walkway", ["path", "iron", "catwalk", "industrial", "magipunk", "harmony"],
     dict(kind="wood_deck", base=(84, 92, 102), trim=(186, 152, 72), rails=True, planks=24, gap=4)),

    # --- B. 16 Ornamental Rugs, Runners & Interior Borders ---
    ("path_runner_sovereign_violet", "Sovereign Royal Violet & Gold Aisle Runner", ["path", "runner", "carpet", "violet", "sovereign", "harmony"],
     dict(kind="runner_carpet", base=(96, 38, 108), accent=(224, 186, 76))),
    ("path_runner_emerald_velvet", "Emerald Velvet Grand Salon Carpet Runner", ["path", "runner", "carpet", "emerald", "manor", "harmony"],
     dict(kind="runner_carpet", base=(38, 104, 72), accent=(218, 182, 78))),
    ("path_runner_midnight_navy", "Midnight-Navy & Gold Observatory Runner", ["path", "runner", "carpet", "navy", "gold", "harmony"],
     dict(kind="runner_carpet", base=(42, 58, 98), accent=(222, 186, 82))),
    ("path_runner_burgundy_parlor", "Burgundy & Ivory Café Parlor Carpet Runner", ["path", "runner", "carpet", "burgundy", "parlor", "harmony"],
     dict(kind="runner_carpet", base=(138, 34, 46), accent=(232, 222, 198))),
    ("path_runner_ochre_persian", "Ochre & Terracotta Woven Persian Runner", ["path", "runner", "carpet", "persian", "ochre", "harmony"],
     dict(kind="runner_carpet", base=(174, 114, 52), accent=(234, 208, 146))),
    ("path_runner_tattered_slum", "Faded Threadbare Tenement Hallway Runner", ["path", "runner", "carpet", "tenement", "worn", "harmony"],
     dict(kind="runner_carpet", base=(126, 86, 78), accent=(168, 148, 118))),
    ("path_runner_ivory_wedding", "Ivory & Gold Ceremonial Temple Runner", ["path", "runner", "carpet", "ivory", "temple", "harmony"],
     dict(kind="runner_carpet", base=(228, 220, 202), accent=(218, 180, 74))),
    ("path_runner_teal_jugendstil", "Teal & Brass Art-Nouveau Hall Runner", ["path", "runner", "carpet", "teal", "jugendstil", "harmony"],
     dict(kind="runner_carpet", base=(44, 118, 124), accent=(214, 178, 76))),
    ("path_border_marble_mosaic", "Marble & Gold Foyer Mosaic Floor Border", ["path", "border", "marble", "mosaic", "interior", "harmony"],
     dict(kind="runner_carpet", base=(218, 212, 198), accent=(188, 152, 68))),
    ("path_border_dark_parquet", "Dark Walnut Parquet Floor Inlay Border", ["path", "border", "wood", "parquet", "interior", "harmony"],
     dict(kind="curb_stone", base=(104, 68, 42), rows=1, cols=16, moss=0.0)),
    ("path_border_brass_inlay", "Gleaming Brass Architectural Floor Trim", ["path", "border", "brass", "trim", "magipunk", "harmony"],
     dict(kind="conduit_pipe", w=512, h=64, base=(198, 162, 70), accent=(234, 204, 112), pipes=1)),
    ("path_border_tile_cobalt", "Cobalt & Ivory Ceramic Floor Tile Border", ["path", "border", "tile", "cobalt", "interior", "harmony"],
     dict(kind="runner_carpet", base=(58, 102, 156), accent=(232, 228, 216))),
    ("path_border_obsidian_gold", "Obsidian & Gold Sovereign Floor Trim", ["path", "border", "obsidian", "gold", "cathedral", "harmony"],
     dict(kind="runner_carpet", base=(48, 46, 58), accent=(220, 182, 74))),
    ("path_col_ornate_runner", "Colorable Embroidered Ornate Carpet Runner", ["path", "colorable", "runner", "carpet", "modular", "harmony"],
     dict(kind="runner_carpet", colorable=True, accent=(224, 188, 82))),
    ("path_col_velvet_border", "Colorable Velvet & Ivory Trim Border", ["path", "colorable", "border", "velvet", "modular", "harmony"],
     dict(kind="runner_carpet", colorable=True, accent=(238, 232, 218))),
    ("path_col_brick_walkway", "Colorable Brick & Tile Walkway Strip", ["path", "colorable", "brick", "walkway", "modular", "harmony"],
     dict(kind="curb_stone", colorable=True, rows=2, cols=12, moss=0.0)),

    # --- C. 16 Magipunk, Industrial & Utility Conduits ---
    ("path_copper_twin_steam_pipes", "Twin Riveted Copper Steam Pipes", ["path", "pipe", "copper", "steam", "magipunk", "industrial", "harmony"],
     dict(kind="conduit_pipe", base=(172, 102, 62), accent=(218, 178, 82), pipes=2)),
    ("path_brass_triple_conduit", "Triple Brass Magipunk Utility Conduit", ["path", "conduit", "brass", "magipunk", "steampunk", "harmony"],
     dict(kind="conduit_pipe", base=(194, 156, 68), accent=(118, 88, 44), pipes=3)),
    ("path_iron_water_main", "Heavy Flanged Cast-Iron Water Main Pipe", ["path", "pipe", "iron", "sewer", "industrial", "harmony"],
     dict(kind="conduit_pipe", base=(84, 92, 102), accent=(148, 154, 162), pipes=1)),
    ("path_aether_violet_leyline", "Sovereign Glowing Violet Aether Conduit", ["path", "aether", "conduit", "violet", "sovereign", "magipunk", "harmony"],
     dict(kind="conduit_pipe", w=512, h=80, base=(128, 72, 198), accent=(214, 176, 74), glow=(178, 96, 248), pipes=1)),
    ("path_aether_emerald_pipe", "Alchemical Glowing Emerald Glass Pipe", ["path", "aether", "conduit", "emerald", "alchemy", "harmony"],
     dict(kind="conduit_pipe", w=512, h=80, base=(52, 162, 108), accent=(198, 166, 76), glow=(72, 232, 152), pipes=1)),
    ("path_aether_amber_gasline", "Pressurized Glowing Amber Gaslight Pipe", ["path", "pipe", "gas", "amber", "berlin", "magipunk", "harmony"],
     dict(kind="conduit_pipe", w=512, h=80, base=(198, 138, 46), accent=(168, 136, 66), glow=(255, 182, 58), pipes=1)),
    ("path_aether_twin_cyan_cables", "Twin Glowing Cyan Aether Power Cables", ["path", "aether", "cable", "cyan", "magipunk", "harmony"],
     dict(kind="conduit_pipe", w=512, h=96, base=(58, 164, 188), accent=(206, 168, 74), glow=(72, 222, 244), pipes=2)),
    ("path_pneumatic_post_tube", "Berlin Brass Pneumatic Post Message Tube", ["path", "brass", "tube", "post", "berlin", "magipunk", "harmony"],
     dict(kind="conduit_pipe", w=512, h=72, base=(186, 148, 66), accent=(128, 86, 44), pipes=1)),
    ("path_overhead_trolley_wire", "Overhead Tramway Copper Catenary Wire", ["path", "wire", "tram", "berlin", "cable", "harmony"],
     dict(kind="garland_festoon", w=512, h=64, sub="cable", base=(178, 126, 72))),
    ("path_sewer_stone_runoff", "Subterranean Sewer Mossy Water Channel", ["path", "sewer", "water", "channel", "dungeon", "harmony"],
     dict(kind="water_stream", base=(58, 96, 82), ribbons=10)),
    ("path_blood_ichor_stream", "Ritual Crimson Blood-Ichor Channel", ["path", "blood", "ritual", "dungeon", "stream", "harmony"],
     dict(kind="water_stream", base=(134, 24, 30), ribbons=8)),
    ("path_magma_lava_fissure", "Glowing Molten Magma Floor Fissure", ["path", "magma", "lava", "crack", "fissure", "dungeon", "harmony"],
     dict(kind="cracks_fissure", base=(238, 96, 24), glow=(255, 168, 46))),
    ("path_arcane_cyan_fissure", "Glowing Cyan Aether Ley-Line Floor Crack", ["path", "arcane", "aether", "crack", "fissure", "magipunk", "harmony"],
     dict(kind="cracks_fissure", base=(64, 198, 228), glow=(88, 228, 250))),
    ("path_arcane_violet_fissure", "Glowing Violet Rift Floor Fissure", ["path", "arcane", "violet", "crack", "fissure", "harmony"],
     dict(kind="cracks_fissure", base=(158, 78, 228), glow=(188, 114, 252))),
    ("path_glacial_ice_crack", "Deep Frosted Glacial Ice Crevasse Crack", ["path", "ice", "crack", "frost", "winter", "harmony"],
     dict(kind="cracks_fissure", base=(88, 158, 198), glow=(196, 238, 255))),
    ("path_dry_stone_crack", "Weathered Deep Masonry Floor Fracture", ["path", "crack", "stone", "ruin", "damage", "harmony"],
     dict(kind="cracks_fissure", base=(44, 42, 42))),

    # --- D. 16 Overhead Festoons, Foliage & Street Dressing Paths ---
    ("path_cafe_warm_string_lights", "Warm Amber Café Courtyard String Lights", ["path", "lights", "cafe", "courtyard", "festival", "berlin", "harmony"],
     dict(kind="garland_festoon", w=512, h=112, sub="lights", glow=(255, 206, 98))),
    ("path_aether_cyan_lantern_line", "Magipunk Cyan Aether-Bulb Street Garland", ["path", "lights", "aether", "cyan", "magipunk", "harmony"],
     dict(kind="garland_festoon", w=512, h=112, sub="lights", glow=(78, 224, 246))),
    ("path_festival_crimson_lanterns", "Glowing Crimson Paper Festival Lantern Line", ["path", "lights", "lantern", "festival", "crimson", "harmony"],
     dict(kind="garland_festoon", w=512, h=112, sub="lights", glow=(242, 86, 68))),
    ("path_carnival_pennant_bunting", "Festive Carnival Pennant Bunting Line", ["path", "bunting", "festival", "courtyard", "park", "harmony"],
     dict(kind="garland_festoon", w=512, h=112, sub="bunting")),
    ("path_sovereign_banner_bunting", "Sovereign Crimson & Gold Processional Bunting", ["path", "bunting", "sovereign", "cathedral", "gold", "harmony"],
     dict(kind="garland_festoon", w=512, h=112, sub="bunting", colors=[(148, 28, 38), (222, 182, 72), (88, 38, 96), (222, 182, 72)])),
    ("path_maritime_signal_flags", "Harbor Maritime Signal-Flag Pennant Line", ["path", "bunting", "harbor", "ship", "flags", "harmony"],
     dict(kind="garland_festoon", w=512, h=112, sub="bunting", colors=[(46, 92, 164), (232, 226, 212), (218, 174, 54), (178, 46, 48)])),
    ("path_berlin_white_laundry", "Berlin Tenement White-Sheet Clothesline", ["path", "laundry", "tenement", "alley", "berlin", "harmony"],
     dict(kind="garland_festoon", w=512, h=112, sub="laundry", colors=[(234, 228, 214), (212, 218, 224), (226, 214, 194), (186, 198, 208)])),
    ("path_climbing_rose_vine", "Blooming Crimson-Rose Climbing Vine Garland", ["path", "vine", "roses", "garden", "park", "harmony"],
     dict(kind="garland_festoon", sub="vine", base=(62, 118, 52), blossom=(222, 58, 76))),
    ("path_wisteria_violet_vine", "Blooming Violet Wisteria Pergola Vine", ["path", "vine", "wisteria", "violet", "garden", "harmony"],
     dict(kind="garland_festoon", sub="vine", base=(68, 122, 58), blossom=(168, 112, 232))),
    ("path_golden_ivy_autumn", "Autumn Amber & Russet Ivy Garland", ["path", "vine", "autumn", "ivy", "park", "harmony"],
     dict(kind="garland_festoon", sub="vine", base=(178, 102, 42), blossom=(232, 178, 54))),
    ("path_winter_evergreen_garland", "Winter Pine & Holly Berry Festival Garland", ["path", "vine", "winter", "pine", "holly", "harmony"],
     dict(kind="garland_festoon", sub="vine", base=(44, 88, 54), blossom=(208, 44, 48))),
    ("path_wildflower_meadow_border", "Wildflower & Marigold Garden Bed Border", ["path", "flowers", "garden", "park", "border", "harmony"],
     dict(kind="flower_border", base=(68, 124, 56), blossom=(242, 196, 56))),
    ("path_lavender_park_border", "Fragrant Purple Lavender Garden Border", ["path", "flowers", "lavender", "garden", "park", "harmony"],
     dict(kind="flower_border", base=(74, 122, 68), blossom=(168, 114, 228))),
    ("path_brass_stanchion_velvet", "Brass Stanchion & Crimson Velvet Rope Barrier", ["path", "rope", "velvet", "theater", "palace", "harmony"],
     dict(kind="rope_fence", base=(212, 174, 72), accent=(158, 32, 42))),
    ("path_heavy_brass_chain", "Ornamental Polished Brass Chain Barrier", ["path", "chain", "brass", "temple", "berlin", "harmony"],
     dict(kind="garland_festoon", sub="chain", base=(198, 160, 68))),
    ("path_barbed_security_wire", "Coiled Iron Barbed-Wire Barricade Line", ["path", "wire", "barbed", "military", "prison", "harmony"],
     dict(kind="garland_festoon", w=512, h=96, sub="chain", base=(78, 84, 92))),

    # --- E. 14 Architectural Stairs, Ledges & Terraces ---
    ("path_stairs_berlin_granite", "Berlin Civic Wide Granite Stair Strip", ["path", "stairs", "granite", "berlin", "civic", "harmony"],
     dict(kind="stair_strip", base=(142, 140, 138), trim=(104, 106, 110), steps=16)),
    ("path_stairs_crimson_carpet", "Oak & Crimson-Runner Manor Stair Strip", ["path", "stairs", "wood", "carpet", "manor", "harmony"],
     dict(kind="stair_strip", base=(152, 106, 64), trim=(102, 66, 38), runner=(148, 34, 42), accent=(214, 176, 74), steps=14)),
    ("path_stairs_emerald_carpet", "Walnut & Emerald-Runner Salon Stair Strip", ["path", "stairs", "wood", "carpet", "emerald", "harmony"],
     dict(kind="stair_strip", base=(118, 78, 46), trim=(82, 52, 32), runner=(42, 104, 72), accent=(214, 178, 76), steps=14)),
    ("path_stairs_sovereign_obsidian", "Obsidian & Brass Cathedral Crypt Stair Strip", ["path", "stairs", "obsidian", "brass", "sovereign", "harmony"],
     dict(kind="stair_strip", base=(68, 66, 76), trim=(194, 158, 72), steps=16)),
    ("path_stairs_sandstone_temple", "Sun-Bleached Sandstone Citadel Stair Strip", ["path", "stairs", "sandstone", "desert", "temple", "harmony"],
     dict(kind="stair_strip", base=(202, 174, 126), trim=(162, 134, 88), steps=14)),
    ("path_stairs_mossy_ruin", "Moss-Overgrown Ancient Ruin Stone Stairs", ["path", "stairs", "moss", "ruin", "dungeon", "harmony"],
     dict(kind="stair_strip", base=(122, 126, 118), trim=(82, 104, 72), steps=14)),
    ("path_stairs_red_brick", "Warm Berlin Red-Brick Garden Stair Strip", ["path", "stairs", "brick", "garden", "berlin", "harmony"],
     dict(kind="stair_strip", base=(164, 84, 58), trim=(118, 62, 44), steps=16)),
    ("path_stairs_brass_industrial", "Brass-Trimmed Iron Engine-Room Stair Strip", ["path", "stairs", "iron", "brass", "magipunk", "harmony"],
     dict(kind="stair_strip", base=(84, 92, 102), trim=(194, 158, 72), steps=18)),
    ("path_embank_brick_viaduct", "Berlin Red-Brick Railway Embankment Slope", ["path", "embankment", "brick", "railway", "berlin", "harmony"],
     dict(kind="cliff_embankment", w=512, h=256, sub="masonry", base=(154, 76, 54))),
    ("path_embank_canal_quay", "Mossy Canal Stone Retaining Embankment", ["path", "embankment", "canal", "stone", "moss", "harmony"],
     dict(kind="cliff_embankment", w=512, h=256, sub="masonry", base=(112, 122, 114))),
    ("path_embank_limestone_terrace", "Carved Limestone Palace Terrace Drop", ["path", "embankment", "limestone", "terrace", "palace", "harmony"],
     dict(kind="cliff_embankment", w=512, h=256, sub="masonry", base=(204, 194, 174))),
    ("path_embank_autumn_berm", "Autumn Golden-Grass Park Hillside Berm", ["path", "embankment", "autumn", "grass", "park", "harmony"],
     dict(kind="cliff_embankment", w=512, h=256, sub="grass", base=(168, 124, 58))),
    ("path_embank_volcanic_ridge", "Volcanic Dark Basalt Crater Cliff Drop", ["path", "embankment", "volcanic", "cliff", "obsidian", "harmony"],
     dict(kind="cliff_embankment", w=512, h=256, sub="rock", base=(64, 60, 70))),
    ("path_embank_glacier_wall", "Icy Blue Glacial Crevasse Cliff Edge", ["path", "embankment", "ice", "glacier", "winter", "harmony"],
     dict(kind="cliff_embankment", w=512, h=256, sub="rock", base=(146, 202, 232))),
]


# =============================================================================
# 2. SEAMLESS 512x512 PAINTERLY TERRAIN & ROOF GENERATOR (2D PERIODIC!)
# =============================================================================
def render_seamless_terrain(spec: dict[str, Any]) -> Image.Image:
    """Renders a 100% 2D-periodic seamless 512x512 painterly floor, street, nature, or roof texture."""
    kind = spec["kind"]
    S = 512
    seed = int(spec.get("seed", 5001))
    rng = random.Random(seed)
    base_rgb = DD_RED_BASE if spec.get("colorable", False) else spec.get("base", (142, 138, 132))
    alt_rgb = spec.get("alt", shade_rgb(base_rgb, 0.86)[:3])
    mortar_rgb = spec.get("mortar", (52, 48, 46))
    accent_rgb = spec.get("accent", (206, 168, 72))
    moss = float(spec.get("moss", 0.0))

    im = Image.new("RGBA", (S, S), (*mortar_rgb, 255))
    d = ImageDraw.Draw(im)

    if kind == "parquet_herringbone":
        # Classic European herringbone parquet floorboards (periodic mod 512!)
        step = 64
        for y in range(-step, S + step, step):
            for x in range(-step, S + step, step):
                ix, iy = (x // step) % (S // step), (y // step) % (S // step)
                p_rng = random.Random(seed + ix * 97 + iy * 31)
                c1 = vary_rgb(base_rgb, p_rng, 14)
                c2 = vary_rgb(alt_rgb, p_rng, 14)
                if (ix + iy) % 2 == 0:
                    for sub in range(2):
                        draw_beveled_rect(d, x, y + sub * (step // 2), x + step, y + (sub + 1) * (step // 2), vary_rgb(c1, p_rng, 8), ink_w=2, hi_amt=0.22, sh_amt=0.30)
                else:
                    for sub in range(2):
                        draw_beveled_rect(d, x + sub * (step // 2), y, x + (sub + 1) * (step // 2), y + step, vary_rgb(c2, p_rng, 8), ink_w=2, hi_amt=0.22, sh_amt=0.30)

    elif kind == "planks":
        # Wide hand-scraped floorboards / attic planks / painted cottage planks (periodic!)
        rows = int(spec.get("rows", 8))
        cols = int(spec.get("cols", 4))
        ph, pw = S // rows, S // cols
        for r in range(rows):
            off = (pw // 2) if r % 2 == 1 else 0
            for c in range(-1, cols + 1):
                p_rng = random.Random(seed + r * 89 + (c % cols) * 23)
                col = vary_rgb(base_rgb, p_rng, 14)
                px0, py0 = c * pw + off, r * ph
                px1, py1 = px0 + pw, py0 + ph
                draw_beveled_rect(d, px0 + 1, py0 + 1, px1 - 1, py1 - 1, col, ink_w=2, hi_amt=0.22, sh_amt=0.32)
                # Fine wood grain lines
                dk = blend_rgb(col, (32, 20, 12), 0.28)
                for _ in range(4):
                    gy = p_rng.uniform(py0 + 6, py1 - 6)
                    d.line([(px0 + 4, gy), (px1 - 4, gy + p_rng.uniform(-2, 2))], fill=dk, width=1)
                # Plank-end nails
                for nx in (px0 + 8, px1 - 8):
                    for ny in (py0 + 10, py1 - 10):
                        d.ellipse([nx - 2, ny - 2, nx + 2, ny + 2], fill=(42, 36, 34, 255))

    elif kind == "tile_checker":
        # Checkerboard / diamond marble / encaustic foyer tiles (periodic!)
        n = int(spec.get("n", 8))
        ts = S // n
        diamond = bool(spec.get("diamond", False))
        for r in range(n):
            for c in range(n):
                t_rng = random.Random(seed + r * 67 + c * 17)
                col = vary_rgb(base_rgb if (r + c) % 2 == 0 else alt_rgb, t_rng, 8)
                x0, y0 = c * ts, r * ts
                draw_beveled_rect(d, x0 + 1, y0 + 1, x0 + ts - 1, y0 + ts - 1, col, ink_w=2, hi_amt=0.28, sh_amt=0.30)
                if diamond:
                    mx, my = x0 + ts * 0.5, y0 + ts * 0.5
                    dr = ts * 0.28
                    d.polygon([(mx, my - dr), (mx + dr, my), (mx, my + dr), (mx - dr, my)], fill=(*accent_rgb, 255), outline=INK_MID, width=2)

    elif kind == "tile_hex":
        # Art Nouveau / Victorian hexagonal mosaic floor tile!
        r_hex = 32
        dx = 64
        dy = 64
        for row in range(-1, S // dy + 2):
            for col in range(-1, S // dx + 2):
                cx = col * dx + (dx // 2 if row % 2 == 1 else 0)
                cy = row * dy
                h_rng = random.Random(seed + (row % (S // dy)) * 83 + (col % (S // dx)) * 19)
                hc = base_rgb if (row + col) % 3 != 0 else alt_rgb
                if (row * 3 + col) % 5 == 0:
                    hc = accent_rgb
                hc = vary_rgb(hc, h_rng, 8)
                pts = [(cx + math.cos(k * math.tau / 6 + math.pi / 6) * (r_hex - 2), cy + math.sin(k * math.tau / 6 + math.pi / 6) * (r_hex - 2)) for k in range(6)]
                d.polygon(pts, fill=(*hc, 255), outline=INK_MID)
                d.line(pts + [pts[0]], fill=INK_MID, width=2)

    elif kind == "stone_slabs":
        # Chiseled flagstones / cloister slabs / Roman travertine / moss crypt slabs (periodic!)
        rows, cols = int(spec.get("rows", 6)), int(spec.get("cols", 6))
        bw, bh = S // cols, S // rows
        for r in range(rows):
            off = (bw // 2) if r % 2 == 1 else 0
            for c in range(-1, cols + 1):
                b_rng = random.Random(seed + r * 101 + (c % cols) * 29)
                draw_stone_block(d, c * bw + off + 2, r * bh + 2, (c + 1) * bw + off - 2, (r + 1) * bh - 2, base_rgb, b_rng, ink_w=2, moss=moss, cracks=float(spec.get("cracks", 0.45)), radius=4)

    elif kind == "berlin_fan_cobbles":
        # Iconic European fan-arc granite setts (Bogenpflaster) — periodic mod 512!
        cell = 128
        for gy in range(-1, S // cell + 2):
            for gx in range(-1, S // cell + 2):
                ox = gx * cell + (cell // 2 if gy % 2 == 1 else 0)
                oy = gy * cell + cell
                for ring_i, rad in enumerate((26, 52, 78, 104)):
                    n_s = 4 + ring_i * 3
                    for k in range(n_s):
                        ang = -math.pi * 0.85 + (k + 0.5) * (math.pi * 0.70 / n_s)
                        sx = ox + math.cos(ang) * rad
                        sy = oy + math.sin(ang) * rad
                        c_rng = random.Random(seed + (gy % 4) * 199 + (gx % 4) * 53 + ring_i * 17 + k)
                        scol = vary_rgb(base_rgb, c_rng, 18)
                        d.rounded_rectangle([sx - 11, sy - 9, sx + 11, sy + 9], radius=4, fill=(*scol, 255), outline=INK, width=2)
                        d.line([(sx - 7, sy - 6), (sx + 7, sy - 6)], fill=blend_rgb(scol, (238, 238, 232), 0.32), width=2)

    elif kind == "brick_paving":
        # Brick courtyard / herringbone sidewalk (periodic!)
        rows, cols = int(spec.get("rows", 12)), int(spec.get("cols", 8))
        bw, bh = S // cols, S // rows
        for r in range(rows):
            off = (bw // 2) if r % 2 == 1 else 0
            for c in range(-1, cols + 1):
                b_rng = random.Random(seed + r * 97 + (c % cols) * 19)
                draw_beveled_rect(d, c * bw + off + 2, r * bh + 2, (c + 1) * bw + off - 2, (r + 1) * bh - 2, vary_rgb(base_rgb, b_rng, 16), ink_w=2, radius=2)
                if moss > 0 and b_rng.random() < moss:
                    mx = c * bw + off + bw * 0.5
                    my = r * bh + bh * 0.5
                    d.ellipse([mx - 6, my - 4, mx + 6, my + 4], fill=(72, 114, 52, 255))

    elif kind == "metal_deck":
        # Riveted brass/iron engine-room plate or perforated industrial steel grate!
        n = int(spec.get("n", 4))
        ps = S // n
        grate = bool(spec.get("grate", False))
        for r in range(n):
            for c in range(n):
                x0, y0 = c * ps, r * ps
                draw_beveled_rect(d, x0 + 2, y0 + 2, x0 + ps - 2, y0 + ps - 2, vary_rgb(base_rgb, random.Random(seed + r * 31 + c), 6), ink_w=3)
                if grate:
                    for gy in range(y0 + 16, y0 + ps - 10, 20):
                        for gx in range(x0 + 16, x0 + ps - 10, 20):
                            d.polygon([(gx, gy - 5), (gx + 5, gy), (gx, gy + 5), (gx - 5, gy)], fill=(24, 28, 34, 255))
                else:
                    for rx in (x0 + 12, x0 + ps - 12):
                        for ry in (y0 + 12, y0 + ps - 12):
                            d.ellipse([rx - 4, ry - 4, rx + 4, ry + 4], fill=(*accent_rgb, 255), outline=INK, width=2)

    elif kind == "carpet_woven":
        # Seamless ornate Victorian / observatory / crimson parlor carpet (periodic!)
        d.rectangle([0, 0, S, S], fill=(*base_rgb, 255))
        step = 64
        for y in range(0, S, step):
            for x in range(0, S, step):
                mx, my = x + step // 2, y + step // 2
                d.polygon([(mx, y + 6), (x + step - 6, my), (mx, y + step - 6), (x + 6, my)], fill=blend_rgb(base_rgb, alt_rgb, 0.45), outline=blend_rgb(base_rgb, accent_rgb, 0.55), width=2)
                d.ellipse([mx - 8, my - 8, mx + 8, my + 8], fill=blend_rgb(base_rgb, accent_rgb, 0.72), outline=INK_MID, width=1)

    elif kind == "nature_organic":
        # Seamless lush meadow / woodland moss / autumn leaves / snowdrifts / gravel / sand / water!
        n1 = fbm_periodic(S, S, ((4, 4, 0.5), (10, 10, 0.3), (24, 24, 0.2)), seed=seed)
        n2 = fbm_periodic(S, S, ((16, 16, 0.55), (40, 40, 0.45)), seed=seed + 313)
        arr = np.zeros((S, S, 4), dtype=np.uint8)
        for c in range(3):
            v = base_rgb[c] * (1.0 - n1 * 0.45) + alt_rgb[c] * (n1 * 0.45) + (n2 - 0.5) * 32.0
            arr[:, :, c] = np.clip(v, 0, 255).astype(np.uint8)
        arr[:, :, 3] = 255
        im = Image.fromarray(arr, "RGBA")
        d = ImageDraw.Draw(im)
        sub = spec.get("sub", "grass")
        # Periodic organic surface details wrapping mod S!
        n_det = int(spec.get("details", 120))
        for _ in range(n_det):
            px, py = rng.uniform(0, S), rng.uniform(0, S)
            for ox in (-S, 0, S):
                for oy in (-S, 0, S):
                    if -32 <= px + ox <= S + 32 and -32 <= py + oy <= S + 32:
                        if sub == "leaves":
                            lr = rng.uniform(7, 15)
                            lc = vary_rgb(rng.choice([base_rgb, alt_rgb, accent_rgb]), rng, 18)
                            d.ellipse([px + ox - lr, py + oy - lr * 0.65, px + ox + lr, py + oy + lr * 0.65], fill=(*lc, 255), outline=INK_MID, width=1)
                        elif sub == "pebbles":
                            pr = rng.uniform(5, 13)
                            pc = vary_rgb(rng.choice([base_rgb, alt_rgb]), rng, 20)
                            d.ellipse([px + ox - pr, py + oy - pr * 0.75, px + ox + pr, py + oy + pr * 0.75], fill=(*pc, 255), outline=INK_MID, width=2)
                        elif sub == "grass":
                            lc = vary_rgb(accent_rgb if rng.random() < 0.14 else blend_rgb(base_rgb, (218, 236, 132), 0.35)[:3], rng, 14)
                            d.line([(px + ox, py + oy), (px + ox + rng.uniform(-5, 5), py + oy - rng.uniform(6, 12))], fill=(*lc, 255), width=2)
                        elif sub == "water":
                            d.arc([px + ox - 28, py + oy - 10, px + ox + 28, py + oy + 10], start=190, end=350, fill=blend_rgb(base_rgb, (236, 250, 255), 0.55), width=3)

    elif kind == "roof_shingles":
        # Seamless architectural roof tiles: slate, fishscale, diamond, standing-seam copper, barrel, thatch, glass!
        sub = spec.get("sub", "slate")
        if sub == "standing_seam":
            # Verdigris or warm aged copper standing-seam sheet metal roof!
            cols = 8
            cw = S // cols
            for c in range(cols):
                col = vary_rgb(base_rgb, random.Random(seed + c), 10)
                draw_beveled_rect(d, c * cw + 4, 0, (c + 1) * cw - 4, S, col, ink_w=2, hi_amt=0.25, sh_amt=0.28)
                draw_beveled_rect(d, c * cw - 4, 0, c * cw + 4, S, shade_rgb(base_rgb, 0.72)[:3], ink_w=2)
            for y in range(64, S, 128):
                d.line([(0, y), (S, y)], fill=INK_MID, width=2)
        elif sub == "barrel":
            # Curved ribbed Tuscan terracotta or glazed jade ceramic barrel roof tiles!
            cols, rows = 12, 8
            cw, rh = S / cols, S / rows
            for c in range(cols):
                for r in range(rows):
                    t_rng = random.Random(seed + r * 53 + c * 17)
                    col = vary_rgb(base_rgb, t_rng, 14)
                    x0, y0 = c * cw, r * rh
                    d.rounded_rectangle([x0 + 1, y0, x0 + cw - 1, y0 + rh + 4], radius=10, fill=(*col, 255), outline=INK, width=2)
                    # Curved ridge specular highlight down left-center of barrel!
                    d.line([(x0 + cw * 0.34, y0 + 3), (x0 + cw * 0.34, y0 + rh - 3)], fill=blend_rgb(col, (252, 232, 204), 0.38), width=5)
                    d.line([(x0 + cw * 0.78, y0 + 3), (x0 + cw * 0.78, y0 + rh - 3)], fill=blend_rgb(col, (24, 18, 18), 0.38), width=4)
        elif sub == "fishscale":
            rows, cols = 12, 10
            cw, rh = S / cols, S / rows
            for r in range(-1, rows + 1):
                off = (cw * 0.5) if r % 2 == 1 else 0.0
                for c in range(-1, cols + 2):
                    t_rng = random.Random(seed + (r % rows) * 73 + (c % cols) * 19)
                    col = vary_rgb(base_rgb, t_rng, 12)
                    x0, y0 = c * cw + off, r * rh
                    d.pieslice([x0, y0 - rh * 0.5, x0 + cw, y0 + rh * 1.15], start=0, end=180, fill=(*col, 255), outline=INK, width=2)
        elif sub == "glass_roof":
            cols, rows = 8, 6
            cw, rh = S // cols, S // rows
            d.rectangle([0, 0, S, S], fill=(*mortar_rgb, 255))
            for r in range(rows):
                for c in range(cols):
                    x0, y0 = c * cw, r * rh
                    draw_beveled_rect(d, x0 + 4, y0 + 4, x0 + cw - 4, y0 + rh - 4, vary_rgb(base_rgb, random.Random(seed + r * 31 + c), 8), ink_w=2, hi_amt=0.45, sh_amt=0.22)
                    d.line([(x0 + 10, y0 + rh - 10), (x0 + cw - 12, y0 + 10)], fill=blend_rgb(base_rgb, (255, 255, 255), 0.55), width=3)
        elif sub == "thatch":
            d.rectangle([0, 0, S, S], fill=(*base_rgb, 255))
            for y in range(0, S, 32):
                d.line([(0, y), (S, y)], fill=shade_rgb(base_rgb, 0.72), width=4)
            for _ in range(950):
                sx = rng.uniform(0, S)
                sy = rng.uniform(0, S)
                col = vary_rgb(base_rgb, rng, 26)
                for oy in (-S, 0, S):
                    if -40 <= sy + oy <= S + 40:
                        d.line([(sx, sy + oy), (sx + rng.uniform(-3, 3), sy + oy + rng.uniform(18, 38))], fill=(*col, 255), width=2)
        else:
            # Slate / diamond / wood shake shingles (periodic!)
            rows, cols = int(spec.get("rows", 12)), int(spec.get("cols", 10))
            cw, rh = S / cols, S / rows
            for r in range(rows):
                off = (cw * 0.5) if r % 2 == 1 else 0.0
                for c in range(-1, cols + 1):
                    t_rng = random.Random(seed + r * 89 + (c % cols) * 19)
                    col = vary_rgb(alt_rgb if (sub == "diamond" and (r + c) % 3 == 0) else base_rgb, t_rng, 12)
                    x0, y0 = c * cw + off, r * rh
                    draw_beveled_rect(d, x0 + 1, y0 + 1, x0 + cw - 1, y0 + rh - 1, col, ink_w=2, radius=2)
                    if spec.get("snow", False) and t_rng.random() < 0.45:
                        d.rounded_rectangle([x0 + 3, y0 + 2, x0 + cw - 3, y0 + rh * 0.55], radius=4, fill=(234, 242, 248, 255))
                    if moss > 0 and t_rng.random() < moss:
                        d.ellipse([x0 + 6, y0 + rh - 12, x0 + 22, y0 + rh - 2], fill=(74, 114, 54, 255))

    return apply_painterly_finish(im, S, S, seed=seed, grain=5.4, periodic_xy=True, warm_bevel=False)


# =============================================================================
# 3. 60 BRAND-NEW UNIQUE PAINTERLY TERRAINS & ROOFS (512x512 seamless!)
# =============================================================================
NEW_TERRAINS: list[tuple[str, str, list[str], dict]] = [
    # --- A. 24 Interior Floors ---
    ("flr_honey_oak_herringbone", "Honey-Oak Herringbone Parquet Floor", ["terrain", "floor", "wood", "parquet", "oak", "berlin", "harmony"],
     dict(kind="parquet_herringbone", base=(168, 120, 68), alt=(154, 108, 60))),
    ("flr_dark_walnut_parquet", "Dark Walnut Chevron Parquet Floor", ["terrain", "floor", "wood", "parquet", "walnut", "manor", "harmony"],
     dict(kind="parquet_herringbone", base=(106, 70, 44), alt=(92, 58, 36))),
    ("flr_weathered_attic_planks", "Weathered Wide-Plank Attic Floorboards", ["terrain", "floor", "wood", "planks", "attic", "tenement", "harmony"],
     dict(kind="planks", base=(134, 102, 72), rows=8, cols=4)),
    ("flr_painted_blue_cottage", "Painted Dusty-Blue Cottage Floorboards", ["terrain", "floor", "wood", "blue", "cottage", "harmony"],
     dict(kind="planks", base=(104, 128, 146), rows=8, cols=4)),
    ("flr_bleached_pine_workshop", "Sun-Bleached Pine Workshop Floorboards", ["terrain", "floor", "wood", "pine", "workshop", "harmony"],
     dict(kind="planks", base=(186, 150, 102), rows=8, cols=4)),
    ("flr_cathedral_diamond_marble", "Cathedral Ivory & Obsidian Diamond Marble", ["terrain", "floor", "marble", "cathedral", "gothic", "harmony"],
     dict(kind="tile_checker", base=(226, 220, 206), alt=(56, 58, 68), accent=(212, 174, 74), diamond=True, n=6)),
    ("flr_jugendstil_hex_mosaic", "Berlin Jugendstil Teal & Cream Hex Mosaic", ["terrain", "floor", "tile", "mosaic", "jugendstil", "berlin", "harmony"],
     dict(kind="tile_hex", base=(224, 218, 204), alt=(66, 142, 146), accent=(212, 174, 74))),
    ("flr_victorian_foyer_encaustic", "Victorian Burgundy & Cream Foyer Tile", ["terrain", "floor", "tile", "victorian", "foyer", "harmony"],
     dict(kind="tile_checker", base=(224, 216, 198), alt=(142, 46, 52), accent=(206, 168, 72), diamond=True, n=8)),
    ("flr_emerald_parlor_checker", "Emerald & Ivory Parlor Checkerboard Tile", ["terrain", "floor", "tile", "emerald", "parlor", "harmony"],
     dict(kind="tile_checker", base=(228, 224, 212), alt=(48, 106, 78), n=8)),
    ("flr_cobalt_bathhouse_mosaic", "Cobalt & Pearl Bathhouse Hex Mosaic Floor", ["terrain", "floor", "tile", "bathhouse", "cobalt", "harmony"],
     dict(kind="tile_hex", base=(228, 232, 234), alt=(64, 114, 168), accent=(148, 198, 220))),
    ("flr_terracotta_kitchen_quarry", "Warm Terracotta Quarry Kitchen Tile Floor", ["terrain", "floor", "tile", "terracotta", "kitchen", "harmony"],
     dict(kind="tile_checker", base=(178, 94, 62), alt=(164, 84, 54), n=8)),
    ("flr_sovereign_gilded_mosaic", "Sovereign Plum & Gold Sanctuary Tile", ["terrain", "floor", "tile", "sovereign", "temple", "gold", "harmony"],
     dict(kind="tile_checker", base=(88, 44, 96), alt=(220, 212, 192), accent=(224, 186, 76), diamond=True, n=6)),
    ("flr_limestone_cloister_slabs", "Aged Limestone Cathedral Cloister Slabs", ["terrain", "floor", "stone", "limestone", "cathedral", "harmony"],
     dict(kind="stone_slabs", base=(172, 166, 152), mortar=(76, 72, 66), rows=6, cols=6, moss=0.06)),
    ("flr_dark_slate_hall_slabs", "Polished Charcoal-Slate Grand Hall Slabs", ["terrain", "floor", "slate", "dark", "stone", "harmony"],
     dict(kind="stone_slabs", base=(82, 88, 98), mortar=(34, 38, 44), rows=6, cols=6)),
    ("flr_mossy_crypt_tomb_slabs", "Mossy Cracked Underground Crypt Slabs", ["terrain", "floor", "crypt", "moss", "dungeon", "harmony"],
     dict(kind="stone_slabs", base=(108, 114, 106), mortar=(42, 48, 42), rows=6, cols=5, moss=0.55, cracks=0.75)),
    ("flr_damp_basement_concrete", "Stained Damp Cellar Concrete Floor", ["terrain", "floor", "concrete", "cellar", "industrial", "harmony"],
     dict(kind="stone_slabs", base=(128, 130, 126), mortar=(62, 64, 62), rows=4, cols=4, cracks=0.8)),
    ("flr_brass_engine_deck", "Riveted Brass & Iron Magipunk Engine Deck", ["terrain", "floor", "metal", "brass", "magipunk", "engine", "harmony"],
     dict(kind="metal_deck", base=(74, 82, 92), accent=(212, 174, 72), n=4)),
    ("flr_steel_factory_grating", "Perforated Industrial Steel Grating Floor", ["terrain", "floor", "metal", "grate", "industrial", "factory", "harmony"],
     dict(kind="metal_deck", base=(78, 86, 96), accent=(148, 156, 164), n=4, grate=True)),
    ("flr_copper_boiler_plates", "Hammered Copper Boiler-Room Floor Plates", ["terrain", "floor", "copper", "steampunk", "boiler", "harmony"],
     dict(kind="metal_deck", base=(146, 92, 62), accent=(218, 178, 84), n=4)),
    ("flr_crimson_parlor_carpet", "Woven Crimson & Gold Salon Carpet Floor", ["terrain", "floor", "carpet", "crimson", "manor", "harmony"],
     dict(kind="carpet_woven", base=(142, 34, 44), alt=(112, 24, 32), accent=(218, 180, 74))),
    ("flr_emerald_grand_carpet", "Emerald Velvet Library Carpet Floor", ["terrain", "floor", "carpet", "emerald", "library", "harmony"],
     dict(kind="carpet_woven", base=(42, 102, 74), alt=(32, 80, 58), accent=(214, 178, 76))),
    ("flr_navy_observatory_carpet", "Midnight-Navy Starlight Observatory Carpet", ["terrain", "floor", "carpet", "navy", "observatory", "harmony"],
     dict(kind="carpet_woven", base=(42, 58, 98), alt=(32, 44, 78), accent=(224, 192, 86))),
    ("flr_worn_cellar_earth", "Packed Earth & Straw Tavern Cellar Floor", ["terrain", "floor", "dirt", "cellar", "tavern", "harmony"],
     dict(kind="nature_organic", sub="grass", base=(116, 92, 66), alt=(92, 72, 50), accent=(182, 152, 88), details=140)),
    ("flr_col_victorian_carpet", "Colorable Patterned Victorian Carpet Floor", ["terrain", "floor", "colorable", "carpet", "modular", "harmony"],
     dict(kind="carpet_woven", colorable=True, alt=DD_RED_DEEP, accent=(238, 196, 140))),

    # --- B. 18 Exterior Streets, Plazas & Nature ---
    ("ext_berlin_fan_cobbles", "Berlin Fan-Arc Granite Cobblestones (Bogenpflaster)", ["terrain", "street", "berlin", "cobble", "granite", "harmony"],
     dict(kind="berlin_fan_cobbles", base=(134, 138, 144), mortar=(52, 54, 60))),
    ("ext_berlin_wet_basalt_fan", "Rain-Wet Dark Basalt Fan Cobblestones", ["terrain", "street", "berlin", "cobble", "wet", "dark", "harmony"],
     dict(kind="berlin_fan_cobbles", base=(88, 96, 108), mortar=(34, 38, 46))),
    ("ext_travertine_civic_plaza", "Warm Roman Travertine Civic Plaza Slabs", ["terrain", "plaza", "stone", "travertine", "civic", "harmony"],
     dict(kind="stone_slabs", base=(208, 196, 174), mortar=(118, 108, 94), rows=6, cols=6, cracks=0.25)),
    ("ext_red_brick_sidewalk", "Warm Red-Brick Courtyard Sidewalk Paving", ["terrain", "brick", "sidewalk", "courtyard", "berlin", "harmony"],
     dict(kind="brick_paving", base=(164, 82, 58), mortar=(76, 64, 56), rows=12, cols=8, moss=0.06)),
    ("ext_yellow_klinker_plaza", "Berlin Yellow Klinker-Brick Courtyard Paving", ["terrain", "brick", "yellow", "berlin", "courtyard", "harmony"],
     dict(kind="brick_paving", base=(198, 168, 98), mortar=(88, 78, 62), rows=12, cols=8, moss=0.06)),
    ("ext_mossy_courtyard_flags", "Moss-Creviced Hinterhof Courtyard Flagstones", ["terrain", "courtyard", "flagstone", "moss", "berlin", "harmony"],
     dict(kind="stone_slabs", base=(136, 134, 128), mortar=(58, 66, 52), rows=6, cols=6, moss=0.45)),
    ("ext_park_ochre_gravel", "Sunlit Ochre Gravel Park Promenade", ["terrain", "gravel", "park", "path", "garden", "harmony"],
     dict(kind="nature_organic", sub="pebbles", base=(184, 168, 138), alt=(162, 144, 114), details=160)),
    ("ext_weed_alley_cobbles", "Weedy Working-Class Alleyway Cobbles", ["terrain", "alley", "cobble", "moss", "berlin", "harmony"],
     dict(kind="brick_paving", base=(118, 120, 124), mortar=(54, 62, 48), rows=14, cols=10, moss=0.38)),
    ("ext_clover_dandelion_meadow", "Sunlit Clover & Dandelion Park Meadow", ["terrain", "grass", "meadow", "park", "clover", "harmony"],
     dict(kind="nature_organic", sub="grass", base=(96, 146, 62), alt=(74, 122, 48), accent=(244, 212, 68), details=180)),
    ("ext_shaded_woodland_fern", "Shaded Woodland Moss & Fern Floor", ["terrain", "forest", "moss", "fern", "grass", "harmony"],
     dict(kind="nature_organic", sub="grass", base=(68, 108, 52), alt=(48, 82, 42), accent=(128, 168, 76), details=170)),
    ("ext_autumn_golden_leaves", "Autumn Golden-Oak & Maple Leaf Litter", ["terrain", "autumn", "leaves", "forest", "park", "harmony"],
     dict(kind="nature_organic", sub="leaves", base=(158, 92, 44), alt=(198, 138, 48), accent=(182, 54, 42), details=190)),
    ("ext_rain_mud_pebbles", "Rain-Soaked Muddy Alley Dirt & Pebbles", ["terrain", "mud", "dirt", "rain", "alley", "harmony"],
     dict(kind="nature_organic", sub="pebbles", base=(104, 78, 54), alt=(78, 58, 42), details=140)),
    ("ext_frost_rimed_grass", "Frost-Rimed Late-Autumn Park Lawn", ["terrain", "winter", "frost", "grass", "park", "harmony"],
     dict(kind="nature_organic", sub="grass", base=(128, 152, 124), alt=(186, 206, 214), accent=(232, 242, 248), details=160)),
    ("ext_crisp_snowdrifts", "Crisp Wind-Rippled Winter Snowdrifts", ["terrain", "snow", "winter", "ice", "harmony"],
     dict(kind="nature_organic", sub="water", base=(226, 238, 248), alt=(196, 218, 236), details=90)),
    ("ext_coastal_shell_sand", "Warm Coastal Beach Sand & Pebbles", ["terrain", "sand", "beach", "coastal", "harmony"],
     dict(kind="nature_organic", sub="pebbles", base=(218, 198, 154), alt=(198, 174, 128), details=120)),
    ("ext_alpine_granite_scree", "Alpine Chiseled Granite Talus Scree", ["terrain", "mountain", "rock", "granite", "alpine", "harmony"],
     dict(kind="nature_organic", sub="pebbles", base=(124, 128, 136), alt=(92, 96, 106), details=190)),
    ("ext_volcanic_basalt_ash", "Volcanic Charcoal Basalt & Ember Ash", ["terrain", "volcanic", "ash", "obsidian", "dungeon", "harmony"],
     dict(kind="nature_organic", sub="pebbles", base=(58, 56, 62), alt=(42, 40, 46), details=130)),
    ("ext_shallow_cobble_water", "Shallow Clear Cobblestone Creek Water", ["terrain", "water", "brook", "stream", "park", "harmony"],
     dict(kind="nature_organic", sub="water", base=(72, 156, 184), alt=(52, 126, 158), details=110)),

    # --- C. 18 Architectural Roofs ---
    ("roof_berlin_charcoal_mansard", "Berlin Charcoal Slate Mansard Roof Shingles", ["terrain", "roof", "slate", "berlin", "mansard", "harmony"],
     dict(kind="roof_shingles", sub="slate", base=(76, 82, 92), rows=12, cols=10)),
    ("roof_burgundy_diamond_slate", "Ornate Burgundy & Slate Diamond Roof Shingles", ["terrain", "roof", "slate", "burgundy", "diamond", "harmony"],
     dict(kind="roof_shingles", sub="diamond", base=(84, 88, 98), alt=(142, 54, 58), rows=12, cols=10)),
    ("roof_verdigris_standing_seam", "Verdigris Patina Copper Standing-Seam Roof", ["terrain", "roof", "copper", "verdigris", "cathedral", "berlin", "harmony"],
     dict(kind="roof_shingles", sub="standing_seam", base=(82, 146, 132))),
    ("roof_warm_aged_copper", "Warm Burnished Aged-Copper Standing-Seam Roof", ["terrain", "roof", "copper", "steampunk", "berlin", "harmony"],
     dict(kind="roof_shingles", sub="standing_seam", base=(168, 102, 64))),
    ("roof_prussian_fishscale_slate", "Prussian Blue-Gray Fishscale Slate Roof", ["terrain", "roof", "slate", "fishscale", "berlin", "harmony"],
     dict(kind="roof_shingles", sub="fishscale", base=(88, 104, 122))),
    ("roof_emerald_fishscale_tile", "Glazed Emerald Fishscale Conservatory Roof", ["terrain", "roof", "emerald", "fishscale", "tile", "harmony"],
     dict(kind="roof_shingles", sub="fishscale", base=(58, 118, 88))),
    ("roof_tuscan_terracotta_barrel", "Sun-Baked Terracotta Barrel Tile Roof", ["terrain", "roof", "terracotta", "barrel", "clay", "harmony"],
     dict(kind="roof_shingles", sub="barrel", base=(184, 92, 56))),
    ("roof_imperial_jade_barrel", "Imperial Glazed Jade Ceramic Barrel Roof", ["terrain", "roof", "jade", "ceramic", "barrel", "harmony"],
     dict(kind="roof_shingles", sub="barrel", base=(58, 136, 106))),
    ("roof_cobalt_glazed_barrel", "Glazed Cobalt Ceramic Palace Barrel Roof", ["terrain", "roof", "cobalt", "blue", "barrel", "harmony"],
     dict(kind="roof_shingles", sub="barrel", base=(58, 98, 154))),
    ("roof_mossy_medieval_clay", "Moss-Dappled Medieval Flat Clay Roof Tiles", ["terrain", "roof", "clay", "moss", "medieval", "harmony"],
     dict(kind="roof_shingles", sub="slate", base=(146, 86, 62), moss=0.35, rows=12, cols=10)),
    ("roof_golden_straw_thatch", "Layered Golden Village Straw Thatch Roof", ["terrain", "roof", "thatch", "straw", "village", "harmony"],
     dict(kind="roof_shingles", sub="thatch", base=(186, 152, 82))),
    ("roof_weathered_cedar_shakes", "Weathered Dark Cedar Wood-Shake Roof", ["terrain", "roof", "wood", "cedar", "shakes", "harmony"],
     dict(kind="roof_shingles", sub="slate", base=(126, 88, 58), rows=10, cols=10)),
    ("roof_factory_riveted_iron", "Riveted Dark-Iron Foundry Roof Plates", ["terrain", "roof", "iron", "factory", "industrial", "harmony"],
     dict(kind="metal_deck", base=(74, 82, 92), accent=(142, 148, 156), n=4)),
    ("roof_rusted_corrugated_tin", "Rusted Corrugated Tin Slum Shed Roof", ["terrain", "roof", "tin", "rusted", "slum", "harmony"],
     dict(kind="roof_shingles", sub="standing_seam", base=(118, 98, 86))),
    ("roof_conservatory_glass_panes", "Iron-Framed Glass Conservatory Skylight Roof", ["terrain", "roof", "glass", "conservatory", "greenhouse", "harmony"],
     dict(kind="roof_shingles", sub="glass_roof", base=(144, 198, 222), mortar=(58, 66, 74))),
    ("roof_snow_laden_slate", "Snow-Dusted Winter Charcoal Slate Roof", ["terrain", "roof", "snow", "winter", "slate", "harmony"],
     dict(kind="roof_shingles", sub="slate", base=(78, 84, 96), snow=True, rows=12, cols=10)),
    ("roof_gilded_cathedral_dome", "Gilded Sovereign Brass-Plate Dome Roof", ["terrain", "roof", "gold", "brass", "cathedral", "sovereign", "harmony"],
     dict(kind="roof_shingles", sub="standing_seam", base=(198, 162, 68))),
    ("roof_col_architectural_shingles", "Colorable Hand-Inked Architectural Shingles", ["terrain", "roof", "colorable", "shingles", "modular", "harmony"],
     dict(kind="roof_shingles", sub="slate", colorable=True, rows=12, cols=10)),
]


def main() -> None:
    PATHS_DIR.mkdir(parents=True, exist_ok=True)
    TERR_DIR.mkdir(parents=True, exist_ok=True)
    manifest_entries: list[dict] = []

    print(f"=== GENERATING {len(NEW_PATHS)} BRAND-NEW UNIQUE PATHS ===")
    p_qa: list[tuple[str, Image.Image]] = []
    for idx, (slug, disp, tags, spec) in enumerate(NEW_PATHS):
        s = dict(spec)
        s.setdefault("seed", 6000 + idx * 17)
        im = render_path(s)
        im.save(PATHS_DIR / f"{slug}.png", "PNG", optimize=True)
        is_col = bool(s.get("colorable", False)) or "_col_" in slug
        manifest_entries.append({
            "path": f"paths/harmony/{slug}.png",
            "displayName": disp,
            "category": "path",
            "tags": tags,
            "widthPx": im.width,
            "heightPx": im.height,
            "defaultPpi": 256,
            "drawMode": "colorable" if is_col else "normal",
            "castsShadow": False,
            "dominantHex": dominant_hex(im),
        })
        p_qa.append((slug, im))
    save_qa_sheet(p_qa[:40], SCRATCH_DIR / "qa_new_paths_part1.png", cols=5, cw=280, ch=90)
    save_qa_sheet(p_qa[40:], SCRATCH_DIR / "qa_new_paths_part2.png", cols=5, cw=280, ch=90)

    print(f"=== GENERATING {len(NEW_TERRAINS)} BRAND-NEW SEAMLESS TERRAINS & ROOFS ===")
    t_qa: list[tuple[str, Image.Image]] = []
    for idx, (slug, disp, tags, spec) in enumerate(NEW_TERRAINS):
        s = dict(spec)
        s.setdefault("seed", 8000 + idx * 23)
        im = render_seamless_terrain(s)
        im.save(TERR_DIR / f"{slug}.png", "PNG", optimize=True)
        is_col = bool(s.get("colorable", False)) or "_col_" in slug
        manifest_entries.append({
            "path": f"terrain/harmony/{slug}.png",
            "displayName": disp,
            "category": "terrain",
            "tags": tags,
            "widthPx": im.width,
            "heightPx": im.height,
            "defaultPpi": 256,
            "drawMode": "colorable" if is_col else "normal",
            "castsShadow": False,
            "dominantHex": dominant_hex(im),
        })
        t_qa.append((slug, im))
    save_qa_sheet(t_qa, SCRATCH_DIR / "qa_new_terrains_roofs.png", cols=8, cw=175, ch=175)

    total = upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    print(f"DONE Step 5A: Created {len(NEW_PATHS)} new paths + {len(NEW_TERRAINS)} new terrains/roofs ({len(manifest_entries)} total). modular-suite manifest -> {total} assets!")


if __name__ == "__main__":
    main()

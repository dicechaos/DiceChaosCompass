#!/usr/bin/env python3
"""
Dice Chaos Maps — Water Scenes, Lakeshore, River, Docks & Luxury Yacht Suite (CC0)
===================================================================================
Generates & slices 128 original CC0 strictly 90-degree top-down water scene assets:
  - 112 individual modular props sliced from 7 hand-inked 4x4 top-down sheets:
      1. water_ripples_foam       (16) — Ripples, wakes, caustics, foam, rapids
      2. water_flora_banks        (16) — Lily pads, reeds, kelp, mossy logs & wet rocks
      3. water_wildlife_submerged (16) — Koi, trout, swans, ducks, turtles & sunken lakebed
      4. water_docks_fishing      (16) — Pilings, buoys, fish benches, traps, nets & ladders
      5. water_boats_craft        (16) — Kayaks, canoes, motor launch, rafts & swim platforms
      6. water_yacht_luxury       (16) — Sun loungers, banquette, hydro-floats, firepit & bar
      7. water_bridges_structures (16) — Footbridges, waterwheel, sluice, slipway & cabanas
  - 6 seamless 512x512 Water & Shoreline Terrains
  - 6 seamless 512x128 Shoreline Foam, Rapids, Boat Wake, Waterfall & Pier Edge Paths
  - 4 seamless 512x128 Waterfront Seawall, Rope Dock, Ivory Yacht Hull & Retaining Walls

Updates:
  - public/assets/modular-suite-cc0/manifest.json
  - public/assets/DiceChaos_Modular_Suite_CC0.dcpack
"""

from __future__ import annotations

import json
import math
import pathlib
import random
import zipfile
from collections import deque
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets" / "modular-suite-cc0"
DCPACK_PATH = ROOT / "public" / "assets" / "DiceChaos_Modular_Suite_CC0.dcpack"
BRAIN_DIR = pathlib.Path(
    r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae"
)
SCRATCH_DIR = BRAIN_DIR / "scratch"

INK = (28, 22, 18, 255)


def clamp(v: float, lo: int = 0, hi: int = 255) -> int:
    return max(lo, min(hi, int(round(v))))


def add_grain(img: Image.Image, seed: int, strength: int = 6, seamless: bool = True) -> Image.Image:
    rng = random.Random(seed)
    w, h = img.size
    gw, gh = max(24, w // 2), max(24, h // 2)
    noise = Image.new("L", (gw, gh), 128)
    px = noise.load()
    for y in range(gh):
        for x in range(gw):
            px[x, y] = clamp(128 + rng.randint(-strength, strength))
    noise = noise.resize((w, h), Image.Resampling.BILINEAR)
    if seamless:
        noise = ImageChops.blend(noise, ImageChops.offset(noise, w // 2, h // 2), 0.35)
    r, g, b, a = img.split()
    return Image.merge(
        "RGBA",
        (
            ImageChops.add(r, noise, scale=1, offset=-128),
            ImageChops.add(g, noise, scale=1, offset=-128),
            ImageChops.add(b, noise, scale=1, offset=-128),
            a,
        ),
    )


def dominant_hex(img: Image.Image) -> str:
    small = img.resize((24, 24), Image.Resampling.BILINEAR).convert("RGBA")
    rs = gs = bs = n = 0
    for r, g, b, a in small.get_flattened_data():
        if a > 80:
            rs += r
            gs += g
            bs += b
            n += 1
    if n == 0:
        return "#38BDF8"
    return f"#{rs // n:02X}{gs // n:02X}{bs // n:02X}"


def find_grid_cuts_4x4(sheet: Image.Image) -> tuple[list[int], list[int]]:
    rgb = sheet.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    def best_cut(axis_len: int, frac: float, is_row: bool) -> int:
        center = int(axis_len * frac)
        span = 0.085
        lo = max(8, int(axis_len * (frac - span)))
        hi = min(axis_len - 8, int(axis_len * (frac + span)))
        best_pos = center
        best_score = 10**9
        for pos in range(lo, hi + 1):
            ink = 0
            if is_row:
                for x in range(0, w, 2):
                    r, g, b = px[x, pos]
                    if min(r, g, b) < 236:
                        ink += 1
            else:
                for y in range(0, h, 2):
                    r, g, b = px[pos, y]
                    if min(r, g, b) < 236:
                        ink += 1
            score = ink * 120 + abs(pos - center)
            if score < best_score:
                best_score = score
                best_pos = pos
        return best_pos

    xs = [0] + [best_cut(w, i / 4.0, False) for i in range(1, 4)] + [w]
    ys = [0] + [best_cut(h, j / 4.0, True) for j in range(1, 4)] + [h]
    return xs, ys


def key_white_to_alpha(tile: Image.Image, clear_interior_white: bool = False) -> Image.Image:
    rgba = tile.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    visited = bytearray(w * h)
    bg_mask = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def is_bg(r: int, g: int, b: int) -> bool:
        mx = max(r, g, b)
        mn = min(r, g, b)
        return mn >= 232 and (mx - mn) <= 20

    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, _ = px[x, y]
            if is_bg(r, g, b):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        bg_mask[y * w + x] = 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not visited[idx]:
                    r, g, b, _ = px[nx, ny]
                    if is_bg(r, g, b):
                        visited[idx] = 1
                        q.append((nx, ny))

    if clear_interior_white:
        for y in range(h):
            for x in range(w):
                idx = y * w + x
                if not bg_mask[idx]:
                    r, g, b, _ = px[x, y]
                    if min(r, g, b) >= 242 and (max(r, g, b) - min(r, g, b)) <= 12:
                        bg_mask[idx] = 1

    # Soft anti-aliased fringe cleanup on edge pixels adjacent to transparent background
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if bg_mask[idx]:
                px[x, y] = (0, 0, 0, 0)
                continue
            r, g, b, _ = px[x, y]
            if min(r, g, b) >= 208 and (max(r, g, b) - min(r, g, b)) <= 24:
                near_bg = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and bg_mask[ny * w + nx]:
                        near_bg = True
                        break
                if near_bg:
                    lum = (r + g + b) / 3.0
                    alpha = clamp((245.0 - lum) / 42.0 * 255.0)
                    px[x, y] = (clamp(r * 0.86), clamp(g * 0.86), clamp(b * 0.86), alpha)

    cropped = rgba.crop((4, 4, w - 4, h - 4))
    bbox = cropped.getbbox()
    if not bbox:
        return cropped
    x0, y0, x1, y1 = bbox
    tight = cropped.crop((x0, y0, x1, y1))
    out = Image.new("RGBA", (tight.width + 8, tight.height + 8), (0, 0, 0, 0))
    out.paste(tight, (4, 4))
    return out


def key_water_effect_to_alpha(tile: Image.Image) -> Image.Image:
    """
    Specialized soft-alpha de-matting for translucent turquoise/white water ripples,
    wakes, caustics, and foam decals so they blend seamlessly over dark sapphire lakes!
    """
    rgba = tile.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            # Distance from pure white (255, 255, 255)
            dr = 255 - r
            dg = 255 - g
            db = 255 - b
            dist = math.sqrt(dr * dr + dg * dg + db * db)
            if dist <= 16.0:
                px[x, y] = (0, 0, 0, 0)
                continue
            # Smooth translucent alpha ramp: faint aqua becomes gentle mist, inked strokes stay crisp
            t = min(1.0, (dist - 16.0) / 145.0)
            alpha = clamp((t ** 0.72) * 238.0)
            # Brighten & cool-shift color slightly so ripples read as luminous water shimmer on dark water
            nr = clamp(r * 0.52 + 122)
            ng = clamp(g * 0.56 + 114)
            nb = clamp(b * 0.54 + 122)
            px[x, y] = (nr, ng, nb, alpha)

    cropped = rgba.crop((4, 4, w - 4, h - 4))
    bbox = cropped.getbbox()
    if not bbox:
        return cropped
    x0, y0, x1, y1 = bbox
    tight = cropped.crop((x0, y0, x1, y1))
    out = Image.new("RGBA", (tight.width + 8, tight.height + 8), (0, 0, 0, 0))
    out.paste(tight, (4, 4))
    return out


WATER_SHEETS: list[dict[str, Any]] = [
    {
        "file": "water_surface_effects_4x4_v2_1795398088334.jpg",
        "pack": "water_ripples_foam",
        "mode": "water_effect",
        "items": [
            ("wat_ripple_concentric", "Concentric Circular Water Ripples", ["water", "ripple", "lake", "pond", "effect"], 2.2, False, False),
            ("wat_ripple_oval_hull", "Wide Oval Boat-Hull Water Ripple", ["water", "ripple", "boat", "yacht", "wake"], 3.0, False, False),
            ("wat_wake_bow_v", "Foamy V-Shaped Bow Wake Arc", ["water", "wake", "foam", "boat", "ship"], 2.8, False, False),
            ("wat_wave_shore_crest", "Curved Shoreline Lapping Wave Crest", ["water", "shore", "wave", "foam", "beach"], 2.6, False, False),
            ("wat_foam_splash_ring", "Circular Whitewater Rock Splash Ring", ["water", "foam", "splash", "rapids", "rock"], 2.2, False, False),
            ("wat_eddy_whirlpool", "Swirling River Eddy Whirlpool Vortex", ["water", "eddy", "whirlpool", "river", "current"], 2.4, False, False),
            ("wat_caustics_patch", "Sunlit Underwater Caustics Shimmer Patch", ["water", "caustics", "shimmer", "sunlight", "lake"], 3.2, False, False),
            ("wat_droplet_ring", "Small Concentric Water Droplet Ripple", ["water", "ripple", "droplet", "pond", "rain"], 1.3, False, False),
            ("wat_piling_ripple_pair", "Twin Dock-Piling Water Ripple Rings", ["water", "ripple", "pier", "dock", "piling"], 1.8, False, False),
            ("wat_foam_wind_streaks", "Windblown Surface Foam Drift Streaks", ["water", "foam", "wind", "lake", "ocean"], 2.6, False, False),
            ("wat_aqua_shimmer", "Sunlit Aqua Surface Reflection Glint", ["water", "shimmer", "reflection", "lake", "effect"], 2.6, False, False),
            ("wat_current_swirl", "Curved Swirling Stream Current Arc", ["water", "current", "stream", "river", "ripple"], 2.2, False, False),
            ("wat_waterfall_plunge", "Frothy Waterfall Plunge-Pool Foam Cloud", ["water", "waterfall", "foam", "rapids", "splash"], 2.8, False, False),
            ("wat_rapids_cascade", "Stepped Cascading Whitewater Rapids Plume", ["water", "rapids", "waterfall", "river", "foam"], 2.8, False, False),
            ("wat_hull_ripple_up", "Sleek Hull Waterline Ripple Arc (Port)", ["water", "ripple", "yacht", "ship", "hull"], 3.2, False, False),
            ("wat_hull_ripple_down", "Sleek Hull Waterline Ripple Arc (Starboard)", ["water", "ripple", "yacht", "ship", "hull"], 3.2, False, False),
        ],
    },
    {
        "file": "aquatic_flora_rocks_spritesheet_v2_1795398094313.jpg",
        "pack": "water_flora_banks",
        "mode": "opaque",
        "items": [
            ("wat_lily_lotus_pink", "Blooming Pink Lotus & Lily Pad Cluster", ["water", "flora", "lily", "lotus", "lake", "pond"], 1.8, False, True),
            ("wat_lily_pad_bed", "Dense Green Water-Lily Pad Bed", ["water", "flora", "lily", "pond", "lake"], 2.0, False, True),
            ("wat_water_hyacinth", "Flowering Purple Water Hyacinth Clump", ["water", "flora", "flower", "pond", "lake"], 1.7, False, True),
            ("wat_cattail_tuft_top", "Top-Down Radial Cattail & Reed Tuft", ["water", "reeds", "cattail", "shore", "flora"], 1.5, True, True),
            ("wat_sedge_grass_bank", "Lakeside Sedge Grass Shoreline Clump", ["water", "shore", "grass", "reeds", "flora"], 1.5, True, True),
            ("wat_duckweed_mat", "Floating Green Duckweed & Algae Mat", ["water", "flora", "swamp", "pond", "algae"], 1.8, False, True),
            ("wat_submerged_kelp", "Flowing Underwater Kelp & Lake-Weed", ["water", "kelp", "submerged", "lake", "flora"], 1.9, False, True),
            ("wat_riverbank_fern", "Mossy Overhanging Riverbank Fern Rosette", ["water", "fern", "shore", "flora", "nature"], 1.6, True, True),
            ("wat_marsh_marigold", "Blooming Yellow Marsh Marigold Clump", ["water", "flower", "shore", "meadow", "flora"], 1.4, False, True),
            ("wat_mossy_submerged_log", "Half-Submerged Mossy Shoreline Log", ["water", "log", "shore", "moss", "nature"], 2.2, True, False),
            ("wat_forked_driftwood", "Weathered Silver Forked Driftwood Branch", ["water", "driftwood", "beach", "shore", "nature"], 2.0, True, True),
            ("wat_willow_frond_drape", "Cascading Weeping-Willow Shoreline Fronds", ["water", "willow", "tree", "shore", "flora"], 2.4, True, True),
            ("wat_wet_cobble_cluster", "Wet Mossy River-Cobble Stone Cluster", ["water", "rock", "cobble", "shore", "river"], 1.7, True, True),
            ("wat_shore_granite_wet", "Mossy Granite Lake Rock with Wet Rim", ["water", "rock", "boulder", "shore", "lake"], 2.1, True, False),
            ("wat_stepping_stone_trio", "Trio of Flat Mossy River Stepping Stones", ["water", "stepping", "stones", "river", "crossing"], 2.0, False, True),
            ("wat_submerged_boulder", "Half-Submerged Granite Lake Boulder", ["water", "boulder", "rock", "lake", "submerged"], 1.8, False, False),
        ],
    },
    {
        "file": "aquatic_wildlife_sunken_props_4x4_orthographic_1795398125686.jpg",
        "pack": "water_wildlife_submerged",
        "mode": "opaque",
        "items": [
            ("wat_koi_school", "School of Five Orange-White Koi Fish", ["water", "fish", "koi", "wildlife", "pond", "lake"], 1.9, False, True),
            ("wat_alpine_trout_trio", "Trio of Silvery Alpine Lake Trout", ["water", "fish", "trout", "wildlife", "lake", "river"], 1.7, False, True),
            ("wat_lake_pike_shadow", "Large Dark-Olive Lake Pike Fish", ["water", "fish", "pike", "wildlife", "lake"], 1.8, False, False),
            ("wat_white_swans_pair", "Pair of White Swans Gliding on Water", ["water", "swan", "bird", "wildlife", "lake"], 2.0, True, False),
            ("wat_mallard_ducks", "Trio of Swimming Mallard Ducks", ["water", "duck", "bird", "wildlife", "lake", "pond"], 1.6, True, True),
            ("wat_turtles_on_log", "Three Pond Turtles Sunning on Log", ["water", "turtle", "log", "wildlife", "shore"], 1.9, True, False),
            ("wat_blue_dragonfly", "Giant Blue Dragonfly on Lily Pad", ["water", "dragonfly", "wildlife", "lily", "pond"], 1.1, False, True),
            ("wat_sunken_rowboat", "Sunken Moss-Covered Rowboat Wreck", ["water", "wreck", "submerged", "boat", "lakebed"], 2.5, False, True),
            ("wat_sunken_pillar", "Sunken Mossy Ancient Stone Column Ruin", ["water", "ruin", "submerged", "pillar", "lakebed"], 2.0, False, False),
            ("wat_sunken_anchor", "Barnacle-Encrusted Sunken Ship Anchor", ["water", "anchor", "submerged", "ship", "lakebed"], 1.7, False, True),
            ("wat_sunken_chest_amphora", "Sunken Algae Treasure Chest & Amphora", ["water", "treasure", "submerged", "chest", "lakebed"], 1.7, False, True),
            ("wat_submerged_pebbles", "Colorful Submerged River Pebble Shoal", ["water", "pebbles", "submerged", "lakebed", "river"], 1.9, False, True),
            ("wat_sunken_brass_gear", "Corroded Verdigris Sunken Brass Gear", ["water", "gear", "submerged", "steampunk", "lakebed"], 1.7, False, True),
            ("wat_submerged_crystals", "Glowing Underwater Cyan Mana Crystals", ["water", "crystal", "arcane", "submerged", "lakebed"], 1.6, False, False),
            ("wat_sunken_piling_stumps", "Cluster of Submerged Broken Dock Pilings", ["water", "piling", "dock", "submerged", "ruin"], 1.6, False, True),
            ("wat_sandy_shoal_bar", "Rippled Underwater Sandbar & Shells", ["water", "sandbar", "shoal", "beach", "lakebed"], 2.4, False, False),
        ],
    },
    {
        "file": "pier_fittings_fishing_gear_spritesheet_final_1795398126755.jpg",
        "pack": "water_docks_fishing",
        "mode": "opaque",
        "items": [
            ("wat_dock_piling_rope", "Weathered Timber Dock Piling with Rope", ["water", "dock", "pier", "piling", "mooring"], 0.95, True, False),
            ("wat_dock_pilings_twin", "Twin Iron-Banded Mooring Pilings", ["water", "dock", "pier", "piling", "mooring"], 1.1, True, False),
            ("wat_mooring_buoy_red", "Floating Red-and-White Mooring Buoy", ["water", "buoy", "mooring", "lake", "harbor"], 1.15, True, False),
            ("wat_barrel_float_buoy", "Strapped Wooden Barrel Float Buoy", ["water", "buoy", "barrel", "dock", "harbor"], 1.15, True, False),
            ("wat_fish_cleaning_bench", "Dockside Fish-Cleaning Bench & Trout", ["water", "dock", "fishing", "bench", "fish"], 1.85, True, False),
            ("wat_wicker_crab_trap", "Woven Wicker Crab & Lobster Trap", ["water", "fishing", "trap", "dock", "pier"], 1.15, True, True),
            ("wat_wooden_lobster_traps", "Stacked Wooden Slatted Lobster Traps", ["water", "fishing", "trap", "dock", "pier"], 1.35, True, True),
            ("wat_fish_drying_rack", "Timber Lakeside Fish-Drying Rack", ["water", "fishing", "rack", "shore", "dock"], 1.75, True, True),
            ("wat_open_tackle_box", "Open Wooden Fishing Tackle Box & Lures", ["water", "fishing", "tackle", "dock", "clutter"], 0.95, True, False),
            ("wat_cork_fishing_net", "Bundled Hemp Fishing Net with Corks", ["water", "fishing", "net", "dock", "shore"], 1.4, False, True),
            ("wat_bamboo_fishing_rods", "Three Bamboo Fishing Rods on Cleat Rack", ["water", "fishing", "rod", "dock", "pier"], 1.65, False, True),
            ("wat_bucket_of_fish", "Wooden Bucket Overflowing with Silver Fish", ["water", "fishing", "bucket", "fish", "dock"], 0.9, True, False),
            ("wat_pier_swim_ladder", "Weathered Timber Pier Swim Ladder", ["water", "dock", "pier", "ladder", "swim"], 1.25, True, True),
            ("wat_brass_bollard_navy", "Brass Pier Bollard with Navy Hawser", ["water", "dock", "pier", "bollard", "yacht"], 0.95, True, True),
            ("wat_pier_lantern_top", "Brass-Capped Timber Pier Lantern Post", ["water", "dock", "pier", "lantern", "light"], 0.85, False, False),
            ("wat_iron_mooring_ring", "Heavy Iron Mooring Ring on Oak Block", ["water", "dock", "pier", "mooring", "iron"], 0.8, False, False),
        ],
    },
    {
        "file": "lakeside_watercraft_4x4_spritesheet_1795398100123.jpg",
        "pack": "water_boats_craft",
        "mode": "opaque",
        "items": [
            ("wat_mahogany_kayak", "Varnished Mahogany Kayak & Double Paddle", ["water", "boat", "kayak", "lake", "watercraft"], 2.6, True, True),
            ("wat_birchbark_canoe", "Classic Birchbark Lakeside Canoe", ["water", "boat", "canoe", "lake", "river"], 2.7, True, False),
            ("wat_venetian_launch", "Luxury Mahogany Venetian Motor Launch", ["water", "boat", "launch", "yacht", "luxury"], 3.4, True, False),
            ("wat_swan_pleasure_boat", "Ornate White Swan-Prow Pleasure Rowboat", ["water", "boat", "swan", "lake", "luxury"], 2.8, True, False),
            ("wat_timber_swim_raft", "Lashed Timber Lake Diving & Swim Raft", ["water", "raft", "swim", "dock", "lake"], 2.6, True, False),
            ("wat_barrel_pontoon", "Floating Barrel Pontoon Bridge Section", ["water", "pontoon", "bridge", "raft", "river"], 2.8, True, True),
            ("wat_teak_swim_step", "Tethered Teak Floating Swim-Step Raft", ["water", "raft", "yacht", "dock", "swim"], 2.0, True, False),
            ("wat_canvas_dinghy", "Round Tan-Canvas Expedition Dinghy", ["water", "boat", "dinghy", "raft", "camp"], 1.9, True, False),
            ("wat_furled_sailboat", "Small Wooden Sailboat with Furled Sail", ["water", "boat", "sailboat", "lake", "harbor"], 3.2, True, False),
            ("wat_fisherman_punt", "Flat-Bottom Fisherman Punt Boat & Net", ["water", "boat", "fishing", "punt", "river"], 2.8, True, False),
            ("wat_reed_duck_blind", "Reed-Thatched Floating Duck-Blind Boat", ["water", "boat", "reeds", "hunting", "swamp"], 2.6, True, False),
            ("wat_yacht_swim_platform", "Teak & Brass Yacht Stern Swim Platform", ["water", "yacht", "platform", "swim", "ship"], 2.6, True, False),
            ("wat_amphibious_skiff", "Brass & Mahogany Amphibious Hydro-Skiff", ["water", "boat", "steampunk", "yacht", "skiff"], 2.8, True, True),
            ("wat_picnic_pontoon", "Wide Timber Lake Picnic Pontoon Raft", ["water", "raft", "pontoon", "picnic", "lake"], 3.0, True, False),
            ("wat_rotted_skiff_wreck", "Weathered Half-Rotten Rowboat Hull", ["water", "boat", "wreck", "ruin", "shore"], 2.5, True, True),
            ("wat_paddles_lifejackets", "Crossed Kayak Paddles & Cork Life Vests", ["water", "boat", "paddle", "gear", "dock"], 1.5, False, True),
        ],
    },
    {
        "file": "luxury_yacht_lakeside_props_4x4_v2_1795398127470.jpg",
        "pack": "water_yacht_luxury",
        "mode": "opaque",
        "items": [
            ("wat_teak_sun_lounger", "Teak Yacht Sun-Lounger with Cream Cushion", ["water", "yacht", "lounger", "furniture", "deck"], 1.65, True, False),
            ("wat_twin_deck_loungers", "Twin Navy Deck Sun-Loungers & Side Table", ["water", "yacht", "lounger", "furniture", "deck"], 2.1, True, True),
            ("wat_curved_yacht_sofa", "Curved Ivory & Gold Yacht Banquette Sofa", ["water", "yacht", "sofa", "furniture", "luxury"], 2.3, True, False),
            ("wat_teak_cocktail_table", "Round Teak & Brass Yacht Cocktail Table", ["water", "yacht", "table", "bar", "luxury"], 1.45, True, False),
            ("wat_champagne_bucket", "Silver Champagne Ice Bucket on Brass Stand", ["water", "yacht", "champagne", "luxury", "clutter"], 0.85, True, False),
            ("wat_lifebuoy_stanchion", "Brass Yacht Deck Lifebuoy Ring Stanchion", ["water", "yacht", "lifebuoy", "ship", "safety"], 0.95, True, False),
            ("wat_aether_hydrofoil", "Folding Brass & Cyan Aether Hydrofoil Wing", ["water", "yacht", "skyship", "hydrofoil", "aether"], 2.4, True, True),
            ("wat_yacht_pontoon_pod", "Aerodynamic Brass & Ivory Landing Pontoon", ["water", "yacht", "skyship", "pontoon", "float"], 2.6, True, False),
            ("wat_striped_beach_towels", "Rolled Navy-and-White Striped Beach Towels", ["water", "yacht", "beach", "towel", "clutter"], 0.9, False, False),
            ("wat_wicker_picnic_hamper", "Woven Wicker Lakeside Picnic Hamper", ["water", "shore", "picnic", "basket", "camp"], 1.05, True, False),
            ("wat_yacht_director_chair", "Gilded Brass Folding Yacht Director Chair", ["water", "yacht", "chair", "furniture", "deck"], 1.0, True, False),
            ("wat_teak_cooler_chest", "Teak & Brass Marine Deck Ice-Cooler Chest", ["water", "yacht", "chest", "dock", "deck"], 1.2, True, True),
            ("wat_marine_searchlamp", "Swiveling Brass Marine Spotlight Searchlamp", ["water", "yacht", "spotlight", "light", "ship"], 1.0, True, False),
            ("wat_yacht_swim_ladder", "Polished Teak Yacht Swim-Ladder Platform", ["water", "yacht", "ladder", "swim", "platform"], 1.55, True, True),
            ("wat_wrought_lake_bench", "Ornate White Wrought-Iron Lakeside Bench", ["water", "shore", "bench", "park", "furniture"], 1.75, True, True),
            ("wat_stone_firepit_ring", "Lakeside River-Stone Firepit with Embers", ["water", "shore", "firepit", "camp", "light"], 1.7, True, False),
        ],
    },
    {
        "file": "lakeside_bridges_structures_spritesheet_final_1795398149275.jpg",
        "pack": "water_bridges_structures",
        "mode": "opaque",
        "items": [
            ("wat_arched_stone_bridge", "Arched Mossy Stone Stream Footbridge", ["water", "bridge", "stone", "river", "crossing"], 3.2, True, False),
            ("wat_timber_rope_bridge", "Rustic Timber Plank & Rope Footbridge", ["water", "bridge", "wood", "river", "crossing"], 2.8, True, True),
            ("wat_mill_waterwheel", "Weathered Timber Mill Waterwheel in Trough", ["water", "waterwheel", "mill", "river", "structure"], 2.8, True, False),
            ("wat_canal_sluice_gate", "Mossy Cut-Stone Canal Lock Sluice Gate", ["water", "canal", "sluice", "gate", "structure"], 3.0, True, True),
            ("wat_lakeside_wishing_well", "Mossy Stone Lakeside Wishing Well Roof", ["water", "well", "stone", "shore", "structure"], 1.9, True, False),
            ("wat_marble_balustrade_arc", "Curved White-Marble Lakeside Balustrade", ["water", "marble", "balustrade", "shore", "luxury"], 2.6, True, False),
            ("wat_boat_slipway_rails", "Weathered Timber Boat-Launch Slipway Rails", ["water", "dock", "slipway", "boat", "ramp"], 2.8, False, True),
            ("wat_diving_board_plank", "Timber Lake Diving Board on Stone Block", ["water", "dock", "pier", "diving", "swim"], 2.1, True, False),
            ("wat_canoe_storage_rack", "Boathouse Double Canoe Storage Rack", ["water", "boat", "canoe", "rack", "boathouse"], 2.6, True, True),
            ("wat_oars_lifering_rack", "Dockside Oars, Boathooks & Life-Ring Rack", ["water", "dock", "oars", "rack", "boathouse"], 2.1, True, True),
            ("wat_bait_stall_awning", "Rustic Lakeside Bait-and-Tackle Stall Roof", ["water", "dock", "stall", "awning", "shore"], 2.6, True, False),
            ("wat_beach_cabana_canopy", "Cream & Teal Striped Beach Cabana Canopy", ["water", "beach", "cabana", "canopy", "luxury"], 2.8, True, False),
            ("wat_channel_beacon_buoy", "Floating Brass & Cyan Channel Marker Beacon", ["water", "buoy", "beacon", "light", "harbor"], 1.5, True, False),
            ("wat_stone_weir_dam", "Mossy Cut-Stone River Weir Dam Spillway", ["water", "river", "dam", "weir", "stone"], 3.0, True, False),
            ("wat_driftwood_bench_ring", "Horseshoe of Driftwood Campfire Log Benches", ["water", "shore", "camp", "bench", "driftwood"], 2.5, True, True),
            ("wat_waterfall_lip_arch", "Mossy Cliff Waterfall Lip Boulder Arch", ["water", "waterfall", "cliff", "rock", "river"], 2.8, True, False),
        ],
    },
]


# ============================================================================
# 2. SEAMLESS PROCEDURAL 2X-SUPERSAMPLED WATER TERRAINS, PATHS & WALLS (16)
# ============================================================================


def make_water_terrain(
    seed: int,
    base_rgb: tuple[int, int, int],
    hi_rgb: tuple[int, int, int],
    lo_rgb: tuple[int, int, int],
    caustic_rgb: tuple[int, int, int] | None = None,
    swamp_flecks: bool = False,
) -> Image.Image:
    w = h = 512
    img = Image.new("RGBA", (w, h), (*base_rgb, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)

    # Layered seamless organic swell bands (wrapped across edges for zero seams)
    for _ in range(42):
        cx = rng.uniform(0, w)
        cy = rng.uniform(0, h)
        rx = rng.uniform(55, 145)
        ry = rng.uniform(18, 46)
        col = hi_rgb if rng.random() > 0.45 else lo_rgb
        alpha = rng.randint(24, 52)
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                draw.ellipse(
                    (cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry),
                    fill=(*col, alpha),
                )

    img = img.filter(ImageFilter.GaussianBlur(radius=9))
    draw = ImageDraw.Draw(img, "RGBA")

    # Delicate hand-inked wave ripple arcs (seamless wrapped)
    for _ in range(58):
        x0 = rng.uniform(0, w)
        y0 = rng.uniform(0, h)
        span = rng.uniform(34, 88)
        amp = rng.uniform(4, 11)
        pts_base = [
            (x0 + (span * i) / 6.0, y0 + math.sin(i * math.pi / 3.0) * amp)
            for i in range(7)
        ]
        col = (*hi_rgb, rng.randint(52, 95))
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                pts = [(x + ox, y + oy) for x, y in pts_base]
                draw.line(pts, fill=col, width=2)

    if caustic_rgb:
        # Seamless Voronoi-style sunlit caustic web highlights
        pts = [(rng.uniform(0, w), rng.uniform(0, h)) for _ in range(34)]
        for i in range(len(pts)):
            x1, y1 = pts[i]
            for j in range(i + 1, len(pts)):
                x2, y2 = pts[j]
                dx = ((x2 - x1 + w / 2) % w) - w / 2
                dy = ((y2 - y1 + h / 2) % h) - h / 2
                dist = math.hypot(dx, dy)
                if 48 < dist < 118:
                    for ox in (-w, 0, w):
                        for oy in (-h, 0, h):
                            draw.line(
                                [(x1 + ox, y1 + oy), (x1 + dx + ox, y1 + dy + oy)],
                                fill=(*caustic_rgb, 36),
                                width=3,
                            )

    if swamp_flecks:
        for _ in range(140):
            cx = rng.uniform(0, w)
            cy = rng.uniform(0, h)
            r = rng.uniform(2, 6)
            col = (118, 152, 74, rng.randint(90, 155))
            for ox in (-w, 0, w):
                for oy in (-h, 0, h):
                    draw.ellipse((cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r), fill=col)

    return add_grain(img, seed + 50, strength=5, seamless=True)


def make_shore_pebble_terrain(seed: int, wet_sand: bool = True) -> Image.Image:
    w = h = 512
    base = (164, 146, 114) if wet_sand else (94, 116, 118)
    img = Image.new("RGBA", (w, h), (*base, 255))
    draw = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)

    # Soft organic sand/gravel mottling
    for _ in range(45):
        cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        rx, ry = rng.uniform(35, 95), rng.uniform(25, 75)
        delta = rng.randint(-18, 18)
        col = (clamp(base[0] + delta), clamp(base[1] + delta), clamp(base[2] + delta), 46)
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                draw.ellipse((cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry), fill=col)
    img = img.filter(ImageFilter.GaussianBlur(radius=6))
    draw = ImageDraw.Draw(img, "RGBA")

    # Smooth river pebbles (seamless wrapped)
    pebble_count = 110 if wet_sand else 190
    for _ in range(pebble_count):
        cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        rx = rng.uniform(5, 16) if wet_sand else rng.uniform(8, 24)
        ry = rx * rng.uniform(0.62, 0.92)
        tone = rng.randint(-28, 28)
        pcol = (
            clamp(base[0] + tone - 12),
            clamp(base[1] + tone - 6),
            clamp(base[2] + tone + (8 if not wet_sand else -2)),
            235,
        )
        hi = (clamp(pcol[0] + 28), clamp(pcol[1] + 28), clamp(pcol[2] + 28), 140)
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                draw.ellipse(
                    (cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry),
                    fill=pcol,
                    outline=(36, 32, 28, 150),
                    width=2,
                )
                draw.ellipse(
                    (cx + ox - rx * 0.55, cy + oy - ry * 0.55, cx + ox + rx * 0.15, cy + oy + ry * 0.05),
                    fill=hi,
                )

    return add_grain(img, seed + 90, strength=7, seamless=True)


def make_water_path(kind: str, seed: int) -> Image.Image:
    w, h = 512, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)

    if kind == "shore_foam":
        # Translucent aqua band + frothy lapping white shoreline crest
        for y in range(28, 102):
            t = 1.0 - abs(y - 64) / 38.0
            a = clamp((t ** 1.3) * 110)
            draw.line([(0, y), (w, y)], fill=(120, 224, 242, a))
        for layer_i, (yc, amp, width, alpha) in enumerate([
            (54, 7, 10, 175),
            (66, 9, 14, 215),
            (76, 6, 6, 130),
        ]):
            pts = [
                (x, yc + math.sin((x / w) * math.pi * 6 + layer_i * 1.4) * amp)
                for x in range(0, w + 16, 16)
            ]
            draw.line(pts, fill=(238, 252, 255, alpha), width=width)
        for _ in range(42):
            cx = rng.uniform(0, w)
            cy = rng.uniform(44, 84)
            r = rng.uniform(3, 9)
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(242, 253, 255, 165))
    elif kind == "river_rapids":
        for y in range(14, 114):
            t = 1.0 - abs(y - 64) / 50.0
            draw.line([(0, y), (w, y)], fill=(38, 152, 186, clamp(t * 165)))
        for _ in range(52):
            x0 = rng.uniform(0, w)
            y0 = rng.uniform(22, 106)
            span = rng.uniform(36, 98)
            pts = [(x0 + span * i / 4.0, y0 + math.sin(i * 1.6) * 5) for i in range(5)]
            for ox in (-w, 0, w):
                draw.line([(x + ox, y) for x, y in pts], fill=(228, 250, 255, rng.randint(135, 220)), width=rng.randint(3, 6))
    elif kind == "boat_wake":
        # Twin trailing foamy wake tracks with translucent aqua center wash
        for y in range(24, 104):
            t = 1.0 - abs(y - 64) / 40.0
            draw.line([(0, y), (w, y)], fill=(86, 204, 228, clamp(t * 72)))
        for yc in (36, 92):
            pts = [(x, yc + math.sin((x / w) * math.pi * 8) * 3.5) for x in range(0, w + 16, 16)]
            draw.line(pts, fill=(236, 252, 255, 200), width=7)
            draw.line(pts, fill=(130, 228, 245, 140), width=14)
    elif kind == "waterfall":
        for y in range(8, 120):
            draw.line([(0, y), (w, y)], fill=(54, 178, 210, 195))
        for _ in range(65):
            x0 = rng.uniform(0, w)
            y0 = rng.uniform(12, 116)
            span = rng.uniform(45, 110)
            for ox in (-w, 0, w):
                draw.line([(x0 + ox, y0), (x0 + span + ox, y0)], fill=(232, 252, 255, rng.randint(150, 235)), width=rng.randint(3, 8))
    elif kind == "pier_edge":
        # Weathered dock timber beam with round piling posts along edge
        draw.rectangle((0, 28, w, 100), fill=(116, 88, 60, 255), outline=INK, width=4)
        for x in range(0, w, 32):
            draw.line([(x, 30), (x, 98)], fill=(64, 48, 34, 210), width=2)
        for x in range(32, w, 128):
            draw.ellipse((x - 22, 14, x + 22, 58), fill=(134, 102, 70, 255), outline=INK, width=4)
            draw.ellipse((x - 12, 24, x + 12, 48), outline=(74, 54, 38, 180), width=2)
    elif kind == "stone_quay":
        # Mossy cut-stone harbor quay & coping blocks
        draw.rectangle((0, 20, w, 108), fill=(122, 128, 124, 255), outline=INK, width=4)
        for x in range(0, w, 64):
            tone = rng.randint(-12, 12)
            col = (clamp(124 + tone), clamp(130 + tone), clamp(126 + tone), 255)
            draw.rectangle((x + 2, 24, x + 62, 104), fill=col, outline=(46, 48, 44, 220), width=3)
            if rng.random() > 0.45:
                draw.ellipse((x + 8, 80, x + 36, 102), fill=(76, 112, 58, 155))

    return add_grain(img, seed + 30, strength=4, seamless=True)


def make_water_wall(kind: str, seed: int) -> Image.Image:
    w, h = 512, 128
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)

    if kind == "seawall_masonry":
        draw.rectangle((0, 20, w, 108), fill=(104, 112, 116, 255), outline=INK, width=4)
        for x in range(0, w, 64):
            t = rng.randint(-14, 14)
            draw.rectangle(
                (x + 2, 24, x + 62, 104),
                fill=(clamp(108 + t), clamp(116 + t), clamp(120 + t), 255),
                outline=(38, 42, 46, 220),
                width=3,
            )
            draw.rectangle((x + 6, 28, x + 58, 42), fill=(154, 162, 164, 130))
            if rng.random() > 0.5:
                draw.ellipse((x + 10, 82, x + 44, 102), fill=(68, 106, 62, 150))
    elif kind == "pier_rope_rail":
        # Rope line connecting round timber dock posts
        pts = [(x, 64 + math.sin((x / 128.0) * math.pi) * 8) for x in range(0, w + 8, 8)]
        draw.line(pts, fill=(176, 144, 96, 255), width=14)
        draw.line(pts, fill=(92, 68, 42, 190), width=3)
        for x in range(0, w + 1, 128):
            draw.ellipse((x - 20, 44, x + 20, 84), fill=(128, 94, 62, 255), outline=INK, width=4)
            draw.ellipse((x - 10, 54, x + 10, 74), outline=(72, 52, 34, 180), width=2)
    elif kind == "yacht_white_hull":
        # Gleaming ivory-white luxury yacht gunwale with brushed brass trim & teak cap rail!
        draw.rectangle((0, 18, w, 110), fill=(242, 238, 226, 255), outline=INK, width=4)
        draw.rectangle((0, 22, w, 34), fill=(208, 168, 76, 255))
        draw.rectangle((0, 94, w, 106), fill=(208, 168, 76, 255))
        draw.rectangle((0, 42, w, 86), fill=(158, 106, 62, 255), outline=(92, 58, 32, 220), width=3)
        for x in range(32, w, 64):
            draw.ellipse((x - 6, 58, x + 6, 70), fill=(226, 188, 92, 255), outline=INK, width=2)
    elif kind == "timber_retaining_dock":
        # Creosote dark-timber bulkhead piling retaining wall
        draw.rectangle((0, 24, w, 104), fill=(86, 64, 46, 255), outline=INK, width=4)
        for x in range(16, w, 32):
            t = rng.randint(-10, 10)
            draw.ellipse(
                (x - 15, 22, x + 15, 106),
                fill=(clamp(92 + t), clamp(68 + t), clamp(48 + t), 255),
                outline=INK,
                width=3,
            )
        draw.rectangle((0, 52, w, 76), fill=(68, 74, 80, 255), outline=INK, width=3)

    return add_grain(img, seed + 70, strength=4, seamless=True)


def main() -> None:
    manifest_path = OUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    by_path: dict[str, dict[str, Any]] = {a["path"]: a for a in manifest["assets"]}

    sliced_count = 0
    preview_tiles: list[tuple[str, Image.Image]] = []

    # 1. Slice all 7 4x4 top-down water sheets (112 props)
    for sheet_cfg in WATER_SHEETS:
        sheet_path = BRAIN_DIR / sheet_cfg["file"]
        if not sheet_path.exists():
            raise FileNotFoundError(f"Missing water sheet: {sheet_path}")
        sheet = Image.open(sheet_path)
        xs, ys = find_grid_cuts_4x4(sheet)
        pack_dir = OUT_DIR / "props" / sheet_cfg["pack"]
        pack_dir.mkdir(parents=True, exist_ok=True)
        mode = sheet_cfg["mode"]

        for idx, (slug, name, tags, target_cells, casts_shadow, clear_int) in enumerate(
            sheet_cfg["items"]
        ):
            row, col = divmod(idx, 4)
            raw_tile = sheet.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
            if mode == "water_effect":
                cleaned = key_water_effect_to_alpha(raw_tile)
            else:
                cleaned = key_white_to_alpha(raw_tile, clear_interior_white=clear_int)

            # Resize neatly to crisp ~256-320px max edge for fast GPU upload & ultra-sharp 4K print
            max_dim = 320 if target_cells >= 2.4 else 256
            if max(cleaned.width, cleaned.height) > max_dim:
                scale = max_dim / max(cleaned.width, cleaned.height)
                cleaned = cleaned.resize(
                    (max(16, round(cleaned.width * scale)), max(16, round(cleaned.height * scale))),
                    Image.Resampling.LANCZOS,
                )

            rel_path = f"props/{sheet_cfg['pack']}/{slug}.png"
            out_file = OUT_DIR / rel_path
            cleaned.save(out_file, "PNG", optimize=True)
            sliced_count += 1

            if idx in (0, 2, 5, 11):
                preview_tiles.append((slug, cleaned))

            ppi = max(64, round(max(cleaned.width, cleaned.height) / max(0.5, target_cells)))
            by_path[rel_path] = {
                "path": rel_path,
                "displayName": name,
                "category": "object",
                "tags": sorted(set(tags + ["cc0", "modular", "modular_cc0", "water_suite", sheet_cfg["pack"]])),
                "drawMode": "normal",
                "defaultPpi": ppi,
                "castsShadow": casts_shadow,
                "dominantHex": dominant_hex(cleaned),
                "widthPx": cleaned.width,
                "heightPx": cleaned.height,
            }

    # 2. Synthesize 6 seamless Water & Shoreline Terrains
    terrain_specs = [
        ("water_alpine_crystal", "Alpine Crystal Lake Water", ["water", "lake", "alpine", "crystal", "terrain"],
         make_water_terrain(9101, (22, 102, 134), (62, 178, 206), (12, 62, 92), (170, 242, 255))),
        ("water_tropical_lagoon", "Tropical Turquoise Lagoon Water", ["water", "tropical", "lagoon", "beach", "terrain"],
         make_water_terrain(9102, (20, 148, 164), (78, 224, 214), (10, 96, 122), (210, 255, 250))),
        ("water_deep_ocean_swell", "Deep Ocean Maritime Swell", ["water", "ocean", "sea", "deep", "terrain"],
         make_water_terrain(9103, (12, 46, 78), (34, 96, 138), (6, 26, 48), None)),
        ("water_murky_swamp_bayou", "Murky Bayou Swamp Water", ["water", "swamp", "bayou", "bog", "terrain"],
         make_water_terrain(9104, (44, 66, 42), (82, 108, 66), (26, 42, 26), None, swamp_flecks=True)),
        ("shore_wet_sand_pebbles", "Wet Shoreline Sand & Pebbles", ["water", "shore", "sand", "beach", "pebbles", "terrain"],
         make_shore_pebble_terrain(9105, wet_sand=True)),
        ("shore_lakebed_stones", "Submerged Lakebed River Stones", ["water", "lakebed", "submerged", "stones", "river", "terrain"],
         make_shore_pebble_terrain(9106, wet_sand=False)),
    ]
    terrain_dir = OUT_DIR / "terrain"
    terrain_dir.mkdir(parents=True, exist_ok=True)
    for slug, name, tags, img in terrain_specs:
        rel_path = f"terrain/{slug}.png"
        img.save(OUT_DIR / rel_path, "PNG", optimize=True)
        by_path[rel_path] = {
            "path": rel_path,
            "displayName": name,
            "category": "terrain",
            "tags": sorted(set(tags + ["cc0", "modular", "modular_cc0", "water_suite"])),
            "drawMode": "normal",
            "defaultPpi": 128,
            "castsShadow": False,
            "dominantHex": dominant_hex(img),
            "widthPx": img.width,
            "heightPx": img.height,
        }

    # 3. Synthesize 6 seamless Water & Shoreline Paths
    path_specs = [
        ("water_shore_foam_wave", "Lapping Shoreline Foam Wave Trail", ["water", "shore", "foam", "wave", "beach", "path"], "shore_foam", 9201),
        ("water_river_current_rapids", "Bubbling Whitewater River Rapids Path", ["water", "river", "rapids", "current", "foam", "path"], "river_rapids", 9202),
        ("water_boat_wake_trail", "Twin Foamy Boat Wake Trail", ["water", "boat", "wake", "yacht", "ship", "path"], "boat_wake", 9203),
        ("water_waterfall_cascade", "Plunging Frothy Waterfall Sheet", ["water", "waterfall", "cascade", "river", "path"], "waterfall", 9204),
        ("water_timber_pier_edge", "Weathered Timber Pier & Piling Edge", ["water", "dock", "pier", "wood", "path"], "pier_edge", 9205),
        ("water_stone_seawall_quay", "Mossy Cut-Stone Harbor Quay Edge", ["water", "seawall", "quay", "stone", "harbor", "path"], "stone_quay", 9206),
    ]
    paths_dir = OUT_DIR / "paths"
    paths_dir.mkdir(parents=True, exist_ok=True)
    for slug, name, tags, kind, seed in path_specs:
        img = make_water_path(kind, seed)
        rel_path = f"paths/{slug}.png"
        img.save(OUT_DIR / rel_path, "PNG", optimize=True)
        by_path[rel_path] = {
            "path": rel_path,
            "displayName": name,
            "category": "path",
            "tags": sorted(set(tags + ["cc0", "modular", "modular_cc0", "water_suite"])),
            "drawMode": "normal",
            "defaultPpi": 128,
            "castsShadow": False,
            "dominantHex": dominant_hex(img),
            "widthPx": img.width,
            "heightPx": img.height,
        }

    # 4. Synthesize 4 seamless Waterfront Smart Walls
    wall_specs = [
        ("water_seawall_masonry", "Wet Mossy Stone Seawall Masonry", ["water", "seawall", "stone", "harbor", "wall"], "seawall_masonry", 9301),
        ("water_pier_rope_railing", "Timber Pier Posts & Nautical Rope Rail", ["water", "dock", "pier", "rope", "railing", "wall"], "pier_rope_rail", 9302),
        ("water_yacht_white_hull", "Ivory & Brass Luxury Yacht Gunwale", ["water", "yacht", "ship", "hull", "luxury", "wall"], "yacht_white_hull", 9303),
        ("water_timber_retaining_dock", "Creosote Timber Bulkhead Retaining Wall", ["water", "dock", "timber", "bulkhead", "wall"], "timber_retaining_dock", 9304),
    ]
    walls_dir = OUT_DIR / "walls"
    walls_dir.mkdir(parents=True, exist_ok=True)
    for slug, name, tags, kind, seed in wall_specs:
        img = make_water_wall(kind, seed)
        rel_path = f"walls/{slug}.png"
        img.save(OUT_DIR / rel_path, "PNG", optimize=True)
        by_path[rel_path] = {
            "path": rel_path,
            "displayName": name,
            "category": "wall",
            "tags": sorted(set(tags + ["cc0", "modular", "modular_cc0", "water_suite"])),
            "drawMode": "normal",
            "defaultPpi": 128,
            "castsShadow": True,
            "dominantHex": dominant_hex(img),
            "widthPx": img.width,
            "heightPx": img.height,
        }

    # 5. Update manifest.json & rebuild DiceChaos_Modular_Suite_CC0.dcpack
    manifest["assets"] = list(by_path.values())
    manifest["assetCount"] = len(manifest["assets"])
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(manifest_path, "manifest.json")
        for item in manifest["assets"]:
            fp = OUT_DIR / item["path"]
            if fp.exists():
                zf.write(fp, item["path"])

    # 6. Render a visual contact sheet on deep lake blue to verify zero white halos!
    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    cols = 7
    rows = 4
    cell = 160
    sheet_img = Image.new("RGBA", (cols * cell, rows * cell), (12, 62, 94, 255))
    for i, (_slug, tile) in enumerate(preview_tiles[: cols * rows]):
        r, c = divmod(i, cols)
        copy = tile.copy()
        copy.thumbnail((cell - 16, cell - 16), Image.Resampling.LANCZOS)
        ox = c * cell + (cell - copy.width) // 2
        oy = r * cell + (cell - copy.height) // 2
        sheet_img.alpha_composite(copy, (ox, oy))
    preview_path = SCRATCH_DIR / "water_suite_qa_sheet.png"
    sheet_img.save(preview_path, "PNG")

    total_new = sliced_count + len(terrain_specs) + len(path_specs) + len(wall_specs)
    print(f"SUCCESS: Generated {total_new} new CC0 Water Scene assets ({sliced_count} props + 16 terrains/paths/walls).")
    print(f"Modular Suite total indexed assets: {len(manifest['assets'])}")
    print(f"QA preview sheet: {preview_path}")


if __name__ == "__main__":
    main()

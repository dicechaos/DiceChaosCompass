#!/usr/bin/env python3
"""
Dice Chaos Compass — Clean-Room CC0 Modular World & Everyday Scenes Suite Generator
================================================================================
House Art Style: "Crisp Hand-Inked Tabletop"
  - Strict 90-degree top-down orthographic battlemap perspective
  - Dark sepia-charcoal (#1E1815) hand-inked outlines (2x supersampled + LANCZOS)
  - Warm painterly gouache shading & subtle organic texture grain
  - 100% original clean-room CC0 artwork safe to ship in the open-source repo

Contents (~730 modular CC0 assets, bringing total bundled CC0 library to 1,020+):
  1. 370 AI-illustrated individual modular props sliced from 24 hand-inked sheets
     (Trees x18, Bushes/Flora x16, Rocks/Forest x16, Doctor/Apothecary x16,
      Bakery/Patisserie x16, Blacksmith/Forge x16, Kitchen/Pantry x16,
      Post Office/Bank/Study x16, Funeral/Graveyard x16, Tavern Tableware x16,
      General Store/Market/Tailor x16, Bedroom/Bath/Home x16, Library/Alchemy x16,
      Armory/Dungeon x16, Docks/Streets x16, Temple/Chapel x16, Farm/Stable x16,
      Bare Modular Furniture x16, Camp/Travel x16, Mining/Cavern x16,
      School/Courtroom/Guildhall x16, Sewers/Alleys/Industrial x16,
      Music/Theater/Festival/Tea x16)
  2. 24 Seamless Terrains (512x512)
  3. 16 Seamless Smart Walls (512x128, incl. 2 native dd_red colorables)
  4. 16 Seamless Paths (512x128, incl. 2 native dd_red colorables)
  5. 16 Carve-Ready Portals (256x128, incl. 3 native dd_red colorables)
  6. 150 Native Dungeondraft Red-Mask Colorable Individual Modular Props (`dd_red`)
  7. 138 Bare Modular Furniture, Storage Variants, Decals & Modular Architecture

Output:
  - public/assets/modular-suite-cc0/{props,terrain,walls,paths,portals,colorable,modular}/
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
SHEET_DIR = pathlib.Path(
    r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae"
)

INK = (30, 24, 21, 255)
INK_SOFT = (30, 24, 21, 175)
SHADOW = (16, 12, 10, 92)

# Exact Dungeondraft `dd_red` pure red-channel shading ramp (g == b => hue 0 deg)
RD_DARK = (124, 12, 12, 255)
RD_MID = (218, 22, 22, 255)
RD_BRIGHT = (248, 46, 46, 255)
RD_HI = (255, 130, 130, 255)
RD_PALE = (255, 188, 188, 255)

WOOD_OAK = (158, 110, 68)
WOOD_WALNUT = (96, 65, 44)
WOOD_PINE = (206, 168, 114)
WOOD_WHITE = (224, 218, 206)
STONE_LIGHT = (176, 172, 164)
STONE_DARK = (102, 104, 110)
BRASS = (196, 158, 72)
IRON = (86, 90, 98)

MANIFEST_ITEMS: list[dict[str, Any]] = []


def clamp(v: float, lo: int = 0, hi: int = 255) -> int:
    return max(lo, min(hi, int(round(v))))


def shade(rgb: tuple[int, int, int], factor: float, alpha: int = 255) -> tuple[int, int, int, int]:
    return (clamp(rgb[0] * factor), clamp(rgb[1] * factor), clamp(rgb[2] * factor), alpha)


def jitter_rgb(rng: random.Random, rgb: tuple[int, int, int], amt: int = 11) -> tuple[int, int, int, int]:
    d = rng.randint(-amt, amt)
    return (
        clamp(rgb[0] + d + rng.randint(-3, 3)),
        clamp(rgb[1] + d + rng.randint(-3, 3)),
        clamp(rgb[2] + d + rng.randint(-3, 3)),
        255,
    )


def add_grain(img: Image.Image, seed: int, strength: int = 7, seamless: bool = False) -> Image.Image:
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
    r_s = g_s = b_s = cnt = 0
    for r, g, b, a in small.get_flattened_data():
        if a > 120:
            r_s += r
            g_s += g
            b_s += b
            cnt += 1
    if cnt == 0:
        return "#7C8A9E"
    return f"#{r_s // cnt:02X}{g_s // cnt:02X}{b_s // cnt:02X}"


def save_asset(
    rel_path: str,
    img: Image.Image,
    display_name: str,
    category: str,
    tags: list[str],
    draw_mode: str = "normal",
    default_ppi: int = 256,
    casts_shadow: bool = True,
) -> None:
    out = OUT_DIR / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    MANIFEST_ITEMS.append(
        {
            "path": rel_path.replace("\\", "/"),
            "displayName": display_name,
            "category": category,
            "tags": sorted(set(tags + ["modular_cc0", "cc0"])),
            "drawMode": draw_mode,
            "defaultPpi": default_ppi,
            "castsShadow": casts_shadow,
            "dominantHex": dominant_hex(img),
            "widthPx": img.width,
            "heightPx": img.height,
        }
    )


def make_ss(w: int, h: int, bg: tuple[int, int, int, int] = (0, 0, 0, 0)) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGBA", (w * 2, h * 2), bg)
    return im, ImageDraw.Draw(im)


def finish_ss(im: Image.Image, w: int, h: int, seed: int, grain: int = 6) -> Image.Image:
    out = im.resize((w, h), Image.Resampling.LANCZOS)
    return add_grain(out, seed, grain) if grain > 0 else out


# ============================================================================
# 1. AI-ILLUSTRATED MODULAR PROP SHEETS SLICER (24 Sheets -> 370 Props)
# ============================================================================

# Each item tuple: (slug, displayName, tags, target_cells, casts_shadow, clear_interior_white)
AI_SHEETS: list[dict[str, Any]] = [
    {
        "file": "trees_pack_a_deciduous_orchard_v2_1795346071269.jpg",
        "pack": "trees_deciduous",
        "cols": 3,
        "rows": 3,
        "items": [
            ("tree_oak_broad", "Broad Green Oak Tree", ["tree", "nature", "forest", "oak", "deciduous"], 3.6, True, True),
            ("tree_ancient_oak", "Ancient Spreading Oak Tree", ["tree", "nature", "forest", "oak", "ancient"], 3.8, True, True),
            ("tree_birch_silver", "Light Silver Birch Tree", ["tree", "nature", "forest", "birch", "deciduous"], 3.2, True, True),
            ("tree_weeping_willow", "Weeping Willow Tree", ["tree", "nature", "swamp", "willow", "water"], 3.7, True, True),
            ("tree_cherry_blossom", "Spring Cherry Blossom Tree", ["tree", "nature", "garden", "blossom", "pink"], 3.4, True, True),
            ("tree_apple_orchard", "Red Apple Orchard Tree", ["tree", "nature", "farm", "orchard", "fruit"], 3.3, True, True),
            ("tree_autumn_maple_red", "Crimson Autumn Maple Tree", ["tree", "nature", "forest", "autumn", "maple"], 3.4, True, True),
            ("tree_golden_birch", "Golden Autumn Birch Tree", ["tree", "nature", "forest", "autumn", "birch"], 3.3, True, True),
            ("tree_silver_olive", "Silvery Mediterranean Olive Tree", ["tree", "nature", "garden", "orchard", "deciduous"], 3.2, True, True),
        ],
    },
    {
        "file": "trees_pack_b_conifers_swamp_dead_v3_1795346096660.jpg",
        "pack": "trees_biomes",
        "cols": 3,
        "rows": 3,
        "items": [
            ("tree_dark_pine", "Dark Forest Pine Tree", ["tree", "nature", "forest", "pine", "conifer"], 3.2, True, True),
            ("tree_tall_spruce", "Alpine Blue Spruce Tree", ["tree", "nature", "forest", "spruce", "conifer"], 3.2, True, True),
            ("tree_snowy_pine", "Snow-Laden Winter Pine Tree", ["tree", "nature", "winter", "snow", "pine"], 3.2, True, False),
            ("tree_cypress_spire", "Tall Spiral Garden Cypress Tree", ["tree", "nature", "garden", "graveyard", "cypress"], 2.8, True, True),
            ("tree_tropical_palm", "Coastal Coconut Palm Tree", ["tree", "nature", "tropical", "palm", "beach"], 3.3, True, True),
            ("tree_banana_palm", "Tropical Broadleaf Banana Palm", ["tree", "nature", "tropical", "palm", "jungle"], 3.2, True, True),
            ("tree_dead_gnarled", "Bleached Dead Gnarled Tree", ["tree", "nature", "graveyard", "dead", "swamp"], 3.1, True, True),
            ("tree_swamp_cypress", "Mossy Swamp Cypress Tree", ["tree", "nature", "swamp", "cypress"], 3.6, True, True),
            ("tree_charred_dead", "Charred Burned Dead Tree", ["tree", "nature", "dungeon", "dead", "ruin"], 3.1, True, True),
        ],
    },
    {
        "file": "bushes_shrubs_flora_16_props_1795346056887.jpg",
        "pack": "flora",
        "cols": 4,
        "rows": 4,
        "items": [
            ("bush_round_green", "Round Green Forest Bush", ["bush", "nature", "forest", "flora"], 1.4, True, True),
            ("bush_sprawling_shrub", "Sprawling Woodland Shrub", ["bush", "nature", "forest", "flora"], 1.7, True, True),
            ("bush_white_blossom", "White-Blossom Garden Bush", ["bush", "nature", "garden", "flower", "flora"], 1.5, True, False),
            ("bush_thorny_bramble", "Dark Thorny Bramble Thicket", ["bush", "nature", "swamp", "graveyard", "bramble"], 1.6, True, True),
            ("bush_autumn_russet", "Russet Autumn Bush", ["bush", "nature", "autumn", "flora"], 1.4, True, True),
            ("bush_autumn_gold", "Golden Autumn Bush", ["bush", "nature", "autumn", "flora"], 1.4, True, True),
            ("bush_holly_red_berry", "Holly Bush with Red Berries", ["bush", "nature", "winter", "berry", "flora"], 1.4, True, True),
            ("bush_blueberry", "Wild Blueberry Shrub", ["bush", "nature", "forest", "berry", "flora"], 1.4, True, True),
            ("flora_woodland_fern", "Woodland Green Fern", ["fern", "nature", "forest", "flora"], 1.1, False, True),
            ("flora_fiddlehead_fern", "Curled Fiddlehead Fern", ["fern", "nature", "swamp", "flora"], 1.0, False, True),
            ("flora_tropical_fern", "Deep Tropical Fern Fronds", ["fern", "nature", "tropical", "flora"], 1.3, False, True),
            ("flora_yellow_wildflowers", "Yellow Wildflower Grass Tuft", ["flower", "nature", "meadow", "flora"], 0.9, False, True),
            ("flora_lavender_clump", "Wild Lavender & Purple Flowers", ["flower", "nature", "garden", "apothecary", "flora"], 0.9, False, True),
            ("flora_cattail_reeds", "Marsh Cattails & Reeds", ["reeds", "nature", "swamp", "water", "flora"], 1.2, False, True),
            ("flora_lily_pads_lotus", "Lily Pads & Pink Water Lily", ["water", "nature", "garden", "pond", "flora"], 1.2, False, True),
            ("bush_trimmed_boxwood", "Trimmed Square Boxwood Hedge", ["bush", "nature", "garden", "mansion", "hedge"], 1.3, True, True),
        ],
    },
    {
        "file": "rocks_boulders_forest_floor_topdown_v2_1795346079097.jpg",
        "pack": "rocks_nature",
        "cols": 4,
        "rows": 4,
        "items": [
            ("rock_smooth_river", "Smooth Grey River Boulder", ["rock", "boulder", "nature", "water"], 1.2, True, False),
            ("rock_jagged_granite", "Jagged Granite Boulder", ["rock", "boulder", "nature", "mountain", "cave"], 1.6, True, False),
            ("rock_flat_stepping", "Flat Limestone Slab Rock", ["rock", "stone", "nature", "path"], 1.4, False, False),
            ("rock_cracked_slate", "Cracked Dark Slate Rock", ["rock", "stone", "nature", "cave", "dungeon"], 1.5, True, False),
            ("rock_mossy_boulder", "Moss-Covered Forest Boulder", ["rock", "boulder", "nature", "forest", "moss"], 1.5, True, False),
            ("rock_twin_mossy", "Pair of Mossy Stream Stones", ["rock", "stone", "nature", "forest", "water"], 1.2, True, False),
            ("rock_sandstone_tiered", "Tiered Desert Sandstone Rock", ["rock", "boulder", "nature", "desert"], 1.7, True, False),
            ("rock_red_mesa", "Red Mesa Outcrop Rock", ["rock", "boulder", "nature", "desert", "canyon"], 1.7, True, False),
            ("nature_fresh_stump", "Freshly Cut Tree Stump", ["stump", "nature", "forest", "wood"], 1.2, True, False),
            ("nature_hollow_stump", "Hollow Mossy Tree Stump", ["stump", "nature", "forest", "swamp"], 1.4, True, False),
            ("nature_mossy_log", "Fallen Mossy Forest Log", ["log", "nature", "forest", "wood"], 2.0, True, False),
            ("nature_driftwood_log", "Bleached Driftwood Log", ["log", "nature", "beach", "water", "wood"], 1.9, True, False),
            ("nature_firewood_bundle", "Tied Firewood Branch Bundle", ["wood", "camp", "nature", "forest"], 1.1, True, False),
            ("nature_mushroom_ring", "Woodland Brown Mushroom Ring", ["mushroom", "nature", "forest", "fey"], 1.2, False, False),
            ("nature_pebble_scatter", "Scattered River Pebbles", ["rock", "pebbles", "nature", "decal"], 1.1, False, True),
            ("nature_bleached_skull", "Bleached Horned Beast Skull", ["skull", "bones", "nature", "desert", "camp"], 0.9, True, False),
        ],
    },
    {
        "file": "doctor_office_apothecary_props_v2_1795346085710.jpg",
        "pack": "doctor_apothecary",
        "cols": 4,
        "rows": 4,
        "cell_overrides": {
            0: (0.0, 0.0, 0.25, 0.355),
            4: (0.0, 0.355, 0.265, 0.52),
        },
        "items": [
            ("doc_exam_table", "Doctor Wooden Exam Table", ["doctor", "clinic", "medical", "furniture", "bed"], 2.1, True, False),
            ("doc_surgical_tray", "Steel Surgical Scalpel & Scissors Tray", ["doctor", "clinic", "medical", "clutter", "tool"], 0.6, False, False),
            ("doc_bone_saw_forceps", "Medical Bone Saw & Forceps", ["doctor", "clinic", "medical", "tool"], 0.65, False, False),
            ("doc_mortar_pestle", "Stone Mortar & Pestle with Herbs", ["doctor", "apothecary", "alchemy", "kitchen", "clutter"], 0.55, False, False),
            ("doc_apothecary_cabinet", "Bare Apothecary Drawer Counter", ["doctor", "apothecary", "furniture", "bare"], 1.7, True, False),
            ("doc_medicine_vials", "Trio of Corked Medicine Vials", ["doctor", "apothecary", "potion", "clutter"], 0.5, False, False),
            ("doc_brass_microscope", "Brass Tabletop Microscope", ["doctor", "clinic", "science", "study", "clutter"], 0.6, True, False),
            ("doc_anatomy_scroll", "Unrolled Human Anatomy Chart", ["doctor", "clinic", "study", "paper", "clutter"], 0.8, False, False),
            ("doc_bandages_gauze", "Rolled Bandages & Folded Gauze", ["doctor", "clinic", "medical", "clutter"], 0.6, False, False),
            ("doc_specimen_jar", "Corked Botanical Specimen Jar", ["doctor", "apothecary", "alchemy", "jar", "clutter"], 0.5, False, False),
            ("doc_wash_basin_pitcher", "Porcelain Wash Basin & Pitcher", ["doctor", "clinic", "bedroom", "bath", "clutter"], 0.8, False, False),
            ("doc_leather_satchel", "Leather Physician Medical Bag", ["doctor", "clinic", "travel", "bag", "clutter"], 0.75, True, False),
            ("doc_wooden_crutches", "Pair of Wooden Medical Crutches", ["doctor", "clinic", "medical", "wood"], 1.2, False, True),
            ("doc_dried_lavender", "Tied Dried Lavender Herb Bundle", ["doctor", "apothecary", "kitchen", "herb", "clutter"], 0.7, False, True),
            ("doc_infirmary_cot", "Iron-Frame Infirmary Patient Cot", ["doctor", "clinic", "medical", "bed", "furniture"], 2.0, True, False),
            ("doc_leather_stool", "Round Leather Doctor Stool", ["doctor", "clinic", "stool", "chair", "furniture"], 0.85, True, False),
        ],
    },
    {
        "file": "bakery_patisserie_props_sheet_v3_1795346111356.jpg",
        "pack": "bakery",
        "cols": 4,
        "rows": 4,
        "items": [
            ("bak_brick_bread_oven", "Domed Red Brick Bread Oven", ["bakery", "kitchen", "oven", "hearth"], 2.6, True, False),
            ("bak_bare_baker_table", "Bare Wooden Baker Prep Table", ["bakery", "kitchen", "table", "bare", "furniture"], 1.9, True, False),
            ("bak_wooden_bread_peel", "Long Wooden Bread Oven Peel", ["bakery", "kitchen", "tool"], 1.2, False, False),
            ("bak_braided_loaf", "Golden Braided Bread Loaf", ["bakery", "kitchen", "food", "bread", "clutter"], 0.6, False, False),
            ("bak_baguette_basket", "Wicker Basket of Baguettes", ["bakery", "kitchen", "food", "bread", "clutter"], 0.85, True, False),
            ("bak_lattice_cherry_pie", "Lattice-Crust Cherry Pie", ["bakery", "kitchen", "food", "dessert", "clutter"], 0.55, False, False),
            ("bak_strawberry_cake", "Frosted Strawberry Layer Cake", ["bakery", "kitchen", "food", "dessert", "clutter"], 0.6, False, False),
            ("bak_cinnamon_rolls_tray", "Baking Sheet of Cinnamon Rolls", ["bakery", "kitchen", "food", "pastry", "clutter"], 0.75, False, False),
            ("bak_croissant_tray", "Wooden Display Tray of Croissants", ["bakery", "kitchen", "food", "pastry", "clutter"], 0.8, False, False),
            ("bak_flour_sack", "Flour-Dusted Burlap Flour Sack", ["bakery", "kitchen", "pantry", "sack", "storage"], 0.95, True, False),
            ("bak_dough_trough", "Wooden Proofing Trough with Dough", ["bakery", "kitchen", "food", "clutter"], 0.95, True, False),
            ("bak_cookie_cooling_rack", "Wire Cooling Rack of Cookies", ["bakery", "kitchen", "food", "dessert", "clutter"], 0.75, False, True),
            ("bak_jam_honey_jars", "Open Jam & Honey Preserve Jars", ["bakery", "kitchen", "food", "jar", "clutter"], 0.5, False, False),
            ("bak_brass_balance_scale", "Brass Shopkeeper Balance Scale", ["bakery", "market", "post_office", "clutter"], 0.65, False, True),
            ("bak_open_flour_barrel", "Open Flour Barrel with Wooden Scoop", ["bakery", "kitchen", "pantry", "barrel"], 1.1, True, False),
            ("bak_rolling_pin_board", "Floured Pastry Board & Rolling Pin", ["bakery", "kitchen", "tool", "clutter"], 0.8, False, False),
        ],
    },
    {
        "file": "blacksmith_forge_workshop_16_props_1795346132833.jpg",
        "pack": "blacksmith",
        "cols": 4,
        "rows": 4,
        "items": [
            ("bs_stone_forge_hearth", "Glowing Coal Stone Forge Hearth", ["blacksmith", "forge", "workshop", "fire"], 2.2, True, False),
            ("bs_iron_anvil_stump", "Steel Blacksmith Anvil on Log Block", ["blacksmith", "forge", "workshop", "anvil"], 1.4, True, False),
            ("bs_quench_barrel", "Iron-Banded Water Quench Barrel", ["blacksmith", "forge", "workshop", "barrel"], 1.1, True, False),
            ("bs_leather_bellows", "Wood & Leather Forge Bellows", ["blacksmith", "forge", "workshop", "tool"], 1.1, True, False),
            ("bs_tongs_hammer", "Blacksmith Iron Tongs & Hammer", ["blacksmith", "forge", "workshop", "tool", "clutter"], 0.65, False, False),
            ("bs_iron_ingot_stack", "Stacked Iron & Steel Ingots", ["blacksmith", "forge", "mining", "metal", "clutter"], 0.95, True, False),
            ("bs_glowing_blade", "Red-Hot Forged Sword Blade", ["blacksmith", "forge", "weapon", "clutter"], 0.9, False, False),
            ("bs_grindstone_wheel", "Framed Stone Sharpening Grindstone", ["blacksmith", "forge", "workshop", "tool"], 1.2, True, True),
            ("bs_horseshoes_set", "Four Forged Iron Horseshoes", ["blacksmith", "farm", "stable", "clutter"], 0.55, False, True),
            ("bs_carpenter_workbench", "Bare Woodworker Vise Workbench", ["blacksmith", "workshop", "bare", "furniture"], 1.8, True, False),
            ("bs_saw_mallet", "Hand Saw & Wooden Mallet", ["blacksmith", "workshop", "tool", "clutter"], 0.7, False, False),
            ("bs_chain_rope_coil", "Coiled Iron Chain & Hemp Rope", ["blacksmith", "workshop", "docks", "dungeon", "clutter"], 0.85, False, True),
            ("bs_open_toolbox", "Open Wooden Wrench & Chisel Toolbox", ["blacksmith", "workshop", "tool", "clutter"], 0.9, True, False),
            ("bs_wagon_wheel", "Spoked Wooden Wagon Wheel", ["blacksmith", "farm", "camp", "wheel"], 1.3, True, True),
            ("bs_coal_pile", "Heap of Black Forge Coal", ["blacksmith", "forge", "mining", "coal"], 1.2, True, False),
            ("bs_iron_slag_bucket", "Heavy Iron Workshop Bucket", ["blacksmith", "forge", "workshop", "bucket"], 0.8, True, False),
        ],
    },
    {
        "file": "kitchen_pantry_props_sheet_ortho_1795346151706.jpg",
        "pack": "kitchen",
        "cols": 4,
        "rows": 4,
        "items": [
            ("kit_butcher_block", "End-Grain Wooden Butcher Block", ["kitchen", "bakery", "furniture", "bare"], 1.2, True, False),
            ("kit_cast_iron_skillet", "Cast-Iron Frying Skillet", ["kitchen", "tavern", "camp", "cookware", "clutter"], 0.55, False, False),
            ("kit_copper_stockpot", "Lidded Copper Soup Stockpot", ["kitchen", "tavern", "cookware", "clutter"], 0.65, True, False),
            ("kit_chopping_board_knives", "Chopping Board with Chef Knife & Cleaver", ["kitchen", "bakery", "tool", "clutter"], 0.65, False, False),
            ("kit_cheese_wheel", "Wedge-Cut Golden Cheese Wheel", ["kitchen", "tavern", "pantry", "food", "clutter"], 0.6, False, False),
            ("kit_sourdough_boule", "Crusty Scored Sourdough Bread Boule", ["kitchen", "bakery", "food", "bread", "clutter"], 0.55, False, False),
            ("kit_grain_sack", "Tied Pantry Grain Sack", ["kitchen", "pantry", "farm", "sack", "storage"], 0.95, True, False),
            ("kit_spice_jars", "Trio of Corked Glass Spice Jars", ["kitchen", "pantry", "apothecary", "clutter"], 0.45, False, False),
            ("kit_vegetable_basket", "Wicker Basket of Tomatoes, Leeks & Carrots", ["kitchen", "market", "farm", "food", "clutter"], 0.85, True, False),
            ("kit_egg_basket", "Wicker Basket of Farm Eggs", ["kitchen", "bakery", "farm", "food", "clutter"], 0.65, True, False),
            ("kit_butter_churn", "Wooden Iron-Banded Butter Churn", ["kitchen", "farm", "pantry", "barrel"], 0.85, True, False),
            ("kit_soapy_washtub", "Wooden Washtub with Soapy Water", ["kitchen", "bedroom", "bath", "tub"], 1.1, True, False),
            ("kit_ham_sausage_platter", "Wooden Platter of Ham & Sausages", ["kitchen", "tavern", "food", "clutter"], 0.75, False, False),
            ("kit_iron_cookstove", "Black Cast-Iron Four-Burner Stove", ["kitchen", "home", "stove", "furniture"], 1.8, True, False),
            ("kit_ceramic_plate_stack", "Stack of Cream Ceramic Plates & Bowl", ["kitchen", "tavern", "tableware", "clutter"], 0.55, False, False),
            ("kit_kindling_basket", "Wicker Basket of Split Firewood", ["kitchen", "home", "hearth", "wood"], 0.9, True, False),
        ],
    },
    {
        "file": "post_office_bank_study_props_topdown_sheet_1795346156430.jpg",
        "pack": "post_office",
        "cols": 4,
        "rows": 4,
        "items": [
            ("po_bare_clerk_desk", "Bare Oak Postal Clerk Desk", ["post_office", "study", "bank", "desk", "bare", "furniture"], 1.9, True, False),
            ("po_mail_pigeonholes", "Wooden Mail Sorting Pigeonholes", ["post_office", "study", "office", "furniture"], 1.4, True, False),
            ("po_tied_letter_stack", "String-Tied Bundle of Letters", ["post_office", "study", "paper", "clutter"], 0.55, False, False),
            ("po_wax_sealed_envelope", "Wax-Sealed Parchment Envelope", ["post_office", "study", "paper", "clutter"], 0.45, False, False),
            ("po_wax_seal_stamp", "Brass Wax Seal Stamp & Red Wax Stick", ["post_office", "study", "noble", "clutter"], 0.45, False, False),
            ("po_quill_inkwell", "White Feather Quill & Glass Inkwell", ["post_office", "study", "library", "clutter"], 0.45, False, False),
            ("po_open_ledger", "Open Accounting Ledger Book", ["post_office", "bank", "study", "book", "clutter"], 0.6, False, False),
            ("po_brown_parcel", "Twine-Wrapped Brown Postal Parcel", ["post_office", "market", "package", "clutter"], 0.7, True, False),
            ("po_brass_scale_pan", "Brass Postal Weight Scale Plate", ["post_office", "bank", "market", "clutter"], 0.6, False, False),
            ("po_leather_mail_satchel", "Leather Courier Mail Satchel", ["post_office", "camp", "bag", "clutter"], 0.8, True, False),
            ("po_iron_strongbox", "Riveted Iron Bank Strongbox", ["post_office", "bank", "treasure", "chest"], 1.1, True, False),
            ("po_rubber_stamp_pad", "Wooden Hand Stamp & Black Ink Pad", ["post_office", "bank", "office", "clutter"], 0.5, False, False),
            ("po_brass_desk_bell", "Polished Brass Counter Service Bell", ["post_office", "bank", "tavern", "clutter"], 0.4, False, False),
            ("po_spectacles_magnifier", "Wire Spectacles & Magnifying Glass", ["post_office", "study", "library", "clutter"], 0.45, False, True),
            ("po_gold_coin_stacks", "Scattered Gold Coin Stacks", ["post_office", "bank", "treasure", "tavern", "clutter"], 0.55, False, True),
            ("po_green_banker_lamp", "Green-Shade Brass Banker's Lamp", ["post_office", "bank", "study", "lamp", "light"], 0.6, True, False),
        ],
    },
    {
        "file": "funeral_graveyard_props_4x4_v3_1795346174150.jpg",
        "pack": "funeral",
        "cols": 4,
        "rows": 4,
        "items": [
            ("fun_closed_coffin", "Closed Dark Oak Wooden Coffin", ["funeral", "graveyard", "crypt", "coffin"], 2.1, True, False),
            ("fun_open_satin_coffin", "Open Satin-Lined Funeral Coffin", ["funeral", "graveyard", "crypt", "coffin"], 2.2, True, False),
            ("fun_stone_headstone_slab", "Carved Stone Headstone & Grave Slab", ["funeral", "graveyard", "tombstone", "stone"], 1.8, True, False),
            ("fun_mossy_tombstone", "Cracked Mossy Old Tombstone", ["funeral", "graveyard", "tombstone", "stone"], 1.3, True, False),
            ("fun_celtic_cross_grave", "Mossy Carved Celtic Cross Marker", ["funeral", "graveyard", "tombstone", "temple"], 1.3, True, False),
            ("fun_grave_stone_border", "Stone-Curbed Grass Grave Plot", ["funeral", "graveyard", "stone"], 2.2, False, False),
            ("fun_fresh_dirt_mound", "Freshly Filled Grave Dirt Mound", ["funeral", "graveyard", "dirt", "nature"], 1.9, True, False),
            ("fun_open_dug_grave", "Deep Open Dug Grave Pit", ["funeral", "graveyard", "dirt", "dungeon"], 2.3, False, False),
            ("fun_shovel_pickaxe", "Crossed Gravedigger Shovel & Pickaxe", ["funeral", "graveyard", "mining", "tool"], 1.2, False, True),
            ("fun_white_lily_wreath", "Evergreen & White Lily Funeral Wreath", ["funeral", "graveyard", "flower", "wreath"], 1.1, False, True),
            ("fun_tall_candelabra", "Lit Ornate Brass Funeral Candelabra", ["funeral", "temple", "mansion", "candle", "light"], 1.1, True, True),
            ("fun_marble_cremation_urn", "Carved Marble Memorial Urn", ["funeral", "temple", "mansion", "urn"], 0.75, True, False),
            ("fun_velvet_bier", "Black-Velvet Draped Coffin Bier", ["funeral", "temple", "furniture"], 2.1, True, False),
            ("fun_weeping_angel", "Carved Stone Weeping Angel Statue", ["funeral", "graveyard", "temple", "statue"], 1.6, True, False),
            ("fun_cemetery_lantern", "Black Iron Cemetery Gate Lantern", ["funeral", "graveyard", "street", "light"], 0.9, True, False),
            ("fun_vigil_candles_roses", "Vigil Pillar Candles & White Roses", ["funeral", "graveyard", "temple", "candle"], 0.85, False, False),
        ],
    },
    {
        "file": "tavern_tableware_food_drinks_16_props_topdown_1795346163056.jpg",
        "pack": "tavern_clutter",
        "cols": 4,
        "rows": 4,
        "items": [
            ("tav_round_bar_stool", "Round Wooden Tavern Bar Stool", ["tavern", "inn", "stool", "chair", "furniture"], 0.8, True, False),
            ("tav_wooden_chair", "Simple Wooden Tavern Dining Chair", ["tavern", "inn", "kitchen", "chair", "furniture"], 0.9, True, False),
            ("tav_foamy_ale_mug", "Foamy Wooden Ale Tankard", ["tavern", "inn", "drink", "clutter"], 0.4, False, False),
            ("tav_wine_bottle_goblet", "Green Wine Bottle & Red Wine Cup", ["tavern", "inn", "drink", "clutter"], 0.48, False, False),
            ("tav_pewter_place_setting", "Pewter Dinner Plate, Fork & Knife", ["tavern", "kitchen", "dining", "tableware", "clutter"], 0.55, False, True),
            ("tav_hot_stew_bowl", "Steaming Hearty Meat Stew Bowl", ["tavern", "kitchen", "food", "clutter"], 0.5, False, False),
            ("tav_roast_chicken_platter", "Roast Chicken & Herb Serving Platter", ["tavern", "kitchen", "food", "clutter"], 0.75, False, False),
            ("tav_brass_chamberstick", "Lit Candle in Brass Finger Holder", ["tavern", "home", "study", "candle", "light"], 0.4, False, False),
            ("tav_playing_cards", "Fanned Hand of Playing Cards", ["tavern", "inn", "game", "clutter"], 0.45, False, False),
            ("tav_leather_dice_cup", "Leather Dice Cup & Ivory Dice", ["tavern", "inn", "game", "clutter"], 0.5, False, True),
            ("tav_wooden_lute", "Acoustic Wooden Bard Lute", ["tavern", "music", "bard", "clutter"], 0.95, True, False),
            ("tav_dartboard_darts", "Cork Tavern Dartboard with Darts", ["tavern", "inn", "game", "clutter"], 0.8, False, False),
            ("tav_mop_water_bucket", "Wooden Mop & Soapy Cleaning Bucket", ["tavern", "kitchen", "home", "cleaning"], 0.95, True, False),
            ("tav_straw_broom", "Bound Straw Sweeping Broom", ["tavern", "kitchen", "home", "cleaning"], 1.1, False, False),
            ("tav_spilled_ale_mug", "Tipped Tankard & Spilled Ale Puddle", ["tavern", "inn", "decal", "clutter"], 0.65, False, False),
            ("tav_serving_tray_mugs", "Round Wooden Tray with Two Ale Mugs", ["tavern", "inn", "drink", "clutter"], 0.75, False, False),
        ],
    },
    {
        "file": "general_store_market_tailor_props_sheet_v2_1795346155666.jpg",
        "pack": "market_tailor",
        "cols": 4,
        "rows": 4,
        "items": [
            ("mkt_bare_shop_counter", "Bare Wooden General Store Counter", ["market", "shop", "bare", "furniture"], 1.8, True, False),
            ("mkt_fabric_bolts_trio", "Three Rolled Blue, Red & Gold Cloth Bolts", ["market", "tailor", "fabric", "clutter"], 0.95, True, False),
            ("mkt_sewing_basket", "Wicker Sewing Basket, Shears & Thread", ["market", "tailor", "home", "clutter"], 0.7, True, False),
            ("mkt_apple_crate", "Wooden Market Crate of Red Apples", ["market", "farm", "kitchen", "crate", "food"], 1.0, True, False),
            ("mkt_produce_crate", "Market Crate of Carrots & Cabbages", ["market", "farm", "kitchen", "crate", "food"], 1.05, True, False),
            ("mkt_iced_fish_crate", "Wooden Crate of Fresh Fish on Ice", ["market", "docks", "kitchen", "crate", "food"], 1.05, True, False),
            ("mkt_terracotta_amphorae", "Trio of Terracotta Clay Jars", ["market", "pantry", "pottery", "clutter"], 0.9, True, True),
            ("mkt_spice_bowls_trio", "Three Wooden Market Spice Bowls", ["market", "kitchen", "food", "clutter"], 0.65, False, True),
            ("mkt_open_grain_barrel", "Open Wooden Barrel of Golden Grain", ["market", "farm", "pantry", "barrel"], 1.1, True, False),
            ("mkt_tied_burlap_sack", "Bulging Tied Burlap Goods Sack", ["market", "farm", "docks", "sack", "storage"], 0.95, True, False),
            ("mkt_brass_oil_lantern", "Hanging Brass Shop Lantern", ["market", "camp", "street", "light"], 0.55, True, False),
            ("mkt_folded_leather_hides", "Folded Stack of Tanned Leather Hides", ["market", "tailor", "blacksmith", "clutter"], 0.95, True, False),
            ("mkt_iron_padlock_keys", "Heavy Iron Padlock & Brass Keys", ["market", "dungeon", "bank", "clutter"], 0.45, False, True),
            ("mkt_wooden_abacus", "Wooden Merchant Counting Abacus", ["market", "bank", "post_office", "study", "clutter"], 0.55, False, True),
            ("mkt_sidewalk_chalkboard", "Wooden A-Frame Shop Signboard", ["market", "bakery", "tavern", "street", "sign"], 0.95, True, False),
            ("mkt_coiled_rope_basket", "Wicker Basket of Coiled Hemp Rope", ["market", "docks", "camp", "rope"], 0.95, True, False),
        ],
    },
    {
        "file": "bedroom_bath_home_living_16_props_ortho_1795346194500.jpg",
        "pack": "bedroom_home",
        "cols": 4,
        "rows": 4,
        "items": [
            ("home_bare_nightstand", "Bare Square Wooden Nightstand", ["bedroom", "home", "bare", "furniture"], 0.95, True, False),
            ("home_washstand_basin", "Wooden Washstand with White Basin", ["bedroom", "bath", "home", "furniture"], 1.2, True, False),
            ("home_copper_bathtub", "Copper Clawfoot Bathtub with Bubbles", ["bedroom", "bath", "home", "mansion", "furniture"], 2.1, True, False),
            ("home_laundry_basket", "Wicker Laundry Basket of Folded Linens", ["bedroom", "bath", "home", "clutter"], 0.95, True, False),
            ("home_oak_wardrobe", "Heavy Carved Oak Wardrobe Cabinet", ["bedroom", "home", "mansion", "furniture"], 1.9, True, False),
            ("home_brass_footlocker", "Brass-Bound Wooden Footlocker Trunk", ["bedroom", "home", "camp", "chest", "storage"], 1.4, True, False),
            ("home_vanity_mirror_brush", "Dressing Table with Hand Mirror & Brush", ["bedroom", "home", "mansion", "furniture"], 1.4, True, False),
            ("home_potted_fern", "Terracotta Potted Indoor Fern", ["home", "mansion", "office", "plant", "nature"], 0.85, True, True),
            ("home_blue_flower_vase", "Blue Ceramic Vase of Yellow Flowers", ["home", "mansion", "flower", "clutter"], 0.6, False, True),
            ("home_patchwork_quilts", "Folded Stack of Patchwork Quilts", ["bedroom", "home", "fabric", "clutter"], 0.85, True, False),
            ("home_chamber_pot", "White Ceramic Bedroom Chamber Pot", ["bedroom", "bath", "home", "clutter"], 0.5, False, False),
            ("home_fireplace_tools", "Wrought-Iron Hearth Fireplace Tool Stand", ["home", "tavern", "mansion", "hearth"], 0.75, True, False),
            ("home_rocking_chair", "Wooden Parlor Rocking Chair", ["home", "bedroom", "chair", "furniture"], 1.1, True, False),
            ("home_woven_doormat", "Rectangular Woven Coir Doormat", ["home", "shop", "rug", "decal"], 1.1, False, False),
            ("home_rush_seat_stool", "Square Woven-Rush Wooden Stool", ["home", "kitchen", "stool", "furniture"], 0.8, True, False),
            ("home_sleeping_tabby_cat", "Curled Orange Tabby Cat on Cushion", ["home", "tavern", "bakery", "pet", "animal"], 0.85, True, False),
        ],
    },
    {
        "file": "library_alchemy_wizard_study_16_props_final_1795346218665.jpg",
        "pack": "library_alchemy",
        "cols": 4,
        "rows": 4,
        "items": [
            ("arc_wooden_lectern", "Carved Oak Reading Book Lectern", ["library", "study", "temple", "arcane", "furniture"], 1.2, True, False),
            ("arc_glowing_grimoire", "Open Runic Wizard Spellbook", ["library", "alchemy", "arcane", "book", "clutter"], 0.6, False, False),
            ("arc_stacked_tomes", "Stack of Leather-Bound Library Tomes", ["library", "study", "book", "clutter"], 0.55, False, False),
            ("arc_ribbon_scrolls", "Ribbon-Tied Bundle of Parchment Scrolls", ["library", "study", "arcane", "scroll", "clutter"], 0.6, False, False),
            ("arc_brass_astrolabe", "Engraved Brass Celestial Astrolabe", ["library", "alchemy", "arcane", "study", "clutter"], 0.6, False, False),
            ("arc_terrestrial_globe", "Wooden-Framed Antique World Globe", ["library", "study", "mansion", "clutter"], 0.8, True, False),
            ("arc_crystal_ball", "Glowing Violet Scrying Crystal Ball", ["library", "alchemy", "arcane", "magic", "clutter"], 0.65, True, False),
            ("arc_alembic_still", "Bubbling Green Alchemical Alembic Still", ["alchemy", "apothecary", "arcane", "clutter"], 0.75, True, True),
            ("arc_potion_trio", "Glowing Red, Blue & Green Potion Flasks", ["alchemy", "apothecary", "arcane", "potion", "clutter"], 0.55, False, True),
            ("arc_candle_skull", "Melted-Candle Human Skull", ["alchemy", "arcane", "funeral", "dungeon", "clutter"], 0.5, False, False),
            ("arc_brass_hourglass", "Ornate Brass Sand Hourglass", ["library", "study", "arcane", "clutter"], 0.5, False, False),
            ("arc_crystal_staff", "Gnarled Crystal-Tipped Wizard Staff", ["arcane", "magic", "weapon", "clutter"], 1.3, False, True),
            ("arc_scroll_cubby", "Wooden Scroll Storage Cubby Box", ["library", "study", "post_office", "furniture"], 1.1, True, False),
            ("arc_runestone_obelisk", "Carved Glowing Cyan Runestone", ["arcane", "dungeon", "temple", "magic", "stone"], 0.9, True, False),
            ("arc_brass_telescope", "Tripod-Mounted Brass Telescope", ["library", "study", "arcane", "astronomy"], 1.2, True, True),
            ("arc_glowing_mortar", "Wooden Mortar of Glowing Purple Powder", ["alchemy", "apothecary", "arcane", "clutter"], 0.55, False, False),
        ],
    },
    {
        "file": "armory_dungeon_clutter_16_props_v2_1795346218653.jpg",
        "pack": "armory_dungeon",
        "cols": 4,
        "rows": 4,
        "items": [
            ("arm_training_dummy", "Straw-Stuffed Combat Training Dummy", ["armory", "castle", "camp", "training"], 1.2, True, False),
            ("arm_iron_shackles", "Chained Rusty Iron Prison Shackles", ["dungeon", "prison", "armory", "clutter"], 0.65, False, True),
            ("arm_wall_torch_sconce", "Lit Iron Wall-Mount Torch Sconce", ["dungeon", "castle", "light", "fire"], 0.7, True, False),
            ("arm_round_shield", "Iron-Rimmed Wooden Round Shield", ["armory", "castle", "weapon", "shield", "clutter"], 0.75, True, False),
            ("arm_crossed_swords", "Crossed Steel Longswords", ["armory", "castle", "weapon", "clutter"], 0.9, False, True),
            ("arm_halberd_spear", "Guard Halberd & Iron-Tipped Spear", ["armory", "castle", "weapon", "clutter"], 1.2, False, True),
            ("arm_longbow_quiver", "Wooden Longbow & Arrow Quiver", ["armory", "camp", "weapon", "clutter"], 1.0, False, True),
            ("arm_knight_helm", "Steel Crusader Great-Helm", ["armory", "castle", "armor", "clutter"], 0.55, True, False),
            ("arm_wooden_stocks", "Prisoner Wooden Pillory Stocks", ["dungeon", "prison", "street", "furniture"], 1.5, True, False),
            ("arm_bear_trap", "Set Toothed Iron Bear Trap", ["dungeon", "camp", "trap", "clutter"], 0.65, False, True),
            ("arm_iron_caltrops", "Scattered Spiked Iron Caltrops", ["dungeon", "armory", "trap", "decal"], 0.6, False, True),
            ("arm_oil_barrel", "Hazard-Marked Wooden Oil Barrel", ["dungeon", "armory", "docks", "barrel"], 1.1, True, False),
            ("arm_gunpowder_keg", "Red-Banded Black Gunpowder Keg", ["armory", "docks", "mining", "barrel"], 1.0, True, False),
            ("arm_prison_cot", "Ragged Wooden Dungeon Prison Cot", ["dungeon", "prison", "bed", "furniture"], 1.9, True, False),
            ("arm_rusty_bucket", "Rusted Iron Dungeon Cell Bucket", ["dungeon", "prison", "bucket", "clutter"], 0.75, True, False),
            ("arm_spiked_barricade", "Timber Cheval-de-Frise Barricade", ["armory", "castle", "camp", "defense"], 1.7, True, True),
        ],
    },
    {
        "file": "docks_ships_city_streets_props_final_1795346221956.jpg",
        "pack": "docks_streets",
        "cols": 4,
        "rows": 4,
        "items": [
            ("doc_mooring_bollard", "Iron Harbor Mooring Bollard & Rope", ["docks", "ship", "street", "iron"], 1.0, True, False),
            ("doc_ship_anchor", "Heavy Iron Ship Anchor", ["docks", "ship", "iron", "nautical"], 1.3, True, True),
            ("doc_coiled_hawser", "Heavy Coiled Ship Hawser Rope", ["docks", "ship", "rope", "nautical"], 1.1, True, True),
            ("doc_stenciled_crate", "Stenciled Cargo Shipping Crate", ["docks", "market", "crate", "storage"], 1.2, True, False),
            ("doc_fishing_net", "Cork-Floated Tangled Fishing Net", ["docks", "ship", "nautical", "decal"], 1.5, False, True),
            ("doc_crossed_oars", "Pair of Crossed Wooden Boat Oars", ["docks", "ship", "nautical", "wood"], 1.3, False, True),
            ("doc_ship_helm_wheel", "Spoked Wooden Ship Helm Wheel", ["docks", "ship", "nautical", "wood"], 1.1, True, True),
            ("doc_naval_cannon", "Mounted Cast-Iron Naval Cannon", ["docks", "ship", "castle", "weapon", "war"], 1.9, True, False),
            ("str_park_bench", "Slatted Wood & Iron Park Bench", ["street", "garden", "park", "bench", "furniture"], 1.8, True, False),
            ("str_streetlamp_cap", "Glowing Victorian Streetlamp Cap", ["street", "city", "lamp", "light"], 0.85, True, False),
            ("str_stone_fountain", "Circular Stone Drinking Fountain", ["street", "garden", "park", "water", "stone"], 1.5, True, False),
            ("str_iron_hatch_ring", "Round Iron Deck Ring Hatch", ["docks", "ship", "street", "sewer", "iron"], 1.1, False, False),
            ("str_stone_planter", "Square Stone Curb Shrub Planter", ["street", "garden", "park", "bush", "stone"], 1.3, True, False),
            ("str_crossroads_post", "Wooden Four-Way Crossroads Signpost", ["street", "camp", "wilderness", "sign"], 1.2, True, True),
            ("str_sewer_manhole", "Round Cast-Iron Sewer Manhole Grate", ["street", "sewer", "city", "decal"], 1.1, False, False),
            ("str_trash_bin_crates", "Alley Metal Trash Can & Milk Crates", ["street", "alley", "sewer", "clutter"], 1.1, True, False),
        ],
    },
    {
        "file": "temple_chapel_ritual_spritesheet_v3_1795346230603.jpg",
        "pack": "temple_ritual",
        "cols": 4,
        "rows": 4,
        "items": [
            ("tmp_bare_stone_altar", "Bare Carved Limestone Temple Altar", ["temple", "chapel", "bare", "altar", "furniture"], 2.1, True, False),
            ("tmp_golden_chalice", "Ornate Golden Ritual Chalice", ["temple", "chapel", "treasure", "clutter"], 0.45, False, False),
            ("tmp_smoking_censer", "Smoking Brass Incense Censer & Chain", ["temple", "chapel", "funeral", "ritual", "clutter"], 0.65, False, True),
            ("tmp_wooden_pew", "Carved Oak Chapel Wooden Pew", ["temple", "chapel", "funeral", "bench", "furniture"], 2.1, True, False),
            ("tmp_wooden_pulpit", "Raised Wooden Preacher Pulpit", ["temple", "chapel", "furniture"], 1.5, True, False),
            ("tmp_baptismal_font", "Circular Stone Holy Water Font", ["temple", "chapel", "water", "stone"], 1.4, True, False),
            ("tmp_votive_candle_tray", "Brass Tray of Lit Votive Candles", ["temple", "chapel", "funeral", "candle", "light"], 0.7, False, False),
            ("tmp_offering_plate", "Stone Alms Plate Filled with Coins", ["temple", "chapel", "treasure", "clutter"], 0.6, False, False),
            ("tmp_ornate_prayer_rug", "Woven Crimson & Indigo Prayer Rug", ["temple", "chapel", "mansion", "rug"], 1.8, False, False),
            ("tmp_stone_gargoyle", "Crouching Carved Stone Gargoyle", ["temple", "castle", "graveyard", "statue"], 1.5, True, False),
            ("tmp_golden_reliquary", "Glass-Topped Golden Reliquary Case", ["temple", "chapel", "treasure", "ritual"], 1.1, True, False),
            ("tmp_fire_brazier", "Ornate Bronze Temple Fire Brazier", ["temple", "dungeon", "fire", "light"], 1.3, True, False),
            ("tmp_bronze_gong", "Framed Bronze Monastery Gong", ["temple", "music", "ritual"], 1.6, True, True),
            ("tmp_marble_plinth", "Bare Square White Marble Pillar Plinth", ["temple", "mansion", "bare", "stone"], 1.4, True, False),
            ("tmp_ritual_bell_hymnal", "Silver Ritual Hand Bell & Clasped Hymnal", ["temple", "chapel", "book", "clutter"], 0.6, False, False),
            ("tmp_lion_statue", "Carved Stone Guardian Lion Statue", ["temple", "castle", "mansion", "statue"], 1.7, True, False),
        ],
    },
    {
        "file": "farm_stable_barn_props_4x4_v3_1795346313259.jpg",
        "pack": "farm_stable",
        "cols": 4,
        "rows": 4,
        "inset": 10,
        "items": [
            ("frm_rect_hay_bale", "Bound Rectangular Golden Hay Bale", ["farm", "stable", "barn", "hay"], 1.4, True, False),
            ("frm_round_straw_bale", "Coiled Round Golden Straw Bale", ["farm", "stable", "barn", "hay"], 1.5, True, False),
            ("frm_water_trough", "Wooden Horse Water Trough", ["farm", "stable", "camp", "water"], 1.7, True, False),
            ("frm_wheelbarrow", "Loaded Wooden Farm Wheelbarrow", ["farm", "stable", "garden", "cart"], 1.5, True, False),
            ("frm_pitchfork", "Long Wooden Farm Pitchfork", ["farm", "stable", "barn", "tool"], 1.2, False, True),
            ("frm_iron_scythe", "Curved Steel Harvest Scythe", ["farm", "barn", "tool", "weapon"], 1.2, False, True),
            ("frm_horse_saddle", "Tooled Leather Horse Saddle", ["farm", "stable", "camp", "gear"], 0.95, True, False),
            ("frm_horseshoe_bridle", "Steel Horseshoe & Leather Bridle", ["farm", "stable", "gear", "clutter"], 0.75, False, True),
            ("frm_chicken_nest_box", "Wooden Hen Nesting Box with Straw", ["farm", "barn", "animal"], 1.0, True, False),
            ("frm_egg_wicker_basket", "Basket of Fresh White & Brown Eggs", ["farm", "kitchen", "food", "clutter"], 0.65, True, False),
            ("frm_milk_churn", "Galvanized Metal Dairy Milk Churn", ["farm", "barn", "kitchen", "barrel"], 0.85, True, False),
            ("frm_milking_stool", "Three-Legged Wooden Milking Stool", ["farm", "barn", "stool", "furniture"], 0.75, True, False),
            ("frm_orange_pumpkin", "Ripe Orange Harvest Pumpkin", ["farm", "garden", "food", "autumn"], 0.7, True, False),
            ("frm_cabbage_carrot_crate", "Harvest Crate of Cabbages & Carrots", ["farm", "market", "kitchen", "crate"], 1.05, True, False),
            ("frm_watering_can", "Tin Garden Watering Can", ["farm", "garden", "tool", "clutter"], 0.65, True, False),
            ("frm_fence_post_bundle", "Tied Bundle of Wooden Fence Posts", ["farm", "camp", "wood"], 1.3, True, False),
        ],
    },
    {
        "file": "bare_modular_furniture_4x4_v2_1795346305515.jpg",
        "pack": "bare_furniture",
        "cols": 4,
        "rows": 4,
        "items": [
            ("bare_square_oak_table", "Bare Square Oak Table (Empty)", ["bare", "furniture", "table", "tavern", "home"], 1.5, True, False),
            ("bare_round_cafe_table", "Bare Round Bistro Café Table (Empty)", ["bare", "furniture", "table", "tavern", "bakery"], 1.4, True, False),
            ("bare_walnut_dining_table", "Bare Long Walnut Dining Table (Empty)", ["bare", "furniture", "table", "mansion", "home"], 2.3, True, False),
            ("bare_l_shop_counter", "Bare L-Shaped Wooden Shop Counter (Empty)", ["bare", "furniture", "counter", "market", "tavern"], 2.3, True, False),
            ("bare_pine_counter", "Bare Straight Pine Shop Counter (Empty)", ["bare", "furniture", "counter", "bakery", "market"], 2.0, True, False),
            ("bare_blotter_desk", "Bare Mahogany Blotter Study Desk (Empty)", ["bare", "furniture", "desk", "study", "post_office"], 2.0, True, False),
            ("bare_stone_altar_slab", "Bare Carved Stone Counter Slab (Empty)", ["bare", "furniture", "counter", "temple", "dungeon"], 2.0, True, False),
            ("bare_rustic_bench", "Bare Rustic Wooden Bench (Empty)", ["bare", "furniture", "bench", "tavern", "farm"], 1.8, True, False),
            ("bare_oak_sideboard", "Bare Dark Oak Sideboard Shelf (Empty)", ["bare", "furniture", "shelf", "home", "study"], 1.8, True, False),
            ("bare_marble_pedestal", "Bare Round White Marble Pedestal (Empty)", ["bare", "furniture", "pedestal", "temple", "mansion"], 1.1, True, False),
            ("bare_display_plinth", "Bare Wooden Display Riser Plinth (Empty)", ["bare", "furniture", "pedestal", "market", "museum"], 1.2, True, False),
            ("bare_octagonal_table", "Bare Octagonal Walnut Parlor Table (Empty)", ["bare", "furniture", "table", "mansion", "study"], 1.7, True, False),
            ("bare_pine_worktable", "Bare Pine Vise Worktable (Empty)", ["bare", "furniture", "table", "workshop", "blacksmith"], 1.9, True, False),
            ("bare_glass_patio_table", "Bare Wrought-Iron Glass Patio Table (Empty)", ["bare", "furniture", "table", "garden", "tea"], 1.4, True, False),
            ("bare_white_kitchen_table", "Bare Whitewashed Kitchen Prep Table (Empty)", ["bare", "furniture", "table", "kitchen", "bakery"], 1.8, True, False),
            ("bare_corner_table", "Bare Triangular Wooden Corner Table (Empty)", ["bare", "furniture", "table", "home", "study"], 1.2, True, False),
        ],
    },
    {
        "file": "camp_travel_expedition_spritesheet_final_1795346326928.jpg",
        "pack": "camp_travel",
        "cols": 4,
        "rows": 4,
        "items": [
            ("cmp_unlit_fire_ring", "Unlit Stone Campfire Ring & Ash", ["camp", "wilderness", "campfire", "stone"], 1.5, False, False),
            ("cmp_canvas_stool", "Folding Wooden Canvas Camp Stool", ["camp", "wilderness", "stool", "furniture"], 0.85, True, False),
            ("cmp_leather_backpack", "Adventurer Leather Expedition Backpack", ["camp", "wilderness", "gear", "bag", "clutter"], 0.85, True, False),
            ("cmp_rope_grappling_hook", "Coiled Climbing Rope & Grappling Hook", ["camp", "dungeon", "gear", "rope", "clutter"], 0.8, False, True),
            ("cmp_brass_oil_lantern", "Brass Travel Oil Lantern", ["camp", "dungeon", "light", "clutter"], 0.5, False, True),
            ("cmp_camp_frying_pan", "Blackened Cast-Iron Camp Skillet", ["camp", "kitchen", "cookware", "clutter"], 0.55, False, False),
            ("cmp_water_canteen", "Leather-Wrapped Travel Water Canteen", ["camp", "wilderness", "gear", "clutter"], 0.45, False, False),
            ("cmp_folded_canvas_tarp", "Tied Olive Canvas Waterproof Tarp", ["camp", "wilderness", "gear", "clutter"], 0.9, True, False),
            ("cmp_iron_camp_pot", "Lidded Cast-Iron Camp Stew Pot", ["camp", "kitchen", "cookware", "clutter"], 0.7, True, False),
            ("cmp_ration_crate", "Small Wooden Travel Ration Crate", ["camp", "market", "crate", "storage"], 0.9, True, False),
            ("cmp_compass_trail_map", "Brass Pocket Compass & Trail Map", ["camp", "study", "docks", "clutter"], 0.55, False, False),
            ("cmp_brass_spyglass", "Collapsible Brass Spyglass", ["camp", "docks", "study", "clutter"], 0.55, False, False),
            ("cmp_firewood_log_stack", "Stacked Camp Firewood Logs", ["camp", "wilderness", "hearth", "wood"], 1.3, True, False),
            ("cmp_chopping_stump_axe", "Chopping Stump with Embedded Hatchet", ["camp", "wilderness", "farm", "wood"], 1.2, True, False),
            ("cmp_tied_bedroll", "Rolled Plaid Wool Adventurer Bedroll", ["camp", "wilderness", "bed", "gear"], 1.1, True, False),
            ("cmp_mallet_tent_pegs", "Wooden Mallet & Iron Tent Peg Bundle", ["camp", "wilderness", "tool", "clutter"], 0.75, False, True),
        ],
    },
    {
        "file": "mining_cavern_underdark_props_4x4_v3_1795346321047.jpg",
        "pack": "mining_cavern",
        "cols": 4,
        "rows": 4,
        "items": [
            ("min_mine_cart_empty", "Empty Wooden & Iron Mine Cart", ["mining", "cavern", "dungeon", "cart"], 1.7, True, False),
            ("min_mine_cart_ore", "Mine Cart Overflowing with Gold Ore", ["mining", "cavern", "dungeon", "treasure", "cart"], 1.7, True, False),
            ("min_iron_pickaxe", "Steel Miner Pickaxe", ["mining", "cavern", "tool", "weapon"], 0.9, False, False),
            ("min_miner_helmet", "Brass Miner Headlamp Helmet", ["mining", "cavern", "gear", "clutter"], 0.55, True, False),
            ("min_cyan_crystals", "Glowing Cyan Cavern Crystal Cluster", ["mining", "cavern", "underdark", "crystal", "magic"], 1.3, True, False),
            ("min_amethyst_crystals", "Glowing Amethyst Crystal Cluster", ["mining", "cavern", "underdark", "crystal", "magic"], 1.3, True, False),
            ("min_cave_stalagmite", "Jagged Grey Cave Stalagmite", ["mining", "cavern", "underdark", "rock", "stone"], 1.6, True, False),
            ("min_giant_glow_shroom", "Giant Bioluminescent Underdark Mushroom", ["cavern", "underdark", "mushroom", "nature"], 1.8, True, False),
            ("min_timber_support_beam", "Iron-Bracketed Mine Support Timber", ["mining", "cavern", "wood"], 1.6, True, False),
            ("min_dynamite_bundle", "Tied Bundle of Red Dynamite Sticks", ["mining", "cavern", "tech", "clutter"], 0.65, False, False),
            ("min_ore_coal_mound", "Mound of Raw Iron Ore & Coal", ["mining", "cavern", "blacksmith", "rock"], 1.3, True, False),
            ("min_glowing_pool", "Bioluminescent Cavern Mineral Puddle", ["cavern", "underdark", "water", "decal"], 1.2, False, False),
            ("min_spider_egg_sac", "Silken Giant Spider Egg Sac Cluster", ["cavern", "underdark", "dungeon", "monster"], 1.3, True, True),
            ("min_corner_cobweb", "Delicate Dungeon Corner Cobweb", ["cavern", "dungeon", "funeral", "decal"], 1.3, False, True),
            ("min_rail_bumper_stop", "Timber & Iron Mine Track End Bumper", ["mining", "cavern", "rail", "wood"], 1.3, True, True),
            ("min_cavern_rubble", "Collapsed Jagged Stone Rubble Pile", ["mining", "cavern", "dungeon", "rock", "decal"], 1.5, True, True),
        ],
    },
    {
        "file": "school_courtroom_guildhall_props_4x4_v2_1795346350928.jpg",
        "pack": "school_courtroom",
        "cols": 4,
        "rows": 4,
        "items": [
            ("sch_judge_gavel", "Wooden Judge Gavel & Sound Block", ["courtroom", "school", "study", "clutter"], 0.55, False, False),
            ("sch_bare_student_desk", "Bare Wooden School Student Desk", ["school", "study", "bare", "desk", "furniture"], 1.3, True, False),
            ("sch_slate_chalkboard", "Framed Dark Slate Chalkboard & Chalk", ["school", "study", "office"], 1.5, True, False),
            ("sch_brass_inkstand", "Brass Twin Inkstand & Parchment Tray", ["courtroom", "post_office", "study", "clutter"], 0.6, False, False),
            ("sch_carved_podium", "Carved Oak Speaker Podium Lectern", ["courtroom", "school", "temple", "furniture"], 1.3, True, False),
            ("sch_blueprints_compass", "Architectural Blueprints & Brass Compass", ["school", "study", "workshop", "clutter"], 0.8, False, False),
            ("sch_guild_trophy_cup", "Polished Golden Two-Handled Trophy Cup", ["courtroom", "mansion", "school", "treasure", "clutter"], 0.55, True, False),
            ("sch_card_catalog", "Wooden Office Filing Cabinet", ["school", "post_office", "library", "furniture"], 1.4, True, False),
            ("sch_leather_armchair", "Tufted Burgundy Leather Club Armchair", ["courtroom", "study", "mansion", "chair", "furniture"], 1.3, True, False),
            ("sch_coat_rack_stand", "Circular Wooden Coat-Rack Stand", ["courtroom", "home", "office", "furniture"], 0.9, True, True),
            ("sch_brass_wall_clock", "Ornate Brass-Rimmed Wall Clock", ["school", "post_office", "home", "clutter"], 0.7, False, False),
            ("sch_framed_world_map", "Gold-Framed Vintage World Map", ["school", "study", "library", "mansion"], 1.2, False, False),
            ("sch_brass_hand_bell", "Brass School Bell & Sealed Decree Scroll", ["school", "courtroom", "post_office", "clutter"], 0.6, False, False),
            ("sch_legal_ledger_stack", "Stack of Three Bound Legal Volumes", ["courtroom", "library", "study", "book", "clutter"], 0.65, True, False),
            ("sch_witness_barrier", "Carved Wooden Courtroom Railing Segment", ["courtroom", "temple", "furniture"], 1.8, True, True),
            ("sch_guildhall_rug", "Octagonal Navy & Gold Guildhall Rug", ["courtroom", "mansion", "study", "rug"], 2.3, False, False),
        ],
    },
    {
        "file": "sewers_alleys_industrial_props_sheet_v2_1795346346790.jpg",
        "pack": "sewers_alleys",
        "cols": 4,
        "rows": 4,
        "items": [
            ("sew_pipe_wheel_valve", "Rusty Iron Pipe Wheel Valve", ["sewer", "alley", "tech", "iron"], 0.85, True, True),
            ("sew_brick_chimney", "Soot-Stained Red Brick Chimney Stack", ["alley", "roof", "street", "brick"], 1.4, True, False),
            ("sew_alley_trash_barrel", "Weathered Wooden Alley Trash Barrel", ["alley", "street", "sewer", "barrel"], 1.0, True, False),
            ("sew_broken_crate_debris", "Shattered Wooden Crate Splinter Debris", ["alley", "sewer", "dungeon", "decal"], 1.3, False, True),
            ("sew_brick_pallet", "Wooden Pallet Stack of Red Clay Bricks", ["alley", "street", "workshop", "brick"], 1.3, True, False),
            ("sew_builder_ladder", "Weathered Wooden Ladder (Flat)", ["alley", "workshop", "stairs", "wood"], 1.8, False, True),
            ("sew_storm_drain_grate", "Rectangular Rusty Iron Storm Drain", ["sewer", "street", "alley", "decal"], 1.1, False, False),
            ("sew_mossy_puddle", "Murky Moss-Rimmed Alley Puddle", ["sewer", "alley", "swamp", "water", "decal"], 1.3, False, False),
            ("sew_wooden_handbarrow", "Two-Handled Wooden Cargo Handbarrow", ["alley", "docks", "market", "cart"], 1.5, True, False),
            ("sew_oil_slick_puddle", "Iridescent Dark Oil Spill Puddle", ["sewer", "alley", "tech", "decal"], 1.3, False, False),
            ("sew_coal_chute_hatch", "Hinged Cast-Iron Sidewalk Coal Hatch", ["alley", "street", "sewer", "iron", "decal"], 1.1, False, False),
            ("sew_scaffold_planks", "Paint-Splattered Scaffolding Planks", ["alley", "workshop", "wood", "bridge"], 1.5, False, True),
            ("sew_scattered_bottles", "Scatter of Empty Alley Glass Bottles", ["alley", "tavern", "sewer", "decal", "clutter"], 0.75, False, True),
            ("sew_straw_rags_nest", "Mound of Damp Alley Straw & Rags", ["alley", "sewer", "dungeon", "clutter"], 1.0, False, False),
            ("sew_iron_bollard", "Black Cast-Iron Street Bollard Post", ["street", "alley", "docks", "iron"], 0.75, True, False),
            ("sew_burlap_trash_sack", "Bulging Knotted Alley Trash Sack", ["alley", "sewer", "sack", "clutter"], 0.95, True, False),
        ],
    },
    {
        "file": "music_theater_festival_noble_tea_props_v3_1795346363159.jpg",
        "pack": "music_theater_tea",
        "cols": 4,
        "rows": 4,
        "items": [
            ("mus_mahogany_harp", "Carved Mahogany Acoustic Harp", ["music", "theater", "mansion", "bard"], 1.3, True, True),
            ("mus_snare_drum", "Brass-Rimmed Snare Drum & Drumsticks", ["music", "theater", "festival", "bard"], 0.85, True, False),
            ("mus_violin_bow", "Polished Wooden Violin & Bow", ["music", "theater", "mansion", "bard", "clutter"], 0.85, False, True),
            ("mus_feathered_mask", "Gilded Feathered Masquerade Mask", ["theater", "festival", "mansion", "clutter"], 0.5, False, False),
            ("tea_porcelain_set", "Blue-and-White Porcelain Teapot & Cups", ["tea", "mansion", "bakery", "home", "clutter"], 0.65, False, False),
            ("tea_pastry_stand", "Tiered Silver Macaron & Petit Four Stand", ["tea", "bakery", "mansion", "food", "clutter"], 0.7, True, False),
            ("mus_brass_gramophone", "Vintage Brass Horn Gramophone", ["music", "mansion", "study", "tech"], 0.95, True, False),
            ("mus_velvet_curtain", "Folded Crimson Velvet Stage Curtain", ["theater", "mansion", "fabric", "clutter"], 1.1, True, False),
            ("mus_festival_bunting", "Colorful Triangular Festival Bunting", ["festival", "market", "street", "decor"], 1.5, False, True),
            ("mus_carnival_target", "Painted Red-and-White Carnival Target", ["festival", "camp", "armory", "game"], 1.2, False, False),
            ("tea_crystal_decanter", "Faceted Crystal Wine Decanter & Goblets", ["tea", "mansion", "tavern", "drink", "clutter"], 0.6, False, True),
            ("tea_silver_candelabra", "Three-Branched Silver Tabletop Candelabra", ["tea", "mansion", "temple", "candle", "light"], 0.7, True, True),
            ("tea_chess_board", "Checkered Wooden Chessboard & Pieces", ["tea", "mansion", "study", "tavern", "game", "clutter"], 0.7, False, False),
            ("mus_artist_palette", "Wooden Artist Paint Palette & Brushes", ["theater", "study", "home", "clutter"], 0.65, False, False),
            ("tea_rose_basket", "Wicker Basket of Pink & Yellow Roses", ["tea", "garden", "festival", "flower", "clutter"], 0.85, True, False),
            ("tea_lace_fan_gloves", "Lace Hand Fan & White Opera Gloves", ["theater", "tea", "mansion", "clutter"], 0.55, False, False),
        ],
    },
]


def find_grid_cuts_n(sheet: Image.Image, cols: int, rows: int) -> tuple[list[int], list[int]]:
    rgb = sheet.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    def best_cut(axis_len: int, frac: float, is_row: bool) -> int:
        center = int(axis_len * frac)
        span = 0.095 if max(cols, rows) >= 4 else 0.085
        lo = max(8, int(axis_len * (frac - span)))
        hi = min(axis_len - 8, int(axis_len * (frac + span)))
        best_pos = center
        best_score = 10**9
        for pos in range(lo, hi + 1):
            ink = 0
            if is_row:
                for x in range(0, w, 2):
                    r, g, b = px[x, pos]
                    if min(r, g, b) < 232:
                        ink += 1
            else:
                for y in range(0, h, 2):
                    r, g, b = px[pos, y]
                    if min(r, g, b) < 232:
                        ink += 1
            score = ink * 1000 + abs(pos - center)
            if score < best_score:
                best_score = score
                best_pos = pos
        return best_pos

    xs = [0] + [best_cut(w, i / cols, False) for i in range(1, cols)] + [w]
    ys = [0] + [best_cut(h, j / rows, True) for j in range(1, rows)] + [h]
    return xs, ys


def remove_white_bg_clean(cell: Image.Image, clear_interior_white: bool = False) -> Image.Image:
    raw = cell.convert("RGBA")
    # Pad 4px pure white so border flood-fill flows cleanly around props touching the cell cut edge
    rgba = Image.new("RGBA", (raw.width + 8, raw.height + 8), (255, 255, 255, 255))
    rgba.paste(raw, (4, 4))
    w, h = rgba.size
    px = rgba.load()

    visited = bytearray(w * h)
    bg_mask = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def is_bg(r: int, g: int, b: int) -> bool:
        mx = max(r, g, b)
        mn = min(r, g, b)
        return mn >= 234 and (mx - mn) <= 18

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
                nidx = ny * w + nx
                if not visited[nidx]:
                    r, g, b, _ = px[nx, ny]
                    if is_bg(r, g, b):
                        visited[nidx] = 1
                        q.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if bg_mask[y * w + x]:
                px[x, y] = (0, 0, 0, 0)
            elif clear_interior_white:
                r, g, b, _ = px[x, y]
                if min(r, g, b) >= 240 and (max(r, g, b) - min(r, g, b)) <= 14:
                    px[x, y] = (0, 0, 0, 0)

    # Soft fringe decontamination against white background halo
    for _ in range(2):
        to_fade: list[tuple[int, int, tuple[int, int, int, int]]] = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if (
                    px[x - 1, y][3] == 0
                    or px[x + 1, y][3] == 0
                    or px[x, y - 1][3] == 0
                    or px[x, y + 1][3] == 0
                ):
                    lum = (r + g + b) / 3.0
                    sat = max(r, g, b) - min(r, g, b)
                    if lum > 194 and sat < 36:
                        new_a = clamp((246 - lum) / 52.0 * a)
                        if new_a < 18:
                            to_fade.append((x, y, (0, 0, 0, 0)))
                        else:
                            to_fade.append((x, y, (clamp(r * 0.52), clamp(g * 0.49), clamp(b * 0.47), new_a)))
        for x, y, val in to_fade:
            px[x, y] = val

    bbox = rgba.getbbox()
    if not bbox:
        return rgba
    x0, y0, x1, y1 = bbox
    pad = 5
    return rgba.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))


def slice_ai_sheets() -> int:
    sliced = 0
    for spec in AI_SHEETS:
        sheet_path = SHEET_DIR / spec["file"]
        if not sheet_path.exists():
            print(f"  [WARN] Missing AI sheet: {sheet_path.name}")
            continue
        sheet = Image.open(sheet_path).convert("RGBA")
        cols, rows = spec["cols"], spec["rows"]
        inset = spec.get("inset", 0)
        xs, ys = find_grid_cuts_n(sheet, cols, rows)
        overrides = spec.get("cell_overrides", {})
        for idx, (slug, name, tags, target_cells, casts_shadow, clear_int) in enumerate(spec["items"]):
            row, col = divmod(idx, cols)
            if idx in overrides:
                fx0, fy0, fx1, fy1 = overrides[idx]
                x0, y0 = int(sheet.width * fx0), int(sheet.height * fy0)
                x1, y1 = int(sheet.width * fx1), int(sheet.height * fy1)
            else:
                x0, y0, x1, y1 = xs[col] + inset, ys[row] + inset, xs[col + 1] - inset, ys[row + 1] - inset
            cell = sheet.crop((x0, y0, x1, y1))
            clean = remove_white_bg_clean(cell, clear_interior_white=clear_int)
            max_side = max(clean.width, clean.height)
            # Keep generous crisp pixel density while scaling tabletop footprint naturally
            desired_px = max(140, min(420, int(round(target_cells * 175))))
            scale = min(1.0, desired_px / max(1, max_side))
            nw = max(48, int(round(clean.width * scale)))
            nh = max(48, int(round(clean.height * scale)))
            final = clean.resize((nw, nh), Image.Resampling.LANCZOS) if scale < 0.99 else clean
            ppi = max(96, min(420, int(round(max(final.width, final.height) / target_cells))))
            save_asset(
                f"props/{spec['pack']}/{slug}.png",
                final,
                name,
                "object",
                tags + [spec["pack"], "modular"],
                draw_mode="normal",
                default_ppi=ppi,
                casts_shadow=casts_shadow,
            )
            sliced += 1
    return sliced


# ============================================================================
# 2. SEAMLESS TERRAINS (24 x 512x512)
# ============================================================================

def draw_wrapped_ellipse(d: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, size: int, **kw: Any) -> None:
    for ox in (-size, 0, size):
        for oy in (-size, 0, size):
            x0, y0, x1, y1 = cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry
            if x1 >= -4 and x0 <= size + 4 and y1 >= -4 and y0 <= size + 4:
                d.ellipse([x0, y0, x1, y1], **kw)


def gen_organic_terrain(
    seed: int,
    base: tuple[int, int, int],
    spots: list[tuple[tuple[int, int, int], int, int, int]],
    speckles: list[tuple[tuple[int, int, int], int, int]] | None = None,
    strokes: list[tuple[tuple[int, int, int], int, int]] | None = None,
) -> Image.Image:
    rng = random.Random(seed)
    S = 512
    im = Image.new("RGBA", (S, S), (*base, 255))
    d = ImageDraw.Draw(im)
    for col, count, rmin, rmax in spots:
        for _ in range(count):
            cx, cy = rng.uniform(0, S), rng.uniform(0, S)
            rx, ry = rng.uniform(rmin * 1.4, rmax * 1.7), rng.uniform(rmin * 1.4, rmax * 1.7)
            c = jitter_rgb(rng, col, 8)
            draw_wrapped_ellipse(d, cx, cy, rx, ry, S, fill=(c[0], c[1], c[2], 46))
    im = im.filter(ImageFilter.GaussianBlur(radius=15.0))
    d = ImageDraw.Draw(im)
    if strokes:
        for col, count, length in strokes:
            for _ in range(count):
                x, y = rng.uniform(0, S), rng.uniform(0, S)
                ang = rng.uniform(-0.7, 0.7) - math.pi / 2
                dx, dy = math.cos(ang) * length, math.sin(ang) * length
                c = jitter_rgb(rng, col, 12)
                for ox in (-S, 0, S):
                    for oy in (-S, 0, S):
                        if -20 <= x + ox <= S + 20 and -20 <= y + oy <= S + 20:
                            d.line([x + ox, y + oy, x + ox + dx, y + oy + dy], fill=(c[0], c[1], c[2], 145), width=2)
    if speckles:
        for col, count, rmax in speckles:
            for _ in range(count):
                cx, cy = rng.uniform(0, S), rng.uniform(0, S)
                r = rng.uniform(1.5, rmax)
                c = jitter_rgb(rng, col, 14)
                draw_wrapped_ellipse(d, cx, cy, r, r, S, fill=c, outline=(30, 24, 21, 70))
    return add_grain(im, seed + 77, 7, seamless=True)


def gen_tile_terrain(
    seed: int,
    mortar: tuple[int, int, int],
    stone: tuple[int, int, int],
    cols: int,
    rows: int,
    stagger: bool = True,
    checker: tuple[int, int, int] | None = None,
    moss: tuple[int, int, int] | None = None,
    radius: int = 4,
) -> Image.Image:
    rng = random.Random(seed)
    S = 512
    im = Image.new("RGBA", (S, S), (*mortar, 255))
    d = ImageDraw.Draw(im)
    cw, rh = S / cols, S / rows
    gap = 3
    for r in range(rows):
        off = (cw * 0.5) if (stagger and r % 2 == 1 and checker is None) else 0.0
        for c in range(cols):
            x0, y0 = c * cw + off, r * rh
            base_c = checker if (checker is not None and (r + c) % 2 == 1) else stone
            fill = jitter_rgb(rng, base_c, 9)
            hi, lo = shade(fill[:3], 1.12), shade(fill[:3], 0.86)
            for ox in (-S, 0, S):
                bx0, by0, bx1, by1 = x0 + ox + gap, y0 + gap, x0 + ox + cw - gap, y0 + rh - gap
                if bx1 < -4 or bx0 > S + 4:
                    continue
                d.rounded_rectangle([bx0, by0, bx1, by1], radius=radius, fill=fill, outline=INK, width=2)
                d.line([bx0 + 3, by0 + 2, bx1 - 3, by0 + 2], fill=hi, width=2)
                d.line([bx0 + 3, by1 - 2, bx1 - 3, by1 - 2], fill=lo, width=2)
    if moss:
        for _ in range(36):
            cx, cy = rng.uniform(0, S), rng.uniform(0, S)
            mc = jitter_rgb(rng, moss, 12)
            draw_wrapped_ellipse(d, cx, cy, rng.uniform(4, 14), rng.uniform(4, 12), S, fill=(mc[0], mc[1], mc[2], 145))
    return add_grain(im, seed + 19, 8, seamless=True)


def gen_plank_terrain(seed: int, wood: tuple[int, int, int], planks: int = 8, herringbone: bool = False) -> Image.Image:
    rng = random.Random(seed)
    S = 512
    im = Image.new("RGBA", (S, S), (*shade(wood, 0.55)[:3], 255))
    d = ImageDraw.Draw(im)
    if herringbone:
        step = 64
        for r in range(-2, S // step + 3):
            for c in range(-2, S // step + 3):
                x0, y0 = c * step, r * step
                col = jitter_rgb(rng, wood, 10)
                if (r + c) % 2 == 0:
                    d.rectangle([x0 + 2, y0 + 2, x0 + step * 2 - 2, y0 + step - 2], fill=col, outline=INK, width=2)
                else:
                    d.rectangle([x0 + 2, y0 + 2, x0 + step - 2, y0 + step * 2 - 2], fill=col, outline=INK, width=2)
        return add_grain(im, seed + 31, 7, seamless=True)
    ph = S / planks
    for i in range(planks):
        y0, y1 = int(i * ph), int((i + 1) * ph)
        col = jitter_rgb(rng, wood, 11)
        d.rectangle([0, y0 + 1, S, y1 - 1], fill=col)
        for _ in range(7):
            gy = rng.uniform(y0 + 5, y1 - 5)
            d.line([0, gy, S, gy], fill=shade(col[:3], rng.uniform(0.84, 1.09), 110), width=1)
        d.line([0, y0, S, y0], fill=INK, width=2)
        for jx in (rng.randint(70, 220), rng.randint(300, 460)):
            d.line([jx, y0 + 1, jx, y1 - 1], fill=INK, width=2)
            d.ellipse([jx - 5, y0 + 6, jx - 2, y0 + 9], fill=(42, 36, 32, 220))
            d.ellipse([jx + 3, y1 - 9, jx + 6, y1 - 6], fill=(42, 36, 32, 220))
    return add_grain(im, seed + 23, 7, seamless=True)


def generate_terrains() -> None:
    specs: list[tuple[str, str, list[str], Image.Image]] = [
        ("clinic_white_tile", "Clinic White Ceramic Tile", ["doctor", "clinic", "bath", "tile"], gen_tile_terrain(201, (164, 168, 170), (228, 232, 230), 8, 8, False, (214, 224, 222), radius=2)),
        ("bakery_terracotta_tile", "Bakery Warm Terracotta Tile", ["bakery", "kitchen", "tile"], gen_tile_terrain(202, (98, 72, 58), (178, 108, 74), 6, 6, False, (162, 94, 62), radius=4)),
        ("funeral_dark_parquet", "Funeral Dark Walnut Parquet", ["funeral", "mansion", "study", "wood"], gen_plank_terrain(203, (78, 54, 42), herringbone=True)),
        ("graveyard_moss_grass", "Graveyard Mossy Turf", ["funeral", "graveyard", "nature", "grass"], gen_organic_terrain(204, (66, 84, 58), [((52, 68, 46), 36, 18, 42), ((84, 98, 66), 24, 14, 34)], strokes=[((86, 108, 68), 220, 9)])),
        ("garden_gravel_walk", "Garden Crushed Gravel", ["garden", "street", "park", "graveyard"], gen_organic_terrain(205, (166, 160, 148), [((148, 142, 132), 28, 16, 36)], speckles=[((192, 188, 178), 260, 4), ((126, 122, 114), 220, 4)])),
        ("forge_soot_flagstone", "Blacksmith Soot Flagstone", ["blacksmith", "forge", "dungeon", "stone"], gen_tile_terrain(206, (38, 36, 36), (88, 84, 82), 5, 5, True, radius=5)),
        ("garden_brick_patio", "Garden Red Brick Patio", ["garden", "street", "bakery", "brick"], gen_tile_terrain(207, (112, 102, 92), (164, 88, 68), 8, 12, True, moss=(82, 112, 62), radius=2)),
        ("pier_weathered_planks", "Weathered Harbor Pier Planks", ["docks", "ship", "wood"], gen_plank_terrain(208, (124, 112, 98), 8)),
        ("snow_dusted_grass", "Winter Snow-Dusted Meadow", ["winter", "snow", "nature", "grass"], gen_organic_terrain(209, (216, 224, 232), [((96, 116, 84), 22, 18, 44), ((238, 242, 248), 32, 18, 44)], strokes=[((112, 128, 92), 140, 8)])),
        ("frozen_lake_ice", "Cracked Frozen Lake Ice", ["winter", "snow", "water", "ice"], gen_organic_terrain(210, (164, 206, 224), [((198, 230, 242), 30, 20, 48), ((124, 174, 202), 26, 18, 42)], strokes=[((232, 246, 255), 110, 26)])),
        ("desert_sandstone", "Warm Desert Sandstone Floor", ["desert", "temple", "stone"], gen_tile_terrain(211, (148, 118, 82), (206, 174, 124), 5, 5, True, radius=5)),
        ("cracked_mud_flat", "Dry Cracked Mud & Clay", ["desert", "swamp", "camp", "dirt"], gen_organic_terrain(212, (132, 104, 78), [((110, 84, 62), 34, 18, 40)], strokes=[((66, 48, 36), 190, 22)])),
        ("tavern_checker_tile", "Tavern Cream & Slate Checker Tile", ["tavern", "kitchen", "post_office", "tile"], gen_tile_terrain(213, (68, 64, 60), (214, 204, 184), 8, 8, False, (86, 92, 98), radius=2)),
        ("temple_mosaic_atrium", "Temple Gold & Marble Mosaic", ["temple", "mansion", "courtroom", "tile"], gen_tile_terrain(214, (138, 120, 86), (224, 218, 204), 6, 6, False, (194, 168, 114), radius=3)),
        ("barn_straw_earth", "Barn Packed Earth & Straw", ["farm", "stable", "barn", "dirt"], gen_organic_terrain(215, (124, 96, 68), [((104, 78, 54), 30, 18, 42)], strokes=[((214, 182, 102), 320, 16)])),
        ("underdark_shale", "Underdark Cavern Dark Shale", ["mining", "cavern", "underdark", "stone"], gen_organic_terrain(216, (58, 60, 72), [((44, 46, 58), 34, 18, 44), ((76, 80, 96), 28, 14, 34)], speckles=[((92, 134, 148), 55, 3)])),
        ("river_cobble_bed", "Wet Riverbed Cobble Stones", ["water", "nature", "street", "stone"], gen_organic_terrain(217, (84, 96, 98), [((68, 82, 86), 28, 16, 40)], speckles=[((134, 138, 132), 210, 8), ((104, 108, 104), 190, 7)])),
        ("slate_shingle_roof", "Slate Shingle Rooftop Fill", ["roof", "street", "mansion", "stone"], gen_tile_terrain(218, (46, 50, 58), (94, 102, 114), 8, 12, True, radius=3)),
        ("red_clay_roof_tile", "Terracotta Clay Roof Tile Fill", ["roof", "bakery", "street", "tile"], gen_tile_terrain(219, (92, 48, 36), (182, 94, 62), 10, 8, True, radius=4)),
        ("wildflower_meadow", "Spring Wildflower Meadow Grass", ["nature", "meadow", "garden", "grass"], gen_organic_terrain(220, (98, 138, 72), [((82, 122, 60), 32, 18, 44)], speckles=[((242, 212, 76), 55, 4), ((242, 240, 234), 48, 3.5), ((176, 128, 216), 34, 3.5)], strokes=[((118, 158, 84), 240, 9)])),
        ("swamp_bog_mire", "Murky Swamp Bog & Peat", ["swamp", "nature", "water"], gen_organic_terrain(221, (64, 78, 56), [((46, 62, 46), 34, 20, 48), ((86, 98, 62), 26, 14, 36)], speckles=[((116, 142, 76), 95, 4)])),
        ("mausoleum_marble", "Veined Grey Mausoleum Marble", ["funeral", "temple", "courtroom", "stone"], gen_tile_terrain(222, (88, 90, 94), (186, 188, 192), 4, 4, False, radius=2)),
        ("alley_wet_cobble", "Rain-Slicked Alley Cobblestone", ["alley", "sewer", "street", "stone"], gen_tile_terrain(223, (36, 40, 48), (82, 88, 98), 8, 10, True, radius=6)),
        ("school_light_pine", "Schoolhouse Honey Pine Planks", ["school", "post_office", "home", "wood"], gen_plank_terrain(224, (194, 156, 102), 9)),
    ]
    for slug, name, tags, img in specs:
        save_asset(f"terrain/{slug}.png", img, name, "terrain", tags + ["terrain"], "normal", 256, False)


# ============================================================================
# 3. SEAMLESS SMART WALLS (16 x 512x128)
# ============================================================================

def gen_wall_strip(
    seed: int,
    base: tuple[int, int, int],
    trim: tuple[int, int, int],
    style: str = "brick",
    dd_red: bool = False,
) -> Image.Image:
    rng = random.Random(seed)
    W, H = 512, 128
    im, d = make_ss(W, H)
    SW, SH = W * 2, H * 2
    y0, y1 = 68, SH - 68
    if style == "iron_fence":
        d.rectangle([0, SH // 2 - 14, SW, SH // 2 + 14], fill=(*base, 255), outline=INK, width=5)
        for x in range(32, SW, 64):
            d.ellipse([x - 16, SH // 2 - 22, x + 16, SH // 2 + 22], fill=(*trim, 255), outline=INK, width=5)
        for x in range(128, SW, 256):
            d.rectangle([x - 24, y0 - 8, x + 24, y1 + 8], fill=(*base, 255), outline=INK, width=6)
    elif style == "picket":
        d.rectangle([0, SH // 2 - 12, SW, SH // 2 + 12], fill=(*trim, 255), outline=INK, width=4)
        for x in range(16, SW, 48):
            d.rounded_rectangle([x, y0 + 10, x + 32, y1 - 10], radius=6, fill=(*base, 255), outline=INK, width=4)
    elif style == "hedge":
        for i in range(36):
            cx = (i / 36.0) * SW
            cy = SH / 2 + rng.uniform(-16, 16)
            r = rng.uniform(38, 56)
            c = jitter_rgb(rng, base, 14)
            for ox in (-SW, 0, SW):
                d.ellipse([cx + ox - r, cy - r, cx + ox + r, cy + r], fill=c, outline=INK, width=4)
        for _ in range(28):
            fx, fy = rng.uniform(0, SW), rng.uniform(y0 + 16, y1 - 16)
            d.ellipse([fx - 9, fy - 9, fx + 9, fy + 9], fill=(*trim, 255), outline=INK, width=3)
    elif style == "crystal_cave":
        d.rectangle([0, y0 - 6, SW, y1 + 6], fill=(*base, 255), outline=INK, width=6)
        for x in range(0, SW, 64):
            c = jitter_rgb(rng, base, 12)
            d.polygon([(x, y0), (x + 64, y0 + rng.randint(-8, 8)), (x + 64, y1 + rng.randint(-8, 8)), (x, y1)], fill=c, outline=INK)
        for x in range(60, SW, 170):
            d.polygon([(x, y0 + 12), (x + 28, y0 - 16), (x + 42, y0 + 24)], fill=(*trim, 255), outline=INK)
    else:
        fill_main = RD_MID if dd_red else (*base, 255)
        fill_hi = RD_HI if dd_red else shade(base, 1.18)
        fill_lo = RD_DARK if dd_red else shade(base, 0.78)
        d.rectangle([0, y0, SW, y1], fill=fill_main, outline=INK, width=6)
        d.rectangle([0, y0 + 6, SW, y0 + 24], fill=fill_hi)
        d.rectangle([0, y1 - 24, SW, y1 - 6], fill=fill_lo)
        if style == "brick":
            step = 85
            for r_idx, ry in enumerate((y0 + 8, SH // 2)):
                off = (step // 2) if r_idx == 1 else 0
                for x in range(-step, SW + step, step):
                    bx = x + off
                    bc = RD_BRIGHT if (dd_red and rng.random() < 0.4) else (RD_MID if dd_red else jitter_rgb(rng, base, 12))
                    d.rectangle([bx + 3, ry, bx + step - 3, ry + (SH // 2 - y0) - 6], fill=bc, outline=INK, width=4)
        elif style == "timber_plaster":
            for x in range(0, SW, 256):
                d.rectangle([x, y0 - 4, x + 36, y1 + 4], fill=(*trim, 255), outline=INK, width=5)
        elif style == "rivet_iron":
            for x in range(0, SW, 128):
                d.line([x, y0, x, y1], fill=INK, width=5)
                for ry in (y0 + 20, y1 - 20):
                    d.ellipse([x + 14, ry - 6, x + 26, ry + 6], fill=(*trim, 255), outline=INK, width=3)
        elif style == "marble":
            for x in range(0, SW, 128):
                d.rectangle([x + 4, y0 + 4, x + 124, y1 - 4], outline=INK, width=4)
            d.rectangle([0, SH // 2 - 10, SW, SH // 2 + 10], fill=(*trim, 255), outline=INK, width=4)
    return finish_ss(im, W, H, seed, grain=5 if not dd_red else 2)


def generate_walls() -> None:
    specs = [
        ("wall_clinic_plaster", "Clinic White Plaster Wall", ["doctor", "clinic", "home"], (228, 226, 218), (156, 122, 86), "timber_plaster", False),
        ("wall_bakery_brick", "Bakery Warm Red Brick Wall", ["bakery", "kitchen", "street"], (168, 86, 62), (112, 64, 48), "brick", False),
        ("wall_cemetery_iron", "Cemetery Wrought-Iron Railing", ["funeral", "graveyard", "street"], (58, 62, 68), (94, 100, 108), "iron_fence", False),
        ("wall_white_picket", "White Wooden Garden Picket Fence", ["garden", "farm", "home"], (232, 228, 218), (196, 190, 178), "picket", False),
        ("wall_garden_cobble", "Low Mossy Garden Stone Wall", ["garden", "graveyard", "farm"], (148, 146, 138), (98, 122, 74), "brick", False),
        ("wall_chapel_stone", "Dark Gothic Chapel Stone Wall", ["temple", "funeral", "dungeon"], (94, 94, 102), (62, 64, 72), "brick", False),
        ("wall_bamboo_screen", "Bamboo & Timber Partition Wall", ["tea", "home", "garden"], (188, 162, 98), (126, 94, 52), "timber_plaster", False),
        ("wall_industrial_iron", "Industrial Riveted Iron Bulkhead", ["sewer", "docks", "tech", "bank"], (86, 92, 98), (138, 142, 146), "rivet_iron", False),
        ("wall_cavern_crystal", "Underdark Crystal-Veined Cave Wall", ["mining", "cavern", "underdark"], (72, 74, 86), (92, 214, 232), "crystal_cave", False),
        ("wall_cellar_brick", "Damp Cellar Dark Brick Wall", ["sewer", "dungeon", "tavern"], (108, 72, 64), (72, 52, 46), "brick", False),
        ("wall_adobe_mudbrick", "Warm Sun-Baked Adobe Wall", ["desert", "market", "camp"], (198, 158, 114), (156, 118, 78), "timber_plaster", False),
        ("wall_temple_marble", "Carved Temple White Marble Wall", ["temple", "courtroom", "mansion"], (222, 218, 208), (196, 164, 92), "marble", False),
        ("wall_blooming_hedge", "Blooming Garden Hedge Wall", ["garden", "park", "nature"], (72, 118, 58), (238, 148, 182), "hedge", False),
        ("wall_barn_timber", "Weathered Barn Wood Slat Wall", ["farm", "stable", "barn"], (136, 92, 62), (92, 62, 42), "timber_plaster", False),
        ("wall_colorable_plaster", "Colorable Painted Plaster Wall", ["home", "shop", "colorable"], (220, 22, 22), (120, 88, 56), "timber_plaster", True),
        ("wall_colorable_brick", "Colorable Painted Masonry Wall", ["street", "shop", "colorable"], (220, 22, 22), (120, 88, 56), "brick", True),
    ]
    for i, (slug, name, tags, base, trim, style, is_red) in enumerate(specs):
        img = gen_wall_strip(300 + i, base, trim, style, is_red)
        save_asset(
            f"walls/{slug}.png",
            img,
            name,
            "wall",
            tags + ["wall"],
            "dd_red" if is_red else "normal",
            256,
            True,
        )


# ============================================================================
# 4. SEAMLESS PATHS (16 x 512x128)
# ============================================================================

def gen_path_strip(
    seed: int,
    base: tuple[int, int, int],
    accent: tuple[int, int, int],
    style: str = "gravel",
    dd_red: bool = False,
) -> Image.Image:
    rng = random.Random(seed)
    W, H = 512, 128
    im, d = make_ss(W, H)
    SW, SH = W * 2, H * 2
    y0, y1 = 44, SH - 44
    if style == "stepping":
        for x in range(42, SW, 128):
            cy = SH // 2 + rng.randint(-14, 14)
            rx, ry = rng.randint(36, 52), rng.randint(32, 44)
            d.ellipse([x - rx, cy - ry, x + rx, cy + ry], fill=jitter_rgb(rng, base, 12), outline=INK, width=4)
    elif style == "rails":
        for x in range(16, SW, 64):
            d.rounded_rectangle([x, y0 + 8, x + 24, y1 - 8], radius=4, fill=jitter_rgb(rng, accent, 10), outline=INK, width=4)
        for ry in (y0 + 34, y1 - 46):
            d.rectangle([0, ry, SW, ry + 14], fill=(*base, 255), outline=INK, width=4)
    elif style == "planks":
        for x in range(0, SW, 44):
            d.rectangle([x + 2, y0 + 10, x + 40, y1 - 10], fill=jitter_rgb(rng, base, 12), outline=INK, width=4)
    elif style == "rope_fence":
        d.line([0, SH // 2, SW, SH // 2], fill=(*accent, 255), width=14)
        d.line([0, SH // 2 - 7, SW, SH // 2 - 7], fill=INK, width=3)
        d.line([0, SH // 2 + 7, SW, SH // 2 + 7], fill=INK, width=3)
        for x in range(64, SW, 128):
            d.ellipse([x - 20, SH // 2 - 20, x + 20, SH // 2 + 20], fill=(*base, 255), outline=INK, width=5)
    elif style == "crack":
        pts = [(x, SH // 2 + math.sin(x * 0.04) * 18 + rng.uniform(-8, 8)) for x in range(0, SW + 32, 32)]
        d.line(pts, fill=INK, width=10)
        for x, y in pts[1::2]:
            d.ellipse([x - 14, y - 14, x + 14, y + 14], fill=(*accent, 170))
    elif style == "flower_border":
        d.rectangle([0, y0 + 20, SW, y1 - 20], fill=(*base, 220), outline=INK, width=4)
        for i in range(44):
            fx = rng.uniform(0, SW)
            fy = rng.uniform(y0 + 26, y1 - 26)
            r = rng.uniform(10, 18)
            d.ellipse([fx - r, fy - r, fx + r, fy + r], fill=jitter_rgb(rng, accent, 24), outline=INK, width=3)
    elif style == "runner":
        c_main = RD_MID if dd_red else (*base, 255)
        c_hi = RD_HI if dd_red else (*accent, 255)
        d.rectangle([0, y0 + 12, SW, y1 - 12], fill=c_main, outline=INK, width=5)
        d.rectangle([0, y0 + 26, SW, y0 + 40], fill=c_hi)
        d.rectangle([0, y1 - 40, SW, y1 - 26], fill=c_hi)
        for x in range(32, SW, 64):
            d.polygon([(x, SH // 2 - 18), (x + 18, SH // 2), (x, SH // 2 + 18), (x - 18, SH // 2)], fill=c_hi, outline=INK)
    else:
        c_main = RD_MID if dd_red else (*base, 240)
        d.rectangle([0, y0 + 8, SW, y1 - 8], fill=c_main, outline=INK, width=4)
        if style == "brick_walk":
            for r_i, ry in enumerate((y0 + 14, SH // 2)):
                off = 32 if r_i else 0
                for x in range(-64, SW + 64, 64):
                    d.rectangle([x + off + 3, ry, x + off + 61, ry + (SH // 2 - y0) - 10], fill=jitter_rgb(rng, base, 12), outline=INK, width=3)
        elif style == "rapids":
            for _ in range(55):
                x, y = rng.uniform(0, SW), rng.uniform(y0 + 20, y1 - 20)
                d.arc([x - 36, y - 10, x + 36, y + 10], 0, 180, fill=(235, 246, 255, 190), width=4)
        else:
            for _ in range(110):
                px, py = rng.uniform(0, SW), rng.uniform(y0 + 14, y1 - 14)
                r = rng.uniform(4, 11)
                c = RD_BRIGHT if dd_red else jitter_rgb(rng, accent, 14)
                d.ellipse([px - r, py - r, px + r, py + r], fill=c, outline=(30, 24, 21, 110), width=2)
    return finish_ss(im, W, H, seed, grain=5 if not dd_red else 2)


def generate_paths() -> None:
    specs = [
        ("path_garden_gravel", "Garden Gravel Walkway Path", ["garden", "park", "street"], (174, 166, 152), (144, 138, 126), "gravel", False),
        ("path_cemetery_stones", "Cemetery Stepping Stones", ["funeral", "graveyard", "garden"], (146, 148, 144), (96, 114, 78), "stepping", False),
        ("path_brick_walkway", "Red Brick Garden Walkway", ["garden", "street", "bakery"], (166, 92, 68), (118, 72, 56), "brick_walk", False),
        ("path_stone_curbing", "City Stone Sidewalk Curb", ["street", "alley", "city"], (148, 146, 142), (116, 114, 110), "brick_walk", False),
        ("path_drainage_trench", "Shallow Stone Sewer Drainage Trench", ["sewer", "alley", "dungeon"], (74, 84, 78), (52, 62, 58), "gravel", False),
        ("path_narrow_dock_planks", "Narrow Wooden Pier Boardwalk", ["docks", "swamp", "camp"], (144, 112, 82), (98, 74, 52), "planks", False),
        ("path_stone_bridge_deck", "Arched Stone Footbridge Deck", ["street", "garden", "castle"], (158, 156, 148), (122, 120, 114), "brick_walk", False),
        ("path_mine_cart_rails", "Iron Mining Cart Track Rails", ["mining", "cavern", "rail"], (112, 118, 126), (118, 84, 56), "rails", False),
        ("path_rope_post_fence", "Wooden Rope Post Barrier Path", ["docks", "farm", "camp", "festival"], (148, 108, 72), (194, 168, 122), "rope_fence", False),
        ("path_mossy_crack", "Mossy Floor Crack Seam", ["dungeon", "graveyard", "ruin"], (46, 42, 38), (82, 114, 62), "crack", False),
        ("path_flowerbed_border", "Blooming Garden Flowerbed Border", ["garden", "park", "tea"], (74, 114, 58), (232, 134, 166), "flower_border", False),
        ("path_braided_runner", "Woven Cottage Hallway Runner", ["home", "tavern", "mansion"], (152, 76, 62), (218, 184, 112), "runner", False),
        ("path_wagon_ruts", "Muddy Wagon Wheel Ruts", ["farm", "camp", "wilderness"], (122, 92, 66), (86, 62, 44), "rails", False),
        ("path_stream_rapids", "Foaming Creek Stream Rapids", ["water", "nature", "forest"], (78, 148, 174), (210, 236, 248), "rapids", False),
        ("path_colorable_runner", "Colorable Ceremonial Carpet Runner", ["temple", "mansion", "courtroom", "colorable"], (220, 22, 22), (255, 140, 140), "runner", True),
        ("path_colorable_trim", "Colorable Painted Floor Trim", ["home", "shop", "colorable"], (220, 22, 22), (255, 140, 140), "gravel", True),
    ]
    for i, (slug, name, tags, base, accent, style, is_red) in enumerate(specs):
        img = gen_path_strip(400 + i, base, accent, style, is_red)
        save_asset(
            f"paths/{slug}.png",
            img,
            name,
            "path",
            tags + ["path"],
            "dd_red" if is_red else "normal",
            256,
            False,
        )


# ============================================================================
# 5. CARVE-READY PORTALS — DOORS & WINDOWS (16 x 256x128)
# ============================================================================

def gen_portal(seed: int, kind: str, frame: tuple[int, int, int], fill: tuple[int, int, int], dd_red: bool = False) -> Image.Image:
    W, H = 256, 128
    im, d = make_ss(W, H)
    SW, SH = W * 2, H * 2
    y0, y1 = 76, SH - 76
    # Jamb blocks left/right
    d.rectangle([16, y0 - 18, 64, y1 + 18], fill=(*frame, 255), outline=INK, width=5)
    d.rectangle([SW - 64, y0 - 18, SW - 16, y1 + 18], fill=(*frame, 255), outline=INK, width=5)
    body = RD_MID if dd_red else (*fill, 255)
    hi = RD_HI if dd_red else shade(fill, 1.18)
    if kind == "window":
        d.rectangle([64, y0 + 12, SW - 64, y1 - 12], fill=(168, 212, 228, 220), outline=INK, width=5)
        for mx in (160, 256, 352):
            d.rectangle([mx - 5, y0 + 8, mx + 5, y1 - 8], fill=body, outline=INK, width=3)
    elif kind == "stained":
        colors = [(214, 72, 72, 230), (72, 138, 214, 230), (234, 188, 64, 230), (96, 178, 114, 230)]
        cw = (SW - 128) // 4
        for idx, col in enumerate(colors):
            x = 64 + idx * cw
            d.rectangle([x, y0 + 10, x + cw, y1 - 10], fill=col, outline=INK, width=4)
    elif kind == "grille":
        d.rectangle([64, y0 + 18, SW - 64, y1 - 18], fill=(42, 46, 52, 160), outline=INK, width=4)
        for x in range(88, SW - 64, 32):
            d.rectangle([x - 5, y0 + 6, x + 5, y1 - 6], fill=(*fill, 255), outline=INK, width=3)
    elif kind == "double":
        mid = SW // 2
        d.rectangle([64, y0 + 4, mid - 3, y1 - 4], fill=body, outline=INK, width=5)
        d.rectangle([mid + 3, y0 + 4, SW - 64, y1 - 4], fill=body, outline=INK, width=5)
        d.rectangle([76, y0 + 18, mid - 15, y0 + 32], fill=hi)
        d.rectangle([mid + 15, y0 + 18, SW - 76, y0 + 32], fill=hi)
        d.ellipse([mid - 26, SH // 2 - 8, mid - 12, SH // 2 + 8], fill=(*BRASS, 255), outline=INK, width=3)
        d.ellipse([mid + 12, SH // 2 - 8, mid + 26, SH // 2 + 8], fill=(*BRASS, 255), outline=INK, width=3)
    elif kind == "vault":
        d.rectangle([64, y0 - 8, SW - 64, y1 + 8], fill=(*fill, 255), outline=INK, width=6)
        d.ellipse([SW // 2 - 34, SH // 2 - 34, SW // 2 + 34, SH // 2 + 34], fill=(*BRASS, 255), outline=INK, width=5)
        for a in range(0, 360, 60):
            rad = math.radians(a)
            d.line([SW // 2, SH // 2, SW // 2 + math.cos(rad) * 32, SH // 2 + math.sin(rad) * 32], fill=INK, width=5)
    else:
        d.rectangle([64, y0 + 4, SW - 64, y1 - 4], fill=body, outline=INK, width=5)
        d.rectangle([76, y0 + 16, SW - 76, y0 + 30], fill=hi)
        d.ellipse([SW - 102, SH // 2 - 9, SW - 84, SH // 2 + 9], fill=(*BRASS, 255), outline=INK, width=3)
    return finish_ss(im, W, H, seed, grain=4 if not dd_red else 2)


def generate_portals() -> None:
    specs = [
        ("portal_clinic_double", "Clinic Frosted Glass Double Door", ["doctor", "clinic", "door"], "double", (196, 198, 202), (222, 232, 234), False),
        ("portal_bakery_window", "Bakery Storefront Glass Window", ["bakery", "shop", "window"], "window", (134, 86, 56), (164, 112, 72), False),
        ("portal_post_grille", "Post Office Brass Teller Grille", ["post_office", "bank", "window"], "grille", (112, 76, 48), (196, 160, 74), False),
        ("portal_cemetery_gate", "Cemetery Arched Iron Gate", ["funeral", "graveyard", "gate", "door"], "grille", (118, 120, 124), (58, 62, 68), False),
        ("portal_stained_lancet", "Chapel Stained-Glass Window", ["temple", "chapel", "window"], "stained", (128, 124, 118), (168, 148, 120), False),
        ("portal_barn_sliding", "Sliding Wooden Barn Door", ["farm", "stable", "barn", "door"], "single", (102, 70, 46), (148, 96, 64), False),
        ("portal_tavern_saloon", "Swinging Tavern Saloon Doors", ["tavern", "inn", "door"], "double", (112, 76, 48), (168, 118, 72), False),
        ("portal_bank_vault", "Heavy Steel Bank Vault Door", ["bank", "post_office", "dungeon", "door"], "vault", (74, 78, 86), (112, 118, 126), False),
        ("portal_cellar_hatch", "Cellar Wooden Bulkhead Door", ["home", "tavern", "dungeon", "door"], "double", (96, 94, 92), (126, 92, 62), False),
        ("portal_greenhouse_win", "Conservatory Greenhouse Window", ["garden", "mansion", "window"], "window", (218, 222, 218), (224, 228, 224), False),
        ("portal_cottage_door", "Warm Oak Cottage Front Door", ["home", "bakery", "door"], "single", (128, 120, 112), (156, 108, 66), False),
        ("portal_prison_grate", "Prison Iron-Barred Cell Window", ["dungeon", "prison", "window"], "grille", (98, 100, 106), (72, 76, 82), False),
        ("portal_crypt_arch", "Stone Crypt Entry Portal", ["funeral", "dungeon", "crypt", "door"], "single", (116, 114, 110), (88, 86, 84), False),
        ("portal_colorable_door", "Colorable Painted Single Door", ["home", "shop", "door", "colorable"], "single", (134, 124, 114), (220, 22, 22), True),
        ("portal_colorable_double", "Colorable Painted Double Door", ["mansion", "shop", "door", "colorable"], "double", (134, 124, 114), (220, 22, 22), True),
        ("portal_colorable_window", "Colorable Shuttered Window", ["home", "shop", "window", "colorable"], "window", (134, 124, 114), (220, 22, 22), True),
    ]
    for i, (slug, name, tags, kind, frame, fill, is_red) in enumerate(specs):
        img = gen_portal(500 + i, kind, frame, fill, is_red)
        save_asset(
            f"portals/{slug}.png",
            img,
            name,
            "portal",
            tags + ["portal"],
            "dd_red" if is_red else "normal",
            256,
            False,
        )


# ============================================================================
# 6. 150 NATIVE DUNGEONDRAFT RED-MASK COLORABLE INDIVIDUAL PROPS (`dd_red`)
# ============================================================================

def draw_colorable_prop(seed: int, shape: str, variant: int = 0) -> Image.Image:
    rng = random.Random(seed)
    W, H = 224, 224
    im, d = make_ss(W, H)
    S = W * 2
    cx, cy = S // 2, S // 2
    wood = (*WOOD_OAK, 255)
    walnut = (*WOOD_WALNUT, 255)
    brass = (*BRASS, 255)
    iron = (*IRON, 255)
    cream = (232, 224, 206, 255)

    if shape == "cushion_round":
        r = 128 + (variant % 3) * 14
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RD_MID, outline=INK, width=7)
        d.ellipse([cx - r + 24, cy - r + 24, cx + r - 24, cy + r - 24], fill=RD_BRIGHT)
        d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=RD_DARK, outline=INK, width=4)
        for a in range(0, 360, 45):
            rad = math.radians(a)
            d.line([cx + math.cos(rad) * 20, cy + math.sin(rad) * 20, cx + math.cos(rad) * (r - 22), cy + math.sin(rad) * (r - 22)], fill=RD_DARK, width=4)
    elif shape == "cushion_square":
        hw, hh = 132, 112 + (variant % 2) * 24
        d.rounded_rectangle([cx - hw, cy - hh, cx + hw, cy + hh], radius=28, fill=RD_MID, outline=INK, width=7)
        d.rounded_rectangle([cx - hw + 22, cy - hh + 22, cx + hw - 22, cy + hh - 22], radius=18, fill=RD_BRIGHT)
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=RD_DARK, outline=INK, width=4)
    elif shape == "bolster":
        d.rounded_rectangle([66, cy - 64, S - 66, cy + 64], radius=56, fill=RD_MID, outline=INK, width=7)
        d.rounded_rectangle([88, cy - 42, S - 88, cy - 10], radius=18, fill=RD_HI)
        d.rectangle([86, cy - 62, 104, cy + 62], fill=RD_DARK, outline=INK, width=4)
        d.rectangle([S - 104, cy - 62, S - 86, cy + 62], fill=RD_DARK, outline=INK, width=4)
    elif shape == "chair":
        frame = walnut if variant % 2 else wood
        d.rounded_rectangle([96, 86, S - 96, S - 76], radius=22, fill=frame, outline=INK, width=7)
        d.rounded_rectangle([118, 124, S - 118, S - 96], radius=18, fill=RD_MID, outline=INK, width=6)
        d.rounded_rectangle([136, 140, S - 136, S - 116], radius=12, fill=RD_BRIGHT)
        d.rounded_rectangle([88, 72, S - 88, 128], radius=16, fill=frame, outline=INK, width=7)
        if variant >= 2:
            d.rounded_rectangle([82, 118, 124, S - 86], radius=14, fill=RD_DARK, outline=INK, width=6)
            d.rounded_rectangle([S - 124, 118, S - 82, S - 86], radius=14, fill=RD_DARK, outline=INK, width=6)
    elif shape == "stool":
        r = 112
        d.ellipse([cx - r - 12, cy - r - 12, cx + r + 12, cy + r + 12], fill=wood, outline=INK, width=7)
        d.ellipse([cx - r + 8, cy - r + 8, cx + r - 8, cy + r - 8], fill=RD_MID, outline=INK, width=6)
        d.ellipse([cx - r + 32, cy - r + 32, cx + r - 32, cy + r - 32], fill=RD_HI)
    elif shape == "sofa":
        d.rounded_rectangle([42, 104, S - 42, S - 96], radius=28, fill=wood, outline=INK, width=7)
        d.rounded_rectangle([64, 126, S - 64, S - 114], radius=20, fill=RD_MID, outline=INK, width=6)
        d.rounded_rectangle([54, 96, S - 54, 152], radius=18, fill=RD_DARK, outline=INK, width=6)
        d.line([cx, 152, cx, S - 114], fill=INK, width=5)
        d.rounded_rectangle([82, 170, cx - 18, S - 136], radius=12, fill=RD_BRIGHT)
        d.rounded_rectangle([cx + 18, 170, S - 82, S - 136], radius=12, fill=RD_BRIGHT)
    elif shape == "rug_rect":
        m = 46 if variant % 2 == 0 else 68
        d.rectangle([m, 86, S - m, S - 86], fill=RD_MID, outline=INK, width=7)
        d.rectangle([m + 22, 108, S - m - 22, S - 108], fill=RD_BRIGHT, outline=RD_DARK, width=6)
        d.polygon([(cx, 134), (cx + 76, cy), (cx, S - 134), (cx - 76, cy)], fill=RD_HI, outline=RD_DARK)
        for fy in range(96, S - 90, 14):
            d.line([m - 16, fy, m, fy], fill=cream, width=4)
            d.line([S - m, fy, S - m + 16, fy], fill=cream, width=4)
    elif shape == "rug_round":
        r = 166
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RD_MID, outline=INK, width=7)
        d.ellipse([cx - r + 28, cy - r + 28, cx + r - 28, cy + r - 28], fill=RD_BRIGHT, outline=RD_DARK, width=6)
        d.ellipse([cx - 64, cy - 64, cx + 64, cy + 64], fill=RD_HI, outline=RD_DARK, width=5)
    elif shape == "drape":
        d.rounded_rectangle([56, 76, S - 56, S - 76], radius=24, fill=RD_MID, outline=INK, width=7)
        for x in range(94, S - 76, 48):
            d.line([x, 86, x + rng.randint(-12, 12), S - 86], fill=RD_DARK, width=7)
            d.line([x + 16, 86, x + 16 + rng.randint(-10, 10), S - 86], fill=RD_HI, width=5)
    elif shape == "book":
        cnt = 1 + (variant % 3)
        for i in range(cnt):
            ox, oy = (i - cnt // 2) * 26, (i - cnt // 2) * 20
            d.rounded_rectangle([120 + ox, 98 + oy, S - 120 + ox, S - 98 + oy], radius=10, fill=RD_MID, outline=INK, width=7)
            d.rectangle([120 + ox, 98 + oy, 152 + ox, S - 98 + oy], fill=RD_DARK, outline=INK, width=5)
            d.rectangle([S - 132 + ox, 108 + oy, S - 120 + ox, S - 108 + oy], fill=cream)
            d.rectangle([168 + ox, 134 + oy, S - 148 + ox, 166 + oy], fill=brass, outline=INK, width=3)
    elif shape == "paper_seal":
        d.rounded_rectangle([84, 118, S - 84, S - 118], radius=8, fill=cream, outline=INK, width=7)
        d.line([84, 118, cx, cy + 12, S - 84, 118], fill=INK, width=5)
        d.ellipse([cx - 34, cy - 18, cx + 34, cy + 48], fill=RD_MID, outline=INK, width=5)
        d.ellipse([cx - 20, cy - 4, cx + 20, cy + 34], fill=RD_HI)
    elif shape == "potion":
        r = 92 if variant % 2 == 0 else 76
        if variant == 2:
            d.rounded_rectangle([cx - 88, cy - 88, cx + 88, cy + 88], radius=24, fill=(214, 232, 238, 220), outline=INK, width=7)
            d.rounded_rectangle([cx - 72, cy - 72, cx + 72, cy + 72], radius=18, fill=RD_MID)
        else:
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(214, 232, 238, 225), outline=INK, width=7)
            d.ellipse([cx - r + 16, cy - r + 16, cx + r - 16, cy + r - 16], fill=RD_MID)
            d.ellipse([cx - r + 34, cy - r + 30, cx - 10, cy - 10], fill=RD_PALE)
        d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=(164, 118, 76, 255), outline=INK, width=6)
    elif shape == "bush_red":
        lobes = 10 + (variant % 4) * 3
        for i in range(lobes):
            ang = (i / lobes) * math.tau + rng.uniform(-0.15, 0.15)
            dist = rng.uniform(52, 92)
            r = rng.uniform(54, 78)
            lx, ly = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
            d.ellipse([lx - r, ly - r, lx + r, ly + r], fill=RD_DARK if i % 3 == 0 else RD_MID, outline=INK, width=6)
        d.ellipse([cx - 78, cy - 78, cx + 78, cy + 78], fill=RD_BRIGHT)
        d.ellipse([cx - 42, cy - 46, cx + 26, cy + 20], fill=RD_HI)
    elif shape == "flower_pot":
        d.ellipse([cx - 108, cy - 108, cx + 108, cy + 108], fill=(176, 98, 66, 255), outline=INK, width=7)
        d.ellipse([cx - 86, cy - 86, cx + 86, cy + 86], fill=(82, 58, 42, 255), outline=INK, width=5)
        for a in range(0, 360, 45):
            rad = math.radians(a)
            px, py = cx + math.cos(rad) * 58, cy + math.sin(rad) * 58
            d.ellipse([px - 34, py - 34, px + 34, py + 34], fill=(74, 126, 62, 255), outline=INK, width=5)
        for a in range(0, 360, 72):
            rad = math.radians(a)
            fx, fy = cx + math.cos(rad) * 34, cy + math.sin(rad) * 34
            d.ellipse([fx - 26, fy - 26, fx + 26, fy + 26], fill=RD_MID, outline=INK, width=4)
        d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=RD_HI, outline=INK, width=4)
    elif shape == "mushroom_red":
        cnt = 1 if variant % 2 == 0 else 3
        pos_list = [(cx, cy, 104)] if cnt == 1 else [(cx - 56, cy - 34, 68), (cx + 62, cy - 18, 56), (cx - 4, cy + 62, 62)]
        for mx, my, mr in pos_list:
            d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=RD_MID, outline=INK, width=6)
            d.ellipse([mx - mr + 24, my - mr + 18, mx + mr - 28, my + mr - 28], fill=RD_BRIGHT)
            for _ in range(5):
                sx, sy = mx + rng.uniform(-mr * 0.5, mr * 0.5), my + rng.uniform(-mr * 0.5, mr * 0.5)
                d.ellipse([sx - 10, sy - 10, sx + 10, sy + 10], fill=cream)
    elif shape == "umbrella":
        r = 166
        sides = 8 if variant % 2 == 0 else 4
        pts = [(cx + math.cos(i * math.tau / sides + math.pi / 4) * r, cy + math.sin(i * math.tau / sides + math.pi / 4) * r) for i in range(sides)]
        d.polygon(pts, fill=RD_MID, outline=INK)
        for i in range(sides):
            p1, p2 = pts[i], pts[(i + 1) % sides]
            d.polygon([(cx, cy), p1, p2], fill=RD_BRIGHT if i % 2 == 0 else RD_MID, outline=INK)
        d.ellipse([cx - 20, cy - 20, cx + 20, cy + 20], fill=wood, outline=INK, width=5)
    elif shape == "banner":
        if variant % 2 == 0:
            d.rectangle([92, 54, S - 92, 78], fill=wood, outline=INK, width=5)
            d.polygon([(112, 78), (S - 112, 78), (S - 112, S - 64), (cx, S - 122), (112, S - 64)], fill=RD_MID, outline=INK)
            d.polygon([(136, 98), (S - 136, 98), (S - 136, S - 114), (cx, S - 156), (136, S - 114)], fill=RD_BRIGHT)
            d.ellipse([cx - 32, cy - 42, cx + 32, cy + 22], fill=brass, outline=INK, width=4)
        else:
            d.polygon([(74, 118), (S - 74, cy), (74, S - 118)], fill=RD_MID, outline=INK)
            d.polygon([(94, 146), (S - 116, cy), (94, S - 146)], fill=RD_HI)
    elif shape == "shield":
        if variant % 2 == 0:
            d.ellipse([cx - 132, cy - 132, cx + 132, cy + 132], fill=iron, outline=INK, width=7)
            d.ellipse([cx - 108, cy - 108, cx + 108, cy + 108], fill=RD_MID, outline=INK, width=6)
            d.ellipse([cx - 36, cy - 36, cx + 36, cy + 36], fill=brass, outline=INK, width=5)
        else:
            pts = [(104, 72), (S - 104, 72), (S - 104, 240), (cx, S - 62), (104, 240)]
            d.polygon(pts, fill=RD_MID, outline=INK)
            d.line([cx, 78, cx, S - 72], fill=RD_DARK, width=8)
            d.line([110, 188, S - 110, 188], fill=RD_HI, width=10)
    elif shape == "rune":
        r = 166
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=RD_BRIGHT, width=10)
        d.ellipse([cx - r + 24, cy - r + 24, cx + r - 24, cy + r - 24], outline=RD_HI, width=6)
        pts = [(cx + math.cos(i * math.tau / 6) * (r - 28), cy + math.sin(i * math.tau / 6) * (r - 28)) for i in range(6)]
        d.polygon(pts[0::2], outline=RD_BRIGHT)
        d.polygon(pts[1::2], outline=RD_BRIGHT)
        for i in range(6):
            d.line([pts[i], pts[(i + 2) % 6]], fill=RD_BRIGHT, width=6)
        d.ellipse([cx - 40, cy - 40, cx + 40, cy + 40], fill=RD_PALE, outline=RD_MID, width=6)
    elif shape == "crystal":
        for a, ln, wd in ((0, 138, 36), (62, 118, 32), (132, 126, 34), (208, 112, 30), (288, 124, 32)):
            rad = math.radians(a + variant * 19)
            tx, ty = cx + math.cos(rad) * ln, cy + math.sin(rad) * ln
            px, py = -math.sin(rad) * wd, math.cos(rad) * wd
            d.polygon([(cx + px, cy + py), (tx, ty), (cx - px, cy - py)], fill=RD_MID, outline=INK)
            d.polygon([(cx, cy), (tx, ty), (cx - px * 0.6, cy - py * 0.6)], fill=RD_HI)
    elif shape == "roof":
        d.rectangle([48, 48, S - 48, S - 48], fill=RD_MID, outline=INK, width=7)
        for y in range(88, S - 48, 48):
            d.line([48, y, S - 48, y], fill=INK, width=5)
            d.line([48, y + 6, S - 48, y + 6], fill=RD_HI, width=4)
            off = 28 if (y // 48) % 2 else 0
            for x in range(48 + off, S - 48, 64):
                d.line([x, y - 48, x, y], fill=INK, width=4)
        if variant == 1:
            d.line([48, 48, S - 48, S - 48], fill=RD_DARK, width=18)
            d.line([48, 48, S - 48, S - 48], fill=INK, width=5)
        elif variant == 2:
            d.line([48, cy, S - 48, cy], fill=RD_DARK, width=22)
            d.line([48, cy, S - 48, cy], fill=RD_HI, width=6)
    elif shape == "tent":
        d.rounded_rectangle([54, 72, S - 54, S - 72], radius=16, fill=RD_MID, outline=INK, width=7)
        d.line([54, 72, cx, cy, S - 54, 72], fill=INK, width=6)
        d.line([54, S - 72, cx, cy, S - 54, S - 72], fill=INK, width=6)
        d.polygon([(58, 76), (S - 58, 76), (cx, cy)], fill=RD_BRIGHT)
        d.polygon([(58, S - 76), (S - 58, S - 76), (cx, cy)], fill=RD_DARK)
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=wood, outline=INK, width=5)
    elif shape == "ceramic":
        r = 112 if variant % 2 == 0 else 86
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=RD_MID, outline=INK, width=7)
        d.ellipse([cx - r + 24, cy - r + 24, cx + r - 24, cy + r - 24], fill=RD_PALE, outline=RD_DARK, width=5)
        d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], fill=RD_HI)
    elif shape == "candle":
        cnt = 1 if variant % 2 == 0 else 3
        pts = [(cx, cy, 62)] if cnt == 1 else [(cx - 50, cy - 28, 46), (cx + 52, cy - 12, 42), (cx - 6, cy + 54, 48)]
        for mx, my, mr in pts:
            d.ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=RD_MID, outline=INK, width=6)
            d.ellipse([mx - mr + 14, my - mr + 14, mx + mr - 14, my + mr - 14], fill=RD_HI)
            d.ellipse([mx - 14, my - 14, mx + 14, my + 14], fill=(255, 224, 96, 255), outline=INK, width=3)
    else:  # fabric_bolt / painted_box / cloak
        d.rounded_rectangle([72, 92, S - 72, S - 92], radius=22, fill=RD_MID, outline=INK, width=7)
        d.rounded_rectangle([94, 114, S - 94, S - 114], radius=14, fill=RD_BRIGHT, outline=RD_DARK, width=5)
        d.line([72, cy, S - 72, cy], fill=brass, width=10)
        d.line([cx, 92, cx, S - 92], fill=brass, width=10)
    return finish_ss(im, W, H, seed, grain=2)


def generate_colorables() -> None:
    # 150 cohesive dd_red colorable individual props across every TTRPG scene
    items: list[tuple[str, str, list[str], str, int, float, bool]] = [
        # Seating & Cushions (18)
        ("col_cushion_round_sm", "Colorable Round Floor Cushion (Small)", ["home", "tavern", "tea", "cushion"], "cushion_round", 0, 0.75, True),
        ("col_cushion_round_lg", "Colorable Round Floor Cushion (Large)", ["home", "mansion", "tea", "cushion"], "cushion_round", 2, 1.0, True),
        ("col_cushion_square", "Colorable Square Tufted Cushion", ["home", "mansion", "bedroom", "cushion"], "cushion_square", 0, 0.8, True),
        ("col_cushion_rect", "Colorable Rectangular Seat Cushion", ["home", "tavern", "cushion"], "cushion_square", 1, 0.9, True),
        ("col_bolster_pillow", "Colorable Bolster Pillow", ["bedroom", "mansion", "home", "pillow"], "bolster", 0, 0.9, True),
        ("col_dining_chair_oak", "Colorable Oak Upholstered Chair", ["home", "tavern", "mansion", "chair"], "chair", 0, 0.95, True),
        ("col_dining_chair_walnut", "Colorable Walnut Upholstered Chair", ["mansion", "study", "courtroom", "chair"], "chair", 1, 0.95, True),
        ("col_armchair_club", "Colorable Upholstered Club Armchair", ["mansion", "study", "home", "chair"], "chair", 2, 1.25, True),
        ("col_armchair_noble", "Colorable Walnut Wingback Armchair", ["mansion", "courtroom", "chair"], "chair", 3, 1.3, True),
        ("col_bar_stool_padded", "Colorable Padded Tavern Bar Stool", ["tavern", "inn", "stool"], "stool", 0, 0.8, True),
        ("col_doctor_stool_col", "Colorable Padded Clinic Stool", ["doctor", "clinic", "stool"], "stool", 1, 0.8, True),
        ("col_tailor_stool_col", "Colorable Tailor Workshop Stool", ["market", "tailor", "stool"], "stool", 2, 0.8, True),
        ("col_ottoman_pouf", "Colorable Round Velvet Ottoman", ["mansion", "bedroom", "tea", "furniture"], "cushion_round", 1, 0.95, True),
        ("col_parlor_loveseat", "Colorable Two-Seat Parlor Loveseat", ["mansion", "home", "tea", "furniture"], "sofa", 0, 2.0, True),
        ("col_study_settee", "Colorable Study Lounge Sofa", ["study", "courtroom", "mansion", "furniture"], "sofa", 1, 2.2, True),
        ("col_pew_pad", "Colorable Chapel Pew Seat Cushion", ["temple", "chapel", "funeral", "cushion"], "bolster", 1, 1.8, False),
        ("col_booth_seat", "Colorable Tavern Booth Seat Pad", ["tavern", "bakery", "furniture"], "cushion_square", 1, 1.4, True),
        ("col_theater_seat", "Colorable Velvet Theater Seat", ["theater", "music", "chair"], "chair", 2, 1.0, True),
        # Rugs, Runners & Drapes (16)
        ("col_rug_rect_woven", "Colorable Woven Parlor Rug", ["home", "mansion", "rug"], "rug_rect", 0, 2.6, False),
        ("col_rug_rect_narrow", "Colorable Hallway Runner Rug", ["home", "mansion", "temple", "rug"], "rug_rect", 1, 2.4, False),
        ("col_rug_round_braid", "Colorable Round Braided Rug", ["home", "bedroom", "tavern", "rug"], "rug_round", 0, 2.2, False),
        ("col_rug_round_noble", "Colorable Ornate Round Medallion Rug", ["mansion", "study", "tea", "rug"], "rug_round", 1, 2.6, False),
        ("col_prayer_rug", "Colorable Fringed Prayer Rug", ["temple", "chapel", "rug"], "rug_rect", 0, 1.7, False),
        ("col_welcome_mat", "Colorable Woven Doorstep Mat", ["home", "shop", "bakery", "rug"], "rug_rect", 1, 1.1, False),
        ("col_tablecloth_rect", "Colorable Draped Rect Tablecloth", ["tavern", "bakery", "tea", "fabric"], "drape", 0, 2.0, False),
        ("col_tablecloth_round", "Colorable Draped Round Tablecloth", ["tea", "mansion", "bakery", "fabric"], "rug_round", 0, 1.6, False),
        ("col_stage_curtain", "Colorable Folded Stage Curtain", ["theater", "music", "fabric"], "drape", 1, 1.4, True),
        ("col_altar_cloth", "Colorable Ceremonial Altar Cloth", ["temple", "chapel", "funeral", "fabric"], "drape", 2, 2.0, False),
        ("col_coffin_drape", "Colorable Funeral Bier Velvet Drape", ["funeral", "graveyard", "fabric"], "drape", 3, 2.1, True),
        ("col_canopy_valance", "Colorable Bed Canopy Fabric Drape", ["bedroom", "mansion", "fabric"], "drape", 0, 2.1, True),
        ("col_market_tarp", "Colorable Market Stall Canvas Tarp", ["market", "camp", "docks", "fabric"], "drape", 1, 2.2, True),
        ("col_window_curtain", "Colorable Window Curtain Panel", ["home", "mansion", "fabric"], "drape", 2, 1.2, True),
        ("col_bed_blanket", "Colorable Folded Wool Bed Blanket", ["bedroom", "camp", "home", "fabric"], "cushion_square", 0, 1.0, True),
        ("col_picnic_blanket", "Colorable Outdoor Picnic Blanket", ["park", "camp", "garden", "rug"], "rug_rect", 0, 2.2, False),
        # Books, Stationery & Office (14)
        ("col_book_single", "Colorable Hardcover Book (Single)", ["library", "study", "school", "book", "clutter"], "book", 0, 0.45, False),
        ("col_book_pair", "Colorable Stacked Books (Pair)", ["library", "study", "school", "book", "clutter"], "book", 1, 0.55, False),
        ("col_book_stack", "Colorable Stacked Books (Trio)", ["library", "study", "courtroom", "book", "clutter"], "book", 2, 0.6, True),
        ("col_ledger_book", "Colorable Bound Accounting Ledger", ["post_office", "bank", "market", "book", "clutter"], "book", 0, 0.6, False),
        ("col_spellbook_tome", "Colorable Arcane Spellbook Tome", ["arcane", "library", "alchemy", "book", "clutter"], "book", 1, 0.55, False),
        ("col_sealed_letter", "Colorable Wax-Sealed Envelope", ["post_office", "study", "paper", "clutter"], "paper_seal", 0, 0.45, False),
        ("col_royal_decree", "Colorable Sealed Official Letter", ["courtroom", "post_office", "castle", "clutter"], "paper_seal", 1, 0.5, False),
        ("col_ribbon_parcel", "Colorable Ribbon-Tied Parcel Box", ["post_office", "bakery", "market", "clutter"], "box", 0, 0.7, True),
        ("col_gift_box", "Colorable Wrapped Festive Gift Box", ["festival", "tea", "home", "clutter"], "box", 1, 0.65, True),
        ("col_desk_blotter", "Colorable Leather Writing Desk Blotter", ["post_office", "study", "bank", "clutter"], "rug_rect", 1, 0.9, False),
        ("col_diploma_folder", "Colorable Bound Case File Folder", ["courtroom", "school", "office", "clutter"], "book", 0, 0.55, False),
        ("col_school_satchel", "Colorable Student Leather Satchel", ["school", "post_office", "bag", "clutter"], "box", 2, 0.75, True),
        ("col_hymnal_book", "Colorable Chapel Hymnal Volume", ["temple", "chapel", "book", "clutter"], "book", 0, 0.5, False),
        ("col_recipe_book", "Colorable Kitchen Cookbook", ["kitchen", "bakery", "book", "clutter"], "book", 1, 0.5, False),
        # Bottles, Potions & Apothecary (16)
        ("col_potion_round", "Colorable Round Potion Flask", ["alchemy", "apothecary", "doctor", "potion", "clutter"], "potion", 0, 0.42, False),
        ("col_potion_vial", "Colorable Small Medicine Vial", ["doctor", "apothecary", "alchemy", "potion", "clutter"], "potion", 1, 0.36, False),
        ("col_potion_square", "Colorable Square Apothecary Bottle", ["doctor", "apothecary", "alchemy", "potion", "clutter"], "potion", 2, 0.44, False),
        ("col_elixir_decanter", "Colorable Large Elixir Decanter", ["alchemy", "arcane", "potion", "clutter"], "potion", 0, 0.55, False),
        ("col_ink_bottle", "Colorable Glass Ink Bottle", ["post_office", "study", "school", "clutter"], "potion", 2, 0.35, False),
        ("col_perfume_flacon", "Colorable Noble Perfume Bottle", ["bedroom", "mansion", "clutter"], "potion", 2, 0.38, False),
        ("col_jam_jar_col", "Colorable Jam Preserve Jar", ["bakery", "kitchen", "pantry", "clutter"], "potion", 1, 0.42, False),
        ("col_reagent_flask", "Colorable Alchemical Reagent Flask", ["alchemy", "arcane", "doctor", "clutter"], "potion", 0, 0.48, False),
        ("col_oil_lamp_globe", "Colorable Colored-Glass Oil Lamp", ["home", "tavern", "study", "light"], "potion", 0, 0.5, True),
        ("col_specimen_jar_col", "Colorable Specimen Tincture Jar", ["doctor", "apothecary", "alchemy", "clutter"], "potion", 2, 0.5, False),
        ("col_wine_carafe", "Colorable Wine & Juice Carafe", ["tavern", "kitchen", "tea", "drink", "clutter"], "potion", 1, 0.45, False),
        ("col_spice_bottle", "Colorable Corked Spice Bottle", ["kitchen", "market", "pantry", "clutter"], "potion", 1, 0.38, False),
        ("col_dye_vat_jar", "Colorable Tailor Dye Vat Jar", ["market", "tailor", "workshop", "clutter"], "potion", 0, 0.65, True),
        ("col_paint_pot", "Colorable Artist Pigment Paint Pot", ["theater", "workshop", "school", "clutter"], "potion", 1, 0.42, False),
        ("col_holy_water_vial", "Colorable Ritual Blessing Vial", ["temple", "chapel", "clutter"], "potion", 2, 0.38, False),
        ("col_milk_pitcher_col", "Colorable Glazed Cream Pitcher", ["bakery", "kitchen", "tea", "clutter"], "ceramic", 1, 0.45, False),
        # Nature, Flowers, Trees & Foliage (24)
        ("col_bush_round_a", "Colorable Round Leafy Bush A", ["bush", "nature", "forest", "garden"], "bush_red", 0, 1.4, True),
        ("col_bush_round_b", "Colorable Dense Leafy Bush B", ["bush", "nature", "forest", "garden"], "bush_red", 1, 1.6, True),
        ("col_bush_cluster_a", "Colorable Wide Shrub Cluster A", ["bush", "nature", "forest"], "bush_red", 2, 1.9, True),
        ("col_bush_cluster_b", "Colorable Wild Hedge Cluster B", ["bush", "nature", "garden"], "bush_red", 3, 1.8, True),
        ("col_tree_canopy_sm", "Colorable Small Deciduous Tree Canopy", ["tree", "nature", "forest", "garden"], "bush_red", 1, 2.7, True),
        ("col_tree_canopy_md", "Colorable Medium Deciduous Tree Canopy", ["tree", "nature", "forest"], "bush_red", 2, 3.3, True),
        ("col_tree_canopy_lg", "Colorable Giant Ancient Tree Canopy", ["tree", "nature", "forest"], "bush_red", 3, 3.9, True),
        ("col_tree_blossom", "Colorable Orchard Blossom Tree", ["tree", "nature", "garden", "farm"], "bush_red", 0, 3.1, True),
        ("col_potted_flower_sm", "Colorable Potted Flower (Small)", ["home", "garden", "tea", "flower"], "flower_pot", 0, 0.65, True),
        ("col_potted_flower_lg", "Colorable Potted Flower Urn (Large)", ["mansion", "garden", "temple", "flower"], "flower_pot", 1, 0.95, True),
        ("col_flower_cluster_a", "Colorable Wildflower Clump A", ["flower", "nature", "garden", "meadow"], "flower_pot", 2, 0.85, False),
        ("col_flower_cluster_b", "Colorable Garden Rose Bush", ["flower", "nature", "garden", "mansion"], "bush_red", 0, 1.2, True),
        ("col_mushroom_single", "Colorable Woodland Mushroom Cap", ["mushroom", "nature", "forest", "cavern"], "mushroom_red", 0, 0.6, False),
        ("col_mushroom_trio", "Colorable Mushroom Cluster (3)", ["mushroom", "nature", "forest", "cavern"], "mushroom_red", 1, 0.95, False),
        ("col_mushroom_giant", "Colorable Giant Underdark Mushroom", ["mushroom", "cavern", "underdark", "nature"], "mushroom_red", 0, 1.9, True),
        ("col_lily_blossom", "Colorable Pond Water Lily Blossom", ["flower", "water", "garden", "nature"], "flower_pot", 0, 0.7, False),
        ("col_funeral_wreath_col", "Colorable Memorial Flower Wreath", ["funeral", "graveyard", "flower"], "flower_pot", 1, 1.1, False),
        ("col_bouquet_wrap", "Colorable Ribbon Flower Bouquet", ["tea", "festival", "funeral", "flower"], "flower_pot", 2, 0.65, False),
        ("col_window_box_flowers", "Colorable Flower Planter Box", ["street", "bakery", "home", "flower"], "drape", 1, 1.1, True),
        ("col_hedge_block_col", "Colorable Trimmed Topiary Bush", ["garden", "mansion", "park", "bush"], "bush_red", 2, 1.3, True),
        ("col_moss_patch_col", "Colorable Forest Floor Moss Patch", ["nature", "forest", "swamp", "decal"], "bush_red", 1, 1.4, False),
        ("col_autumn_leaf_pile", "Colorable Fallen Leaf Pile", ["nature", "autumn", "forest", "decal"], "bush_red", 3, 1.3, False),
        ("col_herb_patch", "Colorable Apothecary Herb Patch", ["apothecary", "garden", "farm", "nature"], "flower_pot", 0, 1.0, False),
        ("col_bonsai_pot", "Colorable Ceramic Bonsai Planter", ["tea", "study", "mansion", "plant"], "flower_pot", 1, 0.7, True),
        # Market, Fabric & Clothing (14)
        ("col_umbrella_oct", "Colorable Octagonal Market Umbrella", ["market", "tea", "street", "festival"], "umbrella", 0, 2.2, True),
        ("col_umbrella_sq", "Colorable Square Café Patio Umbrella", ["market", "bakery", "tea", "street"], "umbrella", 1, 2.1, True),
        ("col_market_awning", "Colorable Striped Shop Stall Awning", ["market", "bakery", "street"], "tent", 0, 2.4, True),
        ("col_fabric_bolt_a", "Colorable Rolled Cloth Bolt", ["market", "tailor", "fabric", "clutter"], "bolster", 0, 0.85, True),
        ("col_fabric_bolt_b", "Colorable Wide Silk Fabric Roll", ["market", "tailor", "fabric", "clutter"], "bolster", 1, 0.95, True),
        ("col_folded_towels", "Colorable Folded Bath Towel Stack", ["bedroom", "bath", "home", "clutter"], "cushion_square", 0, 0.7, True),
        ("col_folded_linens", "Colorable Folded Laundry Linens", ["bedroom", "home", "clinic", "clutter"], "cushion_square", 1, 0.75, True),
        ("col_travel_cloak", "Colorable Folded Adventurer Cloak", ["camp", "home", "tailor", "clutter"], "drape", 0, 0.85, False),
        ("col_shop_apron", "Colorable Baker / Smith Work Apron", ["bakery", "kitchen", "blacksmith", "clutter"], "drape", 2, 0.8, False),
        ("col_hat_brimmed", "Colorable Wide-Brimmed Hat", ["home", "tailor", "theater", "clutter"], "umbrella", 0, 0.5, False),
        ("col_ribbon_spool", "Colorable Tailor Ribbon Spool", ["market", "tailor", "clutter"], "stool", 0, 0.4, False),
        ("col_yarn_skein", "Colorable Knitter Yarn Ball", ["home", "tailor", "clutter"], "cushion_round", 0, 0.4, False),
        ("col_wall_tapestry", "Colorable Woven Tapestry Roll", ["mansion", "castle", "temple", "fabric"], "bolster", 0, 1.3, True),
        ("col_pastry_box_col", "Colorable Bakery Ribbon Cake Box", ["bakery", "tea", "market", "clutter"], "box", 0, 0.7, True),
        # Heraldry, Ritual & Fantasy (18)
        ("col_shield_round", "Colorable Heraldic Round Shield", ["armory", "castle", "shield", "clutter"], "shield", 0, 0.8, True),
        ("col_shield_heater", "Colorable Heraldic Heater Shield", ["armory", "castle", "shield", "clutter"], "shield", 1, 0.85, True),
        ("col_banner_swallowtail", "Colorable Castle Swallowtail Banner", ["castle", "temple", "festival", "banner"], "banner", 0, 1.4, False),
        ("col_pennant_flag", "Colorable Triangular Festival Pennant", ["festival", "camp", "castle", "banner"], "banner", 1, 1.1, False),
        ("col_candle_pillar", "Colorable Single Wax Pillar Candle", ["temple", "funeral", "study", "candle", "light"], "candle", 0, 0.4, False),
        ("col_candle_cluster", "Colorable Wax Candle Cluster (3)", ["temple", "funeral", "mansion", "candle", "light"], "candle", 1, 0.6, False),
        ("col_arcane_circle", "Colorable Arcane Summoning Circle", ["arcane", "dungeon", "temple", "magic", "decal"], "rune", 0, 2.8, False),
        ("col_magic_rune_sm", "Colorable Floor Spell Rune (Small)", ["arcane", "dungeon", "magic", "decal"], "rune", 1, 1.4, False),
        ("col_portal_vortex", "Colorable Arcane Teleport Vortex", ["arcane", "dungeon", "magic", "decal"], "rune", 2, 2.4, False),
        ("col_crystal_cluster_a", "Colorable Cavern Crystal Cluster A", ["mining", "cavern", "arcane", "crystal"], "crystal", 0, 1.2, True),
        ("col_crystal_cluster_b", "Colorable Cavern Crystal Cluster B", ["mining", "cavern", "arcane", "crystal"], "crystal", 1, 1.4, True),
        ("col_crystal_shard", "Colorable Tabletop Magic Crystal", ["alchemy", "arcane", "study", "crystal", "clutter"], "crystal", 2, 0.55, False),
        ("col_gemstone_cut", "Colorable Faceted Treasure Gemstone", ["treasure", "bank", "dungeon", "clutter"], "crystal", 3, 0.4, False),
        ("col_ritual_chalk", "Colorable Ritual Chalk Ring", ["arcane", "temple", "funeral", "decal"], "rune", 0, 2.2, False),
        ("col_wax_seal_pool", "Colorable Melted Candle Wax Pool", ["study", "funeral", "dungeon", "decal"], "candle", 0, 0.5, False),
        ("col_guild_crest", "Colorable Guildhall Crest Emblem", ["courtroom", "castle", "temple", "decal"], "shield", 1, 1.1, False),
        ("col_tournament_flag", "Colorable Jousting Camp Banner", ["camp", "festival", "castle", "banner"], "banner", 0, 1.3, True),
        ("col_alchemy_circle", "Colorable Alchemical Transmutation Circle", ["alchemy", "arcane", "magic", "decal"], "rune", 1, 2.5, False),
        # Modular Roof Pieces & Tents (16)
        ("col_roof_tile_straight", "Colorable Modular Roof Segment (Straight)", ["roof", "street", "modular"], "roof", 0, 2.0, True),
        ("col_roof_tile_corner", "Colorable Modular Roof Corner (Hip)", ["roof", "street", "modular"], "roof", 1, 2.0, True),
        ("col_roof_tile_ridge", "Colorable Modular Roof Ridge Cap", ["roof", "street", "modular"], "roof", 2, 2.0, True),
        ("col_roof_tile_large", "Colorable Modular Roof Block (Large)", ["roof", "mansion", "modular"], "roof", 0, 3.0, True),
        ("col_tent_small", "Colorable Small Camp Pyramid Tent", ["camp", "wilderness", "tent"], "tent", 0, 2.1, True),
        ("col_tent_medium", "Colorable Medium Expedition Ridge Tent", ["camp", "wilderness", "tent"], "tent", 1, 2.6, True),
        ("col_tent_pavilion", "Colorable Grand Tournament Pavilion", ["camp", "festival", "castle", "tent"], "umbrella", 0, 3.4, True),
        ("col_painted_sign", "Colorable Wooden Hanging Shop Sign", ["market", "bakery", "tavern", "sign"], "box", 0, 0.9, True),
        ("col_painted_shutter", "Colorable Wooden Window Shutter", ["home", "bakery", "street"], "roof", 0, 0.85, False),
        ("col_painted_crate", "Colorable Painted Wooden Storage Crate", ["market", "docks", "crate", "storage"], "box", 1, 1.1, True),
        ("col_painted_barrel", "Colorable Painted Wooden Barrel", ["tavern", "market", "docks", "barrel"], "stool", 0, 1.0, True),
        ("col_awning_corner", "Colorable Corner Market Canopy", ["market", "street", "roof"], "roof", 1, 2.0, True),
        ("col_wagon_canopy", "Colorable Covered Wagon Canvas Top", ["camp", "farm", "market", "cart"], "tent", 0, 2.8, True),
        ("col_gazebo_roof", "Colorable Garden Gazebo Octagon Roof", ["garden", "park", "tea", "roof"], "umbrella", 0, 3.2, True),
        ("col_circus_canopy", "Colorable Festival Carnival Booth Top", ["festival", "market", "roof"], "umbrella", 1, 2.8, True),
        ("col_dormer_roof", "Colorable Roof Dormer Window Cap", ["roof", "home", "street"], "roof", 2, 1.4, True),
        # Tableware & Ceramics (14)
        ("col_plate_ceramic", "Colorable Ceramic Dinner Plate", ["kitchen", "tavern", "tea", "tableware", "clutter"], "ceramic", 0, 0.45, False),
        ("col_bowl_soup", "Colorable Glazed Ceramic Bowl", ["kitchen", "tavern", "tableware", "clutter"], "ceramic", 1, 0.42, False),
        ("col_teacup_saucer", "Colorable Porcelain Teacup & Saucer", ["tea", "bakery", "home", "tableware", "clutter"], "ceramic", 1, 0.36, False),
        ("col_serving_platter", "Colorable Glazed Serving Platter", ["kitchen", "tavern", "bakery", "clutter"], "ceramic", 0, 0.7, False),
        ("col_ceramic_vase", "Colorable Painted Floor Vase", ["mansion", "home", "temple", "clutter"], "ceramic", 1, 0.65, True),
        ("col_memorial_urn_col", "Colorable Glazed Memorial Urn", ["funeral", "temple", "mansion", "urn"], "ceramic", 0, 0.7, True),
        ("col_enamel_basin", "Colorable Enamel Wash Basin", ["doctor", "clinic", "bath", "home", "clutter"], "ceramic", 0, 0.65, False),
        ("col_painted_bucket", "Colorable Enamel Household Bucket", ["home", "farm", "kitchen", "bucket"], "ceramic", 1, 0.75, True),
        ("col_cake_frosted", "Colorable Frosted Celebration Cake", ["bakery", "tea", "festival", "food", "clutter"], "ceramic", 0, 0.6, False),
        ("col_enamel_kettle", "Colorable Enamel Tea Kettle", ["kitchen", "tea", "home", "clutter"], "ceramic", 1, 0.5, True),
        ("col_spice_bowl_col", "Colorable Glazed Spice Bowl", ["kitchen", "market", "apothecary", "clutter"], "ceramic", 1, 0.38, False),
        ("col_soup_tureen", "Colorable Lidded Ceramic Soup Tureen", ["kitchen", "mansion", "tavern", "clutter"], "ceramic", 0, 0.65, True),
        ("col_paint_tray", "Colorable Ceramic Water Dish", ["school", "theater", "study", "clutter"], "ceramic", 1, 0.4, False),
        ("col_offering_bowl", "Colorable Temple Offering Bowl", ["temple", "chapel", "ritual", "clutter"], "ceramic", 0, 0.55, False),
    ]
    for i, (slug, name, tags, shape, var, cells, shadow) in enumerate(items):
        img = draw_colorable_prop(600 + i, shape, var)
        ppi = max(96, min(420, int(round(img.width / cells))))
        save_asset(
            f"colorable/{slug}.png",
            img,
            name,
            "object",
            tags + ["colorable", "dd_red", "modular"],
            "dd_red",
            ppi,
            shadow,
        )


# ============================================================================
# 7. 138 BARE MODULAR FURNITURE, STORAGE VARIANTS, DECALS & ARCHITECTURE
# ============================================================================

def draw_wood_surface(d: ImageDraw.ImageDraw, rng: random.Random, x0: int, y0: int, x1: int, y1: int, wood: tuple[int, int, int], planks: int = 4, rad: int = 12) -> None:
    d.rounded_rectangle([x0, y0, x1, y1], radius=rad, fill=(*wood, 255), outline=INK, width=7)
    d.line([x0 + 12, y0 + 8, x1 - 12, y0 + 8], fill=shade(wood, 1.16), width=5)
    d.line([x0 + 12, y1 - 8, x1 - 12, y1 - 8], fill=shade(wood, 0.78), width=5)
    ph = (y1 - y0) / max(1, planks)
    for i in range(1, planks):
        py = int(y0 + i * ph)
        d.line([x0 + 6, py, x1 - 6, py], fill=(30, 24, 21, 145), width=3)
    for _ in range(10):
        gy = rng.uniform(y0 + 10, y1 - 10)
        d.line([x0 + 12, gy, x1 - 12, gy], fill=shade(wood, rng.uniform(0.86, 1.1), 85), width=2)


def generate_bare_furniture_matrix() -> None:
    # 4 finishes x 12 atomic bare modular shapes = 48 completely empty furniture pieces
    finishes = [
        ("oak", "Warm Oak", WOOD_OAK, ["tavern", "home", "bakery"]),
        ("walnut", "Dark Walnut", WOOD_WALNUT, ["mansion", "study", "funeral", "courtroom"]),
        ("pine", "Light Pine", WOOD_PINE, ["kitchen", "school", "farm", "market"]),
        ("birch", "Whitewashed Birch", WOOD_WHITE, ["doctor", "clinic", "bakery", "tea"]),
    ]
    shapes: list[tuple[str, str, int, int, float]] = [
        ("sq_table", "Bare Square Table", 224, 224, 1.4),
        ("round_table", "Bare Round Café Table", 224, 224, 1.4),
        ("dining_table", "Bare Rectangular Dining Table", 320, 192, 2.2),
        ("banquet_table", "Bare Long Banquet Table", 384, 160, 2.8),
        ("study_desk", "Bare Study Desk", 288, 176, 1.9),
        ("straight_counter", "Bare Straight Shop Counter", 352, 128, 2.2),
        ("l_counter", "Bare L-Shaped Counter", 288, 288, 2.2),
        ("bench", "Bare Wooden Bench", 288, 112, 1.8),
        ("stool", "Bare Wooden Stool", 144, 144, 0.75),
        ("shelf", "Bare Wall Sideboard Shelf", 288, 112, 1.8),
        ("pedestal", "Bare Square Display Pedestal", 160, 160, 0.95),
        ("side_table", "Bare Small End Table", 160, 160, 0.95),
    ]
    seed = 900
    for f_slug, f_name, rgb, f_tags in finishes:
        for s_slug, s_name, w, h, cells in shapes:
            seed += 1
            rng = random.Random(seed)
            im, d = make_ss(w, h)
            SW, SH = w * 2, h * 2
            pad = 22
            if s_slug == "round_table" or s_slug == "stool":
                d.ellipse([pad, pad, SW - pad, SH - pad], fill=(*rgb, 255), outline=INK, width=7)
                d.arc([pad + 10, pad + 10, SW - pad - 10, SH - pad - 10], 200, 340, fill=shade(rgb, 1.15), width=5)
                for y in range(pad + 44, SH - pad - 24, 48):
                    dy = y - SH / 2
                    r = (SW / 2 - pad)
                    if abs(dy) < r - 8:
                        dx = math.sqrt(r * r - dy * dy) - 6
                        d.line([SW / 2 - dx, y, SW / 2 + dx, y], fill=(30, 24, 21, 130), width=3)
            elif s_slug == "l_counter":
                arm = 164
                pts = [(pad, pad), (SW - pad, pad), (SW - pad, SW - pad), (SW - pad - arm, SW - pad), (SW - pad - arm, pad + arm), (pad, pad + arm)]
                d.polygon(pts, fill=(*rgb, 255), outline=INK)
                d.line(pts + [pts[0]], fill=INK, width=7)
                d.line([SW - pad - arm, pad + arm, SW - pad, pad], fill=(30, 24, 21, 150), width=4)
            elif s_slug == "study_desk":
                draw_wood_surface(d, rng, pad, pad, SW - pad, SH - pad, rgb, planks=4)
                # Subtle empty bevelled inset border (no clutter!)
                d.rounded_rectangle([pad + 34, pad + 26, SW - pad - 34, SH - pad - 26], radius=8, fill=shade(rgb, 0.92), outline=(30, 24, 21, 120), width=3)
            elif s_slug == "pedestal":
                draw_wood_surface(d, rng, pad, pad, SW - pad, SH - pad, rgb, planks=2, rad=8)
                d.rounded_rectangle([pad + 26, pad + 26, SW - pad - 26, SH - pad - 26], radius=6, fill=shade(rgb, 1.07), outline=INK, width=4)
            else:
                planks = 2 if h <= 128 else 4
                draw_wood_surface(d, rng, pad, pad, SW - pad, SH - pad, rgb, planks=planks)
            out = finish_ss(im, w, h, seed, grain=5)
            ppi = max(96, min(320, int(round(max(w, h) / cells))))
            save_asset(
                f"modular/bare_{f_slug}_{s_slug}.png",
                out,
                f"{f_name} {s_name}",
                "object",
                ["bare", "furniture", s_slug.split("_")[-1]] + f_tags,
                "normal",
                ppi,
                True,
            )


def generate_containers_decals_arch() -> None:
    # A. 36 Individual Storage Containers & Variants
    containers: list[tuple[str, str, list[str], str, tuple[int, int, int], tuple[int, int, int] | None, float]] = [
        ("crate_oak_sm", "Small Closed Oak Crate", ["crate", "storage", "market", "docks"], "crate_closed", WOOD_OAK, None, 0.85),
        ("crate_oak_md", "Medium Closed Oak Crate", ["crate", "storage", "market", "docks"], "crate_closed", WOOD_OAK, None, 1.15),
        ("crate_oak_lg", "Large Heavy Oak Cargo Crate", ["crate", "storage", "docks", "warehouse"], "crate_closed", WOOD_OAK, None, 1.45),
        ("crate_walnut_iron", "Iron-Bound Dark Wood Crate", ["crate", "storage", "armory", "docks"], "crate_iron", WOOD_WALNUT, IRON, 1.2),
        ("crate_pine_slatted", "Slatted Pine Produce Crate", ["crate", "storage", "farm", "market"], "crate_slat", WOOD_PINE, None, 1.1),
        ("crate_open_empty_oak", "Open Empty Wooden Crate (Oak)", ["crate", "storage", "bare", "market"], "crate_open", WOOD_OAK, (86, 58, 36), 1.1),
        ("crate_open_empty_pine", "Open Empty Wooden Crate (Pine)", ["crate", "storage", "bare", "bakery"], "crate_open", WOOD_PINE, (118, 88, 52), 1.0),
        ("crate_open_straw", "Open Crate Packed with Straw", ["crate", "farm", "market", "docks"], "crate_open", WOOD_OAK, (212, 182, 98), 1.1),
        ("crate_open_coal", "Open Crate of Forge Coal", ["crate", "blacksmith", "mining"], "crate_open", WOOD_WALNUT, (44, 46, 52), 1.1),
        ("crate_open_ice", "Open Crate of Packed Ice", ["crate", "kitchen", "docks", "market"], "crate_open", WOOD_PINE, (186, 224, 240), 1.1),
        ("crate_white_medical", "Whitewashed Clinic Supply Crate", ["crate", "doctor", "clinic"], "crate_iron", WOOD_WHITE, (176, 56, 56), 1.05),
        ("crate_post_parcel", "Stamped Postal Shipping Crate", ["crate", "post_office", "docks"], "crate_iron", WOOD_PINE, BRASS, 1.1),
        ("barrel_oak_closed", "Closed Oak Barrel", ["barrel", "storage", "tavern", "docks"], "barrel_closed", WOOD_OAK, IRON, 1.0),
        ("barrel_walnut_closed", "Closed Dark Wine Barrel", ["barrel", "storage", "tavern", "mansion"], "barrel_closed", WOOD_WALNUT, IRON, 1.05),
        ("barrel_pine_sm", "Small Pine Ale Keg", ["barrel", "tavern", "camp"], "barrel_closed", WOOD_PINE, IRON, 0.8),
        ("barrel_open_water", "Open Rainwater Barrel", ["barrel", "farm", "blacksmith", "street"], "barrel_open", WOOD_OAK, (86, 152, 178), 1.05),
        ("barrel_open_flour", "Open White Flour Barrel", ["barrel", "bakery", "kitchen", "pantry"], "barrel_open", WOOD_PINE, (238, 232, 218), 1.05),
        ("barrel_open_grain", "Open Golden Grain Barrel", ["barrel", "farm", "market", "pantry"], "barrel_open", WOOD_OAK, (214, 178, 92), 1.05),
        ("barrel_open_brine", "Open Pickling Brine Barrel", ["barrel", "kitchen", "docks"], "barrel_open", WOOD_WALNUT, (98, 128, 84), 1.0),
        ("barrel_open_empty", "Open Empty Wooden Barrel", ["barrel", "storage", "bare"], "barrel_open", WOOD_OAK, (66, 46, 32), 1.0),
        ("barrel_lying_oak", "Horizontal Lying Oak Wine Cask", ["barrel", "tavern", "cellar"], "barrel_side", WOOD_OAK, IRON, 1.45),
        ("barrel_lying_dark", "Horizontal Lying Dark Ale Cask", ["barrel", "tavern", "docks"], "barrel_side", WOOD_WALNUT, IRON, 1.5),
        ("sack_burlap_sm", "Small Tied Burlap Sack", ["sack", "storage", "farm", "market"], "sack", (178, 152, 114), None, 0.75),
        ("sack_burlap_lg", "Large Heavy Burlap Sack", ["sack", "storage", "farm", "docks"], "sack", (164, 138, 102), None, 1.05),
        ("sack_flour_white", "White Linen Baker Flour Sack", ["sack", "bakery", "kitchen"], "sack", (226, 220, 206), None, 0.9),
        ("sack_coal_dark", "Sooty Canvas Coal Sack", ["sack", "blacksmith", "mining"], "sack", (82, 78, 76), None, 0.9),
        ("sack_mail_canvas", "Canvas Post Office Mail Sack", ["sack", "post_office", "bank"], "sack", (188, 174, 142), (168, 56, 52), 0.95),
        ("sack_coin_pouch", "Heavy Canvas Bank Coin Sack", ["sack", "bank", "treasure"], "sack", (196, 178, 136), BRASS, 0.65),
        ("basket_empty_round", "Empty Round Wicker Basket", ["basket", "bare", "market", "home"], "basket", (182, 142, 86), (112, 82, 48), 0.85),
        ("basket_empty_oval", "Empty Oval Harvest Basket", ["basket", "bare", "farm", "bakery"], "basket", (174, 132, 78), (104, 76, 42), 0.95),
        ("basket_bread_cloth", "Cloth-Lined Bakery Basket", ["basket", "bakery", "kitchen"], "basket", (186, 146, 92), (232, 224, 208), 0.85),
        ("basket_herb_green", "Wicker Basket of Fresh Herbs", ["basket", "apothecary", "doctor", "kitchen"], "basket", (176, 138, 84), (88, 138, 66), 0.85),
        ("chest_wood_sm", "Small Brass-Clasped Wooden Chest", ["chest", "storage", "home", "bedroom"], "chest", WOOD_OAK, BRASS, 1.1),
        ("chest_iron_md", "Heavy Iron-Strapped Dungeon Chest", ["chest", "storage", "dungeon", "armory"], "chest", WOOD_WALNUT, IRON, 1.35),
        ("chest_open_empty", "Open Empty Wooden Storage Chest", ["chest", "storage", "bare"], "crate_open", WOOD_WALNUT, (58, 42, 32), 1.25),
        ("box_apothecary_tray", "Compartmented Apothecary Box", ["doctor", "apothecary", "post_office", "storage"], "crate_open", WOOD_WALNUT, (148, 114, 78), 0.9),
    ]
    for i, (slug, name, tags, kind, c1, c2, cells) in enumerate(containers):
        rng = random.Random(1200 + i)
        W, H = (256, 176) if kind in ("barrel_side", "chest") else (192, 192)
        im, d = make_ss(W, H)
        SW, SH = W * 2, H * 2
        pad = 28
        if kind == "crate_closed":
            draw_wood_surface(d, rng, pad, pad, SW - pad, SH - pad, c1, planks=4, rad=8)
            d.rectangle([pad + 22, pad + 22, SW - pad - 22, SH - pad - 22], outline=INK, width=5)
            d.line([pad + 22, pad + 22, SW - pad - 22, SH - pad - 22], fill=shade(c1, 0.88), width=20)
            d.line([pad + 22, pad + 22, SW - pad - 22, SH - pad - 22], fill=INK, width=5)
        elif kind == "crate_iron":
            draw_wood_surface(d, rng, pad, pad, SW - pad, SH - pad, c1, planks=4, rad=8)
            col = c2 or IRON
            for bx in (pad + 32, SW - pad - 56):
                d.rectangle([bx, pad + 4, bx + 24, SH - pad - 4], fill=(*col, 255), outline=INK, width=4)
        elif kind == "crate_slat":
            d.rectangle([pad, pad, SW - pad, SH - pad], fill=(*shade(c1, 0.55)[:3], 255), outline=INK, width=6)
            for y in range(pad + 14, SH - pad - 24, 62):
                d.rectangle([pad + 8, y, SW - pad - 8, y + 40], fill=(*c1, 255), outline=INK, width=4)
        elif kind == "crate_open":
            d.rounded_rectangle([pad, pad, SW - pad, SH - pad], radius=10, fill=(*c1, 255), outline=INK, width=7)
            d.rectangle([pad + 34, pad + 34, SW - pad - 34, SH - pad - 34], fill=(*(c2 or (72, 52, 36)), 255), outline=INK, width=5)
        elif kind == "barrel_closed":
            d.ellipse([pad, pad, SW - pad, SH - pad], fill=(*(c2 or IRON), 255), outline=INK, width=7)
            d.ellipse([pad + 16, pad + 16, SW - pad - 16, SH - pad - 16], fill=(*c1, 255), outline=INK, width=6)
            for y in range(pad + 64, SH - pad - 44, 52):
                d.line([pad + 44, y, SW - pad - 44, y], fill=INK, width=4)
            d.ellipse([SW // 2 + 34, SH // 2 - 14, SW // 2 + 62, SH // 2 + 14], fill=shade(c1, 0.72), outline=INK, width=4)
        elif kind == "barrel_open":
            d.ellipse([pad, pad, SW - pad, SH - pad], fill=(*IRON, 255), outline=INK, width=7)
            d.ellipse([pad + 14, pad + 14, SW - pad - 14, SH - pad - 14], fill=(*c1, 255), outline=INK, width=6)
            d.ellipse([pad + 34, pad + 34, SW - pad - 34, SH - pad - 34], fill=(*(c2 or (66, 46, 32)), 255), outline=INK, width=5)
        elif kind == "barrel_side":
            d.rounded_rectangle([pad, pad + 18, SW - pad, SH - pad - 18], radius=48, fill=(*c1, 255), outline=INK, width=7)
            for hx in (pad + 48, SW // 2 - 14, SW - pad - 72):
                d.rectangle([hx, pad + 20, hx + 24, SH - pad - 20], fill=(*(c2 or IRON), 255), outline=INK, width=4)
        elif kind == "sack":
            d.ellipse([pad + 12, pad + 18, SW - pad - 12, SH - pad - 12], fill=(*c1, 255), outline=INK, width=7)
            d.ellipse([SW // 2 - 42, SH // 2 - 42, SW // 2 + 42, SH // 2 + 42], fill=shade(c1, 0.82), outline=INK, width=5)
            d.ellipse([SW // 2 - 18, SH // 2 - 18, SW // 2 + 18, SH // 2 + 18], fill=(*(c2 or (124, 96, 62)), 255), outline=INK, width=4)
        elif kind == "basket":
            d.ellipse([pad, pad, SW - pad, SH - pad], fill=(*c1, 255), outline=INK, width=7)
            d.ellipse([pad + 28, pad + 28, SW - pad - 28, SH - pad - 28], fill=(*(c2 or shade(c1, 0.7)[:3]), 255), outline=INK, width=5)
            for a in range(0, 360, 24):
                rad = math.radians(a)
                d.line([SW // 2 + math.cos(rad) * 130, SH // 2 + math.sin(rad) * 130, SW // 2 + math.cos(rad) * 160, SH // 2 + math.sin(rad) * 160], fill=INK, width=4)
        elif kind == "chest":
            draw_wood_surface(d, rng, pad, pad + 14, SW - pad, SH - pad - 14, c1, planks=4, rad=14)
            col = c2 or BRASS
            for bx in (pad + 48, SW - pad - 76):
                d.rectangle([bx, pad + 14, bx + 28, SH - pad - 14], fill=(*col, 255), outline=INK, width=5)
            d.rounded_rectangle([SW // 2 - 22, SH - pad - 34, SW // 2 + 22, SH - pad + 4], radius=6, fill=(*col, 255), outline=INK, width=4)
        out = finish_ss(im, W, H, 1200 + i, grain=6)
        ppi = max(96, min(320, int(round(max(W, H) / cells))))
        save_asset(f"modular/{slug}.png", out, name, "object", tags + ["modular"], "normal", ppi, True)

    # B. 30 Floor Decals, Scatter & Environmental Multi-Variants (flat, no drop shadow!)
    decals: list[tuple[str, str, list[str], str, tuple[int, int, int], float]] = [
        ("dec_stone_crack_a", "Floor Stone Crack Decal A", ["decal", "dungeon", "street", "stone"], "crack", (42, 38, 36), 1.4),
        ("dec_stone_crack_b", "Floor Stone Crack Decal B", ["decal", "dungeon", "graveyard", "stone"], "crack", (46, 42, 40), 1.6),
        ("dec_stone_crack_moss", "Mossy Floor Crack Decal", ["decal", "dungeon", "garden", "moss"], "crack", (76, 108, 56), 1.5),
        ("dec_wood_scuff_a", "Wood Floor Wear Scuffs A", ["decal", "tavern", "home", "wood"], "scatter", (82, 58, 40), 1.3),
        ("dec_wood_scuff_b", "Wood Floor Wear Scuffs B", ["decal", "workshop", "barn", "wood"], "scatter", (96, 68, 46), 1.4),
        ("dec_water_puddle_sm", "Clear Water Puddle (Small)", ["decal", "water", "street", "docks"], "puddle", (92, 152, 182), 1.0),
        ("dec_water_puddle_lg", "Clear Water Puddle (Large)", ["decal", "water", "alley", "sewer"], "puddle", (78, 138, 168), 1.6),
        ("dec_mud_splash_a", "Muddy Footprint Splash A", ["decal", "farm", "camp", "street"], "puddle", (104, 78, 54), 1.1),
        ("dec_mud_splash_b", "Deep Mud Mire Splash B", ["decal", "swamp", "farm", "camp"], "puddle", (86, 64, 44), 1.5),
        ("dec_blood_spatter", "Crimson Battle Spatter", ["decal", "dungeon", "doctor", "alley"], "puddle", (142, 24, 24), 1.0),
        ("dec_blood_trail", "Crimson Drag Trail Decal", ["decal", "dungeon", "alley", "crime"], "scatter", (134, 22, 22), 1.4),
        ("dec_scorch_sm", "Small Charred Scorch Mark", ["decal", "blacksmith", "dungeon", "fire"], "puddle", (44, 40, 38), 1.1),
        ("dec_scorch_blast", "Arcane Fireball Scorch Blast", ["decal", "dungeon", "arcane", "fire"], "puddle", (38, 34, 34), 2.0),
        ("dec_ash_soot_pile", "Hearth Ash & Soot Scatter", ["decal", "blacksmith", "camp", "hearth"], "puddle", (112, 110, 108), 1.2),
        ("dec_autumn_leaves_a", "Scattered Autumn Leaves A", ["decal", "nature", "autumn", "forest"], "leaves", (196, 98, 42), 1.3),
        ("dec_autumn_leaves_b", "Scattered Golden Leaves B", ["decal", "nature", "autumn", "park"], "leaves", (218, 164, 52), 1.4),
        ("dec_green_leaves_a", "Fallen Green Foliage Scatter", ["decal", "nature", "forest", "garden"], "leaves", (86, 134, 62), 1.3),
        ("dec_cherry_petals", "Scattered Pink Blossom Petals", ["decal", "nature", "garden", "tea"], "leaves", (242, 178, 198), 1.3),
        ("dec_pebbles_a", "Fine Gravel & Pebble Scatter A", ["decal", "nature", "cavern", "street"], "scatter", (138, 134, 128), 1.2),
        ("dec_pebbles_b", "Dark Cave Pebble Scatter B", ["decal", "cavern", "mining", "dungeon"], "scatter", (88, 90, 96), 1.3),
        ("dec_rubble_chips_a", "Broken Stone Chips Scatter", ["decal", "dungeon", "ruin", "stone"], "scatter", (128, 124, 118), 1.4),
        ("dec_rubble_brick_b", "Crumbled Brick Debris Scatter", ["decal", "alley", "ruin", "brick"], "scatter", (162, 86, 62), 1.4),
        ("dec_cobweb_corner", "Dusty Corner Cobweb Decal", ["decal", "dungeon", "funeral", "cellar"], "web", (220, 220, 218), 1.3),
        ("dec_cobweb_span", "Wide Hanging Cobweb Decal", ["decal", "dungeon", "cavern"], "web", (214, 216, 214), 1.6),
        ("dec_chalk_marks", "Chalk Investigation Marks", ["decal", "alley", "school", "arcane"], "crack", (234, 232, 224), 1.2),
        ("dec_oil_stain", "Dark Workshop Oil Stain", ["decal", "blacksmith", "sewer", "alley"], "puddle", (42, 44, 48), 1.2),
        ("dec_wax_drips", "Melted Cream Candle Wax Drips", ["decal", "temple", "funeral", "study"], "puddle", (236, 226, 198), 0.7),
        ("dec_straw_scatter_a", "Scattered Barn Straw Wisps A", ["decal", "farm", "stable", "barn"], "leaves", (216, 184, 98), 1.4),
        ("dec_flour_spill", "Spilled White Bakery Flour Dust", ["decal", "bakery", "kitchen"], "puddle", (244, 240, 230), 1.1),
        ("dec_sawdust_pile", "Carpenter Wood Sawdust Scatter", ["decal", "workshop", "blacksmith", "wood"], "puddle", (198, 162, 108), 1.1),
    ]
    for i, (slug, name, tags, kind, col, cells) in enumerate(decals):
        rng = random.Random(1400 + i)
        W, H = 200, 200
        im, d = make_ss(W, H)
        S = W * 2
        cx, cy = S // 2, S // 2
        if kind == "puddle":
            for _ in range(9):
                rx, ry = rng.uniform(36, 98), rng.uniform(32, 88)
                px, py = cx + rng.uniform(-56, 56), cy + rng.uniform(-56, 56)
                d.ellipse([px - rx, py - ry, px + rx, py + ry], fill=(*col, 175), outline=(30, 24, 21, 95), width=4)
            d.ellipse([cx - 48, cy - 42, cx + 18, cy + 12], fill=shade(col, 1.25, 110))
        elif kind == "crack":
            x, y = 46, cy + rng.randint(-40, 40)
            pts = [(x, y)]
            for _ in range(7):
                x += rng.randint(36, 54)
                y += rng.randint(-44, 44)
                pts.append((min(S - 36, x), max(36, min(S - 36, y))))
            d.line(pts, fill=(*col, 220), width=6)
            for p in pts[2:5]:
                d.line([p, (p[0] + rng.randint(-45, 45), p[1] + rng.randint(-55, 55))], fill=(*col, 190), width=4)
        elif kind == "leaves":
            for _ in range(28):
                lx, ly = cx + rng.uniform(-125, 125), cy + rng.uniform(-125, 125)
                rx, ry = rng.uniform(10, 22), rng.uniform(6, 13)
                d.ellipse([lx - rx, ly - ry, lx + rx, ly + ry], fill=jitter_rgb(rng, col, 22), outline=(30, 24, 21, 140), width=3)
        elif kind == "scatter":
            for _ in range(24):
                lx, ly = cx + rng.uniform(-125, 125), cy + rng.uniform(-125, 125)
                r = rng.uniform(8, 22)
                d.ellipse([lx - r, ly - r * 0.8, lx + r, ly + r * 0.8], fill=jitter_rgb(rng, col, 16), outline=(30, 24, 21, 130), width=3)
        elif kind == "web":
            ox, oy = 32, 32
            for a in range(5, 90, 14):
                rad = math.radians(a)
                d.line([ox, oy, ox + math.cos(rad) * 330, oy + math.sin(rad) * 330], fill=(160, 160, 162, 195), width=3)
            for r in range(60, 320, 48):
                d.arc([ox - r, oy - r, ox + r, oy + r], 0, 90, fill=(170, 170, 174, 175), width=3)
        out = finish_ss(im, W, H, 1400 + i, grain=3)
        ppi = max(96, min(320, int(round(W / cells))))
        save_asset(f"modular/{slug}.png", out, name, "object", tags + ["modular"], "normal", ppi, False)

    # C. 24 Modular Architecture, Stairs, Bridges & Graveyard Variants
    arch: list[tuple[str, str, list[str], str, tuple[int, int, int], int, int, float]] = [
        ("arch_stairs_wood_narrow", "Modular Wooden Stairs (Narrow)", ["stairs", "home", "tavern", "modular"], "stairs", WOOD_OAK, 160, 256, 1.8),
        ("arch_stairs_wood_wide", "Modular Wooden Stairs (Wide)", ["stairs", "mansion", "school", "modular"], "stairs", WOOD_WALNUT, 256, 256, 2.2),
        ("arch_stairs_stone_narrow", "Modular Stone Dungeon Stairs (Narrow)", ["stairs", "dungeon", "crypt", "modular"], "stairs", STONE_DARK, 160, 256, 1.8),
        ("arch_stairs_stone_wide", "Modular Grand Marble Stairs (Wide)", ["stairs", "temple", "courtroom", "castle", "modular"], "stairs", STONE_LIGHT, 256, 256, 2.4),
        ("arch_spiral_wood", "Modular Wooden Spiral Staircase", ["stairs", "tavern", "home", "modular"], "spiral", WOOD_OAK, 240, 240, 2.2),
        ("arch_spiral_stone", "Modular Stone Spiral Staircase", ["stairs", "castle", "dungeon", "modular"], "spiral", STONE_DARK, 240, 240, 2.2),
        ("arch_trapdoor_wood_closed", "Wooden Floor Trapdoor Hatch (Closed)", ["dungeon", "home", "tavern", "stairs"], "hatch", WOOD_OAK, 176, 176, 1.2),
        ("arch_trapdoor_wood_open", "Open Wooden Cellar Trapdoor & Ladder", ["dungeon", "home", "tavern", "stairs"], "hatch_open", WOOD_OAK, 176, 176, 1.2),
        ("arch_iron_grate_sq", "Square Iron Dungeon Floor Grate", ["dungeon", "sewer", "prison", "iron"], "grate", IRON, 176, 176, 1.2),
        ("arch_iron_grate_rd", "Round Iron Sewer Drain Grate", ["sewer", "street", "dungeon", "iron"], "grate_rd", IRON, 176, 176, 1.1),
        ("arch_pillar_round_stone", "Round Carved Stone Column Pillar", ["temple", "dungeon", "castle", "stone"], "pillar_rd", STONE_LIGHT, 160, 160, 1.1),
        ("arch_pillar_square_stone", "Square Dressed Stone Pillar", ["dungeon", "castle", "courtroom", "stone"], "pillar_sq", STONE_DARK, 160, 160, 1.1),
        ("arch_pillar_broken", "Broken Crumbled Stone Column", ["dungeon", "ruin", "temple", "stone"], "pillar_rd", (134, 132, 126), 160, 160, 1.2),
        ("arch_timber_post", "Heavy Square Timber Support Post", ["tavern", "barn", "mining", "wood"], "pillar_sq", WOOD_WALNUT, 128, 128, 0.7),
        ("arch_bridge_timber", "Modular Timber Footbridge Segment", ["bridge", "docks", "camp", "wilderness"], "bridge", WOOD_OAK, 288, 192, 2.4),
        ("arch_bridge_stone", "Modular Stone Bridge Deck Segment", ["bridge", "street", "garden", "castle"], "bridge", STONE_LIGHT, 288, 192, 2.4),
        ("arch_wooden_ladder", "Modular Wooden Ladder Segment", ["stairs", "barn", "dungeon", "mining"], "ladder", WOOD_OAK, 128, 256, 1.8),
        ("arch_grave_headstone_rd", "Simple Rounded Stone Headstone", ["funeral", "graveyard", "tombstone", "stone"], "tomb", STONE_LIGHT, 160, 128, 1.0),
        ("arch_grave_headstone_pt", "Pointed Gothic Stone Headstone", ["funeral", "graveyard", "tombstone", "stone"], "tomb", STONE_DARK, 160, 128, 1.0),
        ("arch_grave_cross_wood", "Weathered Wooden Grave Marker Cross", ["funeral", "graveyard", "camp", "wood"], "cross", WOOD_WALNUT, 144, 144, 0.9),
        ("arch_grave_plaque", "Flat Bronze Cemetery Memorial Plaque", ["funeral", "graveyard", "temple", "brass"], "pillar_sq", BRASS, 160, 128, 0.9),
        ("arch_stepping_cluster", "Garden Flagstone Stepping Cluster", ["garden", "park", "graveyard", "stone"], "steps_cluster", STONE_LIGHT, 224, 176, 1.5),
        ("arch_street_manhole", "Round Cast-Iron Street Manhole Cover", ["street", "alley", "sewer", "iron"], "grate_rd", (74, 78, 84), 160, 160, 1.0),
        ("arch_fireplace_hearth", "Simple Stone Wall Hearth Base", ["home", "tavern", "kitchen", "hearth"], "bridge", STONE_DARK, 240, 144, 1.8),
    ]
    for i, (slug, name, tags, kind, col, w, h, cells) in enumerate(arch):
        rng = random.Random(1600 + i)
        im, d = make_ss(w, h)
        SW, SH = w * 2, h * 2
        pad = 22
        if kind == "stairs":
            steps = 8
            sh = (SH - pad * 2) / steps
            for s in range(steps):
                y0 = int(pad + s * sh)
                y1 = int(pad + (s + 1) * sh)
                f = 0.72 + (s / steps) * 0.38
                d.rectangle([pad + 18, y0, SW - pad - 18, y1], fill=shade(col, f), outline=INK, width=5)
            d.rectangle([pad, pad, pad + 24, SH - pad], fill=shade(col, 0.85), outline=INK, width=5)
            d.rectangle([SW - pad - 24, pad, SW - pad, SH - pad], fill=shade(col, 0.85), outline=INK, width=5)
        elif kind == "spiral":
            cx, cy = SW // 2, SH // 2
            r = min(SW, SH) // 2 - pad
            steps = 12
            for s in range(steps):
                a0, a1 = (s / steps) * math.tau, ((s + 1) / steps) * math.tau
                f = 0.74 + (s / steps) * 0.34
                d.polygon(
                    [(cx, cy), (cx + math.cos(a0) * r, cy + math.sin(a0) * r), (cx + math.cos(a1) * r, cy + math.sin(a1) * r)],
                    fill=shade(col, f),
                    outline=INK,
                )
            d.ellipse([cx - 38, cy - 38, cx + 38, cy + 38], fill=shade(col, 0.72), outline=INK, width=6)
        elif kind == "hatch":
            draw_wood_surface(d, rng, pad, pad, SW - pad, SH - pad, col, planks=4, rad=8)
            d.rectangle([pad + 14, pad + 14, SW - pad - 14, SH - pad - 14], outline=INK, width=5)
            d.ellipse([SW // 2 - 22, SH - pad - 62, SW // 2 + 22, SH - pad - 18], outline=(*IRON, 255), width=8)
        elif kind == "hatch_open":
            d.rectangle([pad, pad, SW - pad, SH - pad], fill=(*col, 255), outline=INK, width=7)
            d.rectangle([pad + 26, pad + 26, SW - pad - 26, SH - pad - 26], fill=(20, 18, 18, 255), outline=INK, width=6)
            for ry in range(pad + 56, SH - pad - 36, 48):
                d.rectangle([pad + 54, ry, SW - pad - 54, ry + 14], fill=(*WOOD_PINE, 255), outline=INK, width=3)
        elif kind == "grate":
            d.rectangle([pad, pad, SW - pad, SH - pad], fill=(22, 24, 28, 235), outline=INK, width=7)
            for x in range(pad + 34, SW - pad, 42):
                d.rectangle([x - 8, pad, x + 8, SH - pad], fill=(*col, 255), outline=INK, width=4)
            d.rectangle([pad, SH // 2 - 10, SW - pad, SH // 2 + 10], fill=(*col, 255), outline=INK, width=4)
        elif kind == "grate_rd":
            d.ellipse([pad, pad, SW - pad, SH - pad], fill=(*col, 255), outline=INK, width=7)
            d.ellipse([pad + 26, pad + 26, SW - pad - 26, SH - pad - 26], fill=(32, 34, 38, 255), outline=INK, width=5)
            for a in range(0, 180, 30):
                rad = math.radians(a)
                r = SW // 2 - pad - 26
                d.line([SW // 2 - math.cos(rad) * r, SH // 2 - math.sin(rad) * r, SW // 2 + math.cos(rad) * r, SH // 2 + math.sin(rad) * r], fill=(*col, 255), width=12)
        elif kind == "pillar_rd":
            d.ellipse([pad, pad, SW - pad, SH - pad], fill=(*col, 255), outline=INK, width=7)
            d.ellipse([pad + 26, pad + 26, SW - pad - 26, SH - pad - 26], fill=shade(col, 1.12), outline=INK, width=5)
        elif kind == "pillar_sq":
            d.rounded_rectangle([pad, pad, SW - pad, SH - pad], radius=10, fill=(*col, 255), outline=INK, width=7)
            d.rounded_rectangle([pad + 24, pad + 24, SW - pad - 24, SH - pad - 24], radius=6, fill=shade(col, 1.12), outline=INK, width=4)
        elif kind == "bridge":
            draw_wood_surface(d, rng, pad, pad + 24, SW - pad, SH - pad - 24, col, planks=5, rad=8)
            d.rectangle([pad, pad, SW - pad, pad + 32], fill=shade(col, 0.78), outline=INK, width=5)
            d.rectangle([pad, SH - pad - 32, SW - pad, SH - pad], fill=shade(col, 0.78), outline=INK, width=5)
        elif kind == "ladder":
            d.rectangle([pad + 28, pad, pad + 56, SH - pad], fill=(*col, 255), outline=INK, width=5)
            d.rectangle([SW - pad - 56, pad, SW - pad - 28, SH - pad], fill=(*col, 255), outline=INK, width=5)
            for y in range(pad + 38, SH - pad - 24, 64):
                d.rectangle([pad + 54, y, SW - pad - 54, y + 20], fill=shade(col, 1.08), outline=INK, width=4)
        elif kind == "tomb":
            d.rounded_rectangle([pad + 18, pad + 28, SW - pad - 18, SH - pad - 28], radius=36, fill=(*col, 255), outline=INK, width=7)
            d.rounded_rectangle([pad + 42, pad + 48, SW - pad - 42, SH - pad - 48], radius=18, fill=shade(col, 1.1), outline=INK, width=4)
        elif kind == "cross":
            cx, cy = SW // 2, SH // 2
            d.rectangle([cx - 22, pad + 18, cx + 22, SH - pad - 18], fill=(*col, 255), outline=INK, width=6)
            d.rectangle([pad + 28, cy - 42, SW - pad - 28, cy + 2], fill=(*col, 255), outline=INK, width=6)
        elif kind == "steps_cluster":
            for sx, sy, rx, ry in ((110, 120, 62, 48), (245, 165, 72, 54), (355, 220, 56, 44), (155, 250, 52, 40)):
                d.ellipse([sx - rx, sy - ry, sx + rx, sy + ry], fill=jitter_rgb(rng, col, 12), outline=INK, width=5)
        out = finish_ss(im, w, h, 1600 + i, grain=5)
        ppi = max(96, min(320, int(round(max(w, h) / cells))))
        flat = kind in ("grate", "grate_rd", "hatch", "hatch_open", "steps_cluster")
        save_asset(f"modular/{slug}.png", out, name, "object", tags + ["modular"], "normal", ppi, not flat)


def write_manifest_and_dcpack() -> None:
    manifest = {
        "id": "dicechaos-modular-suite-cc0",
        "name": "DiceChaos Modular World & Everyday Scenes (CC0)",
        "license": "CC0-1.0",
        "artStyle": "Crisp Hand-Inked Tabletop (Orthographic 256 PPI)",
        "assets": MANIFEST_ITEMS,
    }
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.write(manifest_path, "manifest.json")
        for item in MANIFEST_ITEMS:
            fp = OUT_DIR / item["path"]
            if fp.exists():
                zf.write(fp, item["path"])


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ai_count = slice_ai_sheets()
    generate_terrains()
    generate_walls()
    generate_paths()
    generate_portals()
    generate_colorables()
    generate_bare_furniture_matrix()
    generate_containers_decals_arch()
    write_manifest_and_dcpack()

    by_cat: dict[str, int] = {}
    colorable_count = 0
    for it in MANIFEST_ITEMS:
        by_cat[it["category"]] = by_cat.get(it["category"], 0) + 1
        if it["drawMode"] == "dd_red":
            colorable_count += 1

    print(f"Generated {len(MANIFEST_ITEMS)} Modular World CC0 assets ({ai_count} AI-sliced individual props + {len(MANIFEST_ITEMS) - ai_count} studio procedural/colorable assets)!")
    print(f"Breakdown: {by_cat} | Native dd_red Colorables: {colorable_count}")
    print(f"Manifest:  {OUT_DIR / 'manifest.json'}")
    print(f"Pack:      {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()

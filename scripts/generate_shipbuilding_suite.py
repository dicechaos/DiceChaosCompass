#!/usr/bin/env python3
"""
Dice Chaos Compass — Magi-Punk Skyships, Water Boats & Shipbuilding Suite (CC0)
=============================================================================
Generates & slices 212 original CC0 shipbuilding assets in our locked
"Crisp Hand-Inked Tabletop" house art style:
  - 192 individual modular props sliced from 12 hand-inked 4x4 top-down sheets
    (Helm & Nav, Skyship Aether Engines, Masts & Sails, Anchors & Mooring,
     Ship Weapons & Sky-Artillery, Deck Hatches & Fittings, Boats & Boarding,
     Captain's Quarters, Crew & Galley, Shipyard Construction, Cargo Hold,
     Figureheads / Ornaments / Damage)
  - 6 seamless 512x512 Ship & Skyship Deck Terrains (incl. 1 native dd_red colorable)
  - 6 seamless 512x128 Ship Hull & Bulkhead Smart Walls (incl. 1 native dd_red colorable)
  - 5 seamless 512x128 Ship Rigging, Chain, Fuel Pipe & Shipyard Keel Paths
  - 3 carve-ready 256x128 Ship Portals (Brass Cabin Door, Brass Porthole, Gunport Shutter)

Appends/updates:
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

from PIL import Image, ImageChops, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets" / "modular-suite-cc0"
DCPACK_PATH = ROOT / "public" / "assets" / "DiceChaos_Modular_Suite_CC0.dcpack"
SHEET_DIR = pathlib.Path(
    r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae"
)
SCRATCH_DIR = SHEET_DIR / "scratch"

INK = (28, 22, 18, 255)
INK_SOFT = (28, 22, 18, 175)

RD_DARK = (118, 12, 12, 255)
RD_MID = (212, 22, 22, 255)
RD_BRIGHT = (246, 48, 48, 255)
RD_HI = (255, 134, 134, 255)

BRASS = (196, 156, 72)
BRASS_HI = (232, 198, 114)
BRASS_LO = (132, 98, 42)
IRON = (82, 88, 98)
CYAN_AETHER = (62, 226, 248)


def clamp(v: float, lo: int = 0, hi: int = 255) -> int:
    return max(lo, min(hi, int(round(v))))


def shade(rgb: tuple[int, int, int], f: float, a: int = 255) -> tuple[int, int, int, int]:
    return (clamp(rgb[0] * f), clamp(rgb[1] * f), clamp(rgb[2] * f), a)


def jitter(rng: random.Random, rgb: tuple[int, int, int], amt: int = 10, a: int = 255) -> tuple[int, int, int, int]:
    d = rng.randint(-amt, amt)
    return (
        clamp(rgb[0] + d + rng.randint(-3, 3)),
        clamp(rgb[1] + d + rng.randint(-3, 3)),
        clamp(rgb[2] + d + rng.randint(-3, 3)),
        a,
    )


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
        if a > 100:
            rs += r
            gs += g
            bs += b
            n += 1
    if n == 0:
        return "#7C8A9E"
    return f"#{rs // n:02X}{gs // n:02X}{bs // n:02X}"


# ============================================================================
# 1. SMART 4x4 SPRITE SHEET SLICER (Zero-Halo Alpha Keying)
# ============================================================================


def find_grid_cuts_n(sheet: Image.Image, cols: int, rows: int) -> tuple[list[int], list[int]]:
    rgb = sheet.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    def best_cut(axis_len: int, frac: float, is_row: bool) -> int:
        center = int(axis_len * frac)
        span = 0.095
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

    # Optionally clear pure-white interior cutouts (like wheel spokes, rings, ladders, frames!)
    if clear_interior_white:
        for y in range(h):
            for x in range(w):
                idx = y * w + x
                if not bg_mask[idx]:
                    r, g, b, _ = px[x, y]
                    if min(r, g, b) >= 242 and (max(r, g, b) - min(r, g, b)) <= 12:
                        bg_mask[idx] = 1

    # Soft anti-aliased fringe removal along pixels bordering background
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if bg_mask[idx]:
                px[x, y] = (0, 0, 0, 0)
                continue
            r, g, b, _ = px[x, y]
            if min(r, g, b) >= 210 and (max(r, g, b) - min(r, g, b)) <= 22:
                # Check if adjacent to background
                near_bg = False
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if 0 <= nx < w and 0 <= ny < h and bg_mask[ny * w + nx]:
                        near_bg = True
                        break
                if near_bg:
                    lum = (r + g + b) / 3.0
                    alpha = clamp((245.0 - lum) / 42.0 * 255.0)
                    px[x, y] = (clamp(r * 0.85), clamp(g * 0.85), clamp(b * 0.85), alpha)

    cropped = rgba.crop((4, 4, w - 4, h - 4))
    bbox = cropped.getbbox()
    if not bbox:
        return cropped
    # Keep 4px clean transparent padding around tight content bounds
    x0, y0, x1, y1 = bbox
    tight = cropped.crop((x0, y0, x1, y1))
    out = Image.new("RGBA", (tight.width + 8, tight.height + 8), (0, 0, 0, 0))
    out.paste(tight, (4, 4))
    return out


# 12 Hand-Inked 4x4 Sprite Sheets -> 192 Individual Shipbuilding & Airship Props
# Tuple: (slug, displayName, tags, target_cells, casts_shadow, clear_interior_white)
SHIP_SHEETS: list[dict[str, Any]] = [
    {
        "file": "ship_helm_nav_4x4_v3_1795391014692.jpg",
        "pack": "ship_helm_nav",
        "items": [
            ("ship_wheel_brass_oak", "Brass-Rimmed Oak Ship Wheel", ["ship", "airship", "helm", "wheel", "nautical"], 1.3, True, True),
            ("sky_aether_helm_console", "Magi-Punk Aether Helm Console", ["ship", "airship", "skyship", "helm", "aether", "tech"], 1.4, True, False),
            ("ship_binnacle_compass", "Brass Ship Binnacle Compass Stand", ["ship", "airship", "helm", "compass", "navigation"], 0.9, True, False),
            ("ship_engine_telegraph", "Brass Twin-Lever Engine Telegraph", ["ship", "airship", "skyship", "helm", "brass", "tech"], 0.9, True, False),
            ("sky_crystal_nav_orb", "Glowing Aether Crystal Navigation Orb", ["ship", "airship", "skyship", "arcane", "navigation", "aether"], 0.95, True, True),
            ("ship_star_chart_scroll", "Rolled Nautical Star-Chart Tube", ["ship", "airship", "navigation", "map", "clutter"], 0.75, False, False),
            ("ship_sextant_caliper_tray", "Brass Sextant & Dividers Tray", ["ship", "navigation", "brass", "clutter", "tool"], 0.7, False, False),
            ("ship_speaking_tube", "Flared Brass Voice Speaking Tube", ["ship", "airship", "helm", "brass", "tech"], 0.65, True, False),
            ("ship_brass_bell_mount", "Polished Brass Ship's Bell on Oak Frame", ["ship", "airship", "helm", "brass", "bell"], 0.85, True, False),
            ("ship_nautical_sandglass", "Brass Nautical Sandglass Timer", ["ship", "navigation", "brass", "clutter"], 0.6, True, False),
            ("ship_spyglass_cradle", "Captain's Brass Spyglass in Cradle", ["ship", "navigation", "brass", "clutter"], 0.75, False, False),
            ("sky_wind_anemometer", "Brass Wind-Vane Anemometer Dial", ["ship", "airship", "skyship", "navigation", "brass"], 0.8, True, True),
            ("ship_brass_barometer", "Ornate Brass Ship Barometer Dial", ["ship", "airship", "navigation", "brass"], 0.65, False, False),
            ("ship_rudder_tiller_bar", "Carved Oak Boat Rudder Tiller Bar", ["ship", "boat", "helm", "wood"], 1.15, True, False),
            ("ship_captain_logbook", "Captain's Open Logbook on Lectern", ["ship", "captain", "navigation", "book", "furniture"], 0.95, True, False),
            ("sky_rune_autopilot_ring", "Glowing Rune Autopilot Compass Ring", ["ship", "airship", "skyship", "arcane", "aether", "navigation"], 1.45, False, True),
        ],
    },
    {
        "file": "skyship_aether_engines_4x4_1795390963706.jpg",
        "pack": "skyship_engines",
        "items": [
            ("sky_propeller_4blade", "4-Blade Brass & Mahogany Skyship Rotor", ["ship", "airship", "skyship", "propeller", "engine"], 2.4, True, True),
            ("sky_propeller_2blade", "2-Blade Wooden Airship Propeller", ["ship", "airship", "skyship", "propeller", "engine"], 2.2, True, True),
            ("sky_aether_turbine_pod", "Glowing Cyan Aether Turbine Nacelle", ["ship", "airship", "skyship", "aether", "engine", "tech"], 1.6, True, False),
            ("sky_brass_thruster_nozzle", "Riveted Brass Jet Thruster Nozzle", ["ship", "airship", "skyship", "engine", "brass", "tech"], 1.35, True, False),
            ("sky_vertical_lift_fan", "Circular Brass Vertical Lift-Fan Ring", ["ship", "airship", "skyship", "engine", "fan", "tech"], 1.8, True, True),
            ("sky_levitation_coil_ring", "Glowing Arcane Levitation Coil Ring", ["ship", "airship", "skyship", "aether", "arcane", "engine"], 1.7, True, True),
            ("sky_pressurized_aether_tank", "Pressurized Riveted Brass Aether Tank", ["ship", "airship", "skyship", "aether", "tank", "brass"], 1.6, True, False),
            ("sky_mana_condenser_cap", "Copper Mana-Condenser Cylinder", ["ship", "airship", "skyship", "aether", "copper", "tech"], 1.2, True, False),
            ("sky_pressure_gauge_manifold", "Brass Triple-Gauge Pipe Manifold", ["ship", "airship", "skyship", "brass", "pipe", "tech"], 1.15, True, True),
            ("ship_exhaust_smokestack", "Riveted Iron & Copper Smokestack Funnel", ["ship", "airship", "skyship", "steam", "engine", "iron"], 1.45, True, False),
            ("sky_aether_furnace_core", "Glowing Aether Furnace Boiler Core", ["ship", "airship", "skyship", "aether", "boiler", "engine"], 1.8, True, False),
            ("sky_brass_gyroscope", "Concentric Brass Gyroscope Stabilizer", ["ship", "airship", "skyship", "brass", "clockwork", "tech"], 1.4, True, True),
            ("sky_lightning_rod_array", "Arcane Lightning-Rod Mast Array", ["ship", "airship", "skyship", "aether", "arcane", "mast"], 1.35, True, True),
            ("sky_tail_rudder_fin", "Riveted Steel Airship Tail Rudder Fin", ["ship", "airship", "skyship", "fin", "wing", "hull"], 2.0, True, False),
            ("sky_flywheel_belt_drive", "Heavy Iron Flywheel & Drive-Belt Unit", ["ship", "airship", "skyship", "clockwork", "engine", "iron"], 1.45, True, True),
            ("sky_violet_crystal_battery", "Glowing Violet Arcane Battery Bank", ["ship", "airship", "skyship", "aether", "arcane", "battery"], 1.35, True, False),
        ],
    },
    {
        "file": "ship_masts_sails_4x4_1795390990230.jpg",
        "pack": "ship_masts_sails",
        "items": [
            ("ship_oak_mast_stump", "Round Oak Ship Mast Cross-Section", ["ship", "airship", "mast", "wood", "nautical"], 1.25, True, False),
            ("ship_mast_belaying_collar", "Iron-Banded Mast Collar & Belaying Pins", ["ship", "airship", "mast", "rigging", "wood"], 1.5, True, True),
            ("ship_furled_yardarm_sail", "Furled Canvas Sail on Yardarm Spar", ["ship", "airship", "sail", "mast", "rigging"], 2.8, True, False),
            ("ship_square_sail_white", "Billowing Cream Square Ship Sail", ["ship", "airship", "sail", "canvas", "nautical"], 3.0, True, False),
            ("ship_pirate_patched_sail", "Weathered Patched Pirate Square Sail", ["ship", "pirate", "sail", "canvas", "nautical"], 2.8, True, False),
            ("sky_lateen_wing_sail", "Skyship Triangular Lateen Wing-Sail", ["ship", "airship", "skyship", "sail", "wing"], 2.6, True, False),
            ("sky_batwing_glider_fin", "Magi-Punk Brass-Rib Batwing Airship Fin", ["ship", "airship", "skyship", "wing", "sail", "brass"], 2.6, True, False),
            ("ship_crows_nest_basket", "Timber Crow's Nest Lookout Basket", ["ship", "airship", "mast", "lookout", "wood"], 1.7, True, False),
            ("ship_deadeye_shroud_block", "Wooden Deadeye & Shroud Rigging Block", ["ship", "airship", "rigging", "rope", "nautical"], 1.0, True, True),
            ("ship_coiled_halyard_rope", "Flat Coiled Hemp Deck Halyard Rope", ["ship", "airship", "rigging", "rope", "clutter"], 1.0, False, False),
            ("ship_double_pulley_hook", "Heavy Oak & Iron Double Pulley Hook", ["ship", "airship", "rigging", "shipyard", "tool"], 0.85, True, False),
            ("ship_bowsprit_spar_tip", "Brass-Bound Wooden Bowsprit Spar", ["ship", "airship", "mast", "prow", "wood"], 2.6, True, False),
            ("ship_tattered_sail_scrap", "Tattered Torn Canvas Sail Scrap", ["ship", "pirate", "sail", "damage", "wreck"], 1.8, False, True),
            ("sky_mooring_harness_ring", "Brass Airship Mooring Harness Ring", ["ship", "airship", "skyship", "rigging", "brass"], 1.25, True, True),
            ("ship_windsock_pennant", "Striped Red & Cream Wind-Sock Pennant", ["ship", "airship", "skyship", "flag", "mast"], 1.3, True, False),
            ("sky_steel_cable_reel", "Heavy Iron Skyship Steel Cable Reel", ["ship", "airship", "skyship", "rigging", "iron", "tech"], 1.2, True, False),
        ],
    },
    {
        "file": "ship_anchors_mooring_4x4_1795391008677.jpg",
        "pack": "ship_anchors_mooring",
        "items": [
            ("ship_iron_fluke_anchor", "Heavy Forged Iron Naval Fluke Anchor", ["ship", "anchor", "iron", "nautical", "docks"], 1.7, True, True),
            ("sky_grappling_anchor_4prong", "4-Prong Brass & Iron Skyship Anchor", ["ship", "airship", "skyship", "anchor", "brass"], 1.65, True, True),
            ("ship_oak_deck_capstan", "Round Oak Deck Capstan with Turning Bars", ["ship", "airship", "capstan", "winch", "nautical"], 1.7, True, True),
            ("ship_brass_anchor_windlass", "Brass-Geared Anchor Windlass Winch", ["ship", "airship", "winch", "anchor", "brass"], 1.65, True, False),
            ("ship_iron_dock_bollard", "Cast-Iron Dock Mooring Bollard & Rope", ["ship", "docks", "mooring", "iron", "nautical"], 0.95, True, False),
            ("ship_brass_deck_cleat", "Twin-Horn Polished Brass Deck Cleat", ["ship", "airship", "mooring", "brass", "nautical"], 0.75, False, False),
            ("ship_coiled_anchor_chain", "Coiled Pile of Heavy Iron Anchor Chain", ["ship", "airship", "anchor", "chain", "iron"], 1.35, False, True),
            ("ship_iron_hawsepipe_plate", "Circular Iron Hawsepipe Chain Deck Plate", ["ship", "airship", "anchor", "iron", "deck"], 0.95, False, False),
            ("ship_cargo_hoist_crane", "Swinging Deck Cargo Hoist Jib Crane", ["ship", "airship", "shipyard", "crane", "cargo"], 2.3, True, True),
            ("ship_cargo_sling_net", "Hemp Rope Cargo Sling Net Bundle", ["ship", "airship", "cargo", "docks", "rope"], 1.5, True, False),
            ("ship_cork_lifebuoy_ring", "Red & White Striped Cork Lifebuoy Ring", ["ship", "boat", "rescue", "nautical", "clutter"], 0.9, False, True),
            ("ship_rope_hull_fender", "Woven Hemp Rope Ship Hull Fender", ["ship", "boat", "docks", "mooring", "rope"], 1.0, True, False),
            ("ship_boarding_gangplank", "Heavy Timber Cleated Boarding Gangplank", ["ship", "airship", "docks", "boarding", "bridge"], 2.4, True, False),
            ("ship_boarding_grapnel", "3-Prong Steel Boarding Grappling Hook", ["ship", "airship", "pirate", "boarding", "rope"], 1.0, False, True),
            ("ship_depth_sounding_lead", "Brass Depth-Sounding Lead & Line Spool", ["ship", "navigation", "brass", "clutter", "tool"], 0.75, False, True),
            ("ship_winch_brake_wheel", "Cast-Iron Spoked Mooring Brake Wheel", ["ship", "airship", "winch", "iron", "tech"], 1.05, True, True),
        ],
    },
    {
        "file": "ship_weapons_cannons_4x4_1795391009325.jpg",
        "pack": "ship_weapons",
        "items": [
            ("ship_bronze_broadside_cannon", "Bronze Broadside Naval Cannon on Carriage", ["ship", "cannon", "weapon", "nautical", "pirate"], 1.85, True, False),
            ("ship_iron_carronade", "Heavy Black-Iron Naval Carronade", ["ship", "cannon", "weapon", "iron", "nautical"], 1.65, True, False),
            ("ship_brass_swivel_gun", "Brass Deck Swivel Gun on Iron Post", ["ship", "airship", "cannon", "weapon", "brass"], 1.15, True, False),
            ("sky_aether_rail_cannon", "Magi-Punk Cyan Aether Rail-Cannon", ["ship", "airship", "skyship", "cannon", "aether", "weapon"], 1.9, True, False),
            ("ship_oak_deck_ballista", "Heavy Oak Deck-Mounted Siege Ballista", ["ship", "airship", "weapon", "ballista", "siege"], 1.85, True, True),
            ("sky_brass_harpoon_launcher", "Brass Skyship Harpoon Launcher & Reel", ["ship", "airship", "skyship", "weapon", "harpoon"], 1.55, True, False),
            ("sky_brass_gatling_turret", "Rotating Brass Gatling Repeater Turret", ["ship", "airship", "skyship", "weapon", "turret", "brass"], 1.6, True, False),
            ("ship_bronze_deck_mortar", "Bronze Siege Mortar on Bolted Timber Bed", ["ship", "airship", "weapon", "cannon", "mortar"], 1.65, True, False),
            ("ship_cannonball_rack", "Triangular Wooden Iron Cannonball Rack", ["ship", "cannon", "ammo", "weapon", "clutter"], 0.95, True, False),
            ("ship_gunpowder_keg_red", "Red-Banded Oak Gunpowder Keg", ["ship", "airship", "ammo", "barrel", "explosive"], 0.85, True, False),
            ("sky_aether_shell_crate", "Open Crate of Glowing Cyan Aether Shells", ["ship", "airship", "skyship", "ammo", "aether", "crate"], 1.05, True, False),
            ("sky_flare_rocket_rack", "Iron Rack of Arcane Signal Flare Rockets", ["ship", "airship", "skyship", "ammo", "weapon", "flare"], 1.15, True, False),
            ("ship_cannon_ramrod_rack", "Cannon Ramrod, Worm & Sponge Swab Rack", ["ship", "cannon", "tool", "clutter"], 1.15, False, False),
            ("ship_linstock_match_tub", "Iron-Banded Water & Linstock Match Tub", ["ship", "cannon", "nautical", "bucket", "clutter"], 0.9, True, False),
            ("ship_spiked_ramming_prow", "Armored Iron & Brass Spiked Ramming Prow", ["ship", "airship", "prow", "weapon", "hull"], 1.7, True, False),
            ("sky_brass_searchlight_turret", "Rotating Brass Naval Searchlight Turret", ["ship", "airship", "skyship", "light", "brass", "tech"], 1.25, True, False),
        ],
    },
    {
        "file": "ship_hatches_deck_4x4_1795390992023.jpg",
        "pack": "ship_hatches_deck",
        "items": [
            ("ship_cargo_hatch_closed", "Closed Slatted Oak Cargo Hold Hatch", ["ship", "airship", "hatch", "deck", "wood"], 2.0, True, False),
            ("ship_cargo_hatch_open", "Open Dark Cargo Hatchway with Ladder", ["ship", "airship", "hatch", "ladder", "stairs"], 2.0, False, False),
            ("ship_brass_deck_skylight", "Brass-Framed Peaked Glass Deck Skylight", ["ship", "airship", "hatch", "glass", "brass"], 1.85, True, False),
            ("sky_iron_engine_grate", "Riveted Iron Engine-Room Deck Vent Grate", ["ship", "airship", "skyship", "grate", "iron", "deck"], 1.5, False, False),
            ("ship_companionway_stairs", "Wooden Ship Companionway Stairs Down", ["ship", "airship", "stairs", "hatch", "deck"], 1.9, False, False),
            ("ship_iron_oak_ladder", "Steep Narrow Iron & Oak Ship Ladder", ["ship", "airship", "ladder", "stairs", "deck"], 1.6, False, True),
            ("sky_brass_scuttle_hatch", "Circular Bolted Brass Deck Scuttle Hatch", ["ship", "airship", "skyship", "hatch", "brass"], 1.25, True, False),
            ("ship_iron_scupper_grate", "Cast-Iron Deck Drainage Scupper Grate", ["ship", "airship", "grate", "iron", "deck"], 1.1, False, False),
            ("ship_square_deck_trapdoor", "Hinged Square Oak Deck Trapdoor", ["ship", "airship", "hatch", "trapdoor", "wood"], 1.25, False, False),
            ("ship_brass_ventilator_cowl", "Curved Brass Air-Scoop Ventilator Cowl", ["ship", "airship", "skyship", "brass", "deck", "vent"], 1.0, True, False),
            ("ship_water_cask_rack", "Timber Deck Rack with Two Water Casks", ["ship", "airship", "barrel", "water", "deck"], 1.6, True, False),
            ("ship_bilge_pump_housing", "Cast-Iron & Oak Ship Bilge-Pump Lever", ["ship", "boat", "deck", "iron", "tech"], 1.0, True, False),
            ("ship_teak_deck_bench_locker", "Slatted Teak Deck Seating Locker Chest", ["ship", "airship", "bench", "furniture", "deck"], 1.5, True, False),
            ("ship_lifeboat_davit_arm", "Curved Steel Lifeboat Davit Bracket Arm", ["ship", "airship", "boat", "iron", "deck"], 1.2, True, False),
            ("ship_quarterdeck_steps", "3-Step Timber Quarterdeck Stair Landing", ["ship", "airship", "stairs", "wood", "deck"], 1.4, True, False),
            ("ship_wheelhouse_roof_hatch", "Rounded Timber Wheelhouse Roof Hatch", ["ship", "airship", "hatch", "wood", "deck"], 1.2, True, False),
        ],
    },
    {
        "file": "ship_boats_oars_4x4_final_1795391050743.jpg",
        "pack": "ship_boats_oars",
        "items": [
            ("boat_wooden_rowboat_dinghy", "Empty Wooden Rowboat Dinghy", ["ship", "boat", "rowboat", "dinghy", "water"], 2.8, True, False),
            ("boat_white_oak_lifeboat", "White & Oak Clinker-Built Lifeboat", ["ship", "boat", "lifeboat", "water", "nautical"], 3.0, True, False),
            ("boat_weathered_river_skiff", "Narrow Weathered Wooden River Skiff", ["ship", "boat", "skiff", "water", "river"], 2.9, True, False),
            ("boat_stowed_canvas_lifeboat", "Canvas-Covered Stowed Ship Lifeboat", ["ship", "airship", "boat", "lifeboat", "deck"], 2.6, True, False),
            ("boat_carved_river_canoe", "Slender Carved Wooden River Canoe", ["boat", "canoe", "water", "river", "camp"], 2.6, True, False),
            ("boat_lashed_log_raft", "Lashed Timber-Log Emergency Raft", ["boat", "raft", "water", "camp", "wood"], 2.6, True, False),
            ("boat_pair_wooden_oars", "Pair of Long Wooden Rowing Oars", ["ship", "boat", "oar", "wood", "clutter"], 1.9, False, True),
            ("boat_carved_steering_paddle", "Broad-Bladed Carved Steering Paddle", ["boat", "oar", "paddle", "wood", "clutter"], 1.6, False, False),
            ("ship_brass_boathook_pole", "Wooden Boat-Hook Pole with Brass Tip", ["ship", "boat", "docks", "tool", "clutter"], 1.9, False, False),
            ("ship_cleated_boarding_plank", "Cleated Timber Boarding Plank Bridge", ["ship", "boat", "docks", "boarding", "bridge"], 2.2, True, False),
            ("sky_hooked_boarding_bridge", "Steel-Hooked Airship Boarding Bridge", ["ship", "airship", "skyship", "boarding", "bridge"], 2.4, True, True),
            ("sky_brass_escape_lifepod", "Magi-Punk Brass & Leather Escape Life-Pod", ["ship", "airship", "skyship", "lifeboat", "brass", "tech"], 1.9, True, False),
            ("sky_canvas_parachute_pack", "Folded Canvas Skyship Parachute Pack", ["ship", "airship", "skyship", "rescue", "clutter"], 0.9, True, False),
            ("boat_bailer_scoop_bucket", "Oak Deck Bucket & Wooden Bailer Scoop", ["ship", "boat", "bucket", "clutter", "nautical"], 0.95, True, False),
            ("ship_rescue_lifeline_float", "Coiled Rescue Lifeline Rope & Cork Float", ["ship", "boat", "rescue", "rope", "clutter"], 1.0, False, True),
            ("boat_brass_oarlock_brackets", "Pair of Brass Oarlock Gunwale Brackets", ["boat", "oar", "brass", "shipyard", "clutter"], 0.75, False, True),
        ],
    },
    {
        "file": "ship_captain_cabin_4x4_AUTO",
        "glob": "ship_captain_cabin_4x4*.jpg",
        "pack": "ship_captain_cabin",
        "cell_overrides": {
            3: (0.75, 0.0, 1.0, 0.325),
            7: (0.75, 0.325, 1.0, 0.495),
        },
        "items": [
            ("ship_captain_chart_table", "Mahogany Captain's Chart Table & Map", ["ship", "airship", "captain", "table", "navigation"], 2.3, True, False),
            ("ship_folding_navigator_desk", "Brass-Inlaid Folding Navigator Map Desk", ["ship", "airship", "captain", "desk", "furniture"], 1.6, True, False),
            ("ship_captain_swivel_chair", "Captain's Tufted Red-Leather Swivel Chair", ["ship", "airship", "captain", "chair", "furniture"], 1.15, True, False),
            ("ship_captain_bunk_bed", "Built-In Oak Captain's Bunk Bed", ["ship", "airship", "captain", "bed", "furniture"], 2.2, True, False),
            ("ship_captain_sea_chest_closed", "Closed Brass-Bound Captain's Sea Chest", ["ship", "captain", "chest", "storage", "furniture"], 1.35, True, False),
            ("ship_captain_sea_chest_open", "Open Sea Chest with Charts & Gold", ["ship", "captain", "chest", "treasure", "pirate"], 1.45, True, False),
            ("ship_brass_chronometer_box", "Brass Gimbaled Marine Chronometer Box", ["ship", "airship", "navigation", "brass", "clutter"], 0.65, False, False),
            ("ship_officer_liquor_cabinet", "Mahogany Officer's Decanter Cabinet", ["ship", "captain", "cabinet", "furniture", "drink"], 1.4, True, False),
            ("ship_gimbaled_oil_lamp", "Brass Gimbaled Cabin Oil Lamp Stand", ["ship", "airship", "captain", "lamp", "light"], 0.65, True, False),
            ("ship_rolled_chart_rack", "Wooden Rack of Rolled Nautical Charts", ["ship", "airship", "navigation", "scroll", "furniture"], 1.25, True, False),
            ("ship_captain_dining_table", "Polished Mahogany Captain's Dining Table", ["ship", "airship", "captain", "table", "furniture"], 2.4, True, False),
            ("ship_stern_velvet_bench", "Curved Crimson-Velvet Stern Cabin Bench", ["ship", "airship", "captain", "bench", "furniture"], 2.1, True, False),
            ("ship_brass_armillary_globe", "Ornate Brass Armillary Astrolabe Stand", ["ship", "airship", "navigation", "brass", "arcane"], 0.85, True, True),
            ("ship_captain_tea_tray", "Silver & Porcelain Captain's Tea Tray", ["ship", "captain", "tea", "clutter", "food"], 0.75, False, False),
            ("ship_crossed_cutlasses_plaque", "Trophy Plaque with Crossed Cutlasses", ["ship", "captain", "pirate", "weapon", "decor"], 0.95, False, True),
            ("ship_cabin_coal_stove", "Compact Brass & Iron Cabin Heater Stove", ["ship", "airship", "captain", "stove", "iron"], 1.05, True, False),
        ],
    },
    {
        "file": "ship_crew_galley_4x4_1795391099497.jpg",
        "pack": "ship_crew_galley",
        "items": [
            ("ship_sailor_hammock_open", "Strung Canvas Sailor's Hammock", ["ship", "airship", "crew", "bed", "hammock"], 2.2, True, False),
            ("ship_sailor_hammock_rolled", "Rolled & Lashed Canvas Hammock Bundle", ["ship", "airship", "crew", "hammock", "clutter"], 1.1, True, False),
            ("ship_crew_bunk_berth", "Built-In Wooden Ship Crew Bunk Berth", ["ship", "airship", "crew", "bed", "furniture"], 2.0, True, False),
            ("ship_sailor_ditty_bag", "Stuffed Canvas Sailor's Ditty Sea-Bag", ["ship", "airship", "crew", "sack", "clutter"], 0.85, True, False),
            ("ship_sailor_footlocker", "Weathered Painted Sailor's Footlocker", ["ship", "airship", "crew", "chest", "storage"], 1.2, True, False),
            ("ship_galley_coal_stove", "Bolted Cast-Iron Ship's Galley Stove", ["ship", "airship", "galley", "kitchen", "stove"], 1.7, True, False),
            ("ship_copper_soup_cauldron", "Riveted Copper Ship's Galley Cauldron", ["ship", "galley", "kitchen", "food", "copper"], 1.15, True, False),
            ("ship_galley_utensil_rack", "Timber Galley Hanging Pan & Utensil Rack", ["ship", "galley", "kitchen", "cookware", "furniture"], 1.6, True, True),
            ("ship_crew_mess_table", "Bolted Wooden Sailor's Mess Table", ["ship", "airship", "crew", "table", "furniture"], 2.1, True, False),
            ("ship_hardtack_barrel", "Open Oak Hardtack Biscuit Barrel", ["ship", "galley", "barrel", "food", "storage"], 1.0, True, False),
            ("ship_rum_ration_cask", "Oak Rum Ration Cask on Cradle with Spigot", ["ship", "pirate", "galley", "barrel", "drink"], 1.25, True, False),
            ("ship_netted_onions_fish", "Netted Dried Onions & Salted Fish Bundle", ["ship", "galley", "food", "clutter", "docks"], 1.0, False, True),
            ("ship_tin_mess_plates", "Stack of Tin Mess Plates & Pewter Mugs", ["ship", "crew", "galley", "tableware", "clutter"], 0.7, False, True),
            ("ship_sailor_washbasin", "Wooden Sailor's Washbasin, Soap & Rag", ["ship", "crew", "bath", "clutter"], 0.75, False, False),
            ("ship_mop_holystone_bucket", "Deck-Scrubbing Bucket, Mop & Holystone", ["ship", "crew", "deck", "bucket", "clutter"], 1.05, True, False),
            ("ship_brass_storm_lantern", "Brass-Caged Stormproof Ship Oil Lantern", ["ship", "airship", "light", "lamp", "brass"], 0.7, True, True),
        ],
    },
    {
        "file": "shipyard_building_4x4_1795391084017.jpg",
        "pack": "shipyard_building",
        "items": [
            ("yard_oak_keel_beam", "Heavy Squared Oak Ship Keel Beam", ["ship", "shipyard", "timber", "wood", "construction"], 3.0, True, False),
            ("yard_curved_hull_ribs", "Pair of Curved Steamed-Oak Hull Ribs", ["ship", "shipyard", "hull", "timber", "construction"], 2.6, True, True),
            ("yard_drydock_crib_blocks", "Stacked Timber Drydock Keel Crib Blocks", ["ship", "shipyard", "drydock", "wood", "construction"], 2.0, True, True),
            ("yard_scaffolding_plank", "Shipyard Iron-Braced Scaffolding Section", ["ship", "shipyard", "scaffold", "wood", "construction"], 2.1, True, False),
            ("yard_carpenter_sawhorse", "Sturdy Wooden Shipyard Sawhorse Trestle", ["ship", "shipyard", "workshop", "wood", "tool"], 1.5, True, True),
            ("yard_pine_deck_planks", "Flat Stack of Fresh-Cut Pine Deck Planks", ["ship", "shipyard", "lumber", "wood", "construction"], 2.0, True, False),
            ("yard_timber_steam_box", "Wooden Timber-Bending Steam Box & Valve", ["ship", "shipyard", "steam", "workshop", "wood"], 2.1, True, False),
            ("yard_boiling_tar_cauldron", "Cast-Iron Caulking Tar & Pitch Cauldron", ["ship", "shipyard", "tar", "cauldron", "workshop"], 1.35, True, False),
            ("yard_caulking_mallet_oakum", "Caulking Mallet, Chisel & Hemp Oakum", ["ship", "shipyard", "tool", "workshop", "clutter"], 0.95, False, True),
            ("yard_rivet_forge_brazier", "Portable Shipyard Rivet-Heating Brazier", ["ship", "airship", "shipyard", "forge", "fire"], 1.3, True, True),
            ("yard_skyship_blueprint_table", "Shipwright Drafting Table with Hull Blueprint", ["ship", "airship", "skyship", "shipyard", "blueprint", "desk"], 2.2, True, False),
            ("yard_giant_calipers_tsquare", "Brass Shipwright Calipers & Wooden T-Square", ["ship", "shipyard", "tool", "blueprint", "clutter"], 1.1, False, True),
            ("yard_brass_hull_plates", "Stack of Riveted Brass Airship Hull Plates", ["ship", "airship", "skyship", "shipyard", "brass", "hull"], 1.6, True, False),
            ("yard_aframe_hoist_beam", "Timber Shipyard A-Frame Chain Hoist Beam", ["ship", "shipyard", "crane", "hoist", "construction"], 2.4, True, True),
            ("yard_hull_paint_tray", "Carpenter's Hull-Paint Pots & Brushes Tray", ["ship", "shipyard", "workshop", "tool", "clutter"], 1.0, False, False),
            ("yard_wood_shavings_pile", "Scattered Curly Wood Shavings & Sawdust", ["ship", "shipyard", "workshop", "decal", "clutter"], 1.3, False, True),
        ],
    },
    {
        "file": "ship_cargo_hold_4x4_1795391072868.jpg",
        "pack": "ship_cargo_hold",
        "items": [
            ("cargo_netted_pallet", "Rope-Netted Ship Cargo Pallet Bundle", ["ship", "airship", "cargo", "docks", "storage"], 1.9, True, False),
            ("cargo_braced_shipping_crate", "Reinforced Wooden Shipping Crate", ["ship", "airship", "cargo", "crate", "storage"], 1.4, True, True),
            ("cargo_weapons_long_crate", "Long Iron-Clasped Weapons Cargo Crate", ["ship", "airship", "cargo", "crate", "weapon"], 1.8, True, False),
            ("cargo_spice_tea_chest", "Banded Teak Spice & Tea Merchant Chest", ["ship", "cargo", "chest", "market", "storage"], 1.35, True, False),
            ("cargo_burlap_grain_sacks", "Cluster of Tied Burlap Coffee & Grain Sacks", ["ship", "cargo", "sack", "food", "storage"], 1.3, True, False),
            ("cargo_lashed_wine_cradle", "Timber Cargo Cradle with Lashed Wine Casks", ["ship", "cargo", "barrel", "wine", "storage"], 1.75, True, False),
            ("cargo_aether_crystal_cage", "Iron Cage Holding Glowing Aether Crystals", ["ship", "airship", "skyship", "cargo", "aether", "arcane"], 1.45, True, True),
            ("cargo_copper_coil_crate", "Slatted Machinery Crate with Copper Coils", ["ship", "airship", "skyship", "cargo", "tech", "crate"], 1.4, True, False),
            ("cargo_paymaster_strongbox", "Riveted Dark-Steel Paymaster Strongbox Safe", ["ship", "airship", "cargo", "chest", "treasure", "iron"], 1.25, True, False),
            ("cargo_rolled_silk_bolts", "Strapped Bundle of Silk & Sailcloth Bolts", ["ship", "cargo", "fabric", "market", "storage"], 1.2, True, False),
            ("cargo_strapped_lumber_spars", "Strapped Bundle of Timber Spars & Lumber", ["ship", "shipyard", "cargo", "lumber", "wood"], 2.2, True, False),
            ("cargo_slatted_live_crate", "Slatted Live-Cargo Transport Crate & Straw", ["ship", "cargo", "crate", "farm", "storage"], 1.5, True, False),
            ("cargo_diplomat_trunk", "Wax-Sealed Leather Diplomat Steamer Trunk", ["ship", "airship", "cargo", "chest", "travel"], 1.35, True, False),
            ("cargo_hemp_rope_bales", "Stacked Bales of New Hemp Rigging Rope", ["ship", "airship", "cargo", "rigging", "rope"], 1.35, True, False),
            ("cargo_brass_pipe_bundle", "Strapped Bundle of Brass Boiler Pipes", ["ship", "airship", "skyship", "shipyard", "pipe", "brass"], 1.75, True, False),
            ("cargo_smuggler_false_crate", "Open False-Bottom Smuggler Treasure Crate", ["ship", "pirate", "cargo", "smuggler", "treasure", "crate"], 1.3, True, False),
        ],
    },
    {
        "file": "ship_ornaments_damage_4x4_1795391042599.jpg",
        "pack": "ship_ornaments_damage",
        "items": [
            ("ship_figurehead_lion_gold", "Carved Gilded Lion Prow Figurehead", ["ship", "airship", "figurehead", "prow", "gold"], 1.65, True, False),
            ("sky_figurehead_winged_serpent", "Brass Winged-Serpent Skyship Figurehead", ["ship", "airship", "skyship", "figurehead", "prow", "brass"], 1.9, True, True),
            ("ship_figurehead_mermaid", "Carved Wooden Mermaid Prow Figurehead", ["ship", "figurehead", "prow", "nautical", "wood"], 1.7, True, True),
            ("ship_iron_ram_prow_cap", "Riveted Iron Armored Battering-Ram Cap", ["ship", "airship", "prow", "hull", "iron"], 1.55, True, False),
            ("ship_navy_pennant_flag", "Billowing Navy & Gold Swallowtail Pennant", ["ship", "airship", "flag", "banner", "mast"], 1.65, True, False),
            ("ship_pirate_skull_flag", "Tattered Black Pirate Jolly Roger Flag", ["ship", "pirate", "flag", "banner", "mast"], 1.75, True, False),
            ("ship_stern_nameplate_plaque", "Ornate Brass & Oak Stern Nameplate Plaque", ["ship", "airship", "stern", "brass", "decor"], 1.6, False, False),
            ("ship_stern_gallery_lantern", "Gilded Brass Stern Gallery Ship Lantern", ["ship", "airship", "stern", "lamp", "light", "brass"], 1.05, True, False),
            ("ship_splintered_hull_debris", "Splintered Wooden Hull Breach Debris", ["ship", "airship", "damage", "wreck", "decal"], 1.8, False, True),
            ("ship_cannon_blast_crater", "Scorched Cannonball Blast Crater on Planks", ["ship", "airship", "damage", "scorch", "decal"], 1.6, False, False),
            ("ship_snapped_mast_tangle", "Snapped Mast Shard & Tangled Rigging", ["ship", "airship", "damage", "wreck", "mast"], 2.0, True, True),
            ("ship_plank_repair_patch", "Nailed Wooden Plank Hull Repair Patch", ["ship", "airship", "shipyard", "damage", "decal"], 1.5, False, False),
            ("ship_barnacle_kelp_cluster", "Crusty Hull Barnacles & Tangled Sea Kelp", ["ship", "boat", "wreck", "water", "decal"], 1.4, False, True),
            ("ship_pitch_oil_slick", "Glossy Spilled Ship-Pitch & Oil Deck Slick", ["ship", "airship", "shipyard", "damage", "decal"], 1.45, False, False),
            ("ship_heraldic_crest_shield", "Brass & Crimson Heraldic Ship-Crest Shield", ["ship", "airship", "decor", "brass", "shield"], 1.0, False, False),
            ("ship_rope_boarding_ladder", "Draped Rope & Oak Boarding Side-Ladder", ["ship", "airship", "boarding", "ladder", "rope"], 1.75, False, True),
        ],
    },
]


# ============================================================================
# 2. PROCEDURAL 2x-SUPERSAMPLED SHIPBUILDING STRUCTURAL ASSETS (20 Assets)
# ============================================================================


def make_deck_terrain(seed: int, style: str) -> Image.Image:
    S = 512
    rng = random.Random(seed)
    colorable = style == "colorable"

    palettes = {
        "teak": ((156, 114, 72), (186, 142, 96), (92, 62, 36)),
        "oak": ((118, 92, 66), (144, 116, 86), (68, 52, 38)),
        "brass_grate": ((86, 84, 82), (178, 144, 76), (48, 46, 48)),
        "mahogany": ((124, 62, 46), (196, 158, 72), (76, 36, 26)),
        "hold": ((72, 56, 44), (96, 76, 60), (42, 32, 24)),
        "colorable": ((205, 24, 24), (246, 88, 88), (118, 14, 14)),
    }
    base, hi, lo = palettes[style]
    im = Image.new("RGBA", (S, S), (*base, 255))
    d = ImageDraw.Draw(im)

    if style == "brass_grate":
        # Riveted steel & brass Magi-Punk skyship deck plates with recessed ventilation slots
        grid = 4
        cs = S // grid
        for r in range(grid):
            for c in range(grid):
                x0, y0 = c * cs, r * cs
                x1, y1 = x0 + cs, y0 + cs
                d.rectangle([x0 + 2, y0 + 2, x1 - 2, y1 - 2], fill=jitter(rng, base, 7), outline=INK, width=3)
                # Brass inner trim frame
                d.rectangle([x0 + 8, y0 + 8, x1 - 8, y1 - 8], outline=shade(hi, 0.96), width=3)
                # Corner rivets
                for rx in (x0 + 14, x1 - 14):
                    for ry in (y0 + 14, y1 - 14):
                        d.ellipse([rx - 4, ry - 4, rx + 4, ry + 4], fill=shade(hi, 1.08), outline=INK, width=1)
                # Recessed deck grating slots in alternating tiles
                if (r + c) % 2 == 0:
                    for sy in range(y0 + 28, y1 - 22, 16):
                        d.rectangle([x0 + 26, sy, x1 - 26, sy + 7], fill=(24, 26, 32, 255), outline=INK, width=1)
                else:
                    # Subtle diagonal diamond-plate tread marks
                    for tx in range(x0 + 28, x1 - 22, 22):
                        for ty in range(y0 + 28, y1 - 22, 22):
                            d.line([tx - 4, ty - 4, tx + 4, ty + 4], fill=shade(hi, 0.72, 170), width=2)
    else:
        # Seamless horizontal caulked ship deck planking with staggered butt-joints & treenail pegs!
        rows = 8 if style in ("teak", "mahogany", "colorable") else 7
        rh = S / rows
        for r in range(rows):
            y0 = int(round(r * rh))
            y1 = int(round((r + 1) * rh))
            # 2 or 3 staggered butt joints per plank course
            splits = sorted([0, S, int((r * 173 + 96) % S), int((r * 173 + 352) % S)])
            for i in range(len(splits) - 1):
                x0, x1 = splits[i], splits[i + 1]
                if x1 - x0 < 12:
                    continue
                col = rng.choice([RD_DARK, RD_MID, RD_BRIGHT]) if colorable else jitter(rng, base, 10)
                d.rectangle([x0, y0 + 2, x1, y1 - 2], fill=col)
                # Subtle wood-grain streaks
                for _g in range(4):
                    gy = rng.randint(y0 + 5, max(y0 + 6, y1 - 5))
                    d.line([x0 + 3, gy, x1 - 3, gy], fill=RD_HI if colorable else shade(hi, 0.94, 90), width=1)
                # Dark tarred caulking seam at butt joint + brass/oak treenail pegs!
                d.line([x0, y0, x0, y1], fill=INK, width=3)
                for px in (x0 + 7, x1 - 7):
                    if x0 + 4 < px < x1 - 4:
                        for py in (y0 + 12, y1 - 12):
                            peg_c = shade(hi, 1.15) if style == "mahogany" else INK_SOFT
                            d.ellipse([px - 2.5, py - 2.5, px + 2.5, py + 2.5], fill=peg_c)
            # Crisp dark tarred horizontal caulk line between planks (signature ship deck look!)
            caulk_w = 4 if style in ("teak", "oak") else 3
            d.line([0, y0, S, y0], fill=INK, width=caulk_w)
            if style == "mahogany":
                # Thin inlaid gold brass deck strip every 2nd plank
                if r % 2 == 0:
                    d.line([0, y0 + 3, S, y0 + 3], fill=shade(hi, 1.05, 220), width=2)

    return add_grain(im, seed + 41, 6, seamless=True)


def make_ship_wall(seed: int, style: str) -> Image.Image:
    W, H = 1024, 256
    rng = random.Random(seed)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    colorable = style == "colorable"

    if style == "railing":
        # Quarterdeck carved oak balustrade (sleek top-down handrail + spaced posts)
        y0, y1 = 84, H - 84
        d.rectangle([0, y0 - 10, W, y1 + 10], fill=(10, 12, 16, 65))
        d.rectangle([0, y0, W, y1], fill=(138, 92, 54, 255), outline=INK, width=5)
        d.line([0, y0 + 14, W, y0 + 14], fill=(182, 134, 86, 220), width=5)
        d.line([0, y1 - 14, W, y1 - 14], fill=(86, 54, 30, 220), width=5)
        for px in range(64, W, 128):
            d.rectangle([px - 26, y0 - 16, px + 26, y1 + 16], fill=(162, 114, 68, 255), outline=INK, width=5)
            d.ellipse([px - 10, H // 2 - 10, px + 10, H // 2 + 10], fill=(*BRASS_HI, 255), outline=INK, width=3)
    elif style == "ironclad":
        y0, y1 = 44, H - 44
        d.rectangle([0, y0 - 12, W, y1 + 12], fill=(8, 10, 15, 90))
        d.rectangle([0, y0, W, y1], fill=(74, 80, 90, 255), outline=INK, width=6)
        for bx in range(0, W, 128):
            d.rectangle([bx + 3, y0 + 4, bx + 125, y1 - 4], fill=jitter(rng, (82, 88, 98), 7), outline=INK, width=4)
            d.line([bx + 8, y0 + 12, bx + 120, y0 + 12], fill=(136, 144, 156, 210), width=5)
            for rx in (bx + 18, bx + 64, bx + 110):
                for ry in (y0 + 24, y1 - 24):
                    d.ellipse([rx - 5, ry - 5, rx + 5, ry + 5], fill=(142, 148, 158, 255), outline=INK, width=2)
    elif style == "skyship_aether":
        y0, y1 = 44, H - 44
        d.rectangle([0, y0 - 14, W, y1 + 14], fill=(8, 12, 18, 95))
        d.rectangle([0, y0, W, y1], fill=(122, 86, 44, 255), outline=INK, width=6)
        # Brass armor plates framing a glowing cyan aether-rail spine!
        for bx in range(0, W, 128):
            d.rectangle([bx + 3, y0 + 4, bx + 125, y1 - 4], fill=jitter(rng, BRASS, 9), outline=INK, width=4)
            d.line([bx + 8, y0 + 12, bx + 120, y0 + 12], fill=(*BRASS_HI, 220), width=4)
            for rx in (bx + 18, bx + 110):
                for ry in (y0 + 22, y1 - 22):
                    d.ellipse([rx - 5, ry - 5, rx + 5, ry + 5], fill=(*BRASS_LO, 255), outline=INK, width=2)
        # Central glowing cyan aether channel
        d.rectangle([0, H // 2 - 20, W, H // 2 + 20], fill=(18, 42, 54, 255), outline=INK, width=4)
        d.rectangle([0, H // 2 - 10, W, H // 2 + 10], fill=(*CYAN_AETHER, 240))
        d.line([0, H // 2 - 2, W, H // 2 - 2], fill=(224, 252, 255, 220), width=4)
        for bx in range(64, W, 128):
            d.rectangle([bx - 12, H // 2 - 26, bx + 12, H // 2 + 26], fill=(*BRASS_HI, 255), outline=INK, width=4)
    else:
        # Classic timber oak gunwale, interior cabin bulkhead, or colorable hull!
        y0 = 42 if style != "cabin" else 64
        y1 = H - y0
        base = (144, 96, 56) if style == "oak" else (112, 72, 46)
        hi = (186, 134, 84) if style == "oak" else (154, 108, 72)
        d.rectangle([0, y0 - 12, W, y1 + 12], fill=(10, 12, 16, 80))
        d.rectangle([0, y0, W, y1], fill=RD_MID if colorable else (*base, 255), outline=INK, width=6)
        # Ribbed timber planking & iron-bolted hull knees
        for bx in range(0, W, 160):
            col = rng.choice([RD_DARK, RD_MID, RD_BRIGHT]) if colorable else jitter(rng, base, 9)
            d.rectangle([bx + 3, y0 + 5, bx + 157, y1 - 5], fill=col, outline=INK, width=4)
            d.line([bx + 8, y0 + 16, bx + 152, y0 + 16], fill=RD_HI if colorable else (*hi, 200), width=5)
            # Rib timber cap block
            d.rectangle([bx - 14, y0 - 8, bx + 14, y1 + 8], fill=RD_DARK if colorable else shade(base, 0.78), outline=INK, width=4)
            d.ellipse([bx - 4, H // 2 - 4, bx + 4, H // 2 + 4], fill=(*BRASS_HI, 255), outline=INK, width=2)

    im = add_grain(im, seed + 17, 5, seamless=True)
    return im.resize((512, 128), Image.Resampling.LANCZOS)


def make_ship_path(seed: int, style: str) -> Image.Image:
    W, H = 1024, 256
    rng = random.Random(seed)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if style == "rigging_net":
        # Crisscrossing hemp ratline rope ladder / rigging netting
        for sy in (42, 128, H - 42):
            d.line([0, sy, W, sy], fill=INK, width=16)
            d.line([0, sy, W, sy], fill=(182, 146, 94, 255), width=10)
        for rx in range(32, W, 64):
            d.line([rx, 36, rx, H - 36], fill=INK, width=12)
            d.line([rx, 36, rx, H - 36], fill=(164, 128, 82, 255), width=6)
            for sy in (42, 128, H - 42):
                d.ellipse([rx - 9, sy - 9, rx + 9, sy + 9], fill=(196, 158, 102, 255), outline=INK, width=3)
    elif style == "anchor_chain":
        # Heavy forged iron anchor chain links
        for i, cx in enumerate(range(32, W, 64)):
            if i % 2 == 0:
                d.rounded_rectangle([cx - 34, H // 2 - 34, cx + 34, H // 2 + 34], radius=24, outline=INK, width=22)
                d.rounded_rectangle([cx - 34, H // 2 - 34, cx + 34, H // 2 + 34], radius=24, outline=(102, 108, 118, 255), width=12)
                d.arc([cx - 28, H // 2 - 28, cx + 28, H // 2 + 28], 200, 340, fill=(162, 170, 182, 210), width=4)
            else:
                d.rounded_rectangle([cx - 44, H // 2 - 14, cx + 44, H // 2 + 14], radius=12, fill=(84, 90, 98, 255), outline=INK, width=5)
                d.line([cx - 32, H // 2 - 4, cx + 32, H // 2 - 4], fill=(154, 162, 174, 210), width=4)
    elif style == "aether_pipe":
        # Brass-ringed glowing cyan skyship aether fuel conduit pipe
        d.rectangle([0, H // 2 - 34, W, H // 2 + 34], fill=(*BRASS_LO, 255), outline=INK, width=6)
        d.rectangle([0, H // 2 - 18, W, H // 2 + 18], fill=(*CYAN_AETHER, 240), outline=INK, width=4)
        d.line([0, H // 2 - 5, W, H // 2 - 5], fill=(225, 252, 255, 225), width=5)
        for fx in range(64, W, 128):
            d.rectangle([fx - 18, H // 2 - 46, fx + 18, H // 2 + 46], fill=(*BRASS, 255), outline=INK, width=5)
            d.line([fx - 8, H // 2 - 38, fx - 8, H // 2 + 38], fill=(*BRASS_HI, 220), width=4)
    elif style == "keel_frame":
        # Shipyard exposed timber keel spine & paired hull ribs!
        for rx in range(48, W, 96):
            d.rectangle([rx - 18, 22, rx + 18, H - 22], fill=jitter(rng, (166, 124, 76), 9), outline=INK, width=5)
            d.line([rx - 6, 28, rx - 6, H - 28], fill=(208, 168, 114, 180), width=4)
        # Central heavy oak keel beam running lengthwise
        d.rectangle([0, H // 2 - 32, W, H // 2 + 32], fill=(128, 86, 48, 255), outline=INK, width=6)
        d.line([0, H // 2 - 14, W, H // 2 - 14], fill=(176, 128, 78, 200), width=5)
        for rx in range(48, W, 96):
            d.ellipse([rx - 7, H // 2 - 7, rx + 7, H // 2 + 7], fill=(82, 86, 94, 255), outline=INK, width=3)
    else:
        # Cleated wooden boarding gangplank walkway
        d.rectangle([0, 44, W, H - 44], fill=(138, 98, 60, 255), outline=INK, width=6)
        for py in (84, 128, 172):
            d.line([0, py, W, py], fill=INK, width=4)
        for cx in range(42, W, 84):
            d.rectangle([cx - 10, 48, cx + 10, H - 48], fill=(176, 134, 86, 255), outline=INK, width=4)
            d.ellipse([cx - 3, 62, cx + 3, 68], fill=INK)
            d.ellipse([cx - 3, H - 68, cx + 3, H - 62], fill=INK)

    im = add_grain(im, seed + 29, 5, seamless=True)
    return im.resize((512, 128), Image.Resampling.LANCZOS)


def make_ship_portal(seed: int, style: str) -> Image.Image:
    W, H = 512, 256
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if style == "cabin_door":
        # Heavy oak & brass-bound ship cabin door (top-down carve portal)
        d.rectangle([24, 72, W - 24, H - 72], fill=(116, 72, 42, 255), outline=INK, width=7)
        d.rectangle([38, 86, W - 38, H - 86], fill=(144, 92, 54, 255), outline=(*BRASS, 255), width=6)
        # Brass strap hinges & central wheel handle
        for hx in (76, W - 76):
            d.rectangle([hx - 16, 70, hx + 16, H - 70], fill=(*BRASS, 255), outline=INK, width=4)
        d.ellipse([W // 2 - 22, H // 2 - 22, W // 2 + 22, H // 2 + 22], fill=(*BRASS_HI, 255), outline=INK, width=5)
    elif style == "porthole":
        # Circular brass hull porthole window framed in oak/steel collar
        d.rectangle([36, 86, W - 36, H - 86], fill=(*BRASS_LO, 255), outline=INK, width=6)
        d.rectangle([62, 98, W - 62, H - 98], fill=(92, 198, 232, 255), outline=(*BRASS_HI, 255), width=6)
        d.line([74, 114, W - 74, 114], fill=(220, 248, 255, 220), width=6)
        for bx in (54, W // 2, W - 54):
            d.ellipse([bx - 10, 82, bx + 10, 102], fill=(*BRASS_HI, 255), outline=INK, width=3)
            d.ellipse([bx - 10, H - 102, bx + 10, H - 82], fill=(*BRASS_HI, 255), outline=INK, width=3)
    else:
        # Hinged naval cannon gunport shutter with iron chain rings
        d.rectangle([28, 66, W - 28, H - 66], fill=(78, 52, 34, 255), outline=INK, width=7)
        for py in (98, 128, 158):
            d.line([34, py, W - 34, py], fill=INK, width=4)
        for bx in (110, W - 110):
            d.rectangle([bx - 14, 62, bx + 14, H - 62], fill=(72, 78, 88, 255), outline=INK, width=4)
            d.ellipse([bx - 14, H // 2 - 14, bx + 14, H // 2 + 14], outline=(168, 174, 184, 255), width=5)

    im = add_grain(im, seed + 61, 5, seamless=False)
    return im.resize((256, 128), Image.Resampling.LANCZOS)


def resolve_sheet_path(spec: dict[str, Any]) -> pathlib.Path:
    if "glob" in spec:
        matches = sorted(SHEET_DIR.glob(spec["glob"]), key=lambda p: p.stat().st_mtime, reverse=True)
        if not matches:
            raise FileNotFoundError(f"No sprite sheet matching {spec['glob']} in {SHEET_DIR}")
        return matches[0]
    p = SHEET_DIR / spec["file"]
    if not p.exists():
        raise FileNotFoundError(f"Missing sprite sheet: {p}")
    return p


def main() -> None:
    manifest_path = OUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    existing_by_path: dict[str, dict[str, Any]] = {a["path"]: a for a in manifest["assets"]}

    added_count = 0
    structural_previews: list[tuple[str, Image.Image]] = []
    prop_samples: list[tuple[str, Image.Image]] = []

    def register(
        rel_path: str,
        img: Image.Image,
        display_name: str,
        category: str,
        tags: list[str],
        draw_mode: str = "normal",
        default_ppi: int = 256,
        casts_shadow: bool = True,
    ) -> None:
        nonlocal added_count
        out = OUT_DIR / rel_path
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, "PNG", optimize=True)
        entry = {
            "path": rel_path.replace("\\", "/"),
            "displayName": display_name,
            "category": category,
            "tags": sorted(set(tags + ["shipbuilding", "cc0", "modular_cc0"])),
            "drawMode": draw_mode,
            "defaultPpi": default_ppi,
            "castsShadow": casts_shadow,
            "dominantHex": dominant_hex(img),
            "widthPx": img.width,
            "heightPx": img.height,
        }
        existing_by_path[entry["path"]] = entry
        added_count += 1

    # 1. Slice all 12 4x4 Ship & Airship Sprite Sheets (192 Individual Props!)
    for s_idx, spec in enumerate(SHIP_SHEETS):
        sheet_path = resolve_sheet_path(spec)
        sheet = Image.open(sheet_path)
        xs, ys = find_grid_cuts_n(sheet, 4, 4)
        pack = spec["pack"]

        overrides = spec.get("cell_overrides", {})
        for idx, item in enumerate(spec["items"]):
            slug, name, tags, target_cells, casts_shadow, clear_int = item
            if idx in overrides:
                fx0, fy0, fx1, fy1 = overrides[idx]
                cell = sheet.crop((
                    int(round(sheet.width * fx0)),
                    int(round(sheet.height * fy0)),
                    int(round(sheet.width * fx1)),
                    int(round(sheet.height * fy1)),
                ))
            else:
                col = idx % 4
                row = idx // 4
                cell = sheet.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
            clean = remove_white_bg_clean(cell, clear_interior_white=clear_int)
            # Scale proportionally so defaultPpi=256 displays at natural tabletop scale (target_cells)
            max_dim = max(clean.width, clean.height, 1)
            target_px = max(96, min(512, int(round(target_cells * 160))))
            scale = target_px / max_dim
            final_img = clean.resize(
                (max(24, int(round(clean.width * scale))), max(24, int(round(clean.height * scale)))),
                Image.Resampling.LANCZOS,
            )
            ppi = max(96, int(round(max(final_img.width, final_img.height) / max(0.35, target_cells))))
            register(
                f"props/{pack}/{slug}.png",
                final_img,
                name,
                "object",
                tags,
                default_ppi=ppi,
                casts_shadow=casts_shadow,
            )
            if idx < 2:
                prop_samples.append((name, final_img))

    # 2. Generate 20 Procedural Shipbuilding Structural Assets
    # 6 Deck Terrains
    for seed, style, slug, name, tags, dm in [
        (5101, "teak", "ship_deck_teak_planks", "Caulked Teak Ship Decking", ["ship", "boat", "deck", "wood", "planks"], "normal"),
        (5102, "oak", "ship_deck_weathered_oak", "Weathered Pirate Oak Decking", ["ship", "pirate", "boat", "deck", "wood"], "normal"),
        (5103, "brass_grate", "skyship_deck_brass_grate", "Magi-Punk Brass-Riveted Skyship Deck", ["ship", "airship", "skyship", "deck", "brass", "tech"], "normal"),
        (5104, "mahogany", "skyship_deck_mahogany_inlay", "Aristocratic Mahogany & Gold Ship Deck", ["ship", "airship", "skyship", "captain", "deck", "wood"], "normal"),
        (5105, "hold", "ship_hold_dark_timber", "Dark Bilge & Cargo Hold Timber", ["ship", "airship", "cargo", "hold", "deck", "wood"], "normal"),
        (5106, "colorable", "ship_deck_colorable_planks", "Colorable Ship Deck Planks", ["ship", "airship", "boat", "deck", "colorable", "planks"], "dd_red"),
    ]:
        im = make_deck_terrain(seed, style)
        register(f"terrain/{slug}.png", im, name, "terrain", tags, draw_mode=dm, casts_shadow=False)
        structural_previews.append((name, im))

    # 6 Hull & Bulkhead Smart Walls
    for seed, style, slug, name, tags, dm in [
        (5201, "oak", "ship_hull_oak_gunwale", "Oak Ship Hull & Gunwale Wall", ["ship", "boat", "hull", "gunwale", "wood"], "normal"),
        (5202, "ironclad", "ship_hull_ironclad_riveted", "Ironclad Riveted Steel Hull Wall", ["ship", "airship", "hull", "iron", "steel"], "normal"),
        (5203, "skyship_aether", "skyship_hull_brass_aether", "Magi-Punk Brass & Aether Hull Wall", ["ship", "airship", "skyship", "hull", "brass", "aether"], "normal"),
        (5204, "railing", "ship_railing_carved_oak", "Quarterdeck Carved Oak Balustrade", ["ship", "airship", "railing", "deck", "wood"], "normal"),
        (5205, "cabin", "ship_bulkhead_cabin_wood", "Interior Ship Cabin Bulkhead Wall", ["ship", "airship", "cabin", "bulkhead", "wood"], "normal"),
        (5206, "colorable", "ship_hull_colorable", "Colorable Ship Hull Gunwale", ["ship", "airship", "boat", "hull", "colorable"], "dd_red"),
    ]:
        im = make_ship_wall(seed, style)
        register(f"walls/{slug}.png", im, name, "wall", tags, draw_mode=dm, casts_shadow=True)
        structural_previews.append((name, im))

    # 5 Rigging, Chain, Pipe & Shipyard Paths
    for seed, style, slug, name, tags in [
        (5301, "rigging_net", "ship_rigging_rope_net", "Rope Ratlines & Rigging Netting", ["ship", "airship", "rigging", "rope", "ladder"]),
        (5302, "anchor_chain", "ship_anchor_chain_path", "Heavy Iron Anchor Chain", ["ship", "airship", "anchor", "chain", "iron"]),
        (5303, "aether_pipe", "skyship_aether_rail_pipe", "Brass & Cyan Aether Fuel Pipe", ["ship", "airship", "skyship", "aether", "pipe", "brass"]),
        (5304, "keel_frame", "ship_timber_keel_frame", "Shipyard Timber Keel & Ribs Framing", ["ship", "shipyard", "keel", "hull", "construction"]),
        (5305, "gangplank", "ship_gangplank_walkway", "Wooden Cleated Gangplank Ramp", ["ship", "boat", "docks", "boarding", "bridge"]),
    ]:
        im = make_ship_path(seed, style)
        register(f"paths/{slug}.png", im, name, "path", tags, casts_shadow=False)
        structural_previews.append((name, im))

    # 3 Carve-Ready Ship Portals
    for seed, style, slug, name, tags in [
        (5401, "cabin_door", "ship_cabin_brass_door", "Brass-Bound Ship Cabin Door", ["ship", "airship", "door", "cabin", "brass"]),
        (5402, "porthole", "ship_brass_porthole", "Circular Brass Hull Porthole Window", ["ship", "airship", "window", "porthole", "brass"]),
        (5403, "gunport", "ship_gunport_shutter", "Hinged Naval Cannon Gunport Shutter", ["ship", "cannon", "gunport", "hull", "window"]),
    ]:
        im = make_ship_portal(seed, style)
        register(f"portals/{slug}.png", im, name, "portal", tags, casts_shadow=False)
        structural_previews.append((name, im))

    # Save updated manifest.json & rebuild DiceChaos_Modular_Suite_CC0.dcpack
    manifest["assets"] = list(existing_by_path.values())
    manifest["assetCount"] = len(manifest["assets"])
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for fp in sorted(OUT_DIR.rglob("*")):
            if fp.is_file():
                zf.write(fp, fp.relative_to(OUT_DIR).as_posix())

    # Build QA Contact Sheets for Visual Inspection
    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    # 1. All 20 Structural Assets
    st_sheet = Image.new("RGBA", (1160, 860), (22, 26, 36, 255))
    sd = ImageDraw.Draw(st_sheet)
    for i, (lbl, im) in enumerate(structural_previews[:6]):
        x = 20 + i * 188
        st_sheet.alpha_composite(im.resize((168, 168), Image.Resampling.LANCZOS), (x, 30))
        sd.text((x, 10), lbl[:24], fill=(235, 240, 248, 255))
    for i, (lbl, im) in enumerate(structural_previews[6:17]):
        col = i % 3
        row = i // 3
        x = 20 + col * 376
        y = 220 + row * 124
        st_sheet.alpha_composite(im.resize((340, 85), Image.Resampling.LANCZOS), (x, y + 20))
        sd.text((x, y), lbl[:38], fill=(235, 240, 248, 255))
    for i, (lbl, im) in enumerate(structural_previews[17:]):
        x = 20 + i * 360
        y = 720
        st_sheet.alpha_composite(im.resize((220, 110), Image.Resampling.LANCZOS), (x, y + 20))
        sd.text((x, y), lbl[:34], fill=(235, 240, 248, 255))
    qa_struct = SCRATCH_DIR / "qa_ship_structural_20.png"
    st_sheet.save(qa_struct)

    # 2. Sample of 24 Sliced Transparent Props (2 per sheet across all 12 sheets!) on dark checkerboard
    pr_sheet = Image.new("RGBA", (1200, 820), (30, 36, 48, 255))
    pd = ImageDraw.Draw(pr_sheet)
    for idx, (lbl, im) in enumerate(prop_samples[:24]):
        col = idx % 6
        row = idx // 6
        x = 18 + col * 196
        y = 18 + row * 198
        pd.rectangle([x, y + 20, x + 178, y + 188], fill=(42, 48, 62, 255), outline=(72, 82, 102, 255))
        scale = min(158 / max(1, im.width), 148 / max(1, im.height))
        th = im.resize((max(8, int(im.width * scale)), max(8, int(im.height * scale))), Image.Resampling.LANCZOS)
        pr_sheet.alpha_composite(th, (x + (178 - th.width) // 2, y + 20 + (168 - th.height) // 2))
        pd.text((x + 2, y + 2), lbl[:24], fill=(235, 240, 248, 255))
    qa_props = SCRATCH_DIR / "qa_ship_props_sample24.png"
    pr_sheet.save(qa_props)

    print(
        f"SUCCESS! Built & registered {added_count} new shipbuilding & airship CC0 assets! "
        f"Modular suite total: {manifest['assetCount']} | "
        f"dcpack: {DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB"
    )


if __name__ == "__main__":
    main()

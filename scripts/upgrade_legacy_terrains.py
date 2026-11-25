"""
Upgrade all legacy procedural/blurry battlemap terrains across starter-cc0,
core-fantasy-cc0, and modular-suite-cc0 to cohesive hand-inked painterly
512x512 seamlessly tileable CC0 PNGs matching our newest outdoor terrain suite,
plus add the new Lush Park & Meadow Grass tile (`terrain_trimmed_park_lawn.png`).

Also rebuilds updated `.dcpack` archives and emits 2x2 repeat QA contact sheets.
"""

from __future__ import annotations

import json
import math
import pathlib
import zipfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ARTIFACTS_DIR = pathlib.Path(
    r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae"
)
ASSETS_ROOT = pathlib.Path("public/assets")
MODULAR_DIR = ASSETS_ROOT / "modular-suite-cc0"
CORE_DIR = ASSETS_ROOT / "core-fantasy-cc0"
STARTER_DIR = ASSETS_ROOT / "starter-cc0"
QA_DIR = ARTIFACTS_DIR / "scratch" / "terrain_upgrade_qa"

SOURCES = {
    "clean_grass": "hq_terrain_clean_grass_v2_1795504626895.jpg",
    "wildflower": "hq_terrain_wildflower_meadow_1795504508989.jpg",
    "forest_moss": "hq_terrain_forest_moss_1795504469482.jpg",
    "graveyard_turf": "hq_terrain_graveyard_turf_1795504525798.jpg",
    "autumn_leaves": "hq_terrain_autumn_leaves_1795504477794.jpg",
    "dirt_trail": "hq_terrain_dirt_trail_1795504496740.jpg",
    "sandy": "hq_terrain_sandy_riverbank_v2_1795504625367.jpg",
    "limestone": "hq_terrain_limestone_gravel_1795504522969.jpg",
    "rocky_slate": "hq_terrain_rocky_slate_1795504552557.jpg",
    "muddy_mire": "hq_terrain_muddy_mire_v3_1795504645999.jpg",
    "cracked_mud": "hq_terrain_cracked_mud_1795504673465.jpg",
    "stable_straw": "hq_terrain_stable_straw_final_1795504746181.jpg",
    "cavern_stone": "hq_terrain_cavern_stone_1795504732494.jpg",
    "soot_ash": "hq_terrain_soot_ash_v2_1795504729795.jpg",
    "river_cobbles": "hq_terrain_river_cobbles_1795504717623.jpg",
    "winter_snow": "hq_terrain_winter_snow_1795504821277.jpg",
    "snow_grass": "hq_terrain_snow_grass_1795504838285.jpg",
    "frozen_ice": "hq_terrain_frozen_ice_1795504803773.jpg",
    "volcanic_basalt": "hq_terrain_volcanic_basalt_1795504792464.jpg",
    "shallow_water": "hq_terrain_shallow_water_1795504928144.jpg",
    "deep_water": "hq_terrain_deep_water_1795504908512.jpg",
    "swamp_water": "hq_terrain_swamp_water_1795504923111.jpg",
    "chasm_mist": "hq_terrain_chasm_mist_1795504905282.jpg",
    "tavern_oak": "hq_terrain_tavern_oak_1795504502610.jpg",
}


def make_seamless_organic(src_path: pathlib.Path, size: int = 512, level_strength: float = 0.65) -> Image.Image:
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    side = int(min(w, h) * 0.96)
    x0 = (w - side) // 2
    y0 = (h - side) // 2
    im = im.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.Resampling.LANCZOS)

    arr = np.asarray(im, dtype=np.float32)

    # Gentle low-frequency illumination leveling
    blur_im = im.filter(ImageFilter.GaussianBlur(radius=size // 6))
    blur_arr = np.asarray(blur_im, dtype=np.float32)
    mean_rgb = arr.mean(axis=(0, 1), keepdims=True)
    leveled = np.clip(arr - (blur_arr - mean_rgb) * level_strength, 0, 255)

    # Periodic sinusoidal diamond wrap with organic ripple perturbation
    shifted = np.roll(np.roll(leveled, size // 2, axis=0), size // 2, axis=1)
    y_idx = np.linspace(0.0, 1.0, size, endpoint=False)[:, None]
    x_idx = np.linspace(0.0, 1.0, size, endpoint=False)[None, :]
    wx = np.sin(math.pi * x_idx) ** 2
    wy = np.sin(math.pi * y_idx) ** 2
    raw_w = wx * wy
    ripple = (
        0.04 * np.sin(2 * math.pi * (x_idx * 3.0 + y_idx * 2.0))
        + 0.03 * np.cos(2 * math.pi * (x_idx * 2.0 - y_idx * 4.0))
    )
    mask = np.clip((raw_w - 0.12 + ripple * (4 * raw_w * (1 - raw_w))) / 0.56, 0.0, 1.0)
    mask = mask * mask * (3.0 - 2.0 * mask)
    mask3 = mask[:, :, None]

    blended = leveled * mask3 + shifted * (1.0 - mask3)
    overlap = 4.0 * mask * (1.0 - mask)
    local_mean = np.asarray(
        Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=6)),
        dtype=np.float32,
    )
    sharpened = np.clip(blended + (blended - local_mean) * (0.28 * overlap[:, :, None]), 0, 255)
    out_rgba = np.dstack([sharpened.astype(np.uint8), np.full((size, size), 255, dtype=np.uint8)])
    return Image.fromarray(out_rgba, "RGBA")


def make_seamless_planks(src_path: pathlib.Path, size: int = 512) -> Image.Image:
    """
    Make horizontal wooden floorboards seamlessly tileable WITHOUT blurring plank seams:
    1. Snap top/bottom crop strictly to detected dark horizontal plank seam rows.
    2. Blend seamlessly along X only (horizontal feather across plank middles).
    """
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    arr = np.asarray(im, dtype=np.float32)
    row_lum = arr.mean(axis=(1, 2))

    # Find darkest horizontal seam near top (2%..14%) and bottom (86%..98%)
    top_band = row_lum[int(h * 0.02) : int(h * 0.14)]
    bot_band = row_lum[int(h * 0.86) : int(h * 0.98)]
    y_top = int(h * 0.02) + int(np.argmin(top_band))
    y_bot = int(h * 0.86) + int(np.argmin(bot_band))
    if y_bot - y_top < int(h * 0.6):
        y_top, y_bot = 0, h

    # Crop exact integer plank rows vertically, slight 2% X margin
    x_pad = int(w * 0.02)
    cropped = im.crop((x_pad, y_top, w - x_pad, y_bot)).resize((size, size), Image.Resampling.LANCZOS)
    c_arr = np.asarray(cropped, dtype=np.float32)

    # Gentle macro illumination leveling (preserve plank-to-plank tonal richness!)
    blur_arr = np.asarray(cropped.filter(ImageFilter.GaussianBlur(radius=size // 4)), dtype=np.float32)
    mean_rgb = c_arr.mean(axis=(0, 1), keepdims=True)
    leveled = np.clip(c_arr - (blur_arr - mean_rgb) * 0.45, 0, 255)

    # 1D horizontal periodic seamless wrap (preserves 100% razor-sharp horizontal plank seams!)
    shifted_x = np.roll(leveled, size // 2, axis=1)
    x_idx = np.linspace(0.0, 1.0, size, endpoint=False)[None, :]
    wx = np.sin(math.pi * x_idx) ** 2
    mask = np.clip((wx - 0.14) / 0.50, 0.0, 1.0)
    mask = mask * mask * (3.0 - 2.0 * mask)
    mask3 = mask[:, :, None]
    blended = leveled * mask3 + shifted_x * (1.0 - mask3)

    # Tiny 3px vertical edge reconciliation right on the top/bottom dark seam line
    seam = 0.5 * (blended[0:2, :, :] + blended[-2:, :, :])
    blended[0:2, :, :] = seam
    blended[-2:, :, :] = seam

    out_rgba = np.dstack([np.clip(blended, 0, 255).astype(np.uint8), np.full((size, size), 255, dtype=np.uint8)])
    return Image.fromarray(out_rgba, "RGBA")


def grade_tile(
    tile: Image.Image,
    rgb_mul: tuple[float, float, float] = (1.0, 1.0, 1.0),
    rgb_add: tuple[float, float, float] = (0.0, 0.0, 0.0),
    rotate_k: int = 0,
    flip_h: bool = False,
) -> Image.Image:
    out = tile
    if rotate_k % 4 != 0:
        out = out.rotate(90 * (rotate_k % 4))
    if flip_h:
        out = out.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    arr = np.asarray(out, dtype=np.float32)
    rgb = arr[:, :, :3]
    for c in range(3):
        rgb[:, :, c] = np.clip(rgb[:, :, c] * rgb_mul[c] + rgb_add[c], 0, 255)
    out_arr = np.dstack([rgb.astype(np.uint8), arr[:, :, 3].astype(np.uint8)])
    return Image.fromarray(out_arr, "RGBA")


def update_dcpack_from_dir(pack_dir: pathlib.Path, dcpack_path: pathlib.Path) -> None:
    with zipfile.ZipFile(dcpack_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for f in sorted(pack_dir.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(pack_dir).as_posix())
    print(f"Rebuilt {dcpack_path} ({dcpack_path.stat().st_size / (1024 * 1024):.2f} MB)")


def refresh_subset_dcpack(starter_dir: pathlib.Path, dcpack_path: pathlib.Path) -> None:
    """Replace any matching existing entries inside a starter subset .dcpack with upgraded PNGs."""
    if not dcpack_path.exists():
        return
    tmp = dcpack_path.with_suffix(".dcpack.tmp")
    updated = 0
    with zipfile.ZipFile(dcpack_path, "r") as zin, zipfile.ZipFile(
        tmp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6
    ) as zout:
        for info in zin.infolist():
            local_match = starter_dir / info.filename
            if info.filename.startswith("terrain/") and local_match.is_file():
                zout.write(local_match, info.filename)
                updated += 1
            else:
                zout.writestr(info, zin.read(info.filename))
    tmp.replace(dcpack_path)
    print(f"Refreshed {dcpack_path} ({updated} terrain entries synced)")


def main() -> None:
    QA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Build all 24 seamless base tiles
    base_tiles: dict[str, Image.Image] = {}
    for key, fname in SOURCES.items():
        src = ARTIFACTS_DIR / fname
        if not src.exists():
            raise FileNotFoundError(f"Missing generated source: {src}")
        if key == "tavern_oak":
            base_tiles[key] = make_seamless_planks(src, 512)
        elif key in ("deep_water", "chasm_mist"):
            base_tiles[key] = make_seamless_organic(src, 512, level_strength=0.80)
        else:
            base_tiles[key] = make_seamless_organic(src, 512, level_strength=0.65)
        print(f"Seamless base ready: {key}")

    # 2. Emit two 2x2 repeat QA contact sheets (12 base tiles per sheet = 24 total)
    keys_list = list(base_tiles.keys())
    for sheet_idx in range(2):
        chunk = keys_list[sheet_idx * 12 : (sheet_idx + 1) * 12]
        cols, rows = 4, 3
        tp = 160
        cw, ch = tp * 2 + 12, tp * 2 + 32
        sheet = Image.new("RGB", (cols * cw, rows * ch), (18, 22, 30))
        draw = ImageDraw.Draw(sheet)
        for i, k in enumerate(chunk):
            r, c = divmod(i, cols)
            ox, oy = c * cw + 6, r * ch + 6
            sm = base_tiles[k].convert("RGB").resize((tp, tp), Image.Resampling.LANCZOS)
            for dy in range(2):
                for dx in range(2):
                    sheet.paste(sm, (ox + dx * tp, oy + dy * tp))
            draw.text((ox + 2, oy + tp * 2 + 6), f"{sheet_idx * 12 + i + 1}. {k}", fill=(238, 242, 248))
        out_qa = QA_DIR / f"upgraded_terrains_2x2_qa_{sheet_idx + 1}.png"
        sheet.save(out_qa)
        print(f"Saved QA sheet: {out_qa}")

    # 3. Map every upgraded target across all 3 CC0 packs (36 legacy upgrades + 1 new clean park lawn!)
    targets: list[tuple[pathlib.Path, str, tuple[float, float, float], tuple[float, float, float], int, bool]] = [
        # --- Grass & Greenery ---
        (CORE_DIR / "terrain/meadow_grass.png", "clean_grass", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/terrain_trimmed_park_lawn.png", "clean_grass", (1.04, 1.05, 0.96), (4, 5, 0), 1, True),
        (CORE_DIR / "terrain/wildflower_meadow.png", "wildflower", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/wildflower_meadow.png", "wildflower", (1.03, 1.04, 1.01), (3, 4, 0), 2, True),
        (CORE_DIR / "terrain/forest_moss_floor.png", "forest_moss", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (STARTER_DIR / "terrain/mountain_pine_moss.png", "forest_moss", (0.90, 0.95, 0.96), (0, 0, 3), 1, True),
        (MODULAR_DIR / "terrain/graveyard_moss_grass.png", "graveyard_turf", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (CORE_DIR / "terrain/autumn_leaf_litter.png", "autumn_leaves", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),

        # --- Earth, Sand, Mud, Straw & Cracked Ground ---
        (CORE_DIR / "terrain/dirt_trail_earth.png", "dirt_trail", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (CORE_DIR / "terrain/sandy_riverbank.png", "sandy", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/shore_wet_sand_pebbles.png", "sandy", (0.86, 0.85, 0.84), (-6, -4, 2), 1, True),
        (CORE_DIR / "terrain/muddy_mire.png", "muddy_mire", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/swamp_bog_mire.png", "muddy_mire", (0.88, 0.98, 0.86), (-4, 5, -2), 2, True),
        (MODULAR_DIR / "terrain/cracked_mud_flat.png", "cracked_mud", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (CORE_DIR / "terrain/stable_straw_floor.png", "stable_straw", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/barn_straw_earth.png", "stable_straw", (0.88, 0.85, 0.80), (-6, -8, -8), 1, True),

        # --- Limestone Gravel Street, Slate, Cavern Rock, Ash, River Cobbles & Lava ---
        (MODULAR_DIR / "terrain/garden_gravel_walk.png", "limestone", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (CORE_DIR / "terrain/rocky_cliff_slate.png", "rocky_slate", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (STARTER_DIR / "terrain/alpine_slate_rock.png", "rocky_slate", (0.94, 0.98, 1.08), (-2, 0, 10), 1, True),
        (CORE_DIR / "terrain/cavern_rough_stone.png", "cavern_stone", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/underdark_shale.png", "cavern_stone", (0.90, 0.88, 1.08), (0, -2, 12), 2, True),
        (CORE_DIR / "terrain/soot_ash_floor.png", "soot_ash", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/river_cobble_bed.png", "river_cobbles", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/shore_lakebed_stones.png", "river_cobbles", (0.80, 0.94, 1.04), (-10, 4, 14), 1, True),
        (CORE_DIR / "terrain/volcanic_basalt.png", "volcanic_basalt", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),

        # --- Snow & Ice ---
        (CORE_DIR / "terrain/winter_snowfield.png", "winter_snow", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (STARTER_DIR / "terrain/alpine_snow_crag.png", "winter_snow", (0.94, 0.97, 1.02), (-4, -1, 4), 1, True),
        (MODULAR_DIR / "terrain/snow_dusted_grass.png", "snow_grass", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/frozen_lake_ice.png", "frozen_ice", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),

        # --- Water & Mist ---
        (MODULAR_DIR / "terrain/water_tropical_lagoon.png", "shallow_water", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (CORE_DIR / "terrain/shallow_creek_bed.png", "shallow_water", (0.86, 0.95, 0.98), (-8, -2, 2), 1, True),
        (CORE_DIR / "terrain/deep_pond_water.png", "deep_water", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (MODULAR_DIR / "terrain/water_alpine_crystal.png", "deep_water", (1.08, 1.24, 1.30), (6, 22, 30), 1, False),
        (MODULAR_DIR / "terrain/water_deep_ocean_swell.png", "deep_water", (0.82, 0.92, 1.12), (-4, 0, 16), 2, True),
        (STARTER_DIR / "terrain/berlin_canal_dark.png", "deep_water", (0.72, 0.80, 0.84), (-8, -4, -2), 3, False),
        (MODULAR_DIR / "terrain/water_murky_swamp_bayou.png", "swamp_water", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
        (STARTER_DIR / "terrain/chasm_abyss_mist.png", "chasm_mist", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),

        # --- Hand-Inked Warm Oak Tavern Planks ---
        (CORE_DIR / "terrain/tavern_oak_planks.png", "tavern_oak", (1.0, 1.0, 1.0), (0, 0, 0), 0, False),
    ]

    for out_path, src_key, mul, add, rot_k, flip_h in targets:
        out_path.parent.mkdir(parents=True, exist_ok=True)
        graded = grade_tile(base_tiles[src_key], mul, add, rot_k, flip_h)
        graded.save(out_path, optimize=True)
        print(f"Wrote {out_path.as_posix()} <- {src_key}")

    # 4. Upsert the brand-new Lush Park & Meadow Grass tile into modular-suite-cc0/manifest.json
    mod_manifest_path = MODULAR_DIR / "manifest.json"
    manifest = json.loads(mod_manifest_path.read_text(encoding="utf-8"))
    assets: list[dict] = manifest.get("assets", [])
    rel_new = "terrain/terrain_trimmed_park_lawn.png"
    new_entry = {
        "path": rel_new,
        "displayName": "Lush Park & Meadow Grass",
        "category": "terrain",
        "tags": ["grass", "meadow", "lawn", "park", "green", "turf", "outdoor", "nature", "terrain", "hq"],
        "drawMode": "normal",
    }
    found_idx = next((i for i, a in enumerate(assets) if a.get("path") == rel_new), None)
    if found_idx is not None:
        assets[found_idx] = new_entry
    else:
        assets.append(new_entry)
    manifest["assets"] = assets
    mod_manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {mod_manifest_path} -> {len(assets)} total assets")

    # 5. Rebuild updated .dcpack archives
    update_dcpack_from_dir(CORE_DIR, ASSETS_ROOT / "DiceChaos_Core_Fantasy_CC0.dcpack")
    update_dcpack_from_dir(MODULAR_DIR, ASSETS_ROOT / "DiceChaos_Modular_Suite_CC0.dcpack")
    refresh_subset_dcpack(STARTER_DIR, ASSETS_ROOT / "DiceChaos_Berlin_Magipunk_Starter.dcpack")
    refresh_subset_dcpack(STARTER_DIR, ASSETS_ROOT / "DiceChaos_Funicular_Starter.dcpack")
    print(f"ALL DONE: upgraded/added {len(targets)} battlemap terrain PNGs!")


if __name__ == "__main__":
    main()

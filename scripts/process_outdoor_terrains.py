"""
Process 10 hand-painted top-down outdoor terrain tiles into 100% seamlessly
tileable, evenly lit, opaque 512x512 CC0 PNGs, update modular-suite-cc0/manifest.json,
rebuild DiceChaos_Modular_Suite_CC0.dcpack, and emit a 2x2 repeat QA contact sheet.
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
MODULAR_DIR = pathlib.Path("public/assets/modular-suite-cc0")
TERRAIN_DIR = MODULAR_DIR / "terrain"
MANIFEST_PATH = MODULAR_DIR / "manifest.json"
DCPACK_PATH = pathlib.Path("public/assets/DiceChaos_Modular_Suite_CC0.dcpack")
QA_SHEET_PATH = ARTIFACTS_DIR / "scratch" / "new_outdoor_terrains_2x2_qa.png"

NEW_TERRAINS = [
    {
        "src": "terrain_lush_clover_grass_1795403369537.jpg",
        "filename": "terrain_lush_clover_grass.png",
        "displayName": "Lush Meadow & Clover Grass",
        "tags": ["grass", "meadow", "clover", "green", "lawn", "pasture", "outdoor", "nature", "terrain"],
    },
    {
        "src": "terrain_pine_needle_forest_1795403282642.jpg",
        "filename": "terrain_pine_needle_forest.png",
        "displayName": "Pine Needle & Woodland Moss",
        "tags": ["forest", "pine", "moss", "woodland", "needles", "grass", "outdoor", "nature", "terrain"],
    },
    {
        "src": "terrain_dry_steppe_grass_1795403308499.jpg",
        "filename": "terrain_dry_steppe_grass.png",
        "displayName": "Golden Savanna & Highland Scrub",
        "tags": ["grass", "savanna", "steppe", "dry", "golden", "highland", "plains", "outdoor", "terrain"],
    },
    {
        "src": "terrain_lush_mossy_turf_1795403270109.jpg",
        "filename": "terrain_lush_mossy_turf.png",
        "displayName": "Velvety Moss & Damp Bank Turf",
        "tags": ["moss", "turf", "grass", "lakeshore", "riverbank", "damp", "forest", "outdoor", "terrain"],
    },
    {
        "src": "terrain_packed_forest_dirt_1795403299317.jpg",
        "filename": "terrain_packed_forest_dirt.png",
        "displayName": "Packed Forest Dirt & Roots",
        "tags": ["dirt", "soil", "trail", "earth", "roots", "forest", "mud", "outdoor", "terrain"],
    },
    {
        "src": "terrain_pebbled_loam_gravel_1795403325554.jpg",
        "filename": "terrain_pebbled_loam_gravel.png",
        "displayName": "Pebbled Shingle & Riverbank Gravel",
        "tags": ["gravel", "shingle", "pebbles", "sand", "beach", "dirt", "shore", "outdoor", "terrain"],
    },
    {
        "src": "terrain_red_clay_badlands_1795403297850.jpg",
        "filename": "terrain_red_clay_badlands.png",
        "displayName": "Red Clay & Cracked Canyon Earth",
        "tags": ["dirt", "clay", "red", "badlands", "canyon", "mesa", "desert", "cracked", "outdoor", "terrain"],
    },
    {
        "src": "terrain_alpine_granite_bedrock_1795403285415.jpg",
        "filename": "terrain_alpine_granite_bedrock.png",
        "displayName": "Cracked Alpine Granite Bedrock",
        "tags": ["rock", "granite", "bedrock", "cliff", "mountain", "alpine", "stone", "outdoor", "terrain"],
    },
    {
        "src": "terrain_mossy_limestone_outcrop_1795403287866.jpg",
        "filename": "terrain_mossy_limestone_outcrop.png",
        "displayName": "Mossy Limestone & Forest Outcrop",
        "tags": ["rock", "limestone", "moss", "outcrop", "cliff", "stone", "ruins", "outdoor", "terrain"],
    },
    {
        "src": "terrain_mountain_scree_talus_1795403377512.jpg",
        "filename": "terrain_mountain_scree_talus.png",
        "displayName": "Mountain Scree & Slate Talus",
        "tags": ["rock", "scree", "talus", "slate", "gravel", "cliff", "mountain", "stone", "outdoor", "terrain"],
    },
]


def make_seamless_tile(src_path: pathlib.Path, size: int = 512) -> Image.Image:
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    # Trim 2% outer margin to strip any subtle border vignette, center-crop square
    side = int(min(w, h) * 0.96)
    x0 = (w - side) // 2
    y0 = (h - side) // 2
    im = im.crop((x0, y0, x0 + side, y0 + side)).resize((size, size), Image.Resampling.LANCZOS)

    arr = np.asarray(im, dtype=np.float32)

    # 1. Gentle low-frequency illumination leveling (eliminates any broad corner-to-corner gradient)
    blur_im = im.filter(ImageFilter.GaussianBlur(radius=size // 6))
    blur_arr = np.asarray(blur_im, dtype=np.float32)
    mean_rgb = arr.mean(axis=(0, 1), keepdims=True)
    # Correct 65% of slow macro lighting drift while preserving all organic texture variation
    leveled = np.clip(arr - (blur_arr - mean_rgb) * 0.65, 0, 255)

    # 2. Periodic seamless diamond blend with gentle sinusoidal wave perturbation
    # Guarantees mathematically continuous Left<->Right and Top<->Bottom edges with zero straight seam!
    shifted = np.roll(np.roll(leveled, size // 2, axis=0), size // 2, axis=1)

    y_idx = np.linspace(0.0, 1.0, size, endpoint=False)[:, None]
    x_idx = np.linspace(0.0, 1.0, size, endpoint=False)[None, :]

    # Periodic mask: 1.0 in interior of original, 0.0 along all 4 outer borders (where shifted is 1.0!)
    wx = np.sin(math.pi * x_idx) ** 2
    wy = np.sin(math.pi * y_idx) ** 2
    # Smoothly sharpen transition so interior retains 100% crisp hand-painted detail
    raw_w = wx * wy
    # Add tiny periodic organic ripple to break straight blend contour
    ripple = (
        0.04 * np.sin(2 * math.pi * (x_idx * 3.0 + y_idx * 2.0))
        + 0.03 * np.cos(2 * math.pi * (x_idx * 2.0 - y_idx * 4.0))
    )
    # Ensure exact 0 at borders (raw_w == 0) and exact 1 at center (raw_w == 1)
    mask = np.clip((raw_w - 0.12 + ripple * (4 * raw_w * (1 - raw_w))) / 0.56, 0.0, 1.0)
    # Smoothstep
    mask = mask * mask * (3.0 - 2.0 * mask)
    mask3 = mask[:, :, None]

    # Blend shifted into border region (and restore variance slightly in overlap transition to avoid soft blur)
    blended = leveled * mask3 + shifted * (1.0 - mask3)
    # Restore subtle micro-contrast in the 0.25..0.75 blend band so grass blades & pebbles stay razor-sharp
    overlap = 4.0 * mask * (1.0 - mask)  # peaks at 1.0 along transition band
    local_mean = (
        np.asarray(
            Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8)).filter(
                ImageFilter.GaussianBlur(radius=6)
            ),
            dtype=np.float32,
        )
    )
    sharpened = np.clip(blended + (blended - local_mean) * (0.28 * overlap[:, :, None]), 0, 255)

    out_rgba = np.dstack([sharpened.astype(np.uint8), np.full((size, size), 255, dtype=np.uint8)])
    return Image.fromarray(out_rgba, "RGBA")


def main() -> None:
    TERRAIN_DIR.mkdir(parents=True, exist_ok=True)
    QA_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Build 2x2 tiled verification sheet (5 columns x 2 rows)
    cols = 5
    rows = 2
    tile_preview = 160  # each tile shown 2x2 = 320x320!
    cell_w = tile_preview * 2 + 12
    cell_h = tile_preview * 2 + 34
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (16, 20, 28))
    draw = ImageDraw.Draw(sheet)

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assets: list[dict] = manifest.get("assets", [])
    existing_by_path = {a["path"]: idx for idx, a in enumerate(assets)}

    for idx, spec in enumerate(NEW_TERRAINS):
        src_path = ARTIFACTS_DIR / spec["src"]
        if not src_path.exists():
            raise FileNotFoundError(f"Missing generated terrain source: {src_path}")

        tile = make_seamless_tile(src_path, 512)
        out_path = TERRAIN_DIR / spec["filename"]
        tile.save(out_path, optimize=True)

        # Paste 2x2 repeat onto QA contact sheet
        small = tile.convert("RGB").resize((tile_preview, tile_preview), Image.Resampling.LANCZOS)
        r, c = divmod(idx, cols)
        ox = c * cell_w + 6
        oy = r * cell_h + 6
        for dy in range(2):
            for dx in range(2):
                sheet.paste(small, (ox + dx * tile_preview, oy + dy * tile_preview))
        draw.text((ox + 2, oy + tile_preview * 2 + 6), f"{idx + 1}. {spec['displayName']}", fill=(235, 240, 248))

        # Upsert into modular-suite-cc0/manifest.json
        rel_path = f"terrain/{spec['filename']}"
        entry = {
            "path": rel_path,
            "displayName": spec["displayName"],
            "category": "terrain",
            "tags": spec["tags"],
            "drawMode": "normal",
        }
        if rel_path in existing_by_path:
            assets[existing_by_path[rel_path]] = entry
        else:
            existing_by_path[rel_path] = len(assets)
            assets.append(entry)
        print(f"Processed {rel_path} ({spec['displayName']})")

    manifest["assets"] = assets
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {MANIFEST_PATH} -> {len(assets)} total assets")

    sheet.save(QA_SHEET_PATH)
    print(f"Saved 2x2 seamless QA sheet -> {QA_SHEET_PATH}")

    # Rebuild DiceChaos_Modular_Suite_CC0.dcpack
    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for f in sorted(MODULAR_DIR.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(MODULAR_DIR).as_posix())
    print(f"Rebuilt {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()

"""
Process 10 hand-inked top-down roof textures into phase-aligned, 100% seamlessly
tileable, evenly lit 512x512 CC0 PNGs, update modular-suite-cc0/manifest.json,
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
QA_SHEET_PATH = ARTIFACTS_DIR / "scratch" / "new_roof_textures_2x2_qa.png"

NEW_ROOFS = [
    {
        "src": "roof_terracotta_barrel_tiles_1795412777143.jpg",
        "filename": "roof_terracotta_barrel_tiles.png",
        "displayName": "Mediterranean Terracotta Barrel Roof",
        "tags": ["roof", "terracotta", "clay", "barrel", "tile", "spanish", "mediterranean", "village", "town", "shingle"],
        "target_courses": 6,
    },
    {
        "src": "roof_weathered_slate_shingles_1795412739405.jpg",
        "filename": "roof_weathered_slate_shingles.png",
        "displayName": "Weathered Alpine Slate Roof",
        "tags": ["roof", "slate", "shingle", "stone", "alpine", "grey", "castle", "townhouse", "medieval"],
        "target_courses": 8,
    },
    {
        "src": "roof_golden_thatch_straw_1795412742197.jpg",
        "filename": "roof_golden_thatch_straw.png",
        "displayName": "Cottage Golden Reed Thatch Roof",
        "tags": ["roof", "thatch", "straw", "reed", "cottage", "village", "farm", "rural", "peasant"],
        "target_courses": 5,
    },
    {
        "src": "roof_cedar_wood_shakes_1795412743705.jpg",
        "filename": "roof_cedar_wood_shakes.png",
        "displayName": "Weathered Cedar Wood Shakes Roof",
        "tags": ["roof", "wood", "cedar", "shake", "shingle", "timber", "cabin", "tavern", "lodge"],
        "target_courses": 6,
    },
    {
        "src": "roof_oxidized_verdigris_copper_v2_1795412778289.jpg",
        "filename": "roof_oxidized_verdigris_copper.png",
        "displayName": "Verdigris Copper Standing-Seam Roof",
        "tags": ["roof", "copper", "verdigris", "metal", "patina", "steampunk", "magipunk", "mansard", "mansion", "dome"],
        "target_courses": 2,
    },
    {
        "src": "roof_mossy_stone_tiles_1795412746911.jpg",
        "filename": "roof_mossy_stone_tiles.png",
        "displayName": "Mossy Ancient Stone Shingles Roof",
        "tags": ["roof", "stone", "moss", "ancient", "ruins", "cotswold", "castle", "druid", "shingle"],
        "target_courses": 6,
    },
    {
        "src": "roof_oriental_glazed_tiles_1795412911482.jpg",
        "filename": "roof_oriental_glazed_tiles.png",
        "displayName": "Imperial Emerald Glazed Tile Roof",
        "tags": ["roof", "glazed", "ceramic", "emerald", "jade", "pagoda", "temple", "oriental", "tile"],
        "target_courses": 6,
    },
    {
        "src": "roof_corrugated_iron_sheets_1795412750449.jpg",
        "filename": "roof_corrugated_iron_sheets.png",
        "displayName": "Rusted Corrugated Iron Roof",
        "tags": ["roof", "iron", "tin", "metal", "corrugated", "rust", "industrial", "dockyard", "workshop", "steampunk"],
        "target_courses": 4,
    },
    {
        "src": "roof_fishscale_cobalt_slate_1795412955592.jpg",
        "filename": "roof_fishscale_cobalt_slate.png",
        "displayName": "Ornate Cobalt Fishscale Roof",
        "tags": ["roof", "fishscale", "cobalt", "blue", "slate", "shingle", "victorian", "wizard", "tower", "turret"],
        "target_courses": 8,
    },
    {
        "src": "roof_snow_dusted_shingles_1795412783671.jpg",
        "filename": "roof_snow_dusted_shingles.png",
        "displayName": "Snow-Dusted Alpine Shingles Roof",
        "tags": ["roof", "snow", "winter", "frost", "alpine", "timber", "shingle", "cabin", "mountain"],
        "target_courses": 7,
    },
]


def detect_period_1d(profile: np.ndarray, min_lag: int, max_lag: int) -> int | None:
    """Find strongest repeating period in a 1D luminance profile via normalized autocorrelation."""
    sig = profile - profile.mean()
    norm = float(np.dot(sig, sig))
    if norm < 1e-6:
        return None
    best_lag = None
    best_score = -1.0
    n = len(sig)
    for lag in range(min_lag, min(max_lag, n // 2)):
        a = sig[:-lag]
        b = sig[lag:]
        denom = math.sqrt(float(np.dot(a, a) * np.dot(b, b))) + 1e-6
        score = float(np.dot(a, b)) / denom
        if score > best_score:
            best_score = score
            best_lag = lag
    return best_lag if best_score > 0.25 else None


def make_phase_aligned_seamless_roof(
    src_path: pathlib.Path,
    target_courses: int,
    size: int = 512,
) -> Image.Image:
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    # Trim 2% border safety margin first
    margin = int(min(w, h) * 0.02)
    im = im.crop((margin, margin, w - margin, h - margin))
    w, h = im.size
    arr = np.asarray(im, dtype=np.float32)

    # 1. Gentle low-frequency lighting leveling so tiled slopes have uniform base luminance
    blur_im = im.filter(ImageFilter.GaussianBlur(radius=max(16, min(w, h) // 7)))
    blur_arr = np.asarray(blur_im, dtype=np.float32)
    mean_rgb = arr.mean(axis=(0, 1), keepdims=True)
    leveled = np.clip(arr - (blur_arr - mean_rgb) * 0.60, 0, 255)

    # 2. Detect natural vertical course period (horizontal tile rows) to crop an exact integer multiple
    gray = 0.299 * leveled[:, :, 0] + 0.587 * leveled[:, :, 1] + 0.114 * leveled[:, :, 2]
    row_prof = gray.mean(axis=1)
    # Use a wider search range and prefer exact valley-to-valley course locking
    py = detect_period_1d(row_prof, max(32, h // 16), max(64, h // 3))

    if py is not None and py >= 32:
        # Find local dark minima (course shadow lips) roughly every `py` pixels
        max_k = max(1, (h - 12) // py)
        min_k = max(1, int(math.ceil((h * 0.52) / py)))
        k = max(min_k, min(max_k, target_courses))
        # Find the cleanest darkest course seam near the top margin
        top_search_end = min(h // 3, int(py * 1.4))
        best_y0 = int(np.argmin(row_prof[4 : max(5, top_search_end)])) + 4
        # Snap bottom cut strictly to the darkest course seam near best_y0 + k * py!
        approx_y1 = best_y0 + k * py
        if approx_y1 >= h - 4 and k > 1:
            k -= 1
            approx_y1 = best_y0 + k * py
        win = max(6, py // 5)
        lo1 = max(best_y0 + py, approx_y1 - win)
        hi1 = min(h - 2, approx_y1 + win)
        best_y1 = lo1 + int(np.argmin(row_prof[lo1 : hi1 + 1])) if hi1 > lo1 else min(h, approx_y1)
        crop_h = max(64, best_y1 - best_y0)

        crop_w = min(w, crop_h)
        # Snap horizontal width to an exact integer column period too so vertical tile edges match!
        col_prof = gray[best_y0:best_y1, :].mean(axis=0)
        px = detect_period_1d(col_prof, max(20, w // 22), max(48, w // 3))
        if px is not None and px >= 20:
            kx = max(2, int(round(crop_w / px)))
            cand_w = kx * px
            if cand_w <= w - 8 and abs(cand_w - crop_h) <= crop_h * 0.18:
                # Snap left/right edges to darkest column mortar/gap line
                x_lo = max(0, (w - cand_w) // 2 - px // 2)
                x_hi = min(w - cand_w - 1, x_lo + px)
                x0 = x_lo + int(np.argmin(col_prof[x_lo : x_hi + 1])) if x_hi > x_lo else (w - cand_w) // 2
                crop_w = cand_w
            else:
                x0 = max(0, (w - crop_w) // 2)
        else:
            x0 = max(0, (w - crop_w) // 2)
        cropped = leveled[best_y0:best_y1, x0 : x0 + crop_w]
    else:
        side = min(w, h)
        x0 = (w - side) // 2
        y0 = (h - side) // 2
        cropped = leveled[y0 : y0 + side, x0 : x0 + side]

    tile_im = Image.fromarray(np.clip(cropped, 0, 255).astype(np.uint8)).resize(
        (size, size), Image.Resampling.LANCZOS
    )
    tile = np.asarray(tile_im, dtype=np.float32)

    # 3. Tight seam-locked periodic cross-fade (only ~6% X / ~3.5% Y since cuts sit directly on course valleys!)
    def wrap_axis(img_arr: np.ndarray, axis: int, band_frac: float) -> np.ndarray:
        n = img_arr.shape[axis]
        band = max(8, int(n * band_frac))
        t = np.linspace(0.0, 1.0, band, endpoint=False, dtype=np.float32)
        s = t * t * (3.0 - 2.0 * t)
        if axis == 1:
            core_len = n - band
            core = img_arr[:, :core_len, :].copy()
            tail = img_arr[:, core_len:, :]
            w_m = s[None, :, None]
            core[:, :band, :] = core[:, :band, :] * w_m + tail * (1.0 - w_m)
            res = Image.fromarray(np.clip(core, 0, 255).astype(np.uint8)).resize(
                (n, img_arr.shape[0]), Image.Resampling.LANCZOS
            )
            return np.asarray(res, dtype=np.float32)
        else:
            core_len = n - band
            core = img_arr[:core_len, :, :].copy()
            tail = img_arr[core_len:, :, :]
            w_m = s[:, None, None]
            core[:band, :, :] = core[:band, :, :] * w_m + tail * (1.0 - w_m)
            res = Image.fromarray(np.clip(core, 0, 255).astype(np.uint8)).resize(
                (img_arr.shape[1], n), Image.Resampling.LANCZOS
            )
            return np.asarray(res, dtype=np.float32)

    tile = wrap_axis(tile, axis=1, band_frac=0.065)
    tile = wrap_axis(tile, axis=0, band_frac=0.032)

    # Final crispness touch (subtle unsharp mask)
    final_rgb = Image.fromarray(np.clip(tile, 0, 255).astype(np.uint8)).filter(
        ImageFilter.UnsharpMask(radius=1.1, percent=65, threshold=2)
    )
    out_arr = np.asarray(final_rgb, dtype=np.uint8)
    out_rgba = np.dstack([out_arr, np.full((size, size), 255, dtype=np.uint8)])
    return Image.fromarray(out_rgba, "RGBA")


def dominant_hex(im: Image.Image) -> str:
    arr = np.asarray(im.convert("RGB"), dtype=np.float32)
    r, g, b = arr.mean(axis=(0, 1))
    return f"#{int(round(r)):02X}{int(round(g)):02X}{int(round(b)):02X}"


def main() -> None:
    TERRAIN_DIR.mkdir(parents=True, exist_ok=True)
    QA_SHEET_PATH.parent.mkdir(parents=True, exist_ok=True)

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assets: list[dict] = manifest.get("assets", [])
    existing_idx = {a["path"]: i for i, a in enumerate(assets)}

    # Build a 5x2 contact sheet showing 2x2 tiled repeats of all 10 roof textures!
    cell_sz = 320
    pad = 16
    label_h = 26
    cols = 5
    rows = 2
    sheet = Image.new(
        "RGB",
        (cols * cell_sz + (cols + 1) * pad, rows * (cell_sz + label_h) + (rows + 1) * pad),
        (16, 20, 28),
    )
    draw = ImageDraw.Draw(sheet)

    for idx, spec in enumerate(NEW_ROOFS):
        src_path = ARTIFACTS_DIR / spec["src"]
        if not src_path.exists():
            raise FileNotFoundError(f"Missing generated roof source: {src_path}")

        out_im = make_phase_aligned_seamless_roof(src_path, spec["target_courses"], size=512)
        out_path = TERRAIN_DIR / spec["filename"]
        out_im.save(out_path, "PNG", optimize=True)
        dom = dominant_hex(out_im)

        rel_path = f"terrain/{spec['filename']}"
        entry = {
            "path": rel_path,
            "displayName": spec["displayName"],
            "category": "terrain",
            "tags": spec["tags"],
            "drawMode": "normal",
            "defaultPpi": 256,
            "castsShadow": False,
            "dominantHex": dom,
            "widthPx": 512,
            "heightPx": 512,
        }
        if rel_path in existing_idx:
            assets[existing_idx[rel_path]] = entry
        else:
            assets.append(entry)

        # Render 2x2 repeat thumbnail into QA contact sheet
        half = cell_sz // 2
        mini = out_im.convert("RGB").resize((half, half), Image.Resampling.LANCZOS)
        r = idx // cols
        c = idx % cols
        ox = pad + c * (cell_sz + pad)
        oy = pad + r * (cell_sz + label_h + pad)
        for ty in range(2):
            for tx in range(2):
                sheet.paste(mini, (ox + tx * half, oy + ty * half))
        draw.text((ox + 4, oy + cell_sz + 5), f"{idx + 1}. {spec['displayName']}", fill=(235, 240, 248))
        print(f"Processed {spec['filename']} -> {dom}")

    manifest["assets"] = assets
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    sheet.save(QA_SHEET_PATH, "PNG", optimize=True)
    print(f"Updated manifest ({len(assets)} total assets) and saved 2x2 QA sheet: {QA_SHEET_PATH}")

    # Rebuild DiceChaos_Modular_Suite_CC0.dcpack zip cleanly
    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for file_path in sorted(MODULAR_DIR.rglob("*")):
            if file_path.is_file():
                zf.write(file_path, file_path.relative_to(MODULAR_DIR).as_posix())
    print(f"Rebuilt {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()

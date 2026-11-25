"""
Extracts all 11 bespoke Dark Magipunk Train-Engine Ice Cream Parlor & Family Flat
CC0 assets into crisp zero-halo transparent PNGs in `public/assets/modular-suite-cc0/`,
and generates a dark-checkerboard QA contact sheet (`scratch/ice_cream_props_qa.png`)
for strict visual verification of zero white fringes or trapped interior white pockets.
"""

from collections import deque
from pathlib import Path
import json
import zipfile
import numpy as np
from PIL import Image, ImageDraw

ARTIFACT_DIR = Path(r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae")
MODULAR_DIR = Path("public/assets/modular-suite-cc0")
MANIFEST_PATH = MODULAR_DIR / "manifest.json"
DCPACK_PATH = Path("public/assets/DiceChaos_Modular_Suite_CC0.dcpack")
OUT_PROPS = MODULAR_DIR / "props/ice_cream_train"
OUT_PATHS = MODULAR_DIR / "paths"
QA_OUT = ARTIFACT_DIR / "scratch" / "ice_cream_props_qa.png"

OUT_PROPS.mkdir(parents=True, exist_ok=True)
OUT_PATHS.mkdir(parents=True, exist_ok=True)
QA_OUT.parent.mkdir(parents=True, exist_ok=True)


def compute_luma_sat(arr: np.ndarray):
    r = arr[:, :, 0].astype(np.int32)
    g = arr[:, :, 1].astype(np.int32)
    b = arr[:, :, 2].astype(np.int32)
    luma = (r * 299 + g * 587 + b * 114) // 1000
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    return luma, sat


def flood_bg_mask(luma: np.ndarray, sat: np.ndarray, luma_thr=232, sat_thr=26) -> np.ndarray:
    h, w = luma.shape
    is_white = (luma >= luma_thr) & (sat <= sat_thr)
    bg = np.zeros((h, w), dtype=bool)
    q = deque()
    for x in range(w):
        if is_white[0, x]:
            bg[0, x] = True
            q.append((0, x))
        if is_white[h - 1, x]:
            bg[h - 1, x] = True
            q.append((h - 1, x))
    for y in range(1, h - 1):
        if is_white[y, 0]:
            bg[y, 0] = True
            q.append((y, 0))
        if is_white[y, w - 1]:
            bg[y, w - 1] = True
            q.append((y, w - 1))

    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and is_white[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    return bg


def apply_clean_cutout(arr: np.ndarray, bg: np.ndarray, luma: np.ndarray, sat: np.ndarray) -> np.ndarray:
    """Turn bg mask transparent and cleanly defringe 2px of bright white anti-aliased halo pixels."""
    h, w = bg.shape
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, :3] = arr[:, :, :3]
    alpha = np.where(bg, 0, 255).astype(np.float32)

    # Dilate bg by 1 and 2 pixels to find outer fringe
    def dilate1(m):
        out = m.copy()
        out[1:, :] |= m[:-1, :]
        out[:-1, :] |= m[1:, :]
        out[:, 1:] |= m[:, :-1]
        out[:, :-1] |= m[:, 1:]
        return out

    ring1 = dilate1(bg) & (~bg)
    ring2 = dilate1(bg | ring1) & (~bg) & (~ring1)

    # Ring 1: soften/drop bright pale edge pixels and darken residual white spill
    r1_bright = ring1 & (luma >= 205) & (sat <= 34)
    alpha[r1_bright] = np.clip((242.0 - luma[r1_bright]) * (255.0 / 37.0), 0.0, 200.0)
    # Remove any pure-white fringe specks on ring1
    r1_pure = ring1 & (luma >= 225) & (sat <= 26)
    alpha[r1_pure] = 0.0

    # Ring 2: very soft taper only for near-white pixels
    r2_bright = ring2 & (luma >= 228) & (sat <= 24)
    alpha[r2_bright] = np.clip((246.0 - luma[r2_bright]) * (255.0 / 24.0), 60.0, 235.0)

    # Un-premultiply color slightly on semi-transparent boundary pixels against white to eliminate bright halo
    semi = (alpha > 0) & (alpha < 250) & (ring1 | ring2)
    if np.any(semi):
        a = (alpha[semi] / 255.0)[:, None]
        rgb = rgba[semi, :3].astype(np.float32)
        unmixed = np.clip((rgb - 255.0 * (1.0 - a)) / np.maximum(a, 0.25), 0.0, 255.0)
        rgba[semi, :3] = unmixed.astype(np.uint8)

    rgba[:, :, 3] = np.clip(alpha, 0, 255).astype(np.uint8)
    return rgba


def crop_and_resize(rgba: np.ndarray, max_dim: int, pad=4) -> Image.Image:
    ys, xs = np.where(rgba[:, :, 3] > 18)
    if len(xs) == 0:
        raise RuntimeError("Empty cutout!")
    y0, y1 = max(0, int(ys.min()) - pad), min(rgba.shape[0], int(ys.max()) + pad + 1)
    x0, x1 = max(0, int(xs.min()) - pad), min(rgba.shape[1], int(xs.max()) + pad + 1)
    cropped = Image.fromarray(rgba[y0:y1, x0:x1], mode="RGBA")
    cw, ch = cropped.size
    scale = min(max_dim / max(cw, ch), 1.0)
    nw, nh = max(16, int(round(cw * scale))), max(16, int(round(ch * scale)))
    return cropped.resize((nw, nh), Image.Resampling.LANCZOS)


def process_prop(src_name: str, out_name: str, max_dim: int, extra_clear_fn=None):
    src_path = ARTIFACT_DIR / src_name
    img = Image.open(src_path).convert("RGB")
    arr = np.array(img)
    luma, sat = compute_luma_sat(arr)
    bg = flood_bg_mask(luma, sat, luma_thr=232, sat_thr=26)
    if extra_clear_fn is not None:
        bg |= extra_clear_fn(arr, luma, sat)
    rgba = apply_clean_cutout(arr, bg, luma, sat)
    final_img = crop_and_resize(rgba, max_dim=max_dim, pad=4)
    out_path = OUT_PROPS / out_name
    final_img.save(out_path, format="PNG", optimize=True)
    print(f"  OK prop: {out_name:36s} -> {final_img.size[0]}x{final_img.size[1]}")
    return out_name, final_img


def process_mini_track(src_name: str, out_name: str):
    """Extract horizontally-seamless 512x256 transparent narrow-gauge brass miniature train track."""
    src_path = ARTIFACT_DIR / src_name
    img = Image.open(src_path).convert("RGB")
    arr = np.array(img)
    h, w, _ = arr.shape
    luma, sat = compute_luma_sat(arr)

    # Clear ALL pure/near-white pixels (top/bottom margins + between every tie & rail!)
    # Note: brass rails have warm gold hue (sat > 28 or luma < 236); sleepers are dark walnut!
    bg = (luma >= 232) & (sat <= 24)
    rgba = apply_clean_cutout(arr, bg, luma, sat)

    # Detect tie centers horizontally using the middle band between the two rails (y = 45%..55%)
    mid_band = rgba[int(h * 0.45):int(h * 0.55), :, 3] > 128
    col_density = mid_band.mean(axis=0)
    # Find tie runs (density > 0.5)
    in_tie = False
    ties = []
    start = 0
    for x in range(w):
        if col_density[x] > 0.5 and not in_tie:
            in_tie = True
            start = x
        elif col_density[x] <= 0.5 and in_tie:
            in_tie = False
            if x - start >= 12:
                ties.append((start, x))
    if in_tie and w - start >= 12:
        ties.append((start, w))

    # Pick clean interior mid-gap left & right bounds spanning exact whole number of ties for seamless looping!
    if len(ties) >= 6:
        # Take from midpoint between tie[1] and tie[2] to midpoint between tie[-3] and tie[-2]
        x0 = (ties[1][1] + ties[2][0]) // 2
        x1 = (ties[-3][1] + ties[-2][0]) // 2
    else:
        x0, x1 = 0, w

    # Vertical bounds of the track sleepers
    ys = np.where(rgba[:, x0:x1, 3] > 20)[0]
    ty0, ty1 = int(ys.min()), int(ys.max())
    track_h = ty1 - ty0 + 1

    # Place centered vertically in a 512x256 strip with ~16% transparent top/bottom padding
    strip = Image.fromarray(rgba[ty0:ty1 + 1, x0:x1], mode="RGBA")
    target_w = 512
    target_track_h = 180
    strip_resized = strip.resize((target_w, target_track_h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (target_w, 256), (0, 0, 0, 0))
    canvas.paste(strip_resized, (0, (256 - target_track_h) // 2))

    out_path = OUT_PATHS / out_name
    canvas.save(out_path, format="PNG", optimize=True)
    print(f"  OK path: {out_name:36s} -> {canvas.size[0]}x{canvas.size[1]} (ties={len(ties)}, crop={x0}..{x1})")
    return out_name, canvas


def clear_cowcatcher_slots(arr, luma, sat):
    h, w = luma.shape
    yy = np.arange(h)[:, None]
    # Cowcatcher grille sits in bottom half (y >= 42% of height); headlamp glow is saturated golden yellow
    return (yy >= int(h * 0.42)) & (luma >= 230) & (sat <= 24)


def clear_mini_engine_cowcatcher(arr, luma, sat):
    h, w = luma.shape
    xx = np.arange(w)[None, :]
    # Pointed cowcatcher sits on the right nose tip (x >= 79% of width)
    return (xx >= int(w * 0.79)) & (luma >= 230) & (sat <= 24)


def clear_bistro_chair_wirework(arr, luma, sat):
    h, w = luma.shape
    xx = np.arange(w)[None, :]
    cx = w * 0.5
    # Left & right wrought-iron chair backs sit beyond 25.5% of width from center (completely outside the marble disc!)
    return (np.abs(xx - cx) > w * 0.255) & (luma >= 230) & (sat <= 26)


def make_qa_sheet(entries):
    cols = 4
    rows = (len(entries) + cols - 1) // cols
    cell = 280
    pad = 16
    sheet_w = cols * cell + (cols + 1) * pad
    sheet_h = rows * cell + (rows + 1) * pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), (24, 28, 36))
    draw = ImageDraw.Draw(sheet)

    for idx, (name, im) in enumerate(entries):
        r, c = divmod(idx, cols)
        x0 = pad + c * (cell + pad)
        y0 = pad + r * (cell + pad)
        # Dark checkerboard background so ANY white halo screams immediately!
        tile = 16
        for ty in range(0, cell, tile):
            for tx in range(0, cell, tile):
                col = (34, 40, 52) if ((tx // tile + ty // tile) % 2 == 0) else (48, 56, 70)
                draw.rectangle([x0 + tx, y0 + ty, x0 + min(cell, tx + tile) - 1, y0 + min(cell, ty + tile) - 1], fill=col)
        iw, ih = im.size
        s = min((cell - 28) / iw, (cell - 40) / ih)
        nw, nh = max(8, int(iw * s)), max(8, int(ih * s))
        thumb = im.resize((nw, nh), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x0 + (cell - nw) // 2, y0 + (cell - 22 - nh) // 2), thumb)
        draw.rectangle([x0, y0 + cell - 22, x0 + cell - 1, y0 + cell - 1], fill=(15, 18, 24))
        draw.text((x0 + 6, y0 + cell - 17), name.replace(".png", ""), fill=(235, 240, 248))

    sheet.save(QA_OUT, format="PNG")
    print(f"QA sheet written -> {QA_OUT}")


def main():
    print("Extracting 11 bespoke Ice Cream Train & Family Flat CC0 assets...")
    results = []
    results.append(process_mini_track("ic_mini_brass_track_1795508652703.jpg", "ic_mini_brass_track.png"))
    results.append(process_prop("ic_locomotive_scoop_counter_1795508535144.jpg", "ic_locomotive_scoop_counter.png", 512))
    results.append(process_prop("ic_cryo_aether_churner_1795508569712.jpg", "ic_cryo_aether_churner.png", 480))
    results.append(process_prop("ic_waffle_cone_station_1795508590061.jpg", "ic_waffle_cone_station.png", 480))
    results.append(process_prop("ic_locomotive_cowcatcher_facade_1795508555853.jpg", "ic_locomotive_cowcatcher_facade.png", 512, clear_cowcatcher_slots))
    results.append(process_prop("ic_mini_train_engine_1795508652842.jpg", "ic_mini_train_engine.png", 460, clear_mini_engine_cowcatcher))
    results.append(process_prop("ic_mini_train_sundae_car_1795508676690.jpg", "ic_mini_train_sundae_car.png", 440))
    results.append(process_prop("ic_mini_train_milkshake_car_1795508689412.jpg", "ic_mini_train_milkshake_car.png", 440))
    results.append(process_prop("ic_parlor_bistro_sundae_table_1795508739452.jpg", "ic_parlor_bistro_sundae_table.png", 460, clear_bistro_chair_wirework))
    results.append(process_prop("ic_striped_parlor_awning_1795508741500.jpg", "ic_striped_parlor_awning.png", 512))
    results.append(process_prop("ic_kids_bunk_bed_train_1795508744035.jpg", "ic_kids_bunk_bed_train.png", 512))
    make_qa_sheet(results)

    # Register all 11 assets cleanly in public/assets/modular-suite-cc0/manifest.json
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assets: list[dict] = manifest.get("assets", [])
    by_path = {a["path"]: i for i, a in enumerate(assets)}

    specs = [
        ("paths/ic_mini_brass_track.png", "Miniature Brass Model Train Track", "path", ["cc0", "train", "track", "rail", "brass", "miniature", "ice_cream", "shop", "magipunk"], 256, False, "#B8934A"),
        ("props/ice_cream_train/ic_locomotive_scoop_counter.png", "Locomotive Boiler Ice Cream Counter", "object", ["cc0", "ice_cream", "gelato", "counter", "train", "locomotive", "shop", "parlor", "magipunk"], 200, True, "#7C5A43"),
        ("props/ice_cream_train/ic_cryo_aether_churner.png", "Cryo-Aether Boiler Ice Cream Churner", "object", ["cc0", "ice_cream", "churner", "boiler", "cryo", "aether", "machine", "magipunk"], 240, True, "#6BA5B8"),
        ("props/ice_cream_train/ic_waffle_cone_station.png", "Waffle Cone & Sundae Topping Bar", "object", ["cc0", "ice_cream", "waffle", "cone", "sundae", "counter", "bakery", "shop"], 220, True, "#6D4A31"),
        ("props/ice_cream_train/ic_locomotive_cowcatcher_facade.png", "Brass Locomotive Cowcatcher & Headlamp", "object", ["cc0", "train", "locomotive", "cowcatcher", "brass", "headlamp", "facade", "magipunk"], 180, True, "#8F3B36"),
        ("props/ice_cream_train/ic_mini_train_engine.png", "Miniature Brass & Crimson Steam Engine", "object", ["cc0", "train", "locomotive", "miniature", "toy", "brass", "delivery", "ice_cream"], 320, True, "#8B272B"),
        ("props/ice_cream_train/ic_mini_train_sundae_car.png", "Miniature Ice Cream Sundae Flatcar", "object", ["cc0", "train", "railcar", "sundae", "ice_cream", "miniature", "delivery", "banana_split"], 340, True, "#8A3634"),
        ("props/ice_cream_train/ic_mini_train_milkshake_car.png", "Miniature Milkshake & Cream Tanker Car", "object", ["cc0", "train", "railcar", "milkshake", "tanker", "ice_cream", "miniature", "delivery"], 340, True, "#9E5E3E"),
        ("props/ice_cream_train/ic_parlor_bistro_sundae_table.png", "Marble Ice Cream Parlor Sundae Table", "object", ["cc0", "ice_cream", "table", "bistro", "cafe", "sundae", "chairs", "parlor"], 260, True, "#D8D4CE"),
        ("props/ice_cream_train/ic_striped_parlor_awning.png", "Striped Crimson & Cream Parlor Awning", "object", ["cc0", "awning", "canopy", "striped", "shop", "ice_cream", "parlor", "facade"], 190, True, "#8C2C34"),
        ("props/ice_cream_train/ic_kids_bunk_bed_train.png", "Family Kids Bed & Toy Train Playmat", "object", ["cc0", "bedroom", "bed", "kids", "family", "toy", "train", "rug", "home"], 220, True, "#A87B4C"),
    ]

    for rel_path, disp, cat, tags, ppi, casts_shadow, dom_hex in specs:
        full_p = MODULAR_DIR / rel_path
        im = Image.open(full_p)
        w, h = im.size
        entry = {
            "path": rel_path,
            "displayName": disp,
            "category": cat,
            "tags": tags,
            "widthPx": w,
            "heightPx": h,
            "defaultPpi": ppi,
            "drawMode": "normal",
            "castsShadow": casts_shadow,
            "dominantHex": dom_hex,
        }
        if rel_path in by_path:
            assets[by_path[rel_path]] = entry
        else:
            by_path[rel_path] = len(assets)
            assets.append(entry)

    manifest["assets"] = assets
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {MANIFEST_PATH} -> {len(assets)} total assets")

    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for f in sorted(MODULAR_DIR.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(MODULAR_DIR).as_posix())
    print(f"Rebuilt {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()

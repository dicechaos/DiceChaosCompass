"""
Dice Chaos Compass — 15-Asset Aged Streetcar Line & Municipal Street Utility Suite

Generates 15 bespoke painterly Harmony CC0 assets:
  - 3 Seamless Horizontal Streetcar Paths (`paths/streetcar/`):
      1. `path_aged_streetcar_cobble_track.png` (512x192) — Embedded granite-sett steel girder tram rails
      2. `path_aged_tram_median_cobbles.png`    (512x128) — Weathered basalt median w/ faded amber paver markers
      3. `path_aged_curb_gutter_grime.png`      (512x128) — Feathered gutter silt & curb-edge grime ribbon
  - 12 Aged Streetcar & Municipal Utility Props (`props/aged_streetcar_line/`):
      4. `st_aged_magipunk_tram_car.png`        (448x160) — Weathered Berlin-Magipunk Streetcar #14
      5. `st_aged_tram_stop_shelter.png`        (288x144) — Verdigris Iron & Dusty-Glass Haltestelle Shelter
      6. `st_aged_tram_stop_signpost.png`       (128x128) — Standalone Cast-Iron "H" Tram Stop Post
      7. `st_aged_tram_semaphore_signal.png`    (160x160) — Riveted Iron & Brass Tram Semaphore Signal
      8. `st_tram_crossing_iron_plates.png`     (288x240) — Cast-Iron & Granite Dual-Rail Crossing Plates
      9. `st_rail_switch_point_box.png`         (192x160) — Recessed Tramway Switch Box & Point Lever Pit
     10. `st_track_cobble_repair_patch.png`     (256x160) — Mismatched Brick & Tar Street Utility Repair Patch
     11. `st_aged_granite_crosswalk.png`        (320x144) — Chipped & Oil-Worn Pale-Granite Crosswalk
     12. `st_overhead_catenary_pole.png`        (160x128) — Fluted Cast-Iron Tramway Catenary Pole & Bracket
     13. `st_street_manhole_granite_collar.png` (176x176) — Cast-Iron Municipal Manhole in Granite Collar Setts
     14. `st_curb_storm_drain_basin.png`        (176x128) — Silt-Streaked Cast-Iron Curb Storm Catch-Basin
     15. `st_street_steam_grate_vent.png`       (176x144) — Soot-Rimmed Cast-Iron Street Steam/Aether Vent

All 2x-supersampled in unified Harmony style (#1E1816 charcoal ink, painterly fBm grain,
zero white halos). Upserts into `public/assets/modular-suite-cc0/manifest.json`.
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from harmony_art_engine import (
    MOD_DIR,
    SCRATCH_DIR,
    INK,
    INK_DARK,
    INK_MID,
    INK_IRON,
    new_hi,
    fbm_periodic,
    apply_painterly_finish,
    add_contact_shadow,
    add_glow,
    draw_beveled_rect,
    blend_rgb,
    vary_rgb,
    save_qa_sheet,
    upsert_manifest_entries,
    dominant_hex,
)

PATHS_DIR = MOD_DIR / "paths" / "streetcar"
PROPS_DIR = MOD_DIR / "props" / "aged_streetcar_line"
PATHS_DIR.mkdir(parents=True, exist_ok=True)
PROPS_DIR.mkdir(parents=True, exist_ok=True)

# Weathered Berlin Industrial Streetcar Palette
BASALT = (74, 76, 82)
GRANITE = (116, 114, 110)
GRANITE_LT = (156, 150, 138)
GRANITE_DK = (60, 60, 64)
CURB_STONE = (134, 128, 118)
MORTAR = (42, 40, 38)
STEEL_RAIL = (158, 166, 174)
STEEL_HI = (206, 212, 218)
IRON = (62, 66, 74)
IRON_DK = (38, 42, 48)
RUST = (138, 66, 36)
RUST_DK = (96, 44, 24)
VERDIGRIS = (74, 128, 114)
PRUSSIAN_BLUE = (42, 72, 102)
TRAM_CREAM = (196, 184, 154)
TRAM_ROOF = (164, 152, 128)
BRASS = (194, 152, 72)
BRASS_HI = (228, 192, 106)
COPPER = (168, 102, 64)
OAK_WORN = (122, 86, 54)
BRICK_PATCH = (144, 76, 58)
AMBER_FADED = (178, 142, 64)
ENAMEL_RED = (174, 48, 46)
ENAMEL_YEL = (218, 180, 62)
ENAMEL_GRN = (42, 104, 72)
CYAN_AETHER = (88, 226, 255)
AMBER_GLOW = (255, 198, 92)
MOSS = (76, 98, 48)


def draw_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rgb: tuple[int, int, int] | tuple[int, int, int, int],
    ink_w: int = 4,
) -> None:
    rgb3 = (rgb[0], rgb[1], rgb[2])
    dk = blend_rgb(rgb3, (18, 16, 16), 0.42)
    hi = blend_rgb(rgb3, (252, 246, 232), 0.38)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dk, outline=INK, width=ink_w)
    d.ellipse([cx - r * 0.84, cy - r * 0.84, cx + r * 0.84, cy + r * 0.84], fill=(*rgb3, 255))
    if r >= 9:
        d.arc(
            [cx - r * 0.68, cy - r * 0.68, cx + r * 0.68, cy + r * 0.68],
            195,
            310,
            fill=hi,
            width=max(2, int(r * 0.14)),
        )


def feather_y_edges(im: Image.Image, band_px: int = 16) -> Image.Image:
    """Softly feathers top & bottom rows of a seamless horizontal path so it blends into roads."""
    arr = np.array(im, dtype=np.float32)
    h = arr.shape[0]
    ramp = np.ones((h, 1), dtype=np.float32)
    for i in range(band_px):
        t = i / max(1, band_px)
        s = t * t * (3.0 - 2.0 * t)
        ramp[i, 0] = s
        ramp[h - 1 - i, 0] = s
    arr[:, :, 3] = np.clip(arr[:, :, 3] * ramp, 0, 255)
    arr[arr[:, :, 3] < 2, :3] = 0
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def overlay_grime_stain(im: Image.Image, seed: int, alpha_max: float = 72.0, col=(34, 30, 28), periodic_x=False) -> Image.Image:
    """Layers subtle organic grime/patina directly onto opaque pixels of a rendered asset."""
    arr = np.array(im, dtype=np.float32)
    h, w = arr.shape[:2]
    n = fbm_periodic(h, w, ((4, 4, 0.50), (10, 10, 0.30), (22, 22, 0.20)), seed=seed)
    g = np.clip((n - 0.38) / 0.52, 0.0, 1.0) * (alpha_max / 255.0)
    mask = (arr[:, :, 3] / 255.0) * g
    for c in range(3):
        arr[:, :, c] = arr[:, :, c] * (1.0 - mask) + col[c] * mask
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


# =============================================================================
# 1–3: SEAMLESS HORIZONTAL STREETCAR PATHS (`paths/streetcar/`)
# =============================================================================
def gen_path_aged_streetcar_cobble_track() -> Image.Image:
    w, h = 512, 192
    W, H = w * 2, h * 2  # 1024 x 384 seamless in X!
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(3101)

    # 1. Embedded streetcar stone-sett bed (y ∈ [28..356], leaving soft shoulder margin at top & bottom)
    d.rectangle([0, 32, W, H - 32], fill=(*MORTAR, 255))

    # Draw staggered weathered granite/basalt cobblestones tiled seamlessly in X (period = W = 1024)
    # Rows: outer shoulder (top/bot), inner cobbles between the two girder rails!
    rows = [
        (36, 68, 44, BASALT),
        (72, 112, 48, GRANITE),
        (116, 152, 42, BASALT),
        (156, 192, 44, GRANITE_DK),
        (196, 232, 42, BASALT),
        (236, 272, 48, GRANITE),
        (276, 312, 48, GRANITE),
        (316, 348, 44, BASALT),
    ]
    for ridx, (y0, y1, step_x, base_col) in enumerate(rows):
        count = max(12, round(W / step_x))
        cw = W / count
        off = (cw * 0.5) if (ridx % 2 == 1) else 0.0
        for i in range(count + 1):
            x0 = (i * cw + off) % W
            # Draw twice if wrapping across x=W for 100% seamless horizontal tiling!
            for shift in (0, -W):
                bx0 = x0 + shift + 2
                bx1 = x0 + shift + cw - 3
                if bx1 < -4 or bx0 > W + 4:
                    continue
                col = vary_rgb(base_col, rng, 14)
                # Subtle oil darkening toward center of track
                yc = (y0 + y1) * 0.5
                center_prox = max(0.0, 1.0 - abs(yc - H * 0.5) / 110.0)
                col = blend_rgb(col, (34, 30, 28), center_prox * 0.32)[:3]
                hi = blend_rgb(col, (220, 214, 198), 0.22)
                sh = blend_rgb(col, (18, 16, 16), 0.36)
                d.rounded_rectangle([bx0, y0, bx1, y1], radius=5, fill=(*col, 255), outline=(34, 30, 28, 255), width=3)
                d.line([(bx0 + 4, y0 + 3), (bx1 - 4, y0 + 3)], fill=hi, width=2)
                d.line([(bx0 + 4, y1 - 3), (bx1 - 4, y1 - 3)], fill=sh, width=2)
                # Occasional chipped hairline crack on a stone sett
                if rng.random() < 0.16:
                    mx = (bx0 + bx1) * 0.5
                    d.line([(mx - 6, y0 + 5), (mx + 2, (y0 + y1) * 0.5), (mx + 7, y1 - 5)], fill=(28, 24, 22, 210), width=2)

    # 2. Central oily axle-grease & coal-cinder smear running down the middle of the gauge
    oil = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(oil)
    od.rectangle([0, 144, W, 240], fill=(22, 20, 18, 72))
    od.rectangle([0, 168, W, 216], fill=(18, 16, 16, 62))
    # Subtle moss tufts tucked into outer stone mortar seams
    for mx in [96, 342, 610, 884]:
        for my in [48, H - 48]:
            od.ellipse([mx - 14, my - 7, mx + 14, my + 7], fill=(*MOSS, 115))
    im.alpha_composite(oil.filter(ImageFilter.GaussianBlur(7.0)))
    d = ImageDraw.Draw(im)

    # 3. Recessed Iron Tie-Bars crossing underneath the rail seats (2 per seamless tile)
    for tx in [256, 768]:
        draw_beveled_rect(d, tx - 8, 86, tx + 8, H - 86, IRON_DK, ink_w=3, hi_amt=0.18, sh_amt=0.45)

    # 4. Twin Flanged Grooved Streetcar Girder Rails (top rail y=88..112, bottom rail y=272..296)
    for rail_y, flange_dir in [(96, +1), (H - 96, -1)]:
        # Rust-oxide bleed strip hugging the granite next to the rail!
        rust_l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        rd = ImageDraw.Draw(rust_l)
        rd.rectangle([0, rail_y - 22, W, rail_y + 22], fill=(*RUST, 76))
        im.alpha_composite(rust_l.filter(ImageFilter.GaussianBlur(5.0)))
        d = ImageDraw.Draw(im)

        # Dark recessed wheel-flangeway groove on the INNER side of each rail
        fy0 = rail_y + (6 if flange_dir > 0 else -19)
        fy1 = fy0 + 13
        d.rectangle([0, fy0, W, fy1], fill=(20, 18, 18, 255))
        # Inner steel check-lip edging the groove
        ly0 = fy1 if flange_dir > 0 else fy0 - 6
        d.rectangle([0, ly0, W, ly0 + 6], fill=(*IRON, 255), outline=INK_IRON, width=2)

        # Heavy oxidized steel rail web + bright worn-silver running railhead!
        ry0 = rail_y - 11 if flange_dir > 0 else rail_y - 4
        ry1 = ry0 + 16
        d.rectangle([0, ry0, W, ry1], fill=(*IRON, 255))
        d.line([(0, ry0), (W, ry0)], fill=INK_IRON, width=3)
        d.line([(0, ry1), (W, ry1)], fill=INK_IRON, width=3)
        # Rust streaks on outer rail foot
        for rx in range(24, W, 64):
            d.rectangle([rx, ry0 + 1, rx + 26, ry0 + 5], fill=(*RUST_DK, 210))
        # Polished steel running crown worn gleaming by thousands of tram wheels!
        d.rectangle([0, ry0 + 4, W, ry1 - 4], fill=(*STEEL_RAIL, 255))
        d.line([(0, ry0 + 5), (W, ry0 + 5)], fill=(*STEEL_HI, 255), width=3)

        # Bolted rail fishplate splice joint at x=512!
        d.line([(512, ry0 - 2), (512, ry1 + 2)], fill=INK_DARK, width=4)
        for bx in [484, 498, 526, 540]:
            d.ellipse([bx - 4, ry0 - 6, bx + 4, ry0 + 2], fill=(*RUST, 255), outline=INK_DARK, width=2)

    out = apply_painterly_finish(im, w, h, seed=3101, grain=5.2, periodic_x=True, warm_bevel=True)
    return feather_y_edges(out, band_px=15)


def gen_path_aged_tram_median_cobbles() -> Image.Image:
    w, h = 512, 128
    W, H = w * 2, h * 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(3102)

    # Dark basalt cobblestone median band (y ∈ [34..222]) replacing bright yellow path_colorable_trim!
    d.rectangle([0, 38, W, H - 38], fill=(*MORTAR, 255))
    # 3 staggered courses of dark basalt & weathered amber-ochre faded safety marker stones
    for ridx, (y0, y1) in enumerate([(42, 92), (96, 160), (164, 214)]):
        count = 16
        cw = W / count
        off = (cw * 0.5) if (ridx % 2 == 1) else 0.0
        for i in range(count + 1):
            x0 = (i * cw + off) % W
            # Center row has faded, chipped antique ochre safety inlay blocks every other stone!
            is_marker = (ridx == 1) and (i % 2 == 0)
            for shift in (0, -W):
                bx0 = x0 + shift + 3
                bx1 = x0 + shift + cw - 3
                if bx1 < -4 or bx0 > W + 4:
                    continue
                base = AMBER_FADED if is_marker else BASALT
                col = vary_rgb(base, rng, 12)
                if is_marker:
                    # Age/dirty the amber marker stone so it looks 35 years worn, never neon!
                    col = blend_rgb(col, GRANITE_DK, rng.uniform(0.28, 0.48))[:3]
                hi = blend_rgb(col, (236, 226, 206), 0.20)
                sh = blend_rgb(col, (18, 16, 16), 0.36)
                d.rounded_rectangle([bx0, y0, bx1, y1], radius=5, fill=(*col, 255), outline=(30, 26, 24, 255), width=3)
                d.line([(bx0 + 4, y0 + 3), (bx1 - 4, y0 + 3)], fill=hi, width=2)
                d.line([(bx0 + 4, y1 - 3), (bx1 - 4, y1 - 3)], fill=sh, width=2)
                if rng.random() < 0.25:
                    mx = (bx0 + bx1) * 0.5
                    d.line([(mx - 8, y0 + 6), (mx + 5, y1 - 6)], fill=(26, 22, 20, 195), width=2)

    out = apply_painterly_finish(im, w, h, seed=3102, grain=5.4, periodic_x=True, warm_bevel=True)
    out = overlay_grime_stain(out, seed=3199, alpha_max=72.0, col=(28, 25, 22))
    return feather_y_edges(out, band_px=20)


def gen_path_aged_curb_gutter_grime() -> Image.Image:
    w, h = 512, 128
    # Seamless horizontal feathered oil-silt, tire-dust & curb-edge weathering ribbon!
    ys = np.linspace(-1.0, 1.0, h, dtype=np.float32)[:, None]
    n = fbm_periodic(h, w, ((3, 4, 0.48), (7, 10, 0.32), (16, 24, 0.20)), seed=3103)
    band = np.clip(1.0 - np.abs(ys + (n - 0.5) * 0.22) / 0.78, 0.0, 1.0)
    band = band * band * (3.0 - 2.0 * band)
    alpha = band * (0.38 + 0.62 * n) * 138.0
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    c_dk = (32, 28, 26)
    c_lt = (74, 66, 56)
    for c in range(3):
        rgb[:, :, c] = c_lt[c] * (1.0 - n) + c_dk[c] * n
    out = np.zeros((h, w, 4), dtype=np.uint8)
    mask = alpha >= 1.5
    for c in range(3):
        out[:, :, c] = np.where(mask, np.clip(rgb[:, :, c], 0, 255), 0).astype(np.uint8)
    out[:, :, 3] = np.where(mask, np.clip(alpha, 0, 255), 0).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


# =============================================================================
# 4–15: AGED STREETCAR & MUNICIPAL UTILITY PROPS (`props/aged_streetcar_line/`)
# =============================================================================
def gen_aged_magipunk_tram_car() -> Image.Image:
    w, h = 448, 160
    im = new_hi(w, h)  # 896 x 320
    W, H = im.size
    d = ImageDraw.Draw(im)

    # Contact shadow
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.rounded_rectangle(
            [44 + off[0], 34 + off[1], W - 44 + off[0], H - 34 + off[1]], radius=44, fill=col
        ),
        offset=(8, 12),
        blur=12.0,
        alpha=105,
    )
    d = ImageDraw.Draw(im)

    # Front & rear riveted cast-iron cowcatcher / fender bumpers
    draw_beveled_rect(d, 22, 92, 66, H - 92, IRON_DK, ink_w=5, radius=14)
    draw_beveled_rect(d, W - 66, 92, W - 22, H - 92, IRON_DK, ink_w=5, radius=14)
    # Bumper rub ribs
    for by in range(108, H - 102, 16):
        d.line([(28, by), (60, by)], fill=(*RUST, 210), width=3)
        d.line([(W - 60, by), (W - 28, by)], fill=(*RUST, 210), width=3)

    # Outer Prussian-blue riveted steel body hull with beveled roof drip-rail
    draw_beveled_rect(d, 52, 34, W - 52, H - 34, PRUSSIAN_BLUE, ink_w=6, radius=40, hi_amt=0.26, sh_amt=0.42)
    # Brass beltline trim strip
    d.rounded_rectangle([64, 46, W - 64, H - 46], radius=32, outline=(*BRASS, 255), width=6)

    # Weathered painted canvas/plank roof deck (aged warm cream-taupe, NOT stark sterile beige!)
    draw_beveled_rect(d, 74, 54, W - 74, H - 54, TRAM_CREAM, ink_w=5, radius=26, hi_amt=0.22, sh_amt=0.32)
    # Subtle longitudinal timber/canvas roof ribs + rain-streaked soot patina
    for ry in range(72, H - 68, 22):
        d.line([(92, ry), (W - 92, ry)], fill=(*blend_rgb(TRAM_CREAM, (48, 42, 36), 0.25)[:3], 145), width=2)
    for rx in range(150, W - 140, 96):
        d.line([(rx, 58), (rx, H - 58)], fill=(*blend_rgb(TRAM_CREAM, (36, 32, 28), 0.30)[:3], 150), width=3)

    # Raised Central Clerestory Roof Monitor with warm glowing passenger-cabin skylight vents!
    draw_beveled_rect(d, 148, 80, W - 148, H - 80, TRAM_ROOF, ink_w=5, radius=18, hi_amt=0.25, sh_amt=0.38)
    for sx in range(178, W - 205, 58):
        # Top & bottom glowing clerestory glass strip windows (warm tungsten cabin light!)
        draw_beveled_rect(d, sx, 76, sx + 42, 88, AMBER_GLOW, ink_w=3, radius=3, hi_amt=0.35, sh_amt=0.25)
        draw_beveled_rect(d, sx, H - 88, sx + 42, H - 76, AMBER_GLOW, ink_w=3, radius=3, hi_amt=0.35, sh_amt=0.25)

    # Twin Soot-Darkened Iron Resistor/Vent Louver Boxes on roof
    for vx in [238, W - 238]:
        draw_beveled_rect(d, vx - 46, 108, vx + 46, H - 108, IRON, ink_w=4, radius=8)
        for ly in range(118, H - 114, 12):
            d.line([(vx - 36, ly), (vx + 36, ly)], fill=INK_DARK, width=4)
        # Rust fleck on louver corners
        d.ellipse([vx - 40, 112, vx - 28, 124], fill=(*RUST, 195))
        d.ellipse([vx + 26, H - 126, vx + 38, H - 114], fill=(*RUST, 195))

    # Central Patinated Copper & Brass Diamond Pantograph + Glowing Cyan Aether Collector!
    cx, cy = W // 2, H // 2
    draw_beveled_rect(d, cx - 72, cy - 64, cx + 72, cy + 64, IRON_DK, ink_w=5, radius=12)
    # Copper insulator frame
    p_pts = [(cx - 56, cy), (cx, cy - 50), (cx + 56, cy), (cx, cy + 50)]
    d.line(p_pts + [p_pts[0]], fill=INK_DARK, width=14, joint="curve")
    d.line(p_pts + [p_pts[0]], fill=(*COPPER, 255), width=8, joint="curve")
    d.line([(cx, cy - 64), (cx, cy + 64)], fill=(*BRASS_HI, 255), width=6)
    # Verdigris corner mounts
    for px, py in [(cx - 56, cy - 48), (cx + 56, cy - 48), (cx - 56, cy + 48), (cx + 56, cy + 48)]:
        draw_disc(d, px, py, 9, VERDIGRIS, ink_w=3)
    # Glowing cyan aether collector insulator core
    add_glow(im, cx, cy, 34, 34, CYAN_AETHER, alpha=130, blur=14.0)
    d = ImageDraw.Draw(im)
    draw_disc(d, cx, cy, 18, CYAN_AETHER, ink_w=4)
    d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(226, 252, 255, 255))

    # Vintage Brass Destination Board & Dual Warm Glowing Headlamps at Both Ends
    for hx in [54, W - 54]:
        add_glow(im, hx, cy, 26, 26, AMBER_GLOW, alpha=125, blur=12.0)
        d = ImageDraw.Draw(im)
        draw_disc(d, hx, cy, 14, BRASS, ink_w=4)
        d.ellipse([hx - 8, cy - 8, hx + 8, cy + 8], fill=(255, 238, 168, 255))

    # Subtle weathered rain/soot patina across roof planks so it looks 30 years in service!
    out = apply_painterly_finish(im, w, h, seed=3201, grain=5.2, warm_bevel=True)
    out = overlay_grime_stain(out, seed=3299, alpha_max=78.0, col=(36, 32, 28))
    return out


def gen_aged_tram_stop_shelter() -> Image.Image:
    w, h = 288, 144
    im = new_hi(w, h)  # 576 x 288
    W, H = im.size
    d = ImageDraw.Draw(im)
    rng = random.Random(3202)

    add_contact_shadow(
        im,
        lambda sd, col, off: sd.rounded_rectangle([24 + off[0], 24 + off[1], W - 24 + off[0], H - 24 + off[1]], radius=14, fill=col),
        offset=(7, 9), blur=10.0, alpha=95,
    )
    d = ImageDraw.Draw(im)

    # Chipped Granite Boarding Curb Platform made of individual stone slabs!
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, GRANITE, ink_w=5, radius=10, hi_amt=0.22, sh_amt=0.38)
    for sx in range(22, W - 24, 66):
        col = vary_rgb(GRANITE, rng, 12)
        draw_beveled_rect(d, sx + 2, 26, min(W - 24, sx + 64), H - 26, col, ink_w=3, radius=3, hi_amt=0.20, sh_amt=0.32)
        if rng.random() < 0.45:
            d.line([(sx + 18, 42), (sx + 34, 86)], fill=(38, 34, 32, 165), width=2)
    # Moss/dirt tucked along the rear edge
    for mx in [64, 198, 420]:
        d.ellipse([mx - 16, 26, mx + 16, 42], fill=(*MOSS, 130))

    # Worn Slatted Oak Waiting Bench (visible slightly beneath the dusty glass shelter roof!)
    draw_beveled_rect(d, 118, 102, 396, 186, OAK_WORN, ink_w=4, radius=8)
    for sy in [120, 140, 160, 174]:
        d.line([(124, sy), (390, sy)], fill=(54, 36, 22, 200), width=3)
    for bx in [148, 256, 364]:
        d.rectangle([bx - 7, 100, bx + 7, 188], fill=(*IRON_DK, 255), outline=INK, width=3)

    # Dusty Translucent Green-Glass & Verdigris Cast-Iron Canopy Overhead
    canopy = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(canopy)
    cd.rounded_rectangle([94, 48, 420, H - 48], radius=14, fill=(78, 118, 108, 152), outline=INK_IRON, width=6)
    # Specular rain-streaked glass glint
    cd.polygon([(112, 54), (218, 54), (168, H - 54), (112, H - 54)], fill=(214, 232, 224, 58))
    # Iron glazing muntins & central ridge beam
    for gx in range(148, 405, 54):
        cd.line([(gx, 52), (gx, H - 52)], fill=(*VERDIGRIS, 235), width=6)
        cd.line([(gx, 52), (gx, H - 52)], fill=INK_IRON, width=2)
    cd.line([(98, H // 2), (416, H // 2)], fill=INK_IRON, width=10)
    cd.line([(98, H // 2), (416, H // 2)], fill=(*VERDIGRIS, 255), width=5)
    im.alpha_composite(canopy)
    d = ImageDraw.Draw(im)

    # Cast-iron trash bin on the left & iconic Berlin yellow-and-green "H" Haltestelle post on the right!
    draw_disc(d, 58, H // 2, 22, IRON, ink_w=4)
    d.ellipse([44, H // 2 - 14, 72, H // 2 + 14], fill=(24, 22, 22, 255))
    draw_disc(d, W - 72, H // 2, 34, IRON_DK, ink_w=5)
    draw_disc(d, W - 72, H // 2, 25, ENAMEL_GRN, ink_w=4)
    draw_disc(d, W - 72, H // 2, 18, ENAMEL_YEL, ink_w=3)
    # Bold painted "H" emblem
    hx, hy = W - 72, H // 2
    d.rectangle([hx - 9, hy - 11, hx - 4, hy + 11], fill=(*ENAMEL_GRN, 255))
    d.rectangle([hx + 4, hy - 11, hx + 9, hy + 11], fill=(*ENAMEL_GRN, 255))
    d.rectangle([hx - 6, hy - 3, hx + 6, hy + 3], fill=(*ENAMEL_GRN, 255))

    out = apply_painterly_finish(im, w, h, seed=3202, grain=5.4, warm_bevel=True)
    return overlay_grime_stain(out, seed=3298, alpha_max=70.0, col=(38, 34, 30))


def gen_aged_tram_stop_signpost() -> Image.Image:
    w, h = 128, 128
    im = new_hi(w, h)
    W, H = im.size
    cx, cy = W // 2, H // 2
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx - 64 + off[0], cy - 64 + off[1], cx + 64 + off[0], cy + 64 + off[1]], fill=col),
        offset=(6, 8), blur=9.0, alpha=95,
    )
    d = ImageDraw.Draw(im)
    # Chipped octagonal granite plinth
    draw_beveled_rect(d, cx - 58, cy - 58, cx + 58, cy + 58, GRANITE, ink_w=5, radius=22)
    draw_disc(d, cx, cy, 42, IRON_DK, ink_w=5)
    draw_disc(d, cx, cy, 31, ENAMEL_GRN, ink_w=4)
    draw_disc(d, cx, cy, 22, ENAMEL_YEL, ink_w=3)
    d.rectangle([cx - 11, cy - 13, cx - 5, cy + 13], fill=(*ENAMEL_GRN, 255))
    d.rectangle([cx + 5, cy - 13, cx + 11, cy + 13], fill=(*ENAMEL_GRN, 255))
    d.rectangle([cx - 8, cy - 3, cx + 8, cy + 3], fill=(*ENAMEL_GRN, 255))
    # Tiny timetable plaque extending down
    draw_beveled_rect(d, cx - 26, cy + 34, cx + 26, cy + 52, (226, 218, 198), ink_w=3, radius=4)
    out = apply_painterly_finish(im, w, h, seed=3203, grain=5.0, warm_bevel=True)
    return overlay_grime_stain(out, seed=3297, alpha_max=64.0, col=(40, 36, 32))


def gen_aged_tram_semaphore_signal() -> Image.Image:
    w, h = 160, 160
    im = new_hi(w, h)  # 320 x 320
    W, H = im.size
    cx, cy = 122, H // 2
    add_contact_shadow(
        im,
        lambda sd, col, off: (
            sd.ellipse([cx - 56 + off[0], cy - 56 + off[1], cx + 56 + off[0], cy + 56 + off[1]], fill=col),
            sd.rounded_rectangle([cx + off[0], cy - 22 + off[1], W - 26 + off[0], cy + 22 + off[1]], radius=8, fill=col),
        ),
        offset=(7, 9), blur=10.0, alpha=95,
    )
    d = ImageDraw.Draw(im)
    # Stone plinth + riveted iron base flange
    draw_beveled_rect(d, cx - 56, cy - 56, cx + 56, cy + 56, GRANITE_DK, ink_w=5, radius=16)
    draw_disc(d, cx, cy, 44, IRON, ink_w=5)
    # Chipped crimson-and-cream enamel semaphore signal arm extending right
    draw_beveled_rect(d, cx + 18, cy - 20, W - 28, cy + 20, ENAMEL_RED, ink_w=5, radius=8, hi_amt=0.25, sh_amt=0.38)
    d.rectangle([cx + 88, cy - 16, cx + 124, cy + 16], fill=(228, 220, 202, 255))
    d.line([(cx + 88, cy - 16), (cx + 88, cy + 16)], fill=INK, width=3)
    d.line([(cx + 124, cy - 16), (cx + 124, cy + 16)], fill=INK, width=3)
    # Rust edge chips on semaphore blade
    d.ellipse([W - 44, cy - 14, W - 32, cy - 4], fill=(*RUST_DK, 220))
    # Brass signal lantern crown with luminous cyan-emerald aether lens!
    add_glow(im, cx, cy, 38, 38, (74, 224, 184), alpha=125, blur=14.0)
    d = ImageDraw.Draw(im)
    draw_disc(d, cx, cy, 28, BRASS, ink_w=4)
    draw_disc(d, cx, cy, 17, (76, 224, 178), ink_w=3)
    d.ellipse([cx - 7, cy - 7, cx + 5, cy + 5], fill=(224, 255, 242, 255))
    out = apply_painterly_finish(im, w, h, seed=3204, grain=5.0, warm_bevel=True)
    return overlay_grime_stain(out, seed=3296, alpha_max=60.0, col=(36, 30, 26))


def gen_tram_crossing_iron_plates() -> Image.Image:
    w, h = 288, 240
    im = new_hi(w, h)  # 576 x 480 (dual-track streetcar crossing apron plates!)
    W, H = im.size
    d = ImageDraw.Draw(im)
    rng = random.Random(3205)

    # Soft dark perimeter grout/tar framing the streetcar intersection crossing apron
    d.rounded_rectangle([24, 24, W - 24, H - 24], radius=14, fill=(36, 34, 34, 235), outline=INK, width=5)

    # 3 heavy cast-iron diamond-tread crossing plates separated by the two tram track flangeways!
    plate_bands = [(34, 128), (156, 324), (352, 446)]
    for y0, y1 in plate_bands:
        for px0, px1 in [(34, 198), (204, 372), (378, W - 34)]:
            col = vary_rgb(IRON, rng, 10)
            draw_beveled_rect(d, px0, y0, px1, y1, col, ink_w=4, radius=4, hi_amt=0.22, sh_amt=0.40)
            # Diamond anti-slip cast-iron tread grid
            for gx in range(px0 + 18, px1 - 12, 22):
                for gy in range(y0 + 18, y1 - 12, 22):
                    d.polygon([(gx, gy - 5), (gx + 5, gy), (gx, gy + 5), (gx - 5, gy)], fill=(*blend_rgb(col, STEEL_HI, 0.28)[:3], 210))
            # Corner countersunk bolts + rust flecks
            for bx, by in [(px0 + 10, y0 + 10), (px1 - 10, y0 + 10), (px0 + 10, y1 - 10), (px1 - 10, y1 - 10)]:
                d.ellipse([bx - 4, by - 4, bx + 4, by + 4], fill=(*RUST, 255), outline=INK_DARK, width=2)

    # Twin recessed steel flangeway guide channels running horizontally across the plates
    for ry in [142, 338]:
        d.rectangle([28, ry - 12, W - 28, ry + 12], fill=(22, 20, 20, 255))
        d.rectangle([28, ry - 8, W - 28, ry - 2], fill=(*STEEL_RAIL, 255))
        d.line([(28, ry - 6), (W - 28, ry - 6)], fill=(*STEEL_HI, 255), width=2)
        d.rectangle([28, ry + 4, W - 28, ry + 9], fill=(*RUST_DK, 255))

    out = apply_painterly_finish(im, w, h, seed=3205, grain=5.4, warm_bevel=True)
    return overlay_grime_stain(out, seed=3295, alpha_max=82.0, col=(32, 28, 24))


def gen_rail_switch_point_box() -> Image.Image:
    w, h = 192, 160
    im = new_hi(w, h)  # 384 x 320
    W, H = im.size
    d = ImageDraw.Draw(im)
    rng = random.Random(3206)

    # Ring of chipped granite collar blocks around the recessed cast-iron switch box
    d.rounded_rectangle([24, 24, W - 24, H - 24], radius=16, fill=(*MORTAR, 245))
    for i in range(6):
        bx = 30 + i * 54
        draw_beveled_rect(d, bx, 28, bx + 50, 68, vary_rgb(GRANITE, rng, 12), ink_w=3, radius=4)
        draw_beveled_rect(d, bx, H - 68, bx + 50, H - 28, vary_rgb(GRANITE, rng, 12), ink_w=3, radius=4)
    for j in range(3):
        by = 72 + j * 58
        draw_beveled_rect(d, 30, by, 76, by + 54, vary_rgb(GRANITE, rng, 12), ink_w=3, radius=4)
        draw_beveled_rect(d, W - 76, by, W - 30, by + 54, vary_rgb(GRANITE, rng, 12), ink_w=3, radius=4)

    # Heavy riveted cast-iron point-mechanism cover plate
    draw_beveled_rect(d, 80, 72, W - 80, H - 72, IRON, ink_w=5, radius=8, hi_amt=0.22, sh_amt=0.42)
    # Recessed oil-slicked switch-lever slot & iron throwing handle
    d.rounded_rectangle([120, 126, W - 120, 194], radius=10, fill=(20, 18, 18, 255), outline=INK_IRON, width=4)
    d.line([(146, 160), (222, 160)], fill=(*RUST, 255), width=14)
    d.line([(146, 160), (222, 160)], fill=(*STEEL_RAIL, 255), width=6)
    draw_disc(d, 224, 160, 16, ENAMEL_RED, ink_w=4)
    # Brass inspection plate bolts
    for bx, by in [(94, 86), (W - 94, 86), (94, H - 86), (W - 94, H - 86)]:
        draw_disc(d, bx, by, 7, BRASS, ink_w=2)

    out = apply_painterly_finish(im, w, h, seed=3206, grain=5.4, warm_bevel=True)
    return overlay_grime_stain(out, seed=3294, alpha_max=76.0, col=(30, 26, 22))


def gen_track_cobble_repair_patch() -> Image.Image:
    w, h = 256, 160
    im = new_hi(w, h)  # 512 x 320
    W, H = im.size
    d = ImageDraw.Draw(im)
    rng = random.Random(3207)

    # Irregular dark tar-sealed municipal street repair trench filled with mismatched red brick & fresh cobbles!
    trench_pts = [
        (46, 62), (144, 44), (348, 48), (464, 72),
        (472, 226), (392, 268), (188, 274), (58, 246), (38, 152),
    ]
    d.polygon(trench_pts, fill=(28, 25, 24, 238))
    # Fill interior with neatly laid mismatched red-brick & grey cobble repair courses
    mask_im = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask_im)
    md.polygon([(x + (256 - x) * 0.06, y + (160 - y) * 0.08) for x, y in trench_pts], fill=255)

    bricks = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bricks)
    for row_i, y0 in enumerate(range(46, 272, 32)):
        off = 22 if row_i % 2 else 0
        for x0 in range(30 - off, 484, 52):
            base = BRICK_PATCH if rng.random() < 0.72 else GRANITE_LT
            col = vary_rgb(base, rng, 15)
            draw_beveled_rect(bd, x0 + 2, y0 + 2, x0 + 48, y0 + 28, col, ink_w=3, radius=3, hi_amt=0.20, sh_amt=0.35)
    im.paste(bricks, (0, 0), mask_im)
    d = ImageDraw.Draw(im)
    # Thick glossy black tar bead sealing the irregular trench boundary!
    d.line(trench_pts + [trench_pts[0]], fill=(20, 18, 18, 235), width=10, joint="curve")
    d.line([(x - 2, y - 2) for x, y in trench_pts] + [(trench_pts[0][0] - 2, trench_pts[0][1] - 2)], fill=(58, 54, 52, 160), width=3, joint="curve")

    out = apply_painterly_finish(im, w, h, seed=3207, grain=5.4, warm_bevel=True)
    return overlay_grime_stain(out, seed=3293, alpha_max=74.0, col=(34, 30, 26))


def gen_aged_granite_crosswalk() -> Image.Image:
    w, h = 320, 144
    im = new_hi(w, h)  # 640 x 288
    W, H = im.size
    d = ImageDraw.Draw(im)
    rng = random.Random(3208)

    # 6 columns of 5 hand-cut weathered pale-granite pedestrian crossing slabs with chipped corners & dark mortar!
    col_xs = [28, 128, 228, 328, 428, 528]
    for cx0 in col_xs:
        for r_i in range(5):
            y0 = 22 + r_i * 50
            y1 = y0 + 42
            jx = rng.randint(-3, 3)
            col = vary_rgb(GRANITE_LT, rng, 14)
            # Subtle central tire-wear darkening on middle rows
            if r_i in (1, 2, 3):
                col = blend_rgb(col, (64, 58, 52), rng.uniform(0.14, 0.28))[:3]
            draw_beveled_rect(d, cx0 + jx, y0, cx0 + 78 + jx, y1, col, ink_w=4, radius=6, hi_amt=0.24, sh_amt=0.36)
            # Occasional diagonal crack across an old granite block
            if rng.random() < 0.35:
                d.line([(cx0 + 18, y0 + 5), (cx0 + 42, y0 + 22), (cx0 + 56, y1 - 5)], fill=(38, 34, 32, 185), width=2)

    out = apply_painterly_finish(im, w, h, seed=3208, grain=5.4, warm_bevel=True)
    return overlay_grime_stain(out, seed=3292, alpha_max=82.0, col=(42, 38, 34))


def gen_overhead_catenary_pole() -> Image.Image:
    w, h = 160, 128
    im = new_hi(w, h)  # 320 x 256
    W, H = im.size
    cx, cy = 88, H // 2
    add_contact_shadow(
        im,
        lambda sd, col, off: (
            sd.ellipse([cx - 42 + off[0], cy - 42 + off[1], cx + 42 + off[0], cy + 42 + off[1]], fill=col),
            sd.rounded_rectangle([cx + off[0], cy - 14 + off[1], W - 24 + off[0], cy + 14 + off[1]], radius=6, fill=col),
        ),
        offset=(6, 8), blur=9.0, alpha=95,
    )
    d = ImageDraw.Draw(im)
    # Stone sidewalk collar + fluted cast-iron traction mast base
    draw_disc(d, cx, cy, 42, GRANITE_DK, ink_w=4)
    draw_disc(d, cx, cy, 30, IRON_DK, ink_w=5)
    # Cantilevered iron catenary bracket arm reaching toward the tracks
    draw_beveled_rect(d, cx + 10, cy - 11, W - 26, cy + 11, IRON, ink_w=4, radius=5)
    # Decorative scroll iron strut & ceramic cyan-glazed wire insulator at tip!
    d.arc([cx + 28, cy - 34, cx + 126, cy + 34], 20, 160, fill=INK_IRON, width=6)
    d.arc([cx + 28, cy - 34, cx + 126, cy + 34], 200, 340, fill=INK_IRON, width=6)
    draw_disc(d, W - 44, cy, 15, VERDIGRIS, ink_w=4)
    draw_disc(d, W - 44, cy, 8, (226, 232, 236), ink_w=2)
    # Ornate brass finial cap atop pole
    draw_disc(d, cx, cy, 16, BRASS, ink_w=4)
    out = apply_painterly_finish(im, w, h, seed=3209, grain=4.8, warm_bevel=True)
    return overlay_grime_stain(out, seed=3291, alpha_max=56.0, col=(34, 30, 26))


def gen_street_manhole_granite_collar() -> Image.Image:
    w, h = 176, 176
    im = new_hi(w, h)  # 352 x 352
    W, H = im.size
    cx, cy = W // 2, H // 2
    d = ImageDraw.Draw(im)
    rng = random.Random(3210)

    # Soft oil-darkened mortar ring around granite collar stones
    d.ellipse([22, 22, W - 22, H - 22], fill=(32, 28, 26, 232))
    # 12 hand-cut trapezoidal granite collar setts ringing the cast-iron manhole frame!
    n_setts = 12
    r_in, r_out = 104, 146
    for i in range(n_setts):
        a0 = (i / n_setts) * math.tau + 0.03
        a1 = ((i + 1) / n_setts) * math.tau - 0.03
        pts = [
            (cx + math.cos(a0) * r_in, cy + math.sin(a0) * r_in),
            (cx + math.cos(a0) * r_out, cy + math.sin(a0) * r_out),
            (cx + math.cos(a1) * r_out, cy + math.sin(a1) * r_out),
            (cx + math.cos(a1) * r_in, cy + math.sin(a1) * r_in),
        ]
        col = vary_rgb(GRANITE, rng, 15)
        d.polygon(pts, fill=(*col, 255), outline=INK, width=4)
        # Top-left highlight on outer stone rim
        d.line([pts[1], pts[2]], fill=blend_rgb(col, (232, 224, 210), 0.25), width=2)

    # Heavy Recessed Cast-Iron Frame Ring + Rust Groove
    draw_disc(d, cx, cy, 106, IRON_DK, ink_w=6)
    d.ellipse([cx - 98, cy - 98, cx + 98, cy + 98], outline=(*RUST_DK, 235), width=6)
    draw_disc(d, cx, cy, 92, IRON, ink_w=5)

    # Concentric embossed waffle-tread rings & radial ribs (classic Berlin municipal lid!)
    for rr in [74, 52, 28]:
        d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=INK_DARK, width=6)
        d.ellipse([cx - rr + 2, cy - rr + 2, cx + rr - 2, cy + rr - 2], outline=(*STEEL_RAIL, 155), width=2)
    for i in range(12):
        ang = i * math.tau / 12
        d.line(
            [(cx + math.cos(ang) * 28, cy + math.sin(ang) * 28), (cx + math.cos(ang) * 88, cy + math.sin(ang) * 88)],
            fill=INK_DARK,
            width=5,
        )
        d.line(
            [(cx + math.cos(ang) * 28 - 1, cy + math.sin(ang) * 28 - 1), (cx + math.cos(ang) * 88 - 1, cy + math.sin(ang) * 88 - 1)],
            fill=(*STEEL_RAIL, 130),
            width=2,
        )
    # Center raised municipal medallion + twin iron crowbar pry-key slots!
    draw_disc(d, cx, cy, 22, IRON_DK, ink_w=4)
    d.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=(*RUST, 215))
    for sx in [cx - 64, cx + 64]:
        d.rounded_rectangle([sx - 8, cy - 12, sx + 8, cy + 12], radius=4, fill=(16, 14, 14, 255), outline=INK_DARK, width=2)

    out = apply_painterly_finish(im, w, h, seed=3210, grain=5.4, warm_bevel=True)
    return overlay_grime_stain(out, seed=3290, alpha_max=82.0, col=(48, 34, 24))


def gen_curb_storm_drain_basin() -> Image.Image:
    w, h = 176, 128
    im = new_hi(w, h)  # 352 x 256
    W, H = im.size
    d = ImageDraw.Draw(im)

    # Dressed mossy granite curbstone frame
    draw_beveled_rect(d, 22, 22, W - 22, H - 22, CURB_STONE, ink_w=5, radius=10, hi_amt=0.22, sh_amt=0.38)
    # Moss & gutter silt streaks tucked into top curb groove
    d.ellipse([36, 26, 118, 48], fill=(*MOSS, 145))
    d.ellipse([236, 28, 314, 52], fill=(*MOSS, 130))

    # Recessed cast-iron catch-basin frame & heavy rust-patinated drainage bars
    draw_beveled_rect(d, 48, 48, W - 48, H - 48, IRON_DK, ink_w=5, radius=6)
    d.rectangle([62, 62, W - 62, H - 62], fill=(14, 14, 16, 255))
    # 7 heavy iron grating ribs + central cross-bar
    for bx in range(74, W - 70, 32):
        draw_beveled_rect(d, bx, 60, bx + 14, H - 60, IRON, ink_w=3, radius=2)
        d.rectangle([bx + 2, 74, bx + 11, 96], fill=(*RUST_DK, 195))
    draw_beveled_rect(d, 58, H // 2 - 7, W - 58, H // 2 + 7, IRON, ink_w=3, radius=2)

    out = apply_painterly_finish(im, w, h, seed=3211, grain=5.2, warm_bevel=True)
    return overlay_grime_stain(out, seed=3289, alpha_max=78.0, col=(44, 34, 24))


def gen_street_steam_grate_vent() -> Image.Image:
    w, h = 176, 144
    im = new_hi(w, h)  # 352 x 288
    W, H = im.size
    d = ImageDraw.Draw(im)

    # Soot-darkened granite sidewalk border
    draw_beveled_rect(d, 22, 22, W - 22, H - 22, GRANITE_DK, ink_w=5, radius=10)
    # Riveted cast-iron square subway/aether steam vent frame
    draw_beveled_rect(d, 44, 42, W - 44, H - 42, IRON, ink_w=5, radius=6)
    d.rectangle([60, 58, W - 60, H - 58], fill=(16, 18, 22, 255))
    # Warm faint steam/aether mist emerging subtly from deep flue slots
    add_glow(im, W // 2, H // 2, 90, 62, (162, 186, 196), alpha=68, blur=18.0)
    d = ImageDraw.Draw(im)
    # Crossed iron waffle grating bars
    for bx in range(74, W - 70, 26):
        d.rectangle([bx, 58, bx + 9, H - 58], fill=(*IRON, 255), outline=INK_DARK, width=2)
    for by in range(86, H - 72, 42):
        d.rectangle([58, by, W - 58, by + 10], fill=(*IRON_DK, 255), outline=INK_DARK, width=2)
    # Corner rivets with rust patina
    for rx, ry in [(52, 50), (W - 52, 50), (52, H - 50), (W - 52, H - 50)]:
        draw_disc(d, rx, ry, 7, RUST, ink_w=2)

    out = apply_painterly_finish(im, w, h, seed=3212, grain=5.4, warm_bevel=True)
    return overlay_grime_stain(out, seed=3288, alpha_max=72.0, col=(28, 26, 26))


PATH_SPECS = [
    ("path_aged_streetcar_cobble_track.png", "Aged Embedded Granite-Sett Streetcar Track",
     ["streetcar", "tram", "rail", "track", "street", "berlin", "aged", "cobble", "harmony"],
     gen_path_aged_streetcar_cobble_track),
    ("path_aged_tram_median_cobbles.png", "Aged Basalt Tramway Median & Faded Markers",
     ["streetcar", "tram", "rail", "track", "street", "median", "cobble", "aged", "harmony"],
     gen_path_aged_tram_median_cobbles),
    ("path_aged_curb_gutter_grime.png", "Aged Curb Gutter Silt & Grime Ribbon",
     ["weathering", "grime", "street", "curb", "gutter", "dirt", "aged", "overlay", "harmony"],
     gen_path_aged_curb_gutter_grime),
]

PROP_SPECS = [
    ("st_aged_magipunk_tram_car.png", "Weathered Berlin-Magipunk Streetcar #14", True,
     ["streetcar", "tram", "train", "vehicle", "magipunk", "berlin", "street", "aged", "hero", "harmony"],
     gen_aged_magipunk_tram_car),
    ("st_aged_tram_stop_shelter.png", "Aged Cast-Iron & Dusty-Glass Tram Stop Shelter", True,
     ["streetcar", "tram", "stop", "shelter", "berlin", "street", "aged", "harmony"],
     gen_aged_tram_stop_shelter),
    ("st_aged_tram_stop_signpost.png", "Cast-Iron Berlin 'H' Tram Stop Signpost (Modular)", True,
     ["streetcar", "tram", "stop", "sign", "modular", "berlin", "street", "aged", "harmony"],
     gen_aged_tram_stop_signpost),
    ("st_aged_tram_semaphore_signal.png", "Weathered Iron & Brass Tram Semaphore Signal", True,
     ["streetcar", "tram", "rail", "semaphore", "signal", "magipunk", "street", "aged", "harmony"],
     gen_aged_tram_semaphore_signal),
    ("st_tram_crossing_iron_plates.png", "Cast-Iron & Granite Dual-Rail Crossing Plates", False,
     ["streetcar", "tram", "rail", "track", "crossing", "street", "iron", "aged", "harmony"],
     gen_tram_crossing_iron_plates),
    ("st_rail_switch_point_box.png", "Recessed Tramway Switch Box & Point Lever Pit", False,
     ["streetcar", "tram", "rail", "track", "switch", "street", "iron", "aged", "harmony"],
     gen_rail_switch_point_box),
    ("st_track_cobble_repair_patch.png", "Mismatched Brick & Tar Street Repair Patch", False,
     ["streetcar", "street", "cobble", "patch", "weathering", "grime", "decal", "aged", "harmony"],
     gen_track_cobble_repair_patch),
    ("st_aged_granite_crosswalk.png", "Worn & Chipped Granite Block Crosswalk", False,
     ["streetcar", "street", "crosswalk", "cobble", "granite", "aged", "decal", "harmony"],
     gen_aged_granite_crosswalk),
    ("st_overhead_catenary_pole.png", "Fluted Cast-Iron Tramway Catenary Wire Pole", True,
     ["streetcar", "tram", "rail", "pole", "catenary", "berlin", "street", "iron", "harmony"],
     gen_overhead_catenary_pole),
    ("st_street_manhole_granite_collar.png", "Cast-Iron Municipal Manhole in Granite Collar", False,
     ["streetcar", "manhole", "sewer", "street", "drain", "iron", "aged", "decal", "harmony"],
     gen_street_manhole_granite_collar),
    ("st_curb_storm_drain_basin.png", "Mossy Cast-Iron Curb Storm Drain Catch-Basin", False,
     ["streetcar", "drain", "grate", "sewer", "street", "curb", "iron", "aged", "decal", "harmony"],
     gen_curb_storm_drain_basin),
    ("st_street_steam_grate_vent.png", "Soot-Rimmed Municipal Sidewalk Steam Vent Grate", False,
     ["streetcar", "vent", "steam", "grate", "street", "alley", "iron", "aged", "decal", "harmony"],
     gen_street_steam_grate_vent),
]


def main() -> None:
    qa_items: list[tuple[str, Image.Image]] = []
    manifest_entries: list[dict] = []

    for fname, display_name, tags, fn in PATH_SPECS:
        im = fn()
        im.save(PATHS_DIR / fname)
        qa_items.append((fname.replace("path_", "").replace(".png", ""), im))
        manifest_entries.append({
            "path": f"paths/streetcar/{fname}",
            "displayName": display_name,
            "category": "path",
            "widthPx": im.width,
            "heightPx": im.height,
            "defaultPpi": 256,
            "drawMode": "normal",
            "dominantHex": dominant_hex(im),
            "castsShadow": False,
            "tags": tags,
        })

    for fname, display_name, casts_shadow, tags, fn in PROP_SPECS:
        im = fn()
        im.save(PROPS_DIR / fname)
        qa_items.append((fname.replace("st_", "").replace(".png", ""), im))
        manifest_entries.append({
            "path": f"props/aged_streetcar_line/{fname}",
            "displayName": display_name,
            "category": "object",
            "widthPx": im.width,
            "heightPx": im.height,
            "defaultPpi": 256,
            "drawMode": "normal",
            "dominantHex": dominant_hex(im),
            "castsShadow": casts_shadow,
            "tags": tags,
        })

    upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    qa_path = SCRATCH_DIR / "qa_aged_streetcar_suite.png"
    save_qa_sheet(qa_items, qa_path, cols=5)
    print(f"Generated {len(PATH_SPECS)} paths + {len(PROP_SPECS)} props -> {PATHS_DIR} & {PROPS_DIR}")
    print(f"QA sheet -> {qa_path}")


if __name__ == "__main__":
    main()

"""
Dice Chaos Compass — 12-Asset Aged European City Streets & Sidewalk Fixtures Suite

Matches `harmony_gen_aged_streetcar_suite.py` (Eisenbahnstraße) 100% in granite-sett
stone scale, mortar depth, charcoal ink (#1E1816), warm-cool basalt/granite palette,
and painterly gouache grain so every avenue, boulevard, and back alley feels part of
one unified hand-crafted Berlin-Magipunk city!

Generates 12 clean-room CC0 Studio Harmony assets:
  - 2 Seamless Tileable Road Terrains (`terrain/city_streets/`, 512x512 XY-seamless):
      1. `terr_berlin_aged_granite_setts.png`    — Coursed weathered Berlin granite-sett paving
      2. `terr_alley_damp_basalt_cobbles.png`    — Damp, mossy dark-basalt back-alley cobbles
  - 3 Seamless Directional Road Paths (`paths/city_streets/`, 512px X-seamless):
      3. `path_avenue_carriage_tracks.png`       — Worn carriage wheel-ruts & dark basalt crown
      4. `path_alley_central_drain_gutter.png`   — Dressed-stone alley central drainage runnel
      5. `path_granite_curb_gutter_edge.png`     — Dressed granite curbstone & gutter channel trim
  - 7 Bespoke Studio Harmony Street & Sidewalk Props (`props/city_streets/`):
      6. `st_berlin_litfass_column.png`          — Verdigris-domed Berlin Litfaßsäule poster pillar
      7. `st_stone_boulevard_planter.png`        — Carved limestone sidewalk shrub & blossom planter
      8. `st_cast_iron_alley_steam_vent.png`     — Riveted cast-iron soot-rimmed alley steam grate
      9. `st_brass_porter_luggage_cart.png`      — Slatted oak & brass hotel/station luggage trolley
     10. `st_sidewalk_cellar_hatch_flush.png`    — Stone-framed flush sidewalk iron cellar flap doors
     11. `st_iron_bollard_chain_pair.png`        — Fluted iron curb bollards linked by draped chain
     12. `st_alley_wall_lantern_bracket.png`     — Wrought-iron wall-mounted alley gas lantern bracket
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
    draw_beveled_rect,
    draw_wood_planks_box,
    blend_rgb,
    vary_rgb,
    save_qa_sheet,
    upsert_manifest_entries,
    dominant_hex,
)

TERR_DIR = MOD_DIR / "terrain" / "city_streets"
PATHS_DIR = MOD_DIR / "paths" / "city_streets"
PROPS_DIR = MOD_DIR / "props" / "city_streets"
for _d in (TERR_DIR, PATHS_DIR, PROPS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# Exact Eisenbahnstraße Aged Berlin Streetcar Palette (100% cohesive match!)
BASALT = (74, 76, 82)
BASALT_DK = (58, 60, 66)
GRANITE = (116, 114, 110)
GRANITE_LT = (146, 142, 132)
GRANITE_DK = (64, 64, 68)
GRANITE_WARM = (126, 118, 108)
CURB_STONE = (138, 132, 122)
MORTAR = (40, 38, 36)
IRON = (62, 66, 74)
IRON_DK = (36, 40, 46)
STEEL = (144, 152, 160)
STEEL_HI = (196, 204, 212)
RUST = (136, 66, 38)
VERDIGRIS = (74, 128, 114)
VERDIGRIS_HI = (108, 162, 146)
COPPER = (168, 102, 64)
BRASS = (198, 156, 74)
BRASS_HI = (232, 198, 112)
OAK = (134, 96, 60)
WALNUT = (88, 58, 40)
LEATHER = (130, 76, 46)
LEATHER_DK = (76, 44, 28)
PRUSSIAN = (44, 74, 108)
CREAM = (232, 222, 198)
PAPER = (218, 206, 180)
MOSS = (74, 96, 48)
MOSS_LT = (102, 128, 66)
FOLIAGE_DK = (48, 76, 42)
FOLIAGE_MID = (74, 112, 58)
FOLIAGE_HI = (112, 148, 78)
BLOSSOM_CORAL = (192, 92, 76)
BLOSSOM_GOLD = (224, 184, 78)
BLOSSOM_LAV = (148, 124, 174)
AMBER_GLOW = (255, 198, 96)


def draw_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rgb: tuple[int, int, int],
    ink_w: int = 4,
) -> None:
    dk = blend_rgb(rgb, (18, 16, 16), 0.40)
    hi = blend_rgb(rgb, (252, 246, 232), 0.36)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dk, outline=INK, width=ink_w)
    d.ellipse([cx - r * 0.84, cy - r * 0.84, cx + r * 0.84, cy + r * 0.84], fill=(*rgb, 255))
    if r >= 8:
        d.arc(
            [cx - r * 0.66, cy - r * 0.66, cx + r * 0.66, cy + r * 0.66],
            195,
            310,
            fill=hi,
            width=max(2, int(r * 0.14)),
        )


def feather_y_edges(im: Image.Image, band_px: int = 16) -> Image.Image:
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


def finish_prop(
    im: Image.Image,
    w: int,
    h: int,
    seed: int,
    grain: float = 5.2,
    shadow_offset: tuple[int, int] = (6, 8),
    shadow_blur: float = 7.5,
    shadow_alpha: int = 92,
) -> Image.Image:
    alpha_ch = im.split()[3]
    sh_alpha = alpha_ch.point(lambda a: int(a * (shadow_alpha / 255.0)))
    sh = Image.new("RGBA", im.size, (16, 12, 12, 0))
    sh.putalpha(sh_alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(shadow_blur))
    canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
    canvas.alpha_composite(sh, shadow_offset)
    canvas.alpha_composite(im)
    return apply_painterly_finish(canvas, w, h, seed=seed, grain=grain, warm_bevel=True)


# =============================================================================
# 1–2: SEAMLESS XY ROAD TERRAIN TEXTURES (`terrain/city_streets/`, 512x512)
# =============================================================================
def gen_terr_berlin_aged_granite_setts() -> Image.Image:
    """Coursed weathered Berlin granite-sett paving matching Eisenbahnstraße tracks 100%."""
    w, h = 512, 512
    W, H = w * 2, h * 2  # 1024x1024 seamless XY!
    im = Image.new("RGBA", (W, H), (*MORTAR, 255))
    d = ImageDraw.Draw(im)
    rng = random.Random(7101)

    n_rows = 16
    row_h = H / n_rows  # 64px in 2x -> 32px in 1x (matches streetcar track sett height!)
    palette = [GRANITE, GRANITE_WARM, BASALT, GRANITE, GRANITE_DK, GRANITE_WARM, BASALT]

    for r in range(n_rows):
        y0 = r * row_h + 3
        y1 = (r + 1) * row_h - 3
        cols = 12 if (r % 3 != 0) else 14
        cw = W / cols
        off = (cw * 0.5) if (r % 2 == 1) else (cw * 0.25 if r % 4 == 2 else 0.0)
        for c in range(cols):
            x0 = (c * cw + off) % W
            base = rng.choice(palette)
            col = vary_rgb(base, rng, 13)
            # Slightly lighter sunlit top granite setts mixed with cool charcoal basalt
            if rng.random() < 0.14:
                col = vary_rgb(GRANITE_LT, rng, 10)
            hi = blend_rgb(col, (232, 224, 206), 0.22)
            sh = blend_rgb(col, (20, 18, 18), 0.36)
            has_crack = rng.random() < 0.16
            crack_dx = rng.randint(-8, 8)
            for shift in (0, -W, W):
                bx0 = x0 + shift + 3
                bx1 = x0 + shift + cw - 3
                if bx1 < -4 or bx0 > W + 4:
                    continue
                d.rounded_rectangle(
                    [bx0, y0, bx1, y1],
                    radius=7,
                    fill=(*col, 255),
                    outline=(32, 28, 26, 255),
                    width=4,
                )
                d.line([(bx0 + 6, y0 + 4), (bx1 - 6, y0 + 4)], fill=hi, width=3)
                d.line([(bx0 + 6, y0 + 4), (bx0 + 6, y1 - 6)], fill=hi, width=2)
                d.line([(bx0 + 6, y1 - 4), (bx1 - 6, y1 - 4)], fill=sh, width=3)
                if has_crack:
                    mx = (bx0 + bx1) * 0.5
                    d.line(
                        [(mx - 6, y0 + 7), (mx + crack_dx * 0.3, (y0 + y1) * 0.5), (mx + crack_dx, y1 - 7)],
                        fill=(30, 26, 24, 195),
                        width=2,
                    )

    # Subtle periodic fBm street dust & rainwater weathering veil across the granite bed
    arr = np.array(im, dtype=np.float32)
    n_grime = fbm_periodic(H, W, ((3, 3, 0.45), (7, 7, 0.35), (16, 16, 0.20)), seed=7102)
    dark_m = np.clip((n_grime - 0.46) * 0.72, 0.0, 0.34)
    dust_m = np.clip((0.44 - n_grime) * 0.50, 0.0, 0.20)
    for ch, dcol, lcol in [(0, 34, 164), (1, 32, 156), (2, 30, 142)]:
        arr[:, :, ch] = arr[:, :, ch] * (1.0 - dark_m) + dcol * dark_m
        arr[:, :, ch] = arr[:, :, ch] * (1.0 - dust_m) + lcol * dust_m
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    return apply_painterly_finish(im, w, h, seed=7103, grain=5.4, periodic_xy=True, warm_bevel=False)


def gen_terr_alley_damp_basalt_cobbles() -> Image.Image:
    """Darker, weathered, slightly damp back-alley basalt cobbles with mortar-joint moss wisps."""
    w, h = 512, 512
    W, H = w * 2, h * 2
    im = Image.new("RGBA", (W, H), (32, 30, 28, 255))
    d = ImageDraw.Draw(im)
    rng = random.Random(7111)

    n_rows = 16
    row_h = H / n_rows
    palette = [BASALT, BASALT_DK, GRANITE_DK, (82, 82, 84), (92, 88, 84), BASALT]

    moss_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    md = ImageDraw.Draw(moss_layer)

    for r in range(n_rows):
        y0 = r * row_h + 3
        y1 = (r + 1) * row_h - 3
        cols = 13 if (r % 2 == 0) else 11
        cw = W / cols
        off = (cw * 0.48) if (r % 2 == 1) else 0.0
        for c in range(cols):
            x0 = (c * cw + off) % W
            col = vary_rgb(rng.choice(palette), rng, 12)
            hi = blend_rgb(col, (206, 204, 196), 0.20)
            sh = blend_rgb(col, (14, 14, 16), 0.42)
            moss_joint = rng.random() < 0.20
            for shift in (0, -W, W):
                bx0 = x0 + shift + 3
                bx1 = x0 + shift + cw - 3
                if bx1 < -4 or bx0 > W + 4:
                    continue
                d.rounded_rectangle(
                    [bx0, y0, bx1, y1],
                    radius=10,
                    fill=(*col, 255),
                    outline=(24, 22, 22, 255),
                    width=4,
                )
                d.line([(bx0 + 8, y0 + 5), (bx1 - 8, y0 + 5)], fill=hi, width=2)
                d.line([(bx0 + 8, y1 - 5), (bx1 - 8, y1 - 5)], fill=sh, width=3)
                # Soft organic creeping olive-moss wisp nestled deep inside the mortar joint
                if moss_joint:
                    md.ellipse([bx0 - 10, y1 - 4, bx0 + 22, y1 + 8], fill=(64, 84, 42, 145))
                    md.ellipse([bx0 + 2, y1 - 2, bx0 + 18, y1 + 6], fill=(82, 104, 52, 115))

    im.alpha_composite(moss_layer.filter(ImageFilter.GaussianBlur(3.5)))

    # Damp alley moisture & mossy mortar haze
    arr = np.array(im, dtype=np.float32)
    n_damp = fbm_periodic(H, W, ((3, 3, 0.50), (8, 8, 0.30), (18, 18, 0.20)), seed=7112)
    damp_m = np.clip((n_damp - 0.44) * 0.85, 0.0, 0.38)
    for ch, dcol in [(0, 26), (1, 30), (2, 34)]:
        arr[:, :, ch] = arr[:, :, ch] * (1.0 - damp_m) + dcol * damp_m
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    return apply_painterly_finish(im, w, h, seed=7113, grain=5.6, periodic_xy=True, warm_bevel=False)


# =============================================================================
# 3–5: SEAMLESS X DIRECTIONAL STREET PATHS (`paths/city_streets/`)
# =============================================================================
def gen_path_avenue_carriage_tracks() -> Image.Image:
    """Directional coursed boulevard granite-sett strip with twin worn carriage wheel-ruts."""
    w, h = 512, 192
    W, H = w * 2, h * 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(7121)

    # Full-width coursed granite bed tapering softly at top & bottom edges
    d.rectangle([0, 24, W, H - 24], fill=(*MORTAR, 235))
    rows = [
        (28, 64, 46, GRANITE),
        (68, 108, 48, GRANITE_WARM),
        (112, 150, 44, BASALT),
        (154, 190, 46, GRANITE_DK),
        (194, 230, 46, GRANITE_DK),
        (234, 272, 44, BASALT),
        (276, 316, 48, GRANITE_WARM),
        (320, 356, 46, GRANITE),
    ]
    for ridx, (y0, y1, step_x, base_col) in enumerate(rows):
        count = max(12, round(W / step_x))
        cw = W / count
        off = (cw * 0.5) if (ridx % 2 == 1) else 0.0
        for i in range(count + 1):
            x0 = (i * cw + off) % W
            col = vary_rgb(base_col, rng, 13)
            # Subtle crown darkening in middle & worn lighter wheel-polished strips at y≈104 & y≈280
            yc = (y0 + y1) * 0.5
            wheel_prox = max(
                max(0.0, 1.0 - abs(yc - 102.0) / 36.0),
                max(0.0, 1.0 - abs(yc - (H - 102.0)) / 36.0),
            )
            col = blend_rgb(col, (162, 154, 138), wheel_prox * 0.24)[:3]
            hi = blend_rgb(col, (232, 224, 206), 0.22)
            sh = blend_rgb(col, (18, 16, 16), 0.36)
            for shift in (0, -W):
                bx0 = x0 + shift + 2
                bx1 = x0 + shift + cw - 3
                if bx1 < -4 or bx0 > W + 4:
                    continue
                d.rounded_rectangle([bx0, y0, bx1, y1], radius=6, fill=(*col, 255), outline=(34, 30, 28, 255), width=3)
                d.line([(bx0 + 5, y0 + 3), (bx1 - 5, y0 + 3)], fill=hi, width=2)
                d.line([(bx0 + 5, y1 - 3), (bx1 - 5, y1 - 3)], fill=sh, width=2)

    # Twin soft worn carriage wheel-rut patina ribbons & faint horse-lane dark dust down center!
    rut = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rut)
    rd.rectangle([0, 92, W, 118], fill=(30, 26, 22, 92))
    rd.rectangle([0, H - 118, W, H - 92], fill=(30, 26, 22, 92))
    rd.rectangle([0, 156, W, 228], fill=(28, 24, 22, 54))
    im.alpha_composite(rut.filter(ImageFilter.GaussianBlur(8.0)))

    out = apply_painterly_finish(im, w, h, seed=7122, grain=5.2, periodic_x=True, warm_bevel=True)
    return feather_y_edges(out, band_px=22)


def gen_path_alley_central_drain_gutter() -> Image.Image:
    """Weathered stone drainage runnel & flanking mossy basalt cobbles for narrow back alleys."""
    w, h = 512, 128
    W, H = w * 2, h * 2  # 1024x256
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(7131)

    d.rectangle([0, 24, W, H - 24], fill=(30, 28, 26, 230))
    # Flanking irregular basalt cobbles above & below the central stone gutter
    for ridx, (y0, y1, base_col) in enumerate([(28, 76, BASALT), (H - 76, H - 28, BASALT)]):
        count = 20
        cw = W / count
        off = (cw * 0.5) if ridx == 1 else 0.0
        for i in range(count + 1):
            x0 = (i * cw + off) % W
            col = vary_rgb(base_col, rng, 13)
            hi = blend_rgb(col, (214, 210, 200), 0.20)
            sh = blend_rgb(col, (16, 16, 16), 0.40)
            for shift in (0, -W):
                bx0, bx1 = x0 + shift + 2, x0 + shift + cw - 3
                if bx1 < -4 or bx0 > W + 4:
                    continue
                d.rounded_rectangle([bx0, y0, bx1, y1], radius=7, fill=(*col, 255), outline=INK_DARK, width=3)
                d.line([(bx0 + 5, y0 + 3), (bx1 - 5, y0 + 3)], fill=hi, width=2)
                d.line([(bx0 + 5, y1 - 3), (bx1 - 5, y1 - 3)], fill=sh, width=2)

    # Central double-row dressed granite V-gutter channel with recessed damp rainwater seam!
    for gy0, gy1 in [(82, 122), (134, 174)]:
        count = 14
        cw = W / count
        for i in range(count + 1):
            x0 = (i * cw) % W
            col = vary_rgb(CURB_STONE, rng, 11)
            hi = blend_rgb(col, (238, 232, 218), 0.24)
            sh = blend_rgb(col, (20, 18, 18), 0.42)
            for shift in (0, -W):
                bx0, bx1 = x0 + shift + 2, x0 + shift + cw - 3
                if bx1 < -4 or bx0 > W + 4:
                    continue
                d.rounded_rectangle([bx0, gy0, bx1, gy1], radius=4, fill=(*col, 255), outline=INK_DARK, width=3)
                d.line([(bx0 + 4, gy0 + 3), (bx1 - 4, gy0 + 3)], fill=hi, width=2)
                d.line([(bx0 + 4, gy1 - 3), (bx1 - 4, gy1 - 3)], fill=sh, width=2)

    # Dark wet central V-channel trough + subtle moss wisps along gutter joints
    damp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(damp)
    dd.rectangle([0, 114, W, 142], fill=(22, 24, 28, 175))
    dd.rectangle([0, 122, W, 134], fill=(14, 16, 20, 210))
    for mx in [112, 344, 588, 864]:
        dd.ellipse([mx - 18, 74, mx + 18, 92], fill=(*MOSS, 135))
        dd.ellipse([mx - 16, 166, mx + 16, 182], fill=(*MOSS, 125))
    im.alpha_composite(damp.filter(ImageFilter.GaussianBlur(4.0)))

    out = apply_painterly_finish(im, w, h, seed=7132, grain=5.4, periodic_x=True, warm_bevel=True)
    return feather_y_edges(out, band_px=18)


def gen_path_granite_curb_gutter_edge() -> Image.Image:
    """Dressed pale-granite curbstone edge & dark shadowed drainage gutter seam."""
    w, h = 512, 96
    W, H = w * 2, h * 2  # 1024x192
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(7141)

    # Soft dark rainwater gutter shadow beneath curb lip
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.rectangle([0, 96, W, 168], fill=(24, 22, 20, 155))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10.0)))
    d = ImageDraw.Draw(im)

    # Single crisp row of dressed granite curb blocks (y=36..98) + lower gutter sett row (y=102..144)
    count = 10
    cw = W / count
    for i in range(count + 1):
        x0 = (i * cw) % W
        col = vary_rgb(CURB_STONE, rng, 10)
        hi = blend_rgb(col, (244, 238, 224), 0.28)
        shc = blend_rgb(col, (22, 20, 20), 0.44)
        for shift in (0, -W):
            bx0, bx1 = x0 + shift + 2, x0 + shift + cw - 3
            if bx1 < -4 or bx0 > W + 4:
                continue
            d.rounded_rectangle([bx0, 36, bx1, 98], radius=4, fill=(*col, 255), outline=INK_DARK, width=4)
            d.line([(bx0 + 6, 42), (bx1 - 6, 42)], fill=hi, width=4)
            d.line([(bx0 + 6, 92), (bx1 - 6, 92)], fill=shc, width=4)

    count2 = 16
    cw2 = W / count2
    for i in range(count2 + 1):
        x0 = (i * cw2 + cw2 * 0.35) % W
        col = vary_rgb(BASALT, rng, 11)
        for shift in (0, -W):
            bx0, bx1 = x0 + shift + 2, x0 + shift + cw2 - 3
            if bx1 < -4 or bx0 > W + 4:
                continue
            d.rounded_rectangle([bx0, 104, bx1, 146], radius=4, fill=(*col, 255), outline=INK_DARK, width=3)

    out = apply_painterly_finish(im, w, h, seed=7142, grain=5.0, periodic_x=True, warm_bevel=True)
    return feather_y_edges(out, band_px=14)


# =============================================================================
# 6–12: BESPOKE STUDIO HARMONY STREET & SIDEWALK PROPS (`props/city_streets/`)
# =============================================================================
def gen_st_berlin_litfass_column() -> Image.Image:
    """Verdigris-domed Victorian Berlin Litfaßsäule poster pillar (replaces flat rainbow circle!)."""
    w, h = 160, 160
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy = W / 2.0, H / 2.0

    # Weathered granite circular plinth base
    draw_disc(d, cx, cy, 118, CURB_STONE, ink_w=6)
    # Subtle vintage pasted poster parchment edges peeking slightly past cornice rim
    for a_deg, col in [(20, PAPER), (95, (206, 178, 134)), (185, CREAM), (265, (194, 152, 126))]:
        rad = math.radians(a_deg)
        px, py = cx + math.cos(rad) * 102, cy + math.sin(rad) * 102
        draw_disc(d, px, py, 16, col, ink_w=3)
    # Dark cast-iron decorative cornice crown ring with scalloped iron studs
    draw_disc(d, cx, cy, 102, IRON_DK, ink_w=6)
    draw_disc(d, cx, cy, 92, IRON, ink_w=4)
    for k in range(12):
        a = k * math.tau / 12.0
        draw_disc(d, cx + math.cos(a) * 96, cy + math.sin(a) * 96, 5, STEEL, ink_w=2)
    # Domed oxidized verdigris-copper roof cap with 8 riveted standing-seam ribs!
    draw_disc(d, cx, cy, 80, VERDIGRIS, ink_w=5)
    draw_disc(d, cx, cy, 62, VERDIGRIS_HI, ink_w=2)
    for k in range(8):
        a = k * math.tau / 8.0
        d.line([(cx, cy), (cx + math.cos(a) * 78, cy + math.sin(a) * 78)], fill=INK_IRON, width=5)
        d.line([(cx, cy), (cx + math.cos(a) * 76, cy + math.sin(a) * 76)], fill=(54, 96, 84, 255), width=2)
    # Ornate cast-brass acorn spire finial at the dead center
    draw_disc(d, cx, cy, 22, IRON_DK, ink_w=4)
    draw_disc(d, cx, cy, 15, BRASS, ink_w=3)
    draw_disc(d, cx, cy, 7, BRASS_HI, ink_w=2)
    return finish_prop(im, w, h, seed=7151)


def gen_st_stone_boulevard_planter() -> Image.Image:
    """Carved limestone boulevard sidewalk planter trough with lush painterly shrubs & blossoms."""
    w, h = 176, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(7161)

    # Dressed chamfered limestone trough with corner stone joints & moss streaks
    draw_beveled_rect(d, 20, 22, W - 20, H - 22, CURB_STONE, radius=12, ink_w=6, hi_amt=0.28, sh_amt=0.40)
    # Corner stone cap miter lines
    for p0, p1 in [((24, 26), (48, 46)), ((W - 24, 26), (W - 48, 46)), ((24, H - 26), (48, H - 46)), ((W - 24, H - 26), (W - 48, H - 46))]:
        d.line([p0, p1], fill=INK_MID, width=3)
    # Recessed dark humus soil bed
    draw_beveled_rect(d, 44, 44, W - 44, H - 44, (56, 42, 32), radius=8, ink_w=4)
    for _ in range(28):
        sx, sy = rng.randint(52, W - 52), rng.randint(52, H - 52)
        d.ellipse([sx - 4, sy - 3, sx + 4, sy + 3], fill=(76, 58, 44, 220))
    # Layered hand-inked painterly boxwood & herb foliage clusters (rich overlapping leaves, ZERO flat circles!)
    clusters = [(86, H * 0.52, 38), (144, H * 0.48, 42), (208, H * 0.52, 42), (266, H * 0.50, 36)]
    for cx, cy, rad in clusters:
        for _ in range(9):
            a = rng.uniform(0, math.tau)
            dist = rng.uniform(0, rad * 0.55)
            lx, ly = cx + math.cos(a) * dist, cy + math.sin(a) * dist
            lr = rng.uniform(13, 21)
            d.ellipse([lx - lr, ly - lr, lx + lr, ly + lr], fill=(*FOLIAGE_DK, 255), outline=INK, width=3)
        for _ in range(8):
            a = rng.uniform(0, math.tau)
            dist = rng.uniform(0, rad * 0.45)
            lx, ly = cx + math.cos(a) * dist - 2, cy + math.sin(a) * dist - 2
            lr = rng.uniform(10, 16)
            col = FOLIAGE_MID if rng.random() > 0.35 else FOLIAGE_HI
            d.ellipse([lx - lr, ly - lr, lx + lr, ly + lr], fill=(*col, 255), outline=INK_MID, width=2)
    # Warm muted blossoms (coral, golden marigold, lavender)
    for bx, by, bc in [
        (78, H * 0.42, BLOSSOM_CORAL), (96, H * 0.60, BLOSSOM_GOLD),
        (138, H * 0.54, BLOSSOM_LAV), (156, H * 0.38, BLOSSOM_LAV),
        (202, H * 0.44, BLOSSOM_GOLD), (218, H * 0.60, BLOSSOM_CORAL),
        (264, H * 0.46, BLOSSOM_LAV), (274, H * 0.58, BLOSSOM_GOLD),
    ]:
        draw_disc(d, bx, by, 7, bc, ink_w=2)
    # Subtle moss lick along bottom stone lip
    d.ellipse([54, H - 36, 92, H - 22], fill=(*MOSS, 175))
    d.ellipse([W - 102, 22, W - 64, 34], fill=(*MOSS, 165))
    return finish_prop(im, w, h, seed=7162)


def gen_st_cast_iron_alley_steam_vent() -> Image.Image:
    """Riveted cast-iron municipal alley steam grate in weathered granite collar (replaces starter flat vent!)."""
    w, h = 144, 144
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Dressed weathered granite stone collar surround
    draw_beveled_rect(d, 22, 22, W - 22, H - 22, GRANITE, radius=10, ink_w=6, hi_amt=0.22, sh_amt=0.40)
    for p0, p1 in [((26, 26), (52, 52)), ((W - 26, 26), (W - 52, 52)), ((26, H - 26), (52, H - 52)), ((W - 26, H - 26), (W - 52, H - 52))]:
        d.line([p0, p1], fill=INK_MID, width=3)
    # Heavy bolted cast-iron outer frame
    draw_beveled_rect(d, 46, 46, W - 46, H - 46, IRON, radius=8, ink_w=5)
    # Deep pitch-black exhaust shaft interior
    draw_beveled_rect(d, 64, 64, W - 64, H - 64, (18, 20, 24), radius=4, ink_w=4)
    # Cast-iron louvered vent bars with rust patina flecks & central spine rib
    for by in range(74, H - 68, 22):
        draw_beveled_rect(d, 66, by, W - 66, by + 11, IRON, radius=2, ink_w=3)
        d.line([(72, by + 2), (W - 72, by + 2)], fill=STEEL, width=2)
    draw_beveled_rect(d, W // 2 - 7, 64, W // 2 + 7, H - 64, IRON_DK, radius=2, ink_w=3)
    # Corner rusted hex bolts
    for rx, ry in [(56, 56), (W - 56, 56), (56, H - 56), (W - 56, H - 56)]:
        draw_disc(d, rx, ry, 6, RUST, ink_w=2)
    # Subtle warm translucent steam mist drift curling diagonally across two corners (zero opaque white blob!)
    mist = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    md = ImageDraw.Draw(mist)
    md.ellipse([86, 68, 178, 152], fill=(214, 220, 224, 52))
    md.ellipse([136, 116, 228, 200], fill=(214, 220, 224, 44))
    im.alpha_composite(mist.filter(ImageFilter.GaussianBlur(14.0)))
    return finish_prop(im, w, h, seed=7171, shadow_alpha=68)


def gen_st_brass_porter_luggage_cart() -> Image.Image:
    """Slatted oak & brass hotel/station luggage trolley with strapped leather suitcases."""
    w, h = 208, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(7181)

    # Dark rubber caster bumpers peeking at corners
    for cx, cy in [(40, 32), (40, H - 32), (W - 74, 32), (W - 74, H - 32)]:
        draw_beveled_rect(d, cx - 14, cy - 10, cx + 14, cy + 10, IRON_DK, radius=5, ink_w=3)
    # Slatted oak & riveted iron flat platform bed
    draw_beveled_rect(d, 28, 30, W - 56, H - 30, WALNUT, radius=12, ink_w=6)
    draw_wood_planks_box(d, 40, 42, W - 68, H - 42, OAK, rng, horizontal=True, n_planks=4)
    # Curved tubular brass push-handle frame on right end
    draw_beveled_rect(d, W - 66, 36, W - 26, H - 36, BRASS, radius=14, ink_w=5)
    d.rounded_rectangle([W - 56, 48, W - 38, H - 48], radius=6, fill=(0, 0, 0, 0), outline=INK, width=4)
    # Strapped burgundy leather steamer suitcase + Prussian-blue valise with brass corner clasps!
    draw_beveled_rect(d, 54, 48, 212, H - 50, (124, 44, 46), radius=12, ink_w=5)
    for sx in [92, 174]:
        draw_beveled_rect(d, sx - 6, 48, sx + 6, H - 50, LEATHER_DK, radius=2, ink_w=3)
        draw_beveled_rect(d, sx - 8, H // 2 - 8, sx + 8, H // 2 + 8, BRASS_HI, radius=2, ink_w=2)
    draw_beveled_rect(d, 174, 68, W - 82, H - 56, PRUSSIAN, radius=10, ink_w=5)
    for sx in [218, 286]:
        draw_beveled_rect(d, sx - 5, 68, sx + 5, H - 56, LEATHER, radius=2, ink_w=3)
    draw_disc(d, 252, H // 2 + 6, 7, BRASS_HI, ink_w=2)
    return finish_prop(im, w, h, seed=7182)


def gen_st_sidewalk_cellar_hatch_flush() -> Image.Image:
    """Stone-framed flush sidewalk iron-rimmed double cellar flap doors (sits cleanly on sidewalks!)."""
    w, h = 176, 144
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(7191)

    # Dressed granite stone threshold collar frame
    draw_beveled_rect(d, 18, 20, W - 18, H - 20, CURB_STONE, radius=8, ink_w=6, hi_amt=0.22, sh_amt=0.38)
    # Recessed dark iron frame
    draw_beveled_rect(d, 38, 38, W - 38, H - 38, IRON_DK, radius=5, ink_w=5)
    # Twin vertical iron-bound weathered oak/steel cellar door leaves meeting at center seam
    mid = W // 2
    for lx0, lx1 in [(46, mid - 4), (mid + 4, W - 46)]:
        draw_beveled_rect(d, lx0, 46, lx1, H - 46, IRON, radius=4, ink_w=4)
        draw_wood_planks_box(d, lx0 + 8, 54, lx1 - 8, H - 54, (98, 80, 62), rng, horizontal=False, n_planks=3)
        # Riveted iron cross-straps
        for sy in [76, H - 96]:
            draw_beveled_rect(d, lx0 + 4, sy, lx1 - 4, sy + 16, IRON, radius=3, ink_w=3)
    # Center iron meeting astragal bar + sunken iron pull-rings + brass padlock
    draw_beveled_rect(d, mid - 5, 44, mid + 5, H - 44, IRON_DK, radius=2, ink_w=3)
    draw_disc(d, mid - 26, H // 2, 11, STEEL, ink_w=3)
    draw_disc(d, mid + 26, H // 2, 11, STEEL, ink_w=3)
    draw_beveled_rect(d, mid - 11, H - 82, mid + 11, H - 56, BRASS, radius=5, ink_w=3)
    return finish_prop(im, w, h, seed=7192, shadow_alpha=64)


def gen_st_iron_bollard_chain_pair() -> Image.Image:
    """Paired fluted cast-iron municipal curb bollards linked by a draped iron chain."""
    w, h = 224, 80
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cy = H / 2.0

    # Draped catenary iron chain links sagging gently between left & right bollards
    x_l, x_r = 56.0, W - 56.0
    n_links = 13
    for i in range(n_links):
        t = (i + 0.5) / n_links
        lx = x_l + (x_r - x_l) * t
        sag = math.sin(t * math.pi) * 24.0
        ly = cy + sag
        rx = 16 if i % 2 == 0 else 10
        ry = 9 if i % 2 == 0 else 13
        d.ellipse([lx - rx, ly - ry, lx + rx, ly + ry], outline=INK, width=9)
        d.ellipse([lx - rx, ly - ry, lx + rx, ly + ry], outline=IRON, width=5)
        d.arc([lx - rx + 2, ly - ry + 2, lx + rx - 2, ly + ry - 2], 195, 320, fill=STEEL, width=2)

    # Twin fluted dark cast-iron curb bollards with weathered brass finial domes
    for bx in (x_l, x_r):
        draw_disc(d, bx, cy, 34, CURB_STONE, ink_w=5)
        draw_disc(d, bx, cy, 26, IRON_DK, ink_w=5)
        draw_disc(d, bx, cy, 19, IRON, ink_w=3)
        draw_disc(d, bx, cy, 9, BRASS, ink_w=3)
    return finish_prop(im, w, h, seed=7201)


def gen_st_alley_wall_lantern_bracket() -> Image.Image:
    """Compact wrought-iron wall-mounted alley gas lantern bracket (hugs narrow alley walls cleanly!)."""
    w, h = 112, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cy = H / 2.0

    # Iron wall mounting backplate on left edge + scrolled bracket arm reaching right
    draw_beveled_rect(d, 22, cy - 38, 44, cy + 38, IRON_DK, radius=6, ink_w=5)
    for ry in (cy - 24, cy + 24):
        draw_disc(d, 33, ry, 5, STEEL, ink_w=2)
    draw_beveled_rect(d, 38, cy - 9, 124, cy + 9, IRON, radius=4, ink_w=4)
    # Warm soft amber halo behind lantern glass cage
    gl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gd.ellipse([90, cy - 58, 206, cy + 58], fill=(*AMBER_GLOW, 115))
    im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(14.0)))
    d = ImageDraw.Draw(im, "RGBA")
    # Hexagonal wrought-iron gas lantern hood with warm glowing glass panes & brass cap!
    lx = 148.0
    draw_disc(d, lx, cy, 42, IRON_DK, ink_w=5)
    draw_disc(d, lx, cy, 32, AMBER_GLOW, ink_w=3)
    draw_disc(d, lx, cy, 18, (255, 240, 190), ink_w=2)
    # 6 radial iron lantern hood ribs
    for k in range(6):
        a = k * math.tau / 6.0
        d.line([(lx, cy), (lx + math.cos(a) * 40, cy + math.sin(a) * 40)], fill=IRON_DK, width=5)
    draw_disc(d, lx, cy, 12, IRON, ink_w=3)
    draw_disc(d, lx, cy, 6, BRASS_HI, ink_w=2)
    return finish_prop(im, w, h, seed=7211, shadow_alpha=74)


def main() -> None:
    specs = [
        # (subdir_path, filename, displayName, category, tags, generator_fn)
        ("terrain/city_streets", "terr_berlin_aged_granite_setts.png", "Aged Berlin Granite-Sett Street Paving", "terrain",
         ["city_streets", "street", "cobble", "granite", "road", "paving", "berlin", "harmony"], gen_terr_berlin_aged_granite_setts),
        ("terrain/city_streets", "terr_alley_damp_basalt_cobbles.png", "Damp Mossy Basalt Alley Cobblestones", "terrain",
         ["city_streets", "alley", "cobble", "basalt", "road", "moss", "harmony"], gen_terr_alley_damp_basalt_cobbles),
        ("paths/city_streets", "path_avenue_carriage_tracks.png", "Aged Granite Avenue Carriage Wheel-Ruts", "path",
         ["city_streets", "street", "avenue", "road", "cobble", "tracks", "harmony"], gen_path_avenue_carriage_tracks),
        ("paths/city_streets", "path_alley_central_drain_gutter.png", "Weathered Alley Stone Drainage Runnel", "path",
         ["city_streets", "alley", "gutter", "drain", "cobble", "road", "harmony"], gen_path_alley_central_drain_gutter),
        ("paths/city_streets", "path_granite_curb_gutter_edge.png", "Dressed Granite Curbstone & Gutter Channel", "path",
         ["city_streets", "curb", "gutter", "granite", "road", "sidewalk", "harmony"], gen_path_granite_curb_gutter_edge),
        ("props/city_streets", "st_berlin_litfass_column.png", "Verdigris-Domed Berlin Litfaßsäule Pillar", "object",
         ["city_streets", "street", "kiosk", "pillar", "berlin", "sidewalk", "harmony"], gen_st_berlin_litfass_column),
        ("props/city_streets", "st_stone_boulevard_planter.png", "Carved Limestone Boulevard Shrub Planter", "object",
         ["city_streets", "street", "planter", "shrub", "sidewalk", "flora", "harmony"], gen_st_stone_boulevard_planter),
        ("props/city_streets", "st_cast_iron_alley_steam_vent.png", "Riveted Cast-Iron Alley Steam Exhaust Grate", "object",
         ["city_streets", "alley", "vent", "steam", "grate", "utility", "harmony"], gen_st_cast_iron_alley_steam_vent),
        ("props/city_streets", "st_brass_porter_luggage_cart.png", "Slatted Oak & Brass Station Luggage Trolley", "object",
         ["city_streets", "street", "cart", "luggage", "station", "harmony"], gen_st_brass_porter_luggage_cart),
        ("props/city_streets", "st_sidewalk_cellar_hatch_flush.png", "Stone-Framed Flush Sidewalk Cellar Hatch", "object",
         ["city_streets", "street", "cellar", "hatch", "sidewalk", "doors", "harmony"], gen_st_sidewalk_cellar_hatch_flush),
        ("props/city_streets", "st_iron_bollard_chain_pair.png", "Fluted Cast-Iron Curb Bollards & Chain", "object",
         ["city_streets", "street", "bollard", "chain", "curb", "iron", "harmony"], gen_st_iron_bollard_chain_pair),
        ("props/city_streets", "st_alley_wall_lantern_bracket.png", "Wrought-Iron Wall-Mounted Alley Gas Lantern", "object",
         ["city_streets", "alley", "lamp", "lantern", "lighting", "streetlamp", "harmony"], gen_st_alley_wall_lantern_bracket),
    ]

    qa_items: list[tuple[str, Image.Image]] = []
    manifest_entries: list[dict] = []

    for idx, (subdir, fname, display_name, category, tags, fn) in enumerate(specs, 1):
        im = fn()
        rel_path = f"{subdir}/{fname}"
        out_path = MOD_DIR / rel_path
        out_path.parent.mkdir(parents=True, exist_ok=True)
        im.save(out_path, "PNG")
        qa_items.append((fname.replace(".png", ""), im))

        w_px, h_px = im.size
        manifest_entries.append({
            "path": rel_path,
            "displayName": display_name,
            "category": category,
            "widthPx": w_px,
            "heightPx": h_px,
            "defaultPpi": 256 if category in ("terrain", "path") else 140,
            "drawMode": "normal",
            "dominantHex": dominant_hex(im),
            "castsShadow": category == "object" and "hatch" not in fname and "vent" not in fname,
            "tags": tags,
        })
        print(f"  [{idx:02d}/{len(specs)}] {rel_path} ({w_px}x{h_px}, {category})")

    total = upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    qa_path = SCRATCH_DIR / "qa_city_streets_suite.png"
    save_qa_sheet(qa_items, qa_path, cols=4)
    print(f"\nGenerated {len(specs)} Aged City Streets Harmony assets (manifest total={total}) -> {qa_path}")


if __name__ == "__main__":
    main()

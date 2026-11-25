"""
Clean-room CC0 hand-inked top-down painterly asset generator for:
  1. Decades-old candle-covered Cathedral vigil stairs (layered melted wax crusts,
     memorial candles in every stage of burn, glass vigil jars, roses, prayer slips)
  2. Berlin dark-magipunk roads, tram boulevard, crosswalks, tram stop & streetcar
  3. Narrow alleys & working-class Hinterhof backyards (laundry lines, coal shed,
     galvanized bin clusters, bicycles, cellar doors, postbox, fire hydrant, leaf drifts)

Rendered at 2x supersampling with warm gouache grain, deep charcoal ink outlines,
soft ground contact shading, and 100% clean alpha edges (zero white halos).
"""

import json
import math
import os
import random
import zipfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

MODULAR_DIR = Path("public/assets/modular-suite-cc0")
OUT_DIR = str(MODULAR_DIR / "props" / "district_streets")
MANIFEST_PATH = str(MODULAR_DIR / "manifest.json")
DCPACK_PATH = Path("public/assets/DiceChaos_Modular_Suite_CC0.dcpack")
QA_PATH = r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch\district_streets_qa.png"

INK = (34, 28, 26, 255)
INK_SOFT = (54, 44, 38, 220)
SHADOW = (24, 18, 16, 95)


def new_hi(w: int, h: int):
    return Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))


def add_grain(img: Image.Image, strength: float = 7.5, seed: int = 11) -> Image.Image:
    arr = np.array(img, dtype=np.float32)
    alpha = arr[:, :, 3]
    mask = alpha > 24
    rng = np.random.default_rng(seed)
    noise = rng.normal(0.0, strength, size=arr[:, :, 0].shape)
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] + noise * mask, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def finish(hi: Image.Image, w: int, h: int, seed: int = 11, grain: float = 6.5) -> Image.Image:
    out = hi.resize((w, h), Image.Resampling.LANCZOS)
    if grain > 0:
        out = add_grain(out, strength=grain, seed=seed)
    return out


def blob_pts(cx, cy, rx, ry, n=48, amp=0.14, seed=1, rot=0.0):
    rng = random.Random(seed)
    p1 = rng.uniform(0, 6.28)
    p2 = rng.uniform(0, 6.28)
    p3 = rng.uniform(0, 6.28)
    pts = []
    cr, sr = math.cos(rot), math.sin(rot)
    for i in range(n):
        a = (i / n) * math.tau
        r = 1.0 + amp * (0.58 * math.sin(a * 3 + p1) + 0.28 * math.cos(a * 5 + p2) + 0.14 * math.sin(a * 8 + p3))
        lx = math.cos(a) * rx * r
        ly = math.sin(a) * ry * r
        pts.append((cx + lx * cr - ly * sr, cy + lx * sr + ly * cr))
    return pts


def draw_soft_shadow_poly(img: Image.Image, pts, offset=(7, 9), color=(22, 16, 14, 90), blur=8):
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.polygon([(x + offset[0], y + offset[1]) for x, y in pts], fill=color)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(sh)


def draw_soft_shadow_ellipse(img: Image.Image, box, offset=(6, 8), color=(22, 16, 14, 88), blur=7):
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(sh)
    d.ellipse([box[0] + offset[0], box[1] + offset[1], box[2] + offset[0], box[3] + offset[1]], fill=color)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(sh)


def draw_wax_candle(
    base: Image.Image,
    glow_layer: Image.Image,
    cx: float,
    cy: float,
    radius: float,
    wax_col=(244, 232, 204),
    lit: bool = True,
    glass_jar: tuple | None = None,
    seed: int = 1,
):
    """Draw a top-down vigil candle (stub, fresh beeswax pillar, or glass memorial jar) + flame glow."""
    rng = random.Random(seed)
    d = ImageDraw.Draw(base)
    # Melted wax collar puddle around base
    collar = blob_pts(cx, cy, radius * 1.48, radius * 1.38, n=14, amp=0.18, seed=seed + 3)
    c_dark = (max(0, wax_col[0] - 28), max(0, wax_col[1] - 32), max(0, wax_col[2] - 34), 215)
    d.polygon(collar, fill=c_dark, outline=(95, 76, 56, 150))

    if glass_jar is not None:
        # Colored glass memorial jar rim
        jr = radius * 1.18
        d.ellipse([cx - jr, cy - jr, cx + jr, cy + jr], fill=(*glass_jar, 190), outline=INK, width=3)
        # Inner melted wax pool
        ir = radius * 0.86
        d.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=(*wax_col, 245))
        # Glass specular glint
        d.arc([cx - jr + 3, cy - jr + 3, cx + jr - 3, cy + jr - 3], 200, 265, fill=(255, 250, 240, 175), width=3)
    else:
        # Candle body with slight top-down height offset
        d.ellipse([cx - radius + 2, cy - radius + 3, cx + radius + 2, cy + radius + 3], fill=(55, 42, 32, 130))
        d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(*wax_col, 255), outline=INK, width=3)
        # Concave melted wax cup top
        ir = radius * 0.72
        cup = (min(255, wax_col[0] + 10), min(255, wax_col[1] + 6), max(0, wax_col[2] - 8), 255)
        d.ellipse([cx - ir, cy - ir, cx + ir, cy + ir], fill=cup, outline=(155, 132, 102, 180), width=2)

    # Charred wick
    wx = cx + rng.uniform(-1.5, 1.5)
    wy = cy + rng.uniform(-1.5, 1.5)
    if lit:
        # Warm golden flame halo on separate glow layer
        gd = ImageDraw.Draw(glow_layer)
        hr = radius * rng.uniform(2.6, 3.6)
        gd.ellipse([wx - hr, wy - hr, wx + hr, wy + hr], fill=(255, 165, 45, 72))
        hr2 = radius * 1.45
        gd.ellipse([wx - hr2, wy - hr2, wx + hr2, wy + hr2], fill=(255, 220, 105, 125))
        # Flame teardrop core
        fr = max(4.2, radius * 0.42)
        d.ellipse([wx - fr, wy - fr, wx + fr, wy + fr], fill=(255, 175, 48, 255))
        d.ellipse([wx - fr * 0.58, wy - fr * 0.58, wx + fr * 0.58, wy + fr * 0.58], fill=(255, 248, 205, 255))
    else:
        # Burned-out soot stub
        d.ellipse([wx - 3.5, wy - 3.5, wx + 3.5, wy + 3.5], fill=(38, 30, 28, 240))
        d.ellipse([wx - 6, wy - 6, wx + 6, wy + 6], fill=(55, 45, 40, 70))


def draw_flower_blossom(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float, col, stem_ang=0.0):
    # Thin stem + leaf
    sx = cx - math.cos(stem_ang) * r * 2.2
    sy = cy - math.sin(stem_ang) * r * 2.2
    draw.line([(sx, sy), (cx, cy)], fill=(58, 86, 46, 235), width=4)
    lx = (cx + sx) * 0.5 + math.sin(stem_ang) * r * 0.7
    ly = (cy + sy) * 0.5 - math.cos(stem_ang) * r * 0.7
    draw.ellipse([lx - r * 0.6, ly - r * 0.35, lx + r * 0.6, ly + r * 0.35], fill=(74, 108, 56, 230), outline=INK_SOFT, width=2)
    # Petals
    for k in range(5):
        a = k * (math.tau / 5) + stem_ang
        px = cx + math.cos(a) * r * 0.52
        py = cy + math.sin(a) * r * 0.52
        draw.ellipse([px - r * 0.52, py - r * 0.52, px + r * 0.52, py + r * 0.52], fill=(*col, 245), outline=INK_SOFT, width=2)
    draw.ellipse([cx - r * 0.32, cy - r * 0.32, cx + r * 0.32, cy + r * 0.32], fill=(235, 198, 88, 255))


# =============================================================================
# 1. VIGIL CANDLE WAX DRIFT (Decades of melted wax & vigil candles for stair flanks)
# =============================================================================
def gen_vigil_candle_wax_drift():
    w, h = 440, 210
    hi = new_hi(w, h)
    glow = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    # Dark soot & ancient yellowed-brown oldest wax base layer
    base_pts = blob_pts(440, 215, 395, 142, n=36, amp=0.16, seed=101)
    draw_soft_shadow_poly(hi, base_pts, offset=(5, 8), color=(18, 12, 10, 95), blur=10)
    # Soot stain peeking out beneath old wax
    for sx, sy, sr in [(160, 175, 48), (340, 250, 56), (560, 180, 52), (710, 235, 44)]:
        d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(38, 30, 26, 85))
    d.polygon(base_pts, fill=(176, 148, 106, 232), outline=(92, 72, 48, 195))

    # Second multi-year crust (aged ochre & amber wax lobes)
    for cx, cy, rx, ry, sd in [
        (175, 205, 130, 92, 11),
        (355, 222, 155, 102, 12),
        (545, 200, 145, 98, 13),
        (715, 218, 115, 86, 14),
    ]:
        pts = blob_pts(cx, cy, rx, ry, n=22, amp=0.17, seed=sd)
        d.polygon(pts, fill=(214, 192, 150, 238), outline=(125, 102, 70, 185))

    # Fresh creamy ivory & rose-tinted recent wax cascades dripping over older crusts
    for cx, cy, rx, ry, col, sd in [
        (135, 210, 62, 48, (238, 226, 198), 21),
        (255, 190, 74, 52, (242, 230, 206), 22),
        (395, 230, 82, 56, (236, 216, 196), 23),
        (515, 195, 76, 52, (244, 234, 210), 24),
        (645, 225, 70, 50, (238, 224, 196), 25),
        (745, 202, 55, 42, (242, 232, 208), 26),
    ]:
        pts = blob_pts(cx, cy, rx, ry, n=18, amp=0.20, seed=sd)
        d.polygon(pts, fill=(*col, 240), outline=(158, 136, 106, 175))

    # Wilted & fresh remembrance offerings tucked among wax
    draw_flower_blossom(d, 218, 255, 14, (162, 52, 58), stem_ang=0.5)
    draw_flower_blossom(d, 468, 152, 13, (218, 156, 48), stem_ang=-0.7)
    draw_flower_blossom(d, 612, 268, 14, (186, 46, 58), stem_ang=2.3)
    draw_flower_blossom(d, 310, 148, 12, (236, 228, 212), stem_ang=-1.1)
    # Tiny weathered parchment prayer slips weighed down by pebbles
    for px, py, ang in [(280, 262, 0.25), (578, 146, -0.35), (700, 265, 0.18)]:
        ca, sa = math.cos(ang), math.sin(ang)
        corners = [(-18, -11), (18, -11), (18, 11), (-18, 11)]
        poly = [(px + x * ca - y * sa, py + x * sa + y * ca) for x, y in corners]
        d.polygon(poly, fill=(228, 212, 176, 245), outline=INK_SOFT)
        d.line([poly[0], poly[1]], fill=(140, 118, 88, 150), width=2)
        d.ellipse([px - 5, py - 4, px + 5, py + 4], fill=(116, 112, 104, 255), outline=INK_SOFT, width=2)

    # 28 Vigil candles in every stage: tall fresh tapers, burnt stubs, colored glass memorial jars!
    candles = [
        (108, 204, 15, (242, 228, 196), True, None),
        (142, 176, 13, (226, 204, 162), False, None),
        (164, 224, 18, (248, 236, 206), True, (182, 46, 54)),
        (195, 192, 12, (240, 226, 192), True, None),
        (225, 165, 14, (234, 212, 174), False, None),
        (248, 216, 16, (246, 236, 210), True, None),
        (282, 188, 19, (248, 238, 212), True, (198, 134, 42)),
        (316, 232, 13, (230, 208, 168), False, None),
        (344, 178, 15, (245, 232, 198), True, None),
        (372, 212, 18, (246, 234, 205), True, (172, 42, 52)),
        (405, 184, 14, (242, 230, 200), True, None),
        (418, 244, 12, (224, 200, 162), False, None),
        (445, 210, 17, (248, 238, 214), True, None),
        (478, 236, 15, (244, 230, 198), True, (58, 112, 156)),
        (502, 188, 16, (246, 234, 202), True, None),
        (534, 224, 19, (248, 236, 208), True, (186, 52, 56)),
        (562, 196, 13, (228, 206, 168), False, None),
        (588, 238, 15, (246, 234, 204), True, None),
        (618, 184, 16, (244, 230, 198), True, (202, 142, 44)),
        (648, 214, 14, (242, 228, 196), True, None),
        (676, 178, 12, (222, 198, 158), False, None),
        (686, 234, 17, (248, 238, 212), True, (176, 48, 56)),
        (722, 196, 15, (245, 232, 202), True, None),
        (752, 218, 13, (240, 224, 190), True, None),
        (776, 188, 11, (226, 204, 164), False, None),
    ]
    for i, (cx, cy, rad, wc, lit, jar) in enumerate(candles):
        draw_wax_candle(hi, glow, cx, cy, rad, wax_col=wc, lit=lit, glass_jar=jar, seed=300 + i)

    glow = glow.filter(ImageFilter.GaussianBlur(14))
    hi.alpha_composite(glow)
    return finish(hi, w, h, seed=101, grain=5.5)


# =============================================================================
# 2. VIGIL CANDLE NICHE SHRINE (Overflowing stair-corner / central alcove mound)
# =============================================================================
def gen_vigil_candle_niche_shrine():
    w, h = 340, 320
    hi = new_hi(w, h)
    glow = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    # Thick centuries-old tiered wax stalagmite mound
    mound1 = blob_pts(340, 325, 275, 248, n=32, amp=0.14, seed=201)
    draw_soft_shadow_poly(hi, mound1, offset=(8, 10), color=(20, 14, 12, 105), blur=12)
    d.polygon(mound1, fill=(166, 138, 98, 242), outline=(88, 68, 46, 210))

    mound2 = blob_pts(335, 315, 220, 196, n=28, amp=0.16, seed=202)
    d.polygon(mound2, fill=(210, 186, 144, 245), outline=(118, 96, 66, 195))

    mound3 = blob_pts(342, 308, 156, 136, n=24, amp=0.17, seed=203)
    d.polygon(mound3, fill=(238, 224, 192, 248), outline=(146, 124, 92, 190))

    # Wrought-iron dark brass votive bowl / lantern ring nestled in the center
    d.ellipse([282, 250, 402, 370], fill=(74, 62, 54, 240), outline=INK, width=5)
    d.ellipse([296, 264, 388, 356], fill=(122, 102, 76, 235), outline=(48, 38, 32, 210), width=3)

    # Wilted & fresh memorial wreath arc + roses + prayer ribbons
    for ang, col in [
        (0.2, (176, 44, 52)), (0.65, (226, 166, 48)), (1.15, (236, 228, 212)),
        (2.1, (168, 46, 56)), (2.6, (218, 142, 46)), (3.4, (186, 48, 54)),
        (4.1, (238, 230, 216)), (4.85, (178, 52, 62)), (5.55, (224, 160, 50)),
    ]:
        fx = 340 + math.cos(ang) * 195
        fy = 320 + math.sin(ang) * 175
        draw_flower_blossom(d, fx, fy, 15, col, stem_ang=ang + 1.4)

    # Faded burgundy & cream remembrance ribbons + framed keepsake locket
    d.line([(162, 255), (218, 218), (242, 245)], fill=(154, 48, 58, 225), width=7)
    d.line([(455, 410), (508, 448), (528, 422)], fill=(214, 198, 164, 225), width=6)
    # Small brass-framed keepsake photo resting in wax
    d.rounded_rectangle([418, 218, 470, 260], radius=5, fill=(168, 134, 72, 255), outline=INK, width=3)
    d.rectangle([426, 226, 462, 252], fill=(216, 204, 184, 255))
    d.ellipse([437, 231, 451, 246], fill=(128, 114, 102, 220))

    # 30 Candles packed densely from inner brass bowl out to melted edges!
    pts_candles = [
        # Center altar bowl cluster (brightest!)
        (342, 310, 20, (250, 242, 218), True, None),
        (316, 294, 15, (246, 234, 206), True, None),
        (368, 296, 16, (248, 236, 210), True, None),
        (322, 334, 15, (246, 234, 204), True, None),
        (366, 332, 16, (248, 238, 212), True, None),
        # Middle tier (glass memorial jars + tapers)
        (252, 268, 19, (248, 238, 210), True, (186, 46, 54)),
        (285, 222, 16, (246, 232, 200), True, None),
        (344, 208, 19, (248, 238, 212), True, (206, 146, 44)),
        (400, 236, 15, (244, 230, 198), True, None),
        (434, 296, 19, (248, 238, 212), True, (176, 44, 52)),
        (424, 362, 17, (246, 234, 205), True, (62, 118, 162)),
        (372, 404, 16, (246, 234, 202), True, None),
        (304, 412, 19, (248, 238, 210), True, (188, 50, 56)),
        (246, 372, 16, (244, 230, 198), True, None),
        (232, 320, 15, (242, 226, 194), True, None),
        # Outer aged crusts (mix of lit tapers & burned-out stubs)
        (178, 308, 14, (232, 210, 172), True, None),
        (195, 368, 13, (222, 198, 160), False, None),
        (238, 434, 15, (244, 230, 198), True, None),
        (292, 468, 13, (226, 202, 164), False, None),
        (360, 466, 16, (246, 234, 206), True, (198, 138, 42)),
        (434, 442, 14, (240, 224, 192), True, None),
        (486, 386, 15, (244, 230, 198), True, None),
        (506, 316, 13, (224, 200, 162), False, None),
        (488, 248, 15, (244, 232, 200), True, (178, 46, 54)),
        (438, 184, 13, (226, 204, 166), False, None),
        (364, 158, 15, (246, 234, 204), True, None),
        (274, 168, 14, (242, 228, 196), True, None),
        (206, 226, 14, (230, 208, 170), False, None),
    ]
    for i, (cx, cy, rad, wc, lit, jar) in enumerate(pts_candles):
        draw_wax_candle(hi, glow, cx, cy, rad, wax_col=wc, lit=lit, glass_jar=jar, seed=400 + i)

    glow = glow.filter(ImageFilter.GaussianBlur(16))
    hi.alpha_composite(glow)
    return finish(hi, w, h, seed=201, grain=5.5)


# =============================================================================
# 3. VIGIL WAX PUDDLE & STUBS (Flat ancient wax drips & scattered petals for steps)
# =============================================================================
def gen_vigil_wax_puddle_stubs():
    w, h = 280, 240
    hi = new_hi(w, h)
    glow = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    # Organic scattered melted wax splatters across worn stone treads (fluid smooth edges!)
    splatters = [
        (165, 165, 96, 68, (186, 162, 122, 185), 31),
        (355, 225, 118, 84, (216, 196, 158, 198), 32),
        (255, 330, 92, 64, (200, 178, 140, 185), 33),
        (420, 135, 68, 48, (234, 220, 188, 195), 34),
        (145, 305, 58, 44, (226, 208, 176, 180), 35),
    ]
    for cx, cy, rx, ry, col, sd in splatters:
        pts = blob_pts(cx, cy, rx, ry, n=52, amp=0.17, seed=sd)
        d.polygon(pts, fill=col, outline=(128, 108, 78, 120))
    # Tiny spilled wax droplets & aged soot smudges
    rng_d = random.Random(36)
    for _ in range(24):
        dx = rng_d.uniform(75, 485)
        dy = rng_d.uniform(75, 405)
        dr = rng_d.uniform(5, 14)
        col_d = rng_d.choice([(224, 206, 172, 185), (196, 174, 136, 175), (242, 232, 206, 195)])
        d.ellipse([dx - dr, dy - dr * 0.85, dx + dr, dy + dr * 0.85], fill=col_d, outline=(138, 118, 86, 110))

    # Fallen rose petals & blackened old wick smudges
    rng = random.Random(39)
    for _ in range(18):
        px = rng.uniform(90, 470)
        py = rng.uniform(85, 395)
        col = rng.choice([(174, 48, 56, 220), (218, 154, 52, 210), (235, 224, 204, 200)])
        d.ellipse([px - 7, py - 5, px + 7, py + 5], fill=col)

    # Small cluster of tiny half-melted stubs & 4 freshly lit votives
    for i, (cx, cy, rad, lit, jar) in enumerate([
        (162, 162, 12, False, None),
        (194, 186, 14, True, None),
        (338, 215, 16, True, (184, 50, 56)),
        (372, 242, 13, True, None),
        (312, 250, 11, False, None),
        (252, 326, 14, True, None),
        (418, 138, 12, False, None),
    ]):
        draw_wax_candle(hi, glow, cx, cy, rad, wax_col=(242, 228, 198), lit=lit, glass_jar=jar, seed=500 + i)

    glow = glow.filter(ImageFilter.GaussianBlur(12))
    hi.alpha_composite(glow)
    return finish(hi, w, h, seed=301, grain=5.0)


# =============================================================================
# 4. STREET FLOWER & CANDLE SELLER'S CART (Mourners' Beeswax & Rose Cart)
# =============================================================================
def gen_str_flower_candle_cart():
    w, h = 380, 260
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    # Ground shadow
    draw_soft_shadow_poly(hi, [(125, 115), (615, 115), (615, 410), (125, 410)], offset=(10, 14), blur=12)

    # Wooden cart handles sticking out left
    d.rounded_rectangle([38, 182, 155, 206], radius=6, fill=(122, 86, 56, 255), outline=INK, width=4)
    d.rounded_rectangle([38, 314, 155, 338], radius=6, fill=(122, 86, 56, 255), outline=INK, width=4)
    # Iron-rimmed spoked wheels peeking top & bottom
    for wy in (92, 418):
        d.rounded_rectangle([285, wy - 14, 475, wy + 14], radius=10, fill=(76, 62, 54, 255), outline=INK, width=4)
        d.line([(320, wy), (440, wy)], fill=(142, 108, 76, 255), width=6)

    # Cart weathered timber bed
    d.rounded_rectangle([136, 108, 628, 412], radius=12, fill=(138, 98, 64, 255), outline=INK, width=5)
    for y in range(138, 405, 34):
        d.line([(144, y), (620, y)], fill=(96, 66, 42, 190), width=3)

    # Left half: Wooden crate trays packed with bundled ivory beeswax tapers & glass vigil jars!
    d.rounded_rectangle([162, 134, 378, 254], radius=8, fill=(116, 82, 52, 255), outline=INK, width=4)
    for cx in range(182, 365, 26):
        d.rounded_rectangle([cx, 146, cx + 18, 242], radius=4, fill=(242, 230, 198, 255), outline=(146, 124, 88, 210), width=2)
    # Twine bundle strap
    d.line([(168, 194), (372, 194)], fill=(144, 62, 54, 255), width=7)

    # Lower-left tray: Red & amber glass memorial jars + brass coin box
    d.rounded_rectangle([162, 274, 378, 388], radius=8, fill=(108, 76, 48, 255), outline=INK, width=4)
    for jx, jy, jcol in [
        (194, 306, (186, 48, 54)), (234, 306, (206, 144, 44)), (274, 306, (186, 48, 54)),
        (194, 352, (62, 118, 158)), (234, 352, (186, 48, 54)), (274, 352, (206, 144, 44)),
    ]:
        d.ellipse([jx - 16, jy - 16, jx + 16, jy + 16], fill=(*jcol, 245), outline=INK, width=3)
        d.ellipse([jx - 9, jy - 9, jx + 9, jy + 9], fill=(246, 236, 210, 255))
    # Brass coin lockbox
    d.rounded_rectangle([308, 294, 366, 368], radius=6, fill=(172, 136, 68, 255), outline=INK, width=3)
    d.line([(337, 296), (337, 366)], fill=(108, 82, 38, 200), width=3)

    # Right half: Galvanized flower buckets overflowing with crimson roses, white lilies & marigolds!
    buckets = [
        (448, 194, 52, [(186, 42, 52), (208, 58, 66), (156, 32, 42)]),
        (556, 196, 48, [(240, 232, 216), (228, 218, 198), (248, 244, 232)]),
        (448, 324, 50, [(228, 158, 44), (242, 184, 62), (204, 126, 34)]),
        (556, 324, 48, [(154, 96, 168), (186, 52, 64), (236, 224, 204)]),
    ]
    rng = random.Random(404)
    for bx, by, br, cols in buckets:
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=(122, 130, 134, 255), outline=INK, width=4)
        d.ellipse([bx - br + 8, by - br + 8, bx + br - 8, by + br - 8], fill=(64, 92, 50, 255))
        for _ in range(9):
            a = rng.uniform(0, math.tau)
            dist = rng.uniform(4, br * 0.62)
            draw_flower_blossom(d, bx + math.cos(a) * dist, by + math.sin(a) * dist, 11, rng.choice(cols), stem_ang=a)

    # Rolled faded burgundy-and-cream canvas canopy edge along top rim
    d.rounded_rectangle([142, 100, 622, 132], radius=10, fill=(156, 62, 58, 255), outline=INK, width=4)
    for sx in range(165, 610, 48):
        d.rectangle([sx, 103, sx + 22, 129], fill=(232, 220, 196, 230))

    return finish(hi, w, h, seed=401, grain=6.0)


# =============================================================================
# 5. BERLIN TRAM STOP (Cast-iron canopy, bench, glowing schedule & litter box)
# =============================================================================
def gen_str_berlin_tram_stop():
    w, h = 420, 220
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    # Stone curb slab footprint
    draw_soft_shadow_poly(hi, [(42, 54), (798, 54), (798, 390), (42, 390)], offset=(8, 12), blur=10)
    d.rounded_rectangle([42, 54, 798, 390], radius=14, fill=(134, 136, 138, 240), outline=INK_SOFT, width=4)
    # Stone pavers seams
    for x in range(120, 790, 92):
        d.line([(x, 58), (x, 386)], fill=(96, 98, 102, 150), width=3)

    # Slatted wooden waiting bench under the shelter
    d.rounded_rectangle([180, 138, 570, 254], radius=10, fill=(116, 78, 50, 255), outline=INK, width=4)
    for y in (166, 194, 222):
        d.line([(186, y), (564, y)], fill=(72, 48, 32, 200), width=4)
    for ix in (210, 375, 540):
        d.rectangle([ix - 8, 134, ix + 8, 258], fill=(56, 64, 62, 255), outline=INK, width=3)

    # Translucent verdigris-iron & ribbed-glass rain canopy roof overhanging bench
    canopy = Image.new("RGBA", hi.size, (0, 0, 0, 0))
    cd = ImageDraw.Draw(canopy)
    cd.rounded_rectangle([140, 78, 620, 298], radius=14, fill=(76, 118, 108, 155), outline=(44, 62, 58, 245), width=6)
    for x in range(180, 610, 56):
        cd.line([(x, 82), (x, 294)], fill=(54, 82, 76, 210), width=5)
    cd.line([(146, 188), (614, 188)], fill=(48, 72, 66, 230), width=8)
    # Specular rain sheen
    cd.polygon([(170, 96), (340, 96), (260, 276), (170, 276)], fill=(215, 240, 236, 48))
    hi.alpha_composite(canopy)

    # Cast-iron Berlin "H" Tram Haltestelle post & glowing yellow timetable box (right side)
    d.ellipse([664, 154, 744, 234], fill=(58, 72, 66, 255), outline=INK, width=4)
    d.ellipse([678, 168, 730, 220], fill=(238, 196, 68, 255), outline=(44, 88, 62, 255), width=6)
    # Bold "H" glyph
    d.line([(694, 180), (694, 208)], fill=(38, 78, 54, 255), width=6)
    d.line([(714, 180), (714, 208)], fill=(38, 78, 54, 255), width=6)
    d.line([(694, 194), (714, 194)], fill=(38, 78, 54, 255), width=6)

    # Cast-iron litter bin (left side)
    d.ellipse([76, 168, 134, 226], fill=(64, 72, 70, 255), outline=INK, width=4)
    d.ellipse([86, 178, 124, 216], fill=(42, 46, 44, 255))

    return finish(hi, w, h, seed=501, grain=6.0)


# =============================================================================
# 6. COBBLE CROSSWALK STRIPES (Weathered pale limestone crossing strips, flat)
# =============================================================================
def gen_str_cobble_crosswalk():
    w, h = 420, 170
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)
    rng = random.Random(601)

    for i in range(6):
        x0 = 42 + i * 130
        x1 = x0 + 82
        y0 = 42 + rng.randint(-4, 4)
        y1 = 298 + rng.randint(-4, 4)
        # Worn limestone stripe composed of 5 hand-laid cobble blocks
        for b in range(5):
            by0 = y0 + b * ((y1 - y0) / 5) + 3
            by1 = y0 + (b + 1) * ((y1 - y0) / 5) - 3
            v = rng.randint(-12, 12)
            col = (206 + v, 200 + v, 186 + v, 188)
            d.rounded_rectangle([x0, by0, x1, by1], radius=6, fill=col, outline=(84, 78, 72, 135), width=3)
            # Subtle tire/boot scuff
            d.line([(x0 + 8, (by0 + by1) / 2), (x1 - 8, (by0 + by1) / 2 + rng.randint(-5, 5))],
                   fill=(128, 120, 110, 75), width=3)

    return finish(hi, w, h, seed=601, grain=7.5)


# =============================================================================
# 7. VINTAGE COMMUTER BICYCLE (Top-down working-class iron bike + wicker basket)
# =============================================================================
def gen_str_vintage_bicycle():
    w, h = 240, 150
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    draw_soft_shadow_poly(hi, [(70, 125), (410, 125), (410, 185), (70, 185)], offset=(7, 10), blur=8)
    # Rear & front slender iron tires
    d.rounded_rectangle([58, 136, 202, 166], radius=12, fill=(44, 46, 50, 255), outline=INK, width=4)
    d.rounded_rectangle([282, 136, 424, 166], radius=12, fill=(44, 46, 50, 255), outline=INK, width=4)
    # Fenders
    d.rounded_rectangle([72, 141, 188, 161], radius=8, fill=(58, 78, 92, 255), outline=INK, width=3)
    d.rounded_rectangle([294, 141, 408, 161], radius=8, fill=(58, 78, 92, 255), outline=INK, width=3)
    # Main steel frame bar + chain guard
    d.line([(135, 151), (345, 151)], fill=(48, 66, 78, 255), width=12)
    d.line([(135, 151), (345, 151)], fill=(96, 122, 138, 180), width=4)
    # Pedals sticking out slightly
    d.rounded_rectangle([226, 104, 254, 128], radius=5, fill=(64, 62, 60, 255), outline=INK, width=3)
    d.rounded_rectangle([226, 174, 254, 198], radius=5, fill=(64, 62, 60, 255), outline=INK, width=3)
    # Rear luggage rack
    d.rounded_rectangle([74, 118, 166, 184], radius=6, fill=None, outline=(52, 54, 58, 255), width=5)
    for rx in (98, 122, 146):
        d.line([(rx, 120), (rx, 182)], fill=(52, 54, 58, 255), width=4)
    # Brown worn leather saddle
    d.polygon([(176, 128), (222, 138), (222, 164), (176, 174), (164, 151)], fill=(128, 78, 48, 255), outline=INK)
    # Swept chrome handlebars + rubber grips
    d.line([(338, 72), (354, 151), (338, 230)], fill=(176, 182, 186, 255), width=10)
    d.line([(338, 72), (354, 151), (338, 230)], fill=INK, width=3)
    d.line([(338, 66), (344, 102)], fill=(48, 42, 40, 255), width=12)
    d.line([(338, 236), (344, 200)], fill=(48, 42, 40, 255), width=12)
    # Wicker front basket with newspaper roll
    d.rounded_rectangle([354, 108, 418, 194], radius=10, fill=(182, 142, 86, 255), outline=INK, width=4)
    for by in range(122, 190, 16):
        d.line([(358, by), (414, by)], fill=(132, 98, 56, 190), width=3)
    d.rounded_rectangle([368, 122, 404, 160], radius=4, fill=(230, 222, 202, 240), outline=INK_SOFT, width=2)

    return finish(hi, w, h, seed=701, grain=5.5)


# =============================================================================
# 8. PRUSSIAN-BLUE & BRASS BERLIN POSTBOX
# =============================================================================
def gen_str_berlin_postbox():
    w, h = 160, 160
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    draw_soft_shadow_ellipse(hi, [82, 82, 242, 242], offset=(8, 10), blur=9)
    # Stone curb pedestal
    d.rounded_rectangle([74, 74, 246, 246], radius=16, fill=(138, 136, 132, 255), outline=INK, width=4)
    # Prussian-blue cast-iron pillar postbox top with domed brass crest
    d.rounded_rectangle([94, 94, 226, 226], radius=24, fill=(44, 78, 118, 255), outline=INK, width=5)
    d.rounded_rectangle([112, 112, 208, 208], radius=18, fill=(58, 98, 142, 255), outline=(30, 52, 78, 220), width=3)
    # Brass mail horn emblem + top finial
    d.ellipse([134, 134, 186, 186], fill=(198, 162, 76, 255), outline=INK, width=4)
    d.ellipse([148, 148, 172, 172], fill=(232, 202, 114, 255))
    # Mail slot lip at front
    d.rounded_rectangle([126, 212, 194, 232], radius=5, fill=(182, 146, 68, 255), outline=INK, width=3)

    return finish(hi, w, h, seed=801, grain=5.5)


# =============================================================================
# 9. CAST-IRON STREET FIRE HYDRANT
# =============================================================================
def gen_str_iron_fire_hydrant():
    w, h = 150, 150
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    draw_soft_shadow_ellipse(hi, [74, 74, 226, 226], offset=(7, 9), blur=8)
    # Circular cobblestone curb pad
    d.ellipse([66, 66, 234, 234], fill=(128, 126, 122, 235), outline=INK_SOFT, width=4)
    # Side nozzle lugs
    d.rounded_rectangle([86, 134, 214, 166], radius=8, fill=(146, 48, 44, 255), outline=INK, width=4)
    # Hydrant dome + iron bolts
    d.ellipse([104, 104, 196, 196], fill=(168, 54, 48, 255), outline=INK, width=5)
    d.ellipse([122, 122, 178, 178], fill=(192, 74, 64, 255), outline=(96, 30, 26, 210), width=3)
    # Pentagonal brass valve nut on top
    d.regular_polygon((150, 150, 16), n_sides=5, fill=(192, 162, 86, 255), outline=INK)

    return finish(hi, w, h, seed=901, grain=5.5)


# =============================================================================
# 10. IRON-STRAPPED TIMBER SIDEWALK CELLAR DOORS
# =============================================================================
def gen_str_cellar_storm_doors():
    w, h = 240, 210
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    # Stone coping surround
    d.rounded_rectangle([38, 36, 442, 384], radius=10, fill=(116, 114, 110, 255), outline=INK, width=5)
    # Twin weathered plank doors meeting at center seam
    d.rectangle([58, 56, 236, 364], fill=(118, 92, 68, 255), outline=INK, width=4)
    d.rectangle([244, 56, 422, 364], fill=(112, 86, 64, 255), outline=INK, width=4)
    for x in (96, 136, 176, 216, 282, 322, 362, 400):
        d.line([(x, 60), (x, 360)], fill=(76, 56, 40, 190), width=3)
    # Heavy rusted iron strap hinges & padlock hasp
    for hy in (110, 310):
        d.rounded_rectangle([54, hy - 12, 168, hy + 12], radius=4, fill=(64, 62, 60, 255), outline=INK, width=3)
        d.rounded_rectangle([312, hy - 12, 426, hy + 12], radius=4, fill=(64, 62, 60, 255), outline=INK, width=3)
    # Center iron padlock & handle rings
    d.rounded_rectangle([222, 192, 258, 228], radius=6, fill=(76, 72, 68, 255), outline=INK, width=3)
    d.ellipse([194, 198, 216, 220], fill=None, outline=(58, 56, 54, 255), width=5)
    d.ellipse([264, 198, 286, 220], fill=None, outline=(58, 56, 54, 255), width=5)

    return finish(hi, w, h, seed=1001, grain=7.0)


# =============================================================================
# 11. BACKYARD HINTERHOF LAUNDRY CLOTHESLINE (Fluttering sheets, shirts & socks)
# =============================================================================
def gen_str_backyard_clothesline():
    w, h = 440, 180
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    # Soft displaced ground shadows of hanging laundry blowing gently in the breeze
    sh = Image.new("RGBA", hi.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for sx0, sx1 in [(110, 225), (255, 345), (370, 495), (520, 610), (635, 745)]:
        sd.rounded_rectangle([sx0 + 14, 178, sx1 + 14, 278], radius=12, fill=(22, 28, 18, 62))
    sh = sh.filter(ImageFilter.GaussianBlur(11))
    hi.alpha_composite(sh)

    # Twin timber clothesline posts at left & right ends
    for px in (66, 814):
        d.ellipse([px - 22, 152, px + 22, 196], fill=(116, 84, 56, 255), outline=INK, width=4)
        d.ellipse([px - 10, 164, px + 10, 184], fill=(144, 108, 74, 255))

    # Sagging hemp clothesline rope
    pts_rope = [(66, 174), (240, 188), (440, 194), (640, 188), (814, 174)]
    d.line(pts_rope, fill=(186, 168, 134, 255), width=5)

    # Fluttering working-class garments seen from overhead (sheets, shirts, apron, socks!)
    garments = [
        # Cream linen bedsheet
        ([(104, 176), (228, 182), (242, 254), (112, 248)], (236, 228, 210)),
        # Faded chambray work shirt
        ([(252, 184), (344, 188), (356, 248), (264, 244)], (122, 154, 178)),
        # Patchwork sage tablecloth / sheet
        ([(368, 188), (496, 188), (508, 258), (380, 260)], (146, 172, 136)),
        # Dusty terracotta apron
        ([(520, 186), (604, 184), (616, 244), (532, 246)], (188, 108, 92)),
        # Striped ticking pillowcase + socks
        ([(632, 182), (722, 176), (734, 236), (644, 242)], (228, 206, 148)),
        ([(740, 174), (766, 172), (772, 212), (746, 214)], (166, 172, 184)),
    ]
    for poly, col in garments:
        d.polygon(poly, fill=(*col, 248), outline=INK)
        # Subtle breeze crease
        mx0 = (poly[0][0] + poly[1][0]) * 0.5
        my0 = (poly[0][1] + poly[1][1]) * 0.5
        mx1 = (poly[2][0] + poly[3][0]) * 0.5
        my1 = (poly[2][1] + poly[3][1]) * 0.5
        d.line([(mx0, my0 + 4), (mx1, my1 - 4)], fill=(max(0, col[0] - 28), max(0, col[1] - 28), max(0, col[2] - 26), 140), width=4)
        # Wooden clothespins along top rope!
        for cpx, cpy in [(poly[0][0] + 14, poly[0][1]), (poly[1][0] - 14, poly[1][1])]:
            d.rounded_rectangle([cpx - 5, cpy - 12, cpx + 5, cpy + 8], radius=2, fill=(168, 128, 82, 255), outline=INK, width=2)

    return finish(hi, w, h, seed=1101, grain=5.0)


# =============================================================================
# 12. BACKYARD COAL & FIREWOOD LEAN-TO SHED
# =============================================================================
def gen_str_backyard_coal_shed():
    w, h = 360, 260
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    draw_soft_shadow_poly(hi, [(56, 62), (650, 62), (650, 444), (56, 444)], offset=(12, 14), blur=12)

    # Timber floor apron sticking out in front with stacked firewood logs & coal pile
    d.rounded_rectangle([54, 290, 656, 456], radius=10, fill=(116, 94, 72, 255), outline=INK, width=4)
    # Split firewood logs stacked neatly left
    for row in range(3):
        for lx in range(84, 345, 42):
            ly = 330 + row * 34
            d.rounded_rectangle([lx, ly, lx + 36, ly + 26], radius=8, fill=(142, 102, 66, 255), outline=INK, width=3)
            d.line([(lx + 6, ly + 13), (lx + 30, ly + 13)], fill=(104, 72, 46, 180), width=2)
    # Coal heap & metal scuttle + shovel right
    coal_pts = blob_pts(498, 384, 92, 54, n=18, amp=0.18, seed=1202)
    d.polygon(coal_pts, fill=(44, 44, 48, 255), outline=INK)
    rng = random.Random(1203)
    for _ in range(28):
        cx = rng.uniform(430, 565)
        cy = rng.uniform(346, 420)
        d.ellipse([cx - 8, cy - 6, cx + 8, cy + 6], fill=(66, 68, 74, 225), outline=(28, 28, 32, 200))
    # Shovel leaning on apron
    d.line([(578, 336), (624, 434)], fill=(144, 106, 68, 255), width=8)
    d.rounded_rectangle([562, 314, 594, 348], radius=4, fill=(92, 96, 100, 255), outline=INK, width=3)

    # Slanted corrugated-tin & mossy-plank lean-to roof (top 60%)
    d.rounded_rectangle([52, 56, 662, 322], radius=8, fill=(108, 114, 116, 255), outline=INK, width=5)
    for x in range(74, 654, 24):
        d.line([(x, 62), (x, 316)], fill=(78, 84, 86, 200), width=5)
        d.line([(x + 6, 62), (x + 6, 316)], fill=(142, 148, 150, 140), width=3)
    # Rust & moss patina patches on roof
    for rx, ry, rr, col in [
        (165, 148, 56, (148, 88, 52, 125)),
        (468, 212, 68, (136, 78, 46, 120)),
        (312, 108, 50, (82, 116, 64, 130)),
        (560, 120, 44, (78, 110, 58, 125)),
    ]:
        d.polygon(blob_pts(rx, ry, rr, rr * 0.72, n=14, amp=0.22, seed=int(rx)), fill=col)

    return finish(hi, w, h, seed=1201, grain=6.5)


# =============================================================================
# 13. ALLEY GALVANIZED GARBAGE CAN CLUSTER
# =============================================================================
def gen_str_alley_bin_cluster():
    w, h = 280, 210
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    draw_soft_shadow_ellipse(hi, [82, 84, 480, 340], offset=(8, 10), blur=10)
    # Tied soggy burlap trash sack
    sack = blob_pts(404, 246, 78, 66, n=16, amp=0.16, seed=1301)
    d.polygon(sack, fill=(142, 122, 92, 255), outline=INK)
    d.ellipse([390, 232, 418, 260], fill=(102, 82, 58, 255), outline=INK, width=3)

    # Stacked tied old newspapers
    d.rounded_rectangle([244, 246, 336, 326], radius=6, fill=(214, 204, 182, 255), outline=INK, width=4)
    d.line([(248, 286), (332, 286)], fill=(138, 92, 56, 240), width=5)
    d.line([(290, 250), (290, 322)], fill=(138, 92, 56, 240), width=5)

    # Bin 1: Closed dented galvanized metal garbage can with rib handle
    d.ellipse([86, 112, 218, 244], fill=(128, 136, 138, 255), outline=INK, width=5)
    d.ellipse([104, 130, 200, 226], fill=(148, 156, 158, 255), outline=(76, 82, 84, 210), width=3)
    d.rounded_rectangle([130, 166, 174, 190], radius=5, fill=(92, 98, 100, 255), outline=INK, width=3)

    # Bin 2: Askew-lid galvanized bin showing crumpled paper & bottle necks
    d.ellipse([212, 88, 344, 220], fill=(116, 124, 126, 255), outline=INK, width=5)
    d.ellipse([228, 104, 328, 204], fill=(56, 52, 48, 255))
    # Trash peeking inside
    d.polygon([(246, 136), (294, 126), (308, 172), (254, 182)], fill=(214, 206, 184, 240), outline=INK_SOFT)
    d.ellipse([288, 152, 314, 178], fill=(82, 126, 78, 245), outline=INK, width=2)
    # Tilted lid resting half-off
    d.ellipse([252, 72, 376, 196], fill=(138, 146, 148, 255), outline=INK, width=4)
    d.rounded_rectangle([296, 122, 336, 144], radius=4, fill=(88, 94, 96, 255), outline=INK, width=3)

    # Stray green glass bottle on cobbles
    d.rounded_rectangle([142, 274, 194, 294], radius=7, fill=(78, 126, 76, 240), outline=INK, width=3)

    return finish(hi, w, h, seed=1301, grain=6.0)


# =============================================================================
# 14. WIND-SWEPT AUTUMN GUTTER LEAVES & DAMP GRIME SCATTER (Flat)
# =============================================================================
def gen_str_autumn_leaves_scatter():
    w, h = 280, 180
    hi = new_hi(w, h)
    d = ImageDraw.Draw(hi)
    rng = random.Random(1401)

    # Subtle damp gutter grime wash
    wash = blob_pts(280, 180, 225, 118, n=22, amp=0.22, seed=1402)
    d.polygon(wash, fill=(68, 62, 54, 58))

    palette = [
        (178, 108, 46), (196, 138, 52), (146, 76, 42),
        (164, 124, 58), (122, 86, 48), (186, 86, 48),
    ]
    for _ in range(54):
        t = rng.uniform(0, 1)
        lx = 64 + t * 432 + rng.gauss(0, 28)
        ly = 180 + math.sin(t * 4.5) * 42 + rng.gauss(0, 38)
        ang = rng.uniform(0, math.tau)
        sz = rng.uniform(9, 17)
        col = rng.choice(palette)
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (lx + sz * ca, ly + sz * sa),
            (lx - sz * 0.45 * sa, ly + sz * 0.45 * ca),
            (lx - sz * 0.9 * ca, ly - sz * 0.9 * sa),
            (lx + sz * 0.45 * sa, ly - sz * 0.45 * ca),
        ]
        d.polygon(pts, fill=(*col, 228), outline=(72, 46, 28, 175))

    return finish(hi, w, h, seed=1401, grain=5.0)


# =============================================================================
# 15. BERLIN DARK-MAGIPUNK STREETCAR (TRAM ROOF WITH BRASS AETHER PANTOGRAPH)
# =============================================================================
def gen_str_magipunk_tram_car():
    w, h = 560, 220
    hi = new_hi(w, h)
    glow = new_hi(w, h)
    d = ImageDraw.Draw(hi)

    # Deep ground shadow under streetcar body
    draw_soft_shadow_poly(hi, [(68, 64), (1052, 64), (1052, 376), (68, 376)], offset=(10, 14), blur=14)

    # Iron bumpers / cowcatchers at both ends
    for bx0, bx1 in [(36, 98), (1022, 1084)]:
        d.rounded_rectangle([bx0, 122, bx1, 318], radius=18, fill=(58, 62, 66, 255), outline=INK, width=5)

    # Main streetcar outer shell (weathered Prussian-blue & brass trim)
    d.rounded_rectangle([74, 62, 1046, 378], radius=56, fill=(48, 76, 104, 255), outline=INK, width=6)
    # Brass roof rain-gutter trim line
    d.rounded_rectangle([94, 80, 1026, 360], radius=44, fill=(198, 184, 152, 255), outline=(146, 114, 58, 255), width=6)

    # Raised central wooden/cream clerestory lantern roof with warm interior window light slots!
    d.rounded_rectangle([168, 118, 952, 322], radius=26, fill=(176, 162, 132, 255), outline=INK, width=5)
    d.rounded_rectangle([188, 134, 932, 306], radius=18, fill=(214, 198, 166, 255), outline=(124, 106, 78, 220), width=3)

    # Clerestory side transom glow slots (warm passenger lamp glow spilling upward!)
    gd = ImageDraw.Draw(glow)
    for wx in range(214, 900, 74):
        d.rounded_rectangle([wx, 120, wx + 46, 132], radius=3, fill=(255, 212, 112, 245), outline=INK_SOFT, width=2)
        d.rounded_rectangle([wx, 308, wx + 46, 320], radius=3, fill=(255, 212, 112, 245), outline=INK_SOFT, width=2)
        gd.ellipse([wx - 8, 106, wx + 54, 146], fill=(255, 196, 86, 52))
        gd.ellipse([wx - 8, 294, wx + 54, 334], fill=(255, 196, 86, 52))

    # Front & rear brass driver bells + glowing warm headlamps!
    for hx, side in [(84, -1), (1036, 1)]:
        d.ellipse([hx - 18, 202, hx + 18, 238], fill=(196, 156, 72, 255), outline=INK, width=4)
        d.ellipse([hx - 10, 210, hx + 10, 230], fill=(255, 242, 182, 255))
        gd.ellipse([hx + side * 12 - 36, 184, hx + side * 12 + 36, 256], fill=(255, 216, 112, 95))

    # Roof resistor grids + brass aether collector pantograph diamond (center!)
    for rx0 in (242, 796):
        d.rounded_rectangle([rx0, 168, rx0 + 82, 272], radius=8, fill=(84, 86, 88, 255), outline=INK, width=4)
        for ry in range(180, 266, 14):
            d.line([(rx0 + 8, ry), (rx0 + 74, ry)], fill=(52, 54, 56, 255), width=4)

    # Central brass pantograph & cyan aether capacitor coil!
    d.rounded_rectangle([476, 152, 644, 288], radius=12, fill=(76, 72, 66, 255), outline=INK, width=4)
    # Diamond collector arms
    d.line([(492, 220), (560, 162), (628, 220), (560, 278), (492, 220)], fill=(198, 158, 74, 255), width=8)
    d.line([(560, 132), (560, 308)], fill=(192, 152, 68, 255), width=10)
    d.line([(556, 126), (556, 314)], fill=INK, width=3)
    # Subtle glowing blue-teal magipunk aether insulator orb
    d.ellipse([540, 200, 580, 240], fill=(64, 188, 222, 255), outline=INK, width=4)
    d.ellipse([550, 210, 570, 230], fill=(198, 246, 255, 255))
    gd.ellipse([518, 178, 602, 262], fill=(56, 198, 240, 82))

    # Roof weathering streaks
    for lx in range(180, 940, 96):
        d.line([(lx, 138), (lx, 302)], fill=(116, 102, 78, 70), width=3)

    glow = glow.filter(ImageFilter.GaussianBlur(14))
    hi.alpha_composite(glow)
    return finish(hi, w, h, seed=1501, grain=6.0)


SPECS = [
    ("vigil_candle_wax_drift.png", "Vigil Candle Wax Drift (Decades-Old)", gen_vigil_candle_wax_drift, True, ["temple", "candle", "vigil", "wax", "shrine", "stairs"]),
    ("vigil_candle_niche_shrine.png", "Vigil Candle Niche Shrine Mound", gen_vigil_candle_niche_shrine, True, ["temple", "candle", "vigil", "wax", "shrine", "memorial"]),
    ("vigil_wax_puddle_stubs.png", "Melted Vigil Wax Drips & Stubs", gen_vigil_wax_puddle_stubs, False, ["temple", "candle", "vigil", "wax", "decal", "stairs"]),
    ("str_flower_candle_cart.png", "Mourners Candle & Flower Cart", gen_str_flower_candle_cart, True, ["street", "cart", "candle", "flowers", "market"]),
    ("str_berlin_tram_stop.png", "Berlin Magipunk Tram Stop", gen_str_berlin_tram_stop, True, ["street", "tram", "bench", "berlin", "magipunk"]),
    ("str_cobble_crosswalk.png", "Weathered Cobblestone Crosswalk", gen_str_cobble_crosswalk, False, ["street", "road", "crosswalk", "cobble", "decal"]),
    ("str_vintage_bicycle.png", "Vintage Working-Class Bicycle", gen_str_vintage_bicycle, True, ["street", "alley", "yard", "bicycle", "vehicle"]),
    ("str_berlin_postbox.png", "Prussian-Blue Berlin Postbox", gen_str_berlin_postbox, True, ["street", "postbox", "mail", "berlin"]),
    ("str_iron_fire_hydrant.png", "Cast-Iron Street Fire Hydrant", gen_str_iron_fire_hydrant, True, ["street", "hydrant", "iron", "curb"]),
    ("str_cellar_storm_doors.png", "Sidewalk Timber Cellar Doors", gen_str_cellar_storm_doors, False, ["alley", "street", "cellar", "hatch", "yard"]),
    ("str_backyard_clothesline.png", "Hinterhof Backyard Clothesline", gen_str_backyard_clothesline, False, ["yard", "alley", "laundry", "clothesline", "working-class"]),
    ("str_backyard_coal_shed.png", "Backyard Coal & Firewood Shed", gen_str_backyard_coal_shed, True, ["yard", "shed", "firewood", "coal", "working-class"]),
    ("str_alley_bin_cluster.png", "Alley Galvanized Garbage Bins", gen_str_alley_bin_cluster, True, ["alley", "trash", "bins", "urban", "clutter"]),
    ("str_autumn_leaves_scatter.png", "Gutter Autumn Leaves Scatter", gen_str_autumn_leaves_scatter, False, ["street", "alley", "yard", "leaves", "decal"]),
    ("str_magipunk_tram_car.png", "Berlin Magipunk Electric Tram", gen_str_magipunk_tram_car, True, ["street", "tram", "train", "vehicle", "magipunk"]),
]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    generated = []
    for fname, label, fn, shadow, tags in SPECS:
        img = fn()
        path = os.path.join(OUT_DIR, fname)
        img.save(path, "PNG")
        generated.append((fname, label, img.width, img.height, shadow, tags, img))
        print(f"  Generated {fname:32s} {img.width}x{img.height}")

    # Build dark checkerboard QA contact sheet (5 cols x 3 rows)
    cols, rows = 5, 3
    cw, ch = 360, 260
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (32, 34, 42, 255))
    sd = ImageDraw.Draw(sheet)
    for y in range(0, rows * ch, 16):
        for x in range(0, cols * cw, 16):
            if ((x // 16) + (y // 16)) % 2 == 0:
                sd.rectangle([x, y, x + 15, y + 15], fill=(44, 47, 56, 255))
    for idx, (fname, label, iw, ih, _, _, img) in enumerate(generated):
        r, c = divmod(idx, cols)
        scale = min((cw - 32) / iw, (ch - 52) / ih)
        nw, nh = max(1, int(iw * scale)), max(1, int(ih * scale))
        thumb = img.resize((nw, nh), Image.Resampling.LANCZOS)
        ox = c * cw + (cw - nw) // 2
        oy = r * ch + (ch - 26 - nh) // 2
        sheet.alpha_composite(thumb, (ox, oy))
        sd.rectangle([c * cw, (r + 1) * ch - 24, (c + 1) * cw - 1, (r + 1) * ch - 1], fill=(20, 22, 28, 230))
        sd.text((c * cw + 8, (r + 1) * ch - 18), fname, fill=(235, 240, 245, 255))
    os.makedirs(os.path.dirname(QA_PATH), exist_ok=True)
    sheet.convert("RGB").save(QA_PATH, "PNG")
    print("Saved QA contact sheet:", QA_PATH)

    # Register in modular-suite-cc0/manifest.json matching exact schema (category: "object", keyed by "path")
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    assets = manifest.get("assets", [])
    by_path = {a.get("path"): i for i, a in enumerate(assets)}
    for fname, label, iw, ih, shadow, tags, _ in generated:
        rel_path = f"props/district_streets/{fname}"
        entry = {
            "path": rel_path,
            "displayName": label,
            "category": "object",
            "tags": tags,
            "widthPx": iw,
            "heightPx": ih,
            "defaultPpi": 256,
            "drawMode": "normal",
            "castsShadow": shadow,
            "dominantHex": "#A08C74",
        }
        if rel_path in by_path:
            assets[by_path[rel_path]] = entry
        else:
            by_path[rel_path] = len(assets)
            assets.append(entry)
    manifest["assets"] = assets
    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")
    print(f"Updated manifest.json -> {len(assets)} modular assets.")

    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for fpath in sorted(MODULAR_DIR.rglob("*")):
            if fpath.is_file():
                zf.write(fpath, fpath.relative_to(MODULAR_DIR).as_posix())
    print(f"Rebuilt {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()

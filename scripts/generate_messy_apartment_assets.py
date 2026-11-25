#!/usr/bin/env python3
"""
Clean-room generates 10 hand-inked painterly top-down "Messy Apartment & Lived-In Tenement"
CC0 props at 2x supersampled resolution (downsampled cleanly with Lanczos for crisp anti-aliased
ink lines, warm gouache shading, organic texture grain, and zero white halos), registers them
in `public/assets/modular-suite-cc0/manifest.json`, rebuilds `DiceChaos_Modular_Suite_CC0.dcpack`,
and saves a dark-checkerboard QA contact sheet (`scratch/messy_apt_props_qa.png`).
"""

from __future__ import annotations

import json
import math
import random
import zipfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
MODULAR_DIR = ROOT / "public" / "assets" / "modular-suite-cc0"
OUT_DIR = MODULAR_DIR / "props" / "messy_apartment"
MANIFEST_PATH = MODULAR_DIR / "manifest.json"
DCPACK_PATH = ROOT / "public" / "assets" / "DiceChaos_Modular_Suite_CC0.dcpack"
QA_PATH = Path(r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch\messy_apt_props_qa.png")

OUT_DIR.mkdir(parents=True, exist_ok=True)
QA_PATH.parent.mkdir(parents=True, exist_ok=True)

INK = (26, 20, 17, 255)
INK_SOFT = (42, 33, 28, 220)


def painter_grain(img: Image.Image, seed: int, strength: float = 10.0) -> Image.Image:
    """Apply subtle organic watercolor/gouache grain strictly inside opaque painted pixels."""
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape
    rng = np.random.default_rng(seed)
    # Multi-scale smooth mottling + fine paper grain
    small = rng.normal(0.0, 1.0, (max(4, h // 10), max(4, w // 10))).astype(np.float32)
    mottle = np.array(
        Image.fromarray(((small * 0.25 + 0.5).clip(0, 1) * 255).astype(np.uint8)).resize((w, h), Image.Resampling.BICUBIC),
        dtype=np.float32,
    ) / 255.0 - 0.5
    fine = rng.normal(0.0, 0.35, (h, w)).astype(np.float32)
    delta = (mottle * 1.4 + fine) * strength
    alpha_mask = (arr[:, :, 3] > 20).astype(np.float32)
    # Subtle top-left studio lighting bias
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    grad = ((0.5 - xx / max(1, w)) * 0.55 + (0.5 - yy / max(1, h)) * 0.65) * (strength * 1.1)
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] + (delta + grad) * alpha_mask, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def finish_sprite(hi_res: Image.Image, target_w: int, target_h: int, seed: int, grain=11.0) -> Image.Image:
    """Downsample 2x supersampled sprite with Lanczos and apply organic painterly finish."""
    im = hi_res.resize((target_w, target_h), Image.Resampling.LANCZOS)
    return painter_grain(im, seed=seed, strength=grain)


def poly_wobble(pts: list[tuple[float, float]], rng: random.Random, amp: float = 3.5) -> list[tuple[float, float]]:
    out = []
    n = len(pts)
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        out.append((x0 + rng.uniform(-amp, amp), y0 + rng.uniform(-amp, amp)))
        mx, my = (x0 + x1) * 0.5 + rng.uniform(-amp * 1.1, amp * 1.1), (y0 + y1) * 0.5 + rng.uniform(-amp * 1.1, amp * 1.1)
        out.append((mx, my))
    return out


def draw_ink_poly(d: ImageDraw.ImageDraw, pts, fill, outline=INK, width=5):
    d.polygon(pts, fill=fill)
    if outline and width > 0:
        d.line(list(pts) + [pts[0]], fill=outline, width=width, joint="curve")


def draw_blob(d: ImageDraw.ImageDraw, cx, cy, rx, ry, rot, fill, rng, steps=18, amp=0.14, outline=INK, width=5):
    pts = []
    for i in range(steps):
        a = (i / steps) * math.tau
        rad_j = 1.0 + rng.uniform(-amp, amp)
        lx = math.cos(a) * rx * rad_j
        ly = math.sin(a) * ry * rad_j
        wx = cx + lx * math.cos(rot) - ly * math.sin(rot)
        wy = cy + lx * math.sin(rot) + ly * math.cos(rot)
        pts.append((wx, wy))
    draw_ink_poly(d, pts, fill=fill, outline=outline, width=width)
    return pts


def draw_rect_rot(d: ImageDraw.ImageDraw, cx, cy, w, h, rot, fill, outline=INK, width=5):
    hw, hh = w * 0.5, h * 0.5
    c, s = math.cos(rot), math.sin(rot)
    pts = []
    for lx, ly in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)):
        pts.append((cx + lx * c - ly * s, cy + lx * s + ly * c))
    draw_ink_poly(d, pts, fill=fill, outline=outline, width=width)
    return pts


# ---------------------------------------------------------------------------
# 1. UNMADE MESSY TENEMENT BED (twisted blanket, crooked pillow, tossed book)
# ---------------------------------------------------------------------------
def gen_unmade_messy_bed() -> Image.Image:
    W, H = 560, 760
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(101)

    # Dark wrought-iron bed frame & corner posts
    d.rounded_rectangle((54, 42, W - 54, H - 52), radius=18, fill=(44, 40, 44, 255), outline=INK, width=8)
    # Iron rail head/foot bars
    d.rounded_rectangle((46, 36, W - 46, 76), radius=12, fill=(58, 54, 58, 255), outline=INK, width=7)
    d.rounded_rectangle((46, H - 82, W - 46, H - 46), radius=12, fill=(58, 54, 58, 255), outline=INK, width=7)
    for px, py in ((62, 54), (W - 62, 54), (62, H - 64), (W - 62, H - 64)):
        d.ellipse((px - 22, py - 22, px + 22, py + 22), fill=(176, 138, 66, 255), outline=INK, width=6)
        d.ellipse((px - 9, py - 9, px + 5, py + 5), fill=(232, 202, 128, 220))

    # Rumpled cream-beige ticking mattress & fitted sheet
    d.rounded_rectangle((74, 80, W - 74, H - 86), radius=16, fill=(224, 212, 188, 255), outline=INK, width=6)
    # Subtle mattress ticking stripes
    for sx in range(106, W - 90, 34):
        d.line([(sx, 86), (sx, H - 92)], fill=(196, 184, 162, 140), width=4)
    # Exposed wrinkled top sheet pushed sideways
    sheet_pts = poly_wobble([(84, 185), (465, 160), (478, 430), (350, 465), (90, 380)], rng, 8)
    draw_ink_poly(d, sheet_pts, fill=(238, 232, 218, 255), outline=(120, 112, 98, 200), width=4)
    # Wrinkle crease lines
    for y_c in (235, 290, 345):
        d.line([(120, y_c), (260, y_c + 18), (420, y_c - 12)], fill=(168, 158, 140, 185), width=4)

    # Crooked flattened pillows (one shoved sideways, one half off)
    draw_blob(d, 195, 148, 92, 52, -0.18, (242, 236, 224, 255), rng, steps=20, amp=0.07, width=6)
    d.line([(140, 145), (210, 158), (255, 138)], fill=(175, 166, 150, 180), width=4)
    draw_blob(d, 378, 165, 86, 48, 0.28, (216, 206, 192, 255), rng, steps=20, amp=0.08, width=6)
    d.line([(335, 155), (392, 174), (425, 165)], fill=(154, 144, 130, 185), width=4)

    # Twisted, kicked-off deep teal & rust striped duvet bunched toward the foot and hanging slightly over the edge!
    duvet_pts = [
        (78, 320), (190, 290), (295, 365), (455, 265), (506, 355),
        (518, 570), (476, 688), (335, 662), (240, 710), (88, 675), (60, 520),
    ]
    duvet_pts = poly_wobble(duvet_pts, rng, 10)
    draw_ink_poly(d, duvet_pts, fill=(138, 64, 56, 255), outline=INK, width=7)
    # Blanket woven stripes & warm ochre bands clipped nicely inside
    b_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(b_mask).polygon(duvet_pts, fill=255)
    pat = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pat)
    for k, y_st in enumerate(range(270, 720, 42)):
        col = (62, 104, 108, 235) if k % 3 == 0 else (196, 150, 76, 210) if k % 3 == 1 else (112, 48, 44, 210)
        pd.line([(40, y_st + 24), (270, y_st - 14), (530, y_st + 32)], fill=col, width=16)
    # Deep shadow folds across twisted duvet
    for fold in ([(140, 360), (290, 445), (445, 370)], [(110, 505), (310, 565), (485, 485)], [(170, 620), (355, 640)]):
        pd.line(fold, fill=(38, 18, 18, 165), width=11)
        pd.line([(x, y - 8) for x, y in fold], fill=(232, 198, 152, 95), width=6)
    im.paste(pat, (0, 0), b_mask)
    d.line(duvet_pts + [duvet_pts[0]], fill=INK, width=7, joint="curve")

    # Open paperback / magazine tossed face-down on the rumpled sheet!
    draw_rect_rot(d, 222, 265, 92, 68, -0.35, (236, 226, 198, 255), outline=INK, width=5)
    draw_rect_rot(d, 222, 265, 44, 62, -0.35, (206, 86, 62, 255), outline=INK, width=4)
    # Stray dark sock kicked near bottom-left edge
    draw_blob(d, 145, 648, 32, 16, 0.7, (58, 74, 96, 255), rng, steps=12, amp=0.14, width=4)

    return finish_sprite(im, 320, 434, seed=101, grain=10.5)


# ---------------------------------------------------------------------------
# 2. DIRTY LAUNDRY PILE & OVERTURNED BASKET
# ---------------------------------------------------------------------------
def gen_dirty_laundry_pile() -> Image.Image:
    W, H = 640, 560
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(202)

    # Tipped-over woven wicker laundry basket on upper-left (clipped cross-hatch weave!)
    b_pts = draw_blob(d, 175, 220, 118, 92, -0.42, (166, 126, 78, 255), rng, steps=22, amp=0.05, width=7)
    w_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(w_mask).polygon(b_pts, fill=255)
    w_ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    wd = ImageDraw.Draw(w_ov)
    for k in range(-4, 5):
        wd.line([(85 + k * 24, 120), (215 + k * 24, 320)], fill=(112, 78, 42, 190), width=5)
        wd.line([(65, 195 + k * 22), (295, 245 + k * 22)], fill=(96, 64, 34, 175), width=4)
    im.paste(w_ov, (0, 0), w_mask)
    d.line(b_pts + [b_pts[0]], fill=INK, width=7, joint="curve")
    # Dark interior mouth of tipped basket
    draw_blob(d, 228, 252, 54, 72, -0.42, (58, 42, 28, 255), rng, steps=16, amp=0.04, width=6)

    # Chaotic sprawling heap of unwashed shirts, trousers, sweater, apron & mismatched socks!
    garments = [
        (320, 290, 125, 88, 0.25, (64, 82, 108, 255)),   # dark denim/work trousers
        (415, 235, 98, 72, -0.45, (186, 174, 152, 255)),  # wrinkled cream undershirt
        (355, 365, 110, 68, 0.15, (148, 58, 54, 255)),    # burgundy flannel shirt
        (268, 340, 88, 66, -0.3, (96, 114, 84, 255)),     # olive cardigan
        (465, 325, 86, 64, 0.6, (206, 162, 82, 255)),     # mustard scarf/sweater
        (308, 245, 76, 54, 0.8, (226, 218, 202, 255)),    # crumpled bedsheet corner
        (430, 410, 72, 46, -0.2, (74, 64, 88, 255)),      # plum vest
    ]
    for cx, cy, rx, ry, rot, col in garments:
        pts = draw_blob(d, cx, cy, rx, ry, rot, col, rng, steps=18, amp=0.18, width=6)
        # Fabric crease & highlight inside garment
        dark_c = tuple(max(0, c - 46) for c in col[:3]) + (185,)
        lite_c = tuple(min(255, c + 36) for c in col[:3]) + (120,)
        d.line([(cx - rx * 0.45, cy - ry * 0.15), (cx, cy + ry * 0.18), (cx + rx * 0.42, cy - ry * 0.12)], fill=dark_c, width=6)
        d.line([(cx - rx * 0.3, cy - ry * 0.3), (cx + rx * 0.25, cy - ry * 0.2)], fill=lite_c, width=5)

    # Tossed mismatched socks around the edges of the pile
    for sx, sy, rot, scol in (
        (535, 225, 0.5, (184, 62, 62, 255)),
        (518, 435, -0.8, (54, 88, 122, 255)),
        (160, 410, 0.9, (218, 198, 134, 255)),
        (235, 452, -0.3, (184, 62, 62, 255)),
    ):
        draw_blob(d, sx, sy, 34, 15, rot, scol, rng, steps=12, amp=0.14, width=5)
        # Toe/heel stripe
        d.ellipse((sx - 10, sy - 10, sx + 10, sy + 10), fill=(238, 232, 218, 195))

    return finish_sprite(im, 340, 298, seed=202, grain=11.0)


# ---------------------------------------------------------------------------
# 3. SCATTERED NEWSPAPERS, ENVELOPES & UNPAID RENT BILLS
# ---------------------------------------------------------------------------
def gen_scattered_newspapers() -> Image.Image:
    W, H = 640, 560
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(303)

    papers = [
        (195, 215, 165, 128, -0.28, (222, 210, 182, 255), True),
        (365, 185, 155, 118, 0.42, (232, 222, 196, 255), True),
        (445, 340, 168, 124, -0.55, (216, 204, 178, 255), True),
        (245, 365, 150, 112, 0.18, (228, 218, 192, 255), True),
        (330, 285, 112, 82, -0.12, (242, 234, 212, 255), False),  # unpaid rent bill with red stamp!
    ]
    for cx, cy, pw, ph, rot, col, is_news in papers:
        pts = draw_rect_rot(d, cx, cy, pw, ph, rot, col, outline=INK, width=5)
        c, s = math.cos(rot), math.sin(rot)
        def tr(lx, ly):
            return (cx + lx * c - ly * s, cy + lx * s + ly * c)
        if is_news:
            # Center newspaper fold line
            d.line([tr(0, -ph * 0.46), tr(0, ph * 0.46)], fill=(142, 130, 108, 185), width=4)
            # Bold masthead bar & columns of newsprint ink lines
            d.line([tr(-pw * 0.4, -ph * 0.32), tr(-pw * 0.08, -ph * 0.32)], fill=(46, 40, 36, 215), width=9)
            d.line([tr(pw * 0.08, -ph * 0.32), tr(pw * 0.4, -ph * 0.32)], fill=(46, 40, 36, 215), width=9)
            for row in range(-2, 4):
                yy = row * 14 + 4
                d.line([tr(-pw * 0.4, yy), tr(-pw * 0.09, yy)], fill=(86, 78, 68, 165), width=4)
                d.line([tr(pw * 0.09, yy), tr(pw * 0.38, yy)], fill=(86, 78, 68, 165), width=4)
        else:
            # Red-stamped overdue rent notice + brown coffee ring stain!
            for row in range(-2, 3):
                d.line([tr(-pw * 0.36, row * 12), tr(pw * 0.36, row * 12)], fill=(92, 82, 72, 165), width=4)
            draw_rect_rot(d, cx + 14, cy + 8, 48, 20, rot - 0.25, (186, 48, 42, 195), outline=(124, 24, 22, 220), width=3)
            # Coffee ring stain
            d.ellipse((cx - 48, cy - 34, cx - 8, cy + 6), outline=(126, 82, 44, 155), width=5)

    # Torn envelopes & crumpled paper ball scattered around edges
    draw_rect_rot(d, 130, 385, 68, 42, 0.72, (238, 228, 204, 255), outline=INK, width=4)
    draw_rect_rot(d, 515, 205, 64, 40, -0.35, (226, 206, 174, 255), outline=INK, width=4)
    draw_blob(d, 128, 118, 24, 22, 0.2, (236, 228, 206, 255), rng, steps=10, amp=0.22, width=4)
    draw_blob(d, 500, 448, 26, 22, 0.5, (228, 218, 194, 255), rng, steps=10, amp=0.22, width=4)

    return finish_sprite(im, 340, 298, seed=303, grain=9.0)


# ---------------------------------------------------------------------------
# 4. DIRTY DISHES KITCHEN SINK COUNTER
# ---------------------------------------------------------------------------
def gen_dirty_dishes_sink() -> Image.Image:
    W, H = 760, 420
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(404)

    # Worn dark-oak tenement kitchen counter cabinet
    d.rounded_rectangle((32, 34, W - 32, H - 34), radius=14, fill=(118, 84, 54, 255), outline=INK, width=8)
    for py in range(74, H - 54, 42):
        d.line([(42, py), (W - 42, py)], fill=(84, 58, 36, 145), width=3)
    # Brass backsplash edge along top
    d.rectangle((38, 38, W - 38, 62), fill=(88, 64, 44, 255), outline=INK, width=4)

    # Left-center chipped white enamel sink basin filled with murky soapy dishwater!
    d.rounded_rectangle((74, 78, 426, H - 64), radius=24, fill=(224, 226, 222, 255), outline=INK, width=7)
    d.rounded_rectangle((96, 100, 404, H - 86), radius=18, fill=(134, 152, 154, 255), outline=(74, 86, 92, 220), width=5)
    # Brass gooseneck faucet & twin cross handles
    d.ellipse((234, 62, 266, 94), fill=(196, 154, 72, 255), outline=INK, width=5)
    d.rounded_rectangle((242, 76, 258, 142), radius=6, fill=(214, 174, 88, 255), outline=INK, width=5)
    for hx in (198, 302):
        d.ellipse((hx - 14, 64, hx + 14, 92), fill=(182, 142, 68, 255), outline=INK, width=4)

    # Stacked greasy ceramic plates submerged/tilted inside the sink!
    for px, py, r, stain in ((185, 228, 66, (162, 92, 54, 150)), (235, 245, 62, (132, 86, 52, 130)), (325, 212, 58, (176, 128, 62, 140))):
        d.ellipse((px - r, py - r, px + r, py + r), fill=(238, 234, 222, 255), outline=INK, width=5)
        d.ellipse((px - r * 0.68, py - r * 0.68, px + r * 0.68, py + r * 0.68), outline=(175, 168, 154, 200), width=3)
        draw_blob(d, px + 8, py - 4, r * 0.35, r * 0.25, 0.4, stain, rng, steps=10, amp=0.25, outline=None, width=0)

    # Cast-iron greasy skillet resting askew across the sink rim!
    d.line([(335, 258), (448, 318)], fill=(44, 44, 48, 255), width=20)
    d.line([(335, 258), (448, 318)], fill=INK, width=6)
    d.ellipse((254, 186, 378, 310), fill=(52, 52, 58, 255), outline=INK, width=6)
    d.ellipse((270, 202, 362, 294), fill=(72, 64, 58, 255), outline=(30, 30, 34, 220), width=3)
    draw_blob(d, 316, 248, 26, 18, 0.2, (148, 92, 42, 180), rng, steps=10, amp=0.22, outline=None, width=0)

    # Right drainboard piled with unwashed mugs, crusted copper pot, soapy rag & sponge!
    d.rounded_rectangle((454, 82, W - 56, H - 68), radius=10, fill=(146, 114, 80, 255), outline=INK, width=5)
    # Crusted copper soup pot
    d.ellipse((556, 122, 686, 252), fill=(182, 108, 64, 255), outline=INK, width=6)
    d.ellipse((574, 140, 668, 234), fill=(96, 62, 42, 255), outline=INK, width=4)
    # Unwashed ceramic mugs & stacked bowls
    for mx, my, mcol in ((498, 146, (224, 214, 196, 255)), (512, 246, (186, 104, 84, 255)), (586, 296, (108, 138, 152, 255))):
        d.ellipse((mx - 26, my - 26, mx + 26, my + 26), fill=mcol, outline=INK, width=5)
        d.ellipse((mx - 15, my - 15, mx + 15, my + 15), fill=(98, 68, 44, 215))
    # Yellow scrub sponge & wrinkled dish rag
    draw_rect_rot(d, 488, 316, 48, 34, 0.35, (228, 192, 74, 255), outline=INK, width=4)
    draw_blob(d, 662, 302, 42, 32, -0.3, (216, 208, 194, 255), rng, steps=12, amp=0.18, width=5)
    # Soap bubbles floating on sink water
    for bx, by, br in ((132, 146, 14), (154, 134, 9), (124, 286, 11), (372, 136, 12)):
        d.ellipse((bx - br, by - br, bx + br, by + br), fill=(238, 248, 252, 195), outline=(140, 170, 185, 180), width=2)

    return finish_sprite(im, 420, 232, seed=404, grain=9.5)


# ---------------------------------------------------------------------------
# 5. OVERFLOWING APARTMENT TRASH BIN
# ---------------------------------------------------------------------------
def gen_overflowing_trash_bin() -> Image.Image:
    W, H = 480, 480
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(505)

    # Spilled floor trash surrounding the bin (crumpled papers, banana/apple scrap, bottle neck, crushed tin!)
    for cx, cy, rx, ry, rot, col in (
        (108, 345, 32, 26, 0.3, (232, 224, 198, 255)),
        (376, 338, 34, 28, -0.4, (224, 212, 184, 255)),
        (362, 142, 28, 24, 0.8, (236, 228, 204, 255)),
        (124, 148, 40, 22, -0.6, (164, 170, 174, 255)),  # crushed tin can
    ):
        draw_blob(d, cx, cy, rx, ry, rot, col, rng, steps=11, amp=0.22, width=5)
    # Green glass bottle lying on the floor beside the bin
    draw_rect_rot(d, 384, 232, 68, 26, 0.45, (64, 116, 74, 255), outline=INK, width=5)
    draw_rect_rot(d, 418, 248, 26, 12, 0.45, (78, 138, 86, 255), outline=INK, width=4)

    # Dented galvanized metal apartment bin rim
    draw_blob(d, 240, 240, 132, 126, 0.1, (132, 138, 146, 255), rng, steps=26, amp=0.04, width=8)
    draw_blob(d, 240, 240, 112, 108, 0.1, (68, 66, 62, 255), rng, steps=24, amp=0.03, width=5)

    # Overflowing mound of crumpled paper balls, grease wrappers, tin cans & glass bottle necks!
    junk = [
        (210, 212, 44, 38, 0.2, (234, 224, 198, 255)),
        (278, 218, 42, 34, -0.3, (206, 176, 136, 255)),
        (232, 278, 46, 36, 0.5, (226, 218, 192, 255)),
        (188, 264, 34, 28, -0.2, (166, 98, 72, 255)),
        (288, 272, 32, 26, 0.4, (148, 156, 162, 255)),
        (246, 236, 36, 30, 0.1, (242, 234, 212, 255)),
    ]
    for cx, cy, rx, ry, rot, col in junk:
        draw_blob(d, cx, cy, rx, ry, rot, col, rng, steps=11, amp=0.24, width=5)
        d.line([(cx - rx * 0.4, cy), (cx + rx * 0.35, cy + 6)], fill=(120, 110, 96, 170), width=3)
    # Tin can rim & green bottle top sticking out
    d.ellipse((178, 168, 222, 212), fill=(178, 184, 190, 255), outline=INK, width=5)
    d.ellipse((188, 178, 212, 202), fill=(62, 64, 68, 255))
    d.ellipse((276, 172, 306, 202), fill=(66, 128, 78, 255), outline=INK, width=5)
    d.ellipse((284, 180, 298, 194), fill=(26, 48, 30, 255))

    return finish_sprite(im, 280, 280, seed=505, grain=10.0)


# ---------------------------------------------------------------------------
# 6. HALF-UNPACKED CARDBOARD MOVING BOXES CLUSTER
# ---------------------------------------------------------------------------
def gen_cardboard_moving_boxes() -> Image.Image:
    W, H = 640, 560
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(606)

    # Box 1 (lower-left): Open-flap cardboard moving box stuffed with books & folded blanket!
    draw_rect_rot(d, 205, 345, 224, 196, -0.14, (176, 134, 88, 255), outline=INK, width=7)
    draw_rect_rot(d, 205, 345, 194, 168, -0.14, (86, 62, 38, 255), outline=INK, width=5)
    # Books & cozy plaid blanket peeking out inside Box 1
    draw_rect_rot(d, 162, 328, 74, 52, -0.3, (132, 48, 48, 255), outline=INK, width=4)
    draw_rect_rot(d, 176, 368, 68, 46, 0.1, (54, 84, 118, 255), outline=INK, width=4)
    draw_blob(d, 248, 348, 52, 48, 0.2, (194, 148, 78, 255), rng, steps=14, amp=0.14, width=5)
    # Splayed open cardboard flaps folded outward
    draw_rect_rot(d, 188, 232, 206, 56, -0.14, (196, 152, 102, 255), outline=INK, width=6)
    draw_rect_rot(d, 218, 456, 206, 54, -0.14, (186, 142, 94, 255), outline=INK, width=6)

    # Box 2 (upper-right): Closed taped cardboard moving box with hemp twine & scrawled label!
    draw_rect_rot(d, 430, 205, 210, 175, 0.18, (188, 144, 96, 255), outline=INK, width=7)
    # Center seam & packing tape strip
    draw_rect_rot(d, 430, 205, 206, 28, 0.18, (214, 182, 126, 215), outline=(112, 82, 46, 200), width=3)
    # Tied hemp string cross
    c, s = math.cos(0.18), math.sin(0.18)
    d.line([(430 - 102 * c, 205 - 102 * s), (430 + 102 * c, 205 + 102 * s)], fill=(216, 198, 154, 230), width=5)
    d.line([(430 + 84 * s, 205 - 84 * c), (430 - 84 * s, 205 + 84 * c)], fill=(216, 198, 154, 230), width=5)
    # Paper shipping label
    draw_rect_rot(d, 456, 166, 68, 38, 0.18, (238, 230, 210, 255), outline=INK, width=4)

    # Box 3 (bottom-right): Smaller tilted crate/shoebox stacked askew
    draw_rect_rot(d, 448, 392, 144, 114, -0.26, (166, 124, 78, 255), outline=INK, width=6)
    draw_rect_rot(d, 448, 392, 140, 22, -0.26, (206, 174, 120, 215), outline=(104, 76, 44, 190), width=3)

    return finish_sprite(im, 340, 298, seed=606, grain=10.5)


# ---------------------------------------------------------------------------
# 7. TANGLED MAGIPUNK AETHER WIRES, GEARS & BATTERY CLUTTER
# ---------------------------------------------------------------------------
def gen_tangled_aether_wires() -> Image.Image:
    W, H = 600, 560
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(707)

    # Subtle dark grease rag / oil smudge base
    draw_blob(d, 305, 290, 155, 115, 0.25, (42, 46, 52, 145), rng, steps=18, amp=0.22, outline=None, width=0)
    draw_blob(d, 195, 365, 76, 52, -0.4, (132, 92, 72, 255), rng, steps=14, amp=0.18, width=5)  # oily shop rag

    # Tangled braided copper, red-insulated, and glowing cyan aether conduits looping wildly!
    wire_specs = [
        ((186, 118, 62, 255), 9, 0.0),
        ((148, 48, 46, 255), 8, 1.3),
        ((56, 189, 248, 255), 8, 2.5),
        ((198, 156, 74, 255), 7, 3.8),
        ((64, 74, 86, 255), 8, 4.9),
    ]
    for col, w_px, phase in wire_specs:
        pts = []
        for i in range(28):
            t = i / 27.0
            ang = phase + t * math.tau * 1.45
            rad = 95 + 110 * math.sin(t * math.pi * 2.3 + phase)
            px = 300 + math.cos(ang) * rad + rng.uniform(-16, 16)
            py = 280 + math.sin(ang) * rad * 0.84 + rng.uniform(-16, 16)
            pts.append((px, py))
        d.line(pts, fill=INK, width=w_px + 6, joint="curve")
        d.line(pts, fill=col, width=w_px, joint="curve")

    # Scattered brass cogwheels!
    for gx, gy, gr, gcol in ((225, 225, 44, (198, 156, 74, 255)), (382, 338, 36, (176, 128, 62, 255)), (332, 182, 28, (214, 174, 86, 255))):
        # Gear teeth
        for k in range(10):
            a = (k / 10) * math.tau
            tx, ty = gx + math.cos(a) * (gr + 8), gy + math.sin(a) * (gr + 8)
            draw_rect_rot(d, tx, ty, 14, 14, a, gcol, outline=INK, width=3)
        d.ellipse((gx - gr, gy - gr, gx + gr, gy + gr), fill=gcol, outline=INK, width=5)
        d.ellipse((gx - gr * 0.36, gy - gr * 0.36, gx + gr * 0.36, gy + gr * 0.36), fill=(36, 32, 30, 255), outline=INK, width=4)

    # Glowing cyan aether battery cell & cracked vacuum glass tube + screwdriver!
    draw_rect_rot(d, 302, 288, 96, 48, -0.32, (62, 72, 84, 255), outline=INK, width=6)
    draw_rect_rot(d, 302, 288, 52, 30, -0.32, (74, 212, 255, 255), outline=(28, 118, 164, 255), width=4)
    # Brass terminals
    draw_rect_rot(d, 255, 304, 14, 24, -0.32, (206, 162, 78, 255), outline=INK, width=4)
    draw_rect_rot(d, 349, 272, 14, 24, -0.32, (206, 162, 78, 255), outline=INK, width=4)

    # Brass wrench & wooden-handled soldering iron tossed across wires
    draw_rect_rot(d, 424, 218, 108, 16, 0.72, (156, 162, 168, 255), outline=INK, width=4)
    draw_rect_rot(d, 166, 274, 88, 18, -0.82, (148, 86, 48, 255), outline=INK, width=4)

    return finish_sprite(im, 320, 300, seed=707, grain=9.5)


# ---------------------------------------------------------------------------
# 8. MESSY CLUTTERED COFFEE TABLE (takeout box, coffee mugs, cards, papers)
# ---------------------------------------------------------------------------
def gen_messy_coffee_table() -> Image.Image:
    W, H = 700, 440
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(808)

    # Scratched honey-walnut low coffee table
    d.rounded_rectangle((36, 42, W - 36, H - 42), radius=18, fill=(134, 92, 56, 255), outline=INK, width=8)
    for py in range(84, H - 62, 46):
        d.line([(46, py), (W - 46, py)], fill=(96, 64, 38, 155), width=3)
    # Scuffed coffee ring stains directly on the tabletop!
    for rx, ry in ((295, 186), (482, 294)):
        d.ellipse((rx - 28, ry - 28, rx + 28, ry + 28), outline=(72, 46, 26, 145), width=5)

    # Creased newspaper folded across left edge
    draw_rect_rot(d, 146, 256, 144, 112, -0.22, (226, 216, 188, 255), outline=INK, width=5)
    for k in range(-2, 3):
        d.line([(92, 248 + k * 14), (196, 224 + k * 14)], fill=(94, 84, 72, 160), width=4)

    # Open grease-stained cardboard pastry / takeout box with half-eaten tart & crumbs!
    draw_rect_rot(d, 316, 226, 148, 134, 0.14, (232, 222, 198, 255), outline=INK, width=6)
    draw_rect_rot(d, 316, 226, 124, 110, 0.14, (206, 194, 168, 255), outline=(136, 122, 98, 200), width=3)
    # Half-eaten lattice pastry & cinnamon roll inside box
    d.pieslice((274, 186, 358, 270), start=35, end=275, fill=(196, 132, 66, 255), outline=INK, width=5)
    d.ellipse((324, 218, 368, 262), fill=(176, 108, 54, 255), outline=INK, width=4)

    # Ceramic coffee mugs, chipped plate, scattered playing cards & brass ashtray/pipe!
    for mx, my, mcol in ((166, 126, (234, 226, 210, 255)), (476, 148, (112, 148, 158, 255))):
        d.ellipse((mx - 28, my - 28, mx + 28, my + 28), fill=mcol, outline=INK, width=5)
        d.ellipse((mx - 17, my - 17, mx + 17, my + 17), fill=(86, 52, 32, 235))
    # Brass ashtray & pipe
    d.ellipse((554, 242, 616, 304), fill=(176, 138, 68, 255), outline=INK, width=5)
    d.ellipse((566, 254, 604, 292), fill=(84, 78, 74, 255))
    # Fanned messy playing cards
    for i, (kx, ky, kr) in enumerate(((468, 262, -0.4), (488, 276, 0.15), (504, 254, 0.55))):
        draw_rect_rot(d, kx, ky, 36, 52, kr, (244, 238, 224, 255), outline=INK, width=4)
        d.ellipse((kx - 5, ky - 5, kx + 5, ky + 5), fill=(182, 38, 38, 255) if i % 2 == 0 else (32, 32, 36, 255))
    # Green glass bottle standing on top-right corner
    d.ellipse((574, 102, 622, 150), fill=(64, 118, 72, 255), outline=INK, width=5)
    d.ellipse((588, 116, 608, 136), fill=(134, 186, 132, 255), outline=INK, width=3)

    return finish_sprite(im, 390, 245, seed=808, grain=9.5)


# ---------------------------------------------------------------------------
# 9. VINTAGE BERLIN PULL-CHAIN CERAMIC TOILET (WC) & BATHMAT
# ---------------------------------------------------------------------------
def gen_toilet_wc_stall() -> Image.Image:
    W, H = 400, 480
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(909)

    # Cozy woven blue-and-cream U-shaped bathmat on floor in front of toilet
    draw_blob(d, 200, 344, 134, 92, 0.0, (92, 126, 146, 255), rng, steps=22, amp=0.04, width=6)
    draw_blob(d, 200, 344, 106, 68, 0.0, (124, 158, 174, 220), rng, steps=18, amp=0.03, outline=(218, 212, 198, 200), width=4)

    # Back wall cistern tank (high-mounted wooden/ceramic Berlin flush box + brass pipe!)
    d.rounded_rectangle((96, 40, 304, 128), radius=12, fill=(116, 76, 44, 255), outline=INK, width=7)
    d.rounded_rectangle((110, 52, 290, 114), radius=8, fill=(142, 96, 58, 255), outline=(66, 42, 24, 220), width=4)
    # Brass flush pipe & pull-chain bead handle on right
    d.rectangle((188, 124, 212, 176), fill=(198, 158, 76, 255), outline=INK, width=5)
    d.line([(296, 126), (318, 168)], fill=(198, 158, 76, 255), width=5)
    d.ellipse((308, 160, 330, 188), fill=(238, 234, 222, 255), outline=INK, width=4)

    # White porcelain toilet bowl & dark varnished walnut oval toilet seat!
    d.ellipse((104, 156, 296, 368), fill=(236, 236, 232, 255), outline=INK, width=7)
    d.ellipse((118, 170, 282, 352), fill=(118, 74, 42, 255), outline=INK, width=6)
    d.ellipse((146, 196, 254, 326), fill=(226, 232, 236, 255), outline=INK, width=5)
    # Clear cool water inside bowl
    d.ellipse((164, 222, 236, 306), fill=(162, 202, 218, 240), outline=(112, 154, 174, 195), width=3)
    # Brass seat hinges
    for hx in (156, 232):
        d.rectangle((hx, 164, hx + 16, 184), fill=(208, 168, 82, 255), outline=INK, width=3)

    # Toilet paper roll resting on brass wall bracket on left side!
    d.rounded_rectangle((40, 210, 84, 266), radius=10, fill=(242, 238, 228, 255), outline=INK, width=5)
    d.line([(44, 226), (80, 226)], fill=(182, 176, 164, 160), width=3)

    return finish_sprite(im, 240, 288, seed=909, grain=7.5)


# ---------------------------------------------------------------------------
# 10. FOLDING WOODEN INDOOR CLOTHESLINE DRYING RACK
# ---------------------------------------------------------------------------
def gen_clothesline_drying_rack() -> Image.Image:
    W, H = 700, 420
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(1010)

    # Wooden folding frame rails & cross dowels
    d.rounded_rectangle((36, 48, W - 36, H - 48), radius=10, fill=(0, 0, 0, 0), outline=INK, width=16)
    d.rounded_rectangle((42, 54, W - 42, H - 54), radius=8, fill=(0, 0, 0, 0), outline=(156, 114, 70, 255), width=10)
    for dy in (122, 210, 298):
        d.line([(46, dy), (W - 46, dy)], fill=INK, width=14)
        d.line([(46, dy), (W - 46, dy)], fill=(176, 134, 86, 255), width=8)

    # Draped drying garments hung across the wooden dowels!
    hung = [
        # (cx, cy, w, h, rot, color, stripes)
        (165, 134, 148, 112, -0.05, (232, 224, 208, 255), False),   # damp cream shirt
        (365, 128, 164, 108, 0.04, (92, 128, 144, 255), True),      # striped blue towel
        (554, 132, 118, 104, -0.06, (176, 78, 72, 255), False),     # crimson blouse
        (210, 282, 182, 118, 0.05, (212, 178, 118, 255), True),     # ochre linen bedsheet
        (430, 288, 136, 106, -0.04, (84, 96, 82, 255), False),      # olive work shirt
    ]
    for cx, cy, gw, gh, rot, col, has_stripe in hung:
        pts = draw_rect_rot(d, cx, cy, gw, gh, rot, col, outline=INK, width=6)
        dark = tuple(max(0, c - 36) for c in col[:3]) + (175,)
        lite = tuple(min(255, c + 30) for c in col[:3]) + (130,)
        # Soft fabric fold ripples
        for fx in (-gw * 0.25, 0, gw * 0.25):
            d.line([(cx + fx, cy - gh * 0.42), (cx + fx + 4, cy + gh * 0.42)], fill=dark, width=5)
            d.line([(cx + fx + 8, cy - gh * 0.38), (cx + fx + 10, cy + gh * 0.38)], fill=lite, width=4)
        if has_stripe:
            d.line([(cx - gw * 0.44, cy), (cx + gw * 0.44, cy)], fill=(238, 234, 224, 210), width=10)
        # Tiny wooden clothespins clipped along the dowel!
        for px in (cx - gw * 0.3, cx + gw * 0.3):
            draw_rect_rot(d, px, cy - gh * 0.46, 12, 26, rot, (194, 152, 92, 255), outline=INK, width=3)

    # Pair of mismatched socks clipped on bottom-right rail!
    draw_blob(d, 558, 294, 24, 42, 0.1, (192, 72, 68, 255), rng, steps=12, amp=0.12, width=5)
    draw_blob(d, 616, 296, 24, 40, -0.15, (64, 96, 136, 255), rng, steps=12, amp=0.12, width=5)

    return finish_sprite(im, 390, 234, seed=1010, grain=9.5)


SPECS = [
    ("apt_unmade_messy_bed.png", "Unmade Messy Tenement Bed", gen_unmade_messy_bed, ["cc0", "apartment", "bed", "messy", "bedroom", "tenement", "lived_in"], 210, True, "#8A4038"),
    ("apt_dirty_laundry_pile.png", "Dirty Laundry Pile & Tipped Basket", gen_dirty_laundry_pile, ["cc0", "apartment", "laundry", "clothes", "messy", "clutter", "bedroom"], 250, True, "#7C6458"),
    ("apt_scattered_newspapers.png", "Scattered Newspapers & Unpaid Bills", gen_scattered_newspapers, ["cc0", "apartment", "newspaper", "paper", "clutter", "messy", "decal"], 260, False, "#D8CEB4"),
    ("apt_dirty_dishes_sink.png", "Dirty Dishes Kitchen Sink Counter", gen_dirty_dishes_sink, ["cc0", "apartment", "kitchen", "sink", "dishes", "messy", "counter"], 220, True, "#886D52"),
    ("apt_overflowing_trash_bin.png", "Overflowing Apartment Trash Bin", gen_overflowing_trash_bin, ["cc0", "apartment", "trash", "garbage", "bin", "messy", "clutter"], 260, True, "#888C92"),
    ("apt_cardboard_moving_boxes.png", "Half-Unpacked Moving Boxes Cluster", gen_cardboard_moving_boxes, ["cc0", "apartment", "boxes", "moving", "cardboard", "clutter", "messy"], 240, True, "#B48A5A"),
    ("apt_tangled_aether_wires.png", "Tangled Aether Wires & Gear Mess", gen_tangled_aether_wires, ["cc0", "apartment", "magipunk", "wires", "gears", "tinkerer", "messy", "clutter"], 250, False, "#728A96"),
    ("apt_messy_coffee_table.png", "Messy Takeout & Coffee Table", gen_messy_coffee_table, ["cc0", "apartment", "table", "coffee", "takeout", "messy", "living_room"], 240, True, "#8E6440"),
    ("apt_toilet_wc_stall.png", "Vintage Berlin Pull-Chain Toilet (WC)", gen_toilet_wc_stall, ["cc0", "apartment", "toilet", "wc", "bathroom", "washroom", "tenement"], 250, True, "#C8D0D4"),
    ("apt_clothesline_drying_rack.png", "Indoor Folding Clothes Drying Rack", gen_clothesline_drying_rack, ["cc0", "apartment", "laundry", "drying_rack", "clothes", "lived_in", "messy"], 240, True, "#A8947C"),
]


def make_qa_sheet(entries):
    cols = 5
    rows = 2
    cell = 260
    pad = 14
    sheet = Image.new("RGB", (cols * cell + (cols + 1) * pad, rows * cell + (rows + 1) * pad), (22, 26, 34))
    draw = ImageDraw.Draw(sheet)
    for idx, (fname, im) in enumerate(entries):
        r, c = divmod(idx, cols)
        x0 = pad + c * (cell + pad)
        y0 = pad + r * (cell + pad)
        for ty in range(0, cell, 16):
            for tx in range(0, cell, 16):
                col = (34, 40, 52) if ((tx // 16 + ty // 16) % 2 == 0) else (48, 56, 70)
                draw.rectangle([x0 + tx, y0 + ty, x0 + min(cell, tx + 16) - 1, y0 + min(cell, ty + 16) - 1], fill=col)
        iw, ih = im.size
        s = min((cell - 24) / iw, (cell - 38) / ih)
        nw, nh = max(8, int(iw * s)), max(8, int(ih * s))
        thumb = im.resize((nw, nh), Image.Resampling.LANCZOS)
        sheet.paste(thumb, (x0 + (cell - nw) // 2, y0 + (cell - 22 - nh) // 2), thumb)
        draw.rectangle([x0, y0 + cell - 22, x0 + cell - 1, y0 + cell - 1], fill=(14, 18, 24))
        draw.text((x0 + 6, y0 + cell - 17), fname.replace(".png", ""), fill=(235, 240, 248))
    sheet.save(QA_PATH, format="PNG")
    print(f"QA sheet written -> {QA_PATH}")


def main():
    print("Generating 10 clean-room Messy Apartment CC0 props...")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assets: list[dict] = manifest.get("assets", [])
    by_path = {a["path"]: i for i, a in enumerate(assets)}
    rendered = []

    for fname, disp, gen_fn, tags, ppi, casts_shadow, dom_hex in SPECS:
        im = gen_fn()
        out_path = OUT_DIR / fname
        im.save(out_path, format="PNG", optimize=True)
        w, h = im.size
        rel_path = f"props/messy_apartment/{fname}"
        entry = {
            "path": rel_path,
            "displayName": disp,
            "category": "object",
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
        rendered.append((fname, im))
        print(f"  OK: {rel_path:48s} -> {w}x{h}")

    make_qa_sheet(rendered)
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

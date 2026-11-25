#!/usr/bin/env python3
"""
Clean-room generates 9 charming hand-inked painterly top-down "Working-Class Neighborhood
Pocket Park" CC0 props at 2x supersampled resolution with crisp charcoal ink linework,
warm gouache shading, subtle organic grain, and zero white halos, registers them in
`public/assets/modular-suite-cc0/manifest.json`, rebuilds `DiceChaos_Modular_Suite_CC0.dcpack`,
and renders a dark-checkerboard QA sheet (`scratch/neighborhood_park_qa.png`).
"""

from __future__ import annotations

import json
import math
import random
import zipfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MODULAR_DIR = ROOT / "public" / "assets" / "modular-suite-cc0"
OUT_DIR = MODULAR_DIR / "props" / "neighborhood_park"
MANIFEST_PATH = MODULAR_DIR / "manifest.json"
DCPACK_PATH = ROOT / "public" / "assets" / "DiceChaos_Modular_Suite_CC0.dcpack"
QA_PATH = Path(r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch\neighborhood_park_qa.png")

OUT_DIR.mkdir(parents=True, exist_ok=True)
QA_PATH.parent.mkdir(parents=True, exist_ok=True)

INK = (26, 21, 18, 255)


def painter_grain(img: Image.Image, seed: int, strength: float = 10.0) -> Image.Image:
    arr = np.array(img, dtype=np.float32)
    h, w, _ = arr.shape
    rng = np.random.default_rng(seed)
    small = rng.normal(0.0, 1.0, (max(4, h // 10), max(4, w // 10))).astype(np.float32)
    mottle = (
        np.array(
            Image.fromarray(((small * 0.25 + 0.5).clip(0, 1) * 255).astype(np.uint8)).resize(
                (w, h), Image.Resampling.BICUBIC
            ),
            dtype=np.float32,
        )
        / 255.0
        - 0.5
    )
    fine = rng.normal(0.0, 0.35, (h, w)).astype(np.float32)
    delta = (mottle * 1.45 + fine) * strength
    alpha_mask = (arr[:, :, 3] > 20).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    grad = ((0.5 - xx / max(1, w)) * 0.55 + (0.5 - yy / max(1, h)) * 0.65) * (strength * 1.05)
    for c in range(3):
        arr[:, :, c] = np.clip(arr[:, :, c] + (delta + grad) * alpha_mask, 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def finish(im: Image.Image, w: int, h: int, seed: int, grain: float = 9.5) -> Image.Image:
    return painter_grain(im.resize((w, h), Image.Resampling.LANCZOS), seed=seed, grain_or_s=None, strength=grain) if False else painter_grain(im.resize((w, h), Image.Resampling.LANCZOS), seed=seed, strength=grain)


def draw_ink_poly(d: ImageDraw.ImageDraw, pts, fill, outline=INK, width=5):
    d.polygon(pts, fill=fill)
    if outline and width > 0:
        d.line(list(pts) + [pts[0]], fill=outline, width=width, joint="curve")


def draw_blob(d, cx, cy, rx, ry, rot, fill, rng, steps=18, amp=0.13, outline=INK, width=5):
    pts = []
    for i in range(steps):
        a = (i / steps) * math.tau
        rj = 1.0 + rng.uniform(-amp, amp)
        lx, ly = math.cos(a) * rx * rj, math.sin(a) * ry * rj
        pts.append((cx + lx * math.cos(rot) - ly * math.sin(rot), cy + lx * math.sin(rot) + ly * math.cos(rot)))
    draw_ink_poly(d, pts, fill=fill, outline=outline, width=width)
    return pts


def draw_rect_rot(d, cx, cy, w, h, rot, fill, outline=INK, width=5):
    hw, hh = w * 0.5, h * 0.5
    c, s = math.cos(rot), math.sin(rot)
    pts = [(cx + lx * c - ly * s, cy + lx * s + ly * c) for lx, ly in ((-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh))]
    draw_ink_poly(d, pts, fill=fill, outline=outline, width=width)
    return pts


# ---------------------------------------------------------------------------
# 1. WOODEN TWO-SEAT SWING SET (over scuffed dirt patch, one swing tilted!)
# ---------------------------------------------------------------------------
def gen_wooden_swing_set() -> Image.Image:
    W, H = 760, 440
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(1101)

    # Worn sandy-earth foot-scuff patches directly beneath the two swing seats!
    draw_blob(d, 265, 232, 92, 132, 0.06, (132, 108, 78, 145), rng, steps=20, amp=0.14, outline=None, width=0)
    draw_blob(d, 495, 224, 92, 132, -0.05, (132, 108, 78, 145), rng, steps=20, amp=0.14, outline=None, width=0)

    # A-frame angled weathered timber legs on left & right (seen straight down as X-splayed beams!)
    for lx in (106, W - 106):
        # Upper and lower splayed legs meeting at center top crossbeam
        d.line([(lx - 42, 74), (lx + 22, H - 74)], fill=INK, width=30)
        d.line([(lx - 42, 74), (lx + 22, H - 74)], fill=(122, 86, 54, 255), width=20)
        d.line([(lx + 42, 74), (lx - 22, H - 74)], fill=INK, width=30)
        d.line([(lx + 42, 74), (lx - 22, H - 74)], fill=(138, 98, 62, 255), width=20)
        # Footing iron stake caps
        for fx, fy in ((lx - 42, 74), (lx + 42, 74), (lx - 22, H - 74), (lx + 22, H - 74)):
            d.ellipse((fx - 14, fy - 14, fx + 14, fy + 14), fill=(72, 76, 82, 255), outline=INK, width=4)

    # Two suspended wooden plank swings (left hanging centered, right slightly swung forward!)
    # Swing 1 (left, x = 268)
    d.line([(218, 220), (218, 286)], fill=(68, 72, 78, 255), width=8)
    d.line([(318, 220), (318, 286)], fill=(68, 72, 78, 255), width=8)
    draw_rect_rot(d, 268, 288, 118, 44, -0.05, (162, 114, 68, 255), outline=INK, width=6)
    # Chipped green paint strip on seat
    draw_rect_rot(d, 268, 288, 100, 14, -0.05, (76, 116, 86, 195), outline=None, width=0)

    # Swing 2 (right, x = 492, gently swinging slightly North!)
    d.line([(442, 220), (446, 152)], fill=(68, 72, 78, 255), width=8)
    d.line([(542, 220), (546, 152)], fill=(68, 72, 78, 255), width=8)
    draw_rect_rot(d, 496, 150, 118, 44, 0.08, (158, 108, 64, 255), outline=INK, width=6)
    draw_rect_rot(d, 496, 150, 100, 14, 0.08, (152, 66, 56, 195), outline=None, width=0)

    # Heavy horizontal top timber crossbeam running cleanly across the top!
    d.rounded_rectangle((62, 196, W - 62, 244), radius=12, fill=(144, 102, 64, 255), outline=INK, width=7)
    d.line([(76, 210), (W - 76, 210)], fill=(184, 140, 92, 175), width=5)
    # Iron bracket straps & chain eye-hooks
    for bx in (106, W - 106):
        d.rectangle((bx - 18, 192, bx + 18, 248), fill=(72, 78, 86, 255), outline=INK, width=5)
    for hx in (218, 318, 442, 542):
        d.ellipse((hx - 11, 209, hx + 11, 231), fill=(186, 152, 78, 255), outline=INK, width=4)

    return finish(im, 420, 244, seed=1101, grain=9.5)


# ---------------------------------------------------------------------------
# 2. PAINTED WOODEN SEESAW / TEETER-TOTTER
# ---------------------------------------------------------------------------
def gen_wooden_seesaw() -> Image.Image:
    W, H = 720, 260
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(1102)

    # Subtle ground shadow / fulcrum base blocks
    d.rounded_rectangle((318, 46, 402, 214), radius=10, fill=(92, 74, 58, 255), outline=INK, width=7)
    d.rectangle((344, 58, 376, 202), fill=(72, 76, 84, 255), outline=INK, width=5)

    # Long weathered painted wooden seesaw plank (faded red & mustard stripes!)
    d.rounded_rectangle((46, 92, W - 46, 168), radius=14, fill=(168, 72, 62, 255), outline=INK, width=7)
    # Mustard yellow seat zones at each end + scuffed wood grain
    d.rounded_rectangle((56, 100, 186, 160), radius=8, fill=(208, 164, 72, 255), outline=INK, width=4)
    d.rounded_rectangle((W - 186, 100, W - 56, 160), radius=8, fill=(208, 164, 72, 255), outline=INK, width=4)
    d.line([(194, 114), (W - 194, 114)], fill=(206, 106, 88, 165), width=5)
    # Center iron pivot clamp
    d.rectangle((334, 88, 386, 172), fill=(76, 82, 90, 255), outline=INK, width=6)
    for rx in (348, 372):
        for ry in (106, 154):
            d.ellipse((rx - 6, ry - 6, rx + 6, ry + 6), fill=(196, 164, 88, 255), outline=INK, width=2)
    # Curved iron loop handlebars near each seat!
    for hx in (198, W - 198):
        d.rounded_rectangle((hx - 12, 82, hx + 12, 178), radius=8, fill=(58, 62, 68, 255), outline=INK, width=5)
        d.line([(hx, 90), (hx, 170)], fill=(128, 134, 142, 190), width=4)

    return finish(im, 400, 144, seed=1102, grain=9.0)


# ---------------------------------------------------------------------------
# 3. KIDS' NEIGHBORHOOD SANDBOX (sandcastle, red bucket, shovel, ball!)
# ---------------------------------------------------------------------------
def gen_kids_sandbox() -> Image.Image:
    W, H = 560, 560
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(1103)

    # Patchwork timber perimeter walls with corner sitting ledges
    d.rounded_rectangle((36, 36, W - 36, H - 36), radius=14, fill=(138, 96, 58, 255), outline=INK, width=8)
    # Warm golden sunlit sandbox interior
    d.rectangle((86, 86, W - 86, H - 86), fill=(224, 198, 142, 255), outline=INK, width=6)
    # Soft sand mounds & digging hollows
    draw_blob(d, 220, 210, 88, 72, 0.2, (236, 212, 158, 220), rng, steps=18, amp=0.12, outline=None, width=0)
    draw_blob(d, 355, 345, 76, 62, -0.3, (198, 168, 114, 200), rng, steps=16, amp=0.14, outline=None, width=0)
    # Corner triangular timber sitting seats
    for tri in (
        [(40, 40), (156, 40), (40, 156)],
        [(W - 40, 40), (W - 156, 40), (W - 40, 156)],
        [(40, H - 40), (156, H - 40), (40, H - 156)],
        [(W - 40, H - 40), (W - 156, H - 40), (W - 40, H - 156)],
    ):
        draw_ink_poly(d, tri, fill=(158, 114, 72, 255), outline=INK, width=6)

    # Charming crooked kids' sandcastle (center-left) with 4 tiny corner sand turrets & twig flag!
    draw_blob(d, 224, 214, 62, 58, 0.15, (206, 176, 122, 255), rng, steps=16, amp=0.08, outline=(138, 112, 74, 220), width=5)
    for tx, ty in ((184, 178), (264, 182), (186, 250), (262, 248)):
        d.ellipse((tx - 18, ty - 18, tx + 18, ty + 18), fill=(218, 190, 134, 255), outline=(128, 102, 66, 220), width=4)
    d.ellipse((202, 192, 246, 236), fill=(228, 204, 148, 255), outline=(134, 108, 72, 220), width=4)
    # Little red paper flag on a twig
    d.polygon([(224, 214), (254, 196), (252, 220)], fill=(192, 58, 52, 255), outline=INK, width=3)

    # Bright red tin toy pail (lower-right) & wooden sand shovel!
    d.ellipse((340, 326, 408, 394), fill=(192, 56, 52, 255), outline=INK, width=6)
    d.ellipse((354, 340, 394, 380), fill=(124, 36, 34, 255), outline=INK, width=4)
    # Toy wooden shovel
    draw_rect_rot(d, 306, 374, 76, 16, -0.45, (166, 122, 72, 255), outline=INK, width=4)
    draw_blob(d, 266, 392, 26, 18, -0.45, (74, 128, 168, 255), rng, steps=12, amp=0.08, width=5)
    # Colorful striped rubber play ball (upper-right)
    d.ellipse((356, 152, 424, 220), fill=(224, 184, 68, 255), outline=INK, width=6)
    d.pieslice((356, 152, 424, 220), start=-30, end=70, fill=(68, 134, 176, 255), outline=INK, width=4)
    d.pieslice((356, 152, 424, 220), start=140, end=230, fill=(196, 68, 58, 255), outline=INK, width=4)

    return finish(im, 320, 320, seed=1103, grain=9.0)


# ---------------------------------------------------------------------------
# 4. COMMUNITY VEGETABLE GARDEN RAISED BED (tomatoes, cabbages, pumpkin, watering can)
# ---------------------------------------------------------------------------
def gen_community_garden_bed() -> Image.Image:
    W, H = 740, 440
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(1104)

    # Patched salvaged-plank wooden raised garden frame
    d.rounded_rectangle((32, 36, W - 32, H - 36), radius=10, fill=(128, 92, 58, 255), outline=INK, width=8)
    # Rich dark tilled compost earth inside
    d.rectangle((66, 70, W - 66, H - 70), fill=(72, 52, 38, 255), outline=INK, width=6)
    # Tilled soil furrows
    for fy in range(106, H - 80, 42):
        d.line([(76, fy), (W - 76, fy)], fill=(54, 38, 28, 180), width=6)

    # Left section: Ripe red tomato vines on wooden stakes!
    for cx, cy in ((146, 154), (222, 166), (154, 276), (236, 284)):
        draw_blob(d, cx, cy, 52, 46, rng.uniform(0, 3), (62, 108, 54, 255), rng, steps=14, amp=0.22, width=5)
        draw_blob(d, cx + 6, cy - 4, 36, 32, rng.uniform(0, 3), (84, 134, 66, 235), rng, steps=12, amp=0.2, outline=None, width=0)
        # Wooden stake top
        d.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=(154, 114, 72, 255), outline=INK, width=3)
        # Bright cherry/roma tomatoes peeking out!
        for _ in range(3):
            tx, ty = cx + rng.randint(-28, 28), cy + rng.randint(-24, 24)
            d.ellipse((tx - 11, ty - 11, tx + 11, ty + 11), fill=(198, 48, 42, 255), outline=INK, width=3)
            d.ellipse((tx - 5, ty - 5, tx, ty), fill=(244, 146, 128, 200))

    # Center section: Lush leafy cabbages & feathery carrot tops!
    for cx, cy in ((354, 156), (446, 162), (362, 274)):
        draw_blob(d, cx, cy, 46, 44, rng.uniform(0, 3), (78, 128, 72, 255), rng, steps=14, amp=0.16, width=5)
        draw_blob(d, cx, cy, 32, 30, rng.uniform(0, 3), (118, 164, 98, 255), rng, steps=12, amp=0.14, width=4)
        draw_blob(d, cx, cy, 18, 18, 0, (166, 196, 134, 255), rng, steps=10, amp=0.1, width=3)
    # Carrot row tufts
    for cx in (436, 468, 498):
        draw_blob(d, cx, 286, 18, 16, rng.uniform(0, 3), (92, 148, 68, 255), rng, steps=10, amp=0.24, width=3)
        d.ellipse((cx - 7, 279, cx + 7, 293), fill=(218, 118, 44, 255), outline=INK, width=2)

    # Right section: Plump orange neighborhood pumpkin + galvanized tin watering can resting on the wood rim!
    draw_blob(d, 586, 198, 58, 52, 0.2, (70, 112, 54, 255), rng, steps=14, amp=0.2, width=5)
    draw_blob(d, 582, 204, 44, 40, 0.1, (218, 124, 42, 255), rng, steps=14, amp=0.08, width=5)
    for k in range(6):
        a = (k / 6) * math.tau
        d.line([(582, 204), (582 + math.cos(a) * 38, 204 + math.sin(a) * 34)], fill=(156, 78, 24, 175), width=3)
    d.ellipse((574, 196, 590, 212), fill=(84, 108, 52, 255), outline=INK, width=3)

    # Dented galvanized watering can perched on bottom-right corner
    d.line([(574, 336), (626, 302)], fill=(138, 148, 156, 255), width=14)
    d.line([(574, 336), (626, 302)], fill=INK, width=5)
    d.ellipse((602, 292, 668, 358), fill=(154, 164, 172, 255), outline=INK, width=6)
    d.ellipse((616, 306, 654, 344), fill=(98, 124, 138, 255), outline=INK, width=4)

    return finish(im, 410, 244, seed=1104, grain=9.5)


# ---------------------------------------------------------------------------
# 5. COZY PLAID PICNIC BLANKET & WICKER BASKET
# ---------------------------------------------------------------------------
def gen_picnic_blanket_basket() -> Image.Image:
    W, H = 640, 560
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(1105)

    # Slightly rumpled plaid woven cotton blanket spread on the grass
    pts = [
        (74, 72), (558, 86), (576, 478), (82, 488),
    ]
    pts_w = []
    for i in range(4):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % 4]
        for k in range(4):
            t = k / 4.0
            pts_w.append((x0 + (x1 - x0) * t + rng.uniform(-7, 7), y0 + (y1 - y0) * t + rng.uniform(-7, 7)))
    draw_ink_poly(d, pts_w, fill=(228, 216, 192, 255), outline=INK, width=7)

    # Plaid red & navy gingham stripes clipped to blanket
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(pts_w, fill=255)
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for x in range(86, 570, 68):
        od.rectangle((x, 40, x + 28, H - 40), fill=(176, 64, 58, 145))
        od.line([(x + 48, 40), (x + 48, H - 40)], fill=(54, 78, 108, 155), width=6)
    for y in range(86, 490, 68):
        od.rectangle((40, y, W - 40, y + 28), fill=(176, 64, 58, 145))
        od.line([(40, y + 48), (W - 40, y + 48)], fill=(54, 78, 108, 155), width=6)
    im.paste(ov, (0, 0), mask)
    d.line(pts_w + [pts_w[0]], fill=INK, width=7, joint="curve")

    # Wicker picnic basket with red cloth lining (upper-left)
    draw_rect_rot(d, 206, 206, 156, 118, -0.18, (176, 134, 82, 255), outline=INK, width=7)
    draw_rect_rot(d, 206, 206, 122, 88, -0.18, (186, 68, 62, 255), outline=INK, width=4)
    # Basket handle strap across center
    draw_rect_rot(d, 206, 206, 152, 22, -0.18, (152, 108, 58, 255), outline=INK, width=5)

    # Shared sandwich plate, red apples, two enamel mugs & open paperback!
    d.ellipse((328, 222, 444, 338), fill=(238, 234, 222, 255), outline=INK, width=6)
    # Crusty bread sandwiches & bright apples
    draw_rect_rot(d, 372, 266, 48, 36, 0.3, (206, 158, 92, 255), outline=INK, width=4)
    draw_rect_rot(d, 404, 296, 46, 34, -0.4, (206, 158, 92, 255), outline=INK, width=4)
    for ax, ay in ((472, 184), (498, 208)):
        d.ellipse((ax - 16, ay - 16, ax + 16, ay + 16), fill=(198, 54, 48, 255), outline=INK, width=4)
    for mx, my, mcol in ((316, 396, (76, 124, 152, 255)), (458, 374, (218, 174, 76, 255))):
        d.ellipse((mx - 24, my - 24, mx + 24, my + 24), fill=mcol, outline=INK, width=5)
        d.ellipse((mx - 14, my - 14, mx + 14, my + 14), fill=(96, 62, 38, 230))
    # Open paperback book on lower-left corner
    draw_rect_rot(d, 198, 384, 96, 72, 0.28, (242, 236, 220, 255), outline=INK, width=5)

    return finish(im, 350, 306, seed=1105, grain=9.0)


# ---------------------------------------------------------------------------
# 6. RETIREES' CONCRETE CHESS PARK TABLE & STOOLS
# ---------------------------------------------------------------------------
def gen_concrete_chess_table() -> Image.Image:
    W, H = 640, 440
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Two weathered round concrete-and-timber stools flanking left & right
    for sx in (104, W - 104):
        d.ellipse((sx - 66, H // 2 - 66, sx + 66, H // 2 + 66), fill=(144, 146, 142, 255), outline=INK, width=7)
        d.ellipse((sx - 50, H // 2 - 50, sx + 50, H // 2 + 50), fill=(154, 114, 72, 255), outline=INK, width=5)
        d.line([(sx - 44, H // 2), (sx + 44, H // 2)], fill=(96, 68, 40, 175), width=4)

    # Scuffed cast-concrete square tabletop (center)
    d.rounded_rectangle((196, 66, W - 196, H - 66), radius=18, fill=(166, 168, 162, 255), outline=INK, width=8)
    # Inlaid 8x8 chess board!
    bx0, by0, bsz = 236, 106, 168
    cell = bsz // 8
    d.rectangle((bx0 - 6, by0 - 6, bx0 + bsz + 6, by0 + bsz + 6), fill=(72, 68, 64, 255), outline=INK, width=4)
    for r in range(8):
        for c in range(8):
            col = (228, 222, 206, 255) if (r + c) % 2 == 0 else (58, 62, 66, 255)
            d.rectangle((bx0 + c * cell, by0 + r * cell, bx0 + (c + 1) * cell, by0 + (r + 1) * cell), fill=col)
    # Mid-game wooden white & dark chess pieces scattered across the squares!
    pieces = [
        (1, 1, True), (2, 3, True), (4, 2, True), (6, 4, True), (3, 5, True),
        (5, 6, False), (7, 5, False), (2, 6, False), (4, 4, False), (6, 2, False),
    ]
    for r, c, is_w in pieces:
        px = bx0 + c * cell + cell // 2
        py = by0 + r * cell + cell // 2
        pcol = (242, 232, 206, 255) if is_w else (52, 42, 38, 255)
        d.ellipse((px - 7, py - 7, px + 7, py + 7), fill=pcol, outline=INK, width=2)
    # Enamel coffee cup on table corner
    d.ellipse((W - 238, 76, W - 204, 110), fill=(182, 74, 66, 255), outline=INK, width=4)
    d.ellipse((W - 230, 84, W - 212, 102), fill=(88, 56, 36, 255))

    return finish(im, 360, 248, seed=1106, grain=9.5)


# ---------------------------------------------------------------------------
# 7. PASTEL CHALK HOPSCOTCH COURT (transparent ground decal!)
# ---------------------------------------------------------------------------
def gen_chalk_hopscotch_court() -> Image.Image:
    W, H = 760, 340
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(1107)

    def chalk_rect(x0, y0, x1, y1, col):
        # Double jittered pastel chalk stroke!
        for _ in range(3):
            j = [(x0 + rng.uniform(-3, 3), y0 + rng.uniform(-3, 3)),
                 (x1 + rng.uniform(-3, 3), y0 + rng.uniform(-3, 3)),
                 (x1 + rng.uniform(-3, 3), y1 + rng.uniform(-3, 3)),
                 (x0 + rng.uniform(-3, 3), y1 + rng.uniform(-3, 3))]
            d.line(j + [j[0]], fill=col, width=7)

    # Classic horizontal hopscotch layout: [1] [2] [3] [4/5] [6] [7/8] [9/10 semicircle!]
    cy = H // 2
    s = 78
    # Subtle dusty chalk fills + crisp pastel outlines
    squares = [
        (54, cy - s // 2, (242, 236, 212, 215)),
        (54 + s, cy - s // 2, (162, 214, 242, 215)),
        (54 + 2 * s, cy - s // 2, (246, 174, 188, 215)),
        (54 + 3 * s, cy - s, (248, 224, 134, 215)),
        (54 + 3 * s, cy, (172, 230, 176, 215)),
        (54 + 4 * s, cy - s // 2, (214, 182, 242, 215)),
        (54 + 5 * s, cy - s, (246, 174, 188, 215)),
        (54 + 5 * s, cy, (162, 214, 242, 215)),
    ]
    for x0, y0, col in squares:
        d.rectangle((x0 + 4, y0 + 4, x0 + s - 4, y0 + s - 4), fill=(col[0], col[1], col[2], 54))
        chalk_rect(x0, y0, x0 + s, y0 + s, col)
    # Ending half-circle "10" home arc!
    x_end = 54 + 6 * s
    d.pieslice((x_end - s, cy - s, x_end + s, cy + s), start=-90, end=90, fill=(248, 224, 134, 58), outline=(248, 224, 134, 220), width=7)
    # Flat grey throwing pebble sitting in box 4 + cute chalk daisy doodle!
    draw_blob(d, 54 + 3 * s + 38, cy - 38, 16, 13, 0.3, (124, 128, 132, 255), rng, steps=10, amp=0.14, width=4)
    # Little yellow chalk flower beside the court
    fx, fy = 156, 62
    for k in range(6):
        a = (k / 6) * math.tau
        d.ellipse((fx + math.cos(a) * 16 - 9, fy + math.sin(a) * 16 - 9, fx + math.cos(a) * 16 + 9, fy + math.sin(a) * 16 + 9), outline=(246, 184, 198, 200), width=4)
    d.ellipse((fx - 8, fy - 8, fx + 8, fy + 8), fill=(248, 224, 134, 210))

    return finish(im, 420, 188, seed=1107, grain=12.0)


# ---------------------------------------------------------------------------
# 8. WEATHERED GREEN BERLIN NEIGHBORHOOD PARK BENCH
# ---------------------------------------------------------------------------
def gen_worn_park_bench() -> Image.Image:
    W, H = 640, 280
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Wrought-iron end armrest scrolls & dark iron support straps
    for ax in (52, W - 78):
        d.rounded_rectangle((ax, 44, ax + 26, H - 44), radius=10, fill=(46, 52, 58, 255), outline=INK, width=6)
    # 5 weathered green-painted wooden slats (backrest + seat!) with chipped paint showing warm wood!
    slat_ys = [52, 88, 134, 174, 214]
    for idx, sy in enumerate(slat_ys):
        col = (68, 108, 82, 255) if idx < 2 else (78, 122, 92, 255)
        d.rounded_rectangle((68, sy, W - 68, sy + 30), radius=6, fill=col, outline=INK, width=5)
        # Subtle worn bare-wood scuff near center of seat slats
        if idx >= 2:
            d.rounded_rectangle((220 + idx * 14, sy + 7, 360 + idx * 10, sy + 23), radius=4, fill=(142, 112, 76, 135))
        # Iron bolt heads along support straps
        for bx in (132, W - 132):
            d.ellipse((bx - 5, sy + 10, bx + 5, sy + 20), fill=(42, 46, 50, 255))

    return finish(im, 360, 158, seed=1108, grain=10.0)


# ---------------------------------------------------------------------------
# 9. CAST-IRON NEIGHBORHOOD HAND-PUMP WATER SPIGOT & SPLASH BASIN
# ---------------------------------------------------------------------------
def gen_iron_water_pump() -> Image.Image:
    W, H = 440, 440
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    rng = random.Random(1109)

    # Mossy octagonal flagstone base & wet puddle splash grate
    draw_blob(d, 220, 232, 158, 148, 0.1, (124, 128, 124, 255), rng, steps=10, amp=0.04, width=7)
    # Moss tufts around stone base
    for mx, my in ((110, 155), (326, 285), (156, 336)):
        draw_blob(d, mx, my, 28, 22, rng.uniform(0, 3), (78, 114, 62, 235), rng, steps=10, amp=0.2, outline=None, width=0)
    # Recessed wet iron splash grate & cool puddle
    d.rounded_rectangle((146, 228, 294, 338), radius=14, fill=(68, 98, 112, 255), outline=INK, width=6)
    for gx in range(166, 286, 22):
        d.line([(gx, 234), (gx, 332)], fill=(44, 48, 52, 255), width=7)

    # Classic dark-green cast-iron Berlin street hand-pump column & curved lever handle!
    d.ellipse((166, 102, 274, 210), fill=(52, 82, 68, 255), outline=INK, width=7)
    d.ellipse((188, 124, 252, 188), fill=(68, 104, 86, 255), outline=INK, width=5)
    # Brass finial dome on top of pump
    d.ellipse((202, 138, 238, 174), fill=(196, 158, 78, 255), outline=INK, width=4)
    # Cast-iron spout pointing down over grate
    d.rounded_rectangle((204, 198, 236, 266), radius=8, fill=(58, 88, 74, 255), outline=INK, width=5)
    # Curved pump handle extending right
    d.line([(268, 156), (344, 156)], fill=INK, width=22)
    d.line([(268, 156), (344, 156)], fill=(66, 98, 82, 255), width=12)
    d.ellipse((332, 140, 364, 172), fill=(186, 148, 72, 255), outline=INK, width=5)

    return finish(im, 256, 256, seed=1109, grain=9.5)


SPECS = [
    ("pk_wooden_swing_set.png", "Neighborhood Wooden Swing Set", gen_wooden_swing_set, ["cc0", "park", "playground", "swing", "kids", "neighborhood", "wood"], 210, True, "#8E643E"),
    ("pk_wooden_seesaw.png", "Painted Wooden Park Seesaw", gen_wooden_seesaw, ["cc0", "park", "playground", "seesaw", "kids", "neighborhood"], 220, True, "#A8483E"),
    ("pk_kids_sandbox.png", "Neighborhood Kids Wooden Sandbox", gen_kids_sandbox, ["cc0", "park", "playground", "sandbox", "kids", "toys", "sand"], 210, True, "#D8BA7E"),
    ("pk_community_garden_bed.png", "Community Raised Vegetable Garden Bed", gen_community_garden_bed, ["cc0", "park", "garden", "vegetables", "tomatoes", "pumpkin", "community"], 210, True, "#5A8246"),
    ("pk_picnic_blanket_basket.png", "Plaid Picnic Blanket & Wicker Basket", gen_picnic_blanket_basket, ["cc0", "park", "picnic", "blanket", "basket", "food", "grass"], 220, False, "#B85C52"),
    ("pk_concrete_chess_table.png", "Neighborhood Park Concrete Chess Table", gen_concrete_chess_table, ["cc0", "park", "chess", "table", "concrete", "stools", "neighborhood"], 230, True, "#9E9E98"),
    ("pk_chalk_hopscotch_court.png", "Sidewalk Chalk Hopscotch Court", gen_chalk_hopscotch_court, ["cc0", "park", "chalk", "hopscotch", "kids", "decal", "playground"], 240, False, "#D8C89E"),
    ("pk_worn_park_bench.png", "Weathered Green Park Bench", gen_worn_park_bench, ["cc0", "park", "bench", "wood", "iron", "seating", "neighborhood"], 240, True, "#4A7458"),
    ("pk_iron_water_pump.png", "Cast-Iron Neighborhood Water Pump", gen_iron_water_pump, ["cc0", "park", "pump", "fountain", "water", "iron", "berlin"], 240, True, "#4C6A5C"),
]


def make_qa_sheet(entries):
    cols, rows = 3, 3
    cell, pad = 260, 14
    sheet = Image.new("RGB", (cols * cell + (cols + 1) * pad, rows * cell + (rows + 1) * pad), (22, 26, 34))
    draw = ImageDraw.Draw(sheet)
    for idx, (fname, im) in enumerate(entries):
        r, c = divmod(idx, cols)
        x0, y0 = pad + c * (cell + pad), pad + r * (cell + pad)
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
    print("Generating 9 clean-room Working-Class Neighborhood Park CC0 props...")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assets: list[dict] = manifest.get("assets", [])
    by_path = {a["path"]: i for i, a in enumerate(assets)}
    rendered = []

    for fname, disp, gen_fn, tags, ppi, casts_shadow, dom_hex in SPECS:
        im = gen_fn()
        out_path = OUT_DIR / fname
        im.save(out_path, format="PNG", optimize=True)
        w, h = im.size
        rel_path = f"props/neighborhood_park/{fname}"
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

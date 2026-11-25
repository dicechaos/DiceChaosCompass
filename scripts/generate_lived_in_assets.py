#!/usr/bin/env python3
"""
Generates 16 high-detail lived-in Berlin Magi-Punk interior, street-life, and
multi-level staircase CC0 PNG assets (256 PPI), merges them into
public/assets/starter-cc0/manifest.json, and rebuilds
public/assets/DiceChaos_Berlin_Magipunk_Starter.dcpack.
"""

from __future__ import annotations

import json
import math
import random
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "assets" / "starter-cc0"
DCPACK_OUT = ROOT / "public" / "assets" / "DiceChaos_Berlin_Magipunk_Starter.dcpack"

rng = random.Random(20261122)


def add_shadow(img: Image.Image, offset=(6, 8), blur=6, alpha=110) -> Image.Image:
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    a = img.split()[3]
    sh_alpha = a.point(lambda p: int(p * (alpha / 255.0)))
    sh.paste((8, 10, 16, 255), offset, sh_alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh)
    out.alpha_composite(img)
    return out


def gen_wood_interior_stairs() -> Image.Image:
    w, h = 256, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Dark stairwell recess backing
    d.rounded_rectangle((16, 12, w - 16, h - 12), radius=8, fill=(38, 25, 16, 255), outline=(22, 14, 9, 255), width=4)
    # 13 wooden stair treads with depth gradient (darker at bottom, brighter toward upper landing)
    treads = 13
    top_y, bot_y = 26, h - 26
    step_h = (bot_y - top_y) / treads
    for i in range(treads):
        y0 = int(top_y + i * step_h)
        y1 = int(top_y + (i + 1) * step_h) - 2
        # Top is upper landing (lighter warm wood), bottom descends into shadow
        t = 1.0 - (i / (treads - 1))
        r = int(86 + 68 * t)
        g = int(58 + 46 * t)
        b = int(36 + 26 * t)
        d.rectangle((28, y0, w - 28, y1), fill=(r, g, b, 255), outline=(34, 22, 14, 255), width=2)
        # Subtle worn wood plank highlight along nosing edge
        d.line([(30, y0 + 2), (w - 30, y0 + 2)], fill=(min(255, r + 24), min(255, g + 18), min(255, b + 12), 210), width=2)
        # Worn runner center scuff
        d.rectangle((w // 2 - 28, y0 + 4, w // 2 + 28, y1 - 2), fill=(max(0, r - 10), max(0, g - 8), max(0, b - 6), 110))
    # Heavy oak stringers / side handrails + newel posts
    for rx in (18, w - 34):
        d.rectangle((rx, 14, rx + 16, h - 14), fill=(96, 62, 34, 255), outline=(28, 18, 10, 255), width=2)
        d.line([(rx + 5, 18), (rx + 5, h - 18)], fill=(154, 108, 64, 210), width=2)
        for py in (22, h // 2, h - 22):
            d.rounded_rectangle((rx - 3, py - 10, rx + 19, py + 10), radius=4, fill=(118, 78, 44, 255), outline=(24, 15, 9, 255), width=2)
            d.ellipse((rx + 3, py - 5, rx + 13, py + 5), fill=(198, 156, 78, 255))
    # Subtle brass direction arrow engraved on upper landing
    d.polygon([(w // 2, 34), (w // 2 - 14, 54), (w // 2 + 14, 54)], fill=(214, 174, 88, 195), outline=(38, 26, 12, 220))
    return add_shadow(img)


def gen_brass_spiral_staircase() -> Image.Image:
    s = 320
    cx = cy = s // 2
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Outer recessed stone ring
    d.ellipse((14, 14, s - 14, s - 14), fill=(26, 30, 38, 255), outline=(188, 148, 68, 255), width=5)
    # 14 radiating pie-wedge marble & brass treads spiraling clockwise upward
    steps = 14
    rad_out = s // 2 - 22
    rad_in = 34
    for i in range(steps):
        a0 = -math.pi / 2 + (i / steps) * math.pi * 2
        a1 = -math.pi / 2 + ((i + 1) / steps) * math.pi * 2
        t = i / (steps - 1)
        # Lower steps darker Prussian marble, upper steps bright gilded cream marble
        r = int(84 + 136 * t)
        g = int(88 + 124 * t)
        b = int(96 + 98 * t)
        poly = [
            (cx + math.cos(a0) * rad_in, cy + math.sin(a0) * rad_in),
            (cx + math.cos(a0) * rad_out, cy + math.sin(a0) * rad_out),
            (cx + math.cos((a0 + a1) * 0.5) * rad_out, cy + math.sin((a0 + a1) * 0.5) * rad_out),
            (cx + math.cos(a1) * rad_out, cy + math.sin(a1) * rad_out),
            (cx + math.cos(a1) * rad_in, cy + math.sin(a1) * rad_in),
        ]
        d.polygon(poly, fill=(r, g, b, 255), outline=(34, 38, 46, 255))
        # Gold tread nosing
        d.line(
            [(cx + math.cos(a1) * (rad_in + 4), cy + math.sin(a1) * (rad_in + 4)),
             (cx + math.cos(a1) * (rad_out - 4), cy + math.sin(a1) * (rad_out - 4))],
            fill=(216, 174, 82, 235),
            width=3,
        )
    # Ornate Jugendstil curved brass outer banister with balusters
    d.arc((18, 18, s - 18, s - 18), start=-60, end=270, fill=(226, 184, 88, 255), width=7)
    for i in range(12):
        ang = -math.pi / 3 + (i / 11) * math.pi * 1.75
        bx = cx + math.cos(ang) * (rad_out + 2)
        by = cy + math.sin(ang) * (rad_out + 2)
        d.ellipse((bx - 5, by - 5, bx + 5, by + 5), fill=(244, 210, 122, 255), outline=(42, 30, 14, 255), width=2)
    # Central fluted brass column with cyan aether finial
    d.ellipse((cx - 32, cy - 32, cx + 32, cy + 32), fill=(176, 134, 54, 255), outline=(38, 28, 14, 255), width=3)
    d.ellipse((cx - 20, cy - 20, cx + 20, cy + 20), fill=(224, 184, 94, 255), outline=(64, 48, 20, 255), width=2)
    d.ellipse((cx - 10, cy - 10, cx + 10, cy + 10), fill=(96, 224, 246, 255), outline=(28, 64, 78, 255), width=2)
    return add_shadow(img)


def gen_tenement_iron_bed() -> Image.Image:
    w, h = 256, 384
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Iron bed frame
    d.rounded_rectangle((28, 22, w - 28, h - 24), radius=10, fill=(44, 48, 56, 255), outline=(20, 22, 28, 255), width=4)
    # Mattress & off-white sheet
    d.rounded_rectangle((38, 36, w - 38, h - 38), radius=8, fill=(208, 198, 178, 255), outline=(124, 114, 98, 255), width=2)
    # Rumpled pillow
    d.rounded_rectangle((54, 48, w - 54, 108), radius=16, fill=(228, 220, 204, 255), outline=(156, 146, 128, 255), width=2)
    d.line([(68, 76), (w - 68, 82)], fill=(182, 172, 154, 160), width=3)
    # Patched drab wool blanket (rust & slate patchwork)
    d.rounded_rectangle((36, 122, w - 36, h - 38), radius=8, fill=(116, 56, 46, 255), outline=(54, 24, 18, 255), width=3)
    # Folded blanket cuff
    d.rectangle((38, 122, w - 38, 150), fill=(144, 76, 58, 255))
    d.line([(38, 150), (w - 38, 150)], fill=(62, 28, 22, 220), width=3)
    # Sewn tenement patches
    d.rectangle((56, 182, 114, 240), fill=(84, 96, 108, 225), outline=(42, 48, 56, 220), width=2)
    d.rectangle((140, 252, 202, 314), fill=(138, 96, 54, 225), outline=(66, 42, 22, 220), width=2)
    # Wrought-iron headboard & footboard rails + brass knobs
    for ry in (22, h - 34):
        d.rectangle((24, ry, w - 24, ry + 12), fill=(36, 40, 48, 255), outline=(14, 16, 20, 255), width=2)
        for kx in (30, w - 30):
            d.ellipse((kx - 8, ry - 2, kx + 8, ry + 14), fill=(188, 148, 68, 255), outline=(36, 26, 12, 255), width=2)
    return add_shadow(img)


def gen_worn_dining_table() -> Image.Image:
    w, h = 384, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # 4 tucked wooden chairs
    chair_pos = [(118, 30), (266, 30), (118, h - 30), (266, h - 30)]
    for cx, cy in chair_pos:
        d.rounded_rectangle((cx - 32, cy - 22, cx + 32, cy + 22), radius=6, fill=(104, 68, 40, 255), outline=(36, 22, 12, 255), width=3)
        by = cy - 22 if cy < h // 2 else cy + 12
        d.rectangle((cx - 34, by, cx + 34, by + 10), fill=(76, 48, 26, 255), outline=(28, 16, 8, 255), width=2)
    # Heavy plank table top
    d.rounded_rectangle((46, 52, w - 46, h - 52), radius=8, fill=(122, 82, 48, 255), outline=(42, 26, 14, 255), width=4)
    for py in range(74, h - 62, 28):
        d.line([(50, py), (w - 50, py)], fill=(78, 48, 24, 210), width=2)
    # Scattered Berlin newspaper, tin plate, 2 pewter mugs & oil lamp
    d.polygon([(82, 84), (156, 76), (164, 134), (90, 142)], fill=(214, 206, 186, 255), outline=(120, 112, 96, 255))
    for ly in range(90, 128, 10):
        d.line([(94, ly), (146, ly - 4)], fill=(86, 82, 74, 200), width=2)
    # Tin plate & bread
    d.ellipse((236, 88, 290, 142), fill=(176, 182, 188, 255), outline=(66, 72, 80, 255), width=2)
    d.ellipse((248, 100, 278, 126), fill=(176, 124, 62, 255), outline=(96, 62, 28, 255), width=2)
    # Two beer steins
    for mx, my in ((204, 152), (306, 148)):
        d.ellipse((mx - 12, my - 12, mx + 12, my + 12), fill=(138, 146, 156, 255), outline=(36, 40, 48, 255), width=2)
        d.ellipse((mx - 7, my - 7, mx + 7, my + 7), fill=(218, 168, 66, 255))
    # Small brass oil lamp in center
    d.ellipse((174, 108, 210, 144), fill=(192, 150, 68, 255), outline=(46, 32, 14, 255), width=2)
    d.ellipse((183, 117, 201, 135), fill=(255, 220, 118, 255))
    return add_shadow(img)


def gen_threadbare_rug() -> Image.Image:
    w, h = 384, 256
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Fringe threads on left/right edges
    for fy in range(28, h - 28, 8):
        d.line([(12, fy), (28, fy)], fill=(184, 166, 132, 210), width=2)
        d.line([(w - 28, fy), (w - 12, fy)], fill=(184, 166, 132, 210), width=2)
    # Faded crimson woven body
    d.rectangle((28, 20, w - 28, h - 20), fill=(118, 42, 44, 240), outline=(58, 20, 22, 255), width=4)
    d.rectangle((46, 38, w - 46, h - 38), fill=(96, 36, 42, 245), outline=(176, 132, 66, 220), width=4)
    d.rectangle((66, 58, w - 66, h - 58), fill=(62, 54, 68, 230), outline=(156, 118, 64, 200), width=3)
    # Center diamond medallion
    cx, cy = w // 2, h // 2
    d.polygon([(cx, cy - 42), (cx + 68, cy), (cx, cy + 42), (cx - 68, cy)], fill=(154, 94, 48, 230), outline=(204, 166, 94, 220))
    d.polygon([(cx, cy - 22), (cx + 34, cy), (cx, cy + 22), (cx - 34, cy)], fill=(116, 42, 44, 240))
    return img


def gen_wooden_wardrobe_shelf() -> Image.Image:
    w, h = 320, 160
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((16, 20, w - 16, h - 20), radius=6, fill=(92, 58, 34, 255), outline=(32, 20, 10, 255), width=4)
    d.rectangle((26, 30, w - 26, h - 30), fill=(114, 74, 44, 255), outline=(58, 36, 20, 255), width=2)
    # Crown molding bevels & top clutter (folded linen + books + lantern)
    d.line([(26, 30), (w - 26, 30)], fill=(154, 106, 66, 220), width=3)
    # Stacked books on left
    for bx, col in ((46, (124, 42, 42, 255)), (76, (44, 74, 108, 255)), (104, (54, 92, 58, 255))):
        d.rectangle((bx, 48, bx + 26, 108), fill=col, outline=(24, 18, 14, 255), width=2)
    # Folded cloth bundle
    d.rounded_rectangle((158, 46, 232, 110), radius=8, fill=(184, 174, 152, 255), outline=(92, 84, 70, 255), width=2)
    # Brass candlestick/jar
    d.ellipse((254, 62, 286, 94), fill=(188, 146, 66, 255), outline=(44, 30, 12, 255), width=2)
    return add_shadow(img)


def gen_alchemy_worktable() -> Image.Image:
    w, h = 384, 224
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Heavy scorched dark-oak workbench
    d.rounded_rectangle((20, 24, w - 20, h - 24), radius=8, fill=(68, 48, 34, 255), outline=(24, 16, 10, 255), width=4)
    d.rectangle((32, 36, w - 32, h - 36), fill=(84, 60, 42, 255), outline=(42, 28, 18, 255), width=2)
    # Glowing emerald & cyan alembic flasks connected by copper coil tubing
    d.line([(86, 96), (144, 78), (196, 118), (258, 88)], fill=(196, 124, 66, 255), width=5)
    flasks = [
        (84, 98, 26, (56, 232, 186, 255)),
        (144, 82, 22, (74, 222, 255, 255)),
        (196, 122, 28, (168, 118, 255, 255)),
        (258, 92, 24, (86, 242, 148, 255)),
    ]
    for fx, fy, fr, col in flasks:
        d.ellipse((fx - fr - 6, fy - fr - 6, fx + fr + 6, fy + fr + 6), fill=(col[0], col[1], col[2], 60))
        d.ellipse((fx - fr, fy - fr, fx + fr, fy + fr), fill=col, outline=(220, 248, 255, 240), width=3)
        d.ellipse((fx - fr // 2, fy - fr // 2, fx + fr // 2, fy + fr // 2), fill=(224, 255, 250, 210))
    # Open arcane blueprint scroll on right side
    d.rectangle((286, 56, 348, 164), fill=(216, 206, 178, 255), outline=(92, 74, 48, 255), width=2)
    d.ellipse((302, 84, 332, 114), outline=(44, 128, 168, 230), width=2)
    d.line([(296, 134), (338, 134)], fill=(44, 128, 168, 220), width=2)
    d.line([(296, 148), (330, 148)], fill=(44, 128, 168, 220), width=2)
    # Brass mortar & glowing crystal shards on bottom-left
    d.ellipse((62, 144, 108, 182), fill=(178, 138, 62, 255), outline=(42, 30, 12, 255), width=2)
    d.polygon([(126, 152), (144, 142), (150, 170), (132, 176)], fill=(96, 238, 255, 255), outline=(24, 72, 92, 255))
    return add_shadow(img)


def gen_berlin_litfass_kiosk() -> Image.Image:
    s = 256
    cx = cy = s // 2
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Stone hexagonal plinth base
    d.ellipse((24, 24, s - 24, s - 24), fill=(72, 78, 88, 255), outline=(26, 30, 38, 255), width=4)
    # Colorful plastered poster collar (iconic Berlin Litfasssaeule!)
    poster_cols = [(214, 68, 56, 255), (236, 188, 62, 255), (62, 186, 216, 255), (232, 224, 200, 255), (156, 86, 206, 255)]
    for i in range(10):
        a0 = i * 36
        d.pieslice((34, 34, s - 34, s - 34), start=a0, end=a0 + 34, fill=poster_cols[i % len(poster_cols)], outline=(30, 34, 42, 255), width=2)
    # Ribbed verdigris-copper Jugendstil dome cap on top
    d.ellipse((46, 46, s - 46, s - 46), fill=(48, 118, 108, 255), outline=(24, 52, 48, 255), width=4)
    for i in range(8):
        ang = i * math.pi / 4
        d.line([(cx, cy), (cx + math.cos(ang) * 80, cy + math.sin(ang) * 80)], fill=(198, 162, 74, 220), width=3)
    d.ellipse((cx - 28, cy - 28, cx + 28, cy + 28), fill=(184, 146, 66, 255), outline=(38, 28, 12, 255), width=3)
    d.ellipse((cx - 12, cy - 12, cx + 12, cy + 12), fill=(116, 244, 255, 255))
    return add_shadow(img, offset=(8, 10), blur=8, alpha=130)


def gen_street_refuse_barrels() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Oil/rain puddle underneath
    d.ellipse((34, 44, 218, 224), fill=(26, 42, 56, 130))
    # Two weathered wooden barrels
    for bx, by, r in ((86, 94, 42), (168, 104, 38)):
        d.ellipse((bx - r, by - r, bx + r, by + r), fill=(112, 74, 42, 255), outline=(34, 22, 12, 255), width=4)
        d.ellipse((bx - r + 7, by - r + 7, bx + r - 7, by + r - 7), fill=(94, 62, 34, 255), outline=(56, 60, 68, 255), width=3)
        d.line([(bx - r + 14, by - 10), (bx + r - 14, by - 10)], fill=(54, 34, 18, 220), width=2)
        d.line([(bx - r + 14, by + 10), (bx + r - 14, by + 10)], fill=(54, 34, 18, 220), width=2)
    # Galvanized tin trash can with lid ajar
    d.ellipse((78, 152, 146, 220), fill=(96, 104, 116, 255), outline=(32, 36, 44, 255), width=3)
    d.ellipse((94, 162, 154, 222), fill=(122, 132, 146, 255), outline=(38, 44, 54, 255), width=3)
    d.line([(114, 192), (134, 192)], fill=(44, 48, 56, 255), width=4)
    # Wooden crate corner
    d.rectangle((158, 156, 216, 214), fill=(128, 88, 48, 255), outline=(38, 24, 12, 255), width=3)
    d.line([(158, 156), (216, 214)], fill=(68, 44, 22, 220), width=3)
    return add_shadow(img)


def gen_coal_sack_pile() -> Image.Image:
    w, h = 256, 224
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Soot dust halo
    d.ellipse((20, 26, w - 20, h - 18), fill=(22, 22, 26, 140))
    # 3 plump burlap coal sacks
    sacks = [(44, 44, 142, 124), (112, 54, 214, 138), (64, 102, 174, 186)]
    for x0, y0, x1, y1 in sacks:
        d.rounded_rectangle((x0, y0, x1, y1), radius=26, fill=(134, 110, 78, 255), outline=(48, 38, 24, 255), width=3)
        d.line([(x0 + 18, (y0 + y1) // 2), (x1 - 18, (y0 + y1) // 2)], fill=(96, 76, 52, 190), width=3)
    # Spill of black shiny coal chunks & iron bucket
    for _ in range(18):
        cx = rng.randint(154, 224)
        cy = rng.randint(132, 194)
        cr = rng.randint(5, 11)
        d.polygon([(cx - cr, cy), (cx, cy - cr), (cx + cr, cy + 2), (cx - 2, cy + cr)], fill=(34, 38, 46, 255), outline=(12, 14, 18, 255))
    d.ellipse((178, 148, 226, 196), fill=(62, 68, 78, 255), outline=(22, 24, 30, 255), width=3)
    d.ellipse((188, 158, 216, 186), fill=(24, 26, 32, 255))
    return add_shadow(img)


def gen_ornate_persian_carpet() -> Image.Image:
    w, h = 512, 320
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Gold silk fringe
    for fy in range(28, h - 28, 7):
        d.line([(10, fy), (28, fy)], fill=(224, 192, 114, 235), width=2)
        d.line([(w - 28, fy), (w - 10, fy)], fill=(224, 192, 114, 235), width=2)
    # Royal crimson outer carpet
    d.rectangle((28, 20, w - 28, h - 20), fill=(136, 26, 38, 250), outline=(212, 168, 76, 255), width=5)
    # Prussian-blue border band with gold motif dots
    d.rectangle((48, 40, w - 48, h - 40), fill=(32, 46, 78, 250), outline=(224, 184, 92, 255), width=3)
    for x in range(62, w - 58, 24):
        d.ellipse((x - 4, 46, x + 4, 54), fill=(226, 184, 88, 230))
        d.ellipse((x - 4, h - 54, x + 4, h - 46), fill=(226, 184, 88, 230))
    # Inner cream-and-burgundy field
    d.rectangle((68, 60, w - 68, h - 60), fill=(154, 32, 44, 250), outline=(232, 196, 108, 240), width=3)
    cx, cy = w // 2, h // 2
    d.polygon([(cx, cy - 72), (cx + 124, cy), (cx, cy + 72), (cx - 124, cy)], fill=(228, 212, 174, 245), outline=(212, 168, 72, 255))
    d.polygon([(cx, cy - 48), (cx + 82, cy), (cx, cy + 48), (cx - 82, cy)], fill=(36, 54, 92, 255), outline=(226, 184, 88, 255))
    d.ellipse((cx - 26, cy - 26, cx + 26, cy + 26), fill=(214, 170, 74, 255), outline=(112, 24, 34, 255), width=3)
    return img


def gen_grand_tea_table() -> Image.Image:
    w, h = 320, 224
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Cream Prussian marble tabletop trimmed in Jugendstil brass
    d.rounded_rectangle((28, 32, w - 28, h - 32), radius=26, fill=(236, 228, 212, 255), outline=(196, 154, 66, 255), width=6)
    d.rounded_rectangle((42, 46, w - 42, h - 46), radius=18, fill=(228, 220, 202, 255), outline=(176, 138, 64, 190), width=2)
    # Silver tea tray
    d.rounded_rectangle((74, 68, 198, 156), radius=14, fill=(196, 206, 218, 255), outline=(104, 114, 128, 255), width=3)
    # Brass teapot
    d.ellipse((98, 86, 146, 134), fill=(222, 180, 82, 255), outline=(84, 60, 22, 255), width=2)
    d.ellipse((114, 102, 130, 118), fill=(248, 222, 136, 255))
    # Two porcelain teacups
    for cx, cy in ((168, 96), (168, 130)):
        d.ellipse((cx - 14, cy - 14, cx + 14, cy + 14), fill=(246, 246, 248, 255), outline=(146, 152, 164, 255), width=2)
        d.ellipse((cx - 8, cy - 8, cx + 8, cy + 8), fill=(154, 92, 42, 255))
    # Crystal decanter + brass lamp on right
    d.ellipse((222, 84, 266, 128), fill=(116, 224, 246, 225), outline=(228, 246, 255, 255), width=3)
    d.ellipse((234, 96, 254, 116), fill=(232, 174, 66, 240))
    return add_shadow(img)


def gen_luggage_trunk_stack() -> Image.Image:
    s = 256
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Large aristocratic leather steamer trunk with brass corner straps
    d.rounded_rectangle((28, 44, 196, 160), radius=8, fill=(118, 56, 36, 255), outline=(36, 18, 10, 255), width=4)
    for sx in (58, 112, 164):
        d.rectangle((sx - 6, 46, sx + 6, 158), fill=(208, 166, 74, 255), outline=(66, 48, 18, 255), width=2)
    # Travel stickers
    d.rectangle((72, 74, 98, 100), fill=(62, 168, 212, 255), outline=(240, 232, 210, 255), width=2)
    d.ellipse((128, 88, 152, 112), fill=(214, 68, 58, 255), outline=(244, 232, 200, 255), width=2)
    # Round gilded hatbox next to it
    d.ellipse((146, 128, 226, 208), fill=(44, 86, 98, 255), outline=(212, 172, 78, 255), width=4)
    d.line([(152, 168), (220, 168)], fill=(212, 172, 78, 230), width=4)
    # Smaller leather valise
    d.rounded_rectangle((46, 148, 138, 214), radius=8, fill=(154, 96, 48, 255), outline=(48, 28, 14, 255), width=3)
    d.rectangle((82, 150, 102, 212), fill=(212, 172, 78, 255))
    return add_shadow(img)


def gen_arcane_bookshelf_cabinet() -> Image.Image:
    w, h = 384, 160
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Rich lacquered mahogany credenza with gold inlay
    d.rounded_rectangle((16, 20, w - 16, h - 20), radius=8, fill=(84, 34, 28, 255), outline=(204, 162, 72, 255), width=4)
    d.rectangle((28, 32, w - 28, h - 32), fill=(104, 44, 36, 255), outline=(54, 20, 16, 255), width=2)
    # Rows of gilded spines peeking along top shelf edge
    cols = [(164, 38, 42), (42, 68, 114), (48, 106, 72), (178, 128, 46), (92, 52, 124)]
    for i, bx in enumerate(range(42, 238, 16)):
        c = cols[i % len(cols)]
        d.rectangle((bx, 42, bx + 13, 114), fill=c + (255,), outline=(28, 16, 12, 255), width=1)
        d.line([(bx + 3, 52), (bx + 10, 52)], fill=(232, 194, 96, 220), width=2)
    # Glowing brass astrolabe / arcane globe on right side
    gx, gy = 304, 80
    d.ellipse((gx - 42, gy - 42, gx + 42, gy + 42), fill=(68, 212, 248, 65))
    d.ellipse((gx - 30, gy - 30, gx + 30, gy + 30), fill=(48, 148, 188, 255), outline=(224, 182, 84, 255), width=4)
    d.arc((gx - 26, gy - 14, gx + 26, gy + 14), 0, 360, fill=(238, 204, 116, 255), width=2)
    d.ellipse((gx - 10, gy - 10, gx + 10, gy + 10), fill=(148, 246, 255, 255))
    return add_shadow(img)


def gen_potted_palm_urn() -> Image.Image:
    s = 224
    cx = cy = s // 2
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Ornate gilded brass urn
    d.ellipse((cx - 46, cy - 46, cx + 46, cy + 46), fill=(184, 142, 58, 255), outline=(46, 34, 14, 255), width=4)
    d.ellipse((cx - 34, cy - 34, cx + 34, cy + 34), fill=(58, 42, 28, 255))
    # 9 lush curving salon palm fronds
    for i in range(9):
        ang = (i / 9.0) * math.pi * 2 + 0.2
        length = 84 if i % 2 == 0 else 68
        tip_x = cx + math.cos(ang) * length
        tip_y = cy + math.sin(ang) * length
        nx, ny = -math.sin(ang), math.cos(ang)
        mid_x = cx + math.cos(ang) * (length * 0.56)
        mid_y = cy + math.sin(ang) * (length * 0.56)
        col = (34, 112, 68, 245) if i % 2 == 0 else (48, 142, 84, 245)
        d.polygon(
            [(cx, cy), (mid_x + nx * 20, mid_y + ny * 20), (tip_x, tip_y), (mid_x - nx * 20, mid_y - ny * 20)],
            fill=col,
            outline=(18, 56, 34, 255),
        )
        d.line([(cx, cy), (tip_x, tip_y)], fill=(104, 192, 124, 220), width=2)
    return add_shadow(img, offset=(6, 8), blur=6, alpha=115)


def gen_berlin_newspaper_stand() -> Image.Image:
    w, h = 320, 224
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Dark emerald wood & gilded brass Oberstadt kiosk frame
    d.rounded_rectangle((20, 24, w - 20, h - 24), radius=10, fill=(28, 66, 58, 255), outline=(212, 172, 78, 255), width=4)
    # Front counter shelf with stacked Berlin Magi-Gazettes
    d.rectangle((32, h - 76, w - 32, h - 32), fill=(116, 78, 44, 255), outline=(42, 26, 12, 255), width=2)
    for nx in range(46, w - 66, 44):
        d.rectangle((nx, h - 70, nx + 34, h - 38), fill=(234, 226, 206, 255), outline=(112, 104, 88, 255), width=2)
        d.line([(nx + 5, h - 60), (nx + 28, h - 60)], fill=(48, 54, 66, 220), width=3)
        d.line([(nx + 5, h - 50), (nx + 24, h - 50)], fill=(120, 118, 112, 200), width=2)
    # Striped emerald & cream Jugendstil awning over top half
    stripe_w = 24
    for i, sx in enumerate(range(24, w - 24, stripe_w)):
        x1 = min(w - 24, sx + stripe_w)
        col = (34, 104, 86, 255) if i % 2 == 0 else (238, 228, 202, 255)
        d.rectangle((sx, 28, x1, h - 78), fill=col)
    d.rectangle((24, 28, w - 24, h - 78), outline=(216, 176, 82, 255), width=4)
    # Glowing cyan magi-ticker bar along awning ridge
    d.rounded_rectangle((74, 58, w - 74, 82), radius=6, fill=(24, 34, 48, 255), outline=(216, 176, 82, 255), width=2)
    d.line([(86, 70), (w - 86, 70)], fill=(96, 236, 255, 255), width=4)
    return add_shadow(img)


NEW_ASSETS = [
    ("objects/wood_interior_stairs.png", "Wooden Tenement Interior Stairs", "object", 256, 384, "#8B5E3C", True, ["stairs", "interior", "floor2", "unterstadt", "tenement", "berlin"], gen_wood_interior_stairs),
    ("objects/brass_spiral_staircase.png", "Jugendstil Brass Spiral Staircase", "object", 320, 320, "#D4A438", True, ["stairs", "spiral", "floor2", "oberstadt", "terminal", "berlin", "magipunk"], gen_brass_spiral_staircase),
    ("objects/tenement_iron_bed.png", "Wrought-Iron Tenement Cot", "object", 256, 384, "#7A3E36", True, ["bed", "furniture", "lived-in", "unterstadt", "tenement", "interior"], gen_tenement_iron_bed),
    ("objects/worn_dining_table.png", "Worn Tenement Dining Table", "object", 384, 256, "#7A5230", True, ["table", "chairs", "furniture", "lived-in", "unterstadt", "tenement"], gen_worn_dining_table),
    ("objects/threadbare_rug.png", "Threadbare Tenement Rug", "object", 384, 256, "#7A2E32", False, ["rug", "carpet", "lived-in", "unterstadt", "tenement", "interior"], gen_threadbare_rug),
    ("objects/wooden_wardrobe_shelf.png", "Tenement Wardrobe & Books", "object", 320, 160, "#684226", True, ["wardrobe", "cabinet", "furniture", "lived-in", "unterstadt", "interior"], gen_wooden_wardrobe_shelf),
    ("objects/alchemy_worktable.png", "Black-Market Alchemy Bench", "object", 384, 224, "#38E8BA", True, ["alchemy", "magipunk", "table", "lived-in", "unterstadt", "rebel"], gen_alchemy_worktable),
    ("objects/berlin_litfass_kiosk.png", "Berlin Litfass Poster Pillar", "object", 256, 256, "#3C8C7E", True, ["berlin", "kiosk", "street", "lived-in", "unterstadt", "magipunk"], gen_berlin_litfass_kiosk),
    ("objects/street_refuse_barrels.png", "Alley Barrels & Refuse Bin", "object", 256, 256, "#6E4A2E", True, ["barrels", "clutter", "street", "lived-in", "unterstadt"], gen_street_refuse_barrels),
    ("objects/coal_sack_pile.png", "Burlap Coal Sacks & Bucket", "object", 256, 224, "#866E4E", True, ["coal", "sacks", "lived-in", "unterstadt", "tenement"], gen_coal_sack_pile),
    ("objects/ornate_persian_carpet.png", "Oberstadt Royal Parlor Carpet", "object", 512, 320, "#9A222E", False, ["rug", "carpet", "lived-in", "oberstadt", "salon", "floor2"], gen_ornate_persian_carpet),
    ("objects/grand_tea_table.png", "Gilded Marble Tea Table", "object", 320, 224, "#E2D6BE", True, ["table", "tea", "furniture", "lived-in", "oberstadt", "salon", "floor2"], gen_grand_tea_table),
    ("objects/luggage_trunk_stack.png", "Aristocrat Steamer Trunks", "object", 256, 256, "#7A3A26", True, ["luggage", "trunks", "lived-in", "oberstadt", "station"], gen_luggage_trunk_stack),
    ("objects/arcane_bookshelf_cabinet.png", "Arcane Library Credenza & Globe", "object", 384, 160, "#6A2822", True, ["bookshelf", "arcane", "furniture", "lived-in", "oberstadt", "floor2"], gen_arcane_bookshelf_cabinet),
    ("objects/potted_palm_urn.png", "Gilded Urn Parlor Palm", "object", 224, 224, "#308E54", True, ["plant", "palm", "decor", "lived-in", "oberstadt", "salon"], gen_potted_palm_urn),
    ("objects/berlin_newspaper_stand.png", "Oberstadt Zeitungs-Kiosk Stand", "object", 320, 224, "#246856", True, ["kiosk", "newspaper", "berlin", "street", "lived-in", "oberstadt"], gen_berlin_newspaper_stand),
]


def main() -> None:
    manifest_path = OUT / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    by_path = {item["path"]: item for item in manifest["assets"]}

    for rel, name, cat, w, h, dom_hex, shadow, tags, fn in NEW_ASSETS:
        target = OUT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        img = fn()
        img.save(target, format="PNG", optimize=True)
        by_path[rel] = {
            "path": rel,
            "displayName": name,
            "category": cat,
            "widthPx": w,
            "heightPx": h,
            "defaultPpi": 256,
            "drawMode": "normal",
            "dominantHex": dom_hex,
            "castsShadow": shadow,
            "tags": tags,
        }

    manifest["assets"] = list(by_path.values())
    manifest["assetCount"] = len(manifest["assets"])
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # Rebuild offline .dcpack archive with all 120 CC0 assets
    DCPACK_OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(DCPACK_OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(manifest_path, "manifest.json")
        for item in manifest["assets"]:
            fp = OUT / item["path"]
            if fp.exists():
                zf.write(fp, item["path"])

    print(f"Generated {len(NEW_ASSETS)} lived-in & staircase assets. Total starter vault: {len(manifest['assets'])} assets.")
    print(f"Rebuilt {DCPACK_OUT}")


if __name__ == "__main__":
    main()

"""
Dice Chaos Maps — 40-Asset Painterly Subterranean, Basement, Secret Vault & Cave Suite

Generates 40 bespoke true top-down CC0 assets in:
  `public/assets/modular-suite-cc0/props/subterranean_caves/`

Categories:
  A. Basements, Cryo-Icehouse, Wine & Root Cellars, Laundry & Moonshine Stills (10)
  B. Crypts, Sarcophagi, Ossuaries, Secret Trapdoors, Black-Site & Speakeasy (10)
  C. Sewers, Bridges, Access Shafts, Rowboat & Primordial Leyline Rift (8)
  D. Living Underground Caves, Stalagmites, Glowing Fungi, Crystal Veins & Lair Props (12, incl. 2 dd_red colorables)

All 2x-supersampled in our unified hand-inked painterly style (#1E1816 charcoal ink,
100% opaque interiors, alpha_composite glows/shadows, zero white halos).
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from harmony_art_engine import (
    MOD_DIR,
    SCRATCH_DIR,
    INK,
    INK_DARK,
    INK_MID,
    INK_WARM,
    DD_RED_BASE,
    DD_RED_DEEP,
    DD_RED_HI,
    new_hi,
    apply_painterly_finish,
    add_contact_shadow,
    add_glow,
    draw_beveled_rect,
    draw_wood_planks_box,
    draw_stone_block,
    blend_rgb,
    shade_rgb,
    vary_rgb,
    save_qa_sheet,
    upsert_manifest_entries,
    dominant_hex,
)

OUT_DIR = MOD_DIR / "props" / "subterranean_caves"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BRASS = (198, 156, 74)
BRASS_GOLD = (224, 182, 86)
BRASS_AGED = (158, 124, 66)
COPPER = (192, 114, 72)
IRON = (68, 74, 84)
IRON_DARK = (46, 50, 58)
OBSIDIAN = (38, 34, 48)
STONE = (134, 130, 124)
STONE_DK = (88, 86, 84)
SLATE = (76, 82, 92)
LIMESTONE = (164, 156, 142)
OAK = (142, 98, 60)
WALNUT = (96, 62, 40)
PINE = (176, 136, 86)
BONE = (224, 214, 192)
MOSS = (76, 118, 66)
ICE = (178, 228, 242)
CYAN = (72, 218, 255)
VIOLET = (176, 98, 255)
EMERALD = (74, 224, 148)
WARM_GLOW = (255, 192, 92)


def poly_regular(cx: float, cy: float, r: float, sides: int, rot: float = 0.0) -> list[tuple[float, float]]:
    return [
        (cx + math.cos(rot + i * math.tau / sides) * r, cy + math.sin(rot + i * math.tau / sides) * r)
        for i in range(sides)
    ]


def draw_disc(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, rgb: tuple[int, int, int], ink_w: int = 5) -> None:
    dk = blend_rgb(rgb, (16, 14, 14), 0.44)
    hi = blend_rgb(rgb, (255, 246, 224), 0.40)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dk, outline=INK, width=ink_w)
    d.ellipse([cx - r * 0.86, cy - r * 0.86, cx + r * 0.86, cy + r * 0.86], fill=(*rgb, 255))
    if r >= 12:
        d.arc([cx - r * 0.72, cy - r * 0.72, cx + r * 0.72, cy + r * 0.72], 195, 310, fill=hi, width=max(3, int(r * 0.14)))


def draw_barrel_top(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, wood: tuple[int, int, int] = OAK) -> None:
    draw_disc(d, cx, cy, r, IRON_DARK, ink_w=5)
    d.ellipse([cx - r * 0.88, cy - r * 0.88, cx + r * 0.88, cy + r * 0.88], fill=(*wood, 255), outline=INK, width=4)
    for dy in (-r * 0.42, 0, r * 0.42):
        half = math.sqrt(max(0.0, (r * 0.85) ** 2 - dy * dy))
        d.line([(cx - half, cy + dy), (cx + half, cy + dy)], fill=INK_MID, width=3)
    draw_disc(d, cx + r * 0.25, cy - r * 0.2, r * 0.16, BRASS, ink_w=3)


def draw_barrel_side(d: ImageDraw.ImageDraw, x0: float, y0: float, x1: float, y1: float, wood: tuple[int, int, int] = OAK, rng: random.Random | None = None) -> None:
    rng = rng or random.Random(1)
    draw_wood_planks_box(d, x0, y0, x1, y1, wood, rng, horizontal=True, n_planks=5, ink_w=5)
    w = x1 - x0
    for frac in (0.14, 0.36, 0.64, 0.86):
        bx = x0 + w * frac
        d.rectangle([bx - 5, y0 + 2, bx + 5, y1 - 2], fill=(*IRON, 255), outline=INK, width=2)


def draw_crystal_shard(
    d: ImageDraw.ImageDraw,
    bx: float, by: float,
    ang: float, length: float, half_w: float,
    base_rgb: tuple[int, int, int],
) -> None:
    ca, sa = math.cos(ang), math.sin(ang)
    nx, ny = -sa, ca
    p_base_l = (bx + nx * half_w, by + ny * half_w)
    p_base_r = (bx - nx * half_w, by - ny * half_w)
    p_mid_l = (bx + ca * length * 0.68 + nx * half_w * 0.85, by + sa * length * 0.68 + ny * half_w * 0.85)
    p_mid_r = (bx + ca * length * 0.68 - nx * half_w * 0.85, by + sa * length * 0.68 - ny * half_w * 0.85)
    p_tip = (bx + ca * length, by + sa * length)
    p_ridge = (bx + ca * length * 0.58, by + sa * length * 0.58)
    hi = blend_rgb(base_rgb, (255, 255, 255), 0.56)
    dk = blend_rgb(base_rgb, (18, 16, 28), 0.44)
    # Left bright facet + right shaded facet
    d.polygon([p_base_l, p_mid_l, p_tip, p_ridge], fill=hi)
    d.polygon([p_base_r, p_mid_r, p_tip, p_ridge], fill=dk)
    d.polygon([p_base_l, p_ridge, p_base_r], fill=(*base_rgb, 255))
    outline_pts = [p_base_l, p_mid_l, p_tip, p_mid_r, p_base_r, p_base_l]
    d.line(outline_pts, fill=INK, width=5)
    d.line([(bx, by), p_ridge, p_tip], fill=blend_rgb(base_rgb, (255, 255, 255), 0.72), width=2)


def draw_skull_top(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, ang: float = 0.0) -> None:
    dk = blend_rgb(BONE, (74, 62, 48), 0.45)
    hi = blend_rgb(BONE, (255, 252, 240), 0.35)
    d.ellipse([cx - r, cy - r * 0.9, cx + r, cy + r * 0.9], fill=dk, outline=INK, width=3)
    d.ellipse([cx - r * 0.84, cy - r * 0.76, cx + r * 0.84, cy + r * 0.76], fill=(*BONE, 255))
    d.ellipse([cx - r * 0.45, cy - r * 0.5, cx + r * 0.2, cy + r * 0.1], fill=hi)
    # Two dark eye sockets peeking toward ang
    ex, ey = math.cos(ang) * r * 0.46, math.sin(ang) * r * 0.46
    nx, ny = -math.sin(ang) * r * 0.30, math.cos(ang) * r * 0.30
    for s in (-1, 1):
        ox, oy = cx + ex + nx * s, cy + ey + ny * s
        sr = max(2.5, r * 0.22)
        d.ellipse([ox - sr, oy - sr, ox + sr, oy + sr], fill=INK_DARK)


# =============================================================================
# GROUP A: BASEMENTS, COLD CELLARS, WINE, ROOT CELLARS & UTILITIES (10)
# =============================================================================
def gen_ice_block_sawdust(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([36 + o[0], 36 + o[1], W - 36 + o[0], H - 36 + o[1]], fill=c), (8, 10), 12.0, 95)
    add_glow(im, W * 0.5, H * 0.5, W * 0.40, H * 0.38, ICE, alpha=68, blur=18.0)
    d = ImageDraw.Draw(im)
    # Golden sawdust mound bed
    for _ in range(24):
        sx = rng.uniform(56, W - 56)
        sy = rng.uniform(52, H - 52)
        sr = rng.uniform(28, 56)
        c = vary_rgb((196, 160, 102), rng, 14)
        d.ellipse([sx - sr, sy - sr * 0.85, sx + sr, sy + sr * 0.85], fill=(*c, 255), outline=INK_WARM, width=2)
    # 3 translucent-looking beveled ice blocks packed in sawdust
    blocks = [(72, 68, 250, 198), (242, 84, 434, 214), (146, 178, 344, 314)]
    for x0, y0, x1, y1 in blocks:
        draw_beveled_rect(d, x0, y0, x1, y1, (166, 224, 240), ink_w=6, radius=10, hi_amt=0.55, sh_amt=0.25)
        # Diagonal frosty crystal glints inside block
        d.line([(x0 + 18, y0 + 20), (x0 + 68, y0 + 70)], fill=(242, 252, 255, 255), width=5)
        d.line([(x0 + 42, y0 + 18), (x0 + 82, y0 + 58)], fill=(230, 248, 255, 255), width=3)
        d.line([(x1 - 56, y1 - 22), (x1 - 18, y1 - 60)], fill=(120, 182, 206, 255), width=4)
    # Iron ice tongs resting on top block
    d.arc([310, 192, 412, 290], 195, 345, fill=INK, width=12)
    d.arc([310, 192, 412, 290], 195, 345, fill=(*IRON, 255), width=6)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


def gen_cryo_brine_chiller(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([42 + o[0], 36 + o[1], W - 42 + o[0], H - 36 + o[1]], radius=22, fill=c), (8, 10), 12.0, 105)
    add_glow(im, cx, cy, W * 0.36, H * 0.36, CYAN, alpha=88, blur=20.0)
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 48, 42, W - 48, H - 42, IRON_DARK, ink_w=6, radius=20)
    draw_beveled_rect(d, 68, 62, W - 68, H - 62, (98, 138, 152), ink_w=5, radius=14)
    # Frosted icy brine vat interior + glowing cyan cryo coils
    d.ellipse([cx - 122, cy - 118, cx + 122, cy + 118], fill=(124, 206, 232, 255), outline=INK, width=6)
    d.ellipse([cx - 94, cy - 90, cx + 94, cy + 90], fill=(182, 238, 252, 255))
    # Spiraling copper refrigeration coils
    for r in (86, 56, 28):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK, width=14)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(*COPPER, 255), width=7)
    # 4 corner brass pressure valves
    for px, py in ((86, 80), (W - 86, 80), (86, H - 80), (W - 86, H - 80)):
        draw_disc(d, px, py, 24, BRASS, ink_w=4)
        d.ellipse([px - 10, py - 10, px + 10, py + 10], fill=(242, 244, 236, 255), outline=INK, width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_milk_cream_can_rack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 24 + o[1], W - 24 + o[0], H - 24 + o[1]], radius=12, fill=c), (7, 9), 10.0, 95)
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 26, W - 26, H - 26, PINE, rng, horizontal=True, n_planks=4, ink_w=6)
    # 6 galvanized steel milk/cream cans in 2 rows of 3
    for row in range(2):
        for col in range(3):
            cx = 92 + col * 132
            cy = 92 + row * 104
            draw_disc(d, cx, cy, 44, (176, 184, 192), ink_w=5)
            draw_disc(d, cx, cy, 26, (214, 220, 228), ink_w=4)
            # Side carry handles + brass lid latch
            d.line([(cx - 48, cy), (cx - 32, cy)], fill=INK, width=8)
            d.line([(cx + 32, cy), (cx + 48, cy)], fill=INK, width=8)
            draw_disc(d, cx, cy, 10, BRASS_GOLD, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_wine_cask_rack_double(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([28 + o[0], 24 + o[1], W - 28 + o[0], H - 24 + o[1]], radius=18, fill=c), (8, 10), 11.0, 100)
    d = ImageDraw.Draw(im)
    # Heavy horizontal oak cradle runners peeking out left/right
    draw_beveled_rect(d, 26, 78, W - 26, 114, WALNUT, ink_w=5, radius=6)
    draw_beveled_rect(d, 26, H - 114, W - 26, H - 78, WALNUT, ink_w=5, radius=6)
    # Two curved bulging oak wine barrels resting side-by-side!
    for cx, wood in ((W * 0.28, (128, 78, 46)), (W * 0.72, (142, 88, 52))):
        dk = blend_rgb(wood, (24, 14, 10), 0.45)
        hi = blend_rgb(wood, (240, 206, 152), 0.34)
        # Bulging barrel silhouette (wider at belly y=H/2, tapered at ends)
        pts = []
        for i in range(24):
            t = i / 24.0
            y = 36 + t * (H - 72)
            bulge = 1.0 - 0.22 * ((t - 0.5) * 2.0) ** 2
            pts.append((cx + 92 * bulge, y))
        for i in range(24, -1, -1):
            t = i / 24.0
            y = 36 + t * (H - 72)
            bulge = 1.0 - 0.22 * ((t - 0.5) * 2.0) ** 2
            pts.append((cx - 92 * bulge, y))
        d.polygon(pts, fill=(*wood, 255), outline=INK)
        # Shaded curved stave bands + bright ridge highlight along barrel top
        for sx in (-62, -34, 0, 34, 62):
            c_stave = dk if abs(sx) > 50 else (hi if sx == 0 else (*wood, 255))
            d.line([(cx + sx * 0.82, 42), (cx + sx, H * 0.5), (cx + sx * 0.82, H - 42)], fill=c_stave, width=16 if sx == 0 else 8)
            d.line([(cx + sx * 0.82, 42), (cx + sx, H * 0.5), (cx + sx * 0.82, H - 42)], fill=INK_MID, width=2)
        d.line(pts + [pts[0]], fill=INK, width=6)
        # 4 forged iron barrel hoops wrapping horizontally around each barrel
        for frac in (0.16, 0.36, 0.64, 0.84):
            hy = 36 + frac * (H - 72)
            hw = 92 * (1.0 - 0.22 * ((frac - 0.5) * 2.0) ** 2)
            d.line([(cx - hw, hy), (cx + hw, hy)], fill=INK, width=14)
            d.line([(cx - hw, hy), (cx + hw, hy)], fill=(*IRON, 255), width=7)
        # Brass bung plug on top + spigot at front!
        draw_disc(d, cx, H * 0.5, 13, BRASS, ink_w=3)
        draw_disc(d, cx, H - 32, 13, BRASS_GOLD, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


def gen_dusty_wine_shelf(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([20 + o[0], 22 + o[1], W - 20 + o[0], H - 22 + o[1]], radius=10, fill=c), (7, 9), 10.0, 95)
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 22, 24, W - 22, H - 24, WALNUT, rng, horizontal=True, n_planks=4, ink_w=6)
    # Bottle necks & dusty green/amber/burgundy wine bottles resting horizontally in cubbies!
    colors = [(44, 96, 56), (124, 38, 48), (156, 108, 42), (38, 78, 54)]
    for i in range(9):
        bx = 52 + i * 47
        c = colors[i % len(colors)]
        draw_beveled_rect(d, bx - 16, 42, bx + 16, H - 56, c, ink_w=4, radius=8)
        draw_beveled_rect(d, bx - 7, H - 58, bx + 7, H - 30, c, ink_w=3, radius=3)
        d.ellipse([bx - 6, H - 36, bx + 6, H - 24], fill=(176, 48, 52, 255), outline=INK, width=2)
    # Subtle cobweb strands across top corner
    for a in (0.15, 0.45, 0.85, 1.2):
        d.line([(28, 30), (28 + math.cos(a) * 84, 30 + math.sin(a) * 84)], fill=(214, 212, 204, 255), width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_preserved_jars_shelf(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([20 + o[0], 22 + o[1], W - 20 + o[0], H - 22 + o[1]], radius=10, fill=c), (7, 9), 10.0, 95)
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 22, 24, W - 22, H - 24, OAK, rng, horizontal=True, n_planks=4, ink_w=6)
    jar_cols = [(186, 46, 56), (222, 168, 52), (92, 148, 68), (168, 72, 124), (218, 124, 54), (186, 174, 148)]
    for row in range(2):
        for col in range(6):
            cx = 64 + col * 64 + rng.randint(-4, 4)
            cy = 74 + row * 102 + rng.randint(-4, 4)
            jc = jar_cols[(row * 3 + col) % len(jar_cols)]
            draw_disc(d, cx, cy, 24, jc, ink_w=4)
            draw_disc(d, cx, cy, 14, (226, 214, 186) if (col + row) % 2 == 0 else BRASS, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_root_cellar_bins(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 24 + o[1], W - 24 + o[0], H - 24 + o[1]], radius=12, fill=c), (7, 9), 10.0, 95)
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 26, W - 26, H - 26, PINE, rng, horizontal=True, n_planks=5, ink_w=6)
    # 3 recessed produce bins: potatoes (tan), carrots (orange), cabbages (green)
    bins = [
        (42, 42, 168, H - 42, (166, 126, 78)),
        (178, 42, 294, H - 42, (218, 108, 44)),
        (304, 42, W - 42, H - 42, (108, 154, 78)),
    ]
    for x0, y0, x1, y1, prod in bins:
        d.rectangle([x0, y0, x1, y1], fill=(58, 44, 34, 255), outline=INK, width=5)
        for _ in range(18):
            px = rng.uniform(x0 + 18, x1 - 18)
            py = rng.uniform(y0 + 18, y1 - 18)
            pr = rng.uniform(13, 21)
            c = vary_rgb(prod, rng, 16)
            d.ellipse([px - pr, py - pr * 0.82, px + pr, py + pr * 0.82], fill=(*c, 255), outline=INK_MID, width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


def gen_keller_storage_pile(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([30 + o[0], 28 + o[1], W - 30 + o[0], H - 28 + o[1]], radius=18, fill=c), (8, 10), 12.0, 98)
    d = ImageDraw.Draw(im)
    # Old wooden steamer trunk + crates + rolled dusty crimson rug + rusted bicycle wheel!
    draw_wood_planks_box(d, 44, 48, 260, 210, WALNUT, rng, horizontal=True, n_planks=4, ink_w=6)
    for bx in (86, 218):
        d.rectangle([bx - 7, 48, bx + 7, 210], fill=(*BRASS_AGED, 255), outline=INK, width=3)
    draw_wood_planks_box(d, 252, 62, 434, 216, PINE, rng, horizontal=False, n_planks=4, ink_w=5)
    # Rolled rug
    draw_beveled_rect(d, 56, 224, 310, 316, (148, 52, 56), ink_w=5, radius=38)
    d.line([(86, 248), (282, 248)], fill=(208, 168, 86, 255), width=6)
    d.line([(86, 290), (282, 290)], fill=(208, 168, 86, 255), width=6)
    # Broken spoked bicycle wheel leaning on right
    wcx, wcy, wr = 368, 258, 72
    d.ellipse([wcx - wr, wcy - wr, wcx + wr, wcy + wr], outline=INK, width=14)
    d.ellipse([wcx - wr, wcy - wr, wcx + wr, wcy + wr], outline=(*IRON, 255), width=6)
    for i in range(8):
        ang = i * math.tau / 8
        d.line([(wcx, wcy), (wcx + math.cos(ang) * wr, wcy + math.sin(ang) * wr)], fill=(154, 160, 168, 255), width=2)
    draw_disc(d, wcx, wcy, 12, IRON_DARK, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.5)


def gen_copper_wash_boiler(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([34 + o[0], 32 + o[1], W - 34 + o[0], H - 32 + o[1]], radius=24, fill=c), (8, 10), 11.0, 98)
    d = ImageDraw.Draw(im)
    # Brick hearth housing
    draw_beveled_rect(d, 38, 36, W - 38, H - 36, (146, 78, 58), ink_w=6, radius=18)
    # Giant inset hammered-copper laundry boiler filled with soapy suds
    draw_disc(d, cx, cy, 122, COPPER, ink_w=6)
    d.ellipse([cx - 98, cy - 98, cx + 98, cy + 98], fill=(166, 204, 214, 255), outline=INK, width=4)
    rng = random.Random(seed)
    for _ in range(18):
        bx, by = cx + rng.uniform(-62, 62), cy + rng.uniform(-62, 62)
        br = rng.uniform(12, 26)
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=(238, 246, 250, 255), outline=(146, 178, 192, 255), width=2)
    # Wooden washboard leaning on rim
    draw_beveled_rect(d, cx + 24, cy - 72, cx + 92, cy + 68, PINE, ink_w=4, radius=6)
    for ry in range(-48, 56, 16):
        d.line([(cx + 34, cy + ry), (cx + 82, cy + ry)], fill=(154, 160, 168, 255), width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_moonshine_still(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([36 + o[0], 36 + o[1], W - 36 + o[0], H - 36 + o[1]], fill=c), (8, 10), 12.0, 100)
    add_glow(im, 146, H * 0.5, 92, 92, (255, 136, 48), alpha=78, blur=16.0)
    d = ImageDraw.Draw(im)
    # Left copper alembic boiler pot
    draw_disc(d, 146, H * 0.5, 96, COPPER, ink_w=6)
    draw_disc(d, 146, H * 0.5, 52, blend_rgb(COPPER, (255, 224, 168), 0.35)[:3], ink_w=4)
    # Right oak cooling barrel with coiled copper condenser worm
    draw_disc(d, 370, H * 0.5, 86, OAK, ink_w=6)
    d.ellipse([370 - 68, H * 0.5 - 68, 370 + 68, H * 0.5 + 68], fill=(64, 118, 128, 255), outline=INK, width=4)
    for r in (52, 32):
        d.ellipse([370 - r, H * 0.5 - r, 370 + r, H * 0.5 + r], outline=INK, width=11)
        d.ellipse([370 - r, H * 0.5 - r, 370 + r, H * 0.5 + r], outline=(*COPPER, 255), width=5)
    # Connecting swan-neck copper pipe
    d.line([(146, H * 0.5), (370, H * 0.5)], fill=INK, width=20)
    d.line([(146, H * 0.5), (370, H * 0.5)], fill=(*COPPER, 255), width=11)
    d.line([(146, H * 0.5 - 3), (370, H * 0.5 - 3)], fill=(242, 186, 134, 255), width=3)
    # Glass moonshine carboy jug beside barrel
    draw_disc(d, 266, H - 72, 30, (118, 198, 136), ink_w=4)
    draw_disc(d, 266, H - 72, 12, (218, 246, 214), ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# GROUP B: CRYPTS, SARCOPHAGI, SECRET DOORS, BLACK-SITE & SPEAKEASY (10)
# =============================================================================
def gen_sarcophagus(w: int, h: int, seed: int, ajar: bool = False) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([30 + o[0], 36 + o[1], W - 30 + o[0], H - 36 + o[1]], radius=12, fill=c), (8, 10), 12.0, 105)
    d = ImageDraw.Draw(im)
    # Stepped limestone base plinth
    draw_beveled_rect(d, 34, 42, W - 34, H - 42, STONE_DK, ink_w=6, radius=10)
    if ajar:
        # Dark interior cavity clearly exposed on left half with ancient skull, bones & glinting chalice!
        d.rectangle([58, 66, W - 58, H - 66], fill=(20, 16, 20, 255), outline=INK, width=5)
        draw_skull_top(d, 112, H * 0.5 - 10, 28, 0.25)
        d.line([(138, H * 0.5 - 24), (222, H * 0.5 + 26)], fill=(*BONE, 255), width=11)
        d.line([(122, H * 0.5 + 32), (206, H * 0.5 - 18)], fill=(*BONE, 255), width=10)
        draw_disc(d, 174, H * 0.5 + 38, 17, BRASS_GOLD, ink_w=3)
        # Heavy stone lid shoved dramatically off to the right-bottom revealing half the tomb!
        lid_pts = [(222, 34), (W - 14, 78), (W - 44, H - 14), (192, H - 56)]
        d.polygon(lid_pts, fill=(*LIMESTONE, 255), outline=INK)
        d.line(lid_pts + [lid_pts[0]], fill=INK, width=6)
        # Carved cross relief on shifted lid
        d.line([(238, 126), (W - 62, H - 96)], fill=STONE_DK, width=10)
        d.line([(318, 92), (288, 204)], fill=STONE_DK, width=10)
    else:
        draw_beveled_rect(d, 52, 60, W - 52, H - 60, LIMESTONE, ink_w=6, radius=8)
        draw_beveled_rect(d, 76, 82, W - 76, H - 82, blend_rgb(LIMESTONE, (238, 232, 218), 0.28)[:3], ink_w=4, radius=6)
        # Carved Sovereign cross / effigy ridge + brass corner plaques
        d.line([(106, H * 0.5), (W - 106, H * 0.5)], fill=INK_MID, width=8)
        d.line([(186, 100), (186, H - 100)], fill=INK_MID, width=8)
        draw_disc(d, 186, H * 0.5, 22, BRASS_AGED, ink_w=4)
        for mx, my in ((70, 74), (W - 76, H - 72)):
            d.ellipse([mx - 14, my - 10, mx + 14, my + 10], fill=(*MOSS, 255), outline=INK_MID, width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0)


def gen_ossuary_alcove(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([20 + o[0], 20 + o[1], W - 20 + o[0], H - 20 + o[1]], radius=10, fill=c), (7, 9), 10.0, 95)
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 22, 22, W - 22, H - 22, STONE_DK, ink_w=6, radius=10)
    d.rectangle([42, 42, W - 42, H - 42], fill=(38, 32, 30, 255), outline=INK, width=5)
    # Crossed femurs + neat rows of aged skulls!
    for i in range(10):
        bx = 64 + i * 38
        d.line([(bx, 52), (bx + 22, H - 52)], fill=blend_rgb(BONE, (96, 84, 68), 0.35), width=8)
    for row in range(2):
        for col in range(6):
            sx = 76 + col * 66 + rng.randint(-5, 5)
            sy = 84 + row * 84 + rng.randint(-5, 5)
            draw_skull_top(d, sx, sy, 23, math.pi / 2 + rng.uniform(-0.35, 0.35))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


def gen_skeleton_remains(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    # Tattered dark cloak scrap underneath bones
    d = ImageDraw.Draw(im)
    rag = [(78, 86), (256, 62), (318, 172), (242, 294), (92, 266), (56, 168)]
    d.polygon(rag, fill=(64, 52, 56, 255), outline=INK)
    d.line(rag + [rag[0]], fill=INK, width=5)
    # Ribcage spine + scattered limb bones + skull
    d.line([(132, 138), (224, 212)], fill=INK, width=16)
    d.line([(132, 138), (224, 212)], fill=(*BONE, 255), width=8)
    for t in (0.2, 0.42, 0.64, 0.85):
        rx = 132 + (224 - 132) * t
        ry = 138 + (212 - 138) * t
        d.arc([rx - 44, ry - 32, rx + 44, ry + 32], 190, 350, fill=INK, width=9)
        d.arc([rx - 44, ry - 32, rx + 44, ry + 32], 190, 350, fill=(*BONE, 255), width=4)
    for p0, p1 in [((230, 220), (318, 258)), ((218, 228), (186, 312)), ((128, 164), (72, 228))]:
        d.line([p0, p1], fill=INK, width=14)
        d.line([p0, p1], fill=(*BONE, 255), width=7)
    draw_skull_top(d, 108, 106, 30, 0.7)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


def gen_secret_trapdoor_rug(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([32 + o[0], 32 + o[1], W - 32 + o[0], H - 32 + o[1]], radius=12, fill=c), (6, 8), 10.0, 95)
    d = ImageDraw.Draw(im)
    # Recessed wooden cellar trapdoor frame with iron hinges & pull ring
    draw_beveled_rect(d, 44, 44, W - 44, H - 44, STONE_DK, ink_w=6, radius=8)
    draw_wood_planks_box(d, 64, 64, W - 64, H - 64, WALNUT, rng, horizontal=True, n_planks=5, ink_w=5)
    # Iron strap hinges + pull ring
    for hy in (104, H - 104):
        d.rectangle([64, hy - 10, 148, hy + 10], fill=(*IRON, 255), outline=INK, width=3)
    d.ellipse([W - 124, H * 0.5 - 22, W - 80, H * 0.5 + 22], outline=INK, width=12)
    d.ellipse([W - 124, H * 0.5 - 22, W - 80, H * 0.5 + 22], outline=(*IRON, 255), width=5)
    # Frayed crimson Persian rug covering top-left with curled/folded pale woven underside flap!
    rug_poly = [(22, 22), (W - 62, 22), (22, H - 62)]
    d.polygon(rug_poly, fill=(142, 42, 48, 255), outline=INK)
    d.line([(36, 36), (W - 102, 36)], fill=(214, 174, 88, 255), width=6)
    d.line([(36, 36), (36, H - 102)], fill=(214, 174, 88, 255), width=6)
    d.line(rug_poly + [rug_poly[0]], fill=INK, width=5)
    # Rolled/peeled-back carpet corner flap folding UP-LEFT onto the rug!
    flap = [(W - 62, 22), (104, 104), (22, H - 62)]
    d.polygon(flap, fill=(212, 192, 158, 255), outline=INK)
    d.line(flap + [flap[0]], fill=INK, width=5)
    # Shadow crease under folded carpet corner
    d.line([(W - 62, 22), (22, H - 62)], fill=INK_DARK, width=7)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


def gen_prison_cell_pallet(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=16, fill=c), (6, 8), 10.0, 92)
    d = ImageDraw.Draw(im)
    # Loose straw wisps underneath
    for _ in range(28):
        sx, sy = rng.uniform(32, W - 32), rng.uniform(32, H - 32)
        ang = rng.uniform(0, math.tau)
        d.line([(sx, sy), (sx + math.cos(ang) * 32, sy + math.sin(ang) * 32)], fill=(192, 162, 92, 255), width=3)
    # Tattered grey sackcloth prison mattress + thin wool blanket
    draw_beveled_rect(d, 38, 42, W - 78, H - 42, (148, 134, 112), ink_w=6, radius=18)
    draw_beveled_rect(d, 118, 48, W - 82, H - 48, (88, 92, 96), ink_w=5, radius=12)
    draw_beveled_rect(d, 50, 68, 110, H - 68, (176, 164, 142), ink_w=4, radius=12)
    # Bolted iron chain & manacle + tin porridge bowl on right
    draw_disc(d, W - 46, 78, 16, IRON_DARK, ink_w=4)
    for cy in (104, 126, 148):
        d.ellipse([W - 56, cy - 10, W - 36, cy + 10], outline=INK, width=7)
        d.ellipse([W - 56, cy - 10, W - 36, cy + 10], outline=(*IRON, 255), width=3)
    draw_disc(d, W - 48, H - 72, 24, (146, 152, 160), ink_w=4)
    d.ellipse([W - 62, H - 86, W - 34, H - 58], fill=(116, 102, 74, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


def gen_cursed_relic_cage(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([44 + o[0], 44 + o[1], W - 44 + o[0], H - 44 + o[1]], fill=c), (8, 10), 14.0, 110)
    add_glow(im, cx, cy, 146, 146, (186, 62, 224), alpha=125, blur=24.0)
    d = ImageDraw.Draw(im)
    # Heavy octagonal iron & brass Faraday base
    pts = poly_regular(cx, cy, 154, 8, math.pi / 8)
    d.polygon(pts, fill=(*OBSIDIAN, 255), outline=INK)
    d.line(pts + [pts[0]], fill=INK, width=6)
    pts2 = poly_regular(cx, cy, 126, 8, math.pi / 8)
    d.polygon(pts2, fill=(*IRON_DARK, 255), outline=(*BRASS, 255))
    # Pulsing violet-crimson cursed orb/relic inside brass containment bars
    d.ellipse([cx - 82, cy - 82, cx + 82, cy + 82], fill=(138, 32, 168, 255), outline=INK, width=5)
    d.ellipse([cx - 56, cy - 56, cx + 56, cy + 56], fill=(224, 68, 186, 255))
    d.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], fill=(255, 220, 248, 255))
    for i in range(8):
        ang = i * math.tau / 8
        d.line([(cx + math.cos(ang) * 26, cy + math.sin(ang) * 26), (cx + math.cos(ang) * 144, cy + math.sin(ang) * 144)], fill=INK, width=10)
        d.line([(cx + math.cos(ang) * 26, cy + math.sin(ang) * 26), (cx + math.cos(ang) * 144, cy + math.sin(ang) * 144)], fill=(*BRASS_GOLD, 255), width=4)
    draw_disc(d, cx, cy, 28, BRASS_GOLD, ink_w=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_speakeasy_bar(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=16, fill=c), (8, 10), 12.0, 100)
    add_glow(im, W * 0.35, H * 0.5, 92, 62, EMERALD, alpha=68, blur=16.0)
    d = ImageDraw.Draw(im)
    # Rich dark mahogany bar counter + brass rail along patron edge (+Y)
    draw_wood_planks_box(d, 28, 32, W - 28, H - 56, (88, 44, 34), rng, horizontal=True, n_planks=5, ink_w=6)
    d.line([(42, H - 34), (W - 42, H - 34)], fill=INK, width=16)
    d.line([(42, H - 34), (W - 42, H - 34)], fill=(*BRASS_GOLD, 255), width=8)
    # Glowing emerald aether-absinthe bottles, amber decanters, brass shaker & crystal glasses!
    items = [
        (94, 104, 22, EMERALD), (146, 98, 22, EMERALD), (198, 112, 20, (232, 166, 56)),
        (274, 118, 26, BRASS_GOLD), (348, 108, 18, (220, 238, 246)), (394, 134, 18, (220, 238, 246)),
        (458, 106, 22, (186, 48, 56)), (504, 126, 20, EMERALD),
    ]
    for ix, iy, ir, ic in items:
        draw_disc(d, ix, iy, ir, ic, ink_w=4)
    # Velvet bar runner mat in center
    draw_beveled_rect(d, 228, 152, 342, 220, (44, 96, 72), ink_w=4, radius=8)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


def gen_counterfeit_press(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([26 + o[0], 26 + o[1], W - 26 + o[0], H - 26 + o[1]], radius=14, fill=c), (8, 10), 11.0, 100)
    d = ImageDraw.Draw(im)
    # Heavy timber workbench + cast-iron cylinder press + freshly printed banknote sheets!
    draw_wood_planks_box(d, 28, 30, W - 28, H - 30, WALNUT, rng, horizontal=True, n_planks=5, ink_w=6)
    draw_beveled_rect(d, 56, 56, 266, H - 56, IRON_DARK, ink_w=6, radius=10)
    # Inked steel roller cylinder + brass hand flywheel on left
    draw_beveled_rect(d, 84, 72, 236, 148, IRON, ink_w=5, radius=8)
    draw_disc(d, 48, H * 0.5, 34, BRASS, ink_w=5)
    # Uncut green-ink counterfeit banknote sheets stacked on right!
    for ox, oy in ((296, 62), (312, 166)):
        draw_beveled_rect(d, ox, oy, ox + 122, oy + 94, (226, 234, 212), ink_w=4, radius=4)
        for ry in (oy + 18, oy + 52):
            for rx in (ox + 14, ox + 66):
                d.rectangle([rx, ry, rx + 40, ry + 24], fill=(116, 166, 114, 255), outline=(48, 86, 52, 255), width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_aether_pump_gear_well(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([26 + o[0], 26 + o[1], W - 26 + o[0], H - 26 + o[1]], fill=c), (8, 10), 14.0, 110)
    add_glow(im, cx, cy, 176, 176, CYAN, alpha=82, blur=24.0)
    d = ImageDraw.Draw(im)
    # Outer circular stone well coping + recessed dark water/gear pit
    draw_disc(d, cx, cy, 252, STONE, ink_w=7)
    d.ellipse([cx - 210, cy - 210, cx + 210, cy + 210], fill=(22, 34, 42, 255), outline=INK, width=6)
    # Giant interlocking brass gears spinning inside the flooded pump well!
    for gx, gy, gr, teeth, col in [
        (cx - 52, cy - 42, 92, 12, BRASS),
        (cx + 68, cy + 52, 74, 10, COPPER),
        (cx + 58, cy - 68, 52, 8, BRASS_GOLD),
    ]:
        for i in range(teeth):
            ang = i * math.tau / teeth
            tx, ty = gx + math.cos(ang) * (gr + 12), gy + math.sin(ang) * (gr + 12)
            d.line([(gx, gy), (tx, ty)], fill=INK, width=18)
            d.line([(gx, gy), (tx, ty)], fill=(*col, 255), width=10)
        draw_disc(d, gx, gy, gr, col, ink_w=5)
        d.ellipse([gx - gr * 0.52, gy - gr * 0.52, gx + gr * 0.52, gy + gr * 0.52], fill=(26, 40, 48, 255), outline=INK, width=4)
        draw_disc(d, gx, gy, gr * 0.24, IRON_DARK, ink_w=4)
    # Crosswise riveted iron maintenance catwalk over the well
    draw_beveled_rect(d, cx - 226, cy - 26, cx + 226, cy + 26, IRON, ink_w=5, radius=4)
    for rx in range(int(cx - 196), int(cx + 200), 28):
        d.line([(rx, cy - 22), (rx, cy + 22)], fill=INK_DARK, width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# GROUP C: SEWERS, BRIDGES, SHAFTS, ROWBOAT & LEYLINE RIFT (8)
# =============================================================================
def gen_sewer_iron_bridge(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([18 + o[0], 26 + o[1], W - 18 + o[0], H - 26 + o[1]], radius=8, fill=c), (6, 10), 12.0, 105)
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 18, 30, W - 18, H - 30, IRON_DARK, ink_w=6, radius=6)
    draw_beveled_rect(d, 26, 52, W - 26, H - 52, IRON, ink_w=5, radius=4)
    # Grated steel diamond tread slits + bolted side girder rails
    for gx in range(44, W - 40, 26):
        d.line([(gx, 60), (gx, H - 60)], fill=INK_DARK, width=5)
    for ry in (40, H - 40):
        d.line([(24, ry), (W - 24, ry)], fill=(*BRASS_AGED, 255), width=8)
        for rx in range(48, W - 40, 72):
            draw_disc(d, rx, ry, 10, IRON, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_sewer_pipe_outfall(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    d = ImageDraw.Draw(im)
    # Mossy brick outfall headwall at -Y with barred grate + murky runoff apron at +Y
    d.ellipse([54, 110, W - 54, H - 14], fill=(48, 76, 72, 255), outline=(34, 52, 48, 255), width=4)
    draw_beveled_rect(d, 24, 18, W - 24, 128, (124, 72, 58), ink_w=6, radius=8)
    # Arched dark culvert opening + vertical iron bars
    d.rounded_rectangle([72, 56, W - 72, 168], radius=24, fill=(18, 22, 24, 255), outline=INK, width=6)
    for bx in range(106, W - 96, 34):
        d.line([(bx, 58), (bx, 166)], fill=(*IRON, 255), width=9)
        d.line([(bx - 2, 58), (bx - 2, 166)], fill=(124, 134, 144, 255), width=2)
    # Moss drips
    for mx, my in ((68, 124), (W - 68, 126), (W * 0.5, 42)):
        d.ellipse([mx - 22, my - 12, mx + 22, my + 12], fill=(*MOSS, 255), outline=INK_MID, width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


def gen_iron_shaft_ladder(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([26 + o[0], 26 + o[1], W - 26 + o[0], H - 26 + o[1]], fill=c), (6, 8), 10.0, 100)
    d = ImageDraw.Draw(im)
    draw_disc(d, cx, cy, 114, IRON, ink_w=6)
    d.ellipse([cx - 88, cy - 88, cx + 88, cy + 88], fill=(14, 16, 20, 255), outline=INK, width=5)
    # Descending iron shaft ladder rungs vanishing into darkness
    for i, ry in enumerate([cy - 54, cy - 22, cy + 10, cy + 42]):
        shade = max(38, 152 - i * 26)
        d.line([(cx - 42, ry), (cx + 42, ry)], fill=(shade, shade + 6, shade + 12, 255), width=9)
    d.line([(cx - 42, cy - 70), (cx - 42, cy + 68)], fill=(*IRON, 255), width=10)
    d.line([(cx + 42, cy - 70), (cx + 42, cy + 68)], fill=(*IRON, 255), width=10)
    # Hinged circular cover folded back along -Y
    draw_disc(d, cx, 36, 26, IRON_DARK, ink_w=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_rope_sinkhole_descent(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    d = ImageDraw.Draw(im)
    # Jagged rock/earth sinkhole rim
    pts_out = []
    pts_mid = []
    pts_in = []
    for i in range(18):
        ang = i * math.tau / 18
        r0 = 186 + rng.uniform(-16, 16)
        pts_out.append((cx + math.cos(ang) * r0, cy + math.sin(ang) * r0))
        pts_mid.append((cx + math.cos(ang) * (r0 * 0.72), cy + math.sin(ang) * (r0 * 0.72)))
        pts_in.append((cx + math.cos(ang) * (r0 * 0.48), cy + math.sin(ang) * (r0 * 0.48)))
    d.polygon(pts_out, fill=(*STONE_DK, 255), outline=INK)
    d.line(pts_out + [pts_out[0]], fill=INK, width=6)
    d.polygon(pts_mid, fill=(44, 40, 38, 255), outline=INK)
    d.polygon(pts_in, fill=(10, 12, 16, 255), outline=INK)
    # Iron stake + coiled hemp rope dropping straight down into pit
    draw_disc(d, cx - 128, cy - 72, 16, IRON, ink_w=4)
    d.line([(cx - 128, cy - 72), (cx - 48, cy - 28), (cx, cy + 16)], fill=INK, width=16)
    d.line([(cx - 128, cy - 72), (cx - 48, cy - 28), (cx, cy + 16)], fill=(198, 164, 108, 255), width=8)
    for kr in range(18, 42, 10):
        d.ellipse([cx - 146 - kr * 0.3, cy - 30 - kr * 0.3, cx - 102 + kr * 0.3, cy + 14 + kr * 0.3], outline=(188, 154, 98, 255), width=5)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0)


def gen_smuggler_rowboat(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cy = H * 0.5
    hull = [
        (32, cy), (104, 46), (W - 96, 46), (W - 36, 78),
        (W - 36, H - 78), (W - 96, H - 46), (104, H - 46),
    ]
    add_contact_shadow(im, lambda sd, c, o: sd.polygon([(x + o[0], y + o[1]) for x, y in hull], fill=c), (7, 9), 12.0, 95)
    add_glow(im, 82, cy, 62, 62, WARM_GLOW, alpha=95, blur=16.0)
    d = ImageDraw.Draw(im)
    d.polygon(hull, fill=(*WALNUT, 255), outline=INK)
    d.line(hull + [hull[0]], fill=INK, width=7)
    inner = [(x * 0.86 + W * 0.07, y * 0.78 + H * 0.11) for x, y in hull]
    d.polygon(inner, fill=(*OAK, 255), outline=INK)
    # 3 wooden rowing thwarts (benches) + tucked oars + brass bow lantern + rope coil
    for bx in (156, 266, 376):
        draw_beveled_rect(d, bx - 16, 66, bx + 16, H - 66, PINE, ink_w=4, radius=4)
    for oy in (76, H - 76):
        d.line([(122, oy), (420, oy)], fill=INK, width=12)
        d.line([(122, oy), (420, oy)], fill=(192, 152, 98, 255), width=6)
    draw_disc(d, 82, cy, 18, WARM_GLOW, ink_w=4)
    draw_disc(d, 82, cy, 9, (255, 252, 224), ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


def gen_rickety_cave_bridge(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([20 + o[0], 34 + o[1], W - 20 + o[0], H - 34 + o[1]], radius=10, fill=c), (6, 12), 14.0, 105)
    d = ImageDraw.Draw(im)
    # Two rope side cables
    for ry in (54, H - 54):
        d.line([(18, ry), (W - 18, ry)], fill=INK, width=16)
        d.line([(18, ry), (W - 18, ry)], fill=(186, 152, 98, 255), width=8)
    # Uneven weathered timber planks lashed across cables
    for px in range(38, W - 52, 40):
        jitter = rng.randint(-6, 6)
        pw = rng.randint(26, 34)
        c = vary_rgb(OAK, rng, 18)
        draw_beveled_rect(d, px, 40 + jitter, px + pw, H - 40 - jitter, c, ink_w=4, radius=4)
    # Corner anchor posts
    for ax, ay in ((32, 46), (W - 32, 46), (32, H - 46), (W - 32, H - 46)):
        draw_disc(d, ax, ay, 18, WALNUT, ink_w=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


def gen_cave_stepping_stones(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    d = ImageDraw.Draw(im)
    stones = [(92, 148, 56, 44), (196, 118, 62, 46), (296, 176, 58, 48), (374, 134, 48, 40), (146, 224, 46, 36)]
    for sx, sy, rx, ry in stones:
        pts = [(sx + math.cos(i * math.tau / 10) * (rx + rng.uniform(-6, 6)), sy + math.sin(i * math.tau / 10) * (ry + rng.uniform(-5, 5))) for i in range(10)]
        d.polygon([(x + 5, y + 6) for x, y in pts], fill=(24, 34, 38, 255))
        c = vary_rgb(STONE, rng, 12)
        d.polygon(pts, fill=(*c, 255), outline=INK)
        d.line(pts + [pts[0]], fill=INK, width=5)
        # Wet sheen + moss edge
        d.ellipse([sx - rx * 0.45, sy - ry * 0.45, sx + rx * 0.15, sy + ry * 0.1], fill=blend_rgb(c, (230, 242, 246), 0.38))
        d.ellipse([sx + rx * 0.2, sy + ry * 0.15, sx + rx * 0.6, sy + ry * 0.55], fill=(*MOSS, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


def gen_primordial_leyline_rift(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_glow(im, cx, cy, W * 0.44, H * 0.42, VIOLET, alpha=145, blur=28.0)
    add_glow(im, cx, cy, W * 0.28, H * 0.26, CYAN, alpha=130, blur=18.0)
    d = ImageDraw.Draw(im)
    # Jagged shattered obsidian basalt crater rim
    rim = []
    crack = []
    for i in range(20):
        ang = i * math.tau / 20
        stretch = 1.25 if abs(math.cos(ang)) > 0.5 else 0.86
        r0 = (210 + rng.uniform(-24, 24)) * stretch
        rim.append((cx + math.cos(ang) * r0, cy + math.sin(ang) * r0 * 0.78))
        crack.append((cx + math.cos(ang) * r0 * 0.54, cy + math.sin(ang) * r0 * 0.42))
    d.polygon(rim, fill=(*OBSIDIAN, 255), outline=INK)
    d.line(rim + [rim[0]], fill=INK, width=7)
    d.polygon(crack, fill=(122, 42, 214, 255), outline=INK)
    # Blazing cyan-white lightning fissure down the center!
    bolt = [(cx - 172, cy - 28), (cx - 88, cy + 24), (cx - 18, cy - 32), (cx + 68, cy + 22), (cx + 168, cy - 18)]
    d.line(bolt, fill=(*VIOLET, 255), width=36)
    d.line(bolt, fill=(*CYAN, 255), width=18)
    d.line(bolt, fill=(246, 254, 255, 255), width=7)
    # Floating crystal shards along rift edge
    for i in range(6):
        ang = i * math.tau / 6 + 0.3
        draw_crystal_shard(d, cx + math.cos(ang) * 145, cy + math.sin(ang) * 104, ang, 46, 13, CYAN if i % 2 == 0 else VIOLET)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# GROUP D: LIVING UNDERGROUND CAVES, STALAGMITES, FUNGI, CRYSTALS & LAIR (12)
# =============================================================================
def gen_stalagmite_cluster(w: int, h: int, seed: int, pillar: bool = False) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    r_max = W * (0.42 if pillar else 0.39)
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([cx - r_max + o[0], cy - r_max + o[1], cx + r_max + o[0], cy + r_max + o[1]], fill=c), (10, 12), 14.0, 112)
    d = ImageDraw.Draw(im)

    def rock_ring(rx: float, ry: float, rad: float, col: tuple[int, int, int], n: int = 14) -> None:
        pts = [(rx + math.cos(i * math.tau / n) * (rad + rng.uniform(-rad * 0.14, rad * 0.14)), ry + math.sin(i * math.tau / n) * (rad + rng.uniform(-rad * 0.14, rad * 0.14))) for i in range(n)]
        d.polygon(pts, fill=(*col, 255), outline=INK)
        d.line(pts + [pts[0]], fill=INK, width=5)

    if pillar:
        rock_ring(cx, cy, r_max, STONE_DK, 16)
        rock_ring(cx - 8, cy - 8, r_max * 0.78, STONE, 16)
        rock_ring(cx - 14, cy - 14, r_max * 0.56, LIMESTONE, 14)
        rock_ring(cx - 18, cy - 18, r_max * 0.32, blend_rgb(LIMESTONE, (242, 238, 224), 0.35)[:3], 12)
        # Moss clumps clinging to pillar base
        for a in (0.4, 2.2, 4.4):
            mx, my = cx + math.cos(a) * r_max * 0.78, cy + math.sin(a) * r_max * 0.78
            d.ellipse([mx - 24, my - 18, mx + 24, my + 18], fill=(*MOSS, 255), outline=INK_MID, width=3)
    else:
        # Multi-spire stalagmite cluster (3 tiered spires!)
        spires = [(cx - 38, cy - 28, 108), (cx + 68, cy + 28, 86), (cx - 56, cy + 68, 72)]
        for sx, sy, sr in spires:
            rock_ring(sx, sy, sr, STONE_DK, 12)
            rock_ring(sx - 5, sy - 5, sr * 0.68, STONE, 12)
            rock_ring(sx - 9, sy - 9, sr * 0.38, LIMESTONE, 10)
            draw_disc(d, sx - 12, sy - 12, sr * 0.16, (218, 212, 198), ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.2)


def gen_glow_shroom_cluster(w: int, h: int, seed: int, cap_rgb: tuple[int, int, int], spot_rgb: tuple[int, int, int], colorable: bool = False) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([48 + o[0], 48 + o[1], W - 48 + o[0], H - 48 + o[1]], fill=c), (8, 10), 12.0, 96)
    if not colorable:
        add_glow(im, cx, cy, W * 0.44, H * 0.44, cap_rgb, alpha=118, blur=24.0)
    d = ImageDraw.Draw(im)
    # 5 overlapping organic mushroom caps (small -> large)
    caps = [
        (cx - 78, cy + 54, 54), (cx + 82, cy + 44, 62),
        (cx + 62, cy - 58, 56), (cx - 56, cy - 52, 68), (cx, cy + 2, 92),
    ]
    for mx, my, mr in caps:
        dk = blend_rgb(cap_rgb, (16, 18, 26), 0.42)
        hi = blend_rgb(cap_rgb, (255, 255, 255), 0.45)
        d.ellipse([mx - mr, my - mr * 0.92, mx + mr, my + mr * 0.92], fill=dk, outline=INK, width=6)
        d.ellipse([mx - mr * 0.86, my - mr * 0.78, mx + mr * 0.86, my + mr * 0.78], fill=(*cap_rgb, 255))
        d.ellipse([mx - mr * 0.56, my - mr * 0.52, mx + mr * 0.46, my + mr * 0.42], fill=hi)
        # Glowing bioluminescent cap spots
        for _ in range(7):
            ang = rng.uniform(0, math.tau)
            dist = rng.uniform(0.18, 0.72) * mr
            sr = rng.uniform(mr * 0.08, mr * 0.15)
            d.ellipse([mx + math.cos(ang) * dist - sr, my + math.sin(ang) * dist - sr, mx + math.cos(ang) * dist + sr, my + math.sin(ang) * dist + sr], fill=(*spot_rgb, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_crystal_vein(w: int, h: int, seed: int, crys_rgb: tuple[int, int, int], colorable: bool = False) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([44 + o[0], 44 + o[1], W - 44 + o[0], H - 44 + o[1]], fill=c), (8, 10), 12.0, 105)
    if not colorable:
        add_glow(im, cx, cy, W * 0.44, H * 0.42, crys_rgb, alpha=128, blur=24.0)
    d = ImageDraw.Draw(im)
    # Dark jagged shale bedrock matrix base
    pts = [(cx + math.cos(i * math.tau / 12) * (134 + rng.uniform(-16, 18)), cy + math.sin(i * math.tau / 12) * (114 + rng.uniform(-16, 18))) for i in range(12)]
    d.polygon(pts, fill=(*SLATE, 255), outline=INK)
    d.line(pts + [pts[0]], fill=INK, width=6)
    # 9 faceted crystal spires erupting radially from the bedrock!
    for i in range(9):
        ang = i * math.tau / 9 + rng.uniform(-0.18, 0.18)
        length = rng.uniform(96, 152)
        hw = rng.uniform(22, 34)
        draw_crystal_shard(d, cx + math.cos(ang) * 14, cy + math.sin(ang) * 14, ang, length, hw, crys_rgb)
    # Central crown crystal facet
    draw_crystal_shard(d, cx - 18, cy + 12, -0.8, 92, 32, blend_rgb(crys_rgb, (255, 255, 255), 0.25)[:3])
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


def gen_hanging_roots(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([54 + o[0], 54 + o[1], W - 54 + o[0], H - 54 + o[1]], fill=c), (8, 12), 14.0, 88)
    d = ImageDraw.Draw(im)
    # Irregular earthen dirt & mossy bank patch underneath tangled gnarled roots
    for _ in range(12):
        dx, dy = cx + rng.uniform(-76, 76), cy + rng.uniform(-64, 64)
        dr = rng.uniform(34, 68)
        d.ellipse([dx - dr, dy - dr * 0.85, dx + dr, dy + dr * 0.85], fill=(*vary_rgb((78, 60, 44), rng, 10), 255), outline=INK_MID, width=2)
    # 5 thick twisting gnarled tree roots branching organically into crooked rootlets!
    for base_ang in (0.15, 1.35, 2.65, 3.9, 5.15):
        ang = base_ang + rng.uniform(-0.18, 0.18)
        pts = [(cx + math.cos(ang) * 18, cy + math.sin(ang) * 18)]
        for step in range(1, 5):
            ang += rng.uniform(-0.42, 0.42)
            dist = step * rng.uniform(38, 48)
            pts.append((cx + math.cos(ang) * dist, cy + math.sin(ang) * dist))
        d.line(pts, fill=INK, width=24)
        d.line(pts, fill=(*WALNUT, 255), width=14)
        d.line(pts[:3], fill=(*OAK, 255), width=5)
        # Side fork branch
        mid = pts[2]
        fang = ang + rng.choice([-0.75, 0.75])
        fpts = [mid, (mid[0] + math.cos(fang) * 52, mid[1] + math.sin(fang) * 52), (mid[0] + math.cos(fang + 0.35) * 86, mid[1] + math.sin(fang + 0.35) * 86)]
        d.line(fpts, fill=INK, width=14)
        d.line(fpts, fill=(*OAK, 255), width=7)
    # Lush hanging moss & damp soil tufts tangled in root forks
    for _ in range(11):
        mx, my = cx + rng.uniform(-72, 72), cy + rng.uniform(-68, 68)
        mr = rng.uniform(18, 32)
        d.ellipse([mx - mr, my - mr * 0.8, mx + mr, my + mr * 0.8], fill=(*vary_rgb(MOSS, rng, 14), 255), outline=INK_MID, width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0)


def gen_cave_moss_patch(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_glow(im, cx, cy, W * 0.42, H * 0.40, (66, 206, 152), alpha=72, blur=24.0)
    d = ImageDraw.Draw(im)
    for _ in range(34):
        ang = rng.uniform(0, math.tau)
        dist = rng.uniform(0, 148)
        mx, my = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist * 0.85
        mr = rng.uniform(22, 52)
        c = vary_rgb((54, 118, 86), rng, 18)
        d.ellipse([mx - mr, my - mr * 0.82, mx + mr, my + mr * 0.82], fill=(*c, 255))
    # Bright glowing lichen speckles
    for _ in range(28):
        ang = rng.uniform(0, math.tau)
        dist = rng.uniform(0, 128)
        lx, ly = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist * 0.82
        lr = rng.uniform(5, 11)
        d.ellipse([lx - lr, ly - lr, lx + lr, ly + lr], fill=(118, 242, 198, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


def gen_bone_hoard_pile(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([44 + o[0], 44 + o[1], W - 44 + o[0], H - 44 + o[1]], fill=c), (8, 10), 12.0, 96)
    d = ImageDraw.Draw(im)
    # Muddy lair mound
    for _ in range(18):
        mx, my = cx + rng.uniform(-110, 110), cy + rng.uniform(-85, 85)
        mr = rng.uniform(36, 62)
        d.ellipse([mx - mr, my - mr * 0.8, mx + mr, my + mr * 0.8], fill=(*vary_rgb((78, 66, 54), rng, 10), 255), outline=INK_MID, width=2)
    # Scattered bones + glinting gold coins + broken shield + 2 skulls!
    for _ in range(16):
        bx, by = cx + rng.uniform(-118, 118), cy + rng.uniform(-86, 86)
        ang = rng.uniform(0, math.tau)
        d.line([(bx, by), (bx + math.cos(ang) * 58, by + math.sin(ang) * 58)], fill=INK, width=12)
        d.line([(bx, by), (bx + math.cos(ang) * 58, by + math.sin(ang) * 58)], fill=(*BONE, 255), width=6)
    draw_disc(d, cx + 62, cy - 34, 42, (116, 82, 54), ink_w=5)
    draw_disc(d, cx + 62, cy - 34, 14, IRON, ink_w=3)
    for _ in range(22):
        gx, gy = cx + rng.uniform(-84, 84), cy + rng.uniform(-64, 64)
        d.ellipse([gx - 7, gy - 7, gx + 7, gy + 7], fill=(*BRASS_GOLD, 255), outline=INK, width=2)
    draw_skull_top(d, cx - 54, cy - 28, 28, 0.4)
    draw_skull_top(d, cx + 24, cy + 52, 24, 2.2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


def gen_ancient_runestone_shrine(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([38 + o[0], 38 + o[1], W - 38 + o[0], H - 38 + o[1]], fill=c), (8, 10), 14.0, 108)
    add_glow(im, cx, cy, 168, 168, VIOLET, alpha=116, blur=24.0)
    d = ImageDraw.Draw(im)
    # Stepped circular ancient obsidian dais with glowing Sovereign rune ring
    draw_disc(d, cx, cy, 168, STONE_DK, ink_w=6)
    draw_disc(d, cx, cy, 134, OBSIDIAN, ink_w=5)
    d.ellipse([cx - 104, cy - 104, cx + 104, cy + 104], outline=(*VIOLET, 255), width=8)
    d.ellipse([cx - 104, cy - 104, cx + 104, cy + 104], outline=(232, 204, 255, 255), width=3)
    # 4 moss-draped standing stone monoliths around ring + glowing central obelisk
    for i in range(4):
        ang = i * math.tau / 4 + math.pi / 4
        mx, my = cx + math.cos(ang) * 124, cy + math.sin(ang) * 124
        draw_beveled_rect(d, mx - 24, my - 24, mx + 24, my + 24, STONE, ink_w=5, radius=6)
        d.ellipse([mx - 10, my - 10, mx + 10, my + 10], fill=(*MOSS, 255))
    pts = poly_regular(cx, cy, 56, 6, 0)
    d.polygon(pts, fill=(*OBSIDIAN, 255), outline=INK)
    d.line(pts + [pts[0]], fill=INK, width=6)
    d.polygon(poly_regular(cx, cy, 32, 6, 0), fill=(*VIOLET, 255))
    d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(246, 234, 255, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


# =============================================================================
# GROUP E: BATCH 2 — SPEAKEASY, KELLER, BREWERY, GAOL, SEWER & CAVE SHOWSTOPPERS (12)
# =============================================================================
def gen_speakeasy_poker_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    r_out = W * 0.43
    oct_out = poly_regular(cx, cy, r_out, 8, math.pi / 8)
    add_contact_shadow(im, lambda sd, c, o: sd.polygon([(x + o[0], y + o[1]) for x, y in oct_out], fill=c), (10, 12), 14.0, 118)
    d = ImageDraw.Draw(im)
    # Deep mahogany octagonal rim + brass trim inlay
    d.polygon(oct_out, fill=(*WALNUT, 255), outline=INK)
    d.line(oct_out + [oct_out[0]], fill=INK, width=7)
    oct_rim = poly_regular(cx, cy, r_out * 0.87, 8, math.pi / 8)
    d.line(oct_rim + [oct_rim[0]], fill=(*BRASS_GOLD, 255), width=5)
    # Lush emerald baize felt surface + subtle gold dealer ring
    oct_felt = poly_regular(cx, cy, r_out * 0.81, 8, math.pi / 8)
    d.polygon(oct_felt, fill=(28, 108, 72, 255), outline=INK)
    d.line(oct_felt + [oct_felt[0]], fill=INK, width=5)
    d.ellipse([cx - r_out * 0.56, cy - r_out * 0.56, cx + r_out * 0.56, cy + r_out * 0.56], outline=(196, 168, 84, 255), width=4)
    # Central pot of poker chips (crimson, ivory, gold, obsidian)
    chip_cols = [(186, 44, 52), (236, 228, 206), BRASS_GOLD, (46, 52, 68)]
    for i in range(14):
        ang = rng.uniform(0, math.tau)
        dist = rng.uniform(6, 54)
        px, py = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
        draw_disc(d, px, py, 14, chip_cols[i % len(chip_cols)], ink_w=3)
    # 4 player seats: fanned playing cards + chip stacks + amber whiskey glasses
    for seat in range(4):
        ang = seat * math.pi / 2 + 0.15
        sx, sy = cx + math.cos(ang) * (r_out * 0.62), cy + math.sin(ang) * (r_out * 0.62)
        for ci, off in enumerate((-14, 0, 14)):
            ca = ang + (ci - 1) * 0.22
            px = sx + math.cos(ang + math.pi / 2) * off
            py = sy + math.sin(ang + math.pi / 2) * off
            card = []
            for dx, dy in [(-11, -16), (11, -16), (11, 16), (-11, 16)]:
                rx = px + dx * math.cos(ca) - dy * math.sin(ca)
                ry = py + dx * math.sin(ca) + dy * math.cos(ca)
                card.append((rx, ry))
            d.polygon(card, fill=(246, 240, 226, 255), outline=INK)
            d.line(card + [card[0]], fill=INK, width=3)
            suit_c = (188, 36, 44, 255) if (seat + ci) % 2 == 0 else (30, 32, 38, 255)
            d.ellipse([px - 4, py - 4, px + 4, py + 4], fill=suit_c)
        # Whiskey tumbler or chip stack beside seat
        gx = cx + math.cos(ang + 0.42) * (r_out * 0.66)
        gy = cy + math.sin(ang + 0.42) * (r_out * 0.66)
        if seat % 2 == 0:
            draw_disc(d, gx, gy, 17, (198, 214, 220), ink_w=3)
            draw_disc(d, gx, gy, 12, (192, 118, 38), ink_w=2)
        else:
            draw_disc(d, gx, gy, 15, BRASS_AGED, ink_w=3)
            d.ellipse([gx - 9, gy - 9, gx + 9, gy + 9], fill=(56, 52, 50, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_cellar_slatted_partition(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cy = H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.rectangle([24 + o[0], cy - 28 + o[1], W - 24 + o[0], cy + 28 + o[1]], fill=c), (6, 8), 10.0, 108)
    d = ImageDraw.Draw(im)
    # Main rough-sawn pine slatted top rail & iron brackets
    draw_wood_planks_box(d, 26, cy - 22, W - 26, cy + 22, PINE, rng, horizontal=True, n_planks=2, ink_w=5)
    # Vertical slat end-grain notches along the beam so it reads as top-down Berlin Kellerabteil slatted cage wall
    for sx in range(52, W - 52, 34):
        draw_beveled_rect(d, sx - 10, cy - 28, sx + 10, cy + 28, vary_rgb(OAK, rng, 12), ink_w=4, radius=2)
    # Heavy corner posts + central iron padlock clasp
    for px in (36, W // 2, W - 36):
        draw_beveled_rect(d, px - 22, cy - 34, px + 22, cy + 34, WALNUT, ink_w=5, radius=4)
        draw_disc(d, px, cy, 8, IRON, ink_w=2)
    # Iron padlock hanging slightly off-center latch
    draw_beveled_rect(d, W // 2 + 48, cy + 16, W // 2 + 78, cy + 44, IRON, ink_w=4, radius=5)
    draw_disc(d, W // 2 + 63, cy + 30, 5, BRASS_GOLD, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


def gen_brewery_copper_mash_tun(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    r = W * 0.40
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([cx - r + o[0], cy - r + o[1], cx + r + o[0], cy + r + o[1]], fill=c), (10, 12), 14.0, 118)
    add_glow(im, cx, cy, r * 0.65, r * 0.65, (242, 178, 72), alpha=86, blur=16.0)
    d = ImageDraw.Draw(im)
    # Brick-and-iron support collar
    draw_disc(d, cx, cy, r, IRON_DARK, ink_w=6)
    draw_disc(d, cx, cy, r * 0.92, COPPER, ink_w=5)
    # Rivet ring around copper dome rim
    for i in range(16):
        a = i * math.tau / 16
        draw_disc(d, cx + math.cos(a) * r * 0.84, cy + math.sin(a) * r * 0.84, 6, BRASS_GOLD, ink_w=2)
    # Open circular mash hatch showing bubbling golden-amber wort foam!
    draw_disc(d, cx - 10, cy + 8, r * 0.56, IRON, ink_w=5)
    draw_disc(d, cx - 10, cy + 8, r * 0.49, (186, 114, 34), ink_w=4)
    for _ in range(18):
        ang = rng.uniform(0, math.tau)
        dist = rng.uniform(0, r * 0.38)
        br = rng.uniform(8, 22)
        d.ellipse([cx - 10 + math.cos(ang) * dist - br, cy + 8 + math.sin(ang) * dist - br,
                   cx - 10 + math.cos(ang) * dist + br, cy + 8 + math.sin(ang) * dist + br],
                  fill=(242, 224, 176, 255), outline=(196, 152, 82, 255), width=2)
    # Hinged open copper lid swung to upper-right + brass steam pipe & pressure gauge
    draw_disc(d, cx + r * 0.56, cy - r * 0.44, r * 0.34, blend_rgb(COPPER, BRASS_GOLD, 0.28)[:3], ink_w=5)
    d.line([(cx + r * 0.22, cy - r * 0.72), (cx + r * 0.82, cy - r * 0.14)], fill=INK, width=22)
    d.line([(cx + r * 0.22, cy - r * 0.72), (cx + r * 0.82, cy - r * 0.14)], fill=(*BRASS, 255), width=12)
    draw_disc(d, cx - r * 0.58, cy - r * 0.52, 24, BRASS_GOLD, ink_w=4)
    d.ellipse([cx - r * 0.58 - 15, cy - r * 0.52 - 15, cx - r * 0.58 + 15, cy - r * 0.52 + 15], fill=(244, 238, 222, 255), outline=INK, width=2)
    d.line([(cx - r * 0.58, cy - r * 0.52), (cx - r * 0.58 + 10, cy - r * 0.52 - 8)], fill=(192, 38, 38, 255), width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


def gen_inquisition_interrogation_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rectangle([52 + o[0], 46 + o[1], W - 52 + o[0], H - 46 + o[1]], fill=c), (10, 12), 14.0, 118)
    add_glow(im, W * 0.28, H * 0.52, 74, 62, (255, 110, 42), alpha=120, blur=16.0)
    d = ImageDraw.Draw(im)
    # Heavy iron-bound dark walnut interrogation slab table
    draw_wood_planks_box(d, 54, 48, W - 54, H - 48, (76, 50, 38), rng, horizontal=True, n_planks=5, ink_w=6)
    # Iron corner plates & bolted restraint shackles on all 4 corners!
    for cx0, cy0 in [(72, 66), (W - 72, 66), (72, H - 66), (W - 72, H - 66)]:
        draw_beveled_rect(d, cx0 - 20, cy0 - 20, cx0 + 20, cy0 + 20, IRON, ink_w=4, radius=3)
        d.ellipse([cx0 - 11, cy0 - 11, cx0 + 11, cy0 + 11], outline=(168, 174, 182, 255), width=5)
    # Dark dried crimson stain near center-left
    d.ellipse([W * 0.36, H * 0.36, W * 0.56, H * 0.64], fill=(92, 22, 26, 255))
    # Glowing iron ember pan & red-hot branding iron on left end
    draw_beveled_rect(d, 96, H * 0.32, 214, H * 0.72, IRON_DARK, ink_w=5, radius=8)
    d.rectangle([112, H * 0.38, 198, H * 0.66], fill=(226, 78, 28, 255), outline=INK, width=3)
    d.ellipse([126, H * 0.44, 182, H * 0.60], fill=(255, 196, 86, 255))
    d.line([(164, H * 0.52), (288, H * 0.74)], fill=INK, width=12)
    d.line([(164, H * 0.52), (288, H * 0.74)], fill=(138, 142, 152, 255), width=6)
    d.line([(164, H * 0.52), (206, H * 0.60)], fill=(255, 162, 64, 255), width=6)
    # Open confession ledger & crimson wax seal + inkwell on right end
    draw_beveled_rect(d, W - 246, H * 0.28, W - 98, H * 0.72, (118, 32, 42), ink_w=5, radius=5)
    d.rectangle([W - 236, H * 0.32, W - 176, H * 0.68], fill=(238, 226, 198, 255), outline=INK_MID, width=2)
    d.rectangle([W - 170, H * 0.32, W - 108, H * 0.68], fill=(234, 222, 192, 255), outline=INK_MID, width=2)
    for ly in range(int(H * 0.37), int(H * 0.64), 14):
        d.line([(W - 228, ly), (W - 184, ly)], fill=(92, 74, 62, 255), width=3)
        d.line([(W - 162, ly), (W - 118, ly)], fill=(92, 74, 62, 255), width=3)
    draw_disc(d, W - 134, H * 0.60, 12, (176, 32, 42), ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_cave_smuggler_jetty(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rectangle([38 + o[0], 56 + o[1], W - 44 + o[0], H - 56 + o[1]], fill=c), (10, 12), 14.0, 112)
    d = ImageDraw.Draw(im)
    # Longitudinal timber stringers underneath
    d.rectangle([42, 86, W - 46, 114], fill=(*WALNUT, 255), outline=INK, width=4)
    d.rectangle([42, H - 114, W - 46, H - 86], fill=(*WALNUT, 255), outline=INK, width=4)
    # 11 weathered, slightly uneven damp mossy dock planks
    n_planks = 11
    pw = (W - 100) / n_planks
    for i in range(n_planks):
        px0 = 50 + i * pw + 2
        px1 = 50 + (i + 1) * pw - 3
        jit_t = rng.uniform(-10, 10)
        jit_b = rng.uniform(-10, 10)
        col = vary_rgb((118, 92, 66), rng, 14)
        draw_beveled_rect(d, px0, 62 + jit_t, px1, H - 62 + jit_b, col, ink_w=5, radius=3)
        # Subtle algae/moss patches on plank ends
        if i % 2 == 0:
            d.ellipse([px0 + 4, 72, px1 - 4, 112], fill=(*MOSS, 255))
    # 4 heavy vertical timber pilings + iron mooring ring + coiled wet rope
    for px, py in [(72, 72), (72, H - 72), (W - 76, 72), (W - 76, H - 72)]:
        draw_disc(d, px, py, 28, WALNUT, ink_w=6)
        draw_disc(d, px, py, 16, OAK, ink_w=3)
    # Coiled mooring rope at end of pier
    rx, ry = W - 156, H * 0.56
    for rr in (42, 32, 22, 12):
        d.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], outline=(182, 156, 108, 255), width=8)
        d.ellipse([rx - rr, ry - rr, rx + rr, ry + rr], outline=INK_MID, width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


def gen_cave_breached_masonry_rubble(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([36 + o[0], 44 + o[1], W - 36 + o[0], H - 44 + o[1]], fill=c), (8, 12), 14.0, 108)
    add_glow(im, cx, cy, W * 0.36, H * 0.32, VIOLET, alpha=86, blur=20.0)
    d = ImageDraw.Draw(im)
    # Crushed gravel & shale dust apron underneath
    for _ in range(28):
        gx, gy = cx + rng.uniform(-W * 0.38, W * 0.38), cy + rng.uniform(-H * 0.34, H * 0.34)
        gr = rng.uniform(22, 54)
        d.ellipse([gx - gr, gy - gr * 0.78, gx + gr, gy + gr * 0.78], fill=(*vary_rgb(STONE_DK, rng, 14), 255), outline=INK_MID, width=2)
    # Fractured cyclopean obsidian & limestone blocks tumbled across breach
    blocks = [
        (cx - 170, cy - 58, 118, 72, 0.24, STONE),
        (cx - 42, cy + 32, 132, 78, -0.18, OBSIDIAN),
        (cx + 112, cy - 42, 124, 68, 0.35, STONE),
        (cx + 188, cy + 44, 96, 62, -0.4, STONE_DK),
        (cx - 122, cy + 68, 92, 56, -0.32, LIMESTONE),
        (cx + 22, cy - 66, 106, 60, 0.14, OBSIDIAN),
    ]
    for bx, by, bw, bh, ang, col in blocks:
        ca, sa = math.cos(ang), math.sin(ang)
        pts = []
        for dx, dy in [(-bw / 2, -bh / 2), (bw / 2, -bh / 2), (bw / 2, bh / 2), (-bw / 2, bh / 2)]:
            pts.append((bx + dx * ca - dy * sa, by + dx * sa + dy * ca))
        d.polygon(pts, fill=(*col, 255), outline=INK)
        d.line(pts + [pts[0]], fill=INK, width=6)
        # Bevel highlight edge
        d.line([pts[0], pts[1]], fill=blend_rgb(col, (238, 232, 224), 0.34), width=4)
    # Glowing violet leyline shard & shattered iron rebar peeking through rubble
    d.line([(cx - 88, cy - 12), (cx + 96, cy + 16)], fill=INK, width=10)
    d.line([(cx - 88, cy - 12), (cx + 96, cy + 16)], fill=(*IRON, 255), width=5)
    draw_crystal_shard(d, cx - 18, cy + 8, -0.5, 68, 18, VIOLET)
    draw_crystal_shard(d, cx + 44, cy - 14, 0.65, 56, 15, CYAN)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0)


def gen_cellar_rolled_carpets_trunk(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([36 + o[0], 36 + o[1], W - 36 + o[0], H - 36 + o[1]], fill=c), (8, 10), 12.0, 108)
    d = ImageDraw.Draw(im)
    # Strapped vintage brass-cornered steamer trunk on left
    draw_beveled_rect(d, 44, 62, 254, H - 56, (108, 62, 42), ink_w=6, radius=10)
    for sx in (88, 210):
        d.rectangle([sx - 10, 62, sx + 10, H - 56], fill=(*WALNUT, 255), outline=INK, width=3)
    for cx0, cy0 in [(54, 72), (244, 72), (54, H - 66), (244, H - 66)]:
        draw_disc(d, cx0, cy0, 12, BRASS_GOLD, ink_w=3)
    # Two rolled-up dusty Persian carpets tied with twine on right!
    for rx0, ry0, rx1, ry1, col, stripe in [
        (274, 48, 354, H - 46, (148, 42, 48), (218, 178, 92)),
        (362, 68, 434, H - 58, (54, 88, 114), (196, 162, 104)),
    ]:
        draw_beveled_rect(d, rx0, ry0, rx1, ry1, col, ink_w=5, radius=18)
        for sy in range(ry0 + 36, ry1 - 24, 44):
            d.line([(rx0 + 8, sy), (rx1 - 8, sy)], fill=(*stripe, 255), width=8)
        # Twine tie bands
        for ty in (ry0 + (ry1 - ry0) * 0.28, ry0 + (ry1 - ry0) * 0.72):
            d.line([(rx0 - 2, ty), (rx1 + 2, ty)], fill=INK, width=9)
            d.line([(rx0 - 2, ty), (rx1 + 2, ty)], fill=(208, 186, 138, 255), width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


def gen_cave_bioluminescent_tidepool(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_glow(im, cx, cy, W * 0.44, H * 0.42, (48, 224, 214), alpha=126, blur=26.0)
    d = ImageDraw.Draw(im)

    def blob(rx: float, ry: float, col: tuple[int, int, int], ink_w: int = 5) -> None:
        pts = []
        for i in range(18):
            a = i * math.tau / 18
            j = 1.0 + 0.14 * math.sin(a * 3 + seed) + 0.08 * math.cos(a * 5)
            pts.append((cx + math.cos(a) * rx * j, cy + math.sin(a) * ry * j))
        d.polygon(pts, fill=(*col, 255), outline=INK if ink_w > 0 else None)
        if ink_w > 0:
            d.line(pts + [pts[0]], fill=INK, width=ink_w)

    # Outer mineral calcite rim -> deep teal water -> glowing turquoise inner pool
    blob(W * 0.42, H * 0.39, LIMESTONE, ink_w=6)
    blob(W * 0.36, H * 0.33, (22, 84, 98), ink_w=4)
    blob(W * 0.28, H * 0.25, (38, 162, 174), ink_w=0)
    blob(W * 0.18, H * 0.16, (94, 236, 228), ink_w=0)
    # Shimmering bioluminescent spore eddies & wet calcite pebbles
    for _ in range(24):
        a = rng.uniform(0, math.tau)
        dist = rng.uniform(0.05, 0.28)
        px, py = cx + math.cos(a) * W * dist, cy + math.sin(a) * H * dist
        pr = rng.uniform(4, 10)
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(208, 255, 252, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_mine_ore_chute_hopper(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rectangle([42 + o[0], 42 + o[1], W - 42 + o[0], H - 42 + o[1]], fill=c), (10, 12), 14.0, 114)
    add_glow(im, W * 0.54, H * 0.72, 116, 86, CYAN, alpha=110, blur=20.0)
    d = ImageDraw.Draw(im)
    # Heavy bolted mine timber hopper frame (top half) + tapering metal ore chute (bottom half)
    draw_wood_planks_box(d, 56, 44, W - 56, H * 0.56, OAK, rng, horizontal=True, n_planks=5, ink_w=6)
    # Dark interior funnel filled with crushed shale & glowing cyan aether ore chunks
    d.rectangle([92, 74, W - 92, H * 0.48], fill=(42, 46, 54, 255), outline=INK, width=5)
    # Angled iron chute pouring out toward bottom (+Y)
    chute = [(136, H * 0.48), (W - 136, H * 0.48), (W - 168, H - 54), (168, H - 54)]
    d.polygon(chute, fill=(*IRON, 255), outline=INK)
    d.line(chute + [chute[0]], fill=INK, width=6)
    # Spilled ore rocks & glowing cyan crystal shards inside hopper + spilling down chute
    for _ in range(20):
        ox = rng.uniform(110, W - 110)
        oy = rng.uniform(86, H * 0.44)
        rr = rng.uniform(14, 26)
        col = CYAN if rng.random() < 0.42 else STONE_DK
        d.ellipse([ox - rr, oy - rr * 0.8, ox + rr, oy + rr * 0.8], fill=(*col, 255), outline=INK, width=3)
    for ox, oy, ang in [(W * 0.44, H * 0.62, 1.3), (W * 0.56, H * 0.70, 1.8), (W * 0.49, H * 0.76, 1.5)]:
        draw_crystal_shard(d, ox, oy, ang, 38, 12, CYAN)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


def gen_sewer_overflow_sludge_grate(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    d = ImageDraw.Draw(im)
    # Wet mossy stone surround curb
    draw_beveled_rect(d, 38, 38, W - 38, H - 38, STONE_DK, ink_w=6, radius=14)
    # Dark flooded sewer sump underneath bars
    d.rectangle([72, 68, W - 72, H - 68], fill=(18, 34, 32, 255), outline=INK, width=5)
    # Murky green-teal sludge shimmer inside sump
    d.ellipse([cx - 96, cy - 58, cx + 96, cy + 58], fill=(34, 68, 56, 255))
    # Heavy rusted cast-iron grating bars + central cross-bar & iron pull ring
    for bx in range(96, W - 80, 36):
        d.rectangle([bx - 8, 66, bx + 8, H - 66], fill=(*IRON, 255), outline=INK, width=3)
    d.rectangle([70, cy - 10, W - 70, cy + 10], fill=(*IRON_DARK, 255), outline=INK, width=3)
    # Rust & moss clinging to corners
    for mx, my in [(62, 62), (W - 64, H - 64), (W - 72, 74)]:
        d.ellipse([mx - 24, my - 18, mx + 24, my + 18], fill=(*MOSS, 255))
    d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], outline=(*BRASS_AGED, 255), width=7)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


def gen_cult_pale_root_altar(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([48 + o[0], 48 + o[1], W - 48 + o[0], H - 48 + o[1]], fill=c), (10, 12), 14.0, 114)
    add_glow(im, cx, cy, W * 0.42, H * 0.38, EMERALD, alpha=118, blur=24.0)
    d = ImageDraw.Draw(im)
    # Cracked dark mossy altar slab
    draw_beveled_rect(d, 84, 78, W - 84, H - 78, STONE_DK, ink_w=6, radius=14)
    draw_beveled_rect(d, 108, 98, W - 108, H - 98, SLATE, ink_w=4, radius=8)
    # Bone-white gnarled Pale Roots curving organically & tapering with forked rootlets!
    for base_ang in (0.15, 1.05, 2.05, 3.15, 4.15, 5.25):
        ang = base_ang
        pts = [(cx + math.cos(ang) * 28, cy + math.sin(ang) * 22)]
        for s in range(1, 7):
            ang += math.sin(s * 1.15 + base_ang) * 0.28 + rng.uniform(-0.14, 0.14)
            pts.append((cx + math.cos(ang) * (24 + s * 30), cy + math.sin(ang) * (20 + s * 24)))
        for idx_p in range(len(pts) - 1):
            t = idx_p / (len(pts) - 1)
            w_ink = max(7, int(22 * (1.0 - t * 0.55)))
            w_bone = max(4, int(13 * (1.0 - t * 0.55)))
            d.line([pts[idx_p], pts[idx_p + 1]], fill=INK, width=w_ink)
            d.line([pts[idx_p], pts[idx_p + 1]], fill=(*BONE, 255), width=w_bone)
            if idx_p < 4:
                d.line([pts[idx_p], pts[idx_p + 1]], fill=(246, 242, 232, 255), width=max(2, w_bone // 3))
            if idx_p in (2, 4):
                # Forked creeping rootlet
                mid = pts[idx_p]
                fang = ang + (0.65 if idx_p == 2 else -0.65)
                tip = (mid[0] + math.cos(fang) * 44, mid[1] + math.sin(fang) * 38)
                d.line([mid, tip], fill=INK, width=10)
                d.line([mid, tip], fill=(*BONE, 255), width=5)
    # Clinging damp emerald moss tufts around root base
    for ma in (0.6, 2.5, 3.8, 5.7):
        mx, my = cx + math.cos(ma) * 92, cy + math.sin(ma) * 76
        d.ellipse([mx - 20, my - 15, mx + 20, my + 15], fill=(*MOSS, 255), outline=INK_MID, width=2)
    # Central obsidian offering bowl pulsing with emerald bioluminescent ichor
    draw_disc(d, cx, cy, 62, OBSIDIAN, ink_w=6)
    draw_disc(d, cx, cy, 46, (34, 152, 112), ink_w=3)
    draw_disc(d, cx, cy, 24, (132, 252, 198), ink_w=0)
    # Glowing emerald tallow candles at corners
    for kx, ky in [(126, 118), (W - 126, 118), (126, H - 118), (W - 126, H - 118)]:
        draw_disc(d, kx, ky, 16, (176, 224, 186), ink_w=3)
        d.ellipse([kx - 6, ky - 6, kx + 6, ky + 6], fill=(226, 255, 196, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


def gen_crypt_wall_candle_cairn(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, c, o: sd.rectangle([38 + o[0], 46 + o[1], W - 38 + o[0], H - 46 + o[1]], fill=c), (8, 10), 12.0, 108)
    add_glow(im, W * 0.5, H * 0.5, W * 0.44, H * 0.42, WARM_GLOW, alpha=124, blur=22.0)
    d = ImageDraw.Draw(im)
    # Carved dark stone crypt memorial plinth
    draw_beveled_rect(d, 42, 48, W - 42, H - 48, STONE_DK, ink_w=6, radius=10)
    draw_beveled_rect(d, 58, 62, W - 58, H - 62, STONE, ink_w=4, radius=6)
    # Decades of melted ivory/amber wax rivers blanketing the stone shelf!
    for _ in range(24):
        wx = rng.uniform(76, W - 76)
        wy = rng.uniform(76, H - 76)
        wr = rng.uniform(22, 46)
        d.ellipse([wx - wr, wy - wr * 0.72, wx + wr, wy + wr * 0.72], fill=(236, 222, 188, 255), outline=(188, 168, 128, 255), width=2)
    # Two small brass reliquary urns + 14 flickering vigil candle pillars!
    draw_disc(d, 118, H * 0.5, 28, BRASS_AGED, ink_w=4)
    draw_disc(d, W - 118, H * 0.5, 28, BRASS_AGED, ink_w=4)
    for _ in range(14):
        kx = rng.uniform(96, W - 96)
        ky = rng.uniform(86, H - 86)
        kr = rng.uniform(11, 18)
        draw_disc(d, kx, ky, kr, (246, 236, 206), ink_w=3)
        d.ellipse([kx - 7, ky - 7, kx + 7, ky + 7], fill=(255, 198, 72, 255))
        d.ellipse([kx - 3, ky - 3, kx + 3, ky + 3], fill=(255, 252, 232, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


# =============================================================================
# MASTER BUILDER FOR ALL 52 SUBTERRANEAN, BASEMENT & CAVE ASSETS
# =============================================================================
def build_all() -> None:
    print("=== Dice Chaos Maps: Building 52 Subterranean, Basement & Cave Assets ===")
    specs: list[tuple[str, str, list[str], str, bool, Image.Image]] = []

    def add(stem: str, name: str, tags: list[str], im: Image.Image, draw_mode: str = "normal", shadow: bool = True) -> None:
        specs.append((stem, name, tags, draw_mode, shadow, im))

    # Group A: Basements & Cellars (10)
    add("sub_ice_block_sawdust_pile", "Sawdust-Packed Cellar Ice Blocks & Tongs",
        ["subterranean", "basement", "cellar", "ice", "cold_storage", "ice_cream", "harmony"],
        gen_ice_block_sawdust(256, 192, 7101))
    add("sub_cryo_brine_chiller_vat", "Magipunk Cryo-Brine Chiller Coils Vat",
        ["subterranean", "basement", "cellar", "cryo", "magipunk", "ice_cream", "aether", "harmony"],
        gen_cryo_brine_chiller(256, 224, 7102))
    add("sub_milk_cream_can_rack", "Cold-Cellar Dairy Cream Can Rack",
        ["subterranean", "basement", "cellar", "dairy", "ice_cream", "kitchen", "harmony"],
        gen_milk_cream_can_rack(224, 144, 7103))
    add("sub_wine_cask_rack_double", "Double Oak Cellar Wine Cask Cradle",
        ["subterranean", "basement", "cellar", "wine", "barrel", "tavern", "cathedral", "harmony"],
        gen_wine_cask_rack_double(256, 176, 7104))
    add("sub_dusty_wine_bottle_shelf", "Cobwebbed Vintage Wine Bottle Rack",
        ["subterranean", "basement", "cellar", "wine", "shelf", "secret", "manor", "harmony"],
        gen_dusty_wine_shelf(240, 128, 7105))
    add("sub_preserved_jars_pantry_shelf", "Root-Cellar Pickled Jars & Pantry Shelf",
        ["subterranean", "basement", "cellar", "pantry", "jars", "tenement", "kitchen", "harmony"],
        gen_preserved_jars_shelf(224, 128, 7106))
    add("sub_root_cellar_potato_bins", "Slatted Root-Cellar Vegetable Bins",
        ["subterranean", "basement", "cellar", "vegetables", "produce", "bakery", "harmony"],
        gen_root_cellar_bins(224, 160, 7107))
    add("sub_slatted_keller_storage_pile", "Berlin Tenement Keller Storage Junk Pile",
        ["subterranean", "basement", "cellar", "tenement", "clutter", "berlin", "storage", "harmony"],
        gen_keller_storage_pile(240, 192, 7108))
    add("sub_copper_wash_boiler_tub", "Basement Brick-Set Copper Laundry Boiler",
        ["subterranean", "basement", "cellar", "laundry", "copper", "tenement", "home", "harmony"],
        gen_copper_wash_boiler(208, 176, 7109))
    add("sub_moonshine_copper_still", "Bootlegger Copper Moonshine & Absinthe Still",
        ["subterranean", "basement", "cellar", "smuggler", "still", "alchemy", "copper", "harmony"],
        gen_moonshine_still(256, 192, 7110))

    # Group B: Crypts, Secret Vaults & Black-Site (10)
    add("sub_stone_sarcophagus_carved", "Carved Limestone Cathedral Sarcophagus",
        ["subterranean", "crypt", "catacomb", "sarcophagus", "tomb", "cathedral", "dungeon", "harmony"],
        gen_sarcophagus(256, 160, 7201, ajar=False))
    add("sub_sarcophagus_lid_ajar", "Pushed-Ajar Crypt Sarcophagus & Bones",
        ["subterranean", "crypt", "catacomb", "sarcophagus", "tomb", "secret", "dungeon", "harmony"],
        gen_sarcophagus(256, 176, 7202, ajar=True))
    add("sub_ossuary_skull_alcove", "Catacomb Stacked Skull Ossuary Niche",
        ["subterranean", "crypt", "catacomb", "ossuary", "bones", "skull", "cathedral", "harmony"],
        gen_ossuary_alcove(240, 128, 7203))
    add("sub_scattered_skeleton_remains", "Ancient Dungeon & Cave Skeleton Remains",
        ["subterranean", "crypt", "cave", "dungeon", "bones", "skeleton", "lair", "harmony"],
        gen_skeleton_remains(192, 176, 7204), shadow=False)
    add("sub_secret_floor_trapdoor_rug", "Concealed Cellar Trapdoor Under Frayed Rug",
        ["subterranean", "basement", "secret", "trapdoor", "hatch", "smuggler", "dungeon", "harmony"],
        gen_secret_trapdoor_rug(192, 192, 7205), shadow=False)
    add("sub_iron_barred_cell_pallet", "Inquisition Gaol Straw Pallet & Chains",
        ["subterranean", "dungeon", "prison", "cell", "chains", "inquisition", "harmony"],
        gen_prison_cell_pallet(208, 144, 7206))
    add("sub_cursed_relic_containment_cage", "Magipunk Cursed Relic Faraday Containment Cage",
        ["subterranean", "dungeon", "vault", "arcane", "aether", "inquisition", "sovereign", "harmony"],
        gen_cursed_relic_cage(208, 208, 7207))
    add("sub_smuggler_speakeasy_bar", "Underground Speakeasy Aether-Absinthe Bar",
        ["subterranean", "basement", "speakeasy", "smuggler", "tavern", "bar", "berlin", "harmony"],
        gen_speakeasy_bar(288, 160, 7208))
    add("sub_counterfeit_printing_press", "Smuggler Counterfeit Banknote Printing Press",
        ["subterranean", "basement", "smuggler", "vault", "press", "berlin", "crime", "harmony"],
        gen_counterfeit_press(240, 176, 7209))
    add("sub_aether_pump_gear_well", "Municipal Magipunk Water & Aether Pump Shaft",
        ["subterranean", "sewer", "basement", "pump", "gears", "magipunk", "berlin", "harmony"],
        gen_aether_pump_gear_well(288, 288, 7210))

    # Group C: Sewers, Bridges, Shafts & Leyline Rift (8)
    add("sub_sewer_iron_catwalk_bridge", "Riveted Iron Sewer & Cistern Footbridge",
        ["subterranean", "sewer", "bridge", "iron", "catwalk", "dungeon", "harmony"],
        gen_sewer_iron_bridge(240, 144, 7301))
    add("sub_sewer_pipe_outfall_grate", "Mossy Brick Sewer Culvert Outfall Grate",
        ["subterranean", "sewer", "pipe", "grate", "water", "dungeon", "harmony"],
        gen_sewer_pipe_outfall(192, 144, 7302), shadow=False)
    add("sub_iron_shaft_ladder_down", "Vertical Iron Access Shaft & Descending Ladder",
        ["subterranean", "sewer", "basement", "ladder", "shaft", "hatch", "stairs", "harmony"],
        gen_iron_shaft_ladder(144, 144, 7303), shadow=False)
    add("sub_rope_sinkhole_descent", "Cavern Sinkhole Pit & Knotted Descent Rope",
        ["subterranean", "cave", "sinkhole", "rope", "shaft", "dungeon", "harmony"],
        gen_rope_sinkhole_descent(224, 224, 7304), shadow=False)
    add("sub_smuggler_rowboat_moored", "Moored Underground River Smuggler Rowboat",
        ["subterranean", "cave", "sewer", "boat", "rowboat", "water", "smuggler", "harmony"],
        gen_smuggler_rowboat(256, 144, 7305))
    add("sub_rickety_cave_plank_bridge", "Rope-Lashed Underground Cavern Plank Bridge",
        ["subterranean", "cave", "bridge", "wood", "dungeon", "chasm", "harmony"],
        gen_rickety_cave_bridge(272, 144, 7306))
    add("sub_cave_stepping_stones_wet", "Mossy Subterranean Stream Stepping Stones",
        ["subterranean", "cave", "stones", "water", "stream", "grotto", "harmony"],
        gen_cave_stepping_stones(224, 160, 7307), shadow=False)
    add("sub_primordial_leyline_rift", "Primordial Obsidian Aether Leyline Rift",
        ["subterranean", "cave", "sovereign", "leyline", "aether", "arcane", "rift", "cathedral", "harmony"],
        gen_primordial_leyline_rift(320, 256, 7308), shadow=False)

    # Group D: Living Underground Caves, Crystals, Fungi & Lair Props (12)
    add("sub_cave_stalagmite_cluster_lg", "Wet Limestone Cavern Stalagmite Cluster",
        ["subterranean", "cave", "cavern", "stalagmite", "rock", "stone", "harmony"],
        gen_stalagmite_cluster(224, 224, 7401, pillar=False))
    add("sub_cave_pillar_column", "Floor-to-Ceiling Natural Limestone Cave Pillar",
        ["subterranean", "cave", "cavern", "pillar", "column", "rock", "harmony"],
        gen_stalagmite_cluster(240, 240, 7402, pillar=True))
    add("sub_cave_glow_shroom_cluster_cyan", "Bioluminescent Turquoise Cave Mushroom Cluster",
        ["subterranean", "cave", "cavern", "mushroom", "fungi", "glow", "cyan", "grotto", "harmony"],
        gen_glow_shroom_cluster(208, 192, 7403, (48, 192, 186), (192, 255, 248)))
    add("sub_cave_glow_shroom_cluster_violet", "Bioluminescent Amethyst Cave Mushroom Cluster",
        ["subterranean", "cave", "cavern", "mushroom", "fungi", "glow", "violet", "grotto", "harmony"],
        gen_glow_shroom_cluster(208, 192, 7404, (148, 78, 214), (242, 206, 255)))
    add("sub_cave_crystal_vein_cyan_lg", "Raw Cyan Magipunk Aether Crystal Outcrop",
        ["subterranean", "cave", "cavern", "crystal", "aether", "cyan", "mine", "magipunk", "harmony"],
        gen_crystal_vein(240, 208, 7405, CYAN))
    add("sub_cave_crystal_vein_amethyst_lg", "Raw Amethyst Arcane Crystal Cave Outcrop",
        ["subterranean", "cave", "cavern", "crystal", "amethyst", "violet", "arcane", "mine", "harmony"],
        gen_crystal_vein(240, 208, 7406, VIOLET))
    add("sub_cave_hanging_roots_canopy", "Subterranean Hanging Park Tree Roots Cluster",
        ["subterranean", "cave", "cavern", "roots", "burrow", "nature", "flora", "harmony"],
        gen_hanging_roots(240, 224, 7407))
    add("sub_cave_moss_lichen_patch", "Bioluminescent Emerald Cave Lichen & Moss Patch",
        ["subterranean", "cave", "cavern", "moss", "lichen", "decal", "grotto", "harmony"],
        gen_cave_moss_patch(224, 192, 7408), shadow=False)
    add("sub_cave_bone_hoard_pile", "Monster Lair Gnawed Bones & Buried Gold Hoard",
        ["subterranean", "cave", "cavern", "lair", "bones", "treasure", "dungeon", "harmony"],
        gen_bone_hoard_pile(224, 192, 7409))
    add("sub_cave_ancient_runestone_shrine", "Ancient Pre-City Sovereign Runestone Ring Shrine",
        ["subterranean", "cave", "crypt", "shrine", "sovereign", "arcane", "obsidian", "harmony"],
        gen_ancient_runestone_shrine(224, 224, 7410))
    add("sub_cave_colorable_crystal_cluster", "Colorable Raw Cavern Crystal Spire Outcrop",
        ["subterranean", "cave", "cavern", "crystal", "colorable", "dd_red", "mine", "harmony"],
        gen_crystal_vein(208, 208, 7411, DD_RED_BASE, colorable=True), draw_mode="dd_red")
    add("sub_cave_colorable_glow_shrooms", "Colorable Giant Cave Mushroom Cluster",
        ["subterranean", "cave", "cavern", "mushroom", "fungi", "colorable", "dd_red", "grotto", "harmony"],
        gen_glow_shroom_cluster(208, 192, 7412, DD_RED_BASE, DD_RED_HI, colorable=True), draw_mode="dd_red")

    # Group E: Batch 2 — Speakeasy, Keller, Brewery, Gaol, Sewer & Cave Showstoppers (12)
    batch2_start = len(specs)
    add("sub_speakeasy_poker_table_felt", "Speakeasy Green-Baize Octagonal Poker Table",
        ["subterranean", "speakeasy", "poker", "gambling", "tavern", "table", "berlin", "harmony"],
        gen_speakeasy_poker_table(256, 256, 7501))
    add("sub_cellar_wooden_slatted_partition", "Berlin Tenement Slatted Pine Keller Partition",
        ["subterranean", "basement", "cellar", "tenement", "keller", "berlin", "divider", "harmony"],
        gen_cellar_slatted_partition(288, 96, 7502))
    add("sub_brewery_copper_mash_tun", "Cellar Riveted Copper Brewery Mash Tun Vat",
        ["subterranean", "basement", "cellar", "brewery", "copper", "vat", "tavern", "harmony"],
        gen_brewery_copper_mash_tun(240, 240, 7503))
    add("sub_inquisition_interrogation_table", "Inquisition Black-Site Shackled Interrogation Table",
        ["subterranean", "dungeon", "prison", "inquisition", "table", "chains", "sovereign", "harmony"],
        gen_inquisition_interrogation_table(272, 168, 7504))
    add("sub_cave_wooden_smuggler_jetty", "Moss-Slick Underground Lake Smuggler Pier Jetty",
        ["subterranean", "cave", "dock", "pier", "jetty", "water", "smuggler", "harmony"],
        gen_cave_smuggler_jetty(288, 176, 7505))
    add("sub_cave_breached_masonry_rubble", "Shattered Obsidian Vault Wall Breach Rubble",
        ["subterranean", "cave", "rubble", "breach", "ruin", "obsidian", "dungeon", "harmony"],
        gen_cave_breached_masonry_rubble(304, 192, 7506))
    add("sub_cellar_rolled_carpets_trunk", "Dusty Cellar Steamer Trunk & Rolled Persian Rugs",
        ["subterranean", "basement", "cellar", "tenement", "clutter", "trunk", "rugs", "harmony"],
        gen_cellar_rolled_carpets_trunk(240, 192, 7507))
    add("sub_cave_bioluminescent_tidepool", "Bioluminescent Limestone Cavern Mineral Tidepool",
        ["subterranean", "cave", "cavern", "water", "pool", "glow", "grotto", "harmony"],
        gen_cave_bioluminescent_tidepool(256, 224, 7508), shadow=False)
    add("sub_mine_wooden_ore_chute_hopper", "Aether-Crystal Mine Timber Ore Chute & Hopper",
        ["subterranean", "cave", "mine", "ore", "crystal", "aether", "magipunk", "harmony"],
        gen_mine_ore_chute_hopper(240, 208, 7509))
    add("sub_sewer_overflow_sludge_grate", "Mossy Cast-Iron Cellar & Sewer Floor Sump Grate",
        ["subterranean", "sewer", "basement", "grate", "drain", "dungeon", "harmony"],
        gen_sewer_overflow_sludge_grate(208, 176, 7510), shadow=False)
    add("sub_cult_pale_root_altar", "Pale Root Cult Bone-Vine & Emerald Ichor Altar",
        ["subterranean", "crypt", "cult", "altar", "roots", "ritual", "cave", "harmony"],
        gen_cult_pale_root_altar(256, 208, 7511))
    add("sub_crypt_wall_candle_cairn", "Wax-Crusted Catacomb Vigil Candle Cairn Shelf",
        ["subterranean", "crypt", "catacomb", "candles", "memorial", "cathedral", "harmony"],
        gen_crypt_wall_candle_cairn(240, 152, 7512))

    manifest_updates: list[dict] = []
    qa_entries: list[tuple[str, Image.Image]] = []
    batch2_qa: list[tuple[str, Image.Image]] = []
    for idx, (stem, name, tags, draw_mode, shadow, im) in enumerate(specs):
        rel = f"props/subterranean_caves/{stem}.png"
        im.save(OUT_DIR / f"{stem}.png", "PNG")
        manifest_updates.append(
            {
                "path": rel,
                "displayName": name,
                "category": "object",
                "tags": tags,
                "widthPx": im.width,
                "heightPx": im.height,
                "defaultPpi": 256,
                "drawMode": draw_mode,
                "castsShadow": shadow,
                "dominantHex": dominant_hex(im),
            }
        )
        qa_entries.append((stem.replace("sub_", ""), im))
        if idx >= batch2_start:
            batch2_qa.append((stem.replace("sub_", ""), im))

    mpath = MOD_DIR / "manifest.json"
    total = upsert_manifest_entries(mpath, manifest_updates)
    print(f"  Generated {len(specs)} bespoke subterranean/cave assets -> {mpath} ({total} total modular-suite-cc0 assets)")
    save_qa_sheet(qa_entries, SCRATCH_DIR / "qa_subterranean_suite.png", cols=8, cw=176, ch=150)
    save_qa_sheet(batch2_qa, SCRATCH_DIR / "qa_subterranean_batch2.png", cols=4, cw=240, ch=210)


if __name__ == "__main__":
    build_all()

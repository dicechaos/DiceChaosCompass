"""
Dice Chaos Compass — Wave 2 Modular Splits Generator (Batch A: 68 Standalone Assets)

Splits every composite hero across the first 4 post-Wave-1 packs into clean-room,
2x-supersampled Studio Harmony bare furniture bases + standalone loose sub-props:
  1. props/subterranean_caves/     (22 splits, incl. 1 dd_red colorable)
  2. props/watchtower_garrison/    (20 splits, incl. 1 dd_red colorable)
  3. props/boulevard_shops/        (22 splits, incl. 2 dd_red colorable)
  4. props/community_kid_theater/  (4 remaining modular gap splits)

Preserves 100% of original composite heroes untouched. Every entry carries
`"modular"` and `"modular_split_v2"` tags (plus `"bare"` on bare bases) so the
Asset Vault's "Modular Splits" facet surfaces all 118 Wave 2 pieces alongside Wave 1!
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from harmony_art_engine import (
    MOD_DIR,
    SCRATCH_DIR,
    INK,
    INK_MID,
    DD_RED_BASE,
    DD_RED_DEEP,
    DD_RED_HI,
    new_hi,
    apply_painterly_finish,
    draw_beveled_rect,
    draw_wood_planks_box,
    blend_rgb,
    vary_rgb,
    save_qa_sheet,
    upsert_manifest_entries,
    dominant_hex,
)

# Unified Studio Harmony palette
WALNUT = (94, 62, 42)
MAHOGANY = (118, 52, 42)
OAK = (156, 114, 72)
PINE = (188, 150, 100)
PINE_LT = (210, 176, 126)
STONE = (150, 148, 140)
STONE_DK = (96, 98, 102)
STONE_LT = (196, 192, 180)
IRON = (64, 70, 78)
IRON_DK = (36, 40, 48)
STEEL = (138, 148, 158)
ZINC = (168, 176, 180)
BRASS = (206, 164, 74)
BRASS_HI = (240, 208, 118)
COPPER = (188, 108, 66)
GOLD = (228, 184, 62)
BAIZE = (44, 112, 74)
CREAM = (242, 234, 214)
LINEN = (228, 216, 192)
PAPER = (238, 228, 202)
LEATHER = (134, 80, 48)
LEATHER_DK = (76, 46, 28)
GLASS = (176, 212, 224)
ICE = (186, 226, 240)
ABSINTHE = (112, 218, 122)
CYAN = (92, 214, 232)
CRIMSON = (178, 46, 54)
BURGUNDY = (128, 42, 54)
PRUSSIAN = (44, 76, 114)
TEAL = (54, 124, 126)
OCHRE = (202, 148, 60)
SAGE = (100, 134, 96)
STRAW = (204, 174, 98)
BURLAP = (180, 154, 112)


def finish_prop(
    im: Image.Image,
    w: int,
    h: int,
    seed: int,
    grain: float = 5.0,
    warm_bevel: bool = True,
    shadow_offset: tuple[int, int] = (6, 8),
    shadow_blur: float = 7.0,
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
    return apply_painterly_finish(canvas, w, h, seed=seed, grain=grain, warm_bevel=warm_bevel)


def draw_disc(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, rgb: tuple[int, int, int], ink_w: int = 4) -> None:
    dk = blend_rgb(rgb, (18, 14, 14), 0.38)
    hi = blend_rgb(rgb, (255, 250, 236), 0.38)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dk, outline=INK, width=ink_w)
    d.ellipse([cx - r * 0.84, cy - r * 0.84, cx + r * 0.84, cy + r * 0.84], fill=(*rgb, 255))
    if r >= 8:
        d.arc([cx - r * 0.65, cy - r * 0.65, cx + r * 0.65, cy + r * 0.65], 195, 310, fill=hi, width=max(2, int(r * 0.14)))


def draw_oct_table(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, rim_rgb, top_rgb) -> None:
    pts = [(cx + math.cos(i * math.pi / 4 + math.pi / 8) * r, cy + math.sin(i * math.pi / 4 + math.pi / 8) * r) for i in range(8)]
    d.polygon(pts, fill=(*rim_rgb, 255), outline=INK)
    d.line(pts + [pts[0]], fill=INK, width=6)
    inner = [(cx + math.cos(i * math.pi / 4 + math.pi / 8) * r * 0.82, cy + math.sin(i * math.pi / 4 + math.pi / 8) * r * 0.82) for i in range(8)]
    d.polygon(inner, fill=(*top_rgb, 255), outline=INK)
    d.line(inner + [inner[0]], fill=INK_MID, width=4)


# =============================================================================
# 1. SUBTERRANEAN CAVES & CELLARS — 22 MODULAR SPLITS
# =============================================================================

def make_sub_bare_speakeasy_bar(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, MAHOGANY, radius=24, ink_w=6)
    draw_wood_planks_box(d, 40, 40, W - 40, H - 40, WALNUT, random.Random(seed), horizontal=True, n_planks=4)
    # Brass footrail bar peeking out bottom front
    draw_beveled_rect(d, 44, H - 30, W - 44, H - 14, BRASS, radius=6, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_absinthe_fountain_glasses(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W * 0.42, H * 0.50, 56, BRASS, ink_w=5)
    draw_disc(d, W * 0.42, H * 0.50, 40, GLASS, ink_w=3)
    draw_disc(d, W * 0.42, H * 0.50, 26, ABSINTHE, ink_w=2)
    draw_disc(d, W * 0.42, H * 0.50, 11, BRASS_HI, ink_w=2)
    for gx, gy in [(W * 0.76, H * 0.34), (W * 0.80, H * 0.64), (W * 0.62, H * 0.78)]:
        draw_disc(d, gx, gy, 18, GLASS, ink_w=3)
        draw_disc(d, gx, gy, 12, ABSINTHE, ink_w=2)
        d.line([(gx - 18, gy - 4), (gx + 18, gy + 4)], fill=STEEL, width=3)
    return finish_prop(im, w, h, seed)


def make_sub_bare_octagonal_baize_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_oct_table(d, W / 2, H / 2, min(W, H) * 0.44, MAHOGANY, BAIZE)
    # Subtle brass trim inlays on corners
    for i in range(8):
        a = i * math.pi / 4 + math.pi / 8
        draw_disc(d, W / 2 + math.cos(a) * W * 0.39, H / 2 + math.sin(a) * H * 0.39, 7, BRASS, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_sub_poker_chips_cards_pot(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Central chip stacks
    for cx, cy, col in [(W * 0.44, H * 0.46, CRIMSON), (W * 0.56, H * 0.42, PRUSSIAN), (W * 0.50, H * 0.58, GOLD), (W * 0.38, H * 0.60, CREAM)]:
        draw_disc(d, cx, cy, 18, col, ink_w=3)
        draw_disc(d, cx, cy, 10, CREAM if col != CREAM else CRIMSON, ink_w=2)
    # Fanned playing cards around pot
    for px, py, col in [(W * 0.22, H * 0.34, CRIMSON), (W * 0.72, H * 0.30, IRON_DK), (W * 0.68, H * 0.72, CRIMSON), (W * 0.24, H * 0.74, IRON_DK)]:
        draw_beveled_rect(d, int(px - 18), int(py - 26), int(px + 18), int(py + 26), PAPER, radius=4, ink_w=3)
        draw_disc(d, px, py, 6, col, ink_w=1)
    return finish_prop(im, w, h, seed)


def make_sub_bare_iron_interrogation_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, IRON, radius=8, ink_w=6)
    draw_wood_planks_box(d, 40, 40, W - 40, H - 40, (82, 66, 56), random.Random(seed), horizontal=True, n_planks=4)
    for rx in [46, W - 46]:
        for ry in [46, H - 46]:
            draw_disc(d, rx, ry, 10, STEEL, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_iron_shackles_chain(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Distinct forged interlocking iron chain links curving between the two manacles
    links = [
        (W * 0.34, H * 0.48, 22, 13, 0.35),
        (W * 0.43, H * 0.56, 22, 13, -0.15),
        (W * 0.52, H * 0.53, 22, 13, -0.35),
        (W * 0.61, H * 0.51, 22, 13, 0.25),
    ]
    for lx, ly, rx, ry, _ in links:
        d.ellipse([lx - rx, ly - ry, lx + rx, ly + ry], outline=INK, width=13)
        d.ellipse([lx - rx, ly - ry, lx + rx, ly + ry], outline=IRON, width=7)
        d.arc([lx - rx + 2, ly - ry + 2, lx + rx - 2, ly + ry - 2], 195, 320, fill=STEEL, width=3)
    # Heavy forged iron wrist cuffs with hinged pivot & riveted padlock hasp
    for cx, cy, side in [(W * 0.23, H * 0.44, 1), (W * 0.75, H * 0.58, -1)]:
        d.ellipse([cx - 38, cy - 38, cx + 38, cy + 38], outline=INK, width=18)
        d.ellipse([cx - 38, cy - 38, cx + 38, cy + 38], outline=IRON, width=11)
        d.arc([cx - 36, cy - 36, cx + 36, cy + 36], 190, 315, fill=STEEL, width=4)
        # Riveted hinge & lock lug
        draw_beveled_rect(d, int(cx + side * 26 - 12), int(cy - 12), int(cx + side * 26 + 12), int(cy + 12), IRON, radius=4, ink_w=3)
        draw_disc(d, cx + side * 26, cy, 6, STEEL, ink_w=2)
        draw_disc(d, cx - side * 34, cy, 8, IRON_DK, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_bare_timber_cask_cradle(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Two parallel longitudinal beams + 3 notched saddle crossbars
    for by in [54, H - 82]:
        draw_beveled_rect(d, 26, by, W - 26, by + 28, WALNUT, radius=5, ink_w=5)
    for bx in [66, W // 2 - 16, W - 98]:
        draw_beveled_rect(d, bx, 30, bx + 32, H - 30, OAK, radius=6, ink_w=5)
    return finish_prop(im, w, h, seed)


def make_sub_cellar_wine_cask_single(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 28, 30, W - 28, H - 30, OAK, radius=42, ink_w=6)
    draw_wood_planks_box(d, 40, 42, W - 40, H - 42, WALNUT, random.Random(seed), horizontal=True, n_planks=5)
    for hx in [74, 122, W - 122, W - 74]:
        d.rectangle([hx - 7, 32, hx + 7, H - 32], fill=IRON_DK, outline=INK, width=3)
    draw_disc(d, W / 2, H / 2, 12, BRASS, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_bare_cellar_wall_shelf(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 26, W - 22, H - 26, WALNUT, radius=8, ink_w=6)
    draw_wood_planks_box(d, 32, 36, W - 32, H - 36, OAK, random.Random(seed), horizontal=True, n_planks=3)
    for sx in [58, W // 2, W - 58]:
        d.rectangle([sx - 8, 26, sx + 8, H - 26], fill=WALNUT, outline=INK, width=3)
    return finish_prop(im, w, h, seed)


def make_sub_pickled_preserve_jars_cluster(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    jars = [
        (W * 0.28, H * 0.42, 30, SAGE, CREAM),
        (W * 0.56, H * 0.34, 28, OCHRE, CRIMSON),
        (W * 0.72, H * 0.62, 26, CRIMSON, LINEN),
        (W * 0.38, H * 0.72, 26, TEAL, PAPER),
    ]
    for jx, jy, r, body, lid in jars:
        draw_disc(d, jx, jy, r, GLASS, ink_w=4)
        draw_disc(d, jx, jy, r * 0.78, body, ink_w=2)
        draw_disc(d, jx, jy, r * 0.48, lid, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_dusty_wine_bottles_cluster(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # 3 lying green/amber vintage bottles + 2 standing bottle tops
    for bx, by, bw, bh, col in [(36, 44, 108, 42, (46, 86, 54)), (48, 106, 114, 44, (84, 58, 36)), (120, 174, 106, 42, (42, 76, 50))]:
        draw_beveled_rect(d, bx, by, bx + bw, by + bh, col, radius=16, ink_w=4)
        draw_beveled_rect(d, bx + bw - 8, by + 11, bx + bw + 34, by + bh - 11, col, radius=6, ink_w=3)
        draw_beveled_rect(d, bx + bw + 26, by + 13, bx + bw + 40, by + bh - 13, CRIMSON, radius=3, ink_w=2)
    draw_disc(d, W * 0.78, H * 0.36, 22, (46, 86, 54), ink_w=4)
    draw_disc(d, W * 0.78, H * 0.36, 8, BURGUNDY, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_sub_bare_slatted_produce_bin(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 24, W - 24, H - 24, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 42, 42, W - 42, H - 42, (74, 54, 40), radius=6, ink_w=4)
    draw_wood_planks_box(d, 46, 46, W - 46, H - 46, OAK, random.Random(seed), horizontal=True, n_planks=5)
    # Center divider slat
    draw_beveled_rect(d, W // 2 - 10, 26, W // 2 + 10, H - 26, WALNUT, radius=4, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_sub_ice_block_single(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 34, 34, W - 34, H - 34, ICE, radius=16, ink_w=5)
    draw_beveled_rect(d, 52, 52, W - 52, H - 52, (218, 242, 250), radius=10, ink_w=2)
    d.line([(68, 72), (W - 76, H - 64)], fill=(246, 252, 255, 220), width=5)
    d.line([(W - 72, 68), (82, H - 72)], fill=(120, 174, 200, 180), width=3)
    # Iron ice tongs resting on corner
    d.arc([W - 110, H - 110, W - 26, H - 26], 180, 360, fill=IRON_DK, width=7)
    return finish_prop(im, w, h, seed)


def make_sub_steel_milk_can_single(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.36, STEEL, ink_w=5)
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.24, ZINC, ink_w=4)
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.10, IRON, ink_w=3)
    draw_beveled_rect(d, int(W * 0.14), int(H * 0.45), int(W * 0.28), int(H * 0.55), IRON, radius=4, ink_w=3)
    draw_beveled_rect(d, int(W * 0.72), int(H * 0.45), int(W * 0.86), int(H * 0.55), IRON, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_sarcophagus_stone_lid_loose(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, STONE, radius=10, ink_w=6)
    draw_beveled_rect(d, 48, 48, W - 48, H - 48, STONE_LT, radius=6, ink_w=4)
    # Carved cross / effigy ridge
    d.line([(68, H // 2), (W - 68, H // 2)], fill=STONE_DK, width=6)
    d.line([(126, 62), (126, H - 62)], fill=STONE_DK, width=6)
    return finish_prop(im, w, h, seed)


def make_sub_bare_open_sarcophagus(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 24, W - 24, H - 24, STONE, radius=10, ink_w=6)
    draw_beveled_rect(d, 56, 52, W - 56, H - 52, (42, 40, 44), radius=6, ink_w=5)
    draw_beveled_rect(d, 70, 66, W - 70, H - 66, (62, 60, 64), radius=4, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_sub_rolled_persian_carpet(w: int, h: int, seed: int) -> Image.Image:
    """Colorable dd_red rolled carpet cylinder with cream fringe & leather tie straps."""
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Cream fringe ends peeking left & right
    for fx in [20, W - 42]:
        for fy in range(56, H - 56, 12):
            d.line([(fx, fy), (fx + 22, fy)], fill=CREAM, width=5)
    draw_beveled_rect(d, 40, 40, W - 40, H - 40, DD_RED_BASE, radius=24, ink_w=6)
    for sx in range(74, W - 70, 46):
        d.line([(sx, 46), (sx, H - 46)], fill=DD_RED_DEEP, width=6)
        d.line([(sx + 10, 46), (sx + 10, H - 46)], fill=DD_RED_HI, width=3)
    for bx in [104, W - 120]:
        draw_beveled_rect(d, bx, 36, bx + 18, H - 36, LEATHER, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_bare_steamer_trunk(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 28, W - 26, H - 28, LEATHER_DK, radius=10, ink_w=6)
    draw_wood_planks_box(d, 38, 40, W - 38, H - 40, LEATHER, random.Random(seed), horizontal=True, n_planks=4)
    for sx in [76, W - 92]:
        draw_beveled_rect(d, sx, 28, sx + 18, H - 28, BRASS, radius=3, ink_w=3)
    draw_beveled_rect(d, W // 2 - 18, H - 40, W // 2 + 18, H - 22, BRASS_HI, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_gold_treasure_hoard_pile(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(seed)
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.38, OCHRE, ink_w=5)
    for _ in range(42):
        ang = rng.uniform(0, math.tau)
        dist = rng.uniform(0, min(W, H) * 0.30)
        cx, cy = W / 2 + math.cos(ang) * dist, H / 2 + math.sin(ang) * dist
        draw_disc(d, cx, cy, rng.uniform(10, 17), GOLD if rng.random() > 0.25 else BRASS_HI, ink_w=2)
    # Ruby & sapphire gems + goblet
    for gx, gy, col in [(W * 0.42, H * 0.42, CRIMSON), (W * 0.62, H * 0.56, CYAN), (W * 0.52, H * 0.34, ABSINTHE)]:
        draw_disc(d, gx, gy, 13, col, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_sub_bare_stone_cairn_ledge(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(seed)
    # Dark mortar stone plinth underneath
    draw_beveled_rect(d, 22, 26, W - 22, H - 26, (62, 62, 66), radius=10, ink_w=6)
    # Two staggered courses of hand-dressed weathered crypt limestone slabs with cracks & moss
    courses = [
        (34, H // 2 - 3, [26, 134, 248, 354, W - 34]),
        (H // 2 + 3, H - 34, [34, 102, 214, 336, W - 34]),
    ]
    for y0, y1, xs in courses:
        for i in range(len(xs) - 1):
            bx0, bx1 = xs[i] + 4, xs[i + 1] - 4
            col = vary_rgb(STONE, rng, 14)
            draw_beveled_rect(d, bx0, y0, bx1, y1, col, radius=6, ink_w=4, hi_amt=0.26, sh_amt=0.38)
            if rng.random() < 0.6:
                mx = (bx0 + bx1) // 2
                d.line([(mx - 12, y0 + 8), (mx + 4, (y0 + y1) // 2), (mx + 14, y1 - 8)], fill=(48, 46, 46, 200), width=3)
    # Soft lichen/moss tufts tucked into mortar joints
    for mx, my in [(134, H // 2), (248, H // 2), (336, H - 38), (102, H - 40)]:
        d.ellipse([mx - 14, my - 9, mx + 14, my + 9], fill=(78, 102, 54, 215), outline=INK_MID, width=2)
    return finish_prop(im, w, h, seed)


def make_sub_bare_wood_floor_trapdoor(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, IRON_DK, radius=8, ink_w=6)
    draw_wood_planks_box(d, 40, 40, W - 40, H - 40, OAK, random.Random(seed), horizontal=False, n_planks=5)
    # Iron strap hinges on left + pull ring on right
    for hy in [76, H - 102]:
        draw_beveled_rect(d, 34, hy, 118, hy + 24, IRON, radius=4, ink_w=3)
    d.ellipse([W - 102, H // 2 - 22, W - 58, H // 2 + 22], outline=IRON_DK, width=10)
    d.ellipse([W - 102, H // 2 - 22, W - 58, H // 2 + 22], outline=STEEL, width=4)
    return finish_prop(im, w, h, seed)


def make_sub_bare_straw_bed_pallet(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(seed)
    draw_beveled_rect(d, 30, 32, W - 30, H - 32, STRAW, radius=24, ink_w=5)
    for _ in range(36):
        x0 = rng.randint(44, W - 74)
        y0 = rng.randint(44, H - 56)
        d.line([(x0, y0), (x0 + rng.randint(18, 44), y0 + rng.randint(-12, 12))], fill=BURLAP, width=4)
    draw_beveled_rect(d, 46, 48, 128, H - 48, BURLAP, radius=14, ink_w=4)
    return finish_prop(im, w, h, seed)


# =============================================================================
# 2. WATCHTOWER GARRISON — 20 MODULAR SPLITS
# =============================================================================

def make_wt_bare_garrison_desk(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 24, W - 24, H - 24, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 38, 38, W - 38, H - 38, OAK, random.Random(seed), horizontal=True, n_planks=4)
    for cx, cy in [(32, 32), (W - 56, 32), (32, H - 56), (W - 56, H - 56)]:
        draw_beveled_rect(d, cx, cy, cx + 24, cy + 24, IRON, radius=3, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_wt_patrol_map_roster_papers(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Aged parchment patrol map on left with city block silhouettes, fold crease & red route
    mx0, my0, mx1, my1 = 22, 26, int(W * 0.64), H - 26
    draw_beveled_rect(d, mx0, my0, mx1, my1, (226, 210, 174), radius=6, ink_w=4, hi_amt=0.22, sh_amt=0.28)
    # Soft fold creases & ink border frame
    d.rectangle([mx0 + 10, my0 + 10, mx1 - 10, my1 - 10], outline=(146, 126, 94, 200), width=2)
    d.line([(mx0 + 8, H // 2), (mx1 - 8, H // 2)], fill=(164, 144, 110, 140), width=3)
    d.line([((mx0 + mx1) // 2, my0 + 8), ((mx0 + mx1) // 2, my1 - 8)], fill=(164, 144, 110, 140), width=3)
    # Hand-inked miniature city district blocks & canal curve
    for bx, by, bw, bh in [(40, 44, 34, 24), (88, 46, 42, 20), (42, 86, 28, 32), (104, 144, 48, 28), (44, 148, 38, 24)]:
        d.rectangle([bx, by, bx + bw, by + bh], fill=(198, 180, 144, 255), outline=(120, 102, 78, 220), width=2)
    d.line([(36, 124), (112, 112), (186, 62)], fill=(64, 96, 124, 220), width=6)
    # Dotted red patrol route + brass map push-pins
    pts = [(46, 58), (82, 82), (118, 126), (168, 92)]
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=(168, 48, 46, 235), width=4)
    for px, py in [(46, 58), (168, 92)]:
        draw_disc(d, px, py, 7, BRASS_HI, ink_w=2)
    # Overlapping stitched duty roster ledger on right with ruled lines & wax seal
    rx0, ry0, rx1, ry1 = int(W * 0.56), 44, W - 22, H - 30
    draw_beveled_rect(d, rx0, ry0, rx1, ry1, LEATHER_DK, radius=6, ink_w=4)
    draw_beveled_rect(d, rx0 + 10, ry0 + 8, rx1 - 8, ry1 - 8, PAPER, radius=4, ink_w=3)
    d.line([(rx0 + 22, ry0 + 16), (rx0 + 22, ry1 - 16)], fill=(176, 72, 68, 180), width=2)
    for ly in range(ry0 + 24, ry1 - 22, 16):
        d.line([(rx0 + 28, ly), (rx1 - 22, ly)], fill=(96, 82, 68, 200), width=3)
    draw_disc(d, rx1 - 30, ry1 - 28, 12, CRIMSON, ink_w=2)
    draw_disc(d, rx1 - 30, ry1 - 28, 6, (212, 86, 78), ink_w=1)
    return finish_prop(im, w, h, seed)


def make_wt_bare_round_command_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.44, WALNUT, ink_w=6)
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.37, OAK, ink_w=4)
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.30, PINE, ink_w=3)
    draw_disc(d, W / 2, H / 2, 16, BRASS, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_wt_tactical_map_miniatures(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy, r = W / 2, H / 2, min(W, H) * 0.41
    # Weathered round parchment tactical chart with ornate compass ring & street contours
    draw_disc(d, cx, cy, r, (224, 208, 172), ink_w=5)
    d.ellipse([cx - r * 0.88, cy - r * 0.88, cx + r * 0.88, cy + r * 0.88], outline=(138, 118, 86, 220), width=3)
    # Subtle shaded district blocks & river bend
    for bx, by, bw, bh in [(cx - 72, cy - 58, 36, 24), (cx + 22, cy - 64, 42, 26), (cx - 64, cy + 26, 40, 26), (cx + 16, cy + 22, 46, 28)]:
        d.rectangle([bx, by, bx + bw, by + bh], fill=(200, 182, 146, 255), outline=(126, 108, 82, 210), width=2)
    d.line([(cx - r * 0.72, cy - 18), (cx - 10, cy + 6), (cx + r * 0.70, cy + 24)], fill=(72, 104, 130, 220), width=8)
    d.line([(cx - 34, cy + r * 0.68), (cx + 14, cy - 4), (cx + 38, cy - r * 0.64)], fill=(122, 86, 54, 210), width=5)
    # Compass rose ticks at north/south/east/west
    for ang in range(0, 360, 45):
        rad = math.radians(ang)
        d.line([(cx + math.cos(rad) * r * 0.80, cy + math.sin(rad) * r * 0.80),
                (cx + math.cos(rad) * r * 0.90, cy + math.sin(rad) * r * 0.90)], fill=INK_MID, width=3)
    # Brass chart weights + sculpted wooden/brass garrison unit tokens with bevel rings
    for px, py, col, rim in [
        (cx - 42, cy - 26, CRIMSON, BRASS),
        (cx - 6, cy - 44, CRIMSON, BRASS),
        (cx + 42, cy + 24, PRUSSIAN, STEEL),
        (cx + 10, cy + 48, GOLD, WALNUT),
    ]:
        draw_disc(d, px + 3, py + 4, 15, (58, 46, 36), ink_w=1)
        draw_disc(d, px, py, 16, rim, ink_w=3)
        draw_disc(d, px, py, 10, col, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_wt_bare_armorer_workbench(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 28, W - 24, H - 24, WALNUT, radius=8, ink_w=6)
    draw_wood_planks_box(d, 36, 40, W - 36, H - 36, PINE, random.Random(seed), horizontal=True, n_planks=4)
    # Cast-iron bench vise bolted on front-left corner
    draw_beveled_rect(d, 48, H - 56, 118, H - 14, IRON, radius=6, ink_w=4)
    d.line([(36, H - 22), (132, H - 22)], fill=STEEL, width=7)
    return finish_prop(im, w, h, seed)


def make_wt_gunsmith_oil_tools_tray(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Riveted brushed-gunmetal workshop tray
    draw_beveled_rect(d, 22, 26, W - 22, H - 26, IRON_DK, radius=10, ink_w=6)
    draw_beveled_rect(d, 36, 40, W - 36, H - 40, (98, 106, 114), radius=6, ink_w=4)
    for rx, ry in [(44, 48), (W - 44, 48), (44, H - 48), (W - 44, H - 48)]:
        draw_disc(d, rx, ry, 5, STEEL, ink_w=2)
    # Conical brass gunsmith oiler can with narrow brass spout
    draw_disc(d, 84, H * 0.46, 28, BRASS, ink_w=4)
    draw_disc(d, 84, H * 0.46, 16, BRASS_HI, ink_w=2)
    d.line([(94, H * 0.40), (122, H * 0.28)], fill=INK, width=9)
    d.line([(94, H * 0.40), (122, H * 0.28)], fill=BRASS_HI, width=4)
    # Folded oily crimson shop-rag with cloth crease shading
    draw_beveled_rect(d, 134, 52, 226, H - 64, (150, 48, 48), radius=14, ink_w=4)
    d.line([(144, 78), (216, 86)], fill=(102, 28, 30, 220), width=4)
    d.line([(142, 110), (218, 104)], fill=(102, 28, 30, 220), width=4)
    d.ellipse([172, 82, 208, 114], fill=(54, 42, 36, 130))  # oil blotch on rag
    # Brass-handled cleaning rod + steel screwdriver along lower bay
    d.line([(54, H - 56), (W - 62, H - 56)], fill=INK, width=10)
    d.line([(54, H - 56), (W - 62, H - 56)], fill=STEEL, width=4)
    draw_beveled_rect(d, W - 102, H - 66, W - 52, H - 46, WALNUT, radius=6, ink_w=3)
    draw_beveled_rect(d, 240, 56, W - 46, H - 78, IRON, radius=5, ink_w=3)
    draw_beveled_rect(d, 246, 62, W - 52, H - 84, COPPER, radius=3, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_wt_bare_weapon_rack_empty(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 30, W - 24, H - 30, WALNUT, radius=8, ink_w=6)
    draw_beveled_rect(d, 38, 44, W - 38, H - 44, OAK, radius=5, ink_w=3)
    # 6 empty notched weapon slots along the rack
    for sx in range(62, W - 54, 62):
        draw_beveled_rect(d, sx - 12, 34, sx + 12, 74, (58, 40, 28), radius=6, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_wt_aether_carbine_rifle(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cy = H // 2
    draw_beveled_rect(d, 24, cy - 18, 128, cy + 18, WALNUT, radius=10, ink_w=4)
    draw_beveled_rect(d, 120, cy - 14, 214, cy + 14, IRON, radius=5, ink_w=4)
    draw_beveled_rect(d, 152, cy - 10, 198, cy + 10, CYAN, radius=4, ink_w=2)
    draw_beveled_rect(d, 210, cy - 9, W - 24, cy + 9, STEEL, radius=4, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_wt_garrison_halberd_single(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cy = H // 2
    draw_beveled_rect(d, 22, cy - 8, W - 76, cy + 8, OAK, radius=4, ink_w=4)
    # Steel halberd axe-blade + spear spike
    d.polygon([(W - 118, cy - 12), (W - 72, cy - 42), (W - 54, cy - 6)], fill=(*STEEL, 255), outline=INK)
    d.polygon([(W - 104, cy + 8), (W - 76, cy + 32), (W - 64, cy + 8)], fill=(*STEEL, 255), outline=INK)
    d.polygon([(W - 76, cy - 10), (W - 18, cy), (W - 76, cy + 10)], fill=(*STEEL, 255), outline=INK)
    return finish_prop(im, w, h, seed)


def make_wt_bare_mess_hall_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(seed)
    draw_beveled_rect(d, 50, 20, W - 50, 62, WALNUT, radius=7, ink_w=5)
    draw_beveled_rect(d, 50, H - 62, W - 50, H - 20, WALNUT, radius=7, ink_w=5)
    draw_beveled_rect(d, 24, 62, W - 24, H - 62, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 36, 74, W - 36, H - 74, PINE, rng, horizontal=True, n_planks=5)
    return finish_prop(im, w, h, seed)


def make_wt_tin_ration_mugs_tray(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 28, W - 26, H - 28, WALNUT, radius=10, ink_w=5)
    draw_beveled_rect(d, 38, 40, W - 38, H - 40, PINE, radius=6, ink_w=3)
    draw_disc(d, 96, H * 0.48, 28, IRON, ink_w=4)
    draw_disc(d, 96, H * 0.48, 16, STEEL, ink_w=2)
    draw_disc(d, 168, H * 0.36, 17, ZINC, ink_w=3)
    draw_disc(d, 168, H * 0.66, 17, ZINC, ink_w=3)
    draw_beveled_rect(d, 204, 58, W - 46, H - 58, OCHRE, radius=14, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_wt_bare_mudroom_bench(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 26, W - 24, H - 26, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 36, 38, W - 36, H - 38, OAK, random.Random(seed), horizontal=True, n_planks=3)
    return finish_prop(im, w, h, seed)


def make_wt_muddy_leather_boots_pair(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 36, 36, W // 2 - 10, H - 32, LEATHER_DK, radius=24, ink_w=5)
    draw_disc(d, 36 + (W // 2 - 46) // 2, 74, 22, LEATHER, ink_w=3)
    draw_beveled_rect(d, W // 2 + 12, 46, W - 34, H - 24, LEATHER_DK, radius=24, ink_w=5)
    draw_disc(d, W // 2 + 12 + (W // 2 - 46) // 2, 84, 22, LEATHER, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_wt_folded_greatcoat(w: int, h: int, seed: int) -> Image.Image:
    """Colorable dd_red folded heavy wool military greatcoat with lapels, creases & brass buttons."""
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Main folded wool body in dd_red
    draw_beveled_rect(d, 28, 30, W - 28, H - 30, DD_RED_BASE, radius=20, ink_w=6)
    # Folded sleeve flap tucked horizontally across bottom half + deep crease shadows
    draw_beveled_rect(d, 36, H // 2 - 4, W - 36, H - 34, DD_RED_BASE, radius=14, ink_w=4)
    d.line([(36, H // 2 - 4), (W - 36, H // 2 - 4)], fill=DD_RED_DEEP, width=6)
    # Sculpted double-breasted collar lapels on top half
    d.polygon([(W * 0.24, 34), (W * 0.48, 34), (W * 0.42, H * 0.48), (W * 0.20, H * 0.44)], fill=(*DD_RED_HI, 255), outline=INK)
    d.polygon([(W * 0.76, 34), (W * 0.52, 34), (W * 0.58, H * 0.48), (W * 0.80, H * 0.44)], fill=(*DD_RED_HI, 255), outline=INK)
    d.line([(W * 0.50, 36), (W * 0.50, H - 36)], fill=DD_RED_DEEP, width=5)
    # Subtle cloth fold creases & stitched hem
    d.line([(56, H * 0.72), (W - 56, H * 0.68)], fill=DD_RED_DEEP, width=3)
    d.line([(52, H * 0.82), (W - 52, H * 0.82)], fill=DD_RED_DEEP, width=2)
    # Two vertical rows of recessed brass uniform buttons
    for bx in [W * 0.36, W * 0.64]:
        for by in [H * 0.30, H * 0.56, H * 0.74]:
            draw_disc(d, bx, by, 8, BRASS, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_wt_pickelhaube_helmet_shield(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Riveted Prussian-steel riot tower shield on left with beveled border, rivets & brass emblem
    sx0, sy0, sx1, sy1 = 22, 26, W // 2 + 12, H - 26
    draw_beveled_rect(d, sx0, sy0, sx1, sy1, IRON_DK, radius=22, ink_w=6)
    draw_beveled_rect(d, sx0 + 14, sy0 + 14, sx1 - 14, sy1 - 14, PRUSSIAN, radius=14, ink_w=4)
    # Vertical steel reinforcement rib & brass boss emblem
    scx, scy = (sx0 + sx1) // 2, (sy0 + sy1) // 2
    d.line([(scx, sy0 + 18), (scx, sy1 - 18)], fill=STEEL, width=6)
    d.line([(sx0 + 18, scy), (sx1 - 18, scy)], fill=STEEL, width=4)
    draw_disc(d, scx, scy, 20, BRASS, ink_w=4)
    draw_disc(d, scx, scy, 9, BRASS_HI, ink_w=2)
    for rx in [sx0 + 22, sx1 - 22]:
        for ry in [sy0 + 24, sy1 - 24]:
            draw_disc(d, rx, ry, 5, STEEL, ink_w=2)
    # Glossy dark-lacquered spiked Pickelhaube helmet on right with front visor & brass chinscales
    hx, hy = W * 0.76, H * 0.50
    draw_beveled_rect(d, int(hx - 36), int(hy + 20), int(hx + 36), int(hy + 50), IRON_DK, radius=18, ink_w=4)
    draw_disc(d, hx, hy, 44, (40, 44, 52), ink_w=5)
    d.arc([hx - 36, hy - 36, hx + 36, hy + 36], 200, 315, fill=(132, 144, 158, 220), width=5)
    d.arc([hx - 40, hy - 40, hx + 40, hy + 40], 20, 160, fill=BRASS, width=5)
    draw_disc(d, hx, hy, 18, BRASS, ink_w=3)
    draw_disc(d, hx, hy, 8, BRASS_HI, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_wt_signal_flares_bundle(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # 4 vintage kraft-paper & muted-label signal flare tubes with brass end-caps bound in hemp twine
    specs = [
        (36, 42, (158, 54, 52)),
        (46, 82, (58, 128, 138)),
        (38, 122, (158, 54, 52)),
        (48, 162, (58, 128, 138)),
    ]
    for x0, y, col in specs:
        x1 = W - 36 + (x0 - 42)
        draw_beveled_rect(d, x0, y, x1, y + 34, (176, 144, 98), radius=10, ink_w=4)
        # Colored signal band in center
        draw_beveled_rect(d, x0 + 52, y + 3, x1 - 44, y + 31, col, radius=4, ink_w=2)
        # Oxidized brass cap & dark waxed igniter tip
        draw_beveled_rect(d, x0 + 4, y + 3, x0 + 36, y + 31, BRASS, radius=6, ink_w=3)
        draw_beveled_rect(d, x1 - 24, y + 5, x1 - 4, y + 29, IRON_DK, radius=4, ink_w=2)
    # Hemp twine lashing binding all 4 tubes together cleanly
    for tx in [int(W * 0.36), int(W * 0.64)]:
        draw_beveled_rect(d, tx - 6, 36, tx + 6, 202, BURLAP, radius=3, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_wt_bare_iron_cot_frame(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 28, 28, W - 28, H - 28, IRON, radius=12, ink_w=6)
    draw_beveled_rect(d, 44, 44, W - 44, H - 44, LINEN, radius=12, ink_w=4)
    draw_beveled_rect(d, 62, 60, W - 62, 134, CREAM, radius=18, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_wt_shutter_signal_lamp(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.36, BRASS, ink_w=5)
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.24, GLASS, ink_w=3)
    for sy in range(int(H * 0.36), int(H * 0.66), 14):
        d.line([(W * 0.32, sy), (W * 0.68, sy)], fill=IRON_DK, width=4)
    return finish_prop(im, w, h, seed)


def make_wt_sandbag_single_sack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 36, W - 26, H - 36, BURLAP, radius=32, ink_w=5)
    d.line([(56, 42), (56, H - 42)], fill=WALNUT, width=5)
    d.line([(W - 56, 42), (W - 56, H - 42)], fill=WALNUT, width=5)
    return finish_prop(im, w, h, seed)


def make_wt_bare_wall_noticeboard(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=8, ink_w=6)
    draw_beveled_rect(d, 40, 42, W - 40, H - 42, (166, 126, 84), radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


# =============================================================================
# 3. BOULEVARD SHOPS — 22 MODULAR SPLITS
# =============================================================================

def make_bs_bare_walnut_tasting_bar(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 28, WALNUT, radius=14, ink_w=6)
    draw_wood_planks_box(d, 34, 36, W - 34, H - 40, MAHOGANY, random.Random(seed), horizontal=True, n_planks=4)
    draw_beveled_rect(d, 38, H - 28, W - 38, H - 14, BRASS, radius=5, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_bs_wine_decanter_glasses_tray(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 28, W - 24, H - 28, WALNUT, radius=14, ink_w=5)
    draw_disc(d, W * 0.36, H * 0.50, 32, GLASS, ink_w=4)
    draw_disc(d, W * 0.36, H * 0.50, 22, BURGUNDY, ink_w=2)
    for gx, gy in [(W * 0.68, H * 0.36), (W * 0.72, H * 0.66)]:
        draw_disc(d, gx, gy, 17, GLASS, ink_w=3)
        draw_disc(d, gx, gy, 11, BURGUNDY, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_bs_bare_mahogany_wall_rack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, MAHOGANY, radius=8, ink_w=6)
    for rx in range(44, W - 64, 62):
        draw_beveled_rect(d, rx, 36, rx + 48, H - 36, (72, 34, 28), radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_bs_bare_brass_floor_safe(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, IRON_DK, radius=12, ink_w=6)
    draw_beveled_rect(d, 42, 42, W - 42, H - 42, IRON, radius=8, ink_w=4)
    draw_disc(d, W / 2, H / 2, 26, BRASS, ink_w=4)
    draw_disc(d, W / 2, H / 2, 10, BRASS_HI, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_bs_bare_zinc_shop_counter(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 34, 36, W - 34, H - 36, ZINC, radius=6, ink_w=4)
    for rx in range(56, W - 44, 68):
        draw_disc(d, rx, 48, 5, IRON, ink_w=1)
        draw_disc(d, rx, H - 48, 5, IRON, ink_w=1)
    return finish_prop(im, w, h, seed)


def make_bs_wrapped_linen_parcels(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    parcels = [
        (26, 32, 150, 134, (194, 158, 108), True),
        (132, 68, W - 26, H - 32, LINEN, False),
        (40, 126, 152, H - 24, (218, 206, 182), True),
    ]
    for bx0, by0, bx1, by1, col, has_tag in parcels:
        draw_beveled_rect(d, bx0, by0, bx1, by1, col, radius=10, ink_w=4)
        # Diagonal folded-paper flap seam + double-wrapped butcher twine & knot
        d.line([(bx0 + 10, by0 + 16), (bx1 - 10, by0 + 16)], fill=blend_rgb(col, (48, 36, 26), 0.32), width=2)
        mx, my = (bx0 + bx1) // 2, (by0 + by1) // 2
        d.line([(bx0 + 5, my), (bx1 - 5, my)], fill=WALNUT, width=5)
        d.line([(mx, by0 + 5), (mx, by1 - 5)], fill=WALNUT, width=5)
        draw_disc(d, mx, my, 8, BURLAP, ink_w=2)
        if has_tag:
            draw_beveled_rect(d, mx + 10, my - 24, min(bx1 - 8, mx + 44), my - 4, PAPER, radius=3, ink_w=2)
            d.line([(mx + 15, my - 14), (min(bx1 - 12, mx + 38), my - 14)], fill=INK_MID, width=2)
    return finish_prop(im, w, h, seed)


def make_bs_bare_brass_garment_rack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    for rx in [40, W - 40]:
        draw_beveled_rect(d, rx - 14, 36, rx + 14, H - 36, IRON, radius=6, ink_w=4)
    draw_beveled_rect(d, 32, H // 2 - 10, W - 32, H // 2 + 10, BRASS_HI, radius=6, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_bs_bare_ironing_board(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    poly = [(36, 44), (W - 108, 44), (W - 26, H // 2), (W - 108, H - 44), (36, H - 44)]
    d.polygon(poly, fill=(*LINEN, 255), outline=INK)
    d.line(poly + [poly[0]], fill=INK, width=6)
    draw_beveled_rect(d, 44, 58, 92, H - 58, IRON, radius=6, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_bs_cast_iron_flatiron(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    poly = [(42, 46), (W - 96, 46), (W - 28, H // 2), (W - 96, H - 46), (42, H - 46)]
    d.polygon(poly, fill=(*IRON, 255), outline=INK)
    d.line(poly + [poly[0]], fill=INK, width=6)
    draw_beveled_rect(d, 64, H // 2 - 14, W - 96, H // 2 + 14, OAK, radius=8, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_bs_wooden_bath_duckboard(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    for sy in range(28, H - 36, 26):
        draw_beveled_rect(d, 24, sy, W - 24, sy + 18, PINE, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_bs_bath_oil_bottles_sponge(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W * 0.34, H * 0.54, 34, OCHRE, ink_w=4)
    draw_disc(d, W * 0.68, H * 0.36, 22, TEAL, ink_w=3)
    draw_disc(d, W * 0.72, H * 0.68, 20, GLASS, ink_w=3)
    draw_disc(d, W * 0.72, H * 0.68, 12, (218, 152, 166), ink_w=2)
    return finish_prop(im, w, h, seed)


def make_bs_bare_glass_display_case(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 40, 40, W - 40, H - 40, (186, 214, 222), radius=6, ink_w=4)
    d.line([(62, 56), (138, H - 56)], fill=(246, 252, 255, 200), width=7)
    d.line([(164, 56), (220, H - 56)], fill=(246, 252, 255, 160), width=4)
    return finish_prop(im, w, h, seed)


def make_bs_curio_relic_trinkets(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W * 0.32, H * 0.48, 34, BRASS, ink_w=4)
    draw_disc(d, W * 0.32, H * 0.48, 22, BRASS_HI, ink_w=2)
    draw_beveled_rect(d, int(W * 0.58), 42, W - 36, 114, TEAL, radius=16, ink_w=4)
    draw_disc(d, W * 0.68, H * 0.72, 22, GOLD, ink_w=3)
    draw_disc(d, W * 0.68, H * 0.72, 12, CRIMSON, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_bs_bare_green_leather_desk(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, MAHOGANY, radius=10, ink_w=6)
    draw_beveled_rect(d, 48, 44, W - 48, H - 44, BAIZE, radius=6, ink_w=4)
    d.rectangle([58, 54, W - 58, H - 54], outline=BRASS, width=3)
    return finish_prop(im, w, h, seed)


def make_bs_bare_jeweler_workbench(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 34, 36, W - 34, H - 36, OAK, random.Random(seed), horizontal=True, n_planks=4)
    # Semicircular jeweler's front cutout notch
    d.pieslice([W // 2 - 58, H - 82, W // 2 + 58, H + 26], 180, 360, fill=(0, 0, 0, 0), outline=INK, width=5)
    return finish_prop(im, w, h, seed)


def _draw_cogwheel(d: ImageDraw.ImageDraw, cx: float, cy: float, r: float, teeth: int, col) -> None:
    pts = []
    for i in range(teeth * 2):
        ang = (i / (teeth * 2)) * math.tau
        rad = r * (1.16 if i % 2 == 0 else 0.88)
        pts.append((cx + math.cos(ang) * rad, cy + math.sin(ang) * rad))
    d.polygon(pts, fill=(*col, 255), outline=INK)
    d.line(pts + [pts[0]], fill=INK, width=3)
    draw_disc(d, cx, cy, r * 0.72, blend_rgb(col, (240, 210, 140), 0.16)[:3], ink_w=3)
    draw_disc(d, cx, cy, r * 0.42, (42, 38, 36), ink_w=2)
    for k in range(4):
        a = k * math.pi / 2 + 0.3
        d.line([(cx - math.cos(a) * r * 0.44, cy - math.sin(a) * r * 0.44),
                (cx + math.cos(a) * r * 0.44, cy + math.sin(a) * r * 0.44)], fill=(*col, 255), width=5)
    draw_disc(d, cx, cy, r * 0.18, IRON_DK, ink_w=2)


def make_bs_clockwork_gears_loupe(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    _draw_cogwheel(d, W * 0.34, H * 0.38, 34, 10, BRASS)
    _draw_cogwheel(d, W * 0.64, H * 0.56, 28, 8, COPPER)
    _draw_cogwheel(d, W * 0.72, H * 0.28, 22, 8, GOLD)
    # Brass-rimmed jeweler's magnifying loupe with diagonal glass specular glint
    lx, ly = W * 0.32, H * 0.74
    draw_disc(d, lx, ly, 26, IRON_DK, ink_w=4)
    draw_disc(d, lx, ly, 20, BRASS, ink_w=3)
    draw_disc(d, lx, ly, 14, GLASS, ink_w=2)
    d.line([(lx - 7, ly - 5), (lx + 2, ly - 10)], fill=(252, 254, 255, 240), width=4)
    return finish_prop(im, w, h, seed)


def make_bs_bare_mahogany_cutting_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, MAHOGANY, radius=12, ink_w=6)
    draw_wood_planks_box(d, 36, 38, W - 36, H - 38, WALNUT, random.Random(seed), horizontal=True, n_planks=5)
    # Brass yardstick ruler inlaid along front edge
    draw_beveled_rect(d, 64, H - 50, W - 64, H - 36, BRASS, radius=3, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_bs_tailor_shears_pincushion(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Sculpted steel dressmaking shear blades with crisp beveled edges + brass finger-loop handles
    blade1 = [(82, 74), (W - 44, H - 50), (W - 58, H - 36), (72, 88)]
    blade2 = [(82, H - 74), (W - 44, 50), (W - 58, 36), (72, H - 88)]
    for b in (blade1, blade2):
        d.polygon(b, fill=(*STEEL, 255), outline=INK)
        d.line(b + [b[0]], fill=INK, width=4)
    draw_disc(d, W * 0.44, H * 0.50, 7, BRASS_HI, ink_w=2)
    # Open brass finger rings on handles
    for hx, hy, r in [(54, 60, 22), (54, H - 60, 26)]:
        d.ellipse([hx - r, hy - r, hx + r, hy + r], outline=INK, width=13)
        d.ellipse([hx - r, hy - r, hx + r, hy + r], outline=BRASS, width=7)
    # Pleated crimson velvet pincushion with tufted center & pearl-headed sewing pins
    px, py = W * 0.74, H * 0.52
    draw_disc(d, px, py, 32, CRIMSON, ink_w=5)
    for k in range(6):
        a = k * math.pi / 3
        d.line([(px, py), (px + math.cos(a) * 28, py + math.sin(a) * 28)], fill=(118, 24, 30, 200), width=3)
    draw_disc(d, px, py, 7, BRASS, ink_w=2)
    for dx, dy, pc in [(-14, -14, CREAM), (16, -12, BRASS_HI), (12, 16, SKY if "SKY" in globals() else CYAN)]:
        d.line([(px + dx * 0.4, py + dy * 0.4), (px + dx * 1.4, py + dy * 1.4)], fill=STEEL, width=3)
        draw_disc(d, px + dx * 1.4, py + dy * 1.4, 6, pc, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_bs_unrolled_fabric_bolt(w: int, h: int, seed: int) -> Image.Image:
    """Colorable dd_red unrolled cloth bolt for tailors & market stalls."""
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 34, W - 26, H - 34, DD_RED_BASE, radius=10, ink_w=5)
    # Cardboard/wood cylinder core on left end
    draw_beveled_rect(d, 24, 28, 86, H - 28, DD_RED_DEEP, radius=18, ink_w=5)
    d.line([(96, 46), (W - 36, 46)], fill=DD_RED_HI, width=4)
    d.line([(96, H - 46), (W - 36, H - 46)], fill=DD_RED_DEEP, width=4)
    return finish_prop(im, w, h, seed)


def make_bs_bare_velvet_podium(w: int, h: int, seed: int) -> Image.Image:
    """Colorable dd_red round velvet fitting/display podium."""
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.43, WALNUT, ink_w=6)
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.35, DD_RED_BASE, ink_w=4)
    draw_disc(d, W / 2, H / 2, min(W, H) * 0.28, DD_RED_HI, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_bs_bare_cobbler_bench(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 28, W - 24, H - 28, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 36, 40, W - 36, H - 40, OAK, random.Random(seed), horizontal=True, n_planks=4)
    draw_beveled_rect(d, W - 118, 42, W - 40, H - 42, LEATHER, radius=12, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_bs_cobbler_last_hammer_leather(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Organic cut leather hide swatch with stitched perimeter punch holes
    hide = [(32, 54), (66, 34), (118, 44), (132, 92), (114, H - 38), (58, H - 34), (28, H - 72)]
    d.polygon(hide, fill=(*LEATHER, 255), outline=INK)
    d.line(hide + [hide[0]], fill=INK, width=5)
    d.line([(54, 62), (104, H - 64)], fill=LEATHER_DK, width=3)
    # Sculpted cast-iron cobbler's shoe-last foot anvil
    d.ellipse([148, 46, 206, 134], fill=(*IRON, 255), outline=INK, width=5)
    d.ellipse([156, 118, 198, H - 46], fill=(*IRON_DK, 255), outline=INK, width=5)
    d.arc([156, 54, 198, 118], 200, 320, fill=STEEL, width=3)
    # Hickory cobbler's hammer with wide round face & cross-peen iron head
    draw_beveled_rect(d, 232, 62, 248, H - 38, OAK, radius=6, ink_w=4)
    draw_beveled_rect(d, 208, 36, 274, 68, IRON, radius=8, ink_w=4)
    draw_disc(d, 214, 52, 12, STEEL, ink_w=3)
    return finish_prop(im, w, h, seed)


# =============================================================================
# 4. COMMUNITY KID THEATER — 4 REMAINING MODULAR GAP SPLITS
# =============================================================================

def make_kt_bare_puppet_booth_frame(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 28, W - 24, H - 28, OAK, radius=8, ink_w=6)
    draw_beveled_rect(d, 46, 48, W - 46, H - 48, (74, 54, 40), radius=4, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_kt_bare_backstage_prop_shelf(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 26, W - 22, H - 26, PINE, radius=8, ink_w=6)
    draw_wood_planks_box(d, 32, 36, W - 32, H - 36, OAK, random.Random(seed), horizontal=True, n_planks=3)
    return finish_prop(im, w, h, seed)


def make_kt_cardboard_megaphone(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Painted corrugated cardboard megaphone cone with cream trim stripe, brass mouthpiece & handle
    cone = [(42, H // 2 - 14), (154, 34), (154, H - 34), (42, H // 2 + 14)]
    d.polygon(cone, fill=(*CRIMSON, 255), outline=INK)
    d.polygon([(112, 52), (138, 41), (138, H - 41), (112, H - 52)], fill=(*CREAM, 255))
    d.line(cone + [cone[0]], fill=INK, width=5)
    draw_beveled_rect(d, 26, H // 2 - 18, 46, H // 2 + 18, BRASS, radius=5, ink_w=4)
    draw_beveled_rect(d, 148, 30, 162, H - 30, OAK, radius=5, ink_w=4)
    # Carved wooden theatrical round-shield with painted heraldry quarters & iron boss
    sx, sy = W * 0.74, H * 0.50
    draw_disc(d, sx, sy, 48, WALNUT, ink_w=5)
    draw_disc(d, sx, sy, 38, PRUSSIAN, ink_w=3)
    d.pieslice([sx - 36, sy - 36, sx + 36, sy + 36], 0, 90, fill=(*OCHRE, 255), outline=INK, width=2)
    d.pieslice([sx - 36, sy - 36, sx + 36, sy + 36], 180, 270, fill=(*OCHRE, 255), outline=INK, width=2)
    draw_disc(d, sx, sy, 14, STEEL, ink_w=3)
    for k in range(8):
        a = k * math.pi / 4
        draw_disc(d, sx + math.cos(a) * 42, sy + math.sin(a) * 42, 3.5, BRASS_HI, ink_w=1)
    return finish_prop(im, w, h, seed)


def make_kt_chalkboard_easel_blank(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 30, 26, W - 30, H - 26, OAK, radius=8, ink_w=6)
    draw_beveled_rect(d, 48, 44, W - 48, H - 44, (44, 50, 54), radius=4, ink_w=4)
    draw_beveled_rect(d, 68, H - 40, 126, H - 26, CREAM, radius=3, ink_w=2)
    return finish_prop(im, w, h, seed)


ASSET_SPECS = [
    # --- subterranean_caves (22) ---
    ("subterranean_caves", "sub_bare_speakeasy_bar.png", "Bare Curved Mahogany Speakeasy Bar Counter", 288, 160, "normal",
     ["subterranean", "speakeasy", "bar", "counter", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_speakeasy_bar),
    ("subterranean_caves", "sub_absinthe_fountain_glasses.png", "Brass Absinthe Fountain & Glowing Glasses", 144, 144, "normal",
     ["subterranean", "speakeasy", "absinthe", "drink", "modular", "modular_split_v2", "harmony"], make_sub_absinthe_fountain_glasses),
    ("subterranean_caves", "sub_bare_octagonal_baize_table.png", "Bare Green-Baize Octagonal Gaming Table", 256, 256, "normal",
     ["subterranean", "speakeasy", "table", "poker", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_octagonal_baize_table),
    ("subterranean_caves", "sub_poker_chips_cards_pot.png", "Stacked Poker Chips & Fanned Playing Cards", 144, 144, "normal",
     ["subterranean", "speakeasy", "poker", "cards", "chips", "modular", "modular_split_v2", "harmony"], make_sub_poker_chips_cards_pot),
    ("subterranean_caves", "sub_bare_iron_interrogation_table.png", "Bare Bolted Iron-Bound Dungeon Table", 272, 168, "normal",
     ["subterranean", "dungeon", "table", "iron", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_iron_interrogation_table),
    ("subterranean_caves", "sub_iron_shackles_chain.png", "Loose Iron Manacles & Heavy Floor Chain", 160, 128, "normal",
     ["subterranean", "dungeon", "prison", "chains", "shackles", "modular", "modular_split_v2", "harmony"], make_sub_iron_shackles_chain),
    ("subterranean_caves", "sub_bare_timber_cask_cradle.png", "Bare Oak Cellar Barrel Cradle Rack", 256, 176, "normal",
     ["subterranean", "cellar", "rack", "barrel", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_timber_cask_cradle),
    ("subterranean_caves", "sub_cellar_wine_cask_single.png", "Single Brass-Hooped Cellar Wine Cask", 176, 128, "normal",
     ["subterranean", "cellar", "wine", "barrel", "cask", "modular", "modular_split_v2", "harmony"], make_sub_cellar_wine_cask_single),
    ("subterranean_caves", "sub_bare_cellar_wall_shelf.png", "Bare Timber Cellar & Pantry Wall Shelf", 240, 128, "normal",
     ["subterranean", "cellar", "shelf", "pantry", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_cellar_wall_shelf),
    ("subterranean_caves", "sub_pickled_preserve_jars_cluster.png", "Cluster of Pickled Glass Preserve Jars", 144, 144, "normal",
     ["subterranean", "cellar", "pantry", "jars", "food", "modular", "modular_split_v2", "harmony"], make_sub_pickled_preserve_jars_cluster),
    ("subterranean_caves", "sub_dusty_wine_bottles_cluster.png", "Loose Cobwebbed Vintage Wine Bottles", 160, 128, "normal",
     ["subterranean", "cellar", "wine", "bottles", "modular", "modular_split_v2", "harmony"], make_sub_dusty_wine_bottles_cluster),
    ("subterranean_caves", "sub_bare_slatted_produce_bin.png", "Bare Slatted Wooden Root-Cellar Bin", 224, 160, "normal",
     ["subterranean", "cellar", "bin", "storage", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_slatted_produce_bin),
    ("subterranean_caves", "sub_ice_block_single.png", "Single Translucent Cellar Ice Block & Tongs", 144, 128, "normal",
     ["subterranean", "cellar", "ice", "cold_storage", "modular", "modular_split_v2", "harmony"], make_sub_ice_block_single),
    ("subterranean_caves", "sub_steel_milk_can_single.png", "Standalone Steel Dairy Milk & Cream Can", 128, 128, "normal",
     ["subterranean", "cellar", "dairy", "kitchen", "can", "modular", "modular_split_v2", "harmony"], make_sub_steel_milk_can_single),
    ("subterranean_caves", "sub_sarcophagus_stone_lid_loose.png", "Loose Carved Limestone Sarcophagus Lid", 256, 144, "normal",
     ["subterranean", "crypt", "sarcophagus", "stone", "lid", "modular", "modular_split_v2", "harmony"], make_sub_sarcophagus_stone_lid_loose),
    ("subterranean_caves", "sub_bare_open_sarcophagus.png", "Bare Empty Open Stone Sarcophagus", 256, 160, "normal",
     ["subterranean", "crypt", "sarcophagus", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_open_sarcophagus),
    ("subterranean_caves", "sub_rolled_persian_carpet.png", "Rolled Carpet Cylinder (Colorable)", 224, 96, "dd_red",
     ["subterranean", "cellar", "carpet", "rug", "colorable", "dd_red", "modular", "modular_split_v2", "harmony"], make_sub_rolled_persian_carpet),
    ("subterranean_caves", "sub_bare_steamer_trunk.png", "Standalone Iron-Bound Vintage Steamer Trunk", 192, 128, "normal",
     ["subterranean", "cellar", "trunk", "storage", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_steamer_trunk),
    ("subterranean_caves", "sub_gold_treasure_hoard_pile.png", "Loose Glittering Gold Coin & Gem Hoard", 176, 160, "normal",
     ["subterranean", "cave", "treasure", "gold", "coins", "modular", "modular_split_v2", "harmony"], make_sub_gold_treasure_hoard_pile),
    ("subterranean_caves", "sub_bare_stone_cairn_ledge.png", "Bare Carved Stone Crypt Niche Ledge", 240, 128, "normal",
     ["subterranean", "crypt", "stone", "ledge", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_stone_cairn_ledge),
    ("subterranean_caves", "sub_bare_wood_floor_trapdoor.png", "Bare Timber Cellar Floor Trapdoor & Ring", 176, 176, "normal",
     ["subterranean", "basement", "trapdoor", "hatch", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_wood_floor_trapdoor),
    ("subterranean_caves", "sub_bare_straw_bed_pallet.png", "Bare Prison & Peasant Straw Bed Pallet", 208, 128, "normal",
     ["subterranean", "dungeon", "prison", "bed", "pallet", "bare", "modular", "modular_split_v2", "harmony"], make_sub_bare_straw_bed_pallet),

    # --- watchtower_garrison (20) ---
    ("watchtower_garrison", "wt_bare_garrison_desk.png", "Bare Iron-Bound Oak Garrison Duty Desk", 256, 160, "normal",
     ["watchtower", "guard", "desk", "office", "bare", "modular", "modular_split_v2", "harmony"], make_wt_bare_garrison_desk),
    ("watchtower_garrison", "wt_patrol_map_roster_papers.png", "Loose District Patrol Map & Shift Roster", 160, 128, "normal",
     ["watchtower", "guard", "map", "roster", "papers", "modular", "modular_split_v2", "harmony"], make_wt_patrol_map_roster_papers),
    ("watchtower_garrison", "wt_bare_round_command_table.png", "Bare Circular Oak War-Room Command Table", 304, 304, "normal",
     ["watchtower", "table", "command", "round", "bare", "modular", "modular_split_v2", "harmony"], make_wt_bare_round_command_table),
    ("watchtower_garrison", "wt_tactical_map_miniatures.png", "Standalone Tactical District Map & Pawns", 224, 224, "normal",
     ["watchtower", "map", "strategy", "pawns", "modular", "modular_split_v2", "harmony"], make_wt_tactical_map_miniatures),
    ("watchtower_garrison", "wt_bare_armorer_workbench.png", "Bare Scarred Timber Armorer Workbench & Vise", 256, 160, "normal",
     ["watchtower", "armory", "workbench", "vise", "bare", "modular", "modular_split_v2", "harmony"], make_wt_bare_armorer_workbench),
    ("watchtower_garrison", "wt_gunsmith_oil_tools_tray.png", "Weapon-Oiling Rag, Oil Can & Gunsmith Tray", 176, 128, "normal",
     ["watchtower", "armory", "tools", "workshop", "modular", "modular_split_v2", "harmony"], make_wt_gunsmith_oil_tools_tray),
    ("watchtower_garrison", "wt_bare_weapon_rack_empty.png", "Bare Empty Timber Garrison Weapon Rack", 256, 128, "normal",
     ["watchtower", "armory", "rack", "weapon", "bare", "modular", "modular_split_v2", "harmony"], make_wt_bare_weapon_rack_empty),
    ("watchtower_garrison", "wt_aether_carbine_rifle.png", "Standalone Magipunk Aether-Carbine Rifle", 192, 80, "normal",
     ["watchtower", "armory", "weapon", "rifle", "magipunk", "modular", "modular_split_v2", "harmony"], make_wt_aether_carbine_rifle),
    ("watchtower_garrison", "wt_garrison_halberd_single.png", "Standalone Steel Garrison Polearm Halberd", 224, 80, "normal",
     ["watchtower", "armory", "weapon", "halberd", "guard", "modular", "modular_split_v2", "harmony"], make_wt_garrison_halberd_single),
    ("watchtower_garrison", "wt_bare_mess_hall_table.png", "Bare Plank Garrison Mess Table & Benches", 240, 176, "normal",
     ["watchtower", "barracks", "table", "benches", "bare", "modular", "modular_split_v2", "harmony"], make_wt_bare_mess_hall_table),
    ("watchtower_garrison", "wt_tin_ration_mugs_tray.png", "Tin Ration Mugs, Coffee Pot & Hardtack Tray", 176, 128, "normal",
     ["watchtower", "barracks", "food", "mugs", "coffee", "modular", "modular_split_v2", "harmony"], make_wt_tin_ration_mugs_tray),
    ("watchtower_garrison", "wt_bare_mudroom_bench.png", "Bare Oak Boot-Drying Mudroom Bench", 224, 112, "normal",
     ["watchtower", "barracks", "bench", "bare", "modular", "modular_split_v2", "harmony"], make_wt_bare_mudroom_bench),
    ("watchtower_garrison", "wt_muddy_leather_boots_pair.png", "Standalone Pair of Muddy Leather Guard Boots", 128, 128, "normal",
     ["watchtower", "barracks", "boots", "clutter", "modular", "modular_split_v2", "harmony"], make_wt_muddy_leather_boots_pair),
    ("watchtower_garrison", "wt_folded_greatcoat.png", "Folded Wool Greatcoat (Colorable)", 160, 128, "dd_red",
     ["watchtower", "barracks", "coat", "clothes", "colorable", "dd_red", "modular", "modular_split_v2", "harmony"], make_wt_folded_greatcoat),
    ("watchtower_garrison", "wt_pickelhaube_helmet_shield.png", "Standalone Spiked Helmet & Guard Riot Shield", 176, 144, "normal",
     ["watchtower", "armory", "helmet", "shield", "guard", "modular", "modular_split_v2", "harmony"], make_wt_pickelhaube_helmet_shield),
    ("watchtower_garrison", "wt_signal_flares_bundle.png", "Bundle of Red & Cyan Signal Flare Tubes", 160, 128, "normal",
     ["watchtower", "armory", "flare", "signal", "magipunk", "modular", "modular_split_v2", "harmony"], make_wt_signal_flares_bundle),
    ("watchtower_garrison", "wt_bare_iron_cot_frame.png", "Bare Iron Barracks Cot & Plain Mattress", 176, 272, "normal",
     ["watchtower", "barracks", "cot", "bed", "bare", "modular", "modular_split_v2", "harmony"], make_wt_bare_iron_cot_frame),
    ("watchtower_garrison", "wt_shutter_signal_lamp.png", "Standalone Brass Shutter Signal Lamp", 128, 128, "normal",
     ["watchtower", "signal", "lamp", "brass", "modular", "modular_split_v2", "harmony"], make_wt_shutter_signal_lamp),
    ("watchtower_garrison", "wt_sandbag_single_sack.png", "Single Burlap Fortification Sandbag", 144, 96, "normal",
     ["watchtower", "sandbag", "cover", "barricade", "modular", "modular_split_v2", "harmony"], make_wt_sandbag_single_sack),
    ("watchtower_garrison", "wt_bare_wall_noticeboard.png", "Bare Empty Timber Wall Noticeboard", 224, 128, "normal",
     ["watchtower", "notice", "board", "office", "bare", "modular", "modular_split_v2", "harmony"], make_wt_bare_wall_noticeboard),

    # --- boulevard_shops (22) ---
    ("boulevard_shops", "bs_bare_walnut_tasting_bar.png", "Bare Walnut & Brass Tasting Bar Counter", 320, 144, "normal",
     ["boulevard_shops", "vintner", "bar", "counter", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_walnut_tasting_bar),
    ("boulevard_shops", "bs_wine_decanter_glasses_tray.png", "Crystal Wine Decanter & Tasting Glasses Tray", 160, 128, "normal",
     ["boulevard_shops", "vintner", "wine", "drink", "glasses", "modular", "modular_split_v2", "harmony"], make_bs_wine_decanter_glasses_tray),
    ("boulevard_shops", "bs_bare_mahogany_wall_rack.png", "Bare Empty Mahogany Display & Bottle Rack", 256, 112, "normal",
     ["boulevard_shops", "vintner", "rack", "shelf", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_mahogany_wall_rack),
    ("boulevard_shops", "bs_bare_brass_floor_safe.png", "Standalone Iron & Brass-Dial Floor Safe", 160, 160, "normal",
     ["boulevard_shops", "vintner", "safe", "vault", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_brass_floor_safe),
    ("boulevard_shops", "bs_bare_zinc_shop_counter.png", "Bare Zinc-Topped Shop Service Counter", 288, 144, "normal",
     ["boulevard_shops", "laundry", "counter", "shop", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_zinc_shop_counter),
    ("boulevard_shops", "bs_wrapped_linen_parcels.png", "String-Tied Pressed Linen Laundry Parcels", 160, 144, "normal",
     ["boulevard_shops", "laundry", "linen", "parcels", "modular", "modular_split_v2", "harmony"], make_bs_wrapped_linen_parcels),
    ("boulevard_shops", "bs_bare_brass_garment_rack.png", "Bare Empty Rolling Brass Garment Rack", 256, 112, "normal",
     ["boulevard_shops", "laundry", "tailor", "rack", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_brass_garment_rack),
    ("boulevard_shops", "bs_bare_ironing_board.png", "Bare Padded Linen Ironing Board", 224, 128, "normal",
     ["boulevard_shops", "laundry", "ironing", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_ironing_board),
    ("boulevard_shops", "bs_cast_iron_flatiron.png", "Standalone Vintage Cast-Iron Coal Flatiron", 128, 96, "normal",
     ["boulevard_shops", "laundry", "flatiron", "iron", "modular", "modular_split_v2", "harmony"], make_bs_cast_iron_flatiron),
    ("boulevard_shops", "bs_wooden_bath_duckboard.png", "Slatted Timber Bathhouse Duckboard Mat", 192, 128, "normal",
     ["boulevard_shops", "bath", "bathhouse", "duckboard", "bare", "modular", "modular_split_v2", "harmony"], make_bs_wooden_bath_duckboard),
    ("boulevard_shops", "bs_bath_oil_bottles_sponge.png", "Glass Bath Oil Bottles & Natural Sea Sponge", 144, 128, "normal",
     ["boulevard_shops", "bath", "bathhouse", "bottles", "modular", "modular_split_v2", "harmony"], make_bs_bath_oil_bottles_sponge),
    ("boulevard_shops", "bs_bare_glass_display_case.png", "Bare Empty Beveled-Glass Curio Display Case", 288, 144, "normal",
     ["boulevard_shops", "antiquarian", "curio", "case", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_glass_display_case),
    ("boulevard_shops", "bs_curio_relic_trinkets.png", "Brass Astrolabe, Cameo & Antique Curios", 160, 128, "normal",
     ["boulevard_shops", "antiquarian", "curio", "relic", "modular", "modular_split_v2", "harmony"], make_bs_curio_relic_trinkets),
    ("boulevard_shops", "bs_bare_green_leather_desk.png", "Bare Green-Leather Inlaid Executive Desk", 272, 160, "normal",
     ["boulevard_shops", "antiquarian", "desk", "office", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_green_leather_desk),
    ("boulevard_shops", "bs_bare_jeweler_workbench.png", "Bare Notched Horologist & Jeweler Workbench", 272, 144, "normal",
     ["boulevard_shops", "antiquarian", "workbench", "clockwork", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_jeweler_workbench),
    ("boulevard_shops", "bs_clockwork_gears_loupe.png", "Brass Clockwork Gears & Jeweler's Loupe", 144, 144, "normal",
     ["boulevard_shops", "antiquarian", "clockwork", "gears", "modular", "modular_split_v2", "harmony"], make_bs_clockwork_gears_loupe),
    ("boulevard_shops", "bs_bare_mahogany_cutting_table.png", "Bare Wide Mahogany Cutting & Drafting Table", 304, 160, "normal",
     ["boulevard_shops", "tailor", "table", "drafting", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_mahogany_cutting_table),
    ("boulevard_shops", "bs_tailor_shears_pincushion.png", "Brass Tailor Shears & Velvet Pincushion", 144, 128, "normal",
     ["boulevard_shops", "tailor", "sewing", "tools", "modular", "modular_split_v2", "harmony"], make_bs_tailor_shears_pincushion),
    ("boulevard_shops", "bs_unrolled_fabric_bolt.png", "Unrolled Cloth Bolt (Colorable)", 192, 112, "dd_red",
     ["boulevard_shops", "tailor", "fabric", "colorable", "dd_red", "modular", "modular_split_v2", "harmony"], make_bs_unrolled_fabric_bolt),
    ("boulevard_shops", "bs_bare_velvet_podium.png", "Bare Round Velvet Display Podium (Colorable)", 176, 176, "dd_red",
     ["boulevard_shops", "tailor", "podium", "colorable", "dd_red", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_velvet_podium),
    ("boulevard_shops", "bs_bare_cobbler_bench.png", "Bare Leather-Padded Cobbler Workbench", 256, 144, "normal",
     ["boulevard_shops", "tailor", "cobbler", "workbench", "bare", "modular", "modular_split_v2", "harmony"], make_bs_bare_cobbler_bench),
    ("boulevard_shops", "bs_cobbler_last_hammer_leather.png", "Iron Shoe Last, Cobbler Hammer & Leather", 160, 128, "normal",
     ["boulevard_shops", "tailor", "cobbler", "tools", "modular", "modular_split_v2", "harmony"], make_bs_cobbler_last_hammer_leather),

    # --- community_kid_theater (4 gap splits) ---
    ("community_kid_theater", "kt_bare_puppet_booth_frame.png", "Bare Folding Wooden Puppet Booth Frame", 208, 144, "normal",
     ["theater", "puppet", "booth", "bare", "modular", "modular_split_v2", "harmony"], make_kt_bare_puppet_booth_frame),
    ("community_kid_theater", "kt_bare_backstage_prop_shelf.png", "Bare Wooden Backstage Prop Shelf", 224, 112, "normal",
     ["theater", "backstage", "shelf", "bare", "modular", "modular_split_v2", "harmony"], make_kt_bare_backstage_prop_shelf),
    ("community_kid_theater", "kt_cardboard_megaphone.png", "Kid-Painted Megaphone & Wooden Toy Shield", 160, 128, "normal",
     ["theater", "props", "kids", "toys", "modular", "modular_split_v2", "harmony"], make_kt_cardboard_megaphone),
    ("community_kid_theater", "kt_chalkboard_easel_blank.png", "Blank A-Frame Wooden Chalkboard Easel", 176, 160, "normal",
     ["theater", "sign", "chalkboard", "easel", "bare", "modular", "modular_split_v2", "harmony"], make_kt_chalkboard_easel_blank),
]


def main() -> None:
    manifest_entries = []
    qa_items: list[tuple[str, Image.Image]] = []
    for idx, (pack, fname, title, w, h, draw_mode, tags, fn) in enumerate(ASSET_SPECS, start=1):
        out_dir = MOD_DIR / "props" / pack
        out_dir.mkdir(parents=True, exist_ok=True)
        img = fn(w, h, 10100 + idx * 29)
        img.save(out_dir / fname, "PNG")
        rel_path = f"props/{pack}/{fname}"
        manifest_entries.append({
            "path": rel_path,
            "displayName": title,
            "category": "object",
            "tags": tags,
            "drawMode": draw_mode,
            "defaultPpi": 128,
            "castsShadow": True,
            "dominantHex": dominant_hex(img),
            "widthPx": img.width,
            "heightPx": img.height,
        })
        qa_items.append((fname.replace(".png", ""), img))
        print(f"  [{idx:02d}/{len(ASSET_SPECS)}] {rel_path} ({img.width}x{img.height}, {draw_mode})")

    total = upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    qa_path = SCRATCH_DIR / "qa_modular_splits_v2_a.png"
    save_qa_sheet(qa_items, qa_path, cols=8, cw=210, ch=160)
    print(f"\nGenerated {len(ASSET_SPECS)} Wave 2 Batch A modular splits (manifest total={total}) -> {qa_path}")


if __name__ == "__main__":
    main()

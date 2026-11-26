"""
Dice Chaos Compass — Wave 2 Modular Splits Generator (Batch B: 50 Standalone Assets)

Splits every composite hero across the remaining 4 post-Wave-1 packs into clean-room,
2x-supersampled Studio Harmony bare furniture bases + standalone loose sub-props:
  5. props/aged_streetcar_line/  (2 splits)
  6. props/post_housing/         (12 splits)
  7. props/hostel_living/        (18 splits, incl. 1 dd_red colorable)
  8. props/crowded_family/       (18 splits, incl. 3 dd_red colorable)

Preserves 100% of original composite heroes untouched. Every entry carries
`"modular"` and `"modular_split_v2"` tags (plus `"bare"` on bare bases).
Combined with Batch A (68), delivers 118 Wave 2 Modular Splits across all 8 packs!
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
    save_qa_sheet,
    upsert_manifest_entries,
    dominant_hex,
)

WALNUT = (96, 64, 44)
OAK = (156, 114, 72)
PINE = (188, 150, 102)
PINE_LT = (210, 176, 126)
IRON = (62, 68, 76)
IRON_DK = (36, 40, 48)
STEEL = (138, 148, 158)
BRASS = (208, 166, 74)
BRASS_HI = (240, 208, 118)
COPPER = (190, 110, 66)
ENAMEL = (232, 236, 234)
CREAM = (244, 236, 218)
LINEN = (228, 216, 192)
PAPER = (238, 228, 202)
CANVAS = (200, 188, 162)
KRAFT = (184, 146, 98)
WICKER = (182, 142, 86)
LEATHER = (134, 82, 48)
LEATHER_DK = (76, 46, 28)
BROWN_BEAR = (152, 102, 62)
TERRACOTTA = (186, 86, 58)
CORAL = (206, 92, 78)
RED_TOY = (196, 56, 54)
SUNNY = (226, 182, 66)
OCHRE = (204, 150, 62)
SKY = (96, 156, 196)
TEAL = (54, 126, 128)
MINT = (132, 186, 146)
SAGE = (102, 136, 98)
CERAMIC_BLUE = (56, 98, 138)
PRUSSIAN = (44, 76, 114)
LAVENDER = (146, 118, 168)
ROSE = (212, 134, 146)
GLASS = (186, 216, 226)
SLATE = (92, 102, 112)


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


def draw_teddy(d: ImageDraw.ImageDraw, cx: float, cy: float, s: float = 1.0, col=BROWN_BEAR) -> None:
    draw_disc(d, cx - 12 * s, cy - 12 * s, 7 * s, col, ink_w=2)
    draw_disc(d, cx + 12 * s, cy - 12 * s, 7 * s, col, ink_w=2)
    draw_disc(d, cx, cy + 12 * s, 15 * s, col, ink_w=3)
    draw_disc(d, cx, cy - 5 * s, 13 * s, col, ink_w=3)
    draw_disc(d, cx, cy - 1 * s, 6 * s, PINE_LT, ink_w=2)


# =============================================================================
# 5. AGED STREETCAR LINE — 2 MODULAR SPLITS
# =============================================================================

def make_st_bare_tram_shelter_frame(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 22, W - 22, H - 22, IRON, radius=10, ink_w=6)
    for px in range(44, W - 64, 96):
        draw_beveled_rect(d, px, 38, px + 82, H - 38, (172, 198, 206), radius=4, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_st_tram_shelter_bench(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    for ax in [36, W - 52]:
        draw_beveled_rect(d, ax, 24, ax + 18, H - 24, IRON_DK, radius=4, ink_w=4)
    for sy in [32, 62, 92, 122]:
        if sy + 20 < H - 18:
            draw_beveled_rect(d, 26, sy, W - 26, sy + 20, OAK, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


# =============================================================================
# 6. POST OFFICE & PUBLIC HOUSING — 12 MODULAR SPLITS
# =============================================================================

def make_ph_bare_teller_counter(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 36, 38, W - 36, H - 38, OAK, random.Random(seed), horizontal=True, n_planks=4)
    draw_beveled_rect(d, 44, H - 46, W - 44, H - 28, BRASS, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_ph_brass_teller_grille_arch(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 36, W - 22, H - 36, WALNUT, radius=8, ink_w=5)
    for bx in range(44, W - 36, 26):
        draw_disc(d, bx, H // 2, 8, BRASS_HI, ink_w=2)
    d.line([(36, H // 2), (W - 36, H // 2)], fill=BRASS, width=8)
    return finish_prop(im, w, h, seed)


def make_ph_bare_sorting_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 34, 36, W - 34, H - 36, PINE, random.Random(seed), horizontal=True, n_planks=5)
    return finish_prop(im, w, h, seed)


def make_ph_stacked_parcels_letters_bin(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Slatted oak mail tray frame
    draw_beveled_rect(d, 20, 24, W - 20, H - 24, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 30, 34, W - 30, H - 34, OAK, random.Random(seed), horizontal=True, n_planks=4)
    # Brown kraft parcel tied with crisp crisscross hemp twine + postage stamp + address lines
    px0, py0, px1, py1 = 36, 40, 152, H - 40
    draw_beveled_rect(d, px0, py0, px1, py1, KRAFT, radius=8, ink_w=4)
    mx, my = (px0 + px1) // 2, (py0 + py1) // 2
    d.line([(px0 + 6, my), (px1 - 6, my)], fill=WALNUT, width=5)
    d.line([(mx, py0 + 6), (mx, py1 - 6)], fill=WALNUT, width=5)
    draw_disc(d, mx, my, 8, CANVAS, ink_w=2)
    draw_beveled_rect(d, px1 - 32, py0 + 8, px1 - 10, py0 + 30, PRUSSIAN, radius=2, ink_w=2)
    # Three neatly stacked envelopes with folded V-flaps & crimson wax seals
    for idx, ly in enumerate([42, 92, 142]):
        if ly + 44 < H - 24:
            ex0, ex1 = 166 + (idx % 2) * 6, W - 36 - (idx % 2) * 4
            draw_beveled_rect(d, ex0, ly, ex1, ly + 42, PAPER, radius=4, ink_w=3)
            emx = (ex0 + ex1) // 2
            d.line([(ex0 + 4, ly + 4), (emx, ly + 24), (ex1 - 4, ly + 4)], fill=INK_MID, width=3)
            draw_disc(d, emx, ly + 24, 7, RED_TOY, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_ph_bare_wooden_hand_truck(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Side rails & cross slats + two rear iron wheels
    for ry in [42, H - 64]:
        draw_beveled_rect(d, 24, ry, W - 24, ry + 22, WALNUT, radius=5, ink_w=4)
    for sx in range(74, W - 74, 54):
        draw_beveled_rect(d, sx, 48, sx + 22, H - 48, OAK, radius=4, ink_w=3)
    draw_beveled_rect(d, 26, 26, 48, 52, IRON_DK, radius=4, ink_w=3)
    draw_beveled_rect(d, 26, H - 52, 48, H - 26, IRON_DK, radius=4, ink_w=3)
    draw_beveled_rect(d, W - 44, 34, W - 20, H - 34, IRON, radius=5, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_ph_stuffed_canvas_mailbag(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 30, 32, W - 56, H - 32, CANVAS, radius=38, ink_w=5)
    d.line([(68, 42), (68, H - 42)], fill=PRUSSIAN, width=8)
    draw_beveled_rect(d, W - 76, H // 2 - 22, W - 24, H // 2 + 22, LEATHER, radius=10, ink_w=4)
    draw_beveled_rect(d, W - 58, H // 2 - 14, W - 22, H // 2 + 14, PAPER, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_ph_bare_sloped_writing_desk(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 36, 36, W - 36, 72, OAK, radius=5, ink_w=3)
    draw_wood_planks_box(d, 36, 76, W - 36, H - 36, PINE, random.Random(seed), horizontal=True, n_planks=3)
    return finish_prop(im, w, h, seed)


def make_ph_bare_compact_counter(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 22, W - 22, H - 22, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 30, 28, W - 30, 50, ENAMEL, radius=4, ink_w=3)
    draw_wood_planks_box(d, 32, 52, W - 32, H - 32, PINE, random.Random(seed), horizontal=True, n_planks=4)
    return finish_prop(im, w, h, seed)


def make_ph_two_burner_hotplate(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 28, W - 24, H - 28, IRON, radius=10, ink_w=5)
    for bx in [W * 0.32, W * 0.68]:
        draw_disc(d, bx, H * 0.50, 34, IRON_DK, ink_w=4)
        d.line([(bx - 26, H * 0.50), (bx + 26, H * 0.50)], fill=STEEL, width=4)
        d.line([(bx, H * 0.50 - 26), (bx, H * 0.50 + 26)], fill=STEEL, width=4)
    return finish_prop(im, w, h, seed)


def make_ph_bare_single_iron_bed(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 28, 28, W - 28, H - 28, IRON_DK, radius=12, ink_w=6)
    draw_beveled_rect(d, 44, 44, W - 44, H - 44, CREAM, radius=14, ink_w=4)
    draw_beveled_rect(d, 60, 60, W - 60, 140, (248, 244, 232), radius=22, ink_w=4)
    for px, py in [(36, 36), (W - 36, 36), (36, H - 36), (W - 36, H - 36)]:
        draw_disc(d, px, py, 14, BRASS, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_ph_bare_entryway_bench(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 26, W - 22, H - 26, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 34, 38, W - 34, H - 38, OAK, random.Random(seed), horizontal=True, n_planks=3)
    return finish_prop(im, w, h, seed)


def make_ph_paper_flyers_books_pile(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Folded Berlin broadsheet newspaper with masthead bar & newsprint columns
    draw_beveled_rect(d, 26, 32, 134, 118, (226, 218, 198), radius=5, ink_w=4)
    d.rectangle([38, 44, 122, 56], fill=INK_MID)
    for cy in range(66, 108, 12):
        d.line([(38, cy), (76, cy)], fill=(108, 98, 86, 210), width=3)
        d.line([(84, cy), (122, cy)], fill=(108, 98, 86, 210), width=3)
    # Stamped cream civic handbill flyer with red stamp badge
    draw_beveled_rect(d, 116, 26, 224, 114, PAPER, radius=5, ink_w=4)
    for cy in range(44, 100, 14):
        d.line([(130, cy), (208, cy)], fill=(116, 100, 82, 200), width=3)
    draw_disc(d, 198, 88, 10, RED_TOY, ink_w=2)
    # Cloth-bound Prussian-blue & terracotta pocket books with gilded spine ribs & page edges
    for bx, by, bw, bh, col in [(42, 112, 124, 92, PRUSSIAN), (144, 104, 122, 86, TERRACOTTA)]:
        draw_beveled_rect(d, bx, by, bx + bw, by + bh, col, radius=6, ink_w=4)
        d.rectangle([bx + 6, by + 6, bx + 20, by + bh - 6], fill=blend_rgb(col, (20, 16, 14), 0.35), outline=INK, width=2)
        for ry in [by + 20, by + bh // 2, by + bh - 20]:
            d.line([(bx + 7, ry), (bx + 19, ry)], fill=BRASS_HI, width=3)
        d.rectangle([bx + 32, by + 18, bx + bw - 16, by + bh - 18], outline=BRASS, width=2)
        d.line([(bx + bw - 8, by + 10), (bx + bw - 8, by + bh - 10)], fill=CREAM, width=4)
    return finish_prop(im, w, h, seed)


# =============================================================================
# 7. SHARED-LIVING HOSTEL — 18 MODULAR SPLITS
# =============================================================================

def make_hs_bare_wooden_bunk_frame(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    bx0, by0, bx1, by1 = 36, 32, W - 64, H - 32
    draw_beveled_rect(d, bx0, by0, bx1, by1, WALNUT, radius=10, ink_w=6)
    # Ladder stiles & rungs on right
    lx0, lx1, ly0, ly1 = bx1 - 6, W - 26, int(H * 0.30), int(H * 0.78)
    draw_beveled_rect(d, lx0, ly0, lx0 + 18, ly1, OAK, radius=5, ink_w=4)
    draw_beveled_rect(d, lx1 - 18, ly0, lx1, ly1, OAK, radius=5, ink_w=4)
    for i in range(5):
        ry = int(ly0 + 24 + i * ((ly1 - ly0 - 48) / 4.0))
        draw_beveled_rect(d, lx0 + 4, ry - 9, lx1 - 4, ry + 9, PINE, radius=4, ink_w=3)
    draw_beveled_rect(d, bx0 + 22, by0 + 24, bx1 - 22, by1 - 24, CREAM, radius=14, ink_w=4)
    draw_beveled_rect(d, bx0 + 40, by0 + 44, bx1 - 40, by0 + 132, (248, 244, 232), radius=22, ink_w=4)
    for px, py in [(bx0 + 10, by0 + 10), (bx1 - 10, by0 + 10), (bx0 + 10, by1 - 10), (bx1 - 10, by1 - 10)]:
        draw_beveled_rect(d, px - 18, py - 18, px + 18, py + 18, OAK, radius=6, ink_w=5)
    return finish_prop(im, w, h, seed)


def make_hs_bunk_ladder_wood(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 30, 22, 54, H - 22, OAK, radius=5, ink_w=4)
    draw_beveled_rect(d, W - 54, 22, W - 30, H - 22, OAK, radius=5, ink_w=4)
    for i in range(6):
        ry = int(46 + i * ((H - 92) / 5.0))
        draw_beveled_rect(d, 40, ry - 10, W - 40, ry + 10, PINE, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_hs_bare_locker_cabinet(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    x0, y0, x1, y1 = 24, 24, W - 24, H - 30
    draw_beveled_rect(d, x0, y0, x1, y1, WALNUT, radius=10, ink_w=6)
    bay_w = (x1 - x0 - 24) / 4.0
    rng = random.Random(seed)
    for i in range(4):
        bx0 = int(x0 + 12 + i * bay_w)
        bx1 = int(bx0 + bay_w - 6)
        draw_wood_planks_box(d, bx0, y0 + 10, bx1, y1 - 10, OAK if i % 2 == 0 else PINE, rng, horizontal=True, n_planks=3)
        draw_beveled_rect(d, bx1 - 36, y1 - 2, bx1 - 14, y1 + 14, BRASS, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_hs_canvas_rucksack_single(w: int, h: int, seed: int) -> Image.Image:
    """Colorable dd_red strapped traveler canvas rucksack."""
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 30, 26, W - 30, H - 26, DD_RED_BASE, radius=28, ink_w=5)
    draw_beveled_rect(d, 44, 34, W - 44, H // 2, DD_RED_HI, radius=18, ink_w=3)
    d.rectangle([62, 34, 78, H - 30], fill=LEATHER, outline=INK, width=3)
    d.rectangle([W - 78, 34, W - 62, H - 30], fill=LEATHER, outline=INK, width=3)
    draw_beveled_rect(d, 58, H // 2 - 10, 82, H // 2 + 10, BRASS_HI, radius=3, ink_w=2)
    draw_beveled_rect(d, W - 82, H // 2 - 10, W - 58, H // 2 + 10, BRASS_HI, radius=3, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_hs_bare_reception_counter(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=12, ink_w=6)
    draw_wood_planks_box(d, 36, 38, W - 36, H - 38, OAK, random.Random(seed), horizontal=True, n_planks=4)
    return finish_prop(im, w, h, seed)


def make_hs_wall_key_hook_rack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 24, W - 22, H - 28, WALNUT, radius=8, ink_w=5)
    for idx, kx in enumerate(range(54, W - 44, 48)):
        draw_disc(d, kx, H // 2 - 10, 8, BRASS_HI, ink_w=2)
        draw_beveled_rect(d, kx - 8, H // 2, kx + 10, H - 20, TERRACOTTA if idx % 2 == 0 else TEAL, radius=4, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_hs_guestbook_bell_pamphlets(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Open leather-bound hostel register with ruled handwriting lines, bookmark ribbon & pen
    draw_beveled_rect(d, 22, 28, 162, H - 28, LEATHER_DK, radius=8, ink_w=5)
    draw_beveled_rect(d, 32, 38, 90, H - 38, PAPER, radius=4, ink_w=3)
    draw_beveled_rect(d, 94, 38, 152, H - 38, CREAM, radius=4, ink_w=3)
    for ly in range(52, H - 48, 14):
        d.line([(40, ly), (82, ly)], fill=(108, 92, 76, 200), width=2)
        d.line([(102, ly), (144, ly)], fill=(108, 92, 76, 200), width=2)
    d.line([(92, 38), (92, H - 20)], fill=TERRACOTTA, width=5)  # silk bookmark ribbon
    d.line([(114, H - 36), (168, 44)], fill=INK, width=7)
    d.line([(114, H - 36), (168, 44)], fill=WALNUT, width=3)
    # Domed brass concierge service bell with dark stepped base & plunger button
    draw_disc(d, 204, H // 2, 28, IRON_DK, ink_w=4)
    draw_disc(d, 204, H // 2, 22, BRASS, ink_w=3)
    draw_disc(d, 204, H // 2, 8, BRASS_HI, ink_w=2)
    # Fanned illustrated city transit brochures
    draw_beveled_rect(d, 240, 38, W - 36, H - 44, SAGE, radius=5, ink_w=4)
    d.rectangle([250, 50, W - 46, 76], fill=CREAM, outline=INK_MID, width=2)
    for ly in range(88, H - 56, 12):
        d.line([(250, ly), (W - 48, ly)], fill=CREAM, width=2)
    draw_beveled_rect(d, 256, 54, W - 22, H - 30, OCHRE, radius=5, ink_w=4)
    d.rectangle([266, 66, W - 32, 92], fill=PAPER, outline=INK_MID, width=2)
    for ly in range(104, H - 42, 12):
        d.line([(266, ly), (W - 34, ly)], fill=WALNUT, width=2)
    return finish_prop(im, w, h, seed)


def make_hs_bare_bench_dining_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(seed)
    draw_beveled_rect(d, 52, 20, W - 52, 64, WALNUT, radius=8, ink_w=5)
    draw_wood_planks_box(d, 58, 26, W - 58, 58, PINE, rng, horizontal=True, n_planks=2)
    draw_beveled_rect(d, 52, H - 64, W - 52, H - 20, WALNUT, radius=8, ink_w=5)
    draw_wood_planks_box(d, 58, H - 58, W - 58, H - 26, PINE, rng, horizontal=True, n_planks=2)
    draw_beveled_rect(d, 24, 62, W - 24, H - 62, WALNUT, radius=12, ink_w=6)
    draw_wood_planks_box(d, 36, 74, W - 36, H - 74, OAK, rng, horizontal=True, n_planks=5)
    return finish_prop(im, w, h, seed)


def make_hs_traveler_map_compass(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Quad-folded vintage city transit map with fold creases, shaded park & city blocks
    mx0, my0, mx1, my1 = 22, 26, W - 22, H - 26
    draw_beveled_rect(d, mx0, my0, mx1, my1, (228, 214, 180), radius=6, ink_w=5)
    d.rectangle([mx0 + 10, my0 + 10, mx1 - 10, my1 - 10], outline=(146, 128, 98, 210), width=2)
    # Soft vertical & horizontal paper fold crease lines
    d.line([(W // 2, my0 + 8), (W // 2, my1 - 8)], fill=(162, 144, 112, 150), width=4)
    d.line([(mx0 + 8, H // 2), (mx1 - 8, H // 2)], fill=(162, 144, 112, 150), width=4)
    # Shaded green park & warm city blocks + canal + dashed tramway route
    d.rounded_rectangle([42, 46, 108, 92], radius=8, fill=(148, 172, 122, 240), outline=(92, 110, 74, 210), width=2)
    for bx, by, bw, bh in [(118, 46, 44, 24), (44, 106, 52, 26), (114, 116, 46, 28), (46, 148, 48, 24), (168, 126, 46, 36)]:
        d.rectangle([bx, by, bx + bw, by + bh], fill=(204, 188, 152, 255), outline=(132, 114, 86, 210), width=2)
    d.line([(40, H - 46), (124, 114), (W - 44, 92)], fill=(76, 116, 134, 220), width=7)
    d.line([(46, 56), (114, 104), (W - 50, H - 46)], fill=(176, 68, 52, 230), width=4)
    # Open brass pocket compass with white dial, cardinal ticks & crimson-tipped steel needle
    cx, cy = W - 66, 72
    draw_disc(d, cx, cy, 30, BRASS, ink_w=4)
    draw_disc(d, cx, cy, 21, CREAM, ink_w=3)
    for a in range(0, 360, 45):
        rad = math.radians(a)
        d.line([(cx + math.cos(rad) * 14, cy + math.sin(rad) * 14),
                (cx + math.cos(rad) * 19, cy + math.sin(rad) * 19)], fill=INK_MID, width=2)
    d.line([(cx - 12, cy + 8), (cx, cy)], fill=IRON_DK, width=4)
    d.line([(cx, cy), (cx + 12, cy - 8)], fill=RED_TOY, width=4)
    draw_disc(d, cx, cy, 4, BRASS_HI, ink_w=1)
    return finish_prop(im, w, h, seed)


def make_hs_enamel_teapot_mugs_set(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W * 0.42, H * 0.50, 34, CERAMIC_BLUE, ink_w=4)
    draw_disc(d, W * 0.42, H * 0.50, 12, ENAMEL, ink_w=3)
    d.line([(W * 0.42 + 28, H * 0.50), (W * 0.42 + 52, H * 0.44)], fill=CERAMIC_BLUE, width=8)
    for mx, my, col in [(W * 0.74, H * 0.34, TERRACOTTA), (W * 0.76, H * 0.68, SAGE), (W * 0.24, H * 0.76, OCHRE)]:
        draw_disc(d, mx, my, 17, col, ink_w=3)
        draw_disc(d, mx, my, 10, LEATHER_DK, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_hs_bare_galley_counter(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 22, W - 22, H - 24, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 28, 26, W - 28, 48, ENAMEL, radius=4, ink_w=3)
    for tx in range(48, W - 36, 28):
        d.line([(tx, 28), (tx, 46)], fill=SLATE, width=2)
    draw_wood_planks_box(d, 32, 50, W - 32, H - 34, PINE, random.Random(seed), horizontal=True, n_planks=4)
    return finish_prop(im, w, h, seed)


def make_hs_dish_drying_rack_plates(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 26, W - 24, H - 26, OAK, radius=8, ink_w=5)
    for py in range(44, H - 40, 24):
        draw_beveled_rect(d, 38, py - 7, W - 38, py + 7, ENAMEL, radius=4, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_hs_bare_enamel_wash_trough(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    x0, y0, x1, y1 = 22, 22, W - 22, H - 24
    draw_beveled_rect(d, x0 + 6, y0, x1 - 6, y0 + 26, WALNUT, radius=6, ink_w=4)
    draw_beveled_rect(d, x0, y0 + 24, x1, y1, ENAMEL, radius=16, ink_w=6)
    draw_beveled_rect(d, x0 + 18, y0 + 42, x1 - 18, y1 - 18, (202, 218, 222), radius=12, ink_w=4)
    for i in range(3):
        cx = int(x0 + 64 + i * ((x1 - x0 - 128) / 2.0))
        d.rectangle([cx - 6, y0 + 18, cx + 6, y0 + 54], fill=BRASS_HI, outline=INK, width=3)
        draw_disc(d, cx, int((y0 + 42 + y1 - 18) / 2) + 8, 9, BRASS, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_hs_rolled_towels_soap_set(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    for tx, tc in [(34, TERRACOTTA), (104, TEAL)]:
        draw_beveled_rect(d, tx, 38, tx + 58, H - 38, CREAM, radius=12, ink_w=4)
        d.rectangle([tx + 6, 62, tx + 52, 76], fill=tc)
        d.rectangle([tx + 6, H - 76, tx + 52, H - 62], fill=tc)
    draw_beveled_rect(d, 182, 54, W - 32, 98, ROSE, radius=10, ink_w=3)
    draw_beveled_rect(d, 186, 114, W - 36, 158, MINT, radius=10, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_hs_bare_cubby_bench(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 22, 26, W - 22, H - 26, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 34, 38, W - 34, H - 38, OAK, random.Random(seed), horizontal=True, n_planks=3)
    return finish_prop(im, w, h, seed)


def make_hs_wooden_walking_staff(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Rolled canvas traveler's bedroll with stitched edges & buckled leather cinch straps
    draw_beveled_rect(d, 48, 30, 174, 98, (186, 152, 92), radius=24, ink_w=5)
    d.line([(58, 52), (164, 52)], fill=(138, 104, 56, 200), width=3)
    d.line([(58, 76), (164, 76)], fill=(138, 104, 56, 200), width=3)
    for sx in [84, 138]:
        draw_beveled_rect(d, sx - 6, 28, sx + 6, 100, LEATHER_DK, radius=3, ink_w=3)
        draw_beveled_rect(d, sx - 8, 56, sx + 8, 72, BRASS_HI, radius=2, ink_w=2)
    # Knotted hand-carved ash hiking staff with leather grip wrap & iron ferrule tip
    x0, y0, x1, y1 = 28, H - 40, W - 28, 42
    d.line([(x0, y0), (x1, y1)], fill=INK, width=22)
    d.line([(x0, y0), (x1, y1)], fill=OAK, width=14)
    d.line([(x0 + 2, y0 - 2), (x1 - 2, y1 + 2)], fill=PINE_LT, width=5)
    # Iron foot ferrule on lower-left tip + wrapped leather hand-grip near upper third
    d.line([(x0, y0), (x0 + 34, y0 - 20)], fill=IRON, width=14)
    d.line([(x0, y0), (x0 + 34, y0 - 20)], fill=STEEL, width=4)
    gx0, gy0 = x0 + (x1 - x0) * 0.56, y0 + (y1 - y0) * 0.56
    gx1, gy1 = x0 + (x1 - x0) * 0.78, y0 + (y1 - y0) * 0.78
    d.line([(gx0, gy0), (gx1, gy1)], fill=LEATHER_DK, width=18)
    d.line([(gx0, gy0), (gx1, gy1)], fill=LEATHER, width=11)
    draw_disc(d, x1, y1, 10, BRASS, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_hs_bare_round_braided_rug(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy = W / 2.0, H / 2.0
    rng = random.Random(seed)
    # Concentric hand-braided rag-rug coils in muted warm Harmony yarns (ZERO flat bullseye!)
    bands = [
        (194, 168, (158, 82, 58)),
        (168, 142, (186, 144, 72)),
        (142, 116, (216, 202, 174)),
        (116, 90, (72, 118, 118)),
        (90, 64, (148, 76, 56)),
        (64, 38, (178, 138, 68)),
        (38, 0, (206, 192, 164)),
    ]
    for r_out, r_in, col in bands:
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=(*col, 255), outline=INK, width=4)
        # Individual woven plait/braid stitch segments around the circumference
        r_mid = (r_out + r_in) * 0.5
        if r_mid > 16:
            n_stitches = max(14, int((math.tau * r_mid) / 22.0))
            dk = blend_rgb(col, (26, 20, 18), 0.36)
            hi = blend_rgb(col, (246, 236, 214), 0.28)
            for k in range(n_stitches):
                a0 = (k / n_stitches) * math.tau
                a1 = ((k + 0.6) / n_stitches) * math.tau
                p0 = (cx + math.cos(a0) * (r_in + 4), cy + math.sin(a0) * (r_in + 4))
                p1 = (cx + math.cos(a1) * (r_out - 4), cy + math.sin(a1) * (r_out - 4))
                d.line([p0, p1], fill=dk, width=3)
                if k % 2 == 0:
                    pm = (cx + math.cos((a0 + a1) * 0.5) * r_mid, cy + math.sin((a0 + a1) * 0.5) * r_mid)
                    d.ellipse([pm[0] - 4, pm[1] - 4, pm[0] + 4, pm[1] + 4], fill=hi)
    return finish_prop(im, w, h, seed, grain=6.4)


def make_hs_wooden_tea_tray_cups(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy = W / 2.0, H / 2.0
    draw_disc(d, cx, cy, min(W, H) * 0.40, OAK, ink_w=5)
    draw_disc(d, cx, cy, min(W, H) * 0.33, PINE, ink_w=3)
    draw_disc(d, cx - 26, cy - 20, 16, CERAMIC_BLUE, ink_w=3)
    draw_disc(d, cx + 24, cy + 22, 16, TERRACOTTA, ink_w=3)
    draw_disc(d, cx + 22, cy - 24, 16, BRASS_HI, ink_w=3)
    draw_beveled_rect(d, int(cx - 46), int(cy + 10), int(cx), int(cy + 44), PAPER, radius=4, ink_w=2)
    return finish_prop(im, w, h, seed)


# =============================================================================
# 8. CROWDED MULTI-FAMILY & KIDS — 18 MODULAR SPLITS
# =============================================================================

def make_cf_bare_wooden_baby_crib(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    x0, y0, x1, y1 = 26, 26, W - 26, H - 26
    draw_beveled_rect(d, x0, y0, x1, y1, OAK, radius=12, ink_w=6)
    draw_beveled_rect(d, x0 + 24, y0 + 24, x1 - 24, y1 - 24, CREAM, radius=14, ink_w=4)
    draw_beveled_rect(d, x0 + 48, y0 + 42, x1 - 48, y0 + 108, (248, 244, 232), radius=20, ink_w=3)
    for sx in range(x0 + 36, x1 - 24, 34):
        draw_disc(d, sx, y0 + 12, 6, PINE_LT, ink_w=2)
        draw_disc(d, sx, y1 - 12, 6, PINE_LT, ink_w=2)
    for sy in range(y0 + 36, y1 - 24, 34):
        draw_disc(d, x0 + 12, sy, 6, PINE_LT, ink_w=2)
        draw_disc(d, x1 - 12, sy, 6, PINE_LT, ink_w=2)
    for px, py in [(x0 + 10, y0 + 10), (x1 - 10, y0 + 10), (x0 + 10, y1 - 10), (x1 - 10, y1 - 10)]:
        draw_disc(d, px, py, 15, OAK, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_cf_hanging_crib_mobile(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy = W / 2.0, H / 2.0
    # Hand-turned maple crossbars with dark ink outlines & brass center suspension ring
    for p0, p1 in [((cx - 60, cy - 46), (cx + 60, cy + 46)), ((cx - 60, cy + 46), (cx + 60, cy - 46))]:
        d.line([p0, p1], fill=INK, width=14)
        d.line([p0, p1], fill=PINE_LT, width=8)
    # 1. Golden crescent moon (top-left)
    mx, my = cx - 56, cy - 44
    draw_disc(d, mx, my, 22, SUNNY, ink_w=4)
    d.ellipse([mx - 4, my - 18, mx + 22, my + 8], fill=(0, 0, 0, 0))
    # 2. Puffy stitched cream felt cloud (bottom-right)
    clx, cly = cx + 52, cy + 42
    for dx, dy, r in [(-14, 4, 15), (0, -6, 17), (14, 4, 15)]:
        draw_disc(d, clx + dx, cly + dy, r, CREAM, ink_w=3)
    # 3. Painted red wooden bird charm (bottom-left)
    bx, by = cx - 54, cy + 42
    draw_disc(d, bx, by, 18, CORAL, ink_w=4)
    d.polygon([(bx + 14, by - 5), (bx + 28, by), (bx + 14, by + 5)], fill=(*OCHRE, 255), outline=INK)
    # 4. Five-point painted wooden star (top-right)
    sx, sy = cx + 54, cy - 42
    spts = []
    for i in range(10):
        a = i * math.pi / 5 - math.pi / 2
        sr = 22 if i % 2 == 0 else 10
        spts.append((sx + math.cos(a) * sr, sy + math.sin(a) * sr))
    d.polygon(spts, fill=(*SKY, 255), outline=INK)
    d.line(spts + [spts[0]], fill=INK, width=4)
    draw_disc(d, cx, cy, 14, BRASS, ink_w=4)
    draw_disc(d, cx, cy, 6, BRASS_HI, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_cf_bare_wooden_double_bed(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    x0, y0, x1, y1 = 28, 28, W - 28, H - 28
    draw_beveled_rect(d, x0, y0, x1, y1, WALNUT, radius=12, ink_w=6)
    mx0, my0, mx1, my1 = x0 + 22, y0 + 26, x1 - 22, y1 - 22
    draw_beveled_rect(d, mx0, my0, mx1, my1, CREAM, radius=14, ink_w=4)
    mid = (mx0 + mx1) // 2
    draw_beveled_rect(d, mx0 + 18, my0 + 18, mid - 14, my0 + 112, (248, 244, 232), radius=20, ink_w=4)
    draw_beveled_rect(d, mid + 14, my0 + 18, mx1 - 18, my0 + 112, (248, 244, 232), radius=20, ink_w=4)
    draw_beveled_rect(d, mx0 + 8, my0 + 130, mx1 - 8, my1 - 8, LINEN, radius=14, ink_w=4)
    for px, py in [(x0 + 10, y0 + 10), (x1 - 10, y0 + 10), (x0 + 10, y1 - 10), (x1 - 10, y1 - 10)]:
        draw_disc(d, px, py, 16, OAK, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_cf_single_sleeping_mat_colorable(w: int, h: int, seed: int) -> Image.Image:
    """Colorable dd_red single roll-out kids' floor sleeping mat."""
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, CREAM, radius=18, ink_w=5)
    draw_beveled_rect(d, 44, 42, W - 44, 114, (248, 244, 232), radius=20, ink_w=4)
    draw_beveled_rect(d, 36, 120, W - 36, H - 36, DD_RED_BASE, radius=14, ink_w=5)
    for sy in range(152, H - 46, 36):
        d.line([(48, sy), (W - 48, sy)], fill=DD_RED_HI, width=4)
    return finish_prop(im, w, h, seed)


def make_cf_wooden_baby_highchair(w: int, h: int, seed: int) -> Image.Image:
    """Colorable dd_red painted wooden baby high chair with wooden meal tray."""
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 44, 30, W - 44, H - 46, DD_RED_BASE, radius=14, ink_w=5)
    draw_beveled_rect(d, 58, 52, W - 58, H - 76, DD_RED_DEEP, radius=10, ink_w=3)
    # Front wooden feeding tray
    draw_beveled_rect(d, 28, H - 96, W - 28, H - 30, PINE_LT, radius=14, ink_w=5)
    draw_disc(d, W / 2, H - 62, 16, CREAM, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_cf_soup_tureen_bowls_set(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_disc(d, W * 0.44, H * 0.50, 44, COPPER, ink_w=5)
    draw_disc(d, W * 0.44, H * 0.50, 32, SUNNY, ink_w=2)
    for bx, by, col in [(W * 0.78, H * 0.34, SKY), (W * 0.80, H * 0.68, MINT), (W * 0.22, H * 0.76, ROSE)]:
        draw_disc(d, bx, by, 20, col, ink_w=3)
        draw_disc(d, bx, by, 12, OCHRE, ink_w=2)
    return finish_prop(im, w, h, seed)


def make_cf_bare_parlor_sofa_colorable(w: int, h: int, seed: int) -> Image.Image:
    """Colorable dd_red classic wooden-framed family parlor sofa."""
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 24, 26, W - 24, H - 26, WALNUT, radius=16, ink_w=6)
    # Upholstered backrest & 3 seat cushions in dd_red
    draw_beveled_rect(d, 40, 38, W - 40, 96, DD_RED_DEEP, radius=12, ink_w=4)
    cw = (W - 96) // 3
    for i in range(3):
        cx0 = 44 + i * (cw + 4)
        draw_beveled_rect(d, cx0, 92, cx0 + cw, H - 38, DD_RED_BASE, radius=14, ink_w=4)
    # Rolled wooden armrests
    draw_beveled_rect(d, 24, 42, 54, H - 32, OAK, radius=10, ink_w=4)
    draw_beveled_rect(d, W - 54, 42, W - 24, H - 32, OAK, radius=10, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_cf_draped_blanket_fort_canopy(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Draped sage-teal base sheet with scalloped tent entrance fold
    poly = [(42, 30), (W - 42, 30), (W - 22, H - 28), (W // 2 + 28, H - 56), (W // 2 - 28, H - 56), (22, H - 28)]
    d.polygon(poly, fill=(*(62, 114, 116), 255), outline=INK)
    d.line(poly + [poly[0]], fill=INK, width=6)
    # Three overlapping cozy patched quilts in warm Harmony flannel hues with crease folds & quilting stitches
    quilts = [
        (72, 38, 198, H - 58, (176, 86, 72)),
        (186, 36, 312, H - 62, (198, 158, 72)),
        (302, 40, W - 62, H - 54, (86, 132, 162)),
    ]
    for qx0, qy0, qx1, qy1, col in quilts:
        draw_beveled_rect(d, qx0, qy0, qx1, qy1, col, radius=16, ink_w=4, hi_amt=0.22, sh_amt=0.36)
        dk = blend_rgb(col, (26, 20, 18), 0.34)
        hi = blend_rgb(col, (248, 238, 218), 0.24)
        # Soft fabric drape crease & stitched quilt hem
        d.line([(qx0 + 18, qy0 + 12), (qx0 + 26, qy1 - 14)], fill=dk, width=4)
        d.line([(qx1 - 24, qy0 + 14), (qx1 - 16, qy1 - 12)], fill=hi, width=3)
        for sy in range(qy0 + 24, qy1 - 18, 28):
            d.line([(qx0 + 10, sy), (qx1 - 10, sy)], fill=dk, width=2)
    # Wooden laundry clothespins clamping the top blanket corners!
    for px in [76, 192, 306, W - 68]:
        draw_beveled_rect(d, px - 6, 24, px + 6, 54, PINE_LT, radius=3, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_cf_bare_open_toy_chest(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 34, 18, W - 34, 82, SKY, radius=8, ink_w=5)
    draw_beveled_rect(d, 48, 28, W - 48, 70, PINE_LT, radius=5, ink_w=3)
    draw_beveled_rect(d, 30, 76, W - 30, H - 28, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 46, 90, W - 46, H - 42, (74, 52, 38), radius=6, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_cf_plush_teddy_bear_single(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_teddy(d, W / 2, H / 2, s=2.6, col=BROWN_BEAR)
    return finish_prop(im, w, h, seed)


def make_cf_wooden_train_track_loop(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy, tr = W / 2, H / 2, min(W, H) * 0.34
    d.ellipse([cx - tr, cy - tr, cx + tr, cy + tr], outline=PINE, width=22)
    d.ellipse([cx - tr - 11, cy - tr - 11, cx + tr + 11, cy + tr + 11], outline=INK, width=4)
    d.ellipse([cx - tr + 11, cy - tr + 11, cx + tr - 11, cy + tr - 11], outline=INK, width=4)
    draw_beveled_rect(d, int(cx - 28), int(cy - tr - 15), int(cx + 28), int(cy - tr + 15), RED_TOY, radius=6, ink_w=3)
    draw_beveled_rect(d, int(cx + 38), int(cy - tr + 12), int(cx + 88), int(cy - tr + 40), SUNNY, radius=6, ink_w=3)
    return finish_prop(im, w, h, seed)


def make_cf_crayon_drawing_sheet(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Cream drawing sheet with a charming child's crayon house, sun & grass doodle!
    sx0, sy0, sx1, sy1 = 26, 28, W - 76, H - 28
    draw_beveled_rect(d, sx0, sy0, sx1, sy1, PAPER, radius=6, ink_w=4)
    # Little crayon sun in top-left
    d.ellipse([sx0 + 16, sy0 + 16, sx0 + 48, sy0 + 48], fill=(*SUNNY, 255), outline=OCHRE, width=3)
    # Little crayon pitched-roof cottage in center
    hx0, hy0, hx1, hy1 = sx0 + 52, sy0 + 78, sx1 - 24, sy1 - 36
    d.rectangle([hx0, hy0, hx1, hy1], fill=(236, 214, 178, 255), outline=(120, 82, 56, 230), width=4)
    d.polygon([(hx0 - 10, hy0 + 4), ((hx0 + hx1) // 2, hy0 - 34), (hx1 + 10, hy0 + 4)], fill=(*CORAL, 255), outline=(146, 52, 46, 240))
    d.rectangle([hx0 + 26, hy1 - 32, hx0 + 48, hy1], fill=(*OAK, 255), outline=INK_MID, width=2)
    # Green crayon grass squiggle along bottom
    d.line([(sx0 + 14, sy1 - 22), (sx1 - 14, sy1 - 22)], fill=(86, 146, 82, 230), width=6)
    # 4 hand-inked paper-wrapped wax crayons with pointed tips & wrapper stripes
    for idx, (dy, cc) in enumerate([(-54, RED_TOY), (-18, OCHRE), (18, SAGE), (54, PRUSSIAN)]):
        cy = H // 2 + dy
        draw_beveled_rect(d, W - 66, cy - 9, W - 26, cy + 9, cc, radius=4, ink_w=3)
        d.rectangle([W - 56, cy - 7, W - 36, cy + 7], fill=blend_rgb(cc, (242, 234, 214), 0.35), outline=INK, width=2)
        d.polygon([(W - 26, cy - 7), (W - 14, cy), (W - 26, cy + 7)], fill=(*cc, 255), outline=INK)
    return finish_prop(im, w, h, seed)


def make_cf_abc_blocks_tin_drum(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Vintage marching tin drum with crimson rim, parchment head, tension-cord dots & crossed maple drumsticks
    dx, dy = W * 0.68, H * 0.52
    draw_disc(d, dx, dy, 48, RED_TOY, ink_w=5)
    draw_disc(d, dx, dy, 35, PAPER, ink_w=3)
    for k in range(8):
        a = k * math.pi / 4
        draw_disc(d, dx + math.cos(a) * 41, dy + math.sin(a) * 41, 4, BRASS_HI, ink_w=1)
    # Crossed turned maple drumsticks resting over the drumhead
    d.line([(dx - 38, dy - 18), (dx + 34, dy + 22)], fill=INK, width=10)
    d.line([(dx - 38, dy - 18), (dx + 34, dy + 22)], fill=PINE_LT, width=5)
    draw_disc(d, dx + 34, dy + 22, 6, PINE_LT, ink_w=2)
    d.line([(dx - 32, dy + 22), (dx + 36, dy - 14)], fill=INK, width=10)
    d.line([(dx - 32, dy + 22), (dx + 36, dy - 14)], fill=PINE_LT, width=5)
    draw_disc(d, dx + 36, dy - 14, 6, PINE_LT, ink_w=2)
    # Carved maple wooden alphabet blocks with inset colored frames & letter marks
    blocks = [(58, 66, (86, 134, 168), "A"), (116, 56, (206, 162, 68), "B"), (74, 136, (108, 152, 114), "C"), (126, 170, (186, 86, 72), "D")]
    for bx, by, col, _ in blocks:
        draw_beveled_rect(d, bx - 24, by - 24, bx + 24, by + 24, PINE_LT, radius=6, ink_w=4)
        draw_beveled_rect(d, bx - 16, by - 16, bx + 16, by + 16, col, radius=3, ink_w=2)
        d.line([(bx - 7, by + 7), (bx, by - 8), (bx + 7, by + 7)], fill=CREAM, width=3)
    return finish_prop(im, w, h, seed)


def make_cf_bare_wicker_laundry_basket(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, WICKER, radius=24, ink_w=6)
    draw_beveled_rect(d, 44, 44, W - 44, H - 44, (132, 98, 58), radius=16, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_cf_folded_baby_blankets_stack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    # Soft stacked woven flannel baby blankets with satin edge binding & cloth crease folds
    layers = [
        (30, (226, 214, 192)),
        (72, (188, 122, 128)),
        (114, (104, 142, 168)),
        (156, (118, 152, 124)),
    ]
    for idx, (y, col) in enumerate(layers):
        ox = (idx % 2) * 10
        x0, x1 = 30 + ox, W - 40 + ox
        draw_beveled_rect(d, x0, y, x1, y + 54, col, radius=14, ink_w=4, hi_amt=0.22, sh_amt=0.34)
        # Satin stitched trim along folded front edge + subtle cloth crease line
        d.rectangle([x0 + 8, y + 40, x1 - 8, y + 49], fill=blend_rgb(col, (246, 238, 224), 0.36), outline=INK_MID, width=2)
        d.line([(x0 + 18, y + 20), (x1 - 18, y + 24)], fill=blend_rgb(col, (32, 24, 22), 0.28), width=3)
    return finish_prop(im, w, h, seed)


def make_cf_bare_wicker_pram_empty(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    for wy in [104, H - 122]:
        draw_beveled_rect(d, 22, wy - 38, 44, wy + 38, IRON, radius=6, ink_w=4)
        draw_beveled_rect(d, W - 44, wy - 38, W - 22, wy + 38, IRON, radius=6, ink_w=4)
        d.line([(44, wy), (W - 44, wy)], fill=IRON_DK, width=7)
    bx0, by0, bx1, by1 = 48, 42, W - 48, H - 84
    draw_beveled_rect(d, bx0, by0, bx1, by1, WICKER, radius=56, ink_w=6)
    draw_beveled_rect(d, bx0 + 18, by0 + 18, bx1 - 18, by1 - 18, CREAM, radius=42, ink_w=4)
    d.line([(bx0 + 24, by1), (bx0 + 24, H - 36)], fill=IRON_DK, width=7)
    d.line([(bx1 - 24, by1), (bx1 - 24, H - 36)], fill=IRON_DK, width=7)
    draw_beveled_rect(d, bx0 + 14, H - 46, bx1 - 14, H - 24, PINE_LT, radius=10, ink_w=4)
    return finish_prop(im, w, h, seed)


def make_cf_red_pull_wagon_empty(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    wx0, wy0, wx1, wy1 = 38, 56, W - 38, H - 32
    for wy in [wy0 + 28, wy1 - 28]:
        draw_beveled_rect(d, wx0 - 16, wy - 22, wx0 + 6, wy + 22, IRON_DK, radius=4, ink_w=3)
        draw_beveled_rect(d, wx1 - 6, wy - 22, wx1 + 16, wy + 22, IRON_DK, radius=4, ink_w=3)
    d.line([(W // 2, wy0), (W // 2 - 14, 22)], fill=IRON_DK, width=6)
    draw_beveled_rect(d, W // 2 - 36, 16, W // 2 + 8, 30, RED_TOY, radius=5, ink_w=3)
    draw_beveled_rect(d, wx0, wy0, wx1, wy1, RED_TOY, radius=10, ink_w=6)
    draw_wood_planks_box(d, wx0 + 16, wy0 + 16, wx1 - 16, wy1 - 16, PINE, random.Random(seed), horizontal=True, n_planks=4)
    return finish_prop(im, w, h, seed)


def make_cf_wooden_kids_tricycle(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    tx, ty = W // 2, H // 2
    # Front rubber wheel with steel hub & front pedals
    draw_beveled_rect(d, tx - 16, ty - 110, tx + 16, ty - 38, IRON_DK, radius=10, ink_w=5)
    d.line([(tx - 34, ty - 74), (tx + 34, ty - 74)], fill=STEEL, width=7)
    draw_beveled_rect(d, tx - 46, ty - 82, tx - 26, ty - 66, IRON, radius=3, ink_w=2)
    draw_beveled_rect(d, tx + 26, ty - 82, tx + 46, ty - 66, IRON, radius=3, ink_w=2)
    # Curved steel handlebars with crimson grips & little brass bell
    draw_beveled_rect(d, tx - 72, ty - 66, tx + 72, ty - 46, STEEL, radius=10, ink_w=4)
    draw_beveled_rect(d, tx - 78, ty - 68, tx - 48, ty - 44, RED_TOY, radius=8, ink_w=3)
    draw_beveled_rect(d, tx + 48, ty - 68, tx + 78, ty - 44, RED_TOY, radius=8, ink_w=3)
    draw_disc(d, tx + 26, ty - 56, 9, BRASS_HI, ink_w=2)
    # Painted crimson tubular spine & rear wooden footboard deck
    draw_beveled_rect(d, tx - 10, ty - 50, tx + 10, ty + 72, RED_TOY, radius=6, ink_w=4)
    draw_beveled_rect(d, tx - 56, ty + 48, tx + 56, ty + 82, OAK, radius=8, ink_w=4)
    # Riveted sprung leather saddle seat
    draw_beveled_rect(d, tx - 30, ty - 12, tx + 30, ty + 38, LEATHER, radius=18, ink_w=5)
    for rx in [tx - 14, tx, tx + 14]:
        draw_disc(d, rx, ty + 24, 3.5, BRASS_HI, ink_w=1)
    # Twin rear iron-rimmed rubber wheels
    draw_beveled_rect(d, tx - 76, ty + 32, tx - 48, ty + 100, IRON_DK, radius=10, ink_w=5)
    draw_beveled_rect(d, tx + 48, ty + 32, tx + 76, ty + 100, IRON_DK, radius=10, ink_w=5)
    return finish_prop(im, w, h, seed)


ASSET_SPECS = [
    # --- aged_streetcar_line (2) ---
    ("aged_streetcar_line", "st_bare_tram_shelter_frame.png", "Bare Cast-Iron & Glass Tram Shelter Frame", 288, 144, "normal",
     ["streetcar", "tram", "shelter", "bare", "modular", "modular_split_v2", "harmony"], make_st_bare_tram_shelter_frame),
    ("aged_streetcar_line", "st_tram_shelter_bench.png", "Slatted Iron & Oak Streetcar Waiting Bench", 224, 96, "normal",
     ["streetcar", "tram", "bench", "street", "modular", "modular_split_v2", "harmony"], make_st_tram_shelter_bench),

    # --- post_housing (12) ---
    ("post_housing", "ph_bare_teller_counter.png", "Bare Walnut & Brass Civic Teller Counter", 320, 144, "normal",
     ["post_housing", "post_office", "counter", "bare", "modular", "modular_split_v2", "harmony"], make_ph_bare_teller_counter),
    ("post_housing", "ph_brass_teller_grille_arch.png", "Standalone Brass Bank & Post Teller Grille", 256, 80, "normal",
     ["post_housing", "post_office", "grille", "brass", "modular", "modular_split_v2", "harmony"], make_ph_brass_teller_grille_arch),
    ("post_housing", "ph_bare_sorting_table.png", "Bare Oak Mail Sorting & Packing Worktable", 288, 160, "normal",
     ["post_housing", "post_office", "table", "bare", "modular", "modular_split_v2", "harmony"], make_ph_bare_sorting_table),
    ("post_housing", "ph_stacked_parcels_letters_bin.png", "Wooden Mail Tray with Parcels & Wax Letters", 176, 128, "normal",
     ["post_housing", "post_office", "mail", "parcels", "modular", "modular_split_v2", "harmony"], make_ph_stacked_parcels_letters_bin),
    ("post_housing", "ph_bare_wooden_hand_truck.png", "Bare Rolling Timber Warehouse Hand-Truck", 208, 128, "normal",
     ["post_housing", "post_office", "cart", "bare", "modular", "modular_split_v2", "harmony"], make_ph_bare_wooden_hand_truck),
    ("post_housing", "ph_stuffed_canvas_mailbag.png", "Stuffed Tied Canvas Postal Mailbag Sack", 144, 112, "normal",
     ["post_housing", "post_office", "mailbag", "sack", "modular", "modular_split_v2", "harmony"], make_ph_stuffed_canvas_mailbag),
    ("post_housing", "ph_bare_sloped_writing_desk.png", "Bare Sloped Oak Standing Writing Lectern", 224, 128, "normal",
     ["post_housing", "post_office", "desk", "bare", "modular", "modular_split_v2", "harmony"], make_ph_bare_sloped_writing_desk),
    ("post_housing", "ph_bare_compact_counter.png", "Bare Compact Studio Kitchenette Counter", 256, 128, "normal",
     ["post_housing", "housing", "kitchenette", "counter", "bare", "modular", "modular_split_v2", "harmony"], make_ph_bare_compact_counter),
    ("post_housing", "ph_two_burner_hotplate.png", "Standalone Cast-Iron 2-Burner Tabletop Stove", 160, 112, "normal",
     ["post_housing", "housing", "stove", "kitchen", "modular", "modular_split_v2", "harmony"], make_ph_two_burner_hotplate),
    ("post_housing", "ph_bare_single_iron_bed.png", "Bare Single Iron Bedframe & Plain Sheets", 192, 272, "normal",
     ["post_housing", "housing", "bed", "single", "bare", "modular", "modular_split_v2", "harmony"], make_ph_bare_single_iron_bed),
    ("post_housing", "ph_bare_entryway_bench.png", "Bare Narrow Hallway Timber Boot Bench", 224, 112, "normal",
     ["post_housing", "housing", "bench", "bare", "modular", "modular_split_v2", "harmony"], make_ph_bare_entryway_bench),
    ("post_housing", "ph_paper_flyers_books_pile.png", "Community Share Books & Paper Flyers Pile", 160, 128, "normal",
     ["post_housing", "housing", "books", "flyers", "modular", "modular_split_v2", "harmony"], make_ph_paper_flyers_books_pile),

    # --- hostel_living (18) ---
    ("hostel_living", "hs_bare_wooden_bunk_frame.png", "Bare Double-Decker Timber Bunk Bed & Ladder", 208, 288, "normal",
     ["hostel_living", "hostel", "bunk", "bed", "bare", "modular", "modular_split_v2", "harmony"], make_hs_bare_wooden_bunk_frame),
    ("hostel_living", "hs_bunk_ladder_wood.png", "Standalone Wooden Bunk & Loft Climbing Ladder", 96, 224, "normal",
     ["hostel_living", "hostel", "ladder", "wood", "modular", "modular_split_v2", "harmony"], make_hs_bunk_ladder_wood),
    ("hostel_living", "hs_bare_locker_cabinet.png", "Bare 4-Bay Timber & Padlock Locker Cabinet", 256, 112, "normal",
     ["hostel_living", "hostel", "locker", "bare", "modular", "modular_split_v2", "harmony"], make_hs_bare_locker_cabinet),
    ("hostel_living", "hs_canvas_rucksack_single.png", "Strapped Traveler Canvas Rucksack (Colorable)", 128, 160, "dd_red",
     ["hostel_living", "hostel", "backpack", "colorable", "dd_red", "modular", "modular_split_v2", "harmony"], make_hs_canvas_rucksack_single),
    ("hostel_living", "hs_bare_reception_counter.png", "Bare Worn-Oak Hostel Reception Counter", 288, 128, "normal",
     ["hostel_living", "hostel", "reception", "counter", "bare", "modular", "modular_split_v2", "harmony"], make_hs_bare_reception_counter),
    ("hostel_living", "hs_wall_key_hook_rack.png", "Wall-Mounted Hostel Room-Key Hook Board", 240, 80, "normal",
     ["hostel_living", "hostel", "keys", "rack", "modular", "modular_split_v2", "harmony"], make_hs_wall_key_hook_rack),
    ("hostel_living", "hs_guestbook_bell_pamphlets.png", "Open Guestbook Ledger, Desk Bell & Pamphlets", 176, 112, "normal",
     ["hostel_living", "hostel", "guestbook", "bell", "modular", "modular_split_v2", "harmony"], make_hs_guestbook_bell_pamphlets),
    ("hostel_living", "hs_bare_bench_dining_table.png", "Bare Long Pine Communal Bench Dining Table", 320, 160, "normal",
     ["hostel_living", "hostel", "table", "dining", "bare", "modular", "modular_split_v2", "harmony"], make_hs_bare_bench_dining_table),
    ("hostel_living", "hs_traveler_map_compass.png", "Unfolded Parchment Traveler Map & Compass", 160, 128, "normal",
     ["hostel_living", "hostel", "map", "compass", "modular", "modular_split_v2", "harmony"], make_hs_traveler_map_compass),
    ("hostel_living", "hs_enamel_teapot_mugs_set.png", "Cobalt Enamel Teapot & Mismatched Mugs", 144, 128, "normal",
     ["hostel_living", "hostel", "teapot", "mugs", "modular", "modular_split_v2", "harmony"], make_hs_enamel_teapot_mugs_set),
    ("hostel_living", "hs_bare_galley_counter.png", "Bare Tiled-Backsplash Timber Galley Counter", 304, 128, "normal",
     ["hostel_living", "hostel", "kitchen", "counter", "bare", "modular", "modular_split_v2", "harmony"], make_hs_bare_galley_counter),
    ("hostel_living", "hs_dish_drying_rack_plates.png", "Wooden Dish Drying Rack with Clean Plates", 128, 128, "normal",
     ["hostel_living", "hostel", "kitchen", "dishes", "modular", "modular_split_v2", "harmony"], make_hs_dish_drying_rack_plates),
    ("hostel_living", "hs_bare_enamel_wash_trough.png", "Bare 3-Tap Enamel Communal Wash Trough", 272, 112, "normal",
     ["hostel_living", "hostel", "washroom", "sink", "bare", "modular", "modular_split_v2", "harmony"], make_hs_bare_enamel_wash_trough),
    ("hostel_living", "hs_rolled_towels_soap_set.png", "Rolled Striped Hand Towels & Bar Soaps", 144, 112, "normal",
     ["hostel_living", "hostel", "washroom", "towels", "modular", "modular_split_v2", "harmony"], make_hs_rolled_towels_soap_set),
    ("hostel_living", "hs_bare_cubby_bench.png", "Bare Entryway Wooden Cubby Bench", 240, 112, "normal",
     ["hostel_living", "hostel", "bench", "bare", "modular", "modular_split_v2", "harmony"], make_hs_bare_cubby_bench),
    ("hostel_living", "hs_wooden_walking_staff.png", "Traveler's Wooden Walking Staff & Bedroll", 176, 96, "normal",
     ["hostel_living", "hostel", "staff", "bedroll", "modular", "modular_split_v2", "harmony"], make_hs_wooden_walking_staff),
    ("hostel_living", "hs_bare_round_braided_rug.png", "Bare Circular Braided Hostel Floor Rug", 224, 224, "normal",
     ["hostel_living", "hostel", "rug", "bare", "modular", "modular_split_v2", "harmony"], make_hs_bare_round_braided_rug),
    ("hostel_living", "hs_wooden_tea_tray_cups.png", "Round Wooden Tea Tray, Cups & Travel Journal", 144, 144, "normal",
     ["hostel_living", "hostel", "tea", "tray", "modular", "modular_split_v2", "harmony"], make_hs_wooden_tea_tray_cups),

    # --- crowded_family (18) ---
    ("crowded_family", "cf_bare_wooden_baby_crib.png", "Bare Slatted Oak Baby Crib & Plain Mattress", 160, 208, "normal",
     ["crowded_family", "family", "kids", "crib", "bare", "modular", "modular_split_v2", "harmony"], make_cf_bare_wooden_baby_crib),
    ("crowded_family", "cf_hanging_crib_mobile.png", "Colorful Hanging Wooden Nursery Star Mobile", 128, 128, "normal",
     ["crowded_family", "family", "kids", "nursery", "mobile", "modular", "modular_split_v2", "harmony"], make_cf_hanging_crib_mobile),
    ("crowded_family", "cf_bare_wooden_double_bed.png", "Bare Walnut Double Bed & Crisp White Sheets", 256, 272, "normal",
     ["crowded_family", "family", "bed", "double", "bare", "modular", "modular_split_v2", "harmony"], make_cf_bare_wooden_double_bed),
    ("crowded_family", "cf_single_sleeping_mat_colorable.png", "Single Roll-Out Floor Sleeping Mat (Colorable)", 144, 208, "dd_red",
     ["crowded_family", "family", "kids", "mat", "bed", "colorable", "dd_red", "modular", "modular_split_v2", "harmony"], make_cf_single_sleeping_mat_colorable),
    ("crowded_family", "cf_wooden_baby_highchair.png", "Painted Wooden Baby High Chair (Colorable)", 112, 128, "dd_red",
     ["crowded_family", "family", "kids", "highchair", "chair", "colorable", "dd_red", "modular", "modular_split_v2", "harmony"], make_cf_wooden_baby_highchair),
    ("crowded_family", "cf_soup_tureen_bowls_set.png", "Family Copper Soup Tureen & Mismatched Bowls", 160, 144, "normal",
     ["crowded_family", "family", "food", "soup", "kitchen", "modular", "modular_split_v2", "harmony"], make_cf_soup_tureen_bowls_set),
    ("crowded_family", "cf_bare_parlor_sofa_colorable.png", "Bare Wooden-Framed Parlor Sofa (Colorable)", 256, 128, "dd_red",
     ["crowded_family", "family", "sofa", "couch", "colorable", "dd_red", "bare", "modular", "modular_split_v2", "harmony"], make_cf_bare_parlor_sofa_colorable),
    ("crowded_family", "cf_draped_blanket_fort_canopy.png", "Draped Patchwork Blanket Fort Tent Canopy", 240, 160, "normal",
     ["crowded_family", "family", "kids", "fort", "blanket", "modular", "modular_split_v2", "harmony"], make_cf_draped_blanket_fort_canopy),
    ("crowded_family", "cf_bare_open_toy_chest.png", "Bare Empty Open Painted Wooden Toy Chest", 208, 128, "normal",
     ["crowded_family", "family", "kids", "chest", "bare", "modular", "modular_split_v2", "harmony"], make_cf_bare_open_toy_chest),
    ("crowded_family", "cf_plush_teddy_bear_single.png", "Standalone Cozy Plush Teddy Bear Toy", 112, 112, "normal",
     ["crowded_family", "family", "kids", "toys", "bear", "modular", "modular_split_v2", "harmony"], make_cf_plush_teddy_bear_single),
    ("crowded_family", "cf_wooden_train_track_loop.png", "Standalone Circular Wooden Toy Train Track", 176, 176, "normal",
     ["crowded_family", "family", "kids", "toys", "train", "modular", "modular_split_v2", "harmony"], make_cf_wooden_train_track_loop),
    ("crowded_family", "cf_crayon_drawing_sheet.png", "Kids' Crayon Doodle Drawing & Loose Crayons", 144, 128, "normal",
     ["crowded_family", "family", "kids", "toys", "crayons", "modular", "modular_split_v2", "harmony"], make_cf_crayon_drawing_sheet),
    ("crowded_family", "cf_abc_blocks_tin_drum.png", "Painted ABC Wooden Blocks & Toy Tin Drum", 160, 144, "normal",
     ["crowded_family", "family", "kids", "toys", "blocks", "modular", "modular_split_v2", "harmony"], make_cf_abc_blocks_tin_drum),
    ("crowded_family", "cf_bare_wicker_laundry_basket.png", "Bare Empty Woven Wicker Laundry Hamper", 144, 144, "normal",
     ["crowded_family", "family", "laundry", "basket", "bare", "modular", "modular_split_v2", "harmony"], make_cf_bare_wicker_laundry_basket),
    ("crowded_family", "cf_folded_baby_blankets_stack.png", "Folded Pastel Baby Blankets & Clothes Stack", 144, 128, "normal",
     ["crowded_family", "family", "kids", "laundry", "blankets", "modular", "modular_split_v2", "harmony"], make_cf_folded_baby_blankets_stack),
    ("crowded_family", "cf_bare_wicker_pram_empty.png", "Empty Vintage Woven Wicker Baby Pram", 160, 224, "normal",
     ["crowded_family", "family", "kids", "pram", "bare", "modular", "modular_split_v2", "harmony"], make_cf_bare_wicker_pram_empty),
    ("crowded_family", "cf_red_pull_wagon_empty.png", "Empty Red Painted Wooden Kids' Pull-Wagon", 144, 160, "normal",
     ["crowded_family", "family", "kids", "wagon", "bare", "modular", "modular_split_v2", "harmony"], make_cf_red_pull_wagon_empty),
    ("crowded_family", "cf_wooden_kids_tricycle.png", "Standalone 3-Wheeled Wooden Kids' Tricycle", 128, 160, "normal",
     ["crowded_family", "family", "kids", "tricycle", "toys", "modular", "modular_split_v2", "harmony"], make_cf_wooden_kids_tricycle),
]


def main() -> None:
    manifest_entries = []
    qa_items: list[tuple[str, Image.Image]] = []
    for idx, (pack, fname, title, w, h, draw_mode, tags, fn) in enumerate(ASSET_SPECS, start=1):
        out_dir = MOD_DIR / "props" / pack
        out_dir.mkdir(parents=True, exist_ok=True)
        img = fn(w, h, 10800 + idx * 31)
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
    qa_path = SCRATCH_DIR / "qa_modular_splits_v2_b.png"
    save_qa_sheet(qa_items, qa_path, cols=7, cw=210, ch=160)
    print(f"\nGenerated {len(ASSET_SPECS)} Wave 2 Batch B modular splits (manifest total={total}) -> {qa_path}")


if __name__ == "__main__":
    main()

"""
Dice Chaos Compass — 8-Asset Antiquariat & Buchhandlung Silberblatt (Curved Bookshop) Suite

Generates 8 museum-grade 2x-supersampled Studio Harmony CC0 assets (`props/bookshop_antiquariat/`)
for the 2-story curved bow-window Antiquarian Bookshop & Bookbindery across the Grand Crossroads
from Steam & Scoop Express:
  1. `bk_mahogany_bookcase_packed.png`          (256x96)  — Packed mahogany bookcase w/ brass ladder rail
  2. `bk_curved_folio_globe_table.png`          (208x144) — Bow-window display table w/ brass globe & open atlas
  3. `bk_bookseller_checkout_desk.png`          (224x128) — Bookseller wrapping desk w/ banker's lamp & register
  4. `bk_sidewalk_book_bin_stall.png`           (176x96)  — Outdoor sidewalk penny-book browsing trough
  5. `bk_bookshop_burgundy_awning.png`          (240x96)  — Burgundy & cream scalloped Berlin bookshop awning
  6. `bk_bookbinder_press_bench.png`            (224x128) — Oak bookbinding bench w/ cast-iron screw press
  7. `bk_print_portfolio_easel_rack.png`        (176x112) — Wooden lithograph & city-map print browsing cradle
  8. `bk_tufted_reading_armchair_colorable.png` (144x144, dd_red) — Tufted wingback reading chair & footstool

Strict Studio Harmony standard: #1E1816 charcoal ink, warm directional bevel highlights,
rich wood plank grain, authentic micro-details, zero flat geometric fills, zero white halos.
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

OUT_DIR = MOD_DIR / "props" / "bookshop_antiquariat"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Warm Antiquarian Bookshop & Bindery Palette
MAHOGANY = (112, 48, 38)
MAHOGANY_DK = (72, 30, 26)
WALNUT = (92, 60, 40)
OAK = (152, 110, 68)
PINE = (188, 150, 102)
BRASS = (206, 162, 74)
BRASS_HI = (240, 208, 118)
IRON = (60, 66, 74)
IRON_DK = (34, 38, 46)
STEEL = (144, 152, 162)
BURGUNDY = (128, 36, 46)
BURGUNDY_HI = (164, 54, 62)
CRIMSON = (170, 48, 52)
EMERALD = (42, 110, 74)
EMERALD_HI = (68, 154, 102)
PRUSSIAN = (44, 76, 112)
OCHRE = (202, 148, 58)
TEAL = (56, 120, 122)
PLUM = (104, 58, 98)
LEATHER = (132, 78, 46)
CREAM = (242, 234, 214)
PAPER = (232, 220, 192)
KRAFT = (186, 148, 98)
GLOBE_SEA = (106, 158, 166)
GLOBE_LAND = (176, 156, 106)


def draw_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rgb: tuple[int, int, int],
    ink_w: int = 4,
) -> None:
    dk = blend_rgb(rgb, (18, 14, 14), 0.40)
    hi = blend_rgb(rgb, (254, 248, 234), 0.36)
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


def finish_prop(
    im: Image.Image,
    w: int,
    h: int,
    seed: int,
    grain: float = 5.0,
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
# 1. PACKED MAHOGANY BOOKCASE WITH BRASS ROLLING-LADDER RAIL (256x96)
# =============================================================================
def gen_bk_mahogany_bookcase_packed() -> Image.Image:
    w, h = 256, 96
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(7401)

    # Heavy molded mahogany cornice top frame
    draw_beveled_rect(d, 18, 18, W - 18, H - 30, MAHOGANY, radius=8, ink_w=6)
    draw_beveled_rect(d, 30, 30, W - 30, H - 42, MAHOGANY_DK, radius=4, ink_w=4)

    # Densely packed row of multi-colored leather-bound book tops with gilt bands & tilted volumes!
    book_cols = [BURGUNDY, PRUSSIAN, EMERALD, OCHRE, LEATHER, PLUM, TEAL, CRIMSON, WALNUT]
    x = 36
    while x < W - 46:
        bw = rng.randint(18, 30)
        if x + bw > W - 36:
            bw = W - 36 - x
        if bw < 14:
            break
        col = vary_rgb(rng.choice(book_cols), rng, 10)
        y0 = 36 + rng.randint(0, 10)
        y1 = H - 46 - rng.randint(0, 8)
        draw_beveled_rect(d, x, y0, x + bw, y1, col, radius=3, ink_w=3)
        # Cream page block edge & gilt title rib
        d.line([(x + 4, y0 + 5), (x + bw - 4, y0 + 5)], fill=CREAM, width=3)
        d.line([(x + 4, y1 - 8), (x + bw - 4, y1 - 8)], fill=BRASS_HI, width=2)
        x += bw + 2

    # Gleaming brass rolling-ladder rail mounted along bottom front lip!
    draw_beveled_rect(d, 26, H - 28, W - 26, H - 14, BRASS, radius=5, ink_w=4)
    for bx in [62, W // 2, W - 62]:
        draw_disc(d, bx, H - 21, 7, BRASS_HI, ink_w=2)
    return finish_prop(im, w, h, seed=7401)


# =============================================================================
# 2. BOW-WINDOW FOLIO & ANTIQUE BRASS GLOBE DISPLAY TABLE (208x144)
# =============================================================================
def gen_bk_curved_folio_globe_table() -> Image.Image:
    w, h = 208, 144
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(7402)

    # Polished walnut bow-window display table with burgundy velvet runner
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=18, ink_w=6)
    draw_wood_planks_box(d, 34, 36, W - 34, H - 36, OAK, rng, horizontal=True, n_planks=4)
    draw_beveled_rect(d, 48, 56, W - 48, H - 56, BURGUNDY, radius=8, ink_w=4)
    d.rectangle([58, 66, W - 58, H - 66], outline=BRASS, width=3)

    # Antique brass-meridian terrestrial globe on left side!
    gx, gy = 114, H // 2
    draw_disc(d, gx, gy, 44, BRASS, ink_w=5)
    draw_disc(d, gx, gy, 35, GLOBE_SEA, ink_w=3)
    d.polygon([(gx - 22, gy - 12), (gx - 4, gy - 22), (gx + 10, gy - 6), (gx - 8, gy + 14)], fill=(*GLOBE_LAND, 255))
    d.polygon([(gx + 12, gy + 4), (gx + 26, gy + 12), (gx + 16, gy + 24), (gx + 4, gy + 18)], fill=(*GLOBE_LAND, 255))
    d.line([(gx - 38, gy - 14), (gx + 38, gy + 14)], fill=BRASS_HI, width=5)

    # Open illustrated botanical/city atlas folio in center
    draw_beveled_rect(d, 174, 62, 314, H - 62, LEATHER, radius=6, ink_w=4)
    draw_beveled_rect(d, 184, 72, 242, H - 72, PAPER, radius=3, ink_w=2)
    draw_beveled_rect(d, 246, 72, 304, H - 72, CREAM, radius=3, ink_w=2)
    d.rectangle([194, 86, 232, 134], fill=(*EMERALD, 255), outline=INK_MID, width=2)
    for ly in range(88, H - 82, 14):
        d.line([(254, ly), (296, ly)], fill=(104, 92, 76, 210), width=3)
    d.line([(244, 72), (244, H - 50)], fill=CRIMSON, width=4)  # ribbon bookmark

    # Stacked gilded rare volumes on right end
    draw_beveled_rect(d, 326, 74, W - 44, 142, PRUSSIAN, radius=5, ink_w=4)
    draw_beveled_rect(d, 332, 134, W - 40, H - 72, EMERALD, radius=5, ink_w=4)
    d.rectangle([340, 144, W - 48, H - 82], outline=BRASS_HI, width=2)
    return finish_prop(im, w, h, seed=7402)


# =============================================================================
# 3. ANTIQUARIAN BOOKSELLER'S WRAPPING & CHECKOUT DESK (224x128)
# =============================================================================
def gen_bk_bookseller_checkout_desk() -> Image.Image:
    w, h = 224, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(7403)

    draw_beveled_rect(d, 20, 22, W - 20, H - 22, MAHOGANY, radius=12, ink_w=6)
    draw_wood_planks_box(d, 34, 34, W - 34, H - 34, WALNUT, rng, horizontal=True, n_planks=4)

    # Ornate antique brass cash register on left
    draw_beveled_rect(d, 48, 48, 146, H - 56, BRASS, radius=10, ink_w=5)
    draw_beveled_rect(d, 62, 60, 132, 92, IRON_DK, radius=4, ink_w=3)
    for kx in range(62, 132, 18):
        for ky in [104, 126, 148]:
            draw_disc(d, kx + 6, ky, 5, CREAM, ink_w=1)

    # Kraft wrapping paper parcel & butcher-twine spool in center!
    draw_beveled_rect(d, 166, 56, 290, H - 58, KRAFT, radius=6, ink_w=4)
    d.line([(168, H // 2), (288, H // 2)], fill=WALNUT, width=4)
    d.line([(228, 58), (228, H - 60)], fill=WALNUT, width=4)
    draw_disc(d, 228, H // 2, 7, CREAM, ink_w=2)

    # Glowing emerald-glass brass banker's desk lamp + open ledger on right!
    draw_beveled_rect(d, 306, 54, W - 46, H - 66, PAPER, radius=4, ink_w=3)
    for ly in range(70, H - 76, 14):
        d.line([(316, ly), (W - 56, ly)], fill=(108, 92, 78, 200), width=2)
    draw_disc(d, W - 72, 76, 20, BRASS, ink_w=4)
    draw_beveled_rect(d, W - 112, 58, W - 52, 94, EMERALD_HI, radius=10, ink_w=4)
    return finish_prop(im, w, h, seed=7403)


# =============================================================================
# 4. OUTDOOR SIDEWALK PENNY-BOOK BROWSING TROUGH (176x96)
# =============================================================================
def gen_bk_sidewalk_book_bin_stall() -> Image.Image:
    w, h = 176, 96
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(7404)

    # Slatted oak outdoor bookstore bin with center wood divider
    draw_beveled_rect(d, 18, 22, W - 18, H - 22, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 30, 34, W - 30, H - 34, (56, 40, 30), radius=6, ink_w=4)

    # 3 compartments brimming with colorful angled paperbacks, novellas & rolled vintage prints!
    cols = [CRIMSON, PRUSSIAN, OCHRE, EMERALD, TEAL, PAPER, BURGUNDY, PLUM]
    for bay_x0, bay_x1 in [(36, 130), (140, 232), (242, W - 36)]:
        bx = bay_x0 + 4
        while bx < bay_x1 - 14:
            bw = rng.randint(15, 22)
            if bx + bw > bay_x1 - 2:
                bw = bay_x1 - 2 - bx
            if bw < 12:
                break
            col = vary_rgb(rng.choice(cols), rng, 10)
            draw_beveled_rect(d, bx, 40 + rng.randint(0, 8), bx + bw, H - 40 - rng.randint(0, 8), col, radius=3, ink_w=3)
            d.line([(bx + 3, 48), (bx + bw - 3, 48)], fill=CREAM, width=2)
            bx += bw + 2
    for div_x in [135, 237]:
        draw_beveled_rect(d, div_x - 5, 26, div_x + 5, H - 26, OAK, radius=2, ink_w=3)
    # Little chalk price placard clipped to front edge!
    draw_beveled_rect(d, W // 2 - 30, H - 34, W // 2 + 30, H - 14, IRON_DK, radius=4, ink_w=3)
    d.line([(W // 2 - 18, H - 24), (W // 2 + 18, H - 24)], fill=CREAM, width=3)
    return finish_prop(im, w, h, seed=7404)


# =============================================================================
# 5. BURGUNDY & CREAM SCALLOPED BERLIN BOOKSHOP AWNING (240x96)
# =============================================================================
def gen_bk_bookshop_burgundy_awning() -> Image.Image:
    w, h = 240, 96
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    draw_beveled_rect(d, 20, 20, W - 20, 40, IRON_DK, radius=5, ink_w=4)
    n = 11
    x0, x1 = 24, W - 24
    sw = (x1 - x0) / n
    for i in range(n):
        sx0 = int(x0 + i * sw)
        sx1 = int(x0 + (i + 1) * sw)
        col = BURGUNDY if i % 2 == 0 else CREAM
        dk = blend_rgb(col, (20, 14, 14), 0.30)
        d.rectangle([sx0, 38, sx1, H - 38], fill=(*col, 255), outline=INK, width=3)
        d.pieslice([sx0, H - 56, sx1, H - 20], 0, 180, fill=dk, outline=INK, width=3)
    draw_beveled_rect(d, 24, H - 48, W - 24, H - 36, BRASS, radius=4, ink_w=3)
    draw_disc(d, W / 2, H * 0.52, 16, BRASS, ink_w=4)
    draw_disc(d, W / 2, H * 0.52, 8, BURGUNDY_HI, ink_w=2)
    return finish_prop(im, w, h, seed=7405)


# =============================================================================
# 6. CRAFTSMAN'S OAK BOOKBINDER'S PRESS & GILDING BENCH (224x128)
# =============================================================================
def gen_bk_bookbinder_press_bench() -> Image.Image:
    w, h = 224, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    rng = random.Random(7406)

    draw_beveled_rect(d, 20, 22, W - 20, H - 22, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, 34, 34, W - 34, H - 34, PINE, rng, horizontal=True, n_planks=4)

    # Heavy black cast-iron Victorian bookbinder's nipping screw press on left!
    draw_beveled_rect(d, 48, 46, 178, H - 46, IRON_DK, radius=10, ink_w=5)
    draw_beveled_rect(d, 64, 60, 162, H - 60, BURGUNDY, radius=4, ink_w=3)  # folio clamped in press!
    draw_beveled_rect(d, 56, H // 2 - 14, 170, H // 2 + 14, IRON, radius=5, ink_w=4)
    draw_disc(d, 113, H // 2, 24, IRON_DK, ink_w=4)
    d.line([(66, H // 2), (160, H // 2)], fill=STEEL, width=7)
    draw_disc(d, 66, H // 2, 9, BRASS_HI, ink_w=2)
    draw_disc(d, 160, H // 2, 9, BRASS_HI, ink_w=2)

    # Sewn parchment signatures, leather spine hide & brass gilding pot on right!
    draw_beveled_rect(d, 202, 52, 314, H - 64, PAPER, radius=4, ink_w=3)
    for sy in range(68, H - 72, 16):
        d.line([(212, sy), (304, sy)], fill=(120, 106, 86, 200), width=2)
    draw_beveled_rect(d, 330, 50, W - 46, 136, LEATHER, radius=10, ink_w=4)
    draw_disc(d, W - 82, H - 74, 22, BRASS, ink_w=4)
    draw_disc(d, W - 82, H - 74, 12, OCHRE, ink_w=2)
    return finish_prop(im, w, h, seed=7406)


# =============================================================================
# 7. WOODEN LITHOGRAPH & ANTIQUE-MAP PRINT BROWSING CRADLE (176x112)
# =============================================================================
def gen_bk_print_portfolio_easel_rack() -> Image.Image:
    w, h = 176, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Slatted mahogany print-seller's browsing cradle
    draw_beveled_rect(d, 20, 22, W - 20, H - 22, MAHOGANY, radius=10, ink_w=6)
    draw_beveled_rect(d, 34, 34, W - 34, H - 34, WALNUT, radius=6, ink_w=4)
    # 4 tiered matted lithograph engravings & antique Berlin city-map prints!
    for idx, (py, col) in enumerate([(42, PRUSSIAN), (76, EMERALD), (110, OCHRE), (144, BURGUNDY)]):
        if py + 30 < H - 26:
            draw_beveled_rect(d, 46, py, W - 46, py + 30, CREAM, radius=4, ink_w=3)
            draw_beveled_rect(d, 64, py + 5, W - 64, py + 25, PAPER, radius=2, ink_w=2)
            d.rectangle([76, py + 8, 126, py + 22], fill=(*col, 255), outline=INK_MID, width=2)
            d.line([(138, py + 15), (W - 76, py + 15)], fill=INK_MID, width=3)
    return finish_prop(im, w, h, seed=7407)


# =============================================================================
# 8. TUFTED WINGBACK READING ARMCHAIR & FOOTSTOOL (144x144, dd_red COLORABLE!)
# =============================================================================
def gen_bk_tufted_reading_armchair_colorable() -> Image.Image:
    """Colorable dd_red deep buttoned leather/velvet wingback reading armchair + footstool."""
    w, h = 144, 144
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Matching upholstered mahogany-rimmed ottoman footstool tucked in front (bottom)
    draw_beveled_rect(d, 74, H - 84, W - 74, H - 22, MAHOGANY, radius=14, ink_w=5)
    draw_beveled_rect(d, 86, H - 72, W - 86, H - 34, DD_RED_BASE, radius=10, ink_w=3)
    draw_disc(d, W / 2, H - 53, 6, DD_RED_DEEP, ink_w=1)

    # Carved mahogany frame + plush tufted wingback reading armchair (upper 2/3)
    draw_beveled_rect(d, 38, 22, W - 38, H - 96, MAHOGANY, radius=22, ink_w=6)
    # Thick tufted backrest bolster
    draw_beveled_rect(d, 54, 34, W - 54, 90, DD_RED_DEEP, radius=16, ink_w=4)
    # Plush rolled wing armrests on left & right
    draw_beveled_rect(d, 36, 48, 84, H - 98, DD_RED_DEEP, radius=16, ink_w=4)
    draw_beveled_rect(d, W - 84, 48, W - 36, H - 98, DD_RED_DEEP, radius=16, ink_w=4)
    # Deep seat cushion with diamond tuft buttons
    draw_beveled_rect(d, 80, 84, W - 80, H - 102, DD_RED_BASE, radius=14, ink_w=4)
    for bx in [W * 0.38, W * 0.62]:
        draw_disc(d, bx, 62, 6, DD_RED_HI, ink_w=2)
        draw_disc(d, bx, 126, 6, DD_RED_DEEP, ink_w=2)
    return finish_prop(im, w, h, seed=7408)


def main() -> None:
    specs = [
        ("bk_mahogany_bookcase_packed.png", "Packed Mahogany Bookcase & Brass Ladder Rail", "normal",
         ["bookshop_antiquariat", "bookshop", "books", "library", "bookcase", "shelf", "harmony"], gen_bk_mahogany_bookcase_packed),
        ("bk_curved_folio_globe_table.png", "Bow-Window Brass Globe & Open Atlas Display Table", "normal",
         ["bookshop_antiquariat", "bookshop", "globe", "atlas", "table", "library", "harmony"], gen_bk_curved_folio_globe_table),
        ("bk_bookseller_checkout_desk.png", "Antiquarian Bookseller Desk w/ Banker's Lamp & Register", "normal",
         ["bookshop_antiquariat", "bookshop", "desk", "shop", "counter", "brass", "harmony"], gen_bk_bookseller_checkout_desk),
        ("bk_sidewalk_book_bin_stall.png", "Outdoor Sidewalk Penny-Book Browsing Trough", "normal",
         ["bookshop_antiquariat", "bookshop", "books", "street", "sidewalk", "stall", "harmony"], gen_bk_sidewalk_book_bin_stall),
        ("bk_bookshop_burgundy_awning.png", "Burgundy & Cream Scalloped Bookshop Awning", "normal",
         ["bookshop_antiquariat", "bookshop", "awning", "facade", "street", "harmony"], gen_bk_bookshop_burgundy_awning),
        ("bk_bookbinder_press_bench.png", "Craftsman Oak Bookbinder's Screw Press Bench", "normal",
         ["bookshop_antiquariat", "bookshop", "bindery", "press", "workbench", "craft", "harmony"], gen_bk_bookbinder_press_bench),
        ("bk_print_portfolio_easel_rack.png", "Wooden Lithograph & Antique-Map Print Cradle", "normal",
         ["bookshop_antiquariat", "bookshop", "prints", "maps", "art", "library", "harmony"], gen_bk_print_portfolio_easel_rack),
        ("bk_tufted_reading_armchair_colorable.png", "Tufted Wingback Reading Armchair & Footstool (Colorable)", "dd_red",
         ["bookshop_antiquariat", "bookshop", "chair", "armchair", "reading", "colorable", "dd_red", "harmony"], gen_bk_tufted_reading_armchair_colorable),
    ]

    qa_items: list[tuple[str, Image.Image]] = []
    manifest_entries: list[dict] = []

    for idx, (fname, display_name, draw_mode, tags, fn) in enumerate(specs, 1):
        im = fn()
        rel_path = f"props/bookshop_antiquariat/{fname}"
        out_path = OUT_DIR / fname
        im.save(out_path, "PNG")
        qa_items.append((fname.replace(".png", ""), im))
        w_px, h_px = im.size
        manifest_entries.append({
            "path": rel_path,
            "displayName": display_name,
            "category": "object",
            "widthPx": w_px,
            "heightPx": h_px,
            "defaultPpi": 140,
            "drawMode": draw_mode,
            "dominantHex": dominant_hex(im),
            "castsShadow": "awning" not in fname,
            "tags": tags,
        })
        print(f"  [{idx:02d}/{len(specs)}] {rel_path} ({w_px}x{h_px}, {draw_mode})")

    total = upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    qa_path = SCRATCH_DIR / "qa_bookshop_suite.png"
    save_qa_sheet(qa_items, qa_path, cols=4)
    print(f"\nGenerated {len(specs)} Antiquarian Bookshop Harmony assets (manifest total={total}) -> {qa_path}")


if __name__ == "__main__":
    main()

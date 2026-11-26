"""
Dice Chaos Compass — 12-Asset Painterly Civic Post Office & Single-Occupant Public Housing Suite

Generates 12 bespoke clean-room CC0 Harmony assets in:
  `public/assets/modular-suite-cc0/props/post_housing/`

Designed to complement our existing `post_office`, `messy_apartment`, `bedroom_home`,
`kitchen`, `harmony_arch`, `harmony_lighting`, and `weathering_overlays` libraries:
  - Civic Post Office & P.O. Box Lobby (7):
      ph_po_box_brass_wall_bank, ph_po_box_wall_bank_corner,
      ph_postal_teller_counter_grille, ph_mail_sorting_table_bins,
      ph_mail_sack_canvas_cart, ph_postal_writing_kiosk_stand,
      ph_postal_awning_prussian_gold
  - Lived-In Single-Resident Public Housing (5):
      ph_tenant_mailbox_key_rack, ph_single_studio_kitchenette,
      ph_single_bed_quilted_colorable (dd_red colorable!),
      ph_hallway_shoe_coat_bench, ph_community_bulletin_board_table

All 2x-supersampled in unified Harmony style (#1E1816 charcoal ink, painterly fBm grain,
opaque interiors, zero white halos). Upserts into `public/assets/modular-suite-cc0/manifest.json`.
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

OUT_DIR = MOD_DIR / "props" / "post_housing"
OUT_DIR.mkdir(parents=True, exist_ok=True)

WALNUT = (94, 62, 42)
MAHOGANY = (116, 54, 42)
OAK = (154, 114, 72)
PINE = (188, 150, 102)
BRASS = (206, 164, 74)
BRASS_HI = (240, 206, 114)
COPPER = (186, 108, 66)
IRON = (60, 66, 74)
IRON_DK = (36, 40, 48)
PRUSSIAN = (42, 74, 112)
PRUSSIAN_DK = (28, 48, 76)
GOLD = (224, 178, 68)
BAIZE = (46, 110, 74)
CREAM = (242, 234, 214)
PAPER = (238, 228, 204)
KRAFT = (184, 146, 98)
CANVAS = (204, 192, 166)
ENAMEL = (232, 234, 232)
CRIMSON = (176, 44, 52)
TEAL = (48, 116, 122)
OCHRE = (196, 142, 62)
LEATHER = (134, 82, 48)
LEATHER_DK = (76, 46, 30)
SAGE = (102, 134, 96)


def finish_prop(
    im: Image.Image,
    w: int,
    h: int,
    seed: int,
    grain: float = 5.0,
    warm_bevel: bool = True,
    shadow_offset: tuple[int, int] = (7, 9),
    shadow_blur: float = 8.0,
    shadow_alpha: int = 96,
) -> Image.Image:
    """Adds a crisp silhouette contact shadow underneath + painterly downscale finish."""
    alpha_ch = im.split()[3]
    sh_alpha = alpha_ch.point(lambda a: int(a * (shadow_alpha / 255.0)))
    sh = Image.new("RGBA", im.size, (16, 12, 12, 0))
    sh.putalpha(sh_alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(shadow_blur))
    canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
    canvas.alpha_composite(sh, shadow_offset)
    canvas.alpha_composite(im)
    return apply_painterly_finish(canvas, w, h, seed=seed, grain=grain, warm_bevel=warm_bevel)


def draw_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rgb: tuple[int, int, int],
    ink_w: int = 4,
) -> None:
    dk = blend_rgb(rgb, (18, 14, 14), 0.38)
    hi = blend_rgb(rgb, (255, 250, 236), 0.38)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dk, outline=INK, width=ink_w)
    d.ellipse([cx - r * 0.84, cy - r * 0.84, cx + r * 0.84, cy + r * 0.84], fill=(*rgb, 255))
    if r >= 9:
        d.arc(
            [cx - r * 0.66, cy - r * 0.66, cx + r * 0.66, cy + r * 0.66],
            195, 310, fill=hi, width=max(2, int(r * 0.14)),
        )


def make_po_box_brass_wall_bank(w: int, h: int, seed: int) -> Image.Image:
    """Hero top-down brass P.O. Box wall locker bank with numbered doors & peeking letters."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 16
    draw_beveled_rect(d, pad, pad + 6, W - pad, H - pad - 8, WALNUT, ink_w=6, radius=10)
    draw_wood_planks_box(d, pad + 10, pad + 14, W - pad - 10, pad + 62, OAK, rng, horizontal=True, n_planks=2)
    box_x0, box_x1 = pad + 16, W - pad - 16
    box_y0, box_y1 = pad + 66, H - pad - 20
    draw_beveled_rect(d, box_x0, box_y0, box_x1, box_y1, IRON_DK, ink_w=5, radius=6)
    cols, rows = 10, 2
    cw = (box_x1 - box_x0 - 12) / cols
    rh = (box_y1 - box_y0 - 10) / rows
    for r in range(rows):
        for c in range(cols):
            x0 = int(box_x0 + 6 + c * cw + 2)
            y0 = int(box_y0 + 5 + r * rh + 2)
            x1 = int(box_x0 + 6 + (c + 1) * cw - 2)
            y1 = int(box_y0 + 5 + (r + 1) * rh - 2)
            draw_beveled_rect(d, x0, y0, x1, y1, vary_rgb(BRASS, rng, 14), ink_w=3, radius=4)
            mx, my = (x0 + x1) // 2, (y0 + y1) // 2
            d.rectangle([x0 + 6, y0 + 5, x1 - 6, y0 + 13], fill=(*CREAM, 255), outline=INK_MID, width=1)
            d.ellipse([mx - 4, my + 2, mx + 4, my + 10], fill=(*IRON_DK, 255), outline=(*BRASS_HI, 255), width=1)
            if r == 1 and c in (2, 7):
                d.polygon(
                    [(x0 + 8, y1 - 4), (x1 - 8, y1 - 4), (x1 - 5, y1 + 14), (x0 + 11, y1 + 14)],
                    fill=(*PAPER, 255), outline=INK, width=2,
                )
                d.ellipse([mx - 3, y1 + 4, mx + 3, y1 + 10], fill=(*CRIMSON, 255))
    d.rectangle([W // 2 - 84, pad + 20, W // 2 + 84, pad + 52], fill=(*PRUSSIAN, 255), outline=(*BRASS_HI, 255), width=4)
    for tx in range(W // 2 - 64, W // 2 + 65, 16):
        d.rectangle([tx, pad + 32, tx + 9, pad + 40], fill=(*BRASS_HI, 255))
    return finish_prop(img, w, h, seed)


def make_po_box_wall_bank_corner(w: int, h: int, seed: int) -> Image.Image:
    """Companion P.O. Box unit with brass mail drop slot, parcel cubby & writing shelf."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 16
    draw_beveled_rect(d, pad, pad + 6, W - pad, H - pad - 20, WALNUT, ink_w=6, radius=10)
    draw_wood_planks_box(d, pad + 10, pad + 14, W - pad - 10, pad + 54, OAK, rng, horizontal=True, n_planks=2)
    lx0, lx1 = pad + 16, W // 2 + 12
    ly0, ly1 = pad + 58, H - pad - 30
    draw_beveled_rect(d, lx0, ly0, lx1, ly1, IRON_DK, ink_w=4, radius=6)
    cw = (lx1 - lx0 - 10) / 4
    rh = (ly1 - ly0 - 8) / 2
    for r in range(2):
        for c in range(4):
            x0 = int(lx0 + 5 + c * cw + 2)
            y0 = int(ly0 + 4 + r * rh + 2)
            x1 = int(lx0 + 5 + (c + 1) * cw - 2)
            y1 = int(ly0 + 4 + (r + 1) * rh - 2)
            draw_beveled_rect(d, x0, y0, x1, y1, vary_rgb(BRASS, rng, 12), ink_w=3, radius=4)
            mx, my = (x0 + x1) // 2, (y0 + y1) // 2
            d.ellipse([mx - 3, my + 2, mx + 3, my + 8], fill=(*IRON_DK, 255))
    rx0, rx1 = W // 2 + 24, W - pad - 16
    draw_beveled_rect(d, rx0, ly0, rx1, ly1, PRUSSIAN, ink_w=5, radius=8)
    d.rectangle([rx0 + 18, ly0 + 14, rx1 - 18, ly0 + 34], fill=(*BRASS, 255), outline=INK, width=3)
    d.rectangle([rx0 + 26, ly0 + 20, rx1 - 26, ly0 + 28], fill=(*IRON_DK, 255))
    draw_beveled_rect(d, rx0 + 18, ly0 + 42, rx1 - 18, ly1 - 10, PRUSSIAN_DK, ink_w=3, radius=5)
    d.ellipse([(rx0 + rx1) // 2 - 5, ly1 - 24, (rx0 + rx1) // 2 + 5, ly1 - 14], fill=(*BRASS_HI, 255), outline=INK, width=2)
    draw_beveled_rect(d, pad + 34, H - pad - 32, W - pad - 34, H - pad - 6, PINE, ink_w=5, radius=6)
    d.rectangle([pad + 60, H - pad - 26, pad + 118, H - pad - 12], fill=(*PAPER, 255), outline=INK_MID, width=2)
    d.line([(pad + 132, H - pad - 18), (pad + 178, H - pad - 20)], fill=(*BRASS_HI, 255), width=4)
    return finish_prop(img, w, h, seed)


def make_postal_teller_counter_grille(w: int, h: int, seed: int) -> Image.Image:
    """Civic postal service counter with brass teller wicket bars, blotter, scale & bell."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 18
    draw_beveled_rect(d, pad, pad + 10, W - pad, H - pad - 12, WALNUT, ink_w=6, radius=12)
    draw_wood_planks_box(d, pad + 10, pad + 18, W - pad - 10, H - pad - 20, MAHOGANY, rng, horizontal=True, n_planks=4)
    d.line([(pad + 18, H - pad - 22), (W - pad - 18, H - pad - 22)], fill=(*BRASS_HI, 255), width=8)
    draw_beveled_rect(d, W // 2 - 66, H - pad - 56, W // 2 + 66, H - pad - 24, ENAMEL, ink_w=4, radius=6)
    gy = H - pad - 66
    d.line([(pad + 22, gy), (W // 2 - 74, gy)], fill=(*BRASS, 255), width=10)
    d.line([(W // 2 + 74, gy), (W - pad - 22, gy)], fill=(*BRASS, 255), width=10)
    for bx in list(range(pad + 34, W // 2 - 78, 22)) + list(range(W // 2 + 86, W - pad - 26, 22)):
        draw_disc(d, bx, gy, 7, BRASS_HI, ink_w=3)
    draw_beveled_rect(d, pad + 36, pad + 30, pad + 168, pad + 114, BAIZE, ink_w=4, radius=6)
    draw_beveled_rect(d, pad + 54, pad + 42, pad + 148, pad + 102, PAPER, ink_w=3, radius=4)
    d.line([(pad + 101, pad + 44), (pad + 101, pad + 100)], fill=INK_MID, width=3)
    for ly in range(pad + 54, pad + 96, 10):
        d.line([(pad + 62, ly), (pad + 94, ly)], fill=INK_MID, width=2)
        d.line([(pad + 108, ly), (pad + 140, ly)], fill=INK_MID, width=2)
    draw_disc(d, W // 2 + 44, pad + 82, 16, BRASS_HI, ink_w=4)
    draw_disc(d, W // 2 + 44, pad + 82, 5, IRON_DK, ink_w=2)
    draw_beveled_rect(d, W // 2 - 58, pad + 54, W // 2 - 6, pad + 88, PRUSSIAN, ink_w=3, radius=5)
    draw_beveled_rect(d, W - pad - 186, pad + 32, W - pad - 102, pad + 112, IRON, ink_w=4, radius=8)
    draw_disc(d, W - pad - 144, pad + 72, 28, BRASS, ink_w=4)
    draw_beveled_rect(d, W - pad - 92, pad + 40, W - pad - 30, pad + 104, PAPER, ink_w=4, radius=4)
    d.line([(W - pad - 61, pad + 40), (W - pad - 61, pad + 104)], fill=(*CRIMSON, 255), width=3)
    d.line([(W - pad - 92, pad + 72), (W - pad - 30, pad + 72)], fill=(*CRIMSON, 255), width=3)
    return finish_prop(img, w, h, seed)


def make_mail_sorting_table_bins(w: int, h: int, seed: int) -> Image.Image:
    """Back-room mail sorting worktable heaped with letters, parcels & pigeonhole bins."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 18
    draw_beveled_rect(d, pad, pad, W - pad, H - pad - 6, OAK, ink_w=6, radius=10)
    draw_wood_planks_box(d, pad + 10, pad + 10, W - pad - 10, H - pad - 16, PINE, rng, horizontal=True, n_planks=5)
    by0, by1 = pad + 16, pad + 92
    bw = (W - 2 * pad - 28) / 6
    for i in range(6):
        x0 = int(pad + 14 + i * bw + 3)
        x1 = int(pad + 14 + (i + 1) * bw - 3)
        draw_beveled_rect(d, x0, by0, x1, by1, WALNUT, ink_w=4, radius=5)
        for _ in range(3):
            ox = rng.randint(-4, 4)
            oy = rng.randint(4, 18)
            d.rectangle([x0 + 8 + ox, by0 + 10 + oy, x1 - 8 + ox, by1 - 8], fill=(*vary_rgb(PAPER, rng, 10), 255), outline=INK_MID, width=2)
    draw_beveled_rect(d, pad + 28, H // 2 - 4, pad + 152, H - pad - 30, KRAFT, ink_w=5, radius=6)
    d.line([(pad + 90, H // 2 - 4), (pad + 90, H - pad - 30)], fill=(*CREAM, 255), width=4)
    mid_py = (H // 2 - 4 + H - pad - 30) // 2
    d.line([(pad + 28, mid_py), (pad + 152, mid_py)], fill=(*CREAM, 255), width=4)
    d.rectangle([pad + 114, H // 2 + 8, pad + 140, H // 2 + 28], fill=(*PRUSSIAN, 255), outline=INK, width=2)
    for ex, ey, rot_off in [(W // 2 - 36, H // 2 + 6, 6), (W // 2 + 12, H // 2 + 24, -5), (W // 2 - 8, H // 2 + 52, 4)]:
        d.polygon(
            [(ex, ey), (ex + 54, ey + rot_off), (ex + 48, ey + 36 + rot_off), (ex - 6, ey + 36)],
            fill=(*PAPER, 255), outline=INK, width=3,
        )
        d.ellipse([ex + 20, ey + 14, ex + 30, ey + 24], fill=(*CRIMSON, 255))
    draw_beveled_rect(d, W - pad - 150, H // 2, W - pad - 26, H - pad - 28, PRUSSIAN_DK, ink_w=5, radius=8)
    draw_disc(d, W - pad - 88, H // 2 + 54, 26, BRASS, ink_w=4)
    draw_disc(d, W - pad - 88, H // 2 + 54, 12, COPPER, ink_w=3)
    return finish_prop(img, w, h, seed)


def make_mail_sack_canvas_cart(w: int, h: int, seed: int) -> Image.Image:
    """Iron-frame rolling postal hand-truck stuffed with canvas mailbags & parcels."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 22
    d.rounded_rectangle([pad - 6, H // 2 - 58, pad + 26, H // 2 + 58], radius=10, outline=(*IRON_DK, 255), width=10)
    for wy in (pad + 10, H - pad - 34):
        draw_beveled_rect(d, pad + 28, wy, pad + 78, wy + 24, IRON_DK, ink_w=4, radius=6)
        draw_beveled_rect(d, W - pad - 74, wy, W - pad - 24, wy + 24, IRON_DK, ink_w=4, radius=6)
    draw_beveled_rect(d, pad + 18, pad + 18, W - pad - 10, H - pad - 18, IRON, ink_w=6, radius=10)
    draw_wood_planks_box(d, pad + 28, pad + 28, W - pad - 20, H - pad - 28, OAK, rng, horizontal=True, n_planks=4)
    for cx, cy, rx, ry in [(W * 0.44, H * 0.42, 68, 48), (W * 0.52, H * 0.64, 62, 42)]:
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(*CANVAS, 255), outline=INK, width=6)
        d.line([(cx - rx + 18, cy - 10), (cx + rx - 18, cy - 10)], fill=(*PRUSSIAN, 255), width=8)
        d.line([(cx - rx + 24, cy + 8), (cx + rx - 24, cy + 8)], fill=(*CRIMSON, 255), width=5)
        draw_disc(d, cx + rx - 16, cy - 2, 13, LEATHER, ink_w=3)
    draw_beveled_rect(d, W - pad - 110, pad + 42, W - pad - 30, H - pad - 42, KRAFT, ink_w=5, radius=6)
    d.line([(W - pad - 70, pad + 42), (W - pad - 70, H - pad - 42)], fill=(*CREAM, 255), width=4)
    d.line([(W - pad - 110, H // 2), (W - pad - 30, H // 2)], fill=(*CREAM, 255), width=4)
    return finish_prop(img, w, h, seed)


def make_postal_writing_kiosk_stand(w: int, h: int, seed: int) -> Image.Image:
    """Customer public letter-writing desk with chained brass pens, inkwell & forms."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 18
    draw_beveled_rect(d, pad, pad, W - pad, H - pad - 6, WALNUT, ink_w=6, radius=10)
    draw_wood_planks_box(d, pad + 10, pad + 10, W - pad - 10, H - pad - 16, OAK, rng, horizontal=True, n_planks=3)
    draw_beveled_rect(d, pad + 16, pad + 14, W - pad - 16, pad + 56, MAHOGANY, ink_w=4, radius=6)
    for fx in range(pad + 30, W - pad - 70, 74):
        d.rectangle([fx, pad + 22, fx + 54, pad + 48], fill=(*PAPER, 255), outline=INK_MID, width=2)
    draw_beveled_rect(d, pad + 32, pad + 72, W // 2 + 54, H - pad - 26, BAIZE, ink_w=4, radius=6)
    d.rectangle([pad + 54, pad + 88, W // 2 + 28, H - pad - 40], fill=(*CREAM, 255), outline=INK_MID, width=2)
    for ly in range(pad + 102, H - pad - 46, 14):
        d.line([(pad + 66, ly), (W // 2 + 16, ly)], fill=INK_MID, width=2)
    draw_disc(d, W - pad - 76, pad + 92, 18, BRASS, ink_w=4)
    draw_disc(d, W - pad - 76, pad + 92, 8, IRON_DK, ink_w=2)
    d.line([(W - pad - 76, pad + 110), (W - pad - 96, H - pad - 56), (W - pad - 56, H - pad - 40)], fill=(*BRASS_HI, 255), width=3)
    d.line([(W - pad - 118, H - pad - 38), (W - pad - 48, H - pad - 58)], fill=(*PRUSSIAN, 255), width=7)
    return finish_prop(img, w, h, seed)


def make_postal_awning_prussian_gold(w: int, h: int, seed: int) -> Image.Image:
    """Scalloped Prussian-Blue & Cream civic Post Office storefront awning with brass trim."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    pad_x, pad_y = 14, 14
    x0, x1 = pad_x, W - pad_x
    y0, y1 = pad_y, H - pad_y - 22
    n_stripes = 11
    sw = (x1 - x0) / n_stripes
    draw_beveled_rect(d, x0 - 4, y0 - 4, x1 + 4, y0 + 18, IRON_DK, ink_w=4, radius=4)
    for i in range(n_stripes):
        sx0 = int(x0 + i * sw)
        sx1 = int(x0 + (i + 1) * sw)
        col = PRUSSIAN if i % 2 == 0 else CREAM
        dk = blend_rgb(col, (18, 18, 26), 0.25)
        hi = blend_rgb(col, (255, 250, 236), 0.25)
        d.rectangle([sx0, y0 + 14, sx1, y1], fill=(*col, 255), outline=INK, width=3)
        d.rectangle([sx0 + 3, y0 + 18, sx1 - 3, y0 + 40], fill=hi)
        d.chord([sx0, y1 - 24, sx1, y1 + 22], 0, 180, fill=dk, outline=INK, width=4)
    d.rectangle([x0 + 4, y1 - 20, x1 - 4, y1 - 6], fill=(*GOLD, 255), outline=INK, width=3)
    draw_disc(d, W // 2, (y0 + y1) // 2 + 6, 22, GOLD, ink_w=4)
    draw_disc(d, W // 2, (y0 + y1) // 2 + 6, 11, PRUSSIAN, ink_w=3)
    return finish_prop(img, w, h, seed, grain=4.4, shadow_offset=(6, 11), shadow_alpha=110)


def make_tenant_mailbox_key_rack(w: int, h: int, seed: int) -> Image.Image:
    """Residential foyer wall-mounted tenant mailbox cabinet & key/notice rail."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 14
    draw_beveled_rect(d, pad, pad + 4, W - pad, H - pad - 10, OAK, ink_w=5, radius=8)
    x0, x1 = pad + 14, W - pad - 14
    y0, y1 = pad + 20, H - pad - 24
    cw = (x1 - x0) / 8
    for i in range(8):
        bx0 = int(x0 + i * cw + 2)
        bx1 = int(x0 + (i + 1) * cw - 2)
        draw_beveled_rect(d, bx0, y0, bx1, y1, vary_rgb(BRASS, rng, 14), ink_w=3, radius=4)
        d.rectangle([bx0 + 6, y0 + 10, bx1 - 6, y0 + 20], fill=(*CREAM, 255), outline=INK_MID, width=1)
        d.line([(bx0 + 8, y1 - 18), (bx1 - 8, y1 - 18)], fill=(*IRON_DK, 255), width=4)
        if i in (1, 5):
            d.rectangle([bx0 + 9, y1 - 12, bx1 - 9, y1 + 8], fill=(*PAPER, 255), outline=INK, width=2)
    return finish_prop(img, w, h, seed)


def make_single_studio_kitchenette(w: int, h: int, seed: int) -> Image.Image:
    """Compact single-occupant tenement kitchenette: enamel sink, 2-burner hotplate, kettle & mug."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 16
    draw_beveled_rect(d, pad, pad, W - pad, H - pad - 6, OAK, ink_w=6, radius=10)
    draw_wood_planks_box(d, pad + 10, pad + 10, W - pad - 10, H - pad - 16, PINE, rng, horizontal=True, n_planks=3)
    sx0, sy0, sx1, sy1 = pad + 24, pad + 24, W // 2 - 28, H - pad - 28
    draw_beveled_rect(d, sx0, sy0, sx1, sy1, ENAMEL, ink_w=5, radius=12)
    draw_beveled_rect(d, sx0 + 14, sy0 + 14, sx1 - 14, sy1 - 14, (192, 206, 210), ink_w=3, radius=8)
    draw_disc(d, (sx0 + sx1) // 2, (sy0 + sy1) // 2, 8, IRON_DK, ink_w=2)
    d.rectangle([(sx0 + sx1) // 2 - 8, sy0 - 4, (sx0 + sx1) // 2 + 8, sy0 + 26], fill=(*BRASS_HI, 255), outline=INK, width=3)
    draw_beveled_rect(d, W // 2 - 14, pad + 32, W // 2 + 54, H - pad - 48, KRAFT, ink_w=3, radius=6)
    draw_disc(d, W // 2 + 20, H - pad - 70, 13, TEAL, ink_w=3)
    draw_disc(d, W // 2 + 20, H - pad - 70, 7, WALNUT, ink_w=1)
    draw_disc(d, W // 2 + 24, pad + 48, 12, CRIMSON, ink_w=3)
    hx0, hy0, hx1, hy1 = W // 2 + 68, pad + 24, W - pad - 24, H - pad - 28
    draw_beveled_rect(d, hx0, hy0, hx1, hy1, IRON, ink_w=5, radius=8)
    b1x, b1y = (hx0 + hx1) // 2 - 44, (hy0 + hy1) // 2
    b2x, b2y = (hx0 + hx1) // 2 + 44, (hy0 + hy1) // 2
    for bx, by in [(b1x, b1y), (b2x, b2y)]:
        draw_disc(d, bx, by, 32, IRON_DK, ink_w=4)
        for ang in range(0, 360, 45):
            rad = math.radians(ang)
            d.line([(bx, by), (bx + math.cos(rad) * 28, by + math.sin(rad) * 28)], fill=(*IRON, 255), width=3)
    draw_disc(d, b2x, b2y, 26, COPPER, ink_w=4)
    draw_disc(d, b2x, b2y, 8, BRASS_HI, ink_w=2)
    d.line([(b2x - 20, b2y - 10), (b2x + 20, b2y + 10)], fill=(*IRON_DK, 255), width=6)
    return finish_prop(img, w, h, seed)


def make_single_bed_quilted_colorable(w: int, h: int, seed: int) -> Image.Image:
    """Narrow single-occupant studio bed with dd_red colorable quilt blanket & pillow."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    pad_x, pad_y = 22, 18
    draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y - 6, IRON_DK, ink_w=6, radius=12)
    for px, py in [
        (pad_x + 12, pad_y + 12),
        (W - pad_x - 12, pad_y + 12),
        (pad_x + 12, H - pad_y - 18),
        (W - pad_x - 12, H - pad_y - 18),
    ]:
        draw_disc(d, px, py, 14, BRASS, ink_w=4)
    mx0, my0, mx1, my1 = pad_x + 16, pad_y + 24, W - pad_x - 16, H - pad_y - 30
    draw_beveled_rect(d, mx0, my0, mx1, my1, CREAM, ink_w=5, radius=10)
    draw_beveled_rect(d, mx0 + 22, my0 + 18, mx1 - 22, my0 + 114, (244, 240, 232), ink_w=5, radius=24)
    d.arc([mx0 + 46, my0 + 38, mx1 - 46, my0 + 96], 15, 165, fill=(210, 204, 192, 255), width=4)
    d.rectangle([mx0 + 4, my0 + 124, mx1 - 4, my0 + 162], fill=(236, 230, 218, 255), outline=INK, width=4)
    # Pure dd_red quilted blanket (R >> G, B so colorShader recolors cleanly!)
    qy0 = my0 + 154
    d.rounded_rectangle([mx0 + 4, qy0, mx1 - 4, my1 - 4], radius=10, fill=(*DD_RED_BASE, 255), outline=INK, width=5)
    # Diamond quilt stitches strictly inside [mx0+8 .. mx1-8, qy0+6 .. my1-8]
    q_mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(q_mask).rounded_rectangle([mx0 + 8, qy0 + 6, mx1 - 8, my1 - 8], radius=8, fill=255)
    q_pat = Image.new("RGBA", img.size, (0, 0, 0, 0))
    qd = ImageDraw.Draw(q_pat, "RGBA")
    for offset in range(-H, W + H, 42):
        qd.line([(mx0 + offset, qy0), (mx0 + offset + 320, qy0 + 320)], fill=(*DD_RED_DEEP, 255), width=3)
        qd.line([(mx0 + offset, my1), (mx0 + offset + 320, my1 - 320)], fill=(*DD_RED_DEEP, 255), width=3)
    qd.rectangle([mx0 + 8, qy0 + 6, mx1 - 8, qy0 + 22], fill=(*DD_RED_HI, 255))
    q_clipped = Image.new("RGBA", img.size, (0, 0, 0, 0))
    q_clipped.paste(q_pat, (0, 0), q_mask)
    img.alpha_composite(q_clipped)
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle([mx0 + 4, qy0, mx1 - 4, my1 - 4], radius=10, outline=INK, width=5)
    draw_beveled_rect(d, pad_x + 4, H - pad_y - 28, W - pad_x - 4, H - pad_y - 6, IRON, ink_w=5, radius=6)
    # Open paperback left on foot corner of bed
    d.polygon(
        [(mx1 - 86, my1 - 86), (mx1 - 26, my1 - 96), (mx1 - 18, my1 - 36), (mx1 - 78, my1 - 26)],
        fill=(*PAPER, 255), outline=INK, width=3,
    )
    d.line([(mx1 - 56, my1 - 91), (mx1 - 48, my1 - 31)], fill=INK_MID, width=3)
    return finish_prop(img, w, h, seed, grain=2.8, warm_bevel=False)


def make_hallway_shoe_coat_bench(w: int, h: int, seed: int) -> Image.Image:
    """Lived-in entryway boot bench with muddy shoes, folded scarf & umbrella stand."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 16
    for bx, col in [(pad + 46, LEATHER_DK), (pad + 128, LEATHER)]:
        d.rounded_rectangle([bx, H - pad - 48, bx + 26, H - pad - 4], radius=10, fill=(*col, 255), outline=INK, width=4)
        d.rounded_rectangle([bx + 30, H - pad - 46, bx + 56, H - pad - 2], radius=10, fill=(*col, 255), outline=INK, width=4)
    draw_beveled_rect(d, pad, pad + 14, W - pad - 68, H - pad - 28, OAK, ink_w=5, radius=8)
    draw_wood_planks_box(d, pad + 8, pad + 22, W - pad - 76, H - pad - 36, PINE, rng, horizontal=True, n_planks=2)
    draw_beveled_rect(d, W - pad - 156, pad + 24, W - pad - 88, H - pad - 34, CRIMSON, ink_w=4, radius=8)
    d.line([(W - pad - 152, pad + 48), (W - pad - 92, pad + 48)], fill=(*GOLD, 255), width=5)
    d.line([(W - pad - 152, pad + 68), (W - pad - 92, pad + 68)], fill=(*GOLD, 255), width=5)
    d.line([(pad + 18, pad + 12), (W - pad - 84, pad + 12)], fill=(*BRASS, 255), width=7)
    for hx in range(pad + 42, W - pad - 92, 54):
        draw_disc(d, hx, pad + 12, 7, BRASS_HI, ink_w=2)
    draw_disc(d, W - pad - 34, H // 2 - 4, 28, IRON, ink_w=5)
    draw_disc(d, W - pad - 34, H // 2 - 4, 18, IRON_DK, ink_w=3)
    draw_disc(d, W - pad - 42, H // 2 - 8, 9, PRUSSIAN, ink_w=2)
    draw_disc(d, W - pad - 26, H // 2 + 1, 9, OCHRE, ink_w=2)
    return finish_prop(img, w, h, seed)


def make_community_bulletin_board_table(w: int, h: int, seed: int) -> Image.Image:
    """Public housing hallway share table with flyers, lost-cat notice, books & teacup."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    rng = random.Random(seed)
    W, H = img.size
    pad = 16
    draw_beveled_rect(d, pad, pad, W - pad, H - pad - 6, WALNUT, ink_w=6, radius=10)
    draw_wood_planks_box(d, pad + 10, pad + 10, W - pad - 10, H - pad - 16, OAK, rng, horizontal=True, n_planks=3)
    draw_beveled_rect(d, pad + 14, pad + 12, W - pad - 14, pad + 56, KRAFT, ink_w=4, radius=5)
    for fx, fcol in [(pad + 26, PAPER), (pad + 92, (246, 224, 152)), (pad + 158, PAPER), (pad + 228, (214, 232, 238)), (pad + 298, PAPER)]:
        if fx + 52 < W - pad - 14:
            d.rectangle([fx, pad + 18, fx + 50, pad + 48], fill=(*fcol, 255), outline=INK_MID, width=2)
            d.ellipse([fx + 22, pad + 20, fx + 28, pad + 26], fill=(*CRIMSON, 255))
    draw_beveled_rect(d, pad + 30, pad + 78, pad + 128, H - pad - 30, PRUSSIAN, ink_w=4, radius=5)
    draw_beveled_rect(d, pad + 42, pad + 68, pad + 134, H - pad - 42, SAGE, ink_w=4, radius=5)
    d.polygon(
        [(W // 2 - 42, pad + 76), (W // 2 + 44, pad + 70), (W // 2 + 50, H - pad - 28), (W // 2 - 36, H - pad - 22)],
        fill=(*PAPER, 255), outline=INK, width=3,
    )
    draw_disc(d, W // 2 + 4, pad + 114, 14, OCHRE, ink_w=2)
    draw_disc(d, W // 2 + 78, pad + 110, 17, CREAM, ink_w=3)
    draw_disc(d, W // 2 + 78, pad + 110, 10, WALNUT, ink_w=2)
    draw_disc(d, W - pad - 56, pad + 118, 28, COPPER, ink_w=4)
    for ang in range(0, 360, 45):
        rad = math.radians(ang)
        lx = W - pad - 56 + math.cos(rad) * 18
        ly = pad + 118 + math.sin(rad) * 18
        draw_disc(d, lx, ly, 11, SAGE, ink_w=2)
    return finish_prop(img, w, h, seed)


ASSET_SPECS = [
    ("ph_po_box_brass_wall_bank.png", "Brass P.O. Box Wall Locker Bank", 288, 112, "normal",
     ["post_office", "po_box", "mailbox", "brass", "civic", "harmony", "post_housing"], make_po_box_brass_wall_bank),
    ("ph_po_box_wall_bank_corner.png", "P.O. Box Alcove & Mail Drop Chute", 256, 112, "normal",
     ["post_office", "po_box", "mail_drop", "brass", "civic", "harmony", "post_housing"], make_po_box_wall_bank_corner),
    ("ph_postal_teller_counter_grille.png", "Postal Service Teller Counter & Brass Grille", 320, 144, "normal",
     ["post_office", "counter", "teller", "brass", "civic", "harmony", "post_housing"], make_postal_teller_counter_grille),
    ("ph_mail_sorting_table_bins.png", "Mail Sorting Worktable & Pigeonhole Bins", 288, 160, "normal",
     ["post_office", "sorting", "mail", "parcels", "table", "harmony", "post_housing"], make_mail_sorting_table_bins),
    ("ph_mail_sack_canvas_cart.png", "Rolling Canvas Mailbag Hand-Truck Cart", 208, 144, "normal",
     ["post_office", "mailbag", "cart", "parcel", "delivery", "harmony", "post_housing"], make_mail_sack_canvas_cart),
    ("ph_postal_writing_kiosk_stand.png", "Public Letter-Writing Kiosk Stand", 224, 128, "normal",
     ["post_office", "desk", "writing", "inkwell", "civic", "harmony", "post_housing"], make_postal_writing_kiosk_stand),
    ("ph_postal_awning_prussian_gold.png", "Prussian Blue & Gold Civic Post Office Awning", 304, 112, "normal",
     ["post_office", "awning", "storefront", "civic", "prussian", "harmony", "post_housing"], make_postal_awning_prussian_gold),
    ("ph_tenant_mailbox_key_rack.png", "Tenement Foyer Brass Tenant Mailbox Rack", 224, 96, "normal",
     ["housing", "apartment", "mailbox", "foyer", "tenement", "harmony", "post_housing"], make_tenant_mailbox_key_rack),
    ("ph_single_studio_kitchenette.png", "Compact Single-Occupant Studio Kitchenette", 256, 128, "normal",
     ["housing", "apartment", "kitchenette", "sink", "stove", "kettle", "harmony", "post_housing"], make_single_studio_kitchenette),
    ("ph_single_bed_quilted_colorable.png", "Single Studio Iron Bed (Colorable Quilt)", 192, 272, "dd_red",
     ["housing", "apartment", "bed", "single", "colorable", "bedroom", "harmony", "post_housing"], make_single_bed_quilted_colorable),
    ("ph_hallway_shoe_coat_bench.png", "Lived-In Entryway Boot Bench & Coat Rack", 224, 112, "normal",
     ["housing", "apartment", "bench", "boots", "coat", "hallway", "harmony", "post_housing"], make_hallway_shoe_coat_bench),
    ("ph_community_bulletin_board_table.png", "Public Housing Community Notice & Share Table", 224, 128, "normal",
     ["housing", "apartment", "notice", "community", "table", "books", "harmony", "post_housing"], make_community_bulletin_board_table),
]


def main() -> None:
    manifest_entries = []
    qa_items: list[tuple[str, Image.Image]] = []
    for idx, (fname, title, w, h, draw_mode, tags, fn) in enumerate(ASSET_SPECS, start=1):
        img = fn(w, h, 8400 + idx * 37)
        out_path = OUT_DIR / fname
        img.save(out_path, "PNG")
        rel_path = f"props/post_housing/{fname}"
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
        print(f"  [{idx:02d}/12] {rel_path} ({img.width}x{img.height}, {draw_mode})")

    total = upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    qa_path = SCRATCH_DIR / "qa_post_housing_suite.png"
    save_qa_sheet(qa_items, qa_path, cols=4, cw=260, ch=190)
    print(f"\nGenerated 12 Post Office & Public Housing assets (manifest total={total}) + QA sheet: {qa_path}")


if __name__ == "__main__":
    main()

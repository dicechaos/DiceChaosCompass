"""
Dice Chaos Compass — 10-Asset Painterly Shared-Living Hostel Suite ("Wanderer's Hearth")

Generates 10 bespoke clean-room CC0 Harmony assets in:
  `public/assets/modular-suite-cc0/props/hostel_living/`

Designed to complement our existing `bedroom_home`, `messy_apartment`, `kitchen`,
`camp_travel`, `harmony_arch`, `harmony_lighting`, `post_housing`, and `weathering_overlays`
libraries:
  - Dormitory & Sleeping (3):
      hs_hostel_bunk_bed_colorable (dd_red!), hs_hostel_bunk_curtain_colorable (dd_red!),
      hs_padlock_locker_bank
  - Shared Kitchen, Reception & Lounge (5):
      hs_hostel_reception_desk, hs_communal_hostel_table, hs_shared_kitchen_galley,
      hs_traveler_backpack_cubby, hs_hostel_floor_cushion_nook
  - Shared Washroom & Storefront (2):
      hs_shared_wash_trough_mirrors, hs_hostel_awning_terracotta_stripe

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

OUT_DIR = MOD_DIR / "props" / "hostel_living"
OUT_DIR.mkdir(parents=True, exist_ok=True)

WALNUT = (96, 64, 44)
OAK = (156, 114, 72)
PINE = (188, 148, 98)
PINE_LT = (206, 170, 120)
TERRACOTTA = (182, 86, 56)
OCHRE = (206, 152, 62)
SAGE = (102, 136, 98)
TEAL = (54, 124, 126)
INDIGO = (62, 76, 118)
PLUM = (122, 66, 102)
CREAM = (242, 234, 214)
LINEN = (228, 216, 192)
CANVAS = (196, 184, 156)
OLIVE = (106, 118, 76)
BRASS = (208, 166, 74)
BRASS_HI = (240, 208, 118)
COPPER = (190, 110, 66)
IRON = (60, 66, 74)
IRON_DK = (36, 40, 48)
ENAMEL = (232, 236, 234)
CERAMIC_BLUE = (58, 98, 138)
LEATHER = (132, 78, 46)
LEATHER_DK = (76, 46, 28)
PAPER = (238, 228, 202)
SLATE = (92, 102, 112)


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
            195,
            310,
            fill=hi,
            width=max(2, int(r * 0.14)),
        )


def make_hostel_bunk_bed_colorable(w: int, h: int, seed: int) -> Image.Image:
    """True top-down double-decker timber hostel bunk bed with side ladder & dd_red colorable quilt."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Outer bunk bed timber frame (leaves right space for sticking-out ladder rails!)
    bx0, by0, bx1, by1 = 36, 32, W - 64, H - 32
    draw_beveled_rect(d, bx0, by0, bx1, by1, WALNUT, radius=10, ink_w=6)

    # Side bunk wooden ladder sticking out on the right side (unmistakable bunk bed silhouette!)
    lx0, lx1 = bx1 - 6, W - 26
    ly0, ly1 = int(H * 0.30), int(H * 0.78)
    # Ladder stiles (vertical wooden rails)
    draw_beveled_rect(d, lx0, ly0, lx0 + 18, ly1, OAK, radius=5, ink_w=4)
    draw_beveled_rect(d, lx1 - 18, ly0, lx1, ly1, OAK, radius=5, ink_w=4)
    # 5 wooden ladder rungs
    for i in range(5):
        ry = int(ly0 + 24 + i * ((ly1 - ly0 - 48) / 4.0))
        draw_beveled_rect(d, lx0 + 4, ry - 9, lx1 - 4, ry + 9, PINE, radius=4, ink_w=3)

    # Inner mattress recess
    mx0, my0, mx1, my1 = bx0 + 22, by0 + 24, bx1 - 22, by1 - 24
    draw_beveled_rect(d, mx0, my0, mx1, my1, CREAM, radius=14, ink_w=4)

    # Plump rumpled pillow at head + small striped travel cushion
    draw_beveled_rect(d, mx0 + 18, my0 + 18, mx1 - 18, my0 + 114, (246, 240, 224), radius=24, ink_w=4)
    d.arc([mx0 + 36, my0 + 42, mx1 - 36, my0 + 98], 18, 162, fill=blend_rgb(LINEN, INK, 0.25), width=3)
    draw_beveled_rect(d, mx0 + 34, my0 + 92, mx0 + 132, my0 + 148, LINEN, radius=16, ink_w=3)

    # Turned-down sheet cuff
    cuff_y = my0 + 144
    draw_beveled_rect(d, mx0 + 6, cuff_y, mx1 - 6, cuff_y + 44, (242, 236, 222), radius=10, ink_w=3)

    # Colorable dd_red quilted hostel duvet (pure red channel for crisp tinting!)
    qy0 = cuff_y + 32
    draw_beveled_rect(d, mx0 + 4, qy0, mx1 - 4, my1 - 6, DD_RED_BASE, radius=16, ink_w=5)
    # Diamond quilt stitching + soft top-down fabric folds
    step = 44
    for x in range(mx0 + 18, mx1 - 10, step):
        d.line([(x, qy0 + 10), (min(mx1 - 12, x + 70), min(my1 - 14, qy0 + 80))], fill=DD_RED_DEEP, width=2)
    for y in range(qy0 + 26, my1 - 16, step):
        d.line([(mx0 + 16, y), (mx1 - 16, y + 14)], fill=DD_RED_DEEP, width=3)
        d.line([(mx0 + 22, y - 5), (mx1 - 22, y + 9)], fill=DD_RED_HI, width=2)

    # Folded cream-and-oat knit throw strip draped near foot of bunk
    fy0 = my1 - 92
    draw_beveled_rect(d, mx0 + 10, fy0, mx1 - 10, my1 - 26, LINEN, radius=12, ink_w=4)
    for sx in range(mx0 + 26, mx1 - 22, 24):
        d.line([(sx, fy0 + 6), (sx, my1 - 32)], fill=blend_rgb(LINEN, OAK, 0.35), width=4)

    # Upper bunk timber safety guard rails (left & top) + chunky 4 square corner posts!
    draw_beveled_rect(d, bx0 - 4, by0 + 24, bx0 + 18, by1 - 24, OAK, radius=5, ink_w=4)
    draw_beveled_rect(d, bx1 - 18, by0 + 24, bx1 + 4, by0 + 160, OAK, radius=5, ink_w=4)
    for px, py in [(bx0 + 10, by0 + 10), (bx1 - 10, by0 + 10), (bx0 + 10, by1 - 10), (bx1 - 10, by1 - 10)]:
        draw_beveled_rect(d, px - 19, py - 19, px + 19, py + 19, OAK, radius=6, ink_w=5)
        draw_beveled_rect(d, px - 9, py - 9, px + 9, py + 9, PINE_LT, radius=3, ink_w=2)

    return finish_prop(img, w, h, seed)


def make_hostel_bunk_curtain_colorable(w: int, h: int, seed: int) -> Image.Image:
    """Privacy-curtained wooden hostel bunk bed with brass rail, draped cloth, ladder & dd_red duvet."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Bunk frame with small headboard shelf + side ladder
    bx0, by0, bx1, by1 = 44, 34, W - 62, H - 30
    draw_beveled_rect(d, bx0, by0, bx1, by1, WALNUT, radius=10, ink_w=6)

    # Wooden ladder on right side
    lx0, lx1 = bx1 - 6, W - 26
    ly0, ly1 = int(H * 0.36), int(H * 0.80)
    draw_beveled_rect(d, lx0, ly0, lx0 + 16, ly1, OAK, radius=4, ink_w=4)
    draw_beveled_rect(d, lx1 - 16, ly0, lx1, ly1, OAK, radius=4, ink_w=4)
    for i in range(4):
        ry = int(ly0 + 24 + i * ((ly1 - ly0 - 48) / 3.0))
        draw_beveled_rect(d, lx0 + 4, ry - 8, lx1 - 4, ry + 8, PINE, radius=3, ink_w=3)

    # Headboard narrow wooden shelf with mini book & pocket lantern
    draw_beveled_rect(d, bx0 + 14, by0 + 8, bx1 - 14, by0 + 42, OAK, radius=6, ink_w=4)
    draw_beveled_rect(d, bx0 + 30, by0 + 14, bx0 + 84, by0 + 36, TEAL, radius=3, ink_w=2)
    draw_disc(d, bx1 - 54, by0 + 25, 11, BRASS_HI, ink_w=3)

    # Mattress & plump pillows
    mx0, my0, mx1, my1 = bx0 + 22, by0 + 46, bx1 - 22, by1 - 22
    draw_beveled_rect(d, mx0, my0, mx1, my1, CREAM, radius=14, ink_w=4)
    draw_beveled_rect(d, mx0 + 16, my0 + 16, mx1 - 16, my0 + 108, (248, 242, 226), radius=22, ink_w=4)
    d.arc([mx0 + 32, my0 + 40, mx1 - 32, my0 + 92], 15, 165, fill=blend_rgb(LINEN, INK, 0.22), width=3)

    # Colorable dd_red duvet & matching side privacy curtains!
    qy0 = my0 + 124
    draw_beveled_rect(d, mx0 + 6, qy0, mx1 - 6, my1 - 8, DD_RED_BASE, radius=14, ink_w=5)
    for y in range(qy0 + 28, my1 - 18, 42):
        d.line([(mx0 + 18, y), (mx1 - 18, y + 10)], fill=DD_RED_DEEP, width=3)
        d.line([(mx0 + 22, y - 5), (mx1 - 22, y + 5)], fill=DD_RED_HI, width=2)

    # Brass curtain rods along left & foot edges
    d.line([(bx0 - 6, by0 + 18), (bx0 - 6, by1 - 14)], fill=BRASS, width=8)
    d.line([(bx0 - 6, by1 - 14), (bx1 - 10, by1 - 14)], fill=BRASS, width=8)

    # Pleated linen privacy curtains gathered along the left rail & foot corner (non-red so bed color pops!)
    for idx, cy in enumerate(range(by0 + 28, by1 - 34, 34)):
        sway = 14 if idx % 2 == 0 else 4
        draw_beveled_rect(d, bx0 - 20, cy, bx0 + 24 + sway, cy + 32, LINEN, radius=12, ink_w=3)
        draw_disc(d, bx0 - 6, cy + 14, 6, BRASS_HI, ink_w=2)
    # Foot gathered drape
    for cx in range(bx0 + 10, bx1 - 46, 36):
        draw_beveled_rect(d, cx, by1 - 26, cx + 34, by1 + 12, LINEN, radius=10, ink_w=3)

    # 4 corner timber posts
    for px, py in [(bx0 + 10, by0 + 10), (bx1 - 10, by0 + 10), (bx0 + 10, by1 - 10), (bx1 - 10, by1 - 10)]:
        draw_beveled_rect(d, px - 18, py - 18, px + 18, py + 18, WALNUT, radius=6, ink_w=5)
        draw_beveled_rect(d, px - 8, py - 8, px + 8, py + 8, OAK, radius=3, ink_w=2)

    return finish_prop(img, w, h, seed)


def make_padlock_locker_bank(w: int, h: int, seed: int) -> Image.Image:
    """Row of 4 numbered timber & iron hostel gear lockers with brass padlocks & top backpack."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    x0, y0, x1, y1 = 24, 24, W - 24, H - 30
    draw_beveled_rect(d, x0, y0, x1, y1, WALNUT, radius=10, ink_w=6)

    # 4 locker top bays with slight wood tone variation, ventilation grates & front brass padlocks
    bay_w = (x1 - x0 - 24) / 4.0
    rng = random.Random(seed)
    for i in range(4):
        bx0 = int(x0 + 12 + i * bay_w)
        bx1 = int(bx0 + bay_w - 6)
        tone = vary_rgb(OAK if i % 2 == 0 else PINE, rng, 10)
        draw_wood_planks_box(d, bx0, y0 + 10, bx1, y1 - 10, tone, rng, horizontal=True, n_planks=3)
        # Iron corner straps
        d.rectangle([bx0, y0 + 10, bx1, y0 + 20], fill=IRON, outline=INK, width=2)
        # Front door rim + hanging brass padlock & chalk tag
        d.rectangle([bx0 + 6, y1 - 14, bx1 - 6, y1 + 4], fill=IRON_DK, outline=INK, width=3)
        # Chalk room-number plate
        draw_beveled_rect(d, bx0 + 16, y1 - 36, bx0 + 50, y1 - 18, PAPER, radius=3, ink_w=2)
        # Brass padlock loop + body protruding slightly on front
        px = bx1 - 28
        d.arc([px - 9, y1 - 8, px + 9, y1 + 10], 180, 360, fill=BRASS_HI, width=4)
        draw_beveled_rect(d, px - 12, y1 - 2, px + 12, y1 + 16, BRASS, radius=4, ink_w=3)

    # Traveler canvas rucksack & coiled rope resting on top of bays 2–3
    draw_beveled_rect(d, int(x0 + 130), y0 + 22, int(x0 + 236), y1 - 22, OLIVE, radius=22, ink_w=5)
    # Leather straps & brass buckles across backpack
    d.rectangle([int(x0 + 154), y0 + 22, int(x0 + 168), y1 - 22], fill=LEATHER, outline=INK, width=3)
    d.rectangle([int(x0 + 200), y0 + 22, int(x0 + 214), y1 - 22], fill=LEATHER, outline=INK, width=3)
    draw_beveled_rect(d, int(x0 + 152), int((y0 + y1) / 2 - 8), int(x0 + 170), int((y0 + y1) / 2 + 8), BRASS_HI, radius=2, ink_w=2)
    draw_beveled_rect(d, int(x0 + 198), int((y0 + y1) / 2 - 8), int(x0 + 216), int((y0 + y1) / 2 + 8), BRASS_HI, radius=2, ink_w=2)

    # Rolled striped sleeping mat on bay 4
    draw_beveled_rect(d, int(x1 - 108), y0 + 26, int(x1 - 24), y0 + 66, TERRACOTTA, radius=14, ink_w=4)
    d.rectangle([int(x1 - 86), y0 + 26, int(x1 - 74), y0 + 66], fill=LEATHER_DK, outline=INK, width=2)
    d.rectangle([int(x1 - 50), y0 + 26, int(x1 - 38), y0 + 66], fill=LEATHER_DK, outline=INK, width=2)

    return finish_prop(img, w, h, seed)


def make_hostel_reception_desk(w: int, h: int, seed: int) -> Image.Image:
    """Cozy hostel check-in front desk with room-key board, guestbook ledger, brass bell & maps."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Back wall key-hook rack bar along top (y = 0 side)
    draw_beveled_rect(d, 38, 20, W - 38, 66, WALNUT, radius=8, ink_w=5)
    for kx in range(68, W - 64, 48):
        draw_disc(d, kx, 42, 7, BRASS_HI, ink_w=2)
        d.line([(kx, 48), (kx + 4, 62)], fill=BRASS, width=4)
        # Small red/teal wooden key fob
        fob_col = TERRACOTTA if (kx // 48) % 2 == 0 else TEAL
        draw_beveled_rect(d, kx - 5, 52, kx + 9, 64, fob_col, radius=3, ink_w=2)

    # Main worn-oak check-in counter top
    cx0, cy0, cx1, cy1 = 24, 66, W - 24, H - 26
    draw_beveled_rect(d, cx0, cy0, cx1, cy1, WALNUT, radius=12, ink_w=6)
    draw_wood_planks_box(d, cx0 + 12, cy0 + 12, cx1 - 12, cy1 - 12, OAK, random.Random(seed), horizontal=True, n_planks=4)

    # Open stitched-leather guestbook ledger on center-left
    gx0, gy0, gx1, gy1 = 96, cy0 + 28, 256, cy1 - 28
    draw_beveled_rect(d, gx0, gy0, gx1, gy1, LEATHER, radius=8, ink_w=4)
    draw_beveled_rect(d, gx0 + 10, gy0 + 10, (gx0 + gx1) // 2 - 3, gy1 - 10, PAPER, radius=4, ink_w=3)
    draw_beveled_rect(d, (gx0 + gx1) // 2 + 3, gy0 + 10, gx1 - 10, gy1 - 10, PAPER, radius=4, ink_w=3)
    for ly in range(gy0 + 24, gy1 - 18, 16):
        d.line([(gx0 + 18, ly), ((gx0 + gx1) // 2 - 12, ly)], fill=INK_MID, width=2)
        d.line([((gx0 + gx1) // 2 + 12, ly), (gx1 - 18, ly)], fill=INK_MID, width=2)
    # Quill pen resting diagonally across guestbook
    d.line([(gx1 - 36, gy1 - 24), (gx1 + 26, gy0 + 14)], fill=CREAM, width=6)
    d.line([(gx1 - 38, gy1 - 22), (gx1 - 24, gy1 - 30)], fill=INK, width=4)

    # Gleaming brass front-desk bell
    draw_disc(d, 318, int((cy0 + cy1) * 0.54), 22, BRASS, ink_w=4)
    draw_disc(d, 318, int((cy0 + cy1) * 0.54), 8, BRASS_HI, ink_w=3)

    # Fanned traveler city pamphlets & folded map on the right
    for dx, dy, col in [(0, 0, SAGE), (20, 8, OCHRE), (40, -4, TERRACOTTA)]:
        draw_beveled_rect(d, 376 + dx, cy0 + 34 + dy, 434 + dx, cy1 - 38 + dy, col, radius=4, ink_w=3)
        d.rectangle([386 + dx, cy0 + 46 + dy, 424 + dx, cy0 + 68 + dy], fill=PAPER, outline=INK, width=2)

    # Chipped blue enamel mug on far left
    draw_disc(d, 64, cy0 + 58, 17, CERAMIC_BLUE, ink_w=4)
    draw_disc(d, 64, cy0 + 58, 11, (74, 48, 30), ink_w=2)

    return finish_prop(img, w, h, seed)


def make_communal_hostel_table(w: int, h: int, seed: int) -> Image.Image:
    """Long battered communal hostel table with benches, teapot, mugs, bread, map & game board."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Two rustic timber benches peeking out above & below the table
    rng = random.Random(seed)
    draw_beveled_rect(d, 52, 20, W - 52, 66, WALNUT, radius=8, ink_w=5)
    draw_wood_planks_box(d, 58, 26, W - 58, 60, PINE, rng, horizontal=True, n_planks=2)
    draw_beveled_rect(d, 58, H - 66, W - 46, H - 20, WALNUT, radius=8, ink_w=5)
    draw_wood_planks_box(d, 64, H - 60, W - 52, H - 26, PINE, rng, horizontal=True, n_planks=2)

    # Main communal pine table
    tx0, ty0, tx1, ty1 = 26, 62, W - 26, H - 62
    draw_beveled_rect(d, tx0, ty0, tx1, ty1, WALNUT, radius=12, ink_w=6)
    draw_wood_planks_box(d, tx0 + 12, ty0 + 12, tx1 - 12, ty1 - 12, OAK, rng, horizontal=True, n_planks=5)

    # Woven terracotta table runner down the middle
    draw_beveled_rect(d, tx0 + 42, int(H * 0.42), tx1 - 42, int(H * 0.58), TERRACOTTA, radius=6, ink_w=3)
    for sx in range(tx0 + 62, tx1 - 54, 34):
        d.line([(sx, int(H * 0.43)), (sx, int(H * 0.57))], fill=OCHRE, width=4)

    # Left: Unfolded parchment traveler's map with red route lines & brass compass
    mx0, my0, mx1, my1 = 68, ty0 + 28, 212, ty1 - 28
    draw_beveled_rect(d, mx0, my0, mx1, my1, PAPER, radius=5, ink_w=3)
    d.line([(mx0 + 20, my0 + 26), (mx0 + 68, my0 + 54), (mx1 - 24, my1 - 22)], fill=TERRACOTTA, width=4)
    d.line([(mx0 + 30, my1 - 30), (mx0 + 96, my0 + 42)], fill=TEAL, width=4)
    draw_disc(d, mx1 - 24, my0 + 28, 13, BRASS_HI, ink_w=3)

    # Center: Wooden breadboard with sliced crusty sourdough + steaming enamel teapot + 4 mismatched mugs
    draw_beveled_rect(d, 246, ty0 + 34, 348, ty1 - 34, PINE_LT, radius=14, ink_w=4)
    draw_disc(d, 286, int(H * 0.50), 26, (186, 128, 66), ink_w=4)
    for sy in range(int(H * 0.44), int(H * 0.56), 11):
        d.line([(316, sy), (338, sy)], fill=(216, 178, 120), width=6)

    # Cobalt enamel teapot
    draw_disc(d, 386, int(H * 0.46), 24, CERAMIC_BLUE, ink_w=4)
    draw_disc(d, 386, int(H * 0.46), 9, ENAMEL, ink_w=3)
    d.line([(406, int(H * 0.46)), (424, int(H * 0.42))], fill=CERAMIC_BLUE, width=8)

    # Mismatched traveler mugs around the table
    for mx, my, mc in [(230, ty0 + 32, TERRACOTTA), (366, ty1 - 34, SAGE), (434, ty0 + 38, OCHRE), (566, ty1 - 36, CREAM)]:
        draw_disc(d, mx, my, 14, mc, ink_w=3)
        draw_disc(d, mx, my, 8, (76, 46, 28), ink_w=2)

    # Right: Wooden travel chess / checkers board mid-game!
    cx0, cy0, cx1, cy1 = 458, ty0 + 30, 554, ty1 - 30
    draw_beveled_rect(d, cx0, cy0, cx1, cy1, WALNUT, radius=6, ink_w=4)
    sq = (cx1 - cx0 - 16) // 4
    for r in range(4):
        for c in range(4):
            sc = CREAM if (r + c) % 2 == 0 else WALNUT
            d.rectangle([cx0 + 8 + c * sq, cy0 + 8 + r * sq, cx0 + 8 + (c + 1) * sq, cy0 + 8 + (r + 1) * sq], fill=sc)
    for px, py, pc in [(cx0 + 22, cy0 + 24, CREAM), (cx0 + 68, cy0 + 46, IRON_DK), (cx0 + 46, cy0 + 72, TERRACOTTA)]:
        draw_disc(d, px, py, 7, pc, ink_w=2)

    return finish_prop(img, w, h, seed)


def make_shared_kitchen_galley(w: int, h: int, seed: int) -> Image.Image:
    """Communal self-catering hostel galley: 4-burner stove, stockpot, kettle, spice jars & drying rack."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Countertop base + tiled backsplash along y = 0
    x0, y0, x1, y1 = 22, 22, W - 22, H - 24
    draw_beveled_rect(d, x0, y0, x1, y1, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, x0 + 10, y0 + 26, x1 - 10, y1 - 10, PINE, random.Random(seed), horizontal=True, n_planks=4)
    # Tiled backsplash strip along back wall
    draw_beveled_rect(d, x0 + 6, y0 + 4, x1 - 6, y0 + 26, ENAMEL, radius=4, ink_w=3)
    for tx in range(x0 + 26, x1 - 16, 28):
        d.line([(tx, y0 + 6), (tx, y0 + 24)], fill=SLATE, width=2)

    # LEFT: Cast-iron 4-burner communal range with copper stockpot & brass kettle
    sx0, sy0, sx1, sy1 = x0 + 18, y0 + 34, x0 + 198, y1 - 18
    draw_beveled_rect(d, sx0, sy0, sx1, sy1, IRON, radius=8, ink_w=5)
    for bx, by in [(sx0 + 46, sy0 + 42), (sx1 - 46, sy0 + 42), (sx0 + 46, sy1 - 42), (sx1 - 46, sy1 - 42)]:
        draw_disc(d, bx, by, 26, IRON_DK, ink_w=3)
        d.line([(bx - 22, by), (bx + 22, by)], fill=SLATE, width=3)
        d.line([(bx, by - 22), (bx, by + 22)], fill=SLATE, width=3)
    # Simmering copper stockpot with soup on back-left burner
    draw_disc(d, sx0 + 46, sy0 + 42, 32, COPPER, ink_w=4)
    draw_disc(d, sx0 + 46, sy0 + 42, 23, OCHRE, ink_w=2)
    # Whistling brass tea kettle on front-right burner
    draw_disc(d, sx1 - 46, sy1 - 42, 24, BRASS, ink_w=4)
    d.line([(sx1 - 62, sy1 - 42), (sx1 - 30, sy1 - 42)], fill=IRON_DK, width=7)

    # CENTER: Prep cutting board + labeled dry-goods jars (oats, tea, sugar, spices)
    draw_beveled_rect(d, x0 + 216, y0 + 76, x0 + 332, y1 - 24, PINE_LT, radius=8, ink_w=4)
    for jx, jc in [(x0 + 232, OCHRE), (x0 + 266, SAGE), (x0 + 300, TERRACOTTA), (x0 + 334, CERAMIC_BLUE)]:
        draw_disc(d, jx, y0 + 50, 14, jc, ink_w=3)
        draw_disc(d, jx, y0 + 50, 7, PAPER, ink_w=2)

    # RIGHT: Enamel farm sink + wooden dish drying rack with stacked plates & checkered towel
    kx0, ky0, kx1, ky1 = x1 - 208, y0 + 36, x1 - 96, y1 - 22
    draw_beveled_rect(d, kx0, ky0, kx1, ky1, ENAMEL, radius=12, ink_w=5)
    draw_beveled_rect(d, kx0 + 12, ky0 + 14, kx1 - 12, ky1 - 12, (194, 212, 216), radius=8, ink_w=3)
    draw_disc(d, (kx0 + kx1) // 2, (ky0 + ky1) // 2 + 4, 8, SLATE, ink_w=2)
    # Brass faucet overhanging back of sink
    d.rectangle([(kx0 + kx1) // 2 - 5, ky0 - 6, (kx0 + kx1) // 2 + 5, ky0 + 22], fill=BRASS_HI, outline=INK, width=2)

    # Dish drying rack on far right
    rx0, ry0, rx1, ry1 = x1 - 84, y0 + 38, x1 - 18, y1 - 22
    draw_beveled_rect(d, rx0, ry0, rx1, ry1, OAK, radius=6, ink_w=4)
    for py in range(ry0 + 14, ry1 - 12, 18):
        draw_beveled_rect(d, rx0 + 8, py - 5, rx1 - 8, py + 5, ENAMEL, radius=3, ink_w=2)

    return finish_prop(img, w, h, seed)


def make_shared_wash_trough_mirrors(w: int, h: int, seed: int) -> Image.Image:
    """Communal multi-tap enamel hostel wash trough with 3 brass spigots, soaps & striped towels."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Back beveled mirror shelf strip along y = 0
    x0, y0, x1, y1 = 22, 22, W - 22, H - 24
    draw_beveled_rect(d, x0 + 6, y0, x1 - 6, y0 + 28, WALNUT, radius=6, ink_w=4)
    draw_beveled_rect(d, x0 + 16, y0 + 6, x1 - 16, y0 + 20, (186, 214, 224), radius=4, ink_w=2)

    # Long enameled communal wash trough
    draw_beveled_rect(d, x0, y0 + 26, x1, y1, ENAMEL, radius=16, ink_w=6)
    draw_beveled_rect(d, x0 + 18, y0 + 44, x1 - 18, y1 - 18, (202, 218, 222), radius=12, ink_w=4)

    # 3 Brass spigots, brass drains & pastel bar soaps
    span = (x1 - x0 - 80) / 2.0
    soap_cols = [(226, 166, 152), (168, 206, 172), (232, 206, 134)]
    for i in range(3):
        cx = int(x0 + 64 + i * ((x1 - x0 - 128) / 2.0))
        # Faucet pipe & cross handles
        d.rectangle([cx - 6, y0 + 20, cx + 6, y0 + 58], fill=BRASS_HI, outline=INK, width=3)
        draw_disc(d, cx - 18, y0 + 34, 7, BRASS, ink_w=2)
        draw_disc(d, cx + 18, y0 + 34, 7, BRASS, ink_w=2)
        # Brass basin drain
        draw_disc(d, cx, int((y0 + 44 + y1 - 18) / 2) + 8, 10, BRASS, ink_w=3)
        # Soap bar on rim
        draw_beveled_rect(d, cx + 32, y0 + 30, cx + 62, y0 + 48, soap_cols[i], radius=6, ink_w=2)

    # Striped rolled hand towels perched on left & right trough rims
    for tx, tc in [(x0 + 12, TERRACOTTA), (x1 - 54, TEAL)]:
        draw_beveled_rect(d, tx, y1 - 56, tx + 42, y1 - 10, CREAM, radius=8, ink_w=3)
        d.rectangle([tx + 4, y1 - 44, tx + 38, y1 - 34], fill=tc)
        d.rectangle([tx + 4, y1 - 26, tx + 38, y1 - 18], fill=tc)

    return finish_prop(img, w, h, seed)


def make_traveler_backpack_cubby(w: int, h: int, seed: int) -> Image.Image:
    """Hostel entryway cubby bench packed with rucksacks, bedrolls, hiking boots & walking staff."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Worn timber bench base
    x0, y0, x1, y1 = 22, 24, W - 22, H - 34
    draw_beveled_rect(d, x0, y0, x1, y1, WALNUT, radius=10, ink_w=6)
    draw_wood_planks_box(d, x0 + 10, y0 + 10, x1 - 10, y1 - 10, OAK, random.Random(seed), horizontal=True, n_planks=3)

    # 3 distinct traveler backpacks & bedrolls perched along the cubby
    packs = [
        (x0 + 22, y0 + 18, x0 + 122, y1 - 16, OLIVE),
        (x0 + 138, y0 + 22, x0 + 244, y1 - 14, TERRACOTTA),
        (x0 + 260, y0 + 16, x0 + 356, y1 - 18, INDIGO),
    ]
    for px0, py0, px1, py1, col in packs:
        draw_beveled_rect(d, px0, py0, px1, py1, col, radius=20, ink_w=4)
        # Flap & leather straps
        draw_beveled_rect(d, px0 + 10, py0 + 8, px1 - 10, py0 + 48, blend_rgb(col, CREAM, 0.18)[:3], radius=12, ink_w=3)
        d.rectangle([px0 + 24, py0 + 14, px0 + 36, py1 - 10], fill=LEATHER, outline=INK, width=2)
        d.rectangle([px1 - 36, py0 + 14, px1 - 24, py1 - 10], fill=LEATHER, outline=INK, width=2)

    # Rolled striped bedroll tucked on far right
    draw_beveled_rect(d, x1 - 74, y0 + 24, x1 - 16, y1 - 20, OCHRE, radius=14, ink_w=4)
    d.line([(x1 - 72, y0 + 46), (x1 - 18, y0 + 46)], fill=LEATHER_DK, width=5)
    d.line([(x1 - 72, y1 - 44), (x1 - 18, y1 - 44)], fill=LEATHER_DK, width=5)

    # 3 pairs of muddy leather hiking boots peeking out along the front floor edge!
    for bx in [x0 + 48, x0 + 182, x0 + 318]:
        draw_beveled_rect(d, bx, y1 - 6, bx + 24, H - 14, LEATHER_DK, radius=9, ink_w=3)
        draw_beveled_rect(d, bx + 28, y1 - 2, bx + 52, H - 10, LEATHER, radius=9, ink_w=3)

    # Wooden walking staff resting diagonally across top-left edge
    d.line([(x0 + 12, y0 + 12), (x0 + 160, y0 + 24)], fill=PINE_LT, width=9)
    d.line([(x0 + 12, y0 + 12), (x0 + 160, y0 + 24)], fill=INK, width=2)

    return finish_prop(img, w, h, seed)


def make_hostel_floor_cushion_nook(w: int, h: int, seed: int) -> Image.Image:
    """Cozy round woven hostel hangout rug piled with patchwork cushions, tea tray & lantern."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    cx, cy = W / 2.0, H / 2.0

    # Concentric braided circular rug
    rings = [
        (194, TERRACOTTA),
        (170, OCHRE),
        (146, CREAM),
        (120, TEAL),
        (92, TERRACOTTA),
        (64, OCHRE),
    ]
    for r, col in rings:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*col, 255), outline=INK, width=4)

    # 4 plump mismatched patchwork floor cushions arranged in a friendly circle
    cushions = [
        (cx - 108, cy - 86, 56, 46, INDIGO, OCHRE),
        (cx + 106, cy - 82, 54, 48, SAGE, CREAM),
        (cx - 104, cy + 92, 54, 48, PLUM, TERRACOTTA),
        (cx + 108, cy + 88, 56, 46, TERRACOTTA, CREAM),
    ]
    for qx, qy, rx, ry, c1, c2 in cushions:
        draw_beveled_rect(d, int(qx - rx), int(qy - ry), int(qx + rx), int(qy + ry), c1, radius=24, ink_w=5)
        draw_beveled_rect(d, int(qx - rx * 0.58), int(qy - ry * 0.58), int(qx + rx * 0.58), int(qy + ry * 0.58), c2, radius=14, ink_w=3)
        draw_disc(d, qx, qy, 8, BRASS_HI, ink_w=2)

    # Center low round wooden tea tray with steaming cups, brass lantern & open travel journal
    draw_disc(d, cx, cy, 68, OAK, ink_w=5)
    draw_disc(d, cx, cy, 58, PINE, ink_w=3)
    draw_disc(d, cx - 24, cy - 16, 14, CERAMIC_BLUE, ink_w=3)
    draw_disc(d, cx + 22, cy + 18, 14, TERRACOTTA, ink_w=3)
    draw_disc(d, cx + 18, cy - 22, 16, BRASS_HI, ink_w=3)
    draw_beveled_rect(d, int(cx - 42), int(cy + 8), int(cx + 2), int(cy + 40), PAPER, radius=4, ink_w=2)

    return finish_prop(img, w, h, seed)


def make_hostel_awning_terracotta_stripe(w: int, h: int, seed: int) -> Image.Image:
    """Warm terracotta, ochre & cream scalloped hostel storefront awning with iron arms."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    x0, y0, x1, y1 = 22, 20, W - 22, H - 30
    # Wall mount timber rail along y = 0
    draw_beveled_rect(d, x0 - 4, y0 - 4, x1 + 4, y0 + 22, WALNUT, radius=6, ink_w=5)

    # Wrought-iron side support arms
    d.rectangle([x0 + 10, y0 + 14, x0 + 24, y1 - 8], fill=IRON_DK, outline=INK, width=3)
    d.rectangle([x1 - 24, y0 + 14, x1 - 10, y1 - 8], fill=IRON_DK, outline=INK, width=3)

    # 9 alternating warm hostel stripes (terracotta, cream, ochre)
    stripes = 9
    sw = (x1 - x0) / float(stripes)
    palette = [TERRACOTTA, CREAM, OCHRE]
    for i in range(stripes):
        sx0 = int(x0 + i * sw)
        sx1 = int(x0 + (i + 1) * sw)
        col = palette[i % len(palette)]
        # Sloped canopy panel
        d.rectangle([sx0, y0 + 18, sx1, y1 - 18], fill=(*col, 255), outline=INK, width=4)
        # Lighter highlight band near top ridge
        hi = blend_rgb(col, (255, 248, 232), 0.25)
        d.rectangle([sx0 + 4, y0 + 22, sx1 - 4, y0 + 54], fill=hi)
        # Scalloped valance fringe tab at front edge
        d.pieslice([sx0, y1 - 36, sx1, y1 + 12], 0, 180, fill=blend_rgb(col, (24, 16, 14), 0.16), outline=INK, width=4)

    # Crisp dark outline framing the canopy
    d.rectangle([x0, y0 + 18, x1, y1 - 18], outline=INK, width=5)

    return finish_prop(img, w, h, seed)


ASSET_SPECS = [
    ("hs_hostel_bunk_bed_colorable.png", "Double-Decker Hostel Bunk Bed (Colorable Quilt)", 208, 288, "dd_red",
     ["hostel", "dormitory", "bunk", "bed", "shared_living", "colorable", "harmony", "hostel_living"], make_hostel_bunk_bed_colorable),
    ("hs_hostel_bunk_curtain_colorable.png", "Privacy-Curtained Hostel Bunk Bed (Colorable)", 224, 288, "dd_red",
     ["hostel", "dormitory", "bunk", "curtain", "bed", "shared_living", "colorable", "harmony", "hostel_living"], make_hostel_bunk_curtain_colorable),
    ("hs_padlock_locker_bank.png", "Traveler Padlock Gear Locker Bank", 256, 112, "normal",
     ["hostel", "dormitory", "locker", "padlock", "backpack", "storage", "harmony", "hostel_living"], make_padlock_locker_bank),
    ("hs_hostel_reception_desk.png", "Hostel Check-In Reception Desk & Key Rack", 288, 144, "normal",
     ["hostel", "reception", "desk", "keys", "guestbook", "inn", "harmony", "hostel_living"], make_hostel_reception_desk),
    ("hs_communal_hostel_table.png", "Communal Hostel Dining & Traveler Map Table", 320, 160, "normal",
     ["hostel", "communal", "dining", "table", "benches", "teapot", "harmony", "hostel_living"], make_communal_hostel_table),
    ("hs_shared_kitchen_galley.png", "Shared Self-Catering Hostel Kitchen Galley", 304, 128, "normal",
     ["hostel", "kitchen", "galley", "stove", "sink", "communal", "harmony", "hostel_living"], make_shared_kitchen_galley),
    ("hs_shared_wash_trough_mirrors.png", "Communal Multi-Tap Hostel Wash Trough", 272, 112, "normal",
     ["hostel", "washroom", "sink", "trough", "mirrors", "bathroom", "harmony", "hostel_living"], make_shared_wash_trough_mirrors),
    ("hs_traveler_backpack_cubby.png", "Hostel Entryway Backpack & Hiking Boot Cubby", 240, 112, "normal",
     ["hostel", "backpack", "boots", "cubby", "luggage", "entryway", "harmony", "hostel_living"], make_traveler_backpack_cubby),
    ("hs_hostel_floor_cushion_nook.png", "Shared Hostel Floor Cushion & Tea Hangout Nook", 224, 224, "normal",
     ["hostel", "lounge", "cushions", "rug", "tea", "hangout", "harmony", "hostel_living"], make_hostel_floor_cushion_nook),
    ("hs_hostel_awning_terracotta_stripe.png", "Terracotta & Ochre Striped Hostel Entrance Awning", 288, 112, "normal",
     ["hostel", "awning", "storefront", "terracotta", "entrance", "harmony", "hostel_living"], make_hostel_awning_terracotta_stripe),
]


def main() -> None:
    manifest_entries = []
    qa_items: list[tuple[str, Image.Image]] = []
    for idx, (fname, title, w, h, draw_mode, tags, fn) in enumerate(ASSET_SPECS, start=1):
        img = fn(w, h, 9100 + idx * 41)
        out_path = OUT_DIR / fname
        img.save(out_path, "PNG")
        rel_path = f"props/hostel_living/{fname}"
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
        print(f"  [{idx:02d}/10] {rel_path} ({img.width}x{img.height}, {draw_mode})")

    total = upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    qa_path = SCRATCH_DIR / "qa_hostel_suite.png"
    save_qa_sheet(qa_items, qa_path, cols=5, cw=250, ch=190)
    print(f"\nGenerated 10 Shared-Living Hostel assets (manifest total={total}) + QA sheet: {qa_path}")


if __name__ == "__main__":
    main()

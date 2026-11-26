"""
Dice Chaos Compass — 10-Asset Painterly Overcrowded Multi-Family & Kids Suite ("The Crowded Nest")

Generates 10 bespoke clean-room CC0 Harmony assets in:
  `public/assets/modular-suite-cc0/props/crowded_family/`

Designed to complement our existing `hostel_living` colorable bunk beds, `post_housing`
single beds & kitchenettes, `community_kid_theater` props, `messy_apartment`, `bedroom_home`,
and `kitchen` libraries:
  - Crammed Sleeping & Nursery (3):
      cf_wooden_baby_crib, cf_crowded_parent_double_bed (dd_red colorable!),
      cf_kids_floor_sleeping_mats
  - Chaotic Family Living & Kids' Mess (5):
      cf_crowded_family_dining_table, cf_couch_pillow_fort, cf_overflowing_toy_chest,
      cf_scattered_toys_blocks_mess, cf_overflowing_family_laundry
  - Hallway Pram & Kid-Vehicle Traffic Jam (2):
      cf_wicker_baby_pram, cf_kids_tricycle_wagon

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

OUT_DIR = MOD_DIR / "props" / "crowded_family"
OUT_DIR.mkdir(parents=True, exist_ok=True)

WALNUT = (96, 64, 44)
OAK = (158, 116, 74)
PINE = (192, 154, 104)
PINE_LT = (212, 178, 128)
CREAM = (244, 236, 218)
LINEN = (230, 218, 194)
PAPER = (240, 232, 208)
CORAL = (206, 92, 78)
RED_TOY = (196, 56, 54)
SUNNY = (226, 182, 66)
SKY = (96, 156, 196)
TEAL = (58, 134, 132)
MINT = (132, 186, 146)
SAGE = (104, 140, 98)
LAVENDER = (146, 118, 168)
PLUM = (126, 72, 108)
ROSE = (212, 134, 146)
BRASS = (208, 166, 74)
BRASS_HI = (240, 208, 118)
WICKER = (182, 142, 86)
LEATHER = (134, 82, 48)
IRON = (60, 66, 74)
IRON_DK = (36, 40, 48)
BROWN_BEAR = (152, 102, 62)


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
    if r >= 8:
        d.arc(
            [cx - r * 0.66, cy - r * 0.66, cx + r * 0.66, cy + r * 0.66],
            195,
            310,
            fill=hi,
            width=max(2, int(r * 0.14)),
        )


def draw_teddy(d: ImageDraw.ImageDraw, cx: float, cy: float, s: float = 1.0, col=BROWN_BEAR) -> None:
    """Cute top-down plush teddy bear."""
    draw_disc(d, cx - 12 * s, cy - 12 * s, 7 * s, col, ink_w=2)
    draw_disc(d, cx + 12 * s, cy - 12 * s, 7 * s, col, ink_w=2)
    draw_disc(d, cx, cy + 12 * s, 15 * s, col, ink_w=3)
    draw_disc(d, cx, cy - 5 * s, 13 * s, col, ink_w=3)
    draw_disc(d, cx, cy - 1 * s, 6 * s, PINE_LT, ink_w=2)


def make_wooden_baby_crib(w: int, h: int, seed: int) -> Image.Image:
    """Slatted oak baby crib with pastel patchwork blanket, little pillow, mobile & plush bunny."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Outer crib rail box
    x0, y0, x1, y1 = 26, 26, W - 26, H - 26
    draw_beveled_rect(d, x0, y0, x1, y1, OAK, radius=12, ink_w=6)
    # Inner crib mattress recess
    mx0, my0, mx1, my1 = x0 + 24, y0 + 24, x1 - 24, y1 - 24
    draw_beveled_rect(d, mx0, my0, mx1, my1, CREAM, radius=14, ink_w=4)

    # Small plump baby pillow at top
    draw_beveled_rect(d, mx0 + 24, my0 + 18, mx1 - 24, my0 + 84, (248, 244, 232), radius=20, ink_w=3)
    # Pastel patchwork crib quilt (mint, sky, sunny, rose squares!)
    qy0 = my0 + 96
    draw_beveled_rect(d, mx0 + 10, qy0, mx1 - 10, my1 - 10, MINT, radius=12, ink_w=4)
    cols = [MINT, SKY, SUNNY, ROSE]
    qw = (mx1 - mx0 - 28) // 2
    qh = (my1 - 18 - qy0) // 3
    for r in range(3):
        for c in range(2):
            pc = cols[(r * 2 + c) % len(cols)]
            px0 = mx0 + 14 + c * qw
            py0 = qy0 + 6 + r * qh
            d.rectangle([px0, py0, px0 + qw - 2, py0 + qh - 2], fill=(*pc, 255), outline=INK_MID, width=2)

    # Plush little bunny/teddy tucked inside crib
    draw_teddy(d, mx0 + 54, my0 + 104, s=0.95, col=PINE_LT)

    # Top rail spindle dots all around crib rails (instantly reads as a slatted baby crib!)
    for sx in range(x0 + 36, x1 - 24, 34):
        draw_disc(d, sx, y0 + 12, 6, PINE_LT, ink_w=2)
        draw_disc(d, sx, y1 - 12, 6, PINE_LT, ink_w=2)
    for sy in range(y0 + 36, y1 - 24, 34):
        draw_disc(d, x0 + 12, sy, 6, PINE_LT, ink_w=2)
        draw_disc(d, x1 - 12, sy, 6, PINE_LT, ink_w=2)
    # 4 corner rounded crib posts
    for px, py in [(x0 + 10, y0 + 10), (x1 - 10, y0 + 10), (x0 + 10, y1 - 10), (x1 - 10, y1 - 10)]:
        draw_disc(d, px, py, 16, OAK, ink_w=4)
        draw_disc(d, px, py, 7, PINE_LT, ink_w=2)

    # Hanging crib mobile cross-arm + colorful wooden stars/balls over the upper half!
    mcx, mcy = int((x0 + x1) * 0.56), int(y0 + 146)
    d.line([(x1 - 12, mcy), (mcx, mcy)], fill=WALNUT, width=6)
    d.line([(mcx - 36, mcy - 28), (mcx + 36, mcy + 28)], fill=PINE, width=5)
    d.line([(mcx - 36, mcy + 28), (mcx + 36, mcy - 28)], fill=PINE, width=5)
    for dx, dy, col in [(-36, -28, SUNNY), (36, 28, SKY), (-36, 28, CORAL), (36, -28, MINT)]:
        draw_disc(d, mcx + dx, mcy + dy, 11, col, ink_w=3)
    draw_disc(d, mcx, mcy, 8, BRASS_HI, ink_w=2)

    return finish_prop(img, w, h, seed)


def make_crowded_parent_double_bed(w: int, h: int, seed: int) -> Image.Image:
    """Cramped parents' double bed with 3 pillows (kid snuck in!), dd_red quilt & teddy bear."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    x0, y0, x1, y1 = 28, 28, W - 28, H - 28
    draw_beveled_rect(d, x0, y0, x1, y1, WALNUT, radius=12, ink_w=6)
    mx0, my0, mx1, my1 = x0 + 22, y0 + 26, x1 - 22, y1 - 22
    draw_beveled_rect(d, mx0, my0, mx1, my1, CREAM, radius=14, ink_w=4)

    # TWO adult pillows + a smaller colorful kid pillow wedged right between them!
    mid = (mx0 + mx1) // 2
    draw_beveled_rect(d, mx0 + 14, my0 + 16, mid - 26, my0 + 108, (246, 240, 224), radius=20, ink_w=4)
    draw_beveled_rect(d, mid + 26, my0 + 16, mx1 - 14, my0 + 108, (246, 240, 224), radius=20, ink_w=4)
    # Little kid's sunny-yellow pillow wedged in the middle!
    draw_beveled_rect(d, mid - 40, my0 + 54, mid + 40, my0 + 124, SUNNY, radius=16, ink_w=3)

    # Turned-down sheet cuff + slightly askew dd_red colorable quilted comforter
    cuff_y = my0 + 126
    draw_beveled_rect(d, mx0 + 6, cuff_y, mx1 - 6, cuff_y + 42, LINEN, radius=10, ink_w=3)
    qy0 = cuff_y + 28
    draw_beveled_rect(d, mx0 + 4, qy0, mx1 - 4, my1 - 6, DD_RED_BASE, radius=16, ink_w=5)
    for y in range(qy0 + 30, my1 - 20, 44):
        d.line([(mx0 + 16, y), (mx1 - 16, y + 12)], fill=DD_RED_DEEP, width=3)
        d.line([(mx0 + 20, y - 5), (mx1 - 20, y + 7)], fill=DD_RED_HI, width=2)

    # Extra folded kid blanket draped messily at the foot + teddy bear & open picture book!
    draw_beveled_rect(d, mx0 + 18, my1 - 86, mid + 30, my1 - 18, SKY, radius=14, ink_w=4)
    draw_teddy(d, mid + 10, my0 + 148, s=1.05, col=BROWN_BEAR)
    draw_beveled_rect(d, mx1 - 102, my1 - 92, mx1 - 24, my1 - 28, PAPER, radius=5, ink_w=3)
    d.rectangle([mx1 - 92, my1 - 82, mx1 - 66, my1 - 42], fill=MINT, outline=INK, width=2)
    d.rectangle([mx1 - 58, my1 - 82, mx1 - 34, my1 - 42], fill=SUNNY, outline=INK, width=2)

    # 4 sturdy headboard/footboard corner knobs
    for px, py in [(x0 + 10, y0 + 10), (x1 - 10, y0 + 10), (x0 + 10, y1 - 10), (x1 - 10, y1 - 10)]:
        draw_disc(d, px, py, 16, OAK, ink_w=4)

    return finish_prop(img, w, h, seed)


def make_kids_floor_sleeping_mats(w: int, h: int, seed: int) -> Image.Image:
    """Two side-by-side kids' roll-out floor sleeping mats squeezed onto a living-room floor."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Left mat (Sky-blue striped quilt + sunny star pillow)
    m1 = (24, 34, W // 2 - 8, H - 28)
    draw_beveled_rect(d, *m1, CREAM, radius=16, ink_w=5)
    draw_beveled_rect(d, m1[0] + 18, m1[1] + 16, m1[2] - 18, m1[1] + 84, SUNNY, radius=18, ink_w=4)
    draw_beveled_rect(d, m1[0] + 10, m1[1] + 90, m1[2] - 10, m1[3] - 12, SKY, radius=14, ink_w=4)
    for sy in range(m1[1] + 114, m1[3] - 24, 32):
        d.line([(m1[0] + 16, sy), (m1[2] - 16, sy)], fill=CREAM, width=6)

    # Right mat (slightly crooked offset — Coral & Mint polka-dot quilt + lavender pillow + teddy!)
    m2 = (W // 2 + 8, 22, W - 24, H - 40)
    draw_beveled_rect(d, *m2, LINEN, radius=16, ink_w=5)
    draw_beveled_rect(d, m2[0] + 18, m2[1] + 16, m2[2] - 18, m2[1] + 82, LAVENDER, radius=18, ink_w=4)
    draw_beveled_rect(d, m2[0] + 10, m2[1] + 88, m2[2] - 10, m2[3] - 12, CORAL, radius=14, ink_w=4)
    # Fun colorful dots on the blanket
    for dx in range(m2[0] + 34, m2[2] - 22, 42):
        for dy in range(m2[1] + 116, m2[3] - 28, 42):
            draw_disc(d, dx, dy, 8, SUNNY if (dx + dy) % 2 == 0 else MINT, ink_w=2)

    # Plush bear & scattered kid sock between the mats
    draw_teddy(d, W // 2 + 46, m2[1] + 92, s=0.95, col=BROWN_BEAR)
    draw_beveled_rect(d, m1[2] - 18, H - 64, m1[2] + 24, H - 36, RED_TOY, radius=10, ink_w=3)

    return finish_prop(img, w, h, seed)


def make_crowded_family_dining_table(w: int, h: int, seed: int) -> Image.Image:
    """Crammed family table ringed with mismatched chairs + 2 baby high chairs, soup pot & crayons."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    rng = random.Random(seed)

    # 5 mismatched wooden chairs + 2 tiny baby high chairs jammed all around the table!
    # Top row: 2 adult chairs + 1 baby high chair (with tray!)
    for cx, col in [(112, OAK), (272, PINE)]:
        draw_beveled_rect(d, cx - 36, 18, cx + 36, 86, col, radius=10, ink_w=5)
    # Baby high chair #1 top-right (painted sky-blue with wooden tray!)
    draw_beveled_rect(d, 412, 22, 476, 94, SKY, radius=10, ink_w=5)
    draw_beveled_rect(d, 404, 72, 484, 102, PINE_LT, radius=8, ink_w=4)

    # Bottom row: 2 mismatched chairs + baby high chair #2 (painted mint!)
    for cx, col in [(184, WALNUT), (344, OAK)]:
        draw_beveled_rect(d, cx - 36, H - 86, cx + 36, H - 18, col, radius=10, ink_w=5)
    draw_beveled_rect(d, 444, H - 94, 508, H - 22, MINT, radius=10, ink_w=5)
    draw_beveled_rect(d, 436, H - 102, 516, H - 72, PINE_LT, radius=8, ink_w=4)

    # End chairs left & right
    draw_beveled_rect(d, 18, H // 2 - 36, 82, H // 2 + 36, PINE, radius=10, ink_w=5)

    # Main family kitchen table
    tx0, ty0, tx1, ty1 = 68, 76, W - 46, H - 76
    draw_beveled_rect(d, tx0, ty0, tx1, ty1, WALNUT, radius=12, ink_w=6)
    draw_wood_planks_box(d, tx0 + 12, ty0 + 12, tx1 - 12, ty1 - 12, OAK, rng, horizontal=True, n_planks=5)

    # Checkered gingham tablecloth patch in center
    draw_beveled_rect(d, tx0 + 54, ty0 + 20, tx1 - 54, ty1 - 20, CREAM, radius=8, ink_w=3)
    for gx in range(tx0 + 62, tx1 - 62, 34):
        d.line([(gx, ty0 + 24), (gx, ty1 - 24)], fill=ROSE, width=6)

    # Giant communal family soup pot + ladle in center
    draw_disc(d, (tx0 + tx1) // 2 - 18, H // 2, 34, (192, 108, 64), ink_w=4)
    draw_disc(d, (tx0 + tx1) // 2 - 18, H // 2, 24, SUNNY, ink_w=2)

    # 6 mismatched bowls/plates + crusty bread loaf + spilled milk puddle + scattered crayons!
    bowls = [
        (tx0 + 44, ty0 + 42, SKY),
        (tx0 + 132, ty0 + 38, CREAM),
        (tx1 - 64, ty0 + 44, MINT),
        (tx0 + 114, ty1 - 42, ROSE),
        (tx1 - 120, ty1 - 40, SUNNY),
        (tx1 - 44, ty1 - 44, CREAM),
    ]
    for bx, by, bc in bowls:
        draw_disc(d, bx, by, 18, bc, ink_w=3)
        draw_disc(d, bx, by, 11, (214, 152, 86), ink_w=2)

    # Bread loaf + kids' drawing paper & crayons on the left corner
    draw_beveled_rect(d, tx0 + 28, H // 2 - 18, tx0 + 82, H // 2 + 24, PAPER, radius=4, ink_w=2)
    for dy, cc in [(-10, RED_TOY), (0, SKY), (10, SUNNY)]:
        d.line([(tx0 + 36, H // 2 + dy), (tx0 + 68, H // 2 + dy + 4)], fill=cc, width=5)

    return finish_prop(img, w, h, seed)


def make_couch_pillow_fort(w: int, h: int, seed: int) -> Image.Image:
    """Family parlor sofa turned into a kids' blanket-and-pillow tent fort with glowing lantern!"""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Underlying worn family sofa frame along top half
    sx0, sy0, sx1, sy1 = 30, 26, W - 30, 174
    draw_beveled_rect(d, sx0, sy0, sx1, sy1, WALNUT, radius=14, ink_w=6)
    draw_beveled_rect(d, sx0 + 18, sy0 + 28, sx1 - 18, sy1 - 16, PLUM, radius=12, ink_w=4)

    # Two turned kitchen chairs anchoring the front corners of the blanket fort!
    draw_beveled_rect(d, 42, H - 102, 118, H - 28, OAK, radius=10, ink_w=5)
    draw_beveled_rect(d, W - 118, H - 102, W - 42, H - 28, OAK, radius=10, ink_w=5)

    # Giant colorful draped quilt roof tent spanning from sofa backrest out over the front chairs!
    poly = [(64, 48), (W - 64, 48), (W - 44, H - 46), (W // 2 + 30, H - 72), (W // 2 - 30, H - 72), (44, H - 46)]
    d.polygon(poly, fill=(*TEAL, 255), outline=INK)
    d.line(poly + [poly[0]], fill=INK, width=6)

    # Patchwork blanket strips draped over the tent roof (coral, sunny, sky, cream!)
    draw_beveled_rect(d, 96, 56, 224, H - 82, CORAL, radius=14, ink_w=4)
    draw_beveled_rect(d, 212, 54, 344, H - 84, SUNNY, radius=14, ink_w=4)
    draw_beveled_rect(d, 330, 58, W - 82, H - 74, SKY, radius=14, ink_w=4)
    # Quilt fabric folds / sagging tent peak lines
    d.line([(W // 2, 52), (W // 2, H - 80)], fill=INK_MID, width=4)
    d.line([(120, 60), (74, H - 56)], fill=INK_MID, width=3)
    d.line([(W - 120, 60), (W - 74, H - 56)], fill=INK_MID, width=3)

    # Cushions & glowing warm lantern peeking out the front entrance gap!
    draw_beveled_rect(d, W // 2 - 58, H - 86, W // 2 - 4, H - 36, ROSE, radius=14, ink_w=3)
    draw_beveled_rect(d, W // 2 + 8, H - 84, W // 2 + 64, H - 34, MINT, radius=14, ink_w=3)
    draw_disc(d, W // 2, H - 56, 15, BRASS_HI, ink_w=3)
    # Cardboard knight sword poking out the side!
    d.line([(W - 72, H - 108), (W - 20, H - 146)], fill=PINE_LT, width=9)
    d.line([(W - 60, H - 134), (W - 42, H - 110)], fill=OAK, width=7)

    return finish_prop(img, w, h, seed)


def make_overflowing_toy_chest(w: int, h: int, seed: int) -> Image.Image:
    """Painted pine toy chest propped open, spilling plush toys, blocks, train & books."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    rng = random.Random(seed)

    # Open hinged chest lid folded back along y = 0
    draw_beveled_rect(d, 34, 18, W - 34, 82, SKY, radius=8, ink_w=5)
    draw_beveled_rect(d, 48, 28, W - 48, 70, PINE_LT, radius=5, ink_w=3)

    # Main open toy box interior
    bx0, by0, bx1, by1 = 30, 76, W - 30, H - 56
    draw_beveled_rect(d, bx0, by0, bx1, by1, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, bx0 + 14, by0 + 12, bx1 - 14, by1 - 12, (74, 52, 38), radius=6, ink_w=3)

    # Overflowing jumble of toys inside AND spilling out the front!
    # Plush teddy bear peeking out left
    draw_teddy(d, bx0 + 68, by0 + 54, s=1.15, col=BROWN_BEAR)
    # Painted toy train car in center
    draw_beveled_rect(d, bx0 + 132, by0 + 30, bx0 + 210, by0 + 82, RED_TOY, radius=8, ink_w=4)
    draw_disc(d, bx0 + 152, by0 + 56, 12, SUNNY, ink_w=3)
    # Picture books & rag doll on right
    draw_beveled_rect(d, bx1 - 116, by0 + 26, bx1 - 36, by0 + 96, MINT, radius=6, ink_w=3)
    draw_beveled_rect(d, bx1 - 98, by0 + 44, bx1 - 24, by1 + 8, SUNNY, radius=6, ink_w=3)

    # Spilled colorful ABC wooden blocks & rubber ball on floor in front of chest!
    blocks = [(74, H - 46, RED_TOY), (126, H - 36, SUNNY), (186, H - 44, SKY), (254, H - 34, MINT), (316, H - 42, CORAL)]
    for x, y, c in blocks:
        draw_beveled_rect(d, x - 18, y - 18, x + 18, y + 18, c, radius=5, ink_w=3)
    draw_disc(d, 224, H - 38, 18, LAVENDER, ink_w=4)
    draw_disc(d, 224, H - 38, 7, SUNNY, ink_w=2)

    return finish_prop(img, w, h, seed)


def make_scattered_toys_blocks_mess(w: int, h: int, seed: int) -> Image.Image:
    """Explosive kid-floor scatter: ABC blocks, wooden toy train loop, crayons, drawings & drum."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Circular wooden toy train track ring in center-left
    tcx, tcy, tr = 176, 178, 92
    d.ellipse([tcx - tr, tcy - tr, tcx + tr, tcy + tr], outline=PINE, width=20)
    d.ellipse([tcx - tr - 10, tcy - tr - 10, tcx + tr + 10, tcy + tr + 10], outline=INK, width=4)
    d.ellipse([tcx - tr + 10, tcy - tr + 10, tcx + tr - 10, tcy + tr - 10], outline=INK, width=4)
    # Little red wooden locomotive & yellow car on the track
    draw_beveled_rect(d, tcx - 26, tcy - tr - 14, tcx + 26, tcy - tr + 14, RED_TOY, radius=6, ink_w=3)
    draw_beveled_rect(d, tcx + 42, tcy - tr + 10, tcx + 88, tcy - tr + 38, SUNNY, radius=6, ink_w=3)

    # Crayon drawing paper sheet on top-right
    draw_beveled_rect(d, 266, 38, 372, 134, PAPER, radius=5, ink_w=3)
    d.line([(282, 62), (324, 108), (356, 68)], fill=CORAL, width=5)
    d.ellipse([292, 52, 326, 86], outline=SKY, width=4)
    for dy, cc in [(0, RED_TOY), (12, SUNNY), (24, MINT)]:
        d.line([(338, 128 + dy), (376, 134 + dy)], fill=cc, width=6)

    # Scattered painted ABC blocks everywhere!
    blocks = [
        (56, 64, SKY), (104, 50, SUNNY), (234, 152, CORAL), (156, 188, MINT),
        (292, 224, RED_TOY), (344, 194, LAVENDER), (242, 304, SUNNY), (94, 308, MINT),
    ]
    for bx, by, bc in blocks:
        draw_beveled_rect(d, bx - 18, by - 18, bx + 18, by + 18, bc, radius=5, ink_w=3)

    # Toy tin drum & plush bear at bottom-right
    draw_disc(d, 336, 294, 30, RED_TOY, ink_w=4)
    draw_disc(d, 336, 294, 21, CREAM, ink_w=3)
    d.line([(312, 286), (360, 304)], fill=OAK, width=5)
    draw_teddy(d, 174, 296, s=0.95, col=BROWN_BEAR)

    return finish_prop(img, w, h, seed)


def make_overflowing_family_laundry(w: int, h: int, seed: int) -> Image.Image:
    """Twin wicker hampers buried under mountains of tiny kids' clothes, socks & folded blankets."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # Left round wicker basket overflowing with colorful kids' shirts
    draw_disc(d, 126, 168, 92, WICKER, ink_w=6)
    draw_disc(d, 126, 168, 76, blend_rgb(WICKER, OAK, 0.3)[:3], ink_w=3)
    for dx, dy, rx, ry, col in [
        (-28, -26, 46, 36, SKY), (26, -18, 44, 34, CORAL),
        (-16, 24, 48, 36, SUNNY), (24, 28, 42, 32, MINT), (0, 0, 36, 30, CREAM),
    ]:
        draw_beveled_rect(d, 126 + dx - rx, 168 + dy - ry, 126 + dx + rx, 168 + dy + ry, col, radius=20, ink_w=4)

    # Right rectangular laundry basket piled high with baby blankets & folded linens
    draw_beveled_rect(d, 224, 52, W - 26, H - 62, WICKER, radius=20, ink_w=6)
    for y, col in [(68, CREAM), (118, ROSE), (168, SKY), (218, LINEN)]:
        draw_beveled_rect(d, 244, y, W - 46, y + 54, col, radius=14, ink_w=4)

    # Spilled tiny socks & dropped shirt on the floor in front!
    draw_beveled_rect(d, 172, H - 72, 232, H - 30, LAVENDER, radius=14, ink_w=3)
    draw_beveled_rect(d, 268, H - 56, 308, H - 26, RED_TOY, radius=10, ink_w=3)
    draw_beveled_rect(d, 314, H - 48, 350, H - 22, SUNNY, radius=10, ink_w=3)

    return finish_prop(img, w, h, seed)


def make_wicker_baby_pram(w: int, h: int, seed: int) -> Image.Image:
    """Vintage top-down woven wicker baby carriage/stroller with spoked wheels, hood & blanket."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # 4 spoked thin iron carriage wheels protruding neatly on left & right sides
    for wy in [104, H - 122]:
        draw_beveled_rect(d, 22, wy - 38, 44, wy + 38, IRON, radius=6, ink_w=4)
        draw_beveled_rect(d, W - 44, wy - 38, W - 22, wy + 38, IRON, radius=6, ink_w=4)
        d.line([(44, wy), (W - 44, wy)], fill=IRON_DK, width=7)

    # Main oval-rounded woven wicker pram body
    bx0, by0, bx1, by1 = 48, 42, W - 48, H - 84
    draw_beveled_rect(d, bx0, by0, bx1, by1, WICKER, radius=56, ink_w=6)
    draw_beveled_rect(d, bx0 + 18, by0 + 18, bx1 - 18, by1 - 18, CREAM, radius=42, ink_w=4)

    # Cozy tucked pastel baby blanket & tiny pillow inside the pram
    draw_beveled_rect(d, bx0 + 30, by0 + 28, bx1 - 30, by0 + 96, (248, 244, 232), radius=24, ink_w=3)
    draw_beveled_rect(d, bx0 + 24, by0 + 86, bx1 - 24, by1 - 24, MINT, radius=30, ink_w=4)
    for sy in range(by0 + 112, by1 - 34, 28):
        d.line([(bx0 + 36, sy), (bx1 - 36, sy)], fill=CREAM, width=5)

    # Folded navy/indigo accordion fabric sun-hood at the back (bottom-ish before push handle)
    draw_beveled_rect(d, bx0 + 4, by1 - 72, bx1 - 4, by1 + 6, (56, 74, 112), radius=24, ink_w=5)
    d.line([(bx0 + 18, by1 - 44), (bx1 - 18, by1 - 44)], fill=BRASS, width=4)
    d.line([(bx0 + 18, by1 - 20), (bx1 - 18, by1 - 20)], fill=BRASS, width=4)

    # Curved brass & oak push-bar handle extending out the back (bottom) + hanging satchel
    d.line([(bx0 + 24, by1), (bx0 + 24, H - 36)], fill=IRON_DK, width=7)
    d.line([(bx1 - 24, by1), (bx1 - 24, H - 36)], fill=IRON_DK, width=7)
    draw_beveled_rect(d, bx0 + 14, H - 46, bx1 - 14, H - 24, PINE_LT, radius=10, ink_w=4)
    draw_beveled_rect(d, bx1 - 92, H - 64, bx1 - 34, H - 34, CORAL, radius=8, ink_w=3)

    return finish_prop(img, w, h, seed)


def make_kids_tricycle_wagon(w: int, h: int, seed: int) -> Image.Image:
    """Red painted wooden pull-wagon stuffed with toys beside a crooked little wooden tricycle."""
    img = new_hi(w, h)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size

    # LEFT: Red painted kids' pull-wagon packed with wooden blocks & stuffed bear!
    wx0, wy0, wx1, wy1 = 30, 56, 206, H - 42
    # 4 wagon wheels
    for wy in [wy0 + 28, wy1 - 28]:
        draw_beveled_rect(d, wx0 - 14, wy - 20, wx0 + 6, wy + 20, IRON_DK, radius=4, ink_w=3)
        draw_beveled_rect(d, wx1 - 6, wy - 20, wx1 + 14, wy + 20, IRON_DK, radius=4, ink_w=3)
    # Wagon pull-handle extending forward
    d.line([(118, wy0), (92, 22)], fill=IRON_DK, width=6)
    draw_beveled_rect(d, 72, 16, 114, 30, RED_TOY, radius=5, ink_w=3)
    # Red wagon bed
    draw_beveled_rect(d, wx0, wy0, wx1, wy1, RED_TOY, radius=10, ink_w=6)
    draw_beveled_rect(d, wx0 + 16, wy0 + 16, wx1 - 16, wy1 - 16, PINE, radius=6, ink_w=3)
    # Stuffed toys & blocks piled inside wagon
    draw_teddy(d, 96, wy0 + 74, s=1.0, col=BROWN_BEAR)
    draw_beveled_rect(d, 134, wy0 + 38, 174, wy0 + 78, SUNNY, radius=5, ink_w=3)
    draw_beveled_rect(d, 128, wy1 - 82, 176, wy1 - 34, SKY, radius=6, ink_w=3)
    draw_beveled_rect(d, 64, wy1 - 74, 108, wy1 - 32, MINT, radius=5, ink_w=3)

    # RIGHT: Little 3-wheeled wooden kids' tricycle parked crooked beside the wagon!
    tx, ty = 312, 168
    # Front wheel + wide handlebars
    draw_beveled_rect(d, tx - 14, ty - 102, tx + 14, ty - 42, IRON_DK, radius=8, ink_w=4)
    draw_beveled_rect(d, tx - 66, ty - 76, tx + 66, ty - 56, OAK, radius=8, ink_w=4)
    draw_beveled_rect(d, tx - 74, ty - 78, tx - 48, ty - 54, RED_TOY, radius=6, ink_w=3)
    draw_beveled_rect(d, tx + 48, ty - 78, tx + 74, ty - 54, RED_TOY, radius=6, ink_w=3)
    # Frame spine & wooden seat
    d.line([(tx, ty - 64), (tx, ty + 62)], fill=SUNNY, width=12)
    d.line([(tx, ty - 64), (tx, ty + 62)], fill=INK, width=3)
    draw_beveled_rect(d, tx - 26, ty - 12, tx + 26, ty + 38, LEATHER, radius=14, ink_w=4)
    # Rear axle & twin rear wheels
    d.line([(tx - 58, ty + 66), (tx + 58, ty + 66)], fill=IRON_DK, width=8)
    draw_beveled_rect(d, tx - 68, ty + 36, tx - 44, ty + 96, IRON_DK, radius=6, ink_w=4)
    draw_beveled_rect(d, tx + 44, ty + 36, tx + 68, ty + 96, IRON_DK, radius=6, ink_w=4)

    return finish_prop(img, w, h, seed)


ASSET_SPECS = [
    ("cf_wooden_baby_crib.png", "Slatted Oak Baby Crib & Hanging Mobile", 160, 208, "normal",
     ["family", "kids", "nursery", "crib", "baby", "bed", "harmony", "crowded_family"], make_wooden_baby_crib),
    ("cf_crowded_parent_double_bed.png", "Crowded Parents' Double Bed & Extra Kid Pillow (Colorable)", 256, 272, "dd_red",
     ["family", "kids", "bedroom", "bed", "double", "colorable", "harmony", "crowded_family"], make_crowded_parent_double_bed),
    ("cf_kids_floor_sleeping_mats.png", "Pair of Kids' Roll-Out Floor Sleeping Mats", 224, 208, "normal",
     ["family", "kids", "sleeping", "mats", "mattress", "bed", "harmony", "crowded_family"], make_kids_floor_sleeping_mats),
    ("cf_crowded_family_dining_table.png", "Crowded Multi-Family Dining Table & Baby High Chairs", 288, 208, "normal",
     ["family", "kids", "dining", "table", "highchair", "kitchen", "harmony", "crowded_family"], make_crowded_family_dining_table),
    ("cf_couch_pillow_fort.png", "Kids' Parlor Sofa Blanket & Pillow Tent Fort", 256, 192, "normal",
     ["family", "kids", "fort", "sofa", "couch", "blanket", "harmony", "crowded_family"], make_couch_pillow_fort),
    ("cf_overflowing_toy_chest.png", "Overflowing Painted Toy Chest & Spilled Blocks", 208, 144, "normal",
     ["family", "kids", "toys", "chest", "blocks", "nursery", "harmony", "crowded_family"], make_overflowing_toy_chest),
    ("cf_scattered_toys_blocks_mess.png", "Scattered Kids' Wooden Blocks, Train Track & Crayons", 208, 192, "normal",
     ["family", "kids", "toys", "blocks", "train", "mess", "harmony", "crowded_family"], make_scattered_toys_blocks_mess),
    ("cf_overflowing_family_laundry.png", "Overflowing Multi-Family Laundry Basket Mountain", 208, 176, "normal",
     ["family", "kids", "laundry", "basket", "clothes", "mess", "harmony", "crowded_family"], make_overflowing_family_laundry),
    ("cf_wicker_baby_pram.png", "Vintage Woven Wicker Baby Carriage Pram", 160, 224, "normal",
     ["family", "kids", "baby", "pram", "stroller", "hallway", "harmony", "crowded_family"], make_wicker_baby_pram),
    ("cf_kids_tricycle_wagon.png", "Kids' Red Toy Pull-Wagon & Wooden Tricycle", 208, 160, "normal",
     ["family", "kids", "tricycle", "wagon", "toys", "hallway", "harmony", "crowded_family"], make_kids_tricycle_wagon),
]


def main() -> None:
    manifest_entries = []
    qa_items: list[tuple[str, Image.Image]] = []
    for idx, (fname, title, w, h, draw_mode, tags, fn) in enumerate(ASSET_SPECS, start=1):
        img = fn(w, h, 9600 + idx * 43)
        out_path = OUT_DIR / fname
        img.save(out_path, "PNG")
        rel_path = f"props/crowded_family/{fname}"
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
    qa_path = SCRATCH_DIR / "qa_crowded_family_suite.png"
    save_qa_sheet(qa_items, qa_path, cols=5, cw=250, ch=190)
    print(f"\nGenerated 10 Overcrowded Multi-Family assets (manifest total={total}) + QA sheet: {qa_path}")


if __name__ == "__main__":
    main()

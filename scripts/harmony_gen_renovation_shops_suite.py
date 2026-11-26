"""
Dice Chaos Compass — 12-Asset Renovation Flats, Corner Shops & Kid Theater Expansion Suite

Generates 12 museum-grade 2x-supersampled Studio Harmony CC0 assets (`props/renovation_shops/`)
for the 3-story Chevron Corner Building (Alte Kronen-Apotheke + Zahnrad & Puppe Clockwork
Toymaker on 1F, two full-floor family apartments under active renovation on 2F & 3F, and
the expanded Cardboard Crown Kid Theater north plaza):
  1. `ren_paint_drop_cloth_splattered.png`         (240x192) — Canvas painter's drop cloth w/ paint drips & roller
  2. `ren_sheet_draped_furniture_sofa.png`         (224x128) — Dust-sheet-draped parlor sofa tied w/ twine
  3. `ren_sheet_draped_armchair_boxes.png`         (160x144) — Sheet-draped reading armchair & taped moving box
  4. `ren_wallpaper_pasting_trestle.png`           (256x112) — Wallpaper pasting trestle w/ unrolled floral roll & pail
  5. `ren_contractor_blueprint_sawhorse_table.png` (240x128) — Sawhorse plywood table w/ cyan floorplan blueprint & mug
  6. `ren_plaster_mortar_tub_trowels.png`          (176x144) — Gypsum plaster mixing trough, steel trowels & sacks
  7. `ren_uninstalled_porcelain_tub_pipes.png`     (224x144) — Crated enamel clawfoot tub w/ copper pipes & wrench
  8. `ren_apothecary_drawer_wall_cabinet.png`      (256x96)  — Walnut apothecary drawer wall w/ cobalt jars & elixirs
  9. `ren_puppet_toymaker_workbench.png`           (240x128) — Toymaker marionette carving bench w/ gears & paint pots
 10. `ren_apothecary_toymaker_awning_colorable.png`(240x96, dd_red) — Colorable striped Berlin shopfront awning
 11. `ren_kid_theater_marquee_chalk_kiosk.png`     (208x112) — Kid-built theater showbill kiosk, chalk bucket & pinwheels
 12. `ren_folded_step_ladder_paint_can.png`        (160x144) — Open wooden A-frame painter's stepladder & paint tin

Strict Studio Harmony standard: #1E1816 charcoal ink, warm directional bevel highlights,
painterly gouache texture, realistic micro-details, zero flat geometric fills, zero white halos.
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

OUT_DIR = MOD_DIR / "props" / "renovation_shops"
OUT_DIR.mkdir(parents=True, exist_ok=True)
QA_PATH = SCRATCH_DIR / "qa_renovation_shops_suite.png"

# Rich Berlin-Magipunk Studio Harmony palette
MAHOGANY = (92, 48, 34)
WALNUT = (118, 74, 48)
OAK = (164, 118, 74)
PINE = (204, 168, 118)
PINE_LIGHT = (224, 194, 146)
CANVAS = (228, 218, 196)
CANVAS_SHADE = (192, 180, 156)
CANVAS_CREAM = (242, 234, 214)
PLASTER = (238, 234, 224)
PLASTER_SHADE = (206, 200, 188)
PORCELAIN = (244, 242, 236)
BRASS = (212, 168, 72)
COPPER = (196, 112, 68)
IRON = (66, 70, 78)
STEEL = (152, 162, 174)
BLUEPRINT = (42, 102, 148)
BLUEPRINT_HI = (206, 236, 250)
SAGE = (116, 152, 118)
EMERALD = (48, 124, 92)
COBALT = (48, 86, 146)
OCHRE = (212, 156, 62)
CRIMSON = (176, 56, 52)
AMBER = (228, 148, 52)
CARDBOARD = (182, 142, 96)
KRAFT_DARK = (146, 108, 68)


def wood_box(
    d: ImageDraw.ImageDraw,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    col: tuple[int, int, int],
    n_planks: int = 4,
    horizontal: bool = True,
    ink_w: int = 6,
    seed: int = 7600,
) -> None:
    draw_wood_planks_box(d, x0, y0, x1, y1, col, random.Random(seed), horizontal=horizontal, n_planks=n_planks, ink_w=ink_w)


def finish_prop(im: Image.Image, w: int, h: int, seed: int) -> Image.Image:
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.4)


def draw_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    col: tuple[int, int, int],
    ink_w: int = 4,
    alpha: int = 255,
) -> None:
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*col, alpha), outline=(*INK[:3], alpha) if ink_w > 0 else None, width=ink_w)
    if r >= 10:
        hi = blend_rgb(col, (255, 248, 232), 0.34)
        d.ellipse([cx - r * 0.56, cy - r * 0.60, cx + r * 0.16, cy - r * 0.04], fill=(*hi[:3], min(alpha, 155)))


def add_paint_splatters(
    d: ImageDraw.ImageDraw,
    pts: list[tuple[float, float, float, tuple[int, int, int]]],
) -> None:
    for sx, sy, sr, col in pts:
        d.ellipse([sx - sr, sy - sr * 0.85, sx + sr, sy + sr * 0.85], fill=(*col[:3], 225), outline=(*INK_MID[:3], 120), width=1)
        hi = blend_rgb(col, (255, 255, 248), 0.35)
        d.ellipse([sx - sr * 0.45, sy - sr * 0.45, sx + sr * 0.12, sy + sr * 0.05], fill=(*hi[:3], 160))


# =============================================================================
# 1. PAINT-SPLATTERED CANVAS DROP CLOTH & ROLLER (240x192)
# =============================================================================
def gen_ren_paint_drop_cloth_splattered() -> Image.Image:
    w, h = 240, 192
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Organic rumpled cloth silhouette
    poly = [
        (36, 34), (156, 24), (298, 28), (434, 42),
        (456, 128), (446, 244), (430, 346), (314, 358),
        (178, 348), (52, 356), (26, 256), (32, 134),
    ]
    # Soft drop shadow underneath cloth
    sh_poly = [(x + 8, y + 10) for (x, y) in poly]
    d.polygon(sh_poly, fill=(24, 18, 16, 85))
    d.polygon(poly, fill=(*CANVAS, 248), outline=INK, width=5)

    # Soft painterly draped cloth crease folds (blurred organically inside cloth silhouette!)
    fold_layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    fd = ImageDraw.Draw(fold_layer, "RGBA")
    folds = [
        [(54, 62), (218, 134), (196, 152), (44, 88)],
        [(224, 52), (416, 158), (394, 178), (206, 72)],
        [(56, 212), (242, 316), (220, 334), (44, 238)],
        [(262, 198), (422, 292), (400, 312), (244, 218)],
    ]
    for fp in folds:
        fd.polygon(fp, fill=(*CANVAS_SHADE, 145))
        fd.line([fp[0], fp[1]], fill=(254, 248, 236, 165), width=6)
    fold_layer = fold_layer.filter(ImageFilter.GaussianBlur(7.5))
    # Mask blurred folds cleanly to the cloth polygon
    cloth_mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(cloth_mask).polygon(poly, fill=255)
    im.paste(fold_layer, (0, 0), mask=Image.composite(fold_layer.split()[3], Image.new("L", im.size, 0), cloth_mask))
    d = ImageDraw.Draw(im, "RGBA")
    d.polygon(poly, outline=INK, width=5)

    # Subtle woven canvas cross-hatch stitch hem
    for i in range(len(poly)):
        p1 = poly[i]
        p2 = poly[(i + 1) % len(poly)]
        mx1 = p1[0] + (W / 2 - p1[0]) * 0.06
        my1 = p1[1] + (H / 2 - p1[1]) * 0.06
        mx2 = p2[0] + (W / 2 - p2[0]) * 0.06
        my2 = p2[1] + (H / 2 - p2[1]) * 0.06
        d.line([(mx1, my1), (mx2, my2)], fill=(*CANVAS_SHADE, 180), width=2)

    # Rich painterly cream, sage-green & warm ochre paint splatters!
    add_paint_splatters(d, [
        (124, 118, 22, SAGE), (154, 102, 11, SAGE), (104, 144, 8, SAGE),
        (294, 112, 26, PLASTER), (326, 98, 13, PLASTER), (268, 138, 10, PLASTER),
        (196, 248, 24, OCHRE), (228, 262, 11, OCHRE), (170, 272, 9, OCHRE),
        (348, 256, 18, SAGE), (374, 242, 8, SAGE), (138, 292, 14, PLASTER),
    ])

    # Resting paint roller w/ sage-wet nap & wooden stir stick
    # Roller steel wire frame & wooden handle
    d.line([(322, 206), (366, 250)], fill=IRON, width=6)
    draw_beveled_rect(d, 356, 240, 398, 286, WALNUT, radius=10, ink_w=4)
    draw_beveled_rect(d, 272, 162, 344, 204, SAGE, radius=12, ink_w=4)
    d.line([(280, 174), (336, 174)], fill=(208, 232, 204, 185), width=5)

    # Wooden paint stir stick dipped in cream whitewash
    d.polygon([(82, 198), (168, 178), (174, 196), (88, 216)], fill=(*PINE, 255), outline=INK, width=3)
    d.polygon([(140, 184), (168, 178), (174, 196), (146, 202)], fill=(*PLASTER, 255), outline=INK_MID, width=2)

    return finish_prop(im, w, h, seed=7601)


# =============================================================================
# 2. DUST-SHEET-DRAPED PARLOR SOFA (224x128)
# =============================================================================
def gen_ren_sheet_draped_furniture_sofa() -> Image.Image:
    w, h = 224, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Soft floor shadow & wooden sofa feet peeking just barely at front corners
    d.rounded_rectangle([26, 26, W - 18, H - 18], radius=28, fill=(24, 18, 16, 85))
    for fx in [44, W - 64]:
        draw_beveled_rect(d, fx, H - 40, fx + 22, H - 22, WALNUT, radius=6, ink_w=3)

    # Sculpted draped off-white dust sheet covering backrest, rolled arms & seat cushions
    sheet_poly = [
        (30, 34), (112, 22), (224, 26), (336, 22), (W - 30, 34),
        (W - 18, 118), (W - 24, H - 30), (350, H - 22), (224, H - 28), (98, H - 22), (24, H - 30), (18, 118),
    ]
    d.polygon(sheet_poly, fill=(*CANVAS_CREAM, 255), outline=INK, width=6)

    # Sculpted interior drape ridges showing sofa backrest & rolled arms underneath the sheet
    draw_beveled_rect(d, 40, 34, W - 40, 96, CANVAS, radius=20, ink_w=3)
    draw_beveled_rect(d, 30, 62, 86, H - 38, CANVAS, radius=18, ink_w=3)
    draw_beveled_rect(d, W - 86, 62, W - 30, H - 38, CANVAS, radius=18, ink_w=3)
    # Soft cushion dips & diagonal fabric creases
    for cx in [156, 292]:
        d.line([(cx, 96), (cx + 12, H - 42)], fill=(*CANVAS_SHADE, 200), width=5)
        d.line([(cx - 6, 98), (cx + 4, H - 44)], fill=(254, 250, 240, 180), width=3)
    # Twine rope cinching the dust sheet securely around the center & ends!
    for tx in [114, W - 114]:
        d.line([(tx, 30), (tx, H - 28)], fill=(*KRAFT_DARK, 235), width=4)
        draw_disc(d, tx, H * 0.56, 7, CARDBOARD, ink_w=2)

    # Faint renovation plaster dust marks
    add_paint_splatters(d, [(186, 154, 14, PLASTER_SHADE), (258, 174, 10, CANVAS_SHADE)])
    return finish_prop(im, w, h, seed=7602)


# =============================================================================
# 3. SHEET-DRAPED ARMCHAIR & TAPED MOVING CRATE (160x144)
# =============================================================================
def gen_ren_sheet_draped_armchair_boxes() -> Image.Image:
    w, h = 160, 144
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Left: Draped parlor armchair under cream dust sheet
    d.rounded_rectangle([24, 34, 198, H - 26], radius=24, fill=(24, 18, 16, 80))
    chair_poly = [
        (24, 40), (108, 28), (190, 42), (198, 142), (186, H - 34), (106, H - 28), (28, H - 36), (18, 140),
    ]
    d.polygon(chair_poly, fill=(*CANVAS_CREAM, 255), outline=INK, width=6)
    draw_beveled_rect(d, 38, 44, 176, 98, CANVAS, radius=16, ink_w=3)
    draw_beveled_rect(d, 30, 82, 68, H - 46, CANVAS, radius=14, ink_w=3)
    draw_beveled_rect(d, 148, 82, 186, H - 46, CANVAS, radius=14, ink_w=3)
    d.line([(72, 106), (144, 174)], fill=(*CANVAS_SHADE, 185), width=5)
    d.line([(142, 108), (78, 192)], fill=(*CANVAS_SHADE, 155), width=4)

    # Right: Stacked kraft cardboard moving box w/ gummed paper tape & twine!
    draw_beveled_rect(d, 206, 84, W - 20, H - 26, CARDBOARD, radius=8, ink_w=5)
    # Center box-flap seam & packing tape strip
    d.line([(253, 88), (253, H - 30)], fill=INK_MID, width=3)
    d.rectangle([244, 88, 262, H - 30], fill=(*PINE_LIGHT, 210), outline=INK_MID, width=2)
    # Handwritten shipping label patch on upper right corner
    draw_beveled_rect(d, 214, 98, 240, 144, PLASTER, radius=3, ink_w=2)
    for ly in [108, 118, 128]:
        d.line([(218, ly), (236, ly)], fill=INK_MID, width=2)
    # Small second parcel box tilted slightly on top-right
    draw_beveled_rect(d, 212, 24, W - 28, 76, KRAFT_DARK, radius=6, ink_w=4)
    d.line([(214, 50), (W - 30, 50)], fill=(*CANVAS, 215), width=4)
    return finish_prop(im, w, h, seed=7603)


# =============================================================================
# 4. WALLPAPER PASTING TRESTLE TABLE & FLORAL ROLLS (256x112)
# =============================================================================
def gen_ren_wallpaper_pasting_trestle() -> Image.Image:
    w, h = 256, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Folding trestle wood table top (raw pine boards)
    wood_box(d, 20, 26, W - 20, H - 26, PINE, n_planks=3, horizontal=True, ink_w=6, seed=7604)

    # Unrolled vintage sage-green & cream botanical striped wallpaper strip spanning the trestle!
    draw_beveled_rect(d, 44, 44, 344, H - 44, CANVAS_CREAM, radius=4, ink_w=4)
    # Wallpaper vertical botanical stripes + tiny gold diamond motifs
    for wx in range(62, 336, 26):
        d.rectangle([wx, 48, wx + 10, H - 48], fill=(*SAGE, 200))
        for wy in [68, 112, 156]:
            if wy < H - 56:
                d.polygon([(wx + 5, wy - 6), (wx + 10, wy), (wx + 5, wy + 6), (wx, wy)], fill=(*OCHRE, 220))
    # Curled wallpaper tube roll at the left edge!
    draw_beveled_rect(d, 30, 38, 66, H - 38, SAGE, radius=14, ink_w=4)
    d.line([(46, 44), (46, H - 44)], fill=(214, 236, 210, 175), width=5)

    # Galvanized tin wallpaper-paste pail + wide hog-bristle paste brush + brass shears on right!
    draw_disc(d, W - 98, 86, 34, STEEL, ink_w=4)
    draw_disc(d, W - 98, 86, 24, PLASTER, ink_w=2)
    # Wide flat pasting brush resting diagonally across pail rim
    d.polygon([(W - 142, 128), (W - 76, 108), (W - 68, 132), (W - 134, 152)], fill=(*WALNUT, 255), outline=INK, width=3)
    d.polygon([(W - 154, 132), (W - 134, 124), (W - 126, 152), (W - 146, 160)], fill=(*PLASTER, 255), outline=INK, width=3)
    # Brass wallpaper shears beside strip
    d.line([(364, 164), (424, 152)], fill=STEEL, width=5)
    d.line([(364, 154), (424, 172)], fill=STEEL, width=5)
    draw_disc(d, 358, 156, 8, BRASS, ink_w=2)
    draw_disc(d, 358, 170, 8, BRASS, ink_w=2)

    return finish_prop(im, w, h, seed=7604)


# =============================================================================
# 5. CONTRACTOR'S BLUEPRINT SAWHORSE TABLE (240x128)
# =============================================================================
def gen_ren_contractor_blueprint_sawhorse_table() -> Image.Image:
    w, h = 240, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Twin projecting dark-oak sawhorse crossbars peeking cleanly from top & bottom ends!
    for sx in [58, W - 82]:
        draw_beveled_rect(d, sx, 16, sx + 24, H - 16, WALNUT, radius=5, ink_w=4)

    # Raw plywood / plank work slab resting on top of the sawhorses
    wood_box(d, 26, 30, W - 26, H - 30, PINE, n_planks=4, horizontal=True, ink_w=6, seed=7605)

    # Large unrolled Prussian-blue architectural renovation floorplan blueprint!
    draw_beveled_rect(d, 56, 46, 336, H - 46, BLUEPRINT, radius=4, ink_w=4)
    # Crisp white technical grid & chevron L-floorplan drawing on the blueprint!
    for gx in range(74, 330, 26):
        d.line([(gx, 52), (gx, H - 52)], fill=(*BLUEPRINT_HI, 58), width=1)
    for gy in range(62, H - 52, 24):
        d.line([(62, gy), (330, gy)], fill=(*BLUEPRINT_HI, 58), width=1)
    # Chevron apartment outline drawn right onto the blueprint!
    bp_chevron = [(110, 172), (196, 82), (282, 168), (248, 192), (196, 138), (144, 192)]
    d.polygon(bp_chevron, outline=(*BLUEPRINT_HI, 235), width=4)
    d.line([(170, 110), (222, 110)], fill=(*BLUEPRINT_HI, 210), width=3)
    d.rectangle([282, 62, 324, 108], outline=(*BLUEPRINT_HI, 195), width=2)
    for ty in [72, 82, 92]:
        d.line([(288, ty), (318, ty)], fill=(*BLUEPRINT_HI, 180), width=2)

    # Red clay bricks weighting blueprint corners + brass calipers + red carpenter's pencil + coffee mug!
    draw_beveled_rect(d, 48, 42, 88, 66, CRIMSON, radius=4, ink_w=3)
    draw_beveled_rect(d, 308, H - 72, 344, H - 46, CRIMSON, radius=4, ink_w=3)
    # Carpenter's red pencil
    d.line([(364, 62), (424, 118)], fill=CRIMSON, width=8)
    d.line([(364, 62), (424, 118)], fill=INK, width=2)
    # Enamel tin coffee mug on right end
    draw_disc(d, W - 74, H - 82, 24, CANVAS_CREAM, ink_w=4)
    draw_disc(d, W - 74, H - 82, 16, MAHOGANY, ink_w=2)
    # Brass triangle square ruler
    d.polygon([(358, 134), (410, 134), (358, 186)], fill=(*BRASS, 215), outline=INK, width=3)

    return finish_prop(im, w, h, seed=7605)


# =============================================================================
# 6. GYPSUM PLASTER MORTAR TUB, TROWELS & SACKS (176x144)
# =============================================================================
def gen_ren_plaster_mortar_tub_trowels() -> Image.Image:
    w, h = 176, 144
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Dusty gypsum powder ring splashed softly on floorboards underneath
    d.ellipse([22, 26, W - 22, H - 22], fill=(*PLASTER, 78))
    add_paint_splatters(d, [(54, 52, 14, PLASTER), (288, 224, 16, PLASTER), (84, 246, 11, PLASTER)])

    # Timber-and-iron plaster mixing trough (left/center)
    draw_beveled_rect(d, 34, 42, 224, H - 46, WALNUT, radius=12, ink_w=6)
    draw_beveled_rect(d, 48, 56, 210, H - 60, PLASTER, radius=8, ink_w=4)
    # Swirled wet gypsum plaster ripples inside trough
    for r in [52, 34, 18]:
        d.arc([129 - r, H / 2 - 4 - r * 0.8, 129 + r, H / 2 - 4 + r * 0.8], start=15, end=290, fill=(*PLASTER_SHADE, 220), width=4)

    # Two crossed steel masonry trowels resting across rim!
    d.polygon([(92, 92), (168, 134), (118, 168)], fill=(*STEEL, 255), outline=INK, width=4)
    d.line([(144, 148), (192, 182)], fill=WALNUT, width=10)
    d.line([(144, 148), (192, 182)], fill=INK, width=2)

    # Plump stacked paper whitewash / gypsum plaster sacks on right!
    draw_beveled_rect(d, 232, 46, W - 26, 152, CARDBOARD, radius=18, ink_w=5)
    d.rectangle([248, 72, W - 42, 124], fill=(*PLASTER, 210), outline=INK_MID, width=2)
    d.line([(256, 90), (W - 50, 90)], fill=CRIMSON, width=4)
    d.line([(256, 106), (W - 56, 106)], fill=INK_MID, width=3)

    draw_beveled_rect(d, 238, 158, W - 30, H - 34, CANVAS, radius=16, ink_w=5)
    d.line([(250, 198), (W - 42, 198)], fill=COBALT, width=4)

    return finish_prop(im, w, h, seed=7606)


# =============================================================================
# 7. UNINSTALLED CRATED ENAMEL CLAWFOOT TUB & COPPER PIPES (224x144)
# =============================================================================
def gen_ren_uninstalled_porcelain_tub_pipes() -> Image.Image:
    w, h = 224, 144
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Wooden shipping cradle slats beneath the new porcelain tub
    draw_beveled_rect(d, 24, 24, 330, H - 30, PINE, radius=10, ink_w=5)
    for sx in [74, 174, 274]:
        d.line([(sx, 28), (sx, H - 34)], fill=INK_MID, width=3)

    # Glossy ivory enamel clawfoot bathtub seated inside slats
    d.rounded_rectangle([38, 38, 316, H - 44], radius=72, fill=(*PORCELAIN, 255), outline=INK, width=6)
    d.rounded_rectangle([62, 60, 292, H - 66], radius=54, fill=(224, 232, 236, 255), outline=INK_MID, width=4)
    # Gleaming porcelain specular highlights & brass drain hole
    d.arc([70, 68, 284, H - 74], start=190, end=330, fill=(255, 255, 255, 215), width=7)
    draw_disc(d, 106, H / 2 - 3, 12, BRASS, ink_w=3)
    draw_disc(d, 106, H / 2 - 3, 5, IRON, ink_w=1)
    # Protective timber cross-strap still nailed across middle of the tub!
    draw_beveled_rect(d, 162, 22, 192, H - 28, OAK, radius=4, ink_w=4)

    # Right side: Coiled gleaming copper supply pipes & heavy brass pipe wrench!
    for r in [44, 34, 24]:
        d.ellipse([W - 72 - r, 94 - r, W - 72 + r, 94 + r], outline=INK, width=9)
        d.ellipse([W - 72 - r, 94 - r, W - 72 + r, 94 + r], outline=COPPER, width=5)
    # Pipe wrench lying diagonally below coils
    d.line([(W - 104, H - 94), (W - 36, H - 38)], fill=CRIMSON, width=12)
    d.line([(W - 104, H - 94), (W - 36, H - 38)], fill=INK, width=2)
    draw_beveled_rect(d, W - 118, H - 112, W - 82, H - 78, STEEL, radius=6, ink_w=4)

    return finish_prop(im, w, h, seed=7607)


# =============================================================================
# 8. WALNUT APOTHECARY DRAWER WALL CABINET & ELIXIRS (256x96)
# =============================================================================
def gen_ren_apothecary_drawer_wall_cabinet() -> Image.Image:
    w, h = 256, 96
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Rich dark walnut Gründerzeit apothecary cabinet body
    wood_box(d, 18, 20, W - 18, H - 20, MAHOGANY, n_planks=3, horizontal=True, ink_w=6, seed=7608)
    draw_beveled_rect(d, 28, 28, W - 28, H - 46, WALNUT, radius=6, ink_w=4)

    # Row of top-ledge apothecary cobalt ceramic jars, glowing emerald/amber potion flasks & brass scale!
    jars: list[tuple[float, float, float, tuple[int, int, int]]] = [
        (64, 72, 18, COBALT), (108, 66, 15, COBALT), (148, 74, 17, EMERALD),
        (194, 68, 14, AMBER), (236, 72, 18, PORCELAIN), (284, 70, 16, COBALT),
        (332, 74, 17, CRIMSON), (376, 68, 15, EMERALD), (420, 72, 18, AMBER),
        (456, 70, 14, COBALT),
    ]
    for jx, jy, jr, col in jars:
        draw_disc(d, jx, jy, jr, col, ink_w=4)
        # Brass/cork stopper cap in center
        draw_disc(d, jx, jy, max(5, jr * 0.42), BRASS if col != PORCELAIN else OAK, ink_w=2)

    # Front cornice edge showing protruding brass-pulled herb-drawer fronts along bottom lip!
    draw_beveled_rect(d, 24, H - 48, W - 24, H - 22, OAK, radius=4, ink_w=4)
    for dx in range(44, W - 44, 48):
        d.line([(dx, H - 46), (dx, H - 24)], fill=INK_MID, width=3)
        draw_beveled_rect(d, dx + 12, H - 36, dx + 36, H - 24, BRASS, radius=3, ink_w=2)

    return finish_prop(im, w, h, seed=7608)


# =============================================================================
# 9. CLOCKWORK TOYMAKER & MARIONETTE CARVING BENCH (240x128)
# =============================================================================
def gen_ren_puppet_toymaker_workbench() -> Image.Image:
    w, h = 240, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Warm solid oak toymaker's workbench slab w/ rear tool rail
    wood_box(d, 20, 24, W - 20, H - 24, OAK, n_planks=4, horizontal=True, ink_w=6, seed=7609)
    draw_beveled_rect(d, 24, 24, W - 24, 54, WALNUT, radius=6, ink_w=4)

    # Left: Half-painted wooden Knight Marionette puppet + wooden X-control cross-bar & strings!
    # Puppet painted blue tunic torso, carved round head w/ gold crown, articulated wood limbs
    draw_disc(d, 108, 92, 18, PINE_LIGHT, ink_w=4)
    draw_beveled_rect(d, 96, 68, 120, 82, BRASS, radius=3, ink_w=3)  # tiny crown
    draw_beveled_rect(d, 86, 110, 130, 166, COBALT, radius=10, ink_w=4)
    draw_beveled_rect(d, 64, 116, 86, 152, PINE, radius=6, ink_w=3)   # left arm
    draw_beveled_rect(d, 130, 116, 152, 152, PINE, radius=6, ink_w=3) # right arm
    draw_beveled_rect(d, 90, 166, 106, 206, CRIMSON, radius=6, ink_w=3)
    draw_beveled_rect(d, 110, 166, 126, 206, CRIMSON, radius=6, ink_w=3)
    # Wooden marionette cross-bar + fine white control strings
    d.line([(166, 140), (214, 188)], fill=WALNUT, width=8)
    d.line([(166, 188), (214, 140)], fill=WALNUT, width=8)
    for sx, sy in [(108, 92), (76, 136), (142, 136)]:
        d.line([(sx, sy), (190, 164)], fill=(246, 240, 224, 175), width=2)

    # Center-right: Gleaming brass clockwork gears & coiled mainspring!
    for gx, gy, gr, col in [(262, 118, 28, BRASS), (308, 148, 22, COPPER), (274, 176, 16, BRASS)]:
        # Gear teeth
        for k in range(10):
            ang = k * math.pi * 2 / 10
            tx = gx + math.cos(ang) * (gr + 6)
            ty = gy + math.sin(ang) * (gr + 6)
            d.line([(gx, gy), (tx, ty)], fill=INK, width=7)
            d.line([(gx, gy), (tx, ty)], fill=col, width=4)
        draw_disc(d, gx, gy, gr, col, ink_w=4)
        draw_disc(d, gx, gy, gr * 0.35, WALNUT, ink_w=2)

    # Right side: Carving chisels, bright miniature paint pots (red, blue, gold, emerald) & curled wood shavings!
    for idx, (py, col) in enumerate([(80, CRIMSON), (116, COBALT), (152, OCHRE), (188, EMERALD)]):
        draw_disc(d, W - 64, py, 14, col, ink_w=3)
    # Wood-carving chisels
    for cy in [78, 96]:
        d.line([(340, cy), (398, cy + 4)], fill=STEEL, width=5)
        draw_beveled_rect(d, 324, cy - 5, 354, cy + 8, MAHOGANY, radius=4, ink_w=2)
    # Curled golden pine wood shavings scattered across bench
    for sx, sy in [(216, 86), (236, 202), (356, 184), (376, 152)]:
        d.arc([sx - 12, sy - 8, sx + 12, sy + 8], start=20, end=270, fill=(*PINE_LIGHT, 230), width=4)

    return finish_prop(im, w, h, seed=7609)


# =============================================================================
# 10. COLORABLE STRIPED BERLIN SHOPFRONT AWNING (240x96, dd_red!)
# =============================================================================
def gen_ren_apothecary_toymaker_awning_colorable() -> Image.Image:
    """Recolorable dd_red striped shopfront awning (iron mount bar at TOP -Y, scalloped overhang at BOTTOM +Y)."""
    w, h = 240, 96
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Top wall-mount iron cornice beam
    draw_beveled_rect(d, 14, 14, W - 14, 42, IRON, radius=6, ink_w=5)

    # Alternating dd_red & vintage cream canvas stripes
    stripes = 11
    x0, x1 = 18, W - 18
    sw = (x1 - x0) / stripes
    y_top, y_bot = 38, H - 30

    # Scalloped bottom shadow
    d.rectangle([x0 + 4, y_bot - 6, x1 + 4, H - 10], fill=(24, 18, 16, 70))

    for i in range(stripes):
        sx0 = int(round(x0 + i * sw))
        sx1 = int(round(x0 + (i + 1) * sw))
        col = DD_RED_BASE if i % 2 == 0 else CANVAS_CREAM
        hi = DD_RED_HI if i % 2 == 0 else (252, 246, 232)
        deep = DD_RED_DEEP if i % 2 == 0 else CANVAS_SHADE
        d.rectangle([sx0, y_top, sx1, y_bot], fill=(*col, 255), outline=INK, width=4)
        # Soft sunlit top highlight & gentle bottom slope shade
        d.rectangle([sx0 + 4, y_top + 4, sx1 - 4, y_top + 26], fill=(*hi, 110))
        d.rectangle([sx0 + 4, y_bot - 22, sx1 - 4, y_bot - 4], fill=(*deep, 105))
        # Scalloped valance lobe at bottom!
        d.pieslice([sx0, y_bot - 18, sx1, H - 12], start=0, end=180, fill=(*col, 255), outline=INK, width=4)

    # Crisp gold braided trim band & central brass finial crest
    d.rectangle([x0, y_bot - 10, x1, y_bot], fill=(*BRASS, 255), outline=INK, width=3)
    draw_disc(d, W / 2, (y_top + y_bot) / 2, 20, BRASS, ink_w=4)
    draw_disc(d, W / 2, (y_top + y_bot) / 2, 11, DD_RED_DEEP, ink_w=3)
    return finish_prop(im, w, h, seed=7610)


# =============================================================================
# 11. KID THEATER MARQUEE SHOWBILL KIOSK, CHALK BUCKET & PINWHEELS (208x112)
# =============================================================================
def gen_ren_kid_theater_marquee_chalk_kiosk() -> Image.Image:
    w, h = 208, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Kid-built wooden signboard frame w/ painted cardboard marquee header
    wood_box(d, 22, 28, W - 76, H - 24, OAK, n_planks=3, horizontal=True, ink_w=6, seed=7611)
    # Bright painted theater marquee crest bar along top edge
    draw_beveled_rect(d, 26, 20, W - 80, 62, CRIMSON, radius=10, ink_w=5)
    # Little gold paper stars nailed along the marquee header!
    for sx in [58, 118, 178, 238, 298]:
        draw_disc(d, sx, 41, 9, BRASS, ink_w=2)

    # Three hand-drawn colorful crayon playbill posters pinned to the timber board!
    posters = [
        (40, 74, 116, H - 36, CANVAS_CREAM, COBALT),
        (132, 72, 214, H - 34, (248, 236, 194), CRIMSON),
        (230, 76, 316, H - 38, CANVAS_CREAM, EMERALD),
    ]
    for px0, py0, px1, py1, bg, accent in posters:
        draw_beveled_rect(d, px0, py0, px1, py1, bg, radius=4, ink_w=3)
        d.rectangle([px0 + 10, py0 + 14, px1 - 10, py0 + 46], fill=(*accent, 235), outline=INK_MID, width=2)
        for ly in range(py0 + 58, py1 - 12, 14):
            d.line([(px0 + 12, ly), (px1 - 12, ly)], fill=INK_MID, width=3)
        # Red/gold thumbtack at top center
        draw_disc(d, (px0 + px1) / 2, py0 + 6, 5, CRIMSON, ink_w=1)

    # Right end: Tin bucket brimming with pastel sidewalk chalk sticks + bright paper pinwheel!
    draw_disc(d, W - 44, H - 62, 26, STEEL, ink_w=4)
    draw_disc(d, W - 44, H - 62, 19, IRON, ink_w=2)
    for cx, cy, col in [
        (W - 52, H - 68, (242, 128, 148)),
        (W - 38, H - 70, (124, 204, 238)),
        (W - 44, H - 54, (248, 224, 116)),
        (W - 54, H - 56, (154, 224, 144)),
    ]:
        draw_disc(d, cx, cy, 6, col, ink_w=2)
    # Bright 4-blade paper pinwheel mounted on upper right corner!
    px, py = W - 44, 62
    for idx, col in enumerate([CRIMSON, OCHRE, COBALT, EMERALD]):
        a0 = idx * math.pi / 2 + 0.2
        a1 = a0 + 0.95
        tri = [(px, py), (px + math.cos(a0) * 26, py + math.sin(a0) * 26), (px + math.cos(a1) * 22, py + math.sin(a1) * 22)]
        d.polygon(tri, fill=(*col, 255), outline=INK, width=3)
    draw_disc(d, px, py, 6, BRASS, ink_w=2)

    return finish_prop(im, w, h, seed=7611)


# =============================================================================
# 12. OPEN WOODEN A-FRAME PAINTER'S STEPLADDER & PAINT TIN (160x144)
# =============================================================================
def gen_ren_folded_step_ladder_paint_can() -> Image.Image:
    w, h = 160, 144
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Soft shadow underneath open A-frame ladder
    d.rounded_rectangle([38, 30, W - 26, H - 22], radius=16, fill=(24, 18, 16, 75))

    # Rear supporting A-frame legs (visible slightly splayed on lower half)
    draw_beveled_rect(d, 48, 150, 74, H - 24, WALNUT, radius=5, ink_w=4)
    draw_beveled_rect(d, W - 74, 150, W - 48, H - 24, WALNUT, radius=5, ink_w=4)
    # Iron hinged spreader braces on both sides
    d.line([(54, 148), (54, 206)], fill=IRON, width=6)
    d.line([(W - 54, 148), (W - 54, 206)], fill=IRON, width=6)

    # Stepped wooden treads receding downward from the top platform!
    for ty, inset, col in [(204, 52, OAK), (156, 46, PINE), (108, 40, PINE_LIGHT)]:
        draw_beveled_rect(d, inset, ty, W - inset, ty + 30, col, radius=5, ink_w=4)
    # Main side rails framing the front steps
    draw_beveled_rect(d, 34, 34, 62, 246, OAK, radius=6, ink_w=5)
    draw_beveled_rect(d, W - 62, 34, W - 34, 246, OAK, radius=6, ink_w=5)
    # Wide top platform cap!
    draw_beveled_rect(d, 30, 26, W - 30, 96, PINE, radius=8, ink_w=5)

    # Open tin paint can filled w/ fresh sage-green paint + resting bristle brush & drips on top tray!
    draw_disc(d, W / 2 - 22, 62, 26, STEEL, ink_w=4)
    draw_disc(d, W / 2 - 22, 62, 19, SAGE, ink_w=2)
    add_paint_splatters(d, [(W / 2 + 24, 72, 8, SAGE), (W / 2 + 44, 54, 5, PLASTER)])
    # Paint brush resting cleanly across the top step
    d.polygon([(W / 2 + 8, 42), (W - 44, 72), (W - 54, 86), (W / 2 - 2, 56)], fill=(*CRIMSON, 255), outline=INK, width=3)
    d.polygon([(W / 2 - 12, 34), (W / 2 + 10, 42), (W / 2 - 2, 58), (W / 2 - 22, 48)], fill=(*SAGE, 255), outline=INK, width=3)

    return finish_prop(im, w, h, seed=7612)


def main() -> None:
    specs = [
        ("ren_paint_drop_cloth_splattered.png", "Paint-Splattered Canvas Drop Cloth & Roller", "normal",
         ["renovation_shops", "renovation", "construction", "paint", "drop_cloth", "tarp", "harmony"], gen_ren_paint_drop_cloth_splattered),
        ("ren_sheet_draped_furniture_sofa.png", "Dust-Sheet-Draped Parlor Sofa", "normal",
         ["renovation_shops", "renovation", "construction", "sofa", "sheet", "covered", "harmony"], gen_ren_sheet_draped_furniture_sofa),
        ("ren_sheet_draped_armchair_boxes.png", "Dust-Sheet-Draped Armchair & Moving Box", "normal",
         ["renovation_shops", "renovation", "construction", "chair", "moving_box", "covered", "harmony"], gen_ren_sheet_draped_armchair_boxes),
        ("ren_wallpaper_pasting_trestle.png", "Wallpaper Pasting Trestle Table & Floral Roll", "normal",
         ["renovation_shops", "renovation", "construction", "wallpaper", "table", "craft", "harmony"], gen_ren_wallpaper_pasting_trestle),
        ("ren_contractor_blueprint_sawhorse_table.png", "Contractor's Sawhorse Blueprint Table", "normal",
         ["renovation_shops", "renovation", "construction", "blueprint", "sawhorse", "table", "harmony"], gen_ren_contractor_blueprint_sawhorse_table),
        ("ren_plaster_mortar_tub_trowels.png", "Gypsum Plaster Mixing Trough, Trowels & Sacks", "normal",
         ["renovation_shops", "renovation", "construction", "plaster", "mortar", "trowel", "harmony"], gen_ren_plaster_mortar_tub_trowels),
        ("ren_uninstalled_porcelain_tub_pipes.png", "Crated Enamel Clawfoot Tub & Copper Pipes", "normal",
         ["renovation_shops", "renovation", "construction", "bathtub", "plumbing", "pipes", "harmony"], gen_ren_uninstalled_porcelain_tub_pipes),
        ("ren_apothecary_drawer_wall_cabinet.png", "Gründerzeit Apothecary Drawer Cabinet & Elixirs", "normal",
         ["renovation_shops", "apothecary", "alchemy", "cabinet", "shop", "potions", "harmony"], gen_ren_apothecary_drawer_wall_cabinet),
        ("ren_puppet_toymaker_workbench.png", "Clockwork Toymaker & Marionette Carving Bench", "normal",
         ["renovation_shops", "clockmaker", "toymaker", "puppet", "workbench", "shop", "harmony"], gen_ren_puppet_toymaker_workbench),
        ("ren_apothecary_toymaker_awning_colorable.png", "Striped Berlin Shopfront Awning (Colorable)", "dd_red",
         ["renovation_shops", "awning", "facade", "shop", "street", "colorable", "dd_red", "harmony"], gen_ren_apothecary_toymaker_awning_colorable),
        ("ren_kid_theater_marquee_chalk_kiosk.png", "Kid Theater Marquee Showbill Kiosk & Chalk Bucket", "normal",
         ["renovation_shops", "kid_theater", "theater", "marquee", "chalk", "kiosk", "harmony"], gen_ren_kid_theater_marquee_chalk_kiosk),
        ("ren_folded_step_ladder_paint_can.png", "Open Wooden Painter's Stepladder & Paint Can", "normal",
         ["renovation_shops", "renovation", "construction", "ladder", "paint", "harmony"], gen_ren_folded_step_ladder_paint_can),
    ]

    qa_items: list[tuple[str, Image.Image]] = []
    manifest_entries: list[dict] = []

    for idx, (fname, display_name, draw_mode, tags, fn) in enumerate(specs, 1):
        im = fn()
        rel_path = f"props/renovation_shops/{fname}"
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
            "tags": tags,
        })
        print(f"  [{idx:02d}/{len(specs)}] {rel_path} ({w_px}x{h_px}, {draw_mode})")

    save_qa_sheet(qa_items, QA_PATH, cols=4)
    total = upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    print(f"\nGenerated {len(specs)} Renovation & Shops Harmony assets (manifest total={total}) -> {QA_PATH}")


if __name__ == "__main__":
    main()

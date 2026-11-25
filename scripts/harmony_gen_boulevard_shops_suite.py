"""
Dice Chaos Maps — 28-Asset Painterly Boulevard Shops & Rowhouse Interiors Suite

Generates 28 bespoke clean-room CC0 Harmony assets in:
  `public/assets/modular-suite-cc0/props/boulevard_shops/`

Crafted for the 4 multi-story Berlin Dark-Magipunk Rowhouses lining Souverän-Allee:
  - Building 1 (3F) — Keller & Kron Vintner's & Fine Spirits Emporium (7):
      bs_vintner_tasting_bar, bs_vintner_bottle_wall_rack, bs_vintner_cheese_charcuterie_board,
      bs_vintner_counting_safe_cabinet, bs_vintner_wine_barrel_display,
      bs_vintner_awning_burgundy, bs_vintner_cork_crate_bottles
  - Building 2 (4F) — Dampf & Glanz Magipunk Steam Laundry & Volksbad (7):
      bs_steam_garment_press_machine, bs_laundry_dropoff_counter, bs_hanging_garment_rack_brass,
      bs_ironing_board_flatiron, bs_volksbad_tiled_soaking_tub, bs_volksbad_towel_warmer_rack,
      bs_laundry_awning_teal
  - Building 3 (3F) — Eulenblick Antiquarian Bookshop & Horology Curiosities (7):
      bs_curio_glass_display_case, bs_antiquarian_appraisal_desk, bs_clockmaker_horology_bench,
      bs_grandfather_orrery_clock, bs_rare_books_stack_pedestal, bs_bookshop_awning_emerald,
      bs_telescope_brass_tripod
  - Building 4 (2F) — Seide & Sohle Bespoke Tailor, Milliner & Cobbler Atelier (7):
      bs_tailor_cutting_pattern_table, bs_treadle_sewing_machine_desk, bs_tailor_dressmaker_mannequins,
      bs_tailor_fitting_mirror_platform, bs_cobbler_bootmaker_bench,
      bs_tailor_colorable_cloth_display (dd_red), bs_shop_colorable_boulevard_awning (dd_red)

All 2x-supersampled in unified Harmony style (#1E1816 charcoal ink, painterly fBm grain,
opaque interiors, zero white halos). Upserts into `public/assets/modular-suite-cc0/manifest.json`.
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
    INK_IRON,
    DD_RED_BASE,
    DD_RED_DEEP,
    DD_RED_HI,
    new_hi,
    apply_painterly_finish,
    add_contact_shadow,
    add_glow,
    draw_beveled_rect,
    draw_wood_planks_box,
    blend_rgb,
    vary_rgb,
    save_qa_sheet,
    upsert_manifest_entries,
    dominant_hex,
)

OUT_DIR = MOD_DIR / "props" / "boulevard_shops"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Rich Berlin Dark-Magipunk Boulevard Boutique Palette
WALNUT = (96, 62, 40)
MAHOGANY = (118, 52, 42)
OAK = (154, 112, 68)
PINE = (188, 148, 96)
BRASS = (204, 162, 74)
BRASS_HI = (238, 202, 110)
COPPER = (184, 108, 66)
IRON = (62, 68, 76)
IRON_DK = (38, 42, 48)
ZINC = (162, 168, 176)
BURGUNDY = (138, 34, 48)
CRIMSON = (178, 42, 52)
TEAL = (44, 118, 126)
PRUSSIAN = (42, 74, 108)
EMERALD = (38, 108, 72)
BAIZE_GRN = (46, 112, 76)
GOLD = (224, 178, 68)
CREAM = (242, 234, 214)
LINEN = (236, 232, 222)
MARBLE = (224, 222, 214)
TILE_AQUA = (168, 206, 204)
WATER_STEAM = (118, 186, 194)
GLASS_TINT = (164, 212, 216)
WINE_GRN = (44, 104, 58)
WINE_AMB = (182, 114, 38)
WINE_RUBY = (146, 28, 42)
LEATHER = (136, 82, 48)
LEATHER_DK = (82, 48, 30)
CYAN_AETHER = (88, 228, 255)
AMBER_GLOW = (255, 198, 92)
CHEESE = (234, 194, 84)


def draw_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rgb: tuple[int, int, int] | tuple[int, int, int, int],
    ink_w: int = 4,
) -> None:
    rgb3 = (rgb[0], rgb[1], rgb[2])
    dk = blend_rgb(rgb3, (18, 14, 14), 0.40)
    hi = blend_rgb(rgb3, (255, 250, 236), 0.40)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dk, outline=INK, width=ink_w)
    d.ellipse([cx - r * 0.84, cy - r * 0.84, cx + r * 0.84, cy + r * 0.84], fill=(*rgb3, 255))
    if r >= 9:
        d.arc(
            [cx - r * 0.68, cy - r * 0.68, cx + r * 0.68, cy + r * 0.68],
            195, 310, fill=hi, width=max(2, int(r * 0.14)),
        )


def draw_striped_awning(
    w: int, h: int, seed: int, stripe_a: tuple[int, int, int], stripe_b: tuple[int, int, int], trim_rgb: tuple[int, int, int]
) -> Image.Image:
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.rounded_rectangle([24 + off[0], 24 + off[1], W - 24 + off[0], H - 28 + off[1]], radius=12, fill=col),
        offset=(6, 12), blur=11.0, alpha=95,
    )
    d = ImageDraw.Draw(im)
    # Wall mounting brass rail at top
    draw_beveled_rect(d, 20, 20, W - 20, 40, trim_rgb, ink_w=4, radius=6)
    # Sloped canopy stripes
    n_stripes = 11
    sw = (W - 48) / n_stripes
    for i in range(n_stripes):
        x0 = 24 + i * sw
        x1 = x0 + sw
        col = stripe_a if (i % 2 == 0) else stripe_b
        # Subtle top-to-bottom sunlit slope shading
        draw_beveled_rect(d, x0, 36, x1, H - 46, col, ink_w=3, hi_amt=0.22, sh_amt=0.30)
        # Scalloped valance flap along front (bottom) edge!
        vx = (x0 + x1) * 0.5
        vr = sw * 0.48
        d.chord([vx - vr, H - 56 - vr * 0.5, vx + vr, H - 44 + vr * 0.5], 0, 180, fill=(*blend_rgb(col, (20, 16, 16), 0.18)[:3], 255), outline=INK, width=4)
    # Gilt valance piping band
    d.line([(24, H - 46), (W - 24, H - 46)], fill=(*trim_rgb, 255), width=6)
    d.line([(24, H - 48), (W - 24, H - 48)], fill=INK, width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8, warm_bevel=True)


# =============================================================================
# GROUP A (7): KELLER & KRON VINTNER'S & FINE SPIRITS EMPORIUM
# =============================================================================
def gen_vintner_tasting_bar() -> Image.Image:
    w, h = 320, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 30 + o[1], W - 24 + o[0], H - 28 + o[1]], radius=16, fill=c), (7, 9), 10.0, 96)
    d = ImageDraw.Draw(im)
    # Brass front footrail sticking out slightly along bottom
    draw_beveled_rect(d, 46, H - 34, W - 46, H - 20, BRASS, ink_w=4, radius=6)
    # Main walnut & mahogany bar counter with hammered brass bartop inset
    draw_beveled_rect(d, 22, 30, W - 22, H - 30, MAHOGANY, ink_w=5, radius=14, hi_amt=0.26, sh_amt=0.40)
    draw_wood_planks_box(d, 38, 44, W - 38, H - 46, WALNUT, random.Random(4101), horizontal=True, n_planks=6)
    d.rounded_rectangle([38, 44, W - 38, H - 46], radius=8, outline=(*BRASS, 255), width=6)
    d.rounded_rectangle([38, 44, W - 38, H - 46], radius=8, outline=INK, width=3)
    # Gleaming brass wine-cask tap tower on left-center
    draw_beveled_rect(d, 96, 62, 168, 124, BRASS, ink_w=4, radius=10)
    for tx in [114, 132, 150]:
        draw_disc(d, tx, 92, 10, BRASS_HI, ink_w=3)
        d.line([(tx, 96), (tx, 122)], fill=INK, width=5)
        draw_disc(d, tx, 122, 6, BURGUNDY, ink_w=2)
    # Crystal decanters, emerald wine bottles & stemmed ruby tasting goblets along bar!
    draw_disc(d, 242, 104, 24, MARBLE, ink_w=4)
    draw_disc(d, 232, 98, 12, WINE_RUBY, ink_w=3)
    draw_disc(d, 254, 110, 11, WINE_AMB, ink_w=3)
    for bx, by, bc in [(342, 82, WINE_GRN), (368, 94, WINE_GRN), (392, 80, WINE_RUBY), (434, 96, WINE_AMB)]:
        draw_disc(d, bx, by, 13, bc, ink_w=3)
        draw_disc(d, bx, by, 5, GOLD, ink_w=2)
    # Tasting glasses & wooden cork tray on right
    draw_beveled_rect(d, 486, 70, 582, 136, OAK, ink_w=4, radius=8)
    for gx, gy in [(512, 96), (546, 92), (562, 116), (522, 118)]:
        draw_disc(d, gx, gy, 11, GLASS_TINT, ink_w=3)
        d.ellipse([gx - 6, gy - 6, gx + 6, gy + 6], fill=(*WINE_RUBY, 220))
    # Brass service bell
    draw_disc(d, 304, 178, 15, BRASS_HI, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=4101, grain=4.8, warm_bevel=True)


def gen_vintner_bottle_wall_rack() -> Image.Image:
    w, h = 256, 112
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([20 + o[0], 22 + o[1], W - 20 + o[0], H - 22 + o[1]], radius=10, fill=c), (6, 8), 9.0, 95)
    d = ImageDraw.Draw(im)
    rng = random.Random(4102)
    draw_beveled_rect(d, 18, 20, W - 18, H - 20, MAHOGANY, ink_w=5, radius=8)
    draw_beveled_rect(d, 30, 32, W - 30, H - 32, WALNUT, ink_w=4, radius=4)
    # Top cornice & cubby dividers filled with glinting wine bottle rows!
    for cx0 in range(40, W - 46, 44):
        d.line([(cx0, 34), (cx0, H - 34)], fill=INK_DARK, width=5)
        for by in [58, 96, 134, 168]:
            bc = rng.choice([WINE_GRN, WINE_GRN, WINE_RUBY, WINE_AMB, BURGUNDY])
            draw_disc(d, cx0 + 22, by, 13, bc, ink_w=3)
            draw_disc(d, cx0 + 22, by, 4, BRASS_HI, ink_w=1)
    # Brass rack plaques on top rim
    for px in [120, 256, 392]:
        draw_beveled_rect(d, px - 24, 24, px + 24, 38, BRASS, ink_w=2, radius=3)
    return apply_painterly_finish(im, w, h, seed=4102, grain=4.8, warm_bevel=True)


def gen_vintner_cheese_charcuterie_board() -> Image.Image:
    w, h = 160, 128
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([32 + o[0], 34 + o[1], W - 32 + o[0], H - 34 + o[1]], radius=22, fill=c), (5, 7), 8.0, 90)
    d = ImageDraw.Draw(im)
    # Wooden paddle serving board
    draw_beveled_rect(d, W - 56, H // 2 - 18, W - 18, H // 2 + 18, OAK, ink_w=4, radius=10)
    draw_beveled_rect(d, 28, 32, W - 46, H - 32, OAK, ink_w=5, radius=24)
    # Gouda cheese wheel with wedge cut out!
    draw_disc(d, 102, 118, 44, CHEESE, ink_w=4)
    d.pieslice([58, 74, 146, 162], -25, 45, fill=(*OAK, 255), outline=INK, width=3)
    # Sliced salami rounds & crusty bread slices
    for sx, sy in [(184, 84), (206, 98), (190, 118), (218, 124)]:
        draw_disc(d, sx, sy, 15, CRIMSON, ink_w=3)
        d.ellipse([sx - 5, sy - 4, sx + 2, sy + 2], fill=(*CREAM, 210))
    # Purple grape cluster
    for gx, gy in [(126, 178), (144, 174), (160, 182), (136, 194), (154, 198), (170, 194)]:
        draw_disc(d, gx, gy, 10, (108, 42, 128), ink_w=2)
    # Wine glass & cheese knife
    draw_disc(d, 234, 176, 20, GLASS_TINT, ink_w=3)
    draw_disc(d, 234, 176, 12, WINE_RUBY, ink_w=2)
    d.line([(164, 144), (222, 150)], fill=INK, width=8)
    d.line([(166, 144), (220, 150)], fill=(*ZINC, 255), width=4)
    return apply_painterly_finish(im, w, h, seed=4103, grain=4.6, warm_bevel=True)


def gen_vintner_counting_safe_cabinet() -> Image.Image:
    w, h = 208, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=12, fill=c), (7, 9), 10.0, 100)
    d = ImageDraw.Draw(im)
    # Heavy riveted Berlin cast-iron floor safe with gilded scrollwork & top ledger tray!
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, IRON_DK, ink_w=6, radius=12, hi_amt=0.24, sh_amt=0.45)
    draw_beveled_rect(d, 38, 38, W - 38, H - 38, IRON, ink_w=4, radius=8)
    d.rounded_rectangle([46, 46, W - 46, H - 46], radius=6, outline=(*BRASS, 255), width=4)
    # Corner rivets
    for rx in [34, W - 34]:
        for ry in [36, H - 36]:
            draw_disc(d, rx, ry, 7, BRASS, ink_w=2)
    # Brass combination wheel protruding from front lip
    draw_disc(d, W // 2, H - 26, 22, BRASS, ink_w=4)
    draw_disc(d, W // 2, H - 26, 11, IRON_DK, ink_w=3)
    # Open accounting ledger & gold coin stacks resting on top of safe
    draw_beveled_rect(d, 74, 72, 212, 184, BURGUNDY, ink_w=4, radius=6)
    draw_beveled_rect(d, 84, 82, 142, 174, CREAM, ink_w=2, radius=2)
    draw_beveled_rect(d, 146, 82, 202, 174, CREAM, ink_w=2, radius=2)
    for ly in range(96, 166, 14):
        d.line([(92, ly), (134, ly)], fill=INK_MID, width=2)
        d.line([(154, ly), (194, ly)], fill=INK_MID, width=2)
    # Brass weighing balance & stacked gold coins on right
    draw_disc(d, 286, 104, 24, BRASS, ink_w=4)
    draw_disc(d, 336, 118, 20, BRASS_HI, ink_w=3)
    for cx, cy in [(266, 164), (294, 174), (324, 162)]:
        draw_disc(d, cx, cy, 14, GOLD, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=4104, grain=4.8, warm_bevel=True)


def gen_vintner_wine_barrel_display() -> Image.Image:
    w, h = 224, 160
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([34 + o[0], 34 + o[1], W - 34 + o[0], H - 34 + o[1]], fill=c), (7, 9), 10.0, 95)
    d = ImageDraw.Draw(im)
    # Twin upright oak tasting casks banded with brass hoops + sample bottle & goblets!
    for cx, cy, r in [(146, H // 2, 92), (318, H // 2 + 8, 76)]:
        draw_disc(d, cx, cy, r, IRON_DK, ink_w=5)
        draw_disc(d, cx, cy, r - 9, BRASS, ink_w=4)
        draw_disc(d, cx, cy, r - 18, OAK, ink_w=4)
        for dx in range(-int(r * 0.55), int(r * 0.6), 24):
            h_ch = math.sqrt(max(1, (r - 20) ** 2 - dx * dx))
            d.line([(cx + dx, cy - h_ch), (cx + dx, cy + h_ch)], fill=(58, 38, 22, 185), width=3)
    # Vintage bottles, goblets & brass tap atop the left barrel
    draw_disc(d, 118, 134, 18, WINE_GRN, ink_w=3)
    draw_disc(d, 164, 128, 16, WINE_RUBY, ink_w=3)
    draw_disc(d, 146, 182, 14, GLASS_TINT, ink_w=3)
    draw_disc(d, 146, 182, 8, WINE_RUBY, ink_w=2)
    # Chalk vintage placard on right barrel
    draw_beveled_rect(d, 280, 134, 354, 198, IRON_DK, ink_w=4, radius=6)
    d.line([(294, 156), (340, 156)], fill=(*CREAM, 220), width=4)
    d.line([(298, 174), (334, 174)], fill=(*GOLD, 220), width=3)
    return apply_painterly_finish(im, w, h, seed=4105, grain=5.0, warm_bevel=True)


def gen_vintner_awning_burgundy() -> Image.Image:
    return draw_striped_awning(304, 112, 4106, BURGUNDY, CREAM, BRASS)


def gen_vintner_cork_crate_bottles() -> Image.Image:
    w, h = 176, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 24 + o[1], W - 24 + o[0], H - 24 + o[1]], radius=8, fill=c), (6, 8), 8.0, 92)
    d = ImageDraw.Draw(im)
    rng = random.Random(4107)
    draw_beveled_rect(d, 22, 22, W - 22, H - 22, PINE, ink_w=5, radius=6)
    draw_beveled_rect(d, 38, 38, W - 38, H - 38, (158, 132, 74), ink_w=4, radius=3)
    # Grid of 12 bottle necks nestled in golden packing straw
    for gx in range(72, W - 56, 62):
        for gy in range(72, H - 56, 62):
            bc = rng.choice([WINE_GRN, WINE_GRN, WINE_RUBY, WINE_AMB])
            draw_disc(d, gx, gy, 24, bc, ink_w=4)
            draw_disc(d, gx, gy, 9, GOLD, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=4107, grain=4.8, warm_bevel=True)


# =============================================================================
# GROUP B (7): DAMPF & GLANZ MAGIPUNK STEAM LAUNDRY & VOLKSBAD
# =============================================================================
def gen_steam_garment_press_machine() -> Image.Image:
    w, h = 288, 176
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=16, fill=c), (8, 10), 11.0, 100)
    d = ImageDraw.Draw(im)
    # Heavy cast-iron industrial base frame + copper steam manifold pipes!
    draw_beveled_rect(d, 24, 28, W - 24, H - 28, IRON, ink_w=6, radius=14, hi_amt=0.22, sh_amt=0.45)
    # Left cylindrical riveted copper steam boiler drum with glowing cyan aether heating core!
    draw_beveled_rect(d, 42, 46, 172, H - 46, COPPER, ink_w=5, radius=24)
    add_glow(im, 107, H // 2, 42, 42, CYAN_AETHER, alpha=125, blur=16.0)
    d = ImageDraw.Draw(im)
    draw_disc(d, 107, H // 2, 26, BRASS, ink_w=4)
    draw_disc(d, 107, H // 2, 15, CYAN_AETHER, ink_w=3)
    # Pressure dial gauge & brass valve wheel
    draw_disc(d, 107, 74, 18, BRASS_HI, ink_w=3)
    draw_disc(d, 107, 74, 11, CREAM, ink_w=2)
    d.line([(107, 74), (114, 67)], fill=CRIMSON, width=3)
    draw_disc(d, 107, H - 74, 18, CRIMSON, ink_w=4)
    # Connecting copper steam pipes into the padded press platen & twin rotary mangle rollers!
    for py in [112, H - 112]:
        d.line([(168, py), (222, py)], fill=INK, width=16)
        d.line([(168, py), (222, py)], fill=(*COPPER, 255), width=9)
    # Padded steam press buck + crisp pressed cream shirt silhouette!
    draw_beveled_rect(d, 212, 54, 434, H - 54, (198, 192, 178), ink_w=5, radius=18)
    draw_beveled_rect(d, 236, 82, 396, H - 82, LINEN, ink_w=4, radius=12)
    # Hinged iron & brass upper steam-press lever arm across the platen
    draw_beveled_rect(d, 268, 128, 412, 224, IRON_DK, ink_w=5, radius=12)
    draw_beveled_rect(d, 286, 144, 394, 208, BRASS, ink_w=3, radius=8)
    # Right brass-geared rotary mangle wringer rollers
    draw_beveled_rect(d, 454, 48, W - 44, H - 48, ZINC, ink_w=5, radius=10)
    d.line([(492, 52), (492, H - 52)], fill=INK_DARK, width=8)
    draw_disc(d, 492, 46, 14, BRASS, ink_w=3)
    draw_disc(d, 492, H - 46, 14, BRASS, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=4201, grain=5.0, warm_bevel=True)


def gen_laundry_dropoff_counter() -> Image.Image:
    w, h = 288, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([22 + o[0], 28 + o[1], W - 22 + o[0], H - 28 + o[1]], radius=12, fill=c), (7, 9), 10.0, 95)
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 20, 26, W - 20, H - 26, OAK, ink_w=5, radius=10)
    draw_beveled_rect(d, 34, 40, W - 34, H - 40, ZINC, ink_w=4, radius=6, hi_amt=0.25, sh_amt=0.28)
    # Stacked brown-paper & crisp white linen laundry parcels tied with red/hemp twine!
    for bx, by, bw, bh, col in [
        (54, 58, 108, 84, LINEN), (72, 154, 96, 74, (206, 174, 130)),
        (194, 62, 104, 82, (216, 224, 228)), (418, 60, 108, 86, LINEN), (428, 156, 98, 72, CREAM),
    ]:
        draw_beveled_rect(d, bx, by, bx + bw, by + bh, col, ink_w=4, radius=8)
        d.line([(bx + bw // 2, by + 3), (bx + bw // 2, by + bh - 3)], fill=(*BURGUNDY, 225), width=4)
        d.line([(bx + 3, by + bh // 2), (bx + bw - 3, by + bh // 2)], fill=(*BURGUNDY, 225), width=4)
    # Claim ledger & brass counter service bell in center
    draw_beveled_rect(d, 314, 72, 400, 168, PRUSSIAN, ink_w=4, radius=5)
    draw_beveled_rect(d, 324, 82, 390, 158, CREAM, ink_w=2, radius=2)
    for ly in range(96, 150, 12):
        d.line([(332, ly), (382, ly)], fill=INK_MID, width=2)
    draw_disc(d, 356, 208, 18, BRASS_HI, ink_w=4)
    return apply_painterly_finish(im, w, h, seed=4202, grain=4.8, warm_bevel=True)


def gen_hanging_garment_rack_brass() -> Image.Image:
    w, h = 256, 112
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 34 + o[1], W - 24 + o[0], H - 34 + o[1]], radius=16, fill=c), (6, 10), 10.0, 92)
    d = ImageDraw.Draw(im)
    rng = random.Random(4203)
    # Pressed coats, shirts & dresses hanging shoulder-to-shoulder along the brass garment rail!
    garment_cols = [PRUSSIAN, LINEN, BURGUNDY, (124, 116, 104), LINEN, EMERALD, PRUSSIAN, CREAM, (144, 96, 62), LINEN, TEAL, BURGUNDY]
    for i, gc in enumerate(garment_cols):
        gx = 56 + i * 36
        gh = rng.randint(58, 72)
        draw_beveled_rect(d, gx - 16, H // 2 - gh, gx + 16, H // 2 + gh, gc, ink_w=4, radius=10)
    # Gleaming brass top crossbar & end finials
    draw_beveled_rect(d, 22, H // 2 - 9, W - 22, H // 2 + 9, BRASS, ink_w=4, radius=6)
    draw_disc(d, 28, H // 2, 16, BRASS_HI, ink_w=4)
    draw_disc(d, W - 28, H // 2, 16, BRASS_HI, ink_w=4)
    return apply_painterly_finish(im, w, h, seed=4203, grain=4.6, warm_bevel=True)


def gen_ironing_board_flatiron() -> Image.Image:
    w, h = 224, 128
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([32 + o[0], 46 + o[1], W - 32 + o[0], H - 46 + o[1]], radius=36, fill=c), (6, 9), 9.0, 92)
    d = ImageDraw.Draw(im)
    # Wooden X-legs peeking slightly from underneath
    for lx in [120, W - 132]:
        draw_beveled_rect(d, lx - 12, 34, lx + 12, H - 34, OAK, ink_w=4, radius=4)
    # Tapered padded linen ironing board
    pts = [(48, 62), (W - 118, 62), (W - 36, H // 2 - 26), (W - 36, H // 2 + 26), (W - 118, H - 62), (48, H - 62)]
    d.polygon(pts, fill=(*LINEN, 255), outline=INK, width=5)
    d.line([(60, 72), (W - 120, 72)], fill=(252, 250, 244, 255), width=4)
    # Half-pressed pale blue shirt collar laid on board
    draw_beveled_rect(d, 152, 82, 326, H - 82, (174, 202, 218), ink_w=3, radius=10)
    # Heavy cast-iron coal flatiron resting on iron trivet at left end!
    draw_beveled_rect(d, 64, 92, 134, H - 92, IRON_DK, ink_w=4, radius=14)
    iron_pts = [(74, 102), (118, 102), (144, H // 2), (118, H - 102), (74, H - 102)]
    d.polygon(iron_pts, fill=(*IRON, 255), outline=INK, width=4)
    draw_beveled_rect(d, 86, H // 2 - 10, 126, H // 2 + 10, WALNUT, ink_w=3, radius=5)
    # Brass water atomizer bottle beside it
    draw_disc(d, 358, H // 2, 16, BRASS, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=4204, grain=4.6, warm_bevel=True)


def gen_volksbad_tiled_soaking_tub() -> Image.Image:
    w, h = 256, 160
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 24 + o[1], W - 24 + o[0], H - 24 + o[1]], radius=22, fill=c), (6, 8), 9.0, 92)
    d = ImageDraw.Draw(im)
    # Recessed cream & aqua ceramic tiled bath surround
    draw_beveled_rect(d, 22, 22, W - 22, H - 22, MARBLE, ink_w=5, radius=18)
    for tx in range(32, W - 32, 38):
        d.line([(tx, 26), (tx, H - 26)], fill=(156, 174, 172, 140), width=2)
    for ty in range(32, H - 32, 38):
        d.line([(26, ty), (W - 26, ty)], fill=(156, 174, 172, 140), width=2)
    # Deep oval porcelain tub basin brimming with warm turquoise herbal bathwater & steam wisps!
    d.rounded_rectangle([54, 46, W - 112, H - 46], radius=68, fill=(*TILE_AQUA, 255), outline=INK, width=6)
    d.rounded_rectangle([72, 62, W - 130, H - 62], radius=54, fill=(*WATER_STEAM, 255), outline=(74, 134, 142, 255), width=4)
    # Luminous misty steam & floating eucalyptus leaves + sponge!
    add_glow(im, 212, H // 2, 118, 64, (238, 252, 252), alpha=96, blur=18.0)
    d = ImageDraw.Draw(im)
    draw_disc(d, 152, 128, 16, (218, 188, 118), ink_w=3)
    for lx, ly in [(248, 140), (266, 156), (232, 174)]:
        d.ellipse([lx - 10, ly - 5, lx + 10, ly + 5], fill=(78, 148, 92, 225), outline=INK_MID, width=2)
    # Brass steam faucets on right rim + slatted cedar duckboard bathmat beside tub!
    draw_disc(d, W - 122, H // 2 - 22, 11, BRASS_HI, ink_w=3)
    draw_disc(d, W - 122, H // 2 + 22, 11, BRASS_HI, ink_w=3)
    draw_beveled_rect(d, W - 92, 54, W - 36, H - 54, OAK, ink_w=4, radius=6)
    for sy in range(70, H - 62, 20):
        d.line([(W - 86, sy), (W - 42, sy)], fill=INK_MID, width=3)
    return apply_painterly_finish(im, w, h, seed=4205, grain=4.6, warm_bevel=True)


def gen_volksbad_towel_warmer_rack() -> Image.Image:
    w, h = 192, 128
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=10, fill=c), (6, 8), 8.0, 92)
    d = ImageDraw.Draw(im)
    # Heated copper pipe wall rack & wooden apothecary bath-salts shelf
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, OAK, ink_w=5, radius=10)
    for py in [58, 102, 146, 190]:
        draw_beveled_rect(d, 38, py - 7, W - 38, py + 7, COPPER, ink_w=3, radius=4)
    # Plump rolled steamy white & sage spa towels + glass eucalyptus bath-oil bottles!
    for tx in [78, 134, 190]:
        draw_beveled_rect(d, tx - 22, 46, tx + 22, H - 46, LINEN, ink_w=4, radius=14)
        d.line([(tx - 16, 78), (tx + 16, 78)], fill=(*TEAL, 210), width=4)
        d.line([(tx - 16, H - 78), (tx + 16, H - 78)], fill=(*TEAL, 210), width=4)
    for bx, by, bc in [(274, 88, EMERALD), (318, 94, CYAN_AETHER), (294, 154, GOLD)]:
        draw_disc(d, bx, by, 18, bc, ink_w=3)
        draw_disc(d, bx, by, 6, BRASS_HI, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=4206, grain=4.6, warm_bevel=True)


def gen_laundry_awning_teal() -> Image.Image:
    return draw_striped_awning(304, 112, 4207, TEAL, CREAM, BRASS)


# =============================================================================
# GROUP C (7): EULENBLICK ANTIQUARIAN BOOKSHOP & HOROLOGY CURIOSITIES
# =============================================================================
def gen_curio_glass_display_case() -> Image.Image:
    w, h = 288, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([22 + o[0], 26 + o[1], W - 22 + o[0], H - 26 + o[1]], radius=14, fill=c), (7, 9), 10.0, 96)
    d = ImageDraw.Draw(im)
    # Carved walnut museum display case lined in royal burgundy velvet!
    draw_beveled_rect(d, 20, 24, W - 20, H - 24, WALNUT, ink_w=5, radius=12)
    draw_beveled_rect(d, 38, 42, W - 38, H - 42, BURGUNDY, ink_w=4, radius=8)
    # Curiosities displayed on velvet cushions: brass astrolabe, gold pocket watches, ruby scarab, ivory scroll, emerald relic!
    draw_disc(d, 108, H // 2, 42, BRASS, ink_w=4)
    d.ellipse([80, H // 2 - 28, 136, H // 2 + 28], outline=INK, width=4)
    d.line([(72, H // 2), (144, H // 2)], fill=INK, width=4)
    d.line([(108, H // 2 - 36), (108, H // 2 + 36)], fill=INK, width=4)
    # Antique gold pocket watches & crimson scarab amulet
    draw_disc(d, 214, 98, 22, GOLD, ink_w=3)
    draw_disc(d, 214, 98, 13, CREAM, ink_w=2)
    draw_disc(d, 258, 172, 24, BRASS_HI, ink_w=3)
    draw_disc(d, 258, 172, 14, CYAN_AETHER, ink_w=2)
    # Rolled ancient illuminated manuscript scroll & magnifying loupe
    draw_beveled_rect(d, 314, 80, 412, 128, CREAM, ink_w=4, radius=14)
    d.line([(362, 82), (362, 126)], fill=(*CRIMSON, 235), width=6)
    draw_disc(d, 358, 184, 22, EMERALD, ink_w=4)
    # Gilded miniature clockwork owl statuette on right!
    draw_disc(d, 474, H // 2, 34, BRASS, ink_w=4)
    draw_disc(d, 462, H // 2 - 8, 8, AMBER_GLOW, ink_w=2)
    draw_disc(d, 486, H // 2 - 8, 8, AMBER_GLOW, ink_w=2)
    # Translucent beveled glass top reflection diagonal sheen!
    glass = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gd.rounded_rectangle([38, 42, W - 38, H - 42], radius=8, fill=(188, 224, 228, 44), outline=(*BRASS_HI, 210), width=4)
    gd.polygon([(58, 46), (176, 46), (108, H - 46), (48, H - 46)], fill=(244, 252, 255, 58))
    gd.polygon([(310, 46), (376, 46), (308, H - 46), (254, H - 46)], fill=(244, 252, 255, 42))
    im.alpha_composite(glass)
    return apply_painterly_finish(im, w, h, seed=4301, grain=4.4, warm_bevel=True)


def gen_antiquarian_appraisal_desk() -> Image.Image:
    w, h = 272, 160
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([22 + o[0], 24 + o[1], W - 22 + o[0], H - 24 + o[1]], radius=12, fill=c), (7, 9), 10.0, 96)
    d = ImageDraw.Draw(im)
    # Heavy carved walnut partner desk with embossed green-leather writing blotter!
    draw_beveled_rect(d, 20, 24, W - 20, H - 24, WALNUT, ink_w=5, radius=10)
    draw_beveled_rect(d, 108, 46, W - 108, H - 46, BAIZE_GRN, ink_w=4, radius=6)
    d.rounded_rectangle([116, 54, W - 116, H - 54], radius=4, outline=(*GOLD, 215), width=3)
    # Open illuminated codex in center + magnifying loupe + brass balance scales!
    draw_beveled_rect(d, 178, 86, 336, 224, MAHOGANY, ink_w=4, radius=6)
    draw_beveled_rect(d, 190, 96, 254, 214, CREAM, ink_w=2, radius=2)
    draw_beveled_rect(d, 260, 96, 324, 214, CREAM, ink_w=2, radius=2)
    for ly in range(114, 204, 14):
        d.line([(198, ly), (246, ly)], fill=INK_MID, width=2)
        d.line([(268, ly), (316, ly)], fill=INK_MID, width=2)
    # Magnifying glass resting on page
    draw_disc(d, 306, 174, 22, BRASS, ink_w=3)
    draw_disc(d, 306, 174, 14, GLASS_TINT, ink_w=2)
    d.line([(322, 190), (356, 222)], fill=INK, width=9)
    d.line([(322, 190), (356, 222)], fill=(*WALNUT, 255), width=5)
    # Stacks of rare leather books on left & brass apothecary balance scale on right
    for bx, by, bc in [(44, 52, BURGUNDY), (50, 148, PRUSSIAN), (42, 218, EMERALD)]:
        draw_beveled_rect(d, bx, by, bx + 54, by + 64, bc, ink_w=3, radius=4)
    draw_disc(d, W - 64, 96, 22, BRASS_HI, ink_w=3)
    draw_disc(d, W - 64, 214, 22, BRASS_HI, ink_w=3)
    d.line([(W - 64, 96), (W - 64, 214)], fill=INK, width=7)
    d.line([(W - 64, 96), (W - 64, 214)], fill=(*BRASS, 255), width=4)
    # Wax seal stamp & crimson wax drops
    draw_disc(d, 396, 128, 12, CRIMSON, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=4302, grain=4.8, warm_bevel=True)


def gen_clockmaker_horology_bench() -> Image.Image:
    w, h = 272, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([22 + o[0], 24 + o[1], W - 22 + o[0], H - 24 + o[1]], radius=10, fill=c), (7, 9), 9.0, 95)
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 20, 24, W - 20, H - 24, OAK, ink_w=5, radius=8)
    draw_wood_planks_box(d, 30, 34, W - 30, H - 34, PINE, random.Random(4303), horizontal=True, n_planks=6)
    # Raised jeweler's catch-lip & tiny compartmentalized brass parts tray along top!
    draw_beveled_rect(d, 34, 34, W - 34, 72, WALNUT, ink_w=4, radius=4)
    for px in range(52, W - 62, 56):
        draw_beveled_rect(d, px, 40, px + 44, 66, IRON_DK, ink_w=2, radius=3)
        draw_disc(d, px + 22, 53, 8, BRASS_HI, ink_w=2)
    # Disassembled brass clockface, gleaming gears, escapement wheels & glowing cyan aether lens!
    draw_disc(d, 152, 168, 52, BRASS, ink_w=5)
    draw_disc(d, 152, 168, 38, CREAM, ink_w=3)
    d.line([(152, 168), (152, 140)], fill=INK, width=4)
    d.line([(152, 168), (174, 174)], fill=INK, width=4)
    for gx, gy, gr, gc in [(264, 134, 28, BRASS_HI), (306, 176, 22, COPPER), (242, 206, 18, GOLD), (356, 148, 24, BRASS)]:
        draw_disc(d, gx, gy, gr, gc, ink_w=3)
        draw_disc(d, gx, gy, gr * 0.35, IRON_DK, ink_w=2)
    # Precision jeweler's tweezers & screwdrivers on velvet mat + glowing cyan magnifier lamp!
    draw_beveled_rect(d, 402, 92, W - 44, H - 46, PRUSSIAN, ink_w=4, radius=6)
    for ty in [118, 146, 174]:
        d.line([(416, ty), (W - 60, ty + 8)], fill=INK, width=6)
        d.line([(416, ty), (W - 60, ty + 8)], fill=(*ZINC, 255), width=3)
    add_glow(im, 456, 212, 32, 32, CYAN_AETHER, alpha=110, blur=12.0)
    d = ImageDraw.Draw(im)
    draw_disc(d, 456, 212, 18, BRASS, ink_w=3)
    draw_disc(d, 456, 212, 10, CYAN_AETHER, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=4303, grain=4.8, warm_bevel=True)


def gen_grandfather_orrery_clock() -> Image.Image:
    w, h = 160, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([54 + o[0], 34 + o[1], W - 54 + o[0], H - 34 + o[1]], radius=16, fill=c), (8, 10), 10.0, 98)
    d = ImageDraw.Draw(im)
    # Tall carved walnut crown viewed top-down with gilded brass moon-phase finial & clock bezel!
    draw_beveled_rect(d, 48, 36, W - 48, H - 36, WALNUT, ink_w=6, radius=18)
    draw_beveled_rect(d, 66, 54, W - 66, H - 54, MAHOGANY, ink_w=4, radius=12)
    # Ornate gilded brass celestial finial dome in center
    draw_disc(d, W // 2, H // 2, 54, BRASS, ink_w=5)
    draw_disc(d, W // 2, H // 2, 36, PRUSSIAN, ink_w=4)
    draw_disc(d, W // 2, H // 2, 16, GOLD, ink_w=3)
    # Twin side brass spire finials
    draw_disc(d, 74, H // 2, 14, BRASS_HI, ink_w=3)
    draw_disc(d, W - 74, H // 2, 14, BRASS_HI, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=4304, grain=4.8, warm_bevel=True)


def gen_rare_books_stack_pedestal() -> Image.Image:
    w, h = 192, 160
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([30 + o[0], 30 + o[1], W - 30 + o[0], H - 30 + o[1]], fill=c), (6, 8), 9.0, 92)
    d = ImageDraw.Draw(im)
    # Small oak library step-stool surrounded by cozy floor stacks of leather tomes & rolled maps!
    draw_beveled_rect(d, 132, 92, 266, 212, OAK, ink_w=5, radius=10)
    draw_beveled_rect(d, 144, 104, 254, 152, PINE, ink_w=3, radius=6)
    # Scattered angled folio stacks
    books = [
        (46, 54, 128, 126, BURGUNDY),
        (60, 142, 146, 228, PRUSSIAN),
        (246, 46, 336, 124, EMERALD),
        (258, 156, 344, 242, MAHOGANY),
        (134, 214, 234, 282, LEATHER),
    ]
    for x0, y0, x1, y1, bc in books:
        draw_beveled_rect(d, x0, y0, x1, y1, bc, ink_w=4, radius=5)
        d.line([(x0 + 10, y0 + 10), (x1 - 10, y0 + 10)], fill=(*GOLD, 215), width=3)
        d.line([(x0 + 10, y1 - 10), (x1 - 10, y1 - 10)], fill=(*CREAM, 210), width=4)
    # Rolled map tube resting diagonally
    draw_beveled_rect(d, 176, 122, 246, 146, CREAM, ink_w=3, radius=8)
    return apply_painterly_finish(im, w, h, seed=4305, grain=4.8, warm_bevel=True)


def gen_bookshop_awning_emerald() -> Image.Image:
    return draw_striped_awning(304, 112, 4306, EMERALD, CREAM, GOLD)


def gen_telescope_brass_tripod() -> Image.Image:
    w, h = 176, 144
    im = new_hi(w, h)
    W, H = im.size
    cx, cy = 148, H // 2
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([cx - 64 + o[0], cy - 64 + o[1], cx + 64 + o[0], cy + 64 + o[1]], fill=c), (6, 9), 9.0, 92)
    d = ImageDraw.Draw(im)
    # 3 splayed walnut tripod legs
    for ang in [-2.3, 0.0, 2.3]:
        ex, ey = cx + math.cos(ang) * 92, cy + math.sin(ang) * 86
        d.line([(cx, cy), (ex, ey)], fill=INK, width=16)
        d.line([(cx, cy), (ex, ey)], fill=(*WALNUT, 255), width=9)
        draw_disc(d, ex, ey, 8, BRASS, ink_w=2)
    # Brass azimuth yoke + long gleaming tapered brass refracting telescope barrel pointing right!
    draw_disc(d, cx, cy, 24, BRASS, ink_w=4)
    pts = [(64, cy - 12), (W - 26, cy - 28), (W - 26, cy + 28), (64, cy + 12)]
    d.polygon(pts, fill=(*BRASS, 255), outline=INK, width=5)
    d.line([(72, cy - 6), (W - 34, cy - 18)], fill=(*BRASS_HI, 255), width=5)
    # Focusing rings & cyan-glinting objective lens rim
    for rx in [120, 224, W - 36]:
        d.line([(rx, cy - 26), (rx, cy + 26)], fill=INK_DARK, width=5)
    draw_beveled_rect(d, W - 32, cy - 26, W - 18, cy + 26, CYAN_AETHER, ink_w=3, radius=4)
    return apply_painterly_finish(im, w, h, seed=4307, grain=4.6, warm_bevel=True)


# =============================================================================
# GROUP D (7): SEIDE & SOHLE BESPOKE TAILOR, MILLINER & COBBLER ATELIER
# =============================================================================
def gen_tailor_cutting_pattern_table() -> Image.Image:
    w, h = 304, 160
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([22 + o[0], 26 + o[1], W - 22 + o[0], H - 26 + o[1]], radius=12, fill=c), (7, 9), 10.0, 96)
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 20, 24, W - 20, H - 24, MAHOGANY, ink_w=5, radius=10)
    draw_wood_planks_box(d, 32, 36, W - 32, H - 36, OAK, random.Random(4401), horizontal=True, n_planks=6)
    # Unrolled bolt of rich royal crimson velvet draped across the table!
    draw_beveled_rect(d, 54, 48, 396, H - 48, CRIMSON, ink_w=4, radius=6)
    # Rolled fabric bolt cylinder at left end
    draw_beveled_rect(d, 44, 42, 92, H - 42, BURGUNDY, ink_w=5, radius=16)
    # White butcher-paper coat pattern templates & chalk dotted cutting lines!
    pat_pts = [(146, 78), (288, 66), (344, 114), (326, 232), (168, 244), (138, 164)]
    d.polygon(pat_pts, fill=(*CREAM, 255), outline=INK, width=4)
    for i in range(len(pat_pts)):
        p0, p1 = pat_pts[i], pat_pts[(i + 1) % len(pat_pts)]
        d.line([p0, p1], fill=(246, 242, 230, 220), width=2)
    # Yellow tailor's measuring tape ribbon curving on right
    tape_pts = [(412, 82), (464, 96), (484, 152), (446, 206), (518, 228)]
    d.line(tape_pts, fill=INK, width=14, joint="curve")
    d.line(tape_pts, fill=(*GOLD, 255), width=8, joint="curve")
    # Brass tailor's shears & red pincushion!
    d.line([(432, 134), (534, 108)], fill=INK, width=8)
    d.line([(432, 134), (534, 108)], fill=(*ZINC, 255), width=4)
    d.line([(432, 110), (534, 140)], fill=INK, width=8)
    d.line([(432, 110), (534, 140)], fill=(*ZINC, 255), width=4)
    draw_disc(d, 428, 122, 14, BRASS, ink_w=3)
    draw_disc(d, 524, 198, 20, CRIMSON, ink_w=4)
    for px, py in [(516, 192), (530, 194), (522, 206)]:
        draw_disc(d, px, py, 4, GOLD, ink_w=1)
    return apply_painterly_finish(im, w, h, seed=4401, grain=4.8, warm_bevel=True)


def gen_treadle_sewing_machine_desk() -> Image.Image:
    w, h = 208, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=10, fill=c), (6, 9), 9.0, 95)
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, ink_w=5, radius=10)
    draw_wood_planks_box(d, 34, 36, W - 34, H - 36, OAK, random.Random(4402), horizontal=True, n_planks=6)
    # Half-stitched emerald silk garment flowing under the needle plate!
    d.polygon([(112, 84), (242, 76), (228, 224), (96, 212)], fill=(*EMERALD, 255), outline=INK, width=4)
    # Classic black cast-iron & gold-filigree Singer-style sewing machine arm!
    draw_beveled_rect(d, 134, 102, 336, 184, IRON_DK, ink_w=5, radius=16)
    draw_beveled_rect(d, 162, 122, 304, 164, IRON, ink_w=3, radius=10)
    d.line([(178, 143), (288, 143)], fill=(*GOLD, 255), width=5)
    # Brass balance flywheel on right & colorful thread spools along back edge!
    draw_disc(d, 326, 143, 24, BRASS, ink_w=4)
    draw_disc(d, 326, 143, 12, IRON_DK, ink_w=3)
    for sx, sc in [(74, CRIMSON), (112, GOLD), (150, PRUSSIAN), (188, CREAM)]:
        draw_disc(d, sx, 60, 14, sc, ink_w=3)
        draw_disc(d, sx, 60, 5, OAK, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=4402, grain=4.8, warm_bevel=True)


def gen_tailor_dressmaker_mannequins() -> Image.Image:
    w, h = 176, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: (
        sd.ellipse([44 + o[0], 78 + o[1], 188 + o[0], 222 + o[1]], fill=c),
        sd.ellipse([172 + o[0], 68 + o[1], 312 + o[0], 208 + o[1]], fill=c),
    ), (6, 9), 9.0, 94)
    d = ImageDraw.Draw(im)
    # Pair of top-down bespoke mannequins wearing a Prussian-blue coat & burgundy evening jacket!
    for cx, cy, col, trim in [(116, 150, PRUSSIAN, GOLD), (242, 138, BURGUNDY, CREAM)]:
        # Brass pedestal base peeking beneath coat hem
        draw_disc(d, cx, cy, 62, BRASS, ink_w=4)
        # Tailored broad shoulders & lapels viewed from above!
        d.ellipse([cx - 56, cy - 38, cx + 56, cy + 38], fill=(*col, 255), outline=INK, width=5)
        d.polygon([(cx - 18, cy - 24), (cx + 18, cy - 24), (cx + 26, cy + 28), (cx - 26, cy + 28)], fill=(*trim, 240), outline=INK, width=3)
        # Linen dress-form neck post + brass finial knob!
        draw_disc(d, cx, cy, 20, LINEN, ink_w=4)
        draw_disc(d, cx, cy, 9, BRASS_HI, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=4403, grain=4.6, warm_bevel=True)


def gen_tailor_fitting_mirror_platform() -> Image.Image:
    w, h = 208, 160
    im = new_hi(w, h)
    W, H = im.size
    cx, cy = W // 2, H // 2 + 16
    add_contact_shadow(im, lambda sd, c, o: sd.ellipse([cx - 118 + o[0], cy - 102 + o[1], cx + 118 + o[0], cy + 102 + o[1]], fill=c), (6, 9), 9.0, 94)
    d = ImageDraw.Draw(im)
    # Octagonal mahogany & crimson-velvet customer fitting podium!
    pts = [(cx + math.cos(i * math.tau / 8 + math.pi / 8) * 116, cy + math.sin(i * math.tau / 8 + math.pi / 8) * 98) for i in range(8)]
    d.polygon(pts, fill=(*MAHOGANY, 255), outline=INK, width=5)
    pts_in = [(cx + math.cos(i * math.tau / 8 + math.pi / 8) * 94, cy + math.sin(i * math.tau / 8 + math.pi / 8) * 78) for i in range(8)]
    d.polygon(pts_in, fill=(*BURGUNDY, 255), outline=(*GOLD, 255), width=4)
    # Tri-fold gilded standing tailor's mirror arcing cleanly along the back (top) edge!
    mirror_pts = [(62, 114), (126, 48), (W - 126, 48), (W - 62, 114)]
    d.line(mirror_pts, fill=INK, width=22, joint="curve")
    d.line(mirror_pts, fill=(*BRASS_HI, 255), width=14, joint="curve")
    d.line([(x, y + 6) for x, y in mirror_pts], fill=(*GLASS_TINT, 255), width=6, joint="curve")
    return apply_painterly_finish(im, w, h, seed=4404, grain=4.6, warm_bevel=True)


def gen_cobbler_bootmaker_bench() -> Image.Image:
    w, h = 256, 144
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([22 + o[0], 26 + o[1], W - 22 + o[0], H - 26 + o[1]], radius=10, fill=c), (7, 9), 9.0, 95)
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 20, 24, W - 20, H - 24, WALNUT, ink_w=5, radius=8)
    draw_wood_planks_box(d, 32, 36, W - 32, H - 36, OAK, random.Random(4405), horizontal=True, n_planks=6)
    # Cast-iron cobbler's shoe-last anvil & wooden mallet on left
    draw_disc(d, 96, 144, 34, IRON_DK, ink_w=4)
    draw_beveled_rect(d, 74, 126, 128, 162, IRON, ink_w=3, radius=14)
    d.line([(136, 184), (194, 224)], fill=INK, width=10)
    d.line([(136, 184), (194, 224)], fill=(*PINE, 255), width=5)
    draw_beveled_rect(d, 114, 168, 152, 202, WALNUT, ink_w=3, radius=5)
    # Tanned leather hides rolled in center + awl & waxed thread
    draw_beveled_rect(d, 198, 56, 314, 134, LEATHER, ink_w=4, radius=14)
    draw_beveled_rect(d, 212, 146, 306, 208, LEATHER_DK, ink_w=4, radius=12)
    # Pair of gleaming finished polished leather boots on display rack on right!
    for by in [84, 174]:
        draw_beveled_rect(d, 356, by - 26, 464, by + 26, LEATHER_DK, ink_w=4, radius=18)
        draw_disc(d, 384, by, 18, (46, 28, 18), ink_w=3)
        d.line([(412, by - 8), (446, by - 8)], fill=(*BRASS_HI, 220), width=3)
        d.line([(412, by + 8), (446, by + 8)], fill=(*BRASS_HI, 220), width=3)
    return apply_painterly_finish(im, w, h, seed=4405, grain=4.8, warm_bevel=True)


def gen_tailor_colorable_cloth_display() -> Image.Image:
    w, h = 240, 128
    im = new_hi(w, h)
    W, H = im.size
    add_contact_shadow(im, lambda sd, c, o: sd.rounded_rectangle([22 + o[0], 24 + o[1], W - 22 + o[0], H - 24 + o[1]], radius=10, fill=c), (6, 8), 9.0, 94)
    d = ImageDraw.Draw(im)
    # Walnut shelving unit filled with pure dd_red colorable silk & wool fabric bolts!
    draw_beveled_rect(d, 20, 22, W - 20, H - 22, WALNUT, ink_w=5, radius=8)
    for rx in range(44, W - 54, 72):
        draw_beveled_rect(d, rx, 36, rx + 54, H - 36, DD_RED_BASE, ink_w=4, radius=12, hi_amt=0.28, sh_amt=0.36)
        # Wrapped golden paper band around bolt center
        draw_beveled_rect(d, rx + 2, H // 2 - 14, rx + 52, H // 2 + 14, DD_RED_HI, ink_w=2, radius=3)
        d.line([(rx + 8, 56), (rx + 46, 56)], fill=(*DD_RED_DEEP, 255), width=3)
        d.line([(rx + 8, H - 56), (rx + 46, H - 56)], fill=(*DD_RED_DEEP, 255), width=3)
    return apply_painterly_finish(im, w, h, seed=4406, grain=4.6, warm_bevel=True)


def gen_shop_colorable_boulevard_awning() -> Image.Image:
    return draw_striped_awning(304, 112, 4407, DD_RED_BASE, CREAM, BRASS)


SPECS = [
    # Group A — Building 1: Vintner's & Wine Bar (7)
    ("bs_vintner_tasting_bar.png", "Walnut & Brass Vintner's Wine Tasting Bar", "normal",
     ["boulevard_shops", "vintner", "wine", "bar", "tavern", "shop", "counter", "hero", "harmony"], gen_vintner_tasting_bar),
    ("bs_vintner_bottle_wall_rack.png", "Mahogany Vintage Wine Bottle Display Rack", "normal",
     ["boulevard_shops", "vintner", "wine", "bottles", "shelf", "shop", "tavern", "harmony"], gen_vintner_bottle_wall_rack),
    ("bs_vintner_cheese_charcuterie_board.png", "Oak Cheese Wheel, Grapes & Charcuterie Board", "normal",
     ["boulevard_shops", "vintner", "wine", "food", "cheese", "modular", "clutter", "harmony"], gen_vintner_cheese_charcuterie_board),
    ("bs_vintner_counting_safe_cabinet.png", "Berlin Brass-Dial Floor Safe & Counting Ledger", "normal",
     ["boulevard_shops", "vintner", "safe", "office", "bank", "vault", "strongbox", "harmony"], gen_vintner_counting_safe_cabinet),
    ("bs_vintner_wine_barrel_display.png", "Brass-Hooped Vintner Tasting Casks & Goblets", "normal",
     ["boulevard_shops", "vintner", "wine", "barrel", "cask", "shop", "tavern", "harmony"], gen_vintner_wine_barrel_display),
    ("bs_vintner_awning_burgundy.png", "Burgundy & Cream Scalloped Vintner's Awning", "normal",
     ["boulevard_shops", "vintner", "awning", "canopy", "roof", "street", "shop", "harmony"], gen_vintner_awning_burgundy),
    ("bs_vintner_cork_crate_bottles.png", "Open Straw-Packed Vintage Wine Shipping Crate", "normal",
     ["boulevard_shops", "vintner", "wine", "crate", "bottles", "modular", "storage", "harmony"], gen_vintner_cork_crate_bottles),
    # Group B — Building 2: Steam Laundry & Volksbad (7)
    ("bs_steam_garment_press_machine.png", "Magipunk Aether Steam Garment Press & Mangle", "normal",
     ["boulevard_shops", "laundry", "steam", "magipunk", "aether", "machinery", "shop", "hero", "harmony"], gen_steam_garment_press_machine),
    ("bs_laundry_dropoff_counter.png", "Zinc-Topped Laundry Drop-Off & Linen Counter", "normal",
     ["boulevard_shops", "laundry", "counter", "shop", "linen", "berlin", "harmony"], gen_laundry_dropoff_counter),
    ("bs_hanging_garment_rack_brass.png", "Brass Rolling Pressed-Garment Coat Rack", "normal",
     ["boulevard_shops", "laundry", "tailor", "clothes", "rack", "shop", "home", "harmony"], gen_hanging_garment_rack_brass),
    ("bs_ironing_board_flatiron.png", "Padded Linen Ironing Board & Coal Flatiron", "normal",
     ["boulevard_shops", "laundry", "ironing", "modular", "home", "shop", "harmony"], gen_ironing_board_flatiron),
    ("bs_volksbad_tiled_soaking_tub.png", "Volksbad Ceramic Steam Soaking Tub & Duckboard", "normal",
     ["boulevard_shops", "bath", "bathhouse", "tub", "steam", "water", "home", "hero", "harmony"], gen_volksbad_tiled_soaking_tub),
    ("bs_volksbad_towel_warmer_rack.png", "Copper-Pipe Heated Towel Rack & Bath Oils", "normal",
     ["boulevard_shops", "bath", "bathhouse", "towel", "copper", "home", "harmony"], gen_volksbad_towel_warmer_rack),
    ("bs_laundry_awning_teal.png", "Prussian-Teal & Cream Scalloped Laundry Awning", "normal",
     ["boulevard_shops", "laundry", "awning", "canopy", "roof", "street", "shop", "harmony"], gen_laundry_awning_teal),
    # Group C — Building 3: Antiquarian Bookshop & Horology (7)
    ("bs_curio_glass_display_case.png", "Beveled-Glass Antiquarian Relic & Curio Case", "normal",
     ["boulevard_shops", "antiquarian", "bookshop", "curio", "relic", "shop", "arcane", "hero", "harmony"], gen_curio_glass_display_case),
    ("bs_antiquarian_appraisal_desk.png", "Antiquarian's Green-Leather Appraisal Desk", "normal",
     ["boulevard_shops", "antiquarian", "bookshop", "desk", "office", "library", "shop", "harmony"], gen_antiquarian_appraisal_desk),
    ("bs_clockmaker_horology_bench.png", "Horologist's Clockwork & Aether-Lens Bench", "normal",
     ["boulevard_shops", "antiquarian", "clockwork", "horology", "workbench", "magipunk", "hero", "harmony"], gen_clockmaker_horology_bench),
    ("bs_grandfather_orrery_clock.png", "Carved Walnut Celestial Grandfather Clock", "normal",
     ["boulevard_shops", "antiquarian", "clock", "clockwork", "furniture", "home", "office", "harmony"], gen_grandfather_orrery_clock),
    ("bs_rare_books_stack_pedestal.png", "Library Step-Stool & Towering Rare Book Stacks", "normal",
     ["boulevard_shops", "antiquarian", "bookshop", "books", "library", "modular", "office", "harmony"], gen_rare_books_stack_pedestal),
    ("bs_bookshop_awning_emerald.png", "Deep-Emerald & Gold Scalloped Bookshop Awning", "normal",
     ["boulevard_shops", "antiquarian", "bookshop", "awning", "canopy", "roof", "street", "harmony"], gen_bookshop_awning_emerald),
    ("bs_telescope_brass_tripod.png", "Brass Astronomer's Refracting Telescope on Tripod", "normal",
     ["boulevard_shops", "antiquarian", "telescope", "astronomy", "brass", "modular", "office", "harmony"], gen_telescope_brass_tripod),
    # Group D — Building 4: Bespoke Tailor & Cobbler Atelier (7)
    ("bs_tailor_cutting_pattern_table.png", "Mahogany Tailor's Cutting & Pattern Table", "normal",
     ["boulevard_shops", "tailor", "fabric", "sewing", "table", "shop", "hero", "harmony"], gen_tailor_cutting_pattern_table),
    ("bs_treadle_sewing_machine_desk.png", "Vintage Cast-Iron & Walnut Treadle Sewing Desk", "normal",
     ["boulevard_shops", "tailor", "sewing", "desk", "shop", "workshop", "harmony"], gen_treadle_sewing_machine_desk),
    ("bs_tailor_dressmaker_mannequins.png", "Pair of Brass Tailor's Dressmaker Mannequins", "normal",
     ["boulevard_shops", "tailor", "mannequin", "clothes", "shop", "modular", "harmony"], gen_tailor_dressmaker_mannequins),
    ("bs_tailor_fitting_mirror_platform.png", "Velvet Fitting Pedestal & Tri-Fold Gilt Mirror", "normal",
     ["boulevard_shops", "tailor", "mirror", "fitting", "shop", "home", "harmony"], gen_tailor_fitting_mirror_platform),
    ("bs_cobbler_bootmaker_bench.png", "Cobbler's Leather-Stitching & Bootmaker Bench", "normal",
     ["boulevard_shops", "tailor", "cobbler", "boots", "leather", "workbench", "shop", "harmony"], gen_cobbler_bootmaker_bench),
    ("bs_tailor_colorable_cloth_display.png", "Colorable Silk & Wool Fabric Bolt Shelf (dd_red)", "dd_red",
     ["boulevard_shops", "tailor", "fabric", "colorable", "dd_red", "shop", "modular", "harmony"], gen_tailor_colorable_cloth_display),
    ("bs_shop_colorable_boulevard_awning.png", "Colorable Scalloped Boulevard Shop Awning (dd_red)", "dd_red",
     ["boulevard_shops", "awning", "canopy", "roof", "colorable", "dd_red", "street", "shop", "harmony"], gen_shop_colorable_boulevard_awning),
]


def main() -> None:
    qa_items: list[tuple[str, Image.Image]] = []
    manifest_entries: list[dict] = []

    for fname, display_name, draw_mode, tags, fn in SPECS:
        im = fn()
        im.save(OUT_DIR / fname)
        qa_items.append((fname.replace("bs_", "").replace(".png", ""), im))
        manifest_entries.append({
            "path": f"props/boulevard_shops/{fname}",
            "displayName": display_name,
            "category": "object",
            "widthPx": im.width,
            "heightPx": im.height,
            "defaultPpi": 256,
            "drawMode": draw_mode,
            "dominantHex": dominant_hex(im),
            "castsShadow": True,
            "tags": tags,
        })

    upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    qa_path = SCRATCH_DIR / "qa_boulevard_shops_suite.png"
    save_qa_sheet(qa_items, qa_path, cols=7)
    print(f"Generated {len(manifest_entries)} boulevard shop assets -> {OUT_DIR}")
    print(f"QA sheet -> {qa_path}")


if __name__ == "__main__":
    main()

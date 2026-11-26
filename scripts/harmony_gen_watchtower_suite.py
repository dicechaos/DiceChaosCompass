"""
Dice Chaos Compass — 25-Asset Painterly Watchtower Garrison & Magipunk Signal Suite

Generates 25 bespoke true top-down CC0 assets in:
  `public/assets/modular-suite-cc0/props/watchtower_garrison/`

Covers all 5 vertical stories + crenellated battlement crown of a Berlin-Magipunk District Watchtower:
  - Vertical Core & Gatehouse (6): Fortress Spiral Stair, Padlocked Pump-Shaft Hatch, Wanted/Curfew Board,
    Duty Sergeant's Booking Desk, Brass Speaking-Tube Manifold, Locked Cell-Key Cabinet
  - Armory & Garrison Barracks (8): Halberd/Rifle/Aether-Carbine Rack, Armorer's Cleaning Bench,
    Signal Flare Munitions Crate, Sentry Cuirass & Pickelhaube Stand, Lived-In Garrison Bunk Cot,
    Wet Greatcoat & Boot Drying Bench, Shift-Change Mess Ration Table, Patrol Shift Roster Table
  - Watch Captain's Command Office (3): Illuminated Circular Tactical District War-Map Table (Hero),
    Magipunk Aether-Telegraph & Pneumatic Dispatch Console, Iron-Bound Suspect Dossier Cabinet
  - Battlement Crown & Signal Post (8): Swiveling Magipunk Aether Searchlight Turret (Hero),
    360° Brass Articulated Rangefinder, Heavy Cast-Bronze District Alarm Bell, Searchlight Aether
    Capacitor Bank, Semaphore Signal Flag Locker, Curved Sandbag Battlement Cover Arc,
    plus 2 dd_red Colorable Garrison Assets (Watchtower Pennant Flag & Circular Woven Tower Rug).

All 2x-supersampled in our unified hand-inked painterly Harmony style (#1E1816 charcoal ink,
100% opaque interiors, alpha_composite shadows/glows, zero white halos).
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
    blend_rgb,
    vary_rgb,
    save_qa_sheet,
    upsert_manifest_entries,
    dominant_hex,
)

OUT_DIR = MOD_DIR / "props" / "watchtower_garrison"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Unified Berlin-Magipunk Watchtower Garrison Palette
BRASS = (202, 160, 78)
BRASS_GOLD = (228, 188, 92)
BRASS_DK = (144, 110, 52)
COPPER = (194, 116, 74)
VERDIGRIS = (88, 146, 132)
IRON = (74, 82, 94)
IRON_DK = (48, 54, 64)
STEEL = (138, 148, 162)
STEEL_HI = (194, 204, 218)
STONE = (128, 132, 138)
STONE_DK = (86, 90, 98)
STONE_LT = (162, 164, 166)
SLATE = (66, 74, 88)
OAK = (146, 102, 62)
WALNUT = (94, 62, 40)
MAHOGANY = (112, 52, 42)
PINE = (182, 142, 92)
NAVY = (42, 62, 92)
NAVY_HI = (68, 94, 132)
CRIMSON = (168, 44, 52)
PARCHMENT = (226, 212, 180)
PAPER = (240, 232, 212)
BURLAP = (176, 152, 114)
LEATHER = (108, 66, 42)
CYAN = (74, 224, 255)
CYAN_CORE = (212, 250, 255)
AMBER = (255, 194, 88)
GREEN_BAIZE = (54, 106, 74)


def draw_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rgb: tuple[int, int, int] | tuple[int, int, int, int],
    ink_w: int = 5,
) -> None:
    rgb3 = (rgb[0], rgb[1], rgb[2])
    dk = blend_rgb(rgb3, (16, 14, 14), 0.44)
    hi = blend_rgb(rgb3, (255, 248, 230), 0.40)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dk, outline=INK, width=ink_w)
    d.ellipse([cx - r * 0.85, cy - r * 0.85, cx + r * 0.85, cy + r * 0.85], fill=(*rgb3, 255))
    if r >= 10:
        d.arc(
            [cx - r * 0.70, cy - r * 0.70, cx + r * 0.70, cy + r * 0.70],
            195,
            310,
            fill=hi,
            width=max(3, int(r * 0.14)),
        )


def rot_pt(cx: float, cy: float, x: float, y: float, ang: float) -> tuple[float, float]:
    ca, sa = math.cos(ang), math.sin(ang)
    return (cx + x * ca - y * sa, cy + x * sa + y * ca)


def draw_rot_rect(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    w: float,
    h: float,
    ang: float,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    outline: tuple[int, int, int, int] = INK,
    ink_w: int = 4,
) -> None:
    hw, hh = w * 0.5, h * 0.5
    pts = [
        rot_pt(cx, cy, -hw, -hh, ang),
        rot_pt(cx, cy, hw, -hh, ang),
        rot_pt(cx, cy, hw, hh, ang),
        rot_pt(cx, cy, -hw, hh, ang),
    ]
    rgba = fill if len(fill) == 4 else (*fill, 255)
    d.polygon(pts, fill=rgba)
    d.line(pts + [pts[0]], fill=outline, width=ink_w)


def draw_paper_sheet(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    w: float,
    h: float,
    ang: float = 0.0,
    seal: bool = False,
) -> None:
    draw_rot_rect(d, cx, cy, w, h, ang, PAPER, INK_MID, 3)
    for dy in (-h * 0.25, 0.0, h * 0.22):
        p0 = rot_pt(cx, cy, -w * 0.34, dy, ang)
        p1 = rot_pt(cx, cy, w * 0.34, dy, ang)
        d.line([p0, p1], fill=(116, 104, 88, 255), width=2)
    if seal:
        sp = rot_pt(cx, cy, w * 0.22, h * 0.24, ang)
        draw_disc(d, sp[0], sp[1], max(5.0, min(w, h) * 0.14), CRIMSON, ink_w=2)


# =============================================================================
# 1. FORTRESS ASHLAR & IRON-RAIL SPIRAL STAIRCASE (256x256)
# =============================================================================
def gen_fortress_spiral_stair(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    r_out = W * 0.44
    r_in = W * 0.13

    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse(
            [cx - r_out + o[0], cy - r_out + o[1], cx + r_out + o[0], cy + r_out + o[1]],
            fill=c,
        ),
        (8, 10),
        12.0,
        115,
    )
    d = ImageDraw.Draw(im)

    # Outer forged-iron structural ring curb
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=(*IRON_DK, 255), outline=INK, width=7)
    r_tread = r_out - 14

    # 14 radiating dressed ashlar granite wedge steps climbing clockwise with progressive depth shading!
    n_steps = 14
    for i in range(n_steps):
        a0 = -math.pi * 0.55 + (i / n_steps) * math.tau * 0.94
        a1 = -math.pi * 0.55 + ((i + 1) / n_steps) * math.tau * 0.94
        # Progressive height luminance: lowest steps darker slate in stairwell shadow, top landing bright granite!
        prog = i / (n_steps - 1)
        base_tone = (
            int(74 + prog * 86),
            int(78 + prog * 84),
            int(86 + prog * 78),
        )
        step_rgb = vary_rgb(base_tone, rng, 6)
        hi = blend_rgb(step_rgb, (242, 240, 232), 0.32)
        dk = blend_rgb(step_rgb, (18, 20, 24), 0.36)

        pts = [
            (cx + math.cos(a0) * r_in, cy + math.sin(a0) * r_in),
            (cx + math.cos(a0) * r_tread, cy + math.sin(a0) * r_tread),
            (cx + math.cos((a0 + a1) * 0.5) * r_tread, cy + math.sin((a0 + a1) * 0.5) * r_tread),
            (cx + math.cos(a1) * r_tread, cy + math.sin(a1) * r_tread),
            (cx + math.cos(a1) * r_in, cy + math.sin(a1) * r_in),
        ]
        d.polygon(pts, fill=(*step_rgb, 255))
        # Dark riser drop shadow along leading edge + crisp chisel nosing highlight
        d.line([pts[0], pts[1]], fill=dk, width=8)
        d.line([pts[4], pts[3]], fill=hi, width=5)
        # Riveted iron anti-slip tread bar across middle of each stone step
        am = (a0 + a1) * 0.52
        d.line(
            [
                (cx + math.cos(am) * (r_in + 22), cy + math.sin(am) * (r_in + 22)),
                (cx + math.cos(am) * (r_tread - 18), cy + math.sin(am) * (r_tread - 18)),
            ],
            fill=(*IRON, 255),
            width=4,
        )
        d.line(pts + [pts[0]], fill=INK, width=5)

    # Dark stairwell drop-gap wedge where steps descend into the lower level
    ga0 = -math.pi * 0.55 + 0.94 * math.tau
    ga1 = -math.pi * 0.55 + math.tau
    gap_pts = [
        (cx + math.cos(ga0) * r_in, cy + math.sin(ga0) * r_in),
        (cx + math.cos(ga0) * r_tread, cy + math.sin(ga0) * r_tread),
        (cx + math.cos(ga1) * r_tread, cy + math.sin(ga1) * r_tread),
        (cx + math.cos(ga1) * r_in, cy + math.sin(ga1) * r_in),
    ]
    d.polygon(gap_pts, fill=(22, 24, 30, 255))
    d.line(gap_pts + [gap_pts[0]], fill=INK, width=6)

    # Outer curved iron handrail with polished brass newel rivets around 90% of rim
    r_rail = r_out - 9
    rail_pts = [
        (
            cx + math.cos(-math.pi * 0.50 + (k / 40) * math.tau * 0.88) * r_rail,
            cy + math.sin(-math.pi * 0.50 + (k / 40) * math.tau * 0.88) * r_rail,
        )
        for k in range(41)
    ]
    d.line(rail_pts, fill=INK, width=16)
    d.line(rail_pts, fill=(*IRON, 255), width=9)
    d.line(rail_pts, fill=(*BRASS, 255), width=4)
    for k in range(0, 41, 8):
        draw_disc(d, rail_pts[k][0], rail_pts[k][1], 11, BRASS_GOLD, ink_w=3)

    # Heavy riveted cast-iron central newel column with brass finial cap
    draw_disc(d, cx, cy, r_in + 6, IRON_DK, ink_w=6)
    draw_disc(d, cx, cy, r_in * 0.72, IRON, ink_w=4)
    draw_disc(d, cx, cy, r_in * 0.38, BRASS_GOLD, ink_w=4)
    for k in range(6):
        ra = k * math.tau / 6
        draw_disc(d, cx + math.cos(ra) * (r_in * 0.82), cy + math.sin(ra) * (r_in * 0.82), 5, STEEL_HI, ink_w=2)

    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


# =============================================================================
# 2. PADLOCKED CAST-IRON MAINTENANCE FLOOR HATCH (192x192)
# =============================================================================
def gen_iron_pump_hatch(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([34 + o[0], 34 + o[1], W - 34 + o[0], H - 34 + o[1]], radius=16, fill=c),
        (5, 6),
        8.0,
        90,
    )
    d = ImageDraw.Draw(im)
    # Stone recessed curb surround
    draw_beveled_rect(d, 32, 32, W - 32, H - 32, STONE_DK, ink_w=6, radius=14)
    # Yellow/black worn municipal hazard stripe band around outer iron frame
    draw_beveled_rect(d, 52, 52, W - 52, H - 52, IRON_DK, ink_w=6, radius=10)
    for i in range(6):
        sx = 64 + i * 44
        d.line([(sx, 58), (sx + 18, 72)], fill=(198, 152, 52, 255), width=8)
        d.line([(sx, H - 72), (sx + 18, H - 58)], fill=(198, 152, 52, 255), width=8)
    # Diamond-plate cast iron trapdoor lid
    draw_beveled_rect(d, 74, 74, W - 74, H - 74, IRON, ink_w=6, radius=8)
    for gx in range(96, W - 86, 32):
        for gy in range(96, H - 86, 32):
            d.line([(gx - 6, gy), (gx + 6, gy)], fill=STEEL, width=3)
            d.line([(gx, gy - 6), (gx, gy + 6)], fill=IRON_DK, width=2)
    # Heavy forged hinges along top edge
    for hx in (122, W - 122):
        draw_beveled_rect(d, hx - 20, 62, hx + 20, 96, STEEL, ink_w=4, radius=4)
    # Recessed iron pull ring at center-bottom
    d.ellipse([cx - 28, cy + 16, cx + 28, cy + 72], outline=INK, width=14)
    d.ellipse([cx - 28, cy + 16, cx + 28, cy + 72], outline=(*STEEL_HI, 255), width=6)
    # Heavy brass padlock & hasp securing bottom lip!
    draw_beveled_rect(d, cx - 18, H - 96, cx + 18, H - 46, BRASS, ink_w=4, radius=6)
    d.arc([cx - 14, H - 114, cx + 14, H - 80], 180, 360, fill=INK, width=10)
    d.arc([cx - 14, H - 114, cx + 14, H - 80], 180, 360, fill=(*STEEL_HI, 255), width=4)
    d.ellipse([cx - 5, H - 74, cx + 5, H - 64], fill=INK_DARK)
    # Corner rivets
    for rx, ry in ((88, 88), (W - 88, 88), (88, H - 88), (W - 88, H - 88)):
        draw_disc(d, rx, ry, 7, STEEL, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


# =============================================================================
# 3. DISTRICT WANTED POSTERS & CURFEW NOTICE BOARD (224x128)
# =============================================================================
def gen_wanted_curfew_board(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 34 + o[1], W - 24 + o[0], H - 30 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        105,
    )
    d = ImageDraw.Draw(im)
    # Heavy timber & iron top-down standing bulletin board roof/frame with angled pinned posters peeking out
    draw_beveled_rect(d, 26, 46, W - 26, H - 44, WALNUT, ink_w=6, radius=10)
    draw_wood_planks_box(d, 42, 62, W - 42, H - 60, (124, 88, 54), rng, horizontal=True, n_planks=4, ink_w=4)
    # 4 overlapping parchment wanted flyers & curfew proclamations pinned along board face!
    draw_paper_sheet(d, 108, H * 0.50, 74, 92, -0.08, seal=True)
    draw_paper_sheet(d, 188, H * 0.48, 72, 88, 0.05, seal=False)
    draw_paper_sheet(d, 266, H * 0.52, 76, 90, -0.04, seal=True)
    draw_paper_sheet(d, 344, H * 0.49, 68, 84, 0.09, seal=False)
    # Silhouette mugshot sketch heads on flyers 1 & 3
    for mx in (108, 266):
        d.ellipse([mx - 14, H * 0.38 - 14, mx + 14, H * 0.38 + 14], fill=INK_MID)
        d.arc([mx - 20, H * 0.44, mx + 20, H * 0.62], 180, 360, fill=INK_MID, width=6)
    # Brass top overhang cap bar + corner iron bolts
    draw_beveled_rect(d, 20, 30, W - 20, 58, IRON_DK, ink_w=5, radius=8)
    for bx in (44, W * 0.5, W - 44):
        draw_disc(d, bx, 44, 9, BRASS_GOLD, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 4. GUARDHOUSE DUTY SERGEANT'S BOOKING DESK (256x160)
# =============================================================================
def gen_duty_booking_desk(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 28 + o[1], W - 24 + o[0], H - 28 + o[1]], radius=14, fill=c),
        (8, 10),
        12.0,
        110,
    )
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 30, W - 26, H - 30, OAK, rng, horizontal=True, n_planks=5, ink_w=6)
    # Dark Prussian-leather desk blotter center
    draw_beveled_rect(d, 138, 62, 348, H - 56, NAVY, ink_w=5, radius=8)
    # Open heavy booking ledger with red margin line & ink handwriting
    draw_beveled_rect(d, 160, 80, 326, H - 72, WALNUT, ink_w=5, radius=6)
    draw_beveled_rect(d, 168, 88, 240, H - 80, PAPER, ink_w=3, radius=3)
    draw_beveled_rect(d, 246, 88, 318, H - 80, PAPER, ink_w=3, radius=3)
    for ly in range(106, H - 92, 18):
        d.line([(178, ly), (230, ly)], fill=INK_MID, width=3)
        d.line([(256, ly), (308, ly)], fill=INK_MID, width=3)
    d.line([(184, 92), (184, H - 84)], fill=(184, 54, 58, 255), width=2)
    # Brass inkwell & quill nib
    draw_disc(d, 366, 94, 18, BRASS, ink_w=4)
    draw_disc(d, 366, 94, 8, INK_DARK, ink_w=2)
    d.line([(368, 94), (416, 54)], fill=PAPER, width=6)
    d.line([(368, 94), (416, 54)], fill=INK, width=2)
    # Brass service bell + iron key ring with 3 keys on left side!
    draw_disc(d, 82, 92, 24, BRASS_GOLD, ink_w=4)
    draw_disc(d, 82, 92, 8, IRON_DK, ink_w=2)
    d.ellipse([64, 174, 108, 218], outline=INK, width=8)
    d.ellipse([64, 174, 108, 218], outline=(*STEEL_HI, 255), width=4)
    for ang in (0.3, 0.85, 1.4):
        p1 = (86 + math.cos(ang) * 46, 196 + math.sin(ang) * 46)
        d.line([(86, 196), p1], fill=INK, width=8)
        d.line([(86, 196), p1], fill=(*BRASS, 255), width=4)
    # Confiscated leather coin pouch & enamel coffee mug on right side
    draw_disc(d, 424, 148, 26, LEATHER, ink_w=4)
    draw_disc(d, 424, 148, 10, BRASS_GOLD, ink_w=2)
    draw_disc(d, 430, 228, 24, (72, 118, 134), ink_w=4)
    draw_disc(d, 430, 228, 16, (56, 36, 24), ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# 5. VERTICAL BRASS AETHER-VOICE SPEAKING TUBE MANIFOLD (144x144)
# =============================================================================
def gen_speaking_tube_pipe(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([54 + o[0], 54 + o[1], W - 54 + o[0], H - 54 + o[1]], fill=c),
        (6, 7),
        9.0,
        95,
    )
    add_glow(im, cx, cy, 78, 78, AMBER, alpha=52, blur=16.0)
    d = ImageDraw.Draw(im)
    # Cast-iron wall mounting flange plate
    draw_beveled_rect(d, 56, 44, W - 56, 104, IRON_DK, ink_w=5, radius=12)
    # Twin vertical brass acoustic riser pipes rising through ceiling/floor
    draw_disc(d, cx - 34, 88, 24, COPPER, ink_w=5)
    draw_disc(d, cx + 34, 88, 24, COPPER, ink_w=5)
    # Projecting flared brass mouthpiece horn & whistle plug pointing south into room!
    d.polygon([(cx - 18, 92), (cx + 18, 92), (cx + 42, 212), (cx - 42, 212)], fill=(*BRASS, 255), outline=INK)
    d.line([(cx - 18, 92), (cx - 42, 212), (cx + 42, 212), (cx + 18, 92)], fill=INK, width=6)
    draw_disc(d, cx, 206, 38, BRASS_GOLD, ink_w=5)
    draw_disc(d, cx, 206, 22, (42, 30, 22), ink_w=4)
    # Brass call-whistle lever tab on side
    d.line([(cx + 22, 148), (cx + 62, 134)], fill=INK, width=10)
    d.line([(cx + 22, 148), (cx + 62, 134)], fill=(*BRASS_GOLD, 255), width=5)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 6. LOCKED IRON CELL-KEY PEGBOARD & LEDGER RACK (160x112)
# =============================================================================
def gen_key_cabinet_wall(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=10, fill=c),
        (6, 7),
        8.0,
        95,
    )
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 26, 28, W - 26, H - 28, IRON_DK, ink_w=6, radius=10)
    draw_beveled_rect(d, 44, 46, W - 44, H - 46, SLATE, ink_w=4, radius=6)
    # 2 rows of hanging brass & iron cell keys with tiny parchment tag discs
    for row_y in (82, 142):
        for col_x in (76, 128, 180, 232):
            draw_disc(d, col_x, row_y, 12, BRASS_GOLD, ink_w=3)
            d.line([(col_x, row_y + 10), (col_x, row_y + 34)], fill=INK, width=8)
            d.line([(col_x, row_y + 10), (col_x, row_y + 34)], fill=(*STEEL_HI, 255), width=4)
            d.line([(col_x, row_y + 28), (col_x + 12, row_y + 28)], fill=STEEL_HI, width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 7. GARRISON HALBERD, RIFLE & AETHER-CARBINE RACK (256x144)
# =============================================================================
def gen_garrison_armory_rack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([22 + o[0], 34 + o[1], W - 22 + o[0], H - 34 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        105,
    )
    add_glow(im, W * 0.72, H * 0.5, 86, 56, CYAN, alpha=58, blur=16.0)
    d = ImageDraw.Draw(im)
    # Heavy bolted oak floor trough & vertical rack frame
    draw_wood_planks_box(d, 24, 38, W - 24, H - 38, WALNUT, rng, horizontal=True, n_planks=4, ink_w=6)
    draw_beveled_rect(d, 42, 108, W - 42, 152, IRON_DK, ink_w=5, radius=6)
    # 5 percussion rifles / bayoneted carbines standing in left slots
    for i in range(5):
        rx = 66 + i * 44
        # Wooden rifle stock & steel barrel with brass barrel bands
        draw_beveled_rect(d, rx - 10, 56, rx + 10, H - 56, OAK, ink_w=4, radius=6)
        draw_beveled_rect(d, rx - 5, 44, rx + 5, 168, STEEL, ink_w=3, radius=3)
        d.line([(rx - 8, 92), (rx + 8, 92)], fill=BRASS_GOLD, width=5)
        d.line([(rx - 8, 146), (rx + 8, 146)], fill=BRASS_GOLD, width=5)
    # 2 Magipunk Cyan Aether-Carbines in middle-right slots (glowing cyan crystal chamber!)
    for i in range(2):
        rx = 304 + i * 54
        draw_beveled_rect(d, rx - 12, 54, rx + 12, H - 54, IRON, ink_w=4, radius=6)
        draw_beveled_rect(d, rx - 7, 106, rx + 7, 164, CYAN, ink_w=3, radius=4)
        d.line([(rx, 112), (rx, 158)], fill=CYAN_CORE, width=4)
        d.line([(rx - 10, 86), (rx + 10, 86)], fill=BRASS_GOLD, width=6)
    # 2 gleaming steel Watch Halberds racked at far right!
    for i in range(2):
        rx = 422 + i * 38
        d.line([(rx, 46), (rx, H - 46)], fill=INK, width=12)
        d.line([(rx, 46), (rx, H - 46)], fill=(*OAK, 255), width=6)
        # Crescent axe blade + spike tip
        d.polygon([(rx, 42), (rx + 22, 68), (rx + 18, 104), (rx, 90)], fill=(*STEEL_HI, 255), outline=INK)
        d.line([(rx, 42), (rx + 22, 68), (rx + 18, 104), (rx, 90)], fill=INK, width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 8. ARMORER'S WEAPON-OILING & BOLT MAINTENANCE BENCH (256x160)
# =============================================================================
def gen_armorer_cleaning_bench(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 28 + o[1], W - 24 + o[0], H - 28 + o[1]], radius=12, fill=c),
        (8, 10),
        12.0,
        105,
    )
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 30, W - 26, H - 30, (124, 88, 56), rng, horizontal=True, n_planks=5, ink_w=6)
    # Dark gun-oil stain & rag cloth in center
    d.ellipse([156, 76, 332, 224], fill=(74, 54, 38, 255))
    draw_rot_rect(d, 108, 198, 78, 66, 0.28, (186, 68, 62), INK_MID, 4)
    # Disassembled rifle barrel & stock laid diagonally for cleaning
    draw_rot_rect(d, 244, 146, 224, 18, -0.14, STEEL, INK, 4)
    draw_rot_rect(d, 212, 192, 138, 24, 0.08, WALNUT, INK, 4)
    # Brass cleaning rod + brass oil squirt can
    d.line([(134, 96), (344, 74)], fill=INK, width=9)
    d.line([(134, 96), (344, 74)], fill=(*BRASS_GOLD, 255), width=4)
    draw_disc(d, 410, 96, 26, BRASS, ink_w=4)
    draw_disc(d, 410, 96, 10, BRASS_GOLD, ink_w=2)
    # Cast-iron bench vise bolted to lower-left corner + crossbow bolt tray on right!
    draw_beveled_rect(d, 44, 214, 118, 268, IRON_DK, ink_w=5, radius=8)
    d.line([(80, 268), (80, 294)], fill=STEEL_HI, width=7)
    draw_beveled_rect(d, 364, 168, 466, 264, OAK, ink_w=4, radius=6)
    for by in range(182, 256, 15):
        d.line([(376, by), (452, by)], fill=INK, width=5)
        d.line([(376, by), (444, by)], fill=(*PINE, 255), width=2)
        d.polygon([(444, by - 4), (458, by), (444, by + 4)], fill=(*STEEL_HI, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.5)


# =============================================================================
# 9. RED & CYAN SIGNAL FLARE MUNITIONS CRATE (192x160)
# =============================================================================
def gen_signal_flare_crate(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([26 + o[0], 26 + o[1], W - 26 + o[0], H - 26 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        100,
    )
    add_glow(im, W * 0.65, H * 0.45, 74, 62, CYAN, alpha=48, blur=14.0)
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 28, 28, W - 28, H - 28, (112, 86, 56), rng, horizontal=True, n_planks=4, ink_w=6)
    draw_beveled_rect(d, 48, 48, W - 48, H - 48, (56, 46, 36), ink_w=5, radius=6)
    # Left compartment: 6 crimson alarm flare cartridges standing upright (round brass-capped tips)
    for r in range(2):
        for c in range(3):
            draw_disc(d, 86 + c * 42, 96 + r * 52, 18, CRIMSON, ink_w=4)
            draw_disc(d, 86 + c * 42, 96 + r * 52, 8, BRASS_GOLD, ink_w=2)
    # Middle divider
    d.line([(204, 50), (204, H - 50)], fill=OAK, width=10)
    d.line([(204, 50), (204, H - 50)], fill=INK, width=3)
    # Right compartment: 4 cyan aether illumination flares + brass flare pistol resting across top!
    for r in range(2):
        for c in range(2):
            draw_disc(d, 244 + c * 52, 96 + r * 52, 19, CYAN, ink_w=4)
            draw_disc(d, 244 + c * 52, 96 + r * 52, 9, CYAN_CORE, ink_w=2)
    # Brass flare pistol diagonal across bottom right
    draw_rot_rect(d, 256, 224, 96, 24, -0.25, BRASS_GOLD, INK, 4)
    draw_rot_rect(d, 212, 244, 34, 48, 0.2, WALNUT, INK, 4)
    # Iron corner straps
    for sx, sy in ((28, 28), (W - 56, 28), (28, H - 56), (W - 56, H - 56)):
        draw_beveled_rect(d, sx, sy, sx + 28, sy + 28, IRON, ink_w=3, radius=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 10. WATCHMAN'S CUIRASS, PICKELHAUBE & RIOT SHIELD STAND (192x176)
# =============================================================================
def gen_sentry_gear_stand(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([48 + o[0], 44 + o[1], W - 48 + o[0], H - 44 + o[1]], fill=c),
        (8, 10),
        12.0,
        105,
    )
    d = ImageDraw.Draw(im)
    # Crossed oak armor stand pedestal base
    draw_beveled_rect(d, cx - 104, cy - 22, cx + 104, cy + 22, WALNUT, ink_w=5, radius=8)
    draw_beveled_rect(d, cx - 22, cy - 92, cx + 22, cy + 92, WALNUT, ink_w=5, radius=8)
    # Prussian steel shoulder pauldrons & cuirass torso seen from directly above!
    draw_disc(d, cx - 72, cy, 46, STEEL, ink_w=5)
    draw_disc(d, cx + 72, cy, 46, STEEL, ink_w=5)
    draw_beveled_rect(d, cx - 64, cy - 52, cx + 64, cy + 52, (98, 110, 126), ink_w=6, radius=28)
    # Navy & gold garrison collar piping
    d.ellipse([cx - 48, cy - 48, cx + 48, cy + 48], fill=(*NAVY, 255), outline=INK, width=5)
    # Iconic spiked Prussian Pickelhaube watchman's helmet right on top!
    draw_disc(d, cx, cy, 42, IRON_DK, ink_w=5)
    draw_disc(d, cx, cy, 24, BRASS, ink_w=4)
    draw_disc(d, cx, cy, 10, BRASS_GOLD, ink_w=3)
    # Riot shield leaning cleanly at front-right + oak baton
    draw_rot_rect(d, cx + 82, cy + 72, 74, 46, -0.45, NAVY, INK, 5)
    draw_disc(d, cx + 82, cy + 72, 13, BRASS_GOLD, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.3)


# =============================================================================
# 11. LIVED-IN GARRISON IRON BUNK & PRUSSIAN-NAVY BLANKET (176x272)
# =============================================================================
def gen_garrison_bunk_cot(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([32 + o[0], 26 + o[1], W - 32 + o[0], H - 26 + o[1]], radius=16, fill=c),
        (8, 10),
        12.0,
        105,
    )
    d = ImageDraw.Draw(im)
    # Iron tube bedframe + headboard & footboard rails
    draw_beveled_rect(d, 34, 28, W - 34, H - 28, IRON_DK, ink_w=6, radius=14)
    # Cream ticking mattress
    draw_beveled_rect(d, 48, 46, W - 48, H - 46, (218, 208, 186), ink_w=5, radius=10)
    # Plump pillow at head (slightly creased/askew so it feels slept-in!)
    draw_rot_rect(d, W * 0.50, 96, W - 128, 72, -0.04, (238, 232, 218), INK_MID, 4)
    # Folded/rumpled Prussian-navy wool garrison blanket with gold stripe border!
    blanket_pts = [
        (52, 166),
        (W - 50, 152),
        (W - 50, H - 50),
        (52, H - 50),
    ]
    d.polygon(blanket_pts, fill=(*NAVY, 255))
    d.line(blanket_pts + [blanket_pts[0]], fill=INK, width=5)
    # Folded white top-sheet turnback + subtle blanket creases
    d.polygon([(52, 166), (W - 50, 152), (W - 50, 182), (52, 194)], fill=(*PAPER, 255), outline=INK_MID)
    d.line([(62, H - 94), (W - 62, H - 94)], fill=(*BRASS, 255), width=8)
    for cy_line in (238, 304, 372):
        d.line([(66, cy_line), (W - 68, cy_line + rng.randint(-12, 12))], fill=(*NAVY_HI, 255), width=5)
    # Folded leather watch belt & brass buckle resting on foot of bunk + muddy boots peeking under edge!
    draw_rot_rect(d, W * 0.64, H - 122, 86, 22, 0.22, LEATHER, INK, 4)
    draw_rot_rect(d, W * 0.64, H - 122, 20, 26, 0.22, BRASS_GOLD, INK, 3)
    # 4 iron bedpost corner finials
    for px, py in ((42, 36), (W - 42, 36), (42, H - 36), (W - 42, H - 36)):
        draw_disc(d, px, py, 14, BRASS, ink_w=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


# =============================================================================
# 12. WATCHMEN'S WET GREATCOAT & MUDDY BOOT DRYING BENCH (224x128)
# =============================================================================
def gen_greatcoat_boot_rack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 30 + o[1], W - 24 + o[0], H - 30 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        100,
    )
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 32, W - 26, H - 32, OAK, rng, horizontal=True, n_planks=4, ink_w=6)
    # 2 pairs of muddy leather patrol boots sitting along left half of bench
    for bx in (74, 114, 168, 206):
        ang = rng.uniform(-0.18, 0.18)
        draw_rot_rect(d, bx, H * 0.56, 30, 62, ang, (68, 46, 34), INK, 4)
        draw_disc(d, bx, H * 0.42, 13, (44, 32, 24), ink_w=3)
    # Folded heavy Prussian-navy oilskin greatcoat & brass-buttoned cap on right half!
    draw_rot_rect(d, 316, H * 0.50, 128, 96, -0.05, NAVY, INK, 5)
    for ky in (H * 0.36, H * 0.50, H * 0.64):
        draw_disc(d, 304, ky, 5, BRASS_GOLD, ink_w=2)
        draw_disc(d, 328, ky, 5, BRASS_GOLD, ink_w=2)
    draw_disc(d, 388, H * 0.54, 28, IRON_DK, ink_w=4)
    draw_disc(d, 388, H * 0.54, 10, BRASS_GOLD, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# 13. SHIFT-CHANGE MESS TABLE WITH TIN MUGS & BREAD (240x176)
# =============================================================================
def gen_mess_ration_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=12, fill=c),
        (8, 10),
        12.0,
        105,
    )
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 28, W - 26, H - 28, PINE, rng, horizontal=True, n_planks=5, ink_w=6)
    # Enamel navy-blue coffee pot at upper-left
    draw_disc(d, 104, 104, 34, (58, 98, 124), ink_w=5)
    draw_disc(d, 104, 104, 14, STEEL_HI, ink_w=3)
    d.line([(66, 104), (48, 104)], fill=INK, width=10)
    # 3 dented tin mugs filled with dark coffee scattered around table
    for mx, my in ((184, 86), (124, 232), (356, 224)):
        draw_disc(d, mx, my, 22, STEEL, ink_w=4)
        draw_disc(d, mx, my, 15, (58, 36, 22), ink_w=2)
    # Cutting board with crusty rye loaf, sliced cheese & sausage links!
    draw_beveled_rect(d, 214, 124, 382, 238, OAK, ink_w=5, radius=10)
    d.ellipse([230, 146, 314, 212], fill=(166, 108, 56, 255), outline=INK, width=4)
    d.line([(256, 154), (274, 202)], fill=(214, 168, 108, 255), width=4)
    d.polygon([(320, 142), (368, 156), (344, 208)], fill=(234, 198, 92, 255), outline=INK)
    d.line([(320, 142), (368, 156), (344, 208), (320, 142)], fill=INK, width=4)
    # Tin soup bowls & folded newspaper
    draw_paper_sheet(d, 396, 104, 72, 62, 0.24, seal=False)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# 14. PATROL SHIFT ROSTER & BEAT SCHEDULE TABLE (224x160)
# =============================================================================
def gen_patrol_roster_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        100,
    )
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 28, W - 26, H - 28, WALNUT, rng, horizontal=True, n_planks=4, ink_w=6)
    # Dark green-slate chalk shift grid laid flat on desk
    draw_beveled_rect(d, 52, 50, 294, H - 50, (44, 58, 56), ink_w=5, radius=8)
    for gx in range(104, 290, 56):
        d.line([(gx, 62), (gx, H - 62)], fill=(196, 206, 202, 255), width=2)
    for gy in range(86, H - 58, 38):
        d.line([(64, gy), (282, gy)], fill=(196, 206, 202, 255), width=2)
    # Chalk tally marks & brass patrol whistle + clipboard on right
    draw_paper_sheet(d, 360, 118, 86, 108, 0.08, seal=True)
    draw_beveled_rect(d, 344, 212, 388, 232, PAPER, ink_w=2, radius=4)  # chalk stub
    draw_disc(d, 368, 256, 16, BRASS_GOLD, ink_w=3)  # whistle
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 15. ILLUMINATED CIRCULAR TACTICAL DISTRICT WAR-MAP TABLE (HERO, 320x320)
# =============================================================================
def gen_tactical_district_map_table(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    r_out = W * 0.44
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse(
            [cx - r_out + o[0], cy - r_out + o[1], cx + r_out + o[0], cy + r_out + o[1]],
            fill=c,
        ),
        (10, 12),
        15.0,
        120,
    )
    add_glow(im, cx, cy, r_out * 0.85, r_out * 0.85, AMBER, alpha=72, blur=24.0)
    d = ImageDraw.Draw(im)

    # Grand heavy mahogany circular table rim with riveted brass compass ring
    draw_disc(d, cx, cy, r_out, MAHOGANY, ink_w=7)
    draw_disc(d, cx, cy, r_out - 20, BRASS, ink_w=5)
    # Recessed illuminated parchment tactical district map surface!
    r_map = r_out - 36
    d.ellipse([cx - r_map, cy - r_map, cx + r_map, cy + r_map], fill=(*PARCHMENT, 255), outline=INK, width=5)

    # Miniature top-down Berlin-Magipunk district street & tramline chart inside map!
    # Diagonal tram viaduct line running SW→NE
    d.line([(cx - 178, cy + 148), (cx + 178, cy - 148)], fill=(124, 96, 66, 255), width=16)
    d.line([(cx - 178, cy + 148), (cx + 178, cy - 148)], fill=(214, 174, 72, 255), width=4)
    # Cross boulevard & alleys
    d.line([(cx - 190, cy - 44), (cx + 188, cy + 68)], fill=(168, 148, 118, 255), width=12)
    d.line([(cx - 24, cy - 196), (cx + 52, cy + 194)], fill=(168, 148, 118, 255), width=10)
    # Mini city blocks + Cathedral trefoil silhouette (SW) + Kiezpark (NW) + Watchtower circle (E)
    d.ellipse([cx - 134, cy + 64, cx - 54, cy + 144], fill=(134, 82, 112, 255), outline=INK_MID, width=3)  # Cathedral
    d.ellipse([cx - 138, cy - 132, cx - 58, cy - 58], fill=(104, 148, 86, 255), outline=INK_MID, width=3)  # Park
    draw_beveled_rect(d, cx + 36, cy - 146, cx + 132, cy - 76, (152, 92, 68), ink_w=3, radius=4)  # Tenement
    draw_disc(d, cx + 66, cy - 20, 26, (72, 112, 152), ink_w=3)  # Watchtower!
    # Tactical red & cyan patrol pins + string routes connecting hot spots!
    pins = [
        (cx - 94, cy + 104, CRIMSON),
        (cx - 98, cy - 92, (48, 146, 198)),
        (cx + 84, cy - 112, CRIMSON),
        (cx + 66, cy - 20, AMBER),
        (cx + 18, cy + 88, (48, 146, 198)),
    ]
    d.line([(pins[3][0], pins[3][1]), (pins[0][0], pins[0][1])], fill=(176, 48, 52, 255), width=3)
    d.line([(pins[3][0], pins[3][1]), (pins[2][0], pins[2][1])], fill=(176, 48, 52, 255), width=3)
    d.line([(pins[3][0], pins[3][1]), (pins[1][0], pins[1][1])], fill=(48, 124, 176, 255), width=3)
    for px, py, pc in pins:
        draw_disc(d, px, py, 11, pc, ink_w=3)

    # Brass compass calipers & magnifying glass resting along map edge!
    d.line([(cx - 168, cy - 10), (cx - 112, cy + 44)], fill=INK, width=8)
    d.line([(cx - 168, cy - 10), (cx - 112, cy + 44)], fill=(*BRASS_GOLD, 255), width=4)
    d.line([(cx - 168, cy - 10), (cx - 134, cy + 62)], fill=INK, width=8)
    d.line([(cx - 168, cy - 10), (cx - 134, cy + 62)], fill=(*BRASS_GOLD, 255), width=4)
    draw_disc(d, cx + 132, cy + 114, 24, BRASS_GOLD, ink_w=4)
    draw_disc(d, cx + 132, cy + 114, 16, (186, 224, 236), ink_w=2)

    # 8 cardinal brass degree markers around table bezel
    for k in range(8):
        a = k * math.tau / 8
        draw_disc(d, cx + math.cos(a) * (r_out - 12), cy + math.sin(a) * (r_out - 12), 7, BRASS_GOLD, ink_w=2)

    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 16. MAGIPUNK AETHER-TELEGRAPH & PNEUMATIC DISPATCH CONSOLE (256x160)
# =============================================================================
def gen_aether_telegraph_console(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=14, fill=c),
        (8, 10),
        12.0,
        110,
    )
    add_glow(im, 152, 108, 108, 64, CYAN, alpha=95, blur=20.0)
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 28, W - 26, H - 28, MAHOGANY, rng, horizontal=True, n_planks=5, ink_w=6)
    # Brushed brass control deck plate across back half
    draw_beveled_rect(d, 44, 46, 336, 174, IRON_DK, ink_w=5, radius=10)
    # 3 glowing cyan Aether Vacuum Tubes + brass induction coils!
    for tx in (92, 154, 216):
        draw_disc(d, tx, 108, 24, BRASS, ink_w=4)
        draw_disc(d, tx, 108, 16, CYAN, ink_w=3)
        draw_disc(d, tx, 108, 7, CYAN_CORE, ink_w=2)
    # Paper ticker-tape reel & curling paper strip!
    draw_disc(d, 284, 108, 30, PAPER, ink_w=4)
    draw_disc(d, 284, 108, 10, BRASS_GOLD, ink_w=3)
    d.line([(284, 138), (304, 214), (272, 264)], fill=PAPER, width=16)
    d.line([(284, 138), (304, 214), (272, 264)], fill=INK_MID, width=3)
    # Brass Morse tapper key pad at front-left
    draw_beveled_rect(d, 74, 206, 216, 268, BRASS, ink_w=4, radius=8)
    draw_disc(d, 144, 238, 18, IRON_DK, ink_w=3)
    # Twin copper Pneumatic Dispatch Tube receivers on right end!
    draw_beveled_rect(d, 354, 52, W - 44, H - 52, COPPER, ink_w=5, radius=10)
    draw_disc(d, 412, 114, 30, BRASS_GOLD, ink_w=5)
    draw_disc(d, 412, 114, 18, IRON_DK, ink_w=3)
    draw_disc(d, 412, 206, 30, BRASS_GOLD, ink_w=5)
    draw_disc(d, 412, 206, 18, (186, 54, 52), ink_w=3)  # red canister loaded!
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 17. WATCH CAPTAIN'S IRON-BOUND SUSPECT DOSSIER CABINET (224x128)
# =============================================================================
def gen_captain_dossier_cabinet(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=10, fill=c),
        (7, 9),
        10.0,
        105,
    )
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 28, W - 26, H - 28, WALNUT, rng, horizontal=True, n_planks=4, ink_w=6)
    # Iron reinforced bands & 3 top-edge brass label plates
    for ix in (152, 296):
        d.line([(ix, 32), (ix, H - 32)], fill=IRON_DK, width=10)
        d.line([(ix, 32), (ix, H - 32)], fill=INK, width=3)
    # Manila case dossiers, wax-sealed warrant & magnifying glass on cabinet top!
    draw_paper_sheet(d, 92, H * 0.50, 82, 108, -0.06, seal=True)
    draw_paper_sheet(d, 224, H * 0.48, 86, 104, 0.08, seal=False)
    draw_rot_rect(d, 362, H * 0.52, 92, 106, -0.05, (186, 158, 112), INK, 4)
    draw_paper_sheet(d, 366, H * 0.50, 74, 88, 0.04, seal=True)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 18. SWIVELING MAGIPUNK AETHER SEARCHLIGHT TURRET (HERO, 272x272)
# =============================================================================
def gen_searchlight_turret_aether(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    r_ring = W * 0.41
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse(
            [cx - r_ring + o[0], cy - r_ring + o[1], cx + r_ring + o[0], cy + r_ring + o[1]],
            fill=c,
        ),
        (10, 12),
        14.0,
        125,
    )
    # Blazing cyan-white Fresnel searchlight beam aura projecting forward (+Y)!
    add_glow(im, cx, cy + 92, 152, 136, CYAN, alpha=145, blur=28.0)
    add_glow(im, cx, cy + 56, 86, 86, CYAN_CORE, alpha=130, blur=16.0)
    d = ImageDraw.Draw(im)

    # 360° circular cast-iron azimuth turntable track ring with 12 bolts
    draw_disc(d, cx, cy, r_ring, IRON_DK, ink_w=7)
    draw_disc(d, cx, cy, r_ring - 22, SLATE, ink_w=5)
    for k in range(12):
        a = k * math.tau / 12
        draw_disc(d, cx + math.cos(a) * (r_ring - 12), cy + math.sin(a) * (r_ring - 12), 7, STEEL_HI, ink_w=2)

    # Braided copper power conduits curling from base deck into turret yoke
    d.arc([cx - 134, cy - 134, cx + 134, cy + 134], 200, 340, fill=INK, width=16)
    d.arc([cx - 134, cy - 134, cx + 134, cy + 134], 200, 340, fill=(*COPPER, 255), width=8)

    # Heavy forged iron Y-yoke & twin operator aiming handwheels on left/right!
    draw_beveled_rect(d, cx - 124, cy - 36, cx + 124, cy + 36, IRON, ink_w=6, radius=14)
    for side in (-1, 1):
        wx = cx + side * 138
        d.ellipse([wx - 14, cy - 42, wx + 14, cy + 42], fill=(*BRASS_GOLD, 255), outline=INK, width=5)

    # Massive riveted brass & steel Fresnel searchlight drum pointing South (+Y)!
    draw_beveled_rect(d, cx - 84, cy - 96, cx + 84, cy + 88, IRON_DK, ink_w=6, radius=22)
    draw_beveled_rect(d, cx - 72, cy - 80, cx + 72, cy + 68, BRASS, ink_w=5, radius=16)
    # Cooling fins & vent louvers on top of barrel housing
    for fy in range(int(cy - 56), int(cy + 46), 22):
        d.line([(cx - 54, fy), (cx + 54, fy)], fill=INK, width=8)
        d.line([(cx - 54, fy), (cx + 54, fy)], fill=(*BRASS_GOLD, 255), width=3)
    # Blazing front Fresnel crystal lens bezel at +Y!
    d.polygon(
        [(cx - 78, cy + 68), (cx + 78, cy + 68), (cx + 96, cy + 116), (cx - 96, cy + 116)],
        fill=(*CYAN, 255),
        outline=INK,
    )
    d.polygon(
        [(cx - 58, cy + 74), (cx + 58, cy + 74), (cx + 72, cy + 110), (cx - 72, cy + 110)],
        fill=(*CYAN_CORE, 255),
    )
    d.line([(cx - 78, cy + 68), (cx - 96, cy + 116), (cx + 96, cy + 116), (cx + 78, cy + 68)], fill=INK, width=6)
    # Rear brass operator sight & glowing aether core dial
    draw_disc(d, cx, cy - 92, 24, BRASS_GOLD, ink_w=4)
    draw_disc(d, cx, cy - 92, 12, CYAN, ink_w=3)

    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 19. 360° BRASS ARTICULATED RANGEFINDER & LOOKOUT TELESCOPE (208x208)
# =============================================================================
def gen_observatory_rangefinder(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 2 * 0.25
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([54 + o[0], 54 + o[1], W - 54 + o[0], H - 54 + o[1]], fill=c),
        (7, 9),
        11.0,
        105,
    )
    d = ImageDraw.Draw(im)
    # 3 heavy cast-iron bolted deck tripod legs radiating 120°
    for k in range(3):
        a = -math.pi * 0.5 + k * math.tau / 3
        p1 = (cx + math.cos(a) * 142, cy + math.sin(a) * 142)
        d.line([(cx, cy), p1], fill=INK, width=24)
        d.line([(cx, cy), p1], fill=(*IRON, 255), width=14)
        draw_disc(d, p1[0], p1[1], 18, IRON_DK, ink_w=4)
    # Central brass azimuth compass pedestal
    draw_disc(d, cx, cy, 52, IRON_DK, ink_w=5)
    draw_disc(d, cx, cy, 34, BRASS, ink_w=4)
    # Wide twin-prism artillery/watchtower optical rangefinder crossbar + spotting scope!
    draw_rot_rect(d, cx, cy, 248, 36, -0.35, BRASS_GOLD, INK, 5)
    draw_rot_rect(d, cx, cy, 56, 134, -0.35, BRASS, INK, 5)
    # Twin sky-blue optical glass objective lenses at both ends of rangefinder bar
    for s in (-1, 1):
        lp = rot_pt(cx, cy, s * 116, 0, -0.35)
        draw_disc(d, lp[0], lp[1], 20, IRON_DK, ink_w=4)
        draw_disc(d, lp[0], lp[1], 12, (118, 206, 232), ink_w=2)
    draw_disc(d, cx, cy, 18, BRASS_GOLD, ink_w=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 20. HEAVY CAST-BRONZE DISTRICT ALARM BELL & TIMBER YOKE (208x208)
# =============================================================================
def gen_district_alarm_bell(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([48 + o[0], 48 + o[1], W - 48 + o[0], H - 48 + o[1]], fill=c),
        (9, 11),
        12.0,
        115,
    )
    d = ImageDraw.Draw(im)
    # Square oak timber gallows base & top crossbar
    draw_wood_planks_box(d, 56, 56, W - 56, H - 56, WALNUT, rng, horizontal=True, n_planks=4, ink_w=6)
    draw_beveled_rect(d, 78, 78, W - 78, H - 78, (46, 34, 26), ink_w=4, radius=8)
    # Massive round cast-bronze alarm bell (top-down concentric flared bronze & verdigris rings!)
    draw_disc(d, cx, cy, 108, (132, 106, 62), ink_w=6)
    draw_disc(d, cx, cy, 86, VERDIGRIS, ink_w=5)
    draw_disc(d, cx, cy, 62, BRASS, ink_w=5)
    draw_disc(d, cx, cy, 34, BRASS_GOLD, ink_w=4)
    # Heavy bolted oak & iron headstock yoke straddling the bell crown!
    draw_beveled_rect(d, 38, cy - 26, W - 38, cy + 26, OAK, ink_w=6, radius=8)
    for bx in (62, cx - 44, cx + 44, W - 62):
        draw_beveled_rect(d, bx - 10, cy - 30, bx + 10, cy + 30, IRON_DK, ink_w=3, radius=3)
    draw_disc(d, cx, cy, 18, IRON_DK, ink_w=4)
    # Coiled hemp pull-rope tucked beside lower-right timber post
    for r_rope in (34, 24, 14):
        d.ellipse([W - 106 - r_rope, H - 106 - r_rope, W - 106 + r_rope, H - 106 + r_rope], outline=INK, width=8)
        d.ellipse([W - 106 - r_rope, H - 106 - r_rope, W - 106 + r_rope, H - 106 + r_rope], outline=(*BURLAP, 255), width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# 21. HIGH-VOLTAGE SEARCHLIGHT AETHER CAPACITOR DYNAMO (240x160)
# =============================================================================
def gen_searchlight_capacitor_bank(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=14, fill=c),
        (8, 10),
        12.0,
        115,
    )
    add_glow(im, W * 0.35, H * 0.5, 118, 92, CYAN, alpha=110, blur=22.0)
    add_glow(im, W * 0.65, H * 0.5, 118, 92, CYAN, alpha=110, blur=22.0)
    d = ImageDraw.Draw(im)
    # Heavy bolted cast-iron dynamo plinth with copper busbars
    draw_beveled_rect(d, 26, 28, W - 26, H - 28, IRON_DK, ink_w=6, radius=14)
    draw_beveled_rect(d, 44, 46, W - 44, H - 46, SLATE, ink_w=5, radius=10)
    # Twin copper busbars linking both glowing Leyden capacitor jars
    d.line([(120, 86), (W - 120, 86)], fill=INK, width=16)
    d.line([(120, 86), (W - 120, 86)], fill=(*COPPER, 255), width=9)
    d.line([(120, H - 86), (W - 120, H - 86)], fill=INK, width=16)
    d.line([(120, H - 86), (W - 120, H - 86)], fill=(*COPPER, 255), width=9)
    # Twin glowing cyan Aether Capacitor cylinders wrapped in brass coil rings
    for cx_jar in (W * 0.32, W * 0.68):
        draw_disc(d, cx_jar, H * 0.5, 76, COPPER, ink_w=6)
        draw_disc(d, cx_jar, H * 0.5, 58, CYAN, ink_w=5)
        draw_disc(d, cx_jar, H * 0.5, 34, CYAN_CORE, ink_w=4)
        draw_disc(d, cx_jar, H * 0.5, 16, BRASS_GOLD, ink_w=3)
    # Central brass knife-switch & voltage dial
    draw_beveled_rect(d, W * 0.5 - 22, H * 0.5 - 48, W * 0.5 + 22, H * 0.5 + 48, IRON_DK, ink_w=4, radius=6)
    draw_disc(d, W * 0.5, H * 0.5 - 22, 14, PAPER, ink_w=3)
    d.line([(W * 0.5, H * 0.5 - 22), (W * 0.5 + 8, H * 0.5 - 30)], fill=CRIMSON, width=3)
    draw_beveled_rect(d, W * 0.5 - 10, H * 0.5 + 4, W * 0.5 + 10, H * 0.5 + 38, CRIMSON, ink_w=3, radius=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 22. SEMAPHORE SIGNAL FLAG LOCKER & SHUTTER SIGNAL LAMP (208x144)
# =============================================================================
def gen_semaphore_signal_rack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        100,
    )
    add_glow(im, 316, 144, 62, 62, AMBER, alpha=72, blur=16.0)
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 28, W - 26, H - 28, OAK, rng, horizontal=True, n_planks=4, ink_w=6)
    draw_beveled_rect(d, 44, 46, 234, H - 46, (58, 44, 34), ink_w=4, radius=6)
    # 3 crisp red-and-yellow diagonal semaphore flags tucked inside timber deck box!
    for i, fy in enumerate((76, 138, 200)):
        d.line([(56, fy), (222, fy)], fill=PINE, width=10)
        d.line([(56, fy), (222, fy)], fill=INK, width=3)
        p = [(126, fy - 22), (210, fy - 22), (210, fy + 22), (126, fy + 22)]
        d.polygon([p[0], p[1], p[2]], fill=(*CRIMSON, 255))
        d.polygon([p[0], p[2], p[3]], fill=(238, 198, 66, 255))
        d.line(p + [p[0]], fill=INK, width=4)
    # Brass Aldis shutter signal lamp & signal codebook resting on right deck shelf!
    draw_disc(d, 316, 114, 44, BRASS, ink_w=5)
    draw_disc(d, 316, 114, 28, AMBER, ink_w=4)
    for sy in (98, 114, 130):
        d.line([(292, sy), (340, sy)], fill=IRON_DK, width=4)
    draw_rot_rect(d, 316, 212, 86, 58, 0.08, NAVY, INK, 4)
    draw_disc(d, 316, 212, 10, BRASS_GOLD, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 23. CURVED BURLAP SANDBAG BATTLEMENT COVER ARC (240x128)
# =============================================================================
def gen_sandbag_embrasure_arc(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 1.45
    r_arc = W * 0.56
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.arc(
            [cx - r_arc + o[0], cy - r_arc + o[1], cx + r_arc + o[0], cy + r_arc + o[1]],
            215,
            325,
            fill=c,
            width=74,
        ),
        (6, 8),
        10.0,
        100,
    )
    d = ImageDraw.Draw(im)

    # Bottom tier + top staggered tier of plump rounded hand-stitched burlap sandbags curving neatly for round towers!
    def draw_bag(bx: float, by: float, ang: float, bw: float, bh: float, tone: tuple[int, int, int]) -> None:
        dk = blend_rgb(tone, (42, 32, 22), 0.36)
        hi = blend_rgb(tone, (242, 230, 200), 0.34)
        # Draw plump pill polygon (16 perimeter points) so bags look genuinely stuffed and organic!
        pts: list[tuple[float, float]] = []
        pts_in: list[tuple[float, float]] = []
        for k in range(16):
            th = k * math.tau / 16
            sx = math.cos(th)
            sy = math.sin(th)
            # Superellipse (n=2.6) gives authentic stuffed burlap cushion silhouette!
            px = math.copysign(abs(sx) ** 0.72, sx) * bw * 0.50
            py = math.copysign(abs(sy) ** 0.78, sy) * bh * 0.50
            pts.append(rot_pt(bx, by, px, py, ang))
            pts_in.append(rot_pt(bx, by, px * 0.84, py * 0.80, ang))
        d.polygon(pts, fill=dk)
        d.polygon(pts_in, fill=(*tone, 255))
        d.line(pts + [pts[0]], fill=INK, width=5)
        p0 = rot_pt(bx, by, -bw * 0.28, -bh * 0.14, ang)
        p1 = rot_pt(bx, by, bw * 0.28, -bh * 0.14, ang)
        d.line([p0, p1], fill=hi, width=5)
        # Tied twine collar + pinched sack ears on both ends
        for s in (-1, 1):
            c0 = rot_pt(bx, by, s * bw * 0.38, -bh * 0.24, ang)
            c1 = rot_pt(bx, by, s * bw * 0.38, bh * 0.24, ang)
            d.line([c0, c1], fill=INK_MID, width=4)

    # Lower wider layer (5 tightly packed bags)
    for i in range(5):
        a = math.radians(228 + i * 21)
        bx = cx + math.cos(a) * (r_arc + 14)
        by = cy + math.sin(a) * (r_arc + 14)
        draw_bag(bx, by, a + math.pi * 0.5, 102, 52, vary_rgb((150, 128, 92), rng, 10))
    # Upper staggered layer (4 plump bags overlapping seams cleanly)
    for i in range(4):
        a = math.radians(238 + i * 21)
        bx = cx + math.cos(a) * (r_arc - 5)
        by = cy + math.sin(a) * (r_arc - 5)
        draw_bag(bx, by, a + math.pi * 0.5, 98, 48, vary_rgb(BURLAP, rng, 10))

    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0)


# =============================================================================
# 24. COLORABLE WATCHTOWER GARRISON PENNANT & FLAGPOLE RIG (dd_red, 192x256)
# =============================================================================
def gen_colorable_watch_banner_flag(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx = W * 0.5
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.polygon(
            [(cx - 56 + o[0], 72 + o[1]), (cx + 56 + o[0], 72 + o[1]), (cx + 38 + o[0], H - 46 + o[1]), (cx + o[0], H - 96 + o[1]), (cx - 38 + o[0], H - 46 + o[1])],
            fill=c,
        ),
        (8, 10),
        12.0,
        105,
    )
    d = ImageDraw.Draw(im)
    # Iron parapet mast mount + horizontal brass banner crossbar at top
    draw_disc(d, cx, 58, 28, IRON_DK, ink_w=5)
    draw_disc(d, cx, 58, 14, BRASS_GOLD, ink_w=3)
    draw_beveled_rect(d, cx - 98, 66, cx + 98, 86, BRASS, ink_w=5, radius=6)
    draw_disc(d, cx - 98, 76, 12, BRASS_GOLD, ink_w=3)
    draw_disc(d, cx + 98, 76, 12, BRASS_GOLD, ink_w=3)

    # Flowing wind-rippled swallowtail watchtower banner in pure dd_red (recolorable!)
    pts = [
        (cx - 78, 84),
        (cx + 78, 84),
        (cx + 88, 210),
        (cx + 68, 336),
        (cx + 74, H - 44),
        (cx + 4, H - 108),
        (cx - 66, H - 44),
        (cx - 72, 336),
        (cx - 60, 210),
    ]
    d.polygon(pts, fill=(*DD_RED_BASE, 255))
    # Shaded wind ripples in DD_RED_DEEP & DD_RED_HI (stays strictly red-dominant for dd_red shader!)
    d.polygon([(cx - 68, 148), (cx + 76, 134), (cx + 82, 186), (cx - 62, 198)], fill=(*DD_RED_HI, 255))
    d.polygon([(cx - 64, 246), (cx + 78, 232), (cx + 72, 288), (cx - 68, 302)], fill=(*DD_RED_DEEP, 255))
    d.polygon([(cx - 66, 344), (cx + 70, 334), (cx + 70, 384), (cx - 66, 392)], fill=(*DD_RED_HI, 255))
    # Gold heraldic watchtower chevron & border trim (low R-G diff? No, gold is warm neutral/brass!)
    d.line(pts + [pts[0]], fill=INK, width=6)
    # Central iron-and-brass watchtower eye crest emblem (non-red neutral so it stays crisp gold/iron!)
    draw_disc(d, cx, 214, 34, IRON_DK, ink_w=4)
    draw_disc(d, cx, 214, 20, STEEL_HI, ink_w=3)
    draw_disc(d, cx, 214, 9, IRON_DK, ink_w=2)

    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 25. COLORABLE CIRCULAR WOVEN WATCHTOWER FLOOR RUG (dd_red, 256x256)
# =============================================================================
def gen_colorable_garrison_rug(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    r_out = W * 0.45
    d = ImageDraw.Draw(im)
    # Radial cream fringe tassels around perimeter
    for k in range(64):
        a = k * math.tau / 64
        d.line(
            [
                (cx + math.cos(a) * (r_out - 6), cy + math.sin(a) * (r_out - 6)),
                (cx + math.cos(a) * (r_out + 12), cy + math.sin(a) * (r_out + 12)),
            ],
            fill=(212, 200, 174, 255),
            width=4,
        )
    # Main circular woven rug body in pure dd_red (tints cleanly to Prussian Navy, Crimson, Slate, etc.!)
    d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], fill=(*DD_RED_DEEP, 255), outline=INK, width=6)
    d.ellipse([cx - r_out * 0.88, cy - r_out * 0.88, cx + r_out * 0.88, cy + r_out * 0.88], fill=(*DD_RED_BASE, 255), outline=(214, 198, 162, 255), width=6)
    d.ellipse([cx - r_out * 0.72, cy - r_out * 0.72, cx + r_out * 0.72, cy + r_out * 0.72], fill=(*DD_RED_HI, 255), outline=INK_MID, width=4)
    d.ellipse([cx - r_out * 0.60, cy - r_out * 0.60, cx + r_out * 0.60, cy + r_out * 0.60], fill=(*DD_RED_BASE, 255), outline=(214, 198, 162, 255), width=4)
    # 8-point compass rose weave in center (neutral parchment weave stays crisp under dd_red tint!)
    for k in range(8):
        a = k * math.tau / 8
        r_tip = r_out * (0.46 if k % 2 == 0 else 0.30)
        p_tip = (cx + math.cos(a) * r_tip, cy + math.sin(a) * r_tip)
        p_l = (cx + math.cos(a - 0.22) * 34, cy + math.sin(a - 0.22) * 34)
        p_r = (cx + math.cos(a + 0.22) * 34, cy + math.sin(a + 0.22) * 34)
        d.polygon([(cx, cy), p_l, p_tip, p_r], fill=(218, 206, 178, 255), outline=INK_MID)
    d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=(*DD_RED_DEEP, 255), outline=(218, 206, 178, 255), width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.4)


def build_all() -> None:
    specs: list[tuple[str, str, list[str], str, bool, Image.Image]] = []

    def add(
        stem: str,
        name: str,
        tags: list[str],
        im: Image.Image,
        draw_mode: str = "normal",
        shadow: bool = True,
    ) -> None:
        specs.append((stem, name, tags, draw_mode, shadow, im))

    # Group A: Vertical Core & Gatehouse (6)
    add(
        "wt_fortress_spiral_stair",
        "Fortress Ashlar & Iron-Rail Spiral Staircase",
        ["watchtower", "stairs", "staircase", "spiral", "tower", "fortress", "stone", "iron", "harmony"],
        gen_fortress_spiral_stair(256, 256, 8101),
        shadow=False,
    )
    add(
        "wt_iron_pump_hatch_padlocked",
        "Padlocked Cast-Iron Maintenance Floor Hatch",
        ["watchtower", "hatch", "trapdoor", "iron", "subterranean", "basement", "stairs", "harmony"],
        gen_iron_pump_hatch(192, 192, 8102),
        shadow=False,
    )
    add(
        "wt_wanted_curfew_board",
        "District Wanted Posters & Curfew Notice Board",
        ["watchtower", "guard", "notice", "wanted", "board", "street", "city", "berlin", "harmony"],
        gen_wanted_curfew_board(224, 128, 8103),
    )
    add(
        "wt_duty_booking_desk",
        "Guardhouse Duty Sergeant's Booking Desk",
        ["watchtower", "guard", "desk", "office", "ledger", "prison", "garrison", "harmony"],
        gen_duty_booking_desk(256, 160, 8104),
    )
    add(
        "wt_speaking_tube_pipe",
        "Vertical Brass Aether-Voice Speaking Tube Manifold",
        ["watchtower", "magipunk", "brass", "pipe", "intercom", "signal", "office", "harmony"],
        gen_speaking_tube_pipe(144, 144, 8105),
        shadow=False,
    )
    add(
        "wt_key_cabinet_wall",
        "Locked Iron Cell-Key Pegboard & Ledger Rack",
        ["watchtower", "guard", "prison", "dungeon", "keys", "iron", "garrison", "harmony"],
        gen_key_cabinet_wall(160, 112, 8106),
        shadow=False,
    )

    # Group B: Armory & Garrison Barracks (8)
    add(
        "wt_garrison_armory_rack",
        "Garrison Halberd, Rifle & Aether-Carbine Rack",
        ["watchtower", "armory", "weapon", "rack", "guard", "garrison", "magipunk", "harmony"],
        gen_garrison_armory_rack(256, 144, 8201),
    )
    add(
        "wt_armorer_cleaning_bench",
        "Armorer's Weapon-Oiling & Bolt Maintenance Bench",
        ["watchtower", "armory", "workbench", "weapon", "guard", "garrison", "forge", "harmony"],
        gen_armorer_cleaning_bench(256, 160, 8202),
    )
    add(
        "wt_signal_flare_crate",
        "Red & Cyan Signal Flare Munitions Crate",
        ["watchtower", "armory", "signal", "flare", "crate", "ammo", "magipunk", "harmony"],
        gen_signal_flare_crate(192, 160, 8203),
    )
    add(
        "wt_sentry_gear_stand",
        "Watchman's Cuirass, Pickelhaube & Riot Shield Stand",
        ["watchtower", "armory", "armor", "guard", "helmet", "shield", "berlin", "harmony"],
        gen_sentry_gear_stand(192, 176, 8204),
    )
    add(
        "wt_garrison_bunk_cot",
        "Lived-In Garrison Iron Bunk & Prussian-Navy Blanket",
        ["watchtower", "barracks", "bed", "cot", "guard", "garrison", "apartment", "harmony"],
        gen_garrison_bunk_cot(176, 272, 8205),
    )
    add(
        "wt_greatcoat_boot_rack",
        "Watchmen's Wet Greatcoat & Muddy Boot Drying Bench",
        ["watchtower", "barracks", "guard", "boots", "coat", "bench", "clutter", "harmony"],
        gen_greatcoat_boot_rack(224, 128, 8206),
    )
    add(
        "wt_mess_ration_table",
        "Shift-Change Mess Table with Tin Mugs & Bread",
        ["watchtower", "barracks", "table", "food", "coffee", "guard", "garrison", "harmony"],
        gen_mess_ration_table(240, 176, 8207),
    )
    add(
        "wt_patrol_roster_table",
        "Patrol Shift Roster & Beat Schedule Table",
        ["watchtower", "barracks", "desk", "roster", "guard", "office", "garrison", "harmony"],
        gen_patrol_roster_table(224, 160, 8208),
    )

    # Group C: Watch Captain's Command Office (3)
    add(
        "wt_tactical_district_map_table",
        "Illuminated Circular Tactical District War-Map Table (Hero)",
        ["watchtower", "hero", "map", "table", "strategy", "command", "office", "berlin", "harmony"],
        gen_tactical_district_map_table(320, 320, 8301),
    )
    add(
        "wt_aether_telegraph_console",
        "Magipunk Aether-Telegraph & Pneumatic Dispatch Desk",
        ["watchtower", "magipunk", "telegraph", "aether", "desk", "office", "signal", "harmony"],
        gen_aether_telegraph_console(256, 160, 8302),
    )
    add(
        "wt_captain_dossier_cabinet",
        "Watch Captain's Iron-Bound Suspect Dossier Cabinet",
        ["watchtower", "office", "cabinet", "desk", "guard", "files", "garrison", "harmony"],
        gen_captain_dossier_cabinet(224, 128, 8303),
    )

    # Group D: Battlement Crown & Signal Post (8, incl. 2 dd_red colorables)
    add(
        "wt_searchlight_turret_aether",
        "Swiveling Magipunk Aether Searchlight Turret (Hero)",
        ["watchtower", "hero", "searchlight", "lighting", "turret", "aether", "magipunk", "roof", "harmony"],
        gen_searchlight_turret_aether(272, 272, 8401),
    )
    add(
        "wt_observatory_rangefinder",
        "360-Degree Brass Articulated Rangefinder & Lookout Telescope",
        ["watchtower", "telescope", "lookout", "brass", "tower", "roof", "magipunk", "harmony"],
        gen_observatory_rangefinder(208, 208, 8402),
    )
    add(
        "wt_district_alarm_bell",
        "Heavy Cast-Bronze District Alarm Bell & Timber Yoke",
        ["watchtower", "bell", "alarm", "signal", "tower", "roof", "bronze", "harmony"],
        gen_district_alarm_bell(208, 208, 8403),
    )
    add(
        "wt_searchlight_capacitor_bank",
        "High-Voltage Searchlight Aether Capacitor Dynamo",
        ["watchtower", "magipunk", "aether", "capacitor", "dynamo", "searchlight", "power", "harmony"],
        gen_searchlight_capacitor_bank(240, 160, 8404),
    )
    add(
        "wt_semaphore_signal_rack",
        "Semaphore Signal Flag Locker & Shutter Signal Lamp",
        ["watchtower", "signal", "semaphore", "flags", "lantern", "tower", "roof", "harmony"],
        gen_semaphore_signal_rack(208, 144, 8405),
    )
    add(
        "wt_sandbag_embrasure_arc",
        "Curved Burlap Sandbag Battlement Cover Arc",
        ["watchtower", "sandbag", "cover", "barricade", "battlement", "tower", "fortress", "harmony"],
        gen_sandbag_embrasure_arc(240, 128, 8406),
    )
    add(
        "wt_colorable_watch_banner_flag",
        "Colorable Watchtower Garrison Pennant & Flagpole Rig",
        ["watchtower", "banner", "flag", "pennant", "colorable", "dd_red", "garrison", "roof", "harmony"],
        gen_colorable_watch_banner_flag(192, 256, 8407),
        draw_mode="dd_red",
    )
    add(
        "wt_colorable_garrison_rug",
        "Colorable Circular Woven Watchtower Floor Rug",
        ["watchtower", "rug", "carpet", "colorable", "dd_red", "garrison", "furniture", "harmony"],
        gen_colorable_garrison_rug(256, 256, 8408),
        draw_mode="dd_red",
        shadow=False,
    )

    manifest_updates: list[dict] = []
    qa_entries: list[tuple[str, Image.Image]] = []
    for stem, name, tags, draw_mode, shadow, im in specs:
        rel = f"props/watchtower_garrison/{stem}.png"
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
        qa_entries.append((stem.replace("wt_", ""), im))

    mpath = MOD_DIR / "manifest.json"
    total = upsert_manifest_entries(mpath, manifest_updates)
    print(f"  Generated {len(specs)} bespoke Watchtower Garrison assets -> {mpath} ({total} total modular-suite-cc0 assets)")
    save_qa_sheet(qa_entries, SCRATCH_DIR / "qa_watchtower_suite.png", cols=5, cw=240, ch=220)


if __name__ == "__main__":
    build_all()

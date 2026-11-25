"""
Dice Chaos Maps — 30-Asset Painterly Community Kid Theater & Puppet Stage Suite

Generates 30 bespoke true top-down CC0 assets in:
  `public/assets/modular-suite-cc0/props/community_kid_theater/`

Designed for the working-class Berlin-Magipunk neighborhood courtyard directly behind
"Steam & Scoop Express" — homemade neighborhood magic with both complete hero pieces
AND modular bare bases + loose standalone splits + 2 dd_red colorables:
  - Group A (9): Bare Community Stage Deck, Painted Stage Steps, Patchwork Curtain Arch,
    Kid-Painted Cardboard Castle Flat, Paper-Maché Clockwork Dragon Prop, Cardboard Forest &
    Cloud Flat, Folding Striped Puppet Booth, Tin-Can Candle Footlight Bar, Loose Stageboard
    Kids' Clubhouse Treasure Stash
  - Group B (7): Overflowing Costume Trunk, Bare Open Prop Trunk, Cardboard Crown & Wooden
    Sword, Wire Fairy Wings & Patchwork Cape, Scenery Paint Cans & Drop Cloth, Backstage
    Prop Shelf & Shields, Scavenged Magipunk Jar-Lens Tin-Can Stage Spotlight
  - Group C (6): Kid-Run Tickets/Popcorn/Lemonade Booth, Bare Painted Concession Counter,
    Popcorn Kettle & Striped Bags, Lemonade Pitcher & Cups, Tin Ticket Box & Roll, Chalkboard
    Playbill A-Frame Easel
  - Group D (8): Patchwork Audience Quilt, Floor Cushions Cluster, Painted Milk-Crate Stool,
    Sidewalk Chalk Playbill & Arrow Decal, Sidewalk Chalk Hopscotch & Stars Decal, Overhead
    Pennant Bunting & Glowing Jar Fairy Lights, Colorable Quilted Audience Blanket (dd_red),
    Colorable Tufted Floor Cushion Pillow (dd_red)

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

OUT_DIR = MOD_DIR / "props" / "community_kid_theater"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Warm Storybook Community Theater Palette
OAK = (158, 114, 70)
PINE = (194, 152, 98)
WALNUT = (102, 68, 44)
CARDBOARD = (182, 146, 102)
CARDBOARD_DK = (142, 108, 70)
CRIMSON = (196, 52, 58)
CORAL = (224, 96, 84)
GOLD = (232, 186, 72)
MUSTARD = (212, 162, 58)
TEAL = (56, 146, 152)
SKY = (108, 174, 218)
DRAGON_GRN = (78, 158, 86)
DRAGON_LT = (132, 198, 112)
PLUM = (136, 74, 152)
CREAM = (242, 232, 208)
PAPER = (246, 240, 224)
TIN = (156, 164, 174)
IRON = (68, 74, 84)
BRASS = (206, 164, 78)
BRASS_HI = (236, 198, 104)
AMBER = (255, 196, 86)
CYAN = (84, 226, 255)
CHALK_PINK = (242, 142, 168)
CHALK_BLUE = (126, 204, 244)
CHALK_YELLOW = (248, 226, 116)
CHALK_MINT = (136, 224, 172)
CHALK_WHITE = (244, 240, 230)


def draw_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rgb: tuple[int, int, int] | tuple[int, int, int, int],
    ink_w: int = 5,
) -> None:
    rgb3 = (rgb[0], rgb[1], rgb[2])
    dk = blend_rgb(rgb3, (18, 14, 14), 0.40)
    hi = blend_rgb(rgb3, (255, 250, 236), 0.40)
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


def draw_star(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r_out: float,
    r_in: float,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    outline: tuple[int, int, int, int] | None = INK_MID,
    rot: float = -math.pi * 0.5,
) -> None:
    pts = []
    for i in range(10):
        a = rot + i * math.tau / 10
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    rgba = fill if len(fill) == 4 else (*fill, 255)
    d.polygon(pts, fill=rgba)
    if outline is not None:
        d.line(pts + [pts[0]], fill=outline, width=3)


# =============================================================================
# 1. BARE TIMBER COMMUNITY THEATER STAGE DECK (384x256, MODULAR BARE)
# =============================================================================
def gen_bare_community_stage_deck(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([26 + o[0], 26 + o[1], W - 26 + o[0], H - 26 + o[1]], radius=16, fill=c),
        (10, 12),
        14.0,
        120,
    )
    d = ImageDraw.Draw(im)
    # Heavy scavenged beam outer framing rim
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, WALNUT, ink_w=7, radius=14)
    # Warm sunlit hand-nailed pine/oak theater floorboards running horizontally!
    draw_wood_planks_box(d, 46, 46, W - 46, H - 46, OAK, rng, horizontal=True, n_planks=9, ink_w=6)
    # Subtle faded yellow/white tape stage-blocking marks ("X" center mark + front edge stripe)
    cx, cy = W * 0.5, H * 0.56
    d.line([(cx - 18, cy - 18), (cx + 18, cy + 18)], fill=(*CHALK_YELLOW, 255), width=5)
    d.line([(cx + 18, cy - 18), (cx - 18, cy + 18)], fill=(*CHALK_YELLOW, 255), width=5)
    # Painted faded crimson front lip trim along stage front (+Y edge)
    draw_beveled_rect(d, 46, H - 64, W - 46, H - 44, (156, 54, 58), ink_w=4, radius=4)
    # Corner iron reinforcement L-brackets & nailheads
    for bx, by in ((32, 32), (W - 76, 32), (32, H - 76), (W - 76, H - 76)):
        draw_beveled_rect(d, bx, by, bx + 44, by + 44, IRON, ink_w=4, radius=6)
        draw_disc(d, bx + 22, by + 22, 7, BRASS, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


# =============================================================================
# 2. LOW PAINTED-WOOD THEATER STAGE STEPS (160x128)
# =============================================================================
def gen_stage_front_steps_wood(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([20 + o[0], 22 + o[1], W - 20 + o[0], H - 22 + o[1]], radius=10, fill=c),
        (7, 9),
        10.0,
        100,
    )
    d = ImageDraw.Draw(im)
    # Side timber stringers
    draw_beveled_rect(d, 22, 24, 46, H - 24, WALNUT, ink_w=5, radius=6)
    draw_beveled_rect(d, W - 46, 24, W - 22, H - 24, WALNUT, ink_w=5, radius=6)
    # 3 wide ascending treads (top tread brightest, bottom step darker toward ground)
    tread_h = (H - 56) / 3.0
    tones = [PINE, OAK, (128, 92, 56)]
    for i in range(3):
        y0 = 28 + i * tread_h
        y1 = y0 + tread_h - 4
        draw_wood_planks_box(d, 44, y0, W - 44, y1, tones[i], rng, horizontal=True, n_planks=2, ink_w=5)
        # Cheerful faded gold/cream safety-edge painted nosing stripe
        d.line([(50, y1 - 6), (W - 50, y1 - 6)], fill=(228, 194, 108, 255), width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# 3. PATCHED PATCHWORK THEATER CURTAIN & ROPE RIG (368x112)
# =============================================================================
def gen_patchwork_curtain_arch(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 34 + o[1], W - 24 + o[0], H - 30 + o[1]], radius=22, fill=c),
        (8, 12),
        12.0,
        110,
    )
    d = ImageDraw.Draw(im)
    # Overhead scavenged timber crossbar & twin corner iron clamp posts
    draw_beveled_rect(d, 26, 62, W - 26, 104, WALNUT, ink_w=6, radius=10)
    draw_disc(d, 42, 83, 24, IRON, ink_w=5)
    draw_disc(d, W - 42, 83, 24, IRON, ink_w=5)
    draw_disc(d, 42, 83, 10, BRASS_HI, ink_w=3)
    draw_disc(d, W - 42, 83, 10, BRASS_HI, ink_w=3)

    # Scalloped patchwork valence draped across top bar (alternating crimson, teal, mustard, plum patches!)
    patch_cols = [CRIMSON, TEAL, MUSTARD, CRIMSON, PLUM, CORAL, GOLD, TEAL, CRIMSON]
    n_p = len(patch_cols)
    span = W - 120
    pw = span / n_p
    for i, col in enumerate(patch_cols):
        px0 = 60 + i * pw
        px1 = px0 + pw
        d.polygon(
            [(px0, 74), (px1, 74), (px1 - 4, 134), ((px0 + px1) * 0.5, 148), (px0 + 4, 134)],
            fill=(*col, 255),
            outline=INK,
        )
        d.line([(px0, 74), (px0 + 4, 134), ((px0 + px1) * 0.5, 148), (px1 - 4, 134), (px1, 74)], fill=INK, width=4)
        # Cute hand-stitched yellow thread cross-stitches along seams
        d.line([(px0 + pw * 0.5, 114), (px0 + pw * 0.5, 132)], fill=(*GOLD, 255), width=3)

    # Thick gathered curtain bunches tied back cleanly on left and right wings!
    for side_x, col_a, col_b in ((92, CRIMSON, CORAL), (W - 92, CRIMSON, PLUM)):
        for dx, dy, r, c in ((-24, 34, 36, col_a), (0, 44, 42, col_b), (24, 34, 36, CRIMSON)):
            draw_disc(d, side_x + dx, 110 + dy, r, c, ink_w=5)
        # Gold braided tieback rope
        draw_beveled_rect(d, side_x - 36, 136, side_x + 36, 156, GOLD, ink_w=4, radius=6)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


# =============================================================================
# 4. KID-PAINTED CARDBOARD CASTLE SCENERY FLAT (256x112)
# =============================================================================
def gen_cardboard_castle_flat(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 40 + o[1], W - 24 + o[0], H - 30 + o[1]], radius=12, fill=c),
        (8, 10),
        10.0,
        105,
    )
    d = ImageDraw.Draw(im)
    # Rear wooden A-frame prop kickstands peeking behind the cardboard flat (-Y side)!
    for kx in (114, W - 114):
        draw_beveled_rect(d, kx - 14, 24, kx + 14, 118, PINE, ink_w=5, radius=4)
        draw_beveled_rect(d, kx - 26, 22, kx + 26, 44, WALNUT, ink_w=4, radius=4)
    # Corrugated cardboard backing board edge
    draw_beveled_rect(d, 28, 72, W - 28, 174, CARDBOARD, ink_w=6, radius=8)
    # Kid-painted crenellated stone-gray turret tops & cheerful bright-blue flags along the front face!
    # 5 hand-cut cardboard merlons jutting out cleanly along front face
    for i in range(5):
        mx0 = 42 + i * 88
        draw_beveled_rect(d, mx0, 82, mx0 + 68, 168, (148, 152, 160), ink_w=5, radius=6)
        # Wobbly kid-painted stone brick lines
        d.line([(mx0 + 8, 112), (mx0 + 60, 110)], fill=INK_MID, width=3)
        d.line([(mx0 + 10, 140), (mx0 + 58, 142)], fill=INK_MID, width=3)
    # Center painted arched wooden castle gate + yellow stars + masking-tape repair strips!
    draw_beveled_rect(d, W * 0.5 - 48, 104, W * 0.5 + 48, 172, OAK, ink_w=5, radius=14)
    draw_rot_rect(d, 136, 98, 48, 18, 0.35, CREAM, INK_MID, 2)  # masking tape strip!
    draw_rot_rect(d, W - 136, 102, 48, 18, -0.32, CREAM, INK_MID, 2)
    # Tiny paper triangle flags on toothpicks/dowels at left & right turrets
    for fx, fc in ((76, CRIMSON), (W - 76, SKY)):
        d.polygon([(fx, 68), (fx + 44, 52), (fx + 44, 84)], fill=(*fc, 255), outline=INK)
        draw_disc(d, fx, 68, 8, GOLD, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


# =============================================================================
# 5. PAPER-MACHÉ & CARDBOARD CLOCKWORK DRAGON PROP (240x176)
# =============================================================================
def gen_cardboard_dragon_prop(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.52
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([48 + o[0], 42 + o[1], W - 48 + o[0], H - 42 + o[1]], fill=c),
        (9, 11),
        12.0,
        110,
    )
    d = ImageDraw.Draw(im)
    # Low wheeled wooden crate trolley peeking out under the kid-made dragon!
    draw_beveled_rect(d, cx - 102, cy - 58, cx + 102, cy + 58, PINE, ink_w=5, radius=10)
    # Outstretched cardboard-and-brass "Clockwork" dragon wings on left & right!
    for s in (-1, 1):
        wpts = [
            (cx + s * 42, cy - 28),
            (cx + s * 176, cy - 82),
            (cx + s * 194, cy + 16),
            (cx + s * 138, cy + 62),
            (cx + s * 46, cy + 36),
        ]
        d.polygon(wpts, fill=(*DRAGON_GRN, 255))
        d.line(wpts + [wpts[0]], fill=INK, width=6)
        # Painted golden cardboard clockwork gears glued onto each wing!
        draw_disc(d, cx + s * 124, cy - 10, 32, GOLD, ink_w=4)
        draw_disc(d, cx + s * 124, cy - 10, 12, CARDBOARD_DK, ink_w=3)
    # Round paper-maché dragon body & curvy cardboard tail pointing North (-Y)
    d.polygon([(cx - 28, cy - 48), (cx + 28, cy - 48), (cx + 12, 34), (cx - 24, 52)], fill=(*DRAGON_GRN, 255), outline=INK)
    d.line([(cx - 28, cy - 48), (cx - 24, 52), (cx + 12, 34), (cx + 28, cy - 48)], fill=INK, width=5)
    draw_disc(d, cx, cy - 4, 72, DRAGON_GRN, ink_w=6)
    draw_disc(d, cx, cy - 4, 48, DRAGON_LT, ink_w=4)
    # Cute brass painted dorsal gear-spines along back
    for sy in (cy - 44, cy - 12, cy + 20):
        draw_disc(d, cx, sy, 14, BRASS_HI, ink_w=3)
    # Big goofy painted paper-maché dragon snout facing South (+Y) with googly bottlecap eyes & red felt flame!
    d.polygon([(cx - 22, cy + 108), (cx + 22, cy + 108), (cx + 36, H - 22), (cx, H - 40), (cx - 36, H - 22)], fill=(*CORAL, 255), outline=INK)
    d.polygon([(cx - 14, cy + 112), (cx + 14, cy + 112), (cx, H - 36)], fill=(*GOLD, 255))
    draw_beveled_rect(d, cx - 50, cy + 40, cx + 50, cy + 124, DRAGON_GRN, ink_w=6, radius=24)
    # Googly bottlecap eyes + nostrils!
    for s in (-1, 1):
        draw_disc(d, cx + s * 28, cy + 68, 18, PAPER, ink_w=4)
        draw_disc(d, cx + s * 28 + s * 3, cy + 72, 8, INK_DARK, ink_w=2)
        d.ellipse([cx + s * 16 - 5, cy + 104 - 5, cx + s * 16 + 5, cy + 104 + 5], fill=INK_DARK)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


# =============================================================================
# 6. KID-PAINTED CARDBOARD TREES & CLOUD BACKDROP FLAT (224x112)
# =============================================================================
def gen_cardboard_forest_cloud_flat(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 42 + o[1], W - 24 + o[0], H - 30 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        100,
    )
    d = ImageDraw.Draw(im)
    for kx in (104, W - 104):
        draw_beveled_rect(d, kx - 12, 26, kx + 12, 114, PINE, ink_w=4, radius=4)
    draw_beveled_rect(d, 28, 72, W - 28, 174, CARDBOARD, ink_w=6, radius=8)
    # Painted bright sky-blue cardboard strip with puffy white clouds, sunny gold sun & green pine cutouts!
    draw_beveled_rect(d, 40, 84, W - 40, 162, SKY, ink_w=4, radius=6)
    # Cotton-ball painted clouds
    for cx_c in (110, 290):
        for dx, dy, r in ((-22, 4, 22), (0, -4, 28), (24, 4, 22)):
            d.ellipse([cx_c + dx - r, 116 + dy - r, cx_c + dx + r, 116 + dy + r], fill=(*PAPER, 255), outline=INK_MID, width=3)
    # Smiling golden sun
    draw_disc(d, 212, 118, 28, GOLD, ink_w=4)
    # Bright green pine cutout wedges along left & right edges
    for tx in (76, 366):
        d.polygon([(tx, 86), (tx + 34, 158), (tx - 34, 158)], fill=(*DRAGON_GRN, 255), outline=INK)
        d.line([(tx, 86), (tx + 34, 158), (tx - 34, 158), (tx, 86)], fill=INK, width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


# =============================================================================
# 7. FOLDING STRIPED NEIGHBORHOOD HAND-PUPPET BOOTH (208x144)
# =============================================================================
def gen_folding_puppet_booth(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([26 + o[0], 28 + o[1], W - 26 + o[0], H - 28 + o[1]], radius=14, fill=c),
        (8, 10),
        11.0,
        105,
    )
    d = ImageDraw.Draw(im)
    # Folding winged timber puppeteer frame (top-down open-back booth with front striped canopy!)
    draw_wood_planks_box(d, 30, 32, W - 30, H - 32, PINE, rng, horizontal=True, n_planks=5, ink_w=6)
    # Red-and-cream striped puppet theater top canopy across front two-thirds
    stripe_w = (W - 76) / 7.0
    for i in range(7):
        sx0 = 38 + i * stripe_w
        c = CRIMSON if i % 2 == 0 else CREAM
        draw_beveled_rect(d, sx0, 108, sx0 + stripe_w + 1, H - 38, c, ink_w=3, radius=3)
    d.rectangle([38, 108, W - 38, H - 38], outline=INK, width=5)
    # Gold star medallion painted on puppet canopy roof!
    draw_star(d, W * 0.5, 178, 36, 16, GOLD, INK)
    # Puppeteer's back ledge (-Y) lined with 3 colorful hand/sock puppets ready to grab!
    draw_beveled_rect(d, 46, 44, W - 46, 102, WALNUT, ink_w=4, radius=6)
    for px, pc in ((110, DRAGON_GRN), (W * 0.5, SKY), (W - 110, CORAL)):
        draw_disc(d, px, 72, 22, pc, ink_w=4)
        draw_disc(d, px - 6, 68, 4, PAPER, ink_w=1)
        draw_disc(d, px + 6, 68, 4, PAPER, ink_w=1)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.5)


# =============================================================================
# 8. SCAVENGED TIN-CAN & CANDLE THEATER FOOTLIGHT ROW (256x80)
# =============================================================================
def gen_tin_can_footlight_bar(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([20 + o[0], 34 + o[1], W - 20 + o[0], H - 30 + o[1]], radius=12, fill=c),
        (5, 7),
        8.0,
        90,
    )
    # Warm footlight glow pools projecting back onto the stage (-Y)!
    for i in range(5):
        lx = 68 + i * 94
        glow_col = AMBER if i % 2 == 0 else (255, 162, 118)
        add_glow(im, lx, 64, 58, 52, glow_col, alpha=118, blur=16.0)
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 24, 56, W - 24, H - 34, WALNUT, rng, horizontal=True, n_planks=2, ink_w=5)
    # 5 cut-open tin can half-hoods holding glowing wax stubs!
    for i in range(5):
        lx = 68 + i * 94
        d.chord([lx - 26, 48, lx + 26, 104], 0, 180, fill=(*TIN, 255), outline=INK, width=5)
        draw_disc(d, lx, 68, 16, AMBER, ink_w=3)
        draw_disc(d, lx, 68, 8, (255, 252, 230), ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


# =============================================================================
# 9. PRIED STAGEBOARD KIDS' CLUBHOUSE TREASURE BOX (160x160)
# =============================================================================
def gen_loose_stageboard_stash(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 24 + o[1], W - 24 + o[0], H - 24 + o[1]], radius=12, fill=c),
        (6, 7),
        8.0,
        95,
    )
    d = ImageDraw.Draw(im)
    # Dark under-stage crawlspace opening framed by oak planks
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, OAK, ink_w=6, radius=10)
    draw_beveled_rect(d, 46, 46, W - 46, H - 46, (32, 26, 22), ink_w=5, radius=6)
    # Open cigar box of "Clubhouse Treasures": colorful glass marbles, shiny brass key & crayon map!
    draw_beveled_rect(d, 64, 72, 224, 212, (166, 98, 54), ink_w=5, radius=8)
    draw_beveled_rect(d, 76, 84, 212, 200, (92, 54, 34), ink_w=3, radius=4)
    # Glass marbles (sky, crimson, gold, emerald)
    for mx, my, mc in ((106, 114, SKY), (132, 108, CRIMSON), (118, 138, GOLD), (146, 134, DRAGON_LT), (104, 166, PLUM)):
        draw_disc(d, mx, my, 12, mc, ink_w=3)
    # Shiny stolen/dropped brass alley key + folded crayon district map!
    draw_disc(d, 178, 118, 14, BRASS_HI, ink_w=3)
    d.line([(178, 130), (178, 184)], fill=INK, width=9)
    d.line([(178, 130), (178, 184)], fill=(*BRASS_HI, 255), width=5)
    d.line([(178, 170), (196, 170)], fill=(*BRASS_HI, 255), width=5)
    # Loose pried stage plank resting askew across the corner!
    draw_rot_rect(d, 232, 236, 152, 54, -0.42, PINE, INK, 5)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# 10. OVERFLOWING BACKSTAGE KIDS' COSTUME & PROP TRUNK (224x160)
# =============================================================================
def gen_costume_trunk_overflowing(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=14, fill=c),
        (8, 10),
        11.0,
        105,
    )
    d = ImageDraw.Draw(im)
    # Open steamer trunk lid folded back (-Y) + deep trunk body
    draw_wood_planks_box(d, 34, 24, W - 34, 96, WALNUT, rng, horizontal=True, n_planks=2, ink_w=5)
    draw_wood_planks_box(d, 28, 86, W - 28, H - 28, OAK, rng, horizontal=True, n_planks=4, ink_w=6)
    draw_beveled_rect(d, 48, 106, W - 48, H - 48, (58, 44, 34), ink_w=4, radius=6)
    # Spilling velvet crimson hero cape, teal wizard robe, yellow scarf, foil crown & wooden sword!
    d.polygon([(58, 120), (220, 114), (242, 276), (72, 294), (36, 224)], fill=(*CRIMSON, 255), outline=INK)
    d.line([(58, 120), (220, 114), (242, 276), (72, 294), (36, 224), (58, 120)], fill=INK, width=5)
    d.polygon([(204, 112), (382, 118), (402, 252), (246, 266)], fill=(*TEAL, 255), outline=INK)
    d.line([(204, 112), (382, 118), (402, 252), (246, 266), (204, 112)], fill=INK, width=5)
    # Foil crown & wooden toy sword poking out of trunk!
    draw_star(d, 152, 186, 40, 22, GOLD, INK)
    draw_rot_rect(d, 312, 198, 148, 22, -0.35, PINE, INK, 4)
    draw_rot_rect(d, 266, 214, 18, 66, -0.35, BRASS, INK, 4)
    # Brass trunk latches
    for bx in (96, W - 96):
        draw_beveled_rect(d, bx - 14, H - 36, bx + 14, H - 18, BRASS_HI, ink_w=3, radius=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.5)


# =============================================================================
# 11. BARE OPEN BACKSTAGE WOODEN PROP TRUNK (208x144, MODULAR BARE)
# =============================================================================
def gen_bare_costume_trunk_open(w: int, h: int, seed: int) -> Image.Image:
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
    draw_wood_planks_box(d, 32, 24, W - 32, 88, WALNUT, rng, horizontal=True, n_planks=2, ink_w=5)
    draw_wood_planks_box(d, 28, 78, W - 28, H - 28, OAK, rng, horizontal=True, n_planks=4, ink_w=6)
    # Striped vintage paper interior lining (empty so user can drop any props inside!)
    draw_beveled_rect(d, 48, 98, W - 48, H - 48, (186, 172, 146), ink_w=4, radius=6)
    for sx in range(64, W - 56, 26):
        d.line([(sx, 102), (sx, H - 52)], fill=(154, 132, 108, 255), width=4)
    for bx in (88, W - 88):
        draw_beveled_rect(d, bx - 12, H - 34, bx + 12, H - 18, BRASS, ink_w=3, radius=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# 12. FOIL-WRAPPED CARDBOARD CROWN & WOODEN TOY SWORD (160x144, MODULAR LOOSE)
# =============================================================================
def gen_prop_cardboard_crown_sword(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([36 + o[0], 36 + o[1], W - 36 + o[0], H - 36 + o[1]], fill=c),
        (6, 8),
        9.0,
        90,
    )
    d = ImageDraw.Draw(im)
    # Wooden toy broadsword angled diagonally with silver foil tape blade!
    draw_rot_rect(d, 178, 152, 212, 26, -0.52, TIN, INK, 5)
    draw_rot_rect(d, 102, 196, 22, 82, -0.52, GOLD, INK, 5)
    draw_rot_rect(d, 74, 212, 54, 22, -0.52, CRIMSON, INK, 4)
    # Cardboard tinfoil hero crown with bright painted paper gems!
    draw_star(d, 206, 108, 58, 36, GOLD, INK)
    draw_disc(d, 206, 108, 24, (74, 54, 42), ink_w=4)
    for gx, gy, gc in ((206, 72, CRIMSON), (238, 108, SKY), (174, 108, DRAGON_GRN)):
        draw_disc(d, gx, gy, 9, gc, ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 13. WIRE FAIRY WINGS & PATCHWORK HERO CAPE (176x144, MODULAR LOOSE)
# =============================================================================
def gen_prop_fairy_wings_cape(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([34 + o[0], 34 + o[1], W - 34 + o[0], H - 34 + o[1]], fill=c),
        (6, 8),
        9.0,
        90,
    )
    d = ImageDraw.Draw(im)
    # Folded bright sky-blue patched hero cape on left
    d.polygon([(46, 72), (186, 56), (206, 232), (62, 242), (34, 158)], fill=(*SKY, 255), outline=INK)
    d.line([(46, 72), (186, 56), (206, 232), (62, 242), (34, 158), (46, 72)], fill=INK, width=5)
    draw_rot_rect(d, 106, 178, 52, 46, 0.14, GOLD, INK_MID, 3)  # stitched yellow patch!
    # Wire-and-pastel-pink tulle fairy wings on right!
    cx, cy = 248, 146
    for sx in (-1, 1):
        d.ellipse([cx + sx * 10 - 44, cy - 84, cx + sx * 10 + 44, cy + 6], fill=(244, 186, 212, 255), outline=INK, width=4)
        d.ellipse([cx + sx * 8 - 34, cy - 4, cx + sx * 8 + 34, cy + 72], fill=(224, 168, 236, 255), outline=INK, width=4)
    draw_disc(d, cx, cy, 16, GOLD, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 14. KIDS' SCENERY PAINT CANS, ROLLERS & SPLATTERED DROP CLOTH (176x144)
# =============================================================================
def gen_prop_paint_buckets_brushes(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([26 + o[0], 26 + o[1], W - 26 + o[0], H - 26 + o[1]], radius=16, fill=c),
        (5, 7),
        8.0,
        85,
    )
    d = ImageDraw.Draw(im)
    # Paint-splattered canvas drop cloth
    draw_beveled_rect(d, 28, 28, W - 28, H - 28, (224, 214, 192), ink_w=5, radius=14)
    for sx, sy, sr, sc in ((92, 198, 24, SKY), (176, 152, 18, GOLD), (274, 206, 22, DRAGON_GRN), (222, 88, 16, CORAL)):
        d.ellipse([sx - sr, sy - sr * 0.8, sx + sr, sy + sr * 0.8], fill=(*sc, 255))
    # 3 open tin paint buckets (sky blue, sunny yellow, dragon green)
    for px, py, pc in ((98, 96, SKY), (186, 204, GOLD), (274, 108, DRAGON_GRN)):
        draw_disc(d, px, py, 38, TIN, ink_w=5)
        draw_disc(d, px, py, 28, pc, ink_w=3)
    # Paintbrushes resting on drop cloth
    draw_rot_rect(d, 192, 92, 96, 14, 0.25, PINE, INK, 3)
    draw_rot_rect(d, 240, 104, 26, 22, 0.25, CORAL, INK, 3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 15. BACKSTAGE WOODEN PROP SHELF & CARDBOARD SHIELDS (224x112)
# =============================================================================
def gen_backstage_prop_rack(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=10, fill=c),
        (7, 9),
        10.0,
        100,
    )
    d = ImageDraw.Draw(im)
    draw_wood_planks_box(d, 26, 28, W - 26, H - 28, OAK, rng, horizontal=True, n_planks=4, ink_w=6)
    # Painted cardboard knight shield, paper cone megaphone, handbell & rolled script scrolls!
    draw_disc(d, 96, H * 0.5, 52, SKY, ink_w=5)
    draw_star(d, 96, H * 0.5, 28, 12, GOLD, INK_MID)
    # Cardboard cone megaphone
    d.polygon([(176, 86), (258, 56), (258, 168), (176, 138)], fill=(*CRIMSON, 255), outline=INK)
    d.line([(176, 86), (258, 56), (258, 168), (176, 138), (176, 86)], fill=INK, width=5)
    # Rolled paper play scripts tied with red yarn & brass cue bell
    for sy in (78, 114, 150):
        draw_beveled_rect(d, 288, sy - 12, 392, sy + 12, PAPER, ink_w=3, radius=6)
        d.line([(340, sy - 12), (340, sy + 12)], fill=CRIMSON, width=5)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 16. SCAVENGED MAGIPUNK JAR-LENS TIN-CAN STAGE SPOTLIGHT (160x160)
# =============================================================================
def gen_mason_jar_spotlight_stand(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([54 + o[0], 54 + o[1], W - 54 + o[0], H - 54 + o[1]], fill=c),
        (7, 9),
        10.0,
        100,
    )
    add_glow(im, cx, cy + 52, 88, 82, AMBER, alpha=120, blur=20.0)
    add_glow(im, cx, cy + 28, 56, 56, CYAN, alpha=70, blur=14.0)
    d = ImageDraw.Draw(im)
    # 3 wooden broomstick tripod legs radiating 120°
    for k in range(3):
        a = -math.pi * 0.5 + k * math.tau / 3
        p1 = (cx + math.cos(a) * 104, cy + math.sin(a) * 104)
        d.line([(cx, cy), p1], fill=INK, width=18)
        d.line([(cx, cy), p1], fill=(*OAK, 255), width=10)
    # Painted red-and-tin soup-can spotlight housing pointing South (+Y) with glowing mason-jar lens!
    draw_beveled_rect(d, cx - 44, cy - 54, cx + 44, cy + 44, CRIMSON, ink_w=5, radius=14)
    draw_beveled_rect(d, cx - 34, cy - 42, cx + 34, cy + 28, TIN, ink_w=4, radius=10)
    d.polygon([(cx - 40, cy + 34), (cx + 40, cy + 34), (cx + 56, cy + 72), (cx - 56, cy + 72)], fill=(*AMBER, 255), outline=INK)
    d.polygon([(cx - 26, cy + 38), (cx + 26, cy + 38), (cx + 38, cy + 66), (cx - 38, cy + 66)], fill=(255, 250, 224, 255))
    d.line([(cx - 40, cy + 34), (cx - 56, cy + 72), (cx + 56, cy + 72), (cx + 40, cy + 34)], fill=INK, width=5)
    draw_disc(d, cx, cy - 10, 14, BRASS_HI, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 17. KID-RUN TICKETS, POPCORN & LEMONADE THEATER BOOTH (288x192)
# =============================================================================
def gen_ticket_popcorn_booth_full(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 26 + o[1], W - 24 + o[0], H - 26 + o[1]], radius=16, fill=c),
        (9, 11),
        12.0,
        110,
    )
    d = ImageDraw.Draw(im)
    # Painted wood counter shelf extending forward (+Y) so all the snacks & ticket box are 100% visible!
    draw_wood_planks_box(d, 30, 172, W - 30, H - 30, PINE, rng, horizontal=True, n_planks=4, ink_w=6)
    # Striped red-and-cream festive booth canopy covering back half (-Y)!
    stripe_w = (W - 60) / 9.0
    for i in range(9):
        sx0 = 30 + i * stripe_w
        c = CRIMSON if i % 2 == 0 else CREAM
        draw_beveled_rect(d, sx0, 28, sx0 + stripe_w + 1, 184, c, ink_w=3, radius=4)
    d.rectangle([30, 28, W - 30, 184], outline=INK, width=6)
    # Hand-painted timber "TICKETS" signboard strip across front canopy eave
    draw_beveled_rect(d, 142, 134, W - 142, 188, GOLD, ink_w=5, radius=8)
    draw_star(d, 174, 161, 16, 7, CRIMSON, INK_MID)
    draw_star(d, W - 174, 161, 16, 7, CRIMSON, INK_MID)
    for tx in range(214, W - 210, 26):
        d.line([(tx, 148), (tx, 174)], fill=INK_DARK, width=6)

    # Countertop Left: Warm brass popcorn kettle brimming with fluffy buttered popcorn + 2 striped bags!
    draw_disc(d, 112, 256, 48, BRASS, ink_w=5)
    for px, py in ((96, 244), (118, 240), (128, 260), (104, 268), (114, 252)):
        draw_disc(d, px, py, 14, (252, 240, 182), ink_w=2)
    draw_rot_rect(d, 194, 272, 42, 54, -0.15, CREAM, INK, 4)
    draw_rot_rect(d, 194, 272, 14, 50, -0.15, CRIMSON, INK_MID, 1)

    # Countertop Center: Tin ticket cigar box + red raffle ticket roll + brass desk bell!
    draw_beveled_rect(d, 248, 224, 344, 304, TEAL, ink_w=5, radius=8)
    draw_disc(d, 296, 264, 22, CRIMSON, ink_w=3)
    draw_disc(d, 296, 264, 8, PAPER, ink_w=2)
    draw_disc(d, 368, 242, 18, BRASS_HI, ink_w=3)

    # Countertop Right: Sunny yellow glass lemonade pitcher + floating lemon slice + 3 paper cups!
    draw_disc(d, 444, 248, 40, (248, 214, 72), ink_w=5)
    draw_disc(d, 444, 248, 18, (255, 242, 152), ink_w=3)
    for cx_c, cy_c in ((496, 292), (518, 252), (464, 306)):
        draw_disc(d, cx_c, cy_c, 16, PAPER, ink_w=3)
        draw_disc(d, cx_c, cy_c, 10, (248, 214, 72), ink_w=2)

    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


# =============================================================================
# 18. BARE PAINTED-WOOD THEATER CONCESSION COUNTER (240x128, MODULAR BARE)
# =============================================================================
def gen_bare_ticket_counter_wood(w: int, h: int, seed: int) -> Image.Image:
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
    draw_wood_planks_box(d, 26, 28, W - 26, H - 40, PINE, rng, horizontal=True, n_planks=4, ink_w=6)
    # Festive scalloped bunting lip peeking along front edge (+Y)
    cols = [CRIMSON, GOLD, TEAL, CORAL, SKY, GOLD]
    sw = (W - 60) / len(cols)
    for i, c in enumerate(cols):
        x0 = 30 + i * sw
        d.polygon([(x0, H - 44), (x0 + sw, H - 44), (x0 + sw * 0.5, H - 18)], fill=(*c, 255), outline=INK)
        d.line([(x0, H - 44), (x0 + sw * 0.5, H - 18), (x0 + sw, H - 44)], fill=INK, width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.3)


# =============================================================================
# 19. POPCORN KETTLE & STRIPED BAGS (160x144, MODULAR LOOSE)
# =============================================================================
def gen_popcorn_kettle_bags(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([36 + o[0], 36 + o[1], W - 36 + o[0], H - 36 + o[1]], fill=c),
        (6, 8),
        9.0,
        90,
    )
    d = ImageDraw.Draw(im)
    draw_disc(d, 118, 144, 68, BRASS, ink_w=6)
    for px, py in ((92, 122), (124, 116), (146, 138), (112, 152), (138, 166), (96, 164), (122, 138)):
        draw_disc(d, px, py, 18, (254, 242, 186), ink_w=3)
    # 2 striped popcorn paper bags on right
    for bx, by, ang in ((232, 112, 0.14), (242, 192, -0.18)):
        draw_rot_rect(d, bx, by, 58, 72, ang, CREAM, INK, 4)
        draw_rot_rect(d, bx, by, 18, 66, ang, CRIMSON, INK_MID, 1)
        draw_disc(d, bx, by - 26, 16, (254, 242, 186), ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 20. GLASS LEMONADE PITCHER, LEMONS & CUPS (160x144, MODULAR LOOSE)
# =============================================================================
def gen_lemonade_pitcher_cups(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([38 + o[0], 38 + o[1], W - 38 + o[0], H - 38 + o[1]], fill=c),
        (6, 8),
        9.0,
        90,
    )
    d = ImageDraw.Draw(im)
    draw_disc(d, 118, 144, 64, (206, 232, 242), ink_w=6)
    draw_disc(d, 118, 144, 52, (250, 218, 76), ink_w=4)
    # Floating bright yellow lemon wheel + wooden spoon handle
    draw_disc(d, 108, 134, 22, (255, 244, 158), ink_w=3)
    d.line([(128, 154), (178, 206)], fill=INK, width=12)
    d.line([(128, 154), (178, 206)], fill=(*PINE, 255), width=6)
    # 3 striped paper cups filled with lemonade
    for cx_c, cy_c in ((232, 96), (254, 164), (212, 212)):
        draw_disc(d, cx_c, cy_c, 26, PAPER, ink_w=4)
        draw_disc(d, cx_c, cy_c, 18, (250, 218, 76), ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 21. TIN TICKET CASHBOX, ROLL & COINS (144x128, MODULAR LOOSE)
# =============================================================================
def gen_ticket_box_roll_stubs(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([32 + o[0], 34 + o[1], W - 32 + o[0], H - 34 + o[1]], radius=12, fill=c),
        (6, 7),
        8.0,
        90,
    )
    d = ImageDraw.Draw(im)
    draw_beveled_rect(d, 36, 42, 204, H - 42, TEAL, ink_w=6, radius=10)
    draw_beveled_rect(d, 52, 58, 188, H - 58, (38, 74, 82), ink_w=4, radius=6)
    # Red ticket roll & curling stub strip + shiny copper pennies!
    draw_disc(d, 108, 128, 36, CRIMSON, ink_w=4)
    draw_disc(d, 108, 128, 14, PAPER, ink_w=3)
    draw_rot_rect(d, 162, 168, 74, 28, 0.25, CORAL, INK, 3)
    for cx_p, cy_p in ((232, 92), (248, 126), (226, 152), (242, 184)):
        draw_disc(d, cx_p, cy_p, 14, (206, 126, 74), ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# 22. A-FRAME CHALKBOARD PLAYBILL EASEL ("SIR SCOOP", 176x160)
# =============================================================================
def gen_chalkboard_playbill_easel(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([36 + o[0], 30 + o[1], W - 36 + o[0], H - 30 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        100,
    )
    d = ImageDraw.Draw(im)
    # Wooden A-frame chalkboard easel seen from slight top-down angle
    draw_beveled_rect(d, 40, 32, W - 40, H - 32, OAK, ink_w=6, radius=12)
    draw_beveled_rect(d, 62, 54, W - 62, H - 54, (44, 52, 56), ink_w=5, radius=6)
    # Colorful kid-chalk title banner, gold star, tiny dragon doodle & "1¢" price!
    draw_star(d, 108, 96, 22, 10, CHALK_YELLOW, None)
    draw_star(d, W - 108, 96, 22, 10, CHALK_PINK, None)
    d.line([(138, 92), (W - 138, 92)], fill=(*CHALK_WHITE, 255), width=8)
    d.line([(96, 134), (W - 96, 134)], fill=(*CHALK_BLUE, 255), width=7)
    d.line([(114, 172), (W - 114, 172)], fill=(*CHALK_MINT, 255), width=6)
    # Cute green chalk dragon squiggle & yellow underline
    d.arc([124, 192, 228, 252], 180, 360, fill=(*CHALK_MINT, 255), width=7)
    d.line([(92, 242), (W - 92, 242)], fill=(*CHALK_YELLOW, 255), width=5)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# 23. STITCHED NEIGHBORHOOD PATCHWORK AUDIENCE QUILT (256x208)
# =============================================================================
def gen_patchwork_quilt_blanket(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 24 + o[1], W - 24 + o[0], H - 24 + o[1]], radius=18, fill=c),
        (5, 6),
        8.0,
        85,
    )
    d = ImageDraw.Draw(im)
    # Soft cream stitched quilt binding border
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, CREAM, ink_w=6, radius=16)
    # 5x4 hand-sewn patchwork fabric squares in cozy neighborhood tones!
    palette = [CRIMSON, TEAL, MUSTARD, SKY, CORAL, PLUM, DRAGON_GRN, GOLD]
    cols, rows = 5, 4
    gx0, gy0 = 42, 42
    cw = (W - 84) / cols
    ch = (H - 84) / rows
    for r in range(rows):
        for c in range(cols):
            x0 = gx0 + c * cw
            y0 = gy0 + r * ch
            base = palette[(r * 3 + c * 2) % len(palette)]
            col = vary_rgb(base, rng, 10)
            d.rectangle([x0, y0, x0 + cw, y0 + ch], fill=(*col, 255), outline=INK_MID, width=3)
            # Subtle inner stitched quilting diamond or dot
            if (r + c) % 2 == 0:
                draw_star(d, x0 + cw * 0.5, y0 + ch * 0.5, 16, 7, CREAM, None)
            else:
                d.rectangle([x0 + 14, y0 + 14, x0 + cw - 14, y0 + ch - 14], outline=(244, 236, 218, 255), width=2)
    d.rounded_rectangle([26, 26, W - 26, H - 26], radius=16, outline=INK, width=6)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0)


# =============================================================================
# 24. SCATTERED COLORFUL KIDS' FLOOR PILLOWS & CUSHIONS (192x160)
# =============================================================================
def gen_floor_cushions_cluster(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.ellipse([36 + o[0], 34 + o[1], W - 36 + o[0], H - 34 + o[1]], fill=c),
        (6, 8),
        10.0,
        90,
    )
    d = ImageDraw.Draw(im)
    # 3 plump mismatched floor cushions tossed casually together!
    cushions = [
        (126, 128, 128, 118, -0.18, TEAL),
        (256, 116, 124, 114, 0.24, MUSTARD),
        (196, 214, 134, 116, 0.06, CORAL),
    ]
    for cx, cy, cw, ch, ang, col in cushions:
        dk = blend_rgb(col, (22, 16, 16), 0.34)
        hi = blend_rgb(col, (255, 250, 236), 0.30)
        draw_rot_rect(d, cx, cy, cw, ch, ang, dk, INK, 6)
        draw_rot_rect(d, cx, cy, cw - 16, ch - 16, ang, col, INK_MID, 2)
        draw_disc(d, cx, cy, 12, CREAM, ink_w=3)
        # Cute corner tassels
        for sx in (-1, 1):
            for sy in (-1, 1):
                tp = rot_pt(cx, cy, sx * cw * 0.48, sy * ch * 0.48, ang)
                draw_disc(d, tp[0], tp[1], 8, GOLD, ink_w=2)
        p0 = rot_pt(cx, cy, -cw * 0.26, -ch * 0.24, ang)
        p1 = rot_pt(cx, cy, cw * 0.26, -ch * 0.24, ang)
        d.line([p0, p1], fill=hi, width=5)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


# =============================================================================
# 25. UPTURNED PAINTED WOODEN MILK-CRATE KID STOOL (144x144)
# =============================================================================
def gen_milk_crate_stool_painted(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([38 + o[0], 38 + o[1], W - 38 + o[0], H - 38 + o[1]], radius=12, fill=c),
        (7, 9),
        10.0,
        100,
    )
    d = ImageDraw.Draw(im)
    # Hand-painted sky-blue timber milk crate base
    draw_wood_planks_box(d, 40, 40, W - 40, H - 40, SKY, rng, horizontal=True, n_planks=4, ink_w=6)
    # Tied quilted round seat cushion perched right on top!
    draw_disc(d, cx, cy, 74, MUSTARD, ink_w=5)
    draw_disc(d, cx, cy, 52, CORAL, ink_w=4)
    draw_disc(d, cx, cy, 14, CREAM, ink_w=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.6)


# =============================================================================
# 26. SIDEWALK CHALK PLAYBILL, DRAGON DOODLE & ARROW DECAL (256x192)
# =============================================================================
def gen_chalk_courtyard_playbill_decal(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    d = ImageDraw.Draw(im)
    # Soft pastel sidewalk chalk border & directional arrow pointing toward stage (+X / +Y)!
    # Outer sketchy pastel chalk frame
    d.rounded_rectangle([36, 36, W - 36, H - 36], radius=24, outline=(*CHALK_BLUE, 220), width=8)
    d.rounded_rectangle([48, 48, W - 48, H - 48], radius=18, outline=(*CHALK_WHITE, 190), width=4)
    # Chalk crown + dragon doodle + stars!
    draw_star(d, 108, 102, 28, 12, (*CHALK_YELLOW, 230), None)
    draw_star(d, W - 108, 102, 28, 12, (*CHALK_PINK, 230), None)
    draw_star(d, 104, H - 100, 22, 10, (*CHALK_MINT, 220), None)
    # Hand-drawn chalk headline lines
    d.line([(152, 92), (W - 152, 92)], fill=(*CHALK_WHITE, 235), width=10)
    d.line([(116, 134), (W - 116, 134)], fill=(*CHALK_YELLOW, 230), width=9)
    # Playful chalk dragon squiggle in center
    d.arc([164, 166, 336, 248], 190, 355, fill=(*CHALK_MINT, 230), width=10)
    d.ellipse([322, 182, 362, 218], fill=(*CHALK_MINT, 230))
    d.polygon([(362, 190), (394, 180), (382, 212)], fill=(*CHALK_PINK, 230))
    # Big chalk directional arrow at bottom pointing right (+X) toward the stage!
    d.line([(146, H - 94), (W - 112, H - 94)], fill=(*CHALK_YELLOW, 240), width=12)
    d.polygon([(W - 134, H - 124), (W - 84, H - 94), (W - 134, H - 64)], fill=(*CHALK_YELLOW, 240))
    return apply_painterly_finish(im, w, h, seed=seed, grain=6.4, warm_bevel=False)


# =============================================================================
# 27. SIDEWALK CHALK HOPSCOTCH & STAR-BORDER DECAL (224x144)
# =============================================================================
def gen_chalk_hopscotch_stars_decal(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    d = ImageDraw.Draw(im)
    # Classic horizontal kids' chalk hopscotch court (1, 2-3, 4, 5-6, 7)!
    boxes = [
        (36, 106, 98, 174, CHALK_YELLOW),
        (104, 68, 166, 136, CHALK_PINK),
        (104, 144, 166, 212, CHALK_BLUE),
        (172, 106, 234, 174, CHALK_MINT),
        (240, 68, 302, 136, CHALK_YELLOW),
        (240, 144, 302, 212, CHALK_PINK),
        (308, 106, 376, 174, CHALK_BLUE),
    ]
    for x0, y0, x1, y1, c in boxes:
        d.rounded_rectangle([x0, y0, x1, y1], radius=8, outline=(*c, 230), width=8)
        d.ellipse([(x0 + x1) * 0.5 - 8, (y0 + y1) * 0.5 - 8, (x0 + x1) * 0.5 + 8, (y0 + y1) * 0.5 + 8], fill=(*CHALK_WHITE, 200))
    # Chalk home arch & scattered stars + tiny chalk sticks!
    d.arc([374, 96, 424, 184], 270, 90, fill=(*CHALK_YELLOW, 235), width=8)
    draw_star(d, 68, 62, 20, 9, (*CHALK_WHITE, 215), None)
    draw_star(d, 358, 224, 22, 10, (*CHALK_MINT, 215), None)
    draw_rot_rect(d, 204, 238, 36, 12, 0.35, CHALK_PINK, INK_MID, 2)
    draw_rot_rect(d, 226, 250, 34, 12, -0.22, CHALK_BLUE, INK_MID, 2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=6.2, warm_bevel=False)


# =============================================================================
# 28. OVERHEAD PENNANT BUNTING & GLOWING JAR FAIRY LIGHTS (320x112)
# =============================================================================
def gen_jar_fairy_bunting_garland(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    # Warm glowing mason-jar fairy light bulbs hanging along curved catenary twine!
    pts = []
    for i in range(25):
        t = i / 24.0
        x = 22 + t * (W - 44)
        y = 48 + math.sin(t * math.pi) * 44
        pts.append((x, y))
    for idx in (3, 7, 12, 17, 21):
        bx, by = pts[idx]
        gcol = AMBER if idx % 2 == 1 else (255, 178, 118)
        add_glow(im, bx, by + 18, 48, 48, gcol, alpha=118, blur=16.0)
    d = ImageDraw.Draw(im)
    d.line(pts, fill=INK, width=9)
    d.line(pts, fill=(*CARDBOARD, 255), width=4)
    # 11 colorful stitched triangular pennant flags
    fcols = [CRIMSON, GOLD, SKY, CORAL, DRAGON_GRN, PLUM, MUSTARD]
    for i in range(11):
        t0 = 0.05 + i * 0.082
        t1 = t0 + 0.068
        x0 = 22 + t0 * (W - 44)
        y0 = 48 + math.sin(t0 * math.pi) * 44
        x1 = 22 + t1 * (W - 44)
        y1 = 48 + math.sin(t1 * math.pi) * 44
        xm = (x0 + x1) * 0.5
        ym = (y0 + y1) * 0.5 + 56
        fc = fcols[i % len(fcols)]
        d.polygon([(x0, y0), (x1, y1), (xm, ym)], fill=(*fc, 255), outline=INK)
        d.line([(x0, y0), (xm, ym), (x1, y1)], fill=INK, width=4)
    # 5 glowing mason-jar fairy lanterns nestled along the twine!
    for idx in (3, 7, 12, 17, 21):
        bx, by = pts[idx]
        draw_disc(d, bx, by + 16, 16, AMBER, ink_w=3)
        draw_disc(d, bx, by + 16, 8, (255, 252, 232), ink_w=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


# =============================================================================
# 29. COLORABLE QUILTED AUDIENCE PICNIC BLANKET (dd_red, 256x208)
# =============================================================================
def gen_colorable_audience_quilt(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([24 + o[0], 24 + o[1], W - 24 + o[0], H - 24 + o[1]], radius=18, fill=c),
        (5, 6),
        8.0,
        85,
    )
    d = ImageDraw.Draw(im)
    # Cream neutral quilt binding + pure dd_red quilted diamond grid!
    draw_beveled_rect(d, 26, 26, W - 26, H - 26, CREAM, ink_w=6, radius=16)
    d.rounded_rectangle([42, 42, W - 42, H - 42], radius=10, fill=(*DD_RED_BASE, 255), outline=INK, width=4)
    cols, rows = 4, 3
    cw = (W - 84) / cols
    ch = (H - 84) / rows
    for r in range(rows):
        for c in range(cols):
            x0 = 42 + c * cw
            y0 = 42 + r * ch
            tone = DD_RED_HI if (r + c) % 2 == 0 else DD_RED_DEEP
            d.rectangle([x0, y0, x0 + cw, y0 + ch], fill=(*tone, 255), outline=(228, 216, 192, 255), width=3)
            draw_star(d, x0 + cw * 0.5, y0 + ch * 0.5, 18, 8, CREAM, None)
    d.rounded_rectangle([26, 26, W - 26, H - 26], radius=16, outline=INK, width=6)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0)


# =============================================================================
# 30. COLORABLE TUFTED FLOOR CUSHION PILLOW (dd_red, 144x144)
# =============================================================================
def gen_colorable_floor_cushion(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(
        im,
        lambda sd, c, o: sd.rounded_rectangle([42 + o[0], 42 + o[1], W - 42 + o[0], H - 42 + o[1]], radius=26, fill=c),
        (6, 8),
        9.0,
        95,
    )
    d = ImageDraw.Draw(im)
    # Plump tufted dd_red square floor cushion with neutral cream button & corner tassels
    d.rounded_rectangle([42, 42, W - 42, H - 42], radius=28, fill=(*DD_RED_DEEP, 255), outline=INK, width=6)
    d.rounded_rectangle([54, 54, W - 54, H - 54], radius=22, fill=(*DD_RED_BASE, 255))
    d.rounded_rectangle([70, 64, W - 70, H - 84], radius=16, fill=(*DD_RED_HI, 255))
    # 4 corner neutral tassels + central tufted cream button
    for sx in (-1, 1):
        for sy in (-1, 1):
            draw_disc(d, cx + sx * 96, cy + sy * 96, 14, CREAM, ink_w=3)
            d.line([(cx + sx * 20, cy + sy * 20), (cx + sx * 76, cy + sy * 76)], fill=(*DD_RED_DEEP, 255), width=5)
    draw_disc(d, cx, cy, 18, CREAM, ink_w=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.8)


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

    # Group A: Stage, Curtains & Scenery Flats (9)
    add(
        "kt_bare_community_stage_deck",
        "Bare Timber Community Theater Stage Deck",
        ["theater", "stage", "bare", "modular", "kids", "community", "festival", "wood", "harmony"],
        gen_bare_community_stage_deck(384, 256, 9101),
    )
    add(
        "kt_stage_front_steps_wood",
        "Low Painted-Wood Theater Stage Steps",
        ["theater", "stage", "stairs", "steps", "modular", "kids", "wood", "harmony"],
        gen_stage_front_steps_wood(160, 128, 9102),
    )
    add(
        "kt_patchwork_curtain_arch",
        "Patched Patchwork Theater Curtain & Rope Rig",
        ["theater", "stage", "curtain", "modular", "kids", "community", "festival", "harmony"],
        gen_patchwork_curtain_arch(368, 112, 9103),
    )
    add(
        "kt_cardboard_castle_flat",
        "Kid-Painted Cardboard Castle Scenery Flat",
        ["theater", "stage", "cardboard", "castle", "backdrop", "modular", "kids", "harmony"],
        gen_cardboard_castle_flat(256, 112, 9104),
    )
    add(
        "kt_cardboard_dragon_prop",
        "Paper-Mache & Cardboard Clockwork Dragon Stage Prop",
        ["theater", "stage", "dragon", "cardboard", "puppet", "kids", "magipunk", "harmony"],
        gen_cardboard_dragon_prop(240, 176, 9105),
    )
    add(
        "kt_cardboard_forest_cloud_flat",
        "Kid-Painted Cardboard Trees & Cloud Backdrop Flat",
        ["theater", "stage", "cardboard", "backdrop", "trees", "modular", "kids", "harmony"],
        gen_cardboard_forest_cloud_flat(224, 112, 9106),
    )
    add(
        "kt_folding_puppet_booth",
        "Folding Striped Neighborhood Hand-Puppet Booth",
        ["theater", "puppet", "stage", "booth", "modular", "kids", "community", "festival", "harmony"],
        gen_folding_puppet_booth(208, 144, 9107),
    )
    add(
        "kt_tin_can_footlight_bar",
        "Scavenged Tin-Can & Candle Theater Footlight Row",
        ["theater", "stage", "lighting", "footlights", "candle", "modular", "kids", "harmony"],
        gen_tin_can_footlight_bar(256, 80, 9108),
        shadow=False,
    )
    add(
        "kt_loose_stageboard_clubhouse_stash",
        "Pried Stageboard Kids' Clubhouse Treasure Box",
        ["theater", "stage", "secret", "stash", "kids", "toys", "marbles", "modular", "harmony"],
        gen_loose_stageboard_stash(160, 160, 9109),
        shadow=False,
    )

    # Group B: Backstage Costume Trunk & Loose Play Props (7)
    add(
        "kt_costume_trunk_overflowing",
        "Overflowing Backstage Kids' Costume & Prop Trunk",
        ["theater", "costume", "trunk", "backstage", "kids", "toys", "clutter", "harmony"],
        gen_costume_trunk_overflowing(224, 160, 9201),
    )
    add(
        "kt_bare_costume_trunk_open",
        "Bare Open Backstage Wooden Prop Trunk",
        ["theater", "trunk", "bare", "modular", "backstage", "storage", "wood", "harmony"],
        gen_bare_costume_trunk_open(208, 144, 9202),
    )
    add(
        "kt_prop_cardboard_crown_sword",
        "Foil-Wrapped Cardboard Crown & Wooden Toy Sword",
        ["theater", "costume", "crown", "sword", "kids", "toys", "modular", "clutter", "harmony"],
        gen_prop_cardboard_crown_sword(160, 144, 9203),
    )
    add(
        "kt_prop_fairy_wings_cape",
        "Wire-and-Tulle Fairy Wings & Patchwork Hero Cape",
        ["theater", "costume", "wings", "cape", "kids", "toys", "modular", "clutter", "harmony"],
        gen_prop_fairy_wings_cape(176, 144, 9204),
    )
    add(
        "kt_prop_paint_buckets_brushes",
        "Kids' Scenery Paint Cans, Brushes & Drop Cloth",
        ["theater", "paint", "craft", "backstage", "kids", "modular", "clutter", "harmony"],
        gen_prop_paint_buckets_brushes(176, 144, 9205),
    )
    add(
        "kt_backstage_prop_rack",
        "Backstage Wooden Prop Shelf, Shield & Megaphone",
        ["theater", "backstage", "props", "shelf", "kids", "modular", "harmony"],
        gen_backstage_prop_rack(224, 112, 9206),
    )
    add(
        "kt_mason_jar_spotlight_stand",
        "Scavenged Magipunk Jar-Lens Tin-Can Stage Spotlight",
        ["theater", "lighting", "spotlight", "lamp", "magipunk", "kids", "modular", "harmony"],
        gen_mason_jar_spotlight_stand(160, 160, 9207),
    )

    # Group C: Tickets, Popcorn & Lemonade Booth + Loose Concession Splits (6)
    add(
        "kt_ticket_popcorn_booth_full",
        "Kid-Run Tickets, Popcorn & Lemonade Theater Booth",
        ["theater", "booth", "tickets", "popcorn", "lemonade", "shop", "kids", "festival", "harmony"],
        gen_ticket_popcorn_booth_full(288, 192, 9301),
    )
    add(
        "kt_bare_ticket_counter_wood",
        "Bare Painted-Wood Theater Concession Counter",
        ["theater", "counter", "bare", "modular", "booth", "shop", "wood", "harmony"],
        gen_bare_ticket_counter_wood(240, 128, 9302),
    )
    add(
        "kt_popcorn_kettle_bags",
        "Buttered Popcorn Kettle & Striped Paper Popcorn Bags",
        ["theater", "popcorn", "food", "snacks", "modular", "kids", "festival", "clutter", "harmony"],
        gen_popcorn_kettle_bags(160, 144, 9303),
    )
    add(
        "kt_lemonade_pitcher_cups",
        "Glass Lemonade Pitcher, Lemon Slices & Paper Cups",
        ["theater", "lemonade", "drink", "food", "modular", "kids", "festival", "clutter", "harmony"],
        gen_lemonade_pitcher_cups(160, 144, 9304),
    )
    add(
        "kt_ticket_box_roll_stubs",
        "Tin Ticket Cashbox, Paper Ticket Roll & Copper Coins",
        ["theater", "tickets", "cashbox", "shop", "modular", "clutter", "harmony"],
        gen_ticket_box_roll_stubs(144, 128, 9305),
    )
    add(
        "kt_chalkboard_playbill_easel",
        "A-Frame Chalkboard Playbill Easel (Sir Scoop)",
        ["theater", "playbill", "sign", "chalkboard", "easel", "kids", "street", "modular", "harmony"],
        gen_chalkboard_playbill_easel(176, 160, 9306),
    )

    # Group D: Audience Seating, Chalk Art, Bunting & Colorables (8)
    add(
        "kt_patchwork_quilt_blanket",
        "Stitched Neighborhood Patchwork Audience Quilt",
        ["theater", "quilt", "blanket", "rug", "seating", "kids", "park", "modular", "harmony"],
        gen_patchwork_quilt_blanket(256, 208, 9401),
        shadow=False,
    )
    add(
        "kt_floor_cushions_cluster",
        "Scattered Colorful Kids' Floor Pillows & Cushions",
        ["theater", "cushion", "pillow", "seating", "kids", "home", "modular", "harmony"],
        gen_floor_cushions_cluster(192, 160, 9402),
    )
    add(
        "kt_milk_crate_stool_painted",
        "Upturned Painted Wooden Milk-Crate Kid Stool",
        ["theater", "stool", "crate", "seating", "kids", "modular", "furniture", "harmony"],
        gen_milk_crate_stool_painted(144, 144, 9403),
    )
    add(
        "kt_chalk_courtyard_playbill_decal",
        "Sidewalk Chalk Playbill, Dragon Doodle & Arrow Decal",
        ["theater", "chalk", "decal", "kids", "street", "playbill", "modular", "harmony"],
        gen_chalk_courtyard_playbill_decal(256, 192, 9404),
        shadow=False,
    )
    add(
        "kt_chalk_hopscotch_stars_decal",
        "Sidewalk Chalk Hopscotch & Star-Border Decal",
        ["theater", "chalk", "hopscotch", "decal", "kids", "street", "park", "modular", "harmony"],
        gen_chalk_hopscotch_stars_decal(224, 144, 9405),
        shadow=False,
    )
    add(
        "kt_jar_fairy_bunting_garland",
        "Overhead Pennant Bunting & Glowing Jar Fairy Lights",
        ["theater", "bunting", "lighting", "garland", "festival", "kids", "street", "harmony"],
        gen_jar_fairy_bunting_garland(320, 112, 9406),
        shadow=False,
    )
    add(
        "kt_colorable_audience_quilt",
        "Colorable Quilted Audience Picnic Blanket",
        ["theater", "quilt", "blanket", "rug", "colorable", "dd_red", "seating", "kids", "modular", "harmony"],
        gen_colorable_audience_quilt(256, 208, 9407),
        draw_mode="dd_red",
        shadow=False,
    )
    add(
        "kt_colorable_floor_cushion",
        "Colorable Plump Tufted Floor Cushion Pillow",
        ["theater", "cushion", "pillow", "colorable", "dd_red", "seating", "kids", "modular", "harmony"],
        gen_colorable_floor_cushion(144, 144, 9408),
        draw_mode="dd_red",
    )

    manifest_updates: list[dict] = []
    qa_entries: list[tuple[str, Image.Image]] = []
    for stem, name, tags, draw_mode, shadow, im in specs:
        rel = f"props/community_kid_theater/{stem}.png"
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
        qa_entries.append((stem.replace("kt_", ""), im))

    mpath = MOD_DIR / "manifest.json"
    total = upsert_manifest_entries(mpath, manifest_updates)
    print(f"  Generated {len(specs)} bespoke Community Kid Theater assets -> {mpath} ({total} total modular-suite-cc0 assets)")
    save_qa_sheet(qa_entries, SCRATCH_DIR / "qa_kid_theater_suite.png", cols=6, cw=220, ch=190)


if __name__ == "__main__":
    build_all()

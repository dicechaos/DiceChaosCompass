"""
Dice Chaos Compass — 12-Asset Bahnhofspavillon Nord (Tram Rotunda Café & Dispatch) Suite

Generates 12 museum-grade 2x-supersampled Studio Harmony CC0 assets (`props/tram_rotunda/`)
for the 3-story circular North Tram-Terminus Rotunda between Eisenbahnstraße & Hinterhof-Kiezpark:
  1. `rot_curved_espresso_ticket_bar.png`         (320x160) — Curved mahogany & brass circular service counter
  2. `rot_brass_espresso_machine.png`             (160x128) — Twin-boiler brass & copper Magipunk espresso engine
  3. `rot_pastry_glass_dome_case.png`             (160x112) — Curved glass & brass Berliner pastry & pretzel showcase
  4. `rot_ticket_punch_dispenser.png`             (144x112) — Brass tram-ticket roll rack, hand-punch & fare tray
  5. `rot_marble_bistro_table_set.png`            (192x192) — Round Viennese marble café table w/ 2 bentwood chairs
  6. `rot_tram_timetable_board.png`               (224x96)  — Brass-framed mechanical flip-flap Linie 14 timetable board
  7. `rot_street_newsstand_rack.png`              (176x112) — Wrought-iron sidewalk broadsheet newspaper kiosk stand
  8. `rot_pavilion_striped_awning.png`            (240x96)  — Forest-green & cream scalloped Berlin pavilion awning
  9. `rot_curved_velvet_banquette_colorable.png`  (256x128, dd_red) — Curved tufted velvet coffeehouse banquette
 10. `rot_newspaper_stick_rack.png`               (160x112) — Vienna/Berlin oak Zeitungshalter newspaper-stick stand
 11. `rot_aether_tram_switchboard.png`            (240x240) — Circular brass & glowing cyan-aether tram telemetry console
 12. `rot_pneumatic_tube_manifold.png`            (224x112) — Riveted brass pneumatic dispatch tube bank & dials

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
    INK_DARK,
    INK_MID,
    INK_IRON,
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

OUT_DIR = MOD_DIR / "props" / "tram_rotunda"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Unified Berlin-Magipunk Pavilion Palette
MAHOGANY = (114, 52, 40)
MAHOGANY_DK = (76, 34, 28)
WALNUT = (92, 60, 40)
OAK = (154, 112, 70)
PINE = (188, 150, 102)
BRASS = (204, 160, 72)
BRASS_HI = (238, 206, 118)
BRASS_DK = (134, 100, 42)
COPPER = (184, 104, 62)
COPPER_HI = (224, 144, 96)
IRON = (60, 66, 74)
IRON_DK = (34, 38, 46)
STEEL = (146, 154, 164)
VERDIGRIS = (72, 128, 112)
FOREST = (38, 86, 62)
FOREST_HI = (62, 118, 86)
CREAM = (242, 234, 214)
MARBLE = (228, 224, 214)
MARBLE_VEIN = (176, 172, 164)
PAPER = (232, 222, 196)
PRUSSIAN = (44, 74, 110)
BURGUNDY = (138, 44, 52)
CRIMSON = (178, 52, 54)
OCHRE = (204, 150, 60)
PASTRY = (194, 134, 68)
PASTRY_DK = (142, 86, 40)
GLASS = (176, 212, 222)
AETHER_CYAN = (84, 222, 248)
AETHER_DEEP = (26, 76, 104)
AMBER_GLOW = (255, 196, 90)
COFFEE = (64, 38, 24)


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


def draw_curved_band_poly(
    cx: float,
    cy: float,
    r_in: float,
    r_out: float,
    a0_deg: float,
    a1_deg: float,
    steps: int = 36,
) -> list[tuple[float, float]]:
    pts = []
    for i in range(steps + 1):
        a = math.radians(a0_deg + (a1_deg - a0_deg) * (i / steps))
        pts.append((cx + math.cos(a) * r_out, cy + math.sin(a) * r_out))
    for i in range(steps, -1, -1):
        a = math.radians(a0_deg + (a1_deg - a0_deg) * (i / steps))
        pts.append((cx + math.cos(a) * r_in, cy + math.sin(a) * r_in))
    return pts


# =============================================================================
# 1. CURVED MAHOGANY & BRASS ROTUNDA ESPRESSO & TICKET BAR (320x160)
# =============================================================================
def gen_rot_curved_espresso_ticket_bar() -> Image.Image:
    w, h = 320, 160
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy = W / 2.0, -H * 0.42
    r_in, r_out = H * 0.72, H * 1.24

    # Outer brass footrail peeking along curved customer front
    rail = draw_curved_band_poly(cx, cy, r_out - 4, r_out + 16, 42, 138, 36)
    d.polygon(rail, fill=(*BRASS, 255), outline=INK)
    d.line(rail + [rail[0]], fill=INK, width=5)

    # Thick curved mahogany counter body
    body = draw_curved_band_poly(cx, cy, r_in, r_out, 40, 140, 40)
    d.polygon(body, fill=(*MAHOGANY, 255), outline=INK)
    d.line(body + [body[0]], fill=INK, width=7)

    # Inset cream Viennese marble serving slab following the curve!
    slab = draw_curved_band_poly(cx, cy, r_in + 18, r_out - 18, 43, 137, 36)
    d.polygon(slab, fill=(*MARBLE, 255), outline=INK)
    d.line(slab + [slab[0]], fill=INK_MID, width=4)

    # Radial brass joint moldings & subtle marble veins across the curved top
    for a_deg in [58, 76, 90, 104, 122]:
        a = math.radians(a_deg)
        p0 = (cx + math.cos(a) * (r_in + 20), cy + math.sin(a) * (r_in + 20))
        p1 = (cx + math.cos(a) * (r_out - 20), cy + math.sin(a) * (r_out - 20))
        col = BRASS if a_deg in (76, 104) else MARBLE_VEIN
        d.line([p0, p1], fill=col, width=5 if a_deg in (76, 104) else 3)

    # Brass corner caps & decorative rail finials at both curved bar ends
    for a_deg in (41, 139):
        a = math.radians(a_deg)
        mx = cx + math.cos(a) * ((r_in + r_out) * 0.5)
        my = cy + math.sin(a) * ((r_in + r_out) * 0.5)
        draw_disc(d, mx, my, 12, BRASS_HI, ink_w=3)

    return finish_prop(im, w, h, seed=7301)


# =============================================================================
# 2. TWIN-BOILER BRASS & COPPER MAGIPUNK STEAM-ESPRESSO MACHINE (160x128)
# =============================================================================
def gen_rot_brass_espresso_machine() -> Image.Image:
    w, h = 160, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Slotted cast-iron & brass drip-tray base plate
    draw_beveled_rect(d, 26, 26, W - 26, H - 22, IRON_DK, radius=14, ink_w=6)
    draw_beveled_rect(d, 40, H - 72, W - 40, H - 34, STEEL, radius=8, ink_w=4)
    for gx in range(56, W - 48, 18):
        d.line([(gx, H - 66), (gx, H - 40)], fill=IRON_DK, width=4)

    # Main riveted copper-and-brass twin boiler chassis
    draw_beveled_rect(d, 34, 34, W - 34, H - 72, COPPER, radius=16, ink_w=6)
    draw_beveled_rect(d, 48, 44, W - 48, H - 82, BRASS, radius=12, ink_w=4)
    # Twin vertical domed pressure boilers with brass crown eagle caps!
    for bx in [int(W * 0.34), int(W * 0.66)]:
        draw_disc(d, bx, 96, 40, COPPER, ink_w=5)
        draw_disc(d, bx, 96, 29, BRASS, ink_w=3)
        draw_disc(d, bx, 96, 13, BRASS_HI, ink_w=3)
    # Central round steam pressure dial & two curved brass portafilter brew handles!
    draw_disc(d, W / 2, 134, 18, BRASS_DK, ink_w=4)
    draw_disc(d, W / 2, 134, 12, CREAM, ink_w=2)
    d.line([(W / 2, 134), (W / 2 + 8, 126)], fill=CRIMSON, width=3)
    for hx in [int(W * 0.34), int(W * 0.66)]:
        draw_beveled_rect(d, hx - 8, H - 76, hx + 8, H - 24, WALNUT, radius=6, ink_w=4)
    # Tiny steaming porcelain espresso cup resting on right drip grate
    draw_disc(d, W - 70, H - 52, 14, CREAM, ink_w=3)
    draw_disc(d, W - 70, H - 52, 8, COFFEE, ink_w=2)
    return finish_prop(im, w, h, seed=7302)


# =============================================================================
# 3. CURVED GLASS & BRASS BERLINER PASTRY SHOWCASE DOME (160x112)
# =============================================================================
def gen_rot_pastry_glass_dome_case() -> Image.Image:
    w, h = 160, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Polished walnut & brass counter base tray
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, WALNUT, radius=14, ink_w=6)
    draw_beveled_rect(d, 34, 36, W - 34, H - 36, CREAM, radius=10, ink_w=4)

    # Crisp golden Berliner Pfannkuchen doughnuts (powdered sugar tops + jam dab!) & twisted pretzels!
    for px, py in [(86, 86), (138, 86), (112, 134)]:
        draw_disc(d, px, py, 24, PASTRY, ink_w=4)
        draw_disc(d, px, py, 14, CREAM, ink_w=1)
        draw_disc(d, px + 3, py - 2, 5, CRIMSON, ink_w=1)
    # Two golden-brown salted Laugenbrezel pretzels on right platter!
    for px, py in [(208, 92), (236, 138)]:
        d.ellipse([px - 24, py - 18, px + 24, py + 18], outline=INK, width=13)
        d.ellipse([px - 24, py - 18, px + 24, py + 18], outline=PASTRY_DK, width=8)
        d.line([(px - 18, py - 8), (px + 18, py + 10)], fill=PASTRY, width=6)
        d.line([(px - 18, py + 10), (px + 18, py - 8)], fill=PASTRY, width=6)
        for sx, sy in [(-10, -14), (10, -12), (0, 14)]:
            d.ellipse([px + sx - 3, py + sy - 3, px + sx + 3, py + sy + 3], fill=CREAM)

    # Translucent arched glass sneeze-guard dome overlay + bright specular glare bands + brass frame ribs
    glass_l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass_l, "RGBA")
    gd.rounded_rectangle([32, 34, W - 32, H - 34], radius=12, fill=(192, 228, 236, 62), outline=(*BRASS, 255), width=6)
    gd.line([(56, 46), (128, H - 46)], fill=(252, 254, 255, 130), width=10)
    gd.line([(162, 46), (212, H - 46)], fill=(252, 254, 255, 95), width=6)
    im.alpha_composite(glass_l)
    return finish_prop(im, w, h, seed=7303)


# =============================================================================
# 4. BRASS TRAM-TICKET ROLL RACK, HAND-PUNCH & FARE TRAY (144x112)
# =============================================================================
def gen_rot_ticket_punch_dispenser() -> Image.Image:
    w, h = 144, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Compact oak & brass ticket clerk's counter block
    draw_beveled_rect(d, 20, 24, W - 20, H - 24, WALNUT, radius=10, ink_w=5)
    draw_beveled_rect(d, 30, 34, W - 30, H - 34, OAK, radius=6, ink_w=3)
    # 4 color-coded paper tram ticket rolls (1st class Prussian, commuter ochre, single crimson, transfer sage)
    for idx, (rx, col) in enumerate([(44, PRUSSIAN), (84, OCHRE), (124, CRIMSON), (164, VERDIGRIS)]):
        draw_beveled_rect(d, rx, 44, rx + 30, 120, col, radius=6, ink_w=3)
        d.line([(rx + 5, 62), (rx + 25, 62)], fill=CREAM, width=3)
        d.line([(rx + 5, 98), (rx + 25, 98)], fill=INK_MID, width=2)
    # Brass coin fare dish & conductor's steel ticket punch on right side
    draw_disc(d, W - 64, 82, 26, BRASS, ink_w=4)
    draw_disc(d, W - 64, 82, 18, BRASS_DK, ink_w=2)
    for cx, cy in [(-6, -4), (6, 4), (-2, 8)]:
        draw_disc(d, W - 64 + cx, 82 + cy, 6, BRASS_HI, ink_w=1)
    # Conductor's nickel-steel ticket nippers + ink stamp pad along front edge
    draw_beveled_rect(d, 44, H - 84, 152, H - 46, PRUSSIAN, radius=6, ink_w=3)
    d.line([(166, H - 72), (W - 44, H - 48)], fill=INK, width=10)
    d.line([(166, H - 72), (W - 44, H - 48)], fill=STEEL, width=5)
    return finish_prop(im, w, h, seed=7304)


# =============================================================================
# 5. ROUND VIENNESE MARBLE CAFÉ BISTRO TABLE & 2 BENTWOOD CHAIRS (192x192)
# =============================================================================
def gen_rot_marble_bistro_table_set() -> Image.Image:
    w, h = 192, 192
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy = W / 2.0, H / 2.0

    # Two classic Thonet curved bentwood café chairs tucked on left & right of table!
    for side in (-1, +1):
        chx = cx + side * 114
        # Curved backrest arc
        d.arc([chx - 44, cy - 52, chx + 44, cy + 52],
              300 if side > 0 else 120,
              60 if side > 0 else 240,
              fill=INK, width=20)
        d.arc([chx - 44, cy - 52, chx + 44, cy + 52],
              300 if side > 0 else 120,
              60 if side > 0 else 240,
              fill=MAHOGANY, width=12)
        draw_disc(d, chx - side * 8, cy, 40, OAK, ink_w=5)
        draw_disc(d, chx - side * 8, cy, 29, PINE, ink_w=3)

    # Brass-rimmed circular white-marble café tabletop with subtle stone veining!
    draw_disc(d, cx, cy, 88, BRASS, ink_w=6)
    draw_disc(d, cx, cy, 78, MARBLE, ink_w=4)
    d.line([(cx - 48, cy - 24), (cx - 4, cy + 8), (cx + 42, cy + 36)], fill=MARBLE_VEIN, width=3)
    d.line([(cx - 16, cy - 52), (cx + 28, cy - 10)], fill=MARBLE_VEIN, width=2)

    # Two porcelain espresso cups & saucers, pastry cake plate & folded morning newspaper!
    for ex, ey in [(cx - 32, cy - 18), (cx + 32, cy + 16)]:
        draw_disc(d, ex, ey, 20, CREAM, ink_w=3)
        draw_disc(d, ex, ey, 12, PAPER, ink_w=2)
        draw_disc(d, ex, ey, 8, COFFEE, ink_w=1)
    # Small dessert plate with cake wedge & brass sugar bowl
    draw_disc(d, cx + 22, cy - 30, 18, CREAM, ink_w=3)
    d.polygon([(cx + 12, cy - 36), (cx + 34, cy - 30), (cx + 18, cy - 18)], fill=(*PASTRY, 255), outline=INK)
    draw_disc(d, cx - 22, cy + 30, 14, BRASS_HI, ink_w=3)
    return finish_prop(im, w, h, seed=7305)


# =============================================================================
# 6. BRASS-FRAMED MECHANICAL FLIP-FLAP TRAM TIMETABLE BOARD (224x96)
# =============================================================================
def gen_rot_tram_timetable_board() -> Image.Image:
    w, h = 224, 96
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Heavy riveted walnut & brass architectural schedule board
    draw_beveled_rect(d, 18, 22, W - 18, H - 22, WALNUT, radius=10, ink_w=6)
    draw_beveled_rect(d, 30, 32, W - 30, H - 32, BRASS, radius=6, ink_w=4)
    draw_beveled_rect(d, 40, 42, W - 40, H - 42, IRON_DK, radius=4, ink_w=4)

    # Circular station clock dial embedded on left end!
    draw_disc(d, 82, H // 2, 30, BRASS_HI, ink_w=4)
    draw_disc(d, 82, H // 2, 22, CREAM, ink_w=2)
    d.line([(82, H // 2), (82, H // 2 - 15)], fill=INK, width=4)
    d.line([(82, H // 2), (94, H // 2 + 4)], fill=INK, width=3)

    # Mechanical split-flap departure timetable strips (amber time tiles + cream destination slats)
    for row_y in [58, 92, 126]:
        draw_beveled_rect(d, 128, row_y, 184, row_y + 24, OCHRE, radius=3, ink_w=2)
        draw_beveled_rect(d, 194, row_y, W - 118, row_y + 24, (52, 58, 66), radius=3, ink_w=2)
        d.line([(204, row_y + 12), (W - 130, row_y + 12)], fill=CREAM, width=4)
        draw_beveled_rect(d, W - 108, row_y, W - 54, row_y + 24, VERDIGRIS if row_y == 58 else PRUSSIAN, radius=3, ink_w=2)
    return finish_prop(im, w, h, seed=7306)


# =============================================================================
# 7. WROUGHT-IRON SIDEWALK NEWSPAPER & BROADSHEET KIOSK RACK (176x112)
# =============================================================================
def gen_rot_street_newsstand_rack() -> Image.Image:
    w, h = 176, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Dark wrought-iron A-frame stand with sloped wooden newspaper display shelves
    draw_beveled_rect(d, 22, 24, W - 22, H - 24, IRON_DK, radius=10, ink_w=6)
    draw_beveled_rect(d, 34, 34, W - 34, H - 34, WALNUT, radius=6, ink_w=4)
    # 3 columns of stacked Berlin broadsheets, illustrated weeklies & transit pocket guides!
    stacks = [
        (44, 44, 128, H - 44, PAPER, CRIMSON),
        (138, 44, 218, H - 44, CREAM, PRUSSIAN),
        (228, 44, W - 44, H - 44, (226, 212, 182), FOREST),
    ]
    for x0, y0, x1, y1, bg, hdr in stacks:
        draw_beveled_rect(d, x0, y0, x1, y1, bg, radius=4, ink_w=3)
        d.rectangle([x0 + 8, y0 + 10, x1 - 8, y0 + 26], fill=(*hdr, 255), outline=INK_MID, width=2)
        for ly in range(y0 + 38, y1 - 14, 14):
            d.line([(x0 + 10, ly), (x1 - 10, ly)], fill=(102, 92, 80, 200), width=3)
    # Brass retaining bars holding papers against the wind
    for by in [H // 2 - 14, H - 52]:
        d.line([(34, by), (W - 34, by)], fill=BRASS_HI, width=5)
    return finish_prop(im, w, h, seed=7307)


# =============================================================================
# 8. FOREST-GREEN & CREAM SCALLOPED BERLIN PAVILION AWNING (240x96)
# =============================================================================
def gen_rot_pavilion_striped_awning() -> Image.Image:
    w, h = 240, 96
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Iron wall mounting valance beam along top edge
    draw_beveled_rect(d, 20, 20, W - 20, 40, IRON_DK, radius=5, ink_w=4)
    # 11 crisp alternating forest-green & antique-cream canvas canopy stripes with scalloped hem!
    n = 11
    x0, x1 = 24, W - 24
    sw = (x1 - x0) / n
    for i in range(n):
        sx0 = int(x0 + i * sw)
        sx1 = int(x0 + (i + 1) * sw)
        col = FOREST if i % 2 == 0 else CREAM
        dk = blend_rgb(col, (20, 18, 16), 0.30)
        d.rectangle([sx0, 38, sx1, H - 38], fill=(*col, 255), outline=INK, width=3)
        # Scalloped valance semicircle hanging along bottom front edge
        d.pieslice([sx0, H - 56, sx1, H - 20], 0, 180, fill=dk, outline=INK, width=3)
    # Horizontal gilded brass trim pipe + central ornamental brass medallion
    draw_beveled_rect(d, 24, H - 48, W - 24, H - 36, BRASS, radius=4, ink_w=3)
    draw_disc(d, W / 2, H * 0.52, 16, BRASS, ink_w=4)
    draw_disc(d, W / 2, H * 0.52, 8, FOREST_HI, ink_w=2)
    return finish_prop(im, w, h, seed=7308)


# =============================================================================
# 9. CURVED TUFTED VELVET COFFEEHOUSE BANQUETTE (256x128, dd_red COLORABLE!)
# =============================================================================
def gen_rot_curved_velvet_banquette_colorable() -> Image.Image:
    """Colorable dd_red semicircular coffeehouse banquette hugging curved rotunda walls!"""
    w, h = 256, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy = W / 2.0, H * 1.48
    r_in, r_out = H * 0.72, H * 1.34

    # Curved carved mahogany outer backrest frame
    frame = draw_curved_band_poly(cx, cy, r_in, r_out, 224, 316, 36)
    d.polygon(frame, fill=(*MAHOGANY, 255), outline=INK)
    d.line(frame + [frame[0]], fill=INK, width=7)

    # Curved deep-tufted dd_red velvet backrest bolster (outer band)
    back = draw_curved_band_poly(cx, cy, r_out - 46, r_out - 14, 228, 312, 32)
    d.polygon(back, fill=(*DD_RED_DEEP, 255), outline=INK)
    d.line(back + [back[0]], fill=INK, width=4)

    # Curved dd_red upholstered seat cushions (inner wide band) with crisp seam tufts!
    seat = draw_curved_band_poly(cx, cy, r_in + 12, r_out - 44, 227, 313, 32)
    d.polygon(seat, fill=(*DD_RED_BASE, 255), outline=INK)
    d.line(seat + [seat[0]], fill=INK, width=5)

    # Radial seat cushion divisions & brass button tufts!
    for a_deg in [248, 270, 292]:
        a = math.radians(a_deg)
        p0 = (cx + math.cos(a) * (r_in + 14), cy + math.sin(a) * (r_in + 14))
        p1 = (cx + math.cos(a) * (r_out - 46), cy + math.sin(a) * (r_out - 46))
        d.line([p0, p1], fill=DD_RED_DEEP, width=6)
    for a_deg in [238, 259, 281, 302]:
        a = math.radians(a_deg)
        bx = cx + math.cos(a) * (r_out - 30)
        by = cy + math.sin(a) * (r_out - 30)
        draw_disc(d, bx, by, 7, DD_RED_HI, ink_w=2)

    return finish_prop(im, w, h, seed=7309)


# =============================================================================
# 10. VIENNESE OAK NEWSPAPER-STICK RACK — ZEITUNGSHALTER (160x112)
# =============================================================================
def gen_rot_newspaper_stick_rack() -> Image.Image:
    w, h = 160, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Curved oak & brass coffeehouse floor rack frame
    draw_beveled_rect(d, 22, 26, W - 22, H - 26, WALNUT, radius=12, ink_w=6)
    draw_beveled_rect(d, 36, 38, W - 36, H - 38, (64, 42, 30), radius=8, ink_w=4)
    # 4 slotted bamboo/oak newspaper reading sticks clamping crisp folded Berlin gazettes!
    for idx, sy in enumerate([52, 88, 124, 160]):
        if sy + 24 < H - 30:
            draw_beveled_rect(d, 46, sy, W - 46, sy + 24, PAPER if idx % 2 == 0 else CREAM, radius=4, ink_w=3)
            d.line([(64, sy + 12), (W - 64, sy + 12)], fill=(116, 104, 88, 200), width=3)
            # Bamboo dowel rod with brass end rings protruding on left & right!
            draw_beveled_rect(d, 30, sy + 6, W - 30, sy + 18, OAK, radius=4, ink_w=3)
            draw_disc(d, 36, sy + 12, 6, BRASS_HI, ink_w=2)
            draw_disc(d, W - 36, sy + 12, 6, BRASS_HI, ink_w=2)
    return finish_prop(im, w, h, seed=7310)


# =============================================================================
# 11. CIRCULAR BRASS & CYAN-AETHER TRAMWAY SWITCHBOARD CONSOLE (240x240)
# =============================================================================
def gen_rot_aether_tram_switchboard() -> Image.Image:
    w, h = 240, 240
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size
    cx, cy = W / 2.0, H / 2.0

    # Heavy riveted iron & mahogany octagonal-circular control ring desk
    draw_disc(d, cx, cy, 206, IRON_DK, ink_w=7)
    draw_disc(d, cx, cy, 192, WALNUT, ink_w=5)
    draw_disc(d, cx, cy, 168, BRASS, ink_w=5)
    draw_disc(d, cx, cy, 152, IRON, ink_w=4)

    # Central illuminated deep-cyan aether glass track telemetry screen!
    draw_disc(d, cx, cy, 118, AETHER_DEEP, ink_w=5)
    # Soft cyan luminescence bloom inside screen
    gl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl, "RGBA")
    gd.ellipse([cx - 104, cy - 104, cx + 104, cy + 104], fill=(*AETHER_CYAN, 78))
    im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(14.0)))
    d = ImageDraw.Draw(im, "RGBA")

    # Illuminated diagonal twin Eisenbahnstraße tram lines + crossroads & live Tram #14 blip!
    d.line([(cx - 82, cy + 72), (cx + 72, cy - 82)], fill=AETHER_CYAN, width=6)
    d.line([(cx - 68, cy + 86), (cx + 86, cy - 68)], fill=AETHER_CYAN, width=6)
    d.line([(cx - 72, cy - 68), (cx + 68, cy + 72)], fill=(120, 194, 214, 200), width=4)
    # Glowing amber station beacons & bright Tram #14 live tracking marker!
    for bx, by, col in [
        (cx - 44, cy + 44, AMBER_GLOW),
        (cx + 46, cy - 46, AMBER_GLOW),
        (cx + 12, cy - 10, (255, 250, 210)),
    ]:
        draw_disc(d, bx, by, 10, col, ink_w=2)

    # Radial brass signal levers, rotary dials & crimson emergency switch knobs around outer console ring!
    for k in range(8):
        a = k * math.tau / 8.0 + 0.25
        lx = cx + math.cos(a) * 144
        ly = cy + math.sin(a) * 144
        if k % 2 == 0:
            # Slotted track switch lever box
            draw_disc(d, lx, ly, 16, IRON_DK, ink_w=3)
            draw_disc(d, lx + math.cos(a) * 5, ly + math.sin(a) * 5, 8, CRIMSON if k == 0 else BRASS_HI, ink_w=2)
        else:
            # Illuminated round pressure/voltage dial
            draw_disc(d, lx, ly, 15, BRASS, ink_w=3)
            draw_disc(d, lx, ly, 9, CREAM, ink_w=2)
            d.line([(lx, ly), (lx + 6, ly - 5)], fill=INK, width=2)

    return finish_prop(im, w, h, seed=7311)


# =============================================================================
# 12. RIVETED BRASS PNEUMATIC DISPATCH TUBE MANIFOLD (224x112)
# =============================================================================
def gen_rot_pneumatic_tube_manifold() -> Image.Image:
    w, h = 224, 112
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    W, H = im.size

    # Dark riveted cast-iron wall cabinet housing
    draw_beveled_rect(d, 20, 22, W - 20, H - 22, IRON_DK, radius=12, ink_w=6)
    draw_beveled_rect(d, 34, 34, W - 34, H - 34, IRON, radius=8, ink_w=4)
    # Horizontal pressurized copper header pipe running along the back
    draw_beveled_rect(d, 30, 42, W - 30, 72, COPPER, radius=12, ink_w=5)
    # 5 vertical brass pneumatic dispatch tube nozzles with leather canister ports & pressure gauges!
    for idx, tx in enumerate([74, 146, 224, 302, 374]):
        draw_beveled_rect(d, tx - 18, 34, tx + 18, H - 34, BRASS, radius=8, ink_w=4)
        draw_disc(d, tx, H - 64, 16, IRON_DK, ink_w=3)
        # Alternating open hollow tube vs loaded brass-and-leather dispatch capsule!
        if idx in (1, 3):
            draw_disc(d, tx, H - 64, 11, (148, 86, 48), ink_w=2)
            draw_disc(d, tx, H - 64, 5, BRASS_HI, ink_w=1)
        else:
            draw_disc(d, tx, H - 64, 10, (22, 24, 28), ink_w=2)
        # Round glass pressure gauge above each nozzle
        draw_disc(d, tx, 56, 13, BRASS_HI, ink_w=3)
        draw_disc(d, tx, 56, 8, CREAM, ink_w=1)
        d.line([(tx, 56), (tx + (5 if idx % 2 == 0 else -5), 51)], fill=CRIMSON, width=2)
    return finish_prop(im, w, h, seed=7312)


def main() -> None:
    specs = [
        ("rot_curved_espresso_ticket_bar.png", "Curved Mahogany & Brass Rotunda Ticket Bar", "normal",
         ["tram_rotunda", "cafe", "station", "bar", "counter", "brass", "berlin", "hero", "harmony"], gen_rot_curved_espresso_ticket_bar),
        ("rot_brass_espresso_machine.png", "Twin-Boiler Brass Magipunk Steam-Espresso Machine", "normal",
         ["tram_rotunda", "cafe", "coffee", "espresso", "brass", "copper", "magipunk", "harmony"], gen_rot_brass_espresso_machine),
        ("rot_pastry_glass_dome_case.png", "Curved Glass Berliner Pastry & Pretzel Showcase", "normal",
         ["tram_rotunda", "cafe", "bakery", "pastry", "food", "glass", "harmony"], gen_rot_pastry_glass_dome_case),
        ("rot_ticket_punch_dispenser.png", "Brass Tram-Ticket Roll Rack & Fare Tray", "normal",
         ["tram_rotunda", "station", "tram", "ticket", "office", "brass", "harmony"], gen_rot_ticket_punch_dispenser),
        ("rot_marble_bistro_table_set.png", "Viennese Marble Bistro Table & Bentwood Chairs", "normal",
         ["tram_rotunda", "cafe", "table", "chairs", "bistro", "coffee", "harmony"], gen_rot_marble_bistro_table_set),
        ("rot_tram_timetable_board.png", "Mechanical Brass Tram Departure Timetable Board", "normal",
         ["tram_rotunda", "station", "tram", "sign", "clock", "berlin", "harmony"], gen_rot_tram_timetable_board),
        ("rot_street_newsstand_rack.png", "Wrought-Iron Sidewalk Newspaper Kiosk Rack", "normal",
         ["tram_rotunda", "street", "station", "newspaper", "kiosk", "sidewalk", "harmony"], gen_rot_street_newsstand_rack),
        ("rot_pavilion_striped_awning.png", "Forest-Green & Cream Berlin Pavilion Awning", "normal",
         ["tram_rotunda", "cafe", "awning", "facade", "street", "harmony"], gen_rot_pavilion_striped_awning),
        ("rot_curved_velvet_banquette_colorable.png", "Curved Tufted Velvet Coffeehouse Banquette (Colorable)", "dd_red",
         ["tram_rotunda", "cafe", "sofa", "banquette", "seating", "colorable", "dd_red", "harmony"], gen_rot_curved_velvet_banquette_colorable),
        ("rot_newspaper_stick_rack.png", "Viennese Oak Zeitungshalter Newspaper-Stick Rack", "normal",
         ["tram_rotunda", "cafe", "newspaper", "library", "reading", "harmony"], gen_rot_newspaper_stick_rack),
        ("rot_aether_tram_switchboard.png", "Circular Brass & Cyan-Aether Tram Switchboard Console", "normal",
         ["tram_rotunda", "station", "tram", "magipunk", "console", "aether", "hero", "harmony"], gen_rot_aether_tram_switchboard),
        ("rot_pneumatic_tube_manifold.png", "Riveted Brass Pneumatic Dispatch Tube Manifold", "normal",
         ["tram_rotunda", "station", "magipunk", "pneumatic", "post", "brass", "harmony"], gen_rot_pneumatic_tube_manifold),
    ]

    qa_items: list[tuple[str, Image.Image]] = []
    manifest_entries: list[dict] = []

    for idx, (fname, display_name, draw_mode, tags, fn) in enumerate(specs, 1):
        im = fn()
        rel_path = f"props/tram_rotunda/{fname}"
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
    qa_path = SCRATCH_DIR / "qa_tram_rotunda_suite.png"
    save_qa_sheet(qa_items, qa_path, cols=4)
    print(f"\nGenerated {len(specs)} Tram Rotunda Harmony assets (manifest total={total}) -> {qa_path}")


if __name__ == "__main__":
    main()

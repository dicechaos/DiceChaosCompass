"""
Dice Chaos Maps — Comprehensive True Top-Down Painterly Lighting Fixture Suite

Upgrades 5 legacy side-elevation lighting assets in-place to true top-down AND
generates 85 brand-new unique top-down painterly lighting fixtures in
`public/assets/modular-suite-cc0/props/harmony_lighting/` across all 6 mount types:
  1. Floor-Standing Lamps, Cathedral Candelabras & Torchieres (16)
  2. Wall-Mounted Sconces & Exterior Brackets (16)
  3. Ceiling Chandeliers & Hanging Pendants (16)
  4. Tabletop, Desk & Bedside Lamps (16)
  5. Braziers, Fire-Bowls & Portable Lanterns (10)
  6. Exterior Street, Park, Courtyard & Gate Lights (11)

All rendered 2x-supersampled in our unified hand-inked gouache style:
  - 100% opaque fixture interiors (zero Pillow RGBA alpha-replace punch-throughs)
  - Luminous multi-stage glows strictly composited via `add_glow()`
  - Clean soft contact shadows strictly via `add_contact_shadow()`
  - Crisp dark-checkerboard QA sheets written to scratch/ for visual inspection!
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
    blend_rgb,
    shade_rgb,
    vary_rgb,
    save_qa_sheet,
    upsert_manifest_entries,
    dominant_hex,
)

OUT_DIR = MOD_DIR / "props" / "harmony_lighting"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Material palettes (RGB tuples — always pass alpha=255 for direct RGBA draws)
BRASS = (198, 156, 74)
BRASS_GOLD = (224, 182, 86)
BRASS_AGED = (158, 124, 66)
BRONZE = (138, 102, 62)
COPPER = (188, 114, 72)
IRON = (66, 72, 82)
IRON_DARK = (46, 50, 58)
OBSIDIAN = (38, 34, 48)
SILVER = (196, 204, 214)
STONE = (138, 134, 128)
MARBLE = (212, 206, 196)
WALNUT = (104, 68, 44)
OAK = (146, 102, 62)

# Glow palettes
GLOW_WARM = (255, 192, 92)
GLOW_CANDLE = (255, 178, 72)
GLOW_FIRE = (255, 132, 46)
GLOW_CYAN = (72, 218, 255)
GLOW_VIOLET = (176, 98, 255)
GLOW_EMERALD = (74, 224, 148)
GLOW_CREAM = (255, 226, 162)
GLOW_CRIMSON = (232, 76, 84)


# =============================================================================
# SHARED PAINTERLY LIGHTING PRIMITIVES (2x SUPERSAMPLED COORDINATES)
# =============================================================================
def poly_regular(cx: float, cy: float, r: float, sides: int, rot: float = 0.0) -> list[tuple[float, float]]:
    return [
        (cx + math.cos(rot + i * math.tau / sides) * r, cy + math.sin(rot + i * math.tau / sides) * r)
        for i in range(sides)
    ]


def draw_metal_disc(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    rgb: tuple[int, int, int],
    ink_w: int = 5,
    ring_detail: bool = True,
) -> None:
    """Rich sculpted metallic circular plate/base with top-left highlight & dark bevel."""
    dk = blend_rgb(rgb, (18, 14, 12), 0.45)
    hi = blend_rgb(rgb, (255, 246, 220), 0.45)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=dk, outline=INK, width=ink_w)
    r2 = r * 0.88
    d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], fill=(*rgb, 255))
    # Top-left directional metallic sheen arc
    if r >= 14:
        r3 = r * 0.72
        d.arc([cx - r3, cy - r3, cx + r3, cy + r3], start=195, end=315, fill=hi, width=max(3, int(r * 0.14)))
    if ring_detail and r >= 22:
        r_in = r * 0.56
        d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], outline=dk, width=3)


def draw_metal_poly(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    sides: int,
    rgb: tuple[int, int, int],
    rot: float = 0.0,
    ink_w: int = 5,
) -> None:
    dk = blend_rgb(rgb, (18, 14, 12), 0.44)
    hi = blend_rgb(rgb, (255, 246, 220), 0.36)
    pts = poly_regular(cx, cy, r, sides, rot)
    d.polygon(pts, fill=dk, outline=INK)
    d.line(pts + [pts[0]], fill=INK, width=ink_w)
    pts2 = poly_regular(cx, cy, r * 0.85, sides, rot)
    d.polygon(pts2, fill=(*rgb, 255))
    # Highlight top-left edges
    for i in range(len(pts2)):
        p0, p1 = pts2[i], pts2[(i + 1) % len(pts2)]
        mx, my = (p0[0] + p1[0]) * 0.5 - cx, (p0[1] + p1[1]) * 0.5 - cy
        if mx + my < 0:
            d.line([p0, p1], fill=hi, width=3)


def draw_candle_top(
    im: Image.Image,
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    wax_rgb: tuple[int, int, int] = (242, 232, 206),
    flame_rgb: tuple[int, int, int] = GLOW_CANDLE,
    cup_rgb: tuple[int, int, int] | None = BRASS,
    glow_scale: float = 1.0,
) -> None:
    """True top-down lit candle: optional brass bobeche cup, wax cylinder top, molten pool, bright wick flame."""
    if glow_scale > 0:
        add_glow(im, cx, cy, r * 2.4 * glow_scale, r * 2.4 * glow_scale, flame_rgb, alpha=88, blur=max(6.0, r * 0.9))
        d = ImageDraw.Draw(im)
    if cup_rgb is not None:
        draw_metal_disc(d, cx, cy, r * 1.48, cup_rgb, ink_w=max(3, int(r * 0.25)), ring_detail=False)
    wax_dk = blend_rgb(wax_rgb, (150, 124, 88), 0.38)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=wax_dk, outline=INK, width=max(3, int(r * 0.22)))
    d.ellipse([cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82], fill=(*wax_rgb, 255))
    # Inner warm molten wax pool
    pool = blend_rgb(wax_rgb, flame_rgb, 0.55)
    d.ellipse([cx - r * 0.52, cy - r * 0.52, cx + r * 0.52, cy + r * 0.52], fill=pool)
    # Bright flame core + incandescent white center
    fr = max(3.5, r * 0.42)
    d.ellipse([cx - fr, cy - fr, cx + fr, cy + fr], fill=(*flame_rgb, 255))
    cr = max(2.0, r * 0.22)
    d.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 252, 232, 255))


def draw_pleated_shade(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    shade_rgb: tuple[int, int, int],
    trim_rgb: tuple[int, int, int],
    n_pleats: int = 16,
    scalloped: bool = False,
    finial_rgb: tuple[int, int, int] = BRASS_GOLD,
) -> None:
    """True top-down pleated or scalloped fabric lampshade with inner warm glow & brass top finial."""
    dk = blend_rgb(shade_rgb, (26, 18, 16), 0.42)
    mid = shade_rgb
    hi = blend_rgb(shade_rgb, (255, 244, 212), 0.36)
    warm_core = blend_rgb(shade_rgb, (255, 232, 166), 0.52)

    if scalloped:
        pts = []
        steps = n_pleats * 4
        for i in range(steps):
            ang = i * math.tau / steps
            wave = 1.0 + 0.045 * math.cos(i * math.tau / 4)
            pts.append((cx + math.cos(ang) * r * wave, cy + math.sin(ang) * r * wave))
        d.polygon(pts, fill=(*mid, 255), outline=INK)
        d.line(pts + [pts[0]], fill=INK, width=6)
    else:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*mid, 255), outline=INK, width=6)

    # Outer braid / fringe ring
    r_trim = r * 0.91
    d.ellipse([cx - r_trim, cy - r_trim, cx + r_trim, cy + r_trim], outline=(*trim_rgb, 255), width=5)

    # Inner radial shading (bright warm center radiating outward to shaded folds)
    d.ellipse([cx - r * 0.78, cy - r * 0.78, cx + r * 0.78, cy + r * 0.78], fill=blend_rgb(mid, warm_core[:3], 0.45))
    d.ellipse([cx - r * 0.46, cy - r * 0.46, cx + r * 0.46, cy + r * 0.46], fill=warm_core)

    # Radial pleats with alternating highlight & shadow lines
    for i in range(n_pleats):
        ang = i * math.tau / n_pleats
        x0, y0 = cx + math.cos(ang) * r * 0.22, cy + math.sin(ang) * r * 0.22
        x1, y1 = cx + math.cos(ang) * r * 0.89, cy + math.sin(ang) * r * 0.89
        d.line([(x0, y0), (x1, y1)], fill=dk, width=3)
        ang2 = ang + math.tau / (n_pleats * 2.6)
        hx0, hy0 = cx + math.cos(ang2) * r * 0.26, cy + math.sin(ang2) * r * 0.26
        hx1, hy1 = cx + math.cos(ang2) * r * 0.84, cy + math.sin(ang2) * r * 0.84
        d.line([(hx0, hy0), (hx1, hy1)], fill=hi, width=2)

    # Center metal harp collar & brass finial knob
    draw_metal_disc(d, cx, cy, r * 0.22, finial_rgb, ink_w=4, ring_detail=False)
    d.ellipse([cx - r * 0.08, cy - r * 0.08, cx + r * 0.08, cy + r * 0.08], fill=(255, 246, 214, 255))


def draw_stained_glass_dome(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    r: float,
    petals_rgb: list[tuple[int, int, int]],
    border_rgb: tuple[int, int, int],
    lead_rgb: tuple[int, int, int] = (34, 30, 32),
    n_seg: int = 12,
    cap_rgb: tuple[int, int, int] = BRONZE,
) -> None:
    """True top-down Tiffany / Art Nouveau leaded stained-glass lamp dome."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*lead_rgb, 255), outline=INK, width=6)
    # Outer glass border ring segments
    for i in range(n_seg):
        a0 = i * 360.0 / n_seg
        a1 = (i + 1) * 360.0 / n_seg
        c_outer = border_rgb if i % 2 == 0 else blend_rgb(border_rgb, (255, 232, 160), 0.3)[:3]
        d.pieslice([cx - r * 0.94, cy - r * 0.94, cx + r * 0.94, cy + r * 0.94], a0, a1, fill=(*c_outer, 255), outline=(*lead_rgb, 255), width=3)
    # Middle petal ring
    r_mid = r * 0.74
    for i in range(n_seg):
        a0 = i * 360.0 / n_seg
        a1 = (i + 1) * 360.0 / n_seg
        c_p = petals_rgb[i % len(petals_rgb)]
        d.pieslice([cx - r_mid, cy - r_mid, cx + r_mid, cy + r_mid], a0, a1, fill=(*c_p, 255), outline=(*lead_rgb, 255), width=3)
    # Inner sunlit glowing crown ring
    r_in = r * 0.45
    for i in range(n_seg):
        a0 = i * 360.0 / n_seg
        a1 = (i + 1) * 360.0 / n_seg
        c_p = blend_rgb(petals_rgb[(i + 1) % len(petals_rgb)], (255, 246, 200), 0.42)[:3]
        d.pieslice([cx - r_in, cy - r_in, cx + r_in, cy + r_in], a0, a1, fill=(*c_p, 255), outline=(*lead_rgb, 255), width=2)
    # Leadwork rings + bronze cap finial
    d.ellipse([cx - r * 0.94, cy - r * 0.94, cx + r * 0.94, cy + r * 0.94], outline=INK, width=5)
    d.ellipse([cx - r_mid, cy - r_mid, cx + r_mid, cy + r_mid], outline=(*lead_rgb, 255), width=4)
    draw_metal_disc(d, cx, cy, r * 0.24, cap_rgb, ink_w=4, ring_detail=True)


def draw_aether_orb(
    im: Image.Image,
    cx: float,
    cy: float,
    r: float,
    core_rgb: tuple[int, int, int],
    cage_rgb: tuple[int, int, int] = BRASS,
    n_ribs: int = 6,
    glow_r: float = 2.1,
) -> None:
    """Luminous magipunk glass-and-metal caged aether orb/bulb seen straight from above."""
    add_glow(im, cx, cy, r * glow_r, r * glow_r, core_rgb, alpha=138, blur=max(10.0, r * 0.7))
    d = ImageDraw.Draw(im)
    outer = blend_rgb(core_rgb, (16, 22, 34), 0.35)
    bright = blend_rgb(core_rgb, (255, 255, 255), 0.65)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=outer, outline=INK, width=5)
    d.ellipse([cx - r * 0.82, cy - r * 0.82, cx + r * 0.82, cy + r * 0.82], fill=(*core_rgb, 255))
    d.ellipse([cx - r * 0.56, cy - r * 0.56, cx + r * 0.56, cy + r * 0.56], fill=bright)
    d.ellipse([cx - r * 0.28, cy - r * 0.28, cx + r * 0.28, cy + r * 0.28], fill=(255, 255, 255, 255))
    # Specular crescent on glass
    d.arc([cx - r * 0.74, cy - r * 0.74, cx + r * 0.74, cy + r * 0.74], 200, 275, fill=(255, 255, 255, 255), width=4)
    # Radial brass/iron cage ribs
    if n_ribs > 0:
        for i in range(n_ribs):
            ang = i * math.tau / n_ribs
            x0, y0 = cx + math.cos(ang) * r * 0.22, cy + math.sin(ang) * r * 0.22
            x1, y1 = cx + math.cos(ang) * r * 1.04, cy + math.sin(ang) * r * 1.04
            d.line([(x0, y0), (x1, y1)], fill=INK, width=7)
            d.line([(x0, y0), (x1, y1)], fill=(*cage_rgb, 255), width=3)
        draw_metal_disc(d, cx, cy, r * 0.28, cage_rgb, ink_w=4, ring_detail=False)


def draw_sconce_backplate(
    d: ImageDraw.ImageDraw,
    cx: float,
    y_wall: float,
    pw: float,
    ph: float,
    plate_rgb: tuple[int, int, int],
    ornate: bool = True,
) -> None:
    """Flat wall-mounting backplate flush on the -Y wall edge so sconces snap cleanly to walls."""
    draw_beveled_rect(d, cx - pw / 2, y_wall, cx + pw / 2, y_wall + ph, plate_rgb, ink_w=5, radius=6)
    # Mounting rivets on left/right flanges
    hi = blend_rgb(plate_rgb, (255, 245, 215), 0.45)
    for sx in (-1, 1):
        rx = cx + sx * (pw * 0.35)
        ry = y_wall + ph * 0.5
        d.ellipse([rx - 5, ry - 5, rx + 5, ry + 5], fill=hi, outline=INK, width=2)
    if ornate:
        # Carved center bracket boss projecting slightly forward
        draw_beveled_rect(d, cx - pw * 0.16, y_wall + ph * 0.35, cx + pw * 0.16, y_wall + ph + 14, plate_rgb, ink_w=4, radius=5)


def draw_fire_bed(
    im: Image.Image,
    cx: float,
    cy: float,
    r: float,
    rng: random.Random,
    flame_outer: tuple[int, int, int] = (232, 76, 22),
    flame_mid: tuple[int, int, int] = (255, 162, 42),
    flame_core: tuple[int, int, int] = (255, 242, 168),
) -> None:
    """Painterly sculpted embers + layered flame tongues seen straight from above."""
    add_glow(im, cx, cy, r * 1.9, r * 1.9, flame_mid, alpha=130, blur=18.0)
    d = ImageDraw.Draw(im)
    # Dark char bed
    char = blend_rgb(flame_outer, (22, 14, 14), 0.72)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=char, outline=INK, width=4)
    # Glowing coal chunks
    for _ in range(28):
        ang = rng.uniform(0, math.tau)
        dist = rng.uniform(0.08, 0.82) * r
        cr = rng.uniform(r * 0.12, r * 0.24)
        ex, ey = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
        t = 1.0 - (dist / r)
        col = blend_rgb(flame_outer, flame_mid, t * 0.75) if rng.random() > 0.28 else (44, 34, 34, 255)
        d.ellipse([ex - cr, ey - cr * 0.82, ex + cr, ey + cr * 0.82], fill=col, outline=INK_MID, width=2)
    # Curled top-down flame tongues radiating slightly from center
    for i in range(9):
        ang = i * math.tau / 9 + rng.uniform(-0.2, 0.2)
        d_out = r * rng.uniform(0.56, 0.86)
        tip = (cx + math.cos(ang) * d_out, cy + math.sin(ang) * d_out)
        p_l = (cx + math.cos(ang - 0.45) * r * 0.34, cy + math.sin(ang - 0.45) * r * 0.34)
        p_r = (cx + math.cos(ang + 0.45) * r * 0.34, cy + math.sin(ang + 0.45) * r * 0.34)
        d.polygon([p_l, tip, p_r], fill=(*flame_outer, 255))
    for i in range(7):
        ang = i * math.tau / 7 + rng.uniform(-0.25, 0.25)
        d_mid = r * rng.uniform(0.36, 0.62)
        tip = (cx + math.cos(ang) * d_mid, cy + math.sin(ang) * d_mid)
        p_l = (cx + math.cos(ang - 0.5) * r * 0.22, cy + math.sin(ang - 0.5) * r * 0.22)
        p_r = (cx + math.cos(ang + 0.5) * r * 0.22, cy + math.sin(ang + 0.5) * r * 0.22)
        d.polygon([p_l, tip, p_r], fill=(*flame_mid, 255))
    d.ellipse([cx - r * 0.32, cy - r * 0.32, cx + r * 0.32, cy + r * 0.32], fill=(*flame_core, 255))
    d.ellipse([cx - r * 0.14, cy - r * 0.14, cx + r * 0.14, cy + r * 0.14], fill=(255, 255, 240, 255))


# =============================================================================
# CATEGORY 1: FLOOR-STANDING LAMPS & CANDELABRAS (192x192)
# =============================================================================
def gen_floor_candelabra(
    w: int, h: int, seed: int,
    metal_rgb: tuple[int, int, int],
    base_rgb: tuple[int, int, int],
    n_arms: int = 6,
    wax_rgb: tuple[int, int, int] = (242, 232, 206),
    flame_rgb: tuple[int, int, int] = GLOW_CANDLE,
    tripod: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    r_base = w * 0.62 if tripod else w * 0.56
    # Grounded floor drop shadow
    if tripod:
        def sh_fn(sd, col, off):
            ox, oy = off
            sd.ellipse([cx + ox - r_base * 0.9, cy + oy - r_base * 0.9, cx + ox + r_base * 0.9, cy + oy + r_base * 0.9], fill=col)
    else:
        def sh_fn(sd, col, off):
            ox, oy = off
            sd.ellipse([cx + ox - r_base * 1.06, cy + oy - r_base * 1.06, cx + ox + r_base * 1.06, cy + oy + r_base * 1.06], fill=col)
    add_contact_shadow(im, sh_fn, offset=(8, 10), blur=12.0, alpha=105)
    d = ImageDraw.Draw(im)

    # 1. Heavy floor base (clearly visible around/beneath candle crown!)
    if tripod:
        for i in range(3):
            ang = i * math.tau / 3 - math.pi / 2
            x1, y1 = cx + math.cos(ang) * r_base * 1.15, cy + math.sin(ang) * r_base * 1.15
            d.line([(cx, cy), (x1, y1)], fill=INK, width=22)
            d.line([(cx, cy), (x1, y1)], fill=(*base_rgb, 255), width=13)
            draw_metal_disc(d, x1, y1, 16, base_rgb, ink_w=4, ring_detail=False)
        draw_metal_disc(d, cx, cy, r_base * 0.54, base_rgb, ink_w=5)
    else:
        # Octagonal stepped stone/marble + brass floor plinth!
        draw_metal_poly(d, cx, cy, r_base * 1.04, 8, base_rgb, rot=math.pi / 8, ink_w=6)
        draw_metal_poly(d, cx, cy, r_base * 0.78, 8, metal_rgb, rot=math.pi / 8, ink_w=4)
        draw_metal_disc(d, cx, cy, r_base * 0.52, blend_rgb(metal_rgb, (255, 240, 200), 0.18)[:3], ink_w=4)

    # 2. Radial forged scroll arms extending from central column to outer candles
    r_arm = w * 0.52
    for i in range(n_arms):
        ang = i * math.tau / n_arms + (math.pi / n_arms if n_arms % 2 == 0 else -math.pi / 2)
        ax, ay = cx + math.cos(ang) * r_arm, cy + math.sin(ang) * r_arm
        d.line([(cx, cy), (ax, ay)], fill=INK, width=14)
        d.line([(cx, cy), (ax, ay)], fill=(*metal_rgb, 255), width=7)
        hi = blend_rgb(metal_rgb, (255, 246, 210), 0.45)
        d.line([(cx, cy), (ax, ay)], fill=hi, width=2)
    # Connecting wrought ring halfway out
    r_ring = r_arm * 0.58
    d.ellipse([cx - r_ring, cy - r_ring, cx + r_ring, cy + r_ring], outline=INK, width=10)
    d.ellipse([cx - r_ring, cy - r_ring, cx + r_ring, cy + r_ring], outline=(*metal_rgb, 255), width=4)

    # 3. Lit outer candles + taller center crown candle
    for i in range(n_arms):
        ang = i * math.tau / n_arms + (math.pi / n_arms if n_arms % 2 == 0 else -math.pi / 2)
        ax, ay = cx + math.cos(ang) * r_arm, cy + math.sin(ang) * r_arm
        draw_candle_top(im, d, ax, ay, 15.5, wax_rgb=wax_rgb, flame_rgb=flame_rgb, cup_rgb=metal_rgb, glow_scale=1.18)
        d = ImageDraw.Draw(im)
    draw_candle_top(im, d, cx, cy, 19.5, wax_rgb=wax_rgb, flame_rgb=flame_rgb, cup_rgb=metal_rgb, glow_scale=1.35)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


def gen_floor_shaded_lamp(
    w: int, h: int, seed: int,
    shade_rgb: tuple[int, int, int],
    trim_rgb: tuple[int, int, int],
    base_rgb: tuple[int, int, int],
    glow_rgb: tuple[int, int, int] = GLOW_WARM,
    style: str = "pleated",
    colorable: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    r_base = w * 0.64
    r_shade = w * 0.50

    def sh_fn(sd, col, off):
        ox, oy = off
        sd.ellipse([cx + ox - r_base, cy + oy - r_base, cx + ox + r_base, cy + oy + r_base], fill=col)
    add_contact_shadow(im, sh_fn, offset=(10, 12), blur=14.0, alpha=105)
    if not colorable:
        add_glow(im, cx, cy, w * 0.82, h * 0.82, glow_rgb, alpha=95, blur=22.0)
    d = ImageDraw.Draw(im)

    # Clearly visible wide floor pedestal base peeking all around the lampshade!
    draw_metal_disc(d, cx, cy, r_base, base_rgb, ink_w=6, ring_detail=True)
    # 4 delicate claw/scroll feet on base perimeter
    for i in range(4):
        ang = i * math.tau / 4 + math.pi / 4
        fx, fy = cx + math.cos(ang) * r_base * 0.92, cy + math.sin(ang) * r_base * 0.92
        draw_metal_disc(d, fx, fy, 11, blend_rgb(base_rgb, (255, 244, 210), 0.25)[:3], ink_w=3, ring_detail=False)

    # Soft cast shadow of elevated shade onto base
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - r_shade, cy + off[1] - r_shade, cx + off[0] + r_shade, cy + off[1] + r_shade], fill=col),
        offset=(5, 7), blur=7.0, alpha=82,
    )
    d = ImageDraw.Draw(im)

    if style == "pleated":
        draw_pleated_shade(d, cx, cy, r_shade, shade_rgb, trim_rgb, n_pleats=18, scalloped=False, finial_rgb=BRASS_GOLD)
    elif style == "fringed":
        draw_pleated_shade(d, cx, cy, r_shade * 1.04, shade_rgb, trim_rgb, n_pleats=14, scalloped=True, finial_rgb=BRASS_GOLD)
    elif style == "tiffany":
        draw_stained_glass_dome(
            d, cx, cy, r_shade * 1.04,
            petals_rgb=[(224, 166, 54), (72, 168, 126), (196, 86, 74), (86, 136, 198)],
            border_rgb=(218, 152, 52), cap_rgb=BRONZE,
        )
    elif style == "torchiere":
        # Frosted alabaster uplight bowl glowing warmly in center
        draw_metal_disc(d, cx, cy, r_shade * 0.98, BRASS, ink_w=5, ring_detail=False)
        d.ellipse([cx - r_shade * 0.86, cy - r_shade * 0.86, cx + r_shade * 0.86, cy + r_shade * 0.86], fill=(246, 232, 198, 255), outline=INK, width=4)
        d.ellipse([cx - r_shade * 0.64, cy - r_shade * 0.64, cx + r_shade * 0.64, cy + r_shade * 0.64], fill=(255, 242, 200, 255))
        d.ellipse([cx - r_shade * 0.36, cy - r_shade * 0.36, cx + r_shade * 0.36, cy + r_shade * 0.36], fill=(255, 252, 234, 255))
        # Curved Jugendstil brass rim clasps
        for i in range(4):
            ang = i * math.tau / 4
            bx, by = cx + math.cos(ang) * r_shade * 0.86, cy + math.sin(ang) * r_shade * 0.86
            draw_metal_disc(d, bx, by, 10, BRASS_GOLD, ink_w=3, ring_detail=False)
    elif style == "arc":
        # Articulated pharmacy/industrial arc floor lamp: base offset slightly + curved arm + angled conical hood!
        d.ellipse([cx - r_base, cy - r_base, cx + r_base, cy + r_base], fill=(0, 0, 0, 0))
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_floor_arc_or_reading(w: int, h: int, seed: int, industrial: bool = False) -> Image.Image:
    """True top-down offset arc/reading floor lamp: weighted circular base + arching arm + conical dome hood + warm pool."""
    im = new_hi(w, h)
    cx, cy = w, h
    bx, by = cx - 42, cy - 26
    hx, hy = cx + 36, cy + 26
    metal = IRON if industrial else BRASS
    hood = (56, 74, 82) if industrial else BRASS_AGED
    glow = GLOW_CREAM if industrial else GLOW_WARM

    add_contact_shadow(
        im,
        lambda sd, col, off: (
            sd.ellipse([bx + off[0] - 58, by + off[1] - 58, bx + off[0] + 58, by + off[1] + 58], fill=col),
            sd.ellipse([hx + off[0] - 48, hy + off[1] - 48, hx + off[0] + 48, hy + off[1] + 48], fill=col),
        ),
        offset=(8, 10), blur=12.0, alpha=98,
    )
    add_glow(im, hx + 12, hy + 10, 96, 96, glow, alpha=118, blur=20.0)
    d = ImageDraw.Draw(im)

    # Heavy circular floor base
    draw_metal_disc(d, bx, by, 56, metal, ink_w=6, ring_detail=True)
    # Arching tubular metal stem from base to hood
    d.line([(bx, by), (hx, hy)], fill=INK, width=20)
    d.line([(bx, by), (hx, hy)], fill=(*metal, 255), width=11)
    d.line([(bx, by - 2), (hx, hy - 2)], fill=blend_rgb(metal, (255, 248, 224), 0.45), width=3)
    # Joint bolt at midpoint
    mx, my = (bx + hx) * 0.5, (by + hy) * 0.5
    draw_metal_disc(d, mx, my, 12, BRASS_GOLD if not industrial else (120, 128, 138), ink_w=3, ring_detail=False)
    # Glowing light crescent spilling out front of hood
    d.ellipse([hx - 36, hy - 36, hx + 54, hy + 54], fill=(255, 242, 198, 255), outline=INK, width=3)
    # Conical metal shade hood seen from above
    draw_metal_disc(d, hx, hy, 44, hood, ink_w=5, ring_detail=True)
    draw_metal_disc(d, hx - 6, hy - 4, 15, BRASS_GOLD if not industrial else IRON_DARK, ink_w=3, ring_detail=False)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_floor_aether_standard(
    w: int, h: int, seed: int,
    base_rgb: tuple[int, int, int],
    cage_rgb: tuple[int, int, int],
    core_rgb: tuple[int, int, int],
    octagonal: bool = True,
    colorable: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    r_base = w * 0.62
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - r_base, cy + off[1] - r_base, cx + off[0] + r_base, cy + off[1] + r_base], fill=col),
        offset=(8, 10), blur=12.0, alpha=105,
    )
    d = ImageDraw.Draw(im)
    if octagonal:
        draw_metal_poly(d, cx, cy, r_base, 8, base_rgb, rot=math.pi / 8, ink_w=6)
        draw_metal_poly(d, cx, cy, r_base * 0.78, 8, cage_rgb, rot=math.pi / 8, ink_w=4)
    else:
        for i in range(3):
            ang = i * math.tau / 3 - math.pi / 2
            x1, y1 = cx + math.cos(ang) * r_base * 1.06, cy + math.sin(ang) * r_base * 1.06
            d.line([(cx, cy), (x1, y1)], fill=INK, width=22)
            d.line([(cx, cy), (x1, y1)], fill=(*base_rgb, 255), width=13)
            draw_metal_disc(d, x1, y1, 14, cage_rgb, ink_w=4, ring_detail=False)
        draw_metal_disc(d, cx, cy, r_base * 0.65, base_rgb, ink_w=5)
    # 4 projecting brass finial prongs around core
    for i in range(4):
        ang = i * math.tau / 4 + math.pi / 4
        px, py = cx + math.cos(ang) * (w * 0.44), cy + math.sin(ang) * (w * 0.44)
        d.line([(cx, cy), (px, py)], fill=INK, width=14)
        d.line([(cx, cy), (px, py)], fill=(*cage_rgb, 255), width=7)
        draw_metal_disc(d, px, py, 10, cage_rgb, ink_w=3, ring_detail=False)

    if colorable:
        # Pure dd_red crystal core (no conflicting glow color)
        d.ellipse([cx - 56, cy - 56, cx + 56, cy + 56], fill=(*DD_RED_DEEP, 255), outline=INK, width=5)
        d.ellipse([cx - 46, cy - 46, cx + 46, cy + 46], fill=(*DD_RED_BASE, 255))
        d.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], fill=(*DD_RED_HI, 255))
        for i in range(6):
            ang = i * math.tau / 6
            d.line([(cx + math.cos(ang) * 18, cy + math.sin(ang) * 18), (cx + math.cos(ang) * 58, cy + math.sin(ang) * 58)], fill=INK, width=6)
            d.line([(cx + math.cos(ang) * 18, cy + math.sin(ang) * 18), (cx + math.cos(ang) * 58, cy + math.sin(ang) * 58)], fill=(*cage_rgb, 255), width=3)
        draw_metal_disc(d, cx, cy, 16, cage_rgb, ink_w=3, ring_detail=False)
    else:
        draw_aether_orb(im, cx, cy, 52, core_rgb, cage_rgb=cage_rgb, n_ribs=6, glow_r=2.1)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_floor_votive_stand(w: int, h: int, seed: int) -> Image.Image:
    """Cathedral floor-standing circular tiered brass votive prayer stand (16 lit tapers on wrought-iron legs)."""
    im = new_hi(w, h)
    cx, cy = w, h
    r_base = w * 0.66
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - r_base, cy + off[1] - r_base, cx + off[0] + r_base, cy + off[1] + r_base], fill=col),
        offset=(8, 10), blur=12.0, alpha=100,
    )
    add_glow(im, cx, cy, w * 0.85, h * 0.85, GLOW_CANDLE, alpha=100, blur=20.0)
    d = ImageDraw.Draw(im)
    # 4 wrought-iron splayed legs peeking under circular brass tray
    for i in range(4):
        ang = i * math.tau / 4 + math.pi / 4
        lx, ly = cx + math.cos(ang) * (w * 0.72), cy + math.sin(ang) * (w * 0.72)
        d.line([(cx, cy), (lx, ly)], fill=INK, width=20)
        d.line([(cx, cy), (lx, ly)], fill=(*IRON, 255), width=11)
        draw_metal_disc(d, lx, ly, 12, IRON_DARK, ink_w=3, ring_detail=False)
    # Outer brass gallery tray + sand bed
    draw_metal_disc(d, cx, cy, r_base * 0.94, BRASS, ink_w=6, ring_detail=False)
    d.ellipse([cx - r_base * 0.82, cy - r_base * 0.82, cx + r_base * 0.82, cy + r_base * 0.82], fill=(82, 66, 48, 255), outline=INK, width=4)
    # Inner raised tier
    draw_metal_disc(d, cx, cy, r_base * 0.50, BRASS_GOLD, ink_w=4, ring_detail=False)
    # 10 outer ring candles + 5 inner ring + 1 center
    rng = random.Random(seed)
    for i in range(10):
        ang = i * math.tau / 10
        tx, ty = cx + math.cos(ang) * r_base * 0.67, cy + math.sin(ang) * r_base * 0.67
        draw_candle_top(im, d, tx, ty, 10.5 + rng.uniform(-1, 1.5), cup_rgb=BRASS_AGED, glow_scale=0.6)
        d = ImageDraw.Draw(im)
    for i in range(5):
        ang = i * math.tau / 5 + 0.3
        tx, ty = cx + math.cos(ang) * r_base * 0.30, cy + math.sin(ang) * r_base * 0.30
        draw_candle_top(im, d, tx, ty, 10.5, cup_rgb=BRASS_GOLD, glow_scale=0.65)
        d = ImageDraw.Draw(im)
    draw_candle_top(im, d, cx, cy, 13.0, cup_rgb=BRASS_GOLD, glow_scale=0.8)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


def gen_floor_paschal_pillar(w: int, h: int, seed: int) -> Image.Image:
    """Heavy cathedral brass altar Paschal candlestick with thick ceremonial banded white wax pillar."""
    im = new_hi(w, h)
    cx, cy = w, h
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - 96, cy + off[1] - 96, cx + off[0] + 96, cy + off[1] + 96], fill=col),
        offset=(8, 10), blur=12.0, alpha=105,
    )
    add_glow(im, cx, cy, 132, 132, GLOW_CANDLE, alpha=110, blur=20.0)
    d = ImageDraw.Draw(im)
    # Heavy 3-lion-paw marble & gilded brass floor base
    draw_metal_poly(d, cx, cy, 106, 6, MARBLE, rot=0, ink_w=6)
    draw_metal_poly(d, cx, cy, 86, 6, BRASS, rot=math.pi / 6, ink_w=5)
    draw_metal_disc(d, cx, cy, 66, BRASS_GOLD, ink_w=5, ring_detail=True)
    # Thick ceremonial Paschal wax pillar
    draw_candle_top(im, d, cx, cy, 38, wax_rgb=(248, 240, 218), flame_rgb=GLOW_WARM, cup_rgb=BRASS_GOLD, glow_scale=1.15)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


def gen_floor_iron_tripod_lantern(w: int, h: int, seed: int) -> Image.Image:
    """Rustic forged-iron tripod standing lantern pole for taverns, halls & camps."""
    im = new_hi(w, h)
    cx, cy = w, h
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - 102, cy + off[1] - 102, cx + off[0] + 102, cy + off[1] + 102], fill=col),
        offset=(9, 11), blur=12.0, alpha=105,
    )
    add_glow(im, cx, cy, 134, 134, GLOW_WARM, alpha=110, blur=20.0)
    d = ImageDraw.Draw(im)
    # 3 iron tripod legs
    for i in range(3):
        ang = i * math.tau / 3 - math.pi / 2
        lx, ly = cx + math.cos(ang) * 124, cy + math.sin(ang) * 124
        d.line([(cx, cy), (lx, ly)], fill=INK, width=22)
        d.line([(cx, cy), (lx, ly)], fill=(*IRON, 255), width=12)
        draw_metal_disc(d, lx, ly, 14, IRON_DARK, ink_w=4, ring_detail=False)
    # Hanging iron lantern cap right in center
    draw_metal_poly(d, cx, cy, 62, 6, GLOW_WARM, rot=0, ink_w=5)
    draw_metal_poly(d, cx, cy, 48, 6, (255, 232, 168), rot=0, ink_w=3)
    # Iron lantern roof ribs + top loop
    for i in range(6):
        ang = i * math.tau / 6
        d.line([(cx, cy), (cx + math.cos(ang) * 62, cy + math.sin(ang) * 62)], fill=INK, width=8)
        d.line([(cx, cy), (cx + math.cos(ang) * 62, cy + math.sin(ang) * 62)], fill=(*IRON, 255), width=4)
    draw_metal_disc(d, cx, cy, 24, IRON_DARK, ink_w=4, ring_detail=True)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.5)


# =============================================================================
# CATEGORY 2: WALL-MOUNTED SCONCES & EXTERIOR BRACKETS (160x160)
# Backplate flush near -Y top edge -> arm projecting +Y into room/alley!
# =============================================================================
def gen_wall_sconce(
    w: int, h: int, seed: int,
    kind: str,
    metal_rgb: tuple[int, int, int],
    glow_rgb: tuple[int, int, int] = GLOW_WARM,
    colorable: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    cx = w
    y_wall = 12
    y_head = int(h * 1.12)

    # Contact shadow underneath projecting bracket
    if kind == "bulkhead":
        add_contact_shadow(
            im,
            lambda sd, col, off: sd.rounded_rectangle([cx - 66 + off[0], y_wall + 14 + off[1], cx + 66 + off[0], y_wall + 118 + off[1]], radius=42, fill=col),
            offset=(6, 8), blur=10.0, alpha=95,
        )
        if not colorable:
            add_glow(im, cx, y_wall + 78, 118, 96, glow_rgb, alpha=118, blur=20.0)
    else:
        add_contact_shadow(
            im,
            lambda sd, col, off: (
                sd.rounded_rectangle([cx - 58 + off[0], y_wall + off[1], cx + 58 + off[0], y_wall + 40 + off[1]], radius=6, fill=col),
                sd.ellipse([cx - 52 + off[0], y_head - 48 + off[1], cx + 52 + off[0], y_head + 48 + off[1]], fill=col),
            ),
            offset=(6, 9), blur=10.0, alpha=95,
        )
        if not colorable:
            add_glow(im, cx, y_head + 6, 108, 108, glow_rgb, alpha=116, blur=20.0)
    d = ImageDraw.Draw(im)

    # 1. Flat wall backplate anchored flush at -Y edge
    draw_sconce_backplate(d, cx, y_wall, 128 if kind in ("twin_candle", "triple_candle", "crystal_twin") else 104, 34, metal_rgb, ornate=True)

    # 2. Projecting bracket arm(s) + fixture head
    if kind == "torch":
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=INK, width=24)
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=(*metal_rgb, 255), width=14)
        draw_metal_disc(d, cx, y_head, 36, metal_rgb, ink_w=5, ring_detail=False)
        draw_fire_bed(im, cx, y_head + 8, 34, random.Random(seed), (232, 82, 24), (255, 168, 46), (255, 246, 178))
    elif kind == "twin_candle":
        for sx in (-1, 1):
            tx, ty = cx + sx * 56, y_head - 4
            d.line([(cx, y_wall + 36), (cx + sx * 24, y_wall + 84), (tx, ty)], fill=INK, width=16)
            d.line([(cx, y_wall + 36), (cx + sx * 24, y_wall + 84), (tx, ty)], fill=(*metal_rgb, 255), width=8)
            draw_candle_top(im, d, tx, ty, 16.5, cup_rgb=metal_rgb, flame_rgb=glow_rgb, glow_scale=0.85)
            d = ImageDraw.Draw(im)
    elif kind == "triple_candle":
        for sx, dy in ((-1, -8), (0, 22), (1, -8)):
            tx, ty = cx + sx * 62, y_head + dy
            d.line([(cx, y_wall + 36), (tx, ty)], fill=INK, width=15)
            d.line([(cx, y_wall + 36), (tx, ty)], fill=(*metal_rgb, 255), width=7)
            draw_candle_top(im, d, tx, ty, 15.0, cup_rgb=metal_rgb, flame_rgb=glow_rgb, glow_scale=0.75)
            d = ImageDraw.Draw(im)
    elif kind == "gas_globe":
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=INK, width=20)
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=(*metal_rgb, 255), width=10)
        # Milk-glass frosted tulip globe seen from above
        d.ellipse([cx - 46, y_head - 46, cx + 46, y_head + 46], fill=(238, 224, 186, 255), outline=INK, width=5)
        d.ellipse([cx - 34, y_head - 34, cx + 34, y_head + 34], fill=(255, 244, 206, 255))
        d.ellipse([cx - 18, y_head - 18, cx + 18, y_head + 18], fill=(255, 254, 240, 255))
        draw_metal_disc(d, cx, y_head, 12, metal_rgb, ink_w=3, ring_detail=False)
    elif kind == "aether_cage":
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=INK, width=22)
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=(*metal_rgb, 255), width=12)
        draw_aether_orb(im, cx, y_head + 4, 42, glow_rgb, cage_rgb=metal_rgb, n_ribs=6, glow_r=2.0)
    elif kind == "aether_prism":
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=INK, width=22)
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=(*metal_rgb, 255), width=12)
        # Faceted hexagonal crystal sconce
        pts_o = poly_regular(cx, y_head + 4, 44, 6, math.pi / 6)
        pts_i = poly_regular(cx, y_head + 4, 28, 6, math.pi / 6)
        d.polygon(pts_o, fill=(*glow_rgb, 255), outline=INK)
        d.line(pts_o + [pts_o[0]], fill=INK, width=5)
        d.polygon(pts_i, fill=blend_rgb(glow_rgb, (255, 255, 255), 0.62))
        for p in pts_o:
            d.line([(cx, y_head + 4), p], fill=blend_rgb(glow_rgb, (255, 255, 255), 0.4), width=2)
        draw_metal_disc(d, cx, y_head + 4, 13, metal_rgb, ink_w=3, ring_detail=False)
    elif kind == "bulkhead":
        # Compact oval caged bulkhead hugging the wall closely!
        by = y_wall + 66
        d.rounded_rectangle([cx - 64, y_wall + 18, cx + 64, by + 44], radius=42, fill=(*metal_rgb, 255), outline=INK, width=6)
        d.rounded_rectangle([cx - 48, y_wall + 32, cx + 48, by + 30], radius=30, fill=(255, 224, 144, 255), outline=INK, width=4)
        d.rounded_rectangle([cx - 30, y_wall + 44, cx + 30, by + 18], radius=18, fill=(255, 250, 222, 255))
        # Protective cage bars across glass
        for bx in (-26, 0, 26):
            d.line([(cx + bx, y_wall + 24), (cx + bx, by + 38)], fill=INK, width=8)
            d.line([(cx + bx, y_wall + 24), (cx + bx, by + 38)], fill=(*metal_rgb, 255), width=4)
        d.line([(cx - 56, y_wall + 66), (cx + 56, y_wall + 66)], fill=INK, width=8)
        d.line([(cx - 56, y_wall + 66), (cx + 56, y_wall + 66)], fill=(*metal_rgb, 255), width=4)
    elif kind == "gooseneck":
        # Storefront curved brass arm + enameled green dome shade
        d.line([(cx, y_wall + 30), (cx, y_head + 8)], fill=INK, width=18)
        d.line([(cx, y_wall + 30), (cx, y_head + 8)], fill=(*BRASS, 255), width=9)
        d.ellipse([cx - 56, y_head - 42, cx + 56, y_head + 68], fill=(255, 232, 162, 255), outline=INK, width=3)
        draw_metal_disc(d, cx, y_head + 8, 48, (46, 108, 76), ink_w=5, ring_detail=True)
        draw_metal_disc(d, cx, y_head + 8, 14, BRASS_GOLD, ink_w=3, ring_detail=False)
    elif kind == "alley_hex":
        d.line([(cx, y_wall + 30), (cx, y_head + 4)], fill=INK, width=20)
        d.line([(cx, y_wall + 30), (cx, y_head + 4)], fill=(*metal_rgb, 255), width=11)
        draw_metal_poly(d, cx, y_head + 6, 48, 6, GLOW_WARM, rot=0, ink_w=5)
        draw_metal_poly(d, cx, y_head + 6, 32, 6, (255, 246, 204), rot=0, ink_w=3)
        for i in range(6):
            ang = i * math.tau / 6
            d.line([(cx, y_head + 6), (cx + math.cos(ang) * 48, y_head + 6 + math.sin(ang) * 48)], fill=INK, width=7)
            d.line([(cx, y_head + 6), (cx + math.cos(ang) * 48, y_head + 6 + math.sin(ang) * 48)], fill=(*metal_rgb, 255), width=3)
        draw_metal_disc(d, cx, y_head + 6, 18, metal_rgb, ink_w=4, ring_detail=False)
    elif kind == "tavern_hook":
        d.line([(cx, y_wall + 30), (cx, y_head + 10)], fill=INK, width=18)
        d.line([(cx, y_wall + 30), (cx, y_head + 10)], fill=(*IRON, 255), width=9)
        draw_metal_disc(d, cx, y_head + 6, 44, BRASS, ink_w=5, ring_detail=False)
        d.ellipse([cx - 32, y_head - 26, cx + 32, y_head + 38], fill=(255, 212, 114, 255), outline=INK, width=3)
        d.ellipse([cx - 16, y_head - 10, cx + 16, y_head + 22], fill=(255, 248, 212, 255))
        draw_metal_disc(d, cx, y_head + 6, 15, IRON_DARK, ink_w=3, ring_detail=False)
    elif kind == "brazier_wall":
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=INK, width=24)
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=(*IRON, 255), width=14)
        draw_metal_disc(d, cx, y_head + 4, 52, IRON_DARK, ink_w=6, ring_detail=False)
        draw_fire_bed(im, cx, y_head + 4, 40, random.Random(seed))
    elif kind == "crystal_twin":
        for sx in (-1, 1):
            tx, ty = cx + sx * 54, y_head
            d.line([(cx, y_wall + 36), (tx, ty)], fill=INK, width=14)
            d.line([(cx, y_wall + 36), (tx, ty)], fill=(*BRASS_GOLD, 255), width=7)
            add_glow(im, tx, ty, 52, 52, GLOW_CREAM, alpha=92, blur=12.0)
            d = ImageDraw.Draw(im)
            pts_o = poly_regular(tx, ty, 32, 8, math.pi / 8)
            d.polygon(pts_o, fill=(214, 232, 248, 255), outline=INK)
            d.line(pts_o + [pts_o[0]], fill=INK, width=4)
            for p in pts_o:
                d.line([(tx, ty), p], fill=(142, 168, 198, 255), width=2)
            d.ellipse([tx - 18, ty - 18, tx + 18, ty + 18], fill=(255, 240, 184, 255), outline=(*BRASS_GOLD, 255), width=2)
            d.ellipse([tx - 8, ty - 8, tx + 8, ty + 8], fill=(255, 255, 244, 255))
    elif kind == "oil_reflector":
        # Tin curved reflector plate behind humble oil lamp
        d.pieslice([cx - 60, y_wall + 24, cx + 60, y_wall + 132], 195, 345, fill=(*SILVER, 255), outline=INK, width=5)
        d.line([(cx, y_wall + 34), (cx, y_head + 4)], fill=INK, width=16)
        d.line([(cx, y_wall + 34), (cx, y_head + 4)], fill=(*BRONZE, 255), width=8)
        draw_metal_disc(d, cx, y_head + 4, 34, COPPER, ink_w=4, ring_detail=False)
        d.ellipse([cx - 22, y_head - 18, cx + 22, y_head + 26], fill=(255, 212, 118, 255), outline=INK, width=3)
        d.ellipse([cx - 10, y_head - 6, cx + 10, y_head + 14], fill=(255, 252, 224, 255))
    elif kind == "colorable_globe":
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=INK, width=20)
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=(*metal_rgb, 255), width=10)
        d.ellipse([cx - 46, y_head - 46, cx + 46, y_head + 46], fill=(*DD_RED_DEEP, 255), outline=INK, width=5)
        d.ellipse([cx - 38, y_head - 38, cx + 38, y_head + 38], fill=(*DD_RED_BASE, 255))
        d.ellipse([cx - 22, y_head - 22, cx + 22, y_head + 22], fill=(*DD_RED_HI, 255))
        draw_metal_disc(d, cx, y_head, 12, metal_rgb, ink_w=3, ring_detail=False)
    elif kind == "colorable_crystal":
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=INK, width=20)
        d.line([(cx, y_wall + 30), (cx, y_head)], fill=(*metal_rgb, 255), width=10)
        pts = poly_regular(cx, y_head + 4, 44, 6, math.pi / 6)
        d.polygon(pts, fill=(*DD_RED_BASE, 255), outline=INK)
        d.line(pts + [pts[0]], fill=INK, width=5)
        d.polygon(poly_regular(cx, y_head + 4, 24, 6, math.pi / 6), fill=(*DD_RED_HI, 255))
        draw_metal_disc(d, cx, y_head + 4, 12, metal_rgb, ink_w=3, ring_detail=False)

    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# CATEGORY 3: CEILING CHANDELIERS & HANGING PENDANTS (256x256 / 224x224 / 176x176)
# =============================================================================
def gen_ceiling_chandelier(
    w: int, h: int, seed: int,
    style: str,
    metal_rgb: tuple[int, int, int],
    n_lights: int = 8,
    glow_rgb: tuple[int, int, int] = GLOW_WARM,
    colorable: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    r_out = w * 0.72
    r_in = w * 0.36

    if not colorable:
        add_glow(im, cx, cy, w * 0.90, h * 0.90, glow_rgb, alpha=92, blur=26.0)
    d = ImageDraw.Draw(im)

    # Radial spokes / chains from ceiling rosette to outer hoop
    for i in range(n_lights):
        ang = i * math.tau / n_lights
        ox, oy = cx + math.cos(ang) * r_out, cy + math.sin(ang) * r_out
        d.line([(cx, cy), (ox, oy)], fill=INK, width=14)
        d.line([(cx, cy), (ox, oy)], fill=(*metal_rgb, 255), width=6)
        d.line([(cx, cy), (ox, oy)], fill=blend_rgb(metal_rgb, (255, 248, 224), 0.42), width=2)

    if style == "wagon_wheel":
        # Wide oak-and-iron wagon wheel rim
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=INK, width=38)
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=(*OAK, 255), width=26)
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=(*IRON, 255), width=7)
    elif style == "aether_ring":
        # Twin glowing concentric magipunk copper/brass rings
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=INK, width=26)
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=(*metal_rgb, 255), width=16)
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=(*glow_rgb, 255), width=6)
        d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], outline=INK, width=18)
        d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], outline=(*COPPER, 255), width=10)
    else:
        # Outer metallic wheel hoop
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=INK, width=24)
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=(*metal_rgb, 255), width=14)
        d.ellipse([cx - r_out, cy - r_out, cx + r_out, cy + r_out], outline=blend_rgb(metal_rgb, (255, 246, 212), 0.45), width=4)
        if style in ("sovereign", "crystal"):
            d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], outline=INK, width=16)
            d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], outline=(*metal_rgb, 255), width=8)

    # Outer light sconces around the wheel
    for i in range(n_lights):
        ang = i * math.tau / n_lights
        ox, oy = cx + math.cos(ang) * r_out, cy + math.sin(ang) * r_out
        if colorable:
            draw_metal_disc(d, ox, oy, 26, metal_rgb, ink_w=4, ring_detail=False)
            d.ellipse([ox - 20, oy - 20, ox + 20, oy + 20], fill=(*DD_RED_BASE, 255), outline=INK, width=3)
            d.ellipse([ox - 10, oy - 10, ox + 10, oy + 10], fill=(*DD_RED_HI, 255))
        elif style == "crystal":
            draw_metal_poly(d, ox, oy, 26, 8, (232, 244, 255), rot=math.pi / 8, ink_w=4)
            add_glow(im, ox, oy, 46, 46, GLOW_CREAM, alpha=76, blur=10.0)
            d = ImageDraw.Draw(im)
            d.ellipse([ox - 14, oy - 14, ox + 14, oy + 14], fill=(255, 248, 214, 255))
            d.ellipse([ox - 7, oy - 7, ox + 7, oy + 7], fill=(255, 255, 244, 255))
        elif style == "aether_ring":
            draw_aether_orb(im, ox, oy, 24, glow_rgb, cage_rgb=metal_rgb, n_ribs=4, glow_r=1.8)
            d = ImageDraw.Draw(im)
        elif style == "banquet":
            # Warm amber glass globes around brass chandelier
            add_glow(im, ox, oy, 46, 46, GLOW_WARM, alpha=84, blur=10.0)
            d = ImageDraw.Draw(im)
            draw_metal_disc(d, ox, oy, 25, metal_rgb, ink_w=4, ring_detail=False)
            d.ellipse([ox - 20, oy - 20, ox + 20, oy + 20], fill=(255, 206, 108, 255), outline=INK, width=3)
            d.ellipse([ox - 10, oy - 10, ox + 10, oy + 10], fill=(255, 250, 218, 255))
        else:
            draw_candle_top(im, d, ox, oy, 15.5, flame_rgb=glow_rgb, cup_rgb=metal_rgb, glow_scale=0.85)
            d = ImageDraw.Draw(im)

    # Inner ring lights on grand double-tier Sovereign / Crystal chandeliers
    if style == "sovereign":
        for i in range(6):
            ang = i * math.tau / 6 + math.pi / 6
            ix, iy = cx + math.cos(ang) * r_in, cy + math.sin(ang) * r_in
            draw_candle_top(im, d, ix, iy, 12.5, flame_rgb=GLOW_CANDLE, cup_rgb=BRASS_GOLD, glow_scale=0.65)
            d = ImageDraw.Draw(im)
        # Central Sovereign violet aether crystal jewel in rosette!
        draw_metal_poly(d, cx, cy, 46, 8, OBSIDIAN, rot=math.pi / 8, ink_w=5)
        draw_aether_orb(im, cx, cy, 30, GLOW_VIOLET, cage_rgb=BRASS_GOLD, n_ribs=6, glow_r=2.0)
    elif style == "crystal":
        for i in range(6):
            ang = i * math.tau / 6 + math.pi / 6
            ix, iy = cx + math.cos(ang) * r_in, cy + math.sin(ang) * r_in
            draw_metal_poly(d, ix, iy, 18, 8, (238, 246, 255), rot=0, ink_w=3)
        draw_metal_disc(d, cx, cy, 36, BRASS_GOLD, ink_w=5, ring_detail=True)
        d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(255, 252, 232, 255))
    elif style == "aether_ring":
        draw_aether_orb(im, cx, cy, 36, glow_rgb, cage_rgb=metal_rgb, n_ribs=8, glow_r=2.0)
    else:
        # Central ceiling rosette canopy + chain collar
        draw_metal_disc(d, cx, cy, 36, metal_rgb, ink_w=5, ring_detail=True)
        draw_metal_disc(d, cx, cy, 14, blend_rgb(metal_rgb, (255, 244, 210), 0.35)[:3], ink_w=3, ring_detail=False)

    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_ceiling_pendant(
    w: int, h: int, seed: int,
    style: str,
    shade_rgb: tuple[int, int, int],
    trim_rgb: tuple[int, int, int] = BRASS_GOLD,
    glow_rgb: tuple[int, int, int] = GLOW_WARM,
    colorable: bool = False,
) -> Image.Image:
    """True top-down hanging ceiling pendant lamp with soft ambient halo + ceiling cord rosette."""
    im = new_hi(w, h)
    cx, cy = w, h
    r = w * 0.62
    if not colorable:
        add_glow(im, cx, cy, w * 0.88, h * 0.88, glow_rgb, alpha=110, blur=22.0)
    d = ImageDraw.Draw(im)

    if style == "milkglass":
        # Frosted opal milk-glass globe with delicate gilded brass gallery rim
        draw_metal_disc(d, cx, cy, r * 1.04, trim_rgb, ink_w=6, ring_detail=False)
        d.ellipse([cx - r * 0.92, cy - r * 0.92, cx + r * 0.92, cy + r * 0.92], fill=(242, 234, 210, 255), outline=INK, width=4)
        d.ellipse([cx - r * 0.72, cy - r * 0.72, cx + r * 0.72, cy + r * 0.72], fill=(255, 246, 218, 255))
        d.ellipse([cx - r * 0.42, cy - r * 0.42, cx + r * 0.42, cy + r * 0.42], fill=(255, 254, 240, 255))
        draw_metal_disc(d, cx, cy, r * 0.28, trim_rgb, ink_w=4, ring_detail=True)
    elif style == "leaded_glass":
        draw_stained_glass_dome(
            d, cx, cy, r,
            petals_rgb=[shade_rgb, blend_rgb(shade_rgb, (255, 236, 174), 0.25)[:3]],
            border_rgb=blend_rgb(shade_rgb, (34, 24, 20), 0.22)[:3],
            cap_rgb=trim_rgb,
        )
    elif style == "tiffany":
        draw_stained_glass_dome(
            d, cx, cy, r,
            petals_rgb=[(228, 170, 56), (68, 168, 128), (198, 86, 82), (82, 134, 198)],
            border_rgb=(188, 124, 52),
            cap_rgb=BRONZE,
        )
    elif style == "pleated":
        draw_pleated_shade(d, cx, cy, r, shade_rgb, trim_rgb, n_pleats=16, scalloped=True, finial_rgb=BRASS_GOLD)
    elif style == "enamel_dome":
        # Industrial or kitchen enameled metal cone shade with subtle warm rim spill
        d.ellipse([cx - r * 1.06, cy - r * 1.06, cx + r * 1.06, cy + r * 1.06], fill=(255, 234, 174, 255))
        draw_metal_disc(d, cx, cy, r * 0.96, shade_rgb, ink_w=6, ring_detail=True)
        # Riveted vent slots around crown
        for i in range(6):
            ang = i * math.tau / 6
            vx, vy = cx + math.cos(ang) * r * 0.40, cy + math.sin(ang) * r * 0.40
            d.ellipse([vx - 6, vy - 6, vx + 6, vy + 6], fill=(255, 224, 134, 255), outline=INK, width=2)
        draw_metal_disc(d, cx, cy, r * 0.24, trim_rgb, ink_w=4, ring_detail=False)
    elif style == "iron_hood":
        # Octagonal monastic hammered-iron hanging lantern hood with warm side vents & iron straps
        draw_metal_poly(d, cx, cy, r * 1.06, 8, (255, 224, 138), rot=math.pi / 8, ink_w=4)
        draw_metal_poly(d, cx, cy, r * 0.94, 8, shade_rgb, rot=math.pi / 8, ink_w=6)
        for i in range(8):
            ang = i * math.tau / 8 + math.pi / 8
            d.line([(cx, cy), (cx + math.cos(ang) * r * 0.94, cy + math.sin(ang) * r * 0.94)], fill=INK, width=8)
            d.line([(cx, cy), (cx + math.cos(ang) * r * 0.94, cy + math.sin(ang) * r * 0.94)], fill=blend_rgb(shade_rgb, (165, 174, 184), 0.35), width=3)
        draw_metal_poly(d, cx, cy, r * 0.34, 8, trim_rgb, rot=math.pi / 8, ink_w=4)
    elif style == "colorable":
        draw_pleated_shade(d, cx, cy, r, DD_RED_BASE, trim_rgb, n_pleats=14, scalloped=False, finial_rgb=BRASS_GOLD)

    # Center ceiling chain/cord cap
    d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=INK)
    d.ellipse([cx - 4, cy - 4, cx + 4, cy + 4], fill=(224, 206, 164, 255))
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


# =============================================================================
# CATEGORY 4: TABLETOP, DESK & BEDSIDE LAMPS (144x144)
# Compact tabletop scale — sits ON desks, nightstands, counters & tables!
# =============================================================================
def gen_table_banker_lamp(w: int, h: int, seed: int, glass_rgb: tuple[int, int, int], glow_rgb: tuple[int, int, int]) -> Image.Image:
    """True top-down classic cased-glass rectangular banker's desk lamp."""
    im = new_hi(w, h)
    cx, cy = w, h
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.rounded_rectangle([cx - 86 + off[0], cy - 56 + off[1], cx + 86 + off[0], cy + 56 + off[1]], radius=16, fill=col),
        offset=(5, 7), blur=8.0, alpha=88,
    )
    add_glow(im, cx, cy + 16, 108, 92, glow_rgb, alpha=105, blur=18.0)
    d = ImageDraw.Draw(im)
    # Compact stepped brass base peeking gently behind glass shade (-Y edge)
    draw_beveled_rect(d, cx - 56, cy - 66, cx + 56, cy + 44, BRASS_AGED, ink_w=5, radius=14)
    # Warm glow spilling forward onto desktop (+Y edge)
    d.rounded_rectangle([cx - 76, cy + 12, cx + 76, cy + 62], radius=14, fill=(255, 240, 188, 255))
    # Rectangular curved cased-glass shade seen from above!
    dk = blend_rgb(glass_rgb, (12, 18, 16), 0.45)
    hi = blend_rgb(glass_rgb, (240, 255, 224), 0.48)
    draw_beveled_rect(d, cx - 84, cy - 42, cx + 84, cy + 44, glass_rgb, ink_w=6, radius=16)
    # Curved glass tubular highlight bar across center
    d.rounded_rectangle([cx - 70, cy - 22, cx + 70, cy - 4], radius=6, fill=hi)
    d.rounded_rectangle([cx - 72, cy + 18, cx + 72, cy + 32], radius=5, fill=dk)
    # Polished brass end-caps & pull-chain bead
    draw_beveled_rect(d, cx - 90, cy - 36, cx - 72, cy + 38, BRASS_GOLD, ink_w=4, radius=6)
    draw_beveled_rect(d, cx + 72, cy - 36, cx + 90, cy + 38, BRASS_GOLD, ink_w=4, radius=6)
    d.line([(cx + 38, cy + 42), (cx + 52, cy + 64)], fill=INK, width=5)
    d.ellipse([cx + 46, cy + 58, cx + 58, cy + 70], fill=(*BRASS_GOLD, 255), outline=INK, width=2)
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_table_bedside_lamp(
    w: int, h: int, seed: int,
    shade_rgb: tuple[int, int, int],
    trim_rgb: tuple[int, int, int],
    glow_rgb: tuple[int, int, int] = GLOW_WARM,
    style: str = "pleated",
    colorable: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    r = w * 0.54
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - r, cy + off[1] - r, cx + off[0] + r, cy + off[1] + r], fill=col),
        offset=(5, 7), blur=9.0, alpha=86,
    )
    if not colorable:
        add_glow(im, cx, cy, w * 0.80, h * 0.80, glow_rgb, alpha=102, blur=16.0)
    d = ImageDraw.Draw(im)
    if style == "tiffany":
        draw_stained_glass_dome(
            d, cx, cy, r,
            petals_rgb=[(172, 92, 224), (226, 174, 62), (72, 168, 134)],
            border_rgb=(196, 146, 56), cap_rgb=BRASS_GOLD,
        )
    elif style == "iron_hood":
        # Octagonal monastic hammered-iron hanging lantern hood with warm side vents & iron straps
        draw_metal_poly(d, cx, cy, r * 1.06, 8, (255, 224, 138), rot=math.pi / 8, ink_w=4)
        draw_metal_poly(d, cx, cy, r * 0.94, 8, shade_rgb, rot=math.pi / 8, ink_w=6)
        for i in range(8):
            ang = i * math.tau / 8 + math.pi / 8
            d.line([(cx, cy), (cx + math.cos(ang) * r * 0.94, cy + math.sin(ang) * r * 0.94)], fill=INK, width=8)
            d.line([(cx, cy), (cx + math.cos(ang) * r * 0.94, cy + math.sin(ang) * r * 0.94)], fill=blend_rgb(shade_rgb, (165, 174, 184), 0.35), width=3)
        draw_metal_poly(d, cx, cy, r * 0.34, 8, trim_rgb, rot=math.pi / 8, ink_w=4)
    elif style == "colorable":
        draw_pleated_shade(d, cx, cy, r, DD_RED_BASE, trim_rgb, n_pleats=12, scalloped=True, finial_rgb=BRASS_GOLD)
    else:
        draw_pleated_shade(d, cx, cy, r, shade_rgb, trim_rgb, n_pleats=14, scalloped=(style == "scalloped"), finial_rgb=BRASS_GOLD)
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_table_articulated_lamp(w: int, h: int, seed: int) -> Image.Image:
    """Compact articulated brass workbench/drafting clamp desk lamp seen from above."""
    im = new_hi(w, h)
    cx, cy = w, h
    bx, by = cx - 44, cy - 36
    hx, hy = cx + 30, cy + 28
    add_contact_shadow(
        im,
        lambda sd, col, off: (
            sd.ellipse([bx + off[0] - 32, by + off[1] - 32, bx + off[0] + 32, by + off[1] + 32], fill=col),
            sd.ellipse([hx + off[0] - 42, hy + off[1] - 42, hx + off[0] + 42, hy + off[1] + 42], fill=col),
        ),
        offset=(5, 7), blur=8.0, alpha=88,
    )
    add_glow(im, hx + 16, hy + 14, 84, 84, GLOW_CREAM, alpha=110, blur=16.0)
    d = ImageDraw.Draw(im)
    draw_metal_disc(d, bx, by, 32, IRON_DARK, ink_w=5, ring_detail=True)
    # Twin parallel drafting swing arms
    for off in (-6, 6):
        d.line([(bx + off, by - off), (hx + off * 0.5, hy - off * 0.5)], fill=INK, width=10)
        d.line([(bx + off, by - off), (hx + off * 0.5, hy - off * 0.5)], fill=(*BRASS, 255), width=5)
    d.ellipse([hx - 24, hy - 24, hx + 46, hy + 46], fill=(255, 240, 186, 255))
    draw_metal_disc(d, hx, hy, 38, BRASS, ink_w=5, ring_detail=True)
    draw_metal_disc(d, hx - 4, hy - 4, 13, BRASS_GOLD, ink_w=3, ring_detail=False)
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_table_hurricane_oil(w: int, h: int, seed: int, spirit: bool = False) -> Image.Image:
    """True top-down brass reservoir hurricane oil lamp (or alchemical emerald spirit burner)."""
    im = new_hi(w, h)
    cx, cy = w, h
    glow = GLOW_EMERALD if spirit else GLOW_WARM
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - 66, cy + off[1] - 66, cx + off[0] + 66, cy + off[1] + 66], fill=col),
        offset=(5, 7), blur=9.0, alpha=88,
    )
    add_glow(im, cx, cy, 108, 108, glow, alpha=115, blur=16.0)
    d = ImageDraw.Draw(im)
    # Brass base reservoir + finger loop on right
    d.ellipse([cx + 42, cy - 18, cx + 82, cy + 18], outline=INK, width=14)
    d.ellipse([cx + 42, cy - 18, cx + 82, cy + 18], outline=(*BRASS, 255), width=6)
    draw_metal_disc(d, cx, cy, 62, COPPER if spirit else BRASS, ink_w=5, ring_detail=True)
    # Clear glass chimney collar + bright glowing wick center
    chim = blend_rgb(glow, (255, 255, 245), 0.45)
    d.ellipse([cx - 38, cy - 38, cx + 38, cy + 38], fill=(*glow, 255), outline=INK, width=4)
    d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=chim)
    d.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(255, 255, 244, 255))
    d.arc([cx - 32, cy - 32, cx + 32, cy + 32], 200, 290, fill=(255, 255, 255, 255), width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_table_aether_lamp(w: int, h: int, seed: int, core_rgb: tuple[int, int, int], base_rgb: tuple[int, int, int], colorable: bool = False) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - 64, cy + off[1] - 64, cx + off[0] + 64, cy + off[1] + 64], fill=col),
        offset=(5, 7), blur=8.0, alpha=88,
    )
    d = ImageDraw.Draw(im)
    draw_metal_poly(d, cx, cy, 64, 6, base_rgb, rot=0, ink_w=5)
    if colorable:
        d.ellipse([cx - 44, cy - 44, cx + 44, cy + 44], fill=(*DD_RED_DEEP, 255), outline=INK, width=5)
        d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill=(*DD_RED_BASE, 255))
        d.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=(*DD_RED_HI, 255))
        for i in range(6):
            ang = i * math.tau / 6
            d.line([(cx + math.cos(ang) * 14, cy + math.sin(ang) * 14), (cx + math.cos(ang) * 46, cy + math.sin(ang) * 46)], fill=INK, width=5)
            d.line([(cx + math.cos(ang) * 14, cy + math.sin(ang) * 14), (cx + math.cos(ang) * 46, cy + math.sin(ang) * 46)], fill=(*BRASS_GOLD, 255), width=2)
        draw_metal_disc(d, cx, cy, 12, BRASS_GOLD, ink_w=3, ring_detail=False)
    else:
        draw_aether_orb(im, cx, cy, 42, core_rgb, cage_rgb=BRASS_GOLD, n_ribs=6, glow_r=2.0)
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_table_candelabra(w: int, h: int, seed: int, metal_rgb: tuple[int, int, int], n_arms: int = 4) -> Image.Image:
    """Compact true top-down tabletop candelabra on a small chased saucer base."""
    im = new_hi(w, h)
    cx, cy = w, h
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - 66, cy + off[1] - 66, cx + off[0] + 66, cy + off[1] + 66], fill=col),
        offset=(5, 7), blur=9.0, alpha=86,
    )
    d = ImageDraw.Draw(im)
    draw_metal_disc(d, cx, cy, 46, metal_rgb, ink_w=5, ring_detail=True)
    r_arm = 58
    for i in range(n_arms):
        ang = i * math.tau / n_arms + math.pi / 4
        ax, ay = cx + math.cos(ang) * r_arm, cy + math.sin(ang) * r_arm
        d.line([(cx, cy), (ax, ay)], fill=INK, width=12)
        d.line([(cx, cy), (ax, ay)], fill=(*metal_rgb, 255), width=6)
    for i in range(n_arms):
        ang = i * math.tau / n_arms + math.pi / 4
        ax, ay = cx + math.cos(ang) * r_arm, cy + math.sin(ang) * r_arm
        draw_candle_top(im, d, ax, ay, 13.0, wax_rgb=(248, 244, 232), cup_rgb=metal_rgb, glow_scale=0.78)
        d = ImageDraw.Draw(im)
    draw_candle_top(im, d, cx, cy, 15.0, wax_rgb=(248, 244, 232), cup_rgb=metal_rgb, glow_scale=0.95)
    return apply_painterly_finish(im, w, h, seed=seed, grain=3.8)


def gen_table_candle_saucer(w: int, h: int, seed: int, bottle: bool = False) -> Image.Image:
    """Tabletop melted beeswax pillar cluster on pewter saucer OR dripping wine-bottle candle."""
    im = new_hi(w, h)
    cx, cy = w, h
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - 64, cy + off[1] - 64, cx + off[0] + 64, cy + off[1] + 64], fill=col),
        offset=(5, 7), blur=8.0, alpha=86,
    )
    d = ImageDraw.Draw(im)
    if bottle:
        # Dark emerald tavern wine bottle shoulder + melted wax drips + single lit tallow candle
        add_glow(im, cx, cy, 94, 94, GLOW_CANDLE, alpha=105, blur=16.0)
        d = ImageDraw.Draw(im)
        draw_metal_disc(d, cx, cy, 50, (44, 82, 54), ink_w=5, ring_detail=False)
        d.arc([cx - 38, cy - 38, cx + 38, cy + 38], 200, 285, fill=(138, 198, 146, 255), width=5)
        # Organic dripping wax puddle over bottle shoulder
        rng = random.Random(seed)
        for _ in range(9):
            ang = rng.uniform(0, math.tau)
            dist = rng.uniform(14, 34)
            dr = rng.uniform(10, 18)
            dx, dy = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
            d.ellipse([dx - dr, dy - dr, dx + dr, dy + dr], fill=(238, 224, 194, 255), outline=INK_MID, width=2)
        draw_candle_top(im, d, cx, cy, 20, wax_rgb=(246, 236, 210), cup_rgb=None, glow_scale=0.9)
    else:
        draw_metal_disc(d, cx, cy, 68, (148, 152, 160), ink_w=5, ring_detail=True)
        # Pooled melted beeswax inside saucer
        d.ellipse([cx - 52, cy - 52, cx + 52, cy + 52], fill=(214, 196, 156, 255), outline=INK_MID, width=3)
        offsets = [(-22, -16, 17), (22, -12, 15), (-10, 22, 16), (20, 20, 13)]
        for ox, oy, cr in offsets:
            draw_candle_top(im, d, cx + ox, cy + oy, cr, wax_rgb=(244, 226, 182), cup_rgb=None, glow_scale=0.72)
            d = ImageDraw.Draw(im)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# CATEGORY 5: BRAZIERS, FIRE-BOWLS & PORTABLE LANTERNS (192x192 / 144x144)
# =============================================================================
def gen_brazier(
    w: int, h: int, seed: int,
    bowl_rgb: tuple[int, int, int],
    trim_rgb: tuple[int, int, int],
    flame_outer: tuple[int, int, int],
    flame_mid: tuple[int, int, int],
    flame_core: tuple[int, int, int],
    tripod: bool = True,
    colorable: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    r_bowl = w * 0.56
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - r_bowl * 1.12, cy + off[1] - r_bowl * 1.12, cx + off[0] + r_bowl * 1.12, cy + off[1] + r_bowl * 1.12], fill=col),
        offset=(8, 10), blur=12.0, alpha=105,
    )
    d = ImageDraw.Draw(im)
    if tripod:
        for i in range(3):
            ang = i * math.tau / 3 - math.pi / 2
            lx, ly = cx + math.cos(ang) * (w * 0.76), cy + math.sin(ang) * (w * 0.76)
            d.line([(cx, cy), (lx, ly)], fill=INK, width=26)
            d.line([(cx, cy), (lx, ly)], fill=(*bowl_rgb, 255), width=15)
            draw_metal_disc(d, lx, ly, 16, trim_rgb, ink_w=4, ring_detail=False)
    else:
        draw_metal_poly(d, cx, cy, r_bowl * 1.14, 8, STONE, rot=math.pi / 8, ink_w=6)

    draw_metal_disc(d, cx, cy, r_bowl, bowl_rgb, ink_w=6, ring_detail=False)
    d.ellipse([cx - r_bowl * 0.90, cy - r_bowl * 0.90, cx + r_bowl * 0.90, cy + r_bowl * 0.90], outline=(*trim_rgb, 255), width=8)
    # 8 rim rivets
    for i in range(8):
        ang = i * math.tau / 8
        rx, ry = cx + math.cos(ang) * r_bowl * 0.90, cy + math.sin(ang) * r_bowl * 0.90
        d.ellipse([rx - 5, ry - 5, rx + 5, ry + 5], fill=blend_rgb(trim_rgb, (255, 248, 224), 0.4), outline=INK, width=2)

    if colorable:
        rng = random.Random(seed)
        d.ellipse([cx - r_bowl * 0.78, cy - r_bowl * 0.78, cx + r_bowl * 0.78, cy + r_bowl * 0.78], fill=(42, 24, 24, 255), outline=INK, width=4)
        for i in range(9):
            ang = i * math.tau / 9
            tip = (cx + math.cos(ang) * r_bowl * 0.68, cy + math.sin(ang) * r_bowl * 0.68)
            p_l = (cx + math.cos(ang - 0.45) * r_bowl * 0.30, cy + math.sin(ang - 0.45) * r_bowl * 0.30)
            p_r = (cx + math.cos(ang + 0.45) * r_bowl * 0.30, cy + math.sin(ang + 0.45) * r_bowl * 0.30)
            d.polygon([p_l, tip, p_r], fill=(*DD_RED_BASE, 255))
        d.ellipse([cx - r_bowl * 0.34, cy - r_bowl * 0.34, cx + r_bowl * 0.34, cy + r_bowl * 0.34], fill=(*DD_RED_HI, 255))
    else:
        draw_fire_bed(im, cx, cy, r_bowl * 0.78, random.Random(seed), flame_outer, flame_mid, flame_core)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


def gen_portable_lantern(w: int, h: int, seed: int, style: str) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    r = w * 0.48
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - r * 1.06, cy + off[1] - r * 1.06, cx + off[0] + r * 1.06, cy + off[1] + r * 1.06], fill=col),
        offset=(5, 7), blur=9.0, alpha=88,
    )
    if style == "hooded_iron":
        # Directional bullseye warm beam toward +Y!
        add_glow(im, cx, cy + 36, 92, 98, GLOW_WARM, alpha=118, blur=18.0)
        d = ImageDraw.Draw(im)
        # Forward light cone hint
        d.pieslice([cx - 64, cy - 42, cx + 64, cy + 92], 35, 145, fill=(255, 224, 134, 255))
        draw_metal_disc(d, cx, cy, r, IRON_DARK, ink_w=6, ring_detail=True)
        # Rear handle + chimney cap
        d.arc([cx - 30, cy - r - 20, cx + 30, cy - r + 24], 180, 360, fill=INK, width=10)
        draw_metal_disc(d, cx, cy, r * 0.46, IRON, ink_w=4, ring_detail=False)
    elif style == "paper_crimson":
        add_glow(im, cx, cy, w * 0.84, h * 0.84, GLOW_CRIMSON, alpha=112, blur=20.0)
        d = ImageDraw.Draw(im)
        d.ellipse([cx - r * 1.12, cy - r * 1.12, cx + r * 1.12, cy + r * 1.12], fill=(208, 46, 48, 255), outline=INK, width=6)
        d.ellipse([cx - r * 0.84, cy - r * 0.84, cx + r * 0.84, cy + r * 0.84], fill=(236, 86, 62, 255))
        d.ellipse([cx - r * 0.50, cy - r * 0.50, cx + r * 0.50, cy + r * 0.50], fill=(255, 192, 94, 255))
        for i in range(12):
            ang = i * math.tau / 12
            d.line([(cx + math.cos(ang) * r * 0.25, cy + math.sin(ang) * r * 0.25), (cx + math.cos(ang) * r * 1.10, cy + math.sin(ang) * r * 1.10)], fill=(124, 24, 26, 255), width=3)
        draw_metal_disc(d, cx, cy, r * 0.30, BRASS_GOLD, ink_w=4, ring_detail=False)
    elif style == "aether_portable":
        # Arched carry bail handle lying slightly angled
        d = ImageDraw.Draw(im)
        d.arc([cx - r * 1.15, cy - r * 1.15, cx + r * 1.15, cy + r * 1.15], 200, 340, fill=INK, width=14)
        d.arc([cx - r * 1.15, cy - r * 1.15, cx + r * 1.15, cy + r * 1.15], 200, 340, fill=(*BRASS, 255), width=6)
        draw_aether_orb(im, cx, cy, r * 0.92, GLOW_CYAN, cage_rgb=BRASS, n_ribs=6, glow_r=2.0)
    else:
        # Brass railroad or hexagonal camp lantern
        glow = GLOW_WARM
        add_glow(im, cx, cy, w * 0.82, h * 0.82, glow, alpha=110, blur=16.0)
        d = ImageDraw.Draw(im)
        # Bail handle
        d.arc([cx - r * 1.18, cy - r * 1.18, cx + r * 1.18, cy + r * 1.18], 210, 330, fill=INK, width=14)
        d.arc([cx - r * 1.18, cy - r * 1.18, cx + r * 1.18, cy + r * 1.18], 210, 330, fill=(*BRASS, 255), width=6)
        if style == "camp_hex":
            draw_metal_poly(d, cx, cy, r * 1.04, 6, GLOW_WARM, rot=0, ink_w=5)
            draw_metal_poly(d, cx, cy, r * 0.72, 6, (255, 244, 198), rot=0, ink_w=3)
            for i in range(6):
                ang = i * math.tau / 6
                d.line([(cx, cy), (cx + math.cos(ang) * r * 1.04, cy + math.sin(ang) * r * 1.04)], fill=INK, width=7)
                d.line([(cx, cy), (cx + math.cos(ang) * r * 1.04, cy + math.sin(ang) * r * 1.04)], fill=(*BRASS, 255), width=3)
            draw_metal_disc(d, cx, cy, r * 0.42, BRASS_AGED, ink_w=4, ring_detail=True)
        else:
            # Railroad wire-caged lantern
            draw_metal_disc(d, cx, cy, r * 1.02, BRASS, ink_w=5, ring_detail=False)
            d.ellipse([cx - r * 0.84, cy - r * 0.84, cx + r * 0.84, cy + r * 0.84], fill=(255, 212, 114, 255), outline=INK, width=4)
            d.ellipse([cx - r * 0.50, cy - r * 0.50, cx + r * 0.50, cy + r * 0.50], fill=(255, 248, 212, 255))
            for i in range(4):
                ang = i * math.tau / 4 + math.pi / 4
                d.line([(cx - math.cos(ang) * r, cy - math.sin(ang) * r), (cx + math.cos(ang) * r, cy + math.sin(ang) * r)], fill=INK, width=7)
                d.line([(cx - math.cos(ang) * r, cy - math.sin(ang) * r), (cx + math.cos(ang) * r, cy + math.sin(ang) * r)], fill=(*BRASS_GOLD, 255), width=3)
            draw_metal_disc(d, cx, cy, r * 0.34, COPPER, ink_w=4, ring_detail=False)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.0)


# =============================================================================
# CATEGORY 6: EXTERIOR STREET, PARK, COURTYARD & GATE LIGHTS (160x160 - 192x192)
# =============================================================================
def gen_street_lamp(
    w: int, h: int, seed: int,
    style: str,
    post_rgb: tuple[int, int, int] = IRON_DARK,
    glow_rgb: tuple[int, int, int] = GLOW_WARM,
    colorable: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    cx, cy = w, h
    r_plinth = w * 0.54

    add_contact_shadow(
        im,
        lambda sd, col, off: sd.ellipse([cx + off[0] - r_plinth * 1.08, cy + off[1] - r_plinth * 1.08, cx + off[0] + r_plinth * 1.08, cy + off[1] + r_plinth * 1.08], fill=col),
        offset=(10, 12), blur=14.0, alpha=105,
    )
    if not colorable:
        add_glow(im, cx, cy, w * 0.88, h * 0.88, glow_rgb, alpha=116, blur=22.0)
    d = ImageDraw.Draw(im)

    if style == "double_globe":
        # Ornate Berlin twin-arm boulevard lamp!
        draw_metal_poly(d, cx, cy, 62, 8, STONE, rot=math.pi / 8, ink_w=5)
        draw_metal_disc(d, cx, cy, 46, post_rgb, ink_w=5, ring_detail=True)
        # Crossbar
        d.line([(cx - 94, cy), (cx + 94, cy)], fill=INK, width=22)
        d.line([(cx - 94, cy), (cx + 94, cy)], fill=(*post_rgb, 255), width=12)
        d.line([(cx - 94, cy - 2), (cx + 94, cy - 2)], fill=blend_rgb(post_rgb, (210, 220, 232), 0.35), width=3)
        for sx in (-1, 1):
            gx = cx + sx * 86
            add_glow(im, gx, cy, 78, 78, glow_rgb, alpha=95, blur=16.0)
            d = ImageDraw.Draw(im)
            draw_metal_disc(d, gx, cy, 48, BRASS, ink_w=5, ring_detail=False)
            d.ellipse([gx - 38, cy - 38, gx + 38, cy + 38], fill=(255, 224, 146, 255), outline=INK, width=3)
            d.ellipse([gx - 22, cy - 22, gx + 22, cy + 22], fill=(255, 252, 228, 255))
            draw_metal_disc(d, gx, cy, 12, post_rgb, ink_w=3, ring_detail=False)
        draw_metal_disc(d, cx, cy, 24, BRASS_GOLD, ink_w=4, ring_detail=True)
    elif style == "single_hex":
        draw_metal_poly(d, cx, cy, 74, 8, STONE, rot=math.pi / 8, ink_w=5)
        draw_metal_poly(d, cx, cy, 62, 6, GLOW_WARM, rot=0, ink_w=6)
        draw_metal_poly(d, cx, cy, 42, 6, (255, 246, 206), rot=0, ink_w=3)
        for i in range(6):
            ang = i * math.tau / 6
            d.line([(cx, cy), (cx + math.cos(ang) * 62, cy + math.sin(ang) * 62)], fill=INK, width=9)
            d.line([(cx, cy), (cx + math.cos(ang) * 62, cy + math.sin(ang) * 62)], fill=(*post_rgb, 255), width=4)
        draw_metal_disc(d, cx, cy, 22, post_rgb, ink_w=4, ring_detail=True)
    elif style == "gothic_post":
        # Square carved stone plinth + ornate gothic forged-iron square lantern with corner finials
        draw_beveled_rect(d, cx - 68, cy - 68, cx + 68, cy + 68, STONE, ink_w=6, radius=10)
        draw_beveled_rect(d, cx - 54, cy - 54, cx + 54, cy + 54, GLOW_WARM, ink_w=5, radius=8)
        draw_beveled_rect(d, cx - 34, cy - 34, cx + 34, cy + 34, (255, 246, 206), ink_w=3, radius=6)
        # Diagonal wrought-iron pyramid roof ribs
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            d.line([(cx, cy), (cx + sx * 56, cy + sy * 56)], fill=INK, width=10)
            d.line([(cx, cy), (cx + sx * 56, cy + sy * 56)], fill=(*IRON_DARK, 255), width=5)
            draw_metal_disc(d, cx + sx * 54, cy + sy * 54, 11, IRON, ink_w=3, ring_detail=False)
        draw_metal_disc(d, cx, cy, 22, IRON_DARK, ink_w=4, ring_detail=True)
    elif style == "park_bollard":
        # Short stout Kiezpark iron path bollard with circular louvered cap & warm radial light slits
        draw_metal_disc(d, cx, cy, 66, STONE, ink_w=5, ring_detail=False)
        draw_metal_disc(d, cx, cy, 52, (46, 72, 58), ink_w=5, ring_detail=False)
        d.ellipse([cx - 42, cy - 42, cx + 42, cy + 42], fill=(255, 220, 126, 255), outline=INK, width=4)
        d.ellipse([cx - 28, cy - 28, cx + 28, cy + 28], fill=(255, 250, 218, 255))
        # Dark cast-iron bollard mushroom cap with 6 light-spill cutouts
        for i in range(6):
            ang = i * math.tau / 6
            d.line([(cx, cy), (cx + math.cos(ang) * 44, cy + math.sin(ang) * 44)], fill=INK, width=10)
            d.line([(cx, cy), (cx + math.cos(ang) * 44, cy + math.sin(ang) * 44)], fill=(46, 72, 58, 255), width=5)
        draw_metal_disc(d, cx, cy, 24, (46, 72, 58), ink_w=4, ring_detail=True)
    elif style == "courtyard_pillar":
        # Warm carved sandstone pillar topped with square iron-and-amber courtyard lantern
        draw_beveled_rect(d, cx - 72, cy - 72, cx + 72, cy + 72, (168, 152, 126), ink_w=6, radius=8)
        draw_beveled_rect(d, cx - 56, cy - 56, cx + 56, cy + 56, (194, 178, 148), ink_w=4, radius=6)
        draw_beveled_rect(d, cx - 40, cy - 40, cx + 40, cy + 40, GLOW_WARM, ink_w=4, radius=5)
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            d.line([(cx, cy), (cx + sx * 42, cy + sy * 42)], fill=INK, width=8)
            d.line([(cx, cy), (cx + sx * 42, cy + sy * 42)], fill=(*IRON_DARK, 255), width=4)
        draw_metal_disc(d, cx, cy, 18, IRON_DARK, ink_w=4, ring_detail=False)
    elif style == "aether_post":
        draw_metal_poly(d, cx, cy, 74, 8, post_rgb, rot=math.pi / 8, ink_w=6)
        draw_aether_orb(im, cx, cy, 52, glow_rgb, cage_rgb=BRASS_GOLD, n_ribs=6, glow_r=2.15)
    elif style == "gatepost_cap":
        draw_beveled_rect(d, cx - 68, cy - 68, cx + 68, cy + 68, STONE, ink_w=6, radius=6)
        draw_beveled_rect(d, cx - 48, cy - 48, cx + 48, cy + 48, BRASS, ink_w=5, radius=6)
        draw_beveled_rect(d, cx - 36, cy - 36, cx + 36, cy + 36, (255, 232, 162), ink_w=3, radius=4)
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            d.line([(cx, cy), (cx + sx * 46, cy + sy * 46)], fill=INK, width=8)
            d.line([(cx, cy), (cx + sx * 46, cy + sy * 46)], fill=(*BRASS_GOLD, 255), width=4)
        draw_metal_disc(d, cx, cy, 16, BRASS_GOLD, ink_w=3, ring_detail=False)
    elif style == "garden_stone":
        # Mossy carved stone garden shrine lantern (warm glow peeking out from beneath stone pagoda roof!)
        draw_metal_poly(d, cx, cy, 62, 6, (124, 128, 118), rot=0, ink_w=6)
        # Warm light peeking around carved stone window slits
        for i in range(6):
            ang = i * math.tau / 6 + math.pi / 6
            gx, gy = cx + math.cos(ang) * 48, cy + math.sin(ang) * 48
            d.ellipse([gx - 12, gy - 12, gx + 12, gy + 12], fill=(255, 214, 118, 255))
        draw_metal_poly(d, cx, cy, 52, 6, (144, 146, 134), rot=0, ink_w=5)
        # Subtle moss tufts on stone roof
        for mx, my, mr in ((-26, -18, 12), (22, 16, 10), (-14, 24, 9)):
            d.ellipse([cx + mx - mr, cy + my - mr, cx + mx + mr, cy + my + mr], fill=(88, 126, 68, 255), outline=INK_MID, width=2)
        draw_metal_disc(d, cx, cy, 18, (158, 156, 144), ink_w=4, ring_detail=False)
    elif style == "colorable_post":
        draw_metal_poly(d, cx, cy, 72, 8, IRON_DARK, rot=math.pi / 8, ink_w=6)
        d.ellipse([cx - 52, cy - 52, cx + 52, cy + 52], fill=(*DD_RED_DEEP, 255), outline=INK, width=5)
        d.ellipse([cx - 42, cy - 42, cx + 42, cy + 42], fill=(*DD_RED_BASE, 255))
        d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(*DD_RED_HI, 255))
        for i in range(6):
            ang = i * math.tau / 6
            d.line([(cx + math.cos(ang) * 16, cy + math.sin(ang) * 16), (cx + math.cos(ang) * 54, cy + math.sin(ang) * 54)], fill=INK, width=7)
            d.line([(cx + math.cos(ang) * 16, cy + math.sin(ang) * 16), (cx + math.cos(ang) * 54, cy + math.sin(ang) * 54)], fill=(*IRON, 255), width=3)
        draw_metal_disc(d, cx, cy, 16, IRON_DARK, ink_w=4, ring_detail=False)

    return apply_painterly_finish(im, w, h, seed=seed, grain=4.2)


# =============================================================================
# MASTER CATALOG SPECIFICATION (5 LEGACY UPGRADES + 85 NEW HARMONY LIGHTING)
# =============================================================================
def build_all() -> None:
    print("=== Dice Chaos Maps: Building 90 True Top-Down Lighting Assets ===")

    # -------------------------------------------------------------------------
    # A. 5 LEGACY SIDE-ELEVATION ASSETS UPGRADED IN-PLACE TO TRUE TOP-DOWN
    # -------------------------------------------------------------------------
    legacy_upgrades: list[tuple[str, Image.Image, str]] = [
        (
            "props/funeral/fun_tall_candelabra.png",
            gen_floor_candelabra(192, 192, 9001, IRON, IRON_DARK, n_arms=5, tripod=True),
            "UPG fun_tall_candelabra",
        ),
        (
            "props/post_office/po_green_banker_lamp.png",
            gen_table_banker_lamp(160, 160, 9002, (42, 146, 86), (176, 242, 148)),
            "UPG po_green_banker_lamp",
        ),
        (
            "props/funeral/fun_cemetery_lantern.png",
            gen_street_lamp(160, 160, 9003, "gothic_post", IRON_DARK, GLOW_WARM),
            "UPG fun_cemetery_lantern",
        ),
        (
            "props/armory_dungeon/arm_wall_torch_sconce.png",
            gen_wall_sconce(160, 160, 9004, "torch", IRON, GLOW_FIRE),
            "UPG arm_wall_torch_sconce",
        ),
        (
            "props/music_theater_tea/tea_silver_candelabra.png",
            gen_table_candelabra(160, 160, 9005, SILVER, n_arms=4),
            "UPG tea_silver_candelabra",
        ),
    ]

    qa_legacy: list[tuple[str, Image.Image]] = []
    manifest_updates: list[dict] = []
    existing_manifest = None
    mpath = MOD_DIR / "manifest.json"
    import json
    mdata = json.loads(mpath.read_text(encoding="utf-8"))
    by_path = {a["path"]: a for a in mdata.get("assets", [])}

    for rel, im, lbl in legacy_upgrades:
        out_p = MOD_DIR / rel
        im.save(out_p, "PNG")
        qa_legacy.append((lbl, im))
        if rel in by_path:
            entry = dict(by_path[rel])
            entry.pop("width", None)
            entry.pop("height", None)
            entry.pop("name", None)
            entry["widthPx"] = im.width
            entry["heightPx"] = im.height
            entry["dominantHex"] = dominant_hex(im)
            manifest_updates.append(entry)
    print(f"  Upgraded {len(legacy_upgrades)} legacy side-view lighting assets in-place to true top-down!")

    # -------------------------------------------------------------------------
    # B. 85 BRAND-NEW UNIQUE TOP-DOWN LIGHTING FIXTURES
    # -------------------------------------------------------------------------
    new_specs: list[tuple[str, str, list[str], str, Image.Image]] = []

    def add(stem: str, name: str, tags: list[str], im: Image.Image, draw_mode: str = "normal") -> None:
        new_specs.append((stem, name, tags, draw_mode, im))

    # --- 1. FLOOR-STANDING LAMPS & CANDELABRAS (16) ---
    add("lgt_floor_cathedral_candelabra_brass", "Cathedral Brass Standing Floor Candelabra",
        ["light", "lighting", "floor_lamp", "candelabra", "candle", "cathedral", "brass", "harmony"],
        gen_floor_candelabra(192, 192, 101, BRASS_GOLD, MARBLE, n_arms=6, tripod=False))
    add("lgt_floor_cathedral_candelabra_iron", "Monastic Wrought-Iron Crimson-Candle Floor Candelabra",
        ["light", "lighting", "floor_lamp", "candelabra", "candle", "cathedral", "dungeon", "iron", "harmony"],
        gen_floor_candelabra(192, 192, 102, IRON, OBSIDIAN, n_arms=6, wax_rgb=(176, 46, 52), tripod=False))
    add("lgt_floor_sovereign_aether_torchiere", "Sovereign Obsidian Violet Aether Torchiere",
        ["light", "lighting", "floor_lamp", "torchiere", "aether", "magipunk", "cathedral", "sovereign", "violet", "harmony"],
        gen_floor_aether_standard(192, 192, 103, OBSIDIAN, BRASS_GOLD, GLOW_VIOLET, octagonal=True))
    add("lgt_floor_aether_cyan_standard", "Magipunk Cyan Aether Standing Floor Lamp",
        ["light", "lighting", "floor_lamp", "aether", "magipunk", "cyan", "berlin", "brass", "harmony"],
        gen_floor_aether_standard(192, 192, 104, IRON_DARK, BRASS, GLOW_CYAN, octagonal=True))
    add("lgt_floor_paschal_altar_pillar", "Cathedral Paschal Altar Floor Candle Stand",
        ["light", "lighting", "floor_lamp", "candle", "altar", "cathedral", "temple", "brass", "harmony"],
        gen_floor_paschal_pillar(192, 192, 105))
    add("lgt_floor_votive_stand_brass", "Cathedral Brass Floor Votive Candle Stand",
        ["light", "lighting", "floor_lamp", "candle", "votive", "cathedral", "temple", "shrine", "harmony"],
        gen_floor_votive_stand(192, 192, 106))
    add("lgt_floor_parlor_pleated_cream", "Victorian Cream Pleated Standing Floor Lamp",
        ["light", "lighting", "floor_lamp", "parlor", "home", "apartment", "berlin", "victorian", "harmony"],
        gen_floor_shaded_lamp(192, 192, 107, (226, 206, 168), BRASS_GOLD, BRASS_AGED, GLOW_WARM, style="pleated"))
    add("lgt_floor_parlor_fringed_crimson", "Crimson Fringed Parlor Standing Floor Lamp",
        ["light", "lighting", "floor_lamp", "parlor", "home", "manor", "victorian", "crimson", "harmony"],
        gen_floor_shaded_lamp(192, 192, 108, (168, 46, 54), BRASS_GOLD, WALNUT, GLOW_WARM, style="fringed"))
    add("lgt_floor_tiffany_stained_lamp", "Tiffany Stained-Glass Standing Floor Lamp",
        ["light", "lighting", "floor_lamp", "tiffany", "stained_glass", "parlor", "opera", "berlin", "harmony"],
        gen_floor_shaded_lamp(192, 192, 109, (218, 166, 62), BRONZE, BRONZE, GLOW_WARM, style="tiffany"))
    add("lgt_floor_jugendstil_torchiere", "Berlin Jugendstil Alabaster Floor Torchiere",
        ["light", "lighting", "floor_lamp", "torchiere", "berlin", "parlor", "brass", "home", "harmony"],
        gen_floor_shaded_lamp(192, 192, 110, (244, 232, 202), BRASS_GOLD, BRASS, GLOW_CREAM, style="torchiere"))
    add("lgt_floor_brass_reading_lamp", "Library Arched Brass Reading Floor Lamp",
        ["light", "lighting", "floor_lamp", "reading", "library", "study", "brass", "home", "harmony"],
        gen_floor_arc_or_reading(192, 192, 111, industrial=False))
    add("lgt_floor_industrial_arc_lamp", "Studio Steel Articulated Floor Work Lamp",
        ["light", "lighting", "floor_lamp", "industrial", "workshop", "studio", "apartment", "iron", "harmony"],
        gen_floor_arc_or_reading(192, 192, 112, industrial=True))
    add("lgt_floor_tavern_iron_tripod", "Tavern Forged-Iron Tripod Lantern Stand",
        ["light", "lighting", "floor_lamp", "lantern", "tripod", "tavern", "camp", "iron", "harmony"],
        gen_floor_iron_tripod_lantern(192, 192, 113))
    add("lgt_floor_arcane_crystal_stand", "Arcane Bronze Tripod Turquoise Orb Stand",
        ["light", "lighting", "floor_lamp", "arcane", "crystal", "orb", "wizard", "magipunk", "harmony"],
        gen_floor_aether_standard(192, 192, 114, WALNUT, BRONZE, GLOW_EMERALD, octagonal=False))
    add("lgt_floor_colorable_parlor_lamp", "Colorable Scalloped Parlor Floor Lamp",
        ["light", "lighting", "floor_lamp", "colorable", "dd_red", "parlor", "home", "harmony"],
        gen_floor_shaded_lamp(192, 192, 115, DD_RED_BASE, BRASS_GOLD, BRASS_AGED, GLOW_WARM, style="fringed", colorable=True),
        draw_mode="dd_red")
    add("lgt_floor_colorable_aether_torch", "Colorable Obsidian Aether Floor Pedestal",
        ["light", "lighting", "floor_lamp", "colorable", "dd_red", "aether", "magipunk", "arcane", "harmony"],
        gen_floor_aether_standard(192, 192, 116, OBSIDIAN, BRASS_GOLD, DD_RED_BASE, octagonal=True, colorable=True),
        draw_mode="dd_red")

    # --- 2. WALL-MOUNTED SCONCES & EXTERIOR BRACKETS (16) ---
    add("lgt_sconce_cathedral_brass_twin", "Cathedral Brass Twin-Candle Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "candle", "cathedral", "brass", "harmony"],
        gen_wall_sconce(160, 160, 201, "twin_candle", BRASS_GOLD, GLOW_CANDLE))
    add("lgt_sconce_cathedral_iron_triple", "Sanctuary Iron Triple-Candle Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "candle", "cathedral", "castle", "iron", "harmony"],
        gen_wall_sconce(160, 160, 202, "triple_candle", IRON, GLOW_CANDLE))
    add("lgt_sconce_berlin_jugendstil_gas", "Berlin Jugendstil Glass Gaslight Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "gaslight", "hallway", "apartment", "berlin", "harmony"],
        gen_wall_sconce(160, 160, 203, "gas_globe", BRASS, GLOW_WARM))
    add("lgt_sconce_aether_cyan_bracket", "Magipunk Cyan Aether Caged Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "aether", "magipunk", "cyan", "corridor", "harmony"],
        gen_wall_sconce(160, 160, 204, "aether_cage", BRASS, GLOW_CYAN))
    add("lgt_sconce_aether_violet_sovereign", "Sovereign Obsidian Violet Crystal Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "aether", "sovereign", "violet", "cathedral", "harmony"],
        gen_wall_sconce(160, 160, 205, "aether_prism", BRASS_GOLD, GLOW_VIOLET))
    add("lgt_sconce_aether_amber_conduit", "Industrial Amber Aether Filament Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "aether", "industrial", "brass", "amber", "harmony"],
        gen_wall_sconce(160, 160, 206, "aether_cage", COPPER, GLOW_WARM))
    add("lgt_sconce_caged_bulkhead_brass", "Brass Caged Bathhouse & Ship Bulkhead Lamp",
        ["light", "lighting", "wall_sconce", "sconce", "bulkhead", "bathhouse", "ship", "brass", "harmony"],
        gen_wall_sconce(160, 160, 207, "bulkhead", BRASS, GLOW_WARM))
    add("lgt_sconce_caged_bulkhead_iron", "Cast-Iron Factory & Sewer Bulkhead Wall Lamp",
        ["light", "lighting", "wall_sconce", "sconce", "bulkhead", "industrial", "factory", "iron", "harmony"],
        gen_wall_sconce(160, 160, 208, "bulkhead", IRON, GLOW_CREAM))
    add("lgt_sconce_storefront_gooseneck", "Storefront Enamel Gooseneck Wall Lamp",
        ["light", "lighting", "wall_sconce", "sconce", "shop", "cafe", "exterior", "berlin", "harmony"],
        gen_wall_sconce(160, 160, 209, "gooseneck", BRASS, GLOW_WARM))
    add("lgt_sconce_alley_gas_bracket", "Berlin Alley Cast-Iron Gaslight Wall Bracket",
        ["light", "lighting", "wall_sconce", "sconce", "alley", "street", "exterior", "gaslight", "harmony"],
        gen_wall_sconce(160, 160, 210, "alley_hex", IRON_DARK, GLOW_WARM))
    add("lgt_sconce_tavern_lantern_hook", "Tavern Wrought-Iron Hook Wall Lantern",
        ["light", "lighting", "wall_sconce", "sconce", "lantern", "tavern", "inn", "exterior", "harmony"],
        gen_wall_sconce(160, 160, 211, "tavern_hook", IRON, GLOW_WARM))
    add("lgt_sconce_dungeon_iron_brazier", "Fortress Iron Fire-Basket Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "brazier", "dungeon", "castle", "fire", "harmony"],
        gen_wall_sconce(160, 160, 212, "brazier_wall", IRON_DARK, GLOW_FIRE))
    add("lgt_sconce_manor_crystal_wall", "Manor Cut-Crystal Twin Parlor Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "crystal", "manor", "palace", "parlor", "harmony"],
        gen_wall_sconce(160, 160, 213, "crystal_twin", BRASS_GOLD, GLOW_CREAM))
    add("lgt_sconce_oil_reflector_wall", "Tenement Tin-Reflector Wall Oil Lamp",
        ["light", "lighting", "wall_sconce", "sconce", "oil_lamp", "tenement", "cottage", "home", "harmony"],
        gen_wall_sconce(160, 160, 214, "oil_reflector", BRONZE, GLOW_WARM))
    add("lgt_sconce_colorable_glass_globe", "Colorable Brass Glass-Globe Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "colorable", "dd_red", "brass", "harmony"],
        gen_wall_sconce(160, 160, 215, "colorable_globe", BRASS, DD_RED_BASE, colorable=True),
        draw_mode="dd_red")
    add("lgt_sconce_colorable_arcane_crystal", "Colorable Arcane Crystal Wall Sconce",
        ["light", "lighting", "wall_sconce", "sconce", "colorable", "dd_red", "arcane", "crystal", "harmony"],
        gen_wall_sconce(160, 160, 216, "colorable_crystal", IRON, DD_RED_BASE, colorable=True),
        draw_mode="dd_red")

    # --- 3. CEILING CHANDELIERS & HANGING PENDANTS (16) ---
    add("lgt_ceiling_sovereign_gilded_chandelier", "Sovereign Gilded Double-Tier Cathedral Chandelier",
        ["light", "lighting", "ceiling", "chandelier", "cathedral", "sovereign", "brass", "magipunk", "harmony"],
        gen_ceiling_chandelier(256, 256, 301, "sovereign", BRASS_GOLD, n_lights=12, glow_rgb=GLOW_WARM))
    add("lgt_ceiling_gothic_bronze_wheel", "Gothic Cast-Bronze Nave Wheel Chandelier",
        ["light", "lighting", "ceiling", "chandelier", "cathedral", "castle", "bronze", "harmony"],
        gen_ceiling_chandelier(256, 256, 302, "gothic", BRONZE, n_lights=8, glow_rgb=GLOW_CANDLE))
    add("lgt_ceiling_banquet_brass_chandelier", "Refectory 6-Arm Brass Globe Chandelier",
        ["light", "lighting", "ceiling", "chandelier", "dining", "banquet", "brass", "manor", "harmony"],
        gen_ceiling_chandelier(224, 224, 303, "banquet", BRASS, n_lights=6, glow_rgb=GLOW_WARM))
    add("lgt_ceiling_crystal_palace_chandelier", "Opera & Palace Starburst Crystal Chandelier",
        ["light", "lighting", "ceiling", "chandelier", "crystal", "palace", "manor", "opera", "harmony"],
        gen_ceiling_chandelier(256, 256, 304, "crystal", BRASS_GOLD, n_lights=10, glow_rgb=GLOW_CREAM))
    add("lgt_ceiling_aether_ring_chandelier", "Magipunk Dynamo Cyan Aether-Ring Chandelier",
        ["light", "lighting", "ceiling", "chandelier", "aether", "magipunk", "cyan", "berlin", "harmony"],
        gen_ceiling_chandelier(256, 256, 305, "aether_ring", BRASS, n_lights=8, glow_rgb=GLOW_CYAN))
    add("lgt_ceiling_tavern_wagon_wheel", "Tavern Oak Wagon-Wheel Candle Chandelier",
        ["light", "lighting", "ceiling", "chandelier", "tavern", "inn", "wood", "candle", "harmony"],
        gen_ceiling_chandelier(256, 256, 306, "wagon_wheel", IRON, n_lights=8, glow_rgb=GLOW_CANDLE))
    add("lgt_ceiling_cafe_milkglass_pendant", "Berlin Cafe Milk-Glass Ceiling Pendant",
        ["light", "lighting", "ceiling", "pendant", "cafe", "shop", "parlor", "berlin", "harmony"],
        gen_ceiling_pendant(176, 176, 307, "milkglass", (244, 236, 214), BRASS_GOLD, GLOW_CREAM))
    add("lgt_ceiling_victorian_amber_pendant", "Victorian Honey-Amber Glass Ceiling Pendant",
        ["light", "lighting", "ceiling", "pendant", "parlor", "victorian", "dining", "home", "harmony"],
        gen_ceiling_pendant(176, 176, 308, "leaded_glass", (226, 168, 62), BRASS, GLOW_WARM))
    add("lgt_ceiling_billiard_green_pendant", "Emerald Green Card-Table & Library Pendant",
        ["light", "lighting", "ceiling", "pendant", "library", "parlor", "tavern", "green", "harmony"],
        gen_ceiling_pendant(176, 176, 309, "leaded_glass", (46, 142, 88), BRASS_GOLD, (186, 242, 156)))
    add("lgt_ceiling_tiffany_stained_pendant", "Tiffany Stained-Glass Dining Dome Pendant",
        ["light", "lighting", "ceiling", "pendant", "tiffany", "stained_glass", "dining", "berlin", "harmony"],
        gen_ceiling_pendant(176, 176, 310, "tiffany", (224, 168, 56), BRONZE, GLOW_WARM))
    add("lgt_ceiling_parlor_pleated_pendant", "Cozy Pleated Fabric Family Dining Pendant",
        ["light", "lighting", "ceiling", "pendant", "home", "dining", "apartment", "family", "harmony"],
        gen_ceiling_pendant(176, 176, 311, "pleated", (232, 202, 164), BRASS_GOLD, GLOW_WARM))
    add("lgt_ceiling_enamel_workshop_pendant", "Industrial Teal Enamel Workshop Pendant",
        ["light", "lighting", "ceiling", "pendant", "industrial", "workshop", "factory", "tenement", "harmony"],
        gen_ceiling_pendant(176, 176, 312, "enamel_dome", (44, 104, 96), BRASS_AGED, GLOW_CREAM))
    add("lgt_ceiling_copper_kitchen_pendant", "Hammered Copper Kitchen & Bakery Pendant",
        ["light", "lighting", "ceiling", "pendant", "kitchen", "bakery", "copper", "home", "harmony"],
        gen_ceiling_pendant(176, 176, 313, "enamel_dome", COPPER, BRASS, GLOW_WARM))
    add("lgt_ceiling_iron_dome_pendant", "Monastic Octagonal Iron Dormitory Pendant",
        ["light", "lighting", "ceiling", "pendant", "cathedral", "dormitory", "dungeon", "iron", "harmony"],
        gen_ceiling_pendant(176, 176, 314, "iron_hood", IRON, IRON_DARK, GLOW_WARM))
    add("lgt_ceiling_colorable_shade_pendant", "Colorable Brass-Rim Hanging Ceiling Pendant",
        ["light", "lighting", "ceiling", "pendant", "colorable", "dd_red", "home", "harmony"],
        gen_ceiling_pendant(176, 176, 315, "colorable", DD_RED_BASE, BRASS_GOLD, GLOW_WARM, colorable=True),
        draw_mode="dd_red")
    add("lgt_ceiling_colorable_crystal_chandelier", "Colorable 6-Arm Brass & Crystal Chandelier",
        ["light", "lighting", "ceiling", "chandelier", "colorable", "dd_red", "manor", "harmony"],
        gen_ceiling_chandelier(224, 224, 316, "banquet", BRASS_GOLD, n_lights=6, glow_rgb=DD_RED_BASE, colorable=True),
        draw_mode="dd_red")

    # --- 4. TABLETOP, DESK & BEDSIDE LAMPS (16) ---
    add("lgt_table_banker_amber_desk", "Amber Cased-Glass Banker's Desk Lamp",
        ["light", "lighting", "table_lamp", "desk_lamp", "study", "office", "library", "brass", "harmony"],
        gen_table_banker_lamp(144, 144, 401, (224, 152, 48), GLOW_WARM))
    add("lgt_table_banker_crimson_desk", "Ruby Crimson Banker's Study Desk Lamp",
        ["light", "lighting", "table_lamp", "desk_lamp", "study", "manor", "library", "crimson", "harmony"],
        gen_table_banker_lamp(144, 144, 402, (186, 48, 56), (255, 168, 128)))
    add("lgt_table_articulated_brass_lamp", "Articulated Brass Workbench Clamp Lamp",
        ["light", "lighting", "table_lamp", "desk_lamp", "workbench", "tinkerer", "industrial", "brass", "harmony"],
        gen_table_articulated_lamp(144, 144, 403))
    add("lgt_table_bedside_cream_lamp", "Cream Linen Nightstand Bedside Lamp",
        ["light", "lighting", "table_lamp", "bedside_lamp", "bedroom", "home", "apartment", "harmony"],
        gen_table_bedside_lamp(144, 144, 404, (234, 218, 186), BRASS_GOLD, GLOW_WARM, style="pleated"))
    add("lgt_table_bedside_rose_lamp", "Dusty-Rose Scalloped Nursery Bedside Lamp",
        ["light", "lighting", "table_lamp", "bedside_lamp", "bedroom", "nursery", "home", "harmony"],
        gen_table_bedside_lamp(144, 144, 405, (206, 126, 134), BRASS_GOLD, (255, 202, 164), style="scalloped"))
    add("lgt_table_bedside_amber_lamp", "Warm Ochre Bedside Nightstand Lamp",
        ["light", "lighting", "table_lamp", "bedside_lamp", "bedroom", "home", "apartment", "harmony"],
        gen_table_bedside_lamp(144, 144, 406, (222, 168, 76), BRONZE, GLOW_WARM, style="pleated"))
    add("lgt_table_tiffany_sovereign_lamp", "Sovereign Tiffany Stained-Glass Study Lamp",
        ["light", "lighting", "table_lamp", "desk_lamp", "tiffany", "stained_glass", "study", "manor", "harmony"],
        gen_table_bedside_lamp(144, 144, 407, (172, 92, 224), BRASS_GOLD, (234, 186, 255), style="tiffany"))
    add("lgt_table_hurricane_oil_lamp", "Victorian Brass Hurricane Kerosene Lamp",
        ["light", "lighting", "table_lamp", "oil_lamp", "bedside_lamp", "tenement", "home", "brass", "harmony"],
        gen_table_hurricane_oil(144, 144, 408, spirit=False))
    add("lgt_table_aether_cyan_desk", "Magipunk Cyan Caged Aether Desk Lamp",
        ["light", "lighting", "table_lamp", "desk_lamp", "aether", "magipunk", "cyan", "berlin", "harmony"],
        gen_table_aether_lamp(144, 144, 409, GLOW_CYAN, IRON_DARK))
    add("lgt_table_aether_violet_lamp", "Arcane Obsidian Violet Crystal Desk Lamp",
        ["light", "lighting", "table_lamp", "desk_lamp", "aether", "arcane", "violet", "study", "harmony"],
        gen_table_aether_lamp(144, 144, 410, GLOW_VIOLET, OBSIDIAN))
    add("lgt_table_brass_candelabra_triple", "Gilded Brass Tabletop Banquet Candelabra",
        ["light", "lighting", "table_lamp", "candelabra", "candle", "dining", "altar", "brass", "harmony"],
        gen_table_candelabra(144, 144, 411, BRASS_GOLD, n_arms=3))
    add("lgt_table_beeswax_saucer_cluster", "Melted Beeswax Pillar Candles on Saucer",
        ["light", "lighting", "table_lamp", "candle", "study", "tavern", "home", "ritual", "harmony"],
        gen_table_candle_saucer(144, 144, 412, bottle=False))
    add("lgt_table_tavern_wine_bottle_candle", "Dripping Tavern Wine-Bottle Tallow Candle",
        ["light", "lighting", "table_lamp", "candle", "tavern", "inn", "tenement", "clutter", "harmony"],
        gen_table_candle_saucer(144, 144, 413, bottle=True))
    add("lgt_table_apothecaries_spirit_lamp", "Apothecary Emerald Alchemical Spirit Lamp",
        ["light", "lighting", "table_lamp", "alchemy", "apothecary", "infirmary", "emerald", "harmony"],
        gen_table_hurricane_oil(144, 144, 414, spirit=True))
    add("lgt_table_colorable_bedside_lamp", "Colorable Scalloped Bedside Table Lamp",
        ["light", "lighting", "table_lamp", "bedside_lamp", "colorable", "dd_red", "home", "harmony"],
        gen_table_bedside_lamp(144, 144, 415, DD_RED_BASE, BRASS_GOLD, GLOW_WARM, style="colorable", colorable=True),
        draw_mode="dd_red")
    add("lgt_table_colorable_arcane_lamp", "Colorable Brass Arcane Crystal Desk Lamp",
        ["light", "lighting", "table_lamp", "desk_lamp", "colorable", "dd_red", "arcane", "aether", "harmony"],
        gen_table_aether_lamp(144, 144, 416, DD_RED_BASE, IRON_DARK, colorable=True),
        draw_mode="dd_red")

    # --- 5. BRAZIERS, FIRE-BOWLS & PORTABLE LANTERNS (10) ---
    add("lgt_brazier_bronze_temple_tripod", "Cathedral Bronze Tripod Fire Brazier",
        ["light", "lighting", "brazier", "fire", "cathedral", "temple", "bronze", "harmony"],
        gen_brazier(192, 192, 501, BRONZE, BRASS_GOLD, (226, 72, 22), (255, 162, 42), (255, 244, 174), tripod=True))
    add("lgt_brazier_sovereign_violet_fire", "Sovereign Obsidian Violet-Flame Brazier",
        ["light", "lighting", "brazier", "fire", "sovereign", "violet", "arcane", "cathedral", "harmony"],
        gen_brazier(192, 192, 502, OBSIDIAN, BRASS_GOLD, (124, 42, 206), (186, 102, 255), (242, 218, 255), tripod=True))
    add("lgt_brazier_cyan_aether_basin", "Stone & Brass Cyan Aether-Flame Basin",
        ["light", "lighting", "brazier", "aether", "cyan", "magipunk", "temple", "harmony"],
        gen_brazier(192, 192, 503, BRASS_AGED, BRASS_GOLD, (24, 148, 214), (82, 222, 255), (222, 252, 255), tripod=False))
    add("lgt_brazier_iron_coal_basket", "Market & Courtyard Iron Coal-Basket Brazier",
        ["light", "lighting", "brazier", "fire", "street", "market", "courtyard", "iron", "harmony"],
        gen_brazier(192, 192, 504, IRON_DARK, IRON, (214, 58, 22), (255, 134, 38), (255, 224, 128), tripod=True))
    add("lgt_brazier_colorable_ritual_fire", "Colorable Iron Ritual Flame Brazier",
        ["light", "lighting", "brazier", "fire", "colorable", "dd_red", "arcane", "ritual", "harmony"],
        gen_brazier(192, 192, 505, IRON_DARK, BRASS, DD_RED_DEEP, DD_RED_BASE, DD_RED_HI, tripod=True, colorable=True),
        draw_mode="dd_red")
    add("lgt_lantern_railroad_brass", "Berlin Railroad Wire-Caged Brass Lantern",
        ["light", "lighting", "lantern", "portable", "train", "station", "brass", "berlin", "harmony"],
        gen_portable_lantern(144, 144, 506, "railroad"))
    add("lgt_lantern_hooded_iron", "Smuggler & Watchman Hooded Iron Lantern",
        ["light", "lighting", "lantern", "portable", "smuggler", "dungeon", "alley", "iron", "harmony"],
        gen_portable_lantern(144, 144, 507, "hooded_iron"))
    add("lgt_lantern_brass_camp", "Hexagonal Brass Camp & Picnic Lantern",
        ["light", "lighting", "lantern", "portable", "camp", "park", "picnic", "brass", "harmony"],
        gen_portable_lantern(144, 144, 508, "camp_hex"))
    add("lgt_lantern_aether_portable", "Portable Caged Cyan Aether Hand-Lantern",
        ["light", "lighting", "lantern", "portable", "aether", "cyan", "magipunk", "harmony"],
        gen_portable_lantern(144, 144, 509, "aether_portable"))
    add("lgt_lantern_paper_crimson_festival", "Crimson Ribbed Paper Festival Lantern",
        ["light", "lighting", "lantern", "festival", "courtyard", "cafe", "crimson", "harmony"],
        gen_portable_lantern(160, 160, 510, "paper_crimson"))

    # --- 6. EXTERIOR STREET, PARK, COURTYARD & GATE LIGHTS (11) ---
    add("lgt_street_berlin_double_globe", "Berlin Boulevard Double-Globe Gaslamp",
        ["light", "lighting", "street_lamp", "exterior", "berlin", "boulevard", "gaslight", "harmony"],
        gen_street_lamp(192, 192, 601, "double_globe", IRON_DARK, GLOW_WARM))
    add("lgt_street_berlin_single_gas", "Berlin Cast-Iron Single Street Gaslamp",
        ["light", "lighting", "street_lamp", "exterior", "berlin", "street", "gaslight", "harmony"],
        gen_street_lamp(192, 192, 602, "single_hex", IRON_DARK, GLOW_WARM))
    add("lgt_street_gothic_iron_post", "Cathedral Precinct Gothic Iron Post Lantern",
        ["light", "lighting", "street_lamp", "exterior", "cathedral", "gothic", "iron", "harmony"],
        gen_street_lamp(192, 192, 603, "gothic_post", IRON_DARK, GLOW_WARM))
    add("lgt_street_park_bollard_lamp", "Kiezpark Cast-Iron Path Bollard Light",
        ["light", "lighting", "street_lamp", "exterior", "park", "garden", "bollard", "harmony"],
        gen_street_lamp(160, 160, 604, "park_bollard", IRON_DARK, GLOW_WARM))
    add("lgt_street_courtyard_pillar_lantern", "Hinterhof Sandstone Courtyard Pillar Lantern",
        ["light", "lighting", "street_lamp", "exterior", "courtyard", "yard", "stone", "berlin", "harmony"],
        gen_street_lamp(176, 176, 605, "courtyard_pillar", IRON_DARK, GLOW_WARM))
    add("lgt_street_aether_cyan_post", "Magipunk Cyan Boulevard Aether Streetlamp",
        ["light", "lighting", "street_lamp", "exterior", "aether", "cyan", "magipunk", "berlin", "harmony"],
        gen_street_lamp(192, 192, 606, "aether_post", IRON_DARK, GLOW_CYAN))
    add("lgt_street_aether_amber_post", "Magipunk Amber Brass Boulevard Aether Lamp",
        ["light", "lighting", "street_lamp", "exterior", "aether", "amber", "magipunk", "berlin", "harmony"],
        gen_street_lamp(192, 192, 607, "aether_post", BRONZE, GLOW_WARM))
    add("lgt_street_aether_violet_sovereign", "Sovereign Precinct Obsidian Violet Streetlamp",
        ["light", "lighting", "street_lamp", "exterior", "aether", "violet", "sovereign", "cathedral", "harmony"],
        gen_street_lamp(192, 192, 608, "aether_post", OBSIDIAN, GLOW_VIOLET))
    add("lgt_street_gatepost_cap_lantern", "Stone Estate Gatepost Brass Cap Lantern",
        ["light", "lighting", "street_lamp", "exterior", "gate", "manor", "stone", "brass", "harmony"],
        gen_street_lamp(160, 160, 609, "gatepost_cap", STONE, GLOW_WARM))
    add("lgt_street_garden_stone_lantern", "Mossy Carved Stone Garden Shrine Lantern",
        ["light", "lighting", "street_lamp", "exterior", "garden", "park", "stone", "shrine", "harmony"],
        gen_street_lamp(160, 160, 610, "garden_stone", STONE, GLOW_WARM))
    add("lgt_street_colorable_post_lamp", "Colorable Cast-Iron Boulevard Lamp Post",
        ["light", "lighting", "street_lamp", "exterior", "colorable", "dd_red", "berlin", "harmony"],
        gen_street_lamp(192, 192, 611, "colorable_post", IRON_DARK, DD_RED_BASE, colorable=True),
        draw_mode="dd_red")

    # Save all 85 brand-new PNGs & build manifest entries
    qa_part1: list[tuple[str, Image.Image]] = list(qa_legacy)
    qa_part2: list[tuple[str, Image.Image]] = []

    for idx, (stem, name, tags, draw_mode, im) in enumerate(new_specs):
        rel = f"props/harmony_lighting/{stem}.png"
        out_p = MOD_DIR / rel
        im.save(out_p, "PNG")
        casts_shadow = not (stem.startswith("lgt_ceiling_") or stem.startswith("lgt_sconce_") or stem.startswith("lgt_table_"))
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
                "castsShadow": casts_shadow,
                "dominantHex": dominant_hex(im),
            }
        )
        short = stem.replace("lgt_", "")
        if idx < 43:
            qa_part1.append((short, im))
        else:
            qa_part2.append((short, im))

    total = upsert_manifest_entries(mpath, manifest_updates)
    print(f"  Generated {len(new_specs)} new unique top-down lighting fixtures in props/harmony_lighting/")
    print(f"  Updated {mpath} -> {total} total modular-suite-cc0 assets")

    save_qa_sheet(qa_part1, SCRATCH_DIR / "qa_lighting_suite_part1.png", cols=8, cw=172, ch=148)
    save_qa_sheet(qa_part2, SCRATCH_DIR / "qa_lighting_suite_part2.png", cols=8, cw=172, ch=148)


if __name__ == "__main__":
    build_all()

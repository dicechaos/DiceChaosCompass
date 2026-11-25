"""
Unified hand-inked painterly Berlin dark-magipunk CC0 Stair Suite generator & upgrader:
  - Upgrades ALL 15 early flat-vector stair assets in-place across starter-cc0,
    core-fantasy-cc0, and modular-suite-cc0 (preserving exact filenames & native ratios)
  - Creates 5 brand-new architectural stair stamps in modular-suite-cc0/props/stairs_architectural/
  - Renders a dark-checkerboard QA contact sheet of all 20 stairs
  - Updates manifest.json and repacks all affected .dcpack archives!

2x supersampled with deep charcoal ink outlines (#221C1A), beveled stone/oak/brass/iron
treads, realistic cast riser shadows, worn footstep patina, subtle gouache grain, and
100% clean alpha edges (zero white halos).
"""

import json
import math
import os
import random
import zipfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ASSETS_ROOT = Path("public/assets")
STARTER_DIR = ASSETS_ROOT / "starter-cc0"
CORE_DIR = ASSETS_ROOT / "core-fantasy-cc0"
MOD_DIR = ASSETS_ROOT / "modular-suite-cc0"
STAIRS_DIR = MOD_DIR / "props" / "stairs_architectural"
QA_PATH = Path(r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch\qa_all_stairs_upgraded.png")

INK = (30, 24, 22, 255)
INK_MED = (48, 40, 36, 255)
INK_SOFT = (66, 56, 48, 255)


def new_hi(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))


def finish(im: Image.Image, w: int, h: int, seed: int = 1, grain: float = 6.2) -> Image.Image:
    out = im.resize((w, h), Image.Resampling.LANCZOS)
    if grain > 0:
        arr = np.array(out, dtype=np.float32)
        mask = arr[:, :, 3] > 24
        rng = np.random.default_rng(seed)
        noise = rng.normal(0.0, grain, size=arr[:, :, 0].shape)
        for c in range(3):
            arr[:, :, c] = np.clip(arr[:, :, c] + noise * mask, 0, 255)
        out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    return out


def shade_col(rgb: tuple[int, int, int], factor: float) -> tuple[int, int, int, int]:
    return (
        max(0, min(255, int(rgb[0] * factor))),
        max(0, min(255, int(rgb[1] * factor))),
        max(0, min(255, int(rgb[2] * factor))),
        255,
    )


def blend_rgb(bg: tuple[int, int, int], fg: tuple[int, int, int], alpha: float) -> tuple[int, int, int, int]:
    return (
        max(0, min(255, int(bg[0] * (1.0 - alpha) + fg[0] * alpha))),
        max(0, min(255, int(bg[1] * (1.0 - alpha) + fg[1] * alpha))),
        max(0, min(255, int(bg[2] * (1.0 - alpha) + fg[2] * alpha))),
        255,
    )


def draw_wood_grain(d: ImageDraw.ImageDraw, x0: float, y0: float, x1: float, y1: float, base_rgb, rng: random.Random, vertical: bool = False):
    """Painterly wood grain lines + soft organic footstep wear (100% opaque alpha=255, no hard ovals!)."""
    dark = blend_rgb(base_rgb, (38, 24, 14), 0.30)
    dark_soft = blend_rgb(base_rgb, (52, 34, 20), 0.18)
    light_soft = blend_rgb(base_rgb, (224, 186, 134), 0.14)
    h = y1 - y0
    w = x1 - x0
    if not vertical:
        # Subtle multi-stroke central footstep sheen only on individual treads (skip wide landings!)
        if h < 110:
            mx = (x0 + x1) * 0.5
            for s in range(3):
                wy = y0 + h * (0.28 + s * 0.20) + rng.uniform(-2, 2)
                hw = w * rng.uniform(0.18, 0.28)
                d.line([(mx - hw, wy), (mx + hw, wy)], fill=light_soft, width=max(2, int(h * 0.14)))
        n_lines = max(4, int(h / 18))
        for _ in range(n_lines):
            gy = rng.uniform(y0 + 5, y1 - 5)
            d.line([(x0 + 5, gy), (x1 - 5, gy + rng.uniform(-2.5, 2.5))], fill=dark if rng.random() < 0.6 else dark_soft, width=2)
    else:
        n_lines = max(4, int(w / 18))
        for _ in range(n_lines):
            gx = rng.uniform(x0 + 5, x1 - 5)
            d.line([(gx, y0 + 5), (gx + rng.uniform(-2.5, 2.5), y1 - 5)], fill=dark if rng.random() < 0.6 else dark_soft, width=2)


def draw_stone_details(d: ImageDraw.ImageDraw, x0: float, y0: float, x1: float, y1: float, base_rgb, rng: random.Random, vertical: bool = False, moss: bool = False):
    """Painterly chiseled stone block joints, cracks & optional moss (100% opaque alpha=255!)."""
    dark = blend_rgb(base_rgb, (28, 26, 26), 0.42)
    hi_c = blend_rgb(base_rgb, (220, 218, 212), 0.32)
    moss_c = blend_rgb(base_rgb, (76, 108, 56), 0.62)
    if not vertical:
        for frac in (0.34 + rng.uniform(-0.06, 0.06), 0.68 + rng.uniform(-0.06, 0.06)):
            jx = x0 + (x1 - x0) * frac
            d.line([(jx, y0 + 2), (jx + rng.uniform(-3, 3), y1 - 2)], fill=dark, width=3)
            d.line([(jx + 3, y0 + 4), (jx + 3, y1 - 4)], fill=hi_c, width=2)
        d.line([(x0 + 4, y0 + 4), (x1 - 4, y0 + 4)], fill=hi_c, width=3)
        if rng.random() < 0.45:
            cx = rng.uniform(x0 + 20, x1 - 20)
            cy = rng.uniform(y0 + 6, y1 - 6)
            d.line([(cx, cy), (cx + rng.uniform(-14, 14), cy + rng.uniform(-8, 8))], fill=dark, width=2)
    else:
        for frac in (0.35 + rng.uniform(-0.07, 0.07), 0.70 + rng.uniform(-0.07, 0.07)):
            jy = y0 + (y1 - y0) * frac
            d.line([(x0 + 2, jy), (x1 - 2, jy + rng.uniform(-3, 3))], fill=dark, width=3)
            d.line([(x0 + 4, jy + 3), (x1 - 4, jy + 3)], fill=hi_c, width=2)
        d.line([(x0 + 4, y0 + 4), (x0 + 4, y1 - 4)], fill=hi_c, width=3)

    if moss and rng.random() < 0.4:
        mx = rng.choice([x0 + rng.uniform(6, 22), x1 - rng.uniform(6, 22)])
        my = rng.uniform(y0 + 6, y1 - 6)
        mr = rng.uniform(5, 11)
        d.ellipse([mx - mr, my - mr * 0.7, mx + mr, my + mr * 0.7], fill=moss_c)


# =============================================================================
# A. SEAMLESS PAINTERLY STAIR PATHS (horizontal strip: steps repeat along +X)
# =============================================================================
def gen_stair_path(w: int, h: int, style: str, seed: int) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    rng = random.Random(seed)
    W, H = w * 2, h * 2

    if style == "stone_dungeon":
        # Weathered Berlin dark-magipunk ashlar granite steps (warm cool-slate grey, chiseled blocks!)
        n_steps = 16
        step_w = W / n_steps
        rail_h = 26
        # Stone steps fill
        for i in range(n_steps):
            x0, x1 = i * step_w, (i + 1) * step_w
            v = rng.randint(-8, 8)
            base = (132 + v, 130 + v, 126 + v)
            d.rectangle([x0, rail_h, x1, H - rail_h], fill=(*base, 255))
            draw_stone_details(d, x0, rail_h, x1, H - rail_h, base, rng, vertical=True, moss=True)
            # Crisp beveled nose highlight + opaque riser drop shadow on right edge of each tread
            d.line([(x0 + 4, rail_h + 2), (x0 + 4, H - rail_h - 2)], fill=blend_rgb(base, (228, 224, 214), 0.30), width=4)
            d.rectangle([x1 - 14, rail_h, x1, H - rail_h], fill=blend_rgb(base, (24, 22, 24), 0.45))
            d.line([(x1, rail_h), (x1, H - rail_h)], fill=INK, width=4)
        # Carved weathered stone cheek parapets top & bottom
        for ry0, ry1 in [(4, rail_h), (H - rail_h, H - 4)]:
            d.rectangle([0, ry0, W, ry1], fill=(104, 104, 106, 255))
            d.line([(0, ry0), (W, ry0)], fill=INK, width=5)
            d.line([(0, ry1), (W, ry1)], fill=INK, width=5)
            d.line([(0, ry0 + 5), (W, ry0 + 5)], fill=blend_rgb((104, 104, 106), (206, 206, 204), 0.55), width=3)
            for bx in range(0, W, 128):
                d.line([(bx, ry0), (bx, ry1)], fill=(48, 46, 48, 255), width=4)

    elif style == "stone_retaining":
        # Prussian granite retaining steps (darker weathered charcoal-granite with iron edge rail)
        n_steps = 16
        step_w = W / n_steps
        rail_h = 24
        for i in range(n_steps):
            x0, x1 = i * step_w, (i + 1) * step_w
            v = rng.randint(-7, 7)
            base = (112 + v, 114 + v, 118 + v)
            d.rectangle([x0, rail_h, x1, H - rail_h], fill=(*base, 255))
            draw_stone_details(d, x0, rail_h, x1, H - rail_h, base, rng, vertical=True, moss=True)
            d.line([(x0 + 4, rail_h + 2), (x0 + 4, H - rail_h - 2)], fill=blend_rgb(base, (208, 212, 218), 0.28), width=4)
            d.rectangle([x1 - 12, rail_h, x1, H - rail_h], fill=blend_rgb(base, (20, 22, 28), 0.48))
            d.line([(x1, rail_h), (x1, H - rail_h)], fill=INK, width=4)
        for ry0, ry1 in [(4, rail_h), (H - rail_h, H - 4)]:
            d.rectangle([0, ry0, W, ry1], fill=(82, 86, 92, 255))
            d.line([(0, ry0), (W, ry0)], fill=INK, width=5)
            d.line([(0, ry1), (W, ry1)], fill=INK, width=5)
            d.line([(0, ry0 + 5), (W, ry0 + 5)], fill=blend_rgb((82, 86, 92), (176, 182, 190), 0.48), width=3)

    elif style == "timber_tavern":
        # Warm hand-inked planked oak stairs
        n_steps = 12
        step_w = W / n_steps
        rail_h = 26
        for i in range(n_steps):
            x0, x1 = i * step_w, (i + 1) * step_w
            v = rng.randint(-9, 9)
            base = (148 + v, 104 + v, 64 + v)
            d.rectangle([x0, rail_h, x1, H - rail_h], fill=(*base, 255))
            draw_wood_grain(d, x0, rail_h, x1, H - rail_h, base, rng, vertical=True)
            d.line([(x0 + 4, rail_h + 2), (x0 + 4, H - rail_h - 2)], fill=blend_rgb(base, (236, 196, 144), 0.28), width=4)
            d.rectangle([x1 - 14, rail_h, x1, H - rail_h], fill=blend_rgb(base, (32, 20, 12), 0.48))
            d.line([(x1, rail_h), (x1, H - rail_h)], fill=INK, width=4)
        for ry0, ry1 in [(4, rail_h), (H - rail_h, H - 4)]:
            d.rectangle([0, ry0, W, ry1], fill=(106, 70, 42, 255))
            d.line([(0, ry0), (W, ry0)], fill=INK, width=5)
            d.line([(0, ry1), (W, ry1)], fill=INK, width=5)
            d.line([(0, ry0 + 6), (W, ry0 + 6)], fill=blend_rgb((106, 70, 42), (206, 152, 98), 0.55), width=3)

    elif style == "marble_grand":
        # Veined warm alabaster marble & antique-brass sanctuary steps!
        n_steps = 14
        step_w = W / n_steps
        rail_h = 26
        for i in range(n_steps):
            x0, x1 = i * step_w, (i + 1) * step_w
            v = rng.randint(-5, 5)
            base = (224 + v, 218 + v, 204 + v)
            d.rectangle([x0, rail_h, x1, H - rail_h], fill=(*base, 255))
            # Soft opaque marble veining
            for _ in range(3):
                vx = rng.uniform(x0 + 8, x1 - 12)
                d.line([(vx, rail_h + 6), (vx + rng.uniform(-10, 10), H - rail_h - 6)], fill=blend_rgb(base, (158, 150, 138), 0.44), width=3)
            # Subtle brass stair nosing strip + cast shadow
            d.rectangle([x1 - 14, rail_h, x1 - 6, H - rail_h], fill=blend_rgb(base, (186, 150, 68), 0.86))
            d.rectangle([x1 - 6, rail_h, x1, H - rail_h], fill=blend_rgb(base, (44, 38, 32), 0.52))
            d.line([(x1, rail_h), (x1, H - rail_h)], fill=INK, width=4)
        for ry0, ry1 in [(4, rail_h), (H - rail_h, H - 4)]:
            d.rectangle([0, ry0, W, ry1], fill=(178, 146, 76, 255))
            d.line([(0, ry0), (W, ry0)], fill=INK, width=5)
            d.line([(0, ry1), (W, ry1)], fill=INK, width=5)
            d.line([(0, ry0 + 6), (W, ry0 + 6)], fill=blend_rgb((178, 146, 76), (244, 220, 146), 0.68), width=3)

    elif style == "iron_fire_escape":
        # Riveted Berlin dark wrought-iron industrial fire-escape steps
        n_steps = 16
        step_w = W / n_steps
        rail_h = 22
        d.rectangle([0, rail_h, W, H - rail_h], fill=(38, 44, 52, 255))
        for i in range(n_steps):
            x0, x1 = i * step_w, (i + 1) * step_w
            d.rectangle([x0 + 4, rail_h + 4, x1 - 4, H - rail_h - 4], fill=(82, 92, 102, 255), outline=INK, width=3)
            # Perforated iron grate dots
            for gy in range(rail_h + 18, H - rail_h - 14, 22):
                d.ellipse([x0 + 18, gy - 4, x1 - 18, gy + 4], fill=(34, 38, 44, 255))
            d.line([(x0 + 6, rail_h + 6), (x0 + 6, H - rail_h - 6)], fill=blend_rgb((82, 92, 102), (174, 188, 200), 0.58), width=3)
        for ry0, ry1 in [(4, rail_h), (H - rail_h, H - 4)]:
            d.rectangle([0, ry0, W, ry1], fill=(64, 72, 82, 255))
            d.line([(0, ry0), (W, ry0)], fill=INK, width=5)
            d.line([(0, ry1), (W, ry1)], fill=INK, width=5)
            for rx in range(32, W, 64):
                d.ellipse([rx - 5, (ry0 + ry1) / 2 - 5, rx + 5, (ry0 + ry1) / 2 + 5], fill=(156, 134, 82, 255), outline=INK, width=2)

    return finish(im, w, h, seed=seed, grain=5.8)


# =============================================================================
# B. SPIRAL STAIRCASES (Cathedral Brass/Stone, Arch Stone, Arch Wood)
# =============================================================================
def gen_spiral_stair(size: int, theme: str, seed: int) -> Image.Image:
    im = new_hi(size, size)
    d = ImageDraw.Draw(im, "RGBA")
    rng = random.Random(seed)
    S = size * 2
    cx, cy = S / 2.0, S / 2.0
    R_out = S * 0.46
    R_in = S * 0.135
    n_treads = 16 if theme == "cathedral_brass" else 14

    # Soft ground contact shadow under outer rim
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - R_out + 8, cy - R_out + 10, cx + R_out + 8, cy + R_out + 10], fill=(18, 14, 12, 95))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))

    # Deep stairwell base pit fill
    d.ellipse([cx - R_out, cy - R_out, cx + R_out, cy + R_out], fill=(28, 24, 24, 255), outline=INK, width=7)

    # 16 radial wedge treads stepping smoothly from sunlit upper landing down into shadow!
    start_ang = -math.pi / 2  # Top landing opens cleanly toward -Y (north/door!)
    for i in range(n_treads):
        # Depth shading: step 0 = highest/brightest, step n-1 = deepest shadow under top tread
        depth = 1.0 - (i / n_treads) * 0.56
        a0 = start_ang + (i / n_treads) * math.tau
        a1 = start_ang + ((i + 1) / n_treads) * math.tau
        if theme == "cathedral_brass":
            base = (158, 152, 142) if i % 2 == 0 else (148, 142, 134)
        elif theme == "stone":
            base = (146, 144, 138) if i % 2 == 0 else (136, 134, 128)
        else:
            base = (162, 114, 68) if i % 2 == 0 else (150, 104, 60)

        col = shade_col(base, depth)
        # Pie wedge polygon
        pts = [
            (cx + math.cos(a0) * R_in, cy + math.sin(a0) * R_in),
            (cx + math.cos(a0) * (R_out - 14), cy + math.sin(a0) * (R_out - 14)),
            (cx + math.cos((a0 + a1) * 0.5) * (R_out - 12), cy + math.sin((a0 + a1) * 0.5) * (R_out - 12)),
            (cx + math.cos(a1) * (R_out - 14), cy + math.sin(a1) * (R_out - 14)),
            (cx + math.cos(a1) * R_in, cy + math.sin(a1) * R_in),
        ]
        d.polygon(pts, fill=col, outline=INK)

        # Subtle wood grain or stone crack lines across wedge (100% opaque!)
        am = (a0 + a1) * 0.5
        if theme == "wood":
            d.line([
                (cx + math.cos(am) * (R_in + 12), cy + math.sin(am) * (R_in + 12)),
                (cx + math.cos(am) * (R_out - 24), cy + math.sin(am) * (R_out - 24)),
            ], fill=blend_rgb(col[:3], (36, 22, 12), 0.36), width=3)
        else:
            # Chiseled stone block line halfway out
            rm = (R_in + R_out) * 0.55
            d.line([
                (cx + math.cos(a0) * rm, cy + math.sin(a0) * rm),
                (cx + math.cos(a1) * rm, cy + math.sin(a1) * rm),
            ], fill=blend_rgb(col[:3], (26, 24, 24), 0.42), width=3)

        # Brass stair-nosing accent on Cathedral spiral!
        if theme == "cathedral_brass":
            d.line([
                (cx + math.cos(a0) * (R_in + 6), cy + math.sin(a0) * (R_in + 6)),
                (cx + math.cos(a0) * (R_out - 18), cy + math.sin(a0) * (R_out - 18)),
            ], fill=blend_rgb(col[:3], (208, 170, 78), 0.78), width=5)

        # Crisp opaque riser drop shadow cast by upper step onto lower step
        d.line([
            (cx + math.cos(a1) * R_in, cy + math.sin(a1) * R_in),
            (cx + math.cos(a1) * (R_out - 14), cy + math.sin(a1) * (R_out - 14)),
        ], fill=blend_rgb(col[:3], (16, 12, 12), 0.62), width=7)

    # Outer handrail ring (leave a clear 55° entry opening at the top landing!)
    ring_w = 20 if theme == "cathedral_brass" else 16
    if theme == "cathedral_brass":
        rail_col = (184, 148, 68, 255)
        rail_hi = (232, 202, 118, 255)
    elif theme == "stone":
        rail_col = (118, 116, 112, 255)
        rail_hi = (168, 166, 162, 255)
    else:
        rail_col = (112, 74, 44, 255)
        rail_hi = (168, 122, 76, 255)

    # Outer dark ink + metallic/oak rail arc leaving entry open from -120° to -65°
    box_r = [cx - R_out + 4, cy - R_out + 4, cx + R_out - 4, cy + R_out - 4]
    d.arc(box_r, start=-62, end=242, fill=INK, width=ring_w + 8)
    d.arc(box_r, start=-62, end=242, fill=rail_col, width=ring_w)
    d.arc([cx - R_out + 8, cy - R_out + 8, cx + R_out - 8, cy + R_out - 8], start=-60, end=240, fill=rail_hi, width=5)

    # Rivets / baluster posts around the curved balustrade
    for deg in range(-58, 244, 30):
        rad = math.radians(deg)
        px = cx + math.cos(rad) * (R_out - ring_w * 0.5 - 2)
        py = cy + math.sin(rad) * (R_out - ring_w * 0.5 - 2)
        pr = 12 if deg in (-58, 242) else 7
        pcol = (212, 174, 84, 255) if theme == "cathedral_brass" else rail_col
        d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=pcol, outline=INK, width=3)

    # Central newel column (ornate brass & glowing pale-aether cap for Cathedral; carved stone/oak for arch!)
    newel_sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(newel_sh).ellipse([cx - R_in - 6, cy - R_in - 6, cx + R_in + 6, cy + R_in + 6], fill=(20, 16, 14, 155))
    im.alpha_composite(newel_sh)
    if theme == "cathedral_brass":
        d.ellipse([cx - R_in, cy - R_in, cx + R_in, cy + R_in], fill=(166, 132, 62, 255), outline=INK, width=6)
        d.ellipse([cx - R_in * 0.72, cy - R_in * 0.72, cx + R_in * 0.72, cy + R_in * 0.72], fill=(214, 178, 92, 255), outline=INK, width=4)
        # Subtle dark-magipunk teal-blue glass newel orb
        d.ellipse([cx - R_in * 0.36, cy - R_in * 0.36, cx + R_in * 0.36, cy + R_in * 0.36], fill=(76, 186, 214, 255), outline=INK, width=3)
        d.ellipse([cx - R_in * 0.18, cy - R_in * 0.22, cx + R_in * 0.08, cy + R_in * 0.04], fill=(212, 248, 255, 255))
    elif theme == "stone":
        d.ellipse([cx - R_in, cy - R_in, cx + R_in, cy + R_in], fill=(134, 132, 128, 255), outline=INK, width=6)
        d.ellipse([cx - R_in * 0.65, cy - R_in * 0.65, cx + R_in * 0.65, cy + R_in * 0.65], fill=(164, 162, 156, 255), outline=INK_MED, width=3)
    else:
        d.ellipse([cx - R_in, cy - R_in, cx + R_in, cy + R_in], fill=(122, 82, 48, 255), outline=INK, width=6)
        d.ellipse([cx - R_in * 0.62, cy - R_in * 0.62, cx + R_in * 0.62, cy + R_in * 0.62], fill=(158, 112, 68, 255), outline=INK_MED, width=3)

    return finish(im, size, size, seed=seed, grain=5.8)


# =============================================================================
# C. STRAIGHT & LANDING STAIR FLIGHTS (Portrait: climbs from bottom +Y to top -Y)
# =============================================================================
def gen_straight_stair(
    w: int,
    h: int,
    material: str,
    n_treads: int,
    seed: int,
    top_landing: float = 0.0,
    runner_col: tuple[int, int, int] | None = None,
    brass_posts: bool = True,
    cellar_fade: bool = False,
) -> Image.Image:
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    pad_x, pad_y = 22, 18
    rail_w = 28 if w >= 200 else 22

    # Soft ground contact shadow
    soft_shadow_pts = [(pad_x, pad_y), (W - pad_x, pad_y), (W - pad_x, H - pad_y), (pad_x, H - pad_y)]
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).polygon([(x + 7, y + 9) for x, y in soft_shadow_pts], fill=(20, 14, 12, 90))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(9)))

    ix0, ix1 = pad_x + rail_w, W - pad_x - rail_w
    iy0, iy1 = pad_y, H - pad_y
    land_h = int((iy1 - iy0) * top_landing)
    steps_y0 = iy0 + land_h
    step_h = (iy1 - steps_y0) / n_treads

    # Base palettes
    if material == "wood":
        base_rgb = (152, 106, 66)
        rail_rgb = (104, 68, 40)
    elif material == "stone":
        base_rgb = (140, 138, 134)
        rail_rgb = (102, 102, 106)
    elif material == "iron":
        base_rgb = (86, 94, 104)
        rail_rgb = (56, 64, 72)
    else:
        base_rgb = (146, 144, 138)
        rail_rgb = (100, 102, 106)

    # Optional top plank/stone landing slab
    if land_h > 0:
        d.rectangle([ix0, iy0, ix1, steps_y0], fill=shade_col(base_rgb, 1.06), outline=INK, width=5)
        if material == "wood":
            for py in range(iy0 + 28, steps_y0 - 6, 30):
                d.line([(ix0 + 4, py), (ix1 - 4, py)], fill=shade_col(base_rgb, 0.72), width=3)
            draw_wood_grain(d, ix0, iy0, ix1, steps_y0, base_rgb, rng)
        else:
            draw_stone_details(d, ix0, iy0, ix1, steps_y0, base_rgb, rng, moss=(material == "stone"))

    # Individual treads stepping down from top (brightest) to bottom (deeper ambient occlusion / cellar shadow!)
    for i in range(n_treads):
        ty0 = steps_y0 + i * step_h
        ty1 = steps_y0 + (i + 1) * step_h
        frac = i / max(1, n_treads - 1)
        depth = (1.04 - frac * 0.74) if cellar_fade else (1.04 - frac * 0.28)
        v = rng.randint(-6, 6)
        t_rgb = (max(0, min(255, base_rgb[0] + v)), max(0, min(255, base_rgb[1] + v)), max(0, min(255, base_rgb[2] + v)))
        shaded_rgb = tuple(max(0, min(255, int(c * depth))) for c in t_rgb)
        d.rectangle([ix0, ty0, ix1, ty1], fill=(*shaded_rgb, 255))

        if material == "wood":
            draw_wood_grain(d, ix0, ty0, ix1, ty1, shaded_rgb, rng)
            d.line([(ix0 + 4, ty0 + 4), (ix1 - 4, ty0 + 4)], fill=blend_rgb(shaded_rgb, (238, 198, 146), 0.26), width=3)
        elif material == "iron":
            # Diamond-plate grate cutouts
            for gx in range(int(ix0 + 20), int(ix1 - 14), 26):
                d.polygon([(gx, ty0 + step_h * 0.5), (gx + 7, ty0 + 8), (gx + 14, ty0 + step_h * 0.5), (gx + 7, ty1 - 8)], fill=(42, 46, 54, 255))
            d.line([(ix0 + 6, ty0 + 5), (ix1 - 6, ty0 + 5)], fill=blend_rgb(shaded_rgb, (186, 198, 210), 0.52), width=3)
        else:
            draw_stone_details(d, ix0, ty0, ix1, ty1, shaded_rgb, rng, moss=(material == "stone"))

        # Optional burgundy parlor runner + gleaming brass stair rods (100% opaque!)
        if runner_col is not None:
            rm = (ix1 - ix0) * 0.19
            rc = shade_col(runner_col, depth)
            d.rectangle([ix0 + rm, ty0, ix1 - rm, ty1], fill=rc)
            # Subtle gold runner edge piping
            piping_c = blend_rgb(rc[:3], (228, 190, 96), 0.80)
            rod_c = blend_rgb(rc[:3], (212, 174, 74), 0.92)
            d.line([(ix0 + rm + 8, ty0), (ix0 + rm + 8, ty1)], fill=piping_c, width=4)
            d.line([(ix1 - rm - 8, ty0), (ix1 - rm - 8, ty1)], fill=piping_c, width=4)
            # Gleaming brass stair rod tucked at the riser crease!
            d.line([(ix0 + rm - 8, ty0 + 5), (ix1 - rm + 8, ty0 + 5)], fill=rod_c, width=6)

        # Crisp opaque riser drop shadow + dark ink tread divider!
        sh_tread = blend_rgb(shaded_rgb, (18, 14, 12), 0.44 + 0.14 * frac)
        d.rectangle([ix0, ty1 - 10, ix1, ty1], fill=sh_tread)
        d.line([(ix0, ty1), (ix1, ty1)], fill=INK, width=4)

    # Outer border around tread flight
    d.rectangle([ix0, iy0, ix1, iy1], outline=INK, width=5)

    # Deep cellar darkness gradient at bottom if cellar_fade
    if cellar_fade:
        fade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fade)
        for py in range(int(iy0 + (iy1 - iy0) * 0.38), int(iy1)):
            t = max(0.0, min(1.0, (py - (iy0 + (iy1 - iy0) * 0.38)) / max(1, (iy1 - iy0) * 0.62)))
            fd.line([(ix0, py), (ix1, py)], fill=(14, 12, 16, int(225 * (t ** 1.4))))
        im.alpha_composite(fade)

    # Flanking stringers / stone cheek walls / handrails!
    rail_hi_target = (230, 196, 150) if material == "wood" else (210, 214, 218)
    for rx0, rx1 in [(pad_x, ix0), (ix1, W - pad_x)]:
        d.rounded_rectangle([rx0, pad_y - 4, rx1, H - pad_y + 4], radius=7, fill=(*rail_rgb, 255), outline=INK, width=5)
        # Bevel highlight ridge along handrail top (100% opaque!)
        mid_x = (rx0 + rx1) * 0.5
        d.line([(mid_x - 3, pad_y + 6), (mid_x - 3, H - pad_y - 6)], fill=blend_rgb(rail_rgb, rail_hi_target, 0.45), width=5)
        if material == "stone":
            for jy in range(pad_y + 64, H - pad_y - 32, 78):
                d.line([(rx0 + 3, jy), (rx1 - 3, jy)], fill=(48, 46, 48, 255), width=3)
        if brass_posts:
            post_col = (198, 162, 76, 255) if material in ("wood", "iron") else (142, 144, 148, 255)
            for py in (pad_y + 8, (pad_y + H - pad_y) * 0.5, H - pad_y - 8):
                pr = 12 if py != (pad_y + H - pad_y) * 0.5 else 9
                d.ellipse([mid_x - pr, py - pr, mid_x + pr, py + pr], fill=post_col, outline=INK, width=4)

    return finish(im, w, h, seed=seed, grain=6.0)


# =============================================================================
# D. SPECIALIZED BERLIN ARCHITECTURAL STAIRS (Stoop & Switchback Tenement!)
# =============================================================================
def gen_berlin_courtyard_stoop(seed: int = 901) -> Image.Image:
    """Weathered Berlin granite 5-step outdoor courtyard stoop with stone cheeks & iron rails (240x240)."""
    w, h = 240, 240
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    rng = random.Random(seed)
    W, H = w * 2, h * 2

    # Ground shadow
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([42, 34, W - 26, H - 22], radius=14, fill=(18, 16, 16, 95))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(10)))

    # Main granite landing top (y: 28..154) + 5 stepped granite treads flaring slightly toward bottom (y: 154..444)
    x0, x1 = 68, W - 68
    # Top threshold landing slab
    d.rounded_rectangle([x0 - 12, 28, x1 + 12, 160], radius=8, fill=(146, 144, 138, 255), outline=INK, width=6)
    draw_stone_details(d, x0 - 8, 32, x1 + 8, 156, (146, 144, 138), rng, moss=True)

    # 5 stepped granite treads stepping down toward +Y courtyard!
    n_steps = 5
    step_h = (446 - 156) / n_steps
    for i in range(n_steps):
        ty0 = 156 + i * step_h
        ty1 = 156 + (i + 1) * step_h
        flare = i * 5  # Subtle classic European granite stoop flare on lowest steps!
        depth = 1.02 - i * 0.06
        base = (142, 140, 136)
        d.rounded_rectangle([x0 - flare, ty0, x1 + flare, ty1], radius=6, fill=shade_col(base, depth), outline=INK, width=5)
        draw_stone_details(d, x0 - flare + 4, ty0 + 4, x1 + flare - 4, ty1 - 4, tuple(int(c * depth) for c in base), rng, moss=True)
        d.rectangle([x0 - flare + 4, ty1 - 11, x1 + flare - 4, ty1 - 2], fill=blend_rgb(tuple(int(c * depth) for c in base), (24, 22, 24), 0.42))

    # Flanking carved granite cheek walls + dark wrought-iron handrail bars!
    for side, cx0, cx1 in [(-1, 34, 72), (1, W - 72, W - 34)]:
        d.rounded_rectangle([cx0, 26, cx1, 434], radius=10, fill=(116, 114, 112, 255), outline=INK, width=6)
        for jy in range(96, 410, 88):
            d.line([(cx0 + 4, jy), (cx1 - 4, jy)], fill=(54, 52, 54, 255), width=3)
        # Wrought-iron handrail bar bolted atop each cheek parapet!
        mx = (cx0 + cx1) * 0.5
        d.line([(mx, 44), (mx, 416)], fill=INK, width=14)
        d.line([(mx, 44), (mx, 416)], fill=(78, 86, 92, 255), width=6)
        for py in (44, 230, 416):
            d.ellipse([mx - 11, py - 11, mx + 11, py + 11], fill=(168, 140, 74, 255), outline=INK, width=4)

    return finish(im, w, h, seed=seed, grain=6.0)


def gen_tenement_switchback_wood(seed: int = 902) -> Image.Image:
    """Berlin Mietskaserne U-turn switchback oak stairwell with mid-landing & iron banister (288x360)."""
    w, h = 288, 360
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    pad = 22

    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad + 8, pad + 10, W - pad + 8, H - pad + 10], radius=10, fill=(20, 14, 12, 90))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(9)))

    # Outer timber stairwell frame
    d.rounded_rectangle([pad, pad, W - pad, H - pad], radius=10, fill=(104, 68, 40, 255), outline=INK, width=7)
    ix0, ix1 = pad + 22, W - pad - 22
    iy0, iy1 = pad + 22, H - pad - 22
    mid_x = (ix0 + ix1) * 0.5
    land_y = iy0 + 185

    # Top planked mid-landing connecting the up & down flights!
    d.rectangle([ix0, iy0, ix1, land_y], fill=(154, 108, 66, 255), outline=INK, width=5)
    for px in range(int(ix0 + 38), int(ix1 - 12), 42):
        d.line([(px, iy0 + 4), (px, land_y - 4)], fill=(96, 64, 38, 255), width=3)
    draw_wood_grain(d, ix0, iy0, ix1, land_y, (154, 108, 66), rng)

    # Left flight (ascending toward top mid-landing) & Right flight (continuing up/down from mid-landing!)
    n_t = 9
    sh_t = (iy1 - land_y) / n_t
    for side, fx0, fx1, rev in [(0, ix0, mid_x - 14, False), (1, mid_x + 14, ix1, True)]:
        for i in range(n_t):
            ty0 = land_y + i * sh_t
            ty1 = land_y + (i + 1) * sh_t
            frac = (1.0 - i / n_t) if rev else (i / n_t)
            depth = 1.04 - frac * 0.34
            base = (150, 104, 64)
            shaded_rgb = tuple(max(0, min(255, int(c * depth))) for c in base)
            d.rectangle([fx0, ty0, fx1, ty1], fill=(*shaded_rgb, 255))
            draw_wood_grain(d, fx0, ty0, fx1, ty1, shaded_rgb, rng)
            d.line([(fx0 + 4, ty0 + 4), (fx1 - 4, ty0 + 4)], fill=blend_rgb(shaded_rgb, (238, 198, 146), 0.25), width=3)
            d.rectangle([fx0, ty1 - 9, fx1, ty1], fill=blend_rgb(shaded_rgb, (20, 14, 10), 0.45))
            d.line([(fx0, ty1), (fx1, ty1)], fill=INK, width=4)
        d.rectangle([fx0, land_y, fx1, iy1], outline=INK, width=5)

    # Central dark-oak & cast-iron dividing banister rail + brass newel posts!
    d.rounded_rectangle([mid_x - 14, land_y - 8, mid_x + 14, iy1 + 10], radius=6, fill=(78, 52, 34, 255), outline=INK, width=5)
    d.line([(mid_x, land_y), (mid_x, iy1)], fill=(138, 96, 58, 255), width=4)
    for py in (land_y, iy1):
        d.ellipse([mid_x - 16, py - 16, mid_x + 16, py + 16], fill=(192, 156, 74, 255), outline=INK, width=4)

    return finish(im, w, h, seed=seed, grain=6.0)


def gen_marble_dais_steps(seed: int = 903) -> Image.Image:
    """Wide 3:1 ceremonial veined-alabaster & antique-brass 4-step sanctuary/throne dais stairs (384x128)."""
    w, h = 384, 128
    im = new_hi(w, h)
    d = ImageDraw.Draw(im, "RGBA")
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    pad_x, pad_y = 20, 14
    cheek_w = 30

    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([pad_x + 6, pad_y + 8, W - pad_x + 6, H - pad_y + 8], radius=8, fill=(20, 16, 14, 92))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))

    ix0, ix1 = pad_x + cheek_w, W - pad_x - cheek_w
    iy0, iy1 = pad_y, H - pad_y
    n_steps = 4
    step_h = (iy1 - iy0) / n_steps

    # 4 broad alabaster marble steps descending from top (-Y = dais) toward bottom (+Y = nave)
    for i in range(n_steps):
        ty0 = iy0 + i * step_h
        ty1 = iy0 + (i + 1) * step_h
        depth = 1.03 - i * 0.08
        base = (224, 218, 204)
        shaded = tuple(max(0, min(255, int(c * depth))) for c in base)
        d.rectangle([ix0, ty0, ix1, ty1], fill=(*shaded, 255))
        # Subtle ashlar slab joints & natural marble veining (100% opaque!)
        for sx in (0.25, 0.50, 0.75):
            jx = ix0 + (ix1 - ix0) * sx + rng.uniform(-8, 8)
            d.line([(jx, ty0 + 2), (jx, ty1 - 2)], fill=blend_rgb(shaded, (118, 112, 102), 0.42), width=3)
        for _ in range(7):
            vx = rng.uniform(ix0 + 14, ix1 - 14)
            d.line([(vx, ty0 + 5), (vx + rng.uniform(-22, 22), ty1 - 5)], fill=blend_rgb(shaded, (158, 150, 138), 0.36), width=3)
        # Warm top highlight + antique-brass nosing strip + crisp riser drop shadow!
        d.line([(ix0 + 4, ty0 + 4), (ix1 - 4, ty0 + 4)], fill=blend_rgb(shaded, (252, 248, 238), 0.45), width=3)
        d.rectangle([ix0, ty1 - 12, ix1, ty1 - 5], fill=blend_rgb(shaded, (194, 158, 74), 0.86))
        d.rectangle([ix0, ty1 - 5, ix1, ty1], fill=blend_rgb(shaded, (38, 32, 28), 0.52))
        d.line([(ix0, ty1), (ix1, ty1)], fill=INK, width=4)

    d.rectangle([ix0, iy0, ix1, iy1], outline=INK, width=5)

    # Flanking gilded-brass & carved marble dais cheek plinths + finials
    for rx0, rx1 in [(pad_x, ix0), (ix1, W - pad_x)]:
        d.rounded_rectangle([rx0, pad_y - 3, rx1, H - pad_y + 3], radius=8, fill=(182, 148, 72, 255), outline=INK, width=5)
        mx = (rx0 + rx1) * 0.5
        d.line([(mx - 3, pad_y + 6), (mx - 3, H - pad_y - 6)], fill=(238, 212, 132, 255), width=5)
        for py in (pad_y + 10, H - pad_y - 10):
            d.ellipse([mx - 12, py - 12, mx + 12, py + 12], fill=(214, 178, 88, 255), outline=INK, width=4)

    return finish(im, w, h, seed=seed, grain=5.4)


def repack_dcpack(src_dir: Path, dcpack_path: Path):
    if not dcpack_path.parent.is_dir():
        return
    with zipfile.ZipFile(dcpack_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for f in sorted(src_dir.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(src_dir).as_posix())
    print(f"  Repacked {dcpack_path.name} ({dcpack_path.stat().st_size / (1024*1024):.2f} MB)")


def main():
    STAIRS_DIR.mkdir(parents=True, exist_ok=True)
    qa_entries: list[tuple[str, Image.Image]] = []

    # --- 1. Upgrade 15 early flat stairs in-place (preserving exact filenames & IDs!) ---
    upgrades: list[tuple[Path, str, Image.Image]] = [
        (STARTER_DIR / "objects/brass_spiral_staircase.png", "brass_spiral_staircase", gen_spiral_stair(320, "cathedral_brass", 701)),
        (STARTER_DIR / "objects/wood_interior_stairs.png", "wood_interior_stairs", gen_straight_stair(256, 384, "wood", 11, 702, brass_posts=True)),
        (STARTER_DIR / "paths/stone_retaining_stairs.png", "stone_retaining_stairs", gen_stair_path(512, 128, "stone_retaining", 703)),
        (STARTER_DIR / "paths/iron_fire_escape_stairs.png", "iron_fire_escape_stairs", gen_stair_path(512, 112, "iron_fire_escape", 704)),
        (CORE_DIR / "paths/stone_dungeon_stairs.png", "stone_dungeon_stairs", gen_stair_path(512, 128, "stone_dungeon", 705)),
        (CORE_DIR / "paths/timber_tavern_stairs.png", "timber_tavern_stairs", gen_stair_path(512, 128, "timber_tavern", 706)),
        (CORE_DIR / "paths/marble_grand_stairs.png", "marble_grand_stairs", gen_stair_path(512, 128, "marble_grand", 707)),
        (CORE_DIR / "objects/stone_stair_landing.png", "stone_stair_landing", gen_straight_stair(256, 384, "stone", 8, 708, top_landing=0.28, brass_posts=False)),
        (CORE_DIR / "objects/wood_stair_landing.png", "wood_stair_landing", gen_straight_stair(256, 384, "wood", 8, 709, top_landing=0.28, brass_posts=True)),
        (MOD_DIR / "modular/arch_stairs_wood_narrow.png", "arch_stairs_wood_narrow", gen_straight_stair(160, 256, "wood", 9, 710, brass_posts=False)),
        (MOD_DIR / "modular/arch_stairs_wood_wide.png", "arch_stairs_wood_wide", gen_straight_stair(256, 256, "wood", 8, 711, brass_posts=False)),
        (MOD_DIR / "modular/arch_stairs_stone_narrow.png", "arch_stairs_stone_narrow", gen_straight_stair(160, 256, "stone", 9, 712, brass_posts=False)),
        (MOD_DIR / "modular/arch_stairs_stone_wide.png", "arch_stairs_stone_wide", gen_straight_stair(256, 256, "stone", 8, 713, brass_posts=False)),
        (MOD_DIR / "modular/arch_spiral_wood.png", "arch_spiral_wood", gen_spiral_stair(240, "wood", 714)),
        (MOD_DIR / "modular/arch_spiral_stone.png", "arch_spiral_stone", gen_spiral_stair(240, "stone", 715)),
    ]
    for path, label, im in upgrades:
        im.save(path, "PNG", optimize=True)
        qa_entries.append((label, im))
        print(f"  Upgraded {path} ({im.width}x{im.height})")

    # --- 2. Create 6 brand-new architectural stair stamps ---
    new_specs = [
        ("stair_berlin_stoop_stone.png", "Berlin Granite Courtyard Stoop Stairs", gen_berlin_courtyard_stoop(801), ["stairs", "steps", "stoop", "stone", "courtyard", "berlin", "modular"]),
        ("stair_parlor_oak_runner.png", "Oak Family Staircase with Burgundy Runner", gen_straight_stair(220, 340, "wood", 10, 802, runner_col=(142, 42, 48), brass_posts=True), ["stairs", "wood", "runner", "interior", "parlor", "modular"]),
        ("stair_tenement_switchback_wood.png", "Berlin Tenement Switchback Timber Stairs", gen_tenement_switchback_wood(803), ["stairs", "wood", "tenement", "apartment", "switchback", "modular"]),
        ("stair_magipunk_iron_catwalk.png", "Magipunk Riveted Iron Catwalk Stairs", gen_straight_stair(200, 320, "iron", 10, 804, brass_posts=True), ["stairs", "iron", "industrial", "magipunk", "catwalk", "modular"]),
        ("stair_cellar_stone_descent.png", "Sunken Stone Cellar Descent Stairs", gen_straight_stair(220, 320, "stone", 9, 805, brass_posts=False, cellar_fade=True), ["stairs", "stone", "cellar", "basement", "dungeon", "modular"]),
        ("stair_marble_dais_steps.png", "Grand Alabaster & Brass Dais Steps", gen_marble_dais_steps(806), ["stairs", "steps", "marble", "dais", "altar", "throne", "cathedral", "modular"]),
    ]

    manifest_path = MOD_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = manifest.get("assets", [])
    by_path = {a["path"]: i for i, a in enumerate(assets)}

    for fname, disp, im, tags in new_specs:
        out_p = STAIRS_DIR / fname
        im.save(out_p, "PNG", optimize=True)
        rel = f"props/stairs_architectural/{fname}"
        entry = {
            "path": rel,
            "displayName": disp,
            "category": "object",
            "tags": tags,
            "widthPx": im.width,
            "heightPx": im.height,
            "defaultPpi": 256,
            "drawMode": "normal",
            "castsShadow": True,
            "dominantHex": "#8C8274",
        }
        if rel in by_path:
            assets[by_path[rel]] = entry
        else:
            by_path[rel] = len(assets)
            assets.append(entry)
        qa_entries.append((fname.replace(".png", ""), im))
        print(f"  Created  {rel} ({im.width}x{im.height})")

    manifest["assets"] = assets
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated modular-suite-cc0/manifest.json -> {len(assets)} total modular assets.")

    # --- 3. Render dark-checkerboard QA sheet of all 21 stairs ---
    cols, rows = 7, 3
    cw, ch = 260, 210
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (28, 30, 38, 255))
    sd = ImageDraw.Draw(sheet)
    for y in range(0, rows * ch, 14):
        for x in range(0, cols * cw, 14):
            if ((x // 14) + (y // 14)) % 2 == 0:
                sd.rectangle([x, y, x + 13, y + 13], fill=(42, 46, 56, 255))
    for i, (label, im) in enumerate(qa_entries):
        r, c = divmod(i, cols)
        sc = min((cw - 24) / im.width, (ch - 42) / im.height)
        nw, nh = max(1, int(im.width * sc)), max(1, int(im.height * sc))
        th = im.resize((nw, nh), Image.Resampling.LANCZOS)
        sheet.alpha_composite(th, (c * cw + (cw - nw) // 2, r * ch + (ch - 24 - nh) // 2))
        sd.rectangle([c * cw, (r + 1) * ch - 22, (c + 1) * cw - 1, (r + 1) * ch - 1], fill=(16, 18, 24, 232))
        sd.text((c * cw + 5, (r + 1) * ch - 17), f"{label} ({im.width}x{im.height})", fill=(235, 240, 248, 255))
    sheet.convert("RGB").save(QA_PATH, "PNG")
    print("Saved QA sheet ->", QA_PATH)

    # --- 4. Repack all affected .dcpack bundles! ---
    for src_d, pack_name in [
        (STARTER_DIR, "DiceChaos_Berlin_Magipunk_Starter.dcpack"),
        (CORE_DIR, "DiceChaos_Core_Fantasy_CC0.dcpack"),
        (MOD_DIR, "DiceChaos_Modular_Suite_CC0.dcpack"),
    ]:
        p = ASSETS_ROOT / pack_name
        if p.exists():
            repack_dcpack(src_d, p)


if __name__ == "__main__":
    main()

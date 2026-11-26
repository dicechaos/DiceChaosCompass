"""
Dice Chaos Compass — Unified Painterly Harmony Art Engine (CC0 Studio Standard)

Shared 2x-supersampled hand-inked painterly rendering primitives matching our
gold-standard Berlin Dark-Magipunk / Storybook Gouache art direction:
  - Deep warm charcoal ink outlines (#1E1816) with smooth LANCZOS anti-aliasing
  - Vectorized periodic 2D fBm noise for seamless tiling walls, paths & terrains
  - Directional top-left sunlight + crevice ambient occlusion bump relief
  - 100% opaque interiors (zero Pillow RGBA alpha-replace punch-throughs)
  - Zero white halos on dark or light checkerboards
  - Built-in dark-checkerboard QA contact-sheet renderer
"""

from __future__ import annotations

import json
import math
import random
import zipfile
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ASSETS_ROOT = Path("public/assets")
STARTER_DIR = ASSETS_ROOT / "starter-cc0"
CORE_DIR = ASSETS_ROOT / "core-fantasy-cc0"
MOD_DIR = ASSETS_ROOT / "modular-suite-cc0"
SCRATCH_DIR = Path(
    r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch"
)

# Signature hand-inked charcoal palette (always alpha=255 for direct RGBA draws!)
INK = (28, 22, 20, 255)
INK_DARK = (20, 16, 15, 255)
INK_MID = (48, 38, 34, 255)
INK_WARM = (58, 44, 34, 255)
INK_IRON = (24, 28, 34, 255)

# Pure dd_red colorable base palette (R >> G, B so colorShader.ts recolors cleanly!)
DD_RED_BASE = (206, 36, 36)
DD_RED_DEEP = (142, 20, 22)
DD_RED_HI = (238, 86, 78)


def clamp8(v: float) -> int:
    return 0 if v < 0 else (255 if v > 255 else int(v))


def shade_rgb(rgb: tuple[int, int, int], factor: float) -> tuple[int, int, int, int]:
    return (clamp8(rgb[0] * factor), clamp8(rgb[1] * factor), clamp8(rgb[2] * factor), 255)


def blend_rgb(
    bg: tuple[int, int, int], fg: tuple[int, int, int], alpha: float
) -> tuple[int, int, int, int]:
    a = max(0.0, min(1.0, alpha))
    return (
        clamp8(bg[0] * (1.0 - a) + fg[0] * a),
        clamp8(bg[1] * (1.0 - a) + fg[1] * a),
        clamp8(bg[2] * (1.0 - a) + fg[2] * a),
        255,
    )


def vary_rgb(
    rgb: tuple[int, int, int], rng: random.Random, amt: int = 10
) -> tuple[int, int, int]:
    dv = rng.randint(-amt, amt)
    return (
        clamp8(rgb[0] + dv + rng.randint(-amt // 3, amt // 3)),
        clamp8(rgb[1] + dv + rng.randint(-amt // 3, amt // 3)),
        clamp8(rgb[2] + dv + rng.randint(-amt // 3, amt // 3)),
    )


def new_hi(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))


def periodic_noise(h: int, w: int, gy: int, gx: int, seed: int) -> np.ndarray:
    """Smooth bilinearly interpolated periodic noise field of shape (h, w) in [0, 1]."""
    rng = np.random.default_rng(seed)
    grid = rng.random((max(1, gy), max(1, gx)), dtype=np.float32)
    ys = np.linspace(0, grid.shape[0], h, endpoint=False, dtype=np.float32)
    xs = np.linspace(0, grid.shape[1], w, endpoint=False, dtype=np.float32)
    y0 = np.floor(ys).astype(np.int32) % grid.shape[0]
    x0 = np.floor(xs).astype(np.int32) % grid.shape[1]
    y1 = (y0 + 1) % grid.shape[0]
    x1 = (x0 + 1) % grid.shape[1]
    fy = (ys - np.floor(ys))[:, None]
    fx = (xs - np.floor(xs))[None, :]
    # Smoothstep for organic painterly gradients
    fy = fy * fy * (3.0 - 2.0 * fy)
    fx = fx * fx * (3.0 - 2.0 * fx)
    c00 = grid[y0[:, None], x0[None, :]]
    c10 = grid[y0[:, None], x1[None, :]]
    c01 = grid[y1[:, None], x0[None, :]]
    c11 = grid[y1[:, None], x1[None, :]]
    top = c00 * (1.0 - fx) + c10 * fx
    bot = c01 * (1.0 - fx) + c11 * fx
    return top * (1.0 - fy) + bot * fy


def fbm_periodic(
    h: int,
    w: int,
    octaves: Sequence[tuple[int, int, float]] = ((4, 4, 0.50), (8, 8, 0.30), (16, 16, 0.14), (32, 32, 0.06)),
    seed: int = 1,
) -> np.ndarray:
    """Multi-octave periodic 2D fBm noise normalized to [0, 1]."""
    acc = np.zeros((h, w), dtype=np.float32)
    tot = 0.0
    for idx, (gy, gx, amp) in enumerate(octaves):
        acc += periodic_noise(h, w, gy, gx, seed + idx * 137) * amp
        tot += amp
    if tot > 0:
        acc /= tot
    return acc


def apply_painterly_finish(
    im: Image.Image,
    w: int,
    h: int,
    seed: int = 1,
    grain: float = 5.4,
    periodic_x: bool = False,
    periodic_xy: bool = False,
    warm_bevel: bool = True,
) -> Image.Image:
    """
    Downscales 2x supersampled RGBA image with LANCZOS and adds subtle painterly
    gouache brush texture + micro top-left warmth strictly masked to opaque pixels.
    """
    out = im.resize((w, h), Image.Resampling.LANCZOS)
    arr = np.array(out, dtype=np.float32)
    alpha = arr[:, :, 3]
    mask = alpha > 24

    if grain > 0 and np.any(mask):
        if periodic_xy:
            n_lo = fbm_periodic(h, w, ((6, 6, 0.55), (14, 14, 0.30), (32, 32, 0.15)), seed=seed)
            n_hi = periodic_noise(h, w, min(h, 96), min(w, 96), seed + 911)
            brush = ((n_lo - 0.5) * 1.9 + (n_hi - 0.5) * 1.1) * grain * 1.85
        elif periodic_x:
            gx_lo = max(4, w // 32)
            gy_lo = max(3, h // 24)
            n_lo = fbm_periodic(
                h, w, ((gy_lo, gx_lo, 0.55), (gy_lo * 2, gx_lo * 2, 0.30), (gy_lo * 4, gx_lo * 4, 0.15)), seed=seed
            )
            n_hi = periodic_noise(h, w, min(h, 64), min(w, 128), seed + 911)
            brush = ((n_lo - 0.5) * 1.8 + (n_hi - 0.5) * 1.0) * grain * 1.75
        else:
            rng = np.random.default_rng(seed)
            n_lo = fbm_periodic(h, w, ((4, 4, 0.55), (10, 10, 0.30), (24, 24, 0.15)), seed=seed)
            n_hi = rng.normal(0.0, 1.0, size=(h, w)).astype(np.float32)
            brush = ((n_lo - 0.5) * 2.1 * grain) + (n_hi * grain * 0.55)

        for c in range(3):
            arr[:, :, c] = np.clip(arr[:, :, c] + brush * mask, 0, 255)

    if warm_bevel and not periodic_xy and np.any(mask):
        # Subtle directional sunlight warmth along upper-left edge of opaque pixels
        # (never touches transparent pixels, zero white halo!)
        hmap = (arr[:, :, 0] * 0.3 + arr[:, :, 1] * 0.55 + arr[:, :, 2] * 0.15) / 255.0
        dy = np.roll(hmap, 1, axis=0) - np.roll(hmap, -1, axis=0)
        dx = np.roll(hmap, 1, axis=1) - np.roll(hmap, -1, axis=1)
        if not periodic_x:
            dx[:, 0] = 0.0
            dx[:, -1] = 0.0
        dy[0, :] = 0.0
        dy[-1, :] = 0.0
        rel = np.clip((dx + dy) * 11.0, -10.0, 10.0) * mask * (alpha / 255.0)
        arr[:, :, 0] = np.clip(arr[:, :, 0] + rel * 1.05, 0, 255)
        arr[:, :, 1] = np.clip(arr[:, :, 1] + rel * 1.00, 0, 255)
        arr[:, :, 2] = np.clip(arr[:, :, 2] + rel * 0.90, 0, 255)

    # Zero out invisible RGB noise in fully transparent pixels (prevents any bleed)
    arr[alpha < 2, :3] = 0
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def add_contact_shadow(
    im: Image.Image,
    shape_fn,
    offset: tuple[int, int] = (7, 9),
    blur: float = 9.0,
    alpha: int = 92,
) -> None:
    """Composites a clean soft drop shadow underneath an object without mutating alpha."""
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    shape_fn(sd, (16, 12, 12, alpha), offset)
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur)))


def add_glow(
    im: Image.Image,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    rgb: tuple[int, int, int],
    alpha: int = 120,
    blur: float = 16.0,
) -> None:
    """Composites a luminous magipunk/lantern glow cleanly via alpha_composite."""
    gl = Image.new("RGBA", im.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(gl)
    gd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(*rgb, alpha))
    im.alpha_composite(gl.filter(ImageFilter.GaussianBlur(blur)))


# =============================================================================
# PAINTERLY SURFACE MATERIAL DRAWERS (100% OPAQUE ALPHA=255!)
# =============================================================================
def draw_beveled_rect(
    d: ImageDraw.ImageDraw,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    base_rgb: tuple[int, int, int],
    ink_w: int = 4,
    radius: int = 0,
    hi_amt: float = 0.28,
    sh_amt: float = 0.38,
    outline: tuple[int, int, int, int] = INK,
) -> None:
    """Draws a crisp hand-inked beveled block with warm top-left highlight & bottom-right shadow."""
    if radius > 0:
        d.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=(*base_rgb, 255))
    else:
        d.rectangle([x0, y0, x1, y1], fill=(*base_rgb, 255))
    hi = blend_rgb(base_rgb, (248, 238, 218), hi_amt)
    sh = blend_rgb(base_rgb, (20, 16, 14), sh_amt)
    pad = max(2, ink_w // 2 + 1)
    if x1 - x0 > pad * 3 and y1 - y0 > pad * 3:
        d.line([(x0 + pad, y0 + pad), (x1 - pad, y0 + pad)], fill=hi, width=max(2, ink_w - 1))
        d.line([(x0 + pad, y0 + pad), (x0 + pad, y1 - pad)], fill=hi, width=max(2, ink_w - 1))
        d.line([(x0 + pad, y1 - pad), (x1 - pad, y1 - pad)], fill=sh, width=max(2, ink_w))
        d.line([(x1 - pad, y0 + pad), (x1 - pad, y1 - pad)], fill=sh, width=max(2, ink_w))
    if ink_w > 0:
        if radius > 0:
            d.rounded_rectangle([x0, y0, x1, y1], radius=radius, outline=outline, width=ink_w)
        else:
            d.rectangle([x0, y0, x1, y1], outline=outline, width=ink_w)


def draw_wood_planks_box(
    d: ImageDraw.ImageDraw,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    base_rgb: tuple[int, int, int],
    rng: random.Random,
    horizontal: bool = True,
    n_planks: int = 4,
    ink_w: int = 4,
    nails: bool = True,
) -> None:
    """Painterly individual beveled timber planks with organic grain, seams & optional nails."""
    w, h = x1 - x0, y1 - y0
    if w <= 2 or h <= 2:
        return
    n_planks = max(1, n_planks)
    for i in range(n_planks):
        prgb = vary_rgb(base_rgb, rng, 11)
        if horizontal:
            py0 = y0 + (i / n_planks) * h
            py1 = y0 + ((i + 1) / n_planks) * h
            d.rectangle([x0, py0, x1, py1], fill=(*prgb, 255))
            # Grain streaks
            g_dk = blend_rgb(prgb, (34, 20, 12), 0.32)
            g_lt = blend_rgb(prgb, (236, 198, 146), 0.20)
            d.line([(x0 + 3, py0 + 3), (x1 - 3, py0 + 3)], fill=g_lt, width=2)
            for _ in range(max(2, int((py1 - py0) / 14))):
                gy = rng.uniform(py0 + 4, max(py0 + 5, py1 - 4))
                d.line([(x0 + 4, gy), (x1 - 4, gy + rng.uniform(-2, 2))], fill=g_dk, width=2)
            # Optional knot
            if rng.random() < 0.25 and (py1 - py0) > 14 and w > 40:
                kx = rng.uniform(x0 + 18, x1 - 18)
                ky = rng.uniform(py0 + 5, py1 - 5)
                d.ellipse([kx - 5, ky - 3, kx + 5, ky + 3], fill=blend_rgb(prgb, (30, 18, 10), 0.48))
            if i > 0:
                d.line([(x0, py0), (x1, py0)], fill=INK_MID, width=max(2, ink_w - 1))
            if nails and w > 36 and (py1 - py0) > 12:
                my = (py0 + py1) * 0.5
                for nx in (x0 + 10, x1 - 10):
                    d.ellipse([nx - 2.5, my - 2.5, nx + 2.5, my + 2.5], fill=(42, 38, 36, 255))
        else:
            px0 = x0 + (i / n_planks) * w
            px1 = x0 + ((i + 1) / n_planks) * w
            d.rectangle([px0, y0, px1, y1], fill=(*prgb, 255))
            g_dk = blend_rgb(prgb, (34, 20, 12), 0.32)
            g_lt = blend_rgb(prgb, (236, 198, 146), 0.20)
            d.line([(px0 + 3, y0 + 3), (px0 + 3, y1 - 3)], fill=g_lt, width=2)
            for _ in range(max(2, int((px1 - px0) / 14))):
                gx = rng.uniform(px0 + 4, max(px0 + 5, px1 - 4))
                d.line([(gx, y0 + 4), (gx + rng.uniform(-2, 2), y1 - 4)], fill=g_dk, width=2)
            if i > 0:
                d.line([(px0, y0), (px0, y1)], fill=INK_MID, width=max(2, ink_w - 1))
            if nails and h > 36 and (px1 - px0) > 12:
                mx = (px0 + px1) * 0.5
                for ny in (y0 + 10, y1 - 10):
                    d.ellipse([mx - 2.5, ny - 2.5, mx + 2.5, ny + 2.5], fill=(42, 38, 36, 255))
    if ink_w > 0:
        d.rectangle([x0, y0, x1, y1], outline=INK, width=ink_w)


def draw_stone_block(
    d: ImageDraw.ImageDraw,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    base_rgb: tuple[int, int, int],
    rng: random.Random,
    ink_w: int = 3,
    moss: float = 0.0,
    cracks: float = 0.35,
    radius: int = 3,
) -> None:
    """Chiseled beveled ashlar stone block with warm highlight, shadow, cracks & optional moss."""
    col = vary_rgb(base_rgb, rng, 11)
    draw_beveled_rect(d, x0, y0, x1, y1, col, ink_w=ink_w, radius=radius, hi_amt=0.28, sh_amt=0.40)
    w, h = x1 - x0, y1 - y0
    if w > 18 and h > 14:
        # Subtle stone mineral speckles
        dk = blend_rgb(col, (26, 24, 24), 0.36)
        lt = blend_rgb(col, (230, 228, 222), 0.26)
        for _ in range(max(2, int((w * h) / 650))):
            sx = rng.uniform(x0 + 5, x1 - 5)
            sy = rng.uniform(y0 + 5, y1 - 5)
            r = rng.uniform(1.2, 2.6)
            d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=dk if rng.random() < 0.6 else lt)
        if rng.random() < cracks:
            cx = rng.uniform(x0 + w * 0.22, x1 - w * 0.22)
            cy = rng.uniform(y0 + h * 0.22, y1 - h * 0.22)
            d.line(
                [(cx, cy), (cx + rng.uniform(-w * 0.22, w * 0.22), cy + rng.uniform(-h * 0.22, h * 0.22))],
                fill=dk,
                width=2,
            )
    if moss > 0 and rng.random() < moss:
        mx = rng.choice([x0 + rng.uniform(3, min(14, w * 0.35)), x1 - rng.uniform(3, min(14, w * 0.35))])
        my = rng.choice([y0 + rng.uniform(3, min(12, h * 0.35)), y1 - rng.uniform(3, min(12, h * 0.35))])
        for _ in range(3):
            ox, oy = rng.uniform(-7, 7), rng.uniform(-5, 5)
            mr = rng.uniform(3.5, 8.5)
            mc = vary_rgb((74, 112, 54), rng, 14)
            d.ellipse([mx + ox - mr, my + oy - mr * 0.8, mx + ox + mr, my + oy + mr * 0.8], fill=(*mc, 255))


def draw_glass_pane(
    d: ImageDraw.ImageDraw,
    x0: float,
    y0: float,
    x1: float,
    y1: float,
    glass_rgb: tuple[int, int, int],
    glow_rgb: tuple[int, int, int] | None = None,
    lead_w: int = 3,
    specular: bool = True,
    diamond_lead: bool = False,
) -> None:
    """Painterly leaded glass pane with gradient depth, diagonal sunlit glint & optional lead lattice."""
    w, h = x1 - x0, y1 - y0
    if w <= 2 or h <= 2:
        return
    # Top-to-bottom subtle reflection gradient inside glass
    bands = 6
    for b in range(bands):
        t = b / max(1, bands - 1)
        by0 = y0 + (b / bands) * h
        by1 = y0 + ((b + 1) / bands) * h + 1
        if glow_rgb is not None:
            col = blend_rgb(glass_rgb, glow_rgb, 0.45 * (1.0 - abs(t - 0.5) * 2.0))
        else:
            col = blend_rgb(glass_rgb, (238, 248, 255), 0.26 * (1.0 - t)) if t < 0.5 else blend_rgb(glass_rgb, (20, 30, 44), 0.26 * (t - 0.5))
        d.rectangle([x0, by0, x1, by1], fill=col)

    if diamond_lead and w > 18 and h > 16:
        step = max(14, int(min(w, h) * 0.52))
        lc = blend_rgb(glass_rgb, (28, 30, 36), 0.65)
        # Clip exact diagonal segments cleanly to [x0..x1] x [y0..y1] (zero overshoot outside panes!)
        for sx in range(int(x0) - int(h), int(x1) + int(h), step):
            # Down-right diagonal: y = y0 + (x - sx)
            ax = max(x0, float(sx))
            bx = min(x1, float(sx + h))
            if bx > ax:
                d.line([(ax, y0 + (ax - sx)), (bx, y0 + (bx - sx))], fill=lc, width=2)
            # Up-right diagonal: y = y1 - (x - sx)
            if bx > ax:
                d.line([(ax, y1 - (ax - sx)), (bx, y1 - (bx - sx))], fill=lc, width=2)

    if specular and w > 12 and h > 10:
        hi = blend_rgb(glass_rgb, (255, 255, 255), 0.62)
        hi2 = blend_rgb(glass_rgb, (245, 252, 255), 0.36)
        dx = min(w * 0.36, h * 0.65)
        d.line([(x0 + 6, y1 - 6), (x0 + 6 + dx, y0 + 6)], fill=hi, width=max(2, int(min(w, h) * 0.08)))
        if w > 30:
            d.line([(x0 + 18, y1 - 6), (x0 + 18 + dx * 0.7, y0 + 8)], fill=hi2, width=2)

    d.rectangle([x0, y0, x1, y1], outline=INK_IRON, width=lead_w)


def draw_foliage_cluster(
    d: ImageDraw.ImageDraw,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    base_rgb: tuple[int, int, int],
    rng: random.Random,
    n_leaves: int = 16,
    blossom_rgb: tuple[int, int, int] | None = None,
    wrap_w: float | None = None,
) -> None:
    """Multi-layer painterly sculpted foliage canopy (deep shadow -> mid -> sunlit leaf tips + flowers)."""
    dk = blend_rgb(base_rgb, (16, 28, 14), 0.52)
    hi = blend_rgb(base_rgb, (218, 236, 128), 0.38)
    offsets_x = [0.0] if wrap_w is None else [-wrap_w, 0.0, wrap_w]

    # 1) Base shadow mass
    for ox in offsets_x:
        d.ellipse([cx + ox - rx, cy - ry + 3, cx + ox + rx, cy + ry + 3], fill=dk, outline=INK, width=4)

    # 2) Sculpted organic leaf tufts
    tufts = []
    for _ in range(n_leaves):
        ang = rng.uniform(0, math.tau)
        rad = rng.uniform(0.15, 0.88)
        lx = cx + math.cos(ang) * rx * rad
        ly = cy + math.sin(ang) * ry * rad
        lr = rng.uniform(min(rx, ry) * 0.24, min(rx, ry) * 0.44)
        # Top-left tufts get sunlit highlight!
        sun = (-math.cos(ang) * 0.6 - math.sin(ang) * 0.8) * rad
        if sun > 0.22:
            c = blend_rgb(vary_rgb(base_rgb, rng, 12), hi[:3], 0.45)
        elif sun < -0.25:
            c = blend_rgb(vary_rgb(base_rgb, rng, 10), dk[:3], 0.42)
        else:
            c = (*vary_rgb(base_rgb, rng, 12), 255)
        tufts.append((lx, ly, lr, c))

    for lx, ly, lr, c in tufts:
        for ox in offsets_x:
            d.ellipse([lx + ox - lr, ly - lr * 0.85, lx + ox + lr, ly + lr * 0.85], fill=c, outline=INK_MID, width=2)

    if blossom_rgb is not None:
        for _ in range(max(3, n_leaves // 4)):
            ang = rng.uniform(0, math.tau)
            rad = rng.uniform(0.1, 0.75)
            bx = cx + math.cos(ang) * rx * rad
            by = cy + math.sin(ang) * ry * rad
            br = rng.uniform(4.5, 7.5)
            bc = vary_rgb(blossom_rgb, rng, 16)
            for ox in offsets_x:
                d.ellipse([bx + ox - br, by - br, bx + ox + br, by + br], fill=(*bc, 255), outline=INK_MID, width=2)
                d.ellipse([bx + ox - 2, by - 2, bx + ox + 2, by + 2], fill=(248, 224, 118, 255))


def draw_wrought_scroll(
    d: ImageDraw.ImageDraw,
    x0: float,
    y_mid: float,
    x1: float,
    amp: float,
    iron_rgb: tuple[int, int, int],
    brass_rgb: tuple[int, int, int] | None = None,
) -> None:
    """Draws forged iron bar + scrollwork volutes + optional brass rivets."""
    hi = blend_rgb(iron_rgb, (190, 200, 212), 0.42)
    # Main bar
    d.line([(x0, y_mid), (x1, y_mid)], fill=INK, width=14)
    d.line([(x0, y_mid), (x1, y_mid)], fill=(*iron_rgb, 255), width=8)
    d.line([(x0, y_mid - 2), (x1, y_mid - 2)], fill=hi, width=2)
    # S-scroll medallions along span
    span = x1 - x0
    n_sc = max(1, int(span / 46))
    for i in range(n_sc):
        mx = x0 + (i + 0.5) * (span / n_sc)
        r = min(amp, span / (n_sc * 2.5))
        if r >= 6:
            d.ellipse([mx - r, y_mid - r, mx + r, y_mid + r], outline=INK, width=7)
            d.ellipse([mx - r, y_mid - r, mx + r, y_mid + r], outline=(*iron_rgb, 255), width=3)
            if brass_rgb is not None:
                d.ellipse([mx - 5, y_mid - 5, mx + 5, y_mid + 5], fill=(*brass_rgb, 255), outline=INK, width=2)


# =============================================================================
# MANIFEST, DCPACK & DARK-CHECKERBOARD QA SHEET HELPERS
# =============================================================================
def save_qa_sheet(
    entries: list[tuple[str, Image.Image]],
    out_path: Path,
    cols: int = 8,
    cw: int = 200,
    ch: int = 120,
) -> None:
    """Saves a crisp dark-checkerboard QA contact sheet for visual verification via read_file."""
    if not entries:
        return
    rows = max(1, math.ceil(len(entries) / cols))
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (26, 28, 36, 255))
    sd = ImageDraw.Draw(sheet)
    for y in range(0, rows * ch, 14):
        for x in range(0, cols * cw, 14):
            if ((x // 14) + (y // 14)) % 2 == 0:
                sd.rectangle([x, y, x + 13, y + 13], fill=(40, 44, 54, 255))
    for i, (label, im) in enumerate(entries):
        r, c = divmod(i, cols)
        sc = min((cw - 14) / max(1, im.width), (ch - 26) / max(1, im.height))
        nw, nh = max(1, int(im.width * sc)), max(1, int(im.height * sc))
        th = im.resize((nw, nh), Image.Resampling.LANCZOS)
        sheet.alpha_composite(th, (c * cw + (cw - nw) // 2, r * ch + (ch - 20 - nh) // 2))
        sd.rectangle([c * cw, (r + 1) * ch - 19, (c + 1) * cw - 1, (r + 1) * ch - 1], fill=(14, 16, 22, 236))
        sd.text((c * cw + 4, (r + 1) * ch - 15), label[:28], fill=(235, 240, 248, 255))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(out_path, "PNG")
    print(f"  QA sheet -> {out_path} ({len(entries)} items, {cols*cw}x{rows*ch})")


def upsert_manifest_entries(manifest_path: Path, new_entries: list[dict]) -> int:
    """Upserts asset entries by `path` into a pack manifest.json and updates assetCount."""
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = data.get("assets", [])
    by_path = {a["path"]: i for i, a in enumerate(assets)}
    for entry in new_entries:
        p = entry["path"]
        if p in by_path:
            assets[by_path[p]] = entry
        else:
            by_path[p] = len(assets)
            assets.append(entry)
    data["assets"] = assets
    if "assetCount" in data:
        data["assetCount"] = len(assets)
    manifest_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    return len(assets)


def dominant_hex(im: Image.Image) -> str:
    arr = np.array(im.convert("RGBA"))
    mask = arr[:, :, 3] > 60
    if not np.any(mask):
        return "#808080"
    rgb = arr[mask][:, :3].mean(axis=0)
    return f"#{int(rgb[0]):02X}{int(rgb[1]):02X}{int(rgb[2]):02X}"


def repack_all_dcpacks() -> None:
    """Repacks starter, core-fantasy, and modular-suite .dcpack zip archives cleanly."""
    for src_d, pack_name in [
        (STARTER_DIR, "DiceChaos_Berlin_Magipunk_Starter.dcpack"),
        (CORE_DIR, "DiceChaos_Core_Fantasy_CC0.dcpack"),
        (MOD_DIR, "DiceChaos_Modular_Suite_CC0.dcpack"),
    ]:
        dst = ASSETS_ROOT / pack_name
        if not src_d.is_dir():
            continue
        with zipfile.ZipFile(dst, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            for f in sorted(src_d.rglob("*")):
                if f.is_file():
                    zf.write(f, f.relative_to(src_d).as_posix())
        print(f"  Repacked {pack_name} ({dst.stat().st_size / (1024*1024):.2f} MB)")

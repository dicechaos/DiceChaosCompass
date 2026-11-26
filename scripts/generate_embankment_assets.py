#!/usr/bin/env python3
"""
Dice Chaos Compass — Steep Embankment, Cliff & Directional Slope Asset Pack (CC0)
==============================================================================
Generates 12 high-craft, 2x-supersampled "Crisp Hand-Inked Tabletop" elevation
assets (8 seamless horizontal embankment/cliff paths @ 512x256 + 4 seamless
directional slope terrains @ 512x512) and appends/updates them cleanly inside:
  - public/assets/modular-suite-cc0/{paths,terrain}/
  - public/assets/modular-suite-cc0/manifest.json
  - public/assets/DiceChaos_Modular_Suite_CC0.dcpack

Orientation Convention (strictly consistent across all 12 assets):
  - Embankment Paths (512x256):
      TOP edge (y=0)    = HIGH CREST (sunlit rim highlight, crisp lip)
      BOTTOM edge (y=H) = LOW TOE    (deep atmospheric shadow fading smoothly to alpha=0)
      In-app "Flip Slope / Side" mirrors Y so uphill/downhill reverses in 1 click!
  - Directional Slope Terrains (512x512):
      Seamless toroidal tiling with strong downhill striations/terraces flowing
      LEFT -> RIGHT (angle 0 deg = Downhill East). Rotating `rotationDeg` in the
      Terrain Inspector (0..360 deg) aims the steep gradient in ANY direction!
"""

from __future__ import annotations

import json
import math
import pathlib
import random
import zipfile
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets" / "modular-suite-cc0"
DCPACK_PATH = ROOT / "public" / "assets" / "DiceChaos_Modular_Suite_CC0.dcpack"

INK = (26, 21, 18, 255)
INK_SOFT = (26, 21, 18, 170)

RD_DARK = (112, 12, 12, 255)
RD_MID = (212, 24, 24, 255)
RD_BRIGHT = (248, 52, 52, 255)
RD_HI = (255, 138, 138, 255)


def clamp(v: float, lo: int = 0, hi: int = 255) -> int:
    return max(lo, min(hi, int(round(v))))


def shade(rgb: tuple[int, int, int], f: float, a: int = 255) -> tuple[int, int, int, int]:
    return (clamp(rgb[0] * f), clamp(rgb[1] * f), clamp(rgb[2] * f), a)


def jitter(rng: random.Random, rgb: tuple[int, int, int], amt: int = 10, a: int = 255) -> tuple[int, int, int, int]:
    d = rng.randint(-amt, amt)
    return (
        clamp(rgb[0] + d + rng.randint(-3, 3)),
        clamp(rgb[1] + d + rng.randint(-3, 3)),
        clamp(rgb[2] + d + rng.randint(-3, 3)),
        a,
    )


def add_grain(img: Image.Image, seed: int, strength: int = 7, seamless: bool = False) -> Image.Image:
    rng = random.Random(seed)
    w, h = img.size
    gw, gh = max(32, w // 2), max(32, h // 2)
    noise = Image.new("L", (gw, gh), 128)
    px = noise.load()
    for y in range(gh):
        for x in range(gw):
            px[x, y] = clamp(128 + rng.randint(-strength, strength))
    noise = noise.resize((w, h), Image.Resampling.BILINEAR)
    if seamless:
        noise = ImageChops.blend(noise, ImageChops.offset(noise, w // 2, h // 2), 0.35)
    r, g, b, a = img.split()
    return Image.merge(
        "RGBA",
        (
            ImageChops.add(r, noise, scale=1, offset=-128),
            ImageChops.add(g, noise, scale=1, offset=-128),
            ImageChops.add(b, noise, scale=1, offset=-128),
            a,
        ),
    )


def dominant_hex(img: Image.Image) -> str:
    small = img.resize((24, 24), Image.Resampling.BILINEAR).convert("RGBA")
    rs = gs = bs = cnt = 0
    for r, g, b, a in small.get_flattened_data():
        if a > 120:
            rs += r
            gs += g
            bs += b
            cnt += 1
    if cnt == 0:
        return "#64748B"
    return f"#{rs // cnt:02X}{gs // cnt:02X}{bs // cnt:02X}"


def apply_vertical_slope_lighting_and_fade(
    img: Image.Image,
    crest_y_frac: float = 0.08,
    toe_fade_start: float = 0.72,
    shadow_strength: float = 0.62,
    dd_red: bool = False,
) -> Image.Image:
    """
    Applies crisp uphill rim lighting near the top crest, rich darkening down the
    steep face, and a soft organic toe fade at the bottom so embankment paths
    blend smoothly onto any lower map terrain!
    """
    w, h = img.size
    px = img.load()
    for y in range(h):
        v = y / max(1, h - 1)
        # Depth lighting multiplier: bright at crest, dark descending into drop shadow
        if v < crest_y_frac:
            light = 1.0 + 0.14 * (v / max(0.01, crest_y_frac))
        else:
            t = (v - crest_y_frac) / max(0.01, 1.0 - crest_y_frac)
            light = 1.14 - shadow_strength * (t ** 1.15)
        # Smooth alpha fade at the very top edge and bottom toe
        alpha_mul = 1.0
        if v < 0.03:
            alpha_mul = v / 0.03
        elif v > toe_fade_start:
            alpha_mul = max(0.0, 1.0 - ((v - toe_fade_start) / max(0.01, 1.0 - toe_fade_start)) ** 1.35)
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            na = clamp(a * alpha_mul)
            if dd_red and r > g + 35 and abs(g - b) < 12:
                # Preserve exact g==b red-mask purity while still shading luminance!
                nr = clamp(r * light)
                ng = clamp(g * light)
                px[x, y] = (nr, ng, ng, na)
            else:
                px[x, y] = (clamp(r * light), clamp(g * light), clamp(b * light), na)
    return img


# ============================================================================
# 1. EIGHT SEAMLESS HORIZONTAL STEEP EMBANKMENT & CLIFF PATHS (512x256)
# ============================================================================

def gen_urban_masonry_embankment(seed: int) -> Image.Image:
    """Stepped Prussian granite retaining wall, buttress piers, mossy ledges & drain arches."""
    rng = random.Random(seed)
    W, H = 512, 256
    SW, SH = W * 2, H * 2
    im = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Steep terraced stone & mossy hillside body from crest (y=26) down to toe (y=470)
    d.rectangle([0, 28, SW, 470], fill=(78, 84, 92, 255))

    # Downhill stepped stone courses (getting denser & darker as they descend)
    course_ys = [30, 82, 146, 214, 284, 352, 412, 466]
    stone_palette = [(134, 138, 144), (118, 122, 128), (102, 108, 116), (88, 94, 102), (76, 82, 90), (66, 72, 80), (56, 62, 70)]
    for ci in range(len(course_ys) - 1):
        y0, y1 = course_ys[ci], course_ys[ci + 1]
        base_c = stone_palette[ci]
        block_w = 128 if ci < 2 else 96 if ci < 5 else 85
        off = (block_w // 2) if ci % 2 == 1 else 0
        for x in range(-block_w, SW + block_w, block_w):
            bx0, bx1 = x + off, x + off + block_w
            col = jitter(rng, base_c, 9)
            d.rectangle([bx0 + 2, y0 + 2, bx1 - 2, y1 - 2], fill=col, outline=INK, width=4)
            # Crisp bright bevel along top lip of each step + cast shadow beneath!
            d.line([bx0 + 6, y0 + 6, bx1 - 6, y0 + 6], fill=shade(col[:3], 1.24), width=4)
            d.line([bx0 + 6, y1 - 5, bx1 - 6, y1 - 5], fill=shade(col[:3], 0.65), width=5)

    # Heavy angled granite buttress ribs jutting downhill every 256px (seamless wrap!)
    for bx in (128, 384, 640, 896):
        pts = [(bx - 28, 30), (bx + 28, 30), (bx + 42, 435), (bx - 42, 435)]
        d.polygon(pts, fill=(116, 120, 126, 255), outline=INK)
        d.line([bx - 26, 30, bx - 40, 435], fill=INK, width=5)
        d.line([bx + 26, 30, bx + 40, 435], fill=INK, width=5)
        d.line([bx - 16, 40, bx - 26, 420], fill=(158, 162, 168, 200), width=6)
        # Buttress cap stone at crest
        d.rounded_rectangle([bx - 34, 18, bx + 34, 64], radius=6, fill=(156, 158, 162, 255), outline=INK, width=5)
        d.line([bx - 28, 25, bx + 28, 25], fill=(208, 210, 214, 255), width=4)

    # Dark recessed stone drainage arches mid-slope between buttresses
    for ax in (256, 768):
        d.rounded_rectangle([ax - 32, 224, ax + 32, 306], radius=24, fill=(24, 28, 34, 255), outline=INK, width=5)
        # Iron bars across drain
        for gx in (ax - 14, ax, ax + 14):
            d.line([gx, 232, gx, 302], fill=(74, 80, 88, 255), width=4)

    # Bright sunlit upper coping stones running along the high crest (y=12..46)
    for x in range(0, SW, 64):
        c = jitter(rng, (168, 166, 158), 8)
        d.rectangle([x + 1, 14, x + 63, 48], fill=c, outline=INK, width=4)
        d.line([x + 4, 19, x + 60, 19], fill=(224, 222, 214, 255), width=5)

    # Moss & damp vine streaks clinging to stone terrace ledges
    for _ in range(42):
        mx = rng.uniform(0, SW)
        my = rng.choice([82, 146, 214, 284, 352]) + rng.uniform(-8, 14)
        rx, ry = rng.uniform(12, 34), rng.uniform(6, 16)
        mc = jitter(rng, (74, 108, 62), 14, 195)
        for ox in (-SW, 0, SW):
            d.ellipse([mx + ox - rx, my - ry, mx + ox + rx, my + ry], fill=mc)

    out = im.resize((W, H), Image.Resampling.LANCZOS)
    out = apply_vertical_slope_lighting_and_fade(out, 0.12, 0.78, 0.56)
    return add_grain(out, seed, 6)


def gen_natural_cliff_embankment(
    seed: int,
    crest_col: tuple[int, int, int],
    face_col: tuple[int, int, int],
    accent_col: tuple[int, int, int],
    style: str = "cliff",
    dd_red: bool = False,
) -> Image.Image:
    """Hand-inked steep natural slope / cliff / grassy hillside / scree / snow ridge."""
    rng = random.Random(seed)
    W, H = 512, 256
    SW, SH = W * 2, H * 2
    im = Image.new("RGBA", (SW, SH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # Organic wavy crest line wrapping seamlessly across SW!
    n_pts = 32
    crest_pts: list[tuple[float, float]] = []
    toe_pts: list[tuple[float, float]] = []
    for i in range(n_pts + 1):
        u = i / n_pts
        x = u * SW
        ang = u * math.tau
        cy = 44 + math.sin(ang * 2 + seed) * 14 + math.cos(ang * 5 + seed * 1.7) * 7
        ty = 448 + math.sin(ang * 3 + seed * 0.8) * 20 + math.cos(ang * 4) * 10
        crest_pts.append((x, cy))
        toe_pts.append((x, ty))

    body_poly = crest_pts + list(reversed(toe_pts))
    base_fill = RD_MID if dd_red else (*face_col, 255)
    d.polygon(body_poly, fill=base_fill)

    # Faceted strata / rock ribs / downhill erosion streaks!
    if style in ("cliff", "mesa", "snow", "colorable"):
        strata = 5 if style == "mesa" else 4
        for s in range(strata):
            f0 = s / strata
            f1 = (s + 1) / strata
            band_pts_top = []
            band_pts_bot = []
            for i in range(n_pts + 1):
                x, cy = crest_pts[i]
                _, ty = toe_pts[i]
                wob0 = math.sin((i / n_pts) * math.tau * 3 + s * 1.9 + seed) * 12
                wob1 = math.sin((i / n_pts) * math.tau * 3 + (s + 1) * 1.9 + seed) * 12
                band_pts_top.append((x, cy + (ty - cy) * f0 + wob0))
                band_pts_bot.append((x, cy + (ty - cy) * f1 + wob1))
            shade_f = 1.12 - s * 0.14
            bcol = (
                (RD_BRIGHT if s == 0 else RD_MID if s == 1 else RD_DARK)
                if dd_red
                else shade(face_col, shade_f)
            )
            d.polygon(band_pts_top + list(reversed(band_pts_bot)), fill=bcol)
            # Crisp ink ledge contour + highlight along every rock stratum
            d.line(band_pts_top, fill=INK, width=5)
            hi_line = [(x, y + 6) for x, y in band_pts_top]
            d.line(hi_line, fill=RD_HI if dd_red else shade(face_col, shade_f + 0.18, 190), width=4)

        # Vertical jagged rock fracture lines plunging downhill (gives instant 3D steepness!)
        for k in range(26):
            rx = (k / 26.0) * SW + rng.uniform(-12, 12)
            idx = int((rx % SW) / SW * n_pts)
            y_start = crest_pts[idx][1] + rng.uniform(2, 22)
            y_end = y_start + rng.uniform(140, 340)
            pts = [(rx, y_start)]
            cx = rx
            for step in range(1, 6):
                cx += rng.uniform(-14, 14)
                cy_s = y_start + (y_end - y_start) * (step / 5.0)
                pts.append((cx, cy_s))
            for ox in (-SW, 0, SW):
                shifted = [(px + ox, py) for px, py in pts]
                d.line(shifted, fill=INK, width=4 if k % 2 == 0 else 3)
                d.line([(px + 5, py) for px, py in shifted], fill=RD_HI if dd_red else shade(face_col, 1.22, 130), width=3)

    elif style == "grass":
        # Rich downhill grassy hachure strokes & eroded loam streaks
        for _ in range(160):
            gx = rng.uniform(0, SW)
            gy = rng.uniform(46, 410)
            ln = rng.uniform(34, 86)
            col = jitter(rng, face_col if rng.random() < 0.72 else accent_col, 14, 210)
            for ox in (-SW, 0, SW):
                d.line([gx + ox, gy, gx + ox + rng.uniform(-8, 8), gy + ln], fill=col, width=rng.randint(5, 11))
        # Dark ink downhill turf contour ticks (classic hand-drawn cartography hachures!)
        for k in range(44):
            hx = (k / 44.0) * SW + rng.uniform(-8, 8)
            hy = rng.uniform(54, 340)
            ln = rng.uniform(36, 92)
            for ox in (-SW, 0, SW):
                d.line([hx + ox, hy, hx + ox + rng.uniform(-6, 6), hy + ln], fill=INK_SOFT, width=3)

    elif style == "scree":
        # Cascading dirt & loose gravel scree gullies
        for _ in range(95):
            gx = rng.uniform(0, SW)
            gy = rng.uniform(50, 390)
            ln = rng.uniform(45, 110)
            col = jitter(rng, face_col, 14, 200)
            for ox in (-SW, 0, SW):
                d.line([gx + ox, gy, gx + ox + rng.uniform(-12, 12), gy + ln], fill=col, width=rng.randint(6, 13))
        # Loose scree pebbles tumbling downslope
        for _ in range(130):
            px, py = rng.uniform(0, SW), rng.uniform(64, 430)
            r = rng.uniform(5, 15) * (0.7 + 0.5 * (py / SH))
            c = jitter(rng, accent_col, 18)
            for ox in (-SW, 0, SW):
                d.ellipse([px + ox - r, py - r * 0.85, px + ox + r, py + r * 0.85], fill=c, outline=INK, width=3)

    elif style == "timber":
        # Timber-braced earth rampart with horizontal log cribbing tiers & iron spikes!
        for tier_y in (64, 152, 246, 342):
            for x in range(0, SW, 256):
                col = jitter(rng, accent_col, 10)
                d.rounded_rectangle([x + 2, tier_y, x + 254, tier_y + 42], radius=10, fill=col, outline=INK, width=5)
                d.line([x + 12, tier_y + 8, x + 242, tier_y + 8], fill=shade(col[:3], 1.2), width=4)
                d.line([x + 12, tier_y + 34, x + 242, tier_y + 34], fill=shade(col[:3], 0.68), width=5)
        # Vertical heavy bracing posts sticking out downhill
        for px in range(64, SW, 128):
            d.ellipse([px - 18, 42, px + 18, 78], fill=shade(accent_col, 0.88), outline=INK, width=5)
            d.ellipse([px - 16, 228, px + 16, 260], fill=shade(accent_col, 0.78), outline=INK, width=5)

    # Sunlit crest lip strip (bright grass / snow cornice / cap stone right along top ridge!)
    lip_poly = [(x, y - 16) for x, y in crest_pts] + [(x, y + 22) for x, y in reversed(crest_pts)]
    lip_fill = RD_HI if dd_red else (*crest_col, 255)
    d.polygon(lip_poly, fill=lip_fill)
    d.line([(x, y - 16) for x, y in crest_pts], fill=INK, width=5)
    d.line([(x, y + 18) for x, y in crest_pts], fill=INK, width=4)

    # Extra scatter pebbles / tufts along the toe
    for _ in range(36):
        px, py = rng.uniform(0, SW), rng.uniform(360, 460)
        r = rng.uniform(5, 13)
        c = RD_DARK if dd_red else jitter(rng, accent_col, 15, 220)
        for ox in (-SW, 0, SW):
            d.ellipse([px + ox - r, py - r * 0.8, px + ox + r, py + r * 0.8], fill=c, outline=INK, width=3)

    out = im.resize((W, H), Image.Resampling.LANCZOS)
    out = apply_vertical_slope_lighting_and_fade(out, 0.14, 0.72, 0.58, dd_red=dd_red)
    return add_grain(out, seed + 17, 6 if not dd_red else 2)


# ============================================================================
# 2. FOUR SEAMLESS DIRECTIONAL SLOPE TERRAINS (512x512, Downhill = 0° East ->)
# ============================================================================

def gen_directional_slope_terrain(
    seed: int,
    base: tuple[int, int, int],
    highlight: tuple[int, int, int],
    accent: tuple[int, int, int],
    style: str = "urban_terraced",
) -> Image.Image:
    """
    Seamless 512x512 directional slope terrain tile where steep strata, retaining
    courses, buttress ribs & downhill streaks flow LEFT -> RIGHT (0° = Downhill East).
    Rotate via `rotationDeg` in Terrain Inspector to aim at ANY angle!
    """
    rng = random.Random(seed)
    S = 512
    im = Image.new("RGBA", (S, S), (*base, 255))
    d = ImageDraw.Draw(im)

    if style == "urban_terraced":
        # Vertical stepped retaining tiers running North-South, descending Left(high) -> Right(low)
        cols = 6
        cw = S / cols
        for c in range(cols):
            x0 = c * cw
            x1 = (c + 1) * cw
            # Each stone terrace tier catches light on its left (uphill) edge and drops shadow to its right!
            for r in range(8):
                y0 = r * 64 + (32 if c % 2 else 0)
                col = jitter(rng, base, 9)
                for oy in (-S, 0, S):
                    by0, by1 = y0 + oy, y0 + oy + 62
                    if by1 < -4 or by0 > S + 4:
                        continue
                    d.rectangle([x0 + 2, by0 + 1, x1 - 2, by1 - 1], fill=col, outline=INK, width=2)
                    # Bright sunlit uphill (left) step edge
                    d.line([x0 + 4, by0 + 3, x0 + 4, by1 - 3], fill=shade(highlight, 1.05), width=3)
                    # Deep cast drop shadow on downhill (right) side of each retaining step
                    d.rectangle([x1 - 11, by0 + 2, x1 - 3, by1 - 2], fill=(16, 20, 28, 130))
        # Downhill stone buttress ribs & drainage channels running horizontally Left -> Right
        for ry in (84, 256, 428):
            d.rectangle([0, ry - 8, S, ry + 8], fill=shade(highlight, 0.92), outline=INK, width=2)
            d.line([0, ry - 4, S, ry - 4], fill=shade(highlight, 1.18), width=2)
            d.rectangle([0, ry + 8, S, ry + 14], fill=(12, 16, 24, 115))
        # Moss tufts wedged into terraced masonry steps
        for _ in range(55):
            mx = rng.choice([int(c * cw) for c in range(cols)]) + rng.uniform(-6, 12)
            my = rng.uniform(0, S)
            rx, ry = rng.uniform(4, 11), rng.uniform(5, 14)
            mc = jitter(rng, accent, 14, 175)
            for ox in (-S, 0, S):
                for oy in (-S, 0, S):
                    if -20 <= mx + ox <= S + 20 and -20 <= my + oy <= S + 20:
                        d.ellipse([mx + ox - rx, my + oy - ry, mx + ox + rx, my + oy + ry], fill=mc)
    else:
        # Organic steep contour terraces (vertical ridges descending Left -> Right)
        bands = 8
        bw = S / bands
        for b in range(bands):
            bx = b * bw
            pts_l: list[tuple[float, float]] = []
            pts_r: list[tuple[float, float]] = []
            for s in range(17):
                u = s / 16.0
                y = u * S
                wob = math.sin(u * math.tau * 2 + b * 1.4 + seed) * 10
                pts_l.append((bx + wob, y))
                pts_r.append((bx + bw + wob, y))
            col = jitter(rng, base, 8)
            for ox in (-S, 0, S):
                poly = [(x + ox, y) for x, y in pts_l] + [(x + ox, y) for x, y in reversed(pts_r)]
                d.polygon(poly, fill=col)
                d.line([(x + ox, y) for x, y in pts_l], fill=INK_SOFT, width=2)
                d.line([(x + ox + 4, y) for x, y in pts_l], fill=shade(highlight, 1.05, 160), width=3)
                d.line([(x + ox - 5, y) for x, y in pts_r], fill=(14, 16, 22, 110), width=5)

        # Downhill striations / hachure lines streaking Left -> Right
        for _ in range(170):
            x = rng.uniform(0, S)
            y = rng.uniform(0, S)
            ln = rng.uniform(18, 52)
            c = jitter(rng, accent if rng.random() < 0.45 else highlight, 14, 155)
            for ox in (-S, 0, S):
                for oy in (-S, 0, S):
                    if -60 <= x + ox <= S + 60 and -20 <= y + oy <= S + 20:
                        d.line([x + ox, y + oy, x + ox + ln, y + oy + rng.uniform(-4, 4)], fill=c, width=2)

        if style == "scree":
            for _ in range(90):
                px, py = rng.uniform(0, S), rng.uniform(0, S)
                r = rng.uniform(2.5, 6.5)
                c = jitter(rng, highlight, 18)
                for ox in (-S, 0, S):
                    for oy in (-S, 0, S):
                        if -15 <= px + ox <= S + 15 and -15 <= py + oy <= S + 15:
                            d.ellipse([px + ox - r, py + oy - r, px + ox + r, py + oy + r], fill=c, outline=INK_SOFT, width=1)

    return add_grain(im, seed + 51, 7, seamless=True)


def main() -> None:
    manifest_path = OUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    existing_by_path: dict[str, dict[str, Any]] = {a["path"]: a for a in manifest["assets"]}

    new_entries: list[dict[str, Any]] = []

    def register(
        rel_path: str,
        img: Image.Image,
        display_name: str,
        category: str,
        tags: list[str],
        draw_mode: str = "normal",
    ) -> None:
        out = OUT_DIR / rel_path
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, "PNG", optimize=True)
        entry = {
            "path": rel_path.replace("\\", "/"),
            "displayName": display_name,
            "category": category,
            "tags": sorted(set(tags + ["embankment", "cliff", "slope", "elevation", "modular_cc0", "cc0"])),
            "drawMode": draw_mode,
            "defaultPpi": 256,
            "castsShadow": False,
            "dominantHex": dominant_hex(img),
            "widthPx": img.width,
            "heightPx": img.height,
        }
        existing_by_path[entry["path"]] = entry
        new_entries.append(entry)

    # 8 Reversible Steep Embankment / Cliff Paths (512x256)
    register(
        "paths/embankment_urban_masonry.png",
        gen_urban_masonry_embankment(801),
        "Steep Urban Masonry Embankment",
        "path",
        ["path", "street", "city", "stone", "retaining_wall", "berlin"],
    )
    register(
        "paths/embankment_grass_hillside.png",
        gen_natural_cliff_embankment(802, (118, 158, 78), (82, 118, 58), (116, 92, 64), "grass"),
        "Steep Grassy Hillside Slope",
        "path",
        ["path", "nature", "forest", "grass", "hill"],
    )
    register(
        "paths/embankment_rocky_cliff.png",
        gen_natural_cliff_embankment(803, (148, 152, 158), (104, 108, 118), (74, 78, 86), "cliff"),
        "Sheer Granite Cliff Drop-Off",
        "path",
        ["path", "nature", "mountain", "rock", "dungeon"],
    )
    register(
        "paths/embankment_dirt_scree.png",
        gen_natural_cliff_embankment(804, (142, 114, 78), (112, 86, 58), (146, 138, 126), "scree"),
        "Eroded Dirt & Gravel Scree Slope",
        "path",
        ["path", "nature", "dirt", "camp", "mining"],
    )
    register(
        "paths/embankment_sandstone_mesa.png",
        gen_natural_cliff_embankment(805, (216, 168, 112), (178, 114, 74), (138, 78, 48), "mesa"),
        "Layered Sandstone Canyon Cliff",
        "path",
        ["path", "desert", "canyon", "rock", "nature"],
    )
    register(
        "paths/embankment_timber_terraced.png",
        gen_natural_cliff_embankment(806, (108, 136, 72), (108, 84, 58), (148, 104, 66), "timber"),
        "Timber-Braced Earth Rampart",
        "path",
        ["path", "camp", "castle", "fort", "mining", "wood"],
    )
    register(
        "paths/embankment_snowy_ridge.png",
        gen_natural_cliff_embankment(807, (234, 242, 250), (132, 152, 174), (92, 112, 136), "snow"),
        "Steep Alpine Snow & Ice Ridge",
        "path",
        ["path", "winter", "snow", "mountain", "nature"],
    )
    register(
        "paths/embankment_colorable_slope.png",
        gen_natural_cliff_embankment(808, (255, 138, 138), (212, 24, 24), (112, 12, 12), "colorable", dd_red=True),
        "Colorable Steep Cliff & Slope",
        "path",
        ["path", "colorable", "dd_red", "nature", "dungeon"],
        draw_mode="dd_red",
    )

    # 4 Rotatable Directional Steep Slope Terrains (512x512)
    register(
        "terrain/slope_urban_terraced_embankment.png",
        gen_directional_slope_terrain(821, (82, 90, 102), (138, 144, 154), (72, 104, 62), "urban_terraced"),
        "Steep Urban Terraced Embankment (Slope)",
        "terrain",
        ["terrain", "street", "city", "stone", "berlin", "retaining_wall"],
    )
    register(
        "terrain/slope_grassy_hill_gradient.png",
        gen_directional_slope_terrain(822, (86, 124, 62), (124, 162, 82), (112, 92, 62), "grass"),
        "Steep Grassy Hillside (Slope)",
        "terrain",
        ["terrain", "nature", "grass", "hill", "forest"],
    )
    register(
        "terrain/slope_rock_scree_gradient.png",
        gen_directional_slope_terrain(823, (94, 98, 108), (144, 148, 158), (68, 72, 82), "scree"),
        "Steep Granite Scree & Cliff (Slope)",
        "terrain",
        ["terrain", "nature", "mountain", "rock", "cavern"],
    )
    register(
        "terrain/slope_sandstone_strata_gradient.png",
        gen_directional_slope_terrain(824, (176, 118, 76), (218, 168, 116), (134, 80, 50), "mesa"),
        "Steep Sandstone Canyon Strata (Slope)",
        "terrain",
        ["terrain", "desert", "canyon", "rock"],
    )

    # Write updated manifest preserving order + repackage .dcpack
    manifest["assets"] = list(existing_by_path.values())
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.write(manifest_path, "manifest.json")
        for item in manifest["assets"]:
            fp = OUT_DIR / item["path"]
            if fp.exists():
                zf.write(fp, item["path"])

    # Also write a quick visual QA contact sheet of all 12 new embankment assets!
    qa_path = pathlib.Path(
        r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch\qa_embankments.png"
    )
    qa_path.parent.mkdir(parents=True, exist_ok=True)
    qa = Image.new("RGBA", (1080, 960), (26, 30, 38, 255))
    qdraw = ImageDraw.Draw(qa)
    # 8 paths in 2x4 grid at top
    for idx in range(8):
        entry = new_entries[idx]
        im = Image.open(OUT_DIR / entry["path"]).convert("RGBA")
        im.thumbnail((500, 150), Image.Resampling.LANCZOS)
        r, c = divmod(idx, 2)
        ox, oy = 20 + c * 530, 16 + r * 172
        qdraw.rectangle([ox - 2, oy - 2, ox + 504, oy + 154], fill=(40, 46, 56, 255), outline=(74, 82, 98, 255))
        qa.alpha_composite(im, (ox + (500 - im.width) // 2, oy))
        qdraw.text((ox + 6, oy + 136), entry["displayName"], fill=(238, 242, 248, 255))
    # 4 slope terrains along bottom row
    for idx in range(4):
        entry = new_entries[8 + idx]
        im = Image.open(OUT_DIR / entry["path"]).convert("RGBA").resize((230, 210), Image.Resampling.LANCZOS)
        ox, oy = 20 + idx * 265, 718
        qa.alpha_composite(im, (ox, oy))
        qdraw.rectangle([ox, oy, ox + 230, oy + 210], outline=(90, 98, 116, 255))
        qdraw.text((ox + 4, oy + 214), entry["displayName"][:32], fill=(238, 242, 248, 255))
    qa.save(qa_path)

    print(f"Generated {len(new_entries)} embankment/slope assets! Total in modular-suite-cc0: {len(manifest['assets'])}")
    print(f"Pack: {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB)")
    print(f"QA:   {qa_path}")


if __name__ == "__main__":
    main()

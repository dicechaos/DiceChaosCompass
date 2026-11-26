#!/usr/bin/env python3
"""
Dice Chaos Compass — Clean-Room CC0 Core Fantasy Essentials Asset Suite Generator
=============================================================================
House Art Style: "Crisp Hand-Inked Tabletop"
  - Strict 90-degree top-down orthographic battlemap perspective
  - Dark sepia-charcoal (#1E1815) hand-inked outlines (2x supersampled + LANCZOS)
  - Warm painterly gouache shading & subtle surface grain
  - 100% seamless toroidal Terrains (512x512) & horizontal-tiling Walls/Paths (512x128)
  - Exact Dungeondraft Red-Mask Colorable assets (pure red/maroon/pink regions
    with crisp dark ink & untouched wood/brass/stone details for `dd_red` shader!)
  - Automatic white-background flood-fill & edge-decontamination slicer for our
    AI-illustrated Hero Prop Sheets in the locked house art style.

Output (100% CC0, safe to ship in open-source GPL-3.0 repo):
  - public/assets/core-fantasy-cc0/{terrain,walls,paths,portals,objects,colorable,hero}/
  - public/assets/core-fantasy-cc0/manifest.json
  - public/assets/DiceChaos_Core_Fantasy_CC0.dcpack
"""

from __future__ import annotations

import json
import math
import pathlib
import random
import zipfile
from collections import deque
from typing import Any

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "assets" / "core-fantasy-cc0"
DCPACK_PATH = ROOT / "public" / "assets" / "DiceChaos_Core_Fantasy_CC0.dcpack"
SCRATCH_HERO_DIR = pathlib.Path(
    r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae"
)

INK = (30, 24, 21, 255)
INK_SOFT = (30, 24, 21, 180)
SHADOW = (14, 11, 10, 95)

# Pure red-channel palette for exact Dungeondraft `dd_red` shader parity
# (g == b strictly so hue == 0 deg; dark maroon -> shadow, pure red -> mid, pink -> highlight!)
DD_RED_DARK = (128, 12, 12, 255)
DD_RED_MID = (224, 22, 22, 255)
DD_RED_BRIGHT = (250, 48, 48, 255)
DD_RED_HI = (255, 132, 132, 255)
DD_RED_PALE = (255, 185, 185, 255)

MANIFEST_ITEMS: list[dict[str, Any]] = []


def clamp(v: float, lo: int = 0, hi: int = 255) -> int:
    return max(lo, min(hi, int(round(v))))


def shade(rgb: tuple[int, int, int], factor: float, alpha: int = 255) -> tuple[int, int, int, int]:
    return (clamp(rgb[0] * factor), clamp(rgb[1] * factor), clamp(rgb[2] * factor), alpha)


def jitter_rgb(rng: random.Random, rgb: tuple[int, int, int], amt: int = 12) -> tuple[int, int, int, int]:
    d = rng.randint(-amt, amt)
    return (
        clamp(rgb[0] + d + rng.randint(-4, 4)),
        clamp(rgb[1] + d + rng.randint(-4, 4)),
        clamp(rgb[2] + d + rng.randint(-4, 4)),
        255,
    )


def add_painterly_grain(img: Image.Image, seed: int, strength: int = 9, seamless: bool = False) -> Image.Image:
    """Adds subtle organic gouache paper/stone grain without disturbing alpha."""
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
        # Blend shifted copy for smooth wrap
        noise = ImageChops.blend(noise, ImageChops.offset(noise, w // 2, h // 2), 0.35)
    r, g, b, a = img.split()
    def apply_ch(ch: Image.Image) -> Image.Image:
        # Center grain around 0
        return ImageChops.add(ch, noise, scale=1, offset=-128)
    return Image.merge("RGBA", (apply_ch(r), apply_ch(g), apply_ch(b), a))


def dominant_hex(img: Image.Image) -> str:
    small = img.resize((32, 32), Image.Resampling.BILINEAR).convert("RGBA")
    r_sum = g_sum = b_sum = cnt = 0
    for r, g, b, a in small.getdata():
        if a > 120:
            r_sum += r
            g_sum += g
            b_sum += b
            cnt += 1
    if cnt == 0:
        return "#7C8A9E"
    return f"#{r_sum // cnt:02X}{g_sum // cnt:02X}{b_sum // cnt:02X}"


def save_asset(
    rel_path: str,
    img: Image.Image,
    display_name: str,
    category: str,
    tags: list[str],
    draw_mode: str = "normal",
    default_ppi: int = 256,
    casts_shadow: bool = True,
) -> None:
    out = OUT_DIR / rel_path
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, "PNG", optimize=True)
    MANIFEST_ITEMS.append(
        {
            "path": rel_path.replace("\\", "/"),
            "displayName": display_name,
            "category": category,
            "tags": sorted(set(tags + ["core_fantasy", "cc0"])),
            "drawMode": draw_mode,
            "defaultPpi": default_ppi,
            "castsShadow": casts_shadow,
            "dominantHex": dominant_hex(img),
            "widthPx": img.width,
            "heightPx": img.height,
        }
    )


def make_ss(w: int, h: int, bg: tuple[int, int, int, int] = (0, 0, 0, 0)) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    im = Image.new("RGBA", (w * 2, h * 2), bg)
    return im, ImageDraw.Draw(im)


def finish_ss(im: Image.Image, w: int, h: int, seed: int, grain: int = 7) -> Image.Image:
    out = im.resize((w, h), Image.Resampling.LANCZOS)
    if grain > 0:
        out = add_painterly_grain(out, seed, grain)
    return out


# ============================================================================
# 1. SEAMLESS TILING TERRAINS (24 x 512x512)
# ============================================================================

def draw_wrapped_ellipse(d: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, size: int, **kw: Any) -> None:
    for ox in (-size, 0, size):
        for oy in (-size, 0, size):
            x0, y0 = cx + ox - rx, cy + oy - ry
            x1, y1 = cx + ox + rx, cy + oy + ry
            if x1 >= -4 and x0 <= size + 4 and y1 >= -4 and y0 <= size + 4:
                d.ellipse([x0, y0, x1, y1], **kw)


def draw_wrapped_poly(d: ImageDraw.ImageDraw, pts: list[tuple[float, float]], size: int, **kw: Any) -> None:
    for ox in (-size, 0, size):
        for oy in (-size, 0, size):
            shifted = [(x + ox, y + oy) for x, y in pts]
            xs = [p[0] for p in shifted]
            ys = [p[1] for p in shifted]
            if max(xs) >= -4 and min(xs) <= size + 4 and max(ys) >= -4 and min(ys) <= size + 4:
                d.polygon(shifted, **kw)


def gen_organic_terrain(
    seed: int,
    base: tuple[int, int, int],
    spots: list[tuple[tuple[int, int, int], int, int, int]],
    speckles: list[tuple[tuple[int, int, int], int, int]] | None = None,
    strokes: list[tuple[tuple[int, int, int], int, int]] | None = None,
) -> Image.Image:
    rng = random.Random(seed)
    S = 512
    im = Image.new("RGBA", (S, S), (*base, 255))
    d = ImageDraw.Draw(im)
    for col, count, rmin, rmax in spots:
        for _ in range(count):
            cx, cy = rng.uniform(0, S), rng.uniform(0, S)
            rx, ry = rng.uniform(rmin * 1.4, rmax * 1.7), rng.uniform(rmin * 1.4, rmax * 1.7)
            c = jitter_rgb(rng, col, 8)
            draw_wrapped_ellipse(d, cx, cy, rx, ry, S, fill=(c[0], c[1], c[2], 44))
    im = im.filter(ImageFilter.GaussianBlur(radius=16.0))
    d = ImageDraw.Draw(im)
    if strokes:
        for col, count, length in strokes:
            for _ in range(count):
                x = rng.uniform(0, S)
                y = rng.uniform(0, S)
                ang = rng.uniform(-0.7, 0.7) - math.pi / 2
                dx = math.cos(ang) * length
                dy = math.sin(ang) * length
                c = jitter_rgb(rng, col, 12)
                for ox in (-S, 0, S):
                    for oy in (-S, 0, S):
                        if -20 <= x + ox <= S + 20 and -20 <= y + oy <= S + 20:
                            d.line([x + ox, y + oy, x + ox + dx, y + oy + dy], fill=(c[0], c[1], c[2], 145), width=2)
    if speckles:
        for col, count, rmax in speckles:
            for _ in range(count):
                cx, cy = rng.uniform(0, S), rng.uniform(0, S)
                r = rng.uniform(1.5, rmax)
                c = jitter_rgb(rng, col, 14)
                draw_wrapped_ellipse(d, cx, cy, r, r, S, fill=c, outline=(30, 24, 21, 75))
    return add_painterly_grain(im, seed + 77, 8, seamless=True)


def gen_flagstone_terrain(
    seed: int,
    mortar: tuple[int, int, int],
    stone: tuple[int, int, int],
    cols: int,
    rows: int,
    moss: tuple[int, int, int] | None = None,
    cracks: bool = True,
    checker: tuple[int, int, int] | None = None,
) -> Image.Image:
    rng = random.Random(seed)
    S = 512
    im = Image.new("RGBA", (S, S), (*mortar, 255))
    d = ImageDraw.Draw(im)
    cw, rh = S / cols, S / rows
    gap = 4
    for r in range(rows):
        offset = (cw * 0.5) if (r % 2 == 1 and checker is None) else 0.0
        for c in range(cols):
            x0 = c * cw + offset
            y0 = r * rh
            base_c = checker if (checker is not None and (r + c) % 2 == 1) else stone
            fill = jitter_rgb(rng, base_c, 11)
            hi = shade(fill[:3], 1.14)
            lo = shade(fill[:3], 0.84)
            for ox in (-S, 0, S):
                bx0, by0 = x0 + ox + gap, y0 + gap
                bx1, by1 = x0 + ox + cw - gap, y0 + rh - gap
                if bx1 < -4 or bx0 > S + 4:
                    continue
                d.rounded_rectangle([bx0, by0, bx1, by1], radius=6 if checker is None else 2, fill=fill, outline=INK, width=2)
                d.line([bx0 + 4, by0 + 3, bx1 - 4, by0 + 3], fill=hi, width=2)
                d.line([bx0 + 4, by1 - 3, bx1 - 4, by1 - 3], fill=lo, width=2)
                if cracks and rng.random() < 0.25:
                    mx = rng.uniform(bx0 + 8, bx1 - 8)
                    my = rng.uniform(by0 + 8, by1 - 8)
                    d.line([mx, my, mx + rng.uniform(-16, 16), my + rng.uniform(-14, 14)], fill=(30, 24, 21, 130), width=1)
    if moss:
        for _ in range(42):
            cx, cy = rng.uniform(0, S), rng.uniform(0, S)
            rx, ry = rng.uniform(5, 16), rng.uniform(4, 12)
            mc = jitter_rgb(rng, moss, 12)
            draw_wrapped_ellipse(d, cx, cy, rx, ry, S, fill=(mc[0], mc[1], mc[2], 155))
    return add_painterly_grain(im, seed + 13, 9, seamless=True)


def gen_plank_terrain(seed: int, wood: tuple[int, int, int], planks: int = 8) -> Image.Image:
    rng = random.Random(seed)
    S = 512
    im = Image.new("RGBA", (S, S), shade(wood, 0.42))
    d = ImageDraw.Draw(im)
    ph = S / planks
    for row in range(planks):
        y0 = int(row * ph)
        y1 = int((row + 1) * ph) - 2
        seam_x = rng.randint(60, S - 60)
        segs = [(0, seam_x - 2), (seam_x + 2, S)]
        for sx0, sx1 in segs:
            col = jitter_rgb(rng, wood, 14)
            d.rectangle([sx0, y0 + 1, sx1, y1], fill=col)
            # Subtle wood grain lines
            for _ in range(4):
                gy = rng.uniform(y0 + 5, y1 - 4)
                gc = shade(col[:3], rng.choice([0.86, 1.09]), 135)
                d.line([sx0 + 2, gy, sx1 - 2, gy], fill=gc, width=2)
            # Highlight top lip + ink bottom border
            d.line([sx0, y0 + 2, sx1, y0 + 2], fill=shade(col[:3], 1.15, 150), width=1)
            d.line([sx0, y1, sx1, y1], fill=INK, width=2)
            # Hand-inked iron nail heads near plank butt seam
            for nx in (sx0 + 9, sx1 - 9):
                if 4 < nx < S - 4:
                    for ny in (y0 + 12, y1 - 12):
                        d.ellipse([nx - 2.5, ny - 2.5, nx + 2.5, ny + 2.5], fill=INK)
        d.line([seam_x, y0, seam_x, y1], fill=INK, width=3)
    return add_painterly_grain(im, seed + 31, 8, seamless=True)


def generate_terrains() -> None:
    terrains = [
        # Wilderness & Camp
        ("meadow_grass", "Lush Meadow Grass", ["wilderness", "grass", "meadow", "forest"],
         lambda: gen_organic_terrain(101, (88, 128, 62), [((104, 148, 70), 36, 18, 46), ((68, 102, 48), 32, 16, 40)],
                                     strokes=[((124, 168, 82), 190, 9), ((52, 82, 36), 140, 8)])),
        ("wildflower_meadow", "Wildflower Meadow", ["wilderness", "grass", "flowers", "meadow"],
         lambda: gen_organic_terrain(102, (86, 126, 60), [((105, 148, 72), 34, 18, 44), ((68, 100, 48), 28, 14, 36)],
                                     strokes=[((122, 166, 80), 160, 8)],
                                     speckles=[((246, 224, 110), 42, 4.2), ((238, 130, 146), 28, 3.8), ((242, 244, 248), 34, 3.4)])),
        ("forest_moss_floor", "Deep Forest Moss", ["wilderness", "forest", "moss", "woods"],
         lambda: gen_organic_terrain(103, (56, 82, 46), [((74, 108, 56), 38, 18, 48), ((44, 58, 36), 34, 16, 44), ((76, 58, 42), 16, 14, 32)],
                                     strokes=[((92, 128, 68), 150, 7)], speckles=[((118, 86, 54), 30, 3.5)])),
        ("dirt_trail_earth", "Packed Dirt & Earth", ["wilderness", "camp", "dirt", "road"],
         lambda: gen_organic_terrain(104, (128, 100, 70), [((148, 118, 84), 34, 18, 48), ((98, 74, 50), 36, 16, 42)],
                                     speckles=[((164, 146, 124), 48, 4.5), ((82, 64, 48), 40, 3.5)])),
        ("muddy_mire", "Muddy Bog & Mire", ["wilderness", "swamp", "mud", "camp"],
         lambda: gen_organic_terrain(105, (76, 62, 48), [((54, 44, 34), 38, 18, 52), ((92, 78, 58), 26, 16, 38), ((62, 82, 54), 16, 12, 28)],
                                     speckles=[((110, 122, 124), 22, 5.5)])),
        ("autumn_leaf_litter", "Autumn Leaf Litter", ["wilderness", "autumn", "forest", "leaves"],
         lambda: gen_organic_terrain(106, (94, 72, 46), [((128, 82, 42), 34, 16, 42), ((72, 52, 34), 30, 16, 40)],
                                     speckles=[((208, 118, 42), 85, 5.5), ((176, 62, 36), 65, 5.0), ((226, 174, 62), 60, 4.8)])),
        ("rocky_cliff_slate", "Mountain Slate & Scree", ["wilderness", "rock", "mountain", "cave"],
         lambda: gen_organic_terrain(107, (98, 102, 108), [((120, 124, 130), 34, 18, 46), ((72, 76, 82), 38, 16, 44)],
                                     speckles=[((142, 146, 152), 55, 6.0), ((58, 62, 68), 50, 5.0)])),
        ("sandy_riverbank", "Warm Riverbank Sand", ["wilderness", "sand", "coast", "beach"],
         lambda: gen_organic_terrain(108, (194, 172, 132), [((210, 188, 148), 32, 22, 54), ((170, 146, 108), 30, 18, 48)],
                                     speckles=[((152, 136, 114), 45, 3.2), ((226, 212, 182), 45, 3.0)])),
        ("winter_snowfield", "Crisp Winter Snow", ["wilderness", "snow", "winter", "ice"],
         lambda: gen_organic_terrain(109, (226, 234, 242), [((242, 248, 254), 36, 24, 58), ((194, 210, 226), 34, 20, 52)],
                                     speckles=[((176, 194, 214), 24, 3.5)])),
        # Dungeon & Crypt
        ("dungeon_flagstone", "Dungeon Hewn Flagstone", ["dungeon", "crypt", "stone", "floor"],
         lambda: gen_flagstone_terrain(110, (36, 34, 38), (104, 102, 108), 5, 5, cracks=True)),
        ("crypt_mossy_cobble", "Mossy Crypt Cobbles", ["dungeon", "crypt", "moss", "stone"],
         lambda: gen_flagstone_terrain(111, (34, 38, 32), (90, 94, 90), 6, 6, moss=(72, 112, 58), cracks=True)),
        ("cavern_rough_stone", "Rough Cavern Floor", ["dungeon", "cave", "underground", "rock"],
         lambda: gen_organic_terrain(112, (64, 62, 66), [((82, 78, 82), 38, 20, 52), ((46, 44, 48), 42, 18, 48)],
                                     speckles=[((100, 96, 100), 45, 5.5), ((34, 32, 36), 45, 4.5)])),
        ("volcanic_basalt", "Volcanic Cracked Basalt", ["dungeon", "lava", "basalt", "cave"],
         lambda: gen_flagstone_terrain(113, (214, 78, 24), (56, 52, 58), 5, 5, cracks=True)),
        ("soot_ash_floor", "Scorched Ash & Cinders", ["dungeon", "ash", "ruin", "dark"],
         lambda: gen_organic_terrain(114, (54, 52, 54), [((74, 70, 72), 36, 18, 46), ((36, 34, 36), 38, 16, 44)],
                                     speckles=[((216, 98, 38), 16, 3.2), ((104, 100, 102), 40, 3.5)])),
        ("sewer_wet_brick", "Damp Sewer Masonry", ["dungeon", "sewer", "brick", "wet"],
         lambda: gen_flagstone_terrain(115, (32, 44, 38), (82, 92, 86), 8, 6, moss=(62, 102, 66), cracks=False)),
        # Tavern & Mansion
        ("tavern_oak_planks", "Warm Oak Tavern Planks", ["tavern", "inn", "wood", "floor", "interior"],
         lambda: gen_plank_terrain(116, (146, 102, 62), planks=8)),
        ("aged_dark_floorboards", "Aged Dark Inn Floorboards", ["tavern", "mansion", "wood", "dark", "interior"],
         lambda: gen_plank_terrain(117, (96, 68, 46), planks=8)),
        ("mansion_checkered_marble", "Mansion Checkered Marble", ["mansion", "castle", "marble", "noble", "interior"],
         lambda: gen_flagstone_terrain(118, (48, 44, 42), (222, 214, 198), 6, 6, cracks=False, checker=(68, 72, 80))),
        ("terracotta_courtyard", "Terracotta Courtyard Tile", ["mansion", "tavern", "tile", "courtyard"],
         lambda: gen_flagstone_terrain(119, (68, 52, 42), (172, 102, 72), 6, 6, cracks=True)),
        ("royal_sandstone_paving", "Royal Sandstone Paving", ["castle", "mansion", "sandstone", "courtyard"],
         lambda: gen_flagstone_terrain(120, (86, 74, 56), (192, 172, 134), 5, 5, cracks=True)),
        ("stable_straw_floor", "Woven Stable Straw", ["tavern", "camp", "straw", "barn"],
         lambda: gen_organic_terrain(121, (164, 136, 76), [((186, 158, 92), 34, 18, 46), ((130, 104, 54), 32, 16, 40)],
                                     strokes=[((214, 186, 110), 260, 16), ((118, 92, 46), 160, 14)])),
        # Castle & Water
        ("castle_keep_ashlar", "Castle Keep Cut Stone", ["castle", "stone", "keep", "floor"],
         lambda: gen_flagstone_terrain(122, (46, 48, 54), (132, 136, 142), 4, 4, cracks=True)),
        ("shallow_creek_bed", "Clear Creek Pebbles", ["wilderness", "water", "stream", "pebbles"],
         lambda: gen_organic_terrain(123, (64, 128, 138), [((82, 152, 160), 34, 20, 50), ((48, 98, 112), 32, 18, 46)],
                                     speckles=[((144, 136, 122), 54, 6.0), ((188, 224, 232), 26, 4.0)])),
        ("deep_pond_water", "Deep Shimmering Water", ["wilderness", "water", "pond", "moat"],
         lambda: gen_organic_terrain(124, (34, 78, 106), [((48, 106, 136), 38, 22, 56), ((24, 54, 78), 36, 20, 50)],
                                     strokes=[((134, 198, 218), 90, 22)])),
    ]
    for slug, name, tags, fn in terrains:
        save_asset(f"terrain/{slug}.png", fn(), name, "terrain", tags, default_ppi=256, casts_shadow=False)


# ============================================================================
# 2. SEAMLESS SMART WALLS (16 x 512x128)
# ============================================================================

def gen_masonry_wall(seed: int, stone: tuple[int, int, int], mortar: tuple[int, int, int], blocks: int = 8, mossy: bool = False, colorable: bool = False) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    y0, y1 = 44, H - 44
    d.rectangle([0, y0, W, y1], fill=(*mortar, 255))
    bw = W / blocks
    # Two staggered courses of hand-inked masonry
    for row, (ry0, ry1) in enumerate([(y0 + 6, H // 2 - 2), (H // 2 + 2, y1 - 6)]):
        off = bw * 0.5 if row == 1 else 0
        for c in range(-1, blocks + 2):
            bx0 = c * bw + off + 4
            bx1 = (c + 1) * bw + off - 4
            if bx1 < -4 or bx0 > W + 4:
                continue
            fill = (
                rng.choice([DD_RED_MID, DD_RED_BRIGHT, DD_RED_DARK])
                if colorable
                else jitter_rgb(rng, stone, 13)
            )
            d.rounded_rectangle([bx0, ry0, bx1, ry1], radius=8, fill=fill, outline=INK, width=5)
            d.line([bx0 + 10, ry0 + 6, bx1 - 10, ry0 + 6], fill=DD_RED_HI if colorable else shade(fill[:3], 1.18), width=4)
            d.line([bx0 + 10, ry1 - 6, bx1 - 10, ry1 - 6], fill=DD_RED_DARK if colorable else shade(fill[:3], 0.78), width=4)
    if mossy:
        for _ in range(18):
            mx = rng.uniform(10, W - 10)
            my = rng.uniform(y0, y1)
            d.ellipse([mx - 16, my - 10, mx + 16, my + 10], fill=(74, 118, 56, 200))
    d.line([0, y0, W, y0], fill=INK, width=8)
    d.line([0, y1, W, y1], fill=INK, width=8)
    return finish_ss(im, 512, 128, seed, 6)


def gen_timber_wall(seed: int, plaster: tuple[int, int, int], beam: tuple[int, int, int], posts: int = 4, colorable: bool = False) -> Image.Image:
    im, d = make_ss(512, 128)
    W, H = im.size
    y0, y1 = 48, H - 48
    fill = DD_RED_MID if colorable else (*plaster, 255)
    d.rectangle([0, y0, W, y1], fill=fill)
    d.line([0, y0 + 8, W, y0 + 8], fill=DD_RED_HI if colorable else shade(plaster, 1.12), width=6)
    d.line([0, y1 - 8, W, y1 - 8], fill=DD_RED_DARK if colorable else shade(plaster, 0.82), width=6)
    d.line([0, y0, W, y0], fill=INK, width=8)
    d.line([0, y1, W, y1], fill=INK, width=8)
    step = W / posts
    for i in range(posts + 1):
        cx = i * step
        d.rounded_rectangle([cx - 26, y0 - 12, cx + 26, y1 + 12], radius=8, fill=(*beam, 255), outline=INK, width=6)
        d.rounded_rectangle([cx - 14, y0 - 2, cx + 14, y1 + 2], radius=4, fill=shade(beam, 1.18))
    return finish_ss(im, 512, 128, seed, 6)


def gen_log_palisade_wall(seed: int, wood: tuple[int, int, int], logs: int = 12) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    cy = H // 2
    step = W / logs
    # Horizontal tie rails
    d.rectangle([0, cy - 26, W, cy + 26], fill=shade(wood, 0.72), outline=INK, width=6)
    for i in range(logs + 1):
        cx = i * step
        r = step * 0.46
        c = jitter_rgb(rng, wood, 14)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c, outline=INK, width=6)
        d.ellipse([cx - r * 0.62, cy - r * 0.62, cx + r * 0.62, cy + r * 0.62], fill=shade(c[:3], 1.22), outline=shade(c[:3], 0.65), width=3)
        d.ellipse([cx - r * 0.25, cy - r * 0.25, cx + r * 0.25, cy + r * 0.25], outline=shade(c[:3], 0.65), width=2)
    return finish_ss(im, 512, 128, seed, 5)


def gen_hedge_wall(seed: int) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    cy = H // 2
    for i in range(42):
        cx = (i / 42.0) * W + rng.uniform(-14, 14)
        oy = rng.uniform(-24, 24)
        r = rng.uniform(34, 52)
        c = jitter_rgb(rng, rng.choice([(62, 102, 46), (78, 124, 54), (48, 82, 38)]), 10)
        for ox in (-W, 0, W):
            if -60 <= cx + ox <= W + 60:
                d.ellipse([cx + ox - r, cy + oy - r, cx + ox + r, cy + oy + r], fill=c, outline=INK, width=5)
                d.ellipse([cx + ox - r * 0.55, cy + oy - r * 0.65, cx + ox + r * 0.35, cy + oy + r * 0.2], fill=shade(c[:3], 1.22, 165))
    return finish_ss(im, 512, 128, seed, 6)


def gen_iron_bars_wall(seed: int, gilded: bool = False) -> Image.Image:
    im, d = make_ss(512, 128)
    W, H = im.size
    cy = H // 2
    rail_c = (182, 148, 72) if gilded else (76, 84, 96)
    d.rectangle([0, cy - 16, W, cy + 16], fill=(*rail_c, 255), outline=INK, width=6)
    d.line([0, cy - 6, W, cy - 6], fill=shade(rail_c, 1.32), width=4)
    bars = 10
    step = W / bars
    for i in range(bars + 1):
        cx = i * step
        r = 22 if i % 5 == 0 else 14
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=shade(rail_c, 1.15), outline=INK, width=5)
        d.ellipse([cx - r * 0.4, cy - r * 0.4, cx + r * 0.4, cy + r * 0.4], fill=shade(rail_c, 1.45))
    return finish_ss(im, 512, 128, seed, 3)


def gen_cavern_wall(seed: int) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    cy = H // 2
    for i in range(18):
        cx = (i / 18.0) * W
        rx = rng.uniform(44, 68)
        ry = rng.uniform(42, 62)
        oy = rng.uniform(-16, 16)
        c = jitter_rgb(rng, (84, 80, 86), 14)
        for ox in (-W, 0, W):
            if -80 <= cx + ox <= W + 80:
                d.ellipse([cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry], fill=c, outline=INK, width=6)
                d.ellipse([cx + ox - rx * 0.6, cy + oy - ry * 0.6, cx + ox + rx * 0.3, cy + oy + ry * 0.2], fill=shade(c[:3], 1.24))
    return finish_ss(im, 512, 128, seed, 8)


def generate_walls() -> None:
    walls = [
        ("castle_ashlar_wall", "Castle Hewn Ashlar Wall", ["castle", "wall", "stone"], "normal", lambda: gen_masonry_wall(201, (132, 136, 144), (58, 60, 66), 6)),
        ("dungeon_stone_wall", "Dungeon Rough Stone Wall", ["dungeon", "wall", "stone"], "normal", lambda: gen_masonry_wall(202, (98, 96, 102), (42, 40, 44), 8)),
        ("crypt_mossy_wall", "Mossy Crypt Stone Wall", ["dungeon", "crypt", "moss", "wall"], "normal", lambda: gen_masonry_wall(203, (90, 96, 90), (38, 44, 38), 7, mossy=True)),
        ("cavern_rock_wall", "Natural Cavern Rock Wall", ["dungeon", "cave", "rock", "wall"], "normal", lambda: gen_cavern_wall(204)),
        ("tavern_halftimber_wall", "Tavern Half-Timber Wall", ["tavern", "inn", "wood", "plaster", "wall"], "normal", lambda: gen_timber_wall(205, (216, 204, 178), (112, 74, 44), 4)),
        ("mansion_wainscot_wall", "Mansion Mahogany Wall", ["mansion", "wood", "noble", "wall"], "normal", lambda: gen_timber_wall(206, (138, 84, 52), (82, 46, 28), 5)),
        ("palace_marble_wall", "Palace Cream Marble Wall", ["mansion", "castle", "marble", "wall"], "normal", lambda: gen_masonry_wall(207, (224, 214, 196), (132, 120, 104), 5)),
        ("sandstone_keep_wall", "Sandstone Fortress Wall", ["castle", "sandstone", "wall"], "normal", lambda: gen_masonry_wall(208, (192, 166, 122), (114, 94, 68), 6)),
        ("ruined_brick_wall", "Weathered Red Brick Wall", ["tavern", "city", "brick", "wall"], "normal", lambda: gen_masonry_wall(209, (152, 76, 58), (82, 68, 60), 10)),
        ("timber_palisade_wall", "Camp Timber Palisade", ["wilderness", "camp", "wood", "palisade", "wall"], "normal", lambda: gen_log_palisade_wall(210, (132, 92, 56), 12)),
        ("log_cabin_wall", "Frontier Log Cabin Wall", ["wilderness", "tavern", "wood", "wall"], "normal", lambda: gen_timber_wall(211, (142, 98, 58), (94, 62, 36), 3)),
        ("estate_hedgerow_wall", "Trimmed Estate Hedgerow", ["mansion", "wilderness", "hedge", "wall"], "normal", lambda: gen_hedge_wall(212)),
        ("dungeon_iron_bars", "Dungeon Iron Cell Bars", ["dungeon", "prison", "iron", "wall"], "normal", lambda: gen_iron_bars_wall(213, False)),
        ("estate_wrought_fence", "Gilded Estate Iron Fence", ["mansion", "castle", "fence", "wall"], "normal", lambda: gen_iron_bars_wall(214, True)),
        ("colorable_plaster_wall", "Colorable Plaster Wall (DD Red)", ["tavern", "mansion", "colorable", "wall"], "dd_red", lambda: gen_timber_wall(215, (220, 20, 20), (104, 70, 44), 4, colorable=True)),
        ("colorable_tapestry_wall", "Colorable Brick/Tapestry Wall (DD Red)", ["castle", "mansion", "colorable", "wall"], "dd_red", lambda: gen_masonry_wall(216, (220, 20, 20), (46, 40, 38), 7, colorable=True)),
    ]
    for slug, name, tags, dm, fn in walls:
        save_asset(f"walls/{slug}.png", fn(), name, "wall", tags, draw_mode=dm, default_ppi=256, casts_shadow=True)


# ============================================================================
# 3. SEAMLESS PATHS, ROADS, STREAMS & STAIRS (16 x 512x128)
# ============================================================================

def gen_path_road(seed: int, fill: tuple[int, int, int], edge: tuple[int, int, int], ruts: bool = False, stones: bool = False) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    y0, y1 = 26, H - 26
    d.rectangle([0, y0, W, y1], fill=(*fill, 235))
    d.line([0, y0, W, y0], fill=(*edge, 210), width=12)
    d.line([0, y1, W, y1], fill=(*edge, 210), width=12)
    if ruts:
        for ry in (H // 2 - 42, H // 2 + 42):
            d.line([0, ry, W, ry], fill=shade(fill, 0.72, 180), width=18)
            d.line([0, ry - 9, W, ry - 9], fill=shade(fill, 1.12, 120), width=4)
    if stones:
        for i in range(28):
            cx = (i / 28.0) * W + rng.uniform(-10, 10)
            cy = rng.uniform(y0 + 22, y1 - 22)
            rx, ry = rng.uniform(18, 30), rng.uniform(14, 24)
            c = jitter_rgb(rng, fill, 18)
            for ox in (-W, 0, W):
                if -40 <= cx + ox <= W + 40:
                    d.ellipse([cx + ox - rx, cy - ry, cx + ox + rx, cy + ry], fill=c, outline=INK_SOFT, width=4)
    return finish_ss(im, 512, 128, seed, 7)


def gen_path_stairs(seed: int, step_col: tuple[int, int, int], rail_col: tuple[int, int, int], steps: int = 12) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    y0, y1 = 18, H - 18
    sw = W / steps
    for i in range(steps):
        x0 = i * sw
        x1 = (i + 1) * sw
        c = jitter_rgb(rng, step_col, 10)
        d.rectangle([x0, y0 + 16, x1, y1 - 16], fill=c, outline=INK, width=5)
        d.line([x0 + 6, y0 + 20, x0 + 6, y1 - 20], fill=shade(c[:3], 1.24), width=5)
        d.line([x1 - 6, y0 + 20, x1 - 6, y1 - 20], fill=shade(c[:3], 0.72), width=5)
    # Crisp side stringers / handrails
    for ry in (y0, y1 - 18):
        d.rectangle([0, ry, W, ry + 18], fill=(*rail_col, 255), outline=INK, width=5)
        d.line([0, ry + 5, W, ry + 5], fill=shade(rail_col, 1.22), width=3)
    return finish_ss(im, 512, 128, seed, 5)


def gen_path_stream(seed: int) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    d.rectangle([0, 26, W, H - 26], fill=(48, 114, 140, 215))
    d.rectangle([0, 44, W, H - 44], fill=(64, 146, 172, 225))
    for _ in range(36):
        x = rng.uniform(0, W)
        y = rng.uniform(50, H - 50)
        ln = rng.uniform(35, 95)
        d.line([x, y, x + ln, y + rng.uniform(-6, 6)], fill=(192, 236, 248, 175), width=5)
    for y in (26, H - 26):
        d.line([0, y, W, y], fill=(112, 98, 78, 190), width=14)
    return finish_ss(im, 512, 128, seed, 5)


def gen_path_carpet(seed: int, colorable: bool = False) -> Image.Image:
    im, d = make_ss(512, 128)
    W, H = im.size
    y0, y1 = 28, H - 28
    main = DD_RED_MID if colorable else (148, 28, 36, 255)
    dark = DD_RED_DARK if colorable else (98, 18, 24, 255)
    hi = DD_RED_BRIGHT if colorable else (178, 42, 48, 255)
    gold = (224, 184, 78, 255)
    d.rectangle([0, y0, W, y1], fill=main, outline=INK, width=6)
    d.rectangle([0, y0 + 16, W, y0 + 28], fill=gold)
    d.rectangle([0, y1 - 28, W, y1 - 16], fill=gold)
    d.rectangle([0, y0 + 36, W, y1 - 36], fill=dark)
    # Ornamental repeating diamond motif
    for i in range(8):
        cx = (i + 0.5) * (W / 8)
        cy = H // 2
        d.polygon([(cx, cy - 36), (cx + 42, cy), (cx, cy + 36), (cx - 42, cy)], fill=hi, outline=gold, width=4)
        d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=gold)
    return finish_ss(im, 512, 128, seed, 5)


def gen_path_bridge_or_dock(seed: int, wood: tuple[int, int, int], ropes: bool = True) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    y0, y1 = 22, H - 22
    planks = 14
    pw = W / planks
    for i in range(planks):
        x0 = i * pw + 3
        x1 = (i + 1) * pw - 3
        c = jitter_rgb(rng, wood, 14)
        d.rounded_rectangle([x0, y0 + 8, x1, y1 - 8], radius=4, fill=c, outline=INK, width=5)
        d.line([x0 + 8, y0 + 14, x0 + 8, y1 - 14], fill=shade(c[:3], 1.16), width=3)
    if ropes:
        for ry in (y0 + 12, y1 - 12):
            d.line([0, ry, W, ry], fill=(176, 146, 98, 255), width=14)
            d.line([0, ry - 7, W, ry - 7], fill=INK, width=3)
            d.line([0, ry + 7, W, ry + 7], fill=INK, width=3)
    return finish_ss(im, 512, 128, seed, 5)


def gen_path_chain(seed: int) -> Image.Image:
    im, d = make_ss(512, 128)
    W, H = im.size
    cy = H // 2
    links = 10
    step = W / links
    for i in range(links + 1):
        cx = i * step
        if i % 2 == 0:
            d.rounded_rectangle([cx - 42, cy - 22, cx + 42, cy + 22], radius=18, outline=INK, width=18)
            d.rounded_rectangle([cx - 42, cy - 22, cx + 42, cy + 22], radius=18, outline=(104, 112, 124, 255), width=10)
        else:
            d.rounded_rectangle([cx - 26, cy - 10, cx + 26, cy + 10], radius=8, fill=(116, 124, 136, 255), outline=INK, width=5)
    return finish_ss(im, 512, 128, seed, 3)


def gen_path_cliff_ledge(seed: int) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    # Dramatic shadowed rocky drop-off along lower half
    pts = [(0, 44)]
    for i in range(1, 16):
        pts.append((i * (W / 16), 44 + rng.uniform(-14, 18)))
    pts.extend([(W, 44), (W, H - 18), (0, H - 18)])
    d.polygon(pts, fill=(78, 76, 80, 235), outline=INK)
    # Crisp rocky cliff hatching strokes
    for i in range(28):
        x = i * (W / 28) + rng.uniform(-6, 6)
        d.line([x, 54, x + rng.uniform(-8, 8), H - 24], fill=(30, 24, 21, 175), width=5)
        d.line([x + 6, 48, x + 6, 98], fill=(134, 130, 132, 165), width=4)
    return finish_ss(im, 512, 128, seed, 7)


def gen_path_colorable_arcane(seed: int) -> Image.Image:
    im, d = make_ss(512, 128)
    W, H = im.size
    cy = H // 2
    d.rectangle([0, cy - 30, W, cy + 30], fill=(42, 46, 54, 230), outline=INK, width=6)
    d.rectangle([0, cy - 14, W, cy + 14], fill=DD_RED_BRIGHT)
    d.line([0, cy, W, cy], fill=DD_RED_HI, width=8)
    for i in range(8):
        cx = (i + 0.5) * (W / 8)
        d.polygon([(cx, cy - 26), (cx + 22, cy), (cx, cy + 26), (cx - 22, cy)], fill=DD_RED_MID, outline=INK, width=4)
        d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=DD_RED_PALE)
    return finish_ss(im, 512, 128, seed, 3)


def gen_path_vines(seed: int) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(512, 128)
    W, H = im.size
    cy = H // 2
    pts = [(x, cy + math.sin(x / W * math.tau * 2) * 26) for x in range(0, W + 16, 16)]
    d.line(pts, fill=INK, width=16)
    d.line(pts, fill=(68, 108, 48, 255), width=10)
    for i in range(24):
        cx = (i / 24.0) * W + rng.uniform(-8, 8)
        cy2 = cy + math.sin(cx / W * math.tau * 2) * 26 + rng.uniform(-34, 34)
        c = jitter_rgb(rng, (82, 132, 56), 14)
        d.ellipse([cx - 18, cy2 - 11, cx + 18, cy2 + 11], fill=c, outline=INK, width=4)
    return finish_ss(im, 512, 128, seed, 5)


def generate_paths() -> None:
    paths = [
        ("dirt_country_road", "Dirt Country Road", ["wilderness", "camp", "road", "path"], "normal", lambda: gen_path_road(301, (148, 118, 82), (104, 82, 56), ruts=True)),
        ("cobble_village_lane", "Cobblestone Village Lane", ["tavern", "castle", "road", "cobble"], "normal", lambda: gen_path_road(302, (124, 126, 130), (66, 68, 72), stones=True)),
        ("forest_stepping_stones", "Forest Stepping Stones", ["wilderness", "forest", "stone", "path"], "normal", lambda: gen_path_road(303, (128, 126, 120), (0, 0, 0), stones=True)),
        ("babbling_brook", "Babbling Forest Stream", ["wilderness", "water", "stream", "path"], "normal", lambda: gen_path_stream(304)),
        ("wagon_wheel_ruts", "Muddy Wagon Ruts", ["wilderness", "camp", "mud", "road"], "normal", lambda: gen_path_road(305, (92, 72, 52), (64, 48, 34), ruts=True)),
        ("stone_dungeon_stairs", "Stone Dungeon Staircase", ["dungeon", "castle", "stairs", "stone"], "normal", lambda: gen_path_stairs(306, (118, 120, 126), (78, 80, 86), 12)),
        ("timber_tavern_stairs", "Oak Tavern Staircase", ["tavern", "mansion", "stairs", "wood"], "normal", lambda: gen_path_stairs(307, (148, 104, 64), (96, 62, 36), 12)),
        ("marble_grand_stairs", "Marble Grand Staircase", ["mansion", "castle", "stairs", "marble"], "normal", lambda: gen_path_stairs(308, (218, 210, 194), (176, 146, 86), 10)),
        ("rope_suspension_bridge", "Timber & Rope Bridge", ["wilderness", "dungeon", "bridge", "wood"], "normal", lambda: gen_path_bridge_or_dock(309, (138, 98, 60), ropes=True)),
        ("wooden_dock_planks", "Weathered Wooden Walkway", ["wilderness", "camp", "tavern", "dock"], "normal", lambda: gen_path_bridge_or_dock(310, (122, 92, 66), ropes=False)),
        ("dungeon_iron_chains", "Heavy Iron Dungeon Chains", ["dungeon", "prison", "iron", "chain"], "normal", lambda: gen_path_chain(311)),
        ("cliff_drop_ledge", "Rocky Cliff Drop-Off", ["wilderness", "dungeon", "cliff", "elevation"], "normal", lambda: gen_path_cliff_ledge(312)),
        ("royal_crimson_runner", "Royal Crimson Carpet Runner", ["mansion", "castle", "carpet", "rug"], "normal", lambda: gen_path_carpet(313, colorable=False)),
        ("colorable_royal_runner", "Colorable Carpet Runner (DD Red)", ["mansion", "castle", "tavern", "colorable", "carpet"], "dd_red", lambda: gen_path_carpet(314, colorable=True)),
        ("colorable_arcane_conduit", "Colorable Rune Conduit (DD Red)", ["dungeon", "mansion", "arcane", "colorable"], "dd_red", lambda: gen_path_colorable_arcane(315)),
        ("ivy_vine_trail", "Creeping Ivy & Vines", ["wilderness", "dungeon", "ruin", "vines"], "normal", lambda: gen_path_vines(316)),
    ]
    for slug, name, tags, dm, fn in paths:
        save_asset(f"paths/{slug}.png", fn(), name, "path", tags, draw_mode=dm, default_ppi=256, casts_shadow=False)


# ============================================================================
# 4. CARVE-READY INSET PORTALS: DOORS, WINDOWS, GATES & HATCHES (16 x 256x128)
# ============================================================================

def gen_portal_door(seed: int, wood: tuple[int, int, int], metal: tuple[int, int, int], double: bool = False, barred: bool = False, colorable: bool = False) -> Image.Image:
    im, d = make_ss(256, 128)
    W, H = im.size
    cy = H // 2
    # Masonry jamb blocks left & right
    for x0, x1 in [(18, 66), (W - 66, W - 18)]:
        d.rounded_rectangle([x0, cy - 52, x1, cy + 52], radius=8, fill=(84, 82, 86, 255), outline=INK, width=6)
    if barred:
        d.rectangle([62, cy - 18, W - 62, cy + 18], fill=(*metal, 255), outline=INK, width=6)
        for i in range(7):
            bx = 84 + i * ((W - 168) / 6)
            d.ellipse([bx - 12, cy - 26, bx + 12, cy + 26], fill=shade(metal, 1.25), outline=INK, width=5)
    else:
        leaf = DD_RED_MID if colorable else (*wood, 255)
        hi = DD_RED_HI if colorable else shade(wood, 1.2)
        d.rounded_rectangle([62, cy - 30, W - 62, cy + 30], radius=6, fill=leaf, outline=INK, width=6)
        d.line([70, cy - 16, W - 70, cy - 16], fill=hi, width=5)
        # Iron strap hinges & handles
        for hx in (96, W - 96):
            d.rectangle([hx - 12, cy - 32, hx + 12, cy + 32], fill=(*metal, 255), outline=INK, width=4)
        if double:
            d.line([W // 2, cy - 30, W // 2, cy + 30], fill=INK, width=6)
            for kx in (W // 2 - 26, W // 2 + 26):
                d.ellipse([kx - 9, cy - 9, kx + 9, cy + 9], fill=(218, 178, 76, 255), outline=INK, width=3)
        else:
            d.ellipse([W - 122, cy - 10, W - 102, cy + 10], fill=(218, 178, 76, 255), outline=INK, width=3)
    return finish_ss(im, 256, 128, seed, 4)


def gen_portal_window(seed: int, glass: tuple[int, int, int], frame: tuple[int, int, int], mullions: int = 3, colorable: bool = False) -> Image.Image:
    im, d = make_ss(256, 128)
    W, H = im.size
    cy = H // 2
    d.rounded_rectangle([24, cy - 38, W - 24, cy + 38], radius=8, fill=(*frame, 255), outline=INK, width=6)
    gcol = DD_RED_BRIGHT if colorable else (*glass, 235)
    ghi = DD_RED_PALE if colorable else shade(glass, 1.32, 235)
    d.rectangle([48, cy - 22, W - 48, cy + 22], fill=gcol, outline=INK, width=4)
    d.line([56, cy - 12, W - 56, cy - 12], fill=ghi, width=6)
    for i in range(1, mullions + 1):
        mx = 48 + i * ((W - 96) / (mullions + 1))
        d.rectangle([mx - 5, cy - 26, mx + 5, cy + 26], fill=(*frame, 255), outline=INK, width=3)
    return finish_ss(im, 256, 128, seed, 3)


def gen_portal_hatch(seed: int, wood: tuple[int, int, int], iron: bool = False) -> Image.Image:
    im, d = make_ss(256, 256)
    W, H = im.size
    m = 36
    d.rounded_rectangle([m, m, W - m, H - m], radius=14, fill=(76, 80, 88, 255) if iron else (*wood, 255), outline=INK, width=8)
    if iron:
        d.rounded_rectangle([m + 24, m + 24, W - m - 24, H - m - 24], radius=8, fill=(22, 26, 32, 255), outline=INK, width=5)
        for i in range(5):
            bx = m + 56 + i * ((W - 2 * m - 112) / 4)
            d.rectangle([bx - 8, m + 24, bx + 8, H - m - 24], fill=(104, 110, 120, 255), outline=INK, width=4)
    else:
        for i in range(1, 5):
            y = m + i * ((H - 2 * m) / 5)
            d.line([m + 8, y, W - m - 8, y], fill=INK, width=5)
        d.rectangle([m + 24, m + 14, m + 52, H - m - 14], fill=(82, 86, 94, 255), outline=INK, width=4)
        d.ellipse([W - m - 72, H // 2 - 20, W - m - 32, H // 2 + 20], outline=INK, width=10)
        d.ellipse([W - m - 72, H // 2 - 20, W - m - 32, H // 2 + 20], outline=(168, 174, 184, 255), width=5)
    return finish_ss(im, 256, 256, seed, 5)


def generate_portals() -> None:
    portals = [
        ("oak_tavern_door", "Heavy Oak Tavern Door", ["tavern", "inn", "door", "wood"], "normal", lambda: gen_portal_door(401, (142, 94, 54), (82, 86, 92))),
        ("iron_dungeon_door", "Iron-Bound Dungeon Door", ["dungeon", "door", "iron"], "normal", lambda: gen_portal_door(402, (88, 66, 52), (68, 74, 84))),
        ("prison_cell_gate", "Barred Prison Cell Gate", ["dungeon", "prison", "gate", "iron"], "normal", lambda: gen_portal_door(403, (80, 80, 80), (92, 98, 108), barred=True)),
        ("castle_double_door", "Castle Keep Double Doors", ["castle", "door", "wood", "double"], "normal", lambda: gen_portal_door(404, (118, 76, 44), (72, 76, 86), double=True)),
        ("palace_gilded_door", "Gilded Palace Double Door", ["mansion", "castle", "door", "gold"], "normal", lambda: gen_portal_door(405, (148, 56, 48), (218, 178, 78), double=True)),
        ("crypt_stone_door", "Carved Crypt Stone Door", ["dungeon", "crypt", "door", "stone"], "normal", lambda: gen_portal_door(406, (116, 118, 122), (76, 78, 84))),
        ("secret_bookcase_door", "Secret Bookcase Door", ["mansion", "dungeon", "secret", "door"], "normal", lambda: gen_portal_door(407, (116, 72, 42), (168, 54, 48))),
        ("portcullis_iron_gate", "Castle Iron Portcullis", ["castle", "dungeon", "gate", "iron"], "normal", lambda: gen_portal_door(408, (70, 70, 70), (66, 72, 82), barred=True)),
        ("tavern_leaded_window", "Leaded Glass Tavern Window", ["tavern", "inn", "window", "glass"], "normal", lambda: gen_portal_window(409, (124, 188, 212), (112, 76, 46), 3)),
        ("mansion_mullion_window", "Tall Mansion Mullion Window", ["mansion", "window", "glass"], "normal", lambda: gen_portal_window(410, (148, 212, 236), (206, 196, 176), 4)),
        ("shuttered_cottage_window", "Wooden Shuttered Window", ["tavern", "camp", "window", "wood"], "normal", lambda: gen_portal_window(411, (92, 136, 152), (134, 92, 54), 2)),
        ("castle_arrow_slit", "Castle Arrow-Slit Embrasure", ["castle", "dungeon", "window", "stone"], "normal", lambda: gen_portal_window(412, (42, 52, 64), (128, 132, 138), 1)),
        ("wooden_trapdoor_hatch", "Wooden Cellar Trapdoor", ["tavern", "dungeon", "hatch", "trapdoor"], "normal", lambda: gen_portal_hatch(413, (132, 88, 52), False)),
        ("iron_sewer_grate", "Iron Dungeon Sewer Grate", ["dungeon", "sewer", "hatch", "grate"], "normal", lambda: gen_portal_hatch(414, (76, 82, 92), True)),
        ("colorable_wood_door", "Colorable Painted Door (DD Red)", ["tavern", "mansion", "door", "colorable"], "dd_red", lambda: gen_portal_door(415, (220, 20, 20), (76, 80, 88), colorable=True)),
        ("colorable_stained_window", "Colorable Stained-Glass Window (DD Red)", ["mansion", "castle", "window", "colorable"], "dd_red", lambda: gen_portal_window(416, (220, 20, 20), (64, 68, 76), 4, colorable=True)),
    ]
    for slug, name, tags, dm, fn in portals:
        save_asset(f"portals/{slug}.png", fn(), name, "portal", tags, draw_mode=dm, default_ppi=256, casts_shadow=False)


# ============================================================================
# 5. NATIVE DUNGEONDRAFT RED-MASK COLORABLE PROPS (40 assets, `dd_red`)
# ============================================================================

def gen_col_tent(seed: int, style: str = "pavilion") -> Image.Image:
    im, d = make_ss(512, 512) if style != "small" else make_ss(384, 384)
    W, H = im.size
    cx, cy = W // 2, H // 2
    if style == "pavilion":
        # Hexagonal war pavilion tent with shaded facets & gold finial!
        r = W * 0.41
        # Guy ropes & pegs
        for i in range(6):
            ang = i * (math.tau / 6)
            px, py = cx + math.cos(ang) * (r + 58), cy + math.sin(ang) * (r + 58)
            d.line([cx + math.cos(ang) * r, cy + math.sin(ang) * r, px, py], fill=(168, 144, 102, 220), width=5)
            d.ellipse([px - 8, py - 8, px + 8, py + 8], fill=(104, 72, 44, 255), outline=INK, width=3)
        facets = [DD_RED_HI, DD_RED_BRIGHT, DD_RED_MID, DD_RED_DARK, DD_RED_DARK, DD_RED_MID]
        pts = [(cx + math.cos(i * math.tau / 6) * r, cy + math.sin(i * math.tau / 6) * r) for i in range(6)]
        for i in range(6):
            p1, p2 = pts[i], pts[(i + 1) % 6]
            d.polygon([(cx, cy), p1, p2], fill=facets[i], outline=INK)
        for i in range(6):
            d.line([cx, cy, pts[i][0], pts[i][1]], fill=INK, width=6)
        d.polygon(pts, outline=INK)
        # Gold finial cap
        d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(224, 182, 76, 255), outline=INK, width=6)
        d.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(252, 228, 142, 255))
    elif style == "aframe":
        # Classic rectangular A-frame canvas tent
        x0, y0, x1, y1 = W * 0.16, H * 0.14, W * 0.84, H * 0.86
        d.rectangle([x0, y0, cx, y1], fill=DD_RED_BRIGHT, outline=INK, width=7)
        d.rectangle([cx, y0, x1, y1], fill=DD_RED_DARK, outline=INK, width=7)
        # Canvas seam ribs
        for f in (0.32, 0.5, 0.68):
            sy = y0 + (y1 - y0) * f
            d.line([x0 + 8, sy, cx - 4, sy], fill=DD_RED_HI, width=4)
            d.line([cx + 4, sy, x1 - 8, sy], fill=(92, 8, 8, 255), width=4)
        # Central wooden ridge pole
        d.rectangle([cx - 12, y0 - 16, cx + 12, y1 + 16], fill=(124, 84, 48, 255), outline=INK, width=6)
    else:
        # Small round scout dome tent
        r = W * 0.40
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DD_RED_MID, outline=INK, width=8)
        d.pieslice([cx - r, cy - r, cx + r, cy + r], 200, 340, fill=DD_RED_BRIGHT, outline=INK, width=5)
        d.pieslice([cx - r, cy - r, cx + r, cy + r], 20, 160, fill=DD_RED_DARK, outline=INK, width=5)
        d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(126, 86, 50, 255), outline=INK, width=6)
    return finish_ss(im, im.width // 2, im.height // 2, seed, 5)


def gen_col_bed(seed: int, double: bool = False, canopy: bool = False) -> Image.Image:
    w, h = (384, 512) if double else (256, 448)
    im, d = make_ss(w, h)
    W, H = im.size
    m = 36
    wood = (118, 76, 44, 255)
    # Bed frame
    d.rounded_rectangle([m, m, W - m, H - m], radius=16, fill=wood, outline=INK, width=8)
    # Crisp linen sheet under quilt
    d.rounded_rectangle([m + 24, m + 28, W - m - 24, H - m - 24], radius=10, fill=(236, 228, 212, 255), outline=INK, width=5)
    # Pillows (white linen stays untouched!)
    if double:
        for px0, px1 in [(m + 42, W // 2 - 12), (W // 2 + 12, W - m - 42)]:
            d.rounded_rectangle([px0, m + 42, px1, m + 162], radius=22, fill=(246, 240, 228, 255), outline=INK, width=5)
            d.rounded_rectangle([px0 + 18, m + 60, px1 - 18, m + 144], radius=14, fill=(232, 224, 208, 255))
    else:
        d.rounded_rectangle([m + 42, m + 42, W - m - 42, m + 154], radius=22, fill=(246, 240, 228, 255), outline=INK, width=5)
    # Red-mask colorable blanket/quilt with folded cuff & stitching!
    qy0 = m + 188
    d.rounded_rectangle([m + 20, qy0, W - m - 20, H - m - 20], radius=14, fill=DD_RED_MID, outline=INK, width=6)
    d.rounded_rectangle([m + 20, qy0, W - m - 20, qy0 + 72], radius=10, fill=DD_RED_HI, outline=INK, width=5)
    # Quilted shading folds
    for fy in range(int(qy0 + 110), int(H - m - 40), 75):
        d.line([m + 40, fy, W - m - 40, fy], fill=DD_RED_DARK, width=6)
        d.line([m + 40, fy + 8, W - m - 40, fy + 8], fill=DD_RED_BRIGHT, width=4)
    if canopy:
        # Four gilded carved corner posts + canopy drapes!
        for px, py in [(m + 6, m + 6), (W - m - 6, m + 6), (m + 6, H - m - 6), (W - m - 6, H - m - 6)]:
            d.ellipse([px - 28, py - 28, px + 28, py + 28], fill=(218, 178, 76, 255), outline=INK, width=6)
            d.ellipse([px - 12, py - 12, px + 12, py + 12], fill=(252, 228, 146, 255))
    return finish_ss(im, w, h, seed, 5)


def gen_col_bedroll(seed: int, unrolled: bool = True) -> Image.Image:
    w, h = (256, 384) if unrolled else (256, 160)
    im, d = make_ss(w, h)
    W, H = im.size
    if unrolled:
        d.rounded_rectangle([54, 34, W - 54, H - 34], radius=24, fill=DD_RED_MID, outline=INK, width=7)
        d.rounded_rectangle([76, 56, W - 76, 168], radius=20, fill=(238, 228, 206, 255), outline=INK, width=5)
        d.rounded_rectangle([54, 186, W - 54, 248], radius=12, fill=DD_RED_HI, outline=INK, width=5)
        for fy in (320, 420, 520):
            if fy < H - 60:
                d.line([80, fy, W - 80, fy], fill=DD_RED_DARK, width=5)
    else:
        d.rounded_rectangle([38, 56, W - 38, H - 56], radius=48, fill=DD_RED_MID, outline=INK, width=7)
        d.line([62, H // 2 - 22, W - 62, H // 2 - 22], fill=DD_RED_HI, width=10)
        d.line([62, H // 2 + 24, W - 62, H // 2 + 24], fill=DD_RED_DARK, width=10)
        for sx in (138, W - 138):
            d.rectangle([sx - 16, 48, sx + 16, H - 48], fill=(116, 76, 44, 255), outline=INK, width=5)
            d.rectangle([sx - 10, H // 2 - 12, sx + 10, H // 2 + 12], fill=(218, 180, 78, 255), outline=INK, width=3)
    return finish_ss(im, w, h, seed, 5)


def gen_col_rug(seed: int, shape: str = "rect") -> Image.Image:
    w, h = (512, 320) if shape != "round" else (384, 384)
    im, d = make_ss(w, h)
    W, H = im.size
    gold = (224, 184, 78, 255)
    if shape == "round":
        cx, cy = W // 2, H // 2
        r = W * 0.43
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DD_RED_MID, outline=INK, width=8)
        d.ellipse([cx - r * 0.84, cy - r * 0.84, cx + r * 0.84, cy + r * 0.84], outline=gold, width=10)
        d.ellipse([cx - r * 0.65, cy - r * 0.65, cx + r * 0.65, cy + r * 0.65], fill=DD_RED_DARK, outline=gold, width=5)
        d.ellipse([cx - r * 0.34, cy - r * 0.34, cx + r * 0.34, cy + r * 0.34], fill=DD_RED_BRIGHT, outline=gold, width=6)
    else:
        x0, y0, x1, y1 = 46, 36, W - 46, H - 36
        # Cream fringe tassels left & right
        for fy in range(y0 + 14, y1 - 8, 18):
            d.line([16, fy, x0, fy], fill=(226, 214, 188, 240), width=5)
            d.line([x1, fy, W - 16, fy], fill=(226, 214, 188, 240), width=5)
        if shape == "oval":
            d.ellipse([x0, y0, x1, y1], fill=DD_RED_MID, outline=INK, width=8)
            d.ellipse([x0 + 36, y0 + 30, x1 - 36, y1 - 30], fill=DD_RED_DARK, outline=gold, width=8)
            d.ellipse([x0 + 96, y0 + 72, x1 - 96, y1 - 72], fill=DD_RED_BRIGHT, outline=gold, width=6)
        else:
            d.rounded_rectangle([x0, y0, x1, y1], radius=10, fill=DD_RED_MID, outline=INK, width=8)
            d.rectangle([x0 + 30, y0 + 28, x1 - 30, y1 - 28], fill=DD_RED_DARK, outline=gold, width=8)
            cx, cy = W // 2, H // 2
            d.polygon([(cx, cy - 115), (cx + 210, cy), (cx, cy + 115), (cx - 210, cy)], fill=DD_RED_BRIGHT, outline=gold, width=7)
            d.ellipse([cx - 38, cy - 38, cx + 38, cy + 38], fill=DD_RED_HI, outline=gold, width=5)
    return finish_ss(im, w, h, seed, 5)


def gen_col_chair_or_sofa(seed: int, kind: str = "chair") -> Image.Image:
    w, h = (384, 192) if kind == "sofa" else (192, 192)
    im, d = make_ss(w, h)
    W, H = im.size
    wood = (116, 74, 42, 255)
    if kind == "sofa":
        d.rounded_rectangle([24, 28, W - 24, H - 28], radius=24, fill=wood, outline=INK, width=8)
        d.rounded_rectangle([44, 42, W - 44, 128], radius=18, fill=DD_RED_DARK, outline=INK, width=6)
        # Three plush cushions
        cw = (W - 128) / 3
        for i in range(3):
            cx0 = 64 + i * cw + 4
            d.rounded_rectangle([cx0, 124, cx0 + cw - 8, H - 46], radius=18, fill=DD_RED_MID, outline=INK, width=5)
            d.rounded_rectangle([cx0 + 18, 144, cx0 + cw - 26, H - 86], radius=10, fill=DD_RED_BRIGHT)
        # Rolled arms
        for ax0, ax1 in [(28, 72), (W - 72, W - 28)]:
            d.rounded_rectangle([ax0, 56, ax1, H - 38], radius=18, fill=DD_RED_HI, outline=INK, width=5)
    elif kind == "throne":
        d.rounded_rectangle([32, 24, W - 32, H - 28], radius=18, fill=(214, 174, 72, 255), outline=INK, width=8)
        d.rounded_rectangle([62, 76, W - 62, H - 52], radius=16, fill=DD_RED_MID, outline=INK, width=6)
        d.rounded_rectangle([82, 96, W - 82, H - 96], radius=10, fill=DD_RED_BRIGHT)
        d.rounded_rectangle([46, 30, W - 46, 84], radius=12, fill=DD_RED_DARK, outline=INK, width=5)
    else:
        d.rounded_rectangle([44, 36, W - 44, H - 44], radius=22, fill=wood, outline=INK, width=8)
        d.rounded_rectangle([66, 78, W - 66, H - 64], radius=18, fill=DD_RED_MID, outline=INK, width=6)
        d.rounded_rectangle([88, 98, W - 88, H - 106], radius=10, fill=DD_RED_BRIGHT)
        d.rounded_rectangle([54, 36, W - 54, 82], radius=14, fill=shade(wood[:3], 0.85), outline=INK, width=6)
    return finish_ss(im, w, h, seed, 5)


def gen_col_mushroom_cluster(seed: int, count: int = 3) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(256, 256)
    W, H = im.size
    specs = (
        [(W * 0.5, H * 0.5, 168)]
        if count == 1
        else [(W * 0.42, H * 0.46, 132), (W * 0.68, H * 0.64, 88), (W * 0.66, H * 0.30, 68)]
    )
    for cx, cy, r in specs:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=DD_RED_MID, outline=INK, width=8)
        d.ellipse([cx - r * 0.78, cy - r * 0.82, cx + r * 0.56, cy + r * 0.52], fill=DD_RED_BRIGHT)
        d.ellipse([cx - r * 0.42, cy - r * 0.52, cx + r * 0.16, cy + r * 0.06], fill=DD_RED_HI)
        # Cream spots (untouched by red shader!)
        for _ in range(7):
            ang = rng.uniform(0, math.tau)
            dist = rng.uniform(r * 0.18, r * 0.68)
            sr = rng.uniform(r * 0.08, r * 0.16)
            sx, sy = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
            d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(246, 238, 218, 245), outline=INK_SOFT, width=2)
    return finish_ss(im, 256, 256, seed, 5)


def gen_col_roof_tile(seed: int, shape: str = "straight") -> Image.Image:
    w, h = (512, 256) if shape == "straight" else (384, 384)
    im, d = make_ss(w, h)
    W, H = im.size
    if shape == "pyramid":
        cx, cy = W // 2, H // 2
        m = 24
        facets = [
            ([(m, m), (W - m, m), (cx, cy)], DD_RED_HI),
            ([(W - m, m), (W - m, H - m), (cx, cy)], DD_RED_MID),
            ([(W - m, H - m), (m, H - m), (cx, cy)], DD_RED_DARK),
            ([(m, H - m), (m, m), (cx, cy)], DD_RED_BRIGHT),
        ]
        for pts, col in facets:
            d.polygon(pts, fill=col, outline=INK)
        for p in [(m, m), (W - m, m), (W - m, H - m), (m, H - m)]:
            d.line([cx, cy, p[0], p[1]], fill=INK, width=8)
        d.rectangle([m, m, W - m, H - m], outline=INK, width=9)
        d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(122, 92, 62, 255), outline=INK, width=6)
    else:
        rows = 6
        cols = 10 if shape == "straight" else 7
        rh = (H - 36) / rows
        cw = (W - 24) / cols
        d.rectangle([12, 18, W - 12, H - 18], fill=DD_RED_DARK, outline=INK, width=8)
        for r in range(rows):
            y0 = 18 + r * rh
            col = DD_RED_HI if r < 2 else DD_RED_BRIGHT if r < 4 else DD_RED_MID
            off = cw * 0.5 if r % 2 == 1 else 0
            for c in range(-1, cols + 2):
                x0 = 12 + c * cw + off
                x1 = x0 + cw
                if x1 < 12 or x0 > W - 12:
                    continue
                d.rounded_rectangle([max(12, x0), y0, min(W - 12, x1), y0 + rh + 4], radius=12, fill=col, outline=INK, width=5)
        # Timber ridge beam across top
        d.rectangle([12, 12, W - 12, 46], fill=(112, 78, 48, 255), outline=INK, width=7)
    return finish_ss(im, w, h, seed, 6)


def gen_col_magic_circle(seed: int) -> Image.Image:
    im, d = make_ss(512, 512)
    W, H = im.size
    cx, cy = W // 2, H // 2
    for r, w, col in [(430, 14, DD_RED_BRIGHT), (370, 8, DD_RED_HI), (260, 10, DD_RED_MID), (120, 8, DD_RED_PALE)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col, width=w)
    # Inscribed hexagram
    for rot in (0, math.pi / 3):
        pts = [(cx + math.cos(rot + i * math.tau / 3) * 365, cy + math.sin(rot + i * math.tau / 3) * 365) for i in range(3)]
        d.polygon(pts, outline=DD_RED_BRIGHT, width=10)
    # Outer rune notches
    for i in range(12):
        ang = i * (math.tau / 12)
        rx, ry = cx + math.cos(ang) * 400, cy + math.sin(ang) * 400
        d.ellipse([rx - 14, ry - 14, rx + 14, ry + 14], fill=DD_RED_PALE, outline=DD_RED_DARK, width=4)
    return finish_ss(im, 512, 512, seed, 2)


def gen_col_splatter(seed: int) -> Image.Image:
    rng = random.Random(seed)
    im, d = make_ss(256, 256)
    W, H = im.size
    cx, cy = W // 2, H // 2
    for _ in range(18):
        ang = rng.uniform(0, math.tau)
        dist = rng.uniform(0, 130)
        r = rng.uniform(22, 68) * (1 - dist / 220)
        sx, sy = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=rng.choice([DD_RED_DARK, DD_RED_MID, DD_RED_BRIGHT]))
    for _ in range(24):
        ang = rng.uniform(0, math.tau)
        dist = rng.uniform(75, 210)
        r = rng.uniform(6, 18)
        sx, sy = cx + math.cos(ang) * dist, cy + math.sin(ang) * dist
        d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=DD_RED_MID)
    return finish_ss(im, 256, 256, seed, 3)


def gen_col_crystal_or_orb(seed: int, kind: str = "crystal") -> Image.Image:
    im, d = make_ss(256, 256)
    W, H = im.size
    cx, cy = W // 2, H // 2
    if kind == "orb":
        # Stone pedestal + glowing colorable crystal orb
        d.ellipse([cx - 170, cy - 170, cx + 170, cy + 170], fill=(122, 124, 130, 255), outline=INK, width=8)
        d.ellipse([cx - 125, cy - 125, cx + 125, cy + 125], fill=(214, 174, 76, 255), outline=INK, width=6)
        d.ellipse([cx - 96, cy - 96, cx + 96, cy + 96], fill=DD_RED_MID, outline=INK, width=6)
        d.ellipse([cx - 68, cy - 72, cx + 36, cy + 32], fill=DD_RED_BRIGHT)
        d.ellipse([cx - 46, cy - 54, cx - 10, cy - 18], fill=DD_RED_PALE)
    elif kind == "potions":
        # Cluster of 3 glass potion bottles with corks & colorable elixir
        for px, py, r in [(cx - 88, cy + 28, 72), (cx + 76, cy + 44, 62), (cx + 12, cy - 78, 66)]:
            d.ellipse([px - r, py - r, px + r, py + r], fill=DD_RED_MID, outline=INK, width=7)
            d.ellipse([px - r * 0.65, py - r * 0.72, px + r * 0.35, py + r * 0.28], fill=DD_RED_HI)
            d.ellipse([px - 22, py - 22, px + 22, py + 22], fill=(158, 114, 72, 255), outline=INK, width=5)
    else:
        # Jagged cavern crystal cluster
        for ang, ln, w in [(0.2, 185, 58), (1.5, 160, 50), (2.9, 175, 54), (4.4, 145, 48), (5.5, 130, 44)]:
            tx, ty = cx + math.cos(ang) * ln, cy + math.sin(ang) * ln
            px, py = -math.sin(ang) * w, math.cos(ang) * w
            d.polygon([(cx, cy), (cx + px * 0.6, cy + py * 0.6), (tx, ty), (cx - px * 0.6, cy - py * 0.6)], fill=DD_RED_BRIGHT, outline=INK)
            d.polygon([(cx, cy), (cx + px * 0.6, cy + py * 0.6), (tx, ty)], fill=DD_RED_HI, outline=INK)
        d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], fill=DD_RED_PALE, outline=INK, width=5)
    return finish_ss(im, 256, 256, seed, 3)


def gen_col_awning_or_banner(seed: int, kind: str = "awning") -> Image.Image:
    w, h = (512, 256) if kind == "awning" else (256, 384)
    im, d = make_ss(w, h)
    W, H = im.size
    if kind == "awning":
        stripes = 8
        sw = (W - 48) / stripes
        for i in range(stripes):
            x0 = 24 + i * sw
            col = DD_RED_BRIGHT if i % 2 == 0 else (240, 232, 214, 255)
            d.rectangle([x0, 28, x0 + sw, H - 36], fill=col, outline=INK, width=5)
        d.rectangle([18, 22, W - 18, 52], fill=(116, 78, 46, 255), outline=INK, width=6)
    elif kind == "tablecloth":
        d.rounded_rectangle([32, 32, W - 32, H - 32], radius=22, fill=DD_RED_MID, outline=INK, width=8)
        d.rounded_rectangle([58, 58, W - 58, H - 58], radius=14, fill=DD_RED_BRIGHT, outline=(224, 184, 78, 255), width=6)
    else:
        # Heraldic swallowtail banner with brass crossbar
        d.rectangle([38, 28, W - 38, 62], fill=(214, 174, 74, 255), outline=INK, width=6)
        pts = [(66, 62), (W - 66, 62), (W - 66, H - 46), (W // 2, H - 146), (66, H - 46)]
        d.polygon(pts, fill=DD_RED_MID, outline=INK)
        d.line(pts + [pts[0]], fill=INK, width=8)
        d.ellipse([W // 2 - 72, H * 0.34 - 72, W // 2 + 72, H * 0.34 + 72], fill=(224, 184, 78, 255), outline=INK, width=6)
    return finish_ss(im, w, h, seed, 5)


def gen_col_shield_or_book(seed: int, kind: str = "shield") -> Image.Image:
    im, d = make_ss(256, 256)
    W, H = im.size
    cx, cy = W // 2, H // 2
    if kind == "shield":
        pts = [(cx - 140, cy - 160), (cx + 140, cy - 160), (cx + 130, cy + 30), (cx, cy + 190), (cx - 130, cy + 30)]
        d.polygon(pts, fill=DD_RED_MID, outline=INK)
        d.line(pts + [pts[0]], fill=(168, 174, 184, 255), width=18)
        d.line(pts + [pts[0]], fill=INK, width=7)
        d.ellipse([cx - 42, cy - 20, cx + 42, cy + 64], fill=(224, 184, 76, 255), outline=INK, width=6)
    elif kind == "book":
        d.rounded_rectangle([46, 84, W - 46, H - 84], radius=14, fill=DD_RED_DARK, outline=INK, width=8)
        d.rounded_rectangle([68, 102, cx - 8, H - 102], radius=8, fill=(242, 232, 206, 255), outline=INK, width=5)
        d.rounded_rectangle([cx + 8, 102, W - 68, H - 102], radius=8, fill=(236, 224, 196, 255), outline=INK, width=5)
        for ly in range(148, H - 130, 32):
            d.line([94, ly, cx - 32, ly], fill=(72, 62, 52, 180), width=5)
            d.line([cx + 32, ly, W - 94, ly], fill=(72, 62, 52, 180), width=5)
        # Colorable ribbon bookmark
        d.polygon([(cx - 10, H - 102), (cx + 10, H - 102), (cx + 18, H - 36), (cx, H - 62), (cx - 18, H - 36)], fill=DD_RED_BRIGHT, outline=INK)
    else:
        # Cloak & pack bundle
        d.ellipse([cx - 160, cy - 125, cx + 160, cy + 125], fill=DD_RED_MID, outline=INK, width=8)
        d.ellipse([cx - 115, cy - 90, cx + 80, cy + 65], fill=DD_RED_BRIGHT, outline=INK, width=5)
        d.ellipse([cx - 48, cy - 48, cx + 48, cy + 48], fill=(218, 178, 76, 255), outline=INK, width=6)
    return finish_ss(im, 256, 256, seed, 5)


def generate_colorables() -> None:
    items = [
        # Camp & Wilderness Colorables
        ("pavilion_tent_colorable", "War Pavilion Tent (Colorable)", ["camp", "castle", "tent", "colorable"], lambda: gen_col_tent(501, "pavilion")),
        ("aframe_tent_colorable", "A-Frame Camp Tent (Colorable)", ["camp", "wilderness", "tent", "colorable"], lambda: gen_col_tent(502, "aframe")),
        ("scout_tent_colorable", "Scout Dome Tent (Colorable)", ["camp", "wilderness", "tent", "colorable"], lambda: gen_col_tent(503, "small")),
        ("bedroll_open_colorable", "Unrolled Bedroll (Colorable)", ["camp", "wilderness", "bedroll", "colorable"], lambda: gen_col_bedroll(504, True)),
        ("bedroll_packed_colorable", "Packed Bedroll Bundle (Colorable)", ["camp", "wilderness", "bedroll", "colorable"], lambda: gen_col_bedroll(505, False)),
        ("giant_mushroom_colorable", "Giant Toadstool Cap (Colorable)", ["wilderness", "dungeon", "mushroom", "colorable"], lambda: gen_col_mushroom_cluster(506, 1)),
        ("mushroom_cluster_colorable", "Woodland Mushroom Cluster (Colorable)", ["wilderness", "dungeon", "mushroom", "colorable"], lambda: gen_col_mushroom_cluster(507, 3)),
        ("market_awning_colorable", "Striped Market Awning (Colorable)", ["tavern", "camp", "awning", "colorable"], lambda: gen_col_awning_or_banner(508, "awning")),
        # Tavern & Mansion Furniture Colorables
        ("inn_single_bed_colorable", "Inn Single Bed (Colorable)", ["tavern", "inn", "bed", "furniture", "colorable"], lambda: gen_col_bed(509, False, False)),
        ("inn_double_bed_colorable", "Inn Double Bed (Colorable)", ["tavern", "mansion", "bed", "furniture", "colorable"], lambda: gen_col_bed(510, True, False)),
        ("royal_canopy_bed_colorable", "Royal Canopy Bed (Colorable)", ["mansion", "castle", "bed", "furniture", "colorable"], lambda: gen_col_bed(511, True, True)),
        ("velvet_sofa_colorable", "Plush Velvet Sofa (Colorable)", ["mansion", "tavern", "sofa", "furniture", "colorable"], lambda: gen_col_chair_or_sofa(512, "sofa")),
        ("padded_chair_colorable", "Upholstered Chair (Colorable)", ["tavern", "mansion", "chair", "furniture", "colorable"], lambda: gen_col_chair_or_sofa(513, "chair")),
        ("royal_throne_colorable", "Gilded Royal Throne (Colorable)", ["castle", "mansion", "throne", "furniture", "colorable"], lambda: gen_col_chair_or_sofa(514, "throne")),
        ("parlor_rug_rect_colorable", "Ornate Parlor Rug (Colorable)", ["mansion", "tavern", "rug", "carpet", "colorable"], lambda: gen_col_rug(515, "rect")),
        ("woven_oval_rug_colorable", "Woven Oval Rug (Colorable)", ["tavern", "mansion", "rug", "carpet", "colorable"], lambda: gen_col_rug(516, "oval")),
        ("medallion_round_rug_colorable", "Round Medallion Rug (Colorable)", ["mansion", "castle", "rug", "carpet", "colorable"], lambda: gen_col_rug(517, "round")),
        ("tablecloth_banquet_colorable", "Banquet Tablecloth (Colorable)", ["tavern", "mansion", "table", "colorable"], lambda: gen_col_awning_or_banner(518, "tablecloth")),
        ("heraldic_banner_colorable", "Heraldic Banner (Colorable)", ["castle", "mansion", "banner", "colorable"], lambda: gen_col_awning_or_banner(519, "banner")),
        # Dungeon, Arcane & Modular Roof Colorables
        ("arcane_ritual_circle_colorable", "Arcane Ritual Circle (Colorable)", ["dungeon", "mansion", "arcane", "magic", "colorable"], lambda: gen_col_magic_circle(520)),
        ("crystal_cluster_colorable", "Glowing Crystal Cluster (Colorable)", ["dungeon", "cave", "crystal", "arcane", "colorable"], lambda: gen_col_crystal_or_orb(521, "crystal")),
        ("crystal_orb_pedestal_colorable", "Crystal Orb Pedestal (Colorable)", ["mansion", "castle", "arcane", "orb", "colorable"], lambda: gen_col_crystal_or_orb(522, "orb")),
        ("elixir_potions_colorable", "Potion Bottle Cluster (Colorable)", ["tavern", "dungeon", "mansion", "potion", "colorable"], lambda: gen_col_crystal_or_orb(523, "potions")),
        ("ichor_splatter_colorable", "Blood / Acid / Ichor Splatter (Colorable)", ["dungeon", "combat", "splatter", "colorable"], lambda: gen_col_splatter(524)),
        ("heraldic_shield_colorable", "Heraldic Heater Shield (Colorable)", ["castle", "dungeon", "shield", "colorable"], lambda: gen_col_shield_or_book(525, "shield")),
        ("spellbook_open_colorable", "Open Grimoire Spellbook (Colorable)", ["mansion", "dungeon", "book", "arcane", "colorable"], lambda: gen_col_shield_or_book(526, "book")),
        ("traveler_cloak_colorable", "Folded Traveler Cloak (Colorable)", ["camp", "tavern", "cloak", "colorable"], lambda: gen_col_shield_or_book(527, "cloak")),
        ("roof_shingles_straight_colorable", "Modular Shingle Roof Eave (Colorable)", ["tavern", "mansion", "castle", "roof", "colorable"], lambda: gen_col_roof_tile(528, "straight")),
        ("roof_shingles_pyramid_colorable", "Modular Pyramid Tower Roof (Colorable)", ["castle", "mansion", "roof", "colorable"], lambda: gen_col_roof_tile(529, "pyramid")),
    ]
    for slug, name, tags, fn in items:
        save_asset(f"colorable/{slug}.png", fn(), name, "object", tags, draw_mode="dd_red", default_ppi=256, casts_shadow=True)


# ============================================================================
# 6. TACTICAL ARCHITECTURAL & CLUTTER PROPS (24 crisp procedural props)
# ============================================================================

def gen_simple_prop(seed: int, kind: str) -> Image.Image:
    rng = random.Random(seed)
    if kind == "oak_table_round":
        im, d = make_ss(256, 256)
        W, H = im.size
        cx, cy = W // 2, H // 2
        d.ellipse([44, 44, W - 44, H - 44], fill=(144, 98, 58, 255), outline=INK, width=8)
        for y in range(110, H - 100, 62):
            d.line([62, y, W - 62, y], fill=shade((144, 98, 58), 0.78), width=4)
        d.ellipse([86, 86, W - 86, H - 86], outline=shade((144, 98, 58), 1.18), width=4)
        return finish_ss(im, 256, 256, seed, 5)
    if kind == "oak_table_long":
        im, d = make_ss(512, 224)
        W, H = im.size
        d.rounded_rectangle([24, 34, W - 24, H - 34], radius=16, fill=(138, 92, 54, 255), outline=INK, width=8)
        for y in (128, 224, 320):
            d.line([36, y, W - 36, y], fill=shade((138, 92, 54), 0.72), width=5)
        return finish_ss(im, 512, 224, seed, 5)
    if kind == "wooden_stool":
        im, d = make_ss(128, 128)
        W, H = im.size
        d.ellipse([36, 36, W - 36, H - 36], fill=(148, 102, 60, 255), outline=INK, width=8)
        d.ellipse([60, 60, W - 60, H - 60], fill=(166, 118, 72, 255))
        return finish_ss(im, 128, 128, seed, 4)
    if kind == "ale_barrel":
        im, d = make_ss(192, 192)
        W, H = im.size
        d.ellipse([36, 36, W - 36, H - 36], fill=(92, 96, 104, 255), outline=INK, width=8)
        d.ellipse([54, 54, W - 54, H - 54], fill=(142, 96, 56, 255), outline=INK, width=5)
        for x in (110, 165, 220, 274):
            d.line([x, 66, x, H - 66], fill=shade((142, 96, 56), 0.72), width=4)
        d.ellipse([226, 118, 258, 150], fill=(82, 54, 32, 255), outline=INK, width=4)
        return finish_ss(im, 192, 192, seed, 5)
    if kind == "wooden_crate":
        im, d = make_ss(192, 192)
        W, H = im.size
        d.rounded_rectangle([32, 32, W - 32, H - 32], radius=10, fill=(148, 106, 66, 255), outline=INK, width=8)
        d.rectangle([62, 62, W - 62, H - 62], fill=(134, 94, 58, 255), outline=INK, width=5)
        d.line([62, 62, W - 62, H - 62], fill=(154, 112, 70, 255), width=20)
        d.line([62, 62, W - 62, H - 62], fill=INK, width=5)
        return finish_ss(im, 192, 192, seed, 5)
    if kind == "stone_pillar":
        im, d = make_ss(256, 256)
        W, H = im.size
        d.rounded_rectangle([42, 42, W - 42, H - 42], radius=18, fill=(116, 118, 124, 255), outline=INK, width=8)
        d.ellipse([68, 68, W - 68, H - 68], fill=(144, 146, 152, 255), outline=INK, width=7)
        d.ellipse([116, 116, W - 116, H - 116], fill=(166, 168, 174, 255), outline=INK_SOFT, width=4)
        return finish_ss(im, 256, 256, seed, 6)
    if kind == "spike_trap":
        im, d = make_ss(256, 256)
        W, H = im.size
        d.rounded_rectangle([24, 24, W - 24, H - 24], radius=10, fill=(52, 50, 56, 255), outline=INK, width=8)
        for r in range(4):
            for c in range(4):
                sx = 88 + c * 112
                sy = 88 + r * 112
                d.ellipse([sx - 28, sy - 28, sx + 28, sy + 28], fill=(22, 20, 24, 255), outline=INK, width=4)
                d.ellipse([sx - 15, sy - 15, sx + 15, sy + 15], fill=(162, 168, 178, 255), outline=INK, width=4)
                d.ellipse([sx - 5, sy - 5, sx + 5, sy + 5], fill=(242, 246, 252, 255))
        return finish_ss(im, 256, 256, seed, 4)
    if kind == "pressure_plate":
        im, d = make_ss(256, 256)
        W, H = im.size
        d.rounded_rectangle([32, 32, W - 32, H - 32], radius=10, fill=(40, 38, 42, 255), outline=INK, width=8)
        d.rounded_rectangle([54, 54, W - 54, H - 54], radius=8, fill=(134, 130, 124, 255), outline=INK, width=6)
        d.rounded_rectangle([94, 94, W - 94, H - 94], radius=6, outline=(84, 78, 74, 255), width=5)
        return finish_ss(im, 256, 256, seed, 5)
    if kind == "chest_closed":
        im, d = make_ss(256, 192)
        W, H = im.size
        d.rounded_rectangle([36, 44, W - 36, H - 44], radius=16, fill=(128, 80, 44, 255), outline=INK, width=8)
        for bx in (96, W - 96):
            d.rectangle([bx - 18, 44, bx + 18, H - 44], fill=(92, 98, 108, 255), outline=INK, width=5)
        d.rounded_rectangle([W // 2 - 26, H - 72, W // 2 + 26, H - 28], radius=6, fill=(226, 186, 78, 255), outline=INK, width=5)
        return finish_ss(im, 256, 192, seed, 5)
    if kind == "coin_hoard":
        im, d = make_ss(256, 256)
        W, H = im.size
        cx, cy = W // 2, H // 2
        for _ in range(90):
            ang = rng.uniform(0, math.tau)
            dist = rng.uniform(0, 165)
            r = rng.uniform(14, 24)
            col = rng.choice([(236, 192, 62, 255), (218, 168, 42, 255), (252, 222, 114, 255)])
            d.ellipse([cx + math.cos(ang) * dist - r, cy + math.sin(ang) * dist - r, cx + math.cos(ang) * dist + r, cy + math.sin(ang) * dist + r], fill=col, outline=INK, width=3)
        for col, px, py in [((218, 36, 54, 255), cx - 42, cy - 24), ((42, 168, 232, 255), cx + 52, cy + 18), ((38, 196, 112, 255), cx - 12, cy + 56)]:
            d.polygon([(px, py - 24), (px + 20, py), (px, py + 24), (px - 20, py)], fill=col, outline=INK)
        return finish_ss(im, 256, 256, seed, 3)
    if kind == "dungeon_lever":
        im, d = make_ss(160, 160)
        W, H = im.size
        d.rounded_rectangle([64, 48, W - 64, H - 48], radius=16, fill=(84, 88, 96, 255), outline=INK, width=7)
        d.rectangle([W // 2 - 14, 72, W // 2 + 14, H - 72], fill=(24, 22, 26, 255))
        d.line([W // 2, H // 2, W // 2 + 74, H // 2 - 42], fill=INK, width=20)
        d.line([W // 2, H // 2, W // 2 + 74, H // 2 - 42], fill=(154, 160, 172, 255), width=11)
        d.ellipse([W // 2 + 54, H // 2 - 64, W // 2 + 98, H // 2 - 20], fill=(176, 46, 42, 255), outline=INK, width=5)
        return finish_ss(im, 160, 160, seed, 3)
    if kind == "mossy_boulder":
        im, d = make_ss(256, 256)
        W, H = im.size
        cx, cy = W // 2, H // 2
        pts = [(cx + math.cos(i * math.tau / 9) * rng.uniform(145, 195), cy + math.sin(i * math.tau / 9) * rng.uniform(135, 185)) for i in range(9)]
        d.polygon(pts, fill=(116, 118, 122, 255), outline=INK)
        d.line(pts + [pts[0]], fill=INK, width=8)
        d.ellipse([cx - 110, cy - 115, cx + 45, cy + 30], fill=(148, 150, 154, 210))
        d.ellipse([cx - 125, cy - 20, cx - 25, cy + 80], fill=(76, 118, 56, 210))
        return finish_ss(im, 256, 256, seed, 7)
    if kind == "bush_cluster":
        im, d = make_ss(256, 256)
        W, H = im.size
        cx, cy = W // 2, H // 2
        for _ in range(14):
            ang = rng.uniform(0, math.tau)
            dist = rng.uniform(18, 115)
            r = rng.uniform(54, 88)
            c = jitter_rgb(rng, rng.choice([(64, 108, 48), (82, 134, 56), (50, 88, 38)]), 10)
            d.ellipse([cx + math.cos(ang) * dist - r, cy + math.sin(ang) * dist - r, cx + math.cos(ang) * dist + r, cy + math.sin(ang) * dist + r], fill=c, outline=INK, width=6)
        return finish_ss(im, 256, 256, seed, 6)
    if kind == "stone_stair_landing":
        im, d = make_ss(256, 384)
        W, H = im.size
        for i in range(7):
            y0 = 24 + i * ((H - 48) / 7)
            y1 = 24 + (i + 1) * ((H - 48) / 7)
            c = shade((126, 128, 134), 1.12 - i * 0.05)
            d.rectangle([32, y0, W - 32, y1], fill=c, outline=INK, width=6)
        return finish_ss(im, 256, 384, seed, 5)
    # Default: wooden stair landing
    im, d = make_ss(256, 384)
    W, H = im.size
    for i in range(7):
        y0 = 24 + i * ((H - 48) / 7)
        y1 = 24 + (i + 1) * ((H - 48) / 7)
        c = shade((148, 104, 62), 1.12 - i * 0.05)
        d.rectangle([32, y0, W - 32, y1], fill=c, outline=INK, width=6)
    return finish_ss(im, 256, 384, seed, 5)


def generate_tactical_props() -> None:
    props = [
        ("oak_table_round", "Round Oak Tavern Table", ["tavern", "inn", "table", "furniture"]),
        ("oak_table_long", "Long Banquet Oak Table", ["tavern", "mansion", "castle", "table", "furniture"]),
        ("wooden_stool", "Rustic Wooden Stool", ["tavern", "inn", "stool", "furniture"]),
        ("ale_barrel", "Iron-Hooped Ale Barrel", ["tavern", "camp", "dungeon", "barrel"]),
        ("wooden_crate", "Reinforced Supply Crate", ["tavern", "camp", "dungeon", "crate"]),
        ("stone_pillar", "Carved Stone Pillar", ["dungeon", "castle", "pillar", "stone"]),
        ("spike_trap", "Floor Iron Spike Trap", ["dungeon", "trap", "hazard"]),
        ("pressure_plate", "Stone Pressure Plate Trap", ["dungeon", "trap", "hazard"]),
        ("chest_closed", "Iron-Bound Treasure Chest (Closed)", ["dungeon", "castle", "chest", "treasure"]),
        ("coin_hoard", "Glittering Gold & Gem Hoard", ["dungeon", "castle", "treasure", "gold"]),
        ("dungeon_lever", "Wall / Floor Iron Lever", ["dungeon", "castle", "lever", "trap"]),
        ("mossy_boulder", "Mossy Woodland Boulder", ["wilderness", "camp", "rock", "boulder"]),
        ("bush_cluster", "Wild Forest Bush Cluster", ["wilderness", "forest", "bush", "foliage"]),
        ("stone_stair_landing", "Stone Staircase Flight", ["dungeon", "castle", "stairs"]),
        ("wood_stair_landing", "Oak Staircase Flight", ["tavern", "mansion", "stairs"]),
    ]
    for idx, (slug, name, tags) in enumerate(props):
        save_asset(
            f"objects/{slug}.png",
            gen_simple_prop(600 + idx, slug),
            name,
            "object",
            tags,
            draw_mode="normal",
            default_ppi=256,
            casts_shadow=slug not in ("spike_trap", "pressure_plate"),
        )


# ============================================================================
# 7. AI HERO PROP SPRITE SHEET SLICER (Flood-fill White Matte + Edge Clean)
# ============================================================================

HERO_SHEETS: list[dict[str, Any]] = [
    {
        "file": "hero_sheet_tavern_v3_1795343751223.jpg",
        "pack": "tavern",
        "items": [
            ("hero_tavern_bar", "Tavern Oak Bar Counter (Hero)", ["tavern", "inn", "bar", "furniture"], 2.4),
            ("hero_tavern_dining_set", "Tavern Dining Table & Benches (Hero)", ["tavern", "inn", "table", "furniture"], 2.4),
            ("hero_tavern_hearth", "Stone Tavern Hearth Fireplace (Hero)", ["tavern", "inn", "fireplace", "hearth"], 2.2),
            ("hero_ale_keg_rack", "Stacked Ale Keg Rack (Hero)", ["tavern", "inn", "barrel", "keg"], 2.0),
            ("hero_tavern_round_set", "Round Tavern Table & Chairs (Hero)", ["tavern", "inn", "table", "chairs"], 2.3),
            ("hero_kitchen_prep", "Tavern Kitchen Prep Table (Hero)", ["tavern", "inn", "kitchen", "table"], 2.2),
            ("hero_iron_chandelier", "Wrought-Iron Candle Chandelier (Hero)", ["tavern", "castle", "chandelier", "light"], 2.1),
            ("hero_bard_stage", "Bard Stage & Lute Platform (Hero)", ["tavern", "inn", "bard", "stage"], 2.6),
            ("hero_wine_rack", "Cellar Oak Wine Rack (Hero)", ["tavern", "mansion", "wine", "barrel"], 2.0),
        ],
    },
    {
        "file": "hero_sheet_dungeon_v3_1795343746293.jpg",
        "pack": "dungeon",
        "items": [
            ("hero_stone_sarcophagus", "Carved Stone Sarcophagus (Hero)", ["dungeon", "crypt", "sarcophagus", "tomb"], 2.2),
            ("hero_open_treasure_chest", "Overflowing Treasure Chest (Hero)", ["dungeon", "castle", "chest", "treasure"], 1.6),
            ("hero_iron_brazier", "Glowing Iron Dungeon Brazier (Hero)", ["dungeon", "castle", "brazier", "fire"], 1.4),
            ("hero_ruined_column", "Crumbling Stone Column & Rubble (Hero)", ["dungeon", "ruin", "pillar", "stone"], 2.1),
            ("hero_crypt_altar", "Candlelit Crypt Stone Altar (Hero)", ["dungeon", "crypt", "altar"], 2.2),
            ("hero_prison_cage", "Rusty Iron Prison Cage (Hero)", ["dungeon", "prison", "cage"], 2.1),
            ("hero_bone_pile", "Skeleton Remains & Rusted Arms (Hero)", ["dungeon", "crypt", "bones", "skull"], 1.6),
            ("hero_weapon_rack", "Medieval Oak Weapon Rack (Hero)", ["dungeon", "castle", "weapons", "armory"], 2.0),
            ("hero_arcane_seal", "Glowing Stone Summoning Seal (Hero)", ["dungeon", "arcane", "magic", "rune"], 2.6),
        ],
    },
    {
        "file": "hero_sheet_wilderness_1795343705126.jpg",
        "pack": "wilderness",
        "items": [
            ("hero_oak_tree", "Lush Oak Tree Canopy (Hero)", ["wilderness", "forest", "tree", "oak"], 3.6),
            ("hero_pine_tree", "Evergreen Pine Canopy (Hero)", ["wilderness", "forest", "tree", "pine"], 3.2),
            ("hero_autumn_maple", "Autumn Maple Tree Canopy (Hero)", ["wilderness", "forest", "tree", "autumn"], 3.5),
            ("hero_boulder_cluster", "Mossy Granite Boulder Formation (Hero)", ["wilderness", "rock", "boulder"], 2.5),
            ("hero_campfire_lit", "Stone-Ring Crackling Campfire (Hero)", ["wilderness", "camp", "campfire", "fire"], 1.6),
            ("hero_fallen_mossy_log", "Hollow Fallen Mossy Log (Hero)", ["wilderness", "forest", "log"], 2.8),
            ("hero_berry_thicket", "Wild Fern & Berry Thicket (Hero)", ["wilderness", "forest", "bush"], 2.0),
            ("hero_ancient_stump", "Ancient Gnarled Tree Stump (Hero)", ["wilderness", "forest", "stump"], 1.8),
            ("hero_covered_wagon", "Merchant Covered Supply Wagon (Hero)", ["wilderness", "camp", "wagon", "cart"], 3.4),
        ],
    },
    {
        "file": "hero_sheet_camp_v3_1795343760000.jpg",
        "pack": "camp",
        "items": [
            ("hero_supply_handcart", "Loaded Merchant Handcart (Hero)", ["camp", "wilderness", "tavern", "cart"], 2.2),
            ("hero_cooking_cauldron", "Campfire Tripod & Stew Cauldron (Hero)", ["camp", "wilderness", "campfire", "cauldron"], 1.7),
            ("hero_wooden_rowboat", "Wooden Rowboat & Oars (Hero)", ["wilderness", "camp", "boat", "water"], 2.8),
            ("hero_spiked_barricade", "Sharpened Timber Palisade Barricade (Hero)", ["camp", "castle", "barricade", "defense"], 2.4),
            ("hero_adventurer_gear", "Adventurer Backpacks & Rope Kit (Hero)", ["camp", "wilderness", "gear", "clutter"], 1.5),
            ("hero_lashed_footbridge", "Lashed Timber Footbridge (Hero)", ["wilderness", "camp", "bridge"], 2.6),
            ("hero_firewood_axe", "Firewood Stack & Chopping Stump (Hero)", ["camp", "wilderness", "tavern", "wood"], 1.9),
            ("hero_hitching_trough", "Hitching Post & Water Trough (Hero)", ["camp", "tavern", "horse", "wood"], 2.2),
            ("hero_archery_target", "Straw Archery Target & Quiver (Hero)", ["camp", "castle", "archery", "training"], 1.8),
        ],
    },
    {
        "file": "hero_sheet_mansion_v3_1795343751141.jpg",
        "pack": "mansion",
        "items": [
            ("hero_noble_canopy_bed", "Grand Four-Poster Canopy Bed (Hero)", ["mansion", "castle", "bed", "furniture"], 2.6),
            ("hero_banquet_table", "Grand Banquet Table & Candelabra (Hero)", ["mansion", "castle", "table", "furniture"], 3.4),
            ("hero_library_bookcase", "Mahogany Library Bookcase (Hero)", ["mansion", "bookshelf", "library", "furniture"], 2.2),
            ("hero_grand_piano", "Polished Black Grand Piano (Hero)", ["mansion", "piano", "music", "furniture"], 2.5),
            ("hero_scholar_desk", "Scholar Writing Desk & Globe (Hero)", ["mansion", "desk", "study", "furniture"], 2.2),
            ("hero_velvet_sofa", "Emerald Velvet Parlor Sofa (Hero)", ["mansion", "sofa", "furniture"], 2.4),
            ("hero_marble_fountain", "Marble Courtyard Fountain (Hero)", ["mansion", "castle", "fountain", "water"], 2.8),
            ("hero_alchemy_bench", "Alchemist Glassware Workbench (Hero)", ["mansion", "dungeon", "alchemy", "arcane"], 2.4),
            ("hero_noble_carpet", "Ornate Crimson & Gold Carpet (Hero)", ["mansion", "castle", "rug", "carpet"], 3.0),
        ],
    },
    {
        "file": "hero_sheet_castle_v3_1795343758664.jpg",
        "pack": "castle",
        "items": [
            ("hero_royal_throne", "Gilded Royal Throne on Dais (Hero)", ["castle", "mansion", "throne", "furniture"], 2.6),
            ("hero_siege_ballista", "Heavy Siege Ballista Engine (Hero)", ["castle", "siege", "ballista", "war"], 2.8),
            ("hero_war_map_table", "War Room Tactical Map Table (Hero)", ["castle", "mansion", "table", "war"], 2.8),
            ("hero_stone_spiral_stair", "Castle Tower Spiral Staircase (Hero)", ["castle", "dungeon", "stairs", "spiral"], 2.6),
            ("hero_courtyard_well", "Stone Courtyard Wellhead (Hero)", ["castle", "tavern", "wilderness", "well"], 2.1),
            ("hero_royal_strongbox", "Royal Treasury Strongbox & Gold (Hero)", ["castle", "mansion", "treasure", "chest"], 2.1),
            ("hero_portcullis_winch", "Iron Portcullis Chain Winch (Hero)", ["castle", "dungeon", "winch", "mechanism"], 2.2),
            ("hero_plate_armor_stand", "Knight Plate Armor Display Stand (Hero)", ["castle", "mansion", "armor", "armory"], 1.5),
            ("hero_castle_hearth", "Carved Lion Castle Fireplace (Hero)", ["castle", "mansion", "fireplace", "hearth"], 2.6),
        ],
    },
]

OPENWORK_SLUGS = {
    "hero_iron_chandelier",
    "hero_prison_cage",
    "hero_weapon_rack",
    "hero_spiked_barricade",
    "hero_lashed_footbridge",
    "hero_siege_ballista",
    "hero_portcullis_winch",
    "hero_iron_brazier",
    "hero_cooking_cauldron",
    "hero_bone_pile",
    "hero_berry_thicket",
    "hero_oak_tree",
    "hero_pine_tree",
    "hero_autumn_maple",
}


def find_grid_cuts(sheet: Image.Image) -> tuple[list[int], list[int]]:
    """Find optimal white-gutter cutlines near 1/3 and 2/3 so oversized sprites never clip."""
    rgb = sheet.convert("RGB")
    w, h = rgb.size
    px = rgb.load()

    def best_cut(axis_len: int, frac: float, is_row: bool) -> int:
        center = int(axis_len * frac)
        lo = max(10, int(axis_len * (frac - 0.08)))
        hi = min(axis_len - 10, int(axis_len * (frac + 0.08)))
        best_pos = center
        best_score = 10**9
        for pos in range(lo, hi + 1):
            ink = 0
            if is_row:
                for x in range(0, w, 2):
                    r, g, b = px[x, pos]
                    if min(r, g, b) < 235:
                        ink += 1
            else:
                for y in range(0, h, 2):
                    r, g, b = px[pos, y]
                    if min(r, g, b) < 235:
                        ink += 1
            # Slight tie-break toward center of white gutter
            score = ink * 1000 + abs(pos - center)
            if score < best_score:
                best_score = score
                best_pos = pos
        return best_pos

    xs = [0, best_cut(w, 1 / 3, False), best_cut(w, 2 / 3, False), w]
    ys = [0, best_cut(h, 1 / 3, True), best_cut(h, 2 / 3, True), h]
    return xs, ys


def remove_white_bg_clean(cell: Image.Image, clear_interior_white: bool = False) -> Image.Image:
    """
    Clean exterior flood-fill background removal with smooth luminance-aware
    anti-aliasing + white-fringe decontamination so crisp dark ink lines stay
    100% solid while interior whites (pillows, books, piano keys) are preserved!
    """
    rgba = cell.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()

    # Step 1: Flood-fill from all 4 borders through near-white pixels
    visited = bytearray(w * h)
    bg_mask = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()

    def is_bg_candidate(r: int, g: int, b: int) -> bool:
        mx = max(r, g, b)
        mn = min(r, g, b)
        return mn >= 226 and (mx - mn) <= 24

    for x in range(w):
        for y in (0, h - 1):
            r, g, b, _ = px[x, y]
            if is_bg_candidate(r, g, b):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            r, g, b, _ = px[x, y]
            if is_bg_candidate(r, g, b):
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    q.append((x, y))

    while q:
        x, y = q.popleft()
        idx = y * w + x
        bg_mask[idx] = 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h:
                nidx = ny * w + nx
                if not visited[nidx]:
                    r, g, b, _ = px[nx, ny]
                    if is_bg_candidate(r, g, b):
                        visited[nidx] = 1
                        q.append((nx, ny))

    # Step 2: Set confirmed exterior background to alpha=0
    for y in range(h):
        for x in range(w):
            if bg_mask[y * w + x]:
                px[x, y] = (0, 0, 0, 0)
            elif clear_interior_white:
                r, g, b, _ = px[x, y]
                if min(r, g, b) >= 240 and (max(r, g, b) - min(r, g, b)) <= 14:
                    px[x, y] = (0, 0, 0, 0)

    # Soft fringe decontamination: pixels directly adjacent to transparent pixels
    # that are bright neutral gray/white get smooth proportional alpha & darker un-premultiplied RGB!
    for _pass in range(2):
        to_fade: list[tuple[int, int, tuple[int, int, int, int]]] = []
        for y in range(1, h - 1):
            for x in range(1, w - 1):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if (
                    px[x - 1, y][3] == 0
                    or px[x + 1, y][3] == 0
                    or px[x, y - 1][3] == 0
                    or px[x, y + 1][3] == 0
                ):
                    lum = (r + g + b) / 3.0
                    sat = max(r, g, b) - min(r, g, b)
                    if lum > 196 and sat < 36:
                        new_a = clamp((246 - lum) / 50.0 * a)
                        if new_a < 18:
                            to_fade.append((x, y, (0, 0, 0, 0)))
                        else:
                            to_fade.append((x, y, (clamp(r * 0.52), clamp(g * 0.49), clamp(b * 0.47), new_a)))
        for x, y, val in to_fade:
            px[x, y] = val

    # Step 3: Crop tight to opaque bounding box with 6px safety margin
    bbox = rgba.getbbox()
    if not bbox:
        return rgba
    x0, y0, x1, y1 = bbox
    pad = 6
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w, x1 + pad)
    y1 = min(h, y1 + pad)
    return rgba.crop((x0, y0, x1, y1))


def slice_hero_sheets() -> int:
    sliced = 0
    for spec in HERO_SHEETS:
        sheet_path = SCRATCH_HERO_DIR / spec["file"]
        if not sheet_path.exists():
            print(f"  [skip] Hero sheet not found yet: {sheet_path.name}")
            continue
        sheet = Image.open(sheet_path).convert("RGBA")
        xs, ys = find_grid_cuts(sheet)
        for idx, (slug, name, tags, target_cells) in enumerate(spec["items"]):
            row, col = divmod(idx, 3)
            cell = sheet.crop((xs[col], ys[row], xs[col + 1], ys[row + 1]))
            clean = remove_white_bg_clean(cell, clear_interior_white=slug in OPENWORK_SLUGS)
            max_side = max(clean.width, clean.height)
            desired_px = max(180, min(512, int(round(target_cells * 165))))
            scale = desired_px / max(1, max_side)
            nw = max(64, int(round(clean.width * scale)))
            nh = max(64, int(round(clean.height * scale)))
            final = clean.resize((nw, nh), Image.Resampling.LANCZOS)
            ppi = max(96, int(round(max(nw, nh) / target_cells)))
            save_asset(
                f"hero/{slug}.png",
                final,
                name,
                "object",
                tags + ["hero", spec["pack"]],
                draw_mode="normal",
                default_ppi=ppi,
                casts_shadow=slug not in ("hero_arcane_seal", "hero_noble_carpet"),
            )
            sliced += 1
    return sliced


def write_manifest_and_dcpack() -> None:
    manifest = {
        "id": "dicechaos-core-fantasy-cc0",
        "name": "DiceChaos Core Fantasy Essentials (CC0)",
        "license": "CC0-1.0",
        "artStyle": "Crisp Hand-Inked Tabletop (Orthographic 256 PPI)",
        "assets": MANIFEST_ITEMS,
    }
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # Package clean shippable .dcpack ZIP archive!
    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        zf.write(manifest_path, "manifest.json")
        for item in MANIFEST_ITEMS:
            fp = OUT_DIR / item["path"]
            if fp.exists():
                zf.write(fp, item["path"])


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    generate_terrains()
    generate_walls()
    generate_paths()
    generate_portals()
    generate_colorables()
    generate_tactical_props()
    hero_count = slice_hero_sheets()
    write_manifest_and_dcpack()
    print(f"Generated {len(MANIFEST_ITEMS)} Core Fantasy CC0 assets ({hero_count} AI hero sprites + {len(MANIFEST_ITEMS) - hero_count} procedural/colorable studio assets).")
    print(f"Manifest: {OUT_DIR / 'manifest.json'}")
    print(f"Pack:     {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024*1024):.2f} MB)")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Dice Chaos Compass — Cave & Dungeon Drawing Tool Asset Pack (CC0)
==============================================================
Generates 14 original 2x-supersampled "Crisp Hand-Inked Tabletop" cave & dungeon
wall ribbons (512x128) and seamless floor terrains (512x512) and registers them
into:
  - public/assets/modular-suite-cc0/{walls,terrain}/
  - public/assets/modular-suite-cc0/manifest.json
  - public/assets/DiceChaos_Modular_Suite_CC0.dcpack
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

INK = (24, 19, 16, 255)
INK_SOFT = (24, 19, 16, 165)

RD_DARK = (108, 12, 12, 255)
RD_MID = (208, 24, 24, 255)
RD_BRIGHT = (246, 52, 52, 255)
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


def add_grain(img: Image.Image, seed: int, strength: int = 7, seamless: bool = True) -> Image.Image:
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
    rs = gs = bs = n = 0
    for r, g, b, a in small.getdata():
        if a > 40:
            rs += r
            gs += g
            bs += b
            n += 1
    if n == 0:
        return "#6B7280"
    return f"#{rs // n:02X}{gs // n:02X}{bs // n:02X}"


def make_cave_wall_ribbon(
    seed: int,
    style: str,
    base: tuple[int, int, int],
    hi: tuple[int, int, int],
    lo: tuple[int, int, int],
    accent: tuple[int, int, int],
    colorable: bool = False,
) -> Image.Image:
    """
    2x-supersampled (1024x256 -> 512x128) horizontally seamless wall ribbon.
    Centered along Y with thick organic rock boulders or crisp beveled ashlar stones,
    dark ink outlines, sunlit top-ridge bevel, and soft contact shadows on both sides.
    """
    W, H = 1024, 256
    rng = random.Random(seed)
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if style == "ashlar":
        # Crisp beveled dungeon ashlar blocks with mortar joints & subtle wear
        y_top, y_bot = 36, H - 36
        # Soft outer drop shadow along both wall edges
        d.rectangle([0, y_top - 14, W, y_bot + 14], fill=(10, 12, 16, 75))
        d.rectangle([0, y_top, W, y_bot], fill=shade(lo, 0.8), outline=INK, width=5)
        rows = 2
        row_h = (y_bot - y_top) // rows
        for r in range(rows):
            ry0 = y_top + r * row_h
            ry1 = ry0 + row_h
            cols = 8
            cw = W // cols
            offset = (cw // 2) if r % 2 else 0
            for c in range(-1, cols + 1):
                x0 = c * cw + offset
                x1 = x0 + cw
                col = jitter(rng, base, 9)
                d.rectangle([x0 + 3, ry0 + 3, x1 - 3, ry1 - 3], fill=col, outline=INK, width=4)
                # Beveled top-left highlight & bottom-right shadow
                d.line([x0 + 8, ry0 + 8, x1 - 8, ry0 + 8], fill=shade(hi, 1.06), width=4)
                d.line([x0 + 8, ry0 + 8, x0 + 8, ry1 - 8], fill=shade(hi, 0.96), width=3)
                d.line([x0 + 8, ry1 - 8, x1 - 8, ry1 - 8], fill=shade(lo, 0.85), width=4)
                if rng.random() < 0.35:
                    cx = rng.randint(x0 + 18, x1 - 18)
                    cy = rng.randint(ry0 + 14, ry1 - 14)
                    d.line([cx, cy, cx + rng.randint(-16, 16), cy + rng.randint(-12, 12)], fill=INK_SOFT, width=2)
        # Central cap molding line
        d.line([0, H // 2, W, H // 2], fill=INK, width=4)
        d.line([0, y_top + 2, W, y_top + 2], fill=INK, width=5)
        d.line([0, y_bot - 2, W, y_bot - 2], fill=INK, width=5)
    else:
        # Organic craggy cave wall ribbon with seamless toroidal boulder ribs!
        # 1. Outer ambient contact shadow
        top_pts: list[tuple[float, float]] = []
        bot_pts: list[tuple[float, float]] = []
        steps = 64
        for i in range(steps + 1):
            u = i / steps
            x = u * W
            w1 = math.sin(u * math.tau * 3 + seed * 0.7) * 14
            w2 = math.sin(u * math.tau * 7 + seed * 1.9) * 8
            w3 = math.cos(u * math.tau * 11 + seed * 2.3) * 4
            top_y = 34 + w1 + w2 + w3
            bot_y = H - 34 + math.sin(u * math.tau * 4 + seed * 1.3) * 14 - w2 * 0.8 + w3
            top_pts.append((x, top_y))
            bot_pts.append((x, bot_y))

        shadow_poly = [(x, y - 16) for x, y in top_pts] + [(x, y + 16) for x, y in reversed(bot_pts)]
        sh_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh_layer).polygon(shadow_poly, fill=(8, 10, 15, 115))
        sh_layer = sh_layer.filter(ImageFilter.GaussianBlur(8))
        im = Image.alpha_composite(im, sh_layer)
        d = ImageDraw.Draw(im)

        body_poly = top_pts + list(reversed(bot_pts))
        base_fill = RD_MID if colorable else (*base, 255)
        d.polygon(body_poly, fill=base_fill)

        # 2. Faceted overlapping boulders / rock strata (wrapped seamlessly along X)
        num_boulders = 26 if style != "ice" else 30
        for b in range(num_boulders):
            bx = (b / num_boulders) * W + rng.uniform(-14, 14)
            by = H * 0.5 + rng.uniform(-34, 34)
            rx = rng.uniform(34, 68)
            ry = rng.uniform(28, 54)
            sides = rng.randint(5, 7) if style == "ice" else rng.randint(6, 9)
            ang0 = rng.uniform(0, math.tau)
            pts_rel = []
            for k in range(sides):
                a = ang0 + (k / sides) * math.tau
                rr = rng.uniform(0.76, 1.08)
                pts_rel.append((math.cos(a) * rx * rr, math.sin(a) * ry * rr))

            if colorable:
                fill_c = rng.choice([RD_DARK, RD_MID, RD_BRIGHT])
                hi_c = RD_HI
            else:
                fill_c = jitter(rng, base if b % 3 else lo, 14)
                hi_c = shade(hi, 1.08)

            for ox in (-W, 0, W):
                poly = [(bx + ox + dx, by + dy) for dx, dy in pts_rel]
                if max(p[0] for p in poly) < -10 or min(p[0] for p in poly) > W + 10:
                    continue
                d.polygon(poly, fill=fill_c, outline=INK, width=4)
                # Facet highlight on upper half of rock
                inner_hi = [(bx + ox + dx * 0.58 - 4, by + dy * 0.58 - 6) for dx, dy in pts_rel[: max(3, sides // 2 + 1)]]
                d.polygon(inner_hi, fill=hi_c)

        # 3. Biome details
        if style == "mossy":
            for _ in range(36):
                mx = rng.uniform(0, W)
                my = rng.uniform(44, H - 44)
                mr = rng.uniform(10, 24)
                mc = jitter(rng, accent, 16, 210)
                for ox in (-W, 0, W):
                    if -30 <= mx + ox <= W + 30:
                        d.ellipse([mx + ox - mr, my - mr * 0.7, mx + ox + mr, my + mr * 0.7], fill=mc, outline=INK_SOFT, width=2)
        elif style == "volcanic":
            # Glowing magma fissures weaving through dark basalt!
            for _ in range(18):
                fx = rng.uniform(0, W)
                fy = rng.uniform(62, H - 62)
                pts = [(fx, fy)]
                for _s in range(4):
                    fx += rng.uniform(18, 42)
                    fy += rng.uniform(-16, 16)
                    pts.append((fx, clamp(fy, 54, H - 54)))
                for ox in (-W, 0, W):
                    shifted = [(x + ox, y) for x, y in pts]
                    d.line(shifted, fill=(*accent, 235), width=6)
                    d.line(shifted, fill=(255, 224, 130, 235), width=2)
        elif style == "earth":
            # Twisted tree roots gripping packed clay wall
            for _ in range(20):
                rx0 = rng.uniform(0, W)
                ry0 = rng.uniform(52, H - 52)
                pts = [(rx0, ry0)]
                for _s in range(5):
                    rx0 += rng.uniform(22, 46)
                    ry0 += rng.uniform(-18, 18)
                    pts.append((rx0, clamp(ry0, 44, H - 44)))
                for ox in (-W, 0, W):
                    shifted = [(x + ox, y) for x, y in pts]
                    d.line(shifted, fill=INK, width=9)
                    d.line(shifted, fill=jitter(rng, accent, 12), width=5)
        elif style == "sandstone":
            # Stratified horizontal desert striations
            for sy in range(56, H - 52, 22):
                line_pts = [(x, sy + math.sin((x / W) * math.tau * 3 + sy) * 5) for x in range(0, W + 16, 16)]
                d.line(line_pts, fill=shade(accent, 0.92, 160), width=4)
        elif style == "ice":
            # Sharp crystalline glint facets
            for _ in range(28):
                ix = rng.uniform(0, W)
                iy = rng.uniform(56, H - 56)
                for ox in (-W, 0, W):
                    if -30 <= ix + ox <= W + 30:
                        d.line([ix + ox - 14, iy - 10, ix + ox + 16, iy + 8], fill=(235, 250, 255, 215), width=3)

        # 4. Crisp outer hand-inked silhouettes along top and bottom ridges
        d.line(top_pts, fill=INK, width=7)
        d.line(bot_pts, fill=INK, width=7)
        # Bright ridge crest highlight down the spine
        spine_pts = [(x, (top_pts[i][1] + bot_pts[i][1]) * 0.5 - 10) for i, (x, _) in enumerate(top_pts)]
        d.line(spine_pts, fill=RD_HI if colorable else shade(hi, 1.15, 165), width=5)

    im = add_grain(im, seed + 77, 6, seamless=True)
    return im.resize((512, 128), Image.Resampling.LANCZOS)


def make_cave_floor_tile(
    seed: int,
    style: str,
    base: tuple[int, int, int],
    hi: tuple[int, int, int],
    lo: tuple[int, int, int],
    accent: tuple[int, int, int],
    colorable: bool = False,
) -> Image.Image:
    """Seamless 512x512 hand-inked cave/dungeon floor tile."""
    S = 512
    rng = random.Random(seed)
    fill_base = RD_MID if colorable else (*base, 255)
    im = Image.new("RGBA", (S, S), fill_base)
    d = ImageDraw.Draw(im)

    if style == "sewer_brick":
        rows = 12
        cols = 6
        rh = S / rows
        cw = S / cols
        for r in range(rows):
            off = (cw * 0.5) if r % 2 else 0
            for c in range(-1, cols + 1):
                x0 = c * cw + off
                y0 = r * rh
                col = jitter(rng, base, 11)
                for ox in (-S, 0, S):
                    bx0, bx1 = x0 + ox + 1.5, x0 + ox + cw - 1.5
                    if bx1 < -4 or bx0 > S + 4:
                        continue
                    d.rectangle([bx0, y0 + 1.5, bx1, y0 + rh - 1.5], fill=col, outline=INK, width=2)
                    d.line([bx0 + 3, y0 + 3, bx1 - 3, y0 + 3], fill=shade(hi, 1.04, 170), width=2)
        # Damp moss & water stain patches in joints
        for _ in range(38):
            mx, my = rng.uniform(0, S), rng.uniform(0, S)
            mr = rng.uniform(6, 16)
            mc = jitter(rng, accent, 14, 150)
            for ox in (-S, 0, S):
                for oy in (-S, 0, S):
                    if -20 <= mx + ox <= S + 20 and -20 <= my + oy <= S + 20:
                        d.ellipse([mx + ox - mr, my + oy - mr * 0.7, mx + ox + mr, my + oy + mr * 0.7], fill=mc)
    else:
        # Organic flagstone / natural cavern rock slabs (toroidally wrapped)
        num_slabs = 44 if style != "earth" else 56
        for _ in range(num_slabs):
            cx, cy = rng.uniform(0, S), rng.uniform(0, S)
            rx = rng.uniform(22, 54)
            ry = rng.uniform(18, 46)
            sides = rng.randint(5, 8)
            ang0 = rng.uniform(0, math.tau)
            pts_rel = [(math.cos(ang0 + (k / sides) * math.tau) * rx * rng.uniform(0.75, 1.1),
                        math.sin(ang0 + (k / sides) * math.tau) * ry * rng.uniform(0.75, 1.1)) for k in range(sides)]
            if colorable:
                col = rng.choice([RD_DARK, RD_MID, RD_BRIGHT])
                edge = INK_SOFT
            else:
                col = jitter(rng, base if rng.random() < 0.7 else lo, 12)
                edge = INK_SOFT
            for ox in (-S, 0, S):
                for oy in (-S, 0, S):
                    if -70 <= cx + ox <= S + 70 and -70 <= cy + oy <= S + 70:
                        poly = [(cx + ox + dx, cy + oy + dy) for dx, dy in pts_rel]
                        d.polygon(poly, fill=col, outline=edge if style != "earth" else None, width=2)
                        if style in ("ice", "grotto", "volcanic") or colorable:
                            hl = [(cx + ox + dx * 0.55 - 2, cy + oy + dy * 0.55 - 3) for dx, dy in pts_rel[:3]]
                            d.polygon(hl, fill=RD_HI if colorable else shade(hi, 1.06, 130))

        # Cracks / pebbles / biome flavor
        if style == "ice":
            for _ in range(28):
                x0, y0 = rng.uniform(0, S), rng.uniform(0, S)
                x1, y1 = x0 + rng.uniform(-55, 55), y0 + rng.uniform(-55, 55)
                for ox in (-S, 0, S):
                    for oy in (-S, 0, S):
                        if -60 <= x0 + ox <= S + 60 and -60 <= y0 + oy <= S + 60:
                            d.line([x0 + ox, y0 + oy, x1 + ox, y1 + oy], fill=(225, 248, 255, 185), width=2)
        elif style == "volcanic":
            for _ in range(14):
                x0, y0 = rng.uniform(0, S), rng.uniform(0, S)
                pts = [(x0, y0)]
                for _s in range(4):
                    x0 += rng.uniform(-24, 24)
                    y0 += rng.uniform(-24, 24)
                    pts.append((x0, y0))
                for ox in (-S, 0, S):
                    for oy in (-S, 0, S):
                        if -60 <= pts[0][0] + ox <= S + 60 and -60 <= pts[0][1] + oy <= S + 60:
                            sh = [(x + ox, y + oy) for x, y in pts]
                            d.line(sh, fill=(*accent, 195), width=3)
                            d.line(sh, fill=(255, 210, 120, 175), width=1)
        elif style == "grotto":
            for _ in range(42):
                mx, my = rng.uniform(0, S), rng.uniform(0, S)
                mr = rng.uniform(6, 15)
                mc = jitter(rng, accent, 14, 155)
                for ox in (-S, 0, S):
                    for oy in (-S, 0, S):
                        if -20 <= mx + ox <= S + 20 and -20 <= my + oy <= S + 20:
                            d.ellipse([mx + ox - mr, my + oy - mr * 0.8, mx + ox + mr, my + oy + mr * 0.8], fill=mc)
        elif style == "earth":
            for _ in range(95):
                px, py = rng.uniform(0, S), rng.uniform(0, S)
                pr = rng.uniform(2, 6)
                pc = jitter(rng, accent if rng.random() < 0.4 else hi, 14)
                for ox in (-S, 0, S):
                    for oy in (-S, 0, S):
                        if -12 <= px + ox <= S + 12 and -12 <= py + oy <= S + 12:
                            d.ellipse([px + ox - pr, py + oy - pr, px + ox + pr, py + oy + pr], fill=pc, outline=INK_SOFT, width=1)

    return add_grain(im, seed + 131, 7, seamless=True)


def main() -> None:
    manifest_path = OUT_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    existing_by_path: dict[str, dict[str, Any]] = {a["path"]: a for a in manifest["assets"]}

    new_entries: list[dict[str, Any]] = []
    preview_tiles: list[tuple[str, Image.Image]] = []

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
            "tags": tags,
            "widthPx": img.width,
            "heightPx": img.height,
            "defaultPpi": 256,
            "dominantHex": dominant_hex(img),
            "drawMode": draw_mode,
        }
        existing_by_path[entry["path"]] = entry
        new_entries.append(entry)
        preview_tiles.append((display_name, img))

    # --- 8 Cave & Dungeon Wall Ribbons (512x128) ---
    register(
        "walls/cave_granite_jagged.png",
        make_cave_wall_ribbon(4101, "granite", (102, 106, 114), (144, 150, 160), (66, 70, 78), (118, 124, 132)),
        "Jagged Granite Cavern Wall",
        "wall",
        ["cave", "cavern", "rock", "granite", "dungeon", "underground", "stone"],
    )
    register(
        "walls/cave_mossy_grotto.png",
        make_cave_wall_ribbon(4102, "mossy", (94, 102, 96), (132, 142, 132), (58, 66, 62), (76, 126, 64)),
        "Mossy Limestone Grotto Wall",
        "wall",
        ["cave", "grotto", "moss", "cavern", "limestone", "forest", "underground"],
    )
    register(
        "walls/cave_sandstone_canyon.png",
        make_cave_wall_ribbon(4103, "sandstone", (176, 122, 82), (216, 168, 120), (124, 78, 48), (154, 96, 58)),
        "Sandstone Canyon Cave Wall",
        "wall",
        ["cave", "sandstone", "desert", "canyon", "mesa", "cavern", "rock"],
    )
    register(
        "walls/cave_glacial_ice.png",
        make_cave_wall_ribbon(4104, "ice", (130, 186, 214), (196, 236, 250), (74, 128, 164), (215, 245, 255)),
        "Glacial Ice Cavern Wall",
        "wall",
        ["cave", "ice", "frost", "snow", "glacier", "cavern", "alpine"],
    )
    register(
        "walls/cave_obsidian_volcanic.png",
        make_cave_wall_ribbon(4105, "volcanic", (54, 52, 58), (88, 84, 92), (32, 30, 36), (235, 96, 32)),
        "Volcanic Basalt & Ember Cave Wall",
        "wall",
        ["cave", "volcanic", "obsidian", "lava", "basalt", "underdark", "cavern"],
    )
    register(
        "walls/cave_earth_burrow.png",
        make_cave_wall_ribbon(4106, "earth", (118, 90, 64), (154, 122, 88), (78, 56, 38), (94, 68, 44)),
        "Earth & Tree-Root Burrow Wall",
        "wall",
        ["cave", "burrow", "dirt", "earth", "roots", "tunnel", "goblin"],
    )
    register(
        "walls/dungeon_ashlar_cutstone.png",
        make_cave_wall_ribbon(4107, "ashlar", (118, 122, 128), (160, 164, 172), (76, 80, 88), (96, 100, 108)),
        "Cut-Stone Dungeon Ashlar Wall",
        "wall",
        ["dungeon", "stone", "ashlar", "castle", "crypt", "masonry", "wall"],
    )
    register(
        "walls/cave_colorable_rock.png",
        make_cave_wall_ribbon(4108, "granite", (180, 30, 30), (240, 100, 100), (110, 15, 15), (210, 40, 40), colorable=True),
        "Colorable Cave & Cavern Wall",
        "wall",
        ["cave", "cavern", "rock", "colorable", "tint", "custom", "dungeon"],
        draw_mode="dd_red",
    )

    # --- 6 Cave & Dungeon Floor Terrains (512x512) ---
    register(
        "terrain/cave_floor_glacial_ice.png",
        make_cave_floor_tile(4201, "ice", (138, 190, 214), (206, 240, 252), (96, 146, 178), (226, 248, 255)),
        "Glacial Ice Cavern Floor",
        "terrain",
        ["cave", "ice", "frost", "glacier", "cavern", "floor", "snow"],
    )
    register(
        "terrain/cave_floor_volcanic_basalt.png",
        make_cave_floor_tile(4202, "volcanic", (56, 54, 60), (86, 82, 90), (36, 34, 40), (225, 92, 34)),
        "Volcanic Basalt Cave Floor",
        "terrain",
        ["cave", "volcanic", "basalt", "obsidian", "lava", "floor", "cavern"],
    )
    register(
        "terrain/cave_floor_earth_burrow.png",
        make_cave_floor_tile(4203, "earth", (116, 88, 62), (146, 114, 84), (82, 60, 42), (96, 74, 52)),
        "Packed Earth & Root Burrow Floor",
        "terrain",
        ["cave", "burrow", "dirt", "earth", "tunnel", "floor"],
    )
    register(
        "terrain/cave_floor_wet_grotto.png",
        make_cave_floor_tile(4204, "grotto", (92, 102, 96), (126, 138, 128), (62, 70, 66), (78, 124, 66)),
        "Damp Limestone Grotto Floor",
        "terrain",
        ["cave", "grotto", "moss", "limestone", "cavern", "floor"],
    )
    register(
        "terrain/dungeon_floor_sewer_brick.png",
        make_cave_floor_tile(4205, "sewer_brick", (96, 94, 92), (128, 126, 124), (66, 64, 64), (70, 108, 58)),
        "Damp Sewer & Crypt Brick Floor",
        "terrain",
        ["dungeon", "sewer", "crypt", "brick", "masonry", "floor"],
    )
    register(
        "terrain/cave_floor_colorable_stone.png",
        make_cave_floor_tile(4206, "grotto", (180, 30, 30), (240, 100, 100), (110, 15, 15), (210, 40, 40), colorable=True),
        "Colorable Cave & Stone Floor",
        "terrain",
        ["cave", "dungeon", "stone", "colorable", "tint", "custom", "floor"],
        draw_mode="dd_red",
    )

    manifest["assets"] = list(existing_by_path.values())
    manifest["assetCount"] = len(manifest["assets"])
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # Rebuild DiceChaos_Modular_Suite_CC0.dcpack cleanly
    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for fp in sorted(OUT_DIR.rglob("*")):
            if fp.is_file():
                zf.write(fp, fp.relative_to(OUT_DIR).as_posix())

    # Save visual QA contact sheet into scratch dir
    scratch = pathlib.Path(r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae\scratch")
    scratch.mkdir(parents=True, exist_ok=True)
    sheet = Image.new("RGBA", (1120, 760), (20, 24, 34, 255))
    sd = ImageDraw.Draw(sheet)
    # Top 8 walls (2 cols x 4 rows)
    for idx, (label, img) in enumerate(preview_tiles[:8]):
        col = idx % 2
        row = idx // 2
        x0 = 24 + col * 540
        y0 = 18 + row * 102
        thumb = img.resize((320, 80), Image.Resampling.LANCZOS)
        sheet.alpha_composite(thumb, (x0, y0 + 16))
        sd.text((x0, y0), label, fill=(235, 240, 248, 255))
    # Bottom 6 floors (6 cols x 1 row)
    for idx, (label, img) in enumerate(preview_tiles[8:]):
        x0 = 24 + idx * 180
        y0 = 448
        thumb = img.resize((160, 160), Image.Resampling.LANCZOS)
        sheet.alpha_composite(thumb, (x0, y0 + 22))
        sd.text((x0, y0), label[:22], fill=(235, 240, 248, 255))
    qa_path = scratch / "qa_cave_dungeon_assets.png"
    sheet.save(qa_path)

    print(
        f"Generated {len(new_entries)} cave & dungeon CC0 assets! "
        f"Total modular suite assets: {manifest['assetCount']} | "
        f"dcpack: {DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB | QA: {qa_path}"
    )


if __name__ == "__main__":
    main()

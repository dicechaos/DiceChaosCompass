#!/usr/bin/env python3
"""
Renders ready-to-play 4K (3840x2160) 55-inch TV battlemaps (48x27 @ exact 1.00-inch scale)
and a Foundry/Roll20 Universal VTT (.dd2vtt) directly from Alpine_Funicular_Pass_4K_55in.dcmap
and the 60 CC0 Funicular assets for DiceChaosDisplay.
"""

from __future__ import annotations

import base64
import io
import json
import math
from pathlib import Path
from typing import Dict, List, Tuple

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "public" / "assets" / "starter-cc0"
OUT_DIR = ROOT / "exports" / "Berlin_Magipunk_Funicular_4K_55in"
DCMAP_PATH = OUT_DIR / "Berlin_Magipunk_Funicular_4K_55in.dcmap"

W_PX = 3840
H_PX = 2160
PPC = W_PX / 48.0  # Exactly 80.0 px per 1-inch grid cell -> 3840x2160 native 4K UHD!

IMG_CACHE: Dict[str, Image.Image] = {}


def load_asset(rel: str) -> Image.Image:
    if rel not in IMG_CACHE:
        p = ASSETS_DIR / rel
        IMG_CACHE[rel] = Image.open(p).convert("RGBA")
    return IMG_CACHE[rel]


def hex_rgb(h: str) -> Tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def sample_catmull_rom(pts: List[dict], sub: int = 12, closed: bool = False) -> List[Tuple[float, float]]:
    if len(pts) < 3:
        return [(p["x"], p["y"]) for p in pts]
    out: List[Tuple[float, float]] = []
    n = len(pts)
    seg_count = n if closed else n - 1
    for i in range(seg_count):
        p0 = pts[(i - 1) % n if closed else max(0, i - 1)]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n if closed else min(n - 1, i + 2)]
        for s in range(sub):
            t = s / sub
            t2 = t * t
            t3 = t2 * t
            x = 0.5 * (
                2 * p1["x"]
                + (-p0["x"] + p2["x"]) * t
                + (2 * p0["x"] - 5 * p1["x"] + 4 * p2["x"] - p3["x"]) * t2
                + (-p0["x"] + 3 * p1["x"] - 3 * p2["x"] + p3["x"]) * t3
            )
            y = 0.5 * (
                2 * p1["y"]
                + (-p0["y"] + p2["y"]) * t
                + (2 * p0["y"] - 5 * p1["y"] + 4 * p2["y"] - p3["y"]) * t2
                + (-p0["y"] + 3 * p1["y"] - 3 * p2["y"] + p3["y"]) * t3
            )
            out.append((x, y))
    if not closed:
        out.append((pts[-1]["x"], pts[-1]["y"]))
    return out


def tile_full(img: Image.Image, tile_px: int) -> Image.Image:
    t = img.resize((tile_px, tile_px), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (W_PX, H_PX))
    for y in range(0, H_PX, tile_px):
        for x in range(0, W_PX, tile_px):
            out.paste(t, (x, y))
    return out


def paste_rotated(canvas: Image.Image, sprite: Image.Image, cx: float, cy: float, w_px: int, h_px: int, rot_rad: float, flip_x: bool = False, opacity: float = 1.0):
    sp = sprite.resize((max(2, w_px), max(2, h_px)), Image.Resampling.LANCZOS)
    if flip_x:
        sp = sp.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    if abs(rot_rad) > 1e-4:
        sp = sp.rotate(-math.degrees(rot_rad), resample=Image.Resampling.BICUBIC, expand=True)
    if opacity < 0.99:
        r, g, b, a = sp.split()
        a = a.point(lambda v: int(v * opacity))
        sp = Image.merge("RGBA", (r, g, b, a))
    x0 = int(round(cx - sp.width / 2))
    y0 = int(round(cy - sp.height / 2))
    canvas.alpha_composite(sp, (x0, y0))


def draw_strip(canvas: Image.Image, strip_img: Image.Image, pts: List[Tuple[float, float]], width_px: float, closed: bool, opacity: float = 1.0, shadow: bool = False):
    if len(pts) < 2:
        return
    seg_count = len(pts) if closed else len(pts) - 1
    aspect = strip_img.width / max(1, strip_img.height)
    tile_len = max(16.0, width_px * aspect)

    if shadow:
        sh = Image.new("RGBA", (W_PX, H_PX), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        px_pts = [(x * PPC + 8, y * PPC + 11) for x, y in pts]
        if closed:
            px_pts.append(px_pts[0])
        sd.line(px_pts, fill=(5, 8, 15, 130), width=int(width_px * 0.95), joint="curve")
        sh = sh.filter(ImageFilter.GaussianBlur(7))
        canvas.alpha_composite(sh)

    acc = 0.0
    for i in range(seg_count):
        ax, ay = pts[i][0] * PPC, pts[i][1] * PPC
        bx, by = pts[(i + 1) % len(pts)][0] * PPC, pts[(i + 1) % len(pts)][1] * PPC
        seg_len = math.hypot(bx - ax, by - ay)
        if seg_len < 1.0:
            continue
        ang = math.atan2(by - ay, bx - ax)
        drawn = 0.0
        while drawn < seg_len - 0.5:
            phase = (acc + drawn) % tile_len
            if phase > tile_len - 1.0:
                phase = 0.0
            step = max(2.0, min(seg_len - drawn, tile_len - phase))
            sx = int((phase / tile_len) * strip_img.width)
            sw = max(1, min(strip_img.width - sx, int(math.ceil((step / tile_len) * strip_img.width))))
            crop = strip_img.crop((sx, 0, sx + sw, strip_img.height))
            mid = drawn + step * 0.5
            mx = ax + math.cos(ang) * mid
            my = ay + math.sin(ang) * mid
            paste_rotated(canvas, crop, mx, my, int(math.ceil(step + 2)), int(round(width_px)), ang, False, opacity)
            drawn += step
        acc += seg_len


def ray_seg(ox, oy, dx, dy, seg):
    ax, ay, bx, by = seg
    sx, sy = bx - ax, by - ay
    denom = dx * sy - dy * sx
    if abs(denom) < 1e-9:
        return None
    qpx, qpy = ax - ox, ay - oy
    t = (qpx * sy - qpy * sx) / denom
    u = (qpx * dy - qpy * dx) / denom
    if t >= 0 and -1e-4 <= u <= 1 + 1e-4:
        return t
    return None


def compute_visibility(light: dict, occluders: List[Tuple[float, float, float, float]]) -> List[Tuple[float, float]]:
    ox, oy, r = light["x"], light["y"], max(0.5, light["radiusCells"])
    near = [
        s for s in occluders
        if ox >= min(s[0], s[2]) - r and ox <= max(s[0], s[2]) + r
        and oy >= min(s[1], s[3]) - r and oy <= max(s[1], s[3]) + r
    ]
    cone = light.get("coneAngleDeg", 360)
    is_cone = cone < 355
    half = math.radians(cone) * 0.5
    d_rad = light.get("directionRad", 0.0)
    a0 = d_rad - half if is_cone else -math.pi
    a1 = d_rad + half if is_cone else math.pi
    steps = max(20, int(60 * cone / 360)) if is_cone else 64
    angles = [a0 + (a1 - a0) * i / steps for i in range(steps + 1)]

    if light.get("castShadows", True):
        for ax, ay, bx, by in near:
            for px, py in ((ax, ay), (bx, by)):
                a = math.atan2(py - oy, px - ox)
                if is_cone:
                    diff = (a - d_rad + math.pi) % math.tau - math.pi
                    if abs(diff) > half:
                        continue
                    a = d_rad + diff
                angles.extend([a - 0.0005, a, a + 0.0005])
    angles.sort()

    poly = [(ox, oy)] if is_cone else []
    for ang in angles:
        dx, dy = math.cos(ang), math.sin(ang)
        md = r
        if light.get("castShadows", True):
            for s in near:
                h = ray_seg(ox, oy, dx, dy, s)
                if h is not None and h < md:
                    md = h
        poly.append((ox + dx * md, oy + dy * md))
    return poly


def render_variant(
    doc: dict,
    roofs_on: bool,
    dm_view: bool,
    lighting_preset_id: str | None = None,
    show_grid: bool = True,
    floor2_on: bool = False,
    b1_on: bool = False,
) -> Image.Image:
    if b1_on:
        # Subterranean bedrock canvas for B1 Underground tunnels & cistern
        base_rock = tile_full(load_asset("terrain/alpine_slate_rock.png"), int(PPC * 3.5))
        dark_bg = Image.new("RGBA", (W_PX, H_PX), (9, 13, 20, 255))
        canvas = Image.blend(dark_bg, base_rock, 0.22)
    else:
        canvas = tile_full(load_asset(doc["canvas"]["baseTerrainAssetId"]), int(PPC * 3.5))

    walls_all: List[dict] = []
    portals_all: List[dict] = []
    lights_all: List[dict] = []

    for layer in doc["layers"]:
        lvl = layer.get("levelId")
        if b1_on:
            if lvl != "lvl-b1":
                continue
        else:
            if lvl == "lvl-b1":
                continue
            is_roof = lvl == "lvl-roofs"
            is_floor2 = lvl == "lvl-floor2"
            if is_roof and not roofs_on:
                continue
            if is_floor2 and not floor2_on:
                continue
            if not is_roof and not is_floor2 and not layer.get("visible", True):
                continue
        if layer.get("dmOnly", False) and not dm_view:
            continue

        kind = layer["kind"]
        op = layer.get("opacity", 1.0)

        if kind == "terrain":
            strokes = layer.get("terrainStrokes", [])
            idx = 0
            while idx < len(strokes):
                base = strokes[idx]
                grp = [base]
                j = idx + 1
                while j < len(strokes) and strokes[j]["assetId"] == base["assetId"] and abs(strokes[j]["opacity"] - base["opacity"]) < 0.01:
                    grp.append(strokes[j])
                    j += 1
                tiled = tile_full(load_asset(base["assetId"]), int(PPC * 3.2))
                mask = Image.new("L", (W_PX, H_PX), 0)
                md = ImageDraw.Draw(mask)
                fill_val = int(255 * base["opacity"] * op)
                max_blur = 0
                for stroke in grp:
                    r = int(stroke["radiusCells"] * PPC)
                    blur_r = max(2, int(r * stroke.get("softness", 0.4) * 0.45)) if stroke.get("softness", 0.4) > 0.02 else 0
                    max_blur = max(max_blur, blur_r)
                    pts = stroke["points"]
                    max_dist = 1e9 if stroke.get("continuous") else stroke["radiusCells"] * 1.65
                    for k, pt in enumerate(pts):
                        cx, cy = int(pt["x"] * PPC), int(pt["y"] * PPC)
                        md.ellipse((cx - r, cy - r, cx + r, cy + r), fill=fill_val)
                        if k > 0:
                            prev = pts[k - 1]
                            if math.hypot(pt["x"] - prev["x"], pt["y"] - prev["y"]) <= max_dist:
                                px, py = int(prev["x"] * PPC), int(prev["y"] * PPC)
                                md.line([(px, py), (cx, cy)], fill=fill_val, width=r * 2)
                if max_blur >= 1:
                    mask = mask.filter(ImageFilter.GaussianBlur(max_blur))
                tiled.putalpha(mask)
                canvas.alpha_composite(tiled)
                idx = j

        elif kind == "water":
            for reg in layer.get("waterRegions", []):
                tex_id = reg.get("textureAssetId") or "terrain/under_city_abyss.png"
                chasm_tex = tile_full(load_asset(tex_id), int(PPC * 7.5))
                pts = [(p["x"] * PPC, p["y"] * PPC) for p in reg["points"]]
                mask = Image.new("L", (W_PX, H_PX), 0)
                ImageDraw.Draw(mask).polygon(pts, fill=int(255 * reg.get("opacity", 0.96)))
                deep = Image.new("RGBA", (W_PX, H_PX), hex_rgb(reg["deepColorHex"]) + (255,))
                blended = Image.blend(deep, chasm_tex, 0.78)
                rim = Image.new("RGBA", (W_PX, H_PX), (0, 0, 0, 0))
                ImageDraw.Draw(rim).polygon(pts, outline=(4, 7, 14, 240), width=int(PPC * 2.1))
                rim = rim.filter(ImageFilter.GaussianBlur(28))
                blended = Image.alpha_composite(blended, rim)
                blended.putalpha(mask)
                canvas.alpha_composite(blended)

        elif kind == "paths":
            for path in layer.get("paths", []):
                use_curve = path.get("curved", True) and len(path["points"]) >= 3
                pts = sample_catmull_rom(path["points"], 12, False) if use_curve else [(p["x"], p["y"]) for p in path["points"]]
                draw_strip(canvas, load_asset(path["assetId"]), pts, path["widthCells"] * PPC, False, path.get("opacity", 1.0) * op, shadow=False)

        elif kind == "walls":
            layer_portals = layer.get("portals", [])
            for wall in layer.get("walls", []):
                walls_all.append(wall)
                pts = sample_catmull_rom(wall["points"], 8, wall["closed"]) if wall.get("curved") else [(p["x"], p["y"]) for p in wall["points"]]
                cnt = len(pts) if wall["closed"] else len(pts) - 1
                carved = []
                for i in range(cnt):
                    ax, ay = pts[i]
                    bx, by = pts[(i + 1) % len(pts)]
                    slen = math.hypot(bx - ax, by - ay)
                    if slen < 1e-4:
                        continue
                    cuts = []
                    for p in layer_portals:
                        t = max(0.0, min(1.0, ((p["x"] - ax) * (bx - ax) + (p["y"] - ay) * (by - ay)) / (slen * slen)))
                        cx, cy = ax + t * (bx - ax), ay + t * (by - ay)
                        if math.hypot(p["x"] - cx, p["y"] - cy) < max(0.45, wall["thicknessCells"] * 1.15):
                            ht = (p["widthCells"] * 0.44) / slen
                            cuts.append((max(0.0, t - ht), min(1.0, t + ht)))
                    if not cuts:
                        carved.append([(ax, ay), (bx, by)])
                    else:
                        cuts.sort()
                        cur = 0.0
                        for c0, c1 in cuts:
                            if c0 > cur + 1e-4:
                                carved.append([(ax + (bx - ax) * cur, ay + (by - ay) * cur), (ax + (bx - ax) * c0, ay + (by - ay) * c0)])
                            cur = max(cur, c1)
                        if cur < 1.0 - 1e-4:
                            carved.append([(ax + (bx - ax) * cur, ay + (by - ay) * cur), (bx, by)])
                wall_img = load_asset(wall["assetId"])
                for seg in carved:
                    draw_strip(canvas, wall_img, seg, wall["thicknessCells"] * PPC * 2.1, False, op, shadow=True)

            # Render truly inset portals seated cleanly inside carved wall masonry jambs!
            for portal in layer_portals:
                portals_all.append(portal)
                pw = int(portal["widthCells"] * PPC)
                wall_t = max(18, int(PPC * 0.44))
                ph = max(int(wall_t * 1.35), int(pw * 0.44))
                jamb_w = max(6, int(PPC * 0.13))
                # Build crisp inset portal sprite with sill, masonry jambs, and swung-open leaf if open
                pad = max(pw, ph) + 12
                p_box = Image.new("RGBA", (pad * 2, pad * 2), (0, 0, 0, 0))
                pd = ImageDraw.Draw(p_box)
                ox, oy = pad, pad
                sill_col = (18, 28, 44, 185) if portal["kind"] == "window" else (12, 14, 20, 120)
                pd.rectangle((ox - pw // 2, oy - int(wall_t * 0.55), ox + pw // 2, oy + int(wall_t * 0.55)), fill=sill_col)
                jamb_col = (58, 68, 88, 255) if portal["kind"] == "window" else (45, 51, 66, 255)
                pd.rectangle((ox - pw // 2 - int(jamb_w * 0.35), oy - int(wall_t * 0.72), ox - pw // 2 + int(jamb_w * 0.65), oy + int(wall_t * 0.72)), fill=jamb_col, outline=(16, 19, 26, 255), width=2)
                pd.rectangle((ox + pw // 2 - int(jamb_w * 0.65), oy - int(wall_t * 0.72), ox + pw // 2 + int(jamb_w * 0.35), oy + int(wall_t * 0.72)), fill=jamb_col, outline=(16, 19, 26, 255), width=2)
                p_img = load_asset(portal["assetId"])
                if not portal["closed"] and portal["kind"] != "window":
                    # Swung-open door leaf + subtle architectural arc
                    leaf = p_img.resize((max(4, pw - jamb_w), max(4, int(ph * 0.72))), Image.Resampling.LANCZOS)
                    leaf_rot = leaf.rotate(-72, resample=Image.Resampling.BICUBIC, expand=True)
                    p_box.alpha_composite(leaf_rot, (ox - pw // 2 + jamb_w // 2, oy - 4))
                else:
                    fit = p_img.resize((max(4, pw), max(4, ph)), Image.Resampling.LANCZOS)
                    p_box.alpha_composite(fit, (ox - pw // 2, oy - ph // 2))
                paste_rotated(canvas, p_box, portal["x"] * PPC, portal["y"] * PPC, p_box.width, p_box.height, portal["rotationRad"], False, op)

        elif kind == "scatter_zone":
            for zone in layer.get("scatterZones", []):
                for pl in zone.get("placements", []):
                    sz = int(PPC * 1.65 * pl["scale"])
                    paste_rotated(canvas, load_asset(pl["assetId"]), pl["x"] * PPC, pl["y"] * PPC, sz, sz, pl["rotationRad"], pl.get("flipX", False), op)

        elif kind == "objects":
            objs = sorted(layer.get("objects", []), key=lambda o: o.get("zOrder", 0))
            for obj in objs:
                paste_rotated(
                    canvas,
                    load_asset(obj["assetId"]),
                    obj["x"] * PPC,
                    obj["y"] * PPC,
                    int(obj["widthCells"] * PPC),
                    int(obj["heightCells"] * PPC),
                    obj.get("rotationRad", 0.0),
                    obj.get("flipX", False),
                    obj.get("opacity", 1.0) * op,
                )

        elif kind == "lights":
            lights_all.extend(layer.get("lights", []))

    # Real-time 2D Raycast Lighting & Shadows (1/4 scale soft penumbra multiply pass!)
    if doc["lighting"]["enabled"]:
        amb_hex = doc["lighting"]["ambientColorHex"]
        amb_int = doc["lighting"]["ambientIntensity"]
        if lighting_preset_id:
            for pr in doc["lighting"]["presets"]:
                if pr["id"] == lighting_preset_id:
                    amb_hex = pr["ambientColorHex"]
                    amb_int = pr["ambientIntensity"]
                    break

        scale = 0.25
        lw, lh = int(W_PX * scale), int(H_PX * scale)
        lppc = PPC * scale
        ar, ag, ab = hex_rgb(amb_hex)
        mr = int(ar + (255 - ar) * amb_int)
        mg = int(ag + (255 - ag) * amb_int)
        mb = int(ab + (255 - ab) * amb_int)
        lm = Image.new("RGB", (lw, lh), (mr, mg, mb))

        # Extract light occluders cutting open portals
        occluders: List[Tuple[float, float, float, float]] = []
        open_portals = [p for p in portals_all if not p["closed"] or not p.get("blocksLightWhenClosed", True)]
        for w in walls_all:
            if not w.get("blocksLight", True):
                continue
            pts = [(p["x"], p["y"]) for p in w["points"]]
            cnt = len(pts) if w["closed"] else len(pts) - 1
            for i in range(cnt):
                ax, ay = pts[i]
                bx, by = pts[(i + 1) % len(pts)]
                slen = math.hypot(bx - ax, by - ay)
                if slen < 1e-4:
                    continue
                cuts = []
                for p in open_portals:
                    t = max(0.0, min(1.0, ((p["x"] - ax) * (bx - ax) + (p["y"] - ay) * (by - ay)) / (slen * slen)))
                    cx, cy = ax + t * (bx - ax), ay + t * (by - ay)
                    if math.hypot(p["x"] - cx, p["y"] - cy) < 0.45:
                        ht = (p["widthCells"] * 0.5) / slen
                        cuts.append((max(0.0, t - ht), min(1.0, t + ht)))
                if not cuts:
                    occluders.append((ax, ay, bx, by))
                else:
                    cuts.sort()
                    cur = 0.0
                    for c0, c1 in cuts:
                        if c0 > cur + 1e-4:
                            occluders.append((ax + (bx - ax) * cur, ay + (by - ay) * cur, ax + (bx - ax) * c0, ay + (by - ay) * c0))
                        cur = max(cur, c1)
                    if cur < 1.0 - 1e-4:
                        occluders.append((ax + (bx - ax) * cur, ay + (by - ay) * cur, bx, by))

        for lt in lights_all:
            poly = compute_visibility(lt, occluders)
            if len(poly) < 3:
                continue
            lr, lg, lb = hex_rgb(lt["colorHex"])
            ox, oy = lt["x"] * lppc, lt["y"] * lppc
            rad = lt["radiusCells"] * lppc
            peak = min(1.0, 0.88 * lt["intensity"])

            vis_mask = Image.new("L", (lw, lh), 0)
            ImageDraw.Draw(vis_mask).polygon([(px * lppc, py * lppc) for px, py in poly], fill=255)
            vis_mask = vis_mask.filter(ImageFilter.GaussianBlur(3))

            glow = Image.new("RGB", (lw, lh), (0, 0, 0))
            gd = ImageDraw.Draw(glow)
            for ring in range(14, 0, -1):
                f = ring / 14.0
                fall = (1.0 - f) ** 1.55 * peak
                rr = rad * f
                gd.ellipse((ox - rr, oy - rr, ox + rr, oy + rr), fill=(int(lr * fall), int(lg * fall), int(lb * fall)))
            glow = glow.filter(ImageFilter.GaussianBlur(8))
            masked_glow = Image.composite(glow, Image.new("RGB", (lw, lh), (0, 0, 0)), vis_mask)
            lm = ImageChops.add(lm, masked_glow)

        lm_full = lm.resize((W_PX, H_PX), Image.Resampling.BILINEAR)
        rgb = ImageChops.multiply(canvas.convert("RGB"), lm_full)
        canvas = rgb.convert("RGBA")

    # Crisp 1-inch square tactical grid (80px = 1.00 inch on 55" 4K TV!)
    if show_grid:
        grid_ov = Image.new("RGBA", (W_PX, H_PX), (0, 0, 0, 0))
        gd = ImageDraw.Draw(grid_ov)
        col = (208, 220, 236, 38)
        for gx in range(49):
            x = int(round(gx * PPC))
            gd.line([(x, 0), (x, H_PX)], fill=col, width=1)
        for gy in range(28):
            y = int(round(gy * PPC))
            gd.line([(0, y), (W_PX, y)], fill=col, width=1)
        canvas.alpha_composite(grid_ov)

    # DM Reference Overlays (Cyan VTT walls + tactical callouts)
    if dm_view:
        ov = Image.new("RGBA", (W_PX, H_PX), (0, 0, 0, 0))
        od = ImageDraw.Draw(ov)
        for w in walls_all:
            if not w.get("blocksLight", True):
                continue
            pts = [(p["x"] * PPC, p["y"] * PPC) for p in w["points"]]
            if w["closed"]:
                pts.append(pts[0])
            od.line(pts, fill=(34, 211, 238, 220), width=4)
        for l in lights_all:
            cx, cy, r = l["x"] * PPC, l["y"] * PPC, l["radiusCells"] * PPC
            od.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(229, 169, 60, 110), width=2)
        try:
            dm_font = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 24)
        except Exception:
            try:
                dm_font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 24)
            except Exception:
                dm_font = ImageFont.load_default()
        for layer in doc["layers"]:
            if not layer.get("dmOnly"):
                continue
            for n in layer.get("dmNotes", []):
                nx, ny = n["x"] * PPC, n["y"] * PPC
                txt = f"[{n['badge']}] {n['title']}"
                bbox = od.textbbox((0, 0), txt, font=dm_font)
                tw = bbox[2] - bbox[0]
                th = bbox[3] - bbox[1]
                bw = max(240, tw + 34)
                bh = max(46, th + 22)
                col = hex_rgb(n["colorHex"])
                od.rounded_rectangle(
                    (nx - bw / 2, ny - bh / 2, nx + bw / 2, ny + bh / 2),
                    radius=10,
                    fill=(14, 17, 24, 238),
                    outline=col + (255,),
                    width=3,
                )
                od.text((nx - tw / 2, ny - th / 2 - 2), txt, fill=col + (255,), font=dm_font)
        canvas.alpha_composite(ov)

    return canvas


def main():
    doc = json.loads(DCMAP_PATH.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    outputs = [
        ("Berlin_Magipunk_Funicular_55in_4K_Player_B1_Underground.png", False, False, "midnight", True, False, True),
        ("Berlin_Magipunk_Funicular_55in_4K_Player_Night.png", False, False, "berlin_night", True, False, False),
        ("Berlin_Magipunk_Funicular_55in_4K_Player_2ndFloor.png", False, False, "berlin_night", True, True, False),
        ("Berlin_Magipunk_Funicular_55in_4K_Player_RoofsOn.png", True, False, "berlin_night", True, False, False),
        ("Berlin_Magipunk_Funicular_55in_4K_Player_OvercastDay.png", False, False, "overcast", True, False, False),
        ("Berlin_Magipunk_Funicular_55in_4K_DM_Reference.png", False, True, "berlin_night", True, False, False),
    ]

    primary_png_bytes = b""
    for fname, roofs, dm, preset, grid, f2, b1 in outputs:
        img = render_variant(doc, roofs, dm, preset, grid, floor2_on=f2, b1_on=b1)
        out_path = OUT_DIR / fname
        img.convert("RGB").save(out_path, format="PNG", optimize=True)
        print(f"Rendered 4K 55in TV Map -> {out_path} ({img.width}x{img.height})")
        if fname.endswith("Player_Night.png"):
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="PNG", optimize=True)
            primary_png_bytes = buf.getvalue()

    # Also build Universal VTT (.dd2vtt) for Foundry VTT & Roll20
    los = []
    portals = []
    lights = []
    for layer in doc["layers"]:
        if not layer.get("visible", True) or layer.get("dmOnly", False):
            continue
        for w in layer.get("walls", []):
            if not w.get("blocksLight", True):
                continue
            pts = [{"x": p["x"], "y": p["y"]} for p in w["points"]]
            if w["closed"] and len(pts) > 2:
                pts.append(pts[0])
            los.append(pts)
        for p in layer.get("portals", []):
            dx = math.cos(p["rotationRad"]) * p["widthCells"] * 0.5
            dy = math.sin(p["rotationRad"]) * p["widthCells"] * 0.5
            portals.append({
                "position": {"x": p["x"], "y": p["y"]},
                "bounds": [
                    {"x": p["x"] - dx, "y": p["y"] - dy},
                    {"x": p["x"] + dx, "y": p["y"] + dy},
                ],
                "rotation": p["rotationRad"],
                "closed": p["closed"],
                "freestanding": not bool(p.get("wallId")),
            })
        for l in layer.get("lights", []):
            lights.append({
                "position": {"x": l["x"], "y": l["y"]},
                "range": l["radiusCells"],
                "intensity": l["intensity"],
                "color": "ff" + l["colorHex"].lstrip("#").lower(),
                "shadows": l.get("castShadows", True),
            })

    uvtt = {
        "format": 0.3,
        "resolution": {
            "map_origin": {"x": 0.0, "y": 0.0},
            "map_size": {"x": 48.0, "y": 27.0},
            "pixels_per_grid": 80,
        },
        "line_of_sight": los,
        "objects_line_of_sight": [],
        "portals": portals,
        "environment": {
            "baked_lighting": True,
            "ambient_light": "ff182844",
        },
        "lights": lights,
        "image": base64.b64encode(primary_png_bytes).decode("ascii"),
    }
    uvtt_path = OUT_DIR / "Berlin_Magipunk_Funicular_55in_4K.dd2vtt"
    uvtt_path.write_text(json.dumps(uvtt), encoding="utf-8")
    print(f"Exported Universal VTT -> {uvtt_path}")


if __name__ == "__main__":
    main()

"""
Step 5B — Generates 180 Brand-New Unique Painterly Architectural Builder Props
in modular-suite-cc0/props/harmony_arch/ (category: "object"):
  - 32 Columns, Pillars, Buttresses & Pilasters
  - 28 Rooftop Architecture, Chimneys, Dormers & Skylights
  - 28 Storefront Awnings, Balconies, Marquees & Hanging Shop Signs
  - 24 Floor Medallions, Manholes, Grates, Thresholds & Fire-Escape Platforms
  - 24 Fireplaces, Berlin Kachelofen Stoves, Radiators & Interior Built-ins
  - 24 Street, Courtyard & Exterior Architectural Accents
  - 20 Modular Ruins, Damage & Weathering Overlays

All 2x supersampled, 100% opaque interiors, zero white halos, unified charcoal ink &
warm top-left painterly bevel shading! Updates modular-suite-cc0/manifest.json + QA sheets.
"""

from __future__ import annotations

import math
import random
from typing import Any

from PIL import Image, ImageDraw, ImageFilter

from harmony_art_engine import (
    DD_RED_BASE,
    INK,
    INK_IRON,
    INK_MID,
    INK_WARM,
    MOD_DIR,
    SCRATCH_DIR,
    add_contact_shadow,
    add_glow,
    apply_painterly_finish,
    blend_rgb,
    dominant_hex,
    draw_beveled_rect,
    draw_foliage_cluster,
    draw_glass_pane,
    draw_stone_block,
    draw_wood_planks_box,
    draw_wrought_scroll,
    new_hi,
    save_qa_sheet,
    shade_rgb,
    upsert_manifest_entries,
    vary_rgb,
)

PROPS_DIR = MOD_DIR / "props" / "harmony_arch"


def render_arch_prop(spec: dict[str, Any]) -> Image.Image:
    kind = spec["kind"]
    w = int(spec.get("w", 192))
    h = int(spec.get("h", 192))
    seed = int(spec.get("seed", 9001))
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    im = new_hi(w, h)

    base = DD_RED_BASE if spec.get("colorable", False) else spec.get("base", (148, 144, 138))
    trim = spec.get("trim", (206, 168, 72))
    alt = spec.get("alt", (232, 224, 204))
    glow = spec.get("glow", None)
    moss = float(spec.get("moss", 0.0))

    # --- 1. COLUMNS, PILLARS, BUTTRESSES & PILASTERS ---
    if kind == "column":
        shape = spec.get("shape", "round")
        pad = int(min(W, H) * 0.14)
        R = min(W, H) * 0.36
        if glow:
            add_glow(im, cx, cy, R * 1.25, R * 1.25, glow, alpha=125, blur=20)
        add_contact_shadow(
            im,
            lambda sd, col, off: (
                sd.ellipse([cx - R + off[0], cy - R + off[1], cx + R + off[0], cy + R + off[1]], fill=col)
                if shape in ("round", "clustered", "oct")
                else sd.rounded_rectangle([pad + off[0], pad + off[1], W - pad + off[0], H - pad + off[1]], radius=10, fill=col)
            ),
            offset=(8, 10),
            blur=9,
            alpha=92,
        )
        d = ImageDraw.Draw(im)
        if shape == "round":
            draw_stone_block(d, pad, pad, W - pad, H - pad, shade_rgb(base, 0.86)[:3], rng, ink_w=5, moss=moss, radius=8)
            d.ellipse([cx - R * 0.92, cy - R * 0.92, cx + R * 0.92, cy + R * 0.92], fill=(*base, 255), outline=INK, width=6)
            for k in range(16):
                a = k * math.tau / 16
                d.line([(cx + math.cos(a) * R * 0.74, cy + math.sin(a) * R * 0.74), (cx + math.cos(a) * R * 0.90, cy + math.sin(a) * R * 0.90)], fill=INK_MID, width=3)
            d.ellipse([cx - R * 0.70, cy - R * 0.70, cx + R * 0.70, cy + R * 0.70], fill=blend_rgb(base, (244, 240, 230), 0.18), outline=INK_MID, width=4)
            if spec.get("band", False):
                d.ellipse([cx - R * 0.72, cy - R * 0.72, cx + R * 0.72, cy + R * 0.72], outline=(*trim, 255), width=7)
            if spec.get("broken", False):
                for _ in range(5):
                    a = rng.uniform(0, math.tau)
                    d.line([(cx, cy), (cx + math.cos(a) * R * 0.68, cy + math.sin(a) * R * 0.68)], fill=INK, width=4)
                if moss > 0:
                    draw_foliage_cluster(d, cx - R * 0.2, cy - R * 0.15, R * 0.34, R * 0.28, (72, 114, 52), rng, n_leaves=7)
        elif shape == "clustered":
            # Gothic clustered cathedral stone pier (central drum + 4 engaged colonnettes!)
            d.ellipse([cx - R * 0.78, cy - R * 0.78, cx + R * 0.78, cy + R * 0.78], fill=(*base, 255), outline=INK, width=6)
            for k in range(4):
                a = k * math.pi / 2 + math.pi / 4
                sx, sy = cx + math.cos(a) * R * 0.68, cy + math.sin(a) * R * 0.68
                sr = R * 0.34
                d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=blend_rgb(base, (238, 234, 224), 0.14), outline=INK, width=5)
            d.ellipse([cx - R * 0.42, cy - R * 0.42, cx + R * 0.42, cy + R * 0.42], fill=(*trim, 255), outline=INK, width=4)
        elif shape == "pylon":
            # Magipunk aether crystal pylon / obelisk!
            pts = [(cx + math.cos(k * math.tau / 8 + math.pi / 8) * R, cy + math.sin(k * math.tau / 8 + math.pi / 8) * R) for k in range(8)]
            d.polygon(pts, fill=(*base, 255), outline=INK)
            d.line(pts + [pts[0]], fill=INK, width=6)
            d.ellipse([cx - R * 0.64, cy - R * 0.64, cx + R * 0.64, cy + R * 0.64], fill=(*trim, 255), outline=INK, width=5)
            gl_c = glow or (76, 218, 244)
            d.polygon([(cx, cy - R * 0.46), (cx + R * 0.46, cy), (cx, cy + R * 0.46), (cx - R * 0.46, cy)], fill=(*gl_c, 255), outline=INK)
            d.polygon([(cx, cy - R * 0.24), (cx + R * 0.18, cy - R * 0.04), (cx, cy + R * 0.12), (cx - R * 0.18, cy - R * 0.04)], fill=blend_rgb(gl_c, (255, 255, 255), 0.68))
        elif shape == "wood_post":
            draw_wood_planks_box(d, pad, pad, W - pad, H - pad, base, rng, horizontal=True, n_planks=3, ink_w=6)
            draw_beveled_rect(d, pad + 24, pad + 24, W - pad - 24, H - pad - 24, trim, ink_w=4, radius=6)
        elif shape == "buttress":
            # Projecting Gothic stepped flying buttress pier!
            draw_stone_block(d, pad, pad + 26, W - pad, H - pad, base, rng, ink_w=6, moss=moss, radius=6)
            draw_stone_block(d, pad + 28, pad, W - pad - 28, H - pad - 44, blend_rgb(base, (238, 234, 224), 0.16)[:3], rng, ink_w=5, moss=moss, radius=4)
        else:
            # Square brick / stone / plinth pier
            draw_stone_block(d, pad, pad, W - pad, H - pad, base, rng, ink_w=6, moss=moss, cracks=0.5, radius=6)
            draw_beveled_rect(d, pad + 26, pad + 26, W - pad - 26, H - pad - 26, blend_rgb(base, trim, 0.22)[:3], ink_w=4, radius=4)
            if spec.get("band", False):
                d.rectangle([pad + 22, pad + 22, W - pad - 22, H - pad - 22], outline=(*trim, 255), width=5)

    # --- 2. ROOFTOP ARCHITECTURE (CHIMNEYS, DORMERS, SKYLIGHTS, VENTS, WATER TOWERS) ---
    elif kind == "rooftop":
        sub = spec.get("sub", "chimney")
        pad_x, pad_y = 26, 26
        add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y + off[1]], radius=12, fill=col), offset=(9, 11), blur=10, alpha=95)
        d = ImageDraw.Draw(im)
        if sub == "chimney":
            draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, base, rng, ink_w=6, cracks=0.4, radius=6)
            draw_beveled_rect(d, pad_x + 16, pad_y + 16, W - pad_x - 16, H - pad_y - 16, shade_rgb(base, 0.85)[:3], ink_w=4, radius=4)
            n_pots = int(spec.get("pots", 2))
            for i in range(n_pots):
                px = pad_x + 74 + i * ((W - 2 * pad_x - 148) / max(1, n_pots - 1)) if n_pots > 1 else cx
                pr = 32 if n_pots <= 2 else 24
                d.ellipse([px - pr, cy - pr, px + pr, cy + pr], fill=(*trim, 255), outline=INK, width=5)
                d.ellipse([px - pr * 0.62, cy - pr * 0.62, px + pr * 0.62, cy + pr * 0.62], fill=(22, 20, 22, 255), outline=INK, width=3)
            if spec.get("snow", False):
                d.rounded_rectangle([pad_x + 4, pad_y + 4, W - pad_x - 4, pad_y + 44], radius=10, fill=(236, 242, 248, 255), outline=INK_MID, width=2)
        elif sub == "dormer":
            # Projecting pitched mansard dormer roof + recessed glowing or glass window!
            draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y - 34, base, ink_w=6, radius=6)
            # Ridge line down center of dormer roof
            d.line([(cx, pad_y + 4), (cx, H - pad_y - 36)], fill=(*trim, 255), width=10)
            d.line([(cx, pad_y + 4), (cx, H - pad_y - 36)], fill=INK, width=3)
            # Shingle lines left & right of ridge
            for sy in range(pad_y + 34, H - pad_y - 44, 34):
                d.line([(pad_x + 6, sy), (W - pad_x - 6, sy)], fill=INK_MID, width=3)
            # Front dormer window glazing at bottom edge (+Y)
            draw_glass_pane(d, pad_x + 28, H - pad_y - 42, W - pad_x - 28, H - pad_y, spec.get("glass", (144, 198, 224)), glow, lead_w=4)
        elif sub == "skylight_rect":
            draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y, trim, ink_w=6, radius=6)
            cols, rows = spec.get("panes", (4, 2))
            ix0, iy0, ix1, iy1 = pad_x + 18, pad_y + 18, W - pad_x - 18, H - pad_y - 18
            pw, ph = (ix1 - ix0) / cols, (iy1 - iy0) / rows
            for r in range(rows):
                for c in range(cols):
                    draw_glass_pane(d, ix0 + c * pw + 3, iy0 + r * ph + 3, ix0 + (c + 1) * pw - 3, iy0 + (r + 1) * ph - 3, base, glow, lead_w=3)
        elif sub == "skylight_dome":
            R = min(W, H) * 0.40
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*trim, 255), outline=INK, width=6)
            r_g = R * 0.86
            d.ellipse([cx - r_g, cy - r_g, cx + r_g, cy + r_g], fill=(*base, 255), outline=INK, width=4)
            for k in range(8):
                a = k * math.tau / 8
                d.line([(cx, cy), (cx + math.cos(a) * r_g, cy + math.sin(a) * r_g)], fill=(*trim, 255), width=8)
                d.line([(cx, cy), (cx + math.cos(a) * r_g, cy + math.sin(a) * r_g)], fill=INK, width=3)
            d.ellipse([cx - r_g * 0.45, cy - r_g * 0.45, cx + r_g * 0.45, cy + r_g * 0.45], outline=INK, width=4)
            d.ellipse([cx - r_g * 0.20, cy - r_g * 0.20, cx + r_g * 0.20, cy + r_g * 0.20], fill=(*trim, 255), outline=INK, width=4)
            d.arc([cx - r_g * 0.72, cy - r_g * 0.72, cx + r_g * 0.72, cy + r_g * 0.72], start=205, end=295, fill=blend_rgb(base, (255, 255, 255), 0.65), width=8)
        elif sub == "water_tower":
            R = min(W, H) * 0.40
            # Conical wooden roof & iron hoop band!
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*trim, 255), outline=INK, width=6)
            for k in range(16):
                a0, a1 = k * math.tau / 16, (k + 1) * math.tau / 16
                c = shade_rgb(base, 1.06 - abs(math.cos(a0 - 2.3)) * 0.28)
                d.polygon([(cx, cy), (cx + math.cos(a0) * R * 0.92, cy + math.sin(a0) * R * 0.92), (cx + math.cos(a1) * R * 0.92, cy + math.sin(a1) * R * 0.92)], fill=c, outline=INK_MID)
            d.ellipse([cx - R * 0.16, cy - R * 0.16, cx + R * 0.16, cy + R * 0.16], fill=(*trim, 255), outline=INK, width=4)
        elif sub == "turbine":
            R = min(W, H) * 0.36
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*base, 255), outline=INK, width=6)
            for k in range(10):
                a = k * math.tau / 10
                d.line([(cx, cy), (cx + math.cos(a) * R * 0.92, cy + math.sin(a) * R * 0.92)], fill=INK, width=8)
                d.line([(cx, cy), (cx + math.cos(a) * R * 0.92, cy + math.sin(a) * R * 0.92)], fill=(*trim, 255), width=4)
            d.ellipse([cx - R * 0.34, cy - R * 0.34, cx + R * 0.34, cy + R * 0.34], fill=(*trim, 255), outline=INK, width=5)
            if glow:
                add_glow(im, cx, cy, R * 0.5, R * 0.5, glow, alpha=130, blur=12)
        elif sub == "spire":
            # Copper lightning rod / weathervane / brass aether collector!
            R = min(W, H) * 0.34
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*base, 255), outline=INK, width=6)
            for k in range(4):
                a = k * math.pi / 2
                d.line([(cx - math.cos(a) * R * 1.12, cy - math.sin(a) * R * 1.12), (cx + math.cos(a) * R * 1.12, cy + math.sin(a) * R * 1.12)], fill=INK, width=10)
                d.line([(cx - math.cos(a) * R * 1.12, cy - math.sin(a) * R * 1.12), (cx + math.cos(a) * R * 1.12, cy + math.sin(a) * R * 1.12)], fill=(*trim, 255), width=5)
            d.ellipse([cx - R * 0.42, cy - R * 0.42, cx + R * 0.42, cy + R * 0.42], fill=(*trim, 255), outline=INK, width=5)
            if glow:
                add_glow(im, cx, cy, R * 0.6, R * 0.6, glow, alpha=140, blur=14)
        else:
            # Broken roof rafter hole / attic louver vent / pigeon coop!
            draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y, (24, 20, 22), ink_w=6, radius=10)
            for rx in range(pad_x + 36, W - pad_x - 20, 48):
                draw_wood_planks_box(d, rx - 10, pad_y + 6, rx + 10, H - pad_y - 6, base, rng, horizontal=False, n_planks=1, ink_w=3)

    # --- 3. STOREFRONT AWNINGS, BALCONIES, MARQUEES & HANGING SHOP SIGNS ---
    elif kind == "awning":
        pad_x, pad_y = 20, 20
        add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y - 12 + off[1]], radius=8, fill=col), offset=(8, 12), blur=10, alpha=95)
        d = ImageDraw.Draw(im)
        n_st = int(spec.get("stripes", 9))
        sw = (W - 2 * pad_x) / n_st
        y0, y1 = pad_y, H - pad_y - 24
        for i in range(n_st):
            sx0, sx1 = pad_x + i * sw, pad_x + (i + 1) * sw
            col = base if i % 2 == 0 else alt
            draw_beveled_rect(d, sx0, y0, sx1, y1, col, ink_w=4, hi_amt=0.22, sh_amt=0.30)
            d.pieslice([sx0 + 1, y1 - 22, sx1 - 1, y1 + 22], start=0, end=180, fill=shade_rgb(col, 0.86), outline=INK, width=4)
        # Mounting brass/iron valance rod along top edge!
        draw_beveled_rect(d, pad_x - 4, y0 - 4, W - pad_x + 4, y0 + 16, trim, ink_w=4, radius=4)

    elif kind == "balcony":
        pad_x, pad_y = 20, 18
        add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y + off[1]], radius=8, fill=col), offset=(8, 12), blur=10, alpha=95)
        d = ImageDraw.Draw(im)
        if spec.get("wood_deck", False):
            draw_wood_planks_box(d, pad_x, pad_y, W - pad_x, H - pad_y, base, rng, horizontal=True, n_planks=5, ink_w=5)
        else:
            draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, base, rng, ink_w=5, radius=6)
        # 3-sided perimeter iron/stone railing along West, South & East!
        rail_c = spec.get("rail", (56, 62, 68))
        draw_wrought_scroll(d, pad_x + 8, H - pad_y - 12, W - pad_x - 8, amp=12, iron_rgb=rail_c, brass_rgb=trim)
        draw_beveled_rect(d, pad_x, pad_y, pad_x + 20, H - pad_y, rail_c, ink_w=4)
        draw_beveled_rect(d, W - pad_x - 20, pad_y, W - pad_x, H - pad_y, rail_c, ink_w=4)
        if spec.get("flowerbox", False):
            draw_beveled_rect(d, pad_x + 48, H - pad_y - 22, W - pad_x - 48, H - pad_y + 6, (132, 74, 46), ink_w=3, radius=4)
            for fx in range(pad_x + 76, W - pad_x - 64, 42):
                draw_foliage_cluster(d, fx, H - pad_y - 8, 22, 14, (64, 122, 54), rng, n_leaves=6, blossom_rgb=(228, 72, 92))
        if spec.get("glass_marquee", False):
            draw_glass_pane(d, pad_x + 22, pad_y + 18, W - pad_x - 22, H - pad_y - 26, (154, 212, 232), (255, 228, 162), lead_w=4)

    elif kind == "shop_sign":
        # Projecting wrought-iron wall bracket + hand-painted hanging trade sign medallion!
        add_contact_shadow(im, lambda sd, col, off: sd.ellipse([cx - 64 + off[0], cy - 64 + off[1], cx + 64 + off[0], cy + 64 + off[1]], fill=col), offset=(6, 8), blur=8, alpha=90)
        d = ImageDraw.Draw(im)
        # Wall mounting bracket bar on left edge
        draw_beveled_rect(d, 16, cy - 42, 42, cy + 42, (58, 64, 72), ink_w=4, radius=4)
        d.line([(36, cy), (W - 36, cy)], fill=INK, width=14)
        d.line([(36, cy), (W - 36, cy)], fill=(68, 74, 82, 255), width=7)
        # Ornate hanging trade sign plaque!
        sx, sy, sr = cx + 18, cy, 68
        d.ellipse([sx - sr, sy - sr, sx + sr, sy + sr], fill=(*trim, 255), outline=INK, width=6)
        d.ellipse([sx - sr + 10, sy - sr + 10, sx + sr - 10, sy + sr - 10], fill=(*base, 255), outline=INK, width=4)
        # Distinct iconic trade emblem painted in center!
        emblem = spec.get("emblem", "star")
        if emblem == "mug":
            draw_beveled_rect(d, sx - 24, sy - 24, sx + 16, sy + 26, (218, 178, 74), ink_w=4, radius=6)
            d.ellipse([sx - 26, sy - 34, sx + 18, sy - 14], fill=(246, 242, 230, 255), outline=INK, width=3)
            d.arc([sx + 8, sy - 16, sx + 32, sy + 16], start=-90, end=90, fill=(218, 178, 74, 255), width=7)
        elif emblem == "pretzel":
            d.ellipse([sx - 30, sy - 24, sx + 30, sy + 24], outline=INK, width=14)
            d.ellipse([sx - 30, sy - 24, sx + 30, sy + 24], outline=(206, 146, 66, 255), width=8)
            d.line([(sx - 22, sy - 14), (sx + 22, sy + 14)], fill=(206, 146, 66, 255), width=8)
            d.line([(sx + 22, sy - 14), (sx - 22, sy + 14)], fill=(206, 146, 66, 255), width=8)
        elif emblem == "gear":
            d.ellipse([sx - 28, sy - 28, sx + 28, sy + 28], outline=(224, 188, 84, 255), width=12)
            for k in range(8):
                a = k * math.tau / 8
                d.line([(sx, sy), (sx + math.cos(a) * 34, sy + math.sin(a) * 34)], fill=(224, 188, 84, 255), width=6)
            d.ellipse([sx - 10, sy - 10, sx + 10, sy + 10], fill=(*base, 255), outline=INK, width=3)
        elif emblem == "flask":
            d.ellipse([sx - 24, sy - 6, sx + 24, sy + 32], fill=(72, 214, 146, 255), outline=INK, width=4)
            d.rectangle([sx - 10, sy - 32, sx + 10, sy - 2], fill=(168, 224, 232, 255), outline=INK, width=4)
        elif emblem == "crown":
            d.polygon([(sx - 30, sy + 18), (sx - 34, sy - 18), (sx - 12, sy - 2), (sx, sy - 26), (sx + 12, sy - 2), (sx + 34, sy - 18), (sx + 30, sy + 18)], fill=(228, 188, 74, 255), outline=INK)
        elif emblem == "cone":
            d.polygon([(sx - 18, sy - 6), (sx + 18, sy - 6), (sx, sy + 34)], fill=(208, 152, 74, 255), outline=INK)
            d.ellipse([sx - 22, sy - 30, sx + 22, sy + 6], fill=(238, 126, 158, 255), outline=INK, width=4)
        elif emblem == "anvil":
            d.polygon([(sx - 34, sy - 14), (sx + 32, sy - 14), (sx + 18, sy + 6), (sx + 26, sy + 24), (sx - 26, sy + 24), (sx - 16, sy + 6)], fill=(148, 156, 166, 255), outline=INK)
        elif emblem == "book":
            draw_beveled_rect(d, sx - 32, sy - 22, sx, sy + 22, (238, 230, 206), ink_w=3, radius=3)
            draw_beveled_rect(d, sx, sy - 22, sx + 32, sy + 22, (232, 222, 196), ink_w=3, radius=3)
            for ly in (sy - 12, sy - 2, sy + 8):
                d.line([(sx - 24, ly), (sx - 6, ly)], fill=INK_MID, width=2)
                d.line([(sx + 6, ly), (sx + 24, ly)], fill=INK_MID, width=2)
        elif emblem == "teacup":
            d.ellipse([sx - 28, sy - 28, sx + 28, sy + 28], fill=(238, 234, 222, 255), outline=INK, width=4)
            d.ellipse([sx - 18, sy - 18, sx + 18, sy + 18], fill=(142, 86, 46, 255), outline=INK, width=3)
            d.arc([sx + 14, sy - 12, sx + 36, sy + 12], start=-90, end=90, fill=(238, 234, 222, 255), width=6)
        elif emblem == "scissors":
            d.line([(sx - 24, sy - 24), (sx + 22, sy + 20)], fill=(214, 220, 226, 255), width=7)
            d.line([(sx + 24, sy - 24), (sx - 22, sy + 20)], fill=(214, 220, 226, 255), width=7)
            d.ellipse([sx - 30, sy + 10, sx - 10, sy + 30], outline=(224, 186, 78, 255), width=5)
            d.ellipse([sx + 10, sy + 10, sx + 30, sy + 30], outline=(224, 186, 78, 255), width=5)
        elif emblem == "lantern":
            d.rounded_rectangle([sx - 18, sy - 24, sx + 18, sy + 24], radius=6, fill=(255, 212, 92, 255), outline=INK, width=4)
            d.rectangle([sx - 22, sy - 28, sx + 22, sy - 18], fill=(64, 68, 76, 255), outline=INK, width=3)
            d.rectangle([sx - 22, sy + 18, sx + 22, sy + 28], fill=(64, 68, 76, 255), outline=INK, width=3)
        elif emblem == "horn":
            d.ellipse([sx - 24, sy - 18, sx + 18, sy + 24], outline=(226, 188, 74, 255), width=9)
            d.polygon([(sx + 12, sy - 14), (sx + 34, sy - 26), (sx + 34, sy + 6), (sx + 12, sy - 4)], fill=(226, 188, 74, 255), outline=INK)
        elif emblem == "pawn":
            # Classic 3 golden pawnbroker spheres!
            for px, py in ((sx - 18, sy - 10), (sx + 18, sy - 10), (sx, sy + 18)):
                d.ellipse([px - 14, py - 14, px + 14, py + 14], fill=(228, 190, 74, 255), outline=INK, width=4)
                d.ellipse([px - 7, py - 8, px + 1, py], fill=(255, 246, 194, 255))
        else:
            # Radiant brass emblem diamond / rosette!
            d.polygon([(sx, sy - 32), (sx + 24, sy), (sx, sy + 32), (sx - 24, sy)], fill=(*alt, 255), outline=INK)
            d.ellipse([sx - 10, sy - 10, sx + 10, sy + 10], fill=(*trim, 255), outline=INK, width=3)

    # --- 4. FLOOR MEDALLIONS, GRATES, SIGILS, MATS & FIRE-ESCAPE LANDINGS ---
    elif kind == "floor_medallion":
        R = min(W, H) * 0.43
        if glow:
            add_glow(im, cx, cy, R * 1.05, R * 1.05, glow, alpha=120, blur=18)
        d = ImageDraw.Draw(im)
        sub = spec.get("sub", "compass")
        if sub == "compass":
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*base, 255), outline=INK, width=6)
            d.ellipse([cx - R * 0.88, cy - R * 0.88, cx + R * 0.88, cy + R * 0.88], outline=(*trim, 255), width=8)
            for k in range(8):
                a = k * math.tau / 8
                len_r = R * (0.82 if k % 2 == 0 else 0.58)
                p_tip = (cx + math.cos(a) * len_r, cy + math.sin(a) * len_r)
                p_l = (cx + math.cos(a - 0.35) * R * 0.22, cy + math.sin(a - 0.35) * R * 0.22)
                p_r = (cx + math.cos(a + 0.35) * R * 0.22, cy + math.sin(a + 0.35) * R * 0.22)
                d.polygon([(cx, cy), p_l, p_tip], fill=(*trim, 255), outline=INK)
                d.polygon([(cx, cy), p_tip, p_r], fill=(*alt, 255), outline=INK)
            d.ellipse([cx - R * 0.16, cy - R * 0.16, cx + R * 0.16, cy + R * 0.16], fill=(*trim, 255), outline=INK, width=4)
        elif sub == "sigil":
            gl_c = glow or (76, 218, 244)
            d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=INK, width=14)
            d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(*gl_c, 255), width=7)
            d.ellipse([cx - R * 0.72, cy - R * 0.72, cx + R * 0.72, cy + R * 0.72], outline=(*gl_c, 255), width=5)
            for k in range(6):
                a1 = k * math.tau / 6
                a2 = (k + 2) * math.tau / 6
                d.line([(cx + math.cos(a1) * R * 0.70, cy + math.sin(a1) * R * 0.70), (cx + math.cos(a2) * R * 0.70, cy + math.sin(a2) * R * 0.70)], fill=(*gl_c, 255), width=6)
            d.ellipse([cx - R * 0.20, cy - R * 0.20, cx + R * 0.20, cy + R * 0.20], fill=(*gl_c, 255), outline=INK, width=4)
        elif sub == "grate_sq":
            pad = 26
            draw_beveled_rect(d, pad, pad, W - pad, H - pad, base, ink_w=6, radius=8)
            d.rectangle([pad + 20, pad + 20, W - pad - 20, H - pad - 20], fill=(20, 24, 28, 255), outline=INK, width=4)
            for gx in range(pad + 38, W - pad - 26, 30):
                draw_beveled_rect(d, gx - 6, pad + 20, gx + 6, H - pad - 20, trim, ink_w=2)
            draw_beveled_rect(d, pad + 20, cy - 8, W - pad - 20, cy + 8, trim, ink_w=3)
        elif sub == "doormat":
            pad_x, pad_y = 24, 34
            draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y, base, ink_w=5, radius=8)
            d.rounded_rectangle([pad_x + 16, pad_y + 16, W - pad_x - 16, H - pad_y - 16], radius=4, outline=(*trim, 255), width=5)
            d.polygon([(cx, pad_y + 34), (W - pad_x - 56, cy), (cx, H - pad_y - 34), (pad_x + 56, cy)], fill=(*trim, 255), outline=INK, width=3)
        elif sub == "conduit_hub":
            pad = 28
            draw_beveled_rect(d, pad, pad, W - pad, H - pad, (64, 72, 82), ink_w=6, radius=10)
            gl_c = glow or (72, 218, 242)
            d.rectangle([pad + 10, cy - 18, W - pad - 10, cy + 18], fill=(*gl_c, 255), outline=INK, width=4)
            d.rectangle([cx - 18, pad + 10, cx + 18, H - pad - 10], fill=(*gl_c, 255), outline=INK, width=4)
            d.ellipse([cx - 42, cy - 42, cx + 42, cy + 42], fill=(*trim, 255), outline=INK, width=5)
            d.ellipse([cx - 22, cy - 22, cx + 22, cy + 22], fill=(*gl_c, 255), outline=INK, width=4)
        elif sub == "glass_sidewalk":
            pad = 22
            draw_beveled_rect(d, pad, pad, W - pad, H - pad, (74, 80, 88), ink_w=6, radius=6)
            cols, rows = 5, 3
            ix0, iy0, ix1, iy1 = pad + 16, pad + 16, W - pad - 16, H - pad - 16
            pw, ph = (ix1 - ix0) / cols, (iy1 - iy0) / rows
            for r in range(rows):
                for c in range(cols):
                    draw_glass_pane(d, ix0 + c * pw + 4, iy0 + r * ph + 4, ix0 + (c + 1) * pw - 4, iy0 + (r + 1) * ph - 4, base, glow, lead_w=3)
        else:
            # Circular cast-iron cistern / street drain / fire-escape platform!
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*base, 255), outline=INK, width=6)
            d.ellipse([cx - R * 0.84, cy - R * 0.84, cx + R * 0.84, cy + R * 0.84], fill=(26, 30, 36, 255), outline=INK, width=4)
            for k in range(12):
                a = k * math.tau / 12
                d.line([(cx, cy), (cx + math.cos(a) * R * 0.84, cy + math.sin(a) * R * 0.84)], fill=(*trim, 255), width=6)
            d.ellipse([cx - R * 0.32, cy - R * 0.32, cx + R * 0.32, cy + R * 0.32], fill=(*base, 255), outline=INK, width=5)

    # --- 5. FIREPLACES, KACHELOFEN STOVES, RADIATORS & INTERIOR BUILT-INS ---
    elif kind == "interior_fixture":
        sub = spec.get("sub", "fireplace")
        pad_x, pad_y = 24, 20
        add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y + off[1]], radius=10, fill=col), offset=(8, 10), blur=9, alpha=95)
        d = ImageDraw.Draw(im)
        if sub == "fireplace":
            draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, base, rng, ink_w=6, cracks=0.35, radius=8)
            fx0, fy0, fx1, fy1 = pad_x + 54, pad_y + 42, W - pad_x - 54, H - pad_y - 26
            d.rounded_rectangle([fx0, fy0, fx1, fy1], radius=8, fill=(28, 22, 22, 255), outline=INK, width=5)
            if spec.get("lit", True):
                add_glow(im, cx, (fy0 + fy1) * 0.5, (fx1 - fx0) * 0.45, (fy1 - fy0) * 0.45, (255, 118, 34), alpha=155, blur=16)
                d = ImageDraw.Draw(im)
                for _ in range(16):
                    ex, ey = rng.uniform(fx0 + 24, fx1 - 24), rng.uniform(fy0 + 18, fy1 - 18)
                    d.ellipse([ex - 9, ey - 7, ex + 9, ey + 7], fill=rng.choice([(255, 148, 38, 255), (232, 68, 22, 255), (255, 218, 82, 255)]))
            draw_beveled_rect(d, cx - 68, (fy0 + fy1) * 0.5 - 12, cx + 68, (fy0 + fy1) * 0.5 + 10, (74, 46, 30), ink_w=4, radius=6)
            draw_stone_block(d, pad_x - 6, pad_y - 6, W - pad_x + 6, pad_y + 46, blend_rgb(base, (242, 236, 224), 0.16)[:3], rng, ink_w=5, radius=6)
            if spec.get("kettle", False):
                d.ellipse([cx - 24, (fy0 + fy1) * 0.5 - 24, cx + 24, (fy0 + fy1) * 0.5 + 24], fill=(176, 98, 56, 255), outline=INK, width=4)
        elif sub == "kachelofen":
            # Iconic glazed ceramic tiled Berlin corner stove with brass crown & fire door!
            draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, (124, 120, 116), rng, ink_w=5, radius=10)
            ix0, iy0, ix1, iy1 = pad_x + 26, pad_y + 26, W - pad_x - 26, H - pad_y - 26
            draw_beveled_rect(d, ix0, iy0, ix1, iy1, base, ink_w=6, radius=12, hi_amt=0.45, sh_amt=0.35)
            # Glazed ceramic tile grid relief on stove top
            for tx in range(ix0 + 48, ix1 - 20, 48):
                d.line([(tx, iy0 + 6), (tx, iy1 - 6)], fill=INK_MID, width=3)
            for ty in range(iy0 + 48, iy1 - 20, 48):
                d.line([(ix0 + 6, ty), (ix1 - 6, ty)], fill=INK_MID, width=3)
            d.ellipse([cx - 32, cy - 32, cx + 32, cy + 32], fill=(*trim, 255), outline=INK, width=5)
            # Small warm brass ash-door lip projecting at front (+Y)
            draw_beveled_rect(d, cx - 36, iy1 - 12, cx + 36, iy1 + 14, trim, ink_w=4, radius=4)
        elif sub == "radiator":
            # Cast-iron ribbed Berlin steam radiator with brass valve wheel!
            draw_beveled_rect(d, pad_x, cy - 28, W - pad_x, cy + 28, shade_rgb(base, 0.72)[:3], ink_w=4, radius=6)
            n_ribs = int(spec.get("ribs", 10))
            rw = (W - 2 * pad_x - 36) / n_ribs
            for i in range(n_ribs):
                rx = pad_x + 18 + i * rw
                draw_beveled_rect(d, rx + 2, pad_y + 8, rx + rw - 2, H - pad_y - 8, base, ink_w=3, radius=6, hi_amt=0.38)
            # Brass steam valve on right end!
            d.ellipse([W - pad_x - 10, cy - 18, W - pad_x + 22, cy + 18], fill=(*trim, 255), outline=INK, width=4)
        elif sub == "screen":
            # Folding room-divider screen (stained glass / shoji / oak)!
            n_p = 4
            pw = (W - 2 * pad_x) / n_p
            for i in range(n_p):
                dy = -16 if i % 2 == 0 else 16
                px0, px1 = pad_x + i * pw, pad_x + (i + 1) * pw
                draw_beveled_rect(d, px0 + 3, cy - 26 + dy, px1 - 3, cy + 26 + dy, trim, ink_w=4, radius=4)
                draw_glass_pane(d, px0 + 12, cy - 16 + dy, px1 - 12, cy + 16 + dy, base, glow, lead_w=3)
        elif sub == "shrine":
            # Built-in wall candle shrine niche with glowing votives!
            draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, base, rng, ink_w=6, moss=moss, radius=8)
            d.rounded_rectangle([pad_x + 28, pad_y + 24, W - pad_x - 28, H - pad_y - 24], radius=8, fill=(44, 38, 36, 255), outline=INK, width=4)
            gl_c = glow or (255, 198, 86)
            add_glow(im, cx, cy, (W - 2 * pad_x) * 0.36, (H - 2 * pad_y) * 0.36, gl_c, alpha=145, blur=14)
            d = ImageDraw.Draw(im)
            for kx in range(pad_x + 68, W - pad_x - 54, 44):
                ky = cy + rng.uniform(-14, 14)
                d.ellipse([kx - 13, ky - 13, kx + 13, ky + 13], fill=(238, 224, 184, 255), outline=INK, width=3)
                d.ellipse([kx - 6, ky - 6, kx + 6, ky + 6], fill=(*gl_c, 255))
        elif sub == "range_hood":
            # Pitched hammered copper kitchen range hood with riveted seams & top flue stack!
            draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y, base, ink_w=6, radius=8, hi_amt=0.38, sh_amt=0.40)
            draw_beveled_rect(d, pad_x + 36, pad_y + 26, W - pad_x - 36, H - pad_y - 26, shade_rgb(base, 0.88)[:3], ink_w=4, radius=6)
            for c0, c1 in (((pad_x + 6, pad_y + 6), (pad_x + 36, pad_y + 26)), ((W - pad_x - 6, pad_y + 6), (W - pad_x - 36, pad_y + 26)), ((pad_x + 6, H - pad_y - 6), (pad_x + 36, H - pad_y - 26)), ((W - pad_x - 6, H - pad_y - 6), (W - pad_x - 36, H - pad_y - 26))):
                d.line([c0, c1], fill=(*trim, 255), width=6)
                d.line([c0, c1], fill=INK, width=2)
            # Central riveted flue vent
            d.ellipse([cx - 38, cy - 38, cx + 38, cy + 38], fill=(*trim, 255), outline=INK, width=5)
            d.ellipse([cx - 24, cy - 24, cx + 24, cy + 24], fill=(42, 34, 32, 255), outline=INK, width=4)
        elif sub == "vanity":
            # Marble washroom vanity counter with dual porcelain basins & gleaming brass faucets!
            draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, base, rng, ink_w=6, cracks=0.2, radius=8)
            for bx in (pad_x + 108, W - pad_x - 108):
                d.ellipse([bx - 56, cy - 38, bx + 56, cy + 44], fill=(242, 246, 248, 255), outline=INK, width=5)
                d.ellipse([bx - 42, cy - 26, bx + 42, cy + 32], fill=(168, 212, 224, 255), outline=INK_MID, width=3)
                # Brass faucet & drain
                draw_beveled_rect(d, bx - 8, pad_y + 12, bx + 8, cy - 12, trim, ink_w=3, radius=3)
                d.ellipse([bx - 7, cy + 4, bx + 7, cy + 18], fill=(*trim, 255), outline=INK, width=2)
            # Small lavender soap bar in center
            draw_beveled_rect(d, cx - 18, cy - 12, cx + 18, cy + 12, (198, 152, 212), ink_w=3, radius=6)
        else:
            # Wall-mounted boiler pressure gauge cluster!
            draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y, base, ink_w=6, radius=10, hi_amt=0.36, sh_amt=0.38)
            draw_beveled_rect(d, pad_x + 22, pad_y + 22, W - pad_x - 22, H - pad_y - 22, trim, ink_w=4, radius=6)
            for gx in (pad_x + 68, cx, W - pad_x - 68):
                d.ellipse([gx - 22, cy - 22, gx + 22, cy + 22], fill=(238, 232, 214, 255), outline=INK, width=4)
                d.line([(gx, cy), (gx + 12, cy - 10)], fill=(176, 38, 38, 255), width=3)

    # --- 6. STREET, COURTYARD & EXTERIOR ARCHITECTURAL ACCENTS ---
    elif kind == "street_accent":
        sub = spec.get("sub", "bench")
        pad_x, pad_y = 22, 22
        add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y + off[1]], radius=12, fill=col), offset=(8, 10), blur=9, alpha=92)
        d = ImageDraw.Draw(im)
        if sub == "bench":
            draw_wood_planks_box(d, pad_x + 12, pad_y + 12, W - pad_x - 12, H - pad_y - 12, base, rng, horizontal=True, n_planks=4, ink_w=5)
            for ax in (pad_x + 8, W - pad_x - 24):
                draw_beveled_rect(d, ax, pad_y + 4, ax + 18, H - pad_y - 4, trim, ink_w=4, radius=4)
        elif sub == "stone_bench":
            draw_stone_block(d, pad_x, pad_y + 12, W - pad_x, H - pad_y - 12, base, rng, ink_w=6, moss=moss, radius=16)
            d.line([(pad_x + 18, cy), (W - pad_x - 18, cy)], fill=INK_MID, width=3)
        elif sub == "planter":
            draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, base, rng, ink_w=6, radius=8)
            d.rounded_rectangle([pad_x + 22, pad_y + 22, W - pad_x - 22, H - pad_y - 22], radius=6, fill=(68, 52, 38, 255), outline=INK, width=4)
            if spec.get("foliage", True):
                for fx in range(pad_x + 68, W - pad_x - 52, 54):
                    draw_foliage_cluster(d, fx, cy, 42, 36, (66, 122, 54), rng, n_leaves=9, blossom_rgb=spec.get("blossom", (228, 72, 92)))
        elif sub == "tree_grate":
            # Ornate Berlin cast-iron sidewalk tree-pit grate!
            draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y, base, ink_w=6, radius=8)
            for k in range(12):
                a = k * math.tau / 12
                d.line([(cx, cy), (cx + math.cos(a) * (W * 0.42), cy + math.sin(a) * (H * 0.42))], fill=(26, 30, 34, 255), width=6)
            d.ellipse([cx - 56, cy - 56, cx + 56, cy + 56], fill=(64, 50, 38, 255), outline=INK, width=5)
        elif sub == "letterbox":
            # Prussian blue / crimson / brass Berlin street corner postbox!
            draw_beveled_rect(d, pad_x + 28, pad_y + 24, W - pad_x - 28, H - pad_y - 24, base, ink_w=6, radius=10, hi_amt=0.35)
            draw_beveled_rect(d, pad_x + 48, pad_y + 44, W - pad_x - 48, pad_y + 62, (28, 24, 24), ink_w=3, radius=3)
            d.ellipse([cx - 20, cy + 16 - 20, cx + 20, cy + 16 + 20], fill=(*trim, 255), outline=INK, width=4)
        elif sub == "bollard":
            R = min(W, H) * 0.34
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*base, 255), outline=INK, width=6)
            d.ellipse([cx - R * 0.62, cy - R * 0.62, cx + R * 0.62, cy + R * 0.62], fill=(*trim, 255), outline=INK, width=4)
            d.ellipse([cx - R * 0.24, cy - R * 0.24, cx + R * 0.24, cy + R * 0.24], fill=blend_rgb(trim, (255, 248, 212), 0.55), outline=INK, width=3)
        elif sub == "bike_rack":
            draw_beveled_rect(d, pad_x, cy - 12, W - pad_x, cy + 12, base, ink_w=5, radius=4)
            for rx in range(pad_x + 32, W - pad_x - 20, 44):
                draw_beveled_rect(d, rx - 8, pad_y + 12, rx + 8, H - pad_y - 12, trim, ink_w=4, radius=6)
        elif sub == "fountain_small":
            R = min(W, H) * 0.38
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*base, 255), outline=INK, width=6)
            d.ellipse([cx - R * 0.72, cy - R * 0.72, cx + R * 0.72, cy + R * 0.72], fill=(76, 168, 198, 255), outline=INK, width=4)
            d.arc([cx - R * 0.52, cy - R * 0.52, cx + R * 0.52, cy + R * 0.52], start=200, end=330, fill=(214, 246, 255, 255), width=5)
            d.ellipse([cx - R * 0.22, cy - R * 0.22, cx + R * 0.22, cy + R * 0.22], fill=(*trim, 255), outline=INK, width=4)
        else:
            # Tram canopy / noticeboard / glass windbreak / stone lion gatepost!
            draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y, base, ink_w=6, radius=10)
            draw_glass_pane(d, pad_x + 18, pad_y + 18, W - pad_x - 18, H - pad_y - 18, spec.get("glass", (152, 206, 226)), glow, lead_w=4)

    # --- 7. MODULAR RUINS, DAMAGE & WEATHERING OVERLAYS ---
    elif kind == "ruin_overlay":
        sub = spec.get("sub", "rubble")
        d = ImageDraw.Draw(im)
        if sub == "rubble":
            for _ in range(22):
                rx = cx + rng.uniform(-W * 0.34, W * 0.34)
                ry = cy + rng.uniform(-H * 0.34, H * 0.34)
                rr = rng.uniform(14, 34)
                draw_stone_block(d, rx - rr, ry - rr * 0.7, rx + rr, ry + rr * 0.7, base, rng, ink_w=4, moss=moss)
        elif sub == "crater":
            R = min(W, H) * 0.40
            pts = [(cx + math.cos(k * math.tau / 12) * R * rng.uniform(0.84, 1.08), cy + math.sin(k * math.tau / 12) * R * rng.uniform(0.84, 1.08)) for k in range(12)]
            d.polygon(pts, fill=(*shade_rgb(base, 0.45)[:3], 255), outline=INK)
            d.line(pts + [pts[0]], fill=INK, width=6)
            in_pts = [(cx + (x - cx) * 0.56, cy + (y - cy) * 0.56) for x, y in pts]
            d.polygon(in_pts, fill=(24, 22, 24, 255), outline=INK_MID)
            for _ in range(10):
                a = rng.uniform(0, math.tau)
                r0 = rng.uniform(R * 0.6, R * 0.92)
                d.ellipse([cx + math.cos(a) * r0 - 10, cy + math.sin(a) * r0 - 8, cx + math.cos(a) * r0 + 10, cy + math.sin(a) * r0 + 8], fill=(*vary_rgb(base, rng, 14), 255), outline=INK, width=3)
        elif sub == "ivy_drape":
            for i in range(9):
                fx = 44 + i * ((W - 88) / 8)
                fy = cy + rng.uniform(-22, 22)
                draw_foliage_cluster(d, fx, fy, 38, 32, base, rng, n_leaves=9, blossom_rgb=spec.get("blossom", None))
        elif sub == "beams":
            for _ in range(5):
                bx = cx + rng.uniform(-W * 0.2, W * 0.2)
                by = cy + rng.uniform(-H * 0.2, H * 0.2)
                draw_wood_planks_box(d, bx - 95, by - 18, bx + 95, by + 18, vary_rgb(base, rng, 14), rng, horizontal=True, n_planks=2, ink_w=4)
        elif sub == "puddle":
            pts = [(cx + math.cos(k * math.tau / 14) * W * 0.36 * rng.uniform(0.75, 1.1), cy + math.sin(k * math.tau / 14) * H * 0.32 * rng.uniform(0.75, 1.1)) for k in range(14)]
            d.polygon(pts, fill=(*base, 255), outline=INK_MID)
            d.arc([cx - W * 0.22, cy - H * 0.18, cx + W * 0.22, cy + H * 0.18], start=200, end=330, fill=blend_rgb(base, (242, 250, 255), 0.55), width=6)
        elif sub == "snow_bank":
            drifts = []
            for _ in range(9):
                sx = rng.uniform(62, W - 62)
                sy = cy + rng.uniform(-26, 26)
                rx, ry = rng.uniform(46, 82), rng.uniform(26, 46)
                drifts.append((sx, sy, rx, ry))
            for sx, sy, rx, ry in drifts:
                d.ellipse([sx - rx, sy - ry + 8, sx + rx, sy + ry + 8], fill=(174, 198, 222, 255))
            for sx, sy, rx, ry in drifts:
                d.ellipse([sx - rx, sy - ry, sx + rx, sy + ry], fill=(236, 244, 252, 255), outline=(156, 182, 208, 255), width=2)
        elif sub == "wax_mound":
            for _ in range(10):
                wx = cx + rng.uniform(-W * 0.3, W * 0.3)
                wy = cy + rng.uniform(-H * 0.24, H * 0.24)
                r = rng.uniform(22, 42)
                d.ellipse([wx - r, wy - r * 0.8, wx + r, wy + r * 0.8], fill=(*vary_rgb((228, 212, 168), rng, 14), 255), outline=INK_WARM, width=3)
            for _ in range(5):
                kx, ky = cx + rng.uniform(-W * 0.22, W * 0.22), cy + rng.uniform(-H * 0.16, H * 0.16)
                add_glow(im, kx, ky, 26, 26, (255, 196, 82), alpha=120, blur=10)
                d = ImageDraw.Draw(im)
                d.ellipse([kx - 9, ky - 9, kx + 9, ky + 9], fill=(246, 236, 206, 255), outline=INK, width=3)
                d.ellipse([kx - 4, ky - 4, kx + 4, ky + 4], fill=(255, 206, 88, 255))
        else:
            # Glass shard scatter / scorch blast / sandbag arc!
            for _ in range(18):
                sx = cx + rng.uniform(-W * 0.36, W * 0.36)
                sy = cy + rng.uniform(-H * 0.36, H * 0.36)
                c = rng.choice([(186, 48, 62), (56, 128, 198), (224, 178, 56), (168, 216, 232)])
                d.polygon([(sx, sy - 14), (sx + 16, sy + 6), (sx - 10, sy + 12)], fill=(*c, 255), outline=INK)

    return apply_painterly_finish(im, w, h, seed=seed, grain=5.2)


# =============================================================================
# CATALOG OF ALL 180 BRAND-NEW UNIQUE ARCHITECTURAL BUILDER PROPS!
# =============================================================================
NEW_ARCH_PROPS: list[tuple[str, str, list[str], dict]] = [
    # --- A. 32 COLUMNS, PILLARS, BUTTRESSES & PILASTERS ---
    ("col_marble_fluted_ivory", "Fluted Ivory Marble Classical Column", ["pillar", "column", "marble", "classic", "temple", "harmony"], dict(kind="column", shape="round", base=(226, 220, 206), trim=(216, 178, 74))),
    ("col_marble_gold_banded", "Gilded Palace Marble Column with Brass Band", ["pillar", "column", "marble", "gold", "palace", "harmony"], dict(kind="column", shape="round", base=(224, 218, 204), trim=(222, 184, 74), band=True)),
    ("col_marble_broken_stump", "Shattered Mossy Marble Ruin Column Stump", ["pillar", "column", "marble", "broken", "ruin", "harmony"], dict(kind="column", shape="round", base=(208, 202, 190), broken=True, moss=0.65)),
    ("col_obsidian_sovereign", "Sovereign Obsidian & Gold-Banded Column", ["pillar", "column", "obsidian", "sovereign", "cathedral", "harmony"], dict(kind="column", shape="round", base=(58, 56, 68), trim=(222, 184, 74), band=True)),
    ("col_granite_berlin_civic", "Berlin Dressed Granite Civic Column", ["pillar", "column", "granite", "berlin", "civic", "harmony"], dict(kind="column", shape="round", base=(142, 144, 148), trim=(188, 156, 76))),
    ("col_sandstone_desert_temple", "Carved Sandstone Desert Temple Column", ["pillar", "column", "sandstone", "desert", "temple", "harmony"], dict(kind="column", shape="round", base=(202, 174, 126), trim=(186, 146, 78))),
    ("col_gothic_clustered_stone", "Gothic Clustered Cathedral Stone Pier", ["pillar", "pier", "gothic", "cathedral", "stone", "harmony"], dict(kind="column", shape="clustered", base=(134, 132, 138), trim=(168, 164, 158))),
    ("col_gothic_clustered_obsidian", "Gothic Obsidian & Brass Cathedral Pier", ["pillar", "pier", "gothic", "obsidian", "sovereign", "harmony"], dict(kind="column", shape="clustered", base=(62, 58, 72), trim=(214, 176, 72))),
    ("col_gothic_clustered_mossy", "Moss-Draped Ruined Abbey Clustered Pier", ["pillar", "pier", "moss", "ruin", "cathedral", "harmony"], dict(kind="column", shape="clustered", base=(116, 122, 114), trim=(84, 112, 68))),
    ("col_gothic_clustered_marble", "Alabaster Clustered Sanctuary Pier", ["pillar", "pier", "marble", "temple", "cathedral", "harmony"], dict(kind="column", shape="clustered", base=(224, 218, 206), trim=(216, 178, 76))),
    ("col_jugendstil_station_iron", "Berlin Jugendstil Cast-Iron Station Column", ["pillar", "column", "iron", "station", "berlin", "harmony"], dict(kind="column", shape="round", base=(68, 78, 86), trim=(212, 174, 72), band=True)),
    ("col_jugendstil_verdigris", "Verdigris-Copper Art-Nouveau Arcade Column", ["pillar", "column", "verdigris", "copper", "berlin", "harmony"], dict(kind="column", shape="round", base=(78, 136, 122), trim=(214, 178, 76), band=True)),
    ("col_pylon_aether_cyan", "Magipunk Glowing Cyan Aether Crystal Pylon", ["pillar", "pylon", "aether", "cyan", "magipunk", "harmony"], dict(kind="column", shape="pylon", base=(62, 74, 84), trim=(208, 170, 74), glow=(72, 220, 244))),
    ("col_pylon_sovereign_violet", "Sovereign Glowing Violet Arcane Pylon", ["pillar", "pylon", "arcane", "violet", "sovereign", "harmony"], dict(kind="column", shape="pylon", base=(64, 58, 78), trim=(216, 178, 74), glow=(178, 96, 248))),
    ("col_pylon_alchemical_emerald", "Alchemical Glowing Emerald Energy Pylon", ["pillar", "pylon", "alchemy", "emerald", "magipunk", "harmony"], dict(kind="column", shape="pylon", base=(58, 74, 68), trim=(198, 166, 74), glow=(68, 224, 148))),
    ("col_pylon_solar_amber", "Solar Amber Brass Observatory Pylon", ["pillar", "pylon", "amber", "brass", "observatory", "harmony"], dict(kind="column", shape="pylon", base=(96, 74, 54), trim=(218, 180, 76), glow=(255, 192, 68))),
    ("col_oak_tavern_post", "Heavy Carved Oak Tavern Support Post", ["pillar", "post", "oak", "tavern", "wood", "harmony"], dict(kind="column", shape="wood_post", base=(142, 96, 56), trim=(104, 68, 38))),
    ("col_walnut_library_post", "Dark Walnut & Brass Library Newel Pillar", ["pillar", "post", "walnut", "library", "brass", "harmony"], dict(kind="column", shape="wood_post", base=(98, 64, 40), trim=(206, 168, 72))),
    ("col_mine_rough_timber", "Rough-Hewn Mine-Shaft Timber Prop Post", ["pillar", "post", "mine", "wood", "dungeon", "harmony"], dict(kind="column", shape="wood_post", base=(106, 76, 48), trim=(74, 80, 86))),
    ("col_red_brick_pier", "Berlin Red-Brick Courtyard Square Pier", ["pillar", "pier", "brick", "berlin", "courtyard", "harmony"], dict(kind="column", shape="square", base=(158, 76, 54), trim=(196, 184, 162))),
    ("col_yellow_klinker_pier", "Berlin Yellow Klinker-Brick Factory Pier", ["pillar", "pier", "brick", "yellow", "berlin", "harmony"], dict(kind="column", shape="square", base=(196, 166, 98), trim=(142, 134, 118))),
    ("col_soot_brick_pier", "Soot-Stained Industrial Brick Arcade Pier", ["pillar", "pier", "brick", "soot", "industrial", "harmony"], dict(kind="column", shape="square", base=(112, 58, 50), trim=(74, 78, 84))),
    ("col_dwarven_basalt_pier", "Dwarven Basalt & Bronze Square Pillar", ["pillar", "pier", "dwarven", "basalt", "bronze", "harmony"], dict(kind="column", shape="square", base=(84, 80, 86), trim=(196, 142, 64), band=True)),
    ("col_elven_silver_column", "Elven Pale-Stone & Silver Filigree Column", ["pillar", "column", "elven", "silver", "fantasy", "harmony"], dict(kind="column", shape="round", base=(220, 218, 208), trim=(178, 198, 214), band=True)),
    ("col_buttress_gothic_stone", "Gothic Stepped Cathedral Stone Buttress", ["buttress", "pillar", "gothic", "cathedral", "stone", "harmony"], dict(kind="column", shape="buttress", w=160, h=224, base=(128, 126, 132), moss=0.1)),
    ("col_buttress_limestone", "Prussian Limestone Stepped Wall Buttress", ["buttress", "pillar", "limestone", "berlin", "stone", "harmony"], dict(kind="column", shape="buttress", w=160, h=224, base=(204, 194, 174))),
    ("col_buttress_brick", "Berlin Red-Brick Viaduct Wall Buttress", ["buttress", "pillar", "brick", "berlin", "railway", "harmony"], dict(kind="column", shape="buttress", w=160, h=224, base=(154, 76, 54))),
    ("col_buttress_mossy_ruin", "Moss-Overgrown Castle Ruin Buttress", ["buttress", "pillar", "moss", "ruin", "castle", "harmony"], dict(kind="column", shape="buttress", w=160, h=224, base=(114, 118, 112), moss=0.6)),
    ("col_iron_banded_dungeon", "Iron-Banded Dungeon Prison Stone Pillar", ["pillar", "column", "dungeon", "iron", "stone", "harmony"], dict(kind="column", shape="round", base=(116, 116, 120), trim=(64, 70, 78), band=True)),
    ("col_glacial_ice_pillar", "Carved Glacial Ice Citadel Pillar", ["pillar", "column", "ice", "winter", "frost", "harmony"], dict(kind="column", shape="round", base=(156, 212, 238), trim=(216, 244, 255))),
    ("col_volcanic_obsidian_pier", "Volcanic Charred Basalt Fortress Pillar", ["pillar", "column", "volcanic", "obsidian", "dungeon", "harmony"], dict(kind="column", shape="square", base=(56, 54, 62), trim=(232, 102, 28), band=True)),
    ("col_colorable_plinth", "Colorable Painted Architectural Plinth Pier", ["pillar", "colorable", "plinth", "modular", "harmony"], dict(kind="column", shape="square", colorable=True, trim=(214, 176, 74), band=True)),

    # --- B. 28 ROOFTOP ARCHITECTURE, CHIMNEYS, DORMERS & SKYLIGHTS ---
    ("roof_chimney_brick_double", "Berlin Red-Brick Double Chimney Stack", ["roof", "chimney", "brick", "berlin", "rooftop", "harmony"], dict(kind="rooftop", sub="chimney", w=224, h=144, base=(156, 76, 54), trim=(178, 108, 72), pots=2)),
    ("roof_chimney_brick_triple", "Tenement Brick Triple Clay-Pot Chimney", ["roof", "chimney", "brick", "tenement", "rooftop", "harmony"], dict(kind="rooftop", sub="chimney", w=272, h=144, base=(146, 72, 52), trim=(176, 104, 68), pots=3)),
    ("roof_chimney_brick_single", "Cottage Single Terracotta-Pot Chimney", ["roof", "chimney", "brick", "cottage", "rooftop", "harmony"], dict(kind="rooftop", sub="chimney", w=160, h=160, base=(162, 82, 56), trim=(184, 112, 74), pots=1)),
    ("roof_chimney_stone_gothic", "Gothic Ashlar Stone Cathedral Chimney", ["roof", "chimney", "stone", "gothic", "cathedral", "rooftop", "harmony"], dict(kind="rooftop", sub="chimney", w=224, h=144, base=(124, 122, 128), trim=(88, 92, 98), pots=2)),
    ("roof_chimney_yellow_klinker", "Berlin Yellow Klinker-Brick Factory Chimney", ["roof", "chimney", "brick", "yellow", "berlin", "rooftop", "harmony"], dict(kind="rooftop", sub="chimney", w=224, h=144, base=(194, 164, 96), trim=(92, 96, 104), pots=2)),
    ("roof_chimney_snow_capped", "Snow-Capped Winter Brick Chimney Stack", ["roof", "chimney", "snow", "winter", "rooftop", "harmony"], dict(kind="rooftop", sub="chimney", w=224, h=144, base=(148, 74, 54), trim=(174, 106, 72), pots=2, snow=True)),
    ("roof_dormer_slate_lit", "Charcoal Slate Mansard Dormer Window (Lit)", ["roof", "dormer", "window", "slate", "berlin", "rooftop", "harmony"], dict(kind="rooftop", sub="dormer", w=192, h=224, base=(78, 84, 94), trim=(136, 142, 150), glass=(226, 192, 112), glow=(255, 212, 118))),
    ("roof_dormer_slate_dark", "Charcoal Slate Mansard Dormer Window (Dusk)", ["roof", "dormer", "window", "slate", "berlin", "rooftop", "harmony"], dict(kind="rooftop", sub="dormer", w=192, h=224, base=(76, 82, 92), trim=(132, 138, 146), glass=(112, 156, 184))),
    ("roof_dormer_copper_verdigris", "Verdigris Copper Cathedral Dormer Projection", ["roof", "dormer", "copper", "verdigris", "cathedral", "rooftop", "harmony"], dict(kind="rooftop", sub="dormer", w=192, h=224, base=(82, 142, 128), trim=(208, 170, 74), glass=(148, 204, 224))),
    ("roof_dormer_terracotta", "Warm Terracotta Clay-Tile Dormer Window", ["roof", "dormer", "terracotta", "clay", "rooftop", "harmony"], dict(kind="rooftop", sub="dormer", w=192, h=224, base=(176, 92, 58), trim=(138, 72, 46), glass=(154, 206, 226))),
    ("roof_dormer_cedar_cottage", "Weathered Cedar-Shake Cottage Dormer", ["roof", "dormer", "wood", "cottage", "rooftop", "harmony"], dict(kind="rooftop", sub="dormer", w=192, h=224, base=(128, 88, 56), trim=(94, 62, 38), glass=(218, 186, 116), glow=(255, 214, 128))),
    ("roof_skylight_conservatory_lg", "Long Iron-Framed Conservatory Roof Skylight", ["roof", "skylight", "glass", "conservatory", "rooftop", "harmony"], dict(kind="rooftop", sub="skylight_rect", w=320, h=192, base=(148, 206, 228), trim=(64, 72, 80), panes=(5, 2))),
    ("roof_skylight_brass_warm", "Warm Lit Brass-Framed Atelier Skylight", ["roof", "skylight", "glass", "brass", "lit", "rooftop", "harmony"], dict(kind="rooftop", sub="skylight_rect", w=256, h=192, base=(224, 198, 126), trim=(188, 152, 68), glow=(255, 222, 142), panes=(4, 2))),
    ("roof_skylight_factory_saw", "Industrial Factory Frosted-Glass Skylight", ["roof", "skylight", "factory", "industrial", "rooftop", "harmony"], dict(kind="rooftop", sub="skylight_rect", w=320, h=160, base=(158, 186, 198), trim=(74, 82, 90), panes=(6, 2))),
    ("roof_skylight_dome_glass", "Octagonal Iron & Glass Atrium Roof Dome", ["roof", "skylight", "dome", "glass", "rooftop", "harmony"], dict(kind="rooftop", sub="skylight_dome", w=256, h=256, base=(146, 208, 232), trim=(72, 80, 88))),
    ("roof_skylight_dome_brass", "Gilded Brass & Amber Parlor Roof Dome", ["roof", "skylight", "dome", "brass", "berlin", "rooftop", "harmony"], dict(kind="rooftop", sub="skylight_dome", w=256, h=256, base=(228, 196, 118), trim=(208, 170, 72))),
    ("roof_skylight_dome_aether", "Magipunk Cyan Aether Observatory Dome", ["roof", "skylight", "dome", "aether", "magipunk", "rooftop", "harmony"], dict(kind="rooftop", sub="skylight_dome", w=256, h=256, base=(78, 212, 238), trim=(198, 162, 72))),
    ("roof_skylight_dome_violet", "Sovereign Violet Stained-Glass Cathedral Dome", ["roof", "skylight", "dome", "stained_glass", "sovereign", "rooftop", "harmony"], dict(kind="rooftop", sub="skylight_dome", w=256, h=256, base=(148, 84, 218), trim=(214, 176, 74))),
    ("roof_water_tower_oak", "Rooftop Timber & Iron-Hoop Water Tower", ["roof", "water_tower", "wood", "berlin", "rooftop", "harmony"], dict(kind="rooftop", sub="water_tower", w=256, h=256, base=(142, 98, 60), trim=(72, 78, 86))),
    ("roof_water_tower_copper", "Verdigris-Roofed Magipunk Cistern Tower", ["roof", "water_tower", "copper", "magipunk", "rooftop", "harmony"], dict(kind="rooftop", sub="water_tower", w=256, h=256, base=(82, 142, 128), trim=(206, 168, 72))),
    ("roof_turbine_brass_vent", "Whirring Brass Industrial Roof Turbine Vent", ["roof", "vent", "turbine", "brass", "industrial", "rooftop", "harmony"], dict(kind="rooftop", sub="turbine", w=160, h=160, base=(84, 92, 102), trim=(208, 170, 72))),
    ("roof_turbine_iron_exhaust", "Cast-Iron Foundry Roof Exhaust Stack", ["roof", "vent", "exhaust", "iron", "factory", "rooftop", "harmony"], dict(kind="rooftop", sub="turbine", w=160, h=160, base=(68, 74, 82), trim=(132, 138, 146))),
    ("roof_turbine_aether_coil", "Glowing Cyan Aether-Collector Roof Turbine", ["roof", "aether", "turbine", "magipunk", "rooftop", "harmony"], dict(kind="rooftop", sub="turbine", w=192, h=192, base=(62, 74, 84), trim=(212, 174, 72), glow=(72, 222, 244))),
    ("roof_spire_copper_lightning", "Verdigris Copper Roof Lightning Rod Finial", ["roof", "spire", "lightning", "copper", "berlin", "rooftop", "harmony"], dict(kind="rooftop", sub="spire", w=160, h=160, base=(78, 136, 122), trim=(218, 180, 74))),
    ("roof_spire_iron_weathervane", "Wrought-Iron Rooftop Compass Weathervane", ["roof", "weathervane", "iron", "rooftop", "harmony"], dict(kind="rooftop", sub="spire", w=160, h=160, base=(62, 68, 76), trim=(198, 162, 74))),
    ("roof_spire_aether_dish", "Magipunk Brass Aether-Relay Roof Spire", ["roof", "spire", "aether", "brass", "magipunk", "rooftop", "harmony"], dict(kind="rooftop", sub="spire", w=192, h=192, base=(178, 142, 62), trim=(226, 192, 92), glow=(78, 224, 246))),
    ("roof_attic_rafter_breach", "Smashed Rooftop Hole Showing Exposed Rafters", ["roof", "ruin", "broken", "rafters", "rooftop", "harmony"], dict(kind="rooftop", sub="breach", w=224, h=192, base=(128, 88, 54))),
    ("roof_colorable_dormer", "Colorable Shingled Mansard Roof Dormer", ["roof", "dormer", "colorable", "rooftop", "modular", "harmony"], dict(kind="rooftop", sub="dormer", w=192, h=224, colorable=True, trim=(212, 176, 76), glass=(154, 206, 228))),

    # --- C. 28 STOREFRONT AWNINGS, BALCONIES, MARQUEES & HANGING SHOP SIGNS ---
    ("facade_awning_emerald_cream", "Emerald & Cream Striped Shopfront Awning", ["awning", "facade", "shop", "emerald", "berlin", "harmony"], dict(kind="awning", w=320, h=128, base=(46, 114, 78), alt=(234, 226, 206), trim=(198, 160, 72))),
    ("facade_awning_navy_cream", "Prussian-Navy & Cream Striped Café Awning", ["awning", "facade", "shop", "navy", "cafe", "harmony"], dict(kind="awning", w=320, h=128, base=(48, 74, 118), alt=(234, 226, 208), trim=(206, 168, 74))),
    ("facade_awning_burgundy_gold", "Burgundy & Gold Striped Bakery Awning", ["awning", "facade", "shop", "burgundy", "bakery", "harmony"], dict(kind="awning", w=320, h=128, base=(148, 36, 46), alt=(226, 188, 86), trim=(198, 160, 72))),
    ("facade_awning_mustard_walnut", "Mustard & Walnut Striped Bookshop Awning", ["awning", "facade", "shop", "mustard", "berlin", "harmony"], dict(kind="awning", w=320, h=128, base=(198, 152, 62), alt=(112, 74, 44), trim=(186, 152, 74))),
    ("facade_awning_teal_ivory", "Teal & Ivory Striped Gelato Parlor Awning", ["awning", "facade", "shop", "teal", "parlor", "harmony"], dict(kind="awning", w=320, h=128, base=(48, 126, 134), alt=(236, 228, 212), trim=(212, 174, 74))),
    ("facade_awning_rose_cream", "Rose-Pink & Cream Patisserie Awning", ["awning", "facade", "shop", "rose", "bakery", "harmony"], dict(kind="awning", w=320, h=128, base=(196, 84, 108), alt=(238, 230, 216), trim=(208, 172, 78))),
    ("facade_awning_weathered_canvas", "Weathered Sun-Faded Market Canvas Awning", ["awning", "facade", "market", "canvas", "slum", "harmony"], dict(kind="awning", w=320, h=128, base=(164, 148, 118), alt=(142, 126, 98), trim=(98, 74, 52))),
    ("facade_awning_colorable", "Colorable Striped Storefront Awning", ["awning", "facade", "colorable", "shop", "modular", "harmony"], dict(kind="awning", w=320, h=128, colorable=True, alt=(236, 228, 212), trim=(208, 170, 72))),
    ("facade_balcony_jugendstil_iron", "Berlin Jugendstil Wrought-Iron Juliet Balcony", ["balcony", "facade", "iron", "jugendstil", "berlin", "harmony"], dict(kind="balcony", w=288, h=144, base=(154, 150, 144), rail=(56, 62, 68), trim=(214, 176, 72))),
    ("facade_balcony_flowerbox_iron", "Flowerbox-Trimmed Berlin Iron Juliet Balcony", ["balcony", "facade", "flowerbox", "berlin", "iron", "harmony"], dict(kind="balcony", w=288, h=160, base=(158, 154, 146), rail=(56, 62, 68), trim=(208, 170, 74), flowerbox=True)),
    ("facade_balcony_limestone_manor", "Carved Limestone Noble Manor Balcony", ["balcony", "facade", "stone", "manor", "limestone", "harmony"], dict(kind="balcony", w=320, h=160, base=(206, 198, 178), rail=(178, 170, 152), trim=(216, 178, 78))),
    ("facade_balcony_oak_cottage", "Warm Oak Timber Flowerbox Cottage Balcony", ["balcony", "facade", "wood", "oak", "cottage", "harmony"], dict(kind="balcony", w=288, h=160, base=(148, 102, 60), rail=(108, 72, 42), trim=(198, 160, 74), wood_deck=True, flowerbox=True)),
    ("facade_balcony_fire_escape", "Riveted Iron Tenement Fire-Escape Balcony", ["balcony", "facade", "iron", "fire_escape", "tenement", "harmony"], dict(kind="balcony", w=288, h=144, base=(74, 82, 92), rail=(56, 62, 70), trim=(142, 148, 156))),
    ("facade_marquee_theater_glass", "Art-Nouveau Brass & Glass Entrance Marquee", ["marquee", "canopy", "facade", "glass", "theater", "berlin", "harmony"], dict(kind="balcony", w=320, h=160, base=(186, 152, 68), rail=(62, 68, 76), trim=(224, 186, 78), glass_marquee=True)),
    ("facade_sign_tavern_mug", "Hanging Wrought-Iron Tavern Ale-Mug Sign", ["sign", "facade", "tavern", "shop", "iron", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(116, 72, 42), trim=(206, 168, 72), emblem="mug")),
    ("facade_sign_bakery_pretzel", "Hanging Wrought-Iron Bakery Pretzel Sign", ["sign", "facade", "bakery", "shop", "iron", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(146, 52, 46), trim=(212, 174, 74), emblem="pretzel")),
    ("facade_sign_clockmaker_gear", "Hanging Brass Clockmaker & Tinkerer Gear Sign", ["sign", "facade", "clockmaker", "magipunk", "shop", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(48, 68, 96), trim=(218, 180, 74), emblem="gear")),
    ("facade_sign_apothecary_flask", "Hanging Emerald Apothecary Alchemist Flask Sign", ["sign", "facade", "apothecary", "alchemy", "shop", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(44, 96, 72), trim=(208, 170, 72), emblem="flask")),
    ("facade_sign_sovereign_crown", "Hanging Sovereign Royal Guild Crown Crest Sign", ["sign", "facade", "sovereign", "crown", "guild", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(96, 38, 102), trim=(224, 186, 76), emblem="crown")),
    ("facade_sign_gelato_cone", "Hanging Crimson Ice-Cream & Gelato Cone Sign", ["sign", "facade", "ice_cream", "shop", "cafe", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(148, 38, 52), trim=(218, 180, 76), emblem="cone")),
    ("facade_sign_blacksmith_anvil", "Hanging Forged-Iron Blacksmith Anvil Sign", ["sign", "facade", "blacksmith", "smithy", "shop", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(62, 66, 74), trim=(178, 146, 74), emblem="anvil")),
    ("facade_sign_bookshop_emblem", "Hanging Midnight-Blue Open-Book Bookshop Sign", ["sign", "facade", "bookshop", "library", "shop", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(46, 66, 106), trim=(214, 176, 74), alt=(232, 224, 198), emblem="book")),
    ("facade_sign_cafe_teahouse", "Hanging Teal Café Teacup & Saucer Sign", ["sign", "facade", "cafe", "tea", "shop", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(48, 118, 124), trim=(216, 178, 76), alt=(236, 228, 208), emblem="teacup")),
    ("facade_sign_tailor_guild", "Hanging Plum Tailor Crossed-Scissors Sign", ["sign", "facade", "tailor", "shop", "berlin", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(108, 48, 88), trim=(212, 174, 74), alt=(236, 222, 194), emblem="scissors")),
    ("facade_sign_inn_lantern", "Hanging Warm Ochre Innkeeper Lantern Sign", ["sign", "facade", "inn", "tavern", "shop", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(134, 72, 42), trim=(224, 188, 82), alt=(255, 228, 138), emblem="lantern")),
    ("facade_sign_post_office", "Hanging Prussian-Yellow Post-Horn Telegraph Sign", ["sign", "facade", "post", "berlin", "shop", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(48, 76, 122), trim=(224, 184, 68), alt=(244, 232, 184), emblem="horn")),
    ("facade_sign_pawn_broker", "Hanging Forest-Green Three-Sphere Pawnbroker Sign", ["sign", "facade", "pawn", "shop", "berlin", "harmony"], dict(kind="shop_sign", w=160, h=128, base=(48, 92, 62), trim=(218, 180, 74), alt=(232, 196, 84), emblem="pawn")),
    ("facade_sign_colorable", "Colorable Hanging Wrought-Iron Shop Sign", ["sign", "facade", "colorable", "shop", "modular", "harmony"], dict(kind="shop_sign", w=160, h=128, colorable=True, trim=(214, 176, 74), alt=(242, 232, 204), emblem="star")),

    # --- D. 24 FLOOR MEDALLIONS, MANHOLES, GRATES, THRESHOLDS & LANDINGS ---
    ("floor_compass_marble_gold", "Ivory Marble & Brass Foyer Compass Medallion", ["floor", "medallion", "compass", "marble", "foyer", "harmony"], dict(kind="floor_medallion", sub="compass", w=256, h=256, base=(226, 220, 206), trim=(214, 176, 72), alt=(74, 78, 88))),
    ("floor_compass_obsidian_gold", "Obsidian & Gold Cathedral Compass Medallion", ["floor", "medallion", "compass", "obsidian", "cathedral", "harmony"], dict(kind="floor_medallion", sub="compass", w=256, h=256, base=(52, 50, 62), trim=(222, 184, 74), alt=(134, 42, 52))),
    ("floor_compass_emerald_brass", "Emerald & Brass Grand Station Floor Medallion", ["floor", "medallion", "compass", "emerald", "station", "harmony"], dict(kind="floor_medallion", sub="compass", w=256, h=256, base=(44, 98, 76), trim=(216, 178, 74), alt=(228, 222, 204))),
    ("floor_compass_navy_observatory", "Midnight-Navy Starlight Observatory Medallion", ["floor", "medallion", "compass", "navy", "observatory", "harmony"], dict(kind="floor_medallion", sub="compass", w=256, h=256, base=(42, 58, 98), trim=(224, 188, 78), alt=(158, 206, 232))),
    ("floor_sigil_aether_cyan", "Glowing Cyan Magipunk Aether Floor Sigil", ["floor", "sigil", "aether", "cyan", "arcane", "magipunk", "harmony"], dict(kind="floor_medallion", sub="sigil", w=256, h=256, glow=(72, 220, 244))),
    ("floor_sigil_sovereign_violet", "Glowing Violet Sovereign Ritual Floor Sigil", ["floor", "sigil", "arcane", "violet", "sovereign", "harmony"], dict(kind="floor_medallion", sub="sigil", w=256, h=256, glow=(178, 96, 248))),
    ("floor_sigil_crimson_ritual", "Glowing Crimson Blood-Pact Ritual Floor Sigil", ["floor", "sigil", "ritual", "crimson", "dungeon", "harmony"], dict(kind="floor_medallion", sub="sigil", w=256, h=256, glow=(228, 56, 62))),
    ("floor_sigil_emerald_alchemy", "Glowing Emerald Alchemical Transmutation Circle", ["floor", "sigil", "alchemy", "emerald", "arcane", "harmony"], dict(kind="floor_medallion", sub="sigil", w=256, h=256, glow=(68, 224, 148))),
    ("floor_drain_storm_square", "Berlin Cast-Iron Square Street Storm Drain", ["floor", "drain", "grate", "street", "berlin", "iron", "harmony"], dict(kind="floor_medallion", sub="grate_sq", w=160, h=160, base=(92, 96, 102), trim=(64, 70, 78))),
    ("floor_drain_brass_bathhouse", "Polished Brass Bathhouse Floor Drain Grate", ["floor", "drain", "grate", "brass", "bathhouse", "harmony"], dict(kind="floor_medallion", sub="grate_sq", w=160, h=160, base=(186, 152, 68), trim=(148, 118, 52))),
    ("floor_grate_dungeon_pit_sq", "Heavy Iron Dungeon Pit Floor Bar Grate", ["floor", "grate", "dungeon", "iron", "pit", "harmony"], dict(kind="floor_medallion", sub="grate_sq", w=224, h=224, base=(74, 78, 86), trim=(58, 64, 72))),
    ("floor_grate_cistern_round", "Octagonal Bronze Cistern Floor Grate", ["floor", "grate", "cistern", "bronze", "sewer", "harmony"], dict(kind="floor_medallion", sub="cistern", w=192, h=192, base=(134, 96, 56), trim=(188, 148, 72))),
    ("floor_manhole_berlin_iron", "Berlin Cast-Iron Street Sewer Manhole Cover", ["floor", "manhole", "street", "berlin", "iron", "harmony"], dict(kind="floor_medallion", sub="cistern", w=160, h=160, base=(76, 82, 90), trim=(112, 118, 126))),
    ("floor_manhole_aether_valve", "Magipunk Brass Sub-Street Steam Valve Hatch", ["floor", "manhole", "brass", "steam", "magipunk", "harmony"], dict(kind="floor_medallion", sub="cistern", w=160, h=160, base=(156, 124, 58), trim=(216, 178, 74))),
    ("floor_sidewalk_glass_prism", "Berlin Recessed Sidewalk Prism-Glass Skylight", ["floor", "sidewalk", "glass", "skylight", "berlin", "harmony"], dict(kind="floor_medallion", sub="glass_sidewalk", w=224, h=144, base=(144, 194, 214), glow=(255, 226, 152))),
    ("floor_sidewalk_glass_dark", "Dusk Sidewalk Iron & Glass Cellar Light-Well", ["floor", "sidewalk", "glass", "cellar", "berlin", "harmony"], dict(kind="floor_medallion", sub="glass_sidewalk", w=224, h=144, base=(86, 118, 138))),
    ("floor_conduit_hub_cyan", "Recessed Cyan Aether Conduit Cross-Junction", ["floor", "conduit", "aether", "cyan", "magipunk", "harmony"], dict(kind="floor_medallion", sub="conduit_hub", w=192, h=192, trim=(208, 170, 72), glow=(72, 220, 244))),
    ("floor_conduit_hub_violet", "Recessed Violet Sovereign Conduit Cross-Junction", ["floor", "conduit", "aether", "violet", "sovereign", "harmony"], dict(kind="floor_medallion", sub="conduit_hub", w=192, h=192, trim=(216, 178, 74), glow=(178, 96, 248))),
    ("floor_conduit_hub_amber", "Recessed Amber Steam-Power Floor Junction", ["floor", "conduit", "steam", "amber", "magipunk", "harmony"], dict(kind="floor_medallion", sub="conduit_hub", w=192, h=192, trim=(198, 156, 68), glow=(255, 182, 58))),
    ("floor_doormat_crimson_gold", "Crimson & Gold Threshold Welcome Doormat", ["floor", "doormat", "threshold", "crimson", "interior", "harmony"], dict(kind="floor_medallion", sub="doormat", w=192, h=128, base=(146, 36, 44), trim=(218, 180, 76))),
    ("floor_doormat_emerald_woven", "Emerald Woven Parlor Entry Doormat", ["floor", "doormat", "threshold", "emerald", "interior", "harmony"], dict(kind="floor_medallion", sub="doormat", w=192, h=128, base=(48, 102, 74), trim=(214, 182, 92))),
    ("floor_doormat_coir_rustic", "Natural Woven Coir Tenement Doormat", ["floor", "doormat", "threshold", "coir", "tenement", "harmony"], dict(kind="floor_medallion", sub="doormat", w=192, h=128, base=(168, 134, 86), trim=(112, 82, 48))),
    ("floor_doormat_colorable", "Colorable Embroidered Threshold Doormat", ["floor", "doormat", "colorable", "threshold", "modular", "harmony"], dict(kind="floor_medallion", sub="doormat", w=192, h=128, colorable=True, trim=(226, 192, 94))),
    ("floor_fire_escape_landing", "Riveted Iron Exterior Fire-Escape Landing", ["floor", "fire_escape", "iron", "balcony", "industrial", "harmony"], dict(kind="balcony", w=224, h=224, base=(72, 80, 90), rail=(54, 60, 68), trim=(154, 160, 168))),

    # --- E. 24 FIREPLACES, BERLIN KACHELOFEN STOVES, RADIATORS & BUILT-INS ---
    ("int_fireplace_marble_lit", "Carved Ivory Marble Manor Fireplace (Lit)", ["fireplace", "hearth", "marble", "manor", "lit", "interior", "harmony"], dict(kind="interior_fixture", sub="fireplace", w=256, h=160, base=(220, 214, 200), lit=True)),
    ("int_fireplace_marble_cold", "Carved Ivory Marble Manor Fireplace (Unlit)", ["fireplace", "hearth", "marble", "manor", "interior", "harmony"], dict(kind="interior_fixture", sub="fireplace", w=256, h=160, base=(220, 214, 200), lit=False)),
    ("int_fireplace_gothic_lit", "Gothic Dark-Stone Cathedral Hearth (Lit)", ["fireplace", "hearth", "gothic", "stone", "lit", "interior", "harmony"], dict(kind="interior_fixture", sub="fireplace", w=272, h=160, base=(104, 102, 110), lit=True)),
    ("int_fireplace_gothic_cold", "Gothic Dark-Stone Cathedral Hearth (Unlit)", ["fireplace", "hearth", "gothic", "stone", "interior", "harmony"], dict(kind="interior_fixture", sub="fireplace", w=272, h=160, base=(104, 102, 110), lit=False)),
    ("int_fireplace_brick_kettle", "Cozy Red-Brick Cottage Hearth with Copper Kettle", ["fireplace", "hearth", "brick", "cottage", "kettle", "interior", "harmony"], dict(kind="interior_fixture", sub="fireplace", w=256, h=160, base=(158, 82, 58), lit=True, kettle=True)),
    ("int_fireplace_sandstone_lit", "Warm Sandstone Tavern Hearth (Lit)", ["fireplace", "hearth", "sandstone", "tavern", "lit", "interior", "harmony"], dict(kind="interior_fixture", sub="fireplace", w=256, h=160, base=(196, 168, 124), lit=True)),
    ("int_kachelofen_ivory_gold", "Berlin Ivory & Gold Ceramic Kachelofen Stove", ["stove", "kachelofen", "berlin", "ceramic", "ivory", "interior", "harmony"], dict(kind="interior_fixture", sub="kachelofen", w=176, h=176, base=(232, 226, 210), trim=(216, 178, 74))),
    ("int_kachelofen_emerald", "Berlin Emerald-Glazed Ceramic Kachelofen Stove", ["stove", "kachelofen", "berlin", "ceramic", "emerald", "interior", "harmony"], dict(kind="interior_fixture", sub="kachelofen", w=176, h=176, base=(56, 128, 92), trim=(212, 174, 72))),
    ("int_kachelofen_cobalt", "Berlin Cobalt-Blue Ceramic Kachelofen Stove", ["stove", "kachelofen", "berlin", "ceramic", "cobalt", "interior", "harmony"], dict(kind="interior_fixture", sub="kachelofen", w=176, h=176, base=(62, 108, 162), trim=(214, 176, 74))),
    ("int_kachelofen_burgundy", "Berlin Burgundy-Glazed Ceramic Kachelofen Stove", ["stove", "kachelofen", "berlin", "ceramic", "burgundy", "interior", "harmony"], dict(kind="interior_fixture", sub="kachelofen", w=176, h=176, base=(146, 44, 52), trim=(216, 178, 74))),
    ("int_kachelofen_ochre", "Berlin Ochre-Tile Tenement Kachelofen Stove", ["stove", "kachelofen", "berlin", "ochre", "tenement", "interior", "harmony"], dict(kind="interior_fixture", sub="kachelofen", w=176, h=176, base=(198, 154, 72), trim=(178, 142, 64))),
    ("int_radiator_iron_short", "Cast-Iron Ribbed Steam Radiator (Compact)", ["radiator", "steam", "iron", "berlin", "tenement", "interior", "harmony"], dict(kind="interior_fixture", sub="radiator", w=192, h=96, base=(86, 92, 100), trim=(212, 174, 72), ribs=7)),
    ("int_radiator_iron_long", "Cast-Iron Ribbed Steam Radiator (Long)", ["radiator", "steam", "iron", "berlin", "manor", "interior", "harmony"], dict(kind="interior_fixture", sub="radiator", w=288, h=96, base=(92, 98, 106), trim=(212, 174, 72), ribs=12)),
    ("int_radiator_brass_gilded", "Gilded Brass Palace Steam Radiator", ["radiator", "steam", "brass", "palace", "magipunk", "interior", "harmony"], dict(kind="interior_fixture", sub="radiator", w=256, h=96, base=(196, 160, 72), trim=(232, 204, 114), ribs=10)),
    ("int_screen_stained_cathedral", "Folding Stained-Glass Cathedral Room Divider", ["screen", "divider", "stained_glass", "cathedral", "interior", "harmony"], dict(kind="interior_fixture", sub="screen", w=288, h=112, base=(142, 74, 198), trim=(198, 162, 72), glow=(92, 212, 240))),
    ("int_screen_jugendstil_amber", "Folding Art-Nouveau Amber Glass Parlor Screen", ["screen", "divider", "jugendstil", "glass", "berlin", "interior", "harmony"], dict(kind="interior_fixture", sub="screen", w=288, h=112, base=(224, 178, 72), trim=(112, 74, 42), glow=(255, 224, 146))),
    ("int_screen_shoji_ivory", "Folding Ivory Rice-Paper Shoji Room Divider", ["screen", "divider", "shoji", "paper", "interior", "harmony"], dict(kind="interior_fixture", sub="screen", w=288, h=112, base=(236, 228, 206), trim=(98, 66, 40))),
    ("int_screen_colorable", "Colorable Folding Velvet & Brass Room Screen", ["screen", "divider", "colorable", "modular", "interior", "harmony"], dict(kind="interior_fixture", sub="screen", w=288, h=112, colorable=True, trim=(212, 174, 72))),
    ("int_shrine_vigil_candles", "Carved Stone Wall-Niche Vigil Candle Shrine", ["shrine", "candles", "vigil", "cathedral", "temple", "interior", "harmony"], dict(kind="interior_fixture", sub="shrine", w=224, h=128, base=(134, 130, 128), glow=(255, 196, 82))),
    ("int_shrine_mossy_crypt", "Mossy Crypt Alcove Memorial Candle Shrine", ["shrine", "candles", "crypt", "moss", "dungeon", "interior", "harmony"], dict(kind="interior_fixture", sub="shrine", w=224, h=128, base=(108, 114, 106), moss=0.55, glow=(255, 174, 68))),
    ("int_shrine_aether_reliquary", "Sovereign Cyan Aether Wall-Niche Reliquary", ["shrine", "aether", "sovereign", "cathedral", "magipunk", "interior", "harmony"], dict(kind="interior_fixture", sub="shrine", w=224, h=128, base=(68, 64, 78), glow=(76, 220, 244))),
    ("int_boiler_gauge_panel", "Wall-Mounted Brass Boiler Pressure Gauge Panel", ["boiler", "gauge", "brass", "magipunk", "steampunk", "interior", "harmony"], dict(kind="interior_fixture", sub="gauges", w=224, h=112, base=(74, 82, 92), trim=(208, 170, 72))),
    ("int_kitchen_copper_hood", "Hammered Copper Bakery & Tavern Range Hood", ["kitchen", "copper", "hood", "bakery", "tavern", "interior", "harmony"], dict(kind="interior_fixture", sub="range_hood", w=256, h=128, base=(166, 98, 58), trim=(218, 178, 82))),
    ("int_washroom_marble_vanity", "Marble & Brass Built-In Washroom Vanity Niche", ["vanity", "marble", "washroom", "bathroom", "interior", "harmony"], dict(kind="interior_fixture", sub="vanity", w=224, h=112, base=(226, 222, 212), trim=(198, 162, 74))),

    # --- F. 24 STREET, COURTYARD & EXTERIOR ARCHITECTURAL ACCENTS ---
    ("str_bench_berlin_park", "Berlin Wrought-Iron & Oak-Slat Park Bench", ["bench", "park", "street", "berlin", "wood", "harmony"], dict(kind="street_accent", sub="bench", w=256, h=112, base=(146, 98, 56), trim=(56, 62, 68))),
    ("str_bench_green_park", "Painted Forest-Green Park Slat Bench", ["bench", "park", "green", "garden", "street", "harmony"], dict(kind="street_accent", sub="bench", w=256, h=112, base=(58, 108, 72), trim=(54, 60, 66))),
    ("str_bench_stone_courtyard", "Carved Granite Courtyard Garden Bench", ["bench", "stone", "courtyard", "garden", "park", "harmony"], dict(kind="street_accent", sub="stone_bench", w=240, h=112, base=(158, 154, 148), moss=0.14)),
    ("str_bench_marble_palace", "Carved Ivory Marble Palace Garden Bench", ["bench", "marble", "palace", "garden", "harmony"], dict(kind="street_accent", sub="stone_bench", w=240, h=112, base=(226, 220, 206))),
    ("str_planter_brick_roses", "Red-Brick Courtyard Rose Flower Planter", ["planter", "flowers", "roses", "brick", "courtyard", "harmony"], dict(kind="street_accent", sub="planter", w=256, h=128, base=(158, 78, 54), blossom=(228, 62, 82))),
    ("str_planter_stone_lavender", "Granite Sidewalk Lavender Flower Planter", ["planter", "flowers", "lavender", "stone", "berlin", "harmony"], dict(kind="street_accent", sub="planter", w=256, h=128, base=(148, 146, 140), blossom=(168, 114, 228))),
    ("str_planter_stone_marigold", "Limestone Terrace Marigold Flower Planter", ["planter", "flowers", "marigold", "limestone", "park", "harmony"], dict(kind="street_accent", sub="planter", w=256, h=128, base=(204, 194, 174), blossom=(242, 194, 52))),
    ("str_planter_brick_bare", "Bare Soil Red-Brick Sidewalk Planter Box", ["planter", "bare", "brick", "modular", "street", "harmony"], dict(kind="street_accent", sub="planter", w=256, h=128, base=(158, 78, 54), foliage=False)),
    ("str_planter_stone_bare", "Bare Soil Dressed-Stone Courtyard Planter", ["planter", "bare", "stone", "modular", "courtyard", "harmony"], dict(kind="street_accent", sub="planter", w=256, h=128, base=(152, 148, 142), foliage=False)),
    ("str_tree_grate_berlin_sq", "Berlin Cast-Iron Square Sidewalk Tree Grate", ["grate", "tree", "sidewalk", "berlin", "iron", "street", "harmony"], dict(kind="street_accent", sub="tree_grate", w=224, h=224, base=(68, 74, 82))),
    ("str_tree_grate_brass_sq", "Ornate Brass-Trimmed Promenade Tree Grate", ["grate", "tree", "brass", "promenade", "street", "harmony"], dict(kind="street_accent", sub="tree_grate", w=224, h=224, base=(128, 108, 62))),
    ("str_letterbox_prussian_blue", "Prussian-Blue Berlin Cast-Iron Street Letterbox", ["letterbox", "post", "berlin", "blue", "street", "harmony"], dict(kind="street_accent", sub="letterbox", w=144, h=144, base=(48, 86, 138), trim=(222, 184, 74))),
    ("str_letterbox_royal_crimson", "Royal Crimson Street-Corner Postbox", ["letterbox", "post", "crimson", "street", "harmony"], dict(kind="street_accent", sub="letterbox", w=144, h=144, base=(162, 38, 44), trim=(222, 184, 74))),
    ("str_letterbox_brass_magipunk", "Brass Pneumatic-Mail Magipunk Street Kiosk", ["letterbox", "post", "brass", "magipunk", "street", "harmony"], dict(kind="street_accent", sub="letterbox", w=144, h=144, base=(186, 148, 64), trim=(74, 214, 238))),
    ("str_bollard_iron_brass", "Berlin Cast-Iron & Brass-Cap Street Bollard", ["bollard", "post", "iron", "berlin", "street", "harmony"], dict(kind="street_accent", sub="bollard", w=112, h=112, base=(58, 64, 72), trim=(216, 178, 74))),
    ("str_bollard_granite_stone", "Carved Granite Civic Promenade Bollard", ["bollard", "post", "granite", "stone", "street", "harmony"], dict(kind="street_accent", sub="bollard", w=112, h=112, base=(146, 144, 140), trim=(178, 176, 170))),
    ("str_bollard_harbor_mooring", "Heavy Rusted-Iron Harbor Mooring Bollard", ["bollard", "harbor", "docks", "iron", "harmony"], dict(kind="street_accent", sub="bollard", w=128, h=128, base=(86, 74, 68), trim=(126, 104, 86))),
    ("str_bike_rack_iron", "Wrought-Iron Sidewalk Bicycle Parking Rack", ["bicycle", "rack", "iron", "street", "berlin", "harmony"], dict(kind="street_accent", sub="bike_rack", w=256, h=128, base=(62, 68, 76), trim=(94, 102, 110))),
    ("str_drinking_fountain_iron", "Cast-Iron Berlin Park Drinking Fountain", ["fountain", "park", "iron", "street", "berlin", "harmony"], dict(kind="street_accent", sub="fountain_small", w=160, h=160, base=(66, 76, 82), trim=(208, 170, 74))),
    ("str_drinking_fountain_stone", "Carved Sandstone Courtyard Drinking Basin", ["fountain", "stone", "courtyard", "garden", "harmony"], dict(kind="street_accent", sub="fountain_small", w=160, h=160, base=(186, 172, 146), trim=(154, 142, 118))),
    ("str_cafe_glass_windbreak", "Brass & Glass Sidewalk Café Windbreak Partition", ["cafe", "glass", "windbreak", "street", "berlin", "harmony"], dict(kind="street_accent", sub="canopy", w=256, h=96, base=(186, 150, 68), glass=(158, 212, 232))),
    ("str_tram_shelter_canopy", "Berlin Jugendstil Glass Tram-Stop Shelter Roof", ["tram", "shelter", "canopy", "glass", "berlin", "street", "harmony"], dict(kind="street_accent", sub="canopy", w=352, h=176, base=(74, 128, 116), glass=(154, 210, 228), glow=(255, 222, 142))),
    ("str_cellar_window_well", "Cobblestoned Iron-Grated Sidewalk Window Well", ["cellar", "window", "grate", "street", "berlin", "harmony"], dict(kind="floor_medallion", sub="grate_sq", w=224, h=112, base=(128, 126, 122), trim=(64, 70, 78))),
    ("str_noticeboard_civic", "Oak & Brass Civic Street Noticeboard Canopy", ["noticeboard", "street", "wood", "berlin", "courtyard", "harmony"], dict(kind="street_accent", sub="bench", w=224, h=96, base=(134, 88, 52), trim=(206, 168, 72))),

    # --- G. 20 MODULAR RUINS, DAMAGE & ARCHITECTURAL WEATHERING OVERLAYS ---
    ("ruin_rubble_ashlar_stone", "Fallen Ashlar Masonry Wall Rubble Heap", ["ruin", "rubble", "stone", "debris", "damage", "harmony"], dict(kind="ruin_overlay", sub="rubble", w=224, h=192, base=(134, 132, 128), moss=0.14)),
    ("ruin_rubble_red_brick", "Collapsed Red-Brick Wall Debris Heap", ["ruin", "rubble", "brick", "debris", "damage", "harmony"], dict(kind="ruin_overlay", sub="rubble", w=224, h=192, base=(158, 78, 56), moss=0.06)),
    ("ruin_rubble_sandstone", "Fallen Desert Sandstone Ruin Rubble Heap", ["ruin", "rubble", "sandstone", "desert", "debris", "harmony"], dict(kind="ruin_overlay", sub="rubble", w=224, h=192, base=(198, 170, 122))),
    ("ruin_rubble_marble_temple", "Shattered Marble Sanctuary Column Debris", ["ruin", "rubble", "marble", "temple", "debris", "harmony"], dict(kind="ruin_overlay", sub="rubble", w=224, h=192, base=(224, 218, 206))),
    ("ruin_rubble_mossy_crypt", "Moss-Covered Ancient Crypt Stone Rubble", ["ruin", "rubble", "moss", "crypt", "dungeon", "harmony"], dict(kind="ruin_overlay", sub="rubble", w=224, h=192, base=(116, 120, 112), moss=0.65)),
    ("ruin_crater_cobble_blast", "Aether-Blast Shattered Cobblestone Crater", ["ruin", "crater", "blast", "damage", "street", "harmony"], dict(kind="ruin_overlay", sub="crater", w=256, h=256, base=(118, 122, 128))),
    ("ruin_crater_stone_floor", "Shattered Dungeon Flagstone Impact Crater", ["ruin", "crater", "stone", "dungeon", "damage", "harmony"], dict(kind="ruin_overlay", sub="crater", w=256, h=256, base=(136, 134, 130))),
    ("ruin_crater_earth_shell", "Muddy Artillery Shell-Impact Earth Crater", ["ruin", "crater", "dirt", "mud", "damage", "harmony"], dict(kind="ruin_overlay", sub="crater", w=256, h=256, base=(118, 92, 66))),
    ("ruin_ivy_wall_drape_green", "Overgrown Green Wall-Ivy Foliage Drape", ["ruin", "ivy", "foliage", "wall", "overgrown", "harmony"], dict(kind="ruin_overlay", sub="ivy_drape", w=288, h=112, base=(66, 118, 54))),
    ("ruin_ivy_wall_drape_roses", "Climbing Rose-Vine Architectural Wall Drape", ["ruin", "ivy", "roses", "wall", "garden", "harmony"], dict(kind="ruin_overlay", sub="ivy_drape", w=288, h=112, base=(62, 116, 52), blossom=(224, 58, 76))),
    ("ruin_ivy_wall_drape_autumn", "Autumn Crimson & Amber Wall-Ivy Drape", ["ruin", "ivy", "autumn", "wall", "foliage", "harmony"], dict(kind="ruin_overlay", sub="ivy_drape", w=288, h=112, base=(178, 96, 42), blossom=(232, 178, 54))),
    ("ruin_moss_curtain_damp", "Damp Hanging Subterranean Wall Moss Patch", ["ruin", "moss", "crypt", "sewer", "wall", "harmony"], dict(kind="ruin_overlay", sub="ivy_drape", w=256, h=112, base=(76, 108, 56))),
    ("ruin_beams_collapsed_roof", "Shattered Timber Roof-Beam Collapse Heap", ["ruin", "beams", "wood", "collapse", "debris", "harmony"], dict(kind="ruin_overlay", sub="beams", w=256, h=192, base=(124, 86, 52))),
    ("ruin_beams_charred_timber", "Charred Fire-Damaged Timber Beam Debris", ["ruin", "beams", "charred", "fire", "debris", "harmony"], dict(kind="ruin_overlay", sub="beams", w=256, h=192, base=(64, 52, 46))),
    ("ruin_puddle_rain_cobble", "Reflective Rainwater Street Puddle", ["weather", "puddle", "water", "rain", "street", "harmony"], dict(kind="ruin_overlay", sub="puddle", w=224, h=160, base=(78, 128, 158))),
    ("ruin_puddle_oil_industrial", "Dark Iridescent Foundry Oil-Leak Puddle", ["weather", "puddle", "oil", "industrial", "alley", "harmony"], dict(kind="ruin_overlay", sub="puddle", w=224, h=160, base=(44, 48, 58))),
    ("ruin_puddle_aether_spill", "Glowing Cyan Spilled Aether-Coolant Puddle", ["weather", "puddle", "aether", "magipunk", "spill", "harmony"], dict(kind="ruin_overlay", sub="puddle", w=224, h=160, base=(68, 198, 224))),
    ("ruin_snow_bank_wall", "Wind-Piled Winter Wall Snowdrift Bank", ["weather", "snow", "winter", "drift", "wall", "harmony"], dict(kind="ruin_overlay", sub="snow_bank", w=288, h=128)),
    ("ruin_vigil_wax_threshold", "Ancient Melted Vigil Candle-Wax Threshold Mound", ["vigil", "candles", "wax", "cathedral", "threshold", "harmony"], dict(kind="ruin_overlay", sub="wax_mound", w=224, h=160)),
    ("ruin_stained_glass_shards", "Shattered Jeweled Stained-Glass Floor Shards", ["ruin", "glass", "shards", "stained_glass", "cathedral", "harmony"], dict(kind="ruin_overlay", sub="shards", w=224, h=192)),
]


def main() -> None:
    PROPS_DIR.mkdir(parents=True, exist_ok=True)
    manifest_entries: list[dict] = []
    qa_entries: list[tuple[str, Image.Image]] = []

    print(f"=== GENERATING {len(NEW_ARCH_PROPS)} BRAND-NEW ARCHITECTURAL BUILDER PROPS ===")
    for idx, (slug, disp, tags, spec) in enumerate(NEW_ARCH_PROPS):
        s = dict(spec)
        s.setdefault("seed", 9000 + idx * 17)
        im = render_arch_prop(s)
        im.save(PROPS_DIR / f"{slug}.png", "PNG", optimize=True)
        is_col = bool(s.get("colorable", False)) or "colorable" in slug
        casts_sh = not slug.startswith(("floor_", "ruin_puddle_", "ruin_stained_glass"))
        manifest_entries.append({
            "path": f"props/harmony_arch/{slug}.png",
            "displayName": disp,
            "category": "object",
            "tags": tags,
            "widthPx": im.width,
            "heightPx": im.height,
            "defaultPpi": 256,
            "drawMode": "colorable" if is_col else "normal",
            "castsShadow": casts_sh,
            "dominantHex": dominant_hex(im),
        })
        qa_entries.append((slug, im))

    # Save 3 crisp dark-checkerboard QA sheets (60 per sheet)
    save_qa_sheet(qa_entries[0:60], SCRATCH_DIR / "qa_new_arch_props_part1.png", cols=10, cw=155, ch=135)
    save_qa_sheet(qa_entries[60:120], SCRATCH_DIR / "qa_new_arch_props_part2.png", cols=10, cw=155, ch=135)
    save_qa_sheet(qa_entries[120:], SCRATCH_DIR / "qa_new_arch_props_part3.png", cols=10, cw=155, ch=135)

    total = upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    print(f"DONE Step 5B: Created {len(NEW_ARCH_PROPS)} new architectural props! modular-suite manifest -> {total} assets!")


if __name__ == "__main__":
    main()

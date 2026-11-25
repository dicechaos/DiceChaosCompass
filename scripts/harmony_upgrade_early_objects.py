"""
Step 3B — Painterly In-Place Harmonization of Earliest Flat Objects, Modular Arch Pieces,
Core Colorables, and Earliest Flat-Grid Terrains:
  1) Bespoke 2x-supersampled painterly redraws for the 36 most-visible early flat-vector
     objects & modular architectural pieces (streetlamps, stalls, pillars, trees, boulders,
     hearths, crates, barrels, capacitors, boilers, traps, trapdoors, manholes, etc.)
  2) Painterly directional bevel-relighting, crevice AO, charcoal ink reinforcement &
     gouache brushwork harmonization pass across all remaining early flat starter/core/modular
     pieces and earliest flat-grid terrain tiles (preserving 100% of silhouettes & dd_red masks!).
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from harmony_art_engine import (
    CORE_DIR,
    INK,
    INK_IRON,
    INK_MID,
    INK_WARM,
    MOD_DIR,
    SCRATCH_DIR,
    STARTER_DIR,
    add_contact_shadow,
    add_glow,
    apply_painterly_finish,
    blend_rgb,
    draw_beveled_rect,
    draw_foliage_cluster,
    draw_glass_pane,
    draw_stone_block,
    draw_wood_planks_box,
    fbm_periodic,
    new_hi,
    save_qa_sheet,
    shade_rgb,
    vary_rgb,
)


# =============================================================================
# STAGE 1: BESPOKE 2X PAINTERLY REDRAWS FOR KEY EARLY FLAT-VECTOR ASSETS
# =============================================================================
def redraw_streetlamp(w: int, h: int, glow_rgb: tuple[int, int, int], style: str, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    R = min(W, H) * 0.34
    # Soft warm/cyan outer lantern halo
    add_glow(im, cx, cy, R * 1.32, R * 1.32, glow_rgb, alpha=135, blur=24)
    d = ImageDraw.Draw(im)
    # Cast-iron / brass octagonal lamp hood + iron brackets
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(48, 54, 62, 255), outline=INK, width=6)
    if style == "promenade":
        # Triple-globe gilded Berlin boulevard promenade lamp!
        d.ellipse([cx - R * 0.88, cy - R * 0.88, cx + R * 0.88, cy + R * 0.88], fill=(168, 134, 58, 255), outline=INK, width=4)
        for k in range(3):
            a = -math.pi / 2 + k * math.tau / 3
            gx, gy = cx + math.cos(a) * R * 0.42, cy + math.sin(a) * R * 0.42
            gr = R * 0.34
            d.ellipse([gx - gr, gy - gr, gx + gr, gy + gr], fill=(*glow_rgb, 255), outline=INK, width=4)
            d.ellipse([gx - gr * 0.55, gy - gr * 0.65, gx + gr * 0.25, gy + gr * 0.15], fill=(255, 252, 234, 255))
        d.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=(214, 178, 82, 255), outline=INK, width=3)
    else:
        # Single beveled iron/brass magipunk lantern crown with glowing crystal core + iron spokes!
        rim_c = (192, 156, 68) if style == "station" else (72, 86, 94)
        d.ellipse([cx - R * 0.82, cy - R * 0.82, cx + R * 0.82, cy + R * 0.82], fill=(*rim_c, 255), outline=INK, width=4)
        d.ellipse([cx - R * 0.62, cy - R * 0.62, cx + R * 0.62, cy + R * 0.62], fill=(*glow_rgb, 255), outline=INK, width=4)
        d.ellipse([cx - R * 0.36, cy - R * 0.42, cx + R * 0.16, cy + R * 0.10], fill=blend_rgb(glow_rgb, (255, 255, 255), 0.72))
        for k in range(4):
            a = math.pi / 4 + k * math.pi / 2
            d.line([(cx + math.cos(a) * R * 0.22, cy + math.sin(a) * R * 0.22), (cx + math.cos(a) * R * 0.96, cy + math.sin(a) * R * 0.96)], fill=INK, width=5)
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(*rim_c, 255), outline=INK, width=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=4.4)


def redraw_pillar(w: int, h: int, shape: str, base_rgb: tuple[int, int, int], broken: bool, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    pad = int(min(W, H) * 0.12)
    add_contact_shadow(
        im,
        lambda sd, col, off: (
            sd.ellipse([pad + off[0], pad + off[1], W - pad + off[0], H - pad + off[1]], fill=col)
            if shape == "round"
            else sd.rounded_rectangle([pad + off[0], pad + off[1], W - pad + off[0], H - pad + off[1]], radius=12, fill=col)
        ),
        offset=(8, 10),
        blur=9.0,
        alpha=95,
    )
    d = ImageDraw.Draw(im)
    if shape == "round":
        R = W * 0.5 - pad
        # Square stone plinth underneath if classic pillar
        draw_stone_block(d, pad, pad, W - pad, H - pad, shade_rgb(base_rgb, 0.86)[:3], rng, ink_w=6, cracks=0.5, radius=10)
        d.ellipse([cx - R * 0.92, cy - R * 0.92, cx + R * 0.92, cy + R * 0.92], fill=(*base_rgb, 255), outline=INK, width=6)
        # Fluted rim notches
        for k in range(16):
            a = k * math.tau / 16
            x0, y0 = cx + math.cos(a) * R * 0.78, cy + math.sin(a) * R * 0.78
            x1, y1 = cx + math.cos(a) * R * 0.90, cy + math.sin(a) * R * 0.90
            d.line([(x0, y0), (x1, y1)], fill=INK_MID, width=3)
        d.ellipse([cx - R * 0.72, cy - R * 0.72, cx + R * 0.72, cy + R * 0.72], fill=blend_rgb(base_rgb, (242, 238, 228), 0.18), outline=INK_MID, width=4)
        if broken:
            # Cracked rough interior stone fracture & moss!
            for _ in range(5):
                a1, a2 = rng.uniform(0, math.tau), rng.uniform(0, math.tau)
                d.line([(cx, cy), (cx + math.cos(a1) * R * 0.68, cy + math.sin(a1) * R * 0.68)], fill=INK, width=4)
            draw_foliage_cluster(d, cx - R * 0.25, cy - R * 0.2, R * 0.34, R * 0.28, (74, 114, 54), rng, n_leaves=7)
    else:
        draw_stone_block(d, pad, pad, W - pad, H - pad, base_rgb, rng, ink_w=6, moss=0.18 if broken else 0.05, cracks=0.7, radius=8)
        draw_stone_block(d, pad + 26, pad + 26, W - pad - 26, H - pad - 26, blend_rgb(base_rgb, (238, 234, 224), 0.14)[:3], rng, ink_w=4, cracks=0.4, radius=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.8)


def redraw_hearth(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    pad_x, pad_y = 26, 20
    add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y + off[1]], radius=12, fill=col), offset=(8, 10), blur=9, alpha=95)
    d = ImageDraw.Draw(im)
    # Carved stone hearth apron & side cheeks
    draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, (132, 128, 124), rng, ink_w=6, cracks=0.5, radius=8)
    # Recessed dark soot firebox with glowing embers & charred oak logs!
    fx0, fy0, fx1, fy1 = pad_x + 54, pad_y + 38, W - pad_x - 54, H - pad_y - 36
    d.rounded_rectangle([fx0, fy0, fx1, fy1], radius=8, fill=(28, 22, 22, 255), outline=INK, width=5)
    add_glow(im, (fx0 + fx1) * 0.5, (fy0 + fy1) * 0.5, (fx1 - fx0) * 0.44, (fy1 - fy0) * 0.44, (255, 112, 32), alpha=150, blur=16)
    d = ImageDraw.Draw(im)
    # Glowing coals + crossed firewood logs
    mx, my = (fx0 + fx1) * 0.5, (fy0 + fy1) * 0.5
    for _ in range(18):
        ex, ey = rng.uniform(fx0 + 28, fx1 - 28), rng.uniform(fy0 + 20, fy1 - 20)
        er = rng.uniform(5, 11)
        d.ellipse([ex - er, ey - er * 0.7, ex + er, ey + er * 0.7], fill=rng.choice([(255, 146, 36, 255), (232, 68, 22, 255), (255, 214, 78, 255)]))
    draw_beveled_rect(d, mx - 74, my - 16, mx + 74, my + 8, (76, 48, 32), ink_w=4, radius=8)
    draw_beveled_rect(d, mx - 58, my - 4, mx + 64, my + 20, (64, 40, 26), ink_w=4, radius=8)
    # Upper stone mantle shelf!
    draw_stone_block(d, pad_x - 6, pad_y - 6, W - pad_x + 6, pad_y + 42, (154, 148, 140), rng, ink_w=5, cracks=0.35, radius=6)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.6)


def redraw_capacitor_bank(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    W, H = w * 2, h * 2
    pad_x, pad_y = 28, 24
    add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y + off[1]], radius=12, fill=col), offset=(8, 10), blur=10, alpha=95)
    d = ImageDraw.Draw(im)
    # Riveted steel & brass magipunk chassis
    draw_beveled_rect(d, pad_x, pad_y, W - pad_x, H - pad_y, (64, 74, 86), ink_w=6, radius=10)
    draw_beveled_rect(d, pad_x + 18, pad_y + 18, W - pad_x - 18, H - pad_y - 18, (46, 54, 64), ink_w=4, radius=6)
    # 3 glowing violet-cyan crystal aether condenser coils in brass cages!
    cols = [(164, 96, 246), (82, 206, 242), (164, 96, 246)]
    for i, col in enumerate(cols):
        cx = pad_x + 124 + i * ((W - 2 * pad_x - 248) / 2)
        cy = H * 0.5
        add_glow(im, cx, cy, 84, 108, col, alpha=135, blur=18)
        d = ImageDraw.Draw(im)
        draw_beveled_rect(d, cx - 64, cy - 92, cx + 64, cy + 92, (174, 140, 62), ink_w=5, radius=24)
        d.ellipse([cx - 50, cy - 76, cx + 50, cy + 76], fill=(*col, 255), outline=INK, width=5)
        d.ellipse([cx - 28, cy - 52, cx + 14, cy + 16], fill=blend_rgb(col, (255, 255, 255), 0.68))
        # Copper bus-bar rings
        for by in (cy - 34, cy + 34):
            draw_beveled_rect(d, cx - 58, by - 7, cx + 58, by + 7, (198, 152, 68), ink_w=3, radius=3)
    # Brass corner bolts
    for bx in (pad_x + 16, W - pad_x - 16):
        for by in (pad_y + 16, H - pad_y - 16):
            d.ellipse([bx - 8, by - 8, bx + 8, by + 8], fill=(208, 170, 74, 255), outline=INK, width=3)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.2)


def redraw_vendor_stall(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    pad_x, pad_y = 24, 22
    add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y + off[1]], radius=12, fill=col), offset=(9, 11), blur=10, alpha=95)
    d = ImageDraw.Draw(im)
    # Lower timber market counter shelf peeking below awning
    draw_wood_planks_box(d, pad_x + 12, H - pad_y - 110, W - pad_x - 12, H - pad_y, (148, 102, 62), rng, horizontal=True, n_planks=3, ink_w=5)
    # Subtle apples & bread crates peeking at bottom counter edge
    for kx, kc in ((pad_x + 76, (186, 54, 46)), (pad_x + 168, (194, 148, 62)), (W - pad_x - 168, (88, 148, 64)), (W - pad_x - 76, (206, 134, 58))):
        draw_beveled_rect(d, kx - 34, H - pad_y - 62, kx + 34, H - pad_y - 14, (118, 82, 48), ink_w=3, radius=4)
        for _ in range(5):
            ax, ay = kx + rng.uniform(-20, 20), H - pad_y - 38 + rng.uniform(-12, 12)
            d.ellipse([ax - 9, ay - 9, ax + 9, ay + 9], fill=(*vary_rgb(kc, rng, 14), 255), outline=INK_MID, width=2)
    # Scalloped burgundy & cream canvas striped awning canopy!
    n_st = 9
    aw_y0, aw_y1 = pad_y, H - pad_y - 76
    sw = (W - 2 * pad_x) / n_st
    for i in range(n_st):
        sx0, sx1 = pad_x + i * sw, pad_x + (i + 1) * sw
        col = (164, 44, 48) if i % 2 == 0 else (234, 224, 202)
        draw_beveled_rect(d, sx0, aw_y0, sx1, aw_y1, col, ink_w=4, hi_amt=0.22, sh_amt=0.30)
        # Scalloped valance flap at bottom of each stripe
        d.pieslice([sx0 + 1, aw_y1 - 22, sx1 - 1, aw_y1 + 22], start=0, end=180, fill=shade_rgb(col, 0.88), outline=INK, width=4)
    # Timber ridge pole across awning peak!
    draw_beveled_rect(d, pad_x - 6, aw_y0 + 38, W - pad_x + 6, aw_y0 + 58, (108, 72, 42), ink_w=4, radius=4)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.4)


def redraw_scrap_crates(w: int, h: int, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([62 + off[0], 54 + off[1], W - 52 + off[0], H - 52 + off[1]], radius=24, fill=col), offset=(9, 11), blur=11, alpha=95)
    d = ImageDraw.Draw(im)
    # Large weathered timber crate (top-left)
    draw_wood_planks_box(d, 56, 52, 272, 264, (146, 102, 62), rng, horizontal=True, n_planks=5, ink_w=5)
    d.line([(64, 60), (264, 256)], fill=INK, width=16)
    d.line([(64, 60), (264, 256)], fill=(124, 84, 50, 255), width=8)
    d.rectangle([56, 52, 272, 264], outline=INK, width=6)
    # Secondary smaller dark crate (bottom-center)
    draw_wood_planks_box(d, 174, 248, 368, 438, (118, 82, 52), rng, horizontal=False, n_planks=4, ink_w=5)
    # Open rain-barrel / rusted scrap drum (top-right)
    cx, cy, R = 368, 174, 78
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(92, 74, 56, 255), outline=INK, width=6)
    d.ellipse([cx - R * 0.78, cy - R * 0.78, cx + R * 0.78, cy + R * 0.78], fill=(48, 92, 108, 255), outline=INK, width=4)
    d.arc([cx - R * 0.56, cy - R * 0.56, cx + R * 0.56, cy + R * 0.56], start=200, end=320, fill=(176, 224, 236, 255), width=5)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.8)


def redraw_foliage_prop(w: int, h: int, style: str, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    add_contact_shadow(im, lambda sd, col, off: sd.ellipse([cx - W * 0.36 + off[0], cy - H * 0.36 + off[1], cx + W * 0.36 + off[0], cy + H * 0.36 + off[1]], fill=col), offset=(10, 12), blur=12, alpha=92)
    d = ImageDraw.Draw(im)
    if style == "palm_urn":
        # Terracotta/bronze classical urn with layered painterly arching palm fronds!
        R = min(W, H) * 0.24
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(166, 94, 62, 255), outline=INK, width=6)
        d.ellipse([cx - R * 0.78, cy - R * 0.78, cx + R * 0.78, cy + R * 0.78], fill=(64, 48, 36, 255), outline=INK, width=4)
        for k in range(11):
            a = k * math.tau / 11 + rng.uniform(-0.1, 0.1)
            fl = min(W, H) * rng.uniform(0.34, 0.43)
            tip = (cx + math.cos(a) * fl, cy + math.sin(a) * fl)
            l_pt = (cx + math.cos(a - 0.26) * fl * 0.58, cy + math.sin(a - 0.26) * fl * 0.58)
            r_pt = (cx + math.cos(a + 0.26) * fl * 0.58, cy + math.sin(a + 0.26) * fl * 0.58)
            col = vary_rgb((66, 126, 62) if k % 2 == 0 else (84, 146, 72), rng, 12)
            d.polygon([(cx, cy), l_pt, tip, r_pt], fill=(*col, 255), outline=INK)
            d.line([(cx, cy), tip], fill=blend_rgb(col, (218, 238, 144), 0.48), width=4)
        d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill=(116, 162, 82, 255), outline=INK, width=3)
    elif style == "planter_box":
        pad_x, pad_y = 26, 28
        draw_stone_block(d, pad_x, pad_y, W - pad_x, H - pad_y, (134, 126, 118), rng, ink_w=6, cracks=0.35, radius=8)
        d.rounded_rectangle([pad_x + 22, pad_y + 22, W - pad_x - 22, H - pad_y - 22], radius=6, fill=(68, 52, 38, 255), outline=INK, width=4)
        blossoms = [(228, 78, 96), (236, 198, 68), (168, 108, 224), (242, 134, 72)]
        for i, bcol in enumerate(blossoms):
            fx = pad_x + 76 + i * ((W - 2 * pad_x - 152) / 3)
            draw_foliage_cluster(d, fx, cy, 52, 46, (66, 122, 54), rng, n_leaves=10, blossom_rgb=bcol)
    elif style == "pine":
        # Rich layered alpine evergreen pine needles (snow-dusted if seed % 2 == 1)
        snow = (seed % 2 == 1)
        for layer_idx, (rad_f, col) in enumerate([(0.44, (36, 72, 46)), (0.34, (48, 94, 58)), (0.24, (64, 118, 72)), (0.14, (86, 142, 88))]):
            n_b = 14 - layer_idx * 2
            for k in range(n_b):
                a = k * math.tau / n_b + layer_idx * 0.25 + rng.uniform(-0.1, 0.1)
                fl = min(W, H) * rad_f * rng.uniform(0.9, 1.08)
                tip = (cx + math.cos(a) * fl, cy + math.sin(a) * fl)
                p1 = (cx + math.cos(a - 0.28) * fl * 0.55, cy + math.sin(a - 0.28) * fl * 0.55)
                p2 = (cx + math.cos(a + 0.28) * fl * 0.55, cy + math.sin(a + 0.28) * fl * 0.55)
                d.polygon([(cx, cy), p1, tip, p2], fill=(*vary_rgb(col, rng, 10), 255), outline=INK)
                if snow and layer_idx >= 1 and rng.random() < 0.65:
                    st = (cx + math.cos(a) * fl * 0.82, cy + math.sin(a) * fl * 0.82)
                    d.ellipse([st[0] - 16, st[1] - 12, st[0] + 16, st[1] + 12], fill=(236, 244, 250, 255), outline=INK_MID, width=2)
    else:
        # Lush Berlin linden tree / woodland bush cluster!
        draw_foliage_cluster(d, cx, cy, W * 0.40, H * 0.40, (66, 118, 54), rng, n_leaves=28, blossom_rgb=(218, 228, 128) if style == "linden" else None)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.4)


def redraw_boulder(w: int, h: int, mossy: bool, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    rx, ry = W * 0.36, H * 0.33
    pts = []
    for k in range(9):
        a = k * math.tau / 9 + rng.uniform(-0.14, 0.14)
        rad = rng.uniform(0.82, 1.08)
        pts.append((cx + math.cos(a) * rx * rad, cy + math.sin(a) * ry * rad))
    add_contact_shadow(im, lambda sd, col, off: sd.polygon([(x + off[0], y + off[1]) for x, y in pts], fill=col), offset=(10, 12), blur=10, alpha=95)
    d = ImageDraw.Draw(im)
    base = (126, 128, 132)
    d.polygon(pts, fill=(*base, 255), outline=INK)
    # Sculpted sunlit top-left facets & shadowed bottom-right facets
    d.polygon([(cx - 10, cy - 12), pts[5], pts[6], pts[7], pts[8]], fill=blend_rgb(base, (238, 236, 228), 0.32))
    d.polygon([(cx + 8, cy + 8), pts[1], pts[2], pts[3], pts[4]], fill=blend_rgb(base, (22, 22, 28), 0.40))
    d.line(pts + [pts[0]], fill=INK, width=6)
    d.line([(cx - 18, cy - 10), (cx + 34, cy + 16)], fill=INK_MID, width=4)
    if mossy:
        draw_foliage_cluster(d, cx - rx * 0.32, cy - ry * 0.25, rx * 0.42, ry * 0.35, (72, 118, 52), rng, n_leaves=9)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.8)


def redraw_round_wood_prop(w: int, h: int, kind: str, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    cx, cy = W * 0.5, H * 0.5
    R = min(W, H) * 0.41
    add_contact_shadow(im, lambda sd, col, off: sd.ellipse([cx - R + off[0], cy - R + off[1], cx + R + off[0], cy + R + off[1]], fill=col), offset=(8, 10), blur=9, alpha=95)
    d = ImageDraw.Draw(im)
    if kind == "barrel":
        # Iron hoop rim + planked barrel head + bunghole plug!
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(64, 70, 78, 255), outline=INK, width=6)
        r_in = R * 0.87
        d.ellipse([cx - r_in, cy - r_in, cx + r_in, cy + r_in], fill=(146, 102, 60, 255), outline=INK, width=4)
        for px in range(int(cx - r_in + 26), int(cx + r_in - 16), 36):
            dx = px - cx
            dy = math.sqrt(max(0.0, r_in * r_in - dx * dx))
            d.line([(px, cy - dy + 2), (px, cy + dy - 2)], fill=INK_WARM, width=3)
        # Bung plug
        d.ellipse([cx + r_in * 0.32 - 12, cy - 12, cx + r_in * 0.32 + 12, cy + 12], fill=(104, 68, 38, 255), outline=INK, width=3)
    elif kind == "manhole":
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(82, 88, 96, 255), outline=INK, width=6)
        d.ellipse([cx - R * 0.84, cy - R * 0.84, cx + R * 0.84, cy + R * 0.84], fill=(62, 68, 76, 255), outline=INK, width=4)
        for k in range(8):
            a = k * math.tau / 8
            d.line([(cx, cy), (cx + math.cos(a) * R * 0.82, cy + math.sin(a) * R * 0.82)], fill=INK, width=7)
            d.line([(cx, cy), (cx + math.cos(a) * R * 0.82, cy + math.sin(a) * R * 0.82)], fill=(112, 118, 126, 255), width=3)
        d.ellipse([cx - R * 0.28, cy - R * 0.28, cx + R * 0.28, cy + R * 0.28], fill=(92, 98, 106, 255), outline=INK, width=4)
    elif kind == "potbelly_stove":
        # Cast-iron hearth slab + riveted potbelly stove lid with glowing ember slit!
        draw_stone_block(d, cx - R, cy - R, cx + R, cy + R, (108, 106, 104), rng, ink_w=5, radius=14)
        r_s = R * 0.72
        d.ellipse([cx - r_s, cy - r_s, cx + r_s, cy + r_s], fill=(54, 58, 64, 255), outline=INK, width=6)
        add_glow(im, cx, cy, r_s * 0.48, r_s * 0.48, (255, 118, 36), alpha=125, blur=12)
        d = ImageDraw.Draw(im)
        d.ellipse([cx - r_s * 0.56, cy - r_s * 0.56, cx + r_s * 0.56, cy + r_s * 0.56], fill=(74, 80, 88, 255), outline=INK, width=4)
        d.ellipse([cx - r_s * 0.24, cy - r_s * 0.24, cx + r_s * 0.24, cy + r_s * 0.24], fill=(238, 118, 36, 255), outline=INK, width=3)
    elif kind == "litfass":
        # Iconic Berlin Litfaßsäule poster kiosk with domed verdigris copper cap & multi-colored posters!
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(114, 112, 108, 255), outline=INK, width=6)
        colors = [(192, 62, 56), (224, 184, 72), (62, 118, 168), (74, 138, 86), (168, 92, 146), (228, 218, 194)]
        for k, col in enumerate(colors):
            a0, a1 = k * 60, (k + 1) * 60
            d.pieslice([cx - R * 0.88, cy - R * 0.88, cx + R * 0.88, cy + R * 0.88], start=a0, end=a1, fill=(*col, 255), outline=INK, width=4)
        # Verdigris copper dome cap + brass finial!
        d.ellipse([cx - R * 0.62, cy - R * 0.62, cx + R * 0.62, cy + R * 0.62], fill=(76, 134, 122, 255), outline=INK, width=5)
        d.ellipse([cx - R * 0.24, cy - R * 0.24, cx + R * 0.24, cy + R * 0.24], fill=(208, 172, 76, 255), outline=INK, width=4)
    else:
        # Round planked oak tavern table / wooden stool!
        d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(154, 108, 64, 255), outline=INK, width=6)
        n_pl = 5 if kind == "table" else 3
        step = (2 * R) / n_pl
        for i in range(1, n_pl):
            py = cy - R + i * step
            dx = math.sqrt(max(0.0, R * R - (py - cy) ** 2))
            d.line([(cx - dx + 4, py), (cx + dx - 4, py)], fill=INK_WARM, width=4)
            d.line([(cx - dx + 6, py + 4), (cx + dx - 6, py + 4)], fill=blend_rgb((154, 108, 64), (236, 196, 144), 0.28), width=2)
        d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=INK, width=6)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.4)


def redraw_box_wood_prop(w: int, h: int, kind: str, seed: int) -> Image.Image:
    im = new_hi(w, h)
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    pad_x, pad_y = 26, 24
    add_contact_shadow(im, lambda sd, col, off: sd.rounded_rectangle([pad_x + off[0], pad_y + off[1], W - pad_x + off[0], H - pad_y + off[1]], radius=10, fill=col), offset=(8, 10), blur=9, alpha=95)
    d = ImageDraw.Draw(im)
    if kind == "chest":
        draw_wood_planks_box(d, pad_x, pad_y, W - pad_x, H - pad_y, (132, 86, 48), rng, horizontal=True, n_planks=5, ink_w=6)
        for bx in (pad_x + 48, W - pad_x - 48):
            draw_beveled_rect(d, bx - 16, pad_y - 4, bx + 16, H - pad_y + 4, (74, 80, 88), ink_w=4)
        # Ornate brass clasp in front center
        draw_beveled_rect(d, W * 0.5 - 24, H - pad_y - 26, W * 0.5 + 24, H - pad_y + 10, (206, 168, 72), ink_w=4, radius=5)
    elif kind == "crate":
        draw_wood_planks_box(d, pad_x, pad_y, W - pad_x, H - pad_y, (152, 108, 64), rng, horizontal=True, n_planks=5, ink_w=6)
        d.line([(pad_x + 12, pad_y + 12), (W - pad_x - 12, H - pad_y - 12)], fill=INK, width=20)
        d.line([(pad_x + 12, pad_y + 12), (W - pad_x - 12, H - pad_y - 12)], fill=(134, 92, 52, 255), width=10)
        d.rectangle([pad_x, pad_y, W - pad_x, H - pad_y], outline=INK, width=6)
    elif kind == "ladder":
        # Two timber rails + 7 beveled oak rungs!
        rx_l, rx_r = W * 0.28, W * 0.72
        draw_beveled_rect(d, rx_l - 12, 18, rx_l + 12, H - 18, (132, 90, 52), ink_w=4, radius=4)
        draw_beveled_rect(d, rx_r - 12, 18, rx_r + 12, H - 18, (132, 90, 52), ink_w=4, radius=4)
        for i in range(7):
            ry = 48 + i * ((H - 96) / 6)
            draw_beveled_rect(d, rx_l + 6, ry - 9, rx_r - 6, ry + 9, (158, 112, 68), ink_w=4, radius=3)
    elif kind == "bridge_wood":
        draw_wood_planks_box(d, 16, 22, W - 16, H - 22, (148, 104, 62), rng, horizontal=False, n_planks=9, ink_w=5)
        draw_beveled_rect(d, 10, 14, W - 10, 44, (104, 70, 40), ink_w=5, radius=4)
        draw_beveled_rect(d, 10, H - 44, W - 10, H - 14, (104, 70, 40), ink_w=5, radius=4)
    elif kind == "bridge_stone":
        cols = 6
        bw = (W - 32) / cols
        for c in range(cols):
            draw_stone_block(d, 16 + c * bw, 44, 16 + (c + 1) * bw, H - 44, (144, 142, 138), rng, ink_w=4, moss=0.14)
        draw_stone_block(d, 10, 14, W - 10, 48, (118, 116, 114), rng, ink_w=5, moss=0.2)
        draw_stone_block(d, 10, H - 48, W - 10, H - 14, (118, 116, 114), rng, ink_w=5, moss=0.2)
    else:
        # Long planked oak table!
        draw_wood_planks_box(d, pad_x, pad_y, W - pad_x, H - pad_y, (152, 106, 62), rng, horizontal=True, n_planks=4, ink_w=6)
    return apply_painterly_finish(im, w, h, seed=seed, grain=5.4)


# =============================================================================
# STAGE 2: PAINTERLY RELIGHTING, CREVICE AO & GOUACHE HARMONIZATION FILTER
# (Preserves 100% of existing composition, silhouette & dd_red colorable hues!)
# =============================================================================
def harmonize_existing_png(path: Path, seed: int, periodic_xy: bool = False, preserve_red: bool = False) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    arr = np.array(im, dtype=np.float32)
    alpha = arr[:, :, 3]
    mask = alpha > 20
    if not np.any(mask):
        return im

    rgb = arr[:, :, :3].copy()
    lum = (rgb[:, :, 0] * 0.299 + rgb[:, :, 1] * 0.587 + rgb[:, :, 2] * 0.114) / 255.0

    # 1. Multi-octave organic gouache brush grain (periodic for seamless terrains!)
    if periodic_xy:
        n_lo = fbm_periodic(h, w, ((6, 6, 0.50), (14, 14, 0.32), (32, 32, 0.18)), seed=seed)
        n_hi = fbm_periodic(h, w, ((48, 48, 0.6), (96, 96, 0.4)), seed=seed + 701)
    else:
        n_lo = fbm_periodic(h, w, ((4, 4, 0.50), (10, 10, 0.32), (24, 24, 0.18)), seed=seed)
        n_hi = fbm_periodic(h, w, ((32, 32, 0.6), (64, 64, 0.4)), seed=seed + 701)

    brush = ((n_lo - 0.5) * 20.0 + (n_hi - 0.5) * 11.0) * mask

    # 2. Directional top-left sunlight bevel & mortar/crevice relief from luminance gradient!
    dy = np.roll(lum, 1, axis=0) - np.roll(lum, -1, axis=0)
    dx = np.roll(lum, 1, axis=1) - np.roll(lum, -1, axis=1)
    if not periodic_xy:
        dx[:, 0] = dx[:, -1] = 0.0
        dy[0, :] = dy[-1, :] = 0.0
    bevel = np.clip((dx + dy) * 34.0, -22.0, 22.0) * mask * (alpha / 255.0)

    # 3. Subtle warm-highlight / cool-shadow art-direction grading (skip hue shift on dd_red pixels!)
    if preserve_red:
        is_red = (rgb[:, :, 0] > rgb[:, :, 1] + 45) & (rgb[:, :, 0] > rgb[:, :, 2] + 45)
        # Apply pure luminance modulation on red-mask pixels so colorShader tint stays 100% pure!
        delta = (brush * 0.72 + bevel * 0.85)
        for c in range(3):
            rgb[:, :, c] = np.where(
                is_red,
                np.clip(rgb[:, :, c] * (1.0 + delta / 210.0), 0, 255),
                np.clip(rgb[:, :, c] + brush * 0.85 + bevel * (1.05 if c == 0 else (1.0 if c == 1 else 0.90)), 0, 255),
            )
    else:
        rgb[:, :, 0] = np.clip(rgb[:, :, 0] + brush + bevel * 1.06, 0, 255)
        rgb[:, :, 1] = np.clip(rgb[:, :, 1] + brush * 0.98 + bevel * 1.00, 0, 255)
        rgb[:, :, 2] = np.clip(rgb[:, :, 2] + brush * 0.92 + bevel * 0.88, 0, 255)

    # 4. Crisp hand-inked charcoal edge darkening on non-terrain sprites (zero white halo!)
    if not periodic_xy:
        # Find 1-2px inner perimeter inside alpha mask
        a_norm = alpha / 255.0
        eroded = np.minimum(
            np.minimum(np.roll(a_norm, 1, axis=0), np.roll(a_norm, -1, axis=0)),
            np.minimum(np.roll(a_norm, 1, axis=1), np.roll(a_norm, -1, axis=1)),
        )
        edge = mask & (eroded < 0.85) & (lum > 0.25)
        rgb[edge] = rgb[edge] * 0.62 + np.array([28.0, 22.0, 20.0]) * 0.38

    arr[:, :, :3] = np.where(mask[:, :, None], rgb, 0.0)
    out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    out.save(path, "PNG", optimize=True)
    return out


def main() -> None:
    bespoke_done: set[Path] = set()
    qa_bespoke: list[tuple[str, Image.Image]] = []

    bespoke_jobs: list[tuple[Path, Image.Image]] = [
        # Key Starter-CC0 flat-vector props actively used across Berlin maps!
        (STARTER_DIR / "objects/aether_streetlamp_slum.png", redraw_streetlamp(192, 192, (64, 220, 242), "slum", 401)),
        (STARTER_DIR / "objects/ornate_promenade_lamp.png", redraw_streetlamp(192, 192, (255, 206, 98), "promenade", 402)),
        (STARTER_DIR / "objects/station_lamp_post.png", redraw_streetlamp(192, 192, (255, 196, 86), "station", 403)),
        (STARTER_DIR / "objects/crystal_capacitor_bank.png", redraw_capacitor_bank(384, 256, 404)),
        (STARTER_DIR / "objects/street_vendor_stall.png", redraw_vendor_stall(384, 256, 405)),
        (STARTER_DIR / "objects/slum_scrap_crates.png", redraw_scrap_crates(256, 256, 406)),
        (STARTER_DIR / "objects/potted_palm_urn.png", redraw_foliage_prop(224, 224, "palm_urn", 407)),
        (STARTER_DIR / "objects/city_planter_box.png", redraw_foliage_prop(256, 160, "planter_box", 408)),
        (STARTER_DIR / "objects/urban_linden_tree.png", redraw_foliage_prop(384, 384, "linden", 409)),
        (STARTER_DIR / "objects/alpine_pine_deep.png", redraw_foliage_prop(384, 384, "pine", 410)),
        (STARTER_DIR / "objects/alpine_pine_snow.png", redraw_foliage_prop(384, 384, "pine", 411)),
        (STARTER_DIR / "objects/mountain_boulder_a.png", redraw_boulder(256, 256, False, 412)),
        (STARTER_DIR / "objects/mountain_boulder_b.png", redraw_boulder(256, 256, False, 413)),
        (STARTER_DIR / "objects/potbelly_cast_stove.png", redraw_round_wood_prop(256, 256, "potbelly_stove", 414)),
        (STARTER_DIR / "objects/berlin_litfass_kiosk.png", redraw_round_wood_prop(256, 256, "litfass", 415)),
        # Key Core-Fantasy early objects!
        (CORE_DIR / "objects/stone_pillar.png", redraw_pillar(256, 256, "round", (142, 140, 136), False, 416)),
        (CORE_DIR / "objects/mossy_boulder.png", redraw_boulder(256, 256, True, 417)),
        (CORE_DIR / "objects/bush_cluster.png", redraw_foliage_prop(256, 256, "bush", 418)),
        (CORE_DIR / "objects/ale_barrel.png", redraw_round_wood_prop(192, 192, "barrel", 419)),
        (CORE_DIR / "objects/oak_table_round.png", redraw_round_wood_prop(256, 256, "table", 420)),
        (CORE_DIR / "objects/wooden_stool.png", redraw_round_wood_prop(128, 128, "stool", 421)),
        (CORE_DIR / "objects/oak_table_long.png", redraw_box_wood_prop(512, 224, "table_long", 422)),
        (CORE_DIR / "objects/wooden_crate.png", redraw_box_wood_prop(192, 192, "crate", 423)),
        (CORE_DIR / "objects/chest_closed.png", redraw_box_wood_prop(256, 192, "chest", 424)),
        # Key Modular-Suite architectural pieces!
        (MOD_DIR / "modular/arch_pillar_round_stone.png", redraw_pillar(160, 160, "round", (148, 146, 140), False, 425)),
        (MOD_DIR / "modular/arch_pillar_square_stone.png", redraw_pillar(160, 160, "square", (142, 140, 136), False, 426)),
        (MOD_DIR / "modular/arch_pillar_broken.png", redraw_pillar(160, 160, "round", (134, 132, 128), True, 427)),
        (MOD_DIR / "modular/arch_fireplace_hearth.png", redraw_hearth(240, 144, 428)),
        (MOD_DIR / "modular/arch_wooden_ladder.png", redraw_box_wood_prop(128, 256, "ladder", 429)),
        (MOD_DIR / "modular/arch_bridge_timber.png", redraw_box_wood_prop(288, 192, "bridge_wood", 430)),
        (MOD_DIR / "modular/arch_bridge_stone.png", redraw_box_wood_prop(288, 192, "bridge_stone", 431)),
        (MOD_DIR / "modular/arch_street_manhole.png", redraw_round_wood_prop(160, 160, "manhole", 432)),
    ]
    for p, im in bespoke_jobs:
        im.save(p, "PNG", optimize=True)
        bespoke_done.add(p.resolve())
        qa_bespoke.append((p.stem, im))
    save_qa_sheet(qa_bespoke, SCRATCH_DIR / "qa_upgraded_early_bespoke.png", cols=8, cw=175, ch=150)

    # Skip our already newly upgraded stairs!
    skip_stems = {
        "brass_spiral_staircase", "wood_interior_stairs", "stone_stair_landing", "wood_stair_landing",
        "arch_stairs_wood_narrow", "arch_stairs_wood_wide", "arch_stairs_stone_narrow", "arch_stairs_stone_wide",
        "arch_spiral_wood", "arch_spiral_stone",
    }

    # Stage 2A: Harmonize all remaining starter-cc0/objects & core-fantasy-cc0/objects + colorables!
    n_harm = 0
    for idx, p in enumerate(sorted((STARTER_DIR / "objects").glob("*.png")) + sorted((CORE_DIR / "objects").glob("*.png"))):
        if p.resolve() in bespoke_done or p.stem in skip_stems:
            continue
        harmonize_existing_png(p, seed=500 + idx, periodic_xy=False, preserve_red=False)
        n_harm += 1

    for idx, p in enumerate(sorted((CORE_DIR / "colorable").glob("*.png"))):
        harmonize_existing_png(p, seed=700 + idx, periodic_xy=False, preserve_red=True)
        n_harm += 1

    # Stage 2B: Harmonize all remaining early modular-suite-cc0/modular/ pieces!
    for idx, p in enumerate(sorted((MOD_DIR / "modular").glob("*.png"))):
        if p.resolve() in bespoke_done or p.stem in skip_stems:
            continue
        harmonize_existing_png(p, seed=900 + idx, periodic_xy=False, preserve_red=False)
        n_harm += 1

    # Stage 2C: Harmonize the 28 earliest flat-grid terrains (strictly seamless periodic_xy=True!)
    early_flat_terrains = [
        STARTER_DIR / "terrain/berlin_wet_cobble.png",
        STARTER_DIR / "terrain/lower_slum_brick_alley.png",
        STARTER_DIR / "terrain/upper_marble_promenade.png",
        STARTER_DIR / "terrain/granite_cobblestone.png",
        STARTER_DIR / "terrain/slate_rooftop_tiles.png",
        STARTER_DIR / "terrain/riveted_iron_plate.png",
        STARTER_DIR / "terrain/timber_platform_deck.png",
        CORE_DIR / "terrain/dungeon_flagstone.png",
        CORE_DIR / "terrain/crypt_mossy_cobble.png",
        CORE_DIR / "terrain/sewer_wet_brick.png",
        CORE_DIR / "terrain/mansion_checkered_marble.png",
        CORE_DIR / "terrain/terracotta_courtyard.png",
        CORE_DIR / "terrain/royal_sandstone_paving.png",
        CORE_DIR / "terrain/castle_keep_ashlar.png",
        MOD_DIR / "terrain/clinic_white_tile.png",
        MOD_DIR / "terrain/bakery_terracotta_tile.png",
        MOD_DIR / "terrain/funeral_dark_parquet.png",
        MOD_DIR / "terrain/garden_brick_patio.png",
        MOD_DIR / "terrain/desert_sandstone.png",
        MOD_DIR / "terrain/tavern_checker_tile.png",
        MOD_DIR / "terrain/temple_mosaic_atrium.png",
        MOD_DIR / "terrain/mausoleum_marble.png",
        MOD_DIR / "terrain/alley_wet_cobble.png",
        MOD_DIR / "terrain/school_light_pine.png",
        MOD_DIR / "terrain/slate_shingle_roof.png",
        MOD_DIR / "terrain/red_clay_roof_tile.png",
        MOD_DIR / "terrain/dungeon_floor_sewer_brick.png",
        MOD_DIR / "terrain/pier_weathered_planks.png",
    ]
    qa_terr: list[tuple[str, Image.Image]] = []
    for idx, p in enumerate(early_flat_terrains):
        if p.exists():
            im = harmonize_existing_png(p, seed=1200 + idx, periodic_xy=True, preserve_red=False)
            qa_terr.append((p.stem, im))
    save_qa_sheet(qa_terr, SCRATCH_DIR / "qa_upgraded_early_terrains.png", cols=7, cw=180, ch=180)
    print(f"DONE Step 3B: {len(bespoke_jobs)} bespoke redraws + {n_harm} harmonized objects/modulars + {len(qa_terr)} terrains!")


if __name__ == "__main__":
    main()

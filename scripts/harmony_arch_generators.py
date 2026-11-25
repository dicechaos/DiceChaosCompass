"""
High-craft painterly parametric architectural generators for:
  - Portals (Doors, Double Doors, Vaults, Archways, Windows, Stained Glass, Bay Windows, Gates, Hatches)
  - Walls (Bricks, Ashlar Masonry, Half-Timber/Plaster, Balustrades, Magipunk Bulkheads, Hedges, Caverns, Ruins, Glass)
  - Paths (Cobbles, Curbs, Rail Tracks, Conduits, Embroidered Runners, Bridges, Water, Embankments, Festoons, Stairs)

Every single generator uses 2x supersampling, opaque alpha=255 interiors, warm directional
top-left beveling, deep charcoal hand-inked linework, and seamless periodic tiling where needed.
"""

from __future__ import annotations

import math
import random
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from harmony_art_engine import (
    DD_RED_BASE,
    DD_RED_DEEP,
    DD_RED_HI,
    INK,
    INK_DARK,
    INK_IRON,
    INK_MID,
    INK_WARM,
    add_contact_shadow,
    add_glow,
    apply_painterly_finish,
    blend_rgb,
    clamp8,
    draw_beveled_rect,
    draw_foliage_cluster,
    draw_glass_pane,
    draw_stone_block,
    draw_wood_planks_box,
    draw_wrought_scroll,
    fbm_periodic,
    new_hi,
    shade_rgb,
    vary_rgb,
)


# =============================================================================
# 1. PAINTERLY PORTALS (256x128 wall-inset doors/windows/gates, 256x256 hatches)
# =============================================================================
def _draw_jambs(
    d: ImageDraw.ImageDraw,
    W: int,
    H: int,
    jamb_rgb: tuple[int, int, int],
    rng: random.Random,
    style: str = "stone",
    jamb_w: int = 44,
    pad_y: int = 34,
) -> tuple[int, int]:
    """Draws left & right carved architectural jamb piers framing a portal opening."""
    x_l0, x_l1 = 12, 12 + jamb_w
    x_r0, x_r1 = W - 12 - jamb_w, W - 12
    y0, y1 = pad_y, H - pad_y
    for rx0, rx1 in ((x_l0, x_l1), (x_r0, x_r1)):
        if style == "wood":
            draw_wood_planks_box(d, rx0, y0, rx1, y1, jamb_rgb, rng, horizontal=False, n_planks=2, ink_w=5, nails=False)
        elif style == "brass":
            draw_beveled_rect(d, rx0, y0, rx1, y1, jamb_rgb, ink_w=5, radius=6, hi_amt=0.42, sh_amt=0.40)
            mx = (rx0 + rx1) * 0.5
            for ry in (y0 + 18, y1 - 18):
                d.ellipse([mx - 6, ry - 6, mx + 6, ry + 6], fill=blend_rgb(jamb_rgb, (252, 232, 160), 0.55), outline=INK, width=2)
        elif style == "iron":
            draw_beveled_rect(d, rx0, y0, rx1, y1, jamb_rgb, ink_w=5, radius=4, hi_amt=0.30, sh_amt=0.45)
            mx = (rx0 + rx1) * 0.5
            for ry in (y0 + 18, (y0 + y1) * 0.5, y1 - 18):
                d.ellipse([mx - 5, ry - 5, mx + 5, ry + 5], fill=blend_rgb(jamb_rgb, (190, 200, 212), 0.40), outline=INK, width=2)
        else:
            draw_stone_block(d, rx0, y0, rx1, y1, jamb_rgb, rng, ink_w=5, moss=0.12 if style == "moss_stone" else 0.0, cracks=0.4, radius=4)
            # Subtle central carved seam on stone jamb
            my = (y0 + y1) * 0.5
            d.line([(rx0 + 4, my), (rx1 - 4, my)], fill=INK_MID, width=3)
    return x_l1, x_r0


def render_portal(spec: dict[str, Any]) -> Image.Image:
    """Renders a high-craft painterly portal (door, window, gate, arch, bay, or floor hatch)."""
    kind = spec["kind"]
    w = int(spec.get("w", 256))
    h = int(spec.get("h", 128))
    seed = int(spec.get("seed", 101))
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    im = new_hi(w, h)
    d = ImageDraw.Draw(im)

    jamb_rgb = spec.get("jamb", (124, 120, 116))
    jamb_style = spec.get("jamb_style", "stone")
    base_rgb = spec.get("base", (138, 92, 54))
    trim_rgb = spec.get("trim", (196, 158, 72))
    glass_rgb = spec.get("glass", (112, 178, 214))
    glow_rgb = spec.get("glow", None)
    colorable = bool(spec.get("colorable", False))
    damaged = bool(spec.get("damaged", False))
    boarded = bool(spec.get("boarded", False))
    barred = bool(spec.get("barred", False))
    shutters = spec.get("shutters", None)  # None | "open" | "closed"
    shutter_rgb = spec.get("shutter_rgb", (56, 98, 70))

    if kind == "hatch_floor":
        # 256x256 square floor hatch / trapdoor / sewer grate / skylight!
        pad = 34
        add_contact_shadow(
            im,
            lambda sd, col, off: sd.rounded_rectangle(
                [pad + off[0], pad + off[1], W - pad + off[0], H - pad + off[1]], radius=12, fill=col
            ),
            offset=(8, 10),
            blur=10.0,
            alpha=95,
        )
        d = ImageDraw.Draw(im)
        sub = spec.get("sub", "wood_trapdoor")
        # Outer stone/iron curb frame
        draw_beveled_rect(d, pad, pad, W - pad, H - pad, jamb_rgb, ink_w=6, radius=10)
        ix0, iy0, ix1, iy1 = pad + 26, pad + 26, W - pad - 26, H - pad - 26

        if sub == "wood_trapdoor":
            draw_wood_planks_box(d, ix0, iy0, ix1, iy1, base_rgb, rng, horizontal=True, n_planks=6, ink_w=5, nails=True)
            # Two heavy forged iron cross-strap hinges on left
            for hy in (iy0 + 58, iy1 - 58):
                draw_beveled_rect(d, ix0 - 10, hy - 14, ix0 + 132, hy + 14, trim_rgb, ink_w=4, radius=4)
                for rx in (ix0 + 14, ix0 + 58, ix0 + 104):
                    d.ellipse([rx - 5, hy - 5, rx + 5, hy + 5], fill=blend_rgb(trim_rgb, (220, 224, 228), 0.4), outline=INK, width=2)
            # Recessed brass/iron pull ring on right
            rx, ry = ix1 - 54, H * 0.5
            d.rounded_rectangle([rx - 22, ry - 26, rx + 22, ry + 26], radius=6, fill=shade_rgb(trim_rgb, 0.72), outline=INK, width=4)
            d.ellipse([rx - 14, ry - 14, rx + 14, ry + 14], outline=INK, width=9)
            d.ellipse([rx - 14, ry - 14, rx + 14, ry + 14], outline=(*trim_rgb, 255), width=4)
        elif sub == "iron_grate":
            d.rectangle([ix0, iy0, ix1, iy1], fill=(16, 18, 22, 255), outline=INK, width=5)
            # Subtle shadowed stone drain depth underneath
            d.rectangle([ix0 + 8, iy0 + 8, ix1 - 8, iy1 - 8], fill=(24, 28, 34, 255))
            n_bars = spec.get("bars", 7)
            for i in range(n_bars):
                bx = ix0 + (i + 0.5) * ((ix1 - ix0) / n_bars)
                draw_beveled_rect(d, bx - 9, iy0, bx + 9, iy1, base_rgb, ink_w=3)
            # Cross-bar
            draw_beveled_rect(d, ix0, H * 0.5 - 10, ix1, H * 0.5 + 10, base_rgb, ink_w=4)
            # Corner bolts
            for cx, cy in ((pad + 14, pad + 14), (W - pad - 14, pad + 14), (pad + 14, H - pad - 14), (W - pad - 14, H - pad - 14)):
                d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(*trim_rgb, 255), outline=INK, width=2)
        elif sub == "skylight":
            cols, rows = spec.get("panes", (3, 2))
            pw, ph = (ix1 - ix0) / cols, (iy1 - iy0) / rows
            for r in range(rows):
                for c in range(cols):
                    draw_glass_pane(d, ix0 + c * pw + 4, iy0 + r * ph + 4, ix0 + (c + 1) * pw - 4, iy0 + (r + 1) * ph - 4, glass_rgb, glow_rgb, lead_w=4, specular=True)
            d.rectangle([ix0, iy0, ix1, iy1], outline=INK, width=6)
        elif sub == "cellar_bulkhead":
            # Sloped twin cellar bulkhead doors with ridge seam & padlock hasp
            mid = W * 0.5
            draw_wood_planks_box(d, ix0, iy0, mid - 4, iy1, base_rgb, rng, horizontal=True, n_planks=7, ink_w=4, nails=True)
            draw_wood_planks_box(d, mid + 4, iy0, ix1, iy1, vary_rgb(base_rgb, rng, 6), rng, horizontal=True, n_planks=7, ink_w=4, nails=True)
            draw_beveled_rect(d, mid - 8, iy0 - 4, mid + 8, iy1 + 4, trim_rgb, ink_w=4)
            for hy in (iy0 + 52, iy1 - 52):
                draw_beveled_rect(d, ix0 - 8, hy - 10, ix0 + 82, hy + 10, trim_rgb, ink_w=3)
                draw_beveled_rect(d, ix1 - 82, hy - 10, ix1 + 8, hy + 10, trim_rgb, ink_w=3)
            # Brass padlock hasp
            draw_beveled_rect(d, mid - 18, H * 0.5 - 12, mid + 18, H * 0.5 + 12, (194, 156, 72), ink_w=3, radius=4)
        elif sub == "stone_secret":
            # Concealed beveled flagstone slab with barely visible bronze pry-slot
            draw_stone_block(d, ix0, iy0, ix1, iy1, base_rgb, rng, ink_w=5, moss=0.25, cracks=0.7)
            d.line([(ix0 + 18, iy0 + 18), (ix1 - 18, iy0 + 18)], fill=INK_MID, width=2)
            d.rectangle([ix1 - 36, H * 0.5 - 14, ix1 - 20, H * 0.5 + 14], fill=(42, 38, 36, 255), outline=INK, width=2)
        elif sub == "brass_iris":
            # Circular magipunk brass inspection hatch with radial bolts
            cx, cy, R = W * 0.5, H * 0.5, (W - pad * 2) * 0.46
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(*jamb_rgb, 255), outline=INK, width=6)
            d.ellipse([cx - R * 0.82, cy - R * 0.82, cx + R * 0.82, cy + R * 0.82], fill=(*base_rgb, 255), outline=INK, width=5)
            for k in range(8):
                a = k * math.tau / 8
                d.line([(cx + math.cos(a) * R * 0.25, cy + math.sin(a) * R * 0.25), (cx + math.cos(a) * R * 0.80, cy + math.sin(a) * R * 0.80)], fill=INK, width=5)
                bx, by = cx + math.cos(a) * R * 0.90, cy + math.sin(a) * R * 0.90
                d.ellipse([bx - 6, by - 6, bx + 6, by + 6], fill=(*trim_rgb, 255), outline=INK, width=2)
            d.ellipse([cx - R * 0.28, cy - R * 0.28, cx + R * 0.28, cy + R * 0.28], fill=(*trim_rgb, 255), outline=INK, width=5)
            if glow_rgb:
                add_glow(im, cx, cy, R * 0.26, R * 0.26, glow_rgb, alpha=145, blur=12)
                d = ImageDraw.Draw(im)
                d.ellipse([cx - R * 0.16, cy - R * 0.16, cx + R * 0.16, cy + R * 0.16], fill=(*glow_rgb, 255), outline=INK, width=3)

        return apply_painterly_finish(im, w, h, seed=seed, grain=5.4)

    # --- WALL-INSET PORTALS (512x256 hi-res -> 256x128 final) ---
    # Soft grounded shadow under jambs & portal slab
    add_contact_shadow(
        im,
        lambda sd, col, off: sd.rounded_rectangle(
            [14 + off[0], 42 + off[1], W - 14 + off[0], H - 42 + off[1]], radius=8, fill=col
        ),
        offset=(5, 7),
        blur=7.5,
        alpha=82,
    )
    d = ImageDraw.Draw(im)

    # Optional subtle recessed stone threshold sill behind opening
    sill_y0, sill_y1 = 64, H - 64
    if kind in ("window_mullion", "window_stained", "window_bay", "window_slit"):
        sill_rgb = spec.get("sill", blend_rgb(jamb_rgb, (176, 172, 166), 0.35)[:3])
        draw_beveled_rect(d, 44, sill_y0 - 12, W - 44, sill_y1 + 12, sill_rgb, ink_w=4, radius=4)

    xl, xr = _draw_jambs(d, W, H, jamb_rgb, rng, style=jamb_style, jamb_w=int(spec.get("jamb_w", 44)), pad_y=36)
    mid_x = (xl + xr) * 0.5
    mid_y = H * 0.5

    if kind == "door_single":
        dy0, dy1 = 70, H - 70
        leaf_col = DD_RED_BASE if colorable else base_rgb
        draw_wood_planks_box(d, xl, dy0, xr, dy1, leaf_col, rng, horizontal=True, n_planks=int(spec.get("planks", 4)), ink_w=5, nails=not colorable)
        # Recessed raised inner bevel molding
        draw_beveled_rect(d, xl + 22, dy0 + 18, xr - 22, dy1 - 18, shade_rgb(leaf_col, 0.90)[:3], ink_w=3, radius=3)
        # Forged hinge straps on left + lock escutcheon & brass knob on right
        for hy in (dy0 + 22, dy1 - 22):
            draw_beveled_rect(d, xl - 6, hy - 8, xl + 68, hy + 8, trim_rgb, ink_w=3, radius=2)
        if spec.get("iron_bands", False):
            draw_beveled_rect(d, xl + 4, mid_y - 10, xr - 4, mid_y + 10, trim_rgb, ink_w=3)
            for rx in range(xl + 34, xr - 20, 48):
                d.ellipse([rx - 4, mid_y - 4, rx + 4, mid_y + 4], fill=blend_rgb(trim_rgb, (220, 224, 228), 0.45), outline=INK, width=2)
        if spec.get("glass_inset", False):
            draw_glass_pane(d, xl + 76, dy0 + 24, xr - 88, dy1 - 24, glass_rgb, glow_rgb, lead_w=3)
        # Ornate door knob / ring handle
        kx = xr - 36
        draw_beveled_rect(d, kx - 12, mid_y - 20, kx + 12, mid_y + 20, shade_rgb(trim_rgb, 0.78)[:3], ink_w=3, radius=4)
        d.ellipse([kx - 9, mid_y - 9, kx + 9, mid_y + 9], fill=(*blend_rgb(trim_rgb, (255, 240, 172), 0.42)[:3], 255), outline=INK, width=3)

    elif kind == "door_double":
        dy0, dy1 = 68, H - 68
        leaf_col = DD_RED_BASE if colorable else base_rgb
        gap = 5
        draw_wood_planks_box(d, xl, dy0, mid_x - gap, dy1, leaf_col, rng, horizontal=True, n_planks=3, ink_w=5, nails=not colorable)
        draw_wood_planks_box(d, mid_x + gap, dy0, xr, dy1, vary_rgb(leaf_col, rng, 5) if not colorable else leaf_col, rng, horizontal=True, n_planks=3, ink_w=5, nails=not colorable)
        # Inner gilded/carved panels
        for lx0, lx1 in ((xl + 16, mid_x - gap - 18), (mid_x + gap + 18, xr - 16)):
            if spec.get("glass_inset", False):
                draw_glass_pane(d, lx0, dy0 + 18, lx1, dy1 - 18, glass_rgb, glow_rgb, lead_w=3)
            else:
                draw_beveled_rect(d, lx0, dy0 + 16, lx1, dy1 - 16, shade_rgb(leaf_col, 0.92)[:3], ink_w=3, radius=3)
                if spec.get("gilded_frame", False):
                    d.rounded_rectangle([lx0 + 6, dy0 + 22, lx1 - 6, dy1 - 22], radius=2, outline=(*trim_rgb, 255), width=4)
        # Outer hinges
        for hy in (dy0 + 20, dy1 - 20):
            draw_beveled_rect(d, xl - 5, hy - 7, xl + 42, hy + 7, trim_rgb, ink_w=3)
            draw_beveled_rect(d, xr - 42, hy - 7, xr + 5, hy + 7, trim_rgb, ink_w=3)
        # Center astragal seam & twin brass handles
        d.rectangle([mid_x - gap, dy0 - 2, mid_x + gap, dy1 + 2], fill=shade_rgb(trim_rgb, 0.8), outline=INK, width=3)
        for kx in (mid_x - 22, mid_x + 22):
            d.ellipse([kx - 8, mid_y - 8, kx + 8, mid_y + 8], fill=(*blend_rgb(trim_rgb, (255, 240, 172), 0.45)[:3], 255), outline=INK, width=3)

    elif kind == "door_vault":
        dy0, dy1 = 56, H - 56
        draw_beveled_rect(d, xl, dy0, xr, dy1, base_rgb, ink_w=6, radius=6, hi_amt=0.32, sh_amt=0.45)
        draw_beveled_rect(d, xl + 18, dy0 + 14, xr - 18, dy1 - 14, shade_rgb(base_rgb, 0.88)[:3], ink_w=4, radius=4)
        # Perimeter steel bolts
        for rx in range(xl + 28, xr - 20, 44):
            for ry in (dy0 + 22, dy1 - 22):
                d.ellipse([rx - 4, ry - 4, rx + 4, ry + 4], fill=(*trim_rgb, 255), outline=INK, width=2)
        # Heavy spoke-wheel locking mechanism in center!
        R = 44
        if glow_rgb:
            add_glow(im, mid_x, mid_y, R + 16, R + 16, glow_rgb, alpha=130, blur=14)
            d = ImageDraw.Draw(im)
        d.ellipse([mid_x - R, mid_y - R, mid_x + R, mid_y + R], fill=shade_rgb(base_rgb, 0.65), outline=INK, width=6)
        d.ellipse([mid_x - R + 8, mid_y - R + 8, mid_x + R - 8, mid_y + R - 8], outline=(*trim_rgb, 255), width=8)
        for k in range(6):
            a = k * math.tau / 6
            d.line([(mid_x, mid_y), (mid_x + math.cos(a) * (R - 6), mid_y + math.sin(a) * (R - 6))], fill=INK, width=8)
            d.line([(mid_x, mid_y), (mid_x + math.cos(a) * (R - 6), mid_y + math.sin(a) * (R - 6))], fill=(*trim_rgb, 255), width=4)
        hub_col = (*glow_rgb, 255) if glow_rgb else (*blend_rgb(trim_rgb, (255, 242, 184), 0.45)[:3], 255)
        d.ellipse([mid_x - 14, mid_y - 14, mid_x + 14, mid_y + 14], fill=hub_col, outline=INK, width=4)

    elif kind == "door_sliding_aether":
        dy0, dy1 = 62, H - 62
        draw_beveled_rect(d, xl, dy0, xr, dy1, base_rgb, ink_w=6, radius=5)
        # Upper & lower machined steel guide tracks
        d.rectangle([xl, dy0, xr, dy0 + 14], fill=shade_rgb(base_rgb, 0.65), outline=INK, width=3)
        d.rectangle([xl, dy1 - 14, xr, dy1], fill=shade_rgb(base_rgb, 0.65), outline=INK, width=3)
        # Row of porthole slits flanking glowing central aether seal
        gl_c = glow_rgb or (62, 206, 232)
        for side in (-1, 1):
            for k in range(4):
                px = mid_x + side * (58 + k * 34)
                d.rounded_rectangle([px - 9, mid_y - 18, px + 9, mid_y + 18], radius=6, fill=(24, 34, 42, 255), outline=INK, width=3)
                d.rounded_rectangle([px - 5, mid_y - 13, px + 5, mid_y + 13], radius=4, fill=blend_rgb((24, 34, 42), gl_c, 0.55))
        add_glow(im, mid_x, mid_y, 44, 44, gl_c, alpha=145, blur=14)
        d = ImageDraw.Draw(im)
        d.ellipse([mid_x - 32, mid_y - 32, mid_x + 32, mid_y + 32], fill=(*trim_rgb, 255), outline=INK, width=5)
        d.ellipse([mid_x - 20, mid_y - 20, mid_x + 20, mid_y + 20], fill=(*gl_c, 255), outline=INK, width=4)
        d.ellipse([mid_x - 10, mid_y - 12, mid_x + 2, mid_y], fill=blend_rgb(gl_c, (255, 255, 255), 0.72))

    elif kind == "door_bookcase":
        dy0, dy1 = 60, H - 60
        draw_wood_planks_box(d, xl, dy0, xr, dy1, base_rgb, rng, horizontal=True, n_planks=3, ink_w=5, nails=False)
        # Top-down protruding book spines packed across the concealed shelf!
        book_palette = [(146, 38, 38), (44, 78, 122), (52, 102, 62), (124, 72, 36), (92, 46, 108), (168, 126, 46), (62, 54, 48)]
        bx = xl + 16
        while bx < xr - 28:
            bw = rng.randint(14, 24)
            bh_pad = rng.randint(12, 22)
            bc = vary_rgb(rng.choice(book_palette), rng, 12)
            draw_beveled_rect(d, bx, dy0 + bh_pad, bx + bw, dy1 - bh_pad, bc, ink_w=2, radius=2)
            # Gold spine band
            if rng.random() < 0.65:
                d.line([(bx + 3, mid_y), (bx + bw - 3, mid_y)], fill=(214, 178, 86, 255), width=3)
            bx += bw + rng.randint(1, 4)
        # Subtle brass latch pin hidden at right
        d.ellipse([xr - 20, mid_y - 6, xr - 8, mid_y + 6], fill=(198, 162, 74, 255), outline=INK, width=2)

    elif kind == "door_saloon":
        dy0, dy1 = 76, H - 76
        gap = 18
        for lx0, lx1 in ((xl + 4, mid_x - gap), (mid_x + gap, xr - 4)):
            draw_wood_planks_box(d, lx0, dy0, lx1, dy1, base_rgb, rng, horizontal=True, n_planks=5, ink_w=4, nails=False)
            # Louver slats across middle
            for sx in range(int(lx0 + 18), int(lx1 - 14), 16):
                d.line([(sx, dy0 + 12), (sx, dy1 - 12)], fill=INK_WARM, width=3)
        for hy in (dy0 + 14, dy1 - 14):
            draw_beveled_rect(d, xl - 4, hy - 6, xl + 20, hy + 6, trim_rgb, ink_w=2)
            draw_beveled_rect(d, xr - 20, hy - 6, xr + 4, hy + 6, trim_rgb, ink_w=2)

    elif kind == "door_curtain":
        dy0, dy1 = 72, H - 72
        curt_col = DD_RED_BASE if colorable else base_rgb
        # Brass curtain rod spanning top
        draw_beveled_rect(d, xl - 10, mid_y - 10, xr + 10, mid_y + 10, trim_rgb, ink_w=4, radius=4)
        # Sculpted pleated drapery folds gathered on both sides or draped across!
        n_folds = 11
        fw = (xr - xl) / n_folds
        for i in range(n_folds):
            fx0 = xl + i * fw
            fx1 = fx0 + fw + 2
            bulge = math.sin((i / n_folds) * math.pi) * 14
            fc = shade_rgb(curt_col, 1.08 if i % 2 == 0 else 0.78)[:3]
            draw_beveled_rect(d, fx0, dy0 - bulge * 0.4, fx1, dy1 + bulge * 0.4, fc, ink_w=3, radius=8)
        # Gold tassel tie cords
        for tx in (xl + 26, xr - 26):
            d.ellipse([tx - 8, mid_y - 8, tx + 8, mid_y + 8], fill=(224, 184, 82, 255), outline=INK, width=3)

    elif kind == "door_archway":
        # Open architectural threshold passage with carved stone/brick sill slabs & chamfered keystones!
        dy0, dy1 = 74, H - 74
        n_slabs = int(spec.get("slabs", 4))
        sw = (xr - xl) / n_slabs
        for i in range(n_slabs):
            draw_stone_block(d, xl + i * sw, dy0, xl + (i + 1) * sw, dy1, base_rgb, rng, ink_w=3, moss=float(spec.get("moss", 0.1)), cracks=0.4)
        # Overhead arch lintel line (subtle architectural top-down cut indicator)
        d.line([(xl, dy0 + 6), (xr, dy0 + 6)], fill=blend_rgb(base_rgb, (245, 240, 228), 0.42), width=4)
        d.line([(xl, dy1 - 6), (xr, dy1 - 6)], fill=INK_MID, width=4)
        # Central carved keystone cap
        draw_beveled_rect(d, mid_x - 22, dy0 - 12, mid_x + 22, dy1 + 12, trim_rgb, ink_w=4, radius=4)

    elif kind == "window_mullion":
        wy0, wy1 = 76, H - 76
        frame_col = DD_RED_BASE if (colorable and spec.get("color_frame")) else base_rgb
        pane_col = DD_RED_BASE if (colorable and not spec.get("color_frame")) else glass_rgb
        # Outer timber/iron/marble sash frame
        draw_beveled_rect(d, xl, wy0 - 10, xr, wy1 + 10, frame_col, ink_w=5, radius=4)
        n_panes = int(spec.get("panes", 4))
        mull_w = 10
        inner_x0, inner_x1 = xl + 12, xr - 12
        pw = (inner_x1 - inner_x0 - mull_w * (n_panes - 1)) / n_panes
        for i in range(n_panes):
            px0 = inner_x0 + i * (pw + mull_w)
            px1 = px0 + pw
            if glow_rgb:
                add_glow(im, (px0 + px1) * 0.5, mid_y, pw * 0.65, 44, glow_rgb, alpha=85, blur=12)
                d = ImageDraw.Draw(im)
            draw_glass_pane(
                d,
                px0,
                wy0 + 4,
                px1,
                wy1 - 4,
                pane_col,
                glow_rgb,
                lead_w=3,
                specular=True,
                diamond_lead=bool(spec.get("diamond_lead", False)),
            )
            if i < n_panes - 1:
                draw_beveled_rect(d, px1, wy0 - 6, px1 + mull_w, wy1 + 6, frame_col, ink_w=3)
        # Optional louvered shutters (open flanking outer sill OR closed across panes!)
        if shutters == "open":
            for sx0, sx1 in ((xl + 4, xl + 56), (xr - 56, xr - 4)):
                draw_beveled_rect(d, sx0, wy0 - 26, sx1, wy0 - 4, shutter_rgb, ink_w=3, radius=3)
                for lx in range(int(sx0 + 10), int(sx1 - 6), 10):
                    d.line([(lx, wy0 - 22), (lx, wy0 - 8)], fill=INK_MID, width=2)
        elif shutters == "closed":
            for sx0, sx1 in ((xl + 8, mid_x - 3), (mid_x + 3, xr - 8)):
                draw_beveled_rect(d, sx0, wy0 - 6, sx1, wy1 + 6, shutter_rgb, ink_w=4, radius=3)
                for lx in range(int(sx0 + 14), int(sx1 - 10), 16):
                    d.line([(lx, wy0 + 2), (lx, wy1 - 2)], fill=INK_MID, width=3)
        # Optional blooming window flowerbox tucked along bottom sill!
        if spec.get("flowerbox", False):
            draw_beveled_rect(d, xl + 34, wy1 + 8, xr - 34, wy1 + 38, (132, 74, 46), ink_w=4, radius=5)
            for fx in range(xl + 58, xr - 50, 38):
                draw_foliage_cluster(d, fx, wy1 + 22, 22, 14, (64, 122, 56), rng, n_leaves=7, blossom_rgb=spec.get("blossom", (226, 78, 92)))

    elif kind == "window_stained":
        wy0, wy1 = 72, H - 72
        draw_beveled_rect(d, xl, wy0 - 10, xr, wy1 + 10, base_rgb, ink_w=5, radius=4)
        palette = spec.get(
            "palette",
            [(186, 44, 58), (48, 108, 186), (218, 166, 46), (52, 148, 92)],
        )
        n_seg = len(palette)
        inner_x0, inner_x1 = xl + 12, xr - 12
        sw = (inner_x1 - inner_x0) / n_seg
        for i, col in enumerate(palette):
            px0, px1 = inner_x0 + i * sw + 3, inner_x0 + (i + 1) * sw - 3
            gl = blend_rgb(col, (255, 246, 210), 0.45)[:3]
            draw_glass_pane(d, px0, wy0 + 2, px1, wy1 - 2, col, gl, lead_w=4, specular=True, diamond_lead=True)
            # Decorative gold/jewel center diamond medallion in each lancet pane
            cx_p = (px0 + px1) * 0.5
            r_d = min(14, sw * 0.24)
            d.polygon([(cx_p, mid_y - r_d), (cx_p + r_d, mid_y), (cx_p, mid_y + r_d), (cx_p - r_d, mid_y)], fill=blend_rgb(col, (255, 232, 140), 0.65), outline=INK, width=2)
        if spec.get("mullion_bars", True):
            for i in range(1, n_seg):
                mx = inner_x0 + i * sw
                draw_beveled_rect(d, mx - 5, wy0 - 8, mx + 5, wy1 + 8, trim_rgb, ink_w=3)

    elif kind == "window_bay":
        # Projecting 3-facet European shopfront / parlor bay window bowing outward toward +Y!
        wy0, wy1 = 70, H - 50
        # Angled polygonal stone/wood bay sill
        bay_pts = [(xl, wy0), (xr, wy0), (xr, wy0 + 36), (xr - 44, wy1 + 18), (xl + 44, wy1 + 18), (xl, wy0 + 36)]
        d.polygon(bay_pts, fill=(*base_rgb, 255), outline=INK)
        d.line(bay_pts + [bay_pts[0]], fill=INK, width=6)
        # 3 glass bay facets
        draw_glass_pane(d, xl + 52, wy0 + 18, xr - 52, wy1 + 4, glass_rgb, glow_rgb, lead_w=4, specular=True)
        for sx in (xl + 52, mid_x, xr - 52):
            draw_beveled_rect(d, sx - 6, wy0 + 12, sx + 6, wy1 + 12, trim_rgb, ink_w=3)
        # Angled side glass cheeks
        d.polygon([(xl + 10, wy0 + 28), (xl + 48, wy0 + 22), (xl + 48, wy1 + 4), (xl + 16, wy0 + 44)], fill=(*glass_rgb, 255), outline=INK)
        d.polygon([(xr - 10, wy0 + 28), (xr - 48, wy0 + 22), (xr - 48, wy1 + 4), (xr - 16, wy0 + 44)], fill=(*glass_rgb, 255), outline=INK)

    elif kind == "window_slit":
        # Thick beveled stone castle embrasure / arrow slit!
        wy0, wy1 = 62, H - 62
        draw_stone_block(d, xl, wy0, xr, wy1, base_rgb, rng, ink_w=5, cracks=0.5)
        # Deep shadowed central chamfered firing slit
        d.polygon([(xl + 36, wy0 + 16), (xr - 36, wy0 + 16), (xr - 62, mid_y + 2), (xl + 62, mid_y + 2)], fill=(22, 24, 30, 255), outline=INK)
        d.polygon([(xl + 62, mid_y - 2), (xr - 62, mid_y - 2), (xr - 36, wy1 - 16), (xl + 36, wy1 - 16)], fill=(30, 34, 42, 255), outline=INK)
        d.rectangle([xl + 56, mid_y - 12, xr - 56, mid_y + 12], fill=(14, 16, 22, 255), outline=INK, width=4)
        if glow_rgb:
            d.rectangle([xl + 66, mid_y - 7, xr - 66, mid_y + 7], fill=(*glow_rgb, 255))

    elif kind == "gate_iron":
        # Forged wrought-iron prison gate / portcullis / cemetery gate / brass bank grille!
        gy0, gy1 = 66, H - 66
        # Crossbars
        draw_beveled_rect(d, xl, gy0 + 12, xr, gy0 + 30, base_rgb, ink_w=4)
        draw_beveled_rect(d, xl, gy1 - 30, xr, gy1 - 12, base_rgb, ink_w=4)
        if spec.get("mid_bar", True):
            draw_beveled_rect(d, xl, mid_y - 8, xr, mid_y + 8, base_rgb, ink_w=4)
        n_bars = int(spec.get("bars", 9))
        for i in range(n_bars):
            bx = xl + (i + 0.5) * ((xr - xl) / n_bars)
            bar_c = trim_rgb if spec.get("brass_bars", False) else base_rgb
            draw_beveled_rect(d, bx - 7, gy0 - 6, bx + 7, gy1 + 6, bar_c, ink_w=3, radius=3)
            # Spear tip or brass finial stud
            d.ellipse([bx - 8, mid_y - 8, bx + 8, mid_y + 8], fill=(*trim_rgb, 255), outline=INK, width=2)
        if glow_rgb:
            add_glow(im, mid_x, mid_y, (xr - xl) * 0.44, 24, glow_rgb, alpha=110, blur=12)

    # Optional overlays: iron security bars, boarded derelict planks, or shattered damage!
    if barred and kind.startswith("window"):
        for i in range(6):
            bx = xl + 30 + i * ((xr - xl - 60) / 5)
            draw_beveled_rect(d, bx - 5, 62, bx + 5, H - 62, (62, 68, 76), ink_w=3)
    if boarded:
        for angle_off, py in ((-8, mid_y - 26), (5, mid_y + 2), (-4, mid_y + 26)):
            pts = [(xl - 8, py - 11 + angle_off), (xr + 8, py - 11 - angle_off), (xr + 8, py + 11 - angle_off), (xl - 8, py + 11 + angle_off)]
            d.polygon(pts, fill=(*vary_rgb((132, 96, 62), rng, 10), 255), outline=INK)
            d.line(pts + [pts[0]], fill=INK, width=4)
    if damaged:
        # Jagged dark cracks / missing shard triangle
        for _ in range(4):
            cx = rng.uniform(xl + 40, xr - 40)
            cy = rng.uniform(76, H - 76)
            d.polygon([(cx, cy), (cx + rng.uniform(-24, 24), cy + rng.uniform(-18, 18)), (cx + rng.uniform(-18, 18), cy + rng.uniform(-24, 24))], fill=(18, 16, 18, 255), outline=INK)

    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0)


# =============================================================================
# 2. PAINTERLY SEAMLESS WALLS (512x128 horizontal tiling!)
# =============================================================================
def render_wall(spec: dict[str, Any]) -> Image.Image:
    """Renders a 512x128 horizontally seamless hand-inked painterly wall strip."""
    kind = spec["kind"]
    w = int(spec.get("w", 512))
    h = int(spec.get("h", 128))
    seed = int(spec.get("seed", 201))
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    im = new_hi(w, h)
    d = ImageDraw.Draw(im)

    base_rgb = DD_RED_BASE if spec.get("colorable", False) else spec.get("base", (134, 128, 122))
    mortar_rgb = spec.get("mortar", (56, 50, 46))
    trim_rgb = spec.get("trim", (94, 64, 42))
    accent_rgb = spec.get("accent", (196, 158, 72))
    moss = float(spec.get("moss", 0.0))
    snow = bool(spec.get("snow", False))
    y0, y1 = int(spec.get("y0", 30)), int(spec.get("y1", H - 30))

    # Seamless horizontal contact drop shadow
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, y0 + 8, W, min(H - 2, y1 + 14)], fill=(14, 12, 12, 84))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(im)

    if kind == "brick":
        # Multi-course kiln-varied staggered brickwork (100% seamless mod W!)
        d.rectangle([0, y0, W, y1], fill=(*mortar_rgb, 255))
        rows = int(spec.get("rows", 3))
        cols = int(spec.get("cols", 12))
        bw = W / cols
        bh = (y1 - y0) / rows
        pad = 3
        for r in range(rows):
            offset = (bw * 0.5) if (r % 2 == 1) else 0.0
            for c in range(-1, cols + 1):
                bx0 = c * bw + offset
                bx1 = bx0 + bw
                # Wrap brick seed periodically so left & right edges match!
                b_rng = random.Random(seed + r * 97 + (c % cols) * 13)
                bcol = vary_rgb(base_rgb, b_rng, 16)
                if spec.get("flemish", False) and (c % 2 == 0):
                    bcol = vary_rgb(trim_rgb, b_rng, 10)
                if spec.get("soot", False) and b_rng.random() < 0.35:
                    bcol = blend_rgb(bcol, (34, 30, 32), 0.36)[:3]
                draw_beveled_rect(d, bx0 + pad, y0 + r * bh + pad, bx1 - pad, y0 + (r + 1) * bh - pad, bcol, ink_w=3, radius=3, hi_amt=0.26, sh_amt=0.40)
                if moss > 0 and b_rng.random() < moss:
                    mx = (bx0 + bx1) * 0.5 + b_rng.uniform(-10, 10)
                    my = y0 + (r + 0.5) * bh
                    d.ellipse([mx - 9, my - 6, mx + 9, my + 6], fill=(*vary_rgb((72, 112, 54), b_rng, 14), 255))
        d.line([(0, y0), (W, y0)], fill=INK, width=6)
        d.line([(0, y1), (W, y1)], fill=INK, width=6)

    elif kind == "ashlar":
        # Chiseled beveled ashlar stone masonry (100% seamless mod W!)
        d.rectangle([0, y0, W, y1], fill=(*mortar_rgb, 255))
        rows = int(spec.get("rows", 2))
        cols = int(spec.get("cols", 8))
        bw = W / cols
        bh = (y1 - y0) / rows
        for r in range(rows):
            off = (bw * 0.5) if (r % 2 == 1) else 0.0
            for c in range(-1, cols + 1):
                b_rng = random.Random(seed + r * 131 + (c % cols) * 19)
                bx0, bx1 = c * bw + off + 3, (c + 1) * bw + off - 3
                draw_stone_block(d, bx0, y0 + r * bh + 3, bx1, y0 + (r + 1) * bh - 3, base_rgb, b_rng, ink_w=4, moss=moss, cracks=float(spec.get("cracks", 0.45)), radius=4)
        # Optional center inlaid molding / brass stripe / buttress pilasters
        if spec.get("center_strip", False):
            my = (y0 + y1) * 0.5
            draw_beveled_rect(d, 0, my - 9, W, my + 9, accent_rgb, ink_w=3)
        if spec.get("buttresses", False):
            for px in range(0, W + 1, W // 4):
                draw_stone_block(d, px - 22, y0 - 16, px + 22, y1 + 16, shade_rgb(base_rgb, 0.94)[:3], random.Random(seed + (px % W)), ink_w=5, moss=moss)
        d.line([(0, y0), (W, y0)], fill=INK, width=6)
        d.line([(0, y1), (W, y1)], fill=INK, width=6)

    elif kind == "plaster_timber":
        # Half-timbered Fachwerk / Wainscot / Wallpapered interior wall!
        n_bays = int(spec.get("bays", 4))
        bay_w = W / n_bays
        post_w = int(spec.get("post_w", 28))
        draw_beveled_rect(d, 0, y0, W, y1, base_rgb, ink_w=0)
        # Optional wainscoting wood border rails along top & bottom edges
        rail_h = int(spec.get("rail_h", 18))
        draw_wood_planks_box(d, 0, y0, W, y0 + rail_h, trim_rgb, rng, horizontal=True, n_planks=1, ink_w=4, nails=False)
        draw_wood_planks_box(d, 0, y1 - rail_h, W, y1, trim_rgb, rng, horizontal=True, n_planks=1, ink_w=4, nails=False)
        # Bay infill texture (stucco cracks / damask diamond wallpaper / peeling plaster / brick infill)
        infill = spec.get("infill", "plaster")
        for b in range(n_bays):
            bx0, bx1 = b * bay_w + post_w * 0.5, (b + 1) * bay_w - post_w * 0.5
            iy0, iy1 = y0 + rail_h, y1 - rail_h
            b_rng = random.Random(seed + b * 41)
            if infill == "damask":
                draw_beveled_rect(d, bx0, iy0, bx1, iy1, base_rgb, ink_w=2)
                for dx in range(int(bx0 + 24), int(bx1 - 14), 34):
                    my = (iy0 + iy1) * 0.5
                    d.polygon([(dx, my - 18), (dx + 12, my), (dx, my + 18), (dx - 12, my)], fill=blend_rgb(base_rgb, accent_rgb, 0.45), outline=blend_rgb(base_rgb, (24, 16, 16), 0.35))
            elif infill == "wood_panel":
                draw_wood_planks_box(d, bx0, iy0, bx1, iy1, base_rgb, b_rng, horizontal=True, n_planks=3, ink_w=3, nails=False)
                draw_beveled_rect(d, bx0 + 16, iy0 + 14, bx1 - 16, iy1 - 14, shade_rgb(base_rgb, 0.90)[:3], ink_w=3)
            elif infill == "peeling":
                draw_beveled_rect(d, bx0, iy0, bx1, iy1, vary_rgb(base_rgb, b_rng, 8), ink_w=2)
                # Exposed weathered brick patch peeking through cracked plaster!
                px = b_rng.uniform(bx0 + 26, bx1 - 56)
                py = b_rng.uniform(iy0 + 14, iy1 - 36)
                d.rounded_rectangle([px, py, px + 44, py + 28], radius=8, fill=(138, 72, 54, 255), outline=INK_MID, width=2)
                d.line([(px + 4, py + 14), (px + 40, py + 14)], fill=INK_MID, width=2)
            elif infill == "brick_infill":
                for rr in range(2):
                    for cc in range(4):
                        sx0 = bx0 + cc * ((bx1 - bx0) / 4)
                        sx1 = bx0 + (cc + 1) * ((bx1 - bx0) / 4)
                        sy0 = iy0 + rr * ((iy1 - iy0) / 2)
                        sy1 = iy0 + (rr + 1) * ((iy1 - iy0) / 2)
                        draw_beveled_rect(d, sx0 + 2, sy0 + 2, sx1 - 2, sy1 - 2, vary_rgb(base_rgb, b_rng, 14), ink_w=2)
            else:
                draw_beveled_rect(d, bx0, iy0, bx1, iy1, vary_rgb(base_rgb, b_rng, 7), ink_w=2)
                for _ in range(2):
                    cx = b_rng.uniform(bx0 + 18, bx1 - 18)
                    cy = b_rng.uniform(iy0 + 10, iy1 - 10)
                    d.line([(cx, cy), (cx + b_rng.uniform(-22, 22), cy + b_rng.uniform(-16, 16))], fill=blend_rgb(base_rgb, (44, 38, 34), 0.35), width=2)
        # Beveled vertical timber posts (wrapping at x=0 and x=W for seamless tiling!)
        for b in range(n_bays + 1):
            px = b * bay_w
            draw_beveled_rect(d, px - post_w * 0.5, y0 - 4, px + post_w * 0.5, y1 + 4, trim_rgb, ink_w=5, radius=3)
            # Peg dowel
            d.ellipse([px - 4, (y0 + y1) * 0.5 - 4, px + 4, (y0 + y1) * 0.5 + 4], fill=(*accent_rgb, 255), outline=INK, width=2)
        d.line([(0, y0), (W, y0)], fill=INK, width=6)
        d.line([(0, y1), (W, y1)], fill=INK, width=6)

    elif kind == "balustrade":
        # Forged wrought-iron / Jugendstil brass / stone terrace balustrade!
        my = H * 0.5
        if spec.get("stone_curb", False):
            draw_beveled_rect(d, 0, my - 26, W, my + 26, mortar_rgb, ink_w=4)
        draw_wrought_scroll(d, 0, my, W, amp=float(spec.get("amp", 18)), iron_rgb=base_rgb, brass_rgb=accent_rgb if spec.get("brass_studs", True) else None)
        # Periodic sculpted fence posts/balusters
        n_posts = int(spec.get("posts", 8))
        for i in range(n_posts + 1):
            px = i * (W / n_posts)
            pr = int(spec.get("post_r", 16))
            d.ellipse([px - pr, my - pr, px + pr, my + pr], fill=(*base_rgb, 255), outline=INK, width=5)
            d.ellipse([px - pr * 0.52, my - pr * 0.52, px + pr * 0.52, my + pr * 0.52], fill=(*accent_rgb, 255), outline=INK, width=3)

    elif kind == "bulkhead":
        # Riveted dark-magipunk steel/copper bulkhead + optional glowing aether glass conduit!
        draw_beveled_rect(d, 0, y0, W, y1, base_rgb, ink_w=0)
        n_plates = int(spec.get("plates", 4))
        pw = W / n_plates
        for i in range(n_plates):
            px0, px1 = i * pw, (i + 1) * pw
            draw_beveled_rect(d, px0 + 3, y0 + 3, px1 - 3, y1 - 3, vary_rgb(base_rgb, random.Random(seed + i), 7), ink_w=4, radius=4)
            for rx in (px0 + 18, px1 - 18):
                for ry in (y0 + 18, y1 - 18):
                    d.ellipse([rx - 5, ry - 5, rx + 5, ry + 5], fill=(*accent_rgb, 255), outline=INK, width=2)
        glow = spec.get("glow", None)
        if glow is not None:
            my = H * 0.5
            gl_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(gl_layer).rectangle([0, my - 28, W, my + 28], fill=(*glow, 95))
            im.alpha_composite(gl_layer.filter(ImageFilter.GaussianBlur(12)))
            d = ImageDraw.Draw(im)
            d.rectangle([0, my - 16, W, my + 16], fill=(*glow, 255), outline=INK, width=4)
            d.line([(0, my - 6), (W, my - 6)], fill=blend_rgb(glow, (255, 255, 255), 0.65), width=4)
            # Brass clamp rings over glowing tube
            for cx in range(0, W + 1, W // 8):
                draw_beveled_rect(d, cx - 10, my - 24, cx + 10, my + 24, accent_rgb, ink_w=3, radius=3)
        d.line([(0, y0), (W, y0)], fill=INK, width=6)
        d.line([(0, y1), (W, y1)], fill=INK, width=6)

    elif kind == "hedgerow":
        # Lush sculpted painterly foliage hedgerow (100% seamless wrap mod W!)
        n_clumps = int(spec.get("clumps", 12))
        blossom = spec.get("blossom", None)
        for i in range(n_clumps):
            cx = (i + 0.5) * (W / n_clumps)
            cy = H * 0.5 + rng.uniform(-12, 12)
            rx = rng.uniform(54, 74)
            ry = rng.uniform(58, 76)
            draw_foliage_cluster(d, cx, cy, rx, ry, base_rgb, rng, n_leaves=14, blossom_rgb=blossom, wrap_w=float(W))
        if snow:
            for i in range(n_clumps):
                cx = (i + 0.5) * (W / n_clumps) + rng.uniform(-16, 16)
                cy_s = H * 0.5 - rng.uniform(14, 28)
                rx_s = rng.uniform(36, 58)
                ry_s = rng.uniform(16, 26)
                for ox in (-W, 0, W):
                    d.ellipse([cx + ox - rx_s, cy_s - ry_s + 5, cx + ox + rx_s, cy_s + ry_s + 5], fill=(176, 198, 218, 255))
                    d.ellipse([cx + ox - rx_s, cy_s - ry_s, cx + ox + rx_s, cy_s + ry_s], fill=(238, 244, 250, 255), outline=(146, 170, 194, 255), width=2)

    elif kind == "cavern_rock":
        # Sculpted 3D faceted rocky cliff/cavern wall (100% seamless mod W!)
        n_rocks = int(spec.get("rocks", 14))
        for i in range(n_rocks):
            cx = (i + 0.5) * (W / n_rocks)
            cy = H * 0.5 + rng.uniform(-14, 14)
            rx = rng.uniform(52, 82)
            ry = rng.uniform(56, 78)
            rcol = vary_rgb(base_rgb, rng, 18)
            n_v = rng.randint(6, 8)
            pts = []
            for k in range(n_v):
                a = (k / n_v) * math.tau + rng.uniform(-0.18, 0.18)
                rad = rng.uniform(0.76, 1.05)
                pts.append((cx + math.cos(a) * rx * rad, cy + math.sin(a) * ry * rad))
            # Draw with periodic wrap!
            for ox in (-W, 0, W):
                wpts = [(x + ox, y) for x, y in pts]
                d.polygon(wpts, fill=(*rcol, 255), outline=INK)
                d.line(wpts + [wpts[0]], fill=INK, width=5)
                # Top-left sunlit ridge facet + bottom-right shadowed facet
                hi_pts = [(cx + ox, cy), wpts[4], wpts[5], wpts[0]]
                d.polygon(hi_pts, fill=blend_rgb(rcol, (238, 234, 224), 0.28))
                sh_pts = [(cx + ox, cy), wpts[1], wpts[2], wpts[3]]
                d.polygon(sh_pts, fill=blend_rgb(rcol, (18, 16, 20), 0.42))
                d.line(wpts + [wpts[0]], fill=INK, width=5)
            if moss > 0 and rng.random() < moss:
                draw_foliage_cluster(d, cx, cy - 16, 22, 16, (72, 112, 54), rng, n_leaves=6, wrap_w=float(W))
            if spec.get("crystals", False) and i % 3 == 0:
                gl_c = spec.get("crystal_rgb", (76, 214, 242))
                for ox in (-W, 0, W):
                    cpts = [(cx + ox - 12, cy + 8), (cx + ox + 4, cy - 34), (cx + ox + 22, cy - 4), (cx + ox + 8, cy + 16)]
                    d.polygon(cpts, fill=(*gl_c, 255), outline=INK)
                    d.line([(cx + ox + 4, cy - 34), (cx + ox + 2, cy + 12)], fill=blend_rgb(gl_c, (255, 255, 255), 0.65), width=3)
            if spec.get("magma", False) and i % 2 == 0:
                for ox in (-W, 0, W):
                    d.line([(cx + ox - 28, cy + 12), (cx + ox, cy - 6), (cx + ox + 32, cy + 8)], fill=(246, 112, 28, 255), width=6)
                    d.line([(cx + ox - 24, cy + 12), (cx + ox, cy - 6), (cx + ox + 28, cy + 8)], fill=(255, 216, 86, 255), width=2)

    elif kind == "palisade":
        # Top-down round sharpened tree-trunk stockade posts with growth rings & cross-ties!
        my = H * 0.5
        draw_beveled_rect(d, 0, my - 16, W, my + 16, shade_rgb(base_rgb, 0.72)[:3], ink_w=4)
        n_logs = int(spec.get("logs", 14))
        lr = (W / n_logs) * 0.48
        for i in range(n_logs):
            cx = (i + 0.5) * (W / n_logs)
            cy = my + rng.uniform(-4, 4)
            lcol = vary_rgb(base_rgb, rng, 12)
            # Bark outer ring + heartwood concentric growth rings
            d.ellipse([cx - lr, cy - lr, cx + lr, cy + lr], fill=shade_rgb(lcol, 0.55), outline=INK, width=5)
            d.ellipse([cx - lr * 0.80, cy - lr * 0.80, cx + lr * 0.80, cy + lr * 0.80], fill=(*lcol, 255), outline=INK_WARM, width=3)
            d.ellipse([cx - lr * 0.48, cy - lr * 0.48, cx + lr * 0.48, cy + lr * 0.48], fill=blend_rgb(lcol, (226, 188, 134), 0.28), outline=INK_WARM, width=2)
            d.ellipse([cx - lr * 0.18, cy - lr * 0.18, cx + lr * 0.18, cy + lr * 0.18], fill=shade_rgb(lcol, 0.72))

    elif kind == "picket":
        # White picket / woven garden hurdle / bamboo fence
        my = H * 0.5
        draw_beveled_rect(d, 0, my - 12, W, my + 12, shade_rgb(base_rgb, 0.88)[:3], ink_w=4)
        n_p = int(spec.get("pickets", 24))
        for i in range(n_p):
            px = (i + 0.5) * (W / n_p)
            ph = 36 if i % 6 == 0 else 28
            pw = 13 if i % 6 == 0 else 9
            draw_beveled_rect(d, px - pw, my - ph, px + pw, my + ph, vary_rgb(base_rgb, rng, 7), ink_w=3, radius=3)

    elif kind == "tile_wall":
        # Glazed ceramic subway / bathhouse / mosaic wall
        d.rectangle([0, y0, W, y1], fill=(*mortar_rgb, 255))
        rows, cols = int(spec.get("rows", 3)), int(spec.get("cols", 16))
        tw, th = W / cols, (y1 - y0) / rows
        for r in range(rows):
            off = (tw * 0.5) if (r % 2 == 1) else 0.0
            for c in range(-1, cols + 1):
                t_rng = random.Random(seed + r * 71 + (c % cols) * 17)
                tc = vary_rgb(base_rgb, t_rng, 8)
                draw_beveled_rect(d, c * tw + off + 2, y0 + r * th + 2, (c + 1) * tw + off - 2, y0 + (r + 1) * th - 2, tc, ink_w=2, hi_amt=0.45, sh_amt=0.25)
        d.line([(0, y0), (W, y0)], fill=INK, width=6)
        d.line([(0, y1), (W, y1)], fill=INK, width=6)

    elif kind == "ship_hull":
        # Planked timber / ironclad / brass-aether skyship / white yacht hull wall!
        draw_wood_planks_box(d, 0, y0, W, y1, base_rgb, rng, horizontal=True, n_planks=3, ink_w=5, nails=True)
        draw_beveled_rect(d, 0, y0, W, y0 + 22, trim_rgb, ink_w=4)
        draw_beveled_rect(d, 0, y1 - 22, W, y1, trim_rgb, ink_w=4)
        for rx in range(32, W, 64):
            d.ellipse([rx - 6, (y0 + y1) * 0.5 - 6, rx + 6, (y0 + y1) * 0.5 + 6], fill=(*accent_rgb, 255), outline=INK, width=2)
        if spec.get("glow", None):
            my = H * 0.5
            d.rectangle([0, my - 12, W, my + 12], fill=(*spec["glow"], 255), outline=INK, width=3)

    elif kind == "ruined_wall":
        # Crumbling jagged staggered brick/stone ruin courses with breached gaps & rubble chips!
        rows, cols = 3, 12
        bw, bh = W / cols, (y1 - y0) / rows
        breach_cols = {3, 4, 8, 9}
        for r in range(rows):
            off = (bw * 0.5) if r % 2 == 1 else 0.0
            for c in range(cols):
                b_rng = random.Random(seed + r * 97 + c * 29)
                bx0 = c * bw + off
                bx1 = bx0 + bw
                if bx1 > W:
                    bx1 = W
                if c in breach_cols and (r == 1 or b_rng.random() < 0.72):
                    # Scattered broken rubble chips inside breach!
                    for _ in range(3):
                        rx = bx0 + b_rng.uniform(8, max(12, bx1 - bx0 - 8))
                        ry = y0 + r * bh + b_rng.uniform(6, bh - 6)
                        rr = b_rng.uniform(7, 15)
                        draw_stone_block(d, rx - rr, ry - rr * 0.65, rx + rr, ry + rr * 0.65, base_rgb, b_rng, ink_w=3, moss=moss)
                else:
                    draw_stone_block(d, bx0 + 3, y0 + r * bh + 3, bx1 - 3, y0 + (r + 1) * bh - 3, base_rgb, b_rng, ink_w=4, moss=moss, cracks=0.75)

    elif kind == "barricade":
        # Stacked sandbags OR street plank-and-crate barricade!
        if spec.get("sub") == "sandbags":
            for r in range(2):
                for c in range(10):
                    s_rng = random.Random(seed + r * 53 + c * 17)
                    bx0 = c * (W / 10) + (r * 42) - 42
                    by0 = y0 + 12 + r * 66
                    draw_beveled_rect(d, bx0 + 4, by0, bx0 + 96, by0 + 62, vary_rgb(base_rgb, s_rng, 10), ink_w=4, radius=18)
                    d.line([(bx0 + 18, by0 + 31), (bx0 + 82, by0 + 31)], fill=INK_WARM, width=2)
        else:
            # Jagged overturned timber planks & iron spikes
            for i in range(12):
                px = i * (W / 12)
                b_rng = random.Random(seed + i * 23)
                dy = b_rng.uniform(-16, 16)
                draw_wood_planks_box(d, px - 10, y0 + 16 + dy, px + 96, y1 - 16 + dy, vary_rgb(base_rgb, b_rng, 14), b_rng, horizontal=True, n_planks=2, ink_w=4)

    elif kind == "glass_wall":
        # Conservatory / shopfront iron-and-glass mullioned wall!
        my = H * 0.5
        draw_beveled_rect(d, 0, y0 + 18, W, y1 - 18, trim_rgb, ink_w=5)
        n_p = int(spec.get("panes", 8))
        pw = W / n_p
        g_col = DD_RED_BASE if spec.get("colorable", False) else spec.get("glass", (128, 194, 224))
        for i in range(n_p):
            draw_glass_pane(d, i * pw + 10, y0 + 28, (i + 1) * pw - 10, y1 - 28, g_col, spec.get("glow", None), lead_w=3, diamond_lead=bool(spec.get("diamond_lead", False)))
            draw_beveled_rect(d, i * pw - 6, y0 + 12, i * pw + 6, y1 - 12, trim_rgb, ink_w=3)

    if snow and kind != "hedgerow":
        # Crisp painted snow drift capping along top edge!
        for i in range(16):
            sx = i * (W / 16)
            sh_r = random.Random(seed + i).uniform(16, 32)
            d.ellipse([sx - 18, y0 - 8, sx + 62, y0 + sh_r], fill=(236, 242, 248, 255), outline=INK_MID, width=2)

    return apply_painterly_finish(im, w, h, seed=seed, grain=5.2, periodic_x=True)


# =============================================================================
# 3. PAINTERLY SEAMLESS PATHS (512x128 / 512x192 / 512x256 horizontal tiling!)
# =============================================================================
def render_path(spec: dict[str, Any]) -> Image.Image:
    """Renders a horizontally seamless painterly spline path strip."""
    kind = spec["kind"]
    w = int(spec.get("w", 512))
    h = int(spec.get("h", 128))
    seed = int(spec.get("seed", 301))
    rng = random.Random(seed)
    W, H = w * 2, h * 2
    im = new_hi(w, h)
    d = ImageDraw.Draw(im)

    base_rgb = DD_RED_BASE if spec.get("colorable", False) else spec.get("base", (134, 128, 120))
    trim_rgb = spec.get("trim", (92, 64, 42))
    accent_rgb = spec.get("accent", (206, 168, 76))
    my = H * 0.5

    if kind == "cobble_lane":
        # Painterly hand-inked beveled cobblestones / stepping stones (100% seamless mod W!)
        if spec.get("bed", True):
            bed_rgb = spec.get("bed_rgb", (92, 82, 68))
            d.rectangle([0, 22, W, H - 22], fill=(*bed_rgb, 255))
            d.line([(0, 22), (W, 22)], fill=INK_MID, width=4)
            d.line([(0, H - 22), (W, H - 22)], fill=INK_MID, width=4)
        n_stones = int(spec.get("stones", 38))
        stepping = bool(spec.get("stepping", False))
        for i in range(n_stones):
            sx = (i + 0.5) * (W / n_stones) + rng.uniform(-12, 12)
            sy = my + (rng.uniform(-22, 22) if stepping else rng.uniform(-H * 0.34, H * 0.34))
            rx = rng.uniform(28, 46) if stepping else rng.uniform(18, 34)
            ry = rng.uniform(22, 34) if stepping else rng.uniform(14, 24)
            scol = vary_rgb(base_rgb, rng, 18)
            for ox in (-W, 0, W):
                d.ellipse([sx + ox - rx, sy - ry, sx + ox + rx, sy + ry], fill=(*scol, 255), outline=INK, width=4)
                d.arc([sx + ox - rx + 5, sy - ry + 5, sx + ox + rx - 5, sy + ry - 5], start=195, end=330, fill=blend_rgb(scol, (242, 238, 228), 0.38), width=4)
                d.arc([sx + ox - rx + 5, sy - ry + 5, sx + ox + rx - 5, sy + ry - 5], start=20, end=155, fill=blend_rgb(scol, (22, 20, 22), 0.42), width=4)
            if spec.get("moss", 0) > 0 and rng.random() < float(spec.get("moss", 0)):
                for ox in (-W, 0, W):
                    d.ellipse([sx + ox + rx * 0.4, sy + ry * 0.3, sx + ox + rx * 0.9, sy + ry * 0.8], fill=(74, 114, 54, 255))

    elif kind == "curb_stone":
        # Beveled granite curb / brick walkway / stone bridge deck / drainage gutter!
        y0, y1 = 18, H - 18
        rows = int(spec.get("rows", 2))
        cols = int(spec.get("cols", 14))
        bw, bh = W / cols, (y1 - y0) / rows
        d.rectangle([0, y0, W, y1], fill=shade_rgb(base_rgb, 0.5))
        for r in range(rows):
            off = (bw * 0.5) if (r % 2 == 1 and rows > 1) else 0.0
            for c in range(-1, cols + 1):
                b_rng = random.Random(seed + r * 73 + (c % cols) * 19)
                draw_stone_block(d, c * bw + off + 2, y0 + r * bh + 2, (c + 1) * bw + off - 2, y0 + (r + 1) * bh - 2, base_rgb, b_rng, ink_w=3, moss=float(spec.get("moss", 0.08)))
        if spec.get("gutter", False):
            d.rectangle([0, y1 - 24, W, y1 - 4], fill=(48, 52, 58, 255), outline=INK, width=3)
            for gx in range(16, W, 32):
                d.line([(gx, y1 - 22), (gx, y1 - 6)], fill=(22, 24, 28, 255), width=4)
        d.line([(0, y0), (W, y0)], fill=INK, width=5)
        d.line([(0, y1), (W, y1)], fill=INK, width=5)

    elif kind == "rail_track":
        # Hand-inked sleepers + ballast + twin gleaming steel/brass rails + optional glowing magirail!
        if spec.get("ballast", True):
            d.rectangle([0, 26, W, H - 26], fill=(104, 98, 90, 255))
            for _ in range(160):
                px, py = rng.uniform(0, W), rng.uniform(32, H - 32)
                pr = rng.uniform(3, 7)
                d.ellipse([px - pr, py - pr, px + pr, py + pr], fill=(*vary_rgb((118, 112, 102), rng, 20), 255))
        n_ties = int(spec.get("ties", 16))
        tw = W / n_ties
        for i in range(n_ties):
            tx = i * tw + tw * 0.5
            draw_wood_planks_box(d, tx - 13, 38, tx + 13, H - 38, trim_rgb, random.Random(seed + i), horizontal=False, n_planks=1, ink_w=3, nails=False)
        rail_y1, rail_y2 = int(H * 0.28), int(H * 0.72)
        for ry in (rail_y1, rail_y2):
            draw_beveled_rect(d, 0, ry - 11, W, ry + 11, base_rgb, ink_w=4, hi_amt=0.45, sh_amt=0.42)
        if spec.get("glow", None):
            gl = spec["glow"]
            add_glow(im, W * 0.5, my, W * 0.6, 26, gl, alpha=110, blur=12)
            d = ImageDraw.Draw(im)
            d.rectangle([0, my - 10, W, my + 10], fill=(*gl, 255), outline=INK, width=4)
            d.line([(0, my - 3), (W, my - 3)], fill=blend_rgb(gl, (255, 255, 255), 0.7), width=3)

    elif kind == "conduit_pipe":
        # Flanged copper/brass/iron pipes or glowing aether conduit cables!
        n_pipes = int(spec.get("pipes", 1))
        glow = spec.get("glow", None)
        if glow:
            gl_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(gl_layer).rectangle([0, my - 34, W, my + 34], fill=(*glow, 90))
            im.alpha_composite(gl_layer.filter(ImageFilter.GaussianBlur(12)))
            d = ImageDraw.Draw(im)
        offsets = [0] if n_pipes == 1 else ([-26, 26] if n_pipes == 2 else [-38, 0, 38])
        r_pipe = 20 if n_pipes == 1 else (15 if n_pipes == 2 else 12)
        for off in offsets:
            py = my + off
            col = glow if glow else base_rgb
            draw_beveled_rect(d, 0, py - r_pipe, W, py + r_pipe, col, ink_w=4, hi_amt=0.52, sh_amt=0.44)
        for fx in range(0, W + 1, W // 8):
            draw_beveled_rect(d, fx - 12, my - (abs(offsets[-1]) + r_pipe + 8), fx + 12, my + (abs(offsets[-1]) + r_pipe + 8), accent_rgb, ink_w=4, radius=4)

    elif kind == "runner_carpet":
        # Rich embroidered royal/parlor/braided carpet runner (with optional colorable red-mask!)
        y0, y1 = 22, H - 22
        draw_beveled_rect(d, 0, y0, W, y1, base_rgb, ink_w=5)
        # Ornate gold/cream border trim bands
        d.rectangle([0, y0 + 14, W, y0 + 28], fill=(*accent_rgb, 255), outline=INK_MID, width=2)
        d.rectangle([0, y1 - 28, W, y1 - 14], fill=(*accent_rgb, 255), outline=INK_MID, width=2)
        # Repeating diamond/filigree woven motifs along centerline!
        n_m = 8
        mw = W / n_m
        for i in range(n_m):
            cx = (i + 0.5) * mw
            d.polygon([(cx, my - 34), (cx + 42, my), (cx, my + 34), (cx - 42, my)], fill=(*accent_rgb, 255), outline=INK, width=3)
            d.polygon([(cx, my - 18), (cx + 22, my), (cx, my + 18), (cx - 22, my)], fill=(*base_rgb, 255), outline=INK_MID, width=2)
            d.ellipse([cx - 6, my - 6, cx + 6, my + 6], fill=blend_rgb(accent_rgb, (255, 245, 200), 0.55), outline=INK, width=2)

    elif kind == "wood_deck":
        # Planked wooden dock / catwalk / rope suspension bridge / boardwalk!
        y0, y1 = 24, H - 24
        n_p = int(spec.get("planks", 22))
        pw = W / n_p
        gap = int(spec.get("gap", 4))
        for i in range(n_p):
            p_rng = random.Random(seed + i * 19)
            draw_wood_planks_box(d, i * pw + gap * 0.5, y0, (i + 1) * pw - gap * 0.5, y1, base_rgb, p_rng, horizontal=False, n_planks=1, ink_w=3, nails=True)
        if spec.get("rails", False):
            draw_beveled_rect(d, 0, y0 - 8, W, y0 + 12, trim_rgb, ink_w=4)
            draw_beveled_rect(d, 0, y1 - 12, W, y1 + 8, trim_rgb, ink_w=4)

    elif kind == "water_stream":
        # Painterly layered translucent stream / rapids / foam wave / waterfall!
        y0, y1 = 18, H - 18
        if not spec.get("foam_only", False):
            d.rectangle([0, y0, W, y1], fill=(*base_rgb, 255))
            # Soft depth bands
            d.rectangle([0, y0 + 26, W, y1 - 26], fill=shade_rgb(base_rgb, 0.84))
            d.line([(0, y0), (W, y0)], fill=blend_rgb(base_rgb, (230, 248, 255), 0.45), width=6)
            d.line([(0, y1), (W, y1)], fill=blend_rgb(base_rgb, (230, 248, 255), 0.45), width=6)
        # Painterly flowing sine foam ribbons (100% periodic mod W!)
        for k in range(int(spec.get("ribbons", 10))):
            ry = rng.uniform(y0 + 16, y1 - 16)
            amp = rng.uniform(6, 16)
            freq = rng.choice([2, 3, 4])
            phase = rng.uniform(0, math.tau)
            col = (242, 250, 255, 255) if k % 2 == 0 else blend_rgb(base_rgb, (232, 248, 255), 0.58)
            pts = [(x, ry + math.sin((x / W) * math.tau * freq + phase) * amp) for x in range(0, W + 16, 16)]
            d.line(pts, fill=col, width=rng.randint(4, 9))

    elif kind == "cliff_embankment":
        # Shaded painterly rock cliff / masonry retaining embankment / grassy slope / snow ridge!
        y0, y1 = 12, H - 12
        sub = spec.get("sub", "rock")
        d.rectangle([0, y0, W, y1], fill=(*base_rgb, 255))
        # Vertical shading gradient (bright upper lip -> shadowed lower drop)
        bands = 14
        for b in range(bands):
            t = b / (bands - 1)
            by0 = y0 + (b / bands) * (y1 - y0)
            by1 = y0 + ((b + 1) / bands) * (y1 - y0) + 1
            col = shade_rgb(base_rgb, 1.18 - t * 0.56)
            d.rectangle([0, by0, W, by1], fill=col)
        if sub == "masonry":
            rows, cols = 4, 10
            bw, bh = W / cols, (y1 - y0) / rows
            for r in range(rows):
                off = (bw * 0.5) if r % 2 == 1 else 0.0
                for c in range(-1, cols + 1):
                    b_rng = random.Random(seed + r * 89 + (c % cols) * 17)
                    draw_stone_block(d, c * bw + off + 2, y0 + r * bh + 2, (c + 1) * bw + off - 2, y0 + (r + 1) * bh - 2, shade_rgb(base_rgb, 1.08 - r * 0.14)[:3], b_rng, ink_w=3, moss=0.22)
        else:
            # Organic vertical rock striation fissures / grass blades!
            n_f = 28
            for i in range(n_f):
                fx = (i + 0.5) * (W / n_f)
                pts = [(fx, y0 + 4)]
                cx = fx
                for step in range(1, 6):
                    cx += rng.uniform(-14, 14)
                    pts.append((cx, y0 + (step / 5) * (y1 - y0)))
                d.line(pts, fill=shade_rgb(base_rgb, 0.48), width=4)
                d.line([(x + 4, y) for x, y in pts], fill=blend_rgb(base_rgb, (238, 232, 222), 0.30), width=2)
        # Crisp sunlit upper rim ridge + dark lower base shadow
        d.line([(0, y0 + 4), (W, y0 + 4)], fill=blend_rgb(base_rgb, (248, 242, 232), 0.42), width=8)
        d.line([(0, y0), (W, y0)], fill=INK, width=6)
        d.line([(0, y1), (W, y1)], fill=INK, width=5)

    elif kind == "garland_festoon":
        # Overhead bunting / Berlin laundry line / café string lights / ivy vine / iron chains / haul cable!
        sub = spec.get("sub", "bunting")
        if sub == "chain":
            n_l = 16
            lw = W / n_l
            for i in range(n_l):
                cx = (i + 0.5) * lw
                if i % 2 == 0:
                    d.rounded_rectangle([cx - lw * 0.46, my - 22, cx + lw * 0.46, my + 22], radius=16, outline=INK, width=14)
                    d.rounded_rectangle([cx - lw * 0.46, my - 22, cx + lw * 0.46, my + 22], radius=16, outline=(*base_rgb, 255), width=7)
                else:
                    draw_beveled_rect(d, cx - lw * 0.38, my - 9, cx + lw * 0.38, my + 9, base_rgb, ink_w=4, radius=6)
        elif sub == "cable":
            d.line([(0, my), (W, my)], fill=INK, width=22)
            d.line([(0, my), (W, my)], fill=(*base_rgb, 255), width=14)
            for sx in range(0, W, 24):
                d.line([(sx, my - 7), (sx + 14, my + 7)], fill=blend_rgb(base_rgb, (235, 240, 246), 0.5), width=4)
        elif sub == "lights":
            d.line([(0, my - 12), (W, my - 12)], fill=INK, width=6)
            gl_c = spec.get("glow", (255, 198, 92))
            for i in range(10):
                lx = (i + 0.5) * (W / 10)
                ly = my + 10 + math.sin(i * 1.1) * 6
                add_glow(im, lx, ly, 36, 36, gl_c, alpha=140, blur=14)
                d = ImageDraw.Draw(im)
                d.line([(lx, my - 12), (lx, ly - 10)], fill=INK, width=4)
                d.ellipse([lx - 13, ly - 13, lx + 13, ly + 13], fill=(*gl_c, 255), outline=INK, width=4)
                d.ellipse([lx - 6, ly - 8, lx + 4, ly + 2], fill=(255, 252, 232, 255))
        elif sub == "vine":
            pts = [(x, my + math.sin((x / W) * math.tau * 3) * 18) for x in range(0, W + 16, 16)]
            d.line(pts, fill=INK, width=14)
            d.line(pts, fill=(64, 96, 46, 255), width=7)
            for i in range(18):
                lx = (i + 0.5) * (W / 18)
                ly = my + math.sin((lx / W) * math.tau * 3) * 18 + rng.uniform(-16, 16)
                draw_foliage_cluster(d, lx, ly, 20, 15, base_rgb, rng, n_leaves=5, blossom_rgb=spec.get("blossom", None), wrap_w=float(W))
        else:
            # Colorful cloth bunting / Berlin hanging laundry garments!
            d.line([(0, my - 26), (W, my - 26)], fill=INK, width=7)
            d.line([(0, my - 26), (W, my - 26)], fill=(176, 158, 126, 255), width=3)
            colors = spec.get("colors", [(184, 52, 54), (218, 174, 62), (56, 108, 156), (234, 224, 204), (72, 128, 76), (138, 68, 124)])
            n_items = 10
            for i in range(n_items):
                cx = (i + 0.5) * (W / n_items)
                col = colors[i % len(colors)]
                if sub == "laundry":
                    gw = rng.randint(24, 38)
                    gh = rng.randint(46, 68)
                    draw_beveled_rect(d, cx - gw, my - 22, cx + gw, my - 22 + gh, col, ink_w=4, radius=6)
                    # Clothespins!
                    for px in (cx - gw * 0.55, cx + gw * 0.55):
                        d.rectangle([px - 4, my - 32, px + 4, my - 18], fill=(168, 122, 72, 255), outline=INK, width=2)
                else:
                    pts = [(cx - 32, my - 24), (cx + 32, my - 24), (cx, my + 48)]
                    d.polygon(pts, fill=(*col, 255), outline=INK)
                    d.line(pts + [pts[0]], fill=INK, width=4)

    elif kind == "flower_border":
        for i in range(16):
            cx = (i + 0.5) * (W / 16)
            draw_foliage_cluster(d, cx, my + rng.uniform(-10, 10), 42, 38, base_rgb, rng, n_leaves=10, blossom_rgb=spec.get("blossom", (226, 98, 134)), wrap_w=float(W))

    elif kind == "dirt_ruts":
        # Feathered packed dirt lane + twin shaded wagon wheel ruts + scattered pebbles!
        y0, y1 = 20, H - 20
        d.rectangle([0, y0, W, y1], fill=(*base_rgb, 255))
        # Twin recessed wagon ruts
        for ry in (my - 38, my + 38):
            d.rectangle([0, ry - 14, W, ry + 14], fill=shade_rgb(base_rgb, 0.72))
            d.line([(0, ry - 14), (W, ry - 14)], fill=blend_rgb(base_rgb, (232, 206, 168), 0.25), width=4)
            d.line([(0, ry + 14), (W, ry + 14)], fill=shade_rgb(base_rgb, 0.56), width=4)
        for _ in range(95):
            px, py = rng.uniform(0, W), rng.uniform(y0 + 10, y1 - 10)
            pr = rng.uniform(3, 8)
            d.ellipse([px - pr, py - pr * 0.8, px + pr, py + pr * 0.8], fill=(*vary_rgb(shade_rgb(base_rgb, 0.82)[:3], rng, 18), 255), outline=INK_MID, width=1)

    elif kind == "rope_fence":
        d.line([(0, my), (W, my)], fill=INK, width=14)
        d.line([(0, my), (W, my)], fill=(*accent_rgb, 255), width=8)
        for sx in range(0, W, 20):
            d.line([(sx, my - 4), (sx + 10, my + 4)], fill=INK_WARM, width=2)
        for i in range(8):
            px = (i + 0.5) * (W / 8)
            d.ellipse([px - 18, my - 18, px + 18, my + 18], fill=(*base_rgb, 255), outline=INK, width=5)
            d.ellipse([px - 8, my - 8, px + 8, my + 8], fill=(*accent_rgb, 255), outline=INK, width=2)

    elif kind == "cracks_fissure":
        pts = [(x, my + math.sin((x / W) * math.tau * 4) * 18 + rng.uniform(-10, 10)) for x in range(0, W + 24, 24)]
        pts[-1] = (W, pts[0][1])
        glow = spec.get("glow", None)
        if glow:
            gl_l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(gl_l).line(pts, fill=(*glow, 130), width=26)
            im.alpha_composite(gl_l.filter(ImageFilter.GaussianBlur(10)))
            d = ImageDraw.Draw(im)
        d.line(pts, fill=INK, width=14)
        d.line(pts, fill=(*(glow or base_rgb), 255), width=6)
        if spec.get("moss", 0) > 0:
            for x, y in pts[::2]:
                draw_foliage_cluster(d, x, y, 16, 12, (74, 114, 54), rng, n_leaves=5, wrap_w=float(W))

    elif kind == "stair_strip":
        # Seamless architectural stair path strip!
        n_steps = int(spec.get("steps", 16))
        sw = W / n_steps
        rail_h = 24
        for i in range(n_steps):
            x0, x1 = i * sw, (i + 1) * sw
            sc = vary_rgb(base_rgb, rng, 8)
            d.rectangle([x0, rail_h, x1, H - rail_h], fill=(*sc, 255))
            d.line([(x0 + 4, rail_h + 2), (x0 + 4, H - rail_h - 2)], fill=blend_rgb(sc, (242, 236, 224), 0.34), width=4)
            d.rectangle([x1 - 12, rail_h, x1, H - rail_h], fill=blend_rgb(sc, (22, 18, 18), 0.46))
            d.line([(x1, rail_h), (x1, H - rail_h)], fill=INK, width=4)
            if spec.get("runner", None):
                rc = spec["runner"]
                d.rectangle([x0, rail_h + 44, x1, H - rail_h - 44], fill=(*rc, 255))
                d.line([(x0 + 4, rail_h + 44), (x0 + 4, H - rail_h - 44)], fill=(*accent_rgb, 255), width=4)
        for ry0, ry1 in ((4, rail_h), (H - rail_h, H - 4)):
            draw_beveled_rect(d, 0, ry0, W, ry1, trim_rgb, ink_w=5)

    return apply_painterly_finish(im, w, h, seed=seed, grain=5.0, periodic_x=True)

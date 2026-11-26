"""Generate crisp 1024x1024 master PNG emblem for Dice Chaos Compass (matching public/icon.svg)."""
from __future__ import annotations
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT_MASTER = ROOT / "src-tauri" / "icons" / "icon.png"

S = 4  # 4x supersampling (4096 -> 1024)
W = 1024 * S
H = 1024 * S
SCALE = W / 64.0


def pt(x: float, y: float) -> tuple[float, float]:
    return (x * SCALE, y * SCALE)


def draw_poly_outline(
    d: ImageDraw.ImageDraw,
    pts: list[tuple[float, float]],
    color: tuple[int, int, int, int],
    width: int,
    dot_vertices: bool = True,
) -> None:
    for i in range(len(pts)):
        d.line([pts[i], pts[(i + 1) % len(pts)]], fill=color, width=width)
    if dot_vertices:
        r = width * 0.46
        for vx, vy in pts:
            d.ellipse([vx - r, vy - r, vx + r, vy + r], fill=color)


def main() -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    # Rounded dark-sapphire app badge
    pad = int(2 * SCALE)
    rad = int(14 * SCALE)
    d.rounded_rectangle([pad, pad, W - pad, H - pad], radius=rad, fill=(10, 13, 21, 255))

    # Radial arcane indigo + warm golden compass halo
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    cx, cy = W * 0.5, H * 0.48
    for r_frac, alpha, col in [
        (0.46, 66, (74, 52, 144)),
        (0.32, 78, (112, 78, 196)),
        (0.20, 68, (229, 169, 60)),
    ]:
        rr = W * r_frac
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(*col, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=92 * S / 4))
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, W - pad, H - pad], radius=rad, fill=255)
    glow_masked = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_masked.paste(glow, (0, 0), mask)
    img = Image.alpha_composite(img, glow_masked)

    d = ImageDraw.Draw(img, "RGBA")

    # Outer slate-indigo border
    d.rounded_rectangle(
        [pad, pad, W - pad, H - pad],
        radius=rad,
        outline=(50, 60, 90, 255),
        width=max(2, int(1.5 * SCALE)),
    )

    # Understated antique-brass outer compass degree bezel + fine degree ticks
    rc_outer = 24.5 * SCALE
    d.ellipse(
        [W / 2 - rc_outer, H / 2 - rc_outer, W / 2 + rc_outer, H / 2 + rc_outer],
        outline=(212, 154, 52, 92),
        width=max(2, int(0.95 * SCALE)),
    )
    rc_inner_ticks = 22.1 * SCALE
    for deg in range(0, 360, 15):
        ang = math.radians(deg)
        is_major = deg % 45 == 0
        r0 = (21.8 if is_major else 22.5) * SCALE
        r1 = 24.1 * SCALE
        x0 = W / 2 + math.cos(ang) * r0
        y0 = H / 2 + math.sin(ang) * r0
        x1 = W / 2 + math.cos(ang) * r1
        y1 = H / 2 + math.sin(ang) * r1
        d.line(
            [(x0, y0), (x1, y1)],
            fill=(216, 158, 56, 108 if is_major else 62),
            width=max(2, int((0.8 if is_major else 0.5) * SCALE)),
        )
    d.ellipse(
        [W / 2 - rc_inner_ticks, H / 2 - rc_inner_ticks, W / 2 + rc_inner_ticks, H / 2 + rc_inner_ticks],
        outline=(205, 148, 48, 46),
        width=max(2, int(0.6 * SCALE)),
    )

    # D20 icosahedron housing behind the compass rose
    outer_hex = [
        pt(32, 8.5),
        pt(52.4, 20.25),
        pt(52.4, 43.75),
        pt(32, 55.5),
        pt(11.6, 43.75),
        pt(11.6, 20.25),
    ]
    d.polygon(outer_hex, fill=(21, 26, 42, 244))

    # Subtle crystalline D20 facet triangle + corner ribs (receded so compass rose pops)
    inner_tri = [pt(32, 16.8), pt(45.2, 39.6), pt(18.8, 39.6)]
    d.polygon(inner_tri, fill=(36, 32, 70, 184))

    rib_col = (210, 150, 46, 68)
    w_rib = max(2, int(0.85 * SCALE))
    ribs = [
        ((52.4, 20.25), (32, 16.8)),
        ((11.6, 20.25), (32, 16.8)),
        ((52.4, 20.25), (45.2, 39.6)),
        ((11.6, 20.25), (18.8, 39.6)),
        ((52.4, 43.75), (45.2, 39.6)),
        ((11.6, 43.75), (18.8, 39.6)),
        ((32, 55.5), (45.2, 39.6)),
        ((32, 55.5), (18.8, 39.6)),
    ]
    for a, b in ribs:
        d.line([pt(*a), pt(*b)], fill=rib_col, width=w_rib)
    draw_poly_outline(d, inner_tri, (212, 152, 48, 84), max(2, int(0.95 * SCALE)), dot_vertices=False)

    gold_hi = (246, 198, 86, 255)
    gold_mid = (232, 172, 54, 255)
    gold_shade = (150, 88, 18, 255)
    north_bright = (255, 245, 198, 255)
    arcane_hi = (212, 192, 255, 255)
    arcane_shade = (102, 66, 194, 255)

    draw_poly_outline(d, outer_hex, gold_hi, max(4, int(2.05 * SCALE)), dot_vertices=True)

    # Delicate inner brass dial circle behind the star points
    rc_dial = 11.2 * SCALE
    d.ellipse(
        [W / 2 - rc_dial, H / 2 - rc_dial, W / 2 + rc_dial, H / 2 + rc_dial],
        outline=(218, 160, 56, 94),
        width=max(2, int(0.85 * SCALE)),
    )

    # 4 Diagonal Intercardinal Compass Points (Arcane Violet Beveled)
    intercardinals = [
        # NE
        ([pt(32, 32), pt(45.2, 18.8), pt(35.6, 32)], arcane_hi),
        ([pt(32, 32), pt(45.2, 18.8), pt(32, 28.4)], arcane_shade),
        # SE
        ([pt(32, 32), pt(45.2, 45.2), pt(32, 35.6)], arcane_hi),
        ([pt(32, 32), pt(45.2, 45.2), pt(35.6, 32)], arcane_shade),
        # SW
        ([pt(32, 32), pt(18.8, 45.2), pt(28.4, 32)], arcane_hi),
        ([pt(32, 32), pt(18.8, 45.2), pt(32, 35.6)], arcane_shade),
        # NW
        ([pt(32, 32), pt(18.8, 18.8), pt(32, 28.4)], arcane_hi),
        ([pt(32, 32), pt(18.8, 18.8), pt(28.4, 32)], arcane_shade),
    ]
    for poly, col in intercardinals:
        d.polygon(poly, fill=col)

    # Soft sculpted drop shadow behind the cardinal gold needles
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow, "RGBA")
    cardinal_silhouettes = [
        [pt(32, 6.0), pt(36.4, 27.6), pt(32, 32), pt(27.6, 27.6)],
        [pt(32, 57.4), pt(36.2, 36.2), pt(32, 32), pt(27.8, 36.2)],
        [pt(56.6, 32), pt(36.2, 36.2), pt(32, 32), pt(36.2, 27.8)],
        [pt(7.4, 32), pt(27.8, 27.8), pt(32, 32), pt(27.8, 36.2)],
    ]
    for poly in cardinal_silhouettes:
        sd.polygon([(x, y + 0.9 * SCALE) for x, y in poly], fill=(5, 7, 15, 175))
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=16 * S / 4))
    img = Image.alpha_composite(img, shadow)
    d = ImageDraw.Draw(img, "RGBA")

    # 4 Bold Cardinal Compass Needles (Classic Two-Tone Beveled Gold)
    cardinal_facets = [
        # North Hero Spire (extra luminous ivory-gold)
        ([pt(32, 6.0), pt(32, 32), pt(27.6, 27.6)], north_bright),
        ([pt(32, 6.0), pt(36.4, 27.6), pt(32, 32)], gold_shade),
        # South
        ([pt(32, 57.4), pt(32, 32), pt(36.2, 36.2)], gold_hi),
        ([pt(32, 57.4), pt(27.8, 36.2), pt(32, 32)], gold_shade),
        # East
        ([pt(56.6, 32), pt(32, 32), pt(36.2, 27.8)], gold_hi),
        ([pt(56.6, 32), pt(36.2, 36.2), pt(32, 32)], gold_shade),
        # West
        ([pt(7.4, 32), pt(32, 32), pt(27.8, 36.2)], gold_mid),
        ([pt(7.4, 32), pt(27.8, 27.8), pt(32, 32)], gold_shade),
    ]
    for poly, col in cardinal_facets:
        d.polygon(poly, fill=col)

    # Center Compass Pivot Jewel (layered obsidian collar + gold ring + luminous core)
    cpx, cpy = pt(32, 32)
    r_collar = 4.9 * SCALE
    r_outer_j = 4.15 * SCALE
    r_inner_j = 1.95 * SCALE
    d.ellipse(
        [cpx - r_collar, cpy - r_collar, cpx + r_collar, cpy + r_collar],
        fill=(14, 17, 28, 220),
    )
    d.ellipse(
        [cpx - r_outer_j, cpy - r_outer_j, cpx + r_outer_j, cpy + r_outer_j],
        fill=(18, 22, 35, 255),
        outline=gold_hi,
        width=max(3, int(1.5 * SCALE)),
    )
    d.ellipse(
        [cpx - r_inner_j, cpy - r_inner_j, cpx + r_inner_j, cpy + r_inner_j],
        fill=north_bright,
    )

    final = img.resize((1024, 1024), Image.Resampling.LANCZOS)
    OUT_MASTER.parent.mkdir(parents=True, exist_ok=True)
    final.save(OUT_MASTER, "PNG")
    print(f"Wrote 1024x1024 master emblem: {OUT_MASTER} ({OUT_MASTER.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

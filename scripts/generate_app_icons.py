"""Generate crisp 1024x1024 master PNG emblem for Dice Chaos Maps (matching public/icon.svg)."""
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


def main() -> None:
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img, "RGBA")

    # Rounded dark-sapphire badge with radial arcane glow
    pad = int(2 * SCALE)
    rad = int(14 * SCALE)
    d.rounded_rectangle([pad, pad, W - pad, H - pad], radius=rad, fill=(14, 18, 28, 255))

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow, "RGBA")
    cx, cy = W * 0.5, H * 0.46
    for r_frac, alpha, col in [
        (0.42, 46, (88, 66, 155)),
        (0.30, 58, (112, 82, 188)),
        (0.18, 52, (229, 169, 60)),
    ]:
        rr = W * r_frac
        gd.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=(*col, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=90 * S / 4))
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, W - pad, H - pad], radius=rad, fill=255)
    glow_masked = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    glow_masked.paste(glow, (0, 0), mask)
    img = Image.alpha_composite(img, glow_masked)

    d = ImageDraw.Draw(img, "RGBA")
    # Outer subtle slate border
    d.rounded_rectangle(
        [pad, pad, W - pad, H - pad],
        radius=rad,
        outline=(48, 57, 84, 255),
        width=max(2, int(1.5 * SCALE)),
    )

    # Subtle cartographer compass ring
    rc = 22 * SCALE
    d.ellipse(
        [W / 2 - rc, H / 2 - rc, W / 2 + rc, H / 2 + rc],
        outline=(229, 169, 60, 48),
        width=max(2, int(0.85 * SCALE)),
    )

    # D20 silhouette hexagon
    outer = [pt(32, 7), pt(54.5, 19.8), pt(54.5, 44.2), pt(32, 57), pt(9.5, 44.2), pt(9.5, 19.8)]
    d.polygon(outer, fill=(28, 34, 51, 255))

    # Central arcane triangle
    inner = [pt(32, 17.5), pt(44.5, 39.2), pt(19.5, 39.2)]
    d.polygon(inner, fill=(224, 212, 252, 238))

    # Facet gold ridges
    gold = (234, 176, 68, 255)
    gold_hi = (248, 208, 112, 255)
    w_outer = max(4, int(2.6 * SCALE))
    w_mid = max(3, int(2.0 * SCALE))
    w_rib = max(3, int(1.7 * SCALE))

    ribs = [
        ((32, 7), (32, 17.5)),
        ((54.5, 19.8), (44.5, 39.2)),
        ((9.5, 19.8), (19.5, 39.2)),
        ((54.5, 19.8), (32, 17.5)),
        ((9.5, 19.8), (32, 17.5)),
        ((54.5, 44.2), (44.5, 39.2)),
        ((9.5, 44.2), (19.5, 39.2)),
        ((32, 57), (44.5, 39.2)),
        ((32, 57), (19.5, 39.2)),
    ]
    for a, b in ribs:
        d.line([pt(*a), pt(*b)], fill=gold, width=w_rib)

    for i in range(len(inner)):
        d.line([inner[i], inner[(i + 1) % len(inner)]], fill=gold_hi, width=w_mid)
    for i in range(len(outer)):
        d.line([outer[i], outer[(i + 1) % len(outer)]], fill=gold_hi, width=w_outer)
    for vx, vy in outer + inner:
        r_dot = w_outer * 0.48
        d.ellipse([vx - r_dot, vy - r_dot, vx + r_dot, vy + r_dot], fill=gold_hi)

    # Cartographer's compass rose star inside central triangle
    star = [
        pt(32, 23.5), pt(34.1, 30.2), pt(39.5, 32.5), pt(34.1, 34.4),
        pt(32, 37.8), pt(29.9, 34.4), pt(24.5, 32.5), pt(29.9, 30.2),
    ]
    d.polygon(star, fill=(59, 42, 107, 196))
    cr = 1.6 * SCALE
    cpx, cpy = pt(32, 32.2)
    d.ellipse([cpx - cr, cpy - cr, cpx + cr, cpy + cr], fill=gold_hi)

    final = img.resize((1024, 1024), Image.Resampling.LANCZOS)
    OUT_MASTER.parent.mkdir(parents=True, exist_ok=True)
    final.save(OUT_MASTER, "PNG")
    print(f"Wrote 1024x1024 master emblem: {OUT_MASTER} ({OUT_MASTER.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

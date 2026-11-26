"""
Dice Chaos Compass — 28-Asset Painterly Grime, Weathering & Surface Aging Overlay Suite

Generates 28 clean-room CC0 feathered alpha overlays in:
  `public/assets/modular-suite-cc0/props/weathering_overlays/`

Specifically engineered to be layered directly ON TOP OF:
  - Streets, cobblestones, train tracks, wooden decks, stone floors & sidewalks
  - Existing placed objects (trams, carts, benches, crates, tables, roofs, machinery!)

Every overlay uses domain-warped multi-octave fBm noise, directional dry-brush grain,
zero-halo alpha falloff (fading smoothly to 0 well inside canvas bounds), and calibrated
translucency so underlying textures and details read naturally through the grime/patina:
  - Group A (10): Ground & Street Dirt, Soot, Axle-Oil, Mud, Silt, Damp, Rust, Scorch & Cracks
  - Group B (6): Curb Moss/Weeds, Lichen Veil, Street Cinder/Grit, Rain Puddle Film,
    Autumn Leaf Drift (transparent!), Crumbled Mortar & Wall-Base Gravel
  - Group C (8): Object-Top Aging Overlays — Dust Film Veil, Scuff & Scratch Patina,
    Soot Smudge Cap, Rust Corrosion Streaks, Copper Verdigris Patina, Water-Ring & Mildew,
    Wispy Dust Cobweb Corner, Chipped-Paint & Road-Spray Speckles
  - Group D (4): Universal Colorable (`dd_red`) Overlays — Grime Wash, Liquid Drip Stain,
    Moss/Mold/Frost Veil, Directional Scuff/Drag Streak Band
"""

from __future__ import annotations

import math
import random
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from harmony_art_engine import (
    MOD_DIR,
    SCRATCH_DIR,
    DD_RED_BASE,
    DD_RED_DEEP,
    DD_RED_HI,
    fbm_periodic,
    periodic_noise,
    blend_rgb,
    vary_rgb,
    upsert_manifest_entries,
    dominant_hex,
)

OUT_DIR = MOD_DIR / "props" / "weathering_overlays"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def smoothstep(edge0: float, edge1: float, x: np.ndarray) -> np.ndarray:
    diff = edge1 - edge0
    if abs(diff) < 1e-6:
        return (x >= edge0).astype(np.float32)
    t = np.clip((x - edge0) / diff, 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def make_grid(h: int, w: int) -> tuple[np.ndarray, np.ndarray]:
    ys = np.linspace(-1.0, 1.0, h, dtype=np.float32)[:, None]
    xs = np.linspace(-1.0, 1.0, w, dtype=np.float32)[None, :]
    return xs, ys


def fbm_warp(h: int, w: int, seed: int, scale_x: int = 4, scale_y: int = 4) -> np.ndarray:
    """Organic domain-warped fBm field in [0, 1] for painterly washes & stains."""
    n1 = fbm_periodic(
        h, w,
        ((scale_y, scale_x, 0.50), (scale_y * 2, scale_x * 2, 0.30), (scale_y * 4, scale_x * 4, 0.14), (scale_y * 8, scale_x * 8, 0.06)),
        seed=seed,
    )
    n2 = fbm_periodic(
        h, w,
        ((scale_y + 1, scale_x + 1, 0.55), (scale_y * 3, scale_x * 3, 0.30), (scale_y * 6, scale_x * 6, 0.15)),
        seed=seed + 701,
    )
    return np.clip(n1 * 0.65 + n2 * 0.35, 0.0, 1.0)


def edge_feather(h: int, w: int, margin_x: float = 0.14, margin_y: float = 0.14) -> np.ndarray:
    """Guarantees alpha smoothly hits 0 well before all 4 canvas edges (zero box seams!)."""
    xs, ys = make_grid(h, w)
    fx = smoothstep(1.0, 1.0 - margin_x * 2.0, np.abs(xs))
    fy = smoothstep(1.0, 1.0 - margin_y * 2.0, np.abs(ys))
    return fx * fy


def finalize_rgba(rgb: np.ndarray, alpha: np.ndarray) -> Image.Image:
    """Packs float RGB [0..255] + float alpha [0..255] into clean halo-free RGBA."""
    a = np.clip(alpha, 0.0, 255.0)
    out = np.zeros((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
    mask = a >= 1.5
    out[:, :, 0] = np.where(mask, np.clip(rgb[:, :, 0], 0, 255), 0).astype(np.uint8)
    out[:, :, 1] = np.where(mask, np.clip(rgb[:, :, 1], 0, 255), 0).astype(np.uint8)
    out[:, :, 2] = np.where(mask, np.clip(rgb[:, :, 2], 0, 255), 0).astype(np.uint8)
    out[:, :, 3] = np.where(mask, a, 0).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def paint_wash_array(
    h: int,
    w: int,
    seed: int,
    col_core: tuple[int, int, int],
    col_mid: tuple[int, int, int],
    col_edge: tuple[int, int, int],
    max_alpha: float,
    elong_x: float = 1.0,
    elong_y: float = 1.0,
    cutoff_lo: float = 0.24,
    cutoff_hi: float = 0.72,
    speckle_amt: float = 0.0,
) -> tuple[np.ndarray, np.ndarray]:
    xs, ys = make_grid(h, w)
    dist = np.sqrt((xs / elong_x) ** 2 + (ys / elong_y) ** 2)
    radial = smoothstep(0.98, 0.12, dist)
    n = fbm_warp(h, w, seed, scale_x=max(3, w // 64), scale_y=max(3, h // 64))
    fine = periodic_noise(h, w, min(h, 64), min(w, 64), seed + 333)
    field = radial * (0.48 + 0.78 * n) + (fine - 0.5) * 0.14
    mask = smoothstep(cutoff_lo, cutoff_hi, field) * edge_feather(h, w, 0.10, 0.10)

    # Rich 3-stop painterly pigment blending
    t1 = smoothstep(0.25, 0.65, n)
    t2 = smoothstep(0.50, 0.90, field)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    for c in range(3):
        base = col_edge[c] * (1.0 - t1) + col_mid[c] * t1
        rgb[:, :, c] = base * (1.0 - t2) + col_core[c] * t2 + (fine - 0.5) * 18.0

    alpha = mask * max_alpha
    if speckle_amt > 0:
        rng = np.random.default_rng(seed + 999)
        sp = rng.random((h, w)).astype(np.float32)
        dots = (sp > (1.0 - speckle_amt)) & (radial > 0.18)
        alpha = np.where(dots, np.minimum(235.0, alpha + 95.0), alpha)
        for c in range(3):
            rgb[:, :, c] = np.where(dots, col_core[c] * 0.82, rgb[:, :, c])
    return rgb, alpha


def composite_layer(base_im: Image.Image, overlay_im: Image.Image) -> Image.Image:
    out = base_im.copy()
    out.alpha_composite(overlay_im)
    return out


# =============================================================================
# GROUP A (10): GROUND & STREET DIRT, SOOT, OIL, MUD, SILT, DAMP, RUST & CRACKS
# =============================================================================
def gen_grime_dust_wash_lg() -> Image.Image:
    w, h = 320, 256
    rgb, a = paint_wash_array(
        h, w, seed=101,
        col_core=(46, 40, 34),
        col_mid=(76, 68, 58),
        col_edge=(108, 98, 84),
        max_alpha=148.0,
        elong_x=0.96, elong_y=0.90,
        cutoff_lo=0.22, cutoff_hi=0.76,
        speckle_amt=0.012,
    )
    im = finalize_rgba(rgb, a)
    # Subtle fine grit grains inside the dusty wash
    d = ImageDraw.Draw(im)
    rng = random.Random(101)
    for _ in range(95):
        px = rng.gauss(w * 0.5, w * 0.22)
        py = rng.gauss(h * 0.5, h * 0.20)
        if 18 < px < w - 18 and 18 < py < h - 18:
            r = rng.uniform(0.8, 2.3)
            c = vary_rgb((62, 54, 44), rng, 18)
            d.ellipse([px - r, py - r, px + r, py + r], fill=(*c, rng.randint(65, 130)))
    return im


def gen_soot_cinder_smear_band() -> Image.Image:
    w, h = 352, 160
    xs, ys = make_grid(h, w)
    # Stretched longitudinal band along track beds / curbs / chimneys
    n_long = fbm_periodic(h, w, ((3, 2, 0.50), (6, 4, 0.32), (14, 10, 0.18)), seed=202)
    n_streaks = fbm_periodic(h, w, ((14, 3, 0.55), (28, 6, 0.30), (48, 12, 0.15)), seed=209)
    band = smoothstep(0.95, 0.12, np.abs(ys + (n_long - 0.5) * 0.28) / 0.72)
    x_fade = smoothstep(0.98, 0.45, np.abs(xs))
    field = band * x_fade * (0.40 + 0.75 * n_streaks)
    mask = smoothstep(0.18, 0.72, field) * edge_feather(h, w, 0.08, 0.12)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    core = (22, 20, 22)
    mid = (46, 42, 40)
    for c in range(3):
        rgb[:, :, c] = mid[c] * (1.0 - mask) + core[c] * mask + (n_streaks - 0.5) * 14.0
    im = finalize_rgba(rgb, mask * 178.0)
    # Tiny cinder specks
    d = ImageDraw.Draw(im)
    rng = random.Random(202)
    for _ in range(110):
        px = rng.uniform(w * 0.10, w * 0.90)
        py = rng.gauss(h * 0.5, h * 0.18)
        if 14 < py < h - 14:
            r = rng.uniform(0.8, 2.0)
            c = vary_rgb((34, 30, 30), rng, 14)
            d.ellipse([px - r, py - r, px + r, py + r], fill=(*c, rng.randint(80, 155)))
    return im


def gen_axle_grease_oil_drip_strip() -> Image.Image:
    w, h = 320, 144
    xs, ys = make_grid(h, w)
    n = fbm_warp(h, w, seed=303, scale_x=4, scale_y=5)
    # Central greasy drip ribbon with pooled blobs along track center!
    center_env = smoothstep(0.82, 0.05, np.abs(ys + (n - 0.5) * 0.24) / 0.58)
    x_env = smoothstep(0.96, 0.52, np.abs(xs))
    blobs = np.zeros((h, w), dtype=np.float32)
    rng = random.Random(303)
    for cx_n in [-0.58, -0.22, 0.08, 0.36, 0.62]:
        cy_n = rng.uniform(-0.16, 0.16)
        rx = rng.uniform(0.14, 0.26)
        ry = rng.uniform(0.22, 0.38)
        d2 = ((xs - cx_n) / rx) ** 2 + ((ys - cy_n) / ry) ** 2
        blobs = np.maximum(blobs, smoothstep(1.1, 0.08, np.sqrt(d2)))

    field = np.maximum(center_env * x_env * (0.45 + 0.65 * n), blobs * (0.55 + 0.60 * n))
    mask = smoothstep(0.24, 0.72, field) * edge_feather(h, w, 0.08, 0.12)
    # Dark glossy machine oil + subtle iridescent teal/violet specular shimmer!
    sheen = smoothstep(0.52, 0.85, n) * smoothstep(0.35, 0.75, mask)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    rgb[:, :, 0] = 24.0 * (1.0 - sheen) + 56.0 * sheen
    rgb[:, :, 1] = 22.0 * (1.0 - sheen) + 64.0 * sheen
    rgb[:, :, 2] = 20.0 * (1.0 - sheen) + 74.0 * sheen
    return finalize_rgba(rgb, mask * 188.0)


def gen_oil_slick_stain_organic() -> Image.Image:
    w, h = 240, 208
    xs, ys = make_grid(h, w)
    n = fbm_warp(h, w, seed=404, scale_x=4, scale_y=4)
    n2 = fbm_periodic(h, w, ((5, 5, 0.6), (12, 12, 0.4)), seed=417)
    dist = np.sqrt((xs / 0.86) ** 2 + (ys / 0.80) ** 2)
    field = smoothstep(1.02, 0.14, dist + (n - 0.5) * 0.42)
    # Add 2 organic satellite drip drops
    for cx, cy, rr in [(-0.56, 0.46, 0.20), (0.58, -0.38, 0.16), (0.44, 0.50, 0.13)]:
        dd = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / rr
        field = np.maximum(field, smoothstep(1.05, 0.25, dd + (n2 - 0.5) * 0.35))
    mask = smoothstep(0.18, 0.65, field) * edge_feather(h, w, 0.10, 0.10)
    # Painterly dark oil with thin petrol-rainbow highlight bands
    phase = (n * 5.0 + n2 * 3.0) * math.pi
    irid_w = smoothstep(0.35, 0.85, mask) * 0.38
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    rgb[:, :, 0] = 22.0 + irid_w * (48.0 + 36.0 * np.sin(phase))
    rgb[:, :, 1] = 20.0 + irid_w * (54.0 + 34.0 * np.sin(phase + 2.1))
    rgb[:, :, 2] = 24.0 + irid_w * (66.0 + 42.0 * np.sin(phase + 4.2))
    return finalize_rgba(rgb, mask * 204.0)


def gen_muddy_wheel_track_smear() -> Image.Image:
    w, h = 352, 160
    xs, ys = make_grid(h, w)
    n = fbm_warp(h, w, seed=505, scale_x=5, scale_y=4)
    # Twin muddy wagon/cart wheel ruts with spatters along outer edges
    rut1 = smoothstep(0.32, 0.03, np.abs(ys + 0.36 + (n - 0.5) * 0.10))
    rut2 = smoothstep(0.32, 0.03, np.abs(ys - 0.36 + (n - 0.5) * 0.10))
    x_env = smoothstep(0.96, 0.48, np.abs(xs))
    field = np.maximum(rut1, rut2) * x_env * (0.45 + 0.72 * n)
    mask = smoothstep(0.16, 0.66, field) * edge_feather(h, w, 0.08, 0.10)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    dark_mud = (54, 40, 28)
    dry_mud = (96, 76, 54)
    for c in range(3):
        rgb[:, :, c] = dry_mud[c] * (1.0 - mask) + dark_mud[c] * mask + (n - 0.5) * 20.0
    im = finalize_rgba(rgb, mask * 172.0)
    d = ImageDraw.Draw(im)
    rng = random.Random(505)
    for _ in range(70):
        px = rng.uniform(w * 0.10, w * 0.90)
        py = rng.choice([h * 0.32, h * 0.68]) + rng.gauss(0, h * 0.11)
        if 12 < py < h - 12:
            r = rng.uniform(1.0, 2.8)
            c = vary_rgb((66, 48, 32), rng, 15)
            d.ellipse([px - r, py - r, px + r, py + r], fill=(*c, rng.randint(70, 145)))
    return im


def gen_gutter_silt_runoff_streak() -> Image.Image:
    w, h = 320, 144
    xs, ys = make_grid(h, w)
    n = fbm_periodic(h, w, ((4, 2, 0.50), (10, 5, 0.32), (24, 12, 0.18)), seed=606)
    # Asymmetric curb-edge accumulation: denser along top edge (curb side), feathering softly out into road
    curb_bias = smoothstep(0.85, -0.55, ys) * smoothstep(-0.98, -0.58, ys)
    x_fade = smoothstep(0.96, 0.42, np.abs(xs))
    field = curb_bias * x_fade * (0.45 + 0.75 * n)
    mask = smoothstep(0.14, 0.65, field) * edge_feather(h, w, 0.08, 0.10)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    silt_dk = (52, 48, 40)
    silt_lt = (94, 86, 72)
    for c in range(3):
        rgb[:, :, c] = silt_lt[c] * (1.0 - mask) + silt_dk[c] * mask + (n - 0.5) * 18.0
    return finalize_rgba(rgb, mask * 162.0)


def gen_damp_seepage_stain_lg() -> Image.Image:
    w, h = 288, 240
    rgb, a = paint_wash_array(
        h, w, seed=707,
        col_core=(24, 30, 32),
        col_mid=(38, 46, 46),
        col_edge=(56, 62, 58),
        max_alpha=128.0,
        elong_x=0.92, elong_y=0.88,
        cutoff_lo=0.20, cutoff_hi=0.74,
    )
    return finalize_rgba(rgb, a)


def gen_rust_oxide_runoff_stain() -> Image.Image:
    w, h = 240, 192
    rgb, a = paint_wash_array(
        h, w, seed=808,
        col_core=(108, 44, 22),
        col_mid=(146, 68, 32),
        col_edge=(162, 92, 48),
        max_alpha=162.0,
        elong_x=0.92, elong_y=0.84,
        cutoff_lo=0.22, cutoff_hi=0.72,
        speckle_amt=0.015,
    )
    return finalize_rgba(rgb, a)


def gen_scorch_aether_arc_burn() -> Image.Image:
    w, h = 224, 208
    xs, ys = make_grid(h, w)
    n = fbm_warp(h, w, seed=909, scale_x=4, scale_y=4)
    dist = np.sqrt((xs / 0.85) ** 2 + (ys / 0.85) ** 2)
    outer = smoothstep(0.95, 0.16, dist + (n - 0.5) * 0.35)
    core = smoothstep(0.45, 0.04, dist + (n - 0.5) * 0.18)
    mask = smoothstep(0.18, 0.70, outer) * edge_feather(h, w, 0.10, 0.10)
    # Smoky char with faint magipunk cyan-ash ionized rim in the center
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    rgb[:, :, 0] = 28.0 * (1.0 - core) + 52.0 * core
    rgb[:, :, 1] = 26.0 * (1.0 - core) + 74.0 * core
    rgb[:, :, 2] = 28.0 * (1.0 - core) + 84.0 * core
    return finalize_rgba(rgb, mask * 184.0)


def gen_tar_cobble_crack_network() -> Image.Image:
    w, h = 288, 224
    # Render 2x supersampled branching weathered tar-filled pavement fissure + pale chipped stone rims!
    W, H = w * 2, h * 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Faint dusty fracture halo first
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    d = ImageDraw.Draw(im)

    rng = random.Random(1010)

    def draw_fissure(pts: list[tuple[float, float]], width: int, tar_alpha: int) -> None:
        # Chipped pale stone bevel along top-left edge
        hi_pts = [(x - 2.5, y - 2.5) for x, y in pts]
        hd.line(hi_pts, fill=(148, 142, 132, 82), width=width + 5, joint="curve")
        # Dark dusty smudge around the fissure
        hd.line(pts, fill=(32, 28, 26, 95), width=width + 14, joint="curve")
        # Deep tar-sealed crack core
        d.line(pts, fill=(22, 19, 18, tar_alpha), width=width, joint="curve")
        # Secondary glossy pitch glint inside widest cracks
        if width >= 5:
            d.line([(x + 1, y + 1) for x, y in pts], fill=(42, 38, 36, min(200, tar_alpha)), width=max(2, width - 3))

    def jitter_polyline(x0, y0, x1, y1, steps, spread) -> list[tuple[float, float]]:
        pts = [(x0, y0)]
        for i in range(1, steps):
            t = i / steps
            px = x0 + (x1 - x0) * t + rng.uniform(-spread, spread)
            py = y0 + (y1 - y0) * t + rng.uniform(-spread, spread)
            pts.append((px, py))
        pts.append((x1, y1))
        return pts

    main_crack = jitter_polyline(W * 0.12, H * 0.54, W * 0.88, H * 0.44, 14, 18)
    branch1 = jitter_polyline(main_crack[4][0], main_crack[4][1], W * 0.34, H * 0.16, 7, 14)
    branch2 = jitter_polyline(main_crack[8][0], main_crack[8][1], W * 0.68, H * 0.84, 7, 14)
    branch3 = jitter_polyline(main_crack[10][0], main_crack[10][1], W * 0.78, H * 0.22, 5, 11)
    twig1 = jitter_polyline(branch1[3][0], branch1[3][1], W * 0.18, H * 0.28, 4, 9)
    twig2 = jitter_polyline(branch2[3][0], branch2[3][1], W * 0.48, H * 0.78, 4, 9)

    draw_fissure(main_crack, 7, 215)
    draw_fissure(branch1, 5, 195)
    draw_fissure(branch2, 5, 190)
    draw_fissure(branch3, 4, 175)
    draw_fissure(twig1, 3, 155)
    draw_fissure(twig2, 3, 150)

    # Small chipped gravel specks along the crack
    for x, y in main_crack[2:-2] + branch1[1:-1] + branch2[1:-1]:
        for _ in range(3):
            sx = x + rng.uniform(-22, 22)
            sy = y + rng.uniform(-22, 22)
            r = rng.uniform(1.5, 4.2)
            c = vary_rgb((88, 82, 74), rng, 18)
            d.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(*c, rng.randint(100, 175)))

    out = halo.filter(ImageFilter.GaussianBlur(7.0))
    out.alpha_composite(im)
    return out.resize((w, h), Image.Resampling.LANCZOS)


# =============================================================================
# GROUP B (6): CURB MOSS/WEEDS, LICHEN, GRIT/LITTER, PUDDLE FILM, LEAVES, MORTAR
# =============================================================================
def gen_curb_moss_weed_tufts() -> Image.Image:
    w, h = 288, 144
    W, H = w * 2, h * 2
    # Soft mossy damp base band first
    xs, ys = make_grid(H, W)
    n = fbm_warp(H, W, seed=1111, scale_x=5, scale_y=4)
    band = smoothstep(0.68, 0.08, np.abs(ys + (n - 0.5) * 0.24) / 0.52) * smoothstep(0.95, 0.45, np.abs(xs))
    mask = smoothstep(0.22, 0.72, band * (0.45 + 0.75 * n)) * edge_feather(H, W, 0.08, 0.12)
    rgb = np.zeros((H, W, 3), dtype=np.float32)
    m_dk = (52, 72, 36)
    m_lt = (92, 114, 54)
    for c in range(3):
        rgb[:, :, c] = m_dk[c] * (1.0 - n) + m_lt[c] * n
    im = finalize_rgba(rgb, mask * 170.0)

    # Painterly tiny tufted grass blades & 2 tiny yellow curb-crack dandelion specks!
    d = ImageDraw.Draw(im)
    rng = random.Random(1111)
    for cx_f in [0.18, 0.34, 0.48, 0.64, 0.80]:
        cx = W * cx_f + rng.uniform(-16, 16)
        cy = H * 0.50 + rng.uniform(-22, 22)
        # Moss cushion blobs
        for _ in range(9):
            mx = cx + rng.uniform(-26, 26)
            my = cy + rng.uniform(-18, 18)
            rr = rng.uniform(6, 15)
            col = vary_rgb((78, 102, 46), rng, 18)
            d.ellipse([mx - rr, my - rr * 0.8, mx + rr, my + rr * 0.8], fill=(*col, rng.randint(155, 220)))
        # Tiny grass blades radiating from the crack
        for _ in range(11):
            ang = rng.uniform(0, math.tau)
            bl = rng.uniform(10, 24)
            col = vary_rgb((108, 134, 58), rng, 20)
            d.line([(cx, cy), (cx + math.cos(ang) * bl, cy + math.sin(ang) * bl)], fill=(*col, 215), width=rng.randint(2, 4))
        if rng.random() < 0.45:
            d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=(224, 188, 62, 215))
    return im.resize((w, h), Image.Resampling.LANCZOS)


def gen_damp_lichen_moss_film() -> Image.Image:
    w, h = 256, 224
    rgb, a = paint_wash_array(
        h, w, seed=1212,
        col_core=(68, 86, 48),
        col_mid=(106, 122, 74),
        col_edge=(138, 146, 98),
        max_alpha=155.0,
        elong_x=0.90, elong_y=0.88,
        cutoff_lo=0.28, cutoff_hi=0.72,
        speckle_amt=0.018,
    )
    return finalize_rgba(rgb, a)


def gen_street_grit_cinder_scatter() -> Image.Image:
    w, h = 256, 208
    W, H = w * 2, h * 2
    rgb, a = paint_wash_array(
        H, W, seed=1313,
        col_core=(54, 48, 42),
        col_mid=(84, 76, 66),
        col_edge=(110, 102, 90),
        max_alpha=95.0,
        elong_x=0.92, elong_y=0.86,
        cutoff_lo=0.25, cutoff_hi=0.75,
    )
    im = finalize_rgba(rgb, a)
    d = ImageDraw.Draw(im)
    rng = random.Random(1313)
    # Scattered fine gravel, coal cinders & 3 tiny crumpled newspaper/ticket scraps!
    for _ in range(180):
        px = rng.gauss(W * 0.5, W * 0.21)
        py = rng.gauss(H * 0.5, H * 0.19)
        if 26 < px < W - 26 and 26 < py < H - 26:
            r = rng.uniform(1.8, 5.2)
            base = rng.choice([(44, 40, 38), (88, 82, 74), (118, 110, 98), (62, 54, 46)])
            c = vary_rgb(base, rng, 14)
            d.ellipse([px - r, py - r * 0.75, px + r, py + r * 0.75], fill=(*c, rng.randint(145, 225)))
    # Tiny weathered paper/ticket scraps caught in grit
    for _ in range(4):
        px = rng.uniform(W * 0.22, W * 0.78)
        py = rng.uniform(H * 0.24, H * 0.76)
        ang = rng.uniform(0, math.tau)
        pts = [
            (px + math.cos(ang + k * 1.57) * rng.uniform(7, 13), py + math.sin(ang + k * 1.57) * rng.uniform(6, 11))
            for k in range(4)
        ]
        d.polygon(pts, fill=(214, 204, 182, 185), outline=(68, 60, 52, 150))
    return im.resize((w, h), Image.Resampling.LANCZOS)


def gen_puddle_rain_film_sheen() -> Image.Image:
    w, h = 288, 208
    xs, ys = make_grid(h, w)
    n = fbm_warp(h, w, seed=1414, scale_x=4, scale_y=4)
    dist = np.sqrt((xs / 0.88) ** 2 + (ys / 0.80) ** 2)
    shape = smoothstep(0.98, 0.22, dist + (n - 0.5) * 0.44)
    # Damp darkened wet ring extending slightly past the water film!
    wet_rim = smoothstep(0.14, 0.45, shape) * (1.0 - smoothstep(0.45, 0.70, shape))
    water = smoothstep(0.42, 0.68, shape)
    # Subtle sky reflection sheen inside the water film
    sky_grad = np.clip(0.5 - xs * 0.28 - ys * 0.32 + (n - 0.5) * 0.25, 0.0, 1.0)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    # Dark murky water with cool steel-blue dusk sky glint (lets underlying cobbles show through!)
    rgb[:, :, 0] = (24.0 * wet_rim + (46.0 + 58.0 * sky_grad) * water) / np.maximum(0.01, wet_rim + water)
    rgb[:, :, 1] = (28.0 * wet_rim + (62.0 + 66.0 * sky_grad) * water) / np.maximum(0.01, wet_rim + water)
    rgb[:, :, 2] = (32.0 * wet_rim + (78.0 + 72.0 * sky_grad) * water) / np.maximum(0.01, wet_rim + water)
    alpha = (wet_rim * 96.0 + water * (112.0 + 46.0 * sky_grad)) * edge_feather(h, w, 0.09, 0.09)
    return finalize_rgba(rgb, alpha)


def gen_autumn_leaves_curb_drift() -> Image.Image:
    w, h = 288, 176
    W, H = w * 2, h * 2
    # 100% transparent feathered subtle damp-dust shadow under leaves (NO opaque gray blob!)
    rgb, a = paint_wash_array(
        H, W, seed=1515,
        col_core=(52, 42, 32),
        col_mid=(76, 62, 46),
        col_edge=(96, 80, 62),
        max_alpha=68.0,
        elong_x=0.90, elong_y=0.72,
        cutoff_lo=0.28, cutoff_hi=0.78,
    )
    im = finalize_rgba(rgb, a)
    d = ImageDraw.Draw(im)
    rng = random.Random(1515)
    leaf_palette = [
        (168, 92, 42),
        (188, 124, 48),
        (146, 64, 34),
        (132, 86, 44),
        (198, 152, 58),
        (108, 72, 42),
    ]
    # 44 hand-painted curved autumn leaves + twigs in wind-blown crescent drift
    for _ in range(44):
        t = rng.uniform(-0.82, 0.82)
        cx = W * (0.5 + t * 0.44) + rng.gauss(0, 22)
        cy = H * (0.5 + 0.12 * math.sin(t * 2.5)) + rng.gauss(0, H * 0.16)
        if not (34 < cx < W - 34 and 28 < cy < H - 28):
            continue
        ang = rng.uniform(0, math.tau)
        ll = rng.uniform(13, 24)
        lw = ll * rng.uniform(0.42, 0.62)
        ca, sa = math.cos(ang), math.sin(ang)
        pts = [
            (cx - ca * ll * 0.55, cy - sa * ll * 0.55),
            (cx - sa * lw * 0.55, cy + ca * lw * 0.55),
            (cx + ca * ll * 0.55, cy + sa * ll * 0.55),
            (cx + sa * lw * 0.55, cy - ca * lw * 0.55),
        ]
        col = vary_rgb(rng.choice(leaf_palette), rng, 14)
        out_c = blend_rgb(col, (26, 20, 16), 0.58)
        d.polygon(pts, fill=(*col, rng.randint(195, 242)))
        d.line(pts + [pts[0]], fill=(out_c[0], out_c[1], out_c[2], 195), width=2)
        # Midrib vein
        d.line([pts[0], pts[2]], fill=(out_c[0], out_c[1], out_c[2], 140), width=2)
    return im.resize((w, h), Image.Resampling.LANCZOS)


def gen_crumbled_mortar_gravel_edge() -> Image.Image:
    w, h = 288, 144
    W, H = w * 2, h * 2
    xs, ys = make_grid(H, W)
    n = fbm_warp(H, W, seed=1616, scale_x=5, scale_y=4)
    band = smoothstep(0.80, -0.45, ys) * smoothstep(-0.95, -0.52, ys) * smoothstep(0.95, 0.45, np.abs(xs))
    mask = smoothstep(0.16, 0.66, band * (0.48 + 0.70 * n)) * edge_feather(H, W, 0.08, 0.10)
    rgb = np.zeros((H, W, 3), dtype=np.float32)
    for c, v in enumerate((126, 118, 106)):
        rgb[:, :, c] = v + (n - 0.5) * 34.0
    im = finalize_rgba(rgb, mask * 145.0)
    d = ImageDraw.Draw(im)
    rng = random.Random(1616)
    # Chipped limestone & brick crumbs along a building wall base or curb!
    for _ in range(95):
        px = rng.uniform(W * 0.08, W * 0.92)
        py = rng.uniform(H * 0.14, H * 0.62)
        r = rng.uniform(2.5, 8.0)
        base = rng.choice([(138, 130, 118), (112, 106, 98), (146, 86, 68), (94, 88, 82)])
        col = vary_rgb(base, rng, 14)
        out_c = blend_rgb(col, (28, 24, 22), 0.55)
        d.polygon(
            [(px - r, py - r * 0.5), (px + r * 0.4, py - r * 0.8), (px + r, py + r * 0.3), (px - r * 0.3, py + r * 0.8)],
            fill=(*col, rng.randint(165, 232)),
            outline=(out_c[0], out_c[1], out_c[2], 180),
        )
    return im.resize((w, h), Image.Resampling.LANCZOS)


# =============================================================================
# GROUP C (8): OBJECT-TOP AGING, SCUFF, DUST, SOOT, RUST, VERDIGRIS & PATINA
# =============================================================================
def gen_obj_dust_film_veil() -> Image.Image:
    w, h = 224, 224
    rgb, a = paint_wash_array(
        h, w, seed=1717,
        col_core=(168, 158, 140),
        col_mid=(146, 138, 122),
        col_edge=(122, 114, 102),
        max_alpha=112.0,
        elong_x=0.92, elong_y=0.92,
        cutoff_lo=0.20, cutoff_hi=0.78,
        speckle_amt=0.008,
    )
    return finalize_rgba(rgb, a)


def gen_obj_scuff_scratch_patina() -> Image.Image:
    w, h = 240, 192
    W, H = w * 2, h * 2
    rgb, a = paint_wash_array(
        H, W, seed=1818,
        col_core=(46, 38, 32),
        col_mid=(76, 66, 56),
        col_edge=(106, 94, 80),
        max_alpha=92.0,
        elong_x=0.90, elong_y=0.84,
        cutoff_lo=0.25, cutoff_hi=0.76,
    )
    im = finalize_rgba(rgb, a)
    d = ImageDraw.Draw(im)
    rng = random.Random(1818)
    # Directional surface wear scratches (both dark gouges & pale worn wood/paint highlights!)
    for _ in range(52):
        cx = rng.gauss(W * 0.5, W * 0.21)
        cy = rng.gauss(H * 0.5, H * 0.19)
        if not (36 < cx < W - 36 and 32 < cy < H - 32):
            continue
        ang = rng.gauss(-0.35, 0.45)
        ln = rng.uniform(14, 48)
        x0, y0 = cx - math.cos(ang) * ln * 0.5, cy - math.sin(ang) * ln * 0.5
        x1, y1 = cx + math.cos(ang) * ln * 0.5, cy + math.sin(ang) * ln * 0.5
        if rng.random() < 0.55:
            # Dark boot/tool scuff
            d.line([(x0, y0), (x1, y1)], fill=(38, 30, 26, rng.randint(85, 165)), width=rng.randint(2, 5))
        else:
            # Pale chipped paint / raw wood scratch
            d.line([(x0, y0), (x1, y1)], fill=(198, 184, 158, rng.randint(85, 155)), width=rng.randint(2, 4))
    return im.resize((w, h), Image.Resampling.LANCZOS)


def gen_obj_soot_smudge_cap() -> Image.Image:
    w, h = 224, 192
    rgb, a = paint_wash_array(
        h, w, seed=1919,
        col_core=(18, 16, 18),
        col_mid=(38, 35, 36),
        col_edge=(62, 58, 58),
        max_alpha=162.0,
        elong_x=0.90, elong_y=0.82,
        cutoff_lo=0.20, cutoff_hi=0.74,
    )
    return finalize_rgba(rgb, a)


def gen_obj_rust_patina_streaks() -> Image.Image:
    w, h = 224, 192
    xs, ys = make_grid(h, w)
    # Directional fine rust streaks + pitting flakes for metal fixtures/tram roofs/plates
    n_dir = fbm_periodic(h, w, ((4, 10, 0.52), (8, 22, 0.30), (16, 44, 0.18)), seed=2020)
    n_blot = fbm_warp(h, w, seed=2025, scale_x=4, scale_y=4)
    dist = np.sqrt((xs / 0.88) ** 2 + (ys / 0.82) ** 2)
    field = smoothstep(0.96, 0.12, dist) * (0.35 + 0.55 * n_dir + 0.40 * n_blot)
    mask = smoothstep(0.26, 0.72, field) * edge_feather(h, w, 0.10, 0.10)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    r_dk = (92, 34, 16)
    r_hi = (168, 78, 32)
    for c in range(3):
        rgb[:, :, c] = r_dk[c] * (1.0 - n_dir) + r_hi[c] * n_dir
    return finalize_rgba(rgb, mask * 176.0)


def gen_obj_verdigris_copper_patina() -> Image.Image:
    w, h = 224, 192
    rgb, a = paint_wash_array(
        h, w, seed=2121,
        col_core=(54, 118, 106),
        col_mid=(84, 152, 134),
        col_edge=(118, 174, 154),
        max_alpha=152.0,
        elong_x=0.90, elong_y=0.84,
        cutoff_lo=0.26, cutoff_hi=0.72,
        speckle_amt=0.012,
    )
    return finalize_rgba(rgb, a)


def gen_obj_water_ring_mildew() -> Image.Image:
    w, h = 208, 208
    xs, ys = make_grid(h, w)
    n = fbm_warp(h, w, seed=2222, scale_x=4, scale_y=4)
    # Overlapping dried water-stain rings & damp mildew halos (great on tables, wood decks, crates!)
    rings = np.zeros((h, w), dtype=np.float32)
    for cx, cy, rr in [(-0.18, -0.10, 0.44), (0.26, 0.18, 0.34), (-0.08, 0.30, 0.24)]:
        d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
        ring = np.exp(-((d - rr + (n - 0.5) * 0.08) ** 2) / (2 * 0.055 ** 2))
        inner = smoothstep(rr + 0.04, rr * 0.3, d) * 0.35
        rings = np.maximum(rings, np.maximum(ring * 0.95, inner))
    mask = np.clip(rings * (0.55 + 0.65 * n), 0.0, 1.0) * edge_feather(h, w, 0.12, 0.12)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    c_dk = (52, 46, 38)
    c_lt = (94, 86, 72)
    for c in range(3):
        rgb[:, :, c] = c_dk[c] * mask + c_lt[c] * (1.0 - mask)
    return finalize_rgba(rgb, mask * 142.0)


def gen_obj_cobweb_dust_corner() -> Image.Image:
    w, h = 224, 224
    W, H = w * 2, h * 2
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # Soft dusty veil tucked into top-left corner first
    xs, ys = make_grid(H, W)
    n = fbm_warp(H, W, seed=2323, scale_x=4, scale_y=4)
    corner_d = np.sqrt((xs + 0.88) ** 2 + (ys + 0.88) ** 2)
    veil = smoothstep(1.38, 0.12, corner_d + (n - 0.5) * 0.30) * smoothstep(-0.98, -0.82, xs) * smoothstep(-0.98, -0.82, ys)
    rgb = np.full((H, W, 3), 218.0, dtype=np.float32)
    rgb[:, :, 2] = 204.0
    im = finalize_rgba(rgb, veil * 76.0)

    # Delicate gossamer silk threads (curving & irregular, NOT thick cartoon spiderweb!)
    threads = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(threads)
    ox, oy = W * 0.07, H * 0.07
    spokes = [0.06, 0.24, 0.44, 0.66, 0.88, 1.12, 1.34, 1.50]
    spoke_len = [W * 0.78, W * 0.72, W * 0.68, W * 0.66, W * 0.64, W * 0.68, W * 0.72, W * 0.76]
    for a, ln in zip(spokes, spoke_len):
        td.line([(ox, oy), (ox + math.cos(a) * ln, oy + math.sin(a) * ln)], fill=(232, 226, 212, 138), width=2)
    # Sagging catenary cross-strands
    for ring_r in [44, 86, 134, 186, 240, 294]:
        for i in range(len(spokes) - 1):
            a0, a1 = spokes[i], spokes[i + 1]
            am = (a0 + a1) * 0.5
            r_sag = ring_r * 0.84
            p0 = (ox + math.cos(a0) * ring_r, oy + math.sin(a0) * ring_r)
            pm = (ox + math.cos(am) * r_sag, oy + math.sin(am) * r_sag)
            p1 = (ox + math.cos(a1) * ring_r, oy + math.sin(a1) * ring_r)
            fade = max(48, int(145 - ring_r * 0.30))
            td.line([p0, pm, p1], fill=(228, 222, 210, fade), width=2, joint="curve")
    im.alpha_composite(threads.filter(ImageFilter.GaussianBlur(0.8)))
    return im.resize((w, h), Image.Resampling.LANCZOS)


def gen_obj_paint_peel_splatter() -> Image.Image:
    w, h = 224, 192
    W, H = w * 2, h * 2
    rgb, a = paint_wash_array(
        H, W, seed=2424,
        col_core=(66, 56, 46),
        col_mid=(98, 86, 72),
        col_edge=(128, 114, 98),
        max_alpha=72.0,
        elong_x=0.88, elong_y=0.82,
        cutoff_lo=0.28, cutoff_hi=0.76,
    )
    im = finalize_rgba(rgb, a)
    d = ImageDraw.Draw(im)
    rng = random.Random(2424)
    # Dried mud-spray flecks & weathered paint-chip speckles for vehicles, carts, benches & signs
    for _ in range(135):
        px = rng.gauss(W * 0.5, W * 0.22)
        py = rng.gauss(H * 0.5, H * 0.20)
        if 24 < px < W - 24 and 24 < py < H - 24:
            rx = rng.uniform(1.6, 5.4)
            ry = rx * rng.uniform(0.55, 1.15)
            col = rng.choice([(74, 58, 42), (96, 78, 56), (48, 40, 34), (176, 166, 148)])
            col = vary_rgb(col, rng, 14)
            d.ellipse([px - rx, py - ry, px + rx, py + ry], fill=(*col, rng.randint(120, 210)))
    return im.resize((w, h), Image.Resampling.LANCZOS)


# =============================================================================
# GROUP D (4): COLORABLE (`dd_red`) UNIVERSAL GRIME, STAIN, MOSS & STREAK OVERLAYS
# =============================================================================
def gen_colorable_grime_wash() -> Image.Image:
    w, h = 256, 224
    rgb, a = paint_wash_array(
        h, w, seed=2525,
        col_core=DD_RED_DEEP,
        col_mid=DD_RED_BASE,
        col_edge=DD_RED_HI,
        max_alpha=156.0,
        elong_x=0.94, elong_y=0.88,
        cutoff_lo=0.22, cutoff_hi=0.74,
        speckle_amt=0.010,
    )
    return finalize_rgba(rgb, a)


def gen_colorable_drip_stain() -> Image.Image:
    w, h = 224, 224
    xs, ys = make_grid(h, w)
    n = fbm_warp(h, w, seed=2626, scale_x=4, scale_y=4)
    dist = np.sqrt((xs / 0.80) ** 2 + (ys / 0.78) ** 2)
    field = smoothstep(0.96, 0.14, dist + (n - 0.5) * 0.44)
    for cx, cy, rr in [(-0.56, 0.44, 0.18), (0.52, -0.46, 0.15), (0.48, 0.48, 0.12), (-0.48, -0.42, 0.11)]:
        dd = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2) / rr
        field = np.maximum(field, smoothstep(1.02, 0.20, dd + (n - 0.5) * 0.30))
    mask = smoothstep(0.18, 0.62, field) * edge_feather(h, w, 0.10, 0.10)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    for c in range(3):
        rgb[:, :, c] = DD_RED_HI[c] * (1.0 - mask) + DD_RED_BASE[c] * mask * 0.85 + DD_RED_DEEP[c] * mask * 0.15
    return finalize_rgba(rgb, mask * 198.0)


def gen_colorable_moss_lichen_veil() -> Image.Image:
    w, h = 240, 208
    rgb, a = paint_wash_array(
        h, w, seed=2727,
        col_core=DD_RED_DEEP,
        col_mid=DD_RED_BASE,
        col_edge=DD_RED_HI,
        max_alpha=168.0,
        elong_x=0.90, elong_y=0.86,
        cutoff_lo=0.28, cutoff_hi=0.70,
        speckle_amt=0.018,
    )
    return finalize_rgba(rgb, a)


def gen_colorable_scuff_streak_band() -> Image.Image:
    w, h = 288, 144
    xs, ys = make_grid(h, w)
    n_streaks = fbm_periodic(h, w, ((12, 3, 0.55), (26, 6, 0.30), (48, 12, 0.15)), seed=2828)
    band = smoothstep(0.92, 0.10, np.abs(ys + (n_streaks - 0.5) * 0.22) / 0.66) * smoothstep(0.96, 0.44, np.abs(xs))
    mask = smoothstep(0.18, 0.68, band * (0.45 + 0.72 * n_streaks)) * edge_feather(h, w, 0.08, 0.12)
    rgb = np.zeros((h, w, 3), dtype=np.float32)
    for c in range(3):
        rgb[:, :, c] = DD_RED_BASE[c] * (0.7 + 0.3 * n_streaks)
    return finalize_rgba(rgb, mask * 172.0)


SPECS = [
    # Group A — Ground & Street Grime (10)
    ("wth_grime_dust_wash_lg.png", "Ground Grime & Street Dust Wash Overlay", "normal",
     ["weathering", "grime", "dirt", "dust", "overlay", "decal", "street", "ground", "harmony"], gen_grime_dust_wash_lg),
    ("wth_soot_cinder_smear_band.png", "Coal Soot & Rail-Bed Cinder Smear Overlay", "normal",
     ["weathering", "grime", "soot", "cinder", "overlay", "decal", "rail", "tram", "street", "harmony"], gen_soot_cinder_smear_band),
    ("wth_axle_grease_oil_drip_strip.png", "Track Axle-Grease & Oil Drip Strip Overlay", "normal",
     ["weathering", "grime", "oil", "grease", "overlay", "decal", "rail", "tram", "street", "harmony"], gen_axle_grease_oil_drip_strip),
    ("wth_oil_slick_stain_organic.png", "Feathered Organic Oil Spill Stain Overlay", "normal",
     ["weathering", "grime", "oil", "stain", "overlay", "decal", "street", "workshop", "harmony"], gen_oil_slick_stain_organic),
    ("wth_muddy_wheel_track_smear.png", "Muddy Cart & Wheel Track Smear Overlay", "normal",
     ["weathering", "grime", "mud", "dirt", "overlay", "decal", "street", "road", "harmony"], gen_muddy_wheel_track_smear),
    ("wth_gutter_silt_runoff_streak.png", "Curb Gutter Silt & Rain Runoff Overlay", "normal",
     ["weathering", "grime", "silt", "mud", "overlay", "decal", "street", "curb", "harmony"], gen_gutter_silt_runoff_streak),
    ("wth_damp_seepage_stain_lg.png", "Translucent Damp Water Seepage Floor Stain", "normal",
     ["weathering", "grime", "damp", "stain", "water", "overlay", "decal", "ground", "harmony"], gen_damp_seepage_stain_lg),
    ("wth_rust_oxide_runoff_stain.png", "Iron-Oxide Rust Bleed & Runoff Overlay", "normal",
     ["weathering", "grime", "rust", "stain", "overlay", "decal", "rail", "iron", "harmony"], gen_rust_oxide_runoff_stain),
    ("wth_scorch_aether_arc_burn.png", "Scorched Soot & Aether-Arc Burn Overlay", "normal",
     ["weathering", "grime", "scorch", "soot", "aether", "overlay", "decal", "tram", "harmony"], gen_scorch_aether_arc_burn),
    ("wth_tar_cobble_crack_network.png", "Tar-Sealed Pavement & Stone Crack Network", "normal",
     ["weathering", "grime", "crack", "fissure", "overlay", "decal", "street", "stone", "harmony"], gen_tar_cobble_crack_network),
    # Group B — Organic Moss, Weeds, Litter & Curb Aging (6)
    ("wth_curb_moss_weed_tufts.png", "Curb-Crack Moss & Sprouting Weed Tufts Overlay", "normal",
     ["weathering", "grime", "moss", "weeds", "overlay", "decal", "street", "curb", "harmony"], gen_curb_moss_weed_tufts),
    ("wth_damp_lichen_moss_film.png", "Weathered Damp Lichen & Moss Film Overlay", "normal",
     ["weathering", "grime", "moss", "lichen", "overlay", "decal", "roof", "stone", "harmony"], gen_damp_lichen_moss_film),
    ("wth_street_grit_cinder_scatter.png", "Street Grit, Cinders & Paper Litter Scatter", "normal",
     ["weathering", "grime", "grit", "litter", "cinder", "overlay", "decal", "street", "harmony"], gen_street_grit_cinder_scatter),
    ("wth_puddle_rain_film_sheen.png", "Translucent Reflective Rain Puddle Film Overlay", "normal",
     ["weathering", "grime", "puddle", "water", "rain", "overlay", "decal", "street", "harmony"], gen_puddle_rain_film_sheen),
    ("wth_autumn_leaves_curb_drift.png", "Wind-Swept Damp Autumn Leaves Curb Drift", "normal",
     ["weathering", "grime", "leaves", "autumn", "overlay", "decal", "street", "curb", "harmony"], gen_autumn_leaves_curb_drift),
    ("wth_crumbled_mortar_gravel_edge.png", "Crumbled Mortar & Wall-Base Gravel Debris", "normal",
     ["weathering", "grime", "rubble", "gravel", "mortar", "overlay", "decal", "street", "harmony"], gen_crumbled_mortar_gravel_edge),
    # Group C — Object-Top Aging, Scuff, Dust & Patina (8)
    ("wth_obj_dust_film_veil.png", "Object-Top Settled Dust & Grime Film Veil", "normal",
     ["weathering", "grime", "dust", "object_overlay", "overlay", "decal", "aging", "harmony"], gen_obj_dust_film_veil),
    ("wth_obj_scuff_scratch_patina.png", "Object-Top Wear Scuffs & Scratch Patina", "normal",
     ["weathering", "grime", "scuff", "wear", "object_overlay", "overlay", "decal", "aging", "harmony"], gen_obj_scuff_scratch_patina),
    ("wth_obj_soot_smudge_cap.png", "Object-Top Chimney & Exhaust Soot Smudge", "normal",
     ["weathering", "grime", "soot", "object_overlay", "overlay", "decal", "aging", "roof", "harmony"], gen_obj_soot_smudge_cap),
    ("wth_obj_rust_patina_streaks.png", "Object-Top Oxidized Iron Rust Patina Streaks", "normal",
     ["weathering", "grime", "rust", "object_overlay", "overlay", "decal", "aging", "iron", "harmony"], gen_obj_rust_patina_streaks),
    ("wth_obj_verdigris_copper_patina.png", "Object-Top Oxidized Copper Verdigris Patina", "normal",
     ["weathering", "grime", "verdigris", "patina", "object_overlay", "overlay", "decal", "aging", "harmony"], gen_obj_verdigris_copper_patina),
    ("wth_obj_water_ring_mildew.png", "Object-Top Damp Water-Rings & Mildew Stains", "normal",
     ["weathering", "grime", "mildew", "water", "stain", "object_overlay", "overlay", "decal", "harmony"], gen_obj_water_ring_mildew),
    ("wth_obj_cobweb_dust_corner.png", "Object-Top Wispy Dust-Laden Corner Cobweb", "normal",
     ["weathering", "grime", "cobweb", "dust", "object_overlay", "overlay", "decal", "aging", "harmony"], gen_obj_cobweb_dust_corner),
    ("wth_obj_paint_peel_splatter.png", "Object-Top Road-Spray Mud & Chipped Paint Flecks", "normal",
     ["weathering", "grime", "mud", "wear", "object_overlay", "overlay", "decal", "aging", "harmony"], gen_obj_paint_peel_splatter),
    # Group D — Universal Colorable (`dd_red`) Overlays (4)
    ("wth_colorable_grime_wash.png", "Colorable Surface Grime, Dirt & Dust Wash (dd_red)", "dd_red",
     ["weathering", "grime", "dirt", "colorable", "dd_red", "overlay", "decal", "object_overlay", "harmony"], gen_colorable_grime_wash),
    ("wth_colorable_drip_stain.png", "Colorable Organic Liquid Spill & Stain (dd_red)", "dd_red",
     ["weathering", "grime", "stain", "spill", "colorable", "dd_red", "overlay", "decal", "harmony"], gen_colorable_drip_stain),
    ("wth_colorable_moss_lichen_veil.png", "Colorable Moss, Mold, Ash & Frost Crust (dd_red)", "dd_red",
     ["weathering", "grime", "moss", "mold", "colorable", "dd_red", "overlay", "decal", "harmony"], gen_colorable_moss_lichen_veil),
    ("wth_colorable_scuff_streak_band.png", "Colorable Drag, Skid & Soot Streak Band (dd_red)", "dd_red",
     ["weathering", "grime", "scuff", "streak", "colorable", "dd_red", "overlay", "decal", "harmony"], gen_colorable_scuff_streak_band),
]


def save_dual_bg_qa(items: list[tuple[str, Image.Image]], out_path: Path, cols: int = 7) -> None:
    """Renders every translucent overlay atop a warm stone/wood split tile so blending is obvious."""
    cw, ch = 176, 152
    rows = math.ceil(len(items) / cols)
    sheet = Image.new("RGBA", (cols * cw, rows * ch), (24, 26, 30, 255))
    d = ImageDraw.Draw(sheet)
    for idx, (label, im) in enumerate(items):
        r, c = divmod(idx, cols)
        x0, y0 = c * cw, r * ch
        # Left half: cool street stone; Right half: warm wood plank (shows how dark & light overlays read!)
        d.rectangle([x0 + 4, y0 + 4, x0 + cw // 2, y0 + ch - 22], fill=(122, 126, 134, 255))
        d.rectangle([x0 + cw // 2, y0 + 4, x0 + cw - 4, y0 + ch - 22], fill=(154, 118, 82, 255))
        for gx in range(x0 + 4, x0 + cw - 4, 28):
            d.line([(gx, y0 + 4), (gx, y0 + ch - 22)], fill=(42, 40, 38, 45), width=1)
        for gy in range(y0 + 4, y0 + ch - 22, 28):
            d.line([(x0 + 4, gy), (x0 + cw - 4, gy)], fill=(42, 40, 38, 45), width=1)
        tw, th = im.size
        scale = min((cw - 16) / tw, (ch - 34) / th)
        nw, nh = max(1, int(tw * scale)), max(1, int(th * scale))
        rs = im.resize((nw, nh), Image.Resampling.LANCZOS)
        sheet.alpha_composite(rs, (x0 + (cw - nw) // 2, y0 + 4 + (ch - 26 - nh) // 2))
        d.rectangle([x0 + 4, y0 + ch - 20, x0 + cw - 4, y0 + ch - 4], fill=(18, 20, 24, 235))
        d.text((x0 + 8, y0 + ch - 17), label[:24], fill=(232, 224, 204, 255))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)


def main() -> None:
    qa_items: list[tuple[str, Image.Image]] = []
    manifest_entries: list[dict] = []

    for fname, display_name, draw_mode, tags, fn in SPECS:
        im = fn()
        out_fp = OUT_DIR / fname
        im.save(out_fp)
        qa_items.append((fname.replace("wth_", "").replace(".png", ""), im))
        manifest_entries.append({
            "path": f"props/weathering_overlays/{fname}",
            "displayName": display_name,
            "category": "object",
            "widthPx": im.width,
            "heightPx": im.height,
            "defaultPpi": 256,
            "drawMode": draw_mode,
            "dominantHex": dominant_hex(im),
            "castsShadow": False,
            "tags": tags,
        })

    upsert_manifest_entries(MOD_DIR / "manifest.json", manifest_entries)
    qa_path = SCRATCH_DIR / "qa_weathering_overlays.png"
    save_dual_bg_qa(qa_items, qa_path, cols=7)
    print(f"Generated {len(manifest_entries)} weathering & grime overlays -> {OUT_DIR}")
    print(f"QA sheet -> {qa_path}")


if __name__ == "__main__":
    main()

"""
Extract 12 bespoke Dark Magipunk Sovereign Temple hero props into crisp, zero-halo
transparent RGBA PNGs, register them in modular-suite-cc0/manifest.json, rebuild
DiceChaos_Modular_Suite_CC0.dcpack, and emit a dark-checkerboard QA sheet to verify
zero unintended white spaces or fringes!
"""

from __future__ import annotations

import collections
import json
import pathlib
import zipfile
import numpy as np
from PIL import Image, ImageDraw

ARTIFACTS_DIR = pathlib.Path(
    r"C:\Users\alexb\.gemini\antigravity\brain\83b09745-6afe-4ec0-bc82-3f2a2e7084ae"
)
MODULAR_DIR = pathlib.Path("public/assets/modular-suite-cc0")
OUT_DIR = MODULAR_DIR / "props" / "sovereign_temple"
MANIFEST_PATH = MODULAR_DIR / "manifest.json"
DCPACK_PATH = pathlib.Path("public/assets/DiceChaos_Modular_Suite_CC0.dcpack")
QA_SHEET = ARTIFACTS_DIR / "scratch" / "sovereign_props_qa.png"

PROPS = [
    {
        "src": "sov_high_altar_aether_v3_1795506099700.jpg",
        "filename": "sov_high_altar_aether.png",
        "displayName": "Sovereign Aether High Altar",
        "max_dim": 512,
        "target_cells_max": 3.2,
        "cut_interior_white": False,
        "tags": ["altar", "temple", "sovereign", "magipunk", "aether", "obsidian", "ritual", "hero", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_aether_lift_cage_final_1795506095365.jpg",
        "filename": "sov_aether_lift_cage.png",
        "displayName": "Magipunk Vertical Aether-Lift Cage",
        "max_dim": 480,
        "target_cells_max": 3.0,
        "cut_interior_white": True,
        "tags": ["lift", "elevator", "aether", "magipunk", "brass", "temple", "sovereign", "hero", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_aether_pipe_organ_flat_1795506103839.jpg",
        "filename": "sov_aether_pipe_organ.png",
        "displayName": "Gothic Magipunk Brass Pipe Organ",
        "max_dim": 512,
        "target_cells_max": 3.8,
        "cut_interior_white": False,
        "tags": ["organ", "pipe", "music", "choir", "temple", "magipunk", "brass", "sovereign", "hero", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_aether_reactor_core_1795506104799.jpg",
        "filename": "sov_aether_reactor_core.png",
        "displayName": "Cathedral Aether-Core Reactor Dynamo",
        "max_dim": 512,
        "target_cells_max": 3.6,
        "cut_interior_white": False,
        "tags": ["reactor", "dynamo", "aether", "core", "magipunk", "engine", "temple", "sovereign", "hero", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_clockwork_inquisitor_1795506203231.jpg",
        "filename": "sov_clockwork_inquisitor.png",
        "displayName": "Clockwork Inquisitor Automaton Sentinel",
        "max_dim": 320,
        "target_cells_max": 1.35,
        "cut_interior_white": True,
        "keep_smoke": True,
        "tags": ["automaton", "clockwork", "inquisitor", "guard", "sentinel", "magipunk", "sovereign", "temple", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_confession_booth_1795506201943.jpg",
        "filename": "sov_confession_booth.png",
        "displayName": "Gothic Oak & Iron Confession Booth",
        "max_dim": 420,
        "target_cells_max": 2.4,
        "cut_interior_white": True,
        "tags": ["confessional", "booth", "temple", "chapel", "furniture", "gothic", "sovereign", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_inquisition_chair_1795506184916.jpg",
        "filename": "sov_inquisition_chair.png",
        "displayName": "Arcane Inquisition Mind-Scrying Chair",
        "max_dim": 480,
        "target_cells_max": 3.2,
        "cut_interior_white": False,
        "tags": ["inquisition", "chair", "arcane", "scrying", "magipunk", "ritual", "temple", "sovereign", "hero", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_scrying_console_1795506185619.jpg",
        "filename": "sov_scrying_console.png",
        "displayName": "Arcane City-Surveillance Scrying Console",
        "max_dim": 440,
        "target_cells_max": 2.8,
        "cut_interior_white": False,
        "tags": ["console", "scrying", "surveillance", "magipunk", "desk", "brass", "temple", "sovereign", "hero", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_iron_throne_dais_1795506274612.jpg",
        "filename": "sov_iron_throne_dais.png",
        "displayName": "Throne of the Sovereign on Obsidian Dais",
        "max_dim": 512,
        "target_cells_max": 4.2,
        "cut_interior_white": False,
        "tags": ["throne", "dais", "sovereign", "obsidian", "royal", "magipunk", "temple", "hero", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_astral_orrery_1795506277465.jpg",
        "filename": "sov_astral_orrery.png",
        "displayName": "Grand Brass Astral Orrery",
        "max_dim": 480,
        "target_cells_max": 3.4,
        "cut_interior_white": False,
        "tags": ["orrery", "astrolabe", "observatory", "astral", "brass", "magipunk", "temple", "sovereign", "hero", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_sovereign_seal_floor_padded_1795506322617.jpg",
        "filename": "sov_sovereign_seal_floor.png",
        "displayName": "Inlaid Sovereign Crown-and-Eye Floor Sigil",
        "max_dim": 512,
        "target_cells_max": 4.5,
        "cut_interior_white": False,
        "casts_shadow": False,
        "tags": ["sigil", "seal", "medallion", "decal", "floor", "sovereign", "temple", "magipunk", "arcane", "cc0", "modular_cc0"],
    },
    {
        "src": "sov_cathedral_bell_coil_1795506283162.jpg",
        "filename": "sov_cathedral_bell_coil.png",
        "displayName": "Cathedral Aether Bell & Resonator Belfry",
        "max_dim": 480,
        "target_cells_max": 3.2,
        "cut_interior_white": True,
        "tags": ["bell", "belfry", "aether", "coil", "temple", "magipunk", "sovereign", "hero", "cc0", "modular_cc0"],
    },
]


def extract_clean_transparent(
    src_path: pathlib.Path,
    max_dim: int,
    cut_interior_white: bool = False,
    keep_smoke: bool = False,
) -> Image.Image:
    im = Image.open(src_path).convert("RGB")
    arr = np.asarray(im, dtype=np.uint8)
    h, w, _ = arr.shape

    r = arr[:, :, 0].astype(np.int32)
    g = arr[:, :, 1].astype(np.int32)
    b = arr[:, :, 2].astype(np.int32)
    max_c = np.maximum(np.maximum(r, g), b)
    min_c = np.minimum(np.minimum(r, g), b)
    sat = max_c - min_c
    lum = (r * 299 + g * 587 + b * 114) // 1000

    # Background candidate: bright & near-neutral white
    bg_cand = (lum >= 234) & (sat <= 18) if not keep_smoke else (lum >= 244) & (sat <= 10)

    # Flood-fill strictly from outer border pixels
    visited = np.zeros((h, w), dtype=np.uint8)
    q = collections.deque()
    for x in range(w):
        if bg_cand[0, x]:
            visited[0, x] = 1
            q.append((0, x))
        if bg_cand[h - 1, x]:
            visited[h - 1, x] = 1
            q.append((h - 1, x))
    for y in range(h):
        if bg_cand[y, 0] and not visited[y, 0]:
            visited[y, 0] = 1
            q.append((y, 0))
        if bg_cand[y, w - 1] and not visited[y, w - 1]:
            visited[y, w - 1] = 1
            q.append((y, w - 1))

    while q:
        cy, cx = q.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and bg_cand[ny, nx]:
                visited[ny, nx] = 1
                q.append((ny, nx))

    # Optional: remove enclosed pure-white see-through holes (e.g. belfry truss, lift railing gaps, open doorway gaps)
    if cut_interior_white:
        pure_white_hole = (lum >= 246) & (sat <= 8) & (visited == 0)
        # Connected components of pure-white holes — remove ones >= 35 pixels so tiny specular dots stay intact!
        hole_vis = np.zeros((h, w), dtype=np.uint8)
        ys, xs = np.nonzero(pure_white_hole)
        for sy, sx in zip(ys.tolist(), xs.tolist()):
            if hole_vis[sy, sx]:
                continue
            comp = []
            hq = collections.deque([(sy, sx)])
            hole_vis[sy, sx] = 1
            while hq:
                cy, cx = hq.popleft()
                comp.append((cy, cx))
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < h and 0 <= nx < w and not hole_vis[ny, nx] and pure_white_hole[ny, nx]:
                        hole_vis[ny, nx] = 1
                        hq.append((ny, nx))
            if len(comp) >= 40:
                for cy, cx in comp:
                    visited[cy, cx] = 1

    # Soft anti-aliased fringe cleanup: 2px ring adjacent to background gets smooth alpha & white-defringe
    alpha = np.where(visited == 1, 0, 255).astype(np.float32)

    # Dilate background mask by 1px and 2px to detect fringe pixels
    bg = visited.astype(bool)
    bg1 = bg.copy()
    bg1[1:, :] |= bg[:-1, :]
    bg1[:-1, :] |= bg[1:, :]
    bg1[:, 1:] |= bg[:, :-1]
    bg1[:, :-1] |= bg[:, 1:]

    bg2 = bg1.copy()
    bg2[1:, :] |= bg1[:-1, :]
    bg2[:-1, :] |= bg1[1:, :]
    bg2[:, 1:] |= bg1[:, :-1]
    bg2[:, :-1] |= bg1[:, 1:]

    ring1 = bg1 & (~bg)
    ring2 = bg2 & (~bg1)

    # Kill bright near-white fringe pixels on ring1 & soften light anti-aliased edge pixels
    rgb_out = arr.astype(np.float32)
    bright_ring1 = ring1 & (lum >= 210) & (sat <= 28)
    alpha[bright_ring1] = np.clip((242.0 - lum[bright_ring1]) / 32.0, 0.0, 1.0) * 255.0

    # Defringe remaining semi-bright pixels on ring1 & ring2 by pulling away from white toward darker edge
    semi = (ring1 | ring2) & (alpha > 0) & (lum >= 175) & (sat <= 32)
    alpha[semi] = np.minimum(alpha[semi], np.clip((245.0 - lum[semi]) / 60.0, 0.15, 1.0) * 255.0)
    # Darken pale halo pixels slightly on ring1 so zero bright white rim shows on dark stone floors
    halo = ring1 & (alpha > 0) & (lum >= 160) & (sat <= 35)
    rgb_out[halo] = np.clip(rgb_out[halo] * 0.72, 0, 255)

    rgba = np.dstack([rgb_out.astype(np.uint8), np.clip(alpha, 0, 255).astype(np.uint8)])
    out_im = Image.fromarray(rgba, "RGBA")

    # Tight-crop to non-transparent bounding box with 6px clean margin
    bbox = out_im.split()[3].point(lambda a: 255 if a > 20 else 0).getbbox()
    if bbox:
        x0 = max(0, bbox[0] - 6)
        y0 = max(0, bbox[1] - 6)
        x1 = min(w, bbox[2] + 6)
        y1 = min(h, bbox[3] + 6)
        out_im = out_im.crop((x0, y0, x1, y1))

    # Resize to target crisp max_dim
    cw, ch = out_im.size
    scale = min(1.0, max_dim / max(cw, ch))
    nw = max(32, int(round(cw * scale)))
    nh = max(32, int(round(ch * scale)))
    if (nw, nh) != (cw, ch):
        out_im = out_im.resize((nw, nh), Image.Resampling.LANCZOS)
    return out_im


def make_checker(w: int, h: int, sq: int = 16) -> Image.Image:
    y, x = np.indices((h, w))
    c = ((x // sq) + (y // sq)) % 2
    img = np.where(c[:, :, None] == 0, np.array([34, 38, 48], np.uint8), np.array([50, 56, 70], np.uint8))
    return Image.fromarray(img, "RGB")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    QA_SHEET.parent.mkdir(parents=True, exist_ok=True)

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assets: list[dict] = manifest.get("assets", [])
    by_path = {a["path"]: i for i, a in enumerate(assets)}

    cols, rows = 4, 3
    cell_w, cell_h = 260, 286
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (18, 22, 30))
    draw = ImageDraw.Draw(sheet)

    for idx, spec in enumerate(PROPS):
        src = ARTIFACTS_DIR / spec["src"]
        if not src.exists():
            raise FileNotFoundError(f"Missing generated prop: {src}")
        im = extract_clean_transparent(
            src,
            spec["max_dim"],
            cut_interior_white=spec.get("cut_interior_white", False),
            keep_smoke=spec.get("keep_smoke", False),
        )
        out_path = OUT_DIR / spec["filename"]
        im.save(out_path, optimize=True)
        w, h = im.size
        default_ppi = max(96, int(round(max(w, h) / spec["target_cells_max"])))

        rel_path = f"props/sovereign_temple/{spec['filename']}"
        entry = {
            "path": rel_path,
            "displayName": spec["displayName"],
            "category": "object",
            "tags": spec["tags"],
            "widthPx": w,
            "heightPx": h,
            "defaultPpi": default_ppi,
            "drawMode": "normal",
            "castsShadow": spec.get("casts_shadow", True),
        }
        if rel_path in by_path:
            assets[by_path[rel_path]] = entry
        else:
            by_path[rel_path] = len(assets)
            assets.append(entry)

        # Paste onto dark checkerboard QA cell
        r, c = divmod(idx, cols)
        ox, oy = c * cell_w + 10, r * cell_h + 10
        chk = make_checker(240, 240)
        preview = im.copy()
        preview.thumbnail((232, 232), Image.Resampling.LANCZOS)
        px = (240 - preview.width) // 2
        py = (240 - preview.height) // 2
        chk.paste(preview, (px, py), preview)
        sheet.paste(chk, (ox, oy))
        draw.text((ox, oy + 244), f"{idx + 1}. {spec['displayName'][:32]}", fill=(238, 242, 248))
        draw.text((ox, oy + 258), f"{w}x{h} (ppi {default_ppi})", fill=(148, 163, 184))
        print(f"Extracted {rel_path} ({w}x{h}, ppi={default_ppi})")

    manifest["assets"] = assets
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    sheet.save(QA_SHEET)
    print(f"Saved QA sheet: {QA_SHEET}")
    print(f"Updated {MANIFEST_PATH} -> {len(assets)} total assets")

    # Rebuild modular dcpack
    with zipfile.ZipFile(DCPACK_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for f in sorted(MODULAR_DIR.rglob("*")):
            if f.is_file():
                zf.write(f, f.relative_to(MODULAR_DIR).as_posix())
    print(f"Rebuilt {DCPACK_PATH} ({DCPACK_PATH.stat().st_size / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()

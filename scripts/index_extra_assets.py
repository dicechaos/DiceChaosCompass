#!/usr/bin/env python3
"""
High-speed local indexer for user Dungeondraft (.dungeondraft_pack inside .zip)
and Wonderdraft (.zip with .wonderdraft_symbols) archives in ExtraAsses/.

Zero loose-file explosion for Dungeondraft:
  - Extracts unique healthy .dungeondraft_pack PCK binaries into ExtraAsses/.cache_pcks/
  - Parses Godot GDPC (v1 & v2) entry tables + Dungeondraft tag manifests + PNG/WebP dimensions
  - Extracts Wonderdraft sprites into ExtraAsses/.cache_wd/
  - Writes ExtraAsses/.cache_index.json (for O(1) byte-range HTTP streaming in Vite)
  - Writes public/assets/user-packs/extra_manifest.json (for the Asset Vault frontend)
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import re
import struct
import zipfile
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent.parent
EXTRA_DIR = ROOT / "ExtraAsses"
PCK_CACHE = EXTRA_DIR / ".cache_pcks"
WD_CACHE = EXTRA_DIR / ".cache_wd"
OUT_PUBLIC = ROOT / "public" / "assets" / "user-packs"
INDEX_PATH = EXTRA_DIR / ".cache_index.json"
MANIFEST_PATH = OUT_PUBLIC / "extra_manifest.json"


def probe_image_size(header: bytes) -> tuple[int, int]:
    """Read width & height from PNG, WebP, or JPEG header bytes without decoding pixels."""
    if len(header) >= 24 and header[:8] == b"\x89PNG\r\n\x1a\n":
        w, h = struct.unpack_from(">II", header, 16)
        return max(16, w), max(16, h)
    if len(header) >= 30 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        chunk = header[12:16]
        if chunk == b"VP8X" and len(header) >= 30:
            w = 1 + (header[24] | (header[25] << 8) | (header[26] << 16))
            h = 1 + (header[27] | (header[28] << 8) | (header[29] << 16))
            return max(16, w), max(16, h)
        if chunk == b"VP8 " and len(header) >= 30:
            w, h = struct.unpack_from("<HH", header, 26)
            return max(16, w & 0x3FFF), max(16, h & 0x3FFF)
        if chunk == b"VP8L" and len(header) >= 25:
            bits = struct.unpack_from("<I", header, 21)[0]
            w = 1 + (bits & 0x3FFF)
            h = 1 + ((bits >> 14) & 0x3FFF)
            return max(16, w), max(16, h)
    return 256, 256


def mime_for(name: str) -> str:
    low = name.lower()
    if low.endswith(".webp"):
        return "image/webp"
    if low.endswith(".jpg") or low.endswith(".jpeg"):
        return "image/jpeg"
    return "image/png"


def normalize_pack_key(filename: str) -> str:
    stem = pathlib.Path(filename).stem.lower()
    stem = re.sub(r"^(2-minute tabletop|2mt|2m)\s*", "", stem)
    stem = re.sub(r"[^a-z0-9]+", "", stem)
    return stem


def clean_display_name(raw_path: str) -> str:
    stem = pathlib.Path(raw_path).stem
    stem = re.sub(r"[_\-]+", " ", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    if not stem:
        return "Asset"
    return stem[:1].upper() + stem[1:]


def extract_tags(pack_label: str, rel_path: str, extra: list[str]) -> list[str]:
    raw = f"{pack_label} {rel_path}".lower()
    words = re.findall(r"[a-z0-9]{2,}", raw)
    stop = {"res", "packs", "textures", "objects", "terrain", "walls", "paths", "portals", "sprites", "symbols", "png", "webp", "jpg", "2mt", "2m", "minute", "tabletop", "dungeondraft", "pack", "assets", "map", "official", "premium"}
    out = []
    seen = set()
    for w in words + [t.lower() for t in extra]:
        w = re.sub(r"[^a-z0-9_]+", "", w)
        if len(w) >= 2 and w not in stop and w not in seen:
            seen.add(w)
            out.append(w)
    return out[:14]


def parse_pck_entries(data: bytes) -> list[tuple[str, int, int]]:
    if len(data) < 96 or data[:4] != b"GDPC":
        return []
    ver, _maj, _minr, _pat = struct.unpack_from("<IIII", data, 4)
    base_off = 0
    if ver == 2:
        _flags, base_off = struct.unpack_from("<IQ", data, 20)
        off = 20 + 12 + (16 * 4)
    else:
        off = 4 + 16 + (16 * 4)
    if off + 4 > len(data):
        return []
    count = struct.unpack_from("<I", data, off)[0]
    off += 4
    entries: list[tuple[str, int, int]] = []
    for _ in range(count):
        if off + 4 > len(data):
            break
        plen = struct.unpack_from("<I", data, off)[0]
        off += 4
        if off + plen + 32 > len(data):
            break
        name = data[off : off + plen].rstrip(b"\x00").decode("utf-8", "ignore")
        off += plen
        foff, fsize = struct.unpack_from("<QQ", data, off)
        off += 16
        off += 16  # md5
        if ver == 2:
            off += 4  # file flags
        abs_off = base_off + foff if ver == 2 else foff
        if abs_off + fsize <= len(data):
            entries.append((name, abs_off, fsize))
    return entries


def classify_dd_category(rel_path: str) -> str | None:
    low = rel_path.lower().replace("\\", "/")
    if "/thumbs/" in low or low.endswith("preview.png") or "/preview" in low:
        return None
    if "/textures/terrain/" in low:
        return "terrain"
    if "/textures/walls/" in low:
        return "wall"
    if "/textures/paths/" in low:
        return "path"
    if "/textures/portals/" in low:
        return "portal"
    if "/textures/lights/" in low:
        return "light"
    if "/textures/tilesets/" in low:
        return "terrain"
    if "/textures/objects/" in low or "/textures/" in low:
        return "object"
    return "object"


def volume_source_label(zip_name: str) -> tuple[str, str]:
    m = re.match(r"Volume\s+(\d+)", zip_name, re.I)
    if m:
        num = m.group(1)
        return f"src-dd-vol-{num}", f"Dungeondraft Pack Vol. {num}"
    stem = pathlib.Path(zip_name).stem.replace("_", " ").replace("-", " ")
    slug = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return f"src-wd-{slug}", stem


def main() -> None:
    PCK_CACHE.mkdir(parents=True, exist_ok=True)
    WD_CACHE.mkdir(parents=True, exist_ok=True)
    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)

    sources_map: dict[str, dict[str, Any]] = {}
    assets_out: list[dict[str, Any]] = []
    stream_index: dict[str, dict[str, Any]] = {}
    seen_pck_keys: set[str] = set()
    skipped_bad: list[str] = []
    skipped_dupes = 0

    for zf_path in sorted(EXTRA_DIR.glob("*.zip")):
        try:
            zf = zipfile.ZipFile(zf_path)
        except Exception as exc:
            skipped_bad.append(f"{zf_path.name}: {exc}")
            continue

        src_id, src_name = volume_source_label(zf_path.name)
        is_wd_zip = zf_path.name.lower().startswith("wonderdraft")

        with zf:
            # 1. Pre-read any .wonderdraft_symbols JSON metadata in this zip
            #    Supports BOTH per-sprite dictionaries (buildings/ships/compasses) AND folder-wide dicts (trees/mountains)!
            wd_symbol_meta: dict[str, dict[str, Any]] = {}
            wd_folder_meta: dict[str, dict[str, Any]] = {}
            if is_wd_zip:
                for info in zf.infolist():
                    if info.filename.endswith(".wonderdraft_symbols"):
                        try:
                            meta = json.loads(zf.read(info).decode("utf-8", "ignore"))
                            folder = str(pathlib.PurePosixPath(info.filename).parent).lower()
                            if isinstance(meta, dict):
                                if "draw_mode" in meta or "radius" in meta:
                                    wd_folder_meta[folder] = meta
                                else:
                                    for sym_key, sym_val in meta.items():
                                        if isinstance(sym_val, dict):
                                            wd_symbol_meta[f"{folder}/{sym_key}".lower()] = sym_val
                        except Exception:
                            pass

            for info in zf.infolist():
                if info.is_dir():
                    continue
                low = info.filename.lower()

                # --- DUNGEONDRAFT .dungeondraft_pack PCK ---
                if low.endswith(".dungeondraft_pack"):
                    pck_key = normalize_pack_key(info.filename)
                    if pck_key in seen_pck_keys:
                        skipped_dupes += 1
                        continue
                    try:
                        pck_bytes = zf.read(info)
                    except Exception as exc:
                        skipped_bad.append(f"{zf_path.name}/{info.filename}: {exc}")
                        continue

                    entries = parse_pck_entries(pck_bytes)
                    if not entries:
                        skipped_bad.append(f"{zf_path.name}/{info.filename}: not valid GDPC")
                        continue

                    seen_pck_keys.add(pck_key)
                    safe_pck_name = f"{pck_key}_{hashlib.md5(pck_key.encode()).hexdigest()[:6]}.dungeondraft_pack"
                    pck_disk_path = PCK_CACHE / safe_pck_name
                    pck_disk_path.write_bytes(pck_bytes)

                    # Read Dungeondraft tags JSON inside PCK if present
                    tag_lookup: dict[str, list[str]] = {}
                    pack_title = pathlib.Path(info.filename).stem
                    for ename, eoff, esize in entries:
                        elow = ename.lower()
                        if elow.endswith("pack.json") and esize < 200_000:
                            try:
                                pj = json.loads(pck_bytes[eoff : eoff + esize].decode("utf-8", "ignore"))
                                if isinstance(pj, dict) and pj.get("name"):
                                    pack_title = str(pj["name"])
                            except Exception:
                                pass
                        elif elow.endswith(".dungeondraft_tags") and esize < 2_000_000:
                            try:
                                tj = json.loads(pck_bytes[eoff : eoff + esize].decode("utf-8", "ignore"))
                                tags_dict = tj.get("tags", {}) if isinstance(tj, dict) else {}
                                for tag_name, paths_list in tags_dict.items():
                                    if isinstance(paths_list, list):
                                        for tp in paths_list:
                                            norm_tp = str(tp).lower().replace("\\", "/")
                                            tag_lookup.setdefault(norm_tp, []).append(str(tag_name))
                            except Exception:
                                pass

                    src_entry = sources_map.setdefault(
                        src_id,
                        {
                            "id": src_id,
                            "kind": "dungeondraft_pack",
                            "name": src_name,
                            "rootPath": str(zf_path),
                            "enabled": True,
                            "assetCount": 0,
                            "ramEstimateMb": 0.0,
                        },
                    )

                    for ename, eoff, esize in entries:
                        elow = ename.lower()
                        if not elow.endswith((".png", ".webp", ".jpg", ".jpeg")):
                            continue
                        cat = classify_dd_category(ename)
                        if not cat:
                            continue
                        if esize < 64:
                            continue

                        w, h = probe_image_size(pck_bytes[eoff : eoff + min(64, esize)])
                        short_rel = re.sub(r"^res://packs/[^/]+/", "", ename, flags=re.I)
                        dd_tags = tag_lookup.get(short_rel.lower(), [])
                        is_colorable = any(t.lower() == "colorable" for t in dd_tags) or "colorable" in elow
                        aid = f"dd/{pck_key}/{hashlib.md5(ename.encode()).hexdigest()[:10]}"
                        tags = extract_tags(pack_title, short_rel, dd_tags + ["dungeondraft"])

                        stream_index[aid] = {
                            "type": "pck",
                            "file": safe_pck_name,
                            "offset": eoff,
                            "size": esize,
                            "mime": mime_for(ename),
                        }
                        assets_out.append(
                            {
                                "id": aid,
                                "sourceId": src_id,
                                "sourceName": src_name,
                                "sourceKind": "dungeondraft_pack",
                                "internalPath": f"{pack_title}/{short_rel}",
                                "displayName": clean_display_name(short_rel),
                                "category": cat,
                                "widthPx": w,
                                "heightPx": h,
                                "defaultPpi": 256,
                                "drawMode": "rgb_channels" if is_colorable else "normal",
                                "dominantHex": "#7C8A9E",
                                "castsShadow": cat in ("object", "wall"),
                                "tags": tags,
                            }
                        )
                        src_entry["assetCount"] += 1

                # --- WONDERDRAFT ZIP SPRITES ---
                elif is_wd_zip and low.endswith((".png", ".webp")) and "sprites/" in low:
                    try:
                        img_bytes = zf.read(info)
                    except Exception as exc:
                        skipped_bad.append(f"{zf_path.name}/{info.filename}: {exc}")
                        continue
                    if len(img_bytes) < 64:
                        continue

                    w, h = probe_image_size(img_bytes[:64])
                    rel_clean = info.filename.replace("\\", "/")
                    aid = f"wd/{hashlib.md5((zf_path.name + '/' + rel_clean).encode()).hexdigest()[:12]}"
                    ext = pathlib.Path(rel_clean).suffix.lower() or ".png"
                    wd_file = f"{aid.replace('/', '_')}{ext}"
                    (WD_CACHE / wd_file).write_bytes(img_bytes)

                    sym_key = str(pathlib.PurePosixPath(rel_clean).with_suffix("")).lower()
                    parent_folder = str(pathlib.PurePosixPath(rel_clean).parent).lower()
                    sym_meta = wd_symbol_meta.get(sym_key) or wd_folder_meta.get(parent_folder, {})
                    raw_dm = str(sym_meta.get("draw_mode", "")).lower()
                    draw_mode = (
                        "rgb_channels"
                        if raw_dm in ("custom_colors", "custom_colors_2") or "custom_color" in low or "_custom" in low
                        else "sample_color"
                        if raw_dm == "sample_color" or "paintable" in low or "sample_color" in low or "_sample" in low
                        else "normal"
                    )
                    # Classify Wonderdraft folder taxonomy into our World Atlas groups
                    if "/mountains/" in low or "mountain" in low or "hill" in low:
                        w_group = "mountains"
                    elif "/trees/" in low or "tree" in low or "mangrove" in low or "palm" in low:
                        w_group = "trees"
                    elif "ship" in low or "boat" in low or "pirat_port" in low or "monster" in low or "sea" in low:
                        w_group = "maritime"
                    elif "rose" in low or "compass" in low or "banner" in low or "frame" in low:
                        w_group = "cartography"
                    elif "building" in low or "house" in low or "castle" in low or "fort" in low or "tower" in low or "pier" in low or "shack" in low or "temple" in low or "mill" in low:
                        w_group = "settlements"
                    else:
                        w_group = "landmarks"

                    src_entry = sources_map.setdefault(
                        src_id,
                        {
                            "id": src_id,
                            "kind": "wonderdraft",
                            "name": src_name,
                            "rootPath": str(zf_path),
                            "enabled": True,
                            "assetCount": 0,
                            "ramEstimateMb": 0.0,
                        },
                    )
                    tags = extract_tags(src_name, rel_clean, ["wonderdraft", "world", "symbol", w_group])

                    stream_index[aid] = {
                        "type": "wd",
                        "file": wd_file,
                        "mime": mime_for(rel_clean),
                    }
                    disp_name = str(sym_meta.get("name") or "").strip() if sym_key in wd_symbol_meta else ""
                    if not disp_name:
                        disp_name = clean_display_name(rel_clean)
                    assets_out.append(
                        {
                            "id": aid,
                            "sourceId": src_id,
                            "sourceName": src_name,
                            "sourceKind": "wonderdraft",
                            "internalPath": rel_clean,
                            "displayName": disp_name,
                            "category": "symbol",
                            "worldGroup": w_group,
                            "widthPx": w,
                            "heightPx": h,
                            "defaultPpi": 128,
                            "drawMode": draw_mode,
                            "dominantHex": "#8C7A68",
                            "castsShadow": False,
                            "anchorOffsetX": int(sym_meta.get("offset_x", 0) or 0),
                            "anchorOffsetY": int(sym_meta.get("offset_y", 0) or 0),
                            "tags": tags,
                        }
                    )
                    src_entry["assetCount"] += 1

    for src in sources_map.values():
        src["ramEstimateMb"] = round(src["assetCount"] * 0.012 + 0.5, 1)

    INDEX_PATH.write_text(json.dumps(stream_index), encoding="utf-8")
    MANIFEST_PATH.write_text(
        json.dumps(
            {
                "version": "1.0.0",
                "sources": list(sources_map.values()),
                "assets": assets_out,
            }
        ),
        encoding="utf-8",
    )

    print(f"Indexed {len(assets_out)} assets across {len(sources_map)} sources ({len(seen_pck_keys)} unique Dungeondraft PCKs, {skipped_dupes} duplicate PCKs skipped).")
    if skipped_bad:
        print(f"Skipped {len(skipped_bad)} corrupted archive entries:")
        for b in skipped_bad:
            print("  -", b)
    for src in sources_map.values():
        print(f"  * {src['name']} [{src['kind']}]: {src['assetCount']} assets")


if __name__ == "__main__":
    main()

use crate::vault::{SourceKind, VaultAsset};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use thiserror::Error;

const PCK_MAGIC: &[u8; 4] = b"GDPC";

#[derive(Debug, Error)]
pub enum PckError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Invalid Godot PCK header (expected GDPC magic)")]
    InvalidMagic,
    #[error("Unsupported PCK format version: {0}")]
    UnsupportedVersion(u32),
    #[error("Truncated or corrupt PCK directory entry")]
    CorruptEntry,
}

#[derive(Debug, Clone)]
pub struct PckEntry {
    pub path: String,
    pub offset: u64,
    pub size: u64,
}

#[derive(Debug, Clone)]
pub struct PckArchiveIndex {
    pub format_version: u32,
    pub engine_version: (u32, u32, u32),
    pub entries: Vec<PckEntry>,
}

fn read_u32_le<R: Read>(r: &mut R) -> Result<u32, PckError> {
    let mut b = [0u8; 4];
    r.read_exact(&mut b)?;
    Ok(u32::from_le_bytes(b))
}

fn read_u64_le<R: Read>(r: &mut R) -> Result<u64, PckError> {
    let mut b = [0u8; 8];
    r.read_exact(&mut b)?;
    Ok(u64::from_le_bytes(b))
}

/// Parses the file index of a Godot 3/4 `.dungeondraft_pack` (PCK) archive strictly read-only
/// without unpacking any textures to disk or loading image payloads into RAM.
pub fn parse_pck_index(path: &Path) -> Result<PckArchiveIndex, PckError> {
    let mut f = File::open(path)?;
    let mut magic = [0u8; 4];
    f.read_exact(&mut magic)?;
    if &magic != PCK_MAGIC {
        return Err(PckError::InvalidMagic);
    }

    let format_version = read_u32_le(&mut f)?;
    if format_version > 2 {
        return Err(PckError::UnsupportedVersion(format_version));
    }

    let major = read_u32_le(&mut f)?;
    let minor = read_u32_le(&mut f)?;
    let patch = read_u32_le(&mut f)?;

    let mut base_offset = 0u64;
    if format_version == 2 {
        let _flags = read_u32_le(&mut f)?;
        base_offset = read_u64_le(&mut f)?;
    }

    // Skip 16 reserved u32 header fields (64 bytes)
    f.seek(SeekFrom::Current(64))?;

    let file_count = read_u32_le(&mut f)?;
    if file_count > 500_000 {
        return Err(PckError::CorruptEntry);
    }

    let mut entries = Vec::with_capacity(file_count as usize);
    for _ in 0..file_count {
        let path_len = read_u32_le(&mut f)?;
        if path_len == 0 || path_len > 4096 {
            return Err(PckError::CorruptEntry);
        }
        let mut path_buf = vec![0u8; path_len as usize];
        f.read_exact(&mut path_buf)?;
        let raw_path = String::from_utf8_lossy(&path_buf)
            .trim_end_matches('\0')
            .to_string();

        let offset = read_u64_le(&mut f)? + base_offset;
        let size = read_u64_le(&mut f)?;
        // Skip 16-byte MD5 digest
        f.seek(SeekFrom::Current(16))?;
        if format_version == 2 {
            let _entry_flags = read_u32_le(&mut f)?;
        }

        entries.push(PckEntry {
            path: raw_path,
            offset,
            size,
        });
    }

    Ok(PckArchiveIndex {
        format_version,
        engine_version: (major, minor, patch),
        entries,
    })
}

/// O(1) random-access read of a single asset slice from a mounted `.dungeondraft_pack`.
pub fn read_pck_slice(path: &Path, offset: u64, length: u64) -> Result<Vec<u8>, PckError> {
    let mut f = File::open(path)?;
    f.seek(SeekFrom::Start(offset))?;
    let mut buf = vec![0u8; length as usize];
    f.read_exact(&mut buf)?;
    Ok(buf)
}

/// Indexes a `.dungeondraft_pack` file into VaultAsset records with parsed `.dungeondraft_tags`.
pub fn index_dungeondraft_pack(
    pack_path: &Path,
    source_id: &str,
    source_name: &str,
) -> Result<Vec<VaultAsset>, PckError> {
    let idx = parse_pck_index(pack_path)?;

    // Collect optional Dungeondraft tag definitions from `data/default.dungeondraft_tags`
    let mut path_tags: HashMap<String, Vec<String>> = HashMap::new();
    for entry in &idx.entries {
        if entry.path.ends_with(".dungeondraft_tags") {
            if let Ok(bytes) = read_pck_slice(pack_path, entry.offset, entry.size) {
                if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&bytes) {
                    if let Some(tags_obj) = json.get("tags").and_then(|v| v.as_object()) {
                        for (tag_name, arr) in tags_obj {
                            if let Some(paths) = arr.as_array() {
                                for p in paths {
                                    if let Some(ps) = p.as_str() {
                                        path_tags
                                            .entry(ps.to_string())
                                            .or_default()
                                            .push(tag_name.to_lowercase());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    let mut assets = Vec::new();
    for entry in idx.entries {
        let lower = entry.path.to_lowercase();
        let is_img = lower.ends_with(".png") || lower.ends_with(".webp");
        if !is_img || lower.contains("/preview") || lower.ends_with(".import") {
            continue;
        }

        let category = if lower.contains("/walls/") {
            "wall"
        } else if lower.contains("/terrain/") || lower.contains("/tilesets/") {
            "terrain"
        } else if lower.contains("/paths/") {
            "path"
        } else if lower.contains("/portals/") {
            "portal"
        } else if lower.contains("/lights/") {
            "light"
        } else {
            "object"
        };

        let draw_mode = if lower.contains("colorable") || lower.contains("_rgb") {
            "rgb_channels"
        } else {
            "normal"
        };

        let stem = Path::new(&entry.path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Asset");
        let display_name = stem.replace(['_', '-'], " ");

        let mut tags = derive_tags_from_path(&entry.path);
        for (k, v) in &path_tags {
            if entry.path.ends_with(k) {
                tags.extend(v.clone());
            }
        }
        tags.sort();
        tags.dedup();

        let id = blake3::hash(format!("{source_id}:{}", entry.path).as_bytes())
            .to_hex()[..24]
            .to_string();

        assets.push(VaultAsset {
            id,
            source_id: source_id.to_string(),
            source_name: source_name.to_string(),
            source_kind: SourceKind::DungeondraftPack,
            internal_path: entry.path,
            byte_offset: Some(entry.offset),
            byte_length: Some(entry.size),
            display_name,
            category: category.to_string(),
            width_px: 256,
            height_px: 256,
            default_ppi: 256.0,
            draw_mode: draw_mode.to_string(),
            dominant_hex: None,
            casts_shadow: category == "wall" || category == "object",
            is_favorite: false,
            tags,
            metadata_json: None,
        });
    }

    Ok(assets)
}

pub fn derive_tags_from_path(rel_path: &str) -> Vec<String> {
    let skip = [
        "res:",
        "packs",
        "textures",
        "sprites",
        "assets",
        "objects",
        "walls",
        "terrain",
        "paths",
        "portals",
    ];
    rel_path
        .split(['/', '\\', '_', '-', '.', ' '])
        .map(|s| s.trim().to_lowercase())
        .filter(|s| s.len() >= 3 && !skip.contains(&s.as_str()) && !s.chars().all(|c| c.is_numeric()))
        .take(10)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn parses_synthetic_godot3_pck_and_reads_slice() {
        let mut tmp = NamedTempFile::new().unwrap();
        let entry_path = b"res://packs/test/textures/objects/tavern_barrel_colorable.png\0\0\0";
        let payload = b"FAKE_PNG_BYTES_FOR_TEST";

        // Compute header size: magic(4) + ver(4) + eng(12) + reserved(64) + count(4)
        // + path_len(4) + path + offset(8) + size(8) + md5(16)
        let data_offset: u64 = 4 + 4 + 12 + 64 + 4 + 4 + (entry_path.len() as u64) + 8 + 8 + 16;

        tmp.write_all(PCK_MAGIC).unwrap();
        tmp.write_all(&1u32.to_le_bytes()).unwrap(); // format_version 1
        tmp.write_all(&3u32.to_le_bytes()).unwrap(); // Godot 3.5.0
        tmp.write_all(&5u32.to_le_bytes()).unwrap();
        tmp.write_all(&0u32.to_le_bytes()).unwrap();
        tmp.write_all(&[0u8; 64]).unwrap(); // reserved
        tmp.write_all(&1u32.to_le_bytes()).unwrap(); // 1 entry
        tmp.write_all(&(entry_path.len() as u32).to_le_bytes()).unwrap();
        tmp.write_all(entry_path).unwrap();
        tmp.write_all(&data_offset.to_le_bytes()).unwrap();
        tmp.write_all(&(payload.len() as u64).to_le_bytes()).unwrap();
        tmp.write_all(&[0u8; 16]).unwrap(); // md5
        tmp.write_all(payload).unwrap();
        tmp.flush().unwrap();

        let assets = index_dungeondraft_pack(tmp.path(), "src-dd", "Test Pack").unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].category, "object");
        assert_eq!(assets[0].draw_mode, "rgb_channels");
        assert!(assets[0].tags.contains(&"tavern".to_string()));

        let slice = read_pck_slice(
            tmp.path(),
            assets[0].byte_offset.unwrap(),
            assets[0].byte_length.unwrap(),
        )
        .unwrap();
        assert_eq!(slice, payload);
    }
}

use crate::vault::pck_reader::derive_tags_from_path;
use crate::vault::{SourceKind, VaultAsset};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use walkdir::WalkDir;
use zip::ZipArchive;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DcPackManifest {
    pub spec_version: String,
    pub id: String,
    pub name: String,
    pub author: Option<String>,
    pub license: Option<String>,
    pub default_ppi: Option<f32>,
    #[serde(default)]
    pub assets: Vec<DcPackAssetEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DcPackAssetEntry {
    pub path: String,
    pub display_name: Option<String>,
    pub category: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub draw_mode: Option<String>,
    pub default_ppi: Option<f32>,
    pub casts_shadow: Option<bool>,
    pub dominant_hex: Option<String>,
    pub width_px: Option<u32>,
    pub height_px: Option<u32>,
}

pub fn read_zip_entry(zip_path: &Path, internal_path: &str) -> Result<Vec<u8>, String> {
    let f = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(f).map_err(|e| e.to_string())?;
    let mut entry = archive.by_name(internal_path).map_err(|e| e.to_string())?;
    let mut buf = Vec::with_capacity(entry.size() as usize);
    entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

pub fn index_dcpack_or_zip(
    zip_path: &Path,
    source_id: &str,
    source_name: &str,
    kind: SourceKind,
) -> Result<Vec<VaultAsset>, String> {
    let f = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(f).map_err(|e| e.to_string())?;

    let manifest: Option<DcPackManifest> = archive
        .by_name("manifest.json")
        .ok()
        .and_then(|mut entry| {
            let mut s = String::new();
            entry.read_to_string(&mut s).ok()?;
            serde_json::from_str(&s).ok()
        });

    let mut manifest_map: HashMap<String, DcPackAssetEntry> = HashMap::new();
    let default_ppi = manifest.as_ref().and_then(|m| m.default_ppi).unwrap_or(256.0);
    if let Some(m) = manifest {
        for a in m.assets {
            manifest_map.insert(a.path.replace('\\', "/"), a);
        }
    }

    let mut assets = Vec::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() {
            continue;
        }
        let name = entry.name().replace('\\', "/");
        let lower = name.to_lowercase();
        if !(lower.ends_with(".png") || lower.ends_with(".webp") || lower.ends_with(".svg")) {
            continue;
        }

        let meta = manifest_map.get(&name);
        let category = meta
            .and_then(|m| m.category.clone())
            .unwrap_or_else(|| infer_category(&lower).to_string());
        let stem = Path::new(&name)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Asset");
        let display_name = meta
            .and_then(|m| m.display_name.clone())
            .unwrap_or_else(|| stem.replace(['_', '-'], " "));

        let mut tags = meta.map(|m| m.tags.clone()).unwrap_or_default();
        tags.extend(derive_tags_from_path(&name));
        tags.sort();
        tags.dedup();

        let id = blake3::hash(format!("{source_id}:{name}").as_bytes())
            .to_hex()[..24]
            .to_string();

        assets.push(VaultAsset {
            id,
            source_id: source_id.to_string(),
            source_name: source_name.to_string(),
            source_kind: kind.clone(),
            internal_path: name,
            byte_offset: None,
            byte_length: Some(entry.size()),
            display_name,
            category: category.clone(),
            width_px: meta.and_then(|m| m.width_px).unwrap_or(256),
            height_px: meta.and_then(|m| m.height_px).unwrap_or(256),
            default_ppi: meta.and_then(|m| m.default_ppi).unwrap_or(default_ppi),
            draw_mode: meta
                .and_then(|m| m.draw_mode.clone())
                .unwrap_or_else(|| "normal".into()),
            dominant_hex: meta.and_then(|m| m.dominant_hex.clone()),
            casts_shadow: meta
                .and_then(|m| m.casts_shadow)
                .unwrap_or(category == "object" || category == "wall"),
            is_favorite: false,
            tags,
            metadata_json: None,
        });
    }

    Ok(assets)
}

pub fn index_loose_folder(
    root: &Path,
    source_id: &str,
    source_name: &str,
) -> Result<Vec<VaultAsset>, String> {
    let manifest_path = root.join("manifest.json");
    let manifest: Option<DcPackManifest> = std::fs::read_to_string(&manifest_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    let mut manifest_map: HashMap<String, DcPackAssetEntry> = HashMap::new();
    let default_ppi = manifest.as_ref().and_then(|m| m.default_ppi).unwrap_or(256.0);
    if let Some(m) = manifest {
        for a in m.assets {
            manifest_map.insert(a.path.replace('\\', "/"), a);
        }
    }

    let mut assets = Vec::new();
    for entry in WalkDir::new(root).into_iter().filter_map(Result::ok) {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if ext != "png" && ext != "webp" && ext != "svg" {
            continue;
        }

        let rel = path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");
        let lower = rel.to_lowercase();
        let meta = manifest_map.get(&rel);

        let category = meta
            .and_then(|m| m.category.clone())
            .unwrap_or_else(|| infer_category(&lower).to_string());
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Asset");
        let display_name = meta
            .and_then(|m| m.display_name.clone())
            .unwrap_or_else(|| stem.replace(['_', '-'], " "));

        let mut tags = meta.map(|m| m.tags.clone()).unwrap_or_default();
        tags.extend(derive_tags_from_path(&rel));
        tags.sort();
        tags.dedup();

        let id = blake3::hash(format!("{source_id}:{rel}").as_bytes())
            .to_hex()[..24]
            .to_string();

        assets.push(VaultAsset {
            id,
            source_id: source_id.to_string(),
            source_name: source_name.to_string(),
            source_kind: SourceKind::Folder,
            internal_path: rel,
            byte_offset: None,
            byte_length: None,
            display_name,
            category: category.clone(),
            width_px: meta.and_then(|m| m.width_px).unwrap_or(256),
            height_px: meta.and_then(|m| m.height_px).unwrap_or(256),
            default_ppi: meta.and_then(|m| m.default_ppi).unwrap_or(default_ppi),
            draw_mode: meta
                .and_then(|m| m.draw_mode.clone())
                .unwrap_or_else(|| "normal".into()),
            dominant_hex: meta.and_then(|m| m.dominant_hex.clone()),
            casts_shadow: meta
                .and_then(|m| m.casts_shadow)
                .unwrap_or(category == "object" || category == "wall"),
            is_favorite: false,
            tags,
            metadata_json: None,
        });
    }
    Ok(assets)
}

fn infer_category(lower: &str) -> &'static str {
    if lower.contains("terrain") || lower.contains("floor") || lower.contains("ground") {
        "terrain"
    } else if lower.contains("wall") || lower.contains("railing") {
        "wall"
    } else if lower.contains("path") || lower.contains("track") || lower.contains("cable") || lower.contains("cliff") {
        "path"
    } else if lower.contains("portal") || lower.contains("door") || lower.contains("window") || lower.contains("gate") {
        "portal"
    } else if lower.contains("light") || lower.contains("flare") {
        "light"
    } else {
        "object"
    }
}

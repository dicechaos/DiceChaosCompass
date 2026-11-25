use crate::vault::pck_reader::derive_tags_from_path;
use crate::vault::{SourceKind, VaultAsset};
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Clone, Deserialize)]
pub struct WonderdraftSymbolMeta {
    pub name: Option<String>,
    pub radius: Option<f32>,
    pub offset_x: Option<f32>,
    pub offset_y: Option<f32>,
    pub draw_mode: Option<String>,
}

/// Scans a Wonderdraft `assets/` directory, parsing `.wonderdraft_symbols` metadata
/// (`sample_color`, `custom_colors`, offsets) without altering any files on disk.
pub fn index_wonderdraft_folder(
    root: &Path,
    source_id: &str,
    source_name: &str,
) -> Result<Vec<VaultAsset>, String> {
    let mut assets = Vec::new();
    let mut meta_cache: HashMap<String, HashMap<String, WonderdraftSymbolMeta>> = HashMap::new();

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
        if ext != "png" && ext != "webp" {
            continue;
        }

        let dir_key = path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        if !meta_cache.contains_key(&dir_key) {
            let dotfile = path.parent().unwrap_or(root).join(".wonderdraft_symbols");
            let parsed = std::fs::read_to_string(&dotfile)
                .ok()
                .and_then(|s| serde_json::from_str::<HashMap<String, WonderdraftSymbolMeta>>(&s).ok())
                .unwrap_or_default();
            meta_cache.insert(dir_key.clone(), parsed);
        }

        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("Symbol");
        let meta = meta_cache.get(&dir_key).and_then(|m| m.get(stem));

        let draw_mode = match meta.and_then(|m| m.draw_mode.as_deref()) {
            Some("sample_color") => "sample_color",
            Some("custom_colors") | Some("custom_colors_2") => "rgb_channels",
            _ => "normal",
        };

        let rel = path
            .strip_prefix(root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");

        let display_name = meta
            .and_then(|m| m.name.clone())
            .unwrap_or_else(|| stem.replace(['_', '-'], " "));

        let mut tags = derive_tags_from_path(&rel);
        tags.push("wonderdraft".into());
        tags.sort();
        tags.dedup();

        let id = blake3::hash(format!("{source_id}:{rel}").as_bytes())
            .to_hex()[..24]
            .to_string();

        assets.push(VaultAsset {
            id,
            source_id: source_id.to_string(),
            source_name: source_name.to_string(),
            source_kind: SourceKind::Wonderdraft,
            internal_path: rel,
            byte_offset: None,
            byte_length: None,
            display_name,
            category: "symbol".into(),
            width_px: 256,
            height_px: 256,
            default_ppi: 256.0,
            draw_mode: draw_mode.into(),
            dominant_hex: None,
            casts_shadow: false,
            is_favorite: false,
            tags,
            metadata_json: meta.map(|m| {
                serde_json::json!({
                    "radius": m.radius,
                    "offsetX": m.offset_x,
                    "offsetY": m.offset_y,
                })
                .to_string()
            }),
        });
    }

    Ok(assets)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn parses_wonderdraft_symbols_dotfile() {
        let dir = tempdir().unwrap();
        let sub = dir.path().join("sprites/mountains/alpine");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(sub.join("peak_01.png"), b"PNG").unwrap();
        std::fs::write(
            sub.join(".wonderdraft_symbols"),
            r#"{"peak_01":{"name":"Alpine Peak","draw_mode":"custom_colors","radius":42}}"#,
        )
        .unwrap();

        let assets = index_wonderdraft_folder(dir.path(), "wd-1", "Alpine Pack").unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].display_name, "Alpine Peak");
        assert_eq!(assets[0].draw_mode, "rgb_channels");
    }
}

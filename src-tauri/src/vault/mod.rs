pub mod db;
pub mod dcpack_reader;
pub mod pck_reader;
pub mod thumbnails;
pub mod wonderdraft_reader;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SourceKind {
    Folder,
    Zip,
    DungeondraftPack,
    Wonderdraft,
    Dcpack,
}

impl SourceKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Folder => "folder",
            Self::Zip => "zip",
            Self::DungeondraftPack => "dungeondraft_pack",
            Self::Wonderdraft => "wonderdraft",
            Self::Dcpack => "dcpack",
        }
    }

    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s {
            "zip" => Self::Zip,
            "dungeondraft_pack" => Self::DungeondraftPack,
            "wonderdraft" => Self::Wonderdraft,
            "dcpack" => Self::Dcpack,
            _ => Self::Folder,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSource {
    pub id: String,
    pub kind: SourceKind,
    pub name: String,
    pub root_path: String,
    pub enabled: bool,
    pub asset_count: u64,
    pub last_indexed_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultAsset {
    pub id: String,
    pub source_id: String,
    pub source_name: String,
    pub source_kind: SourceKind,
    pub internal_path: String,
    pub byte_offset: Option<u64>,
    pub byte_length: Option<u64>,
    pub display_name: String,
    pub category: String,
    pub width_px: u32,
    pub height_px: u32,
    pub default_ppi: f32,
    pub draw_mode: String,
    pub dominant_hex: Option<String>,
    pub casts_shadow: bool,
    pub is_favorite: bool,
    pub tags: Vec<String>,
    pub metadata_json: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BiomeKit {
    pub id: String,
    pub name: String,
    pub accent_hex: String,
    pub sort_order: i32,
    pub item_count: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSearchQuery {
    pub text: Option<String>,
    pub category: Option<String>,
    pub source_id: Option<String>,
    pub kit_id: Option<String>,
    pub tags: Vec<String>,
    pub favorites_only: bool,
    pub colorable_only: bool,
    pub dominant_hex: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Read raw image bytes for an indexed asset on demand without unpacking entire packs.
pub fn read_asset_bytes(source: &VaultSource, asset: &VaultAsset) -> Result<Vec<u8>, String> {
    let root = PathBuf::from(&source.root_path);
    match source.kind {
        SourceKind::Folder | SourceKind::Wonderdraft => {
            let full = root.join(&asset.internal_path);
            std::fs::read(&full)
                .map_err(|e| format!("Failed reading loose asset {}: {}", full.display(), e))
        }
        SourceKind::DungeondraftPack => {
            let offset = asset
                .byte_offset
                .ok_or_else(|| "Missing PCK byte_offset for asset".to_string())?;
            let length = asset
                .byte_length
                .ok_or_else(|| "Missing PCK byte_length for asset".to_string())?;
            pck_reader::read_pck_slice(&root, offset, length)
                .map_err(|e| format!("PCK slice read failed: {e}"))
        }
        SourceKind::Zip | SourceKind::Dcpack => {
            dcpack_reader::read_zip_entry(&root, &asset.internal_path)
                .map_err(|e| format!("ZIP/dcpack entry read failed: {e}"))
        }
    }
}

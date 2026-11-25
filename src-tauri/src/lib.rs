pub mod export;
pub mod project;
pub mod vault;

use crate::export::pdf_tiler::{write_tiled_print_pdf, PaperSize};
use crate::export::tile_stitcher::{ExportSessionStore, TileStitchSession};
use crate::export::tv_calibration::{compute_tv_calibration, TvCalibration};
use crate::export::uvtt::{build_uvtt_document, write_uvtt_file, UvttExportInput};
use crate::vault::db::VaultDb;
use crate::vault::{BiomeKit, SourceKind, VaultAsset, VaultSearchQuery, VaultSource};
use parking_lot::Mutex;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

pub struct AppState {
    pub db: Mutex<VaultDb>,
    pub export_sessions: Mutex<ExportSessionStore>,
    pub thumb_cache_dir: PathBuf,
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
fn vault_list_sources(state: State<'_, AppState>) -> Result<Vec<VaultSource>, String> {
    state.db.lock().list_sources().map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_search_assets(
    state: State<'_, AppState>,
    query: VaultSearchQuery,
) -> Result<Vec<VaultAsset>, String> {
    state
        .db
        .lock()
        .search_assets(&query)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_list_biome_kits(state: State<'_, AppState>) -> Result<Vec<BiomeKit>, String> {
    state.db.lock().list_biome_kits().map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_toggle_favorite(state: State<'_, AppState>, asset_id: String) -> Result<bool, String> {
    state
        .db
        .lock()
        .toggle_favorite(&asset_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn vault_mount_source(state: State<'_, AppState>, path: String) -> Result<VaultSource, String> {
    let pb = PathBuf::from(&path);
    if !pb.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    let name = pb
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Mounted Source")
        .to_string();
    let lower = path.to_lowercase();
    let source_id = Uuid::now_v7().to_string();

    let (kind, assets) = if lower.ends_with(".dungeondraft_pack") {
        let a = vault::pck_reader::index_dungeondraft_pack(&pb, &source_id, &name)
            .map_err(|e| e.to_string())?;
        (SourceKind::DungeondraftPack, a)
    } else if lower.ends_with(".dcpack") {
        let a = vault::dcpack_reader::index_dcpack_or_zip(&pb, &source_id, &name, SourceKind::Dcpack)?;
        (SourceKind::Dcpack, a)
    } else if lower.ends_with(".zip") {
        let a = vault::dcpack_reader::index_dcpack_or_zip(&pb, &source_id, &name, SourceKind::Zip)?;
        (SourceKind::Zip, a)
    } else if pb.join("sprites").exists() {
        let a = vault::wonderdraft_reader::index_wonderdraft_folder(&pb, &source_id, &name)?;
        (SourceKind::Wonderdraft, a)
    } else {
        let a = vault::dcpack_reader::index_loose_folder(&pb, &source_id, &name)?;
        (SourceKind::Folder, a)
    };

    let source = VaultSource {
        id: source_id,
        kind,
        name: name.clone(),
        root_path: path,
        enabled: true,
        asset_count: assets.len() as u64,
        last_indexed_at: now_unix(),
    };

    let mut db = state.db.lock();
    db.upsert_source(&source).map_err(|e| e.to_string())?;
    db.batch_upsert_assets(&name, &assets)
        .map_err(|e| e.to_string())?;

    Ok(source)
}

#[tauri::command]
fn export_tv_calibration(
    diagonal_inches: f64,
    resolution_width: u32,
    resolution_height: u32,
) -> TvCalibration {
    compute_tv_calibration(diagonal_inches, resolution_width, resolution_height)
}

#[tauri::command]
fn export_begin_session(
    state: State<'_, AppState>,
    width: u32,
    height: u32,
) -> Result<String, String> {
    let session_id = Uuid::now_v7().to_string();
    let session = TileStitchSession::new(width, height)?;
    state
        .export_sessions
        .lock()
        .sessions
        .insert(session_id.clone(), session);
    Ok(session_id)
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
fn export_write_tile(
    state: State<'_, AppState>,
    session_id: String,
    dest_x: u32,
    dest_y: u32,
    tile_w: u32,
    tile_h: u32,
    bleed_left: u32,
    bleed_top: u32,
    src_stride_w: u32,
    rgba_pixels: Vec<u8>,
) -> Result<(), String> {
    let mut store = state.export_sessions.lock();
    let session = store
        .sessions
        .get_mut(&session_id)
        .ok_or_else(|| format!("Unknown export session: {session_id}"))?;
    session.write_tile(
        dest_x,
        dest_y,
        tile_w,
        tile_h,
        bleed_left,
        bleed_top,
        src_stride_w,
        &rgba_pixels,
    )
}

#[tauri::command]
fn export_finalize_session(
    state: State<'_, AppState>,
    session_id: String,
    out_path: String,
    format: String,
    uvtt_input: Option<UvttExportInput>,
    pdf_paper: Option<String>,
    pdf_ppi: Option<f64>,
) -> Result<String, String> {
    let session = state
        .export_sessions
        .lock()
        .sessions
        .remove(&session_id)
        .ok_or_else(|| format!("Unknown export session: {session_id}"))?;

    let pb = PathBuf::from(&out_path);
    if let Some(uvtt) = uvtt_input {
        let png_bytes = session.encode_png_bytes()?;
        let doc = build_uvtt_document(uvtt, &png_bytes);
        write_uvtt_file(&pb, &doc)?;
        return Ok(out_path);
    }

    if let Some(paper_name) = pdf_paper {
        let ppi = pdf_ppi.unwrap_or(80.11);
        write_tiled_print_pdf(&pb, &session.canvas, ppi, PaperSize::from_str(&paper_name), 0.5)?;
        return Ok(out_path);
    }

    session.save_to_file(&pb, &format)?;
    Ok(out_path)
}

#[tauri::command]
fn project_save_file(path: String, json_content: String) -> Result<(), String> {
    project::save_dcmap_atomic(&PathBuf::from(path), &json_content)
}

#[tauri::command]
fn project_load_file(path: String) -> Result<String, String> {
    project::load_dcmap(&PathBuf::from(path))
}

#[tauri::command]
fn open_asset_vault_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("asset-vault") {
        let _ = win.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(
        &app,
        "asset-vault",
        WebviewUrl::App("index.html?view=asset-vault".into()),
    )
    .title("Dice Chaos Maps — Asset Vault")
    .inner_size(1280.0, 820.0)
    .min_inner_size(860.0, 560.0)
    .build()
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn percent_decode_path(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(h), Some(l)) = (
                (bytes[i + 1] as char).to_digit(16),
                (bytes[i + 2] as char).to_digit(16),
            ) {
                out.push(((h << 4) | l) as u8);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn sanitize_relative_asset_path(raw_uri_path: &str) -> Option<PathBuf> {
    let decoded = percent_decode_path(raw_uri_path);
    let trimmed = decoded.trim_start_matches('/');
    if trimmed.is_empty() {
        return None;
    }
    let mut clean = PathBuf::new();
    for comp in std::path::Path::new(trimmed).components() {
        match comp {
            std::path::Component::Normal(part) => clean.push(part),
            std::path::Component::CurDir => {}
            _ => return None,
        }
    }
    if clean.as_os_str().is_empty() {
        None
    } else {
        Some(clean)
    }
}

fn mime_for_asset_path(path: &std::path::Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("svg") => "image/svg+xml",
        Some("json") => "application/json; charset=utf-8",
        _ => "application/octet-stream",
    }
}

fn build_dcasset_response(
    status: u16,
    content_type: &str,
    cache_control: &str,
    body: Vec<u8>,
) -> tauri::http::Response<Vec<u8>> {
    tauri::http::Response::builder()
        .status(status)
        .header("Content-Type", content_type)
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", cache_control)
        .body(body)
        .unwrap_or_else(|_| tauri::http::Response::new(Vec::new()))
}

fn serve_dcasset_request<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    let Some(rel_path) = sanitize_relative_asset_path(request.uri().path()) else {
        return build_dcasset_response(
            400,
            "text/plain; charset=utf-8",
            "no-cache",
            b"Invalid asset path".to_vec(),
        );
    };

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(res_dir) = app.path().resource_dir() {
        candidates.push(res_dir.join("assets").join(&rel_path));
        candidates.push(res_dir.join("_up_").join("public").join("assets").join(&rel_path));
        candidates.push(res_dir.join(&rel_path));
    }
    #[cfg(debug_assertions)]
    {
        candidates.push(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../public/assets")
                .join(&rel_path),
        );
    }

    for candidate in candidates {
        if let Ok(bytes) = std::fs::read(&candidate) {
            let mime = mime_for_asset_path(&candidate);
            let cache = if mime.starts_with("application/json") {
                "no-cache"
            } else {
                "public, max-age=31536000, immutable"
            };
            return build_dcasset_response(200, mime, cache, bytes);
        }
    }

    build_dcasset_response(
        404,
        "text/plain; charset=utf-8",
        "no-cache",
        b"Asset not found".to_vec(),
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .register_uri_scheme_protocol("dcasset", |ctx, request| {
            serve_dcasset_request(ctx.app_handle(), request)
        })
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from(".vault-cache"));
            std::fs::create_dir_all(&data_dir)?;
            let thumb_cache_dir = data_dir.join("thumbs");
            std::fs::create_dir_all(&thumb_cache_dir)?;

            let db_path = data_dir.join("vault.sqlite3");
            let db = VaultDb::open(&db_path).map_err(|e| e.to_string())?;

            app.manage(AppState {
                db: Mutex::new(db),
                export_sessions: Mutex::new(ExportSessionStore::default()),
                thumb_cache_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault_list_sources,
            vault_search_assets,
            vault_list_biome_kits,
            vault_toggle_favorite,
            vault_mount_source,
            export_tv_calibration,
            export_begin_session,
            export_write_tile,
            export_finalize_session,
            project_save_file,
            project_load_file,
            open_asset_vault_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Dice Chaos Maps");
}

#[cfg(test)]
mod dcasset_tests {
    use super::*;

    #[test]
    fn rejects_path_traversal_attempts() {
        assert!(sanitize_relative_asset_path("/../secret.txt").is_none());
        assert!(sanitize_relative_asset_path("/starter-cc0/../../etc/passwd").is_none());
        assert!(sanitize_relative_asset_path("").is_none());
        assert!(sanitize_relative_asset_path("/").is_none());
    }

    #[test]
    fn decodes_valid_bundled_asset_paths() {
        let p = sanitize_relative_asset_path("/starter-cc0/props/test%20prop.png")
            .expect("valid relative asset path");
        assert_eq!(p, PathBuf::from("starter-cc0/props/test prop.png"));
        assert_eq!(mime_for_asset_path(&p), "image/png");
    }
}

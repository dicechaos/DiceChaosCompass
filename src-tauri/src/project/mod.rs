use std::fs;
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

/// Atomic crash-safe save for `.dcmap` JSON project files (write temp -> rename).
pub fn save_dcmap_atomic(path: &Path, json_content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed creating directory: {e}"))?;
    }
    let tmp_path = path.with_extension("dcmap.tmp");
    {
        let mut f = fs::File::create(&tmp_path)
            .map_err(|e| format!("Failed creating temp save file: {e}"))?;
        f.write_all(json_content.as_bytes())
            .map_err(|e| format!("Failed writing project data: {e}"))?;
        f.sync_all()
            .map_err(|e| format!("Failed syncing project file: {e}"))?;
    }
    fs::rename(&tmp_path, path).map_err(|e| format!("Atomic rename failed: {e}"))?;
    Ok(())
}

pub fn load_dcmap(path: &Path) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed reading .dcmap: {e}"))
}

/// Creates a portable self-contained `.dcmapz` archive containing `project.dcmap`
/// and only the referenced local asset payloads.
pub fn bundle_dcmapz(
    out_path: &Path,
    project_json: &str,
    embedded_assets: &[(String, Vec<u8>)],
) -> Result<(), String> {
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let file = fs::File::create(out_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);
    let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    zip.start_file("project.dcmap", opts)
        .map_err(|e| e.to_string())?;
    zip.write_all(project_json.as_bytes())
        .map_err(|e| e.to_string())?;

    for (rel_path, bytes) in embedded_assets {
        zip.start_file(format!("assets/{rel_path}"), opts)
            .map_err(|e| e.to_string())?;
        zip.write_all(bytes).map_err(|e| e.to_string())?;
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

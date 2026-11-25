use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UvttPoint {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UvttResolution {
    pub map_origin: UvttPoint,
    pub map_size: UvttPoint,
    pub pixels_per_grid: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UvttPortal {
    pub position: UvttPoint,
    pub bounds: [UvttPoint; 2],
    pub rotation: f64,
    pub closed: bool,
    pub freestanding: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UvttLight {
    pub position: UvttPoint,
    pub range: f64,
    pub intensity: f64,
    pub color: String,
    pub shadows: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UvttEnvironment {
    pub baked_lighting: bool,
    pub ambient_light: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UvttDocument {
    pub format: f64,
    pub resolution: UvttResolution,
    pub line_of_sight: Vec<Vec<UvttPoint>>,
    pub objects_line_of_sight: Vec<Vec<UvttPoint>>,
    pub portals: Vec<UvttPortal>,
    pub environment: UvttEnvironment,
    pub lights: Vec<UvttLight>,
    pub image: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UvttExportInput {
    pub width_cells: f64,
    pub height_cells: f64,
    pub pixels_per_grid: u32,
    pub line_of_sight: Vec<Vec<UvttPoint>>,
    pub portals: Vec<UvttPortal>,
    pub lights: Vec<UvttLight>,
    pub ambient_light_hex: String,
    pub baked_lighting: bool,
}

pub fn build_uvtt_document(input: UvttExportInput, image_bytes: &[u8]) -> UvttDocument {
    UvttDocument {
        format: 0.3,
        resolution: UvttResolution {
            map_origin: UvttPoint { x: 0.0, y: 0.0 },
            map_size: UvttPoint {
                x: input.width_cells,
                y: input.height_cells,
            },
            pixels_per_grid: input.pixels_per_grid,
        },
        line_of_sight: input.line_of_sight,
        objects_line_of_sight: Vec::new(),
        portals: input.portals,
        environment: UvttEnvironment {
            baked_lighting: input.baked_lighting,
            ambient_light: input.ambient_light_hex,
        },
        lights: input.lights,
        image: BASE64.encode(image_bytes),
    }
}

pub fn write_uvtt_file(path: &Path, doc: &UvttDocument) -> Result<(), String> {
    let json = serde_json::to_string(doc).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| format!("Failed writing UVTT file: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_valid_dd2vtt_payload() {
        let doc = build_uvtt_document(
            UvttExportInput {
                width_cells: 48.0,
                height_cells: 27.0,
                pixels_per_grid: 80,
                line_of_sight: vec![vec![
                    UvttPoint { x: 1.0, y: 1.0 },
                    UvttPoint { x: 10.0, y: 1.0 },
                ]],
                portals: vec![UvttPortal {
                    position: UvttPoint { x: 5.0, y: 1.0 },
                    bounds: [
                        UvttPoint { x: 4.5, y: 1.0 },
                        UvttPoint { x: 5.5, y: 1.0 },
                    ],
                    rotation: 0.0,
                    closed: true,
                    freestanding: false,
                }],
                lights: vec![UvttLight {
                    position: UvttPoint { x: 6.0, y: 4.0 },
                    range: 5.0,
                    intensity: 1.2,
                    color: "ffffaa33".into(),
                    shadows: true,
                }],
                ambient_light_hex: "ff1e293b".into(),
                baked_lighting: true,
            },
            b"\x89PNG\r\n\x1a\nTEST",
        );

        let serialized = serde_json::to_string(&doc).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert_eq!(parsed["resolution"]["pixels_per_grid"], 80);
        assert_eq!(parsed["portals"][0]["closed"], true);
        assert!(!parsed["image"].as_str().unwrap().is_empty());
    }
}

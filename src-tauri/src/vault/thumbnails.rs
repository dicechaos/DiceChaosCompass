use image::imageops::FilterType;
use image::{GenericImageView, ImageFormat};
use std::io::Cursor;

pub struct ThumbnailResult {
    pub png_bytes: Vec<u8>,
    pub width_px: u32,
    pub height_px: u32,
    pub dominant_hex: String,
}

/// Generates a 256px max-edge thumbnail and computes a dominant opaque-pixel color swatch.
pub fn generate_thumbnail(raw_bytes: &[u8], max_edge: u32) -> Result<ThumbnailResult, String> {
    let img = image::load_from_memory(raw_bytes)
        .map_err(|e| format!("Failed decoding asset image: {e}"))?;
    let (width_px, height_px) = img.dimensions();

    let thumb = if width_px > max_edge || height_px > max_edge {
        img.resize(max_edge, max_edge, FilterType::Triangle)
    } else {
        img.clone()
    };

    let rgba = thumb.to_rgba8();
    let mut r_sum: u64 = 0;
    let mut g_sum: u64 = 0;
    let mut b_sum: u64 = 0;
    let mut count: u64 = 0;

    for px in rgba.pixels() {
        if px[3] > 64 {
            r_sum += px[0] as u64;
            g_sum += px[1] as u64;
            b_sum += px[2] as u64;
            count += 1;
        }
    }

    let dominant_hex = if let (Some(r), Some(g), Some(b)) = (
        r_sum.checked_div(count),
        g_sum.checked_div(count),
        b_sum.checked_div(count),
    ) {
        format!("#{r:02X}{g:02X}{b:02X}")
    } else {
        "#4A5568".to_string()
    };

    let mut out = Cursor::new(Vec::new());
    thumb
        .write_to(&mut out, ImageFormat::Png)
        .map_err(|e| format!("Failed encoding thumbnail: {e}"))?;

    Ok(ThumbnailResult {
        png_bytes: out.into_inner(),
        width_px,
        height_px,
        dominant_hex,
    })
}

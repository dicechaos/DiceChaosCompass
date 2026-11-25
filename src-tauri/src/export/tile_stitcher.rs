use image::{ImageFormat, RgbaImage};
use std::collections::HashMap;
use std::path::Path;

pub struct TileStitchSession {
    pub width: u32,
    pub height: u32,
    pub canvas: RgbaImage,
}

impl TileStitchSession {
    pub fn new(width: u32, height: u32) -> Result<Self, String> {
        if width == 0 || height == 0 || width > 32768 || height > 32768 {
            return Err(format!("Unsupported export dimensions: {width}x{height}"));
        }
        Ok(Self {
            width,
            height,
            canvas: RgbaImage::new(width, height),
        })
    }

    /// Pastes a rendered RGBA tile (optionally containing a bleed margin around its content)
    /// cleanly into the destination high-resolution image with zero seams.
    #[allow(clippy::too_many_arguments)]
    pub fn write_tile(
        &mut self,
        dest_x: u32,
        dest_y: u32,
        tile_w: u32,
        tile_h: u32,
        bleed_left: u32,
        bleed_top: u32,
        src_stride_w: u32,
        rgba_pixels: &[u8],
    ) -> Result<(), String> {
        let expected_min = ((bleed_top + tile_h) as usize) * (src_stride_w as usize) * 4;
        if rgba_pixels.len() < expected_min {
            return Err(format!(
                "Tile buffer too small: got {}, expected at least {}",
                rgba_pixels.len(),
                expected_min
            ));
        }

        let copy_w = tile_w.min(self.width.saturating_sub(dest_x));
        let copy_h = tile_h.min(self.height.saturating_sub(dest_y));

        for row in 0..copy_h {
            let src_y = bleed_top + row;
            let src_start = ((src_y * src_stride_w + bleed_left) * 4) as usize;
            let src_end = src_start + (copy_w * 4) as usize;
            let dst_y = dest_y + row;
            let dst_start = ((dst_y * self.width + dest_x) * 4) as usize;
            let dst_end = dst_start + (copy_w * 4) as usize;

            self.canvas.as_mut()[dst_start..dst_end]
                .copy_from_slice(&rgba_pixels[src_start..src_end]);
        }
        Ok(())
    }

    pub fn save_to_file(&self, path: &Path, format: &str) -> Result<(), String> {
        let img_fmt = match format.to_lowercase().as_str() {
            "webp" => ImageFormat::WebP,
            "jpg" | "jpeg" => ImageFormat::Jpeg,
            _ => ImageFormat::Png,
        };
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        self.canvas
            .save_with_format(path, img_fmt)
            .map_err(|e| format!("Failed saving stitched export: {e}"))
    }

    pub fn encode_png_bytes(&self) -> Result<Vec<u8>, String> {
        let mut cursor = std::io::Cursor::new(Vec::new());
        self.canvas
            .write_to(&mut cursor, ImageFormat::Png)
            .map_err(|e| format!("Failed encoding PNG bytes: {e}"))?;
        Ok(cursor.into_inner())
    }
}

#[derive(Default)]
pub struct ExportSessionStore {
    pub sessions: HashMap<String, TileStitchSession>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stitches_4x3_tiles_with_bleed_zero_seams() {
        let total_w = 400u32;
        let total_h = 300u32;
        let tile = 100u32;
        let bleed = 8u32;
        let mut session = TileStitchSession::new(total_w, total_h).unwrap();

        for ty in 0..3u32 {
            for tx in 0..4u32 {
                let stride = tile + bleed * 2;
                let mut buf = vec![0u8; (stride * stride * 4) as usize];
                for py in 0..stride {
                    for px in 0..stride {
                        let gx = (tx * tile) as i32 + px as i32 - bleed as i32;
                        let gy = (ty * tile) as i32 + py as i32 - bleed as i32;
                        let idx = ((py * stride + px) * 4) as usize;
                        buf[idx] = gx.rem_euclid(255) as u8;
                        buf[idx + 1] = gy.rem_euclid(255) as u8;
                        buf[idx + 2] = 128;
                        buf[idx + 3] = 255;
                    }
                }
                session
                    .write_tile(tx * tile, ty * tile, tile, tile, bleed, bleed, stride, &buf)
                    .unwrap();
            }
        }

        // Verify seam pixels at x=99,100,101 and y=99,100,101 match ground truth exactly
        for y in [0, 99, 100, 101, 299] {
            for x in [0, 99, 100, 101, 399] {
                let px = session.canvas.get_pixel(x, y);
                assert_eq!(px[0], (x % 255) as u8);
                assert_eq!(px[1], (y % 255) as u8);
                assert_eq!(px[2], 128);
                assert_eq!(px[3], 255);
            }
        }
    }
}

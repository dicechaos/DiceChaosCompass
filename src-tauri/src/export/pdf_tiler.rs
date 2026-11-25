use flate2::write::ZlibEncoder;
use flate2::Compression;
use image::RgbaImage;
use std::io::Write;
use std::path::Path;

#[derive(Debug, Clone, Copy)]
pub enum PaperSize {
    Letter,  // 8.5 x 11 in
    A4,      // 8.27 x 11.69 in
    Tabloid, // 11 x 17 in
}

impl PaperSize {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "a4" => Self::A4,
            "tabloid" | "ledger" => Self::Tabloid,
            _ => Self::Letter,
        }
    }

    pub fn dimensions_inches(self) -> (f64, f64) {
        match self {
            Self::Letter => (8.5, 11.0),
            Self::A4 => (8.2677, 11.6929),
            Self::Tabloid => (11.0, 17.0),
        }
    }
}

/// Generates a standards-compliant multi-page PDF 1.4 calibrated to exact 1.00-inch physical
/// grid squares with crop marks and assembly tile coordinates (A1, B1, etc.).
pub fn write_tiled_print_pdf(
    path: &Path,
    img: &RgbaImage,
    ppi: f64,
    paper: PaperSize,
    margin_in: f64,
) -> Result<usize, String> {
    let (paper_w_in, paper_h_in) = paper.dimensions_inches();
    let usable_w_in = (paper_w_in - 2.0 * margin_in).max(1.0);
    let usable_h_in = (paper_h_in - 2.0 * margin_in).max(1.0);

    let map_w_in = (img.width() as f64) / ppi.max(1.0);
    let map_h_in = (img.height() as f64) / ppi.max(1.0);

    let cols = (map_w_in / usable_w_in).ceil().max(1.0) as u32;
    let rows = (map_h_in / usable_h_in).ceil().max(1.0) as u32;

    let paper_w_pt = paper_w_in * 72.0;
    let paper_h_pt = paper_h_in * 72.0;
    let margin_pt = margin_in * 72.0;

    let mut objects: Vec<Vec<u8>> = Vec::new();
    // Reserve obj 1 (Catalog), obj 2 (Pages), obj 3 (Helvetica font)
    objects.push(Vec::new());
    objects.push(Vec::new());
    objects.push(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_vec());

    let mut page_obj_ids: Vec<usize> = Vec::new();

    for r in 0..rows {
        for c in 0..cols {
            let sx = ((c as f64) * usable_w_in * ppi).round() as u32;
            let sy = ((r as f64) * usable_h_in * ppi).round() as u32;
            let sw = ((usable_w_in * ppi).round() as u32).min(img.width().saturating_sub(sx));
            let sh = ((usable_h_in * ppi).round() as u32).min(img.height().saturating_sub(sy));
            if sw == 0 || sh == 0 {
                continue;
            }

            // Pack RGB raw bytes compressed with FlateDecode
            let mut rgb = Vec::with_capacity((sw * sh * 3) as usize);
            for py in sy..(sy + sh) {
                for px in sx..(sx + sw) {
                    let p = img.get_pixel(px, py);
                    rgb.push(p[0]);
                    rgb.push(p[1]);
                    rgb.push(p[2]);
                }
            }
            let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
            encoder.write_all(&rgb).map_err(|e| e.to_string())?;
            let compressed = encoder.finish().map_err(|e| e.to_string())?;

            let img_obj_id = objects.len() + 1;
            let mut img_obj = format!(
                "<< /Type /XObject /Subtype /Image /Width {sw} /Height {sh} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length {} >>\nstream\n",
                compressed.len()
            )
            .into_bytes();
            img_obj.extend_from_slice(&compressed);
            img_obj.extend_from_slice(b"\nendstream");
            objects.push(img_obj);

            let draw_w_pt = ((sw as f64) / ppi) * 72.0;
            let draw_h_pt = ((sh as f64) / ppi) * 72.0;
            let y_pt = paper_h_pt - margin_pt - draw_h_pt;
            let col_letter = (b'A' + (c % 26) as u8) as char;
            let label = format!("Dice Chaos Maps | Tile {col_letter}{} | 1.00 in = 1 sq", r + 1);

            let content_stream = format!(
                "q {draw_w_pt:.2} 0 0 {draw_h_pt:.2} {margin_pt:.2} {y_pt:.2} cm /Im0 Do Q\n\
                 q 0.5 w 0.35 0.35 0.35 RG\n\
                 {mx1:.2} {y_pt:.2} m {mx2:.2} {y_pt:.2} l S\n\
                 {margin_pt:.2} {my1:.2} m {margin_pt:.2} {my2:.2} l S\n\
                 {rx1:.2} {top:.2} m {rx2:.2} {top:.2} l S\n\
                 {right:.2} {ty1:.2} m {right:.2} {ty2:.2} l S Q\n\
                 BT /F1 8 Tf 0.4 0.4 0.4 rg {margin_pt:.2} 14 Td ({label}) Tj ET\n",
                mx1 = margin_pt - 12.0,
                mx2 = margin_pt - 2.0,
                my1 = y_pt - 12.0,
                my2 = y_pt - 2.0,
                right = margin_pt + draw_w_pt,
                top = y_pt + draw_h_pt,
                rx1 = margin_pt + draw_w_pt + 2.0,
                rx2 = margin_pt + draw_w_pt + 12.0,
                ty1 = y_pt + draw_h_pt + 2.0,
                ty2 = y_pt + draw_h_pt + 12.0,
            );

            let content_obj_id = objects.len() + 1;
            let content_obj = format!(
                "<< /Length {} >>\nstream\n{}\nendstream",
                content_stream.len(),
                content_stream
            )
            .into_bytes();
            objects.push(content_obj);

            let page_obj_id = objects.len() + 1;
            let page_obj = format!(
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {paper_w_pt:.2} {paper_h_pt:.2}] \
                 /Resources << /XObject << /Im0 {img_obj_id} 0 R >> /Font << /F1 3 0 R >> >> \
                 /Contents {content_obj_id} 0 R >>"
            )
            .into_bytes();
            objects.push(page_obj);
            page_obj_ids.push(page_obj_id);
        }
    }

    let kids_str = page_obj_ids
        .iter()
        .map(|id| format!("{id} 0 R"))
        .collect::<Vec<_>>()
        .join(" ");
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>".to_vec();
    objects[1] = format!(
        "<< /Type /Pages /Kids [ {kids_str} ] /Count {} >>",
        page_obj_ids.len()
    )
    .into_bytes();

    // Serialize PDF with accurate xref table
    let mut pdf = Vec::new();
    pdf.extend_from_slice(b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    let mut offsets: Vec<usize> = Vec::with_capacity(objects.len());

    for (idx, body) in objects.iter().enumerate() {
        offsets.push(pdf.len());
        write!(&mut pdf, "{} 0 obj\n", idx + 1).unwrap();
        pdf.extend_from_slice(body);
        pdf.extend_from_slice(b"\nendobj\n");
    }

    let xref_offset = pdf.len();
    writeln!(&mut pdf, "xref\n0 {}", objects.len() + 1).unwrap();
    pdf.extend_from_slice(b"0000000000 65535 f \n");
    for off in offsets {
        writeln!(&mut pdf, "{off:010} 00000 n ").unwrap();
    }
    writeln!(
        &mut pdf,
        "trailer\n<< /Size {} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF",
        objects.len() + 1
    )
    .unwrap();

    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, pdf).map_err(|e| format!("Failed writing PDF: {e}"))?;
    Ok(page_obj_ids.len())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    #[test]
    fn generates_valid_multi_page_1_inch_pdf() {
        // 16 x 12 inch map at 10 PPI -> should split cleanly across 4 Letter pages (2x2)
        let img = RgbaImage::from_pixel(160, 120, image::Rgba([40, 50, 65, 255]));
        let tmp = NamedTempFile::new().unwrap();
        let pages = write_tiled_print_pdf(tmp.path(), &img, 10.0, PaperSize::Letter, 0.5).unwrap();
        assert_eq!(pages, 4);
        let bytes = std::fs::read(tmp.path()).unwrap();
        assert!(bytes.starts_with(b"%PDF-1.4"));
    }
}

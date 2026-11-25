use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TvCalibration {
    pub diagonal_inches: f64,
    pub resolution_width: u32,
    pub resolution_height: u32,
    pub exact_ppi: f64,
    pub physical_width_inches: f64,
    pub physical_height_inches: f64,
    pub recommended_grid_cols: u32,
    pub recommended_grid_rows: u32,
}

/// Computes exact pixels-per-inch so 1 grid square equals 1.00 physical inch
/// on a tabletop TV running DiceChaosDisplay.
pub fn compute_tv_calibration(
    diagonal_inches: f64,
    resolution_width: u32,
    resolution_height: u32,
) -> TvCalibration {
    let diag_px = ((resolution_width as f64).powi(2) + (resolution_height as f64).powi(2)).sqrt();
    let exact_ppi = diag_px / diagonal_inches.max(1.0);
    let physical_width_inches = (resolution_width as f64) / exact_ppi;
    let physical_height_inches = (resolution_height as f64) / exact_ppi;

    TvCalibration {
        diagonal_inches,
        resolution_width,
        resolution_height,
        exact_ppi: (exact_ppi * 100.0).round() / 100.0,
        physical_width_inches: (physical_width_inches * 100.0).round() / 100.0,
        physical_height_inches: (physical_height_inches * 100.0).round() / 100.0,
        recommended_grid_cols: physical_width_inches.round() as u32,
        recommended_grid_rows: physical_height_inches.round() as u32,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_55_inch_4k_tv_true_1_inch_scale() {
        let cal = compute_tv_calibration(55.0, 3840, 2160);
        assert!((cal.exact_ppi - 80.11).abs() < 0.05);
        assert_eq!(cal.recommended_grid_cols, 48);
        assert_eq!(cal.recommended_grid_rows, 27);
    }

    #[test]
    fn computes_43_inch_4k_tv_scale() {
        let cal = compute_tv_calibration(43.0, 3840, 2160);
        assert!((cal.exact_ppi - 102.46).abs() < 0.05);
        assert_eq!(cal.recommended_grid_cols, 37);
        assert_eq!(cal.recommended_grid_rows, 21);
    }
}

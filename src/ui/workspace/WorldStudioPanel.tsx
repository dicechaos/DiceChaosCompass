import React, { useMemo, useState } from "react";
import {
  Compass,
  Copy,
  Crop,
  Dices,
  Flag,
  Frame,
  Grid3x3,
  MapPin,
  Mountain,
  Paintbrush,
  Palette,
  Route,
  Ruler,
  Save,
  Sparkles,
  Trash2,
  Type,
  Waves,
} from "lucide-react";
import {
  generateWorldName,
  generateWorldNameBatch,
  WORLD_NAME_CULTURES,
  type WorldNameCultureId,
} from "@/engine/worldNameGen";
import {
  loadCustomWorldThemes,
  saveCustomWorldTheme,
  WORLD_BIOME_SWATCHES,
  WORLD_OCEAN_SWATCHES,
  WORLD_THEMES,
} from "@/engine/worldThemes";
import { useDocumentStore } from "@/store/documentStore";
import { SectionCurveEditorCard } from "@/ui/workspace/SectionCurveEditorCard";
import type {
  WorldBiomePaintTarget,
  WorldCoastalEffect,
  WorldFrameStyle,
  WorldGridStyle,
  WorldLabelBoxStyle,
  WorldLabelCategory,
  WorldLandBrushMode,
  WorldLandmassPreset,
  WorldThemeConfig,
  WorldTrailStyle,
  WorldTravelMode,
} from "@/types/map";

const LANDMASS_PRESETS: Array<{ id: WorldLandmassPreset; label: string }> = [
  { id: "continents", label: "Continents" },
  { id: "archipelago", label: "Archipelago" },
  { id: "pangaea", label: "Pangaea" },
  { id: "atoll", label: "Ring Atoll" },
  { id: "inland_sea", label: "Inland Sea" },
  { id: "highlands", label: "Coast & Isles" },
  { id: "equirectangular", label: "World Globe" },
];

const TRAIL_STYLES: Array<{ id: WorldTrailStyle; label: string }> = [
  { id: "dotted", label: "Dotted" },
  { id: "dashed", label: "Dashed" },
  { id: "solid", label: "Solid" },
  { id: "double_road", label: "Imperial Road" },
  { id: "railroad", label: "Railroad" },
  { id: "sea_lane", label: "Sea Lane" },
  { id: "border", label: "Frontier" },
];

const LABEL_CATEGORIES: Array<{
  id: WorldLabelCategory;
  label: string;
  size: number;
  upper: boolean;
  italic: boolean;
  spacing: number;
  box: WorldLabelBoxStyle;
}> = [
  { id: "continent", label: "Continent", size: 20, upper: true, italic: false, spacing: 5.0, box: "none" },
  { id: "ocean", label: "Ocean", size: 15, upper: true, italic: true, spacing: 4.2, box: "none" },
  { id: "region", label: "Region", size: 15, upper: true, italic: false, spacing: 2.6, box: "none" },
  { id: "city", label: "City", size: 11, upper: false, italic: false, spacing: 0.6, box: "none" },
  { id: "river", label: "Town / Village", size: 7, upper: false, italic: false, spacing: 0.3, box: "none" },
  { id: "mountain", label: "Mountain", size: 11, upper: true, italic: false, spacing: 1.8, box: "none" },
  { id: "banner", label: "Title Banner", size: 22, upper: true, italic: false, spacing: 3.4, box: "scroll" },
];

const BOX_STYLES: Array<{ id: WorldLabelBoxStyle; label: string }> = [
  { id: "none", label: "None" },
  { id: "scroll", label: "Scroll" },
  { id: "banner", label: "Banner" },
  { id: "ribbon", label: "Ribbon" },
  { id: "plaque", label: "Plaque" },
];

const COAST_EFFECTS: Array<{ id: WorldCoastalEffect; label: string }> = [
  { id: "ripples", label: "Ripples" },
  { id: "wave_lines", label: "Wave Lines" },
  { id: "stipple", label: "Stipple" },
  { id: "glow", label: "Lagoon Glow" },
  { id: "soft_shadow", label: "Soft Shadow" },
  { id: "hatch", label: "Feudal Hatch" },
  { id: "none", label: "None" },
];

const FRAME_STYLES: Array<{ id: WorldFrameStyle; label: string }> = [
  { id: "stepped_ivory", label: "Stepped Ivory" },
  { id: "classic_double", label: "Classic Double" },
  { id: "ornate_gold", label: "Ornate Gold" },
  { id: "nautical_degree", label: "Nautical Degree" },
  { id: "feudal_ink", label: "Feudal Ink" },
  { id: "torn_parchment", label: "Torn Parchment" },
  { id: "none", label: "None" },
];

const GRID_STYLES: Array<{ id: WorldGridStyle; label: string }> = [
  { id: "none", label: "None" },
  { id: "hex_flat", label: "Hex (Flat)" },
  { id: "hex_pointy", label: "Hex (Pointy)" },
  { id: "square", label: "Square" },
  { id: "lat_lon", label: "Lat / Lon" },
];

const TRAVEL_MODES: Array<{ id: WorldTravelMode; label: string; speed: string }> = [
  { id: "walk", label: "Foot", speed: "24 mi/d" },
  { id: "horse", label: "Horse", speed: "40 mi/d" },
  { id: "ship", label: "Ship", speed: "72 mi/d" },
  { id: "airship", label: "Airship", speed: "192 mi/d" },
];

const pillBtnStyle = (active: boolean, accent = "#E5A93C"): React.CSSProperties => ({
  height: 25,
  padding: "0 8px",
  borderRadius: 6,
  border: `1px solid ${active ? `${accent}CC` : "var(--border-subtle)"}`,
  background: active ? `${accent}24` : "rgba(22, 26, 36, 0.72)",
  color: active ? "#F8FAFC" : "var(--text-secondary)",
  fontSize: 11,
  fontWeight: active ? 700 : 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
});

export const WorldStudioPanel: React.FC = () => {
  const doc = useDocumentStore(
    (s) => s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0],
  );
  const activeTool = useDocumentStore((s) => s.activeTool);
  const selection = useDocumentStore((s) => s.selection);

  // Landmass Sculpt + Wizard state
  const worldLandMode = useDocumentStore((s) => s.worldLandMode);
  const worldLandRadiusCells = useDocumentStore((s) => s.worldLandRadiusCells);
  const worldLandRoughness = useDocumentStore((s) => s.worldLandRoughness);
  const worldLandStrength = useDocumentStore((s) => s.worldLandStrength);
  const [wizardPreset, setWizardPreset] = useState<WorldLandmassPreset>("continents");
  const [wizardSeed, setWizardSeed] = useState<number>(doc.world?.seed ?? 4207);
  const [wizardWater, setWizardWater] = useState<number>(0.47);
  const [wizardRoughness, setWizardRoughness] = useState<number>(0.64);
  const [wizardDetail, setWizardDetail] = useState<number>(5);
  const [wizardClearFeatures, setWizardClearFeatures] = useState<boolean>(false);

  // Biome Paint state (Land / Ocean / Both + Solid / Stipple)
  const worldBiomeTarget = useDocumentStore((s) => s.worldBiomeTarget);
  const worldBiomePattern = useDocumentStore((s) => s.worldBiomePattern);
  const worldBiomeColorHex = useDocumentStore((s) => s.worldBiomeColorHex);
  const worldBiomeRadiusCells = useDocumentStore((s) => s.worldBiomeRadiusCells);
  const worldBiomeOpacity = useDocumentStore((s) => s.worldBiomeOpacity);
  const worldBiomeSoftness = useDocumentStore((s) => s.worldBiomeSoftness);

  // River state
  const worldRiverStartWidth = useDocumentStore((s) => s.worldRiverStartWidth);
  const worldRiverEndWidth = useDocumentStore((s) => s.worldRiverEndWidth);
  const worldRiverMeander = useDocumentStore((s) => s.worldRiverMeander);
  const worldRiverMeanderScale = useDocumentStore((s) => s.worldRiverMeanderScale);
  const worldRiverCurved = useDocumentStore((s) => s.worldRiverCurved);
  const worldRiverFadeMouth = useDocumentStore((s) => s.worldRiverFadeMouth);
  const worldRiverClipToLand = useDocumentStore((s) => s.worldRiverClipToLand);

  // Trail state
  const worldTrailStyle = useDocumentStore((s) => s.worldTrailStyle);
  const worldTrailWidth = useDocumentStore((s) => s.worldTrailWidth);
  const worldTrailColorHex = useDocumentStore((s) => s.worldTrailColorHex);
  const worldTrailDashScale = useDocumentStore((s) => s.worldTrailDashScale);
  const worldTrailCurved = useDocumentStore((s) => s.worldTrailCurved);
  const worldTrailOpacity = useDocumentStore((s) => s.worldTrailOpacity);

  // Region state
  const worldRegionName = useDocumentStore((s) => s.worldRegionName);
  const worldRegionFillHex = useDocumentStore((s) => s.worldRegionFillHex);
  const worldRegionFillOpacity = useDocumentStore((s) => s.worldRegionFillOpacity);
  const worldRegionBorderHex = useDocumentStore((s) => s.worldRegionBorderHex);
  const worldRegionBorderWidth = useDocumentStore((s) => s.worldRegionBorderWidth);
  const worldRegionBorderStyle = useDocumentStore((s) => s.worldRegionBorderStyle);
  const worldRegionClipToLand = useDocumentStore((s) => s.worldRegionClipToLand);

  // Label & Name Generator state
  const worldLabelText = useDocumentStore((s) => s.worldLabelText);
  const worldLabelCategory = useDocumentStore((s) => s.worldLabelCategory);
  const worldLabelFontSize = useDocumentStore((s) => s.worldLabelFontSize);
  const worldLabelCurveBend = useDocumentStore((s) => s.worldLabelCurveBend);
  const worldLabelRotationDeg = useDocumentStore((s) => s.worldLabelRotationDeg);
  const worldLabelLetterSpacing = useDocumentStore((s) => s.worldLabelLetterSpacing);
  const worldLabelBoxStyle = useDocumentStore((s) => s.worldLabelBoxStyle);
  const worldLabelBold = useDocumentStore((s) => s.worldLabelBold);
  const worldLabelItalic = useDocumentStore((s) => s.worldLabelItalic);
  const worldLabelUppercase = useDocumentStore((s) => s.worldLabelUppercase);
  const worldLabelDmOnly = useDocumentStore((s) => s.worldLabelDmOnly);
  const worldNameCulture = useDocumentStore((s) => s.worldNameCulture);
  const [nameBatchSeed, setNameBatchSeed] = useState(101);

  // Custom saved themes
  const [customThemes, setCustomThemes] = useState<WorldThemeConfig[]>(() =>
    loadCustomWorldThemes(),
  );

  const world = doc.world;
  const st = useDocumentStore.getState();

  const generatedNames = useMemo(
    () => generateWorldNameBatch(worldNameCulture, 6, nameBatchSeed),
    [worldNameCulture, nameBatchSeed],
  );

  if (!world) return null;

  // =========================================================================
  // 1. Selected World Entity Inspectors (Label / River / Trail / Region / Pin)
  // =========================================================================
  if (selection?.kind === "world_label") {
    const lbl = world.labels.find((x) => x.id === selection.id);
    if (lbl) {
      return (
        <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Type size={13} /> SELECTED MAP LABEL
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                type="button"
                className="dc-mini-icon-btn"
                title="Duplicate Label (Ctrl+D)"
                onClick={() => st.duplicateSelection()}
              >
                <Copy size={12} />
              </button>
              <button
                type="button"
                className="dc-mini-icon-btn"
                title="Delete Label (Del)"
                onClick={() => st.deleteSelection()}
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
            <textarea
              rows={2}
              className="dc-input"
              aria-label="Label Text"
              placeholder="Press Enter for multi-line labels"
              value={lbl.text}
              onChange={(e) => st.updateWorldLabel(lbl.id, { text: e.target.value }, false)}
              style={{ flex: 1, minHeight: 42, padding: "5px 7px", resize: "vertical", fontFamily: "inherit" }}
            />
            <button
              type="button"
              className="dc-btn dc-btn-ghost"
              title="Roll Fantasy Name"
              style={{ padding: "0 8px", height: 28 }}
              onClick={() => {
                const rolled = generateWorldName(
                  worldNameCulture,
                  Math.floor(Math.random() * 100000),
                );
                st.updateWorldLabel(lbl.id, { text: rolled }, true);
              }}
            >
              <Dices size={13} />
            </button>
          </div>

          <div className="dc-slider-row">
            <label>Font Size</label>
            <input
              type="range"
              min={4}
              max={72}
              step={0.5}
              value={lbl.fontSizePx}
              onChange={(e) => st.updateWorldLabel(lbl.id, { fontSizePx: Number(e.target.value) }, false)}
            />
            <span>{lbl.fontSizePx}px</span>
          </div>

          <div className="dc-slider-row">
            <label>Arc Curve Bend</label>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.04}
              value={lbl.curveBend}
              onChange={(e) => st.updateWorldLabel(lbl.id, { curveBend: Number(e.target.value) }, false)}
            />
            <span>{Math.round(lbl.curveBend * 100)}%</span>
          </div>

          <div className="dc-slider-row">
            <label>Rotation</label>
            <input
              type="range"
              min={-90}
              max={90}
              step={1}
              value={lbl.rotationDeg}
              onChange={(e) => st.updateWorldLabel(lbl.id, { rotationDeg: Number(e.target.value) }, false)}
            />
            <span>{lbl.rotationDeg}°</span>
          </div>

          <div className="dc-slider-row">
            <label>Letter Spacing</label>
            <input
              type="range"
              min={0}
              max={12}
              step={0.5}
              value={lbl.letterSpacing}
              onChange={(e) => st.updateWorldLabel(lbl.id, { letterSpacing: Number(e.target.value) }, false)}
            />
            <span>{lbl.letterSpacing.toFixed(1)}</span>
          </div>

          <div>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>SCROLL / BANNER BOX</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {BOX_STYLES.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  style={pillBtnStyle(lbl.boxStyle === b.id)}
                  onClick={() =>
                    st.updateWorldLabel(
                      lbl.id,
                      { boxStyle: b.id, outlineWidth: b.id === "none" ? 2.2 : 0 },
                      true,
                    )
                  }
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              type="button"
              style={pillBtnStyle(lbl.bold)}
              onClick={() => st.updateWorldLabel(lbl.id, { bold: !lbl.bold }, true)}
            >
              Bold
            </button>
            <button
              type="button"
              style={pillBtnStyle(lbl.italic)}
              onClick={() => st.updateWorldLabel(lbl.id, { italic: !lbl.italic }, true)}
            >
              Italic
            </button>
            <button
              type="button"
              style={pillBtnStyle(lbl.uppercase)}
              onClick={() => st.updateWorldLabel(lbl.id, { uppercase: !lbl.uppercase }, true)}
            >
              UPPER
            </button>
            <button
              type="button"
              style={pillBtnStyle(Boolean(lbl.dmOnly), "#F43F5E")}
              onClick={() => st.updateWorldLabel(lbl.id, { dmOnly: !lbl.dmOnly }, true)}
            >
              DM-Only
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              Ink
              <input
                type="color"
                value={lbl.colorHex}
                onChange={(e) => st.updateWorldLabel(lbl.id, { colorHex: e.target.value }, false)}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              Halo
              <input
                type="color"
                value={lbl.outlineColorHex}
                onChange={(e) => st.updateWorldLabel(lbl.id, { outlineColorHex: e.target.value }, false)}
              />
            </label>
          </div>
        </div>
      );
    }
  }

  if (selection?.kind === "world_river") {
    const r = world.rivers.find((x) => x.id === selection.id);
    if (r) {
      return (
        <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Waves size={13} /> SELECTED RIVER
            </span>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Delete River (Del)"
              onClick={() => st.deleteSelection()}
            >
              <Trash2 size={12} />
            </button>
          </div>
          <input
            type="text"
            className="dc-input"
            aria-label="River Name"
            value={r.name ?? ""}
            placeholder="River Name"
            onChange={(e) => st.updateWorldRiver(r.id, { name: e.target.value }, false)}
          />
          <SectionCurveEditorCard
            selection={selection}
            points={r.points}
            closed={false}
            curved={r.curved}
            segmentCurves={r.segmentCurves}
            sectionNoun="Span"
            wholeNoun="Whole River"
          />
          <div className="dc-slider-row">
            <label>Spring Width</label>
            <input
              type="range"
              min={0.02}
              max={0.45}
              step={0.01}
              value={r.startWidthCells}
              onChange={(e) => st.updateWorldRiver(r.id, { startWidthCells: Number(e.target.value) }, false)}
            />
            <span>{r.startWidthCells.toFixed(2)}</span>
          </div>
          <div className="dc-slider-row">
            <label>Mouth Width</label>
            <input
              type="range"
              min={0.08}
              max={1.4}
              step={0.02}
              value={r.endWidthCells}
              onChange={(e) => st.updateWorldRiver(r.id, { endWidthCells: Number(e.target.value) }, false)}
            />
            <span>{r.endWidthCells.toFixed(2)}</span>
          </div>
          <div className="dc-slider-row">
            <label>Meander</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={r.meanderRoughness}
              onChange={(e) => st.updateWorldRiver(r.id, { meanderRoughness: Number(e.target.value) }, false)}
            />
            <span>{Math.round(r.meanderRoughness * 100)}%</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              style={pillBtnStyle(r.fadeMouth !== false, "#34D399")}
              onClick={() => st.updateWorldRiver(r.id, { fadeMouth: r.fadeMouth === false }, true)}
            >
              Fade Mouth into Water
            </button>
            <button
              type="button"
              style={pillBtnStyle(r.clipToLand !== false, "#38BDF8")}
              onClick={() => st.updateWorldRiver(r.id, { clipToLand: r.clipToLand === false }, true)}
            >
              Clip to Coast
            </button>
            <button
              type="button"
              style={pillBtnStyle(false)}
              onClick={() => st.updateWorldRiver(r.id, { seed: Math.floor(Math.random() * 99999) }, true)}
            >
              <Dices size={12} /> Reseed
            </button>
          </div>
        </div>
      );
    }
  }

  if (selection?.kind === "world_trail") {
    const t = world.trails.find((x) => x.id === selection.id);
    if (t) {
      return (
        <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Route size={13} /> SELECTED TRAIL / ROUTE
            </span>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Delete Trail (Del)"
              onClick={() => st.deleteSelection()}
            >
              <Trash2 size={12} />
            </button>
          </div>
          <input
            type="text"
            className="dc-input"
            aria-label="Trail Name"
            value={t.name ?? ""}
            placeholder="Route Name"
            onChange={(e) => st.updateWorldTrail(t.id, { name: e.target.value }, false)}
          />
          <SectionCurveEditorCard
            selection={selection}
            points={t.points}
            closed={false}
            curved={t.curved}
            segmentCurves={t.segmentCurves}
            sectionNoun="Segment"
            wholeNoun="Whole Route"
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {TRAIL_STYLES.map((ts) => (
              <button
                key={ts.id}
                type="button"
                style={pillBtnStyle(t.style === ts.id)}
                onClick={() => st.updateWorldTrail(t.id, { style: ts.id }, true)}
              >
                {ts.label}
              </button>
            ))}
          </div>
          <div className="dc-slider-row">
            <label>Width</label>
            <input
              type="range"
              min={0.05}
              max={0.4}
              step={0.01}
              value={t.widthCells}
              onChange={(e) => st.updateWorldTrail(t.id, { widthCells: Number(e.target.value) }, false)}
            />
            <span>{t.widthCells.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              Color
              <input
                type="color"
                value={t.colorHex}
                onChange={(e) => st.updateWorldTrail(t.id, { colorHex: e.target.value }, false)}
              />
            </label>
          </div>
        </div>
      );
    }
  }

  if (selection?.kind === "world_region") {
    const reg = world.regions.find((x) => x.id === selection.id);
    if (reg) {
      return (
        <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Flag size={13} /> SELECTED POLITICAL REALM
            </span>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Delete Region (Del)"
              onClick={() => st.deleteSelection()}
            >
              <Trash2 size={12} />
            </button>
          </div>
          <input
            type="text"
            className="dc-input"
            aria-label="Realm Name"
            value={reg.name}
            onChange={(e) => st.updateWorldRegion(reg.id, { name: e.target.value }, false)}
          />
          <SectionCurveEditorCard
            selection={selection}
            points={reg.polygon}
            closed={true}
            curved={Boolean(reg.curved)}
            segmentCurves={reg.segmentCurves}
            sectionNoun="Border"
            wholeNoun="Whole Border"
          />
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              Fill
              <input
                type="color"
                value={reg.fillColorHex}
                onChange={(e) => st.updateWorldRegion(reg.id, { fillColorHex: e.target.value }, false)}
              />
            </label>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              Border
              <input
                type="color"
                value={reg.borderColorHex}
                onChange={(e) => st.updateWorldRegion(reg.id, { borderColorHex: e.target.value }, false)}
              />
            </label>
          </div>
          <div className="dc-slider-row">
            <label>Fill Opacity</label>
            <input
              type="range"
              min={0.05}
              max={0.65}
              step={0.02}
              value={reg.fillOpacity}
              onChange={(e) => st.updateWorldRegion(reg.id, { fillOpacity: Number(e.target.value) }, false)}
            />
            <span>{Math.round(reg.fillOpacity * 100)}%</span>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {(["solid", "dashed", "dotted"] as const).map((bs) => (
              <button
                key={bs}
                type="button"
                style={pillBtnStyle(reg.borderStyle === bs)}
                onClick={() => st.updateWorldRegion(reg.id, { borderStyle: bs }, true)}
              >
                {bs}
              </button>
            ))}
            <button
              type="button"
              style={pillBtnStyle(reg.clipToLand, "#34D399")}
              onClick={() => st.updateWorldRegion(reg.id, { clipToLand: !reg.clipToLand }, true)}
            >
              Clip to Coastline
            </button>
          </div>
        </div>
      );
    }
  }

  if (selection?.kind === "world_pin") {
    const pin = world.subMapPins.find((x) => x.id === selection.id);
    if (pin) {
      return (
        <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <MapPin size={13} /> LINKED SUB-MAP PIN
            </span>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Delete Pin (Del)"
              onClick={() => st.deleteSelection()}
            >
              <Trash2 size={12} />
            </button>
          </div>
          <input
            type="text"
            className="dc-input"
            aria-label="Pin Label"
            value={pin.label}
            onChange={(e) => st.updateWorldSubMapPin(pin.id, { label: e.target.value }, false)}
          />
          <button
            type="button"
            className="dc-btn dc-btn-primary"
            onClick={() => {
              if (pin.targetDocId && st.documents.some((d) => d.id === pin.targetDocId)) {
                st.switchDocument(pin.targetDocId);
              } else if (pin.targetKind === "battlemap") {
                st.switchToBattlemapMode();
              }
            }}
          >
            Open Linked {pin.targetKind === "battlemap" ? "Battlemap" : "Regional Detail Atlas"}
          </button>
        </div>
      );
    }
  }

  // =========================================================================
  // 2. Active World Tool Studios
  // =========================================================================

  if (activeTool === "world_land") {
    return (
      <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Mountain size={13} /> LANDMASS SCULPT &amp; COASTLINES
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(
            [
              { id: "raise" as WorldLandBrushMode, label: "Raise Land", accent: "#F59E0B" },
              { id: "lower" as WorldLandBrushMode, label: "Lower Ocean", accent: "#38BDF8" },
              { id: "smooth" as WorldLandBrushMode, label: "Smooth", accent: "#34D399" },
              { id: "lake_carve" as WorldLandBrushMode, label: "Carve Lake", accent: "#22D3EE" },
              { id: "lake_erase" as WorldLandBrushMode, label: "Fill Lake", accent: "#FBBF24" },
            ]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={worldLandMode === m.id}
              style={pillBtnStyle(worldLandMode === m.id, m.accent)}
              onClick={() => st.setBrushParams({ worldLandMode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="dc-slider-row">
          <label>Brush Radius</label>
          <input
            type="range"
            min={0.5}
            max={8.5}
            step={0.25}
            value={worldLandRadiusCells}
            onChange={(e) => st.setBrushParams({ worldLandRadiusCells: Number(e.target.value) })}
          />
          <span>{worldLandRadiusCells.toFixed(1)}</span>
        </div>

        <div className="dc-slider-row">
          <label>Coast Roughness</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={worldLandRoughness}
            onChange={(e) => st.setBrushParams({ worldLandRoughness: Number(e.target.value) })}
          />
          <span>{Math.round(worldLandRoughness * 100)}%</span>
        </div>

        <div className="dc-slider-row">
          <label>Strength</label>
          <input
            type="range"
            min={0.15}
            max={1}
            step={0.05}
            value={worldLandStrength}
            onChange={(e) => st.setBrushParams({ worldLandStrength: Number(e.target.value) })}
          />
          <span>{Math.round(worldLandStrength * 100)}%</span>
        </div>

        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Sparkles size={13} style={{ color: "var(--accent-gold)" }} /> 1-CLICK LANDMASS GENERATOR WIZARD
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {LANDMASS_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={wizardPreset === p.id}
                style={pillBtnStyle(wizardPreset === p.id)}
                onClick={() => setWizardPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <label style={{ fontSize: 11, color: "var(--text-secondary)" }}>Seed</label>
            <input
              type="number"
              className="dc-input"
              value={wizardSeed}
              onChange={(e) => setWizardSeed(Number(e.target.value) || 1)}
              style={{ flex: 1, height: 26 }}
            />
            <button
              type="button"
              className="dc-btn dc-btn-ghost"
              style={{ height: 26, padding: "0 8px" }}
              title="Roll Random Seed"
              onClick={() => setWizardSeed(Math.floor(1000 + Math.random() * 89999))}
            >
              <Dices size={13} />
            </button>
          </div>

          <div className="dc-slider-row">
            <label>Water Level</label>
            <input
              type="range"
              min={0.28}
              max={0.68}
              step={0.02}
              value={wizardWater}
              onChange={(e) => setWizardWater(Number(e.target.value))}
            />
            <span>{Math.round(wizardWater * 100)}%</span>
          </div>

          <div className="dc-slider-row">
            <label>Fractal Detail</label>
            <input
              type="range"
              min={0.2}
              max={0.95}
              step={0.05}
              value={wizardRoughness}
              onChange={(e) => setWizardRoughness(Number(e.target.value))}
            />
            <span>{Math.round(wizardRoughness * 100)}%</span>
          </div>

          <div className="dc-slider-row">
            <label>Octaves</label>
            <input
              type="range"
              min={3}
              max={6}
              step={1}
              value={wizardDetail}
              onChange={(e) => setWizardDetail(Number(e.target.value))}
            />
            <span>{wizardDetail}</span>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
            <input
              type="checkbox"
              checked={wizardClearFeatures}
              onChange={(e) => setWizardClearFeatures(e.target.checked)}
            />
            Clear rivers, biomes &amp; symbols on generate
          </label>

          <button
            type="button"
            className="dc-btn dc-btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() =>
              st.regenerateWorldLandmass({
                preset: wizardPreset,
                seed: wizardSeed,
                waterLevel: wizardWater,
                roughness: wizardRoughness,
                detail: wizardDetail,
                clearFeatures: wizardClearFeatures,
              })
            }
          >
            <Sparkles size={13} />
            Generate New Landmass
          </button>
        </div>
      </div>
    );
  }

  if (activeTool === "world_biome") {
    const swatches =
      worldBiomeTarget === "ocean" ? WORLD_OCEAN_SWATCHES : WORLD_BIOME_SWATCHES;
    return (
      <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Paintbrush size={13} /> WATERCOLOR BIOME &amp; OCEAN BRUSH
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(
            [
              { id: "land" as WorldBiomePaintTarget, label: "Land Biomes", accent: "#34D399" },
              { id: "ocean" as WorldBiomePaintTarget, label: "Ocean Seas", accent: "#38BDF8" },
              { id: "both" as WorldBiomePaintTarget, label: "Both", accent: "#E5A93C" },
            ]
          ).map((tgt) => (
            <button
              key={tgt.id}
              type="button"
              aria-pressed={worldBiomeTarget === tgt.id}
              style={{ ...pillBtnStyle(worldBiomeTarget === tgt.id, tgt.accent), flex: 1 }}
              onClick={() => {
                const nextSw =
                  tgt.id === "ocean" ? WORLD_OCEAN_SWATCHES[0] : WORLD_BIOME_SWATCHES[0];
                st.setBrushParams({
                  worldBiomeTarget: tgt.id,
                  worldBiomeColorHex: nextSw.colorHex,
                  worldBiomeOpacity: nextSw.opacity,
                });
              }}
            >
              {tgt.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            aria-pressed={worldBiomePattern === "solid"}
            style={{ ...pillBtnStyle(worldBiomePattern === "solid", "#E5A93C"), flex: 1 }}
            onClick={() => st.setBrushParams({ worldBiomePattern: "solid" })}
          >
            Watercolor Wash
          </button>
          <button
            type="button"
            aria-pressed={worldBiomePattern === "stipple"}
            style={{ ...pillBtnStyle(worldBiomePattern === "stipple", "#A78BFA"), flex: 1 }}
            onClick={() => st.setBrushParams({ worldBiomePattern: "stipple" })}
          >
            Antique Ink Stipple
          </button>
        </div>

        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {worldBiomeTarget === "ocean"
            ? "Clips strictly outside coastlines — paint Putrid Seas, sapphire trenches, abyssal shadows, and reefs without bleeding onto land!"
            : "Clips automatically to coastlines — never bleeds into oceans or lakes. `sample_color` trees & mountains tint to match!"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {swatches.map((sw) => {
            const act = worldBiomeColorHex.toUpperCase() === sw.colorHex.toUpperCase();
            return (
              <button
                key={sw.id}
                type="button"
                aria-pressed={act}
                onClick={() =>
                  st.setBrushParams({
                    worldBiomeColorHex: sw.colorHex,
                    worldBiomeOpacity: sw.opacity,
                  })
                }
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: `1px solid ${act ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                  background: act ? "rgba(229,169,60,0.16)" : "rgba(20, 24, 34, 0.7)",
                  color: "var(--text-primary)",
                  fontSize: 10.5,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: sw.colorHex,
                    border: "1px solid rgba(0,0,0,0.35)",
                    flexShrink: 0,
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sw.label}
                </span>
              </button>
            );
          })}
        </div>

        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
          <span>Custom Biome Wash</span>
          <input
            type="color"
            value={worldBiomeColorHex}
            onChange={(e) => st.setBrushParams({ worldBiomeColorHex: e.target.value })}
          />
        </label>

        <div className="dc-slider-row">
          <label>Brush Radius</label>
          <input
            type="range"
            min={0.8}
            max={10}
            step={0.2}
            value={worldBiomeRadiusCells}
            onChange={(e) => st.setBrushParams({ worldBiomeRadiusCells: Number(e.target.value) })}
          />
          <span>{worldBiomeRadiusCells.toFixed(1)}</span>
        </div>

        <div className="dc-slider-row">
          <label>Wash Opacity</label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={worldBiomeOpacity}
            onChange={(e) => st.setBrushParams({ worldBiomeOpacity: Number(e.target.value) })}
          />
          <span>{Math.round(worldBiomeOpacity * 100)}%</span>
        </div>

        <div className="dc-slider-row">
          <label>Feather Softness</label>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={worldBiomeSoftness}
            onChange={(e) => st.setBrushParams({ worldBiomeSoftness: Number(e.target.value) })}
          />
          <span>{Math.round(worldBiomeSoftness * 100)}%</span>
        </div>

        <button
          type="button"
          className="dc-btn dc-btn-ghost"
          onClick={() => st.clearWorldBiomes()}
          disabled={world.biomeStrokes.length === 0}
        >
          Clear Ground Biome Paint ({world.biomeStrokes.length})
        </button>
      </div>
    );
  }

  if (activeTool === "world_river") {
    return (
      <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Waves size={13} /> MEANDERING RIVER STUDIO
        </div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Click from mountain spring downstream into a bay, lake, or larger river. Banks &amp; water smoothly fade into the receiving water body!
        </div>
        <div className="dc-slider-row">
          <label>Spring Width</label>
          <input
            type="range"
            min={0.02}
            max={0.45}
            step={0.01}
            value={worldRiverStartWidth}
            onChange={(e) => st.setBrushParams({ worldRiverStartWidth: Number(e.target.value) })}
          />
          <span>{worldRiverStartWidth.toFixed(2)}</span>
        </div>
        <div className="dc-slider-row">
          <label>Mouth Width</label>
          <input
            type="range"
            min={0.08}
            max={1.4}
            step={0.02}
            value={worldRiverEndWidth}
            onChange={(e) => st.setBrushParams({ worldRiverEndWidth: Number(e.target.value) })}
          />
          <span>{worldRiverEndWidth.toFixed(2)}</span>
        </div>
        <div className="dc-slider-row">
          <label>Meander</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={worldRiverMeander}
            onChange={(e) => st.setBrushParams({ worldRiverMeander: Number(e.target.value) })}
          />
          <span>{Math.round(worldRiverMeander * 100)}%</span>
        </div>
        <div className="dc-slider-row">
          <label>Wiggle Scale</label>
          <input
            type="range"
            min={0.4}
            max={2.2}
            step={0.1}
            value={worldRiverMeanderScale}
            onChange={(e) => st.setBrushParams({ worldRiverMeanderScale: Number(e.target.value) })}
          />
          <span>{worldRiverMeanderScale.toFixed(1)}×</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button
            type="button"
            style={pillBtnStyle(worldRiverFadeMouth, "#34D399")}
            onClick={() => st.setBrushParams({ worldRiverFadeMouth: !worldRiverFadeMouth })}
          >
            Fade Mouth: {worldRiverFadeMouth ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            style={pillBtnStyle(worldRiverClipToLand, "#38BDF8")}
            onClick={() => st.setBrushParams({ worldRiverClipToLand: !worldRiverClipToLand })}
          >
            Clip Coast: {worldRiverClipToLand ? "ON" : "OFF"}
          </button>
          <button
            type="button"
            style={pillBtnStyle(worldRiverCurved, "#38BDF8")}
            onClick={() => st.setBrushParams({ worldRiverCurved: !worldRiverCurved })}
          >
            Spline: {worldRiverCurved ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    );
  }

  if (activeTool === "world_trail") {
    return (
      <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Route size={13} /> TRAILS, ROADS &amp; SEA LANES
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {TRAIL_STYLES.map((ts) => (
            <button
              key={ts.id}
              type="button"
              aria-pressed={worldTrailStyle === ts.id}
              style={pillBtnStyle(worldTrailStyle === ts.id)}
              onClick={() => st.setBrushParams({ worldTrailStyle: ts.id })}
            >
              {ts.label}
            </button>
          ))}
        </div>
        <div className="dc-slider-row">
          <label>Line Width</label>
          <input
            type="range"
            min={0.03}
            max={0.4}
            step={0.01}
            value={worldTrailWidth}
            onChange={(e) => st.setBrushParams({ worldTrailWidth: Number(e.target.value) })}
          />
          <span>{worldTrailWidth.toFixed(2)}</span>
        </div>
        <div className="dc-slider-row">
          <label>Dash Scale</label>
          <input
            type="range"
            min={0.5}
            max={2.2}
            step={0.1}
            value={worldTrailDashScale}
            onChange={(e) => st.setBrushParams({ worldTrailDashScale: Number(e.target.value) })}
          />
          <span>{worldTrailDashScale.toFixed(1)}×</span>
        </div>
        <div className="dc-slider-row">
          <label>Opacity</label>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={worldTrailOpacity}
            onChange={(e) => st.setBrushParams({ worldTrailOpacity: Number(e.target.value) })}
          />
          <span>{Math.round(worldTrailOpacity * 100)}%</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
            Ink
            <input
              type="color"
              value={worldTrailColorHex}
              onChange={(e) => st.setBrushParams({ worldTrailColorHex: e.target.value })}
            />
          </label>
          <button
            type="button"
            style={pillBtnStyle(worldTrailCurved)}
            onClick={() => st.setBrushParams({ worldTrailCurved: !worldTrailCurved })}
          >
            Curved Spline
          </button>
        </div>
      </div>
    );
  }

  if (activeTool === "world_region") {
    return (
      <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Flag size={13} /> POLITICAL REGIONS &amp; REALMS
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            className="dc-input"
            aria-label="New Realm Name"
            value={worldRegionName}
            onChange={(e) => st.setBrushParams({ worldRegionName: e.target.value })}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="dc-btn dc-btn-ghost"
            title="Roll Kingdom Name"
            style={{ padding: "0 8px" }}
            onClick={() =>
              st.setBrushParams({
                worldRegionName: generateWorldName(worldNameCulture, Math.floor(Math.random() * 99999)),
              })
            }
          >
            <Dices size={13} />
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
            Fill
            <input
              type="color"
              value={worldRegionFillHex}
              onChange={(e) => st.setBrushParams({ worldRegionFillHex: e.target.value })}
            />
          </label>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
            Border
            <input
              type="color"
              value={worldRegionBorderHex}
              onChange={(e) => st.setBrushParams({ worldRegionBorderHex: e.target.value })}
            />
          </label>
        </div>
        <div className="dc-slider-row">
          <label>Fill Opacity</label>
          <input
            type="range"
            min={0.05}
            max={0.65}
            step={0.02}
            value={worldRegionFillOpacity}
            onChange={(e) => st.setBrushParams({ worldRegionFillOpacity: Number(e.target.value) })}
          />
          <span>{Math.round(worldRegionFillOpacity * 100)}%</span>
        </div>
        <div className="dc-slider-row">
          <label>Border Width</label>
          <input
            type="range"
            min={0.8}
            max={4.5}
            step={0.2}
            value={worldRegionBorderWidth}
            onChange={(e) => st.setBrushParams({ worldRegionBorderWidth: Number(e.target.value) })}
          />
          <span>{worldRegionBorderWidth.toFixed(1)}px</span>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {(["solid", "dashed", "dotted"] as const).map((bs) => (
            <button
              key={bs}
              type="button"
              style={pillBtnStyle(worldRegionBorderStyle === bs)}
              onClick={() => st.setBrushParams({ worldRegionBorderStyle: bs })}
            >
              {bs}
            </button>
          ))}
          <button
            type="button"
            style={pillBtnStyle(worldRegionClipToLand, "#34D399")}
            onClick={() => st.setBrushParams({ worldRegionClipToLand: !worldRegionClipToLand })}
          >
            Clip to Coastline
          </button>
        </div>
      </div>
    );
  }

  if (activeTool === "world_label") {
    return (
      <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Type size={13} /> LABELS &amp; FANTASY NAME GENERATOR
        </div>

        <textarea
          rows={2}
          className="dc-input"
          aria-label="Active Label Text"
          placeholder="Type or click a generated name below… (Enter for multi-line)"
          value={worldLabelText}
          onChange={(e) => st.setBrushParams({ worldLabelText: e.target.value })}
          style={{ minHeight: 42, padding: "5px 7px", resize: "vertical", fontFamily: "inherit" }}
        />

        {/* 10-Culture Procedural Fantasy Name Generator */}
        <div
          style={{
            padding: 8,
            borderRadius: 8,
            background: "rgba(18, 22, 32, 0.78)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: 7,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
            <select
              aria-label="Name Generator Culture"
              className="dc-input"
              value={worldNameCulture}
              onChange={(e) =>
                st.setBrushParams({ worldNameCulture: e.target.value as WorldNameCultureId })
              }
              style={{ flex: 1, height: 26, fontSize: 11 }}
            >
              {WORLD_NAME_CULTURES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="dc-btn dc-btn-primary"
              style={{ height: 26, padding: "0 9px", fontSize: 11, gap: 4 }}
              onClick={() => setNameBatchSeed((s) => s + 17)}
            >
              <Dices size={12} />
              Roll 6
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {generatedNames.map((nm) => (
              <button
                key={nm}
                type="button"
                onClick={() => st.setBrushParams({ worldLabelText: nm })}
                style={{
                  padding: "3px 7px",
                  borderRadius: 5,
                  border: `1px solid ${worldLabelText === nm ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                  background: worldLabelText === nm ? "rgba(229,169,60,0.22)" : "rgba(28,33,46,0.7)",
                  color: "var(--text-primary)",
                  fontSize: 10.5,
                  cursor: "pointer",
                }}
              >
                {nm}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>LABEL STYLE PRESET</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {LABEL_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={worldLabelCategory === c.id}
                style={pillBtnStyle(worldLabelCategory === c.id)}
                onClick={() =>
                  st.setBrushParams({
                    worldLabelCategory: c.id,
                    worldLabelFontSize: c.size,
                    worldLabelUppercase: c.upper,
                    worldLabelItalic: c.italic,
                    worldLabelLetterSpacing: c.spacing,
                    worldLabelBoxStyle: c.box,
                  })
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dc-slider-row">
          <label>Font Size</label>
          <input
            type="range"
            min={4}
            max={72}
            step={0.5}
            value={worldLabelFontSize}
            onChange={(e) => st.setBrushParams({ worldLabelFontSize: Number(e.target.value) })}
          />
          <span>{worldLabelFontSize}px</span>
        </div>

        <div className="dc-slider-row">
          <label>Arc Curve Bend</label>
          <input
            type="range"
            min={-1}
            max={1}
            step={0.04}
            value={worldLabelCurveBend}
            onChange={(e) => st.setBrushParams({ worldLabelCurveBend: Number(e.target.value) })}
          />
          <span>{Math.round(worldLabelCurveBend * 100)}%</span>
        </div>

        <div className="dc-slider-row">
          <label>Rotation</label>
          <input
            type="range"
            min={-90}
            max={90}
            step={1}
            value={worldLabelRotationDeg}
            onChange={(e) => st.setBrushParams({ worldLabelRotationDeg: Number(e.target.value) })}
          />
          <span>{worldLabelRotationDeg}°</span>
        </div>

        <div className="dc-slider-row">
          <label>Spacing</label>
          <input
            type="range"
            min={0}
            max={12}
            step={0.5}
            value={worldLabelLetterSpacing}
            onChange={(e) => st.setBrushParams({ worldLabelLetterSpacing: Number(e.target.value) })}
          />
          <span>{worldLabelLetterSpacing.toFixed(1)}</span>
        </div>

        <div>
          <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 4 }}>SCROLL / CARTOUCHE BOX</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {BOX_STYLES.map((b) => (
              <button
                key={b.id}
                type="button"
                style={pillBtnStyle(worldLabelBoxStyle === b.id)}
                onClick={() => st.setBrushParams({ worldLabelBoxStyle: b.id })}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button
            type="button"
            style={pillBtnStyle(worldLabelBold)}
            onClick={() => st.setBrushParams({ worldLabelBold: !worldLabelBold })}
          >
            Bold
          </button>
          <button
            type="button"
            style={pillBtnStyle(worldLabelItalic)}
            onClick={() => st.setBrushParams({ worldLabelItalic: !worldLabelItalic })}
          >
            Italic
          </button>
          <button
            type="button"
            style={pillBtnStyle(worldLabelUppercase)}
            onClick={() => st.setBrushParams({ worldLabelUppercase: !worldLabelUppercase })}
          >
            UPPER
          </button>
          <button
            type="button"
            style={pillBtnStyle(worldLabelDmOnly, "#F43F5E")}
            onClick={() => st.setBrushParams({ worldLabelDmOnly: !worldLabelDmOnly })}
          >
            DM-Only
          </button>
        </div>
      </div>
    );
  }

  if (activeTool === "world_crop") {
    return (
      <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Crop size={13} /> CREATE DETAIL / SUB-REGION MAP
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.45 }}>
          Drag a rectangle directly on the continent to crop and upsample the coastlines, rivers, roads, labels, and symbols into a zoomed-in Regional Detail Atlas tab — with an automatic clickable pin back on the parent World Map!
        </div>
        <button
          type="button"
          className="dc-btn dc-btn-primary"
          onClick={() =>
            st.createLinkedBattlemapFromWorld(
              { x: doc.canvas.widthCells * 0.5, y: doc.canvas.heightCells * 0.5 },
              `${doc.meta.title} Encounter`,
            )
          }
        >
          <MapPin size={13} />
          Spawn Linked Battlemap Pin
        </button>

        {world.subMapPins.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
            <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>
              LINKED SUB-MAPS ({world.subMapPins.length})
            </div>
            {world.subMapPins.map((pin) => (
              <button
                key={pin.id}
                type="button"
                className="dc-btn dc-btn-ghost"
                style={{ justifyContent: "space-between", fontSize: 11 }}
                onClick={() => {
                  if (pin.targetDocId && st.documents.some((d) => d.id === pin.targetDocId)) {
                    st.switchDocument(pin.targetDocId);
                  } else if (pin.targetKind === "battlemap") {
                    st.switchToBattlemapMode();
                  }
                }}
              >
                <span>{pin.label}</span>
                <span style={{ fontSize: 10, color: "var(--accent-gold)" }}>
                  {pin.targetKind === "battlemap" ? "Battlemap →" : "Detail →"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 3. Atlas Themes, Coastlines, Compass, Scale Bar, Overland Grid & Frame
  //    (Shown for `world_theme`, `measure`, and default `select` overview!)
  // =========================================================================
  const allThemes = [...WORLD_THEMES, ...customThemes];

  return (
    <div className="dc-panel-section" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="dc-section-title" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Palette size={13} /> ATLAS THEMES &amp; CARTOGRAPHY
        </span>
        <button
          type="button"
          className="dc-btn dc-btn-ghost"
          style={{ height: 22, padding: "0 7px", fontSize: 10.5, gap: 4 }}
          title="Save current customized theme preset"
          onClick={() => {
            const name = window.prompt("Save custom Atlas Theme as:", `${world.theme.shortLabel} Custom`);
            if (!name?.trim()) return;
            const saved: WorldThemeConfig = {
              ...structuredClone(world.theme),
              id: `custom-${Date.now()}`,
              name: name.trim(),
              shortLabel: name.trim().slice(0, 14),
            };
            saveCustomWorldTheme(saved);
            setCustomThemes(loadCustomWorldThemes());
            st.pushToast(`Saved Custom Theme "${saved.name}"`, "success");
          }}
        >
          <Save size={11} /> Save Theme
        </button>
      </div>

      {/* 8-Theme Wonderdraft Gallery */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
        {allThemes.map((th) => {
          const isAct = world.themeId === th.id;
          return (
            <button
              key={th.id}
              type="button"
              aria-pressed={isAct}
              onClick={() => st.applyWorldTheme(th.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 7px",
                borderRadius: 7,
                border: `1px solid ${isAct ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                background: isAct ? "rgba(229,169,60,0.18)" : "rgba(20,24,34,0.75)",
                color: "var(--text-primary)",
                fontSize: 11,
                fontWeight: isAct ? 700 : 500,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  background: `linear-gradient(135deg, ${th.oceanColorHex} 50%, ${th.landBaseColorHex} 50%)`,
                  border: `1.5px solid ${th.coastlineInkHex}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {th.shortLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Coastline & Ocean Styling */}
      <details open>
        <summary style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer", marginBottom: 6 }}>
          Coastline Effects &amp; Colors
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {COAST_EFFECTS.map((ce) => (
              <button
                key={ce.id}
                type="button"
                aria-pressed={world.theme.coastalEffect === ce.id}
                style={pillBtnStyle(world.theme.coastalEffect === ce.id, "#38BDF8")}
                onClick={() => st.updateWorldTheme({ coastalEffect: ce.id }, true)}
              >
                {ce.label}
              </button>
            ))}
          </div>

          {world.theme.coastalEffect === "ripples" && (
            <div className="dc-slider-row">
              <label>Ripple Rings</label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={world.theme.coastalRippleCount}
                onChange={(e) => st.updateWorldTheme({ coastalRippleCount: Number(e.target.value) }, false)}
              />
              <span>{world.theme.coastalRippleCount}</span>
            </div>
          )}

          <div className="dc-slider-row">
            <label>Coastline Ink</label>
            <input
              type="range"
              min={0.8}
              max={4.5}
              step={0.2}
              value={world.theme.coastlineWidthPx}
              onChange={(e) => st.updateWorldTheme({ coastlineWidthPx: Number(e.target.value) }, false)}
            />
            <span>{world.theme.coastlineWidthPx.toFixed(1)}px</span>
          </div>

          <div className="dc-slider-row">
            <label>Paper Vignette</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={world.theme.vignetteStrength}
              onChange={(e) => st.updateWorldTheme({ vignetteStrength: Number(e.target.value) }, false)}
            />
            <span>{Math.round(world.theme.vignetteStrength * 100)}%</span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 10.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              Ocean
              <input
                type="color"
                value={world.theme.oceanColorHex}
                onChange={(e) => st.updateWorldTheme({ oceanColorHex: e.target.value }, false)}
              />
            </label>
            <label style={{ fontSize: 10.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              Land
              <input
                type="color"
                value={world.theme.landBaseColorHex}
                onChange={(e) => st.updateWorldTheme({ landBaseColorHex: e.target.value }, false)}
              />
            </label>
            <label style={{ fontSize: 10.5, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
              Coast
              <input
                type="color"
                value={world.theme.coastlineInkHex}
                onChange={(e) => st.updateWorldTheme({ coastlineInkHex: e.target.value }, false)}
              />
            </label>
          </div>
        </div>
      </details>

      {/* Compass Rose, Windrose Rhumb Lines & Ornamental Map Frame */}
      <details open>
        <summary style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer", marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Compass size={12} /> Compass, Rhumb Lines &amp; Frame
          </span>
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <button
              type="button"
              style={pillBtnStyle(world.overlays.compass.visible)}
              onClick={() =>
                st.updateWorldOverlays({ compass: { visible: !world.overlays.compass.visible } }, true)
              }
            >
              Compass Rose
            </button>
            <button
              type="button"
              style={pillBtnStyle(world.overlays.compass.showRhumbLines, "#38BDF8")}
              onClick={() =>
                st.updateWorldOverlays(
                  { compass: { showRhumbLines: !world.overlays.compass.showRhumbLines } },
                  true,
                )
              }
            >
              Rhumb Lines
            </button>
            <button
              type="button"
              style={pillBtnStyle(world.overlays.scaleBar.visible, "#34D399")}
              onClick={() =>
                st.updateWorldOverlays({ scaleBar: { visible: !world.overlays.scaleBar.visible } }, true)
              }
            >
              Scale Bar
            </button>
            <button
              type="button"
              style={pillBtnStyle(Boolean(world.overlays.legend?.visible), "#A78BFA")}
              onClick={() =>
                st.updateWorldOverlays(
                  { legend: { visible: !world.overlays.legend?.visible } },
                  true,
                )
              }
            >
              Travel Legend
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text-muted)" }}>
            <Frame size={11} /> ORNAMENTAL MAP FRAME
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {FRAME_STYLES.map((fs) => (
              <button
                key={fs.id}
                type="button"
                style={pillBtnStyle(world.overlays.frame.style === fs.id)}
                onClick={() => st.updateWorldOverlays({ frame: { style: fs.id } }, true)}
              >
                {fs.label}
              </button>
            ))}
          </div>

          <details style={{ marginTop: 2 }}>
            <summary style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer" }}>
              Position Compass, Scale &amp; Legend
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
              {world.overlays.compass.visible && (
                <>
                  <div className="dc-slider-row">
                    <label>Compass X</label>
                    <input
                      type="range"
                      min={1}
                      max={doc.canvas.widthCells - 1}
                      step={0.25}
                      value={world.overlays.compass.x}
                      onChange={(e) =>
                        st.updateWorldOverlays({ compass: { x: Number(e.target.value) } }, false)
                      }
                    />
                    <span>{world.overlays.compass.x.toFixed(1)}</span>
                  </div>
                  <div className="dc-slider-row">
                    <label>Compass Y</label>
                    <input
                      type="range"
                      min={1}
                      max={doc.canvas.heightCells - 1}
                      step={0.25}
                      value={world.overlays.compass.y}
                      onChange={(e) =>
                        st.updateWorldOverlays({ compass: { y: Number(e.target.value) } }, false)
                      }
                    />
                    <span>{world.overlays.compass.y.toFixed(1)}</span>
                  </div>
                  <div className="dc-slider-row">
                    <label>Compass Size</label>
                    <input
                      type="range"
                      min={0.4}
                      max={2.2}
                      step={0.05}
                      value={world.overlays.compass.scale}
                      onChange={(e) =>
                        st.updateWorldOverlays({ compass: { scale: Number(e.target.value) } }, false)
                      }
                    />
                    <span>{world.overlays.compass.scale.toFixed(2)}×</span>
                  </div>
                </>
              )}
              {world.overlays.scaleBar.visible && (
                <div className="dc-slider-row">
                  <label>Scale X / Y</label>
                  <input
                    type="range"
                    min={2}
                    max={doc.canvas.widthCells - 2}
                    step={0.25}
                    value={world.overlays.scaleBar.x}
                    onChange={(e) =>
                      st.updateWorldOverlays({ scaleBar: { x: Number(e.target.value) } }, false)
                    }
                  />
                  <input
                    type="range"
                    min={1}
                    max={doc.canvas.heightCells - 1}
                    step={0.25}
                    value={world.overlays.scaleBar.y}
                    onChange={(e) =>
                      st.updateWorldOverlays({ scaleBar: { y: Number(e.target.value) } }, false)
                    }
                  />
                </div>
              )}
              {world.overlays.legend?.visible && (
                <div className="dc-slider-row">
                  <label>Legend X / Y</label>
                  <input
                    type="range"
                    min={3}
                    max={doc.canvas.widthCells - 3}
                    step={0.25}
                    value={world.overlays.legend.x}
                    onChange={(e) =>
                      st.updateWorldOverlays({ legend: { x: Number(e.target.value) } }, false)
                    }
                  />
                  <input
                    type="range"
                    min={2}
                    max={doc.canvas.heightCells - 2}
                    step={0.25}
                    value={world.overlays.legend.y}
                    onChange={(e) =>
                      st.updateWorldOverlays({ legend: { y: Number(e.target.value) } }, false)
                    }
                  />
                </div>
              )}
            </div>
          </details>

          {/* Wonderdraft-style Trace Reference Image Overlay (Sketch / Map Tracer) */}
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 10.5, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer" }}>
              Trace Reference Image Overlay
            </summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                aria-label="Upload Trace Reference Image"
                style={{ fontSize: 10.5, color: "var(--text-secondary)" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = URL.createObjectURL(file);
                  st.updateWorldOverlays(
                    { traceOverlay: { visible: true, imageUrl: url, opacity: 0.35 } },
                    false,
                  );
                  st.pushToast(`Loaded trace image "${file.name}"`, "success");
                  e.target.value = "";
                }}
              />
              {world.overlays.traceOverlay?.imageUrl && (
                <>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      type="button"
                      style={pillBtnStyle(world.overlays.traceOverlay.visible, "#38BDF8")}
                      onClick={() =>
                        st.updateWorldOverlays(
                          { traceOverlay: { visible: !world.overlays.traceOverlay?.visible } },
                          false,
                        )
                      }
                    >
                      {world.overlays.traceOverlay.visible ? "Visible" : "Hidden"}
                    </button>
                    <button
                      type="button"
                      style={pillBtnStyle(world.overlays.traceOverlay.aboveLand, "#E5A93C")}
                      onClick={() =>
                        st.updateWorldOverlays(
                          { traceOverlay: { aboveLand: !world.overlays.traceOverlay?.aboveLand } },
                          false,
                        )
                      }
                    >
                      {world.overlays.traceOverlay.aboveLand ? "Above Map" : "Under Map"}
                    </button>
                  </div>
                  <div className="dc-slider-row">
                    <label>Opacity</label>
                    <input
                      type="range"
                      min={0.05}
                      max={0.9}
                      step={0.05}
                      value={world.overlays.traceOverlay.opacity}
                      onChange={(e) =>
                        st.updateWorldOverlays(
                          { traceOverlay: { opacity: Number(e.target.value) } },
                          false,
                        )
                      }
                    />
                    <span>{Math.round(world.overlays.traceOverlay.opacity * 100)}%</span>
                  </div>
                </>
              )}
            </div>
          </details>
        </div>
      </details>

      {/* Scale Bar Calibration, Travel Speed & Overland Hex Grid */}
      <details open={activeTool === "measure"}>
        <summary style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer", marginBottom: 6 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Ruler size={12} /> Scale, Travel Speed &amp; Hex Grid
          </span>
        </summary>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
          <div className="dc-slider-row">
            <label>Miles / Cell</label>
            <input
              type="range"
              min={1}
              max={250}
              step={1}
              value={world.overlays.scaleBar.milesPerCell}
              onChange={(e) =>
                st.updateWorldOverlays({ scaleBar: { milesPerCell: Number(e.target.value) } }, false)
              }
            />
            <span>{world.overlays.scaleBar.milesPerCell} mi</span>
          </div>

          <div style={{ display: "flex", gap: 4 }}>
            {(["miles", "km", "leagues"] as const).map((u) => (
              <button
                key={u}
                type="button"
                style={pillBtnStyle(world.overlays.scaleBar.unit === u)}
                onClick={() => st.updateWorldOverlays({ scaleBar: { unit: u } }, true)}
              >
                {u}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>TRAVEL RULER SPEED (M)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {TRAVEL_MODES.map((tm) => (
              <button
                key={tm.id}
                type="button"
                title={tm.speed}
                style={pillBtnStyle(world.overlays.travelMode === tm.id, "#38BDF8")}
                onClick={() => st.updateWorldOverlays({ travelMode: tm.id }, true)}
              >
                {tm.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--text-muted)", marginTop: 2 }}>
            <Grid3x3 size={11} /> OVERLAND HEX / LAT-LON GRID
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {GRID_STYLES.map((gs) => (
              <button
                key={gs.id}
                type="button"
                style={pillBtnStyle(world.overlays.grid.style === gs.id)}
                onClick={() => st.updateWorldOverlays({ grid: { style: gs.id } }, true)}
              >
                {gs.label}
              </button>
            ))}
          </div>

          {world.overlays.grid.style !== "none" && (
            <>
              <div className="dc-slider-row">
                <label>Grid Size</label>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={0.25}
                  value={world.overlays.grid.cellSizeCells}
                  onChange={(e) =>
                    st.updateWorldOverlays({ grid: { cellSizeCells: Number(e.target.value) } }, false)
                  }
                />
                <span>{world.overlays.grid.cellSizeCells.toFixed(1)}</span>
              </div>
              <button
                type="button"
                style={pillBtnStyle(world.overlays.grid.showCoords, "#34D399")}
                onClick={() =>
                  st.updateWorldOverlays({ grid: { showCoords: !world.overlays.grid.showCoords } }, true)
                }
              >
                Hex Crawl Coords (0101): {world.overlays.grid.showCoords ? "ON" : "OFF"}
              </button>
            </>
          )}
        </div>
      </details>
    </div>
  );
};

import React, { useId, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Circle,
  Compass,
  FlipHorizontal2,
  Home,
  Layers,
  RotateCw,
  Sparkles,
  Spline,
  Square,
  Sun,
  Trash2,
} from "lucide-react";
import { ROOF_MATERIAL_PRESETS } from "@/engine/roofEngine";
import { useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import { ColorStudioPanel } from "@/ui/workspace/ColorStudioPanel";
import {
  DEFAULT_RECOLOR,
  type RoofDrawMode,
  type RoofRidgeCapStyle,
  type RoofStructure,
  type RoofStyle,
} from "@/types/map";

interface RoofStudioPanelProps {
  selectedRoof?: { layerId: string; roof: RoofStructure } | null;
}

const ROOF_STYLE_OPTIONS: Array<{ id: RoofStyle; label: string; tip: string }> = [
  { id: "gable", label: "Gable", tip: "Classic two-slope pitched roof with mitered L/T bends" },
  { id: "hip", label: "Hip", tip: "Four-slope pitched roof with beveled sloped ends (square becomes pyramid)" },
  { id: "shed", label: "Shed", tip: "Single-slope lean-to roof (press X to flip downhill side)" },
  { id: "mansard", label: "Mansard", tip: "Four steep shingle skirts framing a recessed flat crown" },
  { id: "cone", label: "Turret", tip: "Radial conical spire or polygonal tower dome" },
];

const RIDGE_CAP_OPTIONS: Array<{ id: RoofRidgeCapStyle; label: string }> = [
  { id: "matching", label: "Match" },
  { id: "timber", label: "Timber" },
  { id: "stone", label: "Stone" },
  { id: "copper", label: "Copper" },
  { id: "none", label: "None" },
];

const SUN_COMPASS_PRESETS: Array<{ label: string; deg: number; tip: string }> = [
  { label: "NW", deg: 225, tip: "Top-Left Sunlight (225° · Standard RPG Cartography)" },
  { label: "NE", deg: 315, tip: "Top-Right Sunlight (315°)" },
  { label: "SW", deg: 135, tip: "Bottom-Left Sunlight (135°)" },
  { label: "SE", deg: 45, tip: "Bottom-Right Sunlight (45°)" },
];

const CONE_FACET_OPTIONS: Array<{ facets: number; label: string }> = [
  { facets: 0, label: "Round" },
  { facets: 6, label: "6 Hex" },
  { facets: 8, label: "8 Oct" },
  { facets: 12, label: "12 Poly" },
];

const ROOF_DETAIL_SHORTCUTS: Array<{
  label: string;
  query: string;
  subGroup: "roofs" | null;
}> = [
  { label: "Chimneys", query: "chimney", subGroup: null },
  { label: "Dormers & Gables", query: "dormer", subGroup: null },
  { label: "Roof Props", query: "", subGroup: "roofs" },
  { label: "Awnings & Canopies", query: "awning", subGroup: null },
  { label: "Moss & Vines", query: "moss", subGroup: null },
  { label: "Skylights & Hatches", query: "hatch", subGroup: null },
];

const LEGACY_ROOF_IDS = new Set([
  "terrain/red_clay_roof_tile.png",
  "terrain/slate_shingle_roof.png",
  "modular-suite/terrain/slate_rooftop_tiles.png",
]);

interface RangeFieldProps {
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onPointerDown?: () => void;
  onChange: (next: number) => void;
}

const RangeField: React.FC<RangeFieldProps> = ({
  label,
  valueText,
  min,
  max,
  step,
  value,
  onPointerDown,
  onChange,
}) => {
  const inputId = useId();
  return (
    <div className="dc-field-row" style={{ marginBottom: 0 }}>
      <label htmlFor={inputId} className="dc-field-label" style={{ cursor: "pointer" }}>
        {label}{" "}
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: 10 }}>
          ({valueText})
        </span>
      </label>
      <input
        id={inputId}
        type="range"
        className="dc-range"
        style={{ width: 112 }}
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onPointerDown={onPointerDown}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
};

export const RoofStudioPanel: React.FC<RoofStudioPanelProps> = ({ selectedRoof }) => {
  const doc = useDocumentStore(
    (s) => s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0],
  );
  const activeTool = useDocumentStore((s) => s.activeTool);
  const roofDrawMode = useDocumentStore((s) => s.roofDrawMode);
  const roofStyle = useDocumentStore((s) => s.roofStyle);
  const activeRoofAssetId = useDocumentStore((s) => s.activeRoofAssetId);
  const roofWidthCells = useDocumentStore((s) => s.roofWidthCells);
  const roofCurved = useDocumentStore((s) => s.roofCurved);
  const roofFlipSlope = useDocumentStore((s) => s.roofFlipSlope);
  const roofOverhangCells = useDocumentStore((s) => s.roofOverhangCells);
  const roofRotateBoxRidge = useDocumentStore((s) => s.roofRotateBoxRidge);
  const roofSunAngleDeg = useDocumentStore((s) => s.roofSunAngleDeg);
  const roofSlopeShade = useDocumentStore((s) => s.roofSlopeShade);
  const roofRidgeCapStyle = useDocumentStore((s) => s.roofRidgeCapStyle);
  const roofRidgeCapWidthCells = useDocumentStore((s) => s.roofRidgeCapWidthCells);
  const roofEaveTrim = useDocumentStore((s) => s.roofEaveTrim);
  const roofDropShadow = useDocumentStore((s) => s.roofDropShadow);
  const roofShadowDistanceCells = useDocumentStore((s) => s.roofShadowDistanceCells);
  const roofTextureScale = useDocumentStore((s) => s.roofTextureScale);
  const roofWeathering = useDocumentStore((s) => s.roofWeathering);
  const roofOpacity = useDocumentStore((s) => s.roofOpacity);
  const roofConeFacets = useDocumentStore((s) => s.roofConeFacets);
  const roofRidgeOffset = useDocumentStore((s) => s.roofRidgeOffset);
  const roofHipInsetRatio = useDocumentStore((s) => s.roofHipInsetRatio);
  const roofMansardCrownRatio = useDocumentStore((s) => s.roofMansardCrownRatio);
  const toolRecolors = useDocumentStore((s) => s.toolRecolors);
  const copiedRecolor = useDocumentStore((s) => s.copiedRecolor);

  const allVaultAssets = useVaultStore((s) => s.assets);
  const vaultById = useMemo(
    () => new Map(allVaultAssets.map((a) => [a.id, a])),
    [allVaultAssets],
  );

  const [showAllTerrain, setShowAllTerrain] = useState(false);
  const [texFilter, setTexFilter] = useState("");

  const st = useDocumentStore.getState();
  const rf = selectedRoof?.roof ?? null;

  // Unified live values: edits selected roof live OR sets active Roof Studio brush defaults
  const curStyle: RoofStyle = rf ? rf.style : roofStyle;
  const curAssetId = rf ? rf.assetId : activeRoofAssetId;
  const curWidth = rf ? rf.widthCells : roofWidthCells;
  const curCurved = rf ? rf.curved : roofCurved;
  const curFlipSlope = rf ? rf.flipSlope : roofFlipSlope;
  const curRidgeOffset = rf ? (rf.ridgeOffset ?? 0) : roofRidgeOffset;
  const curHipInset = rf ? (rf.hipInsetRatio ?? 0.5) : roofHipInsetRatio;
  const curMansardCrown = rf ? (rf.mansardCrownRatio ?? 0.45) : roofMansardCrownRatio;
  const curConeFacets = rf ? (rf.coneFacets ?? 0) : roofConeFacets;
  const curSunDeg = rf ? rf.sunAngleDeg : roofSunAngleDeg;
  const curSlopeShade = rf ? rf.slopeShade : roofSlopeShade;
  const curRidgeCap = rf ? rf.ridgeCapStyle : roofRidgeCapStyle;
  const curRidgeCapW = rf ? (rf.ridgeCapWidthCells ?? roofRidgeCapWidthCells) : roofRidgeCapWidthCells;
  const curEaveTrim = rf ? rf.eaveTrim : roofEaveTrim;
  const curDropShadow = rf ? rf.dropShadow : roofDropShadow;
  const curShadowDist = rf ? (rf.shadowDistanceCells ?? roofShadowDistanceCells) : roofShadowDistanceCells;
  const curTexScale = rf ? (rf.textureScale ?? roofTextureScale) : roofTextureScale;
  const curWeathering = rf ? (rf.weathering ?? roofWeathering) : roofWeathering;
  const curOpacity = rf ? rf.opacity : roofOpacity;
  const curRecolor = rf ? (rf.recolor ?? DEFAULT_RECOLOR) : toolRecolors.roof;

  const activeLevel = doc.levels.find((lv) => lv.id === doc.activeLevelId);
  const roofLevel = doc.levels.find((lv) => lv.kind === "roof");

  const patchRoof = (
    roofPatch: Partial<RoofStructure>,
    brushPatch?: Parameters<typeof st.setBrushParams>[0],
    recordHistory = false,
  ) => {
    if (selectedRoof) {
      st.updateRoof(selectedRoof.layerId, selectedRoof.roof.id, roofPatch, recordHistory);
    }
    if (brushPatch) {
      st.setBrushParams(brushPatch);
    }
  };

  const checkpointIfSelected = () => {
    if (selectedRoof) st.checkpointHistory();
  };

  const extraRoofTextures = useMemo(() => {
    const presetIds = new Set(ROOF_MATERIAL_PRESETS.map((p) => p.assetId));
    const q = texFilter.trim().toLowerCase();
    return allVaultAssets.filter((a) => {
      if (a.category !== "terrain") return false;
      if (presetIds.has(a.id)) return false;
      const isRoofTagged =
        LEGACY_ROOF_IDS.has(a.id) ||
        a.tags.includes("roof") ||
        a.displayName.toLowerCase().includes("roof") ||
        a.displayName.toLowerCase().includes("shingle");
      if (!showAllTerrain && !isRoofTagged) return false;
      if (q) {
        return (
          a.displayName.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allVaultAssets, showAllTerrain, texFilter]);

  const openRoofDetailVault = (query: string, subGroup: "roofs" | null = null) => {
    const vs = useVaultStore.getState();
    vs.setActiveCategory("object");
    vs.setActiveSubGroup(subGroup);
    vs.setSearchQuery(query);
    st.setVaultDrawerOpen(true);
    st.setActiveTool("stamp");
  };

  const coneRadiusCells =
    rf && rf.style === "cone" && rf.points.length >= 2
      ? Math.hypot(rf.points[1].x - rf.points[0].x, rf.points[1].y - rf.points[0].y)
      : curWidth * 0.5;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Selected Roof Banner */}
      {selectedRoof && rf && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              padding: "6px 8px",
              borderRadius: 6,
              background: "rgba(251, 146, 60, 0.13)",
              border: "1px solid rgba(251, 146, 60, 0.42)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FED7AA" }}>
                Selected {rf.style.charAt(0).toUpperCase() + rf.style.slice(1)} Roof
              </span>
              <span style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
                {rf.style === "cone"
                  ? "Drag center or rim gold dot · Alt+Wheel resizes"
                  : "Drag amber edge pills for span · Shift+Drag cyan + to bend"}
              </span>
            </div>
            <button
              type="button"
              className="dc-btn dc-btn-ghost dc-btn-icon"
              title="Delete Selected Roof (Del)"
              aria-label="Delete Selected Roof"
              onClick={() => st.deleteSelection()}
              style={{ color: "#FCA5A5", flexShrink: 0 }}
            >
              <Trash2 size={13} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            <button
              type="button"
              className="dc-btn"
              title="Bring this roof above overlapping wings on the same layer"
              onClick={() => st.reorderRoofInLayer(selectedRoof.layerId, rf.id, "front")}
              style={{ height: 25, justifyContent: "center", gap: 4, fontSize: 10, padding: "0 5px" }}
            >
              <ArrowUpToLine size={11} />
              <span>Front</span>
            </button>
            <button
              type="button"
              className="dc-btn"
              title="Send this roof behind overlapping wings on the same layer"
              onClick={() => st.reorderRoofInLayer(selectedRoof.layerId, rf.id, "back")}
              style={{ height: 25, justifyContent: "center", gap: 4, fontSize: 10, padding: "0 5px" }}
            >
              <ArrowDownToLine size={11} />
              <span>Back</span>
            </button>
            <button
              type="button"
              className="dc-btn"
              title="Start drawing a new roof with these settings"
              onClick={() => {
                st.setSelection(null);
                st.setActiveTool("roof");
              }}
              style={{
                height: 25,
                justifyContent: "center",
                gap: 4,
                fontSize: 10,
                padding: "0 5px",
                background: "rgba(251, 146, 60, 0.16)",
                borderColor: "rgba(251, 146, 60, 0.45)",
                color: "#FED7AA",
              }}
            >
              <Home size={11} />
              <span>Draw New</span>
            </button>
          </div>
        </div>
      )}

      {/* Helpful Floor Switch Banner (never auto-jumps silently!) */}
      {!selectedRoof && roofLevel && activeLevel?.kind !== "roof" && (
        <button
          type="button"
          className="dc-btn"
          onClick={() => {
            st.selectLevel(roofLevel.id);
            st.setShowOnionSkin(true);
            st.pushToast("Switched to ROOF level with Ghost Floor below — ready for VTT roof overlay!", "success");
          }}
          title="Switch to the dedicated ROOF floor with Ghost Floor enabled so you can trace over 1F walls and export transparent VTT roof overlays"
          style={{
            width: "100%",
            height: "auto",
            padding: "6px 8px",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 6,
            fontSize: 10.5,
            background: "rgba(251, 146, 60, 0.1)",
            borderColor: "rgba(251, 146, 60, 0.36)",
            color: "#FED7AA",
            textAlign: "left",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Layers size={13} style={{ color: "#FB923C", flexShrink: 0 }} />
            <span>
              <strong>Work on ROOF Level</strong>{" "}
              <span style={{ color: "var(--text-secondary)", fontWeight: 400 }}>(+ Ghost Floor)</span>
            </span>
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              padding: "1px 5px",
              borderRadius: 4,
              background: "rgba(251, 146, 60, 0.2)",
            }}
          >
            VTT
          </span>
        </button>
      )}

      {/* 4-Mode Draw Tool Switcher */}
      {(!selectedRoof || activeTool === "roof") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {(
            [
              { id: "ridge_path" as RoofDrawMode, label: "Ridge Path", key: "1", icon: <Spline size={12} /> },
              { id: "box" as RoofDrawMode, label: "Box Roof", key: "2", icon: <Square size={12} /> },
              { id: "cone" as RoofDrawMode, label: "Tower / Dome", key: "3", icon: <Circle size={12} /> },
              { id: "auto_room" as RoofDrawMode, label: "Auto-Room", key: "4", icon: <Sparkles size={12} /> },
            ]
          ).map((m) => {
            const active = roofDrawMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                className="dc-btn"
                aria-pressed={active}
                onClick={() => {
                  st.setSelection(null);
                  st.setBrushParams({
                    roofDrawMode: m.id,
                    ...(m.id === "cone"
                      ? { roofStyle: "cone" }
                      : roofStyle === "cone"
                        ? { roofStyle: "hip" }
                        : {}),
                  });
                }}
                style={{
                  height: 28,
                  padding: "0 7px",
                  justifyContent: "space-between",
                  fontSize: 10.5,
                  background: active ? "rgba(251, 146, 60, 0.2)" : "var(--bg-panel)",
                  borderColor: active ? "rgba(251, 146, 60, 0.8)" : "var(--border-subtle)",
                  color: active ? "#FED7AA" : "var(--text-secondary)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {m.icon}
                  <span>{m.label}</span>
                </span>
                <span style={{ fontSize: 9, opacity: 0.65, fontFamily: "var(--font-mono)" }}>{m.key}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Architectural Roof Style Selector */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            marginBottom: 5,
            textTransform: "uppercase",
          }}
        >
          Architectural Style
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 3 }}>
          {ROOF_STYLE_OPTIONS.map((opt) => {
            const isAct = curStyle === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={isAct}
                title={opt.tip}
                onClick={() => {
                  if (selectedRoof) {
                    patchRoof({ style: opt.id }, { roofStyle: opt.id }, true);
                  } else {
                    st.setBrushParams({
                      roofStyle: opt.id,
                      ...(opt.id === "cone"
                        ? { roofDrawMode: "cone" }
                        : roofDrawMode === "cone"
                          ? { roofDrawMode: "ridge_path" }
                          : {}),
                    });
                  }
                }}
                style={{
                  height: 25,
                  padding: "0 4px",
                  borderRadius: 6,
                  border: `1px solid ${isAct ? "rgba(229, 169, 60, 0.82)" : "var(--border-subtle)"}`,
                  background: isAct ? "rgba(229, 169, 60, 0.2)" : "var(--bg-panel)",
                  color: isAct ? "#FDE68A" : "var(--text-secondary)",
                  fontSize: 10,
                  fontWeight: isAct ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 10 Hand-Inked Seamless Roof Material Presets */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 5,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "var(--accent-gold)",
              textTransform: "uppercase",
            }}
          >
            Roof Materials ({ROOF_MATERIAL_PRESETS.length})
          </span>
          <button
            type="button"
            className="dc-chip"
            style={{ height: 18, fontSize: 9, padding: "0 6px" }}
            onClick={() => setShowAllTerrain((v) => !v)}
          >
            {showAllTerrain ? "Roof Only" : "All Textures"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 5,
          }}
        >
          {ROOF_MATERIAL_PRESETS.map((preset) => {
            const isSel = curAssetId === preset.assetId;
            const vaultItem = vaultById.get(preset.assetId);
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => st.applyRoofPreset(preset.id)}
                title={`${preset.name} — sets texture, ridge cap (${preset.ridgeCapStyle}), and weathering`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 6px",
                  borderRadius: 6,
                  border: `1px solid ${isSel ? "rgba(251, 146, 60, 0.88)" : "var(--border-subtle)"}`,
                  background: isSel ? "rgba(251, 146, 60, 0.16)" : "var(--bg-panel)",
                  color: isSel ? "#FED7AA" : "var(--text-primary)",
                  fontSize: 10,
                  fontWeight: isSel ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: preset.ridgeColorHex,
                    border: "1px solid rgba(255,255,255,0.22)",
                  }}
                >
                  {vaultItem?.thumbUrl && (
                    <img
                      src={vaultItem.thumbUrl}
                      alt={preset.shortLabel}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  )}
                </div>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {preset.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Legacy Roof Tiles + Optional All Terrain Textures */}
        {(extraRoofTextures.length > 0 || showAllTerrain) && (
          <div style={{ marginTop: 6 }}>
            {showAllTerrain && (
              <input
                type="search"
                className="dc-input"
                placeholder="Filter extra roof / terrain textures…"
                value={texFilter}
                onChange={(e) => setTexFilter(e.target.value)}
                style={{ width: "100%", height: 24, fontSize: 10.5, marginBottom: 5 }}
              />
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {extraRoofTextures.slice(0, showAllTerrain ? 18 : 6).map((item) => {
                const isSel = curAssetId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      patchRoof({ assetId: item.id }, { activeRoofAssetId: item.id }, true)
                    }
                    title={item.displayName}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      height: 24,
                      padding: "2px 6px 2px 3px",
                      borderRadius: 5,
                      border: `1px solid ${isSel ? "rgba(251, 146, 60, 0.85)" : "var(--border-subtle)"}`,
                      background: isSel ? "rgba(251, 146, 60, 0.16)" : "var(--bg-panel)",
                      color: isSel ? "#FED7AA" : "var(--text-secondary)",
                      fontSize: 9.5,
                      cursor: "pointer",
                      maxWidth: "100%",
                    }}
                  >
                    <img
                      src={item.thumbUrl}
                      alt=""
                      loading="lazy"
                      style={{ width: 16, height: 16, borderRadius: 3, objectFit: "cover" }}
                    />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 112,
                      }}
                    >
                      {item.displayName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Geometry & Pitch Controls */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: "8px 9px",
          borderRadius: 7,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Geometry &amp; Pitch
        </div>

        {curStyle !== "cone" ? (
          <RangeField
            label="Span Width"
            valueText={`${curWidth.toFixed(1)} sq`}
            min={1.2}
            max={20.0}
            step={0.2}
            value={curWidth}
            onPointerDown={checkpointIfSelected}
            onChange={(val) => patchRoof({ widthCells: val }, { roofWidthCells: val })}
          />
        ) : (
          <div className="dc-field-row" style={{ marginBottom: 0 }}>
            <span className="dc-field-label">Turret Facets</span>
            <div style={{ display: "inline-flex", gap: 3 }}>
              {CONE_FACET_OPTIONS.map((opt) => (
                <button
                  key={opt.facets}
                  type="button"
                  className={`dc-chip ${curConeFacets === opt.facets ? "active" : ""}`}
                  style={{ height: 21, fontSize: 9.5, padding: "0 6px" }}
                  onClick={() =>
                    patchRoof({ coneFacets: opt.facets }, { roofConeFacets: opt.facets }, true)
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {curStyle === "cone" && rf && rf.points.length >= 2 && (
          <RangeField
            label="Turret Radius"
            valueText={`${coneRadiusCells.toFixed(1)} sq`}
            min={0.6}
            max={12.0}
            step={0.2}
            value={Number(coneRadiusCells.toFixed(2))}
            onPointerDown={checkpointIfSelected}
            onChange={(nextR) => {
              const c = rf.points[0];
              const rim = rf.points[1];
              const curR = Math.max(0.01, Math.hypot(rim.x - c.x, rim.y - c.y));
              const nextRim = {
                x: c.x + ((rim.x - c.x) / curR) * nextR,
                y: c.y + ((rim.y - c.y) / curR) * nextR,
              };
              patchRoof({ points: [c, nextRim], widthCells: nextR * 2 });
            }}
          />
        )}

        {(!selectedRoof && (roofDrawMode === "box" || roofDrawMode === "auto_room")) && (
          <RangeField
            label="Wall Overhang"
            valueText={`${roofOverhangCells.toFixed(2)} sq`}
            min={0}
            max={1.5}
            step={0.05}
            value={roofOverhangCells}
            onChange={(val) => st.setBrushParams({ roofOverhangCells: val })}
          />
        )}

        {!selectedRoof && roofDrawMode === "box" && (
          <div className="dc-field-row" style={{ marginBottom: 0 }}>
            <span className="dc-field-label">Rotate Box Ridge 90° (Q/E)</span>
            <button
              type="button"
              role="switch"
              aria-checked={roofRotateBoxRidge}
              className="dc-switch"
              onClick={() => st.setBrushParams({ roofRotateBoxRidge: !roofRotateBoxRidge })}
            />
          </div>
        )}

        {curStyle !== "cone" && (
          <div className="dc-field-row" style={{ marginBottom: 0 }}>
            <span className="dc-field-label">Curved Ridge (C)</span>
            <button
              type="button"
              role="switch"
              aria-checked={curCurved}
              className="dc-switch"
              onClick={() => patchRoof({ curved: !curCurved }, { roofCurved: !curCurved }, true)}
            />
          </div>
        )}

        {curStyle === "shed" && (
          <div className="dc-field-row" style={{ marginBottom: 0 }}>
            <span className="dc-field-label">Slope Direction (X)</span>
            <button
              type="button"
              className="dc-btn"
              style={{ height: 22, padding: "0 8px", fontSize: 10, gap: 5 }}
              onClick={() =>
                patchRoof({ flipSlope: !curFlipSlope }, { roofFlipSlope: !curFlipSlope }, true)
              }
            >
              <FlipHorizontal2 size={11} />
              <span>{curFlipSlope ? "Left Slope" : "Right Slope"}</span>
            </button>
          </div>
        )}

        {(curStyle === "gable" || curStyle === "hip") && (
          <RangeField
            label="Ridge Offset"
            valueText={curRidgeOffset === 0 ? "Centered" : `${curRidgeOffset > 0 ? "+" : ""}${Math.round(curRidgeOffset * 100)}%`}
            min={-0.38}
            max={0.38}
            step={0.02}
            value={curRidgeOffset}
            onPointerDown={checkpointIfSelected}
            onChange={(val) => patchRoof({ ridgeOffset: val }, { roofRidgeOffset: val })}
          />
        )}

        {curStyle === "hip" && (
          <RangeField
            label="Hip Bevel"
            valueText={`${Math.round(curHipInset * 100)}%`}
            min={0.2}
            max={1.0}
            step={0.05}
            value={curHipInset}
            onPointerDown={checkpointIfSelected}
            onChange={(val) => patchRoof({ hipInsetRatio: val }, { roofHipInsetRatio: val })}
          />
        )}

        {curStyle === "mansard" && (
          <RangeField
            label="Crown Width"
            valueText={`${Math.round(curMansardCrown * 100)}%`}
            min={0.2}
            max={0.75}
            step={0.05}
            value={curMansardCrown}
            onPointerDown={checkpointIfSelected}
            onChange={(val) =>
              patchRoof({ mansardCrownRatio: val }, { roofMansardCrownRatio: val })
            }
          />
        )}

        <RangeField
          label="Tile Scale"
          valueText={`${curTexScale.toFixed(2)}×`}
          min={0.5}
          max={2.0}
          step={0.05}
          value={curTexScale}
          onPointerDown={checkpointIfSelected}
          onChange={(val) => patchRoof({ textureScale: val }, { roofTextureScale: val })}
        />
      </div>

      {/* 3D Sunlight, Shading, Ridge Caps & Shadows */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 7,
          padding: "8px 9px",
          borderRadius: 7,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "#FDE68A",
            }}
          >
            <Sun size={11} style={{ color: "var(--accent-gold)" }} />
            Sunlight, Trim &amp; Depth
          </span>
          <button
            type="button"
            className="dc-chip"
            style={{ height: 19, fontSize: 9, padding: "0 6px", gap: 3 }}
            title="Apply this sun angle to every roof on the map for consistent village shadows"
            onClick={() => {
              st.syncSunAngleToAllRoofs(curSunDeg);
              st.pushToast(`Synced all roofs to ${Math.round(curSunDeg)}° sunlight`, "success");
            }}
          >
            <Compass size={10} />
            <span>Sync All</span>
          </button>
        </div>

        <RangeField
          label="Sun Angle"
          valueText={`${Math.round(curSunDeg)}°`}
          min={0}
          max={355}
          step={5}
          value={Math.round(curSunDeg)}
          onPointerDown={checkpointIfSelected}
          onChange={(val) => patchRoof({ sunAngleDeg: val }, { roofSunAngleDeg: val })}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
          {SUN_COMPASS_PRESETS.map((p) => {
            const isAct = Math.abs(((curSunDeg - p.deg + 540) % 360) - 180) <= 10;
            return (
              <button
                key={p.label}
                type="button"
                title={p.tip}
                className={`dc-chip ${isAct ? "active" : ""}`}
                style={{ height: 21, fontSize: 9.5, justifyContent: "center", padding: "0 4px" }}
                onClick={() =>
                  patchRoof({ sunAngleDeg: p.deg }, { roofSunAngleDeg: p.deg }, true)
                }
              >
                {p.label} {p.deg}°
              </button>
            );
          })}
        </div>

        <RangeField
          label="Slope Shading"
          valueText={`${Math.round(curSlopeShade * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          value={curSlopeShade}
          onPointerDown={checkpointIfSelected}
          onChange={(val) => patchRoof({ slopeShade: val }, { roofSlopeShade: val })}
        />

        <div>
          <div className="dc-field-label" style={{ marginBottom: 4 }}>
            Ridge &amp; Hip Caps
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 3 }}>
            {RIDGE_CAP_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`dc-chip ${curRidgeCap === opt.id ? "active" : ""}`}
                style={{ height: 21, fontSize: 9.5, justifyContent: "center", padding: "0 3px" }}
                onClick={() =>
                  patchRoof({ ridgeCapStyle: opt.id }, { roofRidgeCapStyle: opt.id }, true)
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {curRidgeCap !== "none" && (
          <RangeField
            label="Ridge Cap Width"
            valueText={`${curRidgeCapW.toFixed(2)} sq`}
            min={0.14}
            max={0.65}
            step={0.02}
            value={curRidgeCapW}
            onPointerDown={checkpointIfSelected}
            onChange={(val) =>
              patchRoof({ ridgeCapWidthCells: val }, { roofRidgeCapWidthCells: val })
            }
          />
        )}

        <div className="dc-field-row" style={{ marginBottom: 0 }}>
          <span className="dc-field-label">Outer Eave Fascia Trim</span>
          <button
            type="button"
            role="switch"
            aria-checked={curEaveTrim}
            className="dc-switch"
            onClick={() =>
              patchRoof({ eaveTrim: !curEaveTrim }, { roofEaveTrim: !curEaveTrim }, true)
            }
          />
        </div>

        <RangeField
          label="Ground Shadow"
          valueText={`${Math.round(curDropShadow * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          value={curDropShadow}
          onPointerDown={checkpointIfSelected}
          onChange={(val) => patchRoof({ dropShadow: val }, { roofDropShadow: val })}
        />

        {curDropShadow > 0.02 && (
          <RangeField
            label="Shadow Offset"
            valueText={`${curShadowDist.toFixed(2)} sq`}
            min={0.1}
            max={1.4}
            step={0.05}
            value={curShadowDist}
            onPointerDown={checkpointIfSelected}
            onChange={(val) =>
              patchRoof({ shadowDistanceCells: val }, { roofShadowDistanceCells: val })
            }
          />
        )}

        <RangeField
          label="Weathering"
          valueText={`${Math.round(curWeathering * 100)}%`}
          min={0}
          max={1}
          step={0.05}
          value={curWeathering}
          onPointerDown={checkpointIfSelected}
          onChange={(val) => patchRoof({ weathering: val }, { roofWeathering: val })}
        />

        <RangeField
          label="Interior Peek Opacity"
          valueText={`${Math.round(curOpacity * 100)}%`}
          min={0.15}
          max={1}
          step={0.05}
          value={curOpacity}
          onPointerDown={checkpointIfSelected}
          onChange={(val) => patchRoof({ opacity: val }, { roofOpacity: val })}
        />
      </div>

      {/* Universal RGB Recolor for Any Roof Texture */}
      <ColorStudioPanel
        recolor={curRecolor}
        asset={vaultById.get(curAssetId)}
        eyedropperTarget={selectedRoof ? "selection" : "roof"}
        title={selectedRoof ? "Selected Roof Tint" : "Roof Tint & Shader"}
        compact
        onChange={(next, rec) => {
          if (selectedRoof) {
            st.updateRoof(
              selectedRoof.layerId,
              selectedRoof.roof.id,
              { recolor: next.enabled ? next : undefined },
              rec,
            );
          } else {
            st.setToolRecolor("roof", next);
          }
        }}
        onCopyStyle={selectedRoof ? () => st.copySelectedRecolor() : undefined}
        onPasteStyle={selectedRoof ? () => st.pasteRecolorToSelected() : undefined}
        hasCopiedStyle={Boolean(copiedRecolor)}
      />

      {/* Quick Vault Shortcuts for Roof Detailing Props */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 5,
          padding: "7px 8px",
          borderRadius: 7,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            Roof Details &amp; Props
          </span>
          <RotateCw size={10} style={{ opacity: 0.45 }} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {ROOF_DETAIL_SHORTCUTS.map((sc) => (
            <button
              key={sc.label}
              type="button"
              className="dc-chip"
              style={{ height: 21, fontSize: 9.5, padding: "0 7px" }}
              onClick={() => openRoofDetailVault(sc.query, sc.subGroup)}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

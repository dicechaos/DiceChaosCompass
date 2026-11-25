import React from "react";
import { Droplets, Eraser, Layers, Pentagon, RotateCcw, Sparkles, Trash2, Waves } from "lucide-react";
import { findPreferredLayerForKind } from "@/engine/layerMeta";
import { WATER_BIOME_PRESETS } from "@/engine/waterEngine";
import { useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import type { WaterBodyKind, WaterDrawMode, WaterRegion } from "@/types/map";

interface WaterStudioPanelProps {
  selectedWater?: { layerId: string; region: WaterRegion } | null;
}

const WATER_TEXTURES: Array<{ id: string; label: string }> = [
  { id: "modular-suite/terrain/water_alpine_crystal.png", label: "Alpine Crystal Lake" },
  { id: "modular-suite/terrain/water_tropical_lagoon.png", label: "Tropical Turquoise Lagoon" },
  { id: "modular-suite/terrain/water_deep_ocean_swell.png", label: "Deep Ocean Swell" },
  { id: "core-fantasy/terrain/shallow_creek_bed.png", label: "Shallow Creek Bed" },
  { id: "core-fantasy/terrain/deep_pond_water.png", label: "Deep Pond Water" },
  { id: "modular-suite/terrain/water_murky_swamp_bayou.png", label: "Murky Bayou Swamp" },
  { id: "modular-suite/terrain/frozen_lake_ice.png", label: "Frozen Glacial Ice" },
  { id: "core-fantasy/terrain/volcanic_basalt.png", label: "Volcanic Basalt / Magma" },
  { id: "terrain/under_city_abyss.png", label: "Under-City Abyss" },
];

const WATER_QUICK_PACKS: Array<{ label: string; query: string; category?: "all" | "object" | "path" | "wall" | "terrain" }> = [
  { label: "Ripples & Foam", query: "water_ripples_foam", category: "object" },
  { label: "Lily Pads & Banks", query: "water_flora_banks", category: "object" },
  { label: "Fish & Wildlife", query: "water_wildlife_submerged", category: "object" },
  { label: "Docks & Fishing", query: "water_docks_fishing", category: "object" },
  { label: "Boats & Rafts", query: "water_boats_craft", category: "object" },
  { label: "Yacht & Resort", query: "water_yacht_luxury", category: "object" },
  { label: "Bridges & Sluices", query: "water_bridges_structures", category: "object" },
  { label: "Foam & Quay Paths", query: "water_suite", category: "path" },
];

export const WaterStudioPanel: React.FC<WaterStudioPanelProps> = ({ selectedWater }) => {
  const doc = useDocumentStore(
    (s) => s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0],
  );
  const activeTool = useDocumentStore((s) => s.activeTool);
  const waterDrawMode = useDocumentStore((s) => s.waterDrawMode);
  const waterPresetId = useDocumentStore((s) => s.waterPresetId);
  const waterKind = useDocumentStore((s) => s.waterKind);
  const waterTextureAssetId = useDocumentStore((s) => s.waterTextureAssetId);
  const waterDeepColorHex = useDocumentStore((s) => s.waterDeepColorHex);
  const waterShallowColorHex = useDocumentStore((s) => s.waterShallowColorHex);
  const waterRimColorHex = useDocumentStore((s) => s.waterRimColorHex);
  const waterOpacity = useDocumentStore((s) => s.waterOpacity);
  const waterBrushRadiusCells = useDocumentStore((s) => s.waterBrushRadiusCells);
  const waterRiverWidthCells = useDocumentStore((s) => s.waterRiverWidthCells);
  const waterCurved = useDocumentStore((s) => s.waterCurved);
  const waterRippleIntensity = useDocumentStore((s) => s.waterRippleIntensity);
  const waterCausticsIntensity = useDocumentStore((s) => s.waterCausticsIntensity);
  const waterDepthFeather = useDocumentStore((s) => s.waterDepthFeather);
  const waterShoreBankIntensity = useDocumentStore((s) => s.waterShoreBankIntensity);
  const waterOrganicRoughness = useDocumentStore((s) => s.waterOrganicRoughness);

  const st = useDocumentStore.getState();
  const reg = selectedWater?.region ?? null;
  const targetWaterLayer = selectedWater
    ? doc.layers.find((l) => l.id === selectedWater.layerId) ?? null
    : findPreferredLayerForKind(doc, "water");
  const curMeshEnabled = targetWaterLayer?.waterMeshEnabled !== false;
  const curBlendRadius = targetWaterLayer?.waterBlendRadiusCells ?? 1.1;

  const updateLayerTransition = (
    partial: { waterMeshEnabled?: boolean; waterBlendRadiusCells?: number },
    recordHistory = false,
  ) => {
    const lyrId = targetWaterLayer?.id ?? st.ensureActiveWaterLayer();
    if (lyrId) {
      st.updateLayerWaterSettings(lyrId, partial, recordHistory);
    }
  };

  // Unified live values: edit the selected WaterRegion directly, or default brush settings when painting
  const curKind: WaterBodyKind = reg ? reg.kind : waterKind;
  const curPreset = reg ? (reg.presetId ?? "") : waterPresetId;
  const curTex = reg ? (reg.textureAssetId ?? waterTextureAssetId) : waterTextureAssetId;
  const curDeep = reg ? reg.deepColorHex : waterDeepColorHex;
  const curShallow = reg ? (reg.shallowColorHex ?? reg.rimColorHex) : waterShallowColorHex;
  const curRim = reg ? reg.rimColorHex : waterRimColorHex;
  const curOpacity = reg ? reg.opacity : waterOpacity;
  const curRiverW = reg ? (reg.widthCells ?? 2.6) : waterRiverWidthCells;
  const curCurved = reg ? (reg.curved ?? reg.kind !== "chasm") : waterCurved;
  const curRipple = reg ? (reg.rippleIntensity ?? (reg.kind === "chasm" ? 0 : 0.65)) : waterRippleIntensity;
  const curCaustics = reg ? (reg.causticsIntensity ?? (reg.kind === "chasm" ? 0 : 0.42)) : waterCausticsIntensity;
  const curFeather = reg ? (reg.depthFeather ?? 0.6) : waterDepthFeather;
  const curBank = reg ? (reg.shoreBankIntensity ?? (reg.kind === "chasm" ? 0 : 0.42)) : waterShoreBankIntensity;
  const curRough = reg ? (reg.organicRoughness ?? 0) : waterOrganicRoughness;

  const patchWater = (
    regionPatch: Partial<WaterRegion>,
    brushPatch?: Parameters<typeof st.setBrushParams>[0],
    recordHistory = false,
  ) => {
    if (selectedWater) {
      st.updateWaterRegion(selectedWater.layerId, selectedWater.region.id, regionPatch, recordHistory);
    }
    if (brushPatch) {
      st.setBrushParams(brushPatch);
    }
  };

  const openWaterVaultPack = (query: string, category: "all" | "object" | "path" | "wall" | "terrain" = "object") => {
    const vs = useVaultStore.getState();
    vs.setActiveCategory(category);
    vs.setSearchQuery(query);
    st.setVaultDrawerOpen(true);
    if (category === "path") {
      st.setActiveTool("path");
    } else if (category === "wall") {
      st.setActiveTool("wall");
    } else {
      st.setActiveTool("stamp");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {selectedWater && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
              padding: "6px 8px",
              borderRadius: 6,
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.38)",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#BAE6FD" }}>
                {reg?.shape === "river" ? "Selected River Stream" : "Selected Water Basin"}
              </span>
              <span style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
                Drag gold dots to reshape · Shift+Drag cyan + to bend
              </span>
            </div>
            <button
              type="button"
              className="dc-btn dc-btn-ghost dc-btn-icon"
              title="Delete Selected Water Body (Del)"
              onClick={() => st.deleteSelection()}
              style={{ color: "#FCA5A5" }}
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <button
              type="button"
              className="dc-btn"
              onClick={() => {
                st.setSelection(null);
                st.setBrushParams({ waterDrawMode: "lake_brush" });
                st.setActiveTool("water");
              }}
              style={{
                height: 26,
                justifyContent: "center",
                gap: 5,
                fontSize: 10.5,
                background: "rgba(56, 189, 248, 0.14)",
                borderColor: "rgba(56, 189, 248, 0.45)",
                color: "#BAE6FD",
              }}
            >
              <Droplets size={12} />
              <span>Sculpt with Brush</span>
            </button>
            <button
              type="button"
              className="dc-btn"
              onClick={() => {
                st.setSelection(null);
                st.setBrushParams({ waterDrawMode: "erase" });
                st.setActiveTool("water");
              }}
              style={{
                height: 26,
                justifyContent: "center",
                gap: 5,
                fontSize: 10.5,
                background: "rgba(251, 191, 36, 0.12)",
                borderColor: "rgba(251, 191, 36, 0.45)",
                color: "#FDE68A",
              }}
            >
              <Eraser size={12} />
              <span>Carve Island / Trim</span>
            </button>
          </div>
        </div>
      )}

      {(!selectedWater || activeTool === "water") && (
        /* 4-Mode Water Tool Switcher */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {(
            [
              { id: "lake_brush" as WaterDrawMode, label: "Lake Brush", key: "1", icon: <Droplets size={12} /> },
              { id: "river_path" as WaterDrawMode, label: "River Path", key: "2", icon: <Waves size={12} /> },
              { id: "polygon" as WaterDrawMode, label: "Lake Polygon", key: "3", icon: <Pentagon size={12} /> },
              { id: "erase" as WaterDrawMode, label: "Island / Erase", key: "4/E", icon: <Eraser size={12} /> },
            ]
          ).map((m) => {
            const active = waterDrawMode === m.id;
            const isErase = m.id === "erase";
            return (
              <button
                key={m.id}
                type="button"
                className="dc-btn"
                onClick={() => {
                  st.setSelection(null);
                  st.setBrushParams({ waterDrawMode: m.id });
                }}
                style={{
                  height: 28,
                  padding: "0 7px",
                  justifyContent: "space-between",
                  fontSize: 10.5,
                  background: active
                    ? isErase
                      ? "rgba(251, 191, 36, 0.2)"
                      : "rgba(56, 189, 248, 0.2)"
                    : "var(--bg-panel)",
                  borderColor: active
                    ? isErase
                      ? "rgba(251, 191, 36, 0.72)"
                      : "rgba(56, 189, 248, 0.78)"
                    : "var(--border-subtle)",
                  color: active ? (isErase ? "#FDE68A" : "#BAE6FD") : "var(--text-secondary)",
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

      {/* 8 Curated Water Biome Presets */}
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
          Water Biome Presets
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {WATER_BIOME_PRESETS.map((preset) => {
            const isSel = curPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => st.applyWaterPreset(preset.id)}
                title={preset.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 7px",
                  borderRadius: 6,
                  border: `1px solid ${isSel ? "rgba(56, 189, 248, 0.85)" : "var(--border-subtle)"}`,
                  background: isSel ? "rgba(56, 189, 248, 0.16)" : "var(--bg-panel)",
                  color: isSel ? "#E0F2FE" : "var(--text-secondary)",
                  fontSize: 10.5,
                  fontWeight: isSel ? 700 : 500,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    flexShrink: 0,
                    background: `linear-gradient(135deg, ${preset.shallowColorHex} 0%, ${preset.deepColorHex} 100%)`,
                    border: `1px solid ${preset.rimColorHex}`,
                  }}
                />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {preset.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Same-Layer Water Mesh & Biome Transition Control */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
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
            gap: 6,
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
              color: "#BAE6FD",
            }}
          >
            <Layers size={11} style={{ color: "#38BDF8" }} />
            Same-Layer Transition
          </span>
          <span style={{ fontSize: 9.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {curMeshEnabled ? (curBlendRadius <= 0.05 ? "CRISP" : `${curBlendRadius.toFixed(1)} sq`) : "STACKED"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <button
            type="button"
            className="dc-btn"
            aria-pressed={curMeshEnabled}
            onClick={() => updateLayerTransition({ waterMeshEnabled: true }, true)}
            style={{
              height: 24,
              justifyContent: "center",
              fontSize: 10,
              background: curMeshEnabled ? "rgba(56, 189, 248, 0.2)" : "var(--bg-elevated)",
              borderColor: curMeshEnabled ? "rgba(56, 189, 248, 0.72)" : "var(--border-subtle)",
              color: curMeshEnabled ? "#E0F2FE" : "var(--text-secondary)",
            }}
          >
            Mesh &amp; Blend
          </button>
          <button
            type="button"
            className="dc-btn"
            aria-pressed={!curMeshEnabled}
            onClick={() => updateLayerTransition({ waterMeshEnabled: false }, true)}
            style={{
              height: 24,
              justifyContent: "center",
              fontSize: 10,
              background: !curMeshEnabled ? "rgba(229, 169, 60, 0.18)" : "var(--bg-elevated)",
              borderColor: !curMeshEnabled ? "rgba(229, 169, 60, 0.65)" : "var(--border-subtle)",
              color: !curMeshEnabled ? "#FDE68A" : "var(--text-secondary)",
            }}
          >
            Stack Separate
          </button>
        </div>

        {curMeshEnabled ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
              {(
                [
                  { label: "Crisp", val: 0 },
                  { label: "Smooth", val: 1.1 },
                  { label: "Wide", val: 2.4 },
                ] as const
              ).map((preset) => {
                const isAct = Math.abs(curBlendRadius - preset.val) < 0.08;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className="dc-btn"
                    onClick={() => updateLayerTransition({ waterBlendRadiusCells: preset.val }, true)}
                    style={{
                      height: 22,
                      justifyContent: "center",
                      fontSize: 9.5,
                      padding: "0 4px",
                      background: isAct ? "rgba(56, 189, 248, 0.18)" : "transparent",
                      borderColor: isAct ? "rgba(56, 189, 248, 0.65)" : "var(--border-subtle)",
                      color: isAct ? "#BAE6FD" : "var(--text-muted)",
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
            <label className="dc-slider-row">
              <span>Blend Width</span>
              <input
                type="range"
                min={0}
                max={3}
                step={0.1}
                value={curBlendRadius}
                onChange={(e) =>
                  updateLayerTransition({ waterBlendRadiusCells: Number(e.target.value) }, false)
                }
              />
              <span className="dc-mono-val">{curBlendRadius.toFixed(1)} sq</span>
            </label>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)", lineHeight: 1.3 }}>
              Water on this layer meshes &amp; shares shorelines. Add another Water layer (+) to stack separately.
            </div>
          </>
        ) : (
          <div style={{ fontSize: 9.5, color: "var(--text-muted)", lineHeight: 1.3 }}>
            Each water body on this layer keeps its own separate shoreline and overlaps in draw order.
          </div>
        )}
      </div>

      {/* Geometry & Size Sliders */}
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
        {(!selectedWater && (waterDrawMode === "lake_brush" || waterDrawMode === "erase")) && (
          <label className="dc-slider-row">
            <span>{waterDrawMode === "erase" ? "Island Radius" : "Brush Radius"}</span>
            <input
              type="range"
              min={0.65}
              max={6}
              step={0.15}
              value={waterBrushRadiusCells}
              onChange={(e) => st.setBrushParams({ waterBrushRadiusCells: Number(e.target.value) })}
            />
            <span className="dc-mono-val">{waterBrushRadiusCells.toFixed(1)} sq</span>
          </label>
        )}

        {(waterDrawMode === "river_path" || reg?.shape === "river") && (
          <label className="dc-slider-row">
            <span>River Width</span>
            <input
              type="range"
              min={0.75}
              max={8}
              step={0.2}
              value={curRiverW}
              onChange={(e) => {
                const v = Number(e.target.value);
                patchWater({ widthCells: v }, { waterRiverWidthCells: v }, false);
              }}
            />
            <span className="dc-mono-val">{curRiverW.toFixed(1)} sq</span>
          </label>
        )}

        <label className="dc-slider-row">
          <span>Depth Feather</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={curFeather}
            onChange={(e) => {
              const v = Number(e.target.value);
              patchWater({ depthFeather: v }, { waterDepthFeather: v }, false);
            }}
          />
          <span className="dc-mono-val">{Math.round(curFeather * 100)}%</span>
        </label>

        <label className="dc-slider-row">
          <span>Ripples &amp; Foam</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={curRipple}
            onChange={(e) => {
              const v = Number(e.target.value);
              patchWater({ rippleIntensity: v }, { waterRippleIntensity: v }, false);
            }}
          />
          <span className="dc-mono-val">{Math.round(curRipple * 100)}%</span>
        </label>

        <label className="dc-slider-row">
          <span>Sun Caustics</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={curCaustics}
            onChange={(e) => {
              const v = Number(e.target.value);
              patchWater({ causticsIntensity: v }, { waterCausticsIntensity: v }, false);
            }}
          />
          <span className="dc-mono-val">{Math.round(curCaustics * 100)}%</span>
        </label>

        <label className="dc-slider-row">
          <span>Wet Shore Bank</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={curBank}
            onChange={(e) => {
              const v = Number(e.target.value);
              patchWater({ shoreBankIntensity: v }, { waterShoreBankIntensity: v }, false);
            }}
          />
          <span className="dc-mono-val">{Math.round(curBank * 100)}%</span>
        </label>

        <label className="dc-slider-row">
          <span>Roughness</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={curRough}
            onChange={(e) => {
              const v = Number(e.target.value);
              patchWater({ organicRoughness: v }, { waterOrganicRoughness: v }, false);
            }}
          />
          <span className="dc-mono-val">{Math.round(curRough * 100)}%</span>
        </label>

        <label className="dc-slider-row">
          <span>Water Opacity</span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.02}
            value={curOpacity}
            onChange={(e) => {
              const v = Number(e.target.value);
              patchWater({ opacity: v }, { waterOpacity: v }, false);
            }}
          />
          <span className="dc-mono-val">{Math.round(curOpacity * 100)}%</span>
        </label>
      </div>

      {/* Colors, Surface Texture & Curved Toggle */}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--text-muted)" }}>
            <span>Deep</span>
            <input
              type="color"
              value={curDeep}
              onChange={(e) => patchWater({ deepColorHex: e.target.value }, { waterDeepColorHex: e.target.value }, false)}
              style={{ width: "100%", height: 24, border: "1px solid var(--border-subtle)", borderRadius: 4, background: "transparent", cursor: "pointer" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--text-muted)" }}>
            <span>Shallows</span>
            <input
              type="color"
              value={curShallow}
              onChange={(e) => patchWater({ shallowColorHex: e.target.value }, { waterShallowColorHex: e.target.value }, false)}
              style={{ width: "100%", height: 24, border: "1px solid var(--border-subtle)", borderRadius: 4, background: "transparent", cursor: "pointer" }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 10, color: "var(--text-muted)" }}>
            <span>Foam Rim</span>
            <input
              type="color"
              value={curRim}
              onChange={(e) => patchWater({ rimColorHex: e.target.value }, { waterRimColorHex: e.target.value }, false)}
              style={{ width: "100%", height: 24, border: "1px solid var(--border-subtle)", borderRadius: 4, background: "transparent", cursor: "pointer" }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <select
            className="dc-select"
            aria-label="Water Body Kind"
            value={curKind}
            onChange={(e) => {
              const v = e.target.value as WaterBodyKind;
              patchWater({ kind: v }, { waterKind: v }, true);
            }}
            style={{ fontSize: 11, height: 26 }}
          >
            <option value="water">Water (Lake/River)</option>
            <option value="swamp">Swamp / Mire</option>
            <option value="ice">Frozen Ice</option>
            <option value="lava">Volcanic Lava</option>
            <option value="chasm">Chasm / Abyss</option>
          </select>

          <button
            type="button"
            className="dc-btn"
            onClick={() => patchWater({ curved: !curCurved }, { waterCurved: !curCurved }, true)}
            style={{
              height: 26,
              fontSize: 10.5,
              background: curCurved ? "rgba(56, 189, 248, 0.16)" : "var(--bg-elevated)",
              borderColor: curCurved ? "rgba(56, 189, 248, 0.65)" : "var(--border-subtle)",
              color: curCurved ? "#BAE6FD" : "var(--text-secondary)",
            }}
          >
            {curCurved ? "Smooth Shore: ON" : "Crisp Edges"}
          </button>
        </div>

        <select
          className="dc-select"
          aria-label="Water Surface Texture"
          value={curTex}
          onChange={(e) => patchWater({ textureAssetId: e.target.value }, { waterTextureAssetId: e.target.value }, true)}
          style={{ fontSize: 11, height: 26 }}
        >
          {WATER_TEXTURES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        {selectedWater && (selectedWater.region.cutouts?.length ?? 0) > 0 && (
          <button
            type="button"
            className="dc-btn dc-btn-ghost"
            onClick={() => {
              st.clearWaterCutouts(selectedWater.layerId, selectedWater.region.id);
              st.pushToast("Restored carved islands back to water");
            }}
            style={{ height: 26, fontSize: 10.5, justifyContent: "center", gap: 5 }}
          >
            <RotateCcw size={12} />
            <span>Restore {selectedWater.region.cutouts!.length} Carved Island(s)</span>
          </button>
        )}
      </div>

      {/* Water Scene Quick-Stamp Kit */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            marginBottom: 5,
            textTransform: "uppercase",
          }}
        >
          <Sparkles size={11} style={{ color: "#38BDF8" }} />
          <span>Water Scene Asset Kit (128+ CC0)</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {WATER_QUICK_PACKS.map((pack) => (
            <button
              key={pack.label}
              type="button"
              className="dc-btn"
              onClick={() => openWaterVaultPack(pack.query, pack.category)}
              style={{
                height: 25,
                padding: "0 7px",
                fontSize: 10,
                justifyContent: "flex-start",
                background: "var(--bg-panel)",
                borderColor: "var(--border-subtle)",
                color: "var(--text-secondary)",
              }}
            >
              {pack.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

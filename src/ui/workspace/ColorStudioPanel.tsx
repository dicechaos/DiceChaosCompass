import React, { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Layers,
  Pipette,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  describeAssetColorCapability,
  getProcessedTexture,
  resolveEffectiveRecolorMode,
  TTRPG_PALETTE_SWATCHES,
} from "@/engine/colorShader";
import { texturePool } from "@/engine/sceneRenderer";
import {
  type EyedropperTarget,
  useDocumentStore,
} from "@/store/documentStore";
import {
  DEFAULT_RECOLOR,
  type RecolorMode,
  type RgbRecolor,
  type VaultAsset,
} from "@/types/map";

interface ColorStudioPanelProps {
  recolor: RgbRecolor;
  asset?: VaultAsset | null;
  eyedropperTarget?: Exclude<EyedropperTarget, null>;
  title?: string;
  compact?: boolean;
  showPreviewCanvas?: boolean;
  onChange: (next: RgbRecolor, recordHistory?: boolean) => void;
  onCopyStyle?: () => void;
  onPasteStyle?: () => void;
  hasCopiedStyle?: boolean;
  onApplyToAllMatching?: () => void;
}

const MODE_OPTIONS: Array<{ id: RecolorMode; label: string; tip: string }> = [
  { id: "auto", label: "Auto", tip: "Automatically pick best shader for this asset" },
  {
    id: "dd_red",
    label: "DD Red",
    tip: "Dungeondraft Red-Channel Mask: replaces red-coded pixels while keeping shadows, highlights & ink intact",
  },
  {
    id: "rgb_channels",
    label: "RGB 3",
    tip: "Wonderdraft 3-Channel Mask: independent Red, Green, and Blue region colors",
  },
  {
    id: "tint",
    label: "Ink",
    tip: "Ink-Preserving Multiply Tint: ideal for Wonderdraft grayscale symbols & monochrome props",
  },
  {
    id: "universal",
    label: "Grade",
    tip: "Universal Studio Colorize: recolor ANY full-color prop, wall, path, door, or terrain",
  },
];

export const ColorStudioPanel: React.FC<ColorStudioPanelProps> = ({
  recolor,
  asset,
  eyedropperTarget,
  title = "Colorable & Shader Studio",
  compact = false,
  showPreviewCanvas = false,
  onChange,
  onCopyStyle,
  onPasteStyle,
  hasCopiedStyle = false,
  onApplyToAllMatching,
}) => {
  const [gradeOpen, setGradeOpen] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const customSwatches = useDocumentStore((s) => s.customSwatches);
  const activeEyedropper = useDocumentStore((s) => s.eyedropperTarget);
  const st = useDocumentStore.getState();

  const capability = describeAssetColorCapability(asset);
  const effectiveMode = resolveEffectiveRecolorMode(recolor, asset);
  const currentMode: RecolorMode = recolor.mode ?? "auto";
  const defaultStrength = effectiveMode === "universal" ? 0.62 : 1.0;
  const strength = recolor.strength ?? defaultStrength;
  const contrast = recolor.contrast ?? 1.0;

  const isEyedropperActive = Boolean(
    eyedropperTarget && activeEyedropper === eyedropperTarget,
  );

  // Live pixel-accurate shader preview canvas (used in Expanded Vault Modal)
  useEffect(() => {
    if (!showPreviewCanvas || !asset) return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    let alive = true;

    const draw = () => {
      if (!alive) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const raw = texturePool.get(asset.url);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (!raw) return;
      const processed = getProcessedTexture(raw, asset.url, recolor, asset, 512);
      const pw = processed instanceof HTMLImageElement ? processed.naturalWidth : processed.width;
      const ph = processed instanceof HTMLImageElement ? processed.naturalHeight : processed.height;
      const pad = 16;
      const scale = Math.min((canvas.width - pad * 2) / Math.max(1, pw), (canvas.height - pad * 2) / Math.max(1, ph));
      const dw = pw * scale;
      const dh = ph * scale;
      ctx.drawImage(processed, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    };

    const unsub = texturePool.onLoad(draw);
    draw();
    return () => {
      alive = false;
      unsub();
    };
  }, [showPreviewCanvas, asset, recolor]);

  const patch = (partial: Partial<RgbRecolor>, recordHistory = false) => {
    onChange({ ...recolor, ...partial }, recordHistory);
  };

  const applySwatch = (hex: string) => {
    const clean = hex.toUpperCase();
    if (effectiveMode === "rgb_channels") {
      patch({ enabled: true, channelR: clean, tintHex: clean }, true);
    } else {
      patch({ enabled: true, tintHex: clean }, true);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {showPreviewCanvas && asset && (
        <div
          className="dc-asset-thumb-box"
          style={{
            height: 184,
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
            position: "relative",
          }}
        >
          <canvas
            ref={previewCanvasRef}
            width={260}
            height={176}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
          {capability.native && (
            <span
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "2px 7px",
                borderRadius: 99,
                fontSize: 9.5,
                fontWeight: 700,
                background: "rgba(15, 19, 28, 0.88)",
                border: `1px solid ${capability.accent}77`,
                color: capability.accent,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    "conic-gradient(#EF4444, #F59E0B, #10B981, #3B82F6, #A855F7, #EF4444)",
                }}
              />
              {capability.badge}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          padding: compact ? 7 : 8,
          borderRadius: 7,
          background: "var(--bg-panel)",
          border: `1px solid ${recolor.enabled ? "rgba(229, 169, 60, 0.36)" : "var(--border-subtle)"}`,
        }}
      >
        {/* Header Row: Title + Capability Badge + Enable Switch */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            marginBottom: recolor.enabled ? 7 : 0,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background:
                    "conic-gradient(#EF4444, #F59E0B, #10B981, #3B82F6, #A855F7, #EF4444)",
                }}
              />
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </span>
            </span>
            {asset && (
              <span
                style={{
                  fontSize: 9.5,
                  color: capability.native ? capability.accent : "var(--text-muted)",
                  fontWeight: capability.native ? 600 : 400,
                }}
              >
                {capability.badge}
              </span>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-label={title}
            aria-checked={recolor.enabled}
            className="dc-switch"
            onClick={() => patch({ enabled: !recolor.enabled }, true)}
          />
        </div>

        {recolor.enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {/* Shader Mode Pills */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 3 }}>
              {MODE_OPTIONS.map((opt) => {
                const active = currentMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    title={opt.tip}
                    onClick={() =>
                      patch(
                        {
                          enabled: true,
                          mode: opt.id,
                          strength:
                            opt.id === "universal"
                              ? Math.min(strength, 0.72)
                              : opt.id !== "auto"
                                ? 1.0
                                : recolor.strength,
                        },
                        true,
                      )
                    }
                    style={{
                      height: 22,
                      padding: "0 2px",
                      borderRadius: 4,
                      border: `1px solid ${active ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                      background: active ? "var(--accent-gold-soft)" : "var(--bg-surface)",
                      color: active ? "var(--accent-gold)" : "var(--text-secondary)",
                      fontSize: 9.5,
                      fontWeight: active ? 700 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Primary Color Picker OR 3-Channel RGB Pickers */}
            {effectiveMode === "rgb_channels" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 5 }}>
                {(
                  [
                    { key: "channelR", label: "R Primary" },
                    { key: "channelG", label: "G Trim" },
                    { key: "channelB", label: "B Accent" },
                  ] as const
                ).map((ch) => (
                  <label
                    key={ch.key}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      padding: "4px 4px",
                      borderRadius: 5,
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontSize: 9, color: "var(--text-secondary)", fontWeight: 600 }}>
                      {ch.label}
                    </span>
                    <input
                      type="color"
                      aria-label={ch.label}
                      value={recolor[ch.key]}
                      onChange={(e) => patch({ enabled: true, [ch.key]: e.target.value }, false)}
                      style={{ width: "100%", height: 22, border: "none", background: "transparent", cursor: "pointer" }}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="color"
                  aria-label="Custom Asset Color"
                  value={recolor.tintHex}
                  onChange={(e) => patch({ enabled: true, tintHex: e.target.value }, false)}
                  style={{
                    width: 34,
                    height: 26,
                    padding: 0,
                    border: "1px solid var(--border-strong)",
                    borderRadius: 5,
                    background: "transparent",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--text-primary)",
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 5,
                    padding: "4px 7px",
                    textTransform: "uppercase",
                  }}
                >
                  {recolor.tintHex}
                </span>
                {eyedropperTarget && (
                  <button
                    type="button"
                    className={`dc-mini-icon-btn ${isEyedropperActive ? "active" : ""}`}
                    title="Sample color directly from the map canvas"
                    aria-label="Sample color from map"
                    style={
                      isEyedropperActive
                        ? {
                            borderColor: "#22D3EE",
                            color: "#22D3EE",
                            background: "rgba(34,211,238,0.16)",
                          }
                        : undefined
                    }
                    onClick={() => {
                      const next = isEyedropperActive ? null : eyedropperTarget;
                      st.setEyedropperTarget(next);
                      if (next) {
                        st.pushToast("Click anywhere on the map to sample a color");
                      }
                    }}
                  >
                    <Pipette size={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="dc-mini-icon-btn"
                  title="Save current color to My Map Palette"
                  aria-label="Save color swatch"
                  onClick={() => {
                    st.addCustomSwatch(recolor.tintHex);
                    st.pushToast(`Saved ${recolor.tintHex.toUpperCase()} to palette`, "success");
                  }}
                >
                  <Plus size={13} />
                </button>
                <button
                  type="button"
                  className="dc-mini-icon-btn"
                  title="Reset color settings"
                  aria-label="Reset color settings"
                  onClick={() =>
                    onChange({ ...DEFAULT_RECOLOR, enabled: true, mode: "auto" }, true)
                  }
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            )}

            {/* Curated TTRPG Palette Swatches */}
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                TTRPG Swatches
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 5 }}>
                {TTRPG_PALETTE_SWATCHES.map((sw) => {
                  const active =
                    (effectiveMode === "rgb_channels" ? recolor.channelR : recolor.tintHex)
                      .toUpperCase() === sw.hex.toUpperCase();
                  return (
                    <button
                      key={sw.hex}
                      type="button"
                      title={`${sw.label} (${sw.hex})`}
                      aria-label={sw.label}
                      onClick={() => applySwatch(sw.hex)}
                      style={{
                        height: 20,
                        borderRadius: 4,
                        background: sw.hex,
                        border: active
                          ? "2px solid #FFFFFF"
                          : "1px solid rgba(255,255,255,0.18)",
                        boxShadow: active ? "0 0 0 1px var(--accent-gold)" : "none",
                        cursor: "pointer",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Saved Custom Map Palette */}
            {customSwatches.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 4,
                  }}
                >
                  Saved Palette (right-click to remove)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {customSwatches.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      title={`Apply ${hex} · Right-click to remove`}
                      onClick={() => applySwatch(hex)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        st.removeCustomSwatch(hex);
                      }}
                      style={{
                        width: 20,
                        height: 18,
                        borderRadius: 4,
                        background: hex,
                        border:
                          recolor.tintHex.toUpperCase() === hex.toUpperCase()
                            ? "2px solid #FFFFFF"
                            : "1px solid rgba(255,255,255,0.22)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Blend Strength Slider */}
            <div className="dc-field-row" style={{ marginBottom: 0 }}>
              <span className="dc-field-label">
                Strength ({Math.round(strength * 100)}%)
              </span>
              <input
                type="range"
                className="dc-range"
                style={{ width: 118 }}
                min={0}
                max={1}
                step={0.04}
                value={strength}
                onChange={(e) =>
                  patch({ enabled: true, strength: Number(e.target.value) }, false)
                }
              />
            </div>

            {/* Collapsible Fine Studio Grade (Hue / Sat / Brightness / Contrast) */}
            <div>
              <button
                type="button"
                onClick={() => setGradeOpen((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  width: "100%",
                  padding: "3px 0",
                  border: "none",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {gradeOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Sparkles size={11} style={{ color: "var(--accent-gold)" }} />
                <span>Fine Grade (Hue / Sat / Bright)</span>
              </button>
              {gradeOpen && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    marginTop: 5,
                    paddingTop: 5,
                    borderTop: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="dc-field-row" style={{ marginBottom: 0 }}>
                    <span className="dc-field-label">Hue ({recolor.hueShift}°)</span>
                    <input
                      type="range"
                      className="dc-range"
                      style={{ width: 112 }}
                      min={-180}
                      max={180}
                      value={recolor.hueShift}
                      onChange={(e) =>
                        patch({ enabled: true, hueShift: Number(e.target.value) }, false)
                      }
                    />
                  </div>
                  <div className="dc-field-row" style={{ marginBottom: 0 }}>
                    <span className="dc-field-label">
                      Sat ({Math.round(recolor.saturation * 100)}%)
                    </span>
                    <input
                      type="range"
                      className="dc-range"
                      style={{ width: 112 }}
                      min={0}
                      max={2}
                      step={0.05}
                      value={recolor.saturation}
                      onChange={(e) =>
                        patch({ enabled: true, saturation: Number(e.target.value) }, false)
                      }
                    />
                  </div>
                  <div className="dc-field-row" style={{ marginBottom: 0 }}>
                    <span className="dc-field-label">
                      Bright ({Math.round(recolor.brightness * 100)}%)
                    </span>
                    <input
                      type="range"
                      className="dc-range"
                      style={{ width: 112 }}
                      min={0.35}
                      max={1.75}
                      step={0.05}
                      value={recolor.brightness}
                      onChange={(e) =>
                        patch({ enabled: true, brightness: Number(e.target.value) }, false)
                      }
                    />
                  </div>
                  <div className="dc-field-row" style={{ marginBottom: 0 }}>
                    <span className="dc-field-label">
                      Contrast ({Math.round(contrast * 100)}%)
                    </span>
                    <input
                      type="range"
                      className="dc-range"
                      style={{ width: 112 }}
                      min={0.6}
                      max={1.5}
                      step={0.05}
                      value={contrast}
                      onChange={(e) =>
                        patch({ enabled: true, contrast: Number(e.target.value) }, false)
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Style Copy / Paste / Batch Apply Row (for Selected Props) */}
            {(onCopyStyle || onPasteStyle || onApplyToAllMatching) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingTop: 4, borderTop: "1px solid var(--border-subtle)" }}>
                {onCopyStyle && (
                  <button
                    type="button"
                    className="dc-btn"
                    style={{ flex: 1, height: 24, fontSize: 10.5 }}
                    onClick={onCopyStyle}
                  >
                    <Copy size={11} />
                    <span>Copy</span>
                  </button>
                )}
                {onPasteStyle && (
                  <button
                    type="button"
                    className="dc-btn"
                    style={{ flex: 1, height: 24, fontSize: 10.5 }}
                    disabled={!hasCopiedStyle}
                    onClick={onPasteStyle}
                  >
                    <span>Paste</span>
                  </button>
                )}
                {onApplyToAllMatching && (
                  <button
                    type="button"
                    className="dc-btn dc-btn-gold"
                    style={{ width: "100%", height: 25, fontSize: 10.5 }}
                    title="Apply this color style to every matching prop on the current layer"
                    onClick={onApplyToAllMatching}
                  >
                    <Layers size={11} />
                    <span>Apply to All Matching Props</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

import React from "react";
import { Settings } from "lucide-react";
import { useDocumentStore } from "@/store/documentStore";
import { ModalDialog } from "@/ui/common/ModalDialog";
import { DEFAULT_PREFERENCES } from "@/types/map";

export const PreferencesModal: React.FC = () => {
  const open = useDocumentStore((s) => s.preferencesModalOpen);
  const prefs = useDocumentStore((s) => s.preferences);
  const st = useDocumentStore.getState();

  return (
    <ModalDialog
      open={open}
      onClose={() => st.setPreferencesModalOpen(false)}
      title="Studio Preferences & Performance Options"
      icon={<Settings size={17} style={{ color: "var(--accent-gold)" }} />}
      maxWidthPx={680}
      footer={
        <>
          <button
            type="button"
            className="dc-btn"
            onClick={() => {
              st.updatePreferences({ ...DEFAULT_PREFERENCES });
              st.pushToast("Restored default preferences");
            }}
          >
            Reset Defaults
          </button>
          <button
            type="button"
            className="dc-btn dc-btn-gold"
            onClick={() => st.setPreferencesModalOpen(false)}
          >
            Done
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-gold)", marginBottom: 10 }}>
            CANVAS &amp; TV DEFAULTS
          </div>
          <div className="dc-field-row">
            <span className="dc-field-label">Default Authoring PPI</span>
            <select
              className="dc-select"
              value={prefs.defaultPpi}
              onChange={(e) => st.updatePreferences({ defaultPpi: Number(e.target.value) })}
            >
              <option value={140}>140 PPI</option>
              <option value={256}>256 PPI (Recommended)</option>
              <option value={300}>300 PPI (Print)</option>
            </select>
          </div>
          <div className="dc-field-row">
            <span className="dc-field-label">Tabletop TV Diagonal</span>
            <select
              className="dc-select"
              value={prefs.defaultTvDiagonal}
              onChange={(e) =>
                st.updatePreferences({ defaultTvDiagonal: Number(e.target.value) })
              }
            >
              <option value={43}>43&quot; TV</option>
              <option value={50}>50&quot; TV</option>
              <option value={55}>55&quot; TV (48×27 @ 4K)</option>
              <option value={65}>65&quot; TV</option>
            </select>
          </div>
          <div className="dc-field-row">
            <span className="dc-field-label">Default Snap Mode</span>
            <select
              className="dc-select"
              value={prefs.snapMode}
              onChange={(e) =>
                st.setSnapMode(e.target.value as "grid" | "half" | "free")
              }
            >
              <option value="grid">Full Grid (1.0 sq)</option>
              <option value="half">Half Grid (0.5 sq)</option>
              <option value="free">Free Placement</option>
            </select>
          </div>
          <div className="dc-field-row">
            <span className="dc-field-label">Invert Wheel Zoom</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.invertZoom}
              className="dc-switch"
              onClick={() => st.updatePreferences({ invertZoom: !prefs.invertZoom })}
            />
          </div>
          <div className="dc-field-row" style={{ marginBottom: 0 }}>
            <span className="dc-field-label">Show Tool Hint Pill</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.showToolHints}
              className="dc-switch"
              onClick={() => st.updatePreferences({ showToolHints: !prefs.showToolHints })}
            />
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "var(--bg-panel)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-violet)", marginBottom: 10 }}>
            GPU ENGINE &amp; ASSET VAULT
          </div>
          <div className="dc-field-row">
            <span className="dc-field-label">VRAM Texture Cache ({prefs.vramBudgetMb} MB)</span>
            <input
              type="range"
              className="dc-range"
              style={{ width: 110 }}
              min={256}
              max={4096}
              step={256}
              value={prefs.vramBudgetMb}
              onChange={(e) => st.updatePreferences({ vramBudgetMb: Number(e.target.value) })}
            />
          </div>
          <div className="dc-field-row">
            <span className="dc-field-label">Raycast Shadow Quality</span>
            <select
              className="dc-select"
              value={prefs.shadowRayQuality}
              onChange={(e) =>
                st.updatePreferences({
                  shadowRayQuality: e.target.value as "standard" | "high" | "ultra",
                })
              }
            >
              <option value="standard">Standard (60fps Laptop)</option>
              <option value="high">High (Recommended)</option>
              <option value="ultra">Ultra (8K Mastering)</option>
            </select>
          </div>
          <div className="dc-field-row">
            <span className="dc-field-label">Tiled Export Chunk Size</span>
            <select
              className="dc-select"
              value={prefs.exportTileSize}
              onChange={(e) =>
                st.updatePreferences({
                  exportTileSize: Number(e.target.value) as 1024 | 2048 | 4096,
                })
              }
            >
              <option value={1024}>1024 px (Ultra-Low RAM)</option>
              <option value={2048}>2048 px (Balanced)</option>
              <option value={4096}>4096 px (Fast GPU)</option>
            </select>
          </div>
          <div className="dc-field-row">
            <span className="dc-field-label">Live Folder Watching</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs.watchFoldersLive}
              className="dc-switch"
              onClick={() =>
                st.updatePreferences({ watchFoldersLive: !prefs.watchFoldersLive })
              }
            />
          </div>
          <div className="dc-field-row" style={{ marginBottom: 0 }}>
            <span className="dc-field-label">Autosave Interval</span>
            <select
              className="dc-select"
              value={prefs.autosaveMinutes}
              onChange={(e) =>
                st.updatePreferences({ autosaveMinutes: Number(e.target.value) })
              }
            >
              <option value={1}>Every 1 min</option>
              <option value={3}>Every 3 mins</option>
              <option value={5}>Every 5 mins</option>
              <option value={0}>Off</option>
            </select>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
};

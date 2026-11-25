import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileUp,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import type { AssetSwapEntry, AssetSwapPolicy } from "@/engine/assetSwapEngine";
import { decodeDraftMapBytes, type DecodedDraftMap } from "@/engine/draftMapDecoder";
import { importDungeondraftMapData } from "@/engine/dungeondraftMapImport";
import {
  importWonderdraftMapData,
  type ExternalImportSummary,
} from "@/engine/wonderdraftMapImport";
import { useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import { ModalDialog } from "@/ui/common/ModalDialog";
import type { DcMapDocument, VaultAsset } from "@/types/map";

const CONFIDENCE_BADGE: Record<
  AssetSwapEntry["confidence"],
  { label: string; bg: string; color: string }
> = {
  exact: { label: "Exact", bg: "rgba(16, 185, 129, 0.18)", color: "#34D399" },
  high: { label: "Smart CC0", bg: "rgba(56, 189, 248, 0.16)", color: "#38BDF8" },
  medium: { label: "Suggested", bg: "rgba(229, 169, 60, 0.18)", color: "#F5C35A" },
  fallback: { label: "Fallback", bg: "rgba(244, 114, 182, 0.18)", color: "#F472B6" },
};

export const MapImportModal: React.FC = () => {
  const open = useDocumentStore((s) => s.mapImportModalOpen);
  const pendingFile = useDocumentStore((s) => s.pendingImportFile);
  const vaultAssets = useVaultStore((s) => s.assets);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [decoded, setDecoded] = useState<DecodedDraftMap | null>(null);

  // Import configuration
  const [policy, setPolicy] = useState<AssetSwapPolicy>("prefer_installed");
  const [spreadVariants, setSpreadVariants] = useState(true);
  const [importSymbols, setImportSymbols] = useState(true);
  const [importLabels, setImportLabels] = useState(true);
  const [importPaths, setImportPaths] = useState(true);
  const [importGroundPaint, setImportGroundPaint] = useState(true);
  const [importWalls, setImportWalls] = useState(true);
  const [importLights, setImportLights] = useState(true);
  const [importTerrain, setImportTerrain] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  // UI filters & inline asset swap picker
  const [rowSearch, setRowSearch] = useState("");
  const [visibleRows, setVisibleRows] = useState(50);
  const [editingRef, setEditingRef] = useState<AssetSwapEntry | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");

  // Decode pending file asynchronously when it changes
  useEffect(() => {
    if (!open || !pendingFile) {
      setDecoded(null);
      setDecodeError(null);
      setDecoding(false);
      return;
    }
    let cancelled = false;
    setDecoding(true);
    setDecodeError(null);
    setDecoded(null);
    setOverrides({});
    setEditingRef(null);
    setRowSearch("");
    setVisibleRows(50);

    // Yield one frame so the modal & spinner paint immediately before heavy FastLZ decode
    const timer = window.setTimeout(async () => {
      try {
        const res = await decodeDraftMapBytes(pendingFile.fileName, pendingFile.bytes);
        if (cancelled) return;
        if (res.kind === "dcmap") {
          const ok = useDocumentStore
            .getState()
            .loadDocumentJson(JSON.stringify(res.data));
          if (ok) {
            useDocumentStore.getState().closeExternalMapImport();
            return;
          }
        }
        setDecoded(res);
      } catch (err) {
        if (!cancelled) {
          setDecodeError((err as Error).message || "Failed to decode map file.");
        }
      } finally {
        if (!cancelled) setDecoding(false);
      }
    }, 24);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, pendingFile]);

  // Build live converted document & swap summary whenever decoded data or swap policy changes
  const conversion = useMemo<{
    doc: DcMapDocument;
    summary: ExternalImportSummary;
  } | null>(() => {
    if (!decoded || !pendingFile) return null;
    if (decoded.kind === "wonderdraft") {
      return importWonderdraftMapData(decoded.data, vaultAssets, {
        fileName: pendingFile.fileName,
        policy,
        spreadVariants,
        importSymbols,
        importLabels,
        importPaths,
        importGroundPaint,
        overrides,
      });
    }
    if (decoded.kind === "dungeondraft") {
      return importDungeondraftMapData(decoded.data, vaultAssets, {
        fileName: pendingFile.fileName,
        policy,
        importObjects: importSymbols,
        importWalls,
        importLights,
        importTerrain,
        overrides,
      });
    }
    return null;
  }, [
    decoded,
    pendingFile,
    vaultAssets,
    policy,
    spreadVariants,
    importSymbols,
    importLabels,
    importPaths,
    importGroundPaint,
    importWalls,
    importLights,
    importTerrain,
    overrides,
  ]);

  const filteredSwapRows = useMemo(() => {
    if (!conversion) return [];
    const q = rowSearch.trim().toLowerCase();
    if (!q) return conversion.summary.swapEntries;
    return conversion.summary.swapEntries.filter(
      (r) =>
        r.sourceLabel.toLowerCase().includes(q) ||
        r.sourceRef.toLowerCase().includes(q) ||
        r.targetDisplayName.toLowerCase().includes(q),
    );
  }, [conversion, rowSearch]);

  const pickerCandidates = useMemo<VaultAsset[]>(() => {
    if (!editingRef) return [];
    const basePool =
      policy === "cc0_only"
        ? vaultAssets.filter((a) => a.sourceKind === "dcpack")
        : vaultAssets;
    const catPool = basePool.filter((a) => {
      if (editingRef.isRoof) {
        return a.category === "terrain" && a.id.toLowerCase().includes("roof_");
      }
      if (a.category !== editingRef.expectedCategory) return false;
      if (
        editingRef.expectedCategory === "symbol" &&
        editingRef.expectedWorldGroup &&
        !pickerSearch.trim()
      ) {
        return a.worldGroup === editingRef.expectedWorldGroup;
      }
      return true;
    });
    const effective = catPool.length > 0 ? catPool : basePool;
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return effective.slice(0, 48);
    return effective
      .filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)) ||
          a.id.toLowerCase().includes(q),
      )
      .slice(0, 48);
  }, [editingRef, policy, vaultAssets, pickerSearch]);

  const handleClose = () => {
    useDocumentStore.getState().closeExternalMapImport();
  };

  const handlePickAnotherFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = new Uint8Array(await file.arrayBuffer());
    useDocumentStore.getState().openExternalMapImport(file.name, buf);
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    if (!conversion) return;
    useDocumentStore
      .getState()
      .importExternalMapDocument(conversion.doc, conversion.summary);
    if (conversion.doc.mode === "world") {
      useVaultStore.getState().setActiveCategory("symbol");
    }
  };

  const isWorld = decoded?.kind === "wonderdraft";
  const summary = conversion?.summary ?? null;

  return (
    <ModalDialog
      open={open}
      onClose={handleClose}
      title="Import Wonderdraft / Dungeondraft Map & Swap Assets"
      icon={
        isWorld ? (
          <Globe size={17} style={{ color: "var(--accent-gold)" }} />
        ) : (
          <Swords size={17} style={{ color: "var(--accent-gold)" }} />
        )
      }
      maxWidthPx={980}
      footer={
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".wonderdraft_map,.dungeondraft_map,.dcmap,.json"
            style={{ display: "none" }}
            onChange={(e) => void handlePickAnotherFile(e)}
          />
          <button
            type="button"
            className="dc-btn dc-btn-ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp size={13} />
            <span>Choose Another File…</span>
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="dc-btn" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="dc-btn dc-btn-gold"
            disabled={!conversion || decoding}
            onClick={handleConfirmImport}
          >
            <CheckCircle2 size={14} />
            <span>
              {isWorld
                ? "Import World Atlas into New Tab"
                : "Import Battlemap into New Tab"}
            </span>
          </button>
        </>
      }
    >
      {/* Empty / Choose-File Drop State */}
      {!pendingFile && (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            border: "1px dashed rgba(229, 169, 60, 0.35)",
            borderRadius: 12,
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <FileUp size={34} style={{ color: "var(--accent-gold)", marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            Open a Wonderdraft (.wonderdraft_map) or Dungeondraft (.dungeondraft_map) Save
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>
            Extracts exact landmasses, ground paint, place names, roads, walls, doors, lights, and
            swaps external symbols cleanly into our 8,784+ CC0 Asset Vault.
          </div>
          <button
            type="button"
            className="dc-btn dc-btn-gold"
            onClick={() => fileInputRef.current?.click()}
          >
            Browse Map File…
          </button>
        </div>
      )}

      {/* Decoding Spinner */}
      {pendingFile && decoding && (
        <div style={{ padding: "48px 24px", textAlign: "center" }}>
          <Loader2
            size={30}
            style={{ color: "var(--accent-gold)", animation: "spin 1s linear infinite" }}
          />
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12 }}>
            Decompressing & Parsing {pendingFile.fileName}…
          </div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>
            Reading Godot GCPF blocks, heightmaps, painted ground layers, labels, paths & symbols locally.
          </div>
        </div>
      )}

      {/* Error State */}
      {decodeError && (
        <div
          style={{
            padding: 16,
            borderRadius: 10,
            border: "1px solid rgba(239, 68, 68, 0.45)",
            background: "rgba(239, 68, 68, 0.1)",
            color: "#FCA5A5",
            fontSize: 12.5,
          }}
        >
          <strong>Could not import {pendingFile?.fileName}:</strong> {decodeError}
        </div>
      )}

      {/* Ready Summary + Policy + Interactive Bulk Asset-Swap Table */}
      {summary && !decoding && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Top Metrics Banner */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 10,
              background: "rgba(229, 169, 60, 0.08)",
              border: "1px solid rgba(229, 169, 60, 0.25)",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  className="dc-badge"
                  style={{
                    background: "rgba(229, 169, 60, 0.2)",
                    color: "var(--accent-gold)",
                    fontWeight: 700,
                  }}
                >
                  {summary.sourceFormat === "wonderdraft"
                    ? "WONDERDRAFT WORLD ATLAS"
                    : "DUNGEONDRAFT BATTLEMAP"}
                </span>
                <strong style={{ fontSize: 13.5 }}>{summary.sourceFileName}</strong>
              </div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 3 }}>
                Source {summary.originalWidthPx}×{summary.originalHeightPx} px → Dice Chaos{" "}
                {summary.targetWidthCells}×{summary.targetHeightCells} cells
                {summary.sourceFormat === "dungeondraft" &&
                  ` · ${summary.levelCount} Floor${summary.levelCount === 1 ? "" : "s"}`}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {summary.sourceFormat === "wonderdraft" ? (
                <>
                  <span className="dc-badge">{summary.counts.symbolsOrObjects} Symbols</span>
                  <span className="dc-badge">{summary.counts.labels} Labels</span>
                  <span className="dc-badge">{summary.counts.trailsOrPaths} Trails</span>
                  {summary.counts.hasHeightmap && (
                    <span className="dc-badge" style={{ color: "#34D399" }}>
                      Coastline & Freshwater Mask
                    </span>
                  )}
                  {summary.counts.hasGroundPaint && (
                    <span className="dc-badge" style={{ color: "#38BDF8" }}>
                      Painted Ground Biomes
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="dc-badge">{summary.counts.walls} Walls</span>
                  <span className="dc-badge">{summary.counts.portals} Portals</span>
                  <span className="dc-badge">{summary.counts.symbolsOrObjects} Props</span>
                  <span className="dc-badge">{summary.counts.trailsOrPaths} Paths</span>
                  <span className="dc-badge">{summary.counts.lights} Lights</span>
                  {summary.counts.waterRegions > 0 && (
                    <span className="dc-badge">{summary.counts.waterRegions} Water</span>
                  )}
                  {summary.counts.roofs > 0 && (
                    <span className="dc-badge">{summary.counts.roofs} Roofs</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Swap Policy & Element Toggles */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 9,
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                Asset Resolution:
              </span>
              <button
                type="button"
                className={`dc-chip ${policy === "prefer_installed" ? "active" : ""}`}
                onClick={() => setPolicy("prefer_installed")}
              >
                <Layers size={11} />
                <span>Installed Packs → CC0 Fallback</span>
              </button>
              <button
                type="button"
                className={`dc-chip ${policy === "cc0_only" ? "active" : ""}`}
                onClick={() => setPolicy("cc0_only")}
              >
                <Sparkles size={11} />
                <span>100% Clean-Room CC0 Swap</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 11.5 }}>
              {isWorld ? (
                <>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={spreadVariants}
                      onChange={(e) => setSpreadVariants(e.target.checked)}
                    />
                    <span>Spread Forest/Mountain Variants</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={importGroundPaint}
                      onChange={(e) => setImportGroundPaint(e.target.checked)}
                    />
                    <span>Ground Paint</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={importLabels}
                      onChange={(e) => setImportLabels(e.target.checked)}
                    />
                    <span>Labels</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={importPaths}
                      onChange={(e) => setImportPaths(e.target.checked)}
                    />
                    <span>Roads</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={importSymbols}
                      onChange={(e) => setImportSymbols(e.target.checked)}
                    />
                    <span>Symbols</span>
                  </label>
                </>
              ) : (
                <>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={importTerrain}
                      onChange={(e) => setImportTerrain(e.target.checked)}
                    />
                    <span>Terrain</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={importWalls}
                      onChange={(e) => setImportWalls(e.target.checked)}
                    />
                    <span>Walls & Portals</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={importSymbols}
                      onChange={(e) => setImportSymbols(e.target.checked)}
                    />
                    <span>Props</span>
                  </label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={importLights}
                      onChange={(e) => setImportLights(e.target.checked)}
                    />
                    <span>Lights</span>
                  </label>
                </>
              )}
            </div>
          </div>

          {/* Interactive Bulk Asset-Swap Table */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: editingRef ? "1fr 300px" : "1fr",
              gap: 10,
            }}
          >
            <div
              style={{
                border: "1px solid var(--border-subtle)",
                borderRadius: 9,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "8px 10px",
                  background: "rgba(255,255,255,0.03)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                  <strong>Asset Swap Mapping ({summary.swapEntries.length} unique)</strong>
                  <span style={{ color: "#34D399" }}>Exact: {summary.matchedExactCount}</span>
                  <span style={{ color: "#38BDF8" }}>Smart CC0: {summary.matchedCc0Count}</span>
                  {summary.fallbackCount > 0 && (
                    <span style={{ color: "#F472B6" }}>Fallback: {summary.fallbackCount}</span>
                  )}
                </div>

                <div style={{ position: "relative", width: 210 }}>
                  <Search
                    size={12}
                    style={{
                      position: "absolute",
                      left: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    type="text"
                    className="dc-input"
                    style={{ paddingLeft: 26, height: 26, fontSize: 11, width: "100%" }}
                    placeholder="Filter original or CC0 asset…"
                    value={rowSearch}
                    onChange={(e) => setRowSearch(e.target.value)}
                  />
                </div>
              </div>

              <div className="dc-scroll" style={{ maxHeight: 330, overflowY: "auto" }}>
                {filteredSwapRows.slice(0, visibleRows).map((row) => {
                  const badge = CONFIDENCE_BADGE[row.confidence];
                  const isEditing = editingRef?.sourceRef === row.sourceRef;
                  const isCustom = Boolean(overrides[row.sourceRef]);
                  return (
                    <div
                      key={row.sourceRef}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 18px 1fr auto",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 10px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: isEditing ? "rgba(229, 169, 60, 0.1)" : "transparent",
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={row.sourceRef}
                        >
                          {row.sourceLabel}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {row.count}× on map · {row.expectedWorldGroup ?? row.expectedCategory}
                        </div>
                      </div>

                      <ArrowRight size={13} style={{ color: "var(--text-muted)" }} />

                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        {row.targetThumbUrl && (
                          <img
                            src={row.targetThumbUrl}
                            alt=""
                            loading="lazy"
                            style={{
                              width: 28,
                              height: 28,
                              objectFit: "contain",
                              borderRadius: 4,
                              background: "rgba(0,0,0,0.28)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={row.targetDisplayName}
                          >
                            {row.targetDisplayName}
                          </div>
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: 9.5,
                              padding: "0px 5px",
                              borderRadius: 4,
                              background: isCustom ? "rgba(167, 139, 250, 0.22)" : badge.bg,
                              color: isCustom ? "#C4B5FD" : badge.color,
                              fontWeight: 600,
                            }}
                          >
                            {isCustom ? "Custom Swap" : badge.label}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={`dc-btn dc-btn-ghost ${isEditing ? "active" : ""}`}
                        style={{ height: 24, padding: "0 8px", fontSize: 10.5 }}
                        onClick={() => {
                          setEditingRef(isEditing ? null : row);
                          setPickerSearch("");
                        }}
                      >
                        <RefreshCw size={11} />
                        <span>Swap</span>
                      </button>
                    </div>
                  );
                })}
                {filteredSwapRows.length > visibleRows && (
                  <div style={{ padding: 8, textAlign: "center" }}>
                    <button
                      type="button"
                      className="dc-btn dc-btn-ghost"
                      style={{ height: 26, fontSize: 11 }}
                      onClick={() => setVisibleRows((v) => v + 60)}
                    >
                      Show more ({filteredSwapRows.length - visibleRows} remaining)
                    </button>
                  </div>
                )}
                {filteredSwapRows.length === 0 && (
                  <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
                    No asset mappings match your filter.
                  </div>
                )}
              </div>
            </div>

            {/* Inline Vault Asset Picker for Bulk Swapping Any Row */}
            {editingRef && (
              <div
                style={{
                  border: "1px solid rgba(229, 169, 60, 0.4)",
                  borderRadius: 9,
                  background: "rgba(18, 21, 30, 0.85)",
                  display: "flex",
                  flexDirection: "column",
                  maxHeight: 376,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "7px 10px",
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: 11,
                  }}
                >
                  <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Replace {editingRef.count}× {editingRef.sourceLabel}
                  </strong>
                  <button
                    type="button"
                    className="dc-mini-icon-btn"
                    aria-label="Close asset picker"
                    onClick={() => setEditingRef(null)}
                  >
                    <X size={12} />
                  </button>
                </div>
                <div style={{ padding: "6px 8px", borderBottom: "1px solid var(--border-subtle)" }}>
                  <input
                    type="text"
                    className="dc-input"
                    style={{ width: "100%", height: 26, fontSize: 11 }}
                    placeholder="Search CC0 Vault assets…"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div
                  className="dc-scroll"
                  style={{
                    padding: 8,
                    overflowY: "auto",
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 6,
                  }}
                >
                  {pickerCandidates.map((cand) => {
                    const active = editingRef.targetAssetId === cand.id;
                    return (
                      <button
                        key={cand.id}
                        type="button"
                        title={cand.displayName}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 3,
                          padding: 5,
                          borderRadius: 6,
                          border: active
                            ? "1px solid var(--accent-gold)"
                            : "1px solid rgba(255,255,255,0.08)",
                          background: active
                            ? "rgba(229, 169, 60, 0.16)"
                            : "rgba(255,255,255,0.03)",
                          color: "var(--text-primary)",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setOverrides((prev) => ({
                            ...prev,
                            [editingRef.sourceRef]: cand.id,
                          }));
                          setEditingRef((cur) =>
                            cur
                              ? {
                                  ...cur,
                                  targetAssetId: cand.id,
                                  targetDisplayName: cand.displayName,
                                  targetThumbUrl: cand.thumbUrl,
                                }
                              : null,
                          );
                        }}
                      >
                        <img
                          src={cand.thumbUrl}
                          alt=""
                          loading="lazy"
                          style={{ width: 42, height: 42, objectFit: "contain" }}
                        />
                        <span
                          style={{
                            fontSize: 9.5,
                            width: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            textAlign: "center",
                          }}
                        >
                          {cand.displayName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalDialog>
  );
};

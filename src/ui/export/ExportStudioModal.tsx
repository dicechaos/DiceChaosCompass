import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Download,
  FileArchive,
  Folder,
  FolderOutput,
  FolderTree,
  Grid,
  Image as ImageIcon,
  Layers,
  Monitor,
  Printer,
} from "lucide-react";
import {
  pickExportDirectory,
  supportsNativeDirectoryPicker,
} from "@/engine/fileSaveService";
import { computeTvCalibration } from "@/engine/geometry";
import {
  buildExportFolderTreePreview,
  computeExportDimensions,
  createLevelSnapshotDoc,
  isTransparentFloorLevel,
  resolveBatchJobs,
  runBatchExport,
  sanitizePathSegment,
  sortLevelsBottomUp,
  type ExportFloorScope,
  type ExportFolderStructure,
  type ExportJobConfig,
  type ExportOutputMode,
  type ExportPresetId,
  type ExportProgress,
} from "@/engine/exportEngine";
import {
  collectAllDocAssetUrls,
  renderMapScene,
  texturePool,
} from "@/engine/sceneRenderer";
import { sortLevelsTopDown, useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import { DiceLogo } from "@/ui/common/DiceLogo";
import { ModalDialog } from "@/ui/common/ModalDialog";

const TV_PRESETS = [
  { label: '43" 4K UHD (3840×2160)', diag: 43, w: 3840, h: 2160 },
  { label: '50" 4K UHD (3840×2160)', diag: 50, w: 3840, h: 2160 },
  { label: '55" 4K UHD (3840×2160)', diag: 55, w: 3840, h: 2160 },
  { label: '65" 4K UHD (3840×2160)', diag: 65, w: 3840, h: 2160 },
  { label: '55" 8K UHD (7680×4320)', diag: 55, w: 7680, h: 4320 },
];

const EXPORT_ORG_STORAGE_KEY = "dice-chaos-compass-export-org-v1";
const LEGACY_EXPORT_ORG_STORAGE_KEY = "dice-chaos-maps-export-org-v1";

function loadSavedExportOrg(): {
  outputMode: ExportOutputMode;
  folderStructure: ExportFolderStructure;
  includeMapRootFolder: boolean;
} {
  const defaultMode: ExportOutputMode = supportsNativeDirectoryPicker() ? "folder" : "zip";
  try {
    const raw =
      localStorage.getItem(EXPORT_ORG_STORAGE_KEY) ??
      localStorage.getItem(LEGACY_EXPORT_ORG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const outputMode: ExportOutputMode =
        parsed.outputMode === "folder" ||
        parsed.outputMode === "zip" ||
        parsed.outputMode === "flat"
          ? parsed.outputMode
          : defaultMode;
      const folderStructure: ExportFolderStructure =
        parsed.folderStructure === "by_role" ||
        parsed.folderStructure === "by_file_type" ||
        parsed.folderStructure === "by_floor" ||
        parsed.folderStructure === "flat_in_map"
          ? parsed.folderStructure
          : "by_role";
      return {
        outputMode,
        folderStructure,
        includeMapRootFolder: parsed.includeMapRootFolder !== false,
      };
    }
  } catch {
    // Ignore storage read errors
  }
  return {
    outputMode: defaultMode,
    folderStructure: "by_role",
    includeMapRootFolder: true,
  };
}

export const ExportStudioModal: React.FC = () => {
  const open = useDocumentStore((s) => s.exportModalOpen);
  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0],
  );
  const preferences = useDocumentStore((s) => s.preferences);
  const assetLookup = useVaultStore((s) => s.assetById);
  const idPrefix = useId();
  const canPickDirectory = supportsNativeDirectoryPicker();

  const [config, setConfig] = useState<ExportJobConfig>(() => {
    const savedOrg = loadSavedExportOrg();
    return {
      preset: "tv",
      tvDiagonalInches: preferences.defaultTvDiagonal,
      tvResWidth: preferences.defaultTvWidth,
      tvResHeight: preferences.defaultTvHeight,
      imagePpi: 256,
      upscaleFactor: 1,
      sharpenUpscale: true,
      imageFormat: "png",
      pdfPaper: "letter",
      includeGrid: true,
      variantPlayer: true,
      variantDm: true,
      variantDayNight: true,
      variantUvtt: true,
      variantRoofs: false,
      tileSizePx: preferences.exportTileSize,
      floorScope: "active",
      selectedLevelIds: doc.levels.map((lv) => lv.id),
      outputMode: savedOrg.outputMode,
      folderStructure: savedOrg.folderStructure,
      includeMapRootFolder: savedOrg.includeMapRootFolder,
    };
  });

  // Persist user's preferred output packaging & folder organization across sessions
  useEffect(() => {
    try {
      localStorage.setItem(
        EXPORT_ORG_STORAGE_KEY,
        JSON.stringify({
          outputMode: config.outputMode ?? "folder",
          folderStructure: config.folderStructure ?? "by_role",
          includeMapRootFolder: config.includeMapRootFolder !== false,
        }),
      );
    } catch {
      // Ignore storage write errors
    }
  }, [config.outputMode, config.folderStructure, config.includeMapRootFolder]);

  const [previewLevelId, setPreviewLevelId] = useState<string>(doc.activeLevelId);
  const [splitPct, setSplitPct] = useState(50);
  const [treeOpen, setTreeOpen] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const levelsTopDown = useMemo(() => sortLevelsTopDown(doc.levels), [doc.levels]);
  const levelsBottomUp = useMemo(() => sortLevelsBottomUp(doc.levels), [doc.levels]);

  // Keep selectedLevelIds and previewLevelId synchronized when opening or switching documents
  useEffect(() => {
    if (!open) return;
    setPreviewLevelId(doc.activeLevelId);
    setConfig((prev) => {
      const validIds = new Set(doc.levels.map((l) => l.id));
      const kept = (prev.selectedLevelIds ?? []).filter((id) => validIds.has(id));
      return {
        ...prev,
        selectedLevelIds: kept.length > 0 ? kept : doc.levels.map((l) => l.id),
      };
    });
  }, [open, doc.id, doc.activeLevelId, doc.levels]);

  const floorScope: ExportFloorScope = config.floorScope ?? "active";
  const selectedLevelSet = useMemo(
    () => new Set(config.selectedLevelIds ?? doc.levels.map((l) => l.id)),
    [config.selectedLevelIds, doc.levels],
  );
  const activePreviewLevel =
    doc.levels.find((l) => l.id === (floorScope === "active" ? doc.activeLevelId : previewLevelId)) ??
    doc.levels.find((l) => l.id === doc.activeLevelId) ??
    doc.levels[0];
  const previewIsTransparent =
    floorScope === "all_separate" && isTransparentFloorLevel(activePreviewLevel);

  const playerPreviewRef = useRef<HTMLCanvasElement>(null);
  const dmPreviewRef = useRef<HTMLCanvasElement>(null);

  const tvCal = computeTvCalibration(
    config.tvDiagonalInches,
    config.tvResWidth,
    config.tvResHeight,
  );

  const effectivePpi =
    config.preset === "tv"
      ? tvCal.exactPpi
      : config.preset === "pdf"
        ? 150
        : config.imagePpi;

  const dims = computeExportDimensions(
    doc.canvas.widthCells,
    doc.canvas.heightCells,
    effectivePpi,
    config.preset === "pdf" ? 1 : config.upscaleFactor,
  );
  const outW = dims.width;
  const outH = dims.height;
  const tileCols = Math.max(1, Math.ceil(outW / config.tileSizePx));
  const tileRows = Math.max(1, Math.ceil(outH / config.tileSizePx));
  const variantCount = resolveBatchJobs(doc, config).length;
  const selectedFloorCount =
    floorScope === "active"
      ? 1
      : levelsBottomUp.filter((lv) => selectedLevelSet.has(lv.id)).length;
  const outputMode: ExportOutputMode = config.outputMode ?? "flat";
  const folderStructure: ExportFolderStructure = config.folderStructure ?? "by_role";
  const includeMapRoot = config.includeMapRootFolder !== false;
  const safeMapRootName = sanitizePathSegment(doc.meta.title);
  const treePreview = useMemo(
    () => buildExportFolderTreePreview(doc, config),
    [doc, config],
  );

  // Render live Player vs DM/VTT split comparison previews whenever modal, floor mode, or preview floor changes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const renderDoc =
      floorScope === "all_stacked" && activePreviewLevel
        ? createLevelSnapshotDoc(doc, activePreviewLevel.id)
        : doc;
    const isolatedId =
      floorScope === "all_separate" && activePreviewLevel ? activePreviewLevel.id : undefined;

    texturePool.ensureLoaded(collectAllDocAssetUrls(renderDoc, assetLookup)).then(() => {
      if (cancelled) return;
      const previewW = 640;
      const ppc = previewW / renderDoc.canvas.widthCells;
      const previewH = Math.round(renderDoc.canvas.heightCells * ppc);

      for (const [ref, dm, vtt] of [
        [playerPreviewRef, false, false],
        [dmPreviewRef, true, true],
      ] as const) {
        const c = ref.current;
        if (!c) continue;
        c.width = previewW;
        c.height = previewH;
        const ctx = c.getContext("2d");
        if (!ctx) continue;
        renderMapScene(ctx, renderDoc, assetLookup, {
          pixelsPerCell: ppc,
          dmView: dm,
          showVttOverlay: vtt,
          showScatterOutlines: false,
          showGrid: previewIsTransparent ? false : config.includeGrid,
          isolatedLevelId: isolatedId,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    open,
    doc,
    assetLookup,
    config.includeGrid,
    floorScope,
    activePreviewLevel,
    previewIsTransparent,
  ]);

  const handleRunExport = async () => {
    const mode: ExportOutputMode = config.outputMode ?? "flat";
    let targetDirectory: Awaited<ReturnType<typeof pickExportDirectory>> extends infer R
      ? R extends { status: "picked"; handle: infer H }
        ? H
        : undefined
      : undefined;
    let effectiveConfig = config;

    // MUST invoke showDirectoryPicker immediately inside the user click gesture!
    if (mode === "folder") {
      const picked = await pickExportDirectory();
      if (picked.status === "cancelled") {
        useDocumentStore.getState().pushToast("Folder export cancelled", "info");
        return;
      }
      if (picked.status === "unsupported") {
        effectiveConfig = { ...config, outputMode: "zip" };
        setConfig(effectiveConfig);
        useDocumentStore
          .getState()
          .pushToast(
            "Direct folder writing isn't supported in this browser — exporting organized .ZIP archive instead!",
            "info",
          );
      } else {
        targetDirectory = picked.handle;
      }
    }

    setExporting(true);
    setProgress({ label: "Preparing GPU tiled stitcher…", percent: 5 });
    try {
      const files = await runBatchExport(
        doc,
        assetLookup,
        effectiveConfig,
        setProgress,
        targetDirectory ? { targetDirectory } : undefined,
      );
      const finalMode = effectiveConfig.outputMode ?? "flat";
      const summaryMsg =
        finalMode === "zip"
          ? `Packed ${files.length} organized file(s) into ${safeMapRootName}.zip`
          : finalMode === "folder" && targetDirectory
            ? `Saved ${files.length} organized file(s) inside "${targetDirectory.name}"`
            : `Exported ${files.length} file(s): ${files[0]}`;
      useDocumentStore.getState().pushToast(summaryMsg, "success");
    } catch (err) {
      useDocumentStore
        .getState()
        .pushToast(`Export error: ${(err as Error).message}`, "warning");
    } finally {
      setExporting(false);
    }
  };

  const PRESET_CARDS: Array<{
    id: ExportPresetId;
    title: string;
    sub: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "tv",
      title: "DiceChaosDisplay TV",
      sub: "True 1-Inch Physical Scale",
      icon: <Monitor size={18} />,
    },
    {
      id: "uvtt",
      title: "Universal VTT (.dd2vtt)",
      sub: "Foundry · Roll20 · Walls & Lights",
      icon: <Grid size={18} />,
    },
    {
      id: "pdf",
      title: "Print-Ready Tiled PDF",
      sub: "1-Inch Grid · Crop Marks",
      icon: <Printer size={18} />,
    },
    {
      id: "image",
      title: "Ultra-Res Image (PNG/WebP)",
      sub: "Up to 16K Tiled Rust Export",
      icon: <ImageIcon size={18} />,
    },
  ];

  return (
    <ModalDialog
      open={open}
      onClose={() => useDocumentStore.getState().setExportModalOpen(false)}
      title="Export Studio — 4K / 8K Tiled Renderer"
      icon={<DiceLogo size={20} />}
      maxWidthPx={1140}
      footer={
        <>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-secondary)",
            }}
          >
            {progress
              ? `${progress.label} (${progress.percent}%)`
              : `${tileCols}×${tileRows} GPU → Rust Tiles · ${outW}×${outH} px · Peak RAM ~${Math.min(260, 95 + tileCols * 18)} MB`}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="dc-btn"
              onClick={() => useDocumentStore.getState().setExportModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="dc-btn dc-btn-gold"
              disabled={exporting || variantCount === 0 || (floorScope !== "active" && selectedFloorCount === 0)}
              onClick={handleRunExport}
            >
              {outputMode === "folder" ? (
                <FolderOutput size={14} />
              ) : outputMode === "zip" ? (
                <FileArchive size={14} />
              ) : (
                <Download size={14} />
              )}
              <span>
                {exporting
                  ? "Exporting…"
                  : outputMode === "folder"
                    ? `Save ${variantCount} File${variantCount === 1 ? "" : "s"} to Folder…`
                    : outputMode === "zip"
                      ? `Export .ZIP (${variantCount} File${variantCount === 1 ? "" : "s"})`
                      : floorScope === "active"
                        ? `Export ${variantCount} Variant${variantCount === 1 ? "" : "s"}`
                        : `Export ${variantCount} File${variantCount === 1 ? "" : "s"} (${selectedFloorCount} Floor${selectedFloorCount === 1 ? "" : "s"})`}
              </span>
            </button>
          </div>
        </>
      }
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "238px 286px 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* Column 1: Export Target Presets */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: "var(--text-muted)",
              marginBottom: 8,
            }}
          >
            EXPORT PRESET
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PRESET_CARDS.map((card) => {
              const active = config.preset === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setConfig((c) => ({ ...c, preset: card.id }))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "11px 12px",
                    borderRadius: 8,
                    border: `1px solid ${active ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                    background: active ? "var(--accent-gold-soft)" : "var(--bg-panel)",
                    color: "var(--text-primary)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ color: active ? "var(--accent-gold)" : "var(--text-secondary)" }}>
                    {card.icon}
                  </span>
                  <span>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{card.title}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                      {card.sub}
                    </div>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Multi-Floor Export Scope (Active Floor vs All Separate Layers vs All Stacked Views) */}
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              <Layers size={12} style={{ color: "var(--accent-cyan)" }} />
              <span>FLOORS &amp; STACKING</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(
                [
                  {
                    id: "active" as ExportFloorScope,
                    title: "Active Floor Only",
                    sub: `Current view (${doc.levels.find((l) => l.id === doc.activeLevelId)?.shortCode ?? "1F"})`,
                  },
                  {
                    id: "all_separate" as ExportFloorScope,
                    title: "All Floors · Separate",
                    sub: "Transparent PNG layers to re-stack",
                  },
                  {
                    id: "all_stacked" as ExportFloorScope,
                    title: "All Floors · Stacked",
                    sub: "Composited view per floor",
                  },
                ]
              ).map((opt) => {
                const isAct = floorScope === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={isAct}
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        floorScope: opt.id,
                        selectedLevelIds:
                          c.selectedLevelIds && c.selectedLevelIds.length > 0
                            ? c.selectedLevelIds
                            : doc.levels.map((l) => l.id),
                      }))
                    }
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      padding: "8px 10px",
                      borderRadius: 7,
                      border: `1px solid ${isAct ? "rgba(34, 211, 238, 0.78)" : "var(--border-subtle)"}`,
                      background: isAct ? "rgba(34, 211, 238, 0.12)" : "var(--bg-panel)",
                      color: "var(--text-primary)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: isAct ? "var(--accent-cyan)" : "var(--text-primary)",
                      }}
                    >
                      {opt.title}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{opt.sub}</div>
                  </button>
                );
              })}
            </div>

            {floorScope !== "active" && doc.levels.length > 1 && (
              <div
                style={{
                  marginTop: 8,
                  padding: "8px 9px",
                  borderRadius: 7,
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                    fontSize: 10,
                    color: "var(--text-muted)",
                  }}
                >
                  <span style={{ fontWeight: 700, letterSpacing: "0.04em" }}>
                    INCLUDE FLOORS ({selectedFloorCount}/{doc.levels.length})
                  </span>
                  <div style={{ display: "inline-flex", gap: 6 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setConfig((c) => ({ ...c, selectedLevelIds: doc.levels.map((l) => l.id) }))
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--accent-cyan)",
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      All
                    </button>
                    {doc.levels.some((l) => l.kind === "sky") && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfig((c) => ({
                            ...c,
                            selectedLevelIds: doc.levels
                              .filter((l) => l.kind === "sky")
                              .map((l) => l.id),
                          }))
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--accent-gold)",
                          fontSize: 10,
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Sky
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfig((c) => ({ ...c, selectedLevelIds: [] }))}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: 10,
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      None
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {levelsTopDown.map((lv) => {
                    const checked = selectedLevelSet.has(lv.id);
                    return (
                      <button
                        key={lv.id}
                        type="button"
                        aria-pressed={checked}
                        title={`${lv.name} (${lv.elevationFt > 0 ? `+${lv.elevationFt}` : lv.elevationFt}ft)`}
                        onClick={() => {
                          setConfig((c) => {
                            const cur = new Set(c.selectedLevelIds ?? doc.levels.map((x) => x.id));
                            if (cur.has(lv.id)) cur.delete(lv.id);
                            else cur.add(lv.id);
                            return { ...c, selectedLevelIds: Array.from(cur) };
                          });
                          setPreviewLevelId(lv.id);
                        }}
                        className={`dc-chip ${checked ? "active" : ""}`}
                        style={{
                          fontSize: 10,
                          padding: "2px 6px",
                          fontFamily: "var(--font-mono)",
                        }}
                      >
                        {lv.shortCode}
                      </button>
                    );
                  })}
                </div>
                <div
                  style={{
                    fontSize: 9.5,
                    color: "var(--text-muted)",
                    marginTop: 6,
                    lineHeight: 1.35,
                  }}
                >
                  {floorScope === "all_separate"
                    ? "1F & B1 export opaque; upper floors, roofs & airship decks export transparent PNGs for pixel-perfect re-stacking."
                    : "Each floor exports as a full composited image with lower floors visible beneath it."}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: TV Calibration & Batch Variant Switches */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {config.preset === "tv" && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                TV CALIBRATION (DICECHAOSDISPLAY)
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">TV Preset</span>
                <select
                  className="dc-select"
                  value={`${config.tvDiagonalInches}-${config.tvResWidth}`}
                  onChange={(e) => {
                    const found = TV_PRESETS.find(
                      (p) => `${p.diag}-${p.w}` === e.target.value,
                    );
                    if (found) {
                      setConfig((c) => ({
                        ...c,
                        tvDiagonalInches: found.diag,
                        tvResWidth: found.w,
                        tvResHeight: found.h,
                      }));
                    }
                  }}
                >
                  {TV_PRESETS.map((p) => (
                    <option key={p.label} value={`${p.diag}-${p.w}`}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(229,169,60,0.55)",
                  background: "var(--accent-gold-soft)",
                  color: "var(--accent-gold)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                Exact 1-Inch Scale: {tvCal.exactPpi} PPI
                <div style={{ fontSize: 10, fontWeight: 500, opacity: 0.85, marginTop: 2, whiteSpace: "nowrap" }}>
                  {tvCal.physicalWidthInches}&quot; × {tvCal.physicalHeightInches}&quot; Surface · {tvCal.recommendedGridCols}×{tvCal.recommendedGridRows} Grid
                </div>
              </div>
            </div>
          )}

          {config.preset === "image" && (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--text-muted)",
                  marginBottom: 8,
                }}
              >
                RESOLUTION & FORMAT
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">Pixels / Grid (PPI)</span>
                <select
                  className="dc-select"
                  value={config.imagePpi}
                  onChange={(e) => setConfig((c) => ({ ...c, imagePpi: Number(e.target.value) }))}
                >
                  <option value={70}>70 PPI (Roll20 Fast)</option>
                  <option value={80}>80 PPI (55&quot; 4K TV)</option>
                  <option value={140}>140 PPI (Foundry HD)</option>
                  <option value={256}>256 PPI (Ultra 8K+)</option>
                  <option value={300}>300 PPI (Print Master)</option>
                </select>
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">Format</span>
                <select
                  className="dc-select"
                  value={config.imageFormat}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      imageFormat: e.target.value as "png" | "webp" | "jpeg",
                    }))
                  }
                >
                  <option value="png">Lossless PNG</option>
                  <option value="webp">WebP (Compact VTT)</option>
                  <option value="jpeg">JPEG (95%)</option>
                </select>
              </div>
            </div>
          )}

          {config.preset !== "pdf" && (
            <div
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--bg-panel)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  color: "var(--accent-cyan)",
                  marginBottom: 6,
                }}
              >
                RESOLUTION UPSCALE
              </div>
              <div className="dc-field-row" style={{ marginBottom: 6 }}>
                <span className="dc-field-label">Upscale Multiplier</span>
                <div style={{ display: "inline-flex", gap: 4 }}>
                  {([1, 1.5, 2] as const).map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      className={`dc-chip ${config.upscaleFactor === mult ? "active" : ""}`}
                      onClick={() => setConfig((c) => ({ ...c, upscaleFactor: mult }))}
                    >
                      {mult === 1 ? "1×" : `${mult}×`}
                    </button>
                  ))}
                </div>
              </div>
              {config.upscaleFactor > 1 && (
                <div className="dc-field-row" style={{ marginBottom: 0 }}>
                  <span className="dc-field-label">Crisp Ink Sharpen</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.sharpenUpscale}
                    className="dc-switch"
                    onClick={() => setConfig((c) => ({ ...c, sharpenUpscale: !c.sharpenUpscale }))}
                  />
                </div>
              )}
              {dims.clamped && (
                <div style={{ fontSize: 10, color: "var(--accent-gold)", marginTop: 6 }}>
                  Aspect-locked at {outW}×{outH} px (browser GPU ceiling).
                </div>
              )}
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
                marginBottom: 8,
              }}
            >
              BATCH VARIANTS
            </div>
            {(
              [
                ["variantPlayer", "Player Map (Spoiler-Free)", false],
                ["variantDm", "DM Reference (Traps & Notes)", true],
                ["variantDayNight", "Day & Night Lighting Pass", false],
                ["variantUvtt", "Export Walls & Lights (.dd2vtt)", false],
                ["variantRoofs", "Separate Roofs Overlay (PNG)", false],
                ["includeGrid", "Bake 1-Inch Tactical Grid", false],
              ] as const
            ).map(([key, label, violet]) => {
              const disabledRoofs = key === "variantRoofs" && floorScope !== "active";
              return (
                <div
                  key={key}
                  className="dc-field-row"
                  style={{ opacity: disabledRoofs ? 0.45 : 1 }}
                  title={
                    disabledRoofs
                      ? "Roofs are already included as their own floor when exporting All Floors."
                      : undefined
                  }
                >
                  <span className="dc-field-label" style={{ color: "var(--text-primary)" }}>
                    {label}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    disabled={disabledRoofs}
                    aria-checked={disabledRoofs ? false : config[key]}
                    className={`dc-switch ${violet ? "violet" : ""}`}
                    onClick={() => setConfig((c) => ({ ...c, [key]: !c[key] }))}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Interactive Split Player vs DM/VTT Live Preview */}
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                color: "var(--text-muted)",
              }}
            >
              LIVE OUTPUT PREVIEW (DRAG SLIDER TO COMPARE)
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-cyan)" }}>
              {outW} × {outH} px
            </span>
          </div>

          {floorScope !== "active" && doc.levels.length > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 8,
                padding: "5px 8px",
                borderRadius: 7,
                background: "var(--bg-panel)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    marginRight: 4,
                  }}
                >
                  PREVIEW FLOOR:
                </span>
                {levelsBottomUp.map((lv) => {
                  const isPrev = activePreviewLevel?.id === lv.id;
                  return (
                    <button
                      key={lv.id}
                      type="button"
                      className={`dc-chip ${isPrev ? "active" : ""}`}
                      onClick={() => setPreviewLevelId(lv.id)}
                      style={{
                        fontSize: 10,
                        padding: "2px 7px",
                        fontFamily: "var(--font-mono)",
                        opacity: selectedLevelSet.has(lv.id) ? 1 : 0.45,
                      }}
                    >
                      {lv.shortCode}
                    </button>
                  );
                })}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: previewIsTransparent ? "var(--accent-cyan)" : "var(--accent-gold)",
                  whiteSpace: "nowrap",
                }}
              >
                {previewIsTransparent ? "TRANSPARENT PNG" : floorScope === "all_stacked" ? "STACKED VIEW" : "OPAQUE BASE"}
              </span>
            </div>
          )}

          <div
            style={{
              position: "relative",
              borderRadius: 10,
              overflow: "hidden",
              border: "1px solid var(--border-strong)",
              background: previewIsTransparent
                ? "repeating-conic-gradient(#1b2030 0% 25%, #111520 0% 50%) 50% / 16px 16px"
                : "#0B0D12",
              aspectRatio: `${doc.canvas.widthCells} / ${doc.canvas.heightCells}`,
            }}
          >
            {/* Bottom layer: DM / VTT View */}
            <canvas
              ref={dmPreviewRef}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
            {/* Top clipped layer: Clean Spoiler-Free Player View */}
            <canvas
              ref={playerPreviewRef}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                display: "block",
                clipPath: `inset(0 ${100 - splitPct}% 0 0)`,
              }}
            />

            {/* Split Divider Line + Circular Draggable Thumb Handle */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${splitPct}%`,
                width: 2,
                background: "var(--accent-gold)",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--bg-chrome)",
                  border: "2px solid var(--accent-gold)",
                  color: "var(--accent-gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.65)",
                }}
              >
                ↔
              </div>
            </div>

            <span
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                padding: "3px 8px",
                borderRadius: 5,
                background: "rgba(18,20,26,0.88)",
                border: "1px solid var(--border-strong)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              PLAYER VIEW (SPOILER-FREE)
            </span>
            <span
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                padding: "3px 8px",
                borderRadius: 5,
                background: "rgba(18,20,26,0.88)",
                border: "1px solid rgba(34,211,238,0.5)",
                color: "var(--accent-cyan)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.05em",
              }}
            >
              DM / VTT VIEW
            </span>

            <input
              type="range"
              aria-label="Compare Player View and DM View"
              min={5}
              max={95}
              value={splitPct}
              onChange={(e) => setSplitPct(Number(e.target.value))}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                opacity: 0,
                cursor: "ew-resize",
              }}
            />
          </div>

          <div
            style={{
              marginTop: 10,
              padding: "8px 12px",
              borderRadius: 8,
              background: "var(--bg-panel)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-secondary)",
            }}
          >
            <span>
              Tiled Pipeline: {tileCols}×{tileRows} chunks ({config.tileSizePx}px)
            </span>
            <span style={{ color: "var(--accent-gold)" }}>Zero-Seam Stitch</span>
          </div>

          {/* Output Organization & Packaging Controls (Disk Folder / ZIP Archive / All in One Folder) */}
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 9,
              background: "rgba(18, 21, 30, 0.72)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <fieldset className="dc-export-fieldset">
              <legend className="dc-export-legend">
                <FolderTree size={12} style={{ color: "var(--accent-gold)" }} />
                <span>Output Packaging &amp; Folders</span>
              </legend>
              <div
                className="dc-radio-card-grid"
                style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
              >
                {(
                  [
                    {
                      id: "folder" as ExportOutputMode,
                      title: "Disk Folder",
                      sub: canPickDirectory
                        ? "Create real subfolders"
                        : "Auto-falls back to .ZIP",
                      icon: <FolderOutput size={13} />,
                    },
                    {
                      id: "zip" as ExportOutputMode,
                      title: "Zipped (.zip)",
                      sub: "1 clean archive w/ folders",
                      icon: <FileArchive size={13} />,
                    },
                    {
                      id: "flat" as ExportOutputMode,
                      title: "All in One Folder",
                      sub: "Individual downloads (flat)",
                      icon: <Download size={13} />,
                    },
                  ]
                ).map((opt) => {
                  const active = outputMode === opt.id;
                  const inputId = `${idPrefix}-mode-${opt.id}`;
                  return (
                    <label
                      key={opt.id}
                      htmlFor={inputId}
                      className={`dc-radio-card ${active ? "active" : ""}`}
                    >
                      <input
                        id={inputId}
                        type="radio"
                        name={`${idPrefix}-output-mode`}
                        value={opt.id}
                        checked={active}
                        onChange={() => setConfig((c) => ({ ...c, outputMode: opt.id }))}
                        className="dc-visually-hidden"
                      />
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: active ? "var(--accent-gold)" : "var(--text-primary)",
                        }}
                      >
                        {opt.icon}
                        <span>{opt.title}</span>
                      </span>
                      <span style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.25 }}>
                        {opt.sub}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {outputMode !== "flat" && (
              <>
                <fieldset className="dc-export-fieldset">
                  <legend className="dc-export-legend">
                    <span>Subfolder Organization</span>
                  </legend>
                  <div
                    className="dc-radio-card-grid"
                    style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
                  >
                    {(
                      [
                        {
                          id: "by_role" as ExportFolderStructure,
                          title: "View & Light",
                          sub: "Player / Daylight / DM / VTT",
                        },
                        {
                          id: "by_file_type" as ExportFolderStructure,
                          title: "File Type",
                          sub: "PNG / VTT / Print",
                        },
                        {
                          id: "by_floor" as ExportFolderStructure,
                          title: "By Floor",
                          sub: "B1 / 1F / 2F / ROOF",
                        },
                        {
                          id: "flat_in_map" as ExportFolderStructure,
                          title: "Single Folder",
                          sub: "All inside map folder",
                        },
                      ]
                    ).map((opt) => {
                      const active = folderStructure === opt.id;
                      const inputId = `${idPrefix}-struct-${opt.id}`;
                      return (
                        <label
                          key={opt.id}
                          htmlFor={inputId}
                          className={`dc-radio-card cyan ${active ? "active" : ""}`}
                          style={{ padding: "6px 8px" }}
                        >
                          <input
                            id={inputId}
                            type="radio"
                            name={`${idPrefix}-folder-structure`}
                            value={opt.id}
                            checked={active}
                            onChange={() =>
                              setConfig((c) => ({ ...c, folderStructure: opt.id }))
                            }
                            className="dc-visually-hidden"
                          />
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: active ? "var(--accent-cyan)" : "var(--text-primary)",
                            }}
                          >
                            {opt.title}
                          </span>
                          <span
                            style={{
                              fontSize: 9.5,
                              color: "var(--text-muted)",
                              lineHeight: 1.25,
                            }}
                          >
                            {opt.sub}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <label
                  htmlFor={`${idPrefix}-map-root`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    width: "fit-content",
                  }}
                >
                  <input
                    id={`${idPrefix}-map-root`}
                    type="checkbox"
                    checked={includeMapRoot}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, includeMapRootFolder: e.target.checked }))
                    }
                    style={{
                      accentColor: "var(--accent-gold)",
                      colorScheme: "dark",
                      width: 14,
                      height: 14,
                      cursor: "pointer",
                    }}
                  />
                  <span>
                    Wrap inside map folder{" "}
                    <code
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        color: "var(--accent-gold)",
                      }}
                    >
                      {safeMapRootName}/
                    </code>
                  </span>
                </label>
              </>
            )}

            {/* Collapsible Live Folder Tree Preview */}
            <details
              className="dc-export-tree-details"
              open={treeOpen}
              onToggle={(e) => setTreeOpen(e.currentTarget.open)}
            >
              <summary>
                <span style={{ color: "var(--text-primary)" }}>Output Preview</span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--accent-cyan)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {treePreview.rootLabel}
                </span>
                <span
                  style={{
                    marginInlineStart: "auto",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {outputMode === "flat"
                    ? `${treePreview.totalFiles} flat file${treePreview.totalFiles === 1 ? "" : "s"}`
                    : `${treePreview.groups.length} folder${treePreview.groups.length === 1 ? "" : "s"} · ${treePreview.totalFiles} file${treePreview.totalFiles === 1 ? "" : "s"}`}
                </span>
              </summary>
              <div
                className="dc-scroll"
                style={{
                  maxHeight: 126,
                  overflowY: "auto",
                  padding: "6px 10px 8px",
                  borderTop: "1px solid var(--border-subtle)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  lineHeight: 1.45,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {treePreview.groups.length === 0 ? (
                  <span style={{ color: "var(--text-muted)" }}>
                    Enable at least one variant or floor to preview exported files.
                  </span>
                ) : (
                  treePreview.groups.map((grp) => (
                    <div key={grp.folderPath}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          color: "var(--accent-gold)",
                          fontWeight: 700,
                        }}
                      >
                        <Folder size={11} style={{ flexShrink: 0 }} />
                        <span>{grp.folderPath}</span>
                        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                          ({grp.files.length})
                        </span>
                      </div>
                      <div
                        style={{
                          paddingInlineStart: 16,
                          color: "var(--text-secondary)",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        {grp.files.slice(0, 3).map((fn) => (
                          <span
                            key={fn}
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {fn}
                          </span>
                        ))}
                        {grp.files.length > 3 && (
                          <span style={{ color: "var(--text-muted)" }}>
                            … +{grp.files.length - 3} more file{grp.files.length - 3 === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
};

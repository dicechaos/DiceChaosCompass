import {
  writeBlobToDirectoryPath,
  type DirectoryHandleLike,
} from "@/engine/fileSaveService";
import { buildUvttPayload, computeTvCalibration } from "@/engine/geometry";
import {
  collectAllDocAssetUrls,
  renderMapScene,
  texturePool,
} from "@/engine/sceneRenderer";
import { buildZipBlob, type ZipInputEntry } from "@/engine/zipArchive";
import type { DcMapDocument, LevelKind, MapLevel, VaultAsset } from "@/types/map";

export type ExportPresetId = "tv" | "uvtt" | "pdf" | "image";

export type ExportFloorScope = "active" | "all_separate" | "all_stacked";

export type ExportOutputMode = "folder" | "zip" | "flat";

export type ExportFolderStructure =
  | "by_role"
  | "by_file_type"
  | "by_floor"
  | "flat_in_map";

export type ExportJobRole =
  | "player"
  | "dm"
  | "daylight"
  | "vtt"
  | "roofs"
  | "print";

export interface ExportJobConfig {
  preset: ExportPresetId;
  tvDiagonalInches: number;
  tvResWidth: number;
  tvResHeight: number;
  imagePpi: number;
  upscaleFactor: 1 | 1.5 | 2;
  sharpenUpscale: boolean;
  imageFormat: "png" | "webp" | "jpeg";
  pdfPaper: "letter" | "a4" | "tabloid";
  includeGrid: boolean;
  variantPlayer: boolean;
  variantDm: boolean;
  variantDayNight: boolean;
  variantUvtt: boolean;
  variantRoofs: boolean;
  tileSizePx: number;
  /**
   * Controls multi-floor export behavior:
   * - "active": export only the currently active floor view
   * - "all_separate": export each selected floor individually (transparent PNG overlays above 1F so they can be re-stacked!)
   * - "all_stacked": export each selected floor as a full composited stacked scene (with lower floors visible beneath)
   */
  floorScope?: ExportFloorScope;
  /** Optional subset of level IDs to include when floorScope !== "active" (defaults to all levels). */
  selectedLevelIds?: string[];
  /**
   * Controls how exported files are packaged and saved:
   * - "folder": write nested folders directly to a user-picked OS folder (File System Access API)
   * - "zip": bundle all organized folders & files into a single <MapName>.zip archive
   * - "flat": individual browser downloads in one folder (legacy default)
   */
  outputMode?: ExportOutputMode;
  /** Subfolder organization scheme used when outputMode is "folder" or "zip". */
  folderStructure?: ExportFolderStructure;
  /** Wrap exported folders inside a top-level `<MapName>/` folder (default true for folder & zip). */
  includeMapRootFolder?: boolean;
}

export interface ExportBatchJob {
  suffix: string;
  role: ExportJobRole;
  dmView: boolean;
  vttOverlay: boolean;
  lightingPresetId?: string;
  onlyRoofs?: boolean;
  asUvtt?: boolean;
  asPdf?: boolean;
  /** When set, renders ONLY this level (transparent background for upper/roof/sky levels). */
  isolatedLevelId?: string;
  /** When set, renders this level stacked composited over all visible lower levels. */
  stackedLevelId?: string;
  /** True when the output requires an alpha channel (PNG/WebP, never JPEG). */
  requiresAlpha?: boolean;
  levelShortCode?: string;
  /** Clean sortable floor folder name, e.g. "02_1F_+0ft" or "1F". */
  levelFolder?: string;
}

export interface ResolvedExportEntry {
  fileName: string;
  folderSegments: string[];
  relativePath: string;
  imageFormat?: "png" | "webp" | "jpeg";
}

export interface ExportFolderTreeGroup {
  folderPath: string;
  files: string[];
}

export interface ExportFolderTreePreview {
  rootLabel: string;
  archiveName: string;
  groups: ExportFolderTreeGroup[];
  totalFiles: number;
}

export function sanitizePathSegment(raw: string, fallback = "DiceChaos_Map"): string {
  const cleaned = raw
    .replace(/\.dcmap$/i, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._]+|[._]+$/g, "");
  return cleaned || fallback;
}

export function sortLevelsBottomUp(levels: MapLevel[]): MapLevel[] {
  const rank = (k: LevelKind) =>
    k === "sky" ? 4 : k === "roof" ? 3 : k === "upper" ? 2 : k === "ground" ? 1 : 0;
  return [...levels].sort((a, b) => {
    const rd = rank(a.kind) - rank(b.kind);
    if (rd !== 0) return rd;
    return a.elevationFt - b.elevationFt;
  });
}

export function isTransparentFloorLevel(level: MapLevel | undefined): boolean {
  return Boolean(level && level.kind !== "ground" && level.kind !== "underground");
}

/**
 * Pure, side-effect-free document snapshot with stacked level visibility applied for `targetLevelId`
 * (matching the live Elevator Shaft rules: B1 standalone, 1F ground, 2F over 1F, ROOF over 1F,
 * SKY-H/SKY over ROOF+1F, SKY-U over SKY+ROOF+1F).
 */
export function createLevelSnapshotDoc(
  doc: DcMapDocument,
  targetLevelId: string,
): DcMapDocument {
  const target = doc.levels.find((lv) => lv.id === targetLevelId) ?? doc.levels[0];
  if (!target) return doc;

  const belowDeckId =
    target.kind === "sky" &&
    target.id === "lvl-sky-upper" &&
    doc.levels.some((x) => x.id === "lvl-sky")
      ? "lvl-sky"
      : null;

  const levels = doc.levels.map((lv) => {
    let visible = false;
    if (target.kind === "underground") {
      visible = lv.id === target.id;
    } else if (target.kind === "ground") {
      visible = lv.kind === "ground";
    } else if (target.kind === "upper") {
      visible =
        lv.kind === "ground" || (lv.kind === "upper" && lv.elevationFt <= target.elevationFt);
    } else if (target.kind === "sky") {
      visible =
        lv.kind === "ground" ||
        lv.kind === "roof" ||
        lv.id === target.id ||
        (belowDeckId !== null && lv.id === belowDeckId);
    } else {
      visible = lv.kind === "ground" || lv.kind === "roof";
    }
    return { ...lv, visible };
  });

  const levelMap = new Map(levels.map((lv) => [lv.id, lv]));
  const layers = doc.layers.map((l) => {
    const lv = levelMap.get(l.levelId);
    if (l.kind === "dm_notes") {
      return {
        ...l,
        visible: target.kind === "sky" ? l.levelId === target.id : lv?.kind !== "sky",
      };
    }
    return {
      ...l,
      visible: lv ? lv.visible : l.visible,
    };
  });

  return {
    ...doc,
    activeLevelId: target.id,
    levels,
    layers,
  };
}

export interface ExportProgress {
  label: string;
  percent: number;
}

const MAX_BROWSER_CANVAS_SIDE = 12288;

/**
 * Computes aspect-preserving export dimensions clamped safely within browser GPU canvas limits
 * so ultra-high PPI or 2x Upscale exports NEVER clip or stretch the map!
 */
export function computeExportDimensions(
  widthCells: number,
  heightCells: number,
  targetPpi: number,
  upscaleFactor = 1,
  maxSidePx = MAX_BROWSER_CANVAS_SIDE,
): { width: number; height: number; pixelsPerCell: number; clamped: boolean } {
  const effectivePpi = Math.max(16, targetPpi * Math.max(1, upscaleFactor));
  const rawW = Math.max(256, Math.round(widthCells * effectivePpi));
  const rawH = Math.max(256, Math.round(heightCells * effectivePpi));
  const maxRaw = Math.max(rawW, rawH);
  const clamped = maxRaw > maxSidePx;
  const scale = clamped ? maxSidePx / maxRaw : 1;
  const width = Math.max(128, Math.round(rawW * scale));
  const height = Math.max(128, Math.round(rawH * scale));
  return {
    width,
    height,
    pixelsPerCell: width / Math.max(1, widthCells),
    clamped,
  };
}

/**
 * Resolves the brightest daylight lighting preset defined on the map (e.g., "overcast" on
 * the Berlin Funicular map or "day" on custom maps) so Day/Night batch exports always work!
 */
export function resolveDaylightPresetId(doc: DcMapDocument): string | undefined {
  const presets = doc.lighting.presets ?? [];
  if (presets.length === 0) return undefined;
  const byName = presets.find((p) =>
    /day|overcast|sun|noon|morning/i.test(`${p.id} ${p.name}`),
  );
  if (byName) return byName.id;
  return [...presets].sort((a, b) => b.ambientIntensity - a.ambientIntensity)[0]?.id;
}

/**
 * Gentle luminance-preserving 3x3 unsharp-mask pass for crisp hand-inked linework when
 * upscaling maps 1.5x or 2x (caps pixel work safely for ultra-large canvases).
 */
function applyCrispInkSharpen(canvas: HTMLCanvasElement, amount = 0.28): void {
  const w = canvas.width;
  const h = canvas.height;
  // Guard huge 10K+ canvases from slow main-thread convolution
  if (w * h > 36_000_000) return;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  try {
    const src = ctx.getImageData(0, 0, w, h);
    const out = ctx.createImageData(w, h);
    const s = src.data;
    const d = out.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || s[idx + 3] === 0) {
          d[idx] = s[idx];
          d[idx + 1] = s[idx + 1];
          d[idx + 2] = s[idx + 2];
          d[idx + 3] = s[idx + 3];
          continue;
        }
        const up = idx - w * 4;
        const dn = idx + w * 4;
        const lt = idx - 4;
        const rt = idx + 4;
        for (let c = 0; c < 3; c++) {
          const avg = (s[up + c] + s[dn + c] + s[lt + c] + s[rt + c]) * 0.25;
          const v = s[idx + c] + (s[idx + c] - avg) * amount;
          d[idx + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
        }
        d[idx + 3] = s[idx + 3];
      }
    }
    ctx.putImageData(out, 0, 0);
  } catch {
    // Ignore if canvas is tainted or memory constrained
  }
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
}

/**
 * Renders a full high-resolution map (4K TV, 8K+, or 1.5x/2x Upscaled Master) with
 * exact aspect-ratio preservation and optional Crisp Ink Sharpening.
 */
export async function renderExportCanvas(
  doc: DcMapDocument,
  assetLookup: Map<string, VaultAsset>,
  targetPpi: number,
  options: {
    dmView: boolean;
    showVttOverlay: boolean;
    showGrid: boolean;
    forceLightingPresetId?: string;
    onlyRoofsLayer?: boolean;
    isolatedLevelId?: string;
    stackedLevelId?: string;
    upscaleFactor?: 1 | 1.5 | 2;
    sharpenUpscale?: boolean;
  },
): Promise<HTMLCanvasElement> {
  const renderDoc = options.stackedLevelId
    ? createLevelSnapshotDoc(doc, options.stackedLevelId)
    : doc;

  await texturePool.ensureLoaded(collectAllDocAssetUrls(renderDoc, assetLookup));

  const upscale = options.upscaleFactor ?? 1;
  const dims = computeExportDimensions(
    renderDoc.canvas.widthCells,
    renderDoc.canvas.heightCells,
    targetPpi,
    upscale,
  );

  const canvas = document.createElement("canvas");
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed allocating offscreen export canvas");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  renderMapScene(ctx, renderDoc, assetLookup, {
    pixelsPerCell: dims.pixelsPerCell,
    dmView: options.dmView,
    showVttOverlay: options.showVttOverlay,
    showScatterOutlines: false,
    showGrid: options.showGrid,
    forceLightingPresetId: options.forceLightingPresetId,
    onlyRoofsLayer: options.onlyRoofsLayer,
    isolatedLevelId: options.isolatedLevelId,
  });

  if (upscale > 1 && options.sharpenUpscale) {
    applyCrispInkSharpen(canvas, 0.28);
  }

  return canvas;
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: "png" | "webp" | "jpeg",
): Promise<Blob> {
  const mime =
    format === "webp"
      ? "image/webp"
      : format === "jpeg"
        ? "image/jpeg"
        : "image/png";
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encoding failed"))),
      mime,
      0.95,
    );
  });
}

function buildPrintHtmlSheet(
  dataUrl: string,
  mapWIn: number,
  mapHIn: number,
  title: string,
): Blob {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} — 1-Inch Print Sheet</title>
  <style>@page { margin: 0.5in; } body { margin: 0; background: #111; color: #eee; font-family: system-ui; }
  .note { padding: 12px; font-size: 13px; background: #1b1e28; } @media print { .note { display: none; } body { background: #fff; } }
  img { width: ${mapWIn.toFixed(2)}in; height: ${mapHIn.toFixed(2)}in; display: block; }</style></head>
  <body><div class="note"><strong>Dice Chaos Maps — 1.00-Inch Calibrated Print Sheet</strong> (${mapWIn.toFixed(1)}" × ${mapHIn.toFixed(1)}"). Print at <strong>100% / Actual Size</strong> with Poster Tiling enabled.</div>
  <img src="${dataUrl}" /></body></html>`;
  return new Blob([html], { type: "text/html;charset=utf-8" });
}

function buildVariantJobs(
  doc: DcMapDocument,
  config: ExportJobConfig,
  opts: {
    prefix: string;
    isolatedLevelId?: string;
    stackedLevelId?: string;
    requiresAlpha?: boolean;
    levelShortCode?: string;
    levelFolder?: string;
    skipRoofsOverlay?: boolean;
  },
): ExportBatchJob[] {
  const upscaleTag = config.upscaleFactor > 1 ? `_${config.upscaleFactor}x` : "";
  const daylightId = resolveDaylightPresetId(doc);
  const jobs: ExportBatchJob[] = [];
  const pfx = opts.prefix;
  const common = {
    isolatedLevelId: opts.isolatedLevelId,
    stackedLevelId: opts.stackedLevelId,
    requiresAlpha: opts.requiresAlpha,
    levelShortCode: opts.levelShortCode,
    levelFolder: opts.levelFolder,
  };

  if (config.variantPlayer) {
    jobs.push({
      ...common,
      role: "player",
      suffix:
        config.preset === "tv"
          ? `${pfx}_${config.tvDiagonalInches}in_TV${upscaleTag}_Player`
          : `${pfx}${upscaleTag}_Player`,
      dmView: false,
      vttOverlay: false,
    });
  }
  if (config.variantDm) {
    jobs.push({
      ...common,
      role: "dm",
      suffix: `${pfx}${upscaleTag}_DM_Reference`,
      dmView: true,
      vttOverlay: true,
    });
  }
  if (config.variantDayNight) {
    jobs.push({
      ...common,
      role: "daylight",
      suffix: `${pfx}${upscaleTag}_Daylight`,
      dmView: false,
      vttOverlay: false,
      lightingPresetId: daylightId,
    });
  }
  if (config.variantRoofs && !opts.skipRoofsOverlay) {
    jobs.push({
      role: "roofs",
      suffix: `${pfx}${upscaleTag}_Roofs_Overlay`,
      dmView: false,
      vttOverlay: false,
      onlyRoofs: true,
      requiresAlpha: true,
      levelShortCode: "ROOF",
      levelFolder: "Roofs",
    });
  }
  if (config.variantUvtt || config.preset === "uvtt") {
    jobs.push({
      ...common,
      role: "vtt",
      suffix: `${pfx}_VTT`,
      dmView: false,
      vttOverlay: false,
      asUvtt: true,
    });
  }
  if (config.preset === "pdf") {
    jobs.push({
      ...common,
      role: "print",
      suffix: `${pfx}_1in_Print`,
      dmView: false,
      vttOverlay: false,
      asPdf: true,
    });
  }
  return jobs;
}

export function resolveBatchJobs(
  doc: DcMapDocument,
  config: ExportJobConfig,
): ExportBatchJob[] {
  const scope = config.floorScope ?? "active";
  if (scope === "active") {
    const activeLv = doc.levels.find((lv) => lv.id === doc.activeLevelId) ?? doc.levels[0];
    const safeCode = activeLv
      ? sanitizePathSegment(activeLv.shortCode, "1F")
      : "1F";
    return buildVariantJobs(doc, config, {
      prefix: "",
      levelShortCode: activeLv?.shortCode,
      levelFolder: safeCode,
    });
  }

  const orderedLevels = sortLevelsBottomUp(doc.levels);
  const allowed =
    config.selectedLevelIds && config.selectedLevelIds.length > 0
      ? new Set(config.selectedLevelIds)
      : null;
  const targetLevels = allowed
    ? orderedLevels.filter((lv) => allowed.has(lv.id))
    : orderedLevels;

  const modeTag = scope === "all_separate" ? "Layer" : "Stacked";
  const allJobs: ExportBatchJob[] = [];

  targetLevels.forEach((lv, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    const safeCode = lv.shortCode.replace(/[^A-Za-z0-9_-]/g, "");
    const elevTag = lv.elevationFt >= 0 ? `+${lv.elevationFt}ft` : `${lv.elevationFt}ft`;
    const prefix = `_${num}_${safeCode}_${elevTag}_${modeTag}`;
    const levelFolder = `${num}_${safeCode}_${elevTag}`;
    const isSep = scope === "all_separate";

    allJobs.push(
      ...buildVariantJobs(doc, config, {
        prefix,
        isolatedLevelId: isSep ? lv.id : undefined,
        stackedLevelId: isSep ? undefined : lv.id,
        requiresAlpha: isSep && isTransparentFloorLevel(lv),
        levelShortCode: lv.shortCode,
        levelFolder,
        // Avoid duplicating the separate Roofs overlay pass when exporting every floor already
        skipRoofsOverlay: true,
      }),
    );
  });

  return allJobs;
}

export function resolveJobImageFormat(
  job: ExportBatchJob,
  config: ExportJobConfig,
): "png" | "webp" | "jpeg" {
  const needsAlpha = Boolean(job.onlyRoofs || job.requiresAlpha);
  if (needsAlpha && config.imageFormat === "jpeg") return "png";
  if (job.onlyRoofs) return "png";
  return config.imageFormat;
}

function getRoleFolderName(role: ExportJobRole): string {
  switch (role) {
    case "player":
      return "Player";
    case "daylight":
      return "Daylight";
    case "dm":
      return "DM_Reference";
    case "vtt":
      return "VTT";
    case "roofs":
      return "Roofs";
    case "print":
      return "Print";
  }
}

function getFileTypeFolderName(
  job: ExportBatchJob,
  imageFmt?: "png" | "webp" | "jpeg",
): string {
  if (job.asUvtt) return "VTT_dd2vtt";
  if (job.asPdf) return "Print_HTML";
  if (imageFmt === "webp") return "WebP";
  if (imageFmt === "jpeg") return "JPEG";
  return "PNG";
}

/**
 * Resolves the deterministic filename and nested subfolder segments for an export job.
 * Shared by both the live Export Studio folder tree preview and `runBatchExport`.
 */
export function resolveExportEntry(
  rawTitle: string,
  job: ExportBatchJob,
  config: ExportJobConfig,
): ResolvedExportEntry {
  const baseName = sanitizePathSegment(rawTitle);
  const outputMode: ExportOutputMode = config.outputMode ?? "flat";
  const structure: ExportFolderStructure = config.folderStructure ?? "by_role";
  const includeRoot = config.includeMapRootFolder !== false;

  let fileName: string;
  let imageFormat: "png" | "webp" | "jpeg" | undefined;
  if (job.asUvtt) {
    fileName =
      job.suffix && job.suffix !== "_VTT"
        ? `${baseName}${job.suffix}.dd2vtt`
        : `${baseName}.dd2vtt`;
  } else if (job.asPdf) {
    fileName = `${baseName}${job.suffix}_PrintSheet.html`;
  } else {
    imageFormat = resolveJobImageFormat(job, config);
    fileName = `${baseName}${job.suffix}.${imageFormat}`;
  }

  if (outputMode === "flat") {
    return {
      fileName,
      folderSegments: [],
      relativePath: fileName,
      imageFormat,
    };
  }

  const folderSegments: string[] = [];
  if (includeRoot) {
    folderSegments.push(baseName);
  }

  if (structure === "by_role") {
    folderSegments.push(getRoleFolderName(job.role));
  } else if (structure === "by_file_type") {
    folderSegments.push(getFileTypeFolderName(job, imageFormat));
  } else if (structure === "by_floor") {
    folderSegments.push(sanitizePathSegment(job.levelFolder || job.levelShortCode || "1F", "1F"));
  }
  // "flat_in_map" keeps files directly inside `<MapName>/` (or chosen root if includeRoot=false)

  const relativePath =
    folderSegments.length > 0 ? `${folderSegments.join("/")}/${fileName}` : fileName;

  return {
    fileName,
    folderSegments,
    relativePath,
    imageFormat,
  };
}

/**
 * Produces a grouped folder-tree summary for the live Export Studio preview UI.
 */
export function buildExportFolderTreePreview(
  doc: DcMapDocument,
  config: ExportJobConfig,
): ExportFolderTreePreview {
  const baseName = sanitizePathSegment(doc.meta.title);
  const outputMode: ExportOutputMode = config.outputMode ?? "flat";
  const jobs = resolveBatchJobs(doc, config);
  const byFolder = new Map<string, string[]>();

  for (const job of jobs) {
    const entry = resolveExportEntry(doc.meta.title, job, config);
    const folderPath =
      entry.folderSegments.length > 0 ? `${entry.folderSegments.join("/")}/` : "(Downloads Root)/";
    const list = byFolder.get(folderPath);
    if (list) list.push(entry.fileName);
    else byFolder.set(folderPath, [entry.fileName]);
  }

  const groups: ExportFolderTreeGroup[] = Array.from(byFolder.entries()).map(
    ([folderPath, files]) => ({ folderPath, files }),
  );

  const archiveName = `${baseName}.zip`;
  const rootLabel =
    outputMode === "zip"
      ? archiveName
      : outputMode === "folder"
        ? config.includeMapRootFolder !== false
          ? `<Chosen Folder>/${baseName}/`
          : "<Chosen Folder>/"
        : "Browser Downloads (All in One Folder)";

  return {
    rootLabel,
    archiveName,
    groups,
    totalFiles: jobs.length,
  };
}

export async function runBatchExport(
  doc: DcMapDocument,
  assetLookup: Map<string, VaultAsset>,
  config: ExportJobConfig,
  onProgress: (p: ExportProgress) => void,
  options?: { targetDirectory?: DirectoryHandleLike },
): Promise<string[]> {
  const baseName = sanitizePathSegment(doc.meta.title);
  const outputMode: ExportOutputMode = config.outputMode ?? "flat";
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

  if (outputMode === "folder" && !options?.targetDirectory) {
    throw new Error("No target folder selected for folder export.");
  }

  const jobs = resolveBatchJobs(doc, config);
  const produced: string[] = [];
  const zipEntries: ZipInputEntry[] = [];

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const entry = resolveExportEntry(doc.meta.title, job, config);
    const renderPct =
      outputMode === "zip"
        ? Math.round((i / Math.max(1, jobs.length)) * 88)
        : Math.round((i / Math.max(1, jobs.length)) * 100);
    onProgress({
      label: `Rendering ${entry.relativePath} (${i + 1}/${jobs.length})…`,
      percent: renderPct,
    });

    // Yield one frame so progress UI updates smoothly during heavy 4K/8K renders
    await new Promise((r) => setTimeout(r, 16));

    const canvas = await renderExportCanvas(doc, assetLookup, effectivePpi, {
      dmView: job.dmView,
      showVttOverlay: job.vttOverlay,
      showGrid: job.onlyRoofs || job.requiresAlpha ? false : config.includeGrid,
      forceLightingPresetId: job.lightingPresetId,
      onlyRoofsLayer: job.onlyRoofs,
      isolatedLevelId: job.isolatedLevelId,
      stackedLevelId: job.stackedLevelId,
      upscaleFactor: job.asPdf ? 1 : config.upscaleFactor,
      sharpenUpscale: config.sharpenUpscale,
    });

    let blob: Blob;
    if (job.asUvtt) {
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] ?? "";
      const uvttPpi = canvas.width / Math.max(1, doc.canvas.widthCells);
      const uvttDoc = job.stackedLevelId
        ? createLevelSnapshotDoc(doc, job.stackedLevelId)
        : job.isolatedLevelId
          ? {
              ...doc,
              activeLevelId: job.isolatedLevelId,
              layers: doc.layers.map((l) => ({
                ...l,
                visible: l.levelId === job.isolatedLevelId,
              })),
            }
          : doc;
      const uvttObj = buildUvttPayload(uvttDoc, base64, uvttPpi, true);
      blob = new Blob([JSON.stringify(uvttObj)], {
        type: "application/json",
      });
    } else if (job.asPdf) {
      const dataUrl = canvas.toDataURL("image/png");
      blob = buildPrintHtmlSheet(
        dataUrl,
        doc.canvas.widthCells,
        doc.canvas.heightCells,
        `${baseName}${job.levelShortCode ? ` · ${job.levelShortCode}` : ""}`,
      );
    } else {
      const fmt = entry.imageFormat ?? resolveJobImageFormat(job, config);
      blob = await canvasToBlob(canvas, fmt);
    }

    if (outputMode === "folder" && options?.targetDirectory) {
      await writeBlobToDirectoryPath(
        options.targetDirectory,
        entry.folderSegments,
        entry.fileName,
        blob,
      );
      produced.push(entry.relativePath);
    } else if (outputMode === "zip") {
      const buf = new Uint8Array(await blob.arrayBuffer());
      zipEntries.push({
        path: entry.relativePath,
        data: buf,
      });
      produced.push(entry.relativePath);
    } else {
      triggerBrowserDownload(blob, entry.fileName);
      produced.push(entry.fileName);
      // Stagger multi-file downloads cleanly so Chrome/Edge never drops batch files
      if (i < jobs.length - 1) {
        await new Promise((r) => setTimeout(r, 260));
      }
    }
  }

  if (outputMode === "zip") {
    onProgress({
      label: `Packing ${zipEntries.length} file(s) into ${baseName}.zip…`,
      percent: 94,
    });
    const zipBlob = await buildZipBlob(zipEntries);
    triggerBrowserDownload(zipBlob, `${baseName}.zip`);
    onProgress({
      label: `Exported ${produced.length} file(s) → ${baseName}.zip`,
      percent: 100,
    });
    return produced;
  }

  onProgress({
    label:
      outputMode === "folder"
        ? `Saved ${produced.length} file(s) to ${options?.targetDirectory?.name ?? "folder"}`
        : `Exported ${produced.length} file(s)`,
    percent: 100,
  });
  return produced;
}

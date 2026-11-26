/**
 * Wonderdraft (.wonderdraft_map) → Dice Chaos Compass World Atlas (.dcmap) Importer.
 *
 * Converts decoded Wonderdraft Godot Variant dictionaries (or Wonderdraft Extract Map Data JSON)
 * into fully editable, infinite-zoom World Atlas DcMapDocuments:
 *   - High-resolution landmass heightfield (`mask.A`) + max-pooled freshwater rivers/lakes (`mask.R`)
 *   - Pixel-accurate land-clipped watercolor biome raster (`ground` RGBA8 → `biomeRasterB64`)
 *   - Exact labels (names, coordinates, scaled typography, outlines, curves, rotations, multi-line text)
 *   - Exact roads & trails (`Line2D` with `position + points` transform & Ramer-Douglas-Peucker spline cleanup)
 *   - Exact symbols, trees & mountains with anchor offsets, custom colors, z-layers & smart CC0 asset swapping
 *   - Theme palette, coastal effects, scale bar, compass rose & ornamental frame
 */

import {
  cleanSourceRefLabel,
  createAssetSwapIndex,
  inferWorldGroupFromRef,
  pickVariantForInstance,
  resolveSwappedAsset,
  type AssetSwapEntry,
  type AssetSwapPolicy,
} from "@/engine/assetSwapEngine";
import {
  parseGodotColor,
  parseGodotPoolByteArray,
  parseGodotPoolVector2Array,
  parseGodotVector2,
  type GodotObject,
} from "@/engine/draftMapDecoder";
import { encodeMaskB64 } from "@/engine/worldEngine";
import { getWorldThemeById } from "@/engine/worldThemes";
import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type MapLayer,
  type ObjectStamp,
  type Point2D,
  type RgbRecolor,
  type VaultAsset,
  type WorldCoastalEffect,
  type WorldLabel,
  type WorldLabelCategory,
  type WorldRiver,
  type WorldTrail,
  type WorldTrailStyle,
} from "@/types/map";

export interface ExternalImportSummary {
  sourceFormat: "wonderdraft" | "dungeondraft";
  sourceFileName: string;
  originalWidthPx: number;
  originalHeightPx: number;
  targetWidthCells: number;
  targetHeightCells: number;
  levelCount: number;
  counts: {
    symbolsOrObjects: number;
    labels: number;
    trailsOrPaths: number;
    rivers: number;
    walls: number;
    portals: number;
    lights: number;
    waterRegions: number;
    roofs: number;
    hasHeightmap: boolean;
    hasGroundPaint: boolean;
  };
  swapEntries: AssetSwapEntry[];
  matchedExactCount: number;
  matchedCc0Count: number;
  fallbackCount: number;
}

export interface WonderdraftImportOptions {
  fileName: string;
  policy: AssetSwapPolicy;
  spreadVariants: boolean;
  importSymbols?: boolean;
  importLabels?: boolean;
  importPaths?: boolean;
  importGroundPaint?: boolean;
  targetWidthCells?: number;
  /** Manual user asset overrides keyed by original sourceRef -> target VaultAsset.id */
  overrides?: Record<string, string>;
}

interface ExtractedGodotImage {
  width: number;
  height: number;
  format: string;
  data: Uint8Array;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function extractGodotImage(val: unknown): ExtractedGodotImage | null {
  const rec = asRecord(val);
  if (!rec) return null;

  // Godot Object(Image) -> props.data.{width, height, format, data}
  let dataDict: Record<string, unknown> | null = null;
  if (rec._godotType === "Object") {
    const obj = rec as unknown as GodotObject;
    if (obj.className === "ImageTexture") {
      return extractGodotImage(obj.props.image);
    }
    dataDict = asRecord(obj.props?.data);
  } else if ("width" in rec && "height" in rec && "data" in rec) {
    dataDict = rec;
  } else if (rec.props) {
    dataDict = asRecord(asRecord(rec.props)?.data);
  }
  if (!dataDict) return null;

  const width = Math.round(asNum(dataDict.width, 0));
  const height = Math.round(asNum(dataDict.height, 0));
  const format = typeof dataDict.format === "string" ? dataDict.format : "RGBA8";
  const raw = parseGodotPoolByteArray(dataDict.data);
  if (!raw || width <= 0 || height <= 0) return null;
  return { width, height, format, data: raw };
}

function channelsPerPixel(format: string, byteLength: number, pixelCount: number): number {
  const f = format.toUpperCase();
  if (f === "RGBA8" || f === "RGBAH") return 4;
  if (f === "RGB8") return 3;
  if (f === "RG8" || f === "LA8") return 2;
  if (f === "L8" || f === "R8" || f === "A8") return 1;
  if (pixelCount > 0) {
    const ratio = Math.round(byteLength / pixelCount);
    if (ratio >= 1 && ratio <= 4) return ratio;
  }
  return 4;
}

/**
 * Downsamples Wonderdraft's RGBA8 `mask` image (`A` = landmass heightfield, `R` = freshwater
 * rivers & lakes) into our crisp `WorldMapData` masks.
 * Uses box-averaging for the landmass heightfield and max-pooling for freshwater so hairline
 * rivers stay 100% continuous!
 */
function extractMasksFromWonderdraft(
  rawData: Record<string, unknown>,
  mapW: number,
  mapH: number,
): { gridW: number; gridH: number; heightmapB64: string; freshwaterB64?: string; hasHeightmap: boolean } {
  const aspect = Math.max(0.4, Math.min(3.5, mapW / Math.max(1, mapH)));
  const gridW = Math.min(640, Math.max(240, Math.round(Math.min(mapW, 4800) / 7)));
  const gridH = Math.max(120, Math.round(gridW / aspect));
  const total = gridW * gridH;

  const maskImg = extractGodotImage(rawData.mask) ?? extractGodotImage(rawData.heightmap);
  if (maskImg) {
    const { width: sw, height: sh, format, data } = maskImg;
    const cpp = channelsPerPixel(format, data.byteLength, sw * sh);
    const hm = new Uint8Array(total);
    const fw = new Uint8Array(total);
    let fwCount = 0;

    const scaleX = sw / gridW;
    const scaleY = sh / gridH;
    const landCh = cpp === 4 ? 3 : 0; // Wonderdraft RGBA8 mask stores landmass elevation in Alpha (3)
    const hasFreshwaterCh = cpp === 4; // Wonderdraft RGBA8 mask stores freshwater/rivers in Red (0)

    for (let gy = 0; gy < gridH; gy++) {
      const sy0 = Math.floor(gy * scaleY);
      const sy1 = Math.min(sh, Math.max(sy0 + 1, Math.ceil((gy + 1) * scaleY)));
      const stepY = Math.max(1, Math.floor((sy1 - sy0) / 3));
      const rowOut = gy * gridW;

      for (let gx = 0; gx < gridW; gx++) {
        const sx0 = Math.floor(gx * scaleX);
        const sx1 = Math.min(sw, Math.max(sx0 + 1, Math.ceil((gx + 1) * scaleX)));
        const stepX = Math.max(1, Math.floor((sx1 - sx0) / 3));

        let sumLand = 0;
        let samples = 0;
        let maxFw = 0;

        for (let sy = sy0; sy < sy1; sy += stepY) {
          const sRow = sy * sw;
          for (let sx = sx0; sx < sx1; sx += stepX) {
            const p = (sRow + sx) * cpp;
            sumLand += data[p + landCh];
            if (hasFreshwaterCh) {
              const r = data[p];
              if (r > maxFw) maxFw = r;
            }
            samples++;
          }
        }

        const avgLand = samples > 0 ? Math.round(sumLand / samples) : 0;
        hm[rowOut + gx] = avgLand;
        if (hasFreshwaterCh && maxFw >= 96 && avgLand >= 96) {
          fw[rowOut + gx] = maxFw;
          fwCount++;
        }
      }
    }

    return {
      gridW,
      gridH,
      heightmapB64: encodeMaskB64(hm),
      freshwaterB64: fwCount > 0 ? encodeMaskB64(fw) : undefined,
      hasHeightmap: true,
    };
  }

  // Fallback empty ocean mask if save lacks embedded mask image
  const empty = new Uint8Array(total);
  return {
    gridW,
    gridH,
    heightmapB64: encodeMaskB64(empty),
    hasHeightmap: false,
  };
}

/**
 * Downsamples Wonderdraft's RGBA8 `ground` paint layer directly into a compact WebP/PNG data URL
 * without ever allocating a full 4546×3100 canvas!
 */
function encodeGroundPaintRaster(rawData: Record<string, unknown>): string | undefined {
  if (typeof document === "undefined") return undefined;
  const img = extractGodotImage(rawData.ground);
  if (!img) return undefined;

  const { width: sw, height: sh, format, data } = img;
  const cpp = channelsPerPixel(format, data.byteLength, sw * sh);
  if (cpp < 3) return undefined;

  const maxSide = 1440;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const dw = Math.max(64, Math.round(sw * scale));
  const dh = Math.max(64, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;

  const imgData = ctx.createImageData(dw, dh);
  const out = imgData.data;
  const rx = sw / dw;
  const ry = sh / dh;

  let nonZeroAlpha = 0;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y + 0.5) * ry));
    const sRow = sy * sw;
    const dRow = y * dw;
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x + 0.5) * rx));
      const sp = (sRow + sx) * cpp;
      const dp = (dRow + x) * 4;
      const a = cpp === 4 ? data[sp + 3] : 255;
      if (a > 4) nonZeroAlpha++;
      out[dp] = data[sp];
      out[dp + 1] = data[sp + 1];
      out[dp + 2] = data[sp + 2];
      out[dp + 3] = a;
    }
  }

  if (nonZeroAlpha === 0) return undefined;
  ctx.putImageData(imgData, 0, 0);

  try {
    const webp = canvas.toDataURL("image/webp", 0.86);
    if (webp.startsWith("data:image/webp")) return webp;
  } catch {
    // Fall back to PNG cleanly
  }
  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Ramer-Douglas-Peucker Polyline Simplification (keeps 900-pt Line2Ds editable!)
// ---------------------------------------------------------------------------

function perpDistSq(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return ex * ex + ey * ey;
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  const ex = p.x - px;
  const ey = p.y - py;
  return ex * ex + ey * ey;
}

function simplifyPolylineRdp(pts: Point2D[], epsilon: number): Point2D[] {
  if (pts.length <= 2) return pts;
  const epsSq = epsilon * epsilon;
  const keep = new Uint8Array(pts.length);
  keep[0] = 1;
  keep[pts.length - 1] = 1;

  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDistSq = -1;
    let maxIdx = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpDistSq(pts[i], pts[first], pts[last]);
      if (d > maxDistSq) {
        maxDistSq = d;
        maxIdx = i;
      }
    }
    if (maxDistSq > epsSq && maxIdx > first && maxIdx < last) {
      keep[maxIdx] = 1;
      stack.push([first, maxIdx], [maxIdx, last]);
    }
  }

  const out: Point2D[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (keep[i]) out.push(pts[i]);
  }
  return out;
}

function inferTrailStyleFromLine2D(props: Record<string, unknown>): WorldTrailStyle {
  const texObj = asRecord(props.texture);
  if (!texObj) return "solid";
  const tProps = asRecord(texObj.props);
  const sz = parseGodotVector2(tProps?.size);
  if (sz) {
    if (sz.x >= 44) return "dashed";
    if (sz.x >= 20 && sz.x <= 40) return "dotted";
  }
  return "dashed";
}

function inferLabelCategory(
  text: string,
  fontSizePx: number,
  colorHex: string,
): WorldLabelCategory {
  const low = text.toLowerCase();
  if (/\b(sea|ocean|bay|gulf|expanse|strait|channel|currents|sound|deeps)\b/.test(low)) {
    return "ocean";
  }
  if (/\b(river|brook|creek|stream|falls)\b/.test(low)) return "river";
  if (/\b(peak|mount|mountain|mountains|range|crag|ridge|hills|highlands|volcano)\b/.test(low)) {
    return "mountain";
  }
  if (fontSizePx >= 26) return "continent";
  if (fontSizePx >= 15 || text.includes("\n")) return "region";
  if (colorHex.toLowerCase() === "#1e3a5f") return "ocean";
  return "city";
}

function mapWonderdraftCoastalStyle(styleNum: number): WorldCoastalEffect {
  switch (styleNum) {
    case 1:
      return "ripples";
    case 2:
      return "wave_lines";
    case 3:
      return "hatch";
    case 4:
      return "stipple";
    default:
      return "soft_shadow";
  }
}

function blendHexColors(fgHex: string, bgHex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const parse = (h: string): [number, number, number] => {
    const clean = h.replace("#", "");
    return [
      parseInt(clean.slice(0, 2), 16) || 0,
      parseInt(clean.slice(2, 4), 16) || 0,
      parseInt(clean.slice(4, 6), 16) || 0,
    ];
  };
  const [fr, fg, fb] = parse(fgHex);
  const [br, bg, bb] = parse(bgHex);
  const toH = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toH(br + (fr - br) * a)}${toH(bg + (fg - bg) * a)}${toH(bb + (fb - bb) * a)}`;
}

function buildRecolorFromWonderdraftSymbol(
  sym: Record<string, unknown>,
  targetDrawMode: VaultAsset["drawMode"],
): RgbRecolor {
  const customMode = sym.custom_color_mode;
  const customCols = Array.isArray(sym.custom_colors) ? sym.custom_colors : null;
  const sampleCol = parseGodotColor(sym.sample);

  // Only drive 3-channel RGB replacement when the target CC0 sprite actually uses rgb_channels masks!
  // Otherwise, avoid blasting Wonderdraft's primary roof/accent swatch as a full-sprite neon tint over full-color towns.
  if (customCols && customCols.length >= 3 && targetDrawMode === "rgb_channels") {
    const c0 = parseGodotColor(customCols[0]);
    const c1 = parseGodotColor(customCols[1]);
    const c2 = parseGodotColor(customCols[2]);
    if (c0 || c1 || c2) {
      return {
        ...DEFAULT_RECOLOR,
        enabled: true,
        mode: "rgb_channels",
        tintHex: c0?.hex ?? DEFAULT_RECOLOR.tintHex,
        channelR: c0?.hex ?? DEFAULT_RECOLOR.channelR,
        channelG: c1?.hex ?? DEFAULT_RECOLOR.channelG,
        channelB: c2?.hex ?? DEFAULT_RECOLOR.channelB,
        strength: 0.85,
      };
    }
  }

  if (targetDrawMode === "sample_color") {
    const chosen = sampleCol ?? (customCols ? parseGodotColor(customCols[0]) : null);
    if (chosen) {
      return {
        ...DEFAULT_RECOLOR,
        enabled: true,
        mode: "tint",
        tintHex: chosen.hex,
        strength: 0.7,
      };
    }
  }

  // For full-color normal assets (e.g. trees/hills sampled from Wonderdraft ground biome),
  // apply a subtle harmonious biome tint rather than heavy monochrome colorization.
  if (sampleCol && customMode === 1) {
    return {
      ...DEFAULT_RECOLOR,
      enabled: true,
      mode: "tint",
      tintHex: sampleCol.hex,
      strength: 0.28,
    };
  }

  return { ...DEFAULT_RECOLOR };
}

// ---------------------------------------------------------------------------
// Main Wonderdraft Importer Entrypoint
// ---------------------------------------------------------------------------

export function importWonderdraftMapData(
  rawData: Record<string, unknown>,
  vaultAssets: VaultAsset[],
  options: WonderdraftImportOptions,
): { doc: DcMapDocument; summary: ExternalImportSummary } {
  const origW = Math.max(256, asNum(rawData.map_width, 4096));
  const origH = Math.max(256, asNum(rawData.map_height, 2816));
  const widthCells = options.targetWidthCells ?? 48;
  const heightCells = Math.max(16, Math.round((widthCells * origH) / origW));

  const pxToCellX = widthCells / origW;
  const pxToCellY = heightCells / origH;
  const avgPxPerCell = origW / widthCells;
  const fontScaleTo32 = (widthCells * 32) / origW;

  const swapIndex = createAssetSwapIndex(vaultAssets, options.policy);
  const overrides = options.overrides ?? {};
  const assetById = new Map(vaultAssets.map((a) => [a.id, a]));

  // 1. Landmass Heightmap & Freshwater Mask
  const masks = extractMasksFromWonderdraft(rawData, origW, origH);

  // 2. Ground Painted Biome Raster
  const biomeRasterB64 =
    options.importGroundPaint !== false ? encodeGroundPaintRaster(rawData) : undefined;

  // 3. Theme Extraction
  const wdTheme = asRecord(rawData.theme);
  const wdTexName = typeof wdTheme?.water_texture === "string" ? wdTheme.water_texture.toLowerCase() : "";
  const baseThemeId =
    wdTexName.includes("paper") || wdTexName.includes("parchment")
      ? "parchment"
      : wdTexName.includes("ink") || wdTexName.includes("feudal")
        ? "ink_wash"
        : "aged_antique";
  const baseTheme = getWorldThemeById(baseThemeId);
  const landOutCol = parseGodotColor(wdTheme?.landmass_outline_color);
  const coastFxCol = parseGodotColor(wdTheme?.coastline_color);
  const fwCol = parseGodotColor(wdTheme?.freshwater_color);
  const fwRimCol = parseGodotColor(wdTheme?.freshwater_outline_color);
  const pathCol = parseGodotColor(wdTheme?.path_color);
  const groundColors = Array.isArray(wdTheme?.ground_colors) ? wdTheme!.ground_colors : [];
  const firstGroundCol = parseGodotColor(groundColors[0]);

  const resolvedLandBaseHex = firstGroundCol?.hex ?? baseTheme.landBaseColorHex;
  const resolvedFreshwaterHex = fwCol
    ? fwCol.alpha < 0.92
      ? blendHexColors(fwCol.hex, resolvedLandBaseHex, fwCol.alpha)
      : fwCol.hex
    : baseTheme.freshwaterColorHex;

  const theme = {
    ...baseTheme,
    landBaseColorHex: resolvedLandBaseHex,
    coastlineInkHex: landOutCol?.hex ?? baseTheme.coastlineInkHex,
    coastalEffect: mapWonderdraftCoastalStyle(Math.round(asNum(wdTheme?.coastline_style, 0))),
    coastalEffectColorHex: coastFxCol?.hex ?? baseTheme.coastalEffectColorHex,
    freshwaterColorHex: resolvedFreshwaterHex,
    freshwaterRimHex: fwRimCol?.hex ?? baseTheme.freshwaterRimHex,
    vignetteStrength: Math.max(0.24, Math.min(0.88, asNum(wdTheme?.vignette_strength, 0.65) * 0.85)),
    defaultTrailColorHex: pathCol?.hex ?? baseTheme.defaultTrailColorHex,
  };

  // 4. Paths / Trails (Godot Line2D objects or plain JSON paths)
  const trails: WorldTrail[] = [];
  const rawPaths = Array.isArray(rawData.paths) ? rawData.paths : [];
  if (options.importPaths !== false) {
    for (let i = 0; i < rawPaths.length; i++) {
      const item = asRecord(rawPaths[i]);
      if (!item) continue;
      const props = item._godotType === "Object" ? asRecord(item.props) : item;
      if (!props) continue;
      if (props.visible === false) continue;

      const offset = parseGodotVector2(props.position) ?? { x: 0, y: 0 };
      const rawPts = parseGodotPoolVector2Array(props.points);
      if (rawPts.length < 2) continue;

      const cellPts: Point2D[] = rawPts.map((pt) => ({
        x: (pt.x + offset.x) * pxToCellX,
        y: (pt.y + offset.y) * pxToCellY,
      }));
      const simplified = cellPts.length > 18 ? simplifyPolylineRdp(cellPts, 0.08) : cellPts;
      if (simplified.length < 2) continue;

      const startW = asNum(props.start_width ?? props.width, 6);
      const widthC = Math.max(0.04, Math.min(0.45, startW / avgPxPerCell));
      const col = parseGodotColor(props.default_color ?? props.color);

      trails.push({
        id: `wd-trail-${i + 1}`,
        points: simplified,
        style: inferTrailStyleFromLine2D(props),
        widthCells: widthC,
        colorHex: col?.hex ?? theme.defaultTrailColorHex,
        dashScale: 1.0,
        curved: rawPts.length <= 16,
        opacity: col ? Math.max(0.25, col.alpha) : 0.88,
      });
    }
  }

  // 5. Optional separate Rivers array (if present in extracted JSON saves)
  const rivers: WorldRiver[] = [];
  const rawRivers = Array.isArray(rawData.rivers) ? rawData.rivers : [];
  for (let i = 0; i < rawRivers.length; i++) {
    const rv = asRecord(rawRivers[i]);
    if (!rv) continue;
    const rawPts = parseGodotPoolVector2Array(rv.points);
    if (rawPts.length < 2) continue;
    const cellPts = rawPts.map((pt) => ({ x: pt.x * pxToCellX, y: pt.y * pxToCellY }));
    const wPx = asNum(rv.width, 10);
    rivers.push({
      id: `wd-river-${i + 1}`,
      points: cellPts.length > 24 ? simplifyPolylineRdp(cellPts, 0.09) : cellPts,
      startWidthCells: Math.max(0.04, (wPx * 0.45) / avgPxPerCell),
      endWidthCells: Math.max(0.09, (wPx * 1.4) / avgPxPerCell),
      meanderRoughness: Math.max(0, Math.min(1, asNum(rv.roughness, 0.35))),
      meanderScale: 0.9,
      curved: true,
      seed: 100 + i * 17,
      fadeMouth: true,
      fadeSource: true,
      clipToLand: true,
    });
  }

  // 6. Labels (201+ exact campaign place names!)
  const labels: WorldLabel[] = [];
  const rawLabels = Array.isArray(rawData.labels) ? rawData.labels : [];
  if (options.importLabels !== false) {
    for (let i = 0; i < rawLabels.length; i++) {
      const lb = asRecord(rawLabels[i]);
      if (!lb) continue;
      const text = typeof lb.text === "string" ? lb.text.trim() : "";
      if (!text) continue;
      const pos = parseGodotVector2(lb.position);
      if (!pos) continue;

      const rawSize = asNum(lb.size, 32);
      const fontSizePx = Math.max(5.5, Math.min(72, Math.round(rawSize * fontScaleTo32 * 10) / 10));
      const col = parseGodotColor(lb.color);
      const outCol = parseGodotColor(lb.outline_color);
      const outlineSize = Math.max(0, Math.min(6, asNum(lb.outline_size, 2) * fontScaleTo32 * 1.1));
      const rotRad = asNum(lb.rotation, 0);
      const curveVal = asNum(lb.curve, 0);

      labels.push({
        id: `wd-lbl-${i + 1}`,
        text,
        x: pos.x * pxToCellX,
        y: pos.y * pxToCellY,
        category: inferLabelCategory(text, fontSizePx, col?.hex ?? "#1E160F"),
        fontFamily:
          typeof lb.font === "string" && lb.font.trim()
            ? `"${lb.font.trim()}", ${theme.fontFamilyBody}`
            : theme.fontFamilyBody,
        fontSizePx,
        colorHex: col?.hex ?? theme.labelColorHex,
        outlineColorHex: outCol?.hex ?? theme.labelOutlineHex,
        outlineWidth: Math.round(outlineSize * 10) / 10,
        letterSpacing: fontSizePx >= 24 ? 1.8 : 0.4,
        italic: false,
        bold: fontSizePx >= 14,
        uppercase: false,
        rotationDeg: Math.round(((rotRad * 180) / Math.PI) * 10) / 10,
        curveBend: Math.max(-1, Math.min(1, curveVal)),
        boxStyle: "none",
        opacity: col ? Math.max(0.2, col.alpha) : 0.96,
      });
    }
  }

  // 7. Symbols, Trees & Mountains (with Smart CC0 Asset Swapping & Z-Layer Grouping)
  const swapMap = new Map<string, AssetSwapEntry>();
  const instanceCounter = new Map<string, number>();

  const underlayObjs: ObjectStamp[] = [];
  const mainObjs: ObjectStamp[] = [];
  const overheadObjs: ObjectStamp[] = [];

  const rawSymbols = Array.isArray(rawData.symbols) ? rawData.symbols : [];
  if (options.importSymbols !== false) {
    for (let i = 0; i < rawSymbols.length; i++) {
      const sym = asRecord(rawSymbols[i]);
      if (!sym) continue;
      const sourceRef = typeof sym.texture === "string" ? sym.texture : "";
      const pos = parseGodotVector2(sym.position);
      if (!sourceRef || !pos) continue;

      const wdType = typeof sym.type === "string" ? sym.type.toLowerCase() : "symbol";
      const customMode = sym.custom_color_mode;
      const expectedDrawMode: VaultAsset["drawMode"] | undefined =
        customMode === 2 ? "rgb_channels" : customMode === 1 ? "sample_color" : undefined;
      const expectedGroup = inferWorldGroupFromRef(sourceRef, wdType);

      let entry = swapMap.get(sourceRef);
      if (!entry) {
        const overrideId = overrides[sourceRef];
        const overrideAsset = overrideId ? assetById.get(overrideId) : undefined;
        if (overrideAsset) {
          entry = {
            sourceRef,
            sourceLabel: cleanSourceRefLabel(sourceRef),
            expectedCategory: "symbol",
            expectedWorldGroup: expectedGroup,
            targetAssetId: overrideAsset.id,
            targetDisplayName: overrideAsset.displayName,
            targetThumbUrl: overrideAsset.thumbUrl,
            variantIds: [overrideAsset.id],
            confidence: "exact",
            count: 0,
          };
        } else {
          const resolved = resolveSwappedAsset(swapIndex, {
            sourceRef,
            expectedCategory: "symbol",
            expectedWorldGroup: expectedGroup,
            expectedDrawMode,
            wdTypeHint: wdType,
          });
          if (!resolved.asset) continue;
          entry = {
            sourceRef,
            sourceLabel: cleanSourceRefLabel(sourceRef),
            expectedCategory: "symbol",
            expectedWorldGroup: expectedGroup,
            targetAssetId: resolved.asset.id,
            targetDisplayName: resolved.asset.displayName,
            targetThumbUrl: resolved.asset.thumbUrl,
            variantIds: resolved.variantIds,
            confidence: resolved.confidence,
            count: 0,
          };
        }
        swapMap.set(sourceRef, entry);
      }

      const instIdx = instanceCounter.get(sourceRef) ?? 0;
      instanceCounter.set(sourceRef, instIdx + 1);
      entry.count++;

      const chosenAssetId = pickVariantForInstance(
        entry.targetAssetId,
        entry.variantIds,
        sourceRef,
        instIdx,
        options.spreadVariants && entry.confidence !== "exact" && (wdType === "tree" || wdType === "mountain"),
      );
      const targetAsset = assetById.get(chosenAssetId) ?? assetById.get(entry.targetAssetId);

      const scaleVec = parseGodotVector2(sym.scale);
      const sx = Math.abs(scaleVec ? scaleVec.x : asNum(sym.scale, 1));
      const sy = Math.abs(scaleVec ? scaleVec.y : sx);
      const mirror = Boolean(sym.mirror);
      const off = parseGodotVector2(sym.offset) ?? { x: 0, y: 0 };
      const radiusPx = Math.max(8, asNum(sym.radius, 64));

      // Apply Wonderdraft anchor offset in original pixel coordinates before scaling to cells
      const cxPx = pos.x + (mirror ? -off.x : off.x) * sx;
      const cyPx = pos.y + off.y * sy;

      // Preserve visual footprint cleanly whether exact-matched or swapped to CC0 asset
      const aspectRatio =
        targetAsset && targetAsset.widthPx > 0
          ? Math.max(0.35, Math.min(2.8, targetAsset.heightPx / targetAsset.widthPx))
          : 1;
      let widthC: number;
      let heightC: number;
      if (entry.confidence === "exact" && targetAsset && targetAsset.widthPx > 0) {
        widthC = (targetAsset.widthPx * sx) / avgPxPerCell;
        heightC = (targetAsset.heightPx * sy) / avgPxPerCell;
      } else {
        const footprintPx = radiusPx * 2.25 * sx;
        widthC = footprintPx / avgPxPerCell;
        heightC = widthC * aspectRatio * (sy / Math.max(0.01, sx));
      }

      // Ground-crack / fissure overlays in Wonderdraft have wide transparent padding around hairline cracks;
      // gently tighten footprint and soften opacity when swapped to shaded canyon chasms!
      const isGroundCrack = /cracked[-_]?earth|fissure/i.test(sourceRef) && entry.confidence !== "exact";
      if (isGroundCrack) {
        widthC = Math.min(1.2, widthC * 0.42);
        heightC = Math.min(1.2, heightC * 0.42);
      }

      widthC = Math.max(0.16, Math.min(14, Math.round(widthC * 1000) / 1000));
      heightC = Math.max(0.16, Math.min(14, Math.round(heightC * 1000) / 1000));

      const zIdx = Math.round(asNum(sym.z_index, 0));
      const stamp: ObjectStamp = {
        id: `wd-sym-${i + 1}`,
        assetId: chosenAssetId,
        x: Math.round(cxPx * pxToCellX * 1000) / 1000,
        y: Math.round(cyPx * pxToCellY * 1000) / 1000,
        widthCells: widthC,
        heightCells: heightC,
        rotationRad: asNum(sym.rotation, 0),
        flipX: mirror,
        flipY: false,
        opacity: isGroundCrack ? 0.58 : 1,
        castsShadow: wdType !== "tree" && !isGroundCrack && widthC >= 0.45,
        locked: false,
        recolor: buildRecolorFromWonderdraftSymbol(sym, targetAsset?.drawMode ?? "normal"),
        zOrder: zIdx * 100 + (isGroundCrack ? 2 : wdType === "mountain" ? 10 : wdType === "tree" ? 12 : 14),
        importedSourceRef: sourceRef,
      };

      if (zIdx < 0) underlayObjs.push(stamp);
      else if (zIdx > 0) overheadObjs.push(stamp);
      else mainObjs.push(stamp);
    }
  }

  // 8. Scale Bar & Frame Overlays
  const wdScale = asRecord(rawData.scale);
  const scalePos = parseGodotVector2(wdScale?.position);
  const segDist = asNum(wdScale?.segment_distance, 100);
  const segCount = Math.max(2, Math.min(6, Math.round(asNum(wdScale?.segments, 3))));
  const scaleSize = parseGodotVector2(wdScale?.size);
  const scaleBarWidthCells = scaleSize ? Math.max(1.5, scaleSize.x * pxToCellX) : 4.5;
  const milesPerCell = Math.max(1, Math.round((segDist * segCount) / scaleBarWidthCells));

  const wdFrame = asRecord(rawData.frame);
  const frameEnabled = wdFrame ? wdFrame.enabled !== false : true;

  // 9. Assemble Organized World Atlas Layers
  const layers: MapLayer[] = [];
  if (underlayObjs.length > 0) {
    layers.push({
      id: "layer-wd-underlay",
      name: "Imported Underlay & Sea Features (Z < 0)",
      kind: "objects",
      visible: true,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId: "lvl-world",
      objects: underlayObjs,
    });
  }
  layers.push({
    id: "layer-wd-symbols",
    name: "Imported Mountains, Forests & Settlements",
    kind: "objects",
    visible: true,
    locked: false,
    dmOnly: false,
    opacity: 1,
    blendMode: "normal",
    levelId: "lvl-world",
    objects: mainObjs,
  });
  if (overheadObjs.length > 0) {
    layers.push({
      id: "layer-wd-overhead",
      name: "Imported Overhead, Clouds & Landmarks (Z > 0)",
      kind: "objects",
      visible: true,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId: "lvl-world",
      objects: overheadObjs,
    });
  }
  layers.push({
    id: "layer-wd-dm-notes",
    name: "DM Campaign Notes",
    kind: "dm_notes",
    visible: true,
    locked: false,
    dmOnly: true,
    opacity: 1,
    blendMode: "normal",
    levelId: "lvl-world",
    dmNotes: [],
  });

  const cleanTitle = options.fileName
    .replace(/\.(wonderdraft_map|json)$/i, "")
    .replace(/[_]+/g, " ")
    .trim() || "Imported World Atlas";

  const now = new Date().toISOString();
  const doc: DcMapDocument = {
    schemaVersion: "1.0.0",
    id: `map-wd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mode: "world",
    meta: {
      title: `${cleanTitle} (Imported)`,
      author: "Wonderdraft Import · Dice Chaos Compass",
      createdAt: now,
      updatedAt: now,
    },
    canvas: {
      widthCells,
      heightCells,
      ppi: 128,
      baseTerrainAssetId: theme.landTextureAssetId || "world-atlas-cc0/textures/hq_antique_vellum_paper.jpg",
      grid: {
        type: "none",
        visible: false,
        colorHex: theme.coastlineInkHex,
        opacity: 0.16,
      },
    },
    levels: [
      {
        id: "lvl-world",
        shortCode: "MAP",
        name: "World Surface",
        kind: "ground",
        elevationFt: 0,
        visible: true,
      },
    ],
    activeLevelId: "lvl-world",
    layers,
    activeLayerId: "layer-wd-symbols",
    lighting: {
      enabled: false,
      activePresetId: "day",
      ambientColorHex: "#FFFDF6",
      ambientIntensity: 1,
      shadowSoftness: 0.35,
      presets: [
        { id: "day", name: "Daylight Atlas", ambientColorHex: "#FFFDF6", ambientIntensity: 1 },
      ],
    },
    world: {
      themeId: theme.id,
      theme,
      gridW: masks.gridW,
      gridH: masks.gridH,
      heightmapB64: masks.heightmapB64,
      freshwaterB64: masks.freshwaterB64,
      biomeRasterB64,
      seaLevel: Math.round(asNum(rawData.water_level, 0.5) * 255),
      seed: 4201,
      coastlineRoughness: 0.14, // Keep imported Wonderdraft coastline faithful without heavy extra noise!
      biomeStrokes: [],
      rivers,
      trails,
      regions: [],
      labels,
      subMapPins: [],
      overlays: {
        compass: {
          visible: false,
          x: 5.5,
          y: heightCells - 5.5,
          scale: 1.0,
          assetId: "world-atlas-cc0/cartography/cart_compass_starburst_01.png",
          rotationDeg: 0,
          showRhumbLines: false,
          rhumbOpacity: 0.12,
        },
        scaleBar: {
          visible: Boolean(wdScale),
          x: scalePos ? Math.max(2, Math.min(widthCells - 2, scalePos.x * pxToCellX)) : 10,
          y: scalePos ? Math.max(2, Math.min(heightCells - 2, scalePos.y * pxToCellY)) : heightCells - 4,
          unit: "miles",
          milesPerCell,
          segments: segCount,
          style: "classic",
        },
        grid: {
          style: "none",
          cellSizeCells: 2,
          opacity: 0.16,
          colorHex: theme.coastlineInkHex,
          showCoords: false,
        },
        frame: {
          style: frameEnabled ? "stepped_ivory" : "none",
          colorHex: "#ECE1C5",
          widthPx: 3,
        },
        travelMode: "horse",
      },
    },
  };

  const swapEntries = Array.from(swapMap.values()).sort((a, b) => b.count - a.count);
  let matchedExactCount = 0;
  let matchedCc0Count = 0;
  let fallbackCount = 0;
  for (const e of swapEntries) {
    if (e.confidence === "exact") matchedExactCount += e.count;
    else if (e.confidence === "high" || e.confidence === "medium") matchedCc0Count += e.count;
    else fallbackCount += e.count;
  }

  return {
    doc,
    summary: {
      sourceFormat: "wonderdraft",
      sourceFileName: options.fileName,
      originalWidthPx: Math.round(origW),
      originalHeightPx: Math.round(origH),
      targetWidthCells: widthCells,
      targetHeightCells: heightCells,
      levelCount: 1,
      counts: {
        symbolsOrObjects: underlayObjs.length + mainObjs.length + overheadObjs.length,
        labels: labels.length,
        trailsOrPaths: trails.length,
        rivers: rivers.length,
        walls: 0,
        portals: 0,
        lights: 0,
        waterRegions: 0,
        roofs: 0,
        hasHeightmap: masks.hasHeightmap,
        hasGroundPaint: Boolean(biomeRasterB64),
      },
      swapEntries,
      matchedExactCount,
      matchedCc0Count,
      fallbackCount,
    },
  };
}

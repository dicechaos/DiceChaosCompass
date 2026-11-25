/**
 * High-Craft Wonderdraft-Parity Canvas2D Renderer for Dice Chaos Maps v1.5 World Atlas Studio.
 *
 * Architecture:
 * 1. Cached Hybrid SDF Landmass + Ocean Plate (2-pass Chamfer SDF at crisp resolution):
 *    - Organic fractal coastlines + anti-aliased ink shoreline
 *    - 5 Coastal Effects: Concentric Ripples, Engraved Wave Lines, Ink Stipple, Lagoon Glow, Feudal Hatch
 *    - Ocean depth gradient, coastal stain, inner landmass relief vignette, and freshwater inland lakes
 *    - Seamless tiled paper & ocean textures + Land-Clipped Watercolor Biome Strokes
 * 2. Coastline-clipped Political Regions, Meandering Tapered Rivers, 7 Overland Trail & Sea Lane styles
 * 3. Windrose Rhumb Lines & Overland Hex / Square / Lat-Lon Grids (with optional hex-crawl coords)
 * 4. Y-sorted 2.5D World Symbols (with normal / sample_color / tint / rgb_channels shader support)
 * 5. Curved Arc Cartographic Labels & Hand-Inked Scroll / Banner / Ribbon / Plaque Cartouches
 * 6. Compass Rose, Calibrated Scale Bar (Miles / Km / Leagues), Sub-Map Pins & 6 Ornamental Map Frames
 */

import { getProcessedTexture } from "@/engine/colorShader";
import { sampleCatmullRom } from "@/engine/geometry";
import {
  resolveAssetUrl,
  texturePool,
  type RenderOptions,
  type WorldViewportCells,
} from "@/engine/sceneRenderer";
import {
  buildMeanderingRiverGeometry,
  decodeMaskB64Cached,
  isPointOnLand,
} from "@/engine/worldEngine";
import type {
  DcMapDocument,
  DmNotePin,
  ObjectStamp,
  Point2D,
  VaultAsset,
  WorldLabel,
  WorldMapData,
  WorldRegion,
  WorldTrail,
} from "@/types/map";

// ---------------------------------------------------------------------------
// Fast Tileable 256x256 Deterministic Value-Noise LUT (built once)
// ---------------------------------------------------------------------------

const NOISE_LUT_SIZE = 256;
let noiseLut: Float32Array | null = null;

function getNoiseLut(): Float32Array {
  if (noiseLut) return noiseLut;
  const lut = new Float32Array(NOISE_LUT_SIZE * NOISE_LUT_SIZE);
  // Tileable coarse + fine smooth value noise
  const hash = (x: number, y: number, s: number) => {
    const wx = ((x % 32) + 32) % 32;
    const wy = ((y % 32) + 32) % 32;
    let n = Math.imul(wx, 374761393) + Math.imul(wy, 668265263) + Math.imul(s, 1442695041);
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  };
  const samplePeriodic = (u: number, v: number, freq: number, seed: number) => {
    const x = u * freq;
    const y = v * freq;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const wrap = (k: number) => ((k % freq) + freq) % freq;
    const a = hash(wrap(ix), wrap(iy), seed);
    const b = hash(wrap(ix + 1), wrap(iy), seed);
    const c = hash(wrap(ix), wrap(iy + 1), seed);
    const d = hash(wrap(ix + 1), wrap(iy + 1), seed);
    return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
  };

  for (let y = 0; y < NOISE_LUT_SIZE; y++) {
    const v = y / NOISE_LUT_SIZE;
    for (let x = 0; x < NOISE_LUT_SIZE; x++) {
      const u = x / NOISE_LUT_SIZE;
      const n1 = samplePeriodic(u, v, 8, 101);
      const n2 = samplePeriodic(u, v, 16, 202);
      const n3 = samplePeriodic(u, v, 32, 303);
      lut[y * NOISE_LUT_SIZE + x] = n1 * 0.52 + n2 * 0.31 + n3 * 0.17;
    }
  }
  noiseLut = lut;
  return lut;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = (hex || "#888888").replace("#", "").trim();
  const full = c.length === 3 ? c.split("").map((ch) => ch + ch).join("") : c;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [140, 140, 140];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------------------
// Continuous Zoom-Invariant World-Space Noise & Bicubic Heightfield Sampling
// ---------------------------------------------------------------------------

function sampleLutBilinear(lut: Float32Array, u: number, v: number): number {
  const ix = Math.floor(u);
  const iy = Math.floor(v);
  const fx = u - ix;
  const fy = v - iy;
  const x0 = ix & 255;
  const y0 = iy & 255;
  const x1 = (x0 + 1) & 255;
  const y1 = (y0 + 1) & 255;
  const r0 = y0 << 8;
  const r1 = y1 << 8;
  const a = lut[r0 + x0];
  const b = lut[r0 + x1];
  const c = lut[r1 + x0];
  const d = lut[r1 + x1];
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

function catmullRom1D(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function sampleGridBicubic(
  arr: Uint8Array,
  gridW: number,
  gridH: number,
  gx: number,
  gy: number,
): number {
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  const fx = gx - ix;
  const fy = gy - iy;
  const clampX = (k: number) => (k < 0 ? 0 : k >= gridW ? gridW - 1 : k);
  const clampY = (k: number) => (k < 0 ? 0 : k >= gridH ? gridH - 1 : k);

  const x0 = clampX(ix - 1);
  const x1 = clampX(ix);
  const x2 = clampX(ix + 1);
  const x3 = clampX(ix + 2);

  let rowVals0 = 0;
  let rowVals1 = 0;
  let rowVals2 = 0;
  let rowVals3 = 0;
  for (let r = -1; r <= 2; r++) {
    const rowOff = clampY(iy + r) * gridW;
    const v = catmullRom1D(arr[rowOff + x0], arr[rowOff + x1], arr[rowOff + x2], arr[rowOff + x3], fx);
    if (r === -1) rowVals0 = v;
    else if (r === 0) rowVals1 = v;
    else if (r === 1) rowVals2 = v;
    else rowVals3 = v;
  }
  const out = catmullRom1D(rowVals0, rowVals1, rowVals2, rowVals3, fy);
  return out < 0 ? 0 : out > 255 ? 255 : out;
}

// ---------------------------------------------------------------------------
// Cached Viewport-Adaptive Infinite-Zoom Hybrid SDF Landmass + Ocean + Biome Plate
// ---------------------------------------------------------------------------

interface CachedWorldBasePlate {
  key: string;
  docSig: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
  height: number;
  pxPerCell: number;
  plateCanvas: HTMLCanvasElement;
  landMaskCanvas: HTMLCanvasElement;
}

let cachedOverviewPlate: CachedWorldBasePlate | null = null;
let cachedDetailPlate: CachedWorldBasePlate | null = null;
let scratchRegionCanvas: HTMLCanvasElement | null = null;
let scratchRiverCanvas: HTMLCanvasElement | null = null;
let cachedRegionPlateKey = "";
let cachedRiverPlateKey = "";
let scratchPaintOverlayCanvas: HTMLCanvasElement | null = null;
let scratchOceanImgData: ImageData | null = null;
let scratchLandMaskImgData: ImageData | null = null;
let scratchCoastInkImgData: ImageData | null = null;

export function getCachedWorldOverviewCanvas(): HTMLCanvasElement | null {
  return cachedOverviewPlate?.plateCanvas ?? null;
}

// Pooled SDF typed buffers so plate rebuilds during sculpt/zoom incur ZERO GC spikes!
let poolCapacity = 0;
let poolLandBin = new Uint8Array(0);
let poolFwBin = new Uint8Array(0);
let poolDOut = new Uint16Array(0);
let poolDIn = new Uint16Array(0);
let poolDFw = new Uint16Array(0);

function acquireSdfPools(totalPx: number) {
  if (totalPx > poolCapacity) {
    poolCapacity = totalPx;
    poolLandBin = new Uint8Array(totalPx);
    poolFwBin = new Uint8Array(totalPx);
    poolDOut = new Uint16Array(totalPx);
    poolDIn = new Uint16Array(totalPx);
    poolDFw = new Uint16Array(totalPx);
  } else {
    poolLandBin.fill(0, 0, totalPx);
    poolFwBin.fill(0, 0, totalPx);
  }
  return { landBin: poolLandBin, fwBin: poolFwBin, dOut: poolDOut, dIn: poolDIn, dFw: poolDFw };
}

// Cached WeakMaps & LRU meshes so pan/zoom frames NEVER re-stringify themes, re-sort 1,157 symbols, or rebuild rivers!
const themeSigCache = new WeakMap<WorldMapData["theme"], string>();
function getThemeSig(theme: WorldMapData["theme"]): string {
  let sig = themeSigCache.get(theme);
  if (!sig) {
    sig = JSON.stringify(theme);
    themeSigCache.set(theme, sig);
  }
  return sig;
}

interface CachedRiverMesh {
  geom: ReturnType<typeof buildMeanderingRiverGeometry>;
  shoreIdx: number;
  enteredWater: boolean;
}
const riverMeshCache = new Map<string, CachedRiverMesh>();
const MAX_RIVER_CACHE = 80;

interface SortedSymbolEntry {
  obj: ObjectStamp;
  layerOpacity: number;
  layerBlendMode: string;
  layerIdx: number;
}
const sortedSymbolsCache = new WeakMap<DcMapDocument["layers"], { dm: SortedSymbolEntry[]; player: SortedSymbolEntry[] }>();
const trailSampleCache = new WeakMap<WorldTrail, { curved: boolean; pts: Point2D[] }>();

export function invalidateWorldRenderCache(): void {
  cachedOverviewPlate = null;
  cachedDetailPlate = null;
  cachedRegionPlateKey = "";
  cachedRiverPlateKey = "";
  riverMeshCache.clear();
}

function computeBiomeSignature(world: WorldMapData): string {
  if (world.biomeStrokes.length === 0) return "0";
  let h = world.biomeStrokes.length * 31;
  for (let i = 0; i < world.biomeStrokes.length; i++) {
    const s = world.biomeStrokes[i];
    h = (Math.imul(h, 31) + s.points.length + Math.round(s.radiusCells * 10) + Math.round(s.opacity * 100)) | 0;
    const tCode = s.target === "ocean" ? 2 : s.target === "both" ? 3 : 1;
    const pCode = s.pattern === "stipple" ? 7 : 1;
    h = (Math.imul(h, 17) + tCode * pCode + (s.colorHex.charCodeAt(1) || 0) + (s.colorHex.charCodeAt(3) || 0) + (s.colorHex.charCodeAt(5) || 0)) | 0;
  }
  const last = world.biomeStrokes[world.biomeStrokes.length - 1];
  return `${world.biomeStrokes.length}:${h}:${last.id}:${last.colorHex}:${last.target ?? "land"}`;
}

function buildWorldPlateRegion(
  doc: DcMapDocument,
  world: WorldMapData,
  docSig: string,
  oceanImg: HTMLImageElement | null,
  landImg: HTMLImageElement | null,
  biomeRasterImg: HTMLImageElement | null,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  plateW: number,
  plateH: number,
  reuseSlot: CachedWorldBasePlate | null,
): CachedWorldBasePlate | null {
  const plateCanvas = reuseSlot?.plateCanvas ?? document.createElement("canvas");
  plateCanvas.width = plateW;
  plateCanvas.height = plateH;
  const pctx = plateCanvas.getContext("2d");

  const landMaskCanvas = reuseSlot?.landMaskCanvas ?? document.createElement("canvas");
  landMaskCanvas.width = plateW;
  landMaskCanvas.height = plateH;
  const mctx = landMaskCanvas.getContext("2d");

  if (!pctx || !mctx) return null;

  const wCells = Math.max(1, doc.canvas.widthCells);
  const hCells = Math.max(1, doc.canvas.heightCells);
  const spanX = Math.max(0.05, x1 - x0);
  const spanY = Math.max(0.05, y1 - y0);
  const sx = plateW / spanX;
  const sy = plateH / spanY;
  const pxPerCell = (sx + sy) * 0.5;
  const useBicubic = pxPerCell > 52;

  const { gridW, gridH, seaLevel, theme } = world;
  const totalGrid = gridW * gridH;
  const hm = decodeMaskB64Cached(world.heightmapB64, totalGrid);
  const fw = world.freshwaterB64 ? decodeMaskB64Cached(world.freshwaterB64, totalGrid) : null;
  const lut = getNoiseLut();

  const totalPx = plateW * plateH;
  const { landBin, fwBin, dOut, dIn, dFw } = acquireSdfPools(totalPx);
  const roughAmp = Math.max(0, Math.min(1, world.coastlineRoughness)) * 12.0;
  const seedOffX = ((world.seed * 37) & 255);
  const seedOffY = ((world.seed * 91) & 255);

  // Step 1: Zoom-invariant heightfield upsampling (bicubic when zoomed in!) + continuous world-space fractal coastlines!
  const invWCells = (gridW - 1) / wCells;
  const invHCells = (gridH - 1) / hCells;

  for (let y = 0; y < plateH; y++) {
    const wy = y0 + (y + 0.5) / sy;
    const gy = Math.max(0, Math.min(gridH - 1, wy * invHCells));
    const y0i = Math.floor(gy);
    const y1i = Math.min(gridH - 1, y0i + 1);
    const fy = gy - y0i;
    const row0 = y0i * gridW;
    const row1 = y1i * gridW;
    const pRow = y * plateW;

    const wyM1 = wy * 7.2 + seedOffY;
    const wyM2 = wy * 21.5 + seedOffY * 1.9;
    const wyM3 = wy * 56.0 + seedOffY * 3.1;

    for (let x = 0; x < plateW; x++) {
      const wx = x0 + (x + 0.5) / sx;
      const gx = Math.max(0, Math.min(gridW - 1, wx * invWCells));

      let h: number;
      if (useBicubic) {
        h = sampleGridBicubic(hm, gridW, gridH, gx, gy);
      } else {
        const x0i = Math.floor(gx);
        const x1i = Math.min(gridW - 1, x0i + 1);
        const fx = gx - x0i;
        h =
          (hm[row0 + x0i] * (1 - fx) + hm[row0 + x1i] * fx) * (1 - fy) +
          (hm[row1 + x0i] * (1 - fx) + hm[row1 + x1i] * fx) * fy;
      }

      // 3-octave zoom-invariant world-space fractal shoreline detail!
      const m1 = sampleLutBilinear(lut, wx * 7.2 + seedOffX, wyM1);
      const m2 = sampleLutBilinear(lut, wx * 21.5 + seedOffX * 2.3, wyM2);
      const m3 = pxPerCell > 45 ? sampleLutBilinear(lut, wx * 56.0 + seedOffX * 3.7, wyM3) : 0.5;
      const micro = (m1 * 0.54 + m2 * 0.30 + m3 * 0.16 - 0.5) * roughAmp;

      const isL = h + micro >= seaLevel ? 1 : 0;
      const idx = pRow + x;
      landBin[idx] = isL;

      if (isL && fw) {
        let fv: number;
        if (useBicubic) {
          fv = sampleGridBicubic(fw, gridW, gridH, gx, gy);
        } else {
          const x0i = Math.floor(gx);
          const x1i = Math.min(gridW - 1, x0i + 1);
          const fx = gx - x0i;
          fv =
            (fw[row0 + x0i] * (1 - fx) + fw[row0 + x1i] * fx) * (1 - fy) +
            (fw[row1 + x0i] * (1 - fx) + fw[row1 + x1i] * fx) * fy;
        }
        if (fv + micro * 0.65 >= 128) {
          fwBin[idx] = 1;
        }
      }
    }
  }

  // Step 2: 2-Pass Chamfer Distance Field (both outside-land dOut & inside-land dIn; skip dFw when no lakes!)
  const INF = 60000;
  const hasFw = fw !== null;

  if (hasFw) {
    for (let i = 0; i < totalPx; i++) {
      dOut[i] = landBin[i] ? 0 : INF;
      dIn[i] = landBin[i] ? INF : 0;
      dFw[i] = fwBin[i] ? INF : 0;
    }
  } else {
    for (let i = 0; i < totalPx; i++) {
      dOut[i] = landBin[i] ? 0 : INF;
      dIn[i] = landBin[i] ? INF : 0;
    }
  }

  // Forward pass (top-left -> bottom-right): orthogonal = 10, diagonal = 14
  for (let y = 0; y < plateH; y++) {
    const row = y * plateW;
    const prevRow = (y - 1) * plateW;
    for (let x = 0; x < plateW; x++) {
      const idx = row + x;
      if (dOut[idx] > 0) {
        let best = dOut[idx];
        if (x > 0 && dOut[idx - 1] + 10 < best) best = dOut[idx - 1] + 10;
        if (y > 0) {
          if (dOut[prevRow + x] + 10 < best) best = dOut[prevRow + x] + 10;
          if (x > 0 && dOut[prevRow + x - 1] + 14 < best) best = dOut[prevRow + x - 1] + 14;
          if (x + 1 < plateW && dOut[prevRow + x + 1] + 14 < best) best = dOut[prevRow + x + 1] + 14;
        }
        dOut[idx] = best;
      }
      if (dIn[idx] > 0) {
        let best = dIn[idx];
        if (x > 0 && dIn[idx - 1] + 10 < best) best = dIn[idx - 1] + 10;
        if (y > 0) {
          if (dIn[prevRow + x] + 10 < best) best = dIn[prevRow + x] + 10;
          if (x > 0 && dIn[prevRow + x - 1] + 14 < best) best = dIn[prevRow + x - 1] + 14;
          if (x + 1 < plateW && dIn[prevRow + x + 1] + 14 < best) best = dIn[prevRow + x + 1] + 14;
        }
        dIn[idx] = best;
      }
      if (hasFw && dFw[idx] > 0) {
        let best = dFw[idx];
        if (x > 0 && dFw[idx - 1] + 10 < best) best = dFw[idx - 1] + 10;
        if (y > 0) {
          if (dFw[prevRow + x] + 10 < best) best = dFw[prevRow + x] + 10;
          if (x > 0 && dFw[prevRow + x - 1] + 14 < best) best = dFw[prevRow + x - 1] + 14;
          if (x + 1 < plateW && dFw[prevRow + x + 1] + 14 < best) best = dFw[prevRow + x + 1] + 14;
        }
        dFw[idx] = best;
      }
    }
  }

  // Backward pass (bottom-right -> top-left)
  for (let y = plateH - 1; y >= 0; y--) {
    const row = y * plateW;
    const nextRow = (y + 1) * plateW;
    for (let x = plateW - 1; x >= 0; x--) {
      const idx = row + x;
      if (dOut[idx] > 0) {
        let best = dOut[idx];
        if (x + 1 < plateW && dOut[idx + 1] + 10 < best) best = dOut[idx + 1] + 10;
        if (y + 1 < plateH) {
          if (dOut[nextRow + x] + 10 < best) best = dOut[nextRow + x] + 10;
          if (x + 1 < plateW && dOut[nextRow + x + 1] + 14 < best) best = dOut[nextRow + x + 1] + 14;
          if (x > 0 && dOut[nextRow + x - 1] + 14 < best) best = dOut[nextRow + x - 1] + 14;
        }
        dOut[idx] = best;
      }
      if (dIn[idx] > 0) {
        let best = dIn[idx];
        if (x + 1 < plateW && dIn[idx + 1] + 10 < best) best = dIn[idx + 1] + 10;
        if (y + 1 < plateH) {
          if (dIn[nextRow + x] + 10 < best) best = dIn[nextRow + x] + 10;
          if (x + 1 < plateW && dIn[nextRow + x + 1] + 14 < best) best = dIn[nextRow + x + 1] + 14;
          if (x > 0 && dIn[nextRow + x - 1] + 14 < best) best = dIn[nextRow + x - 1] + 14;
        }
        dIn[idx] = best;
      }
      if (hasFw && dFw[idx] > 0) {
        let best = dFw[idx];
        if (x + 1 < plateW && dFw[idx + 1] + 10 < best) best = dFw[idx + 1] + 10;
        if (y + 1 < plateH) {
          if (dFw[nextRow + x] + 10 < best) best = dFw[nextRow + x] + 10;
          if (x + 1 < plateW && dFw[nextRow + x + 1] + 14 < best) best = dFw[nextRow + x + 1] + 14;
          if (x > 0 && dFw[nextRow + x - 1] + 14 < best) best = dFw[nextRow + x - 1] + 14;
        }
        dFw[idx] = best;
      }
    }
  }

  // Step 3: Shade Ocean + Coastal Effects + Antique Rag-Parchment Land + Crisp Coastline Ink Overlay
  // Reuse pooled ImageData buffers & pure scalar RGB math (0 heap allocations across 1M+ pixels!)
  if (!scratchOceanImgData || scratchOceanImgData.width !== plateW || scratchOceanImgData.height !== plateH) {
    scratchOceanImgData = pctx.createImageData(plateW, plateH);
    scratchLandMaskImgData = mctx.createImageData(plateW, plateH);
    scratchCoastInkImgData = pctx.createImageData(plateW, plateH);
  } else {
    scratchCoastInkImgData!.data.fill(0);
  }
  const oceanImgData = scratchOceanImgData;
  const oceanPixels = oceanImgData.data;

  const landMaskImgData = scratchLandMaskImgData!;
  const landMaskPixels = landMaskImgData.data;

  const coastInkImgData = scratchCoastInkImgData!;
  const coastInkPixels = coastInkImgData.data;

  const [osR, osG, osB] = hexToRgb(theme.oceanColorHex);
  const [odR, odG, odB] = hexToRgb(theme.oceanDeepColorHex);
  const [stR, stG, stB] = hexToRgb(theme.oceanStainHex);
  const [lbR, lbG, lbB] = hexToRgb(theme.landBaseColorHex);
  const [ciR, ciG, ciB] = hexToRgb(theme.coastlineInkHex);
  const [efR, efG, efB] = hexToRgb(theme.coastalEffectColorHex);
  const [fwR, fwG, fwB] = hexToRgb(theme.freshwaterColorHex);
  const [frR, frG, frB] = hexToRgb(theme.freshwaterRimHex);

  // Convert plate pixels to consistent 32-ppc reference distances so coastal relief, shadows,
  // and ripples look geographically identical across 50% overview and 1600% detail zoom!
  const toRef = 32 / Math.max(8, pxPerCell);
  // Hand-inked coastline scales gracefully with zoom (remains fine quill pen work even at 1600%!)
  const coastWidthPx = Math.max(1.05, theme.coastlineWidthPx * Math.pow(pxPerCell / 32, 0.72));
  const fwRimPx = Math.max(1.1, 1.35 * Math.pow(pxPerCell / 32, 0.72));
  const rippleCount = Math.max(1, Math.min(5, Math.round(theme.coastalRippleCount || 3)));
  const effect = theme.coastalEffect;
  const coastVig = Math.max(0, Math.min(1, theme.coastalVignetteStrength));
  const grainStr = theme.paperGrainStrength;
  const invSx = 1 / sx;
  const invSy = 1 / sy;
  const coastDenom = Math.max(0.6, coastWidthPx * 0.6);
  const outerCoastPx = Math.max(0.95, coastWidthPx * 0.62);

  for (let y = 0; y < plateH; y++) {
    const row = y * plateW;
    const wy = y0 + (y + 0.5) * invSy;
    const wyCoarse = wy * 3.4 + seedOffY;
    const wyMed = wy * 14.5 + seedOffY * 1.8;
    const wyFine = wy * 52.0 + seedOffY * 2.9;
    const hCellY = Math.floor(wy * 48);

    for (let x = 0; x < plateW; x++) {
      const idx = row + x;
      const p4 = idx * 4;
      const wx = x0 + (x + 0.5) * invSx;

      // Continuous world-space 3-octave antique rag-vellum paper mottling & tooth!
      const mottleCoarse = sampleLutBilinear(lut, wx * 3.4 + seedOffX, wyCoarse);
      const mottleMed = sampleLutBilinear(lut, wx * 14.5 + seedOffX * 1.7, wyMed);
      const paperTooth = sampleLutBilinear(lut, wx * 52.0 + seedOffX * 3.1, wyFine);
      // Subtle high-frequency rag-paper micro-speckle (stable in screen/world sub-pixels)
      const hCellX = Math.floor(wx * 48);
      const microSpeck =
        ((((hCellX * 374761393 + hCellY * 668265263) ^ ((hCellX ^ hCellY) << 5)) >>> 0) / 4294967295 - 0.5);

      if (landBin[idx]) {
        const dinPx = dIn[idx] * 0.1;
        const dinRef = dinPx * toRef;
        // Landmask alpha = 255 on dry land (and 0 on inland lakes so biomes clip around lakes cleanly!)
        landMaskPixels[p4] = 255;
        landMaskPixels[p4 + 1] = 255;
        landMaskPixels[p4 + 2] = 255;
        landMaskPixels[p4 + 3] = fwBin[idx] ? 0 : 255;

        let r: number;
        let g: number;
        let b: number;

        if (fwBin[idx]) {
          const dfPx = dFw[idx] * 0.1;
          const dfRef = dfPx * toRef;
          if (dfPx <= fwRimPx) {
            r = frR;
            g = frG;
            b = frB;
            coastInkPixels[p4] = frR;
            coastInkPixels[p4 + 1] = frG;
            coastInkPixels[p4 + 2] = frB;
            coastInkPixels[p4 + 3] = 220;
          } else {
            const innerT = Math.min(1, (dfRef - 1.35) / 14);
            const fwMix = 0.72 + innerT * 0.28;
            r = frR + (fwR - frR) * fwMix;
            g = frG + (fwG - frG) * fwMix;
            b = frB + (fwB - frB) * fwMix;
            const lakeMottle = (mottleMed - 0.5) * 14 * grainStr;
            r = r + lakeMottle;
            g = g + lakeMottle;
            b = b + lakeMottle;
            if (r < 0) r = 0; else if (r > 255) r = 255;
            if (g < 0) g = 0; else if (g > 255) g = 255;
            if (b < 0) b = 0; else if (b > 255) b = 255;
          }
        } else {
          // Authentic aged cotton-rag parchment: crisp luminous coast rim + organic cloud mottling + fine fibers!
          const vigT = Math.exp(-dinRef / 8.0) * coastVig * 0.22;
          const teaCloud = (mottleCoarse * 0.6 + mottleMed * 0.4 - 0.5) * grainStr;
          const ragGrain = ((paperTooth - 0.5) * 20 + microSpeck * 11) * grainStr;
          let stMix = vigT + (teaCloud < 0 ? -teaCloud * 0.35 : 0);
          if (stMix > 0.65) stMix = 0.65;
          else if (stMix < 0) stMix = 0;
          r = lbR + (stR - lbR) * stMix;
          g = lbG + (stG - lbG) * stMix;
          b = lbB + (stB - lbB) * stMix;
          const warmLift = teaCloud * 26 + ragGrain;
          r += warmLift;
          g += warmLift * 0.94;
          b += warmLift * 0.84;
          if (r < 0) r = 0; else if (r > 255) r = 255;
          if (g < 0) g = 0; else if (g > 255) g = 255;
          if (b < 0) b = 0; else if (b > 255) b = 255;

          // Crisp anti-aliased inner coastline ink stroke (also saved to stamp ABOVE biome washes!)
          if (dinPx <= coastWidthPx) {
            let inkA = 1.0 - (dinPx - coastWidthPx * 0.52) / coastDenom;
            if (inkA < 0) inkA = 0; else if (inkA > 1) inkA = 1;
            const inkMix = inkA * 0.92;
            r += (ciR - r) * inkMix;
            g += (ciG - g) * inkMix;
            b += (ciB - b) * inkMix;
            coastInkPixels[p4] = ciR;
            coastInkPixels[p4 + 1] = ciG;
            coastInkPixels[p4 + 2] = ciB;
            coastInkPixels[p4 + 3] = Math.round(inkA * 244);
          }
        }

        oceanPixels[p4] = r;
        oceanPixels[p4 + 1] = g;
        oceanPixels[p4 + 2] = b;
        oceanPixels[p4 + 3] = 255;
      } else {
        // Ocean pixel
        landMaskPixels[p4 + 3] = 0;

        const doutPx = dOut[idx] * 0.1;
        const doutRef = doutPx * toRef;

        // Smooth ocean shelf -> deep ocean gradient + rich multi-octave antique watercolor mottling!
        const depthT = doutRef < 76 ? doutRef / 76 : 1;
        const cloudMottle = (mottleCoarse * 0.58 + mottleMed * 0.42 - 0.5) * grainStr;
        let dMix = depthT * depthT * 0.72 + depthT * 0.28 + cloudMottle * 0.95;
        if (dMix < 0) dMix = 0; else if (dMix > 1) dMix = 1;
        let r = osR + (odR - osR) * dMix;
        let g = osG + (odG - osG) * dMix;
        let b = osB + (odB - osB) * dMix;

        // Warm sepia antique tea-stain clouds drifting naturally across the open sea
        const warmPatch = (mottleCoarse - 0.48) * grainStr * 0.78;
        if (warmPatch > 0.01) {
          const wp = warmPatch > 1 ? 1 : warmPatch;
          r += (stR - r) * wp;
          g += (stG - g) * wp;
          b += (stB - b) * wp;
        }

        // Soft coastal ocean stain hugging shorelines
        const stainT = Math.exp(-doutRef / 18) * (0.26 + coastVig * 0.22);
        const stClamped = stainT > 1 ? 1 : stainT;
        r += (stR - r) * stClamped;
        g += (stG - g) * stClamped;
        b += (stB - b) * stClamped;

        // Signature Wonderdraft Coastal Effects (scale-invariant via doutRef!)
        if (effect === "ripples" && doutRef > 1.2 && doutRef < rippleCount * 7.8 + 4) {
          const jitter = (mottleMed - 0.5) * 1.4;
          const dMod = doutRef + jitter;
          for (let k = 1; k <= rippleCount; k++) {
            const ringDist = 4.0 + (k - 1) * 6.4 + (k - 1) * (k - 1) * 0.55;
            const diff = Math.abs(dMod - ringDist);
            if (diff < 1.15) {
              const fade = (1 - (k - 1) / (rippleCount + 0.45)) * (1 - diff / 1.15) * 0.62;
              r += (efR - r) * fade;
              g += (efG - g) * fade;
              b += (efB - b) * fade;
              break;
            }
          }
        } else if (effect === "wave_lines" && doutRef > 1.4 && doutRef < 34) {
          const band = Math.floor(wy * 8) % 2;
          if (band === 0) {
            const maxReach = 12 + mottleMed * 22;
            if (doutRef < maxReach) {
              const fade = Math.max(0, 1 - doutRef / maxReach);
              const dashMask = ((Math.floor(wx * 14 + mottleMed * 7)) % 9) < 6 ? 1 : 0.15;
              const fm = fade * dashMask * 0.58;
              r += (efR - r) * fm;
              g += (efG - g) * fm;
              b += (efB - b) * fm;
            }
          }
        } else if (effect === "stipple" && doutRef > 1.2 && doutRef < 28) {
          const prob = Math.exp(-doutRef / 9.5) * 0.42;
          if (microSpeck + 0.5 < prob) {
            r += (efR - r) * 0.72;
            g += (efG - g) * 0.72;
            b += (efB - b) * 0.72;
          }
        } else if (effect === "glow" && doutRef < 32) {
          const glowT = Math.exp(-doutRef / 12.5) * 0.58;
          r += (efR - r) * glowT;
          g += (efG - g) * glowT;
          b += (efB - b) * glowT;
        } else if (effect === "soft_shadow" && doutRef < 44) {
          // Wide velvety antique coastal drop-shadow hugging coastlines cleanly at every zoom level!
          const shadT = Math.exp(-doutRef / 14.0) * (0.50 + coastVig * 0.28);
          const sc = shadT > 1 ? 1 : shadT;
          r += (efR - r) * sc;
          g += (efG - g) * sc;
          b += (efB - b) * sc;
        } else if (effect === "hatch" && doutRef > 1.2 && doutRef < 20) {
          const diag =
            (Math.floor((wx + wy) * 18) % 5 === 0) ||
            (doutRef < 9 && Math.floor((wx - wy + 128) * 18) % 7 === 0);
          if (diag) {
            const fade = Math.max(0, 1 - doutRef / 20) * 0.62;
            r += (efR - r) * fade;
            g += (efG - g) * fade;
            b += (efB - b) * fade;
          }
        }

        // Outer anti-aliased edge of coastline ink (also preserved above ocean washes!)
        if (doutPx <= outerCoastPx) {
          const edgeA = 1 - doutPx / outerCoastPx;
          const ea = edgeA * 0.85;
          r += (ciR - r) * ea;
          g += (ciG - g) * ea;
          b += (ciB - b) * ea;
          coastInkPixels[p4] = ciR;
          coastInkPixels[p4 + 1] = ciG;
          coastInkPixels[p4 + 2] = ciB;
          coastInkPixels[p4 + 3] = Math.round(edgeA * 224);
        }

        const subtleGrain = ((paperTooth - 0.5) * 16 + microSpeck * 9) * grainStr;
        r += subtleGrain;
        g += subtleGrain;
        b += subtleGrain;
        oceanPixels[p4] = r < 0 ? 0 : r > 255 ? 255 : r;
        oceanPixels[p4 + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        oceanPixels[p4 + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        oceanPixels[p4 + 3] = 255;
      }
    }
  }

  pctx.putImageData(oceanImgData, 0, 0);
  mctx.putImageData(landMaskImgData, 0, 0);

  // World-space matrix helper so tiled paper/ocean textures NEVER stretch blurry when zoomed in!
  const applyWorldPatternMatrix = (pat: CanvasPattern, img: HTMLImageElement, tileCells: number) => {
    if (typeof DOMMatrix !== "undefined" && typeof pat.setTransform === "function") {
      const m = new DOMMatrix()
        .translate(-x0 * sx, -y0 * sy)
        .scale((tileCells * sx) / Math.max(1, img.width), (tileCells * sy) / Math.max(1, img.height));
      pat.setTransform(m);
    }
  };

  if (!scratchPaintOverlayCanvas) scratchPaintOverlayCanvas = document.createElement("canvas");
  if (scratchPaintOverlayCanvas.width !== plateW || scratchPaintOverlayCanvas.height !== plateH) {
    scratchPaintOverlayCanvas.width = plateW;
    scratchPaintOverlayCanvas.height = plateH;
  }
  const paintOverlay = scratchPaintOverlayCanvas;
  const lctx = paintOverlay.getContext("2d");

  // Step 4: Composite Seamless World-Locked Watercolor Ocean Texture STRICTLY over ocean pixels
  // (masked outside landmass so the darker weathered ocean wash never muddies luminous land parchment!)
  if (oceanImg && lctx) {
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, plateW, plateH);
    const pat = lctx.createPattern(oceanImg, "repeat");
    if (pat) {
      applyWorldPatternMatrix(pat, oceanImg, 18);
      lctx.fillStyle = pat;
      lctx.fillRect(0, 0, plateW, plateH);
      lctx.globalCompositeOperation = "destination-out";
      lctx.drawImage(landMaskCanvas, 0, 0);

      pctx.save();
      pctx.globalAlpha = Math.min(0.95, 0.62 + grainStr * 0.34);
      pctx.globalCompositeOperation = "soft-light";
      pctx.drawImage(paintOverlay, 0, 0);
      pctx.globalAlpha = Math.min(0.45, 0.16 + grainStr * 0.14);
      pctx.globalCompositeOperation = "multiply";
      pctx.drawImage(paintOverlay, 0, 0);
      pctx.restore();
    }
  }

  // Step 5: Composite Organic Multi-Lobe Watercolor Ocean & Land Washes + World-Space Stipple + Land Paper + Crisp Ink!
  const oceanStrokes = world.biomeStrokes.filter((s) => s.target === "ocean");
  const landStrokes = world.biomeStrokes.filter((s) => !s.target || s.target === "land");
  const bothStrokes = world.biomeStrokes.filter((s) => s.target === "both");
  if (lctx) {
    const drawStrokeBatch = (batch: typeof world.biomeStrokes) => {
      for (const stroke of batch) {
        if (stroke.points.length === 0) continue;
        // Fast AABB reject against this plate region!
        const padR = stroke.radiusCells * 1.45;
        let sMinX = Infinity;
        let sMaxX = -Infinity;
        let sMinY = Infinity;
        let sMaxY = -Infinity;
        for (const pt of stroke.points) {
          if (pt.x < sMinX) sMinX = pt.x;
          if (pt.x > sMaxX) sMaxX = pt.x;
          if (pt.y < sMinY) sMinY = pt.y;
          if (pt.y > sMaxY) sMaxY = pt.y;
        }
        if (sMaxX + padR < x0 || sMinX - padR > x1 || sMaxY + padR < y0 || sMinY - padR > y1) {
          continue;
        }

        const [br, bg, bb] = hexToRgb(stroke.colorHex);
        const rPx = Math.max(4, stroke.radiusCells * pxPerCell);
        const innerStop = Math.max(0.05, Math.min(0.84, 1 - stroke.softness * 0.86));
        const step = Math.max(0.25, stroke.radiusCells * 0.38);
        let rngState = ((stroke.seed || 17) * 2654435761) >>> 0;
        const nextRand = () => {
          rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
          return rngState / 4294967296;
        };

        for (let i = 0; i < stroke.points.length; i++) {
          const a = stroke.points[i];
          const b = i + 1 < stroke.points.length ? stroke.points[i + 1] : a;
          const dist = Math.hypot(b.x - a.x, b.y - a.y);
          const steps = i + 1 < stroke.points.length ? Math.max(1, Math.ceil(dist / step)) : 1;
          for (let s = 0; s < steps; s++) {
            const t = steps > 1 ? s / steps : 0;
            const cxCell = a.x + (b.x - a.x) * t;
            const cyCell = a.y + (b.y - a.y) * t;

            if (stroke.pattern === "stipple") {
              // Deterministic WORLD-SPACE antique ink stipple flecks (100% zoom & pan invariant!)
              const dotCount = Math.min(200, Math.max(28, Math.round(stroke.radiusCells * stroke.radiusCells * 24)));
              const dotAlpha = Math.max(0.14, Math.min(0.85, stroke.opacity * 0.68));
              lctx.fillStyle = `rgba(${br}, ${bg}, ${bb}, ${dotAlpha.toFixed(3)})`;
              for (let d = 0; d < dotCount; d++) {
                const ang = nextRand() * Math.PI * 2;
                const rad = Math.sqrt(nextRand()) * stroke.radiusCells;
                const dxCell = cxCell + Math.cos(ang) * rad;
                const dyCell = cyCell + Math.sin(ang) * rad;
                const sizeCells = 0.018 + nextRand() * 0.024;
                if (dxCell < x0 - 0.1 || dxCell > x1 + 0.1 || dyCell < y0 - 0.1 || dyCell > y1 + 0.1) {
                  continue;
                }
                const px = (dxCell - x0) * sx;
                const py = (dyCell - y0) * sy;
                const sz = Math.max(0.85, sizeCells * pxPerCell);
                if (sz >= 1.9) {
                  lctx.beginPath();
                  lctx.arc(px, py, sz * 0.52, 0, Math.PI * 2);
                  lctx.fill();
                } else {
                  lctx.fillRect(px, py, sz, sz);
                }
              }
            } else {
              // Organic multi-lobe feathered watercolor dab (avoids artificial geometric circles!)
              const baseAlpha = Math.max(0.03, Math.min(0.86, stroke.opacity * 0.32));
              const lobes = 3;
              for (let lb = 0; lb < lobes; lb++) {
                const ang = nextRand() * Math.PI * 2;
                const offR = (lb === 0 ? 0.08 : 0.24 + nextRand() * 0.24) * stroke.radiusCells;
                const lRadScale = lb === 0 ? 0.94 : 0.62 + nextRand() * 0.34;
                const lx = (cxCell + Math.cos(ang) * offR - x0) * sx;
                const ly = (cyCell + Math.sin(ang) * offR - y0) * sy;
                const lr = Math.max(3, rPx * lRadScale);
                if (lx + lr < 0 || lx - lr > plateW || ly + lr < 0 || ly - lr > plateH) {
                  continue;
                }
                const la = baseAlpha * (lb === 0 ? 1.0 : 0.72);
                const grad = lctx.createRadialGradient(lx, ly, lr * innerStop * 0.2, lx, ly, lr);
                grad.addColorStop(0, `rgba(${br}, ${bg}, ${bb}, ${la.toFixed(3)})`);
                grad.addColorStop(innerStop, `rgba(${br}, ${bg}, ${bb}, ${(la * 0.6).toFixed(3)})`);
                grad.addColorStop(1, `rgba(${br}, ${bg}, ${bb}, 0)`);
                lctx.fillStyle = grad;
                lctx.beginPath();
                lctx.arc(lx, ly, lr, 0, Math.PI * 2);
                lctx.fill();
              }
            }
          }
        }
      }
    };

    // 5.0 Optional base painted biome watercolor raster (e.g., imported from Wonderdraft ground layer).
    // Strictly clipped to dry landmass (`destination-in`) just like Wonderdraft's terrain shader, so soft
    // land-brush overspray and erased-island ghosts never bleed into the surrounding ocean!
    if (biomeRasterImg && biomeRasterImg.naturalWidth > 0 && biomeRasterImg.naturalHeight > 0) {
      const bw = biomeRasterImg.naturalWidth;
      const bh = biomeRasterImg.naturalHeight;
      const srcX = (x0 / wCells) * bw;
      const srcY = (y0 / hCells) * bh;
      const srcW = Math.max(1, ((x1 - x0) / wCells) * bw);
      const srcH = Math.max(1, ((y1 - y0) / hCells) * bh);

      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, plateW, plateH);
      lctx.imageSmoothingEnabled = true;
      lctx.imageSmoothingQuality = "high";
      lctx.drawImage(biomeRasterImg, srcX, srcY, srcW, srcH, 0, 0, plateW, plateH);
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(landMaskCanvas, 0, 0);

      pctx.save();
      pctx.globalAlpha = 0.94;
      pctx.globalCompositeOperation = "source-over";
      pctx.drawImage(paintOverlay, 0, 0);
      pctx.restore();
    }

    // 5a. Ocean-only organic watercolor washes (clipped strictly outside dry landmass)
    if (oceanStrokes.length > 0) {
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, plateW, plateH);
      drawStrokeBatch(oceanStrokes);
      lctx.globalCompositeOperation = "destination-out";
      lctx.drawImage(landMaskCanvas, 0, 0);
      pctx.save();
      pctx.globalCompositeOperation = "source-over";
      pctx.drawImage(paintOverlay, 0, 0);
      pctx.restore();
    }

    // 5b. Land-only watercolor biome washes (hybrid source-over + multiply so parchment grain shows through!)
    if (landStrokes.length > 0) {
      const solidLand = landStrokes.filter((s) => s.pattern !== "stipple");
      const stippleLand = landStrokes.filter((s) => s.pattern === "stipple");

      if (solidLand.length > 0) {
        lctx.globalCompositeOperation = "source-over";
        lctx.clearRect(0, 0, plateW, plateH);
        drawStrokeBatch(solidLand);
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(landMaskCanvas, 0, 0);
        // Primary soft watercolor pigment layer (preserves underlying vellum paper tooth!)
        pctx.save();
        pctx.globalAlpha = 0.86;
        pctx.globalCompositeOperation = "source-over";
        pctx.drawImage(paintOverlay, 0, 0);
        // Subtle multiply wash so dark forests & shadows soak organically without muddying parchment!
        pctx.globalAlpha = 0.12;
        pctx.globalCompositeOperation = "multiply";
        pctx.drawImage(paintOverlay, 0, 0);
        pctx.restore();
      }

      if (stippleLand.length > 0) {
        lctx.globalCompositeOperation = "source-over";
        lctx.clearRect(0, 0, plateW, plateH);
        drawStrokeBatch(stippleLand);
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(landMaskCanvas, 0, 0);
        pctx.save();
        pctx.globalCompositeOperation = "source-over";
        pctx.drawImage(paintOverlay, 0, 0);
        pctx.restore();
      }
    }

    // 5c. Unclipped full-map atmospheric washes ("both")
    if (bothStrokes.length > 0) {
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, plateW, plateH);
      drawStrokeBatch(bothStrokes);
      pctx.save();
      pctx.globalCompositeOperation = "source-over";
      pctx.drawImage(paintOverlay, 0, 0);
      pctx.restore();
    }

    // 5d. Apply seamless world-locked antique rag-vellum paper texture strictly over landmass
    // Soft-light lifts warm parchment highlights & crisp fiber grain (matching Wonderdraft's Worn shader)
    // without crushing bright cream plains or vivid forest biomes into mud!
    if (landImg) {
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, plateW, plateH);
      const pat = lctx.createPattern(landImg, "repeat");
      if (pat) {
        applyWorldPatternMatrix(pat, landImg, 11);
        lctx.fillStyle = pat;
        lctx.fillRect(0, 0, plateW, plateH);
        lctx.globalCompositeOperation = "destination-in";
        lctx.drawImage(landMaskCanvas, 0, 0);
        pctx.save();
        pctx.globalAlpha = Math.min(0.75, 0.36 + grainStr * 0.26);
        pctx.globalCompositeOperation = "soft-light";
        pctx.drawImage(paintOverlay, 0, 0);
        pctx.globalAlpha = Math.min(0.18, 0.06 + grainStr * 0.06);
        pctx.globalCompositeOperation = "multiply";
        pctx.drawImage(paintOverlay, 0, 0);
        pctx.restore();
      }
    }

    // 5e. Re-stamp razor-sharp coastline & lake-rim ink ABOVE all biome & ocean washes!
    lctx.globalCompositeOperation = "source-over";
    lctx.clearRect(0, 0, plateW, plateH);
    lctx.putImageData(coastInkImgData, 0, 0);
    pctx.save();
    pctx.globalCompositeOperation = "source-over";
    pctx.drawImage(paintOverlay, 0, 0);
    pctx.restore();
  }

  return {
    key: `${docSig}|${x0.toFixed(3)},${y0.toFixed(3)},${x1.toFixed(3)},${y1.toFixed(3)}|${plateW}x${plateH}`,
    docSig,
    x0,
    y0,
    x1,
    y1,
    width: plateW,
    height: plateH,
    pxPerCell,
    plateCanvas,
    landMaskCanvas,
  };
}

function getOrBuildWorldBasePlate(
  doc: DcMapDocument,
  world: WorldMapData,
  assetLookup: Map<string, VaultAsset>,
  targetW: number,
  targetH: number,
  opts: RenderOptions,
): CachedWorldBasePlate | null {
  if (typeof document === "undefined") return null;

  const wCells = Math.max(1, doc.canvas.widthCells);
  const hCells = Math.max(1, doc.canvas.heightCells);
  const aspect = Math.max(0.4, Math.min(3.5, targetW / Math.max(1, targetH)));

  const oceanTexUrl = world.theme.oceanTextureAssetId
    ? resolveAssetUrl(world.theme.oceanTextureAssetId, assetLookup)
    : "";
  const landTexUrl = world.theme.landTextureAssetId
    ? resolveAssetUrl(world.theme.landTextureAssetId, assetLookup)
    : "";
  const oceanImg = oceanTexUrl ? texturePool.get(oceanTexUrl) : null;
  const landImg = landTexUrl ? texturePool.get(landTexUrl) : null;
  const biomeRasterImg = world.biomeRasterB64 ? texturePool.get(world.biomeRasterB64) : null;

  const docSig = [
    doc.id,
    world.seaLevel,
    world.coastlineRoughness.toFixed(2),
    world.seed,
    world.heightmapB64.length,
    world.heightmapB64.slice(0, 24),
    world.heightmapB64.slice(-24),
    world.freshwaterB64
      ? `${world.freshwaterB64.length}:${world.freshwaterB64.slice(0, 16)}:${world.freshwaterB64.slice(-16)}`
      : "nofw",
    world.biomeRasterB64
      ? `${world.biomeRasterB64.length}:${biomeRasterImg ? "1" : "0"}`
      : "nobrast",
    getThemeSig(world.theme),
    computeBiomeSignature(world),
    oceanImg ? "1" : "0",
    landImg ? "1" : "0",
  ].join("|");

  // 1. Always maintain crisp Full-Map Overview Plate (1920px live, up to 2560px for 4K/8K exports!)
  const isExport = !opts.viewportCells && targetW > 2200;
  const overviewW = isExport
    ? Math.min(2560, Math.max(1920, Math.round(targetW * 0.65)))
    : world.gridW >= 360
      ? 1920
      : 1440;
  const overviewH = Math.max(360, Math.round(overviewW / aspect));
  const overviewKey = `${docSig}|0.000,0.000,${wCells.toFixed(3)},${hCells.toFixed(3)}|${overviewW}x${overviewH}`;

  if (!cachedOverviewPlate || cachedOverviewPlate.key !== overviewKey) {
    cachedOverviewPlate = buildWorldPlateRegion(
      doc,
      world,
      docSig,
      oceanImg,
      landImg,
      biomeRasterImg,
      0,
      0,
      wCells,
      hCells,
      overviewW,
      overviewH,
      cachedOverviewPlate,
    );
  }

  // 2. When zoomed in inside the live viewport, dynamically build a 1:1 Hi-DPI cropped Detail Plate!
  const vp = opts.viewportCells;
  if (vp && cachedOverviewPlate) {
    const dpr = Math.max(1, Math.min(2, vp.dpr ?? 1));
    const desiredPpc = opts.pixelsPerCell * dpr;
    if (desiredPpc > cachedOverviewPlate.pxPerCell * 1.16) {
      const vMinX = Math.max(0, Math.min(wCells, vp.minX));
      const vMinY = Math.max(0, Math.min(hCells, vp.minY));
      const vMaxX = Math.max(vMinX + 0.2, Math.min(wCells, vp.maxX));
      const vMaxY = Math.max(vMinY + 0.2, Math.min(hCells, vp.maxY));

      // Reuse cachedDetailPlate if it already covers the visible viewport at close resolution!
      if (
        cachedDetailPlate &&
        cachedDetailPlate.docSig === docSig &&
        cachedDetailPlate.x0 <= vMinX + 0.02 &&
        cachedDetailPlate.y0 <= vMinY + 0.02 &&
        cachedDetailPlate.x1 >= vMaxX - 0.02 &&
        cachedDetailPlate.y1 >= vMaxY - 0.02 &&
        cachedDetailPlate.pxPerCell >= desiredPpc * 0.72 &&
        cachedDetailPlate.pxPerCell <= desiredPpc * 1.48
      ) {
        return cachedDetailPlate;
      }

      if (vp.allowDetailPlate !== false) {
        // Generous 36% pan margin around viewport so larger drags stay 0ms cache hits!
        const visW = vMaxX - vMinX;
        const visH = vMaxY - vMinY;
        const padX = visW * 0.36;
        const padY = visH * 0.36;
        const rx0 = Math.max(0, vMinX - padX);
        const ry0 = Math.max(0, vMinY - padY);
        const rx1 = Math.min(wCells, vMaxX + padX);
        const ry1 = Math.min(hCells, vMaxY + padY);
        const rSpanX = Math.max(0.25, rx1 - rx0);
        const rSpanY = Math.max(0.25, ry1 - ry0);

        // Cap detail plate max side at 1088px (crisp 1:1 Hi-DPI detail with 28% faster settle!)
        let detW = Math.round(rSpanX * desiredPpc);
        let detH = Math.round(rSpanY * desiredPpc);
        const maxSide = 1088;
        if (detW > maxSide || detH > maxSide) {
          const down = maxSide / Math.max(detW, detH);
          detW = Math.max(256, Math.round(detW * down));
          detH = Math.max(256, Math.round(detH * down));
        }

        const built = buildWorldPlateRegion(
          doc,
          world,
          docSig,
          oceanImg,
          landImg,
          biomeRasterImg,
          rx0,
          ry0,
          rx1,
          ry1,
          detW,
          detH,
          cachedDetailPlate,
        );
        if (built) {
          cachedDetailPlate = built;
          return cachedDetailPlate;
        }
      } else if (
        cachedDetailPlate &&
        cachedDetailPlate.docSig === docSig &&
        cachedDetailPlate.x0 <= vMinX + 0.05 &&
        cachedDetailPlate.y0 <= vMinY + 0.05 &&
        cachedDetailPlate.x1 >= vMaxX - 0.05 &&
        cachedDetailPlate.y1 >= vMaxY - 0.05
      ) {
        return cachedDetailPlate;
      }
    }
  }

  return cachedOverviewPlate;
}

// ---------------------------------------------------------------------------
// Political Territory Regions (Coastline-Clipped & Maritime)
// ---------------------------------------------------------------------------

function traceRegionPath(ctx: CanvasRenderingContext2D, region: WorldRegion, ppc: number) {
  const pts =
    region.curved && region.polygon.length >= 3
      ? sampleCatmullRom(region.polygon, 10, true)
      : region.polygon;
  if (pts.length < 3) return false;
  ctx.beginPath();
  ctx.moveTo(pts[0].x * ppc, pts[0].y * ppc);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x * ppc, pts[i].y * ppc);
  }
  ctx.closePath();
  return true;
}

function drawPlateCropped(
  ctx: CanvasRenderingContext2D,
  srcCanvas: HTMLCanvasElement,
  plateX0: number,
  plateY0: number,
  plateX1: number,
  plateY1: number,
  ppc: number,
  vp?: WorldViewportCells,
) {
  const spanX = Math.max(0.05, plateX1 - plateX0);
  const spanY = Math.max(0.05, plateY1 - plateY0);
  if (!vp) {
    ctx.drawImage(srcCanvas, plateX0 * ppc, plateY0 * ppc, spanX * ppc, spanY * ppc);
    return;
  }
  const ix0 = Math.max(plateX0, vp.minX);
  const iy0 = Math.max(plateY0, vp.minY);
  const ix1 = Math.min(plateX1, vp.maxX);
  const iy1 = Math.min(plateY1, vp.maxY);
  if (ix1 <= ix0 || iy1 <= iy0) return;
  const sx = ((ix0 - plateX0) / spanX) * srcCanvas.width;
  const sy = ((iy0 - plateY0) / spanY) * srcCanvas.height;
  const sw = ((ix1 - ix0) / spanX) * srcCanvas.width;
  const sh = ((iy1 - iy0) / spanY) * srcCanvas.height;
  ctx.drawImage(srcCanvas, sx, sy, sw, sh, ix0 * ppc, iy0 * ppc, (ix1 - ix0) * ppc, (iy1 - iy0) * ppc);
}

function computeRegionsSig(regions: WorldRegion[]): string {
  if (regions.length === 0) return "0";
  let h = regions.length * 31;
  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    h = (Math.imul(h, 31) + r.polygon.length * 13 + Math.round(r.fillOpacity * 100) + Math.round(r.borderWidth * 10) + (r.curved ? 1 : 0)) | 0;
    for (let j = 0; j < r.polygon.length; j++) {
      h = (Math.imul(h, 31) + Math.round(r.polygon[j].x * 20) + Math.round(r.polygon[j].y * 20)) | 0;
    }
  }
  const last = regions[regions.length - 1];
  return `${regions.length}:${h}:${last.fillColorHex}:${last.borderColorHex}:${last.borderStyle}`;
}

function computeRiversSig(rivers: WorldMapData["rivers"]): string {
  if (rivers.length === 0) return "0";
  let h = rivers.length * 37;
  for (let i = 0; i < rivers.length; i++) {
    const rv = rivers[i];
    h = (Math.imul(h, 31) + rv.points.length * 17 + Math.round(rv.startWidthCells * 100) + Math.round(rv.endWidthCells * 100) + rv.seed) | 0;
    for (let j = 0; j < rv.points.length; j++) {
      h = (Math.imul(h, 31) + Math.round(rv.points[j].x * 20) + Math.round(rv.points[j].y * 20)) | 0;
    }
  }
  const last = rivers[rivers.length - 1];
  return `${rivers.length}:${h}:${last.colorHex || ""}:${last.bankColorHex || ""}`;
}

function drawWorldRegions(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  plate: CachedWorldBasePlate | null,
  _fullW: number,
  _fullH: number,
  ppc: number,
  vp?: WorldViewportCells,
) {
  if (world.regions.length === 0) return;

  const clipped = world.regions.filter((r) => r.clipToLand && r.polygon.length >= 3);
  const unclipped = world.regions.filter((r) => !r.clipToLand && r.polygon.length >= 3);

  // Coastline-clipped kingdom fills via landMaskCanvas (cached per plate so panning/zooming is 0.15ms!)
  if (clipped.length > 0 && plate && typeof document !== "undefined") {
    const sw = plate.width;
    const sh = plate.height;
    const spanX = Math.max(0.05, plate.x1 - plate.x0);
    const spanY = Math.max(0.05, plate.y1 - plate.y0);
    const cacheKey = `${plate.key}|${computeRegionsSig(clipped)}`;
    if (!scratchRegionCanvas) scratchRegionCanvas = document.createElement("canvas");
    if (scratchRegionCanvas.width !== sw || scratchRegionCanvas.height !== sh) {
      scratchRegionCanvas.width = sw;
      scratchRegionCanvas.height = sh;
      cachedRegionPlateKey = "";
    }
    if (cachedRegionPlateKey !== cacheKey) {
      const sx = sw / spanX;
      const sy = sh / spanY;
      const rctx = scratchRegionCanvas.getContext("2d");
      if (rctx) {
        rctx.clearRect(0, 0, sw, sh);
        rctx.save();
        rctx.translate(-plate.x0 * sx, -plate.y0 * sy);
        const regScale = (sx + sy) * 0.5;
        for (const reg of clipped) {
          if (!traceRegionPath(rctx, reg, regScale)) continue;
          rctx.save();
          rctx.globalAlpha = Math.max(0.05, Math.min(0.85, reg.fillOpacity));
          rctx.fillStyle = reg.fillColorHex;
          rctx.fill();
          rctx.globalAlpha = Math.min(1, reg.fillOpacity + 0.45);
          rctx.strokeStyle = reg.borderColorHex;
          rctx.lineWidth = Math.max(1.2, reg.borderWidth * (regScale / 32));
          if (reg.borderStyle === "dashed") rctx.setLineDash([regScale * 0.28, regScale * 0.16]);
          else if (reg.borderStyle === "dotted") rctx.setLineDash([regScale * 0.08, regScale * 0.14]);
          rctx.lineCap = "round";
          rctx.lineJoin = "round";
          rctx.stroke();
          rctx.setLineDash([]);
          rctx.restore();
        }
        rctx.restore();

        rctx.save();
        rctx.globalCompositeOperation = "destination-in";
        rctx.drawImage(plate.landMaskCanvas, 0, 0);
        rctx.restore();
        cachedRegionPlateKey = cacheKey;
      }
    }

    ctx.save();
    drawPlateCropped(ctx, scratchRegionCanvas, plate.x0, plate.y0, plate.x1, plate.y1, ppc, vp);
    ctx.restore();
  }

  for (const reg of unclipped) {
    ctx.save();
    if (traceRegionPath(ctx, reg, ppc)) {
      ctx.globalAlpha = Math.max(0.05, Math.min(0.85, reg.fillOpacity));
      ctx.fillStyle = reg.fillColorHex;
      ctx.fill();
      ctx.globalAlpha = Math.min(1, reg.fillOpacity + 0.45);
      ctx.strokeStyle = reg.borderColorHex;
      ctx.lineWidth = Math.max(1.2, reg.borderWidth * (ppc / 32));
      if (reg.borderStyle === "dashed") ctx.setLineDash([ppc * 0.28, ppc * 0.16]);
      else if (reg.borderStyle === "dotted") ctx.setLineDash([ppc * 0.08, ppc * 0.14]);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Meandering Tapered Rivers (Seamless Fade into Oceans, Lakes & Tributaries)
// ---------------------------------------------------------------------------

function drawWorldRivers(
  ctx: CanvasRenderingContext2D,
  doc: DcMapDocument,
  world: WorldMapData,
  plate: CachedWorldBasePlate | null,
  _fullW: number,
  _fullH: number,
  ppc: number,
  vp?: WorldViewportCells,
) {
  if (world.rivers.length === 0) return;

  const wCells = doc.canvas.widthCells;
  const hCells = doc.canvas.heightCells;
  const totalGrid = world.gridW * world.gridH;
  const cachedHm = decodeMaskB64Cached(world.heightmapB64, totalGrid);
  const cachedFw = world.freshwaterB64 ? decodeMaskB64Cached(world.freshwaterB64, totalGrid) : null;
  const maskSig = `${world.seaLevel}:${world.heightmapB64.length}:${world.heightmapB64.slice(0, 12)}:${world.heightmapB64.slice(-12)}:${world.freshwaterB64 ? world.freshwaterB64.length : 0}`;

  const getCachedRiverMesh = (river: WorldMapData["rivers"][number]): CachedRiverMesh => {
    const ptsKey = river.points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(";");
    const rKey = `${river.id}|${ptsKey}|${river.startWidthCells}|${river.endWidthCells}|${river.meanderRoughness}|${river.meanderScale}|${river.curved ? 1 : 0}|${river.seed}|${maskSig}`;
    const hit = riverMeshCache.get(rKey);
    if (hit) return hit;

    const geom = buildMeanderingRiverGeometry(river);
    const { centerline } = geom;
    const n = centerline.length;
    let shoreIdx = n - 1;
    let enteredWater = false;
    let seenLand = false;
    for (let i = 0; i < n; i++) {
      const onLand = isPointOnLand(world, centerline[i], wCells, hCells, cachedHm, cachedFw);
      if (onLand) {
        seenLand = true;
      } else if (seenLand) {
        shoreIdx = i;
        enteredWater = true;
        break;
      }
    }
    const entry: CachedRiverMesh = { geom, shoreIdx, enteredWater };
    if (riverMeshCache.size >= MAX_RIVER_CACHE) {
      const oldest = riverMeshCache.keys().next().value;
      if (oldest !== undefined) riverMeshCache.delete(oldest);
    }
    riverMeshCache.set(rKey, entry);
    return entry;
  };

  const renderRiverTo = (
    rctx: CanvasRenderingContext2D,
    river: WorldMapData["rivers"][number],
    scaleX: number,
    scaleY: number,
  ) => {
    if (river.points.length < 2) return;
    const { geom, shoreIdx, enteredWater } = getCachedRiverMesh(river);
    const { centerline, leftEdge, rightEdge } = geom;
    const n = centerline.length;
    if (n < 2 || leftEdge.length !== n || rightEdge.length !== n) return;

    const waterHex = river.colorHex || world.theme.freshwaterColorHex;
    const bankHex = river.bankColorHex || world.theme.freshwaterRimHex;
    const [wr, wg, wb] = hexToRgb(waterHex);
    const [br, bg, bb] = hexToRgb(bankHex);
    const fadeMouth = river.fadeMouth !== false;
    const fadeSource = river.fadeSource !== false;
    const mouthFadeFrac = Math.max(0.06, Math.min(0.45, river.mouthFadeRatio ?? 0.22));

    const endFadeIdx = enteredWater ? Math.min(n - 1, shoreIdx + 2) : n - 1;
    const fadeStartIdx = Math.max(
      1,
      Math.floor(endFadeIdx - Math.max(4, endFadeIdx * mouthFadeFrac)),
    );
    const srcFadeEndIdx = Math.min(endFadeIdx - 1, Math.max(2, Math.floor(n * 0.08)));

    const segAlpha = (i: number, isBank: boolean): number => {
      let a = 1;
      if (fadeSource && i <= srcFadeEndIdx) {
        const tSrc = i / Math.max(1, srcFadeEndIdx);
        a *= isBank ? 0.15 + 0.85 * tSrc : 0.35 + 0.65 * tSrc;
      }
      if (fadeMouth && i >= fadeStartIdx) {
        const span = Math.max(1, endFadeIdx - fadeStartIdx);
        const tOut = Math.max(0, Math.min(1, (i - fadeStartIdx) / span));
        if (isBank) {
          // Banks fade out completely BEFORE the mouth meets ocean/lake/parent stream!
          a *= Math.pow(Math.max(0, 1 - tOut * 1.18), 1.45);
        } else {
          // Water fill blends smoothly across the estuary into the receiving sea/lake
          a *= enteredWater
            ? Math.pow(Math.max(0, 1 - tOut * 0.92), 1.25)
            : Math.pow(Math.max(0, 1 - tOut * 0.72), 1.15);
        }
      }
      if (enteredWater && i > endFadeIdx) {
        return 0;
      }
      return Math.max(0, Math.min(1, a));
    };

    const avgScale = (scaleX + scaleY) * 0.5;
    const baseBankW = Math.max(0.75, avgScale * 0.036);

    rctx.save();
    rctx.lineCap = "round";
    rctx.lineJoin = "round";

    // Pass 1: Smoothly fading segmented river water body (NO harsh closing edge at the mouth!)
    for (let i = 0; i < n - 1; i++) {
      const a = segAlpha(i + 0.5, false);
      if (a <= 0.01) continue;
      const l0 = leftEdge[i];
      const l1 = leftEdge[i + 1];
      const r1 = rightEdge[i + 1];
      const r0 = rightEdge[i];
      rctx.fillStyle = `rgba(${wr}, ${wg}, ${wb}, ${a.toFixed(3)})`;
      rctx.beginPath();
      rctx.moveTo(l0.x * scaleX, l0.y * scaleY);
      rctx.lineTo(l1.x * scaleX, l1.y * scaleY);
      rctx.lineTo(r1.x * scaleX, r1.y * scaleY);
      rctx.lineTo(r0.x * scaleX, r0.y * scaleY);
      rctx.closePath();
      rctx.fill();
    }

    // Pass 2: Open-ended left & right river banks that taper smoothly to 0 at mouth & spring!
    for (let i = 0; i < n - 1; i++) {
      const a = segAlpha(i + 0.5, true);
      if (a <= 0.02) continue;
      const t = i / Math.max(1, n - 1);
      rctx.strokeStyle = `rgba(${br}, ${bg}, ${bb}, ${(a * 0.85).toFixed(3)})`;
      rctx.lineWidth = baseBankW * (0.65 + 0.45 * Math.sin(t * Math.PI)) * (0.4 + 0.6 * a);
      rctx.beginPath();
      rctx.moveTo(leftEdge[i].x * scaleX, leftEdge[i].y * scaleY);
      rctx.lineTo(leftEdge[i + 1].x * scaleX, leftEdge[i + 1].y * scaleY);
      rctx.moveTo(rightEdge[i].x * scaleX, rightEdge[i].y * scaleY);
      rctx.lineTo(rightEdge[i + 1].x * scaleX, rightEdge[i + 1].y * scaleY);
      rctx.stroke();
    }

    // Pass 3: Delicate inner water sheen along river center (also fades out at estuary)
    for (let i = 0; i < n - 1; i++) {
      const a = segAlpha(i + 0.5, false);
      if (a <= 0.06) continue;
      rctx.strokeStyle = `rgba(255, 255, 255, ${(a * 0.2).toFixed(3)})`;
      rctx.lineWidth = Math.max(0.5, avgScale * 0.02);
      rctx.beginPath();
      rctx.moveTo(centerline[i].x * scaleX, centerline[i].y * scaleY);
      rctx.lineTo(centerline[i + 1].x * scaleX, centerline[i + 1].y * scaleY);
      rctx.stroke();
    }

    rctx.restore();
  };

  const clippedRivers = world.rivers.filter((r) => r.clipToLand !== false);
  const unclippedRivers = world.rivers.filter((r) => r.clipToLand === false);

  // Clipped rivers: render onto cached plate-aligned canvas (0.15ms blit across pan/zoom frames!)
  // masked cleanly inside dry land so estuaries dissolve smoothly right at the shoreline!
  if (clippedRivers.length > 0 && plate && typeof document !== "undefined") {
    const sw = plate.width;
    const sh = plate.height;
    const spanX = Math.max(0.05, plate.x1 - plate.x0);
    const spanY = Math.max(0.05, plate.y1 - plate.y0);
    const riverKey = `${plate.key}|${world.theme.freshwaterColorHex}|${world.theme.freshwaterRimHex}|${computeRiversSig(clippedRivers)}`;
    if (!scratchRiverCanvas) scratchRiverCanvas = document.createElement("canvas");
    if (scratchRiverCanvas.width !== sw || scratchRiverCanvas.height !== sh) {
      scratchRiverCanvas.width = sw;
      scratchRiverCanvas.height = sh;
      cachedRiverPlateKey = "";
    }
    if (cachedRiverPlateKey !== riverKey) {
      const sx = sw / spanX;
      const sy = sh / spanY;
      const rctx = scratchRiverCanvas.getContext("2d");
      if (rctx) {
        rctx.clearRect(0, 0, sw, sh);
        rctx.save();
        rctx.translate(-plate.x0 * sx, -plate.y0 * sy);
        for (const rv of clippedRivers) {
          // Fast AABB reject against plate region
          let rMinX = Infinity;
          let rMaxX = -Infinity;
          let rMinY = Infinity;
          let rMaxY = -Infinity;
          for (const p of rv.points) {
            if (p.x < rMinX) rMinX = p.x;
            if (p.x > rMaxX) rMaxX = p.x;
            if (p.y < rMinY) rMinY = p.y;
            if (p.y > rMaxY) rMaxY = p.y;
          }
          if (rMaxX + 1.5 < plate.x0 || rMinX - 1.5 > plate.x1 || rMaxY + 1.5 < plate.y0 || rMinY - 1.5 > plate.y1) {
            continue;
          }
          renderRiverTo(rctx, rv, sx, sy);
        }
        rctx.restore();
        // Mask cleanly to land surface so rivers dissolve right at the ocean/lake shoreline!
        rctx.save();
        rctx.globalCompositeOperation = "destination-in";
        rctx.drawImage(plate.landMaskCanvas, 0, 0);
        rctx.restore();
        cachedRiverPlateKey = riverKey;
      }
    }

    ctx.save();
    drawPlateCropped(ctx, scratchRiverCanvas, plate.x0, plate.y0, plate.x1, plate.y1, ppc, vp);
    ctx.restore();
  } else {
    for (const rv of clippedRivers) {
      renderRiverTo(ctx, rv, ppc, ppc);
    }
  }

  for (const rv of unclippedRivers) {
    renderRiverTo(ctx, rv, ppc, ppc);
  }
}

// ---------------------------------------------------------------------------
// Overland Trails, Imperial Roads, Railroads & Nautical Sea Lanes
// ---------------------------------------------------------------------------

export function drawWorldTrail(
  ctx: CanvasRenderingContext2D,
  trail: WorldTrail,
  ppc: number,
) {
  if (trail.points.length < 2) return;
  let pts = trail.points;
  if (trail.curved && trail.points.length >= 3) {
    const cached = trailSampleCache.get(trail);
    if (cached && cached.curved) {
      pts = cached.pts;
    } else {
      pts = sampleCatmullRom(trail.points, 10, false);
      trailSampleCache.set(trail, { curved: true, pts });
    }
  }
  const wPx = Math.max(1.2, trail.widthCells * ppc);
  const dScale = Math.max(0.5, Math.min(2.5, trail.dashScale || 1));

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x * ppc, pts[0].y * ppc);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * ppc, pts[i].y * ppc);
    }
  };

  ctx.save();
  ctx.globalAlpha = Math.max(0.1, Math.min(1, trail.opacity));
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (trail.style === "double_road") {
    // Outer ink banks + warm parchment roadbed center
    trace();
    ctx.strokeStyle = trail.colorHex;
    ctx.lineWidth = wPx * 1.45;
    ctx.stroke();

    trace();
    ctx.strokeStyle = trail.outlineColorHex || "#EFE4CA";
    ctx.lineWidth = wPx * 0.72;
    ctx.stroke();
  } else if (trail.style === "railroad") {
    trace();
    ctx.strokeStyle = trail.colorHex;
    ctx.lineWidth = Math.max(1.2, wPx * 0.72);
    ctx.stroke();

    // Draw perpendicular railroad crossties along spline
    const tieStep = Math.max(5, wPx * 2.2 * dScale);
    const halfTie = wPx * 1.15;
    let acc = 0;
    ctx.strokeStyle = trail.colorHex;
    ctx.lineWidth = Math.max(1, wPx * 0.48);
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1].x * ppc;
      const ay = pts[i - 1].y * ppc;
      const bx = pts[i].x * ppc;
      const by = pts[i].y * ppc;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 0.1) continue;
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      let d = tieStep - acc;
      while (d <= len) {
        const t = d / len;
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        ctx.beginPath();
        ctx.moveTo(px - nx * halfTie, py - ny * halfTie);
        ctx.lineTo(px + nx * halfTie, py + ny * halfTie);
        ctx.stroke();
        d += tieStep;
      }
      acc = (acc + len) % tieStep;
    }
  } else if (trail.style === "sea_lane") {
    trace();
    ctx.strokeStyle = trail.colorHex;
    ctx.lineWidth = Math.max(1.1, wPx * 0.75);
    ctx.setLineDash([wPx * 3.4 * dScale, wPx * 2.1 * dScale]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Periodic subtle nautical chevron ticks
    const step = Math.max(26, wPx * 11 * dScale);
    let acc = 0;
    ctx.strokeStyle = trail.colorHex;
    ctx.lineWidth = Math.max(1.1, wPx * 0.72);
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1].x * ppc;
      const ay = pts[i - 1].y * ppc;
      const bx = pts[i].x * ppc;
      const by = pts[i].y * ppc;
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 0.1) continue;
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      const nx = -uy;
      const ny = ux;
      let d = step - acc;
      while (d <= len) {
        const t = d / len;
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        const s = Math.max(3.5, wPx * 1.65);
        ctx.beginPath();
        ctx.moveTo(px - ux * s + nx * s * 0.75, py - uy * s + ny * s * 0.75);
        ctx.lineTo(px + ux * s * 0.45, py + uy * s * 0.45);
        ctx.lineTo(px - ux * s - nx * s * 0.75, py - uy * s - ny * s * 0.75);
        ctx.stroke();
        d += step;
      }
      acc = (acc + len) % step;
    }
  } else if (trail.style === "border") {
    // Wide translucent border ribbon + crisp ink dashes
    trace();
    ctx.strokeStyle = trail.colorHex;
    ctx.globalAlpha = Math.max(0.08, trail.opacity * 0.28);
    ctx.lineWidth = wPx * 3.0;
    ctx.stroke();

    ctx.globalAlpha = Math.max(0.15, trail.opacity);
    trace();
    ctx.lineWidth = Math.max(1.2, wPx * 0.9);
    ctx.setLineDash([wPx * 3.0 * dScale, wPx * 1.4 * dScale, wPx * 0.5 * dScale, wPx * 1.4 * dScale]);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // Dotted, Dashed, or Solid
    if (trail.outlineColorHex) {
      trace();
      ctx.strokeStyle = trail.outlineColorHex;
      ctx.lineWidth = wPx + 2;
      ctx.stroke();
    }
    trace();
    ctx.strokeStyle = trail.colorHex;
    ctx.lineWidth = wPx;
    if (trail.style === "dotted") {
      ctx.setLineDash([0.05, Math.max(3.5, wPx * 2.15 * dScale)]);
    } else if (trail.style === "dashed") {
      ctx.setLineDash([wPx * 2.8 * dScale, wPx * 1.85 * dScale]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Windrose Rhumb Lines & Overland Grid (Hex / Square / Lat-Lon)
// ---------------------------------------------------------------------------

function drawRhumbLines(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  fullW: number,
  fullH: number,
  ppc: number,
) {
  const { compass } = world.overlays;
  if (!compass.visible || !compass.showRhumbLines) return;
  const cx = compass.x * ppc;
  const cy = compass.y * ppc;
  const diag = Math.hypot(fullW, fullH);
  const rays = 16;

  ctx.save();
  ctx.strokeStyle = world.theme.coastlineInkHex;
  ctx.globalAlpha = Math.max(0.03, Math.min(0.45, compass.rhumbOpacity));
  ctx.lineWidth = Math.max(0.6, ppc * 0.022);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2 + (compass.rotationDeg * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * diag, cy + Math.sin(a) * diag);
    ctx.stroke();
  }
  // Subtle concentric portolan ring around the windrose
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(fullW, fullH) * 0.36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWorldOverlandGrid(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  fullW: number,
  fullH: number,
  ppc: number,
  vp?: WorldViewportCells,
) {
  const { grid } = world.overlays;
  if (grid.style === "none" || grid.opacity <= 0.01) return;

  const stepPx = Math.max(14, grid.cellSizeCells * ppc);
  const clipX0 = vp ? Math.max(0, vp.minX * ppc) : 0;
  const clipY0 = vp ? Math.max(0, vp.minY * ppc) : 0;
  const clipX1 = vp ? Math.min(fullW, vp.maxX * ppc) : fullW;
  const clipY1 = vp ? Math.min(fullH, vp.maxY * ppc) : fullH;
  if (clipX1 <= clipX0 || clipY1 <= clipY0) return;

  ctx.save();
  ctx.strokeStyle = grid.colorHex || world.theme.coastlineInkHex;
  ctx.fillStyle = grid.colorHex || world.theme.coastlineInkHex;
  ctx.globalAlpha = Math.max(0.04, Math.min(0.85, grid.opacity));
  ctx.lineWidth = Math.max(0.7, Math.min(2.2, ppc * 0.026));

  if (grid.style === "square") {
    const startCol = Math.max(0, Math.floor(clipX0 / stepPx));
    const endCol = Math.ceil(clipX1 / stepPx);
    const startRow = Math.max(0, Math.floor(clipY0 / stepPx));
    const endRow = Math.ceil(clipY1 / stepPx);
    ctx.beginPath();
    for (let c = startCol; c <= endCol; c++) {
      const x = c * stepPx;
      if (x > fullW + 0.5) break;
      ctx.moveTo(x, clipY0);
      ctx.lineTo(x, clipY1);
    }
    for (let r = startRow; r <= endRow; r++) {
      const y = r * stepPx;
      if (y > fullH + 0.5) break;
      ctx.moveTo(clipX0, y);
      ctx.lineTo(clipX1, y);
    }
    ctx.stroke();
    if (grid.showCoords && stepPx >= 26) {
      ctx.font = `${Math.max(8, Math.round(stepPx * 0.19))}px ui-monospace, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      const maxCols = Math.ceil(fullW / stepPx);
      const maxRows = Math.ceil(fullH / stepPx);
      for (let r = startRow; r < Math.min(maxRows, endRow + 1); r++) {
        for (let c = startCol; c < Math.min(maxCols, endCol + 1); c++) {
          ctx.fillText(
            `${String(c + 1).padStart(2, "0")}${String(r + 1).padStart(2, "0")}`,
            c * stepPx + 3,
            r * stepPx + 3,
          );
        }
      }
    }
  } else if (grid.style === "lat_lon") {
    const latStep = fullH / 6;
    const lonStep = fullW / 12;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const y = i * latStep;
      if (y < clipY0 - 2 || y > clipY1 + 2) continue;
      ctx.moveTo(clipX0, y);
      ctx.lineTo(clipX1, y);
    }
    for (let i = 1; i < 12; i++) {
      const x = i * lonStep;
      if (x < clipX0 - 2 || x > clipX1 + 2) continue;
      ctx.moveTo(x, clipY0);
      ctx.lineTo(x, clipY1);
    }
    ctx.stroke();

    // Dashed Tropic & Equator emphasis lines
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (const frac of [0.5, 0.32, 0.68]) {
      const y = fullH * frac;
      if (y < clipY0 - 2 || y > clipY1 + 2) continue;
      ctx.moveTo(clipX0, y);
      ctx.lineTo(clipX1, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (grid.style === "hex_flat" || grid.style === "hex_pointy") {
    const r = stepPx * 0.58;
    const isFlat = grid.style === "hex_flat";
    const dx = isFlat ? r * 1.5 : r * Math.sqrt(3);
    const dy = isFlat ? r * Math.sqrt(3) : r * 1.5;
    const maxCols = Math.ceil(fullW / dx) + 2;
    const maxRows = Math.ceil(fullH / dy) + 2;
    const colStart = Math.max(-1, Math.floor((clipX0 - r * 2) / dx));
    const colEnd = Math.min(maxCols, Math.ceil((clipX1 + r * 2) / dx));
    const rowStart = Math.max(-1, Math.floor((clipY0 - r * 2) / dy));
    const rowEnd = Math.min(maxRows, Math.ceil((clipY1 + r * 2) / dy));
    const angleOff = isFlat ? 0 : Math.PI / 6;

    ctx.beginPath();
    for (let row = rowStart; row < rowEnd; row++) {
      for (let col = colStart; col < colEnd; col++) {
        const cx = isFlat ? col * dx : col * dx + (row & 1 ? dx * 0.5 : 0);
        const cy = isFlat ? row * dy + (col & 1 ? dy * 0.5 : 0) : row * dy;
        for (let k = 0; k < 6; k++) {
          const a = angleOff + (k * Math.PI) / 3;
          const vx = cx + Math.cos(a) * r;
          const vy = cy + Math.sin(a) * r;
          if (k === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      }
    }
    ctx.stroke();

    if (grid.showCoords && r >= 18) {
      ctx.font = `${Math.max(8, Math.round(r * 0.32))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let row = Math.max(0, rowStart); row < Math.min(maxRows - 1, rowEnd); row++) {
        for (let col = Math.max(0, colStart); col < Math.min(maxCols - 1, colEnd); col++) {
          const cx = isFlat ? col * dx : col * dx + (row & 1 ? dx * 0.5 : 0);
          const cy = isFlat ? row * dy + (col & 1 ? dy * 0.5 : 0) : row * dy;
          if (cx < clipX0 - r || cx > clipX1 + r || cy < clipY0 - r || cy > clipY1 + r) continue;
          ctx.fillText(
            `${String(col + 1).padStart(2, "0")}${String(row + 1).padStart(2, "0")}`,
            cx,
            cy - r * 0.72,
          );
        }
      }
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Y-Sorted 2.5D World Symbols (Normal, Sample Color, Tint, RGB Channels)
// ---------------------------------------------------------------------------

function drawWorldSymbol(
  ctx: CanvasRenderingContext2D,
  obj: ObjectStamp,
  layerOpacity: number,
  layerBlendMode: string,
  ppc: number,
  assetLookup: Map<string, VaultAsset>,
  interactive = false,
) {
  const url = resolveAssetUrl(obj.assetId, assetLookup);
  const rawImg = texturePool.get(url);
  if (!rawImg) return;
  const meta = assetLookup.get(obj.assetId);
  const img = getProcessedTexture(rawImg, url, obj.recolor, meta);

  const wPx = obj.widthCells * ppc;
  const hPx = obj.heightCells * ppc;

  ctx.save();
  if (layerBlendMode && layerBlendMode !== "normal") {
    ctx.globalCompositeOperation = layerBlendMode as GlobalCompositeOperation;
  }
  ctx.translate(obj.x * ppc, obj.y * ppc);
  ctx.rotate(obj.rotationRad);
  ctx.scale(obj.flipX ? -1 : 1, obj.flipY ? -1 : 1);
  ctx.globalAlpha = Math.max(0.05, Math.min(1, obj.opacity * layerOpacity));

  // Skip software Gaussian shadowBlur during active pan/zoom AND on tiny overview sprites (<30px)!
  if (!interactive && obj.castsShadow && layerBlendMode !== "multiply" && Math.max(wPx, hPx) >= 30) {
    // Subtle soft warm cartography contact shadow under base of mountains/cities/ships (capped <= 4.5px!)
    ctx.shadowColor = "rgba(28, 18, 10, 0.22)";
    ctx.shadowBlur = Math.min(4.5, Math.max(1.5, ppc * 0.06));
    ctx.shadowOffsetX = Math.min(3, ppc * 0.035);
    ctx.shadowOffsetY = Math.min(4, ppc * 0.05);
  }

  ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Curved Arc Cartographic Labels & Ornamental Scroll / Banner Cartouches
// ---------------------------------------------------------------------------

function drawLabelBackingBox(
  ctx: CanvasRenderingContext2D,
  label: WorldLabel,
  textW: number,
  fontPx: number,
  world: WorldMapData,
) {
  const padX = Math.max(12, fontPx * 0.85);
  const padY = Math.max(6, fontPx * 0.42);
  const bw = textW + padX * 2;
  const bh = fontPx + padY * 2;
  const x0 = -bw / 2;
  const y0 = -bh / 2;
  const ink = world.theme.coastlineInkHex || "#3A281A";
  const paper = world.theme.landBaseColorHex || "#EADBC2";

  ctx.save();
  ctx.shadowColor = "rgba(18, 12, 8, 0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  if (label.boxStyle === "scroll") {
    const curl = Math.max(8, bh * 0.3);
    // Main unfurled parchment body
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.4, fontPx * 0.065);
    ctx.beginPath();
    ctx.roundRect(x0, y0, bw, bh, 4);
    ctx.fill();
    ctx.stroke();

    // Left & right curled parchment scroll ends
    ctx.shadowColor = "transparent";
    ctx.fillStyle = world.theme.oceanStainHex || "#C5AE8A";
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x0 - curl * 0.35 : x0 + bw + curl * 0.35;
      ctx.beginPath();
      ctx.roundRect(cx - curl * 0.45, y0 - 3, curl * 0.9, bh + 6, curl * 0.45);
      ctx.fill();
      ctx.stroke();
    }
    // Delicate inner frame rule
    ctx.strokeStyle = ink;
    ctx.globalAlpha *= 0.45;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(x0 + 4, y0 + 3.5, bw - 8, bh - 7);
  } else if (label.boxStyle === "banner") {
    const tail = Math.max(14, bh * 0.55);
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.4, fontPx * 0.065);
    // Swallowtail ribbon ends
    ctx.beginPath();
    ctx.moveTo(x0, y0 + 3);
    ctx.lineTo(x0 - tail, y0 + 5);
    ctx.lineTo(x0 - tail * 0.55, 0);
    ctx.lineTo(x0 - tail, y0 + bh - 3);
    ctx.lineTo(x0, y0 + bh - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x0 + bw, y0 + 3);
    ctx.lineTo(x0 + bw + tail, y0 + 5);
    ctx.lineTo(x0 + bw + tail * 0.55, 0);
    ctx.lineTo(x0 + bw + tail, y0 + bh - 3);
    ctx.lineTo(x0 + bw, y0 + bh - 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Center ribbon crest
    ctx.fillStyle = paper;
    ctx.beginPath();
    ctx.roundRect(x0, y0, bw, bh, 3);
    ctx.fill();
    ctx.stroke();
  } else if (label.boxStyle === "ribbon") {
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.3, fontPx * 0.06);
    ctx.beginPath();
    ctx.roundRect(x0, y0, bw, bh, bh * 0.48);
    ctx.fill();
    ctx.stroke();
  } else if (label.boxStyle === "plaque") {
    ctx.fillStyle = paper;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1.8, fontPx * 0.075);
    ctx.beginPath();
    ctx.rect(x0, y0, bw, bh);
    ctx.fill();
    ctx.stroke();
    ctx.shadowColor = "transparent";
    ctx.lineWidth = 0.9;
    ctx.strokeRect(x0 + 4, y0 + 4, bw - 8, bh - 8);
    // Corner rivets
    ctx.fillStyle = ink;
    for (const cx of [x0 + 7, x0 + bw - 7]) {
      for (const cy of [y0 + 7, y0 + bh - 7]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

export function drawWorldLabel(
  ctx: CanvasRenderingContext2D,
  label: WorldLabel,
  world: WorldMapData,
  ppc: number,
  isSelected = false,
  interactive = false,
) {
  const rawText = label.uppercase ? label.text.toUpperCase() : label.text;
  if (!rawText.trim()) return;

  const scaleFactor = ppc / 32;
  const fontPx = Math.max(3.8, label.fontSizePx * scaleFactor);
  const trackingPx = (label.letterSpacing || 0) * scaleFactor;
  const lineH = fontPx * (label.lineHeight ?? 1.15);

  ctx.save();
  ctx.translate(label.x * ppc, label.y * ppc);
  ctx.rotate((label.rotationDeg * Math.PI) / 180);
  ctx.globalAlpha = Math.max(0.05, Math.min(1, label.opacity));

  const stylePrefix = `${label.italic ? "italic " : ""}${label.bold ? "700 " : "500 "}`;
  ctx.font = `${stylePrefix}${fontPx.toFixed(1)}px ${label.fontFamily || world.theme.fontFamilyDisplay}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const rawLines = rawText.split("\n");
  const isCurved = Math.abs(label.curveBend) > 0.02;
  const canUseFastStraight = !isCurved && (trackingPx <= 0.45 || "letterSpacing" in ctx);

  if (canUseFastStraight) {
    // Fast native-text path (~10x faster than per-character measureText/save/translate/restore!)
    if (trackingPx > 0.45 && "letterSpacing" in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${trackingPx.toFixed(2)}px`;
    }
    let totalWidth = 4;
    if (label.boxStyle !== "none" || isSelected) {
      for (const ln of rawLines) {
        const w = ctx.measureText(ln).width;
        if (w > totalWidth) totalWidth = w;
      }
    }
    const totalBlockH = fontPx + Math.max(0, rawLines.length - 1) * lineH;
    if (label.boxStyle !== "none") {
      drawLabelBackingBox(ctx, label, totalWidth, totalBlockH, world);
    }

    const outlineW = Math.max(0, label.outlineWidth * scaleFactor);
    ctx.fillStyle = label.colorHex;
    ctx.strokeStyle = label.outlineColorHex;
    ctx.lineWidth = outlineW * 2;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    if (!interactive && label.shadowColorHex) {
      ctx.shadowColor = label.shadowColorHex;
      ctx.shadowBlur = Math.min(8, Math.max(2, fontPx * 0.22));
      ctx.shadowOffsetX = Math.min(4, Math.max(0.8, fontPx * 0.05));
      ctx.shadowOffsetY = Math.min(5, Math.max(1.0, fontPx * 0.07));
    }

    const blockStartY = -((rawLines.length - 1) * lineH) * 0.5;
    for (let li = 0; li < rawLines.length; li++) {
      const lineY = blockStartY + li * lineH;
      if (outlineW > 0.15) ctx.strokeText(rawLines[li], 0, lineY);
      ctx.fillText(rawLines[li], 0, lineY);
    }

    if (isSelected) {
      ctx.shadowColor = "transparent";
      const bw = totalWidth + Math.max(14, fontPx * 0.6);
      const bh = totalBlockH + Math.max(10, fontPx * 0.45);
      ctx.strokeStyle = "#E5A93C";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
      ctx.setLineDash([]);
    }
    ctx.restore();
    return;
  }

  const lines = rawLines.map((ln) => {
    const chars = Array.from(ln);
    const widths = chars.map((ch) => ctx.measureText(ch).width);
    const width =
      widths.reduce((a, b) => a + b, 0) + Math.max(0, chars.length - 1) * trackingPx;
    return { chars, widths, width };
  });
  const totalWidth = Math.max(4, ...lines.map((l) => l.width));
  const totalBlockH = fontPx + Math.max(0, lines.length - 1) * lineH;

  if (label.boxStyle !== "none") {
    drawLabelBackingBox(ctx, label, totalWidth, totalBlockH, world);
  }

  const outlineW = Math.max(0, label.outlineWidth * scaleFactor);
  ctx.fillStyle = label.colorHex;
  ctx.strokeStyle = label.outlineColorHex;
  ctx.lineWidth = outlineW * 2;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  const drawGlyph = (ch: string) => {
    if (!interactive && label.shadowColorHex) {
      ctx.save();
      ctx.shadowColor = label.shadowColorHex;
      ctx.shadowBlur = Math.min(8, Math.max(2, fontPx * 0.22));
      ctx.shadowOffsetX = Math.min(4, Math.max(0.8, fontPx * 0.05));
      ctx.shadowOffsetY = Math.min(5, Math.max(1.0, fontPx * 0.07));
      if (outlineW > 0.15) ctx.strokeText(ch, 0, 0);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      return;
    }
    if (outlineW > 0.15) {
      ctx.strokeText(ch, 0, 0);
    }
    ctx.fillText(ch, 0, 0);
  };

  const blockStartY = -((lines.length - 1) * lineH) * 0.5;
  for (let li = 0; li < lines.length; li++) {
    const { chars, widths, width: lineW } = lines[li];
    const lineY = blockStartY + li * lineH;

    if (Math.abs(label.curveBend) > 0.02 && lineW > 4) {
      const sweepRad = label.curveBend * 1.38;
      const radius = lineW / Math.abs(sweepRad);
      const sign = sweepRad >= 0 ? 1 : -1;
      let cursor = -lineW / 2;

      for (let i = 0; i < chars.length; i++) {
        const cw = widths[i];
        const mid = cursor + cw * 0.5;
        const theta = (mid / radius) * sign;
        const gx = Math.sin(theta) * radius * sign;
        const gy = (1 - Math.cos(theta)) * radius * sign;

        ctx.save();
        ctx.translate(
          gx,
          lineY + gy - (1 - Math.cos(Math.abs(sweepRad) * 0.5)) * radius * sign * 0.35,
        );
        ctx.rotate(theta);
        drawGlyph(chars[i]);
        ctx.restore();

        cursor += cw + trackingPx;
      }
    } else {
      let cursor = -lineW / 2;
      for (let i = 0; i < chars.length; i++) {
        const cw = widths[i];
        ctx.save();
        ctx.translate(cursor + cw * 0.5, lineY);
        drawGlyph(chars[i]);
        ctx.restore();
        cursor += cw + trackingPx;
      }
    }
  }

  if (isSelected) {
    const bw = totalWidth + Math.max(14, fontPx * 0.6);
    const bh = totalBlockH + Math.max(10, fontPx * 0.45);
    ctx.strokeStyle = "#E5A93C";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 3]);
    ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Compass Rose, Calibrated Scale Bar, Sub-Map Pins & Ornamental Map Frames
// ---------------------------------------------------------------------------

function drawCompassRoseOverlay(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  ppc: number,
  assetLookup: Map<string, VaultAsset>,
  vp?: WorldViewportCells,
  interactive = false,
) {
  const { compass } = world.overlays;
  if (!compass.visible) return;
  const halfCells = 2.4 * Math.max(0.35, Math.min(2.5, compass.scale));
  if (
    vp &&
    (compass.x + halfCells < vp.minX ||
      compass.x - halfCells > vp.maxX ||
      compass.y + halfCells < vp.minY ||
      compass.y - halfCells > vp.maxY)
  ) {
    return;
  }
  const cx = compass.x * ppc;
  const cy = compass.y * ppc;
  const sizePx = 4.2 * ppc * Math.max(0.35, Math.min(2.5, compass.scale));
  const url = resolveAssetUrl(compass.assetId, assetLookup);
  const img = texturePool.get(url);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((compass.rotationDeg * Math.PI) / 180);

  if (img) {
    ctx.globalAlpha = 0.88;
    if (!interactive) {
      ctx.shadowColor = "rgba(20, 14, 8, 0.28)";
      ctx.shadowBlur = Math.min(8, Math.max(3, ppc * 0.1));
    }
    ctx.drawImage(img, -sizePx / 2, -sizePx / 2, sizePx, sizePx);
  } else {
    // Crisp engraved vector fallback while image loads
    const r = sizePx * 0.44;
    ctx.strokeStyle = world.theme.coastlineInkHex;
    ctx.fillStyle = world.theme.coastlineInkHex;
    ctx.lineWidth = Math.max(1.2, ppc * 0.045);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + 0.35) * r * 0.26, Math.sin(a + 0.35) * r * 0.26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.font = `700 ${Math.max(9, Math.round(r * 0.28))}px ${world.theme.fontFamilyDisplay}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("N", 0, -r * 1.04);
  }
  ctx.restore();
}

function drawScaleBarOverlay(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  ppc: number,
  vp?: WorldViewportCells,
) {
  const { scaleBar } = world.overlays;
  if (!scaleBar.visible) return;
  const segs = Math.max(2, Math.min(8, Math.round(scaleBar.segments || 4)));
  const segCells = 1.6;
  const halfWCells = segCells * segs * 0.5 + 1.5;
  if (
    vp &&
    (scaleBar.x + halfWCells < vp.minX ||
      scaleBar.x - halfWCells > vp.maxX ||
      scaleBar.y + 2.0 < vp.minY ||
      scaleBar.y - 2.0 > vp.maxY)
  ) {
    return;
  }
  const segW = segCells * ppc;
  const totalW = segW * segs;
  const barH = Math.max(6, ppc * 0.24);
  const x0 = scaleBar.x * ppc - totalW / 2;
  const y0 = scaleBar.y * ppc;

  const unitMult = scaleBar.unit === "km" ? 1.60934 : scaleBar.unit === "leagues" ? 1 / 3 : 1;
  const unitLabel = scaleBar.unit === "km" ? "km" : scaleBar.unit === "leagues" ? "leagues" : "mi";
  const milesPerSeg = scaleBar.milesPerCell * segCells;
  const totalUnits = Math.round(milesPerSeg * segs * unitMult);

  const ink = world.theme.coastlineInkHex || "#2F2014";
  const paper = world.theme.landBaseColorHex || "#EFE4CA";
  const [or, og, ob] = hexToRgb(world.theme.oceanDeepColorHex);
  const darkOcean = (or * 0.299 + og * 0.587 + ob * 0.114) < 88;
  const compactOverlay = Boolean(world.overlays.legend?.visible) && darkOcean;

  ctx.save();
  if (!compactOverlay) {
    // Subtle parchment backing plate for legibility over medium-tone ocean or land
    ctx.fillStyle = world.theme.labelOutlineHex;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    ctx.roundRect(x0 - 10, y0 - barH * 2.1, totalW + 20, barH * 3.8, 4);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = compactOverlay ? "#14110D" : ink;
  ctx.lineWidth = Math.max(1, ppc * 0.035);

  if (scaleBar.style === "minimal") {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + totalW, y0);
    for (let i = 0; i <= segs; i++) {
      const tx = x0 + i * segW;
      ctx.moveTo(tx, y0 - barH * 0.7);
      ctx.lineTo(tx, y0 + barH * 0.35);
    }
    ctx.stroke();
  } else {
    const rows = scaleBar.style === "double_bar" ? 2 : 1;
    const rowH = barH / rows;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < segs; i++) {
        ctx.fillStyle = (i + r) % 2 === 0 ? (compactOverlay ? "#11100E" : ink) : (compactOverlay ? "#F5EFE0" : paper);
        ctx.fillRect(x0 + i * segW, y0 - barH * 0.5 + r * rowH, segW, rowH);
      }
    }
    ctx.strokeRect(x0, y0 - barH * 0.5, totalW, barH);
  }

  const fPx = Math.max(9.5, Math.round(ppc * 0.38));
  ctx.font = `700 ${fPx}px ${world.theme.fontFamilyBody}`;
  ctx.textBaseline = "bottom";
  const drawScaleText = (txt: string, tx: number, align: CanvasTextAlign) => {
    ctx.textAlign = align;
    if (compactOverlay) {
      ctx.strokeStyle = "rgba(10, 8, 6, 0.85)";
      ctx.lineWidth = Math.max(2, fPx * 0.25);
      ctx.lineJoin = "round";
      ctx.strokeText(txt, tx, y0 - barH * 0.75);
      ctx.fillStyle = "#F2E9D4";
      ctx.fillText(txt, tx, y0 - barH * 0.75);
    } else {
      ctx.fillStyle = ink;
      ctx.fillText(txt, tx, y0 - barH * 0.75);
    }
  };
  drawScaleText("0", x0, "left");
  if (!compactOverlay) {
    drawScaleText(String(Math.round(totalUnits / 2)), x0 + totalW / 2, "center");
  }
  drawScaleText(`${totalUnits} ${unitLabel}`, x0 + totalW, "right");
  ctx.restore();
}

function drawLegendOverlay(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  ppc: number,
  vp?: WorldViewportCells,
  interactive = false,
) {
  const legend = world.overlays.legend;
  if (!legend || !legend.visible || legend.entries.length === 0) return;
  if (
    vp &&
    (legend.x + 8 < vp.minX ||
      legend.x - 8 > vp.maxX ||
      legend.y + 5 < vp.minY ||
      legend.y - 5 > vp.maxY)
  ) {
    return;
  }

  const scale = ppc / 32;
  const fPx = Math.max(9, 11.5 * scale);
  const rowH = Math.max(13, 15.8 * scale);
  const swatchW = Math.max(32, 48 * scale);
  const padX = Math.max(11, 13 * scale);
  const padY = Math.max(8, 10 * scale);
  const titleH = legend.title ? rowH * 1.1 : 0;

  ctx.save();
  ctx.font = `600 ${fPx.toFixed(1)}px ${world.theme.fontFamilyBody}`;
  const maxTextW = Math.max(
    60 * scale,
    ...legend.entries.map((e) => ctx.measureText(e.label).width),
  );
  const bw = padX * 2 + maxTextW + 12 * scale + swatchW;
  const bh = padY * 2 + titleH + legend.entries.length * rowH;
  const x0 = legend.x * ppc - bw / 2;
  const y0 = legend.y * ppc - bh / 2;

  const paper = world.theme.landBaseColorHex || "#E8D7B2";
  const ink = world.theme.coastlineInkHex || "#2A1F14";

  // Double-bordered antique parchment legend plaque (matches Tro'fraderra travel key!)
  if (!interactive) {
    ctx.shadowColor = "rgba(12, 8, 4, 0.45)";
    ctx.shadowBlur = Math.min(8, Math.max(4, 6 * scale));
    ctx.shadowOffsetY = Math.min(5, Math.max(2, 3 * scale));
  }
  ctx.fillStyle = paper;
  ctx.fillRect(x0, y0, bw, bh);
  ctx.shadowColor = "transparent";

  ctx.strokeStyle = ink;
  ctx.lineWidth = Math.max(1.5, 2.0 * scale);
  ctx.strokeRect(x0, y0, bw, bh);
  ctx.lineWidth = Math.max(0.8, 1.0 * scale);
  ctx.strokeRect(x0 + 3.5 * scale, y0 + 3.5 * scale, bw - 7 * scale, bh - 7 * scale);

  let curY = y0 + padY;
  if (legend.title) {
    ctx.fillStyle = ink;
    ctx.font = `700 ${(fPx * 1.05).toFixed(1)}px ${world.theme.fontFamilyDisplay}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(legend.title, x0 + bw / 2, curY + titleH * 0.45);
    curY += titleH;
  }

  ctx.font = `600 ${fPx.toFixed(1)}px ${world.theme.fontFamilyBody}`;
  for (let i = 0; i < legend.entries.length; i++) {
    const entry = legend.entries[i];
    const ry = curY + i * rowH + rowH * 0.5;
    ctx.fillStyle = ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(entry.label, x0 + padX, ry);

    // Draw scaled miniature route rule swatch with tick endcaps
    const sx0 = x0 + bw - padX - swatchW;
    const sx1 = x0 + bw - padX;
    ctx.save();
    ctx.strokeStyle = entry.colorHex || ink;
    ctx.lineWidth = Math.max(1.1, 1.45 * scale);
    // Vertical tick endcaps
    ctx.beginPath();
    ctx.moveTo(sx0, ry - 3 * scale);
    ctx.lineTo(sx0, ry + 3 * scale);
    ctx.moveTo(sx1, ry - 3 * scale);
    ctx.lineTo(sx1, ry + 3 * scale);
    ctx.stroke();

    const ds = entry.dashScale ?? 1;
    if (entry.style === "dotted") {
      ctx.setLineDash([1.2 * scale, 2.8 * scale * ds]);
    } else if (entry.style === "dashed" || entry.style === "sea_lane") {
      ctx.setLineDash([4.2 * scale * ds, 2.6 * scale * ds]);
    } else if (entry.style === "border") {
      ctx.setLineDash([5 * scale * ds, 2 * scale, 1.2 * scale, 2 * scale]);
    }
    ctx.beginPath();
    ctx.moveTo(sx0 + 1.5 * scale, ry);
    ctx.lineTo(sx1 - 1.5 * scale, ry);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.restore();
}

function drawTraceOverlay(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  fullW: number,
  fullH: number,
  ppc: number,
) {
  const tr = world.overlays.traceOverlay;
  if (!tr || !tr.visible || !tr.imageUrl) return;
  const img = texturePool.get(tr.imageUrl);
  if (!img) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(0.95, tr.opacity));
  const dw = fullW * Math.max(0.25, Math.min(2.5, tr.scale || 1));
  const dh = fullH * Math.max(0.25, Math.min(2.5, tr.scale || 1));
  const dx = (fullW - dw) * 0.5 + (tr.offsetXCells || 0) * ppc;
  const dy = (fullH - dh) * 0.5 + (tr.offsetYCells || 0) * ppc;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawWorldSubMapPins(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  ppc: number,
  selectedId?: string | null,
) {
  for (const pin of world.subMapPins) {
    const px = pin.x * ppc;
    const py = pin.y * ppc;
    const isSel = selectedId === pin.id;

    ctx.save();
    // Optional cropped region outline when selected
    if (pin.bounds && isSel) {
      ctx.strokeStyle = pin.colorHex || "#E5A93C";
      ctx.lineWidth = Math.max(1.5, ppc * 0.05);
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(
        pin.bounds.x0 * ppc,
        pin.bounds.y0 * ppc,
        (pin.bounds.x1 - pin.bounds.x0) * ppc,
        (pin.bounds.y1 - pin.bounds.y0) * ppc,
      );
      ctx.setLineDash([]);
    }

    const r = Math.max(7, ppc * 0.28);
    ctx.fillStyle = pin.colorHex || "#E5A93C";
    ctx.strokeStyle = "#18120C";
    ctx.lineWidth = Math.max(1.5, ppc * 0.05);
    ctx.beginPath();
    ctx.moveTo(px, py - r * 1.2);
    ctx.lineTo(px + r, py);
    ctx.lineTo(px, py + r * 1.2);
    ctx.lineTo(px - r, py);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#FFF8E7";
    ctx.beginPath();
    ctx.arc(px, py, r * 0.34, 0, Math.PI * 2);
    ctx.fill();

    const fPx = Math.max(9, Math.round(ppc * 0.28));
    ctx.font = `700 ${fPx}px Inter, system-ui, sans-serif`;
    const tag = `${pin.targetKind === "battlemap" ? "⚔ " : "🗺 "}${pin.label}`;
    const tw = ctx.measureText(tag).width + 10;
    const th = fPx + 6;
    ctx.fillStyle = "rgba(18, 16, 22, 0.84)";
    ctx.strokeStyle = isSel ? "#FBBF24" : pin.colorHex || "#E5A93C";
    ctx.lineWidth = isSel ? 2 : 1.1;
    ctx.beginPath();
    ctx.roundRect(px - tw / 2, py + r * 1.4, tw, th, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#F8FAFC";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(tag, px, py + r * 1.4 + th / 2 + 0.5);
    ctx.restore();
  }
}

function drawOrnamentalMapFrame(
  ctx: CanvasRenderingContext2D,
  world: WorldMapData,
  fullW: number,
  fullH: number,
  ppc: number,
  vp?: WorldViewportCells,
  interactive = false,
) {
  const { frame } = world.overlays;
  const vig = Math.max(0, Math.min(1, world.theme.vignetteStrength));

  // Rich vintage atlas paper edge vignette (clamped to visible viewport so zoomed-in frames don't fill 32Kx18K!)
  if (vig > 0.02) {
    ctx.save();
    const cx = fullW * 0.5;
    const cy = fullH * 0.5;
    const innerR = Math.min(fullW, fullH) * 0.36;
    const outerR = Math.hypot(cx, cy) * 1.04;
    const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(0.62, `rgba(24, 15, 6, ${(vig * 0.22).toFixed(3)})`);
    grad.addColorStop(1, `rgba(14, 9, 4, ${(vig * 0.68).toFixed(3)})`);
    ctx.fillStyle = grad;
    const vx0 = vp ? Math.max(0, vp.minX * ppc) : 0;
    const vy0 = vp ? Math.max(0, vp.minY * ppc) : 0;
    const vx1 = vp ? Math.min(fullW, vp.maxX * ppc) : fullW;
    const vy1 = vp ? Math.min(fullH, vp.maxY * ppc) : fullH;
    if (vx1 > vx0 && vy1 > vy0) {
      ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    }
    ctx.restore();
  }

  if (frame.style === "none") return;

  const scale = ppc / 32;
  const pad = Math.max(10, Math.round(frame.widthPx * scale));
  // Frustum-cull outer frame borders when zoomed strictly into the map interior!
  if (vp) {
    const borderMarginCells = Math.max(2.5, (pad * 2.5) / Math.max(1, ppc));
    const wCells = fullW / Math.max(1, ppc);
    const hCells = fullH / Math.max(1, ppc);
    if (
      vp.minX > borderMarginCells &&
      vp.maxX < wCells - borderMarginCells &&
      vp.minY > borderMarginCells &&
      vp.maxY < hCells - borderMarginCells
    ) {
      return;
    }
  }
  const ink = frame.colorHex || world.theme.frameColorHex;

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;

  if (frame.style === "classic_double") {
    ctx.lineWidth = Math.max(2, 2.6 * scale);
    ctx.strokeRect(pad * 0.55, pad * 0.55, fullW - pad * 1.1, fullH - pad * 1.1);
    ctx.lineWidth = Math.max(1, 1.1 * scale);
    ctx.strokeRect(pad, pad, fullW - pad * 2, fullH - pad * 2);

    // Mitered corner accent squares
    const cSz = pad * 0.45;
    for (const cx of [pad * 0.55, fullW - pad]) {
      for (const cy of [pad * 0.55, fullH - pad]) {
        ctx.strokeRect(cx, cy, cSz, cSz);
      }
    }
  } else if (frame.style === "ornate_gold") {
    ctx.lineWidth = Math.max(3, 4.2 * scale);
    ctx.strokeStyle = ink;
    ctx.strokeRect(pad * 0.5, pad * 0.5, fullW - pad, fullH - pad);

    ctx.lineWidth = Math.max(1.2, 1.4 * scale);
    ctx.strokeStyle = "#F5D07A";
    ctx.strokeRect(pad * 0.72, pad * 0.72, fullW - pad * 1.44, fullH - pad * 1.44);

    ctx.strokeStyle = ink;
    ctx.strokeRect(pad * 1.05, pad * 1.05, fullW - pad * 2.1, fullH - pad * 2.1);

    // Corner filigree diamond medallions
    const cr = pad * 0.55;
    for (const [cx, cy] of [
      [pad * 0.75, pad * 0.75],
      [fullW - pad * 0.75, pad * 0.75],
      [pad * 0.75, fullH - pad * 0.75],
      [fullW - pad * 0.75, fullH - pad * 0.75],
    ]) {
      ctx.fillStyle = world.theme.landBaseColorHex;
      ctx.beginPath();
      ctx.moveTo(cx, cy - cr);
      ctx.lineTo(cx + cr, cy);
      ctx.lineTo(cx, cy + cr);
      ctx.lineTo(cx - cr, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (frame.style === "stepped_ivory") {
    // Iconic stepped art-deco ivory cartographic frame (Tro'fraderra signature border!)
    const inset = Math.max(10, pad * 0.78);
    const barW = Math.max(3.2, 5.2 * scale);
    const step = Math.max(16, 26 * scale);
    const inner = Math.max(9, 15 * scale);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = barW;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";

    // Subtle dark drop shadow behind ivory rule (capped <= 8px so high zoom stays 60fps!)
    if (!interactive) {
      ctx.shadowColor = "rgba(10, 8, 5, 0.55)";
      ctx.shadowBlur = Math.min(8, Math.max(3, 5 * scale));
    }

    // Main outer border with stepped corner cutouts in NW and SE corners
    ctx.beginPath();
    // Top edge (from NW step -> NE corner)
    ctx.moveTo(inset + step, inset);
    ctx.lineTo(fullW - inset, inset);
    // Right edge (down to SE step)
    ctx.lineTo(fullW - inset, fullH - inset - step);
    // SE stepped corner jog
    ctx.lineTo(fullW - inset - inner, fullH - inset - step);
    ctx.lineTo(fullW - inset - inner, fullH - inset);
    // Bottom edge (to SW corner)
    ctx.lineTo(inset, fullH - inset);
    // Left edge (up to NW step)
    ctx.lineTo(inset, inset + step);
    // NW stepped corner jog
    ctx.lineTo(inset + inner, inset + step);
    ctx.lineTo(inset + inner, inset);
    ctx.lineTo(inset + step, inset);
    ctx.stroke();

    // Inner interlocking geometric accent brackets & dots in NW and SE corners
    ctx.lineWidth = Math.max(2.2, 3.6 * scale);
    // NW corner inner L-step + two accent pips
    ctx.beginPath();
    ctx.moveTo(inset + inner * 1.9, inset + inner * 0.65);
    ctx.lineTo(inset + inner * 1.9, inset + step * 1.45);
    ctx.moveTo(inset + inner * 0.65, inset + step * 1.55);
    ctx.lineTo(inset + inner * 1.9, inset + step * 1.55);
    ctx.stroke();
    const dotR = Math.max(2, 2.8 * scale);
    ctx.fillRect(inset + step * 1.35, inset + inner * 0.65, dotR * 2.4, dotR * 1.4);
    ctx.fillRect(inset + step * 2.1, inset + inner * 0.65, dotR * 1.4, dotR * 1.4);
    ctx.fillRect(inset + inner * 0.65, inset + step * 2.0, dotR * 1.4, dotR * 1.4);

    // SE corner inner L-step + two accent pips
    ctx.beginPath();
    ctx.moveTo(fullW - inset - inner * 1.9, fullH - inset - inner * 0.65);
    ctx.lineTo(fullW - inset - inner * 1.9, fullH - inset - step * 1.45);
    ctx.moveTo(fullW - inset - inner * 0.65, fullH - inset - step * 1.55);
    ctx.lineTo(fullW - inset - inner * 1.9, fullH - inset - step * 1.55);
    ctx.stroke();
    ctx.fillRect(fullW - inset - step * 1.75, fullH - inset - inner * 0.85, dotR * 2.4, dotR * 1.4);
    ctx.fillRect(fullW - inset - step * 2.3, fullH - inset - inner * 0.85, dotR * 1.4, dotR * 1.4);
  } else if (frame.style === "nautical_degree") {
    const bar = Math.max(8, pad * 0.58);
    const segCountX = 16;
    const segCountY = 9;
    const segW = (fullW - bar * 2) / segCountX;
    const segH = (fullH - bar * 2) / segCountY;
    const altPaper = world.theme.landBaseColorHex;

    // Top & Bottom alternating degree segments
    for (let i = 0; i < segCountX; i++) {
      ctx.fillStyle = i % 2 === 0 ? ink : altPaper;
      ctx.fillRect(bar + i * segW, 0, segW, bar);
      ctx.fillRect(bar + i * segW, fullH - bar, segW, bar);
    }
    // Left & Right alternating degree segments
    for (let j = 0; j < segCountY; j++) {
      ctx.fillStyle = j % 2 === 0 ? ink : altPaper;
      ctx.fillRect(0, bar + j * segH, bar, segH);
      ctx.fillRect(fullW - bar, bar + j * segH, bar, segH);
    }
    // Corner squares & border outlines
    ctx.fillStyle = ink;
    ctx.fillRect(0, 0, bar, bar);
    ctx.fillRect(fullW - bar, 0, bar, bar);
    ctx.fillRect(0, fullH - bar, bar, bar);
    ctx.fillRect(fullW - bar, fullH - bar, bar, bar);

    ctx.lineWidth = Math.max(1.2, 1.4 * scale);
    ctx.strokeStyle = ink;
    ctx.strokeRect(bar, bar, fullW - bar * 2, fullH - bar * 2);
    ctx.strokeRect(0.5, 0.5, fullW - 1, fullH - 1);
  } else if (frame.style === "feudal_ink") {
    ctx.lineWidth = Math.max(4, 5.2 * scale);
    ctx.strokeRect(pad * 0.6, pad * 0.6, fullW - pad * 1.2, fullH - pad * 1.2);
    ctx.lineWidth = Math.max(1.2, 1.5 * scale);
    ctx.setLineDash([12 * scale, 4 * scale]);
    ctx.strokeRect(pad * 1.15, pad * 1.15, fullW - pad * 2.3, fullH - pad * 2.3);
    ctx.setLineDash([]);
  } else if (frame.style === "torn_parchment") {
    // Aged burned border gradient + subtle hand-inked inner deckle
    const edgeGradW = pad * 1.4;
    const drawEdge = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, "rgba(42, 24, 10, 0.52)");
      g.addColorStop(1, "rgba(42, 24, 10, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(rx, ry, rw, rh);
    };
    drawEdge(0, 0, 0, edgeGradW, 0, 0, fullW, edgeGradW);
    drawEdge(0, fullH, 0, fullH - edgeGradW, 0, fullH - edgeGradW, fullW, edgeGradW);
    drawEdge(0, 0, edgeGradW, 0, 0, 0, edgeGradW, fullH);
    drawEdge(fullW, 0, fullW - edgeGradW, 0, fullW - edgeGradW, 0, edgeGradW, fullH);

    ctx.lineWidth = Math.max(1.2, 1.4 * scale);
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(pad * 0.9, pad * 0.9, fullW - pad * 1.8, fullH - pad * 1.8);
  }

  ctx.restore();
}

function drawWorldDmPins(
  ctx: CanvasRenderingContext2D,
  notes: DmNotePin[],
  ppc: number,
) {
  for (const note of notes) {
    const nx = note.x * ppc;
    const ny = note.y * ppc;
    const label = `[${note.badge}] ${note.title}`;
    ctx.save();
    ctx.font = `700 ${Math.max(10, Math.round(ppc * 0.34))}px Inter, system-ui, sans-serif`;
    const tw = ctx.measureText(label).width + 14;
    const th = Math.max(20, ppc * 0.58);
    ctx.fillStyle = "rgba(13, 17, 23, 0.88)";
    ctx.strokeStyle = note.colorHex;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(nx - tw / 2, ny - th / 2, tw, th, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = note.colorHex;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, nx, ny + 0.5);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Main World Atlas Scene Entrypoint
// ---------------------------------------------------------------------------

export function renderWorldMapScene(
  ctx: CanvasRenderingContext2D,
  doc: DcMapDocument,
  assetLookup: Map<string, VaultAsset>,
  opts: RenderOptions,
): void {
  const world = doc.world;
  if (!world) return;

  const ppc = opts.pixelsPerCell;
  const fullW = doc.canvas.widthCells * ppc;
  const fullH = doc.canvas.heightCells * ppc;
  const vp = opts.viewportCells;
  const interactive = Boolean(opts.interactive || vp?.allowDetailPlate === false);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = interactive ? "medium" : "high";

  // 1. Cached Viewport-Adaptive Infinite-Zoom SDF Ocean + Coastlines + Rag-Parchment + Organic Biomes
  const plate = getOrBuildWorldBasePlate(doc, world, assetLookup, fullW, fullH, opts);
  if (plate) {
    // Only draw overview backdrop behind a cropped detailPlate if detailPlate doesn't cover 100% of vp!
    const detailCoversVp =
      vp !== undefined &&
      plate.x0 <= vp.minX + 0.01 &&
      plate.y0 <= vp.minY + 0.01 &&
      plate.x1 >= vp.maxX - 0.01 &&
      plate.y1 >= vp.maxY - 0.01;
    if (cachedOverviewPlate && plate !== cachedOverviewPlate && !detailCoversVp) {
      drawPlateCropped(
        ctx,
        cachedOverviewPlate.plateCanvas,
        cachedOverviewPlate.x0,
        cachedOverviewPlate.y0,
        cachedOverviewPlate.x1,
        cachedOverviewPlate.y1,
        ppc,
        vp,
      );
    }
    drawPlateCropped(ctx, plate.plateCanvas, plate.x0, plate.y0, plate.x1, plate.y1, ppc, vp);
  } else {
    ctx.fillStyle = world.theme.oceanColorHex;
    if (vp) {
      ctx.fillRect(
        vp.minX * ppc,
        vp.minY * ppc,
        (vp.maxX - vp.minX) * ppc,
        (vp.maxY - vp.minY) * ppc,
      );
    } else {
      ctx.fillRect(0, 0, fullW, fullH);
    }
  }

  // Optional Underlay Reference Trace Image (editor/DM view only!)
  if (opts.dmView && world.overlays.traceOverlay?.visible && !world.overlays.traceOverlay.aboveLand) {
    drawTraceOverlay(ctx, world, fullW, fullH, ppc);
  }

  // 2. Political Territory Regions (Coastline-clipped kingdoms + maritime territories, cached per plate!)
  drawWorldRegions(ctx, world, plate, fullW, fullH, ppc, vp);

  // 3. Meandering Tapered Rivers (seamlessly fading into oceans, bays, lakes & parent rivers, cached per plate!)
  drawWorldRivers(ctx, doc, world, plate, fullW, fullH, ppc, vp);

  // 4. Windrose Rhumb Lines (behind trails & symbols for authentic sea-chart depth!)
  drawRhumbLines(ctx, world, fullW, fullH, ppc);

  // 5. Overland Trails, Imperial Roads, Railroads & Nautical Sea Lanes (frustum-culled!)
  for (const trail of world.trails) {
    if (vp && trail.points.length > 0) {
      let tMinX = Infinity;
      let tMaxX = -Infinity;
      let tMinY = Infinity;
      let tMaxY = -Infinity;
      for (const pt of trail.points) {
        if (pt.x < tMinX) tMinX = pt.x;
        if (pt.x > tMaxX) tMaxX = pt.x;
        if (pt.y < tMinY) tMinY = pt.y;
        if (pt.y > tMaxY) tMaxY = pt.y;
      }
      if (tMaxX + 1.5 < vp.minX || tMinX - 1.5 > vp.maxX || tMaxY + 1.5 < vp.minY || tMinY - 1.5 > vp.maxY) {
        continue;
      }
    }
    drawWorldTrail(ctx, trail, ppc);
  }

  // 6. Overland Grid (Hex / Square / Lat-Lon — frustum-culled!)
  if (opts.showGrid !== false) {
    drawWorldOverlandGrid(ctx, world, fullW, fullH, ppc, vp);
  }

  // 7. World Symbols (Cached Y-Sort by doc.layers ref + Frustum Culling for smooth 60 FPS Hi-DPI zoom!)
  let sortedCache = sortedSymbolsCache.get(doc.layers);
  if (!sortedCache) {
    const buildSorted = (includeDm: boolean): SortedSymbolEntry[] => {
      const arr: SortedSymbolEntry[] = [];
      for (let li = 0; li < doc.layers.length; li++) {
        const layer = doc.layers[li];
        if (!layer.visible) continue;
        if (layer.dmOnly && !includeDm) continue;
        if (layer.kind === "objects" && layer.objects) {
          for (const obj of layer.objects) {
            arr.push({
              obj,
              layerOpacity: layer.opacity,
              layerBlendMode: layer.blendMode || "normal",
              layerIdx: li,
            });
          }
        }
      }
      arr.sort((a, b) => {
        if (a.layerIdx !== b.layerIdx) return a.layerIdx - b.layerIdx;
        const zBandA = Math.round(a.obj.zOrder / 10);
        const zBandB = Math.round(b.obj.zOrder / 10);
        if (zBandA !== zBandB) return zBandA - zBandB;
        const baseYA = a.obj.y + a.obj.heightCells * 0.35;
        const baseYB = b.obj.y + b.obj.heightCells * 0.35;
        return baseYA - baseYB || a.obj.zOrder - b.obj.zOrder;
      });
      return arr;
    };
    sortedCache = { dm: buildSorted(true), player: buildSorted(false) };
    sortedSymbolsCache.set(doc.layers, sortedCache);
  }

  const allSortedSymbols = opts.dmView ? sortedCache.dm : sortedCache.player;
  const dmNotes: DmNotePin[] = [];
  if (opts.dmView) {
    for (let li = 0; li < doc.layers.length; li++) {
      const layer = doc.layers[li];
      if (layer.visible && layer.kind === "dm_notes" && layer.dmNotes) {
        dmNotes.push(...layer.dmNotes);
      }
    }
  }

  for (let si = 0; si < allSortedSymbols.length; si++) {
    const { obj, layerOpacity, layerBlendMode } = allSortedSymbols[si];
    if (vp) {
      const padX = obj.widthCells * 0.85 + 0.6;
      const padY = obj.heightCells * 0.85 + 0.6;
      if (
        obj.x + padX < vp.minX ||
        obj.x - padX > vp.maxX ||
        obj.y + padY < vp.minY ||
        obj.y - padY > vp.maxY
      ) {
        continue;
      }
    }
    drawWorldSymbol(ctx, obj, layerOpacity, layerBlendMode, ppc, assetLookup, interactive);
  }

  // 8. Cartographic Labels & Scroll / Banner Cartouches (Frustum-culled native Hi-DPI typography!)
  for (const label of world.labels) {
    if (label.dmOnly && !opts.dmView) continue;
    if (vp) {
      const estSpanX = Math.max(3.5, (label.fontSizePx / 12) * Math.max(4, label.text.length) * 0.45);
      const estSpanY = Math.max(2.0, (label.fontSizePx / 12) * 1.8);
      if (
        label.x + estSpanX < vp.minX ||
        label.x - estSpanX > vp.maxX ||
        label.y + estSpanY < vp.minY ||
        label.y - estSpanY > vp.maxY
      ) {
        continue;
      }
    }
    drawWorldLabel(ctx, label, world, ppc, opts.selectedId === label.id, interactive);
  }

  // 9. Compass Rose, Calibrated Scale Bar & Custom Travel Legend Key Plaque (frustum-culled!)
  drawCompassRoseOverlay(ctx, world, ppc, assetLookup, vp, interactive);
  drawScaleBarOverlay(ctx, world, ppc, vp);
  drawLegendOverlay(ctx, world, ppc, vp, interactive);

  // 10. Sub-Map Link Pins (shown in DM/Editor mode, stripped in spoiler-free Player View)
  if (opts.dmView) {
    drawWorldSubMapPins(ctx, world, ppc, opts.selectedId);
  }

  // 11. Ornamental Map Frame & Paper Vignette (frustum-culled!)
  drawOrnamentalMapFrame(ctx, world, fullW, fullH, ppc, vp, interactive);

  // Optional Above-Land Reference Trace Image (editor/DM view only!)
  if (opts.dmView && world.overlays.traceOverlay?.visible && world.overlays.traceOverlay.aboveLand) {
    drawTraceOverlay(ctx, world, fullW, fullH, ppc);
  }

  // 12. DM Secret Notes
  if (opts.dmView && dmNotes.length > 0) {
    drawWorldDmPins(ctx, dmNotes, ppc);
  }
}

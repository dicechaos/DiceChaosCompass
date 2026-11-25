import { resolveBundledAssetUrl } from "@/engine/bundledAssetBase";
import { computeCaveGeometry } from "@/engine/caveEngine";
import {
  getProcessedTexture,
  getRecolorCacheKey,
} from "@/engine/colorShader";
import {
  computeVisibilityPolygon,
  cutWallSegmentsForPortals,
  extractLightOccluders,
  sampleCatmullRom,
} from "@/engine/geometry";
import {
  computeRoofGeometry,
  getRoofPresetByAssetId,
} from "@/engine/roofEngine";
import {
  computeUnifiedWaterLayerOutline,
  computeWaterOutline,
} from "@/engine/waterEngine";
import { renderWorldMapScene } from "@/engine/worldRenderer";
import type {
  DcMapDocument,
  LightNode,
  MapLayer,
  ObjectStamp,
  Point2D,
  PortalNode,
  RoofStructure,
  SplinePath,
  TerrainStroke,
  VaultAsset,
  WallSegment,
  WaterRegion,
} from "@/types/map";

export interface WorldViewportCells {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** Physical device pixel ratio for 1:1 Hi-DPI detail plates at any zoom up to 1600% */
  dpr?: number;
  /** When false (active wheel-zoom inertia), reuse existing plates for 60 FPS responsiveness */
  allowDetailPlate?: boolean;
}

export interface RenderOptions {
  pixelsPerCell: number;
  dmView: boolean;
  showVttOverlay: boolean;
  showScatterOutlines: boolean;
  showOnionSkin?: boolean;
  showGrid?: boolean;
  forceLightingPresetId?: string;
  onlyRoofsLayer?: boolean;
  /**
   * When set, renders ONLY layers belonging to this level ID.
   * For upper/roof/sky levels, renders on a 100% transparent background (preserving crisp alpha!)
   * so exported floors can be re-stacked pixel-for-pixel in DiceChaosDisplay or any VTT.
   */
  isolatedLevelId?: string;
  selectedId?: string | null;
  cropRectPx?: { x: number; y: number; w: number; h: number };
  /** Visible world grid bounds for viewport-adaptive infinite-zoom Hi-DPI rendering & frustum culling */
  viewportCells?: WorldViewportCells;
  /** Fast interactive pass during active pan/zoom/drag (skips heavy blur/shadowBlur; crisp pass follows on settle) */
  interactive?: boolean;
}

class ImageTexturePool {
  private cache = new Map<string, HTMLImageElement>();
  private loading = new Map<string, Promise<HTMLImageElement | null>>();
  private listeners = new Set<() => void>();
  private notifyTimer: number | null = null;

  private scheduleNotify() {
    if (this.notifyTimer !== null) return;
    this.notifyTimer = window.setTimeout(() => {
      this.notifyTimer = null;
      this.listeners.forEach((fn) => fn());
    }, 60);
  }

  onLoad(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  get(url: string): HTMLImageElement | null {
    const hit = this.cache.get(url);
    if (hit && hit.complete && hit.naturalWidth > 0) return hit;
    if (!this.loading.has(url)) {
      const p = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          this.cache.set(url, img);
          this.loading.delete(url);
          this.scheduleNotify();
          resolve(img);
        };
        img.onerror = () => {
          this.loading.delete(url);
          resolve(null);
        };
        img.src = url;
      });
      this.loading.set(url, p);
    }
    return null;
  }

  async ensureLoaded(urls: string[]): Promise<void> {
    const tasks: Promise<unknown>[] = [];
    for (const url of urls) {
      if (this.cache.has(url)) continue;
      this.get(url);
      const p = this.loading.get(url);
      if (p) tasks.push(p);
    }
    await Promise.all(tasks);
  }
}

export const texturePool = new ImageTexturePool();

export function resolveAssetUrl(
  assetId: string,
  assetLookup: Map<string, VaultAsset>,
): string {
  const found = assetLookup.get(assetId);
  if (found) return found.url;
  if (
    assetId.startsWith("http") ||
    assetId.startsWith("dcasset:") ||
    assetId.startsWith("blob:") ||
    assetId.startsWith("data:") ||
    assetId.startsWith("/")
  ) {
    return assetId;
  }
  if (assetId.startsWith("modular-suite/")) {
    return resolveBundledAssetUrl(`modular-suite-cc0/${assetId.slice("modular-suite/".length)}`);
  }
  if (assetId.startsWith("core-fantasy/")) {
    return resolveBundledAssetUrl(`core-fantasy-cc0/${assetId.slice("core-fantasy/".length)}`);
  }
  if (assetId.startsWith("world-atlas/")) {
    return resolveBundledAssetUrl(`world-atlas-cc0/${assetId.slice("world-atlas/".length)}`);
  }
  return resolveBundledAssetUrl(`starter-cc0/${assetId}`);
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const n = parseInt(full || "ffffff", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mapBlendMode(mode: MapLayer["blendMode"]): GlobalCompositeOperation {
  switch (mode) {
    case "multiply":
      return "multiply";
    case "screen":
      return "screen";
    case "overlay":
      return "overlay";
    case "add":
      return "lighter";
    case "darken":
      return "darken";
    default:
      return "source-over";
  }
}

const softPathStripCache = new Map<string, HTMLCanvasElement>();

function getSideFeatheredStrip(
  img: HTMLImageElement | HTMLCanvasElement,
  cacheKey: string,
): HTMLImageElement | HTMLCanvasElement {
  if (typeof document === "undefined") return img;
  const cached = softPathStripCache.get(cacheKey);
  if (cached) return cached;
  const w = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const h = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  if (!w || !h) return img;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return img;
  g.drawImage(img, 0, 0, w, h);
  g.globalCompositeOperation = "destination-in";
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.18, "rgba(0,0,0,0.92)");
  grad.addColorStop(0.28, "rgba(0,0,0,1)");
  grad.addColorStop(0.72, "rgba(0,0,0,1)");
  grad.addColorStop(0.82, "rgba(0,0,0,0.92)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  softPathStripCache.set(cacheKey, c);
  return c;
}

export interface ClipRectPx {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function isRectVisible(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  vp?: WorldViewportCells,
): boolean {
  if (!vp) return true;
  return !(x1 < vp.minX || x0 > vp.maxX || y1 < vp.minY || y0 > vp.maxY);
}

function isPointBoxVisible(
  pts: Point2D[],
  vp: WorldViewportCells | undefined,
  padCells: number,
): boolean {
  if (!vp || pts.length === 0) return true;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return !(
    maxX + padCells < vp.minX ||
    minX - padCells > vp.maxX ||
    maxY + padCells < vp.minY ||
    minY - padCells > vp.maxY
  );
}

// Persistent across-frame geometry, sort & scaled-tile caches (eliminates per-frame GC & allocation churn!)
const sortedObjectsCache = new WeakMap<ObjectStamp[], ObjectStamp[]>();
const pathSampleCache = new WeakMap<SplinePath, { curved: boolean; pts: Point2D[] }>();
const roofGeomCache = new WeakMap<RoofStructure, ReturnType<typeof computeRoofGeometry>>();
const baseTerrainTileCache = new Map<string, HTMLCanvasElement>();
const terrainTileCanvasCache = new Map<string, HTMLCanvasElement>();

function getSortedObjects(objects: ObjectStamp[]): ObjectStamp[] {
  let cached = sortedObjectsCache.get(objects);
  if (!cached) {
    cached = [...objects].sort((a, b) => a.zOrder - b.zOrder);
    sortedObjectsCache.set(objects, cached);
  }
  return cached;
}

function getCachedSampledPath(path: SplinePath): Point2D[] {
  const useCurve = path.curved !== false && path.points.length >= 3;
  if (!useCurve) return path.points;
  const hit = pathSampleCache.get(path);
  if (hit && hit.curved) return hit.pts;
  const sampled = sampleCatmullRom(path.points, 12, false);
  pathSampleCache.set(path, { curved: true, pts: sampled });
  return sampled;
}

function getCachedRoofGeometry(roof: RoofStructure): ReturnType<typeof computeRoofGeometry> {
  let geom = roofGeomCache.get(roof);
  if (!geom) {
    geom = computeRoofGeometry(roof);
    roofGeomCache.set(roof, geom);
  }
  return geom;
}

function getQuantizedTileSize(rawPx: number): number {
  return Math.max(64, Math.min(512, Math.round(rawPx / 32) * 32 || 64));
}

function getOrCreateTerrainTileCanvas(
  img: CanvasImageSource,
  cacheKey: string,
  tileSz: number,
  bgHex: string,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const fullKey = `${cacheKey}|${tileSz}|${bgHex}`;
  const hit = terrainTileCanvasCache.get(fullKey);
  if (hit) return hit;
  const tmp = document.createElement("canvas");
  tmp.width = tileSz;
  tmp.height = tileSz;
  const tctx = tmp.getContext("2d");
  if (!tctx) return null;
  tctx.fillStyle = bgHex;
  tctx.fillRect(0, 0, tileSz, tileSz);
  tctx.drawImage(img, 0, 0, tileSz, tileSz);
  if (terrainTileCanvasCache.size >= 72) {
    const oldest = terrainTileCanvasCache.keys().next().value;
    if (oldest !== undefined) terrainTileCanvasCache.delete(oldest);
  }
  terrainTileCanvasCache.set(fullKey, tmp);
  return tmp;
}

/**
 * Draws a repeating textured strip smoothly bent along a polyline (used for Funicular Rails,
 * Steel Haulage Cables, Alpine Cliff Ledges, Stone Stairs, and Dressed Stone Walls).
 */
function drawTexturedStrip(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement | null,
  points: Point2D[],
  widthPx: number,
  ppc: number,
  closed: boolean,
  taperEnds = false,
  fallbackColor = "#64748B",
  flipSide = false,
  fadeEnds = false,
  clipPx?: ClipRectPx,
) {
  if (points.length < 2) return;
  const segCount = closed ? points.length : points.length - 1;

  if (!img) {
    ctx.save();
    ctx.strokeStyle = fallbackColor;
    ctx.lineWidth = widthPx;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x * ppc, points[0].y * ppc);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x * ppc, points[i].y * ppc);
    }
    if (closed) ctx.closePath();
    ctx.stroke();
    ctx.restore();
    return;
  }

  const imgW = img instanceof HTMLImageElement ? img.naturalWidth : img.width;
  const imgH = img instanceof HTMLImageElement ? img.naturalHeight : img.height;
  const aspect = imgW / Math.max(1, imgH);
  const tileLenPx = Math.max(12, widthPx * aspect);
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot((b.x - a.x) * ppc, (b.y - a.y) * ppc);
    segLens.push(len);
    totalLen += len;
  }

  const segPad = widthPx + 4;
  let accDist = 0;
  for (let i = 0; i < segCount; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const ax = a.x * ppc;
    const ay = a.y * ppc;
    const bx = b.x * ppc;
    const by = b.y * ppc;
    const len = segLens[i];
    if (len < 0.5) continue;
    // Frustum-cull offscreen segments while still advancing accDist so texture phase stays 100% locked!
    if (
      clipPx &&
      (Math.max(ax, bx) + segPad < clipPx.x0 ||
        Math.min(ax, bx) - segPad > clipPx.x1 ||
        Math.max(ay, by) + segPad < clipPx.y0 ||
        Math.min(ay, by) - segPad > clipPx.y1)
    ) {
      accDist += len;
      continue;
    }
    const angle = Math.atan2(by - ay, bx - ax);

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    if (flipSide) {
      ctx.scale(1, -1);
    }

    let drawn = 0;
    let guard = 0;
    while (drawn < len - 0.1 && guard++ < 512) {
      const rawPhase = (accDist + drawn) % tileLenPx;
      const phase = rawPhase >= tileLenPx - 0.25 ? 0 : rawPhase;
      const remainInTile = Math.max(0.5, tileLenPx - phase);
      const step = Math.max(0.5, Math.min(len - drawn, remainInTile));
      const srcX = Math.min(imgW - 1, (phase / tileLenPx) * imgW);
      const srcW = Math.max(
        1,
        Math.min(imgW - srcX, (step / tileLenPx) * imgW),
      );

      let localW = widthPx;
      const u = totalLen > 1 ? (accDist + drawn + step * 0.5) / totalLen : 0.5;
      if (taperEnds && totalLen > 1) {
        const taper = Math.min(1, Math.min(u, 1 - u) * 5);
        localW = widthPx * (0.25 + 0.75 * taper);
      }
      const prevAlpha = ctx.globalAlpha;
      if (fadeEnds && !closed && totalLen > 1) {
        const edgeFade = Math.min(1, Math.min(u, 1 - u) * 7.5);
        ctx.globalAlpha = prevAlpha * Math.max(0.04, edgeFade);
      }

      ctx.drawImage(
        img,
        srcX,
        0,
        srcW,
        imgH,
        drawn - 0.5,
        -localW / 2,
        step + 1.0,
        localW,
      );
      if (fadeEnds && !closed && totalLen > 1) {
        ctx.globalAlpha = prevAlpha;
      }
      drawn += step;
    }
    ctx.restore();
    accDist += len;
  }
}

function drawTerrainBase(
  ctx: CanvasRenderingContext2D,
  wPx: number,
  hPx: number,
  ppc: number,
  baseImg: HTMLImageElement | null,
  baseUrl?: string,
  clipPx?: ClipRectPx,
) {
  const rx = clipPx ? clipPx.x0 : 0;
  const ry = clipPx ? clipPx.y0 : 0;
  const rw = clipPx ? clipPx.x1 - clipPx.x0 : wPx;
  const rh = clipPx ? clipPx.y1 - clipPx.y0 : hPx;
  if (rw <= 0 || rh <= 0) return;

  // Always lay down an opaque ground backing first so terrain textures with partial alpha
  // (e.g. grass/moss splat tiles) stay 100% opaque and never bleach white during multiply lighting!
  ctx.fillStyle = "#141A21";
  ctx.fillRect(rx, ry, rw, rh);

  if (baseImg) {
    const rawTilePx = Math.max(32, ppc * 3.5);
    const tileSz = getQuantizedTileSize(rawTilePx);
    const cacheKey = `${baseUrl || baseImg.src}|${tileSz}`;
    let patCanvas = baseTerrainTileCache.get(cacheKey);
    if (!patCanvas) {
      patCanvas = document.createElement("canvas");
      patCanvas.width = tileSz;
      patCanvas.height = tileSz;
      const pctx = patCanvas.getContext("2d");
      if (pctx) {
        pctx.drawImage(baseImg, 0, 0, tileSz, tileSz);
        if (baseTerrainTileCache.size >= 32) {
          const oldest = baseTerrainTileCache.keys().next().value;
          if (oldest !== undefined) baseTerrainTileCache.delete(oldest);
        }
        baseTerrainTileCache.set(cacheKey, patCanvas);
      }
    }
    const pat = ctx.createPattern(patCanvas, "repeat");
    if (pat) {
      const ratio = rawTilePx / tileSz;
      if (
        Math.abs(ratio - 1) > 0.004 &&
        typeof DOMMatrix !== "undefined" &&
        typeof pat.setTransform === "function"
      ) {
        pat.setTransform(new DOMMatrix().scale(ratio, ratio));
      }
      ctx.fillStyle = pat;
      ctx.fillRect(rx, ry, rw, rh);
      return;
    }
  }
  ctx.fillStyle = "#2E3542";
  ctx.fillRect(rx, ry, rw, rh);
}

// Reusable offscreen scratch buffers for zero-ring unified terrain alpha masking
let _terrainMaskCanvas: HTMLCanvasElement | null = null;
let _terrainFillCanvas: HTMLCanvasElement | null = null;
let _terrainBlurHalfCanvas: HTMLCanvasElement | null = null;

function ensureTerrainScratch(w: number, h: number): {
  maskCanvas: HTMLCanvasElement;
  maskCtx: CanvasRenderingContext2D;
  fillCanvas: HTMLCanvasElement;
  fillCtx: CanvasRenderingContext2D;
} | null {
  const cw = Math.max(16, Math.ceil(w));
  const ch = Math.max(16, Math.ceil(h));
  if (!_terrainMaskCanvas) _terrainMaskCanvas = document.createElement("canvas");
  if (!_terrainFillCanvas) _terrainFillCanvas = document.createElement("canvas");
  if (_terrainMaskCanvas.width < cw || _terrainMaskCanvas.height < ch) {
    _terrainMaskCanvas.width = Math.max(_terrainMaskCanvas.width, cw);
    _terrainMaskCanvas.height = Math.max(_terrainMaskCanvas.height, ch);
  }
  if (_terrainFillCanvas.width < cw || _terrainFillCanvas.height < ch) {
    _terrainFillCanvas.width = Math.max(_terrainFillCanvas.width, cw);
    _terrainFillCanvas.height = Math.max(_terrainFillCanvas.height, ch);
  }
  const maskCtx = _terrainMaskCanvas.getContext("2d");
  const fillCtx = _terrainFillCanvas.getContext("2d");
  if (!maskCtx || !fillCtx) return null;
  return { maskCanvas: _terrainMaskCanvas, maskCtx, fillCanvas: _terrainFillCanvas, fillCtx };
}

/**
 * Renders one or more terrain strokes sharing the SAME material into a single unified
 * soft-feathered alpha mask so overlapping brush dabs and repeated strokes of the same
 * terrain merge seamlessly with ZERO internal rings or dark seam borders!
 */
export function drawUnifiedTerrainGroup(
  ctx: CanvasRenderingContext2D,
  strokes: TerrainStroke[],
  ppc: number,
  layerOpacity: number,
  assetLookup: Map<string, VaultAsset>,
  tileCache: Map<string, CanvasPattern | null>,
  maxW: number,
  maxH: number,
  clipPx?: ClipRectPx,
  interactive = false,
) {
  if (strokes.length === 0) return;
  const first = strokes[0];
  const url = resolveAssetUrl(first.assetId, assetLookup);
  const rawImg = texturePool.get(url);
  if (!rawImg) return;
  const assetMeta = assetLookup.get(first.assetId);
  const cacheKey = getRecolorCacheKey(url, first.recolor, assetMeta);

  // Compute tight bounding box across the unified stroke group BEFORE allocating patterns
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxBlur = 0;
  for (const s of strokes) {
    const isPoly = s.shape === "polygon";
    const rPx = isPoly ? 0 : s.radiusCells * ppc;
    const blurPx =
      s.softness > 0.02
        ? Math.max(1, (isPoly ? ppc * 0.9 : rPx) * s.softness * 0.42)
        : 0;
    if (blurPx > maxBlur) maxBlur = blurPx;
    const pad = rPx + Math.min(20, blurPx) * 2.2 + 4;
    for (const pt of s.points) {
      const cx = pt.x * ppc;
      const cy = pt.y * ppc;
      if (cx - pad < minX) minX = cx - pad;
      if (cy - pad < minY) minY = cy - pad;
      if (cx + pad > maxX) maxX = cx + pad;
      if (cy + pad > maxY) maxY = cy + pad;
    }
    if (isPoly && s.holes) {
      for (const hole of s.holes) {
        for (const pt of hole) {
          const cx = pt.x * ppc;
          const cy = pt.y * ppc;
          if (cx - pad < minX) minX = cx - pad;
          if (cy - pad < minY) minY = cy - pad;
          if (cx + pad > maxX) maxX = cx + pad;
          if (cy + pad > maxY) maxY = cy + pad;
        }
      }
    }
  }
  const origBx = Math.max(0, Math.floor(minX));
  const origBy = Math.max(0, Math.floor(minY));
  const origBx2 = Math.min(maxW, Math.ceil(maxX));
  const origBy2 = Math.min(maxH, Math.ceil(maxY));
  if (origBx2 <= origBx || origBy2 <= origBy) return;

  // Clip scratch canvas tightly to visible viewport (plus blur apron) so zoomed-in rendering NEVER allocates full-map blurs!
  const effectiveBlur =
    maxBlur >= 1
      ? interactive
        ? Math.min(8, Math.round(maxBlur * 0.5))
        : Math.min(18, Math.round(maxBlur))
      : 0;
  const clipPad = effectiveBlur * 2 + 8;
  const bx = clipPx ? Math.max(origBx, Math.floor(clipPx.x0 - clipPad)) : origBx;
  const by = clipPx ? Math.max(origBy, Math.floor(clipPx.y0 - clipPad)) : origBy;
  const bx2 = clipPx ? Math.min(origBx2, Math.ceil(clipPx.x1 + clipPad)) : origBx2;
  const by2 = clipPx ? Math.min(origBy2, Math.ceil(clipPx.y1 + clipPad)) : origBy2;
  const bw = bx2 - bx;
  const bh = by2 - by;
  if (bw <= 0 || bh <= 0) return;

  const rawTilePx = Math.max(32, ppc * 3.2);
  const tileSz = getQuantizedTileSize(rawTilePx);
  const patRatio = rawTilePx / tileSz;
  const patCacheKey = `${cacheKey}|${tileSz}`;

  let pat = tileCache.get(patCacheKey);
  if (pat === undefined) {
    const img = getProcessedTexture(rawImg, url, first.recolor, assetMeta, 512);
    const tileCanvas = getOrCreateTerrainTileCanvas(
      img,
      cacheKey,
      tileSz,
      assetMeta?.dominantHex || "#1A1816",
    );
    pat = tileCanvas ? ctx.createPattern(tileCanvas, "repeat") : null;
    tileCache.set(patCacheKey, pat);
  }
  if (!pat) return;

  const scratch = ensureTerrainScratch(bw, bh);
  if (!scratch) return;
  const { maskCanvas, maskCtx, fillCanvas, fillCtx } = scratch;

  // 1. Build unified solid-white binary union silhouette on maskCanvas (crisp — ZERO internal overlap!)
  maskCtx.save();
  maskCtx.setTransform(1, 0, 0, 1, 0, 0);
  maskCtx.filter = "none";
  maskCtx.clearRect(0, 0, bw, bh);
  maskCtx.fillStyle = "#FFFFFF";
  maskCtx.strokeStyle = "#FFFFFF";
  maskCtx.lineCap = "round";
  maskCtx.lineJoin = "round";

  for (const s of strokes) {
    if (s.points.length === 0) continue;

    // Crisp vector area fill (Smart Wall Flood Fill, Rectangle Fill, Polygon Fill, or Closed Room Fill)
    if (s.shape === "polygon") {
      if (s.points.length < 3) continue;
      maskCtx.beginPath();
      maskCtx.moveTo(s.points[0].x * ppc - bx, s.points[0].y * ppc - by);
      for (let i = 1; i < s.points.length; i++) {
        maskCtx.lineTo(s.points[i].x * ppc - bx, s.points[i].y * ppc - by);
      }
      maskCtx.closePath();
      if (s.holes) {
        for (const hole of s.holes) {
          if (hole.length < 3) continue;
          maskCtx.moveTo(hole[0].x * ppc - bx, hole[0].y * ppc - by);
          for (let i = 1; i < hole.length; i++) {
            maskCtx.lineTo(hole[i].x * ppc - bx, hole[i].y * ppc - by);
          }
          maskCtx.closePath();
        }
      }
      maskCtx.fill("evenodd");
      continue;
    }

    const rPx = s.radiusCells * ppc;
    const maxConnectDist = s.continuous ? Infinity : s.radiusCells * 1.65;
    maskCtx.lineWidth = rPx * 2;

    if (s.points.length === 1) {
      maskCtx.beginPath();
      maskCtx.arc(s.points[0].x * ppc - bx, s.points[0].y * ppc - by, rPx, 0, Math.PI * 2);
      maskCtx.fill();
      continue;
    }

    // Draw smooth connected capsules for continuous strokes (and adjacent points in a room)
    // without accidentally bridging disconnected rooms in preset dot grids!
    maskCtx.beginPath();
    let penX = s.points[0].x * ppc - bx;
    let penY = s.points[0].y * ppc - by;
    maskCtx.moveTo(penX, penY);
    for (let i = 1; i < s.points.length; i++) {
      const prev = s.points[i - 1];
      const curr = s.points[i];
      const nx = curr.x * ppc - bx;
      const ny = curr.y * ppc - by;
      const d = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      if (d <= maxConnectDist) {
        maskCtx.lineTo(nx, ny);
      } else {
        // Finish previous sub-run (add dot if it was a single isolated point)
        maskCtx.lineTo(penX + 0.01, penY);
        maskCtx.moveTo(nx, ny);
      }
      penX = nx;
      penY = ny;
    }
    maskCtx.lineTo(penX + 0.01, penY);
    maskCtx.stroke();
  }
  maskCtx.restore();

  // 2. Apply ONE unified Gaussian feather to the combined silhouette, then mask the
  //    world-space-locked repeating terrain texture cleanly through it (texture stays 100% crisp!)
  const rotDeg = first.rotationDeg ?? 0;
  const slopeShade = first.slopeShade ?? 0;
  fillCtx.save();
  fillCtx.setTransform(1, 0, 0, 1, 0, 0);
  fillCtx.globalCompositeOperation = "source-over";
  fillCtx.filter = "none";
  fillCtx.clearRect(0, 0, bw, bh);
  if (effectiveBlur >= 4 && (bw > 320 || bh > 320)) {
    // 8x faster half-res alpha-mask Gaussian feather (upscaled smoothly while texture remains 100% crisp full-res!)
    const hw = Math.max(8, Math.ceil(bw * 0.5));
    const hh = Math.max(8, Math.ceil(bh * 0.5));
    if (!_terrainBlurHalfCanvas) _terrainBlurHalfCanvas = document.createElement("canvas");
    if (_terrainBlurHalfCanvas.width < hw || _terrainBlurHalfCanvas.height < hh) {
      _terrainBlurHalfCanvas.width = Math.max(_terrainBlurHalfCanvas.width, hw);
      _terrainBlurHalfCanvas.height = Math.max(_terrainBlurHalfCanvas.height, hh);
    }
    const hctx = _terrainBlurHalfCanvas.getContext("2d");
    if (hctx) {
      hctx.setTransform(1, 0, 0, 1, 0, 0);
      hctx.clearRect(0, 0, hw, hh);
      hctx.filter = `blur(${Math.max(1, Math.round(effectiveBlur * 0.5))}px)`;
      hctx.drawImage(maskCanvas, 0, 0, bw, bh, 0, 0, hw, hh);
      hctx.filter = "none";
      fillCtx.imageSmoothingEnabled = true;
      fillCtx.drawImage(_terrainBlurHalfCanvas, 0, 0, hw, hh, 0, 0, bw, bh);
    } else {
      fillCtx.filter = `blur(${effectiveBlur}px)`;
      fillCtx.drawImage(maskCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
      fillCtx.filter = "none";
    }
  } else {
    if (effectiveBlur >= 1) {
      fillCtx.filter = `blur(${effectiveBlur}px)`;
    }
    fillCtx.drawImage(maskCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
    fillCtx.filter = "none";
  }
  fillCtx.globalCompositeOperation = "source-in";
  fillCtx.translate(-bx, -by);
  if (typeof DOMMatrix !== "undefined" && typeof pat.setTransform === "function") {
    let m = new DOMMatrix();
    if (Math.abs(rotDeg) > 0.1) m = m.rotate(rotDeg);
    if (Math.abs(patRatio - 1) > 0.004) m = m.scale(patRatio, patRatio);
    pat.setTransform(m);
  }
  fillCtx.fillStyle = pat;
  fillCtx.fillRect(bx, by, bw, bh);

  // Optional directional uphill-rim-light -> downhill-depth-shadow slope gradient (anchored to unclipped bbox!)
  if (slopeShade > 0.02) {
    const origBw = origBx2 - origBx;
    const origBh = origBy2 - origBy;
    const rad = (rotDeg * Math.PI) / 180;
    const cx = origBx + origBw * 0.5;
    const cy = origBy + origBh * 0.5;
    const halfSpan = (Math.abs(Math.cos(rad)) * origBw + Math.abs(Math.sin(rad)) * origBh) * 0.5;
    const dx = Math.cos(rad) * halfSpan;
    const dy = Math.sin(rad) * halfSpan;
    // Uphill = (cx - dx, cy - dy) bright lip; Downhill = (cx + dx, cy + dy) deep shadow toe
    const grad = fillCtx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    grad.addColorStop(0, `rgba(255, 248, 228, ${Math.min(0.28, slopeShade * 0.34)})`);
    grad.addColorStop(0.26, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, `rgba(6, 10, 18, ${Math.min(0.82, slopeShade * 0.92)})`);
    fillCtx.globalCompositeOperation = "source-atop";
    fillCtx.fillStyle = grad;
    fillCtx.fillRect(bx, by, bw, bh);
  }
  fillCtx.restore();

  // 3. Blit seamless feathered terrain onto main canvas in ONE crisp pass
  ctx.save();
  ctx.globalAlpha = first.opacity * layerOpacity;
  ctx.drawImage(fillCanvas, 0, 0, bw, bh, bx, by, bw, bh);
  ctx.restore();
}

function drawTerrainLayer(
  ctx: CanvasRenderingContext2D,
  layer: MapLayer,
  ppc: number,
  assetLookup: Map<string, VaultAsset>,
  tileCache: Map<string, CanvasPattern | null>,
  maxW: number,
  maxH: number,
  clipPx?: ClipRectPx,
  interactive = false,
) {
  const strokes = layer.terrainStrokes ?? [];
  if (strokes.length === 0) return;

  // Group consecutive strokes that share the same terrain assetId, opacity & color grade so
  // painting adds smoothly into existing terrain of the same material with ZERO internal rings!
  let i = 0;
  while (i < strokes.length) {
    const base = strokes[i];
    const baseKey = getRecolorCacheKey(
      resolveAssetUrl(base.assetId, assetLookup),
      base.recolor,
      assetLookup.get(base.assetId),
    );
    const group: TerrainStroke[] = [base];
    let j = i + 1;
    while (
      j < strokes.length &&
      strokes[j].assetId === base.assetId &&
      Math.abs(strokes[j].opacity - base.opacity) < 0.01 &&
      Math.abs(strokes[j].softness - base.softness) < 0.02 &&
      Math.abs((strokes[j].rotationDeg ?? 0) - (base.rotationDeg ?? 0)) < 0.5 &&
      Math.abs((strokes[j].slopeShade ?? 0) - (base.slopeShade ?? 0)) < 0.02 &&
      getRecolorCacheKey(
        resolveAssetUrl(strokes[j].assetId, assetLookup),
        strokes[j].recolor,
        assetLookup.get(strokes[j].assetId),
      ) === baseKey
    ) {
      group.push(strokes[j]);
      j++;
    }
    drawUnifiedTerrainGroup(
      ctx,
      group,
      ppc,
      layer.opacity,
      assetLookup,
      tileCache,
      maxW,
      maxH,
      clipPx,
      interactive,
    );
    i = j;
  }
}

const causticsCanvasCache = new Map<string, HTMLCanvasElement>();

function getCausticsTile(strokeHex: string, sizePx: number): HTMLCanvasElement {
  const sz = Math.max(96, Math.min(384, Math.round(sizePx / 32) * 32));
  const key = `${strokeHex}|${sz}`;
  const cached = causticsCanvasCache.get(key);
  if (cached) return cached;

  const c = document.createElement("canvas");
  c.width = sz;
  c.height = sz;
  const g = c.getContext("2d");
  if (g) {
    // Deterministic seamless cellular web of sunlit underwater caustics
    const pts: Array<[number, number]> = [];
    for (let i = 0; i < 18; i++) {
      const rx = Math.abs(Math.sin(i * 12.9898 + 1.23) * 43758.5453) % 1;
      const ry = Math.abs(Math.sin(i * 78.233 + 4.56) * 43758.5453) % 1;
      pts.push([rx * sz, ry * sz]);
    }
    g.strokeStyle = strokeHex;
    g.lineCap = "round";
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      for (let j = i + 1; j < pts.length; j++) {
        const [x2, y2] = pts[j];
        let dx = x2 - x1;
        let dy = y2 - y1;
        if (dx > sz * 0.5) dx -= sz;
        if (dx < -sz * 0.5) dx += sz;
        if (dy > sz * 0.5) dy -= sz;
        if (dy < -sz * 0.5) dy += sz;
        const d = Math.hypot(dx, dy);
        if (d > sz * 0.14 && d < sz * 0.34) {
          g.globalAlpha = 0.24;
          g.lineWidth = Math.max(1.5, sz * 0.016);
          for (const ox of [-sz, 0, sz]) {
            for (const oy of [-sz, 0, sz]) {
              g.beginPath();
              g.moveTo(x1 + ox, y1 + oy);
              g.quadraticCurveTo(
                x1 + dx * 0.5 + ox + dy * 0.14,
                y1 + dy * 0.5 + oy - dx * 0.14,
                x1 + dx + ox,
                y1 + dy + oy,
              );
              g.stroke();
            }
          }
        }
      }
    }
  }
  if (causticsCanvasCache.size > 24) causticsCanvasCache.clear();
  causticsCanvasCache.set(key, c);
  return c;
}

function tracePolySubpath(ctx: CanvasRenderingContext2D, pts: Point2D[], ppc: number) {
  if (pts.length < 3) return;
  ctx.moveTo(pts[0].x * ppc, pts[0].y * ppc);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x * ppc, pts[i].y * ppc);
  }
  ctx.closePath();
}

// Reusable offscreen scratch buffers for unified multi-biome water meshing
let _waterSurfaceCanvas: HTMLCanvasElement | null = null;
let _waterBiomeCanvas: HTMLCanvasElement | null = null;
let _waterRingCanvas: HTMLCanvasElement | null = null;
const waterPatternCache = new Map<string, HTMLCanvasElement>();

function ensureWaterScratch(w: number, h: number): {
  surfaceCanvas: HTMLCanvasElement;
  surfaceCtx: CanvasRenderingContext2D;
  biomeCanvas: HTMLCanvasElement;
  biomeCtx: CanvasRenderingContext2D;
  ringCanvas: HTMLCanvasElement;
  ringCtx: CanvasRenderingContext2D;
} | null {
  const cw = Math.max(16, Math.ceil(w));
  const ch = Math.max(16, Math.ceil(h));
  if (!_waterSurfaceCanvas) _waterSurfaceCanvas = document.createElement("canvas");
  if (!_waterBiomeCanvas) _waterBiomeCanvas = document.createElement("canvas");
  if (!_waterRingCanvas) _waterRingCanvas = document.createElement("canvas");
  for (const c of [_waterSurfaceCanvas, _waterBiomeCanvas, _waterRingCanvas]) {
    if (c.width < cw || c.height < ch) {
      c.width = Math.max(c.width, cw);
      c.height = Math.max(c.height, ch);
    }
  }
  const surfaceCtx = _waterSurfaceCanvas.getContext("2d");
  const biomeCtx = _waterBiomeCanvas.getContext("2d");
  const ringCtx = _waterRingCanvas.getContext("2d");
  if (!surfaceCtx || !biomeCtx || !ringCtx) return null;
  return {
    surfaceCanvas: _waterSurfaceCanvas,
    surfaceCtx,
    biomeCanvas: _waterBiomeCanvas,
    biomeCtx,
    ringCanvas: _waterRingCanvas,
    ringCtx,
  };
}

function resolveWaterTextureId(reg: WaterRegion): string {
  if (reg.textureAssetId) return reg.textureAssetId;
  if (reg.kind === "chasm") return "terrain/under_city_abyss.png";
  if (reg.kind === "lava") return "core-fantasy/terrain/volcanic_basalt.png";
  if (reg.kind === "ice") return "modular-suite/terrain/frozen_lake_ice.png";
  if (reg.kind === "swamp") return "modular-suite/terrain/water_murky_swamp_bayou.png";
  return "core-fantasy/terrain/deep_pond_water.png";
}

function getScaledWaterTile(
  img: HTMLImageElement,
  url: string,
  sizePx: number,
): HTMLCanvasElement {
  const sz = Math.max(64, Math.min(512, Math.round(sizePx / 16) * 16));
  const key = `${url}|${sz}`;
  const cached = waterPatternCache.get(key);
  if (cached) return cached;
  const tmp = document.createElement("canvas");
  tmp.width = sz;
  tmp.height = sz;
  tmp.getContext("2d")?.drawImage(img, 0, 0, sz, sz);
  if (waterPatternCache.size >= 40) {
    const oldest = waterPatternCache.keys().next().value;
    if (oldest !== undefined) waterPatternCache.delete(oldest);
  }
  waterPatternCache.set(key, tmp);
  return tmp;
}

function drawSingleWaterRegion(
  ctx: CanvasRenderingContext2D,
  reg: WaterRegion,
  layerOpacity: number,
  ppc: number,
  assetLookup: Map<string, VaultAsset>,
  selectedId?: string | null,
  clipPx?: ClipRectPx,
  interactive = false,
) {
  const { outer, holes } = computeWaterOutline(reg);
  if (outer.length < 3) return;

  // Compute tight region pixel AABB for frustum culling and exact pattern fill bounds
  let rMinX = Infinity;
  let rMinY = Infinity;
  let rMaxX = -Infinity;
  let rMaxY = -Infinity;
  for (let i = 0; i < outer.length; i++) {
    const px = outer[i].x * ppc;
    const py = outer[i].y * ppc;
    if (px < rMinX) rMinX = px;
    if (py < rMinY) rMinY = py;
    if (px > rMaxX) rMaxX = px;
    if (py > rMaxY) rMaxY = py;
  }
  const marginPx = ppc * 1.8;
  if (
    clipPx &&
    (rMaxX + marginPx < clipPx.x0 ||
      rMinX - marginPx > clipPx.x1 ||
      rMaxY + marginPx < clipPx.y0 ||
      rMinY - marginPx > clipPx.y1)
  ) {
    return;
  }
  const fillX0 = clipPx ? Math.max(rMinX - 2, clipPx.x0) : Math.max(0, rMinX - 2);
  const fillY0 = clipPx ? Math.max(rMinY - 2, clipPx.y0) : Math.max(0, rMinY - 2);
  const fillX1 = clipPx ? Math.min(rMaxX + 2, clipPx.x1) : rMaxX + 2;
  const fillY1 = clipPx ? Math.min(rMaxY + 2, clipPx.y1) : rMaxY + 2;
  const fillW = Math.max(0, fillX1 - fillX0);
  const fillH = Math.max(0, fillY1 - fillY0);

  const kind = reg.kind;
  const isChasm = kind === "chasm";
  const isLava = kind === "lava";
  const isIce = kind === "ice";
  const isSwamp = kind === "swamp";

  const texUrl = resolveAssetUrl(resolveWaterTextureId(reg), assetLookup);
  const waterImg = texturePool.get(texUrl);

  const ripple = reg.rippleIntensity ?? (isChasm ? 0 : 0.65);
  const caustics = reg.causticsIntensity ?? (isChasm || isSwamp ? 0 : 0.42);
  const depthFeather = reg.depthFeather ?? 0.6;
  const shoreBank = reg.shoreBankIntensity ?? (isChasm ? 0 : 0.42);
  const shallowHex = reg.shallowColorHex || reg.rimColorHex;

  ctx.save();
  ctx.globalAlpha = reg.opacity * layerOpacity;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // 1. Subtle damp wet-sand / dark bank rim right OUTSIDE the shoreline
  if (!isChasm && shoreBank > 0.02) {
    ctx.save();
    ctx.beginPath();
    tracePolySubpath(ctx, outer, ppc);
    for (const h of holes) tracePolySubpath(ctx, h, ppc);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = isLava ? "rgba(24, 12, 8, 0.72)" : "rgba(18, 28, 34, 0.34)";
    ctx.globalAlpha = reg.opacity * layerOpacity * shoreBank * 0.55;
    ctx.lineWidth = ppc * 0.85;
    ctx.stroke();
    ctx.restore();
  }

  const traceFullPath = () => {
    ctx.beginPath();
    tracePolySubpath(ctx, outer, ppc);
    for (const h of holes) tracePolySubpath(ctx, h, ppc);
  };

  const isSoftDepthOverlay =
    !isChasm && ripple <= 0.02 && shoreBank <= 0.02 && reg.opacity < 0.85;

  if (isSoftDepthOverlay && !interactive && "filter" in ctx) {
    const blurPx = Math.min(14, Math.max(4, Math.round(ppc * 0.25 * depthFeather)));
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    traceFullPath();
    ctx.fillStyle = reg.deepColorHex;
    ctx.fill("evenodd");
    ctx.filter = "none";
    ctx.restore();
  } else {
    traceFullPath();
    ctx.fillStyle = reg.deepColorHex;
    ctx.fill("evenodd");
  }

  ctx.save();
  traceFullPath();
  ctx.clip("evenodd");

  // 2. Seamless tiled water surface texture
  if (waterImg && fillW > 0 && fillH > 0) {
    const tile = getScaledWaterTile(waterImg, texUrl, ppc * (isChasm ? 7.5 : 5.2));
    const pat = ctx.createPattern(tile, "repeat");
    if (pat) {
      ctx.globalAlpha = isChasm
        ? 0.85
        : isLava
          ? 0.48
          : isSoftDepthOverlay
            ? 0.2
            : 0.58;
      ctx.fillStyle = pat;
      ctx.fillRect(fillX0, fillY0, fillW, fillH);
    }
  }

  if (isChasm) {
    traceFullPath();
    ctx.strokeStyle = "rgba(4, 7, 14, 0.92)";
    ctx.lineWidth = ppc * 2.1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(14, 24, 42, 0.52)";
    ctx.lineWidth = ppc * 3.5;
    ctx.stroke();
    ctx.strokeStyle = reg.rimColorHex;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = ppc * 0.4;
    ctx.stroke();
  } else {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const featherScale = 0.45 + depthFeather * 1.45;
    traceFullPath();
    ctx.strokeStyle = shallowHex;
    ctx.globalAlpha = isLava ? 0.34 : 0.24;
    ctx.lineWidth = ppc * 2.6 * featherScale;
    ctx.stroke();

    ctx.globalAlpha = isLava ? 0.48 : 0.34;
    ctx.lineWidth = ppc * 1.15 * featherScale;
    ctx.stroke();

    if (caustics > 0.02 && fillW > 0 && fillH > 0) {
      const causticColor = isLava ? "#FDE047" : isIce ? "#E0F2FE" : "#CFFAFE";
      const cTile = getCausticsTile(causticColor, ppc * 4.2);
      const cPat = ctx.createPattern(cTile, "repeat");
      if (cPat) {
        ctx.save();
        ctx.globalCompositeOperation = isLava ? "lighter" : "screen";
        ctx.globalAlpha = Math.min(0.85, caustics * (isLava ? 0.72 : 0.58));
        ctx.fillStyle = cPat;
        ctx.fillRect(fillX0, fillY0, fillW, fillH);
        ctx.restore();
      }
    }

    if (ripple > 0.02) {
      traceFullPath();
      ctx.strokeStyle = isLava ? "#FB923C" : reg.rimColorHex;
      ctx.globalAlpha = 0.22 * ripple;
      ctx.lineWidth = ppc * 0.58;
      ctx.setLineDash([ppc * 0.42, ppc * 0.24]);
      ctx.stroke();
      ctx.setLineDash([]);

      traceFullPath();
      ctx.strokeStyle = isLava ? "#FEF08A" : isSwamp ? reg.rimColorHex : "#ECFEFF";
      ctx.globalAlpha = Math.min(0.82, 0.28 + ripple * 0.44);
      ctx.lineWidth = ppc * (isIce ? 0.3 : 0.22);
      ctx.stroke();
    }
  }
  ctx.restore();

  if (selectedId && selectedId === reg.id) {
    ctx.save();
    traceFullPath();
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = Math.max(2, ppc * 0.045);
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders 2+ liquid water regions on the SAME Water layer as one unified meshed body:
 * - Zero internal foam walls or wet-bank seams where biomes touch
 * - Symmetric soft transition across biome boundaries controlled by `layer.waterBlendRadiusCells`
 * - One shared outer shoreline + dry island cutouts whose wet bank, shallow glow, and foam
 *   smoothly transition between biomes along the coastline.
 */
function drawUnifiedWaterSurface(
  ctx: CanvasRenderingContext2D,
  regions: WaterRegion[],
  layer: MapLayer,
  ppc: number,
  assetLookup: Map<string, VaultAsset>,
  selectedId: string | null | undefined,
  canvasWCells: number,
  canvasHCells: number,
  clipPx?: ClipRectPx,
  interactive = false,
) {
  const unifiedShapes = computeUnifiedWaterLayerOutline(regions, canvasWCells, canvasHCells);
  if (unifiedShapes.length === 0) return;

  const blendCells = layer.waterBlendRadiusCells ?? 1.1;
  const maxWaterBlur = interactive ? 8 : 20;
  const blurPx =
    blendCells > 0.02
      ? Math.min(maxWaterBlur, Math.max(2, Math.round(blendCells * ppc * (interactive ? 0.25 : 0.45))))
      : 0;
  const padPx = Math.ceil(ppc * 1.4 + blurPx * 2.4 + 6);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of unifiedShapes) {
    for (const p of s.outer) {
      const px = p.x * ppc;
      const py = p.y * ppc;
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
  }
  const mapMaxW = Math.ceil(canvasWCells * ppc);
  const mapMaxH = Math.ceil(canvasHCells * ppc);
  let bx = Math.max(0, Math.floor(minX - padPx));
  let by = Math.max(0, Math.floor(minY - padPx));
  let bx2 = Math.min(mapMaxW, Math.ceil(maxX + padPx));
  let by2 = Math.min(mapMaxH, Math.ceil(maxY + padPx));
  if (clipPx) {
    bx = Math.max(bx, Math.floor(clipPx.x0 - padPx));
    by = Math.max(by, Math.floor(clipPx.y0 - padPx));
    bx2 = Math.min(bx2, Math.ceil(clipPx.x1 + padPx));
    by2 = Math.min(by2, Math.ceil(clipPx.y1 + padPx));
  }
  const bw = bx2 - bx;
  const bh = by2 - by;
  if (bw <= 0 || bh <= 0) return;

  const scratch = ensureWaterScratch(bw, bh);
  if (!scratch) {
    for (const reg of regions) {
      drawSingleWaterRegion(ctx, reg, layer.opacity, ppc, assetLookup, selectedId, clipPx, interactive);
    }
    return;
  }
  const { surfaceCanvas, surfaceCtx, biomeCanvas, biomeCtx, ringCanvas, ringCtx } = scratch;

  const resetCtx = (c: CanvasRenderingContext2D) => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    if ("filter" in c) c.filter = "none";
    c.setLineDash([]);
    c.lineJoin = "round";
    c.lineCap = "round";
  };

  const traceUnified = (c: CanvasRenderingContext2D) => {
    c.beginPath();
    for (const s of unifiedShapes) {
      tracePolySubpath(c, s.outer, ppc);
      for (const h of s.holes) tracePolySubpath(c, h, ppc);
    }
  };

  const resolvedRegions = regions
    .map((reg) => ({ reg, outline: computeWaterOutline(reg) }))
    .filter((x) => x.outline.outer.length >= 3);
  if (resolvedRegions.length === 0) return;

  const traceRegion = (
    c: CanvasRenderingContext2D,
    o: { outer: Point2D[]; holes: Point2D[][] },
  ) => {
    c.beginPath();
    tracePolySubpath(c, o.outer, ppc);
    for (const h of o.holes) tracePolySubpath(c, h, ppc);
  };

  const isDepthOverlay = (reg: WaterRegion) =>
    (reg.rippleIntensity ?? 0.65) <= 0.02 &&
    (reg.shoreBankIntensity ?? 0.42) <= 0.02 &&
    reg.opacity < 0.8;

  const paintRegionInterior = (c: CanvasRenderingContext2D, reg: WaterRegion) => {
    const isLava = reg.kind === "lava";
    const isIce = reg.kind === "ice";
    const isSwamp = reg.kind === "swamp";
    const caustics = reg.causticsIntensity ?? (isSwamp ? 0 : 0.42);
    const texUrl = resolveAssetUrl(resolveWaterTextureId(reg), assetLookup);
    const waterImg = texturePool.get(texUrl);
    const depthOverlay = isDepthOverlay(reg);

    resetCtx(c);
    c.clearRect(0, 0, bw, bh);
    c.translate(-bx, -by);
    c.fillStyle = reg.deepColorHex;
    c.fillRect(bx, by, bw, bh);

    if (waterImg) {
      const tile = getScaledWaterTile(waterImg, texUrl, ppc * 5.2);
      const pat = c.createPattern(tile, "repeat");
      if (pat) {
        c.globalAlpha = isLava ? 0.48 : depthOverlay ? 0.22 : 0.58;
        c.fillStyle = pat;
        c.fillRect(bx, by, bw, bh);
      }
    }

    if (caustics > 0.02) {
      const causticColor = isLava ? "#FDE047" : isIce ? "#E0F2FE" : "#CFFAFE";
      const cTile = getCausticsTile(causticColor, ppc * 4.2);
      const cPat = c.createPattern(cTile, "repeat");
      if (cPat) {
        c.save();
        c.globalCompositeOperation = isLava ? "lighter" : "screen";
        c.globalAlpha = Math.min(0.85, caustics * (isLava ? 0.72 : 0.58));
        c.fillStyle = cPat;
        c.fillRect(bx, by, bw, bh);
        c.restore();
      }
    }
  };

  // Helper to paint a smoothly blended per-biome color field across the shared shoreline
  const buildBiomeColorField = (
    colorBlurPx: number,
    dilatePx: number,
    getColor: (reg: WaterRegion) => { style: string; alpha: number } | null,
  ) => {
    resetCtx(biomeCtx);
    biomeCtx.clearRect(0, 0, bw, bh);
    let paintedAny = false;
    for (const { reg, outline } of resolvedRegions) {
      const spec = getColor(reg);
      if (!spec || spec.alpha <= 0.005) continue;

      // 1. Dilated solid backing underneath so adjacent seams never step down
      biomeCtx.save();
      biomeCtx.translate(-bx, -by);
      biomeCtx.globalCompositeOperation = "destination-over";
      biomeCtx.globalAlpha = spec.alpha;
      biomeCtx.fillStyle = spec.style;
      biomeCtx.strokeStyle = spec.style;
      biomeCtx.lineWidth = Math.max(2, dilatePx * 2.2);
      traceRegion(biomeCtx, outline);
      biomeCtx.fill("evenodd");
      biomeCtx.stroke();
      biomeCtx.restore();

      // 2. Soft blurred blend on top across internal biome transitions
      if (paintedAny) {
        biomeCtx.save();
        biomeCtx.translate(-bx, -by);
        biomeCtx.globalCompositeOperation = "source-over";
        biomeCtx.globalAlpha = spec.alpha;
        if (colorBlurPx > 0 && "filter" in biomeCtx) {
          biomeCtx.filter = `blur(${colorBlurPx}px)`;
        }
        biomeCtx.fillStyle = spec.style;
        biomeCtx.strokeStyle = spec.style;
        biomeCtx.lineWidth = Math.max(1, dilatePx * 0.9);
        traceRegion(biomeCtx, outline);
        biomeCtx.fill("evenodd");
        if (dilatePx > 1) biomeCtx.stroke();
        if ("filter" in biomeCtx) biomeCtx.filter = "none";
        biomeCtx.restore();
      }
      paintedAny = true;
    }
    return paintedAny;
  };

  const shoreTransitionBlur = Math.max(4, blurPx);

  // =========================================================================
  // PASS 1: Shared Wet Shore Bank (Strictly OUTSIDE unified shoreline U!)
  // =========================================================================
  const hasAnyBank = resolvedRegions.some((r) => (r.reg.shoreBankIntensity ?? 0.42) > 0.02);
  if (hasAnyBank) {
    resetCtx(ringCtx);
    ringCtx.clearRect(0, 0, bw, bh);
    ringCtx.translate(-bx, -by);
    ringCtx.strokeStyle = "#FFFFFF";
    ringCtx.lineWidth = ppc * 0.88;
    traceUnified(ringCtx);
    ringCtx.stroke();
    // Punch out all submerged water so wet bank NEVER appears inside the lake
    ringCtx.globalCompositeOperation = "destination-out";
    ringCtx.fillStyle = "#FFFFFF";
    traceUnified(ringCtx);
    ringCtx.fill("evenodd");

    const okBank = buildBiomeColorField(shoreTransitionBlur, ppc * 0.7 + blurPx, (reg) => {
      const sb = reg.shoreBankIntensity ?? 0.42;
      if (sb <= 0.02) return null;
      return {
        style: reg.kind === "lava" ? "rgba(24, 12, 8, 0.72)" : "rgba(18, 28, 34, 0.34)",
        alpha: reg.opacity * sb * 0.55,
      };
    });
    if (okBank) {
      resetCtx(biomeCtx);
      biomeCtx.globalCompositeOperation = "destination-in";
      biomeCtx.drawImage(ringCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(biomeCanvas, 0, 0, bw, bh, bx, by, bw, bh);
      ctx.restore();
    }
  }

  // =========================================================================
  // PASS 2: Soft-Meshed Multi-Biome Water Interior (Inside U, exact 0->50->100%)
  // =========================================================================
  resetCtx(surfaceCtx);
  surfaceCtx.clearRect(0, 0, bw, bh);

  let solidLayerOpacity = 0;
  let primaryPainted = 0;

  for (let i = 0; i < resolvedRegions.length; i++) {
    const { reg, outline } = resolvedRegions[i];
    const depthOverlay = isDepthOverlay(reg);
    if (!depthOverlay) {
      solidLayerOpacity = Math.max(solidLayerOpacity, reg.opacity);
    }

    paintRegionInterior(biomeCtx, reg);

    if (depthOverlay) {
      const depthBlur = Math.max(6, blurPx || Math.round(ppc * 0.32 * (reg.depthFeather ?? 0.6)));
      resetCtx(ringCtx);
      ringCtx.clearRect(0, 0, bw, bh);
      ringCtx.translate(-bx, -by);
      if ("filter" in ringCtx) ringCtx.filter = `blur(${depthBlur}px)`;
      ringCtx.fillStyle = "#FFFFFF";
      traceRegion(ringCtx, outline);
      ringCtx.fill("evenodd");
      if ("filter" in ringCtx) ringCtx.filter = "none";

      resetCtx(biomeCtx);
      biomeCtx.globalCompositeOperation = "destination-in";
      biomeCtx.drawImage(ringCanvas, 0, 0, bw, bh, 0, 0, bw, bh);

      resetCtx(surfaceCtx);
      surfaceCtx.globalCompositeOperation = "source-over";
      surfaceCtx.globalAlpha = reg.opacity;
      surfaceCtx.drawImage(biomeCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
      continue;
    }

    // Sub-pass B1: Dilated crisp backing underneath (fills dry-land extensions & creates
    // symmetric overlap behind subsequent biomes so transitions go 100% -> 50% -> 0%!)
    resetCtx(ringCtx);
    ringCtx.clearRect(0, 0, bw, bh);
    ringCtx.translate(-bx, -by);
    ringCtx.fillStyle = "#FFFFFF";
    ringCtx.strokeStyle = "#FFFFFF";
    traceRegion(ringCtx, outline);
    ringCtx.fill("evenodd");
    if (blurPx > 0) {
      ringCtx.lineWidth = blurPx * 2.4;
      ringCtx.stroke();
    }

    resetCtx(biomeCtx);
    biomeCtx.globalCompositeOperation = "destination-in";
    biomeCtx.drawImage(ringCanvas, 0, 0, bw, bh, 0, 0, bw, bh);

    resetCtx(surfaceCtx);
    surfaceCtx.globalCompositeOperation = "destination-over";
    surfaceCtx.globalAlpha = 1;
    surfaceCtx.drawImage(biomeCanvas, 0, 0, bw, bh, 0, 0, bw, bh);

    // Sub-pass B2: Soft feathered blend on top across internal water-to-water boundaries
    if (primaryPainted > 0) {
      paintRegionInterior(biomeCtx, reg);

      resetCtx(ringCtx);
      ringCtx.clearRect(0, 0, bw, bh);
      ringCtx.translate(-bx, -by);
      if (blurPx > 0 && "filter" in ringCtx) ringCtx.filter = `blur(${blurPx}px)`;
      ringCtx.fillStyle = "#FFFFFF";
      traceRegion(ringCtx, outline);
      ringCtx.fill("evenodd");
      if ("filter" in ringCtx) ringCtx.filter = "none";

      resetCtx(biomeCtx);
      biomeCtx.globalCompositeOperation = "destination-in";
      biomeCtx.drawImage(ringCanvas, 0, 0, bw, bh, 0, 0, bw, bh);

      resetCtx(surfaceCtx);
      surfaceCtx.globalCompositeOperation = "source-over";
      surfaceCtx.globalAlpha = 1;
      surfaceCtx.drawImage(biomeCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
    }

    primaryPainted++;
  }

  // Trim all blurred/dilated interior passes cleanly to the exact unified shoreline U
  resetCtx(surfaceCtx);
  surfaceCtx.translate(-bx, -by);
  surfaceCtx.globalCompositeOperation = "destination-in";
  surfaceCtx.fillStyle = "#FFFFFF";
  traceUnified(surfaceCtx);
  surfaceCtx.fill("evenodd");

  // =========================================================================
  // PASS 3A: Shared Shallow-Water Shoreline Glow (smoothly transitioning shallowHex!)
  // =========================================================================
  const nonOverlayRegions = resolvedRegions.filter((r) => !isDepthOverlay(r.reg));
  const avgDepthFeather =
    nonOverlayRegions.length > 0
      ? nonOverlayRegions.reduce((acc, r) => acc + (r.reg.depthFeather ?? 0.6), 0) /
        nonOverlayRegions.length
      : 0.6;
  const featherScale = 0.45 + avgDepthFeather * 1.45;

  resetCtx(ringCtx);
  ringCtx.clearRect(0, 0, bw, bh);
  ringCtx.translate(-bx, -by);
  ringCtx.strokeStyle = "#FFFFFF";
  ringCtx.globalAlpha = 0.25;
  ringCtx.lineWidth = ppc * 2.6 * featherScale;
  traceUnified(ringCtx);
  ringCtx.stroke();
  ringCtx.globalAlpha = 0.36;
  ringCtx.lineWidth = ppc * 1.15 * featherScale;
  ringCtx.stroke();
  // Keep shallow glow strictly inside U
  ringCtx.globalCompositeOperation = "destination-in";
  ringCtx.globalAlpha = 1;
  ringCtx.fillStyle = "#FFFFFF";
  traceUnified(ringCtx);
  ringCtx.fill("evenodd");

  const okShallow = buildBiomeColorField(shoreTransitionBlur, ppc * 0.9 + blurPx, (reg) => {
    if (isDepthOverlay(reg)) return null;
    return {
      style: reg.shallowColorHex || reg.rimColorHex,
      alpha: reg.kind === "lava" ? 1 : 0.95,
    };
  });
  if (okShallow) {
    resetCtx(biomeCtx);
    biomeCtx.globalCompositeOperation = "destination-in";
    biomeCtx.drawImage(ringCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
    resetCtx(surfaceCtx);
    surfaceCtx.drawImage(biomeCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
  }

  // =========================================================================
  // PASS 3B: Shared Ripples & Crisp Lapping Foam Rim (Strictly Along U!)
  // =========================================================================
  const hasAnyRipple = nonOverlayRegions.some((r) => (r.reg.rippleIntensity ?? 0.65) > 0.02);
  if (hasAnyRipple) {
    resetCtx(ringCtx);
    ringCtx.clearRect(0, 0, bw, bh);
    ringCtx.translate(-bx, -by);
    ringCtx.strokeStyle = "#FFFFFF";
    // Inner dashed wave ripple ring
    ringCtx.globalAlpha = 0.26;
    ringCtx.lineWidth = ppc * 0.58;
    ringCtx.setLineDash([ppc * 0.42, ppc * 0.24]);
    traceUnified(ringCtx);
    ringCtx.stroke();
    ringCtx.setLineDash([]);
    // Crisp bright lapping shoreline foam edge
    ringCtx.globalAlpha = 0.8;
    ringCtx.lineWidth = ppc * 0.24;
    traceUnified(ringCtx);
    ringCtx.stroke();
    // Clip strictly inside U
    ringCtx.globalCompositeOperation = "destination-in";
    ringCtx.globalAlpha = 1;
    ringCtx.fillStyle = "#FFFFFF";
    traceUnified(ringCtx);
    ringCtx.fill("evenodd");

    const okFoam = buildBiomeColorField(shoreTransitionBlur, ppc * 0.6 + blurPx, (reg) => {
      if (isDepthOverlay(reg)) return null;
      const rip = reg.rippleIntensity ?? 0.65;
      if (rip <= 0.02) return null;
      const isLava = reg.kind === "lava";
      const isSwamp = reg.kind === "swamp";
      return {
        style: isLava ? "#FEF08A" : isSwamp ? reg.rimColorHex : "#ECFEFF",
        alpha: Math.min(1, 0.35 + rip * 0.62),
      };
    });
    if (okFoam) {
      resetCtx(biomeCtx);
      biomeCtx.globalCompositeOperation = "destination-in";
      biomeCtx.drawImage(ringCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
      resetCtx(surfaceCtx);
      surfaceCtx.drawImage(biomeCanvas, 0, 0, bw, bh, 0, 0, bw, bh);
    }
  }

  // Final unified water surface blit onto main canvas
  ctx.save();
  ctx.globalAlpha = (solidLayerOpacity > 0 ? solidLayerOpacity : 0.94) * layer.opacity;
  ctx.drawImage(surfaceCanvas, 0, 0, bw, bh, bx, by, bw, bh);
  ctx.restore();

  // Pass 4: Individual biome selection ring in Select (V) mode
  if (selectedId) {
    const selEntry = resolvedRegions.find((r) => r.reg.id === selectedId);
    if (selEntry) {
      ctx.save();
      traceRegion(ctx, selEntry.outline);
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = Math.max(2, ppc * 0.045);
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

function drawWaterLayer(
  ctx: CanvasRenderingContext2D,
  layer: MapLayer,
  ppc: number,
  assetLookup: Map<string, VaultAsset>,
  selectedId?: string | null,
  canvasWCells = 48,
  canvasHCells = 27,
  clipPx?: ClipRectPx,
  interactive = false,
) {
  const allRegions = layer.waterRegions ?? [];
  if (allRegions.length === 0) return;

  const liquidRegions = allRegions.filter((r) => r.kind !== "chasm");
  const chasmRegions = allRegions.filter((r) => r.kind === "chasm");

  // Chasms keep their crisp recessed cliff walls independently
  for (const reg of chasmRegions) {
    drawSingleWaterRegion(ctx, reg, layer.opacity, ppc, assetLookup, selectedId, clipPx, interactive);
  }

  if (liquidRegions.length === 0) return;

  if (layer.waterMeshEnabled !== false && liquidRegions.length >= 2) {
    drawUnifiedWaterSurface(
      ctx,
      liquidRegions,
      layer,
      ppc,
      assetLookup,
      selectedId,
      canvasWCells,
      canvasHCells,
      clipPx,
      interactive,
    );
  } else {
    for (const reg of liquidRegions) {
      drawSingleWaterRegion(ctx, reg, layer.opacity, ppc, assetLookup, selectedId, clipPx, interactive);
    }
  }
}

function drawObjectStamp(
  ctx: CanvasRenderingContext2D,
  obj: ObjectStamp,
  ppc: number,
  layerOpacity: number,
  assetLookup: Map<string, VaultAsset>,
  isViewport = false,
  interactive = false,
) {
  const url = resolveAssetUrl(obj.assetId, assetLookup);
  const rawImg = texturePool.get(url);
  const assetMeta = assetLookup.get(obj.assetId);
  // Keep texCap stable across zoom levels in live viewport so zooming NEVER invalidates recolor cache!
  const texCap = !isViewport
    ? ppc >= 96
      ? 1024
      : 768
    : Math.max(obj.widthCells, obj.heightCells) > 3.5
      ? 768
      : 512;
  const img = rawImg ? getProcessedTexture(rawImg, url, obj.recolor, assetMeta, texCap) : null;
  const wPx = obj.widthCells * ppc;
  const hPx = obj.heightCells * ppc;

  ctx.save();
  ctx.translate(obj.x * ppc, obj.y * ppc);
  ctx.rotate(obj.rotationRad);
  ctx.scale(obj.flipX ? -1 : 1, obj.flipY ? -1 : 1);
  ctx.globalAlpha = obj.opacity * layerOpacity;

  if (img) {
    if (!interactive && obj.castsShadow !== false && assetMeta?.castsShadow !== false) {
      // Grounded directional shadow (capped in screen/device px so 400-800% zoom never creates 40px blurs!)
      ctx.shadowColor = "rgba(5, 9, 16, 0.5)";
      ctx.shadowBlur = Math.min(8, Math.max(2.5, ppc * 0.1));
      ctx.shadowOffsetX = Math.min(6, ppc * 0.06);
      ctx.shadowOffsetY = Math.min(9, ppc * 0.1);
    }
    ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx);
  } else {
    ctx.fillStyle = "rgba(139, 92, 246, 0.25)";
    ctx.strokeStyle = "#8B5CF6";
    ctx.lineWidth = 2;
    ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
    ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
  }
  ctx.restore();
}

function drawGridOverlay(
  ctx: CanvasRenderingContext2D,
  doc: DcMapDocument,
  ppc: number,
  vp?: WorldViewportCells,
) {
  const { type, visible, colorHex, opacity } = doc.canvas.grid;
  if (!visible || type === "none") return;

  const wPx = doc.canvas.widthCells * ppc;
  const hPx = doc.canvas.heightCells * ppc;
  const minCellX = vp ? Math.max(0, Math.floor(vp.minX)) : 0;
  const maxCellX = vp ? Math.min(doc.canvas.widthCells, Math.ceil(vp.maxX)) : doc.canvas.widthCells;
  const minCellY = vp ? Math.max(0, Math.floor(vp.minY)) : 0;
  const maxCellY = vp ? Math.min(doc.canvas.heightCells, Math.ceil(vp.maxY)) : doc.canvas.heightCells;
  const startX = minCellX * ppc;
  const endX = maxCellX * ppc;
  const startY = minCellY * ppc;
  const endY = maxCellY * ppc;

  ctx.save();
  ctx.strokeStyle = colorHex;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = Math.max(1, Math.min(2.2, ppc * 0.015));

  if (type === "square") {
    ctx.beginPath();
    for (let x = minCellX; x <= maxCellX; x++) {
      ctx.moveTo(x * ppc, startY);
      ctx.lineTo(x * ppc, endY);
    }
    for (let y = minCellY; y <= maxCellY; y++) {
      ctx.moveTo(startX, y * ppc);
      ctx.lineTo(endX, y * ppc);
    }
    ctx.stroke();
  } else {
    // Hex flat or pointy top grid (frustum-culled to visible viewport!)
    const r = ppc * 0.58;
    const dx = type === "hex_flat" ? r * 1.5 : r * Math.sqrt(3);
    const dy = type === "hex_flat" ? r * Math.sqrt(3) : r * 1.5;
    const rotOff = type === "hex_flat" ? 0 : Math.PI / 6;
    const rowStart = Math.max(-1, Math.floor((startY - dy) / dy));
    const rowEnd = Math.ceil((endY + dy) / dy);
    const colStart = Math.max(-1, Math.floor((startX - dx) / dx));
    const colEnd = Math.ceil((endX + dx) / dx);
    ctx.beginPath();
    for (let row = rowStart; row <= rowEnd && row * dy < hPx + dy; row++) {
      for (let col = colStart; col <= colEnd && col * dx < wPx + dx; col++) {
        const cx =
          col * dx + (type === "hex_pointy" && row % 2 !== 0 ? dx * 0.5 : 0);
        const cy =
          row * dy + (type === "hex_flat" && col % 2 !== 0 ? dy * 0.5 : 0);
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i + rotOff;
          const vx = cx + Math.cos(ang) * r;
          const vy = cy + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(vx, vy);
          else ctx.lineTo(vx, vy);
        }
        ctx.closePath();
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Compute the multiply-lightmap ambient RGB color from an ambient tint swatch and
 * monotonic brightness intensity (0..1). Normalizing the tint hue ensures bright
 * swatches like Golden Hour (#FFE6BF) still darken cleanly at low intensity, while
 * dark swatches like Blue Hour (#162038) tint without crushing to pitch black.
 */
export function computeAmbientLightmapRgb(
  ambientHex: string,
  ambientIntensity: number,
): [number, number, number] {
  const intensity = Math.max(0, Math.min(1, ambientIntensity));
  const [ar, ag, ab] = hexToRgbTuple(ambientHex);
  const maxC = Math.max(ar, ag, ab);
  // Extract balanced chromatic tint (blended 65% hue + 35% neutral white so colors stay natural)
  let tr = 255;
  let tg = 255;
  let tb = 255;
  if (maxC > 0) {
    const nr = (ar / maxC) * 255;
    const ng = (ag / maxC) * 255;
    const nb = (ab / maxC) * 255;
    tr = nr * 0.68 + 255 * 0.32;
    tg = ng * 0.68 + 255 * 0.32;
    tb = nb * 0.68 + 255 * 0.32;
  }
  return [
    Math.round(tr * intensity),
    Math.round(tg * intensity),
    Math.round(tb * intensity),
  ];
}

interface CachedLightmapEntry {
  canvas: HTMLCanvasElement;
  lightPolys: Array<{ light: LightNode; poly: Point2D[] }>;
}

const lightmapCache = new Map<string, CachedLightmapEntry>();

function computeLightmapSignature(
  doc: DcMapDocument,
  ambientHex: string,
  ambientIntensity: number,
  lmW: number,
  lmH: number,
  lights: LightNode[],
  walls: WallSegment[],
  portals: PortalNode[],
): string {
  const parts: string[] = [
    `${doc.canvas.widthCells}x${doc.canvas.heightCells}`,
    `${lmW}x${lmH}`,
    ambientHex,
    ambientIntensity.toFixed(3),
    (doc.lighting.shadowSoftness ?? 0.5).toFixed(2),
  ];
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    parts.push(
      `L:${l.x.toFixed(2)},${l.y.toFixed(2)},${l.radiusCells.toFixed(2)},${l.intensity.toFixed(2)},${l.colorHex},${l.castShadows ? 1 : 0},${l.coneAngleDeg.toFixed(1)},${l.directionRad.toFixed(3)}`,
    );
  }
  let wallHash = walls.length * 131;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (!w.blocksLight) continue;
    wallHash = (Math.imul(wallHash, 31) + w.points.length * 17 + (w.closed ? 3 : 0) + (w.curved ? 5 : 0)) | 0;
    for (let j = 0; j < w.points.length; j++) {
      wallHash = (Math.imul(wallHash, 31) + Math.round(w.points[j].x * 20)) | 0;
      wallHash = (Math.imul(wallHash, 31) + Math.round(w.points[j].y * 20)) | 0;
    }
  }
  parts.push(`W:${wallHash}`);
  for (let i = 0; i < portals.length; i++) {
    const p = portals[i];
    parts.push(
      `P:${p.x.toFixed(2)},${p.y.toFixed(2)},${p.widthCells.toFixed(2)},${p.rotationRad.toFixed(2)},${p.closed ? 1 : 0},${p.kind}`,
    );
  }
  return parts.join("|");
}

function drawLightingPass(
  ctx: CanvasRenderingContext2D,
  doc: DcMapDocument,
  wPx: number,
  hPx: number,
  ppc: number,
  lights: LightNode[],
  walls: WallSegment[],
  portals: PortalNode[],
  overridePresetId?: string,
  clipPx?: ClipRectPx,
  vp?: WorldViewportCells,
) {
  if (!doc.lighting.enabled) return;

  let ambientHex = doc.lighting.ambientColorHex;
  let ambientIntensity = doc.lighting.ambientIntensity;
  if (overridePresetId) {
    const preset = doc.lighting.presets.find((p) => p.id === overridePresetId);
    if (preset) {
      ambientHex = preset.ambientColorHex;
      ambientIntensity = preset.ambientIntensity;
    }
  }

  // Cap live viewport lightmap resolution <= 560px (hardware-upscaled smoothly & cached across pan/zoom!)
  const maxLmSide = vp ? 560 : 1024;
  const baseScale = wPx > 1200 ? 0.25 : 0.35;
  const maxSideScale = maxLmSide / Math.max(1, wPx, hPx);
  const lmScale = Math.min(baseScale, maxSideScale);
  const lmW = Math.max(64, Math.round(wPx * lmScale));
  const lmH = Math.max(64, Math.round(hPx * lmScale));

  const sig = computeLightmapSignature(
    doc,
    ambientHex,
    ambientIntensity,
    lmW,
    lmH,
    lights,
    walls,
    portals,
  );
  let entry = lightmapCache.get(sig);
  if (entry) {
    // Refresh LRU
    lightmapCache.delete(sig);
    lightmapCache.set(sig, entry);
  } else {
    const lm = document.createElement("canvas");
    lm.width = lmW;
    lm.height = lmH;
    const lctx = lm.getContext("2d");
    if (!lctx) return;
    const lppcX = lmW / Math.max(1, doc.canvas.widthCells);
    const lppcY = lmH / Math.max(1, doc.canvas.heightCells);
    const lppc = (lppcX + lppcY) * 0.5;

    const [mr, mg, mb] = computeAmbientLightmapRgb(ambientHex, ambientIntensity);
    lctx.fillStyle = `rgb(${mr}, ${mg}, ${mb})`;
    lctx.fillRect(0, 0, lmW, lmH);

    const occluders = extractLightOccluders(walls, portals);
    const softnessPx = Math.max(0, Math.min(5, (doc.lighting.shadowSoftness ?? 0.5) * 4.2));
    const lightPolys: Array<{ light: LightNode; poly: Point2D[] }> = [];

    lctx.globalCompositeOperation = "lighter";
    for (const light of lights) {
      const poly = computeVisibilityPolygon(light, occluders, 44);
      if (poly.length < 3) continue;
      lightPolys.push({ light, poly });

      const [lr, lg, lb] = hexToRgbTuple(light.colorHex);
      const ox = light.x * lppcX;
      const oy = light.y * lppcY;
      const rPx = light.radiusCells * lppc;

      lctx.save();
      if (softnessPx >= 0.4) {
        lctx.filter = `blur(${softnessPx.toFixed(1)}px)`;
      }
      lctx.beginPath();
      lctx.moveTo(poly[0].x * lppcX, poly[0].y * lppcY);
      for (let i = 1; i < poly.length; i++) {
        lctx.lineTo(poly[i].x * lppcX, poly[i].y * lppcY);
      }
      lctx.closePath();
      lctx.clip();

      const grad = lctx.createRadialGradient(ox, oy, 0, ox, oy, rPx);
      const peak = Math.min(1, 0.9 * light.intensity);
      grad.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, ${peak})`);
      grad.addColorStop(0.45, `rgba(${lr}, ${lg}, ${lb}, ${peak * 0.58})`);
      grad.addColorStop(0.82, `rgba(${lr}, ${lg}, ${lb}, ${peak * 0.18})`);
      grad.addColorStop(1, `rgba(${lr}, ${lg}, ${lb}, 0)`);
      lctx.fillStyle = grad;
      lctx.fillRect(ox - rPx, oy - rPx, rPx * 2, rPx * 2);
      lctx.restore();
    }

    entry = { canvas: lm, lightPolys };
    if (lightmapCache.size >= 16) {
      const oldest = lightmapCache.keys().next().value;
      if (oldest !== undefined) lightmapCache.delete(oldest);
    }
    lightmapCache.set(sig, entry);
  }

  const { canvas: lm, lightPolys } = entry;

  // Multiply smooth hardware-upscaled lightmap strictly over the visible clip rect
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = "multiply";
  if (clipPx) {
    const cx0 = Math.max(0, clipPx.x0);
    const cy0 = Math.max(0, clipPx.y0);
    const cx1 = Math.min(wPx, clipPx.x1);
    const cy1 = Math.min(hPx, clipPx.y1);
    const cw = cx1 - cx0;
    const ch = cy1 - cy0;
    if (cw > 0 && ch > 0) {
      const sx = (cx0 / Math.max(1, wPx)) * lm.width;
      const sy = (cy0 / Math.max(1, hPx)) * lm.height;
      const sw = (cw / Math.max(1, wPx)) * lm.width;
      const sh = (ch / Math.max(1, hPx)) * lm.height;
      ctx.drawImage(lm, sx, sy, sw, sh, cx0, cy0, cw, ch);
    }
  } else {
    ctx.drawImage(lm, 0, 0, wPx, hPx);
  }

  // Add subtle wall-occluded warm bloom highlight cores for bright lamps & campfires (frustum-culled!)
  ctx.globalCompositeOperation = "screen";
  for (const { light, poly } of lightPolys) {
    if (light.intensity < 0.7) continue;
    const coreCells = light.radiusCells * 0.28;
    if (
      !isRectVisible(
        light.x - coreCells,
        light.y - coreCells,
        light.x + coreCells,
        light.y + coreCells,
        vp,
      )
    ) {
      continue;
    }
    const [lr, lg, lb] = hexToRgbTuple(light.colorHex);
    const ox = light.x * ppc;
    const oy = light.y * ppc;
    const coreR = coreCells * ppc;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x * ppc, poly[0].y * ppc);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x * ppc, poly[i].y * ppc);
    }
    ctx.closePath();
    ctx.clip();
    const bloom = ctx.createRadialGradient(ox, oy, 0, ox, oy, coreR);
    bloom.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, ${Math.min(0.28, light.intensity * 0.17)})`);
    bloom.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = bloom;
    ctx.beginPath();
    ctx.arc(ox, oy, coreR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// Reusable offscreen band buffers for per-elevation lighting (keeps 1F lights strictly under 2F & ROOF!)
let bandRenderCanvas: HTMLCanvasElement | null = null;
let bandAlphaCanvas: HTMLCanvasElement | null = null;

function ensureBandBuffers(w: number, h: number): {
  bandCanvas: HTMLCanvasElement;
  bandCtx: CanvasRenderingContext2D;
  alphaCanvas: HTMLCanvasElement;
  alphaCtx: CanvasRenderingContext2D;
} | null {
  if (typeof document === "undefined" || w <= 0 || h <= 0) return null;
  if (!bandRenderCanvas) bandRenderCanvas = document.createElement("canvas");
  if (!bandAlphaCanvas) bandAlphaCanvas = document.createElement("canvas");
  if (bandRenderCanvas.width !== w || bandRenderCanvas.height !== h) {
    bandRenderCanvas.width = w;
    bandRenderCanvas.height = h;
  }
  if (bandAlphaCanvas.width !== w || bandAlphaCanvas.height !== h) {
    bandAlphaCanvas.width = w;
    bandAlphaCanvas.height = h;
  }
  const bandCtx = bandRenderCanvas.getContext("2d");
  const alphaCtx = bandAlphaCanvas.getContext("2d");
  if (!bandCtx || !alphaCtx) return null;
  return {
    bandCanvas: bandRenderCanvas,
    bandCtx,
    alphaCanvas: bandAlphaCanvas,
    alphaCtx,
  };
}

/**
 * Draws atmospheric additive spotlight beams (e.g. skyship bridge searchlights) into open air
 * beyond an elevated deck's hull silhouette without darkening lower levels.
 */
function drawElevatedSpotlightBeams(
  ctx: CanvasRenderingContext2D,
  ppc: number,
  lights: LightNode[],
  walls: WallSegment[],
  portals: PortalNode[],
  vp?: WorldViewportCells,
) {
  const spots = lights.filter(
    (l) =>
      l.coneAngleDeg < 350 &&
      l.intensity >= 0.5 &&
      isRectVisible(
        l.x - l.radiusCells,
        l.y - l.radiusCells,
        l.x + l.radiusCells,
        l.y + l.radiusCells,
        vp,
      ),
  );
  if (spots.length === 0) return;
  const occluders = extractLightOccluders(walls, portals);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const light of spots) {
    const poly = computeVisibilityPolygon(light, occluders, 36);
    if (poly.length < 3) continue;
    const [lr, lg, lb] = hexToRgbTuple(light.colorHex);
    const ox = light.x * ppc;
    const oy = light.y * ppc;
    const rPx = light.radiusCells * ppc;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(poly[0].x * ppc, poly[0].y * ppc);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x * ppc, poly[i].y * ppc);
    }
    ctx.closePath();
    ctx.clip();
    const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, rPx);
    const peak = Math.min(0.36, light.intensity * 0.24);
    grad.addColorStop(0, `rgba(${lr}, ${lg}, ${lb}, ${peak})`);
    grad.addColorStop(0.55, `rgba(${lr}, ${lg}, ${lb}, ${peak * 0.45})`);
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(ox - rPx, oy - rPx, rPx * 2, rPx * 2);
    ctx.restore();
  }
  ctx.restore();
}

function drawVttAndDmOverlays(
  ctx: CanvasRenderingContext2D,
  doc: DcMapDocument,
  ppc: number,
  opts: RenderOptions,
) {
  const vp = opts.viewportCells;
  // VTT Wall Occluders & Light Radii Debug Overlay (Cyan walls + Amber light circles!)
  if (opts.showVttOverlay) {
    ctx.save();
    for (const layer of doc.layers) {
      if (opts.isolatedLevelId) {
        if (layer.levelId !== opts.isolatedLevelId || layer.dmOnly) continue;
      } else if (!layer.visible || layer.dmOnly) {
        continue;
      }
      for (const wall of layer.walls ?? []) {
        if (!wall.blocksLight || wall.points.length < 2) continue;
        if (!isPointBoxVisible(wall.points, vp, 1.0)) continue;
        const pts = wall.curved ? sampleCatmullRom(wall.points, 6, wall.closed) : wall.points;
        ctx.strokeStyle = "#22D3EE";
        ctx.lineWidth = Math.max(2, ppc * 0.06);
        ctx.beginPath();
        ctx.moveTo(pts[0].x * ppc, pts[0].y * ppc);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * ppc, pts[i].y * ppc);
        if (wall.closed) ctx.closePath();
        ctx.stroke();
      }
      for (const p of layer.portals ?? []) {
        if (!isRectVisible(p.x - p.widthCells, p.y - p.widthCells, p.x + p.widthCells, p.y + p.widthCells, vp)) {
          continue;
        }
        const dx = Math.cos(p.rotationRad) * (p.widthCells * 0.5) * ppc;
        const dy = Math.sin(p.rotationRad) * (p.widthCells * 0.5) * ppc;
        ctx.strokeStyle = p.closed ? "#F59E0B" : "#10B981";
        ctx.lineWidth = Math.max(3, ppc * 0.09);
        ctx.beginPath();
        ctx.moveTo(p.x * ppc - dx, p.y * ppc - dy);
        ctx.lineTo(p.x * ppc + dx, p.y * ppc + dy);
        ctx.stroke();
      }
      for (const l of layer.lights ?? []) {
        if (!isRectVisible(l.x - l.radiusCells, l.y - l.radiusCells, l.x + l.radiusCells, l.y + l.radiusCells, vp)) {
          continue;
        }
        ctx.strokeStyle = "rgba(229, 169, 60, 0.55)";
        ctx.lineWidth = Math.max(1.2, ppc * 0.03);
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(l.x * ppc, l.y * ppc, l.radiusCells * ppc, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }

  // DM-Only Secret Notes & Trap Callouts (stripped automatically in Player View!)
  if (opts.dmView) {
    for (const layer of doc.layers) {
      if (opts.isolatedLevelId) {
        if (layer.levelId !== opts.isolatedLevelId || !layer.dmOnly) continue;
      } else if (!layer.visible || !layer.dmOnly) {
        continue;
      }
      for (const note of layer.dmNotes ?? []) {
        if (!isRectVisible(note.x - 4, note.y - 1.5, note.x + 4, note.y + 1.5, vp)) continue;
        const nx = note.x * ppc;
        const ny = note.y * ppc;
        const selected = opts.selectedId === note.id;
        ctx.save();
        ctx.font = `600 ${Math.max(10, Math.round(ppc * 0.24))}px Inter, system-ui, sans-serif`;
        const label = `[${note.badge}] ${note.title}`;
        const metrics = ctx.measureText(label);
        const padX = Math.max(6, ppc * 0.16);
        const boxH = Math.max(20, ppc * 0.52);
        const boxW = metrics.width + padX * 2;

        ctx.fillStyle = "rgba(18, 20, 26, 0.90)";
        ctx.strokeStyle = selected ? "#E5A93C" : note.colorHex;
        ctx.lineWidth = selected ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.roundRect(nx - boxW / 2, ny - boxH / 2, boxW, boxH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = note.colorHex;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, nx, ny + 0.5);
        ctx.restore();
      }
    }
  }
}

/**
 * Renders the full DcMapDocument onto a target 2D canvas context at arbitrary scale (from 60fps
 * live viewport to 4K/8K/16K tiled export chunks).
 */
function resolveRidgeCapColors(roof: RoofStructure): {
  body: string;
  outline: string;
  highlight: string;
} {
  const preset = getRoofPresetByAssetId(roof.assetId);
  switch (roof.ridgeCapStyle) {
    case "timber":
      return { body: "#624127", outline: "#24160C", highlight: "rgba(255, 224, 178, 0.36)" };
    case "stone":
      return { body: "#6C7680", outline: "#1F252C", highlight: "rgba(235, 245, 255, 0.34)" };
    case "copper":
      return { body: "#4B9384", outline: "#18332D", highlight: "rgba(220, 255, 245, 0.42)" };
    case "matching":
    default:
      return {
        body: preset.ridgeColorHex,
        outline: preset.eaveTrimHex,
        highlight: "rgba(255, 244, 220, 0.34)",
      };
  }
}

/**
 * Renders a complete 2.5D architectural roof (Gable, Hip, Shed, Mansard, or Cone/Turret)
 * with directionally aligned shingle courses, sun-angled slope shading, weathering,
 * raised ridge/hip caps, bargeboard eave trim, and elevated ground drop shadow.
 * Exported so MapCanvas can use the exact same renderer for live WYSIWYG previews.
 */
export function drawRoofStructure(
  ctx: CanvasRenderingContext2D,
  roof: RoofStructure,
  ppc: number,
  layerOpacity: number,
  assetLookup: Map<string, VaultAsset>,
  vp?: WorldViewportCells,
  interactive = false,
): void {
  const geom = getCachedRoofGeometry(roof);
  if (geom.footprint.length < 3 || geom.facets.length === 0) return;
  if (vp && !isPointBoxVisible(geom.footprint, vp, Math.max(1.5, roof.shadowDistanceCells ?? 0.8))) {
    return;
  }

  const alpha = Math.max(0.05, Math.min(1, roof.opacity * layerOpacity));
  const sunRad = (((roof.sunAngleDeg ?? 225) % 360) * Math.PI) / 180;
  const sunDir = { x: Math.cos(sunRad), y: Math.sin(sunRad) };
  const shadowDir = { x: -sunDir.x, y: -sunDir.y };
  const slopeShade = Math.max(0, Math.min(1, roof.slopeShade ?? 0.54));
  const dropShadow = Math.max(0, Math.min(1, roof.dropShadow ?? 0.72));
  const shadowDistPx = Math.max(0.15, roof.shadowDistanceCells ?? 0.65) * ppc;
  const weathering = Math.max(0, Math.min(1, roof.weathering ?? 0.24));
  const texScale = Math.max(0.45, Math.min(2.2, roof.textureScale ?? 1.0));
  const preset = getRoofPresetByAssetId(roof.assetId);

  const roofUrl = resolveAssetUrl(roof.assetId, assetLookup);
  const rawImg = texturePool.get(roofUrl);
  const img = rawImg
    ? getProcessedTexture(rawImg, roofUrl, roof.recolor, assetLookup.get(roof.assetId))
    : null;

  const tracePoly = (poly: Point2D[]) => {
    ctx.beginPath();
    ctx.moveTo(poly[0].x * ppc, poly[0].y * ppc);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x * ppc, poly[i].y * ppc);
    }
    ctx.closePath();
  };

  ctx.save();
  ctx.globalAlpha = alpha;

  // ── PASS 1: Directional Elevated Ground Drop Shadow + Tight Eave AO ──
  if (dropShadow > 0.02) {
    // 1a. Wide directional cast shadow offset away from the sun (capped blur radius for crisp 60fps zoom!)
    ctx.save();
    ctx.translate(shadowDir.x * shadowDistPx, shadowDir.y * shadowDistPx);
    if (!interactive) {
      ctx.filter = `blur(${Math.min(10, Math.max(2, Math.round(ppc * 0.14)))}px)`;
    }
    ctx.fillStyle = `rgba(4, 7, 15, ${(dropShadow * (interactive ? 0.42 : 0.52)).toFixed(3)})`;
    tracePoly(geom.footprint);
    ctx.fill();
    ctx.restore();

    // 1b. Tight ambient occlusion shadow tucked directly beneath the eaves
    if (!interactive) {
      ctx.save();
      ctx.translate(shadowDir.x * Math.max(1.5, ppc * 0.1), shadowDir.y * Math.max(1.5, ppc * 0.1));
      ctx.filter = `blur(${Math.min(5, Math.max(1, Math.round(ppc * 0.06)))}px)`;
      ctx.fillStyle = `rgba(3, 6, 12, ${(dropShadow * 0.42).toFixed(3)})`;
      tracePoly(geom.footprint);
      ctx.fill();
      ctx.restore();
    }
  }

  // ── PASS 2: Directionally Oriented Shingle Facets + Physical Sun Shading ──
  const pattern = img ? ctx.createPattern(img, "repeat") : null;
  const tileWorldPx = 3.0 * texScale * ppc;
  const imgW = img ? Math.max(1, img.width) : 512;
  const imgH = img ? Math.max(1, img.height) : 512;
  const scaleX = tileWorldPx / imgW;
  const scaleY = tileWorldPx / imgH;

  for (const facet of geom.facets) {
    if (facet.polygon.length < 3) continue;
    ctx.save();
    tracePoly(facet.polygon);
    ctx.clip();

    // 2a. Fill facet with shingle texture rotated so +Y cascades downhill along facet.downhillDir
    if (pattern) {
      const rotRad = Math.atan2(facet.downhillDir.y, facet.downhillDir.x) - Math.PI / 2;
      const rotDeg = (rotRad * 180) / Math.PI;
      if (typeof DOMMatrix !== "undefined" && typeof pattern.setTransform === "function") {
        const m = new DOMMatrix()
          .translate(facet.texOrigin.x * ppc, facet.texOrigin.y * ppc)
          .rotate(rotDeg)
          .scale(scaleX, scaleY);
        pattern.setTransform(m);
        ctx.fillStyle = pattern;
        tracePoly(facet.polygon);
        ctx.fill();
        // Micro-stroke eliminates 0.5px Canvas2D antialiasing gaps between shared facet seams
        ctx.strokeStyle = pattern;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.translate(facet.texOrigin.x * ppc, facet.texOrigin.y * ppc);
        ctx.rotate(rotRad);
        ctx.scale(scaleX, scaleY);
        ctx.fillStyle = pattern;
        ctx.fillRect(-4096, -4096, 8192, 8192);
      }
    } else {
      ctx.fillStyle = preset.ridgeColorHex;
      tracePoly(facet.polygon);
      ctx.fill();
    }

    // Compute facet projection along downhillDir for realistic ridge-to-eave gradient
    let minD = Infinity;
    let maxD = -Infinity;
    for (const p of facet.polygon) {
      const d = (p.x - facet.texOrigin.x) * facet.downhillDir.x + (p.y - facet.texOrigin.y) * facet.downhillDir.y;
      if (d < minD) minD = d;
      if (d > maxD) maxD = d;
    }
    const spanD = Math.max(0.25, maxD - minD);

    if (facet.isFlatCrown) {
      // Recessed flat crown on a Mansard roof: cooler top finish + subtle inner parapet bevel shadow
      ctx.fillStyle = "rgba(14, 20, 32, 0.22)";
      tracePoly(facet.polygon);
      ctx.fill();
      ctx.strokeStyle = "rgba(5, 9, 16, 0.55)";
      ctx.lineWidth = Math.max(3, ppc * 0.22);
      tracePoly(facet.polygon);
      ctx.stroke();
    } else {
      // 2b. Directional Sun-Angle Slope Lighting (dot product of downhill face normal vs sun vector)
      const lightDot = facet.downhillDir.x * sunDir.x + facet.downhillDir.y * sunDir.y;
      if (slopeShade > 0.01) {
        if (lightDot > 0) {
          // Sunlit warm highlight wash
          const hiA = Math.min(0.32, lightDot * slopeShade * 0.28);
          ctx.fillStyle = `rgba(255, 240, 205, ${hiA.toFixed(3)})`;
          tracePoly(facet.polygon);
          ctx.fill();
        } else {
          // Cool twilight-indigo slope shadow (sells the 3D pitched roof immediately!)
          const shA = Math.min(0.66, -lightDot * slopeShade * 0.62);
          ctx.fillStyle = `rgba(10, 16, 32, ${shA.toFixed(3)})`;
          tracePoly(facet.polygon);
          ctx.fill();
        }
      }

      // 2c. Ridge-to-Eave Pitch Depth + Eave Weathering Gradient
      const x0 = (facet.texOrigin.x + facet.downhillDir.x * minD) * ppc;
      const y0 = (facet.texOrigin.y + facet.downhillDir.y * minD) * ppc;
      const x1 = (facet.texOrigin.x + facet.downhillDir.x * maxD) * ppc;
      const y1 = (facet.texOrigin.y + facet.downhillDir.y * maxD) * ppc;
      if (Math.hypot(x1 - x0, y1 - y0) > 1) {
        const grad = ctx.createLinearGradient(x0, y0, x1, y1);
        const crestGlow = lightDot >= -0.15 ? 0.14 * slopeShade : 0.04 * slopeShade;
        const eaveDark = Math.min(0.42, 0.12 * slopeShade + 0.28 * weathering);
        grad.addColorStop(0, `rgba(255, 246, 224, ${crestGlow.toFixed(3)})`);
        grad.addColorStop(0.55, "rgba(0, 0, 0, 0)");
        grad.addColorStop(1, `rgba(8, 12, 18, ${eaveDark.toFixed(3)})`);
        ctx.fillStyle = grad;
        tracePoly(facet.polygon);
        ctx.fill();
      }

      // 2d. Subtle dark crease along facet ridge seam when span is substantial
      if (spanD > 0.6 && weathering > 0.05) {
        ctx.strokeStyle = `rgba(8, 12, 18, ${(weathering * 0.24).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, ppc * 0.09);
        tracePoly(facet.polygon);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  // ── PASS 3: Raised Architectural Ridge Caps, Hip Seams & Spire Finial ──
  if (roof.ridgeCapStyle !== "none" && geom.ridgeLines.length > 0) {
    const capColors = resolveRidgeCapColors(roof);
    const baseCapPx = Math.max(2.5, (roof.ridgeCapWidthCells ?? 0.24) * ppc);

    // Draw secondary hip ridges first so main spine ridge caps sit cleanly on top
    const orderedRidges = [...geom.ridgeLines].sort(
      (a, b) => Number(a.isMainRidge) - Number(b.isMainRidge),
    );

    for (const rl of orderedRidges) {
      if (rl.points.length < 2) continue;
      const capW = rl.isMainRidge ? baseCapPx : baseCapPx * 0.72;

      const traceRidge = () => {
        ctx.beginPath();
        ctx.moveTo(rl.points[0].x * ppc, rl.points[0].y * ppc);
        for (let i = 1; i < rl.points.length; i++) {
          ctx.lineTo(rl.points[i].x * ppc, rl.points[i].y * ppc);
        }
      };

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // 3a. Soft cast shadow beneath raised ridge beam
      ctx.save();
      ctx.translate(shadowDir.x * capW * 0.28, shadowDir.y * capW * 0.28);
      ctx.strokeStyle = "rgba(4, 7, 14, 0.48)";
      ctx.lineWidth = capW * 1.22;
      traceRidge();
      ctx.stroke();
      ctx.restore();

      // 3b. Dark hand-inked casing outline
      ctx.strokeStyle = capColors.outline;
      ctx.lineWidth = capW + Math.max(1.8, ppc * 0.07);
      traceRidge();
      ctx.stroke();

      // 3c. Solid ridge cap body
      ctx.strokeStyle = capColors.body;
      ctx.lineWidth = capW;
      traceRidge();
      ctx.stroke();

      // 3d. Subtle segmented ridge-tile joints perpendicular to the beam
      ctx.strokeStyle = "rgba(10, 14, 22, 0.28)";
      ctx.lineWidth = Math.max(1, ppc * 0.032);
      const tickSpacing = Math.max(6, capW * 1.15);
      for (let i = 0; i < rl.points.length - 1; i++) {
        const ax = rl.points[i].x * ppc;
        const ay = rl.points[i].y * ppc;
        const bx = rl.points[i + 1].x * ppc;
        const by = rl.points[i + 1].y * ppc;
        const segLen = Math.hypot(bx - ax, by - ay);
        if (segLen < tickSpacing) continue;
        const ux = (bx - ax) / segLen;
        const uy = (by - ay) / segLen;
        const nx = -uy;
        const ny = ux;
        const count = Math.floor(segLen / tickSpacing);
        for (let k = 1; k < count; k++) {
          const d = k * tickSpacing;
          const px = ax + ux * d;
          const py = ay + uy * d;
          ctx.beginPath();
          ctx.moveTo(px - nx * (capW * 0.48), py - ny * (capW * 0.48));
          ctx.lineTo(px + nx * (capW * 0.48), py + ny * (capW * 0.48));
          ctx.stroke();
        }
      }

      // 3e. Sunlit specular highlight along crest
      ctx.save();
      ctx.translate(sunDir.x * capW * 0.14, sunDir.y * capW * 0.14);
      ctx.strokeStyle = capColors.highlight;
      ctx.lineWidth = Math.max(1.2, capW * 0.26);
      traceRidge();
      ctx.stroke();
      ctx.restore();

      ctx.restore();
    }
  }

  // 3f. Ornate Spire Finial for Cone / Turret Roofs
  if (geom.finialCenter && roof.ridgeCapStyle !== "none") {
    const capColors = resolveRidgeCapColors(roof);
    const fx = geom.finialCenter.x * ppc;
    const fy = geom.finialCenter.y * ppc;
    const fr = Math.max(4, (roof.ridgeCapWidthCells ?? 0.24) * ppc * 0.95);
    ctx.save();
    ctx.fillStyle = "rgba(4, 7, 14, 0.46)";
    ctx.beginPath();
    ctx.arc(fx + shadowDir.x * fr * 0.35, fy + shadowDir.y * fr * 0.35, fr * 1.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = capColors.body;
    ctx.strokeStyle = capColors.outline;
    ctx.lineWidth = Math.max(1.4, ppc * 0.05);
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = capColors.highlight;
    ctx.beginPath();
    ctx.arc(fx + sunDir.x * fr * 0.28, fy + sunDir.y * fr * 0.28, fr * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── PASS 4: Crisp Bargeboard / Eave Fascia Trim Outline ──
  if (roof.eaveTrim) {
    ctx.save();
    ctx.lineJoin = "miter";
    ctx.miterLimit = 3;
    ctx.strokeStyle = preset.eaveTrimHex;
    ctx.lineWidth = Math.max(1.6, ppc * 0.085);
    tracePoly(geom.footprint);
    ctx.stroke();

    // Subtle crisp inner highlight along outer eaves
    ctx.strokeStyle = "rgba(255, 246, 224, 0.14)";
    ctx.lineWidth = Math.max(0.8, ppc * 0.028);
    tracePoly(geom.footprint);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

let _caveApronCanvas: HTMLCanvasElement | null = null;

export function renderMapScene(
  outCtx: CanvasRenderingContext2D,
  doc: DcMapDocument,
  assetLookup: Map<string, VaultAsset>,
  opts: RenderOptions,
) {
  let ctx = outCtx;
  const ppc = opts.pixelsPerCell;
  const fullW = doc.canvas.widthCells * ppc;
  const fullH = doc.canvas.heightCells * ppc;
  const vp = opts.viewportCells;
  const interactive = Boolean(opts.interactive || vp?.allowDetailPlate === false);
  const clipPx: ClipRectPx | undefined = opts.cropRectPx
    ? {
        x0: opts.cropRectPx.x,
        y0: opts.cropRectPx.y,
        x1: opts.cropRectPx.x + opts.cropRectPx.w,
        y1: opts.cropRectPx.y + opts.cropRectPx.h,
      }
    : vp
      ? {
          x0: Math.max(0, Math.floor(vp.minX * ppc)),
          y0: Math.max(0, Math.floor(vp.minY * ppc)),
          x1: Math.min(Math.ceil(fullW), Math.ceil(vp.maxX * ppc)),
          y1: Math.min(Math.ceil(fullH), Math.ceil(vp.maxY * ppc)),
        }
      : undefined;
  const fillX0 = clipPx ? clipPx.x0 : 0;
  const fillY0 = clipPx ? clipPx.y0 : 0;
  const fillW = clipPx ? Math.max(0, clipPx.x1 - clipPx.x0) : fullW;
  const fillH = clipPx ? Math.max(0, clipPx.y1 - clipPx.y0) : fullH;
  const cropOffX = opts.cropRectPx ? opts.cropRectPx.x : 0;
  const cropOffY = opts.cropRectPx ? opts.cropRectPx.y : 0;
  const bandW = opts.cropRectPx
    ? Math.max(1, Math.round(opts.cropRectPx.w))
    : Math.max(1, Math.round(fullW));
  const bandH = opts.cropRectPx
    ? Math.max(1, Math.round(opts.cropRectPx.h))
    : Math.max(1, Math.round(fullH));
  const tileCache = new Map<string, CanvasPattern | null>();

  ctx.save();
  if (opts.cropRectPx) {
    ctx.translate(-cropOffX, -cropOffY);
  }

  // Dedicated Wonderdraft-parity World Atlas rendering pipeline
  if (doc.mode === "world" && doc.world) {
    renderWorldMapScene(ctx, doc, assetLookup, opts);
    ctx.restore();
    return;
  }

  if (opts.onlyRoofsLayer) {
    ctx.clearRect(fillX0, fillY0, fillW, fillH);
    const roofLevelIds = new Set(
      doc.levels.filter((lv) => lv.kind === "roof").map((lv) => lv.id),
    );
    roofLevelIds.add("lvl-roofs");
    for (const layer of doc.layers) {
      if (!roofLevelIds.has(layer.levelId) && layer.kind !== "roofs") continue;
      for (const roof of layer.roofs ?? []) {
        drawRoofStructure(ctx, roof, ppc, layer.opacity, assetLookup, vp, interactive);
      }
      if (roofLevelIds.has(layer.levelId) && layer.objects && layer.objects.length > 0) {
        const sorted = getSortedObjects(layer.objects);
        for (const obj of sorted) {
          const pad = Math.max(obj.widthCells, obj.heightCells) * 0.8 + 0.5;
          if (!isRectVisible(obj.x - pad, obj.y - pad, obj.x + pad, obj.y + pad, vp)) continue;
          drawObjectStamp(ctx, obj, ppc, layer.opacity, assetLookup, Boolean(vp), interactive);
        }
      }
    }
    ctx.restore();
    return;
  }

  // 1. Base seamless terrain (switches to deep subterranean bedrock for Underground, or transparent for Isolated Upper/Roof/Sky overlays!)
  const targetLevelId = opts.isolatedLevelId ?? doc.activeLevelId;
  const activeLevel = doc.levels.find((lv) => lv.id === targetLevelId);
  const isTransparentIsolated =
    Boolean(opts.isolatedLevelId) &&
    activeLevel !== undefined &&
    activeLevel.kind !== "ground" &&
    activeLevel.kind !== "underground";

  if (isTransparentIsolated) {
    ctx.clearRect(fillX0, fillY0, fillW, fillH);
  } else if (activeLevel?.kind === "underground") {
    ctx.fillStyle = "#090D14";
    ctx.fillRect(fillX0, fillY0, fillW, fillH);
    const stoneUrl = resolveAssetUrl("terrain/alpine_slate_rock.png", assetLookup);
    const stoneImg = texturePool.get(stoneUrl);
    if (stoneImg) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      drawTerrainBase(ctx, fullW, fullH, ppc, stoneImg, stoneUrl, clipPx);
      ctx.restore();
    }
  } else {
    const baseUrl = resolveAssetUrl(doc.canvas.baseTerrainAssetId, assetLookup);
    drawTerrainBase(ctx, fullW, fullH, ppc, texturePool.get(baseUrl), baseUrl, clipPx);
  }

  // 2. Partition visible layers by elevation band (bottom-to-top) so each floor's lighting
  //    is computed strictly within its own elevation — 1F room lights NEVER bleed onto 2F or ROOF,
  //    and interior walls below a roof NEVER cast shadows across the roof tiles above!
  const levelById = new Map(doc.levels.map((lv) => [lv.id, lv]));
  const skyLevelIds = new Set(
    doc.levels.filter((lv) => lv.kind === "sky").map((lv) => lv.id),
  );
  const levelRank = (lvlId: string) => {
    const lv = levelById.get(lvlId);
    if (!lv) return 1000;
    const kindOrd =
      lv.kind === "underground"
        ? 0
        : lv.kind === "ground"
          ? 1
          : lv.kind === "upper"
            ? 2
            : lv.kind === "roof"
              ? 3
              : 4;
    return kindOrd * 10000 + lv.elevationFt;
  };

  const visibleLayers = doc.layers.filter((layer) => {
    if (opts.isolatedLevelId) {
      if (layer.levelId !== opts.isolatedLevelId) return false;
    } else if (!layer.visible) {
      return false;
    }
    if (layer.dmOnly && !opts.dmView) return false;
    return true;
  });

  const bandOrder: string[] = [];
  const bandLayersMap = new Map<string, MapLayer[]>();
  for (const layer of visibleLayers) {
    if (!bandLayersMap.has(layer.levelId)) {
      bandLayersMap.set(layer.levelId, []);
      bandOrder.push(layer.levelId);
    }
    bandLayersMap.get(layer.levelId)!.push(layer);
  }
  bandOrder.sort((a, b) => levelRank(a) - levelRank(b));

  let drewSkyAltitudeVeil = false;
  let renderedBaseLighting = false;

  for (let bIdx = 0; bIdx < bandOrder.length; bIdx++) {
    const bandLvlId = bandOrder[bIdx];
    const bandLv = levelById.get(bandLvlId);
    const bandLayers = bandLayersMap.get(bandLvlId) ?? [];
    const isSkyLayer = skyLevelIds.has(bandLvlId);
    const isBaseBand =
      !isTransparentIsolated &&
      (bandLv?.kind === "ground" || bandLv?.kind === "underground" || bIdx === 0);

    // Paint subtle atmospheric altitude veil onto outCtx right before the first stacked Sky band
    if (isSkyLayer && !drewSkyAltitudeVeil && !isTransparentIsolated) {
      drewSkyAltitudeVeil = true;
      outCtx.save();
      outCtx.fillStyle = "rgba(8, 16, 34, 0.30)";
      outCtx.fillRect(fillX0, fillY0, fillW, fillH);
      const mistGrad = outCtx.createLinearGradient(0, 0, fullW, fullH);
      mistGrad.addColorStop(0, "rgba(186, 230, 253, 0.06)");
      mistGrad.addColorStop(0.45, "rgba(14, 165, 233, 0.02)");
      mistGrad.addColorStop(0.75, "rgba(224, 242, 254, 0.07)");
      mistGrad.addColorStop(1, "rgba(12, 20, 40, 0.03)");
      outCtx.fillStyle = mistGrad;
      outCtx.fillRect(fillX0, fillY0, fillW, fillH);
      outCtx.restore();
    }

    // Cast soft floating hull drop shadows onto the roofs/deck below before drawing the Sky band
    if (isSkyLayer && !isTransparentIsolated) {
      for (const lyr of bandLayers) {
        if (lyr.kind === "terrain" && (lyr.terrainStrokes?.length ?? 0) > 0) {
          const isTopOverlayDeck = lyr.levelId === "lvl-sky-upper";
          const visiblePolys = (lyr.terrainStrokes ?? []).filter(
            (s) => s.shape === "polygon" && s.points.length >= 3 && isPointBoxVisible(s.points, vp, 2.5),
          );
          if (visiblePolys.length === 0) continue;
          outCtx.save();
          outCtx.translate(
            ppc * (isTopOverlayDeck ? 0.35 : 1.15),
            ppc * (isTopOverlayDeck ? 0.45 : 1.55),
          );
          outCtx.fillStyle = isTopOverlayDeck ? "rgba(4, 7, 15, 0.44)" : "rgba(2, 5, 14, 0.52)";
          if (!interactive) {
            outCtx.filter = `blur(${Math.min(12, Math.max(3, Math.round(ppc * (isTopOverlayDeck ? 0.14 : 0.28))))}px)`;
          }
          outCtx.beginPath();
          for (const s of visiblePolys) {
            s.points.forEach((p, idx) =>
              idx === 0 ? outCtx.moveTo(p.x * ppc, p.y * ppc) : outCtx.lineTo(p.x * ppc, p.y * ppc),
            );
            outCtx.closePath();
          }
          outCtx.fill();
          outCtx.filter = "none";
          outCtx.restore();
        }
      }
    }

    const useOffscreenBand = !isTransparentIsolated && !isBaseBand;
    const bandBufs = useOffscreenBand ? ensureBandBuffers(bandW, bandH) : null;
    if (bandBufs) {
      bandBufs.bandCtx.setTransform(1, 0, 0, 1, 0, 0);
      bandBufs.bandCtx.clearRect(0, 0, bandW, bandH);
      if (opts.cropRectPx) {
        bandBufs.bandCtx.translate(-cropOffX, -cropOffY);
      }
      ctx = bandBufs.bandCtx;
    } else {
      ctx = outCtx;
    }

    const allWalls: WallSegment[] = [];
    const allPortals: PortalNode[] = [];
    const allLights: LightNode[] = [];
    let seenWaterInBand = false;

    for (const layer of bandLayers) {
      ctx.save();
      ctx.globalCompositeOperation = mapBlendMode(layer.blendMode);

      if (layer.kind === "terrain") {
        // Elevated piers, docks, bridges & floating ship decks drawn above a water layer cast
        // a crisp dark elevation shadow onto the water surface beneath them!
        if (seenWaterInBand && (layer.terrainStrokes?.length ?? 0) > 0) {
          const elevatedPolys = (layer.terrainStrokes ?? []).filter(
            (s) =>
              s.shape === "polygon" &&
              s.points.length >= 3 &&
              s.softness < 0.08 &&
              isPointBoxVisible(s.points, vp, 1.5),
          );
          if (elevatedPolys.length > 0) {
            ctx.save();
            ctx.translate(ppc * 0.14, ppc * 0.28);
            ctx.fillStyle = "rgba(3, 9, 18, 0.56)";
            if (!interactive) {
              ctx.filter = `blur(${Math.min(10, Math.max(3, Math.round(ppc * 0.16)))}px)`;
            }
            ctx.beginPath();
            for (const s of elevatedPolys) {
              s.points.forEach((p, idx) =>
                idx === 0 ? ctx.moveTo(p.x * ppc, p.y * ppc) : ctx.lineTo(p.x * ppc, p.y * ppc),
              );
              ctx.closePath();
            }
            ctx.fill();
            ctx.filter = "none";
            ctx.restore();
          }
        }
        drawTerrainLayer(ctx, layer, ppc, assetLookup, tileCache, fullW, fullH, clipPx, interactive);
    } else if (layer.kind === "caves" && layer.caveSystem) {
      const sys = layer.caveSystem;
      if (sys.operations.length > 0 || sys.undergroundFill) {
        const geom = computeCaveGeometry(
          sys,
          doc.canvas.widthCells,
          doc.canvas.heightCells,
          layer.id,
        );
        const floorPortals = doc.layers
          .filter((l) => l.visible && l.levelId === layer.levelId)
          .flatMap((l) => l.portals ?? []);

        const floorUrl = resolveAssetUrl(sys.floorAssetId, assetLookup);
        const rawFloorImg = texturePool.get(floorUrl);
        const floorImg = rawFloorImg
          ? getProcessedTexture(rawFloorImg, floorUrl, sys.floorRecolor, assetLookup.get(sys.floorAssetId))
          : null;
        const floorRawTilePx = Math.max(32, ppc * 2.8);
        const floorTileSz = getQuantizedTileSize(floorRawTilePx);
        const floorTile = floorImg
          ? getOrCreateTerrainTileCanvas(
              floorImg,
              `caveFloor|${getRecolorCacheKey(floorUrl, sys.floorRecolor, assetLookup.get(sys.floorAssetId))}`,
              floorTileSz,
              "#1E1B18",
            )
          : null;
        const makeCavePattern = (
          targetCtx: CanvasRenderingContext2D,
          tile: HTMLCanvasElement | null,
          rawPx: number,
          sz: number,
        ): CanvasPattern | null => {
          if (!tile) return null;
          const pat = targetCtx.createPattern(tile, "repeat");
          if (pat && typeof DOMMatrix !== "undefined" && typeof pat.setTransform === "function") {
            const ratio = rawPx / sz;
            if (Math.abs(ratio - 1) > 0.004) {
              pat.setTransform(new DOMMatrix().scale(ratio, ratio));
            }
          }
          return pat;
        };

        const wallUrl = resolveAssetUrl(sys.wallAssetId, assetLookup);
        const rawWallImg = texturePool.get(wallUrl);
        const wallImg = rawWallImg
          ? getProcessedTexture(rawWallImg, wallUrl, sys.wallRecolor, assetLookup.get(sys.wallAssetId))
          : null;

        // 1. Optional Underground Solid Rock / Void Fill outside carved chambers
        if (sys.undergroundFill) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          ctx.beginPath();
          ctx.rect(fillX0, fillY0, fillW, fillH);
          for (const loop of geom.floorLoops) {
            if (loop.length < 3) continue;
            loop.forEach((p, idx) =>
              idx === 0 ? ctx.moveTo(p.x * ppc, p.y * ppc) : ctx.lineTo(p.x * ppc, p.y * ppc),
            );
            ctx.closePath();
          }
          // Cut open entrance fade aprons even in underground fill mode
          for (const apron of geom.fadeAprons) {
            apron.polygon.forEach((p, idx) =>
              idx === 0 ? ctx.moveTo(p.x * ppc, p.y * ppc) : ctx.lineTo(p.x * ppc, p.y * ppc),
            );
            ctx.closePath();
          }
          ctx.fillStyle = sys.undergroundColorHex || "#0B0E14";
          ctx.fill("evenodd");

          // Subtle subterranean cross-grain rock texture over the underground void
          const bgRockUrl = resolveAssetUrl("terrain/alpine_slate_rock.png", assetLookup);
          const bgRockImg = texturePool.get(bgRockUrl);
          if (bgRockImg) {
            ctx.clip("evenodd");
            const bgRawPx = Math.max(32, ppc * 3.2);
            const bgSz = getQuantizedTileSize(bgRawPx);
            const bgTile = getOrCreateTerrainTileCanvas(bgRockImg, `caveBg|${bgRockUrl}`, bgSz, "#1E1B18");
            const pat = makeCavePattern(ctx, bgTile, bgRawPx, bgSz);
            if (pat) {
              ctx.globalAlpha = 0.16 * layer.opacity;
              ctx.fillStyle = pat;
              ctx.fillRect(fillX0, fillY0, fillW, fillH);
            }
          }
          ctx.restore();
        }

        // 2. Outdoor Rock Rim & Drop Shadow (when painted onto normal outdoor terrain)
        if (!sys.undergroundFill && sys.outerRimCells > 0.05 && geom.wallSegments.length > 0) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          // Soft outer ambient shadow
          ctx.strokeStyle = "rgba(8, 10, 16, 0.45)";
          ctx.lineWidth = (sys.wallThicknessCells * 1.9 + sys.outerRimCells * 2.4) * ppc;
          ctx.beginPath();
          for (const w of geom.wallSegments) {
            if (w.points.length < 2) continue;
            if (!isPointBoxVisible(w.points, vp, sys.wallThicknessCells + sys.outerRimCells + 1)) continue;
            w.points.forEach((p, idx) =>
              idx === 0 ? ctx.moveTo(p.x * ppc, p.y * ppc) : ctx.lineTo(p.x * ppc, p.y * ppc),
            );
            if (w.closed) ctx.closePath();
          }
          ctx.stroke();

          // Tinted outer rock bevel lip
          ctx.strokeStyle = sys.outerRimColorHex || "#3C414A";
          ctx.lineWidth = (sys.wallThicknessCells * 1.65 + sys.outerRimCells * 1.5) * ppc;
          ctx.stroke();
          ctx.restore();
        }

        // 3. Carved Chamber Floor (evenodd fill preserves interior rock pillars as holes!)
        if (geom.floorLoops.length > 0) {
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          ctx.beginPath();
          for (const loop of geom.floorLoops) {
            if (loop.length < 3) continue;
            loop.forEach((p, idx) =>
              idx === 0 ? ctx.moveTo(p.x * ppc, p.y * ppc) : ctx.lineTo(p.x * ppc, p.y * ppc),
            );
            ctx.closePath();
          }
          ctx.clip("evenodd");
          const floorPat = makeCavePattern(ctx, floorTile, floorRawTilePx, floorTileSz);
          ctx.fillStyle = floorPat ?? "#3B3F46";
          ctx.fillRect(fillX0, fillY0, fillW, fillH);

          // Inner cave-wall ambient occlusion rim shadow for instant recessed 3D depth
          ctx.strokeStyle = "rgba(7, 10, 16, 0.46)";
          ctx.lineWidth = Math.max(6, sys.wallThicknessCells * ppc * 1.55);
          ctx.lineJoin = "round";
          ctx.beginPath();
          for (const w of geom.wallSegments) {
            if (w.points.length < 2) continue;
            if (!isPointBoxVisible(w.points, vp, sys.wallThicknessCells + 1)) continue;
            w.points.forEach((p, idx) =>
              idx === 0 ? ctx.moveTo(p.x * ppc, p.y * ppc) : ctx.lineTo(p.x * ppc, p.y * ppc),
            );
            if (w.closed) ctx.closePath();
          }
          ctx.stroke();
          ctx.restore();
        }

        // 4. Feathered Entrance / Exit Fade-to-Normal-Terrain Aprons (2-axis soft fade: outward + lateral!)
        for (const ent of sys.entrances) {
          const apron = geom.fadeAprons.find((a) => a.entranceId === ent.id);
          if (!apron) continue;
          if (!isPointBoxVisible(apron.polygon, vp, 1.0)) continue;
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const p of apron.polygon) {
            minX = Math.min(minX, p.x * ppc);
            minY = Math.min(minY, p.y * ppc);
            maxX = Math.max(maxX, p.x * ppc);
            maxY = Math.max(maxY, p.y * ppc);
          }
          const pad = Math.max(10, ppc * 0.55);
          const bx = Math.floor(minX - pad);
          const by = Math.floor(minY - pad);
          const bw = Math.min(2048, Math.max(16, Math.ceil(maxX - minX + pad * 2)));
          const bh = Math.min(2048, Math.max(16, Math.ceil(maxY - minY + pad * 2)));
          if (typeof document !== "undefined") {
            if (!_caveApronCanvas) _caveApronCanvas = document.createElement("canvas");
            if (_caveApronCanvas.width < bw || _caveApronCanvas.height < bh) {
              _caveApronCanvas.width = Math.max(_caveApronCanvas.width, bw);
              _caveApronCanvas.height = Math.max(_caveApronCanvas.height, bh);
            }
            const tctx = _caveApronCanvas.getContext("2d");
            if (tctx) {
              // Step A: draw tiled cave floor aligned identically to world coordinates
              tctx.save();
              tctx.setTransform(1, 0, 0, 1, 0, 0);
              tctx.globalCompositeOperation = "source-over";
              tctx.clearRect(0, 0, bw, bh);
              tctx.translate(-bx, -by);
              const apronPat = makeCavePattern(tctx, floorTile, floorRawTilePx, floorTileSz);
              tctx.fillStyle = apronPat ?? "#3B3F46";
              tctx.fillRect(bx, by, bw, bh);

              // Step B1: outward linear fade from cave mouth into normal outdoor terrain
              tctx.globalCompositeOperation = "destination-in";
              const outGrad = tctx.createLinearGradient(
                apron.gradStart.x * ppc,
                apron.gradStart.y * ppc,
                apron.gradEnd.x * ppc,
                apron.gradEnd.y * ppc,
              );
              outGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
              outGrad.addColorStop(0.25, "rgba(0, 0, 0, 0.86)");
              outGrad.addColorStop(0.62, "rgba(0, 0, 0, 0.34)");
              outGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
              tctx.fillStyle = outGrad;
              tctx.fillRect(bx, by, bw, bh);

              // Step B2: soft lateral side-edge feather so left & right apron flanks melt organically too!
              const halfLat = Math.max(14, ent.widthCells * ppc * 0.68);
              const tx = -Math.sin(ent.normalRad);
              const ty = Math.cos(ent.normalRad);
              const ex = ent.x * ppc;
              const ey = ent.y * ppc;
              const latGrad = tctx.createLinearGradient(
                ex - tx * halfLat,
                ey - ty * halfLat,
                ex + tx * halfLat,
                ey + ty * halfLat,
              );
              latGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
              latGrad.addColorStop(0.22, "rgba(0, 0, 0, 0.92)");
              latGrad.addColorStop(0.5, "rgba(0, 0, 0, 1)");
              latGrad.addColorStop(0.78, "rgba(0, 0, 0, 0.92)");
              latGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
              tctx.fillStyle = latGrad;
              tctx.fillRect(bx, by, bw, bh);
              tctx.restore();

              ctx.save();
              ctx.globalAlpha = layer.opacity;
              ctx.drawImage(_caveApronCanvas, 0, 0, bw, bh, bx, by, bw, bh);
              ctx.restore();
            }
          }
        }

        // 5. Auto-Generated Cave & Dungeon Perimeter Walls (with portal cutouts & 2D shadow occlusion!)
        for (const cw of geom.wallSegments) {
          allWalls.push(cw);
          if (!isPointBoxVisible(cw.points, vp, cw.thicknessCells + 1.2)) continue;
          const carved = cutWallSegmentsForPortals(cw, floorPortals);
          ctx.save();
          ctx.globalAlpha = layer.opacity;
          if (carved.length > 0) {
            ctx.save();
            ctx.translate(Math.max(2, ppc * 0.08), Math.max(3, ppc * 0.12));
            ctx.strokeStyle = "rgba(5, 8, 15, 0.56)";
            ctx.lineWidth = cw.thicknessCells * ppc * 1.95;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            for (const [sa, sb] of carved) {
              ctx.moveTo(sa.x * ppc, sa.y * ppc);
              ctx.lineTo(sb.x * ppc, sb.y * ppc);
            }
            ctx.stroke();
            ctx.restore();
          }
          for (const [sa, sb] of carved) {
            drawTexturedStrip(
              ctx,
              wallImg,
              [sa, sb],
              cw.thicknessCells * ppc * 2.1,
              ppc,
              false,
              false,
              "#4B5563",
              false,
              false,
              clipPx,
            );
          }
          ctx.restore();
        }

        // 6. Entrance Threshold Caps (Rock Mouth / Stone Arch) & Optional Entrance Markers
        for (const ent of sys.entrances) {
          const ex = ent.x * ppc;
          const ey = ent.y * ppc;
          const hw = (ent.widthCells * ppc) * 0.5;
          const pillarR = Math.max(5, sys.wallThicknessCells * ppc * 0.65);

          ctx.save();
          ctx.translate(ex, ey);
          ctx.rotate(ent.normalRad);

          if (ent.thresholdStyle === "rock_mouth") {
            // Subtle cave mouth overhang shadow + twin rugged hand-inked rock buttress jambs
            const sh = ctx.createLinearGradient(-ppc * 0.6, 0, ppc * 0.55, 0);
            sh.addColorStop(0, "rgba(8, 10, 16, 0.42)");
            sh.addColorStop(0.55, "rgba(8, 10, 16, 0.16)");
            sh.addColorStop(1, "rgba(8, 10, 16, 0)");
            ctx.fillStyle = sh;
            ctx.fillRect(-ppc * 0.6, -hw, ppc * 1.15, hw * 2);

            for (const side of [-1, 1]) {
              const py = side * hw;
              ctx.fillStyle = sys.outerRimColorHex || "#4B525E";
              ctx.strokeStyle = "#181310";
              ctx.lineWidth = Math.max(1.5, ppc * 0.05);
              ctx.beginPath();
              ctx.ellipse(0, py, pillarR * 1.15, pillarR * 0.9, side * 0.25, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
              ctx.beginPath();
              ctx.ellipse(-pillarR * 0.2, py - pillarR * 0.2, pillarR * 0.45, pillarR * 0.35, 0, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (ent.thresholdStyle === "stone_arch") {
            // Crisp beveled dungeon stone arch lintel & twin masonry jamb piers
            ctx.fillStyle = "rgba(10, 12, 18, 0.32)";
            ctx.fillRect(-pillarR * 0.9, -hw, pillarR * 1.8, hw * 2);
            ctx.strokeStyle = "rgba(148, 163, 184, 0.48)";
            ctx.lineWidth = Math.max(1.4, ppc * 0.05);
            ctx.setLineDash([Math.max(4, ppc * 0.16), Math.max(3, ppc * 0.12)]);
            ctx.beginPath();
            ctx.moveTo(0, -hw);
            ctx.lineTo(0, hw);
            ctx.stroke();
            ctx.setLineDash([]);

            for (const side of [-1, 1]) {
              const py = side * hw;
              ctx.fillStyle = "#6B7280";
              ctx.strokeStyle = "#181310";
              ctx.lineWidth = Math.max(1.6, ppc * 0.05);
              ctx.fillRect(-pillarR * 0.85, py - pillarR * 0.75, pillarR * 1.7, pillarR * 1.5);
              ctx.strokeRect(-pillarR * 0.85, py - pillarR * 0.75, pillarR * 1.7, pillarR * 1.5);
            }
          }

          // Directional Entrance / Exit Arrow + Label Badge
          if (ent.showMarker && (!ent.markerDmOnly || opts.dmView)) {
            const isSel = opts.selectedId === ent.id;
            const arrowDist = Math.max(18, Math.min(ent.fadeLengthCells * 0.55, 1.35) * ppc);
            ctx.strokeStyle = isSel ? "#FDE68A" : "#E5A93C";
            ctx.lineWidth = Math.max(1.8, ppc * 0.06);
            ctx.beginPath();
            ctx.moveTo(-ppc * 0.18, 0);
            ctx.lineTo(arrowDist, 0);
            ctx.moveTo(arrowDist - ppc * 0.24, -ppc * 0.2);
            ctx.lineTo(arrowDist, 0);
            ctx.lineTo(arrowDist - ppc * 0.24, ppc * 0.2);
            ctx.stroke();
          }
          ctx.restore();

          if (ent.showMarker && (!ent.markerDmOnly || opts.dmView) && ent.markerLabel.trim()) {
            const isSel = opts.selectedId === ent.id;
            const labelDist = Math.max(24, Math.min(ent.fadeLengthCells * 0.65, 1.75) * ppc);
            const lx = ex + Math.cos(ent.normalRad) * labelDist;
            const ly = ey + Math.sin(ent.normalRad) * labelDist;
            const fontPx = Math.max(10.5, Math.min(14, ppc * 0.36));
            ctx.save();
            ctx.font = `700 ${fontPx}px Inter, system-ui, sans-serif`;
            const text = ent.markerLabel.toUpperCase();
            const tw = ctx.measureText(text).width + 14;
            const th = fontPx + 8;
            ctx.fillStyle = "rgba(13, 16, 24, 0.88)";
            ctx.strokeStyle = isSel ? "#FDE68A" : ent.markerDmOnly ? "#A78BFA" : "#E5A93C";
            ctx.lineWidth = isSel ? 2 : 1.2;
            ctx.beginPath();
            ctx.roundRect(lx - tw / 2, ly - th / 2, tw, th, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = isSel ? "#FEF08A" : ent.markerDmOnly ? "#DDD6FE" : "#F3F4F6";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, lx, ly + 0.5);
            ctx.restore();
          }
        }
      }
    } else if (layer.kind === "water") {
      seenWaterInBand = true;
      drawWaterLayer(
        ctx,
        layer,
        ppc,
        assetLookup,
        opts.selectedId,
        doc.canvas.widthCells,
        doc.canvas.heightCells,
        clipPx,
        interactive,
      );
    } else if (layer.kind === "paths") {
      for (const path of layer.paths ?? []) {
        if (!isPointBoxVisible(path.points, vp, path.widthCells + 1.5)) continue;
        const sampled = getCachedSampledPath(path);
        const pathUrl = resolveAssetUrl(path.assetId, assetLookup);
        const rawImg = texturePool.get(pathUrl);
        const processed = rawImg
          ? getProcessedTexture(rawImg, pathUrl, path.recolor, assetLookup.get(path.assetId))
          : null;
        const aidLow = path.assetId.toLowerCase();
        const isOrganicGroundPath =
          aidLow.includes("dirt_") ||
          aidLow.includes("gravel") ||
          aidLow.includes("wagon_rut") ||
          aidLow.includes("brook") ||
          aidLow.includes("rapids");
        const isStructuralPath =
          aidLow.includes("pier") ||
          aidLow.includes("dock") ||
          aidLow.includes("bridge") ||
          aidLow.includes("gangplank") ||
          aidLow.includes("stairs") ||
          aidLow.includes("seawall") ||
          aidLow.includes("quay") ||
          aidLow.includes("rope") ||
          aidLow.includes("chain") ||
          aidLow.includes("fence") ||
          aidLow.includes("rail") ||
          aidLow.includes("track") ||
          aidLow.includes("keel");
        const img =
          processed && isOrganicGroundPath
            ? getSideFeatheredStrip(processed, `${pathUrl}|${getRecolorCacheKey(pathUrl, path.recolor, assetLookup.get(path.assetId))}`)
            : processed;

        ctx.save();
        ctx.globalAlpha = path.opacity * layer.opacity;
        if (isStructuralPath && !interactive) {
          ctx.shadowColor = "rgba(4, 8, 16, 0.48)";
          ctx.shadowBlur = Math.min(8, Math.max(2, ppc * 0.08));
          ctx.shadowOffsetX = Math.min(5, ppc * 0.05);
          ctx.shadowOffsetY = Math.min(7, ppc * 0.08);
        }
        drawTexturedStrip(
          ctx,
          img,
          sampled,
          path.widthCells * ppc,
          ppc,
          false,
          path.taperEnds,
          "#94A3B8",
          Boolean(path.flipSide),
          Boolean(path.fadeEnds),
          clipPx,
        );
        ctx.restore();
      }
    } else if (layer.kind === "roofs") {
      for (const roof of layer.roofs ?? []) {
        drawRoofStructure(ctx, roof, ppc, layer.opacity, assetLookup, vp, interactive);
      }
    } else if (layer.kind === "walls") {
      const layerPortals = layer.portals ?? [];
      for (const wall of layer.walls ?? []) {
        allWalls.push(wall);
        if (!isPointBoxVisible(wall.points, vp, wall.thicknessCells + 1.2)) continue;
        const carvedSegments = cutWallSegmentsForPortals(wall, layerPortals);
        const wallUrl = resolveAssetUrl(wall.assetId, assetLookup);
        const rawWallImg = texturePool.get(wallUrl);
        const img = rawWallImg
          ? getProcessedTexture(rawWallImg, wallUrl, wall.recolor, assetLookup.get(wall.assetId))
          : null;
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        // Fast single-pass vector contact drop shadow under carved wall runs
        if (carvedSegments.length > 0) {
          ctx.save();
          ctx.translate(Math.max(2, ppc * 0.08), Math.max(3, ppc * 0.12));
          ctx.strokeStyle = "rgba(5, 8, 15, 0.52)";
          ctx.lineWidth = wall.thicknessCells * ppc * 1.9;
          ctx.lineCap = "butt";
          ctx.lineJoin = "miter";
          ctx.beginPath();
          for (const [sa, sb] of carvedSegments) {
            ctx.moveTo(sa.x * ppc, sa.y * ppc);
            ctx.lineTo(sb.x * ppc, sb.y * ppc);
          }
          ctx.stroke();
          ctx.restore();
        }
        // Draw each carved masonry run cleanly around portal cutouts
        for (const [sa, sb] of carvedSegments) {
          drawTexturedStrip(
            ctx,
            img,
            [sa, sb],
            wall.thicknessCells * ppc * 2.1,
            ppc,
            false,
            false,
            "#475569",
            false,
            false,
            clipPx,
          );
        }
        ctx.restore();
      }
      for (const portal of layerPortals) {
        allPortals.push(portal);
        const portalPad = portal.widthCells + 1.2;
        if (!isRectVisible(portal.x - portalPad, portal.y - portalPad, portal.x + portalPad, portal.y + portalPad, vp)) {
          continue;
        }
        const portalUrl = resolveAssetUrl(portal.assetId, assetLookup);
        const rawPortalImg = texturePool.get(portalUrl);
        const img = rawPortalImg
          ? getProcessedTexture(rawPortalImg, portalUrl, portal.recolor, assetLookup.get(portal.assetId))
          : null;
        const pw = portal.widthCells * ppc;
        const wallThickPx = Math.max(10, ppc * 0.44);
        const ph = Math.max(wallThickPx * 1.35, pw * 0.44);
        const jambW = Math.max(3, ppc * 0.13);

        ctx.save();
        ctx.translate(portal.x * ppc, portal.y * ppc);
        ctx.rotate(portal.rotationRad);
        ctx.globalAlpha = layer.opacity;

        // 1. Recessed wall threshold / window sill pocket seated inside carved masonry
        ctx.fillStyle =
          portal.kind === "window"
            ? "rgba(18, 28, 44, 0.72)"
            : "rgba(12, 14, 20, 0.45)";
        ctx.fillRect(-pw / 2, -wallThickPx * 0.55, pw, wallThickPx * 1.1);

        // 2. Crisp architectural masonry/brass wall-end jambs framing the inset opening
        ctx.fillStyle = portal.kind === "window" ? "#3A4458" : "#2D3342";
        ctx.strokeStyle = "#10131A";
        ctx.lineWidth = Math.max(1, ppc * 0.03);
        ctx.fillRect(-pw / 2 - jambW * 0.35, -wallThickPx * 0.72, jambW, wallThickPx * 1.44);
        ctx.strokeRect(-pw / 2 - jambW * 0.35, -wallThickPx * 0.72, jambW, wallThickPx * 1.44);
        ctx.fillRect(pw / 2 - jambW * 0.65, -wallThickPx * 0.72, jambW, wallThickPx * 1.44);
        ctx.strokeRect(pw / 2 - jambW * 0.65, -wallThickPx * 0.72, jambW, wallThickPx * 1.44);

        // 3. Draw door/gate leaf (sliding gates retract into jamb pockets; hinged doors swing open)
        if (!portal.closed && portal.kind === "gate") {
          const leafW = Math.max(4, (pw - jambW) * 0.2);
          ctx.save();
          if (img) {
            ctx.drawImage(img, -pw / 2 + jambW * 0.4, -ph * 0.36, leafW, ph * 0.72);
            ctx.drawImage(img, pw / 2 - jambW * 0.4 - leafW, -ph * 0.36, leafW, ph * 0.72);
          } else {
            ctx.fillStyle = "#38BDF8";
            ctx.fillRect(-pw / 2 + jambW * 0.4, -wallThickPx * 0.25, leafW, wallThickPx * 0.5);
            ctx.fillRect(pw / 2 - jambW * 0.4 - leafW, -wallThickPx * 0.25, leafW, wallThickPx * 0.5);
          }
          ctx.restore();
        } else if (!portal.closed && portal.kind !== "window") {
          // Subtle architectural swing arc + swung-open leaf on hinge
          // Respects swingInvert (Inward / Outward) and hingeFlip (Left / Right jamb)
          const sx = portal.hingeFlip ? -1 : 1;
          const sy = portal.swingInvert ? -1 : 1;
          ctx.save();
          ctx.scale(sx, sy);
          ctx.strokeStyle = "rgba(229, 169, 60, 0.34)";
          ctx.lineWidth = Math.max(1, ppc * 0.025);
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(-pw / 2 + jambW * 0.4, 0, pw - jambW, 0, Math.PI * 0.44);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.translate(-pw / 2 + jambW * 0.4, 0);
          ctx.rotate(Math.PI * 0.42);
          if (img) {
            ctx.drawImage(img, 0, -ph * 0.36, pw - jambW * 0.8, ph * 0.72);
          } else {
            ctx.fillStyle = "#9A5B2C";
            ctx.fillRect(0, -wallThickPx * 0.25, pw - jambW, wallThickPx * 0.5);
          }
          ctx.restore();
        } else if (img) {
          ctx.drawImage(img, -pw / 2, -ph / 2, pw, ph);
        } else {
          ctx.fillStyle = portal.kind === "window" ? "#56CCF2" : "#B45309";
          ctx.fillRect(-pw / 2, -wallThickPx * 0.35, pw, wallThickPx * 0.7);
        }

        if (opts.selectedId === portal.id) {
          ctx.strokeStyle = "#E5A93C";
          ctx.lineWidth = 2;
          ctx.strokeRect(-pw / 2 - 4, -ph / 2 - 4, pw + 8, ph + 8);
        }
        ctx.restore();
      }
    } else if (layer.kind === "scatter_zone") {
      for (const zone of layer.scatterZones ?? []) {
        if (!isPointBoxVisible(zone.polygon, vp, 4.5)) continue;
        for (const pl of zone.placements) {
          const meta = assetLookup.get(pl.assetId);
          const natW = meta
            ? Math.max(0.45, Math.min(4.2, meta.widthPx / Math.max(64, meta.defaultPpi)))
            : 1.5;
          const natH = meta
            ? Math.max(0.45, Math.min(4.2, meta.heightPx / Math.max(64, meta.defaultPpi)))
            : 1.5;
          const cullPad = Math.max(natW, natH) * pl.scale * 0.8 + 0.5;
          if (!isRectVisible(pl.x - cullPad, pl.y - cullPad, pl.x + cullPad, pl.y + cullPad, vp)) {
            continue;
          }
          const img = texturePool.get(resolveAssetUrl(pl.assetId, assetLookup));
          if (!img) continue;
          const drawW = natW * ppc * pl.scale;
          const drawH = natH * ppc * pl.scale;
          ctx.save();
          ctx.translate(pl.x * ppc, pl.y * ppc);
          ctx.rotate(pl.rotationRad);
          ctx.scale(pl.flipX ? -1 : 1, 1);
          ctx.globalAlpha = layer.opacity;
          if (!interactive && meta?.castsShadow !== false) {
            ctx.shadowColor = "rgba(8, 10, 16, 0.42)";
            ctx.shadowBlur = Math.min(7, Math.max(2, ppc * 0.09));
            ctx.shadowOffsetX = Math.min(5, ppc * 0.05);
            ctx.shadowOffsetY = Math.min(8, ppc * 0.08);
          }
          ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
          ctx.restore();
        }
        if (opts.showScatterOutlines && zone.polygon.length >= 3) {
          ctx.save();
          ctx.strokeStyle =
            opts.selectedId === zone.id ? "#E5A93C" : "rgba(139, 92, 246, 0.72)";
          ctx.lineWidth = opts.selectedId === zone.id ? 2.5 : 1.6;
          ctx.setLineDash([7, 5]);
          ctx.beginPath();
          zone.polygon.forEach((p, idx) =>
            idx === 0 ? ctx.moveTo(p.x * ppc, p.y * ppc) : ctx.lineTo(p.x * ppc, p.y * ppc),
          );
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }
    } else if (layer.kind === "objects") {
      const objects = layer.objects;
      if (objects && objects.length > 0) {
        const sorted = getSortedObjects(objects);
        for (let oi = 0; oi < sorted.length; oi++) {
          const obj = sorted[oi];
          if (vp) {
            const pad = Math.max(obj.widthCells, obj.heightCells) * 0.8 + 0.6;
            if (
              obj.x + pad < vp.minX ||
              obj.x - pad > vp.maxX ||
              obj.y + pad < vp.minY ||
              obj.y - pad > vp.maxY
            ) {
              continue;
            }
          }
          drawObjectStamp(
            ctx,
            obj,
            ppc,
            layer.opacity,
            assetLookup,
            Boolean(vp),
            interactive,
          );
        }
      }
    } else if (layer.kind === "lights") {
      for (const lt of layer.lights ?? []) {
        allLights.push(lt);
      }
    }

    ctx.restore();
    }

    // Apply per-elevation 2D wall-occluded raycast lighting strictly within this floor band!
    if (isTransparentIsolated) {
      if (doc.lighting.enabled && allLights.length > 0 && typeof document !== "undefined") {
        const bufs = ensureBandBuffers(outCtx.canvas.width, outCtx.canvas.height);
        if (bufs) {
          bufs.alphaCtx.setTransform(1, 0, 0, 1, 0, 0);
          bufs.alphaCtx.clearRect(0, 0, bufs.alphaCanvas.width, bufs.alphaCanvas.height);
          bufs.alphaCtx.drawImage(outCtx.canvas, 0, 0);
          drawLightingPass(
            outCtx,
            doc,
            fullW,
            fullH,
            ppc,
            allLights,
            allWalls,
            allPortals,
            opts.forceLightingPresetId,
            clipPx,
            vp,
          );
          outCtx.save();
          outCtx.setTransform(1, 0, 0, 1, 0, 0);
          outCtx.globalCompositeOperation = "destination-in";
          outCtx.drawImage(bufs.alphaCanvas, 0, 0);
          outCtx.restore();
        }
      }
    } else if (bandBufs) {
      if (doc.lighting.enabled) {
        bandBufs.alphaCtx.setTransform(1, 0, 0, 1, 0, 0);
        bandBufs.alphaCtx.clearRect(0, 0, bandW, bandH);
        bandBufs.alphaCtx.drawImage(bandBufs.bandCanvas, 0, 0);
        drawLightingPass(
          bandBufs.bandCtx,
          doc,
          fullW,
          fullH,
          ppc,
          allLights,
          allWalls,
          allPortals,
          opts.forceLightingPresetId,
          clipPx,
          vp,
        );
        bandBufs.bandCtx.save();
        bandBufs.bandCtx.setTransform(1, 0, 0, 1, 0, 0);
        bandBufs.bandCtx.globalCompositeOperation = "destination-in";
        bandBufs.bandCtx.drawImage(bandBufs.alphaCanvas, 0, 0);
        bandBufs.bandCtx.restore();
      }
      outCtx.drawImage(bandBufs.bandCanvas, cropOffX, cropOffY, bandW, bandH);
      if (doc.lighting.enabled && isSkyLayer && allLights.length > 0) {
        drawElevatedSpotlightBeams(outCtx, ppc, allLights, allWalls, allPortals, vp);
      }
    } else {
      drawLightingPass(
        outCtx,
        doc,
        fullW,
        fullH,
        ppc,
        allLights,
        allWalls,
        allPortals,
        opts.forceLightingPresetId,
        clipPx,
        vp,
      );
      renderedBaseLighting = true;
    }
  }

  ctx = outCtx;
  if (!isTransparentIsolated && !renderedBaseLighting) {
    drawLightingPass(ctx, doc, fullW, fullH, ppc, [], [], [], opts.forceLightingPresetId, clipPx, vp);
  }

  // 4. Crisp Grid Overlay (omitted on transparent isolated overlays so base floor's grid isn't doubled!)
  if (opts.showGrid !== false && !isTransparentIsolated) {
    drawGridOverlay(ctx, doc, ppc, vp);
  }

  // 4b. Onion-Skin Architectural Blueprint of Adjacent Floor (align stairs, hatches, manholes & load-bearing walls!)
  if (opts.showOnionSkin && activeLevel) {
    let refLevel = null;
    if (activeLevel.kind === "sky") {
      const skySorted = [...doc.levels]
        .filter((lv) => lv.kind === "sky")
        .sort((a, b) => a.elevationFt - b.elevationFt);
      const sIdx = skySorted.findIndex((lv) => lv.id === activeLevel.id);
      if (sIdx > 0) refLevel = skySorted[sIdx - 1];
      else if (sIdx >= 0 && sIdx + 1 < skySorted.length) refLevel = skySorted[sIdx + 1];
    } else {
      const nonRoof = [...doc.levels]
        .filter((lv) => lv.kind !== "roof" && lv.kind !== "sky")
        .sort((a, b) => a.elevationFt - b.elevationFt);
      const idx = nonRoof.findIndex((lv) => lv.id === activeLevel.id);
      // Underground looks UP at the floor above; Upper looks DOWN at the floor below; Ground peeks down at B1
      if (activeLevel.kind === "underground" && idx >= 0 && idx + 1 < nonRoof.length) {
        refLevel = nonRoof[idx + 1];
      } else if (activeLevel.kind === "upper" && idx > 0) {
        refLevel = nonRoof[idx - 1];
      } else if (activeLevel.kind === "ground" && idx > 0) {
        refLevel = nonRoof[idx - 1];
      }
    }

    if (refLevel) {
      const refLayers = doc.layers.filter((l) => l.levelId === refLevel!.id);
      ctx.save();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.42)";
      ctx.fillStyle = "rgba(56, 189, 248, 0.12)";
      ctx.lineWidth = Math.max(1.5, ppc * 0.06);
      ctx.setLineDash([6, 4]);

      for (const rl of refLayers) {
        for (const w of rl.walls ?? []) {
          const pts = w.curved && w.points.length >= 3 ? sampleCatmullRom(w.points, 8, w.closed) : w.points;
          if (pts.length < 2) continue;
          ctx.beginPath();
          pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * ppc, p.y * ppc) : ctx.lineTo(p.x * ppc, p.y * ppc)));
          if (w.closed) ctx.closePath();
          ctx.stroke();
        }
        for (const p of rl.portals ?? []) {
          ctx.save();
          ctx.translate(p.x * ppc, p.y * ppc);
          ctx.rotate(p.rotationRad);
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
          ctx.strokeRect((-p.widthCells * ppc) / 2, -ppc * 0.22, p.widthCells * ppc, ppc * 0.44);
          ctx.restore();
        }
        // Highlight stairs, companionways, ladders & hatches on the reference floor so vertical connections snap dead-on!
        for (const o of rl.objects ?? []) {
          if (
            o.assetId.includes("stair") ||
            o.assetId.includes("companionway") ||
            o.assetId.includes("ladder") ||
            o.assetId.includes("hatch") ||
            o.assetId.includes("trapdoor")
          ) {
            ctx.save();
            ctx.translate(o.x * ppc, o.y * ppc);
            ctx.rotate(o.rotationRad);
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = "rgba(52, 211, 153, 0.72)";
            ctx.fillStyle = "rgba(16, 185, 129, 0.16)";
            ctx.fillRect((-o.widthCells * ppc) / 2, (-o.heightCells * ppc) / 2, o.widthCells * ppc, o.heightCells * ppc);
            ctx.strokeRect((-o.widthCells * ppc) / 2, (-o.heightCells * ppc) / 2, o.widthCells * ppc, o.heightCells * ppc);
            ctx.restore();
          }
        }
      }
      ctx.restore();
    }
  }

  // 5. VTT & DM-Only Overlays (Interactive light badges & gizmos are rendered crisp in screen-space by MapCanvas)
  drawVttAndDmOverlays(ctx, doc, ppc, opts);

  ctx.restore();
}

export function collectAllDocAssetUrls(
  doc: DcMapDocument,
  assetLookup: Map<string, VaultAsset>,
): string[] {
  const ids = new Set<string>([
    doc.canvas.baseTerrainAssetId,
    "terrain/alpine_slate_rock.png",
    "terrain/under_city_abyss.png",
    "terrain/chasm_abyss_mist.png",
  ]);
  if (doc.mode === "world" && doc.world) {
    if (doc.world.theme.oceanTextureAssetId) ids.add(doc.world.theme.oceanTextureAssetId);
    if (doc.world.theme.landTextureAssetId) ids.add(doc.world.theme.landTextureAssetId);
    if (doc.world.biomeRasterB64) ids.add(doc.world.biomeRasterB64);
    if (doc.world.overlays.compass.assetId) ids.add(doc.world.overlays.compass.assetId);
    if (doc.world.overlays.traceOverlay?.visible && doc.world.overlays.traceOverlay.imageUrl) {
      ids.add(doc.world.overlays.traceOverlay.imageUrl);
    }
  }
  for (const layer of doc.layers) {
    layer.terrainStrokes?.forEach((s) => ids.add(s.assetId));
    if (layer.caveSystem) {
      ids.add(layer.caveSystem.floorAssetId);
      ids.add(layer.caveSystem.wallAssetId);
    }
    layer.waterRegions?.forEach((w) => {
      if (w.textureAssetId) ids.add(w.textureAssetId);
    });
    layer.paths?.forEach((p) => ids.add(p.assetId));
    layer.roofs?.forEach((r) => ids.add(r.assetId));
    layer.walls?.forEach((w) => ids.add(w.assetId));
    layer.portals?.forEach((p) => ids.add(p.assetId));
    layer.objects?.forEach((o) => ids.add(o.assetId));
    layer.scatterZones?.forEach((z) => z.assetIds.forEach((id) => ids.add(id)));
  }
  return Array.from(ids).map((id) => resolveAssetUrl(id, assetLookup));
}

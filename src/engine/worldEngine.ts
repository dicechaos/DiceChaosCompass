/**
 * Hybrid Wonderdraft-Parity World Atlas Engine for Dice Chaos Maps v1.5.
 *
 * Powers:
 * - Deterministic 2D fractal fBM noise & 7-preset Landmass Generator Wizard
 * - Roughness-driven Raise / Lower / Smooth coastline & Freshwater Lake brushes
 * - Land/water queries & land-clipped Biome ground color sampling (for Wonderdraft `sample_color` symbols)
 * - Source-to-mouth tapered meandering rivers
 * - Detail / Sub-Region map cropping (upsamples heightmap + transforms rivers/trails/regions/labels/symbols)
 * - Travel-time ruler calculations (Miles, Km, Leagues + Walk / Horse / Ship / Airship days)
 */

import { distanceToPolyline, pointInPolygon, sampleCatmullRom } from "@/engine/geometry";
import { getWorldThemeById } from "@/engine/worldThemes";
import type {
  DcMapDocument,
  Point2D,
  VaultAsset,
  WorldAssetGroup,
  WorldBiomeStroke,
  WorldCartographyOverlays,
  WorldLabel,
  WorldLandBrushMode,
  WorldLandmassPreset,
  WorldMapData,
  WorldRegion,
  WorldRiver,
  WorldTrail,
  WorldTravelMode,
} from "@/types/map";

export const DEFAULT_WORLD_GRID_W = 240;
export const DEFAULT_WORLD_GRID_H = 135;

// ---------------------------------------------------------------------------
// Base64 Uint8Array Serialization (Browser & Node compatible)
// ---------------------------------------------------------------------------

const B64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function encodeMaskB64(bytes: Uint8Array): string {
  if (typeof btoa === "function") {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + chunk)));
    }
    return btoa(binary);
  }
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64_CHARS[a >> 2];
    out += B64_CHARS[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64_CHARS[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bytes.length ? B64_CHARS[c & 63] : "=";
  }
  return out;
}

// Fast bounded LRU decoded-mask cache (prevents decoding 158KB base64 heightmaps hundreds of times/frame!)
const MASK_CACHE_MAX = 16;
const decodedMaskCache = new Map<string, Uint8Array>();

/**
 * Returns a cached read-only Uint8Array decoded from a base64 mask string (O(1) on repeat lookups!).
 * Callers that intend to mutate the array MUST copy it (or use `decodeMaskB64` which returns a fresh copy).
 */
export function decodeMaskB64Cached(b64: string | undefined, expectedLen: number): Uint8Array {
  if (!b64) return new Uint8Array(expectedLen);
  const key = `${expectedLen}:${b64}`;
  const hit = decodedMaskCache.get(key);
  if (hit) {
    // Refresh LRU order
    decodedMaskCache.delete(key);
    decodedMaskCache.set(key, hit);
    return hit;
  }

  let out: Uint8Array;
  try {
    if (typeof atob === "function") {
      const bin = atob(b64);
      out = new Uint8Array(expectedLen);
      const n = Math.min(bin.length, expectedLen);
      for (let i = 0; i < n; i++) out[i] = bin.charCodeAt(i);
    } else {
      const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
      out = new Uint8Array(expectedLen);
      let p = 0;
      for (let i = 0; i < clean.length && p < expectedLen; i += 4) {
        const c1 = B64_CHARS.indexOf(clean[i]);
        const c2 = B64_CHARS.indexOf(clean[i + 1] ?? "A");
        const c3 = i + 2 < clean.length ? B64_CHARS.indexOf(clean[i + 2]) : -1;
        const c4 = i + 3 < clean.length ? B64_CHARS.indexOf(clean[i + 3]) : -1;
        if (p < expectedLen) out[p++] = (c1 << 2) | (c2 >> 4);
        if (c3 >= 0 && p < expectedLen) out[p++] = ((c2 & 15) << 4) | (c3 >> 2);
        if (c4 >= 0 && p < expectedLen) out[p++] = ((c3 & 3) << 6) | c4;
      }
    }
  } catch {
    return new Uint8Array(expectedLen);
  }

  if (decodedMaskCache.size >= MASK_CACHE_MAX) {
    const oldest = decodedMaskCache.keys().next().value;
    if (oldest !== undefined) decodedMaskCache.delete(oldest);
  }
  decodedMaskCache.set(key, out);
  return out;
}

export function decodeMaskB64(b64: string | undefined, expectedLen: number): Uint8Array {
  if (!b64) return new Uint8Array(expectedLen);
  return new Uint8Array(decodeMaskB64Cached(b64, expectedLen));
}

// ---------------------------------------------------------------------------
// Fast Deterministic 2D Smooth Value Noise & Fractal fBM
// ---------------------------------------------------------------------------

function hash2i(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

export function valueNoise2D(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const v00 = hash2i(ix, iy, seed);
  const v10 = hash2i(ix + 1, iy, seed);
  const v01 = hash2i(ix, iy + 1, seed);
  const v11 = hash2i(ix + 1, iy + 1, seed);
  const a = v00 + (v10 - v00) * ux;
  const b = v01 + (v11 - v01) * ux;
  return a + (b - a) * uy;
}

export function fbm2D(
  x: number,
  y: number,
  seed: number,
  octaves = 5,
  persistence = 0.54,
): number {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise2D(x * freq, y * freq, seed + o * 1013) * amp;
    norm += amp;
    amp *= persistence;
    freq *= 2.04;
  }
  return norm > 0 ? sum / norm : 0.5;
}

// ---------------------------------------------------------------------------
// Landmass Generator Wizard (7 Wonderdraft-Style Presets)
// ---------------------------------------------------------------------------

export interface LandmassWizardOptions {
  preset: WorldLandmassPreset;
  seed: number;
  waterLevel?: number; // 0.25..0.75 (default 0.48)
  roughness?: number; // 0.2..0.95 (default 0.6)
  detail?: number; // 3..6 octaves (default 5)
  gridW?: number;
  gridH?: number;
}

export function generateLandmassHeightmap(opts: LandmassWizardOptions): {
  gridW: number;
  gridH: number;
  heightmap: Uint8Array;
  heightmapB64: string;
} {
  const gridW = opts.gridW ?? DEFAULT_WORLD_GRID_W;
  const gridH = opts.gridH ?? DEFAULT_WORLD_GRID_H;
  const waterLevel = Math.max(0.2, Math.min(0.8, opts.waterLevel ?? 0.48));
  const roughness = Math.max(0.15, Math.min(0.95, opts.roughness ?? 0.6));
  const octaves = Math.max(2, Math.min(6, Math.round(opts.detail ?? 5)));
  const seed = Math.floor(opts.seed) || 1337;
  const persistence = 0.38 + roughness * 0.34;
  const out = new Uint8Array(gridW * gridH);

  // Pre-seed macro blob centers for multi-continent / archipelago layouts
  const centers: Array<{ x: number; y: number; rx: number; ry: number; weight: number }> = [];
  if (opts.preset === "continents") {
    centers.push(
      { x: 0.27 + (hash2i(1, 2, seed) - 0.5) * 0.08, y: 0.48 + (hash2i(2, 3, seed) - 0.5) * 0.14, rx: 0.24, ry: 0.34, weight: 0.96 },
      { x: 0.72 + (hash2i(3, 4, seed) - 0.5) * 0.08, y: 0.46 + (hash2i(4, 5, seed) - 0.5) * 0.14, rx: 0.23, ry: 0.32, weight: 0.92 },
      { x: 0.52 + (hash2i(5, 6, seed) - 0.5) * 0.1, y: 0.77 + (hash2i(6, 7, seed) - 0.5) * 0.06, rx: 0.16, ry: 0.14, weight: 0.68 },
    );
  } else if (opts.preset === "archipelago") {
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2 + hash2i(i, 9, seed) * 0.6;
      const dist = 0.12 + hash2i(i, 17, seed) * 0.26;
      centers.push({
        x: 0.5 + Math.cos(ang) * dist * 1.15,
        y: 0.5 + Math.sin(ang) * dist * 0.9,
        rx: 0.075 + hash2i(i, 23, seed) * 0.095,
        ry: 0.075 + hash2i(i, 29, seed) * 0.095,
        weight: 0.74 + hash2i(i, 31, seed) * 0.28,
      });
    }
  } else if (opts.preset === "equirectangular") {
    centers.push(
      { x: 0.22, y: 0.38, rx: 0.17, ry: 0.24, weight: 0.9 },
      { x: 0.29, y: 0.72, rx: 0.12, ry: 0.2, weight: 0.85 },
      { x: 0.62, y: 0.36, rx: 0.24, ry: 0.24, weight: 0.95 },
      { x: 0.58, y: 0.68, rx: 0.15, ry: 0.21, weight: 0.86 },
      { x: 0.83, y: 0.71, rx: 0.1, ry: 0.12, weight: 0.78 },
    );
  }

  for (let y = 0; y < gridH; y++) {
    const ny = y / (gridH - 1);
    for (let x = 0; x < gridW; x++) {
      const nx = x / (gridW - 1);
      // Domain warp for authentic curved peninsulas & fjords!
      const warpX = (fbm2D(nx * 3.2 + 5.1, ny * 2.2 + 1.7, seed + 19, 3, 0.5) - 0.5) * (0.14 + roughness * 0.14);
      const warpY = (fbm2D(nx * 3.2 + 11.3, ny * 2.2 + 7.9, seed + 37, 3, 0.5) - 0.5) * (0.14 + roughness * 0.14);
      const wx = nx + warpX;
      const wy = ny + warpY;

      const baseNoise = fbm2D(wx * 5.2, wy * 3.4, seed, octaves, persistence);
      const fineNoise = fbm2D(nx * 13.5, ny * 8.5, seed + 991, 3, 0.55);

      let mask = 0;
      const dx = (nx - 0.5) * 2;
      const dy = (ny - 0.5) * 2;
      const rad = Math.hypot(dx * 0.92, dy * 1.02);

      if (opts.preset === "pangaea") {
        mask = Math.max(0, 1.08 - rad * 0.98);
      } else if (opts.preset === "atoll") {
        const ringDist = Math.abs(rad - 0.52);
        const lagoonBreak = nx > 0.58 && Math.abs(ny - 0.5) < 0.16 ? 0.22 : 0;
        mask = Math.max(0, 0.96 - ringDist * 2.55 - lagoonBreak);
      } else if (opts.preset === "inland_sea") {
        const outerFade = Math.max(0, 1.0 - Math.max(0, rad - 0.85) * 4.5);
        const innerSea = Math.max(0, 1.0 - rad * 2.05);
        mask = Math.max(0, 0.92 * outerFade - innerSea * 0.78);
      } else if (opts.preset === "highlands") {
        // Dramatic western/northern mountain continent tapering into eastern sea + islands
        const coastSlope = 1.05 - nx * 0.86 + (0.5 - ny) * 0.22;
        mask = Math.max(0, Math.min(1.05, coastSlope));
      } else {
        for (const c of centers) {
          const d = Math.hypot((wx - c.x) / c.rx, (wy - c.y) / c.ry);
          const contrib = Math.max(0, 1 - d * d * 0.88) * c.weight;
          if (contrib > mask) mask = contrib;
        }
      }

      // Soft border falloff so continents stay nicely framed inside ornamental map borders
      const edgeX = Math.min(nx, 1 - nx);
      const edgeY = Math.min(ny, 1 - ny);
      const edgeFade =
        opts.preset === "highlands"
          ? Math.min(1, edgeY / 0.07) * Math.min(1, (1 - nx) / 0.08)
          : Math.min(1, edgeX / 0.075) * Math.min(1, edgeY / 0.085);

      const combined =
        (mask * 0.66 + baseNoise * 0.54 + (fineNoise - 0.5) * roughness * 0.24) * edgeFade;
      // Map waterLevel -> exact 128 byte threshold!
      const shifted = 0.5 + (combined - waterLevel) * 1.15;
      out[y * gridW + x] = Math.max(0, Math.min(255, Math.round(shifted * 255)));
    }
  }

  return {
    gridW,
    gridH,
    heightmap: out,
    heightmapB64: encodeMaskB64(out),
  };
}

// ---------------------------------------------------------------------------
// Roughness-Driven Fractal Coastline & Freshwater Lake Brushes
// ---------------------------------------------------------------------------

export function sculptWorldHeightmap(
  world: WorldMapData,
  points: Point2D[],
  canvasW: number,
  canvasH: number,
  params: {
    mode: WorldLandBrushMode;
    radiusCells: number;
    roughness: number; // 0..1 (higher = craggier fractal coasts!)
    strength: number; // 0.1..1
    seed: number;
  },
): { heightmapB64: string; freshwaterB64?: string } {
  const { gridW, gridH } = world;
  const total = gridW * gridH;
  const hm = decodeMaskB64(world.heightmapB64, total);
  const fw = decodeMaskB64(world.freshwaterB64, total);

  if (points.length === 0) {
    return { heightmapB64: world.heightmapB64, freshwaterB64: world.freshwaterB64 };
  }

  // Densify stroke points so fast drags carve continuous fractal coasts
  const dense: Point2D[] = [points[0]];
  const stepCells = Math.max(0.25, params.radiusCells * 0.28);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(dist / stepCells));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      dense.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }

  const rxGrid = (params.radiusCells / Math.max(1, canvasW)) * gridW;
  const ryGrid = (params.radiusCells / Math.max(1, canvasH)) * gridH;
  const rMax = Math.max(1.5, Math.max(rxGrid, ryGrid));
  const rough = Math.max(0, Math.min(1, params.roughness));
  const str = Math.max(0.08, Math.min(1, params.strength));

  if (params.mode === "smooth") {
    const copy = hm.slice();
    for (const pt of dense) {
      const gx = (pt.x / canvasW) * (gridW - 1);
      const gy = (pt.y / canvasH) * (gridH - 1);
      const x0 = Math.max(1, Math.floor(gx - rMax));
      const x1 = Math.min(gridW - 2, Math.ceil(gx + rMax));
      const y0 = Math.max(1, Math.floor(gy - rMax));
      const y1 = Math.min(gridH - 2, Math.ceil(gy + rMax));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot((x - gx) / rxGrid, (y - gy) / ryGrid);
          if (d > 1) continue;
          const w = (1 - d * d) * 0.42 * str;
          const idx = y * gridW + x;
          const avg =
            (copy[idx - 1] + copy[idx + 1] + copy[idx - gridW] + copy[idx + gridW] + copy[idx] * 2) / 6;
          hm[idx] = Math.round(hm[idx] * (1 - w) + avg * w);
        }
      }
    }
    return { heightmapB64: encodeMaskB64(hm), freshwaterB64: world.freshwaterB64 };
  }

  const isLake = params.mode === "lake_carve" || params.mode === "lake_erase";
  const sign = params.mode === "raise" || params.mode === "lake_carve" ? 1 : -1;

  for (const pt of dense) {
    const gx = (pt.x / canvasW) * (gridW - 1);
    const gy = (pt.y / canvasH) * (gridH - 1);
    const pad = rMax * (1 + rough * 0.45);
    const x0 = Math.max(0, Math.floor(gx - pad));
    const x1 = Math.min(gridW - 1, Math.ceil(gx + pad));
    const y0 = Math.max(0, Math.floor(gy - pad));
    const y1 = Math.min(gridH - 1, Math.ceil(gy + pad));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dBase = Math.hypot((x - gx) / Math.max(0.8, rxGrid), (y - gy) / Math.max(0.8, ryGrid));
        // Roughness-driven organic fractal edge perturbation!
        const nVal =
          rough > 0.02
            ? fbm2D(x * 0.14, y * 0.14, params.seed + world.seed, 4, 0.56) - 0.5
            : 0;
        const dEff = dBase + nVal * rough * 0.95;
        if (dEff >= 1.0) continue;

        const falloff = (1 - dEff * dEff) ** 1.35;
        const idx = y * gridW + x;

        if (isLake) {
          // Only carve lakes inside existing land!
          if (sign > 0 && hm[idx] >= world.seaLevel) {
            fw[idx] = Math.min(255, Math.round(fw[idx] + falloff * 185 * str));
          } else if (sign < 0) {
            fw[idx] = Math.max(0, Math.round(fw[idx] - falloff * 210 * str));
          }
        } else {
          const delta = sign * falloff * 52 * str;
          hm[idx] = Math.max(0, Math.min(255, Math.round(hm[idx] + delta)));
          if (hm[idx] < world.seaLevel) {
            fw[idx] = 0; // Ocean subsumes freshwater lake
          }
        }
      }
    }
  }

  return {
    heightmapB64: encodeMaskB64(hm),
    freshwaterB64: isLake || world.freshwaterB64 ? encodeMaskB64(fw) : undefined,
  };
}

// ---------------------------------------------------------------------------
// Land/Water Query & Wonderdraft `sample_color` Biome Sampling
// ---------------------------------------------------------------------------

export function sampleHeightAt(
  world: WorldMapData,
  pt: Point2D,
  canvasW: number,
  canvasH: number,
  cachedHm?: Uint8Array,
): number {
  const { gridW, gridH } = world;
  const hm = cachedHm ?? decodeMaskB64Cached(world.heightmapB64, gridW * gridH);
  const gx = Math.max(0, Math.min(gridW - 1, (pt.x / Math.max(1, canvasW)) * (gridW - 1)));
  const gy = Math.max(0, Math.min(gridH - 1, (pt.y / Math.max(1, canvasH)) * (gridH - 1)));
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(gridW - 1, x0 + 1);
  const y1 = Math.min(gridH - 1, y0 + 1);
  const fx = gx - x0;
  const fy = gy - y0;
  const h00 = hm[y0 * gridW + x0];
  const h10 = hm[y0 * gridW + x1];
  const h01 = hm[y1 * gridW + x0];
  const h11 = hm[y1 * gridW + x1];
  return (h00 * (1 - fx) + h10 * fx) * (1 - fy) + (h01 * (1 - fx) + h11 * fx) * fy;
}

export function isPointOnLand(
  world: WorldMapData,
  pt: Point2D,
  canvasW: number,
  canvasH: number,
  cachedHm?: Uint8Array,
  cachedFw?: Uint8Array | null,
): boolean {
  const h = sampleHeightAt(world, pt, canvasW, canvasH, cachedHm);
  if (h < world.seaLevel) return false;
  if (world.freshwaterB64) {
    const fw = cachedFw ?? decodeMaskB64Cached(world.freshwaterB64, world.gridW * world.gridH);
    const gx = Math.max(0, Math.min(world.gridW - 1, Math.round((pt.x / Math.max(1, canvasW)) * (world.gridW - 1))));
    const gy = Math.max(0, Math.min(world.gridH - 1, Math.round((pt.y / Math.max(1, canvasH)) * (world.gridH - 1))));
    if (fw[gy * world.gridW + gx] >= 128) return false;
  }
  return true;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [200, 185, 155];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${cl(r)}${cl(g)}${cl(b)}`.toUpperCase();
}

/**
 * Samples the painted ground biome color at (x, y) on the World Map so Wonderdraft
 * `sample_color` trees, mountains, and hills automatically match the exact biome beneath them!
 */
export function sampleWorldBiomeColor(world: WorldMapData, pt: Point2D): string {
  let [r, g, b] = hexToRgb(world.theme.landBaseColorHex);
  for (const stroke of world.biomeStrokes) {
    if (stroke.target === "ocean" || stroke.pattern === "stipple") continue;
    if (stroke.points.length === 0) continue;
    let minD = Infinity;
    for (const p of stroke.points) {
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < minD) minD = d;
    }
    if (minD >= stroke.radiusCells) continue;
    const normD = minD / Math.max(0.05, stroke.radiusCells);
    const soft = Math.max(0.15, stroke.softness);
    const alpha = stroke.opacity * Math.max(0, Math.min(1, (1 - normD) / soft));
    const [sr, sg, sb] = hexToRgb(stroke.colorHex);
    r = r * (1 - alpha) + sr * alpha;
    g = g * (1 - alpha) + sg * alpha;
    b = b * (1 - alpha) + sb * alpha;
  }
  return rgbToHex(r, g, b);
}

// ---------------------------------------------------------------------------
// Meandering Tapered River Geometry
// ---------------------------------------------------------------------------

export function buildMeanderingRiverGeometry(river: WorldRiver): {
  centerline: Point2D[];
  leftEdge: Point2D[];
  rightEdge: Point2D[];
  polygon: Point2D[];
} {
  if (river.points.length < 2) {
    return { centerline: river.points, leftEdge: [], rightEdge: [], polygon: [] };
  }
  const basePts =
    river.curved && river.points.length >= 3
      ? sampleCatmullRom(river.points, 12, false)
      : river.points;

  // Densify to evenly spaced steps for organic meandering wobble
  const dense: Point2D[] = [basePts[0]];
  const step = 0.22;
  for (let i = 1; i < basePts.length; i++) {
    const a = basePts[i - 1];
    const b = basePts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(d / step));
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      dense.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }

  const centerline: Point2D[] = [];
  const leftEdge: Point2D[] = [];
  const rightEdge: Point2D[] = [];
  const rough = Math.max(0, Math.min(1, river.meanderRoughness));
  const scale = Math.max(0.2, Math.min(2.5, river.meanderScale || 1));

  // Pass 1: apply fractal perpendicular meander (pinned at endpoints!)
  for (let i = 0; i < dense.length; i++) {
    const t = i / Math.max(1, dense.length - 1);
    const prev = dense[Math.max(0, i - 1)];
    const next = dense[Math.min(dense.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const endPin = Math.sin(t * Math.PI); // 0 at spring & mouth, 1 in middle
    const wobble =
      rough > 0.01
        ? (fbm2D(t * 7.5 * scale, river.seed * 0.13, river.seed, 3, 0.52) - 0.5) *
          rough *
          1.35 *
          endPin
        : 0;
    centerline.push({ x: dense[i].x + nx * wobble, y: dense[i].y + ny * wobble });
  }

  // Pass 2: build smoothly tapered source-to-mouth river polygon (plus subtle mouth delta flare!)
  for (let i = 0; i < centerline.length; i++) {
    const t = i / Math.max(1, centerline.length - 1);
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(centerline.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const deltaFlare = t > 0.88 ? 1 + ((t - 0.88) / 0.12) * 0.28 : 1;
    const halfW =
      (river.startWidthCells + (river.endWidthCells - river.startWidthCells) * Math.pow(t, 1.15)) *
      0.5 *
      deltaFlare;
    leftEdge.push({ x: centerline[i].x + nx * halfW, y: centerline[i].y + ny * halfW });
    rightEdge.push({ x: centerline[i].x - nx * halfW, y: centerline[i].y - ny * halfW });
  }

  return {
    centerline,
    leftEdge,
    rightEdge,
    polygon: [...leftEdge, ...[...rightEdge].reverse()],
  };
}

// ---------------------------------------------------------------------------
// Detail / Sub-Region World Map Cropping ("Create Detail Map")
// ---------------------------------------------------------------------------

export function createDetailWorldFromBounds(
  parentDoc: DcMapDocument,
  bounds: { x0: number; y0: number; x1: number; y1: number },
  title = "Regional Detail Atlas",
): DcMapDocument | null {
  const pw = parentDoc.world;
  if (!pw) return null;
  const minX = Math.max(0, Math.min(bounds.x0, bounds.x1));
  const maxX = Math.min(parentDoc.canvas.widthCells, Math.max(bounds.x0, bounds.x1));
  const minY = Math.max(0, Math.min(bounds.y0, bounds.y1));
  const maxY = Math.min(parentDoc.canvas.heightCells, Math.max(bounds.y0, bounds.y1));
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX < 1.5 || spanY < 1.0) return null;

  const newWCells = parentDoc.canvas.widthCells;
  const newHCells = parentDoc.canvas.heightCells;
  const scaleX = newWCells / spanX;
  const scaleY = newHCells / spanY;
  const avgScale = (scaleX + scaleY) * 0.5;

  const mapPt = (pt: Point2D): Point2D => ({
    x: (pt.x - minX) * scaleX,
    y: (pt.y - minY) * scaleY,
  });

  // Upsample parent heightfield + freshwater mask into fresh 240x135 grid with subtle fine detail!
  const gridW = DEFAULT_WORLD_GRID_W;
  const gridH = DEFAULT_WORLD_GRID_H;
  const parentHm = decodeMaskB64Cached(pw.heightmapB64, pw.gridW * pw.gridH);
  const parentFw = pw.freshwaterB64
    ? decodeMaskB64Cached(pw.freshwaterB64, pw.gridW * pw.gridH)
    : null;
  const newHm = new Uint8Array(gridW * gridH);
  const newFw = parentFw ? new Uint8Array(gridW * gridH) : null;

  for (let y = 0; y < gridH; y++) {
    const worldY = minY + (y / (gridH - 1)) * spanY;
    for (let x = 0; x < gridW; x++) {
      const worldX = minX + (x / (gridW - 1)) * spanX;
      const baseH = sampleHeightAt(pw, { x: worldX, y: worldY }, parentDoc.canvas.widthCells, parentDoc.canvas.heightCells, parentHm);
      // Add subtle fine micro-coastline fractal detail near sea level so zoomed-in coasts stay crisp!
      const nearCoast = Math.max(0, 1 - Math.abs(baseH - pw.seaLevel) / 36);
      const micro = (fbm2D(x * 0.085, y * 0.085, pw.seed + 404, 3, 0.52) - 0.5) * 18 * nearCoast;
      newHm[y * gridW + x] = Math.max(0, Math.min(255, Math.round(baseH + micro)));
      if (newFw && parentFw) {
        const fv = sampleHeightAt(pw, { x: worldX, y: worldY }, parentDoc.canvas.widthCells, parentDoc.canvas.heightCells, parentFw);
        newFw[y * gridW + x] = Math.max(0, Math.min(255, Math.round(fv)));
      }
    }
  }

  const inPadBounds = (pt: Point2D, pad = 2.0) =>
    pt.x >= minX - pad && pt.x <= maxX + pad && pt.y >= minY - pad && pt.y <= maxY + pad;

  const newBiomeStrokes: WorldBiomeStroke[] = pw.biomeStrokes
    .filter((s) => s.points.some((p) => inPadBounds(p, s.radiusCells)))
    .map((s) => ({
      ...s,
      id: `${s.id}-sub`,
      points: s.points.map(mapPt),
      radiusCells: s.radiusCells * avgScale,
    }));

  const newRivers: WorldRiver[] = pw.rivers
    .filter((r) => r.points.some((p) => inPadBounds(p, 1.5)))
    .map((r) => ({
      ...r,
      id: `${r.id}-sub`,
      points: r.points.map(mapPt),
      startWidthCells: Math.min(2.5, r.startWidthCells * Math.sqrt(avgScale)),
      endWidthCells: Math.min(4.5, r.endWidthCells * Math.sqrt(avgScale)),
    }));

  const newTrails: WorldTrail[] = pw.trails
    .filter((t) => t.points.some((p) => inPadBounds(p, 1.5)))
    .map((t) => ({
      ...t,
      id: `${t.id}-sub`,
      points: t.points.map(mapPt),
    }));

  const newRegions: WorldRegion[] = pw.regions
    .filter((reg) => reg.polygon.some((p) => inPadBounds(p, 3)))
    .map((reg) => ({
      ...reg,
      id: `${reg.id}-sub`,
      polygon: reg.polygon.map(mapPt),
    }));

  const newLabels: WorldLabel[] = pw.labels
    .filter((lb) => inPadBounds({ x: lb.x, y: lb.y }, 1.0))
    .map((lb) => {
      const mp = mapPt({ x: lb.x, y: lb.y });
      return { ...lb, id: `${lb.id}-sub`, x: mp.x, y: mp.y };
    });

  const newLayers = parentDoc.layers.map((lyr) => ({
    ...lyr,
    objects: lyr.objects
      ?.filter((o) => inPadBounds({ x: o.x, y: o.y }, 1.2))
      .map((o) => {
        const mp = mapPt({ x: o.x, y: o.y });
        return {
          ...o,
          id: `${o.id}-sub`,
          x: mp.x,
          y: mp.y,
          widthCells: Math.min(12, o.widthCells * Math.sqrt(avgScale)),
          heightCells: Math.min(12, o.heightCells * Math.sqrt(avgScale)),
        };
      }),
    dmNotes: lyr.dmNotes
      ?.filter((n) => inPadBounds({ x: n.x, y: n.y }, 0.5))
      .map((n) => {
        const mp = mapPt({ x: n.x, y: n.y });
        return { ...n, id: `${n.id}-sub`, x: mp.x, y: mp.y };
      }),
  }));

  const now = new Date().toISOString();
  return {
    ...parentDoc,
    id: `world-detail-${Date.now()}`,
    mode: "world",
    meta: {
      title: `${title}.dcmap`,
      author: parentDoc.meta.author,
      createdAt: now,
      updatedAt: now,
    },
    layers: newLayers,
    world: {
      ...pw,
      gridW,
      gridH,
      heightmapB64: encodeMaskB64(newHm),
      freshwaterB64: newFw ? encodeMaskB64(newFw) : undefined,
      biomeStrokes: newBiomeStrokes,
      rivers: newRivers,
      trails: newTrails,
      regions: newRegions,
      labels: newLabels,
      subMapPins: [],
      overlays: {
        ...pw.overlays,
        scaleBar: {
          ...pw.overlays.scaleBar,
          milesPerCell: Math.max(0.5, Math.round((pw.overlays.scaleBar.milesPerCell / avgScale) * 10) / 10),
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Hit-Testing & Travel Time Formatting Helpers
// ---------------------------------------------------------------------------

export function hitTestWorldLabel(pt: Point2D, labels: WorldLabel[], cellPx = 24): WorldLabel | null {
  const pxSlop = Math.max(0.08, 7 / Math.max(12, cellPx));
  for (let i = labels.length - 1; i >= 0; i--) {
    const lb = labels[i];
    const lines = lb.text.split("\n");
    const maxLen = Math.max(1, ...lines.map((l) => l.length));
    // True world-cell dimensions (matches worldRenderer.ts scaleFactor = ppc / 32!)
    const charHCells = Math.max(0.12, lb.fontSizePx / 32);
    const trackCells = ((lb.letterSpacing || 0) / 32) * Math.max(0, maxLen - 1);
    const approxWCells = Math.max(pxSlop * 2.2, maxLen * charHCells * 0.6 + trackCells);
    const approxHCells = Math.max(
      pxSlop * 1.6,
      charHCells * (lb.lineHeight ?? 1.15) * Math.max(1, lines.length),
    );
    const rad = (-lb.rotationDeg * Math.PI) / 180;
    const dx = pt.x - lb.x;
    const dy = pt.y - lb.y;
    const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
    if (Math.abs(lx) <= approxWCells * 0.56 + pxSlop && Math.abs(ly) <= approxHCells * 0.56 + pxSlop) {
      return lb;
    }
  }
  return null;
}

export function hitTestWorldRiver(pt: Point2D, rivers: WorldRiver[]): WorldRiver | null {
  for (let i = rivers.length - 1; i >= 0; i--) {
    const rv = rivers[i];
    const hit = distanceToPolyline(pt, rv.points, false, rv.curved);
    if (hit.dist <= Math.max(0.42, rv.endWidthCells * 0.65)) {
      return rv;
    }
  }
  return null;
}

export function hitTestWorldTrail(pt: Point2D, trails: WorldTrail[]): WorldTrail | null {
  for (let i = trails.length - 1; i >= 0; i--) {
    const tr = trails[i];
    const hit = distanceToPolyline(pt, tr.points, false, tr.curved);
    if (hit.dist <= Math.max(0.4, tr.widthCells * 1.4)) {
      return tr;
    }
  }
  return null;
}

export function hitTestWorldRegion(pt: Point2D, regions: WorldRegion[]): WorldRegion | null {
  for (let i = regions.length - 1; i >= 0; i--) {
    const reg = regions[i];
    const poly =
      reg.curved && reg.polygon.length >= 3
        ? sampleCatmullRom(reg.polygon, 8, true)
        : reg.polygon;
    if (pointInPolygon(pt, poly)) {
      return reg;
    }
  }
  return null;
}

export function formatOverlandTravelMeasure(
  distCells: number,
  overlays: WorldCartographyOverlays,
): string {
  const miles = distCells * Math.max(0.1, overlays.scaleBar.milesPerCell);
  const km = miles * 1.60934;
  const speedMilesPerDay: Record<WorldTravelMode, { label: string; mpd: number }> = {
    walk: { label: "Foot", mpd: 24 },
    horse: { label: "Horse", mpd: 40 },
    ship: { label: "Ship", mpd: 72 },
    airship: { label: "Airship", mpd: 192 },
  };
  const sp = speedMilesPerDay[overlays.travelMode] ?? speedMilesPerDay.walk;
  const days = miles / sp.mpd;
  const daysStr = days < 1 ? `${Math.max(1, Math.round(days * 8))} hrs` : `${days.toFixed(1)}d`;
  if (overlays.scaleBar.unit === "km") {
    return `${km.toFixed(0)} km (${miles.toFixed(0)} mi) · ${daysStr} by ${sp.label}`;
  }
  if (overlays.scaleBar.unit === "leagues") {
    return `${(miles / 3).toFixed(1)} leagues (${miles.toFixed(0)} mi) · ${daysStr} by ${sp.label}`;
  }
  return `${miles.toFixed(0)} mi (${km.toFixed(0)} km) · ${daysStr} by ${sp.label}`;
}

export function createDefaultWorldData(opts?: {
  themeId?: string;
  preset?: WorldLandmassPreset;
  seed?: number;
  waterLevel?: number;
  roughness?: number;
}): WorldMapData {
  const themeId = opts?.themeId ?? "parchment";
  const theme = getWorldThemeById(themeId);
  const seed = opts?.seed ?? 4207;
  const gen = generateLandmassHeightmap({
    preset: opts?.preset ?? "continents",
    seed,
    waterLevel: opts?.waterLevel ?? 0.48,
    roughness: opts?.roughness ?? 0.62,
    detail: 5,
  });

  return {
    themeId: theme.id,
    theme,
    gridW: gen.gridW,
    gridH: gen.gridH,
    heightmapB64: gen.heightmapB64,
    seaLevel: 128,
    seed,
    coastlineRoughness: 0.62,
    biomeStrokes: [],
    rivers: [],
    trails: [],
    regions: [],
    labels: [],
    subMapPins: [],
    overlays: {
      compass: {
        visible: true,
        x: 42.5,
        y: 22.0,
        scale: 1.0,
        assetId: "world-atlas/cartography/hero_ornate_compass_rose.png",
        rotationDeg: 0,
        showRhumbLines: true,
        rhumbOpacity: 0.16,
      },
      scaleBar: {
        visible: true,
        x: 4.0,
        y: 24.4,
        unit: "miles",
        milesPerCell: 25,
        segments: 4,
        style: "classic",
      },
      grid: {
        style: "none",
        cellSizeCells: 2.0,
        opacity: 0.24,
        colorHex: theme.coastlineInkHex,
        showCoords: false,
      },
      frame: {
        style: theme.frameStyle,
        colorHex: theme.frameColorHex,
        widthPx: 22,
      },
      travelMode: "walk",
    },
  };
}

// ---------------------------------------------------------------------------
// Species-Aware World Symbol Family & Multi-Variant Paint-In Engine
// ---------------------------------------------------------------------------

export const WORLD_SPECIES_LABELS: Record<string, string> = {
  set_pine: "Alpine Pines",
  set_oak: "Broadleaf Oaks",
  set_snow_trees: "Winter Taiga",
  set_tropical: "Tropical & Palms",
  set_autumn: "Autumn & Sakura",
  set_deadwood: "Deadwood & Swamp",
  set_desert_flora: "Desert & Savanna",
  set_fey_flora: "Fey & Marsh Flora",
  set_alpine_peaks: "Alpine Snow Peaks",
  set_rocky_peaks: "Rocky & Granite Peaks",
  set_hills: "Rolling Hills & Downs",
  set_desert_dunes: "Dunes & Mesas",
  set_volcanic: "Volcanic & Obsidian",
  set_cliffs: "Cliffs & Waterfalls",
  set_terrain_features: "Terrain Features",
  set_medieval_towns: "Medieval Towns & Forts",
  set_fantasy_cities: "Fantasy Race Cities",
  set_world_cities: "World Cultures & Cities",
  set_dark_forts: "Dark Strongholds",
  set_landmarks: "Landmarks & POIs",
  set_ships: "Naval & Skyships",
  set_sea_hazards: "Monsters & Hazards",
  set_beasts: "Overland Map Beasts",
  set_compasses: "Compasses & Celestial",
  set_banners: "Banners & Scrolls",
  set_heraldry: "Heraldry & Legend Pins",
  set_clouds: "Clouds & Sky Isles",
};

export const WORLD_GROUP_SPECIES: Record<
  WorldAssetGroup,
  Array<{ id: string; label: string }>
> = {
  trees: [
    { id: "set_pine", label: "Pines" },
    { id: "set_oak", label: "Oaks & Broadleaf" },
    { id: "set_snow_trees", label: "Snow Taiga" },
    { id: "set_tropical", label: "Tropical & Palms" },
    { id: "set_autumn", label: "Autumn & Sakura" },
    { id: "set_deadwood", label: "Deadwood & Swamp" },
    { id: "set_desert_flora", label: "Desert & Savanna" },
    { id: "set_fey_flora", label: "Fey & Marsh" },
  ],
  mountains: [
    { id: "set_alpine_peaks", label: "Alpine Snow" },
    { id: "set_rocky_peaks", label: "Rocky Crags" },
    { id: "set_hills", label: "Rolling Hills" },
    { id: "set_desert_dunes", label: "Dunes & Mesas" },
    { id: "set_volcanic", label: "Volcanoes" },
    { id: "set_cliffs", label: "Cliffs & Falls" },
    { id: "set_terrain_features", label: "Terrain Features" },
  ],
  settlements: [
    { id: "set_medieval_towns", label: "Medieval Towns" },
    { id: "set_fantasy_cities", label: "Fantasy Cities" },
    { id: "set_world_cities", label: "World Cultures" },
    { id: "set_dark_forts", label: "Dark Strongholds" },
  ],
  landmarks: [
    { id: "set_landmarks", label: "Ruins & POIs" },
    { id: "set_beasts", label: "Map Beasts" },
  ],
  maritime: [
    { id: "set_ships", label: "Ships & Skyships" },
    { id: "set_sea_hazards", label: "Monsters & Hazards" },
  ],
  cartography: [
    { id: "set_compasses", label: "Compasses & Stars" },
    { id: "set_banners", label: "Scrolls & Banners" },
    { id: "set_heraldry", label: "Heraldry & Pins" },
    { id: "set_clouds", label: "Clouds & Sky Isles" },
  ],
  textures: [],
};

export interface WorldSymbolFamilyInfo {
  familyKey: string;
  familyLabel: string;
  drawMode: VaultAsset["drawMode"];
  variants: VaultAsset[];
}

function getParentFolderPath(internalPath: string): string {
  const norm = internalPath.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  return idx > 0 ? norm.slice(0, idx) : "";
}

function titleCaseFolderSegment(seg: string): string {
  return seg
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
}

/**
 * Resolves the exact cohesive species/set sibling variants for a World Symbol so
 * Multi-Variant Paint-In brushes cycle strictly within matching trees, peaks, dunes,
 * cliffs, or Wonderdraft folders without mixing unrelated biomes or draw modes.
 */
export function findWorldSymbolFamilyVariants(
  asset: VaultAsset,
  allAssets: VaultAsset[],
): WorldSymbolFamilyInfo {
  const setTag = asset.tags.find((t) => t.startsWith("set_"));
  const isCluster = asset.tags.includes("cluster");

  if (setTag) {
    const baseLabel =
      WORLD_SPECIES_LABELS[setTag] ?? titleCaseFolderSegment(setTag.replace(/^set_/, ""));
    const variants = allAssets.filter(
      (a) =>
        a.category === "symbol" &&
        a.drawMode === asset.drawMode &&
        (!asset.worldGroup || a.worldGroup === asset.worldGroup) &&
        a.tags.includes(setTag) &&
        a.tags.includes("cluster") === isCluster,
    );
    return {
      familyKey: `${setTag}:${asset.worldGroup ?? "any"}:${asset.drawMode}:${isCluster ? "cluster" : "single"}`,
      familyLabel: isCluster ? `${baseLabel} (Clusters)` : baseLabel,
      drawMode: asset.drawMode,
      variants: variants.length > 0 ? variants : [asset],
    };
  }

  // Imported Wonderdraft packs organize cohesive symbol sets into subfolders (e.g. `pirates_trees_tropical/`).
  const parentDir = getParentFolderPath(asset.internalPath);
  if (parentDir) {
    const folderVariants = allAssets.filter(
      (a) =>
        a.category === "symbol" &&
        a.sourceId === asset.sourceId &&
        a.drawMode === asset.drawMode &&
        getParentFolderPath(a.internalPath) === parentDir,
    );
    if (folderVariants.length > 1) {
      const folderName = parentDir.split("/").pop() ?? parentDir;
      return {
        familyKey: `dir:${asset.sourceId}:${parentDir}:${asset.drawMode}`,
        familyLabel: titleCaseFolderSegment(folderName),
        drawMode: asset.drawMode,
        variants: folderVariants,
      };
    }
  }

  // Final fallback: same source + worldGroup + drawMode
  const fallback = allAssets.filter(
    (a) =>
      a.category === "symbol" &&
      a.sourceId === asset.sourceId &&
      a.worldGroup === asset.worldGroup &&
      a.drawMode === asset.drawMode,
  );
  return {
    familyKey: `group:${asset.sourceId}:${asset.worldGroup ?? "symbol"}:${asset.drawMode}`,
    familyLabel: titleCaseFolderSegment(asset.worldGroup ?? "World Symbols"),
    drawMode: asset.drawMode,
    variants: fallback.length > 0 ? fallback : [asset],
  };
}

/**
 * Picks a sibling variant from a species family while preventing identical
 * back-to-back repeats whenever 2+ variants exist.
 */
export function pickNextWorldVariant(
  variants: VaultAsset[],
  lastAssetId?: string | null,
  rng: () => number = Math.random,
): VaultAsset {
  if (variants.length <= 1) return variants[0];
  const pool = lastAssetId ? variants.filter((v) => v.id !== lastAssetId) : variants;
  const activePool = pool.length > 0 ? pool : variants;
  const idx = Math.min(activePool.length - 1, Math.floor(rng() * activePool.length));
  return activePool[idx];
}

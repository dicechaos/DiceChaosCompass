import { pointInPolygon, sampleCatmullRom, sampleWallPoints } from "@/engine/geometry";
import type { Point2D, WaterBodyKind, WaterRegion } from "@/types/map";

export interface WaterBiomePreset {
  id: string;
  name: string;
  shortLabel: string;
  kind: WaterBodyKind;
  textureAssetId: string;
  deepColorHex: string;
  shallowColorHex: string;
  rimColorHex: string;
  opacity: number;
  rippleIntensity: number;
  causticsIntensity: number;
  depthFeather: number;
  shoreBankIntensity: number;
  organicRoughness: number;
}

export interface SculptedWaterShape {
  points: Point2D[];
  cutouts: Point2D[][];
}

export const WATER_BIOME_PRESETS: WaterBiomePreset[] = [
  {
    id: "alpine_lake",
    name: "Alpine Mirrorlake",
    shortLabel: "Alpine Lake",
    kind: "water",
    textureAssetId: "modular-suite/terrain/water_alpine_crystal.png",
    deepColorHex: "#0B3D5E",
    shallowColorHex: "#2799B8",
    rimColorHex: "#E6FAFF",
    opacity: 0.94,
    rippleIntensity: 0.72,
    causticsIntensity: 0.62,
    depthFeather: 0.65,
    shoreBankIntensity: 0.55,
    organicRoughness: 0.28,
  },
  {
    id: "tropical_lagoon",
    name: "Tropical Turquoise Lagoon",
    shortLabel: "Tropical",
    kind: "water",
    textureAssetId: "modular-suite/terrain/water_tropical_lagoon.png",
    deepColorHex: "#086A87",
    shallowColorHex: "#2DD4BF",
    rimColorHex: "#F0FDFA",
    opacity: 0.92,
    rippleIntensity: 0.68,
    causticsIntensity: 0.84,
    depthFeather: 0.78,
    shoreBankIntensity: 0.45,
    organicRoughness: 0.25,
  },
  {
    id: "deep_ocean",
    name: "Deep Ocean & Harbor",
    shortLabel: "Deep Sea",
    kind: "water",
    textureAssetId: "modular-suite/terrain/water_deep_ocean_swell.png",
    deepColorHex: "#07223D",
    shallowColorHex: "#155B82",
    rimColorHex: "#BAE6FD",
    opacity: 0.96,
    rippleIntensity: 0.85,
    causticsIntensity: 0.36,
    depthFeather: 0.55,
    shoreBankIntensity: 0.65,
    organicRoughness: 0.32,
  },
  {
    id: "crystal_creek",
    name: "Crystal Forest Stream",
    shortLabel: "Creek",
    kind: "water",
    textureAssetId: "core-fantasy/terrain/shallow_creek_bed.png",
    deepColorHex: "#15657A",
    shallowColorHex: "#67D5DB",
    rimColorHex: "#ECFEFF",
    opacity: 0.88,
    rippleIntensity: 0.58,
    causticsIntensity: 0.76,
    depthFeather: 0.82,
    shoreBankIntensity: 0.5,
    organicRoughness: 0.22,
  },
  {
    id: "murky_swamp",
    name: "Murky Bayou Swamp",
    shortLabel: "Swamp",
    kind: "swamp",
    textureAssetId: "modular-suite/terrain/water_murky_swamp_bayou.png",
    deepColorHex: "#1D3120",
    shallowColorHex: "#4D6B3C",
    rimColorHex: "#A3B87A",
    opacity: 0.95,
    rippleIntensity: 0.32,
    causticsIntensity: 0.14,
    depthFeather: 0.6,
    shoreBankIntensity: 0.72,
    organicRoughness: 0.42,
  },
  {
    id: "frozen_lake",
    name: "Frozen Glacial Ice",
    shortLabel: "Glacial Ice",
    kind: "ice",
    textureAssetId: "modular-suite/terrain/frozen_lake_ice.png",
    deepColorHex: "#1D4A6B",
    shallowColorHex: "#8ACCE8",
    rimColorHex: "#F0F9FF",
    opacity: 0.95,
    rippleIntensity: 0.25,
    causticsIntensity: 0.52,
    depthFeather: 0.5,
    shoreBankIntensity: 0.4,
    organicRoughness: 0.2,
  },
  {
    id: "volcanic_lava",
    name: "Volcanic Magma River",
    shortLabel: "Magma",
    kind: "lava",
    textureAssetId: "core-fantasy/terrain/volcanic_basalt.png",
    deepColorHex: "#3A0907",
    shallowColorHex: "#E05206",
    rimColorHex: "#FDE047",
    opacity: 0.97,
    rippleIntensity: 0.58,
    causticsIntensity: 0.82,
    depthFeather: 0.52,
    shoreBankIntensity: 0.85,
    organicRoughness: 0.35,
  },
  {
    id: "urban_chasm",
    name: "Urban Abyss / Chasm",
    shortLabel: "Chasm",
    kind: "chasm",
    textureAssetId: "terrain/under_city_abyss.png",
    deepColorHex: "#0B1220",
    shallowColorHex: "#16253D",
    rimColorHex: "#38BDF8",
    opacity: 0.95,
    rippleIntensity: 0,
    causticsIntensity: 0,
    depthFeather: 0.35,
    shoreBankIntensity: 0,
    organicRoughness: 0,
  },
];

export function getWaterPreset(id?: string): WaterBiomePreset {
  return WATER_BIOME_PRESETS.find((p) => p.id === id) ?? WATER_BIOME_PRESETS[0];
}

function hash1D(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function organicNoise2D(x: number, y: number, seed: number): number {
  const s = (seed % 997) * 0.137;
  const a = Math.sin(x * 1.45 + y * 0.72 + s) * Math.cos(y * 1.38 - x * 0.64 + s * 1.7);
  const b = Math.sin(x * 3.1 - y * 2.4 + s * 2.3) * 0.45;
  const c = Math.cos(x * 5.3 + y * 4.7 - s * 0.9) * 0.22;
  return (a + b + c) / 1.67;
}

function polygonSignedArea(pts: Point2D[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

function polygonPerimeter(pts: Point2D[]): number {
  let perim = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    perim += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return perim;
}

function pointToSegmentDistSq(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-8) {
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

/**
 * Deterministically perturbs a polyline/polygon along vertex normals to produce
 * natural hand-drawn coastlines without jittering across re-renders.
 */
export function perturbShoreline(
  points: Point2D[],
  roughness: number,
  seed: number,
  closed = true,
  canvasW = 48,
  canvasH = 27,
): Point2D[] {
  if (points.length < 3 || roughness <= 0.01) return points;
  const amp = Math.min(0.65, roughness * 0.42);
  const out: Point2D[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    // Preserve map-edge anchor vertices outside canvas bounds so open lakes stay flush
    if (curr.x < -0.25 || curr.x > canvasW + 0.25 || curr.y < -0.25 || curr.y > canvasH + 0.25) {
      out.push(curr);
      continue;
    }
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const wave =
      (hash1D(seed * 0.013 + i * 1.73) - 0.5) * 1.3 +
      Math.sin(i * 0.95 + seed * 0.17) * 0.35;
    const offset = closed || (i > 0 && i < n - 1) ? wave * amp : 0;
    out.push({
      x: curr.x + nx * offset,
      y: curr.y + ny * offset,
    });
  }
  return out;
}

interface LocalOccupancyGrid {
  originX: number;
  originY: number;
  gridW: number;
  gridH: number;
  padW: number;
  padH: number;
  subDiv: number;
  occ: Uint8Array;
}

function chooseGridSubDiv(spanW: number, spanH: number): number {
  const area = Math.max(1, spanW) * Math.max(1, spanH);
  if (area * 25 <= 58000) return 5;
  if (area * 16 <= 58000) return 4;
  if (area * 9 <= 58000) return 3;
  return 2;
}

function createLocalGrid(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  padUnits: number,
): LocalOccupancyGrid {
  const x0 = Math.floor(minX - padUnits);
  const y0 = Math.floor(minY - padUnits);
  const x1 = Math.ceil(maxX + padUnits);
  const y1 = Math.ceil(maxY + padUnits);
  const spanW = Math.max(2, x1 - x0);
  const spanH = Math.max(2, y1 - y0);
  const subDiv = chooseGridSubDiv(spanW, spanH);
  const gridW = Math.max(4, Math.ceil(spanW * subDiv));
  const gridH = Math.max(4, Math.ceil(spanH * subDiv));
  const padW = gridW + 2;
  const padH = gridH + 2;
  return {
    originX: x0,
    originY: y0,
    gridW,
    gridH,
    padW,
    padH,
    subDiv,
    occ: new Uint8Array(padW * padH),
  };
}

function rasterizePolygonIntoGrid(
  poly: Point2D[],
  occ: Uint8Array,
  padW: number,
  gridW: number,
  gridH: number,
  originX: number,
  originY: number,
  subDiv: number,
  value: 0 | 1,
): number {
  if (poly.length < 3) return 0;
  let minPy = Infinity;
  let maxPy = -Infinity;
  for (const p of poly) {
    if (p.y < minPy) minPy = p.y;
    if (p.y > maxPy) maxPy = p.y;
  }
  const gyStart = Math.max(0, Math.floor((minPy - originY) * subDiv));
  const gyEnd = Math.min(gridH - 1, Math.ceil((maxPy - originY) * subDiv));
  const n = poly.length;
  let changed = 0;

  for (let gy = gyStart; gy <= gyEnd; gy++) {
    const wy = originY + (gy + 0.5) / subDiv;
    const xs: number[] = [];
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const a = poly[j];
      const b = poly[i];
      if ((a.y <= wy && b.y > wy) || (b.y <= wy && a.y > wy)) {
        xs.push(a.x + ((wy - a.y) * (b.x - a.x)) / (b.y - a.y));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((u, v) => u - v);
    const rowOff = (gy + 1) * padW;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xL = xs[k];
      const xR = xs[k + 1];
      const gxStart = Math.max(0, Math.ceil((xL - originX) * subDiv - 0.5));
      const gxEnd = Math.min(gridW - 1, Math.floor((xR - originX) * subDiv - 0.5));
      for (let gx = gxStart; gx <= gxEnd; gx++) {
        const idx = rowOff + gx + 1;
        if (occ[idx] !== value) {
          occ[idx] = value;
          changed++;
        }
      }
    }
  }
  return changed;
}

function rasterizeBrushStrokeIntoGrid(
  strokePoints: Point2D[],
  radiusCells: number,
  organicRoughness: number,
  seed: number,
  occ: Uint8Array,
  padW: number,
  gridW: number,
  gridH: number,
  originX: number,
  originY: number,
  subDiv: number,
  value: 0 | 1,
): number {
  if (strokePoints.length === 0) return 0;
  const rBase = Math.max(0.35, radiusCells);
  const rMax = rBase * (organicRoughness > 0.01 ? 1.35 : 1.02);
  const rMaxSq = rMax * rMax;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of strokePoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // Thin ultra-dense raw pointer samples slightly without altering path accuracy
  const path: Point2D[] = [strokePoints[0]];
  const minStep = Math.max(0.08, Math.min(0.25, rBase * 0.14));
  for (let i = 1; i < strokePoints.length; i++) {
    const last = path[path.length - 1];
    if (Math.hypot(strokePoints[i].x - last.x, strokePoints[i].y - last.y) >= minStep) {
      path.push(strokePoints[i]);
    }
  }
  const lastRaw = strokePoints[strokePoints.length - 1];
  if (Math.hypot(lastRaw.x - path[path.length - 1].x, lastRaw.y - path[path.length - 1].y) > 1e-4) {
    path.push(lastRaw);
  }

  const gxStart = Math.max(0, Math.floor((minX - rMax - originX) * subDiv));
  const gxEnd = Math.min(gridW - 1, Math.ceil((maxX + rMax - originX) * subDiv));
  const gyStart = Math.max(0, Math.floor((minY - rMax - originY) * subDiv));
  const gyEnd = Math.min(gridH - 1, Math.ceil((maxY + rMax - originY) * subDiv));

  const segCount = Math.max(0, path.length - 1);
  const segAx = new Float64Array(segCount);
  const segAy = new Float64Array(segCount);
  const segDx = new Float64Array(segCount);
  const segDy = new Float64Array(segCount);
  const segLenSq = new Float64Array(segCount);
  for (let i = 0; i < segCount; i++) {
    segAx[i] = path[i].x;
    segAy[i] = path[i].y;
    segDx[i] = path[i + 1].x - path[i].x;
    segDy[i] = path[i + 1].y - path[i].y;
    segLenSq[i] = segDx[i] * segDx[i] + segDy[i] * segDy[i];
  }

  let changed = 0;
  for (let gy = gyStart; gy <= gyEnd; gy++) {
    const wy = originY + (gy + 0.5) / subDiv;
    const rowOff = (gy + 1) * padW;
    for (let gx = gxStart; gx <= gxEnd; gx++) {
      const idx = rowOff + gx + 1;
      if (occ[idx] === value) continue;
      const wx = originX + (gx + 0.5) / subDiv;

      let bestDistSq = Infinity;
      if (segCount === 0) {
        const dx = wx - path[0].x;
        const dy = wy - path[0].y;
        bestDistSq = dx * dx + dy * dy;
      } else {
        for (let i = 0; i < segCount; i++) {
          const l2 = segLenSq[i];
          const ex0 = wx - segAx[i];
          const ey0 = wy - segAy[i];
          let d2: number;
          if (l2 < 1e-8) {
            d2 = ex0 * ex0 + ey0 * ey0;
          } else {
            let t = (ex0 * segDx[i] + ey0 * segDy[i]) / l2;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
            const px = ex0 - t * segDx[i];
            const py = ey0 - t * segDy[i];
            d2 = px * px + py * py;
          }
          if (d2 < bestDistSq) bestDistSq = d2;
        }
      }

      if (bestDistSq > rMaxSq) continue;
      let rEff = rBase;
      if (organicRoughness > 0.01) {
        const mod = 1 + organicNoise2D(wx * 1.15, wy * 1.15, seed) * organicRoughness * 0.28;
        rEff = rBase * Math.max(0.62, Math.min(1.35, mod));
      }
      if (bestDistSq <= rEff * rEff) {
        occ[idx] = value;
        changed++;
      }
    }
  }
  return changed;
}

/**
 * Eliminates 1-subcell dry shoreline slits (trapped cracks between brush & old shore)
 * and 1-subcell wet whisker spikes before extracting manifold contours.
 */
function cleanOccupancyGrid(occ: Uint8Array, padW: number, padH: number): void {
  // Pass 1 (Close): fill 1-cell thin dry cracks sandwiched vertically or horizontally by water
  const toFill: number[] = [];
  for (let py = 1; py < padH - 1; py++) {
    const row = py * padW;
    for (let px = 1; px < padW - 1; px++) {
      const idx = row + px;
      if (occ[idx] !== 0) continue;
      const top = occ[idx - padW];
      const bot = occ[idx + padW];
      const lft = occ[idx - 1];
      const rgt = occ[idx + 1];
      if ((top === 1 && bot === 1) || (lft === 1 && rgt === 1)) {
        toFill.push(idx);
      }
    }
  }
  for (let i = 0; i < toFill.length; i++) occ[toFill[i]] = 1;

  // Pass 2 (Open): remove 1-cell thin wet whisker spikes sandwiched by dry land
  const toClear: number[] = [];
  for (let py = 1; py < padH - 1; py++) {
    const row = py * padW;
    for (let px = 1; px < padW - 1; px++) {
      const idx = row + px;
      if (occ[idx] !== 1) continue;
      const top = occ[idx - padW];
      const bot = occ[idx + padW];
      const lft = occ[idx - 1];
      const rgt = occ[idx + 1];
      if ((top === 0 && bot === 0) || (lft === 0 && rgt === 0)) {
        toClear.push(idx);
      }
    }
  }
  for (let i = 0; i < toClear.length; i++) occ[toClear[i]] = 0;
}

function extractManifoldLoops(
  occ: Uint8Array,
  padW: number,
  padH: number,
  originX: number,
  originY: number,
  subDiv: number,
): { outers: Point2D[][]; holes: Point2D[][] } {
  const outgoing = new Map<number, number[]>();
  const stride = padW + 1;
  const addEdge = (x1: number, y1: number, x2: number, y2: number) => {
    const k1 = y1 * stride + x1;
    const k2 = y2 * stride + x2;
    let list = outgoing.get(k1);
    if (!list) {
      list = [];
      outgoing.set(k1, list);
    }
    list.push(k2);
  };

  for (let py = 1; py < padH - 1; py++) {
    for (let px = 1; px < padW - 1; px++) {
      if (occ[py * padW + px] === 0) continue;
      if (occ[(py - 1) * padW + px] === 0) addEdge(px, py, px + 1, py);
      if (occ[py * padW + (px + 1)] === 0) addEdge(px + 1, py, px + 1, py + 1);
      if (occ[(py + 1) * padW + px] === 0) addEdge(px + 1, py + 1, px, py + 1);
      if (occ[py * padW + (px - 1)] === 0) addEdge(px, py + 1, px, py);
    }
  }

  const outers: Point2D[][] = [];
  const holes: Point2D[][] = [];
  const used = new Set<string>();

  for (const [startKey, targets] of outgoing.entries()) {
    for (const firstNext of targets) {
      const firstId = `${startKey}->${firstNext}`;
      if (used.has(firstId)) continue;

      const loopKeys: number[] = [startKey];
      let prev = startKey;
      let cur = firstNext;
      used.add(firstId);

      let guard = 0;
      const maxSteps = padW * padH * 4;
      while (cur !== startKey && guard++ < maxSteps) {
        loopKeys.push(cur);
        const nextList = outgoing.get(cur);
        if (!nextList || nextList.length === 0) break;

        let chosen = -1;
        if (nextList.length === 1) {
          const cand = nextList[0];
          if (!used.has(`${cur}->${cand}`)) chosen = cand;
        } else {
          const px0 = prev % stride;
          const py0 = Math.floor(prev / stride);
          const cx = cur % stride;
          const cy = Math.floor(cur / stride);
          const inDx = cx - px0;
          const inDy = cy - py0;
          let bestScore = -Infinity;
          for (const cand of nextList) {
            if (used.has(`${cur}->${cand}`)) continue;
            const nx = cand % stride;
            const ny = Math.floor(cand / stride);
            const outDx = nx - cx;
            const outDy = ny - cy;
            const cross = inDx * outDy - inDy * outDx;
            const dot = inDx * outDx + inDy * outDy;
            const score = cross > 0 ? 3 : dot > 0 ? 2 : 1;
            if (score > bestScore) {
              bestScore = score;
              chosen = cand;
            }
          }
        }
        if (chosen === -1) break;
        used.add(`${cur}->${chosen}`);
        prev = cur;
        cur = chosen;
      }

      if (loopKeys.length >= 4 && cur === startKey) {
        const pts: Point2D[] = loopKeys.map((k) => ({
          x: originX + ((k % stride) - 1) / subDiv,
          y: originY + (Math.floor(k / stride) - 1) / subDiv,
        }));
        const area = polygonSignedArea(pts);
        if (area > 0.1) {
          outers.push(pts);
        } else if (area < -0.08) {
          holes.push(pts);
        }
      }
    }
  }

  return { outers, holes };
}

function taubinSmoothClosedLoop(
  pts: Point2D[],
  iterations = 6,
  canvasW = 48,
  canvasH = 27,
): Point2D[] {
  if (pts.length < 4 || iterations <= 0) return pts;
  const isBorderPinned = (p: Point2D) =>
    p.x < -0.15 || p.x > canvasW + 0.15 || p.y < -0.15 || p.y > canvasH + 0.15;

  const stepLaplacian = (src: Point2D[], weight: number): Point2D[] => {
    const n = src.length;
    const out: Point2D[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = src[i];
      if (isBorderPinned(p)) {
        out[i] = p;
        continue;
      }
      const prev = src[(i - 1 + n) % n];
      const next = src[(i + 1) % n];
      const avgX = (prev.x + next.x) * 0.5;
      const avgY = (prev.y + next.y) * 0.5;
      out[i] = {
        x: p.x + (avgX - p.x) * weight,
        y: p.y + (avgY - p.y) * weight,
      };
    }
    return out;
  };

  let cur = pts;
  for (let it = 0; it < iterations; it++) {
    cur = stepLaplacian(cur, 0.5);
    cur = stepLaplacian(cur, -0.525);
  }
  return cur;
}

function pruneCloseVertices(pts: Point2D[], minDist: number): Point2D[] {
  if (pts.length <= 4 || minDist <= 0) return pts;
  const minDistSq = minDist * minDist;
  const out: Point2D[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = out[out.length - 1];
    const dx = pts[i].x - last.x;
    const dy = pts[i].y - last.y;
    if (dx * dx + dy * dy >= minDistSq) {
      out.push(pts[i]);
    }
  }
  if (out.length > 3) {
    const first = out[0];
    const last = out[out.length - 1];
    const dx = first.x - last.x;
    const dy = first.y - last.y;
    if (dx * dx + dy * dy < minDistSq) {
      out.pop();
    }
  }
  return out.length >= 3 ? out : pts;
}

function simplifyClosedLoop(pts: Point2D[], epsilon: number): Point2D[] {
  if (pts.length <= 4) return pts;
  const pruned: Point2D[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length];
    const cur = pts[i];
    const next = pts[(i + 1) % pts.length];
    const cross = Math.abs(
      (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x),
    );
    if (cross > 1e-6) pruned.push(cur);
  }
  if (pruned.length <= 4 || epsilon <= 0) return pruned;

  let splitIdx = 1;
  let maxDistSq = -1;
  for (let i = 1; i < pruned.length; i++) {
    const dx = pruned[i].x - pruned[0].x;
    const dy = pruned[i].y - pruned[0].y;
    const d2 = dx * dx + dy * dy;
    if (d2 > maxDistSq) {
      maxDistSq = d2;
      splitIdx = i;
    }
  }

  const epsSq = epsilon * epsilon;
  const rdp = (chain: Point2D[]): Point2D[] => {
    if (chain.length <= 2) return chain;
    let bestIdx = 0;
    let bestD2 = -1;
    const a = chain[0];
    const b = chain[chain.length - 1];
    for (let i = 1; i < chain.length - 1; i++) {
      const d2 = pointToSegmentDistSq(chain[i], a, b);
      if (d2 > bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }
    if (bestD2 > epsSq) {
      const left = rdp(chain.slice(0, bestIdx + 1));
      const right = rdp(chain.slice(bestIdx));
      return [...left.slice(0, -1), ...right];
    }
    return [a, b];
  };

  const partA = rdp(pruned.slice(0, splitIdx + 1));
  const partB = rdp([...pruned.slice(splitIdx), pruned[0]]);
  const merged = [...partA.slice(0, -1), ...partB.slice(0, -1)];
  return merged.length >= 3 ? merged : pruned;
}

function assignHolesToOuters(
  outers: Point2D[][],
  holes: Point2D[][],
): SculptedWaterShape[] {
  if (outers.length === 0) return [];
  // Sort ascending first so each hole attaches to its tightest containing outer loop
  const ascending = outers
    .map((pts) => ({ pts, area: Math.abs(polygonSignedArea(pts)) }))
    .sort((a, b) => a.area - b.area);
  const buckets = ascending.map((s) => ({
    area: s.area,
    shape: { points: s.pts, cutouts: [] as Point2D[][] },
  }));

  for (const hole of holes) {
    if (hole.length < 3) continue;
    const probe = hole[0];
    for (let i = 0; i < buckets.length; i++) {
      if (pointInPolygon(probe, buckets[i].shape.points)) {
        buckets[i].shape.cutouts.push(hole);
        break;
      }
    }
  }

  // Return largest water bodies first so shapes[0] is always the primary lake
  buckets.sort((a, b) => b.area - a.area);
  return buckets.map((b) => b.shape);
}

function isSubstantialLoop(
  pts: Point2D[],
  minArea: number,
  minHydraulicThickness: number,
): boolean {
  if (pts.length < 3) return false;
  const area = Math.abs(polygonSignedArea(pts));
  if (area < minArea) return false;
  const perim = polygonPerimeter(pts);
  if (perim < 1e-4) return false;
  const avgThickness = (2 * area) / perim;
  return avgThickness >= minHydraulicThickness;
}

function finalizeExtractedWaterShapes(
  raw: { outers: Point2D[][]; holes: Point2D[][] },
  smoothPasses: number,
  simplifyEps: number,
  canvasW: number,
  canvasH: number,
  minOuterArea = 0.28,
  minHoleArea = 0.3,
): SculptedWaterShape[] {
  const minVertSpacing = Math.max(0.18, simplifyEps * 1.4);

  const cleanOuters = raw.outers
    .filter((loop) => isSubstantialLoop(loop, minOuterArea, 0.26))
    .map((loop) => {
      const smoothed = taubinSmoothClosedLoop(loop, smoothPasses, canvasW, canvasH);
      const simplified = simplifyClosedLoop(smoothed, simplifyEps);
      return pruneCloseVertices(simplified, minVertSpacing);
    })
    .filter((p) => isSubstantialLoop(p, minOuterArea * 0.85, 0.24));

  const cleanHoles = raw.holes
    .filter((loop) => isSubstantialLoop(loop, minHoleArea, 0.32))
    .map((loop) => {
      const smoothed = taubinSmoothClosedLoop(loop, smoothPasses, canvasW, canvasH);
      const simplified = simplifyClosedLoop(smoothed, simplifyEps);
      return pruneCloseVertices(simplified, minVertSpacing);
    })
    .filter((p) => isSubstantialLoop(p, minHoleArea * 0.85, 0.3));

  return assignHolesToOuters(cleanOuters, cleanHoles);
}

/**
 * Rasterizes one or more existing WaterRegions (outers=1, holes=0) cleanly into a shared local grid.
 * Returns total number of occupied cells written to the grid.
 */
function rasterizeRegionsIntoGrid(
  regions: WaterRegion[],
  grid: LocalOccupancyGrid,
): number {
  let filled = 0;
  for (const reg of regions) {
    const { outer, holes } = computeWaterOutline(reg);
    if (outer.length < 3) continue;
    filled += rasterizePolygonIntoGrid(
      outer,
      grid.occ,
      grid.padW,
      grid.gridW,
      grid.gridH,
      grid.originX,
      grid.originY,
      grid.subDiv,
      1,
    );
    for (const h of holes) {
      rasterizePolygonIntoGrid(
        h,
        grid.occ,
        grid.padW,
        grid.gridW,
        grid.gridH,
        grid.originX,
        grid.originY,
        grid.subDiv,
        0,
      );
    }
  }
  return filled;
}

/**
 * Checks quickly whether a brush stroke intersects or touches a WaterRegion's outer boundary.
 */
export function brushStrokeOverlapsWaterRegion(
  region: WaterRegion,
  strokePoints: Point2D[],
  radiusCells: number,
): boolean {
  if (strokePoints.length === 0) return false;
  const { outer, holes } = computeWaterOutline(region);
  if (outer.length < 3) return false;

  const reach = Math.max(0.45, radiusCells) * 1.38 + 0.25;
  let oMinX = Infinity;
  let oMinY = Infinity;
  let oMaxX = -Infinity;
  let oMaxY = -Infinity;
  for (const p of outer) {
    if (p.x < oMinX) oMinX = p.x;
    if (p.y < oMinY) oMinY = p.y;
    if (p.x > oMaxX) oMaxX = p.x;
    if (p.y > oMaxY) oMaxY = p.y;
  }

  let sMinX = Infinity;
  let sMinY = Infinity;
  let sMaxX = -Infinity;
  let sMaxY = -Infinity;
  for (const p of strokePoints) {
    if (p.x < sMinX) sMinX = p.x;
    if (p.y < sMinY) sMinY = p.y;
    if (p.x > sMaxX) sMaxX = p.x;
    if (p.y > sMaxY) sMaxY = p.y;
  }

  if (
    sMaxX + reach < oMinX ||
    sMinX - reach > oMaxX ||
    sMaxY + reach < oMinY ||
    sMinY - reach > oMaxY
  ) {
    return false;
  }

  const reachSq = reach * reach;
  const probes: Point2D[] = [strokePoints[0]];
  const step = Math.max(0.25, radiusCells * 0.45);
  for (let i = 1; i < strokePoints.length; i++) {
    const a = strokePoints[i - 1];
    const b = strokePoints[i];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      probes.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }

  for (const pt of probes) {
    if (pointInPolygon(pt, outer)) {
      const inHole = holes.some((h) => pointInPolygon(pt, h));
      if (!inHole) return true;
    }
    for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
      if (pointToSegmentDistSq(pt, outer[j], outer[i]) <= reachSq) return true;
    }
  }

  for (const v of outer) {
    for (let i = 0; i < strokePoints.length; i++) {
      const a = strokePoints[i];
      const b = strokePoints[Math.min(strokePoints.length - 1, i + 1)];
      if (pointToSegmentDistSq(v, a, b) <= reachSq) return true;
    }
  }

  return false;
}

/**
 * Rasterizes a fresh freehand Lake Brush stroke into clean, non-self-intersecting
 * manifold shapes (even for figure-8s or closed ring/donut lakes).
 */
export function buildWaterBrushShape(
  strokePoints: Point2D[],
  radiusCells: number,
  organicRoughness = 0.25,
  seed = 101,
  canvasW = 48,
  canvasH = 27,
  simplifyEps = 0.1,
): SculptedWaterShape[] {
  if (strokePoints.length === 0) return [];
  const r = Math.max(0.45, radiusCells);
  const pad = r * 1.4 + 1.5;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of strokePoints) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const grid = createLocalGrid(minX, minY, maxX, maxY, pad);
  rasterizeBrushStrokeIntoGrid(
    strokePoints,
    r,
    organicRoughness,
    seed,
    grid.occ,
    grid.padW,
    grid.gridW,
    grid.gridH,
    grid.originX,
    grid.originY,
    grid.subDiv,
    1,
  );
  cleanOccupancyGrid(grid.occ, grid.padW, grid.padH);
  const loops = extractManifoldLoops(
    grid.occ,
    grid.padW,
    grid.padH,
    grid.originX,
    grid.originY,
    grid.subDiv,
  );
  return finalizeExtractedWaterShapes(loops, 6, simplifyEps, canvasW, canvasH);
}

/**
 * Unions overlapping existing water regions together with a brush stroke into
 * seamless, non-self-intersecting sculpted water shapes.
 */
export function unionWaterRegionsWithBrush(
  regions: WaterRegion[],
  strokePoints: Point2D[],
  radiusCells: number,
  organicRoughness: number,
  seed: number,
  canvasW = 48,
  canvasH = 27,
): SculptedWaterShape[] {
  const r = Math.max(0.45, radiusCells);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const reg of regions) {
    const { outer } = computeWaterOutline(reg);
    for (const p of outer) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  for (const p of strokePoints) {
    if (p.x - r * 1.4 < minX) minX = p.x - r * 1.4;
    if (p.y - r * 1.4 < minY) minY = p.y - r * 1.4;
    if (p.x + r * 1.4 > maxX) maxX = p.x + r * 1.4;
    if (p.y + r * 1.4 > maxY) maxY = p.y + r * 1.4;
  }
  if (!Number.isFinite(minX)) return [];

  const grid = createLocalGrid(minX, minY, maxX, maxY, 1.5);
  rasterizeRegionsIntoGrid(regions, grid);
  rasterizeBrushStrokeIntoGrid(
    strokePoints,
    r,
    organicRoughness,
    seed,
    grid.occ,
    grid.padW,
    grid.gridW,
    grid.gridH,
    grid.originX,
    grid.originY,
    grid.subDiv,
    1,
  );
  cleanOccupancyGrid(grid.occ, grid.padW, grid.padH);
  const loops = extractManifoldLoops(
    grid.occ,
    grid.padW,
    grid.padH,
    grid.originX,
    grid.originY,
    grid.subDiv,
  );
  return finalizeExtractedWaterShapes(loops, 6, 0.18, canvasW, canvasH);
}

/**
 * Subtracts an Island/Erase brush stroke from an existing WaterRegion cleanly,
 * carving interior islands, merging overlapping islands, trimming outer shorelines,
 * deleting degenerate <1-subcell slivers, or splitting/deleting water bodies without XOR artifacts.
 */
export function subtractBrushFromWaterRegion(
  region: WaterRegion,
  strokePoints: Point2D[],
  radiusCells: number,
  organicRoughness: number,
  seed: number,
  canvasW = 48,
  canvasH = 27,
): { changed: boolean; shapes: SculptedWaterShape[] } {
  const { outer, holes } = computeWaterOutline(region);
  if (outer.length < 3 || strokePoints.length === 0) {
    return { changed: false, shapes: [] };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outer) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  for (const h of holes) {
    for (const p of h) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  const r = Math.max(0.45, radiusCells);
  for (const p of strokePoints) {
    if (p.x - r * 1.4 < minX) minX = p.x - r * 1.4;
    if (p.y - r * 1.4 < minY) minY = p.y - r * 1.4;
    if (p.x + r * 1.4 > maxX) maxX = p.x + r * 1.4;
    if (p.y + r * 1.4 > maxY) maxY = p.y + r * 1.4;
  }

  const grid = createLocalGrid(minX, minY, maxX, maxY, 1.5);
  const initialFilled = rasterizeRegionsIntoGrid([region], grid);
  // If a degenerate ultra-thin sliver (< 1 subcell) overlaps the erase brush, delete it cleanly!
  if (initialFilled === 0) {
    if (brushStrokeOverlapsWaterRegion(region, strokePoints, r)) {
      return { changed: true, shapes: [] };
    }
    return { changed: false, shapes: [] };
  }

  const changedCount = rasterizeBrushStrokeIntoGrid(
    strokePoints,
    r,
    organicRoughness,
    seed,
    grid.occ,
    grid.padW,
    grid.gridW,
    grid.gridH,
    grid.originX,
    grid.originY,
    grid.subDiv,
    0,
  );
  if (changedCount === 0) {
    return { changed: false, shapes: [] };
  }

  cleanOccupancyGrid(grid.occ, grid.padW, grid.padH);
  const loops = extractManifoldLoops(
    grid.occ,
    grid.padW,
    grid.padH,
    grid.originX,
    grid.originY,
    grid.subDiv,
  );
  const shapes = finalizeExtractedWaterShapes(loops, 6, 0.18, canvasW, canvasH);
  return { changed: true, shapes };
}

/**
 * Reusable cached-grid session for zero-erosion real-time live water sculpting
 * across continuous pointer drags (1 single Undo checkpoint per stroke!).
 */
export interface LiveWaterSculptSession {
  mode: "paint" | "erase";
  meshSameLayer: boolean;
  seed: number;
  radiusCells: number;
  organicRoughness: number;
  canvasW: number;
  canvasH: number;
  baseGrid: LocalOccupancyGrid;
  brushOcc: Uint8Array;
  workOcc: Uint8Array;
  /** Pre-stroke snapshot of water regions per layerId */
  baseRegionsByLayer: Map<string, WaterRegion[]>;
  /** Cached per-region rasterized masks on baseGrid so unchanged regions are never re-rasterized */
  regionMaskCache: Map<string, { filled: number; mask: Uint8Array }>;
  allStrokePoints: Point2D[];
  lastSampledIndex: number;
  /** Style template & matcher used for paint mode */
  paintLayerId: string;
  paintStyle: {
    kind: WaterBodyKind;
    presetId: string;
    textureAssetId: string;
    deepColorHex: string;
    shallowColorHex: string;
    rimColorHex: string;
    opacity: number;
    rippleIntensity: number;
    causticsIntensity: number;
    depthFeather: number;
    shoreBankIntensity: number;
  };
  hasRecordedHistory: boolean;
  didMutate: boolean;
  mergedIntoExisting: boolean;
  removedCount: number;
  updatedCount: number;
}

export function createLiveWaterSculptSession(params: {
  mode: "paint" | "erase";
  meshSameLayer?: boolean;
  radiusCells: number;
  organicRoughness: number;
  seed: number;
  canvasW: number;
  canvasH: number;
  layers: Array<{ id: string; waterRegions: WaterRegion[] }>;
  paintLayerId: string;
  paintStyle: LiveWaterSculptSession["paintStyle"];
}): LiveWaterSculptSession {
  let minX = -2;
  let minY = -2;
  let maxX = params.canvasW + 2;
  let maxY = params.canvasH + 2;
  const baseRegionsByLayer = new Map<string, WaterRegion[]>();

  for (const lyr of params.layers) {
    baseRegionsByLayer.set(lyr.id, lyr.waterRegions);
    for (const reg of lyr.waterRegions) {
      const { outer } = computeWaterOutline(reg);
      for (const p of outer) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
    }
  }

  const baseGrid = createLocalGrid(minX, minY, maxX, maxY, Math.max(1.5, params.radiusCells + 0.5));
  const cellCount = baseGrid.padW * baseGrid.padH;

  return {
    mode: params.mode,
    meshSameLayer: params.meshSameLayer !== false,
    seed: params.seed,
    radiusCells: Math.max(0.45, params.radiusCells),
    organicRoughness: params.organicRoughness,
    canvasW: params.canvasW,
    canvasH: params.canvasH,
    baseGrid,
    brushOcc: new Uint8Array(cellCount),
    workOcc: new Uint8Array(cellCount),
    baseRegionsByLayer,
    regionMaskCache: new Map(),
    allStrokePoints: [],
    lastSampledIndex: -1,
    paintLayerId: params.paintLayerId,
    paintStyle: params.paintStyle,
    hasRecordedHistory: false,
    didMutate: false,
    mergedIntoExisting: false,
    removedCount: 0,
    updatedCount: 0,
  };
}

function getOrRasterizeRegionMask(
  session: LiveWaterSculptSession,
  reg: WaterRegion,
): { filled: number; mask: Uint8Array } {
  const hit = session.regionMaskCache.get(reg.id);
  if (hit) return hit;
  const g = session.baseGrid;
  const mask = new Uint8Array(g.padW * g.padH);
  const { outer, holes } = computeWaterOutline(reg);
  let filled = 0;
  if (outer.length >= 3) {
    filled = rasterizePolygonIntoGrid(
      outer,
      mask,
      g.padW,
      g.gridW,
      g.gridH,
      g.originX,
      g.originY,
      g.subDiv,
      1,
    );
    for (const h of holes) {
      rasterizePolygonIntoGrid(
        h,
        mask,
        g.padW,
        g.gridW,
        g.gridH,
        g.originX,
        g.originY,
        g.subDiv,
        0,
      );
    }
  }
  const entry = { filled, mask };
  session.regionMaskCache.set(reg.id, entry);
  return entry;
}

/**
 * Advances a LiveWaterSculptSession with one or more new pointer points and returns
 * the updated `WaterRegion[]` per touched layer in ~1-3ms with ZERO cumulative erosion.
 */
export function stepLiveWaterSculptSession(
  session: LiveWaterSculptSession,
  newPoints: Point2D[],
): { changed: boolean; updates: Map<string, WaterRegion[]> } {
  const updates = new Map<string, WaterRegion[]>();
  if (newPoints.length === 0 && session.allStrokePoints.length === 0) {
    return { changed: false, updates };
  }

  const g = session.baseGrid;
  if (newPoints.length > 0) {
    const startIdx = Math.max(0, session.allStrokePoints.length - 1);
    for (const pt of newPoints) {
      session.allStrokePoints.push(pt);
    }
    const segSlice = session.allStrokePoints.slice(startIdx);
    rasterizeBrushStrokeIntoGrid(
      segSlice,
      session.radiusCells,
      session.organicRoughness,
      session.seed,
      session.brushOcc,
      g.padW,
      g.gridW,
      g.gridH,
      g.originX,
      g.originY,
      g.subDiv,
      1,
    );
  }

  const stroke = session.allStrokePoints;
  const brushOcc = session.brushOcc;
  const workOcc = session.workOcc;
  const cellCount = workOcc.length;

  if (session.mode === "paint") {
    const baseRegions = session.baseRegionsByLayer.get(session.paintLayerId) ?? [];
    const ps = session.paintStyle;
    const paintIsSolid = ps.opacity >= 0.75;
    const isSameStyle = (reg: WaterRegion) =>
      reg.kind === ps.kind &&
      (reg.opacity >= 0.75) === paintIsSolid &&
      (reg.presetId
        ? reg.presetId === ps.presetId
        : reg.deepColorHex.toLowerCase() === ps.deepColorHex.toLowerCase());

    const matching = baseRegions.filter(
      (reg) => isSameStyle(reg) && brushStrokeOverlapsWaterRegion(reg, stroke, session.radiusCells),
    );

    workOcc.set(brushOcc);
    for (const reg of matching) {
      const { mask } = getOrRasterizeRegionMask(session, reg);
      for (let i = 0; i < cellCount; i++) {
        if (mask[i] === 1) workOcc[i] = 1;
      }
    }
    cleanOccupancyGrid(workOcc, g.padW, g.padH);
    const loops = extractManifoldLoops(workOcc, g.padW, g.padH, g.originX, g.originY, g.subDiv);
    const shapes = finalizeExtractedWaterShapes(loops, 6, 0.18, session.canvasW, session.canvasH);
    if (shapes.length === 0) return { changed: false, updates };

    const shouldCarveOtherBiomes =
      session.meshSameLayer && ps.kind !== "chasm" && paintIsSolid;
    const matchIds = new Set(matching.map((m) => m.id));
    const baseReg = matching[0] ?? null;
    const firstIdx = baseReg ? baseRegions.findIndex((r) => r.id === baseReg.id) : -1;

    const paintedRegions: WaterRegion[] = baseReg
      ? shapes.map((shape, idx) => ({
          ...baseReg,
          id: idx === 0 ? baseReg.id : `${baseReg.id}-part-${session.seed}-${idx}`,
          shape: "polygon",
          curved: true,
          organicRoughness: 0,
          points: shape.points,
          cutouts: shape.cutouts.length > 0 ? shape.cutouts : undefined,
        }))
      : shapes.map((shape, idx) => ({
          id: idx === 0 ? `water-br-${session.seed}` : `water-br-${session.seed}-${idx}`,
          kind: ps.kind,
          presetId: ps.presetId,
          shape: "polygon",
          curved: true,
          textureAssetId: ps.textureAssetId,
          points: shape.points,
          cutouts: shape.cutouts.length > 0 ? shape.cutouts : undefined,
          deepColorHex: ps.deepColorHex,
          shallowColorHex: ps.shallowColorHex,
          rimColorHex: ps.rimColorHex,
          opacity: ps.opacity,
          rippleIntensity: ps.rippleIntensity,
          causticsIntensity: ps.causticsIntensity,
          depthFeather: ps.depthFeather,
          shoreBankIntensity: ps.shoreBankIntensity,
          organicRoughness: 0,
          seed: session.seed,
        }));

    if (baseReg) {
      session.mergedIntoExisting = true;
    }

    const nextRegions: WaterRegion[] = [];
    for (let i = 0; i < baseRegions.length; i++) {
      const cur = baseRegions[i];
      if (matchIds.has(cur.id)) {
        if (i === firstIdx) {
          nextRegions.push(...paintedRegions);
        }
        continue;
      }

      if (
        shouldCarveOtherBiomes &&
        cur.kind !== "chasm" &&
        brushStrokeOverlapsWaterRegion(cur, stroke, session.radiusCells)
      ) {
        const { filled, mask } = getOrRasterizeRegionMask(session, cur);
        if (filled === 0) {
          continue;
        }
        let carvedCells = 0;
        for (let k = 0; k < cellCount; k++) {
          if (mask[k] === 1 && brushOcc[k] === 1) {
            workOcc[k] = 0;
            carvedCells++;
          } else {
            workOcc[k] = mask[k];
          }
        }
        if (carvedCells > 0) {
          cleanOccupancyGrid(workOcc, g.padW, g.padH);
          const curLoops = extractManifoldLoops(
            workOcc,
            g.padW,
            g.padH,
            g.originX,
            g.originY,
            g.subDiv,
          );
          const curShapes = finalizeExtractedWaterShapes(
            curLoops,
            6,
            0.18,
            session.canvasW,
            session.canvasH,
          );
          curShapes.forEach((shape, idx) => {
            nextRegions.push({
              ...cur,
              id: idx === 0 ? cur.id : `${cur.id}-split-${session.seed}-${idx}`,
              shape: "polygon",
              curved: true,
              organicRoughness: 0,
              points: shape.points,
              cutouts: shape.cutouts.length > 0 ? shape.cutouts : undefined,
            });
          });
          continue;
        }
      }

      nextRegions.push(cur);
    }

    if (!baseReg) {
      nextRegions.push(...paintedRegions);
    }

    updates.set(session.paintLayerId, nextRegions);
    session.didMutate = true;
    return { changed: true, updates };
  }

  // Erase mode: subtract brushOcc cleanly from every overlapping region across active-floor water layers
  let anyChanged = false;
  let removed = 0;
  let updated = 0;

  for (const [layerId, baseRegions] of session.baseRegionsByLayer.entries()) {
    let layerChanged = false;
    const nextRegions: WaterRegion[] = [];

    for (const reg of baseRegions) {
      if (!brushStrokeOverlapsWaterRegion(reg, stroke, session.radiusCells)) {
        nextRegions.push(reg);
        continue;
      }
      const { filled, mask } = getOrRasterizeRegionMask(session, reg);
      if (filled === 0) {
        // Delete degenerate ultra-thin sliver cleanly!
        layerChanged = true;
        anyChanged = true;
        removed++;
        continue;
      }

      let erasedCells = 0;
      for (let i = 0; i < cellCount; i++) {
        if (mask[i] === 1 && brushOcc[i] === 1) {
          workOcc[i] = 0;
          erasedCells++;
        } else {
          workOcc[i] = mask[i];
        }
      }
      if (erasedCells === 0) {
        nextRegions.push(reg);
        continue;
      }

      layerChanged = true;
      anyChanged = true;
      cleanOccupancyGrid(workOcc, g.padW, g.padH);
      const loops = extractManifoldLoops(workOcc, g.padW, g.padH, g.originX, g.originY, g.subDiv);
      const shapes = finalizeExtractedWaterShapes(loops, 6, 0.18, session.canvasW, session.canvasH);
      if (shapes.length === 0) {
        removed++;
      } else {
        updated++;
        shapes.forEach((shape, idx) => {
          nextRegions.push({
            ...reg,
            id: idx === 0 ? reg.id : `${reg.id}-split-${session.seed}-${idx}`,
            shape: "polygon",
            curved: true,
            organicRoughness: 0,
            points: shape.points,
            cutouts: shape.cutouts.length > 0 ? shape.cutouts : undefined,
          });
        });
      }
    }

    if (layerChanged) {
      updates.set(layerId, nextRegions);
    }
  }

  if (anyChanged) {
    session.didMutate = true;
    session.removedCount = removed;
    session.updatedCount = updated;
  }
  return { changed: anyChanged, updates };
}

/**
 * Expands a river/stream centerline into a clean self-intersection-free outline
 * with rounded endcaps (supporting hairpin bends & circular moats cleanly).
 */
export function buildRiverOutline(
  centerline: Point2D[],
  widthCells: number,
  curved = true,
  organicRoughness = 0,
  seed = 17,
  segmentCurves?: Array<number | null>,
): { outer: Point2D[]; holes: Point2D[][] } {
  if (centerline.length < 2) return { outer: [], holes: [] };
  const halfW = Math.max(0.35, widthCells * 0.5);
  const sampled = sampleWallPoints(
    {
      points: centerline,
      closed: false,
      curved,
      segmentCurves,
    },
    8,
  );

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of sampled) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const grid = createLocalGrid(minX, minY, maxX, maxY, halfW * 1.4 + 1.5);
  rasterizeBrushStrokeIntoGrid(
    sampled,
    halfW,
    organicRoughness,
    seed,
    grid.occ,
    grid.padW,
    grid.gridW,
    grid.gridH,
    grid.originX,
    grid.originY,
    grid.subDiv,
    1,
  );
  cleanOccupancyGrid(grid.occ, grid.padW, grid.padH);
  const loops = extractManifoldLoops(
    grid.occ,
    grid.padW,
    grid.padH,
    grid.originX,
    grid.originY,
    grid.subDiv,
  );
  const shapes = finalizeExtractedWaterShapes(loops, 4, 0.06, 99999, 99999, 0.16, 0.25);
  if (shapes.length === 0) return { outer: [], holes: [] };
  return { outer: shapes[0].points, holes: shapes[0].cutouts };
}

/**
 * Expands a river/stream centerline into a smooth closed bank polygon with rounded endcaps.
 */
export function buildRiverPolygon(
  centerline: Point2D[],
  widthCells: number,
  curved = true,
): Point2D[] {
  return buildRiverOutline(centerline, widthCells, curved).outer;
}

/**
 * Converts a freehand Lake Brush or Island-Eraser drag path into a closed organic polygon.
 */
export function buildWaterBrushPolygon(
  strokePoints: Point2D[],
  radiusCells: number,
  organicRoughness = 0.25,
  seed = 101,
): Point2D[] {
  const shapes = buildWaterBrushShape(
    strokePoints,
    radiusCells,
    organicRoughness,
    seed,
    48,
    27,
    0.05,
  );
  return shapes[0]?.points ?? [];
}

const OUTLINE_CACHE = new WeakMap<
  WaterRegion,
  { sig: string; result: { outer: Point2D[]; holes: Point2D[][] } }
>();

function computeOutlineSignature(region: WaterRegion): string {
  const pts = region.points
    .map((p) => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`)
    .join(";");
  const curves = (region.segmentCurves ?? [])
    .map((c) => (typeof c === "number" ? Math.round(c * 1000) : ""))
    .join(",");
  const cuts = (region.cutouts ?? [])
    .map((c) => c.map((p) => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`).join(";"))
    .join("|");
  return `${region.shape ?? "polygon"}:${region.kind}:${region.widthCells ?? 2.6}:${region.curved ?? ""}:${curves}:${region.organicRoughness ?? 0}:${region.seed ?? 0}:${pts}#${cuts}`;
}

/**
 * Computes the resolved render/hit-test geometry for any WaterRegion (polygon, river, or chasm).
 */
export function computeWaterOutline(region: WaterRegion): {
  outer: Point2D[];
  holes: Point2D[][];
} {
  if (region.points.length < 2) return { outer: [], holes: [] };

  const sig = computeOutlineSignature(region);
  const cached = OUTLINE_CACHE.get(region);
  if (cached && cached.sig === sig) {
    return cached.result;
  }

  let outer: Point2D[];
  let riverHoles: Point2D[][] = [];
  if (region.shape === "river") {
    const riverOutline = buildRiverOutline(
      region.points,
      region.widthCells ?? 2.6,
      region.curved !== false,
      region.organicRoughness ?? 0,
      region.seed ?? 17,
      region.segmentCurves,
    );
    outer = riverOutline.outer;
    riverHoles = riverOutline.holes;
  } else {
    if (region.points.length < 3) return { outer: [], holes: [] };
    const useCurve = region.curved ?? region.kind !== "chasm";
    const sampled = sampleWallPoints(
      {
        points: region.points,
        closed: true,
        curved: useCurve,
        segmentCurves: region.segmentCurves,
      },
      6,
    );
    outer =
      (region.organicRoughness ?? 0) > 0.01
        ? perturbShoreline(sampled, region.organicRoughness ?? 0, region.seed ?? 31, true)
        : sampled;
  }

  const regionHoles = (region.cutouts ?? [])
    .filter((h) => h.length >= 3)
    .map((h) => sampleCatmullRom(h, 4, true));

  const result = { outer, holes: [...riverHoles, ...regionHoles] };
  OUTLINE_CACHE.set(region, { sig, result });
  return result;
}

/**
 * Hit-tests whether a map-space point lies inside a WaterRegion (excluding carved islands/cutouts).
 */
export function pointInWaterRegion(pt: Point2D, region: WaterRegion): boolean {
  const { outer, holes } = computeWaterOutline(region);
  if (outer.length < 3) return false;
  if (!pointInPolygon(pt, outer)) return false;
  for (const hole of holes) {
    if (pointInPolygon(pt, hole)) return false;
  }
  return true;
}

const UNIFIED_LAYER_OUTLINE_CACHE = new Map<
  string,
  Array<{ outer: Point2D[]; holes: Point2D[][] }>
>();

/**
 * Computes the exact set-theoretic union ⋃(outer_i \ holes_i) across all liquid
 * water regions on a single Water layer so overlapping/touching biomes share one
 * continuous outer shoreline & dry island cutouts (zero internal foam seams!).
 */
export function computeUnifiedWaterLayerOutline(
  regions: WaterRegion[],
  canvasW = 48,
  canvasH = 27,
): Array<{ outer: Point2D[]; holes: Point2D[][] }> {
  if (regions.length === 0) return [];
  if (regions.length === 1) {
    const single = computeWaterOutline(regions[0]);
    return single.outer.length >= 3 ? [single] : [];
  }

  const key = `${canvasW}x${canvasH}|${regions.map(computeOutlineSignature).join("@@")}`;
  const cached = UNIFIED_LAYER_OUTLINE_CACHE.get(key);
  if (cached) return cached;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const resolved: Array<{ outer: Point2D[]; holes: Point2D[][] }> = [];
  for (const reg of regions) {
    const o = computeWaterOutline(reg);
    if (o.outer.length < 3) continue;
    resolved.push(o);
    for (const p of o.outer) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (resolved.length === 0 || !Number.isFinite(minX)) return [];

  const grid = createLocalGrid(minX, minY, maxX, maxY, 1.5);
  const cellCount = grid.occ.length;
  const regOcc = new Uint8Array(cellCount);

  for (const o of resolved) {
    regOcc.fill(0);
    rasterizePolygonIntoGrid(
      o.outer,
      regOcc,
      grid.padW,
      grid.gridW,
      grid.gridH,
      grid.originX,
      grid.originY,
      grid.subDiv,
      1,
    );
    for (const h of o.holes) {
      rasterizePolygonIntoGrid(
        h,
        regOcc,
        grid.padW,
        grid.gridW,
        grid.gridH,
        grid.originX,
        grid.originY,
        grid.subDiv,
        0,
      );
    }
    for (let k = 0; k < cellCount; k++) {
      if (regOcc[k] === 1) grid.occ[k] = 1;
    }
  }

  cleanOccupancyGrid(grid.occ, grid.padW, grid.padH);
  const loops = extractManifoldLoops(
    grid.occ,
    grid.padW,
    grid.padH,
    grid.originX,
    grid.originY,
    grid.subDiv,
  );
  const shapes = finalizeExtractedWaterShapes(loops, 5, 0.14, canvasW, canvasH);
  const result = shapes.map((s) => ({
    outer: sampleCatmullRom(s.points, 6, true),
    holes: s.cutouts.map((h) => sampleCatmullRom(h, 4, true)),
  }));

  if (UNIFIED_LAYER_OUTLINE_CACHE.size >= 24) {
    const oldest = UNIFIED_LAYER_OUTLINE_CACHE.keys().next().value;
    if (oldest !== undefined) UNIFIED_LAYER_OUTLINE_CACHE.delete(oldest);
  }
  UNIFIED_LAYER_OUTLINE_CACHE.set(key, result);
  return result;
}

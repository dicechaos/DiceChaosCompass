import type {
  CaveDungeonSystem,
  CaveEntranceOpening,
  Point2D,
  RgbRecolor,
  WallSegment,
} from "@/types/map";
import { DEFAULT_RECOLOR } from "@/types/map";

export interface CaveThemePreset {
  id: string;
  name: string;
  shortName: string;
  kind: "cave" | "dungeon";
  floorAssetId: string;
  wallAssetId: string;
  wallThicknessCells: number;
  outerRimCells: number;
  outerRimColorHex: string;
  roughness: number;
  undergroundFill: boolean;
  undergroundColorHex: string;
  swatchHex: string;
  floorRecolor?: RgbRecolor;
  wallRecolor?: RgbRecolor;
}

export const CAVE_THEME_PRESETS: CaveThemePreset[] = [
  {
    id: "granite_cavern",
    name: "Granite Cavern",
    shortName: "Granite",
    kind: "cave",
    floorAssetId: "core-fantasy/terrain/cavern_rough_stone.png",
    wallAssetId: "modular-suite/walls/cave_granite_jagged.png",
    wallThicknessCells: 0.72,
    outerRimCells: 0.65,
    outerRimColorHex: "#3C414A",
    roughness: 0.72,
    undergroundFill: false,
    undergroundColorHex: "#0B0E14",
    swatchHex: "#6D737E",
  },
  {
    id: "mossy_grotto",
    name: "Mossy Grotto",
    shortName: "Grotto",
    kind: "cave",
    floorAssetId: "modular-suite/terrain/cave_floor_wet_grotto.png",
    wallAssetId: "modular-suite/walls/cave_mossy_grotto.png",
    wallThicknessCells: 0.74,
    outerRimCells: 0.7,
    outerRimColorHex: "#36443A",
    roughness: 0.78,
    undergroundFill: false,
    undergroundColorHex: "#09100D",
    swatchHex: "#557A58",
  },
  {
    id: "sandstone_cave",
    name: "Sandstone Canyon Cave",
    shortName: "Sandstone",
    kind: "cave",
    floorAssetId: "core-fantasy/terrain/royal_sandstone_paving.png",
    wallAssetId: "modular-suite/walls/cave_sandstone_canyon.png",
    wallThicknessCells: 0.72,
    outerRimCells: 0.65,
    outerRimColorHex: "#6E482D",
    roughness: 0.64,
    undergroundFill: false,
    undergroundColorHex: "#18100A",
    swatchHex: "#B87A4E",
  },
  {
    id: "glacial_ice",
    name: "Glacial Ice Cavern",
    shortName: "Ice Cave",
    kind: "cave",
    floorAssetId: "modular-suite/terrain/cave_floor_glacial_ice.png",
    wallAssetId: "modular-suite/walls/cave_glacial_ice.png",
    wallThicknessCells: 0.72,
    outerRimCells: 0.6,
    outerRimColorHex: "#3E6B89",
    roughness: 0.7,
    undergroundFill: false,
    undergroundColorHex: "#091520",
    swatchHex: "#7CC2E2",
  },
  {
    id: "volcanic_basalt",
    name: "Volcanic Basalt Cave",
    shortName: "Volcanic",
    kind: "cave",
    floorAssetId: "modular-suite/terrain/cave_floor_volcanic_basalt.png",
    wallAssetId: "modular-suite/walls/cave_obsidian_volcanic.png",
    wallThicknessCells: 0.76,
    outerRimCells: 0.65,
    outerRimColorHex: "#26232B",
    roughness: 0.76,
    undergroundFill: false,
    undergroundColorHex: "#0B080A",
    swatchHex: "#C94E26",
  },
  {
    id: "earth_burrow",
    name: "Earth & Root Burrow",
    shortName: "Burrow",
    kind: "cave",
    floorAssetId: "modular-suite/terrain/cave_floor_earth_burrow.png",
    wallAssetId: "modular-suite/walls/cave_earth_burrow.png",
    wallThicknessCells: 0.7,
    outerRimCells: 0.6,
    outerRimColorHex: "#4E3826",
    roughness: 0.82,
    undergroundFill: false,
    undergroundColorHex: "#120D08",
    swatchHex: "#876548",
  },
  {
    id: "stone_dungeon",
    name: "Cut-Stone Dungeon",
    shortName: "Dungeon",
    kind: "dungeon",
    floorAssetId: "core-fantasy/terrain/dungeon_flagstone.png",
    wallAssetId: "modular-suite/walls/dungeon_ashlar_cutstone.png",
    wallThicknessCells: 0.5,
    outerRimCells: 0.35,
    outerRimColorHex: "#2B303A",
    roughness: 0,
    undergroundFill: true,
    undergroundColorHex: "#0A0D13",
    swatchHex: "#8C939E",
  },
  {
    id: "sewer_crypt",
    name: "Brick Crypt & Sewer",
    shortName: "Crypt",
    kind: "dungeon",
    floorAssetId: "modular-suite/terrain/dungeon_floor_sewer_brick.png",
    wallAssetId: "walls/grunderzeit_brick_wall.png",
    wallThicknessCells: 0.5,
    outerRimCells: 0.35,
    outerRimColorHex: "#362B28",
    roughness: 0.05,
    undergroundFill: true,
    undergroundColorHex: "#0D0B0E",
    swatchHex: "#7A5248",
  },
];

export function getCaveThemePreset(themeId: string): CaveThemePreset {
  return CAVE_THEME_PRESETS.find((p) => p.id === themeId) ?? CAVE_THEME_PRESETS[0];
}

export function createDefaultCaveSystem(themeId = "granite_cavern"): CaveDungeonSystem {
  const p = getCaveThemePreset(themeId);
  return {
    id: `cave-${Date.now()}`,
    themeId: p.id,
    floorAssetId: p.floorAssetId,
    wallAssetId: p.wallAssetId,
    wallThicknessCells: p.wallThicknessCells,
    outerRimCells: p.outerRimCells,
    outerRimColorHex: p.outerRimColorHex,
    roughness: p.roughness,
    blocksLight: true,
    undergroundFill: p.undergroundFill,
    undergroundColorHex: p.undergroundColorHex,
    floorRecolor: p.floorRecolor ? { ...p.floorRecolor } : { ...DEFAULT_RECOLOR },
    wallRecolor: p.wallRecolor ? { ...p.wallRecolor } : { ...DEFAULT_RECOLOR },
    operations: [],
    entrances: [],
  };
}

export interface CaveFadeApron {
  entranceId: string;
  /** Quad/trapezoid starting slightly inside the cave mouth and extending fadeLengthCells outward */
  polygon: Point2D[];
  /** Gradient start point (opaque cave floor inside mouth) */
  gradStart: Point2D;
  /** Gradient end point (fully transparent outer tip blending into normal terrain) */
  gradEnd: Point2D;
}

export interface DerivedCaveGeometry {
  /** Closed contour loops (both outer perimeters and interior rock pillars/holes) */
  floorLoops: Point2D[][];
  /** Open or closed wall ribbons after cutting out Entrance/Exit openings */
  wallSegments: WallSegment[];
  /** Outward feathered floor transition aprons for each Entrance/Exit */
  fadeAprons: CaveFadeApron[];
  /** Sub-cell binary occupancy grid (padded by 1 cell) for fast point-inside & normal queries */
  subDiv: number;
  padW: number;
  padH: number;
  occ: Uint8Array;
}

// Fast deterministic smooth 2D noise in [-1, 1] for organic cave rock faces
function organicNoise2D(x: number, y: number, seed: number): number {
  const s = (seed % 997) * 0.137;
  const a = Math.sin(x * 1.45 + y * 0.72 + s) * Math.cos(y * 1.38 - x * 0.64 + s * 1.7);
  const b = Math.sin(x * 3.1 - y * 2.4 + s * 2.3) * 0.45;
  const c = Math.cos(x * 5.3 + y * 4.7 - s * 0.9) * 0.22;
  return (a + b + c) / 1.67;
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

function pointInSimplePoly(x: number, y: number, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const hit = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
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

function simplifyClosedLoop(pts: Point2D[], epsilon: number): Point2D[] {
  if (pts.length <= 4) return pts;
  // First remove strictly collinear consecutive points
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

  // Closed Douglas-Peucker: split at farthest vertex from index 0
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

/**
 * Extract closed boundary contours from a padded binary occupancy grid (0=outside, 1=inside).
 * Uses directed unit boundary edges around filled cells, producing exact manifold loops for
 * both outer perimeters AND interior rock pillar islands (holes).
 */
function extractBoundaryLoops(
  occ: Uint8Array,
  padW: number,
  padH: number,
  subDiv: number,
): Point2D[][] {
  // Map start vertex key -> outgoing directed edge targets
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
      // Top neighbor empty -> edge left-to-right along top of cell
      if (occ[(py - 1) * padW + px] === 0) addEdge(px, py, px + 1, py);
      // Right neighbor empty -> edge top-to-bottom along right of cell
      if (occ[py * padW + (px + 1)] === 0) addEdge(px + 1, py, px + 1, py + 1);
      // Bottom neighbor empty -> edge right-to-left along bottom of cell
      if (occ[(py + 1) * padW + px] === 0) addEdge(px + 1, py + 1, px, py + 1);
      // Left neighbor empty -> edge bottom-to-top along left of cell
      if (occ[py * padW + (px - 1)] === 0) addEdge(px, py + 1, px, py);
    }
  }

  const loops: Point2D[][] = [];
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

        // If a vertex has 2 outgoing edges (pinched corner), choose the sharpest right-turn
        // to keep exterior and hole loops cleanly non-crossing.
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
            // Right turn in screen-Y-down coordinates: cross = inDx * outDy - inDy * outDx > 0
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

      if (loopKeys.length >= 4) {
        // Subtract 1 from padded grid coordinates before dividing by subDiv
        const pts: Point2D[] = loopKeys.map((k) => ({
          x: (k % stride - 1) / subDiv,
          y: (Math.floor(k / stride) - 1) / subDiv,
        }));
        if (Math.abs(polygonSignedArea(pts)) >= 0.08) {
          loops.push(pts);
        }
      }
    }
  }

  return loops;
}

/**
 * Smooth only vertices touching organic cave strokes while leaving crisp dungeon
 * rectangle/polygon corners razor-sharp!
 */
function smoothOrganicVertices(
  pts: Point2D[],
  organicMask: Uint8Array,
  padW: number,
  padH: number,
  subDiv: number,
): Point2D[] {
  const isOrganicAt = (pt: Point2D): boolean => {
    const px = Math.max(1, Math.min(padW - 2, Math.round(pt.x * subDiv) + 1));
    const py = Math.max(1, Math.min(padH - 2, Math.round(pt.y * subDiv) + 1));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (organicMask[(py + dy) * padW + (px + dx)] === 1) return true;
      }
    }
    return false;
  };

  let cur = pts;
  // Two lightweight Laplacian/Taubin-style relaxation passes on organic vertices eliminate stair-stepping
  for (let pass = 0; pass < 2; pass++) {
    const next: Point2D[] = new Array(cur.length);
    for (let i = 0; i < cur.length; i++) {
      const p = cur[i];
      if (!isOrganicAt(p)) {
        next[i] = p;
        continue;
      }
      const prev = cur[(i - 1 + cur.length) % cur.length];
      const nxt = cur[(i + 1) % cur.length];
      next[i] = {
        x: p.x * 0.5 + (prev.x + nxt.x) * 0.25,
        y: p.y * 0.5 + (prev.y + nxt.y) * 0.25,
      };
    }
    cur = next;
  }
  return cur;
}

/**
 * Subdivide any long segments of a loop so Entrance/Exit cuts cleanly carve only the opening width.
 */
function subdivideLoop(pts: Point2D[], maxSegLen = 0.35): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    out.push(a);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist > maxSegLen) {
      const n = Math.ceil(dist / maxSegLen);
      for (let k = 1; k < n; k++) {
        const t = k / n;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  }
  return out;
}

/**
 * Split a closed contour loop wherever it passes through any CaveEntranceOpening,
 * returning clean open wall polylines (or the original closed loop if untouched).
 */
export function cutCaveLoopForEntrances(
  loop: Point2D[],
  entrances: CaveEntranceOpening[],
  wallThicknessCells: number,
): Array<{ points: Point2D[]; closed: boolean }> {
  if (entrances.length === 0) {
    return [{ points: loop, closed: true }];
  }

  const dense = subdivideLoop(loop, 0.35);
  const n = dense.length;
  const edgeCut = new Uint8Array(n);
  const normalBand = Math.max(1.1, wallThicknessCells * 1.35);

  let anyCut = false;
  for (let i = 0; i < n; i++) {
    const a = dense[i];
    const b = dense[(i + 1) % n];
    const mx = (a.x + b.x) * 0.5;
    const my = (a.y + b.y) * 0.5;

    for (const ent of entrances) {
      const nx = Math.cos(ent.normalRad);
      const ny = Math.sin(ent.normalRad);
      const tx = -ny;
      const ty = nx;
      const dx = mx - ent.x;
      const dy = my - ent.y;
      const alongNorm = Math.abs(dx * nx + dy * ny);
      const alongTan = Math.abs(dx * tx + dy * ty);
      if (alongNorm <= normalBand && alongTan <= ent.widthCells * 0.5) {
        edgeCut[i] = 1;
        anyCut = true;
        break;
      }
    }
  }

  if (!anyCut) {
    return [{ points: loop, closed: true }];
  }

  // Find a cut edge to start scanning from so no unbroken run wraps around index 0
  let startCut = -1;
  for (let i = 0; i < n; i++) {
    if (edgeCut[i] === 1) {
      startCut = i;
      break;
    }
  }
  if (startCut === -1) return [{ points: loop, closed: true }];

  const runs: Array<{ points: Point2D[]; closed: boolean }> = [];
  let curRun: Point2D[] = [];
  for (let step = 1; step <= n; step++) {
    const idx = (startCut + step) % n;
    if (edgeCut[idx] === 0) {
      if (curRun.length === 0) {
        curRun.push(dense[idx]);
      }
      curRun.push(dense[(idx + 1) % n]);
    } else if (curRun.length >= 2) {
      runs.push({ points: simplifyOpenPolyline(curRun, 0.04), closed: false });
      curRun = [];
    }
  }
  if (curRun.length >= 2) {
    runs.push({ points: simplifyOpenPolyline(curRun, 0.04), closed: false });
  }
  return runs;
}

function simplifyOpenPolyline(pts: Point2D[], epsilon: number): Point2D[] {
  if (pts.length <= 2) return pts;
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
  return rdp(pts);
}

/**
 * Compute outward feathered floor apron quad for an Entrance/Exit opening.
 */
export function buildEntranceFadeApron(ent: CaveEntranceOpening): CaveFadeApron {
  const nx = Math.cos(ent.normalRad);
  const ny = Math.sin(ent.normalRad);
  const tx = -ny;
  const ty = nx;
  const halfInner = ent.widthCells * 0.5;
  const halfOuter = ent.widthCells * 0.62;
  const inset = 0.45;
  const outLen = Math.max(0.5, ent.fadeLengthCells);

  const p0: Point2D = {
    x: ent.x - nx * inset - tx * halfInner,
    y: ent.y - ny * inset - ty * halfInner,
  };
  const p1: Point2D = {
    x: ent.x - nx * inset + tx * halfInner,
    y: ent.y - ny * inset + ty * halfInner,
  };
  const p2: Point2D = {
    x: ent.x + nx * outLen + tx * halfOuter,
    y: ent.y + ny * outLen + ty * halfOuter,
  };
  const p3: Point2D = {
    x: ent.x + nx * outLen - tx * halfOuter,
    y: ent.y + ny * outLen - ty * halfOuter,
  };

  return {
    entranceId: ent.id,
    polygon: [p0, p1, p2, p3],
    gradStart: { x: ent.x - nx * 0.2, y: ent.y - ny * 0.2 },
    gradEnd: { x: ent.x + nx * outLen, y: ent.y + ny * outLen },
  };
}

// WeakMap-backed memoization keyed by the CaveDungeonSystem object reference
const geometryCache = new WeakMap<
  CaveDungeonSystem,
  { key: string; geom: DerivedCaveGeometry }
>();

export function computeCaveGeometry(
  system: CaveDungeonSystem,
  widthCells: number,
  heightCells: number,
  layerId = "cave",
): DerivedCaveGeometry {
  const cacheKey = `${widthCells}x${heightCells}:${layerId}:${system.wallAssetId}:${system.wallThicknessCells}:${system.blocksLight}:${system.operations.length}:${system.entrances.length}`;
  const cached = geometryCache.get(system);
  if (cached && cached.key === cacheKey) {
    return cached.geom;
  }

  const subDiv = 4;
  const gw = Math.max(4, Math.ceil(widthCells * subDiv));
  const gh = Math.max(4, Math.ceil(heightCells * subDiv));
  const padW = gw + 2;
  const padH = gh + 2;
  const occ = new Uint8Array(padW * padH);
  const organicMask = new Uint8Array(padW * padH);

  const setCell = (gx: number, gy: number, value: 0 | 1, isOrganic: boolean) => {
    if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) return;
    const idx = (gy + 1) * padW + (gx + 1);
    occ[idx] = value;
    if (value === 1) {
      organicMask[idx] = isOrganic ? 1 : 0;
    } else if (isOrganic) {
      organicMask[idx] = 1;
    }
  };

  for (const op of system.operations) {
    const isErase = op.kind === "erase_brush" || op.kind === "erase_rect";
    const fillVal: 0 | 1 = isErase ? 0 : 1;
    const rough = op.organicRoughness ?? 0;
    const isOrganic = rough > 0.05;

    if (op.kind === "brush" || op.kind === "erase_brush") {
      if (op.points.length === 0) continue;
      const baseR = Math.max(0.45, op.radiusCells ?? 1.8);
      const maxR = baseR * (1 + rough * 0.42);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of op.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const x0 = Math.max(0, Math.floor((minX - maxR) * subDiv));
      const y0 = Math.max(0, Math.floor((minY - maxR) * subDiv));
      const x1 = Math.min(gw - 1, Math.ceil((maxX + maxR) * subDiv));
      const y1 = Math.min(gh - 1, Math.ceil((maxY + maxR) * subDiv));

      for (let gy = y0; gy <= y1; gy++) {
        const wy = (gy + 0.5) / subDiv;
        for (let gx = x0; gx <= x1; gx++) {
          const wx = (gx + 0.5) / subDiv;
          let minD2 = Infinity;
          if (op.points.length === 1) {
            const dx = wx - op.points[0].x;
            const dy = wy - op.points[0].y;
            minD2 = dx * dx + dy * dy;
          } else {
            for (let i = 0; i < op.points.length - 1; i++) {
              const d2 = pointToSegmentDistSq({ x: wx, y: wy }, op.points[i], op.points[i + 1]);
              if (d2 < minD2) minD2 = d2;
            }
          }
          const localR = isOrganic
            ? baseR * (1 + organicNoise2D(wx, wy, op.seed) * rough * 0.38)
            : baseR;
          if (minD2 <= localR * localR) {
            setCell(gx, gy, fillVal, isOrganic);
          }
        }
      }
    } else if (op.kind === "rect" || op.kind === "erase_rect") {
      if (op.points.length < 2) continue;
      const a = op.points[0];
      const b = op.points[1];
      const rx0 = Math.min(a.x, b.x);
      const ry0 = Math.min(a.y, b.y);
      const rx1 = Math.max(a.x, b.x);
      const ry1 = Math.max(a.y, b.y);
      const x0 = Math.max(0, Math.round(rx0 * subDiv));
      const y0 = Math.max(0, Math.round(ry0 * subDiv));
      const x1 = Math.min(gw - 1, Math.round(rx1 * subDiv) - 1);
      const y1 = Math.min(gh - 1, Math.round(ry1 * subDiv) - 1);
      for (let gy = y0; gy <= y1; gy++) {
        for (let gx = x0; gx <= x1; gx++) {
          setCell(gx, gy, fillVal, false);
        }
      }
    } else if (op.kind === "polygon") {
      if (op.points.length < 3) continue;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of op.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      const x0 = Math.max(0, Math.floor(minX * subDiv));
      const y0 = Math.max(0, Math.floor(minY * subDiv));
      const x1 = Math.min(gw - 1, Math.ceil(maxX * subDiv));
      const y1 = Math.min(gh - 1, Math.ceil(maxY * subDiv));
      for (let gy = y0; gy <= y1; gy++) {
        const wy = (gy + 0.5) / subDiv;
        for (let gx = x0; gx <= x1; gx++) {
          const wx = (gx + 0.5) / subDiv;
          if (pointInSimplePoly(wx, wy, op.points)) {
            setCell(gx, gy, fillVal, isOrganic);
          }
        }
      }
    }
  }

  const rawLoops = extractBoundaryLoops(occ, padW, padH, subDiv);
  const floorLoops: Point2D[][] = [];
  const wallSegments: WallSegment[] = [];
  let wallIdx = 0;

  for (const raw of rawLoops) {
    const smoothed = smoothOrganicVertices(raw, organicMask, padW, padH, subDiv);
    const simplified = simplifyClosedLoop(smoothed, 0.06);
    if (simplified.length < 3) continue;
    floorLoops.push(simplified);

    const pieces = cutCaveLoopForEntrances(
      simplified,
      system.entrances,
      system.wallThicknessCells,
    );
    for (const piece of pieces) {
      if (piece.points.length < 2) continue;
      wallSegments.push({
        id: `cavewall-${layerId}-${wallIdx++}`,
        assetId: system.wallAssetId,
        points: piece.points,
        closed: piece.closed,
        curved: false,
        thicknessCells: system.wallThicknessCells,
        blocksLight: system.blocksLight,
        recolor: system.wallRecolor?.enabled ? { ...system.wallRecolor } : undefined,
      });
    }
  }

  const fadeAprons = system.entrances.map(buildEntranceFadeApron);
  const geom: DerivedCaveGeometry = {
    floorLoops,
    wallSegments,
    fadeAprons,
    subDiv,
    padW,
    padH,
    occ,
  };
  geometryCache.set(system, { key: cacheKey, geom });
  return geom;
}

/**
 * Snap a cursor point to the nearest Cave/Dungeon perimeter wall and compute the exact
 * outward-pointing normal vector (from carved chamber interior -> exterior normal terrain).
 */
export function snapEntranceToCavePerimeter(
  pt: Point2D,
  geom: DerivedCaveGeometry,
  maxDistCells = 2.6,
): { x: number; y: number; normalRad: number; dist: number } | null {
  let bestDistSq = maxDistCells * maxDistCells;
  let bestX = pt.x;
  let bestY = pt.y;
  let bestSegA: Point2D | null = null;
  let bestSegB: Point2D | null = null;

  for (const loop of geom.floorLoops) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % loop.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-8) continue;
      const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq));
      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      const d2 = (pt.x - projX) * (pt.x - projX) + (pt.y - projY) * (pt.y - projY);
      if (d2 < bestDistSq) {
        bestDistSq = d2;
        bestX = projX;
        bestY = projY;
        bestSegA = a;
        bestSegB = b;
      }
    }
  }

  if (!bestSegA || !bestSegB) return null;

  // Candidate normals perpendicular to the wall edge
  const tx = bestSegB.x - bestSegA.x;
  const ty = bestSegB.y - bestSegA.y;
  const len = Math.hypot(tx, ty) || 1;
  let nx = ty / len;
  let ny = -tx / len;

  // Sample occupancy 0.45 sq on both sides so normal ALWAYS points from inside(1) -> outside(0)!
  const sampleOcc = (wx: number, wy: number): number => {
    const px = Math.round(wx * geom.subDiv) + 1;
    const py = Math.round(wy * geom.subDiv) + 1;
    if (px < 0 || py < 0 || px >= geom.padW || py >= geom.padH) return 0;
    return geom.occ[py * geom.padW + px];
  };
  const plusOcc = sampleOcc(bestX + nx * 0.45, bestY + ny * 0.45);
  const minusOcc = sampleOcc(bestX - nx * 0.45, bestY - ny * 0.45);
  if (plusOcc === 1 && minusOcc === 0) {
    nx = -nx;
    ny = -ny;
  }

  return {
    x: bestX,
    y: bestY,
    normalRad: Math.atan2(ny, nx),
    dist: Math.sqrt(bestDistSq),
  };
}

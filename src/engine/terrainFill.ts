import { computeCaveGeometry } from "@/engine/caveEngine";
import { hasWallSegmentCurves, pointInPolygon, sampleWallPoints } from "@/engine/geometry";
import { computeWaterOutline } from "@/engine/waterEngine";
import type { DcMapDocument, Point2D, TerrainStroke, WallSegment } from "@/types/map";

function sampleWallPolyline(wall: WallSegment, closedOverride?: boolean): Point2D[] {
  return sampleWallPoints(
    closedOverride !== undefined ? { ...wall, closed: closedOverride } : wall,
    12,
  );
}

export interface BarrierPolyline {
  points: Point2D[];
  closed: boolean;
}

export interface TerrainBarrierOptions {
  walls: boolean;
  caves: boolean;
  water: boolean;
}

export interface WallBarrierGrid {
  subDiv: number;
  gridW: number;
  gridH: number;
  widthCells: number;
  heightCells: number;
  blocked: Uint8Array;
  wallCount: number;
}

export interface FloodFillResult {
  outer: Point2D[];
  holes: Point2D[][];
  areaSq: number;
  boundedByWalls: boolean;
}

export type TerrainHitResult =
  | {
      kind: "stroke";
      layerId: string;
      strokeId: string;
      stroke: TerrainStroke;
      assetId: string;
    }
  | {
      kind: "base";
      assetId: string;
    };

export interface UsedTerrainSummary {
  assetId: string;
  count: number;
  isBase: boolean;
  layerIds: string[];
}

/**
 * Rasterizes a thin supercover line segment into the barrier grid so diagonal
 * walls never leak across 4-connected BFS diagonals.
 */
function rasterizeSupercover(
  blocked: Uint8Array,
  gridW: number,
  gridH: number,
  x0f: number,
  y0f: number,
  x1f: number,
  y1f: number,
) {
  const dx = x1f - x0f;
  const dy = y1f - y0f;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2.5));
  let prevIx = -1;
  let prevIy = -1;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0f + dx * t;
    const y = y0f + dy * t;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix >= 0 && ix < gridW && iy >= 0 && iy < gridH) {
      blocked[iy * gridW + ix] = 1;
      // Seal diagonal corner step so 4-connected BFS never sneaks through a corner
      if (prevIx >= 0 && prevIx !== ix && prevIy !== iy) {
        if (prevIy >= 0 && prevIy < gridH) {
          blocked[prevIy * gridW + ix] = 1;
        }
      }
    }
    prevIx = ix;
    prevIy = iy;
  }
}

function rasterizePolyline(
  blocked: Uint8Array,
  gridW: number,
  gridH: number,
  pts: Point2D[],
  closed: boolean,
  subDiv: number,
) {
  if (pts.length < 2) return;
  const segCount = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    rasterizeSupercover(
      blocked,
      gridW,
      gridH,
      a.x * subDiv,
      a.y * subDiv,
      b.x * subDiv,
      b.y * subDiv,
    );
  }
}

/**
 * Builds a fast sub-cell barrier grid for all active-floor walls plus optional
 * cave auto-walls and water/chasm shorelines. Default `subDiv = 6` delivers crisp
 * diagonal & curved flood contours with sub-4ms BFS latency.
 */
export function buildWallBarrierGrid(
  walls: WallSegment[],
  widthCells: number,
  heightCells: number,
  subDiv = 6,
  extraBarriers: BarrierPolyline[] = [],
): WallBarrierGrid {
  const gridW = Math.max(4, Math.round(widthCells * subDiv));
  const gridH = Math.max(4, Math.round(heightCells * subDiv));
  const blocked = new Uint8Array(gridW * gridH);

  for (const wall of walls) {
    if (wall.points.length < 2) continue;
    const sampled = sampleWallPolyline(wall);
    rasterizePolyline(blocked, gridW, gridH, sampled, wall.closed, subDiv);
  }

  for (const extra of extraBarriers) {
    rasterizePolyline(blocked, gridW, gridH, extra.points, extra.closed, subDiv);
  }

  return {
    subDiv,
    gridW,
    gridH,
    widthCells,
    heightCells,
    blocked,
    wallCount: walls.length + extraBarriers.length,
  };
}

/**
 * Builds a unified multi-barrier grid for the active floor combining visible
 * Walls, Cave/Dungeon perimeter walls, and Water/Chasm shorelines.
 */
export function buildFloorBarrierGrid(
  doc: DcMapDocument,
  levelId: string,
  options: TerrainBarrierOptions = { walls: true, caves: true, water: true },
  subDiv = 6,
): WallBarrierGrid {
  const walls: WallSegment[] = [];
  const extra: BarrierPolyline[] = [];

  for (const layer of doc.layers) {
    if (!layer.visible || layer.levelId !== levelId) continue;

    if (options.walls && (layer.walls?.length ?? 0) > 0) {
      walls.push(...(layer.walls ?? []));
    }

    if (
      options.caves &&
      layer.kind === "caves" &&
      layer.caveSystem &&
      layer.caveSystem.operations.length > 0
    ) {
      const geom = computeCaveGeometry(
        layer.caveSystem,
        doc.canvas.widthCells,
        doc.canvas.heightCells,
        layer.id,
      );
      for (const cw of geom.wallSegments) {
        if (cw.points.length >= 2) {
          walls.push(cw);
        }
      }
    }

    if (options.water && (layer.waterRegions?.length ?? 0) > 0) {
      for (const wr of layer.waterRegions ?? []) {
        const outline = computeWaterOutline(wr);
        if (outline.outer.length >= 3) {
          extra.push({ points: outline.outer, closed: true });
        }
        for (const hole of outline.holes) {
          if (hole.length >= 3) {
            extra.push({ points: hole, closed: true });
          }
        }
      }
    }
  }

  return buildWallBarrierGrid(
    walls,
    doc.canvas.widthCells,
    doc.canvas.heightCells,
    subDiv,
    extra,
  );
}

function signedArea(poly: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

function pointSegDistSq(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-10) {
    return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return (p.x - px) ** 2 + (p.y - py) ** 2;
}

function rdpOpen(pts: Point2D[], epsSq: number): Point2D[] {
  if (pts.length <= 2) return pts;
  const first = pts[0];
  const last = pts[pts.length - 1];
  let maxD = 0;
  let maxIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = pointSegDistSq(pts[i], first, last);
    if (d > maxD) {
      maxD = d;
      maxIdx = i;
    }
  }
  if (maxD > epsSq) {
    const left = rdpOpen(pts.slice(0, maxIdx + 1), epsSq);
    const right = rdpOpen(pts.slice(maxIdx), epsSq);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/**
 * Removes staircase zig-zags along diagonal and curved walls while preserving
 * genuine macro 90-degree room corners completely razor-sharp!
 */
function smoothStaircaseTeeth(
  pts: Point2D[],
  stepSize: number,
  widthCells: number,
  heightCells: number,
): Point2D[] {
  if (pts.length <= 4) return pts;
  const maxMicroEdge = stepSize * 2.35;
  const borderEps = stepSize * 0.25;
  let cur = pts;

  for (let pass = 0; pass < 3; pass++) {
    const n = cur.length;
    const nextPts: Point2D[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = cur[(i - 1 + n) % n];
      const p = cur[i];
      const nxt = cur[(i + 1) % n];

      // Never move vertices pinned to the outer canvas boundary
      const onCanvasEdge =
        p.x <= borderEps ||
        p.x >= widthCells - borderEps ||
        p.y <= borderEps ||
        p.y >= heightCells - borderEps;
      if (onCanvasEdge) {
        nextPts[i] = p;
        continue;
      }

      const dPrev = Math.hypot(p.x - prev.x, p.y - prev.y);
      const dNext = Math.hypot(nxt.x - p.x, nxt.y - p.y);
      // Only smooth micro grid-staircase teeth (both edges short); keep true wall corners crisp!
      if (dPrev <= maxMicroEdge && dNext <= maxMicroEdge) {
        nextPts[i] = {
          x: prev.x * 0.25 + p.x * 0.5 + nxt.x * 0.25,
          y: prev.y * 0.25 + p.y * 0.5 + nxt.y * 0.25,
        };
      } else {
        nextPts[i] = p;
      }
    }
    cur = nextPts;
  }

  return cur;
}

function simplifyClosedLoop(
  raw: Point2D[],
  epsilon: number,
  stepSize: number,
  widthCells: number,
  heightCells: number,
): Point2D[] {
  if (raw.length <= 3) return raw;
  // Pass 1: Remove strictly collinear intermediate grid-step points
  const pruned: Point2D[] = [];
  const n = raw.length;
  for (let i = 0; i < n; i++) {
    const prev = raw[(i - 1 + n) % n];
    const curr = raw[i];
    const next = raw[(i + 1) % n];
    const cross = (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x);
    if (Math.abs(cross) > 1e-6) {
      pruned.push(curr);
    }
  }
  if (pruned.length <= 4) return pruned;

  // Pass 2: Collapse diagonal & circular-arc grid staircases without rounding real 90° room corners!
  const smoothed = smoothStaircaseTeeth(pruned, stepSize, widthCells, heightCells);

  // Pass 3: Split closed loop at the two farthest vertices and run RDP on each half
  const idxA = 0;
  let idxB = Math.floor(smoothed.length / 2);
  let bestDist = -1;
  for (let i = 0; i < smoothed.length; i++) {
    const d = (smoothed[i].x - smoothed[0].x) ** 2 + (smoothed[i].y - smoothed[0].y) ** 2;
    if (d > bestDist) {
      bestDist = d;
      idxB = i;
    }
  }
  if (idxB === 0 || idxB === smoothed.length - 1) return smoothed;

  const epsSq = epsilon * epsilon;
  const h1 = rdpOpen(smoothed.slice(idxA, idxB + 1), epsSq);
  const h2 = rdpOpen([...smoothed.slice(idxB), smoothed[idxA]], epsSq);
  const merged = [...h1.slice(0, -1), ...h2.slice(0, -1)];
  return merged.length >= 3 ? merged : smoothed;
}

/**
 * Extracts closed directed boundary loops from a binary sub-cell region mask.
 * Filled cells are expanded by half a sub-cell onto adjacent wall centerlines so
 * the resulting polygon reaches right into the wall core with zero gap.
 */
function traceMaskLoops(
  mask: Uint8Array,
  gridW: number,
  gridH: number,
  subDiv: number,
): Point2D[][] {
  const stride = gridH + 1;
  const edgeMap = new Map<number, Array<{ tx: number; ty: number; dir: number; used: boolean }>>();

  const addEdge = (fx: number, fy: number, tx: number, ty: number, dir: number) => {
    const k = fx * stride + fy;
    let arr = edgeMap.get(k);
    if (!arr) {
      arr = [];
      edgeMap.set(k, arr);
    }
    arr.push({ tx, ty, dir, used: false });
  };

  const isFilled = (x: number, y: number) =>
    x >= 0 && x < gridW && y >= 0 && y < gridH && mask[y * gridW + x] === 1;

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      if (mask[y * gridW + x] !== 1) continue;
      if (!isFilled(x, y - 1)) addEdge(x, y, x + 1, y, 0);
      if (!isFilled(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1, 1);
      if (!isFilled(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1, 2);
      if (!isFilled(x - 1, y)) addEdge(x, y + 1, x, y, 3);
    }
  }

  const loops: Point2D[][] = [];
  const inv = 1 / subDiv;

  for (const [startKey, edges] of edgeMap.entries()) {
    for (const startEdge of edges) {
      if (startEdge.used) continue;
      const sx = Math.floor(startKey / stride);
      const sy = startKey % stride;
      const loop: Point2D[] = [{ x: sx * inv, y: sy * inv }];

      let curEdge = startEdge;
      let guard = 0;
      const maxSteps = gridW * gridH * 4 + 16;

      while (guard++ < maxSteps) {
        curEdge.used = true;
        const nx = curEdge.tx;
        const ny = curEdge.ty;
        if (nx === sx && ny === sy) break;
        loop.push({ x: nx * inv, y: ny * inv });

        const nextList = edgeMap.get(nx * stride + ny);
        if (!nextList) break;
        const avail = nextList.filter((e) => !e.used);
        if (avail.length === 0) break;
        if (avail.length === 1) {
          curEdge = avail[0];
        } else {
          // Prefer right-most turn at diagonal pinch vertices to keep loops simple
          const prefOrder = [
            (curEdge.dir + 1) & 3,
            curEdge.dir,
            (curEdge.dir + 3) & 3,
            (curEdge.dir + 2) & 3,
          ];
          let picked = avail[0];
          for (const pd of prefOrder) {
            const match = avail.find((e) => e.dir === pd);
            if (match) {
              picked = match;
              break;
            }
          }
          curEdge = picked;
        }
      }

      if (loop.length >= 3) {
        loops.push(loop);
      }
    }
  }

  return loops;
}

/**
 * Flood-fills from `clickPt` inside the active-floor barrier grid and returns
 * smooth vector outer contour + optional interior holes (for courtyards around buildings).
 */
export function computeSmartFloodFill(
  clickPt: Point2D,
  barrier: WallBarrierGrid,
): FloodFillResult | null {
  const { subDiv, gridW, gridH, widthCells, heightCells, blocked } = barrier;
  let sx = Math.floor(clickPt.x * subDiv);
  let sy = Math.floor(clickPt.y * subDiv);
  if (sx < 0 || sx >= gridW || sy < 0 || sy >= gridH) return null;

  // If user clicks squarely on a thin wall centerline, nudge 1 sub-cell to nearest open pixel
  if (blocked[sy * gridW + sx] === 1) {
    let found = false;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const nx = sx + ox;
      const ny = sy + oy;
      if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH && blocked[ny * gridW + nx] === 0) {
        sx = nx;
        sy = ny;
        found = true;
        break;
      }
    }
    if (!found) return null;
  }

  const total = gridW * gridH;
  const filled = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const startIdx = sy * gridW + sx;
  filled[startIdx] = 1;
  queue[tail++] = startIdx;

  let touchedTop = false;
  let touchedBottom = false;
  let touchedLeft = false;
  let touchedRight = false;

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % gridW;
    const y = (idx - x) / gridW;

    if (y === 0) touchedTop = true;
    if (y === gridH - 1) touchedBottom = true;
    if (x === 0) touchedLeft = true;
    if (x === gridW - 1) touchedRight = true;

    if (x > 0) {
      const n = idx - 1;
      if (!filled[n] && !blocked[n]) {
        filled[n] = 1;
        queue[tail++] = n;
      }
    }
    if (x < gridW - 1) {
      const n = idx + 1;
      if (!filled[n] && !blocked[n]) {
        filled[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y > 0) {
      const n = idx - gridW;
      if (!filled[n] && !blocked[n]) {
        filled[n] = 1;
        queue[tail++] = n;
      }
    }
    if (y < gridH - 1) {
      const n = idx + gridW;
      if (!filled[n] && !blocked[n]) {
        filled[n] = 1;
        queue[tail++] = n;
      }
    }
  }

  if (tail === 0) return null;

  // Dilate 1 step into immediately adjacent wall centerline pixels ONLY where blocked,
  // so filled floors tuck cleanly under wall centerlines with zero gap!
  const expanded = new Uint8Array(filled);
  for (let i = 0; i < tail; i++) {
    const idx = queue[i];
    const x = idx % gridW;
    const y = (idx - x) / gridW;
    for (let oy = -1; oy <= 1; oy++) {
      const ny = y + oy;
      if (ny < 0 || ny >= gridH) continue;
      for (let ox = -1; ox <= 1; ox++) {
        if (ox === 0 && oy === 0) continue;
        const nx = x + ox;
        if (nx < 0 || nx >= gridW) continue;
        const nidx = ny * gridW + nx;
        if (blocked[nidx]) expanded[nidx] = 1;
      }
    }
  }

  const rawLoops = traceMaskLoops(expanded, gridW, gridH, subDiv);
  if (rawLoops.length === 0) return null;

  const stepSize = 1 / subDiv;
  const eps = Math.min(0.09, 0.34 / subDiv);
  const scored = rawLoops
    .map((lp) => {
      const simp = simplifyClosedLoop(lp, eps, stepSize, widthCells, heightCells);
      return { pts: simp, area: signedArea(simp) };
    })
    .filter((x) => x.pts.length >= 3 && Math.abs(x.area) > 0.05)
    .sort((a, b) => Math.abs(b.area) - Math.abs(a.area));

  if (scored.length === 0) return null;

  const outer = scored[0].pts;
  const holes = scored.slice(1).map((h) => h.pts);
  const areaSq = tail / (subDiv * subDiv);
  const boundedByWalls = !(touchedTop && touchedBottom && touchedLeft && touchedRight);

  return {
    outer,
    holes,
    areaSq,
    boundedByWalls,
  };
}

/**
 * Creates a crisp 4-point clockwise rectangle polygon from two corner points.
 */
export function makeRectPolygon(a: Point2D, b: Point2D): Point2D[] {
  const x0 = Math.min(a.x, b.x);
  const y0 = Math.min(a.y, b.y);
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * Extracts a crisp vector polygon directly from a wall's closed contour
 * (preserving both legacy Catmull-Rom curvature and per-segment circular arcs!).
 */
export function makeClosedWallPolygon(wall: WallSegment): Point2D[] {
  if (wall.points.length < 3) return [];
  return sampleWallPolyline(wall, true);
}

/**
 * Resolves the effective sampled outer contour for a polygon `TerrainStroke`
 * (honoring optional `segmentCurves` when present!).
 */
export function sampleTerrainStrokePolygon(stroke: TerrainStroke): Point2D[] {
  if (stroke.shape !== "polygon" || stroke.points.length < 3) return stroke.points;
  if (hasWallSegmentCurves(stroke)) {
    return sampleWallPoints(
      {
        points: stroke.points,
        closed: true,
        curved: false,
        segmentCurves: stroke.segmentCurves,
      },
      12,
    );
  }
  return stroke.points;
}

/**
 * Accurate geometric hit-test for a single `TerrainStroke` (polygon with holes OR brush capsule).
 */
export function pointInTerrainStroke(pt: Point2D, stroke: TerrainStroke): boolean {
  if (stroke.points.length === 0) return false;
  if (stroke.shape === "polygon") {
    if (stroke.points.length < 3) return false;
    const outer = sampleTerrainStrokePolygon(stroke);
    if (!pointInPolygon(pt, outer)) return false;
    if (stroke.holes) {
      for (const hole of stroke.holes) {
        if (hole.length >= 3 && pointInPolygon(pt, hole)) {
          return false;
        }
      }
    }
    return true;
  }

  const r = Math.max(0.2, stroke.radiusCells);
  const rSq = r * r;
  if (stroke.points.length === 1) {
    const p = stroke.points[0];
    return (pt.x - p.x) ** 2 + (pt.y - p.y) ** 2 <= rSq;
  }
  const maxConnectDist = stroke.continuous ? Infinity : r * 1.65;
  for (let i = 0; i < stroke.points.length; i++) {
    const a = stroke.points[i];
    if ((pt.x - a.x) ** 2 + (pt.y - a.y) ** 2 <= rSq) return true;
    if (i > 0) {
      const prev = stroke.points[i - 1];
      if (Math.hypot(a.x - prev.x, a.y - prev.y) <= maxConnectDist) {
        if (pointSegDistSq(pt, prev, a) <= rSq) return true;
      }
    }
  }
  return false;
}

/**
 * Finds the topmost visible painted/filled terrain stroke under `pt` on `levelId`
 * (respecting layer-scoped `erase` cutouts!), or falls back to the 1F Map Base.
 */
export function hitTestTerrainAtPoint(
  pt: Point2D,
  doc: DcMapDocument,
  levelId: string,
): TerrainHitResult | null {
  if (
    pt.x < 0 ||
    pt.y < 0 ||
    pt.x > doc.canvas.widthCells ||
    pt.y > doc.canvas.heightCells
  ) {
    return null;
  }

  // Scan top-to-bottom across visible unlocked terrain layers on this floor
  for (let li = doc.layers.length - 1; li >= 0; li--) {
    const layer = doc.layers[li];
    if (!layer.visible || layer.locked || layer.kind !== "terrain" || layer.levelId !== levelId) {
      continue;
    }
    const strokes = layer.terrainStrokes ?? [];
    for (let si = strokes.length - 1; si >= 0; si--) {
      const st = strokes[si];
      if (!pointInTerrainStroke(pt, st)) continue;
      if (st.erase) {
        // Cutout punched through THIS layer — stop checking older strokes on this layer!
        break;
      }
      return {
        kind: "stroke",
        layerId: layer.id,
        strokeId: st.id,
        stroke: st,
        assetId: st.assetId,
      };
    }
  }

  const level = doc.levels.find((lv) => lv.id === levelId);
  if ((!level || level.kind === "ground") && !doc.canvas.baseTerrainTransparent) {
    return {
      kind: "base",
      assetId: doc.canvas.baseTerrainAssetId,
    };
  }
  return null;
}

/**
 * Returns true if an existing painted terrain stroke sits completely inside the given
 * flood contour (and outside its holes) so Smart Fill with "Clean Replace" can prune
 * buried duplicate room fills instead of stacking dead polygons!
 */
export function isTerrainStrokeCoveredByFlood(
  stroke: TerrainStroke,
  outer: Point2D[],
  holes: Point2D[][],
): boolean {
  if (stroke.erase || stroke.points.length === 0 || outer.length < 3) return false;
  const pts = stroke.shape === "polygon" ? sampleTerrainStrokePolygon(stroke) : stroke.points;
  // Require every vertex (and centroid for polygons) to sit inside `outer` (with tiny edge tolerance)
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  const center = { x: cx, y: cy };
  if (!pointInPolygon(center, outer)) return false;
  for (const h of holes) {
    if (h.length >= 3 && pointInPolygon(center, h)) return false;
  }

  // Pull test points 4% toward centroid so vertices hugging the shared wall centerline still count as covered!
  for (const p of pts) {
    const insetPt = {
      x: p.x + (cx - p.x) * 0.04,
      y: p.y + (cy - p.y) * 0.04,
    };
    if (!pointInPolygon(insetPt, outer)) return false;
    for (const h of holes) {
      if (h.length >= 3 && pointInPolygon(insetPt, h)) return false;
    }
  }
  return true;
}

/**
 * Lists distinct terrain textures currently used on the active layer or active floor,
 * ordered by frequency (plus Map Base on 1F when active).
 */
export function summarizeUsedTerrains(
  doc: DcMapDocument,
  levelId: string,
  targetLayerId?: string | null,
): UsedTerrainSummary[] {
  const byAsset = new Map<string, { count: number; isBase: boolean; layerIds: Set<string> }>();

  for (const layer of doc.layers) {
    if (layer.kind !== "terrain" || layer.levelId !== levelId) continue;
    if (targetLayerId && layer.id !== targetLayerId) continue;
    for (const s of layer.terrainStrokes ?? []) {
      if (s.erase || !s.assetId) continue;
      let entry = byAsset.get(s.assetId);
      if (!entry) {
        entry = { count: 0, isBase: false, layerIds: new Set() };
        byAsset.set(s.assetId, entry);
      }
      entry.count++;
      entry.layerIds.add(layer.id);
    }
  }

  const level = doc.levels.find((lv) => lv.id === levelId);
  if (!targetLayerId && (!level || level.kind === "ground") && !doc.canvas.baseTerrainTransparent) {
    const baseId = doc.canvas.baseTerrainAssetId;
    if (baseId) {
      const existing = byAsset.get(baseId);
      if (existing) {
        existing.isBase = true;
      } else {
        byAsset.set(baseId, { count: 0, isBase: true, layerIds: new Set() });
      }
    }
  }

  return Array.from(byAsset.entries())
    .map(([assetId, info]) => ({
      assetId,
      count: info.count,
      isBase: info.isBase,
      layerIds: Array.from(info.layerIds),
    }))
    .sort((a, b) => b.count - a.count || (a.isBase ? 1 : -1));
}

import { sampleCatmullRom } from "@/engine/geometry";
import type { Point2D, WallSegment } from "@/types/map";

function sampleWallPolyline(points: Point2D[], closed: boolean, curved: boolean): Point2D[] {
  if (curved && points.length >= 3) {
    return sampleCatmullRom(points, 12, closed);
  }
  return points;
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

/**
 * Builds a fast sub-cell wall centerline barrier grid for all active-floor walls.
 * Because barriers sit strictly on the 1-subcell wall centerline, the resulting
 * flooded polygon tucks cleanly underneath rendered walls with zero gap and zero bleed!
 */
export function buildWallBarrierGrid(
  walls: WallSegment[],
  widthCells: number,
  heightCells: number,
  subDiv = 4,
): WallBarrierGrid {
  const gridW = Math.max(4, Math.round(widthCells * subDiv));
  const gridH = Math.max(4, Math.round(heightCells * subDiv));
  const blocked = new Uint8Array(gridW * gridH);

  for (const wall of walls) {
    if (wall.points.length < 2) continue;
    const sampled = sampleWallPolyline(wall.points, wall.closed, wall.curved);
    const segCount = wall.closed ? sampled.length : sampled.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = sampled[i];
      const b = sampled[(i + 1) % sampled.length];
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

  return {
    subDiv,
    gridW,
    gridH,
    widthCells,
    heightCells,
    blocked,
    wallCount: walls.length,
  };
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

function simplifyClosedLoop(raw: Point2D[], epsilon: number): Point2D[] {
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

  // Pass 2: Split closed loop at the two farthest vertices and run RDP on each half
  let idxA = 0;
  let idxB = Math.floor(pruned.length / 2);
  let bestDist = -1;
  for (let i = 0; i < pruned.length; i++) {
    const d = (pruned[i].x - pruned[0].x) ** 2 + (pruned[i].y - pruned[0].y) ** 2;
    if (d > bestDist) {
      bestDist = d;
      idxB = i;
    }
  }
  if (idxB === 0 || idxB === pruned.length - 1) return pruned;

  const epsSq = epsilon * epsilon;
  const h1 = rdpOpen(pruned.slice(idxA, idxB + 1), epsSq);
  const h2 = rdpOpen([...pruned.slice(idxB), pruned[idxA]], epsSq);
  const merged = [...h1.slice(0, -1), ...h2.slice(0, -1)];
  return merged.length >= 3 ? merged : pruned;
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
  // Directed unit boundary edges around filled pixels:
  // Key = vx * (gridH + 1) + vy, storing outgoing edges (toX, toY, dir)
  // dir: 0=Right (+x), 1=Down (+y), 2=Left (-x), 3=Up (-y)
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
 * Flood-fills from `clickPt` inside the active-floor wall barrier grid and returns
 * clean vector outer contour + optional interior holes (for courtyards around buildings).
 */
export function computeSmartFloodFill(
  clickPt: Point2D,
  barrier: WallBarrierGrid,
): FloodFillResult | null {
  const { subDiv, gridW, gridH, blocked } = barrier;
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

  // Dilate into immediately adjacent wall centerline pixels (including corner intersections)
  // ONLY where blocked, so the filled floor meets exact 90-degree wall corners with zero gap!
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

  const eps = Math.min(0.11, 0.36 / subDiv);
  const scored = rawLoops
    .map((lp) => {
      const simp = simplifyClosedLoop(lp, eps);
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
 * (preserving Catmull-Rom curvature when `wall.curved` is true).
 */
export function makeClosedWallPolygon(wall: WallSegment): Point2D[] {
  if (wall.points.length < 3) return [];
  return sampleWallPolyline(wall.points, true, wall.curved);
}

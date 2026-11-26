import { computeCaveGeometry } from "@/engine/caveEngine";
import type {
  DcMapDocument,
  LightNode,
  ObjectStamp,
  Point2D,
  PortalNode,
  ScatterPlacement,
  ScatterZone,
  SplinePath,
  TvCalibration,
  WallSegment,
} from "@/types/map";

export interface Segment2D {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

/**
 * Exact 1-inch physical tabletop TV calibration matching DiceChaosDisplay.
 * For a 55" 4K UHD TV (3840x2160): exactPpi = 80.11, grid = 48x27 physical inches.
 */
export function computeTvCalibration(
  diagonalInches: number,
  resolutionWidth: number,
  resolutionHeight: number,
): TvCalibration {
  const diagPx = Math.hypot(resolutionWidth, resolutionHeight);
  const exactPpi = diagPx / Math.max(1, diagonalInches);
  const physicalWidthInches = resolutionWidth / exactPpi;
  const physicalHeightInches = resolutionHeight / exactPpi;
  return {
    diagonalInches,
    resolutionWidth,
    resolutionHeight,
    exactPpi: Math.round(exactPpi * 100) / 100,
    physicalWidthInches: Math.round(physicalWidthInches * 100) / 100,
    physicalHeightInches: Math.round(physicalHeightInches * 100) / 100,
    recommendedGridCols: Math.round(physicalWidthInches),
    recommendedGridRows: Math.round(physicalHeightInches),
  };
}

export function snapPoint(
  pt: Point2D,
  mode: "grid" | "half" | "free",
): Point2D {
  if (mode === "free") return pt;
  const step = mode === "grid" ? 1 : 0.5;
  return {
    x: Math.round(pt.x / step) * step,
    y: Math.round(pt.y / step) * step,
  };
}

export function distSq(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function distanceToSegment(
  p: Point2D,
  a: Point2D,
  b: Point2D,
): { dist: number; t: number; closest: Point2D } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 1e-8) {
    t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  }
  const closest = { x: a.x + t * dx, y: a.y + t * dy };
  return { dist: Math.hypot(p.x - closest.x, p.y - closest.y), t, closest };
}

/**
 * Computes minimum distance from a query point to a polyline/spline (for selecting placed Walls & Paths).
 */
export function distanceToPolyline(
  p: Point2D,
  points: Point2D[],
  closed = false,
  curved = false,
): { dist: number; segmentIndex: number; closest: Point2D } {
  if (points.length === 0) {
    return { dist: Infinity, segmentIndex: -1, closest: { x: 0, y: 0 } };
  }
  if (points.length === 1) {
    return { dist: Math.hypot(p.x - points[0].x, p.y - points[0].y), segmentIndex: 0, closest: points[0] };
  }
  const sampled = curved && points.length >= 3 ? sampleCatmullRom(points, 8, closed) : points;
  const count = closed ? sampled.length : sampled.length - 1;
  let bestDist = Infinity;
  let bestIdx = 0;
  let bestClosest = sampled[0];
  for (let i = 0; i < count; i++) {
    const a = sampled[i];
    const b = sampled[(i + 1) % sampled.length];
    const hit = distanceToSegment(p, a, b);
    if (hit.dist < bestDist) {
      bestDist = hit.dist;
      bestIdx = i;
      bestClosest = hit.closest;
    }
  }
  return { dist: bestDist, segmentIndex: bestIdx, closest: bestClosest };
}

/**
 * Smooth Centripetal Catmull-Rom spline sampling (alpha = 0.5, Barry-Goldman).
 * Guarantees zero cusps or self-intersecting overshoot loops even when long
 * straight edges sit next to short corner segments.
 */
export function sampleCatmullRom(
  points: Point2D[],
  subdivisionsPerSegment = 10,
  closed = false,
): Point2D[] {
  if (points.length < 3) return [...points];
  const out: Point2D[] = [];
  const n = points.length;
  const segCount = closed ? n : n - 1;

  for (let i = 0; i < segCount; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p0 = closed
      ? points[(i - 1 + n) % n]
      : i > 0
        ? points[i - 1]
        : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
    const p3 = closed
      ? points[(i + 2) % n]
      : i + 2 < n
        ? points[i + 2]
        : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };

    const dt0 = Math.max(1e-4, Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y)));
    const dt1 = Math.max(1e-4, Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y)));
    const dt2 = Math.max(1e-4, Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y)));
    const t0 = 0;
    const t1 = dt0;
    const t2 = t1 + dt1;
    const t3 = t2 + dt2;
    const inv10 = 1 / (t1 - t0);
    const inv21 = 1 / (t2 - t1);
    const inv32 = 1 / (t3 - t2);
    const inv20 = 1 / (t2 - t0);
    const inv31 = 1 / (t3 - t1);

    for (let s = 0; s < subdivisionsPerSegment; s++) {
      if (s === 0) {
        out.push({ x: p1.x, y: p1.y });
        continue;
      }
      const t = t1 + (s / subdivisionsPerSegment) * (t2 - t1);

      const a1x = ((t1 - t) * p0.x + (t - t0) * p1.x) * inv10;
      const a1y = ((t1 - t) * p0.y + (t - t0) * p1.y) * inv10;
      const a2x = ((t2 - t) * p1.x + (t - t1) * p2.x) * inv21;
      const a2y = ((t2 - t) * p1.y + (t - t1) * p2.y) * inv21;
      const a3x = ((t3 - t) * p2.x + (t - t2) * p3.x) * inv32;
      const a3y = ((t3 - t) * p2.y + (t - t2) * p3.y) * inv32;

      const b1x = ((t2 - t) * a1x + (t - t0) * a2x) * inv20;
      const b1y = ((t2 - t) * a1y + (t - t0) * a2y) * inv20;
      const b2x = ((t3 - t) * a2x + (t - t1) * a3x) * inv31;
      const b2y = ((t3 - t) * a2y + (t - t1) * a3y) * inv31;

      const cx = ((t2 - t) * b1x + (t - t1) * b2x) * inv21;
      const cy = ((t2 - t) * b1y + (t - t1) * b2y) * inv21;
      out.push({ x: cx, y: cy });
    }
  }
  if (!closed) {
    out.push(points[n - 1]);
  }
  return out;
}

export interface WallSegmentArcInfo {
  curved: boolean;
  sagitta: number;
  chord: number;
  chordMid: Point2D;
  normal: Point2D;
  apex: Point2D;
  center: Point2D;
  radius: number;
  angStart: number;
  sweepRad: number;
  sweepDeg: number;
}

export function getWallSegmentCount(points: Point2D[], closed: boolean): number {
  if (points.length < 2) return 0;
  return closed ? points.length : points.length - 1;
}

export function hasWallSegmentCurves(
  wall: Pick<WallSegment, "segmentCurves"> | null | undefined,
): boolean {
  return Boolean(
    wall?.segmentCurves &&
      wall.segmentCurves.some((v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) >= 0.04),
  );
}

/**
 * Normalizes a wall's per-edge `segmentCurves` array so its length matches the
 * exact edge count and returns `undefined` when every edge is razor-straight.
 */
export function normalizeWallSegmentCurves(
  pointsLength: number,
  closed: boolean,
  curves?: Array<number | null> | null,
): Array<number | null> | undefined {
  if (!curves || curves.length === 0) return undefined;
  const segCount = pointsLength < 2 ? 0 : closed ? pointsLength : pointsLength - 1;
  if (segCount === 0) return undefined;
  let anyCurved = false;
  const out: Array<number | null> = new Array(segCount).fill(null);
  for (let i = 0; i < segCount; i++) {
    const v = curves[i];
    if (typeof v === "number" && Number.isFinite(v) && Math.abs(v) >= 0.04) {
      out[i] = Math.round(v * 1000) / 1000;
      anyCurved = true;
    }
  }
  return anyCurved ? out : undefined;
}

/**
 * Computes exact circular-arc geometry for a single wall section `a -> b` with
 * signed perpendicular sagitta (bulge in grid cells along the left normal).
 */
export function getWallSegmentArcInfo(
  a: Point2D,
  b: Point2D,
  sagittaRaw: number | null | undefined,
): WallSegmentArcInfo {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  const chordMid: Point2D = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  const nx = chord > 1e-6 ? -dy / chord : 0;
  const ny = chord > 1e-6 ? dx / chord : -1;

  const raw = typeof sagittaRaw === "number" && Number.isFinite(sagittaRaw) ? sagittaRaw : 0;
  const maxSagitta = chord * 1.15;
  const clamped = Math.max(-maxSagitta, Math.min(maxSagitta, raw));

  if (chord < 1e-4 || Math.abs(clamped) < 0.04) {
    return {
      curved: false,
      sagitta: 0,
      chord,
      chordMid,
      normal: { x: nx, y: ny },
      apex: chordMid,
      center: chordMid,
      radius: Infinity,
      angStart: 0,
      sweepRad: 0,
      sweepDeg: 0,
    };
  }

  const absS = Math.abs(clamped);
  const sign = clamped >= 0 ? 1 : -1;
  const halfChord = chord * 0.5;
  const radius = (absS * absS + halfChord * halfChord) / (2 * absS);
  const centerDist = radius - absS;
  const cx = chordMid.x - nx * sign * centerDist;
  const cy = chordMid.y - ny * sign * centerDist;

  const apex: Point2D = {
    x: chordMid.x + nx * clamped,
    y: chordMid.y + ny * clamped,
  };
  const angStart = Math.atan2(a.y - cy, a.x - cx);
  const angEnd = Math.atan2(b.y - cy, b.x - cx);
  const angApex = Math.atan2(apex.y - cy, apex.x - cx);

  const normPos = (ang: number) => ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const ccwEnd = normPos(angEnd - angStart);
  const ccwApex = normPos(angApex - angStart);
  const sweepRad = ccwApex <= ccwEnd ? ccwEnd : -(Math.PI * 2 - ccwEnd);

  return {
    curved: true,
    sagitta: clamped,
    chord,
    chordMid,
    normal: { x: nx, y: ny },
    apex,
    center: { x: cx, y: cy },
    radius,
    angStart,
    sweepRad,
    sweepDeg: Math.round((Math.abs(sweepRad) * 180) / Math.PI),
  };
}

/**
 * Samples a single wall edge `a -> b` as either 2 endpoints (straight) or a smooth
 * exact circular arc passing through `a`, the bulge apex, and `b`.
 */
export function sampleWallSegmentArc(
  a: Point2D,
  b: Point2D,
  sagittaRaw: number | null | undefined,
  subdivisionsPerQuarter = 8,
): Point2D[] {
  const info = getWallSegmentArcInfo(a, b, sagittaRaw);
  if (!info.curved) return [a, b];

  const steps = Math.max(
    4,
    Math.min(28, Math.ceil((Math.abs(info.sweepRad) / (Math.PI * 0.5)) * subdivisionsPerQuarter)),
  );
  const out: Point2D[] = [a];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const ang = info.angStart + info.sweepRad * t;
    out.push({
      x: info.center.x + Math.cos(ang) * info.radius,
      y: info.center.y + Math.sin(ang) * info.radius,
    });
  }
  out.push(b);
  return out;
}

/**
 * Canonical wall polyline sampler used across rendering, portal snapping/carving,
 * 2D lighting/VTT occluders, flood-fill room barriers, hit-testing, and wall splitting.
 * - Evaluates edge-by-edge whenever `wall.segmentCurves` has any curved section
 *   (keeping straight sections razor-straight with crisp corners!).
 * - Preserves 100% backward compatibility with legacy whole-wall `curved: true` splines.
 */
export function sampleWallPoints(
  wall: Pick<WallSegment, "points" | "closed" | "curved" | "segmentCurves">,
  subdivisions = 8,
): Point2D[] {
  const pts = wall.points;
  if (pts.length < 2) return [...pts];

  if (hasWallSegmentCurves(wall)) {
    const segCount = getWallSegmentCount(pts, wall.closed);
    const out: Point2D[] = [];
    for (let i = 0; i < segCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const segPts = sampleWallSegmentArc(a, b, wall.segmentCurves?.[i], subdivisions);
      for (let k = 0; k < segPts.length - 1; k++) {
        out.push(segPts[k]);
      }
    }
    if (!wall.closed) {
      out.push(pts[pts.length - 1]);
    }
    return out;
  }

  if (wall.curved && pts.length >= 3) {
    return sampleCatmullRom(pts, subdivisions, wall.closed);
  }

  return pts;
}

/**
 * Computes an intelligent default outward sagitta for curving a wall edge
 * (always bowing outward on closed rooms regardless of CW/CCW vertex order).
 */
export function computeDefaultWallEdgeBulge(
  wall: Pick<WallSegment, "points" | "closed">,
  segIdx: number,
  preset: "90" | "180" = "90",
): number {
  const pts = wall.points;
  const segCount = getWallSegmentCount(pts, wall.closed);
  if (segIdx < 0 || segIdx >= segCount) return 0;
  const a = pts[segIdx];
  const b = pts[(segIdx + 1) % pts.length];
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (chord < 0.1) return 0;

  // Determine outward sign using signed polygon area when closed (or 3+ points)
  let sign = 1;
  if (wall.closed && pts.length >= 3) {
    let area2 = 0;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      area2 += p0.x * p1.y - p1.x * p0.y;
    }
    // Left normal (-dy, dx) points INSIDE for CCW (area2 > 0 in screen coords +Y down: CW has area2 > 0!)
    // Wait: screen coords (+X right, +Y down):
    // Square (0,0)->(4,0)->(4,4)->(0,4): area2 = (0-0)+(16-0)+(16-0)+(0-0) = +32 > 0.
    // Edge 0 (0,0)->(4,0): dx=4, dy=0 -> left normal (-dy, dx) = (0, +4) which points DOWN (INSIDE!).
    // So when area2 > 0, outward is -normal (sign = -1); when area2 < 0, outward is +normal (sign = +1).
    if (Math.abs(area2) > 1e-4) {
      sign = area2 > 0 ? -1 : 1;
    }
  }
  const ratio = preset === "180" ? 0.5 : 0.20710678;
  return Math.round(sign * chord * ratio * 1000) / 1000;
}

/**
 * Clamps and optionally snaps a user-dragged sagitta to flat straight (0),
 * exact 90° quarter-arch, or exact 180° semicircle.
 */
export function snapWallSegmentSagitta(
  chord: number,
  rawSagitta: number,
  snapPreset = false,
): number {
  if (chord < 0.1) return 0;
  const maxSagitta = chord * 1.15;
  let s = Math.max(-maxSagitta, Math.min(maxSagitta, rawSagitta));
  if (snapPreset) {
    const sign = s < 0 ? -1 : 1;
    const absS = Math.abs(s);
    const presets = [0, chord * 0.20710678, chord * 0.5];
    let best = presets[0];
    let bestDiff = Infinity;
    for (const p of presets) {
      const diff = Math.abs(absS - p);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = p;
      }
    }
    s = sign * best;
  } else if (Math.abs(s) < Math.min(0.14, chord * 0.04)) {
    return 0;
  }
  return Math.round(s * 1000) / 1000;
}

/**
 * Computes minimum distance from `p` to a WallSegment, returning the TRUE
 * control-point edge index `segmentIndex` (`0 .. segCount - 1`) even when
 * edges are individually curved or the wall uses a Catmull-Rom spline!
 */
export function distanceToWall(
  p: Point2D,
  wall: Pick<WallSegment, "points" | "closed" | "curved" | "segmentCurves">,
): { dist: number; segmentIndex: number; t: number; closest: Point2D } {
  const pts = wall.points;
  if (pts.length === 0) {
    return { dist: Infinity, segmentIndex: -1, t: 0, closest: { x: 0, y: 0 } };
  }
  if (pts.length === 1) {
    return { dist: Math.hypot(p.x - pts[0].x, p.y - pts[0].y), segmentIndex: 0, t: 0, closest: pts[0] };
  }
  const segCount = getWallSegmentCount(pts, wall.closed);
  const useSegCurves = hasWallSegmentCurves(wall);
  const useLegacySpline = !useSegCurves && wall.curved && pts.length >= 3;
  const splineSub = 8;
  const legacyPts = useLegacySpline ? sampleCatmullRom(pts, splineSub, wall.closed) : null;

  let bestDist = Infinity;
  let bestSeg = 0;
  let bestT = 0;
  let bestClosest = pts[0];

  for (let i = 0; i < segCount; i++) {
    let subPts: Point2D[];
    if (useSegCurves) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      subPts = sampleWallSegmentArc(a, b, wall.segmentCurves?.[i], 8);
    } else if (legacyPts) {
      const start = i * splineSub;
      subPts = [];
      for (let k = 0; k <= splineSub; k++) {
        subPts.push(legacyPts[(start + k) % legacyPts.length]);
      }
    } else {
      subPts = [pts[i], pts[(i + 1) % pts.length]];
    }

    const pieceCount = subPts.length - 1;
    for (let k = 0; k < pieceCount; k++) {
      const hit = distanceToSegment(p, subPts[k], subPts[k + 1]);
      if (hit.dist < bestDist) {
        bestDist = hit.dist;
        bestSeg = i;
        bestT = (k + hit.t) / Math.max(1, pieceCount);
        bestClosest = hit.closest;
      }
    }
  }
  return { dist: bestDist, segmentIndex: bestSeg, t: bestT, closest: bestClosest };
}

/**
 * Converts a legacy whole-wall `curved: true` Catmull-Rom wall into explicit
 * per-segment `segmentCurves` by projecting each spline edge midpoint onto its chord normal.
 * Allows straightening or re-curving a SINGLE section without disturbing the remaining edges!
 */
export function convertLegacyWallCurveToSegments(
  wall: Pick<WallSegment, "points" | "closed" | "curved" | "segmentCurves">,
): Array<number | null> {
  const segCount = getWallSegmentCount(wall.points, wall.closed);
  const out: Array<number | null> = new Array(segCount).fill(null);
  if (segCount === 0) return out;
  if (hasWallSegmentCurves(wall)) {
    for (let i = 0; i < segCount; i++) {
      const v = wall.segmentCurves?.[i];
      out[i] = typeof v === "number" && Number.isFinite(v) && Math.abs(v) >= 0.04 ? v : null;
    }
    return out;
  }
  if (!wall.curved || wall.points.length < 3) return out;

  const sampled = sampleCatmullRom(wall.points, 2, wall.closed);
  for (let i = 0; i < segCount; i++) {
    const a = wall.points[i];
    const b = wall.points[(i + 1) % wall.points.length];
    const cm = sampled[i * 2 + 1];
    if (!cm) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const chord = Math.hypot(dx, dy);
    if (chord < 0.05) continue;
    const nx = -dy / chord;
    const ny = dx / chord;
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y) * 0.5;
    const sagitta = (cm.x - midX) * nx + (cm.y - midY) * ny;
    if (Math.abs(sagitta) >= 0.04) {
      out[i] = Math.round(sagitta * 1000) / 1000;
    }
  }
  return out;
}

/**
 * Inserts a new vertex along edge `edgeIndex` (`points[edgeIndex] -> points[edgeIndex + 1]`)
 * while keeping `segmentCurves` synchronized (straightening the two newly split halves cleanly).
 */
export function insertWallVertexWithCurves(
  wall: Pick<WallSegment, "points" | "closed" | "segmentCurves">,
  edgeIndex: number,
  newPoint: Point2D,
): { points: Point2D[]; segmentCurves: Array<number | null> | undefined } {
  const nextPts = wall.points.map((pt) => ({ ...pt }));
  const insertAt = edgeIndex + 1;
  nextPts.splice(insertAt, 0, { ...newPoint });
  if (!hasWallSegmentCurves(wall)) {
    return { points: nextPts, segmentCurves: undefined };
  }
  const oldSegCount = getWallSegmentCount(wall.points, wall.closed);
  const nextCurves: Array<number | null> = [];
  for (let i = 0; i < oldSegCount; i++) {
    if (i === edgeIndex) {
      nextCurves.push(null, null);
    } else {
      nextCurves.push(wall.segmentCurves?.[i] ?? null);
    }
  }
  return {
    points: nextPts,
    segmentCurves: normalizeWallSegmentCurves(nextPts.length, wall.closed, nextCurves),
  };
}

/**
 * Removes vertex `vertexIndex` from a wall while keeping `segmentCurves` synchronized
 * (the newly bridged spanning edge resets cleanly to straight).
 */
export function removeWallVertexWithCurves(
  wall: Pick<WallSegment, "points" | "closed" | "segmentCurves">,
  vertexIndex: number,
): { points: Point2D[]; segmentCurves: Array<number | null> | undefined } {
  const n = wall.points.length;
  if (n <= 2 || vertexIndex < 0 || vertexIndex >= n) {
    return { points: wall.points.map((p) => ({ ...p })), segmentCurves: wall.segmentCurves };
  }
  const nextPts = wall.points.filter((_, idx) => idx !== vertexIndex).map((pt) => ({ ...pt }));
  if (!hasWallSegmentCurves(wall)) {
    return { points: nextPts, segmentCurves: undefined };
  }
  const oldCurves = wall.segmentCurves ?? [];
  const oldSegCount = getWallSegmentCount(wall.points, wall.closed);
  const nextSegCount = getWallSegmentCount(nextPts, wall.closed);
  const nextCurves: Array<number | null> = new Array(nextSegCount).fill(null);

  for (let newEdge = 0; newEdge < nextSegCount; newEdge++) {
    const startNewIdx = newEdge;
    const endNewIdx = (newEdge + 1) % nextPts.length;
    const startOldIdx = startNewIdx >= vertexIndex ? startNewIdx + 1 : startNewIdx;
    const endOldIdx = endNewIdx >= vertexIndex ? endNewIdx + 1 : endNewIdx;
    // If this edge existed identically in the original wall (adjacent old indices), preserve its curve!
    if ((startOldIdx + 1) % n === endOldIdx && startOldIdx < oldSegCount) {
      nextCurves[newEdge] = oldCurves[startOldIdx] ?? null;
    } else {
      nextCurves[newEdge] = null;
    }
  }
  return {
    points: nextPts,
    segmentCurves: normalizeWallSegmentCurves(nextPts.length, wall.closed, nextCurves),
  };
}

export interface PortalSnapResult {
  wallId: string;
  x: number;
  y: number;
  rotationRad: number;
  dist: number;
}

/**
 * Finds the nearest wall segment to snap a Door/Window/Gate portal and align its tangent angle.
 */
export function findNearestWallSnap(
  point: Point2D,
  walls: WallSegment[],
  maxDistCells = 1.25,
): PortalSnapResult | null {
  let best: PortalSnapResult | null = null;
  for (const wall of walls) {
    const pts = sampleWallPoints(wall, 6);
    const count = wall.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const hit = distanceToSegment(point, a, b);
      if (hit.dist <= maxDistCells && (!best || hit.dist < best.dist)) {
        best = {
          wallId: wall.id,
          x: hit.closest.x,
          y: hit.closest.y,
          rotationRad: Math.atan2(b.y - a.y, b.x - a.x),
          dist: hit.dist,
        };
      }
    }
  }
  return best;
}

/**
 * Splits a wall's geometric segments cleanly around EVERY portal sitting on it
 * so doors, windows, gates, and hatches physically inset flush into the wall masonry
 * with crisp openings rather than rendering on top of uncut solid stone.
 */
export function cutWallSegmentsForPortals(
  wall: WallSegment,
  portals: PortalNode[],
): Array<[Point2D, Point2D]> {
  if (wall.points.length < 2) return [];
  const pts = sampleWallPoints(wall, 8);
  const count = wall.closed ? pts.length : pts.length - 1;
  const result: Array<[Point2D, Point2D]> = [];

  for (let i = 0; i < count; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    if (segLen < 1e-5) continue;

    const cuts: Array<[number, number]> = [];
    for (const p of portals) {
      const hit = distanceToSegment({ x: p.x, y: p.y }, a, b);
      if (hit.dist < Math.max(0.45, wall.thicknessCells * 1.15)) {
        // Inset slightly tighter than full portal frame so jambs seat snugly against masonry
        const halfT = (p.widthCells * 0.44) / segLen;
        cuts.push([Math.max(0, hit.t - halfT), Math.min(1, hit.t + halfT)]);
      }
    }

    if (cuts.length === 0) {
      result.push([a, b]);
      continue;
    }

    cuts.sort((u, v) => u[0] - v[0]);
    let cursor = 0;
    for (const [c0, c1] of cuts) {
      if (c0 > cursor + 1e-4) {
        result.push([
          { x: a.x + (b.x - a.x) * cursor, y: a.y + (b.y - a.y) * cursor },
          { x: a.x + (b.x - a.x) * c0, y: a.y + (b.y - a.y) * c0 },
        ]);
      }
      cursor = Math.max(cursor, c1);
    }
    if (cursor < 1 - 1e-4) {
      result.push([
        { x: a.x + (b.x - a.x) * cursor, y: a.y + (b.y - a.y) * cursor },
        b,
      ]);
    }
  }
  return result;
}

/**
 * Extracts raw light-blocking wall segments, cutting holes wherever an OPEN portal
 * (or window that lets light pass) sits along that wall segment.
 */
export function extractLightOccluders(
  walls: WallSegment[],
  portals: PortalNode[],
): Segment2D[] {
  const segments: Segment2D[] = [];
  const openPortals = portals.filter((p) => !p.closed || !p.blocksLightWhenClosed);

  for (const wall of walls) {
    if (!wall.blocksLight || wall.points.length < 2) continue;
    const pts = sampleWallPoints(wall, 6);
    const count = wall.closed ? pts.length : pts.length - 1;

    for (let i = 0; i < count; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const segLen = Math.hypot(b.x - a.x, b.y - a.y);
      if (segLen < 1e-5) continue;

      // Find any open portals intersecting this segment and compute cut intervals [t0, t1]
      const cuts: Array<[number, number]> = [];
      for (const p of openPortals) {
        const hit = distanceToSegment({ x: p.x, y: p.y }, a, b);
        if (hit.dist < 0.45) {
          const halfT = (p.widthCells * 0.5) / segLen;
          cuts.push([Math.max(0, hit.t - halfT), Math.min(1, hit.t + halfT)]);
        }
      }

      if (cuts.length === 0) {
        segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
        continue;
      }

      cuts.sort((u, v) => u[0] - v[0]);
      let cursor = 0;
      for (const [c0, c1] of cuts) {
        if (c0 > cursor + 1e-4) {
          segments.push({
            ax: a.x + (b.x - a.x) * cursor,
            ay: a.y + (b.y - a.y) * cursor,
            bx: a.x + (b.x - a.x) * c0,
            by: a.y + (b.y - a.y) * c0,
          });
        }
        cursor = Math.max(cursor, c1);
      }
      if (cursor < 1 - 1e-4) {
        segments.push({
          ax: a.x + (b.x - a.x) * cursor,
          ay: a.y + (b.y - a.y) * cursor,
          bx: b.x,
          by: b.y,
        });
      }
    }
  }
  return segments;
}

function raySegmentIntersect(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  seg: Segment2D,
): number | null {
  const sx = seg.bx - seg.ax;
  const sy = seg.by - seg.ay;
  const denom = dx * sy - dy * sx;
  if (Math.abs(denom) < 1e-9) return null;
  const qpx = seg.ax - ox;
  const qpy = seg.ay - oy;
  const t = (qpx * sy - qpy * sx) / denom;
  const u = (qpx * dy - qpy * dx) / denom;
  if (t >= 0 && u >= -1e-4 && u <= 1 + 1e-4) {
    return t;
  }
  return null;
}

/**
 * Computes a 2D wall-occluded visibility polygon for a point or directional cone light.
 * Uses angular ray sweeps toward wall endpoints +/- epsilon + uniform radial samples for smooth radius falloff.
 */
export function computeVisibilityPolygon(
  light: LightNode,
  occluders: Segment2D[],
  radialSamples = 64,
): Point2D[] {
  const ox = light.x;
  const oy = light.y;
  const r = Math.max(0.25, light.radiusCells);

  // Filter nearby segments within bounding radius
  const near = occluders.filter((s) => {
    const minX = Math.min(s.ax, s.bx) - r;
    const maxX = Math.max(s.ax, s.bx) + r;
    const minY = Math.min(s.ay, s.by) - r;
    const maxY = Math.max(s.ay, s.by) + r;
    return ox >= minX && ox <= maxX && oy >= minY && oy <= maxY;
  });

  const isCone = light.coneAngleDeg < 355;
  const halfCone = ((light.coneAngleDeg * Math.PI) / 180) * 0.5;
  const startAngle = isCone ? light.directionRad - halfCone : -Math.PI;
  const endAngle = isCone ? light.directionRad + halfCone : Math.PI;

  const angles: number[] = [];
  const steps = isCone ? Math.max(16, Math.round((radialSamples * light.coneAngleDeg) / 360)) : radialSamples;
  for (let i = 0; i <= steps; i++) {
    angles.push(startAngle + ((endAngle - startAngle) * i) / steps);
  }

  if (light.castShadows) {
    for (const s of near) {
      for (const [px, py] of [
        [s.ax, s.ay],
        [s.bx, s.by],
      ]) {
        let a = Math.atan2(py - oy, px - ox);
        if (isCone) {
          // Wrap relative to directionRad
          let diff = a - light.directionRad;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) > halfCone) continue;
          a = light.directionRad + diff;
        }
        angles.push(a - 0.0004, a, a + 0.0004);
      }
    }
  }

  angles.sort((a, b) => a - b);

  const polygon: Point2D[] = [];
  if (isCone) {
    polygon.push({ x: ox, y: oy });
  }

  for (const ang of angles) {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let minDist = r;
    if (light.castShadows) {
      for (const seg of near) {
        const hit = raySegmentIntersect(ox, oy, dx, dy, seg);
        if (hit !== null && hit < minDist) {
          minDist = hit;
        }
      }
    }
    polygon.push({ x: ox + dx * minDist, y: oy + dy * minDist });
  }

  return polygon;
}

export function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Deterministic Mulberry32 PRNG for reproducible Smart Scatter Zones */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Poisson-disc Smart Scatter Zone generator with wall, curved-wall,
 * doorway/portal, path, and placed-object collision avoidance.
 */
export function generateScatterPlacements(
  zone: Pick<
    ScatterZone,
    | "polygon"
    | "assetIds"
    | "seed"
    | "minSpacingCells"
    | "minScale"
    | "maxScale"
    | "avoidWalls"
    | "avoidPaths"
  >,
  walls: WallSegment[],
  paths: SplinePath[],
  portals: PortalNode[] = [],
  objects: ObjectStamp[] = [],
): ScatterPlacement[] {
  if (zone.polygon.length < 3 || zone.assetIds.length === 0) return [];
  const rng = mulberry32(zone.seed);
  const spacing = Math.max(0.45, zone.minSpacingCells);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of zone.polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // Pre-sample wall polylines (including curved walls) and solid blocking objects once
  const sampledWalls = zone.avoidWalls
    ? walls
        .filter((w) => w.points.length >= 2)
        .map((w) => ({
          pts: sampleWallPoints(w, 6),
          closed: w.closed,
          clearance: w.thicknessCells * 0.5 + 0.65,
        }))
    : [];

  const doorwayPortals = zone.avoidWalls
    ? portals.filter((p) => p.kind !== "window")
    : [];

  const sampledPaths = zone.avoidPaths
    ? paths
        .filter((path) => path.blocksScatter && path.points.length >= 2)
        .map((path) => ({
          pts: sampleWallPoints(
            {
              points: path.points,
              closed: false,
              curved: path.curved !== false,
              segmentCurves: path.segmentCurves,
            },
            5,
          ),
          clearance: path.widthCells * 0.5 + 0.55,
        }))
    : [];

  const solidObjects = objects.filter((o) => {
    const aid = o.assetId.toLowerCase();
    return !(
      aid.includes("rug") ||
      aid.includes("carpet") ||
      aid.includes("viaduct") ||
      aid.includes("pylon") ||
      aid.includes("puddle") ||
      aid.includes("drain") ||
      aid.includes("manhole") ||
      aid.includes("spill")
    );
  });

  const candidates: Point2D[] = [];
  const area = Math.max(1, (maxX - minX) * (maxY - minY));
  const maxAttempts = Math.min(2400, Math.ceil((area / (spacing * spacing)) * 18));

  const collidesObstacle = (pt: Point2D): boolean => {
    for (const w of sampledWalls) {
      const count = w.closed ? w.pts.length : w.pts.length - 1;
      for (let i = 0; i < count; i++) {
        const d = distanceToSegment(pt, w.pts[i], w.pts[(i + 1) % w.pts.length]).dist;
        if (d < w.clearance) return true;
      }
    }
    for (const portal of doorwayPortals) {
      const doorwayClearance = portal.widthCells * 0.5 + 1.15;
      if (Math.hypot(pt.x - portal.x, pt.y - portal.y) < doorwayClearance) return true;
    }
    for (const path of sampledPaths) {
      for (let i = 0; i < path.pts.length - 1; i++) {
        const d = distanceToSegment(pt, path.pts[i], path.pts[i + 1]).dist;
        if (d < path.clearance) return true;
      }
    }
    for (const o of solidObjects) {
      const halfW = o.widthCells * 0.5;
      const halfH = o.heightCells * 0.5;
      const dx = Math.max(0, Math.abs(pt.x - o.x) - halfW);
      const dy = Math.max(0, Math.abs(pt.y - o.y) - halfH);
      if (Math.hypot(dx, dy) < 0.55) return true;
    }
    return false;
  };

  for (let i = 0; i < maxAttempts; i++) {
    const pt = {
      x: minX + rng() * (maxX - minX),
      y: minY + rng() * (maxY - minY),
    };
    if (!pointInPolygon(pt, zone.polygon)) continue;
    if (collidesObstacle(pt)) continue;

    let tooClose = false;
    for (const c of candidates) {
      if (distSq(pt, c) < spacing * spacing) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      candidates.push(pt);
    }
  }

  return candidates.map((pt) => {
    const assetId = zone.assetIds[Math.floor(rng() * zone.assetIds.length)];
    const scale = zone.minScale + rng() * Math.max(0, zone.maxScale - zone.minScale);
    return {
      assetId,
      x: Math.round(pt.x * 1000) / 1000,
      y: Math.round(pt.y * 1000) / 1000,
      scale: Math.round(scale * 1000) / 1000,
      rotationRad: Math.round(rng() * Math.PI * 2 * 1000) / 1000,
      flipX: rng() > 0.5,
    };
  });
}

/**
 * Serializes a Universal VTT (.dd2vtt / .uvtt) payload compatible with Foundry VTT & Roll20.
 */
export function buildUvttPayload(
  doc: DcMapDocument,
  base64PngPayload: string,
  pixelsPerGrid: number,
  includeLights = true,
) {
  const walls: Array<Array<{ x: number; y: number }>> = [];
  const portals: Array<{
    position: { x: number; y: number };
    bounds: [{ x: number; y: number }, { x: number; y: number }];
    rotation: number;
    closed: boolean;
    freestanding: boolean;
  }> = [];
  const lights: Array<{
    position: { x: number; y: number };
    range: number;
    intensity: number;
    color: string;
    shadows: boolean;
  }> = [];

  for (const layer of doc.layers) {
    if (!layer.visible || layer.dmOnly) continue;
    const layerPortals = layer.portals ?? [];
    for (const w of layer.walls ?? []) {
      if (!w.blocksLight || w.points.length < 2) continue;
      // Carve doorway/window openings out of VTT line-of-sight walls so Foundry/Roll20 doors work!
      const carved = cutWallSegmentsForPortals(w, layerPortals);
      for (const [sa, sb] of carved) {
        walls.push([
          { x: sa.x, y: sa.y },
          { x: sb.x, y: sb.y },
        ]);
      }
    }
    // Include live Cave & Dungeon auto-generated walls (already cut cleanly at Entrance/Exit openings!)
    if (layer.kind === "caves" && layer.caveSystem && layer.caveSystem.blocksLight && layer.caveSystem.operations.length > 0) {
      const allFloorPortals = doc.layers
        .filter((l) => l.visible && !l.dmOnly && l.levelId === layer.levelId)
        .flatMap((l) => l.portals ?? []);
      const geom = computeCaveGeometry(
        layer.caveSystem,
        doc.canvas.widthCells,
        doc.canvas.heightCells,
        layer.id,
      );
      for (const cw of geom.wallSegments) {
        const carved = cutWallSegmentsForPortals(cw, allFloorPortals);
        for (const [sa, sb] of carved) {
          walls.push([
            { x: sa.x, y: sa.y },
            { x: sb.x, y: sb.y },
          ]);
        }
      }
    }
    for (const p of layerPortals) {
      const dx = (Math.cos(p.rotationRad) * p.widthCells) / 2;
      const dy = (Math.sin(p.rotationRad) * p.widthCells) / 2;
      portals.push({
        position: { x: p.x, y: p.y },
        bounds: [
          { x: p.x - dx, y: p.y - dy },
          { x: p.x + dx, y: p.y + dy },
        ],
        rotation: p.rotationRad,
        closed: p.closed,
        freestanding: !p.wallId,
      });
    }
    if (includeLights) {
      for (const l of layer.lights ?? []) {
        lights.push({
          position: { x: l.x, y: l.y },
          range: l.radiusCells,
          intensity: l.intensity,
          color: `ff${l.colorHex.replace("#", "").toLowerCase()}`,
          shadows: l.castShadows,
        });
      }
    }
  }

  return {
    format: 0.3,
    resolution: {
      map_origin: { x: 0, y: 0 },
      map_size: { x: doc.canvas.widthCells, y: doc.canvas.heightCells },
      pixels_per_grid: Math.round(pixelsPerGrid),
    },
    line_of_sight: walls,
    objects_line_of_sight: [],
    portals,
    environment: {
      baked_lighting: doc.lighting.enabled,
      ambient_light: `ff${doc.lighting.ambientColorHex.replace("#", "").toLowerCase()}`,
    },
    lights,
    image: base64PngPayload,
  };
}

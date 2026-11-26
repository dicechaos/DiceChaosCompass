import {
  distanceToSegment,
  getWallSegmentArcInfo,
  getWallSegmentCount,
  hasWallSegmentCurves,
  normalizeWallSegmentCurves,
  sampleCatmullRom,
  sampleWallPoints,
} from "@/engine/geometry";
import type {
  MapLayer,
  Point2D,
  WallPolygonShape,
  WallSegment,
} from "@/types/map";

export interface BoxWallResult {
  points: Point2D[];
  width: number;
  height: number;
  center: Point2D;
  rotationDeg: number;
}

export interface CircleWallResult {
  points: Point2D[];
  curved: boolean;
  radiusX: number;
  radiusY: number;
}

export interface ThreePointArcResult {
  points: Point2D[];
  curved: boolean;
  radius: number;
  sweepDeg: number;
  sagitta: number;
}

export interface CorridorWallsResult {
  walls: Array<{ points: Point2D[]; closed: boolean; curved: boolean }>;
  floorPolygon: Point2D[];
}

export interface WallSnapTarget {
  point: Point2D;
  kind: "vertex" | "edge";
  wallId: string;
  dist: number;
}

export interface WallCutHit {
  layerId: string;
  wall: WallSegment;
  point: Point2D;
  arcLength: number;
  totalLength: number;
  tangentRad: number;
  dist: number;
}

function signedPolyArea(pts: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum * 0.5;
}

function roundPt(p: Point2D): Point2D {
  return {
    x: Math.round(p.x * 1000) / 1000,
    y: Math.round(p.y * 1000) / 1000,
  };
}

/**
 * Builds a crisp 4-corner clockwise Box / Rectangular room wall polygon,
 * supporting Square lock (Shift), Center-Out drawing (Ctrl), and angled
 * city-street rotation (`rotationDeg` via Q/E or Shift+Wheel).
 */
export function buildBoxWallPoints(
  start: Point2D,
  end: Point2D,
  opts?: { square?: boolean; fromCenter?: boolean; rotationDeg?: number },
): BoxWallResult | null {
  const rotDeg = ((opts?.rotationDeg ?? 0) % 360 + 360) % 360;
  const rad = (rotDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const vx = -uy;
  const vy = ux;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let du = dx * ux + dy * uy;
  let dv = dx * vx + dy * vy;

  if (opts?.square) {
    const side = Math.max(Math.abs(du), Math.abs(dv));
    du = (du < 0 ? -1 : 1) * side;
    dv = (dv < 0 ? -1 : 1) * side;
  }

  let corners: Point2D[];
  let width: number;
  let height: number;
  let center: Point2D;

  if (opts?.fromCenter) {
    const hx = Math.abs(du);
    const hy = Math.abs(dv);
    width = hx * 2;
    height = hy * 2;
    if (width < 0.25 || height < 0.25) return null;
    center = { x: start.x, y: start.y };
    corners = [
      { x: center.x - hx * ux - hy * vx, y: center.y - hx * uy - hy * vy },
      { x: center.x + hx * ux - hy * vx, y: center.y + hx * uy - hy * vy },
      { x: center.x + hx * ux + hy * vx, y: center.y + hx * uy + hy * vy },
      { x: center.x - hx * ux + hy * vx, y: center.y - hx * uy + hy * vy },
    ];
  } else {
    width = Math.abs(du);
    height = Math.abs(dv);
    if (width < 0.25 || height < 0.25) return null;
    center = {
      x: start.x + 0.5 * du * ux + 0.5 * dv * vx,
      y: start.y + 0.5 * du * uy + 0.5 * dv * vy,
    };
    corners = [
      { x: start.x, y: start.y },
      { x: start.x + du * ux, y: start.y + du * uy },
      { x: start.x + du * ux + dv * vx, y: start.y + du * uy + dv * vy },
      { x: start.x + dv * vx, y: start.y + dv * vy },
    ];
  }

  // Ensure consistent clockwise screen-space winding (positive signed area in Y-down grid)
  if (signedPolyArea(corners) < 0) {
    corners.reverse();
  }

  return {
    points: corners.map(roundPt),
    width,
    height,
    center: roundPt(center),
    rotationDeg: rotDeg,
  };
}

/**
 * Builds a closed circular, oval, or regular polygonal tower/turret wall loop.
 * Matches Roof Studio's cone facets (Round, 6 Hex, 8 Octagon, 12 Dodecagon) 1:1.
 */
export function buildCircleOrPolygonWallPoints(
  center: Point2D,
  edgePt: Point2D,
  shape: WallPolygonShape,
  opts?: { rotationDeg?: number; snapRadiusStep?: number },
): CircleWallResult | null {
  const rotRad = ((opts?.rotationDeg ?? 0) * Math.PI) / 180;
  const step = opts?.snapRadiusStep ?? 0;
  const snapVal = (v: number) => (step > 0 ? Math.round(v / step) * step : v);

  if (shape === "oval") {
    const cos = Math.cos(-rotRad);
    const sin = Math.sin(-rotRad);
    const dx = edgePt.x - center.x;
    const dy = edgePt.y - center.y;
    const rx = snapVal(Math.abs(dx * cos - dy * sin));
    const ry = snapVal(Math.abs(dx * sin + dy * cos));
    if (rx < 0.25 || ry < 0.25) return null;
    const count = 16;
    const rCos = Math.cos(rotRad);
    const rSin = Math.sin(rotRad);
    const pts: Point2D[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const lx = Math.cos(a) * rx;
      const ly = Math.sin(a) * ry;
      pts.push(
        roundPt({
          x: center.x + lx * rCos - ly * rSin,
          y: center.y + lx * rSin + ly * rCos,
        }),
      );
    }
    return { points: pts, curved: true, radiusX: rx, radiusY: ry };
  }

  const rawR = Math.hypot(edgePt.x - center.x, edgePt.y - center.y);
  const r = snapVal(rawR);
  if (r < 0.3) return null;

  const isRound = shape === "round";
  const sides =
    shape === "hex" ? 6 : shape === "octagon" ? 8 : shape === "dodecagon" ? 12 : 16;
  // Octagons default flat-top (classic fortress turret); hex/dodecagon align cleanly with cardinal axes
  const baseOffset = shape === "octagon" ? Math.PI / 8 : -Math.PI / 2;
  const startAngle = baseOffset + rotRad;

  const pts: Point2D[] = [];
  for (let i = 0; i < sides; i++) {
    const a = startAngle + (i / sides) * Math.PI * 2;
    pts.push(
      roundPt({
        x: center.x + Math.cos(a) * r,
        y: center.y + Math.sin(a) * r,
      }),
    );
  }
  return { points: pts, curved: isRound, radiusX: r, radiusY: r };
}

/**
 * Builds an exact circular arc wall passing through `start`, `end`, and the
 * perpendicular bulge point derived from `bulgeHandle` (for bay windows,
 * cathedral apses, amphitheaters, and curved street facades).
 */
export function buildThreePointArcWallPoints(
  start: Point2D,
  end: Point2D,
  bulgeHandle: Point2D,
  opts?: { snapArcPreset?: boolean },
): ThreePointArcResult | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 0.25) return null;

  const midX = (start.x + end.x) * 0.5;
  const midY = (start.y + end.y) * 0.5;
  const nx = -dy / chord;
  const ny = dx / chord;

  let sagitta = (bulgeHandle.x - midX) * nx + (bulgeHandle.y - midY) * ny;
  // Clamp extreme bulge so we stay within <= 260° clean architectural arcs
  const maxSagitta = chord * 1.15;
  sagitta = Math.max(-maxSagitta, Math.min(maxSagitta, sagitta));

  if (opts?.snapArcPreset) {
    const sign = sagitta < 0 ? -1 : 1;
    const absS = Math.abs(sagitta);
    const presets = [0, chord * 0.20710678, chord * 0.5]; // Straight, 90° quarter-arc, 180° semicircle
    let best = presets[0];
    let bestDiff = Infinity;
    for (const p of presets) {
      const d = Math.abs(absS - p);
      if (d < bestDiff) {
        bestDiff = d;
        best = p;
      }
    }
    sagitta = sign * best;
  }

  if (Math.abs(sagitta) < 0.08) {
    return {
      points: [roundPt(start), roundPt(end)],
      curved: false,
      radius: Infinity,
      sweepDeg: 0,
      sagitta: 0,
    };
  }

  const halfChord = chord * 0.5;
  const absS = Math.abs(sagitta);
  const sign = sagitta >= 0 ? 1 : -1;
  const radius = (absS * absS + halfChord * halfChord) / (2 * absS);
  const centerDist = radius - absS;
  // Circle center sits on the OPPOSITE side of the chord from the bulge apex when absS < halfChord
  const cx = midX - nx * sign * centerDist;
  const cy = midY - ny * sign * centerDist;

  const angStart = Math.atan2(start.y - cy, start.x - cx);
  const angEnd = Math.atan2(end.y - cy, end.x - cx);
  const apexX = midX + nx * sagitta;
  const apexY = midY + ny * sagitta;
  const angApex = Math.atan2(apexY - cy, apexX - cx);

  // Determine signed sweep from angStart -> angEnd that passes through angApex
  const normPos = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const ccwEnd = normPos(angEnd - angStart);
  const ccwApex = normPos(angApex - angStart);
  const sweepRad = ccwApex <= ccwEnd ? ccwEnd : -(Math.PI * 2 - ccwEnd);

  const segCount = Math.max(4, Math.min(16, Math.ceil(Math.abs(sweepRad) / (Math.PI / 8))));
  const pts: Point2D[] = [];
  for (let i = 0; i <= segCount; i++) {
    const t = i / segCount;
    const a = angStart + sweepRad * t;
    pts.push(
      roundPt({
        x: cx + Math.cos(a) * radius,
        y: cy + Math.sin(a) * radius,
      }),
    );
  }
  // Pin exact start & end so snapped wall junctions never drift by 0.001
  pts[0] = roundPt(start);
  pts[pts.length - 1] = roundPt(end);

  return {
    points: pts,
    curved: true,
    radius,
    sweepDeg: Math.round((Math.abs(sweepRad) * 180) / Math.PI),
    sagitta,
  };
}

/**
 * Builds parallel corridor/hallway walls at `widthCells` spacing from a centerline polyline.
 * Supports mitered L/T turns, optional Catmull-Rom curvature, optional sealed end caps,
 * and returns the enclosed interior `floorPolygon` for Auto-Fill Closed Rooms.
 */
export function buildCorridorWalls(
  centerline: Point2D[],
  widthCells: number,
  opts?: { curved?: boolean; capEnds?: boolean },
): CorridorWallsResult | null {
  if (centerline.length < 2) return null;
  const halfW = Math.max(0.4, widthCells * 0.5);
  const rawPts =
    opts?.curved && centerline.length >= 3
      ? sampleCatmullRom(centerline, 8, false)
      : centerline;

  // Deduplicate near-identical consecutive points
  const pts: Point2D[] = [rawPts[0]];
  for (let i = 1; i < rawPts.length; i++) {
    const prev = pts[pts.length - 1];
    if (Math.hypot(rawPts[i].x - prev.x, rawPts[i].y - prev.y) > 1e-3) {
      pts.push(rawPts[i]);
    }
  }
  if (pts.length < 2) return null;

  const leftPts: Point2D[] = [];
  const rightPts: Point2D[] = [];

  for (let i = 0; i < pts.length; i++) {
    let nx = 0;
    let ny = 0;
    let miterScale = 1;

    if (i === 0) {
      const dx = pts[1].x - pts[0].x;
      const dy = pts[1].y - pts[0].y;
      const len = Math.max(1e-6, Math.hypot(dx, dy));
      nx = -dy / len;
      ny = dx / len;
    } else if (i === pts.length - 1) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const len = Math.max(1e-6, Math.hypot(dx, dy));
      nx = -dy / len;
      ny = dx / len;
    } else {
      const d1x = pts[i].x - pts[i - 1].x;
      const d1y = pts[i].y - pts[i - 1].y;
      const l1 = Math.max(1e-6, Math.hypot(d1x, d1y));
      const n1x = -d1y / l1;
      const n1y = d1x / l1;

      const d2x = pts[i + 1].x - pts[i].x;
      const d2y = pts[i + 1].y - pts[i].y;
      const l2 = Math.max(1e-6, Math.hypot(d2x, d2y));
      const n2x = -d2y / l2;
      const n2y = d2x / l2;

      const bx = n1x + n2x;
      const by = n1y + n2y;
      const bLen = Math.hypot(bx, by);
      if (bLen < 1e-4) {
        nx = n1x;
        ny = n1y;
      } else {
        nx = bx / bLen;
        ny = by / bLen;
        const dot = nx * n1x + ny * n1y;
        miterScale = dot > 0.25 ? Math.min(2.4, 1 / dot) : 2.4;
      }
    }

    const offset = halfW * miterScale;
    leftPts.push(roundPt({ x: pts[i].x + nx * offset, y: pts[i].y + ny * offset }));
    rightPts.push(roundPt({ x: pts[i].x - nx * offset, y: pts[i].y - ny * offset }));
  }

  const floorPolygon = [...leftPts, ...[...rightPts].reverse()];
  if (opts?.capEnds) {
    return {
      walls: [{ points: floorPolygon, closed: true, curved: false }],
      floorPolygon,
    };
  }
  return {
    walls: [
      { points: leftPts, closed: false, curved: false },
      { points: rightPts, closed: false, curved: false },
    ],
    floorPolygon,
  };
}

/**
 * Locks `(target - anchor)` to the nearest 45° architectural increment (0°, 45°, 90°, ...).
 */
export function constrainAngle45Deg(anchor: Point2D, target: Point2D): Point2D {
  const dx = target.x - anchor.x;
  const dy = target.y - anchor.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-5) return { ...target };
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  const locked = Math.round(ang / step) * step;
  return roundPt({
    x: anchor.x + Math.cos(locked) * len,
    y: anchor.y + Math.sin(locked) * len,
  });
}

/**
 * Finds the nearest existing wall corner (highest priority) or wall edge
 * within `maxDistCells` for airtight architectural T-junctions & room joins.
 */
export function findWallSnapTarget(
  point: Point2D,
  walls: WallSegment[],
  maxDistCells = 0.45,
): WallSnapTarget | null {
  let bestVertex: WallSnapTarget | null = null;
  for (const wall of walls) {
    for (const pt of wall.points) {
      const dist = Math.hypot(point.x - pt.x, point.y - pt.y);
      if (dist <= maxDistCells && (!bestVertex || dist < bestVertex.dist)) {
        bestVertex = { point: { x: pt.x, y: pt.y }, kind: "vertex", wallId: wall.id, dist };
      }
    }
  }
  // Prefer vertex/corner snap whenever reasonably close so corners never miss
  if (bestVertex) return bestVertex;

  let bestEdge: WallSnapTarget | null = null;
  for (const wall of walls) {
    if (wall.points.length < 2) continue;
    const pts = sampleWallPoints(wall, 8);
    const segCount = wall.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const hit = distanceToSegment(point, a, b);
      if (hit.dist <= maxDistCells && (!bestEdge || hit.dist < bestEdge.dist)) {
        bestEdge = {
          point: roundPt(hit.closest),
          kind: "edge",
          wallId: wall.id,
          dist: hit.dist,
        };
      }
    }
  }
  return bestEdge;
}

function getWallWorkingPolyline(wall: WallSegment): Point2D[] {
  if (wall.points.length < 2) return [...wall.points];
  return sampleWallPoints(wall, 8).map((p) => ({ ...p }));
}

interface ExactWallPiece {
  a: Point2D;
  b: Point2D;
  sagitta: number;
  length: number;
  startS: number;
  endS: number;
}

function buildExactWallPieces(wall: WallSegment): { pieces: ExactWallPiece[]; total: number } | null {
  // Only use exact analytical piece splitting when the wall is straight or uses per-segment arcs
  // (legacy whole-wall Catmull-Rom walls continue using sampled polyline splitting!)
  if (wall.curved && !hasWallSegmentCurves(wall) && wall.points.length >= 3) {
    return null;
  }
  const pts = wall.points;
  const segCount = getWallSegmentCount(pts, wall.closed);
  if (segCount === 0) return null;
  const pieces: ExactWallPiece[] = [];
  let acc = 0;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const info = getWallSegmentArcInfo(a, b, wall.segmentCurves?.[i]);
    const len = info.curved ? info.radius * Math.abs(info.sweepRad) : info.chord;
    pieces.push({
      a,
      b,
      sagitta: info.curved ? info.sagitta : 0,
      length: len,
      startS: acc,
      endS: acc + len,
    });
    acc += len;
  }
  return { pieces, total: acc };
}

function sliceExactPiece(
  piece: ExactWallPiece,
  u0: number,
  u1: number,
): { a: Point2D; b: Point2D; sagitta: number } | null {
  const c0 = Math.max(0, Math.min(1, u0));
  const c1 = Math.max(0, Math.min(1, u1));
  if (c1 - c0 < 1e-4) return null;
  if (Math.abs(piece.sagitta) < 0.04) {
    return {
      a: roundPt({
        x: piece.a.x + (piece.b.x - piece.a.x) * c0,
        y: piece.a.y + (piece.b.y - piece.a.y) * c0,
      }),
      b: roundPt({
        x: piece.a.x + (piece.b.x - piece.a.x) * c1,
        y: piece.a.y + (piece.b.y - piece.a.y) * c1,
      }),
      sagitta: 0,
    };
  }
  const info = getWallSegmentArcInfo(piece.a, piece.b, piece.sagitta);
  if (!info.curved) {
    return {
      a: roundPt({
        x: piece.a.x + (piece.b.x - piece.a.x) * c0,
        y: piece.a.y + (piece.b.y - piece.a.y) * c0,
      }),
      b: roundPt({
        x: piece.a.x + (piece.b.x - piece.a.x) * c1,
        y: piece.a.y + (piece.b.y - piece.a.y) * c1,
      }),
      sagitta: 0,
    };
  }
  const ang0 = info.angStart + info.sweepRad * c0;
  const ang1 = info.angStart + info.sweepRad * c1;
  const subSweep = Math.abs(ang1 - ang0);
  const subStart =
    c0 <= 1e-5
      ? roundPt(piece.a)
      : roundPt({
          x: info.center.x + Math.cos(ang0) * info.radius,
          y: info.center.y + Math.sin(ang0) * info.radius,
        });
  const subEnd =
    c1 >= 1 - 1e-5
      ? roundPt(piece.b)
      : roundPt({
          x: info.center.x + Math.cos(ang1) * info.radius,
          y: info.center.y + Math.sin(ang1) * info.radius,
        });
  const subSagitta =
    Math.sign(info.sagitta) * info.radius * (1 - Math.cos(subSweep * 0.5));
  return {
    a: subStart,
    b: subEnd,
    sagitta: Math.abs(subSagitta) >= 0.04 ? Math.round(subSagitta * 1000) / 1000 : 0,
  };
}

function extractExactSubpath(
  pieces: ExactWallPiece[],
  sStart: number,
  sEnd: number,
): { points: Point2D[]; segmentCurves: Array<number | null> } {
  const points: Point2D[] = [];
  const segmentCurves: Array<number | null> = [];
  if (sEnd <= sStart + 1e-4) return { points, segmentCurves };
  for (const p of pieces) {
    if (p.endS <= sStart + 1e-4 || p.startS >= sEnd - 1e-4 || p.length < 1e-5) continue;
    const u0 = Math.max(0, (sStart - p.startS) / p.length);
    const u1 = Math.min(1, (sEnd - p.startS) / p.length);
    const sliced = sliceExactPiece(p, u0, u1);
    if (!sliced) continue;
    if (Math.hypot(sliced.b.x - sliced.a.x, sliced.b.y - sliced.a.y) < 1e-3 && Math.abs(sliced.sagitta) < 0.04) {
      continue;
    }
    if (points.length === 0) {
      points.push(sliced.a);
    }
    points.push(sliced.b);
    segmentCurves.push(Math.abs(sliced.sagitta) >= 0.04 ? sliced.sagitta : null);
  }
  return { points, segmentCurves };
}

function concatExactSubpaths(
  first: { points: Point2D[]; segmentCurves: Array<number | null> },
  second: { points: Point2D[]; segmentCurves: Array<number | null> },
): { points: Point2D[]; segmentCurves: Array<number | null> } {
  if (first.points.length < 2) return second;
  if (second.points.length < 2) return first;
  const points = [...first.points];
  const segmentCurves = [...first.segmentCurves];
  const tailPt = points[points.length - 1];
  const headPt = second.points[0];
  if (Math.hypot(tailPt.x - headPt.x, tailPt.y - headPt.y) <= 0.02) {
    points.push(...second.points.slice(1));
    segmentCurves.push(...second.segmentCurves);
  } else {
    points.push(...second.points);
    segmentCurves.push(null, ...second.segmentCurves);
  }
  return { points, segmentCurves };
}

function buildArcLengths(pts: Point2D[], closed: boolean): { cum: number[]; total: number } {
  const segCount = closed ? pts.length : pts.length - 1;
  const cum: number[] = [0];
  let total = 0;
  for (let i = 0; i < segCount; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    total += Math.hypot(b.x - a.x, b.y - a.y);
    cum.push(total);
  }
  return { cum, total };
}

function extractOpenSubpath(
  pts: Point2D[],
  closed: boolean,
  cum: number[],
  sStart: number,
  sEnd: number,
): Point2D[] {
  const total = cum[cum.length - 1];
  if (total < 1e-5 || sEnd <= sStart + 1e-4) return [];
  const segCount = closed ? pts.length : pts.length - 1;

  const sampleAt = (s: number): Point2D => {
    const clamped = Math.max(0, Math.min(total, s));
    for (let i = 0; i < segCount; i++) {
      const c0 = cum[i];
      const c1 = cum[i + 1];
      if (clamped <= c1 + 1e-6 || i === segCount - 1) {
        const span = Math.max(1e-6, c1 - c0);
        const t = Math.max(0, Math.min(1, (clamped - c0) / span));
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        return roundPt({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    return roundPt(pts[pts.length - 1]);
  };

  const out: Point2D[] = [sampleAt(sStart)];
  for (let i = 1; i <= segCount; i++) {
    const c = cum[i];
    if (c > sStart + 1e-4 && c < sEnd - 1e-4) {
      const v = roundPt(pts[i % pts.length]);
      const prev = out[out.length - 1];
      if (Math.hypot(v.x - prev.x, v.y - prev.y) > 1e-3) {
        out.push(v);
      }
    }
  }
  const endPt = sampleAt(sEnd);
  const prev = out[out.length - 1];
  if (Math.hypot(endPt.x - prev.x, endPt.y - prev.y) > 1e-3) {
    out.push(endPt);
  }
  return out.length >= 2 ? out : [];
}

/**
 * Locates the nearest visible, unlocked active-floor wall and exact arc-length position
 * for live Split / Breach hover previews and clicks.
 */
export function findWallCutHit(
  point: Point2D,
  layers: MapLayer[],
  activeLevelId: string,
  maxDistCells = 0.75,
): WallCutHit | null {
  let best: WallCutHit | null = null;
  for (let li = layers.length - 1; li >= 0; li--) {
    const layer = layers[li];
    if (!layer.visible || layer.locked || layer.levelId !== activeLevelId) continue;
    for (const wall of layer.walls ?? []) {
      if (wall.points.length < 2) continue;
      const pts = getWallWorkingPolyline(wall);
      const { cum, total } = buildArcLengths(pts, wall.closed);
      if (total < 1e-4) continue;
      const segCount = wall.closed ? pts.length : pts.length - 1;
      const threshold = Math.max(maxDistCells, wall.thicknessCells * 1.4);

      for (let i = 0; i < segCount; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const hit = distanceToSegment(point, a, b);
        if (hit.dist <= threshold && (!best || hit.dist < best.dist)) {
          const segLen = cum[i + 1] - cum[i];
          best = {
            layerId: layer.id,
            wall,
            point: roundPt(hit.closest),
            arcLength: cum[i] + hit.t * segLen,
            totalLength: total,
            tangentRad: Math.atan2(b.y - a.y, b.x - a.x),
            dist: hit.dist,
          };
        }
      }
    }
  }
  return best;
}

/**
 * Splits a wall cleanly at `arcLength`.
 * - Open wall -> 2 independent open WallSegments sharing the split vertex.
 * - Closed wall (e.g. Box Room or Tower) -> opens a seam cleanly at `arcLength`
 *   so a second click splits off any desired section without losing corners!
 */
export function splitWallAtArcLength(
  wall: WallSegment,
  arcLength: number,
  idPrefix = "wsplit",
): WallSegment[] {
  // Preserve exact per-segment circular arcs when splitting straight or mixed-curve walls!
  const exact = buildExactWallPieces(wall);
  if (exact && exact.total >= 0.2) {
    const { pieces, total } = exact;
    // Map polyline-based arcLength smoothly into exact analytical arcLength scale
    const workingPts = getWallWorkingPolyline(wall);
    const { total: workingTotal } = buildArcLengths(workingPts, wall.closed);
    const ratio = workingTotal > 1e-4 ? total / workingTotal : 1;
    const s = Math.max(0, Math.min(total, arcLength * ratio));

    if (wall.closed) {
      const tail = extractExactSubpath(pieces, s, total);
      const head = extractExactSubpath(pieces, 0, s);
      const combined = concatExactSubpaths(tail, head);
      if (combined.points.length < 2) return [wall];
      return [
        {
          ...wall,
          id: wall.id,
          points: combined.points,
          closed: false,
          curved: false,
          segmentCurves: normalizeWallSegmentCurves(
            combined.points.length,
            false,
            combined.segmentCurves,
          ),
        },
      ];
    }

    if (s < 0.12 || total - s < 0.12) return [wall];
    const left = extractExactSubpath(pieces, 0, s);
    const right = extractExactSubpath(pieces, s, total);
    const out: WallSegment[] = [];
    if (left.points.length >= 2) {
      out.push({
        ...wall,
        id: `${idPrefix}-a-${wall.id}`,
        points: left.points,
        closed: false,
        curved: false,
        segmentCurves: normalizeWallSegmentCurves(left.points.length, false, left.segmentCurves),
      });
    }
    if (right.points.length >= 2) {
      out.push({
        ...wall,
        id: `${idPrefix}-b-${wall.id}`,
        points: right.points,
        closed: false,
        curved: false,
        segmentCurves: normalizeWallSegmentCurves(right.points.length, false, right.segmentCurves),
      });
    }
    return out.length > 0 ? out : [wall];
  }

  const pts = getWallWorkingPolyline(wall);
  const { cum, total } = buildArcLengths(pts, wall.closed);
  if (total < 0.2) return [wall];

  const s = Math.max(0, Math.min(total, arcLength));
  if (wall.closed) {
    // Open the closed loop cleanly at `s`: path runs [s..total] + [0..s]
    const tail = extractOpenSubpath(pts, true, cum, s, total);
    const head = extractOpenSubpath(pts, true, cum, 0, s);
    const combined: Point2D[] = [];
    for (const p of [...tail, ...head]) {
      const prev = combined[combined.length - 1];
      if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 1e-3) {
        combined.push(p);
      }
    }
    if (combined.length < 2) return [wall];
    return [
      {
        ...wall,
        id: wall.id,
        points: combined,
        closed: false,
        curved: false,
        segmentCurves: undefined,
      },
    ];
  }

  // Open wall: ignore splits right on the start/end tip
  if (s < 0.12 || total - s < 0.12) return [wall];
  const left = extractOpenSubpath(pts, false, cum, 0, s);
  const right = extractOpenSubpath(pts, false, cum, s, total);
  const out: WallSegment[] = [];
  if (left.length >= 2) {
    out.push({
      ...wall,
      id: `${idPrefix}-a-${wall.id}`,
      points: left,
      closed: false,
      curved: false,
      segmentCurves: undefined,
    });
  }
  if (right.length >= 2) {
    out.push({
      ...wall,
      id: `${idPrefix}-b-${wall.id}`,
      points: right,
      closed: false,
      curved: false,
      segmentCurves: undefined,
    });
  }
  return out.length > 0 ? out : [wall];
}

/**
 * Carves a clean open archway / demolished breach of width `breachWidthCells`
 * centered at `arcLength` along any open or closed wall.
 */
export function carveWallBreachAtArcLength(
  wall: WallSegment,
  arcLength: number,
  breachWidthCells: number,
  idPrefix = "wbreach",
): WallSegment[] {
  const halfGap = Math.max(0.2, breachWidthCells * 0.5);

  const exact = buildExactWallPieces(wall);
  if (exact && exact.total >= 0.2) {
    const { pieces, total } = exact;
    const workingPts = getWallWorkingPolyline(wall);
    const { total: workingTotal } = buildArcLengths(workingPts, wall.closed);
    const ratio = workingTotal > 1e-4 ? total / workingTotal : 1;
    const sCenter = arcLength * ratio;

    if (wall.closed) {
      if (halfGap * 2 >= total - 0.15) return [];
      const sStart = ((sCenter + halfGap) % total + total) % total;
      const sEnd = ((sCenter - halfGap) % total + total) % total;
      const remaining =
        sStart < sEnd
          ? extractExactSubpath(pieces, sStart, sEnd)
          : concatExactSubpaths(
              extractExactSubpath(pieces, sStart, total),
              extractExactSubpath(pieces, 0, sEnd),
            );
      if (remaining.points.length < 2) return [];
      return [
        {
          ...wall,
          id: wall.id,
          points: remaining.points,
          closed: false,
          curved: false,
          segmentCurves: normalizeWallSegmentCurves(
            remaining.points.length,
            false,
            remaining.segmentCurves,
          ),
        },
      ];
    }

    const cut0 = Math.max(0, sCenter - halfGap);
    const cut1 = Math.min(total, sCenter + halfGap);
    const out: WallSegment[] = [];
    if (cut0 > 0.15) {
      const left = extractExactSubpath(pieces, 0, cut0);
      if (left.points.length >= 2) {
        out.push({
          ...wall,
          id: `${idPrefix}-a-${wall.id}`,
          points: left.points,
          closed: false,
          curved: false,
          segmentCurves: normalizeWallSegmentCurves(left.points.length, false, left.segmentCurves),
        });
      }
    }
    if (total - cut1 > 0.15) {
      const right = extractExactSubpath(pieces, cut1, total);
      if (right.points.length >= 2) {
        out.push({
          ...wall,
          id: `${idPrefix}-b-${wall.id}`,
          points: right.points,
          closed: false,
          curved: false,
          segmentCurves: normalizeWallSegmentCurves(
            right.points.length,
            false,
            right.segmentCurves,
          ),
        });
      }
    }
    return out;
  }

  const pts = getWallWorkingPolyline(wall);
  const { cum, total } = buildArcLengths(pts, wall.closed);

  if (wall.closed) {
    if (halfGap * 2 >= total - 0.15) return [];
    const sStart = ((arcLength + halfGap) % total + total) % total;
    const sEnd = ((arcLength - halfGap) % total + total) % total;
    let remaining: Point2D[];
    if (sStart < sEnd) {
      remaining = extractOpenSubpath(pts, true, cum, sStart, sEnd);
    } else {
      const partA = extractOpenSubpath(pts, true, cum, sStart, total);
      const partB = extractOpenSubpath(pts, true, cum, 0, sEnd);
      remaining = [];
      for (const p of [...partA, ...partB]) {
        const prev = remaining[remaining.length - 1];
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 1e-3) {
          remaining.push(p);
        }
      }
    }
    if (remaining.length < 2) return [];
    return [
      {
        ...wall,
        id: wall.id,
        points: remaining,
        closed: false,
        curved: false,
        segmentCurves: undefined,
      },
    ];
  }

  const cut0 = Math.max(0, arcLength - halfGap);
  const cut1 = Math.min(total, arcLength + halfGap);
  const out: WallSegment[] = [];
  if (cut0 > 0.15) {
    const left = extractOpenSubpath(pts, false, cum, 0, cut0);
    if (left.length >= 2) {
      out.push({
        ...wall,
        id: `${idPrefix}-a-${wall.id}`,
        points: left,
        closed: false,
        curved: false,
        segmentCurves: undefined,
      });
    }
  }
  if (total - cut1 > 0.15) {
    const right = extractOpenSubpath(pts, false, cum, cut1, total);
    if (right.length >= 2) {
      out.push({
        ...wall,
        id: `${idPrefix}-b-${wall.id}`,
        points: right,
        closed: false,
        curved: false,
        segmentCurves: undefined,
      });
    }
  }
  return out;
}

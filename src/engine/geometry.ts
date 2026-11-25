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
    const pts = wall.curved ? sampleCatmullRom(wall.points, 6, wall.closed) : wall.points;
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
  const pts = wall.curved ? sampleCatmullRom(wall.points, 8, wall.closed) : wall.points;
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
    const pts = wall.curved ? sampleCatmullRom(wall.points, 6, wall.closed) : wall.points;
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
          pts: w.curved ? sampleCatmullRom(w.points, 6, w.closed) : w.points,
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
          pts: path.curved !== false ? sampleCatmullRom(path.points, 5, false) : path.points,
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

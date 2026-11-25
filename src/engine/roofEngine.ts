import {
  distanceToSegment,
  pointInPolygon,
  sampleCatmullRom,
} from "@/engine/geometry";
import { buildWallBarrierGrid, computeSmartFloodFill } from "@/engine/terrainFill";
import type {
  DcMapDocument,
  Point2D,
  RoofRidgeCapStyle,
  RoofStructure,
  RoofStyle,
  WallSegment,
} from "@/types/map";

export interface RoofMaterialPreset {
  id: string;
  name: string;
  shortLabel: string;
  assetId: string;
  ridgeCapStyle: RoofRidgeCapStyle;
  ridgeColorHex: string;
  eaveTrimHex: string;
  slopeShade: number;
  weathering: number;
  defaultStyle: RoofStyle;
}

export const ROOF_MATERIAL_PRESETS: RoofMaterialPreset[] = [
  {
    id: "terracotta_barrel",
    name: "Mediterranean Terracotta Barrel",
    shortLabel: "Terracotta",
    assetId: "modular-suite/terrain/roof_terracotta_barrel_tiles.png",
    ridgeCapStyle: "matching",
    ridgeColorHex: "#A84C2C",
    eaveTrimHex: "#3D1E14",
    slopeShade: 0.54,
    weathering: 0.24,
    defaultStyle: "hip",
  },
  {
    id: "alpine_slate",
    name: "Weathered Alpine Slate",
    shortLabel: "Alpine Slate",
    assetId: "modular-suite/terrain/roof_weathered_slate_shingles.png",
    ridgeCapStyle: "stone",
    ridgeColorHex: "#4E5D6C",
    eaveTrimHex: "#1E252D",
    slopeShade: 0.56,
    weathering: 0.28,
    defaultStyle: "gable",
  },
  {
    id: "golden_thatch",
    name: "Cottage Golden Thatch",
    shortLabel: "Golden Thatch",
    assetId: "modular-suite/terrain/roof_golden_thatch_straw.png",
    ridgeCapStyle: "timber",
    ridgeColorHex: "#8C652D",
    eaveTrimHex: "#423117",
    slopeShade: 0.48,
    weathering: 0.34,
    defaultStyle: "gable",
  },
  {
    id: "cedar_shakes",
    name: "Weathered Cedar Shakes",
    shortLabel: "Cedar Shakes",
    assetId: "modular-suite/terrain/roof_cedar_wood_shakes.png",
    ridgeCapStyle: "timber",
    ridgeColorHex: "#6E472B",
    eaveTrimHex: "#2D1C11",
    slopeShade: 0.52,
    weathering: 0.26,
    defaultStyle: "gable",
  },
  {
    id: "verdigris_copper",
    name: "Verdigris Standing-Seam Copper",
    shortLabel: "Verdigris",
    assetId: "modular-suite/terrain/roof_oxidized_verdigris_copper.png",
    ridgeCapStyle: "copper",
    ridgeColorHex: "#488B7D",
    eaveTrimHex: "#1D3B35",
    slopeShade: 0.58,
    weathering: 0.22,
    defaultStyle: "mansard",
  },
  {
    id: "mossy_stone",
    name: "Mossy Ancient Stone Shingles",
    shortLabel: "Mossy Stone",
    assetId: "modular-suite/terrain/roof_mossy_stone_tiles.png",
    ridgeCapStyle: "stone",
    ridgeColorHex: "#6A6B60",
    eaveTrimHex: "#262822",
    slopeShade: 0.56,
    weathering: 0.38,
    defaultStyle: "gable",
  },
  {
    id: "emerald_ceramic",
    name: "Imperial Emerald Glazed Tile",
    shortLabel: "Emerald Tile",
    assetId: "modular-suite/terrain/roof_oriental_glazed_tiles.png",
    ridgeCapStyle: "matching",
    ridgeColorHex: "#246E5A",
    eaveTrimHex: "#14352B",
    slopeShade: 0.52,
    weathering: 0.16,
    defaultStyle: "hip",
  },
  {
    id: "corrugated_iron",
    name: "Rusted Corrugated Iron",
    shortLabel: "Rusted Iron",
    assetId: "modular-suite/terrain/roof_corrugated_iron_sheets.png",
    ridgeCapStyle: "stone",
    ridgeColorHex: "#6B5648",
    eaveTrimHex: "#272220",
    slopeShade: 0.58,
    weathering: 0.36,
    defaultStyle: "shed",
  },
  {
    id: "cobalt_fishscale",
    name: "Ornate Cobalt Fishscale",
    shortLabel: "Cobalt Scale",
    assetId: "modular-suite/terrain/roof_fishscale_cobalt_slate.png",
    ridgeCapStyle: "copper",
    ridgeColorHex: "#364E78",
    eaveTrimHex: "#162034",
    slopeShade: 0.56,
    weathering: 0.18,
    defaultStyle: "cone",
  },
  {
    id: "snow_shingles",
    name: "Snow-Dusted Alpine Shingles",
    shortLabel: "Snow Timber",
    assetId: "modular-suite/terrain/roof_snow_dusted_shingles.png",
    ridgeCapStyle: "timber",
    ridgeColorHex: "#D8E4EE",
    eaveTrimHex: "#3A4450",
    slopeShade: 0.44,
    weathering: 0.14,
    defaultStyle: "gable",
  },
];

export function getRoofPresetByAssetId(assetId: string): RoofMaterialPreset {
  return (
    ROOF_MATERIAL_PRESETS.find((p) => p.assetId === assetId) ?? ROOF_MATERIAL_PRESETS[0]
  );
}

export function getRoofPreset(presetId: string): RoofMaterialPreset {
  return (
    ROOF_MATERIAL_PRESETS.find((p) => p.id === presetId) ?? ROOF_MATERIAL_PRESETS[0]
  );
}

export interface RoofFacet {
  /** Closed polygon in grid-cell coordinates */
  polygon: Point2D[];
  /** Unit vector pointing DOWNHILL (ridge -> eave). Seamless roof tiles align +Y along this vector. */
  downhillDir: Point2D;
  /** Reference anchor point (usually on the ridge or eave edge) so shingle courses lock crisply */
  texOrigin: Point2D;
  /** Flat top deck on a Mansard roof */
  isFlatCrown?: boolean;
  /** 0 for flat crown, 1 for sloped roof plane */
  pitchFactor: number;
}

export interface RoofRidgeLine {
  points: Point2D[];
  isMainRidge: boolean;
}

export interface RoofGeometry {
  footprint: Point2D[];
  facets: RoofFacet[];
  ridgeLines: RoofRidgeLine[];
  finialCenter?: Point2D;
  spine: Point2D[];
}

function hypot(dx: number, dy: number): number {
  return Math.hypot(dx, dy);
}

function normalize(dx: number, dy: number): Point2D {
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

function dedupePolyline(pts: Point2D[], eps = 1e-3): Point2D[] {
  const out: Point2D[] = [];
  for (const p of pts) {
    if (out.length === 0 || hypot(p.x - out[out.length - 1].x, p.y - out[out.length - 1].y) > eps) {
      out.push({ x: p.x, y: p.y });
    }
  }
  return out;
}

function segUnitDir(a: Point2D, b: Point2D): Point2D {
  return normalize(b.x - a.x, b.y - a.y);
}

function leftNormal(dir: Point2D): Point2D {
  return { x: -dir.y, y: dir.x };
}

function rightNormal(dir: Point2D): Point2D {
  return { x: dir.y, y: -dir.x };
}

/**
 * Computes mitered left/right offset polylines along a ridge spine with miter-limit clamping
 * so L-shaped, T-shaped, and curved roofs join cleanly without spikes or gaps.
 */
function buildMiteredOffset(
  spine: Point2D[],
  offsetDist: number,
  side: "left" | "right",
  miterLimit = 2.4,
): Point2D[] {
  const n = spine.length;
  const out: Point2D[] = [];
  if (n < 2) return out;
  const getN = (d: Point2D) => (side === "left" ? leftNormal(d) : rightNormal(d));

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      const n0 = getN(segUnitDir(spine[0], spine[1]));
      out.push({ x: spine[0].x + n0.x * offsetDist, y: spine[0].y + n0.y * offsetDist });
    } else if (i === n - 1) {
      const nLast = getN(segUnitDir(spine[n - 2], spine[n - 1]));
      out.push({
        x: spine[n - 1].x + nLast.x * offsetDist,
        y: spine[n - 1].y + nLast.y * offsetDist,
      });
    } else {
      const dPrev = segUnitDir(spine[i - 1], spine[i]);
      const dNext = segUnitDir(spine[i], spine[i + 1]);
      const nPrev = getN(dPrev);
      const nNext = getN(dNext);
      const bx = nPrev.x + nNext.x;
      const by = nPrev.y + nNext.y;
      const bLen = Math.hypot(bx, by);
      if (bLen < 1e-4) {
        out.push({ x: spine[i].x + nPrev.x * offsetDist, y: spine[i].y + nPrev.y * offsetDist });
      } else {
        const ux = bx / bLen;
        const uy = by / bLen;
        const cosHalf = ux * nPrev.x + uy * nPrev.y;
        const miterScale = Math.min(miterLimit, 1 / Math.max(0.28, cosHalf));
        const dist = offsetDist * miterScale;
        out.push({ x: spine[i].x + ux * dist, y: spine[i].y + uy * dist });
      }
    }
  }
  return out;
}

/**
 * Computes the complete multi-facet architectural geometry for any RoofStructure.
 * Every facet carries its exact downhill normal so seamless roof shingles align
 * parallel to the ridge/eaves and shade accurately against the Sun Angle.
 */
export function computeRoofGeometry(roof: RoofStructure): RoofGeometry {
  const empty: RoofGeometry = { footprint: [], facets: [], ridgeLines: [], spine: [] };
  if (!roof.points || roof.points.length < 2) return empty;

  const span = Math.max(0.8, roof.widthCells);

  // ── 1. CONE / TURRET / GAZEBO ROOF ──
  if (roof.style === "cone") {
    const center = roof.points[0];
    const rim = roof.points[1];
    const radius = Math.max(0.6, hypot(rim.x - center.x, rim.y - center.y));
    const startAngle = Math.atan2(rim.y - center.y, rim.x - center.x);
    const facetCount =
      roof.coneFacets && roof.coneFacets >= 3 ? Math.round(roof.coneFacets) : 16;
    const isSmoothRound = !roof.coneFacets || roof.coneFacets === 0;

    const ring: Point2D[] = [];
    for (let k = 0; k < facetCount; k++) {
      const a = startAngle + (k / facetCount) * Math.PI * 2;
      ring.push({
        x: center.x + Math.cos(a) * radius,
        y: center.y + Math.sin(a) * radius,
      });
    }

    const facets: RoofFacet[] = [];
    const ridgeLines: RoofRidgeLine[] = [];
    for (let k = 0; k < facetCount; k++) {
      const p0 = ring[k];
      const p1 = ring[(k + 1) % facetCount];
      const mid = { x: (p0.x + p1.x) * 0.5, y: (p0.y + p1.y) * 0.5 };
      const downhill = normalize(mid.x - center.x, mid.y - center.y);
      facets.push({
        polygon: [center, p0, p1],
        downhillDir: downhill,
        texOrigin: center,
        pitchFactor: 1,
      });
      if (!isSmoothRound) {
        ridgeLines.push({ points: [center, p0], isMainRidge: false });
      }
    }

    return {
      footprint: ring,
      facets,
      ridgeLines,
      finialCenter: center,
      spine: [center, rim],
    };
  }

  // ── 2. SPINE-BASED ROOFS (Gable, Hip, Shed, Mansard) ──
  const useCurve = Boolean(roof.curved) && roof.points.length >= 3;
  const rawSpine = useCurve ? sampleCatmullRom(roof.points, 10, false) : roof.points;
  const spine = dedupePolyline(rawSpine, 0.01);
  if (spine.length < 2) return empty;

  const ridgeOffset = Math.max(-0.4, Math.min(0.4, roof.ridgeOffset ?? 0));

  // ── 2A. SHED / LEAN-TO (Single Directional Slope) ──
  if (roof.style === "shed") {
    const side: "left" | "right" = roof.flipSlope ? "left" : "right";
    const eave = buildMiteredOffset(spine, span, side);
    const facets: RoofFacet[] = [];
    const ridgeLines: RoofRidgeLine[] = [{ points: spine, isMainRidge: true }];

    for (let i = 0; i < spine.length - 1; i++) {
      const dir = segUnitDir(spine[i], spine[i + 1]);
      const downhill = side === "left" ? leftNormal(dir) : rightNormal(dir);
      facets.push({
        polygon: [spine[i], spine[i + 1], eave[i + 1], eave[i]],
        downhillDir: downhill,
        texOrigin: spine[i],
        pitchFactor: 1,
      });
      if (i > 0) {
        const dPrev = segUnitDir(spine[i - 1], spine[i]);
        const dot = Math.max(-1, Math.min(1, dPrev.x * dir.x + dPrev.y * dir.y));
        if (Math.acos(dot) > (15 * Math.PI) / 180) {
          ridgeLines.push({ points: [spine[i], eave[i]], isMainRidge: false });
        }
      }
    }

    return {
      footprint: [...spine, ...eave.slice().reverse()],
      facets,
      ridgeLines,
      spine,
    };
  }

  const leftSpan = Math.max(0.35, span * (0.5 + ridgeOffset));
  const rightSpan = Math.max(0.35, span * (0.5 - ridgeOffset));
  const leftEave = buildMiteredOffset(spine, leftSpan, "left");
  const rightEave = buildMiteredOffset(spine, rightSpan, "right");
  const footprint = [...leftEave, ...rightEave.slice().reverse()];

  // Helper to collect corner hip diagonal seams on bent L/T wings
  const bendHipLines: RoofRidgeLine[] = [];
  for (let i = 1; i < spine.length - 1; i++) {
    const dPrev = segUnitDir(spine[i - 1], spine[i]);
    const dNext = segUnitDir(spine[i], spine[i + 1]);
    const dot = Math.max(-1, Math.min(1, dPrev.x * dNext.x + dPrev.y * dNext.y));
    const angle = Math.acos(dot);
    if (angle > (16 * Math.PI) / 180) {
      const cross = dPrev.x * dNext.y - dPrev.y * dNext.x;
      // Outer corner gets a crisp hip ridge seam
      const outerPt = cross > 0 ? rightEave[i] : leftEave[i];
      bendHipLines.push({ points: [spine[i], outerPt], isMainRidge: false });
    }
  }

  // ── 2B. GABLE ROOF (Pitched two-sided with flat gable ends) ──
  if (roof.style === "gable") {
    const facets: RoofFacet[] = [];
    for (let i = 0; i < spine.length - 1; i++) {
      const dir = segUnitDir(spine[i], spine[i + 1]);
      facets.push({
        polygon: [spine[i], spine[i + 1], leftEave[i + 1], leftEave[i]],
        downhillDir: leftNormal(dir),
        texOrigin: spine[i],
        pitchFactor: 1,
      });
      facets.push({
        polygon: [spine[i], spine[i + 1], rightEave[i + 1], rightEave[i]],
        downhillDir: rightNormal(dir),
        texOrigin: spine[i],
        pitchFactor: 1,
      });
    }
    return {
      footprint,
      facets,
      ridgeLines: [{ points: spine, isMainRidge: true }, ...bendHipLines],
      spine,
    };
  }

  // ── 2C. HIP ROOF (All 4 sides slope cleanly to the eaves) ──
  if (roof.style === "hip") {
    const hipRatio = Math.max(0.2, Math.min(1.0, roof.hipInsetRatio ?? 0.72));
    const halfSpan = Math.min(leftSpan, rightSpan);

    const startDir = segUnitDir(spine[0], spine[1]);
    const endDir = segUnitDir(spine[spine.length - 2], spine[spine.length - 1]);
    const firstSegLen = hypot(spine[1].x - spine[0].x, spine[1].y - spine[0].y);
    const lastSegLen = hypot(
      spine[spine.length - 1].x - spine[spine.length - 2].x,
      spine[spine.length - 1].y - spine[spine.length - 2].y,
    );

    const isSingleSeg = spine.length === 2;
    const maxStartInset = isSingleSeg ? firstSegLen * 0.49 : firstSegLen * 0.85;
    const maxEndInset = isSingleSeg ? lastSegLen * 0.49 : lastSegLen * 0.85;

    const startInset = Math.min(halfSpan * hipRatio, maxStartInset);
    const endInset = Math.min(halfSpan * hipRatio, maxEndInset);

    const ridgePts = spine.map((p) => ({ x: p.x, y: p.y }));
    ridgePts[0] = {
      x: spine[0].x + startDir.x * startInset,
      y: spine[0].y + startDir.y * startInset,
    };
    ridgePts[ridgePts.length - 1] = {
      x: spine[spine.length - 1].x - endDir.x * endInset,
      y: spine[spine.length - 1].y - endDir.y * endInset,
    };

    const facets: RoofFacet[] = [];
    // Left and right main sloped sides
    for (let i = 0; i < spine.length - 1; i++) {
      const dir = segUnitDir(spine[i], spine[i + 1]);
      facets.push({
        polygon: [ridgePts[i], ridgePts[i + 1], leftEave[i + 1], leftEave[i]],
        downhillDir: leftNormal(dir),
        texOrigin: ridgePts[i],
        pitchFactor: 1,
      });
      facets.push({
        polygon: [ridgePts[i], ridgePts[i + 1], rightEave[i + 1], rightEave[i]],
        downhillDir: rightNormal(dir),
        texOrigin: ridgePts[i],
        pitchFactor: 1,
      });
    }
    // Start & end hip triangles
    facets.push({
      polygon: [ridgePts[0], leftEave[0], rightEave[0]],
      downhillDir: { x: -startDir.x, y: -startDir.y },
      texOrigin: ridgePts[0],
      pitchFactor: 1,
    });
    const lastIdx = spine.length - 1;
    facets.push({
      polygon: [ridgePts[lastIdx], rightEave[lastIdx], leftEave[lastIdx]],
      downhillDir: endDir,
      texOrigin: ridgePts[lastIdx],
      pitchFactor: 1,
    });

    const ridgeLines: RoofRidgeLine[] = [
      { points: ridgePts, isMainRidge: true },
      { points: [ridgePts[0], leftEave[0]], isMainRidge: false },
      { points: [ridgePts[0], rightEave[0]], isMainRidge: false },
      { points: [ridgePts[lastIdx], leftEave[lastIdx]], isMainRidge: false },
      { points: [ridgePts[lastIdx], rightEave[lastIdx]], isMainRidge: false },
      ...bendHipLines,
    ];

    const isPyramid =
      isSingleSeg &&
      hypot(ridgePts[1].x - ridgePts[0].x, ridgePts[1].y - ridgePts[0].y) < 0.35;

    return {
      footprint,
      facets,
      ridgeLines,
      ...(isPyramid
        ? {
            finialCenter: {
              x: (ridgePts[0].x + ridgePts[1].x) * 0.5,
              y: (ridgePts[0].y + ridgePts[1].y) * 0.5,
            },
          }
        : {}),
      spine,
    };
  }

  // ── 2D. MANSARD ROOF (4 Steep Outer Sloped Skirts + Flat Crown Deck) ──
  const crownRatio = Math.max(0.18, Math.min(0.68, roof.mansardCrownRatio ?? 0.44));
  const crownLeftSpan = leftSpan * crownRatio;
  const crownRightSpan = rightSpan * crownRatio;
  const startDir = segUnitDir(spine[0], spine[1]);
  const endDir = segUnitDir(spine[spine.length - 2], spine[spine.length - 1]);
  const firstLen = hypot(spine[1].x - spine[0].x, spine[1].y - spine[0].y);
  const lastLen = hypot(
    spine[spine.length - 1].x - spine[spine.length - 2].x,
    spine[spine.length - 1].y - spine[spine.length - 2].y,
  );
  const skirtInset = Math.min(leftSpan, rightSpan) * (1 - crownRatio);
  const sInset = Math.min(skirtInset, spine.length === 2 ? firstLen * 0.36 : firstLen * 0.72);
  const eInset = Math.min(skirtInset, spine.length === 2 ? lastLen * 0.36 : lastLen * 0.72);

  const crownSpine = spine.map((p) => ({ x: p.x, y: p.y }));
  crownSpine[0] = { x: spine[0].x + startDir.x * sInset, y: spine[0].y + startDir.y * sInset };
  crownSpine[crownSpine.length - 1] = {
    x: spine[spine.length - 1].x - endDir.x * eInset,
    y: spine[spine.length - 1].y - endDir.y * eInset,
  };

  const crownLeft = buildMiteredOffset(crownSpine, crownLeftSpan, "left");
  const crownRight = buildMiteredOffset(crownSpine, crownRightSpan, "right");
  const crownPoly = [...crownLeft, ...crownRight.slice().reverse()];

  const facets: RoofFacet[] = [];
  for (let i = 0; i < spine.length - 1; i++) {
    const dir = segUnitDir(spine[i], spine[i + 1]);
    facets.push({
      polygon: [crownLeft[i], crownLeft[i + 1], leftEave[i + 1], leftEave[i]],
      downhillDir: leftNormal(dir),
      texOrigin: crownLeft[i],
      pitchFactor: 1,
    });
    facets.push({
      polygon: [crownRight[i], crownRight[i + 1], rightEave[i + 1], rightEave[i]],
      downhillDir: rightNormal(dir),
      texOrigin: crownRight[i],
      pitchFactor: 1,
    });
  }
  const lastIdx = spine.length - 1;
  facets.push({
    polygon: [crownLeft[0], crownRight[0], rightEave[0], leftEave[0]],
    downhillDir: { x: -startDir.x, y: -startDir.y },
    texOrigin: crownLeft[0],
    pitchFactor: 1,
  });
  facets.push({
    polygon: [crownRight[lastIdx], crownLeft[lastIdx], leftEave[lastIdx], rightEave[lastIdx]],
    downhillDir: endDir,
    texOrigin: crownRight[lastIdx],
    pitchFactor: 1,
  });
  // Central flat crown rendered last on top of skirts
  facets.push({
    polygon: crownPoly,
    downhillDir: leftNormal(startDir),
    texOrigin: crownLeft[0],
    isFlatCrown: true,
    pitchFactor: 0,
  });

  const ridgeLines: RoofRidgeLine[] = [
    { points: [...crownPoly, crownPoly[0]], isMainRidge: true },
    { points: [crownLeft[0], leftEave[0]], isMainRidge: false },
    { points: [crownRight[0], rightEave[0]], isMainRidge: false },
    { points: [crownLeft[lastIdx], leftEave[lastIdx]], isMainRidge: false },
    { points: [crownRight[lastIdx], rightEave[lastIdx]], isMainRidge: false },
  ];

  return {
    footprint,
    facets,
    ridgeLines,
    spine,
  };
}

/**
 * Converts a drag rectangle [a, b] plus eave overhang into a clean RoofStructure spine + span.
 * Ridge automatically aligns along the longer axis (or flips 90° when `rotateRidge` is true).
 */
export function buildBoxRoofParams(
  a: Point2D,
  b: Point2D,
  overhangCells = 0.4,
  rotateRidge = false,
): { points: Point2D[]; widthCells: number } | null {
  const minX = Math.min(a.x, b.x) - overhangCells;
  const maxX = Math.max(a.x, b.x) + overhangCells;
  const minY = Math.min(a.y, b.y) - overhangCells;
  const maxY = Math.max(a.y, b.y) + overhangCells;
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 0.8 || h < 0.8) return null;

  const horizontalRidge = rotateRidge ? h > w : w >= h;
  if (horizontalRidge) {
    const cy = (minY + maxY) * 0.5;
    return {
      points: [
        { x: minX, y: cy },
        { x: maxX, y: cy },
      ],
      widthCells: h,
    };
  }
  const cx = (minX + maxX) * 0.5;
  return {
    points: [
      { x: cx, y: minY },
      { x: cx, y: maxY },
    ],
    widthCells: w,
  };
}

/**
 * Computes the oriented minimum-area bounding box of a polygon using its longest edge axis,
 * enabling Auto-Roof Room to wrap even angled/diagonal walled buildings cleanly!
 */
function computeOrientedRoomBox(poly: Point2D[]): {
  center: Point2D;
  axisU: Point2D;
  axisV: Point2D;
  lenU: number;
  lenV: number;
} | null {
  if (poly.length < 3) return null;
  // Find dominant edge angle (quantized in 5-degree bins weighted by edge length)
  const bins = new Map<number, number>();
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = hypot(b.x - a.x, b.y - a.y);
    if (len < 0.15) continue;
    let deg = ((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) % 90;
    if (deg < 0) deg += 90;
    const bin = Math.round(deg / 3) * 3;
    bins.set(bin, (bins.get(bin) ?? 0) + len);
  }
  let bestAngleDeg = 0;
  let bestWeight = -1;
  for (const [deg, weight] of bins.entries()) {
    if (weight > bestWeight) {
      bestWeight = weight;
      bestAngleDeg = deg;
    }
  }
  // Snap near axis-aligned angles to exact 0°
  if (bestAngleDeg <= 3 || bestAngleDeg >= 87) bestAngleDeg = 0;

  const rad = (bestAngleDeg * Math.PI) / 180;
  const u = { x: Math.cos(rad), y: Math.sin(rad) };
  const v = { x: -Math.sin(rad), y: Math.cos(rad) };

  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of poly) {
    const pu = p.x * u.x + p.y * u.y;
    const pv = p.x * v.x + p.y * v.y;
    if (pu < minU) minU = pu;
    if (pu > maxU) maxU = pu;
    if (pv < minV) minV = pv;
    if (pv > maxV) maxV = pv;
  }

  const lenU = maxU - minU;
  const lenV = maxV - minV;
  if (lenU < 0.8 || lenV < 0.8) return null;
  const midU = (minU + maxU) * 0.5;
  const midV = (minV + maxV) * 0.5;
  const center = {
    x: u.x * midU + v.x * midV,
    y: u.y * midU + v.y * midV,
  };

  // Ensure axisU is always the longer ridge direction
  if (lenV > lenU) {
    return { center, axisU: v, axisV: { x: -u.x, y: -u.y }, lenU: lenV, lenV: lenU };
  }
  return { center, axisU: u, axisV: v, lenU, lenV };
}

/**
 * 1-click Auto-Roof Room: detects an enclosed walled building at `clickPt`
 * (searching visible walls on the active level AND directly beneath when on ROOF level),
 * aligns the ridge to the room's longest wall axis, and adds the requested eave overhang.
 */
export function computeAutoRoomRoof(
  doc: DcMapDocument,
  clickPt: Point2D,
  overhangCells = 0.45,
): { points: Point2D[]; widthCells: number; areaSq: number } | null {
  const activeLv = doc.levels.find((lv) => lv.id === doc.activeLevelId);
  const wallList: WallSegment[] = [];

  // Prefer walls on active level; if on ROOF level (or no walls on active level), include walls on highest floor below!
  const collectLevelWalls = (levelId: string) => {
    for (const l of doc.layers) {
      if (l.kind === "walls" && l.levelId === levelId && l.walls?.length) {
        wallList.push(...l.walls);
      }
    }
  };

  if (activeLv) {
    collectLevelWalls(activeLv.id);
    if (wallList.length === 0 || activeLv.kind === "roof") {
      const lowerLevels = doc.levels
        .filter((lv) => lv.elevationFt < activeLv.elevationFt && lv.kind !== "underground")
        .sort((a, b) => b.elevationFt - a.elevationFt);
      for (const lv of lowerLevels) {
        collectLevelWalls(lv.id);
        if (wallList.length > 0) break;
      }
    }
  }
  if (wallList.length === 0) return null;

  const grid = buildWallBarrierGrid(wallList, doc.canvas.widthCells, doc.canvas.heightCells, 4);
  const flood = computeSmartFloodFill(clickPt, grid);
  if (!flood || !flood.boundedByWalls || flood.outer.length < 3) return null;

  const box = computeOrientedRoomBox(flood.outer);
  if (!box) return null;

  const halfLen = box.lenU * 0.5 + overhangCells;
  const totalWidth = box.lenV + overhangCells * 2;
  return {
    points: [
      { x: box.center.x - box.axisU.x * halfLen, y: box.center.y - box.axisU.y * halfLen },
      { x: box.center.x + box.axisU.x * halfLen, y: box.center.y + box.axisU.y * halfLen },
    ],
    widthCells: Math.max(1.2, Math.round(totalWidth * 20) / 20),
    areaSq: flood.areaSq,
  };
}

/**
 * Hit-test: returns true if `pt` lies inside the outer roof footprint.
 */
export function pointInRoof(pt: Point2D, roof: RoofStructure): boolean {
  const geom = computeRoofGeometry(roof);
  if (geom.footprint.length < 3) return false;
  return pointInPolygon(pt, geom.footprint);
}

/**
 * Distance from `pt` to the roof's ridge spine polyline (for precise hover & handle priority).
 */
export function distanceToRoofSpine(pt: Point2D, roof: RoofStructure): number {
  const geom = computeRoofGeometry(roof);
  const pts = geom.spine;
  if (pts.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distanceToSegment(pt, pts[i], pts[i + 1]).dist;
    if (d < best) best = d;
  }
  return best;
}

/**
 * Returns the two interactive eave-width drag handles positioned at the midpoint of the roof spine,
 * perpendicular to the ridge, so users can widen/narrow any selected roof directly on the canvas.
 */
export function getRoofWidthHandles(roof: RoofStructure): Array<{
  pos: Point2D;
  normal: Point2D;
  anchor: Point2D;
  side: "left" | "right";
}> {
  if (roof.style === "cone" || roof.points.length < 2) return [];
  const geom = computeRoofGeometry(roof);
  const pts = geom.spine;
  if (pts.length < 2) return [];
  const midIdx = Math.floor((pts.length - 1) / 2);
  const a = pts[midIdx];
  const b = pts[midIdx + 1];
  const anchor = { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 };
  const dir = segUnitDir(a, b);
  const lNorm = leftNormal(dir);
  const rNorm = rightNormal(dir);

  if (roof.style === "shed") {
    const side: "left" | "right" = roof.flipSlope ? "left" : "right";
    const norm = side === "left" ? lNorm : rNorm;
    return [
      {
        pos: { x: anchor.x + norm.x * roof.widthCells, y: anchor.y + norm.y * roof.widthCells },
        normal: norm,
        anchor,
        side,
      },
    ];
  }

  const offset = Math.max(-0.4, Math.min(0.4, roof.ridgeOffset ?? 0));
  const leftSpan = Math.max(0.35, roof.widthCells * (0.5 + offset));
  const rightSpan = Math.max(0.35, roof.widthCells * (0.5 - offset));
  return [
    {
      pos: { x: anchor.x + lNorm.x * leftSpan, y: anchor.y + lNorm.y * leftSpan },
      normal: lNorm,
      anchor,
      side: "left",
    },
    {
      pos: { x: anchor.x + rNorm.x * rightSpan, y: anchor.y + rNorm.y * rightSpan },
      normal: rNorm,
      anchor,
      side: "right",
    },
  ];
}

/**
 * High-Resolution Clean-Room World Atlas Recreation of "Tro'fraderra"
 * built natively inside Dice Chaos Compass v1.5.
 *
 * Calibrated across 12 micro-sectors against the Wonderdraft original:
 * - High-definition 480x330 editable SDF heightfield + 6 carved freshwater lakes
 * - Dual land & ocean watercolor washes + antique ink stipple regions (Stannen, Valtira, NE Cape)
 * - 19 slim meandering rivers & branching tributaries with seamless coastal/lake mouth fading
 * - 30+ intricate dotted & dashed kingdom roads & regional trails linking every settlement
 * - 5 Depth-ordered layers (~520 miniature-scaled hand-inked CC0 symbols, multiply-ink sea beasts,
 *   engraved NE frontier mountains, 85+ densely packed towns/villages/keeps/ports, & billowing clouds)
 * - ~90 calibrated hierarchical labels (Title, Oceans, Regions, Capitals & tiny 5.8-7.2px villages)
 */

import { distanceToPolyline, pointInPolygon } from "@/engine/geometry";
import { encodeMaskB64, fbm2D, sampleWorldBiomeColor } from "@/engine/worldEngine";
import { getWorldThemeById } from "@/engine/worldThemes";
import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type ObjectStamp,
  type Point2D,
  type WorldBiomeStroke,
  type WorldLabel,
  type WorldMapData,
  type WorldRiver,
  type WorldThemeConfig,
  type WorldTrail,
} from "@/types/map";

const W_CELLS = 48;
const H_CELLS = 33;
// High-definition 10 px/cell continental heightfield (4x Pass 1/2 resolution for crisp coves & islets!)
const GRID_W = 480;
const GRID_H = 330;

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface LandBlob {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot?: number;
}

let cachedTrofraderraHeightfields: {
  heightmapB64: string;
  freshwaterB64: string;
} | null = null;

/**
 * Rasterizes Tro'fraderra's exact multi-continent & archipelago silhouettes into a
 * native editable 480x330 heightfield with sharp fractal shoreline detail so every
 * peninsula, cape, fjord, reef islet, and inland tarn can be sculpted live in-app.
 */
function buildTrofraderraHeightfields(): {
  heightmapB64: string;
  freshwaterB64: string;
} {
  if (cachedTrofraderraHeightfields) {
    return cachedTrofraderraHeightfields;
  }
  const mainContinent: Point2D[] = [
    // NW Elven Peninsula
    { x: 11.4, y: 4.7 },
    { x: 12.6, y: 3.9 },
    { x: 14.3, y: 4.1 },
    { x: 15.5, y: 5.0 },
    { x: 15.9, y: 6.1 },
    { x: 15.5, y: 7.2 },
    { x: 16.5, y: 7.6 },
    // Northern Coastline (Northwatch -> Steppe -> Peel Carbel -> NE Chalk Cape)
    { x: 17.5, y: 6.9 },
    { x: 19.1, y: 6.0 },
    { x: 21.6, y: 5.9 },
    { x: 23.6, y: 6.9 },
    { x: 25.2, y: 7.1 },
    { x: 26.8, y: 7.3 },
    { x: 28.9, y: 7.0 },
    { x: 31.1, y: 6.5 },
    { x: 33.4, y: 6.5 },
    { x: 35.1, y: 7.0 },
    { x: 36.0, y: 8.1 },
    { x: 35.1, y: 9.5 },
    { x: 34.0, y: 9.5 },
    { x: 33.4, y: 8.8 },
    { x: 32.3, y: 9.8 },
    // Eastern Coast hugging Valtira Sound -> Passeron -> Velmora
    { x: 31.8, y: 11.1 },
    { x: 32.5, y: 12.0 },
    { x: 33.5, y: 12.4 },
    { x: 33.8, y: 14.0 },
    { x: 33.2, y: 15.8 },
    { x: 32.6, y: 17.6 },
    { x: 31.6, y: 19.7 },
    { x: 30.1, y: 21.1 },
    // Southern Coastline (Velmora -> Freyharbor -> Obreyis -> Kingport -> Goldfield Boot -> Sunhaven -> Durnor)
    { x: 28.4, y: 21.9 },
    { x: 26.5, y: 21.6 },
    { x: 24.8, y: 21.2 },
    { x: 23.1, y: 21.1 },
    { x: 21.1, y: 21.0 },
    { x: 19.5, y: 20.3 },
    { x: 18.2, y: 20.3 },
    { x: 17.4, y: 21.0 },
    { x: 18.1, y: 22.0 },
    { x: 17.2, y: 23.0 },
    { x: 15.8, y: 22.4 },
    { x: 14.4, y: 21.8 },
    { x: 15.1, y: 20.8 },
    { x: 14.3, y: 20.3 },
    { x: 13.0, y: 20.9 },
    { x: 11.8, y: 20.4 },
    { x: 12.0, y: 19.8 },
    { x: 11.1, y: 20.8 },
    { x: 9.9, y: 21.2 },
    { x: 9.2, y: 20.3 },
    { x: 9.6, y: 19.5 },
    { x: 8.9, y: 18.7 },
    // Western Coastline (Putrid Sea bays & Stannen stippled plain)
    { x: 9.2, y: 17.5 },
    { x: 10.1, y: 16.9 },
    { x: 9.1, y: 16.1 },
    { x: 8.6, y: 15.2 },
    { x: 9.3, y: 14.3 },
    { x: 8.8, y: 13.1 },
    { x: 8.6, y: 11.3 },
    { x: 10.0, y: 11.2 },
    { x: 11.2, y: 11.4 },
    { x: 10.1, y: 10.6 },
    { x: 10.2, y: 9.3 },
    { x: 10.9, y: 8.6 },
    { x: 11.0, y: 7.3 },
    { x: 10.5, y: 6.1 },
  ];

  // Curved western hook cape off NW forest (exact sector 01 silhouette!)
  const nwWestHook: Point2D[] = [
    { x: 8.6, y: 7.5 },
    { x: 9.7, y: 6.4 },
    { x: 10.4, y: 7.5 },
    { x: 10.3, y: 8.9 },
    { x: 9.4, y: 8.8 },
    { x: 9.5, y: 7.8 },
    { x: 8.5, y: 8.2 },
  ];

  // Comma-shaped western island in Putrid Gulf (sector 01/02)
  const westCommaIsle: Point2D[] = [
    { x: 5.5, y: 7.1 },
    { x: 6.2, y: 7.2 },
    { x: 6.8, y: 8.2 },
    { x: 7.4, y: 8.5 },
    { x: 6.9, y: 9.1 },
    { x: 6.0, y: 8.7 },
    { x: 5.4, y: 7.9 },
  ];

  // Valtira chalky island nestled inside eastern bay
  const valtiraIsle: Point2D[] = [
    { x: 32.8, y: 10.6 },
    { x: 34.0, y: 9.7 },
    { x: 35.1, y: 10.3 },
    { x: 36.1, y: 10.4 },
    { x: 36.0, y: 11.6 },
    { x: 35.1, y: 12.6 },
    { x: 34.0, y: 12.3 },
    { x: 33.4, y: 11.6 },
    { x: 32.6, y: 11.4 },
  ];

  // The Wilds tropical jungle island
  const theWildsIsle: Point2D[] = [
    { x: 36.6, y: 9.4 },
    { x: 37.8, y: 9.0 },
    { x: 39.4, y: 8.9 },
    { x: 40.9, y: 9.1 },
    { x: 42.1, y: 9.9 },
    { x: 42.5, y: 10.9 },
    { x: 41.4, y: 12.0 },
    { x: 40.1, y: 12.7 },
    { x: 38.5, y: 12.7 },
    { x: 37.3, y: 12.0 },
    { x: 36.9, y: 10.8 },
  ];

  // NE snowy monochrome continent peeking in top-right corner
  const neFrostCorner: Point2D[] = [
    { x: 39.2, y: -0.5 },
    { x: 48.5, y: -0.5 },
    { x: 48.5, y: 8.8 },
    { x: 47.0, y: 8.2 },
    { x: 46.1, y: 6.6 },
    { x: 45.4, y: 5.0 },
    { x: 44.3, y: 3.7 },
    { x: 43.1, y: 2.7 },
    { x: 41.3, y: 2.0 },
    { x: 39.8, y: 0.9 },
  ];

  // SE Dragon-Spine Hourglass Island (exact 3-lobe shape from sectors 11 & 12!)
  const seNorthLobe: Point2D[] = [
    { x: 37.5, y: 19.6 },
    { x: 38.8, y: 19.2 },
    { x: 40.5, y: 20.3 },
    { x: 41.3, y: 21.8 },
    { x: 40.4, y: 22.8 },
    { x: 38.3, y: 22.9 },
    { x: 37.0, y: 22.5 },
    { x: 36.8, y: 21.0 },
  ];
  const seEastMidLobe: Point2D[] = [
    { x: 37.0, y: 22.4 },
    { x: 39.1, y: 22.9 },
    { x: 40.9, y: 23.1 },
    { x: 41.2, y: 24.6 },
    { x: 40.5, y: 26.2 },
    { x: 39.2, y: 27.1 },
    { x: 37.9, y: 26.8 },
    { x: 37.3, y: 25.5 },
    { x: 36.3, y: 24.8 },
    { x: 36.4, y: 23.3 },
  ];
  const seSouthLobe: Point2D[] = [
    { x: 34.4, y: 25.0 },
    { x: 36.5, y: 24.7 },
    { x: 37.9, y: 26.0 },
    { x: 38.1, y: 27.7 },
    { x: 37.0, y: 29.0 },
    { x: 35.3, y: 29.2 },
    { x: 34.0, y: 28.4 },
    { x: 33.6, y: 27.2 },
    { x: 32.3, y: 27.1 },
    { x: 31.9, y: 26.0 },
    { x: 33.1, y: 25.2 },
  ];

  const polygons = [
    mainContinent,
    nwWestHook,
    westCommaIsle,
    valtiraIsle,
    theWildsIsle,
    neFrostCorner,
    seNorthLobe,
    seEastMidLobe,
    seSouthLobe,
  ];

  // Precise scattered islets, barrier reefs, volcanic dots & Mourning Rings archipelago spiral!
  const blobs: LandBlob[] = [
    // Mourning Rings concentric rocky archipelago specks (logarithmic whirlpool spiral of tiny brown crags!)
    { x: 4.5, y: 4.3, rx: 0.24, ry: 0.28 },
    { x: 5.0, y: 4.6, rx: 0.22, ry: 0.19 },
    { x: 3.4, y: 3.2, rx: 0.16, ry: 0.14 },
    { x: 5.9, y: 2.8, rx: 0.18, ry: 0.13 },
    { x: 6.6, y: 4.2, rx: 0.15, ry: 0.2 },
    { x: 5.7, y: 5.7, rx: 0.2, ry: 0.15 },
    { x: 3.6, y: 5.8, rx: 0.18, ry: 0.14 },
    { x: 2.6, y: 4.5, rx: 0.15, ry: 0.18 },
    { x: 4.4, y: 2.1, rx: 0.19, ry: 0.13 },
    { x: 7.2, y: 3.2, rx: 0.14, ry: 0.15 },
    { x: 6.9, y: 5.6, rx: 0.15, ry: 0.13 },
    { x: 2.3, y: 3.0, rx: 0.14, ry: 0.16 },
    { x: 4.8, y: 6.6, rx: 0.18, ry: 0.13 },
    { x: 3.1, y: 2.3, rx: 0.14, ry: 0.12 },
    { x: 5.3, y: 2.0, rx: 0.15, ry: 0.12 },
    { x: 6.5, y: 2.4, rx: 0.14, ry: 0.14 },
    { x: 7.5, y: 4.5, rx: 0.15, ry: 0.16 },
    { x: 6.3, y: 6.3, rx: 0.16, ry: 0.14 },
    { x: 3.0, y: 6.1, rx: 0.15, ry: 0.13 },
    { x: 2.1, y: 5.1, rx: 0.14, ry: 0.15 },
    { x: 3.9, y: 3.8, rx: 0.13, ry: 0.13 },
    { x: 5.5, y: 3.7, rx: 0.13, ry: 0.13 },
    { x: 5.4, y: 5.1, rx: 0.14, ry: 0.13 },
    { x: 3.8, y: 5.0, rx: 0.14, ry: 0.13 },

    // Two-Spike Island + north/south buds + dark reef rocks + eastern barrier reef chain
    { x: 25.7, y: 4.3, rx: 1.05, ry: 0.88 },
    { x: 25.9, y: 3.1, rx: 0.36, ry: 0.34 },
    { x: 25.6, y: 5.5, rx: 0.36, ry: 0.4 },
    { x: 24.5, y: 4.2, rx: 0.18, ry: 0.15 },
    { x: 26.8, y: 4.7, rx: 0.17, ry: 0.16 },
    { x: 26.4, y: 5.1, rx: 0.18, ry: 0.14 },
    { x: 27.5, y: 6.3, rx: 0.34, ry: 0.18 },
    { x: 28.6, y: 6.1, rx: 0.56, ry: 0.22 },
    { x: 30.1, y: 5.9, rx: 0.52, ry: 0.18 },
    { x: 30.2, y: 4.3, rx: 0.22, ry: 0.25 },

    // NW & Putrid Sea western coastal islets (matched to sector 01/02/03!)
    { x: 10.9, y: 4.6, rx: 0.42, ry: 0.55, rot: 0.35 },
    { x: 11.7, y: 4.2, rx: 0.35, ry: 0.32 },
    { x: 4.5, y: 8.1, rx: 0.22, ry: 0.32 },
    { x: 8.1, y: 10.4, rx: 0.24, ry: 0.55 },
    { x: 9.1, y: 10.1, rx: 0.34, ry: 0.56, rot: -0.25 },
    { x: 6.4, y: 10.8, rx: 0.26, ry: 0.26 },
    { x: 5.5, y: 11.4, rx: 0.34, ry: 0.32 },
    { x: 7.9, y: 12.2, rx: 0.18, ry: 0.22 },
    { x: 8.0, y: 13.2, rx: 0.2, ry: 0.28 },
    { x: 5.7, y: 14.3, rx: 0.34, ry: 0.36 },
    { x: 6.8, y: 14.5, rx: 0.3, ry: 0.34 },
    { x: 6.0, y: 15.4, rx: 0.32, ry: 0.46, rot: 0.25 },
    { x: 8.2, y: 17.3, rx: 0.22, ry: 0.36 },
    // SW Golden Bay archipelago arc (west of Durnor)
    { x: 7.3, y: 19.6, rx: 0.3, ry: 0.56, rot: 0.3 },
    { x: 6.0, y: 20.6, rx: 0.32, ry: 0.32 },
    { x: 5.1, y: 21.4, rx: 0.24, ry: 0.3 },
    { x: 7.6, y: 22.1, rx: 0.34, ry: 0.32 },
    { x: 8.4, y: 21.7, rx: 0.28, ry: 0.24 },
    { x: 9.1, y: 21.9, rx: 0.22, ry: 0.16 },

    // The Wilds surrounding palm islets & Sunken Atolls
    { x: 40.9, y: 8.1, rx: 0.38, ry: 0.52, rot: -0.2 },
    { x: 37.1, y: 13.5, rx: 0.42, ry: 0.62, rot: 0.35 },
    { x: 41.8, y: 14.1, rx: 0.38, ry: 0.68, rot: -0.35 },
    { x: 36.1, y: 14.9, rx: 0.48, ry: 0.3 },
    { x: 35.1, y: 15.4, rx: 0.32, ry: 0.24 },
    { x: 37.5, y: 14.2, rx: 0.28, ry: 0.24 },
    { x: 38.4, y: 14.4, rx: 0.36, ry: 0.32 },
    { x: 39.5, y: 6.8, rx: 0.34, ry: 0.24 },
    { x: 35.2, y: 9.6, rx: 0.16, ry: 0.2 }, // Sea-stack lighthouse rock

    // NE frost offshore islet
    { x: 43.3, y: 3.4, rx: 0.5, ry: 0.4 },

    // Western sea-crag shoals along SE strait
    { x: 35.0, y: 21.4, rx: 0.85, ry: 1.15, rot: 0.35 },
    { x: 33.8, y: 22.8, rx: 0.68, ry: 0.82, rot: 0.45 },
    { x: 32.5, y: 24.0, rx: 0.56, ry: 0.72, rot: 0.4 },

    // Eastern Reef Archipelago north of Shifting Currents (sector 11!)
    { x: 43.5, y: 19.3, rx: 0.34, ry: 0.26 },
    { x: 43.4, y: 20.3, rx: 0.32, ry: 0.28 },
    { x: 44.3, y: 20.9, rx: 0.3, ry: 0.28 },
    { x: 43.6, y: 21.5, rx: 0.28, ry: 0.26 },

    // Tiny islets SW of SE island
    { x: 33.5, y: 29.7, rx: 0.32, ry: 0.34 },
    { x: 32.7, y: 30.6, rx: 0.22, ry: 0.2 },
  ];

  // 4 Authentic Inland Freshwater Lakes & Tarns (matched to original — steppe & heartwood are forested, not lakes!)
  const lakes: LandBlob[] = [
    { x: 13.15, y: 6.4, rx: 0.34, ry: 0.3 }, // NW Arcane Violet Tarn
    { x: 31.4, y: 8.5, rx: 0.56, ry: 0.5, rot: -0.1 }, // Old Marsh Tarn
    { x: 29.3, y: 19.4, rx: 0.36, ry: 0.32 }, // Mirewood Tarn
    { x: 35.6, y: 27.6, rx: 0.82, ry: 0.58, rot: -0.08 }, // SE Island Emerald Lake
  ];

  const hm = new Uint8Array(GRID_W * GRID_H);
  const fw = new Uint8Array(GRID_W * GRID_H);

  // Precompute AABBs and rotation trig so the 480x330 raster executes in <40ms!
  const MARGIN = 2.6;
  const polyBoxes = polygons.map((poly) => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of poly) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { poly, minX: minX - MARGIN, maxX: maxX + MARGIN, minY: minY - MARGIN, maxY: maxY + MARGIN };
  });

  const blobPre = blobs.map((bl) => {
    const maxR = Math.max(bl.rx, bl.ry);
    return {
      ...bl,
      cos: bl.rot ? Math.cos(bl.rot) : 1,
      sin: bl.rot ? Math.sin(bl.rot) : 0,
      minR: Math.min(bl.rx, bl.ry),
      bound: maxR + MARGIN,
    };
  });

  const lakePre = lakes.map((lk) => ({
    ...lk,
    cos: lk.rot ? Math.cos(lk.rot) : 1,
    sin: lk.rot ? Math.sin(lk.rot) : 0,
    minR: Math.min(lk.rx, lk.ry),
    bound: Math.max(lk.rx, lk.ry) + 0.55,
  }));

  for (let gy = 0; gy < GRID_H; gy++) {
    const wy = (gy / (GRID_H - 1)) * H_CELLS;
    for (let gx = 0; gx < GRID_W; gx++) {
      const wx = (gx / (GRID_W - 1)) * W_CELLS;
      const pt = { x: wx, y: wy };

      let bestSigned = -3.0;
      for (const pb of polyBoxes) {
        if (wx < pb.minX || wx > pb.maxX || wy < pb.minY || wy > pb.maxY) continue;
        const inside = pointInPolygon(pt, pb.poly);
        const edgeDist = distanceToPolyline(pt, pb.poly, true, false).dist;
        const signed = inside ? edgeDist : -edgeDist;
        if (signed > bestSigned) bestSigned = signed;
      }

      for (const bl of blobPre) {
        let dx = wx - bl.x;
        let dy = wy - bl.y;
        if (dx < -bl.bound || dx > bl.bound || dy < -bl.bound || dy > bl.bound) continue;
        if (bl.rot) {
          const rx = dx * bl.cos - dy * bl.sin;
          const ry = dx * bl.sin + dy * bl.cos;
          dx = rx;
          dy = ry;
        }
        const ellDist = Math.hypot(dx / bl.rx, dy / bl.ry);
        const approxSigned = (1 - ellDist) * bl.minR;
        if (approxSigned > bestSigned) bestSigned = approxSigned;
      }

      const idx = gy * GRID_W + gx;
      if (bestSigned <= -2.65) {
        hm[idx] = 0;
        continue;
      }

      // Crisp 3-octave continental fractal coastline perturbation!
      const nCoarse = fbm2D(wx * 0.48, wy * 0.48, 7731, 4, 0.55) - 0.5;
      const nFine = fbm2D(wx * 1.45, wy * 1.45, 9123, 3, 0.54) - 0.5;
      const nMicro = fbm2D(wx * 3.1, wy * 3.1, 4111, 2, 0.5) - 0.5;
      const organicSigned = bestSigned + nCoarse * 0.48 + nFine * 0.22 + nMicro * 0.08;

      const rawH = 128 + organicSigned * 62;
      hm[idx] = Math.max(0, Math.min(255, Math.round(rawH)));

      let lakeBest = -99;
      for (const lk of lakePre) {
        let dx = wx - lk.x;
        let dy = wy - lk.y;
        if (dx < -lk.bound || dx > lk.bound || dy < -lk.bound || dy > lk.bound) continue;
        if (lk.rot) {
          const rx = dx * lk.cos - dy * lk.sin;
          const ry = dx * lk.sin + dy * lk.cos;
          dx = rx;
          dy = ry;
        }
        const ed = (1 - Math.hypot(dx / lk.rx, dy / lk.ry)) * lk.minR;
        if (ed > lakeBest) lakeBest = ed;
      }
      if (lakeBest > -0.25) {
        const lakeVal = 128 + (lakeBest + nFine * 0.2) * 190;
        fw[idx] = Math.max(0, Math.min(255, Math.round(lakeVal)));
      }
    }
  }

  cachedTrofraderraHeightfields = {
    heightmapB64: encodeMaskB64(hm),
    freshwaterB64: encodeMaskB64(fw),
  };
  return cachedTrofraderraHeightfields;
}

export function createTrofraderraWorldMap(): DcMapDocument {
  const now = new Date().toISOString();
  const baseTheme = getWorldThemeById("aged_antique");
  // Calibrated Aged Antique Atlas palette matching the luminous cream parchment,
  // warm mottled olive-slate seas (keeping sea beasts razor-clear!), and crisp dark coastlines.
  const theme: WorldThemeConfig = {
    ...baseTheme,
    oceanColorHex: "#666B5F",
    oceanDeepColorHex: "#464C44",
    oceanStainHex: "#473D2C",
    oceanTextureAssetId: "world-atlas/textures/world_ocean_weathered_vellum_hq.png",
    landBaseColorHex: "#DCD0AE",
    landTextureAssetId: "world-atlas/textures/world_paper_antique_rag_hq.png",
    coastlineInkHex: "#1B140D",
    coastlineWidthPx: 2.0,
    vignetteStrength: 0.24,
    paperGrainStrength: 0.56,
  };
  const { heightmapB64, freshwaterB64 } = buildTrofraderraHeightfields();
  const rng = makeRng(42079);

  // =========================================================================
  // 1. Ocean & Land Watercolor Washes + Antique Stipple Surface Strokes
  // =========================================================================
  const biomeStrokes: WorldBiomeStroke[] = [
    // --- OCEAN WASHES ---
    {
      id: "tf-oc-putrid-1",
      target: "ocean",
      points: [{ x: 6.2, y: 12.4 }, { x: 6.8, y: 15.2 }, { x: 7.4, y: 17.8 }],
      radiusCells: 4.8,
      colorHex: "#556822",
      opacity: 0.58,
      softness: 0.88,
      roughness: 0.35,
      seed: 11,
    },
    {
      id: "tf-oc-putrid-2",
      target: "ocean",
      points: [{ x: 4.6, y: 16.5 }, { x: 8.2, y: 15.6 }],
      radiusCells: 3.6,
      colorHex: "#62742A",
      opacity: 0.42,
      softness: 0.9,
      roughness: 0.35,
      seed: 12,
    },
    {
      id: "tf-oc-mourning",
      target: "ocean",
      points: [{ x: 4.6, y: 4.4 }],
      radiusCells: 4.3,
      colorHex: "#433226",
      opacity: 0.52,
      softness: 0.85,
      roughness: 0.3,
      seed: 13,
    },
    {
      id: "tf-oc-north-slate",
      target: "ocean",
      points: [{ x: 16.5, y: 3.4 }, { x: 22.5, y: 3.6 }, { x: 30.5, y: 3.4 }, { x: 39.5, y: 4.8 }, { x: 43.2, y: 5.8 }],
      radiusCells: 5.6,
      colorHex: "#5A6050",
      opacity: 0.34,
      softness: 0.9,
      roughness: 0.3,
      seed: 14,
    },
    // Warm mottled olive-parchment ocean around Leviathan's Expanse so the copperplate sea serpent & galleon pop crisply!
    {
      id: "tf-oc-leviathan-glow",
      target: "ocean",
      points: [{ x: 19.5, y: 26.2 }, { x: 24.3, y: 26.2 }, { x: 27.5, y: 26.5 }],
      radiusCells: 5.8,
      colorHex: "#6C6E5B",
      opacity: 0.44,
      softness: 0.9,
      roughness: 0.35,
      seed: 15,
    },
    // Deep shadow anchored strictly in the outer SW & bottom-left corners beneath title & compass
    {
      id: "tf-oc-sw-shadow",
      target: "ocean",
      points: [{ x: 6.5, y: 28.5 }, { x: 12.2, y: 28.8 }, { x: 14.5, y: 25.0 }],
      radiusCells: 5.5,
      colorHex: "#2B2C24",
      opacity: 0.52,
      softness: 0.9,
      roughness: 0.35,
      seed: 151,
    },
    // Smoky atmospheric slate-indigo strait between main continent and SE Dragon-Spine Island
    {
      id: "tf-oc-strait-blue",
      target: "ocean",
      points: [{ x: 36.6, y: 20.8 }, { x: 35.4, y: 23.0 }, { x: 33.7, y: 24.8 }, { x: 31.8, y: 25.8 }],
      radiusCells: 2.25,
      colorHex: "#2F435E",
      opacity: 0.52,
      softness: 0.86,
      roughness: 0.25,
      seed: 16,
    },
    // Subtle misty sea-fog stipple around western Dragon-Spine crags
    {
      id: "tf-oc-crag-mist",
      target: "ocean",
      pattern: "stipple",
      points: [{ x: 35.2, y: 20.4 }, { x: 33.8, y: 22.4 }, { x: 31.6, y: 24.8 }],
      radiusCells: 1.5,
      colorHex: "#D4C9A8",
      opacity: 0.38,
      softness: 0.78,
      roughness: 0.3,
      seed: 19,
    },
    {
      id: "tf-oc-somber",
      target: "ocean",
      points: [{ x: 36.8, y: 15.8 }, { x: 41.2, y: 16.5 }],
      radiusCells: 4.8,
      colorHex: "#4E5549",
      opacity: 0.32,
      softness: 0.88,
      roughness: 0.3,
      seed: 17,
    },
    {
      id: "tf-oc-abyss-pit",
      target: "ocean",
      points: [{ x: 41.7, y: 19.3 }],
      radiusCells: 1.45,
      colorHex: "#15191C",
      opacity: 0.72,
      softness: 0.78,
      roughness: 0.2,
      seed: 18,
    },

    // --- LAND WATERCOLOR BIOME WASHES ---
    {
      id: "tf-ld-nw-forest",
      target: "land",
      points: [{ x: 12.6, y: 5.5 }, { x: 13.8, y: 6.5 }, { x: 12.2, y: 8.6 }, { x: 13.8, y: 9.2 }, { x: 11.4, y: 9.8 }],
      radiusCells: 2.7,
      colorHex: "#3D6F1D",
      opacity: 0.8,
      softness: 0.75,
      roughness: 0.4,
      seed: 21,
    },
    // Dark charred shadow inside NW western hook bay (sector 01!)
    {
      id: "tf-ld-nw-hook-dark",
      target: "land",
      points: [{ x: 9.3, y: 7.4 }],
      radiusCells: 0.85,
      colorHex: "#2A241A",
      opacity: 0.72,
      softness: 0.7,
      roughness: 0.3,
      seed: 210,
    },
    // NW Arcane Violet Corruption Scar & Citadel Glow
    {
      id: "tf-ld-nw-violet",
      target: "land",
      points: [{ x: 13.15, y: 6.4 }, { x: 13.7, y: 7.9 }, { x: 14.3, y: 9.5 }, { x: 15.0, y: 10.0 }],
      radiusCells: 1.25,
      colorHex: "#6222A6",
      opacity: 0.84,
      softness: 0.72,
      roughness: 0.35,
      seed: 22,
    },
    // Stannen Pale Sandy Plain + Antique Ink Stipple Texture!
    {
      id: "tf-ld-stannen-plain",
      target: "land",
      points: [{ x: 10.1, y: 12.4 }, { x: 10.5, y: 14.3 }],
      radiusCells: 2.3,
      colorHex: "#E6DCBA",
      opacity: 0.72,
      softness: 0.78,
      roughness: 0.3,
      seed: 23,
    },
    {
      id: "tf-ld-stannen-stipple",
      target: "land",
      pattern: "stipple",
      points: [{ x: 9.8, y: 12.2 }, { x: 11.1, y: 12.4 }, { x: 10.3, y: 13.8 }],
      radiusCells: 1.55,
      colorHex: "#4E3E28",
      opacity: 0.56,
      softness: 0.68,
      roughness: 0.3,
      seed: 231,
    },
    // NE Chalk Cape & Valtira Pale Limestone + Antique Ink Stipple Texture!
    {
      id: "tf-ld-ne-cape-pale",
      target: "land",
      points: [{ x: 34.4, y: 7.9 }, { x: 34.5, y: 11.1 }],
      radiusCells: 1.95,
      colorHex: "#E9E1C8",
      opacity: 0.74,
      softness: 0.72,
      roughness: 0.3,
      seed: 232,
    },
    {
      id: "tf-ld-ne-cape-stipple",
      target: "land",
      pattern: "stipple",
      points: [{ x: 34.4, y: 7.9 }, { x: 35.1, y: 8.3 }, { x: 34.4, y: 11.1 }],
      radiusCells: 1.4,
      colorHex: "#4E3E28",
      opacity: 0.58,
      softness: 0.68,
      roughness: 0.3,
      seed: 233,
    },
    // Delicate sparse steppe stipple across Northern Steppe & Heartland plains
    {
      id: "tf-ld-steppe-stipple",
      target: "land",
      pattern: "stipple",
      points: [{ x: 18.5, y: 7.8 }, { x: 21.6, y: 8.5 }, { x: 24.4, y: 8.0 }],
      radiusCells: 2.2,
      colorHex: "#5B4A32",
      opacity: 0.38,
      softness: 0.75,
      roughness: 0.3,
      seed: 234,
    },
    // Hidden Mountain Crater Valley (Jade Grove)
    {
      id: "tf-ld-jade-crater",
      target: "land",
      points: [{ x: 15.6, y: 13.9 }],
      radiusCells: 1.45,
      colorHex: "#34641B",
      opacity: 0.82,
      softness: 0.72,
      roughness: 0.3,
      seed: 24,
    },
    // Northern Golden Steppe
    {
      id: "tf-ld-north-steppe",
      target: "land",
      points: [{ x: 18.6, y: 7.8 }, { x: 21.8, y: 8.2 }, { x: 25.0, y: 7.8 }],
      radiusCells: 3.1,
      colorHex: "#D4C28B",
      opacity: 0.56,
      softness: 0.84,
      roughness: 0.3,
      seed: 25,
    },
    // Central Arcane Violet Grove + Glacial Snow Apron (Frostpeak)
    {
      id: "tf-ld-mid-violet",
      target: "land",
      points: [{ x: 23.9, y: 11.0 }],
      radiusCells: 1.0,
      colorHex: "#5B2698",
      opacity: 0.84,
      softness: 0.68,
      roughness: 0.3,
      seed: 27,
    },
    {
      id: "tf-ld-frostpeak-snow",
      target: "land",
      points: [{ x: 25.4, y: 10.6 }, { x: 26.5, y: 10.6 }],
      radiusCells: 1.25,
      colorHex: "#E8F2F8",
      opacity: 0.92,
      softness: 0.62,
      roughness: 0.25,
      seed: 28,
    },
    // Central Emerald Forest (Heartwood) + SE Coastal Meadow
    {
      id: "tf-ld-heartwood",
      target: "land",
      points: [{ x: 24.4, y: 13.0 }, { x: 26.5, y: 13.4 }, { x: 25.2, y: 14.6 }],
      radiusCells: 2.4,
      colorHex: "#4E7A30",
      opacity: 0.74,
      softness: 0.8,
      roughness: 0.35,
      seed: 29,
    },
    {
      id: "tf-ld-east-green",
      target: "land",
      points: [{ x: 31.4, y: 14.5 }, { x: 31.4, y: 17.8 }, { x: 29.0, y: 19.6 }, { x: 26.8, y: 20.1 }],
      radiusCells: 2.7,
      colorHex: "#698E3E",
      opacity: 0.7,
      softness: 0.82,
      roughness: 0.35,
      seed: 30,
    },
    {
      id: "tf-ld-south-meadow",
      target: "land",
      points: [{ x: 18.8, y: 15.8 }, { x: 21.8, y: 17.5 }, { x: 14.6, y: 18.2 }],
      radiusCells: 3.0,
      colorHex: "#90A85D",
      opacity: 0.44,
      softness: 0.88,
      roughness: 0.3,
      seed: 31,
    },
    {
      id: "tf-ld-twospike",
      target: "land",
      points: [{ x: 25.7, y: 4.3 }],
      radiusCells: 1.5,
      colorHex: "#A85E32",
      opacity: 0.74,
      softness: 0.72,
      roughness: 0.3,
      seed: 32,
    },
    {
      id: "tf-ld-wilds",
      target: "land",
      points: [{ x: 38.6, y: 10.6 }, { x: 40.2, y: 10.9 }],
      radiusCells: 2.25,
      colorHex: "#447A20",
      opacity: 0.8,
      softness: 0.75,
      roughness: 0.35,
      seed: 33,
    },
    {
      id: "tf-ld-ne-snow",
      target: "land",
      points: [{ x: 43.5, y: 1.5 }, { x: 46.8, y: 4.5 }],
      radiusCells: 3.8,
      colorHex: "#DFD7C4",
      opacity: 0.76,
      softness: 0.75,
      roughness: 0.3,
      seed: 34,
    },
    {
      id: "tf-ld-se-north",
      target: "land",
      points: [{ x: 38.8, y: 21.1 }, { x: 37.2, y: 22.7 }, { x: 35.8, y: 27.2 }],
      radiusCells: 1.65,
      colorHex: "#477824",
      opacity: 0.74,
      softness: 0.75,
      roughness: 0.3,
      seed: 35,
    },
    {
      id: "tf-ld-se-south",
      target: "land",
      points: [{ x: 35.6, y: 27.6 }, { x: 38.8, y: 25.2 }],
      radiusCells: 2.0,
      colorHex: "#B59A5E",
      opacity: 0.5,
      softness: 0.8,
      roughness: 0.3,
      seed: 36,
    },
  ];

  // =========================================================================
  // 2. 18 Slim, Delicate Meandering Rivers & Tributaries (Seamless Mouth Fade!)
  // =========================================================================
  const riverColor = "#556852";
  const riverBank = "#3B4232";
  const makeRiver = (
    id: string,
    name: string,
    points: Point2D[],
    startW = 0.024,
    endW = 0.15,
    seed = 100,
  ): WorldRiver => ({
    id,
    name,
    points,
    startWidthCells: startW,
    endWidthCells: endW,
    meanderRoughness: 0.36,
    meanderScale: 1.05,
    curved: true,
    colorHex: riverColor,
    bankColorHex: riverBank,
    fadeMouth: true,
    fadeSource: true,
    mouthFadeRatio: 0.26,
    clipToLand: true,
    seed,
  });

  const rivers: WorldRiver[] = [
    // 1. NW Arcane River -> Northern Gulf bay
    makeRiver("tf-riv-nw", "Arcane Reach", [{ x: 16.0, y: 10.6 }, { x: 16.7, y: 9.4 }, { x: 16.9, y: 8.2 }, { x: 16.4, y: 7.1 }], 0.026, 0.17, 101),
    // 2. Western Stannen Valley River -> SW Putrid Bay north of Durnor
    makeRiver("tf-riv-west", "Stannen Run", [{ x: 13.0, y: 13.4 }, { x: 13.0, y: 15.5 }, { x: 12.6, y: 17.5 }, { x: 11.4, y: 18.9 }, { x: 9.4, y: 19.8 }], 0.025, 0.18, 102),
    // 3. Tributary into Stannen Run
    makeRiver("tf-riv-west-trib", "Bramble Creek", [{ x: 11.6, y: 18.2 }, { x: 10.7, y: 19.0 }], 0.02, 0.09, 103),
    // 4. SW Sunhaven Valley River -> Sunhaven Bay
    makeRiver("tf-riv-sunhaven", "Sunhaven Stream", [{ x: 14.9, y: 16.4 }, { x: 15.6, y: 17.8 }, { x: 15.1, y: 19.2 }, { x: 14.2, y: 20.5 }], 0.022, 0.14, 104),
    // 5. Twilshire Main River -> Kingport Estuary
    makeRiver("tf-riv-twilshire", "Twilshire River", [{ x: 21.0, y: 13.4 }, { x: 21.3, y: 14.6 }, { x: 20.7, y: 15.8 }, { x: 18.8, y: 16.5 }, { x: 18.1, y: 18.4 }, { x: 18.3, y: 20.4 }], 0.026, 0.19, 105),
    // 6. Twilshire Western Tributary
    makeRiver("tf-riv-twil-w", "Abbey Brook", [{ x: 19.2, y: 14.8 }, { x: 19.5, y: 15.8 }, { x: 19.2, y: 16.4 }], 0.02, 0.08, 106),
    // 7. Central Heartwood River -> Freyharbor Estuary
    makeRiver("tf-riv-central", "Heartwood River", [{ x: 23.8, y: 11.5 }, { x: 23.7, y: 14.0 }, { x: 24.4, y: 16.2 }, { x: 24.1, y: 18.6 }, { x: 24.5, y: 20.4 }, { x: 25.0, y: 21.4 }], 0.026, 0.19, 107),
    // 8. Central West Fork into Heartwood
    makeRiver("tf-riv-heart-w", "Sable Brook", [{ x: 22.8, y: 12.2 }, { x: 23.7, y: 13.1 }], 0.02, 0.09, 108),
    // 9. Mid-South Stream -> East of Freyharbor
    makeRiver("tf-riv-frey-e", "Frey Fork", [{ x: 26.2, y: 17.5 }, { x: 25.9, y: 19.4 }, { x: 26.0, y: 20.8 }, { x: 26.3, y: 21.7 }], 0.022, 0.13, 109),
    // 10. East-Central River (from Dark Pine forest -> South Coast!)
    makeRiver("tf-riv-east-south", "Greenvale River", [{ x: 28.6, y: 16.6 }, { x: 27.3, y: 17.4 }, { x: 27.3, y: 19.4 }, { x: 27.5, y: 21.9 }], 0.024, 0.16, 110),
    // 11. Mirewood -> Velmora Stream
    makeRiver("tf-riv-velmora", "Velmora Creek", [{ x: 29.3, y: 19.4 }, { x: 29.7, y: 20.4 }, { x: 30.2, y: 21.3 }], 0.022, 0.14, 111),
    // 12. Northern Peel River -> Northern Gulf
    makeRiver("tf-riv-peel", "Peel River", [{ x: 24.9, y: 10.4 }, { x: 24.3, y: 9.0 }, { x: 24.4, y: 7.8 }, { x: 24.5, y: 6.8 }], 0.024, 0.16, 112),
    // 13. Steppe Marsh Outlet -> Peel River
    makeRiver("tf-riv-steppe-pool", "Marshrun", [{ x: 22.3, y: 8.0 }, { x: 23.4, y: 8.5 }, { x: 24.3, y: 8.4 }], 0.02, 0.08, 113),
    // 14. Old Marsh Feeder Stream -> Old Marsh Lake
    makeRiver("tf-riv-oldmarsh", "Marshbrook", [{ x: 31.1, y: 11.4 }, { x: 31.3, y: 10.0 }, { x: 31.4, y: 8.8 }], 0.022, 0.13, 114),
    // 15. Old Marsh Eastern Outlet -> Riven Bay
    makeRiver("tf-riv-riven-out", "Riven Brook", [{ x: 31.7, y: 8.8 }, { x: 32.5, y: 9.1 }, { x: 33.0, y: 9.6 }], 0.022, 0.12, 115),
    // 16. Western Bay Inlet Stream (North of Goldfield)
    makeRiver("tf-riv-king-e", "Obreyis Brook", [{ x: 21.2, y: 19.4 }, { x: 21.1, y: 20.9 }], 0.02, 0.1, 116),
    // 17. SE Island Winding River -> Southern Bay
    makeRiver("tf-riv-se-isle", "Dragonrun", [{ x: 38.2, y: 23.2 }, { x: 39.2, y: 24.5 }, { x: 38.4, y: 25.8 }, { x: 37.8, y: 26.8 }], 0.022, 0.13, 117),
    // 18. SE Island Northern Creek
    makeRiver("tf-riv-se-north", "Mistcreek", [{ x: 38.7, y: 21.5 }, { x: 37.5, y: 21.8 }, { x: 36.8, y: 22.0 }], 0.02, 0.1, 118),
  ];

  // =========================================================================
  // 3. Complete Spiderweb of 30+ Kingdom Highways & Small-Town Tracks
  // =========================================================================
  const roadInk = "#1F170F";
  const makeRoad = (
    id: string,
    name: string,
    points: Point2D[],
    style: WorldTrail["style"] = "dotted",
    widthCells = 0.03,
    opacity = 0.84,
  ): WorldTrail => ({
    id,
    name,
    points,
    style,
    widthCells,
    colorHex: roadInk,
    dashScale: style === "dotted" ? 0.72 : 0.92,
    curved: true,
    opacity,
  });

  const trails: WorldTrail[] = [
    // Major Dashed Trunk Highways
    makeRoad("tf-rd-north-trunk", "Northern Steppe Highway", [{ x: 14.3, y: 9.7 }, { x: 15.8, y: 9.5 }, { x: 17.1, y: 8.6 }, { x: 18.2, y: 8.1 }, { x: 19.5, y: 7.3 }, { x: 20.9, y: 7.4 }, { x: 21.6, y: 8.3 }, { x: 23.0, y: 8.7 }, { x: 24.4, y: 8.2 }, { x: 26.0, y: 8.1 }, { x: 27.6, y: 8.2 }, { x: 29.4, y: 7.9 }, { x: 30.8, y: 7.2 }, { x: 32.6, y: 7.3 }, { x: 33.1, y: 8.6 }], "dashed", 0.044, 0.88),
    makeRoad("tf-rd-east-coast", "Eastern Coastal Highway", [{ x: 33.1, y: 8.6 }, { x: 32.2, y: 10.2 }, { x: 31.6, y: 12.2 }, { x: 31.9, y: 14.4 }, { x: 32.1, y: 16.6 }, { x: 32.6, y: 17.6 }, { x: 31.8, y: 19.4 }, { x: 30.2, y: 21.1 }], "dashed", 0.04, 0.86),
    makeRoad("tf-rd-south-inland", "Southern Heartland Highway", [{ x: 16.5, y: 18.6 }, { x: 18.1, y: 19.1 }, { x: 20.2, y: 18.2 }, { x: 21.5, y: 18.5 }, { x: 22.8, y: 18.4 }, { x: 23.8, y: 19.1 }, { x: 24.0, y: 20.6 }, { x: 25.0, y: 21.0 }], "dashed", 0.042, 0.86),
    makeRoad("tf-rd-frey-velmora", "Greenvale Road", [{ x: 24.5, y: 20.4 }, { x: 25.9, y: 19.3 }, { x: 27.6, y: 19.6 }, { x: 29.1, y: 20.3 }, { x: 30.2, y: 21.1 }], "dashed", 0.038, 0.85),
    makeRoad("tf-rd-durnor-sun", "Southwest Coastal Road", [{ x: 10.0, y: 21.1 }, { x: 11.4, y: 19.8 }, { x: 12.8, y: 19.6 }, { x: 13.0, y: 20.1 }, { x: 14.3, y: 20.4 }, { x: 15.6, y: 19.6 }, { x: 16.5, y: 18.6 }], "dashed", 0.038, 0.85),

    // Intricate Dotted Regional & Small-Town Network!
    makeRoad("tf-rd-nw-west", "Stannen Road", [{ x: 14.3, y: 9.7 }, { x: 13.0, y: 11.3 }, { x: 11.8, y: 12.1 }, { x: 10.5, y: 13.6 }, { x: 11.3, y: 14.6 }, { x: 12.4, y: 15.5 }, { x: 12.6, y: 17.5 }, { x: 12.8, y: 19.6 }]),
    makeRoad("tf-rd-stannen-south", "Putrid Coast Track", [{ x: 10.5, y: 13.6 }, { x: 9.6, y: 14.6 }, { x: 10.8, y: 16.4 }, { x: 11.0, y: 18.4 }, { x: 9.6, y: 19.8 }, { x: 10.0, y: 21.1 }]),
    makeRoad("tf-rd-nw-valley", "Jade Pass Trail", [{ x: 13.0, y: 11.3 }, { x: 13.5, y: 13.2 }, { x: 13.5, y: 14.6 }, { x: 14.1, y: 16.3 }, { x: 15.2, y: 16.8 }, { x: 16.4, y: 17.4 }, { x: 16.5, y: 18.6 }]),
    makeRoad("tf-rd-arch-ns", "Great Arch Way", [{ x: 19.2, y: 6.3 }, { x: 18.2, y: 8.1 }, { x: 18.0, y: 10.4 }, { x: 18.2, y: 12.0 }, { x: 19.6, y: 13.1 }, { x: 20.6, y: 13.8 }]),
    makeRoad("tf-rd-steppe-mid", "Steppe Pool Path", [{ x: 21.6, y: 8.3 }, { x: 21.2, y: 10.8 }, { x: 20.6, y: 13.8 }]),
    makeRoad("tf-rd-steppe-n", "Northwatch Coast Track", [{ x: 19.2, y: 6.3 }, { x: 21.7, y: 6.1 }, { x: 24.5, y: 7.2 }, { x: 25.8, y: 7.4 }]),
    makeRoad("tf-rd-peel-n", "Peel Carbel Spur", [{ x: 24.5, y: 7.2 }, { x: 24.4, y: 8.2 }, { x: 25.8, y: 7.4 }, { x: 26.0, y: 8.1 }]),
    makeRoad("tf-rd-ne-cape", "Chalk Cape Track", [{ x: 32.6, y: 7.3 }, { x: 34.4, y: 7.1 }, { x: 35.7, y: 7.8 }]),
    makeRoad("tf-rd-twil-east", "Frostgate Road", [{ x: 20.6, y: 13.8 }, { x: 22.4, y: 13.4 }, { x: 23.6, y: 12.6 }, { x: 25.9, y: 11.4 }, { x: 27.3, y: 11.8 }, { x: 29.4, y: 11.2 }, { x: 31.3, y: 10.8 }]),
    makeRoad("tf-rd-twil-south", "Twilford Track", [{ x: 20.6, y: 13.8 }, { x: 20.8, y: 15.2 }, { x: 21.2, y: 16.8 }, { x: 22.8, y: 17.8 }, { x: 22.8, y: 18.4 }]),
    makeRoad("tf-rd-twil-sw", "Abbey Crossing Road", [{ x: 18.2, y: 12.0 }, { x: 18.6, y: 13.8 }, { x: 19.1, y: 15.6 }, { x: 20.8, y: 15.2 }, { x: 20.4, y: 16.3 }]),
    makeRoad("tf-rd-twil-riv", "Kingport River Road", [{ x: 19.1, y: 15.6 }, { x: 18.0, y: 16.5 }, { x: 18.2, y: 18.0 }, { x: 18.1, y: 19.1 }, { x: 18.3, y: 20.1 }]),
    makeRoad("tf-rd-gold-south", "Goldfield Coast Road", [{ x: 15.4, y: 21.7 }, { x: 16.6, y: 20.8 }, { x: 18.3, y: 20.1 }, { x: 20.2, y: 20.2 }, { x: 20.9, y: 20.7 }, { x: 23.5, y: 20.6 }, { x: 25.0, y: 21.0 }]),
    makeRoad("tf-rd-gold-tip", "Peninsula Spur", [{ x: 15.4, y: 21.7 }, { x: 17.2, y: 22.8 }, { x: 17.6, y: 20.9 }]),
    makeRoad("tf-rd-gold-n", "Goldfield Forest Trail", [{ x: 15.4, y: 21.7 }, { x: 16.1, y: 19.8 }, { x: 16.5, y: 18.6 }]),
    makeRoad("tf-rd-heart-e", "Greenvale Spur", [{ x: 22.8, y: 18.4 }, { x: 24.4, y: 17.5 }, { x: 25.9, y: 17.2 }, { x: 25.9, y: 19.3 }]),
    makeRoad("tf-rd-east-pass", "Ridge Pass Trail", [{ x: 29.8, y: 16.4 }, { x: 31.1, y: 16.6 }, { x: 32.1, y: 16.6 }]),
    makeRoad("tf-rd-east-coast-2", "East Cove Spurs", [{ x: 32.6, y: 13.3 }, { x: 33.7, y: 14.0 }, { x: 33.1, y: 15.5 }, { x: 32.1, y: 16.6 }]),
    makeRoad("tf-rd-mire-track", "Mirewood Track", [{ x: 27.6, y: 19.6 }, { x: 29.1, y: 18.7 }, { x: 30.2, y: 18.9 }, { x: 31.2, y: 20.3 }]),
    makeRoad("tf-rd-frey-s", "Southern Headland Track", [{ x: 25.0, y: 21.0 }, { x: 27.5, y: 21.9 }, { x: 30.2, y: 21.1 }]),
    makeRoad("tf-rd-se-ferry", "Goldfield Sea Lane", [{ x: 17.4, y: 22.7 }, { x: 19.2, y: 22.0 }, { x: 20.9, y: 21.0 }], "dotted", 0.032, 0.48),
    // SE Dragon-Spine Island Road Loop & Spurs
    makeRoad("tf-rd-se-1", "Dragon-Spine Loop", [{ x: 38.5, y: 19.3 }, { x: 40.2, y: 20.7 }, { x: 40.2, y: 22.2 }, { x: 38.7, y: 23.9 }, { x: 39.8, y: 25.6 }, { x: 38.8, y: 26.4 }, { x: 37.3, y: 26.5 }, { x: 35.5, y: 26.2 }, { x: 33.0, y: 27.0 }]),
    makeRoad("tf-rd-se-2", "Emerald Lake Path", [{ x: 35.5, y: 26.2 }, { x: 34.4, y: 27.5 }, { x: 35.9, y: 28.6 }, { x: 37.3, y: 27.8 }, { x: 37.3, y: 26.5 }]),
    makeRoad("tf-rd-se-3", "North Forest Spur", [{ x: 38.5, y: 19.3 }, { x: 37.1, y: 20.4 }, { x: 37.2, y: 21.8 }, { x: 38.7, y: 23.9 }]),
  ];

  // =========================================================================
  // 4. World Symbols Across 4 Dedicated Depth Layers (~500+ Miniature-Scaled Icons!)
  // =========================================================================
  const fillerObjects: ObjectStamp[] = [];
  const oceanInkObjects: ObjectStamp[] = [];
  const mainObjects: ObjectStamp[] = [];
  const skyCloudObjects: ObjectStamp[] = [];
  let seq = 1;

  const tempWorldForSampling: WorldMapData = {
    themeId: theme.id,
    theme,
    gridW: GRID_W,
    gridH: GRID_H,
    heightmapB64,
    freshwaterB64,
    seaLevel: 128,
    seed: 7731,
    coastlineRoughness: 0.62,
    biomeStrokes,
    rivers,
    trails,
    regions: [],
    labels: [],
    subMapPins: [],
    overlays: {
      compass: {
        visible: true,
        x: 4.1,
        y: 27.6,
        scale: 1.48,
        assetId: "world-atlas/cartography/exp_eng_starburst_compass.png",
        rotationDeg: 0,
        showRhumbLines: true,
        rhumbOpacity: 0.14,
      },
      scaleBar: {
        visible: true,
        x: 10.2,
        y: 26.6,
        unit: "miles",
        milesPerCell: 42,
        segments: 3,
        style: "classic",
      },
      legend: {
        visible: true,
        x: 10.2,
        y: 27.85,
        entries: [
          { label: "1 Week Travel By Horse", style: "dashed", colorHex: "#342618", dashScale: 1.0 },
          { label: "1 Day Travel By Carpet", style: "dashed", colorHex: "#342618", dashScale: 0.78 },
          { label: "1 Day Travel By Boat", style: "dotted", colorHex: "#342618", dashScale: 0.9 },
        ],
      },
      grid: {
        style: "none",
        cellSizeCells: 2.0,
        opacity: 0.18,
        colorHex: theme.coastlineInkHex,
        showCoords: false,
      },
      frame: {
        style: "stepped_ivory",
        colorHex: "#EFE4CC",
        widthPx: 20,
      },
      travelMode: "horse",
    },
  };

  const addSym = (
    target: ObjectStamp[],
    assetId: string,
    x: number,
    y: number,
    wCells: number,
    hCells?: number,
    opts?: {
      flipX?: boolean;
      rot?: number;
      opacity?: number;
      zOrder?: number;
      castsShadow?: boolean;
      sampleBiome?: boolean;
      tintHex?: string;
      tintStrength?: number;
      saturation?: number;
      brightness?: number;
      contrast?: number;
    },
  ) => {
    let recolor = { ...DEFAULT_RECOLOR };
    if (opts?.tintHex) {
      recolor = {
        ...DEFAULT_RECOLOR,
        enabled: true,
        mode: "tint",
        tintHex: opts.tintHex,
        strength: opts.tintStrength ?? 0.78,
        saturation: opts.saturation ?? 1,
        brightness: opts.brightness ?? 1,
        contrast: opts.contrast ?? 1,
      };
    } else if (opts?.sampleBiome) {
      recolor = {
        ...DEFAULT_RECOLOR,
        enabled: true,
        mode: "tint",
        tintHex: sampleWorldBiomeColor(tempWorldForSampling, { x, y }),
        strength: 0.8,
        saturation: opts.saturation ?? 1,
        brightness: opts.brightness ?? 1,
        contrast: opts.contrast ?? 1,
      };
    } else if (opts?.saturation !== undefined || opts?.brightness !== undefined || opts?.contrast !== undefined) {
      recolor = {
        ...DEFAULT_RECOLOR,
        enabled: true,
        mode: "universal",
        strength: 0,
        saturation: opts.saturation ?? 1,
        brightness: opts.brightness ?? 1,
        contrast: opts.contrast ?? 1,
      };
    }
    target.push({
      id: `tf-obj-${seq++}`,
      assetId,
      x,
      y,
      widthCells: wCells,
      heightCells: hCells ?? wCells,
      rotationRad: opts?.rot ?? 0,
      flipX: opts?.flipX ?? false,
      flipY: false,
      opacity: opts?.opacity ?? 1,
      castsShadow: opts?.castsShadow ?? true,
      locked: false,
      recolor,
      zOrder: opts?.zOrder ?? 30,
    });
  };

  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  // Verified CC0 World Atlas Species Pools (including new Miniature Town Markers!)
  const OAKS = [
    "world-atlas/trees/exp_oak_spreading_grand.png",
    "world-atlas/trees/exp_oak_round_beech.png",
    "world-atlas/trees/exp_oak_twin_pair.png",
    "world-atlas/trees/exp_oak_trio_copse.png",
    "world-atlas/trees/exp_oak_five_clump.png",
    "world-atlas/trees/exp_oak_meadow_ash.png",
    "world-atlas/trees/exp_oak_sapling_trio.png",
  ];
  const PINES = [
    "world-atlas/trees/exp_pine_tall_narrow.png",
    "world-atlas/trees/exp_pine_old_growth_spruce.png",
    "world-atlas/trees/exp_pine_twin_forest.png",
    "world-atlas/trees/exp_pine_clump_four.png",
    "world-atlas/trees/exp_pine_five_cluster.png",
    "world-atlas/trees/exp_pine_hillside_group.png",
    "world-atlas/trees/exp_pine_young_bushy.png",
  ];
  const PALMS = [
    "world-atlas/trees/exp_trop_curved_palm.png",
    "world-atlas/trees/exp_trop_twin_palms.png",
    "world-atlas/trees/exp_trop_triple_palms.png",
    "world-atlas/trees/exp_trop_rainforest_dome.png",
    "world-atlas/trees/exp_trop_palm_jungle_trio.png",
  ];
  const ALPINE_PEAKS = [
    "world-atlas/mountains/hq_ink_alpine_trio.png",
    "world-atlas/mountains/hq_ink_alpine_massif.png",
    "world-atlas/mountains/exp_alp_jagged_horn.png",
    "world-atlas/mountains/exp_alp_twin_sweep.png",
    "world-atlas/mountains/exp_alp_triple_massif.png",
    "world-atlas/mountains/exp_alp_sawtooth_ridge.png",
    "world-atlas/mountains/exp_alp_asymmetric_summit.png",
  ];
  const HQ_ALPINE = [
    "world-atlas/mountains/hq_ink_alpine_trio.png",
    "world-atlas/mountains/hq_ink_alpine_massif.png",
  ];
  const ROCKY_PEAKS = [
    "world-atlas/mountains/exp_rock_shale_crag.png",
    "world-atlas/mountains/exp_rock_layered_ridge.png",
    "world-atlas/mountains/exp_rock_slate_fangs.png",
    "world-atlas/mountains/exp_rock_ironspine_range.png",
    "world-atlas/mountains/exp_rock_canyon_peak.png",
  ];
  const INK_PEAKS = [
    "world-atlas/mountains/hq_ink_alpine_trio_ink.png",
    "world-atlas/mountains/hq_ink_alpine_massif_ink.png",
    "world-atlas/mountains/exp_alp_jagged_horn_ink.png",
    "world-atlas/mountains/exp_alp_triple_massif_ink.png",
    "world-atlas/mountains/exp_alp_sawtooth_ridge_ink.png",
    "world-atlas/mountains/exp_alp_foothill_spurs_ink.png",
  ];
  const INK_SNOW_TREES = [
    "world-atlas/trees/hq_ink_taiga_spruces_ink.png",
    "world-atlas/trees/exp_snow_heavy_fir_ink.png",
    "world-atlas/trees/exp_snow_triple_spruce_ink.png",
    "world-atlas/trees/exp_snow_taiga_thicket_ink.png",
  ];
  const HILLS = [
    "world-atlas/mountains/hq_ink_meadow_hills.png",
    "world-atlas/mountains/hq_ink_single_ridge.png",
    "world-atlas/mountains/hq_ink_triple_ridges.png",
  ];
  const CLOUDS = [
    "world-atlas/cartography/exp_cld_ivory_cumulus.png",
    "world-atlas/cartography/exp_cld_lavender_puff.png",
    "world-atlas/cartography/exp_cld_ochre_trade_cloud.png",
    "world-atlas/cartography/exp_cld_mist_wisp_bank.png",
    "world-atlas/cartography/exp_cld_storm_cluster.png",
    "world-atlas/cartography/exp_cld_golden_ribbon.png",
  ];

  // =========================================================================
  // LAYER 1 (MULTIPLY INK!): ENGRAVED STEPPE GRASS, CURVED EASTERN RIDGES & ROLLING MEADOW HILLS
  // Multiplying onto the cotton-rag vellum lets crisp pen cross-hatching print straight into parchment!
  // =========================================================================
  const steppeZones: Array<[number, number, number, number, number]> = [
    [16.8, 6.4, 24.4, 10.6, 42], // Northern Golden Steppe
    [24.4, 17.5, 27.4, 20.6, 14], // Freyharbor plains
    [12.2, 16.4, 16.2, 19.6, 12], // SW rolling meadows
    [17.8, 12.8, 23.4, 18.6, 16], // Central Twilshire meadows
  ];
  for (const [x0, y0, x1, y1, count] of steppeZones) {
    for (let i = 0; i < count; i++) {
      const sx = x0 + rng() * (x1 - x0);
      const sy = y0 + rng() * (y1 - y0);
      const sz = 0.4 + rng() * 0.24;
      addSym(fillerObjects, "world-atlas/trees/exp_stp_grass_tufts.png", sx, sy, sz, sz * 0.8, {
        flipX: rng() < 0.5,
        opacity: 0.72,
        castsShadow: false,
      });
    }
  }

  // Eastern Steppe Vertical Column of 18 Razor-Sharp Hand-Inked Curved Steppe Ridge Humps (Sector 07/09!)
  for (let i = 0; i < 18; i++) {
    const ry = 11.9 + i * 0.41;
    const rx = 30.88 + Math.sin(i * 0.72) * 0.45;
    addSym(
      fillerObjects,
      i % 5 === 2 ? "world-atlas/mountains/hq_ink_triple_ridges.png" : "world-atlas/mountains/hq_ink_single_ridge.png",
      rx,
      ry,
      i % 5 === 2 ? 1.18 : 0.96 + rng() * 0.2,
      i % 5 === 2 ? 0.52 : 0.35 + rng() * 0.1,
      {
        flipX: rng() < 0.22,
        opacity: 0.88,
        castsShadow: false,
      },
    );
  }

  // Western Foothill Ridge Humps east of Stannen + Heartland Subtle Engraved Meadow Hills
  const microRidges: Array<[number, number, number]> = [
    // West slope ridges (sector 02/03)
    [11.4, 16.6, 0.78], [11.6, 17.1, 0.82], [11.5, 17.5, 0.76], [12.1, 18.6, 0.78],
    [15.4, 18.0, 0.92], [16.9, 17.1, 0.8], [17.1, 17.5, 0.8],
    // Heartland subtle cross-hatched rolling meadow hills (sector 06/08)
    [19.2, 14.0, 0.86], [19.8, 14.5, 0.92], [18.5, 15.2, 0.82], [21.9, 15.4, 0.88],
    [22.6, 15.9, 0.9], [23.1, 16.3, 0.92], [22.1, 16.3, 0.88], [23.5, 16.8, 0.88],
    [19.5, 17.3, 0.86], [19.9, 17.8, 0.88], [20.5, 17.3, 0.84], [21.5, 17.9, 0.84],
    [21.6, 19.6, 0.9], [22.6, 19.8, 0.92], [19.4, 19.3, 0.86], [24.2, 9.4, 0.82],
    [24.2, 10.0, 0.82], [17.1, 10.6, 0.78], [17.3, 11.2, 0.8], [25.6, 14.8, 0.86],
    // SE Island Eastern Ridges (sector 12!)
    [40.1, 24.7, 0.78], [40.2, 25.3, 0.78], [39.9, 25.9, 0.76],
  ];
  for (const [hx, hy, sz] of microRidges) {
    addSym(fillerObjects, pick(HILLS), hx, hy, sz, sz * 0.44, {
      flipX: rng() < 0.5,
      opacity: 0.76,
      castsShadow: false,
    });
  }

  // Misty Swamp Tarns in Old Marsh & Mirewood (placed on normal mainObjects layer below trees so marsh greens stay rich)
  addSym(mainObjects, "world-atlas/trees/exp_stp_misty_tarn.png", 31.4, 8.6, 1.35, 1.05, { opacity: 0.85, castsShadow: false, zOrder: 10 });
  addSym(mainObjects, "world-atlas/trees/exp_stp_misty_tarn.png", 29.3, 19.4, 0.95, 0.8, { opacity: 0.85, castsShadow: false, zOrder: 10 });

  // =========================================================================
  // LAYER 2: ENGRAVED OCEAN BEASTS & VORTICES (MULTIPLY INK!)
  // =========================================================================
  addSym(oceanInkObjects, "world-atlas/maritime/exp_eng_abyssal_maelstrom.png", 4.6, 4.4, 3.8, 3.6, { opacity: 0.18, castsShadow: false, zOrder: 10 });
  addSym(oceanInkObjects, "world-atlas/maritime/exp_eng_frost_sea_giant.png", 15.8, 3.8, 1.95, 2.1, { opacity: 0.92, castsShadow: false, zOrder: 10 });
  addSym(oceanInkObjects, "world-atlas/maritime/exp_eng_sea_plesiosaur.png", 43.4, 5.8, 3.45, 2.5, { opacity: 0.92, castsShadow: false, zOrder: 10 });
  addSym(oceanInkObjects, "world-atlas/maritime/exp_eng_leviathan_ship.png", 24.3, 26.2, 6.5, 6.0, { opacity: 0.96, castsShadow: false, zOrder: 12 });

  // =========================================================================
  // LAYER 3: DENSE MINIATURE-SCALED BIOMES, MOUNTAINS & ~85 TOWNS/VILLAGES!
  // =========================================================================

  // Helper to paint a dense, natural miniature canopy carpet within a region!
  const scatterCanopy = (
    pool: string[],
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    count: number,
    minSz: number,
    maxSz: number,
    opts?: { tintHex?: string; tintStrength?: number; tallRatio?: number; avoidCenterR?: number },
  ) => {
    for (let i = 0; i < count; i++) {
      const ang = rng() * Math.PI * 2;
      const dist = Math.sqrt(rng());
      const x = cx + Math.cos(ang) * rx * dist;
      const y = cy + Math.sin(ang) * ry * dist;
      if (opts?.avoidCenterR && Math.hypot(x - cx, y - cy) < opts.avoidCenterR) continue;
      const w = minSz + rng() * (maxSz - minSz);
      const asset = pick(pool);
      const isHqTree = asset.includes("hq_ink_");
      addSym(mainObjects, asset, x, y, w, w * (opts?.tallRatio ?? 0.95), {
        flipX: rng() < 0.5,
        tintHex: opts?.tintHex,
        tintStrength: opts?.tintStrength,
        brightness: isHqTree ? undefined : 0.94,
        contrast: isHqTree ? undefined : 1.16,
        castsShadow: false,
      });
    }
  };

  // 3A. NW Elven Emerald Forest (`Tudwal Woodlands`) — wall-to-wall 3-tier layered emerald canopy!
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png"], 13.0, 5.9, 2.25, 1.85, 30, 0.74, 1.08, { tallRatio: 0.86 });
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png"], 12.1, 8.9, 1.95, 1.55, 24, 0.72, 1.04, { tallRatio: 0.86 });
  scatterCanopy(OAKS, 13.1, 6.1, 2.25, 1.9, 54, 0.44, 0.68);
  scatterCanopy(OAKS, 12.1, 9.0, 1.95, 1.6, 44, 0.44, 0.68);
  scatterCanopy(["world-atlas/trees/hq_ink_mixed_forest.png", ...PINES], 14.5, 7.6, 1.35, 1.65, 28, 0.46, 0.76, { tallRatio: 1.0 });
  // Compact dark-green Northern Steppe Grove (matching exact green copse at 22.1, 7.9 on original!)
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png"], 22.1, 7.9, 0.52, 0.36, 5, 0.62, 0.82, { tallRatio: 0.86, tintHex: "#2F5818", tintStrength: 0.35 });
  scatterCanopy(OAKS, 22.1, 7.9, 0.68, 0.5, 12, 0.36, 0.52, { tintHex: "#2F5818", tintStrength: 0.42 });
  // Glowing Amethyst Arcane Woodland Groves + Ruined Crystal Spire + HQ Amethyst Enclave (`Oserith`)
  addSym(mainObjects, "world-atlas/trees/exp_stp_arcane_grove.png", 13.1, 6.7, 0.98, 0.84);
  addSym(mainObjects, "world-atlas/trees/exp_stp_arcane_grove.png", 13.6, 7.8, 0.9, 0.8, { flipX: true });
  addSym(mainObjects, "world-atlas/landmarks/exp_arc_crystal_sanctuary.png", 13.2, 6.3, 0.82, 0.92);
  addSym(mainObjects, "world-atlas/settlements/hq_twn_amethyst_enclave.png", 14.3, 9.45, 1.38, 1.32);

  // 3B. Western Mountain Ring enclosing `Jade Grove` (warm parchment-lit pen-and-ink alpine massifs!)
  const craterPeaks: Array<[number, number, number]> = [
    [15.4, 12.0, 1.32], [16.5, 12.2, 1.38], [14.3, 12.6, 1.32], [17.1, 13.0, 1.35],
    [13.8, 13.5, 1.4], [17.2, 14.0, 1.38], [14.1, 14.6, 1.32], [16.8, 15.0, 1.32],
    [14.9, 15.3, 1.28], [16.0, 15.5, 1.28], [16.0, 11.1, 1.15], [16.8, 11.4, 1.14],
    [14.7, 11.9, 1.18], [13.5, 14.1, 1.18], [17.5, 13.5, 1.18], [15.5, 15.7, 1.16],
  ];
  for (let ci = 0; ci < craterPeaks.length; ci++) {
    const [mx, my, ms] = craterPeaks[ci];
    const asset = ci % 2 === 0 ? pick(HQ_ALPINE) : pick(ALPINE_PEAKS);
    addSym(mainObjects, asset, mx, my, ms, ms * 0.82, {
      flipX: rng() < 0.5,
      tintHex: asset.includes("hq_ink_") ? "#C6A270" : "#6D4B2D",
      tintStrength: asset.includes("hq_ink_") ? 0.36 : 0.38,
      brightness: asset.includes("hq_ink_") ? 0.94 : 1.0,
      contrast: 1.12,
    });
  }
  // Lush miniature emerald forest packing the interior of Jade Grove crater
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png"], 15.6, 13.8, 0.85, 0.72, 10, 0.62, 0.84, { tallRatio: 0.86 });
  scatterCanopy(OAKS, 15.6, 13.8, 1.0, 0.9, 18, 0.4, 0.6);

  // 3C. Western Narrow Pine Belt (delicate layered ribbon east of Stannen -> Durnor -> Goldfield!)
  const westPineSpines: Array<[number, number]> = [
    [12.4, 12.5], [12.1, 13.2], [12.6, 13.7], [11.8, 14.2], [12.3, 14.7], [11.5, 15.2],
    [11.9, 15.7], [11.1, 16.2], [10.7, 16.8], [10.3, 17.3], [13.7, 16.5], [13.9, 17.0],
    [10.8, 20.3], [10.5, 20.7], [11.5, 19.8], [12.8, 12.9], [11.4, 14.6], [10.9, 15.8],
  ];
  for (let wi = 0; wi < westPineSpines.length; wi++) {
    const [px, py] = westPineSpines[wi];
    const asset = wi % 3 === 0 ? "world-atlas/trees/hq_ink_mixed_forest.png" : pick(PINES);
    addSym(mainObjects, asset, px, py, 0.56 + rng() * 0.24, 0.62 + rng() * 0.22, { flipX: rng() < 0.5, castsShadow: false });
  }
  // Dense dark-green SW Pine Copse (sector 03 at 13.5, 18.6) & curved Goldfield Woods!
  scatterCanopy(["world-atlas/trees/hq_ink_mixed_forest.png", ...PINES], 13.5, 18.6, 0.72, 0.82, 20, 0.46, 0.72, { tallRatio: 1.0 });
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png", ...OAKS], 16.3, 18.1, 0.72, 0.95, 18, 0.46, 0.72);
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png", ...OAKS], 15.8, 20.0, 0.7, 0.8, 16, 0.44, 0.68);

  // 3D. Central Diagonal Mountain Spine + Purple Arcane Forest + Glacial Frostpeak!
  const centralPeaks: Array<[number, number, number]> = [
    [19.2, 11.2, 1.22], [20.4, 11.7, 1.34], [21.5, 11.3, 1.36], [22.6, 10.8, 1.38],
    [23.3, 10.2, 1.28], [24.4, 10.2, 1.26], [27.2, 10.3, 1.38], [28.3, 10.0, 1.42],
    [29.4, 9.7, 1.35], [30.4, 9.3, 1.26], [20.9, 12.6, 1.18], [22.1, 12.4, 1.22],
    [22.4, 13.2, 1.18], [28.1, 12.4, 1.24], [28.3, 13.4, 1.28], [28.4, 14.3, 1.28],
    [27.0, 15.2, 1.56], [20.3, 18.8, 1.28], [28.8, 11.4, 1.18], [24.8, 9.8, 1.18],
    [26.5, 9.8, 1.24], [29.8, 10.3, 1.2], [23.8, 12.2, 1.15], [27.6, 14.5, 1.22],
  ];
  for (let pi = 0; pi < centralPeaks.length; pi++) {
    const [mx, my, ms] = centralPeaks[pi];
    const asset = pi % 2 === 0 ? pick(HQ_ALPINE) : pick(ALPINE_PEAKS);
    addSym(mainObjects, asset, mx, my, ms, ms * 0.82, {
      flipX: rng() < 0.5,
      tintHex: asset.includes("hq_ink_") ? "#C6A270" : "#6D4B2D",
      tintStrength: asset.includes("hq_ink_") ? 0.36 : 0.38,
      brightness: asset.includes("hq_ink_") ? 0.94 : 1.0,
      contrast: 1.12,
    });
  }
  // Purple Arcane Forest + HQ Snow-Ringed Glacial Caldera Citadel at Frostpeak!
  addSym(mainObjects, "world-atlas/trees/exp_stp_arcane_grove.png", 23.9, 11.1, 1.14, 0.98);
  addSym(mainObjects, "world-atlas/settlements/hq_twn_frost_citadel.png", 25.95, 10.52, 1.72, 1.38);

  // 3E. NE Dense Jet-Black Needle Shadowpine Taiga (razor-sharp HQ needle spruce clumps!) + East Dark Thicket!
  scatterCanopy(["world-atlas/trees/hq_ink_taiga_spruces.png"], 27.6, 8.9, 2.75, 0.78, 34, 0.58, 0.86, {
    tallRatio: 0.96,
  });
  scatterCanopy(
    ["world-atlas/trees/exp_pine_tall_narrow.png", "world-atlas/trees/exp_pine_clump_four.png"],
    27.6,
    8.9,
    2.7,
    0.76,
    38,
    0.36,
    0.54,
    { tallRatio: 1.06, tintHex: "#151913", tintStrength: 0.82 },
  );
  scatterCanopy(["world-atlas/trees/hq_ink_taiga_spruces.png"], 29.0, 16.9, 0.9, 1.15, 16, 0.56, 0.84, {
    tallRatio: 0.98,
  });
  scatterCanopy(["world-atlas/trees/hq_ink_mixed_forest.png"], 29.0, 17.2, 1.05, 1.3, 14, 0.58, 0.86, {
    tallRatio: 0.94,
    tintHex: "#1E2D18",
    tintStrength: 0.45,
  });
  // Lush dark marsh trees tightly ringing Old Marsh Tarn (sector 05!)
  scatterCanopy(["world-atlas/trees/hq_ink_mixed_forest.png", ...OAKS], 31.4, 8.5, 1.12, 1.0, 28, 0.36, 0.62, {
    avoidCenterR: 0.42,
    tintHex: "#2F5620",
    tintStrength: 0.38,
  });

  // 3F. Central Heartland Emerald Forest (`Heartwood`) & Eastern Tall Pine Curtain + SE Woodland!
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png"], 25.4, 13.4, 2.0, 1.55, 22, 0.68, 0.98, { tallRatio: 0.86 });
  scatterCanopy(["world-atlas/trees/hq_ink_mixed_forest.png"], 25.4, 13.5, 2.05, 1.6, 20, 0.62, 0.88, { tallRatio: 0.95 });
  scatterCanopy(PINES, 25.4, 13.4, 2.15, 1.68, 52, 0.4, 0.6, { tallRatio: 1.06 });
  scatterCanopy(["world-atlas/trees/hq_ink_mixed_forest.png", ...PINES], 25.1, 15.8, 1.2, 0.72, 18, 0.42, 0.64, { tallRatio: 1.02 });
  // Eastern vertical tall-pine curtain (west of the 15 razor-sharp curved ink steppe ridges!)
  for (let i = 0; i < 42; i++) {
    const py = 11.4 + i * 0.19;
    const px = 29.5 + (rng() - 0.5) * 0.82;
    const asset = i % 3 === 0 ? "world-atlas/trees/hq_ink_mixed_forest.png" : pick(PINES);
    addSym(mainObjects, asset, px, py, 0.46 + rng() * 0.24, 0.56 + rng() * 0.24, { flipX: rng() < 0.5, castsShadow: false });
  }
  // SE coastal broadleaf woods (around Passeron, Mirewood & Velmora)
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png", ...OAKS], 30.0, 19.2, 2.2, 1.55, 44, 0.4, 0.68);
  scatterCanopy(OAKS, 32.2, 14.8, 0.85, 2.15, 24, 0.36, 0.54);

  // 3G. Two-Spike Island, Valtira (engraved peak!), The Wilds (tropical ring!), NE Engraved Snow Frontier!
  addSym(mainObjects, "world-atlas/mountains/exp_volc_twin_spires.png", 25.4, 4.1, 1.0, 0.92);
  addSym(mainObjects, "world-atlas/trees/exp_trop_curved_palm.png", 26.1, 4.2, 0.68, 0.74);
  addSym(mainObjects, "world-atlas/mountains/exp_rock_shale_crag_ink.png", 34.5, 11.1, 1.18, 0.94, { opacity: 0.82, castsShadow: false }); // Valtira engraved pale peak!

  // The Wilds — wall-to-wall lush tropical canopy + 22 crisp perimeter palm trees + volcano!
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png"], 39.4, 10.9, 1.38, 1.05, 14, 0.64, 0.88, { tallRatio: 0.86 });
  scatterCanopy(OAKS, 39.4, 10.9, 1.48, 1.15, 24, 0.42, 0.62);
  addSym(mainObjects, "world-atlas/mountains/hero_smoking_volcano_peak.png", 39.4, 10.7, 1.2, 1.02);
  const wildsPalms: Array<[number, number]> = [
    [37.0, 9.5], [37.7, 9.3], [38.5, 9.2], [39.3, 9.2], [40.2, 9.2], [41.1, 9.5], [41.8, 10.0],
    [42.2, 10.7], [42.0, 11.4], [41.3, 11.9], [40.5, 12.2], [39.6, 12.4], [38.7, 12.3], [37.8, 12.0],
    [37.2, 11.4], [37.0, 10.5], [37.4, 9.9], [40.9, 8.0], [37.1, 13.4], [41.8, 14.0], [38.3, 14.3], [39.5, 6.8],
  ];
  for (const [wx, wy] of wildsPalms) {
    addSym(mainObjects, pick(PALMS), wx, wy, 0.68 + rng() * 0.2, 0.74 + rng() * 0.2, { flipX: rng() < 0.5 });
  }

  // NE Snowy Continent Corner — authentic monochrome sepia-ink engraved alpine peaks & snow pines!
  const neInkPeaks: Array<[number, number, number]> = [
    [40.6, 0.9, 1.45], [42.2, 1.1, 1.55], [43.9, 1.3, 1.65], [45.6, 1.5, 1.7],
    [47.2, 2.0, 1.6], [45.6, 3.0, 1.55], [47.0, 4.1, 1.6], [46.8, 5.7, 1.5],
    [47.4, 7.3, 1.35], [44.2, 2.4, 1.4], [46.2, 4.7, 1.4],
  ];
  for (const [nx, ny, ns] of neInkPeaks) {
    addSym(mainObjects, pick(INK_PEAKS), nx, ny, ns, ns * 0.82, { flipX: rng() < 0.5, opacity: 0.9, castsShadow: false });
  }
  for (const [nx, ny] of [[42.8, 2.1], [44.8, 2.6], [46.3, 4.9], [43.4, 3.4], [45.2, 3.8], [46.9, 6.5]]) {
    addSym(mainObjects, pick(INK_SNOW_TREES), nx, ny, 0.7, 0.74, { flipX: rng() < 0.5, opacity: 0.84, castsShadow: false });
  }

  // 3H. SE Dragon-Spine Island & Western Weathered Slate-Blue Sea Crags!
  // Iconic trio of warm sunlit pen-and-ink peaks crowning the northern entrance to the strait
  addSym(mainObjects, "world-atlas/mountains/hq_ink_alpine_massif.png", 35.6, 18.6, 1.82, 1.52, { tintHex: "#BA925C", tintStrength: 0.44, brightness: 0.92, contrast: 1.12 });
  addSym(mainObjects, "world-atlas/mountains/hq_ink_alpine_trio.png", 37.1, 18.3, 1.72, 1.44, { tintHex: "#BA925C", tintStrength: 0.44, brightness: 0.92, contrast: 1.12 });
  addSym(mainObjects, "world-atlas/mountains/hq_ink_alpine_trio.png", 29.4, 27.0, 1.78, 1.48, { tintHex: "#A6804D", tintStrength: 0.48, brightness: 0.86, contrast: 1.12 });

  const blueCrags: Array<[number, number, number]> = [
    [35.3, 19.9, 1.75], [34.8, 21.4, 1.9], [33.8, 22.8, 1.85],
    [32.6, 23.8, 1.75], [31.2, 25.0, 1.8], [30.1, 26.1, 1.7],
  ];
  for (const [bx, by, bs] of [[34.5, 20.5, 1.45], [33.1, 22.3, 1.4], [31.8, 24.1, 1.45]]) {
    addSym(mainObjects, pick(ROCKY_PEAKS), bx, by, bs, bs * 0.88, {
      flipX: rng() < 0.5,
      tintHex: "#5C4D3A",
      tintStrength: 0.46,
      saturation: 0.7,
    });
  }
  for (let i = 0; i < blueCrags.length; i++) {
    const [bx, by, bs] = blueCrags[i];
    const asset =
      i % 2 === 0
        ? "world-atlas/mountains/exp_stp_blue_sea_crags.png"
        : "world-atlas/mountains/exp_stp_shadow_fangs.png";
    addSym(mainObjects, asset, bx, by, bs, bs * 0.9, {
      flipX: i % 3 === 1,
      saturation: 0.55,
      brightness: 0.88,
      contrast: 1.12,
    });
  }
  // SE Island Rugged Central Dragon-Spine Ridge + Dense Northern Emerald Forest + Sprawling Southern Woods & Town!
  const seSpinePeaks: Array<[number, number, number]> = [
    [36.5, 22.4, 1.18], [36.8, 23.1, 1.26], [36.4, 23.8, 1.22], [36.9, 24.4, 1.26],
    [36.2, 24.8, 1.18], [36.7, 25.3, 1.12], [37.4, 23.5, 1.02], [37.4, 24.7, 1.02],
  ];
  for (let si = 0; si < seSpinePeaks.length; si++) {
    const [sx, sy, ss] = seSpinePeaks[si];
    const asset = si % 2 === 0 ? pick(HQ_ALPINE) : pick(ALPINE_PEAKS);
    addSym(mainObjects, asset, sx, sy, ss, ss * 0.86, {
      flipX: rng() < 0.5,
      tintHex: asset.includes("hq_ink_") ? "#B58E5A" : "#6D4B2D",
      tintStrength: 0.4,
      brightness: 0.92,
      contrast: 1.12,
    });
  }
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png"], 38.7, 21.0, 1.12, 0.82, 12, 0.62, 0.84, { tallRatio: 0.86 });
  scatterCanopy(OAKS, 38.7, 21.0, 1.25, 0.95, 26, 0.38, 0.54);
  scatterCanopy(["world-atlas/trees/hq_ink_mixed_forest.png", ...PINES], 36.8, 22.5, 0.65, 0.95, 20, 0.44, 0.68, { tallRatio: 1.04 });
  scatterCanopy(["world-atlas/trees/hq_ink_emerald_canopy.png", ...OAKS], 35.6, 27.5, 1.42, 1.12, 28, 0.38, 0.62, {
    avoidCenterR: 0.68,
    tintHex: "#315D1E",
    tintStrength: 0.34,
  });
  scatterCanopy(OAKS, 38.1, 25.1, 0.85, 0.65, 14, 0.36, 0.5);
  // Extra sprawling southern city quarters flanking Cinderport above the SE Emerald Lake!
  addSym(mainObjects, "world-atlas/settlements/hq_twn_walled_hill.png", 34.35, 26.05, 0.92, 0.84);
  addSym(mainObjects, "world-atlas/settlements/hq_twn_hamlet.png", 35.0, 25.45, 0.56, 0.5);
  addSym(mainObjects, "world-atlas/settlements/hq_twn_hamlet.png", 36.25, 26.4, 0.56, 0.5);
  addSym(mainObjects, "world-atlas/settlements/exp_mic_crossroads_village.png", 33.8, 26.5, 0.48, 0.46);

  // =========================================================================
  // 3I. ALL ~105 CITIES, CAPITALS, KEEPS, BRIDGES, LIGHTHOUSES & SMALL TOWNS!
  //     (Upgraded with 420px ultra-sharp pen-and-ink hero capitals & villages!)
  // =========================================================================
  const majorCities: Array<[string, number, number, number, number]> = [
    // [asset, x, y, w, h]
    ["world-atlas/settlements/hq_twn_grand_capital.png", 10.5, 13.4, 1.24, 1.15], // Stannen
    ["world-atlas/settlements/hq_twn_grand_capital.png", 20.6, 13.6, 1.34, 1.22], // Twilshire
    ["world-atlas/settlements/exp_arc_golden_palace.png", 20.9, 20.5, 1.18, 1.1], // Obreyis
    ["world-atlas/settlements/hq_twn_fishing_port.png", 10.0, 21.0, 1.18, 1.0], // Durnor
    ["world-atlas/settlements/hq_twn_walled_hill.png", 15.4, 21.6, 1.05, 0.96], // Goldfield
    ["world-atlas/settlements/hq_twn_walled_hill.png", 25.8, 7.3, 1.02, 0.92], // Peel Carbel
    ["world-atlas/settlements/exp_med_star_citadel.png", 33.1, 8.6, 1.16, 1.06], // Riven / Toren
    ["world-atlas/settlements/hq_twn_fishing_port.png", 32.6, 17.5, 1.08, 0.95], // Passeron
    ["world-atlas/settlements/hq_twn_fishing_port.png", 25.0, 20.9, 1.02, 0.88], // Freyharbor
    ["world-atlas/settlements/exp_med_walled_abbey.png", 19.2, 6.2, 0.96, 0.88], // Northwatch Abbey
    ["world-atlas/landmarks/hq_twn_stone_viaduct.png", 19.6, 8.95, 1.25, 0.94], // The Great Arch
    ["world-atlas/settlements/hq_twn_walled_hill.png", 20.8, 15.1, 0.84, 0.78], // Twilford Abbey
    ["world-atlas/settlements/exp_mic_white_spire_abbey.png", 20.2, 20.0, 0.72, 0.76], // Whitehaven
    ["world-atlas/settlements/exp_mic_red_walled_town.png", 27.3, 11.7, 0.8, 0.74], // Frostgate
    ["world-atlas/settlements/exp_med_hilltop_keep.png", 27.6, 13.0, 0.84, 0.78], // Highwatch
    // SE Island Hero Settlements & Landmarks (sectors 11 & 12!)
    ["world-atlas/settlements/exp_fan_dragonborn_fort.png", 34.7, 21.7, 0.98, 0.92], // Tidebreak
    ["world-atlas/settlements/hq_twn_marble_citadel.png", 38.7, 23.85, 1.28, 1.12], // Valenreach
    ["world-atlas/settlements/hq_twn_grand_capital.png", 35.5, 26.05, 1.18, 1.08], // Cinderport
    ["world-atlas/settlements/hq_twn_sun_arena.png", 38.8, 26.35, 0.92, 0.84], // Sunring Arena
    ["world-atlas/landmarks/exp_mic_blue_arcane_spire.png", 35.9, 28.6, 0.64, 0.78], // Sapphire Spire
    ["world-atlas/maritime/exp_mic_sea_lighthouse.png", 35.2, 9.6, 0.58, 0.7], // Strait Lighthouse
  ];
  for (const [asset, x, y, w, h] of majorCities) {
    addSym(mainObjects, asset, x, y, w, h);
  }

  // ~65 Small Towns, Crossroads Villages, River Bridges, Keeps & Harbor Hamlets at EXACT 12-Sector Coords!
  type TownEntry = {
    x: number;
    y: number;
    asset: string;
    size?: number;
    label?: string;
    dy?: number;
  };
  const V_X = "world-atlas/settlements/hq_twn_hamlet.png";
  const V_H = "world-atlas/settlements/exp_mic_crossroads_village.png";
  const V_T = "world-atlas/settlements/exp_mic_palisade_tower.png";
  const V_P = "world-atlas/settlements/exp_mic_cove_jetty.png";
  const V_B = "world-atlas/landmarks/hq_ink_bridge_mill.png";
  const V_W = "world-atlas/settlements/exp_mic_white_spire_abbey.png";
  const V_R = "world-atlas/settlements/hq_twn_walled_hill.png";
  const V_M = "world-atlas/settlements/exp_med_lumber_sawmill.png";

  const smallTowns: TownEntry[] = [
    // Sector 01 — NW Peninsula & Galerough Forest Edges
    { x: 9.2, y: 7.7, asset: V_P, size: 0.42, label: "Howler's Cove" },
    { x: 16.5, y: 7.7, asset: V_P, size: 0.42, label: "Quickalden" },
    { x: 16.4, y: 8.5, asset: V_B, size: 0.44, label: "Highblaze Trail" },
    { x: 15.7, y: 9.5, asset: V_T, size: 0.48, label: "Boulder Fort" },
    { x: 14.3, y: 10.6, asset: V_X, size: 0.42, label: "Rustrun" },
    { x: 12.9, y: 11.4, asset: V_R, size: 0.52, label: "Prismfield" },
    { x: 13.7, y: 11.1, asset: V_H, size: 0.38, label: "Castrom" },

    // Sector 02 — West Stannum & Ferrorim Valley
    { x: 8.8, y: 11.3, asset: V_P, size: 0.4, label: "Sabrefall Desert" },
    { x: 11.7, y: 12.1, asset: V_X, size: 0.42, label: "Mulefirth" },
    { x: 8.6, y: 14.3, asset: V_P, size: 0.4, label: "Ardenshale" },
    { x: 9.6, y: 14.6, asset: V_H, size: 0.4, label: "Mulestone" },
    { x: 13.1, y: 14.4, asset: V_B, size: 0.44, label: "The Spire" },
    { x: 13.2, y: 15.8, asset: V_H, size: 0.4, label: "Timbervale" },
    { x: 14.7, y: 16.5, asset: V_M, size: 0.46, label: "Nemmonis" },
    { x: 16.1, y: 16.3, asset: V_X, size: 0.44, label: "Zwischen" },
    { x: 12.7, y: 17.5, asset: V_T, size: 0.46, label: "Pferde" },

    // Sector 03 — SW Coast (`Dazai` -> `Galefeld` -> `Bridgevale`)
    { x: 9.5, y: 19.9, asset: V_P, size: 0.44, label: "Gold's Cove" },
    { x: 11.5, y: 20.1, asset: V_P, size: 0.4, label: "Wurmdale" },
    { x: 12.4, y: 20.9, asset: V_H, size: 0.38, label: "Seer's Cover" },
    { x: 13.0, y: 20.1, asset: V_X, size: 0.42, label: "Elvenwood" },
    { x: 14.3, y: 20.3, asset: V_R, size: 0.56, label: "Mossyhaunt" },
    { x: 17.3, y: 22.9, asset: V_P, size: 0.4, label: "Redfell" },
    { x: 17.6, y: 20.8, asset: V_H, size: 0.38 },
    { x: 18.1, y: 19.1, asset: V_B, size: 0.52, label: "Riverhurst" },
    { x: 18.3, y: 20.1, asset: V_R, size: 0.56, label: "Bridgevale" },

    // Sector 04 — North-Central Golden Steppe
    { x: 20.8, y: 6.2, asset: V_H, size: 0.38, label: "Silvered Reef" },
    { x: 21.8, y: 6.0, asset: V_P, size: 0.4, label: "Maplewall" },
    { x: 24.5, y: 7.2, asset: V_W, size: 0.46, label: "Bantamdale" },
    { x: 18.2, y: 8.1, asset: V_X, size: 0.42, label: "Guavaset" },
    { x: 19.5, y: 7.2, asset: V_T, size: 0.48, label: "Lunahurst" },
    { x: 21.6, y: 8.3, asset: V_X, size: 0.44, label: "Lichenmeadow" },
    { x: 23.3, y: 8.6, asset: V_H, size: 0.38, label: "Howler's Ridge" },
    { x: 24.4, y: 8.2, asset: V_B, size: 0.48, label: "Bear Blood Lakes" },
    { x: 18.0, y: 10.4, asset: V_T, size: 0.46, label: "Wistaria's Watch" },
    { x: 21.0, y: 11.0, asset: V_W, size: 0.48, label: "Mount Autmur" },
    { x: 18.2, y: 12.0, asset: V_X, size: 0.42, label: "Pikefield" },

    // Sector 05 — NE Taiga, Lac des Dragons & Chalk Cape
    { x: 27.6, y: 8.2, asset: V_H, size: 0.38, label: "Stash's Pass" },
    { x: 29.4, y: 7.9, asset: V_X, size: 0.4, label: "Inselberg of Eza" },
    { x: 30.8, y: 7.2, asset: V_T, size: 0.44, label: "Mouth of Lowa" },
    { x: 32.8, y: 6.8, asset: V_P, size: 0.4, label: "Crossing of Meow" },
    { x: 35.7, y: 7.8, asset: V_P, size: 0.44, label: "Head Tides" },

    // Sector 06 — Heartland around Twirl'mire (400% zoom collision-checked!)
    { x: 18.6, y: 13.8, asset: V_W, size: 0.48, label: "Ravenstow" },
    { x: 19.6, y: 13.1, asset: V_H, size: 0.38, label: "Inkfell" },
    { x: 22.35, y: 13.82, asset: V_T, size: 0.44, label: "Greennook" },
    { x: 19.1, y: 15.6, asset: V_W, size: 0.48, label: "Brancrest" },
    { x: 20.4, y: 16.3, asset: V_X, size: 0.44, label: "Knightdam" },
    { x: 21.3, y: 16.8, asset: V_H, size: 0.42, label: "Valfur's Shortcut" },
    { x: 18.0, y: 16.5, asset: V_T, size: 0.44, label: "Galekirk" },
    { x: 18.2, y: 18.0, asset: V_H, size: 0.38, label: "Hughdraxov Land" },
    { x: 22.8, y: 17.75, asset: V_X, size: 0.44, label: "Devilhollow", dy: -0.36 },
    { x: 22.9, y: 18.45, asset: V_W, size: 0.5, label: "Lostcross" },
    { x: 24.4, y: 17.5, asset: V_R, size: 0.5, label: "Clovernook" },

    // Sector 07 & 08 — Central South & Coast (`Obregon` -> `Barkhamstead`)
    { x: 25.8, y: 17.3, asset: V_X, size: 0.42, label: "Lake Immortal" },
    { x: 26.2, y: 18.3, asset: V_H, size: 0.4, label: "Whiteborne Ruins" },
    { x: 25.9, y: 19.3, asset: V_X, size: 0.44, label: "Decaworth" },
    { x: 20.7, y: 19.4, asset: V_T, size: 0.42, label: "Hammerdeep" },
    { x: 21.8, y: 19.6, asset: V_T, size: 0.44, label: "Shadowcrest" },
    { x: 21.9, y: 21.1, asset: V_P, size: 0.46, label: "Tarsaldale" },
    { x: 23.5, y: 20.5, asset: V_T, size: 0.46, label: "Maelwind" },
    { x: 24.5, y: 20.4, asset: V_B, size: 0.44, label: "Oberpoint" },
    { x: 25.5, y: 20.4, asset: V_R, size: 0.48, label: "Giant's Fall" },
    { x: 27.5, y: 22.0, asset: V_P, size: 0.42, label: "Port Lime" },

    // Sector 09 — Eastern Foothills & SE Coast (`Passerrim` -> `Pentavayne`)
    { x: 31.3, y: 11.4, asset: V_H, size: 0.4, label: "Griffinridge" },
    { x: 32.6, y: 13.3, asset: V_T, size: 0.44, label: "Owlhorn Rock" },
    { x: 33.7, y: 14.0, asset: V_P, size: 0.42, label: "Branbar" },
    { x: 33.1, y: 15.5, asset: V_P, size: 0.44, label: "Opalhood" },
    { x: 29.8, y: 16.4, asset: V_X, size: 0.42, label: "Old Watcher" },
    { x: 30.2, y: 18.9, asset: V_T, size: 0.44, label: "Tree of Eyes" },
    { x: 32.1, y: 19.3, asset: V_P, size: 0.42, label: "Ardenstone" },
    { x: 31.5, y: 20.3, asset: V_H, size: 0.4, label: "Vassalwood" },
    { x: 30.8, y: 20.6, asset: V_H, size: 0.38 },
    { x: 30.2, y: 21.2, asset: V_P, size: 0.56, label: "Pentavayne" },
    { x: 27.6, y: 19.6, asset: V_X, size: 0.44, label: "Weltercreek" },

    // Sectors 11 & 12 — SE Dragon-Spine Island Small Towns & Harbor Ships!
    { x: 38.5, y: 19.3, asset: V_W, size: 0.46, label: "Mudknock" },
    { x: 37.1, y: 20.4, asset: V_P, size: 0.42, label: "Bridgewaters" },
    { x: 40.3, y: 20.7, asset: V_P, size: 0.48, label: "Branslate" },
    { x: 37.2, y: 21.8, asset: V_X, size: 0.42, label: "Oakenfer" },
    { x: 40.2, y: 22.2, asset: V_R, size: 0.5, label: "Bran Fort" },
    { x: 41.8, y: 22.2, asset: "world-atlas/maritime/hero_sailing_galleon_ship.png", size: 0.72 }, // Harbor fleet facing Shifting Currents!
    { x: 37.8, y: 23.5, asset: V_H, size: 0.4, label: "Rustcreek" },
    { x: 40.5, y: 26.2, asset: V_P, size: 0.42, label: "Oakenmill" },
    { x: 37.3, y: 26.4, asset: V_X, size: 0.44, label: "Obervein" },
    { x: 33.0, y: 27.0, asset: V_R, size: 0.54, label: "Crimsonhelm" },
    { x: 37.2, y: 28.0, asset: V_H, size: 0.4, label: "Clovershade" },
  ];

  for (const t of smallTowns) {
    const s = t.size ?? 0.44;
    addSym(mainObjects, t.asset, t.x, t.y, s, s * 0.94);
  }

  // =========================================================================
  // LAYER 4: FLOATING SKY-ISLES & THE SHIFTING CURRENTS CLOUDS
  // =========================================================================
  addSym(skyCloudObjects, "world-atlas/landmarks/exp_cld_floating_peak_isle.png", 5.0, 18.3, 2.75, 2.0, { zOrder: 20 });
  addSym(skyCloudObjects, "world-atlas/landmarks/exp_cld_ring_forest_isle.png", 20.1, 22.7, 2.35, 2.05, { zOrder: 20 });

  const cloudRibbon: Array<[number, number, number]> = [
    [38.8, 31.1, 2.25], [40.4, 30.8, 2.35], [39.8, 29.7, 2.15], [41.7, 29.9, 2.45],
    [40.8, 28.6, 2.25], [42.5, 28.5, 2.55], [41.4, 27.4, 2.35], [43.2, 27.3, 2.45],
    [42.1, 26.2, 2.35], [43.8, 26.1, 2.55], [42.8, 25.0, 2.25], [44.4, 24.9, 2.45],
    [43.4, 23.8, 2.35], [45.0, 23.7, 2.45], [44.2, 22.7, 2.25], [45.6, 22.6, 2.45],
    [44.9, 21.6, 2.15], [46.0, 21.5, 2.15], [43.6, 21.9, 1.95], [42.5, 24.1, 1.95],
    [41.5, 26.9, 1.9], [38.2, 30.6, 1.9], [46.2, 23.1, 1.85], [45.1, 25.5, 1.9],
    [43.9, 28.2, 1.95], [39.5, 31.5, 1.8],
  ];
  for (let i = 0; i < cloudRibbon.length; i++) {
    const [cx, cy, cs] = cloudRibbon[i];
    addSym(skyCloudObjects, CLOUDS[i % CLOUDS.length], cx, cy, cs, cs * 0.72, {
      flipX: i % 2 === 1,
      opacity: 0.97,
      zOrder: 30,
    });
  }

  // =========================================================================
  // 5. Complete Hierarchical Typography (~90 Labels: Title -> Oceans -> Cities -> Micro-Towns!)
  // =========================================================================
  const displayFont = theme.fontFamilyDisplay;
  const bodyFont = theme.fontFamilyBody;

  const makeOceanLabel = (
    id: string,
    text: string,
    x: number,
    y: number,
    fontSizePx = 14,
    opts?: { colorHex?: string; outlineColorHex?: string; outlineWidth?: number; shadow?: boolean },
  ): WorldLabel => ({
    id,
    text,
    x,
    y,
    category: "ocean",
    fontFamily: displayFont,
    fontSizePx,
    colorHex: opts?.colorHex ?? "#948150",
    outlineColorHex: opts?.outlineColorHex ?? "#18140F",
    outlineWidth: opts?.outlineWidth ?? 0.55,
    shadowColorHex: opts?.shadow === false ? undefined : "rgba(10, 9, 7, 0.68)",
    letterSpacing: 1.4,
    italic: false,
    bold: true,
    uppercase: false,
    rotationDeg: 0,
    curveBend: 0,
    boxStyle: "none",
    opacity: 0.92,
    lineHeight: 1.12,
  });

  const makeCityLabel = (id: string, text: string, x: number, y: number, fontSizePx = 10.2, bold = true): WorldLabel => ({
    id,
    text,
    x,
    y,
    category: "city",
    fontFamily: bodyFont,
    fontSizePx,
    colorHex: "#140E09",
    outlineColorHex: "rgba(236, 226, 200, 0.86)",
    outlineWidth: 0.78,
    letterSpacing: 0.25,
    italic: false,
    bold,
    uppercase: false,
    rotationDeg: 0,
    curveBend: 0,
    boxStyle: "none",
    opacity: 0.98,
  });

  const makeVillageLabel = (id: string, text: string, x: number, y: number, fontSizePx = 6.6): WorldLabel => ({
    id,
    text,
    x,
    y,
    category: "river",
    fontFamily: bodyFont,
    fontSizePx,
    colorHex: "#15100A",
    outlineColorHex: "rgba(235, 224, 196, 0.8)",
    outlineWidth: 0.52,
    letterSpacing: 0.12,
    italic: false,
    bold: true,
    uppercase: false,
    rotationDeg: 0,
    curveBend: 0,
    boxStyle: "none",
    opacity: 0.95,
  });

  const makeRegionLabel = (id: string, text: string, x: number, y: number, fontSizePx = 9.0): WorldLabel => ({
    id,
    text,
    x,
    y,
    category: "region",
    fontFamily: displayFont,
    fontSizePx,
    colorHex: "#1A120A",
    outlineColorHex: "rgba(235, 224, 198, 0.85)",
    outlineWidth: 0.72,
    letterSpacing: 0.5,
    italic: true,
    bold: true,
    uppercase: false,
    rotationDeg: 0,
    curveBend: 0,
    boxStyle: "none",
    opacity: 0.92,
    lineHeight: 1.08,
  });

  const labels: WorldLabel[] = [
    // Iconic Display Title
    {
      id: "tf-lbl-title",
      text: "Tro'fraderra",
      x: 11.4,
      y: 29.85,
      category: "continent",
      fontFamily: displayFont,
      fontSizePx: 39,
      colorHex: "#0B0907",
      outlineColorHex: "#E8DCBE",
      outlineWidth: 1.35,
      shadowColorHex: "rgba(0, 0, 0, 0.58)",
      letterSpacing: 3.1,
      italic: false,
      bold: true,
      uppercase: false,
      rotationDeg: 0,
      curveBend: 0,
      boxStyle: "none",
      opacity: 0.99,
    },

    // Oceans, Seas & Maritime Features (matched per-sea antique pigment from original!)
    makeOceanLabel("tf-lbl-mourning", "Mourning Rings", 4.6, 3.1, 11.5, { colorHex: "#8C5834", outlineColorHex: "#1A120C", outlineWidth: 0.5 }),
    makeOceanLabel("tf-lbl-northgulf", "Northern Call", 15.6, 2.8, 13.5, { colorHex: "#8D7B48", outlineColorHex: "#1A160E", outlineWidth: 0.5 }),
    makeOceanLabel("tf-lbl-tragedy", "Tragedy Ocean", 34.8, 4.7, 13.5, { colorHex: "#181815", outlineColorHex: "rgba(138, 140, 128, 0.55)", outlineWidth: 0.45, shadow: false }),
    makeOceanLabel("tf-lbl-putrid", "Patina\nSea", 5.8, 13.4, 13, { colorHex: "#242D10", outlineColorHex: "rgba(132, 148, 72, 0.52)", outlineWidth: 0.45, shadow: false }),
    makeOceanLabel("tf-lbl-somber", "Somber Sea", 40.4, 16.0, 13.5, { colorHex: "#171D1F", outlineColorHex: "rgba(128, 138, 136, 0.5)", outlineWidth: 0.45, shadow: false }),
    makeOceanLabel("tf-lbl-leviathan", "Leviathan's\nExpanse", 17.8, 26.5, 18, { colorHex: "#867649", outlineColorHex: "#18150E", outlineWidth: 0.55 }),
    makeCityLabel("tf-lbl-currents", "The Shifting\nCurrents", 43.2, 27.6, 11.2, true),

    // Major Islands & Regional Biomes
    makeCityLabel("tf-lbl-twospike", "Two-Spike Island", 25.7, 5.18, 9.0, true),
    makeCityLabel("tf-lbl-valtira", "The Mable Palace", 34.5, 11.75, 8.8, true),
    { ...makeCityLabel("tf-lbl-wilds", "The Wilds", 39.4, 11.1, 11.5, true), colorHex: "#31120A", outlineColorHex: "rgba(235, 212, 152, 0.9)" },
    makeVillageLabel("tf-lbl-atolls", "Creation Keys", 36.1, 15.25, 6.8),
    makeVillageLabel("tf-lbl-goldenbay", "Redalden Keys", 6.0, 20.6, 6.8),
    makeCityLabel("tf-lbl-cloudisle", "The World's\nBreath", 20.1, 23.35, 8.4, true),
    makeRegionLabel("tf-lbl-sylvan", "The Jungls\nof Galerough", 13.3, 7.6, 8.6),
    makeRegionLabel("tf-lbl-jade", "Lost Grove", 15.6, 14.0, 8.2),
    makeRegionLabel("tf-lbl-shadowpine", "le Foret\nde Demons", 27.6, 9.1, 8.2),
    makeRegionLabel("tf-lbl-oldmarsh", "Lac des\nDragons", 31.4, 8.6, 7.5),
    makeRegionLabel("tf-lbl-heartwood", "Valley of\nthe Twin", 25.6, 13.6, 8.2),

    // Major Cities & Landmarks (synced to verified campaign names!)
    makeCityLabel("tf-lbl-oserith", "Oscarbon", 14.3, 10.22, 10.2, true),
    makeCityLabel("tf-lbl-stannen", "Stannum", 10.5, 14.22, 11.5, true),
    makeCityLabel("tf-lbl-durnor", "Dazai", 10.0, 21.65, 10.8, true),
    makeCityLabel("tf-lbl-goldfield", "Galefeld", 15.4, 22.25, 11.0, true),
    makeCityLabel("tf-lbl-obreyis", "Obregon", 20.9, 21.2, 11.5, true),
    makeCityLabel("tf-lbl-freyharbor", "Barkhamstead", 25.0, 21.55, 10.2, true),
    makeCityLabel("tf-lbl-passeron", "Passerrim", 32.6, 18.2, 10.8, true),
    makeCityLabel("tf-lbl-riven", "Lorar", 33.1, 9.3, 10.2, true),
    makeCityLabel("tf-lbl-peel", "Pewterlet", 25.8, 7.75, 10.8, true),
    makeCityLabel("tf-lbl-northwatch", "Bismuthknoll", 19.2, 6.72, 8.4, true),
    makeVillageLabel("tf-lbl-greatarch", "Ferrorim Mountains", 15.0, 11.75, 6.8),
    makeCityLabel("tf-lbl-twilshire", "Twirl'mire", 20.6, 14.35, 12.0, true),
    makeCityLabel("tf-lbl-twilford", "Blackcombe", 20.8, 15.62, 7.8, true),
    makeCityLabel("tf-lbl-frostpeak", "Giant's Peak", 26.0, 11.42, 9.5, true),
    makeCityLabel("tf-lbl-frostgate", "Blood Moon Village", 27.3, 12.22, 7.8, true),
    makeVillageLabel("tf-lbl-whitehaven", "Azuredrum", 20.2, 20.48, 6.6),
    makeCityLabel("tf-lbl-highwatch", "Guardian's Summit", 27.6, 13.52, 7.4, true),
    makeCityLabel("tf-lbl-se-spire", "Nitredam", 34.7, 22.35, 8.8, true),
    makeCityLabel("tf-lbl-se-cap", "Gale Landing", 38.7, 24.48, 10.0, true),
    makeCityLabel("tf-lbl-se-port", "Tarsalden", 35.5, 26.68, 9.6, true),
    makeVillageLabel("tf-lbl-se-arena", "Goldenstar", 38.8, 26.95, 6.8),
    makeVillageLabel("tf-lbl-se-light", "The Straights\nof Revilis", 36.2, 9.5, 6.3),
    // Labeled Patina & Northern Barrier Islets
    makeVillageLabel("tf-lbl-is-comma", "Oda Isle", 6.4, 8.5, 6.5),
    makeVillageLabel("tf-lbl-is-bar1", "Gambler's Strait", 28.6, 6.2, 6.3),
    makeVillageLabel("tf-lbl-is-bar2", "Black Sand Isle", 30.2, 6.0, 6.2),
    makeVillageLabel("tf-lbl-is-wildne", "Slarkr Atoll", 41.0, 8.4, 6.3),
  ];

  // Auto-emit crisp proportional miniature town labels for EVERY labeled small town!
  for (let i = 0; i < smallTowns.length; i++) {
    const t = smallTowns[i];
    if (!t.label) continue;
    labels.push(
      makeVillageLabel(
        `tf-lbl-twn-${i}`,
        t.label,
        t.x,
        t.y + (t.dy ?? (t.size ?? 0.44) * 0.68 + 0.12),
        t.label === "Mossyhaunt" || t.label === "Bridgevale" || t.label === "Pentavayne" ? 8.2 : 6.5,
      ),
    );
  }

  const world: WorldMapData = {
    ...tempWorldForSampling,
    labels,
  };

  return {
    schemaVersion: "1.0.0",
    id: "dcmap-world-trofraderra",
    mode: "world",
    meta: {
      title: "Tro'fraderra",
      author: "Dice Chaos Compass (Clean-Room Atlas)",
      createdAt: now,
      updatedAt: now,
    },
    canvas: {
      widthCells: W_CELLS,
      heightCells: H_CELLS,
      ppi: 128,
      baseTerrainAssetId: "world-atlas/textures/world_paper_aged_parchment.png",
      grid: {
        type: "none",
        visible: false,
        colorHex: theme.coastlineInkHex,
        opacity: 0.2,
      },
    },
    levels: [
      {
        id: "lvl-world",
        shortCode: "MAP",
        name: "Overland Atlas",
        kind: "ground",
        elevationFt: 0,
        visible: true,
      },
    ],
    activeLevelId: "lvl-world",
    layers: [
      {
        id: "lyr-tf-fillers",
        name: "Engraved Grass, Steppe Ridges & Hills",
        kind: "objects",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 0.9,
        blendMode: "multiply",
        levelId: "lvl-world",
        objects: fillerObjects,
      },
      {
        id: "lyr-tf-ocean-ink",
        name: "Engraved Ocean Beasts (Ink)",
        kind: "objects",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 0.94,
        blendMode: "multiply",
        levelId: "lvl-world",
        objects: oceanInkObjects,
      },
      {
        id: "lyr-tf-mainland",
        name: "Mountains, Forests & Settlements",
        kind: "objects",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId: "lvl-world",
        objects: mainObjects,
      },
      {
        id: "lyr-tf-sky-clouds",
        name: "Floating Sky-Isles & Shifting Currents",
        kind: "objects",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId: "lvl-world",
        objects: skyCloudObjects,
      },
      {
        id: "lyr-tf-dm",
        name: "DM Campaign Secrets",
        kind: "dm_notes",
        visible: true,
        locked: false,
        dmOnly: true,
        opacity: 1,
        blendMode: "normal",
        levelId: "lvl-world",
        dmNotes: [],
      },
    ],
    activeLayerId: "lyr-tf-mainland",
    lighting: {
      enabled: false,
      activePresetId: "daylight",
      ambientColorHex: "#FFFFFF",
      ambientIntensity: 1,
      shadowSoftness: 0.2,
      presets: [
        {
          id: "daylight",
          name: "Atlas Daylight",
          ambientColorHex: "#FFFFFF",
          ambientIntensity: 1,
        },
      ],
    },
    world,
  };
}

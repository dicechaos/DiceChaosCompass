/**
 * Dungeondraft (.dungeondraft_map) → Dice Chaos Maps Battlemap (.dcmap) Importer.
 *
 * Converts multi-floor Dungeondraft JSON saves (with Godot Vector2, PoolVector2Array,
 * PoolByteArray, and AARRGGBB Color fields) into fully editable Battlemap DcMapDocuments:
 *   - Multi-story levels ("0", "1", "2"...) mapped cleanly to 1F / 2F / ROOF / B1 MapLevels
 *   - Terrain slots (texture_1..4) & splat painting → base terrain + feathered TerrainStrokes
 *   - Smart walls & portals (doors, windows, gates) with light-blocking & hinge orientation
 *   - Spline paths (smoothness, fade_in/out, grow/shrink)
 *   - Objects & props with scale, mirror, z-layer ordering & custom_color recolor
 *   - Dynamic 2D raycast lights & ambient environment lighting
 *   - Water polygons (with nested dry island cutouts), caves, and native RoofStructures
 */

import {
  cleanSourceRefLabel,
  createAssetSwapIndex,
  resolveSwappedAsset,
  type AssetSwapEntry,
  type AssetSwapPolicy,
} from "@/engine/assetSwapEngine";
import { createDefaultCaveSystem } from "@/engine/caveEngine";
import {
  parseGodotColor,
  parseGodotPoolByteArray,
  parseGodotPoolIntArray,
  parseGodotPoolVector2Array,
  parseGodotVector2,
} from "@/engine/draftMapDecoder";
import { pointInPolygon } from "@/engine/geometry";
import type { ExternalImportSummary } from "@/engine/wonderdraftMapImport";
import {
  DEFAULT_RECOLOR,
  type CaveOperation,
  type DcMapDocument,
  type LevelKind,
  type LightNode,
  type MapLayer,
  type MapLevel,
  type ObjectStamp,
  type Point2D,
  type PortalNode,
  type RgbRecolor,
  type RoofStructure,
  type RoofStyle,
  type SplinePath,
  type TerrainStroke,
  type VaultAsset,
  type WallSegment,
  type WaterRegion,
} from "@/types/map";

export interface DungeondraftImportOptions {
  fileName: string;
  policy: AssetSwapPolicy;
  importObjects?: boolean;
  importWalls?: boolean;
  importLights?: boolean;
  importTerrain?: boolean;
  overrides?: Record<string, string>;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function inferLevelMeta(
  idx: number,
  rawLabel: string,
  basementSeq: number,
): { shortCode: string; kind: LevelKind; elevationFt: number; isGround: boolean } {
  const low = rawLabel.toLowerCase();
  if (low.includes("roof")) {
    return { shortCode: "ROOF", kind: "roof", elevationFt: 36, isGround: false };
  }
  if (low.includes("attic") || low.includes("3rd") || low.includes("third")) {
    return { shortCode: "3F", kind: "upper", elevationFt: 24, isGround: false };
  }
  if (low.includes("2nd") || low.includes("second") || low.includes("upper")) {
    return { shortCode: "2F", kind: "upper", elevationFt: 12, isGround: false };
  }
  if (low.includes("basement") || low.includes("cellar") || low.includes("crypt") || low.includes("underground") || low.includes("sewer") || idx < 0) {
    return { shortCode: `B${basementSeq}`, kind: "underground", elevationFt: -12 * basementSeq, isGround: false };
  }
  if (low.includes("sky") || low.includes("air")) {
    return { shortCode: "SKY", kind: "sky", elevationFt: 48, isGround: false };
  }
  if (low.includes("ground") || low.includes("1st") || low.includes("first") || low.includes("main")) {
    return { shortCode: "1F", kind: "ground", elevationFt: 0, isGround: true };
  }
  if (idx === 0) {
    return { shortCode: "1F", kind: "ground", elevationFt: 0, isGround: true };
  }
  return { shortCode: `${idx + 1}F`, kind: "upper", elevationFt: idx * 12, isGround: false };
}

function inferPortalKind(sourceRef: string): PortalNode["kind"] {
  const low = sourceRef.toLowerCase();
  if (low.includes("window") || low.includes("glass") || low.includes("pane")) return "window";
  if (low.includes("gate") || low.includes("portcullis") || low.includes("bars")) return "gate";
  if (low.includes("hatch") || low.includes("trapdoor") || low.includes("grate")) return "hatch";
  return "door";
}

function inferRoofStyle(rawStyle: unknown): RoofStyle {
  if (typeof rawStyle === "string") {
    const low = rawStyle.toLowerCase();
    if (low.includes("hip")) return "hip";
    if (low.includes("cone") || low.includes("dome") || low.includes("round")) return "cone";
    if (low.includes("shed") || low.includes("slope")) return "shed";
    if (low.includes("mansard")) return "mansard";
    return "gable";
  }
  if (typeof rawStyle === "number") {
    if (rawStyle === 1) return "hip";
    if (rawStyle === 2) return "cone";
    return "gable";
  }
  return "gable";
}

function makeRecolorFromHex(
  hex: string | null,
  drawMode?: VaultAsset["drawMode"],
  strengthOverride?: number,
): RgbRecolor {
  if (!hex) return { ...DEFAULT_RECOLOR };
  const clean = hex.toUpperCase();
  if (clean === "#FFFFFF" || clean === "#000000") {
    return { ...DEFAULT_RECOLOR };
  }
  const isDdRed = drawMode === "dd_red";
  return {
    ...DEFAULT_RECOLOR,
    enabled: true,
    mode: isDdRed ? "dd_red" : "tint",
    tintHex: clean,
    strength: strengthOverride ?? (isDdRed ? 0.9 : 0.78),
  };
}

function inferNamedColorHexFromRef(sourceRef: string): string | null {
  const low = sourceRef.toLowerCase().replace(/[_/\\-]+/g, " ");
  if (/\byellow\b/.test(low)) return "#EAB308";
  if (/\bgold|amber\b/.test(low)) return "#D97706";
  if (/\bwhite|cream\b/.test(low)) return "#F1F5F9";
  if (/\bred|crimson\b/.test(low)) return "#DC2626";
  if (/\bblue|cobalt\b/.test(low)) return "#2563EB";
  if (/\bgreen|emerald\b/.test(low)) return "#16A34A";
  return null;
}

function isNearWhite(hex: string): boolean {
  return hex.toUpperCase() === "#FFFFFF";
}

function extractWaterPolygonsFromTree(
  node: unknown,
  ppg: number,
  fallbackDeep: string,
  fallbackShallow: string,
  out: Array<{ polygon: Point2D[]; cutouts: Point2D[][]; deepHex: string; shallowHex: string; isOpen: boolean }>,
): void {
  const rec = asRecord(node);
  if (!rec) return;
  const nodeDeep = parseGodotColor(rec.deep_color);
  const nodeShallow = parseGodotColor(rec.shallow_color);
  const deepHex = nodeDeep && nodeDeep.alpha > 0.05 ? nodeDeep.hex : fallbackDeep;
  const shallowHex = nodeShallow && nodeShallow.alpha > 0.05 ? nodeShallow.hex : fallbackShallow;
  const isOpen = rec.is_open === true || rec.is_open === "True";

  const poly = parseGodotPoolVector2Array(rec.polygon ?? rec.points).map((p) => ({
    x: p.x / ppg,
    y: p.y / ppg,
  }));
  const children = Array.isArray(rec.children) ? rec.children : [];
  if (poly.length >= 3) {
    const cutouts: Point2D[][] = [];
    for (const ch of children) {
      const chRec = asRecord(ch);
      if (!chRec) continue;
      const chPoly = parseGodotPoolVector2Array(chRec.polygon ?? chRec.points).map((p) => ({
        x: p.x / ppg,
        y: p.y / ppg,
      }));
      if (chPoly.length >= 3) {
        cutouts.push(chPoly);
      }
      const grand = Array.isArray(chRec.children) ? chRec.children : [];
      for (const g of grand) {
        extractWaterPolygonsFromTree(g, ppg, deepHex, shallowHex, out);
      }
    }
    out.push({ polygon: poly, cutouts, deepHex, shallowHex, isOpen });
  } else {
    for (const ch of children) {
      extractWaterPolygonsFromTree(ch, ppg, deepHex, shallowHex, out);
    }
  }
}

export function importDungeondraftMapData(
  rawData: Record<string, unknown>,
  vaultAssets: VaultAsset[],
  options: DungeondraftImportOptions,
): { doc: DcMapDocument; summary: ExternalImportSummary } {
  const worldObj = asRecord(rawData.world) ?? rawData;
  const headerObj = asRecord(rawData.header);
  const ppg = Math.max(32, asNum(worldObj.pixels_per_grid ?? headerObj?.pixels_per_grid, 256));

  const mapSizeVec = parseGodotVector2(worldObj.map_size ?? headerObj?.map_size);
  let widthCells = Math.round(
    mapSizeVec ? mapSizeVec.x : asNum(worldObj.width ?? headerObj?.width, 32),
  );
  let heightCells = Math.round(
    mapSizeVec ? mapSizeVec.y : asNum(worldObj.height ?? headerObj?.height, 24),
  );
  // If dimensions were stored in pixels (e.g. > 256), divide by ppg
  if (widthCells > 200) widthCells = Math.round(widthCells / ppg);
  if (heightCells > 200) heightCells = Math.round(heightCells / ppg);
  widthCells = Math.max(8, Math.min(160, widthCells));
  heightCells = Math.max(8, Math.min(160, heightCells));

  const swapIndex = createAssetSwapIndex(vaultAssets, options.policy);
  const overrides = options.overrides ?? {};
  const assetById = new Map(vaultAssets.map((a) => [a.id, a]));
  const swapMap = new Map<string, AssetSwapEntry>();

  const resolveAsset = (
    sourceRef: string,
    expectedCategory: Exclude<VaultAsset["category"], "all">,
    fallbackId: string,
    isRoof = false,
    expectedDrawMode?: VaultAsset["drawMode"],
  ): { assetId: string; asset: VaultAsset | undefined } => {
    const ref = sourceRef.trim() || fallbackId;
    let entry = swapMap.get(ref);
    if (!entry) {
      const overrideId = overrides[ref];
      const overrideAsset = overrideId ? assetById.get(overrideId) : undefined;
      if (overrideAsset) {
        entry = {
          sourceRef: ref,
          sourceLabel: cleanSourceRefLabel(ref),
          expectedCategory,
          isRoof,
          targetAssetId: overrideAsset.id,
          targetDisplayName: overrideAsset.displayName,
          targetThumbUrl: overrideAsset.thumbUrl,
          variantIds: [overrideAsset.id],
          confidence: "exact",
          count: 0,
        };
      } else {
        const resolved = resolveSwappedAsset(swapIndex, {
          sourceRef: ref,
          expectedCategory,
          expectedDrawMode,
          isRoof,
        });
        const chosen = resolved.asset ?? assetById.get(fallbackId);
        entry = {
          sourceRef: ref,
          sourceLabel: cleanSourceRefLabel(ref),
          expectedCategory,
          isRoof,
          targetAssetId: chosen?.id ?? fallbackId,
          targetDisplayName: chosen?.displayName ?? cleanSourceRefLabel(fallbackId),
          targetThumbUrl: chosen?.thumbUrl ?? "",
          variantIds: resolved.variantIds,
          confidence: resolved.asset ? resolved.confidence : "fallback",
          count: 0,
        };
      }
      swapMap.set(ref, entry);
    }
    entry.count++;
    return { assetId: entry.targetAssetId, asset: assetById.get(entry.targetAssetId) };
  };

  // Parse all levels sorted numerically ("0", "1", "2", ...)
  const levelsObj = asRecord(worldObj.levels) ?? {};
  const levelKeys = Object.keys(levelsObj).sort((a, b) => Number(a) - Number(b));
  if (levelKeys.length === 0) {
    levelKeys.push("0");
  }

  const levels: MapLevel[] = [];
  const layers: MapLayer[] = [];

  let baseTerrainAssetId = "terrain/berlin_wet_cobble.png";
  let baseTerrainImportedRef: string | undefined;
  let hasPickedBaseTerrain = false;
  let primaryLevelId = `lvl-dd-${levelKeys[0]}`;
  let primaryObjectLayerId = `layer-dd-objects-${levelKeys[0]}`;
  let primaryScore = -1;
  let ambientColorHex = "#FFFFFF";
  let ambientIntensity = 1.0;
  let lightingEnabled = false;

  let totalObjects = 0;
  let totalWalls = 0;
  let totalPortals = 0;
  let totalPaths = 0;
  let totalLights = 0;
  let totalWater = 0;
  let totalRoofs = 0;

  let basementCount = 0;
  for (let li = 0; li < levelKeys.length; li++) {
    const key = levelKeys[li];
    const lvlNum = Number.isFinite(Number(key)) ? Number(key) : li;
    const lvlData = asRecord(levelsObj[key]) ?? {};
    const rawLabel =
      typeof lvlData.label === "string" && lvlData.label.trim()
        ? lvlData.label.trim()
        : li === 0
          ? "Ground Floor"
          : `Level ${li + 1}`;
    const isBasementLike =
      /basement|cellar|crypt|underground|sewer/i.test(rawLabel) || lvlNum < 0;
    if (isBasementLike) basementCount++;
    const meta = inferLevelMeta(lvlNum, rawLabel, Math.max(1, basementCount));
    const levelId = `lvl-dd-${key}`;

    const terrainEnabledOnLevel = asRecord(lvlData.terrain)?.enabled !== false;
    const objCountOnLevel = Array.isArray(lvlData.objects) ? lvlData.objects.length : 0;
    const score = (meta.isGround ? 100_000 : 0) + (terrainEnabledOnLevel ? 10_000 : 0) + objCountOnLevel;
    if (score > primaryScore) {
      primaryScore = score;
      primaryLevelId = levelId;
      primaryObjectLayerId = `layer-dd-objects-${key}`;
    }

    levels.push({
      id: levelId,
      shortCode: meta.shortCode,
      name: rawLabel,
      kind: meta.kind,
      elevationFt: meta.elevationFt,
      visible: false, // Primary ground level marked visible right after loop
    });

    // Environment / Ambient Lighting (prefer Ground level or first level with non-white ambient)
    const env = asRecord(lvlData.environment);
    if (env && (meta.isGround || !lightingEnabled)) {
      const amb = parseGodotColor(env.ambient_light);
      if (amb) {
        const r = parseInt(amb.hex.slice(1, 3), 16) / 255;
        const g = parseInt(amb.hex.slice(3, 5), 16) / 255;
        const b = parseInt(amb.hex.slice(5, 7), 16) / 255;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        if (meta.isGround || lum < 0.92) {
          ambientColorHex = amb.hex;
          ambientIntensity = Math.max(0.18, Math.min(1, Math.round(lum * 100) / 100));
          if (lum < 0.92) lightingEnabled = true;
        }
      }
    }

    // 1. Terrain, Splat Painting, Building Floor Tiles & Pattern Polygons
    const terrainStrokes: TerrainStroke[] = [];
    const terrainObj = asRecord(lvlData.terrain);
    if (options.importTerrain !== false && terrainObj && terrainObj.enabled !== false) {
      const slotRefs = [
        typeof terrainObj.texture_1 === "string" ? terrainObj.texture_1 : "",
        typeof terrainObj.texture_2 === "string" ? terrainObj.texture_2 : "",
        typeof terrainObj.texture_3 === "string" ? terrainObj.texture_3 : "",
        typeof terrainObj.texture_4 === "string" ? terrainObj.texture_4 : "",
        typeof terrainObj.texture_5 === "string" ? terrainObj.texture_5 : "",
        typeof terrainObj.texture_6 === "string" ? terrainObj.texture_6 : "",
        typeof terrainObj.texture_7 === "string" ? terrainObj.texture_7 : "",
        typeof terrainObj.texture_8 === "string" ? terrainObj.texture_8 : "",
      ];
      const slotAssets = slotRefs.map((ref) =>
        ref ? resolveAsset(ref, "terrain", "terrain/berlin_wet_cobble.png") : null,
      );
      if ((!hasPickedBaseTerrain || meta.isGround) && slotAssets[0]) {
        baseTerrainAssetId = slotAssets[0].assetId;
        baseTerrainImportedRef = slotRefs[0];
        hasPickedBaseTerrain = true;
      }

      // Decode Dungeondraft 8-channel splat + splat2 weights together (4 bytes/sub-cell at 4×4 sub-cells/grid).
      // Use 2×2 box-averaging on a 0.5-cell sub-grid and assign each sample to its dominant weight channel
      // so higher channel slots NEVER overwrite a stronger lower slot, and 3-way seams never leak base dirt!
      const splat1 = parseGodotPoolByteArray(terrainObj.splat);
      const splat2 = parseGodotPoolByteArray(terrainObj.splat2);
      const refBuf = splat1 && splat1.byteLength >= 16 ? splat1 : splat2 && splat2.byteLength >= 16 ? splat2 : null;
      if (refBuf) {
        const subCellsPerAxis = Math.round(
          Math.sqrt(refBuf.byteLength / 4 / Math.max(1, widthCells * heightCells)),
        );
        const sub = Math.max(1, Math.min(8, subCellsPerAxis || 4));
        const sw = widthCells * sub;
        const sh = heightCells * sub;
        const neededBytes = sw * sh * 4;
        const hasSplat1 = Boolean(splat1 && splat1.byteLength >= neededBytes);
        const hasSplat2 = Boolean(splat2 && splat2.byteLength >= neededBytes);

        if (hasSplat1 || hasSplat2) {
          const stepDiv = sub >= 2 ? 2 : 1;
          const sampleW = widthCells * stepDiv;
          const sampleH = heightCells * stepDiv;
          const radiusCells = stepDiv === 2 ? 0.54 : 0.95;
          const softness = stepDiv === 2 ? 0.48 : 0.65;
          const slotPts: Point2D[][] = [[], [], [], [], [], [], [], []];
          const chSums = new Float64Array(8);

          for (let syi = 0; syi < sampleH; syi++) {
            const subY0 = Math.floor((syi * sub) / stepDiv);
            const subY1 = Math.min(sh, Math.max(subY0 + 1, Math.floor(((syi + 1) * sub) / stepDiv)));
            const gy = (syi + 0.5) / stepDiv;
            for (let sxi = 0; sxi < sampleW; sxi++) {
              const subX0 = Math.floor((sxi * sub) / stepDiv);
              const subX1 = Math.min(sw, Math.max(subX0 + 1, Math.floor(((sxi + 1) * sub) / stepDiv)));
              const gx = (sxi + 0.5) / stepDiv;

              chSums.fill(0);
              let samples = 0;
              for (let sy = subY0; sy < subY1; sy++) {
                const rowOff = sy * sw;
                for (let sx = subX0; sx < subX1; sx++) {
                  const off = (rowOff + sx) * 4;
                  if (hasSplat1 && splat1) {
                    chSums[0] += splat1[off];
                    chSums[1] += splat1[off + 1];
                    chSums[2] += splat1[off + 2];
                    chSums[3] += splat1[off + 3];
                  }
                  if (hasSplat2 && splat2) {
                    chSums[4] += splat2[off];
                    chSums[5] += splat2[off + 1];
                    chSums[6] += splat2[off + 2];
                    chSums[7] += splat2[off + 3];
                  }
                  samples++;
                }
              }

              if (samples === 0) continue;
              let bestSlot = 0;
              let bestAvg = chSums[0] / samples;
              for (let s = 1; s < 8; s++) {
                if (!slotAssets[s]) continue;
                const avg = chSums[s] / samples;
                if (avg > bestAvg) {
                  bestAvg = avg;
                  bestSlot = s;
                }
              }
              if (bestSlot > 0 && bestAvg >= 64) {
                slotPts[bestSlot].push({ x: gx, y: gy });
              }
            }
          }

          // Emit broad surfaces (streets, lawns) first and narrow accent borders (gravel halos, sand rims) on top
          const activeSlots = [1, 2, 3, 4, 5, 6, 7]
            .filter((s) => slotPts[s].length > 0 && slotAssets[s])
            .sort((a, b) => slotPts[b].length - slotPts[a].length);

          for (const slotIdx of activeSlots) {
            const slotAsset = slotAssets[slotIdx]!;
            terrainStrokes.push({
              id: `dd-splat-${key}-${slotIdx + 1}`,
              assetId: slotAsset.assetId,
              points: slotPts[slotIdx],
              radiusCells,
              opacity: 0.94,
              softness,
              continuous: false,
              importedSourceRef: slotRefs[slotIdx],
            });
          }
        }
      }
    }

    // 1b. Building Floor Shapes & Tiles:
    // Dungeondraft format 3 stores diagonal building footprints as raw PoolVector2Array strings in
    // `shapes.polygons[]` while storing per-grid tile IDs in `tiles.cells`. Match those polygons to
    // their interior tile texture so angled buildings get razor-sharp clipped floors with ZERO
    // stair-stepped tiles bleeding outside diagonal walls!
    const shapesObjPre = asRecord(lvlData.shapes);
    const rawShapePolysPre = Array.isArray(shapesObjPre?.polygons) ? shapesObjPre!.polygons : [];
    const parsedStringShapePolys: Point2D[][] = [];
    for (let si = 0; si < rawShapePolysPre.length; si++) {
      if (typeof rawShapePolysPre[si] === "string") {
        const pts = parseGodotPoolVector2Array(rawShapePolysPre[si]).map((pt) => ({
          x: pt.x / ppg,
          y: pt.y / ppg,
        }));
        if (pts.length >= 3) parsedStringShapePolys.push(pts);
      }
    }

    const tilesObj = asRecord(lvlData.tiles);
    if (options.importTerrain !== false && tilesObj) {
      const cells = parseGodotPoolIntArray(tilesObj.cells);
      const lookup = asRecord(tilesObj.lookup);
      if (cells && lookup && cells.length >= widthCells * heightCells) {
        const coveredByShape = new Uint8Array(widthCells * heightCells);

        // First emit exact crisp polygons for every diagonal/building shape polygon
        for (let spi = 0; spi < parsedStringShapePolys.length; spi++) {
          const poly = parsedStringShapePolys[spi];
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const pt of poly) {
            if (pt.x < minX) minX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y > maxY) maxY = pt.y;
          }
          const tx0 = Math.max(0, Math.floor(minX) - 1);
          const ty0 = Math.max(0, Math.floor(minY) - 1);
          const tx1 = Math.min(widthCells - 1, Math.ceil(maxX));
          const ty1 = Math.min(heightCells - 1, Math.ceil(maxY));
          const tileCounts = new Map<number, number>();
          const edgeTileCounts = new Map<number, number>();

          for (let ty = ty0; ty <= ty1; ty++) {
            for (let tx = tx0; tx <= tx1; tx++) {
              const tileId = cells[ty * widthCells + tx];
              if (tileId < 0) continue;
              const centerIn = pointInPolygon({ x: tx + 0.5, y: ty + 0.5 }, poly);
              const cornerIn =
                centerIn ||
                pointInPolygon({ x: tx + 0.05, y: ty + 0.05 }, poly) ||
                pointInPolygon({ x: tx + 0.95, y: ty + 0.05 }, poly) ||
                pointInPolygon({ x: tx + 0.95, y: ty + 0.95 }, poly) ||
                pointInPolygon({ x: tx + 0.05, y: ty + 0.95 }, poly);
              if (cornerIn) {
                coveredByShape[ty * widthCells + tx] = 1;
                if (centerIn) {
                  tileCounts.set(tileId, (tileCounts.get(tileId) ?? 0) + 1);
                } else {
                  edgeTileCounts.set(tileId, (edgeTileCounts.get(tileId) ?? 0) + 1);
                }
              }
            }
          }

          const countsToUse = tileCounts.size > 0 ? tileCounts : edgeTileCounts;
          let bestTileId = -1;
          let bestCount = 0;
          for (const [tid, cnt] of countsToUse.entries()) {
            if (cnt > bestCount) {
              bestTileId = tid;
              bestCount = cnt;
            }
          }
          if (bestTileId >= 0) {
            const ref = lookup[String(bestTileId)];
            if (typeof ref === "string" && ref.trim()) {
              const { assetId } = resolveAsset(ref, "terrain", "core-fantasy/terrain/tavern_oak_planks.png");
              terrainStrokes.push({
                id: `dd-shape-floor-${key}-${spi + 1}`,
                assetId,
                shape: "polygon",
                points: poly,
                radiusCells: 0,
                opacity: 1,
                softness: 0,
                importedSourceRef: ref,
              });
            }
          }
        }

        // For legacy format-1/2 maps without format-3 `shapes.polygons`, emit run-length merged tile rectangles.
        // In format-3 maps, Dungeondraft strictly clip-masks `tiles.cells` to `shapes.polygons`, so any cells
        // outside `shapes.polygons` are invisible grid leftovers that would otherwise bleed into streets!
        if (parsedStringShapePolys.length === 0) {
          for (let ty = 0; ty < heightCells; ty++) {
            let tx = 0;
            while (tx < widthCells) {
              const idx = ty * widthCells + tx;
              const tileId = coveredByShape[idx] ? -1 : cells[idx];
              if (tileId < 0) {
                tx++;
                continue;
              }
              let endX = tx + 1;
              while (
                endX < widthCells &&
                !coveredByShape[ty * widthCells + endX] &&
                cells[ty * widthCells + endX] === tileId
              ) {
                endX++;
              }
              const ref = lookup[String(tileId)];
              if (typeof ref === "string" && ref.trim()) {
                const { assetId } = resolveAsset(ref, "terrain", "core-fantasy/terrain/tavern_oak_planks.png");
                terrainStrokes.push({
                  id: `dd-tile-${key}-${ty}-${tx}`,
                  assetId,
                  shape: "polygon",
                  points: [
                    { x: tx, y: ty },
                    { x: endX, y: ty },
                    { x: endX, y: ty + 1 },
                    { x: tx, y: ty + 1 },
                  ],
                  radiusCells: 0,
                  opacity: 1,
                  softness: 0,
                  importedSourceRef: ref,
                });
              }
              tx = endX;
            }
          }
        }
      }
    }

    // 1c. Pattern Shape Polygons (`patterns[]`, with local `position` offset!)
    const rawPatterns = Array.isArray(lvlData.patterns) ? lvlData.patterns : [];
    if (options.importTerrain !== false) {
      for (let pai = 0; pai < rawPatterns.length; pai++) {
        const pa = asRecord(rawPatterns[pai]);
        if (!pa) continue;
        const pos = parseGodotVector2(pa.position) ?? { x: 0, y: 0 };
        const pts = parseGodotPoolVector2Array(pa.points).map((pt) => ({
          x: (pt.x + pos.x) / ppg,
          y: (pt.y + pos.y) / ppg,
        }));
        if (pts.length < 3) continue;
        const srcRef = typeof pa.texture === "string" ? pa.texture : "terrain/parlor_herringbone.png";
        const { assetId, asset } = resolveAsset(srcRef, "terrain", "terrain/parlor_herringbone.png");
        const col = parseGodotColor(pa.color);
        const patRot = asNum(pa.shape_rotation ?? pa.rotation, 0);
        terrainStrokes.push({
          id: `dd-pat-${key}-${pai + 1}`,
          assetId,
          shape: "polygon",
          points: pts,
          radiusCells: 0,
          opacity: col ? Math.max(0.2, col.alpha) : 1,
          softness: 0,
          rotationDeg: Math.round(((patRot * 180) / Math.PI) % 360),
          recolor:
            col && !isNearWhite(col.hex)
              ? makeRecolorFromHex(col.hex, asset?.drawMode, asset?.drawMode === "dd_red" ? 0.9 : 0.36)
              : undefined,
          importedSourceRef: srcRef,
        });
      }
    }

    // 2. Caves
    const caveObj = asRecord(lvlData.cave);
    let caveSystem: MapLayer["caveSystem"] | undefined;
    if (caveObj && caveObj.enabled !== false) {
      const caveOps: CaveOperation[] = [];
      const rawCavePolys = Array.isArray(caveObj.polygons) ? caveObj.polygons : [];
      for (let ci = 0; ci < rawCavePolys.length; ci++) {
        const pts = parseGodotPoolVector2Array(rawCavePolys[ci]).map((p) => ({
          x: p.x / ppg,
          y: p.y / ppg,
        }));
        if (pts.length >= 3) {
          caveOps.push({
            id: `dd-cave-${key}-${ci + 1}`,
            kind: "polygon",
            points: pts,
            organicRoughness: 0.35,
            seed: 200 + ci * 13,
          });
        }
      }
      if (caveOps.length > 0) {
        caveSystem = {
          ...createDefaultCaveSystem(),
          operations: caveOps,
        };
      }
    }

    // 3. Water Regions (with dry island cutouts & per-node deep/shallow colors!)
    const waterRegions: WaterRegion[] = [];
    const waterObj = asRecord(lvlData.water);
    if (waterObj && waterObj.disable_border !== true) {
      const deepCol = parseGodotColor(waterObj.deep_color)?.hex ?? "#18465E";
      const shallowCol = parseGodotColor(waterObj.shallow_color)?.hex ?? "#3A88A8";
      const extracted: Array<{ polygon: Point2D[]; cutouts: Point2D[][]; deepHex: string; shallowHex: string; isOpen: boolean }> = [];
      if (waterObj.tree) {
        extractWaterPolygonsFromTree(waterObj.tree, ppg, deepCol, shallowCol, extracted);
      }
      if (Array.isArray(waterObj.polygons)) {
        for (const p of waterObj.polygons) {
          const pts = parseGodotPoolVector2Array(p).map((pt) => ({ x: pt.x / ppg, y: pt.y / ppg }));
          if (pts.length >= 3) {
            extracted.push({ polygon: pts, cutouts: [], deepHex: deepCol, shallowHex: shallowCol, isOpen: false });
          }
        }
      }
      for (let wi = 0; wi < extracted.length; wi++) {
        waterRegions.push({
          id: `dd-water-${key}-${wi + 1}`,
          kind: "water",
          shape: "polygon",
          curved: true,
          points: extracted[wi].polygon,
          cutouts: extracted[wi].cutouts.length > 0 ? extracted[wi].cutouts : undefined,
          deepColorHex: extracted[wi].deepHex,
          shallowColorHex: extracted[wi].shallowHex,
          rimColorHex: "#1E293B",
          opacity: 0.9,
          rippleIntensity: 0.45,
          causticsIntensity: 0.35,
          depthFeather: 0.55,
          shoreBankIntensity: 0.4,
          organicRoughness: 0.25,
          seed: 400 + wi * 29,
        });
      }
      totalWater += waterRegions.length;
    }

    // 4. Walls & Portals (including walls from shapes/buildings!)
    const walls: WallSegment[] = [];
    const portals: PortalNode[] = [];
    if (options.importWalls !== false) {
      const addPortal = (pRaw: unknown, wallId?: string) => {
        const pr = asRecord(pRaw);
        if (!pr) return;
        const pos = parseGodotVector2(pr.position);
        if (!pos) return;
        const srcRef = typeof pr.texture === "string" ? pr.texture : "portal/door_wood";
        const { assetId } = resolveAsset(srcRef, "portal", "portals/ornate_iron_door.png");
        const kind = inferPortalKind(srcRef);
        const radiusPx = asNum(pr.radius, ppg * 0.5);
        const widthC = Math.max(0.7, Math.min(5, (radiusPx * 2) / ppg));
        portals.push({
          id: `dd-portal-${key}-${portals.length + 1}`,
          assetId,
          kind,
          wallId,
          x: pos.x / ppg,
          y: pos.y / ppg,
          rotationRad: asNum(pr.rotation, 0),
          widthCells: Math.round(widthC * 100) / 100,
          closed: pr.closed !== false,
          locked: false,
          blocksLightWhenClosed: kind !== "window",
          importedSourceRef: srcRef,
        });
      };

      const rawWalls = Array.isArray(lvlData.walls) ? lvlData.walls : [];
      for (let wi = 0; wi < rawWalls.length; wi++) {
        const wr = asRecord(rawWalls[wi]);
        if (!wr) continue;
        const pts = parseGodotPoolVector2Array(wr.points).map((pt) => ({
          x: pt.x / ppg,
          y: pt.y / ppg,
        }));
        if (pts.length < 2) continue;
        const srcRef = typeof wr.texture === "string" ? wr.texture : "walls/stone_wall";
        const { assetId, asset } = resolveAsset(srcRef, "wall", "walls/berlin_stone_masonry.png");
        const col = parseGodotColor(wr.color);
        const wallId = `dd-wall-${key}-${wi + 1}`;
        const castsShadow = wr.shadow !== false;
        walls.push({
          id: wallId,
          assetId,
          points: pts,
          closed: Boolean(wr.loop),
          curved: false,
          thicknessCells: castsShadow ? 0.17 : 0.12,
          blocksLight: castsShadow,
          recolor:
            col && !isNearWhite(col.hex)
              ? makeRecolorFromHex(col.hex, asset?.drawMode, asset?.drawMode === "dd_red" ? 0.9 : 0.32)
              : undefined,
          importedSourceRef: srcRef,
        });
        if (Array.isArray(wr.portals)) {
          for (const ep of wr.portals) addPortal(ep, wallId);
        }
      }

      // Building shapes (closed room polygons with optional floor + wall!)
      const shapesObj = asRecord(lvlData.shapes);
      const shapePolys = Array.isArray(shapesObj?.polygons) ? shapesObj!.polygons : [];
      const shapeWalls = Array.isArray(shapesObj?.walls) ? shapesObj!.walls : [];
      for (let si = 0; si < shapePolys.length; si++) {
        const sp = asRecord(shapePolys[si]);
        if (!sp) continue;
        const pts = parseGodotPoolVector2Array(sp.polygon ?? sp.points).map((pt) => ({
          x: pt.x / ppg,
          y: pt.y / ppg,
        }));
        if (pts.length < 3) continue;
        const floorRef = typeof sp.texture === "string" ? sp.texture : "";
        if (floorRef && options.importTerrain !== false) {
          const { assetId } = resolveAsset(floorRef, "terrain", "terrain/parlor_herringbone.png");
          terrainStrokes.push({
            id: `dd-floor-${key}-${si + 1}`,
            assetId,
            points: pts,
            radiusCells: 0,
            opacity: 1,
            softness: 0,
            shape: "polygon",
            importedSourceRef: floorRef,
          });
        }
      }
      for (let swi = 0; swi < shapeWalls.length; swi++) {
        const sw = asRecord(shapeWalls[swi]);
        if (!sw) continue;
        const pts = parseGodotPoolVector2Array(sw.points).map((pt) => ({
          x: pt.x / ppg,
          y: pt.y / ppg,
        }));
        if (pts.length < 2) continue;
        const srcRef = typeof sw.texture === "string" ? sw.texture : "walls/stone_wall";
        const { assetId } = resolveAsset(srcRef, "wall", "walls/berlin_stone_masonry.png");
        walls.push({
          id: `dd-shwall-${key}-${swi + 1}`,
          assetId,
          points: pts,
          closed: Boolean(sw.loop ?? true),
          curved: false,
          thicknessCells: 0.28,
          blocksLight: true,
          importedSourceRef: srcRef,
        });
      }

      // Level-level freestanding portals
      const rawPortals = Array.isArray(lvlData.portals) ? lvlData.portals : [];
      for (const p of rawPortals) addPortal(p);

      totalWalls += walls.length;
      totalPortals += portals.length;
    }

    // 5. Spline Paths (stably ordered by DD layer z-band so road markings & banners sit over base stairs/curbs)
    const pathsWithZ: Array<{ z: number; idx: number; path: SplinePath }> = [];
    const rawPaths = Array.isArray(lvlData.paths) ? lvlData.paths : [];
    for (let pi = 0; pi < rawPaths.length; pi++) {
      const pr = asRecord(rawPaths[pi]);
      if (!pr) continue;
      const pos = parseGodotVector2(pr.position) ?? { x: 0, y: 0 };
      const pts = parseGodotPoolVector2Array(pr.edit_points ?? pr.points).map((pt) => ({
        x: (pt.x + pos.x) / ppg,
        y: (pt.y + pos.y) / ppg,
      }));
      if (pts.length < 2) continue;
      const srcRef = typeof pr.texture === "string" ? pr.texture : "paths/dirt_road";
      const explicitCol = parseGodotColor(pr.color);
      const { assetId, asset } = resolveAsset(
        srcRef,
        "path",
        "paths/funicular_brass_track.png",
        false,
        explicitCol && !isNearWhite(explicitCol.hex) ? "dd_red" : undefined,
      );
      const rawWidth = asNum(pr.width, 1);
      const widthC = rawWidth > 16 ? rawWidth / ppg : rawWidth;
      const inferredNamedHex =
        !explicitCol && asset?.drawMode === "dd_red" ? inferNamedColorHexFromRef(srcRef) : null;
      const pathTintHex =
        explicitCol && !isNearWhite(explicitCol.hex) ? explicitCol.hex : inferredNamedHex;
      pathsWithZ.push({
        z: asNum(pr.layer, 100),
        idx: pi,
        path: {
          id: `dd-path-${key}-${pi + 1}`,
          assetId,
          points: pts,
          widthCells: Math.max(0.12, Math.min(8, widthC)),
          curved: asNum(pr.smoothness, 1) > 0.1,
          taperEnds: Boolean(pr.grow || pr.shrink),
          fadeEnds: Boolean(pr.fade_in || pr.fade_out),
          opacity: 1,
          blocksScatter: true,
          recolor: pathTintHex
            ? makeRecolorFromHex(pathTintHex, asset?.drawMode, asset?.drawMode === "dd_red" ? 0.92 : 0.6)
            : undefined,
          importedSourceRef: srcRef,
        },
      });
    }
    pathsWithZ.sort((a, b) => a.z - b.z || a.idx - b.idx);
    const paths: SplinePath[] = pathsWithZ.map((p) => p.path);
    totalPaths += paths.length;

    // 6. Roofs (Dungeondraft points are relative to roof.position, width is half-span!)
    const roofs: RoofStructure[] = [];
    const roofsBlock = asRecord(lvlData.roofs);
    const levelSunDir = asNum(roofsBlock?.sun_direction, 315);
    const rawRoofs = roofsBlock?.roofs ?? lvlData.roofs;
    const roofList = Array.isArray(rawRoofs) ? rawRoofs : [];
    for (let ri = 0; ri < roofList.length; ri++) {
      const rr = asRecord(roofList[ri]);
      if (!rr) continue;
      const rPos = parseGodotVector2(rr.position) ?? { x: 0, y: 0 };
      const pts = parseGodotPoolVector2Array(rr.points).map((pt) => ({
        x: (pt.x + rPos.x) / ppg,
        y: (pt.y + rPos.y) / ppg,
      }));
      if (pts.length < 2) continue;
      const srcRef = typeof rr.texture === "string" ? rr.texture : "roofs/terracotta_tiles";
      const { assetId } = resolveAsset(
        srcRef,
        "terrain",
        "modular-suite/terrain/roof_terracotta_barrel_tiles.png",
        true,
      );
      const rawW = asNum(rr.width, 3 * ppg);
      const widthC = Math.max(1.5, Math.min(24, rawW > 32 ? (rawW * 2) / ppg : rawW));
      const ddType = rr.style ?? rr.type;
      const resolvedStyle: RoofStyle =
        typeof ddType === "number"
          ? ddType === 1
            ? "hip"
            : "gable"
          : inferRoofStyle(ddType);
      roofs.push({
        id: `dd-roof-${key}-${ri + 1}`,
        style: resolvedStyle,
        assetId,
        points: pts,
        widthCells: Math.round(widthC * 10) / 10,
        curved: false,
        sunAngleDeg: Math.round(asNum(rr.sun_angle, levelSunDir)),
        slopeShade: asNum(roofsBlock?.shade_contrast, 0.45),
        ridgeCapStyle: "matching",
        eaveTrim: true,
        dropShadow: 0.45,
        opacity: 1,
        importedSourceRef: srcRef,
      });
    }
    totalRoofs += roofs.length;

    // 7. Objects / Props
    const objects: ObjectStamp[] = [];
    const rawObjects = Array.isArray(lvlData.objects) ? lvlData.objects : [];
    if (options.importObjects !== false) {
      for (let oi = 0; oi < rawObjects.length; oi++) {
        const or = asRecord(rawObjects[oi]);
        if (!or) continue;
        const pos = parseGodotVector2(or.position);
        if (!pos) continue;
        const srcRef = typeof or.texture === "string" ? or.texture : "objects/wooden_crate";
        const col = parseGodotColor(or.custom_color);
        const hasCustomColor = Boolean(col && !isNearWhite(col.hex));
        const isFoliageRef = /\b(bush|shrub|tree|flower|leaf|leaves|vine|fern|grass|moss|hedge|plant)\b/i.test(
          srcRef.replace(/[_/\\-]+/g, " "),
        );
        const { assetId, asset } = resolveAsset(
          srcRef,
          "object",
          "objects/berlin_litfass_kiosk.png",
          false,
          hasCustomColor && !isFoliageRef ? "dd_red" : undefined,
        );
        const scaleVec = parseGodotVector2(or.scale);
        const sx = Math.abs(scaleVec ? scaleVec.x : asNum(or.scale, 1));
        const sy = Math.abs(scaleVec ? scaleVec.y : sx);
        // Normalize against DD's native pixels-per-grid (256) so compact CC0 furniture/props with
        // low manual-placement defaultPpi (96..164) aren't double-scaled by DD's scale multiplier;
        // full tree canopies naturally span ~2.2 cells in DD at scale 1.0 so allow a 140 PPI floor for trees.
        const isTreeCanopyRef = /\btree\b/i.test(srcRef.replace(/[_/\\-]+/g, " ")) && !/\bstump\b/i.test(srcRef);
        const minRefPpi = isTreeCanopyRef ? Math.round(ppg * 0.55) : ppg;
        const refPpi = Math.max(minRefPpi, asset?.defaultPpi || ppg);
        const baseW = asset && asset.widthPx > 0 ? asset.widthPx / refPpi : 1.0;
        const baseH = asset && asset.heightPx > 0 ? asset.heightPx / refPpi : 1.0;
        const widthC = Math.max(0.25, Math.min(20, Math.round(baseW * sx * 100) / 100));
        const heightC = Math.max(0.25, Math.min(20, Math.round(baseH * sy * 100) / 100));
        const zLayer = asNum(or.layer, 100);
        const objRecolor =
          hasCustomColor && col
            ? asset?.drawMode === "dd_red"
              ? makeRecolorFromHex(col.hex, "dd_red", 0.9)
              : isFoliageRef
                ? { ...DEFAULT_RECOLOR }
                : makeRecolorFromHex(col.hex, asset?.drawMode, 0.78)
            : { ...DEFAULT_RECOLOR };

        objects.push({
          id: `dd-obj-${key}-${oi + 1}`,
          assetId,
          x: Math.round((pos.x / ppg) * 1000) / 1000,
          y: Math.round((pos.y / ppg) * 1000) / 1000,
          widthCells: widthC,
          heightCells: heightC,
          rotationRad: asNum(or.rotation, 0),
          flipX: Boolean(or.mirror) || Boolean(scaleVec && scaleVec.x < 0),
          flipY: Boolean(scaleVec && scaleVec.y < 0),
          opacity: 1,
          castsShadow: or.block_light !== false,
          locked: false,
          recolor: objRecolor,
          zOrder: Math.round(zLayer / 10) + 50,
          importedSourceRef: srcRef,
        });
      }
      totalObjects += objects.length;
    }

    // 8. Lights
    const lights: LightNode[] = [];
    const rawLights = Array.isArray(lvlData.lights) ? lvlData.lights : [];
    if (options.importLights !== false) {
      for (let lti = 0; lti < rawLights.length; lti++) {
        const lr = asRecord(rawLights[lti]);
        if (!lr) continue;
        const pos = parseGodotVector2(lr.position);
        if (!pos) continue;
        const col = parseGodotColor(lr.color);
        const range = Math.max(1, Math.min(24, asNum(lr.range, 5)));
        lights.push({
          id: `dd-light-${key}-${lti + 1}`,
          name: `Light ${lti + 1}`,
          x: Math.round((pos.x / ppg) * 1000) / 1000,
          y: Math.round((pos.y / ppg) * 1000) / 1000,
          radiusCells: range,
          intensity: Math.max(0.15, Math.min(2, asNum(lr.intensity, 1))),
          colorHex: col?.hex ?? "#FFB84D",
          castShadows: lr.shadows !== false,
          coneAngleDeg: 360,
          directionRad: asNum(lr.rotation, 0),
          flicker: false,
        });
      }
      if (lights.length > 0) lightingEnabled = true;
      totalLights += lights.length;
    }

    // Assemble clean per-floor layers (omit completely empty placeholder layers on non-ground levels like Roof)
    const prefix = meta.shortCode;
    const keepEmptyCore = meta.isGround;
    if (keepEmptyCore || terrainStrokes.length > 0) {
      layers.push({
        id: `layer-dd-terrain-${key}`,
        name: `${prefix} Terrain & Floors`,
        kind: "terrain",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        terrainStrokes,
      });
    }
    if (caveSystem) {
      layers.push({
        id: `layer-dd-caves-${key}`,
        name: `${prefix} Caverns`,
        kind: "caves",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        caveSystem,
      });
    }
    if (waterRegions.length > 0) {
      layers.push({
        id: `layer-dd-water-${key}`,
        name: `${prefix} Water Bodies`,
        kind: "water",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        waterRegions,
        waterMeshEnabled: true,
      });
    }
    if (paths.length > 0) {
      layers.push({
        id: `layer-dd-paths-${key}`,
        name: `${prefix} Roads & Paths`,
        kind: "paths",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        paths,
      });
    }
    if (keepEmptyCore || walls.length > 0 || portals.length > 0) {
      layers.push({
        id: `layer-dd-walls-${key}`,
        name: `${prefix} Walls & Portals`,
        kind: "walls",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        walls,
        portals,
      });
    }
    if (keepEmptyCore || objects.length > 0) {
      layers.push({
        id: `layer-dd-objects-${key}`,
        name: `${prefix} Props & Furniture`,
        kind: "objects",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        objects,
      });
    }
    if (roofs.length > 0) {
      layers.push({
        id: `layer-dd-roofs-${key}`,
        name: `${prefix} Roofs`,
        kind: "roofs",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        roofs,
      });
    }
    if (lights.length > 0) {
      layers.push({
        id: `layer-dd-lights-${key}`,
        name: `${prefix} Lights`,
        kind: "lights",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId,
        lights,
      });
    }
  }

  // Order levels bottom-to-top by elevation (B1 → 1F → 2F → ROOF) and sync BOTH level & layer
  // visibility strictly to the primary Ground floor so ROOF/upper/basement layers start cleanly hidden!
  levels.sort((a, b) => a.elevationFt - b.elevationFt);
  const levelElevMap = new Map(levels.map((lv) => [lv.id, lv.elevationFt]));
  for (const lvl of levels) {
    lvl.visible = lvl.id === primaryLevelId;
  }
  layers.sort((a, b) => (levelElevMap.get(a.levelId) ?? 0) - (levelElevMap.get(b.levelId) ?? 0));
  for (const lyr of layers) {
    lyr.visible = lyr.levelId === primaryLevelId;
  }
  if (!layers.some((l) => l.id === primaryObjectLayerId)) {
    const fallbackActive =
      layers.find((l) => l.levelId === primaryLevelId && l.kind === "objects") ??
      layers.find((l) => l.levelId === primaryLevelId) ??
      layers[0];
    if (fallbackActive) primaryObjectLayerId = fallbackActive.id;
  }

  // Add DM Notes layer on primary ground floor
  layers.push({
    id: "layer-dd-dm-notes",
    name: "DM Notes",
    kind: "dm_notes",
    visible: true,
    locked: false,
    dmOnly: true,
    opacity: 1,
    blendMode: "normal",
    levelId: primaryLevelId,
    dmNotes: [],
  });

  const cleanTitle = options.fileName
    .replace(/\.(dungeondraft_map|json)$/i, "")
    .replace(/[_]+/g, " ")
    .trim() || "Imported Battlemap";

  const now = new Date().toISOString();
  const doc: DcMapDocument = {
    schemaVersion: "1.0.0",
    id: `map-dd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    mode: "battlemap",
    meta: {
      title: `${cleanTitle} (Imported)`,
      author: "Dungeondraft Import · Dice Chaos Maps",
      createdAt: now,
      updatedAt: now,
    },
    canvas: {
      widthCells,
      heightCells,
      ppi: 256,
      baseTerrainAssetId,
      baseTerrainImportedRef,
      grid: {
        type: "square",
        visible: true,
        colorHex: "#CBD5E1",
        opacity: 0.14,
      },
    },
    levels,
    activeLevelId: primaryLevelId,
    layers,
    activeLayerId: primaryObjectLayerId,
    lighting: {
      enabled: lightingEnabled,
      activePresetId: lightingEnabled ? "imported" : "day",
      ambientColorHex,
      ambientIntensity,
      shadowSoftness: 0.45,
      presets: [
        { id: "imported", name: "Imported Environment", ambientColorHex, ambientIntensity },
        { id: "day", name: "Daylight", ambientColorHex: "#FFFFFF", ambientIntensity: 1.0 },
        { id: "night", name: "Moonlit Night", ambientColorHex: "#1E293B", ambientIntensity: 0.28 },
      ],
    },
  };

  const swapEntries = Array.from(swapMap.values()).sort((a, b) => b.count - a.count);
  let matchedExactCount = 0;
  let matchedCc0Count = 0;
  let fallbackCount = 0;
  for (const e of swapEntries) {
    if (e.confidence === "exact") matchedExactCount += e.count;
    else if (e.confidence === "high" || e.confidence === "medium") matchedCc0Count += e.count;
    else fallbackCount += e.count;
  }

  return {
    doc,
    summary: {
      sourceFormat: "dungeondraft",
      sourceFileName: options.fileName,
      originalWidthPx: widthCells * ppg,
      originalHeightPx: heightCells * ppg,
      targetWidthCells: widthCells,
      targetHeightCells: heightCells,
      levelCount: levels.length,
      counts: {
        symbolsOrObjects: totalObjects,
        labels: 0,
        trailsOrPaths: totalPaths,
        rivers: 0,
        walls: totalWalls,
        portals: totalPortals,
        lights: totalLights,
        waterRegions: totalWater,
        roofs: totalRoofs,
        hasHeightmap: false,
        hasGroundPaint: false,
      },
      swapEntries,
      matchedExactCount,
      matchedCc0Count,
      fallbackCount,
    },
  };
}

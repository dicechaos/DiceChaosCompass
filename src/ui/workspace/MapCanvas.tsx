import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Circle,
  DoorOpen,
  Droplets,
  Eraser,
  Eye,
  EyeOff,
  Grid3x3,
  Layers,
  Magnet,
  Maximize2,
  Mountain,
  PaintBucket,
  Paintbrush,
  Pentagon,
  RefreshCw,
  RotateCw,
  Scissors,
  Shield,
  Sparkles,
  Spline,
  Square,
  Sun,
  Waves,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  buildEntranceFadeApron,
  computeCaveGeometry,
  snapEntranceToCavePerimeter,
} from "@/engine/caveEngine";
import {
  applyStampColorJitter,
  getProcessedTexture,
} from "@/engine/colorShader";
import {
  computeDefaultWallEdgeBulge,
  computeTvCalibration,
  convertLegacyWallCurveToSegments,
  distanceToWall,
  findNearestWallSnap,
  getWallSegmentArcInfo,
  getWallSegmentCount,
  hasWallSegmentCurves,
  insertWallVertexWithCurves,
  normalizeWallSegmentCurves,
  pointInPolygon,
  removeWallVertexWithCurves,
  sampleCatmullRom,
  sampleWallPoints,
  sampleWallSegmentArc,
  snapPoint,
  snapWallSegmentSagitta,
} from "@/engine/geometry";
import {
  buildBoxRoofParams,
  computeAutoRoomRoof,
  computeRoofGeometry,
  getRoofWidthHandles,
  pointInRoof,
} from "@/engine/roofEngine";
import {
  collectAllDocAssetUrls,
  drawRoofStructure,
  drawUnifiedTerrainGroup,
  renderMapScene,
  resolveAssetUrl,
  texturePool,
} from "@/engine/sceneRenderer";
import { describeSelection } from "@/engine/selectionInfo";
import {
  buildFloorBarrierGrid,
  computeSmartFloodFill,
  hitTestTerrainAtPoint,
  makeRectPolygon,
  sampleTerrainStrokePolygon,
} from "@/engine/terrainFill";
import {
  buildBoxWallPoints,
  buildCircleOrPolygonWallPoints,
  buildCorridorWalls,
  buildThreePointArcWallPoints,
  constrainAngle45Deg,
  findWallCutHit,
  findWallSnapTarget,
} from "@/engine/wallEngine";
import {
  buildRiverPolygon,
  createLiveWaterSculptSession,
  pointInWaterRegion,
  stepLiveWaterSculptSession,
  type LiveWaterSculptSession,
} from "@/engine/waterEngine";
import {
  buildMeanderingRiverGeometry,
  findWorldSymbolFamilyVariants,
  formatOverlandTravelMeasure,
  hitTestWorldLabel,
  hitTestWorldRegion,
  hitTestWorldRiver,
  hitTestWorldTrail,
  isPointOnLand,
  pickNextWorldVariant,
  sampleWorldBiomeColor,
} from "@/engine/worldEngine";
import {
  drawWorldLabel,
  drawWorldTrail,
  getCachedWorldOverviewCanvas,
  renderWorldMapScene,
} from "@/engine/worldRenderer";
import { expandTemplateAtPoint } from "@/data/objectTemplates";
import { useDocumentStore, type SelectionRef } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import type { ContextMenuEntry } from "@/ui/common/ContextMenu";
import { ElevationRail } from "@/ui/workspace/ElevationRail";
import type {
  CaveDrawMode,
  DcMapDocument,
  LightNode,
  Point2D,
  PortalNode,
  RoofDrawMode,
  RoofStructure,
  RoofStyle,
  TerrainEraseShape,
  TerrainMode,
  TerrainReplaceScope,
  TerrainStroke,
  WallDrawMode,
  WallPolygonShape,
  WallSplitSubMode,
  WaterDrawMode,
  WorldLandBrushMode,
} from "@/types/map";

interface MapCanvasProps {
  onOpenContextMenu: (
    x: number,
    y: number,
    ariaLabel: string,
    entries: ContextMenuEntry[],
  ) => void;
}

interface CurveEditableShape {
  points: Point2D[];
  closed: boolean;
  curved: boolean;
  segmentCurves?: Array<number | null>;
  noun: string;
  minPoints: number;
  locked: boolean;
}

function resolveCurveEditableEntity(
  d: DcMapDocument,
  sel: SelectionRef | null,
): CurveEditableShape | null {
  if (!sel) return null;
  if (sel.kind === "world_river") {
    const r = d.world?.rivers.find((x) => x.id === sel.id);
    return r
      ? {
          points: r.points,
          closed: false,
          curved: r.curved,
          segmentCurves: r.segmentCurves,
          noun: "Span",
          minPoints: 2,
          locked: false,
        }
      : null;
  }
  if (sel.kind === "world_trail") {
    const t = d.world?.trails.find((x) => x.id === sel.id);
    return t
      ? {
          points: t.points,
          closed: false,
          curved: t.curved,
          segmentCurves: t.segmentCurves,
          noun: "Segment",
          minPoints: 2,
          locked: false,
        }
      : null;
  }
  if (sel.kind === "world_region") {
    const rg = d.world?.regions.find((x) => x.id === sel.id);
    return rg
      ? {
          points: rg.polygon,
          closed: true,
          curved: Boolean(rg.curved),
          segmentCurves: rg.segmentCurves,
          noun: "Border",
          minPoints: 3,
          locked: false,
        }
      : null;
  }
  const layer = d.layers.find((l) => l.id === sel.layerId);
  if (!layer) return null;
  if (sel.kind === "wall") {
    const w = layer.walls?.find((x) => x.id === sel.id);
    return w
      ? {
          points: w.points,
          closed: w.closed,
          curved: w.curved,
          segmentCurves: w.segmentCurves,
          noun: "Section",
          minPoints: 2,
          locked: layer.locked,
        }
      : null;
  }
  if (sel.kind === "path") {
    const p = layer.paths?.find((x) => x.id === sel.id);
    return p
      ? {
          points: p.points,
          closed: false,
          curved: p.curved !== false,
          segmentCurves: p.segmentCurves,
          noun: "Section",
          minPoints: 2,
          locked: layer.locked,
        }
      : null;
  }
  if (sel.kind === "roof") {
    const rf = layer.roofs?.find((x) => x.id === sel.id);
    if (!rf || rf.style === "cone") return null;
    return {
      points: rf.points,
      closed: false,
      curved: Boolean(rf.curved),
      segmentCurves: rf.segmentCurves,
      noun: "Ridge",
      minPoints: 2,
      locked: layer.locked,
    };
  }
  if (sel.kind === "water") {
    const wr = layer.waterRegions?.find((x) => x.id === sel.id);
    return wr
      ? {
          points: wr.points,
          closed: wr.shape !== "river",
          curved: wr.curved ?? wr.kind !== "chasm",
          segmentCurves: wr.segmentCurves,
          noun: wr.shape === "river" ? "Channel" : "Shore",
          minPoints: wr.shape !== "river" ? 3 : 2,
          locked: layer.locked,
        }
      : null;
  }
  return null;
}

function patchCurveEditablePoints(
  st: ReturnType<typeof useDocumentStore.getState>,
  sel: SelectionRef,
  points: Point2D[],
  segmentCurves: Array<number | null> | undefined,
  recordHistory: boolean,
) {
  if (sel.kind === "wall") {
    st.updateWall(sel.layerId, sel.id, { points, segmentCurves }, recordHistory);
  } else if (sel.kind === "path") {
    st.updatePath(sel.layerId, sel.id, { points, segmentCurves }, recordHistory);
  } else if (sel.kind === "roof") {
    st.updateRoof(sel.layerId, sel.id, { points, segmentCurves }, recordHistory);
  } else if (sel.kind === "water") {
    st.updateWaterRegion(sel.layerId, sel.id, { points, segmentCurves }, recordHistory);
  } else if (sel.kind === "world_river") {
    st.updateWorldRiver(sel.id, { points, segmentCurves }, recordHistory);
  } else if (sel.kind === "world_trail") {
    st.updateWorldTrail(sel.id, { points, segmentCurves }, recordHistory);
  } else if (sel.kind === "world_region") {
    st.updateWorldRegion(sel.id, { polygon: points, segmentCurves }, recordHistory);
  }
}

function buildSectionCurveContextEntries(
  st: ReturnType<typeof useDocumentStore.getState>,
  sel: SelectionRef,
  shape: CurveEditableShape,
  clickedSegIdx: number,
  vertexIndexToRemove?: number,
): ContextMenuEntry[] {
  const entries: ContextMenuEntry[] = [];
  if (vertexIndexToRemove !== undefined && shape.points.length > shape.minPoints) {
    entries.push({
      type: "item",
      id: "rm-curve-vtx",
      label: "Remove This Vertex Point",
      shortcut: "Alt+Click",
      onSelect: () => {
        const removed = removeWallVertexWithCurves(shape, vertexIndexToRemove);
        patchCurveEditablePoints(st, sel, removed.points, removed.segmentCurves, true);
        st.setSelectedWallSegmentIndex(null);
        st.pushToast("Removed vertex point");
      },
    });
    entries.push({ type: "separator" });
  }

  const segCount = getWallSegmentCount(shape.points, shape.closed);
  if (segCount <= 0) return entries;
  const idx = Math.max(0, Math.min(segCount - 1, clickedSegIdx));
  const eff = convertLegacyWallCurveToSegments(shape);
  const segSag = eff[idx] ?? 0;
  const segIsCurved = Math.abs(segSag) >= 0.04;
  const segNum = idx + 1;
  const noun = shape.noun;

  entries.push({
    type: "item",
    id: "ent-seg-toggle",
    label: segIsCurved
      ? `Straighten ${noun} #${segNum}`
      : `Curve ${noun} #${segNum} (90° Arch)`,
    shortcut: "C",
    onSelect: () => {
      const nowCurved = st.toggleEntitySegmentCurve(sel, idx, "90");
      st.pushToast(
        nowCurved
          ? `Curved ${noun.toLowerCase()} #${segNum} — drag purple handle to reshape`
          : `Straightened ${noun.toLowerCase()} #${segNum}`,
        "success",
      );
    },
  });

  if (segIsCurved) {
    const segA = shape.points[idx];
    const segB = shape.points[(idx + 1) % shape.points.length];
    const segArcInfo = getWallSegmentArcInfo(segA, segB, segSag);
    const isAlreadySemi = Math.abs(segArcInfo.sweepDeg - 180) <= 4;
    entries.push(
      {
        type: "item",
        id: "ent-seg-flip",
        label: `Flip ${noun} #${segNum} Curve (Inward ↔ Outward)`,
        onSelect: () => {
          st.flipEntitySegmentCurve(sel, idx);
          st.pushToast(`Flipped ${noun.toLowerCase()} #${segNum} curve direction`);
        },
      },
      {
        type: "item",
        id: isAlreadySemi ? "ent-seg-90" : "ent-seg-180",
        label: isAlreadySemi
          ? `Snap ${noun} #${segNum} to 90° Arch`
          : `Snap ${noun} #${segNum} to 180° Semicircle`,
        onSelect: () => {
          const sign = segSag >= 0 ? 1 : -1;
          const ratio = isAlreadySemi ? 0.20710678 : 0.5;
          st.setEntitySegmentCurve(sel, idx, sign * segArcInfo.chord * ratio, true);
          st.pushToast(
            isAlreadySemi
              ? `Snapped ${noun.toLowerCase()} #${segNum} to 90° arch`
              : `Snapped ${noun.toLowerCase()} #${segNum} to 180° semicircle`,
          );
        },
      },
    );
  } else {
    entries.push({
      type: "item",
      id: "ent-seg-180-new",
      label: `Curve ${noun} #${segNum} Into 180° Semicircle`,
      onSelect: () => {
        const bulge = computeDefaultWallEdgeBulge(shape, idx, "180");
        st.setEntitySegmentCurve(sel, idx, bulge, true);
        st.pushToast(`Curved ${noun.toLowerCase()} #${segNum} into 180° semicircle`, "success");
      },
    });
  }
  entries.push({ type: "separator" });
  return entries;
}

const TOOL_HINTS: Record<string, string> = {
  select: "Click Prop, Wall, Line, Roof, Water or World Shape · Shift+Drag or Double-Click + to curve 1 section · Drag gold dots to reshape · Alt+Wheel scale",
  terrain: "1 Brush · 2 Smart Fill · 3 Replace · 4 Rect · 5 Polygon · 6 Erase · Alt+Click samples existing floor texture · Alt+Wheel resizes",
  cave: "Paint organic Caves or drag Dungeon Rooms (auto-walls & shadows!) · Use Entrance mode to open mouths with fade-to-terrain · Alt+Wheel resizes",
  water: "Click points to trace Water / Abyss polygon · Double-click or Right-click to finish",
  wall: "Click points to draw Walls · C toggles Straight/Curved · Alt+Wheel thickness · Hold Alt to disable snap",
  portal: "Hover near any wall to inset Door/Window/Gate · X flips swing side (In/Out) · Y flips hinge (Left/Right) · Alt+Wheel width",
  path: "Click points to draw Lines/Tracks/Stairs · Press C mid-line to curve next section · Shift locks 45°/90° or snaps 90°/180° arc · Alt+Wheel width",
  roof: "Click ridge points (like Path), drag Box/Turret, or 1-click Auto-Roof Room · 1–4 Modes · Alt+Wheel span · Shift+Wheel sun · C Curve · X Flip Slope",
  stamp: "Click to stamp Asset · Alt+Wheel scales preview · Shift+Wheel (or Q/E) rotates · X flips · Hold Alt for free snap",
  template: "Click to stamp entire Premade Object Group · Alt+Wheel or [ / ] scales · Shift+Wheel (or Q/E) rotates · Pick or save groups in Templates",
  scatter: "Click polygon points to define Smart Scatter Zone · Double-click or Right-click to populate",
  light: "Click any light bulb to select & drag · Drag cyan arrow to aim · Drag cyan ring sliders to adjust cone angle · Drag gold ring knob to resize radius",
  dm_note: "Click anywhere to pin a DM-Only Secret Note (auto-stripped in Player & VTT exports)",
  measure: "Click & drag to measure tactical distance (squares, feet, and physical 55\" TV inches)",
  world_land: "Drag to sculpt fractal coastlines (1 Raise · 2 Lower · 3 Smooth · 4 Lake · 5 Fill Lake) · Hold Alt to flip Raise/Lower · [ / ] or Alt+Wheel resizes",
  world_biome: "Drag to paint land-clipped watercolor biomes (never spills into ocean!) · Pick swatches in Inspector · [ / ] or Alt+Wheel resizes",
  world_river: "Click points from mountain spring to coast · Double-click or Enter to finish tapered meandering river",
  world_trail: "Click points for roads, caravan trails, railroads, or sea lanes · Double-click or Enter to finish",
  world_region: "Click vertices to outline a kingdom or realm (clips cleanly to coastlines!) · Click start dot or Double-click to close",
  world_label: "Click anywhere to stamp label (or roll fantasy names in Inspector) · Alt+Wheel scales text size",
  world_crop: "Click & drag a rectangle over any region to spawn a zoomed-in Regional Detail Atlas + clickable pin!",
  world_theme: "Customize Atlas Theme, Coastline Effects, Compass Rose, Scale Bar, Overland Grid & Ornamental Frame in the right Inspector",
};

function drawCanvasCroppedToScreen(
  ctx: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  cw: number,
  ch: number,
) {
  if (destW <= 0 || destH <= 0 || src.width <= 0 || src.height <= 0) return;
  const vx0 = Math.max(0, destX);
  const vy0 = Math.max(0, destY);
  const vx1 = Math.min(cw, destX + destW);
  const vy1 = Math.min(ch, destY + destH);
  const vw = vx1 - vx0;
  const vh = vy1 - vy0;
  if (vw <= 0 || vh <= 0) return;
  const sx = ((vx0 - destX) / destW) * src.width;
  const sy = ((vy0 - destY) / destH) * src.height;
  const sw = (vw / destW) * src.width;
  const sh = (vh / destH) * src.height;
  ctx.drawImage(src, sx, sy, sw, sh, vx0, vy0, vw, vh);
}

export const MapCanvas: React.FC<MapCanvasProps> = React.memo(({ onOpenContextMenu }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const battlemapOverviewRef = useRef<{
    canvas: HTMLCanvasElement;
    docId: string;
    contentKey: string;
  } | null>(null);
  const viewportCacheRef = useRef<{
    canvas: HTMLCanvasElement;
    doc: typeof doc | null;
    mode: "battlemap" | "world";
    contentKey: string;
    cellX0: number;
    cellY0: number;
    cellX1: number;
    cellY1: number;
    cellPx: number;
    dpr: number;
    interactive: boolean;
  } | null>(null);
  const wheelZoomingRef = useRef(false);
  const wheelSettleTimerRef = useRef<number | null>(null);
  const lastZoomSyncMsRef = useRef(0);

  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0],
  );
  const activeTool = useDocumentStore((s) => s.activeTool);
  const snapMode = useDocumentStore((s) => s.snapMode);
  const dmViewMode = useDocumentStore((s) => s.dmViewMode);
  const showVttOverlay = useDocumentStore((s) => s.showVttOverlay);
  const showScatterOutlines = useDocumentStore((s) => s.showScatterOutlines);
  const showOnionSkin = useDocumentStore((s) => s.showOnionSkin);
  const isolateActiveFloor = useDocumentStore((s) => s.isolateActiveFloor);
  const lockLowerFloors = useDocumentStore((s) => s.lockLowerFloors);
  const selection = useDocumentStore((s) => s.selection);
  const selectedWallSegmentIndex = useDocumentStore((s) => s.selectedWallSegmentIndex);
  const preferences = useDocumentStore((s) => s.preferences);
  const zoomPercent = useDocumentStore((s) => s.zoomPercent);

  const activeWallAssetId = useDocumentStore((s) => s.activeWallAssetId);
  const activePathAssetId = useDocumentStore((s) => s.activePathAssetId);
  const activePortalAssetId = useDocumentStore((s) => s.activePortalAssetId);
  const activeTerrainAssetId = useDocumentStore((s) => s.activeTerrainAssetId);
  const terrainMode = useDocumentStore((s) => s.terrainMode);
  const terrainTextureScale = useDocumentStore((s) => s.terrainTextureScale);
  const terrainPolygonCurved = useDocumentStore((s) => s.terrainPolygonCurved);
  const terrainReplaceScope = useDocumentStore((s) => s.terrainReplaceScope);
  const terrainEraseShape = useDocumentStore((s) => s.terrainEraseShape);
  const terrainBarrierWalls = useDocumentStore((s) => s.terrainBarrierWalls);
  const terrainBarrierCaves = useDocumentStore((s) => s.terrainBarrierCaves);
  const terrainBarrierWater = useDocumentStore((s) => s.terrainBarrierWater);
  const caveDrawMode = useDocumentStore((s) => s.caveDrawMode);
  const caveBrushRadiusCells = useDocumentStore((s) => s.caveBrushRadiusCells);
  const waterDrawMode = useDocumentStore((s) => s.waterDrawMode);
  const waterBrushRadiusCells = useDocumentStore((s) => s.waterBrushRadiusCells);
  const waterRiverWidthCells = useDocumentStore((s) => s.waterRiverWidthCells);
  const waterCurved = useDocumentStore((s) => s.waterCurved);
  const caveUndergroundFill = useDocumentStore((s) => s.caveUndergroundFill);
  const caveEntranceWidthCells = useDocumentStore((s) => s.caveEntranceWidthCells);
  const caveEntranceFadeCells = useDocumentStore((s) => s.caveEntranceFadeCells);
  const wallDrawMode = useDocumentStore((s) => s.wallDrawMode);
  const wallPolygonShape = useDocumentStore((s) => s.wallPolygonShape);
  const wallBoxRotationDeg = useDocumentStore((s) => s.wallBoxRotationDeg);
  const wallSnapToWalls = useDocumentStore((s) => s.wallSnapToWalls);
  const wallSplitSubMode = useDocumentStore((s) => s.wallSplitSubMode);
  const wallBreachWidthCells = useDocumentStore((s) => s.wallBreachWidthCells);
  const wallCorridorWidthCells = useDocumentStore((s) => s.wallCorridorWidthCells);
  const wallCorridorCapEnds = useDocumentStore((s) => s.wallCorridorCapEnds);
  const wallThicknessCells = useDocumentStore((s) => s.wallThicknessCells);
  const wallAutoFillClosed = useDocumentStore((s) => s.wallAutoFillClosed);
  const wallCurved = useDocumentStore((s) => s.wallCurved);
  const pathCurved = useDocumentStore((s) => s.pathCurved);
  const roofDrawMode = useDocumentStore((s) => s.roofDrawMode);
  const roofStyle = useDocumentStore((s) => s.roofStyle);
  const activeRoofAssetId = useDocumentStore((s) => s.activeRoofAssetId);
  const roofWidthCells = useDocumentStore((s) => s.roofWidthCells);
  const roofCurved = useDocumentStore((s) => s.roofCurved);
  const roofFlipSlope = useDocumentStore((s) => s.roofFlipSlope);
  const roofOverhangCells = useDocumentStore((s) => s.roofOverhangCells);
  const roofRotateBoxRidge = useDocumentStore((s) => s.roofRotateBoxRidge);
  const worldLandMode = useDocumentStore((s) => s.worldLandMode);
  const worldLandRadiusCells = useDocumentStore((s) => s.worldLandRadiusCells);
  const worldBiomeColorHex = useDocumentStore((s) => s.worldBiomeColorHex);
  const worldBiomeRadiusCells = useDocumentStore((s) => s.worldBiomeRadiusCells);
  const worldRiverCurved = useDocumentStore((s) => s.worldRiverCurved);
  const worldTrailCurved = useDocumentStore((s) => s.worldTrailCurved);
  const worldLabelText = useDocumentStore((s) => s.worldLabelText);
  const worldLabelFontSize = useDocumentStore((s) => s.worldLabelFontSize);
  const worldLabelCurveBend = useDocumentStore((s) => s.worldLabelCurveBend);
  const worldLabelBoxStyle = useDocumentStore((s) => s.worldLabelBoxStyle);
  const roofSunAngleDeg = useDocumentStore((s) => s.roofSunAngleDeg);
  const roofSlopeShade = useDocumentStore((s) => s.roofSlopeShade);
  const roofRidgeCapStyle = useDocumentStore((s) => s.roofRidgeCapStyle);
  const roofRidgeCapWidthCells = useDocumentStore((s) => s.roofRidgeCapWidthCells);
  const roofEaveTrim = useDocumentStore((s) => s.roofEaveTrim);
  const roofDropShadow = useDocumentStore((s) => s.roofDropShadow);
  const roofShadowDistanceCells = useDocumentStore((s) => s.roofShadowDistanceCells);
  const roofTextureScale = useDocumentStore((s) => s.roofTextureScale);
  const roofWeathering = useDocumentStore((s) => s.roofWeathering);
  const roofOpacity = useDocumentStore((s) => s.roofOpacity);
  const roofConeFacets = useDocumentStore((s) => s.roofConeFacets);
  const roofRidgeOffset = useDocumentStore((s) => s.roofRidgeOffset);
  const roofHipInsetRatio = useDocumentStore((s) => s.roofHipInsetRatio);
  const roofMansardCrownRatio = useDocumentStore((s) => s.roofMansardCrownRatio);
  const stampScale = useDocumentStore((s) => s.stampScale);
  const stampRotationRad = useDocumentStore((s) => s.stampRotationRad);
  const stampPlacementOrder = useDocumentStore((s) => s.stampPlacementOrder);
  const stampPaintDrag = useDocumentStore((s) => s.stampPaintDrag);
  const stampAutoRotate = useDocumentStore((s) => s.stampAutoRotate);
  const stampRotateMode = useDocumentStore((s) => s.stampRotateMode);
  const brushRadiusCells = useDocumentStore((s) => s.brushRadiusCells);
  const activePortalWidthCells = useDocumentStore((s) => s.activePortalWidthCells);
  const activePortalClosed = useDocumentStore((s) => s.activePortalClosed);
  const activePortalSwingInvert = useDocumentStore((s) => s.activePortalSwingInvert);
  const activePortalHingeFlip = useDocumentStore((s) => s.activePortalHingeFlip);
  const activeLightRadiusCells = useDocumentStore((s) => s.activeLightRadiusCells);
  const objectTemplates = useDocumentStore((s) => s.objectTemplates);
  const activeTemplateId = useDocumentStore((s) => s.activeTemplateId);
  const templateRotationRad = useDocumentStore((s) => s.templateRotationRad);
  const templateScale = useDocumentStore((s) => s.templateScale);
  const activeRecolor = useDocumentStore((s) => s.activeRecolor);
  const toolRecolors = useDocumentStore((s) => s.toolRecolors);
  const eyedropperTarget = useDocumentStore((s) => s.eyedropperTarget);

  const assetLookup = useVaultStore((s) => s.assetById);
  const selectedAssetId = useVaultStore((s) => s.selectedAssetId);

  // High-res sub-cell barrier grid combining active-floor Walls, Cave Auto-Walls & Water Shorelines (for 60 FPS Smart Fill & Room Erase!)
  const needsFloodBarrier =
    activeTool === "terrain" &&
    (terrainMode === "flood" || (terrainMode === "erase" && terrainEraseShape === "room"));
  const wallBarrier = useMemo(() => {
    if (!needsFloodBarrier) return null;
    return buildFloorBarrierGrid(
      doc,
      doc.activeLevelId,
      {
        walls: terrainBarrierWalls,
        caves: terrainBarrierCaves,
        water: terrainBarrierWater,
      },
      6,
    );
  }, [
    needsFloodBarrier,
    doc,
    terrainBarrierWalls,
    terrainBarrierCaves,
    terrainBarrierWater,
  ]);

  // Camera state: screenPx = originPx + gridCell * cellPx
  const camRef = useRef({ x: 32, y: 24, cellPx: 24 });
  const liveTileCacheRef = useRef<{
    cellPx: number;
    cache: Map<string, CanvasPattern | null>;
  }>({ cellPx: 0, cache: new Map() });
  const [renderTick, setRenderTick] = useState(0);
  const [textureVersion, setTextureVersion] = useState(0);
  const [draftPoints, setDraftPoints] = useState<Point2D[]>([]);
  const [draftSegmentCurves, setDraftSegmentCurves] = useState<Array<number | null>>([]);
  const [pendingFreeArcEnd, setPendingFreeArcEnd] = useState<Point2D | null>(null);
  const [measurePts, setMeasurePts] = useState<{ a: Point2D; b: Point2D } | null>(null);
  const [hoverGrid, setHoverGrid] = useState<Point2D | null>(null);
  const [hoveredLightId, setHoveredLightId] = useState<string | null>(null);
  const [hoveredLightHandle, setHoveredLightHandle] = useState<
    null | "aim" | "radius" | "cone_left" | "cone_right" | "cone_omni"
  >(null);
  const [hoveredEntranceHandle, setHoveredEntranceHandle] = useState<
    null | "slide" | "width_l" | "width_r" | "fade"
  >(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [altDown, setAltDown] = useState(false);
  const [shiftDown, setShiftDown] = useState(false);
  const [ctrlDown, setCtrlDown] = useState(false);
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  const [mapDropActive, setMapDropActive] = useState(false);

  // Active-floor walls cache for crisp magnetic wall-corner & wall-edge snapping
  const activeFloorWalls = useMemo(
    () =>
      doc.layers
        .filter((l) => l.visible && l.levelId === doc.activeLevelId && (l.walls?.length ?? 0) > 0)
        .flatMap((l) => l.walls ?? []),
    [doc.layers, doc.activeLevelId],
  );

  const resolveWallPoint = useCallback(
    (
      rawGridPt: Point2D,
      bypassSnap: boolean,
      angleAnchor?: Point2D,
      lock45?: boolean,
    ) => {
      let pt = snapPoint(rawGridPt, bypassSnap ? "free" : snapMode);
      if (lock45 && angleAnchor) {
        pt = constrainAngle45Deg(angleAnchor, pt);
      }
      if (!bypassSnap && wallSnapToWalls && activeFloorWalls.length > 0) {
        const hit = findWallSnapTarget(pt, activeFloorWalls, 0.45);
        if (hit) {
          return { point: hit.point, snap: hit };
        }
      }
      return { point: pt, snap: null };
    },
    [snapMode, wallSnapToWalls, activeFloorWalls],
  );

  // Clear in-progress polyline vertices cleanly when switching tools, Wall Mode, or Terrain Mode
  useEffect(() => {
    setDraftPoints([]);
    setDraftSegmentCurves([]);
    setPendingFreeArcEnd(null);
  }, [activeTool, wallDrawMode, terrainMode, terrainEraseShape]);

  // If user switches next-section back to Straight mid-arc-bow, cancel pending bow step cleanly
  useEffect(() => {
    if (
      (activeTool === "wall" && !wallCurved) ||
      (activeTool === "path" && !pathCurved) ||
      (activeTool === "terrain" && !terrainPolygonCurved)
    ) {
      setPendingFreeArcEnd(null);
    }
  }, [activeTool, wallCurved, pathCurved, terrainPolygonCurved]);

  // Quantize Smart Fill / Room Erase hover key to barrier sub-cell so moving inside a room is cached
  const floodHoverCellX =
    needsFloodBarrier && hoverGrid && wallBarrier
      ? Math.floor(hoverGrid.x * wallBarrier.subDiv)
      : -1;
  const floodHoverCellY =
    needsFloodBarrier && hoverGrid && wallBarrier
      ? Math.floor(hoverGrid.y * wallBarrier.subDiv)
      : -1;
  const floodPreview = useMemo(() => {
    if (!wallBarrier || floodHoverCellX < 0 || floodHoverCellY < 0) return null;
    return computeSmartFloodFill(
      {
        x: (floodHoverCellX + 0.5) / wallBarrier.subDiv,
        y: (floodHoverCellY + 0.5) / wallBarrier.subDiv,
      },
      wallBarrier,
    );
  }, [wallBarrier, floodHoverCellX, floodHoverCellY]);

  // Live hover target & highlight geometry for Replace Terrain mode (quantized to 0.25 sq for 60 FPS)
  const replaceHoverX =
    activeTool === "terrain" && terrainMode === "replace" && hoverGrid
      ? Math.floor(hoverGrid.x * 4)
      : -1;
  const replaceHoverY =
    activeTool === "terrain" && terrainMode === "replace" && hoverGrid
      ? Math.floor(hoverGrid.y * 4)
      : -1;
  const replacePreview = useMemo(() => {
    if (replaceHoverX < 0 || replaceHoverY < 0) return null;
    const probe = { x: (replaceHoverX + 0.5) / 4, y: (replaceHoverY + 0.5) / 4 };
    const hit = hitTestTerrainAtPoint(probe, doc, doc.activeLevelId);
    if (!hit) return null;

    const matchedStrokes: TerrainStroke[] = [];
    let includesBase = false;
    if (hit.kind === "base") {
      includesBase = true;
      if (terrainReplaceScope === "floor" || terrainReplaceScope === "map") {
        for (const l of doc.layers) {
          if (l.kind !== "terrain" || l.locked || !l.visible) continue;
          if (terrainReplaceScope === "floor" && l.levelId !== doc.activeLevelId) continue;
          for (const s of l.terrainStrokes ?? []) {
            if (!s.erase && s.assetId === hit.assetId) matchedStrokes.push(s);
          }
        }
      }
    } else if (terrainReplaceScope === "patch") {
      matchedStrokes.push(hit.stroke);
    } else {
      for (const l of doc.layers) {
        if (l.kind !== "terrain" || l.locked || !l.visible) continue;
        if (terrainReplaceScope === "layer" && l.id !== hit.layerId) continue;
        if (terrainReplaceScope === "floor" && l.levelId !== doc.activeLevelId) continue;
        for (const s of l.terrainStrokes ?? []) {
          if (!s.erase && s.assetId === hit.assetId) matchedStrokes.push(s);
        }
      }
      const activeLv = doc.levels.find((lv) => lv.id === doc.activeLevelId);
      if (
        (terrainReplaceScope === "map" ||
          (terrainReplaceScope === "floor" && (!activeLv || activeLv.kind === "ground"))) &&
        !doc.canvas.baseTerrainTransparent &&
        doc.canvas.baseTerrainAssetId === hit.assetId
      ) {
        includesBase = true;
      }
    }
    return { hit, matchedStrokes, includesBase };
  }, [replaceHoverX, replaceHoverY, doc, terrainReplaceScope]);

  // 1-click Auto-Roof Room live hover preview (quantized at 0.25 sq so hover is butter-smooth)
  const autoRoofHoverX =
    activeTool === "roof" && roofDrawMode === "auto_room" && hoverGrid
      ? Math.floor(hoverGrid.x * 4)
      : -1;
  const autoRoofHoverY =
    activeTool === "roof" && roofDrawMode === "auto_room" && hoverGrid
      ? Math.floor(hoverGrid.y * 4)
      : -1;
  const autoRoomRoofPreview = useMemo(() => {
    if (autoRoofHoverX < 0 || autoRoofHoverY < 0) return null;
    return computeAutoRoomRoof(
      doc,
      { x: (autoRoofHoverX + 0.5) / 4, y: (autoRoofHoverY + 0.5) / 4 },
      roofOverhangCells,
    );
  }, [doc, autoRoofHoverX, autoRoofHoverY, roofOverhangCells]);

  const buildDraftRoof = useCallback(
    (points: Point2D[], widthCells: number, styleOverride?: RoofStyle): RoofStructure => {
      const st = useDocumentStore.getState();
      const resolvedStyle: RoofStyle =
        styleOverride ??
        (st.roofDrawMode === "cone"
          ? "cone"
          : st.roofStyle === "cone"
            ? "hip"
            : st.roofStyle);
      return {
        id: `roof-preview`,
        style: resolvedStyle,
        assetId: st.activeRoofAssetId || "modular-suite/terrain/roof_terracotta_barrel_tiles.png",
        points,
        widthCells,
        curved: st.roofCurved,
        flipSlope: st.roofFlipSlope,
        ridgeOffset: st.roofRidgeOffset,
        hipInsetRatio: st.roofHipInsetRatio,
        mansardCrownRatio: st.roofMansardCrownRatio,
        coneFacets: st.roofConeFacets,
        overhangCells: st.roofOverhangCells,
        sunAngleDeg: st.roofSunAngleDeg,
        slopeShade: st.roofSlopeShade,
        ridgeCapStyle: st.roofRidgeCapStyle,
        ridgeCapWidthCells: st.roofRidgeCapWidthCells,
        eaveTrim: st.roofEaveTrim,
        dropShadow: st.roofDropShadow,
        shadowDistanceCells: st.roofShadowDistanceCells,
        textureScale: st.roofTextureScale,
        weathering: st.roofWeathering,
        opacity: st.roofOpacity,
        recolor: st.toolRecolors.roof.enabled ? { ...st.toolRecolors.roof } : undefined,
      };
    },
    [],
  );

  const dragRef = useRef<{
    mode:
      | "none"
      | "pan"
      | "move"
      | "obj_rotate"
      | "obj_scale"
      | "vertex"
      | "wall_curve"
      | "wall_mid_pending"
      | "poly_move"
      | "roof_width"
      | "roof_box"
      | "roof_cone"
      | "wall_box"
      | "wall_circle"
      | "terrain"
      | "terrain_rect"
      | "cave_brush"
      | "cave_rect"
      | "cave_erase_rect"
      | "water_brush"
      | "cave_entrance_move"
      | "cave_entrance_width"
      | "cave_entrance_fade"
      | "stamp_paint"
      | "measure"
      | "light_radius"
      | "light_aim"
      | "light_cone"
      | "world_land"
      | "world_biome"
      | "world_crop";
    startScreenX: number;
    startScreenY: number;
    camStartX: number;
    camStartY: number;
    objStartX: number;
    objStartY: number;
    origWidth?: number;
    origHeight?: number;
    origRotation?: number;
    isStretching?: boolean;
    startDistPx?: number;
    roofAnchor?: Point2D;
    roofNormal?: Point2D;
    roofSide?: "left" | "right";
    vertexIndex: number;
    origPoints: Point2D[];
    wallSegIndex?: number;
    wallEdgeA?: Point2D;
    wallEdgeB?: Point2D;
    wallLastSagitta?: number;
    hasMoved: boolean;
    terrainPoints: Point2D[];
    rectStart?: Point2D;
    rectEnd?: Point2D;
    boxSquare?: boolean;
    boxFromCenter?: boolean;
    lastStampPt?: Point2D;
    lastVariantAssetId?: string;
    lightOrigin?: Point2D;
    caveEraseHold?: boolean;
    liveWaterSession?: LiveWaterSculptSession;
    lastWaterSentIdx?: number;
    lastWaterSculptMs?: number;
  }>({
    mode: "none",
    startScreenX: 0,
    startScreenY: 0,
    camStartX: 0,
    camStartY: 0,
    objStartX: 0,
    objStartY: 0,
    origWidth: 1,
    origHeight: 1,
    origRotation: 0,
    startDistPx: 1,
    vertexIndex: -1,
    origPoints: [],
    hasMoved: false,
    terrainPoints: [],
  });

  const rafRenderRef = useRef<number | null>(null);
  const lastPaintMsRef = useRef(0);
  const pendingHoverGridRef = useRef<Point2D | null | undefined>(undefined);
  const bumpRender = useCallback(() => {
    if (rafRenderRef.current !== null) return;
    const step = (now: number) => {
      // Strictly cap canvas repaints <= 60 FPS (saves GPU/CPU on 120Hz/144Hz/240Hz monitors!)
      if (now - lastPaintMsRef.current < 15.8) {
        rafRenderRef.current = window.requestAnimationFrame(step);
        return;
      }
      rafRenderRef.current = null;
      lastPaintMsRef.current = now;
      const pendingHover = pendingHoverGridRef.current;
      if (pendingHover !== undefined) {
        pendingHoverGridRef.current = undefined;
        setHoverGrid(pendingHover);
      }
      setRenderTick((t) => t + 1);
    };
    rafRenderRef.current = window.requestAnimationFrame(step);
  }, []);
  const scheduleHoverGrid = useCallback(
    (pt: Point2D | null) => {
      pendingHoverGridRef.current = pt;
      bumpRender();
    },
    [bumpRender],
  );
  useEffect(() => {
    return () => {
      if (rafRenderRef.current !== null) {
        window.cancelAnimationFrame(rafRenderRef.current);
        rafRenderRef.current = null;
      }
    };
  }, []);
  const bumpTexture = useCallback(() => setTextureVersion((v) => v + 1), []);

  // Re-render when textures finish loading
  useEffect(() => {
    const unsub = texturePool.onLoad(bumpTexture);
    texturePool.ensureLoaded(collectAllDocAssetUrls(doc, assetLookup)).then(bumpTexture);
    return unsub;
  }, [doc, assetLookup, bumpTexture]);

  // Eagerly preload active Roof texture so WYSIWYG previews render shingles immediately
  useEffect(() => {
    if (activeTool !== "roof" || !activeRoofAssetId) return;
    const url = resolveAssetUrl(activeRoofAssetId, assetLookup);
    if (url) {
      texturePool.ensureLoaded([url]).then(bumpTexture);
    }
  }, [activeTool, activeRoofAssetId, assetLookup, bumpTexture]);

  // Eagerly preload all textures in the active Object Template so its multi-prop ghost preview is instant!
  useEffect(() => {
    if (activeTool !== "template" || !activeTemplateId) return;
    const tpl = objectTemplates.find((t) => t.id === activeTemplateId);
    if (!tpl) return;
    const urls = tpl.items
      .map((it) => resolveAssetUrl(it.assetId, assetLookup))
      .filter((u): u is string => Boolean(u));
    if (urls.length > 0) {
      texturePool.ensureLoaded(urls).then(bumpTexture);
    }
  }, [activeTool, activeTemplateId, objectTemplates, assetLookup, bumpTexture]);

  // Fit map cleanly into viewport on document switch or mount
  const fitToScreen = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const pad = 44;
    const availW = Math.max(200, wrap.clientWidth - pad * 2);
    const availH = Math.max(200, wrap.clientHeight - pad * 2);
    const cellPx = Math.min(availW / doc.canvas.widthCells, availH / doc.canvas.heightCells);
    const mapW = doc.canvas.widthCells * cellPx;
    const mapH = doc.canvas.heightCells * cellPx;
    camRef.current = {
      x: (wrap.clientWidth - mapW) / 2,
      y: (wrap.clientHeight - mapH) / 2,
      cellPx,
    };
    useDocumentStore.getState().setZoomPercent(Math.round((cellPx / 32) * 100));
    bumpRender();
  }, [doc.canvas.widthCells, doc.canvas.heightCells, bumpRender]);

  useEffect(() => {
    fitToScreen();
  }, [doc.id, fitToScreen]);

  // ResizeObserver for crisp HiDPI canvas sizing
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => bumpRender());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [bumpRender]);

  const draftPointsRef = useRef<Point2D[]>([]);
  draftPointsRef.current = draftPoints;
  const draftSegmentCurvesRef = useRef<Array<number | null>>([]);
  draftSegmentCurvesRef.current = draftSegmentCurves;
  const pendingFreeArcEndRef = useRef<Point2D | null>(null);
  pendingFreeArcEndRef.current = pendingFreeArcEnd;
  const commitDraftRef = useRef<(closedLoop: boolean) => void>(() => {});
  const lastCursorUpdateRef = useRef(0);

  // Listen for fit-screen custom event & spacebar pan modifier
  useEffect(() => {
    const onFit = () => fitToScreen();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        setSpaceDown(true);
      }
      if (e.key === "Alt") {
        if (useDocumentStore.getState().activeTool === "cave") {
          e.preventDefault();
        }
        setAltDown(true);
      }
      if (e.key === "Shift") setShiftDown(true);
      if (e.key === "Control" || e.key === "Meta") setCtrlDown(true);
      if (e.key === "Escape") {
        setDraftPoints([]);
        setDraftSegmentCurves([]);
        setPendingFreeArcEnd(null);
        setMeasurePts(null);
        if (useDocumentStore.getState().eyedropperTarget) {
          useDocumentStore.getState().setEyedropperTarget(null);
        }
      }
      if (e.key === "Enter" && draftPointsRef.current.length >= 2) {
        const curSt = useDocumentStore.getState();
        const curTool = curSt.activeTool;
        commitDraftRef.current(
          curTool === "water" ||
            curTool === "scatter" ||
            curTool === "world_region" ||
            (curTool === "terrain" &&
              (curSt.terrainMode === "polygon" ||
                (curSt.terrainMode === "erase" && curSt.terrainEraseShape === "polygon"))) ||
            (curTool === "cave" && curSt.caveDrawMode === "polygon"),
        );
      }
      if (e.key === "Backspace" && (draftPointsRef.current.length > 0 || pendingFreeArcEndRef.current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (pendingFreeArcEndRef.current) {
          setPendingFreeArcEnd(null);
        } else {
          setDraftPoints((prev) => prev.slice(0, -1));
          setDraftSegmentCurves((prev) => prev.slice(0, -1));
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
      if (e.key === "Alt") setAltDown(false);
      if (e.key === "Shift") setShiftDown(false);
      if (e.key === "Control" || e.key === "Meta") setCtrlDown(false);
    };
    const onBlur = () => {
      setSpaceDown(false);
      setAltDown(false);
      setShiftDown(false);
      setCtrlDown(false);
    };
    window.addEventListener("dc-fit-screen", onFit);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("dc-fit-screen", onFit);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [fitToScreen]);

  // Paint live viewport + interactive overlays (Unified Viewport-Native Hi-DPI Overscan Cache
  // for BOTH Battlemaps AND World Maps — locked <= 60 FPS pan/zoom with zero 4096px full-map stalls!)
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = wrap.clientWidth;
    const ch = wrap.clientHeight;
    if (cw <= 0 || ch <= 0) return;
    const targetPw = Math.round(cw * dpr);
    const targetPh = Math.round(ch * dpr);
    if (canvas.width !== targetPw || canvas.height !== targetPh) {
      canvas.width = targetPw;
      canvas.height = targetPh;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cam = camRef.current;
    const wCells = doc.canvas.widthCells;
    const hCells = doc.canvas.heightCells;
    const mapW = wCells * cam.cellPx;
    const mapH = hCells * cam.cellPx;
    const isWheelZooming = wheelZoomingRef.current;
    const isPanning = dragRef.current.mode === "pan";
    const isActivelyDraggingEdit = dragRef.current.mode !== "none" && !isPanning;
    const wantInteractive = isWheelZooming || isPanning || isActivelyDraggingEdit;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = isWheelZooming || isPanning ? "medium" : "high";
    ctx.clearRect(0, 0, cw, ch);

    // Subtle tabletop elevation shadow around map edge — ONLY when at least one map border is visible!
    // (Avoids rasterizing a massive 32,000px x 18,000px Gaussian drop shadow when zoomed into the map!)
    const mapEdgeVisible =
      cam.x > -48 || cam.y > -48 || cam.x + mapW < cw + 48 || cam.y + mapH < ch + 48;
    if (mapEdgeVisible) {
      const shX0 = Math.max(-80, cam.x);
      const shY0 = Math.max(-80, cam.y);
      const shX1 = Math.min(cw + 80, cam.x + mapW);
      const shY1 = Math.min(ch + 80, cam.y + mapH);
      if (shX1 > shX0 && shY1 > shY0) {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.72)";
        ctx.shadowBlur = 36;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#10131A";
        ctx.fillRect(shX0, shY0, shX1 - shX0, shY1 - shY0);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = "#10131A";
      ctx.fillRect(0, 0, cw, ch);
    }

    const isWorld = doc.mode === "world" && Boolean(doc.world);
    const modeTag: "world" | "battlemap" = isWorld ? "world" : "battlemap";
    // Battlemap object/wall/path/roof/light selection rings are drawn in screen-space below,
    // so clicking to select them NEVER invalidates the scene cache!
    const sceneSelectedId = isWorld
      ? (selection?.id ?? "")
      : selection &&
          (selection.kind === "portal" ||
            selection.kind === "water" ||
            selection.kind === "dm_note" ||
            selection.kind === "scatter" ||
            selection.kind === "cave_entrance")
        ? selection.id
        : "";
    const contentKey = [
      doc.id,
      modeTag,
      dmViewMode ? 1 : 0,
      showVttOverlay ? 1 : 0,
      showScatterOutlines ? 1 : 0,
      showOnionSkin ? 1 : 0,
      isolateActiveFloor ? 1 : 0,
      sceneSelectedId,
      textureVersion,
    ].join("|");

    const visMinX = Math.max(0, -cam.x / cam.cellPx);
    const visMinY = Math.max(0, -cam.y / cam.cellPx);
    const visMaxX = Math.min(wCells, (cw - cam.x) / cam.cellPx);
    const visMaxY = Math.min(hCells, (ch - cam.y) / cam.cellPx);

    let cache = viewportCacheRef.current;
    const sameContent =
      cache !== null &&
      cache.doc === doc &&
      cache.mode === modeTag &&
      cache.contentKey === contentKey;
    const coversVisible =
      sameContent &&
      cache !== null &&
      cache.cellX0 <= visMinX + 0.002 &&
      cache.cellY0 <= visMinY + 0.002 &&
      cache.cellX1 >= visMaxX - 0.002 &&
      cache.cellY1 >= visMaxY - 0.002;
    const sameZoom =
      sameContent &&
      cache !== null &&
      Math.abs(cache.cellPx - cam.cellPx) < 0.005 &&
      Math.abs(cache.dpr - dpr) < 0.01;

    // Case 1: 100% cache hit (hover, cursor, gizmos, OR panning inside overscan margin -> 0.2ms blit!)
    const canReuseExact =
      sameContent &&
      coversVisible &&
      sameZoom &&
      cache !== null &&
      (!cache.interactive || wantInteractive);

    // Case 2: Active scroll-wheel zoom inertia -> instant smooth transform blit of cached viewport!
    const canFastWheelBlit = sameContent && isWheelZooming && cache !== null;

    if (!canReuseExact && !canFastWheelBlit && visMaxX > visMinX && visMaxY > visMinY) {
      // Case 3: Render overscan-padded viewport buffer at native 1:1 Hi-DPI (capped <= 2048px!)
      const padX = isActivelyDraggingEdit ? 0 : Math.round(cw * 0.22);
      const padY = isActivelyDraggingEdit ? 0 : Math.round(ch * 0.22);
      const rx0 = Math.max(0, Math.floor(-cam.x - padX));
      const ry0 = Math.max(0, Math.floor(-cam.y - padY));
      const rx1 = Math.min(Math.ceil(mapW), Math.ceil(cw - cam.x + padX));
      const ry1 = Math.min(Math.ceil(mapH), Math.ceil(ch - cam.y + padY));
      const rw = Math.max(1, rx1 - rx0);
      const rh = Math.max(1, ry1 - ry0);
      const maxBufSide = 2048;
      const bufScale = Math.min(dpr, maxBufSide / Math.max(rw, rh));
      const bw = Math.max(1, Math.round(rw * bufScale));
      const bh = Math.max(1, Math.round(rh * bufScale));

      if (!cache) {
        const buf = document.createElement("canvas");
        buf.width = bw;
        buf.height = bh;
        cache = {
          canvas: buf,
          doc: null,
          mode: modeTag,
          contentKey: "",
          cellX0: 0,
          cellY0: 0,
          cellX1: wCells,
          cellY1: hCells,
          cellPx: cam.cellPx,
          dpr,
          interactive: wantInteractive,
        };
        viewportCacheRef.current = cache;
      } else if (cache.canvas.width !== bw || cache.canvas.height !== bh) {
        cache.canvas.width = bw;
        cache.canvas.height = bh;
      }

      const cellX0 = rx0 / cam.cellPx;
      const cellY0 = ry0 / cam.cellPx;
      const cellX1 = Math.min(wCells, rx1 / cam.cellPx);
      const cellY1 = Math.min(hCells, ry1 / cam.cellPx);
      const vctx = cache.canvas.getContext("2d");
      if (vctx) {
        if (isWorld) {
          vctx.setTransform(bufScale, 0, 0, bufScale, 0, 0);
          vctx.clearRect(0, 0, rw, rh);
          vctx.save();
          vctx.translate(-rx0, -ry0);
          renderWorldMapScene(vctx, doc, assetLookup, {
            pixelsPerCell: cam.cellPx,
            dmView: dmViewMode,
            showVttOverlay,
            showScatterOutlines,
            showOnionSkin,
            isolateActiveFloor,
            selectedId: sceneSelectedId || null,
            interactive: wantInteractive,
            viewportCells: {
              minX: cellX0,
              minY: cellY0,
              maxX: cellX1,
              maxY: cellY1,
              dpr: bufScale,
              allowDetailPlate: !wantInteractive,
            },
          });
          vctx.restore();
        } else {
          const effPpc = cam.cellPx * bufScale;
          const cropX = rx0 * bufScale;
          const cropY = ry0 * bufScale;
          vctx.setTransform(1, 0, 0, 1, 0, 0);
          vctx.clearRect(0, 0, bw, bh);
          vctx.imageSmoothingEnabled = true;
          vctx.imageSmoothingQuality = wantInteractive ? "medium" : "high";
          renderMapScene(vctx, doc, assetLookup, {
            pixelsPerCell: effPpc,
            dmView: dmViewMode,
            showVttOverlay,
            showScatterOutlines,
            showOnionSkin,
            isolateActiveFloor,
            selectedId: sceneSelectedId || null,
            interactive: wantInteractive,
            cropRectPx: { x: cropX, y: cropY, w: bw, h: bh },
            viewportCells: {
              minX: cellX0,
              minY: cellY0,
              maxX: cellX1,
              maxY: cellY1,
              dpr: 1,
              allowDetailPlate: !wantInteractive,
            },
          });

          // Snapshot lightweight overview backdrop for free (0.3ms) whenever full map is rendered!
          if (
            !wantInteractive &&
            cellX0 <= 0.01 &&
            cellY0 <= 0.01 &&
            cellX1 >= wCells - 0.01 &&
            cellY1 >= hCells - 0.01
          ) {
            const ovScale = Math.min(1, 1280 / Math.max(bw, bh));
            const ovW = Math.max(64, Math.round(bw * ovScale));
            const ovH = Math.max(64, Math.round(bh * ovScale));
            let ov = battlemapOverviewRef.current;
            if (!ov) {
              const oc = document.createElement("canvas");
              oc.width = ovW;
              oc.height = ovH;
              ov = { canvas: oc, docId: doc.id, contentKey };
              battlemapOverviewRef.current = ov;
            } else if (ov.canvas.width !== ovW || ov.canvas.height !== ovH) {
              ov.canvas.width = ovW;
              ov.canvas.height = ovH;
            }
            const octx = ov.canvas.getContext("2d");
            if (octx) {
              octx.clearRect(0, 0, ovW, ovH);
              octx.drawImage(cache.canvas, 0, 0, bw, bh, 0, 0, ovW, ovH);
              ov.docId = doc.id;
              ov.contentKey = contentKey;
            }
          }
        }

        cache.doc = doc;
        cache.mode = modeTag;
        cache.contentKey = contentKey;
        cache.cellX0 = cellX0;
        cache.cellY0 = cellY0;
        cache.cellX1 = cellX1;
        cache.cellY1 = cellY1;
        cache.cellPx = cam.cellPx;
        cache.dpr = dpr;
        cache.interactive = wantInteractive;
      }
    }

    // Blit cached viewport (and overview backdrop if wheel-zooming out beyond cached overscan!)
    if (cache && cache.doc === doc && cache.mode === modeTag) {
      const needsOverviewBackdrop =
        cache.cellX0 > visMinX + 0.01 ||
        cache.cellY0 > visMinY + 0.01 ||
        cache.cellX1 < visMaxX - 0.01 ||
        cache.cellY1 < visMaxY - 0.01;
      if (needsOverviewBackdrop) {
        if (isWorld) {
          const ovCanvas = getCachedWorldOverviewCanvas();
          if (ovCanvas) {
            drawCanvasCroppedToScreen(ctx, ovCanvas, cam.x, cam.y, mapW, mapH, cw, ch);
          }
        } else {
          const ov = battlemapOverviewRef.current;
          if (ov && ov.docId === doc.id) {
            drawCanvasCroppedToScreen(ctx, ov.canvas, cam.x, cam.y, mapW, mapH, cw, ch);
          }
        }
      }
      const destX = cam.x + cache.cellX0 * cam.cellPx;
      const destY = cam.y + cache.cellY0 * cam.cellPx;
      const destW = (cache.cellX1 - cache.cellX0) * cam.cellPx;
      const destH = (cache.cellY1 - cache.cellY0) * cam.cellPx;
      drawCanvasCroppedToScreen(ctx, cache.canvas, destX, destY, destW, destH, cw, ch);
    }

    // Live 60 FPS fluid terrain brush or crimson erase-brush preview while dragging
    if (dragRef.current.mode === "terrain" && dragRef.current.terrainPoints.length > 0) {
      const st = useDocumentStore.getState();
      if (st.terrainMode === "erase") {
        ctx.save();
        ctx.beginPath();
        ctx.rect(cam.x, cam.y, mapW, mapH);
        ctx.clip();
        ctx.strokeStyle = "rgba(248, 113, 113, 0.42)";
        ctx.lineWidth = Math.max(4, st.brushRadiusCells * cam.cellPx * 2);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        dragRef.current.terrainPoints.forEach((pt, idx) => {
          const sx = cam.x + pt.x * cam.cellPx;
          const sy = cam.y + pt.y * cam.cellPx;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        if (dragRef.current.terrainPoints.length === 1) {
          const p0 = dragRef.current.terrainPoints[0];
          ctx.lineTo(cam.x + p0.x * cam.cellPx + 0.5, cam.y + p0.y * cam.cellPx);
        }
        ctx.stroke();
        ctx.restore();
      } else {
        const terrainAsset = st.activeTerrainAssetId || "terrain/berlin_wet_cobble.png";
        const roundedCellPx = Math.round(cam.cellPx * 4) / 4;
        if (liveTileCacheRef.current.cellPx !== roundedCellPx) {
          liveTileCacheRef.current = { cellPx: roundedCellPx, cache: new Map() };
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(cam.x, cam.y, mapW, mapH);
        ctx.clip();
        ctx.translate(cam.x, cam.y);
        drawUnifiedTerrainGroup(
          ctx,
          [
            {
              id: "live-preview",
              assetId: terrainAsset,
              points: dragRef.current.terrainPoints,
              radiusCells: st.brushRadiusCells,
              opacity: st.brushOpacity,
              softness: st.brushSoftness,
              continuous: true,
              rotationDeg: st.terrainRotationDeg || undefined,
              slopeShade: st.terrainSlopeShade > 0.02 ? st.terrainSlopeShade : undefined,
              textureScale:
                Math.abs(st.terrainTextureScale - 1) > 0.01 ? st.terrainTextureScale : undefined,
              recolor: st.toolRecolors.terrain.enabled
                ? { ...st.toolRecolors.terrain }
                : undefined,
            },
          ],
          cam.cellPx,
          0.84,
          assetLookup,
          liveTileCacheRef.current.cache,
          mapW,
          mapH,
          {
            x0: Math.max(0, -cam.x),
            y0: Math.max(0, -cam.y),
            x1: Math.min(mapW, cw - cam.x),
            y1: Math.min(mapH, ch - cam.y),
          },
          true,
        );
        ctx.restore();
      }
    }

    // Crisp outer studio border (skip when zoomed inside the map interior!)
    if (mapEdgeVisible) {
      ctx.strokeStyle = "rgba(229, 169, 60, 0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(cam.x - 0.5, cam.y - 0.5, mapW + 1, mapH + 1);
    }

    const toScreen = (pt: Point2D) => ({
      x: cam.x + pt.x * cam.cellPx,
      y: cam.y + pt.y * cam.cellPx,
    });

    // Draw crisp screen-space interactive Rotation & 4-Corner Scale Handles for selected Object!
    if (selection && selection.kind === "object") {
      const selLayer = doc.layers.find((l) => l.id === selection.layerId);
      const selObj = selLayer?.objects?.find((o) => o.id === selection.id);
      if (selObj) {
        const center = toScreen({ x: selObj.x, y: selObj.y });
        const hw = (selObj.widthCells * cam.cellPx) / 2;
        const hh = (selObj.heightCells * cam.cellPx) / 2;
        const pad = 5;
        const stalkLen = 24;

        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(selObj.rotationRad);

        // Crisp gold dashed selection frame
        ctx.strokeStyle = "#E5A93C";
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(-hw - pad, -hh - pad, (hw + pad) * 2, (hh + pad) * 2);
        ctx.setLineDash([]);

        // Top Rotation Stalk + Interactive Gold Knob
        ctx.strokeStyle = "#E5A93C";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -hh - pad);
        ctx.lineTo(0, -hh - pad - stalkLen);
        ctx.stroke();

        const isRotDrag = dragRef.current.mode === "obj_rotate";
        ctx.fillStyle = isRotDrag ? "#FDE68A" : "#E5A93C";
        ctx.strokeStyle = "#12141A";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -hh - pad - stalkLen, isRotDrag ? 8.5 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#12141A";
        ctx.beginPath();
        ctx.arc(0, -hh - pad - stalkLen, 2.3, 0, Math.PI * 2);
        ctx.fill();

        // 4 Draggable Corner Scale Handles
        const hs = 5;
        for (const [cx, cy] of [
          [-hw - pad, -hh - pad],
          [hw + pad, -hh - pad],
          [hw + pad, hh + pad],
          [-hw - pad, hh + pad],
        ]) {
          ctx.fillStyle = dragRef.current.mode === "obj_scale" ? "#E5A93C" : "#12141A";
          ctx.strokeStyle = "#E5A93C";
          ctx.lineWidth = 2;
          ctx.fillRect(cx - hs, cy - hs, hs * 2, hs * 2);
          ctx.strokeRect(cx - hs, cy - hs, hs * 2, hs * 2);
        }
        ctx.restore();

        // Live Angle / Dimension HUD pill while rotating or scaling!
        if (dragRef.current.mode === "obj_rotate" || dragRef.current.mode === "obj_scale") {
          const deg = Math.round((((selObj.rotationRad * 180) / Math.PI) % 360 + 360) % 360);
          const isStretching = Boolean(dragRef.current.isStretching);
          const tag =
            dragRef.current.mode === "obj_rotate"
              ? `${deg}° · Hold Shift for 15° snap`
              : isStretching
                ? `${selObj.widthCells.toFixed(1)} × ${selObj.heightCells.toFixed(1)} sq · FREE STRETCH (Shift)`
                : `${selObj.widthCells.toFixed(1)} × ${selObj.heightCells.toFixed(1)} sq · Ratio Locked (Hold Shift to stretch)`;
          ctx.save();
          ctx.font = "600 11px JetBrains Mono, monospace";
          const tw = ctx.measureText(tag).width + 16;
          const bx = center.x - tw / 2;
          const by = center.y - Math.max(hw, hh) - 46;
          ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
          ctx.strokeStyle = "#E5A93C";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, 22, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#FDE68A";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(tag, center.x, by + 11);
          ctx.restore();
        }
      }
    }

    // Draw interactive vertex, midpoint, and eave-width handles for selected Placed Wall, Line/Path, Water Region, Roof, or World River/Trail/Region!
    if (
      selection &&
      (selection.kind === "wall" ||
        selection.kind === "path" ||
        selection.kind === "water" ||
        selection.kind === "roof" ||
        selection.kind === "world_river" ||
        selection.kind === "world_trail" ||
        selection.kind === "world_region")
    ) {
      const selLayer = doc.layers.find((l) => l.id === selection.layerId);
      const selRoof = selection.kind === "roof" ? selLayer?.roofs?.find((r) => r.id === selection.id) : null;
      const curveEnt = resolveCurveEditableEntity(doc, selection);
      const pts = curveEnt ? curveEnt.points : selRoof ? selRoof.points : null;
      const closed = curveEnt ? curveEnt.closed : false;

      if (pts && pts.length >= 2) {
        const tracePts = curveEnt ? sampleWallPoints(curveEnt, 10) : pts;
        ctx.save();

        // For selected Roof: draw crisp orange outer eave footprint outline first
        if (selRoof) {
          const rGeom = computeRoofGeometry(selRoof);
          if (rGeom.footprint.length >= 3) {
            ctx.strokeStyle = "rgba(251, 146, 60, 0.88)";
            ctx.lineWidth = 1.8;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            rGeom.footprint.forEach((fp, idx) => {
              const s = toScreen(fp);
              if (idx === 0) ctx.moveTo(s.x, s.y);
              else ctx.lineTo(s.x, s.y);
            });
            ctx.closePath();
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }

        // Crisp gold selection outline along the wall, line, roof ridge, water, or world shape
        ctx.strokeStyle = "#E5A93C";
        ctx.lineWidth = 2.6;
        ctx.setLineDash([7, 4]);
        ctx.beginPath();
        tracePts.forEach((p, idx) => {
          const s = toScreen(p);
          if (idx === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        if (closed && tracePts.length > 2) ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);

        // Unified Per-Section Curve/Midpoint handles across Walls, Lines, Roofs (non-cone), Water & World shapes!
        if (curveEnt) {
          const segCount = getWallSegmentCount(curveEnt.points, curveEnt.closed);
          const effectiveCurves = convertLegacyWallCurveToSegments(curveEnt);
          const activeFocusIdx =
            selectedWallSegmentIndex !== null &&
            selectedWallSegmentIndex >= 0 &&
            selectedWallSegmentIndex < segCount
              ? selectedWallSegmentIndex
              : null;

          if (activeFocusIdx !== null) {
            const fa = curveEnt.points[activeFocusIdx];
            const fb = curveEnt.points[(activeFocusIdx + 1) % curveEnt.points.length];
            const focusPts = sampleWallSegmentArc(fa, fb, effectiveCurves[activeFocusIdx], 12);
            ctx.save();
            ctx.strokeStyle = "rgba(34, 211, 238, 0.36)";
            ctx.lineWidth = 7.5;
            ctx.lineCap = "round";
            ctx.beginPath();
            focusPts.forEach((p, idx) => {
              const s = toScreen(p);
              if (idx === 0) ctx.moveTo(s.x, s.y);
              else ctx.lineTo(s.x, s.y);
            });
            ctx.stroke();
            ctx.strokeStyle = "#22D3EE";
            ctx.lineWidth = 2.6;
            ctx.stroke();
            ctx.restore();
          }

          for (let i = 0; i < segCount; i++) {
            const a = curveEnt.points[i];
            const b = curveEnt.points[(i + 1) % curveEnt.points.length];
            const info = getWallSegmentArcInfo(a, b, effectiveCurves[i]);
            const isFocused = i === activeFocusIdx;
            const handleScr = toScreen(info.apex);

            if (info.curved) {
              // Subtle dashed chord + bow stem guide so arch depth reads clearly
              const sa = toScreen(a);
              const sb = toScreen(b);
              const smid = toScreen(info.chordMid);
              ctx.save();
              ctx.strokeStyle = isFocused
                ? "rgba(34, 211, 238, 0.55)"
                : "rgba(192, 132, 252, 0.38)";
              ctx.lineWidth = 1.2;
              ctx.setLineDash([4, 4]);
              ctx.beginPath();
              ctx.moveTo(sa.x, sa.y);
              ctx.lineTo(sb.x, sb.y);
              ctx.moveTo(smid.x, smid.y);
              ctx.lineTo(handleScr.x, handleScr.y);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();

              // Glowing Apex Curve Handle (plain drag to reshape bow, Shift = 90°/180°, Double-click to flatten!)
              const hr = isFocused ? 7.2 : 6.0;
              ctx.fillStyle = isFocused ? "rgba(15, 23, 42, 0.96)" : "rgba(18, 22, 32, 0.92)";
              ctx.strokeStyle = isFocused ? "#22D3EE" : "#C084FC";
              ctx.lineWidth = isFocused ? 2.2 : 1.8;
              ctx.beginPath();
              ctx.arc(handleScr.x, handleScr.y, hr, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();

              // Crisp arch glyph inside the apex knob
              ctx.strokeStyle = isFocused ? "#A5F3FC" : "#E9D5FF";
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(handleScr.x, handleScr.y + 1.4, 3.0, Math.PI, 0, false);
              ctx.stroke();
            } else {
              // Straight edge midpoint '+' handle (Click focuses, Drag inserts corner, Shift+Drag or Double-Click curves!)
              const hr = isFocused ? 6.4 : 5.2;
              ctx.fillStyle = isFocused ? "rgba(8, 47, 73, 0.95)" : "rgba(18, 22, 32, 0.9)";
              ctx.strokeStyle = isFocused ? "#67E8F9" : "#22D3EE";
              ctx.lineWidth = isFocused ? 2.1 : 1.6;
              ctx.beginPath();
              ctx.arc(handleScr.x, handleScr.y, hr, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.strokeStyle = isFocused ? "#ECFEFF" : "#22D3EE";
              ctx.lineWidth = 1.45;
              ctx.beginPath();
              ctx.moveTo(handleScr.x - 2.6, handleScr.y);
              ctx.lineTo(handleScr.x + 2.6, handleScr.y);
              ctx.moveTo(handleScr.x, handleScr.y - 2.6);
              ctx.lineTo(handleScr.x, handleScr.y + 2.6);
              ctx.stroke();
            }
          }

          // Live Arc HUD Pill while dragging a single section's curve handle!
          if (
            dragRef.current.mode === "wall_curve" &&
            dragRef.current.wallSegIndex !== undefined &&
            dragRef.current.wallSegIndex < segCount
          ) {
            const di = dragRef.current.wallSegIndex;
            const da = curveEnt.points[di];
            const db = curveEnt.points[(di + 1) % curveEnt.points.length];
            const dInfo = getWallSegmentArcInfo(da, db, effectiveCurves[di]);
            const dScr = toScreen(dInfo.apex);
            const tag = dInfo.curved
              ? `${curveEnt.noun} ${di + 1} · ${dInfo.sweepDeg}° Arc · R ${dInfo.radius.toFixed(1)} sq${shiftDown ? " (Snap)" : " · Shift = 90°/180°"}`
              : `${curveEnt.noun} ${di + 1} · Straight (Flat)`;
            ctx.save();
            ctx.font = "600 11px JetBrains Mono, monospace";
            const tw = ctx.measureText(tag).width + 16;
            const py = Math.max(18, dScr.y - 26);
            ctx.fillStyle = "rgba(15, 18, 26, 0.94)";
            ctx.strokeStyle = dInfo.curved ? "#C084FC" : "#22D3EE";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(dScr.x - tw / 2, py - 10, tw, 20, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = dInfo.curved ? "#F3E8FF" : "#A5F3FC";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(tag, dScr.x, py);
            ctx.restore();
          }
        }

        // Draggable gold vertex handles at every control point
        for (const p of pts) {
          const s = toScreen(p);
          ctx.fillStyle = "#12141A";
          ctx.strokeStyle = "#E5A93C";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 6.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#FDE68A";
          ctx.beginPath();
          ctx.arc(s.x, s.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Draggable Terracotta/Amber Eave-Span Width Handles for selected Roofs
        if (selRoof && selRoof.style !== "cone") {
          const wHandles = getRoofWidthHandles(selRoof);
          const isWidthDrag = dragRef.current.mode === "roof_width";
          for (const wh of wHandles) {
            const hs = toScreen(wh.pos);
            const anc = toScreen(wh.anchor);
            ctx.strokeStyle = "rgba(251, 146, 60, 0.72)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(anc.x, anc.y);
            ctx.lineTo(hs.x, hs.y);
            ctx.stroke();
            ctx.setLineDash([]);

            // Diamond / double-arrow pill aligned perpendicular to ridge
            const ang = Math.atan2(wh.normal.y, wh.normal.x);
            ctx.save();
            ctx.translate(hs.x, hs.y);
            ctx.rotate(ang);
            ctx.fillStyle = isWidthDrag ? "#FB923C" : "#12141A";
            ctx.strokeStyle = "#FB923C";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-8.5, -6, 17, 12, 4);
            ctx.fill();
            ctx.stroke();
            // Outward & inward chevron arrows
            ctx.strokeStyle = isWidthDrag ? "#12141A" : "#FDBA74";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-4.5, 0);
            ctx.lineTo(4.5, 0);
            ctx.moveTo(2, -2.5);
            ctx.lineTo(4.8, 0);
            ctx.lineTo(2, 2.5);
            ctx.moveTo(-2, -2.5);
            ctx.lineTo(-4.8, 0);
            ctx.lineTo(-2, 2.5);
            ctx.stroke();
            ctx.restore();
          }

          if (isWidthDrag) {
            const anc = wHandles[0] ? toScreen(wHandles[0].anchor) : toScreen(pts[0]);
            const label = `Span: ${selRoof.widthCells.toFixed(1)} sq · ${(selRoof.widthCells * 5).toFixed(0)} ft`;
            ctx.font = "600 11px JetBrains Mono, monospace";
            const tw = ctx.measureText(label).width + 14;
            ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
            ctx.strokeStyle = "#FB923C";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(anc.x - tw / 2, anc.y - 34, tw, 20, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#FED7AA";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, anc.x, anc.y - 24);
          }
        }
        ctx.restore();
      }
    }

    // Crisp screen-space Light Node Badges & Direct-Manipulation Gizmos (Move / Resize Radius / Aim Beam)
    const activeLayerKindNow = doc.layers.find((l) => l.id === doc.activeLayerId)?.kind;
    const shouldShowLightNodes =
      activeTool === "light" || selection?.kind === "light" || activeLayerKindNow === "lights";
    if (shouldShowLightNodes) {
      const visibleLights: Array<{ layerId: string; light: LightNode }> = [];
      for (const lyr of doc.layers) {
        if (!lyr.visible || lyr.locked) continue;
        if (lyr.dmOnly && !dmViewMode) continue;
        if (lyr.lights?.length) {
          for (const lt of lyr.lights) {
            visibleLights.push({ layerId: lyr.id, light: lt });
          }
        }
      }

      // 1. Selected light radius ring, spotlight wedge & interactive Radius / Aim handles (drawn beneath badges)
      if (selection?.kind === "light") {
        const selEntry = visibleLights.find(
          (entry) => entry.layerId === selection.layerId && entry.light.id === selection.id,
        );
        if (selEntry) {
          const lt = selEntry.light;
          const c = toScreen({ x: lt.x, y: lt.y });
          const rPx = Math.max(24, lt.radiusCells * cam.cellPx);
          const isSpot = lt.coneAngleDeg < 360;
          const halfRad = (lt.coneAngleDeg * Math.PI) / 360;

          ctx.save();
          // Gold dashed outer radius circle
          ctx.strokeStyle = "rgba(229, 169, 60, 0.78)";
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          ctx.arc(c.x, c.y, rPx, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Subtle tinted spotlight wedge + glowing cyan outer-ring arc track!
          if (isSpot) {
            ctx.fillStyle = `${lt.colorHex}20`;
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.arc(c.x, c.y, rPx, lt.directionRad - halfRad, lt.directionRad + halfRad);
            ctx.closePath();
            ctx.fill();

            // Dashed cone boundary rays from bulb center to outer-ring sliders
            ctx.strokeStyle = "rgba(34, 211, 238, 0.58)";
            ctx.lineWidth = 1.4;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(
              c.x + Math.cos(lt.directionRad - halfRad) * rPx,
              c.y + Math.sin(lt.directionRad - halfRad) * rPx,
            );
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(
              c.x + Math.cos(lt.directionRad + halfRad) * rPx,
              c.y + Math.sin(lt.directionRad + halfRad) * rPx,
            );
            ctx.stroke();
            ctx.setLineDash([]);

            // Bright cyan arc slider track right along the outer radius ring!
            const isConeActive =
              dragRef.current.mode === "light_cone" ||
              hoveredLightHandle === "cone_left" ||
              hoveredLightHandle === "cone_right";
            ctx.strokeStyle = isConeActive ? "#67E8F9" : "#22D3EE";
            ctx.lineWidth = isConeActive ? 3.5 : 2.6;
            ctx.beginPath();
            ctx.arc(c.x, c.y, rPx, lt.directionRad - halfRad, lt.directionRad + halfRad);
            ctx.stroke();
          }

          // Interactive Outer-Ring Cone Angle Slider Handle(s)
          const drawConeSliderThumb = (
            angle: number,
            isActive: boolean,
            showReadout: boolean,
            tooltipText?: string,
          ) => {
            const tx = c.x + Math.cos(angle) * rPx;
            const ty = c.y + Math.sin(angle) * rPx;
            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(angle);
            // Sleek curved-tangent pill/diamond slider thumb sitting right on the outer ring
            ctx.fillStyle = isActive ? "#A5F3FC" : "#22D3EE";
            ctx.strokeStyle = "#0F121A";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-5, isActive ? -9.5 : -8, 10, isActive ? 19 : 16, 4);
            ctx.fill();
            ctx.stroke();
            // Tiny grip lines inside slider thumb
            ctx.strokeStyle = "#0F121A";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(-2, -3);
            ctx.lineTo(2, -3);
            ctx.moveTo(-2, 0);
            ctx.lineTo(2, 0);
            ctx.moveTo(-2, 3);
            ctx.lineTo(2, 3);
            ctx.stroke();
            ctx.restore();

            if (showReadout || tooltipText) {
              const label = showReadout
                ? lt.coneAngleDeg >= 360
                  ? "Cone: 360° (Omni)"
                  : `Cone: ${lt.coneAngleDeg}°`
                : tooltipText!;
              ctx.font = "600 11px JetBrains Mono, monospace";
              const tw = ctx.measureText(label).width + 14;
              ctx.fillStyle = "rgba(15, 18, 26, 0.94)";
              ctx.strokeStyle = "#22D3EE";
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.roundRect(tx - tw / 2, ty - 28, tw, 20, 5);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = "#A5F3FC";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(label, tx, ty - 18);
            }
          };

          const isConeDrag = dragRef.current.mode === "light_cone";
          if (isSpot) {
            drawConeSliderThumb(
              lt.directionRad - halfRad,
              isConeDrag || hoveredLightHandle === "cone_left",
              isConeDrag,
              hoveredLightHandle === "cone_left" ? `Cone: ${lt.coneAngleDeg}° · Drag along ring` : undefined,
            );
            drawConeSliderThumb(
              lt.directionRad + halfRad,
              isConeDrag || hoveredLightHandle === "cone_right",
              false,
              hoveredLightHandle === "cone_right" ? `Cone: ${lt.coneAngleDeg}° · Drag along ring` : undefined,
            );
          } else {
            // For 360° omni lights, place a cyan arc-slider thumb opposite the radius knob so users can narrow any light into a cone!
            drawConeSliderThumb(
              lt.directionRad + Math.PI,
              isConeDrag || hoveredLightHandle === "cone_omni",
              isConeDrag,
              hoveredLightHandle === "cone_omni" ? "Cone: 360° · Drag ring to narrow beam" : undefined,
            );
          }

          // Interactive Gold Radius Resize Handle on the outer ring along directionRad (symmetrically centered in beam!)
          const radAngle = lt.directionRad;
          const rx = c.x + Math.cos(radAngle) * rPx;
          const ry = c.y + Math.sin(radAngle) * rPx;
          const isRadDrag = dragRef.current.mode === "light_radius";
          const isRadActive = isRadDrag || hoveredLightHandle === "radius";
          ctx.fillStyle = isRadActive ? "#FDE68A" : "#E5A93C";
          ctx.strokeStyle = "#0F121A";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(rx, ry, isRadActive ? 8.5 : 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#0F121A";
          ctx.beginPath();
          ctx.arc(rx, ry, 2.3, 0, Math.PI * 2);
          ctx.fill();

          if (isRadActive) {
            const label = isRadDrag
              ? `Radius: ${lt.radiusCells.toFixed(1)} sq`
              : `Radius: ${lt.radiusCells.toFixed(1)} sq · Drag`;
            ctx.font = "600 11px JetBrains Mono, monospace";
            const tw = ctx.measureText(label).width + 14;
            ctx.fillStyle = "rgba(15, 18, 26, 0.94)";
            ctx.strokeStyle = "#E5A93C";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(rx - tw / 2, ry - 28, tw, 20, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#FDE68A";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(label, rx, ry - 18);
          }

          // Interactive Grabbable Cyan Aim Arrow (when coneAngleDeg < 360) — grab shaft OR circular arrow grip to rotate!
          if (isSpot) {
            const aimLen = Math.min(Math.max(40, rPx * 0.54), Math.max(40, rPx - 24));
            const ax = c.x + Math.cos(lt.directionRad) * aimLen;
            const ay = c.y + Math.sin(lt.directionRad) * aimLen;
            const isAimDrag = dragRef.current.mode === "light_aim";
            const isAimActive = isAimDrag || hoveredLightHandle === "aim";

            // Bold cyan shaft with subtle dark outline for high contrast over any terrain
            ctx.strokeStyle = "rgba(15, 18, 26, 0.78)";
            ctx.lineWidth = isAimActive ? 5.5 : 4.2;
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(ax, ay);
            ctx.stroke();

            ctx.strokeStyle = isAimActive ? "#A5F3FC" : "#22D3EE";
            ctx.lineWidth = isAimActive ? 3.2 : 2.4;
            ctx.beginPath();
            ctx.moveTo(c.x, c.y);
            ctx.lineTo(ax, ay);
            ctx.stroke();

            // Circular interactive grab knob framing the cyan arrowhead so it clearly reads as draggable!
            ctx.fillStyle = isAimActive ? "rgba(34, 211, 238, 0.34)" : "rgba(15, 18, 26, 0.88)";
            ctx.strokeStyle = isAimActive ? "#A5F3FC" : "#22D3EE";
            ctx.lineWidth = isAimActive ? 2.2 : 1.8;
            ctx.beginPath();
            ctx.arc(ax, ay, isAimActive ? 12.5 : 10.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.save();
            ctx.translate(ax, ay);
            ctx.rotate(lt.directionRad);
            ctx.fillStyle = isAimActive ? "#ECFEFF" : "#22D3EE";
            ctx.beginPath();
            ctx.moveTo(6.5, 0);
            ctx.lineTo(-4.5, -5);
            ctx.lineTo(-2, 0);
            ctx.lineTo(-4.5, 5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();

            if (isAimActive) {
              const deg = Math.round(((lt.directionRad * 180) / Math.PI + 360) % 360);
              const label = isAimDrag ? `Aim: ${deg}°` : `Aim: ${deg}° · Drag to rotate`;
              ctx.font = "600 11px JetBrains Mono, monospace";
              const tw = ctx.measureText(label).width + 14;
              ctx.fillStyle = "rgba(15, 18, 26, 0.94)";
              ctx.strokeStyle = "#22D3EE";
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.roundRect(ax - tw / 2, ay - 30, tw, 20, 5);
              ctx.fill();
              ctx.stroke();
              ctx.fillStyle = "#A5F3FC";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(label, ax, ay - 20);
            }
          }
          ctx.restore();
        }
      }

      // 2. Crisp clickable bulb badges for EVERY visible light on the active floor
      for (const { layerId, light: lt } of visibleLights) {
        const c = toScreen({ x: lt.x, y: lt.y });
        const isSel = selection?.kind === "light" && selection.layerId === layerId && selection.id === lt.id;
        const isHov = hoveredLightId === lt.id;
        const badgeR = isSel ? 13 : isHov ? 12 : 10.5;

        ctx.save();
        // Hover faint radius ring preview for unselected lights
        if (isHov && !isSel) {
          ctx.strokeStyle = "rgba(229, 169, 60, 0.52)";
          ctx.lineWidth = 1.3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(c.x, c.y, Math.max(16, lt.radiusCells * cam.cellPx), 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Subtle spotlight direction wedge on unselected spotlights
        if (!isSel && lt.coneAngleDeg < 360) {
          const halfRad = (lt.coneAngleDeg * Math.PI) / 360;
          ctx.fillStyle = `${lt.colorHex}38`;
          ctx.beginPath();
          ctx.moveTo(c.x, c.y);
          ctx.arc(c.x, c.y, 28, lt.directionRad - halfRad, lt.directionRad + halfRad);
          ctx.closePath();
          ctx.fill();
        }

        // Outer high-contrast dark backing halo so the badge pops over both bright marble and dark stone
        ctx.fillStyle = "rgba(12, 15, 22, 0.9)";
        ctx.strokeStyle = isSel ? "#E5A93C" : isHov ? "#FDE68A" : "rgba(255, 255, 255, 0.78)";
        ctx.lineWidth = isSel ? 2.5 : isHov ? 2.2 : 1.5;
        ctx.beginPath();
        ctx.arc(c.x, c.y, badgeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 8 crisp micro-sunburst rays around the glowing core
        ctx.strokeStyle = lt.colorHex;
        ctx.lineWidth = 1.3;
        for (let ray = 0; ray < 8; ray++) {
          const a = (ray * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(c.x + Math.cos(a) * (badgeR * 0.48), c.y + Math.sin(a) * (badgeR * 0.48));
          ctx.lineTo(c.x + Math.cos(a) * (badgeR * 0.8), c.y + Math.sin(a) * (badgeR * 0.8));
          ctx.stroke();
        }

        // Colored light core + bright white center glint
        ctx.fillStyle = lt.colorHex;
        ctx.beginPath();
        ctx.arc(c.x, c.y, badgeR * 0.46, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.beginPath();
        ctx.arc(c.x - 1.2, c.y - 1.2, badgeR * 0.16, 0, Math.PI * 2);
        ctx.fill();

        // Floating tooltip pill on hover (or when selected in Light tool)
        if (isHov || (isSel && dragRef.current.mode === "none")) {
          const tip = `${lt.name || "Map Light"} · ${lt.radiusCells.toFixed(1)} sq`;
          ctx.font = "600 10.5px Inter, system-ui, sans-serif";
          const tw = ctx.measureText(tip).width + 14;
          const ty = c.y - badgeR - 14;
          ctx.fillStyle = "rgba(13, 16, 24, 0.92)";
          ctx.strokeStyle = isSel ? "rgba(229, 169, 60, 0.8)" : "rgba(148, 163, 184, 0.55)";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.roundRect(c.x - tw / 2, ty - 9, tw, 18, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = isSel ? "#FDE68A" : "#E2E8F0";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(tip, c.x, ty);
        }
        ctx.restore();
      }
    }

    // Draw in-progress Wall / Path / Roof / Water / Scatter / Terrain Polygon draft (live smooth curve when Curved mode is ON!)
    if (draftPoints.length > 0) {
      ctx.save();
      const isTerrainPolyErase =
        activeTool === "terrain" && terrainMode === "erase" && terrainEraseShape === "polygon";
      const isTerrainPoly =
        (activeTool === "terrain" && terrainMode === "polygon") || isTerrainPolyErase;
      const isCavePoly = activeTool === "cave" && caveDrawMode === "polygon";
      const isRoofDraft = activeTool === "roof" && roofDrawMode === "ridge_path";
      const strokeCol = isTerrainPolyErase
        ? "#F87171"
        : activeTool === "scatter"
          ? "#8B5CF6"
          : activeTool === "water"
            ? "#38BDF8"
            : isRoofDraft
              ? "#FB923C"
              : isTerrainPoly || isCavePoly
                ? "#34D399"
                : "#E5A93C";
      const isWallArcDraft = activeTool === "wall" && wallDrawMode === "arc";
      const isWallCorridorDraft = activeTool === "wall" && wallDrawMode === "corridor";
      const isWallFreeDraft = activeTool === "wall" && wallDrawMode === "free";
      const isPathFreeDraft = activeTool === "path";
      const isTerrainPolyCurvable = activeTool === "terrain" && terrainMode === "polygon";
      const isMixedCurveDraft = isWallFreeDraft || isPathFreeDraft || isTerrainPolyCurvable;
      const nextSegCurved = isWallFreeDraft
        ? wallCurved
        : isPathFreeDraft
          ? pathCurved
          : isTerrainPolyCurvable
            ? terrainPolygonCurved
            : false;
      const hoverDraftPt = hoverGrid
        ? activeTool === "wall"
          ? (isWallArcDraft && draftPoints.length === 2) || (isWallFreeDraft && Boolean(pendingFreeArcEnd))
            ? snapPoint(hoverGrid, altDown ? "free" : snapMode)
            : resolveWallPoint(
                hoverGrid,
                altDown,
                draftPoints[draftPoints.length - 1],
                shiftDown && (isWallFreeDraft || isWallCorridorDraft),
              ).point
          : (isPathFreeDraft || isTerrainPoly) && !pendingFreeArcEnd && shiftDown && draftPoints.length >= 1
            ? constrainAngle45Deg(
                draftPoints[draftPoints.length - 1],
                snapPoint(hoverGrid, altDown ? "free" : snapMode),
              )
            : snapPoint(hoverGrid, altDown ? "free" : snapMode)
        : null;
      const allDraft = hoverDraftPt && !pendingFreeArcEnd ? [...draftPoints, hoverDraftPt] : draftPoints;
      const isWaterRiver = activeTool === "water" && waterDrawMode === "river_path";
      const isWaterPoly = activeTool === "water" && waterDrawMode === "polygon";
      const isWorldRiver = activeTool === "world_river";
      const isWorldTrail = activeTool === "world_trail";
      const isWorldRegion = activeTool === "world_region";
      const draftIsCurved =
        (isRoofDraft && roofCurved) ||
        ((isWaterRiver || isWaterPoly) && waterCurved) ||
        (isWorldRiver && worldRiverCurved) ||
        (isWorldTrail && worldTrailCurved) ||
        isWorldRegion;
      const previewPts = isMixedCurveDraft
        ? sampleWallPoints(
            {
              points: allDraft,
              closed: false,
              curved: false,
              segmentCurves: draftSegmentCurves,
            },
            10,
          )
        : draftIsCurved && allDraft.length >= 3
          ? sampleCatmullRom(allDraft, 10, false)
          : allDraft;

      // Live WYSIWYG World River / Trail / Political Region preview!
      if (isWorldRiver && doc.world && allDraft.length >= 2) {
        const stNow = useDocumentStore.getState();
        const { polygon } = buildMeanderingRiverGeometry({
          id: "__preview__",
          points: allDraft,
          startWidthCells: stNow.worldRiverStartWidth,
          endWidthCells: stNow.worldRiverEndWidth,
          meanderRoughness: stNow.worldRiverMeander,
          meanderScale: stNow.worldRiverMeanderScale,
          curved: stNow.worldRiverCurved,
          seed: 777,
        });
        if (polygon.length >= 4) {
          ctx.beginPath();
          polygon.forEach((p, idx) => {
            const s = toScreen(p);
            if (idx === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.closePath();
          ctx.fillStyle = `${doc.world.theme.freshwaterColorHex}BB`;
          ctx.fill();
        }
      } else if (isWorldTrail && allDraft.length >= 2) {
        const stNow = useDocumentStore.getState();
        ctx.save();
        ctx.translate(cam.x, cam.y);
        drawWorldTrail(
          ctx,
          {
            id: "__preview__",
            points: allDraft,
            style: stNow.worldTrailStyle,
            widthCells: stNow.worldTrailWidth,
            colorHex: stNow.worldTrailColorHex,
            dashScale: stNow.worldTrailDashScale,
            curved: stNow.worldTrailCurved,
            opacity: 0.85,
          },
          cam.cellPx,
        );
        ctx.restore();
      } else if (isWorldRegion && allDraft.length >= 3) {
        const stNow = useDocumentStore.getState();
        const rPts = sampleCatmullRom(allDraft, 8, true);
        ctx.beginPath();
        rPts.forEach((p, idx) => {
          const s = toScreen(p);
          if (idx === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.closePath();
        ctx.fillStyle = `${stNow.worldRegionFillHex}38`;
        ctx.fill();
      }

      // Full WYSIWYG 2.5D roof preview while drawing a Ridge Path roof!
      if (isRoofDraft && allDraft.length >= 2) {
        const previewRoof = buildDraftRoof(allDraft, roofWidthCells);
        ctx.save();
        ctx.translate(cam.x, cam.y);
        drawRoofStructure(ctx, previewRoof, cam.cellPx, 0.84, assetLookup);
        ctx.restore();

        // Live dimension HUD pill near the last point
        let ridgeLen = 0;
        for (let i = 0; i < allDraft.length - 1; i++) {
          ridgeLen += Math.hypot(allDraft[i + 1].x - allDraft[i].x, allDraft[i + 1].y - allDraft[i].y);
        }
        const endScr = toScreen(allDraft[allDraft.length - 1]);
        const styleName =
          previewRoof.style.charAt(0).toUpperCase() + previewRoof.style.slice(1);
        const pill = `${styleName} Roof · ${ridgeLen.toFixed(1)} × ${roofWidthCells.toFixed(1)} sq`;
        ctx.font = "600 11px JetBrains Mono, monospace";
        const tw = ctx.measureText(pill).width + 14;
        const py = Math.max(18, endScr.y - 26);
        ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
        ctx.strokeStyle = "rgba(251, 146, 60, 0.85)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.roundRect(endScr.x - tw / 2, py - 10, tw, 20, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FED7AA";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(pill, endScr.x, py);
      }

      // Live soft river-bank preview ribbon when tracing a River Path!
      if (isWaterRiver && allDraft.length >= 2) {
        const riverPoly = buildRiverPolygon(allDraft, waterRiverWidthCells, waterCurved);
        if (riverPoly.length >= 3) {
          ctx.beginPath();
          riverPoly.forEach((p, idx) => {
            const s = toScreen(p);
            if (idx === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.closePath();
          ctx.fillStyle = "rgba(56, 189, 248, 0.24)";
          ctx.fill();
          ctx.strokeStyle = "rgba(186, 230, 253, 0.75)";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
      }

      // Live WYSIWYG 3-Point Arc Wall, Corridor Wall, and Free Wall length/angle previews!
      const drawWallHudPill = (text: string, sx: number, sy: number, borderHex = "rgba(245, 158, 11, 0.85)", fgHex = "#FDE68A") => {
        ctx.save();
        ctx.font = "600 11px JetBrains Mono, monospace";
        const tw = ctx.measureText(text).width + 14;
        const py = Math.max(18, sy - 24);
        ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
        ctx.strokeStyle = borderHex;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.roundRect(sx - tw / 2, py - 10, tw, 20, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = fgHex;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, sx, py);
        ctx.restore();
      };

      if (isWallArcDraft && draftPoints.length === 2 && hoverDraftPt) {
        const arcRes = buildThreePointArcWallPoints(draftPoints[0], draftPoints[1], hoverDraftPt, {
          snapArcPreset: shiftDown,
        });
        const s0 = toScreen(draftPoints[0]);
        const s1 = toScreen(draftPoints[1]);
        const midS = { x: (s0.x + s1.x) * 0.5, y: (s0.y + s1.y) * 0.5 };
        const hScr = toScreen(hoverDraftPt);
        // Subtle dashed chord & sagitta guide
        ctx.save();
        ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
        ctx.lineWidth = 1.3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y);
        ctx.lineTo(s1.x, s1.y);
        ctx.moveTo(midS.x, midS.y);
        ctx.lineTo(hScr.x, hScr.y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (arcRes) {
          const sampledArc =
            arcRes.curved && arcRes.points.length >= 3
              ? sampleCatmullRom(arcRes.points, 8, false)
              : arcRes.points;
          ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
          ctx.lineWidth = Math.max(4, wallThicknessCells * cam.cellPx * 2.0);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          sampledArc.forEach((p, idx) => {
            const s = toScreen(p);
            if (idx === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.stroke();
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 2.4;
          ctx.stroke();
          const pillTxt = Number.isFinite(arcRes.radius)
            ? `Arc · R ${arcRes.radius.toFixed(1)} sq · ${arcRes.sweepDeg}°${shiftDown ? " (Snap)" : ""}`
            : "Arc · Straight Chord";
          drawWallHudPill(pillTxt, hScr.x, hScr.y);
        }
        ctx.restore();
        draftPoints.forEach((p) => {
          const s = toScreen(p);
          ctx.fillStyle = "#12141A";
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      } else {
        if (isWallCorridorDraft && allDraft.length >= 2) {
          const corr = buildCorridorWalls(allDraft, wallCorridorWidthCells, {
            curved: wallCurved,
            capEnds: wallCorridorCapEnds,
          });
          if (corr) {
            ctx.save();
            if (corr.floorPolygon.length >= 3) {
              ctx.beginPath();
              corr.floorPolygon.forEach((p, idx) => {
                const s = toScreen(p);
                if (idx === 0) ctx.moveTo(s.x, s.y);
                else ctx.lineTo(s.x, s.y);
              });
              ctx.closePath();
              ctx.fillStyle = wallAutoFillClosed
                ? "rgba(229, 169, 60, 0.2)"
                : "rgba(34, 211, 238, 0.12)";
              ctx.fill();
            }
            ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
            ctx.lineWidth = Math.max(3, wallThicknessCells * cam.cellPx * 2.0);
            ctx.lineCap = "butt";
            ctx.lineJoin = "miter";
            for (const w of corr.walls) {
              ctx.beginPath();
              w.points.forEach((p, idx) => {
                const s = toScreen(p);
                if (idx === 0) ctx.moveTo(s.x, s.y);
                else ctx.lineTo(s.x, s.y);
              });
              if (w.closed) ctx.closePath();
              ctx.stroke();
            }
            ctx.strokeStyle = "#F59E0B";
            ctx.lineWidth = 2;
            for (const w of corr.walls) {
              ctx.beginPath();
              w.points.forEach((p, idx) => {
                const s = toScreen(p);
                if (idx === 0) ctx.moveTo(s.x, s.y);
                else ctx.lineTo(s.x, s.y);
              });
              if (w.closed) ctx.closePath();
              ctx.stroke();
            }
            const tipScr = toScreen(allDraft[allDraft.length - 1]);
            drawWallHudPill(
              `Corridor · W ${wallCorridorWidthCells.toFixed(1)} sq (${(wallCorridorWidthCells * 5).toFixed(0)} ft)${wallCorridorCapEnds ? " · Sealed" : ""}`,
              tipScr.x,
              tipScr.y,
            );
            ctx.restore();
          }
        } else if (isMixedCurveDraft && pendingFreeArcEnd && draftPoints.length >= 1 && hoverDraftPt) {
          // Live per-segment circular arc bow preview inside Free Wall (1) and Line / Path (P) when Next Section is Curved!
          const a = draftPoints[draftPoints.length - 1];
          const b = pendingFreeArcEnd;
          const chord = Math.hypot(b.x - a.x, b.y - a.y);
          const nx = chord > 1e-4 ? -(b.y - a.y) / chord : 0;
          const ny = chord > 1e-4 ? (b.x - a.x) / chord : -1;
          const midX = (a.x + b.x) * 0.5;
          const midY = (a.y + b.y) * 0.5;
          const rawSag = (hoverDraftPt.x - midX) * nx + (hoverDraftPt.y - midY) * ny;
          const snappedSag = snapWallSegmentSagitta(chord, rawSag, shiftDown);
          const arcInfo = getWallSegmentArcInfo(a, b, snappedSag);
          const arcPts = sampleWallSegmentArc(a, b, snappedSag, 12);
          const sA = toScreen(a);
          const sB = toScreen(b);
          const sMid = toScreen(arcInfo.chordMid);
          const sApex = toScreen(arcInfo.apex);
          const ribbonW = isPathFreeDraft
            ? Math.max(4, useDocumentStore.getState().pathWidthCells * cam.cellPx)
            : Math.max(4, wallThicknessCells * cam.cellPx * 2.0);
          ctx.save();
          ctx.strokeStyle = "rgba(192, 132, 252, 0.5)";
          ctx.lineWidth = 1.25;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(sA.x, sA.y);
          ctx.lineTo(sB.x, sB.y);
          ctx.moveTo(sMid.x, sMid.y);
          ctx.lineTo(sApex.x, sApex.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(192, 132, 252, 0.42)";
          ctx.lineWidth = ribbonW;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.beginPath();
          arcPts.forEach((p, idx) => {
            const s = toScreen(p);
            if (idx === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.stroke();
          ctx.strokeStyle = "#C084FC";
          ctx.lineWidth = 2.4;
          ctx.stroke();
          // Pending end anchor dot
          ctx.fillStyle = "#12141A";
          ctx.strokeStyle = "#C084FC";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sB.x, sB.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          const pillTxt = arcInfo.curved
            ? `Section Arc · ${arcInfo.sweepDeg}° · R ${arcInfo.radius.toFixed(1)} sq · Click to lock${shiftDown ? " (Snap)" : ""}`
            : "Section · Straight · Click to lock";
          drawWallHudPill(pillTxt, sApex.x, sApex.y, "rgba(192, 132, 252, 0.9)", "#F3E8FF");
          ctx.restore();
        } else if ((isMixedCurveDraft || isWallArcDraft) && allDraft.length >= 2) {
          const prevPt = allDraft[allDraft.length - 2];
          const tipPt = allDraft[allDraft.length - 1];
          const segLen = Math.hypot(tipPt.x - prevPt.x, tipPt.y - prevPt.y);
          const angDeg = Math.round(((Math.atan2(tipPt.y - prevPt.y, tipPt.x - prevPt.x) * 180) / Math.PI + 360) % 360);
          const tipScr = toScreen(tipPt);
          const prefix = isWallArcDraft
            ? "Chord · "
            : isMixedCurveDraft && nextSegCurved
              ? "Curved Next (C) · "
              : shiftDown
                ? "45° Lock · "
                : "";
          drawWallHudPill(
            `${prefix}${segLen.toFixed(1)} sq · ${(segLen * 5).toFixed(0)} ft · ${angDeg}°`,
            tipScr.x,
            tipScr.y,
            isMixedCurveDraft && nextSegCurved
              ? "rgba(192, 132, 252, 0.88)"
              : shiftDown
                ? "rgba(34, 211, 238, 0.85)"
                : "rgba(245, 158, 11, 0.85)",
            isMixedCurveDraft && nextSegCurved ? "#F3E8FF" : shiftDown ? "#A5F3FC" : "#FDE68A",
          );
        }

        ctx.strokeStyle = isWallCorridorDraft ? "rgba(34, 211, 238, 0.72)" : strokeCol;
        ctx.lineWidth = isWallCorridorDraft ? 1.5 : 2.4;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        previewPts.forEach((p, idx) => {
          const s = toScreen(p);
          if (idx === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        if (
          (isTerrainPoly || isCavePoly || isWaterPoly || activeTool === "scatter") &&
          previewPts.length >= 3
        ) {
          ctx.closePath();
          ctx.fillStyle = isTerrainPolyErase
            ? "rgba(248, 113, 113, 0.24)"
            : isTerrainPoly || isCavePoly
              ? "rgba(52, 211, 153, 0.22)"
              : isWaterPoly
                ? "rgba(56, 189, 248, 0.22)"
                : "rgba(139, 92, 246, 0.18)";
          ctx.fill();
        }
        ctx.stroke();
        ctx.setLineDash([]);
        draftPoints.forEach((p, idx) => {
          const s = toScreen(p);
          ctx.fillStyle = idx === 0 && draftPoints.length >= 3 && !isWallCorridorDraft ? strokeCol : "#12141A";
          ctx.strokeStyle = strokeCol;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, idx === 0 && draftPoints.length >= 3 && !isWallCorridorDraft ? 6 : 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        });
        ctx.restore();
      }
    }

    // Live Rectangle Terrain Fill, Dungeon Room, or Shift+Drag Rectangular Erase preview while dragging
    if (
      (dragRef.current.mode === "terrain_rect" ||
        dragRef.current.mode === "cave_rect" ||
        dragRef.current.mode === "cave_erase_rect") &&
      dragRef.current.rectStart &&
      dragRef.current.rectEnd
    ) {
      const isCaveRect = dragRef.current.mode === "cave_rect";
      const isTerrainEraseRect =
        dragRef.current.mode === "terrain_rect" && terrainMode === "erase";
      const isCaveEraseRect = dragRef.current.mode === "cave_erase_rect" || isTerrainEraseRect;
      const a = dragRef.current.rectStart;
      const b = dragRef.current.rectEnd;
      const s0 = toScreen({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) });
      const s1 = toScreen({ x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) });
      const rw = Math.abs(b.x - a.x);
      const rh = Math.abs(b.y - a.y);
      ctx.save();
      ctx.fillStyle = isCaveEraseRect
        ? "rgba(248, 113, 113, 0.24)"
        : isCaveRect
          ? "rgba(52, 211, 153, 0.22)"
          : "rgba(229, 169, 60, 0.24)";
      ctx.strokeStyle = isCaveEraseRect ? "#F87171" : isCaveRect ? "#34D399" : "#E5A93C";
      ctx.lineWidth = 2.2;
      ctx.setLineDash([6, 4]);
      ctx.fillRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
      ctx.strokeRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
      ctx.setLineDash([]);
      const prefix = isCaveEraseRect ? "Erase · " : isCaveRect ? "Room · " : "";
      const label = `${prefix}${rw.toFixed(1)} × ${rh.toFixed(1)} sq · ${(rw * 5).toFixed(0)} × ${(rh * 5).toFixed(0)} ft`;
      ctx.font = "600 11px JetBrains Mono, monospace";
      const tw = ctx.measureText(label).width + 14;
      const midX = (s0.x + s1.x) / 2;
      const topY = Math.max(16, s0.y - 22);
      ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
      ctx.strokeStyle = isCaveEraseRect
        ? "rgba(248, 113, 113, 0.8)"
        : isCaveRect
          ? "rgba(52, 211, 153, 0.8)"
          : "rgba(229, 169, 60, 0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(midX - tw / 2, topY - 10, tw, 20, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isCaveEraseRect ? "#FCA5A5" : isCaveRect ? "#A7F3D0" : "#FDE68A";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, midX, topY);
      ctx.restore();
    }

    // Live Architectural Box Room & Circle/Polygon Tower Wall Drag Previews!
    if (
      (dragRef.current.mode === "wall_box" || dragRef.current.mode === "wall_circle") &&
      dragRef.current.rectStart &&
      dragRef.current.rectEnd
    ) {
      const a = dragRef.current.rectStart;
      const b = dragRef.current.rectEnd;
      const wallPx = Math.max(4, wallThicknessCells * cam.cellPx * 2.0);
      ctx.save();
      if (dragRef.current.mode === "wall_box") {
        const box = buildBoxWallPoints(a, b, {
          square: dragRef.current.boxSquare ?? shiftDown,
          fromCenter: dragRef.current.boxFromCenter ?? ctrlDown,
          rotationDeg: wallBoxRotationDeg,
        });
        if (box) {
          ctx.beginPath();
          box.points.forEach((p, idx) => {
            const s = toScreen(p);
            if (idx === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.closePath();
          ctx.fillStyle = wallAutoFillClosed
            ? "rgba(229, 169, 60, 0.2)"
            : "rgba(245, 158, 11, 0.08)";
          ctx.fill();
          ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
          ctx.lineWidth = wallPx;
          ctx.lineJoin = "miter";
          ctx.stroke();
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 2.2;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          const cScr = toScreen(box.center);
          const minYScr = Math.min(...box.points.map((p) => toScreen(p).y));
          const rotSuffix = box.rotationDeg !== 0 ? ` · ${box.rotationDeg}°` : "";
          const label = `Box Room · ${box.width.toFixed(1)} × ${box.height.toFixed(1)} sq · ${(box.width * 5).toFixed(0)} × ${(box.height * 5).toFixed(0)} ft${rotSuffix}`;
          ctx.font = "600 11px JetBrains Mono, monospace";
          const tw = ctx.measureText(label).width + 14;
          const topY = Math.max(18, minYScr - 22);
          ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
          ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.roundRect(cScr.x - tw / 2, topY - 10, tw, 20, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#FDE68A";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, cScr.x, topY);
        }
      } else {
        const snapStep = shiftDown ? (snapMode === "grid" ? 1 : 0.5) : 0;
        const circ = buildCircleOrPolygonWallPoints(a, b, wallPolygonShape, {
          rotationDeg: wallBoxRotationDeg,
          snapRadiusStep: snapStep,
        });
        const ca = toScreen(a);
        const cb = toScreen(b);
        if (circ) {
          const drawPts = circ.curved ? sampleCatmullRom(circ.points, 8, true) : circ.points;
          ctx.beginPath();
          drawPts.forEach((p, idx) => {
            const s = toScreen(p);
            if (idx === 0) ctx.moveTo(s.x, s.y);
            else ctx.lineTo(s.x, s.y);
          });
          ctx.closePath();
          ctx.fillStyle = wallAutoFillClosed
            ? "rgba(229, 169, 60, 0.2)"
            : "rgba(245, 158, 11, 0.08)";
          ctx.fill();
          ctx.strokeStyle = "rgba(245, 158, 11, 0.45)";
          ctx.lineWidth = wallPx;
          ctx.lineJoin = "miter";
          ctx.stroke();
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 2.2;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          // Dashed radius indicator from center
          ctx.strokeStyle = "rgba(148, 163, 184, 0.65)";
          ctx.lineWidth = 1.3;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(ca.x, ca.y);
          ctx.lineTo(cb.x, cb.y);
          ctx.stroke();
          ctx.setLineDash([]);

          const shapeName =
            wallPolygonShape === "round"
              ? "Round Tower"
              : wallPolygonShape === "oval"
                ? "Oval Room"
                : wallPolygonShape === "hex"
                  ? "Hex Tower (6)"
                  : wallPolygonShape === "octagon"
                    ? "Octagon Tower (8)"
                    : "12-gon Tower";
          const label =
            wallPolygonShape === "oval"
              ? `${shapeName} · ${(circ.radiusX * 2).toFixed(1)} × ${(circ.radiusY * 2).toFixed(1)} sq`
              : `${shapeName} · R ${circ.radiusX.toFixed(1)} sq (Ø ${(circ.radiusX * 10).toFixed(0)} ft)`;
          const minYScr = Math.min(...drawPts.map((p) => toScreen(p).y));
          ctx.font = "600 11px JetBrains Mono, monospace";
          const tw = ctx.measureText(label).width + 14;
          const topY = Math.max(18, minYScr - 22);
          ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
          ctx.strokeStyle = "rgba(245, 158, 11, 0.85)";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.roundRect(ca.x - tw / 2, topY - 10, tw, 20, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#FDE68A";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, ca.x, topY);
        }
      }
      ctx.restore();
    }

    // Live WYSIWYG Box Roof & Turret Cone drag preview!
    if (
      (dragRef.current.mode === "roof_box" || dragRef.current.mode === "roof_cone") &&
      dragRef.current.rectStart &&
      dragRef.current.rectEnd
    ) {
      const a = dragRef.current.rectStart;
      const b = dragRef.current.rectEnd;
      if (dragRef.current.mode === "roof_box") {
        const boxParams = buildBoxRoofParams(a, b, roofOverhangCells, roofRotateBoxRidge);
        const s0 = toScreen({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) });
        const s1 = toScreen({ x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) });
        ctx.save();
        if (boxParams) {
          const previewRoof = buildDraftRoof(boxParams.points, boxParams.widthCells);
          ctx.save();
          ctx.translate(cam.x, cam.y);
          drawRoofStructure(ctx, previewRoof, cam.cellPx, 0.86, assetLookup);
          ctx.restore();
        }
        // Subtle dashed wall-footprint reference inside the roof overhang
        ctx.strokeStyle = "rgba(251, 146, 60, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(s0.x, s0.y, s1.x - s0.x, s1.y - s0.y);
        ctx.setLineDash([]);
        const rw = Math.abs(b.x - a.x);
        const rh = Math.abs(b.y - a.y);
        const stLabel = roofStyle === "cone" ? "Hip" : roofStyle.charAt(0).toUpperCase() + roofStyle.slice(1);
        const label = `${stLabel} Box · ${rw.toFixed(1)} × ${rh.toFixed(1)} sq (+${roofOverhangCells.toFixed(1)} eave) · Q/E flips ridge`;
        ctx.font = "600 11px JetBrains Mono, monospace";
        const tw = ctx.measureText(label).width + 14;
        const midX = (s0.x + s1.x) / 2;
        const topY = Math.max(18, s0.y - 24);
        ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
        ctx.strokeStyle = "rgba(251, 146, 60, 0.85)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.roundRect(midX - tw / 2, topY - 10, tw, 20, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FED7AA";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, midX, topY);
        ctx.restore();
      } else {
        const radius = Math.hypot(b.x - a.x, b.y - a.y);
        ctx.save();
        if (radius >= 0.45) {
          const previewRoof = buildDraftRoof([a, b], Math.max(1.2, radius * 2), "cone");
          ctx.save();
          ctx.translate(cam.x, cam.y);
          drawRoofStructure(ctx, previewRoof, cam.cellPx, 0.86, assetLookup);
          ctx.restore();
        }
        const ca = toScreen(a);
        const cb = toScreen(b);
        ctx.strokeStyle = "rgba(251, 146, 60, 0.85)";
        ctx.lineWidth = 1.6;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(ca.x, ca.y);
        ctx.lineTo(cb.x, cb.y);
        ctx.stroke();
        ctx.setLineDash([]);
        const label = `Turret / Dome · R ${radius.toFixed(1)} sq (${(radius * 10).toFixed(0)} ft dia)`;
        ctx.font = "600 11px JetBrains Mono, monospace";
        const tw = ctx.measureText(label).width + 14;
        const topY = Math.max(18, ca.y - radius * cam.cellPx - 18);
        ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
        ctx.strokeStyle = "rgba(251, 146, 60, 0.85)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.roundRect(ca.x - tw / 2, topY - 10, tw, 20, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FED7AA";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, ca.x, topY);
        ctx.restore();
      }
    }

    // Direct On-Canvas Gizmos for Selected Cave / Dungeon Entrance (Slide · Opening Width · Fade Length!)
    if (selection?.kind === "cave_entrance") {
      const selLayer = doc.layers.find((l) => l.id === selection.layerId);
      const ent = selLayer?.caveSystem?.entrances?.find((x) => x.id === selection.id);
      if (ent) {
        const apron = buildEntranceFadeApron(ent);
        const center = toScreen({ x: ent.x, y: ent.y });
        const nx = Math.cos(ent.normalRad);
        const ny = Math.sin(ent.normalRad);
        const tx = -ny;
        const ty = nx;
        const hwPx = (ent.widthCells * cam.cellPx) * 0.5;
        const fadePx = Math.max(24, ent.fadeLengthCells * cam.cellPx);

        const wl = { x: center.x - tx * hwPx, y: center.y - ty * hwPx };
        const wr = { x: center.x + tx * hwPx, y: center.y + ty * hwPx };
        const fadeTip = { x: center.x + nx * fadePx, y: center.y + ny * fadePx };

        ctx.save();
        // Translucent dashed fade apron frame
        ctx.beginPath();
        apron.polygon.forEach((pt, idx) => {
          const s = toScreen(pt);
          if (idx === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.closePath();
        ctx.strokeStyle = "rgba(34, 211, 238, 0.65)";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Opening width bar connecting Left & Right gold handles
        ctx.strokeStyle = "#E5A93C";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(wl.x, wl.y);
        ctx.lineTo(wr.x, wr.y);
        ctx.stroke();

        // Outward Fade-Length shaft + draggable Cyan Arrow Knob
        const isFadeActive =
          dragRef.current.mode === "cave_entrance_fade" || hoveredEntranceHandle === "fade";
        ctx.strokeStyle = isFadeActive ? "#A5F3FC" : "#22D3EE";
        ctx.lineWidth = isFadeActive ? 3 : 2.2;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(fadeTip.x, fadeTip.y);
        ctx.stroke();

        ctx.fillStyle = isFadeActive ? "rgba(34, 211, 238, 0.35)" : "rgba(15, 18, 26, 0.9)";
        ctx.strokeStyle = isFadeActive ? "#A5F3FC" : "#22D3EE";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fadeTip.x, fadeTip.y, isFadeActive ? 11 : 9.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(fadeTip.x, fadeTip.y);
        ctx.rotate(ent.normalRad);
        ctx.fillStyle = isFadeActive ? "#ECFEFF" : "#22D3EE";
        ctx.beginPath();
        ctx.moveTo(5.5, 0);
        ctx.lineTo(-4, -4.5);
        ctx.lineTo(-1.5, 0);
        ctx.lineTo(-4, 4.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Left & Right Gold Opening-Width Knobs
        const isWidthDrag = dragRef.current.mode === "cave_entrance_width";
        for (const [pt, hid] of [
          [wl, "width_l"],
          [wr, "width_r"],
        ] as const) {
          const isAct = isWidthDrag || hoveredEntranceHandle === hid;
          ctx.fillStyle = isAct ? "#FDE68A" : "#E5A93C";
          ctx.strokeStyle = "#0F121A";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, isAct ? 8 : 6.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        // Center Slide Handle
        const isSlideAct =
          dragRef.current.mode === "cave_entrance_move" || hoveredEntranceHandle === "slide";
        ctx.fillStyle = isSlideAct ? "#FDE68A" : "rgba(15, 18, 26, 0.92)";
        ctx.strokeStyle = isSlideAct ? "#0F121A" : "#E5A93C";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center.x, center.y, isSlideAct ? 8.5 : 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Live readout pill while dragging Width or Fade
        if (isFadeActive || isWidthDrag || hoveredEntranceHandle === "width_l" || hoveredEntranceHandle === "width_r") {
          const isF = isFadeActive && !isWidthDrag;
          const anchor = isF ? fadeTip : wr;
          const label = isF
            ? `Fade: ${ent.fadeLengthCells.toFixed(1)} sq`
            : `Width: ${ent.widthCells.toFixed(1)} sq`;
          ctx.font = "600 11px JetBrains Mono, monospace";
          const tw = ctx.measureText(label).width + 14;
          ctx.fillStyle = "rgba(15, 18, 26, 0.94)";
          ctx.strokeStyle = isF ? "#22D3EE" : "#E5A93C";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(anchor.x - tw / 2, anchor.y - 28, tw, 20, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = isF ? "#A5F3FC" : "#FDE68A";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, anchor.x, anchor.y - 18);
        }
        ctx.restore();
      }
    }

    // Live Cave Brush / Carve-Back Eraser stroke preview while dragging
    if (dragRef.current.mode === "cave_brush" && dragRef.current.terrainPoints.length > 0) {
      const st = useDocumentStore.getState();
      const isErase = st.caveDrawMode === "erase" || Boolean(dragRef.current.caveEraseHold);
      ctx.save();
      ctx.strokeStyle = isErase ? "rgba(248, 113, 113, 0.45)" : "rgba(52, 211, 153, 0.36)";
      ctx.lineWidth = st.caveBrushRadiusCells * cam.cellPx * 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      dragRef.current.terrainPoints.forEach((pt, idx) => {
        const s = toScreen(pt);
        if (idx === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      if (dragRef.current.terrainPoints.length === 1) {
        const s = toScreen(dragRef.current.terrainPoints[0]);
        ctx.lineTo(s.x + 0.1, s.y + 0.1);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Live Water Brush / Island-Carver sculpts the actual water surface live beneath the hover ring (no opaque blob needed)

    // Live Tool Ghost Cursors
    if (hoverGrid) {
      const snapped = snapPoint(hoverGrid, snapMode);
      const hs = toScreen(snapped);
      const st = useDocumentStore.getState();

      if (activeTool === "stamp" && selectedAssetId) {
        const asset = assetLookup.get(selectedAssetId);
        const url = resolveAssetUrl(selectedAssetId, assetLookup);
        const rawImg = texturePool.get(url);
        const img = rawImg ? getProcessedTexture(rawImg, url, st.activeRecolor, asset) : null;
        if (asset && img) {
          const wCells = (asset.widthPx / asset.defaultPpi) * st.stampScale;
          const hCells = (asset.heightPx / asset.defaultPpi) * st.stampScale;
          ctx.save();
          ctx.translate(hs.x, hs.y);
          ctx.rotate(st.stampRotationRad);
          ctx.scale(st.stampFlipX ? -1 : 1, 1);
          ctx.globalAlpha = 0.78;
          ctx.drawImage(
            img,
            (-wCells * cam.cellPx) / 2,
            (-hCells * cam.cellPx) / 2,
            wCells * cam.cellPx,
            hCells * cam.cellPx,
          );
          ctx.strokeStyle = "#E5A93C";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(
            (-wCells * cam.cellPx) / 2,
            (-hCells * cam.cellPx) / 2,
            wCells * cam.cellPx,
            hCells * cam.cellPx,
          );
          ctx.restore();
          // Crisp live scale & angle pill right above stamp preview
          const deg = Math.round((((st.stampRotationRad * 180) / Math.PI) % 360 + 360) % 360);
          const tag = `${st.stampScale.toFixed(2)}× · ${deg}°`;
          ctx.save();
          ctx.font = "600 10px JetBrains Mono, monospace";
          const tw = ctx.measureText(tag).width + 12;
          const bx = hs.x - tw / 2;
          const by = hs.y - (hCells * cam.cellPx) / 2 - 24;
          ctx.fillStyle = "rgba(18, 20, 26, 0.9)";
          ctx.strokeStyle = "rgba(229, 169, 60, 0.65)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(bx, by, tw, 18, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = "#E5A93C";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(tag, hs.x, by + 9);
          ctx.restore();
        }
      } else if (activeTool === "template" && activeTemplateId) {
        const tpl = objectTemplates.find((t) => t.id === activeTemplateId);
        if (tpl && tpl.items.length > 0) {
          const previewItems = expandTemplateAtPoint(
            tpl,
            snapped.x,
            snapped.y,
            templateRotationRad,
            templateScale,
            "preview",
          ).sort((a, b) => a.zOrder - b.zOrder);
          let minSx = Infinity;
          let maxSx = -Infinity;
          let minSy = Infinity;
          let maxSy = -Infinity;
          for (const item of previewItems) {
            const sp = toScreen({ x: item.x, y: item.y });
            const wPx = item.widthCells * cam.cellPx;
            const hPx = item.heightCells * cam.cellPx;
            const halfDiag = Math.hypot(wPx, hPx) * 0.5;
            minSx = Math.min(minSx, sp.x - halfDiag);
            maxSx = Math.max(maxSx, sp.x + halfDiag);
            minSy = Math.min(minSy, sp.y - halfDiag);
            maxSy = Math.max(maxSy, sp.y + halfDiag);
            const asset = assetLookup.get(item.assetId);
            const url = resolveAssetUrl(item.assetId, assetLookup);
            const rawImg = texturePool.get(url);
            if (!rawImg && url) {
              void texturePool.ensureLoaded([url]);
            }
            const img = rawImg ? getProcessedTexture(rawImg, url, item.recolor, asset) : null;
            ctx.save();
            ctx.translate(sp.x, sp.y);
            ctx.rotate(item.rotationRad);
            ctx.scale(item.flipX ? -1 : 1, item.flipY ? -1 : 1);
            ctx.globalAlpha = 0.82 * (item.opacity ?? 1);
            if (img) {
              ctx.drawImage(img, -wPx / 2, -hPx / 2, wPx, hPx);
            } else {
              ctx.fillStyle = "rgba(229, 169, 60, 0.25)";
              ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
            }
            ctx.strokeStyle = "rgba(229, 169, 60, 0.32)";
            ctx.lineWidth = 1;
            ctx.strokeRect(-wPx / 2, -hPx / 2, wPx, hPx);
            ctx.restore();
          }
          if (Number.isFinite(minSx)) {
            ctx.save();
            ctx.strokeStyle = "rgba(229, 169, 60, 0.88)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(minSx - 4, minSy - 4, maxSx - minSx + 8, maxSy - minSy + 8);
            ctx.setLineDash([]);
            // Center anchor crosshair so placement center is crystal clear
            ctx.strokeStyle = "rgba(229, 169, 60, 0.95)";
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(hs.x - 6, hs.y);
            ctx.lineTo(hs.x + 6, hs.y);
            ctx.moveTo(hs.x, hs.y - 6);
            ctx.lineTo(hs.x, hs.y + 6);
            ctx.stroke();

            const deg = Math.round((((templateRotationRad * 180) / Math.PI) % 360 + 360) % 360);
            const tag = `${tpl.name} · ${tpl.items.length}× · ${Math.round(templateScale * 100)}% · ${deg}°`;
            ctx.font = "600 10px JetBrains Mono, monospace";
            const tw = ctx.measureText(tag).width + 12;
            const bx = (minSx + maxSx) / 2 - tw / 2;
            const by = minSy - 26;
            ctx.fillStyle = "rgba(18, 20, 26, 0.92)";
            ctx.strokeStyle = "rgba(229, 169, 60, 0.72)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(bx, by, tw, 18, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#FDE68A";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(tag, (minSx + maxSx) / 2, by + 9);
            ctx.restore();
          }
        }
      } else if (activeTool === "terrain") {
        const isEraseTool = terrainMode === "erase";
        if (terrainMode === "brush" || (isEraseTool && terrainEraseShape === "brush")) {
          ctx.save();
          ctx.strokeStyle = isEraseTool ? "rgba(248, 113, 113, 0.92)" : "rgba(229, 169, 60, 0.85)";
          ctx.fillStyle = isEraseTool ? "rgba(248, 113, 113, 0.14)" : "transparent";
          ctx.lineWidth = 1.6;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(hs.x, hs.y, st.brushRadiusCells * cam.cellPx, 0, Math.PI * 2);
          if (isEraseTool) ctx.fill();
          ctx.stroke();
          ctx.restore();
        } else if ((terrainMode === "flood" || (isEraseTool && terrainEraseShape === "room")) && floodPreview) {
          ctx.save();
          ctx.beginPath();
          floodPreview.outer.forEach((p, i) => {
            const sp = toScreen(p);
            if (i === 0) ctx.moveTo(sp.x, sp.y);
            else ctx.lineTo(sp.x, sp.y);
          });
          ctx.closePath();
          for (const hole of floodPreview.holes) {
            hole.forEach((p, i) => {
              const sp = toScreen(p);
              if (i === 0) ctx.moveTo(sp.x, sp.y);
              else ctx.lineTo(sp.x, sp.y);
            });
            ctx.closePath();
          }
          ctx.fillStyle = isEraseTool
            ? "rgba(248, 113, 113, 0.24)"
            : floodPreview.boundedByWalls
              ? "rgba(34, 211, 238, 0.24)"
              : "rgba(229, 169, 60, 0.16)";
          ctx.fill("evenodd");
          ctx.strokeStyle = isEraseTool
            ? "#F87171"
            : floodPreview.boundedByWalls
              ? "#22D3EE"
              : "#E5A93C";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
          ctx.setLineDash([]);

          const badge = isEraseTool
            ? floodPreview.boundedByWalls
              ? `Click to Erase Room · ${floodPreview.areaSq.toFixed(1)} sq`
              : `Click to Erase Open Area · ${Math.round(floodPreview.areaSq)} sq`
            : floodPreview.boundedByWalls
              ? `Click to Fill Room · ${floodPreview.areaSq.toFixed(1)} sq`
              : floodPreview.holes.length > 0
                ? `Fill Open Area (around ${floodPreview.holes.length} room${floodPreview.holes.length > 1 ? "s" : ""}) · ${Math.round(floodPreview.areaSq)} sq`
                : `Click to Fill Open Area · ${Math.round(floodPreview.areaSq)} sq`;
          const curPx = toScreen(hoverGrid);
          ctx.font = "600 10px JetBrains Mono, monospace";
          const tw = ctx.measureText(badge).width + 14;
          ctx.fillStyle = "rgba(15, 18, 26, 0.94)";
          ctx.strokeStyle = isEraseTool
            ? "rgba(248, 113, 113, 0.78)"
            : floodPreview.boundedByWalls
              ? "rgba(34, 211, 238, 0.7)"
              : "rgba(229, 169, 60, 0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(curPx.x - tw / 2, curPx.y - 28, tw, 19, 5);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = isEraseTool
            ? "#FCA5A5"
            : floodPreview.boundedByWalls
              ? "#67E8F9"
              : "#FDE68A";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(badge, curPx.x, curPx.y - 18.5);
          ctx.restore();
        } else if (terrainMode === "replace") {
          ctx.save();
          if (replacePreview) {
            if (replacePreview.includesBase) {
              ctx.strokeStyle = "rgba(52, 211, 153, 0.85)";
              ctx.fillStyle = "rgba(52, 211, 153, 0.08)";
              ctx.lineWidth = 2.2;
              ctx.setLineDash([8, 5]);
              ctx.fillRect(cam.x, cam.y, mapW, mapH);
              ctx.strokeRect(cam.x + 1, cam.y + 1, mapW - 2, mapH - 2);
              ctx.setLineDash([]);
            }
            for (const ms of replacePreview.matchedStrokes) {
              if (ms.shape === "polygon" && ms.points.length >= 3) {
                const poly = sampleTerrainStrokePolygon(ms);
                ctx.beginPath();
                poly.forEach((p, idx) => {
                  const sp = toScreen(p);
                  if (idx === 0) ctx.moveTo(sp.x, sp.y);
                  else ctx.lineTo(sp.x, sp.y);
                });
                ctx.closePath();
                for (const h of ms.holes ?? []) {
                  if (h.length < 3) continue;
                  h.forEach((p, idx) => {
                    const sp = toScreen(p);
                    if (idx === 0) ctx.moveTo(sp.x, sp.y);
                    else ctx.lineTo(sp.x, sp.y);
                  });
                  ctx.closePath();
                }
                ctx.fillStyle = "rgba(52, 211, 153, 0.24)";
                ctx.fill("evenodd");
                ctx.strokeStyle = "#34D399";
                ctx.lineWidth = 2;
                ctx.setLineDash([6, 4]);
                ctx.stroke();
                ctx.setLineDash([]);
              } else if (ms.points.length > 0) {
                ctx.strokeStyle = "rgba(52, 211, 153, 0.45)";
                ctx.lineWidth = Math.max(4, ms.radiusCells * cam.cellPx * 2);
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ms.points.forEach((p, idx) => {
                  const sp = toScreen(p);
                  if (idx === 0) ctx.moveTo(sp.x, sp.y);
                  else ctx.lineTo(sp.x, sp.y);
                });
                if (ms.points.length === 1) {
                  const sp0 = toScreen(ms.points[0]);
                  ctx.lineTo(sp0.x + 0.5, sp0.y);
                }
                ctx.stroke();
              }
            }

            const srcName =
              assetLookup.get(replacePreview.hit.assetId)?.displayName ??
              replacePreview.hit.assetId.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/_/g, " ") ??
              "Terrain";
            const dstId = st.activeTerrainAssetId || "terrain/berlin_wet_cobble.png";
            const dstName =
              assetLookup.get(dstId)?.displayName ??
              dstId.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/_/g, " ") ??
              "Terrain";
            const totalHits =
              replacePreview.matchedStrokes.length + (replacePreview.includesBase ? 1 : 0);
            const scopeTag =
              replacePreview.hit.kind === "base" &&
              (terrainReplaceScope === "patch" || terrainReplaceScope === "layer")
                ? "1F Base"
                : terrainReplaceScope === "patch"
                  ? "Patch"
                  : terrainReplaceScope === "layer"
                    ? `${totalHits} on Layer`
                    : terrainReplaceScope === "floor"
                      ? `${totalHits} on Floor`
                      : `${totalHits} Map-Wide`;
            const badge = `Replace ${scopeTag} · ${srcName} → ${dstName}`;
            const curPx = toScreen(hoverGrid);
            ctx.font = "600 10px JetBrains Mono, monospace";
            const tw = ctx.measureText(badge).width + 14;
            ctx.fillStyle = "rgba(15, 18, 26, 0.94)";
            ctx.strokeStyle = "rgba(52, 211, 153, 0.8)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(curPx.x - tw / 2, curPx.y - 28, tw, 19, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#6EE7B7";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(badge, curPx.x, curPx.y - 18.5);
          } else {
            const curPx = toScreen(hoverGrid);
            const badge = "No painted terrain here · Click floor patch to replace";
            ctx.font = "600 10px JetBrains Mono, monospace";
            const tw = ctx.measureText(badge).width + 14;
            ctx.fillStyle = "rgba(15, 18, 26, 0.92)";
            ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(curPx.x - tw / 2, curPx.y - 28, tw, 19, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#CBD5E1";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(badge, curPx.x, curPx.y - 18.5);
          }
          ctx.restore();
        } else if (
          terrainMode === "rect" ||
          terrainMode === "polygon" ||
          (isEraseTool && (terrainEraseShape === "rect" || terrainEraseShape === "polygon"))
        ) {
          ctx.save();
          ctx.strokeStyle = isEraseTool
            ? "#F87171"
            : terrainMode === "rect"
              ? "#E5A93C"
              : "#34D399";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(hs.x - 7, hs.y);
          ctx.lineTo(hs.x + 7, hs.y);
          ctx.moveTo(hs.x, hs.y - 7);
          ctx.lineTo(hs.x, hs.y + 7);
          ctx.stroke();
          ctx.restore();
        }
      } else if (activeTool === "water") {
        if (waterDrawMode === "lake_brush" || waterDrawMode === "erase") {
          const isSculpting = dragRef.current.mode === "water_brush";
          const isErase = isSculpting
            ? waterDrawMode === "erase" || Boolean(dragRef.current.caveEraseHold)
            : waterDrawMode === "erase" || (waterDrawMode === "lake_brush" && altDown);
          const ringR = waterBrushRadiusCells * cam.cellPx;
          ctx.save();
          ctx.strokeStyle = isErase ? "#FBBF24" : "#38BDF8";
          ctx.fillStyle = isErase
            ? isSculpting ? "rgba(251, 191, 36, 0.06)" : "rgba(251, 191, 36, 0.14)"
            : isSculpting ? "rgba(56, 189, 248, 0.06)" : "rgba(56, 189, 248, 0.14)";
          ctx.lineWidth = isSculpting ? 2.0 : 1.8;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(hs.x, hs.y, ringR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (isErase) {
            ctx.setLineDash([]);
            ctx.font = "700 10px JetBrains Mono, monospace";
            const badge = waterDrawMode === "lake_brush" ? "ISLAND / ERASE (ALT)" : "ISLAND / ERASE";
            const bw = ctx.measureText(badge).width + 10;
            const by = hs.y + ringR + 12;
            ctx.fillStyle = "rgba(18, 16, 12, 0.92)";
            ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.roundRect(hs.x - bw / 2, by - 8, bw, 16, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#FDE68A";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(badge, hs.x, by);
          }
          ctx.restore();
        } else {
          const riverR = waterDrawMode === "river_path" ? waterRiverWidthCells * 0.5 * cam.cellPx : 0;
          ctx.save();
          ctx.strokeStyle = "#38BDF8";
          ctx.lineWidth = 1.6;
          if (riverR > 4) {
            ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(hs.x, hs.y, riverR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.beginPath();
          ctx.moveTo(hs.x - 7, hs.y);
          ctx.lineTo(hs.x + 7, hs.y);
          ctx.moveTo(hs.x, hs.y - 7);
          ctx.lineTo(hs.x, hs.y + 7);
          ctx.stroke();
          ctx.restore();
        }
      } else if (activeTool === "cave") {
        if (caveDrawMode === "cave_brush" || caveDrawMode === "erase") {
          const isErase = caveDrawMode === "erase" || (caveDrawMode === "cave_brush" && altDown);
          const ringR = caveBrushRadiusCells * cam.cellPx;
          ctx.save();
          ctx.strokeStyle = isErase ? "#F87171" : "#34D399";
          ctx.fillStyle = isErase ? "rgba(248, 113, 113, 0.16)" : "rgba(52, 211, 153, 0.14)";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.arc(hs.x, hs.y, ringR, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (isErase) {
            ctx.setLineDash([]);
            ctx.font = "700 10px JetBrains Mono, monospace";
            const badge = caveDrawMode === "cave_brush" ? "ERASE (ALT)" : "ERASE";
            const bw = ctx.measureText(badge).width + 10;
            const by = hs.y + ringR + 12;
            ctx.fillStyle = "rgba(18, 12, 16, 0.9)";
            ctx.strokeStyle = "rgba(248, 113, 113, 0.85)";
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.roundRect(hs.x - bw / 2, by - 8, bw, 16, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#FCA5A5";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(badge, hs.x, by);
          }
          ctx.restore();
        } else if (caveDrawMode === "dungeon_rect" || caveDrawMode === "polygon") {
          ctx.save();
          ctx.strokeStyle = "#34D399";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(hs.x - 7, hs.y);
          ctx.lineTo(hs.x + 7, hs.y);
          ctx.moveTo(hs.x, hs.y - 7);
          ctx.lineTo(hs.x, hs.y + 7);
          ctx.stroke();
          ctx.restore();
        } else if (caveDrawMode === "entrance" && !hoveredEntranceHandle && dragRef.current.mode === "none") {
          const caveLyr = doc.layers.find(
            (l) =>
              l.kind === "caves" &&
              l.visible &&
              l.levelId === doc.activeLevelId &&
              l.caveSystem &&
              l.caveSystem.operations.length > 0,
          );
          if (caveLyr?.caveSystem) {
            const geom = computeCaveGeometry(
              caveLyr.caveSystem,
              doc.canvas.widthCells,
              doc.canvas.heightCells,
              caveLyr.id,
            );
            const snap = snapEntranceToCavePerimeter(hoverGrid, geom, 3.0);
            if (snap) {
              const previewEnt = {
                id: "preview",
                x: snap.x,
                y: snap.y,
                normalRad: snap.normalRad,
                widthCells: caveEntranceWidthCells,
                fadeLengthCells: caveEntranceFadeCells,
                thresholdStyle: st.caveEntranceThreshold,
                markerLabel: st.caveEntranceMarkerLabel,
                showMarker: st.caveEntranceShowMarker,
                markerDmOnly: st.caveEntranceDmOnly,
              };
              const apron = buildEntranceFadeApron(previewEnt);
              ctx.save();
              ctx.beginPath();
              apron.polygon.forEach((pt, idx) => {
                const s = toScreen(pt);
                if (idx === 0) ctx.moveTo(s.x, s.y);
                else ctx.lineTo(s.x, s.y);
              });
              ctx.closePath();
              ctx.fillStyle = "rgba(34, 211, 238, 0.22)";
              ctx.strokeStyle = "#22D3EE";
              ctx.lineWidth = 1.8;
              ctx.setLineDash([5, 4]);
              ctx.fill();
              ctx.stroke();
              ctx.setLineDash([]);

              // Highlight opening cut bar + outward arrow
              const sp = toScreen({ x: snap.x, y: snap.y });
              ctx.translate(sp.x, sp.y);
              ctx.rotate(snap.normalRad);
              const hw = (caveEntranceWidthCells * cam.cellPx) * 0.5;
              ctx.strokeStyle = "#FDE68A";
              ctx.lineWidth = 3.2;
              ctx.beginPath();
              ctx.moveTo(0, -hw);
              ctx.lineTo(0, hw);
              ctx.stroke();
              const arrowL = Math.max(24, caveEntranceFadeCells * cam.cellPx * 0.65);
              ctx.strokeStyle = "#22D3EE";
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.lineTo(arrowL, 0);
              ctx.moveTo(arrowL - 8, -6);
              ctx.lineTo(arrowL, 0);
              ctx.lineTo(arrowL - 8, 6);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      } else if (activeTool === "wall" && dragRef.current.mode === "none") {
        if (wallDrawMode === "split") {
          const hit = findWallCutHit(hoverGrid, doc.layers, doc.activeLevelId, 0.75);
          if (hit) {
            const sp = toScreen(hit.point);
            ctx.save();
            ctx.translate(sp.x, sp.y);
            ctx.rotate(hit.tangentRad);
            if (wallSplitSubMode === "breach") {
              const bwPx = Math.max(10, wallBreachWidthCells * cam.cellPx);
              const bhPx = Math.max(12, hit.wall.thicknessCells * cam.cellPx * 2.4);
              ctx.fillStyle = "rgba(248, 113, 113, 0.28)";
              ctx.strokeStyle = "#F87171";
              ctx.lineWidth = 2;
              ctx.setLineDash([4, 3]);
              ctx.fillRect(-bwPx / 2, -bhPx / 2, bwPx, bhPx);
              ctx.strokeRect(-bwPx / 2, -bhPx / 2, bwPx, bhPx);
              ctx.setLineDash([]);
              // Crisp jamb cut lines on both ends of the breach
              ctx.strokeStyle = "#FDE68A";
              ctx.lineWidth = 2.6;
              ctx.beginPath();
              ctx.moveTo(-bwPx / 2, -bhPx * 0.68);
              ctx.lineTo(-bwPx / 2, bhPx * 0.68);
              ctx.moveTo(bwPx / 2, -bhPx * 0.68);
              ctx.lineTo(bwPx / 2, bhPx * 0.68);
              ctx.stroke();
            } else {
              const hPx = Math.max(14, hit.wall.thicknessCells * cam.cellPx * 2.6);
              ctx.strokeStyle = "#22D3EE";
              ctx.lineWidth = 2.6;
              ctx.beginPath();
              ctx.moveTo(0, -hPx * 0.65);
              ctx.lineTo(0, hPx * 0.65);
              ctx.stroke();
              ctx.fillStyle = "#12141A";
              ctx.beginPath();
              ctx.arc(0, 0, 5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.restore();

            const tip =
              wallSplitSubMode === "breach"
                ? `Click to Carve ${wallBreachWidthCells.toFixed(1)} sq Breach`
                : hit.wall.closed
                  ? "Click to Open Closed Room Seam"
                  : "Click to Split Wall Here";
            ctx.save();
            ctx.font = "600 10.5px JetBrains Mono, monospace";
            const tw = ctx.measureText(tip).width + 14;
            const py = Math.max(18, sp.y - 24);
            ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
            ctx.strokeStyle = wallSplitSubMode === "breach" ? "#F87171" : "#22D3EE";
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.roundRect(sp.x - tw / 2, py - 10, tw, 20, 5);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = wallSplitSubMode === "breach" ? "#FCA5A5" : "#A5F3FC";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(tip, sp.x, py);
            ctx.restore();
          }
        } else {
          const snappedBase = snapPoint(hoverGrid, altDown ? "free" : snapMode);
          const snapHit =
            !altDown && wallSnapToWalls && activeFloorWalls.length > 0
              ? findWallSnapTarget(snappedBase, activeFloorWalls, 0.45)
              : null;
          if (snapHit) {
            const sp = toScreen(snapHit.point);
            ctx.save();
            ctx.strokeStyle = "#22D3EE";
            ctx.fillStyle = "rgba(34, 211, 238, 0.24)";
            ctx.lineWidth = 2;
            if (snapHit.kind === "vertex") {
              ctx.beginPath();
              ctx.moveTo(sp.x, sp.y - 8);
              ctx.lineTo(sp.x + 8, sp.y);
              ctx.lineTo(sp.x, sp.y + 8);
              ctx.lineTo(sp.x - 8, sp.y);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            } else {
              ctx.beginPath();
              ctx.arc(sp.x, sp.y, 6.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.restore();
          } else if (draftPoints.length === 0) {
            const sp = toScreen(snappedBase);
            ctx.save();
            ctx.strokeStyle = "#F59E0B";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(sp.x - 7, sp.y);
            ctx.lineTo(sp.x + 7, sp.y);
            ctx.moveTo(sp.x, sp.y - 7);
            ctx.lineTo(sp.x, sp.y + 7);
            ctx.stroke();
            ctx.restore();
          }
        }
      } else if (activeTool === "portal") {
        const allWalls = doc.layers.flatMap((l) => {
          if (!l.visible) return [];
          const out = [...(l.walls ?? [])];
          if (l.kind === "caves" && l.caveSystem && l.caveSystem.operations.length > 0) {
            out.push(
              ...computeCaveGeometry(l.caveSystem, doc.canvas.widthCells, doc.canvas.heightCells, l.id)
                .wallSegments,
            );
          }
          return out;
        });
        const snap = findNearestWallSnap(hoverGrid, allWalls, 1.4);
        if (snap) {
          const ps = toScreen({ x: snap.x, y: snap.y });
          const pAsset = st.activePortalAssetId || "";
          const isSwingingDoor = !pAsset.includes("window") && !pAsset.includes("gate");
          ctx.save();
          ctx.translate(ps.x, ps.y);
          ctx.rotate(snap.rotationRad);
          ctx.fillStyle = "rgba(229, 169, 60, 0.25)";
          ctx.strokeStyle = "#E5A93C";
          ctx.lineWidth = 2;
          const pw = st.activePortalWidthCells * cam.cellPx;
          const ph = 0.55 * cam.cellPx;
          ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
          ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);

          // Live architectural door-swing direction & hinge side preview!
          if (isSwingingDoor) {
            const sx = st.activePortalHingeFlip ? -1 : 1;
            const sy = st.activePortalSwingInvert ? -1 : 1;
            const jambOff = Math.max(3, cam.cellPx * 0.13) * 0.4;
            const swingR = Math.max(8, pw - jambOff * 2);
            ctx.save();
            ctx.scale(sx, sy);
            ctx.strokeStyle = st.activePortalClosed
              ? "rgba(229, 169, 60, 0.55)"
              : "rgba(229, 169, 60, 0.9)";
            ctx.lineWidth = 1.6;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(-pw / 2 + jambOff, 0, swingR, 0, Math.PI * 0.44);
            ctx.stroke();
            ctx.setLineDash([]);
            // Swung-open leaf direction line + hinge pivot dot
            ctx.translate(-pw / 2 + jambOff, 0);
            ctx.fillStyle = "#FDE68A";
            ctx.beginPath();
            ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.rotate(Math.PI * 0.42);
            ctx.fillStyle = st.activePortalClosed
              ? "rgba(229, 169, 60, 0.25)"
              : "rgba(229, 169, 60, 0.55)";
            ctx.fillRect(0, -ph * 0.22, swingR, ph * 0.44);
            ctx.strokeRect(0, -ph * 0.22, swingR, ph * 0.44);
            ctx.restore();
          }
          ctx.restore();
        }
      } else if (activeTool === "roof" && dragRef.current.mode === "none") {
        if (roofDrawMode === "auto_room") {
          if (autoRoomRoofPreview) {
            const previewRoof = buildDraftRoof(
              autoRoomRoofPreview.points,
              autoRoomRoofPreview.widthCells,
            );
            ctx.save();
            ctx.translate(cam.x, cam.y);
            drawRoofStructure(ctx, previewRoof, cam.cellPx, 0.82, assetLookup);
            ctx.restore();

            const midPt = toScreen({
              x: (autoRoomRoofPreview.points[0].x + autoRoomRoofPreview.points[1].x) * 0.5,
              y: (autoRoomRoofPreview.points[0].y + autoRoomRoofPreview.points[1].y) * 0.5,
            });
            const tip = `Click to Auto-Roof Room (${autoRoomRoofPreview.areaSq.toFixed(0)} sq)`;
            ctx.save();
            ctx.font = "600 11px JetBrains Mono, monospace";
            const tw = ctx.measureText(tip).width + 16;
            ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
            ctx.strokeStyle = "#FB923C";
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.roundRect(midPt.x - tw / 2, midPt.y - 11, tw, 22, 6);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#FED7AA";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(tip, midPt.x, midPt.y);
            ctx.restore();
          } else {
            ctx.save();
            ctx.strokeStyle = "#FB923C";
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.arc(hs.x, hs.y, 9, 0, Math.PI * 2);
            ctx.moveTo(hs.x - 13, hs.y);
            ctx.lineTo(hs.x + 13, hs.y);
            ctx.moveTo(hs.x, hs.y - 13);
            ctx.lineTo(hs.x, hs.y + 13);
            ctx.stroke();
            ctx.restore();
          }
        } else if (draftPoints.length === 0) {
          ctx.save();
          ctx.strokeStyle = "#FB923C";
          ctx.lineWidth = 1.6;
          if (roofDrawMode === "ridge_path") {
            const halfSpanPx = Math.max(8, roofWidthCells * 0.5 * cam.cellPx);
            ctx.fillStyle = "rgba(251, 146, 60, 0.12)";
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.arc(hs.x, hs.y, halfSpanPx, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.setLineDash([]);
          }
          ctx.beginPath();
          ctx.moveTo(hs.x - 7, hs.y);
          ctx.lineTo(hs.x + 7, hs.y);
          ctx.moveTo(hs.x, hs.y - 7);
          ctx.lineTo(hs.x, hs.y + 7);
          ctx.stroke();
          ctx.restore();
        }
      } else if (
        activeTool === "light" &&
        !hoveredLightId &&
        !hoveredLightHandle &&
        dragRef.current.mode === "none"
      ) {
        ctx.save();
        ctx.strokeStyle = st.activeLightColorHex;
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(hs.x, hs.y, st.activeLightRadiusCells * cam.cellPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(12, 15, 22, 0.72)";
        ctx.beginPath();
        ctx.arc(hs.x, hs.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = st.activeLightColorHex;
        ctx.beginPath();
        ctx.arc(hs.x, hs.y, 3.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (activeTool === "world_land") {
        const effectiveMode =
          altDown && worldLandMode === "raise"
            ? "lower"
            : altDown && worldLandMode === "lower"
              ? "raise"
              : worldLandMode;
        const rPx = Math.max(8, worldLandRadiusCells * cam.cellPx);
        const col =
          effectiveMode === "raise" || effectiveMode === "lake_erase"
            ? "#F59E0B"
            : effectiveMode === "smooth"
              ? "#34D399"
              : "#38BDF8";
        ctx.save();
        ctx.strokeStyle = col;
        ctx.fillStyle = `${col}1F`;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(hs.x, hs.y, rPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        const tag =
          effectiveMode === "raise"
            ? "+ Raise Land"
            : effectiveMode === "lower"
              ? "− Lower Ocean"
              : effectiveMode === "smooth"
                ? "≈ Smooth Coast"
                : effectiveMode === "lake_carve"
                  ? "💧 Carve Lake"
                  : "✕ Fill Lake";
        ctx.font = "600 10.5px JetBrains Mono, monospace";
        const tw = ctx.measureText(tag).width + 12;
        ctx.fillStyle = "rgba(15, 18, 26, 0.92)";
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(hs.x - tw / 2, hs.y - rPx - 24, tw, 18, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#F8FAFC";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(tag, hs.x, hs.y - rPx - 15);
        ctx.restore();
      } else if (activeTool === "world_biome") {
        const rPx = Math.max(8, worldBiomeRadiusCells * cam.cellPx);
        ctx.save();
        ctx.strokeStyle = worldBiomeColorHex;
        ctx.fillStyle = `${worldBiomeColorHex}33`;
        ctx.lineWidth = 1.8;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.arc(hs.x, hs.y, rPx, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      } else if (activeTool === "world_label" && doc.world) {
        const stNow = useDocumentStore.getState();
        ctx.save();
        ctx.translate(cam.x, cam.y);
        ctx.globalAlpha = 0.72;
        drawWorldLabel(
          ctx,
          {
            id: "__ghost__",
            text: stNow.worldLabelText || "New Place",
            x: hoverGrid.x,
            y: hoverGrid.y,
            category: stNow.worldLabelCategory,
            fontFamily:
              stNow.worldLabelCategory === "continent" || stNow.worldLabelCategory === "banner"
                ? doc.world.theme.fontFamilyDisplay
                : doc.world.theme.fontFamilyBody,
            fontSizePx: stNow.worldLabelFontSize,
            colorHex: doc.world.theme.labelColorHex,
            outlineColorHex: doc.world.theme.labelOutlineHex,
            outlineWidth: stNow.worldLabelBoxStyle === "none" ? 2.2 : 0,
            letterSpacing: stNow.worldLabelLetterSpacing,
            italic: stNow.worldLabelItalic,
            bold: stNow.worldLabelBold,
            uppercase: stNow.worldLabelUppercase,
            rotationDeg: stNow.worldLabelRotationDeg,
            curveBend: stNow.worldLabelCurveBend,
            boxStyle: stNow.worldLabelBoxStyle,
            opacity: 0.85,
          },
          doc.world,
          cam.cellPx,
          false,
        );
        ctx.restore();
      }
    }

    // Live World Biome Stroke preview while dragging
    if (dragRef.current.mode === "world_biome" && dragRef.current.terrainPoints.length > 0) {
      const rPx = Math.max(6, worldBiomeRadiusCells * cam.cellPx);
      ctx.save();
      ctx.fillStyle = `${worldBiomeColorHex}44`;
      for (const p of dragRef.current.terrainPoints) {
        const sp = toScreen(p);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, rPx, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Live World Detail / Sub-Region Crop Marquee Box
    if (dragRef.current.mode === "world_crop" && dragRef.current.rectStart && dragRef.current.rectEnd) {
      const a = toScreen(dragRef.current.rectStart);
      const b = toScreen(dragRef.current.rectEnd);
      const rx = Math.min(a.x, b.x);
      const ry = Math.min(a.y, b.y);
      const rw = Math.abs(b.x - a.x);
      const rh = Math.abs(b.y - a.y);
      ctx.save();
      ctx.fillStyle = "rgba(56, 189, 248, 0.14)";
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 4]);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
      const tip = "Release to Spawn Regional Detail Atlas";
      ctx.font = "600 11px JetBrains Mono, monospace";
      const tw = ctx.measureText(tip).width + 16;
      ctx.fillStyle = "rgba(15, 18, 26, 0.94)";
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(rx + rw / 2 - tw / 2, Math.max(12, ry - 26), tw, 20, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#BAE6FD";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tip, rx + rw / 2, Math.max(22, ry - 16));
      ctx.restore();
    }

    // Live Tactical Measurement Ruler (Squares, Feet, AND 55" 4K TV Physical Inches!)
    if (measurePts) {
      const sa = toScreen(measurePts.a);
      const sb = toScreen(measurePts.b);
      const distCells = Math.hypot(
        measurePts.b.x - measurePts.a.x,
        measurePts.b.y - measurePts.a.y,
      );
      const distFt = distCells * 5;
      ctx.save();
      ctx.strokeStyle = "#E5A93C";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y);
      ctx.lineTo(sb.x, sb.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const pt of [sa, sb]) {
        ctx.fillStyle = "#E5A93C";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      const midX = (sa.x + sb.x) / 2;
      const midY = (sa.y + sb.y) / 2 - 16;
      const label =
        doc.mode === "world" && doc.world
          ? formatOverlandTravelMeasure(distCells, doc.world.overlays)
          : `${distCells.toFixed(1)} sq · ${distFt.toFixed(0)} ft · ${distCells.toFixed(1)}" TV`;
      ctx.font = "600 12px JetBrains Mono, monospace";
      const tw = ctx.measureText(label).width + 16;
      ctx.fillStyle = "rgba(18, 20, 26, 0.94)";
      ctx.strokeStyle = "#E5A93C";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(midX - tw / 2, midY - 12, tw, 24, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#EDF1F8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, midX, midY);
      ctx.restore();
    }
  }, [
    renderTick,
    textureVersion,
    doc,
    dmViewMode,
    showVttOverlay,
    showScatterOutlines,
    showOnionSkin,
    isolateActiveFloor,
    selection,
    selectedWallSegmentIndex,
    draftPoints,
    draftSegmentCurves,
    pendingFreeArcEnd,
    hoverGrid,
    activeTool,
    terrainMode,
    terrainTextureScale,
    terrainPolygonCurved,
    terrainReplaceScope,
    terrainEraseShape,
    replacePreview,
    caveDrawMode,
    caveBrushRadiusCells,
    waterDrawMode,
    waterBrushRadiusCells,
    waterRiverWidthCells,
    waterCurved,
    caveEntranceWidthCells,
    caveEntranceFadeCells,
    altDown,
    shiftDown,
    ctrlDown,
    floodPreview,
    snapMode,
    selectedAssetId,
    assetLookup,
    measurePts,
    wallDrawMode,
    wallPolygonShape,
    wallBoxRotationDeg,
    wallSnapToWalls,
    wallSplitSubMode,
    wallBreachWidthCells,
    wallCorridorWidthCells,
    wallCorridorCapEnds,
    wallThicknessCells,
    wallAutoFillClosed,
    wallCurved,
    activeFloorWalls,
    resolveWallPoint,
    pathCurved,
    roofDrawMode,
    roofStyle,
    activeRoofAssetId,
    roofWidthCells,
    roofCurved,
    roofFlipSlope,
    roofOverhangCells,
    roofRotateBoxRidge,
    roofSunAngleDeg,
    roofSlopeShade,
    roofRidgeCapStyle,
    roofRidgeCapWidthCells,
    roofEaveTrim,
    roofDropShadow,
    roofShadowDistanceCells,
    roofTextureScale,
    roofWeathering,
    roofOpacity,
    roofConeFacets,
    roofRidgeOffset,
    roofHipInsetRatio,
    roofMansardCrownRatio,
    autoRoomRoofPreview,
    buildDraftRoof,
    stampScale,
    stampRotationRad,
    objectTemplates,
    activeTemplateId,
    templateRotationRad,
    templateScale,
    brushRadiusCells,
    activePortalWidthCells,
    activePortalClosed,
    activePortalSwingInvert,
    activePortalHingeFlip,
    activeLightRadiusCells,
    hoveredLightId,
    hoveredLightHandle,
    hoveredEntranceHandle,
    activeRecolor,
    toolRecolors,
    eyedropperTarget,
    worldLandMode,
    worldLandRadiusCells,
    worldBiomeColorHex,
    worldBiomeRadiusCells,
    worldRiverCurved,
    worldTrailCurved,
    worldLabelText,
    worldLabelFontSize,
    worldLabelCurveBend,
    worldLabelBoxStyle,
  ]);

  const screenToGrid = (clientX: number, clientY: number): Point2D => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - camRef.current.x) / camRef.current.cellPx,
      y: (sy - camRef.current.y) / camRef.current.cellPx,
    };
  };

  const hitTestGrid = (pt: Point2D, prioritizeObjects = false) => {
    // World Atlas entities (pins & labels sit above symbols, rivers/trails/regions sit below symbols)
    if (doc.mode === "world" && doc.world) {
      if (dmViewMode) {
        for (let pi = doc.world.subMapPins.length - 1; pi >= 0; pi--) {
          const pin = doc.world.subMapPins[pi];
          if (Math.hypot(pt.x - pin.x, pt.y - pin.y) <= 1.05) {
            return { kind: "world_pin" as const, layerId: "__world__", id: pin.id, item: pin };
          }
        }
      }
      const visibleLabels = dmViewMode
        ? doc.world.labels
        : doc.world.labels.filter((l) => !l.dmOnly);
      const hitLbl = hitTestWorldLabel(pt, visibleLabels, camRef.current.cellPx);
      if (hitLbl) {
        return { kind: "world_label" as const, layerId: "__world__", id: hitLbl.id, item: hitLbl };
      }
    }

    // Check top-to-bottom across visible unlocked layers.
    // Protect lower-elevation floors from accidental clicks when editing upper floors / roofs,
    // and always prioritize the active floor ahead of any lower-elevation layers.
    const restrictToActiveFloor = doc.mode !== "world" && (isolateActiveFloor || lockLowerFloors);
    const levelElevRank = new Map<string, number>();
    for (const lv of doc.levels) {
      const k =
        lv.kind === "sky" ? 4000 : lv.kind === "roof" ? 3000 : lv.kind === "upper" ? 2000 : lv.kind === "ground" ? 1000 : 0;
      levelElevRank.set(lv.id, k + lv.elevationFt);
    }
    const candidateLayers = doc.layers
      .map((layer, origIdx) => ({ layer, origIdx }))
      .filter(({ layer }) => {
        if (!layer.visible || layer.locked) return false;
        if (layer.dmOnly && !dmViewMode) return false;
        if (restrictToActiveFloor && layer.levelId !== doc.activeLevelId) return false;
        return true;
      })
      .sort((a, b) => {
        const aActive = a.layer.levelId === doc.activeLevelId ? 1 : 0;
        const bActive = b.layer.levelId === doc.activeLevelId ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        const aElev = levelElevRank.get(a.layer.levelId) ?? 0;
        const bElev = levelElevRank.get(b.layer.levelId) ?? 0;
        if (aElev !== bElev) return bElev - aElev;
        return b.origIdx - a.origIdx;
      });

    // When prioritizeObjects is true (right-click or Select outside Light tool), Props take priority over invisible Light cores.
    const passes = prioritizeObjects ? ["objects", "rest"] : ["all"];
    for (const pass of passes) {
      for (const { layer } of candidateLayers) {

        if ((pass === "all" || pass === "rest") && layer.dmNotes) {
          for (const n of layer.dmNotes) {
            if (Math.hypot(pt.x - n.x, pt.y - n.y) < 1.1) {
              return { kind: "dm_note" as const, layerId: layer.id, id: n.id, item: n };
            }
          }
        }
        if ((pass === "all" || pass === "rest") && layer.kind === "caves" && layer.caveSystem?.entrances?.length) {
          for (const ent of layer.caveSystem.entrances) {
            if (Math.hypot(pt.x - ent.x, pt.y - ent.y) < Math.max(1.0, ent.widthCells * 0.55)) {
              return { kind: "cave_entrance" as const, layerId: layer.id, id: ent.id, item: ent };
            }
          }
        }
        if ((pass === "all" || pass === "objects") && layer.objects) {
          const sorted = [...layer.objects].sort((a, b) => b.zOrder - a.zOrder);
          const minObjHit = Math.max(0.1, 8 / Math.max(12, camRef.current.cellPx));
          for (const o of sorted) {
            const dx = pt.x - o.x;
            const dy = pt.y - o.y;
            const cos = Math.cos(-o.rotationRad);
            const sin = Math.sin(-o.rotationRad);
            const lx = dx * cos - dy * sin;
            const ly = dx * sin + dy * cos;
            if (
              Math.abs(lx) <= Math.max(minObjHit, o.widthCells * 0.52) &&
              Math.abs(ly) <= Math.max(minObjHit, o.heightCells * 0.52)
            ) {
              return { kind: "object" as const, layerId: layer.id, id: o.id, item: o };
            }
          }
        }
        if ((pass === "all" || pass === "rest") && layer.lights) {
          for (const l of layer.lights) {
            if (Math.hypot(pt.x - l.x, pt.y - l.y) < 0.75) {
              return { kind: "light" as const, layerId: layer.id, id: l.id, item: l };
            }
          }
        }
        if ((pass === "all" || pass === "rest") && layer.portals) {
          for (const p of layer.portals) {
            if (Math.hypot(pt.x - p.x, pt.y - p.y) < Math.max(0.7, p.widthCells * 0.55)) {
              return { kind: "portal" as const, layerId: layer.id, id: p.id, item: p };
            }
          }
        }
        if ((pass === "all" || pass === "rest") && layer.roofs) {
          for (let ri = layer.roofs.length - 1; ri >= 0; ri--) {
            const rf = layer.roofs[ri];
            if (pointInRoof(pt, rf)) {
              return { kind: "roof" as const, layerId: layer.id, id: rf.id, item: rf };
            }
          }
        }
        if ((pass === "all" || pass === "rest") && layer.walls) {
          for (const w of layer.walls) {
            const hit = distanceToWall(pt, w);
            if (hit.dist <= Math.max(0.42, w.thicknessCells * 1.15)) {
              return { kind: "wall" as const, layerId: layer.id, id: w.id, item: w };
            }
          }
        }
        if ((pass === "all" || pass === "rest") && layer.paths) {
          for (const p of layer.paths) {
            const hit = distanceToWall(pt, {
              points: p.points,
              closed: false,
              curved: p.curved !== false,
              segmentCurves: p.segmentCurves,
            });
            if (hit.dist <= Math.max(0.45, p.widthCells * 0.58)) {
              return { kind: "path" as const, layerId: layer.id, id: p.id, item: p };
            }
          }
        }
        if ((pass === "all" || pass === "rest") && layer.scatterZones) {
          for (const z of layer.scatterZones) {
            if (pointInPolygon(pt, z.polygon)) {
              return { kind: "scatter" as const, layerId: layer.id, id: z.id, item: z };
            }
          }
        }
        if ((pass === "all" || pass === "rest") && layer.waterRegions) {
          for (let wi = layer.waterRegions.length - 1; wi >= 0; wi--) {
            const wr = layer.waterRegions[wi];
            if (pointInWaterRegion(pt, wr)) {
              return { kind: "water" as const, layerId: layer.id, id: wr.id, item: wr };
            }
          }
        }
      }
    }
    if (doc.mode === "world" && doc.world) {
      const hitRiv = hitTestWorldRiver(pt, doc.world.rivers);
      if (hitRiv) {
        return { kind: "world_river" as const, layerId: "__world__", id: hitRiv.id, item: hitRiv };
      }
      const hitTrl = hitTestWorldTrail(pt, doc.world.trails);
      if (hitTrl) {
        return { kind: "world_trail" as const, layerId: "__world__", id: hitTrl.id, item: hitTrl };
      }
      const hitReg = hitTestWorldRegion(pt, doc.world.regions);
      if (hitReg) {
        return { kind: "world_region" as const, layerId: "__world__", id: hitReg.id, item: hitReg };
      }
    }
    return null;
  };

  const commitDraft = (closedLoop: boolean, extraCurves?: Array<number | null>) => {
    const st = useDocumentStore.getState();
    const pts = [...draftPoints];
    const segCurves = extraCurves ? [...extraCurves] : [...draftSegmentCurvesRef.current];
    setDraftPoints([]);
    setDraftSegmentCurves([]);
    setPendingFreeArcEnd(null);
    if (pts.length < 2) return;

    if (activeTool === "world_river" && pts.length >= 2) {
      st.addWorldRiver({
        id: `wriv-${Date.now()}`,
        name: "Winding River",
        points: pts,
        startWidthCells: st.worldRiverStartWidth,
        endWidthCells: st.worldRiverEndWidth,
        meanderRoughness: st.worldRiverMeander,
        meanderScale: st.worldRiverMeanderScale,
        curved: st.worldRiverCurved,
        fadeMouth: st.worldRiverFadeMouth,
        fadeSource: true,
        clipToLand: st.worldRiverClipToLand,
        seed: Math.floor(Math.random() * 99999),
      });
      st.pushToast("Carved meandering tapered river", "success");
      return;
    }
    if (activeTool === "world_trail" && pts.length >= 2) {
      st.addWorldTrail({
        id: `wtrl-${Date.now()}`,
        name: st.worldTrailStyle === "sea_lane" ? "Trade Sea Lane" : "Overland Route",
        points: pts,
        style: st.worldTrailStyle,
        widthCells: st.worldTrailWidth,
        colorHex: st.worldTrailColorHex,
        outlineColorHex: st.worldTrailStyle === "double_road" ? "#F1E4C8" : undefined,
        dashScale: st.worldTrailDashScale,
        curved: st.worldTrailCurved,
        opacity: st.worldTrailOpacity,
      });
      st.pushToast(`Added ${st.worldTrailStyle.replace("_", " ")} route`, "success");
      return;
    }
    if (activeTool === "world_region" && pts.length >= 3) {
      st.addWorldRegion({
        id: `wreg-${Date.now()}`,
        name: st.worldRegionName || "New Realm",
        polygon: pts,
        curved: true,
        fillColorHex: st.worldRegionFillHex,
        fillOpacity: st.worldRegionFillOpacity,
        borderColorHex: st.worldRegionBorderHex,
        borderWidth: st.worldRegionBorderWidth,
        borderStyle: st.worldRegionBorderStyle,
        clipToLand: st.worldRegionClipToLand,
      });
      st.pushToast(`Claimed Political Region "${st.worldRegionName || "New Realm"}"`, "success");
      return;
    }

    if (activeTool === "wall") {
      const wallAsset = st.activeWallAssetId || "walls/grunderzeit_brick_wall.png";
      const label = assetLookup.get(wallAsset)?.displayName ?? "Smart Wall";
      if (st.wallDrawMode === "corridor") {
        const corr = buildCorridorWalls(pts, st.wallCorridorWidthCells, {
          curved: st.wallCurved,
          capEnds: st.wallCorridorCapEnds,
        });
        if (corr) {
          const stamp = Date.now();
          const wallBatch = corr.walls.map((w, idx) => ({
            id: `wcorr-${stamp}-${idx}`,
            assetId: wallAsset,
            points: w.points,
            closed: w.closed,
            curved: w.curved,
            thicknessCells: st.wallThicknessCells,
            blocksLight: st.wallBlocksLight,
            recolor: st.toolRecolors.wall.enabled ? { ...st.toolRecolors.wall } : undefined,
          }));
          st.addWallsBatch(wallBatch, corr.floorPolygon);
          st.pushToast(
            `Built ${st.wallCorridorWidthCells.toFixed(1)} sq Corridor (${label})`,
            "success",
          );
        }
        return;
      }
      const normalizedCurves = normalizeWallSegmentCurves(pts.length, closedLoop, segCurves);
      st.addWall({
        id: `w-${Date.now()}`,
        assetId: wallAsset,
        points: pts,
        closed: closedLoop,
        curved: false,
        segmentCurves: normalizedCurves,
        thicknessCells: st.wallThicknessCells,
        blocksLight: st.wallBlocksLight,
        recolor: st.toolRecolors.wall.enabled ? { ...st.toolRecolors.wall } : undefined,
      });
      st.pushToast(
        normalizedCurves ? `Drew mixed Straight + Curved ${label}` : `Drew ${label}`,
        "success",
      );
    } else if (activeTool === "path") {
      const pathAsset = st.activePathAssetId || "paths/magirail_funicular_track.png";
      const normalizedCurves = normalizeWallSegmentCurves(pts.length, false, segCurves);
      st.addPath({
        id: `path-${Date.now()}`,
        assetId: pathAsset,
        points: pts,
        widthCells: st.pathWidthCells,
        curved: false,
        segmentCurves: normalizedCurves,
        flipSide: st.pathFlipSide,
        taperEnds: st.pathTaperEnds,
        fadeEnds: false,
        opacity: 1,
        blocksScatter: true,
        recolor: st.toolRecolors.path.enabled ? { ...st.toolRecolors.path } : undefined,
      });
      const label = assetLookup.get(pathAsset)?.displayName ?? "Line / Path";
      st.pushToast(
        normalizedCurves ? `Drew mixed Straight + Curved ${label}` : `Drew ${label}`,
        "success",
      );
    } else if (activeTool === "roof" && st.roofDrawMode === "ridge_path" && pts.length >= 2) {
      const draftRoof = buildDraftRoof(pts, st.roofWidthCells);
      st.addRoof({
        ...draftRoof,
        id: `roof-${Date.now()}`,
      });
      const label = assetLookup.get(draftRoof.assetId)?.displayName ?? "Roof";
      const styleLabel = draftRoof.style.charAt(0).toUpperCase() + draftRoof.style.slice(1);
      st.pushToast(`Built ${styleLabel} Roof (${label})`, "success");
    } else if (activeTool === "water" && st.waterDrawMode === "river_path" && pts.length >= 2) {
      st.addWaterRegion({
        id: `water-river-${Date.now()}`,
        kind: st.waterKind,
        presetId: st.waterPresetId,
        shape: "river",
        widthCells: st.waterRiverWidthCells,
        curved: st.waterCurved,
        textureAssetId: st.waterTextureAssetId,
        points: pts,
        deepColorHex: st.waterDeepColorHex,
        shallowColorHex: st.waterShallowColorHex,
        rimColorHex: st.waterRimColorHex,
        opacity: st.waterOpacity,
        rippleIntensity: st.waterRippleIntensity,
        causticsIntensity: st.waterCausticsIntensity,
        depthFeather: st.waterDepthFeather,
        shoreBankIntensity: st.waterShoreBankIntensity,
        organicRoughness: st.waterOrganicRoughness,
        seed: Math.floor(Math.random() * 99999),
      });
      st.pushToast(`Added flowing ${st.waterKind === "lava" ? "Magma" : "River"} stream (${st.waterRiverWidthCells.toFixed(1)} sq wide)`, "success");
    } else if (activeTool === "water" && pts.length >= 3) {
      st.addWaterRegion({
        id: `water-${Date.now()}`,
        kind: st.waterKind,
        presetId: st.waterPresetId,
        shape: "polygon",
        curved: st.waterCurved,
        textureAssetId: st.waterTextureAssetId,
        points: pts,
        deepColorHex: st.waterDeepColorHex,
        shallowColorHex: st.waterShallowColorHex,
        rimColorHex: st.waterRimColorHex,
        opacity: st.waterOpacity,
        rippleIntensity: st.waterRippleIntensity,
        causticsIntensity: st.waterCausticsIntensity,
        depthFeather: st.waterDepthFeather,
        shoreBankIntensity: st.waterShoreBankIntensity,
        organicRoughness: st.waterOrganicRoughness,
        seed: Math.floor(Math.random() * 99999),
      });
      st.pushToast(`Added ${st.waterKind === "chasm" ? "Abyss / Chasm" : "Water"} basin`, "success");
    } else if (
      activeTool === "terrain" &&
      (st.terrainMode === "polygon" ||
        (st.terrainMode === "erase" && st.terrainEraseShape === "polygon")) &&
      pts.length >= 3
    ) {
      const isErasePoly = st.terrainMode === "erase";
      const terrainAsset = st.activeTerrainAssetId || "terrain/berlin_wet_cobble.png";
      const normalizedCurves = isErasePoly
        ? undefined
        : normalizeWallSegmentCurves(pts.length, true, segCurves);
      st.addTerrainStroke({
        id: `${isErasePoly ? "terase-poly" : "tpoly"}-${Date.now()}`,
        assetId: terrainAsset,
        points: pts,
        radiusCells: 0,
        opacity: st.brushOpacity,
        softness: st.terrainFillSoftness,
        shape: "polygon",
        erase: isErasePoly || undefined,
        segmentCurves: normalizedCurves,
        rotationDeg: isErasePoly ? undefined : st.terrainRotationDeg || undefined,
        slopeShade: isErasePoly
          ? undefined
          : st.terrainSlopeShade > 0.02
            ? st.terrainSlopeShade
            : undefined,
        textureScale: isErasePoly
          ? undefined
          : Math.abs(st.terrainTextureScale - 1) > 0.01
            ? st.terrainTextureScale
            : undefined,
        recolor:
          !isErasePoly && st.toolRecolors.terrain.enabled
            ? { ...st.toolRecolors.terrain }
            : undefined,
      });
      if (isErasePoly) {
        st.pushToast("Erased polygon cutout on active terrain layer", "success");
      } else {
        const label = assetLookup.get(terrainAsset)?.displayName ?? "Terrain";
        st.pushToast(`Filled polygon area with ${label}`, "success");
      }
    } else if (activeTool === "cave" && st.caveDrawMode === "polygon" && pts.length >= 3) {
      st.addCaveOperation({
        id: `cave-poly-${Date.now()}`,
        kind: "polygon",
        points: pts,
        organicRoughness: 0,
        seed: Math.floor(Math.random() * 99999),
      });
      st.pushToast("Carved custom polygon chamber (auto-walled)", "success");
    } else if (activeTool === "scatter" && pts.length >= 3) {
      const chosenIds =
        st.scatterAssetIds.length > 0
          ? [...st.scatterAssetIds]
          : [
              "modular-suite/props/trees_deciduous/tree_oak_broad.png",
              "modular-suite/props/flora/bush_round_green.png",
            ];
      st.addScatterZone({
        id: `scatter-${Date.now()}`,
        name: st.scatterPresetName || "Custom Scatter Zone",
        polygon: pts,
        assetIds: chosenIds,
        seed: Math.floor(Math.random() * 999999),
        minSpacingCells: st.scatterMinSpacing,
        minScale: st.scatterMinScale,
        maxScale: st.scatterMaxScale,
        avoidWalls: st.scatterAvoidWalls,
        avoidPaths: st.scatterAvoidPaths,
        placements: [],
      });
      st.pushToast(`Populated ${st.scatterPresetName || "Scatter Zone"} (${chosenIds.length} prop types)`, "success");
    }
  };
  commitDraftRef.current = commitDraft;

  // Helper to check if a screen click landed on the Rotation Knob or 4 Corner Scale Handles of the selected Object
  const hitSelectedObjectHandle = (clientX: number, clientY: number) => {
    if (!selection || selection.kind !== "object") return null;
    const selLayer = doc.layers.find((l) => l.id === selection.layerId);
    if (!selLayer || selLayer.locked) return null;
    const obj = selLayer.objects?.find((o) => o.id === selection.id);
    if (!obj || obj.locked) return null;

    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = camRef.current;
    const cx = cam.x + obj.x * cam.cellPx;
    const cy = cam.y + obj.y * cam.cellPx;

    // Transform pointer into rotated local pixel coordinates around object center
    const dx = sx - cx;
    const dy = sy - cy;
    const cos = Math.cos(-obj.rotationRad);
    const sin = Math.sin(-obj.rotationRad);
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    const hw = (obj.widthCells * cam.cellPx) / 2;
    const hh = (obj.heightCells * cam.cellPx) / 2;
    const pad = 5;
    const rotY = -hh - pad - 24;

    if (Math.hypot(lx, ly - rotY) <= 16) {
      return { kind: "rotate" as const, obj, cx, cy };
    }

    const corners: Array<[number, number, string]> = [
      [-hw - pad, -hh - pad, "nwse-resize"],
      [hw + pad, -hh - pad, "nesw-resize"],
      [hw + pad, hh + pad, "nwse-resize"],
      [-hw - pad, hh + pad, "nesw-resize"],
    ];
    for (const [hx, hy, cursor] of corners) {
      if (Math.hypot(lx - hx, ly - hy) <= 13) {
        return { kind: "scale" as const, obj, cx, cy, cursor };
      }
    }
    return null;
  };

  // Helper to check if a screen click landed on an eave-span width handle of the currently selected Roof
  const hitSelectedRoofWidthHandle = (clientX: number, clientY: number) => {
    if (!selection || selection.kind !== "roof") return null;
    const selLayer = doc.layers.find((l) => l.id === selection.layerId);
    if (!selLayer || selLayer.locked) return null;
    const selRoof = selLayer.roofs?.find((r) => r.id === selection.id);
    if (!selRoof || selRoof.style === "cone") return null;
    const handles = getRoofWidthHandles(selRoof);
    if (handles.length === 0) return null;

    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = camRef.current;

    for (const h of handles) {
      const hx = cam.x + h.pos.x * cam.cellPx;
      const hy = cam.y + h.pos.y * cam.cellPx;
      if (Math.hypot(sx - hx, sy - hy) <= 14) {
        return { ...h, roof: selRoof };
      }
    }
    return null;
  };

  // Helper to check if a screen click landed on a vertex or per-section curve/midpoint handle of ANY selected polyline/spline shape
  const hitSelectedPolyHandle = (clientX: number, clientY: number) => {
    if (!selection) return null;
    const curveEnt = resolveCurveEditableEntity(doc, selection);
    let pts: Point2D[] | null = null;
    if (curveEnt) {
      if (curveEnt.locked) return null;
      pts = curveEnt.points;
    } else if (selection.kind === "roof") {
      const selLayer = doc.layers.find((l) => l.id === selection.layerId);
      if (!selLayer || selLayer.locked) return null;
      const selRoof = selLayer.roofs?.find((r) => r.id === selection.id);
      pts = selRoof?.points ?? null;
    }
    if (!pts || pts.length < 2) return null;

    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = camRef.current;

    for (let i = 0; i < pts.length; i++) {
      const vx = cam.x + pts[i].x * cam.cellPx;
      const vy = cam.y + pts[i].y * cam.cellPx;
      if (Math.hypot(sx - vx, sy - vy) <= 12) {
        return { kind: "vertex" as const, index: i, points: pts, curveEnt };
      }
    }
    if (curveEnt) {
      const segCount = getWallSegmentCount(curveEnt.points, curveEnt.closed);
      const effectiveCurves = convertLegacyWallCurveToSegments(curveEnt);
      for (let i = 0; i < segCount; i++) {
        const a = curveEnt.points[i];
        const b = curveEnt.points[(i + 1) % curveEnt.points.length];
        const info = getWallSegmentArcInfo(a, b, effectiveCurves[i]);
        const hx = cam.x + info.apex.x * cam.cellPx;
        const hy = cam.y + info.apex.y * cam.cellPx;
        if (Math.hypot(sx - hx, sy - hy) <= 12) {
          return {
            kind: "wall_edge" as const,
            segIndex: i,
            isCurved: info.curved,
            a,
            b,
            apex: info.apex,
            points: curveEnt.points,
            curveEnt,
          };
        }
      }
    }
    return null;
  };

  // Helper to check whether Light Node Badges are currently shown on canvas
  const areLightBadgesVisible = () => {
    const activeLayerKind = doc.layers.find((l) => l.id === doc.activeLayerId)?.kind;
    return activeTool === "light" || selection?.kind === "light" || activeLayerKind === "lights";
  };

  // Screen-space hit-test for the selected Light's Aim Arrow (shaft + head), Outer-Ring Cone Sliders, or Radius Knob
  const hitSelectedLightHandle = (clientX: number, clientY: number) => {
    if (!selection || selection.kind !== "light") return null;
    const selLayer = doc.layers.find((l) => l.id === selection.layerId);
    if (!selLayer || !selLayer.visible || selLayer.locked) return null;
    const lt = selLayer.lights?.find((x) => x.id === selection.id);
    if (!lt) return null;

    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = camRef.current;
    const cx = cam.x + lt.x * cam.cellPx;
    const cy = cam.y + lt.y * cam.cellPx;
    const rPx = Math.max(24, lt.radiusCells * cam.cellPx);
    const isSpot = lt.coneAngleDeg < 360;
    const halfRad = (lt.coneAngleDeg * Math.PI) / 360;

    // 1. Grabbable Cyan Aim Arrow (generous 22px arrowhead grip + 13px perpendicular tube along the entire shaft!)
    if (isSpot) {
      const aimLen = Math.min(Math.max(40, rPx * 0.54), Math.max(40, rPx - 24));
      const ux = Math.cos(lt.directionRad);
      const uy = Math.sin(lt.directionRad);
      const ax = cx + ux * aimLen;
      const ay = cy + uy * aimLen;
      if (Math.hypot(sx - ax, sy - ay) <= 22) {
        return { kind: "aim" as const, handleId: "aim" as const, light: lt, layerId: selLayer.id };
      }
      // Project pointer onto arrow shaft (outside center bulb 18px .. aimLen + 10px)
      const dx = sx - cx;
      const dy = sy - cy;
      const along = dx * ux + dy * uy;
      const perp = Math.abs(dx * -uy + dy * ux);
      if (along >= 18 && along <= aimLen + 12 && perp <= 13) {
        return { kind: "aim" as const, handleId: "aim" as const, light: lt, layerId: selLayer.id };
      }
    }

    // 2. Outer-Ring Cone Angle Slider Handles (left & right cone edges, or opposite ring thumb on 360° lights)
    if (isSpot) {
      const leftAngle = lt.directionRad - halfRad;
      const lx = cx + Math.cos(leftAngle) * rPx;
      const ly = cy + Math.sin(leftAngle) * rPx;
      if (Math.hypot(sx - lx, sy - ly) <= 19) {
        return {
          kind: "cone" as const,
          handleId: "cone_left" as const,
          light: lt,
          layerId: selLayer.id,
        };
      }
      const rightAngle = lt.directionRad + halfRad;
      const rx2 = cx + Math.cos(rightAngle) * rPx;
      const ry2 = cy + Math.sin(rightAngle) * rPx;
      if (Math.hypot(sx - rx2, sy - ry2) <= 19) {
        return {
          kind: "cone" as const,
          handleId: "cone_right" as const,
          light: lt,
          layerId: selLayer.id,
        };
      }
    } else {
      const omniAngle = lt.directionRad + Math.PI;
      const ox = cx + Math.cos(omniAngle) * rPx;
      const oy = cy + Math.sin(omniAngle) * rPx;
      if (Math.hypot(sx - ox, sy - oy) <= 19) {
        return {
          kind: "cone" as const,
          handleId: "cone_omni" as const,
          light: lt,
          layerId: selLayer.id,
        };
      }
    }

    // 3. Gold Radius Resize Handle on the outer ring along directionRad
    const radAngle = lt.directionRad;
    const rx = cx + Math.cos(radAngle) * rPx;
    const ry = cy + Math.sin(radAngle) * rPx;
    if (Math.hypot(sx - rx, sy - ry) <= 18) {
      return { kind: "radius" as const, handleId: "radius" as const, light: lt, layerId: selLayer.id };
    }
    return null;
  };

  // Screen-space hit-test for the Selected Cave / Dungeon Entrance's Fade Arrow, Width Knobs, or Center Slide Knob
  const hitSelectedEntranceHandle = (clientX: number, clientY: number) => {
    if (!selection || selection.kind !== "cave_entrance") return null;
    const selLayer = doc.layers.find((l) => l.id === selection.layerId);
    if (!selLayer || !selLayer.visible || selLayer.locked) return null;
    const ent = selLayer.caveSystem?.entrances?.find((x) => x.id === selection.id);
    if (!ent) return null;

    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = camRef.current;
    const cx = cam.x + ent.x * cam.cellPx;
    const cy = cam.y + ent.y * cam.cellPx;
    const nx = Math.cos(ent.normalRad);
    const ny = Math.sin(ent.normalRad);
    const tx = -ny;
    const ty = nx;
    const hwPx = (ent.widthCells * cam.cellPx) * 0.5;
    const fadePx = Math.max(24, ent.fadeLengthCells * cam.cellPx);

    const fx = cx + nx * fadePx;
    const fy = cy + ny * fadePx;
    if (Math.hypot(sx - fx, sy - fy) <= 19) {
      return { kind: "fade" as const, handleId: "fade" as const, ent, layerId: selLayer.id };
    }
    const wlx = cx - tx * hwPx;
    const wly = cy - ty * hwPx;
    if (Math.hypot(sx - wlx, sy - wly) <= 17) {
      return { kind: "width" as const, handleId: "width_l" as const, ent, layerId: selLayer.id };
    }
    const wrx = cx + tx * hwPx;
    const wry = cy + ty * hwPx;
    if (Math.hypot(sx - wrx, sy - wry) <= 17) {
      return { kind: "width" as const, handleId: "width_r" as const, ent, layerId: selLayer.id };
    }
    if (Math.hypot(sx - cx, sy - cy) <= 17) {
      return { kind: "slide" as const, handleId: "slide" as const, ent, layerId: selLayer.id };
    }
    return null;
  };

  // Generous screen-space hit-test for any visible Light Node Badge (zoom-independent, never blocked by props!)
  const hitLightNodeScreen = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const cam = camRef.current;
    const hitR = Math.max(18, cam.cellPx * 0.52);

    const restrictToActiveFloor = doc.mode !== "world" && (isolateActiveFloor || lockLowerFloors);
    let best: { kind: "light"; layerId: string; id: string; item: LightNode; dist: number; onActive: boolean } | null =
      null;
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const layer = doc.layers[i];
      if (!layer.visible || layer.locked || !layer.lights?.length) continue;
      if (layer.dmOnly && !dmViewMode) continue;
      if (restrictToActiveFloor && layer.levelId !== doc.activeLevelId) continue;
      const onActive = layer.levelId === doc.activeLevelId;
      for (const lt of layer.lights) {
        const lx = cam.x + lt.x * cam.cellPx;
        const ly = cam.y + lt.y * cam.cellPx;
        const dist = Math.hypot(sx - lx, sy - ly);
        const beatsBest =
          !best ||
          (onActive && !best.onActive) ||
          (onActive === best.onActive && dist < best.dist);
        if (dist <= hitR && beatsBest) {
          best = { kind: "light", layerId: layer.id, id: lt.id, item: lt, dist, onActive };
        }
      }
    }
    return best;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) return; // Handled by onContextMenu
    // Release focus from sidebar sliders/buttons so Delete, Backspace, Ctrl+Z & hotkeys work immediately!
    if (document.activeElement instanceof HTMLElement && document.activeElement !== canvasRef.current) {
      document.activeElement.blur();
    }
    const gridPt = screenToGrid(e.clientX, e.clientY);
    const effectiveSnap = e.altKey ? "free" : snapMode;
    const snapped = snapPoint(gridPt, effectiveSnap);
    const st = useDocumentStore.getState();

    // Eyedropper mode: sample exact pixel color directly off the live map canvas!
    if (st.eyedropperTarget && e.button === 0 && !spaceDown) {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const dpr = canvas.width / Math.max(1, rect.width);
        const px = Math.max(0, Math.min(canvas.width - 1, Math.round((e.clientX - rect.left) * dpr)));
        const py = Math.max(0, Math.min(canvas.height - 1, Math.round((e.clientY - rect.top) * dpr)));
        const cctx = canvas.getContext("2d");
        if (cctx) {
          try {
            const [r, g, b] = cctx.getImageData(px, py, 1, 1).data;
            const hex =
              "#" +
              [r, g, b]
                .map((v) => v.toString(16).padStart(2, "0"))
                .join("")
                .toUpperCase();
            st.applyEyedropperColor(hex);
            return;
          } catch {
            st.setEyedropperTarget(null);
          }
        }
      }
      st.setEyedropperTarget(null);
      return;
    }

    // Middle-mouse or Space+Click pans canvas
    if (e.button === 1 || spaceDown) {
      dragRef.current = {
        mode: "pan",
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        camStartX: camRef.current.x,
        camStartY: camRef.current.y,
        objStartX: 0,
        objStartY: 0,
        vertexIndex: -1,
        origPoints: [],
        hasMoved: false,
        terrainPoints: [],
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "select") {
      // 0a0. Check interactive Width / Fade / Slide handles on currently selected Cave Entrance FIRST!
      const entHandle = hitSelectedEntranceHandle(e.clientX, e.clientY);
      if (entHandle) {
        dragRef.current = {
          mode:
            entHandle.kind === "fade"
              ? "cave_entrance_fade"
              : entHandle.kind === "width"
                ? "cave_entrance_width"
                : "cave_entrance_move",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: entHandle.ent.x,
          objStartY: entHandle.ent.y,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      // 0a. Check interactive Radius / Aim handles on currently selected Light FIRST!
      const ltHandle = hitSelectedLightHandle(e.clientX, e.clientY);
      if (ltHandle) {
        dragRef.current = {
          mode:
            ltHandle.kind === "aim"
              ? "light_aim"
              : ltHandle.kind === "cone"
                ? "light_cone"
                : "light_radius",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: ltHandle.light.x,
          objStartY: ltHandle.light.y,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      // 0b. Check interactive Rotation Knob & 4 Corner Scale Handles on currently selected Object FIRST!
      const objHandle = hitSelectedObjectHandle(e.clientX, e.clientY);
      if (objHandle && selection) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const startDistPx = Math.max(
          8,
          Math.hypot(e.clientX - rect.left - objHandle.cx, e.clientY - rect.top - objHandle.cy),
        );
        dragRef.current = {
          mode: objHandle.kind === "rotate" ? "obj_rotate" : "obj_scale",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: objHandle.obj.x,
          objStartY: objHandle.obj.y,
          origWidth: objHandle.obj.widthCells,
          origHeight: objHandle.obj.heightCells,
          origRotation: objHandle.obj.rotationRad,
          startDistPx,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      // 0c. Check interactive Eave-Span Width Handles on currently selected Roof!
      const roofWidthHit = hitSelectedRoofWidthHandle(e.clientX, e.clientY);
      if (roofWidthHit && selection?.kind === "roof") {
        dragRef.current = {
          mode: "roof_width",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          origWidth: roofWidthHit.roof.widthCells,
          roofAnchor: roofWidthHit.anchor,
          roofNormal: roofWidthHit.normal,
          roofSide: roofWidthHit.side,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      // 1. Check draggable vertex & per-section curve/midpoint handles on ANY selected Wall, Line, Water, Roof, or World shape!
      const handleHit = hitSelectedPolyHandle(e.clientX, e.clientY);
      if (handleHit && selection) {
        if (handleHit.kind === "vertex") {
          const minPts = handleHit.curveEnt ? handleHit.curveEnt.minPoints : 2;
          // Alt+Click removes a vertex cleanly while preserving curves on remaining sections!
          if (e.altKey && handleHit.points.length > minPts) {
            if (handleHit.curveEnt) {
              const removed = removeWallVertexWithCurves(handleHit.curveEnt, handleHit.index);
              patchCurveEditablePoints(st, selection, removed.points, removed.segmentCurves, true);
              st.setSelectedWallSegmentIndex(null);
            } else {
              const nextPts = handleHit.points.filter((_, idx) => idx !== handleHit.index);
              if (selection.kind === "roof") {
                st.updateRoof(selection.layerId, selection.id, { points: nextPts }, true);
              }
            }
            st.pushToast("Removed vertex point");
            return;
          }
          // Record one undo snapshot before live dragging
          const clonedPts = handleHit.points.map((pt) => ({ ...pt }));
          if (selection.kind === "wall") {
            st.updateWall(selection.layerId, selection.id, { points: clonedPts }, true);
          } else if (selection.kind === "water") {
            st.updateWaterRegion(selection.layerId, selection.id, { points: clonedPts }, true);
          } else if (selection.kind === "roof") {
            st.updateRoof(selection.layerId, selection.id, { points: clonedPts }, true);
          } else if (selection.kind === "world_river") {
            st.updateWorldRiver(selection.id, { points: clonedPts }, true);
          } else if (selection.kind === "world_trail") {
            st.updateWorldTrail(selection.id, { points: clonedPts }, true);
          } else if (selection.kind === "world_region") {
            st.updateWorldRegion(selection.id, { polygon: clonedPts }, true);
          } else {
            st.updatePath(selection.layerId, selection.id, { points: clonedPts }, true);
          }
          dragRef.current = {
            mode: "vertex",
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            camStartX: 0,
            camStartY: 0,
            objStartX: 0,
            objStartY: 0,
            vertexIndex: handleHit.index,
            origPoints: clonedPts,
            hasMoved: false,
            terrainPoints: [],
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }
        if (handleHit.kind === "wall_edge") {
          st.setSelectedWallSegmentIndex(handleHit.segIndex);
          const startAsCurve = handleHit.isCurved || e.shiftKey;
          dragRef.current = {
            mode: startAsCurve ? "wall_curve" : "wall_mid_pending",
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            camStartX: 0,
            camStartY: 0,
            objStartX: 0,
            objStartY: 0,
            vertexIndex: -1,
            origPoints: handleHit.points.map((pt) => ({ ...pt })),
            wallSegIndex: handleHit.segIndex,
            wallEdgeA: { ...handleHit.a },
            wallEdgeB: { ...handleHit.b },
            hasMoved: false,
            terrainPoints: [],
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          bumpRender();
          return;
        }
      }

      // 2. Hit-test map entities (if Light badges are currently visible, check visible Light badges first so lamps don't steal clicks!)
      const visibleLightHit = areLightBadgesVisible()
        ? hitLightNodeScreen(e.clientX, e.clientY)
        : null;
      const hit = visibleLightHit ?? hitTestGrid(gridPt, true);
      if (hit) {
        const nextSel: SelectionRef = { kind: hit.kind, layerId: hit.layerId, id: hit.id };
        st.setSelection(nextSel);
        const clickedCurveEnt = resolveCurveEditableEntity(doc, nextSel);
        if (clickedCurveEnt) {
          const edgeHit = distanceToWall(gridPt, clickedCurveEnt);
          if (edgeHit.segmentIndex >= 0) {
            st.setSelectedWallSegmentIndex(edgeHit.segmentIndex);
          }
        }
        if (
          hit.kind === "object" ||
          hit.kind === "light" ||
          hit.kind === "portal" ||
          hit.kind === "dm_note" ||
          hit.kind === "world_label" ||
          hit.kind === "world_pin"
        ) {
          if (hit.kind === "object" && hit.item.locked) return;
          if (hit.kind === "portal" && hit.item.locked) return;
          dragRef.current = {
            mode: "move",
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            camStartX: 0,
            camStartY: 0,
            objStartX: hit.item.x,
            objStartY: hit.item.y,
            origWidth: 1,
            origHeight: 1,
            origRotation: 0,
            startDistPx: 1,
            vertexIndex: -1,
            origPoints: [],
            hasMoved: false,
            terrainPoints: [],
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        } else if (hit.kind === "cave_entrance") {
          dragRef.current = {
            mode: "cave_entrance_move",
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            camStartX: 0,
            camStartY: 0,
            objStartX: hit.item.x,
            objStartY: hit.item.y,
            vertexIndex: -1,
            origPoints: [],
            hasMoved: false,
            terrainPoints: [],
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        } else if (
          hit.kind === "wall" ||
          hit.kind === "path" ||
          hit.kind === "water" ||
          hit.kind === "roof" ||
          hit.kind === "world_river" ||
          hit.kind === "world_trail" ||
          hit.kind === "world_region"
        ) {
          const origPts =
            hit.kind === "world_region"
              ? hit.item.polygon.map((pt) => ({ ...pt }))
              : hit.item.points.map((pt) => ({ ...pt }));
          dragRef.current = {
            mode: "poly_move",
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            camStartX: 0,
            camStartY: 0,
            objStartX: 0,
            objStartY: 0,
            origWidth: 1,
            origHeight: 1,
            origRotation: 0,
            startDistPx: 1,
            vertexIndex: -1,
            origPoints: origPts,
            hasMoved: false,
            terrainPoints: [],
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }
      } else {
        st.setSelection(null);
      }
      return;
    }

    // ── World Atlas Studio v1.5 Tools ──
    if (activeTool === "world_land" && doc.world) {
      const effectiveMode: WorldLandBrushMode =
        e.altKey && st.worldLandMode === "raise"
          ? "lower"
          : e.altKey && st.worldLandMode === "lower"
            ? "raise"
            : st.worldLandMode;
      st.checkpointHistory();
      st.sculptWorldLand([gridPt], effectiveMode, false);
      dragRef.current = {
        mode: "world_land",
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        camStartX: 0,
        camStartY: 0,
        objStartX: 0,
        objStartY: 0,
        vertexIndex: -1,
        origPoints: [],
        hasMoved: false,
        terrainPoints: [gridPt],
        caveEraseHold: effectiveMode !== st.worldLandMode,
        lastWaterSentIdx: 1,
        lastWaterSculptMs: performance.now(),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      bumpRender();
      return;
    }

    if (activeTool === "world_biome" && doc.world) {
      dragRef.current = {
        mode: "world_biome",
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        camStartX: 0,
        camStartY: 0,
        objStartX: 0,
        objStartY: 0,
        vertexIndex: -1,
        origPoints: [],
        hasMoved: false,
        terrainPoints: [gridPt],
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      bumpRender();
      return;
    }

    if (activeTool === "world_river" || activeTool === "world_trail" || activeTool === "world_region") {
      if (activeTool === "world_region" && draftPoints.length >= 3) {
        const firstPt = draftPoints[0];
        if (Math.hypot(gridPt.x - firstPt.x, gridPt.y - firstPt.y) <= 0.65) {
          commitDraft(true);
          return;
        }
      }
      setDraftPoints((prev) => [...prev, e.altKey ? gridPt : snapped]);
      return;
    }

    if (activeTool === "world_label" && doc.world) {
      const text = st.worldLabelText.trim() || "Aldervale";
      st.addWorldLabel({
        id: `wlbl-${Date.now()}`,
        text,
        x: gridPt.x,
        y: gridPt.y,
        category: st.worldLabelCategory,
        fontFamily:
          st.worldLabelCategory === "continent" || st.worldLabelCategory === "banner"
            ? doc.world.theme.fontFamilyDisplay
            : doc.world.theme.fontFamilyBody,
        fontSizePx: st.worldLabelFontSize,
        colorHex:
          st.worldLabelCategory === "ocean"
            ? doc.world.theme.coastalEffectColorHex
            : doc.world.theme.labelColorHex,
        outlineColorHex: doc.world.theme.labelOutlineHex,
        outlineWidth: st.worldLabelBoxStyle === "none" ? 2.2 : 0,
        letterSpacing: st.worldLabelLetterSpacing,
        italic: st.worldLabelItalic,
        bold: st.worldLabelBold,
        uppercase: st.worldLabelUppercase,
        rotationDeg: st.worldLabelRotationDeg,
        curveBend: st.worldLabelCurveBend,
        boxStyle: st.worldLabelBoxStyle,
        opacity: 0.95,
        dmOnly: st.worldLabelDmOnly || undefined,
      });
      st.pushToast(`Stamped map label "${text}"`, "success");
      return;
    }

    if (activeTool === "world_crop" && doc.world) {
      dragRef.current = {
        mode: "world_crop",
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        camStartX: 0,
        camStartY: 0,
        objStartX: 0,
        objStartY: 0,
        vertexIndex: -1,
        origPoints: [],
        hasMoved: false,
        terrainPoints: [],
        rectStart: gridPt,
        rectEnd: gridPt,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      bumpRender();
      return;
    }

    if (activeTool === "terrain") {
      // Alt+Click samples the existing terrain texture (and angle/scale) right under the cursor!
      if (e.altKey && draftPoints.length === 0 && !pendingFreeArcEnd) {
        const sampled = hitTestTerrainAtPoint(gridPt, doc, doc.activeLevelId);
        if (sampled) {
          st.setBrushParams({
            activeTerrainAssetId: sampled.assetId,
            ...(sampled.kind === "stroke"
              ? {
                  terrainRotationDeg: sampled.stroke.rotationDeg ?? 0,
                  terrainSlopeShade: sampled.stroke.slopeShade ?? 0,
                  terrainTextureScale: sampled.stroke.textureScale ?? 1.0,
                }
              : {}),
          });
          const label = assetLookup.get(sampled.assetId)?.displayName ?? "Floor Texture";
          st.pushToast(`Sampled floor texture: ${label}`, "success");
          return;
        }
      }

      // Preload active terrain texture immediately so live painting/filling renders on the first frame!
      const terrainAsset = st.activeTerrainAssetId || "terrain/berlin_wet_cobble.png";
      texturePool.get(resolveAssetUrl(terrainAsset, assetLookup));

      if (st.terrainMode === "replace") {
        const hit = hitTestTerrainAtPoint(gridPt, doc, doc.activeLevelId);
        if (!hit) {
          st.pushToast("No painted terrain here — click an existing floor patch or switch to Smart Fill", "info");
          return;
        }
        const label = assetLookup.get(terrainAsset)?.displayName ?? "Terrain";
        const scope = st.terrainReplaceScope;
        if (hit.kind === "base") {
          if (scope === "patch" || scope === "layer") {
            st.setBaseTerrainAsset(terrainAsset);
            st.pushToast(`Replaced 1F Map Base with ${label}`, "success");
          } else {
            const n = st.replaceTerrainMaterial(
              hit.assetId,
              terrainAsset,
              scope,
              st.terrainReplaceApplyStyle,
            );
            st.pushToast(`Replaced ${n} matching area${n === 1 ? "" : "s"} with ${label}`, "success");
          }
        } else if (scope === "patch") {
          st.replaceTerrainStroke(
            hit.layerId,
            hit.strokeId,
            terrainAsset,
            st.terrainReplaceApplyStyle,
          );
          st.pushToast(`Replaced floor patch with ${label}`, "success");
        } else {
          const n = st.replaceTerrainMaterial(
            hit.assetId,
            terrainAsset,
            scope,
            st.terrainReplaceApplyStyle,
            hit.layerId,
          );
          st.pushToast(
            `Replaced ${n} matching area${n === 1 ? "" : "s"} (${scope}) with ${label}`,
            "success",
          );
        }
        return;
      }

      if (
        st.terrainMode === "flood" ||
        (st.terrainMode === "erase" && st.terrainEraseShape === "room")
      ) {
        const isEraseRoom = st.terrainMode === "erase";
        const res = wallBarrier ? computeSmartFloodFill(gridPt, wallBarrier) : null;
        if (!res) {
          st.pushToast(
            isEraseRoom
              ? "Click inside a room or open area to erase its terrain"
              : "Click inside an open room or map area to flood fill",
            "warning",
          );
          return;
        }
        st.addTerrainStroke(
          {
            id: `${isEraseRoom ? "terase-room" : "tflood"}-${Date.now()}`,
            assetId: terrainAsset,
            points: res.outer,
            holes: res.holes.length > 0 ? res.holes : undefined,
            radiusCells: 0,
            opacity: st.brushOpacity,
            softness: st.terrainFillSoftness,
            shape: "polygon",
            erase: isEraseRoom || undefined,
            rotationDeg: isEraseRoom ? undefined : st.terrainRotationDeg || undefined,
            slopeShade: isEraseRoom
              ? undefined
              : st.terrainSlopeShade > 0.02
                ? st.terrainSlopeShade
                : undefined,
            textureScale: isEraseRoom
              ? undefined
              : Math.abs(st.terrainTextureScale - 1) > 0.01
                ? st.terrainTextureScale
                : undefined,
            recolor:
              !isEraseRoom && st.toolRecolors.terrain.enabled
                ? { ...st.toolRecolors.terrain }
                : undefined,
          },
          { pruneContained: !isEraseRoom && st.terrainFloodReplaceUnderneath },
        );
        if (isEraseRoom) {
          st.pushToast(
            res.boundedByWalls
              ? `Erased room terrain (${res.areaSq.toFixed(1)} sq) on active layer`
              : `Erased open area terrain (${Math.round(res.areaSq)} sq)`,
            "success",
          );
        } else {
          const label = assetLookup.get(terrainAsset)?.displayName ?? "Terrain";
          st.pushToast(
            res.boundedByWalls
              ? `Filled room (${res.areaSq.toFixed(1)} sq) with ${label}`
              : `Filled open area (${Math.round(res.areaSq)} sq) with ${label}`,
            "success",
          );
        }
        return;
      }

      if (
        st.terrainMode === "rect" ||
        (st.terrainMode === "erase" && st.terrainEraseShape === "rect")
      ) {
        dragRef.current = {
          mode: "terrain_rect",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
          rectStart: snapped,
          rectEnd: snapped,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      if (
        st.terrainMode === "polygon" ||
        (st.terrainMode === "erase" && st.terrainEraseShape === "polygon")
      ) {
        const allowCurve = st.terrainMode === "polygon";
        // Step B of a Curved Polygon edge: lock bow sagitta!
        if (allowCurve && pendingFreeArcEnd && draftPoints.length >= 1) {
          const a = draftPoints[draftPoints.length - 1];
          const b = pendingFreeArcEnd;
          const chord = Math.hypot(b.x - a.x, b.y - a.y);
          const nx = chord > 1e-4 ? -(b.y - a.y) / chord : 0;
          const ny = chord > 1e-4 ? (b.x - a.x) / chord : -1;
          const midX = (a.x + b.x) * 0.5;
          const midY = (a.y + b.y) * 0.5;
          const bowPt = snapPoint(gridPt, e.altKey ? "free" : snapMode);
          const rawSag = (bowPt.x - midX) * nx + (bowPt.y - midY) * ny;
          const snappedSag = snapWallSegmentSagitta(chord, rawSag, e.shiftKey);
          const finalVal = Math.abs(snappedSag) >= 0.04 ? snappedSag : null;
          const closesStart =
            draftPoints.length >= 2 &&
            Math.hypot(b.x - draftPoints[0].x, b.y - draftPoints[0].y) <= 0.15;
          if (closesStart) {
            commitDraft(true, [...draftSegmentCurves, finalVal]);
            return;
          }
          setDraftPoints((prev) => [...prev, b]);
          setDraftSegmentCurves((prev) => [...prev, finalVal]);
          setPendingFreeArcEnd(null);
          return;
        }

        const anchor = draftPoints.length > 0 ? draftPoints[draftPoints.length - 1] : undefined;
        const nextPt = anchor && e.shiftKey ? constrainAngle45Deg(anchor, snapped) : snapped;

        if (draftPoints.length === 0) {
          setDraftPoints([nextPt]);
          setDraftSegmentCurves([]);
          setPendingFreeArcEnd(null);
          return;
        }

        const firstPt = draftPoints[0];
        const hitsStart = Math.hypot(nextPt.x - firstPt.x, nextPt.y - firstPt.y) <= 0.65;

        if (allowCurve && st.terrainPolygonCurved) {
          const endCorner = hitsStart && draftPoints.length >= 2 ? firstPt : nextPt;
          if (Math.hypot(endCorner.x - anchor!.x, endCorner.y - anchor!.y) < 0.2) return;
          setPendingFreeArcEnd(endCorner);
          return;
        }

        if (draftPoints.length >= 3 && hitsStart) {
          commitDraft(true, [...draftSegmentCurves, null]);
          return;
        }
        setDraftPoints((prev) => [...prev, nextPt]);
        setDraftSegmentCurves((prev) => [...prev, null]);
        return;
      }

      dragRef.current = {
        mode: "terrain",
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        camStartX: 0,
        camStartY: 0,
        objStartX: 0,
        objStartY: 0,
        vertexIndex: -1,
        origPoints: [],
        hasMoved: false,
        terrainPoints: [gridPt],
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      bumpRender();
      return;
    }

    if (activeTool === "cave") {
      // 0. Check direct-manipulation Width / Fade / Slide handles on currently selected Cave Entrance!
      const entHandle = hitSelectedEntranceHandle(e.clientX, e.clientY);
      if (entHandle) {
        dragRef.current = {
          mode:
            entHandle.kind === "fade"
              ? "cave_entrance_fade"
              : entHandle.kind === "width"
                ? "cave_entrance_width"
                : "cave_entrance_move",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: entHandle.ent.x,
          objStartY: entHandle.ent.y,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      if (st.caveDrawMode === "entrance") {
        const caveLyr = doc.layers.find(
          (l) =>
            l.kind === "caves" &&
            l.visible &&
            !l.locked &&
            l.levelId === doc.activeLevelId &&
            l.caveSystem &&
            l.caveSystem.operations.length > 0,
        );
        if (!caveLyr?.caveSystem) {
          st.pushToast("Paint a cave or dungeon chamber first, then click its wall to add an entrance", "warning");
          return;
        }
        // Check if clicking an existing entrance to select & slide it along the perimeter
        const existingHit = caveLyr.caveSystem.entrances.find(
          (ent) => Math.hypot(gridPt.x - ent.x, gridPt.y - ent.y) <= Math.max(0.95, ent.widthCells * 0.45),
        );
        if (existingHit) {
          st.setSelection({ kind: "cave_entrance", layerId: caveLyr.id, id: existingHit.id });
          dragRef.current = {
            mode: "cave_entrance_move",
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            camStartX: 0,
            camStartY: 0,
            objStartX: existingHit.x,
            objStartY: existingHit.y,
            vertexIndex: -1,
            origPoints: [],
            hasMoved: false,
            terrainPoints: [],
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          return;
        }

        const geom = computeCaveGeometry(
          caveLyr.caveSystem,
          doc.canvas.widthCells,
          doc.canvas.heightCells,
          caveLyr.id,
        );
        const snap = snapEntranceToCavePerimeter(gridPt, geom, 3.2);
        if (!snap) {
          st.pushToast("Click closer to a cave or dungeon wall to punch an Entrance / Exit", "warning");
          return;
        }
        st.addCaveEntrance({
          id: `ent-${Date.now()}`,
          x: snap.x,
          y: snap.y,
          normalRad: snap.normalRad,
          widthCells: st.caveEntranceWidthCells,
          fadeLengthCells: st.caveEntranceFadeCells,
          thresholdStyle: st.caveEntranceThreshold,
          markerLabel: st.caveEntranceMarkerLabel,
          showMarker: st.caveEntranceShowMarker,
          markerDmOnly: st.caveEntranceDmOnly,
        });
        st.pushToast("Opened Cave / Dungeon Entrance with fade-to-terrain", "success");
        return;
      }

      if (st.caveDrawMode === "dungeon_rect") {
        dragRef.current = {
          mode: "cave_rect",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
          rectStart: snapped,
          rectEnd: snapped,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      if (st.caveDrawMode === "polygon") {
        if (draftPoints.length >= 3) {
          const firstPt = draftPoints[0];
          if (Math.hypot(snapped.x - firstPt.x, snapped.y - firstPt.y) <= 0.65) {
            commitDraft(true);
            return;
          }
        }
        setDraftPoints((prev) => [...prev, snapped]);
        return;
      }

      // Shift+Drag in Erase mode (or Alt+Shift+Drag in Cave Brush) carves a crisp rectangular column/notch!
      const isHoldErase = st.caveDrawMode === "cave_brush" && e.altKey;
      if ((st.caveDrawMode === "erase" || isHoldErase) && e.shiftKey) {
        dragRef.current = {
          mode: "cave_erase_rect",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
          rectStart: snapped,
          rectEnd: snapped,
          caveEraseHold: isHoldErase,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      // Cave Brush (Hold Alt = momentary Carve-Back Eraser!) or Carve-Back Eraser
      dragRef.current = {
        mode: "cave_brush",
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        camStartX: 0,
        camStartY: 0,
        objStartX: 0,
        objStartY: 0,
        vertexIndex: -1,
        origPoints: [],
        hasMoved: false,
        terrainPoints: [gridPt],
        caveEraseHold: isHoldErase,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      bumpRender();
      return;
    }

    if (activeTool === "measure") {
      setMeasurePts({ a: snapped, b: snapped });
      dragRef.current.mode = "measure";
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (activeTool === "water") {
      if (st.selection) {
        st.setSelection(null);
      }
      if (st.waterDrawMode === "lake_brush" || st.waterDrawMode === "erase") {
        const isHoldErase = st.waterDrawMode === "lake_brush" && e.altKey;
        const isEraseNow = st.waterDrawMode === "erase" || isHoldErase;
        const paintLayerId = isEraseNow ? "" : st.ensureActiveWaterLayer();
        const curDoc = useDocumentStore.getState().getActiveDoc();
        const activeWaterLayers = curDoc.layers
          .filter(
            (l) =>
              l.kind === "water" &&
              l.visible &&
              !l.locked &&
              l.levelId === curDoc.activeLevelId,
          )
          .map((l) => ({ id: l.id, waterRegions: [...(l.waterRegions ?? [])] }));

        const paintLayerObj = curDoc.layers.find((l) => l.id === paintLayerId);
        const liveSession = createLiveWaterSculptSession({
          mode: isEraseNow ? "erase" : "paint",
          meshSameLayer: paintLayerObj?.waterMeshEnabled !== false,
          radiusCells: st.waterBrushRadiusCells,
          organicRoughness: st.waterOrganicRoughness,
          seed: Math.floor(Math.random() * 99999),
          canvasW: curDoc.canvas.widthCells,
          canvasH: curDoc.canvas.heightCells,
          layers: activeWaterLayers,
          paintLayerId,
          paintStyle: {
            kind: st.waterKind,
            presetId: st.waterPresetId,
            textureAssetId: st.waterTextureAssetId,
            deepColorHex: st.waterDeepColorHex,
            shallowColorHex: st.waterShallowColorHex,
            rimColorHex: st.waterRimColorHex,
            opacity: st.waterOpacity,
            rippleIntensity: st.waterRippleIntensity,
            causticsIntensity: st.waterCausticsIntensity,
            depthFeather: st.waterDepthFeather,
            shoreBankIntensity: st.waterShoreBankIntensity,
          },
        });

        // Apply initial dab immediately so single clicks & drag starts sculpt live!
        const firstStep = stepLiveWaterSculptSession(liveSession, [gridPt]);
        if (firstStep.changed) {
          st.checkpointHistory();
          liveSession.hasRecordedHistory = true;
          const touchedId = Array.from(firstStep.updates.keys())[0] ?? paintLayerId;
          st.applyLiveWaterRegions(firstStep.updates, touchedId || undefined);
        }

        dragRef.current = {
          mode: "water_brush",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [gridPt],
          caveEraseHold: isHoldErase,
          liveWaterSession: liveSession,
          lastWaterSentIdx: 1,
          lastWaterSculptMs: performance.now(),
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }
      if (st.waterDrawMode === "polygon" && draftPoints.length >= 3) {
        const firstPt = draftPoints[0];
        if (Math.hypot(snapped.x - firstPt.x, snapped.y - firstPt.y) <= 0.65) {
          commitDraft(true);
          return;
        }
      }
      setDraftPoints((prev) => [...prev, snapped]);
      return;
    }

    if (activeTool === "roof") {
      if (st.roofDrawMode === "auto_room") {
        const autoFit = computeAutoRoomRoof(doc, gridPt, st.roofOverhangCells);
        if (!autoFit) {
          st.pushToast(
            "Click inside an enclosed walled building to Auto-Roof (works on ROOF level over floor below too!)",
            "warning",
          );
          return;
        }
        const draftRoof = buildDraftRoof(autoFit.points, autoFit.widthCells);
        st.addRoof({
          ...draftRoof,
          id: `roof-${Date.now()}`,
        });
        const label = assetLookup.get(draftRoof.assetId)?.displayName ?? "Roof";
        st.pushToast(
          `Auto-Roofed building (${autoFit.areaSq.toFixed(0)} sq) with ${label}`,
          "success",
        );
        return;
      }

      if (st.roofDrawMode === "box") {
        dragRef.current = {
          mode: "roof_box",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
          rectStart: snapped,
          rectEnd: snapped,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      if (st.roofDrawMode === "cone") {
        dragRef.current = {
          mode: "roof_cone",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
          rectStart: snapped,
          rectEnd: snapped,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      // Default: Ridge Path (works just like Path tool — click ridge vertices, Double-click / Enter / Right-click to finish)
      setDraftPoints((prev) => [...prev, snapped]);
      return;
    }

    if (activeTool === "wall") {
      if (st.wallDrawMode === "split") {
        const hit = findWallCutHit(gridPt, doc.layers, doc.activeLevelId, 0.75);
        if (!hit) {
          st.pushToast("Hover directly over a wall on this floor to split or carve a breach", "info");
          return;
        }
        if (st.wallSplitSubMode === "breach") {
          st.breachWallAt(hit.layerId, hit.wall.id, hit.arcLength, st.wallBreachWidthCells);
        } else {
          st.splitWallAt(hit.layerId, hit.wall.id, hit.arcLength);
        }
        return;
      }

      if (st.wallDrawMode === "box") {
        const startPt = resolveWallPoint(gridPt, e.altKey).point;
        dragRef.current = {
          mode: "wall_box",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
          rectStart: startPt,
          rectEnd: startPt,
          boxSquare: e.shiftKey,
          boxFromCenter: e.ctrlKey || e.metaKey,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      if (st.wallDrawMode === "circle") {
        const centerPt = resolveWallPoint(gridPt, e.altKey).point;
        dragRef.current = {
          mode: "wall_circle",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
          rectStart: centerPt,
          rectEnd: centerPt,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      if (st.wallDrawMode === "arc") {
        if (draftPoints.length === 0) {
          const p0 = resolveWallPoint(gridPt, e.altKey).point;
          setDraftPoints([p0]);
          return;
        }
        if (draftPoints.length === 1) {
          const p1 = resolveWallPoint(gridPt, e.altKey, draftPoints[0], e.shiftKey).point;
          if (Math.hypot(p1.x - draftPoints[0].x, p1.y - draftPoints[0].y) < 0.25) return;
          setDraftPoints([draftPoints[0], p1]);
          return;
        }
        // Step 3: Commit exact 3-Point Arc Wall!
        const bulgePt = snapPoint(gridPt, e.altKey ? "free" : snapMode);
        const arc = buildThreePointArcWallPoints(draftPoints[0], draftPoints[1], bulgePt, {
          snapArcPreset: e.shiftKey,
        });
        setDraftPoints([]);
        if (arc) {
          const wallAsset = st.activeWallAssetId || "walls/grunderzeit_brick_wall.png";
          st.addWall({
            id: `warc-${Date.now()}`,
            assetId: wallAsset,
            points: arc.points,
            closed: false,
            curved: arc.curved,
            thicknessCells: st.wallThicknessCells,
            blocksLight: st.wallBlocksLight,
            recolor: st.toolRecolors.wall.enabled ? { ...st.toolRecolors.wall } : undefined,
          });
          const label = assetLookup.get(wallAsset)?.displayName ?? "Arc Wall";
          st.pushToast(
            arc.sweepDeg > 0 ? `Built ${arc.sweepDeg}° Arc Wall (${label})` : `Built Wall (${label})`,
            "success",
          );
        }
        return;
      }

      // Free Wall (1) with per-segment mixed Straight & Curved Arc support, OR Corridor Path (6):
      if (st.wallDrawMode === "free") {
        // Step B of a Curved Free-Wall section: lock the bow sagitta!
        if (pendingFreeArcEnd && draftPoints.length >= 1) {
          const a = draftPoints[draftPoints.length - 1];
          const b = pendingFreeArcEnd;
          const chord = Math.hypot(b.x - a.x, b.y - a.y);
          const nx = chord > 1e-4 ? -(b.y - a.y) / chord : 0;
          const ny = chord > 1e-4 ? (b.x - a.x) / chord : -1;
          const midX = (a.x + b.x) * 0.5;
          const midY = (a.y + b.y) * 0.5;
          const bowPt = snapPoint(gridPt, e.altKey ? "free" : snapMode);
          const rawSag = (bowPt.x - midX) * nx + (bowPt.y - midY) * ny;
          const snappedSag = snapWallSegmentSagitta(chord, rawSag, e.shiftKey);
          const finalVal = Math.abs(snappedSag) >= 0.04 ? snappedSag : null;

          // Check if this curved section closed cleanly back onto the starting corner!
          const closesStart =
            draftPoints.length >= 2 &&
            Math.hypot(b.x - draftPoints[0].x, b.y - draftPoints[0].y) <= 0.15;
          if (closesStart) {
            const nextCurves = [...draftSegmentCurves, finalVal];
            commitDraft(true, nextCurves);
            return;
          }
          setDraftPoints((prev) => [...prev, b]);
          setDraftSegmentCurves((prev) => [...prev, finalVal]);
          setPendingFreeArcEnd(null);
          return;
        }

        const anchor = draftPoints.length > 0 ? draftPoints[draftPoints.length - 1] : undefined;
        const nextPt = resolveWallPoint(gridPt, e.altKey, anchor, e.shiftKey).point;

        if (draftPoints.length === 0) {
          setDraftPoints([nextPt]);
          setDraftSegmentCurves([]);
          setPendingFreeArcEnd(null);
          return;
        }

        const firstPt = draftPoints[0];
        const hitsStart = Math.hypot(nextPt.x - firstPt.x, nextPt.y - firstPt.y) <= 0.65;

        if (st.wallCurved) {
          // Curved Next Section: lock end corner first, then pull live circular bow!
          const endCorner = hitsStart && draftPoints.length >= 2 ? firstPt : nextPt;
          if (Math.hypot(endCorner.x - anchor!.x, endCorner.y - anchor!.y) < 0.25) return;
          setPendingFreeArcEnd(endCorner);
          return;
        }

        if (draftPoints.length >= 3 && hitsStart) {
          commitDraft(true, [...draftSegmentCurves, null]);
          return;
        }
        setDraftPoints((prev) => [...prev, nextPt]);
        setDraftSegmentCurves((prev) => [...prev, null]);
        return;
      }

      // Corridor Path (6): magnetic snap + Shift 45° angle lock!
      const anchor = draftPoints.length > 0 ? draftPoints[draftPoints.length - 1] : undefined;
      const nextPt = resolveWallPoint(gridPt, e.altKey, anchor, e.shiftKey).point;
      setDraftPoints((prev) => [...prev, nextPt]);
      return;
    }

    if (activeTool === "path") {
      // Step B of a Curved Line/Path section: lock the bow sagitta!
      if (pendingFreeArcEnd && draftPoints.length >= 1) {
        const a = draftPoints[draftPoints.length - 1];
        const b = pendingFreeArcEnd;
        const chord = Math.hypot(b.x - a.x, b.y - a.y);
        const nx = chord > 1e-4 ? -(b.y - a.y) / chord : 0;
        const ny = chord > 1e-4 ? (b.x - a.x) / chord : -1;
        const midX = (a.x + b.x) * 0.5;
        const midY = (a.y + b.y) * 0.5;
        const bowPt = snapPoint(gridPt, e.altKey ? "free" : snapMode);
        const rawSag = (bowPt.x - midX) * nx + (bowPt.y - midY) * ny;
        const snappedSag = snapWallSegmentSagitta(chord, rawSag, e.shiftKey);
        const finalVal = Math.abs(snappedSag) >= 0.04 ? snappedSag : null;
        setDraftPoints((prev) => [...prev, b]);
        setDraftSegmentCurves((prev) => [...prev, finalVal]);
        setPendingFreeArcEnd(null);
        return;
      }

      const anchor = draftPoints.length > 0 ? draftPoints[draftPoints.length - 1] : undefined;
      const nextPt =
        anchor && e.shiftKey ? constrainAngle45Deg(anchor, snapped) : snapped;

      if (draftPoints.length === 0) {
        setDraftPoints([nextPt]);
        setDraftSegmentCurves([]);
        setPendingFreeArcEnd(null);
        return;
      }

      if (st.pathCurved) {
        if (Math.hypot(nextPt.x - anchor!.x, nextPt.y - anchor!.y) < 0.2) return;
        setPendingFreeArcEnd(nextPt);
        return;
      }

      setDraftPoints((prev) => [...prev, nextPt]);
      setDraftSegmentCurves((prev) => [...prev, null]);
      return;
    }

    if (activeTool === "scatter") {
      if (draftPoints.length >= 3) {
        const firstPt = draftPoints[0];
        if (Math.hypot(snapped.x - firstPt.x, snapped.y - firstPt.y) <= 0.65) {
          commitDraft(true);
          return;
        }
      }
      setDraftPoints((prev) => [...prev, snapped]);
      return;
    }

    if (activeTool === "portal") {
      const allWalls = doc.layers.flatMap((l) => {
        if (!l.visible) return [];
        const out = [...(l.walls ?? [])];
        if (l.kind === "caves" && l.caveSystem && l.caveSystem.operations.length > 0) {
          out.push(
            ...computeCaveGeometry(l.caveSystem, doc.canvas.widthCells, doc.canvas.heightCells, l.id)
              .wallSegments,
          );
        }
        return out;
      });
      const snap = findNearestWallSnap(gridPt, allWalls, 1.5);
      const portalAsset = st.activePortalAssetId || "portals/jugendstil_brass_door.png";
      const kind: PortalNode["kind"] = portalAsset.includes("gate")
        ? "gate"
        : portalAsset.includes("window")
          ? "window"
          : portalAsset.includes("hatch")
            ? "hatch"
            : "door";
      st.addPortal({
        id: `portal-${Date.now()}`,
        assetId: portalAsset,
        kind,
        wallId: snap?.wallId,
        x: snap ? snap.x : snapped.x,
        y: snap ? snap.y : snapped.y,
        rotationRad: snap ? snap.rotationRad : 0,
        widthCells: st.activePortalWidthCells,
        closed: st.activePortalClosed,
        locked: false,
        blocksLightWhenClosed: kind !== "window",
        swingInvert: st.activePortalSwingInvert,
        hingeFlip: st.activePortalHingeFlip,
        recolor: st.toolRecolors.portal.enabled ? { ...st.toolRecolors.portal } : undefined,
      });
      const label = assetLookup.get(portalAsset)?.displayName ?? "Portal";
      st.pushToast(snap ? `Inset ${label} into wall` : `Placed ${label}`, "success");
      return;
    }

    if (activeTool === "stamp") {
      const placeStampAt = (
        pt: Point2D,
        recordHist: boolean,
        dragDirRad?: number,
        varyFromLastId?: string | null,
      ): string | null => {
        const cur = useDocumentStore.getState();
        const curDoc = cur.getActiveDoc();
        const vaultState = useVaultStore.getState();
        let chosenId =
          vaultState.selectedAssetId ||
          (curDoc.mode === "world"
            ? "world-atlas/mountains/hero_alpine_massif_peak.png"
            : "objects/funicular_car_interior.png");
        let asset = assetLookup.get(chosenId);

        // World Atlas species-aware Multi-Variant Paint-In: cycle strictly within the exact
        // species family (`set_*` tag or Wonderdraft parent folder) + same drawMode without repeats!
        if (
          curDoc.mode === "world" &&
          cur.stampPaintDrag &&
          cur.worldSymbolMultiVariant &&
          asset?.category === "symbol" &&
          varyFromLastId !== undefined
        ) {
          const family = findWorldSymbolFamilyVariants(asset, vaultState.assets);
          if (family.variants.length > 1) {
            const picked = pickNextWorldVariant(family.variants, varyFromLastId);
            chosenId = picked.id;
            asset = picked;
          }
        }

        // World Atlas smart land check: skip open ocean when Avoid Water is ON for land symbols!
        if (
          curDoc.mode === "world" &&
          curDoc.world &&
          cur.worldSymbolAvoidWater &&
          asset?.worldGroup &&
          asset.worldGroup !== "maritime" &&
          asset.worldGroup !== "cartography"
        ) {
          if (!isPointOnLand(curDoc.world, pt, curDoc.canvas.widthCells, curDoc.canvas.heightCells)) {
            if (!cur.stampPaintDrag) {
              cur.pushToast("Avoid Water is ON — click on land or toggle off in Inspector", "info");
            }
            return null;
          }
        }

        const jitterScale = cur.stampRandomJitter ? 0.85 + Math.random() * 0.3 : 1;
        let rot = cur.stampRotationRad;
        if (cur.stampAutoRotate && cur.stampRotateMode === "follow" && dragDirRad !== undefined) {
          rot = dragDirRad;
        }
        const flipX = cur.stampRandomFlipX ? Math.random() < 0.5 : cur.stampFlipX;
        const wCells =
          ((asset?.widthPx ?? 256) / (asset?.defaultPpi ?? 256)) * cur.stampScale * jitterScale;
        const hCells =
          ((asset?.heightPx ?? 256) / (asset?.defaultPpi ?? 256)) * cur.stampScale * jitterScale;

        // Wonderdraft `sample_color` automatic ground biome color tinting!
        let recolor = applyStampColorJitter(cur.activeRecolor, cur.stampColorJitter);
        if (
          curDoc.mode === "world" &&
          curDoc.world &&
          cur.worldSymbolSampleBiome &&
          asset?.drawMode === "sample_color" &&
          !cur.activeRecolor.enabled
        ) {
          const sampledHex = sampleWorldBiomeColor(curDoc.world, pt);
          recolor = {
            ...recolor,
            enabled: true,
            mode: "tint",
            tintHex: sampledHex,
            strength: 0.82,
          };
        }

        cur.addObjectStamp(
          {
            id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            assetId: chosenId,
            x: pt.x,
            y: pt.y,
            widthCells: Math.max(0.16, wCells),
            heightCells: Math.max(0.16, hCells),
            rotationRad: rot,
            flipX,
            flipY: false,
            opacity: 1,
            castsShadow: curDoc.mode === "world" ? true : (asset?.castsShadow ?? true),
            locked: false,
            recolor,
            zOrder: 30,
          },
          recordHist,
        );
        // Advance preview angle automatically for next stamp/paint dab!
        if (cur.stampAutoRotate) {
          if (cur.stampRotateMode === "random") {
            const spreadRad = (cur.stampRotateSpreadDeg * Math.PI) / 180;
            const nextRot =
              cur.stampRotateSpreadDeg >= 178
                ? Math.random() * Math.PI * 2
                : (Math.random() * 2 - 1) * spreadRad;
            cur.setBrushParams({ stampRotationRad: nextRot });
          } else if (cur.stampRotateMode === "step") {
            const stepRad = (cur.stampRotateStepDeg * Math.PI) / 180;
            cur.setBrushParams({
              stampRotationRad: (cur.stampRotationRad + stepRad) % (Math.PI * 2),
            });
          } else if (cur.stampRotateMode === "follow" && dragDirRad !== undefined) {
            cur.setBrushParams({ stampRotationRad: dragDirRad });
          }
        }
        return chosenId;
      };

      if (st.stampPaintDrag) {
        // Single Undo checkpoint for the entire painted brushstroke!
        st.checkpointHistory();
        // Dab #1 places the currently selected symbol (matching cursor ghost), and subsequent dabs cycle sibling variants!
        const firstId = placeStampAt(snapped, false);
        dragRef.current = {
          mode: "stamp_paint",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: 0,
          objStartY: 0,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
          lastStampPt: snapped,
          lastVariantAssetId: firstId ?? undefined,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
      } else {
        placeStampAt(snapped, true);
      }
      return;
    }

    if (activeTool === "template") {
      if (st.activeTemplateId) {
        st.stampObjectTemplateAt(snapped.x, snapped.y);
      } else {
        st.pushToast("Pick a premade object group in the Templates panel first!", "info");
      }
      return;
    }

    if (activeTool === "light") {
      // 1. Check Radius Resize / Spotlight Aim handles on currently selected light first
      const ltHandle = hitSelectedLightHandle(e.clientX, e.clientY);
      if (ltHandle) {
        dragRef.current = {
          mode:
            ltHandle.kind === "aim"
              ? "light_aim"
              : ltHandle.kind === "cone"
                ? "light_cone"
                : "light_radius",
          startScreenX: e.clientX,
          startScreenY: e.clientY,
          camStartX: 0,
          camStartY: 0,
          objStartX: ltHandle.light.x,
          objStartY: ltHandle.light.y,
          vertexIndex: -1,
          origPoints: [],
          hasMoved: false,
          terrainPoints: [],
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        bumpRender();
        return;
      }

      // 2. Lights-first smart selection: clicking an existing light badge selects & immediately drags it!
      //    (Hold Shift+Click to force-place a new light near an existing bulb.)
      if (!e.shiftKey) {
        const hitLt = hitLightNodeScreen(e.clientX, e.clientY);
        if (hitLt) {
          st.setSelection({ kind: "light", layerId: hitLt.layerId, id: hitLt.id });
          dragRef.current = {
            mode: "move",
            startScreenX: e.clientX,
            startScreenY: e.clientY,
            camStartX: 0,
            camStartY: 0,
            objStartX: hitLt.item.x,
            objStartY: hitLt.item.y,
            vertexIndex: -1,
            origPoints: [],
            hasMoved: false,
            terrainPoints: [],
          };
          e.currentTarget.setPointerCapture(e.pointerId);
          bumpRender();
          return;
        }
      }

      // 3. Clicked open space -> place a new 2D raycast light & select it immediately (and allow drag to fine-tune!)
      const existingCount = doc.layers
        .filter((l) => l.levelId === doc.activeLevelId)
        .reduce((acc, l) => acc + (l.lights?.length ?? 0), 0);
      const newId = `lt-${Date.now()}`;
      st.addLight({
        id: newId,
        name: `Map Light #${existingCount + 1}`,
        x: snapped.x,
        y: snapped.y,
        radiusCells: st.activeLightRadiusCells,
        intensity: st.activeLightIntensity,
        colorHex: st.activeLightColorHex,
        castShadows: st.activeLightCastShadows,
        coneAngleDeg: st.activeLightConeDeg,
        directionRad: 0,
        flicker: false,
      });
      dragRef.current = {
        mode: "move",
        startScreenX: e.clientX,
        startScreenY: e.clientY,
        camStartX: 0,
        camStartY: 0,
        objStartX: snapped.x,
        objStartY: snapped.y,
        vertexIndex: -1,
        origPoints: [],
        hasMoved: true, // Already recorded by addLight — live drag adjusts newly placed light cleanly!
        terrainPoints: [],
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      st.pushToast("Placed 2D raycast light — drag to adjust or click any bulb to move", "success");
      return;
    }

    if (activeTool === "dm_note") {
      st.addDmNote({
        id: `dm-${Date.now()}`,
        x: snapped.x,
        y: snapped.y,
        badge: "NOTE",
        title: "DM Encounter Note",
        body: "Double-click or inspect in Properties to edit secret details.",
        colorHex: "#F59E0B",
      });
      st.pushToast("Pinned DM-Only Note", "success");
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const gridPt = screenToGrid(e.clientX, e.clientY);
    const now = performance.now();
    if (now - lastCursorUpdateRef.current > 90) {
      lastCursorUpdateRef.current = now;
      useDocumentStore.getState().setCursorGridPos({
        x: Math.round(gridPt.x * 10) / 10,
        y: Math.round(gridPt.y * 10) / 10,
      });
    }

    const needsHoverGhost =
      draftPoints.length > 0 ||
      activeTool === "stamp" ||
      activeTool === "template" ||
      activeTool === "terrain" ||
      activeTool === "cave" ||
      activeTool === "water" ||
      activeTool === "wall" ||
      activeTool === "roof" ||
      activeTool === "portal" ||
      activeTool === "light" ||
      activeTool === "world_land" ||
      activeTool === "world_biome" ||
      activeTool === "world_label" ||
      activeTool === "world_crop";
    if (needsHoverGhost) {
      scheduleHoverGrid(gridPt);
    }

    const drag = dragRef.current;
    if (drag.mode === "pan") {
      camRef.current.x = drag.camStartX + (e.clientX - drag.startScreenX);
      camRef.current.y = drag.camStartY + (e.clientY - drag.startScreenY);
      bumpRender();
      return;
    }

    if (drag.mode === "roof_width" && selection?.kind === "roof" && drag.roofAnchor && drag.roofNormal) {
      const curDoc = useDocumentStore.getState().getActiveDoc();
      const selRoof = curDoc.layers
        .find((l) => l.id === selection.layerId)
        ?.roofs?.find((r) => r.id === selection.id);
      if (selRoof) {
        const proj = Math.max(
          0.6,
          (gridPt.x - drag.roofAnchor.x) * drag.roofNormal.x +
            (gridPt.y - drag.roofAnchor.y) * drag.roofNormal.y,
        );
        let nextW: number;
        if (selRoof.style === "shed") {
          nextW = proj;
        } else {
          const offset = Math.max(-0.4, Math.min(0.4, selRoof.ridgeOffset ?? 0));
          const sideFrac = drag.roofSide === "left" ? 0.5 + offset : 0.5 - offset;
          nextW = proj / Math.max(0.15, sideFrac);
        }
        const effectiveSnap = e.altKey ? "free" : snapMode;
        const step = effectiveSnap === "grid" ? 0.5 : effectiveSnap === "half" ? 0.25 : 0.1;
        nextW = Math.max(1.2, Math.min(24, Math.round(nextW / step) * step));
        const recordNow = !drag.hasMoved;
        drag.hasMoved = true;
        useDocumentStore
          .getState()
          .updateRoof(selection.layerId, selection.id, { widthCells: nextW }, recordNow);
        bumpRender();
      }
      return;
    }

    if (
      drag.mode === "wall_mid_pending" &&
      selection &&
      drag.wallSegIndex !== undefined
    ) {
      const distPx = Math.hypot(e.clientX - drag.startScreenX, e.clientY - drag.startScreenY);
      if (distPx < 4) return;
      if (e.shiftKey) {
        // User pressed Shift mid-drag -> curve ONLY this edge!
        drag.mode = "wall_curve";
      } else {
        // Plain drag on straight '+' handle -> insert sharp corner vertex cleanly!
        const st = useDocumentStore.getState();
        const curEnt = resolveCurveEditableEntity(st.getActiveDoc(), selection);
        if (curEnt) {
          const target = snapPoint(gridPt, e.altKey ? "free" : snapMode);
          const inserted = insertWallVertexWithCurves(curEnt, drag.wallSegIndex, target);
          patchCurveEditablePoints(st, selection, inserted.points, inserted.segmentCurves, true);
          drag.mode = "vertex";
          drag.vertexIndex = drag.wallSegIndex + 1;
          drag.origPoints = inserted.points;
          drag.hasMoved = true;
          st.pushToast("Added vertex point — Shift+Drag + to curve a section instead");
        }
        return;
      }
    }

    if (
      drag.mode === "wall_curve" &&
      selection &&
      drag.wallSegIndex !== undefined &&
      drag.wallEdgeA &&
      drag.wallEdgeB
    ) {
      const distPx = Math.hypot(e.clientX - drag.startScreenX, e.clientY - drag.startScreenY);
      if (!drag.hasMoved && distPx < 3) return;
      const a = drag.wallEdgeA;
      const b = drag.wallEdgeB;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const chord = Math.hypot(dx, dy);
      if (chord > 0.05) {
        const nx = -dy / chord;
        const ny = dx / chord;
        const midX = (a.x + b.x) * 0.5;
        const midY = (a.y + b.y) * 0.5;
        const rawSag = (gridPt.x - midX) * nx + (gridPt.y - midY) * ny;
        const nextSag = snapWallSegmentSagitta(chord, rawSag, e.shiftKey);
        const recordNow = !drag.hasMoved;
        drag.hasMoved = true;
        drag.wallLastSagitta = nextSag;
        useDocumentStore
          .getState()
          .setEntitySegmentCurve(
            selection,
            drag.wallSegIndex,
            Math.abs(nextSag) >= 0.04 ? nextSag : null,
            recordNow,
          );
        bumpRender();
      }
      return;
    }

    if (drag.mode === "vertex" && selection && drag.vertexIndex >= 0) {
      const target = snapPoint(gridPt, e.altKey ? "free" : snapMode);
      const nextPts = drag.origPoints.map((pt, idx) =>
        idx === drag.vertexIndex ? { x: target.x, y: target.y } : { ...pt },
      );
      const st = useDocumentStore.getState();
      if (selection.kind === "wall") {
        st.updateWall(selection.layerId, selection.id, { points: nextPts }, false);
      } else if (selection.kind === "water") {
        st.updateWaterRegion(selection.layerId, selection.id, { points: nextPts }, false);
      } else if (selection.kind === "roof") {
        st.updateRoof(selection.layerId, selection.id, { points: nextPts }, false);
      } else if (selection.kind === "world_river") {
        st.updateWorldRiver(selection.id, { points: nextPts }, false);
      } else if (selection.kind === "world_trail") {
        st.updateWorldTrail(selection.id, { points: nextPts }, false);
      } else if (selection.kind === "world_region") {
        st.updateWorldRegion(selection.id, { polygon: nextPts }, false);
      } else if (selection.kind === "path") {
        st.updatePath(selection.layerId, selection.id, { points: nextPts }, false);
      }
      return;
    }

    if (drag.mode === "poly_move" && selection && drag.origPoints.length > 0) {
      const distPx = Math.hypot(e.clientX - drag.startScreenX, e.clientY - drag.startScreenY);
      if (!drag.hasMoved && distPx < 5) return;
      const st = useDocumentStore.getState();
      const dxRaw = (e.clientX - drag.startScreenX) / camRef.current.cellPx;
      const dyRaw = (e.clientY - drag.startScreenY) / camRef.current.cellPx;
      const effectiveSnap = e.altKey ? "free" : snapMode;
      const step = effectiveSnap === "grid" ? 1 : effectiveSnap === "half" ? 0.5 : 0;
      const dx = step > 0 ? Math.round(dxRaw / step) * step : dxRaw;
      const dy = step > 0 ? Math.round(dyRaw / step) * step : dyRaw;
      const recordNow = !drag.hasMoved;
      drag.hasMoved = true;
      const nextPts = drag.origPoints.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
      if (selection.kind === "wall") {
        st.updateWall(selection.layerId, selection.id, { points: nextPts }, recordNow);
      } else if (selection.kind === "water") {
        st.updateWaterRegion(selection.layerId, selection.id, { points: nextPts }, recordNow);
      } else if (selection.kind === "roof") {
        st.updateRoof(selection.layerId, selection.id, { points: nextPts }, recordNow);
      } else if (selection.kind === "world_river") {
        st.updateWorldRiver(selection.id, { points: nextPts }, recordNow);
      } else if (selection.kind === "world_trail") {
        st.updateWorldTrail(selection.id, { points: nextPts }, recordNow);
      } else if (selection.kind === "world_region") {
        st.updateWorldRegion(selection.id, { polygon: nextPts }, recordNow);
      } else if (selection.kind === "path") {
        st.updatePath(selection.layerId, selection.id, { points: nextPts }, recordNow);
      }
      return;
    }

    if (drag.mode === "obj_rotate" && selection?.kind === "object") {
      const rect = canvasRef.current!.getBoundingClientRect();
      const cam = camRef.current;
      const cx = cam.x + drag.objStartX * cam.cellPx;
      const cy = cam.y + drag.objStartY * cam.cellPx;
      const rawAngle = Math.atan2(e.clientY - rect.top - cy, e.clientX - rect.left - cx) + Math.PI / 2;
      const nextAngle = e.shiftKey
        ? Math.round(rawAngle / (Math.PI / 12)) * (Math.PI / 12)
        : rawAngle;
      const st = useDocumentStore.getState();
      const recordNow = !drag.hasMoved;
      drag.hasMoved = true;
      st.updateObjectStamp(selection.layerId, selection.id, { rotationRad: nextAngle }, recordNow);
      return;
    }

    if (drag.mode === "obj_scale" && selection?.kind === "object") {
      const rect = canvasRef.current!.getBoundingClientRect();
      const cam = camRef.current;
      const cx = cam.x + drag.objStartX * cam.cellPx;
      const cy = cam.y + drag.objStartY * cam.cellPx;
      const curDistPx = Math.max(8, Math.hypot(e.clientX - rect.left - cx, e.clientY - rect.top - cy));
      const st = useDocumentStore.getState();
      const recordNow = !drag.hasMoved;
      drag.hasMoved = true;
      drag.isStretching = e.shiftKey;
      const minSize = doc.mode === "world" ? 0.16 : 0.35;
      if (e.shiftKey) {
        // Free non-uniform stretch in local rotated coordinates (Shift hotkey)
        const dx = e.clientX - rect.left - cx;
        const dy = e.clientY - rect.top - cy;
        const rot = drag.origRotation ?? 0;
        const cos = Math.cos(-rot);
        const sin = Math.sin(-rot);
        const lx = Math.abs(dx * cos - dy * sin);
        const ly = Math.abs(dx * sin + dy * cos);
        const nextW = Math.max(minSize, Math.min(24, (lx * 2) / cam.cellPx));
        const nextH = Math.max(minSize, Math.min(24, (ly * 2) / cam.cellPx));
        st.updateObjectStamp(selection.layerId, selection.id, { widthCells: nextW, heightCells: nextH }, recordNow);
      } else {
        // Strictly proportional aspect-ratio-locked scaling (uniformly clamped!)
        const origW = Math.max(0.1, drag.origWidth ?? 1);
        const origH = Math.max(0.1, drag.origHeight ?? 1);
        const rawRatio = curDistPx / Math.max(8, drag.startDistPx ?? 1);
        const minRatio = Math.max(minSize / origW, minSize / origH);
        const maxRatio = Math.min(24 / origW, 24 / origH);
        const clampedRatio = Math.max(minRatio, Math.min(maxRatio, rawRatio));
        const nextW = origW * clampedRatio;
        const nextH = origH * clampedRatio;
        st.updateObjectStamp(selection.layerId, selection.id, { widthCells: nextW, heightCells: nextH }, recordNow);
      }
      return;
    }

    if (drag.mode === "light_radius") {
      const activeSel = useDocumentStore.getState().selection;
      if (activeSel?.kind === "light") {
        const distCells = Math.hypot(gridPt.x - drag.objStartX, gridPt.y - drag.objStartY);
        const nextRadius = Math.max(1, Math.min(24, Math.round(distCells * 2) / 2));
        const recordNow = !drag.hasMoved;
        drag.hasMoved = true;
        useDocumentStore
          .getState()
          .updateLight(activeSel.layerId, activeSel.id, { radiusCells: nextRadius }, recordNow);
        bumpRender();
      }
      return;
    }

    if (drag.mode === "light_aim") {
      const activeSel = useDocumentStore.getState().selection;
      if (activeSel?.kind === "light") {
        let ang = Math.atan2(gridPt.y - drag.objStartY, gridPt.x - drag.objStartX);
        if (snapMode !== "free" && !e.altKey) {
          const step = Math.PI / 12; // 15° snap
          ang = Math.round(ang / step) * step;
        }
        const recordNow = !drag.hasMoved;
        drag.hasMoved = true;
        useDocumentStore
          .getState()
          .updateLight(activeSel.layerId, activeSel.id, { directionRad: ang }, recordNow);
        bumpRender();
      }
      return;
    }

    if (drag.mode === "light_cone") {
      const activeSel = useDocumentStore.getState().selection;
      if (activeSel?.kind === "light") {
        const curDoc = useDocumentStore.getState().getActiveDoc();
        const curLt = curDoc.layers
          .find((l) => l.id === activeSel.layerId)
          ?.lights?.find((x) => x.id === activeSel.id);
        if (curLt) {
          const ptrAngle = Math.atan2(gridPt.y - drag.objStartY, gridPt.x - drag.objStartX);
          let delta = ptrAngle - curLt.directionRad;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          let coneDeg = Math.round((Math.abs(delta) * 360) / Math.PI);
          if (snapMode !== "free" && !e.altKey) {
            coneDeg = Math.round(coneDeg / 5) * 5;
          }
          if (coneDeg >= 352) coneDeg = 360;
          coneDeg = Math.max(20, Math.min(360, coneDeg));
          const recordNow = !drag.hasMoved;
          drag.hasMoved = true;
          useDocumentStore
            .getState()
            .updateLight(activeSel.layerId, activeSel.id, { coneAngleDeg: coneDeg }, recordNow);
          bumpRender();
        }
      }
      return;
    }

    if (drag.mode === "move") {
      const activeSel = useDocumentStore.getState().selection;
      if (!activeSel) return;
      const distPx = Math.hypot(e.clientX - drag.startScreenX, e.clientY - drag.startScreenY);
      if (!drag.hasMoved && distPx < 3) return;
      const dx = (e.clientX - drag.startScreenX) / camRef.current.cellPx;
      const dy = (e.clientY - drag.startScreenY) / camRef.current.cellPx;
      const target = snapPoint(
        { x: drag.objStartX + dx, y: drag.objStartY + dy },
        e.altKey ? "free" : snapMode,
      );
      const st = useDocumentStore.getState();
      const recordNow = !drag.hasMoved;
      drag.hasMoved = true;
      if (activeSel.kind === "object") {
        st.updateObjectStamp(activeSel.layerId, activeSel.id, { x: target.x, y: target.y }, recordNow);
      } else if (activeSel.kind === "light") {
        st.updateLight(activeSel.layerId, activeSel.id, { x: target.x, y: target.y }, recordNow);
      } else if (activeSel.kind === "dm_note") {
        st.updateDmNote(activeSel.layerId, activeSel.id, { x: target.x, y: target.y }, recordNow);
      } else if (activeSel.kind === "world_label") {
        st.updateWorldLabel(activeSel.id, { x: target.x, y: target.y }, recordNow);
      } else if (activeSel.kind === "world_pin") {
        st.updateWorldSubMapPin(activeSel.id, { x: target.x, y: target.y }, recordNow);
      } else if (activeSel.kind === "portal") {
        const allWalls = doc.layers.flatMap((l) => (l.visible ? (l.walls ?? []) : []));
        const wallSnap = !e.altKey ? findNearestWallSnap(target, allWalls, 1.2) : null;
        st.updatePortal(
          activeSel.layerId,
          activeSel.id,
          wallSnap
            ? { x: wallSnap.x, y: wallSnap.y, rotationRad: wallSnap.rotationRad, wallId: wallSnap.wallId }
            : { x: target.x, y: target.y },
          recordNow,
        );
      }
      return;
    }

    // Dynamic hover cursor & tooltip feedback over Light Nodes, Light Handles, Object Handles & Vertex Handles
    if (drag.mode === "none") {
      let nextCur: string | null = null;
      let nextHoverLt: string | null = null;
      let nextHoverHandle: null | "aim" | "radius" | "cone_left" | "cone_right" | "cone_omni" =
        null;
      let nextHoverEntHandle: null | "slide" | "width_l" | "width_r" | "fade" = null;

      if (selection?.kind === "cave_entrance") {
        const eh = hitSelectedEntranceHandle(e.clientX, e.clientY);
        if (eh) {
          nextHoverEntHandle = eh.handleId;
          nextCur = eh.kind === "slide" ? "grab" : "ew-resize";
        }
      }

      if (!nextCur && areLightBadgesVisible()) {
        const lth = hitSelectedLightHandle(e.clientX, e.clientY);
        if (lth) {
          nextHoverHandle = lth.handleId;
          nextCur = lth.kind === "radius" ? "ew-resize" : "grab";
        } else {
          const hitLt = hitLightNodeScreen(e.clientX, e.clientY);
          if (hitLt) {
            nextHoverLt = hitLt.id;
            nextCur = "grab";
          }
        }
      }

      if (!nextCur && activeTool === "select") {
        const oh = hitSelectedObjectHandle(e.clientX, e.clientY);
        if (oh) {
          nextCur = oh.kind === "rotate" ? "grab" : oh.cursor;
        } else {
          const rwh = hitSelectedRoofWidthHandle(e.clientX, e.clientY);
          if (rwh) {
            nextCur = "ew-resize";
          } else {
            const ph = hitSelectedPolyHandle(e.clientX, e.clientY);
            if (ph) nextCur = "pointer";
          }
        }
      }

      if (hoverCursor !== nextCur) setHoverCursor(nextCur);
      if (hoveredLightId !== nextHoverLt) setHoveredLightId(nextHoverLt);
      if (hoveredLightHandle !== nextHoverHandle) setHoveredLightHandle(nextHoverHandle);
      if (hoveredEntranceHandle !== nextHoverEntHandle) setHoveredEntranceHandle(nextHoverEntHandle);
    } else if (hoverCursor !== null) {
      setHoverCursor(null);
    }

    if (drag.mode === "world_land") {
      const last = drag.terrainPoints[drag.terrainPoints.length - 1];
      if (!last || Math.hypot(gridPt.x - last.x, gridPt.y - last.y) > 0.22) {
        drag.terrainPoints.push(gridPt);
        const now = performance.now();
        if (now - (drag.lastWaterSculptMs ?? 0) >= 48) {
          const fromIdx = drag.lastWaterSentIdx ?? 0;
          const newPts = drag.terrainPoints.slice(fromIdx);
          if (newPts.length > 0) {
            drag.lastWaterSentIdx = drag.terrainPoints.length;
            drag.lastWaterSculptMs = now;
            const stNow = useDocumentStore.getState();
            const modeOverride: WorldLandBrushMode = drag.caveEraseHold
              ? stNow.worldLandMode === "raise"
                ? "lower"
                : "raise"
              : stNow.worldLandMode;
            stNow.sculptWorldLand(newPts, modeOverride, false);
          }
        }
        bumpRender();
      }
      return;
    }

    if (drag.mode === "world_biome") {
      const last = drag.terrainPoints[drag.terrainPoints.length - 1];
      if (!last || Math.hypot(gridPt.x - last.x, gridPt.y - last.y) > 0.24) {
        drag.terrainPoints.push(gridPt);
        bumpRender();
      }
      return;
    }

    if (drag.mode === "world_crop") {
      drag.rectEnd = gridPt;
      bumpRender();
      return;
    }

    if (drag.mode === "terrain") {
      const last = drag.terrainPoints[drag.terrainPoints.length - 1];
      if (!last || Math.hypot(gridPt.x - last.x, gridPt.y - last.y) > 0.16) {
        drag.terrainPoints.push(gridPt);
        bumpRender();
      }
      return;
    }

    if (drag.mode === "terrain_rect" || drag.mode === "cave_rect" || drag.mode === "cave_erase_rect") {
      let endPt = snapPoint(gridPt, e.altKey ? "free" : snapMode);
      if (drag.mode === "terrain_rect" && e.shiftKey && drag.rectStart) {
        const dx = endPt.x - drag.rectStart.x;
        const dy = endPt.y - drag.rectStart.y;
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        endPt = {
          x: drag.rectStart.x + (dx < 0 ? -side : side),
          y: drag.rectStart.y + (dy < 0 ? -side : side),
        };
      }
      drag.rectEnd = endPt;
      bumpRender();
      return;
    }

    if (drag.mode === "roof_box" && drag.rectStart) {
      let endPt = snapPoint(gridPt, e.altKey ? "free" : snapMode);
      if (e.shiftKey) {
        const dx = endPt.x - drag.rectStart.x;
        const dy = endPt.y - drag.rectStart.y;
        const side = Math.max(Math.abs(dx), Math.abs(dy));
        endPt = {
          x: drag.rectStart.x + (dx < 0 ? -side : side),
          y: drag.rectStart.y + (dy < 0 ? -side : side),
        };
      }
      drag.rectEnd = endPt;
      bumpRender();
      return;
    }

    if (drag.mode === "roof_cone") {
      drag.rectEnd = snapPoint(gridPt, e.altKey ? "free" : snapMode);
      bumpRender();
      return;
    }

    if (drag.mode === "wall_box" && drag.rectStart) {
      drag.rectEnd = resolveWallPoint(gridPt, e.altKey).point;
      drag.boxSquare = e.shiftKey;
      drag.boxFromCenter = e.ctrlKey || e.metaKey;
      bumpRender();
      return;
    }

    if (drag.mode === "wall_circle") {
      drag.rectEnd = resolveWallPoint(gridPt, e.altKey).point;
      bumpRender();
      return;
    }

    if (drag.mode === "cave_entrance_width") {
      const activeSel = useDocumentStore.getState().selection;
      if (activeSel?.kind === "cave_entrance") {
        const curDoc = useDocumentStore.getState().getActiveDoc();
        const ent = curDoc.layers
          .find((l) => l.id === activeSel.layerId)
          ?.caveSystem?.entrances?.find((x) => x.id === activeSel.id);
        if (ent) {
          const tx = -Math.sin(ent.normalRad);
          const ty = Math.cos(ent.normalRad);
          const halfProj = Math.abs((gridPt.x - ent.x) * tx + (gridPt.y - ent.y) * ty);
          const nextW = Math.max(1.0, Math.min(6.0, Math.round(halfProj * 2 * 5) / 5));
          const recordNow = !drag.hasMoved;
          drag.hasMoved = true;
          useDocumentStore
            .getState()
            .updateCaveEntrance(activeSel.layerId, activeSel.id, { widthCells: nextW }, recordNow);
          bumpRender();
        }
      }
      return;
    }

    if (drag.mode === "cave_entrance_fade") {
      const activeSel = useDocumentStore.getState().selection;
      if (activeSel?.kind === "cave_entrance") {
        const curDoc = useDocumentStore.getState().getActiveDoc();
        const ent = curDoc.layers
          .find((l) => l.id === activeSel.layerId)
          ?.caveSystem?.entrances?.find((x) => x.id === activeSel.id);
        if (ent) {
          const nx = Math.cos(ent.normalRad);
          const ny = Math.sin(ent.normalRad);
          const proj = (gridPt.x - ent.x) * nx + (gridPt.y - ent.y) * ny;
          const nextFade = Math.max(0.5, Math.min(5.5, Math.round(proj * 4) / 4));
          const recordNow = !drag.hasMoved;
          drag.hasMoved = true;
          useDocumentStore
            .getState()
            .updateCaveEntrance(
              activeSel.layerId,
              activeSel.id,
              { fadeLengthCells: nextFade },
              recordNow,
            );
          bumpRender();
        }
      }
      return;
    }

    if (drag.mode === "cave_brush" || drag.mode === "water_brush") {
      const last = drag.terrainPoints[drag.terrainPoints.length - 1];
      if (!last || Math.hypot(gridPt.x - last.x, gridPt.y - last.y) > 0.2) {
        drag.terrainPoints.push(gridPt);
        if (drag.mode === "water_brush" && drag.liveWaterSession) {
          const now = performance.now();
          if (now - (drag.lastWaterSculptMs ?? 0) >= 36) {
            const fromIdx = drag.lastWaterSentIdx ?? 0;
            const newPts = drag.terrainPoints.slice(fromIdx);
            if (newPts.length > 0) {
              drag.lastWaterSentIdx = drag.terrainPoints.length;
              drag.lastWaterSculptMs = now;
              const sess = drag.liveWaterSession;
              const res = stepLiveWaterSculptSession(sess, newPts);
              if (res.changed) {
                const stNow = useDocumentStore.getState();
                if (!sess.hasRecordedHistory) {
                  stNow.checkpointHistory();
                  sess.hasRecordedHistory = true;
                }
                const touchedId =
                  Array.from(res.updates.keys())[0] ?? sess.paintLayerId;
                stNow.applyLiveWaterRegions(res.updates, touchedId || undefined);
              }
            }
          }
        }
        bumpRender();
      }
      return;
    }

    if (drag.mode === "cave_entrance_move") {
      const activeSel = useDocumentStore.getState().selection;
      if (activeSel?.kind === "cave_entrance") {
        const curDoc = useDocumentStore.getState().getActiveDoc();
        const lyr = curDoc.layers.find((l) => l.id === activeSel.layerId);
        if (lyr?.caveSystem) {
          const geom = computeCaveGeometry(
            lyr.caveSystem,
            curDoc.canvas.widthCells,
            curDoc.canvas.heightCells,
            lyr.id,
          );
          const snap = snapEntranceToCavePerimeter(gridPt, geom, 3.5);
          if (snap) {
            const recordNow = !drag.hasMoved;
            drag.hasMoved = true;
            useDocumentStore
              .getState()
              .updateCaveEntrance(
                activeSel.layerId,
                activeSel.id,
                { x: snap.x, y: snap.y, normalRad: snap.normalRad },
                recordNow,
              );
          }
        }
      }
      return;
    }

    if (drag.mode === "stamp_paint" && drag.lastStampPt) {
      const cur = useDocumentStore.getState();
      const curDoc = cur.getActiveDoc();
      const targetPt = snapPoint(gridPt, e.altKey ? "free" : snapMode);
      const dist = Math.hypot(targetPt.x - drag.lastStampPt.x, targetPt.y - drag.lastStampPt.y);
      if (dist >= Math.max(0.35, cur.stampPaintSpacingCells)) {
        const dragDirRad = Math.atan2(
          targetPt.y - drag.lastStampPt.y,
          targetPt.x - drag.lastStampPt.x,
        );
        const vaultState = useVaultStore.getState();
        let chosenId =
          vaultState.selectedAssetId ||
          (curDoc.mode === "world"
            ? "world-atlas/mountains/hero_alpine_massif_peak.png"
            : "objects/funicular_car_interior.png");
        let asset = assetLookup.get(chosenId);

        // Species-aware non-repeating sibling cycling across the exact tree/mountain/settlement family!
        if (
          curDoc.mode === "world" &&
          cur.worldSymbolMultiVariant &&
          asset?.category === "symbol"
        ) {
          const family = findWorldSymbolFamilyVariants(asset, vaultState.assets);
          if (family.variants.length > 1) {
            const picked = pickNextWorldVariant(family.variants, drag.lastVariantAssetId ?? null);
            chosenId = picked.id;
            asset = picked;
          }
        }

        // Respect Avoid Ocean / Water on every painted dab along the brushstroke!
        if (
          curDoc.mode === "world" &&
          curDoc.world &&
          cur.worldSymbolAvoidWater &&
          asset?.worldGroup &&
          asset.worldGroup !== "maritime" &&
          asset.worldGroup !== "cartography" &&
          !isPointOnLand(curDoc.world, targetPt, curDoc.canvas.widthCells, curDoc.canvas.heightCells)
        ) {
          drag.lastStampPt = targetPt;
          return;
        }

        const jitterScale = cur.stampRandomJitter ? 0.85 + Math.random() * 0.3 : 1;
        let rot = cur.stampRotationRad;
        if (cur.stampAutoRotate && cur.stampRotateMode === "follow") {
          rot = dragDirRad;
        }
        const flipX = cur.stampRandomFlipX ? Math.random() < 0.5 : cur.stampFlipX;
        const wCells =
          ((asset?.widthPx ?? 256) / (asset?.defaultPpi ?? 256)) * cur.stampScale * jitterScale;
        const hCells =
          ((asset?.heightPx ?? 256) / (asset?.defaultPpi ?? 256)) * cur.stampScale * jitterScale;

        // Wonderdraft `sample_color` automatic ground biome sampling per painted stamp!
        let recolor = applyStampColorJitter(cur.activeRecolor, cur.stampColorJitter);
        if (
          curDoc.mode === "world" &&
          curDoc.world &&
          cur.worldSymbolSampleBiome &&
          asset?.drawMode === "sample_color" &&
          !cur.activeRecolor.enabled
        ) {
          const sampledHex = sampleWorldBiomeColor(curDoc.world, targetPt);
          recolor = {
            ...recolor,
            enabled: true,
            mode: "tint",
            tintHex: sampledHex,
            strength: 0.82,
          };
        }

        cur.addObjectStamp(
          {
            id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            assetId: chosenId,
            x: targetPt.x,
            y: targetPt.y,
            widthCells: Math.max(0.16, wCells),
            heightCells: Math.max(0.16, hCells),
            rotationRad: rot,
            flipX,
            flipY: false,
            opacity: 1,
            castsShadow: curDoc.mode === "world" ? true : (asset?.castsShadow ?? true),
            locked: false,
            recolor,
            zOrder: 30,
          },
          false,
        );
        if (cur.stampAutoRotate) {
          if (cur.stampRotateMode === "random") {
            const spreadRad = (cur.stampRotateSpreadDeg * Math.PI) / 180;
            const nextRot =
              cur.stampRotateSpreadDeg >= 178
                ? Math.random() * Math.PI * 2
                : (Math.random() * 2 - 1) * spreadRad;
            cur.setBrushParams({ stampRotationRad: nextRot });
          } else if (cur.stampRotateMode === "step") {
            const stepRad = (cur.stampRotateStepDeg * Math.PI) / 180;
            cur.setBrushParams({
              stampRotationRad: (cur.stampRotationRad + stepRad) % (Math.PI * 2),
            });
          } else if (cur.stampRotateMode === "follow") {
            cur.setBrushParams({ stampRotationRad: dragDirRad });
          }
        }
        drag.lastStampPt = targetPt;
        drag.lastVariantAssetId = chosenId;
      }
      return;
    }

    if (drag.mode === "measure" && measurePts) {
      setMeasurePts({ a: measurePts.a, b: snapPoint(gridPt, snapMode) });
    }
  };

  const handlePointerUp = () => {
    const drag = dragRef.current;
    if (drag.mode === "world_land" && drag.terrainPoints.length > 0) {
      const fromIdx = drag.lastWaterSentIdx ?? 0;
      const remaining = drag.terrainPoints.slice(fromIdx);
      if (remaining.length > 0) {
        const stNow = useDocumentStore.getState();
        const modeOverride: WorldLandBrushMode = drag.caveEraseHold
          ? stNow.worldLandMode === "raise"
            ? "lower"
            : "raise"
          : stNow.worldLandMode;
        stNow.sculptWorldLand(remaining, modeOverride, false);
      }
    } else if (drag.mode === "world_biome" && drag.terrainPoints.length > 0) {
      const st = useDocumentStore.getState();
      st.addWorldBiomeStroke({
        id: `wb-${Date.now()}`,
        points: [...drag.terrainPoints],
        radiusCells: st.worldBiomeRadiusCells,
        colorHex: st.worldBiomeColorHex,
        opacity: st.worldBiomeOpacity,
        softness: st.worldBiomeSoftness,
        roughness: st.worldBiomeRoughness,
        seed: Math.floor(Math.random() * 99999),
        target: st.worldBiomeTarget,
        pattern: st.worldBiomePattern,
      });
    } else if (drag.mode === "world_crop" && drag.rectStart && drag.rectEnd) {
      const rw = Math.abs(drag.rectEnd.x - drag.rectStart.x);
      const rh = Math.abs(drag.rectEnd.y - drag.rectStart.y);
      if (rw >= 2.0 && rh >= 1.5) {
        const st = useDocumentStore.getState();
        const curDoc = st.getActiveDoc();
        st.createDetailWorldMap(
          {
            x0: Math.min(drag.rectStart.x, drag.rectEnd.x),
            y0: Math.min(drag.rectStart.y, drag.rectEnd.y),
            x1: Math.max(drag.rectStart.x, drag.rectEnd.x),
            y1: Math.max(drag.rectStart.y, drag.rectEnd.y),
          },
          `${curDoc.meta.title} — Region`,
        );
      } else {
        useDocumentStore.getState().pushToast("Drag a wider box (2+ sq) to create a Regional Detail Atlas", "info");
      }
    } else if (drag.mode === "terrain" && drag.terrainPoints.length > 0) {
      const st = useDocumentStore.getState();
      const isEraseBrush = st.terrainMode === "erase";
      const terrainAsset = st.activeTerrainAssetId || "terrain/berlin_wet_cobble.png";
      st.addTerrainStroke({
        id: `${isEraseBrush ? "terase-br" : "ts"}-${Date.now()}`,
        assetId: terrainAsset,
        points: [...drag.terrainPoints],
        radiusCells: st.brushRadiusCells,
        opacity: st.brushOpacity,
        softness: st.brushSoftness,
        continuous: true,
        erase: isEraseBrush || undefined,
        rotationDeg: isEraseBrush ? undefined : st.terrainRotationDeg || undefined,
        slopeShade: isEraseBrush
          ? undefined
          : st.terrainSlopeShade > 0.02
            ? st.terrainSlopeShade
            : undefined,
        textureScale: isEraseBrush
          ? undefined
          : Math.abs(st.terrainTextureScale - 1) > 0.01
            ? st.terrainTextureScale
            : undefined,
        recolor:
          !isEraseBrush && st.toolRecolors.terrain.enabled
            ? { ...st.toolRecolors.terrain }
            : undefined,
      });
    } else if (drag.mode === "terrain_rect" && drag.rectStart && drag.rectEnd) {
      const rw = Math.abs(drag.rectEnd.x - drag.rectStart.x);
      const rh = Math.abs(drag.rectEnd.y - drag.rectStart.y);
      if (rw >= 0.25 && rh >= 0.25) {
        const st = useDocumentStore.getState();
        const isEraseRect = st.terrainMode === "erase";
        const terrainAsset = st.activeTerrainAssetId || "terrain/berlin_wet_cobble.png";
        st.addTerrainStroke({
          id: `${isEraseRect ? "terase-rect" : "trect"}-${Date.now()}`,
          assetId: terrainAsset,
          points: makeRectPolygon(drag.rectStart, drag.rectEnd),
          radiusCells: 0,
          opacity: st.brushOpacity,
          softness: st.terrainFillSoftness,
          shape: "polygon",
          erase: isEraseRect || undefined,
          rotationDeg: isEraseRect ? undefined : st.terrainRotationDeg || undefined,
          slopeShade: isEraseRect
            ? undefined
            : st.terrainSlopeShade > 0.02
              ? st.terrainSlopeShade
              : undefined,
          textureScale: isEraseRect
            ? undefined
            : Math.abs(st.terrainTextureScale - 1) > 0.01
              ? st.terrainTextureScale
              : undefined,
          recolor:
            !isEraseRect && st.toolRecolors.terrain.enabled
              ? { ...st.toolRecolors.terrain }
              : undefined,
        });
        if (isEraseRect) {
          st.pushToast(`Erased ${rw.toFixed(1)} × ${rh.toFixed(1)} sq cutout on active layer`, "success");
        } else {
          const label = assetLookup.get(terrainAsset)?.displayName ?? "Terrain";
          st.pushToast(
            `Filled ${rw.toFixed(1)} × ${rh.toFixed(1)} sq with ${label}`,
            "success",
          );
        }
      }
    } else if (drag.mode === "water_brush" && drag.terrainPoints.length > 0) {
      const st = useDocumentStore.getState();
      const sess = drag.liveWaterSession;
      if (sess) {
        const fromIdx = drag.lastWaterSentIdx ?? 0;
        const remaining = drag.terrainPoints.slice(fromIdx);
        if (remaining.length > 0) {
          const res = stepLiveWaterSculptSession(sess, remaining);
          if (res.changed) {
            if (!sess.hasRecordedHistory) {
              st.checkpointHistory();
              sess.hasRecordedHistory = true;
            }
            const touchedId =
              Array.from(res.updates.keys())[0] ?? sess.paintLayerId;
            st.applyLiveWaterRegions(res.updates, touchedId || undefined);
          }
        }
        st.setSelection(null);
        if (sess.mode === "erase") {
          if (!sess.didMutate) {
            st.pushToast("Drag across existing water to carve an island or trim coastline", "info");
          } else if (sess.removedCount > 0 && sess.updatedCount === 0) {
            st.pushToast("Erased water body cleanly", "success");
          } else {
            st.pushToast("Carved dry island / reshaped shoreline", "success");
          }
        } else if (sess.didMutate) {
          st.pushToast(
            sess.mergedIntoExisting
              ? "Merged brush stroke smoothly into water body"
              : "Painted organic water body",
            "success",
          );
        }
      } else {
        const isErase = st.waterDrawMode === "erase" || Boolean(drag.caveEraseHold);
        if (isErase) {
          st.eraseWaterBrush(drag.terrainPoints);
        } else {
          st.paintWaterBrush(drag.terrainPoints);
        }
      }
    } else if (drag.mode === "cave_brush" && drag.terrainPoints.length > 0) {
      const st = useDocumentStore.getState();
      const isErase = st.caveDrawMode === "erase" || Boolean(drag.caveEraseHold);
      st.addCaveOperation({
        id: `cave-br-${Date.now()}`,
        kind: isErase ? "erase_brush" : "brush",
        points: [...drag.terrainPoints],
        radiusCells: st.caveBrushRadiusCells,
        organicRoughness: st.caveRoughness,
        seed: Math.floor(Math.random() * 99999),
      });
    } else if (drag.mode === "cave_rect" && drag.rectStart && drag.rectEnd) {
      const rw = Math.abs(drag.rectEnd.x - drag.rectStart.x);
      const rh = Math.abs(drag.rectEnd.y - drag.rectStart.y);
      if (rw >= 0.5 && rh >= 0.5) {
        const st = useDocumentStore.getState();
        st.addCaveOperation({
          id: `cave-rect-${Date.now()}`,
          kind: "rect",
          points: [{ ...drag.rectStart }, { ...drag.rectEnd }],
          organicRoughness: 0,
          seed: Math.floor(Math.random() * 99999),
        });
        st.pushToast(`Added ${rw.toFixed(1)} × ${rh.toFixed(1)} sq Dungeon Room (auto-merged)`, "success");
      }
    } else if (drag.mode === "cave_erase_rect" && drag.rectStart && drag.rectEnd) {
      const rw = Math.abs(drag.rectEnd.x - drag.rectStart.x);
      const rh = Math.abs(drag.rectEnd.y - drag.rectStart.y);
      if (rw >= 0.4 && rh >= 0.4) {
        const st = useDocumentStore.getState();
        st.addCaveOperation({
          id: `cave-erect-${Date.now()}`,
          kind: "erase_rect",
          points: [{ ...drag.rectStart }, { ...drag.rectEnd }],
          organicRoughness: 0,
          seed: Math.floor(Math.random() * 99999),
        });
        st.pushToast(`Carved ${rw.toFixed(1)} × ${rh.toFixed(1)} sq rectangular pillar / notch`, "success");
      }
    } else if (drag.mode === "roof_box" && drag.rectStart && drag.rectEnd) {
      const st = useDocumentStore.getState();
      const boxParams = buildBoxRoofParams(
        drag.rectStart,
        drag.rectEnd,
        st.roofOverhangCells,
        st.roofRotateBoxRidge,
      );
      if (boxParams) {
        const draftRoof = buildDraftRoof(boxParams.points, boxParams.widthCells);
        st.addRoof({
          ...draftRoof,
          id: `roof-${Date.now()}`,
        });
        const label = assetLookup.get(draftRoof.assetId)?.displayName ?? "Roof";
        const rw = Math.abs(drag.rectEnd.x - drag.rectStart.x);
        const rh = Math.abs(drag.rectEnd.y - drag.rectStart.y);
        st.pushToast(
          `Built ${rw.toFixed(1)} × ${rh.toFixed(1)} sq ${draftRoof.style} roof (${label})`,
          "success",
        );
      }
    } else if (drag.mode === "roof_cone" && drag.rectStart && drag.rectEnd) {
      const radius = Math.hypot(
        drag.rectEnd.x - drag.rectStart.x,
        drag.rectEnd.y - drag.rectStart.y,
      );
      if (radius >= 0.55) {
        const st = useDocumentStore.getState();
        const draftRoof = buildDraftRoof(
          [{ ...drag.rectStart }, { ...drag.rectEnd }],
          Math.max(1.2, radius * 2),
          "cone",
        );
        st.addRoof({
          ...draftRoof,
          id: `roof-${Date.now()}`,
        });
        const label = assetLookup.get(draftRoof.assetId)?.displayName ?? "Turret Roof";
        st.pushToast(
          `Built Turret / Dome roof (R ${radius.toFixed(1)} sq · ${label})`,
          "success",
        );
      }
    } else if (drag.mode === "wall_box" && drag.rectStart && drag.rectEnd) {
      const st = useDocumentStore.getState();
      const box = buildBoxWallPoints(drag.rectStart, drag.rectEnd, {
        square: drag.boxSquare,
        fromCenter: drag.boxFromCenter,
        rotationDeg: st.wallBoxRotationDeg,
      });
      if (box) {
        const wallAsset = st.activeWallAssetId || "walls/grunderzeit_brick_wall.png";
        st.addWall({
          id: `wbox-${Date.now()}`,
          assetId: wallAsset,
          points: box.points,
          closed: true,
          curved: false,
          thicknessCells: st.wallThicknessCells,
          blocksLight: st.wallBlocksLight,
          recolor: st.toolRecolors.wall.enabled ? { ...st.toolRecolors.wall } : undefined,
        });
        const label = assetLookup.get(wallAsset)?.displayName ?? "Wall";
        st.pushToast(
          `Built ${box.width.toFixed(1)} × ${box.height.toFixed(1)} sq Box Room (${label})`,
          "success",
        );
      }
    } else if (drag.mode === "wall_circle" && drag.rectStart && drag.rectEnd) {
      const st = useDocumentStore.getState();
      const snapStep = shiftDown ? (st.snapMode === "grid" ? 1 : 0.5) : 0;
      const circ = buildCircleOrPolygonWallPoints(
        drag.rectStart,
        drag.rectEnd,
        st.wallPolygonShape,
        {
          rotationDeg: st.wallBoxRotationDeg,
          snapRadiusStep: snapStep,
        },
      );
      if (circ) {
        const wallAsset = st.activeWallAssetId || "walls/grunderzeit_brick_wall.png";
        st.addWall({
          id: `wcirc-${Date.now()}`,
          assetId: wallAsset,
          points: circ.points,
          closed: true,
          curved: circ.curved,
          thicknessCells: st.wallThicknessCells,
          blocksLight: st.wallBlocksLight,
          recolor: st.toolRecolors.wall.enabled ? { ...st.toolRecolors.wall } : undefined,
        });
        const shapeLbl =
          st.wallPolygonShape === "round"
            ? "Round Tower"
            : st.wallPolygonShape === "oval"
              ? "Oval Room"
              : st.wallPolygonShape === "hex"
                ? "Hexagon Tower"
                : st.wallPolygonShape === "octagon"
                  ? "Octagon Tower"
                  : "12-gon Tower";
        st.pushToast(
          `Built ${shapeLbl} (R ${circ.radiusX.toFixed(1)} sq)`,
          "success",
        );
      }
    }
    dragRef.current.mode = "none";
    dragRef.current.wallSegIndex = undefined;
    dragRef.current.wallEdgeA = undefined;
    dragRef.current.wallEdgeB = undefined;
    dragRef.current.wallLastSagitta = undefined;
    dragRef.current.boxSquare = undefined;
    dragRef.current.boxFromCenter = undefined;
    dragRef.current.liveWaterSession = undefined;
    dragRef.current.terrainPoints = [];
    dragRef.current.rectStart = undefined;
    dragRef.current.rectEnd = undefined;
    dragRef.current.lastStampPt = undefined;
    dragRef.current.roofAnchor = undefined;
    dragRef.current.roofNormal = undefined;
    dragRef.current.roofSide = undefined;
    bumpRender();
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draftPoints.length >= 2) {
      const curSt = useDocumentStore.getState();
      commitDraft(
        activeTool === "water" ||
          activeTool === "scatter" ||
          activeTool === "world_region" ||
          (activeTool === "terrain" &&
            (curSt.terrainMode === "polygon" ||
              (curSt.terrainMode === "erase" && curSt.terrainEraseShape === "polygon"))) ||
          (activeTool === "cave" && curSt.caveDrawMode === "polygon"),
      );
      return;
    }
    if (activeTool === "select" && selection) {
      const handleHit = hitSelectedPolyHandle(e.clientX, e.clientY);
      if (handleHit?.kind === "wall_edge") {
        const st = useDocumentStore.getState();
        st.setSelectedWallSegmentIndex(handleHit.segIndex);
        const nowCurved = st.toggleEntitySegmentCurve(selection, handleHit.segIndex, "90");
        const noun = (handleHit.curveEnt?.noun ?? "section").toLowerCase();
        st.pushToast(
          nowCurved
            ? `Curved ${noun} #${handleHit.segIndex + 1} (90° arch) — drag purple handle to reshape`
            : `Straightened ${noun} #${handleHit.segIndex + 1}`,
          "success",
        );
        return;
      }
    }
    const gridPt = screenToGrid(e.clientX, e.clientY);
    const visibleLightHit = areLightBadgesVisible()
      ? hitLightNodeScreen(e.clientX, e.clientY)
      : null;
    const hit = visibleLightHit ?? hitTestGrid(gridPt, activeTool !== "light");
    if (hit?.kind === "world_pin") {
      const st = useDocumentStore.getState();
      if (hit.item.targetDocId && st.documents.some((d) => d.id === hit.item.targetDocId)) {
        st.switchDocument(hit.item.targetDocId);
        st.pushToast(`Jumped to "${hit.item.label}"`, "success");
      } else if (hit.item.targetKind === "battlemap") {
        st.switchToBattlemapMode();
        st.pushToast(`Opened Battlemap for "${hit.item.label}"`, "info");
      }
      return;
    }
    if (hit?.kind === "portal") {
      useDocumentStore.getState().togglePortalClosed(hit.layerId, hit.id);
      useDocumentStore
        .getState()
        .pushToast(hit.item.closed ? "Opened portal (light passes through)" : "Closed portal (blocks sight & light)");
    }
  };

  // Non-passive native wheel listener so Alt+Wheel / Ctrl+Wheel never trigger browser page zoom!
  const lastWheelCheckpointRef = useRef(0);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      // On Windows Chrome/Edge/Tauri, Shift+Wheel converts deltaY into deltaX!
      const primaryDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(primaryDelta) < 0.01) return;
      const st = useDocumentStore.getState();
      const stepDir = primaryDelta < 0 ? 1 : -1;
      const isScaleMod = e.altKey || e.ctrlKey || e.metaKey;
      const rotStep = st.snapMode === "free" ? Math.PI / 36 : Math.PI / 12; // 5° free vs 15° snap
      const shouldRecordWheelUndo = () => {
        const now = Date.now();
        if (now - lastWheelCheckpointRef.current > 650) {
          lastWheelCheckpointRef.current = now;
          return true;
        }
        return false;
      };

      // 1. Scale / Resize before placing (Alt+Wheel or Ctrl+Wheel) across ALL tools!
      if (isScaleMod) {
        if (st.activeTool === "world_land") {
          const next = Math.max(0.5, Math.min(8.5, Math.round((st.worldLandRadiusCells + stepDir * 0.35) * 100) / 100));
          st.setBrushParams({ worldLandRadiusCells: next });
          return;
        }
        if (st.activeTool === "world_biome") {
          const next = Math.max(0.8, Math.min(10.0, Math.round((st.worldBiomeRadiusCells + stepDir * 0.4) * 100) / 100));
          st.setBrushParams({ worldBiomeRadiusCells: next });
          return;
        }
        if (st.activeTool === "world_label") {
          const next = Math.max(8, Math.min(48, Math.round(st.worldLabelFontSize + stepDir * 2)));
          st.setBrushParams({ worldLabelFontSize: next });
          return;
        }
        if (st.activeTool === "stamp") {
          const next = Math.max(0.25, Math.min(4.0, Math.round((st.stampScale + stepDir * 0.1) * 100) / 100));
          st.setBrushParams({ stampScale: next });
          return;
        }
        if (st.activeTool === "template") {
          const next = Math.max(0.35, Math.min(3.0, Math.round((st.templateScale + stepDir * 0.1) * 100) / 100));
          st.setTemplateTransform({ scale: next });
          return;
        }
        if (st.activeTool === "terrain") {
          const next = Math.max(0.5, Math.min(8.0, Math.round((st.brushRadiusCells + stepDir * 0.25) * 100) / 100));
          st.setBrushParams({ brushRadiusCells: next });
          return;
        }
        if (st.activeTool === "water") {
          if (st.waterDrawMode === "river_path") {
            const next = Math.max(0.75, Math.min(8.0, Math.round((st.waterRiverWidthCells + stepDir * 0.25) * 100) / 100));
            st.setBrushParams({ waterRiverWidthCells: next });
          } else {
            const next = Math.max(0.65, Math.min(6.0, Math.round((st.waterBrushRadiusCells + stepDir * 0.25) * 100) / 100));
            st.setBrushParams({ waterBrushRadiusCells: next });
          }
          return;
        }
        if (st.activeTool === "cave") {
          if (st.caveDrawMode === "entrance") {
            const next = Math.max(1.0, Math.min(6.0, Math.round((st.caveEntranceWidthCells + stepDir * 0.25) * 100) / 100));
            st.setBrushParams({ caveEntranceWidthCells: next });
          } else {
            const next = Math.max(0.75, Math.min(6.0, Math.round((st.caveBrushRadiusCells + stepDir * 0.25) * 100) / 100));
            st.setBrushParams({ caveBrushRadiusCells: next });
          }
          return;
        }
        if (st.activeTool === "wall") {
          if (st.wallDrawMode === "split" && st.wallSplitSubMode === "breach") {
            const next = Math.max(0.6, Math.min(6.0, Math.round((st.wallBreachWidthCells + stepDir * 0.25) * 100) / 100));
            st.setBrushParams({ wallBreachWidthCells: next });
          } else if (st.wallDrawMode === "corridor") {
            const next = Math.max(1.0, Math.min(6.0, Math.round((st.wallCorridorWidthCells + stepDir * 0.25) * 100) / 100));
            st.setBrushParams({ wallCorridorWidthCells: next });
          } else {
            const next = Math.max(0.16, Math.min(0.85, Math.round((st.wallThicknessCells + stepDir * 0.04) * 100) / 100));
            st.setBrushParams({ wallThicknessCells: next });
          }
          return;
        }
        if (st.activeTool === "path") {
          const next = Math.max(0.3, Math.min(10.0, Math.round((st.pathWidthCells + stepDir * 0.25) * 100) / 100));
          st.setBrushParams({ pathWidthCells: next });
          return;
        }
        if (st.activeTool === "roof") {
          const next = Math.max(1.2, Math.min(20.0, Math.round((st.roofWidthCells + stepDir * 0.5) * 100) / 100));
          st.setBrushParams({ roofWidthCells: next });
          return;
        }
        if (st.activeTool === "portal") {
          const next = Math.max(0.8, Math.min(3.5, Math.round((st.activePortalWidthCells + stepDir * 0.15) * 100) / 100));
          st.setBrushParams({ activePortalWidthCells: next });
          return;
        }
        if (st.activeTool === "light") {
          const next = Math.max(2.0, Math.min(20.0, Math.round((st.activeLightRadiusCells + stepDir * 0.5) * 10) / 10));
          st.setBrushParams({ activeLightRadiusCells: next });
          return;
        }
        // In Select mode: scale selected Object or Light radius smoothly!
        if (st.selection) {
          const curDoc = st.getActiveDoc();
          const lyr = curDoc.layers.find((l) => l.id === st.selection!.layerId);
          if (st.selection.kind === "object") {
            const obj = lyr?.objects?.find((o) => o.id === st.selection!.id);
            if (obj) {
              const rawFactor = stepDir > 0 ? 1.08 : 1 / 1.08;
              const minFactor = Math.max(0.35 / Math.max(0.1, obj.widthCells), 0.35 / Math.max(0.1, obj.heightCells));
              const maxFactor = Math.min(24 / Math.max(0.1, obj.widthCells), 24 / Math.max(0.1, obj.heightCells));
              const factor = Math.max(minFactor, Math.min(maxFactor, rawFactor));
              const nextW = obj.widthCells * factor;
              const nextH = obj.heightCells * factor;
              st.updateObjectStamp(
                st.selection.layerId,
                st.selection.id,
                {
                  widthCells: nextW,
                  heightCells: nextH,
                },
                shouldRecordWheelUndo(),
              );
              return;
            }
          } else if (st.selection.kind === "light") {
            const lt = lyr?.lights?.find((x) => x.id === st.selection!.id);
            if (lt) {
              st.updateLight(
                st.selection.layerId,
                st.selection.id,
                {
                  radiusCells: Math.max(1.5, Math.min(24, lt.radiusCells + stepDir * 0.5)),
                },
                shouldRecordWheelUndo(),
              );
              return;
            }
          } else if (st.selection.kind === "roof") {
            const rf = lyr?.roofs?.find((x) => x.id === st.selection!.id);
            if (rf) {
              if (rf.style === "cone" && rf.points.length >= 2) {
                const c = rf.points[0];
                const rim = rf.points[1];
                const curR = Math.max(0.6, Math.hypot(rim.x - c.x, rim.y - c.y));
                const nextR = Math.max(0.6, Math.min(12, curR + stepDir * 0.25));
                const scale = nextR / curR;
                const nextRim = { x: c.x + (rim.x - c.x) * scale, y: c.y + (rim.y - c.y) * scale };
                st.updateRoof(
                  st.selection.layerId,
                  st.selection.id,
                  { points: [c, nextRim], widthCells: nextR * 2 },
                  shouldRecordWheelUndo(),
                );
              } else {
                st.updateRoof(
                  st.selection.layerId,
                  st.selection.id,
                  { widthCells: Math.max(1.2, Math.min(24, rf.widthCells + stepDir * 0.5)) },
                  shouldRecordWheelUndo(),
                );
              }
              return;
            }
          }
        }
      }

      // 2. Shift + Wheel rotates Stamp preview, Roof Sun Angle, World Label Angle, Selected Prop, Selected Roof Sun Angle, or Selected Light!
      if (e.shiftKey) {
        if (st.activeTool === "world_label") {
          const nextDeg = Math.max(-90, Math.min(90, Math.round(st.worldLabelRotationDeg + stepDir * 5)));
          st.setBrushParams({ worldLabelRotationDeg: nextDeg });
          return;
        }
        if (st.activeTool === "stamp") {
          st.setBrushParams({ stampRotationRad: st.stampRotationRad - stepDir * rotStep });
          return;
        }
        if (st.activeTool === "template") {
          st.setTemplateTransform({ rotationRad: st.templateRotationRad - stepDir * rotStep });
          return;
        }
        if (st.activeTool === "wall" && (st.wallDrawMode === "box" || st.wallDrawMode === "circle")) {
          const nextDeg = (st.wallBoxRotationDeg + stepDir * 15 + 360) % 360;
          st.setBrushParams({ wallBoxRotationDeg: nextDeg });
          return;
        }
        if (st.activeTool === "roof") {
          const nextDeg = (st.roofSunAngleDeg + stepDir * 15 + 360) % 360;
          st.setBrushParams({ roofSunAngleDeg: nextDeg });
          return;
        }
        if (st.selection) {
          const curDoc = st.getActiveDoc();
          const lyr = curDoc.layers.find((l) => l.id === st.selection!.layerId);
          if (st.selection.kind === "object") {
            const obj = lyr?.objects?.find((o) => o.id === st.selection!.id);
            if (obj) {
              st.updateObjectStamp(
                st.selection.layerId,
                st.selection.id,
                {
                  rotationRad: obj.rotationRad - stepDir * rotStep,
                },
                shouldRecordWheelUndo(),
              );
              return;
            }
          } else if (st.selection.kind === "light") {
            const lt = lyr?.lights?.find((x) => x.id === st.selection!.id);
            if (lt) {
              st.updateLight(
                st.selection.layerId,
                st.selection.id,
                {
                  directionRad: lt.directionRad - stepDir * rotStep,
                },
                shouldRecordWheelUndo(),
              );
              return;
            }
          } else if (st.selection.kind === "roof") {
            const rf = lyr?.roofs?.find((x) => x.id === st.selection!.id);
            if (rf) {
              const nextDeg = (rf.sunAngleDeg + stepDir * 15 + 360) % 360;
              st.updateRoof(
                st.selection.layerId,
                st.selection.id,
                { sunAngleDeg: nextDeg },
                shouldRecordWheelUndo(),
              );
              return;
            }
          }
        }
      }

      // 3. Plain Scroll Wheel: smooth cursor-centered canvas zoom (up to 1600% for ultra-fine cartography!)
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const dir = stepDir * (st.preferences.invertZoom ? -1 : 1);
      const factor = Math.pow(1.14, dir * st.preferences.wheelZoomSpeed);
      const oldCell = camRef.current.cellPx;
      const maxCell = st.getActiveDoc().mode === "world" ? 512 : 256;
      const nextCell = Math.max(8, Math.min(maxCell, oldCell * factor));
      const scale = nextCell / oldCell;

      camRef.current.x = mx - (mx - camRef.current.x) * scale;
      camRef.current.y = my - (my - camRef.current.y) * scale;
      camRef.current.cellPx = nextCell;

      // Throttle Zustand zoom readout during fast wheel bursts to avoid unnecessary React tree re-renders
      const nowMs = performance.now();
      if (nowMs - lastZoomSyncMsRef.current >= 80) {
        lastZoomSyncMsRef.current = nowMs;
        st.setZoomPercent(Math.round((nextCell / 32) * 100));
      }

      // Smooth <= 60 FPS transform blit during active wheel inertia, then sharpen 1:1 Hi-DPI on settle!
      wheelZoomingRef.current = true;
      if (wheelSettleTimerRef.current !== null) {
        window.clearTimeout(wheelSettleTimerRef.current);
      }
      wheelSettleTimerRef.current = window.setTimeout(() => {
        wheelZoomingRef.current = false;
        wheelSettleTimerRef.current = null;
        useDocumentStore
          .getState()
          .setZoomPercent(Math.round((camRef.current.cellPx / 32) * 100));
        bumpRender();
      }, 140);
      bumpRender();
    };

    el.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onNativeWheel);
      if (wheelSettleTimerRef.current !== null) {
        window.clearTimeout(wheelSettleTimerRef.current);
        wheelSettleTimerRef.current = null;
      }
    };
  }, [bumpRender]);

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const gridPt = screenToGrid(e.clientX, e.clientY);
    const snapped = snapPoint(gridPt, snapMode);
    const st = useDocumentStore.getState();

    // Active polyline drawing right-click menu
    if (draftPoints.length > 0) {
      const finishLabel =
        activeTool === "roof"
          ? "Finish Roof"
          : activeTool === "water"
            ? "Finish Water"
            : activeTool === "world_river"
              ? "Finish River"
              : activeTool === "world_trail"
                ? "Finish Trail"
                : activeTool === "world_region"
                  ? "Finish Political Region"
                  : "Finish Path / Wall";
      onOpenContextMenu(e.clientX, e.clientY, "Drawing Actions", [
        {
          type: "item",
          id: "finish-open",
          label: finishLabel,
          shortcut: "Enter",
          disabled: draftPoints.length < 2,
          onSelect: () => commitDraft(false),
        },
        ...(activeTool !== "roof"
          ? [
              {
                type: "item" as const,
                id: "finish-closed",
                label: "Close Loop & Finish",
                disabled: draftPoints.length < 3,
                onSelect: () => commitDraft(true),
              },
            ]
          : []),
        {
          type: "item",
          id: "undo-pt",
          label: pendingFreeArcEnd ? "Cancel Curved Section Bow" : "Remove Last Control Point",
          onSelect: () => {
            if (pendingFreeArcEnd) {
              setPendingFreeArcEnd(null);
            } else {
              setDraftPoints((p) => p.slice(0, -1));
              setDraftSegmentCurves((c) => c.slice(0, -1));
            }
          },
        },
        { type: "separator" },
        {
          type: "item",
          id: "cancel-draft",
          label: "Cancel Drawing",
          shortcut: "Esc",
          danger: true,
          onSelect: () => {
            setDraftPoints([]);
            setDraftSegmentCurves([]);
            setPendingFreeArcEnd(null);
          },
        },
      ]);
      return;
    }

    const visibleLightHit = areLightBadgesVisible()
      ? hitLightNodeScreen(e.clientX, e.clientY)
      : null;
    const hit = visibleLightHit ?? hitTestGrid(gridPt, activeTool !== "light");
    if (hit) {
      st.setSelection({ kind: hit.kind, layerId: hit.layerId, id: hit.id });

      if (hit.kind === "object") {
        const objectLayers = doc.layers.filter((l) => l.kind === "objects");
        onOpenContextMenu(e.clientX, e.clientY, "Prop Actions", [
          {
            type: "item",
            id: "dup-obj",
            label: "Duplicate Prop",
            shortcut: "Ctrl+D",
            onSelect: () => st.duplicateSelection(),
          },
          {
            type: "item",
            id: "copy-obj",
            label: "Copy Prop",
            shortcut: "Ctrl+C",
            onSelect: () => st.copySelection(),
          },
          {
            type: "item",
            id: "save-cluster-tpl",
            label: "Save Nearby Group as Template…",
            onSelect: () => {
              const name = window.prompt("Save nearby objects (3.5 sq radius) as a Template:");
              if (!name) return;
              st.saveCustomObjectTemplate({
                name,
                category: "saved",
                scope: "cluster",
                radiusCells: 3.5,
              });
            },
          },
          { type: "separator" },
          {
            type: "item",
            id: "rot-cw",
            label: "Rotate 45° Clockwise",
            shortcut: "E",
            onSelect: () => st.transformSelectedObject("rotCW"),
          },
          {
            type: "item",
            id: "rot-ccw",
            label: "Rotate 45° Counter-Clockwise",
            shortcut: "Q",
            onSelect: () => st.transformSelectedObject("rotCCW"),
          },
          {
            type: "item",
            id: "flip-x",
            label: "Flip Horizontal",
            shortcut: "X",
            checked: hit.item.flipX,
            onSelect: () => st.transformSelectedObject("flipX"),
          },
          {
            type: "item",
            id: "flip-y",
            label: "Flip Vertical",
            shortcut: "Y",
            checked: hit.item.flipY,
            onSelect: () => st.transformSelectedObject("flipY"),
          },
          { type: "separator" },
          {
            type: "item",
            id: "z-front",
            label: "Bring to Front",
            onSelect: () => st.transformSelectedObject("front"),
          },
          {
            type: "item",
            id: "z-back",
            label: "Send to Back",
            onSelect: () => st.transformSelectedObject("back"),
          },
          {
            type: "submenu",
            id: "move-layer",
            label: "Move to Layer",
            items: objectLayers.map((l) => ({
              id: `mv-${l.id}`,
              label: l.name,
              checked: l.id === hit.layerId,
              onSelect: () => st.moveSelectionToLayer(l.id),
            })),
          },
          { type: "separator" },
          {
            type: "item",
            id: "copy-tint",
            label: "Copy RGB Shader Tint",
            onSelect: () => st.copySelectedRecolor(),
          },
          {
            type: "item",
            id: "paste-tint",
            label: "Paste RGB Shader Tint",
            disabled: !st.copiedRecolor,
            onSelect: () => st.pasteRecolorToSelected(),
          },
          {
            type: "item",
            id: "toggle-shadow",
            label: "Casts Drop Shadow",
            checked: hit.item.castsShadow,
            onSelect: () => st.transformSelectedObject("toggleShadow"),
          },
          { type: "separator" },
          {
            type: "item",
            id: "del-obj",
            label: "Delete Prop",
            shortcut: "Del",
            danger: true,
            onSelect: () => st.deleteSelection(),
          },
        ]);
        return;
      }

      if (hit.kind === "wall") {
        const handleHit = hitSelectedPolyHandle(e.clientX, e.clientY);
        const edgeHit = distanceToWall(gridPt, hit.item);
        const segCount = getWallSegmentCount(hit.item.points, hit.item.closed);
        const clickedSegIdx =
          handleHit?.kind === "wall_edge"
            ? handleHit.segIndex
            : edgeHit.segmentIndex >= 0 && edgeHit.segmentIndex < segCount
              ? edgeHit.segmentIndex
              : 0;
        st.setSelectedWallSegmentIndex(clickedSegIdx);

        const effCurves = convertLegacyWallCurveToSegments(hit.item);
        const segSag = effCurves[clickedSegIdx] ?? 0;
        const segIsCurved = Math.abs(segSag) >= 0.04;
        const segNum = clickedSegIdx + 1;
        const wallHasAnyCurve = hit.item.curved || hasWallSegmentCurves(hit.item);

        const activeFloorId = st.activeTerrainAssetId || "terrain/berlin_wet_cobble.png";
        const getFloorLabel = (id: string) =>
          assetLookup.get(id)?.displayName ??
          id.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/_/g, " ") ??
          "Floor";
        const activeFloorLabel = getFloorLabel(activeFloorId);
        const recentFloorIds = st.recentTerrainAssetIds.slice(0, 3);

        const wallEntries: ContextMenuEntry[] = [];
        if (handleHit?.kind === "vertex" && hit.item.points.length > 2) {
          wallEntries.push({
            type: "item",
            id: "rm-wall-vtx",
            label: "Remove This Vertex Point",
            shortcut: "Alt+Click",
            onSelect: () => {
              const removed = removeWallVertexWithCurves(hit.item, handleHit.index);
              st.updateWall(
                hit.layerId,
                hit.id,
                { points: removed.points, segmentCurves: removed.segmentCurves },
                true,
              );
              st.setSelectedWallSegmentIndex(null);
              st.pushToast("Removed wall vertex");
            },
          });
          wallEntries.push({ type: "separator" });
        }

        // Per-Section Curve Controls (right at the top for instant 1-section flexibility!)
        if (segCount > 0) {
          wallEntries.push({
            type: "item",
            id: "wall-seg-toggle",
            label: segIsCurved
              ? `Straighten Section #${segNum}`
              : `Curve Section #${segNum} (90° Arch)`,
            shortcut: "C",
            onSelect: () => {
              const nowCurved = st.toggleWallSegmentCurve(hit.layerId, hit.id, clickedSegIdx, "90");
              st.pushToast(
                nowCurved
                  ? `Curved section #${segNum} — drag purple handle to reshape`
                  : `Straightened section #${segNum}`,
                "success",
              );
            },
          });
          if (segIsCurved) {
            const segA = hit.item.points[clickedSegIdx];
            const segB = hit.item.points[(clickedSegIdx + 1) % hit.item.points.length];
            const segArcInfo = getWallSegmentArcInfo(segA, segB, segSag);
            const isAlreadySemi = Math.abs(segArcInfo.sweepDeg - 180) <= 4;
            wallEntries.push(
              {
                type: "item",
                id: "wall-seg-flip",
                label: `Flip Section #${segNum} Curve (Inward ↔ Outward)`,
                onSelect: () => {
                  st.flipWallSegmentCurve(hit.layerId, hit.id, clickedSegIdx);
                  st.pushToast(`Flipped section #${segNum} curve direction`);
                },
              },
              {
                type: "item",
                id: isAlreadySemi ? "wall-seg-90" : "wall-seg-180",
                label: isAlreadySemi
                  ? `Snap Section #${segNum} to 90° Arch`
                  : `Snap Section #${segNum} to 180° Semicircle`,
                onSelect: () => {
                  const sign = segSag >= 0 ? 1 : -1;
                  const ratio = isAlreadySemi ? 0.20710678 : 0.5;
                  st.setWallSegmentCurve(
                    hit.layerId,
                    hit.id,
                    clickedSegIdx,
                    sign * segArcInfo.chord * ratio,
                    true,
                  );
                  st.pushToast(
                    isAlreadySemi
                      ? `Snapped section #${segNum} to 90° arch`
                      : `Snapped section #${segNum} to 180° semicircle`,
                  );
                },
              },
            );
          } else {
            wallEntries.push({
              type: "item",
              id: "wall-seg-180-new",
              label: `Curve Section #${segNum} Into 180° Semicircle`,
              onSelect: () => {
                const bulge = computeDefaultWallEdgeBulge(hit.item, clickedSegIdx, "180");
                st.setWallSegmentCurve(hit.layerId, hit.id, clickedSegIdx, bulge, true);
                st.pushToast(`Curved section #${segNum} into 180° semicircle`, "success");
              },
            });
          }
          wallEntries.push({ type: "separator" });
        }

        // Room Fill with Active Floor + Last 3 Floor Types Used!
        if (hit.item.points.length >= 3) {
          wallEntries.push({
            type: "item",
            id: "wall-fill-room",
            label: `Fill Room: ${activeFloorLabel}`,
            thumbnailUrl: resolveAssetUrl(activeFloorId, assetLookup),
            onSelect: () => {
              const ok = st.fillWallInterior(hit.layerId, hit.id, activeFloorId);
              if (ok) {
                st.pushToast(`Filled room interior with ${activeFloorLabel}`, "success");
              }
            },
          });
          if (recentFloorIds.length > 0) {
            wallEntries.push({
              type: "submenu",
              id: "wall-fill-recent",
              label: "Fill Room with Last 3 Floors Used",
              items: recentFloorIds.map((fid, idx) => {
                const fname = getFloorLabel(fid);
                return {
                  id: `wall-fill-rec-${idx}`,
                  label: fname,
                  checked: fid === activeFloorId,
                  thumbnailUrl: resolveAssetUrl(fid, assetLookup),
                  onSelect: () => {
                    const ok = st.fillWallInterior(hit.layerId, hit.id, fid);
                    if (ok) {
                      st.pushToast(`Filled room interior with ${fname}`, "success");
                    }
                  },
                };
              }),
            });
          }
          wallEntries.push({ type: "separator" });
        }

        wallEntries.push(
          {
            type: "item",
            id: "wall-bend",
            label: wallHasAnyCurve ? "Straighten Entire Wall" : "Smooth Entire Wall Into Curve",
            onSelect: () => {
              if (wallHasAnyCurve) {
                st.updateWall(hit.layerId, hit.id, { curved: false, segmentCurves: undefined }, true);
                st.pushToast("Straightened all sections of wall");
              } else {
                st.bendSelectedIntoCurve();
              }
            },
          },
          {
            type: "item",
            id: "wall-closed",
            label: "Closed Room Loop",
            checked: hit.item.closed,
            onSelect: () =>
              st.updateWall(hit.layerId, hit.id, { closed: !hit.item.closed }, true),
          },
          {
            type: "item",
            id: "wall-light",
            label: "Blocks Light & VTT Sight",
            checked: hit.item.blocksLight,
            onSelect: () =>
              st.updateWall(hit.layerId, hit.id, { blocksLight: !hit.item.blocksLight }, true),
          },
          { type: "separator" },
          {
            type: "item",
            id: "dup-wall",
            label: "Duplicate Wall",
            shortcut: "Ctrl+D",
            onSelect: () => st.duplicateSelection(1.0, 1.0),
          },
          {
            type: "item",
            id: "del-wall",
            label: "Delete Wall",
            shortcut: "Del",
            danger: true,
            onSelect: () => st.deleteSelection(),
          },
        );
        onOpenContextMenu(e.clientX, e.clientY, "Wall Actions", wallEntries);
        return;
      }

      if (hit.kind === "path") {
        const sel: SelectionRef = { kind: "path", layerId: hit.layerId, id: hit.id };
        const handleHit = hitSelectedPolyHandle(e.clientX, e.clientY);
        const shape: CurveEditableShape = {
          points: hit.item.points,
          closed: false,
          curved: hit.item.curved !== false,
          segmentCurves: hit.item.segmentCurves,
          noun: "Section",
          minPoints: 2,
          locked: false,
        };
        const edgeHit = distanceToWall(gridPt, shape);
        const clickedSegIdx =
          handleHit?.kind === "wall_edge"
            ? handleHit.segIndex
            : Math.max(0, edgeHit.segmentIndex);
        st.setSelectedWallSegmentIndex(clickedSegIdx);
        const pathHasAnyCurve = shape.curved || hasWallSegmentCurves(shape);
        const pathEntries: ContextMenuEntry[] = [
          ...buildSectionCurveContextEntries(
            st,
            sel,
            shape,
            clickedSegIdx,
            handleHit?.kind === "vertex" ? handleHit.index : undefined,
          ),
          {
            type: "item",
            id: "path-bend",
            label: pathHasAnyCurve ? "Straighten Entire Line" : "Smooth Entire Line Into Curve",
            onSelect: () => {
              if (pathHasAnyCurve) {
                st.flattenEntityCurves(sel);
                st.pushToast("Straightened all sections of line");
              } else {
                st.bendSelectedIntoCurve();
              }
            },
          },
          {
            type: "item",
            id: "path-flip-slope",
            label: "Flip Slope Side (Uphill ↔ Downhill)",
            checked: Boolean(hit.item.flipSide),
            onSelect: () => {
              st.updatePath(hit.layerId, hit.id, { flipSide: !hit.item.flipSide }, true);
              st.pushToast("Flipped embankment / path side direction", "success");
            },
          },
          {
            type: "item",
            id: "path-taper",
            label: "Taper Line Ends",
            checked: hit.item.taperEnds,
            onSelect: () =>
              st.updatePath(hit.layerId, hit.id, { taperEnds: !hit.item.taperEnds }, true),
          },
          {
            type: "item",
            id: "path-fade",
            label: "Fade Line Ends",
            checked: hit.item.fadeEnds,
            onSelect: () =>
              st.updatePath(hit.layerId, hit.id, { fadeEnds: !hit.item.fadeEnds }, true),
          },
          { type: "separator" },
          {
            type: "item",
            id: "dup-path",
            label: "Duplicate Line / Path",
            shortcut: "Ctrl+D",
            onSelect: () => st.duplicateSelection(1.0, 1.0),
          },
          {
            type: "item",
            id: "del-path",
            label: "Delete Line / Path",
            shortcut: "Del",
            danger: true,
            onSelect: () => st.deleteSelection(),
          },
        ];
        onOpenContextMenu(e.clientX, e.clientY, "Line / Path Actions", pathEntries);
        return;
      }

      if (hit.kind === "portal") {
        const isSwingDoor = hit.item.kind !== "window" && hit.item.kind !== "gate";
        onOpenContextMenu(e.clientX, e.clientY, "Portal Actions", [
          {
            type: "item",
            id: "toggle-portal",
            label: hit.item.closed ? "Open Door / Gate (Pass Light)" : "Close Door / Gate (Block Light)",
            onSelect: () => st.togglePortalClosed(hit.layerId, hit.id),
          },
          ...(isSwingDoor
            ? [
                {
                  type: "item" as const,
                  id: "flip-portal-swing",
                  label: hit.item.swingInvert
                    ? "Swing Direction: Switch to Inward"
                    : "Swing Direction: Switch to Outward",
                  shortcut: "X",
                  onSelect: () =>
                    st.updatePortal(
                      hit.layerId,
                      hit.id,
                      { swingInvert: !hit.item.swingInvert },
                      true,
                    ),
                },
                {
                  type: "item" as const,
                  id: "flip-portal-hinge",
                  label: hit.item.hingeFlip
                    ? "Hinge Side: Switch to Left Jamb"
                    : "Hinge Side: Switch to Right Jamb",
                  shortcut: "Y",
                  onSelect: () =>
                    st.updatePortal(
                      hit.layerId,
                      hit.id,
                      { hingeFlip: !hit.item.hingeFlip },
                      true,
                    ),
                },
              ]
            : []),
          { type: "separator" },
          {
            type: "item",
            id: "del-portal",
            label: "Delete Portal",
            shortcut: "Del",
            danger: true,
            onSelect: () => st.deleteSelection(),
          },
        ]);
        return;
      }

      if (hit.kind === "scatter") {
        onOpenContextMenu(e.clientX, e.clientY, "Scatter Zone Actions", [
          {
            type: "item",
            id: "reseed-scatter",
            label: "Re-Seed Foliage Layout",
            onSelect: () => {
              st.reseedScatterZone(hit.layerId, hit.id);
              st.pushToast("Re-seeded Smart Scatter Zone", "success");
            },
          },
          {
            type: "item",
            id: "toggle-outline",
            label: "Show Scatter Zone Outlines",
            checked: st.showScatterOutlines,
            onSelect: () => st.setShowScatterOutlines(!st.showScatterOutlines),
          },
          { type: "separator" },
          {
            type: "item",
            id: "del-scatter",
            label: "Delete Scatter Zone",
            shortcut: "Del",
            danger: true,
            onSelect: () => st.deleteSelection(),
          },
        ]);
        return;
      }

      if (hit.kind === "cave_entrance") {
        onOpenContextMenu(e.clientX, e.clientY, "Cave / Dungeon Entrance", [
          {
            type: "submenu",
            id: "ent-thresh",
            label: "Threshold Style",
            items: [
              {
                id: "ent-t-open",
                label: "Open Fade Only",
                checked: hit.item.thresholdStyle === "none",
                onSelect: () =>
                  st.updateCaveEntrance(hit.layerId, hit.id, { thresholdStyle: "none" }, true),
              },
              {
                id: "ent-t-rock",
                label: "Rock Mouth Boulders",
                checked: hit.item.thresholdStyle === "rock_mouth",
                onSelect: () =>
                  st.updateCaveEntrance(
                    hit.layerId,
                    hit.id,
                    { thresholdStyle: "rock_mouth" },
                    true,
                  ),
              },
              {
                id: "ent-t-arch",
                label: "Dungeon Stone Arch",
                checked: hit.item.thresholdStyle === "stone_arch",
                onSelect: () =>
                  st.updateCaveEntrance(
                    hit.layerId,
                    hit.id,
                    { thresholdStyle: "stone_arch" },
                    true,
                  ),
              },
            ],
          },
          {
            type: "item",
            id: "ent-marker",
            label: "Show Entrance Marker Badge",
            checked: hit.item.showMarker,
            onSelect: () =>
              st.updateCaveEntrance(hit.layerId, hit.id, { showMarker: !hit.item.showMarker }, true),
          },
          {
            type: "item",
            id: "ent-dmonly",
            label: "DM-Only Secret Exit",
            checked: hit.item.markerDmOnly,
            onSelect: () =>
              st.updateCaveEntrance(
                hit.layerId,
                hit.id,
                { markerDmOnly: !hit.item.markerDmOnly },
                true,
              ),
          },
          { type: "separator" },
          {
            type: "item",
            id: "del-ent",
            label: "Remove Entrance Opening",
            shortcut: "Del",
            danger: true,
            onSelect: () => st.deleteSelection(),
          },
        ]);
        return;
      }

      if (hit.kind === "roof") {
        const rf = hit.item;
        const sel: SelectionRef = { kind: "roof", layerId: hit.layerId, id: hit.id };
        const handleHit = hitSelectedPolyHandle(e.clientX, e.clientY);
        const roofSectionEntries: ContextMenuEntry[] = [];
        let roofHasAnyCurve = Boolean(rf.curved);
        if (rf.style !== "cone") {
          const shape: CurveEditableShape = {
            points: rf.points,
            closed: false,
            curved: Boolean(rf.curved),
            segmentCurves: rf.segmentCurves,
            noun: "Ridge",
            minPoints: 2,
            locked: false,
          };
          const edgeHit = distanceToWall(gridPt, shape);
          const clickedSegIdx =
            handleHit?.kind === "wall_edge"
              ? handleHit.segIndex
              : Math.max(0, edgeHit.segmentIndex);
          st.setSelectedWallSegmentIndex(clickedSegIdx);
          roofHasAnyCurve = shape.curved || hasWallSegmentCurves(shape);
          roofSectionEntries.push(
            ...buildSectionCurveContextEntries(
              st,
              sel,
              shape,
              clickedSegIdx,
              handleHit?.kind === "vertex" ? handleHit.index : undefined,
            ),
          );
        }
        const styleOptions: Array<{ id: RoofStyle; label: string }> = [
          { id: "gable", label: "Gable (Classic Pitched)" },
          { id: "hip", label: "Hip (4-Slope Slanted Ends)" },
          { id: "shed", label: "Shed / Lean-To (Single Slope)" },
          { id: "mansard", label: "Mansard (4 Skirts + Flat Crown)" },
          { id: "cone", label: "Cone / Turret (Radial Spire)" },
        ];
        onOpenContextMenu(e.clientX, e.clientY, "Roof Actions", [
          ...roofSectionEntries,
          {
            type: "submenu",
            id: "roof-style",
            label: "Architectural Style",
            items: styleOptions.map((opt) => ({
              id: `rf-st-${opt.id}`,
              label: opt.label,
              checked: rf.style === opt.id,
              onSelect: () => st.updateRoof(hit.layerId, hit.id, { style: opt.id }, true),
            })),
          },
          ...(rf.style !== "cone"
            ? [
                {
                  type: "item" as const,
                  id: "roof-curve",
                  label: roofHasAnyCurve
                    ? "Straighten Entire Ridge"
                    : "Smooth Entire Ridge Into Curve",
                  onSelect: () => {
                    if (roofHasAnyCurve) {
                      st.flattenEntityCurves(sel);
                      st.pushToast("Straightened entire roof ridge");
                    } else {
                      st.bendSelectedIntoCurve();
                    }
                  },
                },
              ]
            : []),
          ...(rf.style === "shed"
            ? [
                {
                  type: "item" as const,
                  id: "roof-flip",
                  label: "Flip Lean-To Slope Side",
                  shortcut: "X",
                  checked: rf.flipSlope,
                  onSelect: () =>
                    st.updateRoof(hit.layerId, hit.id, { flipSlope: !rf.flipSlope }, true),
                },
              ]
            : []),
          { type: "separator" },
          {
            type: "item",
            id: "roof-front",
            label: "Bring Roof to Front (Overlap)",
            onSelect: () => st.reorderRoofInLayer(hit.layerId, hit.id, "front"),
          },
          {
            type: "item",
            id: "roof-back",
            label: "Send Roof to Back",
            onSelect: () => st.reorderRoofInLayer(hit.layerId, hit.id, "back"),
          },
          {
            type: "item",
            id: "roof-sync-sun",
            label: `Sync Sun Angle (${Math.round(rf.sunAngleDeg)}°) to All Roofs`,
            onSelect: () => {
              st.syncSunAngleToAllRoofs(rf.sunAngleDeg);
              st.pushToast(`Synced all roofs to ${Math.round(rf.sunAngleDeg)}° sunlight`, "success");
            },
          },
          { type: "separator" },
          {
            type: "item",
            id: "dup-roof",
            label: "Duplicate Roof",
            shortcut: "Ctrl+D",
            onSelect: () => st.duplicateSelection(),
          },
          {
            type: "item",
            id: "del-roof",
            label: "Delete Roof",
            shortcut: "Del",
            danger: true,
            onSelect: () => st.deleteSelection(),
          },
        ]);
        return;
      }

      if (hit.kind === "light") {
        onOpenContextMenu(e.clientX, e.clientY, "Light Actions", [
          {
            type: "item",
            id: "lt-shadows",
            label: "Cast 2D Raycast Shadows",
            checked: hit.item.castShadows,
            onSelect: () =>
              st.updateLight(hit.layerId, hit.id, { castShadows: !hit.item.castShadows }, true),
          },
          {
            type: "submenu",
            id: "lt-preset",
            label: "Light Color Temperature",
            items: [
              {
                id: "lp-torch",
                label: "Warm Torch (#FF9B3D)",
                onSelect: () => st.updateLight(hit.layerId, hit.id, { colorHex: "#FF9B3D" }, true),
              },
              {
                id: "lp-headlamp",
                label: "Funicular Headlamp (#FFE4A3)",
                onSelect: () => st.updateLight(hit.layerId, hit.id, { colorHex: "#FFE4A3" }, true),
              },
              {
                id: "lp-furnace",
                label: "Boiler Firebox (#FF5A1A)",
                onSelect: () => st.updateLight(hit.layerId, hit.id, { colorHex: "#FF5A1A" }, true),
              },
              {
                id: "lp-arcane",
                label: "Arcane Violet (#A78BFA)",
                onSelect: () => st.updateLight(hit.layerId, hit.id, { colorHex: "#A78BFA" }, true),
              },
            ],
          },
          {
            type: "item",
            id: "dup-lt",
            label: "Duplicate Light",
            shortcut: "Ctrl+D",
            onSelect: () => st.duplicateSelection(),
          },
          { type: "separator" },
          {
            type: "item",
            id: "del-lt",
            label: "Delete Light",
            shortcut: "Del",
            danger: true,
            onSelect: () => st.deleteSelection(),
          },
        ]);
        return;
      }

      if (
        hit.kind === "water" ||
        hit.kind === "world_river" ||
        hit.kind === "world_trail" ||
        hit.kind === "world_region"
      ) {
        const sel: SelectionRef = { kind: hit.kind, layerId: hit.layerId, id: hit.id };
        const shape = resolveCurveEditableEntity(doc, sel);
        if (shape) {
          const handleHit = hitSelectedPolyHandle(e.clientX, e.clientY);
          const edgeHit = distanceToWall(gridPt, shape);
          const clickedSegIdx =
            handleHit?.kind === "wall_edge"
              ? handleHit.segIndex
              : Math.max(0, edgeHit.segmentIndex);
          st.setSelectedWallSegmentIndex(clickedSegIdx);
          const hasAnyCurve = shape.curved || hasWallSegmentCurves(shape);
          const titleMap: Record<typeof hit.kind, string> = {
            water: hit.kind === "water" && hit.item.shape === "river" ? "River Actions" : "Water Basin Actions",
            world_river: "World River Actions",
            world_trail: "World Route Actions",
            world_region: "Political Realm Actions",
          };
          const wholeMap: Record<typeof hit.kind, string> = {
            water: hit.kind === "water" && hit.item.shape === "river" ? "River" : "Basin",
            world_river: "River",
            world_trail: "Route",
            world_region: "Border",
          };
          const wholeLabel = wholeMap[hit.kind];
          const entries: ContextMenuEntry[] = [
            ...buildSectionCurveContextEntries(
              st,
              sel,
              shape,
              clickedSegIdx,
              handleHit?.kind === "vertex" ? handleHit.index : undefined,
            ),
            {
              type: "item",
              id: "ent-whole-curve",
              label: hasAnyCurve
                ? `Straighten Entire ${wholeLabel}`
                : `Smooth Entire ${wholeLabel} Into Curve`,
              onSelect: () => {
                if (hasAnyCurve) {
                  st.flattenEntityCurves(sel);
                  st.pushToast(`Straightened entire ${wholeLabel.toLowerCase()}`);
                } else {
                  st.bendSelectedIntoCurve();
                }
              },
            },
            { type: "separator" },
            ...(hit.kind === "water"
              ? [
                  {
                    type: "item" as const,
                    id: "dup-water",
                    label: "Duplicate Water Body",
                    shortcut: "Ctrl+D",
                    onSelect: () => st.duplicateSelection(1.0, 1.0),
                  },
                ]
              : []),
            {
              type: "item",
              id: "del-item",
              label: `Delete ${wholeLabel}`,
              shortcut: "Del",
              danger: true,
              onSelect: () => st.deleteSelection(),
            },
          ];
          onOpenContextMenu(e.clientX, e.clientY, titleMap[hit.kind], entries);
          return;
        }
      }

      onOpenContextMenu(e.clientX, e.clientY, "Selection Actions", [
        {
          type: "item",
          id: "del-item",
          label: "Delete Selected",
          shortcut: "Del",
          danger: true,
          onSelect: () => st.deleteSelection(),
        },
      ]);
      return;
    }

    // Empty Canvas Context Menu
    onOpenContextMenu(e.clientX, e.clientY, "Canvas Actions", [
      {
        type: "item",
        id: "paste-here",
        label: "Paste Prop Here",
        shortcut: "Ctrl+V",
        disabled: !st.copiedObject,
        onSelect: () => st.pasteAt(snapped.x, snapped.y),
      },
      {
        type: "item",
        id: "quick-light",
        label: "Add 2D Light Here",
        onSelect: () => {
          st.addLight({
            id: `lt-${Date.now()}`,
            name: "Station Lantern",
            x: snapped.x,
            y: snapped.y,
            radiusCells: 7.0,
            intensity: 1.1,
            colorHex: "#FFBE5C",
            castShadows: true,
            coneAngleDeg: 360,
            directionRad: 0,
            flicker: false,
          });
          st.pushToast("Placed 2D Light", "success");
        },
      },
      {
        type: "item",
        id: "quick-note",
        label: "Pin DM-Only Secret Note Here",
        onSelect: () => {
          st.addDmNote({
            id: `dm-${Date.now()}`,
            x: snapped.x,
            y: snapped.y,
            badge: "SECRET",
            title: "GM Encounter Cue",
            body: "Hidden mechanic or ambush trigger.",
            colorHex: "#F59E0B",
          });
          st.pushToast("Pinned DM Note", "success");
        },
      },
      { type: "separator" },
      {
        type: "item",
        id: "toggle-grid",
        label: "Show Tactical Grid",
        checked: doc.canvas.grid.visible,
        onSelect: () => st.setGridSettings({ visible: !doc.canvas.grid.visible }),
      },
      {
        type: "item",
        id: "toggle-lighting",
        label: "Real-Time 2D Raycast Lighting",
        checked: doc.lighting.enabled,
        onSelect: () => st.setLightingSettings({ enabled: !doc.lighting.enabled }),
      },
      {
        type: "item",
        id: "toggle-vtt",
        label: "Show VTT Wall & Light Overlay",
        checked: st.showVttOverlay,
        onSelect: () => st.setShowVttOverlay(!st.showVttOverlay),
      },
      {
        type: "item",
        id: "toggle-dm",
        label: "DM View (Show Spoiler Notes)",
        checked: st.dmViewMode,
        onSelect: () => st.setDmViewMode(!st.dmViewMode),
      },
      { type: "separator" },
      {
        type: "item",
        id: "fit-view",
        label: "Fit Map to Screen",
        shortcut: "F",
        onSelect: fitToScreen,
      },
      {
        type: "item",
        id: "open-export",
        label: "Open 8K / 55\" TV Export Studio…",
        shortcut: "Ctrl+E",
        onSelect: () => st.setExportModalOpen(true),
      },
      {
        type: "item",
        id: "open-prefs",
        label: "Studio Preferences…",
        shortcut: "Ctrl+,",
        onSelect: () => st.setPreferencesModalOpen(true),
      },
    ]);
  };

  // Drag-and-drop an asset or premade template straight from the Asset Vault onto the canvas!
  const handleDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const gridPt = snapPoint(screenToGrid(e.clientX, e.clientY), e.altKey ? "free" : snapMode);
    const st = useDocumentStore.getState();

    const templateId = e.dataTransfer.getData("application/x-dicechaos-template");
    if (templateId) {
      st.selectObjectTemplate(templateId);
      st.stampObjectTemplateAt(gridPt.x, gridPt.y, templateId);
      return;
    }

    const assetId = e.dataTransfer.getData("application/x-dicechaos-asset");
    if (!assetId) return;
    const asset = assetLookup.get(assetId);
    if (!asset) return;

    if (asset.category === "terrain") {
      st.addTerrainStroke({
        id: `ts-${Date.now()}`,
        assetId,
        points: [gridPt],
        radiusCells: st.brushRadiusCells + 1,
        opacity: 0.95,
        softness: 0.4,
      });
      st.pushToast(`Painted ${asset.displayName}`, "success");
      return;
    }

    const wCells = (asset.widthPx / asset.defaultPpi) * st.stampScale;
    const hCells = (asset.heightPx / asset.defaultPpi) * st.stampScale;
    st.addObjectStamp({
      id: `obj-${Date.now()}`,
      assetId,
      x: gridPt.x,
      y: gridPt.y,
      widthCells: Math.max(doc.mode === "world" ? 0.16 : 0.75, wCells),
      heightCells: Math.max(doc.mode === "world" ? 0.16 : 0.75, hCells),
      rotationRad: st.stampRotationRad,
      flipX: st.stampFlipX,
      flipY: false,
      opacity: 1,
      castsShadow: asset.castsShadow,
      locked: false,
      recolor: { ...st.activeRecolor },
      zOrder: 30,
    });
    st.pushToast(`Stamped ${asset.displayName}`, "success");
  };

  const adjustZoom = (factor: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cx = wrap.clientWidth / 2;
    const cy = wrap.clientHeight / 2;
    const oldCell = camRef.current.cellPx;
    const maxCell = doc.mode === "world" ? 512 : 256;
    const nextCell = Math.max(8, Math.min(maxCell, oldCell * factor));
    const s = nextCell / oldCell;
    camRef.current.x = cx - (cx - camRef.current.x) * s;
    camRef.current.y = cy - (cy - camRef.current.y) * s;
    camRef.current.cellPx = nextCell;
    useDocumentStore.getState().setZoomPercent(Math.round((nextCell / 32) * 100));
    bumpRender();
  };

  const setZoomPercentCentered = (pct: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const cx = wrap.clientWidth / 2;
    const cy = wrap.clientHeight / 2;
    const oldCell = camRef.current.cellPx;
    const maxCell = doc.mode === "world" ? 512 : 256;
    const nextCell = Math.max(8, Math.min(maxCell, (pct / 100) * 32));
    const s = nextCell / oldCell;
    camRef.current.x = cx - (cx - camRef.current.x) * s;
    camRef.current.y = cy - (cy - camRef.current.y) * s;
    camRef.current.cellPx = nextCell;
    useDocumentStore.getState().setZoomPercent(Math.round((nextCell / 32) * 100));
    bumpRender();
  };

  const tvCal = computeTvCalibration(
    preferences.defaultTvDiagonal,
    preferences.defaultTvWidth,
    preferences.defaultTvHeight,
  );

  const selectionDetails = useMemo(
    () => describeSelection(doc, selection, assetLookup),
    [doc, selection, assetLookup],
  );

  const activeDrawAsset =
    activeTool === "wall"
      ? assetLookup.get(activeWallAssetId)
      : activeTool === "path"
        ? assetLookup.get(activePathAssetId)
        : activeTool === "roof"
          ? assetLookup.get(activeRoofAssetId)
          : activeTool === "portal"
            ? assetLookup.get(activePortalAssetId)
            : activeTool === "terrain"
              ? assetLookup.get(activeTerrainAssetId)
              : activeTool === "stamp" && selectedAssetId
                ? assetLookup.get(selectedAssetId)
                : undefined;

  const handleMapFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!mapDropActive) setMapDropActive(true);
  };

  const handleMapFileDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setMapDropActive(false);
  };

  const handleMapFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setMapDropActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (
      !lower.endsWith(".dcmap") &&
      !lower.endsWith(".wonderdraft_map") &&
      !lower.endsWith(".dungeondraft_map") &&
      !lower.endsWith(".json")
    ) {
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (lower.endsWith(".wonderdraft_map") || lower.endsWith(".dungeondraft_map")) {
      useDocumentStore.getState().openExternalMapImport(file.name, bytes);
      return;
    }
    const text = new TextDecoder("utf-8").decode(bytes);
    const ok = useDocumentStore.getState().loadDocumentJson(text);
    if (!ok) {
      useDocumentStore.getState().openExternalMapImport(file.name, bytes);
    }
  };

  return (
    <div
      ref={wrapRef}
      className="dc-viewport-wrap"
      onDragOver={handleMapFileDragOver}
      onDragLeave={handleMapFileDragLeave}
      onDrop={(e) => void handleMapFileDrop(e)}
    >
      {mapDropActive && (
        <div
          style={{
            position: "absolute",
            inset: 12,
            zIndex: 60,
            borderRadius: 12,
            border: "2px dashed var(--accent-gold)",
            background: "rgba(14, 17, 24, 0.84)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            gap: 6,
          }}
        >
          <strong style={{ color: "var(--accent-gold)", fontSize: 16 }}>
            Drop Map to Open or Import
          </strong>
          <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>
            Supports .dcmap, .wonderdraft_map &amp; .dungeondraft_map (auto-swaps into CC0 Vault)
          </span>
        </div>
      )}
      {/* Floating Canvas HUD Bar */}
      <div className="dc-canvas-hud-top">
        <div className="dc-hud-cluster">
          <button
            type="button"
            className={`dc-btn dc-btn-ghost ${dmViewMode ? "active" : ""}`}
            style={{ height: 26, padding: "0 8px", fontSize: 11 }}
            onClick={() => useDocumentStore.getState().setDmViewMode(!dmViewMode)}
            title="Toggle DM View (Spoiler Notes) vs Clean Player TV View"
          >
            {dmViewMode ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{dmViewMode ? "DM View" : "Player View"}</span>
          </button>

          {doc.mode !== "world" && (
            <>
              <button
                type="button"
                className={`dc-btn dc-btn-ghost ${showVttOverlay ? "active" : ""}`}
                style={{ height: 26, padding: "0 8px", fontSize: 11 }}
                onClick={() => useDocumentStore.getState().setShowVttOverlay(!showVttOverlay)}
                title="Preview Universal VTT Wall Occluders & Light Radii"
              >
                <Shield size={13} />
                <span>VTT</span>
              </button>
              <button
                type="button"
                className={`dc-btn dc-btn-ghost ${doc.lighting.enabled ? "active" : ""}`}
                style={{ height: 26, padding: "0 8px", fontSize: 11 }}
                onClick={() =>
                  useDocumentStore
                    .getState()
                    .setLightingSettings({ enabled: !doc.lighting.enabled })
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  const st = useDocumentStore.getState();
                  onOpenContextMenu(e.clientX, e.clientY, "Quick Lighting & Presets", [
                    {
                      type: "item",
                      id: "hud-light-toggle",
                      label: "Dynamic 2D Raycast Lighting",
                      checked: doc.lighting.enabled,
                      onSelect: () => st.setLightingSettings({ enabled: !doc.lighting.enabled }),
                    },
                    { type: "separator" },
                    ...doc.lighting.presets.map((p) => ({
                      type: "item" as const,
                      id: `hud-preset-${p.id}`,
                      label: `${p.name} (${Math.round(p.ambientIntensity * 100)}%)`,
                      checked: doc.lighting.activePresetId === p.id,
                      onSelect: () => {
                        st.applyLightingPreset(p.id);
                        if (!doc.lighting.enabled) st.setLightingSettings({ enabled: true });
                      },
                    })),
                    { type: "separator" },
                    {
                      type: "item",
                      id: "hud-open-light-tool",
                      label: "Open Lighting & Atmosphere Studio",
                      shortcut: "L",
                      onSelect: () => st.setActiveTool("light"),
                    },
                  ]);
                }}
                title={
                  doc.lighting.enabled
                    ? `Dynamic Lighting: ON (${Math.round(doc.lighting.ambientIntensity * 100)}% ambient) · Click for flat unlit editing view · Right-click for Day/Twilight/Night presets`
                    : "Dynamic Lighting: OFF (Flat full-bright editing view) · Click to enable 2D raycast shadows & ambient lighting · Right-click for presets"
                }
              >
                <Sun size={13} />
                <span>{doc.lighting.enabled ? "Light: ON" : "Light: OFF"}</span>
              </button>
            </>
          )}
          <button
            type="button"
            className={`dc-btn dc-btn-ghost ${
              doc.mode === "world"
                ? doc.world?.overlays.grid.style !== "none"
                  ? "active"
                  : ""
                : doc.canvas.grid.visible
                  ? "active"
                  : ""
            }`}
            style={{ height: 26, padding: "0 7px", fontSize: 11 }}
            onClick={() => {
              const st = useDocumentStore.getState();
              if (doc.mode === "world" && doc.world) {
                const isOn = doc.world.overlays.grid.style !== "none";
                st.updateWorldOverlays({ grid: { style: isOn ? "none" : "hex_flat" } }, true);
              } else {
                st.setGridSettings({ visible: !doc.canvas.grid.visible });
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              const st = useDocumentStore.getState();
              onOpenContextMenu(e.clientX, e.clientY, "Tactical Grid Style", [
                {
                  type: "item",
                  id: "hud-grid-vis",
                  label: "Show Tactical Grid",
                  checked: doc.canvas.grid.visible,
                  onSelect: () => st.setGridSettings({ visible: !doc.canvas.grid.visible }),
                },
                { type: "separator" },
                {
                  type: "item",
                  id: "hud-grid-sq",
                  label: 'Square (1" / 5ft)',
                  checked: doc.canvas.grid.type === "square",
                  onSelect: () => st.setGridSettings({ type: "square", visible: true }),
                },
                {
                  type: "item",
                  id: "hud-grid-hf",
                  label: "Hex (Flat Top)",
                  checked: doc.canvas.grid.type === "hex_flat",
                  onSelect: () => st.setGridSettings({ type: "hex_flat", visible: true }),
                },
                {
                  type: "item",
                  id: "hud-grid-hp",
                  label: "Hex (Pointy Top)",
                  checked: doc.canvas.grid.type === "hex_pointy",
                  onSelect: () => st.setGridSettings({ type: "hex_pointy", visible: true }),
                },
                {
                  type: "item",
                  id: "hud-grid-none",
                  label: "Gridless",
                  checked: doc.canvas.grid.type === "none",
                  onSelect: () => st.setGridSettings({ type: "none" }),
                },
              ]);
            }}
            title="Click to toggle Tactical Grid · Right-click to switch Square / Hex / Gridless"
          >
            <Grid3x3 size={13} />
            <span>Grid</span>
          </button>
          <button
            type="button"
            className={`dc-btn dc-btn-ghost ${snapMode !== "free" ? "active" : ""}`}
            style={{ height: 26, padding: "0 8px", fontSize: 11 }}
            onClick={() => useDocumentStore.getState().toggleSnapEnabled()}
            onContextMenu={(e) => {
              e.preventDefault();
              const st = useDocumentStore.getState();
              onOpenContextMenu(e.clientX, e.clientY, "Grid Snapping Mode", [
                {
                  type: "item",
                  id: "snap-half",
                  label: "Half-Square Snap (0.5 sq)",
                  checked: snapMode === "half",
                  onSelect: () => st.setSnapMode("half"),
                },
                {
                  type: "item",
                  id: "snap-grid",
                  label: "Full-Square Snap (1.0 sq)",
                  checked: snapMode === "grid",
                  onSelect: () => st.setSnapMode("grid"),
                },
                {
                  type: "item",
                  id: "snap-free",
                  label: "Snapping OFF (Free Placement)",
                  checked: snapMode === "free",
                  onSelect: () => st.setSnapMode("free"),
                },
              ]);
            }}
            title="Click to toggle Grid Snapping ON / OFF · Right-click for Half / Grid / Free · Hold Alt anytime for temporary free placement"
          >
            <Magnet size={12} />
            <span>
              {snapMode === "free"
                ? "Snap: OFF"
                : snapMode === "half"
                  ? "Snap: ½"
                  : "Snap: 1"}
            </span>
          </button>
        </div>

        {selectionDetails && (
          <div
            className="dc-hud-cluster"
            role="status"
            aria-label="Selected Item"
            style={{
              borderColor: `${selectionDetails.accentHex}88`,
              background: "rgba(15, 19, 28, 0.94)",
              padding: "3px 6px 3px 6px",
              gap: 7,
              maxWidth: 360,
            }}
            title={`${selectionDetails.typeLabel}: ${selectionDetails.name} · ${selectionDetails.subtitle} · Layer: ${selectionDetails.layerName}`}
          >
            {selectionDetails.thumbUrl ? (
              <img
                src={selectionDetails.thumbUrl}
                alt=""
                style={{
                  width: 22,
                  height: 22,
                  objectFit: "contain",
                  borderRadius: 4,
                  background: "#0E1016",
                  border: "1px solid var(--border-strong)",
                  flexShrink: 0,
                }}
              />
            ) : (
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: selectionDetails.accentHex,
                  boxShadow: `0 0 8px ${selectionDetails.accentHex}`,
                  flexShrink: 0,
                  marginLeft: 3,
                }}
              />
            )}
            <span
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: selectionDetails.accentHex,
                background: `${selectionDetails.accentHex}1F`,
                border: `1px solid ${selectionDetails.accentHex}55`,
                borderRadius: 4,
                padding: "1px 5px",
                flexShrink: 0,
              }}
            >
              {selectionDetails.typeLabel}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {selectionDetails.name}
            </span>
            <span
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              {selectionDetails.floorCode}
            </span>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Deselect (Esc)"
              aria-label="Deselect"
              style={{ width: 20, height: 20, flexShrink: 0 }}
              onClick={() => useDocumentStore.getState().setSelection(null)}
            >
              <X size={11} />
            </button>
          </div>
        )}

        {activeDrawAsset && !selectionDetails && (
          <div
            className="dc-hud-cluster"
            style={{
              borderColor: "rgba(229, 169, 60, 0.45)",
              padding: "3px 10px 3px 5px",
            }}
            title="Switch styles in the right-hand Inspector or Asset Vault"
          >
            <img
              src={activeDrawAsset.thumbUrl}
              alt=""
              style={{
                width: 22,
                height: 22,
                objectFit: "contain",
                borderRadius: 4,
                background: "#0E1016",
                border: "1px solid var(--border-strong)",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--accent-gold)",
                whiteSpace: "nowrap",
                maxWidth: 170,
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeDrawAsset.displayName}
            </span>
          </div>
        )}

        <div className="dc-hud-cluster" style={{ flexShrink: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--accent-gold)",
              padding: "0 5px",
              whiteSpace: "nowrap",
            }}
            title={`Calibrated for ${tvCal.diagonalInches}" 4K TV: ${tvCal.exactPpi} PPI = 1.00 inch per grid square`}
          >
            {tvCal.diagonalInches}&quot; 4K · 1&quot; ({tvCal.exactPpi} PPI)
          </span>
          <button
            type="button"
            className="dc-mini-icon-btn"
            aria-label="Zoom out"
            onClick={() => adjustZoom(0.8)}
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            className="dc-mini-icon-btn"
            aria-label="Cycle zoom preset"
            title="Click to cycle crisp detail zoom (100% -> 250% -> 500% -> 900% -> Fit)"
            onClick={() => {
              if (zoomPercent < 95) setZoomPercentCentered(100);
              else if (zoomPercent < 220) setZoomPercentCentered(250);
              else if (zoomPercent < 460) setZoomPercentCentered(500);
              else if (zoomPercent < 820) setZoomPercentCentered(900);
              else fitToScreen();
            }}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--text-secondary)",
              minWidth: 46,
              padding: "0 6px",
              width: "auto",
            }}
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            className="dc-mini-icon-btn"
            aria-label="Zoom in"
            onClick={() => adjustZoom(1.25)}
          >
            <ZoomIn size={14} />
          </button>
          {doc.mode === "world" && (
            <button
              type="button"
              className="dc-mini-icon-btn"
              aria-label="Detail zoom 400%"
              title="Jump to 400% Micro-Detail Editing Zoom"
              onClick={() => setZoomPercentCentered(400)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                padding: "0 6px",
                width: "auto",
                color: zoomPercent >= 350 ? "var(--accent-gold)" : "var(--text-secondary)",
              }}
            >
              4×
            </button>
          )}
          <button
            type="button"
            className="dc-mini-icon-btn"
            aria-label="Fit map to screen"
            title="Fit Map to Screen (F)"
            onClick={fitToScreen}
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="dc-viewport-canvas"
        style={{
          cursor: eyedropperTarget
            ? "crosshair"
            : spaceDown
              ? "grab"
              : dragRef.current.mode === "obj_rotate" ||
                  dragRef.current.mode === "light_aim" ||
                  dragRef.current.mode === "light_cone" ||
                  (dragRef.current.mode === "move" && selection?.kind === "light")
                ? "grabbing"
                : dragRef.current.mode === "light_radius"
                  ? "ew-resize"
                  : hoverCursor
                  ? hoverCursor
                  : activeTool === "select"
                    ? "default"
                    : "crosshair",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      />

      {/* Vertical Architectural "Elevator Shaft" Level Rail (Battlemap Mode only) */}
      <ElevationRail onOpenContextMenu={onOpenContextMenu} />

      {/* Contextual Floating World Landmass Sculpt Quick Bar */}
      {doc.mode === "world" && activeTool === "world_land" && (
        <div
          role="toolbar"
          aria-label="Landmass Sculpt Brush Modes"
          style={{
            position: "absolute",
            top: 52,
            left: 14,
            zIndex: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: 4,
            borderRadius: 9,
            background: "rgba(15, 18, 26, 0.92)",
            border: "1px solid var(--border-strong)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
          }}
        >
          {(
            [
              { id: "raise" as WorldLandBrushMode, label: "Raise Land", key: "1", accent: "#F59E0B" },
              { id: "lower" as WorldLandBrushMode, label: "Lower Ocean", key: "2", accent: "#38BDF8" },
              { id: "smooth" as WorldLandBrushMode, label: "Smooth", key: "3", accent: "#34D399" },
              { id: "lake_carve" as WorldLandBrushMode, label: "Carve Lake", key: "4", accent: "#22D3EE" },
              { id: "lake_erase" as WorldLandBrushMode, label: "Fill Lake", key: "5", accent: "#FBBF24" },
            ]
          ).map((m) => {
            const effMode =
              altDown && worldLandMode === "raise"
                ? "lower"
                : altDown && worldLandMode === "lower"
                  ? "raise"
                  : worldLandMode;
            const isAct = effMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isAct}
                onClick={() => useDocumentStore.getState().setBrushParams({ worldLandMode: m.id })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: `1px solid ${isAct ? `${m.accent}CC` : "transparent"}`,
                  background: isAct ? `${m.accent}29` : "transparent",
                  color: isAct ? "#F8FAFC" : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: isAct ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{m.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.65 }}>
                  {m.key}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Contextual Floating Terrain Mode Bar (Brush / Smart Flood Fill / Rectangle / Polygon) */}
      {activeTool === "terrain" && (
        <div
          role="toolbar"
          aria-label="Terrain Paint & Fill Modes"
          style={{
            position: "absolute",
            top: 52,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 6px",
            borderRadius: 9,
            background: "rgba(15, 18, 26, 0.92)",
            border: "1px solid var(--border-strong)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
          }}
        >
          {(
            [
              { id: "brush" as TerrainMode, label: "Brush", key: "1", icon: <Paintbrush size={12} /> },
              { id: "flood" as TerrainMode, label: "Smart Fill", key: "2", icon: <PaintBucket size={12} /> },
              { id: "replace" as TerrainMode, label: "Replace", key: "3", icon: <RefreshCw size={12} /> },
              { id: "rect" as TerrainMode, label: "Rect", key: "4", icon: <Square size={12} /> },
              { id: "polygon" as TerrainMode, label: "Polygon", key: "5", icon: <Pentagon size={12} /> },
              { id: "erase" as TerrainMode, label: "Erase", key: "6", icon: <Eraser size={12} /> },
            ]
          ).map((m) => {
            const isAct = terrainMode === m.id;
            const isEr = m.id === "erase";
            const isRep = m.id === "replace";
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isAct}
                onClick={() => {
                  setDraftPoints([]);
                  setDraftSegmentCurves([]);
                  setPendingFreeArcEnd(null);
                  useDocumentStore.getState().setBrushParams({ terrainMode: m.id });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: `1px solid ${
                    isAct
                      ? isEr
                        ? "rgba(248, 113, 113, 0.78)"
                        : isRep
                          ? "rgba(52, 211, 153, 0.78)"
                          : "rgba(229, 169, 60, 0.72)"
                      : "transparent"
                  }`,
                  background: isAct
                    ? isEr
                      ? "rgba(248, 113, 113, 0.2)"
                      : isRep
                        ? "rgba(52, 211, 153, 0.18)"
                        : "rgba(229, 169, 60, 0.18)"
                    : "transparent",
                  color: isAct
                    ? isEr
                      ? "#FCA5A5"
                      : isRep
                        ? "#6EE7B7"
                        : "#FDE68A"
                    : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: isAct ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {m.icon}
                <span>{m.label}</span>
                {m.key && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.65 }}>
                    {m.key}
                  </span>
                )}
              </button>
            );
          })}

          {terrainMode === "replace" && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--border-subtle)", margin: "0 2px" }} />
              {(
                [
                  { id: "patch" as TerrainReplaceScope, label: "Patch" },
                  { id: "layer" as TerrainReplaceScope, label: "Layer" },
                  { id: "floor" as TerrainReplaceScope, label: "Floor" },
                  { id: "map" as TerrainReplaceScope, label: "Map" },
                ]
              ).map((sc) => {
                const act = terrainReplaceScope === sc.id;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    aria-pressed={act}
                    onClick={() => useDocumentStore.getState().setBrushParams({ terrainReplaceScope: sc.id })}
                    style={{
                      height: 22,
                      padding: "0 7px",
                      borderRadius: 5,
                      border: `1px solid ${act ? "rgba(52, 211, 153, 0.75)" : "transparent"}`,
                      background: act ? "rgba(52, 211, 153, 0.18)" : "transparent",
                      color: act ? "#6EE7B7" : "var(--text-muted)",
                      fontSize: 10,
                      fontWeight: act ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {sc.label}
                  </button>
                );
              })}
            </>
          )}

          {terrainMode === "erase" && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--border-subtle)", margin: "0 2px" }} />
              {(
                [
                  { id: "brush" as TerrainEraseShape, label: "Brush" },
                  { id: "room" as TerrainEraseShape, label: "Room" },
                  { id: "rect" as TerrainEraseShape, label: "Rect" },
                  { id: "polygon" as TerrainEraseShape, label: "Poly" },
                ]
              ).map((sh) => {
                const act = terrainEraseShape === sh.id;
                return (
                  <button
                    key={sh.id}
                    type="button"
                    aria-pressed={act}
                    onClick={() => useDocumentStore.getState().setBrushParams({ terrainEraseShape: sh.id })}
                    style={{
                      height: 22,
                      padding: "0 7px",
                      borderRadius: 5,
                      border: `1px solid ${act ? "rgba(248, 113, 113, 0.75)" : "transparent"}`,
                      background: act ? "rgba(248, 113, 113, 0.18)" : "transparent",
                      color: act ? "#FCA5A5" : "var(--text-muted)",
                      fontSize: 10,
                      fontWeight: act ? 700 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {sh.label}
                  </button>
                );
              })}
            </>
          )}

          {terrainMode === "flood" && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--border-subtle)", margin: "0 2px" }} />
              {(
                [
                  { key: "terrainBarrierWalls" as const, label: "Walls", on: terrainBarrierWalls },
                  { key: "terrainBarrierCaves" as const, label: "Caves", on: terrainBarrierCaves },
                  { key: "terrainBarrierWater" as const, label: "Water", on: terrainBarrierWater },
                ]
              ).map((b) => (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={b.on}
                  title={`${b.on ? "Stopping" : "Ignoring"} ${b.label} during Smart Fill`}
                  onClick={() => useDocumentStore.getState().setBrushParams({ [b.key]: !b.on })}
                  style={{
                    height: 22,
                    padding: "0 7px",
                    borderRadius: 5,
                    border: `1px solid ${b.on ? "rgba(34, 211, 238, 0.65)" : "transparent"}`,
                    background: b.on ? "rgba(34, 211, 238, 0.15)" : "transparent",
                    color: b.on ? "#67E8F9" : "var(--text-muted)",
                    fontSize: 10,
                    fontWeight: b.on ? 700 : 500,
                    cursor: "pointer",
                  }}
                >
                  {b.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Contextual Floating Cave & Dungeon Mode Bar (Cave Brush · Dungeon Rect · Polygon · Erase · Entrance · Underground) */}
      {activeTool === "cave" && (
        <div
          role="toolbar"
          aria-label="Cave & Dungeon Builder Modes"
          style={{
            position: "absolute",
            top: 52,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 6px",
            borderRadius: 9,
            background: "rgba(15, 18, 26, 0.92)",
            border: "1px solid var(--border-strong)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
          }}
        >
          {(
            [
              { id: "cave_brush" as CaveDrawMode, label: "Cave Brush", key: "1", icon: <Mountain size={12} /> },
              { id: "dungeon_rect" as CaveDrawMode, label: "Dungeon Room", key: "2", icon: <Square size={12} /> },
              { id: "polygon" as CaveDrawMode, label: "Polygon", key: "3", icon: <Pentagon size={12} /> },
              { id: "erase" as CaveDrawMode, label: "Erase / Pillar", key: "4 / E", icon: <Eraser size={12} /> },
              { id: "entrance" as CaveDrawMode, label: "Entrance / Exit", key: "5", icon: <DoorOpen size={12} /> },
            ]
          ).map((m) => {
            const isAltErasing = caveDrawMode === "cave_brush" && altDown;
            const isAct = isAltErasing ? m.id === "erase" : caveDrawMode === m.id;
            const isErase = m.id === "erase";
            const isEnt = m.id === "entrance";
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isAct}
                title={
                  m.id === "erase"
                    ? "Carve-Back Eraser (4 or E · or Hold Alt in Cave Brush) · Click-drag organic pillar or Shift+Drag crisp rectangular pillar"
                    : m.id === "cave_brush"
                      ? "Cave Brush (1) · Drag chambers & tunnels · Hold Alt (or press E) to erase rock back"
                      : `${m.label} (${m.key})`
                }
                onClick={() => {
                  setDraftPoints([]);
                  useDocumentStore.getState().setBrushParams({ caveDrawMode: m.id });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: `1px solid ${
                    isAct
                      ? isErase
                        ? "rgba(248, 113, 113, 0.75)"
                        : isEnt
                          ? "rgba(34, 211, 238, 0.78)"
                          : "rgba(52, 211, 153, 0.78)"
                      : "transparent"
                  }`,
                  background: isAct
                    ? isErase
                      ? "rgba(239, 68, 68, 0.2)"
                      : isEnt
                        ? "rgba(34, 211, 238, 0.18)"
                        : "rgba(16, 185, 129, 0.2)"
                    : "transparent",
                  color: isAct
                    ? isErase
                      ? "#FCA5A5"
                      : isEnt
                        ? "#A5F3FC"
                        : "#6EE7B7"
                    : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: isAct ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {m.icon}
                <span>{m.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.6 }}>
                  {m.key}
                </span>
              </button>
            );
          })}
          <span style={{ width: 1, height: 16, background: "var(--border-subtle)", margin: "0 2px" }} />
          <button
            type="button"
            aria-pressed={caveUndergroundFill}
            title="Toggle solid subterranean rock/void outside carved chambers vs outdoor rock rim"
            onClick={() =>
              useDocumentStore
                .getState()
                .updateActiveCaveSystem({ undergroundFill: !caveUndergroundFill }, true)
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              border: `1px solid ${caveUndergroundFill ? "rgba(229, 169, 60, 0.75)" : "transparent"}`,
              background: caveUndergroundFill ? "rgba(229, 169, 60, 0.18)" : "transparent",
              color: caveUndergroundFill ? "#FDE68A" : "var(--text-secondary)",
              fontSize: 11,
              fontWeight: caveUndergroundFill ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Layers size={12} />
            <span>{caveUndergroundFill ? "Underground: ON" : "Outdoor Rim"}</span>
          </button>
        </div>
      )}

      {/* Contextual Floating Object Stamp Bar (Above/Below Order · Auto-Rotate · Paint-In Drag) */}
      {activeTool === "stamp" && (
        <div
          role="toolbar"
          aria-label="Stamp Placement & Auto-Rotate Options"
          style={{
            position: "absolute",
            top: 52,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 6px",
            borderRadius: 9,
            background: "rgba(15, 18, 26, 0.92)",
            border: "1px solid var(--border-strong)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
          }}
        >
          <button
            type="button"
            aria-pressed={stampPlacementOrder === "above"}
            title="Place next asset ABOVE existing / last placed props on the same layer (U)"
            onClick={() => useDocumentStore.getState().setBrushParams({ stampPlacementOrder: "above" })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              border: `1px solid ${stampPlacementOrder === "above" ? "rgba(229, 169, 60, 0.72)" : "transparent"}`,
              background: stampPlacementOrder === "above" ? "rgba(229, 169, 60, 0.18)" : "transparent",
              color: stampPlacementOrder === "above" ? "#FDE68A" : "var(--text-secondary)",
              fontSize: 11,
              fontWeight: stampPlacementOrder === "above" ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <ArrowUpToLine size={12} />
            <span>Above</span>
          </button>
          <button
            type="button"
            aria-pressed={stampPlacementOrder === "below"}
            title="Slip next asset BELOW existing / last placed props on the same layer (U)"
            onClick={() => useDocumentStore.getState().setBrushParams({ stampPlacementOrder: "below" })}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              border: `1px solid ${stampPlacementOrder === "below" ? "rgba(34, 211, 238, 0.72)" : "transparent"}`,
              background: stampPlacementOrder === "below" ? "rgba(34, 211, 238, 0.16)" : "transparent",
              color: stampPlacementOrder === "below" ? "#67E8F9" : "var(--text-secondary)",
              fontSize: 11,
              fontWeight: stampPlacementOrder === "below" ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <ArrowDownToLine size={12} />
            <span>Below</span>
          </button>

          <div style={{ width: 1, height: 16, background: "var(--border-subtle)", margin: "0 2px" }} />

          <button
            type="button"
            aria-pressed={stampAutoRotate}
            title="Automatically rotate assets as you stamp or paint them in (configure Random / Follow Path / Step in Right Inspector)"
            onClick={() =>
              useDocumentStore.getState().setBrushParams({ stampAutoRotate: !stampAutoRotate })
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              border: `1px solid ${stampAutoRotate ? "rgba(167, 139, 250, 0.72)" : "transparent"}`,
              background: stampAutoRotate ? "rgba(139, 92, 246, 0.22)" : "transparent",
              color: stampAutoRotate ? "#DDD6FE" : "var(--text-secondary)",
              fontSize: 11,
              fontWeight: stampAutoRotate ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <RotateCw size={12} />
            <span>
              Auto-Rotate
              {stampAutoRotate
                ? ` · ${stampRotateMode === "follow" ? "Follow" : stampRotateMode === "step" ? "Step" : "Random"}`
                : ""}
            </span>
          </button>

          <button
            type="button"
            aria-pressed={stampPaintDrag}
            title="Click and drag to paint spaced trails of props onto the map in a single stroke"
            onClick={() =>
              useDocumentStore.getState().setBrushParams({ stampPaintDrag: !stampPaintDrag })
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              height: 24,
              padding: "0 8px",
              borderRadius: 6,
              border: `1px solid ${stampPaintDrag ? "rgba(52, 211, 153, 0.72)" : "transparent"}`,
              background: stampPaintDrag ? "rgba(16, 185, 129, 0.18)" : "transparent",
              color: stampPaintDrag ? "#6EE7B7" : "var(--text-secondary)",
              fontSize: 11,
              fontWeight: stampPaintDrag ? 700 : 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Paintbrush size={12} />
            <span>Paint-In</span>
          </button>
        </div>
      )}

      {activeTool === "water" && (
        <div
          role="group"
          aria-label="Water Studio Mode"
          style={{
            position: "absolute",
            top: 52,
            left: 14,
            zIndex: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: 4,
            borderRadius: 9,
            background: "rgba(15, 18, 26, 0.92)",
            border: "1px solid var(--border-strong)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
          }}
        >
          {(
            [
              { id: "lake_brush" as WaterDrawMode, label: "Lake Brush", key: "1", icon: <Droplets size={12} /> },
              { id: "river_path" as WaterDrawMode, label: "River Path", key: "2", icon: <Waves size={12} /> },
              { id: "polygon" as WaterDrawMode, label: "Lake Polygon", key: "3", icon: <Pentagon size={12} /> },
              { id: "erase" as WaterDrawMode, label: "Island / Erase", key: "4 / E", icon: <Eraser size={12} /> },
            ]
          ).map((m) => {
            const isAltErasing = waterDrawMode === "lake_brush" && altDown;
            const isAct = isAltErasing ? m.id === "erase" : waterDrawMode === m.id;
            const isErase = m.id === "erase";
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isAct}
                title={
                  m.id === "erase"
                    ? "Carve Dry Island / Sandbar (4 or E · or Hold Alt in Lake Brush)"
                    : m.id === "lake_brush"
                      ? "Lake Brush (1) · Drag organic lakes & coves · Hold Alt (or press E) to carve islands"
                      : m.id === "river_path"
                        ? "River Path (2) · Click points to trace a smooth variable-width river · Double-click or Enter to finish"
                        : "Lake Polygon (3) · Click vertices for precise shorelines, moats, canals, or chasms"
                }
                onClick={() => {
                  setDraftPoints([]);
                  const st = useDocumentStore.getState();
                  st.setSelection(null);
                  st.setBrushParams({ waterDrawMode: m.id });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: `1px solid ${
                    isAct
                      ? isErase
                        ? "rgba(251, 191, 36, 0.78)"
                        : "rgba(56, 189, 248, 0.8)"
                      : "transparent"
                  }`,
                  background: isAct
                    ? isErase
                      ? "rgba(251, 191, 36, 0.18)"
                      : "rgba(56, 189, 248, 0.2)"
                    : "transparent",
                  color: isAct
                    ? isErase
                      ? "#FDE68A"
                      : "#BAE6FD"
                    : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {activeTool === "wall" && (
        <div
          role="toolbar"
          aria-label="Wall Builder Mode"
          style={{
            position: "absolute",
            top: 52,
            left: 14,
            zIndex: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: 4,
            borderRadius: 9,
            background: "rgba(15, 18, 26, 0.92)",
            border: "1px solid var(--border-strong)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
            flexWrap: "wrap",
            maxWidth: "calc(100% - 28px)",
          }}
        >
          {(
            [
              {
                id: "free" as WallDrawMode,
                label: "Free",
                key: "1",
                title: "Free Wall (1) · Click vertices · Hold Shift for 45°/90° lock · C curves · Click start dot to close",
                icon: <Spline size={12} />,
              },
              {
                id: "box" as WallDrawMode,
                label: "Box",
                key: "2",
                title: "Box Room (2) · Drag corner-to-corner · Shift = Square · Ctrl = Center-Out · Q/E rotates for angled streets",
                icon: <Square size={12} />,
              },
              {
                id: "circle" as WallDrawMode,
                label: "Tower",
                key: "3",
                title: "Circle / Polygon Tower (3) · Drag from center · Round, Oval, Hex (6), Octagon (8), or 12-gon · Q/E rotates",
                icon: <Circle size={12} />,
              },
              {
                id: "arc" as WallDrawMode,
                label: "Arc",
                key: "4",
                title: "3-Point Arc / Bay Wall (4) · Click Start → Click End → Pull circular bulge · Shift snaps to 90°/180°",
                icon: (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                    <path d="M1.5 9.5 Q6 1 10.5 9.5" />
                    <circle cx="1.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
                    <circle cx="10.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                ),
              },
              {
                id: "split" as WallDrawMode,
                label: "Split / Cut",
                key: "5",
                title: "Split / Breach (5) · Click any wall to carve an open archway/breach or split a wall segment cleanly",
                icon: <Scissors size={12} />,
              },
              {
                id: "corridor" as WallDrawMode,
                label: "Corridor",
                key: "6",
                title: "Corridor Path (6) · Click hallway centerline points · Double-click / Enter builds parallel corridor walls · [ / ] width",
                icon: (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M1.5 3.5 H8.5 V10.5" />
                    <path d="M1.5 8.5 H3.5 V10.5" />
                  </svg>
                ),
              },
            ]
          ).map((m) => {
            const isAct = wallDrawMode === m.id;
            const isCut = m.id === "split";
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isAct}
                title={m.title}
                onClick={() => {
                  setDraftPoints([]);
                  useDocumentStore.getState().setBrushParams({ wallDrawMode: m.id });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: `1px solid ${
                    isAct
                      ? isCut
                        ? "rgba(248, 113, 113, 0.8)"
                        : "rgba(245, 158, 11, 0.82)"
                      : "transparent"
                  }`,
                  background: isAct
                    ? isCut
                      ? "rgba(248, 113, 113, 0.18)"
                      : "rgba(245, 158, 11, 0.2)"
                    : "transparent",
                  color: isAct
                    ? isCut
                      ? "#FCA5A5"
                      : "#FDE68A"
                    : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: isAct ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {m.icon}
                <span>{m.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.6 }}>
                  {m.key}
                </span>
              </button>
            );
          })}

          <span style={{ width: 1, height: 16, background: "var(--border-subtle)", margin: "0 2px" }} />

          {(wallDrawMode === "free" || wallDrawMode === "corridor") && (
            <button
              type="button"
              aria-pressed={wallCurved}
              title="Toggle Curved Spline vs Straight Wall Segments (C)"
              onClick={() => useDocumentStore.getState().setBrushParams({ wallCurved: !wallCurved })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 24,
                padding: "0 7px",
                borderRadius: 6,
                border: `1px solid ${wallCurved ? "rgba(34, 211, 238, 0.75)" : "transparent"}`,
                background: wallCurved ? "rgba(34, 211, 238, 0.16)" : "transparent",
                color: wallCurved ? "#A5F3FC" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: wallCurved ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Curved
            </button>
          )}

          {wallDrawMode === "box" && (
            <button
              type="button"
              title="Box Rotation Angle (Q / E or Shift+Wheel to rotate 15° · Click to reset to 0°)"
              onClick={() =>
                useDocumentStore.getState().setBrushParams({
                  wallBoxRotationDeg: wallBoxRotationDeg === 0 ? 45 : 0,
                })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 24,
                padding: "0 7px",
                borderRadius: 6,
                border: `1px solid ${wallBoxRotationDeg !== 0 ? "rgba(34, 211, 238, 0.75)" : "transparent"}`,
                background: wallBoxRotationDeg !== 0 ? "rgba(34, 211, 238, 0.16)" : "transparent",
                color: wallBoxRotationDeg !== 0 ? "#A5F3FC" : "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                fontWeight: wallBoxRotationDeg !== 0 ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <RotateCw size={11} />
              <span>{Math.round(wallBoxRotationDeg)}°</span>
            </button>
          )}

          {wallDrawMode === "circle" && (
            <>
              {(
                [
                  { id: "round" as WallPolygonShape, label: "Round" },
                  { id: "oval" as WallPolygonShape, label: "Oval" },
                  { id: "hex" as WallPolygonShape, label: "6" },
                  { id: "octagon" as WallPolygonShape, label: "8" },
                  { id: "dodecagon" as WallPolygonShape, label: "12" },
                ]
              ).map((sh) => {
                const act = wallPolygonShape === sh.id;
                return (
                  <button
                    key={sh.id}
                    type="button"
                    aria-pressed={act}
                    onClick={() => useDocumentStore.getState().setBrushParams({ wallPolygonShape: sh.id })}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 24,
                      padding: "0 6px",
                      borderRadius: 6,
                      border: `1px solid ${act ? "rgba(229, 169, 60, 0.78)" : "transparent"}`,
                      background: act ? "rgba(229, 169, 60, 0.18)" : "transparent",
                      color: act ? "#FDE68A" : "var(--text-secondary)",
                      fontSize: 10.5,
                      fontWeight: act ? 700 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sh.label}
                  </button>
                );
              })}
            </>
          )}

          {wallDrawMode === "split" && (
            <>
              {(
                [
                  { id: "breach" as WallSplitSubMode, label: `Breach (${wallBreachWidthCells.toFixed(1)}sq)` },
                  { id: "split" as WallSplitSubMode, label: "Split Point" },
                ]
              ).map((sub) => {
                const act = wallSplitSubMode === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    aria-pressed={act}
                    onClick={() => useDocumentStore.getState().setBrushParams({ wallSplitSubMode: sub.id })}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 24,
                      padding: "0 7px",
                      borderRadius: 6,
                      border: `1px solid ${act ? "rgba(248, 113, 113, 0.75)" : "transparent"}`,
                      background: act ? "rgba(248, 113, 113, 0.16)" : "transparent",
                      color: act ? "#FCA5A5" : "var(--text-secondary)",
                      fontSize: 10.5,
                      fontWeight: act ? 700 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </>
          )}

          {wallDrawMode === "corridor" && (
            <>
              <button
                type="button"
                title="Cycle Corridor Hallway Width (1.5 / 2.0 / 2.5 / 3.0 / 4.0 sq · or use [ / ] / Alt+Wheel)"
                onClick={() => {
                  const steps = [1.5, 2.0, 2.5, 3.0, 4.0];
                  const next = steps.find((v) => v > wallCorridorWidthCells + 0.05) ?? steps[0];
                  useDocumentStore.getState().setBrushParams({ wallCorridorWidthCells: next });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 24,
                  padding: "0 7px",
                  borderRadius: 6,
                  border: "1px solid rgba(245, 158, 11, 0.45)",
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#FDE68A",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                W {wallCorridorWidthCells.toFixed(1)}sq
              </button>
              <button
                type="button"
                aria-pressed={wallCorridorCapEnds}
                title="Seal Corridor End Caps into a Closed Room Loop"
                onClick={() =>
                  useDocumentStore.getState().setBrushParams({ wallCorridorCapEnds: !wallCorridorCapEnds })
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  height: 24,
                  padding: "0 7px",
                  borderRadius: 6,
                  border: `1px solid ${wallCorridorCapEnds ? "rgba(229, 169, 60, 0.75)" : "transparent"}`,
                  background: wallCorridorCapEnds ? "rgba(229, 169, 60, 0.16)" : "transparent",
                  color: wallCorridorCapEnds ? "#FDE68A" : "var(--text-secondary)",
                  fontSize: 10.5,
                  fontWeight: wallCorridorCapEnds ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Cap Ends
              </button>
            </>
          )}

          {wallDrawMode !== "split" && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--border-subtle)", margin: "0 2px" }} />
              <button
                type="button"
                aria-pressed={wallSnapToWalls}
                title="Magnetic Wall Snap — Snap starts & corners cleanly onto existing wall endpoints & edges (Hold Alt to bypass)"
                onClick={() =>
                  useDocumentStore.getState().setBrushParams({ wallSnapToWalls: !wallSnapToWalls })
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                  padding: "0 7px",
                  borderRadius: 6,
                  border: `1px solid ${wallSnapToWalls ? "rgba(34, 211, 238, 0.72)" : "transparent"}`,
                  background: wallSnapToWalls ? "rgba(34, 211, 238, 0.14)" : "transparent",
                  color: wallSnapToWalls ? "#67E8F9" : "var(--text-secondary)",
                  fontSize: 10.5,
                  fontWeight: wallSnapToWalls ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <Magnet size={11} />
                <span>Snap</span>
              </button>
              <button
                type="button"
                aria-pressed={wallAutoFillClosed}
                title="Auto-Fill Closed Rooms — Automatically fill interior floor terrain when creating a Box, Tower, Corridor, or closed loop"
                onClick={() =>
                  useDocumentStore.getState().setBrushParams({ wallAutoFillClosed: !wallAutoFillClosed })
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                  padding: "0 7px",
                  borderRadius: 6,
                  border: `1px solid ${wallAutoFillClosed ? "rgba(52, 211, 153, 0.72)" : "transparent"}`,
                  background: wallAutoFillClosed ? "rgba(16, 185, 129, 0.16)" : "transparent",
                  color: wallAutoFillClosed ? "#6EE7B7" : "var(--text-secondary)",
                  fontSize: 10.5,
                  fontWeight: wallAutoFillClosed ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <PaintBucket size={11} />
                <span>Auto-Floor</span>
              </button>
            </>
          )}
        </div>
      )}

      {activeTool === "roof" && (
        <div
          role="toolbar"
          aria-label="Roof Studio Mode & Style"
          style={{
            position: "absolute",
            top: 52,
            left: 14,
            zIndex: 18,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            padding: 4,
            borderRadius: 9,
            background: "rgba(15, 18, 26, 0.92)",
            border: "1px solid var(--border-strong)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
            flexWrap: "wrap",
            maxWidth: "calc(100% - 28px)",
          }}
        >
          {(
            [
              { id: "ridge_path" as RoofDrawMode, label: "Ridge Path", key: "1", icon: <Spline size={12} /> },
              { id: "box" as RoofDrawMode, label: "Box Roof", key: "2", icon: <Square size={12} /> },
              { id: "cone" as RoofDrawMode, label: "Tower / Dome", key: "3", icon: <Circle size={12} /> },
              { id: "auto_room" as RoofDrawMode, label: "Auto-Room", key: "4", icon: <Sparkles size={12} /> },
            ]
          ).map((m) => {
            const isAct = roofDrawMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={isAct}
                title={
                  m.id === "ridge_path"
                    ? "Ridge Path (1) · Click points along roof ridge (works like Path tool · Double-click / Enter to finish)"
                    : m.id === "box"
                      ? "Box Roof (2) · Click & drag corner-to-corner over walls (+ auto eave overhang · Shift for square · Q/E rotates ridge 90°)"
                      : m.id === "cone"
                        ? "Tower / Dome (3) · Click center and drag outward for conical or polygonal turret roof"
                        : "Auto-Roof Room (4) · 1-click inside any walled room to fit an oriented roof with overhang"
                }
                onClick={() => {
                  setDraftPoints([]);
                  const st = useDocumentStore.getState();
                  st.setBrushParams({
                    roofDrawMode: m.id,
                    ...(m.id === "cone"
                      ? { roofStyle: "cone" }
                      : st.roofStyle === "cone"
                        ? { roofStyle: "hip" }
                        : {}),
                  });
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  height: 24,
                  padding: "0 8px",
                  borderRadius: 6,
                  border: `1px solid ${isAct ? "rgba(251, 146, 60, 0.82)" : "transparent"}`,
                  background: isAct ? "rgba(251, 146, 60, 0.2)" : "transparent",
                  color: isAct ? "#FED7AA" : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: isAct ? 700 : 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {m.icon}
                <span>{m.label}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.6 }}>
                  {m.key}
                </span>
              </button>
            );
          })}

          {roofDrawMode !== "cone" && (
            <>
              <span style={{ width: 1, height: 16, background: "var(--border-subtle)", margin: "0 2px" }} />
              {(
                [
                  { id: "gable" as RoofStyle, label: "Gable" },
                  { id: "hip" as RoofStyle, label: "Hip" },
                  { id: "shed" as RoofStyle, label: "Shed" },
                  { id: "mansard" as RoofStyle, label: "Mansard" },
                ]
              ).map((s) => {
                const isAct = roofStyle === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={isAct}
                    onClick={() => useDocumentStore.getState().setBrushParams({ roofStyle: s.id })}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      height: 24,
                      padding: "0 7px",
                      borderRadius: 6,
                      border: `1px solid ${isAct ? "rgba(229, 169, 60, 0.78)" : "transparent"}`,
                      background: isAct ? "rgba(229, 169, 60, 0.18)" : "transparent",
                      color: isAct ? "#FDE68A" : "var(--text-secondary)",
                      fontSize: 11,
                      fontWeight: isAct ? 700 : 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </>
          )}

          {roofDrawMode === "ridge_path" && (
            <button
              type="button"
              aria-pressed={roofCurved}
              title="Toggle Smooth Curved Ridge vs Crisp Mitered Corner Ridge (C)"
              onClick={() => useDocumentStore.getState().setBrushParams({ roofCurved: !roofCurved })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 24,
                padding: "0 7px",
                borderRadius: 6,
                border: `1px solid ${roofCurved ? "rgba(34, 211, 238, 0.75)" : "transparent"}`,
                background: roofCurved ? "rgba(34, 211, 238, 0.16)" : "transparent",
                color: roofCurved ? "#A5F3FC" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: roofCurved ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <span>Curved</span>
            </button>
          )}

          {roofStyle === "shed" && roofDrawMode !== "cone" && (
            <button
              type="button"
              aria-pressed={roofFlipSlope}
              title="Flip Lean-To Slope Direction (X)"
              onClick={() =>
                useDocumentStore.getState().setBrushParams({ roofFlipSlope: !roofFlipSlope })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 24,
                padding: "0 7px",
                borderRadius: 6,
                border: `1px solid ${roofFlipSlope ? "rgba(34, 211, 238, 0.75)" : "transparent"}`,
                background: roofFlipSlope ? "rgba(34, 211, 238, 0.16)" : "transparent",
                color: roofFlipSlope ? "#A5F3FC" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: roofFlipSlope ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <span>Flip Slope</span>
            </button>
          )}

          {roofDrawMode === "box" && (
            <button
              type="button"
              aria-pressed={roofRotateBoxRidge}
              title="Rotate Box Roof Ridge Axis 90° (Q / E)"
              onClick={() =>
                useDocumentStore
                  .getState()
                  .setBrushParams({ roofRotateBoxRidge: !roofRotateBoxRidge })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                height: 24,
                padding: "0 7px",
                borderRadius: 6,
                border: `1px solid ${roofRotateBoxRidge ? "rgba(34, 211, 238, 0.75)" : "transparent"}`,
                background: roofRotateBoxRidge ? "rgba(34, 211, 238, 0.16)" : "transparent",
                color: roofRotateBoxRidge ? "#A5F3FC" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: roofRotateBoxRidge ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <RotateCw size={11} />
              <span>Ridge 90°</span>
            </button>
          )}
        </div>
      )}

      {preferences.showToolHints && (
        <div className="dc-canvas-hint-pill">
          {eyedropperTarget
            ? "Eyedropper Active · Click anywhere on the map to sample a color · Press Esc to cancel"
            : activeTool === "wall"
              ? wallDrawMode === "box"
                ? "Box Room (2) · Drag corner-to-corner for a closed room · Hold Shift for square · Hold Ctrl for center-out · Q/E or Shift+Wheel rotates 15°"
                : wallDrawMode === "circle"
                  ? "Circle / Tower (3) · Click center & drag outward · Pick Round / Oval / 6 / 8 / 12 in bar · Hold Shift to snap radius · Q/E rotates"
                  : wallDrawMode === "arc"
                    ? draftPoints.length === 0
                      ? "3-Point Arc (4) · Step 1/3: Click arc start point (snaps magnetically to existing wall corners & edges)"
                      : draftPoints.length === 1
                        ? "3-Point Arc (4) · Step 2/3: Click arc end point · Hold Shift for 45°/90° chord alignment"
                        : "3-Point Arc (4) · Step 3/3: Move cursor to shape the circular bow & click to commit · Hold Shift to snap 90° / 180°"
                    : wallDrawMode === "split"
                      ? wallSplitSubMode === "breach"
                        ? "Carve Breach (5) · Click any wall to punch a clean open archway/breach · [ / ] or Alt+Wheel adjusts breach width"
                        : "Split Seam (5) · Click any wall to split it into independent segments (or open a closed Box Room loop)"
                      : wallDrawMode === "corridor"
                        ? "Corridor Path (6) · Click centerline points (Shift = 45° lock · C = Curved) · Double-click / Enter builds parallel walls · [ / ] adjusts width"
                        : "Free Wall (1) · Click points (Shift = 45°/90° lock · C = Curved · Backspace = undo point · Click start dot to close) · Alt bypasses snap"
              : activeTool === "roof"
              ? roofDrawMode === "box"
                ? "Box Roof (2) · Drag corner-to-corner over walls (+ auto overhang) · Hold Shift for square · Q/E flips ridge 90° · Shift+Wheel rotates sun"
                : roofDrawMode === "cone"
                  ? "Tower / Dome (3) · Click spire center and drag outward to set turret radius · Shift+Wheel rotates sun · Pick Round/6/8/12 facets in Inspector"
                  : roofDrawMode === "auto_room"
                    ? "Auto-Roof Room (4) · Click inside any enclosed walled building to fit a roof automatically (works on ROOF level over floor below too!)"
                    : "Ridge Path (1) · Click points along the roof ridge (like Path tool) · Double-click / Enter to finish · [ / ] or Alt+Wheel adjusts span · C curves"
              : activeTool === "water"
              ? waterDrawMode === "river_path"
                ? "River Path (2) · Click points along stream course · Double-click or Enter to finish · [ / ] or Alt+Wheel adjusts width"
                : waterDrawMode === "polygon"
                  ? "Lake Polygon (3) · Click coastline vertices · Click start dot, Double-click, or Enter to close · Backspace undoes vertex"
                  : waterDrawMode === "erase"
                    ? "Island / Erase (4 / E) · Drag to carve dry islands or trim shorelines · Press E to return to Lake Brush"
                    : altDown
                      ? "Lake Brush → ISLAND / ERASE (Alt Held) · Drag to carve dry islands or trim shorelines · Release Alt to paint"
                      : "Lake Brush (1) · Drag to paint or seamlessly extend matching water · Hold Alt (or E) to carve islands/trim shores · [ / ] resizes"
              : activeTool === "terrain"
              ? terrainMode === "flood"
                ? "Smart Room Fill (K) · Click inside any walled room or open yard to fill cleanly to the walls · Pick texture in Vault"
                : terrainMode === "rect"
                  ? "Rectangle Fill (R) · Click & drag corner-to-corner to fill crisp buildings or plazas · Hold Alt for free snap"
                  : terrainMode === "polygon"
                    ? "Polygon Fill · Click corners of any custom area · Click start dot, Double-click, or Enter to fill · Backspace undoes corner"
                    : TOOL_HINTS.terrain
              : activeTool === "cave"
                ? caveDrawMode === "entrance"
                  ? "Entrance / Exit (5) · Click wall to open with fade-to-terrain · Drag gold knobs for Width, cyan arrow for Fade, or center dot to slide"
                  : caveDrawMode === "dungeon_rect"
                    ? "Dungeon Room (2) · Click & drag corner-to-corner to carve crisp auto-walled rooms (overlapping rooms auto-merge!)"
                    : caveDrawMode === "erase"
                      ? "Carve-Back Eraser (4 / E) · Drag organic rock pillar, or hold Shift+Drag for crisp rectangular column · Press E to return to Brush · [ / ] or Alt+Wheel resizes"
                      : caveDrawMode === "polygon"
                        ? "Polygon Chamber (3) · Click corners, then click start dot / Double-click / Enter to carve custom angled chamber"
                        : altDown
                          ? "Cave Brush → ERASE (Alt Held) · Drag to carve back rock/pillars · Add Shift for crisp rectangle · Release Alt to paint"
                          : "Cave Brush (1) · Drag organic chambers & tunnels · Hold Alt (or press E) to Erase · [ / ] or Alt+Wheel resizes"
                : TOOL_HINTS[activeTool]}
        </div>
      )}
    </div>
  );
});

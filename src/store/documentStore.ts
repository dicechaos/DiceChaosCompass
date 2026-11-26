import { create } from "zustand";
import { createBlankMap, createFunicularShowcaseMap } from "@/data/funicularShowcaseMap";
import { createHiddenSloopMap } from "@/data/hiddenSloopMap";
import { createLakeYachtMap } from "@/data/lakeYachtMap";
import { createSovereignTempleMap } from "@/data/sovereignTempleMap";
import { createTrofraderraWorldMap } from "@/data/trofraderraWorldMap";
import { createBlankWorldMap, createWorldShowcaseMap } from "@/data/worldShowcaseMap";
import {
  BUILTIN_OBJECT_TEMPLATES,
  buildTemplateFromObjects,
  expandTemplateAtPoint,
} from "@/data/objectTemplates";
import {
  applyBulkAssetSwapToDoc,
  cleanSourceRefLabel,
} from "@/engine/assetSwapEngine";
import type { ExternalImportSummary } from "@/engine/wonderdraftMapImport";
import {
  createDetailWorldFromBounds,
  generateLandmassHeightmap,
  sculptWorldHeightmap,
} from "@/engine/worldEngine";
import { getWorldThemeById } from "@/engine/worldThemes";
import type { WorldNameCultureId } from "@/engine/worldNameGen";
import {
  computeCaveGeometry,
  createDefaultCaveSystem,
  getCaveThemePreset,
} from "@/engine/caveEngine";
import {
  bindFileHandle,
  getBoundFileHandle,
  pickOpenMapFile,
  pickSaveFileLocation,
  triggerFallbackDownload,
  unbindFileHandle,
  writeJsonToHandle,
} from "@/engine/fileSaveService";
import {
  computeDefaultWallEdgeBulge,
  convertLegacyWallCurveToSegments,
  generateScatterPlacements,
  getWallSegmentCount,
  normalizeWallSegmentCurves,
} from "@/engine/geometry";
import {
  findPreferredLayerForKind,
  getNextDefaultLayerName,
  getOnionSkinReferenceLevel,
  LAYER_KIND_STACK_ORDER,
  toolToLayerKind,
  upgradeLegacyLayerName,
} from "@/engine/layerMeta";
import { getRoofPreset } from "@/engine/roofEngine";
import {
  isTerrainStrokeCoveredByFlood,
  makeClosedWallPolygon,
  makeRectPolygon,
} from "@/engine/terrainFill";
import { carveWallBreachAtArcLength, splitWallAtArcLength } from "@/engine/wallEngine";
import {
  brushStrokeOverlapsWaterRegion,
  buildWaterBrushShape,
  getWaterPreset,
  pointInWaterRegion,
  subtractBrushFromWaterRegion,
  unionWaterRegionsWithBrush,
} from "@/engine/waterEngine";
import {
  DEFAULT_PREFERENCES,
  DEFAULT_RECOLOR,
  type AppPreferences,
  type BlendModeName,
  type CaveDrawMode,
  type CaveDungeonSystem,
  type CaveEntranceOpening,
  type CaveOperation,
  type CaveThresholdStyle,
  type DcMapDocument,
  type DmNotePin,
  type GridType,
  type LayerKind,
  type LevelKind,
  type LightNode,
  type MapLayer,
  type MapLevel,
  type ObjectStamp,
  type ObjectTemplate,
  type ObjectTemplateCategory,
  type Point2D,
  type PortalNode,
  type RgbRecolor,
  type RoofDrawMode,
  type RoofRidgeCapStyle,
  type RoofStructure,
  type RoofStyle,
  type ScatterZone,
  type SnapMode,
  type SplinePath,
  type StampPlacementOrder,
  type StampRotateMode,
  type TerrainEraseShape,
  type TerrainMode,
  type TerrainReplaceScope,
  type TerrainStroke,
  type ToolId,
  type WallDrawMode,
  type WallPolygonShape,
  type WallSegment,
  type WallSplitSubMode,
  type WaterBodyKind,
  type WaterDrawMode,
  type WaterRegion,
  type WorldBiomeBrushPattern,
  type WorldBiomePaintTarget,
  type WorldBiomeStroke,
  type WorldCartographyOverlays,
  type WorldLabel,
  type WorldLabelBoxStyle,
  type WorldLabelCategory,
  type WorldLandBrushMode,
  type WorldLandmassPreset,
  type WorldRegion,
  type WorldRiver,
  type WorldSubMapPin,
  type WorldThemeConfig,
  type WorldTrail,
  type WorldTrailStyle,
} from "@/types/map";

const PREFS_STORAGE_KEY = "dice-chaos-compass-prefs-v1";
const LEGACY_PREFS_STORAGE_KEY = "dice-chaos-maps-prefs-v1";
const SWATCHES_STORAGE_KEY = "dice-chaos-compass-swatches-v1";
const LEGACY_SWATCHES_STORAGE_KEY = "dice-chaos-maps-swatches-v1";
const RECENT_TERRAINS_STORAGE_KEY = "dice-chaos-compass-recent-terrains-v1";
const LEGACY_RECENT_TERRAINS_STORAGE_KEY = "dice-chaos-maps-recent-terrains-v1";
const OBJECT_TEMPLATES_STORAGE_KEY = "dice-chaos-compass-object-templates-v1";
const LEGACY_OBJECT_TEMPLATES_STORAGE_KEY = "dice-chaos-maps-object-templates-v1";
const AUTOSAVE_STORAGE_KEY = "dice-chaos-compass-autosave-v33";
const LEGACY_AUTOSAVE_STORAGE_KEY = "dice-chaos-maps-autosave-v33";
const MAX_HISTORY = 60;

function readStorageWithLegacyFallback(primaryKey: string, legacyKey: string): string | null {
  return localStorage.getItem(primaryKey) ?? localStorage.getItem(legacyKey);
}

function loadObjectTemplates(): ObjectTemplate[] {
  let saved: ObjectTemplate[] = [];
  try {
    const raw = readStorageWithLegacyFallback(
      OBJECT_TEMPLATES_STORAGE_KEY,
      LEGACY_OBJECT_TEMPLATES_STORAGE_KEY,
    );
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        saved = parsed.filter(
          (t): t is ObjectTemplate =>
            Boolean(t && typeof t.id === "string" && typeof t.name === "string" && Array.isArray(t.items)),
        );
      }
    }
  } catch {
    // Ignore storage read errors
  }
  const builtInIds = new Set(BUILTIN_OBJECT_TEMPLATES.map((t) => t.id));
  const userOnly = saved.filter((t) => !builtInIds.has(t.id));
  return [...userOnly, ...BUILTIN_OBJECT_TEMPLATES];
}

function saveUserObjectTemplates(templates: ObjectTemplate[]) {
  try {
    const userOnly = templates.filter((t) => !t.isBuiltIn);
    localStorage.setItem(OBJECT_TEMPLATES_STORAGE_KEY, JSON.stringify(userOnly));
  } catch {
    // Ignore storage write errors
  }
}

type LayerArrayField =
  | "objects"
  | "walls"
  | "portals"
  | "paths"
  | "roofs"
  | "waterRegions"
  | "lights"
  | "dmNotes";

function patchLayerItemInDoc<K extends LayerArrayField>(
  doc: DcMapDocument,
  layerId: string,
  field: K,
  itemId: string,
  partial: Partial<NonNullable<MapLayer[K]>[number]>,
): DcMapDocument | null {
  const layerIdx = doc.layers.findIndex((l) => l.id === layerId);
  if (layerIdx < 0) return null;
  const layer = doc.layers[layerIdx];
  const arr = layer[field] as Array<{ id: string }> | undefined;
  if (!arr) return null;
  const itemIdx = arr.findIndex((x) => x.id === itemId);
  if (itemIdx < 0) return null;
  const nextArr = arr.slice();
  nextArr[itemIdx] = { ...arr[itemIdx], ...partial };
  const nextLayers = doc.layers.slice();
  nextLayers[layerIdx] = { ...layer, [field]: nextArr };
  return { ...doc, layers: nextLayers };
}

type WorldArrayField = "rivers" | "trails" | "regions" | "labels" | "subMapPins";

function patchWorldItemInDoc<K extends WorldArrayField>(
  doc: DcMapDocument,
  field: K,
  itemId: string,
  partial: Partial<NonNullable<DcMapDocument["world"]>[K][number]>,
): DcMapDocument | null {
  const w = doc.world;
  if (!w) return null;
  const arr = w[field] as Array<{ id: string }>;
  const itemIdx = arr.findIndex((x) => x.id === itemId);
  if (itemIdx < 0) return null;
  const nextArr = arr.slice();
  nextArr[itemIdx] = { ...arr[itemIdx], ...partial };
  return {
    ...doc,
    world: { ...w, [field]: nextArr },
  };
}

export interface DocHistoryBucket {
  undo: DcMapDocument[];
  redo: DcMapDocument[];
}

function normalizeLoadedDoc(raw: DcMapDocument): DcMapDocument {
  const levels: MapLevel[] =
    Array.isArray(raw.levels) && raw.levels.length > 0
      ? raw.levels
      : [
          { id: "lvl-ground", shortCode: "1F", name: "Street & Ground Level", kind: "ground", elevationFt: 0, visible: true },
          { id: "lvl-roofs", shortCode: "ROOF", name: "Roofs", kind: "roof", elevationFt: 16, visible: false },
        ];
  const validLevelIds = new Set(levels.map((l) => l.id));
  const activeLevelId = validLevelIds.has(raw.activeLevelId) ? raw.activeLevelId : levels[0].id;
  const layers = (raw.layers ?? []).map((l) => ({
    ...l,
    name: upgradeLegacyLayerName(l.id, l.name),
    levelId: validLevelIds.has(l.levelId) ? l.levelId : activeLevelId,
    objects: l.objects?.map((o) => ({
      ...o,
      recolor: { ...DEFAULT_RECOLOR, ...(o.recolor ?? {}) },
    })),
  }));
  return {
    ...raw,
    levels,
    activeLevelId,
    layers,
    activeLayerId: layers.some((l) => l.id === raw.activeLayerId)
      ? raw.activeLayerId
      : layers[0]?.id ?? "layer-objects",
  };
}

const DEFAULT_CUSTOM_SWATCHES = ["#0EA5E9", "#E5A93C", "#DC2626", "#10B981", "#8B5CF6", "#9A3412"];

function loadCustomSwatches(): string[] {
  try {
    const raw = readStorageWithLegacyFallback(SWATCHES_STORAGE_KEY, LEGACY_SWATCHES_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === "string").slice(0, 18);
    }
  } catch {
    // Ignore storage read errors
  }
  return [...DEFAULT_CUSTOM_SWATCHES];
}

function saveCustomSwatches(swatches: string[]) {
  try {
    localStorage.setItem(SWATCHES_STORAGE_KEY, JSON.stringify(swatches));
  } catch {
    // Ignore storage write errors
  }
}

const DEFAULT_RECENT_TERRAINS = [
  "terrain/berlin_wet_cobble.png",
  "terrain/herringbone_parquet.png",
  "core-fantasy/terrain/cavern_rough_stone.png",
];

function sanitizeTerrainAssetId(id: string): string {
  const clean = id.trim();
  if (clean === "terrain/parlor_herringbone.png") {
    return "terrain/herringbone_parquet.png";
  }
  return clean;
}

function loadRecentTerrains(): string[] {
  try {
    const raw = readStorageWithLegacyFallback(RECENT_TERRAINS_STORAGE_KEY, LEGACY_RECENT_TERRAINS_STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const dedup: string[] = [];
        for (const item of arr) {
          if (typeof item !== "string") continue;
          const clean = sanitizeTerrainAssetId(item);
          if (clean.length > 0 && !dedup.includes(clean)) {
            dedup.push(clean);
          }
          if (dedup.length >= 3) break;
        }
        if (dedup.length > 0) return dedup;
      }
    }
  } catch {
    // Ignore storage read errors
  }
  return [...DEFAULT_RECENT_TERRAINS];
}

function pushRecentTerrain(list: string[], assetId: string): string[] {
  const clean = sanitizeTerrainAssetId(assetId);
  if (!clean) return list;
  const next = [clean, ...list.map(sanitizeTerrainAssetId).filter((id) => id !== clean)].slice(0, 3);
  try {
    localStorage.setItem(RECENT_TERRAINS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage write errors
  }
  return next;
}

export type ColorableToolKey = "wall" | "path" | "portal" | "terrain" | "roof";
export type EyedropperTarget = null | "stamp" | "selection" | ColorableToolKey;

function loadPrefs(): AppPreferences {
  try {
    const raw = readStorageWithLegacyFallback(PREFS_STORAGE_KEY, LEGACY_PREFS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore storage read errors in restricted environments
  }
  return { ...DEFAULT_PREFERENCES };
}

function savePrefs(prefs: AppPreferences) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage write errors
  }
}

export interface SelectionRef {
  kind:
    | "object"
    | "light"
    | "wall"
    | "portal"
    | "path"
    | "roof"
    | "water"
    | "scatter"
    | "dm_note"
    | "cave_entrance"
    | "world_river"
    | "world_trail"
    | "world_region"
    | "world_label"
    | "world_pin";
  layerId: string;
  id: string;
}

export interface ToastItem {
  id: string;
  message: string;
  tone: "info" | "success" | "warning";
}

interface DocumentStoreState {
  documents: DcMapDocument[];
  activeDocId: string;
  historyByDocId: Record<string, DocHistoryBucket>;
  dirtyDocIds: Record<string, boolean>;
  undoStack: DcMapDocument[];
  redoStack: DcMapDocument[];
  dirty: boolean;
  lastAutosavedAt: number | null;
  savedFileNameByDocId: Record<string, string>;
  autosaveEnabledByDocId: Record<string, boolean>;
  lastSavedAtByDocId: Record<string, number>;

  activeTool: ToolId;
  snapMode: SnapMode;
  lastSnapMode: "grid" | "half";
  dmViewMode: boolean; // Toggle between DM View (shows DM Notes & VTT overlays) vs Player View
  showVttOverlay: boolean;
  showScatterOutlines: boolean;
  showOnionSkin: boolean; // 30% ghost blueprint of adjacent floor (great for aligning stairs, traps & basements!)
  filterLayersByFloor: boolean; // Keep Layers dock tidy on multi-story maps
  isolateActiveFloor: boolean; // Solo active floor on canvas without mutating saved layer visibility
  lockLowerFloors: boolean; // Prevent accidental clicks on lower-elevation floors while editing upper stories
  soloLayerId: string | null; // Currently soloed layer ID (Alt+Click Eye)
  soloVisibilityBackup: Record<string, boolean> | null; // Saved sibling visibilities while a layer is soloed

  selection: SelectionRef | null;
  selectedWallSegmentIndex: number | null;
  copiedObject: ObjectStamp | null;
  copiedRecolor: RgbRecolor | null;

  // Explicit per-tool material selections so Wall/Path/Portal/Terrain tools always show & use chosen styles
  activeWallAssetId: string;
  activePathAssetId: string;
  activePortalAssetId: string;
  activeTerrainAssetId: string;
  /** Up to 3 most recently used floor / terrain textures for 1-click room filling */
  recentTerrainAssetIds: string[];
  activePortalWidthCells: number;
  activePortalClosed: boolean;
  activePortalSwingInvert: boolean;
  activePortalHingeFlip: boolean;

  // Tool brush parameters
  terrainMode: TerrainMode;
  caveDrawMode: CaveDrawMode;
  caveThemeId: string;
  caveBrushRadiusCells: number;
  caveRoughness: number;
  caveWallThicknessCells: number;
  caveOuterRimCells: number;
  caveUndergroundFill: boolean;
  caveBlocksLight: boolean;
  caveFloorAssetId: string;
  caveWallAssetId: string;
  caveEntranceWidthCells: number;
  caveEntranceFadeCells: number;
  caveEntranceThreshold: CaveThresholdStyle;
  caveEntranceMarkerLabel: string;
  caveEntranceShowMarker: boolean;
  caveEntranceDmOnly: boolean;
  waterDrawMode: WaterDrawMode;
  waterPresetId: string;
  waterKind: WaterBodyKind;
  waterTextureAssetId: string;
  waterDeepColorHex: string;
  waterShallowColorHex: string;
  waterRimColorHex: string;
  waterOpacity: number;
  waterBrushRadiusCells: number;
  waterRiverWidthCells: number;
  waterCurved: boolean;
  waterRippleIntensity: number;
  waterCausticsIntensity: number;
  waterDepthFeather: number;
  waterShoreBankIntensity: number;
  waterOrganicRoughness: number;
  brushRadiusCells: number;
  brushOpacity: number;
  brushSoftness: number;
  terrainFillSoftness: number;
  terrainRotationDeg: number;
  terrainSlopeShade: number;
  terrainTextureScale: number;
  terrainPolygonCurved: boolean;
  terrainReplaceScope: TerrainReplaceScope;
  terrainReplaceApplyStyle: boolean;
  terrainEraseShape: TerrainEraseShape;
  terrainFloodReplaceUnderneath: boolean;
  terrainBarrierWalls: boolean;
  terrainBarrierCaves: boolean;
  terrainBarrierWater: boolean;
  wallDrawMode: WallDrawMode;
  wallPolygonShape: WallPolygonShape;
  wallBoxRotationDeg: number;
  wallSnapToWalls: boolean;
  wallSplitSubMode: WallSplitSubMode;
  wallBreachWidthCells: number;
  wallCorridorWidthCells: number;
  wallCorridorCapEnds: boolean;
  wallThicknessCells: number;
  wallCurved: boolean;
  wallBlocksLight: boolean;
  wallAutoFillClosed: boolean;
  pathWidthCells: number;
  pathCurved: boolean;
  pathFlipSide: boolean;
  pathTaperEnds: boolean;
  roofDrawMode: RoofDrawMode;
  roofStyle: RoofStyle;
  roofPresetId: string;
  activeRoofAssetId: string;
  roofWidthCells: number;
  roofCurved: boolean;
  roofFlipSlope: boolean;
  roofRidgeOffset: number;
  roofHipInsetRatio: number;
  roofMansardCrownRatio: number;
  roofConeFacets: number;
  roofOverhangCells: number;
  roofRotateBoxRidge: boolean;
  roofSunAngleDeg: number;
  roofSlopeShade: number;
  roofRidgeCapStyle: RoofRidgeCapStyle;
  roofRidgeCapWidthCells: number;
  roofEaveTrim: boolean;
  roofDropShadow: number;
  roofShadowDistanceCells: number;
  roofTextureScale: number;
  roofWeathering: number;
  roofOpacity: number;
  stampScale: number;
  stampRotationRad: number;
  stampFlipX: boolean;
  stampPlacementOrder: StampPlacementOrder;
  stampPaintDrag: boolean;
  stampPaintSpacingCells: number;
  stampAutoRotate: boolean;
  stampRotateMode: StampRotateMode;
  stampRotateSpreadDeg: number;
  stampRotateStepDeg: number;
  stampRandomFlipX: boolean;
  stampRandomJitter: boolean;
  stampColorJitter: boolean;
  lastStampedObjectZ: number | null;
  activeRecolor: RgbRecolor;
  toolRecolors: Record<ColorableToolKey, RgbRecolor>;
  customSwatches: string[];
  eyedropperTarget: EyedropperTarget;
  activeLightColorHex: string;
  activeLightRadiusCells: number;
  activeLightIntensity: number;
  activeLightCastShadows: boolean;
  activeLightConeDeg: number;
  scatterPresetName: string;
  scatterAssetIds: string[];
  scatterMinSpacing: number;
  scatterMinScale: number;
  scatterMaxScale: number;
  scatterAvoidWalls: boolean;
  scatterAvoidPaths: boolean;

  // World Atlas Studio v1.5 parameters
  worldLandMode: WorldLandBrushMode;
  worldLandRadiusCells: number;
  worldLandRoughness: number;
  worldLandStrength: number;
  worldBiomeTarget: WorldBiomePaintTarget;
  worldBiomePattern: WorldBiomeBrushPattern;
  worldBiomeColorHex: string;
  worldBiomeRadiusCells: number;
  worldBiomeOpacity: number;
  worldBiomeSoftness: number;
  worldBiomeRoughness: number;
  worldRiverStartWidth: number;
  worldRiverEndWidth: number;
  worldRiverMeander: number;
  worldRiverMeanderScale: number;
  worldRiverCurved: boolean;
  worldRiverFadeMouth: boolean;
  worldRiverClipToLand: boolean;
  worldTrailStyle: WorldTrailStyle;
  worldTrailWidth: number;
  worldTrailColorHex: string;
  worldTrailDashScale: number;
  worldTrailCurved: boolean;
  worldTrailOpacity: number;
  worldRegionName: string;
  worldRegionFillHex: string;
  worldRegionFillOpacity: number;
  worldRegionBorderHex: string;
  worldRegionBorderWidth: number;
  worldRegionBorderStyle: "solid" | "dashed" | "dotted";
  worldRegionClipToLand: boolean;
  worldLabelText: string;
  worldLabelCategory: WorldLabelCategory;
  worldLabelFontSize: number;
  worldLabelCurveBend: number;
  worldLabelRotationDeg: number;
  worldLabelLetterSpacing: number;
  worldLabelBoxStyle: WorldLabelBoxStyle;
  worldLabelBold: boolean;
  worldLabelItalic: boolean;
  worldLabelUppercase: boolean;
  worldLabelDmOnly: boolean;
  worldNameCulture: WorldNameCultureId;
  worldSymbolAvoidWater: boolean;
  worldSymbolSampleBiome: boolean;
  worldSymbolMultiVariant: boolean;

  // Premade Object Group Templates (Saved Prefabs)
  objectTemplates: ObjectTemplate[];
  activeTemplateId: string | null;
  templateRotationRad: number;
  templateScale: number;

  // Camera state synced with PixiJS viewport
  zoomPercent: number;
  cursorGridPos: { x: number; y: number } | null;

  // App UI states
  preferences: AppPreferences;
  vaultDrawerOpen: boolean;
  vaultExpandedModal: boolean;
  exportModalOpen: boolean;
  mapImportModalOpen: boolean;
  pendingImportFile: { fileName: string; bytes: Uint8Array } | null;
  preferencesModalOpen: boolean;
  shortcutsModalOpen: boolean;
  toasts: ToastItem[];

  // Helpers
  getActiveDoc: () => DcMapDocument;
  pushToast: (message: string, tone?: ToastItem["tone"]) => void;
  dismissToast: (id: string) => void;

  // Document & tab management
  commitDocMutation: (mutator: (draft: DcMapDocument) => void, recordHistory?: boolean) => void;
  patchActiveDoc: (
    updater: (doc: DcMapDocument) => DcMapDocument | null,
    recordHistory?: boolean,
  ) => void;
  checkpointHistory: () => void;
  undo: () => void;
  redo: () => void;
  newDocument: (title?: string, widthCells?: number, heightCells?: number) => void;
  openShowcaseFunicular: () => void;
  openShowcaseLakeYacht: () => void;
  openShowcaseHiddenSloop: () => void;
  openShowcaseWorld: () => void;
  openTrofraderraWorld: () => void;
  newWorldDocument: (opts?: {
    title?: string;
    themeId?: string;
    preset?: WorldLandmassPreset;
    seed?: number;
    waterLevel?: number;
    roughness?: number;
  }) => void;
  switchToWorldMode: () => void;
  switchToBattlemapMode: () => void;
  selectObjectTemplate: (templateId: string | null) => void;
  setTemplateTransform: (partial: { rotationRad?: number; scale?: number }) => void;
  stampObjectTemplateAt: (x: number, y: number, templateId?: string) => void;
  saveCustomObjectTemplate: (opts: {
    name: string;
    category?: ObjectTemplateCategory;
    description?: string;
    scope: "cluster" | "layer";
    radiusCells?: number;
  }) => boolean;
  renameObjectTemplate: (templateId: string, name: string) => void;
  deleteObjectTemplate: (templateId: string) => void;
  switchDocument: (docId: string) => void;
  closeDocument: (docId: string) => void;
  duplicateDocument: (docId: string) => void;
  renameDocument: (docId: string, title: string) => void;
  saveDocumentToFile: (
    docId?: string,
    opts?: { saveAs?: boolean; silent?: boolean },
  ) => Promise<boolean>;
  openDocumentFromPicker: () => Promise<"opened" | "cancelled" | "unsupported">;
  setDocAutosaveEnabled: (docId: string, enabled: boolean) => void;
  autosaveSession: (silent?: boolean) => boolean;
  autosaveBoundFiles: () => Promise<number>;
  restoreAutosavedSession: () => boolean;
  loadDocumentJson: (jsonStr: string) => boolean;

  // Tool & View setters
  setActiveTool: (tool: ToolId) => void;
  setSnapMode: (snap: SnapMode) => void;
  toggleSnapEnabled: () => void;
  selectLevel: (levelId: string) => void;
  stepLevel: (direction: "up" | "down") => void;
  addLevelAbove: (mode?: "auto" | "upper" | "sky") => void;
  addSkyLevel: () => void;
  addLevelBelow: () => void;
  renameLevel: (levelId: string, name: string) => void;
  updateLevelMeta: (
    levelId: string,
    partial: { name?: string; shortCode?: string; elevationFt?: number },
  ) => void;
  deleteLevel: (levelId: string) => void;
  setShowOnionSkin: (show: boolean) => void;
  setFilterLayersByFloor: (filter: boolean) => void;
  setIsolateActiveFloor: (isolate: boolean) => void;
  setLockLowerFloors: (lock: boolean) => void;
  toggleLevelLayersVisible: (levelId: string) => void;
  toggleLevelLayersLocked: (levelId: string) => void;
  setFloorView: (mode: "ground" | "floor2" | "roofs") => void;
  setDmViewMode: (dm: boolean) => void;
  setShowVttOverlay: (show: boolean) => void;
  setShowScatterOutlines: (show: boolean) => void;
  setSelection: (sel: SelectionRef | null) => void;
  setSelectedWallSegmentIndex: (index: number | null) => void;
  setZoomPercent: (pct: number) => void;
  setCursorGridPos: (pos: { x: number; y: number } | null) => void;
  setBrushParams: (partial: Partial<Pick<DocumentStoreState, "terrainMode" | "caveDrawMode" | "caveThemeId" | "caveBrushRadiusCells" | "caveRoughness" | "caveWallThicknessCells" | "caveOuterRimCells" | "caveUndergroundFill" | "caveBlocksLight" | "caveFloorAssetId" | "caveWallAssetId" | "caveEntranceWidthCells" | "caveEntranceFadeCells" | "caveEntranceThreshold" | "caveEntranceMarkerLabel" | "caveEntranceShowMarker" | "caveEntranceDmOnly" | "waterDrawMode" | "waterPresetId" | "waterKind" | "waterTextureAssetId" | "waterDeepColorHex" | "waterShallowColorHex" | "waterRimColorHex" | "waterOpacity" | "waterBrushRadiusCells" | "waterRiverWidthCells" | "waterCurved" | "waterRippleIntensity" | "waterCausticsIntensity" | "waterDepthFeather" | "waterShoreBankIntensity" | "waterOrganicRoughness" | "activeWallAssetId" | "activePathAssetId" | "activePortalAssetId" | "activeTerrainAssetId" | "activePortalWidthCells" | "activePortalClosed" | "activePortalSwingInvert" | "activePortalHingeFlip" | "brushRadiusCells" | "brushOpacity" | "brushSoftness" | "terrainFillSoftness" | "terrainRotationDeg" | "terrainSlopeShade" | "terrainTextureScale" | "terrainPolygonCurved" | "terrainReplaceScope" | "terrainReplaceApplyStyle" | "terrainEraseShape" | "terrainFloodReplaceUnderneath" | "terrainBarrierWalls" | "terrainBarrierCaves" | "terrainBarrierWater" | "wallDrawMode" | "wallPolygonShape" | "wallBoxRotationDeg" | "wallSnapToWalls" | "wallSplitSubMode" | "wallBreachWidthCells" | "wallCorridorWidthCells" | "wallCorridorCapEnds" | "wallThicknessCells" | "wallCurved" | "wallBlocksLight" | "wallAutoFillClosed" | "pathWidthCells" | "pathCurved" | "pathFlipSide" | "pathTaperEnds" | "roofDrawMode" | "roofStyle" | "roofPresetId" | "activeRoofAssetId" | "roofWidthCells" | "roofCurved" | "roofFlipSlope" | "roofRidgeOffset" | "roofHipInsetRatio" | "roofMansardCrownRatio" | "roofConeFacets" | "roofOverhangCells" | "roofRotateBoxRidge" | "roofSunAngleDeg" | "roofSlopeShade" | "roofRidgeCapStyle" | "roofRidgeCapWidthCells" | "roofEaveTrim" | "roofDropShadow" | "roofShadowDistanceCells" | "roofTextureScale" | "roofWeathering" | "roofOpacity" | "stampScale" | "stampRotationRad" | "stampFlipX" | "stampPlacementOrder" | "stampPaintDrag" | "stampPaintSpacingCells" | "stampAutoRotate" | "stampRotateMode" | "stampRotateSpreadDeg" | "stampRotateStepDeg" | "stampRandomFlipX" | "stampRandomJitter" | "stampColorJitter" | "activeLightColorHex" | "activeLightRadiusCells" | "activeLightIntensity" | "activeLightCastShadows" | "activeLightConeDeg" | "scatterPresetName" | "scatterAssetIds" | "scatterMinSpacing" | "scatterMinScale" | "scatterMaxScale" | "scatterAvoidWalls" | "scatterAvoidPaths" | "worldLandMode" | "worldLandRadiusCells" | "worldLandRoughness" | "worldLandStrength" | "worldBiomeTarget" | "worldBiomePattern" | "worldBiomeColorHex" | "worldBiomeRadiusCells" | "worldBiomeOpacity" | "worldBiomeSoftness" | "worldBiomeRoughness" | "worldRiverStartWidth" | "worldRiverEndWidth" | "worldRiverMeander" | "worldRiverMeanderScale" | "worldRiverCurved" | "worldRiverFadeMouth" | "worldRiverClipToLand" | "worldTrailStyle" | "worldTrailWidth" | "worldTrailColorHex" | "worldTrailDashScale" | "worldTrailCurved" | "worldTrailOpacity" | "worldRegionName" | "worldRegionFillHex" | "worldRegionFillOpacity" | "worldRegionBorderHex" | "worldRegionBorderWidth" | "worldRegionBorderStyle" | "worldRegionClipToLand" | "worldLabelText" | "worldLabelCategory" | "worldLabelFontSize" | "worldLabelCurveBend" | "worldLabelRotationDeg" | "worldLabelLetterSpacing" | "worldLabelBoxStyle" | "worldLabelBold" | "worldLabelItalic" | "worldLabelUppercase" | "worldLabelDmOnly" | "worldNameCulture" | "worldSymbolAvoidWater" | "worldSymbolSampleBiome" | "worldSymbolMultiVariant">>) => void;
  setActiveRecolor: (partial: Partial<RgbRecolor>) => void;
  setToolRecolor: (tool: ColorableToolKey, partial: Partial<RgbRecolor>) => void;
  addCustomSwatch: (hex: string) => void;
  removeCustomSwatch: (hex: string) => void;
  setEyedropperTarget: (target: EyedropperTarget) => void;
  applyEyedropperColor: (hex: string) => void;

  // Layer operations
  setActiveLayer: (layerId: string) => void;
  addLayer: (kind: LayerKind, name: string, dmOnly?: boolean, levelId?: string) => void;
  setLayerLevel: (layerId: string, levelId: string) => void;
  duplicateLayer: (layerId: string) => void;
  deleteLayer: (layerId: string) => void;
  renameLayer: (layerId: string, name: string) => void;
  toggleLayerVisible: (layerId: string) => void;
  soloLayer: (layerId: string) => void;
  stepActiveLayer: (direction: "up" | "down") => void;
  toggleLayerLocked: (layerId: string) => void;
  toggleLayerDmOnly: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  setLayerBlendMode: (layerId: string, mode: BlendModeName) => void;
  reorderLayer: (layerId: string, direction: "up" | "down") => void;
  moveLayerRelative: (
    sourceLayerId: string,
    targetLayerId: string,
    placement: "above" | "below",
  ) => void;

  // Canvas & Lighting settings
  setGridSettings: (partial: Partial<{ type: GridType; visible: boolean; colorHex: string; opacity: number }>) => void;
  setBaseTerrainAsset: (assetId: string) => void;
  setBaseTerrainTransparent: (transparent: boolean) => void;
  setLightingSettings: (partial: Partial<DcMapDocument["lighting"]>) => void;
  applyLightingPreset: (presetId: string) => void;

  // Entity mutations
  addTerrainStroke: (stroke: TerrainStroke, opts?: { pruneContained?: boolean }) => void;
  replaceTerrainStroke: (
    layerId: string,
    strokeId: string,
    nextAssetId: string,
    applyStyle?: boolean,
  ) => boolean;
  replaceTerrainMaterial: (
    sourceAssetId: string,
    targetAssetId: string,
    scope: "layer" | "floor" | "map",
    applyStyle?: boolean,
    explicitLayerId?: string,
  ) => number;
  replaceAllTerrainOnScope: (
    targetAssetId: string,
    scope: "layer" | "floor",
    applyStyle?: boolean,
    explicitLayerId?: string,
  ) => number;
  fillWholeLayerTerrain: (targetAssetId: string, explicitLayerId?: string) => void;
  deleteTerrainStroke: (layerId: string, strokeId: string) => boolean;
  clearTerrainLayer: (layerId?: string) => number;
  clearTerrainFloor: (levelId?: string) => number;
  fillWallInterior: (layerId: string, wallId: string, terrainAssetIdOverride?: string) => boolean;
  applyCaveTheme: (themeId: string) => void;
  addCaveOperation: (op: CaveOperation) => void;
  updateActiveCaveSystem: (partial: Partial<CaveDungeonSystem>, recordHistory?: boolean) => void;
  addCaveEntrance: (entrance: CaveEntranceOpening) => void;
  updateCaveEntrance: (
    layerId: string,
    entranceId: string,
    partial: Partial<CaveEntranceOpening>,
    recordHistory?: boolean,
  ) => void;
  clearCaveLayer: () => void;
  bakeCaveToWallsAndTerrain: () => boolean;
  addWaterRegion: (region: WaterRegion, selectAfter?: boolean) => void;
  ensureActiveWaterLayer: () => string;
  applyLiveWaterRegions: (updates: Map<string, WaterRegion[]>, activeWaterLayerId?: string) => void;
  updateLayerWaterSettings: (
    layerId: string,
    partial: { waterMeshEnabled?: boolean; waterBlendRadiusCells?: number },
    recordHistory?: boolean,
  ) => void;
  paintWaterBrush: (strokePoints: Point2D[]) => void;
  eraseWaterBrush: (strokePoints: Point2D[]) => boolean;
  updateWaterRegion: (
    layerId: string,
    regionId: string,
    partial: Partial<WaterRegion>,
    recordHistory?: boolean,
  ) => void;
  applyWaterPreset: (presetId: string) => void;
  carveWaterIsland: (cutoutPolygon: Point2D[]) => boolean;
  clearWaterCutouts: (layerId: string, regionId: string) => void;
  addWall: (wall: WallSegment) => void;
  addWallsBatch: (walls: WallSegment[], autoFloorPolygon?: Point2D[]) => void;
  updateWall: (layerId: string, wallId: string, partial: Partial<WallSegment>, recordHistory?: boolean) => void;
  setWallSegmentCurve: (
    layerId: string,
    wallId: string,
    segIdx: number,
    sagitta: number | null,
    recordHistory?: boolean,
  ) => void;
  toggleWallSegmentCurve: (
    layerId: string,
    wallId: string,
    segIdx: number,
    preset?: "90" | "180",
  ) => boolean;
  flipWallSegmentCurve: (layerId: string, wallId: string, segIdx: number) => void;
  setEntitySegmentCurve: (
    sel: SelectionRef,
    segIdx: number,
    sagitta: number | null,
    recordHistory?: boolean,
  ) => void;
  toggleEntitySegmentCurve: (
    sel: SelectionRef,
    segIdx: number,
    preset?: "90" | "180",
  ) => boolean;
  flipEntitySegmentCurve: (sel: SelectionRef, segIdx: number) => void;
  flattenEntityCurves: (sel: SelectionRef) => void;
  splitWallAt: (layerId: string, wallId: string, arcLength: number) => boolean;
  breachWallAt: (layerId: string, wallId: string, arcLength: number, widthCells?: number) => boolean;
  copyWallsFromLevelBelow: () => number;
  addPortal: (portal: PortalNode) => void;
  updatePortal: (layerId: string, portalId: string, partial: Partial<PortalNode>, recordHistory?: boolean) => void;
  togglePortalClosed: (layerId: string, portalId: string) => void;
  addPath: (path: SplinePath) => void;
  updatePath: (layerId: string, pathId: string, partial: Partial<SplinePath>, recordHistory?: boolean) => void;
  addRoof: (roof: RoofStructure) => void;
  updateRoof: (layerId: string, roofId: string, partial: Partial<RoofStructure>, recordHistory?: boolean) => void;
  applyRoofPreset: (presetId: string) => void;
  syncSunAngleToAllRoofs: (sunAngleDeg: number) => void;
  reorderRoofInLayer: (layerId: string, roofId: string, op: "front" | "back") => void;
  addObjectStamp: (stamp: ObjectStamp, recordHistory?: boolean) => void;
  updateObjectStamp: (layerId: string, objId: string, partial: Partial<ObjectStamp>, recordHistory?: boolean) => void;
  addScatterZone: (zone: ScatterZone) => void;
  updateScatterZone: (
    layerId: string,
    zoneId: string,
    partial: Partial<Omit<ScatterZone, "id" | "placements">>,
    repopulate?: boolean,
    recordHistory?: boolean,
  ) => void;
  reseedScatterZone: (layerId: string, zoneId: string, newSeed?: number) => void;
  addLight: (light: LightNode) => void;
  updateLight: (layerId: string, lightId: string, partial: Partial<LightNode>, recordHistory?: boolean) => void;
  addDmNote: (note: DmNotePin) => void;
  updateDmNote: (layerId: string, noteId: string, partial: Partial<DmNotePin>, recordHistory?: boolean) => void;

  // World Atlas Studio v1.5 mutations
  applyWorldTheme: (themeId: string) => void;
  updateWorldTheme: (partial: Partial<WorldThemeConfig>, recordHistory?: boolean) => void;
  regenerateWorldLandmass: (opts: {
    preset: WorldLandmassPreset;
    seed: number;
    waterLevel?: number;
    roughness?: number;
    detail?: number;
    clearFeatures?: boolean;
  }) => void;
  sculptWorldLand: (
    points: Point2D[],
    modeOverride?: WorldLandBrushMode,
    recordHistory?: boolean,
  ) => void;
  addWorldBiomeStroke: (stroke: WorldBiomeStroke) => void;
  clearWorldBiomes: () => void;
  addWorldRiver: (river: WorldRiver) => void;
  updateWorldRiver: (riverId: string, partial: Partial<WorldRiver>, recordHistory?: boolean) => void;
  addWorldTrail: (trail: WorldTrail) => void;
  updateWorldTrail: (trailId: string, partial: Partial<WorldTrail>, recordHistory?: boolean) => void;
  addWorldRegion: (region: WorldRegion) => void;
  updateWorldRegion: (regionId: string, partial: Partial<WorldRegion>, recordHistory?: boolean) => void;
  addWorldLabel: (label: WorldLabel) => void;
  updateWorldLabel: (labelId: string, partial: Partial<WorldLabel>, recordHistory?: boolean) => void;
  addWorldSubMapPin: (pin: WorldSubMapPin) => void;
  updateWorldSubMapPin: (pinId: string, partial: Partial<WorldSubMapPin>, recordHistory?: boolean) => void;
  updateWorldOverlays: (
    partial: {
      compass?: Partial<WorldCartographyOverlays["compass"]>;
      scaleBar?: Partial<WorldCartographyOverlays["scaleBar"]>;
      grid?: Partial<WorldCartographyOverlays["grid"]>;
      frame?: Partial<WorldCartographyOverlays["frame"]>;
      travelMode?: WorldCartographyOverlays["travelMode"];
      legend?: Partial<NonNullable<WorldCartographyOverlays["legend"]>>;
      traceOverlay?: Partial<NonNullable<WorldCartographyOverlays["traceOverlay"]>>;
    },
    recordHistory?: boolean,
  ) => void;
  createDetailWorldMap: (
    bounds: { x0: number; y0: number; x1: number; y1: number },
    title?: string,
  ) => string | null;
  createLinkedBattlemapFromWorld: (pt: Point2D, title?: string) => string;

  // Selection actions (used by shortcuts & right-click menus)
  deleteSelection: () => void;
  duplicateSelection: (offsetX?: number, offsetY?: number) => void;
  bendSelectedIntoCurve: () => void;
  copySelection: () => void;
  pasteAt: (x: number, y: number) => void;
  transformSelectedObject: (op: "flipX" | "flipY" | "rotCW" | "rotCCW" | "front" | "back" | "stepFwd" | "stepBack" | "toggleShadow" | "toggleLock") => void;
  moveSelectionToLayer: (targetLayerId: string) => void;
  copySelectedRecolor: () => void;
  pasteRecolorToSelected: () => void;
  applyRecolorToMatchingObjects: (layerId: string, assetId: string, recolor: RgbRecolor) => void;

  // UI Dialogs & Preferences
  setVaultDrawerOpen: (open: boolean) => void;
  setVaultExpandedModal: (open: boolean) => void;
  setExportModalOpen: (open: boolean) => void;
  openExternalMapImport: (fileName: string, bytes: Uint8Array) => void;
  closeExternalMapImport: () => void;
  importExternalMapDocument: (doc: DcMapDocument, summary: ExternalImportSummary) => void;
  bulkSwapImportedAsset: (
    sourceRef: string,
    nextAssetId: string,
    vaultAssets: import("@/types/map").VaultAsset[],
    spreadVariants?: boolean,
  ) => number;
  setPreferencesModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  updatePreferences: (partial: Partial<AppPreferences>) => void;
}

const initialSovereignTemple = createSovereignTempleMap();
const initialShowcase = createFunicularShowcaseMap();
const initialLakeYacht = createLakeYachtMap();
const initialHiddenSloop = createHiddenSloopMap();
const initialTrofraderra = createTrofraderraWorldMap();
const initialObjectTemplates = loadObjectTemplates();

function cloneDoc(doc: DcMapDocument): DcMapDocument {
  return structuredClone(doc);
}

/**
 * Auto-refits any room floor fill linked to `wallId` via `sourceWallId` whenever
 * that wall is moved, reshaped, or curved — zero stale terrain bleed past curved arches!
 */
function syncLinkedWallFloorFills(
  doc: DcMapDocument,
  wallId: string,
  updatedWall: WallSegment,
): DcMapDocument {
  if (updatedWall.points.length < 3) return doc;
  const hasLinked = doc.layers.some(
    (l) =>
      l.kind === "terrain" &&
      (l.terrainStrokes?.some((s) => s.sourceWallId === wallId && !s.erase) ?? false),
  );
  if (!hasLinked) return doc;
  const nextPoly = makeClosedWallPolygon(updatedWall);
  if (nextPoly.length < 3) return doc;
  return {
    ...doc,
    layers: doc.layers.map((l) => {
      if (l.kind !== "terrain" || !l.terrainStrokes?.some((s) => s.sourceWallId === wallId && !s.erase)) {
        return l;
      }
      return {
        ...l,
        terrainStrokes: l.terrainStrokes.map((s) =>
          s.sourceWallId === wallId && !s.erase
            ? { ...s, points: nextPoly.map((p) => ({ ...p })), holes: undefined, segmentCurves: undefined }
            : s,
        ),
      };
    }),
  };
}

/**
 * Canonical top-to-bottom architectural sort for the Elevator Shaft:
 * Sky (Airships) -> Roofs -> Upper Floors (highest to lowest) -> Ground (1F) -> Underground (B1, B2, B3...)
 */
export function sortLevelsTopDown(levels: MapLevel[]): MapLevel[] {
  const rank = (k: LevelKind) =>
    k === "sky" ? 4 : k === "roof" ? 3 : k === "upper" ? 2 : k === "ground" ? 1 : 0;
  return [...levels].sort((a, b) => {
    const rd = rank(b.kind) - rank(a.kind);
    if (rd !== 0) return rd;
    return b.elevationFt - a.elevationFt;
  });
}

function getLevelBottomUpRank(lv: MapLevel | undefined): number {
  if (!lv) return 1000;
  const kindRank =
    lv.kind === "underground"
      ? 0
      : lv.kind === "ground"
        ? 1000
        : lv.kind === "upper"
          ? 2000
          : lv.kind === "roof"
            ? 3000
            : 4000;
  return kindRank + lv.elevationFt;
}

/**
 * Inserts a layer into `d.layers` at its canonical position within its floor's elevation band
 * using `LAYER_KIND_STACK_ORDER`, so new or moved layers never land above Roofs/higher floors.
 */
function insertLayerInFloorBand(d: DcMapDocument, layer: MapLayer): void {
  const targetOrder = LAYER_KIND_STACK_ORDER[layer.kind] ?? 60;
  let lastOnLevel = -1;
  let insertBeforeIdx = -1;
  for (let i = 0; i < d.layers.length; i++) {
    const cur = d.layers[i];
    if (cur.levelId !== layer.levelId) continue;
    lastOnLevel = i;
    if (insertBeforeIdx < 0 && (LAYER_KIND_STACK_ORDER[cur.kind] ?? 60) > targetOrder) {
      insertBeforeIdx = i;
    }
  }
  if (insertBeforeIdx >= 0) {
    d.layers.splice(insertBeforeIdx, 0, layer);
    return;
  }
  if (lastOnLevel >= 0) {
    d.layers.splice(lastOnLevel + 1, 0, layer);
    return;
  }
  // Target floor currently has no layers — insert before the first layer of any higher-ranked floor
  const levelMap = new Map(d.levels.map((lv) => [lv.id, lv]));
  const targetRank = getLevelBottomUpRank(levelMap.get(layer.levelId));
  const firstHigher = d.layers.findIndex(
    (l) => getLevelBottomUpRank(levelMap.get(l.levelId)) > targetRank,
  );
  if (firstHigher >= 0) {
    d.layers.splice(firstHigher, 0, layer);
  } else {
    d.layers.push(layer);
  }
}

function applyLevelVisibility(
  d: DcMapDocument,
  targetLevelId: string,
  preferredKind?: LayerKind | null,
) {
  const target = d.levels.find((lv) => lv.id === targetLevelId) ?? d.levels[0];
  if (!target) return;
  const levelMap = new Map(d.levels.map((lv) => [lv.id, lv]));
  d.activeLevelId = target.id;
  for (const lv of d.levels) {
    if (target.kind === "underground") {
      lv.visible = lv.id === target.id;
    } else if (target.kind === "ground") {
      lv.visible = lv.kind === "ground";
    } else if (target.kind === "upper") {
      lv.visible = lv.kind === "ground" || (lv.kind === "upper" && lv.elevationFt <= target.elevationFt);
    } else if (target.kind === "sky") {
      // Multi-deck airships (Sky 1, Sky 2, Sky 3, Sky 4...):
      // Each Sky level renders cleanly above 1F + ROOF; Sky 3 (poop-deck canopy & crow's nests)
      // also reveals Sky 2 main weather deck directly beneath it!
      const belowDeckId =
        target.id === "lvl-sky-upper" && d.levels.some((x) => x.id === "lvl-sky")
          ? "lvl-sky"
          : null;
      lv.visible =
        lv.kind === "ground" ||
        lv.kind === "roof" ||
        lv.id === target.id ||
        (belowDeckId !== null && lv.id === belowDeckId);
    } else {
      lv.visible = lv.kind === "ground" || lv.kind === "roof";
    }
  }
  const nonSkyDmLayerCount = d.layers.filter(
    (x) => x.kind === "dm_notes" && levelMap.get(x.levelId)?.kind !== "sky",
  ).length;
  for (const l of d.layers) {
    const lv = levelMap.get(l.levelId);
    if (l.kind === "dm_notes") {
      l.visible =
        target.kind === "sky" || nonSkyDmLayerCount > 1
          ? l.levelId === target.id
          : lv?.kind !== "sky";
      continue;
    }
    if (!lv) continue;
    l.visible = lv.visible;
  }
  const preferred =
    (preferredKind
      ? d.layers.find(
          (l) =>
            l.levelId === target.id &&
            l.kind === preferredKind &&
            !l.dmOnly &&
            !l.locked &&
            l.visible,
        )
      : undefined) ??
    d.layers.find((l) => l.levelId === target.id && l.kind === "objects" && !l.dmOnly) ??
    d.layers.find((l) => l.levelId === target.id && !l.dmOnly);
  if (preferred) d.activeLayerId = preferred.id;
}

function findOrEnsureLayer(doc: DcMapDocument, kind: LayerKind): MapLayer {
  const active = doc.layers.find((l) => l.id === doc.activeLayerId);
  if (
    active &&
    active.kind === kind &&
    (active.levelId === doc.activeLevelId || kind === "dm_notes") &&
    !active.locked &&
    active.visible
  ) {
    return active;
  }
  // Prefer a visible unlocked layer on the currently active floor (B1, 1F, 2F, 3F, Roofs...)!
  const sameLevel = doc.layers.find(
    (l) => l.kind === kind && !l.locked && l.visible && l.levelId === doc.activeLevelId,
  );
  if (sameLevel) {
    doc.activeLayerId = sameLevel.id;
    return sameLevel;
  }
  if (kind === "dm_notes") {
    const match = doc.layers.find((l) => l.kind === kind && !l.locked && l.visible);
    if (match) {
      doc.activeLayerId = match.id;
      return match;
    }
  }
  const created: MapLayer = {
    id: `layer-${kind}-${Date.now()}`,
    name: getNextDefaultLayerName(doc, kind, doc.activeLevelId),
    kind,
    visible: true,
    locked: false,
    dmOnly: kind === "dm_notes",
    opacity: 1,
    blendMode: kind === "lights" ? "add" : "normal",
    levelId: doc.activeLevelId,
    terrainStrokes: kind === "terrain" ? [] : undefined,
    caveSystem: kind === "caves" ? createDefaultCaveSystem() : undefined,
    waterRegions: kind === "water" ? [] : undefined,
    walls: kind === "walls" ? [] : undefined,
    portals: kind === "walls" ? [] : undefined,
    paths: kind === "paths" ? [] : undefined,
    roofs: kind === "roofs" ? [] : undefined,
    objects: kind === "objects" ? [] : undefined,
    scatterZones: kind === "scatter_zone" ? [] : undefined,
    lights: kind === "lights" ? [] : undefined,
    dmNotes: kind === "dm_notes" ? [] : undefined,
  };
  insertLayerInFloorBand(doc, created);
  doc.activeLayerId = created.id;
  return created;
}

export const useDocumentStore = create<DocumentStoreState>((set, get) => ({
  documents: [
    initialSovereignTemple,
    initialShowcase,
    initialLakeYacht,
    initialHiddenSloop,
    initialTrofraderra,
  ],
  activeDocId: initialSovereignTemple.id,
  historyByDocId: {
    [initialSovereignTemple.id]: { undo: [], redo: [] },
    [initialShowcase.id]: { undo: [], redo: [] },
    [initialLakeYacht.id]: { undo: [], redo: [] },
    [initialHiddenSloop.id]: { undo: [], redo: [] },
    [initialTrofraderra.id]: { undo: [], redo: [] },
  },
  dirtyDocIds: {},
  undoStack: [],
  redoStack: [],
  dirty: false,
  lastAutosavedAt: null,
  savedFileNameByDocId: {},
  autosaveEnabledByDocId: {},
  lastSavedAtByDocId: {},

  activeTool: "select",
  snapMode: loadPrefs().snapMode,
  lastSnapMode: loadPrefs().snapMode === "grid" ? "grid" : "half",
  dmViewMode: true,
  showVttOverlay: false,
  showScatterOutlines: true,
  showOnionSkin: false,
  filterLayersByFloor: true,
  isolateActiveFloor: false,
  lockLowerFloors: true,
  soloLayerId: null,
  soloVisibilityBackup: null,

  selection: null,
  selectedWallSegmentIndex: null,
  copiedObject: null,
  copiedRecolor: null,

  activeWallAssetId: "walls/grunderzeit_brick_wall.png",
  activePathAssetId: "paths/magirail_funicular_track.png",
  activePortalAssetId: "portals/jugendstil_brass_door.png",
  activeTerrainAssetId: "terrain/berlin_wet_cobble.png",
  recentTerrainAssetIds: loadRecentTerrains(),
  activePortalWidthCells: 1.5,
  activePortalClosed: true,
  activePortalSwingInvert: false,
  activePortalHingeFlip: false,

  terrainMode: "brush",
  caveDrawMode: "cave_brush",
  caveThemeId: "granite_cavern",
  caveBrushRadiusCells: 2.1,
  caveRoughness: 0.72,
  caveWallThicknessCells: 0.72,
  caveOuterRimCells: 0.65,
  caveUndergroundFill: false,
  caveBlocksLight: true,
  caveFloorAssetId: "core-fantasy/terrain/cavern_rough_stone.png",
  caveWallAssetId: "modular-suite/walls/cave_granite_jagged.png",
  caveEntranceWidthCells: 2.6,
  caveEntranceFadeCells: 2.8,
  caveEntranceThreshold: "rock_mouth",
  caveEntranceMarkerLabel: "CAVE ENTRANCE",
  caveEntranceShowMarker: true,
  caveEntranceDmOnly: false,
  waterDrawMode: "lake_brush",
  waterPresetId: "alpine_lake",
  waterKind: "water",
  waterTextureAssetId: "modular-suite/terrain/water_alpine_crystal.png",
  waterDeepColorHex: "#0B3D5E",
  waterShallowColorHex: "#2799B8",
  waterRimColorHex: "#E6FAFF",
  waterOpacity: 0.94,
  waterBrushRadiusCells: 2.2,
  waterRiverWidthCells: 2.6,
  waterCurved: true,
  waterRippleIntensity: 0.72,
  waterCausticsIntensity: 0.62,
  waterDepthFeather: 0.65,
  waterShoreBankIntensity: 0.55,
  waterOrganicRoughness: 0.28,
  brushRadiusCells: 2.2,
  brushOpacity: 1.0,
  brushSoftness: 0.45,
  terrainFillSoftness: 0.0,
  terrainRotationDeg: 0,
  terrainSlopeShade: 0,
  terrainTextureScale: 1.0,
  terrainPolygonCurved: false,
  terrainReplaceScope: "patch",
  terrainReplaceApplyStyle: false,
  terrainEraseShape: "brush",
  terrainFloodReplaceUnderneath: true,
  terrainBarrierWalls: true,
  terrainBarrierCaves: true,
  terrainBarrierWater: true,
  wallDrawMode: "free",
  wallPolygonShape: "round",
  wallBoxRotationDeg: 0,
  wallSnapToWalls: true,
  wallSplitSubMode: "breach",
  wallBreachWidthCells: 2.0,
  wallCorridorWidthCells: 2.5,
  wallCorridorCapEnds: false,
  wallThicknessCells: 0.38,
  wallCurved: false,
  wallBlocksLight: true,
  wallAutoFillClosed: false,
  pathWidthCells: 1.5,
  pathCurved: true,
  pathFlipSide: false,
  pathTaperEnds: false,
  roofDrawMode: "ridge_path",
  roofStyle: "gable",
  roofPresetId: "terracotta_barrel",
  activeRoofAssetId: "modular-suite/terrain/roof_terracotta_barrel_tiles.png",
  roofWidthCells: 6.0,
  roofCurved: false,
  roofFlipSlope: false,
  roofRidgeOffset: 0,
  roofHipInsetRatio: 0.72,
  roofMansardCrownRatio: 0.44,
  roofConeFacets: 8,
  roofOverhangCells: 0.4,
  roofRotateBoxRidge: false,
  roofSunAngleDeg: 225,
  roofSlopeShade: 0.54,
  roofRidgeCapStyle: "matching",
  roofRidgeCapWidthCells: 0.24,
  roofEaveTrim: true,
  roofDropShadow: 0.72,
  roofShadowDistanceCells: 0.65,
  roofTextureScale: 1.0,
  roofWeathering: 0.24,
  roofOpacity: 1.0,
  stampScale: 1.0,
  stampRotationRad: 0,
  stampFlipX: false,
  stampPlacementOrder: "above",
  stampPaintDrag: false,
  stampPaintSpacingCells: 1.25,
  stampAutoRotate: false,
  stampRotateMode: "random",
  stampRotateSpreadDeg: 180,
  stampRotateStepDeg: 45,
  stampRandomFlipX: false,
  stampRandomJitter: false,
  stampColorJitter: false,
  lastStampedObjectZ: null,
  activeRecolor: { ...DEFAULT_RECOLOR },
  toolRecolors: {
    wall: { ...DEFAULT_RECOLOR, strength: 0.55 },
    path: { ...DEFAULT_RECOLOR, strength: 0.55 },
    portal: { ...DEFAULT_RECOLOR, strength: 0.55 },
    terrain: { ...DEFAULT_RECOLOR, strength: 0.45 },
    roof: { ...DEFAULT_RECOLOR, strength: 0.55 },
  },
  customSwatches: loadCustomSwatches(),
  eyedropperTarget: null,
  activeLightColorHex: "#FFBE5C",
  activeLightRadiusCells: 7.0,
  activeLightIntensity: 1.1,
  activeLightCastShadows: true,
  activeLightConeDeg: 360,
  scatterPresetName: "Woodland Trees & Bushes",
  scatterAssetIds: [
    "modular-suite/props/trees_deciduous/tree_oak_broad.png",
    "modular-suite/props/trees_deciduous/tree_birch_silver.png",
    "modular-suite/props/trees_biomes/tree_dark_pine.png",
    "modular-suite/props/flora/bush_round_green.png",
    "modular-suite/props/flora/flora_woodland_fern.png",
  ],
  scatterMinSpacing: 2.2,
  scatterMinScale: 0.78,
  scatterMaxScale: 1.12,
  scatterAvoidWalls: true,
  scatterAvoidPaths: true,

  worldLandMode: "raise",
  worldLandRadiusCells: 2.2,
  worldLandRoughness: 0.64,
  worldLandStrength: 0.72,
  worldBiomeTarget: "land",
  worldBiomePattern: "solid",
  worldBiomeColorHex: "#7A9468",
  worldBiomeRadiusCells: 3.4,
  worldBiomeOpacity: 0.62,
  worldBiomeSoftness: 0.82,
  worldBiomeRoughness: 0.45,
  worldRiverStartWidth: 0.05,
  worldRiverEndWidth: 0.32,
  worldRiverMeander: 0.44,
  worldRiverMeanderScale: 1.1,
  worldRiverCurved: true,
  worldRiverFadeMouth: true,
  worldRiverClipToLand: true,
  worldTrailStyle: "dotted",
  worldTrailWidth: 0.12,
  worldTrailColorHex: "#5C3A21",
  worldTrailDashScale: 1.0,
  worldTrailCurved: true,
  worldTrailOpacity: 0.88,
  worldRegionName: "New Realm",
  worldRegionFillHex: "#3B6E8C",
  worldRegionFillOpacity: 0.16,
  worldRegionBorderHex: "#2C4D66",
  worldRegionBorderWidth: 1.8,
  worldRegionBorderStyle: "dashed",
  worldRegionClipToLand: true,
  worldLabelText: "Aldervale",
  worldLabelCategory: "city",
  worldLabelFontSize: 13,
  worldLabelCurveBend: 0,
  worldLabelRotationDeg: 0,
  worldLabelLetterSpacing: 1.2,
  worldLabelBoxStyle: "none",
  worldLabelBold: true,
  worldLabelItalic: false,
  worldLabelUppercase: false,
  worldLabelDmOnly: false,
  worldNameCulture: "high_fantasy",
  worldSymbolAvoidWater: true,
  worldSymbolSampleBiome: true,
  worldSymbolMultiVariant: true,

  objectTemplates: initialObjectTemplates,
  activeTemplateId: initialObjectTemplates[0]?.id ?? null,
  templateRotationRad: 0,
  templateScale: 1.0,

  zoomPercent: 100,
  cursorGridPos: null,

  preferences: loadPrefs(),
  vaultDrawerOpen: true,
  vaultExpandedModal: false,
  exportModalOpen: false,
  mapImportModalOpen: false,
  pendingImportFile: null,
  preferencesModalOpen: false,
  shortcutsModalOpen: false,
  toasts: [],

  getActiveDoc: () => {
    const { documents, activeDocId } = get();
    return documents.find((d) => d.id === activeDocId) ?? documents[0];
  },

  pushToast: (message, tone = "info") => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 3200);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  commitDocMutation: (mutator, recordHistory = true) => {
    const state = get();
    const current = state.getActiveDoc();
    const bucket = state.historyByDocId[current.id] ?? { undo: [], redo: [] };
    // current is immutable in Zustand, so reuse it directly as the undo snapshot (saves a full structuredClone!)
    const snapshot = recordHistory ? current : null;
    const draft = cloneDoc(current);
    mutator(draft);
    draft.meta.updatedAt = new Date().toISOString();

    const nextUndo = snapshot
      ? [...bucket.undo.slice(-(MAX_HISTORY - 1)), snapshot]
      : bucket.undo;
    const nextRedo = recordHistory ? [] : bucket.redo;
    const nextHistoryByDocId = {
      ...state.historyByDocId,
      [draft.id]: { undo: nextUndo, redo: nextRedo },
    };
    const nextDirtyDocIds = { ...state.dirtyDocIds, [draft.id]: true };

    set({
      documents: state.documents.map((d) => (d.id === draft.id ? draft : d)),
      historyByDocId: nextHistoryByDocId,
      dirtyDocIds: nextDirtyDocIds,
      undoStack: nextUndo,
      redoStack: nextRedo,
      dirty: true,
    });
  },

  patchActiveDoc: (updater, recordHistory = false) => {
    const state = get();
    const current = state.getActiveDoc();
    const nextDoc = updater(current);
    if (!nextDoc || nextDoc === current) return;
    const stampedDoc: DcMapDocument = {
      ...nextDoc,
      meta: { ...nextDoc.meta, updatedAt: new Date().toISOString() },
    };
    const bucket = state.historyByDocId[current.id] ?? { undo: [], redo: [] };
    const nextUndo = recordHistory
      ? [...bucket.undo.slice(-(MAX_HISTORY - 1)), current]
      : bucket.undo;
    const nextRedo = recordHistory ? [] : bucket.redo;
    set({
      documents: state.documents.map((d) => (d.id === stampedDoc.id ? stampedDoc : d)),
      historyByDocId: {
        ...state.historyByDocId,
        [stampedDoc.id]: { undo: nextUndo, redo: nextRedo },
      },
      dirtyDocIds: { ...state.dirtyDocIds, [stampedDoc.id]: true },
      undoStack: nextUndo,
      redoStack: nextRedo,
      dirty: true,
    });
  },

  checkpointHistory: () => {
    const state = get();
    const current = state.getActiveDoc();
    const bucket = state.historyByDocId[current.id] ?? { undo: [], redo: [] };
    const nextUndo = [...bucket.undo.slice(-(MAX_HISTORY - 1)), current];
    set({
      historyByDocId: {
        ...state.historyByDocId,
        [current.id]: { undo: nextUndo, redo: [] },
      },
      undoStack: nextUndo,
      redoStack: [],
    });
  },

  undo: () => {
    const state = get();
    const current = state.getActiveDoc();
    const bucket = state.historyByDocId[current.id] ?? { undo: [], redo: [] };
    if (bucket.undo.length === 0) return;
    const previous = bucket.undo[bucket.undo.length - 1];
    const nextUndo = bucket.undo.slice(0, -1);
    const nextRedo = [...bucket.redo, current];
    set({
      documents: state.documents.map((d) => (d.id === current.id ? previous : d)),
      historyByDocId: {
        ...state.historyByDocId,
        [current.id]: { undo: nextUndo, redo: nextRedo },
      },
      undoStack: nextUndo,
      redoStack: nextRedo,
      selection: null,
    });
    get().pushToast("Undid last action");
  },

  redo: () => {
    const state = get();
    const current = state.getActiveDoc();
    const bucket = state.historyByDocId[current.id] ?? { undo: [], redo: [] };
    if (bucket.redo.length === 0) return;
    const next = bucket.redo[bucket.redo.length - 1];
    const nextUndo = [...bucket.undo, current];
    const nextRedo = bucket.redo.slice(0, -1);
    set({
      documents: state.documents.map((d) => (d.id === current.id ? next : d)),
      historyByDocId: {
        ...state.historyByDocId,
        [current.id]: { undo: nextUndo, redo: nextRedo },
      },
      undoStack: nextUndo,
      redoStack: nextRedo,
      selection: null,
    });
    get().pushToast("Redid action");
  },

  newDocument: (title, widthCells = 48, heightCells = 27) => {
    const doc = createBlankMap(title, widthCells, heightCells, get().preferences.defaultPpi);
    set((s) => ({
      documents: [...s.documents, doc],
      activeDocId: doc.id,
      historyByDocId: { ...s.historyByDocId, [doc.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
    }));
    get().pushToast(`Created ${doc.meta.title} (${widthCells}×${heightCells})`, "success");
  },

  openShowcaseFunicular: () => {
    const existing = get().documents.find(
      (d) => d.id === "map-berlin-magipunk-funicular-55in-4k",
    );
    if (existing) {
      get().switchDocument(existing.id);
      return;
    }
    const showcase = createFunicularShowcaseMap();
    set((s) => ({
      documents: [...s.documents, showcase],
      activeDocId: showcase.id,
      historyByDocId: { ...s.historyByDocId, [showcase.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
    }));
    get().pushToast("Loaded Berlin Magi-Punk Funicular (55\" 4K TV Showcase)", "success");
  },

  openShowcaseLakeYacht: () => {
    const existing = get().documents.find(
      (d) => d.id === "map-azure-lake-sky-yacht-55in-4k",
    );
    if (existing) {
      get().switchDocument(existing.id);
      return;
    }
    const lakeDoc = createLakeYachtMap();
    set((s) => ({
      documents: [...s.documents, lakeDoc],
      activeDocId: lakeDoc.id,
      historyByDocId: { ...s.historyByDocId, [lakeDoc.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
    }));
    get().pushToast("Loaded Mirrorlake Shore & S.Y. Aurelia Flying Yacht (48×27)", "success");
  },

  openShowcaseHiddenSloop: () => {
    const existing = get().documents.find(
      (d) => d.id === "map-hidden-cove-stolen-sloop-55in-4k",
    );
    if (existing) {
      get().switchDocument(existing.id);
      return;
    }
    const sloopDoc = createHiddenSloopMap();
    set((s) => ({
      documents: [...s.documents, sloopDoc],
      activeDocId: sloopDoc.id,
      historyByDocId: { ...s.historyByDocId, [sloopDoc.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
    }));
    get().pushToast("Loaded Moonshadow Tarn & Stolen Magi-Punk Sloop (48×27)", "success");
  },

  openShowcaseWorld: () => {
    const existing = get().documents.find(
      (d) => d.mode === "world" && d.meta.title === "The Shattered Reach Atlas",
    );
    if (existing) {
      get().switchDocument(existing.id);
      return;
    }
    const worldDoc = createWorldShowcaseMap();
    set((s) => ({
      documents: [...s.documents, worldDoc],
      activeDocId: worldDoc.id,
      historyByDocId: { ...s.historyByDocId, [worldDoc.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
      activeTool: "select",
    }));
    get().pushToast("Opened The Shattered Reach — World Atlas Studio v1.5", "success");
  },

  openTrofraderraWorld: () => {
    const existing = get().documents.find(
      (d) => d.mode === "world" && d.meta.title === "Tro'fraderra",
    );
    if (existing) {
      get().switchDocument(existing.id);
      return;
    }
    const worldDoc = createTrofraderraWorldMap();
    set((s) => ({
      documents: [...s.documents, worldDoc],
      activeDocId: worldDoc.id,
      historyByDocId: { ...s.historyByDocId, [worldDoc.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
      activeTool: "select",
    }));
    get().pushToast("Opened Tro'fraderra — Clean-Room World Atlas", "success");
  },

  newWorldDocument: (opts) => {
    const worldDoc = createBlankWorldMap(opts);
    set((s) => ({
      documents: [...s.documents, worldDoc],
      activeDocId: worldDoc.id,
      historyByDocId: { ...s.historyByDocId, [worldDoc.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
      activeTool: "world_land",
    }));
    get().pushToast(`Created World Atlas "${worldDoc.meta.title}"`, "success");
  },

  switchToWorldMode: () => {
    const s = get();
    const active = s.getActiveDoc();
    if (active.mode === "world") return;
    const existingWorld = s.documents.find((d) => d.mode === "world");
    if (existingWorld) {
      s.switchDocument(existingWorld.id);
      return;
    }
    s.openShowcaseWorld();
  },

  switchToBattlemapMode: () => {
    const s = get();
    const active = s.getActiveDoc();
    if (active.mode === "battlemap") return;
    const existingBattle = s.documents.find((d) => d.mode === "battlemap");
    if (existingBattle) {
      s.switchDocument(existingBattle.id);
      return;
    }
    s.openShowcaseFunicular();
  },

  selectObjectTemplate: (templateId) => {
    set({
      activeTemplateId: templateId,
      ...(templateId ? { activeTool: "template" as ToolId, selection: null } : {}),
    });
  },

  setTemplateTransform: (partial) =>
    set((s) => ({
      templateRotationRad:
        partial.rotationRad !== undefined ? partial.rotationRad : s.templateRotationRad,
      templateScale:
        partial.scale !== undefined
          ? Math.max(0.35, Math.min(3.0, partial.scale))
          : s.templateScale,
    })),

  stampObjectTemplateAt: (x, y, templateId) => {
    const s = get();
    const tid = templateId ?? s.activeTemplateId;
    if (!tid) return;
    const tpl = s.objectTemplates.find((t) => t.id === tid);
    if (!tpl || tpl.items.length === 0) return;

    const placed = expandTemplateAtPoint(
      tpl,
      x,
      y,
      s.templateRotationRad,
      s.templateScale,
      `obj-${tpl.id.slice(0, 12)}-${Date.now()}`,
    );
    let targetLayerId = "";
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "objects");
      targetLayerId = layer.id;
      const existing = layer.objects ?? [];
      const baseZ = existing.reduce((m, o) => Math.max(m, o.zOrder), 12);
      const minItemZ = placed.reduce((m, o) => Math.min(m, o.zOrder), Infinity);
      const normalized = placed.map((o) => ({
        ...o,
        zOrder: baseZ + 1 + Math.max(0, o.zOrder - (Number.isFinite(minItemZ) ? minItemZ : 0)),
      }));
      layer.objects = [...existing, ...normalized];
    });
    if (targetLayerId && placed.length > 0) {
      set({ selection: { kind: "object", layerId: targetLayerId, id: placed[placed.length - 1].id } });
    }
    get().pushToast(`Stamped "${tpl.name}" (${placed.length} objects)`, "success");
  },

  saveCustomObjectTemplate: ({ name, category = "saved", description, scope, radiusCells = 3.5 }) => {
    const s = get();
    const doc = s.getActiveDoc();
    let captured: ObjectStamp[] = [];

    if (scope === "cluster" && s.selection?.kind === "object") {
      const layer = doc.layers.find((l) => l.id === s.selection?.layerId);
      const anchor = layer?.objects?.find((o) => o.id === s.selection?.id);
      if (anchor && layer?.objects) {
        const r2 = radiusCells * radiusCells;
        captured = layer.objects.filter((o) => {
          const dx = o.x - anchor.x;
          const dy = o.y - anchor.y;
          return dx * dx + dy * dy <= r2;
        });
      }
    } else {
      const activeLayer = doc.layers.find(
        (l) => l.id === doc.activeLayerId && l.kind === "objects" && (l.objects?.length ?? 0) > 0,
      );
      const fallbackLayer =
        activeLayer ??
        doc.layers.find(
          (l) => l.levelId === doc.activeLevelId && l.kind === "objects" && (l.objects?.length ?? 0) > 0,
        );
      captured = fallbackLayer?.objects ?? [];
    }

    if (captured.length === 0) {
      get().pushToast("No objects found to save — select an object or an object layer first.", "warning");
      return false;
    }

    const nextTpl = buildTemplateFromObjects(captured, name, category, description, "#E5A93C");
    const nextList = [nextTpl, ...s.objectTemplates];
    saveUserObjectTemplates(nextList);
    set({
      objectTemplates: nextList,
      activeTemplateId: nextTpl.id,
      activeTool: "template",
      templateRotationRad: 0,
      templateScale: 1.0,
    });
    get().pushToast(`Saved template "${nextTpl.name}" (${captured.length} objects)`, "success");
    return true;
  },

  renameObjectTemplate: (templateId, name) => {
    const clean = name.trim();
    if (!clean) return;
    set((s) => {
      const next = s.objectTemplates.map((t) =>
        t.id === templateId && !t.isBuiltIn ? { ...t, name: clean } : t,
      );
      saveUserObjectTemplates(next);
      return { objectTemplates: next };
    });
    get().pushToast(`Renamed template to "${clean}"`, "info");
  },

  deleteObjectTemplate: (templateId) => {
    const target = get().objectTemplates.find((t) => t.id === templateId);
    if (!target || target.isBuiltIn) return;
    set((s) => {
      const next = s.objectTemplates.filter((t) => t.id !== templateId);
      saveUserObjectTemplates(next);
      return {
        objectTemplates: next,
        activeTemplateId: s.activeTemplateId === templateId ? (next[0]?.id ?? null) : s.activeTemplateId,
      };
    });
    get().pushToast(`Deleted template "${target.name}"`, "info");
  },

  switchDocument: (docId) =>
    set((s) => {
      const bucket = s.historyByDocId[docId] ?? { undo: [], redo: [] };
      const nextDoc = s.documents.find((d) => d.id === docId);
      let nextTool = s.activeTool;
      if (nextDoc?.mode === "world") {
        const validWorldTools: ToolId[] = [
          "select",
          "world_land",
          "world_biome",
          "world_river",
          "world_trail",
          "world_region",
          "stamp",
          "world_label",
          "world_crop",
          "world_theme",
          "dm_note",
          "measure",
        ];
        if (!validWorldTools.includes(nextTool)) nextTool = "select";
      } else if (nextDoc?.mode === "battlemap") {
        if (nextTool.startsWith("world_")) nextTool = "select";
      }
      return {
        activeDocId: docId,
        undoStack: bucket.undo,
        redoStack: bucket.redo,
        dirty: Boolean(s.dirtyDocIds[docId]),
        selection: null,
        soloLayerId: null,
        soloVisibilityBackup: null,
        activeTool: nextTool,
      };
    }),

  closeDocument: (docId) => {
    const state = get();
    if (state.documents.length <= 1) {
      get().pushToast("Cannot close the last open map tab", "warning");
      return;
    }
    const remaining = state.documents.filter((d) => d.id !== docId);
    const nextActiveId = state.activeDocId === docId ? remaining[0].id : state.activeDocId;
    const nextHist = { ...state.historyByDocId };
    delete nextHist[docId];
    const nextDirtyMap = { ...state.dirtyDocIds };
    delete nextDirtyMap[docId];
    const nextSavedNames = { ...state.savedFileNameByDocId };
    delete nextSavedNames[docId];
    const nextAutosave = { ...state.autosaveEnabledByDocId };
    delete nextAutosave[docId];
    const nextSavedAt = { ...state.lastSavedAtByDocId };
    delete nextSavedAt[docId];
    unbindFileHandle(docId);
    const activeBucket = nextHist[nextActiveId] ?? { undo: [], redo: [] };
    set({
      documents: remaining,
      activeDocId: nextActiveId,
      historyByDocId: nextHist,
      dirtyDocIds: nextDirtyMap,
      savedFileNameByDocId: nextSavedNames,
      autosaveEnabledByDocId: nextAutosave,
      lastSavedAtByDocId: nextSavedAt,
      undoStack: activeBucket.undo,
      redoStack: activeBucket.redo,
      dirty: Boolean(nextDirtyMap[nextActiveId]),
      selection: null,
    });
  },

  duplicateDocument: (docId) => {
    const src = get().documents.find((d) => d.id === docId);
    if (!src) return;
    const copy = cloneDoc(src);
    copy.id = `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    copy.meta.title = copy.meta.title.replace(/\.dcmap$/i, "") + "_Copy.dcmap";
    set((s) => ({
      documents: [...s.documents, copy],
      activeDocId: copy.id,
      historyByDocId: { ...s.historyByDocId, [copy.id]: { undo: [], redo: [] } },
      dirtyDocIds: { ...s.dirtyDocIds, [copy.id]: true },
      undoStack: [],
      redoStack: [],
      dirty: true,
      selection: null,
    }));
    get().pushToast(`Duplicated as ${copy.meta.title}`, "success");
  },

  renameDocument: (docId, title) => {
    const clean = title.trim();
    if (!clean) return;
    const finalTitle = clean.endsWith(".dcmap") ? clean : `${clean}.dcmap`;
    set((s) => ({
      documents: s.documents.map((d) =>
        d.id === docId
          ? { ...d, meta: { ...d.meta, title: finalTitle, updatedAt: new Date().toISOString() } }
          : d,
      ),
      dirtyDocIds: { ...s.dirtyDocIds, [docId]: true },
      dirty: s.activeDocId === docId ? true : s.dirty,
    }));
    get().pushToast(`Renamed map to ${finalTitle}`, "success");
  },

  saveDocumentToFile: async (docId, opts) => {
    const state = get();
    const target = docId
      ? state.documents.find((d) => d.id === docId) ?? state.getActiveDoc()
      : state.getActiveDoc();
    const suggestedName = target.meta.title.endsWith(".dcmap")
      ? target.meta.title
      : `${target.meta.title}.dcmap`;

    const forcePicker = Boolean(opts?.saveAs);
    let handle = !forcePicker ? getBoundFileHandle(target.id) : undefined;
    let newlyBound = false;

    if (!handle) {
      try {
        const picked = await pickSaveFileLocation(suggestedName);
        if (picked.status === "cancelled") {
          return false;
        }
        if (picked.status === "picked") {
          handle = picked.handle;
          bindFileHandle(target.id, handle);
          newlyBound = true;
        }
      } catch (err) {
        get().pushToast(
          `Save cancelled or unavailable: ${(err as Error).message}`,
          "warning",
        );
        return false;
      }
    }

    const finalName = handle?.name || suggestedName;
    const nowIso = new Date().toISOString();
    const updatedTarget: DcMapDocument = {
      ...target,
      meta: {
        ...target.meta,
        title: finalName,
        updatedAt: nowIso,
      },
    };
    const jsonText = JSON.stringify(updatedTarget, null, 2);

    if (handle) {
      try {
        await writeJsonToHandle(handle, jsonText);
      } catch (err) {
        get().pushToast(`Could not write ${finalName}: ${(err as Error).message}`, "warning");
        return false;
      }
    } else {
      // Fallback for environments without File System Access API
      triggerFallbackDownload(finalName, jsonText);
      newlyBound = !state.savedFileNameByDocId[target.id];
    }

    const nowMs = Date.now();
    set((s) => {
      const nextDirtyMap = { ...s.dirtyDocIds, [target.id]: false };
      return {
        documents: s.documents.map((d) => (d.id === target.id ? updatedTarget : d)),
        dirtyDocIds: nextDirtyMap,
        dirty: Boolean(nextDirtyMap[s.activeDocId]),
        savedFileNameByDocId: { ...s.savedFileNameByDocId, [target.id]: finalName },
        autosaveEnabledByDocId: {
          ...s.autosaveEnabledByDocId,
          [target.id]: newlyBound
            ? true
            : (s.autosaveEnabledByDocId[target.id] ?? true),
        },
        lastSavedAtByDocId: { ...s.lastSavedAtByDocId, [target.id]: nowMs },
        lastAutosavedAt: nowMs,
      };
    });

    get().autosaveSession(true);
    if (!opts?.silent) {
      get().pushToast(
        newlyBound
          ? `Saved ${finalName} · Auto-Save ON`
          : `Saved ${finalName}`,
        "success",
      );
    }
    return true;
  },

  openDocumentFromPicker: async () => {
    try {
      const res = await pickOpenMapFile();
      if (res.status === "unsupported") return "unsupported";
      if (res.status === "cancelled") return "cancelled";

      const lower = res.fileName.toLowerCase();
      if (lower.endsWith(".wonderdraft_map") || lower.endsWith(".dungeondraft_map")) {
        get().openExternalMapImport(res.fileName, res.bytes);
        return "opened";
      }

      const text = res.text ?? new TextDecoder("utf-8").decode(res.bytes);
      const ok = get().loadDocumentJson(text);
      if (!ok) {
        // Might be an extracted Wonderdraft JSON or Dungeondraft JSON saved as .json
        get().openExternalMapImport(res.fileName, res.bytes);
        return "opened";
      }
      const openedId = get().activeDocId;
      bindFileHandle(openedId, res.handle);
      const nowMs = Date.now();
      set((s) => ({
        documents: s.documents.map((d) =>
          d.id === openedId ? { ...d, meta: { ...d.meta, title: res.handle.name } } : d,
        ),
        savedFileNameByDocId: { ...s.savedFileNameByDocId, [openedId]: res.handle.name },
        autosaveEnabledByDocId: { ...s.autosaveEnabledByDocId, [openedId]: true },
        lastSavedAtByDocId: { ...s.lastSavedAtByDocId, [openedId]: nowMs },
      }));
      get().pushToast(`Opened ${res.handle.name} · Auto-Save ON`, "success");
      return "opened";
    } catch {
      return "unsupported";
    }
  },

  setDocAutosaveEnabled: (docId, enabled) => {
    set((s) => ({
      autosaveEnabledByDocId: { ...s.autosaveEnabledByDocId, [docId]: enabled },
    }));
    const fname = get().savedFileNameByDocId[docId] ?? "this map";
    get().pushToast(
      enabled ? `Auto-Save ON for ${fname}` : `Auto-Save paused for ${fname}`,
      "info",
    );
  },

  autosaveBoundFiles: async () => {
    const state = get();
    let count = 0;
    for (const d of state.documents) {
      if (!state.dirtyDocIds[d.id]) continue;
      if (!state.autosaveEnabledByDocId[d.id]) continue;
      const handle = getBoundFileHandle(d.id);
      if (!handle) continue;
      const ok = await get().saveDocumentToFile(d.id, { silent: true });
      if (ok) count++;
    }
    return count;
  },

  autosaveSession: (silent = true) => {
    try {
      const state = get();
      const payload = JSON.stringify({
        savedAt: Date.now(),
        activeDocId: state.activeDocId,
        documents: state.documents,
      });
      localStorage.setItem(AUTOSAVE_STORAGE_KEY, payload);
      set({ lastAutosavedAt: Date.now() });
      if (!silent) {
        get().pushToast("Autosaved workspace locally", "info");
      }
      return true;
    } catch {
      // QuotaExceeded or restricted storage — fail gracefully without crashing
      return false;
    }
  },

  restoreAutosavedSession: () => {
    try {
      const raw = readStorageWithLegacyFallback(AUTOSAVE_STORAGE_KEY, LEGACY_AUTOSAVE_STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as {
        savedAt?: number;
        activeDocId?: string;
        documents?: DcMapDocument[];
      };
      if (!Array.isArray(parsed.documents) || parsed.documents.length === 0) return false;
      const normalized = parsed.documents
        .filter((d) => d && d.schemaVersion === "1.0.0" && Array.isArray(d.layers))
        .map(normalizeLoadedDoc);
      if (normalized.length === 0) return false;
      const sovIdx = normalized.findIndex((d) => d.id === initialSovereignTemple.id);
      const hasLegacyPass1Notes =
        sovIdx >= 0 &&
        normalized[sovIdx].layers.some(
          (l) => l.kind === "dm_notes" && (l.dmNotes ?? []).some((n) => !n.badge),
        );
      const missingIceCreamShop =
        sovIdx >= 0 &&
        !normalized[sovIdx].layers.some((l) =>
          (l.paths ?? []).some((p) => p.assetId === "modular-suite/paths/ic_mini_brass_track.png"),
        );
      const missingMessyApartments =
        sovIdx >= 0 &&
        !normalized[sovIdx].layers.some((l) =>
          (l.objects ?? []).some((o) => o.assetId === "modular-suite/props/messy_apartment/apt_unmade_messy_bed.png"),
        );
      const missingNeighborhoodPark =
        sovIdx >= 0 &&
        !normalized[sovIdx].layers.some((l) =>
          (l.objects ?? []).some((o) => o.assetId === "modular-suite/props/neighborhood_park/pk_wooden_swing_set.png"),
        );
      const missingDistrictStreets =
        sovIdx >= 0 &&
        !normalized[sovIdx].layers.some((l) =>
          (l.objects ?? []).some((o) => o.assetId === "modular-suite/props/district_streets/vigil_candle_wax_drift.png"),
        );
      const missingArchitecturalStairs =
        sovIdx >= 0 &&
        !normalized[sovIdx].layers.some((l) =>
          (l.objects ?? []).some((o) => o.assetId === "modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png"),
        );
      const missingLightingSuite =
        sovIdx >= 0 &&
        !normalized[sovIdx].layers.some((l) =>
          (l.objects ?? []).some((o) => o.assetId === "modular-suite/props/harmony_lighting/lgt_floor_cathedral_candelabra_brass.png"),
        );
      const missingSubterraneanLevels =
        sovIdx >= 0 &&
        (!normalized[sovIdx].levels.some((lv) => lv.shortCode === "B3") ||
          !normalized[sovIdx].layers.some((l) =>
            (l.objects ?? []).some((o) => o.assetId === "modular-suite/props/subterranean_caves/sub_speakeasy_poker_table_felt.png"),
          ));
      if (sovIdx < 0) {
        normalized.unshift(cloneDoc(initialSovereignTemple));
      } else if (
        hasLegacyPass1Notes ||
        missingIceCreamShop ||
        missingMessyApartments ||
        missingNeighborhoodPark ||
        missingDistrictStreets ||
        missingArchitecturalStairs ||
        missingLightingSuite ||
        missingSubterraneanLevels ||
        (normalized[sovIdx].meta.author === initialSovereignTemple.meta.author &&
          normalized[sovIdx].meta.updatedAt < initialSovereignTemple.meta.updatedAt)
      ) {
        // Refresh an earlier unpolished showcase snapshot in-place without disturbing user tabs or user edits!
        normalized[sovIdx] = cloneDoc(initialSovereignTemple);
      }
      const activeId =
        sovIdx < 0
          ? initialSovereignTemple.id
          : normalized.some((d) => d.id === parsed.activeDocId)
            ? (parsed.activeDocId as string)
            : normalized[0].id;
      const hist: Record<string, DocHistoryBucket> = {};
      for (const d of normalized) hist[d.id] = { undo: [], redo: [] };
      set({
        documents: normalized,
        activeDocId: activeId,
        historyByDocId: hist,
        dirtyDocIds: {},
        undoStack: [],
        redoStack: [],
        dirty: false,
        lastAutosavedAt: parsed.savedAt ?? Date.now(),
        selection: null,
      });
      return true;
    } catch {
      return false;
    }
  },

  loadDocumentJson: (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr) as DcMapDocument;
      if (parsed.schemaVersion !== "1.0.0" || !Array.isArray(parsed.layers)) {
        get().pushToast("Invalid .dcmap file format", "warning");
        return false;
      }
      const normalized = normalizeLoadedDoc(parsed);
      normalized.id = `map-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      set((s) => ({
        documents: [...s.documents, normalized],
        activeDocId: normalized.id,
        historyByDocId: { ...s.historyByDocId, [normalized.id]: { undo: [], redo: [] } },
        dirtyDocIds: { ...s.dirtyDocIds, [normalized.id]: false },
        undoStack: [],
        redoStack: [],
        dirty: false,
        selection: null,
      }));
      get().pushToast(`Opened ${normalized.meta.title}`, "success");
      return true;
    } catch {
      get().pushToast("Failed parsing .dcmap JSON", "warning");
      return false;
    }
  },

  setActiveTool: (tool) =>
    set((s) => {
      const targetKind = toolToLayerKind(tool);
      const doc = s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0];
      const preferred =
        targetKind && doc ? findPreferredLayerForKind(doc, targetKind) : null;
      const nextSelection = tool === "select" ? s.selection : null;
      if (!preferred || !doc || doc.activeLayerId === preferred.id) {
        return {
          activeTool: tool,
          // Clear selection when switching to a drawing tool so the material/style picker appears immediately
          selection: nextSelection,
        };
      }
      return {
        activeTool: tool,
        selection: nextSelection,
        documents: s.documents.map((d) =>
          d.id === doc.id ? { ...d, activeLayerId: preferred.id } : d,
        ),
      };
    }),
  setSnapMode: (snapMode) => {
    set((s) => ({
      snapMode,
      lastSnapMode: snapMode === "free" ? s.lastSnapMode : snapMode,
    }));
    get().updatePreferences({ snapMode });
  },
  toggleSnapEnabled: () => {
    const s = get();
    const next: SnapMode = s.snapMode === "free" ? s.lastSnapMode : "free";
    s.setSnapMode(next);
    s.pushToast(
      next === "free"
        ? "Grid Snapping OFF — Free placement enabled"
        : `Grid Snapping ON (${next === "half" ? "Half-Square" : "Full-Square"})`,
    );
  },
  selectLevel: (levelId) => {
    const preferredKind = toolToLayerKind(get().activeTool);
    get().commitDocMutation((d) => {
      applyLevelVisibility(d, levelId, preferredKind);
    }, false);
    set({ selection: null, soloLayerId: null, soloVisibilityBackup: null });
  },
  stepLevel: (direction) => {
    const doc = get().getActiveDoc();
    const sorted = sortLevelsTopDown(doc.levels);
    const idx = sorted.findIndex((lv) => lv.id === doc.activeLevelId);
    if (idx < 0) return;
    const nextIdx = direction === "up" ? Math.max(0, idx - 1) : Math.min(sorted.length - 1, idx + 1);
    if (nextIdx !== idx) {
      get().selectLevel(sorted[nextIdx].id);
      get().pushToast(`Switched to ${sorted[nextIdx].shortCode} — ${sorted[nextIdx].name}`);
    }
  },
  addSkyLevel: () => {
    let createdLabel = "";
    get().commitDocMutation((d) => {
      const skyLevels = d.levels.filter((lv) => lv.kind === "sky");
      let maxSkyNum = skyLevels.length;
      for (const sl of skyLevels) {
        const m = sl.shortCode.match(/(\d+)/);
        if (m) maxSkyNum = Math.max(maxSkyNum, Number(m[1]));
      }
      const nextNum = maxSkyNum + 1;
      const maxRoofElev = d.levels
        .filter((lv) => lv.kind === "roof" || lv.kind === "upper" || lv.kind === "ground")
        .reduce((mx, lv) => Math.max(mx, lv.elevationFt), 16);
      const maxSkyElev = skyLevels.reduce((mx, lv) => Math.max(mx, lv.elevationFt), maxRoofElev);
      const nextElev = maxSkyElev + 12;
      const newId = `lvl-sky-${nextNum}-${Date.now().toString(36).slice(-4)}`;
      const shortCode = `Sky ${nextNum}`;
      const name = `Sky ${nextNum}: High-Altitude Deck`;
      createdLabel = `${shortCode} (+${nextElev} ft)`;

      d.levels.push({
        id: newId,
        shortCode,
        name,
        kind: "sky",
        elevationFt: nextElev,
        visible: true,
      });

      const stamp = Date.now();
      const newLayers: MapLayer[] = [
        {
          id: `layer-${newId}-decks-${stamp}`,
          name: "Airship Decks",
          kind: "terrain",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          terrainStrokes: [],
        },
        {
          id: `layer-${newId}-hulls-${stamp}`,
          name: "Hull & Portals",
          kind: "walls",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          walls: [],
          portals: [],
        },
        {
          id: `layer-${newId}-props-${stamp}`,
          name: "Deck Props",
          kind: "objects",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          objects: [],
        },
        {
          id: `layer-${newId}-lights-${stamp}`,
          name: "Sky Lights",
          kind: "lights",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "add",
          levelId: newId,
          lights: [],
        },
      ];
      d.layers.push(...newLayers);
      applyLevelVisibility(d, newId);
    });
    get().pushToast(`Added ${createdLabel} above roofs`, "success");
  },
  addLevelAbove: (mode = "auto") => {
    const activeDoc = get().getActiveDoc();
    const activeLv = activeDoc.levels.find((lv) => lv.id === activeDoc.activeLevelId);
    if (
      mode === "sky" ||
      (mode === "auto" && (activeLv?.kind === "roof" || activeLv?.kind === "sky"))
    ) {
      get().addSkyLevel();
      return;
    }

    let createdLabel = "";
    get().commitDocMutation((d) => {
      const upperLevels = d.levels.filter((lv) => lv.kind === "upper");
      const nextNum = upperLevels.length + 2; // 2F, 3F, 4F...
      const maxUpperElev = upperLevels.reduce((m, lv) => Math.max(m, lv.elevationFt), 0);
      const nextElev = maxUpperElev + 12;
      const newId = `lvl-floor${nextNum}-${Date.now().toString(36).slice(-4)}`;
      const shortCode = `${nextNum}F`;
      const name = `Level ${nextNum}: ${shortCode} Upper Floor`;
      createdLabel = `${shortCode} (+${nextElev} ft)`;

      // Keep roof & multi-deck sky elevations cleanly spaced above the new upper floor
      let maxRoofElev = nextElev;
      for (const lv of d.levels) {
        if (lv.kind === "roof" && lv.elevationFt <= nextElev) {
          lv.elevationFt = nextElev + 12;
        }
        if (lv.kind === "roof") {
          maxRoofElev = Math.max(maxRoofElev, lv.elevationFt);
        }
      }
      const skyLevelsSorted = d.levels
        .filter((lv) => lv.kind === "sky")
        .sort((a, b) => a.elevationFt - b.elevationFt);
      if (skyLevelsSorted.length > 0 && skyLevelsSorted[0].elevationFt <= maxRoofElev + 12) {
        const shift = maxRoofElev + 14 - skyLevelsSorted[0].elevationFt;
        for (const slv of skyLevelsSorted) {
          slv.elevationFt += shift;
        }
      }
      d.levels.push({ id: newId, shortCode, name, kind: "upper", elevationFt: nextElev, visible: true });

      // Insert 3 starter layers cleanly right BEFORE roofs / lights / DM notes
      const roofIdx = d.layers.findIndex((l) => l.levelId === "lvl-roofs" || l.kind === "lights" || l.kind === "dm_notes");
      const insertAt = roofIdx >= 0 ? roofIdx : d.layers.length;
      const stamp = Date.now();
      const newLayers: MapLayer[] = [
        {
          id: `layer-${newId}-slabs-${stamp}`,
          name: "Floor Slabs",
          kind: "terrain",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          terrainStrokes: [],
        },
        {
          id: `layer-${newId}-walls-${stamp}`,
          name: "Walls & Doors",
          kind: "walls",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          walls: [],
          portals: [],
        },
        {
          id: `layer-${newId}-objs-${stamp}`,
          name: "Furnishings",
          kind: "objects",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          objects: [],
        },
      ];
      d.layers.splice(insertAt, 0, ...newLayers);
      applyLevelVisibility(d, newId);
    });
    set({ selection: null, showOnionSkin: true });
    get().pushToast(`Added ${createdLabel} (Onion-Skin blueprint ON to align walls & stairs)`, "success");
  },
  addLevelBelow: () => {
    let createdLabel = "";
    get().commitDocMutation((d) => {
      const underLevels = d.levels.filter((lv) => lv.kind === "underground");
      const nextNum = underLevels.length + 1; // B1, B2, B3...
      const minUnderElev = underLevels.reduce((m, lv) => Math.min(m, lv.elevationFt), 0);
      const nextElev = minUnderElev - 12;
      const newId = `lvl-b${nextNum}-${Date.now().toString(36).slice(-4)}`;
      const shortCode = `B${nextNum}`;
      const name = `${shortCode}: Underground Level ${nextNum}`;
      createdLabel = `${shortCode} (${nextElev} ft)`;

      d.levels.push({ id: newId, shortCode, name, kind: "underground", elevationFt: nextElev, visible: true });

      const stamp = Date.now();
      const newLayers: MapLayer[] = [
        {
          id: `layer-${newId}-terrain-${stamp}`,
          name: "Tunnel Floors",
          kind: "terrain",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          terrainStrokes: [],
        },
        {
          id: `layer-${newId}-water-${stamp}`,
          name: "Underground Water",
          kind: "water",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          waterRegions: [],
        },
        {
          id: `layer-${newId}-walls-${stamp}`,
          name: "Stone Walls",
          kind: "walls",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          walls: [],
          portals: [],
        },
        {
          id: `layer-${newId}-objs-${stamp}`,
          name: "Cellar Props",
          kind: "objects",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          levelId: newId,
          objects: [],
        },
        {
          id: `layer-${newId}-lights-${stamp}`,
          name: "Subterranean Lights",
          kind: "lights",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "add",
          levelId: newId,
          lights: [],
        },
      ];
      // Insert subterranean layers cleanly at the bottom of the layer stack
      d.layers.unshift(...newLayers);
      applyLevelVisibility(d, newId);
    });
    set({ selection: null, showOnionSkin: true });
    get().pushToast(`Added ${createdLabel} (Onion-Skin blueprint ON to align stairs & manholes)`, "success");
  },
  renameLevel: (levelId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    get().commitDocMutation((d) => {
      const lv = d.levels.find((x) => x.id === levelId);
      if (lv) lv.name = trimmed;
    });
  },
  updateLevelMeta: (levelId, partial) => {
    const doc = get().getActiveDoc();
    const existing = doc.levels.find((x) => x.id === levelId);
    if (!existing) return;
    const nextName =
      partial.name !== undefined && partial.name.trim() ? partial.name.trim() : existing.name;
    const nextShortCode =
      partial.shortCode !== undefined && partial.shortCode.trim()
        ? partial.shortCode.trim().slice(0, 10)
        : existing.shortCode;
    const nextElev =
      partial.elevationFt !== undefined && Number.isFinite(partial.elevationFt)
        ? Math.round(partial.elevationFt)
        : existing.elevationFt;
    if (
      nextName === existing.name &&
      nextShortCode === existing.shortCode &&
      nextElev === existing.elevationFt
    ) {
      return;
    }
    get().commitDocMutation((d) => {
      const lv = d.levels.find((x) => x.id === levelId);
      if (!lv) return;
      lv.name = nextName;
      lv.shortCode = nextShortCode;
      lv.elevationFt = nextElev;
    });
    get().pushToast(`Updated ${nextShortCode} (${nextName})`, "success");
  },
  deleteLevel: (levelId) => {
    const doc = get().getActiveDoc();
    const target = doc.levels.find((lv) => lv.id === levelId);
    if (!target || target.kind === "ground") {
      get().pushToast("Cannot delete the 1F Ground level", "warning");
      return;
    }
    const ground = doc.levels.find((lv) => lv.kind === "ground") ?? doc.levels[0];
    get().commitDocMutation((d) => {
      d.levels = d.levels.filter((lv) => lv.id !== levelId);
      d.layers = d.layers.filter((l) => l.levelId !== levelId);
      if (d.activeLevelId === levelId && ground) {
        applyLevelVisibility(d, ground.id);
      }
    });
    set({ selection: null, soloLayerId: null, soloVisibilityBackup: null });
    get().pushToast(`Removed ${target.shortCode} floor`);
  },
  setShowOnionSkin: (showOnionSkin) => set({ showOnionSkin }),
  setFilterLayersByFloor: (filterLayersByFloor) => set({ filterLayersByFloor }),
  setIsolateActiveFloor: (isolateActiveFloor) => set({ isolateActiveFloor }),
  setLockLowerFloors: (lockLowerFloors) => set({ lockLowerFloors }),
  toggleLevelLayersVisible: (levelId) => {
    const doc = get().getActiveDoc();
    const lv = doc.levels.find((x) => x.id === levelId);
    const levelLayers = doc.layers.filter((l) => l.levelId === levelId);
    if (!lv || levelLayers.length === 0) return;
    const nextVisible = levelLayers.some((l) => !l.visible);
    get().commitDocMutation((d) => {
      const targetLv = d.levels.find((x) => x.id === levelId);
      if (targetLv) targetLv.visible = nextVisible;
      for (const l of d.layers) {
        if (l.levelId === levelId) l.visible = nextVisible;
      }
    });
    set({ soloLayerId: null, soloVisibilityBackup: null });
    get().pushToast(
      nextVisible ? `Shown all ${lv.shortCode} layers` : `Hidden all ${lv.shortCode} layers`,
    );
  },
  toggleLevelLayersLocked: (levelId) => {
    const doc = get().getActiveDoc();
    const lv = doc.levels.find((x) => x.id === levelId);
    const levelLayers = doc.layers.filter((l) => l.levelId === levelId);
    if (!lv || levelLayers.length === 0) return;
    const nextLocked = !levelLayers.every((l) => l.locked);
    get().commitDocMutation((d) => {
      for (const l of d.layers) {
        if (l.levelId === levelId) l.locked = nextLocked;
      }
    });
    get().pushToast(
      nextLocked ? `Locked all ${lv.shortCode} layers` : `Unlocked all ${lv.shortCode} layers`,
    );
  },
  setFloorView: (mode) => {
    const doc = get().getActiveDoc();
    const target =
      mode === "roofs"
        ? doc.levels.find((lv) => lv.kind === "roof")
        : mode === "floor2"
          ? doc.levels.find((lv) => lv.kind === "upper")
          : doc.levels.find((lv) => lv.kind === "ground");
    if (target) get().selectLevel(target.id);
  },
  setDmViewMode: (dmViewMode) => set({ dmViewMode }),
  setShowVttOverlay: (showVttOverlay) => set({ showVttOverlay }),
  setShowScatterOutlines: (showScatterOutlines) => set({ showScatterOutlines }),
  setSelection: (selection) =>
    set((s) => {
      const sameEntity =
        Boolean(selection && s.selection) &&
        selection!.kind === s.selection!.kind &&
        selection!.id === s.selection!.id &&
        selection!.layerId === s.selection!.layerId;
      const nextSegIdx = sameEntity ? s.selectedWallSegmentIndex : null;
      if (!selection?.layerId) {
        return { selection, selectedWallSegmentIndex: nextSegIdx };
      }
      const doc = s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0];
      if (
        !doc ||
        doc.activeLayerId === selection.layerId ||
        !doc.layers.some((l) => l.id === selection.layerId)
      ) {
        return { selection, selectedWallSegmentIndex: nextSegIdx };
      }
      return {
        selection,
        selectedWallSegmentIndex: nextSegIdx,
        documents: s.documents.map((d) =>
          d.id === doc.id ? { ...d, activeLayerId: selection.layerId } : d,
        ),
      };
    }),
  setSelectedWallSegmentIndex: (selectedWallSegmentIndex) => set({ selectedWallSegmentIndex }),
  setZoomPercent: (zoomPercent) => set({ zoomPercent }),
  setCursorGridPos: (cursorGridPos) => set({ cursorGridPos }),
  setBrushParams: (partial) =>
    set((s) => ({
      ...partial,
      ...(partial.activeTerrainAssetId
        ? { recentTerrainAssetIds: pushRecentTerrain(s.recentTerrainAssetIds, partial.activeTerrainAssetId) }
        : {}),
    })),
  setActiveRecolor: (partial) =>
    set((s) => ({ activeRecolor: { ...s.activeRecolor, ...partial } })),
  setToolRecolor: (tool, partial) =>
    set((s) => ({
      toolRecolors: {
        ...s.toolRecolors,
        [tool]: { ...s.toolRecolors[tool], ...partial },
      },
    })),
  addCustomSwatch: (hex) =>
    set((s) => {
      const clean = hex.toUpperCase();
      const next = [clean, ...s.customSwatches.filter((c) => c.toUpperCase() !== clean)].slice(0, 18);
      saveCustomSwatches(next);
      return { customSwatches: next };
    }),
  removeCustomSwatch: (hex) =>
    set((s) => {
      const clean = hex.toUpperCase();
      const next = s.customSwatches.filter((c) => c.toUpperCase() !== clean);
      saveCustomSwatches(next);
      return { customSwatches: next };
    }),
  setEyedropperTarget: (eyedropperTarget) => set({ eyedropperTarget }),
  applyEyedropperColor: (hex) => {
    const clean = hex.toUpperCase();
    const state = get();
    const target = state.eyedropperTarget;
    if (!target) return;
    if (target === "stamp") {
      state.setActiveRecolor({ enabled: true, tintHex: clean });
    } else if (target === "selection" && state.selection) {
      const sel = state.selection;
      const doc = state.getActiveDoc();
      const layer = doc.layers.find((l) => l.id === sel.layerId);
      if (sel.kind === "object") {
        const obj = layer?.objects?.find((o) => o.id === sel.id);
        if (obj) {
          state.updateObjectStamp(sel.layerId, sel.id, {
            recolor: { ...obj.recolor, enabled: true, tintHex: clean },
          }, true);
        }
      } else if (sel.kind === "wall") {
        const w = layer?.walls?.find((x) => x.id === sel.id);
        if (w) {
          state.updateWall(sel.layerId, sel.id, {
            recolor: { ...(w.recolor ?? DEFAULT_RECOLOR), enabled: true, tintHex: clean },
          }, true);
        }
      } else if (sel.kind === "path") {
        const p = layer?.paths?.find((x) => x.id === sel.id);
        if (p) {
          state.updatePath(sel.layerId, sel.id, {
            recolor: { ...(p.recolor ?? DEFAULT_RECOLOR), enabled: true, tintHex: clean },
          }, true);
        }
      } else if (sel.kind === "roof") {
        const rf = layer?.roofs?.find((x) => x.id === sel.id);
        if (rf) {
          state.updateRoof(sel.layerId, sel.id, {
            recolor: { ...(rf.recolor ?? DEFAULT_RECOLOR), enabled: true, tintHex: clean },
          }, true);
        }
      } else if (sel.kind === "portal") {
        const pt = layer?.portals?.find((x) => x.id === sel.id);
        if (pt) {
          state.updatePortal(sel.layerId, sel.id, {
            recolor: { ...(pt.recolor ?? DEFAULT_RECOLOR), enabled: true, tintHex: clean },
          }, true);
        }
      }
    } else if (
      target === "wall" ||
      target === "path" ||
      target === "portal" ||
      target === "terrain" ||
      target === "roof"
    ) {
      state.setToolRecolor(target, { enabled: true, tintHex: clean });
    }
    set({ eyedropperTarget: null });
    state.pushToast(`Sampled ${clean} from map`, "success");
  },

  setActiveLayer: (layerId) =>
    get().commitDocMutation((d) => {
      d.activeLayerId = layerId;
    }, false),

  addLayer: (kind, name, dmOnly = false, levelId) => {
    const newId = `layer-${kind}-${Date.now()}`;
    const caveThemeId = get().caveThemeId;
    get().commitDocMutation((d) => {
      const targetLevel = levelId ?? d.activeLevelId;
      const newLayer: MapLayer = {
        id: newId,
        name,
        kind,
        visible: true,
        locked: false,
        dmOnly,
        opacity: 1,
        blendMode: kind === "lights" ? "add" : "normal",
        levelId: targetLevel,
        terrainStrokes: kind === "terrain" ? [] : undefined,
        caveSystem: kind === "caves" ? createDefaultCaveSystem(caveThemeId) : undefined,
        waterRegions: kind === "water" ? [] : undefined,
        walls: kind === "walls" ? [] : undefined,
        portals: kind === "walls" ? [] : undefined,
        paths: kind === "paths" ? [] : undefined,
        roofs: kind === "roofs" ? [] : undefined,
        objects: kind === "objects" ? [] : undefined,
        scatterZones: kind === "scatter_zone" ? [] : undefined,
        lights: kind === "lights" ? [] : undefined,
        dmNotes: kind === "dm_notes" ? [] : undefined,
      };
      insertLayerInFloorBand(d, newLayer);
      d.activeLayerId = newId;
    });
    get().pushToast(`Added layer "${name}"`, "success");
  },

  setLayerLevel: (layerId, levelId) => {
    const doc = get().getActiveDoc();
    const existing = doc.layers.find((x) => x.id === layerId);
    const targetLvl = doc.levels.find((lv) => lv.id === levelId);
    if (!existing || !targetLvl || existing.levelId === levelId) return;
    const label = `${targetLvl.shortCode} (${targetLvl.name})`;
    get().commitDocMutation((d) => {
      const idx = d.layers.findIndex((x) => x.id === layerId);
      const lv = d.levels.find((x) => x.id === levelId);
      if (idx < 0 || !lv) return;
      const [moved] = d.layers.splice(idx, 1);
      moved.levelId = levelId;
      moved.visible = lv.visible;
      insertLayerInFloorBand(d, moved);
    });
    if (get().soloLayerId === layerId) {
      set({ soloLayerId: null, soloVisibilityBackup: null });
    }
    get().pushToast(`Moved "${existing.name}" to ${label}`, "success");
  },

  duplicateLayer: (layerId) =>
    get().commitDocMutation((d) => {
      const idx = d.layers.findIndex((l) => l.id === layerId);
      if (idx < 0) return;
      const copy = structuredClone(d.layers[idx]);
      copy.id = `layer-${Date.now()}`;
      copy.name = `${copy.name} Copy`;
      d.layers.splice(idx + 1, 0, copy);
      d.activeLayerId = copy.id;
    }),

  deleteLayer: (layerId) => {
    const doc = get().getActiveDoc();
    if (doc.layers.length <= 1) {
      get().pushToast("Cannot delete the last layer", "warning");
      return;
    }
    get().commitDocMutation((d) => {
      d.layers = d.layers.filter((l) => l.id !== layerId);
      if (d.activeLayerId === layerId) {
        d.activeLayerId = d.layers[d.layers.length - 1].id;
      }
    });
    set({ selection: null });
  },

  renameLayer: (layerId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = get().getActiveDoc().layers.find((x) => x.id === layerId);
    if (!current || current.name === trimmed) return;
    get().commitDocMutation((d) => {
      const l = d.layers.find((x) => x.id === layerId);
      if (l) l.name = trimmed;
    });
  },

  toggleLayerVisible: (layerId) => {
    get().commitDocMutation((d) => {
      const l = d.layers.find((x) => x.id === layerId);
      if (l) l.visible = !l.visible;
    });
    if (get().soloLayerId) {
      set({ soloLayerId: null, soloVisibilityBackup: null });
    }
  },

  soloLayer: (layerId) => {
    const state = get();
    const doc = state.getActiveDoc();
    const target = doc.layers.find((l) => l.id === layerId);
    if (!target) return;

    // Second Alt+Click on the same soloed layer restores original floor visibilities
    if (state.soloLayerId === layerId && state.soloVisibilityBackup) {
      const backup = state.soloVisibilityBackup;
      state.commitDocMutation((d) => {
        for (const l of d.layers) {
          if (Object.prototype.hasOwnProperty.call(backup, l.id)) {
            l.visible = backup[l.id];
          }
        }
      }, false);
      set({ soloLayerId: null, soloVisibilityBackup: null });
      state.pushToast("Restored layer visibility");
      return;
    }

    // If switching solo to another layer on a different floor, restore previous floor first
    const prevSolo = state.soloLayerId
      ? doc.layers.find((l) => l.id === state.soloLayerId)
      : undefined;
    const reuseSameFloorBackup =
      Boolean(prevSolo && prevSolo.levelId === target.levelId && state.soloVisibilityBackup);
    const prevBackup = state.soloVisibilityBackup;

    const nextBackup: Record<string, boolean> = reuseSameFloorBackup
      ? { ...prevBackup! }
      : {};
    if (!reuseSameFloorBackup) {
      for (const l of doc.layers) {
        if (l.levelId === target.levelId) {
          nextBackup[l.id] = l.visible;
        }
      }
    }

    state.commitDocMutation((d) => {
      if (!reuseSameFloorBackup && prevBackup) {
        for (const l of d.layers) {
          if (Object.prototype.hasOwnProperty.call(prevBackup, l.id)) {
            l.visible = prevBackup[l.id];
          }
        }
      }
      for (const l of d.layers) {
        if (l.levelId === target.levelId) {
          l.visible = l.id === layerId;
        }
      }
      d.activeLayerId = layerId;
    }, false);
    set({ soloLayerId: layerId, soloVisibilityBackup: nextBackup });
    state.pushToast(`Soloed "${target.name}" (Alt+Click Eye to restore)`);
  },

  stepActiveLayer: (direction) => {
    const doc = get().getActiveDoc();
    const floorLayers = doc.layers.filter((l) => l.levelId === doc.activeLevelId);
    const pool = floorLayers.length > 0 ? floorLayers : doc.layers;
    if (pool.length === 0) return;
    const curIdx = pool.findIndex((l) => l.id === doc.activeLayerId);
    const nextIdx =
      curIdx < 0
        ? pool.length - 1
        : direction === "up"
          ? Math.min(pool.length - 1, curIdx + 1)
          : Math.max(0, curIdx - 1);
    const target = pool[nextIdx];
    if (target && target.id !== doc.activeLayerId) {
      get().setActiveLayer(target.id);
    }
  },

  toggleLayerLocked: (layerId) =>
    get().commitDocMutation((d) => {
      const l = d.layers.find((x) => x.id === layerId);
      if (l) l.locked = !l.locked;
    }),

  toggleLayerDmOnly: (layerId) =>
    get().commitDocMutation((d) => {
      const l = d.layers.find((x) => x.id === layerId);
      if (l) l.dmOnly = !l.dmOnly;
    }),

  setLayerOpacity: (layerId, opacity) =>
    get().commitDocMutation((d) => {
      const l = d.layers.find((x) => x.id === layerId);
      if (l) l.opacity = Math.max(0, Math.min(1, opacity));
    }, false),

  setLayerBlendMode: (layerId, mode) =>
    get().commitDocMutation((d) => {
      const l = d.layers.find((x) => x.id === layerId);
      if (l) l.blendMode = mode;
    }),

  reorderLayer: (layerId, direction) => {
    const activeDoc = get().getActiveDoc();
    const curIdx = activeDoc.layers.findIndex((l) => l.id === layerId);
    if (curIdx < 0) return;
    const curLevelId = activeDoc.layers[curIdx].levelId;
    const step = direction === "up" ? 1 : -1;
    let targetIdx = -1;
    for (let i = curIdx + step; i >= 0 && i < activeDoc.layers.length; i += step) {
      if (activeDoc.layers[i].levelId === curLevelId) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx < 0) return;
    get().commitDocMutation((d) => {
      const idx = d.layers.findIndex((l) => l.id === layerId);
      if (idx < 0) return;
      let dest = -1;
      for (let i = idx + step; i >= 0 && i < d.layers.length; i += step) {
        if (d.layers[i].levelId === d.layers[idx].levelId) {
          dest = i;
          break;
        }
      }
      if (dest < 0) return;
      const [item] = d.layers.splice(idx, 1);
      d.layers.splice(dest, 0, item);
    });
  },

  moveLayerRelative: (sourceLayerId, targetLayerId, placement) => {
    if (sourceLayerId === targetLayerId) return;
    const activeDoc = get().getActiveDoc();
    const origIdx = activeDoc.layers.findIndex((l) => l.id === sourceLayerId);
    const origTargetIdx = activeDoc.layers.findIndex((l) => l.id === targetLayerId);
    if (origIdx < 0 || origTargetIdx < 0) return;
    const origSource = activeDoc.layers[origIdx];
    const origTarget = activeDoc.layers[origTargetIdx];
    const crossesFloor = origSource.levelId !== origTarget.levelId;
    // Preview final insertion index after removing source so true no-op drops skip history
    const adjustedTarget = origTargetIdx > origIdx ? origTargetIdx - 1 : origTargetIdx;
    const finalIdx = placement === "above" ? adjustedTarget + 1 : adjustedTarget;
    if (finalIdx === origIdx && !crossesFloor) return;

    const destLevel = crossesFloor
      ? activeDoc.levels.find((lv) => lv.id === origTarget.levelId)
      : null;

    get().commitDocMutation((d) => {
      const sIdx = d.layers.findIndex((l) => l.id === sourceLayerId);
      if (sIdx < 0) return;
      const [moved] = d.layers.splice(sIdx, 1);
      const tIdx = d.layers.findIndex((l) => l.id === targetLayerId);
      if (tIdx < 0) {
        d.layers.splice(sIdx, 0, moved);
        return;
      }
      const targetLayer = d.layers[tIdx];
      if (moved.levelId !== targetLayer.levelId) {
        moved.levelId = targetLayer.levelId;
        const lv = d.levels.find((x) => x.id === targetLayer.levelId);
        if (lv) moved.visible = lv.visible;
      }
      const insertAt = placement === "above" ? tIdx + 1 : tIdx;
      d.layers.splice(insertAt, 0, moved);
    });

    if (crossesFloor && destLevel) {
      get().pushToast(`Moved "${origSource.name}" to ${destLevel.shortCode}`, "success");
    }
  },

  setGridSettings: (partial) =>
    get().commitDocMutation((d) => {
      d.canvas.grid = { ...d.canvas.grid, ...partial };
    }, false),

  setBaseTerrainAsset: (assetId) => {
    const cleanId = sanitizeTerrainAssetId(assetId);
    get().commitDocMutation((d) => {
      d.canvas.baseTerrainAssetId = cleanId;
      d.canvas.baseTerrainTransparent = false;
    });
    set((s) => ({
      recentTerrainAssetIds: pushRecentTerrain(s.recentTerrainAssetIds, cleanId),
    }));
  },

  setBaseTerrainTransparent: (transparent) => {
    get().commitDocMutation((d) => {
      d.canvas.baseTerrainTransparent = transparent;
    });
  },

  setLightingSettings: (partial) =>
    get().commitDocMutation((d) => {
      d.lighting = { ...d.lighting, ...partial };
    }, false),

  applyLightingPreset: (presetId) =>
    get().commitDocMutation((d) => {
      const p = d.lighting.presets.find((x) => x.id === presetId);
      if (!p) return;
      d.lighting.activePresetId = p.id;
      d.lighting.ambientColorHex = p.ambientColorHex;
      d.lighting.ambientIntensity = p.ambientIntensity;
    }),

  addTerrainStroke: (stroke, opts) => {
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "terrain");
      let prev = layer.terrainStrokes ?? [];
      if (
        opts?.pruneContained &&
        !stroke.erase &&
        stroke.shape === "polygon" &&
        stroke.points.length >= 3
      ) {
        prev = prev.filter(
          (existing) =>
            !isTerrainStrokeCoveredByFlood(existing, stroke.points, stroke.holes ?? []),
        );
      }
      layer.terrainStrokes = [...prev, stroke];
    });
    if (!stroke.erase && stroke.assetId) {
      set((s) => ({
        recentTerrainAssetIds: pushRecentTerrain(s.recentTerrainAssetIds, stroke.assetId),
      }));
    }
  },

  replaceTerrainStroke: (layerId, strokeId, nextAssetId, applyStyle = false) => {
    const st = get();
    const cleanId = sanitizeTerrainAssetId(nextAssetId);
    let updated = false;
    st.commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId && l.kind === "terrain" && !l.locked);
      if (!layer?.terrainStrokes) return;
      layer.terrainStrokes = layer.terrainStrokes.map((s) => {
        if (s.id !== strokeId || s.erase) return s;
        updated = true;
        return {
          ...s,
          assetId: cleanId,
          ...(applyStyle
            ? {
                opacity: st.brushOpacity,
                softness: s.shape === "polygon" ? st.terrainFillSoftness : st.brushSoftness,
                rotationDeg: st.terrainRotationDeg || undefined,
                slopeShade: st.terrainSlopeShade > 0.02 ? st.terrainSlopeShade : undefined,
                textureScale:
                  Math.abs(st.terrainTextureScale - 1) > 0.01 ? st.terrainTextureScale : undefined,
                recolor: st.toolRecolors.terrain.enabled ? { ...st.toolRecolors.terrain } : undefined,
              }
            : {}),
        };
      });
    });
    if (updated) {
      set((s) => ({
        recentTerrainAssetIds: pushRecentTerrain(s.recentTerrainAssetIds, cleanId),
      }));
    }
    return updated;
  },

  replaceTerrainMaterial: (sourceAssetId, targetAssetId, scope, applyStyle = false, explicitLayerId) => {
    const st = get();
    const cleanTarget = sanitizeTerrainAssetId(targetAssetId);
    let count = 0;
    st.commitDocMutation((d) => {
      const activeLevel = d.levels.find((lv) => lv.id === d.activeLevelId);
      const targetLayer =
        scope === "layer"
          ? explicitLayerId
            ? d.layers.find((l) => l.id === explicitLayerId && l.kind === "terrain" && !l.locked)
            : findPreferredLayerForKind(d, "terrain")
          : null;

      for (const layer of d.layers) {
        if (layer.kind !== "terrain" || layer.locked) continue;
        if (scope === "layer" && (!targetLayer || layer.id !== targetLayer.id)) continue;
        if (scope === "floor" && layer.levelId !== d.activeLevelId) continue;
        if (!layer.terrainStrokes?.length) continue;
        layer.terrainStrokes = layer.terrainStrokes.map((s) => {
          if (s.erase || s.assetId !== sourceAssetId) return s;
          count++;
          return {
            ...s,
            assetId: cleanTarget,
            ...(applyStyle
              ? {
                  opacity: st.brushOpacity,
                  softness: s.shape === "polygon" ? st.terrainFillSoftness : st.brushSoftness,
                  rotationDeg: st.terrainRotationDeg || undefined,
                  slopeShade: st.terrainSlopeShade > 0.02 ? st.terrainSlopeShade : undefined,
                  textureScale:
                    Math.abs(st.terrainTextureScale - 1) > 0.01 ? st.terrainTextureScale : undefined,
                  recolor: st.toolRecolors.terrain.enabled ? { ...st.toolRecolors.terrain } : undefined,
                }
              : {}),
          };
        });
      }

      const includeBase =
        scope === "map" ||
        (scope === "floor" && (!activeLevel || activeLevel.kind === "ground"));
      if (includeBase && !d.canvas.baseTerrainTransparent && d.canvas.baseTerrainAssetId === sourceAssetId) {
        d.canvas.baseTerrainAssetId = cleanTarget;
        count++;
      }
    });
    if (count > 0) {
      set((s) => ({
        recentTerrainAssetIds: pushRecentTerrain(s.recentTerrainAssetIds, cleanTarget),
      }));
    }
    return count;
  },

  replaceAllTerrainOnScope: (targetAssetId, scope, applyStyle = false, explicitLayerId) => {
    const st = get();
    const cleanTarget = sanitizeTerrainAssetId(targetAssetId);
    let count = 0;
    st.commitDocMutation((d) => {
      const activeLevel = d.levels.find((lv) => lv.id === d.activeLevelId);
      const targetLayer =
        scope === "layer"
          ? explicitLayerId
            ? d.layers.find((l) => l.id === explicitLayerId && l.kind === "terrain" && !l.locked)
            : findPreferredLayerForKind(d, "terrain")
          : null;

      for (const layer of d.layers) {
        if (layer.kind !== "terrain" || layer.locked) continue;
        if (scope === "layer" && (!targetLayer || layer.id !== targetLayer.id)) continue;
        if (scope === "floor" && layer.levelId !== d.activeLevelId) continue;
        if (!layer.terrainStrokes?.length) continue;
        layer.terrainStrokes = layer.terrainStrokes.map((s) => {
          if (s.erase) return s;
          count++;
          return {
            ...s,
            assetId: cleanTarget,
            ...(applyStyle
              ? {
                  opacity: st.brushOpacity,
                  softness: s.shape === "polygon" ? st.terrainFillSoftness : st.brushSoftness,
                  rotationDeg: st.terrainRotationDeg || undefined,
                  slopeShade: st.terrainSlopeShade > 0.02 ? st.terrainSlopeShade : undefined,
                  textureScale:
                    Math.abs(st.terrainTextureScale - 1) > 0.01 ? st.terrainTextureScale : undefined,
                  recolor: st.toolRecolors.terrain.enabled ? { ...st.toolRecolors.terrain } : undefined,
                }
              : {}),
          };
        });
      }

      if (scope === "floor" && (!activeLevel || activeLevel.kind === "ground") && !d.canvas.baseTerrainTransparent) {
        d.canvas.baseTerrainAssetId = cleanTarget;
        count++;
      }
    });
    if (count > 0) {
      set((s) => ({
        recentTerrainAssetIds: pushRecentTerrain(s.recentTerrainAssetIds, cleanTarget),
      }));
    }
    return count;
  },

  fillWholeLayerTerrain: (targetAssetId, explicitLayerId) => {
    const st = get();
    const cleanTarget = sanitizeTerrainAssetId(targetAssetId);
    st.commitDocMutation((d) => {
      const layer = explicitLayerId
        ? d.layers.find((l) => l.id === explicitLayerId && l.kind === "terrain" && !l.locked) ??
          findOrEnsureLayer(d, "terrain")
        : findOrEnsureLayer(d, "terrain");
      layer.terrainStrokes = [
        {
          id: `tfill-layer-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          assetId: cleanTarget,
          points: makeRectPolygon(
            { x: 0, y: 0 },
            { x: d.canvas.widthCells, y: d.canvas.heightCells },
          ),
          radiusCells: 0,
          opacity: st.brushOpacity,
          softness: 0,
          shape: "polygon",
          rotationDeg: st.terrainRotationDeg || undefined,
          slopeShade: st.terrainSlopeShade > 0.02 ? st.terrainSlopeShade : undefined,
          textureScale:
            Math.abs(st.terrainTextureScale - 1) > 0.01 ? st.terrainTextureScale : undefined,
          recolor: st.toolRecolors.terrain.enabled ? { ...st.toolRecolors.terrain } : undefined,
        },
      ];
    });
    set((s) => ({
      recentTerrainAssetIds: pushRecentTerrain(s.recentTerrainAssetIds, cleanTarget),
    }));
  },

  deleteTerrainStroke: (layerId, strokeId) => {
    let removed = false;
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId && l.kind === "terrain" && !l.locked);
      if (!layer?.terrainStrokes) return;
      const before = layer.terrainStrokes.length;
      layer.terrainStrokes = layer.terrainStrokes.filter((s) => s.id !== strokeId);
      removed = layer.terrainStrokes.length < before;
    });
    return removed;
  },

  clearTerrainLayer: (layerId) => {
    let cleared = 0;
    get().commitDocMutation((d) => {
      const target = layerId
        ? d.layers.find((l) => l.id === layerId && l.kind === "terrain" && !l.locked)
        : findPreferredLayerForKind(d, "terrain");
      if (!target || target.locked || !target.terrainStrokes?.length) return;
      cleared = target.terrainStrokes.length;
      target.terrainStrokes = [];
    });
    return cleared;
  },

  clearTerrainFloor: (levelId) => {
    let cleared = 0;
    get().commitDocMutation((d) => {
      const targetLvl = levelId ?? d.activeLevelId;
      for (const layer of d.layers) {
        if (layer.kind !== "terrain" || layer.locked || layer.levelId !== targetLvl) continue;
        if (!layer.terrainStrokes?.length) continue;
        cleared += layer.terrainStrokes.length;
        layer.terrainStrokes = [];
      }
    });
    return cleared;
  },

  applyCaveTheme: (themeId) => {
    const p = getCaveThemePreset(themeId);
    set({
      caveThemeId: p.id,
      caveFloorAssetId: p.floorAssetId,
      caveWallAssetId: p.wallAssetId,
      caveWallThicknessCells: p.wallThicknessCells,
      caveOuterRimCells: p.outerRimCells,
      caveRoughness: p.roughness,
      caveUndergroundFill: p.undergroundFill,
      caveDrawMode: p.kind === "dungeon" ? "dungeon_rect" : "cave_brush",
      caveEntranceThreshold: p.kind === "dungeon" ? "stone_arch" : "rock_mouth",
      caveEntranceMarkerLabel: p.kind === "dungeon" ? "DUNGEON ENTRANCE" : "CAVE ENTRANCE",
    });
    const doc = get().getActiveDoc();
    const existing = doc.layers.find(
      (l) => l.kind === "caves" && l.levelId === doc.activeLevelId && !l.locked && l.caveSystem,
    );
    if (existing) {
      get().commitDocMutation((d) => {
        const lyr = d.layers.find((l) => l.id === existing.id);
        if (!lyr?.caveSystem) return;
        lyr.caveSystem = {
          ...lyr.caveSystem,
          themeId: p.id,
          floorAssetId: p.floorAssetId,
          wallAssetId: p.wallAssetId,
          wallThicknessCells: p.wallThicknessCells,
          outerRimCells: p.outerRimCells,
          outerRimColorHex: p.outerRimColorHex,
          roughness: p.roughness,
          undergroundFill: p.undergroundFill,
          undergroundColorHex: p.undergroundColorHex,
        };
      });
    }
  },

  addCaveOperation: (op) => {
    const st = get();
    st.commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "caves");
      if (!layer.caveSystem) {
        const base = createDefaultCaveSystem(st.caveThemeId);
        layer.caveSystem = {
          ...base,
          floorAssetId: st.caveFloorAssetId,
          wallAssetId: st.caveWallAssetId,
          wallThicknessCells: st.caveWallThicknessCells,
          outerRimCells: st.caveOuterRimCells,
          roughness: st.caveRoughness,
          blocksLight: st.caveBlocksLight,
          undergroundFill: st.caveUndergroundFill,
        };
        if (layer.name === "Caves" || layer.name.endsWith(" Caves")) {
          layer.name = "Caves & Dungeons";
        }
      }
      layer.caveSystem = {
        ...layer.caveSystem,
        operations: [...layer.caveSystem.operations, op],
      };
    });
  },

  updateActiveCaveSystem: (partial, recordHistory = true) => {
    const st = get();
    set({
      ...(partial.floorAssetId !== undefined ? { caveFloorAssetId: partial.floorAssetId } : {}),
      ...(partial.wallAssetId !== undefined ? { caveWallAssetId: partial.wallAssetId } : {}),
      ...(partial.wallThicknessCells !== undefined
        ? { caveWallThicknessCells: partial.wallThicknessCells }
        : {}),
      ...(partial.outerRimCells !== undefined ? { caveOuterRimCells: partial.outerRimCells } : {}),
      ...(partial.roughness !== undefined ? { caveRoughness: partial.roughness } : {}),
      ...(partial.blocksLight !== undefined ? { caveBlocksLight: partial.blocksLight } : {}),
      ...(partial.undergroundFill !== undefined
        ? { caveUndergroundFill: partial.undergroundFill }
        : {}),
      ...(partial.themeId !== undefined ? { caveThemeId: partial.themeId } : {}),
    });
    const doc = st.getActiveDoc();
    const existing = doc.layers.find(
      (l) => l.kind === "caves" && l.levelId === doc.activeLevelId && !l.locked && l.caveSystem,
    );
    const needsEnsure =
      !existing &&
      (partial.floorRecolor !== undefined ||
        partial.wallRecolor !== undefined ||
        partial.undergroundColorHex !== undefined ||
        partial.outerRimColorHex !== undefined ||
        partial.undergroundFill === true);
    if (!existing && !needsEnsure) return;
    st.commitDocMutation((d) => {
      const lyr = existing
        ? d.layers.find((l) => l.id === existing.id)
        : findOrEnsureLayer(d, "caves");
      if (!lyr) return;
      if (!lyr.caveSystem) {
        const base = createDefaultCaveSystem(st.caveThemeId);
        lyr.caveSystem = {
          ...base,
          floorAssetId: st.caveFloorAssetId,
          wallAssetId: st.caveWallAssetId,
          wallThicknessCells: st.caveWallThicknessCells,
          outerRimCells: st.caveOuterRimCells,
          roughness: st.caveRoughness,
          blocksLight: st.caveBlocksLight,
          undergroundFill: st.caveUndergroundFill,
        };
        if (lyr.name === "Caves" || lyr.name.endsWith(" Caves")) {
          lyr.name = "Caves & Dungeons";
        }
      }
      lyr.caveSystem = { ...lyr.caveSystem, ...partial };
    }, recordHistory);
  },

  addCaveEntrance: (entrance) => {
    let targetLayerId = "";
    const st = get();
    st.commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "caves");
      if (!layer.caveSystem) return;
      targetLayerId = layer.id;
      layer.caveSystem = {
        ...layer.caveSystem,
        entrances: [...layer.caveSystem.entrances, entrance],
      };
    });
    if (targetLayerId) {
      set({ selection: { kind: "cave_entrance", layerId: targetLayerId, id: entrance.id } });
    }
  },

  updateCaveEntrance: (layerId, entranceId, partial, recordHistory = false) =>
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      if (!layer?.caveSystem) return;
      layer.caveSystem = {
        ...layer.caveSystem,
        entrances: layer.caveSystem.entrances.map((e) =>
          e.id === entranceId ? { ...e, ...partial } : e,
        ),
      };
    }, recordHistory),

  clearCaveLayer: () => {
    const st = get();
    const doc = st.getActiveDoc();
    const existing = doc.layers.find(
      (l) => l.kind === "caves" && l.levelId === doc.activeLevelId && !l.locked && l.caveSystem,
    );
    if (!existing) return;
    st.commitDocMutation((d) => {
      const lyr = d.layers.find((l) => l.id === existing.id);
      if (!lyr?.caveSystem) return;
      lyr.caveSystem = { ...lyr.caveSystem, operations: [], entrances: [] };
    });
    set({ selection: null });
    st.pushToast("Cleared Cave & Dungeon layer (Ctrl+Z to undo)");
  },

  bakeCaveToWallsAndTerrain: () => {
    const st = get();
    const doc = st.getActiveDoc();
    const caveLyr = doc.layers.find(
      (l) =>
        l.kind === "caves" &&
        l.levelId === doc.activeLevelId &&
        !l.locked &&
        l.caveSystem &&
        l.caveSystem.operations.length > 0,
    );
    if (!caveLyr?.caveSystem) return false;

    const geom = computeCaveGeometry(
      caveLyr.caveSystem,
      doc.canvas.widthCells,
      doc.canvas.heightCells,
      caveLyr.id,
    );
    if (geom.floorLoops.length === 0 && geom.wallSegments.length === 0) return false;

    const now = Date.now();
    st.commitDocMutation((d) => {
      const terrainLyr = findOrEnsureLayer(d, "terrain");
      const wallLyr = findOrEnsureLayer(d, "walls");
      const srcLyr = d.layers.find((l) => l.id === caveLyr.id);
      if (!srcLyr?.caveSystem) return;

      // Bake outer floor loops as standard TerrainStroke polygons
      const bakedStrokes: TerrainStroke[] = geom.floorLoops.map((loop, idx) => ({
        id: `tbake-${now}-${idx}`,
        assetId: srcLyr.caveSystem!.floorAssetId,
        points: loop.map((pt) => ({ ...pt })),
        radiusCells: 0,
        opacity: 1,
        softness: 0.04,
        shape: "polygon",
        recolor: srcLyr.caveSystem!.floorRecolor?.enabled
          ? { ...srcLyr.caveSystem!.floorRecolor }
          : undefined,
      }));
      terrainLyr.terrainStrokes = [...(terrainLyr.terrainStrokes ?? []), ...bakedStrokes];

      // Bake derived wall ribbons as editable WallSegments
      const bakedWalls: WallSegment[] = geom.wallSegments.map((w, idx) => ({
        ...w,
        id: `wbake-${now}-${idx}`,
        points: w.points.map((pt) => ({ ...pt })),
      }));
      wallLyr.walls = [...(wallLyr.walls ?? []), ...bakedWalls];

      // Clear procedural cave ops so nothing is double-rendered (full 1-step Undo restores!)
      srcLyr.caveSystem = {
        ...srcLyr.caveSystem,
        operations: [],
        entrances: [],
      };
    });
    set({ selection: null });
    st.pushToast(
      `Baked ${geom.wallSegments.length} editable wall(s) & ${geom.floorLoops.length} floor polygon(s)`,
      "success",
    );
    return true;
  },

  fillWallInterior: (layerId, wallId, terrainAssetIdOverride) => {
    const st = get();
    const doc = st.getActiveDoc();
    const wallLayer = doc.layers.find((l) => l.id === layerId);
    const wall = wallLayer?.walls?.find((w) => w.id === wallId);
    if (!wall || wall.points.length < 3) return false;
    const poly = makeClosedWallPolygon(wall);
    if (poly.length < 3) return false;
    const terrainAsset = sanitizeTerrainAssetId(
      terrainAssetIdOverride || st.activeTerrainAssetId || "terrain/herringbone_parquet.png",
    );
    st.commitDocMutation((d) => {
      const prevLevel = d.activeLevelId;
      if (wallLayer?.levelId) d.activeLevelId = wallLayer.levelId;
      const tLayer = findOrEnsureLayer(d, "terrain");
      d.activeLevelId = prevLevel;
      const nextStroke: TerrainStroke = {
        id: `tfill-wall-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        assetId: terrainAsset,
        points: poly,
        radiusCells: 0,
        opacity: st.brushOpacity,
        softness: st.terrainFillSoftness,
        shape: "polygon",
        sourceWallId: wall.id,
        rotationDeg: st.terrainRotationDeg || undefined,
        slopeShade: st.terrainSlopeShade > 0.02 ? st.terrainSlopeShade : undefined,
        textureScale:
          Math.abs(st.terrainTextureScale - 1) > 0.01 ? st.terrainTextureScale : undefined,
        recolor: st.toolRecolors.terrain.enabled ? { ...st.toolRecolors.terrain } : undefined,
      };
      const existingIdx = (tLayer.terrainStrokes ?? []).findIndex(
        (s) => s.sourceWallId === wall.id && !s.erase,
      );
      if (existingIdx >= 0) {
        const copy = [...(tLayer.terrainStrokes ?? [])];
        copy[existingIdx] = nextStroke;
        tLayer.terrainStrokes = copy;
      } else {
        // Also prune any stale non-linked strokes completely buried inside this room
        const pruned = (tLayer.terrainStrokes ?? []).filter(
          (s) => !isTerrainStrokeCoveredByFlood(s, poly, []),
        );
        tLayer.terrainStrokes = [...pruned, nextStroke];
      }
    });
    set((s) => ({
      activeTerrainAssetId: terrainAsset,
      recentTerrainAssetIds: pushRecentTerrain(s.recentTerrainAssetIds, terrainAsset),
    }));
    return true;
  },

  addWaterRegion: (region, selectAfter = false) => {
    let targetLayerId = "";
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "water");
      targetLayerId = layer.id;
      layer.waterRegions = [...(layer.waterRegions ?? []), region];
    });
    set({
      selection: selectAfter
        ? { kind: "water", layerId: targetLayerId, id: region.id }
        : null,
    });
  },

  ensureActiveWaterLayer: () => {
    const doc = get().getActiveDoc();
    const existing = findPreferredLayerForKind(doc, "water");
    if (existing) return existing.id;
    let createdId = "";
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "water");
      createdId = layer.id;
    }, false);
    return createdId;
  },

  applyLiveWaterRegions: (updates, activeWaterLayerId) => {
    if (updates.size === 0) return;
    get().commitDocMutation((d) => {
      for (const [layerId, nextRegions] of updates.entries()) {
        const lyr = d.layers.find((l) => l.id === layerId);
        if (lyr) lyr.waterRegions = nextRegions;
      }
      if (activeWaterLayerId) {
        d.activeLayerId = activeWaterLayerId;
      }
    }, false);
  },

  updateLayerWaterSettings: (layerId, partial, recordHistory = false) =>
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      if (!layer) return;
      if (partial.waterMeshEnabled !== undefined) {
        layer.waterMeshEnabled = partial.waterMeshEnabled;
      }
      if (partial.waterBlendRadiusCells !== undefined) {
        layer.waterBlendRadiusCells = Math.max(
          0,
          Math.min(3, partial.waterBlendRadiusCells),
        );
      }
    }, recordHistory),

  paintWaterBrush: (strokePoints) => {
    if (strokePoints.length === 0) return;
    const st = get();
    const seed = Math.floor(Math.random() * 99999);
    const radius = st.waterBrushRadiusCells;
    const roughness = st.waterOrganicRoughness;
    let mergedIntoExisting = false;

    st.commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "water");
      const regions = layer.waterRegions ?? [];
      const paintIsSolid = st.waterOpacity >= 0.75;
      const isSameStyle = (reg: WaterRegion) =>
        reg.kind === st.waterKind &&
        (reg.opacity >= 0.75) === paintIsSolid &&
        (reg.presetId
          ? reg.presetId === st.waterPresetId
          : reg.deepColorHex.toLowerCase() === st.waterDeepColorHex.toLowerCase());

      const matching = regions.filter(
        (reg) => isSameStyle(reg) && brushStrokeOverlapsWaterRegion(reg, strokePoints, radius),
      );

      const sculpted =
        matching.length > 0
          ? unionWaterRegionsWithBrush(
              matching,
              strokePoints,
              radius,
              roughness,
              seed,
              d.canvas.widthCells,
              d.canvas.heightCells,
            )
          : buildWaterBrushShape(
              strokePoints,
              radius,
              roughness,
              seed,
              d.canvas.widthCells,
              d.canvas.heightCells,
            );
      if (sculpted.length === 0) return;

      const stamp = Date.now();
      const baseReg = matching[0] ?? null;
      const matchIds = new Set(matching.map((m) => m.id));
      const firstIdx = baseReg ? regions.findIndex((r) => r.id === baseReg.id) : -1;
      const shouldCarveOther =
        layer.waterMeshEnabled !== false && st.waterKind !== "chasm" && paintIsSolid;

      const paintedRegions: WaterRegion[] = baseReg
        ? sculpted.map((shape, idx) => ({
            ...baseReg,
            id: idx === 0 ? baseReg.id : `${baseReg.id}-part-${stamp}-${idx}`,
            shape: "polygon",
            curved: true,
            organicRoughness: 0,
            points: shape.points,
            cutouts: shape.cutouts.length > 0 ? shape.cutouts : undefined,
          }))
        : sculpted.map((shape, idx) => ({
            id: idx === 0 ? `water-br-${stamp}` : `water-br-${stamp}-${idx}`,
            kind: st.waterKind,
            presetId: st.waterPresetId,
            shape: "polygon",
            curved: true,
            textureAssetId: st.waterTextureAssetId,
            points: shape.points,
            cutouts: shape.cutouts.length > 0 ? shape.cutouts : undefined,
            deepColorHex: st.waterDeepColorHex,
            shallowColorHex: st.waterShallowColorHex,
            rimColorHex: st.waterRimColorHex,
            opacity: st.waterOpacity,
            rippleIntensity: st.waterRippleIntensity,
            causticsIntensity: st.waterCausticsIntensity,
            depthFeather: st.waterDepthFeather,
            shoreBankIntensity: st.waterShoreBankIntensity,
            organicRoughness: 0,
            seed,
          }));

      if (baseReg) mergedIntoExisting = true;

      const nextRegions: WaterRegion[] = [];
      for (let i = 0; i < regions.length; i++) {
        const cur = regions[i];
        if (matchIds.has(cur.id)) {
          if (i === firstIdx) nextRegions.push(...paintedRegions);
          continue;
        }
        if (
          shouldCarveOther &&
          cur.kind !== "chasm" &&
          brushStrokeOverlapsWaterRegion(cur, strokePoints, radius)
        ) {
          const sub = subtractBrushFromWaterRegion(
            cur,
            strokePoints,
            radius,
            roughness,
            seed,
            d.canvas.widthCells,
            d.canvas.heightCells,
          );
          if (sub.changed) {
            sub.shapes.forEach((shape, idx) => {
              nextRegions.push({
                ...cur,
                id: idx === 0 ? cur.id : `${cur.id}-split-${stamp}-${idx}`,
                shape: "polygon",
                curved: true,
                organicRoughness: 0,
                points: shape.points,
                cutouts: shape.cutouts.length > 0 ? shape.cutouts : undefined,
              });
            });
            continue;
          }
        }
        nextRegions.push(cur);
      }

      if (!baseReg) nextRegions.push(...paintedRegions);
      layer.waterRegions = nextRegions;
    });
    set({ selection: null });
    if (mergedIntoExisting) {
      st.pushToast("Merged brush stroke smoothly into water body", "success");
    } else {
      st.pushToast("Painted organic water body", "success");
    }
  },

  eraseWaterBrush: (strokePoints) => {
    if (strokePoints.length === 0) return false;
    const st = get();
    const doc = st.getActiveDoc();
    const seed = Math.floor(Math.random() * 99999);
    const radius = st.waterBrushRadiusCells;
    const roughness = st.waterOrganicRoughness;

    const waterLayers = doc.layers.filter(
      (l) => l.kind === "water" && l.visible && !l.locked && l.levelId === doc.activeLevelId,
    );

    const layerUpdates = new Map<string, WaterRegion[]>();
    let modifiedCount = 0;
    let updatedCount = 0;
    let removedCount = 0;
    let lastModifiedLayerId = "";

    for (const layer of waterLayers) {
      const existing = layer.waterRegions ?? [];
      let layerChanged = false;
      const nextRegions: WaterRegion[] = [];
      const stamp = Date.now();

      for (const reg of existing) {
        if (!brushStrokeOverlapsWaterRegion(reg, strokePoints, radius)) {
          nextRegions.push(reg);
          continue;
        }
        const sub = subtractBrushFromWaterRegion(
          reg,
          strokePoints,
          radius,
          roughness,
          seed,
          doc.canvas.widthCells,
          doc.canvas.heightCells,
        );
        if (!sub.changed) {
          nextRegions.push(reg);
          continue;
        }
        layerChanged = true;
        modifiedCount++;
        lastModifiedLayerId = layer.id;
        if (sub.shapes.length === 0) {
          removedCount++;
        } else {
          updatedCount++;
          sub.shapes.forEach((shape, idx) => {
            nextRegions.push({
              ...reg,
              id: idx === 0 ? reg.id : `${reg.id}-split-${stamp}-${idx}`,
              shape: "polygon",
              curved: true,
              organicRoughness: 0,
              points: shape.points,
              cutouts: shape.cutouts.length > 0 ? shape.cutouts : undefined,
            });
          });
        }
      }

      if (layerChanged) {
        layerUpdates.set(layer.id, nextRegions);
      }
    }

    if (modifiedCount === 0) {
      st.pushToast("Drag across existing water to carve an island or trim coastline", "info");
      return false;
    }

    st.commitDocMutation((d) => {
      for (const [layerId, nextRegions] of layerUpdates.entries()) {
        const lyr = d.layers.find((l) => l.id === layerId);
        if (lyr) lyr.waterRegions = nextRegions;
      }
      if (lastModifiedLayerId) {
        d.activeLayerId = lastModifiedLayerId;
      }
    });
    set({ selection: null });
    st.pushToast(
      removedCount > 0 && updatedCount === 0
        ? "Erased water body cleanly"
        : "Carved dry island / reshaped shoreline",
      "success",
    );
    return true;
  },

  updateWaterRegion: (layerId, regionId, partial, recordHistory = false) =>
    get().patchActiveDoc((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      const existing = layer?.waterRegions?.find((w) => w.id === regionId);
      if (!existing) return null;
      const merged: Partial<WaterRegion> = { ...partial };
      if (partial.curved !== undefined && partial.segmentCurves === undefined) {
        merged.segmentCurves = undefined;
      } else if (
        (partial.points !== undefined || partial.shape !== undefined) &&
        partial.segmentCurves === undefined &&
        existing.segmentCurves
      ) {
        const nextPtsLen = (partial.points ?? existing.points).length;
        const nextClosed = (partial.shape ?? existing.shape) !== "river";
        merged.segmentCurves = normalizeWallSegmentCurves(nextPtsLen, nextClosed, existing.segmentCurves);
      }
      return patchLayerItemInDoc(d, layerId, "waterRegions", regionId, merged);
    }, recordHistory),

  applyWaterPreset: (presetId) => {
    const preset = getWaterPreset(presetId);
    set({
      waterPresetId: preset.id,
      waterKind: preset.kind,
      waterTextureAssetId: preset.textureAssetId,
      waterDeepColorHex: preset.deepColorHex,
      waterShallowColorHex: preset.shallowColorHex,
      waterRimColorHex: preset.rimColorHex,
      waterOpacity: preset.opacity,
      waterRippleIntensity: preset.rippleIntensity,
      waterCausticsIntensity: preset.causticsIntensity,
      waterDepthFeather: preset.depthFeather,
      waterShoreBankIntensity: preset.shoreBankIntensity,
      waterOrganicRoughness: preset.organicRoughness,
    });
    const sel = get().selection;
    if (sel?.kind === "water") {
      get().updateWaterRegion(
        sel.layerId,
        sel.id,
        {
          presetId: preset.id,
          kind: preset.kind,
          textureAssetId: preset.textureAssetId,
          deepColorHex: preset.deepColorHex,
          shallowColorHex: preset.shallowColorHex,
          rimColorHex: preset.rimColorHex,
          opacity: preset.opacity,
          rippleIntensity: preset.rippleIntensity,
          causticsIntensity: preset.causticsIntensity,
          depthFeather: preset.depthFeather,
          shoreBankIntensity: preset.shoreBankIntensity,
          organicRoughness: preset.organicRoughness,
        },
        true,
      );
      get().pushToast(`Applied ${preset.name} to selected water body`, "success");
    } else {
      get().pushToast(`Water Biome: ${preset.name}`, "info");
    }
  },

  carveWaterIsland: (cutoutPolygon) => {
    if (cutoutPolygon.length < 3) return false;
    // Compute centroid & sample points to find overlapping water regions on active floor
    let cx = 0;
    let cy = 0;
    for (const p of cutoutPolygon) {
      cx += p.x;
      cy += p.y;
    }
    cx /= cutoutPolygon.length;
    cy /= cutoutPolygon.length;
    const probePts = [{ x: cx, y: cy }, cutoutPolygon[0], cutoutPolygon[Math.floor(cutoutPolygon.length / 2)]];

    let carvedCount = 0;
    get().commitDocMutation((d) => {
      const waterLayers = d.layers.filter(
        (l) => l.kind === "water" && l.visible && !l.locked && l.levelId === d.activeLevelId,
      );
      for (const layer of waterLayers) {
        for (const reg of layer.waterRegions ?? []) {
          if (probePts.some((pt) => pointInWaterRegion(pt, reg))) {
            reg.cutouts = [...(reg.cutouts ?? []), cutoutPolygon];
            carvedCount++;
          }
        }
      }
    });
    if (carvedCount > 0) {
      get().pushToast(`Carved dry island / sandbar out of ${carvedCount} water body${carvedCount > 1 ? "ies" : ""}`, "success");
      return true;
    }
    get().pushToast("Drag across existing water to carve an island or sandbar", "info");
    return false;
  },

  clearWaterCutouts: (layerId, regionId) =>
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      const reg = layer?.waterRegions?.find((x) => x.id === regionId);
      if (reg) reg.cutouts = [];
    }),

  addWall: (wall) => {
    let targetLayerId = "";
    const st = get();
    const shouldAutoFill = st.wallAutoFillClosed && wall.closed && wall.points.length >= 3;
    const fillPoly = shouldAutoFill ? makeClosedWallPolygon(wall) : [];
    st.commitDocMutation((d) => {
      if (shouldAutoFill && fillPoly.length >= 3) {
        const tLayer = findOrEnsureLayer(d, "terrain");
        tLayer.terrainStrokes = [
          ...(tLayer.terrainStrokes ?? []),
          {
            id: `tfill-auto-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            assetId: sanitizeTerrainAssetId(st.activeTerrainAssetId || "terrain/herringbone_parquet.png"),
            points: fillPoly,
            radiusCells: 0,
            opacity: st.brushOpacity,
            softness: st.terrainFillSoftness,
            shape: "polygon",
            sourceWallId: wall.id,
            rotationDeg: st.terrainRotationDeg || undefined,
            slopeShade: st.terrainSlopeShade > 0.02 ? st.terrainSlopeShade : undefined,
            textureScale:
              Math.abs(st.terrainTextureScale - 1) > 0.01 ? st.terrainTextureScale : undefined,
            recolor: st.toolRecolors.terrain.enabled ? { ...st.toolRecolors.terrain } : undefined,
          },
        ];
      }
      const layer = findOrEnsureLayer(d, "walls");
      targetLayerId = layer.id;
      layer.walls = [...(layer.walls ?? []), wall];
    });
    set((s) => ({
      // Keep Wall Tool & Style dock active while rapidly building multiple rooms/walls; select cleanly in Select mode!
      selection:
        s.activeTool !== "wall"
          ? { kind: "wall", layerId: targetLayerId, id: wall.id }
          : null,
      selectedWallSegmentIndex: null,
      ...(shouldAutoFill && fillPoly.length >= 3
        ? {
            recentTerrainAssetIds: pushRecentTerrain(
              s.recentTerrainAssetIds,
              st.activeTerrainAssetId || "terrain/herringbone_parquet.png",
            ),
          }
        : {}),
    }));
  },

  addWallsBatch: (walls, autoFloorPolygon) => {
    if (walls.length === 0) return;
    let targetLayerId = "";
    const st = get();
    const shouldAutoFill =
      st.wallAutoFillClosed && Boolean(autoFloorPolygon && autoFloorPolygon.length >= 3);
    st.commitDocMutation((d) => {
      if (shouldAutoFill && autoFloorPolygon && autoFloorPolygon.length >= 3) {
        const tLayer = findOrEnsureLayer(d, "terrain");
        tLayer.terrainStrokes = [
          ...(tLayer.terrainStrokes ?? []),
          {
            id: `tfill-corridor-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            assetId: sanitizeTerrainAssetId(st.activeTerrainAssetId || "terrain/herringbone_parquet.png"),
            points: autoFloorPolygon.map((p) => ({ ...p })),
            radiusCells: 0,
            opacity: st.brushOpacity,
            softness: st.terrainFillSoftness,
            shape: "polygon",
            recolor: st.toolRecolors.terrain.enabled ? { ...st.toolRecolors.terrain } : undefined,
          },
        ];
      }
      const layer = findOrEnsureLayer(d, "walls");
      targetLayerId = layer.id;
      layer.walls = [...(layer.walls ?? []), ...walls];
    });
    const lastWall = walls[walls.length - 1];
    set((s) => ({
      selection:
        s.activeTool !== "wall"
          ? { kind: "wall", layerId: targetLayerId, id: lastWall.id }
          : null,
      selectedWallSegmentIndex: null,
      ...(shouldAutoFill
        ? {
            recentTerrainAssetIds: pushRecentTerrain(
              s.recentTerrainAssetIds,
              st.activeTerrainAssetId || "terrain/herringbone_parquet.png",
            ),
          }
        : {}),
    }));
  },

  updateWall: (layerId, wallId, partial, recordHistory = false) =>
    get().patchActiveDoc((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      const existing = layer?.walls?.find((w) => w.id === wallId);
      if (!existing) return null;
      const mergedPartial: Partial<WallSegment> = { ...partial };
      if (partial.curved === false && partial.segmentCurves === undefined) {
        mergedPartial.segmentCurves = undefined;
      } else if (
        (partial.closed !== undefined || partial.points !== undefined) &&
        partial.segmentCurves === undefined &&
        existing.segmentCurves
      ) {
        const nextPtsLen = (partial.points ?? existing.points).length;
        const nextClosed = partial.closed ?? existing.closed;
        mergedPartial.segmentCurves = normalizeWallSegmentCurves(
          nextPtsLen,
          nextClosed,
          existing.segmentCurves,
        );
      }
      const nextDoc = patchLayerItemInDoc(d, layerId, "walls", wallId, mergedPartial);
      if (!nextDoc) return null;
      if (
        partial.points !== undefined ||
        partial.closed !== undefined ||
        partial.curved !== undefined ||
        partial.segmentCurves !== undefined
      ) {
        const updatedWall = nextDoc.layers
          .find((l) => l.id === layerId)
          ?.walls?.find((w) => w.id === wallId);
        if (updatedWall) {
          return syncLinkedWallFloorFills(nextDoc, wallId, updatedWall);
        }
      }
      return nextDoc;
    }, recordHistory),

  setWallSegmentCurve: (layerId, wallId, segIdx, sagitta, recordHistory = true) =>
    get().setEntitySegmentCurve(
      { kind: "wall", layerId, id: wallId },
      segIdx,
      sagitta,
      recordHistory,
    ),

  toggleWallSegmentCurve: (layerId, wallId, segIdx, preset = "90") =>
    get().toggleEntitySegmentCurve({ kind: "wall", layerId, id: wallId }, segIdx, preset),

  flipWallSegmentCurve: (layerId, wallId, segIdx) =>
    get().flipEntitySegmentCurve({ kind: "wall", layerId, id: wallId }, segIdx),

  setEntitySegmentCurve: (sel, segIdx, sagitta, recordHistory = true) => {
    get().patchActiveDoc((d) => {
      let shape:
        | { points: Point2D[]; closed: boolean; curved: boolean; segmentCurves?: Array<number | null> }
        | null = null;
      if (sel.kind === "wall") {
        const w = d.layers.find((l) => l.id === sel.layerId)?.walls?.find((x) => x.id === sel.id);
        if (w) shape = { points: w.points, closed: w.closed, curved: w.curved, segmentCurves: w.segmentCurves };
      } else if (sel.kind === "path") {
        const p = d.layers.find((l) => l.id === sel.layerId)?.paths?.find((x) => x.id === sel.id);
        if (p) shape = { points: p.points, closed: false, curved: p.curved !== false, segmentCurves: p.segmentCurves };
      } else if (sel.kind === "roof") {
        const rf = d.layers.find((l) => l.id === sel.layerId)?.roofs?.find((x) => x.id === sel.id);
        if (rf && rf.style !== "cone") {
          shape = { points: rf.points, closed: false, curved: Boolean(rf.curved), segmentCurves: rf.segmentCurves };
        }
      } else if (sel.kind === "water") {
        const wr = d.layers.find((l) => l.id === sel.layerId)?.waterRegions?.find((x) => x.id === sel.id);
        if (wr) {
          shape = {
            points: wr.points,
            closed: wr.shape !== "river",
            curved: wr.curved ?? wr.kind !== "chasm",
            segmentCurves: wr.segmentCurves,
          };
        }
      } else if (sel.kind === "world_river" && d.world) {
        const rv = d.world.rivers.find((x) => x.id === sel.id);
        if (rv) shape = { points: rv.points, closed: false, curved: rv.curved, segmentCurves: rv.segmentCurves };
      } else if (sel.kind === "world_trail" && d.world) {
        const tr = d.world.trails.find((x) => x.id === sel.id);
        if (tr) shape = { points: tr.points, closed: false, curved: tr.curved, segmentCurves: tr.segmentCurves };
      } else if (sel.kind === "world_region" && d.world) {
        const reg = d.world.regions.find((x) => x.id === sel.id);
        if (reg) shape = { points: reg.polygon, closed: true, curved: reg.curved, segmentCurves: reg.segmentCurves };
      }
      if (!shape) return null;
      const segCount = getWallSegmentCount(shape.points, shape.closed);
      if (segIdx < 0 || segIdx >= segCount) return null;
      const baseCurves = convertLegacyWallCurveToSegments(shape);
      baseCurves[segIdx] =
        typeof sagitta === "number" && Number.isFinite(sagitta) && Math.abs(sagitta) >= 0.04
          ? Math.round(sagitta * 1000) / 1000
          : null;
      const normalized = normalizeWallSegmentCurves(shape.points.length, shape.closed, baseCurves);
      const patch = { curved: false, segmentCurves: normalized };

      if (sel.kind === "wall") {
        const nextDoc = patchLayerItemInDoc(d, sel.layerId, "walls", sel.id, patch);
        if (!nextDoc) return null;
        const updatedWall = nextDoc.layers
          .find((l) => l.id === sel.layerId)
          ?.walls?.find((w) => w.id === sel.id);
        return updatedWall ? syncLinkedWallFloorFills(nextDoc, sel.id, updatedWall) : nextDoc;
      }
      if (sel.kind === "path") return patchLayerItemInDoc(d, sel.layerId, "paths", sel.id, patch);
      if (sel.kind === "roof") return patchLayerItemInDoc(d, sel.layerId, "roofs", sel.id, patch);
      if (sel.kind === "water") return patchLayerItemInDoc(d, sel.layerId, "waterRegions", sel.id, patch);
      if (sel.kind === "world_river") return patchWorldItemInDoc(d, "rivers", sel.id, patch);
      if (sel.kind === "world_trail") return patchWorldItemInDoc(d, "trails", sel.id, patch);
      if (sel.kind === "world_region") return patchWorldItemInDoc(d, "regions", sel.id, patch);
      return null;
    }, recordHistory);
  },

  toggleEntitySegmentCurve: (sel, segIdx, preset = "90") => {
    const st = get();
    const d = st.getActiveDoc();
    let shape:
      | { points: Point2D[]; closed: boolean; curved: boolean; segmentCurves?: Array<number | null> }
      | null = null;
    if (sel.kind === "wall") {
      const w = d.layers.find((l) => l.id === sel.layerId)?.walls?.find((x) => x.id === sel.id);
      if (w) shape = { points: w.points, closed: w.closed, curved: w.curved, segmentCurves: w.segmentCurves };
    } else if (sel.kind === "path") {
      const p = d.layers.find((l) => l.id === sel.layerId)?.paths?.find((x) => x.id === sel.id);
      if (p) shape = { points: p.points, closed: false, curved: p.curved !== false, segmentCurves: p.segmentCurves };
    } else if (sel.kind === "roof") {
      const rf = d.layers.find((l) => l.id === sel.layerId)?.roofs?.find((x) => x.id === sel.id);
      if (rf && rf.style !== "cone") {
        shape = { points: rf.points, closed: false, curved: Boolean(rf.curved), segmentCurves: rf.segmentCurves };
      }
    } else if (sel.kind === "water") {
      const wr = d.layers.find((l) => l.id === sel.layerId)?.waterRegions?.find((x) => x.id === sel.id);
      if (wr) {
        shape = {
          points: wr.points,
          closed: wr.shape !== "river",
          curved: wr.curved ?? wr.kind !== "chasm",
          segmentCurves: wr.segmentCurves,
        };
      }
    } else if (sel.kind === "world_river" && d.world) {
      const rv = d.world.rivers.find((x) => x.id === sel.id);
      if (rv) shape = { points: rv.points, closed: false, curved: rv.curved, segmentCurves: rv.segmentCurves };
    } else if (sel.kind === "world_trail" && d.world) {
      const tr = d.world.trails.find((x) => x.id === sel.id);
      if (tr) shape = { points: tr.points, closed: false, curved: tr.curved, segmentCurves: tr.segmentCurves };
    } else if (sel.kind === "world_region" && d.world) {
      const reg = d.world.regions.find((x) => x.id === sel.id);
      if (reg) shape = { points: reg.polygon, closed: true, curved: reg.curved, segmentCurves: reg.segmentCurves };
    }
    if (!shape) return false;
    const segCount = getWallSegmentCount(shape.points, shape.closed);
    if (segIdx < 0 || segIdx >= segCount) return false;
    const baseCurves = convertLegacyWallCurveToSegments(shape);
    const curVal = baseCurves[segIdx] ?? 0;
    const isCurrentlyCurved = Math.abs(curVal) >= 0.04;
    const nextSagitta = isCurrentlyCurved
      ? null
      : computeDefaultWallEdgeBulge(shape, segIdx, preset);
    st.setEntitySegmentCurve(sel, segIdx, nextSagitta, true);
    return !isCurrentlyCurved;
  },

  flipEntitySegmentCurve: (sel, segIdx) => {
    const st = get();
    const d = st.getActiveDoc();
    let shape:
      | { points: Point2D[]; closed: boolean; curved: boolean; segmentCurves?: Array<number | null> }
      | null = null;
    if (sel.kind === "wall") {
      const w = d.layers.find((l) => l.id === sel.layerId)?.walls?.find((x) => x.id === sel.id);
      if (w) shape = { points: w.points, closed: w.closed, curved: w.curved, segmentCurves: w.segmentCurves };
    } else if (sel.kind === "path") {
      const p = d.layers.find((l) => l.id === sel.layerId)?.paths?.find((x) => x.id === sel.id);
      if (p) shape = { points: p.points, closed: false, curved: p.curved !== false, segmentCurves: p.segmentCurves };
    } else if (sel.kind === "roof") {
      const rf = d.layers.find((l) => l.id === sel.layerId)?.roofs?.find((x) => x.id === sel.id);
      if (rf && rf.style !== "cone") {
        shape = { points: rf.points, closed: false, curved: Boolean(rf.curved), segmentCurves: rf.segmentCurves };
      }
    } else if (sel.kind === "water") {
      const wr = d.layers.find((l) => l.id === sel.layerId)?.waterRegions?.find((x) => x.id === sel.id);
      if (wr) {
        shape = {
          points: wr.points,
          closed: wr.shape !== "river",
          curved: wr.curved ?? wr.kind !== "chasm",
          segmentCurves: wr.segmentCurves,
        };
      }
    } else if (sel.kind === "world_river" && d.world) {
      const rv = d.world.rivers.find((x) => x.id === sel.id);
      if (rv) shape = { points: rv.points, closed: false, curved: rv.curved, segmentCurves: rv.segmentCurves };
    } else if (sel.kind === "world_trail" && d.world) {
      const tr = d.world.trails.find((x) => x.id === sel.id);
      if (tr) shape = { points: tr.points, closed: false, curved: tr.curved, segmentCurves: tr.segmentCurves };
    } else if (sel.kind === "world_region" && d.world) {
      const reg = d.world.regions.find((x) => x.id === sel.id);
      if (reg) shape = { points: reg.polygon, closed: true, curved: reg.curved, segmentCurves: reg.segmentCurves };
    }
    if (!shape) return;
    const baseCurves = convertLegacyWallCurveToSegments(shape);
    const curVal = baseCurves[segIdx] ?? 0;
    if (Math.abs(curVal) < 0.04) return;
    st.setEntitySegmentCurve(sel, segIdx, -curVal, true);
  },

  flattenEntityCurves: (sel) => {
    const st = get();
    if (sel.kind === "wall") {
      st.updateWall(sel.layerId, sel.id, { curved: false, segmentCurves: undefined }, true);
    } else if (sel.kind === "path") {
      st.updatePath(sel.layerId, sel.id, { curved: false, segmentCurves: undefined }, true);
    } else if (sel.kind === "roof") {
      st.updateRoof(sel.layerId, sel.id, { curved: false, segmentCurves: undefined }, true);
    } else if (sel.kind === "water") {
      st.updateWaterRegion(sel.layerId, sel.id, { curved: false, segmentCurves: undefined }, true);
    } else if (sel.kind === "world_river") {
      st.updateWorldRiver(sel.id, { curved: false, segmentCurves: undefined }, true);
    } else if (sel.kind === "world_trail") {
      st.updateWorldTrail(sel.id, { curved: false, segmentCurves: undefined }, true);
    } else if (sel.kind === "world_region") {
      st.updateWorldRegion(sel.id, { curved: false, segmentCurves: undefined }, true);
    }
  },

  splitWallAt: (layerId, wallId, arcLength) => {
    const st = get();
    const doc = st.getActiveDoc();
    const layer = doc.layers.find((l) => l.id === layerId);
    const target = layer?.walls?.find((w) => w.id === wallId);
    if (!layer || !target) return false;
    const wasClosed = target.closed;
    const stamp = Date.now().toString(36);
    const replacement = splitWallAtArcLength(target, arcLength, `ws-${stamp}`);
    if (
      replacement.length === 1 &&
      replacement[0] === target
    ) {
      return false;
    }
    st.commitDocMutation((d) => {
      const lyr = d.layers.find((l) => l.id === layerId);
      if (!lyr?.walls) return;
      const idx = lyr.walls.findIndex((w) => w.id === wallId);
      if (idx < 0) return;
      lyr.walls.splice(idx, 1, ...replacement);
    });
    set({ selection: null });
    st.pushToast(
      wasClosed
        ? "Opened closed room seam — click another point to split off a wall section"
        : "Split wall cleanly into 2 independent segments",
      "success",
    );
    return true;
  },

  breachWallAt: (layerId, wallId, arcLength, widthCells) => {
    const st = get();
    const doc = st.getActiveDoc();
    const layer = doc.layers.find((l) => l.id === layerId);
    const target = layer?.walls?.find((w) => w.id === wallId);
    if (!layer || !target) return false;
    const w = widthCells ?? st.wallBreachWidthCells;
    const stamp = Date.now().toString(36);
    const replacement = carveWallBreachAtArcLength(target, arcLength, w, `wb-${stamp}`);
    st.commitDocMutation((d) => {
      const lyr = d.layers.find((l) => l.id === layerId);
      if (!lyr?.walls) return;
      const idx = lyr.walls.findIndex((w) => w.id === wallId);
      if (idx < 0) return;
      lyr.walls.splice(idx, 1, ...replacement);
    });
    set({ selection: null });
    st.pushToast(`Carved ${w.toFixed(1)} sq open breach / archway`, "success");
    return true;
  },

  copyWallsFromLevelBelow: () => {
    const st = get();
    const doc = st.getActiveDoc();
    const activeLv = doc.levels.find((lv) => lv.id === doc.activeLevelId);
    if (!activeLv) return 0;
    const refLv = getOnionSkinReferenceLevel(doc);
    if (!refLv) {
      st.pushToast("No adjacent reference floor found to copy walls from", "info");
      return 0;
    }
    const sourceWalls = doc.layers
      .filter((l) => l.levelId === refLv.id && (l.walls?.length ?? 0) > 0)
      .flatMap((l) => l.walls ?? []);
    if (sourceWalls.length === 0) {
      st.pushToast(`No walls found on ${refLv.shortCode} to copy`, "info");
      return 0;
    }

    const existingSigs = new Set(
      doc.layers
        .filter((l) => l.levelId === activeLv.id)
        .flatMap((l) => l.walls ?? [])
        .map((w) =>
          `${w.closed ? "C" : "O"}|${w.points.map((p) => `${Math.round(p.x * 20)},${Math.round(p.y * 20)}`).join(";")}`,
        ),
    );
    const stamp = Date.now().toString(36);
    const cloned: WallSegment[] = [];
    sourceWalls.forEach((w, idx) => {
      const sig = `${w.closed ? "C" : "O"}|${w.points.map((p) => `${Math.round(p.x * 20)},${Math.round(p.y * 20)}`).join(";")}`;
      if (existingSigs.has(sig)) return;
      existingSigs.add(sig);
      cloned.push({
        ...structuredClone(w),
        id: `wcopy-${stamp}-${idx}`,
      });
    });

    if (cloned.length === 0) {
      st.pushToast(`${activeLv.shortCode} already has matching walls from ${refLv.shortCode}`, "info");
      return 0;
    }

    st.commitDocMutation((d) => {
      const targetLayer = findOrEnsureLayer(d, "walls");
      targetLayer.walls = [...(targetLayer.walls ?? []), ...cloned];
    });
    st.pushToast(
      `Copied ${cloned.length} wall footprint${cloned.length === 1 ? "" : "s"} from ${refLv.shortCode} to ${activeLv.shortCode}`,
      "success",
    );
    return cloned.length;
  },

  addPortal: (portal) =>
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "walls");
      layer.portals = [...(layer.portals ?? []), portal];
    }),

  updatePortal: (layerId, portalId, partial, recordHistory = false) =>
    get().patchActiveDoc(
      (d) => patchLayerItemInDoc(d, layerId, "portals", portalId, partial),
      recordHistory,
    ),

  togglePortalClosed: (layerId, portalId) =>
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      const p = layer?.portals?.find((x) => x.id === portalId);
      if (p) p.closed = !p.closed;
    }),

  addPath: (path) => {
    let targetLayerId = "";
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "paths");
      targetLayerId = layer.id;
      layer.paths = [...(layer.paths ?? []), path];
    });
    set({ selection: { kind: "path", layerId: targetLayerId, id: path.id } });
  },

  updatePath: (layerId, pathId, partial, recordHistory = false) =>
    get().patchActiveDoc((d) => {
      const existing = d.layers.find((l) => l.id === layerId)?.paths?.find((p) => p.id === pathId);
      if (!existing) return null;
      const merged: Partial<SplinePath> = { ...partial };
      if (partial.curved !== undefined && partial.segmentCurves === undefined) {
        merged.segmentCurves = undefined;
      } else if (partial.points !== undefined && partial.segmentCurves === undefined && existing.segmentCurves) {
        merged.segmentCurves = normalizeWallSegmentCurves(partial.points.length, false, existing.segmentCurves);
      }
      return patchLayerItemInDoc(d, layerId, "paths", pathId, merged);
    }, recordHistory),

  addRoof: (roof) => {
    let targetLayerId = "";
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "roofs");
      targetLayerId = layer.id;
      layer.roofs = [...(layer.roofs ?? []), roof];
    });
    set({ selection: { kind: "roof", layerId: targetLayerId, id: roof.id } });
  },

  updateRoof: (layerId, roofId, partial, recordHistory = false) =>
    get().patchActiveDoc((d) => {
      const existing = d.layers.find((l) => l.id === layerId)?.roofs?.find((r) => r.id === roofId);
      if (!existing) return null;
      const merged: Partial<RoofStructure> = { ...partial };
      if (partial.curved !== undefined && partial.segmentCurves === undefined) {
        merged.segmentCurves = undefined;
      } else if (partial.points !== undefined && partial.segmentCurves === undefined && existing.segmentCurves) {
        merged.segmentCurves = normalizeWallSegmentCurves(partial.points.length, false, existing.segmentCurves);
      }
      return patchLayerItemInDoc(d, layerId, "roofs", roofId, merged);
    }, recordHistory),

  applyRoofPreset: (presetId) => {
    const preset = getRoofPreset(presetId);
    const sel = get().selection;
    set({
      roofPresetId: preset.id,
      activeRoofAssetId: preset.assetId,
      roofRidgeCapStyle: preset.ridgeCapStyle,
      roofSlopeShade: preset.slopeShade,
      roofWeathering: preset.weathering,
    });
    if (sel?.kind === "roof") {
      get().updateRoof(
        sel.layerId,
        sel.id,
        {
          assetId: preset.assetId,
          ridgeCapStyle: preset.ridgeCapStyle,
          slopeShade: preset.slopeShade,
          weathering: preset.weathering,
        },
        true,
      );
    }
  },

  syncSunAngleToAllRoofs: (sunAngleDeg) => {
    const normalized = ((sunAngleDeg % 360) + 360) % 360;
    let count = 0;
    get().commitDocMutation((d) => {
      for (const layer of d.layers) {
        for (const roof of layer.roofs ?? []) {
          roof.sunAngleDeg = normalized;
          count++;
        }
      }
    });
    set({ roofSunAngleDeg: normalized });
    get().pushToast(
      `Synced sun angle (${Math.round(normalized)}°) across ${count} roof${count === 1 ? "" : "s"}`,
      "success",
    );
  },

  reorderRoofInLayer: (layerId, roofId, op) =>
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      if (!layer?.roofs) return;
      const idx = layer.roofs.findIndex((r) => r.id === roofId);
      if (idx < 0) return;
      const [item] = layer.roofs.splice(idx, 1);
      if (op === "front") {
        layer.roofs.push(item);
      } else {
        layer.roofs.unshift(item);
      }
    }),

  addObjectStamp: (stamp, recordHistory = true) => {
    let targetLayerId = "";
    let computedZ = stamp.zOrder;
    const st = get();
    const order = st.stampPlacementOrder;
    const prevZ = st.lastStampedObjectZ;
    st.commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "objects");
      targetLayerId = layer.id;
      const existing = layer.objects ?? [];
      if (existing.length > 0) {
        const overlapping = existing.filter((o) => {
          const hw = (o.widthCells + stamp.widthCells) * 0.5;
          const hh = (o.heightCells + stamp.heightCells) * 0.5;
          return Math.abs(o.x - stamp.x) <= hw && Math.abs(o.y - stamp.y) <= hh;
        });
        if (order === "below") {
          const refObjs = overlapping.length > 0 ? overlapping : existing;
          let minZ = Math.min(...refObjs.map((o) => o.zOrder));
          if (overlapping.length === 0 && prevZ !== null) {
            minZ = Math.min(minZ, prevZ);
          }
          computedZ = minZ - 1;
        } else {
          const refObjs = overlapping.length > 0 ? overlapping : existing;
          let maxZ = Math.max(...refObjs.map((o) => o.zOrder));
          if (prevZ !== null) {
            maxZ = Math.max(maxZ, prevZ);
          }
          computedZ = maxZ + 1;
        }
      }
      layer.objects = [...existing, { ...stamp, zOrder: computedZ }];
    }, recordHistory);
    set((cur) => ({
      lastStampedObjectZ: computedZ,
      // Keep Stamp Tool Color Studio active when rapidly stamping multiple colors; select on drag-drop in Select mode
      selection:
        cur.activeTool !== "stamp"
          ? { kind: "object", layerId: targetLayerId, id: stamp.id }
          : cur.selection,
    }));
  },

  updateObjectStamp: (layerId, objId, partial, recordHistory = false) =>
    get().patchActiveDoc(
      (d) => patchLayerItemInDoc(d, layerId, "objects", objId, partial),
      recordHistory,
    ),

  addScatterZone: (zone) => {
    let targetLayerId = "";
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "scatter_zone");
      targetLayerId = layer.id;
      const sameFloorLayers = d.layers.filter((l) => l.levelId === layer.levelId);
      const allWalls = sameFloorLayers.flatMap((l) => l.walls ?? []);
      const allPaths = sameFloorLayers.flatMap((l) => l.paths ?? []);
      const allPortals = sameFloorLayers.flatMap((l) => l.portals ?? []);
      const allObjects = sameFloorLayers.flatMap((l) => l.objects ?? []);
      const populated: ScatterZone = {
        ...zone,
        placements: generateScatterPlacements(zone, allWalls, allPaths, allPortals, allObjects),
      };
      layer.scatterZones = [...(layer.scatterZones ?? []), populated];
    });
    set({ selection: { kind: "scatter", layerId: targetLayerId, id: zone.id } });
  },

  updateScatterZone: (layerId, zoneId, partial, repopulate = true, recordHistory = true) =>
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      const zone = layer?.scatterZones?.find((z) => z.id === zoneId);
      if (!zone || !layer) return;
      Object.assign(zone, partial);
      if (repopulate) {
        const sameFloorLayers = d.layers.filter((l) => l.levelId === layer.levelId);
        const allWalls = sameFloorLayers.flatMap((l) => l.walls ?? []);
        const allPaths = sameFloorLayers.flatMap((l) => l.paths ?? []);
        const allPortals = sameFloorLayers.flatMap((l) => l.portals ?? []);
        const allObjects = sameFloorLayers.flatMap((l) => l.objects ?? []);
        zone.placements = generateScatterPlacements(zone, allWalls, allPaths, allPortals, allObjects);
      }
    }, recordHistory),

  reseedScatterZone: (layerId, zoneId, newSeed) =>
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      const zone = layer?.scatterZones?.find((z) => z.id === zoneId);
      if (!zone || !layer) return;
      zone.seed = newSeed ?? Math.floor(Math.random() * 999999);
      const sameFloorLayers = d.layers.filter((l) => l.levelId === layer.levelId);
      const allWalls = sameFloorLayers.flatMap((l) => l.walls ?? []);
      const allPaths = sameFloorLayers.flatMap((l) => l.paths ?? []);
      const allPortals = sameFloorLayers.flatMap((l) => l.portals ?? []);
      const allObjects = sameFloorLayers.flatMap((l) => l.objects ?? []);
      zone.placements = generateScatterPlacements(zone, allWalls, allPaths, allPortals, allObjects);
    }),

  addLight: (light) => {
    let targetLayerId = "";
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "lights");
      targetLayerId = layer.id;
      layer.lights = [...(layer.lights ?? []), light];
    });
    set({ selection: { kind: "light", layerId: targetLayerId, id: light.id } });
  },

  updateLight: (layerId, lightId, partial, recordHistory = false) =>
    get().patchActiveDoc(
      (d) => patchLayerItemInDoc(d, layerId, "lights", lightId, partial),
      recordHistory,
    ),

  addDmNote: (note) => {
    let targetLayerId = "";
    get().commitDocMutation((d) => {
      const layer = findOrEnsureLayer(d, "dm_notes");
      targetLayerId = layer.id;
      layer.dmNotes = [...(layer.dmNotes ?? []), note];
    });
    set({ selection: { kind: "dm_note", layerId: targetLayerId, id: note.id } });
  },

  updateDmNote: (layerId, noteId, partial, recordHistory = false) =>
    get().patchActiveDoc(
      (d) => patchLayerItemInDoc(d, layerId, "dmNotes", noteId, partial),
      recordHistory,
    ),

  // =========================================================================
  // World Atlas Studio v1.5 Mutations
  // =========================================================================

  applyWorldTheme: (themeId) => {
    const theme = getWorldThemeById(themeId);
    get().commitDocMutation((d) => {
      if (!d.world) return;
      d.world.themeId = theme.id;
      d.world.theme = structuredClone(theme);
      d.world.overlays.frame.style = theme.frameStyle;
      d.world.overlays.frame.colorHex = theme.frameColorHex;
      d.world.overlays.grid.colorHex = theme.coastlineInkHex;
      // Refresh label colors that are not custom DM notes so themes harmonize cleanly!
      for (const lbl of d.world.labels) {
        if (lbl.dmOnly) continue;
        lbl.fontFamily =
          lbl.category === "continent" || lbl.category === "banner"
            ? theme.fontFamilyDisplay
            : theme.fontFamilyBody;
        lbl.colorHex =
          lbl.category === "ocean" ? theme.coastalEffectColorHex : theme.labelColorHex;
        lbl.outlineColorHex = theme.labelOutlineHex;
      }
    });
    set({ worldTrailColorHex: theme.defaultTrailColorHex });
    get().pushToast(`Applied "${theme.name}" Atlas Theme`, "success");
  },

  updateWorldTheme: (partial, recordHistory = false) =>
    get().patchActiveDoc((d) => {
      if (!d.world) return null;
      return {
        ...d,
        world: { ...d.world, theme: { ...d.world.theme, ...partial } },
      };
    }, recordHistory),

  regenerateWorldLandmass: (opts) => {
    const gen = generateLandmassHeightmap({
      preset: opts.preset,
      seed: opts.seed,
      waterLevel: opts.waterLevel ?? 0.48,
      roughness: opts.roughness ?? 0.62,
      detail: opts.detail ?? 5,
    });
    get().commitDocMutation((d) => {
      if (!d.world) return;
      d.world.gridW = gen.gridW;
      d.world.gridH = gen.gridH;
      d.world.heightmapB64 = gen.heightmapB64;
      d.world.freshwaterB64 = undefined;
      d.world.seed = opts.seed;
      if (opts.roughness !== undefined) d.world.coastlineRoughness = opts.roughness;
      if (opts.clearFeatures) {
        d.world.biomeStrokes = [];
        d.world.rivers = [];
        d.world.trails = [];
        d.world.regions = [];
        for (const lyr of d.layers) {
          if (lyr.kind === "objects") lyr.objects = [];
        }
      }
    });
    get().pushToast(`Generated "${opts.preset.replace("_", " ")}" Landmass (Seed #${opts.seed})`, "success");
  },

  sculptWorldLand: (points, modeOverride, recordHistory = true) => {
    const st = get();
    const mode = modeOverride ?? st.worldLandMode;
    st.patchActiveDoc((d) => {
      if (!d.world) return null;
      const res = sculptWorldHeightmap(
        d.world,
        points,
        d.canvas.widthCells,
        d.canvas.heightCells,
        {
          mode,
          radiusCells: st.worldLandRadiusCells,
          roughness: st.worldLandRoughness,
          strength: st.worldLandStrength,
          seed: Math.floor(Date.now() % 100000),
        },
      );
      return {
        ...d,
        world: {
          ...d.world,
          heightmapB64: res.heightmapB64,
          freshwaterB64: res.freshwaterB64,
        },
      };
    }, recordHistory);
  },

  addWorldBiomeStroke: (stroke) =>
    get().patchActiveDoc((d) => {
      if (!d.world) return null;
      return {
        ...d,
        world: {
          ...d.world,
          biomeStrokes: [...d.world.biomeStrokes, stroke],
        },
      };
    }, true),

  clearWorldBiomes: () => {
    get().patchActiveDoc((d) => {
      if (!d.world) return null;
      return {
        ...d,
        world: { ...d.world, biomeStrokes: [] },
      };
    }, true);
    get().pushToast("Cleared ground biome paint");
  },

  addWorldRiver: (river) => {
    get().patchActiveDoc((d) => {
      if (!d.world) return null;
      return {
        ...d,
        world: { ...d.world, rivers: [...d.world.rivers, river] },
      };
    }, true);
    set({ selection: { kind: "world_river", layerId: "__world__", id: river.id } });
  },

  updateWorldRiver: (riverId, partial, recordHistory = false) =>
    get().patchActiveDoc((d) => {
      const existing = d.world?.rivers.find((r) => r.id === riverId);
      if (!existing) return null;
      const merged: Partial<WorldRiver> = { ...partial };
      if (partial.curved !== undefined && partial.segmentCurves === undefined) {
        merged.segmentCurves = undefined;
      } else if (partial.points !== undefined && partial.segmentCurves === undefined && existing.segmentCurves) {
        merged.segmentCurves = normalizeWallSegmentCurves(partial.points.length, false, existing.segmentCurves);
      }
      return patchWorldItemInDoc(d, "rivers", riverId, merged);
    }, recordHistory),

  addWorldTrail: (trail) => {
    get().patchActiveDoc((d) => {
      if (!d.world) return null;
      return {
        ...d,
        world: { ...d.world, trails: [...d.world.trails, trail] },
      };
    }, true);
    set({ selection: { kind: "world_trail", layerId: "__world__", id: trail.id } });
  },

  updateWorldTrail: (trailId, partial, recordHistory = false) =>
    get().patchActiveDoc((d) => {
      const existing = d.world?.trails.find((t) => t.id === trailId);
      if (!existing) return null;
      const merged: Partial<WorldTrail> = { ...partial };
      if (partial.curved !== undefined && partial.segmentCurves === undefined) {
        merged.segmentCurves = undefined;
      } else if (partial.points !== undefined && partial.segmentCurves === undefined && existing.segmentCurves) {
        merged.segmentCurves = normalizeWallSegmentCurves(partial.points.length, false, existing.segmentCurves);
      }
      return patchWorldItemInDoc(d, "trails", trailId, merged);
    }, recordHistory),

  addWorldRegion: (region) => {
    get().patchActiveDoc((d) => {
      if (!d.world) return null;
      return {
        ...d,
        world: { ...d.world, regions: [...d.world.regions, region] },
      };
    }, true);
    set({ selection: { kind: "world_region", layerId: "__world__", id: region.id } });
  },

  updateWorldRegion: (regionId, partial, recordHistory = false) =>
    get().patchActiveDoc((d) => {
      const existing = d.world?.regions.find((rg) => rg.id === regionId);
      if (!existing) return null;
      const merged: Partial<WorldRegion> = { ...partial };
      if (partial.curved !== undefined && partial.segmentCurves === undefined) {
        merged.segmentCurves = undefined;
      } else if (partial.polygon !== undefined && partial.segmentCurves === undefined && existing.segmentCurves) {
        merged.segmentCurves = normalizeWallSegmentCurves(partial.polygon.length, true, existing.segmentCurves);
      }
      return patchWorldItemInDoc(d, "regions", regionId, merged);
    }, recordHistory),

  addWorldLabel: (label) => {
    get().patchActiveDoc((d) => {
      if (!d.world) return null;
      return {
        ...d,
        world: { ...d.world, labels: [...d.world.labels, label] },
      };
    }, true);
    set({ selection: { kind: "world_label", layerId: "__world__", id: label.id } });
  },

  updateWorldLabel: (labelId, partial, recordHistory = false) =>
    get().patchActiveDoc(
      (d) => patchWorldItemInDoc(d, "labels", labelId, partial),
      recordHistory,
    ),

  addWorldSubMapPin: (pin) => {
    get().patchActiveDoc((d) => {
      if (!d.world) return null;
      return {
        ...d,
        world: { ...d.world, subMapPins: [...d.world.subMapPins, pin] },
      };
    }, true);
    set({ selection: { kind: "world_pin", layerId: "__world__", id: pin.id } });
  },

  updateWorldSubMapPin: (pinId, partial, recordHistory = false) =>
    get().patchActiveDoc(
      (d) => patchWorldItemInDoc(d, "subMapPins", pinId, partial),
      recordHistory,
    ),

  updateWorldOverlays: (partial, recordHistory = false) =>
    get().commitDocMutation((d) => {
      if (!d.world) return;
      if (partial.compass) {
        d.world.overlays.compass = { ...d.world.overlays.compass, ...partial.compass };
      }
      if (partial.scaleBar) {
        d.world.overlays.scaleBar = { ...d.world.overlays.scaleBar, ...partial.scaleBar };
      }
      if (partial.grid) {
        d.world.overlays.grid = { ...d.world.overlays.grid, ...partial.grid };
      }
      if (partial.frame) {
        d.world.overlays.frame = { ...d.world.overlays.frame, ...partial.frame };
      }
      if (partial.travelMode) {
        d.world.overlays.travelMode = partial.travelMode;
      }
      if (partial.legend) {
        const curLeg = d.world.overlays.legend ?? {
          visible: false,
          x: 9.2,
          y: d.canvas.heightCells - 6.2,
          entries: [
            { label: "1 Week Travel By Horse", style: "dashed" as const, colorHex: "#382B1E", dashScale: 1.0 },
            { label: "1 Day Travel By Carpet", style: "dashed" as const, colorHex: "#382B1E", dashScale: 0.85 },
            { label: "1 Day Travel By Boat", style: "dotted" as const, colorHex: "#382B1E", dashScale: 0.9 },
          ],
        };
        d.world.overlays.legend = { ...curLeg, ...partial.legend };
      }
      if (partial.traceOverlay) {
        const curTr = d.world.overlays.traceOverlay ?? {
          visible: false,
          imageUrl: "",
          opacity: 0.35,
          aboveLand: true,
          scale: 1,
          offsetXCells: 0,
          offsetYCells: 0,
        };
        d.world.overlays.traceOverlay = { ...curTr, ...partial.traceOverlay };
      }
    }, recordHistory),

  createDetailWorldMap: (bounds, title) => {
    const parent = get().getActiveDoc();
    if (parent.mode !== "world" || !parent.world) return null;
    const cleanTitle = (title ?? `${parent.meta.title} — Region`).trim();
    const detailDoc = createDetailWorldFromBounds(parent, bounds, cleanTitle);
    if (!detailDoc) {
      get().pushToast("Drag a larger area to create a Regional Detail Atlas.", "warning");
      return null;
    }
    const cx = (bounds.x0 + bounds.x1) * 0.5;
    const cy = (bounds.y0 + bounds.y1) * 0.5;
    const pin: WorldSubMapPin = {
      id: `wpin-${Date.now()}`,
      label: cleanTitle,
      x: cx,
      y: cy,
      targetDocId: detailDoc.id,
      targetKind: "world_detail",
      bounds: {
        x0: Math.min(bounds.x0, bounds.x1),
        y0: Math.min(bounds.y0, bounds.y1),
        x1: Math.max(bounds.x0, bounds.x1),
        y1: Math.max(bounds.y0, bounds.y1),
      },
      colorHex: "#38BDF8",
    };
    get().commitDocMutation((d) => {
      if (!d.world) return;
      d.world.subMapPins = [...d.world.subMapPins, pin];
    });
    set((s) => ({
      documents: [...s.documents, detailDoc],
      activeDocId: detailDoc.id,
      historyByDocId: { ...s.historyByDocId, [detailDoc.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
      activeTool: "select",
    }));
    get().pushToast(`Created Regional Detail Atlas "${cleanTitle}" & linked pin!`, "success");
    return detailDoc.id;
  },

  createLinkedBattlemapFromWorld: (pt, title) => {
    const cleanTitle = (title ?? "Regional Encounter Battlemap").trim();
    const battleDoc = createBlankMap(cleanTitle, 48, 27);
    const pin: WorldSubMapPin = {
      id: `wpin-${Date.now()}`,
      label: cleanTitle,
      x: pt.x,
      y: pt.y,
      targetDocId: battleDoc.id,
      targetKind: "battlemap",
      colorHex: "#E5A93C",
    };
    get().commitDocMutation((d) => {
      if (!d.world) return;
      d.world.subMapPins = [...d.world.subMapPins, pin];
    });
    set((s) => ({
      documents: [...s.documents, battleDoc],
      activeDocId: battleDoc.id,
      historyByDocId: { ...s.historyByDocId, [battleDoc.id]: { undo: [], redo: [] } },
      undoStack: [],
      redoStack: [],
      dirty: false,
      selection: null,
      activeTool: "select",
    }));
    get().pushToast(`Created linked Battlemap "${cleanTitle}"!`, "success");
    return battleDoc.id;
  },

  deleteSelection: () => {
    const sel = get().selection;
    if (!sel) return;
    get().commitDocMutation((d) => {
      if (d.world) {
        if (sel.kind === "world_river") {
          d.world.rivers = d.world.rivers.filter((x) => x.id !== sel.id);
          return;
        }
        if (sel.kind === "world_trail") {
          d.world.trails = d.world.trails.filter((x) => x.id !== sel.id);
          return;
        }
        if (sel.kind === "world_region") {
          d.world.regions = d.world.regions.filter((x) => x.id !== sel.id);
          return;
        }
        if (sel.kind === "world_label") {
          d.world.labels = d.world.labels.filter((x) => x.id !== sel.id);
          return;
        }
        if (sel.kind === "world_pin") {
          d.world.subMapPins = d.world.subMapPins.filter((x) => x.id !== sel.id);
          return;
        }
      }
      const layer = d.layers.find((l) => l.id === sel.layerId);
      if (!layer || layer.locked) return;
      if (sel.kind === "object") layer.objects = (layer.objects ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "light") layer.lights = (layer.lights ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "wall") layer.walls = (layer.walls ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "portal") layer.portals = (layer.portals ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "path") layer.paths = (layer.paths ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "roof") layer.roofs = (layer.roofs ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "water") layer.waterRegions = (layer.waterRegions ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "scatter") layer.scatterZones = (layer.scatterZones ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "dm_note") layer.dmNotes = (layer.dmNotes ?? []).filter((x) => x.id !== sel.id);
      if (sel.kind === "cave_entrance" && layer.caveSystem) {
        layer.caveSystem = {
          ...layer.caveSystem,
          entrances: layer.caveSystem.entrances.filter((x) => x.id !== sel.id),
        };
      }
    });
    set({ selection: null });
    get().pushToast("Deleted selected item");
  },

  duplicateSelection: (offsetX = 0.75, offsetY = 0.75) => {
    const sel = get().selection;
    if (!sel) return;
    let newSel: SelectionRef | null = null;
    get().commitDocMutation((d) => {
      if (d.world) {
        if (sel.kind === "world_label") {
          const orig = d.world.labels.find((x) => x.id === sel.id);
          if (orig) {
            const copy: WorldLabel = {
              ...structuredClone(orig),
              id: `wlbl-${Date.now()}`,
              x: orig.x + offsetX,
              y: orig.y + offsetY,
            };
            d.world.labels = [...d.world.labels, copy];
            newSel = { kind: "world_label", layerId: "__world__", id: copy.id };
          }
          return;
        }
        if (sel.kind === "world_river") {
          const orig = d.world.rivers.find((x) => x.id === sel.id);
          if (orig) {
            const copy: WorldRiver = {
              ...structuredClone(orig),
              id: `wriv-${Date.now()}`,
              points: orig.points.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
            };
            d.world.rivers = [...d.world.rivers, copy];
            newSel = { kind: "world_river", layerId: "__world__", id: copy.id };
          }
          return;
        }
        if (sel.kind === "world_trail") {
          const orig = d.world.trails.find((x) => x.id === sel.id);
          if (orig) {
            const copy: WorldTrail = {
              ...structuredClone(orig),
              id: `wtrl-${Date.now()}`,
              points: orig.points.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
            };
            d.world.trails = [...d.world.trails, copy];
            newSel = { kind: "world_trail", layerId: "__world__", id: copy.id };
          }
          return;
        }
        if (sel.kind === "world_region") {
          const orig = d.world.regions.find((x) => x.id === sel.id);
          if (orig) {
            const copy: WorldRegion = {
              ...structuredClone(orig),
              id: `wreg-${Date.now()}`,
              polygon: orig.polygon.map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })),
            };
            d.world.regions = [...d.world.regions, copy];
            newSel = { kind: "world_region", layerId: "__world__", id: copy.id };
          }
          return;
        }
      }
      const layer = d.layers.find((l) => l.id === sel.layerId);
      if (!layer) return;
      if (sel.kind === "object") {
        const orig = layer.objects?.find((x) => x.id === sel.id);
        if (!orig) return;
        const copy: ObjectStamp = {
          ...structuredClone(orig),
          id: `obj-${Date.now()}`,
          x: orig.x + offsetX,
          y: orig.y + offsetY,
          zOrder: orig.zOrder + 1,
        };
        layer.objects = [...(layer.objects ?? []), copy];
        newSel = { kind: "object", layerId: layer.id, id: copy.id };
      } else if (sel.kind === "light") {
        const orig = layer.lights?.find((x) => x.id === sel.id);
        if (!orig) return;
        const copy: LightNode = {
          ...structuredClone(orig),
          id: `lt-${Date.now()}`,
          name: `${orig.name} Copy`,
          x: orig.x + offsetX,
          y: orig.y + offsetY,
        };
        layer.lights = [...(layer.lights ?? []), copy];
        newSel = { kind: "light", layerId: layer.id, id: copy.id };
      } else if (sel.kind === "wall") {
        const orig = layer.walls?.find((x) => x.id === sel.id);
        if (!orig) return;
        const copy: WallSegment = {
          ...structuredClone(orig),
          id: `w-${Date.now()}`,
          points: orig.points.map((pt) => ({ x: pt.x + offsetX, y: pt.y + offsetY })),
        };
        layer.walls = [...(layer.walls ?? []), copy];
        newSel = { kind: "wall", layerId: layer.id, id: copy.id };
      } else if (sel.kind === "path") {
        const orig = layer.paths?.find((x) => x.id === sel.id);
        if (!orig) return;
        const copy: SplinePath = {
          ...structuredClone(orig),
          id: `path-${Date.now()}`,
          points: orig.points.map((pt) => ({ x: pt.x + offsetX, y: pt.y + offsetY })),
        };
        layer.paths = [...(layer.paths ?? []), copy];
        newSel = { kind: "path", layerId: layer.id, id: copy.id };
      } else if (sel.kind === "roof") {
        const orig = layer.roofs?.find((x) => x.id === sel.id);
        if (!orig) return;
        const copy: RoofStructure = {
          ...structuredClone(orig),
          id: `roof-${Date.now()}`,
          points: orig.points.map((pt) => ({ x: pt.x + offsetX, y: pt.y + offsetY })),
        };
        layer.roofs = [...(layer.roofs ?? []), copy];
        newSel = { kind: "roof", layerId: layer.id, id: copy.id };
      }
    });
    if (newSel) {
      set({ selection: newSel });
      get().pushToast("Duplicated item", "success");
    }
  },

  bendSelectedIntoCurve: () => {
    const sel = get().selection;
    if (
      !sel ||
      (sel.kind !== "wall" &&
        sel.kind !== "path" &&
        sel.kind !== "roof" &&
        sel.kind !== "water" &&
        sel.kind !== "world_river" &&
        sel.kind !== "world_trail" &&
        sel.kind !== "world_region")
    ) {
      return;
    }
    const bend2Pt = (pts: Point2D[]): Point2D[] => {
      if (pts.length !== 2) return pts;
      const [a, b] = pts;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.max(0.1, Math.hypot(dx, dy));
      const nx = -dy / len;
      const ny = dx / len;
      const bulge = Math.min(1.4, len * 0.2);
      return [
        a,
        { x: (a.x + b.x) * 0.5 + nx * bulge, y: (a.y + b.y) * 0.5 + ny * bulge },
        b,
      ];
    };
    get().commitDocMutation((d) => {
      if (sel.kind === "world_river" && d.world) {
        const rv = d.world.rivers.find((x) => x.id === sel.id);
        if (!rv || rv.points.length < 2) return;
        rv.points = bend2Pt(rv.points);
        rv.segmentCurves = undefined;
        rv.curved = true;
        return;
      }
      if (sel.kind === "world_trail" && d.world) {
        const tr = d.world.trails.find((x) => x.id === sel.id);
        if (!tr || tr.points.length < 2) return;
        tr.points = bend2Pt(tr.points);
        tr.segmentCurves = undefined;
        tr.curved = true;
        return;
      }
      if (sel.kind === "world_region" && d.world) {
        const reg = d.world.regions.find((x) => x.id === sel.id);
        if (!reg || reg.polygon.length < 3) return;
        reg.segmentCurves = undefined;
        reg.curved = true;
        return;
      }
      const layer = d.layers.find((l) => l.id === sel.layerId);
      if (!layer) return;
      if (sel.kind === "wall") {
        const w = layer.walls?.find((x) => x.id === sel.id);
        if (!w || w.points.length < 2) return;
        w.points = bend2Pt(w.points);
        w.segmentCurves = undefined;
        w.curved = true;
        if (w.points.length >= 3) {
          const nextPoly = makeClosedWallPolygon(w);
          if (nextPoly.length >= 3) {
            for (const lyr of d.layers) {
              if (lyr.kind !== "terrain" || !lyr.terrainStrokes) continue;
              for (const s of lyr.terrainStrokes) {
                if (s.sourceWallId === w.id && !s.erase) {
                  s.points = nextPoly.map((p) => ({ ...p }));
                  s.holes = undefined;
                  s.segmentCurves = undefined;
                }
              }
            }
          }
        }
      } else if (sel.kind === "path") {
        const p = layer.paths?.find((x) => x.id === sel.id);
        if (!p || p.points.length < 2) return;
        p.points = bend2Pt(p.points);
        p.segmentCurves = undefined;
        p.curved = true;
      } else if (sel.kind === "roof") {
        const rf = layer.roofs?.find((x) => x.id === sel.id);
        if (!rf || rf.style === "cone" || rf.points.length < 2) return;
        rf.points = bend2Pt(rf.points);
        rf.segmentCurves = undefined;
        rf.curved = true;
      } else if (sel.kind === "water") {
        const wr = layer.waterRegions?.find((x) => x.id === sel.id);
        if (!wr || wr.points.length < 2) return;
        if (wr.shape === "river") wr.points = bend2Pt(wr.points);
        wr.segmentCurves = undefined;
        wr.curved = true;
      }
    });
    get().pushToast("Converted to smooth curve — drag gold dots to bend!", "success");
  },

  copySelection: () => {
    const sel = get().selection;
    if (!sel || sel.kind !== "object") return;
    const doc = get().getActiveDoc();
    const obj = doc.layers.find((l) => l.id === sel.layerId)?.objects?.find((o) => o.id === sel.id);
    if (obj) {
      set({ copiedObject: structuredClone(obj) });
      get().pushToast("Copied prop to clipboard");
    }
  },

  pasteAt: (x, y) => {
    const copied = get().copiedObject;
    if (!copied) {
      get().pushToast("Clipboard is empty", "warning");
      return;
    }
    const stamp: ObjectStamp = {
      ...structuredClone(copied),
      id: `obj-${Date.now()}`,
      x,
      y,
      zOrder: copied.zOrder + 1,
    };
    get().addObjectStamp(stamp);
    get().pushToast("Pasted prop", "success");
  },

  transformSelectedObject: (op) => {
    const sel = get().selection;
    if (!sel || sel.kind !== "object") return;
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === sel.layerId);
      const objs = layer?.objects;
      if (!objs) return;
      const obj = objs.find((o) => o.id === sel.id);
      if (!obj) return;
      const maxZ = objs.reduce((m, o) => Math.max(m, o.zOrder), 0);
      const minZ = objs.reduce((m, o) => Math.min(m, o.zOrder), 0);
      if (op === "flipX") obj.flipX = !obj.flipX;
      if (op === "flipY") obj.flipY = !obj.flipY;
      if (op === "rotCW") obj.rotationRad += Math.PI / 4;
      if (op === "rotCCW") obj.rotationRad -= Math.PI / 4;
      if (op === "front") obj.zOrder = maxZ + 1;
      if (op === "back") obj.zOrder = minZ - 1;
      if (op === "stepFwd") obj.zOrder += 1;
      if (op === "stepBack") obj.zOrder -= 1;
      if (op === "toggleShadow") obj.castsShadow = !obj.castsShadow;
      if (op === "toggleLock") obj.locked = !obj.locked;
    });
  },

  moveSelectionToLayer: (targetLayerId) => {
    const sel = get().selection;
    if (!sel || sel.kind !== "object" || sel.layerId === targetLayerId) return;
    get().commitDocMutation((d) => {
      const src = d.layers.find((l) => l.id === sel.layerId);
      const dst = d.layers.find((l) => l.id === targetLayerId);
      if (!src?.objects || !dst || dst.kind !== "objects") return;
      const obj = src.objects.find((o) => o.id === sel.id);
      if (!obj) return;
      src.objects = src.objects.filter((o) => o.id !== sel.id);
      dst.objects = [...(dst.objects ?? []), obj];
    });
    set({ selection: { ...sel, layerId: targetLayerId } });
    get().pushToast("Moved prop to target layer", "success");
  },

  copySelectedRecolor: () => {
    const sel = get().selection;
    if (!sel || sel.kind !== "object") return;
    const obj = get()
      .getActiveDoc()
      .layers.find((l) => l.id === sel.layerId)
      ?.objects?.find((o) => o.id === sel.id);
    if (obj) {
      set({ copiedRecolor: { ...obj.recolor } });
      get().pushToast("Copied RGB shader tint");
    }
  },

  pasteRecolorToSelected: () => {
    const sel = get().selection;
    const copied = get().copiedRecolor;
    if (!sel || !copied) return;
    if (sel.kind === "object") {
      get().updateObjectStamp(sel.layerId, sel.id, { recolor: { ...copied } }, true);
    } else if (sel.kind === "wall") {
      get().updateWall(sel.layerId, sel.id, { recolor: { ...copied } }, true);
    } else if (sel.kind === "path") {
      get().updatePath(sel.layerId, sel.id, { recolor: { ...copied } }, true);
    } else if (sel.kind === "roof") {
      get().updateRoof(sel.layerId, sel.id, { recolor: { ...copied } }, true);
    } else if (sel.kind === "portal") {
      get().updatePortal(sel.layerId, sel.id, { recolor: { ...copied } }, true);
    }
    get().pushToast("Applied color style", "success");
  },

  applyRecolorToMatchingObjects: (layerId, assetId, recolor) => {
    let count = 0;
    get().commitDocMutation((d) => {
      const layer = d.layers.find((l) => l.id === layerId);
      if (!layer?.objects) return;
      for (const obj of layer.objects) {
        if (obj.assetId === assetId) {
          obj.recolor = { ...recolor };
          count++;
        }
      }
    });
    get().pushToast(`Recolored ${count} matching prop${count === 1 ? "" : "s"} on layer`, "success");
  },

  setVaultDrawerOpen: (vaultDrawerOpen) => set({ vaultDrawerOpen }),
  setVaultExpandedModal: (vaultExpandedModal) => set({ vaultExpandedModal }),
  setExportModalOpen: (exportModalOpen) => set({ exportModalOpen }),
  openExternalMapImport: (fileName, bytes) =>
    set({
      mapImportModalOpen: true,
      pendingImportFile: { fileName, bytes },
    }),
  closeExternalMapImport: () =>
    set({
      mapImportModalOpen: false,
      pendingImportFile: null,
    }),
  importExternalMapDocument: (rawDoc, summary) => {
    const doc = normalizeLoadedDoc(rawDoc);
    set((s) => ({
      documents: [...s.documents, doc],
      activeDocId: doc.id,
      activeTool: "select",
      historyByDocId: { ...s.historyByDocId, [doc.id]: { undo: [], redo: [] } },
      dirtyDocIds: { ...s.dirtyDocIds, [doc.id]: true },
      undoStack: [],
      redoStack: [],
      dirty: true,
      selection: null,
      mapImportModalOpen: false,
      pendingImportFile: null,
    }));
    const labelSummary =
      summary.sourceFormat === "wonderdraft"
        ? `${summary.counts.symbolsOrObjects} symbols · ${summary.counts.labels} labels · ${summary.counts.trailsOrPaths} trails`
        : `${summary.levelCount} floor${summary.levelCount === 1 ? "" : "s"} · ${summary.counts.walls} walls · ${summary.counts.symbolsOrObjects} props`;
    get().pushToast(`Imported ${doc.meta.title} (${labelSummary})`, "success");
  },
  bulkSwapImportedAsset: (sourceRef, nextAssetId, vaultAssets, spreadVariants = false) => {
    let swapped = 0;
    get().patchActiveDoc((cur) => {
      const res = applyBulkAssetSwapToDoc(cur, sourceRef, nextAssetId, vaultAssets, spreadVariants);
      swapped = res.swappedCount;
      return swapped > 0 ? res.doc : null;
    }, true);
    if (swapped > 0) {
      get().pushToast(
        `Swapped ${swapped} instance${swapped === 1 ? "" : "s"} of "${cleanSourceRefLabel(sourceRef)}"`,
        "success",
      );
    }
    return swapped;
  },
  setPreferencesModalOpen: (preferencesModalOpen) => set({ preferencesModalOpen }),
  setShortcutsModalOpen: (shortcutsModalOpen) => set({ shortcutsModalOpen }),
  updatePreferences: (partial) =>
    set((s) => {
      const next = { ...s.preferences, ...partial };
      savePrefs(next);
      return { preferences: next };
    }),
}));

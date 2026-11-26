export type MapMode = "battlemap" | "world";

export type GridType = "square" | "hex_flat" | "hex_pointy" | "none";

export type BlendModeName =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "add"
  | "darken";

export type ToolId =
  | "select"
  | "terrain"
  | "cave"
  | "water"
  | "wall"
  | "portal"
  | "path"
  | "roof"
  | "stamp"
  | "template"
  | "scatter"
  | "light"
  | "dm_note"
  | "measure"
  // World Atlas 1.5 Tools
  | "world_land"
  | "world_biome"
  | "world_river"
  | "world_trail"
  | "world_region"
  | "world_label"
  | "world_crop"
  | "world_theme";

export type WorldAssetGroup =
  | "mountains"
  | "trees"
  | "settlements"
  | "landmarks"
  | "maritime"
  | "cartography"
  | "textures";

export type SnapMode = "grid" | "half" | "free";

export type AssetCategory =
  | "all"
  | "object"
  | "wall"
  | "terrain"
  | "path"
  | "portal"
  | "light"
  | "symbol";

export type SourceKind =
  | "folder"
  | "zip"
  | "dungeondraft_pack"
  | "wonderdraft"
  | "dcpack";

export interface Point2D {
  x: number; // Grid cell units (e.g. 0..48)
  y: number; // Grid cell units (e.g. 0..27)
}

export type RecolorMode =
  | "auto"
  | "dd_red"
  | "rgb_channels"
  | "tint"
  | "universal";

export interface RgbRecolor {
  enabled: boolean;
  mode?: RecolorMode;
  tintHex: string;
  channelR: string;
  channelG: string;
  channelB: string;
  strength?: number; // 0..1 blend weight (defaults: 1.0 for dd_red/rgb/tint, 0.55 for universal)
  hueShift: number; // -180..180
  saturation: number; // 0..2
  brightness: number; // 0.3..1.8
  contrast?: number; // 0.5..1.6
}

export const DEFAULT_RECOLOR: RgbRecolor = {
  enabled: false,
  mode: "auto",
  tintHex: "#2E86AB",
  channelR: "#C0392B",
  channelG: "#2E8B57",
  channelB: "#D4A438",
  strength: 0.72,
  hueShift: 0,
  saturation: 1,
  brightness: 1,
  contrast: 1,
};

export interface VaultSource {
  id: string;
  kind: SourceKind;
  name: string;
  rootPath: string;
  enabled: boolean;
  assetCount: number;
  ramEstimateMb: number;
  lastIndexedAt: number;
}

export interface VaultAsset {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceKind: SourceKind;
  internalPath: string;
  url: string;
  thumbUrl: string;
  displayName: string;
  category: Exclude<AssetCategory, "all">;
  worldGroup?: WorldAssetGroup;
  widthPx: number;
  heightPx: number;
  defaultPpi: number;
  drawMode: "normal" | "tint" | "dd_red" | "rgb_channels" | "sample_color";
  dominantHex: string;
  castsShadow: boolean;
  anchorOffsetX?: number;
  anchorOffsetY?: number;
  isFavorite: boolean;
  tags: string[];
}

export interface BiomeKit {
  id: string;
  name: string;
  accentHex: string;
  assetIds: string[];
}

export type TerrainMode = "brush" | "flood" | "replace" | "rect" | "polygon" | "erase";

export type TerrainReplaceScope = "patch" | "layer" | "floor" | "map";

export type TerrainEraseShape = "brush" | "room" | "rect" | "polygon";

export type StampPlacementOrder = "above" | "below";

export type StampRotateMode = "random" | "follow" | "step";

export interface TerrainStroke {
  id: string;
  assetId: string;
  points: Point2D[];
  radiusCells: number;
  opacity: number;
  softness: number;
  continuous?: boolean; // True for live freehand fluid brush strokes (draws seamless connected capsule)
  shape?: "brush" | "polygon"; // Default "brush"; "polygon" fills closed outer contour + optional holes cleanly
  holes?: Point2D[][]; // Optional interior cutouts (e.g., open courtyard fill flowing around enclosed buildings)
  /** Optional per-edge signed circular-arc sagitta (bulge in grid cells) for closed polygon fills */
  segmentCurves?: Array<number | null>;
  /** When true, subtracts/punches a transparent cutout strictly on this terrain layer */
  erase?: boolean;
  /** Optional repeating texture tile scale multiplier (0.4..2.5, default 1.0) */
  textureScale?: number;
  /** Optional parent wall ID for fills created via Fill Room so curving/moving the wall auto-refits the floor */
  sourceWallId?: string;
  rotationDeg?: number; // Texture & slope downhill direction in degrees (0=East ->, 90=South, 180=West, 270=North)
  slopeShade?: number; // 0..1 directional uphill-light to downhill-shadow gradient across the filled area
  recolor?: RgbRecolor;
  /** Original Wonderdraft / Dungeondraft asset reference preserved for live bulk re-swapping */
  importedSourceRef?: string;
}

export type WaterDrawMode = "lake_brush" | "river_path" | "polygon" | "erase";
export type WaterBodyKind = "water" | "swamp" | "ice" | "lava" | "chasm";

export interface WaterRegion {
  id: string;
  kind: WaterBodyKind;
  presetId?: string;
  /** "polygon" = closed lake/pond/cove/chasm; "river" = centerline spline expanded by widthCells */
  shape?: "polygon" | "river";
  widthCells?: number;
  curved?: boolean;
  /** Optional per-edge signed circular-arc sagitta (bulge in grid cells), parallel to edges */
  segmentCurves?: Array<number | null>;
  textureAssetId?: string;
  points: Point2D[];
  deepColorHex: string;
  shallowColorHex?: string;
  rimColorHex: string;
  opacity: number;
  /** 0..1 shoreline wave & foam ripple intensity */
  rippleIntensity?: number;
  /** 0..1 sunlit underwater caustics shimmer intensity */
  causticsIntensity?: number;
  /** 0..1 shallow-to-deep shoreline depth transition width */
  depthFeather?: number;
  /** 0..1 damp wet-sand / dark shore bank shadow outside the waterline */
  shoreBankIntensity?: number;
  /** 0..1 deterministic organic coastline roughness */
  organicRoughness?: number;
  seed?: number;
  /** Optional dry islands, sandbars, or rock outcrops punched cleanly out of this water body */
  cutouts?: Point2D[][];
}

export type WallDrawMode = "free" | "box" | "circle" | "arc" | "split" | "corridor";

export type WallPolygonShape = "round" | "oval" | "hex" | "octagon" | "dodecagon";

export type WallSplitSubMode = "split" | "breach";

export interface WallSegment {
  id: string;
  assetId: string;
  points: Point2D[];
  closed: boolean;
  curved: boolean;
  /**
   * Optional per-edge signed circular-arc sagitta (bulge in grid cells),
   * parallel to edges i -> (i + 1) % n.
   * null / undefined / 0 = razor-straight section; non-zero = localized circular arc.
   */
  segmentCurves?: Array<number | null>;
  thicknessCells: number;
  blocksLight: boolean;
  recolor?: RgbRecolor;
  importedSourceRef?: string;
}

export interface PortalNode {
  id: string;
  assetId: string;
  kind: "door" | "gate" | "window" | "hatch";
  wallId?: string;
  x: number;
  y: number;
  rotationRad: number;
  widthCells: number;
  closed: boolean;
  locked: boolean;
  blocksLightWhenClosed: boolean;
  swingInvert?: boolean; // Flips which side of the wall the door swings into (Inward / Outward)
  hingeFlip?: boolean; // Flips which jamb holds the hinge (Left / Right)
  recolor?: RgbRecolor;
  importedSourceRef?: string;
}

export interface SplinePath {
  id: string;
  assetId: string;
  points: Point2D[];
  widthCells: number;
  curved?: boolean; // Defaults to true (Catmull-Rom spline); false = sharp straight polyline
  /** Optional per-edge signed circular-arc sagitta (bulge in grid cells), parallel to edges */
  segmentCurves?: Array<number | null>;
  flipSide?: boolean; // Mirrors path perpendicular axis (reverses uphill crest vs downhill drop on embankments/cliffs!)
  taperEnds: boolean;
  fadeEnds: boolean;
  opacity: number;
  blocksScatter: boolean;
  recolor?: RgbRecolor;
  importedSourceRef?: string;
}

export type RoofDrawMode = "ridge_path" | "box" | "cone" | "auto_room";

export type RoofStyle = "gable" | "hip" | "shed" | "mansard" | "cone";

export type RoofRidgeCapStyle = "matching" | "timber" | "stone" | "copper" | "none";

export interface RoofStructure {
  id: string;
  /** Architectural roof shape */
  style: RoofStyle;
  /** Seamless roof shingle/tile texture assetId */
  assetId: string;
  /**
   * Control points in grid-cell coordinates:
   * - For gable/hip/shed/mansard: ridge spine polyline (>= 2 pts, works just like SplinePath)
   * - For cone: [centerPt, rimPt] (radius = distance between them)
   */
  points: Point2D[];
  /** Total roof span width perpendicular to the ridge in grid squares (e.g. 6.0 = 3.0 sq slope on each side) */
  widthCells: number;
  /** Curved Catmull-Rom ridge spine (for curved longhouses / organic pavilions) */
  curved?: boolean;
  /** Optional per-edge signed circular-arc sagitta (bulge in grid cells), parallel to ridge edges */
  segmentCurves?: Array<number | null>;
  /** For shed (single-slope) roofs: flips which side of the spine slopes downhill */
  flipSlope?: boolean;
  /** Asymmetric ridge offset (-0.4..+0.4, 0 = centered symmetric ridge; great for saltbox roofs) */
  ridgeOffset?: number;
  /** For hip & mansard roofs: end slope bevel inset ratio (0.2..1.0 * halfWidth, default 0.72) */
  hipInsetRatio?: number;
  /** For mansard roofs: flat central crown width ratio (0.18..0.68, default 0.42) */
  mansardCrownRatio?: number;
  /** For cone/turret roofs: facet count (0 = smooth 16-wedge round turret, 6 = hex, 8 = octagon, 12 = dodecagon) */
  coneFacets?: number;
  /** Eave overhang beyond walls when generated via Box or Auto-Room (cells) */
  overhangCells?: number;
  /** Sun light direction angle in degrees (0=E, 90=S, 180=W, 270=N; default 315 = NW studio key light) */
  sunAngleDeg: number;
  /** 0..1 directional slope shading intensity (sunlit warm slope vs cool shaded slope) */
  slopeShade: number;
  /** Ridge beam / crest cap style along main ridge & hip seams */
  ridgeCapStyle: RoofRidgeCapStyle;
  /** Ridge cap visual width in cells (0.12..0.6, default 0.24) */
  ridgeCapWidthCells?: number;
  /** Crisp dark bargeboard / fascia outline around outer eaves */
  eaveTrim: boolean;
  /** 0..1 directional ground drop shadow darkness */
  dropShadow: number;
  /** Ground drop shadow offset distance in cells (0.2..1.8, default 0.65) */
  shadowDistanceCells?: number;
  /** Roof shingle texture repeat scale multiplier (0.5..2.0, default 1.0) */
  textureScale?: number;
  /** 0..1 subtle organic eave grime / weathering vignette */
  weathering?: number;
  /** 0.15..1.0 opacity (lets DMs peek at interior floor plans underneath!) */
  opacity: number;
  /** Universal RGB / tint recolor shader */
  recolor?: RgbRecolor;
  importedSourceRef?: string;
}

export interface ObjectStamp {
  id: string;
  assetId: string;
  x: number;
  y: number;
  widthCells: number;
  heightCells: number;
  rotationRad: number;
  flipX: boolean;
  flipY: boolean;
  opacity: number;
  castsShadow: boolean;
  locked: boolean;
  recolor: RgbRecolor;
  zOrder: number;
  importedSourceRef?: string;
}

export interface ScatterPlacement {
  assetId: string;
  x: number;
  y: number;
  scale: number;
  rotationRad: number;
  flipX: boolean;
}

export interface ScatterZone {
  id: string;
  name: string;
  polygon: Point2D[];
  assetIds: string[];
  seed: number;
  minSpacingCells: number;
  minScale: number;
  maxScale: number;
  avoidWalls: boolean;
  avoidPaths: boolean;
  placements: ScatterPlacement[];
}

export interface LightNode {
  id: string;
  name: string;
  x: number;
  y: number;
  radiusCells: number;
  intensity: number; // 0.1..2.0
  colorHex: string;
  castShadows: boolean;
  coneAngleDeg: number; // 360 = point light, < 360 = directional headlamp/spotlight
  directionRad: number;
  flicker: boolean;
}

export interface DmNotePin {
  id: string;
  x: number;
  y: number;
  badge: "TRAP" | "SECRET" | "HAZARD" | "AMBUSH" | "NOTE";
  title: string;
  body: string;
  colorHex: string;
}

export type CaveDrawMode =
  | "cave_brush"
  | "dungeon_rect"
  | "polygon"
  | "erase"
  | "entrance";

export type CaveThresholdStyle = "none" | "rock_mouth" | "stone_arch";

export interface CaveOperation {
  id: string;
  kind: "brush" | "rect" | "polygon" | "erase_brush" | "erase_rect";
  points: Point2D[];
  radiusCells?: number; // For brush / erase_brush
  organicRoughness?: number; // 0 = crisp dungeon geometry, 0.25..1.0 = jagged organic cavern
  seed: number;
}

export interface CaveEntranceOpening {
  id: string;
  x: number;
  y: number;
  normalRad: number; // Outward angle pointing from cave interior into normal terrain
  widthCells: number; // Width of the wall break (1.0..6.0 sq)
  fadeLengthCells: number; // Outward feathered floor fade into normal terrain (0.5..5.5 sq)
  thresholdStyle: CaveThresholdStyle;
  markerLabel: string;
  showMarker: boolean;
  markerDmOnly: boolean;
}

export interface CaveDungeonSystem {
  id: string;
  themeId: string;
  floorAssetId: string;
  wallAssetId: string;
  wallThicknessCells: number;
  outerRimCells: number;
  outerRimColorHex: string;
  roughness: number; // Default roughness for organic cave brush (0..1)
  blocksLight: boolean;
  undergroundFill: boolean;
  undergroundColorHex: string;
  floorRecolor?: RgbRecolor;
  wallRecolor?: RgbRecolor;
  operations: CaveOperation[];
  entrances: CaveEntranceOpening[];
}

export type LayerKind =
  | "group"
  | "terrain"
  | "caves"
  | "water"
  | "walls"
  | "paths"
  | "roofs"
  | "objects"
  | "scatter_zone"
  | "lights"
  | "dm_notes";

export interface MapLayer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  dmOnly: boolean;
  opacity: number;
  blendMode: BlendModeName;
  levelId: string;
  terrainStrokes?: TerrainStroke[];
  caveSystem?: CaveDungeonSystem;
  waterRegions?: WaterRegion[];
  /** When true (default), all liquid water bodies on this layer mesh seamlessly with a shared transitioning shoreline; set false to stack separately on the same layer */
  waterMeshEnabled?: boolean;
  /** Biome-to-biome blend transition width in grid squares (0 = crisp split, 1.1 = smooth default, up to 3.0 = wide painterly fade) */
  waterBlendRadiusCells?: number;
  walls?: WallSegment[];
  portals?: PortalNode[];
  paths?: SplinePath[];
  roofs?: RoofStructure[];
  objects?: ObjectStamp[];
  scatterZones?: ScatterZone[];
  lights?: LightNode[];
  dmNotes?: DmNotePin[];
}

export type LevelKind = "underground" | "ground" | "upper" | "roof" | "sky";

export interface MapLevel {
  id: string;
  shortCode: string; // e.g., "B2", "B1", "1F", "2F", "3F", "ROOF", "SKY"
  name: string;
  kind: LevelKind;
  elevationFt: number;
  visible: boolean;
}

export interface LightingPreset {
  id: string;
  name: string;
  ambientColorHex: string;
  ambientIntensity: number; // 0 = pitch black, 1 = bright daylight
}

export type WorldLandBrushMode = "raise" | "lower" | "smooth" | "lake_carve" | "lake_erase";

export type WorldCoastalEffect =
  | "ripples"
  | "wave_lines"
  | "stipple"
  | "glow"
  | "soft_shadow"
  | "hatch"
  | "none";

export type WorldFrameStyle =
  | "none"
  | "classic_double"
  | "ornate_gold"
  | "stepped_ivory"
  | "nautical_degree"
  | "feudal_ink"
  | "torn_parchment";

export type WorldTrailStyle =
  | "dotted"
  | "dashed"
  | "solid"
  | "double_road"
  | "railroad"
  | "sea_lane"
  | "border";

export type WorldLabelCategory =
  | "continent"
  | "ocean"
  | "region"
  | "city"
  | "river"
  | "mountain"
  | "banner";

export type WorldLabelBoxStyle = "none" | "scroll" | "banner" | "ribbon" | "plaque";

export type WorldGridStyle = "none" | "hex_flat" | "hex_pointy" | "square" | "lat_lon";

export type WorldTravelMode = "walk" | "horse" | "ship" | "airship";

export type WorldLandmassPreset =
  | "continents"
  | "archipelago"
  | "pangaea"
  | "atoll"
  | "inland_sea"
  | "highlands"
  | "equirectangular";

export interface WorldThemeConfig {
  id: string;
  name: string;
  shortLabel: string;
  oceanColorHex: string;
  oceanDeepColorHex: string;
  oceanStainHex: string;
  oceanTextureAssetId?: string;
  landBaseColorHex: string;
  landTextureAssetId?: string;
  coastlineInkHex: string;
  coastlineWidthPx: number;
  coastalEffect: WorldCoastalEffect;
  coastalRippleCount: number; // 1..5
  coastalEffectColorHex: string;
  coastalVignetteStrength: number; // 0..1
  freshwaterColorHex: string;
  freshwaterRimHex: string;
  vignetteStrength: number; // 0..1
  paperGrainStrength: number; // 0..1
  fontFamilyDisplay: string;
  fontFamilyBody: string;
  labelColorHex: string;
  labelOutlineHex: string;
  frameStyle: WorldFrameStyle;
  frameColorHex: string;
  defaultTrailColorHex: string;
}

export type WorldBiomePaintTarget = "land" | "ocean" | "both";

export type WorldBiomeBrushPattern = "solid" | "stipple";

export interface WorldBiomeStroke {
  id: string;
  points: Point2D[];
  radiusCells: number;
  colorHex: string;
  opacity: number; // 0.05..1
  softness: number; // 0.1..1
  roughness: number; // 0..1
  seed: number;
  /** Where this watercolor wash applies (defaults to "land" so coastlines stay crisp; "ocean" paints Putrid Seas, deep trenches & reefs!) */
  target?: WorldBiomePaintTarget;
  /** Optional antique ink-stipple surface texture (great for sandy plains, chalky rocky capes & badlands!) */
  pattern?: WorldBiomeBrushPattern;
}

export interface WorldRiver {
  id: string;
  name?: string;
  points: Point2D[];
  startWidthCells: number; // narrow mountain spring
  endWidthCells: number; // wide river mouth / delta
  meanderRoughness: number; // 0..1
  meanderScale: number; // 0.2..2.0
  curved: boolean;
  /** Optional per-edge signed circular-arc sagitta (bulge in grid cells), parallel to river edges */
  segmentCurves?: Array<number | null>;
  colorHex?: string;
  bankColorHex?: string;
  seed: number;
  /** Smoothly fade river banks & water fill into the receiving ocean, lake, or parent river (default true) */
  fadeMouth?: boolean;
  /** Smoothly taper/fade hairline spring source (default true) */
  fadeSource?: boolean;
  /** Fraction of river length near mouth over which banks & fill blend into water (default 0.22) */
  mouthFadeRatio?: number;
  /** Clip river overshoot against ocean/lake shoreline cleanly (default true) */
  clipToLand?: boolean;
}

export interface WorldTrail {
  id: string;
  name?: string;
  points: Point2D[];
  style: WorldTrailStyle;
  widthCells: number;
  colorHex: string;
  outlineColorHex?: string;
  dashScale: number; // 0.5..2.5
  curved: boolean;
  /** Optional per-edge signed circular-arc sagitta (bulge in grid cells), parallel to route edges */
  segmentCurves?: Array<number | null>;
  opacity: number;
}

export interface WorldRegion {
  id: string;
  name: string;
  polygon: Point2D[];
  curved: boolean;
  /** Optional per-edge signed circular-arc sagitta (bulge in grid cells), parallel to border edges */
  segmentCurves?: Array<number | null>;
  fillColorHex: string;
  fillOpacity: number; // 0.05..0.8
  borderColorHex: string;
  borderWidth: number; // px at 32px/cell
  borderStyle: "solid" | "dashed" | "dotted";
  clipToLand: boolean;
}

export interface WorldLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  category: WorldLabelCategory;
  fontFamily: string;
  fontSizePx: number;
  colorHex: string;
  outlineColorHex: string;
  outlineWidth: number;
  letterSpacing: number;
  italic: boolean;
  bold: boolean;
  uppercase: boolean;
  rotationDeg: number;
  curveBend: number; // -1..+1 arc bend
  boxStyle: WorldLabelBoxStyle;
  opacity: number;
  dmOnly?: boolean;
  /** Optional drop-shadow color for dramatic ocean or display titles */
  shadowColorHex?: string;
  /** Line-height multiplier for multi-line (`\n`) labels (default 1.14) */
  lineHeight?: number;
}

export interface WorldLegendEntry {
  label: string;
  style: WorldTrailStyle;
  colorHex: string;
  dashScale?: number;
}

export interface WorldLegendOverlay {
  visible: boolean;
  x: number;
  y: number;
  title?: string;
  entries: WorldLegendEntry[];
}

export interface WorldTraceOverlay {
  visible: boolean;
  imageUrl: string;
  opacity: number;
  aboveLand: boolean;
  scale: number;
  offsetXCells: number;
  offsetYCells: number;
}

export interface WorldSubMapPin {
  id: string;
  label: string;
  x: number;
  y: number;
  targetDocId?: string;
  targetKind: "world_detail" | "battlemap";
  bounds?: { x0: number; y0: number; x1: number; y1: number };
  colorHex: string;
}

export interface WorldCartographyOverlays {
  compass: {
    visible: boolean;
    x: number;
    y: number;
    scale: number;
    assetId: string;
    rotationDeg: number;
    showRhumbLines: boolean;
    rhumbOpacity: number;
  };
  scaleBar: {
    visible: boolean;
    x: number;
    y: number;
    unit: "miles" | "km" | "leagues";
    milesPerCell: number;
    segments: number;
    style: "classic" | "double_bar" | "minimal";
  };
  grid: {
    style: WorldGridStyle;
    cellSizeCells: number;
    opacity: number;
    colorHex: string;
    showCoords: boolean;
  };
  frame: {
    style: WorldFrameStyle;
    colorHex: string;
    widthPx: number;
  };
  travelMode: WorldTravelMode;
  legend?: WorldLegendOverlay;
  traceOverlay?: WorldTraceOverlay;
}

export interface WorldMapData {
  themeId: string;
  theme: WorldThemeConfig;
  gridW: number; // e.g. 240
  gridH: number; // e.g. 135
  /** Base64-encoded Uint8Array(gridW * gridH) heightfield: >= 128 is land, < 128 is ocean. */
  heightmapB64: string;
  /** Optional Base64-encoded Uint8Array(gridW * gridH) freshwater inland lake mask (> 127 is freshwater). */
  freshwaterB64?: string;
  /** Optional data-URL (WebP/PNG) base painted biome watercolor raster (e.g. imported from Wonderdraft ground layer), clipped strictly to dry land underneath editable biomeStrokes. */
  biomeRasterB64?: string;
  seaLevel: number; // default 128
  seed: number;
  coastlineRoughness: number; // 0..1 micro-fractal edge detail
  biomeStrokes: WorldBiomeStroke[];
  rivers: WorldRiver[];
  trails: WorldTrail[];
  regions: WorldRegion[];
  labels: WorldLabel[];
  subMapPins: WorldSubMapPin[];
  overlays: WorldCartographyOverlays;
}

export interface DcMapDocument {
  schemaVersion: "1.0.0";
  id: string;
  mode: MapMode;
  meta: {
    title: string;
    author: string;
    createdAt: string;
    updatedAt: string;
  };
  canvas: {
    widthCells: number;
    heightCells: number;
    ppi: number;
    baseTerrainAssetId: string;
    baseTerrainImportedRef?: string;
    /** When true, 1F ground renders as transparent alpha void (for ships, airships, floating islands & VTT cutouts) */
    baseTerrainTransparent?: boolean;
    grid: {
      type: GridType;
      visible: boolean;
      colorHex: string;
      opacity: number;
    };
  };
  levels: MapLevel[];
  activeLevelId: string;
  layers: MapLayer[];
  activeLayerId: string;
  lighting: {
    enabled: boolean;
    activePresetId: string;
    ambientColorHex: string;
    ambientIntensity: number;
    shadowSoftness: number;
    presets: LightingPreset[];
  };
  /** Populated when `mode === "world"` (Wonderdraft-parity overland atlas state). */
  world?: WorldMapData;
}

export interface TvCalibration {
  diagonalInches: number;
  resolutionWidth: number;
  resolutionHeight: number;
  exactPpi: number;
  physicalWidthInches: number;
  physicalHeightInches: number;
  recommendedGridCols: number;
  recommendedGridRows: number;
}

export interface AppPreferences {
  defaultPpi: number;
  defaultTvDiagonal: number;
  defaultTvWidth: number;
  defaultTvHeight: number;
  snapMode: SnapMode;
  wheelZoomSpeed: number;
  invertZoom: boolean;
  vramBudgetMb: number;
  shadowRayQuality: "standard" | "high" | "ultra";
  exportTileSize: 1024 | 2048 | 4096;
  autosaveMinutes: number;
  showCanvasMetrics: boolean;
  showToolHints: boolean;
  watchFoldersLive: boolean;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  defaultPpi: 256,
  defaultTvDiagonal: 55,
  defaultTvWidth: 3840,
  defaultTvHeight: 2160,
  snapMode: "half",
  wheelZoomSpeed: 1.0,
  invertZoom: false,
  vramBudgetMb: 1024,
  shadowRayQuality: "high",
  exportTileSize: 2048,
  autosaveMinutes: 3,
  showCanvasMetrics: true,
  showToolHints: true,
  watchFoldersLive: true,
};

export type ObjectTemplateCategory =
  | "saved"
  | "water_ships"
  | "camp_wilds"
  | "magipunk"
  | "interiors";

export interface ObjectTemplateItem {
  assetId: string;
  dx: number; // Offset from template centroid in grid cells
  dy: number;
  widthCells: number;
  heightCells: number;
  rotationRad: number;
  flipX?: boolean;
  flipY?: boolean;
  opacity?: number;
  castsShadow?: boolean;
  recolor?: RgbRecolor;
  zOrder?: number;
}

export interface ObjectTemplate {
  id: string;
  name: string;
  category: ObjectTemplateCategory;
  description: string;
  accentHex: string;
  items: ObjectTemplateItem[];
  isBuiltIn?: boolean;
  createdAt: string;
}

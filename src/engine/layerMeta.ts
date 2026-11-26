import { getCaveThemePreset } from "@/engine/caveEngine";
import { getRoofPresetByAssetId } from "@/engine/roofEngine";
import { getWaterPreset } from "@/engine/waterEngine";
import type { DcMapDocument, LayerKind, MapLayer, MapLevel, ToolId, VaultAsset } from "@/types/map";

/** Canonical bottom-to-top rendering order for layer kinds within a single floor band. */
export const LAYER_KIND_STACK_ORDER: Record<LayerKind, number> = {
  group: 0,
  terrain: 10,
  water: 20,
  caves: 30,
  paths: 40,
  walls: 50,
  objects: 60,
  scatter_zone: 65,
  roofs: 70,
  lights: 80,
  dm_notes: 90,
};

export interface LayerKindMeta {
  kind: LayerKind;
  label: string;
  shortLabel: string;
  color: string;
  iconKey:
    | "terrain"
    | "caves"
    | "water"
    | "walls"
    | "paths"
    | "roofs"
    | "objects"
    | "scatter_zone"
    | "lights"
    | "dm_notes"
    | "group";
}

export const LAYER_KIND_META: Record<LayerKind, LayerKindMeta> = {
  terrain: {
    kind: "terrain",
    label: "Terrain & Floors",
    shortLabel: "TERRAIN",
    color: "#4ADE80",
    iconKey: "terrain",
  },
  caves: {
    kind: "caves",
    label: "Caves & Dungeons",
    shortLabel: "CAVE",
    color: "#6EE7B7",
    iconKey: "caves",
  },
  water: {
    kind: "water",
    label: "Water & Biomes",
    shortLabel: "WATER",
    color: "#38BDF8",
    iconKey: "water",
  },
  walls: {
    kind: "walls",
    label: "Walls & Portals",
    shortLabel: "WALLS",
    color: "#F59E0B",
    iconKey: "walls",
  },
  paths: {
    kind: "paths",
    label: "Paths & Cliffs",
    shortLabel: "PATHS",
    color: "#94A3B8",
    iconKey: "paths",
  },
  roofs: {
    kind: "roofs",
    label: "Roofs & Overhangs",
    shortLabel: "ROOFS",
    color: "#FB923C",
    iconKey: "roofs",
  },
  objects: {
    kind: "objects",
    label: "Props & Objects",
    shortLabel: "PROPS",
    color: "#C084FC",
    iconKey: "objects",
  },
  scatter_zone: {
    kind: "scatter_zone",
    label: "Scatter Foliage",
    shortLabel: "SCATTER",
    color: "#A3E635",
    iconKey: "scatter_zone",
  },
  lights: {
    kind: "lights",
    label: "Lights & Glow",
    shortLabel: "LIGHTS",
    color: "#FACC15",
    iconKey: "lights",
  },
  dm_notes: {
    kind: "dm_notes",
    label: "DM Secret Notes",
    shortLabel: "DM",
    color: "#F87171",
    iconKey: "dm_notes",
  },
  group: {
    kind: "group",
    label: "Layer Group",
    shortLabel: "GROUP",
    color: "#CBD5E1",
    iconKey: "group",
  },
};

export function getLayerKindMeta(kind: LayerKind): LayerKindMeta {
  return LAYER_KIND_META[kind] ?? LAYER_KIND_META.objects;
}

export function toolToLayerKind(tool: ToolId): LayerKind | null {
  switch (tool) {
    case "terrain":
      return "terrain";
    case "cave":
      return "caves";
    case "water":
      return "water";
    case "wall":
    case "portal":
      return "walls";
    case "path":
      return "paths";
    case "roof":
      return "roofs";
    case "stamp":
    case "template":
      return "objects";
    case "scatter":
      return "scatter_zone";
    case "light":
      return "lights";
    case "dm_note":
      return "dm_notes";
    case "select":
    case "measure":
    default:
      return null;
  }
}

export function findPreferredLayerForKind(doc: DcMapDocument, kind: LayerKind): MapLayer | null {
  const active = doc.layers.find((l) => l.id === doc.activeLayerId);
  if (
    active &&
    active.kind === kind &&
    active.levelId === doc.activeLevelId &&
    active.visible &&
    !active.locked
  ) {
    return active;
  }
  return (
    doc.layers.find(
      (l) =>
        l.kind === kind &&
        l.levelId === doc.activeLevelId &&
        l.visible &&
        !l.locked,
    ) ?? null
  );
}

function plural(count: number, singular: string, pluralWord?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralWord ?? `${singular}s`}`;
}

export function describeLayerContents(layer: MapLayer): {
  summary: string;
  tooltip: string;
  totalCount: number;
} {
  const meta = getLayerKindMeta(layer.kind);
  const parts: string[] = [];
  let totalCount = 0;

  const terrainCount = layer.terrainStrokes?.length ?? 0;
  if (terrainCount > 0) {
    totalCount += terrainCount;
    parts.push(plural(terrainCount, "terrain fill"));
  }

  const caveOps = layer.caveSystem?.operations.length ?? 0;
  const caveEnts = layer.caveSystem?.entrances.length ?? 0;
  if (caveOps > 0 || caveEnts > 0) {
    totalCount += caveOps + caveEnts;
    const entText = caveEnts > 0 ? `, ${plural(caveEnts, "entrance")}` : "";
    parts.push(`${plural(caveOps, "cave shape")}${entText}`);
  }

  const waterCount = layer.waterRegions?.length ?? 0;
  if (waterCount > 0) {
    totalCount += waterCount;
    const islandCount =
      layer.waterRegions?.reduce((acc, w) => acc + (w.cutouts?.length ?? 0), 0) ?? 0;
    const islandText = islandCount > 0 ? ` (${plural(islandCount, "island")})` : "";
    parts.push(`${plural(waterCount, "water body", "water bodies")}${islandText}`);
  }

  const wallCount = layer.walls?.length ?? 0;
  const portalCount = layer.portals?.length ?? 0;
  if (wallCount > 0 || portalCount > 0) {
    totalCount += wallCount + portalCount;
    if (wallCount > 0) parts.push(plural(wallCount, "wall"));
    if (portalCount > 0) parts.push(plural(portalCount, "door/window", "doors/windows"));
  }

  const pathCount = layer.paths?.length ?? 0;
  if (pathCount > 0) {
    totalCount += pathCount;
    parts.push(plural(pathCount, "path"));
  }

  const roofCount = layer.roofs?.length ?? 0;
  if (roofCount > 0) {
    totalCount += roofCount;
    parts.push(plural(roofCount, "roof"));
  }

  const objectCount = layer.objects?.length ?? 0;
  if (objectCount > 0) {
    totalCount += objectCount;
    parts.push(plural(objectCount, "prop"));
  }

  const scatterCount = layer.scatterZones?.length ?? 0;
  if (scatterCount > 0) {
    totalCount += scatterCount;
    const placedCount =
      layer.scatterZones?.reduce((acc, z) => acc + (z.placements?.length ?? 0), 0) ?? 0;
    const placedText = placedCount > 0 ? ` (${plural(placedCount, "item")})` : "";
    parts.push(`${plural(scatterCount, "scatter zone")}${placedText}`);
  }

  const lightCount = layer.lights?.length ?? 0;
  if (lightCount > 0) {
    totalCount += lightCount;
    parts.push(plural(lightCount, "light"));
  }

  const noteCount = layer.dmNotes?.length ?? 0;
  if (noteCount > 0) {
    totalCount += noteCount;
    parts.push(plural(noteCount, "DM note"));
  }

  const summary = parts.length > 0 ? parts.join(", ") : "Empty";
  const dmSuffix = layer.dmOnly ? " (DM-Only)" : "";
  const tooltip = `${layer.name}\n${meta.label} · ${summary}${dmSuffix}`;
  return { summary, tooltip, totalCount };
}

const DEFAULT_LAYER_BASE_NAMES: Record<LayerKind, string> = {
  terrain: "Terrain",
  caves: "Caves",
  water: "Water",
  walls: "Walls & Doors",
  paths: "Paths & Lines",
  roofs: "Roofs",
  objects: "Props",
  scatter_zone: "Scatter Foliage",
  lights: "Lights",
  dm_notes: "DM Notes",
  group: "Group",
};

/**
 * Generates a concise, non-colliding default name for a new layer on a floor
 * (no redundant floor prefix since every row shows its color-coded floor badge).
 */
export function getNextDefaultLayerName(
  doc: DcMapDocument,
  kind: LayerKind,
  levelId: string,
): string {
  const base = DEFAULT_LAYER_BASE_NAMES[kind] ?? "Layer";
  const sameFloor = doc.layers.filter((l) => l.levelId === levelId);
  const existingNames = new Set(sameFloor.map((l) => l.name.trim().toLowerCase()));
  const sameKindCount = sameFloor.filter((l) => l.kind === kind).length;

  if (sameKindCount === 0 && !existingNames.has(base.toLowerCase())) {
    return base;
  }

  let n = Math.max(2, sameKindCount + 1);
  while (existingNames.has(`${base} ${n}`.toLowerCase())) {
    n++;
  }
  return `${base} ${n}`;
}

function cleanAssetShortName(assetId: string, assetLookup?: Map<string, VaultAsset>): string {
  const display = assetLookup?.get(assetId)?.displayName;
  if (display) {
    return display.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  }
  const stem = assetId.split("/").pop()?.replace(/\.[^.]+$/, "") ?? assetId;
  return stem
    .replace(/^(terrain|wall|path|portal|water|prop|skyship|ship|modular|shore|embankment)_+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function clampLayerLabel(raw: string, maxLen = 24): string {
  const clean = raw.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  // Try trimming at a word boundary
  const cut = clean.slice(0, maxLen).replace(/\s+\S*$/, "").trim();
  return cut.length >= 6 ? cut : clean.slice(0, maxLen).trim();
}

function topUniqueLabels(items: string[], maxItems = 2): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const clean = item.trim();
    if (!clean) continue;
    counts.set(clean, (counts.get(clean) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([label]) => label);
}

/**
 * Infers a short, accurate layer name directly from the layer's actual contents.
 */
export function suggestLayerNameFromContents(
  layer: MapLayer,
  assetLookup?: Map<string, VaultAsset>,
): string {
  if (layer.kind === "dm_notes") {
    const count = layer.dmNotes?.length ?? 0;
    return count > 0 ? "DM Notes" : "DM Notes";
  }

  if (layer.kind === "water") {
    const regions = layer.waterRegions ?? [];
    if (regions.length === 0) return "Water";
    const labels = topUniqueLabels(
      regions.map((r) => {
        if (r.presetId) {
          const preset = getWaterPreset(r.presetId);
          if (preset?.shortLabel || preset?.name) return preset.shortLabel || preset.name;
        }
        if (r.kind === "chasm") return "Chasm Abyss";
        if (r.kind === "lava") return "Lava Flow";
        if (r.kind === "swamp") return "Swamp";
        if (r.kind === "ice") return "Frozen Ice";
        return r.shape === "river" ? "River" : "Lake Water";
      }),
      2,
    );
    return clampLayerLabel(labels.join(" & ") || "Water");
  }

  if (layer.kind === "caves") {
    const ops = layer.caveSystem?.operations.length ?? 0;
    if (ops === 0) return "Caves";
    const themeId = layer.caveSystem?.themeId;
    const preset = themeId ? getCaveThemePreset(themeId) : null;
    const themeLabel = preset?.shortName || preset?.name;
    return clampLayerLabel(themeLabel ? `${themeLabel} Cave` : "Cave System");
  }

  if (layer.kind === "terrain") {
    const strokes = layer.terrainStrokes ?? [];
    if (strokes.length === 0) return "Terrain";
    const top = topUniqueLabels(
      strokes.map((s) => cleanAssetShortName(s.assetId, assetLookup)),
      2,
    );
    if (top.length === 1) return clampLayerLabel(top[0]);
    if (top.length >= 2) {
      const joined = `${top[0]} & ${top[1]}`;
      return joined.length <= 24 ? joined : clampLayerLabel(top[0]);
    }
    return "Terrain";
  }

  if (layer.kind === "walls") {
    const walls = layer.walls ?? [];
    const portals = layer.portals ?? [];
    if (walls.length === 0 && portals.length === 0) return "Walls & Doors";
    if (walls.length > 0 && portals.length > 0) return "Walls & Portals";
    if (walls.length > 0) {
      const top = topUniqueLabels(walls.map((w) => cleanAssetShortName(w.assetId, assetLookup)), 1);
      return clampLayerLabel(top[0] || "Walls");
    }
    return "Doors & Windows";
  }

  if (layer.kind === "paths") {
    const paths = layer.paths ?? [];
    if (paths.length === 0) return "Paths & Lines";
    const top = topUniqueLabels(paths.map((p) => cleanAssetShortName(p.assetId, assetLookup)), 2);
    if (top.length >= 2 && `${top[0]} & ${top[1]}`.length <= 24) {
      return `${top[0]} & ${top[1]}`;
    }
    return clampLayerLabel(top[0] || "Paths & Lines");
  }

  if (layer.kind === "roofs") {
    const roofs = layer.roofs ?? [];
    if (roofs.length === 0) return "Roofs";
    const top = topUniqueLabels(
      roofs.map((r) => getRoofPresetByAssetId(r.assetId).shortLabel),
      2,
    );
    if (top.length >= 2 && `${top[0]} & ${top[1]}`.length <= 24) {
      return `${top[0]} & ${top[1]}`;
    }
    return clampLayerLabel(top[0] ? `${top[0]} Roofs` : "Roofs");
  }

  if (layer.kind === "scatter_zone") {
    const zones = layer.scatterZones ?? [];
    if (zones.length === 0) return "Scatter Foliage";
    if (zones.length === 1 && zones[0].name.trim()) {
      return clampLayerLabel(zones[0].name);
    }
    return "Scatter Foliage";
  }

  if (layer.kind === "lights") {
    const lights = layer.lights ?? [];
    if (lights.length === 0) return "Lights";
    if (lights.length === 1 && lights[0].name.trim()) {
      return clampLayerLabel(lights[0].name);
    }
    return "Lights & Glow";
  }

  if (layer.kind === "objects") {
    const objs = layer.objects ?? [];
    if (objs.length === 0) return "Props";
    const cats = topUniqueLabels(
      objs.map((o) => {
        const asset = assetLookup?.get(o.assetId);
        if (asset?.tags?.[0]) {
          const t = asset.tags[0];
          return t.charAt(0).toUpperCase() + t.slice(1);
        }
        return cleanAssetShortName(o.assetId, assetLookup);
      }),
      2,
    );
    if (cats.length >= 2 && `${cats[0]} & ${cats[1]} Props`.length <= 24) {
      return `${cats[0]} & ${cats[1]} Props`;
    }
    if (cats.length >= 1) {
      const base = cats[0].toLowerCase().includes("prop") ? cats[0] : `${cats[0]} Props`;
      return clampLayerLabel(base);
    }
    return "Props";
  }

  return DEFAULT_LAYER_BASE_NAMES[layer.kind] ?? "Layer";
}

/**
 * Exact-match migration table for legacy verbose built-in map layer names.
 * Only upgrades a layer when BOTH its built-in id and untouched old default name match,
 * preserving any custom renames made by the user.
 */
const LEGACY_BUILTIN_LAYER_RENAMES: Record<string, string> = {
  // Hidden Sloop Map
  "hs-layer-b1-terrain::B1 Submerged Lakebed & Sloop Lower Hull Deck": "Lakebed & Lower Deck",
  "hs-layer-b1-water::B1 Deep Underwater Lake Veil": "Deep Underwater Veil",
  "hs-layer-b1-walls::B1 Riveted Lower Hull & Bulkheads": "Lower Hull Bulkheads",
  "hs-layer-b1-objects::B1 Aether Furnace Core, Smuggler Hold & Master Stateroom": "Engine, Hold & Cabin",
  "hs-layer-b1-lights::B1 Aether Furnace & Cabin Lamps": "Engine & Cabin Lights",
  "hs-layer-shore-terrain::1F Cliff Slate, Camp Clearing & Shingle Cove Beach": "Shore, Cliffs & Beach",
  "hs-layer-lake-water::1F Moonshadow Tarn & Forest Waterfall (Water Studio)": "Moonshadow Tarn",
  "hs-layer-sloop-deck-terrain::1F Sloop Mahogany Inlay Deck & Brass Aether Grating": "Sloop Main Deck",
  "hs-layer-paths::1F Cliff Rims, Forest Trail, Anchor Chain & Shore Haul-Line": "Cliffs, Trail & Chains",
  "hs-layer-walls::1F Sloop Brass-Aether Hull & Deckhouse Walls": "Sloop Hull & Cabin",
  "hs-layer-scatter::1F Forest Ferns, Brambles & Mossy Understory": "Forest Understory",
  "hs-layer-objects::1F Hidden Camp, Beached Dinghy, Aquatic Life & H.M.S. Gilded Moth": "Camp, Lake & Sloop",
  "hs-layer-lights::1F Campfire, Hooded Lanterns & Idling Aether Glow": "Camp & Sloop Lights",
  "hs-layer-2f-terrain::2F Varnished Deckhouse Roof": "Deckhouse Roof",
  "hs-layer-2f-walls::2F Deckhouse Roof Carved Railings": "Deckhouse Railings",
  "hs-layer-2f-objects::2F Camouflage Branches, Searchlight, Lifepod & Crow's Nest": "Camouflage & Mast",
  "hs-layer-2f-lights::2F Deckhouse Roof Searchlight Beam": "Roof Searchlight",
  "hs-layer-roof-sails::ROOF Deployed Lateen Aether-Wing Sloop Rigging": "Deployed Sloop Sails",

  // Lake Yacht Map
  "ly-layer-b1-water::B1 Submerged Alpine Lakebed": "Underwater Lakebed",
  "ly-layer-b1-terrain::B1 Yacht Lower Hull Decking": "Lower Hull Deck",
  "ly-layer-b1-walls::B1 Lower Hull & Stateroom Bulkheads": "Lower Hull Bulkheads",
  "ly-layer-b1-objects::B1 Aether Engine, Wine Cellar & Master Suite": "Engine, Cellar & Suite",
  "ly-layer-b1-lights::B1 Engine Core & Cabin Lanterns": "Engine & Cabin Lights",
  "ly-layer-shore-terrain::1F Meadow, Pine Moss & Wet Sandy Beach": "Meadow, Beach & Floor",
  "ly-layer-lake-water::1F Mirrorlake & Forest Feeder Creek (Water Studio)": "Mirrorlake & Creek",
  "ly-layer-dock-and-hull::1F Timber Pier & S.Y. Aurelia Weather Deck": "Pier & Yacht Deck",
  "ly-layer-paths::1F Shoreline Foam, Rapids, Trails & Mooring Lines": "Foam, Trails & Lines",
  "ly-layer-walls::1F Boathouse & Ivory Yacht Hull Bulkheads": "Boathouse & Yacht Hull",
  "ly-layer-scatter::1F Lakeside Meadow Wildflowers & Ferns": "Meadow Wildflowers",
  "ly-layer-objects::1F Aquatic Life, Ripples, Pier & S.Y. Aurelia": "Shore, Pier & Yacht",
  "ly-layer-lights::1F Golden Hour Lanterns, Beacon & Aether Glow": "Shore & Yacht Lights",
  "ly-layer-2f-decks::2F Yacht Upper Sun-Deck & Boathouse Roof": "Sun-Deck & Roof",
  "ly-layer-2f-walls::2F Flybridge Carved Railings": "Flybridge Railings",
  "ly-layer-2f-objects::2F Flybridge Helm, Twin Sun-Loungers & Furled Sail": "Flybridge & Loungers",
  "ly-layer-2f-lights::2F Flybridge Brass Navigation Lamps": "Flybridge Lamps",
  "ly-layer-roof-decks::ROOF Boathouse Slate Roof & Flybridge Base": "Boathouse Slate Roof",
  "ly-layer-roof-sails::ROOF Deployed Aether-Sails & Crow's Nest": "Deployed Yacht Sails",

  // Blank Map legacy names
  "layer-terrain::Terrain Splat": "Ground Terrain",
  "layer-chasm::Under-City Abyss & Canals": "Water & Canals",
  "layer-paths::Tracks, Conduits & Streets": "Paths & Roads",
  "layer-walls::Walls & Inset Portals": "Walls & Doors",
  "layer-scatter::Urban Scatter Zones": "Scatter Foliage",
  "layer-objects::Funicular Cars & Urban Props": "Props & Objects",
  "layer-lights::Lighting & Shadows": "Lights & Glow",

  // Berlin Funicular Showcase
  "layer-b1-terrain::B1 Smuggler Cellars & Undercroft Floors": "Cellars & Undercroft",
  "layer-b1-water::B1 Flooded Sewer & Ley-Line Cistern": "Sewer & Cistern",
  "layer-b1-paths::B1 Smuggler Catwalks & Ley-Line Mains": "Catwalks & Mains",
  "layer-b1-walls::B1 Brick Vaults, Sewers & Bulkhead Hatches": "Vault & Sewer Walls",
  "layer-b1-objects::B1 Contraband, Piers & Subterranean Machinery": "Contraband & Machinery",
  "layer-b1-lights::B1 Subterranean Lanterns & Ley Glow": "Cellar & Ley Lights",
  "layer-terrain::District Streets & Floors": "Streets & Floors",
  "layer-chasm::Under-City Tenement Abyss (80ft Drop)": "Under-City Abyss",
  "layer-embankment::Steep Escarpment Slope (East → West)": "Escarpment Slope",
  "layer-embankment-cliffs::Stepped Embankment Retaining Walls": "Retaining Walls",
  "layer-embankment-landings::Escarpment Terrace Landings & Gantry": "Terrace Landings",
  "layer-viaduct::Hochbahn Steel Viaduct & Piers": "Steel Viaduct",
  "layer-paths::Magi-Rail Tracks, Conduits & Catwalks": "Tracks & Conduits",
  "layer-scatter::Unterstadt Alley Clutter": "Alley Clutter",
  "layer-objects::Funicular Cars, Aether Tech & City Props": "Funicular & City Props",
  "layer-funicular-cables::Funicular Haulage Cable & Bullwheel Wrap": "Haulage Cables",
  "layer-floor2-slabs::2F Floor Slabs (Tenement Loft & VIP Mezzanine)": "Loft & Mezzanine",
  "layer-floor2-balcony::2F Mezzanine Observation Catwalk": "Mezzanine Catwalk",
  "layer-floor2-walls::2F Walls, Balconies & Sniper Windows": "Upper Walls & Rails",
  "layer-floor2-objects::2F Furnishings & Stair Landings": "Loft Furnishings",
  "layer-floor2-lights::2F Interior Lamps & Mezzanine Chandelier": "Upper Interior Lights",
  "layer-roofs::Roofs (Tenements, Carriages & Glass Dome)": "Roofs & Glass Dome",
  "layer-lights::Lighting & Arcane Shadows": "Street & Arcane Lights",

  // Skyship Showcase Layers
  "layer-skyh-decks::Sky 1 · Lower Hold Decks": "Lower Hold Decks",
  "layer-skyh-paths::Sky 1 · Keel & Reactor Pipes": "Keel & Reactor Pipes",
  "layer-skyh-hulls::Sky 1 · Lower Hulls, Brig & Bulkheads": "Lower Hull & Brig",
  "layer-skyh-props::Sky 1 · Hold Cargo, Bunks & Reactor": "Hold Cargo & Reactor",
  "layer-skyh-lights::Sky 1 · Lower Deck & Reactor Glow": "Hold & Reactor Glow",
  "layer-skyh-dm-notes::Sky 1 · Lower Hold Encounter Notes": "Lower Hold Notes",
  "layer-sky-decks::Sky 2 · Airship Hull Decks": "Airship Main Decks",
  "layer-sky-rigging::Sky 2 · Conduits, Chains & Rigging": "Chains & Rigging",
  "layer-sky-hulls::Sky 2 · Hull Walls & Portals": "Hull Walls & Doors",
  "layer-sky-props::Sky 2 · Airship Props & Interiors": "Airship Interiors",
  "layer-sky-lights::Sky 2 · Searchlights & Engine Glow": "Searchlights & Glow",
  "layer-sky-dm-notes::Sky 2 · Aerial Encounter Notes": "Aerial Notes",
  "layer-skyu-decks::Sky 3 · Upper Poop-Deck Roofs": "Upper Deck Roofs",
  "layer-skyu-rigging::Sky 3 · Aerial Rigging Catwalks": "Rigging Catwalks",
  "layer-skyu-rails::Sky 3 · Poop-Deck Railings": "Upper Deck Railings",
  "layer-skyu-props::Sky 3 · Crow's Nests, Sails & Turrets": "Sails, Nests & Turrets",
  "layer-skyu-lights::Sky 3 · Spire & Lookout Lights": "Spire & Lookout Lights",
  "layer-skyu-dm-notes::Sky 3 · High-Ground Encounter Notes": "Upper Deck Notes",
};

export function upgradeLegacyLayerName(layerId: string, name: string): string {
  const direct = LEGACY_BUILTIN_LAYER_RENAMES[`${layerId}::${name}`];
  if (direct) return direct;
  // Also catch unprefixed variants of legacy built-in names (e.g. "Moonshadow Tarn & Forest Waterfall (Water Studio)")
  for (const prefix of ["1F ", "2F ", "B1 ", "ROOF ", "Sky 1 · ", "Sky 2 · ", "Sky 3 · "]) {
    const withPrefix = LEGACY_BUILTIN_LAYER_RENAMES[`${layerId}::${prefix}${name}`];
    if (withPrefix) return withPrefix;
  }
  return name;
}

/**
 * Resolves the adjacent architectural reference level for Onion-Skin ("Ghost") blueprints:
 *  - Underground (B1..B3): looks UP at the level directly above (1F, B1, B2)
 *  - Ground (1F): peeks DOWN at B1 if present, otherwise UP at 2F
 *  - Upper (2F..5F): looks DOWN at the floor directly below (1F, 2F..4F)
 *  - Roof (ROOF): looks DOWN at the highest interior/ground floor below (fixes ROOF ghost!)
 *  - Sky (Sky 1..N): looks DOWN at the deck directly below, or ROOF from Sky 1
 */
export function getOnionSkinReferenceLevel(doc: DcMapDocument): MapLevel | null {
  const activeLevel = doc.levels.find((lv) => lv.id === doc.activeLevelId);
  if (!activeLevel) return null;

  if (activeLevel.kind === "sky") {
    const skySorted = [...doc.levels]
      .filter((lv) => lv.kind === "sky")
      .sort((a, b) => a.elevationFt - b.elevationFt);
    const sIdx = skySorted.findIndex((lv) => lv.id === activeLevel.id);
    if (sIdx > 0) return skySorted[sIdx - 1];
    // Lowest sky deck peeks down at roofs or highest upper/ground floor
    const roofs = [...doc.levels]
      .filter((lv) => lv.kind === "roof")
      .sort((a, b) => b.elevationFt - a.elevationFt);
    if (roofs.length > 0) return roofs[0];
    if (sIdx >= 0 && sIdx + 1 < skySorted.length) return skySorted[sIdx + 1];
    return null;
  }

  const buildingSorted = [...doc.levels]
    .filter((lv) => lv.kind !== "roof" && lv.kind !== "sky")
    .sort((a, b) => a.elevationFt - b.elevationFt);

  if (activeLevel.kind === "roof") {
    const aboveOrGround = buildingSorted.filter(
      (lv) => lv.kind === "upper" || lv.kind === "ground",
    );
    return aboveOrGround.length > 0 ? aboveOrGround[aboveOrGround.length - 1] : null;
  }

  const idx = buildingSorted.findIndex((lv) => lv.id === activeLevel.id);
  if (idx < 0) return null;

  if (activeLevel.kind === "underground") {
    return idx + 1 < buildingSorted.length ? buildingSorted[idx + 1] : null;
  }
  if (activeLevel.kind === "upper") {
    return idx > 0 ? buildingSorted[idx - 1] : null;
  }
  // Ground (1F): prefer B1 below; if no basement exists, peek up at 2F
  if (idx > 0) return buildingSorted[idx - 1];
  return idx + 1 < buildingSorted.length ? buildingSorted[idx + 1] : null;
}

export function getOnionSkinDirection(active: MapLevel, ref: MapLevel): "up" | "down" {
  return ref.elevationFt > active.elevationFt ? "up" : "down";
}

export interface LevelSummary {
  layerCount: number;
  visibleLayerCount: number;
  lockedLayerCount: number;
  totalEntities: number;
  hasDmNotes: boolean;
  allVisible: boolean;
  allLocked: boolean;
}

export function summarizeLevel(doc: DcMapDocument, levelId: string): LevelSummary {
  let layerCount = 0;
  let visibleLayerCount = 0;
  let lockedLayerCount = 0;
  let totalEntities = 0;
  let hasDmNotes = false;

  for (const l of doc.layers) {
    if (l.levelId !== levelId) continue;
    layerCount++;
    if (l.visible) visibleLayerCount++;
    if (l.locked) lockedLayerCount++;
    const info = describeLayerContents(l);
    totalEntities += info.totalCount;
    if ((l.dmNotes?.length ?? 0) > 0) hasDmNotes = true;
  }

  return {
    layerCount,
    visibleLayerCount,
    lockedLayerCount,
    totalEntities,
    hasDmNotes,
    allVisible: layerCount > 0 && visibleLayerCount === layerCount,
    allLocked: layerCount > 0 && lockedLayerCount === layerCount,
  };
}

import { useMemo } from "react";
import { create } from "zustand";
import { loadStarterVaultData } from "@/data/starterVault";
import { isNativeColorableAsset } from "@/engine/colorShader";
import { importWonderdraftZipBytes } from "@/engine/wonderdraftImport";
import type {
  AssetCategory,
  BiomeKit,
  ObjectTemplateCategory,
  VaultAsset,
  VaultSource,
  WorldAssetGroup,
} from "@/types/map";

export type WorldDrawModeFilter =
  | "all"
  | "normal"
  | "sample_color"
  | "tint"
  | "rgb_channels";

export type VaultSortMode =
  | "curated"
  | "harmony_first"
  | "name_asc"
  | "name_desc"
  | "favorites"
  | "recent"
  | "size_desc"
  | "size_asc"
  | "color_hue";

export const VAULT_SORT_OPTIONS: Array<{ id: VaultSortMode; label: string }> = [
  { id: "curated", label: "Smart Curated" },
  { id: "harmony_first", label: "Studio Harmony First" },
  { id: "name_asc", label: "Name (A → Z)" },
  { id: "name_desc", label: "Name (Z → A)" },
  { id: "favorites", label: "Favorites First" },
  { id: "recent", label: "Recently Used" },
  { id: "size_desc", label: "Size (Largest First)" },
  { id: "size_asc", label: "Size (Smallest First)" },
  { id: "color_hue", label: "Color Spectrum" },
];

export const WORLD_ASSET_GROUPS: Array<{ id: WorldAssetGroup; label: string }> = [
  { id: "mountains", label: "Mountains & Hills" },
  { id: "trees", label: "Forests & Trees" },
  { id: "settlements", label: "Cities & Castles" },
  { id: "landmarks", label: "Ruins & POIs" },
  { id: "maritime", label: "Ships & Sea Monsters" },
  { id: "cartography", label: "Compasses & Banners" },
];

export type ObjectSubGroupId =
  | "lighting"
  | "weathering"
  | "bare"
  | "home"
  | "food"
  | "funeral"
  | "subterranean"
  | "dungeon"
  | "street"
  | "workshop"
  | "office"
  | "nature"
  | "water"
  | "ships"
  | "stairs"
  | "roofs"
  | "storage";

export interface ObjectSubGroupDef {
  id: ObjectSubGroupId;
  label: string;
  keywords: string[];
}

export const OBJECT_SUBGROUPS: ObjectSubGroupDef[] = [
  {
    id: "lighting",
    label: "Lighting, Lamps & Fire",
    keywords: [
      "harmony_lighting",
      "lgt_",
      "lighting",
      "lamp",
      "sconce",
      "chandelier",
      "brazier",
      "lantern",
      "candelabra",
      "candle",
      "torch",
      "hearth",
      "campfire",
      "firepit",
      "streetlamp",
      "searchlight",
      "footlight",
      "spotlight",
      "fairy",
      "pendant",
      "torchiere",
      "vigil",
    ],
  },
  {
    id: "weathering",
    label: "Grime, Wear & Overlays",
    keywords: [
      "weathering_overlays",
      "wth_",
      "dec_",
      "weathering",
      "grime",
      "object_overlay",
      "overlay",
      "decal",
      "soot",
      "cinder",
      "grease",
      "oil_slick",
      "oil_stain",
      "mud",
      "silt",
      "seepage",
      "mildew",
      "rust_oxide",
      "rust_patina",
      "verdigris",
      "scuff",
      "stain",
      "splatter",
      "scorch",
      "crack",
      "fissure",
      "puddle",
      "cobweb",
      "moss_lichen",
      "lichen",
      "mortar",
      "repair_patch",
      "wax_puddle",
      "wax_drips",
      "rubble",
      "debris",
      "leaves_curb",
      "blood",
    ],
  },
  {
    id: "bare",
    label: "Furniture & Bare Bases",
    keywords: [
      "bare",
      "table",
      "desk",
      "counter",
      "bench",
      "stool",
      "chair",
      "shelf",
      "pedestal",
      "sideboard",
      "worktable",
      "sofa",
      "booth",
    ],
  },
  {
    id: "home",
    label: "Home, Parlor & Apartments",
    keywords: [
      "bedroom",
      "bath",
      "home",
      "mansion",
      "apartment",
      "messy_apartment",
      "bed",
      "rug",
      "carpet",
      "cushion",
      "pillow",
      "sofa",
      "divan",
      "wardrobe",
      "bathtub",
      "vanity",
      "quilt",
      "cat",
      "tea",
      "music",
      "theater",
      "festival",
      "chess",
      "harp",
      "piano",
      "gramophone",
      "laundry",
      "clothesline",
      "moving_box",
    ],
  },
  {
    id: "food",
    label: "Tavern, Bakery & Shops",
    keywords: [
      "bakery",
      "kitchen",
      "pantry",
      "tavern",
      "inn",
      "ice_cream",
      "sundae",
      "waffle",
      "parlor",
      "bread",
      "cake",
      "pie",
      "pastry",
      "food",
      "drink",
      "ale",
      "wine",
      "speakeasy",
      "poker",
      "brewery",
      "mash_tun",
      "moonshine",
      "still",
      "cookware",
      "skillet",
      "stove",
      "oven",
      "tableware",
      "plate",
      "bowl",
      "mug",
      "cheese",
      "market",
      "tailor",
      "cobbler",
      "mannequin",
      "vintner",
      "boulevard_shops",
      "shop",
      "fabric",
      "dye_vat",
    ],
  },
  {
    id: "funeral",
    label: "Temple, Crypt & Ritual",
    keywords: [
      "sovereign",
      "temple",
      "chapel",
      "cathedral",
      "altar",
      "pew",
      "pulpit",
      "chalice",
      "censer",
      "statue",
      "gargoyle",
      "funeral",
      "graveyard",
      "coffin",
      "tombstone",
      "headstone",
      "grave",
      "crypt",
      "sarcophagus",
      "ossuary",
      "urn",
      "wreath",
      "shrine",
      "ritual",
      "cult",
      "vigil",
    ],
  },
  {
    id: "subterranean",
    label: "Basements, Sewers & Caves",
    keywords: [
      "subterranean",
      "sub_",
      "basement",
      "cellar",
      "keller",
      "sewer",
      "cave",
      "cavern",
      "mining",
      "mine",
      "stalagmite",
      "grotto",
      "underdark",
      "crystal",
      "shroom",
      "mushroom",
      "tidepool",
      "sinkhole",
      "leyline",
      "sludge",
      "pump_gear",
      "ice_block",
      "cryo_brine",
      "potato_bin",
      "breached_masonry",
    ],
  },
  {
    id: "dungeon",
    label: "Dungeon, Gaol & Armory",
    keywords: [
      "watchtower",
      "garrison",
      "guard",
      "barracks",
      "battlement",
      "sandbag",
      "semaphore",
      "rangefinder",
      "armory",
      "dungeon",
      "prison",
      "gaol",
      "inquisition",
      "castle",
      "weapon",
      "sword",
      "shield",
      "armor",
      "trap",
      "shackles",
      "stocks",
      "interrogation",
      "barricade",
      "dynamite",
      "skull",
      "bones",
      "skeleton",
      "camp",
      "tent",
      "cage",
      "faraday",
    ],
  },
  {
    id: "street",
    label: "Streets, Parks & City",
    keywords: [
      "district_streets",
      "aged_streetcar_line",
      "streetcar",
      "neighborhood_park",
      "community_kid_theater",
      "theater",
      "puppet",
      "playbill",
      "chalk",
      "bunting",
      "street",
      "alley",
      "park",
      "playground",
      "swing",
      "sandbox",
      "fountain",
      "kiosk",
      "sign",
      "facade",
      "manhole",
      "drain",
      "grate",
      "crosswalk",
      "catenary",
      "semaphore",
      "hydrant",
      "cart",
      "wagon",
      "bike",
      "tram",
      "picnic",
      "garden_bed",
      "flower_bucket",
    ],
  },
  {
    id: "workshop",
    label: "Magi-Punk, Forge & Farm",
    keywords: [
      "magipunk",
      "aether",
      "dynamo",
      "funicular",
      "clockwork",
      "machinery",
      "boiler",
      "rail",
      "blacksmith",
      "forge",
      "anvil",
      "workshop",
      "tool",
      "ingot",
      "bellows",
      "farm",
      "stable",
      "barn",
      "hay",
      "saddle",
      "pumpkin",
      "wheelbarrow",
      "printing_press",
      "sewing",
    ],
  },
  {
    id: "office",
    label: "Office, Study & Arcane",
    keywords: [
      "post_office",
      "bank",
      "study",
      "school",
      "courtroom",
      "office",
      "library",
      "book",
      "ledger",
      "letter",
      "envelope",
      "parcel",
      "quill",
      "ink",
      "gavel",
      "chalkboard",
      "blueprint",
      "globe",
      "orrery",
      "doctor",
      "clinic",
      "medical",
      "apothecary",
      "alchemy",
      "arcane",
      "magic",
      "potion",
      "vial",
      "herb",
      "mortar",
      "surgical",
      "microscope",
      "rune",
      "grimoire",
      "scroll",
    ],
  },
  {
    id: "nature",
    label: "Trees, Bushes & Nature",
    keywords: [
      "tree",
      "oak",
      "pine",
      "birch",
      "maple",
      "willow",
      "palm",
      "bush",
      "shrub",
      "fern",
      "flower",
      "flora",
      "rock",
      "boulder",
      "stump",
      "log",
      "mushroom",
      "moss",
      "lichen",
      "roots",
      "wilderness",
      "garden",
      "meadow",
      "swamp",
      "pond",
    ],
  },
  {
    id: "water",
    label: "Water, Docks & Fishing",
    keywords: [
      "water_suite",
      "water",
      "lake",
      "river",
      "shore",
      "beach",
      "ripple",
      "foam",
      "wake",
      "caustics",
      "waterfall",
      "rapids",
      "lily",
      "lotus",
      "reeds",
      "cattail",
      "kelp",
      "koi",
      "trout",
      "pike",
      "swan",
      "duck",
      "turtle",
      "submerged",
      "lakebed",
      "pier",
      "dock",
      "jetty",
      "piling",
      "buoy",
      "fishing",
      "kayak",
      "canoe",
      "raft",
      "pontoon",
      "yacht",
      "bridge",
      "waterwheel",
      "sluice",
      "seawall",
    ],
  },
  {
    id: "ships",
    label: "Ships, Airships & Cargo",
    keywords: [
      "ship",
      "airship",
      "skyship",
      "shipbuilding",
      "shipyard",
      "boat",
      "nautical",
      "helm",
      "mast",
      "sail",
      "cannon",
      "anchor",
      "hull",
      "galley",
      "hammock",
      "propeller",
      "rowboat",
      "lifeboat",
      "figurehead",
      "capstan",
      "porthole",
      "gunport",
      "rigging",
      "drydock",
      "cargo",
    ],
  },
  {
    id: "stairs",
    label: "Stairs, Ladders & Hatches",
    keywords: [
      "stairs",
      "stair",
      "spiral",
      "ladder",
      "trapdoor",
      "hatch",
      "lift",
      "shaft",
      "bridge",
      "viaduct",
      "balcony",
      "pillar",
    ],
  },
  {
    id: "roofs",
    label: "Roofs, Chimneys & Awnings",
    keywords: [
      "roof",
      "shingle",
      "thatch",
      "dormer",
      "gable",
      "ridge",
      "chimney",
      "skylight",
      "awning",
      "canopy",
      "gazebo",
      "dome",
      "mansard",
      "spire",
      "turret",
      "valance",
    ],
  },
  {
    id: "storage",
    label: "Crates, Barrels & Decals",
    keywords: [
      "crate",
      "barrel",
      "cask",
      "keg",
      "sack",
      "basket",
      "chest",
      "trunk",
      "strongbox",
      "bucket",
      "storage",
      "decal",
      "puddle",
      "crack",
      "cobweb",
      "scorch",
      "rubble",
      "blood",
      "stain",
      "leaves",
      "scatter",
      "bottles",
    ],
  },
];

export interface CategoryFacetDef {
  id: string;
  label: string;
  match: (asset: VaultAsset, hay: string) => boolean;
}

export const CATEGORY_FACETS: Partial<Record<AssetCategory, CategoryFacetDef[]>> = {
  object: [
    {
      id: "harmony",
      label: "Studio Harmony",
      match: (a, hay) =>
        a.tags.includes("harmony") ||
        hay.includes("harmony_") ||
        hay.includes("subterranean_caves") ||
        hay.includes("stairs_architectural") ||
        hay.includes("ice_cream_train") ||
        hay.includes("messy_apartment") ||
        hay.includes("neighborhood_park") ||
        hay.includes("district_streets") ||
        hay.includes("aged_streetcar_line") ||
        hay.includes("weathering_overlays") ||
        hay.includes("watchtower_garrison") ||
        hay.includes("community_kid_theater") ||
        hay.includes("boulevard_shops") ||
        hay.includes("sovereign_temple"),
    },
    {
      id: "modular",
      label: "Modular Splits",
      match: (a, hay) => a.tags.includes("modular") || hay.includes("/modular/") || hay.includes("_bare_"),
    },
    {
      id: "colorable",
      label: "Colorable",
      match: (a) => isNativeColorableAsset(a),
    },
    {
      id: "hero",
      label: "Hero Pieces",
      match: (a, hay) => a.tags.includes("hero") || hay.includes("/hero/") || a.widthPx * a.heightPx >= 260 * 260,
    },
    {
      id: "clutter",
      label: "Table & Floor Clutter",
      match: (a, hay) => a.tags.includes("clutter") || a.tags.includes("decal") || hay.includes("dec_"),
    },
  ],
  portal: [
    { id: "doors", label: "Doors", match: (_a, hay) => hay.includes("door") && !hay.includes("trapdoor") && !hay.includes("secret") },
    { id: "windows", label: "Windows", match: (_a, hay) => hay.includes("window") || hay.includes("win_") },
    { id: "gates", label: "Gates & Bars", match: (_a, hay) => hay.includes("gate") || hay.includes("grate") || hay.includes("portcullis") },
    { id: "secret", label: "Secret Doors", match: (_a, hay) => hay.includes("secret") || hay.includes("pivot") },
    { id: "hatches", label: "Hatches & Trapdoors", match: (_a, hay) => hay.includes("hatch") || hay.includes("trapdoor") },
    { id: "arches", label: "Archways", match: (_a, hay) => hay.includes("arch") },
    { id: "colorable", label: "Colorable", match: (a) => isNativeColorableAsset(a) },
  ],
  wall: [
    { id: "stone", label: "Stone & Crypt", match: (_a, hay) => hay.includes("stone") || hay.includes("crypt") || hay.includes("castle") || hay.includes("marble") || hay.includes("dungeon") },
    { id: "brick", label: "Brick & Cellar", match: (_a, hay) => hay.includes("brick") || hay.includes("cellar") || hay.includes("berlin") || hay.includes("tenement") },
    { id: "wood", label: "Wood & Timber", match: (_a, hay) => hay.includes("wood") || hay.includes("timber") || hay.includes("log") || hay.includes("plank") || hay.includes("tudor") },
    { id: "fence", label: "Fences & Iron Bars", match: (_a, hay) => hay.includes("fence") || hay.includes("bar") || hay.includes("railing") || hay.includes("iron") || hay.includes("wrought") },
    { id: "magipunk", label: "Magi-Punk & Tech", match: (_a, hay) => hay.includes("aether") || hay.includes("bulkhead") || hay.includes("brass") || hay.includes("steel") || hay.includes("copper") },
    { id: "cave", label: "Caves & Hedges", match: (_a, hay) => hay.includes("cave") || hay.includes("cavern") || hay.includes("hedge") || hay.includes("moss") || hay.includes("rock") },
    { id: "colorable", label: "Colorable", match: (a) => isNativeColorableAsset(a) },
  ],
  terrain: [
    { id: "wood", label: "Wood & Parquet", match: (_a, hay) => hay.includes("wood") || hay.includes("plank") || hay.includes("parquet") || hay.includes("deck") || hay.includes("oak") },
    { id: "stone", label: "Stone & Dungeon", match: (_a, hay) => hay.includes("stone") || hay.includes("flagstone") || hay.includes("dungeon") || hay.includes("crypt") || hay.includes("tile") || hay.includes("marble") || hay.includes("cave") || hay.includes("basalt") || hay.includes("shale") },
    { id: "street", label: "Streets & Cobble", match: (_a, hay) => hay.includes("cobble") || hay.includes("street") || hay.includes("paving") || hay.includes("asphalt") || hay.includes("brick") || hay.includes("gravel") },
    { id: "nature", label: "Grass, Dirt & Snow", match: (_a, hay) => hay.includes("grass") || hay.includes("dirt") || hay.includes("moss") || hay.includes("snow") || hay.includes("sand") || hay.includes("mud") || hay.includes("forest") },
    { id: "water", label: "Water & Ice", match: (_a, hay) => hay.includes("water") || hay.includes("pond") || hay.includes("ice") || hay.includes("swamp") || hay.includes("lava") },
    { id: "roof", label: "Roof Textures", match: (_a, hay) => hay.includes("roof") || hay.includes("shingle") || hay.includes("slate") || hay.includes("thatch") },
    { id: "world_texture", label: "World Atlas Paper", match: (a, hay) => a.tags.includes("world_texture") || hay.includes("world-atlas/") || hay.includes("parchment") },
  ],
  path: [
    { id: "street", label: "Streets & Roads", match: (_a, hay) => hay.includes("road") || hay.includes("street") || hay.includes("cobble") || hay.includes("brick") || hay.includes("paving") || hay.includes("carpet") || hay.includes("runner") },
    { id: "rails", label: "Rails & Conduits", match: (_a, hay) => hay.includes("rail") || hay.includes("track") || hay.includes("conduit") || hay.includes("pipe") || hay.includes("cable") || hay.includes("tram") },
    { id: "cliff", label: "Cliffs & Cracks", match: (_a, hay) => hay.includes("cliff") || hay.includes("embankment") || hay.includes("crack") || hay.includes("ridge") || hay.includes("ledge") },
    { id: "water", label: "Water & Shoreline", match: (_a, hay) => hay.includes("water") || hay.includes("shore") || hay.includes("river") || hay.includes("foam") || hay.includes("wake") || hay.includes("pier") || hay.includes("dock") },
    { id: "stairs", label: "Stairs & Bridges", match: (_a, hay) => hay.includes("stair") || hay.includes("bridge") || hay.includes("walkway") || hay.includes("boardwalk") || hay.includes("catwalk") },
    { id: "nature", label: "Vines & Foliage", match: (_a, hay) => hay.includes("vine") || hay.includes("ivy") || hay.includes("hedge") || hay.includes("flower") || hay.includes("moss") || hay.includes("tree") || hay.includes("root") },
    { id: "chains", label: "Ropes & Chains", match: (_a, hay) => hay.includes("rope") || hay.includes("chain") || hay.includes("fence") || hay.includes("laundry") || hay.includes("wire") },
  ],
};

export function formatVaultSourceLabel(name: string): string {
  return name
    .replace("DiceChaos_Berlin_Magipunk_Starter.dcpack", "Berlin Magi-Punk")
    .replace("DiceChaos_Core_Fantasy_CC0.dcpack", "Core Fantasy (CC0)")
    .replace("DiceChaos_Modular_Suite_CC0.dcpack", "Modular World (CC0)")
    .replace("DiceChaos_World_Atlas_CC0.dcpack", "World Atlas (CC0)")
    .replace("Dungeondraft Pack ", "DD ")
    .replace("Wonderdraft Premium ", "WD ")
    .replace(/\s+1\.0$/, "");
}

const OBJECT_SUBGROUP_BY_ID = new Map(OBJECT_SUBGROUPS.map((g) => [g.id, g]));
const subGroupHaystackCache = new WeakMap<VaultAsset, string>();
const searchHaystackCache = new WeakMap<VaultAsset, string>();
const hueSortKeyCache = new WeakMap<VaultAsset, number>();

function getSubGroupHaystack(asset: VaultAsset): string {
  let hay = subGroupHaystackCache.get(asset);
  if (hay === undefined) {
    hay = `${asset.id} ${asset.displayName} ${asset.tags.join(" ")}`.toLowerCase();
    subGroupHaystackCache.set(asset, hay);
  }
  return hay;
}

function getSearchHaystack(asset: VaultAsset): string {
  let hay = searchHaystackCache.get(asset);
  if (hay === undefined) {
    hay = `${asset.displayName} ${asset.category} ${asset.sourceName} ${asset.tags.join(" ")} ${asset.internalPath}`.toLowerCase();
    searchHaystackCache.set(asset, hay);
  }
  return hay;
}

function getHarmonyPriority(asset: VaultAsset): number {
  const id = asset.id.toLowerCase();
  if (id.includes("subterranean_caves/")) return 5;
  if (id.includes("harmony_lighting/")) return 5;
  if (id.includes("stairs_architectural/")) return 5;
  if (id.includes("/harmony/") || asset.tags.includes("harmony")) return 4;
  if (
    id.includes("ice_cream_train/") ||
    id.includes("messy_apartment/") ||
    id.includes("neighborhood_park/") ||
    id.includes("district_streets/") ||
    id.includes("sovereign_temple/")
  ) {
    return 4;
  }
  if (asset.sourceKind === "dcpack") return 2;
  return 1;
}

function getSearchRelevanceScore(asset: VaultAsset, tokens: string[], rawQuery: string): number {
  const name = asset.displayName.toLowerCase();
  let score = 0;
  if (name === rawQuery) score += 120;
  else if (name.startsWith(rawQuery)) score += 80;
  else if (name.includes(rawQuery)) score += 50;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (name === tok) score += 45;
    else if (name.startsWith(tok)) score += 30;
    else if (name.includes(` ${tok}`)) score += 22;
    else if (name.includes(tok)) score += 14;
    if (asset.tags.includes(tok)) score += 10;
  }
  if (asset.isFavorite) score += 8;
  score += getHarmonyPriority(asset) * 2;
  return score;
}

function getHueSortKey(asset: VaultAsset): number {
  const cached = hueSortKeyCache.get(asset);
  if (cached !== undefined) return cached;
  const [r0, g0, b0] = hexToRgb(asset.dominantHex || "#808080");
  const r = r0 / 255;
  const g = g0 / 255;
  const b = b0 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const sat = max === 0 ? 0 : d / max;
  let key: number;
  if (sat < 0.14) {
    // Group low-saturation greys/neutrals cleanly at the end sorted light -> dark
    key = 400 + (1 - (r * 0.299 + g * 0.587 + b * 0.114)) * 100;
  } else {
    let h = 0;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    key = h;
  }
  hueSortKeyCache.set(asset, key);
  return key;
}

function buildAssetIndex(assets: VaultAsset[]): Map<string, VaultAsset> {
  const m = new Map<string, VaultAsset>();
  for (let i = 0; i < assets.length; i++) {
    m.set(assets[i].id, assets[i]);
  }
  return m;
}

export function matchesSubGroup(asset: VaultAsset, subGroupId: ObjectSubGroupId): boolean {
  const def = OBJECT_SUBGROUP_BY_ID.get(subGroupId);
  if (!def) return true;
  const hay = getSubGroupHaystack(asset);
  return def.keywords.some((kw) => hay.includes(kw));
}

export function matchesCategoryFacet(
  asset: VaultAsset,
  category: AssetCategory,
  facetId: string | null,
): boolean {
  if (!facetId) return true;
  const list = CATEGORY_FACETS[category];
  if (!list) return true;
  const def = list.find((f) => f.id === facetId);
  if (!def) return true;
  return def.match(asset, getSubGroupHaystack(asset));
}

interface VaultStoreState {
  initialized: boolean;
  loading: boolean;
  sources: VaultSource[];
  assets: VaultAsset[];
  assetById: Map<string, VaultAsset>;
  biomeKits: BiomeKit[];

  // Filters & Sorting
  searchQuery: string;
  sortMode: VaultSortMode;
  templatesView: boolean;
  templateCategoryFilter: "all" | ObjectTemplateCategory;
  activeCategory: AssetCategory;
  activeCategoryFacet: string | null;
  activeSubGroup: ObjectSubGroupId | null;
  activeWorldGroup: WorldAssetGroup | null;
  activeWorldDrawMode: WorldDrawModeFilter;
  activeWorldSet: string | null;
  activeSourceId: string | null;
  activeKitId: string | null;
  activeTags: string[];
  favoritesOnly: boolean;
  recentOnly: boolean;
  recentAssetIds: string[];
  colorableOnly: boolean;
  colorFilterHex: string | null;
  thumbnailSizePx: number;

  // Bottom Drawer & Tree UX preferences
  autoSyncTool: boolean;
  drawerHeightPx: number;
  drawerTileSize: "sm" | "md" | "lg";
  collapsedTreeSections: Record<string, boolean>;

  selectedAssetId: string | null;

  // Actions
  initVault: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  setSortMode: (mode: VaultSortMode) => void;
  setTemplatesView: (active: boolean) => void;
  setTemplateCategoryFilter: (cat: "all" | ObjectTemplateCategory) => void;
  setActiveCategory: (cat: AssetCategory) => void;
  setActiveCategoryFacet: (facetId: string | null) => void;
  setActiveSubGroup: (sub: ObjectSubGroupId | null) => void;
  setActiveWorldGroup: (group: WorldAssetGroup | null) => void;
  setActiveWorldDrawMode: (mode: WorldDrawModeFilter) => void;
  setActiveWorldSet: (setTag: string | null) => void;
  setActiveSourceId: (id: string | null) => void;
  setActiveKitId: (id: string | null) => void;
  toggleTagFilter: (tag: string) => void;
  setFavoritesOnly: (fav: boolean) => void;
  setRecentOnly: (rec: boolean) => void;
  setAutoSyncTool: (sync: boolean) => void;
  setDrawerHeightPx: (px: number) => void;
  setDrawerTileSize: (sz: "sm" | "md" | "lg") => void;
  toggleTreeSection: (sectionKey: string) => void;
  setColorableOnly: (col: boolean) => void;
  setColorFilterHex: (hex: string | null) => void;
  setThumbnailSizePx: (px: number) => void;
  setSelectedAssetId: (id: string | null) => void;
  recordRecentAsset: (id: string) => void;
  clearDrawerFilters: () => void;

  toggleFavoriteAsset: (assetId: string) => void;
  addTagToAsset: (assetId: string, tag: string) => void;
  removeTagFromAsset: (assetId: string, tag: string) => void;
  toggleSourceEnabled: (sourceId: string) => void;
  removeSource: (sourceId: string) => void;
  createBiomeKit: (name: string, accentHex?: string) => void;
  renameBiomeKit: (kitId: string, name: string) => void;
  deleteBiomeKit: (kitId: string) => void;
  addAssetToKit: (kitId: string, assetId: string) => void;
  ingestLocalFiles: (files: FileList | File[]) => Promise<number>;
  importWonderdraftPack: (file: File) => Promise<{ name: string; count: number }>;

  getFilteredAssets: () => VaultAsset[];
  getAssetById: (id: string) => VaultAsset | undefined;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{3,6}$/.test(clean)) return [128, 128, 128];
  const num = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function colorDistance(hexA: string, hexB: string): number {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

function applyVaultSort(
  list: VaultAsset[],
  sortMode: VaultSortMode,
  recentOnly: boolean,
  recentAssetIds: string[],
  tokens: string[],
  rawQuery: string,
): VaultAsset[] {
  if (recentOnly) {
    const order = new Map(recentAssetIds.map((id, i) => [id, i]));
    return [...list].sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  }
  if (sortMode === "curated") {
    if (tokens.length === 0) return list;
    return [...list].sort(
      (a, b) =>
        getSearchRelevanceScore(b, tokens, rawQuery) -
          getSearchRelevanceScore(a, tokens, rawQuery) ||
        a.displayName.localeCompare(b.displayName),
    );
  }
  if (sortMode === "harmony_first") {
    return [...list].sort(
      (a, b) =>
        getHarmonyPriority(b) - getHarmonyPriority(a) ||
        Number(b.isFavorite) - Number(a.isFavorite) ||
        a.displayName.localeCompare(b.displayName),
    );
  }
  if (sortMode === "name_asc") {
    return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  if (sortMode === "name_desc") {
    return [...list].sort((a, b) => b.displayName.localeCompare(a.displayName));
  }
  if (sortMode === "favorites") {
    return [...list].sort(
      (a, b) =>
        Number(b.isFavorite) - Number(a.isFavorite) ||
        getHarmonyPriority(b) - getHarmonyPriority(a) ||
        a.displayName.localeCompare(b.displayName),
    );
  }
  if (sortMode === "recent") {
    const order = new Map(recentAssetIds.map((id, i) => [id, i]));
    return [...list].sort(
      (a, b) =>
        (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999) ||
        a.displayName.localeCompare(b.displayName),
    );
  }
  if (sortMode === "size_desc") {
    return [...list].sort(
      (a, b) =>
        b.widthPx * b.heightPx - a.widthPx * a.heightPx ||
        a.displayName.localeCompare(b.displayName),
    );
  }
  if (sortMode === "size_asc") {
    return [...list].sort(
      (a, b) =>
        a.widthPx * a.heightPx - b.widthPx * b.heightPx ||
        a.displayName.localeCompare(b.displayName),
    );
  }
  if (sortMode === "color_hue") {
    return [...list].sort(
      (a, b) => getHueSortKey(a) - getHueSortKey(b) || a.displayName.localeCompare(b.displayName),
    );
  }
  return list;
}

export const useVaultStore = create<VaultStoreState>((set, get) => ({
  initialized: false,
  loading: false,
  sources: [],
  assets: [],
  assetById: new Map<string, VaultAsset>(),
  biomeKits: [],

  searchQuery: "",
  sortMode: "curated",
  templatesView: false,
  templateCategoryFilter: "all",
  activeCategory: "object",
  activeCategoryFacet: null,
  activeSubGroup: null,
  activeWorldGroup: null,
  activeWorldDrawMode: "all",
  activeWorldSet: null,
  activeSourceId: null,
  activeKitId: null,
  activeTags: [],
  favoritesOnly: false,
  recentOnly: false,
  recentAssetIds: [
    "objects/magipunk_funicular_interior.png",
    "objects/aether_core_dynamo.png",
    "objects/wood_interior_stairs.png",
    "objects/brass_spiral_staircase.png",
    "objects/ornate_persian_carpet.png",
    "objects/berlin_litfass_kiosk.png",
  ],
  colorableOnly: false,
  colorFilterHex: null,
  thumbnailSizePx: 112,

  autoSyncTool: true,
  drawerHeightPx: 256,
  drawerTileSize: "md",
  collapsedTreeSections: {
    world_in_battlemap: true,
    battlemap_in_world: true,
    packs: false,
    kits: false,
  },

  selectedAssetId: "objects/magipunk_funicular_interior.png",

  initVault: async () => {
    if (get().initialized || get().loading) return;
    set({ loading: true });
    try {
      const data = await loadStarterVaultData();
      set({
        sources: data.sources,
        assets: data.assets,
        assetById: buildAssetIndex(data.assets),
        biomeKits: data.biomeKits,
        initialized: true,
        loading: false,
      });
    } catch (err) {
      console.error("Failed initializing starter asset vault:", err);
      set({ loading: false, initialized: true });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortMode: (sortMode) => set({ sortMode }),
  setTemplatesView: (templatesView) =>
    set(
      templatesView
        ? {
            templatesView: true,
            favoritesOnly: false,
            recentOnly: false,
            activeKitId: null,
            activeSubGroup: null,
            activeCategoryFacet: null,
          }
        : { templatesView: false },
    ),
  setTemplateCategoryFilter: (templateCategoryFilter) =>
    set({ templateCategoryFilter, templatesView: true }),
  setActiveCategory: (activeCategory) =>
    set((s) => ({
      templatesView: false,
      activeCategory,
      activeCategoryFacet: s.activeCategory === activeCategory ? s.activeCategoryFacet : null,
      activeSubGroup: activeCategory === "object" || activeCategory === "all" ? s.activeSubGroup : null,
      activeWorldGroup: activeCategory === "symbol" || activeCategory === "all" ? s.activeWorldGroup : null,
      activeWorldDrawMode:
        activeCategory === "symbol" || activeCategory === "all" ? s.activeWorldDrawMode : "all",
      activeWorldSet:
        activeCategory === "symbol" || activeCategory === "all" ? s.activeWorldSet : null,
      favoritesOnly: false,
      recentOnly: false,
      activeKitId: null,
    })),
  setActiveCategoryFacet: (activeCategoryFacet) =>
    set({
      templatesView: false,
      activeCategoryFacet,
      favoritesOnly: false,
      recentOnly: false,
      activeKitId: null,
    }),
  setActiveSubGroup: (activeSubGroup) =>
    set({
      templatesView: false,
      activeSubGroup,
      activeCategoryFacet: null,
      activeWorldGroup: null,
      activeWorldSet: null,
      activeCategory: activeSubGroup ? "object" : get().activeCategory,
      favoritesOnly: false,
      recentOnly: false,
      activeKitId: null,
    }),
  setActiveWorldGroup: (activeWorldGroup) =>
    set({
      templatesView: false,
      activeWorldGroup,
      activeWorldSet: null,
      activeSubGroup: null,
      activeCategoryFacet: null,
      activeCategory: "symbol",
      favoritesOnly: false,
      recentOnly: false,
      activeKitId: null,
    }),
  setActiveWorldDrawMode: (activeWorldDrawMode) => set({ activeWorldDrawMode, templatesView: false }),
  setActiveWorldSet: (activeWorldSet) =>
    set({
      templatesView: false,
      activeWorldSet,
      activeCategory: "symbol",
      favoritesOnly: false,
      recentOnly: false,
      activeKitId: null,
    }),
  setActiveSourceId: (activeSourceId) => set({ activeSourceId, activeKitId: null, templatesView: false }),
  setActiveKitId: (activeKitId) =>
    set({
      templatesView: false,
      activeKitId,
      activeSourceId: null,
      activeSubGroup: null,
      activeCategoryFacet: null,
      favoritesOnly: false,
      recentOnly: false,
      ...(activeKitId ? { activeCategory: "all" as AssetCategory } : {}),
    }),
  toggleTagFilter: (tag) =>
    set((s) => ({
      templatesView: false,
      activeTags: s.activeTags.includes(tag)
        ? s.activeTags.filter((t) => t !== tag)
        : [...s.activeTags, tag],
    })),
  setFavoritesOnly: (favoritesOnly) =>
    set({
      templatesView: false,
      favoritesOnly,
      recentOnly: false,
      activeKitId: null,
      activeSubGroup: null,
      activeCategoryFacet: null,
      ...(favoritesOnly ? { activeCategory: "all" as AssetCategory } : {}),
    }),
  setRecentOnly: (recentOnly) =>
    set({
      templatesView: false,
      recentOnly,
      favoritesOnly: false,
      activeKitId: null,
      activeSubGroup: null,
      activeCategoryFacet: null,
      ...(recentOnly ? { activeCategory: "all" as AssetCategory } : {}),
    }),
  setAutoSyncTool: (autoSyncTool) => set({ autoSyncTool }),
  setDrawerHeightPx: (px) => set({ drawerHeightPx: Math.max(176, Math.min(480, Math.round(px))) }),
  setDrawerTileSize: (drawerTileSize) => set({ drawerTileSize }),
  toggleTreeSection: (sectionKey) =>
    set((s) => ({
      collapsedTreeSections: {
        ...s.collapsedTreeSections,
        [sectionKey]: !s.collapsedTreeSections[sectionKey],
      },
    })),
  setColorableOnly: (colorableOnly) => set({ colorableOnly, templatesView: false }),
  setColorFilterHex: (colorFilterHex) => set({ colorFilterHex, templatesView: false }),
  setThumbnailSizePx: (thumbnailSizePx) => set({ thumbnailSizePx }),
  setSelectedAssetId: (selectedAssetId) =>
    set((s) => ({
      selectedAssetId,
      recentAssetIds: selectedAssetId
        ? [selectedAssetId, ...s.recentAssetIds.filter((x) => x !== selectedAssetId)].slice(0, 24)
        : s.recentAssetIds,
    })),
  recordRecentAsset: (id) =>
    set((s) => ({
      recentAssetIds: [id, ...s.recentAssetIds.filter((x) => x !== id)].slice(0, 24),
    })),
  clearDrawerFilters: () =>
    set({
      searchQuery: "",
      templatesView: false,
      templateCategoryFilter: "all",
      activeCategory: "all",
      activeCategoryFacet: null,
      activeSubGroup: null,
      activeWorldGroup: null,
      activeWorldDrawMode: "all",
      activeWorldSet: null,
      activeKitId: null,
      activeSourceId: null,
      activeTags: [],
      favoritesOnly: false,
      recentOnly: false,
      colorableOnly: false,
      colorFilterHex: null,
    }),

  toggleFavoriteAsset: (assetId) =>
    set((s) => {
      const assets = s.assets.map((a) =>
        a.id === assetId ? { ...a, isFavorite: !a.isFavorite } : a,
      );
      return { assets, assetById: buildAssetIndex(assets) };
    }),

  addTagToAsset: (assetId, tag) => {
    const clean = tag.trim().replace(/^#/, "").toLowerCase();
    if (!clean) return;
    set((s) => {
      const assets = s.assets.map((a) =>
        a.id === assetId && !a.tags.includes(clean)
          ? { ...a, tags: [...a.tags, clean] }
          : a,
      );
      return { assets, assetById: buildAssetIndex(assets) };
    });
  },

  removeTagFromAsset: (assetId, tag) =>
    set((s) => {
      const assets = s.assets.map((a) =>
        a.id === assetId ? { ...a, tags: a.tags.filter((t) => t !== tag) } : a,
      );
      return { assets, assetById: buildAssetIndex(assets) };
    }),

  toggleSourceEnabled: (sourceId) =>
    set((s) => ({
      sources: s.sources.map((src) =>
        src.id === sourceId ? { ...src, enabled: !src.enabled } : src,
      ),
    })),

  removeSource: (sourceId) =>
    set((s) => {
      const assets = s.assets.filter((a) => a.sourceId !== sourceId);
      return {
        sources: s.sources.filter((src) => src.id !== sourceId),
        assets,
        assetById: buildAssetIndex(assets),
        activeSourceId: s.activeSourceId === sourceId ? null : s.activeSourceId,
      };
    }),

  createBiomeKit: (name, accentHex = "#E5A93C") => {
    const clean = name.trim();
    if (!clean) return;
    const id = `kit-${Date.now()}`;
    set((s) => ({
      biomeKits: [...s.biomeKits, { id, name: clean, accentHex, assetIds: [] }],
    }));
  },

  renameBiomeKit: (kitId, name) => {
    const clean = name.trim();
    if (!clean) return;
    set((s) => ({
      biomeKits: s.biomeKits.map((k) => (k.id === kitId ? { ...k, name: clean } : k)),
    }));
  },

  deleteBiomeKit: (kitId) =>
    set((s) => ({
      biomeKits: s.biomeKits.filter((k) => k.id !== kitId),
      activeKitId: s.activeKitId === kitId ? null : s.activeKitId,
    })),

  addAssetToKit: (kitId, assetId) =>
    set((s) => ({
      biomeKits: s.biomeKits.map((k) =>
        k.id === kitId && !k.assetIds.includes(assetId)
          ? { ...k, assetIds: [...k.assetIds, assetId] }
          : k,
      ),
    })),

  ingestLocalFiles: async (files) => {
    const arr = Array.from(files).filter((f) =>
      /\.(png|webp|jpg|jpeg|svg)$/i.test(f.name),
    );
    if (arr.length === 0) return 0;

    const sourceId = `src-local-${Date.now()}`;
    const folderLabel =
      (arr[0] as File & { webkitRelativePath?: string }).webkitRelativePath?.split("/")[0] ||
      "Imported_Loose_Assets/";

    const newAssets: VaultAsset[] = [];
    for (const file of arr) {
      const objectUrl = URL.createObjectURL(file);
      const stem = file.name.replace(/\.[^.]+$/, "");
      const lower = file.name.toLowerCase();
      const category: VaultAsset["category"] = lower.includes("wall")
        ? "wall"
        : lower.includes("terrain") || lower.includes("floor")
          ? "terrain"
          : lower.includes("path") || lower.includes("track")
            ? "path"
            : lower.includes("door") || lower.includes("window") || lower.includes("gate")
              ? "portal"
              : "object";
      const tags = stem
        .split(/[_\-\s.]+/)
        .map((t) => t.toLowerCase())
        .filter((t) => t.length >= 2);

      newAssets.push({
        id: `${sourceId}/${file.name}`,
        sourceId,
        sourceName: folderLabel,
        sourceKind: "folder",
        internalPath: file.name,
        url: objectUrl,
        thumbUrl: objectUrl,
        displayName: stem.replace(/[_-]+/g, " "),
        category,
        widthPx: 256,
        heightPx: 256,
        defaultPpi: 256,
        drawMode: lower.includes("color") ? "rgb_channels" : "normal",
        dominantHex: "#7C8A9E",
        castsShadow: category === "object" || category === "wall",
        isFavorite: false,
        tags: [...new Set([...tags, "imported"])],
      });
    }

    const newSource: VaultSource = {
      id: sourceId,
      kind: "folder",
      name: folderLabel,
      rootPath: folderLabel,
      enabled: true,
      assetCount: newAssets.length,
      ramEstimateMb: Math.round((newAssets.length * 0.14 + 0.4) * 10) / 10,
      lastIndexedAt: Math.floor(Date.now() / 1000),
    };

    set((s) => {
      const assets = [...newAssets, ...s.assets];
      return {
        sources: [...s.sources, newSource],
        assets,
        assetById: buildAssetIndex(assets),
        selectedAssetId: newAssets[0]?.id ?? s.selectedAssetId,
      };
    });
    return newAssets.length;
  },

  importWonderdraftPack: async (file) => {
    const buf = new Uint8Array(await file.arrayBuffer());
    const { source, assets: imported } = await importWonderdraftZipBytes(file.name, buf);
    if (imported.length === 0) {
      return { name: source.name, count: 0 };
    }
    set((s) => {
      const assets = [...imported, ...s.assets];
      return {
        sources: [...s.sources, source],
        assets,
        assetById: buildAssetIndex(assets),
        activeCategory: "symbol",
        activeWorldGroup: null,
        activeSourceId: source.id,
        selectedAssetId: imported[0]?.id ?? s.selectedAssetId,
      };
    });
    return { name: source.name, count: imported.length };
  },

  getFilteredAssets: () => {
    const s = get();
    const enabledSourceIds = new Set(s.sources.filter((x) => x.enabled).map((x) => x.id));
    const activeKit = s.activeKitId
      ? s.biomeKits.find((k) => k.id === s.activeKitId)
      : null;
    const activeKitSet = activeKit ? new Set(activeKit.assetIds) : null;
    const recentSet = s.recentOnly ? new Set(s.recentAssetIds) : null;
    const rawQuery = s.searchQuery.trim().toLowerCase().replace(/^#/, "");
    const tokens = rawQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.replace(/^#/, ""));

    const list = s.assets.filter((a) => {
      if (!enabledSourceIds.has(a.sourceId)) return false;
      if (recentSet && !recentSet.has(a.id)) return false;
      if (s.activeCategory !== "all" && a.category !== s.activeCategory) return false;
      if (s.activeSubGroup && !matchesSubGroup(a, s.activeSubGroup)) return false;
      if (s.activeCategoryFacet && !matchesCategoryFacet(a, s.activeCategory, s.activeCategoryFacet)) {
        return false;
      }
      if (s.activeWorldGroup && a.worldGroup !== s.activeWorldGroup) return false;
      if (s.activeWorldDrawMode !== "all" && a.drawMode !== s.activeWorldDrawMode) return false;
      if (s.activeWorldSet && !a.tags.includes(s.activeWorldSet)) return false;
      if (s.activeSourceId && a.sourceId !== s.activeSourceId) return false;
      if (activeKitSet && !activeKitSet.has(a.id)) return false;
      if (s.favoritesOnly && !a.isFavorite) return false;
      if (s.colorableOnly && !isNativeColorableAsset(a)) return false;
      if (s.colorFilterHex && colorDistance(a.dominantHex, s.colorFilterHex) > 105) {
        return false;
      }
      for (const reqTag of s.activeTags) {
        if (!a.tags.includes(reqTag) && a.category !== reqTag) return false;
      }
      if (tokens.length > 0) {
        const hay = getSearchHaystack(a);
        for (const tok of tokens) {
          if (!hay.includes(tok)) return false;
        }
      }
      return true;
    });

    return applyVaultSort(list, s.sortMode, s.recentOnly, s.recentAssetIds, tokens, rawQuery);
  },

  getAssetById: (id) => get().assetById.get(id),
}));

/**
 * Memoized React hook for filtered & sorted Asset Vault items — guarantees stable references
 * under React 19 + Zustand v5 (useSyncExternalStore) without re-allocating in selectors.
 */
export function useFilteredVaultAssets(): VaultAsset[] {
  const assets = useVaultStore((s) => s.assets);
  const sources = useVaultStore((s) => s.sources);
  const biomeKits = useVaultStore((s) => s.biomeKits);
  const searchQuery = useVaultStore((s) => s.searchQuery);
  const sortMode = useVaultStore((s) => s.sortMode);
  const activeCategory = useVaultStore((s) => s.activeCategory);
  const activeCategoryFacet = useVaultStore((s) => s.activeCategoryFacet);
  const activeSubGroup = useVaultStore((s) => s.activeSubGroup);
  const activeWorldGroup = useVaultStore((s) => s.activeWorldGroup);
  const activeWorldDrawMode = useVaultStore((s) => s.activeWorldDrawMode);
  const activeWorldSet = useVaultStore((s) => s.activeWorldSet);
  const activeSourceId = useVaultStore((s) => s.activeSourceId);
  const activeKitId = useVaultStore((s) => s.activeKitId);
  const activeTags = useVaultStore((s) => s.activeTags);
  const favoritesOnly = useVaultStore((s) => s.favoritesOnly);
  const recentOnly = useVaultStore((s) => s.recentOnly);
  const recentAssetIds = useVaultStore((s) => s.recentAssetIds);
  const colorableOnly = useVaultStore((s) => s.colorableOnly);
  const colorFilterHex = useVaultStore((s) => s.colorFilterHex);

  return useMemo(() => {
    const enabledSourceIds = new Set(sources.filter((x) => x.enabled).map((x) => x.id));
    const activeKit = activeKitId
      ? biomeKits.find((k) => k.id === activeKitId)
      : null;
    const activeKitSet = activeKit ? new Set(activeKit.assetIds) : null;
    const recentSet = recentOnly ? new Set(recentAssetIds) : null;
    const rawQuery = searchQuery.trim().toLowerCase().replace(/^#/, "");
    const tokens = rawQuery
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => t.replace(/^#/, ""));

    const list = assets.filter((a) => {
      if (!enabledSourceIds.has(a.sourceId)) return false;
      if (recentSet && !recentSet.has(a.id)) return false;
      if (activeCategory !== "all" && a.category !== activeCategory) return false;
      if (activeSubGroup && !matchesSubGroup(a, activeSubGroup)) return false;
      if (activeCategoryFacet && !matchesCategoryFacet(a, activeCategory, activeCategoryFacet)) {
        return false;
      }
      if (activeWorldGroup && a.worldGroup !== activeWorldGroup) return false;
      if (activeWorldDrawMode !== "all" && a.drawMode !== activeWorldDrawMode) return false;
      if (activeWorldSet && !a.tags.includes(activeWorldSet)) return false;
      if (activeSourceId && a.sourceId !== activeSourceId) return false;
      if (activeKitSet && !activeKitSet.has(a.id)) return false;
      if (favoritesOnly && !a.isFavorite) return false;
      if (colorableOnly && !isNativeColorableAsset(a)) return false;
      if (colorFilterHex && colorDistance(a.dominantHex, colorFilterHex) > 105) {
        return false;
      }
      for (const reqTag of activeTags) {
        if (!a.tags.includes(reqTag) && a.category !== reqTag) return false;
      }
      if (tokens.length > 0) {
        const hay = getSearchHaystack(a);
        for (const tok of tokens) {
          if (!hay.includes(tok)) return false;
        }
      }
      return true;
    });

    return applyVaultSort(list, sortMode, recentOnly, recentAssetIds, tokens, rawQuery);
  }, [
    assets,
    sources,
    biomeKits,
    searchQuery,
    sortMode,
    activeCategory,
    activeCategoryFacet,
    activeSubGroup,
    activeWorldGroup,
    activeWorldDrawMode,
    activeWorldSet,
    activeSourceId,
    activeKitId,
    activeTags,
    favoritesOnly,
    recentOnly,
    recentAssetIds,
    colorableOnly,
    colorFilterHex,
  ]);
}

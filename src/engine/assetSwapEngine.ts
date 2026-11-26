/**
 * Semantic Smart Asset-Swap Engine for Wonderdraft & Dungeondraft Map Imports.
 *
 * Maps external Wonderdraft (`res://sprites/...`, `user://assets/...`) and Dungeondraft
 * (`res://textures/...`, `res://packs/...`) asset identifiers onto Dice Chaos Compass'
 * 8,784+ Vault assets with two selectable modes:
 *   1. "prefer_installed" — exact filename/stem match against installed user packs first,
 *      falling back cleanly to semantic CC0 matches when packs aren't installed.
 *   2. "cc0_only" — 100% clean-room swap strictly onto built-in CC0 (`dcpack`) assets.
 *
 * Supports deterministic species-family variant spreading so imported forests, grass tufts,
 * hills, and mountain ranges retain natural hand-painted variety!
 */

import { findWorldSymbolFamilyVariants } from "@/engine/worldEngine";
import type {
  AssetCategory,
  DcMapDocument,
  VaultAsset,
  WorldAssetGroup,
} from "@/types/map";

export type AssetSwapPolicy = "prefer_installed" | "cc0_only";
export type AssetSwapConfidence = "exact" | "high" | "medium" | "fallback";

export interface AssetSwapRequest {
  sourceRef: string;
  expectedCategory: Exclude<AssetCategory, "all">;
  expectedWorldGroup?: WorldAssetGroup;
  expectedDrawMode?: VaultAsset["drawMode"];
  isRoof?: boolean;
  /** Optional hint from Wonderdraft symbol `type` ("tree" | "mountain" | "symbol") */
  wdTypeHint?: string;
}

export interface AssetSwapEntry {
  sourceRef: string;
  sourceLabel: string;
  expectedCategory: Exclude<AssetCategory, "all">;
  expectedWorldGroup?: WorldAssetGroup;
  isRoof?: boolean;
  targetAssetId: string;
  targetDisplayName: string;
  targetThumbUrl: string;
  variantIds: string[];
  confidence: AssetSwapConfidence;
  count: number;
}

interface IndexedCandidate {
  asset: VaultAsset;
  tokens: Set<string>;
  stem: string;
  tailPath: string;
  isCc0: boolean;
  isHq: boolean;
  isRoofTex: boolean;
}

export interface AssetSwapIndex {
  policy: AssetSwapPolicy;
  allVaultAssets: VaultAsset[];
  candidates: IndexedCandidate[];
  byCategory: Map<Exclude<AssetCategory, "all">, IndexedCandidate[]>;
  roofCandidates: IndexedCandidate[];
  byTailPath: Map<string, IndexedCandidate>;
  byStem: Map<string, IndexedCandidate[]>;
  familyCache: Map<string, string[]>;
}

const STOP_WORDS = new Set([
  "res",
  "user",
  "assets",
  "myassets",
  "sprites",
  "textures",
  "objects",
  "symbols",
  "premium",
  "buildings",
  "custom",
  "default",
  "color",
  "colors",
  "png",
  "webp",
  "jpg",
  "pack",
  "packs",
  "the",
  "and",
  "for",
  "with",
  "short",
  "long",
  "small",
  "big",
  "large",
  "med",
  "medium",
  "var",
  "variant",
  "set",
]);

interface SemanticRule {
  match: RegExp;
  boostTokens: string[];
  penalizeTokens?: string[];
  worldSet?: string;
  worldGroup?: WorldAssetGroup;
  scope?: "world" | "battlemap";
  /** Optional category filter for battlemap rules so terrain/wall/path/object boosts never cross-contaminate */
  categories?: Array<Exclude<AssetCategory, "all">>;
  /** When true, only applies to roof texture lookups; when false, skips roof lookups */
  onlyRoof?: boolean;
}

/** Maps common Wonderdraft & Dungeondraft terms to our exact CC0 Vault set/keyword tokens */
const SEMANTIC_SYNONYMS: SemanticRule[] = [
  // =========================================================================
  // WORLD ATLAS — Trees & Flora (scope: "world")
  // =========================================================================
  { scope: "world", match: /\b(grass|tuft|steppe|meadow|reed|shrub|bush|scrub|fern|bramble)\b/i, boostTokens: ["grass", "tuft", "steppe", "meadow", "scrub", "set_terrain_features"], penalizeTokens: ["leyline", "spring", "glacier", "oasis", "quarry", "wheat"], worldSet: "set_terrain_features", worldGroup: "trees" },
  { scope: "world", match: /\b(flower|flowers|wildflower)\b/i, boostTokens: ["wildflower", "meadow", "fey", "set_fey_flora"], worldSet: "set_fey_flora", worldGroup: "trees" },
  { scope: "world", match: /\b(snow|winter|frost|frozen|ice).*(tree|pine|forest)|\b(tree|pine).*(snow|winter|frost)\b/i, boostTokens: ["snow", "winter", "frost", "set_snow_trees"], worldSet: "set_snow_trees", worldGroup: "trees" },
  { scope: "world", match: /\b(pine|spruce|fir|conifer|evergreen|taiga|cedar|cypress|xmas|christmas)\b/i, boostTokens: ["pine", "conifer", "taiga", "evergreen", "set_pine"], penalizeTokens: ["deadwood", "cactus", "desert", "acacia"], worldSet: "set_pine", worldGroup: "trees" },
  { scope: "world", match: /\b(palm|tropical|jungle|mangrove|coconut|bamboo|island tree)\b/i, boostTokens: ["tropical", "palm", "jungle", "set_tropical"], worldSet: "set_tropical", worldGroup: "trees" },
  { scope: "world", match: /\b(weeping|white willow|willow)\b/i, boostTokens: ["willow", "weeping", "riverside", "set_autumn"], penalizeTokens: ["deadwood", "haunted", "snag", "bleached"], worldSet: "set_autumn", worldGroup: "trees" },
  { scope: "world", match: /\b(autumn|fall|amber|redwood|cherry|blossom)\b/i, boostTokens: ["autumn", "fall", "set_autumn"], worldSet: "set_autumn", worldGroup: "trees" },
  { scope: "world", match: /\b(deadtree|dead|wither|swamp|marsh|bog|gnarled|spooky|corrupt|blight|stump)\b/i, boostTokens: ["deadwood", "swamp", "dead", "set_deadwood"], worldSet: "set_deadwood", worldGroup: "trees" },
  { scope: "world", match: /\b(cactus|cacti|desert flora|oasis|savanna|acacia|baobab)\b/i, boostTokens: ["desert", "cactus", "set_desert_flora"], worldSet: "set_desert_flora", worldGroup: "trees" },
  { scope: "world", match: /\b(oak|deciduous|broadleaf|birch|maple|elm|poplar|hickory|bay|fig|lemon|beech|ash|chestnut|leafy|forest|wood|canopy|copse|grove)\b/i, boostTokens: ["oak", "broadleaf", "forest", "set_oak"], penalizeTokens: ["taiga", "spruce", "pine"], worldSet: "set_oak", worldGroup: "trees" },
  { scope: "world", match: /\b(mushroom|fungi|crystal|fey|glow|elven tree|magic tree|purple)\b/i, boostTokens: ["fey", "mushroom", "crystal", "set_fey_flora"], worldSet: "set_fey_flora", worldGroup: "trees" },

  // =========================================================================
  // WORLD ATLAS — Mountains, Waterfalls, Cliffs, Hills & Clouds (scope: "world")
  // =========================================================================
  { scope: "world", match: /\b(cloud|clouds|mist|fog|sky|storm cloud|cumulus)\b/i, boostTokens: ["cloud", "clouds", "cumulus", "puff", "currents", "set_clouds"], penalizeTokens: ["floating", "sky_island"], worldSet: "set_clouds", worldGroup: "cartography" },
  { scope: "world", match: /\b(waterfall|cascade|falls)\b/i, boostTokens: ["waterfall", "cascade", "river", "cliff", "set_cliffs"], penalizeTokens: ["bluff", "coast", "moor"], worldSet: "set_cliffs", worldGroup: "mountains" },
  { scope: "world", match: /\b(mine|mines|quarry)\b/i, boostTokens: ["quarry", "mine", "stone", "industry", "set_terrain_features"], penalizeTokens: ["statue", "ruin", "leyline", "cliff", "coast"], worldSet: "set_terrain_features", worldGroup: "landmarks" },
  { scope: "world", match: /\b(volcan|lava|caldera|magma)\b/i, boostTokens: ["volcanic", "volcano", "set_volcanic"], worldSet: "set_volcanic", worldGroup: "mountains" },
  { scope: "world", match: /\b(dune|erg|sand hill|desert hill)\b/i, boostTokens: ["dune", "desert", "set_desert_dunes"], worldSet: "set_desert_dunes", worldGroup: "mountains" },
  { scope: "world", match: /\b(cracked|fissure|chasm|rift|crevasse)\b/i, boostTokens: ["chasm", "rift", "fissure", "canyon", "set_cliffs"], penalizeTokens: ["waterfall", "cascade"], worldSet: "set_cliffs", worldGroup: "mountains" },
  { scope: "world", match: /\b(ravine|gorge|crater|cliff|mesa|butte|canyon|escarpment|bluff|ridge|plateau|crag|rock|rocks|boulder|boulders)\b/i, boostTokens: ["cliff", "crag", "rock", "bluff", "ridge", "set_cliffs"], penalizeTokens: ["waterfall", "cascade", "viaduct", "aqueduct", "bridge"], worldSet: "set_cliffs", worldGroup: "mountains" },
  { scope: "world", match: /\b(lowhill|hiils|hill|hills|mound|knoll|barrow|rolling|foothill)\b/i, boostTokens: ["hill", "hills", "steppe", "set_hills"], worldSet: "set_hills", worldGroup: "mountains" },
  { scope: "world", match: /\b(arctic|snow|snowy|alpine|glacier|ice|highmount|hugemount|jagged)\b/i, boostTokens: ["alpine", "snow", "mountain", "peak", "massif", "set_alpine_peaks"], worldSet: "set_alpine_peaks", worldGroup: "mountains" },
  { scope: "world", match: /\b(mountain|mountains|mtn|mount|range|rocky|peak|peaks|spire mtn)\b/i, boostTokens: ["mountain", "rocky", "peak", "set_rocky_peaks"], worldSet: "set_rocky_peaks", worldGroup: "mountains" },

  // =========================================================================
  // WORLD ATLAS — Farmland, Maritime & Specific Settlements (order = most specific first!)
  // =========================================================================
  { scope: "world", match: /\b(field|fields|wheat|crop|farmland|orchard|terraces)\b/i, boostTokens: ["wheat", "fields", "farm", "rural", "set_terrain_features"], penalizeTokens: ["hamlet", "town", "castle", "keep", "windmill", "leyline", "glacier"], worldSet: "set_terrain_features", worldGroup: "landmarks" },
  { scope: "world", match: /\b(lighthouse|beacon)\b/i, boostTokens: ["lighthouse", "beacon", "sea", "coast", "tower"], penalizeTokens: ["eastern", "pagoda", "castle"], worldGroup: "maritime" },
  { scope: "world", match: /\b(pier|jetty|dock|harbor|harbour|port)\b/i, boostTokens: ["pier", "jetty", "dock", "harbor", "port", "fishing", "coastal", "set_medieval_towns"], penalizeTokens: ["eastern", "pagoda"], worldSet: "set_medieval_towns", worldGroup: "settlements" },
  { scope: "world", match: /\b(windmill|watermill|mill)\b/i, boostTokens: ["windmill", "mill", "rural", "farm", "set_medieval_towns"], penalizeTokens: ["keep", "castle", "walled"], worldSet: "set_medieval_towns", worldGroup: "settlements" },
  { scope: "world", match: /\b(bridge|bridges|viaduct|aqueduct)\b/i, boostTokens: ["bridge", "viaduct", "aqueduct", "crossing", "river", "arch", "set_landmarks"], penalizeTokens: ["keep", "hill", "castle"], worldSet: "set_landmarks", worldGroup: "landmarks" },
  { scope: "world", match: /\b(church|abbey|cathedral|chapel|monastery)\b/i, boostTokens: ["cathedral", "abbey", "gothic", "spire", "set_medieval_towns"], penalizeTokens: ["keep", "village"], worldSet: "set_medieval_towns", worldGroup: "settlements" },
  { scope: "world", match: /\b(mage tower|wizard|observatory|arcane tower)\b/i, boostTokens: ["wizard", "mage", "observatory", "tower", "arcane", "set_fantasy_cities"], worldSet: "set_fantasy_cities", worldGroup: "settlements" },
  { scope: "world", match: /\b(watchtower|pirat tower|tower)\b/i, boostTokens: ["watchtower", "tower", "palisade", "keep", "set_medieval_towns"], penalizeTokens: ["eastern", "pagoda", "capital", "village"], worldSet: "set_medieval_towns", worldGroup: "settlements" },
  { scope: "world", match: /\b(dw big|dw house|dw |dwarf|dwarven)\b/i, boostTokens: ["dwarven", "dwarf", "bastion", "mountain", "fortress", "gate", "set_fantasy_cities"], penalizeTokens: ["elven", "elf", "violet", "treehouse"], worldSet: "set_fantasy_cities", worldGroup: "settlements" },
  { scope: "world", match: /\b(japanese|eastern|oriental|pagoda|torii)\b/i, boostTokens: ["eastern", "pagoda", "imperial", "castle", "set_world_cities"], worldSet: "set_world_cities", worldGroup: "settlements" },
  { scope: "world", match: /\b(pirat small fort|pirate fort|pirates.*fort)\b/i, boostTokens: ["pirate", "island", "fort", "cove", "harbor", "set_world_cities"], worldSet: "set_world_cities", worldGroup: "settlements" },
  { scope: "world", match: /\b(orc|ork|orkish|goblin|dark|evil|skull|obsidian|demon|undead|necrom|chaos)\b/i, boostTokens: ["orc", "palisade", "camp", "fort", "stronghold", "dark", "set_dark_forts"], penalizeTokens: ["skull", "lair"], worldSet: "set_dark_forts", worldGroup: "settlements" },
  { scope: "world", match: /\b(elv|elven|elf|fey|arcane|crystal city|floating)\b/i, boostTokens: ["elven", "elf", "arcane", "citadel", "spire", "set_fantasy_cities"], worldSet: "set_fantasy_cities", worldGroup: "settlements" },
  { scope: "world", match: /\b(big castle|castle large|fortress|capital|metropolis|walled city|palace|citadel)\b/i, boostTokens: ["capital", "walled", "city", "grand", "castle", "citadel", "set_medieval_towns"], penalizeTokens: ["hamlet", "mini", "cottage"], worldSet: "set_medieval_towns", worldGroup: "settlements" },
  { scope: "world", match: /\b(imperial build|imperial)\b/i, boostTokens: ["walled", "town", "castle", "city", "harbor", "set_medieval_towns"], penalizeTokens: ["eastern", "pagoda"], worldSet: "set_medieval_towns", worldGroup: "settlements" },
  { scope: "world", match: /\b(castle|fort|keep|gate)\b/i, boostTokens: ["castle", "keep", "walled", "fort", "set_medieval_towns"], penalizeTokens: ["capital", "hamlet", "cottages", "windmill"], worldSet: "set_medieval_towns", worldGroup: "settlements" },
  { scope: "world", match: /\b(village|houses|house|hamlet|cottage|shack|pirat house|inn|tavern|smith|block|market|town)\b/i, boostTokens: ["hamlet", "village", "cottages", "town", "set_medieval_towns"], penalizeTokens: ["capital", "cathedral", "castle", "aqueduct", "bridge"], worldSet: "set_medieval_towns", worldGroup: "settlements" },
  { scope: "world", match: /\b(s1 city|city)\b/i, boostTokens: ["city", "capital", "walled", "town", "set_medieval_towns"], penalizeTokens: ["ruin", "crater"], worldSet: "set_medieval_towns", worldGroup: "settlements" },

  // =========================================================================
  // WORLD ATLAS — Landmarks, Beasts, Maritime & Cartography (scope: "world")
  // =========================================================================
  { scope: "world", match: /\b(land monsters|giant|basilisk|dragon|beast|griffin|hydra|wolf|bear|stag|eagle|wildlife|creature)\b/i, boostTokens: ["beast", "dragon", "monster", "wildlife", "set_beasts"], penalizeTokens: ["leyline", "spring", "ruin"], worldSet: "set_beasts", worldGroup: "landmarks" },
  { scope: "world", match: /\b(ruin|ruins|obelisk|monolith|statue|stonehenge|shrine|temple|portal|cave entrance|arch|pyramid|monument|grave|tomb)\b/i, boostTokens: ["landmark", "ruins", "ruin", "monolith", "arch", "temple", "set_landmarks"], worldSet: "set_landmarks", worldGroup: "landmarks" },
  { scope: "world", match: /\b(ship|ships|boat|galleon|caravel|sloop|brigantine|longship|frigate|schooner|airship|skyship|fleet|sail|carrack|cutter)\b/i, boostTokens: ["ship", "galleon", "caravel", "sloop", "sail", "vessel", "set_ships"], worldSet: "set_ships", worldGroup: "maritime" },
  { scope: "world", match: /\b(sea monsters|sea monster|kraken|serpent|leviathan|dragon sea|whale|mermaid|merman|maelstrom|whirlpool|reef|wreck|deep denizen|denizen|tentacle|seavaces)\b/i, boostTokens: ["serpent", "kraken", "whale", "sea", "monster", "hazard", "set_sea_hazards"], penalizeTokens: ["temple", "viaduct", "aqueduct"], worldSet: "set_sea_hazards", worldGroup: "maritime" },
  { scope: "world", match: /\b(compass|windrose|rose|roses|starburst|astrolabe|sun|moon)\b/i, boostTokens: ["compass", "rose", "windrose", "set_compasses"], worldSet: "set_compasses", worldGroup: "cartography" },
  { scope: "world", match: /\b(banner|scroll|ribbon|cartouche|plaque|frame)\b/i, boostTokens: ["banner", "scroll", "ribbon", "set_banners"], worldSet: "set_banners", worldGroup: "cartography" },
  { scope: "world", match: /\b(crest|shield|herald|flag|pin|marker|dot|star|icon)\b/i, boostTokens: ["heraldry", "marker", "crest", "set_heraldry"], worldSet: "set_heraldry", worldGroup: "cartography" },

  // =========================================================================
  // BATTLEMAP / DUNGEONDRAFT — Roofs, Terrain, Walls, Portals, Paths & Props (scope: "battlemap")
  // =========================================================================
  // Roofs
  { scope: "battlemap", categories: ["terrain"], onlyRoof: true, match: /\b(slate)\b/i, boostTokens: ["roof", "slate", "shingle", "grey"], penalizeTokens: ["terracotta", "clay", "thatch", "straw", "copper", "moss"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: true, match: /\b(thatch|thatched|straw)\b/i, boostTokens: ["roof", "thatch", "straw", "reed", "golden"], penalizeTokens: ["slate", "terracotta", "iron", "metal"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: true, match: /\b(terracotta|clay|red.*roof|roof.*red)\b/i, boostTokens: ["roof", "terracotta", "clay", "red", "tile"], penalizeTokens: ["slate", "thatch", "copper"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: true, match: /\b(wood|cedar|shake).*(roof|shingle)|\broof.*(wood|cedar|shake)\b/i, boostTokens: ["roof", "wood", "cedar", "shake", "shingle"], penalizeTokens: ["slate", "terracotta"] },
  // Terrain — distinct per-material rules so dirt, gravel, sand, limestone, sandstone, grass, brick & interior wood never collapse together
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(modernstreet.*road|concrete|asphalt|pavement)\b/i, boostTokens: ["garden", "gravel", "walk", "mausoleum", "marble", "grey", "street"], penalizeTokens: ["soot", "forge", "blacksmith", "dark", "wet", "sewer", "lava", "basalt", "cave", "mud", "moss", "roof", "ship", "slope", "scree", "talus"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(limestone)\b/i, boostTokens: ["garden", "gravel", "walk", "grey", "street", "stone", "ashlar"], penalizeTokens: ["moss", "outcrop", "cliff", "cave", "grotto", "ruin", "wet", "dark", "soot", "slope", "scree", "talus"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(terrain.*sandstone)\b/i, boostTokens: ["red", "clay", "badlands", "canyon", "earth", "desert", "outdoor"], penalizeTokens: ["paving", "royal", "castle", "courtyard", "mansion", "tile", "slope", "strata", "cliff", "dark", "wet", "soot", "cave"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(sandstone)\b/i, boostTokens: ["sandstone", "royal", "paving", "desert", "courtyard", "stone"], penalizeTokens: ["slope", "strata", "cliff", "canyon", "dark", "wet", "soot", "cave"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(gravel|shingle|pebble)\b/i, boostTokens: ["scree", "talus", "mountain", "slate", "rock", "gravel"], penalizeTokens: ["sand", "beach", "shore", "wet", "garden", "walk", "park", "slope", "water", "creek", "pebbles"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(dirt|soil|earth|loam)\b/i, boostTokens: ["dirt", "trail", "earth", "packed", "forest"], penalizeTokens: ["mud", "mire", "bog", "swamp", "gravel", "shingle", "sand", "straw", "barn", "clay", "badlands", "cave", "burrow", "slope", "roots"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(mud|mire|bog|swamp)\b/i, boostTokens: ["mud", "mire", "bog", "swamp"], penalizeTokens: ["sand", "snow", "grass", "stone"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(sand(?!stone)|beach|dune)\b/i, boostTokens: ["sandy", "riverbank", "sand", "warm", "beach", "coast"], penalizeTokens: ["wet", "pebbles", "shingle", "gravel", "dirt", "mud", "dark", "slope", "desert", "stone"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(grass|meadow|lawn|turf)\b/i, boostTokens: ["meadow", "grass", "lush", "green"], penalizeTokens: ["snow", "winter", "graveyard", "moss", "dry", "steppe", "savanna", "slope", "flower", "wildflower", "clover"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(moss)\b/i, boostTokens: ["moss", "forest", "floor", "turf", "pine"], penalizeTokens: ["gravel", "sand", "dirt", "snow", "crypt", "cobble", "rock", "outcrop"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(rocky|cliff|slate|granite|shale)\b/i, boostTokens: ["rocky", "cliff", "slate", "granite", "bedrock", "rock"], penalizeTokens: ["roof", "shingle", "slope", "sand", "grass", "wood", "brick", "snow", "lava"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(snow|ice|frost|glacier)\b/i, boostTokens: ["snow", "winter", "ice", "crisp"], penalizeTokens: ["grass", "dirt", "sand", "lava", "slope"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(lava|magma|volcanic|basalt)\b/i, boostTokens: ["volcanic", "basalt", "lava", "ash"], penalizeTokens: ["snow", "ice", "grass", "water"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(brick|basketweave)\b/i, boostTokens: ["garden", "brick", "patio", "alley", "masonry"], penalizeTokens: ["sewer", "wet", "crypt", "wood", "ship", "water", "roof"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(sewer|sewers)\b/i, boostTokens: ["sewer", "wet", "brick", "dungeon", "cobble"], penalizeTokens: ["wood", "grass", "sand"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(flagstone|cobble|paving|stone floor|cut stone|tileset.*stone)\b/i, boostTokens: ["cobble", "stone", "flagstone", "ashlar", "castle", "granite"], penalizeTokens: ["soot", "forge", "blacksmith", "lava", "cave", "slope", "roof", "water"] },
  { scope: "battlemap", categories: ["terrain"], onlyRoof: false, match: /\b(plank|wood|parquet|herringbone|timber|floorboard|deck)\b/i, boostTokens: ["tavern", "oak", "plank", "floor", "interior", "wood", "parquet"], penalizeTokens: ["ship", "boat", "deck", "hold", "pier", "airship", "skyship", "roof", "shingle", "shake", "pirate", "docks", "platform", "dark", "aged", "funeral", "walnut"] },
  // Walls
  { scope: "battlemap", categories: ["wall"], match: /\b(battlement|battlements|castle|fortress)\b/i, boostTokens: ["castle", "ashlar", "stone", "wall"], penalizeTokens: ["seawall", "ship", "yacht", "cave", "cavern", "water", "dock"] },
  { scope: "battlemap", categories: ["wall"], match: /\b(concrete|cement)\b/i, boostTokens: ["alpine", "castle", "ashlar", "stone", "wall"], penalizeTokens: ["seawall", "wet", "water", "cave", "cavern", "crystal", "moss", "ship"] },
  { scope: "battlemap", categories: ["wall"], match: /\b(walls.*stone|stone wall|wall stone|\bstone\b)\b/i, boostTokens: ["dungeon", "castle", "stone", "ashlar", "wall"], penalizeTokens: ["seawall", "wet", "water", "cave", "cavern", "crystal", "ship", "moss"] },
  { scope: "battlemap", categories: ["wall"], match: /\b(walls.*wood|wood wall|timber wall|palisade)\b/i, boostTokens: ["timber", "palisade", "cabin", "halftimber", "wood", "wall"], penalizeTokens: ["ship", "railing", "hull", "yacht"] },
  // Portals
  { scope: "battlemap", categories: ["portal"], match: /\b(door|doors)\b/i, boostTokens: ["door", "oak", "cottage", "tavern", "wood"], penalizeTokens: ["cemetery", "crypt", "vault", "clinic", "ship", "funicular", "aether", "saloon", "barn"] },
  { scope: "battlemap", categories: ["portal"], match: /\b(window|windows)\b/i, boostTokens: ["window", "shuttered", "leaded", "mullion", "cottage"], penalizeTokens: ["prison", "bakery", "porthole", "clinic", "slum", "grimy"] },
  // Paths
  { scope: "battlemap", categories: ["path"], match: /\b(streetline|roadline|lane.*line|yellow.*line|white.*line|road.*stripe)\b/i, boostTokens: ["colorable", "trim", "painted", "floor", "curb", "street"], penalizeTokens: ["water", "rapids", "foam", "stream", "creek", "brook", "wave", "river", "waterfall", "wake", "boat", "ship", "carpet", "runner", "arcane"] },
  { scope: "battlemap", categories: ["path"], match: /\b(rail.*without.*ties)\b/i, boostTokens: ["funicular", "rail", "track", "iron", "mine", "cart"], penalizeTokens: ["aether", "magirail", "pipe", "skyship", "railing", "rope", "stairs", "bridge", "water"] },
  { scope: "battlemap", categories: ["path"], match: /\b(rail|rails|railroad|railway|train\s*track|tram\s*track)\b/i, boostTokens: ["magirail", "funicular", "rail", "track"], penalizeTokens: ["railing", "rope", "stairs", "bridge", "water", "pipe", "skyship"] },
  { scope: "battlemap", categories: ["path"], match: /\b(stairs.*stone|stone.*stairs)\b/i, boostTokens: ["stone", "dungeon", "retaining", "stairs", "staircase"], penalizeTokens: ["iron", "fire", "escape", "wood", "timber", "marble"] },
  { scope: "battlemap", categories: ["path"], match: /\b(wooden.*fence|wood.*fence|\bfence\b|picket)\b/i, boostTokens: ["rope", "post", "fence", "barrier", "wooden"], penalizeTokens: ["water", "stream", "rapids", "rail", "track", "ship", "rigging"] },
  { scope: "battlemap", categories: ["path"], match: /\b(festival.*banner|banner|bunting|pennant|laundry)\b/i, boostTokens: ["laundry", "banner", "line", "berlin", "alley"], penalizeTokens: ["water", "stream", "rapids", "rail", "carpet", "runner"] },
  { scope: "battlemap", categories: ["path"], match: /\b(wagon|trail|dirt road|mud road|road|ruts)\b/i, boostTokens: ["wagon", "ruts", "gravel", "walkway", "muddy"], penalizeTokens: ["water", "foam", "wave", "rapids", "wake", "waterfall", "ship"] },
  { scope: "battlemap", categories: ["path"], match: /\b(shadow|crack|seam|curb)\b/i, boostTokens: ["crack", "curbing", "stones", "mossy"], penalizeTokens: ["water", "rapids", "foam", "wave"] },
  // Battlemap Objects — Flora, Water Plants, Produce & Farming
  { scope: "battlemap", categories: ["object"], match: /\b(waterlily|water lily|lily|lotus|lilypad)\b/i, boostTokens: ["lily", "lotus", "pad", "water", "flora"], penalizeTokens: ["sewing", "wheel", "tub", "basket"] },
  { scope: "battlemap", categories: ["object"], match: /\b(vine|vines|tendril|tendrils|ivy|briar|thorn|thorns|bramble|fern|ferns|roots|exposed roots)\b/i, boostTokens: ["flora", "fern", "bush", "willow", "frond", "moss", "leaves"], penalizeTokens: ["lamp", "dock", "dynamo", "spool", "stamp", "blueprint", "puddle"] },
  { scope: "battlemap", categories: ["object"], match: /\b(bush.*flower|flower.*bush|flowering.*shrub)\b/i, boostTokens: ["bush", "white", "blossom", "flora", "garden", "flower"], penalizeTokens: ["vase", "ceramic", "bedroom", "wreath", "funeral", "potted", "urn", "bouquet", "window", "box", "lily", "water", "hyacinth", "marigold", "table", "colorable"] },
  { scope: "battlemap", categories: ["object"], match: /\b(flower|flowers|flower bed|blossom)\b/i, boostTokens: ["flora", "wildflower", "flower", "marigold", "rose", "bush"], penalizeTokens: ["vase", "ceramic", "bedroom"] },
  { scope: "battlemap", categories: ["object"], match: /\b(cabbage|carrot|beet|root|potato|potatoes|onion|leek|turnip|pumpkin|vegetable|produce|farming|food greens)\b/i, boostTokens: ["cabbage", "carrot", "pumpkin", "farm", "harvest", "crate", "onion", "sacks"], penalizeTokens: ["table", "wave", "hammock", "barrel", "scuff", "croissant", "tea"] },
  { scope: "battlemap", categories: ["object"], match: /\b(bush.*green|green.*bush)\b/i, boostTokens: ["bush", "round", "green", "forest", "flora", "sprawling"], penalizeTokens: ["autumn", "russet", "gold", "holly", "winter", "frost", "snow", "thorny", "bramble", "planter", "boxwood", "topiary", "berry", "flower", "blossom", "colorable"] },
  { scope: "battlemap", categories: ["object"], match: /\b(grass|shrub|bush|reeds|reed|sedge|cattail)\b/i, boostTokens: ["grass", "flora", "bush", "wildflower", "cattail", "reed", "sedge"], penalizeTokens: ["frost", "snow", "winter", "planter", "colorable"] },
  { scope: "battlemap", categories: ["object"], match: /\b(tree.*branch|tree.*canopy|\btree\b)\b/i, boostTokens: ["tree", "oak", "broad", "deciduous", "green", "forest"], penalizeTokens: ["dead", "charred", "snow", "winter", "pine", "spruce", "palm", "banana", "coconut", "cypress", "willow", "autumn", "crimson", "golden", "cherry", "pink", "olive", "silver", "birch", "stump", "colorable"] },
  // Battlemap Objects — Smoke, Hazards, Weapons & Defense
  { scope: "battlemap", categories: ["object"], match: /\b(smoke|ash|soot|mist|fog|steam)\b/i, boostTokens: ["ash", "soot", "scatter", "decal", "hearth"], penalizeTokens: ["rug", "rowboat", "anchor", "crate", "bottle", "palm"] },
  { scope: "battlemap", categories: ["object"], match: /\b(wall spikes|floor spikes|spike|spikes|barricade|cheval|sandbag|barrier|barried)\b/i, boostTokens: ["spike", "trap", "spiked", "barricade", "palisade", "iron"], penalizeTokens: ["shelf", "tapestry", "lever", "witness", "stair"] },
  { scope: "battlemap", categories: ["object"], match: /\b(sword|swords|blade|dagger|axe|spear|arrow|arrows|bow|quiver|weapon|weapons)\b/i, boostTokens: ["sword", "swords", "weapon", "rack", "armory", "archery", "target"], penalizeTokens: ["cannon", "carronade", "searchlight", "turret", "flare", "ramming", "propeller", "ship"] },
  // Battlemap Objects — Furniture, Bedding, Carpets & Lighting
  { scope: "battlemap", categories: ["object"], match: /\b(table.*corner|corner.*table|l.*counter|bar.*counter)\b/i, boostTokens: ["bare", "oak", "counter", "shop", "tavern", "shaped"], penalizeTokens: ["triangular", "glass", "patio", "yacht", "ship", "captain", "dining", "round", "walnut", "birch", "pine", "straight", "stone"] },
  { scope: "battlemap", categories: ["object"], match: /\b(round.*table|table.*round)\b/i, boostTokens: ["round", "table", "tablecloth", "oak"], penalizeTokens: ["ottoman", "cushion", "velvet", "stool", "yacht", "cocktail", "ship", "captain", "chairs", "hero", "glass", "rect", "banquet", "dining", "long"] },
  { scope: "battlemap", categories: ["object"], match: /\b(small.*step|wooden.*step|wood.*step|\bsteps\b)\b/i, boostTokens: ["stoop", "steps", "stairs", "berlin", "stone", "timber", "wood", "landing"], penalizeTokens: ["quarterdeck", "ship", "stepping", "spiral", "ladder", "trapdoor", "companionway", "hatch", "weir", "dam", "swim", "raft"] },
  { scope: "battlemap", categories: ["object"], match: /\b(pillow|pillows|cushion|bolster)\b/i, boostTokens: ["cushion", "blanket", "bedroll", "pillow", "round"], penalizeTokens: ["throne", "table", "stove", "sofa", "armchair", "loveseat", "cot", "prison"] },
  { scope: "battlemap", categories: ["object"], match: /\b(carpet|rug|runner|floor cloth|camp mat)\b/i, boostTokens: ["rug", "carpet", "parlor", "woven", "noble", "oval"], penalizeTokens: ["crack", "shield", "vase", "pavilion", "tent"] },
  { scope: "battlemap", categories: ["object"], match: /\b(chandelier|pendant|hanging.*lamp|ceiling.*light)\b/i, boostTokens: ["ceiling", "chandelier", "pendant", "light", "harmony"], penalizeTokens: ["palm", "urn", "plaque", "nameplate", "floor_lamp", "table_lamp"] },
  { scope: "battlemap", categories: ["object"], match: /\b(sconce|wall.*torch|wall.*lamp|bracket.*lamp|bulkhead)\b/i, boostTokens: ["wall_sconce", "sconce", "light", "harmony"], penalizeTokens: ["floor_lamp", "table_lamp", "street_lamp"] },
  { scope: "battlemap", categories: ["object"], match: /\b(floor.*lamp|standing.*lamp|torchiere|candelabra)\b/i, boostTokens: ["floor_lamp", "candelabra", "torchiere", "light", "harmony"], penalizeTokens: ["palm", "urn", "plaque", "nameplate"] },
  { scope: "battlemap", categories: ["object"], match: /\b(desk.*lamp|table.*lamp|bedside.*lamp|banker.*lamp|oil.*lamp)\b/i, boostTokens: ["table_lamp", "desk_lamp", "bedside_lamp", "light", "harmony"], penalizeTokens: ["street_lamp", "chandelier"] },
  { scope: "battlemap", categories: ["object"], match: /\b(street.*lamp|lamppost|lamp.*post|bollard.*light|gaslamp)\b/i, boostTokens: ["street_lamp", "exterior", "gaslight", "light", "harmony"], penalizeTokens: ["table_lamp", "bedside_lamp"] },
  { scope: "battlemap", categories: ["object"], match: /\b(lamp|lantern|torch|candle|sconce|brazier)\b/i, boostTokens: ["lighting", "lantern", "lamp", "torch", "candle", "sconce", "brazier", "brass", "harmony"] },
  { scope: "battlemap", categories: ["object"], match: /\b(stairs|stair|staircase)\b/i, boostTokens: ["stair", "stairs", "landing", "spiral", "companionway", "stone", "wood"], penalizeTokens: ["weir", "dam", "oars", "lifering"] },
  { scope: "battlemap", categories: ["object"], match: /\b(ladder|ladders)\b/i, boostTokens: ["ladder", "oak", "rope", "iron"], penalizeTokens: ["slipway", "bridge"] },
  { scope: "battlemap", categories: ["object"], match: /\b(fireplace|hearth|chimney)\b/i, boostTokens: ["fireplace", "hearth", "castle", "tavern", "stone"], penalizeTokens: ["diving", "balustrade"] },
  { scope: "battlemap", categories: ["object"], match: /\b(bookshelf|bookcase)\b/i, boostTokens: ["bookshelf", "book", "library", "credenza", "shelf"], penalizeTokens: ["corner", "table", "chest"] },
  { scope: "battlemap", categories: ["object"], match: /\b(wardrobe|cabinet|cupboard)\b/i, boostTokens: ["wardrobe", "cabinet", "oak", "shelf"], penalizeTokens: ["cubby", "chest"] },
  { scope: "battlemap", categories: ["object"], match: /\b(sofa|couch|loveseat|settee)\b/i, boostTokens: ["sofa", "loveseat", "settee", "parlor", "lounge"], penalizeTokens: ["dining", "table"] },
  { scope: "battlemap", categories: ["object"], match: /\b(chair|armchair|stool|bench)\b/i, boostTokens: ["chair", "armchair", "stool", "bench", "oak"], penalizeTokens: ["yacht"] },
  // Battlemap Objects — Dining, Smithing, Logging, Clutter & Creatures
  { scope: "battlemap", categories: ["object"], match: /\b(cutting board|cutting boards)\b/i, boostTokens: ["kitchen", "bread", "plate", "tavern", "bowl"], penalizeTokens: ["chess", "board", "cauldron"] },
  { scope: "battlemap", categories: ["object"], match: /\b(bowl|plate|saucer|cup|mug|goblet|tankard|fork|knife|spoon|pan|pizza)\b/i, boostTokens: ["plate", "bowl", "pewter", "ceramic", "mug", "mess", "kitchen", "tavern"], penalizeTokens: ["table", "chair", "dining", "cauldron"] },
  { scope: "battlemap", categories: ["object"], match: /\b(cage|cages|kennel)\b/i, boostTokens: ["cage", "prison", "iron", "rusty"], penalizeTokens: ["dynamite", "crate"] },
  { scope: "battlemap", categories: ["object"], match: /\b(metal bar|ingot|anvil|bellows|tongs|hammer|mandrel|chisel|smithing|blacksmith|grinding wheel|workbench)\b/i, boostTokens: ["blacksmith", "anvil", "tongs", "hammer", "bellows", "toolbox", "coal", "workbench"], penalizeTokens: ["stool", "bar", "figurehead", "cocktail", "yacht", "valve"] },
  { scope: "battlemap", categories: ["object"], match: /\b(log pile|firewood|burned wood|log cutter|lumber)\b/i, boostTokens: ["firewood", "log", "stack", "stump", "axe", "mossy"], penalizeTokens: ["coal", "anvil", "raft"] },
  { scope: "battlemap", categories: ["object"], match: /\b(rubble|debris|broken pottery)\b/i, boostTokens: ["rubble", "brick", "debris", "crack", "amphorae", "pottery"], penalizeTokens: ["book", "gemstone", "sword", "vase"] },
  { scope: "battlemap", categories: ["object"], match: /\b(gravestone|headstone|grave|tomb|coffin)\b/i, boostTokens: ["grave", "celtic", "cross", "funeral", "coffin", "marker"], penalizeTokens: ["tree", "stepping"] },
  { scope: "battlemap", categories: ["object"], match: /\b(crate|crates|fruit box|box)\b/i, boostTokens: ["crate", "cargo", "oak", "stenciled", "cabbage"], penalizeTokens: ["tree", "cubby"] },
  { scope: "battlemap", categories: ["object"], match: /\b(barrel|barrels|keg|cask)\b/i, boostTokens: ["barrel", "ale", "keg", "wine", "cask"] },
  { scope: "battlemap", categories: ["object"], match: /\b(flag stand|banner|flag)\b/i, boostTokens: ["flag", "banner", "tournament"], penalizeTokens: ["pastry", "tea"] },
  { scope: "battlemap", categories: ["object"], match: /\b(picture frame|painting|tapestry)\b/i, boostTokens: ["framed", "tapestry", "map", "plaque"], penalizeTokens: ["scroll"] },
  { scope: "battlemap", categories: ["object"], match: /\b(gargoyle|statue)\b/i, boostTokens: ["statue", "lion", "guardian", "stone"], penalizeTokens: ["cutlass", "plaque"] },
  { scope: "battlemap", categories: ["object"], match: /\b(shovel|pitchfork|rake|hoe|tools)\b/i, boostTokens: ["saw", "mallet", "toolbox", "blacksmith", "farm"], penalizeTokens: ["ale", "mug", "oars"] },
  { scope: "battlemap", categories: ["object"], match: /\b(toilet|latrine|bathtub|washbasin)\b/i, boostTokens: ["bathtub", "washbasin", "washtub", "copper", "soapy"], penalizeTokens: ["cleat", "anchor"] },
  { scope: "battlemap", categories: ["object"], match: /\b(horse|stable|hay|straw|trough)\b/i, boostTokens: ["farm", "stable", "horse", "saddle", "trough", "hay", "straw", "bale"] },
  { scope: "battlemap", categories: ["object"], match: /\b(cat|kitten)\b/i, boostTokens: ["cat", "tabby", "sleeping", "cushion"], penalizeTokens: ["spider", "egg", "sac"] },
  { scope: "battlemap", categories: ["object"], match: /\b(bird|nest|duck)\b/i, boostTokens: ["ducks", "nest", "hen", "egg", "wildlife"], penalizeTokens: ["spider", "sac"] },
  { scope: "battlemap", categories: ["object"], match: /\b(egg|eggs)\b/i, boostTokens: ["egg", "basket", "nest", "farm", "spider"], penalizeTokens: ["wheel", "stool"] },
  { scope: "battlemap", categories: ["object"], match: /\b(mouse|rat|roe|creatures)\b/i, boostTokens: ["wildlife", "cat", "ducks", "egg", "basket"], penalizeTokens: ["gift", "wheel", "stool", "desk", "candle", "map", "spider", "crows"] },
  { scope: "battlemap", categories: ["object"], match: /\b(inker|ink|quill|scroll|paper|letter)\b/i, boostTokens: ["ink", "bottle", "scroll", "letter", "parchment", "stack"], penalizeTokens: ["pallet", "cargo"] },
  { scope: "battlemap", categories: ["object"], match: /\b(hammock)\b/i, boostTokens: ["hammock", "sailor", "canvas"], penalizeTokens: ["flag", "banner"] },
  { scope: "battlemap", categories: ["object"], match: /\b(mushroom|mushrooms|magic mushrooms)\b/i, boostTokens: ["mushroom", "crystal", "flora", "fungi", "arcane"], penalizeTokens: ["seal"] },
];

export function cleanSourceRefLabel(sourceRef: string): string {
  const norm = sourceRef.replace(/\\/g, "/").replace(/^(res|user):\/\//i, "");
  const parts = norm.split("/").filter(Boolean);
  const last = (parts[parts.length - 1] ?? norm).replace(/\.[^.]+$/, "");
  const parent = parts.length >= 2 ? parts[parts.length - 2] : "";
  const niceLast = last.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const niceParent = parent
    .replace(/^(premium_buildings_|sprites|symbols|trees|mountains|objects|textures)$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const label = niceParent && !niceLast.toLowerCase().includes(niceParent.toLowerCase())
    ? `${niceParent} · ${niceLast}`
    : niceLast || sourceRef;
  return label.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normalizeTailPath(p: string): string {
  return p
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/^(res|user):\/\//, "")
    .replace(/\.(png|webp|jpg|jpeg|svg)$/, "")
    .replace(/^\/+/, "");
}

function extractStem(p: string): string {
  const norm = normalizeTailPath(p);
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

const COMPOUND_SPLITS: Record<string, string[]> = {
  hugemount: ["huge", "mountain"],
  highmount: ["high", "mountain"],
  lowhill: ["low", "hill"],
  hiils: ["hill"],
  deadtree: ["dead", "tree"],
  waterlily: ["water", "lily"],
  gravestone: ["grave", "stone"],
  headstone: ["grave", "stone"],
  bookshelf: ["book", "shelf"],
  wheelbarrow: ["barrow"],
  campfire: ["camp", "fire"],
  sandbag: ["sand", "barricade"],
  watchtower: ["watch", "tower"],
  windrose: ["wind", "rose"],
  windmill: ["wind", "mill"],
  farmhouse: ["farm", "house"],
  palmsmall: ["palm"],
  lemoncolor: ["lemon"],
  pirat: ["pirate"],
};

function tokenizeText(text: string): string[] {
  const raw = text
    .toLowerCase()
    .replace(/\\/g, "/")
    .replace(/^(res|user):\/\//, "")
    .replace(/\.(png|webp|jpg|jpeg|svg)$/, "")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .replace(/(\d)([a-z])/g, "$1 $2")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));

  const out = new Set<string>();
  for (const t of raw) {
    out.add(t);
    const split = COMPOUND_SPLITS[t];
    if (split) {
      for (const s of split) out.add(s);
    }
    // Simple English singularization so `flowers`/`stairs`/`crates`/`swords`/`ruins` match singular tags!
    if (t.length >= 5 && t.endsWith("ies")) {
      out.add(`${t.slice(0, -3)}y`);
    } else if (t.length >= 5 && (t.endsWith("ches") || t.endsWith("shes") || t.endsWith("xes") || t.endsWith("ses"))) {
      out.add(t.slice(0, -2));
    } else if (t.length >= 4 && t.endsWith("s") && !t.endsWith("ss") && !t.endsWith("us") && !t.endsWith("is")) {
      out.add(t.slice(0, -1));
    }
  }
  return Array.from(out);
}

function hashStr(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function createAssetSwapIndex(
  vaultAssets: VaultAsset[],
  policy: AssetSwapPolicy = "prefer_installed",
): AssetSwapIndex {
  const pool =
    policy === "cc0_only"
      ? vaultAssets.filter((a) => a.sourceKind === "dcpack")
      : vaultAssets;
  const effectivePool = pool.length > 0 ? pool : vaultAssets;

  const candidates: IndexedCandidate[] = [];
  const byCategory = new Map<Exclude<AssetCategory, "all">, IndexedCandidate[]>();
  const roofCandidates: IndexedCandidate[] = [];
  const byTailPath = new Map<string, IndexedCandidate>();
  const byStem = new Map<string, IndexedCandidate[]>();

  for (let i = 0; i < effectivePool.length; i++) {
    const asset = effectivePool[i];
    const tailPath = normalizeTailPath(asset.internalPath || asset.id);
    const stem = extractStem(asset.internalPath || asset.id);
    const toks = new Set<string>([
      ...tokenizeText(asset.displayName),
      ...tokenizeText(asset.internalPath || asset.id),
      ...asset.tags.map((t) => t.toLowerCase()),
    ]);
    if (asset.worldGroup) toks.add(asset.worldGroup);
    const isRoofTex =
      asset.category === "terrain" &&
      (toks.has("roof") || toks.has("shingle") || toks.has("slate") || toks.has("thatch") || asset.id.toLowerCase().includes("roof_"));

    const cand: IndexedCandidate = {
      asset,
      tokens: toks,
      stem,
      tailPath,
      isCc0: asset.sourceKind === "dcpack",
      isHq: toks.has("hq") || asset.id.includes("hq_"),
      isRoofTex,
    };

    candidates.push(cand);
    const catArr = byCategory.get(asset.category);
    if (catArr) catArr.push(cand);
    else byCategory.set(asset.category, [cand]);

    if (isRoofTex) roofCandidates.push(cand);

    if (!byTailPath.has(tailPath)) byTailPath.set(tailPath, cand);
    const stemArr = byStem.get(stem);
    if (stemArr) stemArr.push(cand);
    else byStem.set(stem, [cand]);
  }

  return {
    policy,
    allVaultAssets: vaultAssets,
    candidates,
    byCategory,
    roofCandidates,
    byTailPath,
    byStem,
    familyCache: new Map<string, string[]>(),
  };
}

export function inferWorldGroupFromRef(
  sourceRef: string,
  wdTypeHint?: string,
): WorldAssetGroup {
  // Normalize `_`, `/`, `\` and `-` to spaces so word-boundary regexes match snake_case Wonderdraft paths!
  const low = sourceRef
    .toLowerCase()
    .replace(/[_/\\-]+/g, " ")
    .replace(/([a-z])(\d)/g, "$1 $2");

  // Clouds are often placed on Wonderdraft's mountains layer for z-ordering — detect first!
  if (/\b(cloud|clouds|cumulus|storm cloud)\b/.test(low)) {
    return /\b(isle|island|floating)\b/.test(low) ? "landmarks" : "cartography";
  }
  if (wdTypeHint === "tree") return "trees";
  if (wdTypeHint === "mountain") return "mountains";

  // Specific overrides before generic category checks
  if (/\b(field|fields|wheat|crop|farmland|mine|mines|quarry|bridge|bridges|viaduct|aqueduct|ruin|ruins|portal|land monsters|giant|basilisk|dragon|beast)\b/.test(low)) {
    return "landmarks";
  }
  if (/\b(waterfall|cascade|falls|cracked|fissure|chasm|rift|cliff|cliffs|rock|rocks|boulder|boulders|mountain|mountains|mtn|hill|hills|hiils|lowhill|highmount|hugemount|volcan|dune|mesa|ridge|crag|peak|peaks|plateau)\b/.test(low)) {
    return "mountains";
  }
  if (/\b(compass|windrose|rose|roses|banner|scroll|ribbon|frame|crest|herald|shield|marker|dot|pin)\b/.test(low)) {
    return "cartography";
  }
  if (/\b(lighthouse|ship|ships|boat|galleon|carrack|cutter|kraken|serpent|whale|sea monsters|sea monster|merman|mermaid|denizen|maelstrom|reef|wreck|seavaces)\b/.test(low)) {
    return "maritime";
  }
  if (/\b(deadtree|tree|trees|pine|oak|palm|forest|jungle|mangrove|shrub|bush|grass|flora|cactus|mushroom|flower|flowers|willow|poplar|hickory|birch|elm|cedar|xmas|christmas)\b/.test(low)) {
    return "trees";
  }
  if (/\b(building|buildings|build|house|houses|hamlet|castle|town|city|village|fort|fortress|keep|tower|watchtower|church|abbey|cathedral|mill|windmill|inn|smith|market|port|pier|dock|harbor|gate|citadel|palace|camp|tent|shack|block|orc|ork|orkish|pirat|dw )\b/.test(low)) {
    return "settlements";
  }
  return "landmarks";
}

/**
 * Only homogeneous species sets should cycle randomly across sibling variants on import.
 * Heterogeneous sets (`set_terrain_features`, `set_cliffs`, `set_landmarks`, `set_sea_hazards`)
 * mix wildly different subjects (e.g. grass tufts vs glowing leyline springs, chasms vs waterfalls)
 * and must NEVER cycle across unrelated icons!
 */
const HOMOGENEOUS_SPREAD_SETS = new Set([
  "set_pine",
  "set_oak",
  "set_snow_trees",
  "set_tropical",
  "set_autumn",
  "set_deadwood",
  "set_desert_flora",
  "set_rocky_peaks",
  "set_alpine_peaks",
  "set_volcanic",
  "set_hills",
  "set_desert_dunes",
  "set_clouds",
]);

function getFamilyVariantIds(index: AssetSwapIndex, asset: VaultAsset): string[] {
  const hit = index.familyCache.get(asset.id);
  if (hit) return hit;
  if (asset.category !== "symbol") {
    const single = [asset.id];
    index.familyCache.set(asset.id, single);
    return single;
  }
  const setTag = asset.tags.find((t) => t.startsWith("set_"));
  if (setTag && !HOMOGENEOUS_SPREAD_SETS.has(setTag)) {
    // Allow steppe grass tufts to spread strictly across grass-tuft siblings (never leyline springs or quarries!)
    if (asset.tags.includes("grass") && asset.worldGroup === "trees") {
      const grassSibs = index.allVaultAssets
        .filter(
          (a) =>
            a.category === "symbol" &&
            a.worldGroup === "trees" &&
            a.drawMode === asset.drawMode &&
            (index.policy !== "cc0_only" || a.sourceKind === "dcpack") &&
            a.tags.includes("grass") &&
            !a.tags.includes("lily") &&
            !a.tags.includes("bog"),
        )
        .map((a) => a.id);
      const out = grassSibs.length > 0 ? grassSibs : [asset.id];
      index.familyCache.set(asset.id, out);
      return out;
    }
    const single = [asset.id];
    index.familyCache.set(asset.id, single);
    return single;
  }
  const fam = findWorldSymbolFamilyVariants(
    asset,
    index.policy === "cc0_only"
      ? index.allVaultAssets.filter((a) => a.sourceKind === "dcpack")
      : index.allVaultAssets,
  );
  const ids = fam.variants.length > 0 ? fam.variants.map((v) => v.id) : [asset.id];
  index.familyCache.set(asset.id, ids);
  return ids;
}

export function resolveSwappedAsset(
  index: AssetSwapIndex,
  req: AssetSwapRequest,
): { asset: VaultAsset | null; variantIds: string[]; confidence: AssetSwapConfidence } {
  const normTail = normalizeTailPath(req.sourceRef);
  const stem = extractStem(req.sourceRef);

  // 1. Exact path / stem match when installed packs are allowed
  if (index.policy === "prefer_installed") {
    const exactTail = index.byTailPath.get(normTail);
    if (exactTail && exactTail.asset.category === req.expectedCategory) {
      return {
        asset: exactTail.asset,
        variantIds: [exactTail.asset.id],
        confidence: "exact",
      };
    }
    // Check suffix match against installed Wonderdraft/Dungeondraft packs (e.g. sprites/symbols/foo/bar)
    const stemMatches = index.byStem.get(stem);
    if (stemMatches && stemMatches.length > 0) {
      const sameCat = stemMatches.find((c) => c.asset.category === req.expectedCategory);
      if (sameCat) {
        return {
          asset: sameCat.asset,
          variantIds: [sameCat.asset.id],
          confidence: "exact",
        };
      }
    }
  }

  // 2. Select category pool (with dedicated roof texture pool when importing roofs,
  // and filtering out World Atlas parchment/ocean papers when matching Battlemap ground terrains!)
  let pool = req.isRoof && index.roofCandidates.length > 0
    ? index.roofCandidates
    : index.byCategory.get(req.expectedCategory) ?? index.candidates;
  if (req.expectedCategory === "terrain" && !req.isRoof) {
    const bmTerrains = pool.filter(
      (c) => !c.asset.id.includes("world-atlas") && !c.tokens.has("world"),
    );
    if (bmTerrains.length > 0) pool = bmTerrains;
  }
  if (pool.length === 0) pool = index.candidates;
  if (pool.length === 0) {
    return { asset: null, variantIds: [], confidence: "fallback" };
  }

  // 3. Extract source tokens + scoped synonym boosts & penalties
  const rawTokens = tokenizeText(req.sourceRef);
  const boostTokens = new Set<string>(rawTokens);
  const penalizeTokens = new Set<string>();
  const isWorldSymbol = req.expectedCategory === "symbol";
  let inferredSet: string | undefined;
  let inferredGroup = req.expectedWorldGroup;
  if (isWorldSymbol && !inferredGroup) {
    inferredGroup = inferWorldGroupFromRef(req.sourceRef, req.wdTypeHint);
  }

  const refForRegex = req.sourceRef
    .replace(/[_/\\-]+/g, " ")
    .replace(/([a-z])(\d)/gi, "$1 $2");
  let firstMatchedRuleGroup: WorldAssetGroup | undefined;
  for (const rule of SEMANTIC_SYNONYMS) {
    if (rule.scope === "world" && !isWorldSymbol) continue;
    if (rule.scope === "battlemap" && isWorldSymbol) continue;
    if (rule.categories && !rule.categories.includes(req.expectedCategory)) continue;
    if (rule.onlyRoof === true && !req.isRoof) continue;
    if (rule.onlyRoof === false && req.isRoof) continue;
    if (rule.match.test(refForRegex)) {
      for (const bt of rule.boostTokens) boostTokens.add(bt);
      if (rule.penalizeTokens) {
        for (const pt of rule.penalizeTokens) penalizeTokens.add(pt);
      }
      if (!inferredSet && rule.worldSet) inferredSet = rule.worldSet;
      if (isWorldSymbol && rule.worldGroup && !firstMatchedRuleGroup) {
        firstMatchedRuleGroup = rule.worldGroup;
      }
    }
  }
  // Allow an explicit first-matched World rule group to refine a generic default "landmarks" group
  if (isWorldSymbol && firstMatchedRuleGroup && (!inferredGroup || inferredGroup === "landmarks")) {
    inferredGroup = firstMatchedRuleGroup;
  }

  // 4. Score candidates deterministically
  let bestCand = pool[0];
  let bestScore = -1e9;
  const tieHash = hashStr(req.sourceRef);
  const wantsWaterfall = /\b(water|waterfall|cascade|falls)\b/i.test(refForRegex);
  const wantsFloatingIsle = /\b(isle|island|floating|sky island)\b/i.test(refForRegex);
  const wantsGhostOrAirship = /\b(ghost|undead|phantom|wreck|shipwreck|airship|skyship|dirigible)\b/i.test(refForRegex);
  const wantsEngravedLine = /\b(line_sea_monsters|line_ships|engraved|etched|copperplate)\b/i.test(req.sourceRef);
  const isRusticSettlement =
    /\b(village|farm|farmhouse|house|houses|hamlet|cottage|town|pirat|shack|barn|mill)\b/i.test(refForRegex) &&
    !/\b(crystal|magic|arcane|elven|fey|floating|glow)\b/i.test(refForRegex);
  const spreadSettlementTies =
    isWorldSymbol &&
    (inferredGroup === "settlements" || inferredSet === "set_medieval_towns");

  for (let i = 0; i < pool.length; i++) {
    const cand = pool[i];
    let score = 0;
    const matchesInferredSet = Boolean(inferredSet && cand.tokens.has(inferredSet));

    if (isWorldSymbol) {
      if (inferredGroup && cand.asset.worldGroup === inferredGroup) {
        score += 18;
      } else if (inferredGroup && cand.asset.worldGroup && cand.asset.worldGroup !== inferredGroup) {
        score -= 8;
      }
      if (matchesInferredSet) {
        score += 24;
      }
    }

    if (req.expectedDrawMode) {
      if (cand.asset.drawMode === req.expectedDrawMode) {
        // Gate drawMode bonus when a semantic set is inferred so drawMode coincidence never overrides set accuracy
        score += req.expectedDrawMode === "dd_red" ? 24 : !inferredSet || matchesInferredSet ? 7 : 1.5;
      } else if (req.expectedDrawMode === "rgb_channels" && cand.asset.drawMode === "normal") {
        // When a Wonderdraft custom-colored sprite has no rgb_channels counterpart in the matched set,
        // prefer consistent full-color CC0 sprites over monochrome ink/grayscale!
        score += 4.5;
      } else if (req.expectedDrawMode === "sample_color" && cand.asset.drawMode === "normal") {
        score += 2;
      } else if (req.expectedDrawMode === "rgb_channels" && cand.asset.drawMode === "tint") {
        score -= 3;
      }
    } else if (isWorldSymbol && cand.asset.drawMode === "normal") {
      score += 4;
    } else if (!isWorldSymbol && cand.asset.drawMode === "dd_red" && !boostTokens.has("colorable")) {
      // Avoid picking unpainted bright-red DD-colorable sprites when the imported element has no custom color!
      score -= 6;
    }

    // Prevent jarring visual mismatches across both World & Battlemap swaps
    if (
      !wantsWaterfall &&
      (cand.tokens.has("waterfall") || cand.tokens.has("cascade") || cand.tokens.has("falls"))
    ) {
      score -= 30;
    }
    if (
      !wantsFloatingIsle &&
      (cand.tokens.has("floating") || cand.tokens.has("sky_island"))
    ) {
      score -= 28;
    }
    if (
      isWorldSymbol &&
      inferredGroup === "maritime" &&
      !wantsGhostOrAirship &&
      (cand.tokens.has("ghost") || cand.tokens.has("airship") || cand.tokens.has("skyship") || cand.tokens.has("shipwreck"))
    ) {
      score -= 22;
    }
    if (
      wantsEngravedLine &&
      (cand.tokens.has("engraved") || cand.tokens.has("copperplate") || cand.asset.id.includes("exp_eng_"))
    ) {
      score += 14;
    }
    if (
      isRusticSettlement &&
      (cand.tokens.has("crystal") ||
        cand.tokens.has("glow") ||
        cand.tokens.has("floating") ||
        cand.tokens.has("arcane"))
    ) {
      score -= 25;
    }

    // Rule-specific anti-mismatch token penalties (only when token wasn't directly in the source ref or boosted by a more specific rule!)
    for (const pt of penalizeTokens) {
      if (!rawTokens.includes(pt) && !boostTokens.has(pt) && cand.tokens.has(pt)) {
        score -= 16;
      }
    }

    // Direct token hits
    let rawHits = 0;
    for (const tok of rawTokens) {
      if (cand.tokens.has(tok)) {
        score += 9;
        rawHits++;
      }
    }
    // Synonym-expanded token hits
    for (const tok of boostTokens) {
      if (!rawTokens.includes(tok) && cand.tokens.has(tok)) {
        score += 6;
      }
    }

    // Prefer crisp HQ CC0 assets & single symbols over giant clusters when matching individual trees/towns
    if (cand.isCc0) score += 2.5;
    if (cand.isHq) score += 1.5;
    if (req.wdTypeHint === "tree" && !boostTokens.has("cluster") && cand.tokens.has("cluster")) {
      score -= 10;
    }

    // Deterministic tie-breaker: gentle spread across equivalent CC0 settlements (hamlet_01..12, castle_01..06)
    // so distinct Wonderdraft house/castle models map to a richer variety of CC0 settlements instead of 1 icon!
    const tieScale = spreadSettlementTies ? 0.004 : 0.0005;
    score += (((tieHash ^ (i * 2654435761)) >>> 0) % 1000) * tieScale;

    if (rawHits === 0 && !inferredSet && score < 1) {
      // Keep fallback score low so confidence reflects fallback cleanly
    }

    if (score > bestScore) {
      bestScore = score;
      bestCand = cand;
    }
  }

  const confidence: AssetSwapConfidence =
    bestScore >= 36 ? "high" : bestScore >= 18 ? "medium" : "fallback";

  const variantIds = getFamilyVariantIds(index, bestCand.asset);
  return {
    asset: bestCand.asset,
    variantIds,
    confidence,
  };
}

/**
 * Deterministically picks a variant assetId for instance `instanceIndex` of a swapped asset.
 * When `spreadVariants` is true and the matched asset belongs to a multi-variant species family,
 * instances cycle naturally across variants without clumping!
 */
export function pickVariantForInstance(
  baseAssetId: string,
  variantIds: string[],
  sourceRef: string,
  instanceIndex: number,
  spreadVariants: boolean,
): string {
  if (!spreadVariants || variantIds.length <= 1) return baseAssetId;
  const len = variantIds.length;
  const base = hashStr(sourceRef) % len;
  // Deterministic coprime stride guarantees zero back-to-back repeats and uniform spread across all variants!
  const stride = len === 2 ? 1 : len % 3 !== 0 ? 3 : len % 2 !== 0 ? 2 : 1;
  const idx = (base + instanceIndex * stride) % len;
  return variantIds[idx];
}

/**
 * Bulk-swaps every instance across a DcMapDocument that originated from `sourceRef`
 * (tracked via `importedSourceRef`) to `nextAssetId` (or across its species family if `spreadVariants`).
 * Pure function returning `{ doc, swappedCount }`.
 */
export function applyBulkAssetSwapToDoc(
  doc: DcMapDocument,
  sourceRef: string,
  nextAssetId: string,
  vaultAssets: VaultAsset[],
  spreadVariants = false,
): { doc: DcMapDocument; swappedCount: number } {
  const targetAsset = vaultAssets.find((a) => a.id === nextAssetId);
  let variantIds = [nextAssetId];
  if (spreadVariants && targetAsset && targetAsset.category === "symbol") {
    const fam = findWorldSymbolFamilyVariants(targetAsset, vaultAssets);
    if (fam.variants.length > 1) {
      variantIds = fam.variants.map((v) => v.id);
    }
  }

  let swappedCount = 0;
  let instanceIdx = 0;
  const pickNext = () => {
    const picked = pickVariantForInstance(
      nextAssetId,
      variantIds,
      sourceRef,
      instanceIdx++,
      spreadVariants,
    );
    swappedCount++;
    return picked;
  };

  const nextLayers = doc.layers.map((layer) => {
    let changed = false;
    let objects = layer.objects;
    let walls = layer.walls;
    let portals = layer.portals;
    let paths = layer.paths;
    let roofs = layer.roofs;
    let terrainStrokes = layer.terrainStrokes;

    if (objects && objects.some((o) => o.importedSourceRef === sourceRef)) {
      changed = true;
      objects = objects.map((o) =>
        o.importedSourceRef === sourceRef ? { ...o, assetId: pickNext() } : o,
      );
    }
    if (walls && walls.some((w) => w.importedSourceRef === sourceRef)) {
      changed = true;
      walls = walls.map((w) =>
        w.importedSourceRef === sourceRef ? { ...w, assetId: pickNext() } : w,
      );
    }
    if (portals && portals.some((p) => p.importedSourceRef === sourceRef)) {
      changed = true;
      portals = portals.map((p) =>
        p.importedSourceRef === sourceRef ? { ...p, assetId: pickNext() } : p,
      );
    }
    if (paths && paths.some((p) => p.importedSourceRef === sourceRef)) {
      changed = true;
      paths = paths.map((p) =>
        p.importedSourceRef === sourceRef ? { ...p, assetId: pickNext() } : p,
      );
    }
    if (roofs && roofs.some((r) => r.importedSourceRef === sourceRef)) {
      changed = true;
      roofs = roofs.map((r) =>
        r.importedSourceRef === sourceRef ? { ...r, assetId: pickNext() } : r,
      );
    }
    if (terrainStrokes && terrainStrokes.some((t) => t.importedSourceRef === sourceRef)) {
      changed = true;
      terrainStrokes = terrainStrokes.map((t) =>
        t.importedSourceRef === sourceRef ? { ...t, assetId: pickNext() } : t,
      );
    }

    return changed
      ? { ...layer, objects, walls, portals, paths, roofs, terrainStrokes }
      : layer;
  });

  let nextCanvas = doc.canvas;
  if (doc.canvas.baseTerrainImportedRef === sourceRef) {
    nextCanvas = { ...doc.canvas, baseTerrainAssetId: pickNext() };
  }

  return {
    doc: {
      ...doc,
      canvas: nextCanvas,
      layers: nextLayers,
    },
    swappedCount,
  };
}

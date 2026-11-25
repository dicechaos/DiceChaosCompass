import { resolveBundledAssetUrl } from "@/engine/bundledAssetBase";
import type { BiomeKit, VaultAsset, VaultSource, WorldAssetGroup } from "@/types/map";

interface RawManifestAsset {
  path: string;
  displayName: string;
  category: VaultAsset["category"];
  tags: string[];
  drawMode: VaultAsset["drawMode"];
  defaultPpi: number;
  castsShadow: boolean;
  dominantHex: string;
  widthPx: number;
  heightPx: number;
  worldGroup?: WorldAssetGroup;
  anchorOffsetX?: number;
  anchorOffsetY?: number;
}

interface RawManifest {
  id: string;
  name: string;
  assets: RawManifestAsset[];
}

export const STARTER_SOURCE_ID = "src-starter-berlin-magipunk";
export const CORE_FANTASY_SOURCE_ID = "src-core-fantasy-cc0";
export const MODULAR_WORLD_SOURCE_ID = "src-modular-world-cc0";
export const WORLD_ATLAS_SOURCE_ID = "src-world-atlas-cc0";

export async function loadStarterVaultData(): Promise<{
  sources: VaultSource[];
  assets: VaultAsset[];
  biomeKits: BiomeKit[];
}> {
  const res = await fetch(resolveBundledAssetUrl("starter-cc0/manifest.json"));
  if (!res.ok) {
    throw new Error(`Failed loading starter manifest: ${res.status}`);
  }
  const manifest = (await res.json()) as RawManifest;
  const now = Math.floor(Date.now() / 1000);

  const assets: VaultAsset[] = manifest.assets.map((item) => ({
    id: item.path,
    sourceId: STARTER_SOURCE_ID,
    sourceName: "DiceChaos_Berlin_Magipunk_Starter.dcpack",
    sourceKind: "dcpack",
    internalPath: item.path,
    url: resolveBundledAssetUrl(`starter-cc0/${item.path}`),
    thumbUrl: resolveBundledAssetUrl(`starter-cc0/${item.path}`),
    displayName: item.displayName,
    category: item.category,
    widthPx: item.widthPx,
    heightPx: item.heightPx,
    defaultPpi: item.defaultPpi,
    drawMode: item.drawMode,
    dominantHex: item.dominantHex,
    castsShadow: item.castsShadow,
    isFavorite:
      item.path.includes("magipunk_funicular") ||
      item.path.includes("magirail_funicular") ||
      item.path.includes("aether_core_dynamo") ||
      item.path.includes("hochbahn_steel"),
    tags: item.tags,
  }));

  const sources: VaultSource[] = [
    {
      id: STARTER_SOURCE_ID,
      kind: "dcpack",
      name: "DiceChaos_Berlin_Magipunk_Starter.dcpack",
      rootPath: "public/assets/DiceChaos_Berlin_Magipunk_Starter.dcpack",
      enabled: true,
      assetCount: assets.length,
      ramEstimateMb: 9.8,
      lastIndexedAt: now,
    },
  ];

  // Load our clean-room CC0 Core Fantasy Essentials Suite (Tavern, Dungeon, Wilderness, Mansion & Castle)
  try {
    const cfRes = await fetch(resolveBundledAssetUrl("core-fantasy-cc0/manifest.json"));
    if (cfRes.ok) {
      const cfManifest = (await cfRes.json()) as RawManifest;
      const cfAssets: VaultAsset[] = cfManifest.assets.map((item) => ({
        id: `core-fantasy/${item.path}`,
        sourceId: CORE_FANTASY_SOURCE_ID,
        sourceName: "DiceChaos_Core_Fantasy_CC0.dcpack",
        sourceKind: "dcpack",
        internalPath: item.path,
        url: resolveBundledAssetUrl(`core-fantasy-cc0/${item.path}`),
        thumbUrl: resolveBundledAssetUrl(`core-fantasy-cc0/${item.path}`),
        displayName: item.displayName,
        category: item.category,
        widthPx: item.widthPx,
        heightPx: item.heightPx,
        defaultPpi: item.defaultPpi,
        drawMode: item.drawMode,
        dominantHex: item.dominantHex,
        castsShadow: item.castsShadow,
        isFavorite:
          item.path.includes("hero_tavern_bar") ||
          item.path.includes("hero_oak_tree") ||
          item.path.includes("hero_royal_throne") ||
          item.path.includes("pavilion_tent_colorable"),
        tags: item.tags,
      }));
      sources.push({
        id: CORE_FANTASY_SOURCE_ID,
        kind: "dcpack",
        name: "DiceChaos_Core_Fantasy_CC0.dcpack",
        rootPath: "public/assets/DiceChaos_Core_Fantasy_CC0.dcpack",
        enabled: true,
        assetCount: cfAssets.length,
        ramEstimateMb: Math.round((cfAssets.length * 0.08 + 1.2) * 10) / 10,
        lastIndexedAt: now,
      });
      assets.push(...cfAssets);
    }
  } catch {
    // Optional fallback if core fantasy pack is absent
  }

  // Load our clean-room CC0 Modular World & Everyday Scenes Suite (730+ atomic individual props, multi-variant trees/bushes/bare furniture & 150 dd_red colorables)
  try {
    const modRes = await fetch(resolveBundledAssetUrl("modular-suite-cc0/manifest.json"));
    if (modRes.ok) {
      const modManifest = (await modRes.json()) as RawManifest;
      const modAssets: VaultAsset[] = modManifest.assets.map((item) => ({
        id: `modular-suite/${item.path}`,
        sourceId: MODULAR_WORLD_SOURCE_ID,
        sourceName: "DiceChaos_Modular_Suite_CC0.dcpack",
        sourceKind: "dcpack",
        internalPath: item.path,
        url: resolveBundledAssetUrl(`modular-suite-cc0/${item.path}`),
        thumbUrl: resolveBundledAssetUrl(`modular-suite-cc0/${item.path}`),
        displayName: item.displayName,
        category: item.category,
        widthPx: item.widthPx,
        heightPx: item.heightPx,
        defaultPpi: item.defaultPpi,
        drawMode: item.drawMode,
        dominantHex: item.dominantHex,
        castsShadow: item.castsShadow,
        isFavorite:
          item.path.includes("ship_wheel_brass_oak") ||
          item.path.includes("sky_aether_turbine_pod") ||
          item.path.includes("sky_propeller_4blade") ||
          item.path.includes("sky_figurehead_winged_serpent") ||
          item.path.includes("tree_oak_broad") ||
          item.path.includes("bare_blotter_desk") ||
          item.path.includes("doc_exam_table") ||
          item.path.includes("bak_brick_bread_oven") ||
          item.path.includes("po_green_banker_lamp") ||
          item.path.includes("fun_closed_coffin"),
        tags: item.tags,
      }));
      sources.push({
        id: MODULAR_WORLD_SOURCE_ID,
        kind: "dcpack",
        name: "DiceChaos_Modular_Suite_CC0.dcpack",
        rootPath: "public/assets/DiceChaos_Modular_Suite_CC0.dcpack",
        enabled: true,
        assetCount: modAssets.length,
        ramEstimateMb: Math.round((modAssets.length * 0.055 + 1.5) * 10) / 10,
        lastIndexedAt: now,
      });
      assets.push(...modAssets);
    }
  } catch {
    // Optional fallback if modular suite pack is absent
  }

  // Load our clean-room CC0 World Atlas Cartography Suite (544 hand-inked watercolor world symbols & paper/ocean textures)
  try {
    const waRes = await fetch(resolveBundledAssetUrl("world-atlas-cc0/manifest.json"));
    if (waRes.ok) {
      const waManifest = (await waRes.json()) as RawManifest;
      const waAssets: VaultAsset[] = waManifest.assets.map((item) => ({
        id: `world-atlas/${item.path}`,
        sourceId: WORLD_ATLAS_SOURCE_ID,
        sourceName: "DiceChaos_World_Atlas_CC0.dcpack",
        sourceKind: "dcpack",
        internalPath: item.path,
        url: resolveBundledAssetUrl(`world-atlas-cc0/${item.path}`),
        thumbUrl: resolveBundledAssetUrl(`world-atlas-cc0/${item.path}`),
        displayName: item.displayName,
        category: item.category,
        worldGroup: item.worldGroup,
        widthPx: item.widthPx,
        heightPx: item.heightPx,
        defaultPpi: item.defaultPpi,
        drawMode: item.drawMode,
        dominantHex: item.dominantHex,
        castsShadow: item.castsShadow,
        anchorOffsetX: item.anchorOffsetX,
        anchorOffsetY: item.anchorOffsetY,
        isFavorite:
          item.path.includes("hero_walled_capital_city.png") ||
          item.path.includes("hero_alpine_massif_peak.png") ||
          item.path.includes("hero_ornate_compass_rose.png") ||
          item.path.includes("hero_sailing_galleon_ship.png") ||
          item.path.includes("hero_elven_spire_citadel.png") ||
          item.path.includes("hero_dwarven_mountain_gate.png"),
        tags: item.tags,
      }));
      sources.push({
        id: WORLD_ATLAS_SOURCE_ID,
        kind: "dcpack",
        name: "DiceChaos_World_Atlas_CC0.dcpack",
        rootPath: "public/assets/DiceChaos_World_Atlas_CC0.dcpack",
        enabled: true,
        assetCount: waAssets.length,
        ramEstimateMb: Math.round((waAssets.length * 0.085 + 2.0) * 10) / 10,
        lastIndexedAt: now,
      });
      assets.push(...waAssets);
    }
  } catch {
    // Optional fallback if world atlas pack is absent
  }

  // Gracefully load local user Dungeondraft & Wonderdraft packs indexed from ExtraAsses/
  try {
    const extraRes = await fetch("/assets/user-packs/extra_manifest.json");
    if (extraRes.ok) {
      const extraData = (await extraRes.json()) as {
        sources?: Array<{
          id: string;
          kind: VaultSource["kind"];
          name: string;
          rootPath: string;
          enabled: boolean;
          assetCount: number;
          ramEstimateMb: number;
        }>;
        assets?: Array<{
          id: string;
          sourceId: string;
          sourceName: string;
          sourceKind: VaultAsset["sourceKind"];
          internalPath: string;
          displayName: string;
          category: VaultAsset["category"];
          worldGroup?: WorldAssetGroup;
          widthPx: number;
          heightPx: number;
          defaultPpi: number;
          drawMode: VaultAsset["drawMode"];
          dominantHex: string;
          castsShadow: boolean;
          anchorOffsetX?: number;
          anchorOffsetY?: number;
          tags: string[];
        }>;
      };
      for (const src of extraData.sources ?? []) {
        sources.push({
          ...src,
          lastIndexedAt: now,
        });
      }
      for (const item of extraData.assets ?? []) {
        const streamUrl = `/user-pack-asset?id=${encodeURIComponent(item.id)}`;
        assets.push({
          ...item,
          url: streamUrl,
          thumbUrl: streamUrl,
          isFavorite: false,
        });
      }
    }
  } catch {
    // Extra user packs are optional in clean open-source checkouts
  }

  const isCc0BuiltIn = (a: VaultAsset) => a.sourceKind === "dcpack";
  const cc0ByTags = (tags: string[]) =>
    assets
      .filter((a) => isCc0BuiltIn(a) && a.tags.some((t) => tags.includes(t)))
      .map((a) => a.id);

  const biomeKits: BiomeKit[] = [
    ...(assets.some((a) => a.sourceId === WORLD_ATLAS_SOURCE_ID)
      ? [
          {
            id: "kit-cc0-world-atlas",
            name: "World Atlas Cartography (CC0)",
            accentHex: "#D97706",
            assetIds: assets
              .filter((a) => a.sourceId === WORLD_ATLAS_SOURCE_ID && a.category === "symbol")
              .map((a) => a.id),
          },
        ]
      : []),
    {
      id: "kit-cc0-water-scenes",
      name: "Water, Shorelines & Yachts",
      accentHex: "#0EA5E9",
      assetIds: cc0ByTags([
        "water_suite",
        "water",
        "lake",
        "river",
        "shore",
        "ripple",
        "foam",
        "lily",
        "lotus",
        "reeds",
        "pier",
        "dock",
        "buoy",
        "fishing",
        "kayak",
        "canoe",
        "raft",
        "yacht",
      ]),
    },
    {
      id: "kit-cc0-ships-airships",
      name: "Ships, Airships & Shipyard",
      accentHex: "#38BDF8",
      assetIds: cc0ByTags([
        "shipbuilding",
        "ship",
        "airship",
        "skyship",
        "boat",
        "shipyard",
        "nautical",
        "hull",
        "deck",
        "rigging",
      ]),
    },
    {
      id: "kit-cc0-nature",
      name: "Trees, Bushes & Nature",
      accentHex: "#34D399",
      assetIds: cc0ByTags([
        "tree",
        "bush",
        "fern",
        "flower",
        "rock",
        "boulder",
        "stump",
        "log",
        "nature",
        "flora",
        "mushroom",
        "wilderness",
        "outdoor",
        "grass",
        "moss",
        "dirt",
      ]),
    },
    {
      id: "kit-cc0-outdoor-terrains",
      name: "Outdoor Terrains (Grass, Dirt & Rock)",
      accentHex: "#22C55E",
      assetIds: assets
        .filter(
          (a) =>
            a.category === "terrain" &&
            a.tags.some((t) =>
              [
                "outdoor",
                "grass",
                "meadow",
                "moss",
                "forest",
                "dirt",
                "clay",
                "gravel",
                "shingle",
                "rock",
                "granite",
                "limestone",
                "scree",
                "sand",
                "cliff",
              ].includes(t.toLowerCase()),
            ),
        )
        .map((a) => a.id),
    },
    {
      id: "kit-cc0-bare-furniture",
      name: "Bare Modular Furniture",
      accentHex: "#D97706",
      assetIds: cc0ByTags(["bare", "table", "desk", "counter", "bench", "stool", "shelf", "pedestal"]),
    },
    {
      id: "kit-cc0-doctor",
      name: "Doctor's Office & Apothecary",
      accentHex: "#38BDF8",
      assetIds: cc0ByTags(["doctor", "clinic", "medical", "apothecary", "herb", "potion"]),
    },
    {
      id: "kit-cc0-bakery-kitchen",
      name: "Bakery, Kitchen & Pantry",
      accentHex: "#F59E0B",
      assetIds: cc0ByTags(["bakery", "kitchen", "pantry", "bread", "pastry", "cookware", "food"]),
    },
    {
      id: "kit-cc0-post-study",
      name: "Post Office, Bank & Study",
      accentHex: "#60A5FA",
      assetIds: cc0ByTags(["post_office", "bank", "study", "school", "courtroom", "office", "book", "paper"]),
    },
    {
      id: "kit-cc0-funeral",
      name: "Funeral & Graveyard",
      accentHex: "#94A3B8",
      assetIds: cc0ByTags(["funeral", "graveyard", "coffin", "tombstone", "crypt", "urn", "wreath"]),
    },
    {
      id: "kit-cc0-forge-market",
      name: "Blacksmith, Market & Tailor",
      accentHex: "#FB923C",
      assetIds: cc0ByTags(["blacksmith", "forge", "workshop", "market", "tailor", "shop", "fabric"]),
    },
    {
      id: "kit-cc0-tavern-home",
      name: "Tavern, Home & Noble Tea",
      accentHex: "#F472B6",
      assetIds: cc0ByTags(["tavern", "inn", "bedroom", "bath", "home", "tea", "music", "theater", "festival"]),
    },
    {
      id: "kit-cc0-temple-arcane",
      name: "Temple, Library & Alchemy",
      accentHex: "#A78BFA",
      assetIds: cc0ByTags(["temple", "chapel", "ritual", "library", "alchemy", "arcane", "magic", "scroll"]),
    },
    {
      id: "kit-cc0-dungeon-mining",
      name: "Armory, Dungeon & Mining",
      accentHex: "#C084FC",
      assetIds: cc0ByTags(["armory", "dungeon", "prison", "mining", "cavern", "underdark", "crystal", "weapon"]),
    },
    {
      id: "kit-cc0-farm-docks-camp",
      name: "Farm, Camp, Docks & Streets",
      accentHex: "#2DD4BF",
      assetIds: cc0ByTags(["farm", "stable", "barn", "camp", "docks", "ship", "street", "alley", "sewer"]),
    },
    {
      id: "kit-berlin-magipunk",
      name: "Berlin Magi-Punk Funicular",
      accentHex: "#22D3EE",
      assetIds: assets
        .filter((a) =>
          a.tags.some((t) => ["magipunk", "berlin", "aether", "funicular"].includes(t)),
        )
        .map((a) => a.id),
    },
    ...(assets.some((a) => a.sourceKind === "dungeondraft_pack")
      ? [
          {
            id: "kit-dd-2mt",
            name: "Dungeondraft 2MT Library",
            accentHex: "#38BDF8",
            assetIds: assets
              .filter((a) => a.sourceKind === "dungeondraft_pack")
              .map((a) => a.id),
          },
        ]
      : []),
    ...(assets.some((a) => a.sourceKind === "wonderdraft")
      ? [
          {
            id: "kit-wd-worlds",
            name: "Wonderdraft World Symbols",
            accentHex: "#F472B6",
            assetIds: assets
              .filter((a) => a.sourceKind === "wonderdraft")
              .map((a) => a.id),
          },
        ]
      : []),
  ];

  return { sources, assets, biomeKits };
}

import { describe, expect, it } from "vitest";
import { createBlankMap } from "@/data/funicularShowcaseMap";
import {
  applyBulkAssetSwapToDoc,
  createAssetSwapIndex,
  pickVariantForInstance,
  resolveSwappedAsset,
} from "@/engine/assetSwapEngine";
import { DEFAULT_RECOLOR, type VaultAsset } from "@/types/map";

function makeVaultFixture(): VaultAsset[] {
  const base = (
    id: string,
    displayName: string,
    category: VaultAsset["category"],
    overrides: Partial<VaultAsset> = {},
  ): VaultAsset => ({
    id,
    sourceId: "src-world-atlas-cc0",
    sourceName: "DiceChaos CC0",
    sourceKind: "dcpack",
    internalPath: id,
    url: `/${id}`,
    thumbUrl: `/${id}`,
    displayName,
    category,
    widthPx: 256,
    heightPx: 256,
    defaultPpi: 256,
    drawMode: "normal",
    dominantHex: "#6B8E23",
    castsShadow: true,
    isFavorite: false,
    tags: [],
    ...overrides,
  });

  return [
    base("world/pine_01.png", "Alpine Pine 1", "symbol", {
      worldGroup: "trees",
      tags: ["world", "trees", "pine", "set_pine"],
    }),
    base("world/pine_02.png", "Alpine Pine 2", "symbol", {
      worldGroup: "trees",
      tags: ["world", "trees", "pine", "set_pine"],
    }),
    base("world/castle_01.png", "Stone Castle Keep", "symbol", {
      worldGroup: "settlements",
      tags: ["world", "settlements", "castle", "village", "set_medieval_towns"],
    }),
    base("world/crystal_spire_01.png", "Glowing Crystal Spire", "symbol", {
      worldGroup: "settlements",
      drawMode: "rgb_channels",
      tags: ["world", "settlements", "crystal", "glow", "arcane", "set_fantasy_cities"],
    }),
    base("world/cliff_waterfall_01.png", "Cliff Waterfall Cascade", "symbol", {
      worldGroup: "mountains",
      tags: ["world", "mountains", "cliff", "waterfall", "set_cliffs"],
    }),
    base("world/cliff_crag_01.png", "Rocky Cliff Crag", "symbol", {
      worldGroup: "mountains",
      tags: ["world", "mountains", "cliff", "crag", "chasm", "fissure", "set_cliffs"],
    }),
    base("world/exp_stp_grass_tufts.png", "Steppe Grass Tufts", "symbol", {
      worldGroup: "trees",
      tags: ["world", "trees", "grass", "steppe", "set_terrain_features"],
    }),
    base("world/exp_feat_leyline_spring.png", "Glowing Leyline Spring", "symbol", {
      worldGroup: "landmarks",
      tags: ["world", "landmarks", "leyline", "magic", "set_terrain_features"],
    }),
    base("world/exp_cld_ivory_cumulus.png", "Billowing Ivory Cloud", "symbol", {
      worldGroup: "cartography",
      tags: ["world", "cartography", "cloud", "cumulus", "set_clouds"],
    }),
    base("world/exp_cld_ring_forest_isle.png", "Floating Forest Sky Island", "symbol", {
      worldGroup: "landmarks",
      tags: ["world", "landmarks", "cloud", "floating", "sky_island", "set_clouds"],
    }),
    base("world/exp_feat_wheat_fields.png", "Patchwork Golden Wheat Fields", "symbol", {
      worldGroup: "landmarks",
      tags: ["world", "landmarks", "farm", "wheat", "fields", "rural", "set_terrain_features"],
    }),
    base("world/hero_dwarven_mountain_gate.png", "Dwarven Mountain Gate", "symbol", {
      worldGroup: "settlements",
      tags: ["world", "settlements", "dwarven", "dwarf", "mountain", "fortress", "gate", "set_fantasy_cities"],
    }),
    base("world/hero_headland_lighthouse.png", "Rocky Headland Lighthouse", "symbol", {
      worldGroup: "maritime",
      tags: ["world", "maritime", "lighthouse", "coast", "beacon", "tower", "set_sea_hazards"],
    }),
    base("modular-suite/terrain/roof_golden_thatch_straw.png", "Cottage Golden Reed Thatch Roof", "terrain", {
      tags: ["roof", "thatch", "straw", "reed"],
    }),
    base("modular-suite/paths/path_wagon_ruts.png", "Muddy Wagon Wheel Ruts", "path", {
      tags: ["path", "wagon", "ruts", "muddy"],
    }),
    base("modular-suite/paths/water_shore_foam_wave.png", "Lapping Shoreline Foam Wave Trail", "path", {
      tags: ["path", "water", "shore", "foam", "wave", "trail"],
    }),
    base("wd-pack/hatch_pine_07.png", "User Hatch Pine 07", "symbol", {
      sourceId: "src-user-wd",
      sourceName: "User Wonderdraft Pack",
      sourceKind: "wonderdraft",
      worldGroup: "trees",
      tags: ["wonderdraft", "trees", "pine"],
    }),
    base("modular-suite/terrain/roof_slate_tiles.png", "Slate Shingle Roof", "terrain", {
      tags: ["roof", "slate", "shingle"],
    }),
    base("walls/stone_masonry.png", "Stone Masonry Wall", "wall", {
      tags: ["wall", "stone", "masonry"],
    }),
    base("portals/wooden_door.png", "Wooden Door", "portal", {
      tags: ["door", "wood", "portal"],
    }),
  ];
}

describe("assetSwapEngine", () => {
  it("matches installed user pack assets in prefer_installed mode and swaps cleanly to CC0 in cc0_only mode", () => {
    const vault = makeVaultFixture();

    const installedIdx = createAssetSwapIndex(vault, "prefer_installed");
    const exactHit = resolveSwappedAsset(installedIdx, {
      sourceRef: "res://sprites/trees/hatch_pine/hatch_pine_07",
      expectedCategory: "symbol",
      wdTypeHint: "tree",
    });
    expect(exactHit.confidence).toBe("exact");
    expect(exactHit.asset?.id).toBe("wd-pack/hatch_pine_07.png");

    const cc0Idx = createAssetSwapIndex(vault, "cc0_only");
    const cc0Hit = resolveSwappedAsset(cc0Idx, {
      sourceRef: "res://sprites/trees/hatch_pine/hatch_pine_07",
      expectedCategory: "symbol",
      wdTypeHint: "tree",
    });
    expect(cc0Hit.asset?.sourceKind).toBe("dcpack");
    expect(cc0Hit.asset?.id).toMatch(/^world\/pine_0[12]\.png$/);
    expect(cc0Hit.variantIds).toHaveLength(2);
    expect(["high", "medium"]).toContain(cc0Hit.confidence);

    // Deterministic spreading picks across multiple pine variants
    const picks = new Set(
      Array.from({ length: 8 }, (_, i) =>
        pickVariantForInstance(cc0Hit.asset!.id, cc0Hit.variantIds, "hatch_pine_07", i, true),
      ),
    );
    expect(picks.size).toBe(2);
  });

  it("matches Dungeondraft roofs, walls, and portals semantically and supports bulk re-swapping", () => {
    const vault = makeVaultFixture();
    const idx = createAssetSwapIndex(vault, "cc0_only");

    const roof = resolveSwappedAsset(idx, {
      sourceRef: "res://textures/roofs/round_slate_gray/tiles.png",
      expectedCategory: "terrain",
      isRoof: true,
    });
    expect(roof.asset?.id).toBe("modular-suite/terrain/roof_slate_tiles.png");

    const door = resolveSwappedAsset(idx, {
      sourceRef: "res://textures/portals/door_00.png",
      expectedCategory: "portal",
    });
    expect(door.asset?.id).toBe("portals/wooden_door.png");

    // Bulk swap replaces all objects sharing importedSourceRef in one immutable pass
    const doc = createBlankMap("Swap Test", 20, 20);
    const objLayer = doc.layers.find((l) => l.kind === "objects")!;
    objLayer.objects = [
      {
        id: "o1",
        assetId: "world/pine_01.png",
        x: 2,
        y: 2,
        widthCells: 1,
        heightCells: 1,
        rotationRad: 0,
        flipX: false,
        flipY: false,
        opacity: 1,
        castsShadow: true,
        locked: false,
        recolor: { ...DEFAULT_RECOLOR },
        zOrder: 10,
        importedSourceRef: "res://sprites/trees/hatch_pine/hatch_pine_07",
      },
      {
        id: "o2",
        assetId: "world/pine_01.png",
        x: 4,
        y: 4,
        widthCells: 1,
        heightCells: 1,
        rotationRad: 0,
        flipX: false,
        flipY: false,
        opacity: 1,
        castsShadow: true,
        locked: false,
        recolor: { ...DEFAULT_RECOLOR },
        zOrder: 10,
        importedSourceRef: "res://sprites/trees/hatch_pine/hatch_pine_07",
      },
    ];

    const swapped = applyBulkAssetSwapToDoc(
      doc,
      "res://sprites/trees/hatch_pine/hatch_pine_07",
      "world/castle_01.png",
      vault,
      false,
    );
    expect(swapped.swappedCount).toBe(2);
    const outObjs = swapped.doc.layers.find((l) => l.id === objLayer.id)!.objects!;
    expect(outObjs.every((o) => o.assetId === "world/castle_01.png")).toBe(true);
    // Original doc untouched
    expect(objLayer.objects[0].assetId).toBe("world/pine_01.png");
  });

  it("avoids waterfall cliffs for cracked earth and crystal spires for rustic villages", () => {
    const vault = makeVaultFixture();
    const idx = createAssetSwapIndex(vault, "cc0_only");

    const crackHit = resolveSwappedAsset(idx, {
      sourceRef: "user://assets/myassets/sprites/symbols/cracks/cracked-earth-01a.png",
      expectedCategory: "symbol",
      wdTypeHint: "symbol",
    });
    expect(crackHit.asset?.id).toBe("world/cliff_crag_01.png");

    const villageHit = resolveSwappedAsset(idx, {
      sourceRef: "res://sprites/symbols/premium_buildings/village_houses_01_color",
      expectedCategory: "symbol",
      expectedDrawMode: "rgb_channels",
      wdTypeHint: "symbol",
    });
    expect(villageHit.asset?.id).toBe("world/castle_01.png");

    // Plain Wonderdraft clouds swap strictly to cartography clouds, never floating forest islands!
    const cloudHit = resolveSwappedAsset(idx, {
      sourceRef: "res://sprites/mountains/~clouds_comics_color/cloud_comics_col_05",
      expectedCategory: "symbol",
      wdTypeHint: "mountain",
    });
    expect(cloudHit.asset?.id).toBe("world/exp_cld_ivory_cumulus.png");
    expect(cloudHit.variantIds).not.toContain("world/exp_cld_ring_forest_isle.png");

    // Grass tufts never cycle into heterogeneous terrain features like glowing leyline springs!
    const grassHit = resolveSwappedAsset(idx, {
      sourceRef: "res://sprites/trees/inked_grass/grass_01",
      expectedCategory: "symbol",
      wdTypeHint: "tree",
    });
    expect(grassHit.asset?.id).toBe("world/exp_stp_grass_tufts.png");
    expect(grassHit.variantIds).not.toContain("world/exp_feat_leyline_spring.png");

    // Wonderdraft crop fields, dwarven castles, lighthouses, waterfalls & Dungeondraft thatch/wagon trails match accurately
    expect(
      resolveSwappedAsset(idx, {
        sourceRef: "res://sprites/symbols/farm_village_colored/field_08_simple_color",
        expectedCategory: "symbol",
        wdTypeHint: "symbol",
      }).asset?.id,
    ).toBe("world/exp_feat_wheat_fields.png");

    expect(
      resolveSwappedAsset(idx, {
        sourceRef: "user://assets/myassets/sprites/symbols/premium_buildings_dwarven/dw_big_castle",
        expectedCategory: "symbol",
        wdTypeHint: "symbol",
      }).asset?.id,
    ).toBe("world/hero_dwarven_mountain_gate.png");

    expect(
      resolveSwappedAsset(idx, {
        sourceRef: "user://assets/official_premium_pirates_pack/sprites/symbols/pirates_imperial_buildings_custom_colors/imperial_lighthouse_custom",
        expectedCategory: "symbol",
        wdTypeHint: "symbol",
      }).asset?.id,
    ).toBe("world/hero_headland_lighthouse.png");

    expect(
      resolveSwappedAsset(idx, {
        sourceRef: "res://sprites/symbols/rocks_and_more_colored/waterfall_02_color",
        expectedCategory: "symbol",
        wdTypeHint: "symbol",
      }).asset?.id,
    ).toBe("world/cliff_waterfall_01.png");

    expect(
      resolveSwappedAsset(idx, {
        sourceRef: "res://textures/roofs/thatched/tiles.png",
        expectedCategory: "terrain",
        isRoof: true,
      }).asset?.id,
    ).toBe("modular-suite/terrain/roof_golden_thatch_straw.png");

    expect(
      resolveSwappedAsset(idx, {
        sourceRef: "res://textures/paths/wagon_trail.png",
        expectedCategory: "path",
      }).asset?.id,
    ).toBe("modular-suite/paths/path_wagon_ruts.png");
  });
});

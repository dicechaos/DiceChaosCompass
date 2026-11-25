import { describe, expect, it } from "vitest";
import {
  CATEGORY_FACETS,
  matchesCategoryFacet,
  matchesSubGroup,
  OBJECT_SUBGROUPS,
  useVaultStore,
} from "@/store/vaultStore";
import type { VaultAsset, VaultSource } from "@/types/map";

function makeAsset(
  id: string,
  overrides: Partial<VaultAsset> = {},
): VaultAsset {
  return {
    id,
    sourceId: overrides.sourceId ?? "src-test",
    sourceName: overrides.sourceName ?? "Test Pack",
    sourceKind: overrides.sourceKind ?? "dcpack",
    internalPath: overrides.internalPath ?? id,
    url: `/${id}`,
    thumbUrl: `/${id}`,
    displayName: overrides.displayName ?? `Test ${id}`,
    category: overrides.category ?? "object",
    widthPx: overrides.widthPx ?? 256,
    heightPx: overrides.heightPx ?? 256,
    defaultPpi: 256,
    drawMode: overrides.drawMode ?? "normal",
    dominantHex: overrides.dominantHex ?? "#8899AA",
    castsShadow: true,
    isFavorite: overrides.isFavorite ?? false,
    tags: overrides.tags ?? ["stone", "test"],
  };
}

function makeSource(id: string, name = "Pack"): VaultSource {
  return {
    id,
    kind: "dcpack",
    name,
    rootPath: `/${id}`,
    enabled: true,
    assetCount: 1,
    ramEstimateMb: 0.5,
    lastIndexedAt: 1,
  };
}

describe("vaultStore indexing, sorting, taxonomy, and templates state", () => {
  it("keeps O(1) assetById map synchronized across favorites, tags, and source removal", () => {
    const a1 = makeAsset("obj/crate.png", { sourceId: "src-a" });
    const a2 = makeAsset("obj/barrel.png", { sourceId: "src-b" });

    useVaultStore.setState({
      sources: [makeSource("src-a", "Pack A"), makeSource("src-b", "Pack B")],
      assets: [a1, a2],
      assetById: new Map([
        [a1.id, a1],
        [a2.id, a2],
      ]),
      initialized: true,
      loading: false,
    });
    useVaultStore.getState().clearDrawerFilters();

    expect(useVaultStore.getState().getAssetById(a1.id)?.displayName).toBe("Test obj/crate.png");

    useVaultStore.getState().toggleFavoriteAsset(a1.id);
    expect(useVaultStore.getState().getAssetById(a1.id)?.isFavorite).toBe(true);
    expect(useVaultStore.getState().assetById.get(a1.id)?.isFavorite).toBe(true);

    useVaultStore.getState().addTagToAsset(a1.id, "tavern");
    expect(useVaultStore.getState().getAssetById(a1.id)?.tags).toContain("tavern");

    useVaultStore.getState().removeTagFromAsset(a1.id, "tavern");
    expect(useVaultStore.getState().getAssetById(a1.id)?.tags).not.toContain("tavern");

    useVaultStore.getState().removeSource("src-a");
    expect(useVaultStore.getState().getAssetById(a1.id)).toBeUndefined();
    expect(useVaultStore.getState().getAssetById(a2.id)?.id).toBe(a2.id);
  });

  it("supports all VaultSortMode orders and relevance-ranked search", () => {
    const lamp = makeAsset("modular-suite/props/harmony_lighting/lgt_lamp.png", {
      displayName: "Brass Desk Lamp",
      widthPx: 140,
      heightPx: 140,
      dominantHex: "#E5A93C",
      isFavorite: false,
      tags: ["lighting", "lamp", "harmony"],
    });
    const zebra = makeAsset("obj/zebra_statue.png", {
      displayName: "Zebra Marble Statue",
      widthPx: 512,
      heightPx: 512,
      dominantHex: "#3B82F6",
      isFavorite: true,
      tags: ["lamp_holder", "statue"],
    });
    const altar = makeAsset("modular-suite/props/subterranean_caves/sub_altar.png", {
      displayName: "Ancient Stone Altar",
      widthPx: 256,
      heightPx: 208,
      dominantHex: "#EF4444",
      isFavorite: false,
      tags: ["subterranean", "altar", "harmony"],
    });

    const assets = [zebra, altar, lamp];
    useVaultStore.setState({
      sources: [makeSource("src-test")],
      assets,
      assetById: new Map(assets.map((a) => [a.id, a])),
      initialized: true,
      loading: false,
    });

    const st = useVaultStore.getState();
    st.clearDrawerFilters();
    st.setActiveCategory("object");

    // Name A -> Z & Z -> A
    st.setSortMode("name_asc");
    expect(useVaultStore.getState().getFilteredAssets().map((a) => a.displayName)).toEqual([
      "Ancient Stone Altar",
      "Brass Desk Lamp",
      "Zebra Marble Statue",
    ]);
    st.setSortMode("name_desc");
    expect(useVaultStore.getState().getFilteredAssets().map((a) => a.displayName)).toEqual([
      "Zebra Marble Statue",
      "Brass Desk Lamp",
      "Ancient Stone Altar",
    ]);

    // Size Largest / Smallest First
    st.setSortMode("size_desc");
    expect(useVaultStore.getState().getFilteredAssets()[0].id).toBe(zebra.id);
    st.setSortMode("size_asc");
    expect(useVaultStore.getState().getFilteredAssets()[0].id).toBe(lamp.id);

    // Favorites First
    st.setSortMode("favorites");
    expect(useVaultStore.getState().getFilteredAssets()[0].id).toBe(zebra.id);

    // Studio Harmony First puts subterranean/lighting before plain objects
    st.setSortMode("harmony_first");
    expect(useVaultStore.getState().getFilteredAssets()[2].id).toBe(zebra.id);

    // Color Spectrum orders red (0°) -> gold (~39°) -> blue (~217°)
    st.setSortMode("color_hue");
    expect(useVaultStore.getState().getFilteredAssets().map((a) => a.id)).toEqual([
      altar.id,
      lamp.id,
      zebra.id,
    ]);

    // Curated relevance search: searching "lamp" ranks "Brass Desk Lamp" above tag-only "lamp_holder"
    st.setSortMode("curated");
    st.setSearchQuery("lamp");
    expect(useVaultStore.getState().getFilteredAssets().map((a) => a.id)).toEqual([
      lamp.id,
      zebra.id,
    ]);
  });

  it("matches new lighting & subterranean object groups, category facets, and templatesView transitions", () => {
    expect(OBJECT_SUBGROUPS.some((g) => g.id === "lighting")).toBe(true);
    expect(OBJECT_SUBGROUPS.some((g) => g.id === "subterranean")).toBe(true);
    expect(CATEGORY_FACETS.portal?.some((f) => f.id === "secret")).toBe(true);
    expect(CATEGORY_FACETS.terrain?.some((f) => f.id === "world_texture")).toBe(true);

    const sconce = makeAsset("modular-suite/props/harmony_lighting/lgt_sconce_iron.png", {
      displayName: "Iron Wall Sconce",
      tags: ["lighting", "sconce", "harmony"],
    });
    const cavePool = makeAsset("modular-suite/props/subterranean_caves/sub_cave_tidepool.png", {
      displayName: "Bioluminescent Tidepool",
      tags: ["subterranean", "cave", "harmony"],
    });
    const secretDoor = makeAsset("modular-suite/portals/harmony/door_secret_stone_pivot.png", {
      displayName: "Secret Pivoting Stone Door",
      category: "portal",
      tags: ["portal", "secret", "door", "harmony"],
    });
    const worldPaper = makeAsset("world-atlas/textures/parchment_vellum.png", {
      displayName: "Vellum Parchment",
      category: "terrain",
      tags: ["world_texture", "parchment"],
    });

    expect(matchesSubGroup(sconce, "lighting")).toBe(true);
    expect(matchesSubGroup(cavePool, "subterranean")).toBe(true);
    expect(matchesCategoryFacet(secretDoor, "portal", "secret")).toBe(true);
    expect(matchesCategoryFacet(secretDoor, "portal", "windows")).toBe(false);
    expect(matchesCategoryFacet(worldPaper, "terrain", "world_texture")).toBe(true);

    const st = useVaultStore.getState();
    st.setTemplatesView(true);
    expect(useVaultStore.getState().templatesView).toBe(true);
    st.setTemplateCategoryFilter("interiors");
    expect(useVaultStore.getState().templateCategoryFilter).toBe("interiors");
    st.setActiveCategory("wall");
    expect(useVaultStore.getState().templatesView).toBe(false);
    expect(useVaultStore.getState().activeCategory).toBe("wall");
    st.clearDrawerFilters();
    expect(useVaultStore.getState().activeCategory).toBe("all");
    expect(useVaultStore.getState().templatesView).toBe(false);
  });
});

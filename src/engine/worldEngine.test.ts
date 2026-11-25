import { describe, expect, it } from "vitest";
import worldAtlasManifest from "../../public/assets/world-atlas-cc0/manifest.json";
import { createWorldShowcaseMap } from "@/data/worldShowcaseMap";
import {
  buildMeanderingRiverGeometry,
  createDefaultWorldData,
  createDetailWorldFromBounds,
  decodeMaskB64,
  decodeMaskB64Cached,
  encodeMaskB64,
  findWorldSymbolFamilyVariants,
  formatOverlandTravelMeasure,
  generateLandmassHeightmap,
  hitTestWorldLabel,
  hitTestWorldRegion,
  hitTestWorldRiver,
  hitTestWorldTrail,
  isPointOnLand,
  pickNextWorldVariant,
  sampleWorldBiomeColor,
  sculptWorldHeightmap,
} from "@/engine/worldEngine";
import type { VaultAsset, WorldLandmassPreset } from "@/types/map";

describe("worldEngine", () => {
  it("round-trips binary heightfields through base64 cleanly", () => {
    const src = new Uint8Array(64);
    for (let i = 0; i < src.length; i++) src[i] = (i * 19 + 7) & 255;
    const b64 = encodeMaskB64(src);
    const decoded = decodeMaskB64(b64, src.length);
    expect(Array.from(decoded)).toEqual(Array.from(src));
  });

  it("generates balanced, deterministic landmasses for all 7 Wizard presets", () => {
    const presets: WorldLandmassPreset[] = [
      "continents",
      "archipelago",
      "pangaea",
      "atoll",
      "inland_sea",
      "highlands",
      "equirectangular",
    ];
    for (const preset of presets) {
      const a = generateLandmassHeightmap({ preset, seed: 4207, waterLevel: 0.46, roughness: 0.6 });
      const b = generateLandmassHeightmap({ preset, seed: 4207, waterLevel: 0.46, roughness: 0.6 });
      expect(a.heightmapB64).toBe(b.heightmapB64);

      let landCount = 0;
      for (let i = 0; i < a.heightmap.length; i++) {
        if (a.heightmap[i] >= 128) landCount++;
      }
      const landRatio = landCount / a.heightmap.length;
      expect(landRatio).toBeGreaterThan(0.05);
      expect(landRatio).toBeLessThan(0.95);
    }
  });

  it("sculpts fractal coastlines (raise, lower, smooth) and inland freshwater lakes", () => {
    const world = createDefaultWorldData({ preset: "continents", seed: 101 });
    // Raise a dedicated island at map center
    const raised = sculptWorldHeightmap(world, [{ x: 24, y: 13.5 }], 48, 27, {
      mode: "raise",
      radiusCells: 3.5,
      roughness: 0.5,
      strength: 1.0,
      seed: 12,
    });
    const wRaised = { ...world, heightmapB64: raised.heightmapB64 };
    // Repeat raise twice so center is guaranteed above sea level
    const raised2 = sculptWorldHeightmap(wRaised, [{ x: 24, y: 13.5 }], 48, 27, {
      mode: "raise",
      radiusCells: 3.5,
      roughness: 0.3,
      strength: 1.0,
      seed: 13,
    });
    const wLand = { ...wRaised, heightmapB64: raised2.heightmapB64 };
    expect(isPointOnLand(wLand, { x: 24, y: 13.5 }, 48, 27)).toBe(true);

    // Carve an inland freshwater lake inside that raised island
    const laked = sculptWorldHeightmap(wLand, [{ x: 24, y: 13.5 }], 48, 27, {
      mode: "lake_carve",
      radiusCells: 1.8,
      roughness: 0.2,
      strength: 1.0,
      seed: 14,
    });
    const wLake = { ...wLand, freshwaterB64: laked.freshwaterB64 };
    // Freshwater lake is not dry land!
    expect(isPointOnLand(wLake, { x: 24, y: 13.5 }, 48, 27)).toBe(false);

    // Erase the lake back to dry land
    const filled = sculptWorldHeightmap(wLake, [{ x: 24, y: 13.5 }], 48, 27, {
      mode: "lake_erase",
      radiusCells: 2.2,
      roughness: 0.2,
      strength: 1.0,
      seed: 15,
    });
    expect(isPointOnLand({ ...wLake, freshwaterB64: filled.freshwaterB64 }, { x: 24, y: 13.5 }, 48, 27)).toBe(true);
  });

  it("samples painted biome ground colors for Wonderdraft sample_color symbols", () => {
    const world = createDefaultWorldData({ themeId: "parchment" });
    const baseHex = sampleWorldBiomeColor(world, { x: 10, y: 10 });
    expect(baseHex).toBe(world.theme.landBaseColorHex.toUpperCase());

    world.biomeStrokes.push({
      id: "wb-test",
      points: [{ x: 10, y: 10 }],
      radiusCells: 4,
      colorHex: "#206020",
      opacity: 1,
      softness: 0.5,
      roughness: 0.3,
      seed: 1,
    });
    const paintedHex = sampleWorldBiomeColor(world, { x: 10, y: 10 });
    expect(paintedHex).toBe("#206020");

    // Ocean-targeted watercolor washes and stipple dot overlays must NOT bleed into land biome sampling!
    world.biomeStrokes.push({
      id: "wb-ocean-only",
      target: "ocean",
      points: [{ x: 10, y: 10 }],
      radiusCells: 6,
      colorHex: "#0000FF",
      opacity: 1,
      softness: 0.5,
      roughness: 0.3,
      seed: 2,
    });
    world.biomeStrokes.push({
      id: "wb-stipple-only",
      target: "land",
      pattern: "stipple",
      points: [{ x: 10, y: 10 }],
      radiusCells: 6,
      colorHex: "#3A2F23",
      opacity: 0.9,
      softness: 0.5,
      roughness: 0.3,
      seed: 3,
    });
    expect(sampleWorldBiomeColor(world, { x: 10, y: 10 })).toBe("#206020");
  });

  it("builds tapered meandering rivers pinned at spring and mouth", () => {
    const geom = buildMeanderingRiverGeometry({
      id: "r1",
      points: [
        { x: 5, y: 5 },
        { x: 12, y: 10 },
        { x: 18, y: 14 },
      ],
      startWidthCells: 0.08,
      endWidthCells: 0.5,
      meanderRoughness: 0.55,
      meanderScale: 1.1,
      curved: true,
      seed: 77,
    });
    expect(geom.centerline.length).toBeGreaterThan(20);
    expect(geom.polygon.length).toBe(geom.centerline.length * 2);
    // Endpoints remain pinned cleanly
    expect(geom.centerline[0].x).toBeCloseTo(5, 3);
    expect(geom.centerline[0].y).toBeCloseTo(5, 3);
    const last = geom.centerline[geom.centerline.length - 1];
    expect(last.x).toBeCloseTo(18, 3);
    expect(last.y).toBeCloseTo(14, 3);
  });

  it("crops and upsamples a World Atlas into a Regional Detail Atlas", () => {
    const parent = createWorldShowcaseMap();
    const detail = createDetailWorldFromBounds(parent, { x0: 8, y0: 6, x1: 22, y1: 20 }, "Eldermere Region");
    expect(detail).not.toBeNull();
    expect(detail!.mode).toBe("world");
    expect(detail!.meta.title).toContain("Eldermere Region");
    expect(detail!.world!.heightmapB64.length).toBeGreaterThan(100);
    // Miles per cell should scale down proportionally to the zoomed-in crop!
    expect(detail!.world!.overlays.scaleBar.milesPerCell).toBeLessThan(
      parent.world!.overlays.scaleBar.milesPerCell,
    );

    // Rejects degenerate tiny crops
    expect(createDetailWorldFromBounds(parent, { x0: 10, y0: 10, x1: 10.2, y1: 10.2 })).toBeNull();
  });

  it("formats overland travel distances and travel-time days accurately", () => {
    const world = createDefaultWorldData();
    world.overlays.scaleBar.milesPerCell = 24;
    world.overlays.scaleBar.unit = "miles";
    world.overlays.travelMode = "walk";
    expect(formatOverlandTravelMeasure(4, world.overlays)).toContain("96 mi");
    expect(formatOverlandTravelMeasure(4, world.overlays)).toContain("4.0d by Foot");

    world.overlays.travelMode = "airship";
    expect(formatOverlandTravelMeasure(4, world.overlays)).toContain("by Airship");

    world.overlays.scaleBar.unit = "leagues";
    expect(formatOverlandTravelMeasure(3, world.overlays)).toContain("leagues");
  });

  it("hit-tests World labels, rivers, trails, and political regions", () => {
    const doc = createWorldShowcaseMap();
    const w = doc.world!;
    const firstLabel = w.labels[0];
    expect(hitTestWorldLabel({ x: firstLabel.x, y: firstLabel.y }, w.labels, 28)?.id).toBe(firstLabel.id);
    // High-zoom (400% -> 128 px/cell) precision hit test on a miniature 6.5px village label
    const microLbl = { ...firstLabel, id: "micro-1", text: "Ashcross", fontSizePx: 6.5, x: 10, y: 10 };
    expect(hitTestWorldLabel({ x: 10, y: 10 }, [microLbl], 128)?.id).toBe("micro-1");
    expect(hitTestWorldLabel({ x: 10, y: 10.65 }, [microLbl], 128)).toBeNull();

    const firstRiver = w.rivers[0];
    expect(hitTestWorldRiver(firstRiver.points[1], w.rivers)?.id).toBe(firstRiver.id);

    const firstTrail = w.trails[0];
    expect(hitTestWorldTrail(firstTrail.points[0], w.trails)?.id).toBe(firstTrail.id);

    const reg = w.regions[0];
    const cx = reg.polygon.reduce((a, p) => a + p.x, 0) / reg.polygon.length;
    const cy = reg.polygon.reduce((a, p) => a + p.y, 0) / reg.polygon.length;
    expect(hitTestWorldRegion({ x: cx, y: cy }, w.regions)?.id).toBe(reg.id);
  });

  it("isolates species families and prevents back-to-back repeats for Multi-Variant Paint-In", () => {
    const makeSym = (
      id: string,
      overrides: Partial<VaultAsset>,
    ): VaultAsset => ({
      id,
      sourceId: "src-world-atlas-cc0",
      sourceName: "DiceChaos World Atlas CC0",
      sourceKind: "dcpack",
      internalPath: id,
      url: `/${id}`,
      thumbUrl: `/${id}`,
      displayName: id,
      category: "symbol",
      worldGroup: "trees",
      widthPx: 256,
      heightPx: 256,
      defaultPpi: 256,
      drawMode: "normal",
      dominantHex: "#3F6212",
      castsShadow: true,
      isFavorite: false,
      tags: ["world", "trees"],
      ...overrides,
    });

    const pine1 = makeSym("pine1", { tags: ["world", "trees", "set_pine"] });
    const pine2 = makeSym("pine2", { tags: ["world", "trees", "set_pine"] });
    const pinePaintable = makeSym("pine_p1", {
      drawMode: "sample_color",
      tags: ["world", "trees", "set_pine", "sample_color"],
    });
    const pineCluster = makeSym("pine_c1", {
      tags: ["world", "trees", "set_pine", "cluster"],
    });
    const oak1 = makeSym("oak1", { tags: ["world", "trees", "set_oak"] });
    const wdTrop1 = makeSym("wd_t1", {
      sourceId: "src-wd-pirates",
      sourceKind: "wonderdraft",
      internalPath: "sprites/trees/pirates_trees_tropical/t1.png",
      tags: ["wonderdraft", "trees"],
    });
    const wdTrop2 = makeSym("wd_t2", {
      sourceId: "src-wd-pirates",
      sourceKind: "wonderdraft",
      internalPath: "sprites/trees/pirates_trees_tropical/t2.png",
      tags: ["wonderdraft", "trees"],
    });
    const wdMang1 = makeSym("wd_m1", {
      sourceId: "src-wd-pirates",
      sourceKind: "wonderdraft",
      internalPath: "sprites/trees/pirates_trees_mangrove/m1.png",
      tags: ["wonderdraft", "trees"],
    });

    const pool = [pine1, pine2, pinePaintable, pineCluster, oak1, wdTrop1, wdTrop2, wdMang1];

    // Strict species + drawMode + single-vs-cluster isolation
    const pineFam = findWorldSymbolFamilyVariants(pine1, pool);
    expect(pineFam.familyLabel).toBe("Alpine Pines");
    expect(pineFam.variants.map((v) => v.id)).toEqual(["pine1", "pine2"]);

    // Wonderdraft subfolder fallback isolates tropical palms from mangroves
    const wdFam = findWorldSymbolFamilyVariants(wdTrop1, pool);
    expect(wdFam.variants.map((v) => v.id)).toEqual(["wd_t1", "wd_t2"]);

    // Non-repeating picker never repeats lastAssetId when 2+ variants exist
    for (let i = 0; i < 20; i++) {
      const picked = pickNextWorldVariant([pine1, pine2], "pine1", () => (i % 10) / 10);
      expect(picked.id).toBe("pine2");
    }
  });

  it("ships 1,450+ clean-room CC0 World Atlas assets with multi-variant species sets, HQ vellum textures & colorable options", () => {
    const raw = worldAtlasManifest;
    expect(raw.assets.length).toBeGreaterThanOrEqual(1450);

    const byMode: Record<string, number> = {};
    const setCounts: Record<string, number> = {};
    for (const a of raw.assets) {
      byMode[a.drawMode] = (byMode[a.drawMode] ?? 0) + 1;
      if (a.drawMode === "normal") {
        const setTag = a.tags.find((t) => t.startsWith("set_"));
        if (setTag) setCounts[setTag] = (setCounts[setTag] ?? 0) + 1;
      }
    }
    expect(byMode.normal).toBeGreaterThanOrEqual(400);
    expect(byMode.sample_color).toBeGreaterThanOrEqual(400);
    expect(byMode.tint).toBeGreaterThanOrEqual(350);

    for (const requiredSet of [
      "set_pine",
      "set_oak",
      "set_snow_trees",
      "set_tropical",
      "set_autumn",
      "set_deadwood",
      "set_desert_flora",
      "set_fey_flora",
      "set_alpine_peaks",
      "set_rocky_peaks",
      "set_hills",
      "set_desert_dunes",
      "set_volcanic",
      "set_cliffs",
      "set_medieval_towns",
      "set_fantasy_cities",
      "set_world_cities",
      "set_dark_forts",
      "set_landmarks",
      "set_ships",
      "set_sea_hazards",
      "set_beasts",
      "set_compasses",
      "set_banners",
      "set_heraldry",
    ]) {
      expect(setCounts[requiredSet], `expected >= 9 variants in ${requiredSet}`).toBeGreaterThanOrEqual(9);
    }
  });

  it("caches decoded base64 masks for read-only lookups while isolating mutable decodes", () => {
    const src = new Uint8Array(128);
    for (let i = 0; i < src.length; i++) src[i] = (i * 13 + 5) & 255;
    const b64 = encodeMaskB64(src);

    const cachedA = decodeMaskB64Cached(b64, src.length);
    const cachedB = decodeMaskB64Cached(b64, src.length);
    expect(cachedA).toBe(cachedB);
    expect(cachedA[10]).toBe(src[10]);

    // Mutable decode returns an independent copy so sculpting never corrupts cached buffers
    const mutable = decodeMaskB64(b64, src.length);
    expect(mutable).not.toBe(cachedA);
    mutable[10] = (mutable[10] ^ 0xff) & 255;
    expect(decodeMaskB64Cached(b64, src.length)[10]).toBe(src[10]);
  });
});

import { describe, expect, it } from "vitest";
import starterManifest from "../../public/assets/starter-cc0/manifest.json";
import coreManifest from "../../public/assets/core-fantasy-cc0/manifest.json";
import modularManifest from "../../public/assets/modular-suite-cc0/manifest.json";
import { createSovereignTempleMap } from "./sovereignTempleMap";
import { sortLevelsTopDown, useDocumentStore } from "@/store/documentStore";

describe("Cathedral of the Sovereign (5F) — Multi-Floor Map Integrity", () => {
  it("contains all 5 lived-in interior levels plus spire ROOF with valid top-down ordering", () => {
    const doc = createSovereignTempleMap();
    expect(doc.id).toBe("map-sovereign-temple-5f");
    expect(doc.levels.map((l) => l.shortCode)).toEqual(["B3", "B2", "B1", "1F", "2F", "3F", "4F", "5F", "ROOF"]);
    expect(sortLevelsTopDown(doc.levels).map((l) => l.shortCode)).toEqual([
      "ROOF",
      "5F",
      "4F",
      "3F",
      "2F",
      "1F",
      "B1",
      "B2",
      "B3",
    ]);

    for (const code of ["B3", "B2", "B1", "1F", "2F", "3F", "4F", "5F"]) {
      const lv = doc.levels.find((l) => l.shortCode === code)!;
      const lvLayers = doc.layers.filter((l) => l.levelId === lv.id);
      const objCount = lvLayers.reduce((n, l) => n + (l.objects?.length ?? 0), 0);
      const lightCount = lvLayers.reduce((n, l) => n + (l.lights?.length ?? 0), 0);
      const dmCount = lvLayers.reduce((n, l) => n + (l.dmNotes?.length ?? 0), 0);
      expect(objCount, `${code} props`).toBeGreaterThanOrEqual(25);
      expect(lightCount, `${code} lights`).toBeGreaterThanOrEqual(6);
      for (const lgt of lvLayers.flatMap((l) => l.lights ?? [])) {
        expect(Number.isFinite(lgt.coneAngleDeg), `${lgt.id} coneAngleDeg`).toBe(true);
        expect(Number.isFinite(lgt.directionRad), `${lgt.id} directionRad`).toBe(true);
      }
      expect(dmCount, `${code} DM notes`).toBeGreaterThanOrEqual(2);
      for (const note of lvLayers.flatMap((l) => l.dmNotes ?? [])) {
        expect(["TRAP", "SECRET", "HAZARD", "AMBUSH", "NOTE"]).toContain(note.badge);
      }
    }

    const roofLv = doc.levels.find((l) => l.shortCode === "ROOF")!;
    const roofs = doc.layers
      .filter((l) => l.levelId === roofLv.id)
      .flatMap((l) => l.roofs ?? []);
    expect(roofs.length).toBeGreaterThanOrEqual(20);
    // Verify cone roofs have [center, rim] 2-point geometry
    for (const r of roofs.filter((x) => x.style === "cone")) {
      expect(r.points.length).toBe(2);
    }
  });

  it("references 100% valid Vault CC0 assetIds and showcases all 12 custom Sovereign Temple props", () => {
    const doc = createSovereignTempleMap();
    const validIds = new Set<string>();
    const addPack = (
      pack: { assets: Array<{ id?: string; path: string }> },
      prefix: string,
    ) => {
      for (const a of pack.assets) {
        validIds.add(a.id ?? `${prefix}${a.path}`);
      }
    };
    addPack(starterManifest, "");
    addPack(coreManifest, "core-fantasy/");
    addPack(modularManifest, "modular-suite/");

    const usedIds = new Set<string>([doc.canvas.baseTerrainAssetId]);
    for (const l of doc.layers) {
      for (const s of l.terrainStrokes ?? []) usedIds.add(s.assetId);
      if (l.caveSystem) {
        usedIds.add(l.caveSystem.floorAssetId);
        usedIds.add(l.caveSystem.wallAssetId);
      }
      for (const w of l.waterRegions ?? []) {
        if (w.textureAssetId) usedIds.add(w.textureAssetId);
      }
      for (const p of l.paths ?? []) usedIds.add(p.assetId);
      for (const w of l.walls ?? []) usedIds.add(w.assetId);
      for (const po of l.portals ?? []) usedIds.add(po.assetId);
      for (const o of l.objects ?? []) usedIds.add(o.assetId);
      for (const r of l.roofs ?? []) usedIds.add(r.assetId);
    }

    const missing = [...usedIds].filter((id) => !validIds.has(id));
    expect(missing).toEqual([]);

    const customSovereignUsed = [...usedIds].filter((id) =>
      id.startsWith("modular-suite/props/sovereign_temple/"),
    );
    expect(customSovereignUsed.length).toBe(12);

    const customIceCreamUsed = [...usedIds].filter(
      (id) =>
        id.startsWith("modular-suite/props/ice_cream_train/") ||
        id === "modular-suite/paths/ic_mini_brass_track.png",
    );
    expect(customIceCreamUsed.length).toBeGreaterThanOrEqual(11);

    const customMessyAptUsed = [...usedIds].filter((id) =>
      id.startsWith("modular-suite/props/messy_apartment/"),
    );
    expect(customMessyAptUsed.length).toBe(10);

    const customParkUsed = [...usedIds].filter((id) =>
      id.startsWith("modular-suite/props/neighborhood_park/"),
    );
    expect(customParkUsed.length).toBe(9);

    const customDistrictStreetsUsed = [...usedIds].filter((id) =>
      id.startsWith("modular-suite/props/district_streets/"),
    );
    expect(customDistrictStreetsUsed.length).toBeGreaterThanOrEqual(15);
  });

  it("isolates per-floor DM note pins cleanly when stepping through 1F → 5F → ROOF", () => {
    const st = useDocumentStore.getState();
    const doc = createSovereignTempleMap();
    st.loadDocumentJson(JSON.stringify(doc));

    const active = useDocumentStore.getState().getActiveDoc();
    const lv3 = active.levels.find((l) => l.shortCode === "3F")!;
    useDocumentStore.getState().selectLevel(lv3.id);

    const on3F = useDocumentStore.getState().getActiveDoc();
    const visibleDmLevels = on3F.layers
      .filter((l) => l.kind === "dm_notes" && l.visible)
      .map((l) => l.levelId);
    expect(visibleDmLevels).toEqual([lv3.id]);

    const visibleFloors = on3F.levels.filter((lv) => lv.visible).map((lv) => lv.shortCode);
    expect(visibleFloors).toEqual(["1F", "2F", "3F"]);

    const lvRoof = on3F.levels.find((l) => l.shortCode === "ROOF")!;
    useDocumentStore.getState().selectLevel(lvRoof.id);
    const onRoof = useDocumentStore.getState().getActiveDoc();
    expect(onRoof.layers.filter((l) => l.kind === "dm_notes" && l.visible)).toHaveLength(0);
  });

  it("includes all 100 modular split standalone assets alongside all original composites in the modular CC0 manifest", () => {
    const modPaths = new Set(modularManifest.assets.map((a) => a.path));
    // Key standalone bare bases & individual loose props across all 5 custom packs
    const expectedSplits = [
      // ice_cream_train (32)
      "props/ice_cream_train/ic_bare_marble_bistro_table.png",
      "props/ice_cream_train/ic_parlor_bistro_chair.png",
      "props/ice_cream_train/ic_sundae_bowl_strawberry.png",
      "props/ice_cream_train/ic_sundae_bowl_chocolate.png",
      "props/ice_cream_train/ic_waffle_cone_napkin.png",
      "props/ice_cream_train/ic_silver_sundae_spoon.png",
      "props/ice_cream_train/ic_brass_napkin_dispenser.png",
      "props/ice_cream_train/ic_bare_mini_train_flatcar.png",
      "props/ice_cream_train/ic_sundae_dish_neapolitan.png",
      "props/ice_cream_train/ic_banana_split_boat.png",
      "props/ice_cream_train/ic_bare_walnut_brass_counter.png",
      "props/ice_cream_train/ic_waffle_iron_open.png",
      "props/ice_cream_train/ic_hot_fudge_pot_ladle.png",
      "props/ice_cream_train/ic_bare_braided_rag_rug.png",
      "props/ice_cream_train/ic_wooden_toy_train_oval.png",
      "props/ice_cream_train/ic_wooden_abc_blocks.png",
      "props/ice_cream_train/ic_open_storybook.png",
      "props/ice_cream_train/ic_plush_teddy_bear.png",
      // sovereign_temple (11)
      "props/sovereign_temple/sov_bare_obsidian_dais.png",
      "props/sovereign_temple/sov_crimson_iron_throne.png",
      "props/sovereign_temple/sov_bare_runic_stone_dais.png",
      "props/sovereign_temple/sov_bare_obsidian_altar.png",
      "props/sovereign_temple/sov_bare_scrying_console.png",
      // messy_apartment (20)
      "props/messy_apartment/apt_bare_wood_coffee_table.png",
      "props/messy_apartment/apt_open_pizza_box.png",
      "props/messy_apartment/apt_bare_kitchen_sink.png",
      "props/messy_apartment/apt_bare_iron_bed_made.png",
      // neighborhood_park (15)
      "props/neighborhood_park/pk_bare_plaid_blanket.png",
      "props/neighborhood_park/pk_wicker_picnic_basket.png",
      "props/neighborhood_park/pk_bare_empty_sandbox.png",
      "props/neighborhood_park/pk_sandcastle.png",
      "props/neighborhood_park/pk_bare_raised_garden_bed.png",
      // district_streets (22)
      "props/district_streets/str_bare_wooden_vendor_cart.png",
      "props/district_streets/str_flower_bucket_roses.png",
      "props/district_streets/str_bare_tin_lean_to_shed.png",
      "props/district_streets/vigil_bare_wax_crust_mound.png",
      "props/district_streets/vigil_candle_cluster_lit.png",
      "props/district_streets/vigil_memorial_glass_jar_red.png",
    ];
    for (const p of expectedSplits) {
      expect(modPaths.has(p), `Missing modular split ${p}`).toBe(true);
    }
    const modularTagged = modularManifest.assets.filter(
      (a) =>
        (a.tags ?? []).includes("modular") &&
        /^props\/(ice_cream_train|sovereign_temple|messy_apartment|neighborhood_park|district_streets)\//.test(
          a.path,
        ),
    );
    expect(modularTagged.length).toBe(100);
  });

  it("includes all 6 painterly architectural stair stamps, keeps every placed stair unstretched (<= 1.05x), and aligns vertical stair shafts across 1F–5F", () => {
    const doc = createSovereignTempleMap();
    const assetDims = new Map<string, { w: number; h: number }>();
    const reg = (
      pack: { assets: Array<{ id?: string; path: string; widthPx?: number; heightPx?: number }> },
      prefix: string,
    ) => {
      for (const a of pack.assets) {
        if (typeof a.widthPx === "number" && typeof a.heightPx === "number") {
          assetDims.set(a.id ?? `${prefix}${a.path}`, { w: a.widthPx, h: a.heightPx });
        }
      }
    };
    reg(starterManifest, "");
    reg(coreManifest, "core-fantasy/");
    reg(modularManifest, "modular-suite/");

    const expectedArchStairs = [
      "modular-suite/props/stairs_architectural/stair_berlin_stoop_stone.png",
      "modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png",
      "modular-suite/props/stairs_architectural/stair_tenement_switchback_wood.png",
      "modular-suite/props/stairs_architectural/stair_magipunk_iron_catwalk.png",
      "modular-suite/props/stairs_architectural/stair_cellar_stone_descent.png",
      "modular-suite/props/stairs_architectural/stair_marble_dais_steps.png",
    ];
    for (const id of expectedArchStairs) {
      expect(assetDims.has(id), `Missing architectural stair ${id}`).toBe(true);
    }

    // Check EVERY placed stair/step object across all floors for unstretched aspect ratio (<= 1.05x)
    const stairObjs = doc.layers.flatMap((l) =>
      (l.objects ?? [])
        .filter((o) => /(stair|step|stoop)/i.test(o.assetId))
        .map((o) => ({ levelId: l.levelId, o })),
    );
    expect(stairObjs.length).toBeGreaterThanOrEqual(16);
    for (const { o } of stairObjs) {
      const dim = assetDims.get(o.assetId);
      expect(dim, `Unknown dim for ${o.assetId}`).toBeDefined();
      const natRatio = dim!.w / dim!.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched stair ${o.id} (${o.assetId}): ${stretch.toFixed(3)}x`).toBeLessThanOrEqual(1.05);
    }

    // Verify exact vertical shaft alignment across floors:
    // 1) Cathedral North Tower Brass Spiral Staircase across B1 + 1F–5F
    const spirals = stairObjs.filter(({ o }) => o.assetId === "objects/brass_spiral_staircase.png");
    expect(spirals).toHaveLength(6);
    for (const { o } of spirals) {
      expect(o.x).toBeCloseTo(spirals[0].o.x, 2);
      expect(o.y).toBeCloseTo(spirals[0].o.y, 2);
      expect(o.widthCells).toBeCloseTo(spirals[0].o.widthCells, 2);
      expect(o.heightCells).toBeCloseTo(spirals[0].o.heightCells, 2);
    }
    // 2) Ice Cream Express Oak Runner Family Staircase across 1F & 2F
    const icStairs = stairObjs.filter(
      ({ o }) => o.id.startsWith("ic-") && o.assetId === "modular-suite/props/stairs_architectural/stair_parlor_oak_runner.png",
    );
    expect(icStairs).toHaveLength(2);
    expect(icStairs[0].o.x).toBeCloseTo(icStairs[1].o.x, 2);
    expect(icStairs[0].o.y).toBeCloseTo(icStairs[1].o.y, 2);
    // 3) 4-Story Tenement Stairwell across B1 + 1F–4F (cleanly inside y ∈ [7.0..8.2] shaft!)
    const aptStairs = stairObjs.filter(({ o }) => o.assetId === "objects/wood_interior_stairs.png");
    expect(aptStairs).toHaveLength(5);
    for (const { o } of aptStairs) {
      expect(o.x).toBeCloseTo(41.48, 2);
      expect(o.y).toBeCloseTo(7.6, 2);
    }
  });

  it("includes all 540 brand-new painterly architectural harmony assets across portals, walls, paths, terrains & props with zero duplicates and valid metadata", () => {
    const modAssets = modularManifest.assets;
    const byCat = {
      portals: modAssets.filter((a) => a.path.startsWith("portals/harmony/")),
      walls: modAssets.filter((a) => a.path.startsWith("walls/harmony/")),
      paths: modAssets.filter((a) => a.path.startsWith("paths/harmony/")),
      terrains: modAssets.filter((a) => a.path.startsWith("terrain/harmony/")),
      props: modAssets.filter((a) => a.path.startsWith("props/harmony_arch/")),
    };
    expect(byCat.portals).toHaveLength(110);
    expect(byCat.walls).toHaveLength(110);
    expect(byCat.paths).toHaveLength(80);
    expect(byCat.terrains).toHaveLength(60);
    expect(byCat.props).toHaveLength(180);

    for (const a of [...byCat.portals, ...byCat.walls, ...byCat.paths, ...byCat.terrains, ...byCat.props]) {
      expect(a.displayName.length).toBeGreaterThan(4);
      expect(a.tags).toContain("harmony");
      expect((a as { widthPx?: number }).widthPx ?? 0).toBeGreaterThanOrEqual(64);
      expect((a as { heightPx?: number }).heightPx ?? 0).toBeGreaterThanOrEqual(64);
    }

    // Every pack manifest has 100% unique paths
    const packChecks: Array<[string, Array<{ path: string }>]> = [
      ["starter-cc0", starterManifest.assets],
      ["core-fantasy-cc0", coreManifest.assets],
      ["modular-suite-cc0", modularManifest.assets],
    ];
    for (const [packName, list] of packChecks) {
      const seen = new Set<string>();
      for (const a of list) {
        expect(seen.has(a.path), `Duplicate manifest path ${packName}/${a.path}`).toBe(false);
        seen.add(a.path);
      }
    }
  });

  it("includes all 85 new true top-down lighting fixtures + 5 upgraded legacy lights with proper mount locations and zero stretched or bare-floor tabletop lamps", () => {
    const doc = createSovereignTempleMap();
    const lightingAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/harmony_lighting/"));
    expect(lightingAssets).toHaveLength(85);

    // Every single lighting asset has valid displayName, square top-down dimensions, and lighting/harmony tags
    for (const a of lightingAssets) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("lighting");
      expect(a.tags).toContain("harmony");
      expect((a as { widthPx?: number }).widthPx ?? 0).toBeGreaterThanOrEqual(144);
      expect((a as { heightPx?: number }).heightPx ?? 0).toBeGreaterThanOrEqual(144);
    }

    // Covers all 6 mount categories + 9 colorable lighting fixtures
    expect(lightingAssets.filter((a) => a.tags.includes("floor_lamp"))).toHaveLength(16);
    expect(lightingAssets.filter((a) => a.tags.includes("wall_sconce"))).toHaveLength(16);
    expect(lightingAssets.filter((a) => a.tags.includes("ceiling"))).toHaveLength(16);
    expect(lightingAssets.filter((a) => a.tags.includes("table_lamp"))).toHaveLength(16);
    expect(lightingAssets.filter((a) => a.path.includes("lgt_brazier_") || a.path.includes("lgt_lantern_"))).toHaveLength(10);
    expect(lightingAssets.filter((a) => a.tags.includes("street_lamp"))).toHaveLength(11);
    expect(lightingAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(10);

    // All 5 legacy side-view lighting assets upgraded in-place to square top-down dimensions
    const upgradedLegacy = [
      "props/funeral/fun_tall_candelabra.png",
      "props/post_office/po_green_banker_lamp.png",
      "props/funeral/fun_cemetery_lantern.png",
      "props/armory_dungeon/arm_wall_torch_sconce.png",
      "props/music_theater_tea/tea_silver_candelabra.png",
    ];
    for (const rel of upgradedLegacy) {
      const entry = modularManifest.assets.find((a) => a.path === rel) as { widthPx?: number; heightPx?: number } | undefined;
      expect(entry, `Missing legacy lighting asset ${rel}`).toBeDefined();
      expect(entry!.widthPx).toBe(entry!.heightPx);
      expect(entry!.widthPx).toBeGreaterThanOrEqual(160);
    }

    // Verify showcase map uses at least 100 new top-down lighting fixtures across 1F–5F, all unstretched (<= 1.05x)
    const assetDims = new Map<string, { w: number; h: number }>();
    for (const [pack, prefix] of [
      [starterManifest, ""],
      [coreManifest, "core-fantasy/"],
      [modularManifest, "modular-suite/"],
    ] as const) {
      for (const a of pack.assets as Array<{ id?: string; path: string; widthPx?: number; heightPx?: number }>) {
        if (typeof a.widthPx === "number" && typeof a.heightPx === "number") {
          assetDims.set(a.id ?? `${prefix}${a.path}`, { w: a.widthPx, h: a.heightPx });
        }
      }
    }

    const placedLighting = doc.layers.flatMap((l) =>
      (l.objects ?? []).filter((o) => o.assetId.includes("props/harmony_lighting/")),
    );
    expect(placedLighting.length).toBeGreaterThanOrEqual(100);
    for (const o of placedLighting) {
      const dim = assetDims.get(o.assetId);
      expect(dim, `Missing dim for ${o.assetId}`).toBeDefined();
      const natRatio = dim!.w / dim!.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched lighting fixture ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }
  });

  it("includes all 52 bespoke subterranean/cave assets, 3 underground levels (B1–B3), native B3 caves & underground water, unstretched B1–B3 props, and isolates underground levels cleanly", () => {
    const doc = createSovereignTempleMap();
    const subAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/subterranean_caves/"));
    expect(subAssets).toHaveLength(52);
    expect(subAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(2);

    // Every one of the 52 bespoke subterranean/cave assets is showcased on B1–B3!
    const subPlacedIds = new Set(
      doc.layers
        .filter((l) => ["lvl-sov-b1", "lvl-sov-b2", "lvl-sov-b3"].includes(l.levelId))
        .flatMap((l) => l.objects ?? [])
        .map((o) => o.assetId)
        .filter((id) => id.includes("props/subterranean_caves/")),
    );
    expect(subPlacedIds.size).toBe(52);

    // Verify B2 has flooded sewer water & B3 has native CaveDungeonSystem + underground crystal lake/stream!
    const b2Water = doc.layers.filter((l) => l.levelId === "lvl-sov-b2" && l.kind === "water").flatMap((l) => l.waterRegions ?? []);
    expect(b2Water.length).toBeGreaterThanOrEqual(1);

    const b3CaveLayer = doc.layers.find((l) => l.levelId === "lvl-sov-b3" && l.kind === "caves");
    expect(b3CaveLayer?.caveSystem?.operations.length ?? 0).toBeGreaterThanOrEqual(6);
    const b3Water = doc.layers.filter((l) => l.levelId === "lvl-sov-b3" && l.kind === "water").flatMap((l) => l.waterRegions ?? []);
    expect(b3Water.length).toBeGreaterThanOrEqual(2);

    // Verify underground level selection isolates strictly to that basement level
    const st = useDocumentStore.getState();
    st.loadDocumentJson(JSON.stringify(doc));
    st.selectLevel("lvl-sov-b3");
    const onB3 = useDocumentStore.getState().getActiveDoc();
    expect(onB3.levels.filter((lv) => lv.visible).map((lv) => lv.shortCode)).toEqual(["B3"]);
    expect(onB3.layers.filter((l) => l.kind === "dm_notes" && l.visible).map((l) => l.levelId)).toEqual(["lvl-sov-b3"]);
  });

  it("builds the 5-story Wachturm Ost Watchtower with all 25 bespoke garrison assets, aligned spiral stairs & B1 pump hatch, unstretched props, and conical slate spire roof", () => {
    const doc = createSovereignTempleMap();
    const wtAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/watchtower_garrison/"));
    expect(wtAssets).toHaveLength(25);
    expect(wtAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(2);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of wtAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("watchtower");
      expect(a.tags).toContain("harmony");
      expect(a.widthPx ?? 0).toBeGreaterThanOrEqual(112);
      expect(a.heightPx ?? 0).toBeGreaterThanOrEqual(112);
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    // All 25 bespoke Watchtower assets are showcased across 1F–5F and remain unstretched (<= 1.05x)!
    const wtPlaced = doc.layers
      .filter((l) => ["lvl-dd-1", "lvl-sov-2f", "lvl-sov-3f", "lvl-sov-4f", "lvl-sov-5f"].includes(l.levelId))
      .flatMap((l) => (l.objects ?? []).map((o) => ({ levelId: l.levelId, o })))
      .filter(({ o }) => o.assetId.startsWith("modular-suite/props/watchtower_garrison/"));

    const uniquePlaced = new Set(wtPlaced.map(({ o }) => o.assetId));
    expect(uniquePlaced.size).toBe(25);

    for (const { o } of wtPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched watchtower prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Exact 5-floor vertical shaft alignment of the Fortress Spiral Staircase (1F–5F)
    const wtStairs = wtPlaced.filter(({ o }) => o.assetId.endsWith("wt_fortress_spiral_stair.png"));
    expect(wtStairs).toHaveLength(5);
    for (const { o } of wtStairs) {
      expect(o.x).toBeCloseTo(33.32, 2);
      expect(o.y).toBeCloseTo(17.75, 2);
      expect(o.widthCells).toBeCloseTo(1.68, 2);
      expect(o.heightCells).toBeCloseTo(1.68, 2);
    }

    // Exact vertical alignment between 1F Padlocked Pump Hatch and B1 Pump-House Iron Shaft Ladder!
    const hatch1F = wtPlaced.find(({ o }) => o.assetId.endsWith("wt_iron_pump_hatch_padlocked.png"))!.o;
    const ladderB1 = doc.layers
      .filter((l) => l.levelId === "lvl-sov-b1")
      .flatMap((l) => l.objects ?? [])
      .find((o) => o.assetId.endsWith("sub_iron_shaft_ladder_down.png"))!;
    expect(hatch1F.x).toBeCloseTo(ladderB1.x, 2);
    expect(hatch1F.y).toBeCloseTo(ladderB1.y, 2);

    // Conical Prussian-Slate Watchtower Spire replaces legacy square hip roof on ROOF!
    const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs")!;
    const wtSpire = (roofLayer.roofs ?? []).find((r) => r.id === "wt-roof-watchtower-spire");
    expect(wtSpire).toBeDefined();
    expect(wtSpire!.style).toBe("cone");
    expect(wtSpire!.coneFacets).toBe(12);
    expect((roofLayer.roofs ?? []).some((r) => r.id === "dd-roof-0-12")).toBe(false);
  });

  it("transforms the courtyard behind Ice Cream Express into the Community Kid Theater showcasing all 30 modular assets unstretched with clean dusk lights", () => {
    const doc = createSovereignTempleMap();
    const ktAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/community_kid_theater/"));
    expect(ktAssets).toHaveLength(30);
    expect(ktAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(2);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of ktAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("theater");
      expect(a.tags).toContain("harmony");
      expect(a.widthPx ?? 0).toBeGreaterThanOrEqual(80);
      expect(a.heightPx ?? 0).toBeGreaterThanOrEqual(80);
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    // All 30 bespoke Community Kid Theater assets are actively showcased on 1F and remain unstretched (<= 1.05x)!
    const f1Objects = doc.layers
      .filter((l) => l.levelId === "lvl-dd-1")
      .flatMap((l) => l.objects ?? []);
    const ktPlaced = f1Objects.filter((o) => o.assetId.startsWith("modular-suite/props/community_kid_theater/"));
    const uniqueKt = new Set(ktPlaced.map((o) => o.assetId));
    expect(uniqueKt.size).toBe(30);

    for (const o of ktPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched kid theater prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Legacy fountain & zigzag L-counters removed from the open theater courtyard!
    expect(f1Objects.some((o) => o.id === "dd-obj-1-1" || o.id === "dd-obj-1-2" || o.id === "dd-obj-1-37")).toBe(false);
    expect(f1Objects.some((o) => o.assetId === "modular-suite/props/docks_streets/str_stone_fountain.png" && Math.abs(o.x - 25.55) < 0.5)).toBe(false);
  });

  it("upgrades the streetcar line with aged granite-sett tracks, keeps all manholes/drains/curb fixtures clear of the steel rails, aligns alley manholes over the B2 sewer canal, and showcases all 28 weathering & grime overlays unstretched", () => {
    const doc = createSovereignTempleMap();
    const wthAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/weathering_overlays/"));
    const stProps = modularManifest.assets.filter((a) => a.path.startsWith("props/aged_streetcar_line/"));
    const stPaths = modularManifest.assets.filter((a) => a.path.startsWith("paths/streetcar/"));

    expect(wthAssets).toHaveLength(28);
    expect(wthAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(4);
    expect(stProps).toHaveLength(12);
    expect(stPaths).toHaveLength(3);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of [...wthAssets, ...stProps] as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("harmony");
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    const f1Layers = doc.layers.filter((l) => l.levelId === "lvl-dd-1");
    const f1Paths = f1Layers.flatMap((l) => l.paths ?? []);
    const f1Objects = f1Layers.flatMap((l) => l.objects ?? []);

    // Legacy mine-cart track & neon-yellow trim paths (`dd-path-1-6..10`) are replaced by our 3 aged streetcar path assets!
    for (const legacyId of ["dd-path-1-6", "dd-path-1-7", "dd-path-1-8", "dd-path-1-9", "dd-path-1-10"]) {
      expect(f1Paths.some((p) => p.id === legacyId), `Legacy track path ${legacyId} still present`).toBe(false);
    }
    const usedStPaths = new Set(f1Paths.map((p) => p.assetId).filter((id) => id.startsWith("modular-suite/paths/streetcar/")));
    expect(usedStPaths.size).toBe(3);

    // All 28 weathering overlays + all 12 aged streetcar props are actively showcased on 1F and unstretched (<= 1.05x)!
    const wthPlaced = f1Objects.filter((o) => o.assetId.startsWith("modular-suite/props/weathering_overlays/"));
    const stPlaced = f1Objects.filter((o) => o.assetId.startsWith("modular-suite/props/aged_streetcar_line/"));
    expect(new Set(wthPlaced.map((o) => o.assetId)).size).toBe(28);
    expect(new Set(stPlaced.map((o) => o.assetId)).size).toBe(12);

    for (const o of [...wthPlaced, ...stPlaced]) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched streetcar/weathering prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Mathematical clearance guard: ZERO manholes, curb storm drains, bollards, semaphores,
    // tram shelters, or streetlamps may intrude into the active twin-rail envelope (x + y ∈ [31.20 .. 34.70])!
    const clearancePattern = /(manhole|storm_drain|tram_stop|semaphore|bollard|lgt_street_)/;
    for (const o of f1Objects) {
      if (!clearancePattern.test(o.assetId)) continue;
      // Only check along the diagonal Eisenbahnstraße corridor (x <= 34, y <= 35)
      if (o.x > 34 || o.y > 35) continue;
      const sum = o.x + o.y;
      const intrudesRail = sum > 31.20 && sum < 34.70;
      expect(
        intrudesRail,
        `Fixture ${o.id} (${o.assetId}) at (${o.x}, ${o.y}) [x+y=${sum.toFixed(2)}] intrudes into streetcar rails [31.20..34.70]!`,
      ).toBe(false);
    }

    // Both alley sewer manholes vertically align above the B2 Flooded Municipal Brick Sewer Canal (x = 34.75)!
    const alleyManholes = f1Objects.filter(
      (o) => o.assetId.endsWith("st_street_manhole_granite_collar.png") && Math.abs(o.x - 34.75) < 0.05,
    );
    expect(alleyManholes).toHaveLength(2);
    expect(alleyManholes.map((m) => m.y).sort((a, b) => a - b)).toEqual([12.05, 21.75]);
  });

  it("fills all 4 SE Souverän-Allee multi-story rowhouses (3F / 4F / 3F / 2F) showcasing all 28 bespoke boulevard shop assets unstretched with exact B1–4F stair alignment", () => {
    const doc = createSovereignTempleMap();
    const bsAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/boulevard_shops/"));
    expect(bsAssets).toHaveLength(28);
    expect(bsAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(2);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of bsAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("harmony");
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    const rowLevels = ["lvl-dd-1", "lvl-sov-2f", "lvl-sov-3f", "lvl-sov-4f"];
    const bsPlaced = doc.layers
      .filter((l) => rowLevels.includes(l.levelId))
      .flatMap((l) => (l.objects ?? []).map((o) => ({ levelId: l.levelId, o })))
      .filter(({ o }) => o.assetId.startsWith("modular-suite/props/boulevard_shops/"));

    expect(new Set(bsPlaced.map(({ o }) => o.assetId)).size).toBe(28);

    for (const { o } of bsPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched boulevard shop prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Verify stepped multi-story floors exist: R1 (1F–3F), R2 (1F–4F), R3 (1F–3F), R4 (1F–2F)!
    const countRowOn = (prefix: string, levelId: string) =>
      doc.layers
        .filter((l) => l.levelId === levelId)
        .flatMap((l) => l.objects ?? [])
        .filter((o) => o.id.startsWith(`row-${prefix}-`)).length;

    expect(countRowOn("r1", "lvl-dd-1")).toBeGreaterThanOrEqual(15);
    expect(countRowOn("r1", "lvl-sov-2f")).toBeGreaterThanOrEqual(12);
    expect(countRowOn("r1", "lvl-sov-3f")).toBeGreaterThanOrEqual(10);
    expect(countRowOn("r2", "lvl-dd-1")).toBeGreaterThanOrEqual(14);
    expect(countRowOn("r2", "lvl-sov-2f")).toBeGreaterThanOrEqual(10);
    expect(countRowOn("r2", "lvl-sov-3f")).toBeGreaterThanOrEqual(12);
    expect(countRowOn("r2", "lvl-sov-4f")).toBeGreaterThanOrEqual(10);
    expect(countRowOn("r3", "lvl-dd-1")).toBeGreaterThanOrEqual(12);
    expect(countRowOn("r3", "lvl-sov-2f")).toBeGreaterThanOrEqual(10);
    expect(countRowOn("r3", "lvl-sov-3f")).toBeGreaterThanOrEqual(10);
    expect(countRowOn("r4", "lvl-dd-1")).toBeGreaterThanOrEqual(12);
    expect(countRowOn("r4", "lvl-sov-2f")).toBeGreaterThanOrEqual(12);

    // Exact vertical alignment of upper-story stairwells for all 4 rowhouses!
    for (const [prefix, stairAsset, expectedCount] of [
      ["r1", "stair_parlor_oak_runner.png", 3],
      ["r2", "stair_tenement_switchback_wood.png", 4],
      ["r3", "stair_parlor_oak_runner.png", 3],
      ["r4", "stair_parlor_oak_runner.png", 2],
    ] as const) {
      const stairs = doc.layers
        .filter((l) => rowLevels.includes(l.levelId))
        .flatMap((l) => l.objects ?? [])
        .filter((o) => o.id.startsWith(`row-${prefix}-`) && o.assetId.endsWith(stairAsset));
      expect(stairs, `${prefix} vertical stairs`).toHaveLength(expectedCount);
      for (const s of stairs) {
        expect(s.x).toBeCloseTo(stairs[0].x, 2);
        expect(s.y).toBeCloseTo(stairs[0].y, 2);
      }
    }

    // Exact B1↔1F cellar descent stair alignment for all 4 rowhouses!
    const b1CellarCoords: Array<[string, number, number]> = [
      ["r1", 24.40, 28.10],
      ["r2", 31.10, 32.20],
      ["r3", 35.80, 38.40],
      ["r4", 43.20, 42.30],
    ];
    const f1Objects = doc.layers.filter((l) => l.levelId === "lvl-dd-1").flatMap((l) => l.objects ?? []);
    for (const [prefix, cx, cy] of b1CellarCoords) {
      const match = f1Objects.find(
        (o) =>
          o.id.startsWith(`row-${prefix}-1f-`) &&
          o.assetId.endsWith("stair_cellar_stone_descent.png") &&
          Math.abs(o.x - cx) < 0.05 &&
          Math.abs(o.y - cy) < 0.05,
      );
      expect(match, `Missing aligned 1F cellar stair for ${prefix} at (${cx}, ${cy})`).toBeDefined();
    }
  });
});

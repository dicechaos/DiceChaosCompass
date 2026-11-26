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
    expect(customMessyAptUsed.length).toBeGreaterThanOrEqual(10);

    const customParkUsed = [...usedIds].filter((id) =>
      id.startsWith("modular-suite/props/neighborhood_park/"),
    );
    expect(customParkUsed.length).toBeGreaterThanOrEqual(9);

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
    const subAssets = modularManifest.assets.filter(
      (a) => a.path.startsWith("props/subterranean_caves/") && !(a.tags ?? []).includes("modular_split_v2"),
    );
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
    const wtAssets = modularManifest.assets.filter(
      (a) => a.path.startsWith("props/watchtower_garrison/") && !(a.tags ?? []).includes("modular_split_v2"),
    );
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
      .filter(({ o }) => dims.has(o.assetId));

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
    const wtStairs = wtPlaced.filter(({ o }) => o.id.startsWith("wt-") && o.assetId.endsWith("wt_fortress_spiral_stair.png"));
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
    const ktAssets = modularManifest.assets.filter(
      (a) => a.path.startsWith("props/community_kid_theater/") && !(a.tags ?? []).includes("modular_split_v2"),
    );
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
    const ktPlaced = f1Objects.filter((o) => dims.has(o.assetId));
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
    const stProps = modularManifest.assets.filter(
      (a) => a.path.startsWith("props/aged_streetcar_line/") && !(a.tags ?? []).includes("modular_split_v2"),
    );
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
    expect(alleyManholes.map((m) => m.y).sort((a, b) => a - b)).toEqual([13.75, 21.75]);
  });

  it("fills all 4 SE Souverän-Allee multi-story rowhouses (3F / 4F / 3F / 2F) showcasing all 28 bespoke boulevard shop assets unstretched with exact B1–4F stair alignment", () => {
    const doc = createSovereignTempleMap();
    const bsAssets = modularManifest.assets.filter(
      (a) => a.path.startsWith("props/boulevard_shops/") && !(a.tags ?? []).includes("modular_split_v2"),
    );
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
      .filter(({ o }) => dims.has(o.assetId));

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

  it("builds the 3-story Postamt Nr. 4 Post Office & Parkblick Single-Occupant Public Housing with all 12 bespoke assets, brass P.O. boxes, 10 lived-in single studios, aligned 1F–3F stairs & Prussian slate roof", () => {
    const doc = createSovereignTempleMap();
    const phAssets = modularManifest.assets.filter(
      (a) => a.path.startsWith("props/post_housing/") && !(a.tags ?? []).includes("modular_split_v2"),
    );
    expect(phAssets).toHaveLength(12);
    expect(phAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(1);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of phAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("post_housing");
      expect(a.tags).toContain("harmony");
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    const phLevels = ["lvl-dd-1", "lvl-sov-2f", "lvl-sov-3f"];
    const phPlaced = doc.layers
      .filter((l) => phLevels.includes(l.levelId))
      .flatMap((l) => (l.objects ?? []).map((o) => ({ levelId: l.levelId, o })))
      .filter(({ o }) => dims.has(o.assetId));

    expect(new Set(phPlaced.map(({ o }) => o.assetId)).size).toBe(12);

    for (const { o } of phPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched post/housing prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Verify all 3 stories have rich lived-in props & vertically aligned 1F↔2F↔3F stairwell
    for (const lvlId of phLevels) {
      const count = doc.layers
        .filter((l) => l.levelId === lvlId)
        .flatMap((l) => l.objects ?? [])
        .filter((o) => o.id.startsWith("ph-")).length;
      expect(count).toBeGreaterThanOrEqual(30);
    }

    const stairs = doc.layers
      .filter((l) => phLevels.includes(l.levelId))
      .flatMap((l) => l.objects ?? [])
      .filter((o) => o.id.startsWith("ph-") && o.assetId.endsWith("stair_tenement_switchback_wood.png"));
    expect(stairs).toHaveLength(3);
    for (const s of stairs) {
      expect(s.x).toBeCloseTo(stairs[0].x, 2);
      expect(s.y).toBeCloseTo(stairs[0].y, 2);
    }

    // Verify legacy windowless wall dd-wall-1-33 replaced & roof dd-roof-0-9 upgraded to Prussian slate!
    const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1")?.walls ?? [];
    expect(groundWalls.some((w) => w.id === "dd-wall-1-33")).toBe(false);
    const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs")!;
    const phRoof = (roofLayer.roofs ?? []).find((r) => r.id === "dd-roof-0-9");
    expect(phRoof?.assetId).toBe("modular-suite/terrain/harmony/roof_prussian_fishscale_slate.png");
  });

  it("builds the 3-story Wanderer's Hearth Shared-Living Hostel with all 10 bespoke assets, colorable bunks, aligned 1F–3F stairs, aligned B1 cellar steps & cedar shakes roof", () => {
    const doc = createSovereignTempleMap();
    const hsAssets = modularManifest.assets.filter(
      (a) => a.path.startsWith("props/hostel_living/") && !(a.tags ?? []).includes("modular_split_v2"),
    );
    expect(hsAssets).toHaveLength(10);
    expect(hsAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(2);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of hsAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("hostel_living");
      expect(a.tags).toContain("harmony");
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    const hsLevels = ["lvl-dd-1", "lvl-sov-2f", "lvl-sov-3f"];
    const hsPlaced = doc.layers
      .filter((l) => hsLevels.includes(l.levelId))
      .flatMap((l) => (l.objects ?? []).map((o) => ({ levelId: l.levelId, o })))
      .filter(({ o }) => dims.has(o.assetId));

    expect(new Set(hsPlaced.map(({ o }) => o.assetId)).size).toBe(10);

    for (const { o } of hsPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched hostel prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Verify all 3 stories have rich lived-in props & vertically aligned 1F↔2F↔3F stairwell
    for (const lvlId of hsLevels) {
      const count = doc.layers
        .filter((l) => l.levelId === lvlId)
        .flatMap((l) => l.objects ?? [])
        .filter((o) => o.id.startsWith("hs-")).length;
      expect(count).toBeGreaterThanOrEqual(18);
    }

    const stairs = doc.layers
      .filter((l) => hsLevels.includes(l.levelId))
      .flatMap((l) => l.objects ?? [])
      .filter((o) => o.id.startsWith("hs-") && o.assetId.endsWith("stair_tenement_switchback_wood.png"));
    expect(stairs).toHaveLength(3);
    for (const s of stairs) {
      expect(s.x).toBeCloseTo(stairs[0].x, 2);
      expect(s.y).toBeCloseTo(stairs[0].y, 2);
    }

    // Verify exact 1F↔B1 cellar stair alignment directly above `sub-b1-obj-309` (45.6, 29.8)!
    const f1Objects = doc.layers.filter((l) => l.levelId === "lvl-dd-1").flatMap((l) => l.objects ?? []);
    const cellarStair = f1Objects.find(
      (o) =>
        o.id.startsWith("hs-1f-") &&
        o.assetId.endsWith("stair_cellar_stone_descent.png") &&
        Math.abs(o.x - 45.6) < 0.05 &&
        Math.abs(o.y - 29.8) < 0.05,
    );
    expect(cellarStair, "Missing aligned 1F hostel cellar stair above B1 moonshine cellar").toBeDefined();

    // Verify legacy windowless wall dd-wall-1-23 replaced & roof dd-roof-0-2 upgraded to Weathered Cedar Shakes!
    const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1")?.walls ?? [];
    expect(groundWalls.some((w) => w.id === "dd-wall-1-23")).toBe(false);
    const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs")!;
    const hsRoof = (roofLayer.roofs ?? []).find((r) => r.id === "dd-roof-0-2");
    expect(hsRoof?.assetId).toBe("modular-suite/terrain/harmony/roof_weathered_cedar_shakes.png");
  });

  it("builds the 2-story Crowded Nest Multi-Family Tenement with all 10 bespoke kid/family assets, aligned 1F–2F stairs, aligned B1 brewery steps & terracotta barrel roof", () => {
    const doc = createSovereignTempleMap();
    const cfAssets = modularManifest.assets.filter(
      (a) => a.path.startsWith("props/crowded_family/") && !(a.tags ?? []).includes("modular_split_v2"),
    );
    expect(cfAssets).toHaveLength(10);
    expect(cfAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(1);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of cfAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("crowded_family");
      expect(a.tags).toContain("harmony");
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    const cfLevels = ["lvl-dd-1", "lvl-sov-2f"];
    const cfPlaced = doc.layers
      .filter((l) => cfLevels.includes(l.levelId))
      .flatMap((l) => (l.objects ?? []).map((o) => ({ levelId: l.levelId, o })))
      .filter(({ o }) => dims.has(o.assetId));

    expect(new Set(cfPlaced.map(({ o }) => o.assetId)).size).toBe(10);

    for (const { o } of cfPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched family prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Verify both stories have rich crowded-family props & vertically aligned 1F↔2F stairwell
    for (const lvlId of cfLevels) {
      const count = doc.layers
        .filter((l) => l.levelId === lvlId)
        .flatMap((l) => l.objects ?? [])
        .filter((o) => o.id.startsWith("cf-")).length;
      expect(count).toBeGreaterThanOrEqual(24);
    }

    const stairs = doc.layers
      .filter((l) => cfLevels.includes(l.levelId))
      .flatMap((l) => l.objects ?? [])
      .filter((o) => o.id.startsWith("cf-") && o.assetId.endsWith("stair_tenement_switchback_wood.png"));
    expect(stairs).toHaveLength(2);
    expect(stairs[0].x).toBeCloseTo(stairs[1].x, 2);
    expect(stairs[0].y).toBeCloseTo(stairs[1].y, 2);

    // Verify exact 1F↔B1 cellar stair alignment directly above `sub-b1-obj-291` (31.4, 25.0)!
    const f1Objects = doc.layers.filter((l) => l.levelId === "lvl-dd-1").flatMap((l) => l.objects ?? []);
    const cellarStair = f1Objects.find(
      (o) =>
        o.id.startsWith("cf-1f-") &&
        o.assetId.endsWith("stair_cellar_stone_descent.png") &&
        Math.abs(o.x - 31.4) < 0.05 &&
        Math.abs(o.y - 25.0) < 0.05,
    );
    expect(cellarStair, "Missing aligned 1F cellar stair above B1 brewery cellar").toBeDefined();

    // Verify legacy windowless wall dd-wall-1-22 replaced & roof dd-roof-0-3 upgraded to Tuscan terracotta barrel!
    const groundWalls = doc.layers.find((l) => l.id === "layer-dd-walls-1")?.walls ?? [];
    expect(groundWalls.some((w) => w.id === "dd-wall-1-22")).toBe(false);
    const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs")!;
    const cfRoof = (roofLayer.roofs ?? []).find((r) => r.id === "dd-roof-0-3");
    expect(cfRoof?.assetId).toBe("modular-suite/terrain/harmony/roof_tuscan_terracotta_barrel.png");
  });

  it("includes all 118 Wave 2 modular split bare bases & standalone sub-props across all 8 post-Wave-1 packs with zero duplicates and valid PNG files on disk", () => {
    const allPaths = modularManifest.assets.map((a) => a.path);
    expect(new Set(allPaths).size, "Duplicate paths in modular-suite manifest").toBe(allPaths.length);

    const v2Splits = modularManifest.assets.filter((a) => (a.tags ?? []).includes("modular_split_v2"));
    expect(v2Splits).toHaveLength(118);
    expect(v2Splits.filter((a) => a.drawMode === "dd_red")).toHaveLength(8);

    const expectedPerPack: Record<string, number> = {
      subterranean_caves: 22,
      watchtower_garrison: 20,
      boulevard_shops: 22,
      community_kid_theater: 4,
      aged_streetcar_line: 2,
      post_housing: 12,
      hostel_living: 18,
      crowded_family: 18,
    };

    for (const [pack, expectedCount] of Object.entries(expectedPerPack)) {
      const packSplits = v2Splits.filter((a) => a.path.startsWith(`props/${pack}/`));
      expect(packSplits, `Wave 2 splits for props/${pack}/`).toHaveLength(expectedCount);
    }

    let bareCount = 0;
    for (const a of v2Splits as Array<{
      path: string;
      displayName: string;
      tags: string[];
      widthPx?: number;
      heightPx?: number;
      dominantHex?: string;
    }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("modular");
      expect(a.tags).toContain("harmony");
      expect(a.widthPx ?? 0).toBeGreaterThanOrEqual(80);
      expect(a.heightPx ?? 0).toBeGreaterThanOrEqual(80);
      expect(a.dominantHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      if (a.path.includes("_bare_") || a.tags.includes("bare")) {
        expect(a.tags).toContain("bare");
        bareCount++;
      }
    }
    expect(bareCount).toBeGreaterThanOrEqual(50);
  });

  it("overhauls all 7 district street corridors with aged Berlin granite/basalt paving matching Eisenbahnstraße, replaces all flat starter street fixtures, and showcases all 12 city_streets Harmony assets unstretched", () => {
    const doc = createSovereignTempleMap();
    const csAssets = modularManifest.assets.filter(
      (a) =>
        a.path.startsWith("terrain/city_streets/") ||
        a.path.startsWith("paths/city_streets/") ||
        a.path.startsWith("props/city_streets/"),
    );
    expect(csAssets).toHaveLength(12);

    const propDims = new Map<string, { w: number; h: number }>();
    for (const a of csAssets as Array<{ path: string; category: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("city_streets");
      expect(a.tags).toContain("harmony");
      if (a.category === "object") {
        propDims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
      }
    }

    const f1Layers = doc.layers.filter((l) => l.levelId === "lvl-dd-1");
    const f1Terrains = f1Layers.flatMap((l) => l.terrainStrokes ?? []);
    const f1Paths = f1Layers.flatMap((l) => l.paths ?? []);
    const f1Objects = f1Layers.flatMap((l) => l.objects ?? []);

    // Both aged road terrains (granite setts + damp alley basalt) and all 3 directional street paths are active on 1F!
    const usedTerrains = new Set(f1Terrains.map((t) => t.assetId).filter((id) => id.startsWith("modular-suite/terrain/city_streets/")));
    const usedPaths = new Set(f1Paths.map((p) => p.assetId).filter((id) => id.startsWith("modular-suite/paths/city_streets/")));
    expect(usedTerrains.size).toBe(2);
    expect(usedPaths.size).toBe(3);

    // Every curb-to-curb road polygon is spliced BEFORE building floors (`dd-shape-floor-*`) so zero paving can bleed inside buildings!
    const groundTerrains = doc.layers.find((l) => l.id === "layer-dd-terrain-1")?.terrainStrokes ?? [];
    const lastRoadIdx = groundTerrains.reduce((acc, t, idx) => (t.id.startsWith("cs-1f-") ? idx : acc), -1);
    const firstBuildingFloorIdx = groundTerrains.findIndex((t) => t.id.startsWith("dd-shape-floor-"));
    expect(lastRoadIdx).toBeGreaterThan(0);
    expect(firstBuildingFloorIdx).toBeGreaterThan(lastRoadIdx);

    // All 7 bespoke city_streets Harmony props are actively showcased on 1F and unstretched (<= 1.05x)!
    const csPropsPlaced = f1Objects.filter((o) => o.assetId.startsWith("modular-suite/props/city_streets/"));
    expect(new Set(csPropsPlaced.map((o) => o.assetId)).size).toBe(7);
    for (const o of csPropsPlaced) {
      const d = propDims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched city_streets prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Zero flat starter street kiosks/planters/steam-vents/luggage-carts or gritty-alley festival bunting remain on 1F!
    const bannedLegacy = new Set([
      "objects/berlin_litfass_kiosk.png",
      "objects/city_planter_box.png",
      "objects/alley_steam_vent.png",
      "objects/luggage_hand_cart.png",
    ]);
    for (const o of f1Objects) {
      expect(bannedLegacy.has(o.assetId), `Flat starter street prop ${o.assetId} still present at (${o.x}, ${o.y})`).toBe(false);
    }
    expect(f1Paths.some((p) => p.assetId === "paths/laundry_banner_line.png")).toBe(false);
  });

  it("builds the 3-story Bahnhofspavillon Nord Tram Rotunda showcasing all 12 bespoke assets unstretched with aligned 1F-3F spiral stairs and conical copper-slate dome roof", () => {
    const doc = createSovereignTempleMap();
    const rotAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/tram_rotunda/"));
    expect(rotAssets).toHaveLength(12);
    expect(rotAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(1);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of rotAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("tram_rotunda");
      expect(a.tags).toContain("harmony");
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    const rotLevels = ["lvl-dd-1", "lvl-sov-2f", "lvl-sov-3f"];
    const rotPlaced = doc.layers
      .filter((l) => rotLevels.includes(l.levelId))
      .flatMap((l) => (l.objects ?? []).map((o) => ({ levelId: l.levelId, o })))
      .filter(({ o }) => o.assetId.startsWith("modular-suite/props/tram_rotunda/"));

    expect(new Set(rotPlaced.map(({ o }) => o.assetId)).size).toBe(12);
    for (const { o } of rotPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched rotunda prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Verify all 3 stories populated & exact 1F↔2F↔3F spiral stair alignment at (22.45, 1.25)!
    for (const lvlId of rotLevels) {
      const count = doc.layers
        .filter((l) => l.levelId === lvlId)
        .flatMap((l) => l.objects ?? [])
        .filter((o) => o.id.startsWith("rot-")).length;
      expect(count).toBeGreaterThanOrEqual(10);
    }

    const stairs = doc.layers
      .filter((l) => rotLevels.includes(l.levelId))
      .flatMap((l) => l.objects ?? [])
      .filter((o) => o.id.startsWith("rot-") && o.assetId.endsWith("wt_fortress_spiral_stair.png"));
    expect(stairs).toHaveLength(3);
    for (const s of stairs) {
      expect(s.x).toBeCloseTo(22.45, 2);
      expect(s.y).toBeCloseTo(1.25, 2);
    }

    // Verify broken clay strip dd-roof-0-17 replaced by 16-facet conical Prussian-slate & copper dome!
    const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs")!;
    const rotDome = (roofLayer.roofs ?? []).find((r) => r.id === "rot-roof-tram-pavilion-dome");
    expect(rotDome).toBeDefined();
    expect(rotDome!.style).toBe("cone");
    expect(rotDome!.coneFacets).toBe(16);
    expect((roofLayer.roofs ?? []).some((r) => r.id === "dd-roof-0-17")).toBe(false);
  });

  it("builds the 2-story Antiquariat & Buchhandlung Silberblatt bookshop across from Steam & Scoop Express with all 8 bespoke assets unstretched, aligned 1F-2F stairs, and Burgundy Diamond Slate roof", () => {
    const doc = createSovereignTempleMap();
    const bkAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/bookshop_antiquariat/"));
    expect(bkAssets).toHaveLength(8);
    expect(bkAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(1);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of bkAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("bookshop_antiquariat");
      expect(a.tags).toContain("harmony");
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    const bkLevels = ["lvl-dd-1", "lvl-sov-2f"];
    const bkPlaced = doc.layers
      .filter((l) => bkLevels.includes(l.levelId))
      .flatMap((l) => (l.objects ?? []).map((o) => ({ levelId: l.levelId, o })))
      .filter(({ o }) => o.assetId.startsWith("modular-suite/props/bookshop_antiquariat/"));

    expect(new Set(bkPlaced.map(({ o }) => o.assetId)).size).toBe(8);
    for (const { o } of bkPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched bookshop prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Verify both 1F and 2F populated & exact 1F↔2F wooden stair alignment at (0.76, 18.65)!
    for (const lvlId of bkLevels) {
      const count = doc.layers
        .filter((l) => l.levelId === lvlId)
        .flatMap((l) => l.objects ?? [])
        .filter((o) => o.id.startsWith("bk-")).length;
      expect(count).toBeGreaterThanOrEqual(11);
    }

    const stairs = doc.layers
      .filter((l) => bkLevels.includes(l.levelId))
      .flatMap((l) => l.objects ?? [])
      .filter((o) => o.id.startsWith("bk-") && o.assetId.endsWith("stair_parlor_oak_runner.png"));
    expect(stairs).toHaveLength(2);
    expect(stairs[0].x).toBeCloseTo(0.76, 2);
    expect(stairs[0].y).toBeCloseTo(18.65, 2);
    expect(stairs[1].x).toBeCloseTo(0.76, 2);
    expect(stairs[1].y).toBeCloseTo(18.65, 2);

    // Verify roof dd-roof-0-8 upgraded to Burgundy Diamond Slate + Copper Ridge Cap!
    const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs")!;
    const bkRoof = (roofLayer.roofs ?? []).find((r) => r.id === "dd-roof-0-8");
    expect(bkRoof).toBeDefined();
    expect(bkRoof!.style).toBe("hip");
    expect(bkRoof!.assetId).toBe("modular-suite/terrain/harmony/roof_burgundy_diamond_slate.png");
    expect(bkRoof!.ridgeCapStyle).toBe("copper");
  });

  it("builds the 3-story Chevron Corner Building (Alte Kronen-Apotheke + Zahnrad & Puppe + 2F/3F Renovation Flats) with all 12 bespoke assets unstretched, shared 1F-3F stairs, B1 cellar alignment, Kid Theater overlook windows & Emerald Fishscale roof", () => {
    const doc = createSovereignTempleMap();
    const renAssets = modularManifest.assets.filter((a) => a.path.startsWith("props/renovation_shops/"));
    expect(renAssets).toHaveLength(12);
    expect(renAssets.filter((a) => a.drawMode === "dd_red")).toHaveLength(1);

    const dims = new Map<string, { w: number; h: number }>();
    for (const a of renAssets as Array<{ path: string; displayName: string; tags: string[]; widthPx?: number; heightPx?: number }>) {
      expect(a.displayName.length).toBeGreaterThan(6);
      expect(a.tags).toContain("renovation_shops");
      expect(a.tags).toContain("harmony");
      dims.set(`modular-suite/${a.path}`, { w: a.widthPx!, h: a.heightPx! });
    }

    const chvLevels = ["lvl-dd-1", "lvl-sov-2f", "lvl-sov-3f"];
    const renPlaced = doc.layers
      .filter((l) => chvLevels.includes(l.levelId))
      .flatMap((l) => (l.objects ?? []).map((o) => ({ levelId: l.levelId, o })))
      .filter(({ o }) => o.assetId.startsWith("modular-suite/props/renovation_shops/"));

    expect(new Set(renPlaced.map(({ o }) => o.assetId)).size).toBe(12);
    for (const { o } of renPlaced) {
      const d = dims.get(o.assetId)!;
      const natRatio = d.w / d.h;
      const placedRatio = o.widthCells / o.heightCells;
      const stretch = Math.max(natRatio / placedRatio, placedRatio / natRatio);
      expect(stretch, `Stretched renovation/shop prop ${o.id} (${o.assetId})`).toBeLessThanOrEqual(1.05);
    }

    // Verify all 3 stories populated & exact 1F↔2F↔3F shared stairwell alignment!
    for (const lvlId of chvLevels) {
      const count = doc.layers
        .filter((l) => l.levelId === lvlId)
        .flatMap((l) => l.objects ?? [])
        .filter((o) => o.id.startsWith("chv-")).length;
      expect(count).toBeGreaterThanOrEqual(12);
    }

    const sharedStairs = doc.layers
      .filter((l) => chvLevels.includes(l.levelId))
      .flatMap((l) => l.objects ?? [])
      .filter((o) => o.id.startsWith("chv-") && o.assetId.endsWith("stair_tenement_switchback_wood.png"));
    expect(sharedStairs).toHaveLength(3);
    for (const s of sharedStairs) {
      expect(s.x).toBeCloseTo(sharedStairs[0].x, 2);
      expect(s.y).toBeCloseTo(sharedStairs[0].y, 2);
    }

    // Verify exact B1↔1F cellar descent stair alignment at (25.00, 14.00)!
    const f1Cellar = doc.layers
      .filter((l) => l.levelId === "lvl-dd-1")
      .flatMap((l) => l.objects ?? [])
      .find((o) => o.id.startsWith("chv-1f-") && o.assetId.endsWith("stair_cellar_stone_descent.png"));
    expect(f1Cellar).toBeDefined();
    expect(f1Cellar!.x).toBeCloseTo(25.0, 2);
    expect(f1Cellar!.y).toBeCloseTo(14.0, 2);

    // Verify 2F & 3F both have panoramic courtyard-facing overlook windows (at least 5 Jugendstil windows each!)
    for (const upperLvl of ["lvl-sov-2f", "lvl-sov-3f"]) {
      const overlookWins = doc.layers
        .filter((l) => l.levelId === upperLvl)
        .flatMap((l) => l.portals ?? [])
        .filter((p) => p.id.startsWith("chv-") && p.assetId.endsWith("win_jugendstil_amber_teal.png"));
      expect(overlookWins).toHaveLength(5);
    }

    // Verify roof dd-roof-0-6 upgraded to Emerald Fishscale Tile w/ Copper Ridge Cap!
    const roofLayer = doc.layers.find((l) => l.levelId === "lvl-dd-0" && l.kind === "roofs")!;
    const chvRoof = (roofLayer.roofs ?? []).find((r) => r.id === "dd-roof-0-6");
    expect(chvRoof).toBeDefined();
    expect(chvRoof!.assetId).toBe("modular-suite/terrain/harmony/roof_emerald_fishscale_tile.png");
    expect(chvRoof!.ridgeCapStyle).toBe("copper");
  });
});

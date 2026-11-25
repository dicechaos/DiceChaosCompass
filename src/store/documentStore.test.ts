import { beforeEach, describe, expect, it } from "vitest";
import { useDocumentStore } from "./documentStore";
import { DEFAULT_RECOLOR } from "@/types/map";

describe("documentStore — Per-Tab Undo/Redo, Selection Delete, Checkpoint & Load", () => {
  beforeEach(() => {
    const st = useDocumentStore.getState();
    // Start fresh with a single blank document
    st.newDocument("Tab_A.dcmap", 20, 15);
    const keepId = useDocumentStore.getState().activeDocId;
    const docs = useDocumentStore.getState().documents;
    for (const d of docs) {
      if (d.id !== keepId) {
        useDocumentStore.getState().closeDocument(d.id);
      }
    }
  });

  it("preserves independent undo/redo history across tab switches", () => {
    const st = useDocumentStore.getState();
    const tabAId = st.activeDocId;

    // Add a prop on Tab A
    st.addObjectStamp({
      id: "obj-a1",
      assetId: "objects/ale_barrel.png",
      x: 5,
      y: 5,
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
    });
    expect(useDocumentStore.getState().undoStack.length).toBe(1);

    // Create Tab B and add a different prop there
    st.newDocument("Tab_B.dcmap", 20, 15);
    const tabBId = useDocumentStore.getState().activeDocId;
    expect(useDocumentStore.getState().undoStack.length).toBe(0);

    st.addObjectStamp({
      id: "obj-b1",
      assetId: "objects/ale_barrel.png",
      x: 10,
      y: 10,
      widthCells: 2,
      heightCells: 2,
      rotationRad: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      castsShadow: true,
      locked: false,
      recolor: { ...DEFAULT_RECOLOR },
      zOrder: 10,
    });
    expect(useDocumentStore.getState().undoStack.length).toBe(1);

    // Switch back to Tab A — Tab A's undo stack MUST still have 1 item!
    st.switchDocument(tabAId);
    expect(useDocumentStore.getState().undoStack.length).toBe(1);

    // Undo on Tab A removes obj-a1 without disturbing Tab B!
    st.undo();
    const docA = useDocumentStore.getState().getActiveDoc();
    expect(docA.layers.flatMap((l) => l.objects ?? [])).toHaveLength(0);
    expect(useDocumentStore.getState().redoStack.length).toBe(1);

    // Redo restores obj-a1
    st.redo();
    expect(useDocumentStore.getState().getActiveDoc().layers.flatMap((l) => l.objects ?? [])).toHaveLength(1);

    // Switch back to Tab B — obj-b1 is completely untouched!
    st.switchDocument(tabBId);
    expect(useDocumentStore.getState().getActiveDoc().layers.flatMap((l) => l.objects ?? [])).toHaveLength(1);
    expect(useDocumentStore.getState().undoStack.length).toBe(1);
  });

  it("supports single-step checkpointHistory for live drags/rotations and deleteSelection with Undo", () => {
    const st = useDocumentStore.getState();
    st.addObjectStamp({
      id: "obj-rot",
      assetId: "objects/ale_barrel.png",
      x: 6,
      y: 6,
      widthCells: 2,
      heightCells: 2,
      rotationRad: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      castsShadow: true,
      locked: false,
      recolor: { ...DEFAULT_RECOLOR },
      zOrder: 10,
    });
    const sel = useDocumentStore.getState().selection!;
    expect(sel.kind).toBe("object");

    // Simulate dragging rotation knob: 1 checkpoint + multiple live updates
    st.checkpointHistory();
    st.updateObjectStamp(sel.layerId, sel.id, { rotationRad: 0.5 }, false);
    st.updateObjectStamp(sel.layerId, sel.id, { rotationRad: 1.57 }, false);

    // Single Undo restores rotation back to 0!
    st.undo();
    const afterUndoRot = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.find((l) => l.id === sel.layerId)
      ?.objects?.find((o) => o.id === sel.id);
    expect(afterUndoRot?.rotationRad).toBeCloseTo(0, 4);

    // Delete selected object -> cleanly removed -> Undo brings it back!
    st.setSelection(sel);
    st.deleteSelection();
    expect(useDocumentStore.getState().selection).toBeNull();
    expect(useDocumentStore.getState().getActiveDoc().layers.flatMap((l) => l.objects ?? [])).toHaveLength(0);

    st.undo();
    expect(useDocumentStore.getState().getActiveDoc().layers.flatMap((l) => l.objects ?? [])).toHaveLength(1);
  });

  it("normalizes older .dcmap JSON files missing levels or recolor fields on load", () => {
    const legacy = JSON.stringify({
      schemaVersion: "1.0.0",
      id: "old-map",
      mode: "battlemap",
      meta: { title: "Legacy.dcmap", author: "Test", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
      canvas: {
        widthCells: 24,
        heightCells: 18,
        ppi: 256,
        baseTerrainAssetId: "terrain/berlin_wet_cobble.png",
        grid: { type: "square", visible: true, colorHex: "#CBD5E1", opacity: 0.14 },
      },
      layers: [
        {
          id: "layer-objects",
          name: "Props",
          kind: "objects",
          visible: true,
          locked: false,
          dmOnly: false,
          opacity: 1,
          blendMode: "normal",
          objects: [{ id: "o1", assetId: "a.png", x: 3, y: 3, widthCells: 1, heightCells: 1, rotationRad: 0, flipX: false, flipY: false, opacity: 1, castsShadow: true, locked: false, zOrder: 1 }],
        },
      ],
      lighting: { enabled: false, activePresetId: "day", ambientColorHex: "#FFFFFF", ambientIntensity: 1, shadowSoftness: 0.5, presets: [] },
    });
    const ok = useDocumentStore.getState().loadDocumentJson(legacy);
    expect(ok).toBe(true);
    const loaded = useDocumentStore.getState().getActiveDoc();
    expect(loaded.levels.length).toBeGreaterThanOrEqual(2);
    expect(loaded.activeLevelId).toBe("lvl-ground");
    expect(loaded.layers[0].objects?.[0].recolor.tintHex).toBeTruthy();
  });

  it("stacks newly stamped assets strictly Above or Below existing overlapping props on the same layer", () => {
    const st = useDocumentStore.getState();
    st.setBrushParams({ stampPlacementOrder: "above" });

    // Place Desk at (8, 8)
    st.addObjectStamp({
      id: "desk",
      assetId: "a.png",
      x: 8,
      y: 8,
      widthCells: 2,
      heightCells: 2,
      rotationRad: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      castsShadow: true,
      locked: false,
      recolor: { ...DEFAULT_RECOLOR },
      zOrder: 30,
    });

    // Place Lamp ABOVE Desk
    st.addObjectStamp({
      id: "lamp",
      assetId: "b.png",
      x: 8.2,
      y: 8.1,
      widthCells: 0.8,
      heightCells: 0.8,
      rotationRad: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      castsShadow: true,
      locked: false,
      recolor: { ...DEFAULT_RECOLOR },
      zOrder: 30,
    });

    // Switch to BELOW and slip a Rug underneath BOTH Desk & Lamp!
    st.setBrushParams({ stampPlacementOrder: "below" });
    st.addObjectStamp({
      id: "rug",
      assetId: "c.png",
      x: 8,
      y: 8,
      widthCells: 3,
      heightCells: 3,
      rotationRad: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      castsShadow: false,
      locked: false,
      recolor: { ...DEFAULT_RECOLOR },
      zOrder: 30,
    });

    const objs = useDocumentStore.getState().getActiveDoc().layers.flatMap((l) => l.objects ?? []);
    const desk = objs.find((o) => o.id === "desk")!;
    const lamp = objs.find((o) => o.id === "lamp")!;
    const rug = objs.find((o) => o.id === "rug")!;
    expect(lamp.zOrder).toBeGreaterThan(desk.zOrder);
    expect(rug.zOrder).toBeLessThan(desk.zOrder);
    expect(rug.zOrder).toBeLessThan(lamp.zOrder);
  });

  it("persists directional slope rotation/shading on terrain strokes and reversible flipSide on embankment paths", () => {
    const st = useDocumentStore.getState();
    st.setBrushParams({ terrainRotationDeg: 135, terrainSlopeShade: 0.65, pathFlipSide: true });
    expect(useDocumentStore.getState().terrainRotationDeg).toBe(135);
    expect(useDocumentStore.getState().terrainSlopeShade).toBeCloseTo(0.65, 3);
    expect(useDocumentStore.getState().pathFlipSide).toBe(true);

    st.addTerrainStroke({
      id: "slope-1",
      assetId: "modular-suite/terrain/slope_urban_terraced_embankment.png",
      shape: "polygon",
      points: [
        { x: 2, y: 2 },
        { x: 8, y: 2 },
        { x: 8, y: 8 },
        { x: 2, y: 8 },
      ],
      radiusCells: 0,
      opacity: 0.95,
      softness: 0,
      rotationDeg: 135,
      slopeShade: 0.65,
    });
    const stroke = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.flatMap((l) => l.terrainStrokes ?? [])
      .find((t) => t.id === "slope-1");
    expect(stroke?.rotationDeg).toBe(135);
    expect(stroke?.slopeShade).toBeCloseTo(0.65, 3);

    st.addPath({
      id: "embank-1",
      assetId: "modular-suite/paths/embankment_urban_masonry.png",
      points: [
        { x: 4, y: 1 },
        { x: 4, y: 12 },
      ],
      widthCells: 4.5,
      curved: true,
      flipSide: false,
      taperEnds: false,
      fadeEnds: false,
      opacity: 1,
      blocksScatter: true,
    });
    const pathLayer = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.find((l) => l.paths?.some((p) => p.id === "embank-1"))!;
    st.updatePath(pathLayer.id, "embank-1", { flipSide: true }, true);
    const flipped = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.find((l) => l.id === pathLayer.id)
      ?.paths?.find((p) => p.id === "embank-1");
    expect(flipped?.flipSide).toBe(true);

    st.undo();
    const reverted = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.find((l) => l.id === pathLayer.id)
      ?.paths?.find((p) => p.id === "embank-1");
    expect(reverted?.flipSide).toBe(false);
  });

  it("reorders layers via drag-and-drop moveLayerRelative with no-op guard and Undo support", () => {
    const st = useDocumentStore.getState();
    const initialIds = st.getActiveDoc().layers.map((l) => l.id);
    expect(initialIds.length).toBeGreaterThanOrEqual(4);

    const bottomId = initialIds[0];
    const topId = initialIds[initialIds.length - 1];
    const secondId = initialIds[1];

    // No-op: dragging bottom layer right below the 2nd layer (already there!) must not push undo history
    st.moveLayerRelative(bottomId, secondId, "below");
    expect(useDocumentStore.getState().undoStack.length).toBe(0);

    // Drag bottom layer ABOVE top layer -> moves to the very top of render order (end of array)
    st.moveLayerRelative(bottomId, topId, "above");
    const afterAbove = useDocumentStore.getState().getActiveDoc().layers.map((l) => l.id);
    expect(afterAbove[afterAbove.length - 1]).toBe(bottomId);
    expect(useDocumentStore.getState().undoStack.length).toBe(1);

    // Drag top layer BELOW second layer
    st.moveLayerRelative(bottomId, secondId, "below");
    const afterBelow = useDocumentStore.getState().getActiveDoc().layers.map((l) => l.id);
    expect(afterBelow.indexOf(bottomId)).toBe(afterBelow.indexOf(secondId) - 1);

    // Undo restores previous order cleanly
    st.undo();
    expect(useDocumentStore.getState().getActiveDoc().layers.map((l) => l.id)).toEqual(afterAbove);
    st.undo();
    expect(useDocumentStore.getState().getActiveDoc().layers.map((l) => l.id)).toEqual(initialIds);
  });

  it("supports context-aware +Up adding building floors on F levels and unlimited Sky 1, Sky 2, Sky 3, Sky 4 on ROOF/Sky", () => {
    const st = useDocumentStore.getState();
    // Blank map starts on 1F -> addLevelAbove() creates 2F
    st.addLevelAbove();
    let doc = useDocumentStore.getState().getActiveDoc();
    expect(doc.levels.some((l) => l.shortCode === "2F" && l.kind === "upper")).toBe(true);

    // Switch to ROOF -> addLevelAbove() creates Sky 1!
    st.selectLevel("lvl-roofs");
    st.addLevelAbove();
    doc = useDocumentStore.getState().getActiveDoc();
    expect(doc.levels.find((l) => l.id === doc.activeLevelId)?.shortCode).toBe("Sky 1");

    // Still on Sky 1 -> addLevelAbove() creates Sky 2, Sky 3, Sky 4 with no cap!
    st.addLevelAbove();
    st.addLevelAbove();
    st.addLevelAbove();
    doc = useDocumentStore.getState().getActiveDoc();
    const skyCodes = doc.levels
      .filter((l) => l.kind === "sky")
      .sort((a, b) => a.elevationFt - b.elevationFt)
      .map((l) => l.shortCode);
    expect(skyCodes).toEqual(["Sky 1", "Sky 2", "Sky 3", "Sky 4"]);
  });

  it("prompts for a save location on first save, binds file handle, enables auto-save, and writes in-place thereafter", async () => {
    const st = useDocumentStore.getState();
    const docId = st.activeDocId;
    const writes: string[] = [];
    let pickerCalls = 0;
    let shouldCancel = true;

    const fakeHandle = {
      name: "Skyship_Raid.dcmap",
      createWritable: async () => ({
        write: async (data: string | Blob) => {
          writes.push(typeof data === "string" ? data : "");
        },
        close: async () => {},
      }),
    };

    const g = globalThis as unknown as {
      window?: { showSaveFilePicker?: () => Promise<typeof fakeHandle> };
    };
    const prevWindow = g.window;
    g.window = {
      ...(prevWindow ?? {}),
      showSaveFilePicker: async () => {
        pickerCalls++;
        if (shouldCancel) {
          const err = new Error("User cancelled");
          err.name = "AbortError";
          throw err;
        }
        return fakeHandle;
      },
    };

    try {
      // 1. User cancels the save location picker -> nothing saved, autosave stays OFF
      const cancelled = await st.saveDocumentToFile(docId);
      expect(cancelled).toBe(false);
      expect(pickerCalls).toBe(1);
      expect(useDocumentStore.getState().autosaveEnabledByDocId[docId]).toBeFalsy();
      expect(writes.length).toBe(0);

      // 2. User picks Skyship_Raid.dcmap -> writes to file, updates title, enables Auto-Save!
      shouldCancel = false;
      const saved = await st.saveDocumentToFile(docId);
      expect(saved).toBe(true);
      expect(pickerCalls).toBe(2);
      expect(writes.length).toBe(1);
      expect(useDocumentStore.getState().savedFileNameByDocId[docId]).toBe("Skyship_Raid.dcmap");
      expect(useDocumentStore.getState().autosaveEnabledByDocId[docId]).toBe(true);
      expect(useDocumentStore.getState().getActiveDoc().meta.title).toBe("Skyship_Raid.dcmap");

      // 3. Make an edit -> autosaveBoundFiles writes straight to the bound handle WITHOUT re-prompting!
      st.addLevelAbove("sky");
      expect(useDocumentStore.getState().dirtyDocIds[docId]).toBe(true);
      const flushed = await useDocumentStore.getState().autosaveBoundFiles();
      expect(flushed).toBe(1);
      expect(pickerCalls).toBe(2); // No extra picker popup!
      expect(writes.length).toBe(2);
      expect(useDocumentStore.getState().dirtyDocIds[docId]).toBe(false);

      // 4. Explicit Save As re-opens the picker
      await st.saveDocumentToFile(docId, { saveAs: true });
      expect(pickerCalls).toBe(3);
      expect(writes.length).toBe(3);
    } finally {
      g.window = prevWindow;
    }
  });

  it("auto-focuses matching floor layer on setActiveTool without dirtying history, and sculpts water cleanly with paintWaterBrush / eraseWaterBrush", () => {
    const st = useDocumentStore.getState();
    const doc = st.getActiveDoc();
    const lightsLayer = doc.layers.find((l) => l.kind === "lights" && l.levelId === "lvl-ground")!;
    const waterLayer = doc.layers.find((l) => l.kind === "water" && l.levelId === "lvl-ground")!;

    // Newly created map starts on layer-objects cleanly (`dirty === false`)
    expect(useDocumentStore.getState().getActiveDoc().activeLayerId).toBe("layer-objects");
    expect(useDocumentStore.getState().dirty).toBe(false);
    expect(useDocumentStore.getState().undoStack.length).toBe(0);

    // Switching to Water tool focuses the Water layer without marking dirty or pushing undo!
    st.setActiveTool("water");
    expect(useDocumentStore.getState().getActiveDoc().activeLayerId).toBe(waterLayer.id);
    expect(useDocumentStore.getState().dirty).toBe(false);
    expect(useDocumentStore.getState().undoStack.length).toBe(0);

    // Switching from an explicit Lights layer focus -> Water tool also syncs back to Water layer
    st.setActiveLayer(lightsLayer.id);
    expect(useDocumentStore.getState().getActiveDoc().activeLayerId).toBe(lightsLayer.id);
    st.setActiveTool("water");
    expect(useDocumentStore.getState().getActiveDoc().activeLayerId).toBe(waterLayer.id);
    expect(useDocumentStore.getState().undoStack.length).toBe(0);

    // Paint first pond with Lake Brush -> creates 1 clean water body, keeps selection null
    st.setBrushParams({ waterBrushRadiusCells: 2.0, waterOrganicRoughness: 0.1 });
    st.paintWaterBrush([
      { x: 6, y: 8 },
      { x: 9, y: 8 },
    ]);
    expect(useDocumentStore.getState().selection).toBeNull();
    expect(useDocumentStore.getState().undoStack.length).toBe(1);
    let regions = useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === waterLayer.id)?.waterRegions ?? [];
    expect(regions.length).toBe(1);

    // Paint overlapping second stroke -> merges cleanly into 1 continuous water body (not 2!)
    st.paintWaterBrush([
      { x: 9, y: 8 },
      { x: 13, y: 8 },
    ]);
    expect(useDocumentStore.getState().selection).toBeNull();
    expect(useDocumentStore.getState().undoStack.length).toBe(2);
    regions = useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === waterLayer.id)?.waterRegions ?? [];
    expect(regions.length).toBe(1);

    // Erasing only on dry land returns false and pushes NO empty undo step
    const missedErase = st.eraseWaterBrush([{ x: 2, y: 2 }]);
    expect(missedErase).toBe(false);
    expect(useDocumentStore.getState().undoStack.length).toBe(2);

    // Carve island inside the merged lake -> carves cutout and pushes 1 undo step
    st.setBrushParams({ waterBrushRadiusCells: 0.9 });
    const carved = st.eraseWaterBrush([{ x: 9, y: 8 }]);
    expect(carved).toBe(true);
    expect(useDocumentStore.getState().selection).toBeNull();
    expect(useDocumentStore.getState().undoStack.length).toBe(3);
    regions = useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === waterLayer.id)?.waterRegions ?? [];
    expect(regions.length).toBe(1);
    expect(regions[0].cutouts?.length).toBe(1);

    // Single Undo removes the carved island cleanly
    st.undo();
    regions = useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === waterLayer.id)?.waterRegions ?? [];
    expect(regions[0].cutouts?.length ?? 0).toBe(0);

    // Layer water mesh & transition settings clamp cleanly and persist
    st.updateLayerWaterSettings(waterLayer.id, { waterMeshEnabled: false, waterBlendRadiusCells: 5.5 }, true);
    let updatedLayer = useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === waterLayer.id)!;
    expect(updatedLayer.waterMeshEnabled).toBe(false);
    expect(updatedLayer.waterBlendRadiusCells).toBe(3);

    st.updateLayerWaterSettings(waterLayer.id, { waterMeshEnabled: true, waterBlendRadiusCells: 1.8 }, false);
    updatedLayer = useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === waterLayer.id)!;
    expect(updatedLayer.waterMeshEnabled).toBe(true);
    expect(updatedLayer.waterBlendRadiusCells).toBeCloseTo(1.8, 3);
  });

  it("trims layer renames, ignores no-op/empty renames cleanly, and supports Undo", () => {
    const st = useDocumentStore.getState();
    const target = st.getActiveDoc().layers[0];
    const originalName = target.name;

    // Empty or unchanged rename pushes zero undo steps
    st.renameLayer(target.id, "   ");
    expect(useDocumentStore.getState().undoStack.length).toBe(0);
    st.renameLayer(target.id, `  ${originalName}  `);
    expect(useDocumentStore.getState().undoStack.length).toBe(0);

    // Real rename trims whitespace and records 1 undo step
    st.renameLayer(target.id, "  Cove Shoreline  ");
    expect(useDocumentStore.getState().getActiveDoc().layers[0].name).toBe("Cove Shoreline");
    expect(useDocumentStore.getState().undoStack.length).toBe(1);

    // Undo restores the previous name cleanly
    st.undo();
    expect(useDocumentStore.getState().getActiveDoc().layers[0].name).toBe(originalName);
  });

  it("adds, updates, presets, reorders, duplicates, bends, syncs sunlight, and undoes Roof structures cleanly", () => {
    const st = useDocumentStore.getState();

    // Apply Verdigris Copper preset before drawing
    st.applyRoofPreset("verdigris_copper");
    expect(useDocumentStore.getState().activeRoofAssetId).toContain("roof_oxidized_verdigris_copper.png");
    expect(useDocumentStore.getState().roofRidgeCapStyle).toBe("copper");

    // Add two overlapping roofs on the active floor
    st.addRoof({
      id: "rf-main",
      style: "gable",
      assetId: useDocumentStore.getState().activeRoofAssetId,
      points: [
        { x: 6, y: 10 },
        { x: 16, y: 10 },
      ],
      widthCells: 6,
      curved: false,
      flipSlope: false,
      sunAngleDeg: 225,
      slopeShade: 0.55,
      ridgeCapStyle: "copper",
      ridgeCapWidthCells: 0.28,
      eaveTrim: true,
      dropShadow: 0.6,
      shadowDistanceCells: 0.45,
      textureScale: 1,
      weathering: 0.25,
      opacity: 1,
    });
    st.addRoof({
      id: "rf-wing",
      style: "hip",
      assetId: "modular-suite/terrain/roof_terracotta_barrel_tiles.png",
      points: [
        { x: 11, y: 6 },
        { x: 11, y: 14 },
      ],
      widthCells: 4.5,
      curved: false,
      flipSlope: false,
      sunAngleDeg: 135,
      slopeShade: 0.55,
      ridgeCapStyle: "matching",
      ridgeCapWidthCells: 0.28,
      eaveTrim: true,
      dropShadow: 0.6,
      shadowDistanceCells: 0.45,
      textureScale: 1,
      weathering: 0.25,
      opacity: 1,
    });

    const roofLayer = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.find((l) => l.kind === "roofs")!;
    expect(roofLayer).toBeDefined();
    expect(roofLayer.roofs?.map((r) => r.id)).toEqual(["rf-main", "rf-wing"]);

    // Bring main roof to front so it overlaps wing
    st.reorderRoofInLayer(roofLayer.id, "rf-main", "front");
    expect(
      useDocumentStore
        .getState()
        .getActiveDoc()
        .layers.find((l) => l.id === roofLayer.id)
        ?.roofs?.map((r) => r.id),
    ).toEqual(["rf-wing", "rf-main"]);

    // Sync Sun Angle across all roofs
    st.syncSunAngleToAllRoofs(315);
    const synced = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.find((l) => l.id === roofLayer.id)
      ?.roofs!;
    expect(synced.every((r) => r.sunAngleDeg === 315)).toBe(true);

    // Bend selected roof into curve (inserts midpoint & sets curved = true)
    st.setSelection({ kind: "roof", layerId: roofLayer.id, id: "rf-main" });
    st.bendSelectedIntoCurve();
    const curvedRoof = useDocumentStore
      .getState()
      .getActiveDoc()
      .layers.find((l) => l.id === roofLayer.id)
      ?.roofs?.find((r) => r.id === "rf-main")!;
    expect(curvedRoof.curved).toBe(true);
    expect(curvedRoof.points.length).toBe(3);

    // Duplicate & delete selected roof + Undo
    st.duplicateSelection();
    expect(
      useDocumentStore
        .getState()
        .getActiveDoc()
        .layers.find((l) => l.id === roofLayer.id)?.roofs?.length,
    ).toBe(3);

    st.deleteSelection();
    expect(
      useDocumentStore
        .getState()
        .getActiveDoc()
        .layers.find((l) => l.id === roofLayer.id)?.roofs?.length,
    ).toBe(2);

    st.undo();
    expect(
      useDocumentStore
        .getState()
        .getActiveDoc()
        .layers.find((l) => l.id === roofLayer.id)?.roofs?.length,
    ).toBe(3);
  });

  it("uses zero-copy structural sharing for hot World/Object updates while keeping Undo/Redo isolated", () => {
    const st = useDocumentStore.getState();
    st.openShowcaseWorld();
    const beforeDoc = useDocumentStore.getState().getActiveDoc();
    expect(beforeDoc.mode).toBe("world");
    expect(beforeDoc.world).toBeTruthy();

    const firstLabel = beforeDoc.world!.labels[0];
    const origX = firstLabel.x;
    const origLayersRef = beforeDoc.layers;

    // Nudging a world label shares doc.layers reference (zero symbol re-sort/clone!)
    st.updateWorldLabel(firstLabel.id, { x: origX + 0.12 }, true);
    const afterLabelDoc = useDocumentStore.getState().getActiveDoc();
    expect(afterLabelDoc.layers).toBe(origLayersRef);
    expect(afterLabelDoc.world!.labels[0].x).toBeCloseTo(origX + 0.12, 4);
    expect(beforeDoc.world!.labels[0].x).toBeCloseTo(origX, 4);

    // Dragging an object shares doc.world reference (zero heightmap/river/label clone!)
    const objLayer = afterLabelDoc.layers.find((l) => (l.objects?.length ?? 0) > 0)!;
    const firstObj = objLayer.objects![0];
    const origObjX = firstObj.x;
    const worldRefBeforeObj = afterLabelDoc.world;
    st.updateObjectStamp(objLayer.id, firstObj.id, { x: origObjX + 0.25 }, true);
    const afterObjDoc = useDocumentStore.getState().getActiveDoc();
    expect(afterObjDoc.world).toBe(worldRefBeforeObj);
    expect(afterObjDoc.layers.find((l) => l.id === objLayer.id)!.objects![0].x).toBeCloseTo(
      origObjX + 0.25,
      4,
    );

    // Undo cleanly restores both steps without corrupting history snapshots
    st.undo();
    expect(
      useDocumentStore.getState().getActiveDoc().layers.find((l) => l.id === objLayer.id)!.objects![0].x,
    ).toBeCloseTo(origObjX, 4);
    st.undo();
    expect(useDocumentStore.getState().getActiveDoc().world!.labels[0].x).toBeCloseTo(origX, 4);
    st.redo();
    expect(useDocumentStore.getState().getActiveDoc().world!.labels[0].x).toBeCloseTo(origX + 0.12, 4);
  });
});

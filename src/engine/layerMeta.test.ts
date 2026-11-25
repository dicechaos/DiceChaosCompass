import { describe, expect, it } from "vitest";
import { createBlankMap, createFunicularShowcaseMap } from "@/data/funicularShowcaseMap";
import { createHiddenSloopMap } from "@/data/hiddenSloopMap";
import { createLakeYachtMap } from "@/data/lakeYachtMap";
import { DEFAULT_RECOLOR, type MapLayer } from "@/types/map";
import {
  describeLayerContents,
  findPreferredLayerForKind,
  getLayerKindMeta,
  getNextDefaultLayerName,
  suggestLayerNameFromContents,
  toolToLayerKind,
  upgradeLegacyLayerName,
} from "./layerMeta";

describe("Layer Metadata Engine", () => {
  it("maps every editor tool to its target layer kind cleanly", () => {
    expect(toolToLayerKind("terrain")).toBe("terrain");
    expect(toolToLayerKind("cave")).toBe("caves");
    expect(toolToLayerKind("water")).toBe("water");
    expect(toolToLayerKind("wall")).toBe("walls");
    expect(toolToLayerKind("portal")).toBe("walls");
    expect(toolToLayerKind("path")).toBe("paths");
    expect(toolToLayerKind("stamp")).toBe("objects");
    expect(toolToLayerKind("template")).toBe("objects");
    expect(toolToLayerKind("scatter")).toBe("scatter_zone");
    expect(toolToLayerKind("light")).toBe("lights");
    expect(toolToLayerKind("dm_note")).toBe("dm_notes");
    expect(toolToLayerKind("select")).toBeNull();
    expect(toolToLayerKind("measure")).toBeNull();
  });

  it("switches to the active floor's matching layer when mismatched, and preserves active layer when multiple layers share a kind", () => {
    const doc = createBlankMap("Layer_Test.dcmap");
    doc.activeLevelId = "lvl-ground";

    const extraTerrain: MapLayer = {
      id: "layer-terrain-2",
      name: "1F Courtyard Paving",
      kind: "terrain",
      visible: true,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId: "lvl-ground",
      terrainStrokes: [],
    };
    doc.layers.splice(1, 0, extraTerrain);

    // When active layer is lights on 1F and user selects water tool -> focus switches to water layer
    const lightsLayer = doc.layers.find((l) => l.kind === "lights" && l.levelId === "lvl-ground")!;
    const waterLayer = doc.layers.find((l) => l.kind === "water" && l.levelId === "lvl-ground")!;
    doc.activeLayerId = lightsLayer.id;
    expect(findPreferredLayerForKind(doc, "water")?.id).toBe(waterLayer.id);

    // When user explicitly selected the second 1F Terrain layer -> switching to Terrain preserves it!
    doc.activeLayerId = extraTerrain.id;
    expect(findPreferredLayerForKind(doc, "terrain")?.id).toBe(extraTerrain.id);

    // Locked or hidden layers are skipped
    extraTerrain.locked = true;
    const firstTerrain = doc.layers.find((l) => l.kind === "terrain" && !l.locked)!;
    expect(findPreferredLayerForKind(doc, "terrain")?.id).toBe(firstTerrain.id);
  });

  it("describes layer contents accurately with rich tooltips and metadata", () => {
    const waterMeta = getLayerKindMeta("water");
    expect(waterMeta.label).toBe("Water & Biomes");
    expect(waterMeta.color).toBe("#38BDF8");

    const waterLayer: MapLayer = {
      id: "w1",
      name: "1F Moonshadow Tarn",
      kind: "water",
      visible: true,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId: "lvl-ground",
      waterRegions: [
        {
          id: "wr-1",
          kind: "water",
          points: [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 5, y: 5 },
          ],
          cutouts: [
            [
              { x: 1, y: 1 },
              { x: 2, y: 1 },
              { x: 2, y: 2 },
            ],
            [
              { x: 3, y: 3 },
              { x: 4, y: 3 },
              { x: 4, y: 4 },
            ],
          ],
          deepColorHex: "#0B3D5E",
          rimColorHex: "#E6FAFF",
          opacity: 0.95,
        },
        {
          id: "wr-2",
          kind: "water",
          shape: "river",
          points: [
            { x: 6, y: 0 },
            { x: 8, y: 5 },
          ],
          deepColorHex: "#0B3D5E",
          rimColorHex: "#E6FAFF",
          opacity: 0.95,
        },
      ],
    };

    const waterInfo = describeLayerContents(waterLayer);
    expect(waterInfo.totalCount).toBe(2);
    expect(waterInfo.summary).toBe("2 water bodies (2 islands)");
    expect(waterInfo.tooltip).toContain("1F Moonshadow Tarn");
    expect(waterInfo.tooltip).toContain("Water & Biomes · 2 water bodies (2 islands)");

    const wallLayer: MapLayer = {
      id: "wl1",
      name: "1F Hull Walls",
      kind: "walls",
      visible: true,
      locked: false,
      dmOnly: true,
      opacity: 1,
      blendMode: "normal",
      levelId: "lvl-ground",
      walls: [
        {
          id: "w-1",
          assetId: "a.png",
          points: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
          ],
          closed: false,
          curved: false,
          thicknessCells: 0.5,
          blocksLight: true,
        },
      ],
      portals: [
        {
          id: "p-1",
          assetId: "d.png",
          kind: "door",
          x: 2,
          y: 0,
          rotationRad: 0,
          widthCells: 1,
          closed: true,
          locked: false,
          blocksLightWhenClosed: true,
        },
        {
          id: "p-2",
          assetId: "w.png",
          kind: "window",
          x: 3,
          y: 0,
          rotationRad: 0,
          widthCells: 1,
          closed: true,
          locked: false,
          blocksLightWhenClosed: false,
        },
      ],
      objects: [
        {
          id: "o-1",
          assetId: "x.png",
          x: 1,
          y: 1,
          widthCells: 1,
          heightCells: 1,
          rotationRad: 0,
          flipX: false,
          flipY: false,
          opacity: 1,
          castsShadow: true,
          locked: false,
          recolor: { ...DEFAULT_RECOLOR },
          zOrder: 1,
        },
      ],
    };
    const wallInfo = describeLayerContents(wallLayer);
    expect(wallInfo.summary).toBe("1 wall, 2 doors/windows, 1 prop");
    expect(wallInfo.tooltip).toContain("(DM-Only)");

    const emptyLayer: MapLayer = {
      id: "empty-1",
      name: "Empty Props",
      kind: "objects",
      visible: true,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId: "lvl-ground",
      objects: [],
    };
    expect(describeLayerContents(emptyLayer).summary).toBe("Empty");
  });

  it("generates concise per-floor default names without redundant floor prefixes", () => {
    const doc = createBlankMap("Naming_Test.dcmap");
    // Blank map already has 1 water layer on lvl-ground -> next is "Water 2"
    expect(getNextDefaultLayerName(doc, "water", "lvl-ground")).toBe("Water 2");
    // Blank map has 0 cave layers on lvl-ground -> first is "Caves"
    expect(getNextDefaultLayerName(doc, "caves", "lvl-ground")).toBe("Caves");
    // Blank map has 0 water layers on lvl-roofs -> first is "Water"
    expect(getNextDefaultLayerName(doc, "water", "lvl-roofs")).toBe("Water");
  });

  it("infers accurate short layer names from actual layer contents", () => {
    const swampLayer: MapLayer = {
      id: "w-swamp",
      name: "Water 2",
      kind: "water",
      visible: true,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "normal",
      levelId: "lvl-ground",
      waterRegions: [
        {
          id: "r1",
          kind: "swamp",
          presetId: "murky_swamp",
          points: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
          ],
          deepColorHex: "#1E331A",
          rimColorHex: "#7A9E52",
          opacity: 0.94,
        },
      ],
    };
    expect(suggestLayerNameFromContents(swampLayer)).toBe("Swamp");

    const singleLightLayer: MapLayer = {
      id: "lt-1",
      name: "Lights 2",
      kind: "lights",
      visible: true,
      locked: false,
      dmOnly: false,
      opacity: 1,
      blendMode: "add",
      levelId: "lvl-ground",
      lights: [
        {
          id: "l1",
          name: "Campfire Glow",
          x: 5,
          y: 5,
          radiusCells: 4,
          colorHex: "#FFB84D",
          intensity: 0.85,
          castShadows: true,
          coneAngleDeg: 360,
          directionRad: 0,
          flicker: false,
        },
      ],
    };
    expect(suggestLayerNameFromContents(singleLightLayer)).toBe("Campfire Glow");
  });

  it("upgrades legacy verbose built-in layer names without overwriting custom user names", () => {
    expect(
      upgradeLegacyLayerName(
        "hs-layer-lake-water",
        "1F Moonshadow Tarn & Forest Waterfall (Water Studio)",
      ),
    ).toBe("Moonshadow Tarn");
    expect(
      upgradeLegacyLayerName(
        "hs-layer-lake-water",
        "Moonshadow Tarn & Forest Waterfall (Water Studio)",
      ),
    ).toBe("Moonshadow Tarn");
    expect(upgradeLegacyLayerName("hs-layer-lake-water", "My Custom Cove Lake")).toBe(
      "My Custom Cove Lake",
    );
    expect(upgradeLegacyLayerName("layer-terrain", "Terrain Splat")).toBe("Ground Terrain");
    expect(upgradeLegacyLayerName("layer-terrain", "District Streets & Floors")).toBe(
      "Streets & Floors",
    );
  });

  it("keeps every built-in map layer name concise and free of redundant floor prefixes", () => {
    const docs = [
      createBlankMap("Blank.dcmap"),
      createHiddenSloopMap(),
      createLakeYachtMap(),
      createFunicularShowcaseMap(),
    ];
    for (const doc of docs) {
      for (const layer of doc.layers) {
        expect(layer.name.length).toBeLessThanOrEqual(24);
        expect(layer.name).not.toMatch(/^(B\d+|1F|2F|3F|ROOF|Sky \d+\s*·)\s+/);
      }
    }
  });
});

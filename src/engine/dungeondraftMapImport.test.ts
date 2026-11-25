import { describe, expect, it } from "vitest";
import { importDungeondraftMapData } from "@/engine/dungeondraftMapImport";
import type { VaultAsset } from "@/types/map";

function makeBattlemapVault(): VaultAsset[] {
  const mk = (id: string, name: string, category: VaultAsset["category"], tags: string[]): VaultAsset => ({
    id,
    sourceId: "src-builtin-funicular",
    sourceName: "DiceChaos CC0 Battlemap",
    sourceKind: "dcpack",
    internalPath: id,
    url: `/${id}`,
    thumbUrl: `/${id}`,
    displayName: name,
    category,
    widthPx: 256,
    heightPx: 256,
    defaultPpi: 256,
    drawMode: "normal",
    dominantHex: "#64748B",
    castsShadow: true,
    isFavorite: false,
    tags,
  });

  return [
    mk("terrain/dirt_earth.png", "Dirt Earth", "terrain", ["dirt", "terrain"]),
    mk("terrain/wood_planks.png", "Wood Planks", "terrain", ["wood", "plank", "floor"]),
    mk("modular-suite/terrain/roof_slate_tiles.png", "Slate Roof Tiles", "terrain", ["roof", "slate", "tiles"]),
    mk("walls/stone_wall.png", "Stone Wall", "wall", ["stone", "wall"]),
    mk("portals/wood_door.png", "Wood Door", "portal", ["door", "wood"]),
    mk("paths/wagon_track.png", "Wagon Track", "path", ["wagon", "trail", "road"]),
    mk("paths/magirail_funicular_track.png", "Magirail Funicular Track", "path", ["magirail", "funicular", "rail", "track"]),
    mk("objects/carpet_red.png", "Ornate Carpet", "object", ["carpet", "rug", "decor"]),
  ];
}

describe("dungeondraftMapImport", () => {
  it("imports multi-floor Dungeondraft maps, detects Ground floor automatically, and converts tiles, patterns, walls, portals, water, lights, and roofs", () => {
    // 10x8 map with top-down level ordering ("0"=Roof, "1"=Ground, "2"=Basement) just like real DD saves!
    const tileCells = new Array(10 * 8).fill(-1);
    tileCells[2 * 10 + 2] = 0;
    tileCells[2 * 10 + 3] = 0;
    tileCells[2 * 10 + 4] = 0;

    const fakeDd = {
      header: { creation_build: "1.0.1.1" },
      world: {
        width: 10,
        height: 8,
        levels: {
          "0": {
            label: "Roof",
            terrain: { enabled: false, texture_1: "res://textures/terrain/terrain_dirt.png" },
            roofs: {
              sun_direction: 45,
              shade_contrast: 0.5,
              roofs: [
                {
                  position: "Vector2( 256, 0 )",
                  points: "PoolVector2Array( 512, 512, 1536, 512 )",
                  width: 384,
                  type: 1,
                  texture: "res://textures/roofs/round_slate_gray/tiles.png",
                },
              ],
            },
          },
          "1": {
            label: "Ground",
            environment: { ambient_light: "ff8090a0" },
            terrain: { enabled: true, texture_1: "res://textures/terrain/terrain_dirt.png" },
            tiles: {
              cells: `PoolIntArray( ${tileCells.join(", ")} )`,
              lookup: { "0": "res://textures/tilesets/smart/tileset_wood_vertical.png" },
            },
            patterns: [
              {
                position: "Vector2( 256, 256 )",
                points: "PoolVector2Array( 0, 0, 512, 0, 512, 512, 0, 512 )",
                texture: "res://textures/tilesets/simple/tileset_wood_interlaced.png",
                color: "ffb28f6f",
              },
            ],
            walls: [
              {
                points: "PoolVector2Array( 512, 512, 1536, 512, 1536, 1280 )",
                texture: "res://textures/walls/stone.png",
                color: "ff605f58",
                loop: false,
                portals: [
                  {
                    position: "Vector2( 1024, 512 )",
                    rotation: 0,
                    radius: 128,
                    texture: "res://textures/portals/door_00.png",
                    closed: true,
                  },
                ],
              },
            ],
            paths: [
              {
                position: "Vector2( 256, 1024 )",
                edit_points: "PoolVector2Array( 0, 0, 1024, 0 )",
                width: 128,
                smoothness: 1,
                fade_in: true,
                texture: "res://textures/paths/wagon_trail.png",
              },
            ],
            objects: [
              {
                position: "Vector2( 1024, 768 )",
                rotation: 1.57,
                scale: "Vector2( 1.2, 1.2 )",
                mirror: true,
                layer: 100,
                custom_color: "ffcc3322",
                texture: "res://textures/objects/decor/floor/carpet_02.png",
              },
            ],
            lights: [
              {
                position: "Vector2( 1024, 768 )",
                range: 6,
                intensity: 1.1,
                color: "ffeccd8b",
                shadows: true,
              },
            ],
            water: {
              disable_border: false,
              tree: {
                polygon: "PoolVector2Array(  )",
                children: [
                  {
                    polygon: "PoolVector2Array( 0, 1536, 2560, 1536, 2560, 2048, 0, 2048 )",
                    deep_color: "ff113355",
                    shallow_color: "ff3388aa",
                    children: [
                      {
                        polygon: "PoolVector2Array( 512, 1664, 768, 1664, 768, 1920, 512, 1920 )",
                      },
                    ],
                  },
                ],
              },
            },
          },
          "2": {
            label: "Basement",
            terrain: { enabled: false },
            objects: [],
          },
        },
      },
    };

    const { doc, summary } = importDungeondraftMapData(fakeDd, makeBattlemapVault(), {
      fileName: "TannerFort.dungeondraft_map",
      policy: "cc0_only",
    });

    expect(doc.mode).toBe("battlemap");
    expect(doc.canvas.widthCells).toBe(10);
    expect(doc.canvas.heightCells).toBe(8);
    expect(doc.levels).toHaveLength(3);
    // Ground ("1") automatically chosen as activeLevelId & visible instead of Roof ("0")!
    expect(doc.activeLevelId).toBe("lvl-dd-1");
    expect(doc.levels.find((l) => l.id === "lvl-dd-1")?.visible).toBe(true);
    expect(doc.levels.find((l) => l.id === "lvl-dd-0")?.shortCode).toBe("ROOF");
    expect(doc.levels.find((l) => l.id === "lvl-dd-2")?.shortCode).toBe("B1");

    expect(summary.counts.walls).toBe(1);
    expect(summary.counts.portals).toBe(1);
    expect(summary.counts.trailsOrPaths).toBe(1);
    expect(summary.counts.symbolsOrObjects).toBe(1);
    expect(summary.counts.lights).toBe(1);
    expect(summary.counts.waterRegions).toBe(1);
    expect(summary.counts.roofs).toBe(1);

    // Verify Roof position offset + width doubling (384*2/256 = 3.0 cells!) + hip style + roof texture
    const roof = doc.layers.find((l) => l.kind === "roofs")!.roofs![0];
    expect(roof.style).toBe("hip");
    expect(roof.points[0]).toEqual({ x: 3, y: 2 }); // (256+512)/256 = 3, (0+512)/256 = 2
    expect(roof.widthCells).toBeCloseTo(3.0, 2);
    expect(roof.assetId).toBe("modular-suite/terrain/roof_slate_tiles.png");

    // Verify Building tiles (3 adjacent cells merged into 1 rectangle) + Pattern polygon
    const groundTerrain = doc.layers.find((l) => l.id === "layer-dd-terrain-1")!.terrainStrokes!;
    expect(groundTerrain).toHaveLength(2);
    expect(groundTerrain[0].points[1].x - groundTerrain[0].points[0].x).toBe(3);

    // Verify Water polygon + dry island cutout + per-node deep/shallow colors
    const water = doc.layers.find((l) => l.kind === "water")!.waterRegions![0];
    expect(water.deepColorHex).toBe("#113355");
    expect(water.shallowColorHex).toBe("#3388AA");
    expect(water.cutouts).toHaveLength(1);

    // Verify object custom color & importedSourceRef
    const obj = doc.layers.find((l) => l.id === "layer-dd-objects-1")!.objects![0];
    expect(obj.recolor.enabled).toBe(true);
    expect(obj.recolor.tintHex).toBe("#CC3322");
    expect(obj.importedSourceRef).toContain("carpet_02.png");
  });

  it("clips diagonal building tiles cleanly to format-3 shapes.polygons and maps rail paths to Magirail", () => {
    const tileCells = new Array(12 * 12).fill(-1);
    for (let y = 3; y <= 7; y++) {
      for (let x = 3; x <= 7; x++) {
        tileCells[y * 12 + x] = 0;
      }
    }
    const diagDd = {
      world: {
        width: 12,
        height: 12,
        levels: {
          "0": {
            label: "Ground",
            terrain: { enabled: true, texture_1: "res://textures/terrain/terrain_dirt.png" },
            shapes: {
              polygons: ["PoolVector2Array( 1024, 768, 2048, 1280, 1792, 2048, 768, 1536 )"],
              walls: [4],
            },
            tiles: {
              cells: `PoolIntArray( ${tileCells.join(", ")} )`,
              lookup: { "0": "res://textures/tilesets/simple/tileset_wood_interlaced.png" },
            },
            walls: [
              {
                points: "PoolVector2Array( 1024, 768, 2048, 1280, 1792, 2048, 768, 1536 )",
                texture: "res://textures/walls/battlements.png",
                loop: true,
              },
            ],
            paths: [
              {
                position: "Vector2( 0, 256 )",
                edit_points: "PoolVector2Array( 0, 0, 2048, -256 )",
                width: 270,
                texture: "res://textures/paths/rail.png",
              },
            ],
          },
        },
      },
    };

    const { doc } = importDungeondraftMapData(diagDd, makeBattlemapVault(), {
      fileName: "Lankwitz.dungeondraft_map",
      policy: "cc0_only",
    });

    const groundTerrain = doc.layers.find((l) => l.id === "layer-dd-terrain-0")!.terrainStrokes!;
    const shapeFloor = groundTerrain.find((s) => s.id.startsWith("dd-shape-floor-"));
    expect(shapeFloor).toBeDefined();
    expect(shapeFloor!.shape).toBe("polygon");
    expect(shapeFloor!.points).toHaveLength(4);
    expect(shapeFloor!.points[0]).toEqual({ x: 4, y: 3 });

    const railPath = doc.layers.find((l) => l.kind === "paths")!.paths![0];
    expect(railPath.assetId).toBe("paths/magirail_funicular_track.png");
    // Format-3 shapes.polygons strictly clip tiles.cells — no stray unclipped dd-tile-* blocks!
    expect(groundTerrain.filter((s) => s.id.startsWith("dd-tile-"))).toHaveLength(0);
  });

  it("hides ROOF/non-ground layers on initial open, honors wall shadow flag, negative scale flip, and yellow streetline tint", () => {
    const vault: VaultAsset[] = [
      ...makeBattlemapVault(),
      {
        id: "modular-suite/paths/path_colorable_trim.png",
        sourceId: "src-modular",
        sourceName: "Modular CC0",
        sourceKind: "dcpack",
        internalPath: "modular-suite/paths/path_colorable_trim.png",
        url: "/modular-suite/paths/path_colorable_trim.png",
        thumbUrl: "/modular-suite/paths/path_colorable_trim.png",
        displayName: "Colorable Painted Floor Trim",
        category: "path",
        widthPx: 512,
        heightPx: 128,
        defaultPpi: 256,
        drawMode: "dd_red",
        dominantHex: "#DC2626",
        castsShadow: false,
        isFavorite: false,
        tags: ["cc0", "colorable", "path", "trim"],
      },
      {
        id: "modular-suite/paths/path_stream_rapids.png",
        sourceId: "src-modular",
        sourceName: "Modular CC0",
        sourceKind: "dcpack",
        internalPath: "modular-suite/paths/path_stream_rapids.png",
        url: "/modular-suite/paths/path_stream_rapids.png",
        thumbUrl: "/modular-suite/paths/path_stream_rapids.png",
        displayName: "Foaming Creek Stream Rapids",
        category: "path",
        widthPx: 512,
        heightPx: 128,
        defaultPpi: 256,
        drawMode: "normal",
        dominantHex: "#38BDF8",
        castsShadow: false,
        isFavorite: false,
        tags: ["cc0", "path", "water", "stream", "rapids"],
      },
      {
        id: "modular-suite/colorable/col_tablecloth_round.png",
        sourceId: "src-modular",
        sourceName: "Modular CC0",
        sourceKind: "dcpack",
        internalPath: "modular-suite/colorable/col_tablecloth_round.png",
        url: "/modular-suite/colorable/col_tablecloth_round.png",
        thumbUrl: "/modular-suite/colorable/col_tablecloth_round.png",
        displayName: "Colorable Draped Round Tablecloth",
        category: "object",
        widthPx: 224,
        heightPx: 224,
        defaultPpi: 256,
        drawMode: "dd_red",
        dominantHex: "#DC2626",
        castsShadow: true,
        isFavorite: false,
        tags: ["cc0", "colorable", "dd_red", "tablecloth", "round", "tavern"],
      },
      {
        id: "modular-suite/modular/bare_oak_l_counter.png",
        sourceId: "src-modular",
        sourceName: "Modular CC0",
        sourceKind: "dcpack",
        internalPath: "modular-suite/modular/bare_oak_l_counter.png",
        url: "/modular-suite/modular/bare_oak_l_counter.png",
        thumbUrl: "/modular-suite/modular/bare_oak_l_counter.png",
        displayName: "Warm Oak Bare L-Shaped Counter",
        category: "object",
        widthPx: 288,
        heightPx: 288,
        defaultPpi: 131,
        drawMode: "normal",
        dominantHex: "#9A6B3F",
        castsShadow: true,
        isFavorite: false,
        tags: ["cc0", "bare", "oak", "counter", "tavern"],
      },
      {
        id: "modular-suite/props/bare_furniture/bare_round_cafe_table.png",
        sourceId: "src-modular",
        sourceName: "Modular CC0",
        sourceKind: "dcpack",
        internalPath: "modular-suite/props/bare_furniture/bare_round_cafe_table.png",
        url: "/modular-suite/props/bare_furniture/bare_round_cafe_table.png",
        thumbUrl: "/modular-suite/props/bare_furniture/bare_round_cafe_table.png",
        displayName: "Bare Round Bistro Café Table (Empty)",
        category: "object",
        widthPx: 230,
        heightPx: 230,
        defaultPpi: 164,
        drawMode: "normal",
        dominantHex: "#9A6B3F",
        castsShadow: true,
        isFavorite: false,
        tags: ["cc0", "bare", "furniture", "table", "tavern"],
      },
    ];

    const dd = {
      world: {
        width: 12,
        height: 12,
        levels: {
          "0": {
            label: "Roof Layer",
            terrain: { enabled: false },
            roofs: {
              roofs: [
                {
                  position: "Vector2( 0, 0 )",
                  points: "PoolVector2Array( 256, 256, 1280, 256 )",
                  width: 384,
                  type: 0,
                  texture: "res://textures/roofs/flat_clay_red/tiles.png",
                },
              ],
            },
          },
          "1": {
            label: "Ground",
            terrain: { enabled: true, texture_1: "res://textures/terrain/terrain_dirt.png" },
            walls: [
              {
                points: "PoolVector2Array( 256, 256, 1280, 256 )",
                texture: "res://textures/walls/stone_09.png",
                loop: false,
                shadow: false,
              },
              {
                points: "PoolVector2Array( 256, 512, 1280, 512 )",
                texture: "res://textures/walls/battlements.png",
                loop: true,
                shadow: true,
              },
            ],
            paths: [
              {
                position: "Vector2( 0, 768 )",
                edit_points: "PoolVector2Array( 0, 0, 2048, 0 )",
                width: 95,
                texture: "res://packs/0CW8bqYH/textures/paths/streetline_yellow.png",
              },
            ],
            objects: [
              {
                position: "Vector2( 512, 512 )",
                rotation: 0.785,
                scale: "Vector2( -1.8, 1.8 )",
                mirror: true,
                texture: "res://textures/objects/furniture/tables/table_corner_wood_05.png",
              },
              {
                position: "Vector2( 768, 512 )",
                rotation: 0,
                scale: "Vector2( 1.2, 1.2 )",
                custom_color: "ffd8d8d8",
                texture: "res://textures/objects/furniture/tables/round_table_03.png",
              },
            ],
          },
        },
      },
    };

    const { doc } = importDungeondraftMapData(dd, vault, {
      fileName: "MrRogers.dungeondraft_map",
      policy: "cc0_only",
    });

    // ROOF layer must start hidden when Ground floor is active, and empty ROOF placeholder layers are omitted
    const roofLayer = doc.layers.find((l) => l.kind === "roofs")!;
    expect(roofLayer.visible).toBe(false);
    expect(doc.layers.filter((l) => l.levelId === "lvl-dd-0")).toHaveLength(1);
    const groundWallsLayer = doc.layers.find((l) => l.id === "layer-dd-walls-1")!;
    expect(groundWallsLayer.visible).toBe(true);

    // Non-shadow interior/curb wall vs shadow-casting exterior wall
    const [curbWall, extWall] = groundWallsLayer.walls!;
    expect(curbWall.blocksLight).toBe(false);
    expect(curbWall.thicknessCells).toBeLessThan(extWall.thicknessCells);
    expect(extWall.blocksLight).toBe(true);

    // Yellow streetline maps to colorable trim tinted yellow (NEVER stream rapids!)
    const streetPath = doc.layers.find((l) => l.kind === "paths")!.paths![0];
    expect(streetPath.assetId).toBe("modular-suite/paths/path_colorable_trim.png");
    expect(streetPath.recolor?.enabled).toBe(true);
    expect(streetPath.recolor?.tintHex).toBe("#EAB308");

    // Mirrored negative-scale L-counter preserves flipX: true and normalizes against 256px/grid (NOT low defaultPpi=131!)
    const [lCounter, roundTable] = doc.layers.find((l) => l.id === "layer-dd-objects-1")!.objects!;
    expect(lCounter.assetId).toBe("modular-suite/modular/bare_oak_l_counter.png");
    expect(lCounter.flipX).toBe(true);
    expect(lCounter.widthCells).toBeCloseTo(2.03, 1);
    expect(roundTable.assetId).toBe("modular-suite/colorable/col_tablecloth_round.png");
    expect(roundTable.widthCells).toBeCloseTo(1.05, 1);
    expect(roundTable.recolor.mode).toBe("dd_red");
    expect(roundTable.recolor.tintHex).toBe("#D8D8D8");
  });
});

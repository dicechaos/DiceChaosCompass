/**
 * Showcase World Atlas ("The Shattered Reach") & Blank World Atlas Factory for Dice Chaos Compass v1.5.
 */

import {
  createDefaultWorldData,
  isPointOnLand,
  sampleWorldBiomeColor,
  sculptWorldHeightmap,
} from "@/engine/worldEngine";
import { getWorldThemeById } from "@/engine/worldThemes";
import {
  DEFAULT_RECOLOR,
  type DcMapDocument,
  type ObjectStamp,
  type Point2D,
  type WorldLandmassPreset,
  type WorldMapData,
} from "@/types/map";

function findNearestSurfacePoint(
  world: WorldMapData,
  target: Point2D,
  wantLand: boolean,
  wCells: number,
  hCells: number,
  maxRadius = 7.5,
): Point2D {
  if (isPointOnLand(world, target, wCells, hCells) === wantLand) {
    return target;
  }
  for (let r = 0.6; r <= maxRadius; r += 0.6) {
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const cand = {
        x: Math.max(2.5, Math.min(wCells - 2.5, target.x + Math.cos(a) * r)),
        y: Math.max(2.5, Math.min(hCells - 2.5, target.y + Math.sin(a) * r)),
      };
      if (isPointOnLand(world, cand, wCells, hCells) === wantLand) {
        return cand;
      }
    }
  }
  return target;
}

export function createBlankWorldMap(opts?: {
  title?: string;
  themeId?: string;
  preset?: WorldLandmassPreset;
  seed?: number;
  waterLevel?: number;
  roughness?: number;
}): DcMapDocument {
  const now = new Date().toISOString();
  const world = createDefaultWorldData({
    themeId: opts?.themeId ?? "parchment",
    preset: opts?.preset ?? "continents",
    seed: opts?.seed ?? Math.floor(1000 + Math.random() * 8999),
    waterLevel: opts?.waterLevel ?? 0.48,
    roughness: opts?.roughness ?? 0.62,
  });

  return {
    schemaVersion: "1.0.0",
    id: `dcmap-world-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    mode: "world",
    meta: {
      title: opts?.title ?? "Untitled World Atlas",
      author: "Dice Chaos Compass",
      createdAt: now,
      updatedAt: now,
    },
    canvas: {
      widthCells: 48,
      heightCells: 27,
      ppi: 128,
      baseTerrainAssetId: "world-atlas/textures/world_paper_aged_parchment.png",
      grid: {
        type: "none",
        visible: false,
        colorHex: "#3C2B1E",
        opacity: 0.25,
      },
    },
    levels: [
      {
        id: "lvl-world",
        shortCode: "MAP",
        name: "Overland Atlas",
        kind: "ground",
        elevationFt: 0,
        visible: true,
      },
    ],
    activeLevelId: "lvl-world",
    layers: [
      {
        id: "lyr-world-symbols",
        name: "Mountains, Forests & Cities",
        kind: "objects",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId: "lvl-world",
        objects: [],
      },
      {
        id: "lyr-world-maritime",
        name: "Ships & Sea Monsters",
        kind: "objects",
        visible: true,
        locked: false,
        dmOnly: false,
        opacity: 1,
        blendMode: "normal",
        levelId: "lvl-world",
        objects: [],
      },
      {
        id: "lyr-world-dm",
        name: "DM Campaign Secrets",
        kind: "dm_notes",
        visible: true,
        locked: false,
        dmOnly: true,
        opacity: 1,
        blendMode: "normal",
        levelId: "lvl-world",
        dmNotes: [],
      },
    ],
    activeLayerId: "lyr-world-symbols",
    lighting: {
      enabled: false,
      activePresetId: "daylight",
      ambientColorHex: "#FFFFFF",
      ambientIntensity: 1,
      shadowSoftness: 0.2,
      presets: [
        {
          id: "daylight",
          name: "Atlas Daylight",
          ambientColorHex: "#FFFFFF",
          ambientIntensity: 1,
        },
      ],
    },
    world,
  };
}

/**
 * Rich pre-crafted Wonderdraft-parity World Atlas ("The Shattered Reach Atlas")
 * showcasing fractal coastlines, coastal ripples, watercolor biomes, meandering rivers,
 * trade roads & nautical sea lanes, coastline-clipped kingdoms, curved labels & scroll title,
 * compass rose + rhumb lines, calibrated scale bar, and 30+ hand-inked CC0 World Atlas symbols.
 */
export function createWorldShowcaseMap(): DcMapDocument {
  const doc = createBlankWorldMap({
    title: "The Shattered Reach Atlas",
    themeId: "parchment",
    preset: "continents",
    seed: 4207,
    waterLevel: 0.52,
    roughness: 0.64,
  });

  const wCells = doc.canvas.widthCells;
  const hCells = doc.canvas.heightCells;
  const world = doc.world!;
  const theme = getWorldThemeById("parchment");

  // Sculpt a crisp freshwater alpine mirror lake on the western continent + a dramatic pirate isle in the south
  const lakePos = findNearestSurfacePoint(world, { x: 11.8, y: 11.2 }, true, wCells, hCells);
  const sculpted1 = sculptWorldHeightmap(world, [lakePos], wCells, hCells, {
    mode: "lake_carve",
    radiusCells: 1.65,
    roughness: 0.55,
    strength: 0.95,
    seed: 701,
  });
  world.heightmapB64 = sculpted1.heightmapB64;
  world.freshwaterB64 = sculpted1.freshwaterB64;

  // Raise a guaranteed small southern corsair island in the lower central sea
  const sculpted2 = sculptWorldHeightmap(
    world,
    [
      { x: 24.5, y: 21.4 },
      { x: 25.8, y: 21.8 },
    ],
    wCells,
    hCells,
    {
      mode: "raise",
      radiusCells: 2.4,
      roughness: 0.68,
      strength: 0.92,
      seed: 912,
    },
  );
  world.heightmapB64 = sculpted2.heightmapB64;
  world.freshwaterB64 = sculpted2.freshwaterB64;

  // Land-clipped watercolor biome ground washes (automatically clipped strictly inside coastlines!)
  world.biomeStrokes = [
    // Northern snow & tundra caps
    {
      id: "wb-snow-w",
      points: [{ x: 10, y: 5.5 }, { x: 14, y: 5.8 }, { x: 17, y: 6.4 }],
      radiusCells: 4.8,
      colorHex: "#E7ECEB",
      opacity: 0.72,
      softness: 0.85,
      roughness: 0.5,
      seed: 11,
    },
    {
      id: "wb-snow-e",
      points: [{ x: 32, y: 5.5 }, { x: 36, y: 6.0 }],
      radiusCells: 4.5,
      colorHex: "#E7ECEB",
      opacity: 0.68,
      softness: 0.85,
      roughness: 0.5,
      seed: 12,
    },
    // Emerald ancient forests (western heartland)
    {
      id: "wb-forest-w",
      points: [{ x: 9.5, y: 12.2 }, { x: 11.5, y: 14.5 }, { x: 13.5, y: 13.5 }],
      radiusCells: 4.8,
      colorHex: "#7A9468",
      opacity: 0.58,
      softness: 0.82,
      roughness: 0.45,
      seed: 13,
    },
    // Lush sunlit meadow plains around Capital
    {
      id: "wb-meadow-w",
      points: [{ x: 14.5, y: 16.5 }, { x: 17.5, y: 15.5 }],
      radiusCells: 4.4,
      colorHex: "#B5C282",
      opacity: 0.52,
      softness: 0.8,
      roughness: 0.4,
      seed: 14,
    },
    // Eastern warm steppe & golden desert sands
    {
      id: "wb-desert-e",
      points: [{ x: 32.5, y: 15.0 }, { x: 35.8, y: 16.2 }, { x: 38.5, y: 14.5 }],
      radiusCells: 5.4,
      colorHex: "#DFC087",
      opacity: 0.68,
      softness: 0.82,
      roughness: 0.5,
      seed: 15,
    },
    // Volcanic crimson badlands around eastern volcano
    {
      id: "wb-badlands-e",
      points: [{ x: 36.5, y: 10.2 }, { x: 38.5, y: 11.2 }],
      radiusCells: 3.4,
      colorHex: "#B97D5E",
      opacity: 0.56,
      softness: 0.8,
      roughness: 0.55,
      seed: 16,
    },
    // Southern tropical emerald isle
    {
      id: "wb-isle-s",
      points: [{ x: 25.0, y: 21.5 }],
      radiusCells: 3.0,
      colorHex: "#789C6D",
      opacity: 0.58,
      softness: 0.8,
      roughness: 0.45,
      seed: 17,
    },
  ];

  // Key landmark anchors snapped cleanly onto guaranteed land/sea positions
  const capitalPos = findNearestSurfacePoint(world, { x: 15.6, y: 15.2 }, true, wCells, hCells);
  const elvenPos = findNearestSurfacePoint(world, { x: 9.8, y: 14.2 }, true, wCells, hCells);
  const dwarvenPos = findNearestSurfacePoint(world, { x: 13.8, y: 8.4 }, true, wCells, hCells);
  const harborPos = findNearestSurfacePoint(world, { x: 19.2, y: 14.4 }, true, wCells, hCells);
  const hamletPos = findNearestSurfacePoint(world, { x: 13.4, y: 18.2 }, true, wCells, hCells);

  const oasisPos = findNearestSurfacePoint(world, { x: 34.4, y: 16.4 }, true, wCells, hCells);
  const wizardPos = findNearestSurfacePoint(world, { x: 31.8, y: 9.2 }, true, wCells, hCells);
  const pagodaPos = findNearestSurfacePoint(world, { x: 39.0, y: 13.4 }, true, wCells, hCells);
  const volcanoPos = findNearestSurfacePoint(world, { x: 36.8, y: 10.2 }, true, wCells, hCells);
  const ruinsPos = findNearestSurfacePoint(world, { x: 30.8, y: 13.8 }, true, wCells, hCells);
  const pirateFortPos = findNearestSurfacePoint(world, { x: 25.1, y: 21.4 }, true, wCells, hCells);

  // Coastline-clipped Political Regions
  world.regions = [
    {
      id: "wreg-valoria",
      name: "Crown of Valoria",
      polygon: [
        { x: 10.5, y: 11.5 },
        { x: 21.5, y: 10.8 },
        { x: 22.0, y: 19.8 },
        { x: 11.2, y: 20.5 },
      ],
      curved: true,
      fillColorHex: "#3B6E8C",
      fillOpacity: 0.14,
      borderColorHex: "#2C4D66",
      borderWidth: 1.8,
      borderStyle: "dashed",
      clipToLand: true,
    },
    {
      id: "wreg-sunscar",
      name: "Sunscar Sultanate",
      polygon: [
        { x: 29.2, y: 12.2 },
        { x: 42.5, y: 11.5 },
        { x: 42.0, y: 20.8 },
        { x: 29.5, y: 20.2 },
      ],
      curved: true,
      fillColorHex: "#B55D3C",
      fillOpacity: 0.14,
      borderColorHex: "#7A3422",
      borderWidth: 1.8,
      borderStyle: "dashed",
      clipToLand: true,
    },
  ];

  // Meandering Tapered Rivers (from mountain springs to the coast)
  const wRiverMouth = findNearestSurfacePoint(world, { x: 20.2, y: 15.8 }, false, wCells, hCells);
  const eRiverMouth = findNearestSurfacePoint(world, { x: 28.8, y: 16.4 }, false, wCells, hCells);
  world.rivers = [
    {
      id: "wriv-silvervein",
      name: "Silvervein River",
      points: [
        { x: dwarvenPos.x - 0.5, y: dwarvenPos.y + 0.8 },
        { x: lakePos.x + 0.4, y: lakePos.y + 0.3 },
        { x: capitalPos.x - 0.3, y: capitalPos.y + 0.7 },
        wRiverMouth,
      ],
      startWidthCells: 0.08,
      endWidthCells: 0.42,
      meanderRoughness: 0.42,
      meanderScale: 1.15,
      curved: true,
      seed: 311,
    },
    {
      id: "wriv-saffron",
      name: "Saffron River",
      points: [
        { x: wizardPos.x + 1.4, y: wizardPos.y + 1.0 },
        { x: ruinsPos.x + 1.6, y: ruinsPos.y + 0.8 },
        { x: oasisPos.x - 1.5, y: oasisPos.y - 0.4 },
        eRiverMouth,
      ],
      startWidthCells: 0.07,
      endWidthCells: 0.36,
      meanderRoughness: 0.46,
      meanderScale: 1.05,
      curved: true,
      seed: 419,
    },
  ];

  // Overland Imperial Roads & Nautical Trade Sea Lanes
  const seaMid1 = findNearestSurfacePoint(world, { x: 24.0, y: 14.2 }, false, wCells, hCells);
  const seaMid2 = findNearestSurfacePoint(world, { x: 27.6, y: 15.8 }, false, wCells, hCells);
  world.trails = [
    {
      id: "wtrl-kingsroad",
      name: "King's Highroad",
      points: [dwarvenPos, capitalPos, harborPos],
      style: "double_road",
      widthCells: 0.14,
      colorHex: "#5C3A21",
      outlineColorHex: "#F1E4C8",
      dashScale: 1.0,
      curved: true,
      opacity: 0.9,
    },
    {
      id: "wtrl-elvenpath",
      name: "Sylvan Trail",
      points: [elvenPos, hamletPos, capitalPos],
      style: "dotted",
      widthCells: 0.11,
      colorHex: "#5B432C",
      dashScale: 1.0,
      curved: true,
      opacity: 0.85,
    },
    {
      id: "wtrl-desertcaravan",
      name: "Silk & Spice Caravan",
      points: [ruinsPos, oasisPos, pagodaPos],
      style: "dashed",
      widthCells: 0.11,
      colorHex: "#7A4524",
      dashScale: 1.1,
      curved: true,
      opacity: 0.85,
    },
    {
      id: "wtrl-sealane",
      name: "Shattered Sea Trade Lane",
      points: [
        { x: harborPos.x + 0.8, y: harborPos.y + 0.4 },
        seaMid1,
        seaMid2,
        { x: oasisPos.x - 3.6, y: oasisPos.y + 0.2 },
      ],
      style: "sea_lane",
      widthCells: 0.1,
      colorHex: "#3C5562",
      dashScale: 1.2,
      curved: true,
      opacity: 0.78,
    },
  ];

  // Hand-Inked World Atlas Symbols (Y-sorted automatically by worldRenderer!)
  let z = 1;
  const makeSym = (
    id: string,
    assetId: string,
    pt: Point2D,
    w: number,
    h: number,
    sampleBiome = false,
  ): ObjectStamp => ({
    id,
    assetId,
    x: pt.x,
    y: pt.y,
    widthCells: w,
    heightCells: h,
    rotationRad: 0,
    flipX: false,
    flipY: false,
    opacity: 1,
    castsShadow: true,
    locked: false,
    recolor: sampleBiome
      ? {
          ...DEFAULT_RECOLOR,
          enabled: true,
          mode: "tint",
          tintHex: sampleWorldBiomeColor(world, pt),
          strength: 0.72,
        }
      : { ...DEFAULT_RECOLOR },
    zOrder: z++,
  });

  const landSymbols: ObjectStamp[] = [
    // Major Settlements
    makeSym("wsym-capital", "world-atlas/settlements/hero_walled_capital_city.png", capitalPos, 3.0, 2.85),
    makeSym("wsym-elven", "world-atlas/settlements/hero_elven_spire_citadel.png", elvenPos, 2.5, 2.6),
    makeSym("wsym-dwarven", "world-atlas/settlements/hero_dwarven_mountain_gate.png", dwarvenPos, 2.5, 2.4),
    makeSym("wsym-harbor", "world-atlas/settlements/hero_coastal_harbor_castle.png", harborPos, 2.35, 2.35),
    makeSym("wsym-hamlet", "world-atlas/settlements/hero_thatched_hamlet_windmill.png", hamletPos, 2.0, 1.9),
    makeSym("wsym-oasis", "world-atlas/settlements/hero_desert_oasis_palace.png", oasisPos, 2.75, 2.65),
    makeSym("wsym-wizard", "world-atlas/settlements/hero_wizard_observatory_spire.png", wizardPos, 2.25, 2.45),
    makeSym("wsym-pagoda", "world-atlas/settlements/hero_eastern_jade_pagoda.png", pagodaPos, 2.35, 2.45),
    makeSym("wsym-ruins", "world-atlas/landmarks/hero_gothic_overgrown_ruins.png", ruinsPos, 2.0, 1.95),
    makeSym("wsym-pirate", "world-atlas/settlements/hero_pirate_island_fort.png", pirateFortPos, 2.3, 2.2),

    // Mountain Ranges & Volcano
    makeSym(
      "wsym-mtn-w1",
      "world-atlas/mountains/hero_alpine_massif_peak.png",
      findNearestSurfacePoint(world, { x: 11.4, y: 7.4 }, true, wCells, hCells),
      3.1,
      2.65,
    ),
    makeSym(
      "wsym-mtn-w2",
      "world-atlas/mountains/range_alpine_peaks_01.png",
      findNearestSurfacePoint(world, { x: 15.8, y: 7.6 }, true, wCells, hCells),
      3.3,
      2.4,
    ),
    makeSym(
      "wsym-mtn-w3",
      "world-atlas/mountains/hero_rolling_green_foothills.png",
      findNearestSurfacePoint(world, { x: 16.5, y: 10.6 }, true, wCells, hCells),
      2.6,
      1.9,
    ),
    makeSym("wsym-volcano", "world-atlas/mountains/hero_smoking_volcano_peak.png", volcanoPos, 2.8, 2.55),
    makeSym(
      "wsym-mtn-e1",
      "world-atlas/mountains/hero_triple_alpine_ridge.png",
      findNearestSurfacePoint(world, { x: 34.4, y: 8.2 }, true, wCells, hCells),
      3.0,
      2.3,
    ),
    makeSym(
      "wsym-mesa-e1",
      "world-atlas/mountains/hero_red_sandstone_mesa.png",
      findNearestSurfacePoint(world, { x: 37.2, y: 16.8 }, true, wCells, hCells),
      2.5,
      2.1,
    ),

    // Lush Forests & Groves
    makeSym(
      "wsym-for-w1",
      "world-atlas/trees/forest_dense_pines_01.png",
      findNearestSurfacePoint(world, { x: 9.2, y: 11.4 }, true, wCells, hCells),
      2.6,
      2.1,
    ),
    makeSym(
      "wsym-for-w2",
      "world-atlas/trees/forest_oak_woodland_01.png",
      findNearestSurfacePoint(world, { x: 11.8, y: 16.0 }, true, wCells, hCells),
      2.5,
      2.0,
    ),
    makeSym(
      "wsym-for-w3",
      "world-atlas/trees/hero_snowy_spruce_cluster.png",
      findNearestSurfacePoint(world, { x: 9.5, y: 8.8 }, true, wCells, hCells),
      2.2,
      2.0,
    ),
    makeSym(
      "wsym-for-w4",
      "world-atlas/trees/hero_broadleaf_oak_copse.png",
      findNearestSurfacePoint(world, { x: 17.5, y: 17.8 }, true, wCells, hCells),
      2.2,
      1.95,
    ),
    makeSym(
      "wsym-for-e1",
      "world-atlas/trees/forest_dense_pines_02.png",
      findNearestSurfacePoint(world, { x: 30.8, y: 11.2 }, true, wCells, hCells),
      2.3,
      1.9,
    ),
    makeSym(
      "wsym-for-e2",
      "world-atlas/trees/hero_alpine_pine_grove.png",
      findNearestSurfacePoint(world, { x: 33.4, y: 11.8 }, true, wCells, hCells),
      2.1,
      1.85,
    ),
  ];

  // Maritime Vessels & Sea Monsters placed cleanly in Open Ocean!
  const seaSymbols: ObjectStamp[] = [
    makeSym(
      "wsym-galleon",
      "world-atlas/maritime/hero_sailing_galleon_ship.png",
      findNearestSurfacePoint(world, { x: 23.6, y: 13.8 }, false, wCells, hCells),
      2.4,
      2.4,
    ),
    makeSym(
      "wsym-longship",
      "world-atlas/maritime/hero_viking_dragon_longship.png",
      findNearestSurfacePoint(world, { x: 23.8, y: 6.2 }, false, wCells, hCells),
      2.15,
      2.05,
    ),
    makeSym(
      "wsym-airship",
      "world-atlas/maritime/hero_sky_dirigible_airship.png",
      { x: 26.8, y: 9.8 },
      2.4,
      2.0,
    ),
    makeSym(
      "wsym-serpent",
      "world-atlas/maritime/hero_horned_sea_serpent.png",
      findNearestSurfacePoint(world, { x: 5.2, y: 18.8 }, false, wCells, hCells),
      2.4,
      2.2,
    ),
    makeSym(
      "wsym-kraken",
      "world-atlas/maritime/hero_giant_kraken.png",
      findNearestSurfacePoint(world, { x: 29.8, y: 21.8 }, false, wCells, hCells),
      2.5,
      2.3,
    ),
    makeSym(
      "wsym-maelstrom",
      "world-atlas/maritime/hero_ocean_maelstrom_vortex.png",
      findNearestSurfacePoint(world, { x: 21.6, y: 19.6 }, false, wCells, hCells),
      2.2,
      2.0,
    ),
  ];

  doc.layers[0].objects = landSymbols;
  doc.layers[1].objects = seaSymbols;
  doc.layers[2].dmNotes = [
    {
      id: "wdm-1",
      x: volcanoPos.x + 0.5,
      y: volcanoPos.y - 1.4,
      badge: "SECRET",
      title: "Ember Wyrm Lair (CR 17)",
      body: "Hidden lava tube behind the eastern caldera rim.",
      colorHex: "#F43F5E",
    },
  ];

  // Cartographic Labels & Ornamental Scroll Title Banner
  world.labels = [
    {
      id: "wlbl-title",
      text: "The Shattered Reach",
      x: 24.0,
      y: 2.35,
      category: "banner",
      fontFamily: theme.fontFamilyDisplay,
      fontSizePx: 22,
      colorHex: theme.labelColorHex,
      outlineColorHex: theme.labelOutlineHex,
      outlineWidth: 0,
      letterSpacing: 3.5,
      italic: false,
      bold: true,
      uppercase: true,
      rotationDeg: 0,
      curveBend: 0,
      boxStyle: "scroll",
      opacity: 0.98,
    },
    {
      id: "wlbl-eldermere",
      text: "ELDERMERE",
      x: 13.8,
      y: 12.6,
      category: "continent",
      fontFamily: theme.fontFamilyDisplay,
      fontSizePx: 20,
      colorHex: theme.labelColorHex,
      outlineColorHex: theme.labelOutlineHex,
      outlineWidth: 2.6,
      letterSpacing: 5.5,
      italic: false,
      bold: true,
      uppercase: true,
      rotationDeg: -4,
      curveBend: 0.24,
      boxStyle: "none",
      opacity: 0.9,
    },
    {
      id: "wlbl-sunscar",
      text: "SUNSCAR EXPANSE",
      x: 35.2,
      y: 13.5,
      category: "continent",
      fontFamily: theme.fontFamilyDisplay,
      fontSizePx: 19,
      colorHex: theme.labelColorHex,
      outlineColorHex: theme.labelOutlineHex,
      outlineWidth: 2.6,
      letterSpacing: 4.2,
      italic: false,
      bold: true,
      uppercase: true,
      rotationDeg: 4,
      curveBend: -0.2,
      boxStyle: "none",
      opacity: 0.9,
    },
    {
      id: "wlbl-sea",
      text: "THE SHATTERED SEA",
      x: 24.4,
      y: 17.5,
      category: "ocean",
      fontFamily: theme.fontFamilyBody,
      fontSizePx: 15,
      colorHex: "#31484E",
      outlineColorHex: "#D6E2DF",
      outlineWidth: 2.0,
      letterSpacing: 4.5,
      italic: true,
      bold: false,
      uppercase: true,
      rotationDeg: -6,
      curveBend: 0.3,
      boxStyle: "none",
      opacity: 0.85,
    },
    {
      id: "wlbl-capital",
      text: "Aurelia Crown",
      x: capitalPos.x,
      y: capitalPos.y + 1.55,
      category: "city",
      fontFamily: theme.fontFamilyBody,
      fontSizePx: 12,
      colorHex: theme.labelColorHex,
      outlineColorHex: theme.labelOutlineHex,
      outlineWidth: 2.2,
      letterSpacing: 0.8,
      italic: false,
      bold: true,
      uppercase: false,
      rotationDeg: 0,
      curveBend: 0,
      boxStyle: "none",
      opacity: 0.95,
    },
    {
      id: "wlbl-dwarven",
      text: "Khaz-Vorn Gate",
      x: dwarvenPos.x,
      y: dwarvenPos.y - 1.35,
      category: "city",
      fontFamily: theme.fontFamilyBody,
      fontSizePx: 11,
      colorHex: theme.labelColorHex,
      outlineColorHex: theme.labelOutlineHex,
      outlineWidth: 2.0,
      letterSpacing: 0.6,
      italic: false,
      bold: true,
      uppercase: false,
      rotationDeg: 0,
      curveBend: 0,
      boxStyle: "none",
      opacity: 0.92,
    },
    {
      id: "wlbl-elven",
      text: "Sylvanhold",
      x: elvenPos.x,
      y: elvenPos.y + 1.45,
      category: "city",
      fontFamily: theme.fontFamilyBody,
      fontSizePx: 11,
      colorHex: theme.labelColorHex,
      outlineColorHex: theme.labelOutlineHex,
      outlineWidth: 2.0,
      letterSpacing: 0.8,
      italic: true,
      bold: true,
      uppercase: false,
      rotationDeg: 0,
      curveBend: 0,
      boxStyle: "none",
      opacity: 0.92,
    },
    {
      id: "wlbl-oasis",
      text: "Oasira",
      x: oasisPos.x,
      y: oasisPos.y + 1.5,
      category: "city",
      fontFamily: theme.fontFamilyBody,
      fontSizePx: 12,
      colorHex: theme.labelColorHex,
      outlineColorHex: theme.labelOutlineHex,
      outlineWidth: 2.2,
      letterSpacing: 0.8,
      italic: false,
      bold: true,
      uppercase: false,
      rotationDeg: 0,
      curveBend: 0,
      boxStyle: "none",
      opacity: 0.95,
    },
    {
      id: "wlbl-pirate",
      text: "Corsair's Roost",
      x: pirateFortPos.x,
      y: pirateFortPos.y + 1.45,
      category: "city",
      fontFamily: theme.fontFamilyBody,
      fontSizePx: 11,
      colorHex: theme.labelColorHex,
      outlineColorHex: theme.labelOutlineHex,
      outlineWidth: 2.0,
      letterSpacing: 0.6,
      italic: true,
      bold: true,
      uppercase: false,
      rotationDeg: 0,
      curveBend: 0,
      boxStyle: "none",
      opacity: 0.92,
    },
    {
      id: "wlbl-dm-secret",
      text: "Sunken Titan Vault",
      x: 24.4,
      y: 12.2,
      category: "region",
      fontFamily: theme.fontFamilyBody,
      fontSizePx: 11,
      colorHex: "#B91C1C",
      outlineColorHex: "#FEF2F2",
      outlineWidth: 2.2,
      letterSpacing: 1.0,
      italic: true,
      bold: true,
      uppercase: false,
      rotationDeg: 0,
      curveBend: 0,
      boxStyle: "none",
      opacity: 0.95,
      dmOnly: true,
    },
  ];

  // Pre-placed clickable Sub-Map Pin connecting the harbor to Battlemap level
  world.subMapPins = [
    {
      id: "wpin-harbor-battle",
      label: "Smuggler's Cove (Battlemap)",
      x: harborPos.x + 0.6,
      y: harborPos.y - 1.35,
      targetKind: "battlemap",
      colorHex: "#E5A93C",
    },
  ];

  return doc;
}

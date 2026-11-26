import { describe, expect, it } from "vitest";
import { computeRoofGeometry } from "./roofEngine";
import { computeWaterOutline } from "./waterEngine";
import {
  buildMeanderingRiverGeometry,
  hitTestWorldRegion,
  hitTestWorldRiver,
  hitTestWorldTrail,
} from "./worldEngine";
import { distanceToWall, sampleWallPoints } from "./geometry";
import { useDocumentStore, type SelectionRef } from "@/store/documentStore";
import type {
  RoofStructure,
  SplinePath,
  WaterRegion,
  WorldRegion,
  WorldRiver,
  WorldTrail,
} from "@/types/map";

describe("Unified Per-Segment Curves Across All 6 Non-Wall Engines", () => {
  it("SplinePath: samples & hit-tests mixed Straight + Curved sections accurately", () => {
    const path: SplinePath = {
      id: "path-mixed",
      assetId: "paths/magirail_funicular_track.png",
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 6 },
      ],
      widthCells: 1.0,
      curved: false,
      segmentCurves: [null, 2.0],
      taperEnds: false,
      fadeEnds: false,
      opacity: 1,
      blocksScatter: true,
    };
    const sampled = sampleWallPoints(
      { points: path.points, closed: false, curved: false, segmentCurves: path.segmentCurves },
      12,
    );
    expect(sampled[0]).toEqual({ x: 0, y: 0 });
    expect(sampled[1]).toEqual({ x: 6, y: 0 });
    const seg1MinX = Math.min(...sampled.slice(1).map((p) => p.x));
    expect(seg1MinX).toBeCloseTo(4.0, 2);

    const apexHit = distanceToWall(
      { x: 4.0, y: 3.0 },
      { points: path.points, closed: false, curved: false, segmentCurves: path.segmentCurves },
    );
    expect(apexHit.dist).toBeLessThan(0.05);
    expect(apexHit.segmentIndex).toBe(1);
  });

  it("RoofStructure: computes mixed straight + bowed ridge geometry cleanly", () => {
    const roof: RoofStructure = {
      id: "roof-mixed",
      style: "gable",
      assetId: "roofs/roof_slate_tiles.png",
      points: [
        { x: 2, y: 2 },
        { x: 10, y: 2 },
        { x: 10, y: 10 },
      ],
      widthCells: 4.0,
      curved: false,
      segmentCurves: [null, -2.5],
      sunAngleDeg: 315,
      slopeShade: 0.65,
      ridgeCapStyle: "matching",
      eaveTrim: true,
      dropShadow: 0.4,
      textureScale: 1.0,
      opacity: 1,
    };
    const geom = computeRoofGeometry(roof);
    expect(geom.spine.length).toBeGreaterThan(8);
    expect(geom.footprint.length).toBeGreaterThan(6);
    const maxSpineX = Math.max(...geom.spine.map((p) => p.x));
    expect(maxSpineX).toBeCloseTo(12.5, 1);
  });

  it("WaterRegion: bows a single shore of a rectangular canal/basin while keeping other 3 edges straight", () => {
    const basin: WaterRegion = {
      id: "water-bay",
      kind: "water",
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 6 },
        { x: 0, y: 6 },
      ],
      curved: false,
      segmentCurves: [2.0, null, null, null],
      deepColorHex: "#0B3B5E",
      rimColorHex: "#38BDF8",
      opacity: 0.9,
      organicRoughness: 0,
    };
    const { outer: outline } = computeWaterOutline(basin);
    const maxY = Math.max(...outline.map((p) => p.y));
    expect(maxY).toBeCloseTo(6.0, 2);
    const nearApex = outline.some((p) => Math.abs(p.x - 4) < 0.4 && Math.abs(p.y - 2) < 0.2);
    expect(nearApex).toBe(true);

    const river: WaterRegion = {
      id: "water-riv",
      kind: "water",
      shape: "river",
      widthCells: 2.0,
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 12, y: 0 },
      ],
      curved: false,
      segmentCurves: [null, 2.0],
      deepColorHex: "#0B3B5E",
      rimColorHex: "#38BDF8",
      opacity: 0.9,
      organicRoughness: 0,
    };
    const { outer: rivOutline } = computeWaterOutline(river);
    expect(rivOutline.length).toBeGreaterThan(12);
    const maxRivY = Math.max(...rivOutline.map((p) => p.y));
    expect(maxRivY).toBeGreaterThan(2.5);
  });

  it("WorldRiver, WorldTrail & WorldRegion honor per-segment curves in geometry and hit-testing", () => {
    const river: WorldRiver = {
      id: "wr-1",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      startWidthCells: 0.2,
      endWidthCells: 0.6,
      meanderRoughness: 0,
      meanderScale: 1,
      curved: false,
      segmentCurves: [3.0],
      seed: 42,
    };
    const rGeom = buildMeanderingRiverGeometry(river);
    expect(Math.max(...rGeom.centerline.map((p) => p.y))).toBeCloseTo(3.0, 1);
    expect(hitTestWorldRiver({ x: 5.0, y: 3.0 }, [river])?.id).toBe("wr-1");

    const trail: WorldTrail = {
      id: "wt-1",
      points: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 16, y: 0 },
      ],
      style: "double_road",
      widthCells: 0.2,
      colorHex: "#7A5230",
      dashScale: 1,
      curved: false,
      segmentCurves: [null, 2.5],
      opacity: 1,
    };
    expect(hitTestWorldTrail({ x: 4.0, y: 0.0 }, [trail])?.id).toBe("wt-1");
    expect(hitTestWorldTrail({ x: 12.0, y: 2.5 }, [trail])?.id).toBe("wt-1");

    const region: WorldRegion = {
      id: "wreg-1",
      name: "Arc Bay Duchy",
      polygon: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      curved: false,
      segmentCurves: [-3.0, null, null, null],
      fillColorHex: "#3B82F6",
      fillOpacity: 0.25,
      borderColorHex: "#1D4ED8",
      borderWidth: 2,
      borderStyle: "solid",
      clipToLand: false,
    };
    expect(hitTestWorldRegion({ x: 5, y: -2.2 }, [region])?.id).toBe("wreg-1");
  });

  it("Unified documentStore actions (set / toggle / flip / flatten) work across Path, Roof, Water, and World shapes", () => {
    const st = useDocumentStore.getState();

    // 1. SplinePath
    st.addPath({
      id: "store-path-1",
      assetId: "paths/magirail_funicular_track.png",
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 12, y: 0 },
      ],
      widthCells: 1,
      curved: false,
      taperEnds: false,
      fadeEnds: false,
      opacity: 1,
      blocksScatter: true,
    });
    let doc = useDocumentStore.getState().getActiveDoc();
    const pathLayer = doc.layers.find((l) => l.paths?.some((x) => x.id === "store-path-1"))!;
    const pathSel: SelectionRef = { kind: "path", layerId: pathLayer.id, id: "store-path-1" };
    const curvedOn = st.toggleEntitySegmentCurve(pathSel, 1, "90");
    expect(curvedOn).toBe(true);
    doc = useDocumentStore.getState().getActiveDoc();
    let p = doc.layers.find((l) => l.id === pathSel.layerId)!.paths!.find((x) => x.id === pathSel.id)!;
    expect(p.segmentCurves?.[0]).toBeNull();
    expect(Math.abs(p.segmentCurves?.[1] ?? 0)).toBeGreaterThan(1.0);
    const beforeFlip = p.segmentCurves![1]!;
    st.flipEntitySegmentCurve(pathSel, 1);
    doc = useDocumentStore.getState().getActiveDoc();
    p = doc.layers.find((l) => l.id === pathSel.layerId)!.paths!.find((x) => x.id === pathSel.id)!;
    expect(p.segmentCurves![1]).toBeCloseTo(-beforeFlip, 4);
    st.flattenEntityCurves(pathSel);
    doc = useDocumentStore.getState().getActiveDoc();
    p = doc.layers.find((l) => l.id === pathSel.layerId)!.paths!.find((x) => x.id === pathSel.id)!;
    expect(p.curved).toBe(false);
    expect(p.segmentCurves).toBeUndefined();

    // 2. RoofStructure (non-cone)
    st.addRoof({
      id: "store-roof-1",
      style: "gable",
      assetId: "roofs/roof_slate_tiles.png",
      points: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 8 },
      ],
      widthCells: 3,
      curved: false,
      sunAngleDeg: 315,
      slopeShade: 0.6,
      ridgeCapStyle: "matching",
      eaveTrim: true,
      dropShadow: 0.4,
      textureScale: 1,
      opacity: 1,
    });
    doc = useDocumentStore.getState().getActiveDoc();
    const roofLayer = doc.layers.find((l) => l.roofs?.some((x) => x.id === "store-roof-1"))!;
    const roofSel: SelectionRef = { kind: "roof", layerId: roofLayer.id, id: "store-roof-1" };
    st.setEntitySegmentCurve(roofSel, 0, 1.5, true);
    doc = useDocumentStore.getState().getActiveDoc();
    const rf = doc.layers.find((l) => l.id === roofSel.layerId)!.roofs!.find((x) => x.id === roofSel.id)!;
    expect(rf.segmentCurves).toEqual([1.5, null]);

    // 3. WaterRegion (closed lake polygon)
    st.addWaterRegion({
      id: "store-water-1",
      kind: "water",
      shape: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 6 },
        { x: 0, y: 6 },
      ],
      curved: false,
      deepColorHex: "#0B3B5E",
      rimColorHex: "#38BDF8",
      opacity: 0.9,
    });
    doc = useDocumentStore.getState().getActiveDoc();
    const waterLayer = doc.layers.find((l) => l.waterRegions?.some((x) => x.id === "store-water-1"))!;
    const waterSel: SelectionRef = { kind: "water", layerId: waterLayer.id, id: "store-water-1" };
    expect(st.toggleEntitySegmentCurve(waterSel, 2, "180")).toBe(true);
    doc = useDocumentStore.getState().getActiveDoc();
    const wr = doc.layers.find((l) => l.id === waterSel.layerId)!.waterRegions!.find((x) => x.id === waterSel.id)!;
    expect(Math.abs(wr.segmentCurves?.[2] ?? 0)).toBeCloseTo(3.0, 2);

    // 4. World River, Trail, Region (switch to World Atlas mode)
    st.switchToWorldMode();
    st.addWorldRiver({
      id: "store-wriv-1",
      points: [
        { x: 5, y: 5 },
        { x: 15, y: 5 },
      ],
      startWidthCells: 0.15,
      endWidthCells: 0.5,
      meanderRoughness: 0.2,
      meanderScale: 1,
      curved: false,
      seed: 11,
    });
    const wrivSel: SelectionRef = { kind: "world_river", layerId: "__world__", id: "store-wriv-1" };
    expect(st.toggleEntitySegmentCurve(wrivSel, 0, "90")).toBe(true);
    expect(
      useDocumentStore.getState().getActiveDoc().world!.rivers.find((x) => x.id === "store-wriv-1")!.segmentCurves?.[0],
    ).toBeTruthy();

    st.addWorldTrail({
      id: "store-wtrl-1",
      points: [
        { x: 4, y: 10 },
        { x: 12, y: 10 },
        { x: 20, y: 10 },
      ],
      style: "double_road",
      widthCells: 0.2,
      colorHex: "#7A5230",
      dashScale: 1,
      curved: false,
      opacity: 1,
    });
    const wtrlSel: SelectionRef = { kind: "world_trail", layerId: "__world__", id: "store-wtrl-1" };
    st.setEntitySegmentCurve(wtrlSel, 1, -2.0, true);
    expect(
      useDocumentStore.getState().getActiveDoc().world!.trails.find((x) => x.id === "store-wtrl-1")!.segmentCurves,
    ).toEqual([null, -2.0]);

    st.addWorldRegion({
      id: "store-wreg-1",
      name: "Curved March",
      polygon: [
        { x: 2, y: 2 },
        { x: 10, y: 2 },
        { x: 10, y: 8 },
        { x: 2, y: 8 },
      ],
      curved: false,
      fillColorHex: "#3B82F6",
      fillOpacity: 0.25,
      borderColorHex: "#1D4ED8",
      borderWidth: 2,
      borderStyle: "solid",
      clipToLand: false,
    });
    const wregSel: SelectionRef = { kind: "world_region", layerId: "__world__", id: "store-wreg-1" };
    expect(st.toggleEntitySegmentCurve(wregSel, 0, "90")).toBe(true);
    expect(
      useDocumentStore.getState().getActiveDoc().world!.regions.find((x) => x.id === "store-wreg-1")!.segmentCurves?.[0],
    ).toBeTruthy();
  });
});

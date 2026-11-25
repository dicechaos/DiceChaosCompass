import { describe, expect, it } from "vitest";
import { createHiddenSloopMap } from "@/data/hiddenSloopMap";
import { describeSelection } from "@/engine/selectionInfo";
import type { VaultAsset } from "@/types/map";

describe("describeSelection", () => {
  it("resolves human-readable type, name, floor, and thumbnail for props, paths, portals, and water", () => {
    const doc = createHiddenSloopMap();
    const lookup = new Map<string, VaultAsset>([
      [
        "modular-suite/props/ship_boats_oars/boat_wooden_rowboat_dinghy.png",
        {
          id: "modular-suite/props/ship_boats_oars/boat_wooden_rowboat_dinghy.png",
          sourceId: "src-mod",
          sourceName: "Modular Suite",
          sourceKind: "dcpack",
          internalPath: "props/ship_boats_oars/boat_wooden_rowboat_dinghy.png",
          url: "/assets/modular-suite-cc0/props/ship_boats_oars/boat_wooden_rowboat_dinghy.png",
          thumbUrl: "/assets/modular-suite-cc0/props/ship_boats_oars/boat_wooden_rowboat_dinghy.png",
          displayName: "Wooden Rowboat Dinghy",
          category: "object",
          widthPx: 256,
          heightPx: 256,
          defaultPpi: 256,
          drawMode: "normal",
          dominantHex: "#8B5A2B",
          castsShadow: true,
          isFavorite: false,
          tags: ["boat"],
        },
      ],
    ]);

    const propInfo = describeSelection(
      doc,
      { kind: "object", layerId: "hs-layer-objects", id: "hs-beach-dinghy" },
      lookup,
    );
    expect(propInfo?.typeLabel).toBe("Prop");
    expect(propInfo?.name).toBe("Wooden Rowboat Dinghy");
    expect(propInfo?.floorCode).toBe("1F");
    expect(propInfo?.thumbUrl).toContain("boat_wooden_rowboat_dinghy.png");

    // Fallback humanization for an asset not in lookup
    const pathInfo = describeSelection(
      doc,
      { kind: "path", layerId: "hs-layer-paths", id: "hs-path-bow-anchor-chain" },
      lookup,
    );
    expect(pathInfo?.typeLabel).toBe("Path / Line");
    expect(pathInfo?.name).toBe("Anchor Chain Path");

    const doorInfo = describeSelection(
      doc,
      { kind: "portal", layerId: "hs-layer-walls", id: "hs-p-salon-aft-door" },
      lookup,
    );
    expect(doorInfo?.typeLabel).toBe("Door");
    expect(doorInfo?.subtitle).toContain("Open");

    const waterInfo = describeSelection(
      doc,
      { kind: "water", layerId: "hs-layer-lake-water", id: "hs-water-tarn-main" },
      lookup,
    );
    expect(waterInfo?.typeLabel).toBe("Water Body");
    expect(waterInfo?.name).toBe("Alpine Mirrorlake");
    expect(waterInfo?.subtitle).toContain("2 islands");
  });
});

import { describe, expect, it } from "vitest";
import {
  classifyWonderdraftWorldGroup,
  importWonderdraftZipBytes,
  mapWonderdraftDrawMode,
  parseWonderdraftSymbolsJson,
} from "@/engine/wonderdraftImport";
import { buildZipBytes } from "@/engine/zipArchive";

/** Minimal valid PNG header (24+ bytes) declaring exact width & height in IHDR. */
function makeFakePng(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(80);
  // PNG signature
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // IHDR chunk length (13) + type "IHDR"
  buf.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8);
  const view = new DataView(buf.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return buf;
}

describe("wonderdraftImport", () => {
  it("parses per-sprite and folder-wide .wonderdraft_symbols metadata accurately", () => {
    const perSprite = parseWonderdraftSymbolsJson(
      JSON.stringify({
        dw_arch: {
          name: "Dwarven Archway",
          radius: 55,
          offset_x: 0,
          offset_y: -70,
          draw_mode: "custom_colors_2",
        },
      }),
    );
    expect(perSprite.perSymbol.get("dw_arch")?.name).toBe("Dwarven Archway");
    expect(perSprite.perSymbol.get("dw_arch")?.offset_y).toBe(-70);
    expect(mapWonderdraftDrawMode(perSprite.perSymbol.get("dw_arch")?.draw_mode, "dw_arch.png")).toBe(
      "rgb_channels",
    );

    const folderWide = parseWonderdraftSymbolsJson(
      JSON.stringify({
        name: "Alpine Pines",
        radius: 42,
        offset_x: 0,
        offset_y: -34,
        draw_mode: "sample_color",
      }),
    );
    expect(folderWide.folderDefault?.draw_mode).toBe("sample_color");
    expect(mapWonderdraftDrawMode(folderWide.folderDefault?.draw_mode, "pine_01.png")).toBe(
      "sample_color",
    );
  });

  it("classifies Wonderdraft asset paths into the right World groups", () => {
    expect(classifyWonderdraftWorldGroup("sprites/mountains/alpine_peak.png")).toBe("mountains");
    expect(classifyWonderdraftWorldGroup("sprites/trees/oak_cluster.png")).toBe("trees");
    expect(classifyWonderdraftWorldGroup("sprites/symbols/castle_keep.png")).toBe("settlements");
    expect(classifyWonderdraftWorldGroup("sprites/symbols/galleon_ship.png")).toBe("maritime");
    expect(classifyWonderdraftWorldGroup("sprites/symbols/compass_rose.png")).toBe("cartography");
  });

  it("imports a Wonderdraft .zip archive end-to-end with draw modes, anchors & image sizes", async () => {
    const manifestJson = JSON.stringify({
      elven_keep: {
        name: "Elven Spire Keep",
        offset_x: 2,
        offset_y: -64,
        draw_mode: "custom_colors_2",
      },
    });
    const treeManifest = JSON.stringify({
      name: "Emerald Pines",
      offset_x: 0,
      offset_y: -28,
      draw_mode: "sample_color",
    });

    const zipBytes = await buildZipBytes([
      {
        path: "sprites/symbols/buildings/.wonderdraft_symbols",
        data: new TextEncoder().encode(manifestJson),
      },
      {
        path: "sprites/symbols/buildings/elven_keep.png",
        data: makeFakePng(240, 260),
      },
      {
        path: "sprites/trees/pines/.wonderdraft_symbols",
        data: new TextEncoder().encode(treeManifest),
      },
      {
        path: "sprites/trees/pines/pine_cluster_01.png",
        data: makeFakePng(128, 144),
      },
    ]);

    const res = await importWonderdraftZipBytes("My_Wonderdraft_Pack.zip", zipBytes);
    expect(res.source.kind).toBe("wonderdraft");
    expect(res.source.assetCount).toBe(2);
    expect(res.assets.length).toBe(2);

    const keep = res.assets.find((a) => a.internalPath.includes("elven_keep"));
    expect(keep).toBeDefined();
    expect(keep!.displayName).toBe("Elven Spire Keep");
    expect(keep!.drawMode).toBe("rgb_channels");
    expect(keep!.worldGroup).toBe("settlements");
    expect(keep!.anchorOffsetX).toBe(2);
    expect(keep!.anchorOffsetY).toBe(-64);
    expect(keep!.widthPx).toBe(240);
    expect(keep!.heightPx).toBe(260);

    const pine = res.assets.find((a) => a.internalPath.includes("pine_cluster_01"));
    expect(pine).toBeDefined();
    expect(pine!.drawMode).toBe("sample_color");
    expect(pine!.worldGroup).toBe("trees");
    expect(pine!.anchorOffsetY).toBe(-28);
  });
});

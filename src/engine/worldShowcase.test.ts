import { describe, expect, it } from "vitest";
import worldAtlasManifest from "../../public/assets/world-atlas-cc0/manifest.json";
import { createTrofraderraWorldMap } from "@/data/trofraderraWorldMap";
import { createWorldShowcaseMap } from "@/data/worldShowcaseMap";
import { describeSelection } from "@/engine/selectionInfo";
import { WORLD_THEMES } from "@/engine/worldThemes";
import { useDocumentStore } from "@/store/documentStore";

describe("World Atlas Studio integration", () => {
  it("builds The Shattered Reach showcase atlas with all cartography layers populated", () => {
    const doc = createWorldShowcaseMap();
    expect(doc.mode).toBe("world");
    expect(doc.world).toBeDefined();
    expect(doc.world!.rivers.length).toBeGreaterThanOrEqual(2);
    expect(doc.world!.trails.length).toBeGreaterThanOrEqual(3);
    expect(doc.world!.regions.length).toBeGreaterThanOrEqual(2);
    expect(doc.world!.labels.length).toBeGreaterThanOrEqual(8);
    expect(doc.world!.subMapPins.length).toBeGreaterThanOrEqual(1);
    expect(doc.layers[0].objects!.length).toBeGreaterThanOrEqual(15);
    expect(doc.layers[1].objects!.length).toBeGreaterThanOrEqual(5);
  });

  it("describes all World selection kinds cleanly for the unified Identity Card", () => {
    const doc = createWorldShowcaseMap();
    const w = doc.world!;
    const emptyLookup = new Map();

    const lblDesc = describeSelection(
      doc,
      { kind: "world_label", layerId: "__world__", id: w.labels[0].id },
      emptyLookup,
    );
    expect(lblDesc?.typeLabel).toContain("Map Label");
    expect(lblDesc?.name).toBe(w.labels[0].text);

    const rivDesc = describeSelection(
      doc,
      { kind: "world_river", layerId: "__world__", id: w.rivers[0].id },
      emptyLookup,
    );
    expect(rivDesc?.typeLabel).toBe("Meandering River");

    const trlDesc = describeSelection(
      doc,
      { kind: "world_trail", layerId: "__world__", id: w.trails[0].id },
      emptyLookup,
    );
    expect(trlDesc?.typeLabel).toBe("Overland Trail");

    const regDesc = describeSelection(
      doc,
      { kind: "world_region", layerId: "__world__", id: w.regions[0].id },
      emptyLookup,
    );
    expect(regDesc?.typeLabel).toBe("Political Region");

    const pinDesc = describeSelection(
      doc,
      { kind: "world_pin", layerId: "__world__", id: w.subMapPins[0].id },
      emptyLookup,
    );
    expect(pinDesc?.typeLabel).toBe("Linked Battlemap");
  });

  it("switches to World Mode, swaps themes, sculpts with undo, and spawns a Regional Detail Atlas", () => {
    const st = useDocumentStore.getState();
    st.openShowcaseWorld();
    const worldDoc = useDocumentStore.getState().getActiveDoc();
    expect(worldDoc.mode).toBe("world");
    expect(worldDoc.world?.themeId).toBe("parchment");

    // Apply Obsidian Night theme (9 built-in themes including Weathered Antique Atlas)
    expect(WORLD_THEMES.length).toBe(9);
    useDocumentStore.getState().applyWorldTheme("obsidian_night");
    expect(useDocumentStore.getState().getActiveDoc().world?.themeId).toBe("obsidian_night");

    // Undo restores Parchment
    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().getActiveDoc().world?.themeId).toBe("parchment");

    // Spawn Regional Detail Atlas from a crop box
    const detailId = useDocumentStore
      .getState()
      .createDetailWorldMap({ x0: 10, y0: 8, x1: 22, y1: 18 }, "Northern Eldermere");
    expect(detailId).toBeTruthy();
    expect(useDocumentStore.getState().getActiveDoc().id).toBe(detailId);
    expect(useDocumentStore.getState().getActiveDoc().meta.title).toContain("Northern Eldermere");

    // Switch back to Battlemap cleanly
    useDocumentStore.getState().switchToBattlemapMode();
    expect(useDocumentStore.getState().getActiveDoc().mode).toBe("battlemap");
  });

  it("builds Tro'fraderra high-res 480x330 atlas with stippled plains, mouth-fading rivers, multiply ink, 85+ towns & stepped frame", () => {
    const doc = createTrofraderraWorldMap();
    expect(doc.mode).toBe("world");
    expect(doc.meta.title).toBe("Tro'fraderra");
    expect(doc.canvas.widthCells).toBe(48);
    expect(doc.canvas.heightCells).toBe(33);
    const w = doc.world!;
    expect(w.gridW).toBe(480);
    expect(w.gridH).toBe(330);
    expect(w.themeId).toBe("aged_antique");
    expect(w.overlays.frame.style).toBe("stepped_ivory");
    expect(w.overlays.legend?.visible).toBe(true);
    expect(w.overlays.legend?.entries.length).toBe(3);
    // Land washes, ocean washes, and antique ink stipple regions all present
    expect(w.biomeStrokes.some((s) => s.target === "ocean")).toBe(true);
    expect(w.biomeStrokes.some((s) => s.target === "land")).toBe(true);
    expect(w.biomeStrokes.some((s) => s.pattern === "stipple")).toBe(true);
    // Slim mouth-fading rivers, dense kingdom roads, and miniature hierarchical labels
    expect(w.rivers.length).toBeGreaterThanOrEqual(15);
    expect(w.rivers.every((r) => r.fadeMouth !== false)).toBe(true);
    expect(w.trails.length).toBeGreaterThanOrEqual(25);
    expect(w.labels.some((l) => l.text.includes("\n"))).toBe(true);
    expect(w.labels.length).toBeGreaterThanOrEqual(80);
    // Dedicated multiply layer for copperplate engraved sea beasts + dense symbols across layers
    const inkLayer = doc.layers.find((l) => l.blendMode === "multiply");
    expect(inkLayer).toBeDefined();
    expect(inkLayer!.objects!.length).toBeGreaterThanOrEqual(3);
    const totalSymbols = doc.layers.reduce((sum, l) => sum + (l.objects?.length ?? 0), 0);
    expect(totalSymbols).toBeGreaterThanOrEqual(350);
    // Every symbol assetId placed on Tro'fraderra must resolve cleanly in the World Atlas CC0 manifest!
    const validIds = new Set(worldAtlasManifest.assets.map((a) => `world-atlas/${a.path}`));
    const missingIds = new Set<string>();
    for (const layer of doc.layers) {
      for (const obj of layer.objects ?? []) {
        if (!validIds.has(obj.assetId)) missingIds.add(obj.assetId);
      }
    }
    expect(Array.from(missingIds)).toEqual([]);
  });
});

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { hasWallSegmentCurves } from "@/engine/geometry";
import { getOnionSkinDirection, getOnionSkinReferenceLevel } from "@/engine/layerMeta";
import { describeSelection } from "@/engine/selectionInfo";
import { useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import {
  ContextMenu,
  type ContextMenuEntry,
  type ContextMenuState,
} from "@/ui/common/ContextMenu";
import { AssetVaultDrawer } from "@/ui/vault/AssetVaultDrawer";
import { LeftToolRail } from "@/ui/workspace/LeftToolRail";
import { MapCanvas } from "@/ui/workspace/MapCanvas";
import { RightInspectorDock } from "@/ui/workspace/RightInspectorDock";
import { TopHeaderBar } from "@/ui/workspace/TopHeaderBar";
import type { ToolId } from "@/types/map";

const LazyAssetVaultModal = lazy(() =>
  import("@/ui/vault/AssetVaultModal").then((m) => ({ default: m.AssetVaultModal })),
);
const LazyExportStudioModal = lazy(() =>
  import("@/ui/export/ExportStudioModal").then((m) => ({ default: m.ExportStudioModal })),
);
const LazyMapImportModal = lazy(() =>
  import("@/ui/modals/MapImportModal").then((m) => ({ default: m.MapImportModal })),
);
const LazyPreferencesModal = lazy(() =>
  import("@/ui/modals/PreferencesModal").then((m) => ({ default: m.PreferencesModal })),
);
const LazyShortcutsModal = lazy(() =>
  import("@/ui/modals/ShortcutsModal").then((m) => ({ default: m.ShortcutsModal })),
);

const TOOL_KEYS: Record<string, ToolId> = {
  v: "select",
  b: "terrain",
  h: "cave",
  w: "water",
  l: "wall",
  d: "portal",
  p: "path",
  o: "roof",
  s: "stamp",
  t: "template",
  z: "scatter",
  g: "light",
  n: "dm_note",
  m: "measure",
};

const WORLD_TOOL_KEYS: Record<string, ToolId> = {
  v: "select",
  b: "world_land",
  g: "world_biome",
  r: "world_river",
  p: "world_trail",
  k: "world_region",
  s: "stamp",
  t: "world_label",
  c: "world_crop",
  h: "world_theme",
  n: "dm_note",
  m: "measure",
};

const scheduleIdle = (fn: () => void) => {
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(fn, { timeout: 1500 });
  } else {
    window.setTimeout(fn, 0);
  }
};

const StudioAutosaveScheduler: React.FC = React.memo(() => {
  const activeDocDirty = useDocumentStore((s) => Boolean(s.dirtyDocIds[s.activeDocId]));
  const activeDocAutosave = useDocumentStore((s) => Boolean(s.autosaveEnabledByDocId[s.activeDocId]));
  const activeDocUpdatedAt = useDocumentStore(
    (s) => (s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0]).meta.updatedAt,
  );
  const autosaveMinutes = useDocumentStore((s) => s.preferences.autosaveMinutes);

  // 1) Once a map has been saved to a chosen location, automatically flush edits to disk ~2.5s after changes settle.
  useEffect(() => {
    if (!activeDocDirty || !activeDocAutosave) return;
    const timer = window.setTimeout(() => {
      scheduleIdle(() => {
        const st = useDocumentStore.getState();
        void st.autosaveBoundFiles();
        st.autosaveSession(true);
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [activeDocDirty, activeDocAutosave, activeDocUpdatedAt]);

  // 2) Periodic workspace backup & file autosave honoring Preferences -> Autosave Interval
  useEffect(() => {
    if (!autosaveMinutes || autosaveMinutes <= 0) return;
    const ms = Math.max(30_000, autosaveMinutes * 60_000);
    const id = window.setInterval(() => {
      scheduleIdle(() => {
        const st = useDocumentStore.getState();
        if (Object.values(st.dirtyDocIds).some(Boolean)) {
          void st.autosaveBoundFiles();
          st.autosaveSession(true);
        }
      });
    }, ms);
    return () => window.clearInterval(id);
  }, [autosaveMinutes]);

  return null;
});

const StudioStatusBar: React.FC = React.memo(() => {
  const assetById = useVaultStore((s) => s.assetById);
  const totalAssets = useVaultStore((s) => s.assets.length);
  const cursorGridPos = useDocumentStore((s) => s.cursorGridPos);
  const activeTool = useDocumentStore((s) => s.activeTool);
  const snapMode = useDocumentStore((s) => s.snapMode);
  const selection = useDocumentStore((s) => s.selection);
  const doc = useDocumentStore(
    (s) => s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0],
  );
  const selectedDetails = useMemo(
    () => describeSelection(doc, selection, assetById),
    [doc, selection, assetById],
  );
  const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId);

  return (
    <footer className="dc-statusbar">
      <div className="dc-status-group">
        <span>
          GRID:{" "}
          {cursorGridPos
            ? `${cursorGridPos.x.toFixed(1)}, ${cursorGridPos.y.toFixed(1)} (${cursorGridPos.x.toFixed(1)}" × ${cursorGridPos.y.toFixed(1)}" TV)`
            : "—"}
        </span>
        <span>TOOL: {activeTool.toUpperCase()}</span>
        <span>SNAP: {snapMode.toUpperCase()}</span>
        <span
          style={{
            maxWidth: 240,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title={activeLayer?.name ?? "—"}
        >
          LAYER: {activeLayer?.name ?? "—"}
        </span>
        {selectedDetails && (
          <span
            style={{
              color: selectedDetails.accentHex,
              fontWeight: 600,
              maxWidth: 260,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`${selectedDetails.typeLabel}: ${selectedDetails.name}`}
          >
            SELECTED: {selectedDetails.typeLabel.toUpperCase()} · {selectedDetails.name}
          </span>
        )}
      </div>
      <div className="dc-status-group">
        <span>VAULT: {totalAssets} ASSETS INDEXED</span>
        <span style={{ color: "var(--accent-emerald)" }}>
          ● v1.0.0-beta.1 · OFFLINE LOCAL-FIRST · GPL-3.0
        </span>
      </div>
    </footer>
  );
});

const StudioToastStack: React.FC = React.memo(() => {
  const toasts = useDocumentStore((s) => s.toasts);
  return (
    <div className="dc-toast-stack" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`dc-toast ${t.tone}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
});

const StudioModalsHost: React.FC<{
  onOpenContextMenu: (
    x: number,
    y: number,
    ariaLabel: string,
    entries: ContextMenuEntry[],
  ) => void;
}> = React.memo(({ onOpenContextMenu }) => {
  const vaultOpen = useDocumentStore((s) => s.vaultExpandedModal);
  const exportOpen = useDocumentStore((s) => s.exportModalOpen);
  const importOpen = useDocumentStore((s) => s.mapImportModalOpen);
  const prefsOpen = useDocumentStore((s) => s.preferencesModalOpen);
  const shortcutsOpen = useDocumentStore((s) => s.shortcutsModalOpen);

  if (!vaultOpen && !exportOpen && !importOpen && !prefsOpen && !shortcutsOpen) return null;
  return (
    <Suspense fallback={null}>
      {vaultOpen && <LazyAssetVaultModal onOpenContextMenu={onOpenContextMenu} />}
      {exportOpen && <LazyExportStudioModal />}
      {importOpen && <LazyMapImportModal />}
      {prefsOpen && <LazyPreferencesModal />}
      {shortcutsOpen && <LazyShortcutsModal />}
    </Suspense>
  );
});

export const App: React.FC = () => {
  const initVault = useVaultStore((s) => s.initVault);

  const [menu, setMenu] = useState<ContextMenuState>({
    open: false,
    x: 0,
    y: 0,
    ariaLabel: "Context Menu",
    entries: [],
  });

  const openContextMenu = useCallback(
    (x: number, y: number, ariaLabel: string, entries: ContextMenuEntry[]) => {
      setMenu({ open: true, x, y, ariaLabel, entries });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setMenu((m) => (m.open ? { ...m, open: false } : m));
  }, []);

  useEffect(() => {
    initVault();
    useDocumentStore.getState().restoreAutosavedSession();
  }, [initVault]);

  // Global studio keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const isTextInput = Boolean(
        target &&
          (target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable ||
            (target.tagName === "INPUT" &&
              !["range", "checkbox", "radio", "color", "button", "submit"].includes(
                ((target as HTMLInputElement).type || "text").toLowerCase(),
              ))),
      );
      if (isTextInput) return;

      const st = useDocumentStore.getState();
      const lower = e.key.toLowerCase();

      if (e.ctrlKey || e.metaKey) {
        if (lower === "z" && !e.shiftKey) {
          e.preventDefault();
          st.undo();
          return;
        }
        if (lower === "y" || (lower === "z" && e.shiftKey)) {
          e.preventDefault();
          st.redo();
          return;
        }
        if (lower === "c") {
          e.preventDefault();
          st.copySelection();
          return;
        }
        if (lower === "v") {
          e.preventDefault();
          const activeDoc = st.getActiveDoc();
          const pt = st.cursorGridPos ?? {
            x: activeDoc.canvas.widthCells / 2,
            y: activeDoc.canvas.heightCells / 2,
          };
          st.pasteAt(pt.x, pt.y);
          return;
        }
        if (lower === "d") {
          e.preventDefault();
          st.duplicateSelection();
          return;
        }
        if (lower === "e") {
          e.preventDefault();
          st.setExportModalOpen(true);
          return;
        }
        if (e.key === ",") {
          e.preventDefault();
          st.setPreferencesModalOpen(true);
          return;
        }
        if (lower === "s") {
          e.preventDefault();
          void st.saveDocumentToFile(undefined, { saveAs: e.shiftKey });
          return;
        }
        return;
      }

      if (e.key === "Escape" && st.selection) {
        st.setSelection(null);
        return;
      }

      if (e.shiftKey && lower === "s") {
        e.preventDefault();
        st.toggleSnapEnabled();
        return;
      }
      if (e.shiftKey && lower === "g") {
        e.preventDefault();
        const next = !st.showOnionSkin;
        st.setShowOnionSkin(next);
        const curDoc = st.getActiveDoc();
        const activeLv = curDoc.levels.find((lv) => lv.id === curDoc.activeLevelId);
        const refLv = getOnionSkinReferenceLevel(curDoc);
        const dir = activeLv && refLv ? getOnionSkinDirection(activeLv, refLv) : null;
        st.pushToast(
          next
            ? refLv
              ? `Ghost Blueprint ON (${refLv.shortCode} ${dir === "up" ? "above" : "below"})`
              : "Ghost Blueprint ON"
            : "Ghost Blueprint OFF",
        );
        return;
      }
      if (e.shiftKey && lower === "i") {
        e.preventDefault();
        const next = !st.isolateActiveFloor;
        st.setIsolateActiveFloor(next);
        const curDoc = st.getActiveDoc();
        const activeLv = curDoc.levels.find((lv) => lv.id === curDoc.activeLevelId);
        st.pushToast(
          next
            ? `Solo Floor ON — Isolating ${activeLv?.shortCode ?? "active floor"}`
            : `Stack View ON — Showing lower floors beneath ${activeLv?.shortCode ?? "active floor"}`,
        );
        return;
      }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        st.stepActiveLayer(e.key === "ArrowUp" ? "up" : "down");
        return;
      }

      if (e.key === "F2") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("dc-rename-active-layer"));
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("dc-focus-vault-search"));
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        st.stepLevel("up");
        return;
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        st.stepLevel("down");
        return;
      }
      if (e.key === "?") {
        st.setShortcutsModalOpen(!st.shortcutsModalOpen);
        return;
      }
      if (lower === "f") {
        window.dispatchEvent(new CustomEvent("dc-fit-screen"));
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (st.selection) {
          e.preventDefault();
          st.deleteSelection();
        }
        return;
      }
      if (lower === "q") {
        if (st.selection?.kind === "object") st.transformSelectedObject("rotCCW");
        else if (
          st.activeTool === "wall" &&
          (st.wallDrawMode === "box" || st.wallDrawMode === "circle")
        ) {
          const nextDeg = (st.wallBoxRotationDeg + 345) % 360;
          st.setBrushParams({ wallBoxRotationDeg: nextDeg });
          st.pushToast(`Wall Angle: ${nextDeg}°`);
        } else if (st.activeTool === "roof" && st.roofDrawMode === "box") {
          st.setBrushParams({ roofRotateBoxRidge: !st.roofRotateBoxRidge });
          st.pushToast("Rotated Box Roof Ridge 90°");
        } else if (st.activeTool === "roof") {
          st.setBrushParams({ roofSunAngleDeg: (st.roofSunAngleDeg + 345) % 360 });
        } else if (st.activeTool === "template") {
          st.setTemplateTransform({ rotationRad: st.templateRotationRad - Math.PI / 12 });
        } else {
          st.setBrushParams({ stampRotationRad: st.stampRotationRad - Math.PI / 12 });
        }
        return;
      }
      if (lower === "e") {
        if (st.selection?.kind === "object") {
          st.transformSelectedObject("rotCW");
        } else if (
          st.activeTool === "wall" &&
          (st.wallDrawMode === "box" || st.wallDrawMode === "circle")
        ) {
          const nextDeg = (st.wallBoxRotationDeg + 15) % 360;
          st.setBrushParams({ wallBoxRotationDeg: nextDeg });
          st.pushToast(`Wall Angle: ${nextDeg}°`);
        } else if (st.activeTool === "roof" && st.roofDrawMode === "box") {
          st.setBrushParams({ roofRotateBoxRidge: !st.roofRotateBoxRidge });
          st.pushToast("Rotated Box Roof Ridge 90°");
        } else if (st.activeTool === "roof") {
          st.setBrushParams({ roofSunAngleDeg: (st.roofSunAngleDeg + 15) % 360 });
        } else if (st.activeTool === "cave") {
          const nextMode = st.caveDrawMode === "erase" ? "cave_brush" : "erase";
          st.setBrushParams({ caveDrawMode: nextMode });
        } else if (st.activeTool === "water") {
          const nextMode = st.waterDrawMode === "erase" ? "lake_brush" : "erase";
          st.setBrushParams({ waterDrawMode: nextMode });
        } else if (st.activeTool === "terrain") {
          const nextMode = st.terrainMode === "erase" ? "flood" : "erase";
          st.setBrushParams({ terrainMode: nextMode });
        } else if (st.activeTool === "template") {
          st.setTemplateTransform({ rotationRad: st.templateRotationRad + Math.PI / 12 });
        } else {
          st.setBrushParams({ stampRotationRad: st.stampRotationRad + Math.PI / 12 });
        }
        return;
      }
      if (lower === "c") {
        const sel = st.selection;
        if (
          sel &&
          (sel.kind === "wall" ||
            sel.kind === "path" ||
            sel.kind === "roof" ||
            sel.kind === "water" ||
            sel.kind === "world_river" ||
            sel.kind === "world_trail" ||
            sel.kind === "world_region")
        ) {
          const curDoc = st.getActiveDoc();
          const layer = curDoc.layers.find((l) => l.id === sel.layerId);
          let shape: { points: { x: number; y: number }[]; closed: boolean; curved: boolean; segmentCurves?: Array<number | null> } | null = null;
          let noun = "section";
          if (sel.kind === "wall") {
            const w = layer?.walls?.find((x) => x.id === sel.id);
            if (w) { shape = w; noun = "wall section"; }
          } else if (sel.kind === "path") {
            const p = layer?.paths?.find((x) => x.id === sel.id);
            if (p) { shape = { points: p.points, closed: false, curved: p.curved !== false, segmentCurves: p.segmentCurves }; noun = "line section"; }
          } else if (sel.kind === "roof") {
            const rf = layer?.roofs?.find((x) => x.id === sel.id);
            if (rf && rf.style !== "cone") { shape = { points: rf.points, closed: false, curved: Boolean(rf.curved), segmentCurves: rf.segmentCurves }; noun = "roof ridge"; }
          } else if (sel.kind === "water") {
            const wr = layer?.waterRegions?.find((x) => x.id === sel.id);
            if (wr) { shape = { points: wr.points, closed: wr.shape !== "river", curved: wr.curved ?? wr.kind !== "chasm", segmentCurves: wr.segmentCurves }; noun = wr.shape === "river" ? "channel section" : "shore section"; }
          } else if (sel.kind === "world_river") {
            const r = curDoc.world?.rivers.find((x) => x.id === sel.id);
            if (r) { shape = { points: r.points, closed: false, curved: r.curved, segmentCurves: r.segmentCurves }; noun = "river span"; }
          } else if (sel.kind === "world_trail") {
            const t = curDoc.world?.trails.find((x) => x.id === sel.id);
            if (t) { shape = { points: t.points, closed: false, curved: t.curved, segmentCurves: t.segmentCurves }; noun = "route segment"; }
          } else if (sel.kind === "world_region") {
            const reg = curDoc.world?.regions.find((x) => x.id === sel.id);
            if (reg) { shape = { points: reg.polygon, closed: true, curved: Boolean(reg.curved), segmentCurves: reg.segmentCurves }; noun = "realm border"; }
          }
          if (shape) {
            if (st.selectedWallSegmentIndex !== null) {
              const segIdx = st.selectedWallSegmentIndex;
              const nowCurved = st.toggleEntitySegmentCurve(sel, segIdx, "90");
              st.pushToast(
                nowCurved
                  ? `Curved ${noun} #${segIdx + 1} (90° arch)`
                  : `Straightened ${noun} #${segIdx + 1}`,
              );
            } else if (shape.curved || hasWallSegmentCurves(shape)) {
              st.flattenEntityCurves(sel);
              st.pushToast(`Straightened all ${noun}s`);
            } else {
              st.bendSelectedIntoCurve();
            }
          }
          return;
        }
        if (st.activeTool === "wall") {
          const nextCurved = !st.wallCurved;
          st.setBrushParams({ wallCurved: nextCurved });
          st.pushToast(
            st.wallDrawMode === "free"
              ? nextCurved
                ? "Next Wall Section: Curved Arc (click end, then pull bow)"
                : "Next Wall Section: Straight"
              : nextCurved
                ? "Wall Tool: Curved Walls"
                : "Wall Tool: Straight Walls",
          );
          return;
        }
        if (st.activeTool === "path") {
          const nextCurved = !st.pathCurved;
          st.setBrushParams({ pathCurved: nextCurved });
          st.pushToast(
            nextCurved
              ? "Next Line Section: Curved Arc (click end, then pull bow)"
              : "Next Line Section: Straight",
          );
          return;
        }
        if (st.activeTool === "roof") {
          st.setBrushParams({ roofCurved: !st.roofCurved });
          st.pushToast(st.roofCurved ? "Roof Ridge: Straight" : "Roof Ridge: Curved");
          return;
        }
        if (st.activeTool === "water") {
          st.setBrushParams({ waterCurved: !st.waterCurved });
          st.pushToast(st.waterCurved ? "Water Edges: Straight" : "Water Edges: Smooth");
          return;
        }
        if (st.activeTool === "world_river") {
          st.setBrushParams({ worldRiverCurved: !st.worldRiverCurved });
          st.pushToast(st.worldRiverCurved ? "World River: Straight" : "World River: Curved");
          return;
        }
        if (st.activeTool === "terrain" && st.terrainMode === "polygon") {
          const nextCurved = !st.terrainPolygonCurved;
          st.setBrushParams({ terrainPolygonCurved: nextCurved });
          st.pushToast(
            nextCurved
              ? "Next Polygon Edge: Curved Arc (click end, then pull bow)"
              : "Next Polygon Edge: Straight",
          );
          return;
        }
        if (st.activeTool === "world_trail") {
          st.setBrushParams({ worldTrailCurved: !st.worldTrailCurved });
          st.pushToast(st.worldTrailCurved ? "World Route: Straight" : "World Route: Curved");
          return;
        }
      }
      if (e.key === "[" || e.key === "]") {
        const dir = e.key === "]" ? 1 : -1;
        if (st.activeTool === "world_land") {
          st.setBrushParams({
            worldLandRadiusCells: Math.max(0.5, Math.min(8.5, Math.round((st.worldLandRadiusCells + dir * 0.35) * 100) / 100)),
          });
        } else if (st.activeTool === "world_biome") {
          st.setBrushParams({
            worldBiomeRadiusCells: Math.max(0.8, Math.min(10, Math.round((st.worldBiomeRadiusCells + dir * 0.4) * 100) / 100)),
          });
        } else if (st.activeTool === "terrain") {
          st.setBrushParams({ brushRadiusCells: Math.max(0.5, Math.min(8, st.brushRadiusCells + dir * 0.25)) });
        } else if (st.activeTool === "wall") {
          if (st.wallDrawMode === "split" && st.wallSplitSubMode === "breach") {
            st.setBrushParams({
              wallBreachWidthCells: Math.max(
                0.6,
                Math.min(6.0, Math.round((st.wallBreachWidthCells + dir * 0.25) * 100) / 100),
              ),
            });
          } else if (st.wallDrawMode === "corridor") {
            st.setBrushParams({
              wallCorridorWidthCells: Math.max(
                1.0,
                Math.min(6.0, Math.round((st.wallCorridorWidthCells + dir * 0.25) * 100) / 100),
              ),
            });
          } else {
            st.setBrushParams({
              wallThicknessCells: Math.max(
                0.16,
                Math.min(0.85, Math.round((st.wallThicknessCells + dir * 0.04) * 100) / 100),
              ),
            });
          }
        } else if (st.activeTool === "path") {
          st.setBrushParams({ pathWidthCells: Math.max(0.3, Math.min(4, Math.round((st.pathWidthCells + dir * 0.15) * 100) / 100)) });
        } else if (st.activeTool === "roof") {
          st.setBrushParams({ roofWidthCells: Math.max(1.5, Math.min(20, Math.round((st.roofWidthCells + dir * 0.5) * 10) / 10)) });
        } else if (st.selection?.kind === "roof") {
          const rf = st
            .getActiveDoc()
            .layers.find((l) => l.id === st.selection!.layerId)
            ?.roofs?.find((x) => x.id === st.selection!.id);
          if (rf && rf.style !== "cone") {
            const nextW = Math.max(1.5, Math.min(20, Math.round((rf.widthCells + dir * 0.5) * 10) / 10));
            st.updateRoof(st.selection.layerId, rf.id, { widthCells: nextW }, true);
          }
        } else if (st.activeTool === "portal") {
          st.setBrushParams({ activePortalWidthCells: Math.max(0.8, Math.min(3.5, Math.round((st.activePortalWidthCells + dir * 0.15) * 100) / 100)) });
        } else if (st.activeTool === "light") {
          st.setBrushParams({ activeLightRadiusCells: Math.max(2, Math.min(20, st.activeLightRadiusCells + dir * 0.5)) });
        } else if (st.activeTool === "cave") {
          if (st.caveDrawMode === "entrance") {
            st.setBrushParams({
              caveEntranceWidthCells: Math.max(
                1.0,
                Math.min(6.0, Math.round((st.caveEntranceWidthCells + dir * 0.25) * 100) / 100),
              ),
            });
          } else {
            st.setBrushParams({
              caveBrushRadiusCells: Math.max(
                0.75,
                Math.min(6.0, Math.round((st.caveBrushRadiusCells + dir * 0.25) * 100) / 100),
              ),
            });
          }
        } else if (st.activeTool === "water") {
          if (st.waterDrawMode === "river_path") {
            st.setBrushParams({
              waterRiverWidthCells: Math.max(
                0.75,
                Math.min(8.0, Math.round((st.waterRiverWidthCells + dir * 0.25) * 100) / 100),
              ),
            });
          } else {
            st.setBrushParams({
              waterBrushRadiusCells: Math.max(
                0.65,
                Math.min(6.0, Math.round((st.waterBrushRadiusCells + dir * 0.25) * 100) / 100),
              ),
            });
          }
        } else if (st.activeTool === "template") {
          st.setTemplateTransform({
            scale: Math.max(0.35, Math.min(3.0, Math.round((st.templateScale + dir * 0.1) * 100) / 100)),
          });
        } else {
          st.setBrushParams({ stampScale: Math.max(0.25, Math.min(4.0, Math.round((st.stampScale + dir * 0.1) * 100) / 100)) });
        }
        return;
      }
      if (st.activeTool === "world_land" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const landModes: Record<string, "raise" | "lower" | "smooth" | "lake_carve" | "lake_erase"> = {
          "1": "raise",
          "2": "lower",
          "3": "smooth",
          "4": "lake_carve",
          "5": "lake_erase",
        };
        if (landModes[e.key]) {
          st.setBrushParams({ worldLandMode: landModes[e.key] });
          return;
        }
      }
      if (st.activeTool === "wall" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const wallModes: Record<string, "free" | "box" | "circle" | "arc" | "split" | "corridor"> = {
          "1": "free",
          "2": "box",
          "3": "circle",
          "4": "arc",
          "5": "split",
          "6": "corridor",
        };
        if (wallModes[e.key]) {
          st.setBrushParams({ wallDrawMode: wallModes[e.key] });
          return;
        }
      }
      if (st.activeTool === "roof" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const roofModes: Record<string, "ridge_path" | "box" | "cone" | "auto_room"> = {
          "1": "ridge_path",
          "2": "box",
          "3": "cone",
          "4": "auto_room",
        };
        if (roofModes[e.key]) {
          st.setBrushParams({ roofDrawMode: roofModes[e.key] });
          return;
        }
      }
      if (st.activeTool === "water" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const waterModes: Record<string, "lake_brush" | "river_path" | "polygon" | "erase"> = {
          "1": "lake_brush",
          "2": "river_path",
          "3": "polygon",
          "4": "erase",
        };
        if (waterModes[e.key]) {
          st.setBrushParams({ waterDrawMode: waterModes[e.key] });
          return;
        }
      }
      if (st.activeTool === "terrain" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tModes: Record<string, "brush" | "flood" | "replace" | "rect" | "polygon" | "erase"> = {
          "1": "brush",
          "2": "flood",
          "3": "replace",
          "4": "rect",
          "5": "polygon",
          "6": "erase",
        };
        if (tModes[e.key]) {
          st.setBrushParams({ terrainMode: tModes[e.key] });
          return;
        }
      }
      if (st.activeTool === "cave" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const caveModes: Record<string, "cave_brush" | "dungeon_rect" | "polygon" | "erase" | "entrance"> = {
          "1": "cave_brush",
          "2": "dungeon_rect",
          "3": "polygon",
          "4": "erase",
          "5": "entrance",
        };
        if (caveModes[e.key]) {
          st.setBrushParams({ caveDrawMode: caveModes[e.key] });
          return;
        }
      }
      const activeDocMode = st.getActiveDoc().mode;
      if (activeDocMode === "world") {
        // World Mode zoom-adaptive fine nudging for labels & sub-map pins
        if (
          st.selection &&
          (st.selection.kind === "world_label" || st.selection.kind === "world_pin") &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
        ) {
          e.preventDefault();
          const step =
            st.zoomPercent >= 250
              ? e.shiftKey
                ? 0.25
                : 0.05
              : e.shiftKey
                ? 0.5
                : 0.12;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          const w = st.getActiveDoc().world;
          if (st.selection.kind === "world_label") {
            const lbl = w?.labels.find((x) => x.id === st.selection!.id);
            if (lbl) st.updateWorldLabel(lbl.id, { x: lbl.x + dx, y: lbl.y + dy }, true);
          } else {
            const pin = w?.subMapPins.find((x) => x.id === st.selection!.id);
            if (pin) st.updateWorldSubMapPin(pin.id, { x: pin.x + dx, y: pin.y + dy }, true);
          }
          return;
        }
        if (WORLD_TOOL_KEYS[lower]) {
          st.setActiveTool(WORLD_TOOL_KEYS[lower]);
          if (WORLD_TOOL_KEYS[lower] === "stamp") {
            useVaultStore.getState().setActiveCategory("symbol");
          }
          return;
        }
      }

      if (lower === "k" && activeDocMode === "battlemap") {
        st.setBrushParams({ terrainMode: e.shiftKey ? "replace" : "flood" });
        st.setActiveTool("terrain");
        return;
      }
      if (lower === "r" && st.activeTool === "terrain") {
        st.setBrushParams({ terrainMode: "rect" });
        return;
      }
      if (lower === "u" && st.activeTool === "stamp") {
        const nextOrder = st.stampPlacementOrder === "above" ? "below" : "above";
        st.setBrushParams({ stampPlacementOrder: nextOrder });
        st.pushToast(
          nextOrder === "below"
            ? "Stamp Order: Place BELOW overlapping / last asset"
            : "Stamp Order: Place ABOVE existing assets",
        );
        return;
      }
      if (lower === "x") {
        if (st.selection?.kind === "object") {
          st.transformSelectedObject("flipX");
        } else if (st.selection?.kind === "portal") {
          const p = st
            .getActiveDoc()
            .layers.find((l) => l.id === st.selection!.layerId)
            ?.portals?.find((x) => x.id === st.selection!.id);
          if (p) {
            st.updatePortal(st.selection.layerId, p.id, { swingInvert: !p.swingInvert }, true);
            st.pushToast(!p.swingInvert ? "Door Swing: Outward" : "Door Swing: Inward");
          }
        } else if (st.selection?.kind === "roof") {
          const rf = st
            .getActiveDoc()
            .layers.find((l) => l.id === st.selection!.layerId)
            ?.roofs?.find((x) => x.id === st.selection!.id);
          if (rf) {
            st.updateRoof(st.selection.layerId, rf.id, { flipSlope: !rf.flipSlope }, true);
            st.pushToast("Flipped Roof Slope Direction");
          }
        } else if (st.activeTool === "roof") {
          const next = !st.roofFlipSlope;
          st.setBrushParams({ roofFlipSlope: next });
          st.pushToast("Flipped Roof Slope Direction");
        } else if (st.activeTool === "portal") {
          const next = !st.activePortalSwingInvert;
          st.setBrushParams({ activePortalSwingInvert: next });
          st.pushToast(next ? "Door Swing Preview: Outward" : "Door Swing Preview: Inward");
        } else {
          st.setBrushParams({ stampFlipX: !st.stampFlipX });
        }
        return;
      }
      if (lower === "y") {
        if (st.selection?.kind === "object") {
          st.transformSelectedObject("flipY");
          return;
        }
        if (st.selection?.kind === "portal") {
          const p = st
            .getActiveDoc()
            .layers.find((l) => l.id === st.selection!.layerId)
            ?.portals?.find((x) => x.id === st.selection!.id);
          if (p) {
            st.updatePortal(st.selection.layerId, p.id, { hingeFlip: !p.hingeFlip }, true);
            st.pushToast(!p.hingeFlip ? "Door Hinge: Right Jamb" : "Door Hinge: Left Jamb");
          }
          return;
        }
        if (st.activeTool === "portal") {
          const next = !st.activePortalHingeFlip;
          st.setBrushParams({ activePortalHingeFlip: next });
          st.pushToast(next ? "Door Hinge Preview: Right Jamb" : "Door Hinge Preview: Left Jamb");
          return;
        }
      }

      // Arrow keys nudge selected prop or light precisely (zoom-adaptive fine step in World Mode)
      if (
        st.selection &&
        (st.selection.kind === "object" || st.selection.kind === "light") &&
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const step =
          activeDocMode === "world"
            ? st.zoomPercent >= 250
              ? e.shiftKey
                ? 0.25
                : 0.05
              : e.shiftKey
                ? 0.5
                : 0.12
            : e.shiftKey
              ? 1.0
              : 0.25;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const layer = st.getActiveDoc().layers.find((l) => l.id === st.selection!.layerId);
        if (st.selection.kind === "object") {
          const o = layer?.objects?.find((x) => x.id === st.selection!.id);
          if (o) st.updateObjectStamp(st.selection.layerId, o.id, { x: o.x + dx, y: o.y + dy }, true);
        } else {
          const l = layer?.lights?.find((x) => x.id === st.selection!.id);
          if (l) st.updateLight(st.selection.layerId, l.id, { x: l.x + dx, y: l.y + dy }, true);
        }
        return;
      }

      if (st.getActiveDoc().mode === "battlemap" && TOOL_KEYS[lower]) {
        st.setActiveTool(TOOL_KEYS[lower]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="dc-app-shell">
      <StudioAutosaveScheduler />
      <TopHeaderBar onOpenContextMenu={openContextMenu} />

      <main className="dc-workspace">
        <LeftToolRail />

        <div className="dc-center-column">
          <MapCanvas onOpenContextMenu={openContextMenu} />
          <AssetVaultDrawer onOpenContextMenu={openContextMenu} />
        </div>

        <RightInspectorDock onOpenContextMenu={openContextMenu} />
      </main>

      <StudioStatusBar />

      {/* Native Popover Context Menu */}
      <ContextMenu menu={menu} onClose={closeContextMenu} />

      {/* Lazy-mounted Native <dialog> Modals (zero startup cost when closed!) */}
      <StudioModalsHost onOpenContextMenu={openContextMenu} />

      {/* Non-blocking Toast Notifications */}
      <StudioToastStack />
    </div>
  );
};

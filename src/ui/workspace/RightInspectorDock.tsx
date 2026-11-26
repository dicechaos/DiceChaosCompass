import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BrickWall,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Droplets,
  Eye,
  EyeOff,
  Folder,
  GripVertical,
  Home,
  Layers,
  Lightbulb,
  Lock,
  MapPin,
  Mountain,
  Paintbrush,
  Pencil,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  Sliders,
  Sparkles,
  Spline,
  Stamp,
  Sun,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { cleanSourceRefLabel } from "@/engine/assetSwapEngine";
import { CAVE_THEME_PRESETS } from "@/engine/caveEngine";
import { getWallSegmentCount } from "@/engine/geometry";
import { resolveAssetUrl } from "@/engine/sceneRenderer";
import { findWorldSymbolFamilyVariants, pickNextWorldVariant } from "@/engine/worldEngine";
import {
  describeLayerContents,
  findPreferredLayerForKind,
  getLayerKindMeta,
  getNextDefaultLayerName,
  getOnionSkinReferenceLevel,
  suggestLayerNameFromContents,
  summarizeLevel,
} from "@/engine/layerMeta";
import { summarizeUsedTerrains } from "@/engine/terrainFill";
import { describeSelection } from "@/engine/selectionInfo";
import { sortLevelsTopDown, useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import type { ContextMenuEntry } from "@/ui/common/ContextMenu";
import { ColorStudioPanel } from "@/ui/workspace/ColorStudioPanel";
import { RoofStudioPanel } from "@/ui/workspace/RoofStudioPanel";
import { ScatterZonePanel } from "@/ui/workspace/ScatterZonePanel";
import { SectionCurveEditorCard } from "@/ui/workspace/SectionCurveEditorCard";
import { TemplatesPanel } from "@/ui/workspace/TemplatesPanel";
import { WaterStudioPanel } from "@/ui/workspace/WaterStudioPanel";
import { WorldStudioPanel } from "@/ui/workspace/WorldStudioPanel";
import {
  DEFAULT_RECOLOR,
  type BlendModeName,
  type CaveThresholdStyle,
  type LayerKind,
  type MapLayer,
  type StampRotateMode,
  type TerrainEraseShape,
  type TerrainMode,
  type TerrainReplaceScope,
  type VaultAsset,
  type WallDrawMode,
  type WallPolygonShape,
  type WallSplitSubMode,
} from "@/types/map";

function renderLayerKindIcon(kind: LayerKind): React.ReactNode {
  switch (kind) {
    case "terrain":
      return <Paintbrush size={12} />;
    case "caves":
      return <Mountain size={12} />;
    case "water":
      return <Droplets size={12} />;
    case "walls":
      return <BrickWall size={12} />;
    case "paths":
      return <Spline size={12} />;
    case "roofs":
      return <Home size={12} />;
    case "objects":
      return <Stamp size={12} />;
    case "scatter_zone":
      return <Sparkles size={12} />;
    case "lights":
      return <Lightbulb size={12} />;
    case "dm_notes":
      return <MapPin size={12} />;
    case "group":
    default:
      return <Folder size={12} />;
  }
}

interface RightInspectorDockProps {
  onOpenContextMenu: (
    x: number,
    y: number,
    ariaLabel: string,
    entries: ContextMenuEntry[],
  ) => void;
}

const LIGHT_SWATCHES = [
  { hex: "#FFE4A3", label: "Headlamp" },
  { hex: "#FFB84D", label: "Lantern" },
  { hex: "#FF6A1A", label: "Boiler Fire" },
  { hex: "#38BDF8", label: "Frost Blue" },
  { hex: "#A78BFA", label: "Arcane" },
  { hex: "#34D399", label: "Alchemical" },
];

export const RightInspectorDock: React.FC<RightInspectorDockProps> = React.memo(({
  onOpenContextMenu,
}) => {
  const doc = useDocumentStore((s) =>
    s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0],
  );
  const activeTool = useDocumentStore((s) => s.activeTool);
  const selection = useDocumentStore((s) => s.selection);
  const snapMode = useDocumentStore((s) => s.snapMode);
  const activeRecolor = useDocumentStore((s) => s.activeRecolor);
  const toolRecolors = useDocumentStore((s) => s.toolRecolors);
  const copiedRecolor = useDocumentStore((s) => s.copiedRecolor);
  const terrainMode = useDocumentStore((s) => s.terrainMode);
  const caveDrawMode = useDocumentStore((s) => s.caveDrawMode);
  const caveThemeId = useDocumentStore((s) => s.caveThemeId);
  const caveBrushRadiusCells = useDocumentStore((s) => s.caveBrushRadiusCells);
  const caveRoughness = useDocumentStore((s) => s.caveRoughness);
  const caveWallThicknessCells = useDocumentStore((s) => s.caveWallThicknessCells);
  const caveOuterRimCells = useDocumentStore((s) => s.caveOuterRimCells);
  const caveUndergroundFill = useDocumentStore((s) => s.caveUndergroundFill);
  const caveBlocksLight = useDocumentStore((s) => s.caveBlocksLight);
  const caveFloorAssetId = useDocumentStore((s) => s.caveFloorAssetId);
  const caveWallAssetId = useDocumentStore((s) => s.caveWallAssetId);
  const caveEntranceWidthCells = useDocumentStore((s) => s.caveEntranceWidthCells);
  const caveEntranceFadeCells = useDocumentStore((s) => s.caveEntranceFadeCells);
  const caveEntranceThreshold = useDocumentStore((s) => s.caveEntranceThreshold);
  const caveEntranceMarkerLabel = useDocumentStore((s) => s.caveEntranceMarkerLabel);
  const caveEntranceShowMarker = useDocumentStore((s) => s.caveEntranceShowMarker);
  const caveEntranceDmOnly = useDocumentStore((s) => s.caveEntranceDmOnly);
  const brushRadiusCells = useDocumentStore((s) => s.brushRadiusCells);
  const brushOpacity = useDocumentStore((s) => s.brushOpacity);
  const brushSoftness = useDocumentStore((s) => s.brushSoftness);
  const terrainFillSoftness = useDocumentStore((s) => s.terrainFillSoftness);
  const terrainRotationDeg = useDocumentStore((s) => s.terrainRotationDeg);
  const terrainSlopeShade = useDocumentStore((s) => s.terrainSlopeShade);
  const terrainTextureScale = useDocumentStore((s) => s.terrainTextureScale);
  const terrainPolygonCurved = useDocumentStore((s) => s.terrainPolygonCurved);
  const terrainReplaceScope = useDocumentStore((s) => s.terrainReplaceScope);
  const terrainReplaceApplyStyle = useDocumentStore((s) => s.terrainReplaceApplyStyle);
  const terrainEraseShape = useDocumentStore((s) => s.terrainEraseShape);
  const terrainFloodReplaceUnderneath = useDocumentStore((s) => s.terrainFloodReplaceUnderneath);
  const terrainBarrierWalls = useDocumentStore((s) => s.terrainBarrierWalls);
  const terrainBarrierCaves = useDocumentStore((s) => s.terrainBarrierCaves);
  const terrainBarrierWater = useDocumentStore((s) => s.terrainBarrierWater);
  const wallDrawMode = useDocumentStore((s) => s.wallDrawMode);
  const wallPolygonShape = useDocumentStore((s) => s.wallPolygonShape);
  const wallBoxRotationDeg = useDocumentStore((s) => s.wallBoxRotationDeg);
  const wallSnapToWalls = useDocumentStore((s) => s.wallSnapToWalls);
  const wallSplitSubMode = useDocumentStore((s) => s.wallSplitSubMode);
  const wallBreachWidthCells = useDocumentStore((s) => s.wallBreachWidthCells);
  const wallCorridorWidthCells = useDocumentStore((s) => s.wallCorridorWidthCells);
  const wallCorridorCapEnds = useDocumentStore((s) => s.wallCorridorCapEnds);
  const wallThicknessCells = useDocumentStore((s) => s.wallThicknessCells);
  const wallCurved = useDocumentStore((s) => s.wallCurved);
  const wallBlocksLight = useDocumentStore((s) => s.wallBlocksLight);
  const wallAutoFillClosed = useDocumentStore((s) => s.wallAutoFillClosed);
  const pathWidthCells = useDocumentStore((s) => s.pathWidthCells);
  const pathCurved = useDocumentStore((s) => s.pathCurved);
  const pathFlipSide = useDocumentStore((s) => s.pathFlipSide);
  const pathTaperEnds = useDocumentStore((s) => s.pathTaperEnds);
  const stampScale = useDocumentStore((s) => s.stampScale);
  const stampPlacementOrder = useDocumentStore((s) => s.stampPlacementOrder);
  const stampPaintDrag = useDocumentStore((s) => s.stampPaintDrag);
  const stampPaintSpacingCells = useDocumentStore((s) => s.stampPaintSpacingCells);
  const stampAutoRotate = useDocumentStore((s) => s.stampAutoRotate);
  const stampRotateMode = useDocumentStore((s) => s.stampRotateMode);
  const stampRotateSpreadDeg = useDocumentStore((s) => s.stampRotateSpreadDeg);
  const stampRotateStepDeg = useDocumentStore((s) => s.stampRotateStepDeg);
  const stampRandomFlipX = useDocumentStore((s) => s.stampRandomFlipX);
  const stampRandomJitter = useDocumentStore((s) => s.stampRandomJitter);
  const stampColorJitter = useDocumentStore((s) => s.stampColorJitter);
  const worldSymbolAvoidWater = useDocumentStore((s) => s.worldSymbolAvoidWater);
  const worldSymbolSampleBiome = useDocumentStore((s) => s.worldSymbolSampleBiome);
  const worldSymbolMultiVariant = useDocumentStore((s) => s.worldSymbolMultiVariant);
  const activeLightColorHex = useDocumentStore((s) => s.activeLightColorHex);
  const activeLightRadiusCells = useDocumentStore((s) => s.activeLightRadiusCells);
  const activeLightIntensity = useDocumentStore((s) => s.activeLightIntensity);
  const activeLightCastShadows = useDocumentStore((s) => s.activeLightCastShadows);
  const activeLightConeDeg = useDocumentStore((s) => s.activeLightConeDeg);
  const scatterPresetName = useDocumentStore((s) => s.scatterPresetName);
  const scatterAssetIds = useDocumentStore((s) => s.scatterAssetIds);
  const scatterMinSpacing = useDocumentStore((s) => s.scatterMinSpacing);
  const scatterMinScale = useDocumentStore((s) => s.scatterMinScale);
  const scatterMaxScale = useDocumentStore((s) => s.scatterMaxScale);
  const scatterAvoidWalls = useDocumentStore((s) => s.scatterAvoidWalls);
  const scatterAvoidPaths = useDocumentStore((s) => s.scatterAvoidPaths);
  const activeWallAssetId = useDocumentStore((s) => s.activeWallAssetId);
  const activePathAssetId = useDocumentStore((s) => s.activePathAssetId);
  const activePortalAssetId = useDocumentStore((s) => s.activePortalAssetId);
  const activeTerrainAssetId = useDocumentStore((s) => s.activeTerrainAssetId);
  const recentTerrainAssetIds = useDocumentStore((s) => s.recentTerrainAssetIds);
  const activePortalWidthCells = useDocumentStore((s) => s.activePortalWidthCells);
  const activePortalClosed = useDocumentStore((s) => s.activePortalClosed);
  const activePortalSwingInvert = useDocumentStore((s) => s.activePortalSwingInvert);
  const activePortalHingeFlip = useDocumentStore((s) => s.activePortalHingeFlip);
  const filterLayersByFloor = useDocumentStore((s) => s.filterLayersByFloor);
  const soloLayerId = useDocumentStore((s) => s.soloLayerId);
  const lockLowerFloors = useDocumentStore((s) => s.lockLowerFloors);

  const sortedLevels = useMemo(() => sortLevelsTopDown(doc.levels), [doc.levels]);
  const levelById = useMemo(() => new Map(doc.levels.map((lv) => [lv.id, lv])), [doc.levels]);
  const activeLevel = levelById.get(doc.activeLevelId) ?? sortedLevels[0];

  const [matSearch, setMatSearch] = useState("");
  const [layerSearchOpen, setLayerSearchOpen] = useState(false);
  const [layerSearch, setLayerSearch] = useState("");
  const layerSearchInputRef = useRef<HTMLInputElement | null>(null);
  const [openFloorIds, setOpenFloorIds] = useState<Record<string, boolean>>(() => ({
    [doc.activeLevelId]: true,
  }));
  const [layersSplitPct, setLayersSplitPct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem("dc-right-dock-split"));
      if (Number.isFinite(saved) && saved >= 22 && saved <= 78) return saved;
    } catch {
      // Ignore storage errors
    }
    return 46;
  });
  const dockRef = useRef<HTMLElement | null>(null);
  const splitDragRef = useRef<{ active: boolean; latestPct: number }>({
    active: false,
    latestPct: 46,
  });

  const renameInputBaseId = useId();
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameDoneRef = useRef(false);
  const layerListRef = useRef<HTMLDivElement | null>(null);
  const suppressLayerClickRef = useRef(false);
  const layerDragRef = useRef<{
    layerId: string;
    layerName: string;
    startX: number;
    startY: number;
    active: boolean;
  } | null>(null);
  const [draggingLayerId, setDraggingLayerId] = useState<string | null>(null);
  const [dragGhost, setDragGhost] = useState<{ name: string; x: number; y: number } | null>(null);
  const [layerDropTarget, setLayerDropTarget] = useState<
    | { kind: "layer"; targetLayerId: string; placement: "above" | "below" }
    | { kind: "floor"; targetLevelId: string }
    | null
  >(null);
  const layerDropTargetRef = useRef<
    | { kind: "layer"; targetLayerId: string; placement: "above" | "below" }
    | { kind: "floor"; targetLevelId: string }
    | null
  >(null);

  useEffect(() => {
    setOpenFloorIds((prev) =>
      prev[doc.activeLevelId] ? prev : { ...prev, [doc.activeLevelId]: true },
    );
  }, [doc.activeLevelId]);

  useEffect(() => {
    const computeDropTarget = (clientY: number) => {
      const container = layerListRef.current;
      if (!container) return null;

      // Auto-scroll smoothly when dragging near top or bottom of the layers list
      const cRect = container.getBoundingClientRect();
      if (clientY < cRect.top + 26) {
        container.scrollTop = Math.max(0, container.scrollTop - 8);
      } else if (clientY > cRect.bottom - 26) {
        container.scrollTop += 8;
      }

      // Check floor accordion headers first so users can drop a layer directly onto a collapsed floor
      const headers = Array.from(
        container.querySelectorAll<HTMLElement>(".dc-floor-group-summary[data-floor-drop-id]"),
      );
      for (const hdr of headers) {
        const lvlId = hdr.dataset.floorDropId;
        if (!lvlId) continue;
        const rect = hdr.getBoundingClientRect();
        if (rect.height > 0 && clientY >= rect.top && clientY <= rect.bottom) {
          return { kind: "floor" as const, targetLevelId: lvlId };
        }
      }

      const rows = Array.from(
        container.querySelectorAll<HTMLElement>(".dc-layer-row[data-layer-id]"),
      ).filter((r) => r.getBoundingClientRect().height > 0);
      if (rows.length === 0) return null;

      for (const row of rows) {
        const id = row.dataset.layerId;
        if (!id) continue;
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        if (clientY < midY) {
          return { kind: "layer" as const, targetLayerId: id, placement: "above" as const };
        }
      }
      const lastId = rows[rows.length - 1]?.dataset.layerId;
      return lastId
        ? { kind: "layer" as const, targetLayerId: lastId, placement: "below" as const }
        : null;
    };

    const clearDrag = () => {
      layerDragRef.current = null;
      layerDropTargetRef.current = null;
      setDraggingLayerId(null);
      setDragGhost(null);
      setLayerDropTarget(null);
      document.body.style.cursor = "";
    };

    const onPointerMove = (e: PointerEvent) => {
      const d = layerDragRef.current;
      if (!d) return;
      if (!d.active) {
        if (Math.abs(e.clientY - d.startY) < 4 && Math.abs(e.clientX - d.startX) < 4) {
          return;
        }
        d.active = true;
        setDraggingLayerId(d.layerId);
        document.body.style.cursor = "grabbing";
      }
      setDragGhost({ name: d.layerName, x: e.clientX, y: e.clientY });
      const nextTarget = computeDropTarget(e.clientY);
      layerDropTargetRef.current = nextTarget;
      setLayerDropTarget((prev) => {
        if (prev === nextTarget) return prev;
        if (
          prev?.kind === "layer" &&
          nextTarget?.kind === "layer" &&
          prev.targetLayerId === nextTarget.targetLayerId &&
          prev.placement === nextTarget.placement
        ) {
          return prev;
        }
        if (
          prev?.kind === "floor" &&
          nextTarget?.kind === "floor" &&
          prev.targetLevelId === nextTarget.targetLevelId
        ) {
          return prev;
        }
        return nextTarget;
      });
    };

    const onPointerUp = () => {
      const d = layerDragRef.current;
      if (!d) return;
      const wasActive = d.active;
      const sourceId = d.layerId;
      const target = layerDropTargetRef.current;
      clearDrag();
      if (wasActive) {
        suppressLayerClickRef.current = true;
        window.setTimeout(() => {
          suppressLayerClickRef.current = false;
        }, 0);
        if (target?.kind === "floor") {
          useDocumentStore.getState().setLayerLevel(sourceId, target.targetLevelId);
        } else if (target?.kind === "layer" && target.targetLayerId !== sourceId) {
          useDocumentStore
            .getState()
            .moveLayerRelative(sourceId, target.targetLayerId, target.placement);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && layerDragRef.current?.active) {
        clearDrag();
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", clearDrag);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", clearDrag);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.cursor = "";
    };
  }, []);
  const allVaultAssets = useVaultStore((s) => s.assets);
  const vaultById = useVaultStore((s) => s.assetById);
  const selectedVaultAssetId = useVaultStore((s) => s.selectedAssetId);
  const { wallAssets, pathAssets, portalAssets, terrainAssets } = useMemo(() => {
    const walls: VaultAsset[] = [];
    const paths: VaultAsset[] = [];
    const portals: VaultAsset[] = [];
    const terrains: VaultAsset[] = [];
    for (let i = 0; i < allVaultAssets.length; i++) {
      const a = allVaultAssets[i];
      if (a.category === "wall") walls.push(a);
      else if (a.category === "path") paths.push(a);
      else if (a.category === "portal") portals.push(a);
      else if (a.category === "terrain") terrains.push(a);
    }
    return {
      wallAssets: walls,
      pathAssets: paths,
      portalAssets: portals,
      terrainAssets: terrains,
    };
  }, [allVaultAssets]);

  const renderMaterialPicker = (
    title: string,
    items: VaultAsset[],
    currentId: string,
    onPick: (id: string) => void,
  ) => {
    const q = matSearch.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (i) =>
            i.displayName.toLowerCase().includes(q) ||
            i.tags.some((t) => t.includes(q)) ||
            i.sourceName.toLowerCase().includes(q),
        )
      : items;
    // Keep currently active material visible even when list has 100+ Dungeondraft materials
    const currentItem = items.find((i) => i.id === currentId);
    let shown = filtered.slice(0, 32);
    if (currentItem && !shown.some((x) => x.id === currentId)) {
      shown = [currentItem, ...shown.slice(0, 31)];
    }
    return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--accent-gold)",
          marginBottom: 6,
        }}
      >
        <span>{title}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, opacity: 0.75 }}>
          {filtered.length}
        </span>
      </div>
      {items.length > 16 && (
        <input
          type="search"
          className="dc-input"
          placeholder={`Filter ${items.length} styles…`}
          value={matSearch}
          onChange={(e) => setMatSearch(e.target.value)}
          style={{ width: "100%", height: 24, fontSize: 11, marginBottom: 6 }}
        />
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 6,
          width: "100%",
        }}
      >
        {shown.map((item) => {
          const active = item.id === currentId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onPick(item.id);
                useVaultStore.getState().setSelectedAssetId(item.id);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 4,
                padding: 5,
                borderRadius: 6,
                border: `1px solid ${active ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                background: active ? "var(--accent-gold-soft)" : "var(--bg-panel)",
                color: "var(--text-primary)",
                cursor: "pointer",
                textAlign: "left",
                minWidth: 0,
              }}
              title={`${item.displayName} (${item.sourceName})`}
            >
              <div
                className="dc-asset-thumb-box"
                style={{ minHeight: 34, height: 34, borderRadius: 4 }}
              >
                <img src={item.thumbUrl} alt={item.displayName} loading="lazy" />
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.displayName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
    );
  };

  const st = useDocumentStore.getState();
  const activeLayer = doc.layers.find((l) => l.id === doc.activeLayerId) ?? doc.layers[0];
  const normalizedLayerQuery = layerSearch.trim().toLowerCase();
  const matchesLayerQuery = useCallback(
    (l: MapLayer) => {
      if (!normalizedLayerQuery) return true;
      const meta = getLayerKindMeta(l.kind);
      const lv = levelById.get(l.levelId);
      return (
        l.name.toLowerCase().includes(normalizedLayerQuery) ||
        meta.label.toLowerCase().includes(normalizedLayerQuery) ||
        meta.shortLabel.toLowerCase().includes(normalizedLayerQuery) ||
        (lv?.shortCode.toLowerCase().includes(normalizedLayerQuery) ?? false) ||
        (lv?.name.toLowerCase().includes(normalizedLayerQuery) ?? false)
      );
    },
    [normalizedLayerQuery, levelById],
  );
  const activeFloorLayers = useMemo(
    () => [...doc.layers].reverse().filter((l) => l.levelId === doc.activeLevelId),
    [doc.layers, doc.activeLevelId],
  );
  const displayLayers = useMemo(() => {
    const base =
      doc.mode === "world" || !filterLayersByFloor || normalizedLayerQuery
        ? [...doc.layers].reverse()
        : activeFloorLayers;
    return normalizedLayerQuery ? base.filter(matchesLayerQuery) : base;
  }, [doc.mode, doc.layers, filterLayersByFloor, normalizedLayerQuery, activeFloorLayers, matchesLayerQuery]);

  // Auto-scroll active layer row into view on floor/layer switches
  useEffect(() => {
    const container = layerListRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      const row = container.querySelector<HTMLElement>(
        `.dc-layer-row[data-layer-id="${doc.activeLayerId}"]`,
      );
      row?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(raf);
  }, [doc.activeLayerId, doc.activeLevelId, filterLayersByFloor]);

  const beginLayerRename = useCallback((layer: MapLayer) => {
    renameDoneRef.current = false;
    useDocumentStore.getState().setActiveLayer(layer.id);
    setEditingLayerId(layer.id);
    setRenameDraft(layer.name);
  }, []);

  const restoreLayerRowFocus = useCallback((layerId: string) => {
    requestAnimationFrame(() => {
      const row = layerListRef.current?.querySelector<HTMLElement>(
        `.dc-layer-row[data-layer-id="${layerId}"]`,
      );
      row?.focus({ preventScroll: true });
    });
  }, []);

  const commitLayerRename = useCallback(
    (restoreFocus = false) => {
      const targetId = editingLayerId;
      if (!targetId || renameDoneRef.current) return;
      renameDoneRef.current = true;
      setEditingLayerId(null);
      useDocumentStore.getState().renameLayer(targetId, renameDraft);
      if (restoreFocus) {
        restoreLayerRowFocus(targetId);
      }
    },
    [editingLayerId, renameDraft, restoreLayerRowFocus],
  );

  const cancelLayerRename = useCallback(
    (restoreFocus = false) => {
      const targetId = editingLayerId;
      if (!targetId || renameDoneRef.current) return;
      renameDoneRef.current = true;
      setEditingLayerId(null);
      if (restoreFocus) {
        restoreLayerRowFocus(targetId);
      }
    },
    [editingLayerId, restoreLayerRowFocus],
  );

  // Auto-focus & select full layer name when inline editing starts (rAF avoids popover focus race)
  useEffect(() => {
    if (!editingLayerId) return;
    const raf = requestAnimationFrame(() => {
      const row = layerListRef.current?.querySelector<HTMLElement>(
        `.dc-layer-row[data-layer-id="${editingLayerId}"]`,
      );
      row?.scrollIntoView({ block: "nearest" });
      const input = renameInputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [editingLayerId]);

  // Cancel editing if the active document switched or the layer was removed
  useEffect(() => {
    if (editingLayerId && !doc.layers.some((l) => l.id === editingLayerId)) {
      setEditingLayerId(null);
    }
  }, [doc.id, doc.layers, editingLayerId]);

  // F2 global shortcut triggers inline rename for the active layer
  useEffect(() => {
    const onRenameShortcut = () => {
      const state = useDocumentStore.getState();
      const curDoc = state.getActiveDoc();
      const target = curDoc.layers.find((l) => l.id === curDoc.activeLayerId) ?? curDoc.layers[0];
      if (!target) return;
      if (
        state.filterLayersByFloor &&
        target.levelId !== curDoc.activeLevelId &&
        target.kind !== "dm_notes"
      ) {
        state.setFilterLayersByFloor(false);
      }
      beginLayerRename(target);
    };
    window.addEventListener("dc-rename-active-layer", onRenameShortcut);
    return () => window.removeEventListener("dc-rename-active-layer", onRenameShortcut);
  }, [beginLayerRename]);

  // Fallback truncation detection for single-line overflow reveal when style queries are unavailable
  const layerNamesSignature = displayLayers.map((l) => `${l.id}:${l.name}`).join("|");
  useEffect(() => {
    const container = layerListRef.current;
    if (!container) return;
    const labels = Array.from(container.querySelectorAll<HTMLElement>(".dc-layer-name"));
    const sync = (el: HTMLElement) => {
      el.classList.toggle("is-truncated", el.scrollWidth > el.clientWidth + 1);
    };
    labels.forEach(sync);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        sync(entry.target as HTMLElement);
      }
    });
    labels.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [layerNamesSignature, editingLayerId]);

  // Locate currently selected entity for context-sensitive inspector
  const selectedObject =
    selection?.kind === "object"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.objects?.find((o) => o.id === selection.id)
      : null;

  const selectedLight =
    selection?.kind === "light"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.lights?.find((l) => l.id === selection.id)
      : null;

  const selectedScatter =
    selection?.kind === "scatter"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.scatterZones?.find((z) => z.id === selection.id)
      : null;

  const selectedWall =
    selection?.kind === "wall"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.walls?.find((w) => w.id === selection.id)
      : null;

  const selectedPath =
    selection?.kind === "path"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.paths?.find((p) => p.id === selection.id)
      : null;

  const selectedPortal =
    selection?.kind === "portal"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.portals?.find((p) => p.id === selection.id)
      : null;

  const selectedDmNote =
    selection?.kind === "dm_note"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.dmNotes?.find((n) => n.id === selection.id)
      : null;

  const selectedCaveEntrance =
    selection?.kind === "cave_entrance"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.caveSystem?.entrances?.find((e) => e.id === selection.id)
      : null;

  const selectedWater =
    selection?.kind === "water"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.waterRegions?.find((w) => w.id === selection.id)
      : null;

  const selectedRoof =
    selection?.kind === "roof"
      ? doc.layers
          .find((l) => l.id === selection.layerId)
          ?.roofs?.find((r) => r.id === selection.id)
      : null;

  const activeFloorCaveLayer = doc.layers.find(
    (l) => l.kind === "caves" && l.levelId === doc.activeLevelId && l.caveSystem,
  );

  // All lights on the active floor (for the Lighting & Atmosphere quick-select list)
  const floorLights = doc.layers
    .filter((l) => l.levelId === doc.activeLevelId && (l.lights?.length ?? 0) > 0)
    .flatMap((l) => (l.lights ?? []).map((light) => ({ layerId: l.id, layerVisible: l.visible, light })));

  const renderSceneAtmosphereFields = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="dc-field-row" style={{ marginBottom: 0 }}>
        <span className="dc-field-label">Dynamic 2D Lighting</span>
        <button
          type="button"
          role="switch"
          aria-checked={doc.lighting.enabled}
          className="dc-switch"
          onClick={() => st.setLightingSettings({ enabled: !doc.lighting.enabled })}
        />
      </div>
      <div className="dc-field-row" style={{ marginBottom: 0 }}>
        <span className="dc-field-label">Lighting Preset</span>
        <select
          className="dc-select"
          value={doc.lighting.activePresetId}
          onChange={(e) => {
            st.applyLightingPreset(e.target.value);
            if (!doc.lighting.enabled) st.setLightingSettings({ enabled: true });
          }}
        >
          {doc.lighting.presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="dc-field-row" style={{ marginBottom: 0 }}>
        <span className="dc-field-label">
          Ambient ({Math.round(doc.lighting.ambientIntensity * 100)}%)
        </span>
        <input
          type="range"
          className="dc-range"
          style={{ width: 124 }}
          min={0.05}
          max={1}
          step={0.03}
          value={doc.lighting.ambientIntensity}
          onChange={(e) =>
            st.setLightingSettings({ ambientIntensity: Number(e.target.value) })
          }
        />
      </div>
      <div className="dc-field-row" style={{ marginBottom: 0 }}>
        <span className="dc-field-label">Ambient Tint</span>
        <input
          type="color"
          value={doc.lighting.ambientColorHex}
          onChange={(e) => st.setLightingSettings({ ambientColorHex: e.target.value })}
        />
      </div>
      <div className="dc-field-row" style={{ marginBottom: 0 }}>
        <span className="dc-field-label">
          Shadow Softness ({Math.round(doc.lighting.shadowSoftness * 100)}%)
        </span>
        <input
          type="range"
          className="dc-range"
          style={{ width: 124 }}
          min={0}
          max={1}
          step={0.05}
          value={doc.lighting.shadowSoftness}
          onChange={(e) =>
            st.setLightingSettings({ shadowSoftness: Number(e.target.value) })
          }
        />
      </div>
    </div>
  );

  const renderFloorLightsList = () => (
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--accent-gold)",
          }}
        >
          Scene Lights ({floorLights.length})
        </span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Click to select</span>
      </div>
      {floorLights.length === 0 ? (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            background: "var(--bg-panel)",
            border: "1px dashed var(--border-subtle)",
            borderRadius: 6,
            padding: "8px 10px",
            textAlign: "center",
          }}
        >
          No lights on this floor yet. Click anywhere on the map to place one.
        </div>
      ) : (
        <div
          className="dc-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 3,
            maxHeight: 168,
            overflowY: "auto",
            paddingRight: 2,
          }}
        >
          {floorLights.map(({ layerId, light }) => {
            const isSel = selection?.kind === "light" && selection.id === light.id;
            return (
              <div
                key={light.id}
                onClick={() => st.setSelection({ kind: "light", layerId, id: light.id })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "4px 7px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: isSel ? "var(--accent-gold-soft)" : "var(--bg-panel)",
                  border: `1px solid ${isSel ? "rgba(229, 169, 60, 0.55)" : "var(--border-subtle)"}`,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: light.colorHex,
                    boxShadow: `0 0 6px ${light.colorHex}`,
                    border: "1px solid rgba(255,255,255,0.6)",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: isSel ? "var(--accent-gold)" : "var(--text-primary)",
                    fontWeight: isSel ? 600 : 400,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {light.name || "Map Light"}
                </span>
                {light.coneAngleDeg < 360 && (
                  <span
                    style={{
                      fontSize: 9,
                      fontFamily: "var(--font-mono)",
                      color: "#67E8F9",
                      background: "rgba(34, 211, 238, 0.12)",
                      borderRadius: 4,
                      padding: "1px 4px",
                    }}
                    title={`Directional spotlight (${light.coneAngleDeg}° cone)`}
                  >
                    {light.coneAngleDeg}°
                  </span>
                )}
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  {light.radiusCells.toFixed(1)}sq
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const openLayerContextMenu = (e: React.MouseEvent, layer: MapLayer) => {
    e.preventDefault();
    st.setActiveLayer(layer.id);
    onOpenContextMenu(e.clientX, e.clientY, `Layer: ${layer.name}`, [
      {
        type: "item",
        id: "lyr-vis",
        label: layer.visible ? "Hide Layer" : "Show Layer",
        checked: layer.visible,
        onSelect: () => st.toggleLayerVisible(layer.id),
      },
      {
        type: "item",
        id: "lyr-solo",
        label: soloLayerId === layer.id ? "Exit Solo Layer" : "Solo This Layer",
        shortcut: "Alt+Eye",
        checked: soloLayerId === layer.id,
        onSelect: () => st.soloLayer(layer.id),
      },
      {
        type: "item",
        id: "lyr-lock",
        label: layer.locked ? "Unlock Layer" : "Lock Layer",
        checked: layer.locked,
        onSelect: () => st.toggleLayerLocked(layer.id),
      },
      {
        type: "item",
        id: "lyr-dm",
        label: "DM-Only Spoiler Shield",
        checked: layer.dmOnly,
        onSelect: () => st.toggleLayerDmOnly(layer.id),
      },
      {
        type: "submenu",
        id: "lyr-floor",
        label: "Move Layer to Floor / Roof",
        items: sortedLevels.map((lv) => ({
          id: `flr-${lv.id}`,
          label: `${lv.shortCode} · ${lv.name} (${lv.elevationFt > 0 ? `+${lv.elevationFt}` : lv.elevationFt} ft)`,
          checked: layer.levelId === lv.id,
          onSelect: () => st.setLayerLevel(layer.id, lv.id),
        })),
      },
      { type: "separator" },
      {
        type: "item",
        id: "lyr-up",
        label: "Move Layer Up (Within Floor)",
        onSelect: () => st.reorderLayer(layer.id, "up"),
      },
      {
        type: "item",
        id: "lyr-down",
        label: "Move Layer Down (Within Floor)",
        onSelect: () => st.reorderLayer(layer.id, "down"),
      },
      {
        type: "item",
        id: "lyr-dup",
        label: "Duplicate Layer",
        onSelect: () => st.duplicateLayer(layer.id),
      },
      {
        type: "item",
        id: "lyr-ren",
        label: "Rename Layer",
        shortcut: "F2",
        onSelect: () => beginLayerRename(layer),
      },
      {
        type: "item",
        id: "lyr-auto-name",
        label: "Auto-Name from Contents",
        onSelect: () => {
          const suggested = suggestLayerNameFromContents(layer, vaultById);
          if (suggested !== layer.name) {
            st.renameLayer(layer.id, suggested);
            st.pushToast(`Renamed layer to "${suggested}"`, "success");
          } else {
            st.pushToast(`Layer name already matches contents ("${suggested}")`);
          }
        },
      },
      { type: "separator" },
      {
        type: "item",
        id: "lyr-del",
        label: "Delete Layer",
        danger: true,
        disabled: doc.layers.length <= 1,
        onSelect: () => st.deleteLayer(layer.id),
      },
    ]);
  };

  const getFloorBadgeColors = (lv: { shortCode: string; kind: string } | undefined) => {
    if (lv?.kind === "sky") return { text: lv.shortCode, col: "#38BDF8", bg: "rgba(56,189,248,0.20)" };
    if (lv?.kind === "roof") return { text: lv.shortCode, col: "#C4B5FD", bg: "rgba(139,92,246,0.18)" };
    if (lv?.kind === "upper") return { text: lv.shortCode, col: "#22D3EE", bg: "rgba(34,211,238,0.14)" };
    if (lv?.kind === "underground") return { text: lv.shortCode, col: "#A5B4FC", bg: "rgba(99,102,241,0.20)" };
    return { text: lv?.shortCode ?? "1F", col: "#E5A93C", bg: "rgba(229,169,60,0.14)" };
  };

  const openMoveLayerFloorMenu = (
    x: number,
    y: number,
    layer: MapLayer,
  ) => {
    onOpenContextMenu(
      x,
      y,
      `Move "${layer.name}" to Floor`,
      sortedLevels.map((lv) => ({
        type: "item" as const,
        id: `move-flr-${lv.id}`,
        label: `${lv.shortCode} · ${lv.name} (${lv.elevationFt > 0 ? `+${lv.elevationFt}` : lv.elevationFt}ft)`,
        checked: layer.levelId === lv.id,
        onSelect: () => st.setLayerLevel(layer.id, lv.id),
      })),
    );
  };

  const renderLayerRow = (layer: MapLayer, showFloorPill: boolean) => {
    const isActive = layer.id === doc.activeLayerId;
    const isDragging = draggingLayerId === layer.id;
    const isSoloed = soloLayerId === layer.id;
    const dropClass =
      draggingLayerId &&
      draggingLayerId !== layer.id &&
      layerDropTarget?.kind === "layer" &&
      layerDropTarget.targetLayerId === layer.id
        ? layerDropTarget.placement === "above"
          ? "drop-above"
          : "drop-below"
        : "";
    const lv = levelById.get(layer.levelId);
    const flrStyle = getFloorBadgeColors(lv);
    const kindMeta = getLayerKindMeta(layer.kind);
    const contentInfo = describeLayerContents(layer);
    const isEditing = editingLayerId === layer.id;
    const renameInputId = `${renameInputBaseId}-${layer.id}`;
    return (
      <div
        key={layer.id}
        data-layer-id={layer.id}
        tabIndex={-1}
        title={isEditing ? undefined : `${contentInfo.tooltip}\nDouble-click or F2 to rename · Alt+Click Eye to Solo`}
        className={`dc-layer-row ${isActive ? "active" : ""} ${isEditing ? "editing" : ""} ${layer.dmOnly ? "dm-only" : ""} ${isDragging ? "dragging" : ""} ${dropClass}`}
        onPointerDown={(e) => {
          if (e.button !== 0 || isEditing) return;
          if ((e.target as HTMLElement).closest("button, input, form")) return;
          layerDragRef.current = {
            layerId: layer.id,
            layerName: layer.name,
            startX: e.clientX,
            startY: e.clientY,
            active: false,
          };
        }}
        onClick={() => {
          if (suppressLayerClickRef.current || isEditing) return;
          st.setActiveLayer(layer.id);
        }}
        onContextMenu={(e) => {
          if (isEditing) return;
          openLayerContextMenu(e, layer);
        }}
      >
        {!isEditing && (
          <span
            className="dc-layer-grip"
            title="Drag to reorder layer (or drop on any floor header to move floors)"
            aria-hidden="true"
          >
            <GripVertical size={12} />
          </span>
        )}
        <button
          type="button"
          className="dc-mini-icon-btn"
          title={
            isSoloed
              ? "Soloed — Click to toggle or Alt+Click to restore floor visibility"
              : layer.visible
                ? "Hide layer (Alt+Click to Solo)"
                : "Show layer (Alt+Click to Solo)"
          }
          aria-label={`Toggle ${layer.name} visibility`}
          onClick={(e) => {
            e.stopPropagation();
            if (e.altKey) {
              st.soloLayer(layer.id);
            } else {
              st.toggleLayerVisible(layer.id);
            }
          }}
        >
          {layer.visible ? <Eye size={13} /> : <EyeOff size={13} style={{ opacity: 0.4 }} />}
        </button>
        <span
          className="dc-layer-kind-icon"
          style={{
            color: kindMeta.color,
            background: `${kindMeta.color}18`,
            borderColor: `${kindMeta.color}40`,
            opacity: layer.visible ? 1 : 0.45,
          }}
          title={`${kindMeta.label} · ${contentInfo.summary}`}
          aria-hidden="true"
        >
          {renderLayerKindIcon(layer.kind)}
        </span>
        {isEditing ? (
          <form
            className="dc-layer-rename-form"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              commitLayerRename(true);
            }}
          >
            <label htmlFor={renameInputId} className="visually-hidden">
              Rename layer {layer.name}
            </label>
            <input
              id={renameInputId}
              ref={renameInputRef}
              type="text"
              className="dc-layer-rename-input"
              value={renameDraft}
              maxLength={64}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.nativeEvent.isComposing || e.keyCode === 229) {
                    return;
                  }
                  commitLayerRename(true);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelLayerRename(true);
                }
              }}
              onBlur={(e) => {
                if (renameDoneRef.current) {
                  return;
                }
                if (
                  e.relatedTarget &&
                  e.currentTarget.form?.contains(e.relatedTarget as Node)
                ) {
                  return;
                }
                commitLayerRename(false);
              }}
            />
            <button
              type="submit"
              className="dc-layer-rename-action confirm"
              title="Save layer name (Enter)"
              aria-label={`Save name for ${layer.name}`}
              onPointerDown={(e) => e.preventDefault()}
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              className="dc-layer-rename-action cancel"
              title="Cancel rename (Esc)"
              aria-label={`Cancel renaming ${layer.name}`}
              onPointerDown={(e) => {
                e.preventDefault();
                cancelLayerRename(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
                cancelLayerRename(true);
              }}
            >
              <X size={12} />
            </button>
          </form>
        ) : (
          <>
            <div className="dc-layer-name-wrap">
              <span
                className="dc-layer-name"
                style={{ opacity: layer.visible ? 1 : 0.45 }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  beginLayerRename(layer);
                }}
              >
                <span className="dc-layer-name-text">{layer.name}</span>
              </span>
              <button
                type="button"
                className="dc-layer-rename-btn"
                data-rename-trigger={layer.id}
                title="Rename layer (Double-click or F2)"
                aria-label={`Rename ${layer.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  beginLayerRename(layer);
                }}
              >
                <Pencil size={11} />
              </button>
            </div>
            {isSoloed && (
              <button
                type="button"
                className="dc-layer-solo-pill"
                title="Layer Soloed — Click to restore floor visibility"
                onClick={(e) => {
                  e.stopPropagation();
                  st.soloLayer(layer.id);
                }}
              >
                SOLO
              </button>
            )}
            {layer.dmOnly && (
              <span
                className="dc-layer-dm-pill"
                title="DM-Only Layer (Auto-stripped on Player & VTT exports)"
              >
                <ShieldAlert size={10} />
                DM
              </span>
            )}
            {showFloorPill && doc.mode !== "world" && (
              <button
                type="button"
                title={`Assigned to ${lv?.name ?? "1F"} — Click to move to another floor`}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMoveLayerFloorMenu(rect.left - 160, rect.bottom + 4, layer);
                }}
                className="dc-floor-code-pill"
                style={{
                  borderColor: `${flrStyle.col}55`,
                  background: flrStyle.bg,
                  color: flrStyle.col,
                }}
              >
                {flrStyle.text}
              </button>
            )}
            <span
              className={`dc-layer-count-pill ${contentInfo.totalCount === 0 ? "empty" : ""}`}
              title={contentInfo.summary}
            >
              {contentInfo.totalCount}
            </span>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title={layer.locked ? "Unlock layer" : "Lock layer"}
              aria-label={`Toggle ${layer.name} lock`}
              onClick={(e) => {
                e.stopPropagation();
                st.toggleLayerLocked(layer.id);
              }}
            >
              {layer.locked ? <Lock size={12} /> : <Unlock size={12} style={{ opacity: 0.35 }} />}
            </button>
          </>
        )}
      </div>
    );
  };

  const activeLayerMeta = getLayerKindMeta(activeLayer.kind);
  const activeLayerLevel = levelById.get(activeLayer.levelId);
  const activeLayerFloorColors = getFloorBadgeColors(activeLayerLevel);
  const allFloorsExpanded = sortedLevels.every((lv) => Boolean(openFloorIds[lv.id]));

  const toggleAllAccordions = () => {
    const nextOpen = !allFloorsExpanded;
    const map: Record<string, boolean> = {};
    for (const lv of sortedLevels) {
      map[lv.id] = nextOpen || lv.id === doc.activeLevelId;
    }
    setOpenFloorIds(map);
  };

  const handleResizerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !dockRef.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    splitDragRef.current = { active: true, latestPct: layersSplitPct };
  };

  const handleResizerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!splitDragRef.current.active || !dockRef.current) return;
    const rect = dockRef.current.getBoundingClientRect();
    if (rect.height <= 0) return;
    const pct = Math.max(22, Math.min(78, ((e.clientY - rect.top) / rect.height) * 100));
    const rounded = Math.round(pct * 10) / 10;
    splitDragRef.current.latestPct = rounded;
    setLayersSplitPct(rounded);
  };

  const handleResizerPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!splitDragRef.current.active) return;
    splitDragRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if not captured
    }
    try {
      localStorage.setItem("dc-right-dock-split", String(splitDragRef.current.latestPct));
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <aside
      ref={dockRef}
      className="dc-right-dock"
      aria-label="Layers and Properties"
      style={{
        gridTemplateRows: `minmax(156px, ${layersSplitPct}%) 6px minmax(160px, 1fr)`,
      }}
    >
      {/* Top Half: Scoped & Collapsible Floor-Aware Layer Stack */}
      <section className="dc-dock-section">
        <div className="dc-section-head">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <Layers size={13} style={{ flexShrink: 0 }} />
            <span>Layers</span>
            <span className="dc-section-count-badge">
              {doc.mode !== "world" && filterLayersByFloor && !normalizedLayerQuery
                ? activeFloorLayers.length
                : displayLayers.length}
            </span>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            {doc.mode !== "world" && (
              <button
                type="button"
                className={`dc-mini-icon-btn ${lockLowerFloors ? "accent-cyan" : ""}`}
                title={
                  lockLowerFloors
                    ? "Lower Floors Protected — Only active floor items can be clicked on canvas. Click to allow cross-floor picking."
                    : "Cross-Floor Picking Enabled — Clicking empty space may select visible items on lower floors. Click to lock lower floors."
                }
                aria-label="Toggle Lower Floor Click Protection"
                aria-pressed={lockLowerFloors}
                onClick={() => {
                  const next = !lockLowerFloors;
                  st.setLockLowerFloors(next);
                  st.pushToast(
                    next
                      ? "Lower floors protected from accidental clicks"
                      : "Lower floors unlocked for cross-floor selection",
                  );
                }}
              >
                <Shield size={12} />
              </button>
            )}
            <button
              type="button"
              className={`dc-mini-icon-btn ${layerSearchOpen || normalizedLayerQuery ? "accent-gold" : ""}`}
              title="Filter layers by name, type, or floor"
              aria-label="Filter Layers"
              aria-pressed={layerSearchOpen}
              onClick={() => {
                setLayerSearchOpen((prev) => {
                  const next = !prev;
                  if (!next) setLayerSearch("");
                  else requestAnimationFrame(() => layerSearchInputRef.current?.focus());
                  return next;
                });
              }}
            >
              <Search size={12} />
            </button>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Move Active Layer Up (Within Current Floor)"
              aria-label="Move Layer Up"
              onClick={() => st.reorderLayer(activeLayer.id, "up")}
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Move Active Layer Down (Within Current Floor)"
              aria-label="Move Layer Down"
              onClick={() => st.reorderLayer(activeLayer.id, "down")}
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title={`Add Layer to ${activeLevel?.shortCode ?? "Active Floor"} or Add New Floor`}
              aria-label="Add Layer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const sc = activeLevel?.shortCode ?? "1F";
                const lvlId = activeLevel?.id ?? "lvl-ground";
                onOpenContextMenu(rect.left - 210, rect.bottom + 4, "Add Layer / Level", [
                  {
                    type: "item",
                    id: "add-cur-obj",
                    label: `New ${sc} Props Layer`,
                    onSelect: () =>
                      st.addLayer("objects", getNextDefaultLayerName(doc, "objects", lvlId), false, lvlId),
                  },
                  {
                    type: "item",
                    id: "add-cur-water",
                    label: `New ${sc} Water Layer`,
                    onSelect: () =>
                      st.addLayer("water", getNextDefaultLayerName(doc, "water", lvlId), false, lvlId),
                  },
                  {
                    type: "item",
                    id: "add-cur-caves",
                    label: `New ${sc} Caves & Dungeons Layer`,
                    onSelect: () =>
                      st.addLayer("caves", getNextDefaultLayerName(doc, "caves", lvlId), false, lvlId),
                  },
                  {
                    type: "item",
                    id: "add-cur-wall",
                    label: `New ${sc} Walls & Doors Layer`,
                    onSelect: () =>
                      st.addLayer("walls", getNextDefaultLayerName(doc, "walls", lvlId), false, lvlId),
                  },
                  {
                    type: "item",
                    id: "add-cur-path",
                    label: `New ${sc} Lines / Paths Layer`,
                    onSelect: () =>
                      st.addLayer("paths", getNextDefaultLayerName(doc, "paths", lvlId), false, lvlId),
                  },
                  {
                    type: "item",
                    id: "add-cur-roofs",
                    label: `New ${sc} Roofs Layer`,
                    onSelect: () =>
                      st.addLayer("roofs", getNextDefaultLayerName(doc, "roofs", lvlId), false, lvlId),
                  },
                  {
                    type: "item",
                    id: "add-cur-terr",
                    label: `New ${sc} Floor / Terrain Layer`,
                    onSelect: () =>
                      st.addLayer("terrain", getNextDefaultLayerName(doc, "terrain", lvlId), false, lvlId),
                  },
                  {
                    type: "item",
                    id: "add-cur-scatter",
                    label: `New ${sc} Scatter Foliage Layer`,
                    onSelect: () =>
                      st.addLayer(
                        "scatter_zone",
                        getNextDefaultLayerName(doc, "scatter_zone", lvlId),
                        false,
                        lvlId,
                      ),
                  },
                  {
                    type: "item",
                    id: "add-cur-lights",
                    label: `New ${sc} Lights Layer`,
                    onSelect: () =>
                      st.addLayer("lights", getNextDefaultLayerName(doc, "lights", lvlId), false, lvlId),
                  },
                  {
                    type: "item",
                    id: "add-cur-dm",
                    label: `New ${sc} DM Notes Layer (DM-Only)`,
                    onSelect: () =>
                      st.addLayer("dm_notes", getNextDefaultLayerName(doc, "dm_notes", lvlId), true, lvlId),
                  },
                  { type: "separator" },
                  {
                    type: "item",
                    id: "add-flr-sky",
                    label: "+ Add New Sky Level (Sky 1, Sky 2, Sky 3…)",
                    onSelect: () => st.addSkyLevel(),
                  },
                  {
                    type: "item",
                    id: "add-flr-up",
                    label: "+ Add New Upper Floor Above (2F, 3F, 4F…)",
                    onSelect: () => st.addLevelAbove("upper"),
                  },
                  {
                    type: "item",
                    id: "add-flr-sub",
                    label: "+ Add New Underground Level Below (B1, B2…)",
                    onSelect: () => st.addLevelBelow(),
                  },
                ]);
              }}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Segmented Floor Scope Switcher (Battlemap mode only) */}
        {doc.mode !== "world" && (
          <div className="dc-layer-scope-bar">
            <div className="dc-layer-scope-seg" role="tablist" aria-label="Layer Floor Scope">
              <button
                type="button"
                role="tab"
                aria-selected={filterLayersByFloor}
                className={`dc-layer-scope-btn ${filterLayersByFloor ? "active" : ""}`}
                onClick={() => st.setFilterLayersByFloor(true)}
                title={`Show only layers on active floor (${activeLevel?.shortCode ?? "1F"})`}
              >
                {activeLevel?.shortCode ?? "1F"} Only ({activeFloorLayers.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!filterLayersByFloor}
                className={`dc-layer-scope-btn ${!filterLayersByFloor ? "active" : ""}`}
                onClick={() => st.setFilterLayersByFloor(false)}
                title="Browse all floors grouped in collapsible elevation sections"
              >
                All Floors ({doc.levels.length})
              </button>
            </div>
            {!filterLayersByFloor && (
              <button
                type="button"
                className="dc-mini-icon-btn"
                title={allFloorsExpanded ? "Collapse other floors" : "Expand all floors"}
                aria-label={allFloorsExpanded ? "Collapse other floors" : "Expand all floors"}
                onClick={toggleAllAccordions}
              >
                {allFloorsExpanded ? <ChevronsDownUp size={12} /> : <ChevronsUpDown size={12} />}
              </button>
            )}
          </div>
        )}

        {/* Optional Layer Search Filter */}
        {(layerSearchOpen || normalizedLayerQuery.length > 0) && (
          <div className="dc-layer-search-bar">
            <input
              ref={layerSearchInputRef}
              type="search"
              className="dc-input dc-layer-search-input"
              placeholder="Filter layers by name, type, or floor…"
              aria-label="Filter layers"
              value={layerSearch}
              onChange={(e) => setLayerSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setLayerSearch("");
                  setLayerSearchOpen(false);
                }
              }}
            />
            {layerSearch && (
              <button
                type="button"
                className="dc-mini-icon-btn"
                title="Clear layer filter"
                aria-label="Clear layer filter"
                onClick={() => setLayerSearch("")}
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Active Layer Context & Compositing Strip */}
        <div className="dc-active-layer-strip">
          <div className="dc-active-layer-identity">
            <span
              className="dc-layer-kind-icon"
              style={{
                width: 18,
                height: 18,
                color: activeLayerMeta.color,
                background: `${activeLayerMeta.color}1A`,
                borderColor: `${activeLayerMeta.color}44`,
              }}
              aria-hidden="true"
            >
              {renderLayerKindIcon(activeLayer.kind)}
            </span>
            <span className="dc-active-layer-title" title={activeLayer.name}>
              {activeLayer.name}
            </span>
            {soloLayerId === activeLayer.id && (
              <button
                type="button"
                className="dc-layer-solo-pill"
                title="Soloed — Click to restore floor visibility"
                onClick={() => st.soloLayer(activeLayer.id)}
              >
                SOLO
              </button>
            )}
            {doc.mode !== "world" && (
              <button
                type="button"
                className="dc-active-floor-btn"
                style={{
                  borderColor: `${activeLayerFloorColors.col}60`,
                  background: activeLayerFloorColors.bg,
                  color: activeLayerFloorColors.col,
                }}
                title={`Active layer is on ${activeLayerLevel?.shortCode ?? "1F"} (${activeLayerLevel?.name ?? "Ground"}) · Click to move layer to another floor`}
                aria-label={`Move ${activeLayer.name} to another floor`}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  openMoveLayerFloorMenu(rect.left - 140, rect.bottom + 4, activeLayer);
                }}
              >
                <span>{activeLayerFloorColors.text}</span>
                <ChevronDown size={10} />
              </button>
            )}
          </div>

          <div className="dc-active-layer-compositing">
            <select
              className="dc-select dc-blend-select"
              aria-label="Layer Blend Mode"
              value={activeLayer.blendMode}
              onChange={(e) =>
                st.setLayerBlendMode(activeLayer.id, e.target.value as BlendModeName)
              }
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="add">Add (Glow)</option>
              <option value="darken">Darken</option>
            </select>
            <span className="dc-field-label dc-opacity-readout">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
            <input
              type="range"
              className="dc-range"
              style={{ width: 68 }}
              min={0}
              max={1}
              step={0.05}
              aria-label="Layer Opacity"
              value={activeLayer.opacity}
              onChange={(e) => st.setLayerOpacity(activeLayer.id, Number(e.target.value))}
            />
          </div>
        </div>

        <div ref={layerListRef} className="dc-section-body dc-scroll">
          {doc.mode === "world" || (filterLayersByFloor && !normalizedLayerQuery) ? (
            displayLayers.length > 0 ? (
              displayLayers.map((layer) => renderLayerRow(layer, false))
            ) : (
              <div className="dc-layer-empty-state">
                <span>No layers on {activeLevel?.shortCode ?? "this floor"} yet.</span>
                <button
                  type="button"
                  className="dc-btn"
                  style={{ height: 24, fontSize: 11, padding: "0 10px" }}
                  onClick={() =>
                    st.addLayer(
                      "objects",
                      getNextDefaultLayerName(doc, "objects", activeLevel?.id ?? "lvl-ground"),
                      false,
                      activeLevel?.id,
                    )
                  }
                >
                  <Plus size={11} /> Add Props Layer
                </button>
              </div>
            )
          ) : (
            sortedLevels.map((lv) => {
              const allOnFloor = [...doc.layers].reverse().filter((l) => l.levelId === lv.id);
              const floorRows = normalizedLayerQuery
                ? allOnFloor.filter(matchesLayerQuery)
                : allOnFloor;
              if (normalizedLayerQuery && floorRows.length === 0) return null;
              const isCurrentFloor = lv.id === doc.activeLevelId;
              const isOpen = normalizedLayerQuery ? true : Boolean(openFloorIds[lv.id]);
              const isFloorDrop =
                Boolean(draggingLayerId) &&
                layerDropTarget?.kind === "floor" &&
                layerDropTarget.targetLevelId === lv.id;
              const sum = summarizeLevel(doc, lv.id);
              const colors = getFloorBadgeColors(lv);
              const elevLabel = lv.elevationFt > 0 ? `+${lv.elevationFt}ft` : `${lv.elevationFt}ft`;

              return (
                <details
                  key={lv.id}
                  className={`dc-floor-group ${isCurrentFloor ? "current-floor" : ""}`}
                  open={isOpen}
                  onToggle={(e) => {
                    if (normalizedLayerQuery) return;
                    const nextOpen = (e.currentTarget as HTMLDetailsElement).open;
                    setOpenFloorIds((prev) =>
                      prev[lv.id] === nextOpen ? prev : { ...prev, [lv.id]: nextOpen },
                    );
                  }}
                >
                  <summary
                    className={`dc-floor-group-summary ${isFloorDrop ? "drop-floor" : ""}`}
                    data-floor-drop-id={lv.id}
                  >
                    <ChevronRight size={12} className="dc-floor-chevron" aria-hidden="true" />
                    <button
                      type="button"
                      className="dc-floor-code-pill"
                      style={{
                        borderColor: `${colors.col}66`,
                        background: colors.bg,
                        color: colors.col,
                      }}
                      title={`Switch active floor to ${lv.shortCode} · ${lv.name} (${elevLabel})`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        st.selectLevel(lv.id);
                      }}
                    >
                      {lv.shortCode}
                    </button>
                    <span
                      className="dc-floor-group-name"
                      title={`${lv.name} (${elevLabel}) · ${sum.layerCount} layers · ${sum.totalEntities} items`}
                    >
                      {lv.name}
                    </span>
                    <span
                      className="dc-floor-group-meta"
                      title={`${sum.layerCount} layers · ${sum.totalEntities} items`}
                    >
                      {sum.totalEntities}
                    </span>
                    <button
                      type="button"
                      className="dc-mini-icon-btn"
                      style={{ width: 20, height: 20 }}
                      title={
                        sum.allVisible
                          ? `Hide all ${lv.shortCode} layers`
                          : `Show all ${lv.shortCode} layers`
                      }
                      aria-label={`Toggle all ${lv.shortCode} layers visibility`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        st.toggleLevelLayersVisible(lv.id);
                      }}
                    >
                      {sum.visibleLayerCount > 0 ? (
                        <Eye size={12} style={{ opacity: sum.allVisible ? 1 : 0.6 }} />
                      ) : (
                        <EyeOff size={12} style={{ opacity: 0.38 }} />
                      )}
                    </button>
                    <button
                      type="button"
                      className="dc-mini-icon-btn"
                      style={{ width: 20, height: 20 }}
                      title={
                        sum.allLocked
                          ? `Unlock all ${lv.shortCode} layers`
                          : `Lock all ${lv.shortCode} layers`
                      }
                      aria-label={`Toggle all ${lv.shortCode} layers lock`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        st.toggleLevelLayersLocked(lv.id);
                      }}
                    >
                      {sum.allLocked ? (
                        <Lock size={11} />
                      ) : (
                        <Unlock size={11} style={{ opacity: 0.35 }} />
                      )}
                    </button>
                  </summary>
                  <div className="dc-floor-group-body">
                    {floorRows.length > 0 ? (
                      floorRows.map((layer) => renderLayerRow(layer, false))
                    ) : (
                      <div className="dc-floor-group-empty">No layers on {lv.shortCode}</div>
                    )}
                  </div>
                </details>
              );
            })
          )}
        </div>
      </section>

      {/* Draggable Horizontal Split Handle between Layers and Properties */}
      <div
        className="dc-dock-resizer"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize Layers and Properties panels"
        title="Drag to resize Layers & Properties · Double-click to reset"
        onPointerDown={handleResizerPointerDown}
        onPointerMove={handleResizerPointerMove}
        onPointerUp={handleResizerPointerUp}
        onPointerCancel={handleResizerPointerUp}
        onDoubleClick={() => {
          setLayersSplitPct(46);
          try {
            localStorage.setItem("dc-right-dock-split", "46");
          } catch {
            // Ignore storage errors
          }
        }}
      >
        <span className="dc-dock-resizer-grip" aria-hidden="true" />
      </div>

      {/* Bottom Half: Context-Sensitive Properties & Atmosphere Inspector */}
      <section className="dc-dock-section">
        <div className="dc-section-head">
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {activeTool === "light" && !selectedObject && !selectedScatter && !selectedWall && !selectedPath && !selectedRoof && !selectedPortal && !selectedDmNote && !selectedCaveEntrance && !selectedWater ? (
              <Sun size={13} style={{ flexShrink: 0, color: "var(--accent-gold)" }} />
            ) : (activeTool === "cave" && !selectedObject && !selectedLight && !selectedScatter && !selectedWall && !selectedPath && !selectedRoof && !selectedPortal && !selectedDmNote && !selectedWater) || selectedCaveEntrance ? (
              <Mountain size={13} style={{ flexShrink: 0, color: "#6EE7B7" }} />
            ) : (activeTool === "water" && !selectedObject && !selectedLight && !selectedScatter && !selectedWall && !selectedPath && !selectedRoof && !selectedPortal && !selectedDmNote && !selectedCaveEntrance) || selectedWater ? (
              <Droplets size={13} style={{ flexShrink: 0, color: "#38BDF8" }} />
            ) : (activeTool === "roof" && !selectedObject && !selectedLight && !selectedScatter && !selectedWall && !selectedPath && !selectedPortal && !selectedDmNote && !selectedCaveEntrance && !selectedWater) || selectedRoof ? (
              <Home size={13} style={{ flexShrink: 0, color: "#FB923C" }} />
            ) : (
              <Sliders size={13} style={{ flexShrink: 0 }} />
            )}
            {selectedObject
              ? "Prop Inspector"
              : selectedLight
                ? "Light Inspector"
                : selectedCaveEntrance
                  ? "Cave / Dungeon Entrance"
                  : selectedWater
                    ? "Water Studio Inspector"
                    : selectedRoof
                      ? "Roof Studio Inspector"
                      : selectedScatter
                        ? "Scatter Zone"
                        : selectedWall
                          ? "Edit Placed Wall"
                          : selectedPath
                            ? "Edit Placed Line"
                            : selectedPortal
                              ? "Edit Door / Window"
                              : selectedDmNote
                                ? "Edit DM Secret Note"
                                : activeTool === "light"
                                  ? "Lighting & Atmosphere"
                                  : activeTool === "cave"
                                    ? "Cave & Dungeon Studio"
                                    : activeTool === "wall"
                                      ? "Wall Tool & Style"
                                      : activeTool === "path"
                                        ? "Line / Path Style"
                                        : activeTool === "roof"
                                          ? "Roof Studio"
                                          : activeTool === "portal"
                                            ? "Door & Window Style"
                                            : activeTool === "terrain"
                                              ? "Terrain Brush Style"
                                              : activeTool === "stamp"
                                                ? "Stamp Tool & Brush"
                                                : activeTool === "template"
                                                  ? "Object Templates"
                                                  : activeTool === "scatter"
                                                    ? "Scatter Zone Tool"
                                                    : activeTool === "water"
                                                      ? "Water Studio"
                                                      : activeTool === "dm_note"
                                                        ? "DM Note Tool"
                                                        : activeTool === "measure"
                                                          ? doc.mode === "world"
                                                            ? "Overland Travel Ruler"
                                                            : "Tactical Ruler"
                                                          : doc.mode === "world"
                                                            ? activeTool === "world_land"
                                                              ? "Landmass & Coastlines"
                                                              : activeTool === "world_biome"
                                                                ? "Biome Ground Painter"
                                                                : activeTool === "world_river"
                                                                  ? "Meandering Rivers"
                                                                  : activeTool === "world_trail"
                                                                    ? "Trails & Sea Lanes"
                                                                    : activeTool === "world_region"
                                                                      ? "Political Realms"
                                                                      : activeTool === "world_label"
                                                                        ? "Labels & Name Gen"
                                                                        : activeTool === "world_crop"
                                                                          ? "Detail Region Crop"
                                                                          : "World Atlas Studio"
                                                            : "Canvas & Grid"}
          </span>
          <button
            type="button"
            onClick={() => st.toggleSnapEnabled()}
            title="Click to toggle Grid Snapping ON / OFF (or hold Alt while dragging)"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: snapMode === "free" ? "var(--text-muted)" : "var(--accent-gold)",
              background: snapMode === "free" ? "var(--bg-panel)" : "var(--accent-gold-soft)",
              border: `1px solid ${snapMode === "free" ? "var(--border-subtle)" : "rgba(229, 169, 60, 0.4)"}`,
              borderRadius: 4,
              padding: "2px 6px",
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            {snapMode === "free" ? "NO SNAP" : `${snapMode.toUpperCase()} SNAP`}
          </button>
        </div>

        <div className="dc-section-body dc-scroll">
          {/* Unified Selected Item Identity Card (always tells you the exact object/type/layer selected!) */}
          {(() => {
            const selInfo = describeSelection(doc, selection, vaultById);
            if (!selInfo) return null;
            return (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 8px",
                  marginBottom: 9,
                  borderRadius: 7,
                  background: "rgba(15, 20, 30, 0.78)",
                  border: `1px solid ${selInfo.accentHex}55`,
                }}
              >
                {selInfo.thumbUrl ? (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 5,
                      background: "#0B0E14",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={selInfo.thumbUrl}
                      alt=""
                      style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      background: `${selInfo.accentHex}22`,
                      border: `1px solid ${selInfo.accentHex}66`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: selInfo.accentHex,
                      }}
                    />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        fontFamily: "var(--font-mono)",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        color: selInfo.accentHex,
                        background: `${selInfo.accentHex}1F`,
                        border: `1px solid ${selInfo.accentHex}55`,
                        borderRadius: 4,
                        padding: "0px 5px",
                      }}
                    >
                      {selInfo.typeLabel}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {selInfo.floorCode}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={selInfo.name}
                  >
                    {selInfo.name}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={`${selInfo.subtitle} · Layer: ${selInfo.layerName}`}
                  >
                    {selInfo.subtitle}
                  </div>
                </div>
                <button
                  type="button"
                  className="dc-mini-icon-btn"
                  title="Deselect (Esc)"
                  aria-label="Deselect"
                  onClick={() => st.setSelection(null)}
                  style={{ flexShrink: 0 }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })()}

          {/* Selected Object Stamp Properties + Live RGB Recolor */}
          {selectedObject && selection && (() => {
            const objMeta = vaultById.get(selectedObject.assetId);
            const natAspect =
              objMeta && objMeta.widthPx > 0 && objMeta.heightPx > 0
                ? objMeta.widthPx / objMeta.heightPx
                : null;
            const curAspect = selectedObject.widthCells / Math.max(0.05, selectedObject.heightCells);
            const isStretched =
              natAspect !== null &&
              Math.max(curAspect / natAspect, natAspect / curAspect) > 1.08;
            return (
            <div>
              <div className="dc-field-row">
                <span className="dc-field-label">Width × Height (sq)</span>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {selectedObject.widthCells.toFixed(1)} × {selectedObject.heightCells.toFixed(1)}
                  </span>
                  {isStretched && natAspect !== null && (
                    <button
                      type="button"
                      className="dc-chip active"
                      style={{ fontSize: 9.5, padding: "1px 6px", height: 20 }}
                      title="Restore this prop's true natural aspect ratio"
                      onClick={() => {
                        const area = selectedObject.widthCells * selectedObject.heightCells;
                        const nextW = Math.max(0.35, Math.min(24, Math.sqrt(area * natAspect)));
                        const nextH = Math.max(0.35, Math.min(24, nextW / natAspect));
                        st.updateObjectStamp(
                          selection.layerId,
                          selection.id,
                          { widthCells: Number(nextW.toFixed(2)), heightCells: Number(nextH.toFixed(2)) },
                          true,
                        );
                      }}
                    >
                      Reset Ratio
                    </button>
                  )}
                </div>
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">Scale (Ratio Locked)</span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 118 }}
                  min={doc.mode === "world" ? 0.16 : 0.35}
                  max={10}
                  step={doc.mode === "world" ? 0.04 : 0.1}
                  value={Math.min(10, selectedObject.widthCells)}
                  onPointerDown={() => st.checkpointHistory()}
                  onChange={(e) => {
                    const nextW = Number(e.target.value);
                    const ratio = selectedObject.heightCells / Math.max(0.1, selectedObject.widthCells);
                    st.updateObjectStamp(selection.layerId, selection.id, {
                      widthCells: nextW,
                      heightCells: nextW * ratio,
                    });
                  }}
                />
              </div>
              {selectedObject.importedSourceRef && (() => {
                const srcRef = selectedObject.importedSourceRef;
                let matchCount = 0;
                for (const lyr of doc.layers) {
                  for (const o of lyr.objects ?? []) {
                    if (o.importedSourceRef === srcRef) matchCount++;
                  }
                }
                const activeVaultAsset = selectedVaultAssetId
                  ? vaultById.get(selectedVaultAssetId)
                  : undefined;
                return (
                  <div
                    style={{
                      marginBottom: 8,
                      padding: "7px 8px",
                      borderRadius: 7,
                      background: "rgba(56, 189, 248, 0.08)",
                      border: "1px solid rgba(56, 189, 248, 0.28)",
                      fontSize: 10.5,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#7DD3FC",
                        marginBottom: 4,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={srcRef}
                    >
                      Imported: {cleanSourceRefLabel(srcRef)} ({matchCount}×)
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="dc-btn dc-btn-ghost"
                        style={{ flex: 1, height: 24, fontSize: 10, padding: "0 6px" }}
                        disabled={!activeVaultAsset}
                        title={
                          activeVaultAsset
                            ? `Replace all ${matchCount} instances with ${activeVaultAsset.displayName}`
                            : "Select a replacement asset in the Asset Vault first"
                        }
                        onClick={() => {
                          if (!activeVaultAsset) return;
                          st.bulkSwapImportedAsset(srcRef, activeVaultAsset.id, allVaultAssets, false);
                        }}
                      >
                        Swap All {matchCount}× to Vault Pick
                      </button>
                      {doc.mode === "world" && (
                        <button
                          type="button"
                          className="dc-btn dc-btn-ghost"
                          style={{ height: 24, fontSize: 10, padding: "0 6px" }}
                          disabled={!activeVaultAsset}
                          title="Replace all matching instances while spreading across the selected asset's species variants"
                          onClick={() => {
                            if (!activeVaultAsset) return;
                            st.bulkSwapImportedAsset(srcRef, activeVaultAsset.id, allVaultAssets, true);
                          }}
                        >
                          + Spread
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
              <div
                style={{
                  fontSize: 10,
                  color: "var(--text-muted)",
                  marginTop: -2,
                  marginBottom: 6,
                }}
              >
                Drag corner handles to scale in ratio · Hold <strong style={{ color: "var(--text-secondary)" }}>Shift</strong> + drag corner to stretch
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">
                  Rotation ({Math.round((((selectedObject.rotationRad * 180) / Math.PI) % 360 + 360) % 360)}°)
                </span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 118 }}
                  min={-180}
                  max={180}
                  step={5}
                  value={
                    ((((Math.round((selectedObject.rotationRad * 180) / Math.PI) + 180) % 360) + 360) %
                      360) -
                    180
                  }
                  onPointerDown={() => st.checkpointHistory()}
                  onChange={(e) =>
                    st.updateObjectStamp(selection.layerId, selection.id, {
                      rotationRad: (Number(e.target.value) * Math.PI) / 180,
                    })
                  }
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <ColorStudioPanel
                  recolor={selectedObject.recolor}
                  asset={vaultById.get(selectedObject.assetId)}
                  eyedropperTarget="selection"
                  title="Prop Color & Shader"
                  compact
                  onChange={(next, rec) =>
                    st.updateObjectStamp(selection.layerId, selection.id, { recolor: next }, rec)
                  }
                  onCopyStyle={() => st.copySelectedRecolor()}
                  onPasteStyle={() => st.pasteRecolorToSelected()}
                  hasCopiedStyle={Boolean(copiedRecolor)}
                  onApplyToAllMatching={() =>
                    st.applyRecolorToMatchingObjects(
                      selection.layerId,
                      selectedObject.assetId,
                      selectedObject.recolor,
                    )
                  }
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="dc-btn"
                  style={{ flex: 1 }}
                  onClick={() => st.duplicateSelection()}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="dc-btn"
                  style={{ flex: 1, color: "#fca5a5" }}
                  onClick={() => st.deleteSelection()}
                >
                  Delete
                </button>
              </div>
            </div>
            );
          })()}

          {/* Selected 2D Raycast Light Inspector */}
          {selectedLight && selection && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  fontSize: 10,
                  color: "var(--text-secondary)",
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "5px 8px",
                }}
              >
                <span>
                  Drag bulb to move · Drag cyan ring slider for cone angle · Drag gold knob for radius
                  {selectedLight.coneAngleDeg < 360 ? " · Drag cyan arrow to aim" : ""}
                </span>
                <button
                  type="button"
                  className="dc-chip"
                  style={{ height: 20, fontSize: 10, flexShrink: 0 }}
                  onClick={() => st.setSelection(null)}
                  title="Deselect light and return to Lighting & Atmosphere"
                >
                  All Lights
                </button>
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Name</span>
                <input
                  type="text"
                  className="dc-input"
                  style={{ width: 158, height: 24, fontSize: 11 }}
                  value={selectedLight.name}
                  onChange={(e) =>
                    st.updateLight(selection.layerId, selection.id, { name: e.target.value })
                  }
                />
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Light Color</span>
                <input
                  type="color"
                  value={selectedLight.colorHex}
                  onChange={(e) =>
                    st.updateLight(selection.layerId, selection.id, { colorHex: e.target.value })
                  }
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                {LIGHT_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    type="button"
                    title={sw.label}
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: sw.hex,
                      border:
                        selectedLight.colorHex.toUpperCase() === sw.hex
                          ? "2px solid #fff"
                          : "1px solid var(--border-strong)",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      st.updateLight(selection.layerId, selection.id, { colorHex: sw.hex }, true)
                    }
                  />
                ))}
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Intensity ({selectedLight.intensity.toFixed(2)})</span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 126 }}
                  min={0.1}
                  max={2}
                  step={0.05}
                  value={selectedLight.intensity}
                  onChange={(e) =>
                    st.updateLight(selection.layerId, selection.id, {
                      intensity: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Radius ({selectedLight.radiusCells.toFixed(1)} sq)</span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 126 }}
                  min={1}
                  max={24}
                  step={0.5}
                  value={selectedLight.radiusCells}
                  onChange={(e) =>
                    st.updateLight(selection.layerId, selection.id, {
                      radiusCells: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Beam Cone ({selectedLight.coneAngleDeg}°)</span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 126 }}
                  min={20}
                  max={360}
                  step={5}
                  value={selectedLight.coneAngleDeg}
                  onChange={(e) =>
                    st.updateLight(selection.layerId, selection.id, {
                      coneAngleDeg: Number(e.target.value),
                    })
                  }
                />
              </div>
              {selectedLight.coneAngleDeg < 360 && (
                <div className="dc-field-row" style={{ marginBottom: 0 }}>
                  <span className="dc-field-label">
                    Beam Aim ({Math.round(((selectedLight.directionRad * 180) / Math.PI + 360) % 360)}°)
                  </span>
                  <input
                    type="range"
                    className="dc-range"
                    style={{ width: 126 }}
                    min={0}
                    max={355}
                    step={5}
                    value={Math.round(((selectedLight.directionRad * 180) / Math.PI + 360) % 360)}
                    onChange={(e) =>
                      st.updateLight(selection.layerId, selection.id, {
                        directionRad: (Number(e.target.value) * Math.PI) / 180,
                      })
                    }
                  />
                </div>
              )}
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Cast 2D Shadows</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedLight.castShadows}
                  className="dc-switch"
                  onClick={() =>
                    st.updateLight(
                      selection.layerId,
                      selection.id,
                      { castShadows: !selectedLight.castShadows },
                      true,
                    )
                  }
                />
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Torch / Arcane Flicker</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedLight.flicker}
                  className="dc-switch"
                  onClick={() =>
                    st.updateLight(
                      selection.layerId,
                      selection.id,
                      { flicker: !selectedLight.flicker },
                      true,
                    )
                  }
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                <button
                  type="button"
                  className="dc-btn"
                  style={{ flex: 1, fontSize: 11, height: 28 }}
                  onClick={() => st.duplicateSelection()}
                >
                  <Copy size={12} />
                  <span>Duplicate</span>
                </button>
                <button
                  type="button"
                  className="dc-btn"
                  style={{
                    flex: 1,
                    fontSize: 11,
                    height: 28,
                    color: "#fca5a5",
                    borderColor: "rgba(239, 68, 68, 0.45)",
                  }}
                  onClick={() => st.deleteSelection()}
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </div>

              {/* Compact collapsible Scene Atmosphere inside Light Inspector */}
              <details
                style={{
                  marginTop: 4,
                  paddingTop: 6,
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <summary
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--accent-gold)",
                    cursor: "pointer",
                    marginBottom: 6,
                    userSelect: "none",
                  }}
                >
                  Scene Atmosphere ({Math.round(doc.lighting.ambientIntensity * 100)}%)
                </summary>
                {renderSceneAtmosphereFields()}
              </details>
            </div>
          )}

          {/* Selected Smart Scatter Zone Inspector */}
          {selectedScatter && selection && (
            <ScatterZonePanel
              mode="edit"
              name={selectedScatter.name}
              assetIds={selectedScatter.assetIds}
              minSpacingCells={selectedScatter.minSpacingCells}
              minScale={selectedScatter.minScale}
              maxScale={selectedScatter.maxScale}
              avoidWalls={selectedScatter.avoidWalls}
              avoidPaths={selectedScatter.avoidPaths}
              placedCount={selectedScatter.placements.length}
              seed={selectedScatter.seed}
              onChangeName={(name) =>
                st.updateScatterZone(selection.layerId, selection.id, { name }, false, false)
              }
              onChangeAssets={(nextIds, presetLabel) =>
                st.updateScatterZone(
                  selection.layerId,
                  selection.id,
                  {
                    assetIds: nextIds,
                    ...(presetLabel ? { name: presetLabel } : {}),
                  },
                  true,
                  true,
                )
              }
              onChangeSettings={(partial) =>
                st.updateScatterZone(selection.layerId, selection.id, partial, true, true)
              }
              onReseed={() => {
                st.reseedScatterZone(selection.layerId, selection.id);
                st.pushToast("Re-seeded Smart Scatter Zone", "success");
              }}
              onDelete={() => st.deleteSelection()}
            />
          )}

          {/* Selected Placed Wall Inspector */}
          {selectedWall && selection && (() => {
            const segCount = getWallSegmentCount(selectedWall.points, selectedWall.closed);
            const recentFloors = recentTerrainAssetIds
              .map((id) => ({
                id,
                asset: vaultById.get(id),
                url: resolveAssetUrl(id, vaultById),
                name:
                  vaultById.get(id)?.displayName ??
                  id.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/_/g, " ") ??
                  "Floor",
              }))
              .slice(0, 3);

            return (
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text-secondary)",
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ color: "var(--accent-gold)" }}>
                  {selectedWall.points.length} corners · {segCount} section{segCount === 1 ? "" : "s"}
                </strong>{" "}
                · Click any wall face or <strong>Shift+Drag / Double-Click +</strong> to curve 1 section ·{" "}
                <strong>Drag +</strong> to add corner · <strong>Alt+Click</strong> dot to remove.
              </div>

              {/* Per-Section Straight <-> Curved Editor Card */}
              <div style={{ marginBottom: 8 }}>
                <SectionCurveEditorCard
                  selection={selection}
                  points={selectedWall.points}
                  closed={selectedWall.closed}
                  curved={selectedWall.curved}
                  segmentCurves={selectedWall.segmentCurves}
                  sectionNoun="Section"
                  wholeNoun="Whole Wall"
                />
              </div>

              {/* Room Interior Fill + Last 3 Floors Used — surfaced ABOVE the 169-style material grid for instant 1-click access! */}
              {selectedWall.points.length >= 3 && (
                <div
                  style={{
                    padding: "6px 7px",
                    borderRadius: 6,
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--accent-gold)",
                      marginBottom: 5,
                    }}
                  >
                    Room Floor Fill · Last 3 Used
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {recentFloors.map((rf) => {
                      const isAct = rf.id === activeTerrainAssetId;
                      return (
                        <button
                          key={rf.id}
                          type="button"
                          className={`dc-chip ${isAct ? "active" : ""}`}
                          style={{
                            width: "100%",
                            height: 25,
                            padding: "0 7px",
                            gap: 7,
                            justifyContent: "space-between",
                            fontSize: 10.5,
                            overflow: "hidden",
                          }}
                          title={`Fill room interior with ${rf.name}`}
                          onClick={() => {
                            const ok = st.fillWallInterior(selection.layerId, selection.id, rf.id);
                            if (ok) {
                              st.pushToast(`Filled room interior with ${rf.name}`, "success");
                            }
                          }}
                        >
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 7,
                              minWidth: 0,
                              flex: 1,
                              overflow: "hidden",
                            }}
                          >
                            <img
                              src={rf.url}
                              alt=""
                              style={{
                                width: 16,
                                height: 16,
                                borderRadius: 3,
                                objectFit: "cover",
                                border: "1px solid rgba(255,255,255,0.22)",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {rf.name}
                            </span>
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              opacity: isAct ? 0.95 : 0.65,
                              flexShrink: 0,
                            }}
                          >
                            {isAct ? "FILL" : "Use"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {renderMaterialPicker("Change Wall Material", wallAssets, selectedWall.assetId, (id) =>
                st.updateWall(selection.layerId, selection.id, { assetId: id }, true),
              )}
              <div className="dc-field-row">
                <span className="dc-field-label">
                  Thickness ({selectedWall.thicknessCells.toFixed(2)} sq)
                </span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 118 }}
                  min={0.16}
                  max={0.85}
                  step={0.02}
                  value={selectedWall.thicknessCells}
                  onChange={(e) =>
                    st.updateWall(selection.layerId, selection.id, {
                      thicknessCells: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">Closed Room Loop</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedWall.closed}
                  className="dc-switch"
                  onClick={() =>
                    st.updateWall(
                      selection.layerId,
                      selection.id,
                      { closed: !selectedWall.closed },
                      true,
                    )
                  }
                />
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">Blocks Light &amp; VTT Sight</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedWall.blocksLight}
                  className="dc-switch"
                  onClick={() =>
                    st.updateWall(
                      selection.layerId,
                      selection.id,
                      { blocksLight: !selectedWall.blocksLight },
                      true,
                    )
                  }
                />
              </div>
              <div style={{ marginTop: 6 }}>
                <ColorStudioPanel
                  recolor={selectedWall.recolor ?? DEFAULT_RECOLOR}
                  asset={vaultById.get(selectedWall.assetId)}
                  eyedropperTarget="selection"
                  title="Colorize Wall"
                  compact
                  onChange={(next, rec) =>
                    st.updateWall(selection.layerId, selection.id, { recolor: next }, rec)
                  }
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  className="dc-btn"
                  style={{ flex: 1 }}
                  onClick={() => st.duplicateSelection(1.0, 1.0)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="dc-btn"
                  style={{ flex: 1, color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.45)" }}
                  onClick={() => st.deleteSelection()}
                >
                  Delete Wall
                </button>
              </div>
            </div>
            );
          })()}

          {/* Selected Placed Line / Spline Path Inspector */}
          {selectedPath && selection && (
            <div>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--text-secondary)",
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "6px 8px",
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}
              >
                <strong style={{ color: "var(--accent-gold)" }}>
                  {selectedPath.points.length} points · {Math.max(0, selectedPath.points.length - 1)} section
                  {selectedPath.points.length - 1 === 1 ? "" : "s"}
                </strong>{" "}
                · Click any span or <strong>Shift+Drag / Double-Click +</strong> to curve 1 section ·{" "}
                <strong>Drag +</strong> to add point · <strong>Alt+Click</strong> dot to remove.
              </div>
              <div style={{ marginBottom: 8 }}>
                <SectionCurveEditorCard
                  selection={selection}
                  points={selectedPath.points}
                  closed={false}
                  curved={selectedPath.curved !== false}
                  segmentCurves={selectedPath.segmentCurves}
                  sectionNoun="Section"
                  wholeNoun="Whole Line"
                />
              </div>
              {renderMaterialPicker("Change Line / Path Style", pathAssets, selectedPath.assetId, (id) =>
                st.updatePath(selection.layerId, selection.id, { assetId: id }, true),
              )}
              <div className="dc-field-row">
                <span className="dc-field-label">
                  Width ({selectedPath.widthCells.toFixed(2)} sq)
                </span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 118 }}
                  min={0.3}
                  max={10.0}
                  step={0.1}
                  value={selectedPath.widthCells}
                  onChange={(e) =>
                    st.updatePath(selection.layerId, selection.id, {
                      widthCells: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="dc-field-row">
                <span
                  className="dc-field-label"
                  title="Reverses uphill crest vs downhill drop side along embankments, cliffs & retaining walls"
                >
                  Flip Slope / Side
                </span>
                <button
                  type="button"
                  className={`dc-chip ${selectedPath.flipSide ? "active" : ""}`}
                  style={{ height: 22, fontSize: 10 }}
                  onClick={() =>
                    st.updatePath(
                      selection.layerId,
                      selection.id,
                      { flipSide: !selectedPath.flipSide },
                      true,
                    )
                  }
                >
                  {selectedPath.flipSide ? "Flipped (Reversed)" : "Flip Uphill ↔ Downhill"}
                </button>
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">
                  Opacity ({Math.round(selectedPath.opacity * 100)}%)
                </span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 118 }}
                  min={0.15}
                  max={1}
                  step={0.05}
                  value={selectedPath.opacity}
                  onChange={(e) =>
                    st.updatePath(selection.layerId, selection.id, {
                      opacity: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">Taper Ends</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedPath.taperEnds}
                  className="dc-switch"
                  onClick={() =>
                    st.updatePath(
                      selection.layerId,
                      selection.id,
                      { taperEnds: !selectedPath.taperEnds },
                      true,
                    )
                  }
                />
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">Fade Ends</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedPath.fadeEnds}
                  className="dc-switch"
                  onClick={() =>
                    st.updatePath(
                      selection.layerId,
                      selection.id,
                      { fadeEnds: !selectedPath.fadeEnds },
                      true,
                    )
                  }
                />
              </div>
              <div style={{ marginTop: 6 }}>
                <ColorStudioPanel
                  recolor={selectedPath.recolor ?? DEFAULT_RECOLOR}
                  asset={vaultById.get(selectedPath.assetId)}
                  eyedropperTarget="selection"
                  title="Colorize Line / Path"
                  compact
                  onChange={(next, rec) =>
                    st.updatePath(selection.layerId, selection.id, { recolor: next }, rec)
                  }
                />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button
                  type="button"
                  className="dc-btn"
                  style={{ flex: 1 }}
                  onClick={() => st.duplicateSelection(1.0, 1.0)}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="dc-btn"
                  style={{ flex: 1, color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.45)" }}
                  onClick={() => st.deleteSelection()}
                >
                  Delete Line
                </button>
              </div>
            </div>
          )}

          {/* Selected Placed Portal (Door / Window / Gate) Inspector */}
          {selectedPortal && selection && (
            <div>
              {renderMaterialPicker("Door / Window Style", portalAssets, selectedPortal.assetId, (id) =>
                st.updatePortal(selection.layerId, selection.id, { assetId: id }, true),
              )}
              <div className="dc-field-row">
                <span className="dc-field-label">
                  Opening Width ({selectedPortal.widthCells.toFixed(1)} sq)
                </span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 118 }}
                  min={0.7}
                  max={3.5}
                  step={0.1}
                  value={selectedPortal.widthCells}
                  onPointerDown={() => st.checkpointHistory()}
                  onChange={(e) =>
                    st.updatePortal(selection.layerId, selection.id, {
                      widthCells: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="dc-field-row">
                <span className="dc-field-label">Door Closed</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedPortal.closed}
                  className="dc-switch"
                  onClick={() => st.togglePortalClosed(selection.layerId, selection.id)}
                />
              </div>
              {selectedPortal.kind !== "window" && selectedPortal.kind !== "gate" && (
                <>
                  <div className="dc-field-row">
                    <span className="dc-field-label">Swing Direction (X)</span>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button
                        type="button"
                        className={`dc-chip ${!selectedPortal.swingInvert ? "active" : ""}`}
                        onClick={() =>
                          st.updatePortal(selection.layerId, selection.id, { swingInvert: false }, true)
                        }
                      >
                        Inward
                      </button>
                      <button
                        type="button"
                        className={`dc-chip ${selectedPortal.swingInvert ? "active" : ""}`}
                        onClick={() =>
                          st.updatePortal(selection.layerId, selection.id, { swingInvert: true }, true)
                        }
                      >
                        Outward
                      </button>
                    </div>
                  </div>
                  <div className="dc-field-row">
                    <span className="dc-field-label">Hinge Side (Y)</span>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button
                        type="button"
                        className={`dc-chip ${!selectedPortal.hingeFlip ? "active" : ""}`}
                        onClick={() =>
                          st.updatePortal(selection.layerId, selection.id, { hingeFlip: false }, true)
                        }
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        className={`dc-chip ${selectedPortal.hingeFlip ? "active" : ""}`}
                        onClick={() =>
                          st.updatePortal(selection.layerId, selection.id, { hingeFlip: true }, true)
                        }
                      >
                        Right
                      </button>
                    </div>
                  </div>
                </>
              )}
              <div className="dc-field-row">
                <span className="dc-field-label">Blocks Light When Closed</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedPortal.blocksLightWhenClosed}
                  className="dc-switch"
                  onClick={() =>
                    st.updatePortal(
                      selection.layerId,
                      selection.id,
                      { blocksLightWhenClosed: !selectedPortal.blocksLightWhenClosed },
                      true,
                    )
                  }
                />
              </div>
              <div style={{ marginTop: 6, marginBottom: 8 }}>
                <ColorStudioPanel
                  recolor={selectedPortal.recolor ?? DEFAULT_RECOLOR}
                  asset={vaultById.get(selectedPortal.assetId)}
                  eyedropperTarget="selection"
                  title="Colorize Door / Window"
                  compact
                  onChange={(next, rec) =>
                    st.updatePortal(selection.layerId, selection.id, { recolor: next }, rec)
                  }
                />
              </div>
              <button
                type="button"
                className="dc-btn"
                style={{ width: "100%", color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.45)" }}
                onClick={() => st.deleteSelection()}
              >
                Delete Door / Window
              </button>
            </div>
          )}

          {/* Selected DM-Only Secret Note Inspector */}
          {selectedDmNote && selection && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Badge</span>
                <select
                  className="dc-select"
                  value={selectedDmNote.badge}
                  onChange={(e) =>
                    st.updateDmNote(
                      selection.layerId,
                      selection.id,
                      { badge: e.target.value as typeof selectedDmNote.badge },
                      true,
                    )
                  }
                >
                  {(["NOTE", "TRAP", "SECRET", "AMBUSH", "HAZARD", "TREASURE"] as const).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="dc-field-label" style={{ marginBottom: 4 }}>Title</div>
                <input
                  type="text"
                  className="dc-input"
                  style={{ width: "100%" }}
                  value={selectedDmNote.title}
                  onChange={(e) =>
                    st.updateDmNote(selection.layerId, selection.id, { title: e.target.value })
                  }
                />
              </div>
              <div>
                <div className="dc-field-label" style={{ marginBottom: 4 }}>DM Secret Body</div>
                <textarea
                  className="dc-input"
                  rows={4}
                  style={{ width: "100%", height: "auto", padding: "6px 8px", resize: "vertical" }}
                  value={selectedDmNote.body}
                  onChange={(e) =>
                    st.updateDmNote(selection.layerId, selection.id, { body: e.target.value })
                  }
                />
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Pin Accent Color</span>
                <input
                  type="color"
                  value={selectedDmNote.colorHex}
                  onChange={(e) =>
                    st.updateDmNote(selection.layerId, selection.id, { colorHex: e.target.value })
                  }
                />
              </div>
              <button
                type="button"
                className="dc-btn"
                style={{ width: "100%", color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.45)" }}
                onClick={() => st.deleteSelection()}
              >
                Delete DM Note
              </button>
            </div>
          )}

          {/* Selected Cave / Dungeon Entrance Opening Inspector */}
          {selectedCaveEntrance && selection && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 6,
                  fontSize: 10,
                  color: "var(--text-secondary)",
                  background: "var(--bg-panel)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 6,
                  padding: "5px 8px",
                }}
              >
                <span>Drag gold knobs for Width · Cyan arrow for Fade · Center dot to slide</span>
                <button
                  type="button"
                  className="dc-chip"
                  style={{ height: 20, fontSize: 10, flexShrink: 0 }}
                  onClick={() => st.setSelection(null)}
                >
                  Done
                </button>
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Opening Width ({selectedCaveEntrance.widthCells.toFixed(1)} sq)</span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 118 }}
                  min={1.0}
                  max={6.0}
                  step={0.2}
                  value={selectedCaveEntrance.widthCells}
                  onChange={(e) =>
                    st.updateCaveEntrance(selection.layerId, selection.id, {
                      widthCells: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Fade to Terrain ({selectedCaveEntrance.fadeLengthCells.toFixed(1)} sq)</span>
                <input
                  type="range"
                  className="dc-range"
                  style={{ width: 118 }}
                  min={0.5}
                  max={5.5}
                  step={0.25}
                  value={selectedCaveEntrance.fadeLengthCells}
                  onChange={(e) =>
                    st.updateCaveEntrance(selection.layerId, selection.id, {
                      fadeLengthCells: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Threshold Cap</span>
                <div style={{ display: "inline-flex", gap: 3 }}>
                  {(
                    [
                      { id: "none" as CaveThresholdStyle, label: "Open" },
                      { id: "rock_mouth" as CaveThresholdStyle, label: "Rock" },
                      { id: "stone_arch" as CaveThresholdStyle, label: "Arch" },
                    ]
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`dc-chip ${selectedCaveEntrance.thresholdStyle === t.id ? "active" : ""}`}
                      style={{ height: 22, fontSize: 10 }}
                      onClick={() =>
                        st.updateCaveEntrance(
                          selection.layerId,
                          selection.id,
                          { thresholdStyle: t.id },
                          true,
                        )
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="dc-field-label" style={{ marginBottom: 4 }}>Entrance / Exit Label</div>
                <input
                  type="text"
                  className="dc-input"
                  style={{ width: "100%", height: 26, fontSize: 11 }}
                  value={selectedCaveEntrance.markerLabel}
                  onChange={(e) =>
                    st.updateCaveEntrance(selection.layerId, selection.id, {
                      markerLabel: e.target.value,
                    })
                  }
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                  {["CAVE ENTRANCE", "DUNGEON EXIT", "STAIRS DOWN", "SECRET EXIT"].map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      className={`dc-chip ${selectedCaveEntrance.markerLabel.toUpperCase() === lbl ? "active" : ""}`}
                      style={{ height: 20, fontSize: 9 }}
                      onClick={() =>
                        st.updateCaveEntrance(
                          selection.layerId,
                          selection.id,
                          { markerLabel: lbl, showMarker: true },
                          true,
                        )
                      }
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">Show Entrance Marker</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedCaveEntrance.showMarker}
                  className="dc-switch"
                  onClick={() =>
                    st.updateCaveEntrance(
                      selection.layerId,
                      selection.id,
                      { showMarker: !selectedCaveEntrance.showMarker },
                      true,
                    )
                  }
                />
              </div>
              <div className="dc-field-row" style={{ marginBottom: 0 }}>
                <span className="dc-field-label">DM-Only Secret Marker</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={selectedCaveEntrance.markerDmOnly}
                  className="dc-switch"
                  onClick={() =>
                    st.updateCaveEntrance(
                      selection.layerId,
                      selection.id,
                      { markerDmOnly: !selectedCaveEntrance.markerDmOnly },
                      true,
                    )
                  }
                />
              </div>
              <button
                type="button"
                className="dc-btn"
                style={{ width: "100%", color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.45)" }}
                onClick={() => st.deleteSelection()}
              >
                <Trash2 size={12} />
                <span>Remove Entrance Opening</span>
              </button>
            </div>
          )}

          {/* Selected Water Body Live Inspector */}
          {selectedWater && selection && (
            <WaterStudioPanel selectedWater={{ layerId: selection.layerId, region: selectedWater }} />
          )}

          {/* Selected Roof Structure Live Inspector */}
          {selectedRoof && selection && (
            <RoofStudioPanel selectedRoof={{ layerId: selection.layerId, roof: selectedRoof }} />
          )}

          {/* Selected World Atlas Entity Inspector (Label / River / Trail / Region / Pin) */}
          {doc.mode === "world" &&
            selection &&
            (selection.kind === "world_label" ||
              selection.kind === "world_river" ||
              selection.kind === "world_trail" ||
              selection.kind === "world_region" ||
              selection.kind === "world_pin") && <WorldStudioPanel />}

          {/* Default / Tool-Specific Controls */}
          {!selectedObject &&
            !selectedLight &&
            !selectedCaveEntrance &&
            !selectedWater &&
            !selectedRoof &&
            !selectedScatter &&
            !selectedWall &&
            !selectedPath &&
            !selectedPortal &&
            !selectedDmNote &&
            !(
              doc.mode === "world" &&
              selection &&
              (selection.kind === "world_label" ||
                selection.kind === "world_river" ||
                selection.kind === "world_trail" ||
                selection.kind === "world_region" ||
                selection.kind === "world_pin")
            ) && (
            <div>
              {doc.mode === "world" &&
                activeTool !== "stamp" &&
                activeTool !== "dm_note" && <WorldStudioPanel />}
              {activeTool === "cave" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {/* 8 One-Click Cave & Dungeon Theme Presets */}
                  <div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--accent-gold)",
                        marginBottom: 5,
                      }}
                    >
                      Cave &amp; Dungeon Presets
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 4,
                      }}
                    >
                      {CAVE_THEME_PRESETS.map((preset) => {
                        const isAct = caveThemeId === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            className={`dc-chip ${isAct ? "active" : ""}`}
                            style={{
                              justifyContent: "flex-start",
                              gap: 6,
                              height: 25,
                              fontSize: 10.5,
                              padding: "0 7px",
                            }}
                            title={preset.name}
                            onClick={() => st.applyCaveTheme(preset.id)}
                          >
                            <span
                              style={{
                                width: 9,
                                height: 9,
                                borderRadius: preset.kind === "dungeon" ? 2 : "50%",
                                background: preset.swatchHex,
                                border: "1px solid rgba(255,255,255,0.45)",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {preset.shortName}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Mode Settings (Modes 1–5 live on the top floating bar to keep the Studio compact!) */}
                  {(caveDrawMode === "cave_brush" || caveDrawMode === "erase") && (
                    <div
                      style={{
                        padding: "7px 8px",
                        borderRadius: 6,
                        background:
                          caveDrawMode === "erase"
                            ? "rgba(239, 68, 68, 0.08)"
                            : "var(--bg-panel)",
                        border: `1px solid ${
                          caveDrawMode === "erase"
                            ? "rgba(248, 113, 113, 0.35)"
                            : "var(--border-subtle)"
                        }`,
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">
                          {caveDrawMode === "erase" ? "Eraser Radius" : "Cave Radius"} ({caveBrushRadiusCells.toFixed(1)} sq)
                        </span>
                        <input
                          type="range"
                          className="dc-range"
                          style={{ width: 110 }}
                          min={0.75}
                          max={6.0}
                          step={0.25}
                          value={caveBrushRadiusCells}
                          onChange={(e) =>
                            st.setBrushParams({ caveBrushRadiusCells: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">
                          Rock Jaggedness ({Math.round(caveRoughness * 100)}%)
                        </span>
                        <input
                          type="range"
                          className="dc-range"
                          style={{ width: 110 }}
                          min={0}
                          max={1}
                          step={0.05}
                          value={caveRoughness}
                          onChange={(e) =>
                            st.updateActiveCaveSystem({ roughness: Number(e.target.value) }, false)
                          }
                        />
                      </div>
                      {caveDrawMode === "erase" && (
                        <div style={{ fontSize: 10, color: "#FCA5A5", lineHeight: 1.35 }}>
                          Drag inside a cave to carve organic rock pillars, or hold <strong>Shift+Drag</strong> for a crisp rectangular dungeon column.
                        </div>
                      )}
                    </div>
                  )}

                  {(caveDrawMode === "dungeon_rect" || caveDrawMode === "polygon") && (
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(52, 211, 153, 0.3)",
                        fontSize: 10,
                        color: "#A7F3D0",
                        lineHeight: 1.35,
                      }}
                    >
                      {caveDrawMode === "dungeon_rect"
                        ? "Click & drag corner-to-corner for crisp 90° rooms. Overlapping rooms & caves auto-merge and dissolve shared walls."
                        : "Click corners for custom angled chambers. Click the start dot, Double-click, or press Enter to carve."}
                    </div>
                  )}

                  {caveDrawMode === "entrance" && (
                    <div
                      style={{
                        padding: "7px 8px",
                        borderRadius: 6,
                        background: "rgba(34, 211, 238, 0.08)",
                        border: "1px solid rgba(34, 211, 238, 0.35)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div style={{ fontSize: 10, color: "#A5F3FC", lineHeight: 1.35 }}>
                        Click any cave or dungeon wall edge to punch an opening with a smooth floor fade into normal terrain.
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">Width ({caveEntranceWidthCells.toFixed(1)} sq)</span>
                        <input
                          type="range"
                          className="dc-range"
                          style={{ width: 112 }}
                          min={1.0}
                          max={6.0}
                          step={0.2}
                          value={caveEntranceWidthCells}
                          onChange={(e) =>
                            st.setBrushParams({ caveEntranceWidthCells: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">Fade Out ({caveEntranceFadeCells.toFixed(1)} sq)</span>
                        <input
                          type="range"
                          className="dc-range"
                          style={{ width: 112 }}
                          min={0.5}
                          max={5.5}
                          step={0.25}
                          value={caveEntranceFadeCells}
                          onChange={(e) =>
                            st.setBrushParams({ caveEntranceFadeCells: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">Threshold Cap</span>
                        <div style={{ display: "inline-flex", gap: 3 }}>
                          {(
                            [
                              { id: "none" as CaveThresholdStyle, label: "Open" },
                              { id: "rock_mouth" as CaveThresholdStyle, label: "Rock" },
                              { id: "stone_arch" as CaveThresholdStyle, label: "Arch" },
                            ]
                          ).map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              className={`dc-chip ${caveEntranceThreshold === t.id ? "active" : ""}`}
                              style={{ height: 20, fontSize: 10 }}
                              onClick={() => st.setBrushParams({ caveEntranceThreshold: t.id })}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">Marker Label</span>
                        <input
                          type="text"
                          className="dc-input"
                          style={{ width: 132, height: 22, fontSize: 10 }}
                          value={caveEntranceMarkerLabel}
                          onChange={(e) =>
                            st.setBrushParams({ caveEntranceMarkerLabel: e.target.value })
                          }
                        />
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">Show Marker Badge</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={caveEntranceShowMarker}
                          className="dc-switch"
                          onClick={() =>
                            st.setBrushParams({ caveEntranceShowMarker: !caveEntranceShowMarker })
                          }
                        />
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">DM-Only Secret Exit</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={caveEntranceDmOnly}
                          className="dc-switch"
                          onClick={() =>
                            st.setBrushParams({ caveEntranceDmOnly: !caveEntranceDmOnly })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom Floor & Wall Texture Pickers from the Asset Vault */}
                  {renderMaterialPicker("Cave / Dungeon Floor", terrainAssets, caveFloorAssetId, (id) =>
                    st.updateActiveCaveSystem({ floorAssetId: id, themeId: "custom" }, true),
                  )}
                  <ColorStudioPanel
                    recolor={activeFloorCaveLayer?.caveSystem?.floorRecolor ?? DEFAULT_RECOLOR}
                    asset={vaultById.get(caveFloorAssetId)}
                    eyedropperTarget="terrain"
                    title="Color & Tint Cave Floor"
                    compact
                    onChange={(next, rec) =>
                      st.updateActiveCaveSystem({ floorRecolor: next }, rec)
                    }
                  />
                  {renderMaterialPicker("Auto-Wall Texture", wallAssets, caveWallAssetId, (id) =>
                    st.updateActiveCaveSystem({ wallAssetId: id, themeId: "custom" }, true),
                  )}
                  <ColorStudioPanel
                    recolor={activeFloorCaveLayer?.caveSystem?.wallRecolor ?? DEFAULT_RECOLOR}
                    asset={vaultById.get(caveWallAssetId)}
                    eyedropperTarget="wall"
                    title="Color & Tint Cave Wall"
                    compact
                    onChange={(next, rec) =>
                      st.updateActiveCaveSystem({ wallRecolor: next }, rec)
                    }
                  />

                  {/* Wall & Exterior Controls */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div className="dc-field-row" style={{ marginBottom: 0 }}>
                      <span className="dc-field-label">
                        Wall Thickness ({caveWallThicknessCells.toFixed(2)} sq)
                      </span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 112 }}
                        min={0.35}
                        max={1.3}
                        step={0.05}
                        value={caveWallThicknessCells}
                        onChange={(e) =>
                          st.updateActiveCaveSystem(
                            { wallThicknessCells: Number(e.target.value) },
                            false,
                          )
                        }
                      />
                    </div>
                    <div className="dc-field-row" style={{ marginBottom: 0 }}>
                      <span className="dc-field-label">Underground Rock Fill</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={caveUndergroundFill}
                        className="dc-switch"
                        onClick={() =>
                          st.updateActiveCaveSystem(
                            { undergroundFill: !caveUndergroundFill },
                            true,
                          )
                        }
                      />
                    </div>
                    {caveUndergroundFill ? (
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">Underground Void Color</span>
                        <input
                          type="color"
                          value={activeFloorCaveLayer?.caveSystem?.undergroundColorHex ?? "#0B0E14"}
                          onChange={(e) =>
                            st.updateActiveCaveSystem({ undergroundColorHex: e.target.value }, false)
                          }
                        />
                      </div>
                    ) : (
                      <>
                        <div className="dc-field-row" style={{ marginBottom: 0 }}>
                          <span className="dc-field-label">
                            Outer Rock Rim ({caveOuterRimCells.toFixed(2)} sq)
                          </span>
                          <input
                            type="range"
                            className="dc-range"
                            style={{ width: 112 }}
                            min={0}
                            max={1.5}
                            step={0.05}
                            value={caveOuterRimCells}
                            onChange={(e) =>
                              st.updateActiveCaveSystem(
                                { outerRimCells: Number(e.target.value) },
                                false,
                              )
                            }
                          />
                        </div>
                        <div className="dc-field-row" style={{ marginBottom: 0 }}>
                          <span className="dc-field-label">Outer Rim Color</span>
                          <input
                            type="color"
                            value={activeFloorCaveLayer?.caveSystem?.outerRimColorHex ?? "#3C414A"}
                            onChange={(e) =>
                              st.updateActiveCaveSystem({ outerRimColorHex: e.target.value }, false)
                            }
                          />
                        </div>
                      </>
                    )}
                    <div className="dc-field-row" style={{ marginBottom: 0 }}>
                      <span className="dc-field-label">Cast 2D Shadows &amp; VTT</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={caveBlocksLight}
                        className="dc-switch"
                        onClick={() =>
                          st.updateActiveCaveSystem({ blocksLight: !caveBlocksLight }, true)
                        }
                      />
                    </div>
                  </div>

                  {/* Quick-Select List of Entrances & Exits on This Floor */}
                  {activeFloorCaveLayer?.caveSystem &&
                    activeFloorCaveLayer.caveSystem.entrances.length > 0 && (
                      <div
                        style={{
                          paddingTop: 6,
                          borderTop: "1px solid var(--border-subtle)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "var(--accent-gold)",
                            }}
                          >
                            Entrances &amp; Exits ({activeFloorCaveLayer.caveSystem.entrances.length})
                          </span>
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            Click to edit
                          </span>
                        </div>
                        {activeFloorCaveLayer.caveSystem.entrances.map((ent) => (
                          <div
                            key={ent.id}
                            onClick={() =>
                              st.setSelection({
                                kind: "cave_entrance",
                                layerId: activeFloorCaveLayer.id,
                                id: ent.id,
                              })
                            }
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 7px",
                              borderRadius: 6,
                              cursor: "pointer",
                              background: "var(--bg-panel)",
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: ent.markerDmOnly ? "#A78BFA" : "#22D3EE",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                flex: 1,
                                fontSize: 11,
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {ent.markerLabel || "Cave Opening"}
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                color: "var(--text-muted)",
                              }}
                            >
                              {ent.widthCells.toFixed(1)}×{ent.fadeLengthCells.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                  {/* Bake & Clear Actions when Chambers Exist */}
                  {activeFloorCaveLayer?.caveSystem &&
                    activeFloorCaveLayer.caveSystem.operations.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 5,
                          paddingTop: 6,
                          borderTop: "1px solid var(--border-subtle)",
                        }}
                      >
                        <button
                          type="button"
                          className="dc-btn"
                          style={{
                            width: "100%",
                            height: 28,
                            fontSize: 11,
                            justifyContent: "center",
                            borderColor: "rgba(229, 169, 60, 0.55)",
                            color: "var(--accent-gold)",
                          }}
                          title="Convert live procedural cave/dungeon into standard editable vector walls and floor polygons (Ctrl+Z supported)"
                          onClick={() => st.bakeCaveToWallsAndTerrain()}
                        >
                          Bake to Editable Walls &amp; Terrain
                        </button>
                        <button
                          type="button"
                          className="dc-btn"
                          style={{
                            width: "100%",
                            height: 26,
                            fontSize: 10.5,
                            justifyContent: "center",
                            color: "#fca5a5",
                            borderColor: "rgba(239, 68, 68, 0.4)",
                          }}
                          onClick={() => st.clearCaveLayer()}
                        >
                          Clear Cave Layer ({activeFloorCaveLayer.caveSystem.operations.length} strokes)
                        </button>
                      </div>
                    )}
                </div>
              )}

              {activeTool === "terrain" && (() => {
                const targetTerrainLayer = findPreferredLayerForKind(doc, "terrain");
                const targetStrokeCount = targetTerrainLayer?.terrainStrokes?.filter((s) => !s.erase).length ?? 0;
                const floorCode = activeLevel?.shortCode ?? "1F";
                const usedOnFloor = summarizeUsedTerrains(doc, doc.activeLevelId);
                const isErase = terrainMode === "erase";
                const isBrushLike = terrainMode === "brush" || (isErase && terrainEraseShape === "brush");
                const activeTerrainName =
                  vaultById.get(activeTerrainAssetId)?.displayName ??
                  activeTerrainAssetId.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/_/g, " ") ??
                  "Terrain";

                return (
                <>
                  {/* Target Floor & Layer Clarity Pill */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 6,
                      padding: "5px 8px",
                      borderRadius: 6,
                      background: "rgba(74, 222, 128, 0.08)",
                      border: "1px solid rgba(74, 222, 128, 0.3)",
                      marginBottom: 8,
                      fontSize: 10.5,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          padding: "1px 5px",
                          borderRadius: 4,
                          fontFamily: "var(--font-mono)",
                          fontSize: 9.5,
                          fontWeight: 700,
                          background: "rgba(74, 222, 128, 0.18)",
                          color: "#86EFAC",
                          flexShrink: 0,
                        }}
                      >
                        {floorCode}
                      </span>
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={targetTerrainLayer ? `Target layer: ${targetTerrainLayer.name}` : "Auto-creates terrain layer on active floor"}
                      >
                        {targetTerrainLayer ? targetTerrainLayer.name : `${floorCode} Ground Terrain`}
                      </span>
                    </span>
                    <span style={{ fontSize: 9.5, color: "var(--text-muted)", flexShrink: 0 }}>
                      {targetStrokeCount} patch{targetStrokeCount === 1 ? "" : "es"}
                    </span>
                  </div>

                  {/* 6-Mode Terrain & Fill Mode Switcher */}
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--accent-gold)",
                        marginBottom: 5,
                      }}
                    >
                      Terrain &amp; Fill Mode (1–6)
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 4,
                      }}
                    >
                      {(
                        [
                          { id: "brush" as TerrainMode, label: "1 · Brush (B)" },
                          { id: "flood" as TerrainMode, label: "2 · Smart Fill (K)" },
                          { id: "replace" as TerrainMode, label: "3 · Replace" },
                          { id: "rect" as TerrainMode, label: "4 · Rect (R)" },
                          { id: "polygon" as TerrainMode, label: "5 · Polygon" },
                          { id: "erase" as TerrainMode, label: "6 · Erase (E)" },
                        ]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`dc-chip ${terrainMode === m.id ? "active" : ""}`}
                          style={{
                            justifyContent: "center",
                            height: 25,
                            fontSize: 10.5,
                            ...(m.id === "erase" && terrainMode === "erase"
                              ? {
                                  borderColor: "rgba(248, 113, 113, 0.72)",
                                  background: "rgba(248, 113, 113, 0.18)",
                                  color: "#FCA5A5",
                                }
                              : m.id === "replace" && terrainMode === "replace"
                                ? {
                                    borderColor: "rgba(52, 211, 153, 0.72)",
                                    background: "rgba(52, 211, 153, 0.16)",
                                    color: "#6EE7B7",
                                  }
                                : {}),
                          }}
                          onClick={() => st.setBrushParams({ terrainMode: m.id })}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 10,
                        color: "var(--text-muted)",
                        lineHeight: 1.38,
                      }}
                    >
                      {terrainMode === "flood"
                        ? "Click inside any room, curved arch, or yard to fill cleanly to walls/caves/water · Alt+Click samples floor."
                        : terrainMode === "replace"
                          ? "Click any existing floor patch or map base to swap its texture in place without stacking · Alt+Click samples."
                          : terrainMode === "erase"
                            ? `Non-destructive layer cutout on ${floorCode} — punch stairwell openings or trim bleed without touching floors below.`
                            : terrainMode === "rect"
                              ? "Drag corner-to-corner for crisp rectangular floors (Shift = Square) · Alt+Click samples floor."
                              : terrainMode === "polygon"
                                ? "Click corners to trace custom floors · Press C mid-shape to bow next edge into a circular arc · Enter closes."
                                : "Freehand seamless splat brush · Alt+Click samples existing floor texture."}
                    </div>
                  </div>

                  {/* Mode-Specific Controls */}
                  {terrainMode === "flood" && (
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(34, 211, 238, 0.06)",
                        border: "1px solid rgba(34, 211, 238, 0.28)",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#67E8F9",
                          marginBottom: 5,
                        }}
                      >
                        Stop Fill At Barriers
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, marginBottom: 6 }}>
                        <button
                          type="button"
                          className={`dc-chip ${terrainBarrierWalls ? "active" : ""}`}
                          style={{ justifyContent: "center", height: 22, fontSize: 10 }}
                          onClick={() => st.setBrushParams({ terrainBarrierWalls: !terrainBarrierWalls })}
                        >
                          Walls
                        </button>
                        <button
                          type="button"
                          className={`dc-chip ${terrainBarrierCaves ? "active" : ""}`}
                          style={{ justifyContent: "center", height: 22, fontSize: 10 }}
                          onClick={() => st.setBrushParams({ terrainBarrierCaves: !terrainBarrierCaves })}
                        >
                          Caves
                        </button>
                        <button
                          type="button"
                          className={`dc-chip ${terrainBarrierWater ? "active" : ""}`}
                          style={{ justifyContent: "center", height: 22, fontSize: 10 }}
                          onClick={() => st.setBrushParams({ terrainBarrierWater: !terrainBarrierWater })}
                        >
                          Water
                        </button>
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span
                          className="dc-field-label"
                          title="Automatically removes older buried floor fills inside this room so textures never stack or leak"
                        >
                          Clean Replace Inside Room
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={terrainFloodReplaceUnderneath}
                          className="dc-switch"
                          onClick={() =>
                            st.setBrushParams({
                              terrainFloodReplaceUnderneath: !terrainFloodReplaceUnderneath,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {terrainMode === "replace" && (
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(52, 211, 153, 0.06)",
                        border: "1px solid rgba(52, 211, 153, 0.3)",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#6EE7B7",
                          marginBottom: 5,
                        }}
                      >
                        Replace Target Scope
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, marginBottom: 6 }}>
                        {(
                          [
                            { id: "patch" as TerrainReplaceScope, label: "Patch", tip: "Swap ONLY the single floor patch or room you click" },
                            { id: "layer" as TerrainReplaceScope, label: "Layer", tip: "Swap all matching textures on the clicked layer" },
                            { id: "floor" as TerrainReplaceScope, label: floorCode, tip: `Swap all matching textures on ${floorCode}` },
                            { id: "map" as TerrainReplaceScope, label: "Map", tip: "Swap all matching textures across every floor + map base" },
                          ]
                        ).map((sc) => (
                          <button
                            key={sc.id}
                            type="button"
                            className={`dc-chip ${terrainReplaceScope === sc.id ? "active" : ""}`}
                            style={{ justifyContent: "center", height: 22, fontSize: 10, padding: 0 }}
                            title={sc.tip}
                            onClick={() => st.setBrushParams({ terrainReplaceScope: sc.id })}
                          >
                            {sc.label}
                          </button>
                        ))}
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span
                          className="dc-field-label"
                          title="OFF preserves each patch's existing angle, scale, opacity & slope shade; ON overwrites them with your current brush settings"
                        >
                          Also Apply Brush Style
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={terrainReplaceApplyStyle}
                          className="dc-switch"
                          onClick={() =>
                            st.setBrushParams({
                              terrainReplaceApplyStyle: !terrainReplaceApplyStyle,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}

                  {isErase && (
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "rgba(248, 113, 113, 0.08)",
                        border: "1px solid rgba(248, 113, 113, 0.34)",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#FCA5A5",
                          marginBottom: 5,
                        }}
                      >
                        Erase Cutout Shape
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3 }}>
                        {(
                          [
                            { id: "brush" as TerrainEraseShape, label: "Brush" },
                            { id: "room" as TerrainEraseShape, label: "Room" },
                            { id: "rect" as TerrainEraseShape, label: "Rect" },
                            { id: "polygon" as TerrainEraseShape, label: "Poly" },
                          ]
                        ).map((sh) => (
                          <button
                            key={sh.id}
                            type="button"
                            className={`dc-chip ${terrainEraseShape === sh.id ? "active" : ""}`}
                            style={{ justifyContent: "center", height: 22, fontSize: 10, padding: 0 }}
                            onClick={() => st.setBrushParams({ terrainEraseShape: sh.id })}
                          >
                            {sh.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {terrainMode === "polygon" && (
                    <div className="dc-field-row" style={{ marginBottom: 8 }}>
                      <span className="dc-field-label">Next Edge (C)</span>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <button
                          type="button"
                          className={`dc-chip ${!terrainPolygonCurved ? "active" : ""}`}
                          onClick={() => st.setBrushParams({ terrainPolygonCurved: false })}
                        >
                          Straight
                        </button>
                        <button
                          type="button"
                          className={`dc-chip ${terrainPolygonCurved ? "active" : ""}`}
                          onClick={() => st.setBrushParams({ terrainPolygonCurved: true })}
                        >
                          Curved
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Last 3 Floors Used Quick-Pick */}
                  {!isErase && recentTerrainAssetIds.length > 0 && (
                    <div
                      style={{
                        padding: "6px 7px",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "var(--accent-gold)",
                          marginBottom: 4,
                        }}
                      >
                        Last 3 Floors Used
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {recentTerrainAssetIds.slice(0, 3).map((tid) => {
                          const tAsset = vaultById.get(tid);
                          const tName =
                            tAsset?.displayName ??
                            tid.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/_/g, " ") ??
                            "Floor";
                          const isAct = tid === activeTerrainAssetId;
                          return (
                            <button
                              key={tid}
                              type="button"
                              className={`dc-chip ${isAct ? "active" : ""}`}
                              style={{
                                width: "100%",
                                height: 23,
                                padding: "0 6px",
                                gap: 6,
                                justifyContent: "space-between",
                                fontSize: 10,
                                overflow: "hidden",
                              }}
                              onClick={() => st.setBrushParams({ activeTerrainAssetId: tid })}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  minWidth: 0,
                                  flex: 1,
                                  overflow: "hidden",
                                }}
                              >
                                <img
                                  src={resolveAssetUrl(tid, vaultById)}
                                  alt=""
                                  style={{
                                    width: 15,
                                    height: 15,
                                    borderRadius: 3,
                                    objectFit: "cover",
                                    border: "1px solid rgba(255,255,255,0.22)",
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {tName}
                                </span>
                              </span>
                              {isAct && (
                                <span style={{ fontSize: 8.5, fontWeight: 700, flexShrink: 0 }}>
                                  ACTIVE
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Textures Currently Used on This Floor (Instant 1-Click Use / Swap!) */}
                  {usedOnFloor.length > 0 && (
                    <div
                      style={{
                        padding: "6px 7px",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#6EE7B7",
                          marginBottom: 4,
                        }}
                      >
                        Used on {floorCode} ({usedOnFloor.length})
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {usedOnFloor.slice(0, 6).map((u) => {
                          const uName =
                            vaultById.get(u.assetId)?.displayName ??
                            u.assetId.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/_/g, " ") ??
                            "Floor";
                          const isSame = u.assetId === activeTerrainAssetId;
                          return (
                            <div
                              key={u.assetId}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 5,
                                padding: "2px 5px",
                                borderRadius: 5,
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.06)",
                              }}
                            >
                              <button
                                type="button"
                                title={`Sample "${uName}" as active terrain`}
                                onClick={() => st.setBrushParams({ activeTerrainAssetId: u.assetId })}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 5,
                                  minWidth: 0,
                                  flex: 1,
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--text-primary)",
                                  fontSize: 10,
                                  cursor: "pointer",
                                  padding: 0,
                                  textAlign: "left",
                                }}
                              >
                                <img
                                  src={resolveAssetUrl(u.assetId, vaultById)}
                                  alt=""
                                  style={{
                                    width: 15,
                                    height: 15,
                                    borderRadius: 3,
                                    objectFit: "cover",
                                    border: "1px solid rgba(255,255,255,0.22)",
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {uName}
                                </span>
                                <span style={{ fontSize: 9, color: "var(--text-muted)", flexShrink: 0 }}>
                                  {u.isBase && u.count === 0 ? "BASE" : u.isBase ? `${u.count}+B` : `×${u.count}`}
                                </span>
                              </button>
                              <button
                                type="button"
                                className="dc-chip"
                                disabled={isSame}
                                style={{
                                  height: 19,
                                  fontSize: 9,
                                  padding: "0 6px",
                                  opacity: isSame ? 0.45 : 1,
                                  flexShrink: 0,
                                }}
                                title={
                                  isSame
                                    ? "Already using active texture"
                                    : `Replace all "${uName}" on ${floorCode} with "${activeTerrainName}"`
                                }
                                onClick={() => {
                                  const n = st.replaceTerrainMaterial(
                                    u.assetId,
                                    activeTerrainAssetId,
                                    "floor",
                                    terrainReplaceApplyStyle,
                                  );
                                  if (n > 0) {
                                    st.pushToast(
                                      `Replaced ${uName} → ${activeTerrainName} on ${floorCode} (${n} updated)`,
                                      "success",
                                    );
                                  }
                                }}
                              >
                                Swap
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Floor, Layer & Map Base Bulk Actions */}
                  <div
                    style={{
                      padding: "6px 7px",
                      borderRadius: 6,
                      background: "var(--bg-panel)",
                      border: "1px solid var(--border-subtle)",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--accent-gold)",
                        marginBottom: 5,
                      }}
                    >
                      Layer, Floor &amp; Base Fill Actions
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
                      <button
                        type="button"
                        className="dc-btn"
                        style={{ height: 24, fontSize: 10, padding: "0 6px", justifyContent: "center" }}
                        title={`Re-skin all existing painted/filled rooms on ${targetTerrainLayer?.name ?? "active layer"} with ${activeTerrainName} (keeps exact room shapes!)`}
                        onClick={() => {
                          const n = st.replaceAllTerrainOnScope(
                            activeTerrainAssetId,
                            "layer",
                            terrainReplaceApplyStyle,
                          );
                          if (n > 0) {
                            st.pushToast(
                              `Replaced ${n} patch${n === 1 ? "" : "es"} on active layer with ${activeTerrainName}`,
                              "success",
                            );
                          } else {
                            st.pushToast("No painted terrain on active layer yet — use Fill Whole Layer instead", "info");
                          }
                        }}
                      >
                        Replace Layer
                      </button>
                      <button
                        type="button"
                        className="dc-btn"
                        style={{ height: 24, fontSize: 10, padding: "0 6px", justifyContent: "center" }}
                        title={`Fill the entire canvas on ${targetTerrainLayer?.name ?? "active layer"} with ${activeTerrainName}`}
                        onClick={() => {
                          st.fillWholeLayerTerrain(activeTerrainAssetId);
                          st.pushToast(`Filled entire active layer with ${activeTerrainName}`, "success");
                        }}
                      >
                        Fill Whole Layer
                      </button>
                      <button
                        type="button"
                        className="dc-btn"
                        style={{ height: 24, fontSize: 10, padding: "0 6px", justifyContent: "center" }}
                        title={`Re-skin all existing terrain across ${floorCode} with ${activeTerrainName}`}
                        onClick={() => {
                          const n = st.replaceAllTerrainOnScope(
                            activeTerrainAssetId,
                            "floor",
                            terrainReplaceApplyStyle,
                          );
                          if (n > 0) {
                            st.pushToast(
                              `Replaced ${floorCode} terrain (${n} updated) with ${activeTerrainName}`,
                              "success",
                            );
                          } else {
                            st.pushToast(`No painted terrain on ${floorCode} yet`, "info");
                          }
                        }}
                      >
                        Replace {floorCode} All
                      </button>
                      <button
                        type="button"
                        className="dc-btn"
                        style={{
                          height: 24,
                          fontSize: 10,
                          padding: "0 6px",
                          justifyContent: "center",
                          color: "#FCA5A5",
                          borderColor: "rgba(239, 68, 68, 0.42)",
                        }}
                        title="Clear all painted & filled strokes from the active terrain layer (Ctrl+Z undoable)"
                        onClick={() => {
                          const n = st.clearTerrainLayer();
                          if (n > 0) {
                            st.pushToast(`Cleared ${n} terrain stroke${n === 1 ? "" : "s"} from active layer`, "info");
                          } else {
                            st.pushToast("Active terrain layer is already clear", "info");
                          }
                        }}
                      >
                        Clear Layer
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        className="dc-btn"
                        style={{ flex: 1, height: 24, fontSize: 10, padding: "0 6px", justifyContent: "center" }}
                        title="Set the 1F underlying map base canvas texture"
                        onClick={() => {
                          const id = activeTerrainAssetId || "terrain/berlin_wet_cobble.png";
                          st.setBaseTerrainAsset(id);
                          const label = vaultById.get(id)?.displayName ?? "Selected Terrain";
                          st.pushToast(`Replaced 1F Map Base with ${label}`, "success");
                        }}
                      >
                        Replace 1F Map Base
                      </button>
                      <button
                        type="button"
                        className={`dc-chip ${doc.canvas.baseTerrainTransparent ? "active" : ""}`}
                        style={{ height: 24, fontSize: 10, padding: "0 8px", flexShrink: 0 }}
                        title="Toggle Transparent Void background on 1F (ideal for ships, airships, floating islands & transparent VTT exports)"
                        onClick={() => {
                          const next = !doc.canvas.baseTerrainTransparent;
                          st.setBaseTerrainTransparent(next);
                          st.pushToast(
                            next
                              ? "1F Map Base set to Transparent Void (pure alpha on export)"
                              : "Restored solid 1F Map Base texture",
                            "success",
                          );
                        }}
                      >
                        {doc.canvas.baseTerrainTransparent ? "Void: ON" : "Void"}
                      </button>
                    </div>
                  </div>

                  {!isErase &&
                    renderMaterialPicker("Terrain Texture", terrainAssets, activeTerrainAssetId, (id) =>
                      st.setBrushParams({ activeTerrainAssetId: id }),
                    )}

                  {isBrushLike && (
                    <div className="dc-field-row">
                      <span className="dc-field-label">
                        {isErase ? "Eraser" : "Brush"} Radius ({brushRadiusCells.toFixed(1)} sq)
                      </span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 118 }}
                        min={0.5}
                        max={8}
                        step={0.25}
                        value={brushRadiusCells}
                        onChange={(e) => st.setBrushParams({ brushRadiusCells: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {!isErase && (
                    <div className="dc-field-row">
                      <span className="dc-field-label">
                        Tile Scale ({terrainTextureScale.toFixed(2)}×)
                      </span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 118 }}
                        min={0.4}
                        max={2.5}
                        step={0.05}
                        value={terrainTextureScale}
                        onChange={(e) => st.setBrushParams({ terrainTextureScale: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  <div className="dc-field-row">
                    <span className="dc-field-label">
                      {isErase ? "Erase Strength" : terrainMode === "brush" ? "Brush Opacity" : "Fill Opacity"} ({Math.round(brushOpacity * 100)}%)
                    </span>
                    <input
                      type="range"
                      className="dc-range"
                      style={{ width: 118 }}
                      min={0.1}
                      max={1}
                      step={0.05}
                      value={brushOpacity}
                      onChange={(e) => st.setBrushParams({ brushOpacity: Number(e.target.value) })}
                    />
                  </div>

                  {isBrushLike ? (
                    <div className="dc-field-row">
                      <span className="dc-field-label">Edge Softness ({Math.round(brushSoftness * 100)}%)</span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 118 }}
                        min={0}
                        max={1}
                        step={0.05}
                        value={brushSoftness}
                        onChange={(e) => st.setBrushParams({ brushSoftness: Number(e.target.value) })}
                      />
                    </div>
                  ) : (
                    <div className="dc-field-row">
                      <span className="dc-field-label">
                        {isErase ? "Cutout" : "Fill"} Edge Softness ({terrainFillSoftness === 0 ? "Crisp" : `${Math.round(terrainFillSoftness * 100)}%`})
                      </span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 118 }}
                        min={0}
                        max={1}
                        step={0.05}
                        value={terrainFillSoftness}
                        onChange={(e) => st.setBrushParams({ terrainFillSoftness: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {!isErase && (
                    <>
                      {/* Directional Slope / Texture Angle & Downhill Depth Shading */}
                      <div
                        style={{
                          padding: "7px 8px",
                          borderRadius: 6,
                          background: "var(--bg-panel)",
                          border: "1px solid var(--border-subtle)",
                          marginTop: 4,
                          marginBottom: 6,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "var(--accent-gold)",
                            marginBottom: 5,
                          }}
                        >
                          <span>Slope / Texture Direction</span>
                          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                            {Math.round(terrainRotationDeg)}°
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, marginBottom: 6 }}>
                          {[
                            { deg: 0, label: "→ E" },
                            { deg: 90, label: "↓ S" },
                            { deg: 180, label: "← W" },
                            { deg: 270, label: "↑ N" },
                          ].map((dir) => (
                            <button
                              key={dir.deg}
                              type="button"
                              className={`dc-chip ${Math.round(terrainRotationDeg) % 360 === dir.deg ? "active" : ""}`}
                              style={{ justifyContent: "center", height: 21, fontSize: 10, padding: 0 }}
                              title={`Aim downhill slope / texture toward ${dir.label} (${dir.deg}°)`}
                              onClick={() => st.setBrushParams({ terrainRotationDeg: dir.deg })}
                            >
                              {dir.label}
                            </button>
                          ))}
                        </div>
                        <div className="dc-field-row" style={{ marginBottom: 5 }}>
                          <span className="dc-field-label">Custom Angle</span>
                          <input
                            type="range"
                            className="dc-range"
                            style={{ width: 112 }}
                            min={0}
                            max={355}
                            step={5}
                            value={terrainRotationDeg}
                            onChange={(e) => st.setBrushParams({ terrainRotationDeg: Number(e.target.value) })}
                          />
                        </div>
                        <div className="dc-field-row" style={{ marginBottom: 0 }}>
                          <span
                            className="dc-field-label"
                            title="Adds automatic uphill highlight to downhill shadow depth across filled slope regions"
                          >
                            Steep Slope Shade ({terrainSlopeShade === 0 ? "Off" : `${Math.round(terrainSlopeShade * 100)}%`})
                          </span>
                          <input
                            type="range"
                            className="dc-range"
                            style={{ width: 100 }}
                            min={0}
                            max={0.85}
                            step={0.05}
                            value={terrainSlopeShade}
                            onChange={(e) => st.setBrushParams({ terrainSlopeShade: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: 6, marginBottom: 8 }}>
                        <ColorStudioPanel
                          recolor={toolRecolors.terrain}
                          asset={vaultById.get(activeTerrainAssetId)}
                          eyedropperTarget="terrain"
                          title="Colorize Terrain"
                          compact
                          onChange={(next) => st.setToolRecolor("terrain", next)}
                        />
                      </div>
                    </>
                  )}
                </>
                );
              })()}

              {activeTool === "wall" && (() => {
                const refFloor = doc.mode !== "world" ? getOnionSkinReferenceLevel(doc) : null;
                const refWallCount = refFloor
                  ? doc.layers
                      .filter((l) => l.levelId === refFloor.id)
                      .reduce((acc, l) => acc + (l.walls?.length ?? 0), 0)
                  : 0;
                return (
                <>
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--accent-gold)",
                        marginBottom: 5,
                      }}
                    >
                      Wall Build Mode (1–6)
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 4,
                      }}
                    >
                      {(
                        [
                          { id: "free" as WallDrawMode, label: "1 · Free Wall" },
                          { id: "box" as WallDrawMode, label: "2 · Box Room" },
                          { id: "circle" as WallDrawMode, label: "3 · Circle / Tower" },
                          { id: "arc" as WallDrawMode, label: "4 · 3-Pt Arc" },
                          { id: "split" as WallDrawMode, label: "5 · Split / Breach" },
                          { id: "corridor" as WallDrawMode, label: "6 · Corridor" },
                        ]
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className={`dc-chip ${wallDrawMode === m.id ? "active" : ""}`}
                          style={{ justifyContent: "center", height: 25, fontSize: 10.5 }}
                          onClick={() => st.setBrushParams({ wallDrawMode: m.id })}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 5,
                        fontSize: 10,
                        color: "var(--text-muted)",
                        lineHeight: 1.35,
                      }}
                    >
                      {wallDrawMode === "box"
                        ? "Drag corner-to-corner for a closed room · Hold Shift for square, Ctrl for center-out · Q/E rotates for angled streets."
                        : wallDrawMode === "circle"
                          ? "Click center & drag outward for round towers, ovals, or regular hex/octagon bastions · Q/E rotates."
                          : wallDrawMode === "arc"
                            ? "Click Start → Click End → Pull bow for exact circular bays, apses & curved facades · Hold Shift for 90°/180°."
                            : wallDrawMode === "split"
                              ? "Click any active-floor wall to carve an open archway/breach or split a perimeter seam cleanly."
                              : wallDrawMode === "corridor"
                                ? "Click hallway centerline points (Double-click / Enter to finish) to build parallel corridor walls."
                                : "Click wall vertices (Double-click / Enter to finish, click start dot to close) · Hold Shift for 45°/90° lock · C curves."}
                    </div>
                  </div>

                  {/* Mode-Specific Controls */}
                  {wallDrawMode === "free" && (
                    <div
                      style={{
                        padding: "6px 8px",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: 8,
                      }}
                    >
                      <div className="dc-field-row" style={{ marginBottom: 4 }}>
                        <span className="dc-field-label">Next Section (C)</span>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <button
                            type="button"
                            className={`dc-chip ${!wallCurved ? "active" : ""}`}
                            onClick={() => st.setBrushParams({ wallCurved: false })}
                          >
                            Straight
                          </button>
                          <button
                            type="button"
                            className={`dc-chip ${wallCurved ? "active" : ""}`}
                            onClick={() => st.setBrushParams({ wallCurved: true })}
                          >
                            Curved
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 9.5, color: "var(--text-muted)", lineHeight: 1.35 }}>
                        {wallCurved
                          ? "Click the section's end corner, pull the curve bow, then click to lock (Shift = 90°/180°). Press C anytime for straight."
                          : "Press C mid-wall to bow just the next section into a curve while keeping other walls straight."}
                      </div>
                    </div>
                  )}

                  {wallDrawMode === "box" && (
                    <div
                      style={{
                        padding: "7px 8px",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: 8,
                      }}
                    >
                      <div className="dc-field-row" style={{ marginBottom: 5 }}>
                        <span className="dc-field-label">Box Angle (Q / E)</span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent-gold)" }}>
                          {Math.round(wallBoxRotationDeg)}°
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 3, marginBottom: 5 }}>
                        {[0, 30, 45, 60].map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            className={`dc-chip ${Math.round(wallBoxRotationDeg) % 180 === deg ? "active" : ""}`}
                            style={{ justifyContent: "center", height: 21, fontSize: 10, padding: 0 }}
                            onClick={() => st.setBrushParams({ wallBoxRotationDeg: deg })}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                      <input
                        type="range"
                        className="dc-range"
                        min={0}
                        max={165}
                        step={15}
                        aria-label="Box Wall Angle"
                        value={wallBoxRotationDeg % 180}
                        onChange={(e) => st.setBrushParams({ wallBoxRotationDeg: Number(e.target.value) })}
                      />
                    </div>
                  )}

                  {wallDrawMode === "circle" && (
                    <div
                      style={{
                        padding: "7px 8px",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "var(--accent-gold)",
                          marginBottom: 5,
                        }}
                      >
                        Tower / Polygon Shape
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 3, marginBottom: 6 }}>
                        {(
                          [
                            { id: "round" as WallPolygonShape, label: "Round" },
                            { id: "oval" as WallPolygonShape, label: "Oval" },
                            { id: "hex" as WallPolygonShape, label: "6" },
                            { id: "octagon" as WallPolygonShape, label: "8" },
                            { id: "dodecagon" as WallPolygonShape, label: "12" },
                          ]
                        ).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={`dc-chip ${wallPolygonShape === s.id ? "active" : ""}`}
                            style={{ justifyContent: "center", height: 22, fontSize: 10, padding: 0 }}
                            onClick={() => st.setBrushParams({ wallPolygonShape: s.id })}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">Orientation ({Math.round(wallBoxRotationDeg)}°)</span>
                        <input
                          type="range"
                          className="dc-range"
                          style={{ width: 110 }}
                          min={0}
                          max={345}
                          step={15}
                          value={wallBoxRotationDeg}
                          onChange={(e) => st.setBrushParams({ wallBoxRotationDeg: Number(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}

                  {wallDrawMode === "split" && (
                    <div
                      style={{
                        padding: "7px 8px",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: 8,
                      }}
                    >
                      <div className="dc-field-row" style={{ marginBottom: 6 }}>
                        <span className="dc-field-label">Cut Action</span>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          {(
                            [
                              { id: "breach" as WallSplitSubMode, label: "Carve Breach" },
                              { id: "split" as WallSplitSubMode, label: "Split Seam" },
                            ]
                          ).map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              className={`dc-chip ${wallSplitSubMode === sub.id ? "active" : ""}`}
                              style={{ height: 22, fontSize: 10 }}
                              onClick={() => st.setBrushParams({ wallSplitSubMode: sub.id })}
                            >
                              {sub.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {wallSplitSubMode === "breach" && (
                        <div className="dc-field-row" style={{ marginBottom: 0 }}>
                          <span className="dc-field-label">Breach Width ({wallBreachWidthCells.toFixed(1)} sq)</span>
                          <input
                            type="range"
                            className="dc-range"
                            style={{ width: 108 }}
                            min={0.6}
                            max={6.0}
                            step={0.2}
                            value={wallBreachWidthCells}
                            onChange={(e) =>
                              st.setBrushParams({ wallBreachWidthCells: Number(e.target.value) })
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {wallDrawMode === "corridor" && (
                    <div
                      style={{
                        padding: "7px 8px",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: 8,
                      }}
                    >
                      <div className="dc-field-row" style={{ marginBottom: 6 }}>
                        <span className="dc-field-label">Hallway Width ({wallCorridorWidthCells.toFixed(1)} sq)</span>
                        <input
                          type="range"
                          className="dc-range"
                          style={{ width: 108 }}
                          min={1.0}
                          max={6.0}
                          step={0.25}
                          value={wallCorridorWidthCells}
                          onChange={(e) =>
                            st.setBrushParams({ wallCorridorWidthCells: Number(e.target.value) })
                          }
                        />
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 5 }}>
                        <span className="dc-field-label">Seal Corridor End Caps</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wallCorridorCapEnds}
                          className="dc-switch"
                          onClick={() => st.setBrushParams({ wallCorridorCapEnds: !wallCorridorCapEnds })}
                        />
                      </div>
                      <div className="dc-field-row" style={{ marginBottom: 0 }}>
                        <span className="dc-field-label">Curved Corridor (C)</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wallCurved}
                          className="dc-switch"
                          onClick={() => st.setBrushParams({ wallCurved: !wallCurved })}
                        />
                      </div>
                    </div>
                  )}

                  {wallDrawMode !== "split" && (
                    <>
                      <div className="dc-field-row" style={{ marginBottom: wallAutoFillClosed ? 5 : 8 }}>
                        <span
                          className="dc-field-label"
                          title="Automatically lay down your active floor terrain whenever you build a Box, Tower, Corridor, or closed room loop"
                        >
                          Auto-Fill Closed Rooms
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wallAutoFillClosed}
                          className="dc-switch"
                          onClick={() => st.setBrushParams({ wallAutoFillClosed: !wallAutoFillClosed })}
                        />
                      </div>
                      {wallAutoFillClosed && recentTerrainAssetIds.length > 0 && (
                        <div
                          style={{
                            padding: "6px 7px",
                            borderRadius: 6,
                            background: "var(--bg-panel)",
                            border: "1px solid var(--border-subtle)",
                            marginBottom: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 9.5,
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              color: "var(--accent-gold)",
                              marginBottom: 4,
                            }}
                          >
                            Auto-Fill Floor · Last 3 Used
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {recentTerrainAssetIds.slice(0, 3).map((tid) => {
                              const tAsset = vaultById.get(tid);
                              const tName =
                                tAsset?.displayName ??
                                tid.split("/").pop()?.replace(/\.[^.]+$/, "").replace(/_/g, " ") ??
                                "Floor";
                              const isAct = tid === activeTerrainAssetId;
                              return (
                                <button
                                  key={tid}
                                  type="button"
                                  className={`dc-chip ${isAct ? "active" : ""}`}
                                  style={{
                                    width: "100%",
                                    height: 24,
                                    padding: "0 7px",
                                    gap: 7,
                                    justifyContent: "space-between",
                                    fontSize: 10.5,
                                    overflow: "hidden",
                                  }}
                                  title={`Auto-fill new closed rooms with ${tName}`}
                                  onClick={() => st.setBrushParams({ activeTerrainAssetId: tid })}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 7,
                                      minWidth: 0,
                                      flex: 1,
                                      overflow: "hidden",
                                    }}
                                  >
                                    <img
                                      src={resolveAssetUrl(tid, vaultById)}
                                      alt=""
                                      style={{
                                        width: 15,
                                        height: 15,
                                        borderRadius: 3,
                                        objectFit: "cover",
                                        border: "1px solid rgba(255,255,255,0.22)",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {tName}
                                    </span>
                                  </span>
                                  {isAct && (
                                    <span style={{ fontSize: 9, fontWeight: 700, flexShrink: 0 }}>
                                      ACTIVE
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {renderMaterialPicker("Wall Material Style", wallAssets, activeWallAssetId, (id) =>
                        st.setBrushParams({ activeWallAssetId: id }),
                      )}
                      <div className="dc-field-row">
                        <span className="dc-field-label">Thickness ({wallThicknessCells.toFixed(2)})</span>
                        <input
                          type="range"
                          className="dc-range"
                          style={{ width: 118 }}
                          min={0.18}
                          max={0.8}
                          step={0.04}
                          value={wallThicknessCells}
                          onChange={(e) => st.setBrushParams({ wallThicknessCells: Number(e.target.value) })}
                        />
                      </div>
                      <div className="dc-field-row">
                        <span
                          className="dc-field-label"
                          title="Magnetically snaps wall starts & corners onto existing wall corners and edges for airtight T-junctions"
                        >
                          Magnetic Wall Snap
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wallSnapToWalls}
                          className="dc-switch"
                          onClick={() => st.setBrushParams({ wallSnapToWalls: !wallSnapToWalls })}
                        />
                      </div>
                      <div className="dc-field-row">
                        <span className="dc-field-label">Blocks Light &amp; VTT Sight</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wallBlocksLight}
                          className="dc-switch"
                          onClick={() => st.setBrushParams({ wallBlocksLight: !wallBlocksLight })}
                        />
                      </div>
                    </>
                  )}

                  {refFloor && refWallCount > 0 && (
                    <button
                      type="button"
                      className="dc-btn"
                      style={{
                        width: "100%",
                        height: 27,
                        marginTop: 4,
                        marginBottom: 6,
                        fontSize: 11,
                        borderColor: "rgba(34, 211, 238, 0.45)",
                        color: "#67E8F9",
                      }}
                      title={`Duplicate ${refWallCount} wall footprint(s) from ${refFloor.shortCode} onto ${activeLevel?.shortCode ?? "this floor"} (Ctrl+Z supported)`}
                      onClick={() => st.copyWallsFromLevelBelow()}
                    >
                      <Copy size={12} />
                      <span>
                        Copy Walls from {refFloor.shortCode} ({refWallCount})
                      </span>
                    </button>
                  )}

                  {wallDrawMode !== "split" && (
                    <div style={{ marginTop: 6, marginBottom: 8 }}>
                      <ColorStudioPanel
                        recolor={toolRecolors.wall}
                        asset={vaultById.get(activeWallAssetId)}
                        eyedropperTarget="wall"
                        title="Colorize New Walls"
                        compact
                        onChange={(next) => st.setToolRecolor("wall", next)}
                      />
                    </div>
                  )}
                </>
                );
              })()}

              {activeTool === "portal" && (
                <>
                  {renderMaterialPicker("Inset Door / Window Style", portalAssets, activePortalAssetId, (id) =>
                    st.setBrushParams({ activePortalAssetId: id }),
                  )}
                  <div className="dc-field-row">
                    <span className="dc-field-label">Opening Width ({activePortalWidthCells.toFixed(1)} sq)</span>
                    <input
                      type="range"
                      className="dc-range"
                      style={{ width: 118 }}
                      min={0.8}
                      max={3.0}
                      step={0.1}
                      value={activePortalWidthCells}
                      onChange={(e) => st.setBrushParams({ activePortalWidthCells: Number(e.target.value) })}
                    />
                  </div>
                  <div className="dc-field-row">
                    <span className="dc-field-label">Place Closed Initially</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activePortalClosed}
                      className="dc-switch"
                      onClick={() => st.setBrushParams({ activePortalClosed: !activePortalClosed })}
                    />
                  </div>
                  <div className="dc-field-row">
                    <span className="dc-field-label">Swing Direction (X)</span>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button
                        type="button"
                        className={`dc-chip ${!activePortalSwingInvert ? "active" : ""}`}
                        onClick={() => st.setBrushParams({ activePortalSwingInvert: false })}
                      >
                        Inward
                      </button>
                      <button
                        type="button"
                        className={`dc-chip ${activePortalSwingInvert ? "active" : ""}`}
                        onClick={() => st.setBrushParams({ activePortalSwingInvert: true })}
                      >
                        Outward
                      </button>
                    </div>
                  </div>
                  <div className="dc-field-row">
                    <span className="dc-field-label">Hinge Side (Y)</span>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button
                        type="button"
                        className={`dc-chip ${!activePortalHingeFlip ? "active" : ""}`}
                        onClick={() => st.setBrushParams({ activePortalHingeFlip: false })}
                      >
                        Left
                      </button>
                      <button
                        type="button"
                        className={`dc-chip ${activePortalHingeFlip ? "active" : ""}`}
                        onClick={() => st.setBrushParams({ activePortalHingeFlip: true })}
                      >
                        Right
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 6, marginBottom: 8 }}>
                    <ColorStudioPanel
                      recolor={toolRecolors.portal}
                      asset={vaultById.get(activePortalAssetId)}
                      eyedropperTarget="portal"
                      title="Colorize Door / Window"
                      compact
                      onChange={(next) => st.setToolRecolor("portal", next)}
                    />
                  </div>
                </>
              )}

              {activeTool === "path" && (
                <>
                  <div className="dc-field-row">
                    <span className="dc-field-label">Next Section (C)</span>
                    <div style={{ display: "inline-flex", gap: 4 }}>
                      <button
                        type="button"
                        className={`dc-chip ${!pathCurved ? "active" : ""}`}
                        onClick={() => st.setBrushParams({ pathCurved: false })}
                      >
                        Straight
                      </button>
                      <button
                        type="button"
                        className={`dc-chip ${pathCurved ? "active" : ""}`}
                        onClick={() => st.setBrushParams({ pathCurved: true })}
                      >
                        Curved
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      background: "var(--bg-panel)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 6,
                      padding: "5px 7px",
                      marginBottom: 6,
                      lineHeight: 1.38,
                    }}
                  >
                    {pathCurved ? (
                      <>
                        <strong style={{ color: "#C084FC" }}>Curved Next Section:</strong> Click end point, then move mouse to pull live arc bow &amp; click to lock (Shift snaps 90°/180°). Press <strong>C</strong> mid-line to switch back to Straight!
                      </>
                    ) : (
                      <>
                        Click points for crisp straight runs · Press <strong>C</strong> mid-line to bow just the next section into a smooth circular curve · <strong>Shift</strong> locks 45°/90°.
                      </>
                    )}
                  </div>
                  {renderMaterialPicker("Line / Spline Path Style", pathAssets, activePathAssetId, (id) =>
                    st.setBrushParams({ activePathAssetId: id }),
                  )}
                  <div className="dc-field-row">
                    <span className="dc-field-label">Path / Cliff Width ({pathWidthCells.toFixed(2)} sq)</span>
                    <input
                      type="range"
                      className="dc-range"
                      style={{ width: 118 }}
                      min={0.3}
                      max={10.0}
                      step={0.1}
                      value={pathWidthCells}
                      onChange={(e) => st.setBrushParams({ pathWidthCells: Number(e.target.value) })}
                    />
                  </div>
                  <div className="dc-field-row">
                    <span
                      className="dc-field-label"
                      title="Reverses uphill crest vs downhill drop side when drawing steep embankments or cliffs"
                    >
                      Flip Slope / Side
                    </span>
                    <button
                      type="button"
                      className={`dc-chip ${pathFlipSide ? "active" : ""}`}
                      style={{ height: 22, fontSize: 10 }}
                      onClick={() => st.setBrushParams({ pathFlipSide: !pathFlipSide })}
                    >
                      {pathFlipSide ? "Flipped (Reversed)" : "Flip Uphill ↔ Downhill"}
                    </button>
                  </div>
                  <div className="dc-field-row">
                    <span className="dc-field-label">Taper Ends</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={pathTaperEnds}
                      className="dc-switch"
                      onClick={() => st.setBrushParams({ pathTaperEnds: !pathTaperEnds })}
                    />
                  </div>
                  <div style={{ marginTop: 6, marginBottom: 8 }}>
                    <ColorStudioPanel
                      recolor={toolRecolors.path}
                      asset={vaultById.get(activePathAssetId)}
                      eyedropperTarget="path"
                      title="Colorize Line / Path"
                      compact
                      onChange={(next) => st.setToolRecolor("path", next)}
                    />
                  </div>
                </>
              )}

              {activeTool === "stamp" && (
                <>
                  {doc.mode === "world" && (() => {
                    const activeSym = selectedVaultAssetId
                      ? vaultById.get(selectedVaultAssetId)
                      : undefined;
                    const symFamily =
                      activeSym?.category === "symbol"
                        ? findWorldSymbolFamilyVariants(activeSym, allVaultAssets)
                        : null;
                    const modeLabel =
                      activeSym?.drawMode === "sample_color"
                        ? "Paintable Biome"
                        : activeSym?.drawMode === "tint"
                          ? "Engraved Ink"
                          : activeSym?.drawMode === "rgb_channels"
                            ? "Custom RGB"
                            : "Full Color";
                    const forestPresetOn =
                      stampPaintDrag && worldSymbolMultiVariant && stampRandomFlipX && stampRandomJitter;
                    return (
                      <div
                        style={{
                          marginBottom: 10,
                          padding: 8,
                          borderRadius: 7,
                          background: "rgba(229, 169, 60, 0.08)",
                          border: "1px solid rgba(229, 169, 60, 0.28)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "var(--accent-gold)",
                            }}
                          >
                            World Symbol Smart Brush
                          </span>
                          {symFamily && symFamily.variants.length > 1 && (
                            <button
                              type="button"
                              className="dc-btn dc-btn-ghost"
                              style={{ height: 19, fontSize: 9.5, padding: "0 6px" }}
                              title="Pick another sibling illustration in this same species family"
                              onClick={() => {
                                const next = pickNextWorldVariant(symFamily.variants, activeSym?.id);
                                useVaultStore.getState().setSelectedAssetId(next.id);
                              }}
                            >
                              Cycle Variant
                            </button>
                          )}
                        </div>

                        {symFamily && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 6,
                              padding: "4px 6px",
                              borderRadius: 5,
                              background: "rgba(12, 16, 24, 0.55)",
                              border: "1px solid rgba(255,255,255,0.08)",
                              fontSize: 10,
                            }}
                          >
                            <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                              {symFamily.familyLabel}
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 9.5,
                                color: "#7DD3FC",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {symFamily.variants.length} {modeLabel}
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          className={`dc-btn ${forestPresetOn ? "dc-btn-gold" : "dc-btn-ghost"}`}
                          style={{
                            height: 25,
                            fontSize: 10.5,
                            justifyContent: "center",
                            border: forestPresetOn
                              ? "1px solid rgba(52, 211, 153, 0.72)"
                              : "1px solid rgba(229, 169, 60, 0.35)",
                            background: forestPresetOn
                              ? "rgba(16, 185, 129, 0.22)"
                              : "rgba(229, 169, 60, 0.12)",
                            color: forestPresetOn ? "#6EE7B7" : "var(--accent-gold)",
                            fontWeight: 600,
                          }}
                          title="One-click Wonderdraft-style forest & mountain range Paint-In (drag to scatter non-repeating siblings from this species family with random flip & scale jitter)"
                          onClick={() => {
                            if (forestPresetOn) {
                              st.setBrushParams({ stampPaintDrag: false });
                            } else {
                              st.setBrushParams({
                                stampPaintDrag: true,
                                worldSymbolMultiVariant: true,
                                stampRandomFlipX: true,
                                stampRandomJitter: true,
                                stampPaintSpacingCells: Math.min(stampPaintSpacingCells, 1.05),
                              });
                              st.pushToast(
                                symFamily
                                  ? `Forest / Range Paint-In ON (${symFamily.familyLabel} · ${symFamily.variants.length} variants)`
                                  : "Forest / Range Paint-In ON — drag on land to paint!",
                                "success",
                              );
                            }
                          }}
                        >
                          {forestPresetOn
                            ? "Forest / Range Paint-In Active (Drag on Map)"
                            : "Enable Forest / Range Paint-In Brush"}
                        </button>

                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-primary)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={worldSymbolAvoidWater}
                            onChange={(e) => st.setBrushParams({ worldSymbolAvoidWater: e.target.checked })}
                          />
                          Avoid Ocean / Water (Land symbols)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-primary)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={worldSymbolSampleBiome}
                            onChange={(e) => st.setBrushParams({ worldSymbolSampleBiome: e.target.checked })}
                          />
                          Auto-sample ground biome (`sample_color`)
                        </label>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-primary)", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={worldSymbolMultiVariant}
                            onChange={(e) => st.setBrushParams({ worldSymbolMultiVariant: e.target.checked })}
                          />
                          Species-locked Multi-Variant Paint-In
                        </label>
                      </div>
                    );
                  })()}

                  {/* Same-Layer Placement Stacking Order (Above / Below) */}
                  <div style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--accent-gold)",
                        marginBottom: 5,
                      }}
                    >
                      Placement Stack Order (U)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      <button
                        type="button"
                        className={`dc-chip ${stampPlacementOrder === "above" ? "active" : ""}`}
                        style={{ justifyContent: "center", height: 26, fontSize: 11 }}
                        onClick={() => st.setBrushParams({ stampPlacementOrder: "above" })}
                      >
                        Place Above
                      </button>
                      <button
                        type="button"
                        className={`dc-chip ${stampPlacementOrder === "below" ? "active" : ""}`}
                        style={{ justifyContent: "center", height: 26, fontSize: 11 }}
                        onClick={() => st.setBrushParams({ stampPlacementOrder: "below" })}
                      >
                        Place Below
                      </button>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-muted)", lineHeight: 1.35 }}>
                      {stampPlacementOrder === "below"
                        ? "Next asset slips underneath overlapping or last-placed props on this layer (great for rugs, shadows & canopy underlayers)."
                        : "Next asset stacks cleanly on top of existing props on this layer."}
                    </div>
                  </div>

                  <div className="dc-field-row">
                    <span className="dc-field-label">Stamp Scale ({stampScale.toFixed(2)}×)</span>
                    <input
                      type="range"
                      className="dc-range"
                      style={{ width: 120 }}
                      min={0.15}
                      max={3}
                      step={0.05}
                      value={stampScale}
                      onChange={(e) => st.setBrushParams({ stampScale: Number(e.target.value) })}
                    />
                  </div>

                  {/* Paint-In Drag Brush */}
                  <div className="dc-field-row">
                    <span
                      className="dc-field-label"
                      title="Click and drag to paint spaced trails of this prop onto the map in one Undo step"
                    >
                      Paint-In Drag Brush
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stampPaintDrag}
                      className="dc-switch"
                      onClick={() => st.setBrushParams({ stampPaintDrag: !stampPaintDrag })}
                    />
                  </div>
                  {stampPaintDrag && (
                    <div className="dc-field-row">
                      <span className="dc-field-label">
                        Paint Spacing ({stampPaintSpacingCells.toFixed(2)} sq)
                      </span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 116 }}
                        min={0.18}
                        max={4.0}
                        step={0.05}
                        value={stampPaintSpacingCells}
                        onChange={(e) =>
                          st.setBrushParams({ stampPaintSpacingCells: Number(e.target.value) })
                        }
                      />
                    </div>
                  )}

                  {/* Auto-Rotate Toggle & Mode Settings */}
                  <div className="dc-field-row">
                    <span
                      className="dc-field-label"
                      title="Automatically rotate each stamped or painted asset using Random, Follow Path, or Fixed Step angles"
                    >
                      Auto-Rotate Assets
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stampAutoRotate}
                      className="dc-switch"
                      onClick={() => st.setBrushParams({ stampAutoRotate: !stampAutoRotate })}
                    />
                  </div>
                  {stampAutoRotate && (
                    <div
                      style={{
                        padding: "7px 8px",
                        borderRadius: 6,
                        background: "var(--bg-panel)",
                        border: "1px solid var(--border-subtle)",
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 6 }}>
                        {(
                          [
                            { id: "random" as StampRotateMode, label: "Random" },
                            { id: "follow" as StampRotateMode, label: "Follow Path" },
                            { id: "step" as StampRotateMode, label: "Step +°" },
                          ]
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            className={`dc-chip ${stampRotateMode === m.id ? "active" : ""}`}
                            style={{ justifyContent: "center", height: 22, fontSize: 10 }}
                            onClick={() => st.setBrushParams({ stampRotateMode: m.id })}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                      {stampRotateMode === "random" && (
                        <div className="dc-field-row" style={{ marginBottom: 0 }}>
                          <span className="dc-field-label">
                            Angle Spread ({stampRotateSpreadDeg >= 180 ? "360°" : `±${stampRotateSpreadDeg}°`})
                          </span>
                          <input
                            type="range"
                            className="dc-range"
                            style={{ width: 105 }}
                            min={15}
                            max={180}
                            step={15}
                            value={stampRotateSpreadDeg}
                            onChange={(e) =>
                              st.setBrushParams({ stampRotateSpreadDeg: Number(e.target.value) })
                            }
                          />
                        </div>
                      )}
                      {stampRotateMode === "step" && (
                        <div className="dc-field-row" style={{ marginBottom: 0 }}>
                          <span className="dc-field-label">Step Angle (+{stampRotateStepDeg}°)</span>
                          <input
                            type="range"
                            className="dc-range"
                            style={{ width: 105 }}
                            min={15}
                            max={180}
                            step={15}
                            value={stampRotateStepDeg}
                            onChange={(e) =>
                              st.setBrushParams({ stampRotateStepDeg: Number(e.target.value) })
                            }
                          />
                        </div>
                      )}
                      {stampRotateMode === "follow" && (
                        <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.35 }}>
                          Enable <strong>Paint-In Drag Brush</strong> and drag to align each painted asset along your stroke direction.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="dc-field-row">
                    <span className="dc-field-label">Random Size Jitter</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stampRandomJitter}
                      className="dc-switch"
                      onClick={() => st.setBrushParams({ stampRandomJitter: !stampRandomJitter })}
                    />
                  </div>
                  <div className="dc-field-row">
                    <span className="dc-field-label">Random Flip Horizontal</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stampRandomFlipX}
                      className="dc-switch"
                      onClick={() => st.setBrushParams({ stampRandomFlipX: !stampRandomFlipX })}
                    />
                  </div>
                  <div className="dc-field-row">
                    <span
                      className="dc-field-label"
                      title="Adds subtle natural hue & brightness variation on every click (great for mushrooms, foliage & market clutter)"
                    >
                      Random Color Variation
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stampColorJitter}
                      className="dc-switch"
                      onClick={() => st.setBrushParams({ stampColorJitter: !stampColorJitter })}
                    />
                  </div>
                  <div style={{ marginTop: 6, marginBottom: 8 }}>
                    <ColorStudioPanel
                      recolor={activeRecolor}
                      asset={selectedVaultAssetId ? vaultById.get(selectedVaultAssetId) : undefined}
                      eyedropperTarget="stamp"
                      title="Asset Color & Shader"
                      compact
                      onChange={(next) => st.setActiveRecolor(next)}
                    />
                  </div>
                </>
              )}

              {activeTool === "scatter" && (
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: "var(--text-secondary)",
                      background: "var(--bg-panel)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      marginBottom: 8,
                    }}
                  >
                    Pick props or a preset below, then click corners on the map to draw a{" "}
                    <strong style={{ color: "var(--accent-gold)" }}>Smart Scatter Zone</strong>{" "}
                    (double-click or Enter to populate).
                  </div>
                  <ScatterZonePanel
                    mode="tool"
                    name={scatterPresetName}
                    assetIds={scatterAssetIds}
                    minSpacingCells={scatterMinSpacing}
                    minScale={scatterMinScale}
                    maxScale={scatterMaxScale}
                    avoidWalls={scatterAvoidWalls}
                    avoidPaths={scatterAvoidPaths}
                    onChangeAssets={(nextIds, presetLabel) =>
                      st.setBrushParams({
                        scatterAssetIds: nextIds,
                        ...(presetLabel ? { scatterPresetName: presetLabel } : {}),
                      })
                    }
                    onChangeSettings={(partial) =>
                      st.setBrushParams({
                        ...(partial.minSpacingCells !== undefined
                          ? { scatterMinSpacing: partial.minSpacingCells }
                          : {}),
                        ...(partial.minScale !== undefined ? { scatterMinScale: partial.minScale } : {}),
                        ...(partial.maxScale !== undefined ? { scatterMaxScale: partial.maxScale } : {}),
                        ...(partial.avoidWalls !== undefined ? { scatterAvoidWalls: partial.avoidWalls } : {}),
                        ...(partial.avoidPaths !== undefined ? { scatterAvoidPaths: partial.avoidPaths } : {}),
                      })
                    }
                  />
                </div>
              )}

              {activeTool === "light" && (
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-secondary)",
                      background: "var(--bg-panel)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      marginBottom: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    Click any <strong style={{ color: "var(--accent-gold)" }}>light bulb</strong> on the map to select &amp; drag it. Click open space (or <strong>Shift+Click</strong>) to place a new light.
                  </div>

                  {/* Scene Atmosphere (exclusively in Lighting & Atmosphere!) */}
                  <div style={{ marginBottom: 10 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--accent-gold)",
                        marginBottom: 6,
                      }}
                    >
                      Scene Atmosphere
                    </div>
                    {renderSceneAtmosphereFields()}
                  </div>

                  {/* New Light Brush settings */}
                  <div
                    style={{
                      paddingTop: 8,
                      borderTop: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--accent-gold)",
                        marginBottom: 6,
                      }}
                    >
                      New Light Brush
                    </div>
                    <div className="dc-field-row">
                      <span className="dc-field-label">Light Color</span>
                      <input
                        type="color"
                        value={activeLightColorHex}
                        onChange={(e) => st.setBrushParams({ activeLightColorHex: e.target.value })}
                      />
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                      {LIGHT_SWATCHES.map((sw) => (
                        <button
                          key={sw.hex}
                          type="button"
                          title={sw.label}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: sw.hex,
                            border:
                              activeLightColorHex.toUpperCase() === sw.hex
                                ? "2px solid #fff"
                                : "1px solid var(--border-strong)",
                            cursor: "pointer",
                          }}
                          onClick={() => st.setBrushParams({ activeLightColorHex: sw.hex })}
                        />
                      ))}
                    </div>
                    <div className="dc-field-row">
                      <span className="dc-field-label">Radius ({activeLightRadiusCells} sq)</span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 120 }}
                        min={2}
                        max={22}
                        step={0.5}
                        value={activeLightRadiusCells}
                        onChange={(e) => st.setBrushParams({ activeLightRadiusCells: Number(e.target.value) })}
                      />
                    </div>
                    <div className="dc-field-row">
                      <span className="dc-field-label">Intensity ({activeLightIntensity.toFixed(1)})</span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 120 }}
                        min={0.2}
                        max={2}
                        step={0.1}
                        value={activeLightIntensity}
                        onChange={(e) => st.setBrushParams({ activeLightIntensity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="dc-field-row">
                      <span className="dc-field-label">Cone Angle ({activeLightConeDeg}°)</span>
                      <input
                        type="range"
                        className="dc-range"
                        style={{ width: 120 }}
                        min={30}
                        max={360}
                        step={10}
                        value={activeLightConeDeg}
                        onChange={(e) => st.setBrushParams({ activeLightConeDeg: Number(e.target.value) })}
                      />
                    </div>
                    <div className="dc-field-row">
                      <span className="dc-field-label">Cast 2D Shadows</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={activeLightCastShadows}
                        className="dc-switch"
                        onClick={() => st.setBrushParams({ activeLightCastShadows: !activeLightCastShadows })}
                      />
                    </div>
                  </div>

                  {/* Quick-select list of all lights on the active floor */}
                  {renderFloorLightsList()}
                </div>
              )}

              {/* Idle Select mode (Battlemap only; World mode shows WorldStudioPanel above!) */}
              {activeTool === "select" && doc.mode !== "world" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div className="dc-field-row" style={{ marginBottom: 0 }}>
                    <span className="dc-field-label">Grid Style</span>
                    <select
                      className="dc-select"
                      value={doc.canvas.grid.type}
                      onChange={(e) =>
                        st.setGridSettings({
                          type: e.target.value as "square" | "hex_flat" | "hex_pointy" | "none",
                        })
                      }
                    >
                      <option value="square">Square (1&quot;)</option>
                      <option value="hex_flat">Hex (Flat Top)</option>
                      <option value="hex_pointy">Hex (Pointy Top)</option>
                      <option value="none">Gridless</option>
                    </select>
                  </div>
                  <div className="dc-field-row" style={{ marginBottom: 0 }}>
                    <span className="dc-field-label">Snap Mode</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {(["grid", "half", "free"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className={`dc-chip ${snapMode === m ? "active" : ""}`}
                          onClick={() => st.setSnapMode(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      paddingTop: 8,
                      borderTop: "1px solid var(--border-subtle)",
                    }}
                  >
                    <button
                      type="button"
                      className="dc-btn"
                      style={{ width: "100%", fontSize: 11, height: 28, justifyContent: "center" }}
                      onClick={() => st.setActiveTool("light")}
                    >
                      <Sun size={13} style={{ color: "var(--accent-gold)" }} />
                      <span>Lighting &amp; Atmosphere (L)</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTool === "water" && <WaterStudioPanel />}

              {activeTool === "roof" && <RoofStudioPanel />}

              {activeTool === "template" && <TemplatesPanel />}

              {(activeTool === "dm_note" || (activeTool === "measure" && doc.mode !== "world")) && (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    lineHeight: 1.45,
                  }}
                >
                  {activeTool === "dm_note"
                    ? "Click anywhere on the map to drop a DM-only secret note pin. Pins are automatically stripped from Player TV and VTT exports."
                    : "Click and drag across the map to measure exact tactical distance in squares, feet (5ft/sq), and calibrated 55\" 4K TV inches."}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {dragGhost && (
        <div
          style={{
            position: "fixed",
            left: dragGhost.x + 12,
            top: dragGhost.y - 14,
            zIndex: 9999,
            pointerEvents: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 10px",
            borderRadius: 7,
            background: "rgba(18, 21, 30, 0.96)",
            border: "1px solid rgba(229, 169, 60, 0.8)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.55)",
            color: "var(--text-primary)",
            fontSize: 11.5,
            fontWeight: 600,
            maxWidth: 230,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          <GripVertical size={12} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{dragGhost.name}</span>
        </div>
      )}
    </aside>
  );
});

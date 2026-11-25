import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FolderPlus,
  Globe,
  Layers,
  LayoutGrid,
  Link2,
  Link2Off,
  Map as MapIcon,
  Maximize2,
  RotateCw,
  Search,
  Star,
  X,
} from "lucide-react";
import {
  describeAssetColorCapability,
  isNativeColorableAsset,
} from "@/engine/colorShader";
import { WORLD_GROUP_SPECIES } from "@/engine/worldEngine";
import { useDocumentStore } from "@/store/documentStore";
import {
  CATEGORY_FACETS,
  formatVaultSourceLabel,
  matchesCategoryFacet,
  matchesSubGroup,
  OBJECT_SUBGROUPS,
  useFilteredVaultAssets,
  useVaultStore,
  VAULT_SORT_OPTIONS,
  WORLD_ASSET_GROUPS,
  type VaultSortMode,
  type WorldDrawModeFilter,
} from "@/store/vaultStore";
import type { ContextMenuEntry } from "@/ui/common/ContextMenu";
import {
  buildAssetContextMenuEntries,
  equipVaultAsset,
  filterObjectTemplates,
  SOURCE_BADGE,
  TEMPLATE_CATEGORY_PILLS,
  VaultActiveFilterChips,
  VaultTemplateCard,
} from "@/ui/vault/vaultShared";
import type { AssetCategory, ToolId, VaultAsset } from "@/types/map";

interface AssetVaultDrawerProps {
  onOpenContextMenu: (
    x: number,
    y: number,
    ariaLabel: string,
    entries: ContextMenuEntry[],
  ) => void;
}

const BATTLEMAP_CATEGORIES: Array<{ id: AssetCategory; label: string }> = [
  { id: "object", label: "Objects & Props" },
  { id: "portal", label: "Doors & Windows" },
  { id: "wall", label: "Walls & Fences" },
  { id: "terrain", label: "Floors & Terrain" },
  { id: "path", label: "Paths & Tracks" },
];

const TOOL_TO_CATEGORY: Partial<Record<ToolId, AssetCategory>> = {
  stamp: "object",
  terrain: "terrain",
  wall: "wall",
  path: "path",
  portal: "portal",
  roof: "terrain",
};

const TILE_SIZES: Record<"sm" | "md" | "lg", { w: number; h: number }> = {
  sm: { w: 84, h: 46 },
  md: { w: 104, h: 58 },
  lg: { w: 132, h: 76 },
};

export const AssetVaultDrawer: React.FC<AssetVaultDrawerProps> = React.memo(({
  onOpenContextMenu,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wdZipInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sortSelectId = useId();
  const [visibleLimit, setVisibleLimit] = useState(96);
  const [liveStatusMsg, setLiveStatusMsg] = useState("");

  const drawerOpen = useDocumentStore((s) => s.vaultDrawerOpen);
  const activeTool = useDocumentStore((s) => s.activeTool);
  const docMode = useDocumentStore(
    (s) => (s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0]).mode,
  );
  const objectTemplates = useDocumentStore((s) => s.objectTemplates);
  const activeTemplateId = useDocumentStore((s) => s.activeTemplateId);
  const templateScale = useDocumentStore((s) => s.templateScale);
  const templateRotationRad = useDocumentStore((s) => s.templateRotationRad);
  const selection = useDocumentStore((s) => s.selection);

  const sources = useVaultStore((s) => s.sources);
  const activeSourceId = useVaultStore((s) => s.activeSourceId);
  const allAssets = useVaultStore((s) => s.assets);
  const assetById = useVaultStore((s) => s.assetById);
  const searchQuery = useVaultStore((s) => s.searchQuery);
  const sortMode = useVaultStore((s) => s.sortMode);
  const templatesView = useVaultStore((s) => s.templatesView);
  const templateCategoryFilter = useVaultStore((s) => s.templateCategoryFilter);
  const activeCategory = useVaultStore((s) => s.activeCategory);
  const activeCategoryFacet = useVaultStore((s) => s.activeCategoryFacet);
  const activeSubGroup = useVaultStore((s) => s.activeSubGroup);
  const activeWorldGroup = useVaultStore((s) => s.activeWorldGroup);
  const activeWorldDrawMode = useVaultStore((s) => s.activeWorldDrawMode);
  const activeWorldSet = useVaultStore((s) => s.activeWorldSet);
  const activeKitId = useVaultStore((s) => s.activeKitId);
  const favoritesOnly = useVaultStore((s) => s.favoritesOnly);
  const recentOnly = useVaultStore((s) => s.recentOnly);
  const colorableOnly = useVaultStore((s) => s.colorableOnly);
  const recentAssetIds = useVaultStore((s) => s.recentAssetIds);
  const biomeKits = useVaultStore((s) => s.biomeKits);
  const selectedAssetId = useVaultStore((s) => s.selectedAssetId);
  const autoSyncTool = useVaultStore((s) => s.autoSyncTool);
  const drawerHeightPx = useVaultStore((s) => s.drawerHeightPx);
  const drawerTileSize = useVaultStore((s) => s.drawerTileSize);
  const collapsedTreeSections = useVaultStore((s) => s.collapsedTreeSections);

  const filteredAssets = useFilteredVaultAssets();
  const filteredTemplates = useMemo(
    () => filterObjectTemplates(objectTemplates, templateCategoryFilter, searchQuery),
    [objectTemplates, templateCategoryFilter, searchQuery],
  );
  const savedTemplateCount = useMemo(
    () => objectTemplates.filter((t) => !t.isBuiltIn).length,
    [objectTemplates],
  );

  const vault = useVaultStore.getState();
  const docStore = useDocumentStore.getState();

  // Reset scroll window smoothly when active filter or sort changes
  useEffect(() => {
    setVisibleLimit(96);
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [
    searchQuery,
    sortMode,
    templatesView,
    templateCategoryFilter,
    activeCategory,
    activeCategoryFacet,
    activeSubGroup,
    activeWorldGroup,
    activeWorldDrawMode,
    activeWorldSet,
    activeKitId,
    activeSourceId,
    favoritesOnly,
    recentOnly,
    colorableOnly,
  ]);

  // Announce sort changes once to screen readers via polite role="status" live region
  const didMountSortRef = useRef(false);
  useEffect(() => {
    if (!didMountSortRef.current) {
      didMountSortRef.current = true;
      return;
    }
    const label = VAULT_SORT_OPTIONS.find((o) => o.id === sortMode)?.label ?? sortMode;
    setLiveStatusMsg(`Sorted by ${label}, ${filteredAssets.length} items`);
  }, [sortMode, filteredAssets.length]);

  // Auto-sync vault category / templates view when switching drawing tools or studio mode
  useEffect(() => {
    if (!autoSyncTool) return;
    const cur = useVaultStore.getState();
    if (activeTool === "template" && docMode === "battlemap") {
      if (!cur.templatesView) cur.setTemplatesView(true);
      return;
    }
    if (activeTool === "roof" && docMode === "battlemap") {
      if (cur.templatesView || cur.activeCategory !== "terrain" || cur.activeCategoryFacet !== "roof") {
        cur.setActiveCategory("terrain");
        cur.setActiveCategoryFacet("roof");
      }
      return;
    }
    const mapped =
      activeTool === "stamp"
        ? docMode === "world"
          ? "symbol"
          : "object"
        : TOOL_TO_CATEGORY[activeTool];
    if (!mapped) return;
    if (
      cur.templatesView ||
      cur.activeCategory !== mapped ||
      cur.favoritesOnly ||
      cur.recentOnly ||
      cur.activeKitId
    ) {
      cur.setActiveCategory(mapped);
    }
  }, [activeTool, autoSyncTool, docMode]);

  // Listen for '/' hotkey to jump directly into search
  useEffect(() => {
    const onFocusSearch = () => {
      if (!useDocumentStore.getState().vaultDrawerOpen) {
        useDocumentStore.getState().setVaultDrawerOpen(true);
      }
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      });
    };
    window.addEventListener("dc-focus-vault-search", onFocusSearch);
    return () => window.removeEventListener("dc-focus-vault-search", onFocusSearch);
  }, []);

  // Precompute static full-vault counts once per asset index update
  const baseCounts = useMemo(() => {
    const byCat: Record<string, number> = { all: allAssets.length };
    const bySub: Record<string, number> = {};
    const byWorld: Record<string, number> = {};
    const byFacet: Record<string, Record<string, number>> = {};
    const worldSymbols: VaultAsset[] = [];
    let favs = 0;
    let colorable = 0;
    let worldTextures = 0;

    for (const catKey of Object.keys(CATEGORY_FACETS) as AssetCategory[]) {
      byFacet[catKey] = {};
    }

    for (let i = 0; i < allAssets.length; i++) {
      const a = allAssets[i];
      byCat[a.category] = (byCat[a.category] ?? 0) + 1;
      if (a.isFavorite) favs++;
      if (isNativeColorableAsset(a)) colorable++;

      const facets = CATEGORY_FACETS[a.category];
      if (facets) {
        const bucket = byFacet[a.category];
        for (let f = 0; f < facets.length; f++) {
          const def = facets[f];
          if (matchesCategoryFacet(a, a.category, def.id)) {
            bucket[def.id] = (bucket[def.id] ?? 0) + 1;
            if (a.category === "terrain" && def.id === "world_texture") {
              worldTextures++;
            }
          }
        }
      }

      if (a.category === "symbol") {
        worldSymbols.push(a);
        if (a.worldGroup) {
          byWorld[a.worldGroup] = (byWorld[a.worldGroup] ?? 0) + 1;
        }
      } else if (a.category === "object") {
        for (let j = 0; j < OBJECT_SUBGROUPS.length; j++) {
          const sg = OBJECT_SUBGROUPS[j];
          if (matchesSubGroup(a, sg.id)) {
            bySub[sg.id] = (bySub[sg.id] ?? 0) + 1;
          }
        }
      }
    }
    return { byCat, bySub, byWorld, byFacet, worldSymbols, favs, colorable, worldTextures };
  }, [allAssets]);

  const worldFilterCounts = useMemo(() => {
    const byWorldSet: Record<string, number> = {};
    const byWorldMode: Record<string, number> = {
      all: 0,
      normal: 0,
      sample_color: 0,
      tint: 0,
      rgb_channels: 0,
    };
    const syms = baseCounts.worldSymbols;
    for (let i = 0; i < syms.length; i++) {
      const a = syms[i];
      if (activeWorldGroup && a.worldGroup !== activeWorldGroup) continue;
      byWorldMode.all++;
      byWorldMode[a.drawMode] = (byWorldMode[a.drawMode] ?? 0) + 1;
      if (activeWorldDrawMode === "all" || a.drawMode === activeWorldDrawMode) {
        for (let t = 0; t < a.tags.length; t++) {
          const tag = a.tags[t];
          if (tag.startsWith("set_")) {
            byWorldSet[tag] = (byWorldSet[tag] ?? 0) + 1;
          }
        }
      }
    }
    return { byWorldSet, byWorldMode };
  }, [baseCounts.worldSymbols, activeWorldGroup, activeWorldDrawMode]);

  const recentCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < recentAssetIds.length; i++) {
      if (assetById.has(recentAssetIds[i])) n++;
    }
    return n;
  }, [recentAssetIds, assetById]);

  const handleStartResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = useVaultStore.getState().drawerHeightPx;
    const onMove = (ev: PointerEvent) => {
      useVaultStore.getState().setDrawerHeightPx(startH + (startY - ev.clientY));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const openAssetContextMenu = (e: React.MouseEvent, asset: VaultAsset) => {
    e.preventDefault();
    vault.setSelectedAssetId(asset.id);
    onOpenContextMenu(
      e.clientX,
      e.clientY,
      `Asset: ${asset.displayName}`,
      buildAssetContextMenuEntries(asset),
    );
  };

  const openImportMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const menuWidth = 256;
    onOpenContextMenu(
      Math.max(8, r.right - menuWidth),
      Math.max(8, r.top - 86),
      "Import Assets & Packs",
      [
        {
          type: "item",
          id: "imp-local-files",
          label: "Import Local PNG / WebP / SVG Files…",
          onSelect: () => fileInputRef.current?.click(),
        },
        {
          type: "item",
          id: "imp-wd-zip",
          label: "Import Wonderdraft Asset Pack (.zip)…",
          onSelect: () => wdZipInputRef.current?.click(),
        },
      ],
    );
  };

  const handleSaveTemplateQuick = () => {
    const defaultName = `Custom Group ${savedTemplateCount + 1}`;
    const name = window.prompt("Name this premade object group:", defaultName);
    if (!name) return;
    const ok = docStore.saveCustomObjectTemplate({
      name,
      category: "saved",
      scope: selection?.kind === "object" ? "cluster" : "layer",
      radiusCells: 3.5,
    });
    if (ok) {
      vault.setTemplateCategoryFilter("all");
    }
  };

  const renderSectionToggle = (key: string, label: string, count?: number) => {
    const isCollapsed = Boolean(collapsedTreeSections[key]);
    return (
      <button
        type="button"
        className="dc-vault-tree-section-btn"
        aria-expanded={!isCollapsed}
        onClick={() => vault.toggleTreeSection(key)}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {isCollapsed ? (
            <ChevronRight size={11} aria-hidden="true" />
          ) : (
            <ChevronDown size={11} aria-hidden="true" />
          )}
          <span>{label}</span>
        </span>
        {count !== undefined && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, opacity: 0.72 }}>
            {count}
          </span>
        )}
      </button>
    );
  };

  const renderWorldSection = (collapsibleKey: string | null) => {
    const collapsed = collapsibleKey ? Boolean(collapsedTreeSections[collapsibleKey]) : false;
    return (
      <>
        {collapsibleKey ? (
          renderSectionToggle(collapsibleKey, "World Atlas v1.5", baseCounts.byCat.symbol ?? 0)
        ) : (
          <div className="dc-vault-tree-heading">World Atlas v1.5</div>
        )}
        {!collapsed && (
          <>
            <button
              type="button"
              className={`dc-vault-tree-btn ${
                !templatesView &&
                activeCategory === "symbol" &&
                !activeWorldGroup &&
                !activeKitId &&
                !favoritesOnly &&
                !recentOnly
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                vault.setActiveWorldGroup(null);
                vault.setActiveCategory("symbol");
              }}
            >
              <Globe size={11} aria-hidden="true" />
              <span className="dc-vault-tree-label">All World Symbols</span>
              <span className="dc-vault-tree-count">{baseCounts.byCat.symbol ?? 0}</span>
            </button>
            <button
              type="button"
              className={`dc-vault-tree-btn cyan ${
                !templatesView && activeCategory === "terrain" && activeCategoryFacet === "world_texture"
                  ? "active"
                  : ""
              }`}
              onClick={() => {
                vault.setAutoSyncTool(false);
                vault.setActiveCategory("terrain");
                vault.setActiveCategoryFacet("world_texture");
              }}
            >
              <MapIcon size={11} aria-hidden="true" />
              <span className="dc-vault-tree-label">Atlas Paper &amp; Ocean</span>
              <span className="dc-vault-tree-count">{baseCounts.worldTextures}</span>
            </button>
            {WORLD_ASSET_GROUPS.map((wg) => {
              const isAct = !templatesView && activeWorldGroup === wg.id;
              return (
                <button
                  key={wg.id}
                  type="button"
                  className={`dc-vault-tree-btn cyan ${isAct ? "active" : ""}`}
                  onClick={() => vault.setActiveWorldGroup(isAct ? null : wg.id)}
                >
                  <span className="dc-vault-tree-label">{wg.label}</span>
                  <span className="dc-vault-tree-count">{baseCounts.byWorld[wg.id] ?? 0}</span>
                </button>
              );
            })}
          </>
        )}
      </>
    );
  };

  const renderBattlemapSections = (collapsibleKey: string | null) => {
    const catCollapsed = collapsibleKey ? Boolean(collapsedTreeSections[collapsibleKey]) : false;
    const grpCollapsed = Boolean(collapsedTreeSections["object_groups"]);
    return (
      <>
        {collapsibleKey ? (
          renderSectionToggle(
            collapsibleKey,
            "Battlemap Categories",
            (baseCounts.byCat.object ?? 0) +
              (baseCounts.byCat.portal ?? 0) +
              (baseCounts.byCat.wall ?? 0) +
              (baseCounts.byCat.terrain ?? 0) +
              (baseCounts.byCat.path ?? 0),
          )
        ) : (
          <div className="dc-vault-tree-heading">Categories</div>
        )}
        {!catCollapsed &&
          BATTLEMAP_CATEGORIES.map((cat) => {
            const isAct =
              !templatesView &&
              activeCategory === cat.id &&
              !activeSubGroup &&
              !activeKitId &&
              !favoritesOnly &&
              !recentOnly;
            return (
              <button
                key={cat.id}
                type="button"
                className={`dc-vault-tree-btn ${isAct ? "active" : ""}`}
                onClick={() => {
                  vault.setActiveSubGroup(null);
                  vault.setActiveCategory(cat.id);
                  const mapped = TOOL_TO_CATEGORY[activeTool];
                  if (mapped && mapped !== cat.id) vault.setAutoSyncTool(false);
                }}
              >
                <span className="dc-vault-tree-label">{cat.label}</span>
                <span className="dc-vault-tree-count">{baseCounts.byCat[cat.id] ?? 0}</span>
              </button>
            );
          })}

        {!collapsibleKey && (
          <>
            {renderSectionToggle("object_groups", "Object Groups", OBJECT_SUBGROUPS.length)}
            {!grpCollapsed &&
              OBJECT_SUBGROUPS.map((sg) => {
                const isAct = !templatesView && activeSubGroup === sg.id;
                return (
                  <button
                    key={sg.id}
                    type="button"
                    className={`dc-vault-tree-btn cyan ${isAct ? "active" : ""}`}
                    onClick={() => vault.setActiveSubGroup(isAct ? null : sg.id)}
                  >
                    <span className="dc-vault-tree-label">{sg.label}</span>
                    <span className="dc-vault-tree-count">{baseCounts.bySub[sg.id] ?? 0}</span>
                  </button>
                );
              })}
          </>
        )}
      </>
    );
  };

  const tileSpec = TILE_SIZES[drawerTileSize];
  const categoryFacets = !templatesView ? CATEGORY_FACETS[activeCategory] : undefined;
  const scopedFacetInfo = useMemo(() => {
    if (activeCategory !== "object" || !activeSubGroup || !categoryFacets) {
      return {
        total: baseCounts.byCat[activeCategory] ?? 0,
        counts: baseCounts.byFacet[activeCategory] ?? {},
      };
    }
    const counts: Record<string, number> = {};
    let total = 0;
    for (let i = 0; i < allAssets.length; i++) {
      const a = allAssets[i];
      if (a.category !== "object" || !matchesSubGroup(a, activeSubGroup)) continue;
      total++;
      for (let f = 0; f < categoryFacets.length; f++) {
        if (matchesCategoryFacet(a, "object", categoryFacets[f].id)) {
          counts[categoryFacets[f].id] = (counts[categoryFacets[f].id] ?? 0) + 1;
        }
      }
    }
    return { total, counts };
  }, [allAssets, activeCategory, activeSubGroup, categoryFacets, baseCounts]);
  const facetCounts = scopedFacetInfo.counts;
  const facetTotalCount = scopedFacetInfo.total;
  const rotDeg = Math.round((((templateRotationRad * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <section
      className={`dc-vault-drawer ${drawerOpen ? "" : "collapsed"}`}
      style={drawerOpen ? { height: drawerHeightPx } : undefined}
      aria-label="Visual Asset Vault"
    >
      {/* Visually hidden polite live region for dynamic sort/filter announcements */}
      <p role="status" className="dc-visually-hidden">
        {liveStatusMsg}
      </p>

      {/* Draggable Top Resize Handle */}
      {drawerOpen && (
        <div
          className="dc-vault-resizer"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Drag to resize Asset Vault height"
          title="Drag up or down to resize Asset Vault"
          onPointerDown={handleStartResize}
        />
      )}

      {/* Clean Single-Row Studio Vault Toolbar */}
      <div className="dc-vault-drawer-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
          <button
            type="button"
            className="dc-mini-icon-btn"
            aria-label={drawerOpen ? "Collapse Asset Vault" : "Expand Asset Vault"}
            aria-expanded={drawerOpen}
            onClick={() => docStore.setVaultDrawerOpen(!drawerOpen)}
          >
            {drawerOpen ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
          </button>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}
          >
            Asset Vault
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-muted)",
              whiteSpace: "nowrap",
            }}
          >
            {templatesView
              ? `${filteredTemplates.length}/${objectTemplates.length} prefabs`
              : `${filteredAssets.length}/${allAssets.length}`}
          </span>

          {drawerOpen && (
            <>
              <label
                className="dc-search-input"
                style={{ height: 24, minWidth: 165, maxWidth: 260, flex: "1 1 180px", padding: "0 8px" }}
              >
                <Search size={12} aria-hidden="true" style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  type="search"
                  aria-label="Search assets, templates, and tags"
                  placeholder={templatesView ? "Filter premade templates… (/)" : "Search assets, #tags… (/)"}
                  value={searchQuery}
                  onChange={(e) => vault.setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && searchQuery) {
                      e.stopPropagation();
                      vault.setSearchQuery("");
                    }
                  }}
                  style={{ fontSize: 11 }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => vault.setSearchQuery("")}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                    }}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </label>

              {!templatesView && (
                <div className="dc-vault-sort-wrap" title="Sort Asset Vault grid">
                  <ArrowUpDown size={11} aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                  <label htmlFor={sortSelectId} className="dc-visually-hidden">
                    Sort assets
                  </label>
                  <select
                    id={sortSelectId}
                    className="dc-vault-sort-select"
                    value={sortMode}
                    onChange={(e) => vault.setSortMode(e.target.value as VaultSortMode)}
                  >
                    {VAULT_SORT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}
        </div>

        <div
          role="toolbar"
          aria-label="Asset Vault Controls"
          style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}
        >
          {drawerOpen && (
            <>
              <button
                type="button"
                className={`dc-btn dc-btn-ghost ${autoSyncTool ? "active" : ""}`}
                aria-pressed={autoSyncTool}
                style={{ height: 24, fontSize: 10, padding: "0 7px", gap: 4 }}
                onClick={() => {
                  const next = !autoSyncTool;
                  vault.setAutoSyncTool(next);
                  if (next) {
                    if (activeTool === "template") {
                      vault.setTemplatesView(true);
                    } else {
                      const mapped = TOOL_TO_CATEGORY[activeTool];
                      if (mapped) vault.setActiveCategory(mapped);
                    }
                  }
                  docStore.pushToast(
                    next
                      ? "Asset Vault auto-syncs to active tool"
                      : "Asset Vault manual browsing mode",
                  );
                }}
                title="Automatically filter Asset Vault when switching tools (Stamp, Wall, Portal, Templates…)"
              >
                {autoSyncTool ? <Link2 size={11} aria-hidden="true" /> : <Link2Off size={11} aria-hidden="true" />}
                <span>Sync Tool</span>
              </button>

              {!templatesView && (
                <div
                  className="dc-vault-density-group"
                  role="group"
                  aria-label="Thumbnail density"
                  title="Thumbnail card size (S = compact, M = balanced, L = detailed)"
                >
                  {(["sm", "md", "lg"] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      className="dc-vault-density-btn"
                      aria-label={`${sz === "sm" ? "Small" : sz === "md" ? "Medium" : "Large"} thumbnails`}
                      aria-pressed={drawerTileSize === sz}
                      onClick={() => vault.setDrawerTileSize(sz)}
                    >
                      {sz[0]}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.webp,.jpg,.jpeg,.svg"
            style={{ display: "none" }}
            onChange={async (e) => {
              if (!e.target.files) return;
              const n = await vault.ingestLocalFiles(e.target.files);
              if (n > 0) docStore.pushToast(`Mounted ${n} loose local asset(s) live!`, "success");
              e.target.value = "";
            }}
          />
          <input
            ref={wdZipInputRef}
            type="file"
            accept=".zip"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const res = await vault.importWonderdraftPack(file);
                if (res.count > 0) {
                  docStore.pushToast(`Mounted Wonderdraft pack "${res.name}" (${res.count} symbols)!`, "success");
                } else {
                  docStore.pushToast(`No PNG/WebP symbols found inside "${file.name}"`, "warning");
                }
              } catch (err) {
                docStore.pushToast(`Failed importing Wonderdraft zip: ${String(err)}`, "warning");
              }
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="dc-btn dc-btn-ghost"
            style={{ height: 24, fontSize: 11, padding: "0 7px", gap: 4 }}
            onClick={openImportMenu}
            title="Import local PNG/WebP/SVG images or a Wonderdraft .zip asset pack"
          >
            <FolderPlus size={12} aria-hidden="true" />
            <span>Import ▾</span>
          </button>
          <button
            type="button"
            className="dc-btn dc-btn-gold-outline"
            style={{ height: 24, fontSize: 11, padding: "0 8px", gap: 4 }}
            onClick={() => docStore.setVaultExpandedModal(true)}
            title="Open Full Asset Vault, Templates & Live Recolor Studio (Tab)"
          >
            <Maximize2 size={11} aria-hidden="true" />
            <span>Expand</span>
          </button>
        </div>
      </div>

      {/* 2-Pane Split: Mode-Aware Collapsible Filter Tree + Contextual Grid */}
      {drawerOpen && (
        <div className="dc-vault-split">
          <nav className="dc-vault-tree dc-scroll" aria-label="Asset Vault Filters">
            {docMode === "world" ? (
              <>
                {renderWorldSection(null)}

                <div className="dc-vault-tree-heading">Quick Views</div>
                <button
                  type="button"
                  className={`dc-vault-tree-btn ${
                    !templatesView &&
                    activeCategory === "all" &&
                    !favoritesOnly &&
                    !recentOnly &&
                    !colorableOnly &&
                    !activeKitId &&
                    !activeSubGroup
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    vault.clearDrawerFilters();
                  }}
                >
                  <Layers size={11} aria-hidden="true" />
                  <span className="dc-vault-tree-label">All Assets</span>
                  <span className="dc-vault-tree-count">{baseCounts.byCat.all ?? 0}</span>
                </button>
                <button
                  type="button"
                  className={`dc-vault-tree-btn ${favoritesOnly ? "active" : ""}`}
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    vault.setFavoritesOnly(!favoritesOnly);
                  }}
                >
                  <Star size={11} aria-hidden="true" />
                  <span className="dc-vault-tree-label">Favorites</span>
                  <span className="dc-vault-tree-count">{baseCounts.favs}</span>
                </button>
                <button
                  type="button"
                  className={`dc-vault-tree-btn cyan ${recentOnly ? "active" : ""}`}
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    vault.setRecentOnly(!recentOnly);
                  }}
                >
                  <Clock size={11} aria-hidden="true" />
                  <span className="dc-vault-tree-label">Recently Used</span>
                  <span className="dc-vault-tree-count">{recentCount}</span>
                </button>
                <button
                  type="button"
                  className={`dc-vault-tree-btn violet ${colorableOnly ? "active" : ""}`}
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    vault.setColorableOnly(!colorableOnly);
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "conic-gradient(#EF4444, #F59E0B, #10B981, #3B82F6, #A855F7, #EF4444)",
                    }}
                  />
                  <span className="dc-vault-tree-label">Colorable</span>
                  <span className="dc-vault-tree-count">{baseCounts.colorable}</span>
                </button>

                {renderBattlemapSections("battlemap_in_world")}
              </>
            ) : (
              <>
                <div className="dc-vault-tree-heading">Quick Views</div>
                <button
                  type="button"
                  className={`dc-vault-tree-btn ${templatesView ? "active" : ""}`}
                  onClick={() => {
                    vault.setTemplatesView(true);
                    docStore.setActiveTool("template");
                  }}
                  title="Premade multi-object templates & saved custom groups (T)"
                >
                  <LayoutGrid size={11} aria-hidden="true" style={{ color: "var(--accent-gold)" }} />
                  <span className="dc-vault-tree-label">Templates (Prefabs)</span>
                  <span className="dc-vault-tree-count">{objectTemplates.length}</span>
                </button>
                <button
                  type="button"
                  className={`dc-vault-tree-btn ${
                    !templatesView &&
                    activeCategory === "all" &&
                    !favoritesOnly &&
                    !recentOnly &&
                    !colorableOnly &&
                    !activeKitId &&
                    !activeSubGroup
                      ? "active"
                      : ""
                  }`}
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    vault.clearDrawerFilters();
                  }}
                >
                  <Layers size={11} aria-hidden="true" />
                  <span className="dc-vault-tree-label">All Assets</span>
                  <span className="dc-vault-tree-count">{baseCounts.byCat.all ?? 0}</span>
                </button>
                <button
                  type="button"
                  className={`dc-vault-tree-btn violet ${colorableOnly ? "active" : ""}`}
                  title="Native Dungeondraft Colorable & Wonderdraft Tintable assets"
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    const next = !colorableOnly;
                    vault.setColorableOnly(next);
                    if (next && activeCategory !== "all" && activeCategory !== "object") {
                      vault.setActiveCategory("all");
                    }
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: "conic-gradient(#EF4444, #F59E0B, #10B981, #3B82F6, #A855F7, #EF4444)",
                    }}
                  />
                  <span className="dc-vault-tree-label">Colorable</span>
                  <span className="dc-vault-tree-count">{baseCounts.colorable}</span>
                </button>
                <button
                  type="button"
                  className={`dc-vault-tree-btn ${favoritesOnly ? "active" : ""}`}
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    vault.setFavoritesOnly(!favoritesOnly);
                  }}
                >
                  <Star size={11} aria-hidden="true" />
                  <span className="dc-vault-tree-label">Favorites</span>
                  <span className="dc-vault-tree-count">{baseCounts.favs}</span>
                </button>
                <button
                  type="button"
                  className={`dc-vault-tree-btn cyan ${recentOnly ? "active" : ""}`}
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    vault.setRecentOnly(!recentOnly);
                  }}
                >
                  <Clock size={11} aria-hidden="true" />
                  <span className="dc-vault-tree-label">Recently Used</span>
                  <span className="dc-vault-tree-count">{recentCount}</span>
                </button>

                {renderBattlemapSections(null)}
              </>
            )}

            {renderSectionToggle("packs", "Packs & Sources", sources.length)}
            {!collapsedTreeSections["packs"] &&
              sources.map((src) => (
                <button
                  key={src.id}
                  type="button"
                  className={`dc-vault-tree-btn ${!templatesView && activeSourceId === src.id ? "active" : ""}`}
                  onClick={() => vault.setActiveSourceId(activeSourceId === src.id ? null : src.id)}
                  title={`${src.name} (${src.assetCount} assets)`}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      padding: "1px 3px",
                      borderRadius: 3,
                      background: "rgba(255,255,255,0.06)",
                      color: "var(--text-secondary)",
                      flexShrink: 0,
                    }}
                  >
                    {SOURCE_BADGE[src.kind]}
                  </span>
                  <span className="dc-vault-tree-label">{formatVaultSourceLabel(src.name)}</span>
                  <span className="dc-vault-tree-count">{src.assetCount}</span>
                </button>
              ))}

            {renderSectionToggle("kits", "Biome Kits", biomeKits.length)}
            {!collapsedTreeSections["kits"] &&
              biomeKits.map((kit) => (
                <button
                  key={kit.id}
                  type="button"
                  className={`dc-vault-tree-btn violet ${!templatesView && activeKitId === kit.id ? "active" : ""}`}
                  onClick={() => {
                    vault.setAutoSyncTool(false);
                    vault.setActiveKitId(activeKitId === kit.id ? null : kit.id);
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: kit.accentHex,
                      flexShrink: 0,
                    }}
                  />
                  <span className="dc-vault-tree-label">{kit.name}</span>
                  <span className="dc-vault-tree-count">{kit.assetIds.length}</span>
                </button>
              ))}

            {docMode !== "world" && renderWorldSection("world_in_battlemap")}
          </nav>

          <div className="dc-vault-grid-pane">
            {/* Contextual Refinement Bar: Templates / World Symbols / Category Facets */}
            {templatesView ? (
              <div className="dc-vault-world-bar" role="region" aria-label="Templates Filter and Actions">
                <div className="dc-vault-world-row" style={{ justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                    {TEMPLATE_CATEGORY_PILLS.map((pill) => {
                      const active = templateCategoryFilter === pill.id;
                      const cnt =
                        pill.id === "all"
                          ? objectTemplates.length
                          : pill.id === "saved"
                            ? savedTemplateCount
                            : objectTemplates.filter((t) => t.category === pill.id).length;
                      return (
                        <button
                          key={pill.id}
                          type="button"
                          aria-pressed={active}
                          className={`dc-vault-world-pill ${active ? "active" : ""}`}
                          onClick={() => vault.setTemplateCategoryFilter(pill.id)}
                        >
                          <span>{pill.label}</span>
                          <span style={{ opacity: 0.72, fontFamily: "var(--font-mono)", fontSize: 9 }}>
                            {cnt}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--text-secondary)",
                      }}
                      title="Active template placement scale & rotation"
                    >
                      {Math.round(templateScale * 100)}% · {rotDeg}°
                    </span>
                    <button
                      type="button"
                      className="dc-vault-world-pill"
                      title="Rotate active template +45° (Shift+Wheel on canvas)"
                      onClick={() =>
                        docStore.setTemplateTransform({ rotationRad: templateRotationRad + Math.PI / 4 })
                      }
                    >
                      <RotateCw size={10} aria-hidden="true" />
                      <span>+45°</span>
                    </button>
                    <button
                      type="button"
                      className="dc-vault-world-pill active"
                      onClick={handleSaveTemplateQuick}
                      title={
                        selection?.kind === "object"
                          ? "Save objects near your current selection as a reusable template"
                          : "Save active layer objects as a reusable template"
                      }
                    >
                      <BookmarkPlus size={10} aria-hidden="true" />
                      <span>Save Group…</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : activeCategory === "symbol" ? (
              <div className="dc-vault-world-bar" role="region" aria-label="World Symbol Style and Species Filters">
                <div className="dc-vault-world-row" role="group" aria-label="Color Mode Filter">
                  {(
                    [
                      { id: "all", label: "All Styles", count: worldFilterCounts.byWorldMode.all },
                      { id: "normal", label: "Full Color", count: worldFilterCounts.byWorldMode.normal },
                      { id: "sample_color", label: "Paintable (Biome)", count: worldFilterCounts.byWorldMode.sample_color },
                      { id: "tint", label: "Engraved Ink", count: worldFilterCounts.byWorldMode.tint },
                      { id: "rgb_channels", label: "Custom RGB", count: worldFilterCounts.byWorldMode.rgb_channels },
                    ] as Array<{ id: WorldDrawModeFilter; label: string; count: number }>
                  )
                    .filter((m) => m.id === "all" || m.count > 0)
                    .map((mode) => {
                      const active = activeWorldDrawMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          aria-pressed={active}
                          className={`dc-vault-world-pill ${active ? "active" : ""}`}
                          onClick={() => vault.setActiveWorldDrawMode(mode.id)}
                        >
                          <span>{mode.label}</span>
                          <span style={{ opacity: 0.72, fontFamily: "var(--font-mono)", fontSize: 9 }}>
                            {mode.count}
                          </span>
                        </button>
                      );
                    })}
                </div>

                {activeWorldGroup && WORLD_GROUP_SPECIES[activeWorldGroup]?.length > 0 && (
                  <div className="dc-vault-world-row" role="group" aria-label="Species Brush Set Filter">
                    <button
                      type="button"
                      aria-pressed={activeWorldSet === null}
                      className={`dc-vault-world-pill cyan ${activeWorldSet === null ? "active" : ""}`}
                      onClick={() => vault.setActiveWorldSet(null)}
                    >
                      All Sets
                    </button>
                    {WORLD_GROUP_SPECIES[activeWorldGroup].map((sp) => {
                      const cnt = worldFilterCounts.byWorldSet[sp.id] ?? 0;
                      if (cnt === 0 && activeWorldSet !== sp.id) return null;
                      const active = activeWorldSet === sp.id;
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          aria-pressed={active}
                          className={`dc-vault-world-pill cyan ${active ? "active" : ""}`}
                          onClick={() => vault.setActiveWorldSet(active ? null : sp.id)}
                        >
                          <span>{sp.label}</span>
                          <span style={{ opacity: 0.72, fontFamily: "var(--font-mono)", fontSize: 9 }}>
                            {cnt}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : categoryFacets && categoryFacets.length > 0 ? (
              <div className="dc-vault-world-bar" role="region" aria-label="Category Sub-Filters">
                <div className="dc-vault-world-row" role="group" aria-label="Quick Facets">
                  <button
                    type="button"
                    aria-pressed={activeCategoryFacet === null}
                    className={`dc-vault-world-pill ${activeCategoryFacet === null ? "active" : ""}`}
                    onClick={() => vault.setActiveCategoryFacet(null)}
                  >
                    <span>All</span>
                    <span style={{ opacity: 0.72, fontFamily: "var(--font-mono)", fontSize: 9 }}>
                      {facetTotalCount}
                    </span>
                  </button>
                  {categoryFacets.map((f) => {
                    const cnt = facetCounts[f.id] ?? 0;
                    if (cnt === 0 && activeCategoryFacet !== f.id) return null;
                    const active = activeCategoryFacet === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={active}
                        className={`dc-vault-world-pill cyan ${active ? "active" : ""}`}
                        onClick={() => vault.setActiveCategoryFacet(active ? null : f.id)}
                      >
                        <span>{f.label}</span>
                        <span style={{ opacity: 0.72, fontFamily: "var(--font-mono)", fontSize: 9 }}>
                          {cnt}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Active Filter Breadcrumb Strip */}
            <VaultActiveFilterChips />

            {/* Main Grid: Either Premade Template Prefabs OR Virtualized Asset Tiles */}
            {templatesView ? (
              <div ref={gridRef} className="dc-vault-template-grid dc-scroll">
                {filteredTemplates.map((tpl) => (
                  <VaultTemplateCard
                    key={tpl.id}
                    template={tpl}
                    selected={activeTool === "template" && activeTemplateId === tpl.id}
                    assetById={assetById}
                    onSelect={() => {
                      docStore.selectObjectTemplate(tpl.id);
                      docStore.pushToast(
                        `Equipped Template "${tpl.name}" — click map to stamp (${tpl.items.length} objects)`,
                        "info",
                      );
                    }}
                    onRename={
                      tpl.isBuiltIn
                        ? undefined
                        : () => {
                            const next = window.prompt("Rename saved template:", tpl.name);
                            if (next) docStore.renameObjectTemplate(tpl.id, next);
                          }
                    }
                    onDelete={
                      tpl.isBuiltIn ? undefined : () => docStore.deleteObjectTemplate(tpl.id)
                    }
                  />
                ))}

                {filteredTemplates.length === 0 && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: 24,
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    <span>
                      {templateCategoryFilter === "saved"
                        ? "No saved custom templates yet — select any prop cluster and click Save Group."
                        : "No premade templates match your filter."}
                    </span>
                    <button
                      type="button"
                      className="dc-btn dc-btn-ghost"
                      style={{ height: 24, fontSize: 11 }}
                      onClick={() => {
                        vault.setSearchQuery("");
                        vault.setTemplateCategoryFilter("all");
                      }}
                    >
                      Show All Prefabs
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                ref={gridRef}
                className="dc-vault-grid dc-scroll"
                style={
                  {
                    "--dc-tile-w": `${tileSpec.w}px`,
                    "--dc-thumb-h": `${tileSpec.h}px`,
                  } as React.CSSProperties
                }
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 260 && visibleLimit < filteredAssets.length) {
                    setVisibleLimit((n) => Math.min(filteredAssets.length, n + 96));
                  }
                }}
              >
                {filteredAssets.slice(0, visibleLimit).map((asset) => {
                  const isSelected = asset.id === selectedAssetId;
                  const nativeColorable = isNativeColorableAsset(asset);
                  const cap = nativeColorable ? describeAssetColorCapability(asset) : null;
                  return (
                    <div
                      key={asset.id}
                      role="button"
                      tabIndex={0}
                      className={`dc-vault-tile ${isSelected ? "selected" : ""}`}
                      draggable
                      title={`${asset.displayName} (${formatVaultSourceLabel(asset.sourceName)})${cap ? ` · ${cap.badge}` : ""} — Click to equip, drag onto canvas, or right-click for Studio options`}
                      onDragStart={(e) => {
                        vault.recordRecentAsset(asset.id);
                        e.dataTransfer.setData("application/x-dicechaos-asset", asset.id);
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => equipVaultAsset(asset)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") equipVaultAsset(asset);
                        else if (e.key === " ") e.preventDefault();
                      }}
                      onKeyUp={(e) => {
                        if (e.key === " ") equipVaultAsset(asset);
                      }}
                      onContextMenu={(e) => openAssetContextMenu(e, asset)}
                    >
                      <div className="dc-asset-thumb-box">
                        <span className="dc-source-pill">{SOURCE_BADGE[asset.sourceKind]}</span>
                        {nativeColorable && (
                          <span
                            title={cap?.badge}
                            aria-label={cap?.badge}
                            style={{
                              position: "absolute",
                              right: 4,
                              bottom: 4,
                              width: 11,
                              height: 11,
                              borderRadius: "50%",
                              background:
                                "conic-gradient(#EF4444, #F59E0B, #10B981, #3B82F6, #A855F7, #EF4444)",
                              border: "1.5px solid rgba(12, 16, 24, 0.92)",
                              boxShadow: "0 1px 4px rgba(0,0,0,0.65)",
                              zIndex: 2,
                            }}
                          />
                        )}
                        <button
                          type="button"
                          className={`dc-fav-btn ${asset.isFavorite ? "active" : ""}`}
                          aria-label={
                            asset.isFavorite
                              ? `Remove ${asset.displayName} from favorites`
                              : `Add ${asset.displayName} to favorites`
                          }
                          aria-pressed={asset.isFavorite}
                          onClick={(e) => {
                            e.stopPropagation();
                            vault.toggleFavoriteAsset(asset.id);
                          }}
                        >
                          <Star size={10} aria-hidden="true" fill={asset.isFavorite ? "currentColor" : "none"} />
                        </button>
                        <img src={asset.thumbUrl} alt={asset.displayName} loading="lazy" />
                      </div>
                      <div className="dc-asset-title">{asset.displayName}</div>
                    </div>
                  );
                })}

                {visibleLimit < filteredAssets.length && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "8px 0",
                      gap: 8,
                      fontSize: 11,
                      color: "var(--text-muted)",
                    }}
                  >
                    <span>
                      Showing {visibleLimit} of {filteredAssets.length} assets — scroll down for more
                    </span>
                    <button
                      type="button"
                      className="dc-btn dc-btn-ghost"
                      style={{ height: 22, fontSize: 10 }}
                      onClick={() => setVisibleLimit((n) => Math.min(filteredAssets.length, n + 144))}
                    >
                      Load More
                    </button>
                  </div>
                )}

                {filteredAssets.length === 0 && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      padding: 24,
                      color: "var(--text-muted)",
                      fontSize: 12,
                    }}
                  >
                    <span>No assets match your active filter.</span>
                    <button
                      type="button"
                      className="dc-btn dc-btn-ghost"
                      style={{ height: 24, fontSize: 11 }}
                      onClick={() => vault.clearDrawerFilters()}
                    >
                      Reset Filters
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
});

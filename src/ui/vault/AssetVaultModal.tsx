import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  BookmarkPlus,
  Clock,
  FolderPlus,
  Globe,
  Layers,
  LayoutGrid,
  PackagePlus,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  Sparkles,
  Stamp,
  Star,
  X,
} from "lucide-react";
import { isNativeColorableAsset } from "@/engine/colorShader";
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
import { DiceLogo } from "@/ui/common/DiceLogo";
import { ModalDialog } from "@/ui/common/ModalDialog";
import { ColorStudioPanel } from "@/ui/workspace/ColorStudioPanel";
import {
  buildAssetContextMenuEntries,
  equipVaultAsset,
  filterObjectTemplates,
  SOURCE_BADGE,
  TEMPLATE_CATEGORY_PILLS,
  VaultActiveFilterChips,
  VaultTemplateCard,
} from "@/ui/vault/vaultShared";
import type { ContextMenuEntry } from "@/ui/common/ContextMenu";
import type { AssetCategory, VaultAsset } from "@/types/map";

interface AssetVaultModalProps {
  onOpenContextMenu: (
    x: number,
    y: number,
    ariaLabel: string,
    entries: ContextMenuEntry[],
  ) => void;
}

const PALETTE_DOTS = [
  "#E5A93C",
  "#8E1D2D",
  "#4E6E52",
  "#5B7696",
  "#8B5A2B",
  "#CBD5E1",
];

const CATEGORY_PILLS: Array<{ id: AssetCategory; label: string }> = [
  { id: "object", label: "Objects" },
  { id: "portal", label: "Doors & Windows" },
  { id: "wall", label: "Walls" },
  { id: "terrain", label: "Terrain" },
  { id: "path", label: "Paths" },
  { id: "symbol", label: "World Symbols" },
];

export const AssetVaultModal: React.FC<AssetVaultModalProps> = ({
  onOpenContextMenu,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wdZipInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const sortSelectId = useId();
  const [newTagInput, setNewTagInput] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(120);

  const open = useDocumentStore((s) => s.vaultExpandedModal);
  const activeRecolor = useDocumentStore((s) => s.activeRecolor);
  const docMode = useDocumentStore(
    (s) => (s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0]).mode,
  );
  const objectTemplates = useDocumentStore((s) => s.objectTemplates);
  const activeTemplateId = useDocumentStore((s) => s.activeTemplateId);
  const templateScale = useDocumentStore((s) => s.templateScale);
  const templateRotationRad = useDocumentStore((s) => s.templateRotationRad);
  const selection = useDocumentStore((s) => s.selection);

  const sources = useVaultStore((s) => s.sources);
  const allAssets = useVaultStore((s) => s.assets);
  const assetById = useVaultStore((s) => s.assetById);
  const biomeKits = useVaultStore((s) => s.biomeKits);
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
  const activeSourceId = useVaultStore((s) => s.activeSourceId);
  const activeKitId = useVaultStore((s) => s.activeKitId);
  const favoritesOnly = useVaultStore((s) => s.favoritesOnly);
  const recentOnly = useVaultStore((s) => s.recentOnly);
  const colorableOnly = useVaultStore((s) => s.colorableOnly);
  const colorFilterHex = useVaultStore((s) => s.colorFilterHex);
  const thumbnailSizePx = useVaultStore((s) => s.thumbnailSizePx);
  const selectedAssetId = useVaultStore((s) => s.selectedAssetId);

  const filteredAssets = useFilteredVaultAssets();
  const filteredTemplates = useMemo(
    () => filterObjectTemplates(objectTemplates, templateCategoryFilter, searchQuery),
    [objectTemplates, templateCategoryFilter, searchQuery],
  );
  const selectedAsset = useVaultStore((s) =>
    s.selectedAssetId ? s.getAssetById(s.selectedAssetId) : undefined,
  );
  const selectedTemplate = useMemo(
    () => objectTemplates.find((t) => t.id === activeTemplateId) ?? filteredTemplates[0] ?? null,
    [objectTemplates, activeTemplateId, filteredTemplates],
  );

  const vault = useVaultStore.getState();
  const docStore = useDocumentStore.getState();

  useEffect(() => {
    setVisibleLimit(120);
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
    activeSourceId,
    activeKitId,
    favoritesOnly,
    recentOnly,
    colorableOnly,
    colorFilterHex,
  ]);

  const facetCounts = useMemo(() => {
    const map: Record<string, number> = {};
    const list = CATEGORY_FACETS[activeCategory];
    if (!list) return map;
    for (let i = 0; i < allAssets.length; i++) {
      const a = allAssets[i];
      if (a.category !== activeCategory) continue;
      if (activeCategory === "object" && activeSubGroup && !matchesSubGroup(a, activeSubGroup)) {
        continue;
      }
      for (let f = 0; f < list.length; f++) {
        if (matchesCategoryFacet(a, activeCategory, list[f].id)) {
          map[list[f].id] = (map[list[f].id] ?? 0) + 1;
        }
      }
    }
    return map;
  }, [allAssets, activeCategory, activeSubGroup]);

  const equipAssetAndClose = (asset: VaultAsset) => {
    equipVaultAsset(asset, { closeModal: true, toast: true });
  };

  const categoryFacets = !templatesView ? CATEGORY_FACETS[activeCategory] : undefined;
  const rotDeg = Math.round((((templateRotationRad * 180) / Math.PI) % 360 + 360) % 360);

  return (
    <ModalDialog
      open={open}
      onClose={() => docStore.setVaultExpandedModal(false)}
      title="Asset Vault — Library, Premade Templates & Live Recolor Studio"
      icon={<DiceLogo size={20} />}
      maxWidthPx={1320}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "242px minmax(0, 1fr) 300px",
          gap: 14,
          height: "74vh",
          minHeight: 540,
        }}
      >
        {/* Left Navigation: Quick Views, Templates, Categories/Groups, Sources, Biome Kits */}
        <aside
          className="dc-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            paddingRight: 10,
            borderRight: "1px solid var(--border-subtle)",
            overflowY: "auto",
          }}
        >
          {/* Quick Views + Premade Templates */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div className="dc-vault-tree-heading" style={{ marginTop: 0, borderTop: "none" }}>
              Views &amp; Prefabs
            </div>
            <button
              type="button"
              className={`dc-vault-tree-btn ${templatesView ? "active" : ""}`}
              onClick={() => vault.setTemplatesView(true)}
            >
              <LayoutGrid size={12} aria-hidden="true" style={{ color: "var(--accent-gold)" }} />
              <span className="dc-vault-tree-label">Templates (Prefabs)</span>
              <span className="dc-vault-tree-count">{objectTemplates.length}</span>
            </button>
            <button
              type="button"
              className={`dc-vault-tree-btn ${
                !templatesView && activeCategory === "all" && !favoritesOnly && !recentOnly && !colorableOnly && !activeKitId
                  ? "active"
                  : ""
              }`}
              onClick={() => vault.clearDrawerFilters()}
            >
              <Layers size={12} aria-hidden="true" />
              <span className="dc-vault-tree-label">All Assets</span>
              <span className="dc-vault-tree-count">{allAssets.length}</span>
            </button>
            <button
              type="button"
              className={`dc-vault-tree-btn ${favoritesOnly ? "active" : ""}`}
              onClick={() => vault.setFavoritesOnly(!favoritesOnly)}
            >
              <Star size={12} aria-hidden="true" fill={favoritesOnly ? "currentColor" : "none"} />
              <span className="dc-vault-tree-label">Favorites Only</span>
            </button>
            <button
              type="button"
              className={`dc-vault-tree-btn cyan ${recentOnly ? "active" : ""}`}
              onClick={() => vault.setRecentOnly(!recentOnly)}
            >
              <Clock size={12} aria-hidden="true" />
              <span className="dc-vault-tree-label">Recently Used</span>
            </button>
            <button
              type="button"
              className={`dc-vault-tree-btn violet ${colorableOnly ? "active" : ""}`}
              onClick={() => vault.setColorableOnly(!colorableOnly)}
            >
              <Sparkles size={12} aria-hidden="true" />
              <span className="dc-vault-tree-label">RGB / Colorable</span>
            </button>
          </div>

          {/* Categories & Mode-Prioritized Sub-Groups */}
          <div>
            <div className="dc-vault-tree-heading" style={{ marginTop: 0 }}>
              Categories
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "4px 2px 0" }}>
              {CATEGORY_PILLS.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`dc-chip violet ${!templatesView && activeCategory === cat.id ? "active" : ""}`}
                  style={{ height: 24, fontSize: 10.5 }}
                  onClick={() =>
                    vault.setActiveCategory(
                      !templatesView && activeCategory === cat.id ? "all" : cat.id,
                    )
                  }
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* World Atlas v1.5 Groups (shown top when in World mode or browsing symbols) */}
          {(docMode === "world" || activeCategory === "symbol") && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div className="dc-vault-tree-heading" style={{ marginTop: 0 }}>
                World Atlas v1.5 Groups
              </div>
              {WORLD_ASSET_GROUPS.map((wg) => {
                const isAct = !templatesView && activeWorldGroup === wg.id;
                return (
                  <button
                    key={wg.id}
                    type="button"
                    className={`dc-vault-tree-btn cyan ${isAct ? "active" : ""}`}
                    onClick={() => vault.setActiveWorldGroup(isAct ? null : wg.id)}
                  >
                    <Globe size={11} aria-hidden="true" />
                    <span className="dc-vault-tree-label">{wg.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Object Groups */}
          {docMode !== "world" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div className="dc-vault-tree-heading" style={{ marginTop: 0 }}>
                Object Groups ({OBJECT_SUBGROUPS.length})
              </div>
              {OBJECT_SUBGROUPS.map((sg) => {
                const isAct = !templatesView && activeSubGroup === sg.id;
                return (
                  <button
                    key={sg.id}
                    type="button"
                    className={`dc-vault-tree-btn cyan ${isAct ? "active" : ""}`}
                    onClick={() => vault.setActiveSubGroup(isAct ? null : sg.id)}
                  >
                    <span className="dc-vault-tree-label">{sg.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Mounted Sources */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.07em",
                color: "var(--text-muted)",
              }}
            >
              <span>MOUNTED SOURCES</span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.webp,.jpg,.jpeg,.svg"
                style={{ display: "none" }}
                onChange={async (e) => {
                  if (!e.target.files) return;
                  const n = await vault.ingestLocalFiles(e.target.files);
                  if (n > 0) docStore.pushToast(`Mounted ${n} local asset(s)`, "success");
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
                      docStore.pushToast(`No symbols found inside "${file.name}"`, "warning");
                    }
                  } catch (err) {
                    docStore.pushToast(`Failed importing Wonderdraft zip: ${String(err)}`, "warning");
                  }
                  e.target.value = "";
                }}
              />
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  className="dc-mini-icon-btn"
                  aria-label="Import Wonderdraft Asset Pack"
                  title="Import Wonderdraft Asset Pack (.zip)"
                  onClick={() => wdZipInputRef.current?.click()}
                >
                  <PackagePlus size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="dc-mini-icon-btn"
                  aria-label="Add Local Folder or Images"
                  title="Add Local Folder / PNGs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderPlus size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
            {sources.map((src) => (
              <div
                key={src.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  vault.setActiveSourceId(activeSourceId === src.id ? null : src.id)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    vault.setActiveSourceId(activeSourceId === src.id ? null : src.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenContextMenu(e.clientX, e.clientY, `Source: ${src.name}`, [
                    {
                      type: "item",
                      id: "src-toggle",
                      label: src.enabled ? "Disable Source" : "Enable Source",
                      checked: src.enabled,
                      onSelect: () => vault.toggleSourceEnabled(src.id),
                    },
                    {
                      type: "item",
                      id: "src-rm",
                      label: "Unmount Source",
                      danger: true,
                      disabled: sources.length <= 1,
                      onSelect: () => vault.removeSource(src.id),
                    },
                  ]);
                }}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  marginBottom: 4,
                  cursor: "pointer",
                  background:
                    !templatesView && activeSourceId === src.id ? "var(--accent-gold-soft)" : "var(--bg-panel)",
                  border: `1px solid ${!templatesView && activeSourceId === src.id ? "rgba(229,169,60,0.5)" : "var(--border-subtle)"}`,
                  opacity: src.enabled ? 1 : 0.45,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11.5,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={src.name}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: src.enabled ? "var(--accent-emerald)" : "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                    {formatVaultSourceLabel(src.name)}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 2,
                    paddingLeft: 12,
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    color: "var(--text-muted)",
                  }}
                >
                  {src.assetCount} assets · {src.ramEstimateMb} MB
                </div>
              </div>
            ))}
          </div>

          {/* Biome Kits */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 6,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.07em",
                color: "var(--text-muted)",
              }}
            >
              <span>BIOME KITS</span>
              <button
                type="button"
                className="dc-mini-icon-btn"
                aria-label="Create New Biome Kit"
                title="Create New Biome Kit"
                onClick={() => {
                  const name = window.prompt("New Biome Kit name:");
                  if (name) vault.createBiomeKit(name);
                }}
              >
                <Plus size={13} aria-hidden="true" />
              </button>
            </div>
            {biomeKits.map((kit) => (
              <button
                key={kit.id}
                type="button"
                className={`dc-vault-tree-btn violet ${!templatesView && activeKitId === kit.id ? "active" : ""}`}
                onClick={() => vault.setActiveKitId(activeKitId === kit.id ? null : kit.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  onOpenContextMenu(e.clientX, e.clientY, `Biome Kit: ${kit.name}`, [
                    {
                      type: "item",
                      id: "kit-ren",
                      label: "Rename Biome Kit…",
                      onSelect: () => {
                        const next = window.prompt("Rename Biome Kit:", kit.name);
                        if (next) vault.renameBiomeKit(kit.id, next);
                      },
                    },
                    {
                      type: "item",
                      id: "kit-del",
                      label: "Delete Biome Kit",
                      danger: true,
                      onSelect: () => vault.deleteBiomeKit(kit.id),
                    },
                  ]);
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: kit.accentHex,
                    flexShrink: 0,
                  }}
                />
                <span className="dc-vault-tree-label">{kit.name}</span>
                <span className="dc-vault-tree-count">{kit.assetIds.length}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Center: Search + Sort + Facet Ribbon + Responsive Grid */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label className="dc-search-input" style={{ flex: 1, minWidth: 200 }}>
              <Search size={14} aria-hidden="true" style={{ color: "var(--text-muted)" }} />
              <input
                type="search"
                aria-label="Search assets, templates, and tags"
                placeholder={
                  templatesView
                    ? "Search premade templates (camp, speakeasy, crypt, cave…)"
                    : "Search lighting, stairs, subterranean, #harmony, #colorable…"
                }
                value={searchQuery}
                onChange={(e) => vault.setSearchQuery(e.target.value)}
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
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </label>

            {!templatesView && (
              <>
                <div className="dc-vault-sort-wrap" style={{ height: 30 }}>
                  <ArrowUpDown size={12} aria-hidden="true" style={{ color: "var(--text-muted)" }} />
                  <label htmlFor={sortSelectId} className="dc-visually-hidden">
                    Sort assets
                  </label>
                  <select
                    id={sortSelectId}
                    className="dc-vault-sort-select"
                    style={{ fontSize: 11.5 }}
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

                <div style={{ display: "flex", alignItems: "center", gap: 4 }} title="Filter by dominant color">
                  {PALETTE_DOTS.map((hex) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`Filter color ${hex}`}
                      aria-pressed={colorFilterHex === hex}
                      onClick={() =>
                        vault.setColorFilterHex(colorFilterHex === hex ? null : hex)
                      }
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: "50%",
                        background: hex,
                        border:
                          colorFilterHex === hex
                            ? "2px solid #fff"
                            : "1px solid var(--border-strong)",
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span className="dc-field-label">Size</span>
                  <input
                    type="range"
                    aria-label="Thumbnail size"
                    className="dc-range"
                    style={{ width: 68 }}
                    min={92}
                    max={172}
                    value={thumbnailSizePx}
                    onChange={(e) => vault.setThumbnailSizePx(Number(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>

          {/* Contextual Sub-Filter Strip */}
          {templatesView ? (
            <div className="dc-vault-world-row" role="group" aria-label="Template Categories">
              {TEMPLATE_CATEGORY_PILLS.map((pill) => {
                const active = templateCategoryFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    aria-pressed={active}
                    className={`dc-vault-world-pill ${active ? "active" : ""}`}
                    onClick={() => vault.setTemplateCategoryFilter(pill.id)}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>
          ) : activeCategory === "symbol" ? (
            <div className="dc-vault-world-row" role="group" aria-label="World Symbol Style Filter">
              {(
                [
                  { id: "all", label: "All Styles" },
                  { id: "normal", label: "Full Color" },
                  { id: "sample_color", label: "Paintable (Biome)" },
                  { id: "tint", label: "Engraved Ink" },
                  { id: "rgb_channels", label: "Custom RGB" },
                ] as Array<{ id: WorldDrawModeFilter; label: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={activeWorldDrawMode === m.id}
                  className={`dc-vault-world-pill ${activeWorldDrawMode === m.id ? "active" : ""}`}
                  onClick={() => vault.setActiveWorldDrawMode(m.id)}
                >
                  {m.label}
                </button>
              ))}
              {activeWorldGroup &&
                WORLD_GROUP_SPECIES[activeWorldGroup]?.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    aria-pressed={activeWorldSet === sp.id}
                    className={`dc-vault-world-pill cyan ${activeWorldSet === sp.id ? "active" : ""}`}
                    onClick={() => vault.setActiveWorldSet(activeWorldSet === sp.id ? null : sp.id)}
                  >
                    {sp.label}
                  </button>
                ))}
            </div>
          ) : categoryFacets && categoryFacets.length > 0 ? (
            <div className="dc-vault-world-row" role="group" aria-label="Category Facets">
              <button
                type="button"
                aria-pressed={activeCategoryFacet === null}
                className={`dc-vault-world-pill ${activeCategoryFacet === null ? "active" : ""}`}
                onClick={() => vault.setActiveCategoryFacet(null)}
              >
                All
              </button>
              {categoryFacets.map((f) => {
                const cnt = facetCounts[f.id] ?? 0;
                if (cnt === 0 && activeCategoryFacet !== f.id) return null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={activeCategoryFacet === f.id}
                    className={`dc-vault-world-pill cyan ${activeCategoryFacet === f.id ? "active" : ""}`}
                    onClick={() => vault.setActiveCategoryFacet(activeCategoryFacet === f.id ? null : f.id)}
                  >
                    <span>{f.label}</span>
                    <span style={{ opacity: 0.72, fontFamily: "var(--font-mono)", fontSize: 9 }}>
                      {cnt}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <VaultActiveFilterChips />

          {templatesView ? (
            <div ref={gridRef} className="dc-vault-template-grid dc-scroll" style={{ padding: "4px 4px 12px" }}>
              {filteredTemplates.map((tpl) => (
                <VaultTemplateCard
                  key={tpl.id}
                  template={tpl}
                  selected={selectedTemplate?.id === tpl.id}
                  assetById={assetById}
                  onSelect={() => docStore.selectObjectTemplate(tpl.id)}
                  onDoubleClick={() => {
                    docStore.selectObjectTemplate(tpl.id);
                    docStore.setVaultExpandedModal(false);
                    docStore.pushToast(`Equipped Template "${tpl.name}"`, "success");
                  }}
                  onRename={
                    tpl.isBuiltIn
                      ? undefined
                      : () => {
                          const next = window.prompt("Rename saved template:", tpl.name);
                          if (next) docStore.renameObjectTemplate(tpl.id, next);
                        }
                  }
                  onDelete={tpl.isBuiltIn ? undefined : () => docStore.deleteObjectTemplate(tpl.id)}
                />
              ))}
            </div>
          ) : (
            <div
              ref={gridRef}
              className="dc-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSizePx}px, 1fr))`,
                gap: 10,
                alignContent: "start",
                paddingRight: 4,
              }}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop + el.clientHeight >= el.scrollHeight - 280 && visibleLimit < filteredAssets.length) {
                  setVisibleLimit((n) => Math.min(filteredAssets.length, n + 120));
                }
              }}
            >
              {filteredAssets.slice(0, visibleLimit).map((asset) => {
                const selected = asset.id === selectedAssetId;
                return (
                  <div
                    key={asset.id}
                    role="button"
                    tabIndex={0}
                    className={`dc-asset-card ${selected ? "selected" : ""}`}
                    style={{ width: "auto", minHeight: thumbnailSizePx + 26 }}
                    onClick={() => vault.setSelectedAssetId(asset.id)}
                    onDoubleClick={() => equipAssetAndClose(asset)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") vault.setSelectedAssetId(asset.id);
                      else if (e.key === " ") e.preventDefault();
                    }}
                    onKeyUp={(e) => {
                      if (e.key === " ") vault.setSelectedAssetId(asset.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      vault.setSelectedAssetId(asset.id);
                      onOpenContextMenu(
                        e.clientX,
                        e.clientY,
                        `Asset: ${asset.displayName}`,
                        buildAssetContextMenuEntries(asset),
                      );
                    }}
                  >
                    <div className="dc-asset-thumb-box" style={{ minHeight: thumbnailSizePx - 14 }}>
                      <span className="dc-source-pill">{SOURCE_BADGE[asset.sourceKind]}</span>
                      <button
                        type="button"
                        className={`dc-fav-btn ${asset.isFavorite ? "active" : ""}`}
                        aria-label={asset.isFavorite ? `Unfavorite ${asset.displayName}` : `Favorite ${asset.displayName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          vault.toggleFavoriteAsset(asset.id);
                        }}
                      >
                        <Star size={12} aria-hidden="true" fill={asset.isFavorite ? "currentColor" : "none"} />
                      </button>
                      {isNativeColorableAsset(asset) && (
                        <span
                          title="Colorable Asset"
                          style={{
                            position: "absolute",
                            right: 5,
                            bottom: 5,
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background:
                              "conic-gradient(#EF4444, #F59E0B, #10B981, #3B82F6, #A855F7, #EF4444)",
                            border: "1.5px solid rgba(12, 16, 24, 0.92)",
                            zIndex: 2,
                          }}
                        />
                      )}
                      <img src={asset.thumbUrl} alt={asset.displayName} loading="lazy" />
                    </div>
                    <div className="dc-asset-title">{asset.displayName}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Context-Aware Inspector (Template Prefab Studio OR Asset Live Recolor Studio) */}
        <aside
          className="dc-scroll"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            paddingLeft: 12,
            borderLeft: "1px solid var(--border-subtle)",
            overflowY: "auto",
          }}
        >
          {templatesView ? (
            selectedTemplate ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    {selectedTemplate.name}
                  </h3>
                  <span className="dc-badge">{selectedTemplate.items.length} objects</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  {selectedTemplate.description}
                </div>

                {/* Transform controls */}
                <div
                  style={{
                    background: "var(--bg-panel)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Placement Scale</span>
                    <span style={{ fontFamily: "var(--font-mono)" }}>{Math.round(templateScale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    className="dc-range"
                    min={0.4}
                    max={2.2}
                    step={0.05}
                    value={templateScale}
                    onChange={(e) => docStore.setTemplateTransform({ scale: parseFloat(e.target.value) })}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Placement Rotation</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{rotDeg}°</span>
                      <button
                        type="button"
                        className="dc-mini-icon-btn"
                        aria-label="Rotate 45 degrees"
                        onClick={() =>
                          docStore.setTemplateTransform({ rotationRad: templateRotationRad + Math.PI / 4 })
                        }
                      >
                        <RotateCw size={11} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="dc-mini-icon-btn"
                        aria-label="Reset template transform"
                        onClick={() => docStore.setTemplateTransform({ rotationRad: 0, scale: 1 })}
                      >
                        <RotateCcw size={11} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Included Props Breakdown */}
                <div>
                  <div className="dc-field-label" style={{ marginBottom: 6 }}>
                    Included Props ({selectedTemplate.items.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {selectedTemplate.items.map((it, idx) => {
                      const a = assetById.get(it.assetId);
                      return (
                        <div
                          key={`${selectedTemplate.id}-${idx}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "4px 6px",
                            borderRadius: 6,
                            background: "var(--bg-panel)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 4,
                              background: "#10131a",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {a && (
                              <img
                                src={a.thumbUrl}
                                alt=""
                                style={{ maxWidth: "88%", maxHeight: "88%", objectFit: "contain" }}
                              />
                            )}
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-primary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {a?.displayName ?? it.assetId.split("/").pop()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                  <button
                    type="button"
                    className="dc-btn dc-btn-ghost"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      const name = window.prompt("Save current map selection/layer as new template:");
                      if (!name) return;
                      docStore.saveCustomObjectTemplate({
                        name,
                        category: "saved",
                        scope: selection?.kind === "object" ? "cluster" : "layer",
                        radiusCells: 3.5,
                      });
                    }}
                  >
                    <BookmarkPlus size={14} aria-hidden="true" />
                    <span>Save Selection as New Template</span>
                  </button>
                  <button
                    type="button"
                    className="dc-btn dc-btn-gold"
                    style={{ width: "100%", height: 36 }}
                    onClick={() => {
                      docStore.selectObjectTemplate(selectedTemplate.id);
                      docStore.setVaultExpandedModal(false);
                      docStore.pushToast(`Equipped Template "${selectedTemplate.name}"`, "success");
                    }}
                  >
                    <LayoutGrid size={15} aria-hidden="true" />
                    <span>Equip &amp; Stamp Template</span>
                  </button>
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-muted)", paddingTop: 40, textAlign: "center" }}>
                <LayoutGrid size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
                <div>Select a premade object group to inspect its props and placement controls.</div>
              </div>
            )
          ) : selectedAsset ? (
            <>
              <ColorStudioPanel
                recolor={activeRecolor}
                asset={selectedAsset}
                title="Live Shader Recolor"
                showPreviewCanvas
                onChange={(next) => docStore.setActiveRecolor(next)}
              />

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                    {selectedAsset.displayName}
                  </h3>
                  <span className="dc-badge" style={{ height: 22, padding: "0 6px" }}>
                    {selectedAsset.category}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {formatVaultSourceLabel(selectedAsset.sourceName)}
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span className="dc-badge">
                  {(selectedAsset.widthPx / selectedAsset.defaultPpi).toFixed(1)}×
                  {(selectedAsset.heightPx / selectedAsset.defaultPpi).toFixed(1)} Grid
                </span>
                <span className="dc-badge">{selectedAsset.defaultPpi} PPI</span>
                <span className="dc-badge">
                  Shadow: {selectedAsset.castsShadow ? "ON" : "OFF"}
                </span>
              </div>

              <div>
                <div className="dc-field-label" style={{ marginBottom: 6 }}>
                  Editable Tags
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                  {selectedAsset.tags.map((tag) => (
                    <span key={tag} className="dc-chip">
                      #{tag}
                      <button
                        type="button"
                        aria-label={`Remove tag ${tag}`}
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          padding: 0,
                          marginLeft: 2,
                        }}
                        onClick={() => vault.removeTagFromAsset(selectedAsset.id, tag)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <form
                  style={{ display: "flex", gap: 6 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTagInput.trim()) return;
                    vault.addTagToAsset(selectedAsset.id, newTagInput);
                    setNewTagInput("");
                  }}
                >
                  <input
                    className="dc-input"
                    style={{ flex: 1 }}
                    placeholder="Add tag (e.g. speakeasy)…"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                  />
                  <button type="submit" className="dc-btn" aria-label="Add tag">
                    <Plus size={13} aria-hidden="true" />
                  </button>
                </form>
              </div>

              <button
                type="button"
                className="dc-btn dc-btn-gold"
                style={{ width: "100%", height: 36, marginTop: "auto" }}
                onClick={() => equipAssetAndClose(selectedAsset)}
              >
                <Stamp size={15} aria-hidden="true" />
                <span>Equip &amp; Stamp on Map</span>
              </button>
            </>
          ) : (
            <div style={{ color: "var(--text-muted)", paddingTop: 40, textAlign: "center" }}>
              <Layers size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>Select an asset to inspect metadata and live RGB shader tinting.</div>
            </div>
          )}
        </aside>
      </div>
    </ModalDialog>
  );
};

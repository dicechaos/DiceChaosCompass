import React from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { isNativeColorableAsset } from "@/engine/colorShader";
import { useDocumentStore } from "@/store/documentStore";
import {
  CATEGORY_FACETS,
  formatVaultSourceLabel,
  OBJECT_SUBGROUPS,
  useVaultStore,
  WORLD_ASSET_GROUPS,
} from "@/store/vaultStore";
import type { ContextMenuEntry } from "@/ui/common/ContextMenu";
import type { ObjectTemplate, ObjectTemplateCategory, VaultAsset } from "@/types/map";

export const SOURCE_BADGE: Record<VaultAsset["sourceKind"], string> = {
  dcpack: "DC",
  dungeondraft_pack: "DD",
  wonderdraft: "WD",
  folder: "PNG",
  zip: "ZIP",
};

export const TEMPLATE_CATEGORY_PILLS: Array<{
  id: "all" | ObjectTemplateCategory;
  label: string;
}> = [
  { id: "all", label: "All Prefabs" },
  { id: "saved", label: "Saved Custom" },
  { id: "interiors", label: "Interiors" },
  { id: "magipunk", label: "Magi-Punk" },
  { id: "camp_wilds", label: "Camp & Caves" },
  { id: "water_ships", label: "Water & Ships" },
];

export function filterObjectTemplates(
  templates: ObjectTemplate[],
  category: "all" | ObjectTemplateCategory,
  searchQuery: string,
): ObjectTemplate[] {
  const q = searchQuery.trim().toLowerCase().replace(/^#/, "");
  return templates.filter((t) => {
    if (category === "saved") {
      if (t.isBuiltIn) return false;
    } else if (category !== "all" && t.category !== category) {
      return false;
    }
    if (q) {
      return (
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

/**
 * Equip a VaultAsset with the appropriate studio tool and smart Dungeondraft/Wonderdraft
 * color-capability state.
 */
export function equipVaultAsset(
  asset: VaultAsset,
  opts?: { closeModal?: boolean; toast?: boolean },
): void {
  const vault = useVaultStore.getState();
  const docStore = useDocumentStore.getState();
  vault.setSelectedAssetId(asset.id);

  if (asset.category === "terrain") {
    docStore.setBrushParams({ activeTerrainAssetId: asset.id });
    docStore.setActiveTool("terrain");
  } else if (asset.category === "wall") {
    docStore.setBrushParams({ activeWallAssetId: asset.id });
    docStore.setActiveTool("wall");
  } else if (asset.category === "path") {
    docStore.setBrushParams({ activePathAssetId: asset.id });
    docStore.setActiveTool("path");
  } else if (asset.category === "portal") {
    docStore.setBrushParams({ activePortalAssetId: asset.id });
    docStore.setActiveTool("portal");
  } else {
    docStore.setActiveTool("stamp");
    const curRec = useDocumentStore.getState().activeRecolor;
    const needsAutoSwatch =
      asset.drawMode === "dd_red" ||
      asset.drawMode === "rgb_channels" ||
      (asset.category !== "symbol" && isNativeColorableAsset(asset));
    if (needsAutoSwatch) {
      const safeHex =
        !curRec.tintHex || curRec.tintHex.toUpperCase() === "#FFFFFF"
          ? "#2563EB"
          : curRec.tintHex;
      docStore.setActiveRecolor({
        enabled: true,
        mode: "auto",
        tintHex: safeHex,
        strength: 1.0,
      });
    } else if (curRec.enabled && curRec.mode === "auto") {
      docStore.setActiveRecolor({ enabled: false });
    }
  }

  if (opts?.closeModal) {
    docStore.setVaultExpandedModal(false);
  }
  if (opts?.toast) {
    docStore.pushToast(`Equipped "${asset.displayName}"`, "success");
  }
}

/**
 * Context-aware studio actions exposing all modern ways an asset can be used
 * (Stamp, Smart Scatter Pool, Cave Floor/Wall, Water Surface, Roof Material, Live Recolor, Biome Kits).
 */
export function buildAssetContextMenuEntries(asset: VaultAsset): ContextMenuEntry[] {
  const vault = useVaultStore.getState();
  const docStore = useDocumentStore.getState();
  const biomeKits = vault.biomeKits;

  const entries: ContextMenuEntry[] = [
    {
      type: "item",
      id: "act-equip",
      label: `Equip with ${
        asset.category === "object"
          ? "Stamp"
          : asset.category === "symbol"
            ? "World Symbol"
            : asset.category.charAt(0).toUpperCase() + asset.category.slice(1)
      } Tool`,
      onSelect: () => equipVaultAsset(asset, { toast: true }),
    },
  ];

  // Cross-tool studio superpowers ("ways of using assets")
  if (asset.category === "object") {
    const inScatter = docStore.scatterAssetIds.includes(asset.id);
    entries.push({
      type: "item",
      id: "act-scatter",
      label: inScatter ? "Remove from Smart Scatter Pool (Z)" : "Add to Smart Scatter Pool (Z)",
      checked: inScatter,
      onSelect: () => {
        const cur = useDocumentStore.getState().scatterAssetIds;
        const next = cur.includes(asset.id)
          ? cur.filter((id) => id !== asset.id)
          : [...cur, asset.id];
        docStore.setBrushParams({ scatterAssetIds: next });
        docStore.pushToast(
          inScatter
            ? `Removed "${asset.displayName}" from Scatter Pool`
            : `Added "${asset.displayName}" to Smart Scatter Pool (${next.length} assets)`,
          "success",
        );
      },
    });
  } else if (asset.category === "terrain") {
    entries.push(
      {
        type: "item",
        id: "act-cave-floor",
        label: "Use as Cave Floor Texture (H)",
        onSelect: () => {
          docStore.setBrushParams({ caveFloorAssetId: asset.id });
          docStore.setActiveTool("cave");
          docStore.pushToast(`Set Cave Floor → ${asset.displayName}`, "success");
        },
      },
      {
        type: "item",
        id: "act-water-tex",
        label: "Use as Water Surface Texture (W)",
        onSelect: () => {
          docStore.setBrushParams({ waterTextureAssetId: asset.id });
          docStore.setActiveTool("water");
          docStore.pushToast(`Set Water Texture → ${asset.displayName}`, "success");
        },
      },
      {
        type: "item",
        id: "act-roof-tex",
        label: "Use as Roof Shingle Material (O)",
        onSelect: () => {
          docStore.setBrushParams({ activeRoofAssetId: asset.id });
          docStore.setActiveTool("roof");
          docStore.pushToast(`Set Roof Material → ${asset.displayName}`, "success");
        },
      },
    );
  } else if (asset.category === "wall") {
    entries.push({
      type: "item",
      id: "act-cave-wall",
      label: "Use as Cave Rock Wall (H)",
      onSelect: () => {
        docStore.setBrushParams({ caveWallAssetId: asset.id });
        docStore.setActiveTool("cave");
        docStore.pushToast(`Set Cave Wall → ${asset.displayName}`, "success");
      },
    });
  }

  entries.push(
    {
      type: "item",
      id: "act-inspect",
      label: "Inspect & Live RGB Recolor…",
      onSelect: () => {
        vault.setSelectedAssetId(asset.id);
        docStore.setVaultExpandedModal(true);
      },
    },
    {
      type: "item",
      id: "act-fav",
      label: asset.isFavorite ? "Remove from Favorites" : "Add to Favorites",
      checked: asset.isFavorite,
      onSelect: () => vault.toggleFavoriteAsset(asset.id),
    },
    { type: "separator" },
    {
      type: "submenu",
      id: "act-kit",
      label: "Add to Biome Kit",
      items: biomeKits.map((k) => ({
        id: `add-${k.id}`,
        label: k.name,
        checked: k.assetIds.includes(asset.id),
        onSelect: () => {
          vault.addAssetToKit(k.id, asset.id);
          docStore.pushToast(`Added to "${k.name}"`, "success");
        },
      })),
    },
    {
      type: "item",
      id: "act-tag",
      label: "Add Custom Tag…",
      onSelect: () => {
        const tag = window.prompt(`Add tag to "${asset.displayName}":`);
        if (tag) {
          vault.addTagToAsset(asset.id, tag);
          docStore.pushToast(`Tagged #${tag.trim().toLowerCase()}`, "success");
        }
      },
    },
  );

  return entries;
}

interface VaultTemplateCardProps {
  template: ObjectTemplate;
  selected: boolean;
  assetById: Map<string, VaultAsset>;
  onSelect: () => void;
  onDoubleClick?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

export const VaultTemplateCard: React.FC<VaultTemplateCardProps> = React.memo(
  ({ template, selected, assetById, onSelect, onDoubleClick, onRename, onDelete }) => {
    const thumbs = template.items
      .slice(0, 4)
      .map((it) => {
        const a = assetById.get(it.assetId);
        return a ? a.thumbUrl || a.url : null;
      })
      .filter((u): u is string => Boolean(u));

    return (
      <div
        role="button"
        tabIndex={0}
        draggable
        className={`dc-vault-template-card ${selected ? "selected" : ""}`}
        title={`${template.name} (${template.items.length} objects) — Click to equip Template Tool (T) or drag directly onto the map`}
        onDragStart={(e) => {
          e.dataTransfer.setData("application/x-dicechaos-template", template.id);
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={onSelect}
        onDoubleClick={onDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSelect();
          } else if (e.key === " ") {
            e.preventDefault();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " ") {
            onSelect();
          }
        }}
      >
        <div className="dc-vault-template-mosaic" aria-hidden="true">
          {[0, 1, 2, 3].map((slot) => (
            <div key={slot} className="dc-vault-template-cell">
              {thumbs[slot] ? (
                <img src={thumbs[slot]} alt="" loading="lazy" />
              ) : (
                <span style={{ fontSize: 9, color: "var(--text-muted)", opacity: 0.4 }}>·</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span
              aria-hidden="true"
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: template.accentHex,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: selected ? "var(--accent-gold)" : "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {template.name}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            <span
              style={{
                fontSize: 9.5,
                fontFamily: "var(--font-mono)",
                padding: "1px 5px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.06)",
                color: "var(--text-secondary)",
              }}
            >
              {template.items.length}×
            </span>
            {!template.isBuiltIn && onRename && (
              <button
                type="button"
                className="dc-mini-icon-btn"
                aria-label={`Rename ${template.name}`}
                title="Rename Saved Template"
                style={{ width: 20, height: 20 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }}
              >
                <Pencil size={10} />
              </button>
            )}
            {!template.isBuiltIn && onDelete && (
              <button
                type="button"
                className="dc-mini-icon-btn"
                aria-label={`Delete ${template.name}`}
                title="Delete Saved Template"
                style={{ width: 20, height: 20 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {template.description}
        </div>
      </div>
    );
  },
);

export const VaultActiveFilterChips: React.FC = () => {
  const searchQuery = useVaultStore((s) => s.searchQuery);
  const templatesView = useVaultStore((s) => s.templatesView);
  const activeCategory = useVaultStore((s) => s.activeCategory);
  const activeCategoryFacet = useVaultStore((s) => s.activeCategoryFacet);
  const activeSubGroup = useVaultStore((s) => s.activeSubGroup);
  const activeWorldGroup = useVaultStore((s) => s.activeWorldGroup);
  const activeWorldDrawMode = useVaultStore((s) => s.activeWorldDrawMode);
  const activeWorldSet = useVaultStore((s) => s.activeWorldSet);
  const activeSourceId = useVaultStore((s) => s.activeSourceId);
  const activeKitId = useVaultStore((s) => s.activeKitId);
  const activeTags = useVaultStore((s) => s.activeTags);
  const favoritesOnly = useVaultStore((s) => s.favoritesOnly);
  const recentOnly = useVaultStore((s) => s.recentOnly);
  const colorableOnly = useVaultStore((s) => s.colorableOnly);
  const colorFilterHex = useVaultStore((s) => s.colorFilterHex);
  const sources = useVaultStore((s) => s.sources);
  const biomeKits = useVaultStore((s) => s.biomeKits);

  const vault = useVaultStore.getState();

  const chips: Array<{ id: string; label: string; onClear: () => void }> = [];

  if (searchQuery.trim()) {
    chips.push({
      id: "search",
      label: `Search: "${searchQuery.trim()}"`,
      onClear: () => vault.setSearchQuery(""),
    });
  }
  if (!templatesView) {
    if (activeSubGroup) {
      const def = OBJECT_SUBGROUPS.find((g) => g.id === activeSubGroup);
      chips.push({
        id: "subgroup",
        label: `Group: ${def?.label ?? activeSubGroup}`,
        onClear: () => vault.setActiveSubGroup(null),
      });
    }
    if (activeCategoryFacet) {
      const def = CATEGORY_FACETS[activeCategory]?.find((f) => f.id === activeCategoryFacet);
      chips.push({
        id: "facet",
        label: `Filter: ${def?.label ?? activeCategoryFacet}`,
        onClear: () => vault.setActiveCategoryFacet(null),
      });
    }
    if (activeWorldGroup) {
      const def = WORLD_ASSET_GROUPS.find((g) => g.id === activeWorldGroup);
      chips.push({
        id: "worldgroup",
        label: `World: ${def?.label ?? activeWorldGroup}`,
        onClear: () => vault.setActiveWorldGroup(null),
      });
    }
    if (activeWorldDrawMode !== "all") {
      const worldStyleLabels: Record<string, string> = {
        normal: "Full Color",
        sample_color: "Paintable (Biome)",
        tint: "Engraved Ink",
        rgb_channels: "Custom RGB",
      };
      chips.push({
        id: "worldmode",
        label: `Style: ${worldStyleLabels[activeWorldDrawMode] ?? activeWorldDrawMode.replace("_", " ")}`,
        onClear: () => vault.setActiveWorldDrawMode("all"),
      });
    }
    if (activeWorldSet) {
      chips.push({
        id: "worldset",
        label: `Set: ${activeWorldSet.replace(/^set_/, "").replace(/_/g, " ")}`,
        onClear: () => vault.setActiveWorldSet(null),
      });
    }
    if (activeSourceId) {
      const src = sources.find((s) => s.id === activeSourceId);
      chips.push({
        id: "source",
        label: `Pack: ${src ? formatVaultSourceLabel(src.name) : activeSourceId}`,
        onClear: () => vault.setActiveSourceId(null),
      });
    }
    if (activeKitId) {
      const kit = biomeKits.find((k) => k.id === activeKitId);
      chips.push({
        id: "kit",
        label: `Kit: ${kit?.name ?? activeKitId}`,
        onClear: () => vault.setActiveKitId(null),
      });
    }
    if (favoritesOnly) {
      chips.push({
        id: "favs",
        label: "Favorites",
        onClear: () => vault.setFavoritesOnly(false),
      });
    }
    if (recentOnly) {
      chips.push({
        id: "recent",
        label: "Recently Used",
        onClear: () => vault.setRecentOnly(false),
      });
    }
    if (colorableOnly) {
      chips.push({
        id: "colorable",
        label: "Colorable Only",
        onClear: () => vault.setColorableOnly(false),
      });
    }
    if (colorFilterHex) {
      chips.push({
        id: "colorhex",
        label: `Color: ${colorFilterHex}`,
        onClear: () => vault.setColorFilterHex(null),
      });
    }
    for (const tag of activeTags) {
      chips.push({
        id: `tag-${tag}`,
        label: `#${tag}`,
        onClear: () => vault.toggleTagFilter(tag),
      });
    }
  }

  if (chips.length === 0) return null;

  return (
    <div className="dc-vault-active-chips" role="region" aria-label="Active Filters">
      <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
        Active:
      </span>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          className="dc-vault-active-chip"
          onClick={c.onClear}
          title={`Remove filter: ${c.label}`}
        >
          <span>{c.label}</span>
          <X size={10} aria-hidden="true" />
        </button>
      ))}
      {chips.length > 1 && (
        <button
          type="button"
          className="dc-vault-world-pill"
          style={{ height: 20, fontSize: 9.5 }}
          onClick={() => vault.clearDrawerFilters()}
        >
          Clear All
        </button>
      )}
    </div>
  );
};

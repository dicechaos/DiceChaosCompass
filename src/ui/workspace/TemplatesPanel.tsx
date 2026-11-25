import React, { useMemo, useState } from "react";
import {
  BookmarkPlus,
  LayoutGrid,
  Pencil,
  RotateCcw,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react";
import { useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import type { ObjectTemplateCategory } from "@/types/map";

const CATEGORY_TABS: Array<{ id: "all" | ObjectTemplateCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "saved", label: "Saved" },
  { id: "water_ships", label: "Water" },
  { id: "camp_wilds", label: "Camp" },
  { id: "magipunk", label: "Magi-Punk" },
  { id: "interiors", label: "Interiors" },
];

export const TemplatesPanel: React.FC = () => {
  const objectTemplates = useDocumentStore((s) => s.objectTemplates);
  const activeTemplateId = useDocumentStore((s) => s.activeTemplateId);
  const templateRotationRad = useDocumentStore((s) => s.templateRotationRad);
  const templateScale = useDocumentStore((s) => s.templateScale);
  const selection = useDocumentStore((s) => s.selection);
  const doc = useDocumentStore((s) => s.getActiveDoc());

  const selectObjectTemplate = useDocumentStore((s) => s.selectObjectTemplate);
  const setTemplateTransform = useDocumentStore((s) => s.setTemplateTransform);
  const saveCustomObjectTemplate = useDocumentStore((s) => s.saveCustomObjectTemplate);
  const renameObjectTemplate = useDocumentStore((s) => s.renameObjectTemplate);
  const deleteObjectTemplate = useDocumentStore((s) => s.deleteObjectTemplate);

  const assets = useVaultStore((s) => s.assets);
  const assetThumbMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of assets) m.set(a.id, a.thumbUrl || a.url);
    return m;
  }, [assets]);

  const [categoryFilter, setCategoryFilter] = useState<"all" | ObjectTemplateCategory>("all");
  const [search, setSearch] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saveScope, setSaveScope] = useState<"cluster" | "layer">("cluster");
  const [clusterRadius, setClusterRadius] = useState(3.5);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return objectTemplates.filter((t) => {
      if (categoryFilter === "saved") {
        if (t.isBuiltIn) return false;
      } else if (categoryFilter !== "all" && t.category !== categoryFilter) {
        return false;
      }
      if (q) {
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [objectTemplates, categoryFilter, search]);

  const savedCount = useMemo(
    () => objectTemplates.filter((t) => !t.isBuiltIn).length,
    [objectTemplates],
  );

  // Live preview of how many objects would be captured by the current Save scope
  const capturePreviewCount = useMemo(() => {
    if (saveScope === "cluster" && selection?.kind === "object") {
      const layer = doc.layers.find((l) => l.id === selection.layerId);
      const anchor = layer?.objects?.find((o) => o.id === selection.id);
      if (!anchor || !layer?.objects) return 0;
      const r2 = clusterRadius * clusterRadius;
      return layer.objects.filter((o) => {
        const dx = o.x - anchor.x;
        const dy = o.y - anchor.y;
        return dx * dx + dy * dy <= r2;
      }).length;
    }
    const activeLayer = doc.layers.find(
      (l) => l.id === doc.activeLayerId && l.kind === "objects" && (l.objects?.length ?? 0) > 0,
    );
    const fallbackLayer =
      activeLayer ??
      doc.layers.find(
        (l) => l.levelId === doc.activeLevelId && l.kind === "objects" && (l.objects?.length ?? 0) > 0,
      );
    return fallbackLayer?.objects?.length ?? 0;
  }, [doc, selection, saveScope, clusterRadius]);

  const rotDeg = Math.round((((templateRotationRad * 180) / Math.PI) % 360 + 360) % 360);

  const handleSave = () => {
    const effectiveScope =
      saveScope === "cluster" && selection?.kind === "object" ? "cluster" : "layer";
    const ok = saveCustomObjectTemplate({
      name: saveName.trim() || `Custom Group ${savedCount + 1}`,
      category: "saved",
      scope: effectiveScope,
      radiusCells: clusterRadius,
    });
    if (ok) {
      setSaveName("");
      setCategoryFilter("all");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent-gold)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          <LayoutGrid size={13} />
          <span>Object Templates</span>
        </div>
        <span className="dc-badge" style={{ fontSize: 10 }}>
          {objectTemplates.length} groups
        </span>
      </div>

      {/* Placement Transform Controls */}
      <div
        style={{
          background: "rgba(15,23,42,0.55)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
          <span style={{ color: "var(--text-secondary)" }}>Group Scale</span>
          <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
            {Math.round(templateScale * 100)}%
          </span>
        </div>
        <input
          type="range"
          min={0.4}
          max={2.2}
          step={0.05}
          value={templateScale}
          onChange={(e) => setTemplateTransform({ scale: parseFloat(e.target.value) })}
          style={{ width: "100%", accentColor: "var(--accent-gold)" }}
        />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
          <span style={{ color: "var(--text-secondary)" }}>Group Rotation</span>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{rotDeg}°</span>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Rotate 45° CW (Shift+Wheel)"
              onClick={() =>
                setTemplateTransform({ rotationRad: templateRotationRad + Math.PI / 4 })
              }
            >
              <RotateCw size={11} />
            </button>
            <button
              type="button"
              className="dc-mini-icon-btn"
              title="Reset Rotation & Scale"
              onClick={() => setTemplateTransform({ rotationRad: 0, scale: 1 })}
            >
              <RotateCcw size={11} />
            </button>
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={5}
          value={rotDeg}
          onChange={(e) =>
            setTemplateTransform({ rotationRad: (parseFloat(e.target.value) * Math.PI) / 180 })
          }
          style={{ width: "100%", accentColor: "var(--accent-gold)" }}
        />
      </div>

      {/* Save Premade Object Group Composer */}
      <div
        style={{
          background: "rgba(229,169,60,0.08)",
          border: "1px solid rgba(229,169,60,0.28)",
          borderRadius: 8,
          padding: 8,
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
            fontSize: 11,
            fontWeight: 600,
            color: "var(--accent-gold)",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <BookmarkPlus size={12} /> Save Premade Group
          </span>
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
            {capturePreviewCount} obj
          </span>
        </div>

        <input
          type="text"
          className="dc-input"
          placeholder="Group name (e.g. Camp Ambush)…"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          style={{ fontSize: 11, padding: "4px 7px" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          <button
            type="button"
            className={`dc-pill-btn ${saveScope === "cluster" ? "active" : ""}`}
            style={{ fontSize: 10, justifyContent: "center" }}
            onClick={() => setSaveScope("cluster")}
            title="Capture all objects near the currently selected prop"
          >
            Near Selected
          </button>
          <button
            type="button"
            className={`dc-pill-btn ${saveScope === "layer" ? "active" : ""}`}
            style={{ fontSize: 10, justifyContent: "center" }}
            onClick={() => setSaveScope("layer")}
            title="Capture all objects on the active object layer"
          >
            Active Layer
          </button>
        </div>

        {saveScope === "cluster" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-secondary)" }}>
              <span>{selection?.kind === "object" ? "Capture Radius" : "Tip: Select an object first (V)"}</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>{clusterRadius.toFixed(1)} sq</span>
            </div>
            <input
              type="range"
              min={1.5}
              max={8}
              step={0.5}
              value={clusterRadius}
              onChange={(e) => setClusterRadius(parseFloat(e.target.value))}
              style={{ width: "100%", accentColor: "var(--accent-gold)" }}
            />
          </div>
        )}

        <button
          type="button"
          className="dc-btn dc-btn-primary"
          style={{ fontSize: 11, padding: "5px 8px", justifyContent: "center" }}
          disabled={capturePreviewCount === 0}
          onClick={handleSave}
        >
          <BookmarkPlus size={12} /> Save Group ({capturePreviewCount} objects)
        </button>
      </div>

      {/* Search + Category Filter Pills */}
      <div style={{ position: "relative" }}>
        <Search
          size={12}
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        />
        <input
          type="text"
          className="dc-input"
          placeholder="Filter premade groups…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ fontSize: 11, paddingLeft: 25, paddingTop: 4, paddingBottom: 4, width: "100%" }}
        />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`dc-pill-btn ${categoryFilter === tab.id ? "active" : ""}`}
            style={{ fontSize: 10, padding: "3px 7px" }}
            onClick={() => setCategoryFilter(tab.id)}
          >
            {tab.label}
            {tab.id === "saved" && savedCount > 0 ? ` (${savedCount})` : ""}
          </button>
        ))}
      </div>

      {/* Premade Object Group Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "12px 6px" }}>
            {categoryFilter === "saved"
              ? "No saved custom groups yet — select any prop cluster and click Save Group above."
              : "No object templates match that filter."}
          </div>
        ) : (
          filtered.map((tpl) => {
            const isSelected = tpl.id === activeTemplateId;
            const thumbs = tpl.items
              .slice(0, 4)
              .map((it) => assetThumbMap.get(it.assetId))
              .filter((u): u is string => Boolean(u));
            return (
              <div
                key={tpl.id}
                role="button"
                tabIndex={0}
                onClick={() => selectObjectTemplate(tpl.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectObjectTemplate(tpl.id);
                  }
                }}
                style={{
                  textAlign: "left",
                  padding: 7,
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `1px solid ${isSelected ? "var(--accent-gold)" : "var(--border-subtle)"}`,
                  background: isSelected
                    ? "rgba(229,169,60,0.14)"
                    : "rgba(15,23,42,0.52)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: tpl.accentHex,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: isSelected ? "var(--accent-gold)" : "var(--text-primary)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {tpl.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {tpl.items.length}×
                    </span>
                    {!tpl.isBuiltIn && (
                      <>
                        <button
                          type="button"
                          className="dc-mini-icon-btn"
                          title="Rename Saved Template"
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = window.prompt("Rename template:", tpl.name);
                            if (next) renameObjectTemplate(tpl.id, next);
                          }}
                        >
                          <Pencil size={10} />
                        </button>
                        <button
                          type="button"
                          className="dc-mini-icon-btn"
                          title="Delete Saved Template"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteObjectTemplate(tpl.id);
                          }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Mini visual strip of the objects inside this premade group */}
                {thumbs.length > 0 && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    {thumbs.map((url, idx) => (
                      <div
                        key={`${tpl.id}-th-${idx}`}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 5,
                          background: "rgba(2,6,23,0.65)",
                          border: "1px solid rgba(148,163,184,0.16)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={url}
                          alt=""
                          style={{ maxWidth: "88%", maxHeight: "88%", objectFit: "contain" }}
                        />
                      </div>
                    ))}
                    {tpl.items.length > 4 && (
                      <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 2 }}>
                        +{tpl.items.length - 4} more
                      </span>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 10.5, color: "var(--text-secondary)", lineHeight: 1.3 }}>
                  {tpl.description}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Focus,
  Layers,
  Plus,
  X,
} from "lucide-react";
import {
  getOnionSkinDirection,
  getOnionSkinReferenceLevel,
  summarizeLevel,
} from "@/engine/layerMeta";
import { sortLevelsTopDown, useDocumentStore } from "@/store/documentStore";
import type { ContextMenuEntry } from "@/ui/common/ContextMenu";
import type { MapLevel } from "@/types/map";

const RAIL_COLLAPSED_KEY = "dc-elevation-rail-collapsed";

function loadRailCollapsed(): boolean {
  try {
    return localStorage.getItem(RAIL_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function getLevelAccent(kind: MapLevel["kind"]) {
  if (kind === "sky") {
    return { fg: "#38BDF8", bg: "rgba(56, 189, 248, 0.22)", border: "rgba(56, 189, 248, 0.85)" };
  }
  if (kind === "roof") {
    return { fg: "#C4B5FD", bg: "rgba(139, 92, 246, 0.22)", border: "rgba(139, 92, 246, 0.72)" };
  }
  if (kind === "upper") {
    return { fg: "#22D3EE", bg: "rgba(34, 211, 238, 0.18)", border: "rgba(34, 211, 238, 0.72)" };
  }
  if (kind === "underground") {
    return { fg: "#818CF8", bg: "rgba(99, 102, 241, 0.22)", border: "rgba(129, 140, 248, 0.72)" };
  }
  return { fg: "#E5A93C", bg: "rgba(229, 169, 60, 0.2)", border: "rgba(229, 169, 60, 0.78)" };
}

function formatElev(ft: number): string {
  return ft > 0 ? `+${ft}ft` : `${ft}ft`;
}

interface ElevationRailProps {
  onOpenContextMenu: (
    x: number,
    y: number,
    ariaLabel: string,
    entries: ContextMenuEntry[],
  ) => void;
}

export const ElevationRail: React.FC<ElevationRailProps> = React.memo(({ onOpenContextMenu }) => {
  const doc = useDocumentStore(
    (s) => s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0],
  );
  const showOnionSkin = useDocumentStore((s) => s.showOnionSkin);
  const isolateActiveFloor = useDocumentStore((s) => s.isolateActiveFloor);
  const lockLowerFloors = useDocumentStore((s) => s.lockLowerFloors);

  const [collapsed, setCollapsed] = useState<boolean>(loadRailCollapsed);
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftCode, setDraftCode] = useState("");
  const [draftElev, setDraftElev] = useState("0");
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const sortedLevels = useMemo(() => sortLevelsTopDown(doc.levels), [doc.levels]);
  const activeLevel = useMemo(
    () => doc.levels.find((lv) => lv.id === doc.activeLevelId) ?? sortedLevels[0],
    [doc.levels, doc.activeLevelId, sortedLevels],
  );

  const summariesByLevel = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summarizeLevel>>();
    for (const lv of doc.levels) {
      map.set(lv.id, summarizeLevel(doc, lv.id));
    }
    return map;
  }, [doc]);

  const onionRef = useMemo(() => getOnionSkinReferenceLevel(doc), [doc]);
  const onionDir = useMemo(
    () => (activeLevel && onionRef ? getOnionSkinDirection(activeLevel, onionRef) : null),
    [activeLevel, onionRef],
  );

  useEffect(() => {
    if (!editingLevelId) return;
    if (!doc.levels.some((lv) => lv.id === editingLevelId)) {
      setEditingLevelId(null);
      return;
    }
    const raf = requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, [editingLevelId, doc.levels]);

  if (doc.mode === "world" || !activeLevel) return null;

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(RAIL_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage errors
      }
      return next;
    });
    setEditingLevelId(null);
  };

  const openLevelEdit = (lv: MapLevel) => {
    setEditingLevelId(lv.id);
    setDraftName(lv.name);
    setDraftCode(lv.shortCode);
    setDraftElev(String(lv.elevationFt));
  };

  const commitLevelEdit = () => {
    if (!editingLevelId) return;
    const parsedElev = Number(draftElev);
    useDocumentStore.getState().updateLevelMeta(editingLevelId, {
      name: draftName,
      shortCode: draftCode,
      elevationFt: Number.isFinite(parsedElev) ? parsedElev : undefined,
    });
    setEditingLevelId(null);
  };

  const openAddFloorMenu = (clientX: number, clientY: number) => {
    const st = useDocumentStore.getState();
    const skyLevels = doc.levels.filter((lv) => lv.kind === "sky");
    let maxSkyNum = skyLevels.length;
    for (const sl of skyLevels) {
      const m = sl.shortCode.match(/(\d+)/);
      if (m) maxSkyNum = Math.max(maxSkyNum, Number(m[1]));
    }
    const nextSkyLabel = `Sky ${maxSkyNum + 1}`;
    const nextUpperNum = doc.levels.filter((lv) => lv.kind === "upper").length + 2;
    const nextSubNum = doc.levels.filter((lv) => lv.kind === "underground").length + 1;

    onOpenContextMenu(clientX, clientY, "Add New Floor or Elevation", [
      {
        type: "item",
        id: "rail-add-upper",
        label: `+ Add ${nextUpperNum}F (Building Upper Floor)`,
        onSelect: () => st.addLevelAbove("upper"),
      },
      {
        type: "item",
        id: "rail-add-sky",
        label: `+ Add ${nextSkyLabel} (Sky / Airship Deck)`,
        onSelect: () => st.addSkyLevel(),
      },
      { type: "separator" },
      {
        type: "item",
        id: "rail-add-sub",
        label: `+ Add B${nextSubNum} (Underground Level)`,
        onSelect: () => st.addLevelBelow(),
      },
    ]);
  };

  const openLevelContextMenu = (e: React.MouseEvent, lv: MapLevel) => {
    e.preventDefault();
    const st = useDocumentStore.getState();
    const sum = summariesByLevel.get(lv.id);
    const isActive = lv.id === activeLevel.id;
    onOpenContextMenu(e.clientX, e.clientY, `Level ${lv.shortCode}`, [
      {
        type: "item",
        id: "lv-switch",
        label: `Switch to ${lv.shortCode} (${formatElev(lv.elevationFt)})`,
        checked: isActive,
        onSelect: () => st.selectLevel(lv.id),
      },
      {
        type: "item",
        id: "lv-rename",
        label: "Edit Floor Name & Elevation…",
        onSelect: () => openLevelEdit(lv),
      },
      { type: "separator" },
      {
        type: "item",
        id: "lv-vis-all",
        label: sum?.allVisible ? `Hide All ${lv.shortCode} Layers` : `Show All ${lv.shortCode} Layers`,
        checked: Boolean(sum?.allVisible),
        onSelect: () => st.toggleLevelLayersVisible(lv.id),
      },
      {
        type: "item",
        id: "lv-lock-all",
        label: sum?.allLocked ? `Unlock All ${lv.shortCode} Layers` : `Lock All ${lv.shortCode} Layers`,
        checked: Boolean(sum?.allLocked),
        onSelect: () => st.toggleLevelLayersLocked(lv.id),
      },
      {
        type: "item",
        id: "lv-lock-below",
        label: "Lock Lower Floors from Clicking",
        checked: lockLowerFloors,
        onSelect: () => {
          st.setLockLowerFloors(!lockLowerFloors);
          st.pushToast(
            !lockLowerFloors
              ? "Lower floors protected from accidental clicks"
              : "Lower floors unlocked for cross-floor selection",
          );
        },
      },
      { type: "separator" },
      {
        type: "item",
        id: "lv-del",
        label: `Delete ${lv.shortCode} Level`,
        danger: true,
        disabled: lv.kind === "ground",
        onSelect: () => st.deleteLevel(lv.id),
      },
    ]);
  };

  const activeAccent = getLevelAccent(activeLevel.kind);
  const activeIdx = sortedLevels.findIndex((lv) => lv.id === activeLevel.id);
  const canStepUp = activeIdx > 0;
  const canStepDown = activeIdx >= 0 && activeIdx < sortedLevels.length - 1;

  const ghostBadgeLabel =
    showOnionSkin && onionRef
      ? `${onionRef.shortCode}${onionDir === "up" ? "↑" : "↓"}`
      : "Ghost";

  const ghostTooltip = onionRef
    ? `Onion-Skin Blueprint (Shift+G) — ${
        showOnionSkin ? "Showing" : "Preview"
      } 30% ghost wireframe of ${onionRef.shortCode} (${onionDir === "up" ? "above" : "below"}) for stair & wall alignment`
    : "Onion-Skin Blueprint (Shift+G) — Add another floor to compare adjacent layouts";

  if (collapsed) {
    return (
      <aside
        className="dc-elevation-rail collapsed"
        aria-label="Collapsed Floor Elevation Control"
      >
        <button
          type="button"
          className="dc-rail-icon-btn"
          title="Expand Level Elevator Shaft"
          aria-label="Expand Elevation Rail"
          onClick={toggleCollapsed}
        >
          <ChevronRight size={13} />
        </button>
        <button
          type="button"
          className="dc-rail-step-btn"
          disabled={!canStepUp}
          title="Step Up One Floor (PageUp)"
          aria-label="Step Up Floor"
          onClick={() => useDocumentStore.getState().stepLevel("up")}
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          className="dc-rail-active-pill"
          style={{
            borderColor: activeAccent.border,
            background: activeAccent.bg,
            color: activeAccent.fg,
          }}
          title={`${activeLevel.name} (${formatElev(activeLevel.elevationFt)}) · Click to expand floor shaft`}
          onClick={toggleCollapsed}
          onContextMenu={(e) => openLevelContextMenu(e, activeLevel)}
        >
          <span>{activeLevel.shortCode}</span>
          <span className="dc-rail-elev">{formatElev(activeLevel.elevationFt)}</span>
          {(isolateActiveFloor || showOnionSkin) && (
            <span className="dc-rail-status-dots" aria-hidden="true">
              {isolateActiveFloor && <i className="dot-solo" />}
              {showOnionSkin && <i className="dot-ghost" />}
            </span>
          )}
        </button>
        <button
          type="button"
          className="dc-rail-step-btn"
          disabled={!canStepDown}
          title="Step Down One Floor (PageDown)"
          aria-label="Step Down Floor"
          onClick={() => useDocumentStore.getState().stepLevel("down")}
        >
          <ChevronDown size={12} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="dc-elevation-rail" aria-label="Sky, Building & Underground Levels">
      <div className="dc-rail-head">
        <span className="dc-rail-title">FLR</span>
        <button
          type="button"
          className="dc-rail-icon-btn"
          title="Collapse Elevation Rail (Uncover West Map Edge)"
          aria-label="Collapse Elevation Rail"
          onClick={toggleCollapsed}
        >
          <ChevronLeft size={12} />
        </button>
      </div>

      <div className="dc-elevator-list">
        {sortedLevels.map((lv, idx) => {
          const isActive = lv.id === activeLevel.id;
          const prevLv = idx > 0 ? sortedLevels[idx - 1] : null;
          const zoneGroup = (k: string) =>
            k === "sky" ? "sky" : k === "roof" ? "roof" : k === "underground" ? "sub" : "bldg";
          const showZoneDivider =
            prevLv !== null && zoneGroup(prevLv.kind) !== zoneGroup(lv.kind);
          const accent = getLevelAccent(lv.kind);
          const summary = summariesByLevel.get(lv.id);
          const isCompositingBelow =
            !isolateActiveFloor && !isActive && lv.visible && (summary?.visibleLayerCount ?? 0) > 0;
          const isEmpty = (summary?.totalEntities ?? 0) === 0;
          const isGhostTarget = showOnionSkin && onionRef?.id === lv.id;

          return (
            <React.Fragment key={lv.id}>
              {showZoneDivider && <div className="dc-rail-divider" />}
              <button
                type="button"
                className={`dc-rail-floor-btn ${isActive ? "active" : ""} ${
                  isCompositingBelow ? "composited" : ""
                } ${isEmpty && !isActive ? "empty" : ""}`}
                onClick={() => useDocumentStore.getState().selectLevel(lv.id)}
                onContextMenu={(e) => openLevelContextMenu(e, lv)}
                title={`${lv.shortCode} · ${lv.name} (${formatElev(lv.elevationFt)})\n${
                  summary?.layerCount ?? 0
                } layers · ${summary?.totalEntities ?? 0} items${
                  isCompositingBelow ? " · Visible underneath active floor" : ""
                }${isGhostTarget ? " · Active Onion-Skin Ghost blueprint" : ""}\nClick to view · Right-click to rename or toggle`}
                style={
                  isActive
                    ? {
                        borderColor: accent.border,
                        background: accent.bg,
                        color: accent.fg,
                        boxShadow: `0 0 12px ${accent.bg}`,
                      }
                    : undefined
                }
              >
                <span className="dc-rail-code">{lv.shortCode}</span>
                <span className="dc-rail-elev">{formatElev(lv.elevationFt)}</span>
                {isCompositingBelow && (
                  <span
                    className="dc-rail-vis-dot"
                    title="Visible beneath active floor"
                    aria-hidden="true"
                  />
                )}
                {isGhostTarget && !isActive && (
                  <span
                    className="dc-rail-ghost-dot"
                    title="Onion-Skin Ghost reference floor"
                    aria-hidden="true"
                  />
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className="dc-rail-sep" />

      <div className="dc-rail-footer">
        <button
          type="button"
          className={`dc-rail-mode-btn ${isolateActiveFloor ? "active-solo" : ""}`}
          onClick={() => {
            const next = !isolateActiveFloor;
            useDocumentStore.getState().setIsolateActiveFloor(next);
            useDocumentStore
              .getState()
              .pushToast(
                next
                  ? `Solo Floor ON — Isolating ${activeLevel.shortCode} only`
                  : `Stack View ON — Showing lower floors beneath ${activeLevel.shortCode}`,
              );
          }}
          title={
            isolateActiveFloor
              ? "Solo Floor Mode ON (Shift+I) — Showing active floor only. Click to return to Stacked Floors."
              : "Stacked Floors Mode (Shift+I) — Lower floors show beneath upper floors. Click to isolate active floor only."
          }
        >
          <Focus size={10} />
          <span>{isolateActiveFloor ? "Solo" : "Stack"}</span>
        </button>

        <button
          type="button"
          className={`dc-rail-mode-btn ${showOnionSkin ? "active-ghost" : ""}`}
          onClick={() => {
            const next = !showOnionSkin;
            useDocumentStore.getState().setShowOnionSkin(next);
            useDocumentStore
              .getState()
              .pushToast(
                next
                  ? onionRef
                    ? `Ghost Blueprint ON (${onionRef.shortCode} ${onionDir === "up" ? "above" : "below"})`
                    : "Ghost Blueprint ON"
                  : "Ghost Blueprint OFF",
              );
          }}
          title={ghostTooltip}
        >
          <Layers size={10} />
          <span>{ghostBadgeLabel}</span>
        </button>

        <button
          type="button"
          className="dc-rail-add-btn"
          title="Add Building Floor, Sky Deck, or Underground Basement"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            openAddFloorMenu(rect.right + 6, rect.top);
          }}
        >
          <Plus size={10} />
          <span>Floor</span>
        </button>
      </div>

      {editingLevelId && (
        <form
          className="dc-rail-edit-popover"
          onSubmit={(e) => {
            e.preventDefault();
            commitLevelEdit();
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") {
              e.preventDefault();
              setEditingLevelId(null);
            }
          }}
        >
          <div className="dc-rail-edit-head">
            <span>Edit Floor</span>
            <button
              type="button"
              className="dc-mini-icon-btn"
              aria-label="Cancel floor edit"
              onClick={() => setEditingLevelId(null)}
            >
              <X size={12} />
            </button>
          </div>
          <label className="dc-rail-edit-field">
            <span>Name</span>
            <input
              ref={nameInputRef}
              type="text"
              className="dc-input"
              maxLength={64}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </label>
          <div className="dc-rail-edit-row">
            <label className="dc-rail-edit-field">
              <span>Code</span>
              <input
                type="text"
                className="dc-input"
                maxLength={10}
                value={draftCode}
                onChange={(e) => setDraftCode(e.target.value)}
              />
            </label>
            <label className="dc-rail-edit-field">
              <span>Elev (ft)</span>
              <input
                type="number"
                className="dc-input"
                step={2}
                value={draftElev}
                onChange={(e) => setDraftElev(e.target.value)}
              />
            </label>
          </div>
          <div className="dc-rail-edit-actions">
            <button
              type="button"
              className="dc-btn dc-btn-ghost"
              style={{ height: 24, fontSize: 11, padding: "0 8px" }}
              onClick={() => setEditingLevelId(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dc-btn dc-btn-gold"
              style={{ height: 24, fontSize: 11, padding: "0 9px" }}
            >
              <Check size={11} /> Save
            </button>
          </div>
        </form>
      )}
    </aside>
  );
});

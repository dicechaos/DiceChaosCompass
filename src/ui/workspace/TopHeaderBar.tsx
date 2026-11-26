import React, { useRef } from "react";
import {
  Download,
  FolderOpen,
  Globe,
  HelpCircle,
  Palette,
  Plus,
  Redo2,
  Save,
  Settings,
  Undo2,
  X,
} from "lucide-react";
import { useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import { DiceLogo } from "@/ui/common/DiceLogo";
import type { ContextMenuEntry } from "@/ui/common/ContextMenu";

interface TopHeaderBarProps {
  onOpenContextMenu: (
    x: number,
    y: number,
    ariaLabel: string,
    entries: ContextMenuEntry[],
  ) => void;
}

export const TopHeaderBar: React.FC<TopHeaderBarProps> = React.memo(({ onOpenContextMenu }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const documents = useDocumentStore((s) => s.documents);
  const activeDocId = useDocumentStore((s) => s.activeDocId);
  const dirtyDocIds = useDocumentStore((s) => s.dirtyDocIds);
  const savedFileNameByDocId = useDocumentStore((s) => s.savedFileNameByDocId);
  const autosaveEnabledByDocId = useDocumentStore((s) => s.autosaveEnabledByDocId);
  const lastSavedAtByDocId = useDocumentStore((s) => s.lastSavedAtByDocId);
  const undoCount = useDocumentStore((s) => s.undoStack.length);
  const redoCount = useDocumentStore((s) => s.redoStack.length);
  const activeTool = useDocumentStore((s) => s.activeTool);

  const activeDoc = documents.find((d) => d.id === activeDocId) ?? documents[0];
  const activeSavedName = savedFileNameByDocId[activeDoc.id];
  const activeAutosaveOn = Boolean(autosaveEnabledByDocId[activeDoc.id]);
  const activeLastSavedAt = lastSavedAtByDocId[activeDoc.id];
  const activeDirty = Boolean(dirtyDocIds[activeDoc.id]);

  const handleSaveDcMap = (targetDocId?: string, saveAs = false) => {
    void useDocumentStore.getState().saveDocumentToFile(targetDocId, { saveAs });
  };

  const handleOpenClick = async () => {
    const res = await useDocumentStore.getState().openDocumentFromPicker();
    if (res === "unsupported") {
      fileInputRef.current?.click();
    }
  };

  const handleOpenFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      if (lower.endsWith(".wonderdraft_map") || lower.endsWith(".dungeondraft_map")) {
        useDocumentStore.getState().openExternalMapImport(file.name, buf);
      } else {
        const text = new TextDecoder("utf-8").decode(buf);
        const ok = useDocumentStore.getState().loadDocumentJson(text);
        if (!ok) {
          useDocumentStore.getState().openExternalMapImport(file.name, buf);
        }
      }
    } finally {
      e.target.value = "";
    }
  };

  const openTabContextMenu = (e: React.MouseEvent, docId: string) => {
    e.preventDefault();
    const st = useDocumentStore.getState();
    const targetDoc = st.documents.find((d) => d.id === docId);
    onOpenContextMenu(e.clientX, e.clientY, "Map Tab Options", [
      {
        type: "item",
        id: "tab-save",
        label: "Save .dcmap Project",
        shortcut: "Ctrl+S",
        onSelect: () => {
          st.switchDocument(docId);
          handleSaveDcMap(docId, false);
        },
      },
      {
        type: "item",
        id: "tab-save-as",
        label: "Save As… (Choose Location)",
        shortcut: "Ctrl+Shift+S",
        onSelect: () => {
          st.switchDocument(docId);
          handleSaveDcMap(docId, true);
        },
      },
      {
        type: "item",
        id: "tab-rename",
        label: "Rename Map…",
        onSelect: () => {
          const next = window.prompt("Rename map tab:", targetDoc?.meta.title ?? "Untitled.dcmap");
          if (next) st.renameDocument(docId, next);
        },
      },
      {
        type: "item",
        id: "tab-dup",
        label: "Duplicate Map Tab",
        onSelect: () => st.duplicateDocument(docId),
      },
      {
        type: "item",
        id: "tab-export",
        label: "Open Export Studio…",
        shortcut: "Ctrl+E",
        onSelect: () => {
          st.switchDocument(docId);
          st.setExportModalOpen(true);
        },
      },
      { type: "separator" },
      {
        type: "item",
        id: "tab-close",
        label: "Close Tab",
        danger: true,
        disabled: documents.length <= 1,
        onSelect: () => st.closeDocument(docId),
      },
    ]);
  };

  return (
    <header className="dc-header">
      <div className="dc-header-left">
        <div className="dc-brand">
          <DiceLogo size={24} />
          <span>DICE CHAOS COMPASS</span>
        </div>

        <div className="dc-tabs dc-scroll" role="tablist" aria-label="Open Maps">
          {documents.map((doc) => {
            const isActive = doc.id === activeDoc.id;
            const isDirty = Boolean(dirtyDocIds[doc.id]);
            return (
              <div
                key={doc.id}
                role="tab"
                aria-selected={isActive}
                className={`dc-tab ${isActive ? "active" : ""}`}
                style={isActive ? { minWidth: 118, flexShrink: 0 } : undefined}
                title={`${doc.meta.title}${isDirty ? " (unsaved edits)" : ""} · Double-click to rename`}
                onClick={() => useDocumentStore.getState().switchDocument(doc.id)}
                onDoubleClick={() => {
                  const next = window.prompt("Rename map:", doc.meta.title);
                  if (next) useDocumentStore.getState().renameDocument(doc.id, next);
                }}
                onContextMenu={(e) => openTabContextMenu(e, doc.id)}
              >
                {isDirty && (
                  <span
                    aria-label="Unsaved changes"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent-gold)",
                      flexShrink: 0,
                    }}
                  />
                )}
                {doc.mode === "world" && (
                  <Globe size={11} style={{ color: "var(--accent-gold)", flexShrink: 0 }} />
                )}
                <span className="dc-tab-title">{doc.meta.title}</span>
                {documents.length > 1 && (
                  <span
                    className="dc-tab-close"
                    style={{ flexShrink: 0 }}
                    role="button"
                    aria-label={`Close ${doc.meta.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      useDocumentStore.getState().closeDocument(doc.id);
                    }}
                  >
                    <X size={11} />
                  </span>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="dc-mini-icon-btn"
            title={
              activeDoc.mode === "world"
                ? "New World Atlas · Right-click for Showcases & Battlemaps"
                : "New 48×27 Battlemap · Right-click for World Atlas & Showcases"
            }
            aria-label="New Map"
            onClick={() => {
              const st = useDocumentStore.getState();
              if (activeDoc.mode === "world") {
                st.newWorldDocument();
              } else {
                st.newDocument();
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              const st = useDocumentStore.getState();
              onOpenContextMenu(e.clientX, e.clientY, "New Map & Showcases", [
                {
                  type: "item",
                  id: "new-blank-map",
                  label: "New Blank Battlemap (48×27)",
                  onSelect: () => st.newDocument(),
                },
                {
                  type: "item",
                  id: "new-world-atlas",
                  label: "New World Atlas (Landmass Wizard)",
                  onSelect: () => {
                    st.newWorldDocument();
                    useVaultStore.getState().setActiveCategory("symbol");
                  },
                },
                {
                  type: "item",
                  id: "import-external-map",
                  label: "Import Wonderdraft / Dungeondraft Map…",
                  onSelect: () => {
                    fileInputRef.current?.click();
                  },
                },
                { type: "separator" },
                {
                  type: "item",
                  id: "new-world-trofraderra",
                  label: "World Atlas: Tro'fraderra (48×33 Clean-Room)",
                  onSelect: () => {
                    st.openTrofraderraWorld();
                    useVaultStore.getState().setActiveCategory("symbol");
                  },
                },
                {
                  type: "item",
                  id: "new-world-showcase",
                  label: "World Atlas Showcase: The Shattered Reach",
                  onSelect: () => {
                    st.openShowcaseWorld();
                    useVaultStore.getState().setActiveCategory("symbol");
                  },
                },
                {
                  type: "item",
                  id: "new-hidden-sloop",
                  label: "Hidden Cove & Stolen Magi-Punk Sloop (48×27)",
                  onSelect: () => st.openShowcaseHiddenSloop(),
                },
                {
                  type: "item",
                  id: "new-lake-yacht",
                  label: "Lake Shore & Floating Sky-Yacht (48×27)",
                  onSelect: () => st.openShowcaseLakeYacht(),
                },
                {
                  type: "item",
                  id: "new-berlin-funicular",
                  label: "Berlin Magi-Punk Funicular (48×27)",
                  onSelect: () => st.openShowcaseFunicular(),
                },
              ]);
            }}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="dc-header-center" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div className="dc-mode-switch" role="group" aria-label="Studio Mode">
          <button
            type="button"
            className={`dc-mode-pill ${activeDoc.mode === "battlemap" ? "active" : ""}`}
            aria-pressed={activeDoc.mode === "battlemap"}
            onClick={() => {
              useDocumentStore.getState().switchToBattlemapMode();
              const vs = useVaultStore.getState();
              if (vs.activeCategory === "symbol") {
                vs.setActiveCategory("object");
              }
            }}
          >
            Battlemap
          </button>
          <button
            type="button"
            className={`dc-mode-pill ${activeDoc.mode === "world" ? "active" : ""}`}
            aria-pressed={activeDoc.mode === "world"}
            title="Switch to World Atlas Studio v1.5 (Wonderdraft-parity coastlines, themes, rivers, labels & symbols)"
            onClick={() => {
              useDocumentStore.getState().switchToWorldMode();
              useVaultStore.getState().setActiveCategory("symbol");
            }}
          >
            World
          </button>
        </div>

        {activeDoc.mode === "world" && (
          <button
            type="button"
            className={`dc-btn dc-btn-ghost ${activeTool === "world_theme" ? "active" : ""}`}
            style={{
              height: 28,
              padding: "0 9px",
              fontSize: 11.5,
              gap: 5,
              border:
                activeTool === "world_theme"
                  ? "1px solid rgba(229,169,60,0.65)"
                  : "1px solid var(--border-subtle)",
            }}
            title="Atlas Themes, Coastlines, Compass, Scale Bar & Map Frame (H)"
            onClick={() => useDocumentStore.getState().setActiveTool("world_theme")}
          >
            <Palette size={13} />
            <span>{activeDoc.world?.theme.shortLabel ?? "Atlas Theme"}</span>
          </button>
        )}
      </div>

      <div className="dc-header-right">
        <span
          className="dc-badge"
          title="Authoring resolution & grid dimensions (48×27 = exact 1-inch scale on a 55&quot; 4K TV)"
        >
          {activeDoc.canvas.widthCells}×{activeDoc.canvas.heightCells} · {activeDoc.canvas.ppi} PPI
        </span>

        <button
          type="button"
          className="dc-btn dc-btn-ghost dc-btn-icon"
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          disabled={undoCount === 0}
          onClick={() => useDocumentStore.getState().undo()}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="dc-btn dc-btn-ghost dc-btn-icon"
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          disabled={redoCount === 0}
          onClick={() => useDocumentStore.getState().redo()}
        >
          <Redo2 size={15} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".dcmap,.wonderdraft_map,.dungeondraft_map,.json,application/json"
          style={{ display: "none" }}
          onChange={(e) => void handleOpenFile(e)}
        />
        <button
          type="button"
          className="dc-btn dc-btn-ghost dc-btn-icon"
          title="Open .dcmap or Import Wonderdraft / Dungeondraft Map"
          aria-label="Open or Import Map"
          onClick={() => void handleOpenClick()}
        >
          <FolderOpen size={15} />
        </button>
        <button
          type="button"
          className="dc-btn dc-btn-ghost dc-btn-icon"
          style={{
            position: "relative",
            borderColor: activeAutosaveOn
              ? "rgba(16, 185, 129, 0.45)"
              : activeDirty
                ? "rgba(229, 169, 60, 0.45)"
                : undefined,
          }}
          title={
            activeSavedName
              ? `${activeAutosaveOn ? "Auto-Save ON" : "Auto-Save Paused"} → ${activeSavedName}${
                  activeLastSavedAt
                    ? ` · Last saved ${new Date(activeLastSavedAt).toLocaleTimeString()}`
                    : ""
                } · Click to Save (Ctrl+S) · Right-click for Save As…`
              : "Save .dcmap Project — Choose save location & enable Auto-Save (Ctrl+S · Right-click for options)"
          }
          aria-label={activeAutosaveOn ? "Save .dcmap (Auto-Save On)" : "Save .dcmap"}
          onClick={() => handleSaveDcMap(undefined, false)}
          onContextMenu={(e) => {
            e.preventDefault();
            const st = useDocumentStore.getState();
            onOpenContextMenu(e.clientX, e.clientY, "Save & Auto-Save Options", [
              {
                type: "item",
                id: "save-now",
                label: activeSavedName ? `Save Now (${activeSavedName})` : "Save & Choose Location…",
                shortcut: "Ctrl+S",
                onSelect: () => handleSaveDcMap(activeDoc.id, false),
              },
              {
                type: "item",
                id: "save-as",
                label: "Save As… (Choose New Location)",
                shortcut: "Ctrl+Shift+S",
                onSelect: () => handleSaveDcMap(activeDoc.id, true),
              },
              { type: "separator" },
              {
                type: "item",
                id: "toggle-autosave",
                label: activeSavedName
                  ? "Auto-Save to Chosen File"
                  : "Auto-Save (Save once to pick file)",
                checked: activeAutosaveOn,
                disabled: !activeSavedName,
                onSelect: () => st.setDocAutosaveEnabled(activeDoc.id, !activeAutosaveOn),
              },
            ]);
          }}
        >
          <Save
            size={15}
            style={{
              color: activeAutosaveOn ? "#34D399" : undefined,
            }}
          />
          {(activeAutosaveOn || activeDirty) && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: activeDirty
                  ? "var(--accent-gold)"
                  : "#10B981",
                boxShadow: activeDirty
                  ? "0 0 6px rgba(229, 169, 60, 0.9)"
                  : "0 0 6px rgba(16, 185, 129, 0.9)",
              }}
            />
          )}
        </button>
        <button
          type="button"
          className="dc-btn dc-btn-ghost dc-btn-icon"
          title="Studio Options & Preferences (Ctrl+,)"
          aria-label="Studio Preferences"
          onClick={() => useDocumentStore.getState().setPreferencesModalOpen(true)}
        >
          <Settings size={15} />
        </button>
        <button
          type="button"
          className="dc-btn dc-btn-ghost dc-btn-icon"
          title="Keyboard Shortcuts (?)"
          aria-label="Keyboard Shortcuts"
          onClick={() => useDocumentStore.getState().setShortcutsModalOpen(true)}
        >
          <HelpCircle size={15} />
        </button>

        <button
          type="button"
          className="dc-btn dc-btn-gold"
          onClick={() => useDocumentStore.getState().setExportModalOpen(true)}
        >
          <Download size={14} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
});

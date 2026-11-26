import React from "react";
import { ExternalLink, Keyboard } from "lucide-react";
import { useDocumentStore } from "@/store/documentStore";
import { ModalDialog } from "@/ui/common/ModalDialog";

const SUITE_LINKS = [
  {
    name: "dicechaos.com",
    desc: "Handmade Sharp-Edge Dice & Free Tabletop Tools",
    href: "https://dicechaos.com/",
    accent: "#818CF8",
  },
  {
    name: "Dice Chaos Display",
    desc: "4K/8K Tabletop TV Battlemap Display (1.00\" Scale Companion)",
    href: "https://github.com/dicechaos/DiceChaosDisplay",
    accent: "#10B981",
  },
  {
    name: "Dice Chaos Connections",
    desc: "Offline Campaign Mind-Map & Conspiracy Board",
    href: "https://github.com/dicechaos/DiceChaosConnections",
    accent: "#38BDF8",
  },
  {
    name: "Dice Chaos Masters",
    desc: "Parametric 3D Polyhedral Dice Master & Insert Blank CAD",
    href: "https://github.com/dicechaos/DiceChaosMasters",
    accent: "#A78BFA",
  },
  {
    name: "Beta Feedback & Issues",
    desc: "Report bugs or request features on GitHub",
    href: "https://github.com/dicechaos/DiceChaosCompass/issues",
    accent: "#F59E0B",
  },
];

const SHORTCUT_GROUPS = [
  {
    title: "Tools",
    items: [
      ["V", "Select & Transform"],
      ["B", "Terrain Splat Brush (1–6 Modes · Alt+Click Eyedropper)"],
      ["K / Shift+K", "Smart Terrain Fill / Replace Existing Terrain (R Rect · E Erase)"],
      ["H", "Cave & Dungeon Builder (1–5 Modes)"],
      ["Hold Alt / E (in Cave)", "Instant Eraser / Toggle Cave Brush ↔ Erase"],
      ["W", "Water & Chasm Region"],
      ["L", "Smart Vector Wall (1–6: Free / Box / Tower / Arc / Split / Corridor)"],
      ["D", "Snapping Door / Window Portal"],
      ["P", "Textured Spline Path"],
      ["O", "Roof Studio (1–4 Modes: Ridge / Box / Turret / Auto-Room)"],
      ["S", "Object Stamp Tool"],
      ["Z", "Smart Scatter Zone"],
      ["G", "2D Raycast Light"],
      ["N", "DM-Only Secret Note"],
      ["M", "Tactical Ruler"],
    ],
  },
  {
    title: "Scroll-Wheel, Curve & Studio Hotkeys",
    items: [
      ["Drag Gold Knob (Shift = 15°)", "Rotate Selected Object Directly on Canvas"],
      ["Drag Corner Squares (Shift = Free)", "Scale / Resize Selected Object on Canvas"],
      ["Alt + Wheel (or [ / ])", "Scale Stamp / Prop / Brush / Wall / Line / Light"],
      ["Shift + Wheel (or Q / E)", "Rotate Stamp Preview / Selected Prop / Spotlight"],
      ["Scroll Wheel", "Cursor-Centered Zoom"],
      ["Enter / Double-Click", "Finish Drawing Active Wall, Line, Water or Scatter"],
      ["C", "Toggle Curved vs Straight (Focused Section of Wall/Line/Roof/Water/World or Next Section)"],
      ["Shift (in Wall / Line)", "45°/90° Lock (Free) · Square (Box) · 90°/180° Arch Snap"],
      ["Shift + Drag / Double-Click +", "Curve or Straighten Any Single Section (Walls, Lines, Roofs, Water & World)"],
      ["Alt + Click Gold Dot", "Remove Vertex (Preserves Curves on Remaining Sections)"],
      ["Shift + S (or Hold Alt)", "Toggle Grid Snapping ON / OFF (Alt = Free Hold)"],
      ["PageUp / PageDown", "Step Up / Down Building Floors & Basements"],
      ["Shift + G", "Toggle Onion-Skin Ghost Blueprint of Adjacent Floor"],
      ["Shift + I", "Toggle Solo Active Floor vs Stacked Floors View"],
      ["Alt + ↑ / ↓", "Cycle Active Layer Up / Down on Current Floor"],
      ["Alt + Click Layer Eye", "Solo Single Layer (Alt+Click Again to Restore)"],
      ["F2 / Double-Click Layer", "Rename Active or Clicked Layer Inline"],
      ["/", "Focus Bottom Asset Vault Search Immediately"],
      ["Right-Click", "Context-Aware Options Menu (Canvas / Wall / Layer)"],
      ["Space + Drag / Middle-Drag", "Pan Viewport"],
      ["F", "Fit Map to Screen"],
      ["U (in Stamp)", "Toggle Place Next Asset Above / Below on Same Layer"],
      ["X / Y", "Flip Selected Horizontal / Vertical"],
      ["Ctrl + Z / Ctrl + Y", "Undo / Redo (Per-Tab History)"],
      ["Ctrl + S / Ctrl + Shift + S", "Save (Pick Location + Auto-Save) / Save As…"],
      ["Ctrl + C / Ctrl + V / Ctrl + D", "Copy / Paste / Duplicate"],
      ["Del / Backspace", "Delete Selected Prop / Wall / Line / Door / Light / Note"],
      ["Ctrl + E / Ctrl + ,", "Export Studio / Preferences"],
    ],
  },
];

export const ShortcutsModal: React.FC = () => {
  const open = useDocumentStore((s) => s.shortcutsModalOpen);
  const st = useDocumentStore.getState();

  return (
    <ModalDialog
      open={open}
      onClose={() => st.setShortcutsModalOpen(false)}
      title="Shortcuts & Dice Chaos Tabletop Suite"
      icon={<Keyboard size={17} style={{ color: "var(--accent-gold)" }} />}
      maxWidthPx={780}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 18 }}>
        {SHORTCUT_GROUPS.map((grp) => (
          <div
            key={grp.title}
            style={{
              padding: 12,
              borderRadius: 8,
              background: "var(--bg-panel)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-gold)", marginBottom: 10 }}>
              {grp.title.toUpperCase()}
            </div>
            {grp.items.map(([k, desc]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "5px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{desc}</span>
                <kbd
                  style={{
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "var(--bg-chrome)",
                    border: "1px solid var(--border-strong)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {k}
                </kbd>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Dice Chaos Tabletop Suite Companion Directory */}
      <div
        style={{
          marginTop: 14,
          padding: 12,
          borderRadius: 8,
          background: "var(--bg-panel)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent-gold)", letterSpacing: "0.04em" }}>
            DICE CHAOS TABLETOP SUITE
          </span>
          <span style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            Dice Chaos Compass v1.0.0-beta.1 (Public Beta) · GPL-3.0
          </span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 8,
          }}
        >
          {SUITE_LINKS.map((item) => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                padding: "7px 9px",
                borderRadius: 6,
                background: "var(--bg-chrome)",
                border: "1px solid var(--border-subtle)",
                textDecoration: "none",
                color: "var(--text-primary)",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: item.accent,
                }}
              >
                {item.name}
                <ExternalLink size={11} />
              </span>
              <span style={{ fontSize: 10.5, color: "var(--text-secondary)", lineHeight: 1.3 }}>
                {item.desc}
              </span>
            </a>
          ))}
        </div>
      </div>
    </ModalDialog>
  );
};

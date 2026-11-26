import React from "react";
import {
  BrickWall,
  Crop,
  DoorOpen,
  Droplets,
  Flag,
  Home,
  LayoutGrid,
  Lightbulb,
  MapPin,
  Mountain,
  MousePointer2,
  PaintBucket,
  Paintbrush,
  Palette,
  Route,
  Ruler,
  Sparkles,
  Spline,
  Stamp,
  Type,
  Waves,
} from "lucide-react";
import { useDocumentStore } from "@/store/documentStore";
import { useVaultStore } from "@/store/vaultStore";
import type { ToolId } from "@/types/map";

interface ToolDef {
  id: ToolId;
  terrainSubMode?: "brush" | "fill";
  label: string;
  key: string;
  icon: React.ReactNode;
  dividerAfter?: boolean;
}

const BATTLEMAP_TOOLS: ToolDef[] = [
  { id: "select", label: "Select & Transform", key: "V", icon: <MousePointer2 size={17} />, dividerAfter: true },
  { id: "terrain", terrainSubMode: "brush", label: "Terrain Splat Brush", key: "B", icon: <Paintbrush size={17} /> },
  { id: "terrain", terrainSubMode: "fill", label: "Smart Terrain Fill (Room / Replace / Rect / Poly / Erase)", key: "K", icon: <PaintBucket size={17} /> },
  { id: "cave", label: "Cave & Dungeon Builder (Auto-Walls + Entrances)", key: "H", icon: <Mountain size={17} /> },
  { id: "water", label: "Water Studio (Lakes, Rivers, Islands & Biomes)", key: "W", icon: <Droplets size={17} />, dividerAfter: true },
  { id: "wall", label: "Smart Vector Wall", key: "L", icon: <BrickWall size={17} /> },
  { id: "portal", label: "Snapping Door / Window Portal", key: "D", icon: <DoorOpen size={17} /> },
  { id: "path", label: "Textured Spline Path (Rails / Cables / Cliffs)", key: "P", icon: <Spline size={17} /> },
  { id: "roof", label: "Roof Studio (Ridge Path / Box / Turret / Auto-Room)", key: "O", icon: <Home size={17} />, dividerAfter: true },
  { id: "stamp", label: "Object Stamp Brush", key: "S", icon: <Stamp size={17} /> },
  { id: "template", label: "Object Templates (Saved Premade Groups)", key: "T", icon: <LayoutGrid size={17} /> },
  { id: "scatter", label: "Smart Scatter Zone (Poisson Foliage)", key: "Z", icon: <Sparkles size={17} />, dividerAfter: true },
  { id: "light", label: "2D Raycast Light Source", key: "G", icon: <Lightbulb size={17} /> },
  { id: "dm_note", label: "DM-Only Secret Note Pin", key: "N", icon: <MapPin size={17} /> },
  { id: "measure", label: "Tactical Ruler (Squares / ft / 55\" TV in)", key: "M", icon: <Ruler size={17} /> },
];

const WORLD_TOOLS: ToolDef[] = [
  { id: "select", label: "Select & Transform World Entities", key: "V", icon: <MousePointer2 size={17} />, dividerAfter: true },
  { id: "world_land", label: "Landmass Sculpt & Generator Wizard (Raise / Lower / Lake)", key: "B", icon: <Mountain size={17} /> },
  { id: "world_biome", label: "Biome Ground Watercolor Brush (Land-Clipped)", key: "G", icon: <Paintbrush size={17} /> },
  { id: "world_river", label: "Meandering Tapered River Tool", key: "R", icon: <Waves size={17} />, dividerAfter: true },
  { id: "world_trail", label: "Trails, Imperial Roads & Sea Lanes", key: "P", icon: <Route size={17} /> },
  { id: "world_region", label: "Political Regions & Kingdoms (Coastline-Clipped)", key: "K", icon: <Flag size={17} />, dividerAfter: true },
  { id: "stamp", label: "World Atlas Symbols & Wonderdraft Assets", key: "S", icon: <Stamp size={17} /> },
  { id: "world_label", label: "Curved Map Labels, Scrolls & Name Generator", key: "T", icon: <Type size={17} />, dividerAfter: true },
  { id: "world_crop", label: "Create Detail / Sub-Region Map or Linked Battlemap", key: "C", icon: <Crop size={17} /> },
  { id: "world_theme", label: "Map Themes, Coastlines, Compass, Scale & Frame", key: "H", icon: <Palette size={17} />, dividerAfter: true },
  { id: "dm_note", label: "DM-Only Secret Campaign Pin", key: "N", icon: <MapPin size={17} /> },
  { id: "measure", label: "Overland Travel-Time Ruler (Miles / Km / Foot / Horse / Ship)", key: "M", icon: <Ruler size={17} /> },
];

export const LeftToolRail: React.FC = React.memo(() => {
  const activeTool = useDocumentStore((s) => s.activeTool);
  const terrainMode = useDocumentStore((s) => s.terrainMode);
  const setActiveTool = useDocumentStore((s) => s.setActiveTool);
  const setBrushParams = useDocumentStore((s) => s.setBrushParams);
  const docMode = useDocumentStore(
    (s) => (s.documents.find((d) => d.id === s.activeDocId) ?? s.documents[0]).mode,
  );

  const tools = docMode === "world" ? WORLD_TOOLS : BATTLEMAP_TOOLS;

  return (
    <aside
      className="dc-tool-rail dc-scroll"
      aria-label={docMode === "world" ? "World Atlas Cartography Tools" : "Cartography Tools"}
    >
      {tools.map((t) => {
        const isActive = t.terrainSubMode
          ? activeTool === "terrain" &&
            (t.terrainSubMode === "brush" ? terrainMode === "brush" : terrainMode !== "brush")
          : activeTool === t.id;
        return (
          <React.Fragment key={`${docMode}-${t.id}-${t.terrainSubMode ?? "main"}`}>
            <button
              type="button"
              className={`dc-tool-btn ${isActive ? "active" : ""}`}
              title={`${t.label} (${t.key})`}
              aria-label={`${t.label} (${t.key})`}
              aria-pressed={isActive}
              onClick={() => {
                if (t.terrainSubMode === "brush") {
                  setBrushParams({ terrainMode: "brush" });
                  setActiveTool("terrain");
                } else if (t.terrainSubMode === "fill") {
                  if (terrainMode === "brush") {
                    setBrushParams({ terrainMode: "flood" });
                  }
                  setActiveTool("terrain");
                } else {
                  setActiveTool(t.id);
                  if (docMode === "world" && t.id === "stamp") {
                    useVaultStore.getState().setActiveCategory("symbol");
                  }
                }
              }}
            >
              {t.icon}
            </button>
            {t.dividerAfter && <div className="dc-tool-divider" />}
          </React.Fragment>
        );
      })}
    </aside>
  );
});

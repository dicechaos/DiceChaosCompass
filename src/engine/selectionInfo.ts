import { getWaterPreset } from "@/engine/waterEngine";
import type { SelectionRef } from "@/store/documentStore";
import type { DcMapDocument, VaultAsset } from "@/types/map";

export interface SelectionDetails {
  typeLabel: string;
  name: string;
  subtitle: string;
  layerName: string;
  floorCode: string;
  assetId?: string;
  thumbUrl?: string;
  accentHex: string;
}

/**
 * Turn a raw asset path like "modular-suite/props/water_boats_craft/wat_venetian_launch.png"
 * into a clean readable fallback label ("Venetian Launch") if it isn't in assetLookup.
 */
function humanizeAssetId(assetId: string): string {
  const file = assetId.split("/").pop() ?? assetId;
  const stem = file.replace(/\.[^.]+$/, "");
  const cleaned = stem.replace(/^(wat|cmp|doc|kit|tav|po|bar|bak|med|fun|yard|col|hero|path|wall|portal|terrain|ship|sky|boat|cargo|tree|rock|bush|flora|nature)_/i, "");
  return cleaned
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function resolveAssetLabelAndThumb(
  assetId: string | undefined,
  assetLookup: Map<string, VaultAsset>,
): { label: string; thumbUrl?: string } {
  if (!assetId) return { label: "Untitled Asset" };
  const found = assetLookup.get(assetId);
  if (found) {
    return {
      label: found.displayName,
      thumbUrl: found.thumbUrl || found.url,
    };
  }
  return { label: humanizeAssetId(assetId) };
}

/**
 * Produce a unified, human-readable description of the currently selected entity
 * (type badge, asset/entity name, quick stats, floor code, layer name & thumbnail)
 * for display in the Right Inspector, Canvas HUD Pill, and Status Bar.
 */
export function describeSelection(
  doc: DcMapDocument,
  selection: SelectionRef | null,
  assetLookup: Map<string, VaultAsset>,
): SelectionDetails | null {
  if (!selection) return null;

  // World Atlas entities live directly on doc.world (layerId === "__world__")
  if (doc.world && selection.layerId === "__world__") {
    if (selection.kind === "world_label") {
      const lbl = doc.world.labels.find((x) => x.id === selection.id);
      if (!lbl) return null;
      return {
        typeLabel: `Map Label (${lbl.category})`,
        name: lbl.text || "Untitled Label",
        subtitle: `${lbl.fontSizePx}px · ${Math.round(lbl.curveBend * 100)}% curve · ${lbl.boxStyle === "none" ? "Free" : lbl.boxStyle}`,
        layerName: "Cartography Labels",
        floorCode: "MAP",
        accentHex: "#F59E0B",
      };
    }
    if (selection.kind === "world_river") {
      const r = doc.world.rivers.find((x) => x.id === selection.id);
      if (!r) return null;
      return {
        typeLabel: "Meandering River",
        name: r.name || "Unnamed River",
        subtitle: `${r.points.length} pts · ${r.startWidthCells.toFixed(2)}→${r.endWidthCells.toFixed(2)} sq · ${Math.round(r.meanderRoughness * 100)}% meander`,
        layerName: "World Waterways",
        floorCode: "MAP",
        accentHex: "#38BDF8",
      };
    }
    if (selection.kind === "world_trail") {
      const t = doc.world.trails.find((x) => x.id === selection.id);
      if (!t) return null;
      return {
        typeLabel: "Overland Trail",
        name: t.name || t.style.replace("_", " "),
        subtitle: `${t.points.length} pts · ${t.style.replace("_", " ")} · ${t.curved ? "Curved" : "Straight"}`,
        layerName: "Trade Routes & Sea Lanes",
        floorCode: "MAP",
        accentHex: "#D97706",
      };
    }
    if (selection.kind === "world_region") {
      const reg = doc.world.regions.find((x) => x.id === selection.id);
      if (!reg) return null;
      return {
        typeLabel: "Political Region",
        name: reg.name || "Realm Territory",
        subtitle: `${reg.polygon.length} pts · ${reg.clipToLand ? "Coast-clipped" : "Unclipped"} · ${reg.borderStyle}`,
        layerName: "Political Realms",
        floorCode: "MAP",
        accentHex: reg.fillColorHex || "#818CF8",
      };
    }
    if (selection.kind === "world_pin") {
      const pin = doc.world.subMapPins.find((x) => x.id === selection.id);
      if (!pin) return null;
      return {
        typeLabel: pin.targetKind === "battlemap" ? "Linked Battlemap" : "Regional Detail Atlas",
        name: pin.label || "Sub-Map Pin",
        subtitle: "Double-click pin to jump into linked map",
        layerName: "Atlas Sub-Maps",
        floorCode: "MAP",
        accentHex: pin.colorHex || "#E5A93C",
      };
    }
  }

  const layer = doc.layers.find((l) => l.id === selection.layerId);
  if (!layer) return null;
  const level = doc.levels.find((lv) => lv.id === layer.levelId);
  const floorCode = level?.shortCode ?? (doc.mode === "world" ? "MAP" : "1F");
  const layerName = layer.name;

  if (selection.kind === "object") {
    const obj = layer.objects?.find((o) => o.id === selection.id);
    if (!obj) return null;
    const { label, thumbUrl } = resolveAssetLabelAndThumb(obj.assetId, assetLookup);
    const deg = Math.round((((obj.rotationRad * 180) / Math.PI) % 360 + 360) % 360);
    return {
      typeLabel: doc.mode === "world" ? "World Symbol" : "Prop",
      name: label,
      subtitle: `${obj.widthCells.toFixed(1)} × ${obj.heightCells.toFixed(1)} sq · ${deg}°`,
      layerName,
      floorCode,
      assetId: obj.assetId,
      thumbUrl,
      accentHex: "#E5A93C",
    };
  }

  if (selection.kind === "path") {
    const path = layer.paths?.find((p) => p.id === selection.id);
    if (!path) return null;
    const { label, thumbUrl } = resolveAssetLabelAndThumb(path.assetId, assetLookup);
    return {
      typeLabel: "Path / Line",
      name: label,
      subtitle: `${path.points.length} pts · ${path.widthCells.toFixed(1)} sq · ${path.curved !== false ? "Curved" : "Straight"}`,
      layerName,
      floorCode,
      assetId: path.assetId,
      thumbUrl,
      accentHex: "#38BDF8",
    };
  }

  if (selection.kind === "roof") {
    const roof = layer.roofs?.find((r) => r.id === selection.id);
    if (!roof) return null;
    const { label, thumbUrl } = resolveAssetLabelAndThumb(roof.assetId, assetLookup);
    const styleLabel =
      roof.style === "gable"
        ? "Gable Roof"
        : roof.style === "hip"
          ? "Hip Roof"
          : roof.style === "shed"
            ? "Shed / Lean-To"
            : roof.style === "mansard"
              ? "Mansard Roof"
              : "Turret / Cone Roof";
    const spanText =
      roof.style === "cone" && roof.points.length >= 2
        ? `R ${Math.hypot(
            roof.points[1].x - roof.points[0].x,
            roof.points[1].y - roof.points[0].y,
          ).toFixed(1)} sq`
        : `${roof.widthCells.toFixed(1)} sq span`;
    return {
      typeLabel: styleLabel,
      name: label,
      subtitle: `${spanText} · Sun ${Math.round(roof.sunAngleDeg)}° · ${Math.round(roof.opacity * 100)}%`,
      layerName,
      floorCode,
      assetId: roof.assetId,
      thumbUrl,
      accentHex: "#FB923C",
    };
  }

  if (selection.kind === "wall") {
    const wall = layer.walls?.find((w) => w.id === selection.id);
    if (!wall) return null;
    const { label, thumbUrl } = resolveAssetLabelAndThumb(wall.assetId, assetLookup);
    return {
      typeLabel: "Wall",
      name: label,
      subtitle: `${wall.points.length} pts · ${wall.closed ? "Closed" : "Open"} · ${wall.blocksLight ? "Blocks Light" : "Pass Light"}`,
      layerName,
      floorCode,
      assetId: wall.assetId,
      thumbUrl,
      accentHex: "#94A3B8",
    };
  }

  if (selection.kind === "portal") {
    const portal = layer.portals?.find((p) => p.id === selection.id);
    if (!portal) return null;
    const { label, thumbUrl } = resolveAssetLabelAndThumb(portal.assetId, assetLookup);
    const kindLabel =
      portal.kind === "window"
        ? "Window"
        : portal.kind === "gate"
          ? "Gate"
          : portal.kind === "hatch"
            ? "Hatch"
            : "Door";
    const stateParts = [
      portal.closed ? "Closed" : "Open",
      `${portal.widthCells.toFixed(1)} sq`,
    ];
    if (portal.kind === "door" || portal.kind === "hatch") {
      stateParts.push(portal.swingInvert ? "Outward" : "Inward");
    }
    return {
      typeLabel: kindLabel,
      name: label,
      subtitle: stateParts.join(" · "),
      layerName,
      floorCode,
      assetId: portal.assetId,
      thumbUrl,
      accentHex: "#10B981",
    };
  }

  if (selection.kind === "water") {
    const region = layer.waterRegions?.find((w) => w.id === selection.id);
    if (!region) return null;
    const preset = region.presetId ? getWaterPreset(region.presetId) : null;
    const shapeLabel =
      region.shape === "river"
        ? "River / Creek"
        : region.kind === "lava"
          ? "Lava / Magma"
          : region.kind === "ice"
            ? "Glacial Ice"
            : region.kind === "chasm"
              ? "Abyss / Chasm"
              : "Water Body";
    const { thumbUrl } = resolveAssetLabelAndThumb(region.textureAssetId, assetLookup);
    const islands = region.cutouts?.length ?? 0;
    return {
      typeLabel: shapeLabel,
      name: preset?.name ?? shapeLabel,
      subtitle: `${region.points.length} pts${islands > 0 ? ` · ${islands} island${islands === 1 ? "" : "s"}` : ""}`,
      layerName,
      floorCode,
      assetId: region.textureAssetId,
      thumbUrl,
      accentHex: "#0EA5E9",
    };
  }

  if (selection.kind === "light") {
    const light = layer.lights?.find((l) => l.id === selection.id);
    if (!light) return null;
    return {
      typeLabel: "Light Source",
      name: light.name || "2D Point Light",
      subtitle: `${light.radiusCells.toFixed(1)} sq · ${Math.round(light.intensity * 100)}% · ${light.coneAngleDeg < 355 ? `${Math.round(light.coneAngleDeg)}° spot` : "360°"}`,
      layerName,
      floorCode,
      accentHex: light.colorHex || "#F59E0B",
    };
  }

  if (selection.kind === "scatter") {
    const zone = layer.scatterZones?.find((z) => z.id === selection.id);
    if (!zone) return null;
    return {
      typeLabel: "Scatter Zone",
      name: zone.name || "Smart Scatter Zone",
      subtitle: `${zone.placements.length} props · ${zone.assetIds.length} asset types`,
      layerName,
      floorCode,
      accentHex: "#A78BFA",
    };
  }

  if (selection.kind === "dm_note") {
    const note = layer.dmNotes?.find((n) => n.id === selection.id);
    if (!note) return null;
    return {
      typeLabel: `DM ${note.badge}`,
      name: note.title || "DM Secret Note",
      subtitle: "DM-only pin (hidden in Player View)",
      layerName,
      floorCode,
      accentHex: note.colorHex || "#F43F5E",
    };
  }

  if (selection.kind === "cave_entrance") {
    const ent = layer.caveSystem?.entrances?.find((e) => e.id === selection.id);
    if (!ent) return null;
    return {
      typeLabel: "Cave Entrance",
      name: ent.markerLabel || "Cave / Dungeon Mouth",
      subtitle: `${ent.widthCells.toFixed(1)} sq wide · ${ent.fadeLengthCells.toFixed(1)} sq fade`,
      layerName,
      floorCode,
      accentHex: "#F59E0B",
    };
  }

  return null;
}

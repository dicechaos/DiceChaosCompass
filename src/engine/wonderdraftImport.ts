/**
 * Zero-dependency browser & desktop Wonderdraft Pack Importer (.zip or loose folder files).
 *
 * Parses standard Wonderdraft asset pack hierarchies:
 *   <pack>/sprites/symbols/<set>/.wonderdraft_symbols
 *   <pack>/sprites/trees/<set>/.wonderdraft_symbols
 *   <pack>/sprites/mountains/<set>/.wonderdraft_symbols
 *   <pack>/textures/ground/*.png | textures/water/*.png
 *
 * Supports BOTH per-symbol JSON dictionaries AND folder-wide `.wonderdraft_symbols` objects,
 * preserves `offset_x` / `offset_y` ground anchors, and maps `custom_colors` / `custom_colors_2`
 * to our 3-channel RGB shader (`rgb_channels`) and `sample_color` to ground-sampled tinting!
 */

import type { VaultAsset, VaultSource, WorldAssetGroup } from "@/types/map";

export interface WonderdraftSymbolMeta {
  name?: string;
  radius?: number;
  offset_x?: number;
  offset_y?: number;
  draw_mode?: string;
}

export interface ParsedWonderdraftManifest {
  perSymbol: Map<string, WonderdraftSymbolMeta>;
  folderDefault: WonderdraftSymbolMeta | null;
}

export interface ZipEntryRaw {
  path: string;
  method: number;
  data: Uint8Array;
}

export function parseWonderdraftSymbolsJson(text: string): ParsedWonderdraftManifest {
  const perSymbol = new Map<string, WonderdraftSymbolMeta>();
  let folderDefault: WonderdraftSymbolMeta | null = null;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { perSymbol, folderDefault };
    }
    const obj = parsed as Record<string, unknown>;
    if ("draw_mode" in obj || "radius" in obj || "offset_y" in obj) {
      folderDefault = {
        name: typeof obj.name === "string" ? obj.name : undefined,
        radius: typeof obj.radius === "number" ? obj.radius : undefined,
        offset_x: typeof obj.offset_x === "number" ? obj.offset_x : undefined,
        offset_y: typeof obj.offset_y === "number" ? obj.offset_y : undefined,
        draw_mode: typeof obj.draw_mode === "string" ? obj.draw_mode : undefined,
      };
    } else {
      for (const [key, val] of Object.entries(obj)) {
        if (val && typeof val === "object" && !Array.isArray(val)) {
          const v = val as Record<string, unknown>;
          perSymbol.set(key.toLowerCase(), {
            name: typeof v.name === "string" ? v.name : undefined,
            radius: typeof v.radius === "number" ? v.radius : undefined,
            offset_x: typeof v.offset_x === "number" ? v.offset_x : undefined,
            offset_y: typeof v.offset_y === "number" ? v.offset_y : undefined,
            draw_mode: typeof v.draw_mode === "string" ? v.draw_mode : undefined,
          });
        }
      }
    }
  } catch {
    // Malformed metadata file — fall back to path heuristics cleanly
  }
  return { perSymbol, folderDefault };
}

export function mapWonderdraftDrawMode(
  rawDrawMode: string | undefined,
  relPath: string,
): VaultAsset["drawMode"] {
  const dm = (rawDrawMode ?? "").toLowerCase();
  const low = relPath.toLowerCase();
  if (
    dm === "custom_colors" ||
    dm === "custom_colors_2" ||
    low.includes("custom_color") ||
    low.includes("_custom")
  ) {
    return "rgb_channels";
  }
  if (
    dm === "sample_color" ||
    low.includes("sample_color") ||
    low.includes("paintable") ||
    low.includes("_sample")
  ) {
    return "sample_color";
  }
  return "normal";
}

export function classifyWonderdraftWorldGroup(relPath: string): WorldAssetGroup {
  const low = relPath.toLowerCase().replace(/\\/g, "/");
  if (low.includes("/textures/")) return "textures";
  if (low.includes("/mountains/") || low.includes("mountain") || low.includes("hill") || low.includes("volcan") || low.includes("mesa")) {
    return "mountains";
  }
  if (low.includes("/trees/") || low.includes("tree") || low.includes("forest") || low.includes("palm") || low.includes("mangrove") || low.includes("pine") || low.includes("oak")) {
    return "trees";
  }
  if (low.includes("ship") || low.includes("boat") || low.includes("kraken") || low.includes("serpent") || low.includes("whale") || low.includes("sea") || low.includes("ocean") || low.includes("lighthouse") || low.includes("pirat_port")) {
    return "maritime";
  }
  if (low.includes("rose") || low.includes("compass") || low.includes("banner") || low.includes("scroll") || low.includes("frame") || low.includes("cartouche") || low.includes("marker") || low.includes("crest")) {
    return "cartography";
  }
  if (low.includes("building") || low.includes("house") || low.includes("castle") || low.includes("town") || low.includes("city") || low.includes("village") || low.includes("fort") || low.includes("tower") || low.includes("mill") || low.includes("temple") || low.includes("pier") || low.includes("shack") || low.includes("bridge") || low.includes("gate")) {
    return "settlements";
  }
  return "landmarks";
}

function probeImageHeaderSize(bytes: Uint8Array): { widthPx: number; heightPx: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG
  if (
    bytes.byteLength >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return {
      widthPx: Math.max(16, view.getUint32(16, false)),
      heightPx: Math.max(16, view.getUint32(20, false)),
    };
  }
  // WebP
  if (
    bytes.byteLength >= 30 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
    if (chunk === "VP8X") {
      const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
      const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
      return { widthPx: Math.max(16, w), heightPx: Math.max(16, h) };
    }
    if (chunk === "VP8 ") {
      const w = view.getUint16(26, true) & 0x3fff;
      const h = view.getUint16(28, true) & 0x3fff;
      return { widthPx: Math.max(16, w), heightPx: Math.max(16, h) };
    }
  }
  return { widthPx: 256, heightPx: 256 };
}

async function inflateRawSlice(slice: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream('deflate-raw') is not available in this environment.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const copy = new Uint8Array(slice.byteLength);
  copy.set(slice);
  const writePromise = writer.write(copy).then(() => writer.close());
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  await writePromise;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

/**
 * Zero-dependency browser ZIP reader supporting STORE (0) and DEFLATE (8).
 */
export async function readZipEntries(zipBytes: Uint8Array): Promise<ZipEntryRaw[]> {
  const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);
  // Locate End of Central Directory (EOCD) scanning backwards up to 65KB
  const minPos = Math.max(0, zipBytes.byteLength - 65557);
  let eocdPos = -1;
  for (let i = zipBytes.byteLength - 22; i >= minPos; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdPos = i;
      break;
    }
  }
  if (eocdPos < 0) {
    throw new Error("Invalid ZIP archive (missing End of Central Directory record).");
  }

  const totalEntries = view.getUint16(eocdPos + 10, true);
  const cdOffset = view.getUint32(eocdPos + 16, true);
  const decoder = new TextDecoder();
  const results: ZipEntryRaw[] = [];

  let ptr = cdOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > zipBytes.byteLength || view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOff = view.getUint32(ptr + 42, true);
    const path = decoder
      .decode(zipBytes.subarray(ptr + 46, ptr + 46 + nameLen))
      .replace(/\\/g, "/");
    ptr += 46 + nameLen + extraLen + commentLen;

    if (path.endsWith("/") || path.startsWith("__MACOSX/")) continue;
    if (localOff + 30 > zipBytes.byteLength) continue;
    const lNameLen = view.getUint16(localOff + 26, true);
    const lExtraLen = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    if (dataStart + compSize > zipBytes.byteLength) continue;

    const slice = zipBytes.subarray(dataStart, dataStart + compSize);
    if (method === 0) {
      results.push({ path, method, data: slice.slice() });
    } else if (method === 8) {
      try {
        const inflated = await inflateRawSlice(slice);
        results.push({ path, method, data: inflated });
      } catch {
        // Skip unreadable entry cleanly
      }
    }
  }
  return results;
}

function cleanDisplayName(rawPath: string): string {
  const file = rawPath.split("/").pop() ?? rawPath;
  const stem = file.replace(/\.[^.]+$/, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  return stem ? stem.charAt(0).toUpperCase() + stem.slice(1) : "World Symbol";
}

function extractTagsFromPath(packName: string, relPath: string, wGroup: WorldAssetGroup): string[] {
  const raw = `${packName} ${relPath}`.toLowerCase();
  const words = raw.match(/[a-z0-9]{2,}/g) ?? [];
  const stop = new Set(["sprites", "symbols", "trees", "mountains", "textures", "png", "webp", "jpg", "jpeg", "official", "premium", "pack", "wonderdraft"]);
  const out = new Set<string>(["world", "wonderdraft", "symbol", wGroup]);
  for (const w of words) {
    if (!stop.has(w)) out.add(w);
    if (out.size >= 14) break;
  }
  return Array.from(out);
}

/**
 * Imports a Wonderdraft pack `.zip` File directly in the browser, extracting all sprites,
 * `.wonderdraft_symbols` draw modes & ground anchors into ready-to-mount Vault assets.
 */
export async function importWonderdraftZipBytes(
  packFileName: string,
  zipBytes: Uint8Array,
): Promise<{ source: VaultSource; assets: VaultAsset[] }> {
  const entries = await readZipEntries(zipBytes);
  const packTitle = packFileName.replace(/\.zip$/i, "").replace(/[_\-]+/g, " ").trim() || "Wonderdraft Pack";
  const sourceId = `src-wd-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // 1. Pre-parse all .wonderdraft_symbols manifests keyed by parent folder
  const manifestsByFolder = new Map<string, ParsedWonderdraftManifest>();
  const decoder = new TextDecoder();
  for (const ent of entries) {
    if (ent.path.toLowerCase().endsWith(".wonderdraft_symbols")) {
      const folder = ent.path.slice(0, Math.max(0, ent.path.lastIndexOf("/"))).toLowerCase();
      manifestsByFolder.set(folder, parseWonderdraftSymbolsJson(decoder.decode(ent.data)));
    }
  }

  // 2. Mount every PNG/WebP/JPG sprite or texture
  const assets: VaultAsset[] = [];
  let idx = 0;
  for (const ent of entries) {
    const low = ent.path.toLowerCase();
    if (!/\.(png|webp|jpg|jpeg)$/.test(low)) continue;
    if (low.includes("/thumbs/") || low.endsWith("preview.png")) continue;
    if (ent.data.byteLength < 64) continue;

    const folder = ent.path.slice(0, Math.max(0, ent.path.lastIndexOf("/"))).toLowerCase();
    const fileStem = (ent.path.split("/").pop() ?? "").replace(/\.[^.]+$/, "").toLowerCase();
    const manifest = manifestsByFolder.get(folder);
    const meta = manifest?.perSymbol.get(fileStem) ?? manifest?.folderDefault ?? undefined;

    const wGroup = classifyWonderdraftWorldGroup(ent.path);
    const drawMode = mapWonderdraftDrawMode(meta?.draw_mode, ent.path);
    const { widthPx, heightPx } = probeImageHeaderSize(ent.data);
    const mime = low.endsWith(".webp") ? "image/webp" : low.endsWith(".jpg") || low.endsWith(".jpeg") ? "image/jpeg" : "image/png";
    const copy = new Uint8Array(ent.data.byteLength);
    copy.set(ent.data);
    const blobUrl = typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
      ? URL.createObjectURL(new Blob([copy], { type: mime }))
      : "";

    const isTex = wGroup === "textures";
    assets.push({
      id: `wd-imp/${sourceId}/${idx++}`,
      sourceId,
      sourceName: packTitle,
      sourceKind: "wonderdraft",
      internalPath: ent.path,
      url: blobUrl,
      thumbUrl: blobUrl,
      displayName: meta?.name && manifest?.perSymbol.has(fileStem) ? meta.name : cleanDisplayName(ent.path),
      category: isTex ? "terrain" : "symbol",
      worldGroup: wGroup,
      widthPx,
      heightPx,
      defaultPpi: isTex ? 256 : 128,
      drawMode,
      dominantHex: "#8C7A68",
      castsShadow: false,
      anchorOffsetX: meta?.offset_x ?? 0,
      anchorOffsetY: meta?.offset_y ?? 0,
      isFavorite: false,
      tags: extractTagsFromPath(packTitle, ent.path, wGroup),
    });
  }

  const source: VaultSource = {
    id: sourceId,
    kind: "wonderdraft",
    name: packTitle,
    rootPath: packFileName,
    enabled: true,
    assetCount: assets.length,
    ramEstimateMb: Math.round((assets.length * 0.08 + 0.5) * 10) / 10,
    lastIndexedAt: Date.now(),
  };

  return { source, assets };
}

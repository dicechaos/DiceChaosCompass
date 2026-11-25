/**
 * Zero-dependency browser & Tauri decoder for native:
 *   - Wonderdraft (.wonderdraft_map — Godot GCPF FastLZ/Deflate/GZip + Binary Variant store_var, or extracted JSON)
 *   - Dungeondraft (.dungeondraft_map — UTF-8 JSON with Godot Vector2 / PoolVector2Array / Color strings)
 *   - Dice Chaos Maps (.dcmap — UTF-8 JSON)
 *
 * Uses zero-copy Uint8Array subarray views for large embedded PoolByteArray images (e.g. 4546x3100
 * Wonderdraft mask & ground RGBA8 buffers) so multi-megabyte maps decode cleanly in-browser.
 */

import { readZipEntries } from "@/engine/wonderdraftImport";
import type { Point2D } from "@/types/map";

export interface GodotVector2 {
  _godotType: "Vector2";
  x: number;
  y: number;
}

export interface GodotRect2 {
  _godotType: "Rect2";
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GodotColor {
  _godotType: "Color";
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface GodotObject {
  _godotType: "Object";
  className: string;
  props: Record<string, unknown>;
}

export interface GodotNodePath {
  _godotType: "NodePath";
  names: string[];
  subnames: string[];
  absolute: boolean;
}

export type DecodedDraftMap =
  | { kind: "dcmap"; data: Record<string, unknown> }
  | { kind: "dungeondraft"; data: Record<string, unknown> }
  | { kind: "wonderdraft"; data: Record<string, unknown> };

const utf8Decoder = new TextDecoder("utf-8", { fatal: false });

// ---------------------------------------------------------------------------
// FastLZ Level 1 & Level 2 Decompressor (Godot GCPF mode 0)
// ---------------------------------------------------------------------------

export function decompressFastLz(src: Uint8Array, expectedSize = 4096): Uint8Array {
  const n = src.length;
  if (n === 0) return new Uint8Array(0);
  const out = new Uint8Array(Math.max(expectedSize, n));
  let outPos = 0;

  const ensureCap = (extra: number) => {
    if (outPos + extra <= out.length) return;
    // Rare fallback if a block exceeds expectedSize
    throw new RangeError(`FastLZ output overflow: need ${outPos + extra} > ${out.length}`);
  };

  const level = (src[0] >> 5) + 1;
  let ctrl = src[0] & 31;
  let i = 1;

  if (level === 1) {
    while (true) {
      if (ctrl >= 32) {
        let len = (ctrl >> 5) - 1;
        let ofs = (ctrl & 31) << 8;
        if (len === 6) {
          len += src[i++];
        }
        ofs += src[i++];
        const count = len + 3;
        ensureCap(count);
        let ref = outPos - ofs - 1;
        for (let k = 0; k < count; k++) {
          out[outPos++] = out[ref++];
        }
      } else {
        const count = ctrl + 1;
        ensureCap(count);
        out.set(src.subarray(i, i + count), outPos);
        i += count;
        outPos += count;
      }
      if (i >= n) break;
      ctrl = src[i++];
    }
  } else {
    while (true) {
      if (ctrl >= 32) {
        let len = (ctrl >> 5) - 1;
        let ofs = (ctrl & 31) << 8;
        if (len === 6) {
          while (true) {
            const code = src[i++];
            len += code;
            if (code !== 255) break;
          }
        }
        const code = src[i++];
        ofs += code;
        if (code === 255 && (ctrl & 31) === 31) {
          ofs = (src[i] << 8) + src[i + 1] + 8191;
          i += 2;
        }
        const count = len + 3;
        ensureCap(count);
        let ref = outPos - ofs;
        for (let k = 0; k < count; k++) {
          out[outPos++] = out[ref++];
        }
      } else {
        const count = ctrl + 1;
        ensureCap(count);
        out.set(src.subarray(i, i + count), outPos);
        i += count;
        outPos += count;
      }
      if (i >= n) break;
      ctrl = src[i++];
    }
  }

  return outPos === out.length ? out : out.subarray(0, outPos);
}

async function decompressWebStream(
  bytes: Uint8Array,
  format: "gzip" | "deflate" | "deflate-raw",
): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(`Browser DecompressionStream("${format}") is unavailable in this environment.`);
  }
  const ds = new DecompressionStream(format);
  const writer = ds.writable.getWriter();
  await writer.write(bytes as BufferSource);
  await writer.close();
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
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.byteLength;
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Godot GCPF (FileAccessCompressed) Container Unpacker
// ---------------------------------------------------------------------------

export function isGcpfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 16 &&
    bytes[0] === 0x47 && // 'G'
    bytes[1] === 0x43 && // 'C'
    bytes[2] === 0x50 && // 'P'
    bytes[3] === 0x46 // 'F'
  );
}

export async function decompressGcpf(bytes: Uint8Array): Promise<Uint8Array> {
  if (!isGcpfHeader(bytes)) {
    throw new Error("Invalid GCPF header.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const mode = view.getUint32(4, true); // 0=FastLZ, 1=Deflate, 2=Zstd, 3=GZip
  const blockSize = view.getUint32(8, true);
  const readTotal = view.getUint32(12, true);
  if (blockSize === 0 || readTotal > 512 * 1024 * 1024) {
    throw new Error(`Unsupported GCPF header dimensions (blockSize=${blockSize}, total=${readTotal}).`);
  }

  const blockCount = Math.floor(readTotal / blockSize) + 1;
  const tableEnd = 16 + blockCount * 4;
  if (tableEnd > bytes.byteLength) {
    throw new Error("Truncated GCPF block table.");
  }

  const compSizes = new Uint32Array(blockCount);
  for (let i = 0; i < blockCount; i++) {
    compSizes[i] = view.getUint32(16 + i * 4, true);
  }

  const out = new Uint8Array(readTotal);
  let srcPos = tableEnd;
  let dstPos = 0;

  for (let b = 0; b < blockCount; b++) {
    const csize = compSizes[b];
    if (csize === 0) continue;
    const expectedBlock = Math.min(blockSize, readTotal - dstPos);
    const slice = bytes.subarray(srcPos, srcPos + csize);
    srcPos += csize;

    let decoded: Uint8Array;
    if (mode === 0) {
      decoded = decompressFastLz(slice, expectedBlock + 64);
    } else if (mode === 1) {
      decoded = await decompressWebStream(slice, "deflate");
    } else if (mode === 3) {
      decoded = await decompressWebStream(slice, "gzip");
    } else {
      throw new Error(
        `GCPF compression mode ${mode} (Zstd) is not supported directly yet. In Wonderdraft, use Menu → Extract Map Data and open the extracted JSON, or re-save in standard mode.`,
      );
    }

    const writeLen = Math.min(decoded.byteLength, readTotal - dstPos);
    out.set(decoded.subarray(0, writeLen), dstPos);
    dstPos += writeLen;
  }

  return dstPos === readTotal ? out : out.subarray(0, dstPos);
}

// ---------------------------------------------------------------------------
// Godot 3.x Binary Variant (File.store_var / encode_variant) Reader
// ---------------------------------------------------------------------------

class GodotVariantReader {
  private readonly bytes: Uint8Array;
  private readonly view: DataView;
  public pos: number;

  constructor(bytes: Uint8Array, startOffset = 0) {
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = startOffset;
  }

  readU32(): number {
    const v = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readI32(): number {
    const v = this.view.getInt32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readI64(): number {
    const lo = this.view.getUint32(this.pos, true);
    const hi = this.view.getInt32(this.pos + 4, true);
    this.pos += 8;
    return hi * 4294967296 + lo;
  }

  readF32(): number {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  readF64(): number {
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  readString(): string {
    const len = this.readU32();
    const s = utf8Decoder.decode(this.bytes.subarray(this.pos, this.pos + len));
    const pad = (4 - (len % 4)) % 4;
    this.pos += len + pad;
    return s;
  }

  readVariant(): unknown {
    const header = this.readU32();
    const vtype = header & 0xffff;
    const flags = header >>> 16;

    switch (vtype) {
      case 0: // NIL
        return null;
      case 1: // BOOL
        return this.readU32() !== 0;
      case 2: // INT
        return flags & 1 ? this.readI64() : this.readI32();
      case 3: // REAL
        return flags & 1 ? this.readF64() : this.readF32();
      case 4: // STRING
        return this.readString();
      case 5: // VECTOR2
        return { _godotType: "Vector2", x: this.readF32(), y: this.readF32() } satisfies GodotVector2;
      case 6: // RECT2
        return {
          _godotType: "Rect2",
          x: this.readF32(),
          y: this.readF32(),
          w: this.readF32(),
          h: this.readF32(),
        } satisfies GodotRect2;
      case 7: // VECTOR3
        return { x: this.readF32(), y: this.readF32(), z: this.readF32() };
      case 8: {
        // TRANSFORM2D
        const v: number[] = [];
        for (let i = 0; i < 6; i++) v.push(this.readF32());
        return v;
      }
      case 9: // PLANE
      case 10: {
        // QUAT
        const v: number[] = [];
        for (let i = 0; i < 4; i++) v.push(this.readF32());
        return v;
      }
      case 11: {
        // AABB
        const v: number[] = [];
        for (let i = 0; i < 6; i++) v.push(this.readF32());
        return v;
      }
      case 12: {
        // BASIS
        const v: number[] = [];
        for (let i = 0; i < 9; i++) v.push(this.readF32());
        return v;
      }
      case 13: {
        // TRANSFORM
        const v: number[] = [];
        for (let i = 0; i < 12; i++) v.push(this.readF32());
        return v;
      }
      case 14: // COLOR
        return {
          _godotType: "Color",
          r: this.readF32(),
          g: this.readF32(),
          b: this.readF32(),
          a: this.readF32(),
        } satisfies GodotColor;
      case 15: {
        // NODE_PATH
        const ncRaw = this.readU32();
        if ((ncRaw & 0x80000000) !== 0) {
          const nc = ncRaw & 0x7fffffff;
          const sub = this.readU32();
          const fl = this.readU32();
          const names: string[] = [];
          const subnames: string[] = [];
          for (let i = 0; i < nc; i++) names.push(this.readString());
          for (let i = 0; i < sub; i++) subnames.push(this.readString());
          return {
            _godotType: "NodePath",
            names,
            subnames,
            absolute: (fl & 1) !== 0,
          } satisfies GodotNodePath;
        }
        const names: string[] = [];
        for (let i = 0; i < ncRaw; i++) names.push(this.readString());
        return { _godotType: "NodePath", names, subnames: [], absolute: false } satisfies GodotNodePath;
      }
      case 16: // RID
        return this.readU32();
      case 17: {
        // OBJECT
        if (flags & 1) {
          return this.readI64();
        }
        const className = this.readString();
        if (!className) return null;
        const propCount = this.readU32();
        const props: Record<string, unknown> = {};
        for (let i = 0; i < propCount; i++) {
          const pk = this.readString();
          props[pk] = this.readVariant();
        }
        return { _godotType: "Object", className, props } satisfies GodotObject;
      }
      case 18: {
        // DICTIONARY
        const count = this.readU32() & 0x7fffffff;
        const dict: Record<string, unknown> = {};
        for (let i = 0; i < count; i++) {
          const k = this.readVariant();
          const v = this.readVariant();
          dict[String(k)] = v;
        }
        return dict;
      }
      case 19: {
        // ARRAY
        const count = this.readU32() & 0x7fffffff;
        const arr: unknown[] = new Array(count);
        for (let i = 0; i < count; i++) {
          arr[i] = this.readVariant();
        }
        return arr;
      }
      case 20: {
        // POOL_BYTE_ARRAY — zero-copy view!
        const len = this.readU32();
        const slice = this.bytes.subarray(this.pos, this.pos + len);
        const pad = (4 - (len % 4)) % 4;
        this.pos += len + pad;
        return slice;
      }
      case 21: {
        // POOL_INT_ARRAY
        const count = this.readU32();
        const arr = new Int32Array(count);
        for (let i = 0; i < count; i++) arr[i] = this.readI32();
        return arr;
      }
      case 22: {
        // POOL_REAL_ARRAY
        const count = this.readU32();
        const arr = new Float32Array(count);
        for (let i = 0; i < count; i++) arr[i] = this.readF32();
        return arr;
      }
      case 23: {
        // POOL_STRING_ARRAY
        const count = this.readU32();
        const arr: string[] = new Array(count);
        for (let i = 0; i < count; i++) arr[i] = this.readString();
        return arr;
      }
      case 24: {
        // POOL_VECTOR2_ARRAY
        const count = this.readU32();
        const pts: Point2D[] = new Array(count);
        for (let i = 0; i < count; i++) {
          pts[i] = { x: this.readF32(), y: this.readF32() };
        }
        return pts;
      }
      case 25: {
        // POOL_VECTOR3_ARRAY
        const count = this.readU32();
        const arr: Array<{ x: number; y: number; z: number }> = new Array(count);
        for (let i = 0; i < count; i++) {
          arr[i] = { x: this.readF32(), y: this.readF32(), z: this.readF32() };
        }
        return arr;
      }
      case 26: {
        // POOL_COLOR_ARRAY
        const count = this.readU32();
        const arr: GodotColor[] = new Array(count);
        for (let i = 0; i < count; i++) {
          arr[i] = {
            _godotType: "Color",
            r: this.readF32(),
            g: this.readF32(),
            b: this.readF32(),
            a: this.readF32(),
          };
        }
        return arr;
      }
      default:
        throw new Error(`Unsupported Godot Variant type ${vtype} at byte offset ${this.pos - 4}.`);
    }
  }
}

export function readGodotStoreVar(bytes: Uint8Array): unknown {
  if (bytes.byteLength < 8) {
    throw new Error("Godot binary Variant buffer too short.");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const prefixLen = view.getUint32(0, true);
  // Godot File.store_var prepends a 4-byte payload length; accept raw encode_variant too
  const startOffset = prefixLen === bytes.byteLength - 4 ? 4 : 0;
  const reader = new GodotVariantReader(bytes, startOffset);
  return reader.readVariant();
}

// ---------------------------------------------------------------------------
// Godot JSON String Parsers (used by .dungeondraft_map and extracted WD JSON)
// ---------------------------------------------------------------------------

export function parseGodotVector2(val: unknown): Point2D | null {
  if (!val) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    const o = val as Record<string, unknown>;
    if (typeof o.x === "number" && typeof o.y === "number") {
      return { x: o.x, y: o.y };
    }
  }
  if (Array.isArray(val) && val.length >= 2 && typeof val[0] === "number" && typeof val[1] === "number") {
    return { x: val[0], y: val[1] };
  }
  if (typeof val === "string") {
    const m = val.match(/Vector2\s*\(\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*,\s*([-+]?\d*\.?\d+(?:e[-+]?\d+)?)\s*\)/i);
    if (m) {
      return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
    }
  }
  return null;
}

export function parseGodotPoolVector2Array(val: unknown): Point2D[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    const pts: Point2D[] = [];
    for (const item of val) {
      const p = parseGodotVector2(item);
      if (p) pts.push(p);
    }
    return pts;
  }
  if (typeof val === "string") {
    const m = val.match(/PoolVector2Array\s*\(([\s\S]*)\)/i);
    const body = m ? m[1] : val;
    const nums = body.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/g);
    if (!nums || nums.length < 2) return [];
    const pts: Point2D[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      pts.push({ x: parseFloat(nums[i]), y: parseFloat(nums[i + 1]) });
    }
    return pts;
  }
  return [];
}

export function parseGodotPoolIntArray(val: unknown): Int32Array | null {
  if (!val) return null;
  if (val instanceof Int32Array) return val;
  if (Array.isArray(val)) {
    const out = new Int32Array(val.length);
    for (let i = 0; i < val.length; i++) out[i] = Number(val[i]) | 0;
    return out;
  }
  if (typeof val === "string") {
    const m = val.match(/PoolIntArray\s*\(([\s\S]*)\)/i);
    if (!m) return null;
    const parts = m[1].split(",");
    const out = new Int32Array(parts.length);
    let n = 0;
    for (let i = 0; i < parts.length; i++) {
      const num = parseInt(parts[i].trim(), 10);
      if (!Number.isNaN(num)) out[n++] = num;
    }
    return out.subarray(0, n);
  }
  return null;
}

export function parseGodotPoolByteArray(val: unknown): Uint8Array | null {
  if (!val) return null;
  if (val instanceof Uint8Array) return val;
  if (Array.isArray(val)) {
    const out = new Uint8Array(val.length);
    for (let i = 0; i < val.length; i++) out[i] = Number(val[i]) & 255;
    return out;
  }
  if (typeof val === "string") {
    const m = val.match(/PoolByteArray\s*\(([\s\S]*)\)/i);
    if (m) {
      const parts = m[1].split(",");
      const out = new Uint8Array(parts.length);
      let n = 0;
      for (let i = 0; i < parts.length; i++) {
        const num = parseInt(parts[i].trim(), 10);
        if (!Number.isNaN(num)) out[n++] = num & 255;
      }
      return out.subarray(0, n);
    }
    // Base64 fallback
    try {
      const bin = atob(val.trim());
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch {
      return null;
    }
  }
  return null;
}

export function rgbaFloatToHex(r: number, g: number, b: number): string {
  const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  const hex2 = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${hex2(clamp255(r))}${hex2(clamp255(g))}${hex2(clamp255(b))}`;
}

export function parseGodotColor(val: unknown): { hex: string; alpha: number } | null {
  if (!val) return null;
  if (typeof val === "object" && !Array.isArray(val)) {
    const c = val as Partial<GodotColor>;
    if (typeof c.r === "number" && typeof c.g === "number" && typeof c.b === "number") {
      return {
        hex: rgbaFloatToHex(c.r, c.g, c.b),
        alpha: typeof c.a === "number" ? Math.max(0, Math.min(1, c.a)) : 1,
      };
    }
  }
  if (typeof val === "string") {
    const s = val.trim();
    const cm = s.match(
      /Color\s*\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)(?:\s*,\s*([-+]?\d*\.?\d+))?\s*\)/i,
    );
    if (cm) {
      return {
        hex: rgbaFloatToHex(parseFloat(cm[1]), parseFloat(cm[2]), parseFloat(cm[3])),
        alpha: cm[4] !== undefined ? Math.max(0, Math.min(1, parseFloat(cm[4]))) : 1,
      };
    }
    const clean = s.replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(clean)) {
      return { hex: `#${clean.toUpperCase()}`, alpha: 1 };
    }
    if (/^[0-9a-f]{8}$/i.test(clean)) {
      // Dungeondraft encodes hex colors as AARRGGBB (e.g. "ff2e86ab")
      const a = parseInt(clean.slice(0, 2), 16) / 255;
      const rgb = clean.slice(2, 8).toUpperCase();
      return { hex: `#${rgb}`, alpha: Math.max(0, Math.min(1, a)) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Unified Format & Container Auto-Detector
// ---------------------------------------------------------------------------

function classifyParsedObject(
  fileName: string,
  obj: Record<string, unknown>,
): DecodedDraftMap {
  const lower = fileName.toLowerCase();
  if (obj.schemaVersion === "1.0.0" && Array.isArray(obj.layers)) {
    return { kind: "dcmap", data: obj };
  }
  if (
    lower.endsWith(".dungeondraft_map") ||
    (obj.world && typeof obj.world === "object" && "levels" in (obj.world as Record<string, unknown>)) ||
    ("levels" in obj && typeof obj.levels === "object" && !Array.isArray(obj.levels))
  ) {
    return { kind: "dungeondraft", data: obj };
  }
  if (
    lower.endsWith(".wonderdraft_map") ||
    "map_width" in obj ||
    "water_level" in obj ||
    ("symbols" in obj && "labels" in obj)
  ) {
    return { kind: "wonderdraft", data: obj };
  }
  throw new Error(
    `Unrecognized map file format for "${fileName}". Supported formats: .dcmap, .wonderdraft_map, .dungeondraft_map.`,
  );
}

function tryParseJsonBytes(bytes: Uint8Array): Record<string, unknown> | null {
  // Fast check for leading UTF-8 BOM or whitespace followed by '{'
  let i = 0;
  if (bytes.byteLength >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    i = 3;
  }
  while (i < bytes.byteLength && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) {
    i++;
  }
  if (i >= bytes.byteLength || bytes[i] !== 0x7b) return null; // '{'
  const text = utf8Decoder.decode(bytes.subarray(i));
  const parsed = JSON.parse(text);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>;
  }
  return null;
}

export async function decodeDraftMapBytes(
  fileName: string,
  bytes: Uint8Array,
): Promise<DecodedDraftMap> {
  if (bytes.byteLength === 0) {
    throw new Error(`Map file "${fileName}" is empty.`);
  }

  // 1. Godot GCPF compressed container (.wonderdraft_map native binary saves!)
  if (isGcpfHeader(bytes)) {
    const raw = await decompressGcpf(bytes);
    const asJson = tryParseJsonBytes(raw);
    if (asJson) {
      return classifyParsedObject(fileName, asJson);
    }
    const variant = readGodotStoreVar(raw);
    if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
      throw new Error(`Unexpected root Godot Variant payload in "${fileName}".`);
    }
    return classifyParsedObject(fileName, variant as Record<string, unknown>);
  }

  // 2. GZip stream (1F 8B)
  if (bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const raw = await decompressWebStream(bytes, "gzip");
    return decodeDraftMapBytes(fileName, raw);
  }

  // 3. ZIP archive (50 4B 03 04)
  if (
    bytes.byteLength >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    const entries = await readZipEntries(bytes);
    const target = entries.find((e) =>
      /\.(wonderdraft_map|dungeondraft_map|dcmap|json)$/i.test(e.path),
    );
    if (!target) {
      throw new Error(`ZIP archive "${fileName}" does not contain a supported map file.`);
    }
    return decodeDraftMapBytes(target.path, target.data);
  }

  // 4. Plain UTF-8 JSON (.dcmap, .dungeondraft_map, or extracted Wonderdraft JSON)
  const asJson = tryParseJsonBytes(bytes);
  if (asJson) {
    return classifyParsedObject(fileName, asJson);
  }

  // 5. Uncompressed raw Godot store_var binary fallback
  const variant = readGodotStoreVar(bytes);
  if (variant && typeof variant === "object" && !Array.isArray(variant)) {
    return classifyParsedObject(fileName, variant as Record<string, unknown>);
  }

  throw new Error(`Could not decode "${fileName}" as a Dice Chaos, Wonderdraft, or Dungeondraft map.`);
}

/**
 * Zero-dependency, standards-compliant PKWARE ZIP archive builder (UTF-8 paths, IEEE CRC-32).
 *
 * Uses STORE (method 0) for already-compressed raster images (PNG/WebP/JPEG) so large 4K/8K
 * battlemap bundles pack in milliseconds with minimal RAM overhead, and uses native
 * CompressionStream("deflate-raw") when available for text/JSON payloads (.dd2vtt, .html)
 * with graceful fallback to STORE if CompressionStream is unavailable.
 */

export interface ZipInputEntry {
  /** Forward-slash relative path inside the archive, e.g. "MyMap/Player/MyMap_1F.png" */
  path: string;
  data: Uint8Array;
  /** Optional modification timestamp (defaults to current date/time) */
  modifiedAt?: Date;
  /** Force STORE (method 0) even for compressible payloads (useful for deterministic/fast packing) */
  storeOnly?: boolean;
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeDosDateTime(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);
  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

function normalizeZipPath(rawPath: string): string {
  return rawPath
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");
}

function shouldDeflatePath(path: string): boolean {
  const lower = path.toLowerCase();
  return (
    lower.endsWith(".dd2vtt") ||
    lower.endsWith(".json") ||
    lower.endsWith(".html") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".svg") ||
    lower.endsWith(".dcmap")
  );
}

async function tryDeflateRaw(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const cs = new CompressionStream("deflate-raw");
    const writer = cs.writable.getWriter();
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    const writePromise = writer.write(copy).then(() => writer.close());
    const reader = cs.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLen += value.byteLength;
      }
    }
    await writePromise;
    const out = new Uint8Array(totalLen);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return out;
  } catch {
    return null;
  }
}

interface PreparedZipRecord {
  nameBytes: Uint8Array;
  compressed: Uint8Array;
  uncompressedSize: number;
  crc32: number;
  method: 0 | 8;
  dosTime: number;
  dosDate: number;
  localOffset: number;
}

/**
 * Packs a list of relative file entries (preserving nested folders) into a standard ZIP Uint8Array.
 */
export async function buildZipBytes(entries: ZipInputEntry[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const prepared: PreparedZipRecord[] = [];
  const usedPaths = new Set<string>();
  let localSectionBytes = 0;
  let centralSectionBytes = 0;

  for (const entry of entries) {
    let normPath = normalizeZipPath(entry.path);
    if (!normPath) continue;

    // Deduplicate paths cleanly in case two variants resolve to the same path
    if (usedPaths.has(normPath)) {
      const dot = normPath.lastIndexOf(".");
      const stem = dot > normPath.lastIndexOf("/") ? normPath.slice(0, dot) : normPath;
      const ext = dot > normPath.lastIndexOf("/") ? normPath.slice(dot) : "";
      let n = 2;
      while (usedPaths.has(`${stem}_${n}${ext}`)) n++;
      normPath = `${stem}_${n}${ext}`;
    }
    usedPaths.add(normPath);

    const nameBytes = encoder.encode(normPath);
    const crc32 = computeCrc32(entry.data);
    let method: 0 | 8 = 0;
    let payload = entry.data;

    if (!entry.storeOnly && entry.data.byteLength >= 128 && shouldDeflatePath(normPath)) {
      const deflated = await tryDeflateRaw(entry.data);
      if (deflated && deflated.byteLength < entry.data.byteLength) {
        method = 8;
        payload = deflated;
      }
    }

    const { dosTime, dosDate } = encodeDosDateTime(entry.modifiedAt ?? new Date());
    const localOffset = localSectionBytes;
    prepared.push({
      nameBytes,
      compressed: payload,
      uncompressedSize: entry.data.byteLength,
      crc32,
      method,
      dosTime,
      dosDate,
      localOffset,
    });

    localSectionBytes += 30 + nameBytes.byteLength + payload.byteLength;
    centralSectionBytes += 46 + nameBytes.byteLength;
  }

  const totalSize = localSectionBytes + centralSectionBytes + 22;
  const out = new Uint8Array(totalSize);
  const view = new DataView(out.buffer);
  const UTF8_FLAG = 0x0800;

  // 1. Write Local File Headers + File Data
  let cursor = 0;
  for (const rec of prepared) {
    view.setUint32(cursor, 0x04034b50, true); // Local file header signature
    view.setUint16(cursor + 4, 20, true); // Version needed (2.0)
    view.setUint16(cursor + 6, UTF8_FLAG, true); // General purpose bit flag (UTF-8)
    view.setUint16(cursor + 8, rec.method, true); // Compression method (0=STORE, 8=DEFLATE)
    view.setUint16(cursor + 10, rec.dosTime, true);
    view.setUint16(cursor + 12, rec.dosDate, true);
    view.setUint32(cursor + 14, rec.crc32, true);
    view.setUint32(cursor + 18, rec.compressed.byteLength, true);
    view.setUint32(cursor + 22, rec.uncompressedSize, true);
    view.setUint16(cursor + 26, rec.nameBytes.byteLength, true);
    view.setUint16(cursor + 28, 0, true); // Extra field length
    out.set(rec.nameBytes, cursor + 30);
    cursor += 30 + rec.nameBytes.byteLength;
    out.set(rec.compressed, cursor);
    cursor += rec.compressed.byteLength;
  }

  // 2. Write Central Directory Headers
  const centralOffset = cursor;
  for (const rec of prepared) {
    view.setUint32(cursor, 0x02014b50, true); // Central directory header signature
    view.setUint16(cursor + 4, 20, true); // Version made by
    view.setUint16(cursor + 6, 20, true); // Version needed
    view.setUint16(cursor + 8, UTF8_FLAG, true); // UTF-8 flag
    view.setUint16(cursor + 10, rec.method, true);
    view.setUint16(cursor + 12, rec.dosTime, true);
    view.setUint16(cursor + 14, rec.dosDate, true);
    view.setUint32(cursor + 16, rec.crc32, true);
    view.setUint32(cursor + 20, rec.compressed.byteLength, true);
    view.setUint32(cursor + 24, rec.uncompressedSize, true);
    view.setUint16(cursor + 28, rec.nameBytes.byteLength, true);
    view.setUint16(cursor + 30, 0, true); // Extra length
    view.setUint16(cursor + 32, 0, true); // Comment length
    view.setUint16(cursor + 34, 0, true); // Disk number start
    view.setUint16(cursor + 36, 0, true); // Internal attributes
    view.setUint32(cursor + 38, 0, true); // External attributes
    view.setUint32(cursor + 42, rec.localOffset, true);
    out.set(rec.nameBytes, cursor + 46);
    cursor += 46 + rec.nameBytes.byteLength;
  }

  // 3. Write End of Central Directory (EOCD) Record
  view.setUint32(cursor, 0x06054b50, true); // EOCD signature
  view.setUint16(cursor + 4, 0, true); // Disk number
  view.setUint16(cursor + 6, 0, true); // Disk with central directory
  view.setUint16(cursor + 8, prepared.length, true); // Entries on disk
  view.setUint16(cursor + 10, prepared.length, true); // Total entries
  view.setUint32(cursor + 12, centralSectionBytes, true); // Central directory size
  view.setUint32(cursor + 16, centralOffset, true); // Central directory offset
  view.setUint16(cursor + 20, 0, true); // ZIP comment length

  return out;
}

export async function buildZipBlob(entries: ZipInputEntry[]): Promise<Blob> {
  const bytes = await buildZipBytes(entries);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: "application/zip" });
}

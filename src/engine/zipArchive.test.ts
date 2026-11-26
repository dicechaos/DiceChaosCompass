import { describe, expect, it } from "vitest";
import { buildZipBytes, computeCrc32 } from "./zipArchive";

async function inflateRawBytes(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const w = writer.write(copy).then(() => writer.close());
  const reader = ds.readable.getReader();
  const chunks: Uint8Array[] = [];
  let len = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      len += value.byteLength;
    }
  }
  await w;
  const out = new Uint8Array(len);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

describe("zipArchive", () => {
  it("computes standard IEEE 802.3 CRC-32 checksums", () => {
    const sample = new TextEncoder().encode("123456789");
    expect(computeCrc32(sample)).toBe(0xcbf43926);
  });

  it("packs nested folder paths into a valid PKWARE ZIP archive with local, central, and EOCD headers", async () => {
    const pngStub = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);
    const vttJson = new TextEncoder().encode(
      JSON.stringify({ format: 0.3, repeated: "dice-chaos-compass ".repeat(60) }),
    );

    const zip = await buildZipBytes([
      { path: "Berlin_Station/Player/Berlin_1F_Player.png", data: pngStub },
      { path: "Berlin_Station/VTT/Berlin_1F_VTT.dd2vtt", data: vttJson },
    ]);

    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    // Local file header signature at byte 0
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    // End of Central Directory signature at last 22 bytes
    const eocdOffset = zip.byteLength - 22;
    expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);
    // 2 total entries
    expect(view.getUint16(eocdOffset + 10, true)).toBe(2);

    // Read Central Directory entry names AND verify local header data round-trips byte-for-byte
    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const names: string[] = [];
    const decoder = new TextDecoder();
    let ptr = cdOffset;
    const expectedPayloads = [pngStub, vttJson];
    for (let i = 0; i < 2; i++) {
      expect(view.getUint32(ptr, true)).toBe(0x02014b50);
      const method = view.getUint16(ptr + 10, true);
      const crc = view.getUint32(ptr + 16, true);
      const compSize = view.getUint32(ptr + 20, true);
      const uncompSize = view.getUint32(ptr + 24, true);
      const nameLen = view.getUint16(ptr + 28, true);
      const extraLen = view.getUint16(ptr + 30, true);
      const commentLen = view.getUint16(ptr + 32, true);
      const localOff = view.getUint32(ptr + 42, true);
      names.push(decoder.decode(zip.subarray(ptr + 46, ptr + 46 + nameLen)));

      const localNameLen = view.getUint16(localOff + 26, true);
      const localExtraLen = view.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + localNameLen + localExtraLen;
      const rawSlice = zip.subarray(dataStart, dataStart + compSize);
      const decoded = method === 8 ? await inflateRawBytes(rawSlice) : rawSlice;
      expect(decoded.byteLength).toBe(uncompSize);
      expect(computeCrc32(decoded)).toBe(crc);
      expect(Array.from(decoded)).toEqual(Array.from(expectedPayloads[i]));

      ptr += 46 + nameLen + extraLen + commentLen;
    }
    expect(names).toEqual([
      "Berlin_Station/Player/Berlin_1F_Player.png",
      "Berlin_Station/VTT/Berlin_1F_VTT.dd2vtt",
    ]);
  });

  it("deduplicates colliding relative paths cleanly instead of overwriting entries", async () => {
    const a = new Uint8Array([10, 20]);
    const b = new Uint8Array([30, 40]);
    const zip = await buildZipBytes([
      { path: "Map/Player/file.png", data: a },
      { path: "Map/Player/file.png", data: b },
    ]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const eocdOffset = zip.byteLength - 22;
    expect(view.getUint16(eocdOffset + 10, true)).toBe(2);
    const text = new TextDecoder("latin1").decode(zip);
    expect(text).toContain("Map/Player/file.png");
    expect(text).toContain("Map/Player/file_2.png");
  });
});

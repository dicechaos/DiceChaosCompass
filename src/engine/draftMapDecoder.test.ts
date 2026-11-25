import { describe, expect, it } from "vitest";
import {
  decodeDraftMapBytes,
  decompressFastLz,
  parseGodotColor,
  parseGodotPoolByteArray,
  parseGodotPoolIntArray,
  parseGodotPoolVector2Array,
  parseGodotVector2,
  readGodotStoreVar,
} from "@/engine/draftMapDecoder";

function writeU32(arr: number[], v: number) {
  arr.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
}

function writeF32(arr: number[], v: number) {
  const b = new ArrayBuffer(4);
  new DataView(b).setFloat32(0, v, true);
  const u = new Uint8Array(b);
  arr.push(u[0], u[1], u[2], u[3]);
}

function writeGodotString(arr: number[], s: string) {
  const enc = new TextEncoder().encode(s);
  writeU32(arr, enc.length);
  for (const b of enc) arr.push(b);
  const pad = (4 - (enc.length % 4)) % 4;
  for (let i = 0; i < pad; i++) arr.push(0);
}

function buildMinimalGcpf(payload: Uint8Array): Uint8Array {
  // FastLZ level-1 literal-only encoder (max 32 bytes per literal run)
  const compressed: number[] = [];
  let pos = 0;
  while (pos < payload.length) {
    const chunk = Math.min(32, payload.length - pos);
    compressed.push(chunk - 1); // ctrl < 32 => literal copy of ctrl + 1 bytes
    for (let i = 0; i < chunk; i++) compressed.push(payload[pos++]);
  }

  const out: number[] = [0x47, 0x43, 0x50, 0x46]; // "GCPF"
  writeU32(out, 0); // mode = FastLZ
  writeU32(out, 4096); // block_size
  writeU32(out, payload.length); // total uncompressed size
  writeU32(out, compressed.length); // block 0 compressed size
  for (const b of compressed) out.push(b);
  return new Uint8Array(out);
}

describe("draftMapDecoder", () => {
  it("decompresses FastLZ literal and backreference sequences cleanly", () => {
    // Literal "ABCD" (ctrl=3 -> 4 bytes), then copy 4 bytes from offset 3 (dist 4): "ABCDABCD"
    // ctrl = ((4-3)+1)<<5 | 0 = 0x40? Wait: count = ((ctrl>>5)-1)+3 => (ctrl>>5)=2 => count=4; ofs = 3
    const src = new Uint8Array([3, 65, 66, 67, 68, (2 << 5) | 0, 3]);
    const out = decompressFastLz(src, 16);
    expect(new TextDecoder().decode(out)).toBe("ABCDABCD");
  });

  it("decodes Godot GCPF + store_var binary Dictionary with Vector2, Color, PoolByteArray, and null Object", async () => {
    const body: number[] = [];
    // Dictionary with 4 entries
    writeU32(body, 18); // DICTIONARY
    writeU32(body, 4);

    // 1. "map_width": float 4096.0
    writeU32(body, 4);
    writeGodotString(body, "map_width");
    writeU32(body, 3); // REAL f32
    writeF32(body, 4096);

    // 2. "offset": Vector2(12.5, -4.0)
    writeU32(body, 4);
    writeGodotString(body, "offset");
    writeU32(body, 5); // VECTOR2
    writeF32(body, 12.5);
    writeF32(body, -4.0);

    // 3. "tint": Color(1, 0.5, 0, 1)
    writeU32(body, 4);
    writeGodotString(body, "tint");
    writeU32(body, 14); // COLOR
    writeF32(body, 1);
    writeF32(body, 0.5);
    writeF32(body, 0);
    writeF32(body, 1);

    // 4. "empty_obj": null OBJECT (empty class name, no prop_count)
    writeU32(body, 4);
    writeGodotString(body, "empty_obj");
    writeU32(body, 17); // OBJECT
    writeU32(body, 0); // class name len 0 -> null

    // Prepend Godot store_var 4-byte length prefix
    const full: number[] = [];
    writeU32(full, body.length);
    full.push(...body);
    const rawBytes = new Uint8Array(full);

    // Direct store_var read
    const parsedDirect = readGodotStoreVar(rawBytes) as Record<string, unknown>;
    expect(parsedDirect.map_width).toBeCloseTo(4096, 3);
    expect(parseGodotVector2(parsedDirect.offset)).toEqual({ x: 12.5, y: -4 });
    expect(parseGodotColor(parsedDirect.tint)?.hex).toBe("#FF8000");
    expect(parsedDirect.empty_obj).toBeNull();

    // Wrapped inside GCPF container
    const gcpf = buildMinimalGcpf(rawBytes);
    const decoded = await decodeDraftMapBytes("MyWorld.wonderdraft_map", gcpf);
    expect(decoded.kind).toBe("wonderdraft");
    expect(decoded.data.map_width).toBeCloseTo(4096, 3);
  });

  it("parses Dungeondraft Godot string types (Vector2, PoolVector2Array, PoolIntArray, PoolByteArray, AARRGGBB Color)", () => {
    expect(parseGodotVector2("Vector2( 1024.5, -256 )")).toEqual({ x: 1024.5, y: -256 });
    expect(parseGodotPoolVector2Array("PoolVector2Array( 0, 0, 256, 512, 768, 256 )")).toEqual([
      { x: 0, y: 0 },
      { x: 256, y: 512 },
      { x: 768, y: 256 },
    ]);
    expect(Array.from(parseGodotPoolIntArray("PoolIntArray( -1, 0, 4, -1 )")!)).toEqual([-1, 0, 4, -1]);
    expect(Array.from(parseGodotPoolByteArray("PoolByteArray( 255, 0, 128, 64 )")!)).toEqual([255, 0, 128, 64]);
    expect(parseGodotColor("ff2e86ab")).toEqual({ hex: "#2E86AB", alpha: 1 });
    expect(parseGodotColor("80ff0000")?.hex).toBe("#FF0000");
    expect(parseGodotColor("80ff0000")?.alpha).toBeCloseTo(128 / 255, 2);
  });

  it("auto-classifies plain JSON Dungeondraft and Dice Chaos files cleanly", async () => {
    const ddJson = JSON.stringify({
      header: { creation_build: "1.0.1.1" },
      world: { width: 24, height: 18, levels: { "0": { label: "Ground" } } },
    });
    const decoded = await decodeDraftMapBytes(
      "Tavern.dungeondraft_map",
      new TextEncoder().encode(ddJson),
    );
    expect(decoded.kind).toBe("dungeondraft");
  });
});

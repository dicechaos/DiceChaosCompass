import { describe, expect, it } from "vitest";
import {
  generateWorldName,
  generateWorldNameBatch,
  WORLD_NAME_CULTURES,
} from "@/engine/worldNameGen";

describe("worldNameGen", () => {
  it("supports all 10 naming cultures with deterministic seeded generation", () => {
    expect(WORLD_NAME_CULTURES.length).toBe(10);
    for (const culture of WORLD_NAME_CULTURES) {
      const a = generateWorldName(culture.id, 4242);
      const b = generateWorldName(culture.id, 4242);
      expect(a).toBe(b);
      expect(a.length).toBeGreaterThan(2);
      expect(a.includes("  ")).toBe(false);
    }
  });

  it("generates unique deduplicated batches", () => {
    const batch = generateWorldNameBatch("high_fantasy", 6, 9001);
    expect(batch.length).toBe(6);
    expect(new Set(batch).size).toBe(6);
  });
});

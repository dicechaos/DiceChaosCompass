import type { DcMapDocument } from "@/types/map";
import rawSovereignTempleDoc from "./sovereignTempleDoc.json";

const SOVEREIGN_TEMPLATE = rawSovereignTempleDoc as unknown as DcMapDocument;

/**
 * Built-in 5-Floor Dark Magipunk "Cathedral of the Sovereign (5F)" built directly
 * atop the imported MrRogers Berlin Magipunk street map (1F–5F + Verdigris Spire ROOF).
 */
export function createSovereignTempleMap(): DcMapDocument {
  return structuredClone(SOVEREIGN_TEMPLATE);
}

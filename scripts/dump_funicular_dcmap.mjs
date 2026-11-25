import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const outDir = path.resolve("exports/Berlin_Magipunk_Funicular_4K_55in");
fs.mkdirSync(outDir, { recursive: true });

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const mod = await server.ssrLoadModule("/src/data/funicularShowcaseMap.ts");
  const doc = mod.createFunicularShowcaseMap();
  const outPath = path.join(outDir, "Berlin_Magipunk_Funicular_4K_55in.dcmap");
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), "utf-8");
  console.log("Wrote .dcmap ->", outPath);
} finally {
  await server.close();
}

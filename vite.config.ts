import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

interface StreamEntry {
  type: "pck" | "wd";
  file: string;
  offset?: number;
  size?: number;
  mime: string;
}

/**
 * Serves indexed Dungeondraft (.dungeondraft_pack byte-ranges) and Wonderdraft
 * sprites on demand directly from ExtraAsses/.cache_* with zero memory bloat.
 */
function userPackAssetStreamer(): Plugin {
  const extraDir = path.resolve(__dirname, "ExtraAsses");
  const indexPath = path.join(extraDir, ".cache_index.json");
  const pckDir = path.join(extraDir, ".cache_pcks");
  const wdDir = path.join(extraDir, ".cache_wd");
  let indexMap: Record<string, StreamEntry> | null = null;
  let indexMtime = 0;

  const loadIndex = () => {
    try {
      const st = fs.statSync(indexPath);
      if (!indexMap || st.mtimeMs !== indexMtime) {
        indexMap = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
        indexMtime = st.mtimeMs;
      }
    } catch {
      indexMap = {};
    }
    return indexMap!;
  };

  return {
    name: "dice-chaos-user-pack-streamer",
    configureServer(server) {
      server.middlewares.use("/user-pack-asset", (req, res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, "http://127.0.0.1");
        const id = url.searchParams.get("id");
        if (!id) {
          res.statusCode = 400;
          res.end("Missing id");
          return;
        }
        const entry = loadIndex()[id];
        if (!entry) {
          res.statusCode = 404;
          res.end("Asset not found");
          return;
        }
        try {
          let buf: Buffer;
          if (entry.type === "pck" && entry.offset !== undefined && entry.size !== undefined) {
            const pckPath = path.join(pckDir, entry.file);
            const fd = fs.openSync(pckPath, "r");
            try {
              buf = Buffer.allocUnsafe(entry.size);
              fs.readSync(fd, buf, 0, entry.size, entry.offset);
            } finally {
              fs.closeSync(fd);
            }
          } else {
            buf = fs.readFileSync(path.join(wdDir, entry.file));
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", entry.mime || "image/png");
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          res.setHeader("Content-Length", String(buf.length));
          res.end(buf);
        } catch {
          res.statusCode = 500;
          res.end("Failed reading pack asset");
        }
      });
    },
  };
}

function stripDevOnlyBundleFiles(): Plugin {
  return {
    name: "dice-chaos-strip-dev-only-dist",
    apply: "build",
    closeBundle() {
      const distAssets = path.resolve(__dirname, "dist", "assets");
      if (!fs.existsSync(distAssets)) return;
      // Remove duplicate distributable .dcpack zips (all loose PNGs are already in dist/assets/*-cc0/)
      for (const entry of fs.readdirSync(distAssets)) {
        if (entry.endsWith(".dcpack")) {
          fs.rmSync(path.join(distAssets, entry), { force: true });
        }
      }
      // Remove dev-only ExtraAsses Vite middleware manifest so standalone builds have zero broken thumbnails
      const userPacksDir = path.join(distAssets, "user-packs");
      if (fs.existsSync(userPacksDir)) {
        fs.rmSync(userPacksDir, { recursive: true, force: true });
      }
      // In native Tauri v2 builds (DC_TAURI_RESOURCES=1), bundled CC0 packs are shipped once via
      // tauri.conf.json bundle.resources and streamed over dcasset:// instead of being embedded in the Rust binary.
      if (process.env.DC_TAURI_RESOURCES === "1") {
        for (const packDir of [
          "starter-cc0",
          "core-fantasy-cc0",
          "modular-suite-cc0",
          "world-atlas-cc0",
        ]) {
          const target = path.join(distAssets, packDir);
          if (fs.existsSync(target)) {
            fs.rmSync(target, { recursive: true, force: true });
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), userPackAssetStreamer(), stripDevOnlyBundleFiles()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      awaitWriteFinish: {
        stabilityThreshold: 350,
        pollInterval: 100,
      },
      ignored: [
        "**/src-tauri/**",
        "**/ExtraAsses/**",
        "**/exports/**",
        "**/*.zip",
        "**/*.dungeondraft_pack",
        "**/*.dcpack",
        "**/*.wonderdraft_map",
        "**/*.dungeondraft_map",
      ],
    },
  },
  build: {
    target: "esnext",
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("react") || id.includes("zustand")) return "vendor-react";
            return "vendor-misc";
          }
          if (
            id.includes("/src/data/trofraderraWorldMap") ||
            id.includes("/src/data/worldShowcaseMap") ||
            id.includes("/src/data/funicularShowcaseMap") ||
            id.includes("/src/data/hiddenSloopMap") ||
            id.includes("/src/data/lakeYachtMap")
          ) {
            return "data-showcases";
          }
          if (
            id.includes("/src/engine/worldEngine") ||
            id.includes("/src/engine/worldRenderer") ||
            id.includes("/src/engine/worldThemes") ||
            id.includes("/src/engine/worldNameGen") ||
            id.includes("/src/engine/wonderdraftImport") ||
            id.includes("/src/engine/sceneRenderer") ||
            id.includes("/src/engine/waterEngine") ||
            id.includes("/src/engine/roofEngine") ||
            id.includes("/src/engine/caveEngine") ||
            id.includes("/src/engine/terrainFill") ||
            id.includes("/src/engine/geometry") ||
            id.includes("/src/engine/colorShader")
          ) {
            return "engine-core";
          }
          if (
            id.includes("/src/ui/workspace/RightInspectorDock") ||
            id.includes("/src/ui/workspace/WorldStudioPanel") ||
            id.includes("/src/ui/workspace/WaterStudioPanel") ||
            id.includes("/src/ui/workspace/RoofStudioPanel") ||
            id.includes("/src/ui/workspace/ColorStudioPanel") ||
            id.includes("/src/ui/workspace/ScatterZonePanel") ||
            id.includes("/src/ui/workspace/TemplatesPanel")
          ) {
            return "ui-inspector";
          }
          return undefined;
        },
      },
    },
  },
});

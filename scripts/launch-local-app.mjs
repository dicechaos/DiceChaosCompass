#!/usr/bin/env node
/**
 * Local Standalone Production Desktop Launcher for Dice Chaos Compass.
 *
 * Serves the minified production bundle (`dist/`) over a fast zero-overhead
 * local HTTP server (with optional local ExtraAsses pack streaming) and opens
 * it in a clean native-style Chromium/Edge `--app` desktop window.
 *
 * Usage:
 *   node scripts/launch-local-app.mjs           # Starts server & opens desktop app window
 *   node scripts/launch-local-app.mjs --smoke   # Verifies server serves dist + assets, then exits 0
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");
const extraDir = path.join(rootDir, "ExtraAsses");
const extraIndexPath = path.join(extraDir, ".cache_index.json");
const pckDir = path.join(extraDir, ".cache_pcks");
const wdDir = path.join(extraDir, ".cache_wd");
const profileDir = path.join(rootDir, ".local-app-profile");

if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error("Production build not found in dist/. Run `npm run build` first.");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".map": "application/json; charset=utf-8",
};

let extraIndexCache = null;
function getExtraIndex() {
  if (extraIndexCache !== null) return extraIndexCache;
  try {
    if (fs.existsSync(extraIndexPath)) {
      extraIndexCache = JSON.parse(fs.readFileSync(extraIndexPath, "utf-8"));
      return extraIndexCache;
    }
  } catch {
    // Ignore missing/corrupt optional ExtraAsses index
  }
  extraIndexCache = {};
  return extraIndexCache;
}

function sendFile(res, filePath, immutable = false) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
    res.setHeader("Content-Length", String(data.length));
    res.setHeader(
      "Cache-Control",
      immutable ? "public, max-age=31536000, immutable" : "no-cache",
    );
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  const parsed = new URL(req.url, "http://127.0.0.1");
  const pathname = decodeURIComponent(parsed.pathname);

  // Stream optional local ExtraAsses pack sprites directly from disk
  if (pathname === "/user-pack-asset") {
    const id = parsed.searchParams.get("id");
    if (!id) {
      res.statusCode = 400;
      res.end("Missing id");
      return;
    }
    const entry = getExtraIndex()[id];
    if (!entry) {
      res.statusCode = 404;
      res.end("Asset not found");
      return;
    }
    try {
      let buf;
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
    return;
  }

  // Serve optional local ExtraAsses manifest if available on this machine
  if (pathname === "/assets/user-packs/extra_manifest.json") {
    const localExtraManifest = path.join(publicDir, "assets", "user-packs", "extra_manifest.json");
    if (fs.existsSync(localExtraManifest)) {
      sendFile(res, localExtraManifest, false);
      return;
    }
  }

  // Safe static resolution inside dist/
  const relPath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(distDir, relPath);
  if (!resolved.startsWith(distDir)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return;
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    const isAsset = pathname.startsWith("/assets/");
    sendFile(res, resolved, isAsset && !pathname.endsWith(".json"));
    return;
  }

  // SPA fallback
  if (!pathname.startsWith("/assets/")) {
    sendFile(res, path.join(distDir, "index.html"), false);
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
});

function findDesktopBrowser() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  for (const exe of candidates) {
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

const isSmoke = process.argv.includes("--smoke");

server.listen(0, "127.0.0.1", async () => {
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 4173;
  const url = `http://127.0.0.1:${port}/`;

  if (isSmoke) {
    try {
      const r1 = await fetch(url);
      const html = await r1.text();
      const r2 = await fetch(`${url}assets/world-atlas-cc0/manifest.json`);
      const r3 = await fetch(`${url}assets/modular-suite-cc0/manifest.json`);
      const r4 = await fetch(`${url}assets/starter-cc0/manifest.json`);
      console.log(
        JSON.stringify({
          url,
          indexStatus: r1.status,
          hasTitle: html.includes("Dice Chaos Compass"),
          worldManifestStatus: r2.status,
          modularManifestStatus: r3.status,
          starterManifestStatus: r4.status,
        }),
      );
      server.close(() => process.exit(r1.ok && r2.ok && r3.ok && r4.ok ? 0 : 1));
    } catch (e) {
      console.error("Smoke check failed:", e);
      server.close(() => process.exit(1));
    }
    return;
  }

  console.log(`\n  Dice Chaos Compass (Local Production Build)`);
  console.log(`  Running at: ${url}`);
  console.log(`  Close the app window (or press Ctrl+C) to stop.\n`);

  const browserExe = findDesktopBrowser();
  if (browserExe) {
    fs.mkdirSync(profileDir, { recursive: true });
    const child = spawn(
      browserExe,
      [
        `--app=${url}`,
        `--user-data-dir=${profileDir}`,
        "--window-size=1600,960",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      { stdio: "ignore" },
    );
    child.on("exit", () => {
      server.close(() => process.exit(0));
    });
  } else {
    console.log("  Open the URL above in your browser to launch.");
  }
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});

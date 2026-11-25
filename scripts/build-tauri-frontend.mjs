#!/usr/bin/env node
/**
 * Builds the Vite frontend bundle for native Tauri v2 desktop packaging.
 * Sets DC_TAURI_RESOURCES=1 so Vite strips the ~294 MB *-cc0 asset folders from
 * dist/assets/ — Tauri packages them once via `bundle.resources` and streams them
 * over the `dcasset` URI protocol instead of embedding them into the Rust binary.
 */

import { spawnSync } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["run", "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    DC_TAURI_RESOURCES: "1",
  },
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);

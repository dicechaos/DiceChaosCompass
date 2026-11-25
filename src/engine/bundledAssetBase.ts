/**
 * Resolves bundled clean-room CC0 asset URLs across both Web/Vite builds and
 * native Tauri v2 desktop builds.
 *
 * - Browser / Vite dev / local standalone launcher: serves `/assets/<subpath>`
 * - Native Tauri v2 desktop build: serves via the custom `dcasset` protocol
 *   backed by `bundle.resources` (`resource_dir/assets/<subpath>`), avoiding
 *   embedding ~300 MB of PNGs into the compiled Rust binary.
 */

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function resolveBundledAssetUrl(subpath: string): string {
  const clean = subpath.replace(/^\/+/, "");
  if (isTauriRuntime()) {
    const isWindows =
      typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);
    return isWindows
      ? `http://dcasset.localhost/${clean}`
      : `dcasset://localhost/${clean}`;
  }
  return `/assets/${clean}`;
}

import { afterEach, describe, expect, it } from "vitest";
import { isTauriRuntime, resolveBundledAssetUrl } from "@/engine/bundledAssetBase";

describe("bundledAssetBase", () => {
  const origWindow = globalThis.window;
  const origNavigator = globalThis.navigator;

  afterEach(() => {
    if (origWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      Object.defineProperty(globalThis, "window", { value: origWindow, configurable: true });
    }
    if (origNavigator === undefined) {
      delete (globalThis as Record<string, unknown>).navigator;
    } else {
      Object.defineProperty(globalThis, "navigator", { value: origNavigator, configurable: true });
    }
  });

  it("uses /assets/ prefix in standard web and Node test runtimes", () => {
    expect(isTauriRuntime()).toBe(false);
    expect(resolveBundledAssetUrl("starter-cc0/manifest.json")).toBe("/assets/starter-cc0/manifest.json");
    expect(resolveBundledAssetUrl("/modular-suite-cc0/props/foo.png")).toBe(
      "/assets/modular-suite-cc0/props/foo.png",
    );
  });

  it("uses http://dcasset.localhost on Windows Tauri v2 runtimes", () => {
    Object.defineProperty(globalThis, "window", {
      value: { __TAURI_INTERNALS__: {} },
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      configurable: true,
    });
    expect(isTauriRuntime()).toBe(true);
    expect(resolveBundledAssetUrl("starter-cc0/manifest.json")).toBe(
      "http://dcasset.localhost/starter-cc0/manifest.json",
    );
  });

  it("uses dcasset://localhost on macOS and Linux Tauri v2 runtimes", () => {
    Object.defineProperty(globalThis, "window", {
      value: { __TAURI_INTERNALS__: {} },
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      configurable: true,
    });
    expect(resolveBundledAssetUrl("world-atlas-cc0/manifest.json")).toBe(
      "dcasset://localhost/world-atlas-cc0/manifest.json",
    );
  });
});

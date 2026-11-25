import type { RecolorMode, RgbRecolor, VaultAsset } from "@/types/map";

export type EffectiveRecolorMode = Exclude<RecolorMode, "auto">;

export interface PaletteSwatch {
  label: string;
  hex: string;
}

export const TTRPG_PALETTE_SWATCHES: PaletteSwatch[] = [
  { label: "Crimson Banner", hex: "#B91C1C" },
  { label: "Prussian Blue", hex: "#2563EB" },
  { label: "Aether Cyan", hex: "#06B6D4" },
  { label: "Emerald Velvet", hex: "#15803D" },
  { label: "Forest Moss", hex: "#4D7C0F" },
  { label: "Royal Gold", hex: "#D97706" },
  { label: "Autumn Rust", hex: "#C2410C" },
  { label: "Arcane Violet", hex: "#7C3AED" },
  { label: "Rosewood Wine", hex: "#9D174D" },
  { label: "Warm Oak", hex: "#8B5A2B" },
  { label: "Weathered Slate", hex: "#64748B" },
  { label: "Parchment Cream", hex: "#D6C5A3" },
];

export function isNativeColorableAsset(asset?: VaultAsset | null): boolean {
  if (!asset) return false;
  if (
    asset.drawMode === "dd_red" ||
    asset.drawMode === "rgb_channels" ||
    asset.drawMode === "sample_color" ||
    asset.drawMode === "tint"
  ) {
    return true;
  }
  return asset.tags.some((t) => t.toLowerCase() === "colorable");
}

export function resolveEffectiveRecolorMode(
  recolor: RgbRecolor | undefined,
  asset?: VaultAsset | null,
): EffectiveRecolorMode {
  const requested = recolor?.mode ?? "auto";
  if (requested !== "auto") return requested;
  if (!asset) return "universal";
  if (asset.drawMode === "dd_red") return "dd_red";
  if (
    asset.sourceKind === "dungeondraft_pack" &&
    (asset.drawMode === "rgb_channels" ||
      asset.tags.some((t) => t.toLowerCase() === "colorable"))
  ) {
    return "dd_red";
  }
  if (asset.drawMode === "rgb_channels") return "rgb_channels";
  if (asset.drawMode === "sample_color" || asset.drawMode === "tint") return "tint";
  return "universal";
}

export function describeAssetColorCapability(asset?: VaultAsset | null): {
  badge: string;
  accent: string;
  native: boolean;
  defaultMode: EffectiveRecolorMode;
} {
  const mode = resolveEffectiveRecolorMode(undefined, asset);
  if (mode === "dd_red") {
    return {
      badge: "DD Colorable (Red Mask)",
      accent: "#34D399",
      native: true,
      defaultMode: "dd_red",
    };
  }
  if (mode === "rgb_channels") {
    return {
      badge: "3-Channel RGB Mask",
      accent: "#38BDF8",
      native: true,
      defaultMode: "rgb_channels",
    };
  }
  if (asset?.drawMode === "sample_color") {
    return {
      badge: "Biome-Sampled Paintable",
      accent: "#34D399",
      native: true,
      defaultMode: "tint",
    };
  }
  if (mode === "tint") {
    return {
      badge: "Engraved Ink / Tintable",
      accent: "#C084FC",
      native: true,
      defaultMode: "tint",
    };
  }
  return {
    badge: "Universal Studio Colorize",
    accent: "#E5A93C",
    native: false,
    defaultMode: "universal",
  };
}

export function parseHexRgb01(hex: string): [number, number, number] {
  const clean = (hex || "#FFFFFF").replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "F").slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return [1, 1, 1];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) * 0.5;
  const d = max - min;
  if (d < 1e-6) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hueToRgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s < 1e-6) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hueToRgb(p, q, h + 1 / 3),
    hueToRgb(p, q, h),
    hueToRgb(p, q, h - 1 / 3),
  ];
}

export interface CompiledShaderParams {
  mode: EffectiveRecolorMode;
  tr: number;
  tg: number;
  tb: number;
  rCol: [number, number, number];
  gCol: [number, number, number];
  bCol: [number, number, number];
  strength: number;
  hasTintHex: boolean;
  hueShiftTurns: number;
  saturation: number;
  brightness: number;
  contrast: number;
  hasGrade: boolean;
}

export function compileShaderParams(
  recolor: RgbRecolor,
  asset?: VaultAsset | null,
): CompiledShaderParams {
  const mode = resolveEffectiveRecolorMode(recolor, asset);
  const [tr, tg, tb] = parseHexRgb01(recolor.tintHex);
  const rCol = parseHexRgb01(recolor.channelR || recolor.tintHex);
  const gCol = parseHexRgb01(recolor.channelG || "#2E8B57");
  const bCol = parseHexRgb01(recolor.channelB || "#D4A438");
  const defaultStrength = mode === "universal" ? 0.62 : 1.0;
  const strength = clamp01(recolor.strength ?? defaultStrength);
  const hueShift = recolor.hueShift ?? 0;
  const saturation = recolor.saturation ?? 1;
  const brightness = recolor.brightness ?? 1;
  const contrast = recolor.contrast ?? 1;
  const hasTintHex = (recolor.tintHex || "#FFFFFF").toUpperCase() !== "#FFFFFF";
  const hasGrade =
    Math.abs(hueShift) > 0.5 ||
    Math.abs(saturation - 1) > 0.01 ||
    Math.abs(brightness - 1) > 0.01 ||
    Math.abs(contrast - 1) > 0.01;

  return {
    mode,
    tr,
    tg,
    tb,
    rCol,
    gCol,
    bCol,
    strength,
    hasTintHex,
    hueShiftTurns: hueShift / 360,
    saturation,
    brightness,
    contrast,
    hasGrade,
  };
}

/**
 * Pure per-pixel shader supporting:
 * - dd_red: Exact Dungeondraft red-channel mask replacement (preserves shadows, pink highlights, black ink & non-red details!)
 * - rgb_channels: Wonderdraft 3-channel R/G/B custom color replacement
 * - tint: Ink-preserving luminance-multiply tinting (Wonderdraft sample_color & grayscale art)
 * - universal: Luminance-preserving tint blend + full HSL/Brightness/Contrast grade for ANY full-color asset
 */
export function recolorPixelRgb01(
  r: number,
  g: number,
  b: number,
  p: CompiledShaderParams,
): [number, number, number] {
  let nr = r;
  let ng = g;
  let nb = b;

  if (p.mode === "dd_red") {
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;
    if (r === maxC && chroma > 0.025) {
      // Hue distance from pure red (0 deg) in [-60..60]
      const hueAbsDeg = Math.abs(((g - b) / chroma) * 60);
      if (hueAbsDeg < 32) {
        // Full weight within +-18 deg of pure red; smooth falloff to 32 deg so warm brown wood stays 100% untouched!
        const hueWeight =
          hueAbsDeg <= 18 ? 1 : (32 - hueAbsDeg) / 14;
        const chromaWeight = chroma >= 0.09 ? 1 : (chroma - 0.025) / 0.065;
        const w = hueWeight * chromaWeight * p.strength;

        // Exact Dungeondraft shade- & highlight-preserving replacement:
        // Pure red (1,0,0) -> (tr,tg,tb); dark red (0.4,0,0) -> 0.4*(tr,tg,tb); pink (1,0.5,0.5) -> 0.5 + 0.5*(tr,tg,tb)
        const baseGray = minC;
        const redSpan = r - minC;
        const repR = baseGray + redSpan * p.tr;
        const repG = baseGray + redSpan * p.tg;
        const repB = baseGray + redSpan * p.tb;

        nr = r + (repR - r) * w;
        ng = g + (repG - g) * w;
        nb = b + (repB - b) * w;
      }
    }
  } else if (p.mode === "rgb_channels") {
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;
    if (chroma > 0.025) {
      const chromaWeight = chroma >= 0.08 ? 1 : (chroma - 0.025) / 0.055;
      // Channel dominance weights (pure R -> R, pure G -> G, pure B -> B, smooth blending in between)
      const rEx = Math.max(0, r - minC);
      const gEx = Math.max(0, g - minC);
      const bEx = Math.max(0, b - minC);
      const sumEx = rEx + gEx + bEx;
      if (sumEx > 1e-5) {
        const wR = rEx / sumEx;
        const wG = gEx / sumEx;
        const wB = bEx / sumEx;
        const mixR = wR * p.rCol[0] + wG * p.gCol[0] + wB * p.bCol[0];
        const mixG = wR * p.rCol[1] + wG * p.gCol[1] + wB * p.bCol[1];
        const mixB = wR * p.rCol[2] + wG * p.gCol[2] + wB * p.bCol[2];
        const repR = minC + chroma * mixR;
        const repG = minC + chroma * mixG;
        const repB = minC + chroma * mixB;
        const w = chromaWeight * p.strength;
        nr = r + (repR - r) * w;
        ng = g + (repG - g) * w;
        nb = b + (repB - b) * w;
      }
    }
  } else if (p.mode === "tint") {
    // Ink-preserving luminance multiply (keeps black linework crisp, colors fills richly!)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Slight highlight lift so mid-grays don't crush too dark when tinted with saturated hues
    const repR = lum * p.tr;
    const repG = lum * p.tg;
    const repB = lum * p.tb;
    const w = p.strength;
    nr = r + (repR - r) * w;
    ng = g + (repG - g) * w;
    nb = b + (repB - b) * w;
  } else if (p.mode === "universal" && p.hasTintHex && p.strength > 0.005) {
    // Luminance-preserving tint blend for ANY full-color asset (never washes out black ink!)
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Hybrid multiply + luminance-matched colorize so dark outlines stay sharp and rich tones pop
    const mulR = r * p.tr;
    const mulG = g * p.tg;
    const mulB = b * p.tb;
    const colR = Math.min(1, lum * 1.12 * p.tr);
    const colG = Math.min(1, lum * 1.12 * p.tg);
    const colB = Math.min(1, lum * 1.12 * p.tb);
    const blendedR = mulR * 0.42 + colR * 0.58;
    const blendedG = mulG * 0.42 + colG * 0.58;
    const blendedB = mulB * 0.42 + colB * 0.58;
    nr = r + (blendedR - r) * p.strength;
    ng = g + (blendedG - g) * p.strength;
    nb = b + (blendedB - b) * p.strength;
  }

  // Optional Fine Studio Grade (Hue Shift, Saturation, Brightness, Contrast)
  if (p.hasGrade) {
    if (Math.abs(p.hueShiftTurns) > 0.001 || Math.abs(p.saturation - 1) > 0.01) {
      const [h, s, l] = rgbToHsl(clamp01(nr), clamp01(ng), clamp01(nb));
      const nh = (((h + p.hueShiftTurns) % 1) + 1) % 1;
      const ns = clamp01(s * p.saturation);
      [nr, ng, nb] = hslToRgb(nh, ns, l);
    }
    if (Math.abs(p.brightness - 1) > 0.01) {
      nr *= p.brightness;
      ng *= p.brightness;
      nb *= p.brightness;
    }
    if (Math.abs(p.contrast - 1) > 0.01) {
      nr = (nr - 0.5) * p.contrast + 0.5;
      ng = (ng - 0.5) * p.contrast + 0.5;
      nb = (nb - 0.5) * p.contrast + 0.5;
    }
  }

  return [clamp01(nr), clamp01(ng), clamp01(nb)];
}

export function isRecolorActive(
  recolor: RgbRecolor | undefined,
  asset?: VaultAsset | null,
): boolean {
  if (!recolor || !recolor.enabled) return false;
  const p = compileShaderParams(recolor, asset);
  if (p.mode === "dd_red" || p.mode === "rgb_channels" || p.mode === "tint") {
    return p.strength > 0.005 || p.hasGrade;
  }
  return (p.hasTintHex && p.strength > 0.005) || p.hasGrade;
}

export function getRecolorCacheKey(
  url: string,
  recolor: RgbRecolor | undefined,
  asset?: VaultAsset | null,
): string {
  if (!isRecolorActive(recolor, asset) || !recolor) return url;
  const mode = resolveEffectiveRecolorMode(recolor, asset);
  const str = Math.round((recolor.strength ?? (mode === "universal" ? 0.62 : 1)) * 100);
  const hue = Math.round(recolor.hueShift ?? 0);
  const sat = Math.round((recolor.saturation ?? 1) * 100);
  const bri = Math.round((recolor.brightness ?? 1) * 100);
  const con = Math.round((recolor.contrast ?? 1) * 100);
  if (mode === "rgb_channels") {
    return `${url}|rgb|${recolor.channelR}|${recolor.channelG}|${recolor.channelB}|${str}|${hue}|${sat}|${bri}|${con}`;
  }
  return `${url}|${mode}|${recolor.tintHex}|${str}|${hue}|${sat}|${bri}|${con}`;
}

// Fast LRU processed-texture cache (avoids recomputing pixel shaders across 60 FPS frames!)
const MAX_CACHE_ENTRIES = 640;
const processedCache = new Map<string, HTMLCanvasElement>();

export function clearRecolorCache(): void {
  processedCache.clear();
}

export function getProcessedTexture(
  img: HTMLImageElement,
  url: string,
  recolor: RgbRecolor | undefined,
  asset?: VaultAsset | null,
  maxSidePx = 768,
): HTMLImageElement | HTMLCanvasElement {
  if (!recolor || !isRecolorActive(recolor, asset)) return img;
  if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) return img;

  const key = `${getRecolorCacheKey(url, recolor, asset)}@${maxSidePx}`;
  const cached = processedCache.get(key);
  if (cached) {
    // Refresh LRU order
    processedCache.delete(key);
    processedCache.set(key, cached);
    return cached;
  }

  const scale = Math.min(1, maxSidePx / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d", { willReadFrequently: true });
  if (!octx) return img;

  octx.drawImage(img, 0, 0, w, h);

  try {
    const imgData = octx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const params = compileShaderParams(recolor, asset);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const [nr, ng, nb] = recolorPixelRgb01(
        data[i] / 255,
        data[i + 1] / 255,
        data[i + 2] / 255,
        params,
      );
      data[i] = Math.round(nr * 255);
      data[i + 1] = Math.round(ng * 255);
      data[i + 2] = Math.round(nb * 255);
    }
    octx.putImageData(imgData, 0, 0);
  } catch {
    // Fallback gracefully if an external untrusted URL taints canvas
    return img;
  }

  if (processedCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = processedCache.keys().next().value;
    if (oldest !== undefined) processedCache.delete(oldest);
  }
  processedCache.set(key, out);
  return out;
}

/**
 * Generates subtle natural hue & brightness variation per stamped object when Color Jitter is active
 * (ideal for organic clusters of mushrooms, foliage, awnings, rugs, or crowd clutter).
 */
export function applyStampColorJitter(
  base: RgbRecolor,
  enabled: boolean,
): RgbRecolor {
  if (!enabled) return { ...base };
  const hueDelta = Math.round((Math.random() - 0.5) * 26); // +-13 deg
  const brightDelta = Math.round((Math.random() - 0.5) * 16) / 100; // +-0.08
  return {
    ...base,
    enabled: true,
    hueShift: Math.max(-180, Math.min(180, (base.hueShift ?? 0) + hueDelta)),
    brightness: Math.max(0.35, Math.min(1.75, (base.brightness ?? 1) + brightDelta)),
  };
}

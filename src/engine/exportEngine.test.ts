import { describe, expect, it } from "vitest";
import { createFunicularShowcaseMap } from "@/data/funicularShowcaseMap";
import {
  buildExportFolderTreePreview,
  computeExportDimensions,
  createLevelSnapshotDoc,
  resolveBatchJobs,
  resolveDaylightPresetId,
  resolveExportEntry,
  sanitizePathSegment,
  sortLevelsBottomUp,
  type ExportJobConfig,
} from "./exportEngine";
import { writeBlobToDirectoryPath, type DirectoryHandleLike } from "./fileSaveService";

const BASE_CONFIG: ExportJobConfig = {
  preset: "tv",
  tvDiagonalInches: 55,
  tvResWidth: 3840,
  tvResHeight: 2160,
  imagePpi: 256,
  upscaleFactor: 1,
  sharpenUpscale: true,
  imageFormat: "png",
  pdfPaper: "letter",
  includeGrid: true,
  variantPlayer: true,
  variantDm: false,
  variantDayNight: false,
  variantUvtt: false,
  variantRoofs: false,
  tileSizePx: 2048,
};

describe("exportEngine — Upscale, Aspect Ratio & Batch Variants", () => {
  it("preserves exact 16:9 aspect ratio even when 2x Upscale clamps at browser GPU ceiling", () => {
    const dims = computeExportDimensions(48, 27, 256, 2, 12288);
    expect(dims.clamped).toBe(true);
    expect(dims.width).toBe(12288);
    expect(dims.height).toBe(6912); // exact 48:27 ratio, zero black bar!
    expect(dims.width / dims.height).toBeCloseTo(48 / 27, 4);
    expect(dims.pixelsPerCell).toBeCloseTo(256, 2);
  });

  it("scales 55-inch 4K TV cleanly by 1.5x and 2x without clamping", () => {
    const d15 = computeExportDimensions(48, 27, 80.11, 1.5);
    expect(d15.clamped).toBe(false);
    expect(d15.width).toBeCloseTo(5768, -1);
    expect(d15.height).toBeCloseTo(3244, -1);

    const d2 = computeExportDimensions(48, 27, 80.11, 2);
    expect(d2.clamped).toBe(false);
    expect(d2.width).toBeCloseTo(7691, -1);
    expect(d2.height).toBeCloseTo(4326, -1);
  });

  it("resolves the true daylight preset ('overcast') on the Berlin Funicular showcase map", () => {
    const doc = createFunicularShowcaseMap();
    expect(resolveDaylightPresetId(doc)).toBe("overcast");
  });

  it("respects variantPlayer=false and tags upscaled batch filenames cleanly", () => {
    const doc = createFunicularShowcaseMap();
    const jobs = resolveBatchJobs(doc, {
      ...BASE_CONFIG,
      preset: "image",
      upscaleFactor: 2,
      variantPlayer: false,
      variantDm: true,
      variantDayNight: true,
      variantRoofs: true,
    });
    expect(jobs.map((j) => j.suffix)).toEqual([
      "_2x_DM_Reference",
      "_2x_Daylight",
      "_2x_Roofs_Overlay",
    ]);
    expect(jobs[1].lightingPresetId).toBe("overcast");
  });

  it("exports all floors separately (transparent upper/roof/sky overlays) in bottom-to-top stacking order", () => {
    const doc = createFunicularShowcaseMap();
    const ordered = sortLevelsBottomUp(doc.levels);
    expect(ordered.map((l) => l.shortCode)).toEqual([
      "B1",
      "1F",
      "2F",
      "ROOF",
      "Sky 1",
      "Sky 2",
      "Sky 3",
    ]);

    const jobs = resolveBatchJobs(doc, {
      ...BASE_CONFIG,
      preset: "image",
      floorScope: "all_separate",
      variantPlayer: true,
      variantRoofs: true, // skipped automatically when all floors are exported
    });

    expect(jobs).toHaveLength(7);
    expect(jobs.map((j) => j.suffix)).toEqual([
      "_01_B1_-12ft_Layer_Player",
      "_02_1F_+0ft_Layer_Player",
      "_03_2F_+12ft_Layer_Player",
      "_04_ROOF_+24ft_Layer_Player",
      "_05_Sky1_+38ft_Layer_Player",
      "_06_Sky2_+48ft_Layer_Player",
      "_07_Sky3_+60ft_Layer_Player",
    ]);
    // B1 and 1F are opaque base maps; 2F, ROOF & SKY decks export with transparent alpha!
    expect(jobs.map((j) => Boolean(j.requiresAlpha))).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(jobs.every((j) => Boolean(j.isolatedLevelId))).toBe(true);
  });

  it("exports selected floors stacked (composited) with exact Elevator Shaft visibility", () => {
    const doc = createFunicularShowcaseMap();
    const skyIds = doc.levels.filter((l) => l.kind === "sky").map((l) => l.id);
    const jobs = resolveBatchJobs(doc, {
      ...BASE_CONFIG,
      preset: "tv",
      floorScope: "all_stacked",
      selectedLevelIds: skyIds,
      variantPlayer: true,
    });

    expect(jobs).toHaveLength(3);
    expect(jobs.every((j) => Boolean(j.stackedLevelId) && !j.requiresAlpha)).toBe(true);
    expect(jobs.map((j) => j.levelShortCode)).toEqual(["Sky 1", "Sky 2", "Sky 3"]);

    // Verify stacked snapshot visibility for Sky 3 shows 1F + ROOF + Sky 2 + Sky 3 (and hides Sky 1!)
    const snapU = createLevelSnapshotDoc(doc, "lvl-sky-upper");
    const visCodes = snapU.levels.filter((l) => l.visible).map((l) => l.shortCode);
    expect(visCodes).toEqual(["1F", "ROOF", "Sky 2", "Sky 3"]);
  });

  it("organizes exported files into clean nested folders by View/Light, File Type, Floor, Flat-in-Map, or legacy Flat", () => {
    const doc = createFunicularShowcaseMap();
    const multiConfig: ExportJobConfig = {
      ...BASE_CONFIG,
      preset: "tv",
      floorScope: "all_stacked",
      selectedLevelIds: ["lvl-ground", "lvl-roofs"],
      variantPlayer: true,
      variantDm: true,
      variantDayNight: true,
      variantUvtt: true,
      outputMode: "zip",
      includeMapRootFolder: true,
    };

    // 1. By View & Lighting (Player / Daylight / DM_Reference / VTT)
    const byRoleTree = buildExportFolderTreePreview(doc, {
      ...multiConfig,
      folderStructure: "by_role",
    });
    expect(byRoleTree.totalFiles).toBe(8);
    expect(byRoleTree.groups.map((g) => g.folderPath)).toEqual([
      "Berlin_Magipunk_Funicular_4K_55in/Player/",
      "Berlin_Magipunk_Funicular_4K_55in/DM_Reference/",
      "Berlin_Magipunk_Funicular_4K_55in/Daylight/",
      "Berlin_Magipunk_Funicular_4K_55in/VTT/",
    ]);
    expect(byRoleTree.groups.every((g) => g.files.length === 2)).toBe(true);

    // 2. By File Type (PNG / VTT_dd2vtt)
    const byTypeTree = buildExportFolderTreePreview(doc, {
      ...multiConfig,
      folderStructure: "by_file_type",
    });
    expect(byTypeTree.groups.map((g) => g.folderPath)).toEqual([
      "Berlin_Magipunk_Funicular_4K_55in/PNG/",
      "Berlin_Magipunk_Funicular_4K_55in/VTT_dd2vtt/",
    ]);
    expect(byTypeTree.groups[0].files).toHaveLength(6);
    expect(byTypeTree.groups[1].files).toHaveLength(2);

    // 3. By Floor / Level (01_1F_+0ft / 02_ROOF_+24ft)
    const byFloorTree = buildExportFolderTreePreview(doc, {
      ...multiConfig,
      folderStructure: "by_floor",
    });
    expect(byFloorTree.groups.map((g) => g.folderPath)).toEqual([
      "Berlin_Magipunk_Funicular_4K_55in/01_1F_+0ft/",
      "Berlin_Magipunk_Funicular_4K_55in/02_ROOF_+24ft/",
    ]);
    expect(byFloorTree.groups[0].files).toHaveLength(4);
    expect(byFloorTree.groups[1].files).toHaveLength(4);

    // 4. Flat inside Map folder (and without Map root folder)
    const flatInMap = buildExportFolderTreePreview(doc, {
      ...multiConfig,
      folderStructure: "flat_in_map",
      includeMapRootFolder: true,
    });
    expect(flatInMap.groups).toHaveLength(1);
    expect(flatInMap.groups[0].folderPath).toBe("Berlin_Magipunk_Funicular_4K_55in/");

    const noRoot = buildExportFolderTreePreview(doc, {
      ...multiConfig,
      folderStructure: "by_role",
      includeMapRootFolder: false,
    });
    expect(noRoot.groups.map((g) => g.folderPath)).toEqual([
      "Player/",
      "DM_Reference/",
      "Daylight/",
      "VTT/",
    ]);

    // 5. Legacy Flat mode ("all in one folder as it is now") has zero subfolder segments
    const jobs = resolveBatchJobs(doc, { ...multiConfig, outputMode: "flat" });
    const entry = resolveExportEntry("My:Weird/Map*Name...", jobs[0], {
      ...multiConfig,
      outputMode: "flat",
    });
    expect(entry.folderSegments).toEqual([]);
    expect(sanitizePathSegment("My:Weird/Map*Name...")).toBe("My_Weird_Map_Name");
  });

  it("writes nested subdirectories and blobs cleanly through DirectoryHandleLike", async () => {
    const writtenFiles = new Map<string, Blob>();
    const makeDir = (prefix: string): DirectoryHandleLike => ({
      name: prefix || "root",
      getDirectoryHandle: async (name) => makeDir(prefix ? `${prefix}/${name}` : name),
      getFileHandle: async (name) => ({
        name,
        createWritable: async () => {
          let latest: Blob | null = null;
          return {
            write: async (data) => {
              latest = data instanceof Blob ? data : new Blob([data]);
            },
            close: async () => {
              if (latest) {
                writtenFiles.set(prefix ? `${prefix}/${name}` : name, latest);
              }
            },
          };
        },
      }),
    });

    const root = makeDir("");
    await writeBlobToDirectoryPath(
      root,
      ["Berlin_Magirail_Station", "DM_Reference"],
      "Berlin_1F_DM.png",
      new Blob(["png-bytes"]),
    );
    expect(writtenFiles.has("Berlin_Magirail_Station/DM_Reference/Berlin_1F_DM.png")).toBe(true);
  });
});

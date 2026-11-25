/**
 * Local-first File System Access service for native Save-As location picking,
 * in-place Save, Open-with-Handle, and automatic disk-backed Auto-Save.
 *
 * Keeps non-serializable FileSystemFileHandle instances out of Zustand state /
 * localStorage while exposing clean metadata (fileName) per document tab.
 */

export interface SaveFileHandleLike {
  name: string;
  createWritable: () => Promise<{
    write: (data: string | Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
  getFile?: () => Promise<File>;
}

export interface DirectoryHandleLike {
  name: string;
  getDirectoryHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<DirectoryHandleLike>;
  getFileHandle: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<SaveFileHandleLike>;
}

interface PickerWindow extends Window {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<SaveFileHandleLike>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<SaveFileHandleLike[]>;
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: "read" | "readwrite";
    startIn?: string;
  }) => Promise<DirectoryHandleLike>;
}

const handlesByDocId = new Map<string, SaveFileHandleLike>();

export function supportsNativeFilePicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as PickerWindow).showSaveFilePicker === "function"
  );
}

export function supportsNativeDirectoryPicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as PickerWindow).showDirectoryPicker === "function"
  );
}

export function getBoundFileHandle(docId: string): SaveFileHandleLike | undefined {
  return handlesByDocId.get(docId);
}

export function bindFileHandle(docId: string, handle: SaveFileHandleLike): void {
  handlesByDocId.set(docId, handle);
}

export function unbindFileHandle(docId: string): void {
  handlesByDocId.delete(docId);
}

export async function pickSaveFileLocation(
  suggestedName: string,
): Promise<{ status: "picked"; handle: SaveFileHandleLike } | { status: "cancelled" } | { status: "unsupported" }> {
  const win = typeof window !== "undefined" ? (window as PickerWindow) : undefined;
  if (!win || typeof win.showSaveFilePicker !== "function") {
    return { status: "unsupported" };
  }
  try {
    const handle = await win.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: "Dice Chaos Map Project (.dcmap)",
          accept: { "application/json": [".dcmap"] },
        },
      ],
    });
    return { status: "picked", handle };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return { status: "cancelled" };
    }
    throw err;
  }
}

export async function pickOpenMapFile(): Promise<
  | { status: "picked"; handle: SaveFileHandleLike; fileName: string; bytes: Uint8Array; text?: string }
  | { status: "cancelled" }
  | { status: "unsupported" }
> {
  const win = typeof window !== "undefined" ? (window as PickerWindow) : undefined;
  if (!win || typeof win.showOpenFilePicker !== "function") {
    return { status: "unsupported" };
  }
  try {
    const [handle] = await win.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "Maps (.dcmap, .wonderdraft_map, .dungeondraft_map)",
          accept: {
            "application/json": [".dcmap", ".json", ".dungeondraft_map"],
            "application/octet-stream": [".wonderdraft_map"],
          },
        },
      ],
    });
    if (!handle || !handle.getFile) return { status: "cancelled" };
    const file = await handle.getFile();
    const fileName = file.name || handle.name;
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const isDcMap = /\.dcmap$/i.test(fileName);
    const text = isDcMap ? new TextDecoder("utf-8").decode(bytes) : undefined;
    return { status: "picked", handle, fileName, bytes, text };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return { status: "cancelled" };
    }
    throw err;
  }
}

export async function writeJsonToHandle(
  handle: SaveFileHandleLike,
  jsonText: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(jsonText);
  await writable.close();
}

export function triggerFallbackDownload(filename: string, jsonText: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Opens the native OS folder picker (File System Access API) to export organized
 * nested map folders directly onto disk. Must be called synchronously inside a user click gesture.
 */
export async function pickExportDirectory(): Promise<
  | { status: "picked"; handle: DirectoryHandleLike }
  | { status: "cancelled" }
  | { status: "unsupported" }
> {
  const win = typeof window !== "undefined" ? (window as PickerWindow) : undefined;
  if (!win || typeof win.showDirectoryPicker !== "function") {
    return { status: "unsupported" };
  }
  try {
    const handle = await win.showDirectoryPicker({
      id: "dice-chaos-maps-export",
      mode: "readwrite",
    });
    return { status: "picked", handle };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      return { status: "cancelled" };
    }
    throw err;
  }
}

/**
 * Writes a Blob into a nested folder path under `rootDir`, automatically creating
 * any missing subdirectories along `folderSegments`.
 */
export async function writeBlobToDirectoryPath(
  rootDir: DirectoryHandleLike,
  folderSegments: string[],
  fileName: string,
  blob: Blob,
): Promise<void> {
  let curDir = rootDir;
  for (const seg of folderSegments) {
    if (!seg) continue;
    curDir = await curDir.getDirectoryHandle(seg, { create: true });
  }
  const fileHandle = await curDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

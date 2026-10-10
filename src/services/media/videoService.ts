import { inTauri, invoke } from "@/lib/tauri";
import type { FitStrategy, PlatformId, VideoAsset } from "@/types";

interface ProbeResult {
  width: number;
  height: number;
  durationS: number;
  sizeBytes: number;
}

/** Reads dimensions from the browser's decoder; good enough for previews. */
export function probeInBrowser(url: string): Promise<Pick<ProbeResult, "width" | "height" | "durationS">> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight, durationS: v.duration });
    v.onerror = () => reject(new Error("This file can't be decoded for preview. Try an MP4 or MOV."));
    v.src = url;
  });
}

export async function loadFile(file: File): Promise<VideoAsset> {
  const objectUrl = URL.createObjectURL(file);
  const meta = await probeInBrowser(objectUrl);
  return { name: file.name, objectUrl, sizeBytes: file.size, ...meta };
}

/** Desktop: ffprobe gives the authoritative, rotation-corrected size. */
export async function loadPath(path: string, previewUrl: string): Promise<VideoAsset> {
  const info = await invoke<ProbeResult>("media_probe", { path });
  return { name: path.split(/[\\/]/).pop() ?? path, path, objectUrl: previewUrl, ...info };
}

export interface FormatPlan {
  strategy: "passthrough" | "scale" | "crop" | "blur-pad" | "letterbox";
  crop: [number, number, number, number] | null;
  trimToS: number | null;
  args: string[];
}

export async function planFor(path: string, platform: PlatformId, shortForm: boolean, strategy: FitStrategy) {
  if (!inTauri) return null;
  return invoke<FormatPlan>("media_plan", { path, platform, shortForm, strategy });
}

/** Mirrors `media::plan::resolve` in Rust so previews match the encoder. */
export function resolveStrategy(srcW: number, srcH: number, dstW: number, dstH: number, s: FitStrategy) {
  const src = srcW / srcH;
  const dst = dstW / dstH;
  const off = Math.abs(src - dst) / dst;
  if (off < 0.01) return srcW === dstW && srcH === dstH ? "passthrough" : "scale";
  if (s !== "auto") return s;
  return off <= 0.2 ? "crop" : "blur-pad";
}

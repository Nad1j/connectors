import { AnimatePresence, motion } from "framer-motion";
import { Film, UploadCloud, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useAppStore } from "@/store/useAppStore";
import { inTauri } from "@/lib/tauri";
import { bytes, cn, duration } from "@/lib/utils";
import { loadFile, loadPath } from "@/services/media/videoService";

const VIDEO_EXT = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;

export function VideoDropzone() {
  const { draft, setVideo } = useAppStore();
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // Desktop: the OS drop gives real file paths, which FFmpeg needs.
  useEffect(() => {
    if (!inTauri) return;
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent(async (e) => {
        if (e.payload.type === "enter" || e.payload.type === "over") setOver(true);
        else if (e.payload.type === "leave") setOver(false);
        else if (e.payload.type === "drop") {
          setOver(false);
          const path = e.payload.paths.find((p) => VIDEO_EXT.test(p));
          if (!path) return setError("Drop a video file: MP4, MOV, WebM or MKV.");
          try {
            setError(null);
            setVideo(await loadPath(path, convertFileSrc(path)));
          } catch (err) {
            setError(String(err));
          }
        }
      })
      .then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, [setVideo]);

  async function accept(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("video/") && !VIDEO_EXT.test(file.name)) {
      return setError("Drop a video file: MP4, MOV, WebM or MKV.");
    }
    try {
      setError(null);
      setVideo(await loadFile(file));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  const v = draft.video;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {v ? (
        <motion.div
          key="loaded"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="flex items-center gap-4 rounded-2xl border border-line bg-white/[0.02] p-3"
        >
          <video src={v.objectUrl} muted className="h-16 w-28 rounded-lg bg-black object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{v.name}</p>
            <p className="num mt-1 text-xs text-ink-mute">
              {v.width}×{v.height} · {duration(v.durationS)} · {bytes(v.sizeBytes)}
              {!v.path && inTauri && " · preview only"}
            </p>
          </div>
          <button
            onClick={() => setVideo(null)}
            className="rounded-lg p-2 text-ink-mute hover:bg-white/5 hover:text-ink"
            aria-label="Remove video"
          >
            <X size={16} />
          </button>
        </motion.div>
      ) : (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            accept(e.dataTransfer.files[0]);
          }}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          role="button"
          tabIndex={0}
          className={cn(
            "group relative flex h-44 cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed transition-colors",
            over ? "border-ion bg-ion/[0.08]" : "border-ion/25 bg-white/[0.015] hover:border-ion/50",
          )}
        >
          <div className="pointer-events-none absolute inset-0 bg-grid bg-[size:28px_28px] opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
          <motion.div
            animate={over ? { y: -4, scale: 1.08 } : { y: 0, scale: 1 }}
            className="relative grid h-12 w-12 place-items-center rounded-2xl border border-ion/30 bg-ion/10 text-ion shadow-glow"
          >
            {over ? <Film size={22} /> : <UploadCloud size={22} />}
          </motion.div>
          <div className="relative text-center">
            <p className="text-sm text-ink">{over ? "Release to add" : "Drop a video, or click to choose"}</p>
            <p className="mt-1 text-xs text-ink-mute">One source file. Every platform gets its own cut.</p>
          </div>
          {error && <p className="relative text-xs text-flare">{error}</p>}
          <input ref={input} type="file" accept="video/*" hidden onChange={(e) => accept(e.target.files?.[0])} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

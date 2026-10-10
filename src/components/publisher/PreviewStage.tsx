import { AnimatePresence, motion } from "framer-motion";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { PLATFORMS, targetFor } from "@/config/platforms";
import { useAppStore } from "@/store/useAppStore";
import { resolveStrategy } from "@/services/media/videoService";
import { cn, duration } from "@/lib/utils";
import type { FitStrategy, PlatformId } from "@/types";

const FRAME_H = 300;

const STRATEGY_LABEL: Record<string, string> = {
  passthrough: "Already fits",
  scale: "Resize only",
  crop: "Center crop",
  "blur-pad": "Blurred fill",
  letterbox: "Black bars",
};

/** Side-by-side cuts: each frame renders the source exactly as the encoder will adapt it. */
export function PreviewStage() {
  const { draft } = useAppStore();

  if (draft.platforms.length === 0) {
    return (
      <div className="grid h-[340px] place-items-center rounded-2xl border border-dashed border-line text-sm text-ink-mute">
        Pick at least one platform to preview its cut.
      </div>
    );
  }

  return (
    <div className="flex items-start gap-5 overflow-x-auto pb-2">
      <AnimatePresence initial={false}>
        {draft.platforms.map((id) => (
          <PreviewFrame key={id} id={id} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function PreviewFrame({ id }: { id: PlatformId }) {
  const { draft, setStrategy } = useAppStore();
  const spec = PLATFORMS[id];
  const t = targetFor(id, draft.shortForm);
  const width = Math.round((FRAME_H * t.w) / t.h);
  const v = draft.video;
  const resolved = v ? resolveStrategy(v.width, v.height, t.w, t.h, draft.strategy[id]) : null;
  const vertical = t.h > t.w;
  const overLimit = v && v.durationS > t.maxS;

  return (
    <motion.figure
      layout
      initial={{ opacity: 0, scale: 0.94, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="shrink-0"
    >
      <div
        className="relative overflow-hidden rounded-[18px] border bg-black"
        style={{ width, height: FRAME_H, borderColor: `${spec.color}40`, boxShadow: `0 0 0 1px rgba(0,0,0,.4), 0 18px 40px -20px ${spec.color}80` }}
      >
        {v ? (
          <>
            {resolved === "blur-pad" && (
              <video src={v.objectUrl} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl brightness-75" />
            )}
            <video
              src={v.objectUrl}
              autoPlay
              muted
              loop
              playsInline
              className={cn(
                "absolute inset-0 h-full w-full",
                resolved === "crop" || resolved === "scale" || resolved === "passthrough" ? "object-cover" : "object-contain",
              )}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(108,140,255,.22),transparent_60%),radial-gradient(ellipse_at_80%_90%,rgba(62,230,196,.14),transparent_55%)]">
            <div className="absolute inset-0 bg-grid bg-[size:22px_22px] opacity-50" />
            <p className="num absolute inset-0 grid place-items-center text-xs text-ink-mute">
              {t.w}×{t.h}
            </p>
          </div>
        )}

        {vertical ? <ShortOverlay id={id} /> : <LongOverlay id={id} />}
      </div>

      <figcaption className="mt-3 space-y-2" style={{ width }}>
        <div className="flex items-center gap-2">
          <PlatformIcon id={id} size={15} />
          <span className="whitespace-nowrap text-xs text-ink-soft">{t.label}</span>
          <span className="num ml-auto text-[10.5px] text-ink-mute">
            {t.w}×{t.h}
          </span>
        </div>
        <label className="sr-only" htmlFor={`fit-${id}`}>
          How to fit the video for {spec.name}
        </label>
        <select
          id={`fit-${id}`}
          value={draft.strategy[id]}
          onChange={(e) => setStrategy(id, e.target.value as FitStrategy)}
          className="h-8 w-full rounded-lg border border-line bg-panel px-2 text-[11px] text-ink-soft outline-none hover:border-ion/40"
        >
          <option value="auto">Auto{resolved && draft.strategy[id] === "auto" ? ` · ${STRATEGY_LABEL[resolved]}` : ""}</option>
          <option value="crop">Center crop</option>
          <option value="blur-pad">Blurred fill</option>
          <option value="letterbox">Black bars</option>
        </select>
      </figcaption>
      {overLimit && (
        <p className="num mt-1.5 text-[11px] text-amber">Will be trimmed to {duration(t.maxS)}</p>
      )}
    </motion.figure>
  );
}

function ShortOverlay({ id }: { id: PlatformId }) {
  const { title, caption, hashtags } = useAppStore((s) => s.draft);
  const acct = useAppStore((s) => s.accounts.find((a) => a.platform === id));
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-transparent to-transparent p-3">
      <div className="absolute bottom-16 right-2 flex flex-col items-center gap-3 text-white/90">
        <Heart size={18} />
        <MessageCircle size={18} />
        <Share2 size={18} />
      </div>
      <p className="text-[11px] font-semibold text-white">{acct?.handle}</p>
      <p className="mt-0.5 line-clamp-2 pr-8 text-[10.5px] leading-snug text-white/85">
        {title || caption || "Your caption shows here"}
        {hashtags.length > 0 && <span className="text-white/60"> {hashtags.slice(0, 3).map((h) => `#${h}`).join(" ")}</span>}
      </p>
    </div>
  );
}

function LongOverlay({ id }: { id: PlatformId }) {
  const title = useAppStore((s) => s.draft.title);
  const v = useAppStore((s) => s.draft.video);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
      <p className="line-clamp-1 text-[12px] font-medium text-white">{title || "Your title shows here"}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-0.5 flex-1 rounded bg-white/25">
          <div className="h-full w-1/3 rounded" style={{ background: PLATFORMS[id].color }} />
        </div>
        <span className="num text-[10px] text-white/70">{v ? duration(v.durationS) : "0:00"}</span>
      </div>
    </div>
  );
}

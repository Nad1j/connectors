import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, X } from "lucide-react";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { ProgressBar } from "@/components/ui/Progress";
import { PLATFORMS } from "@/config/platforms";
import { useAppStore } from "@/store/useAppStore";
import { cancel } from "@/services/publish/pipeline";
import type { PlatformJobState, PublishJob } from "@/types";

const ACTIVE = new Set(["queued", "processing", "uploading", "finalizing"]);

export function UploadQueue() {
  const jobs = useAppStore((s) => s.jobs);

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {jobs.length === 0 && (
          <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-6 text-center text-xs text-ink-mute">
            Uploads show here with live progress for each platform.
          </motion.p>
        )}
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function JobCard({ job }: { job: PublishJob }) {
  const dismiss = useAppStore((s) => s.dismissJob);
  const states = Object.values(job.platforms);
  const running = states.some((s) => ACTIVE.has(s.stage));
  const done = states.filter((s) => s.stage === "published").length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      className="rounded-xl border border-line bg-white/[0.02] p-3.5"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm">{job.title}</p>
          <p className="num text-[11px] text-ink-mute">
            {done}/{states.length} published
          </p>
        </div>
        {running ? (
          <button onClick={() => cancel(job.id)} className="rounded-lg px-2 py-1 text-[11px] text-ink-mute hover:bg-flare/10 hover:text-flare">
            Cancel
          </button>
        ) : (
          <button onClick={() => dismiss(job.id)} className="rounded-lg p-1 text-ink-mute hover:bg-white/5" aria-label="Dismiss">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        {states.map((s) => (
          <PlatformRow key={s.platform} s={s} />
        ))}
      </div>
    </motion.div>
  );
}

function PlatformRow({ s }: { s: PlatformJobState }) {
  const spec = PLATFORMS[s.platform];
  return (
    <div className="grid grid-cols-[18px_1fr_auto] items-center gap-x-2.5 gap-y-1">
      <PlatformIcon id={s.platform} size={16} />
      <ProgressBar value={s.progress} color={spec.color} done={s.stage === "published"} />
      <span className="flex w-14 justify-end">
        {s.stage === "published" ? (
          <a href={s.postUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] text-aurora hover:underline">
            <CheckCircle2 size={12} /> View <ExternalLink size={10} />
          </a>
        ) : s.stage === "failed" ? (
          <AlertTriangle size={13} className="text-flare" />
        ) : ACTIVE.has(s.stage) ? (
          <span className="num text-[11px] text-ink-soft">{Math.round(s.progress * 100)}%</span>
        ) : (
          <span className="text-[11px] capitalize text-ink-mute">{s.stage}</span>
        )}
      </span>
      <span />
      <p className="col-span-2 flex items-center gap-1.5 truncate text-[10.5px] text-ink-mute">
        {ACTIVE.has(s.stage) && <Loader2 size={10} className="animate-spin" />}
        {s.message}
      </p>
    </div>
  );
}

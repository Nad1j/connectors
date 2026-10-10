import { inTauri, invoke, listen } from "@/lib/tauri";
import { useAppStore } from "@/store/useAppStore";
import type { FitStrategy, PlatformId, ProgressEvent, PublishJob, Stage } from "@/types";

export interface PublishInput {
  videoPath?: string;
  platforms: PlatformId[];
  shortForm: boolean;
  strategy: Record<PlatformId, FitStrategy>;
  title: string;
  caption: string;
  hashtags: string[];
  scheduleAt?: string;
}

let wired = false;

/** Subscribe once to backend progress events and fold them into the store. */
export async function wireProgressEvents() {
  if (wired) return;
  wired = true;
  await listen<ProgressEvent>("publish://progress", (e) => useAppStore.getState().applyProgress(e));
}

export async function submit(input: PublishInput): Promise<string> {
  const { addJob } = useAppStore.getState();
  const request = {
    videoPath: input.videoPath ?? "",
    targets: input.platforms.map((platform) => ({
      platform,
      shortForm: input.shortForm,
      strategy: input.strategy[platform],
    })),
    title: input.title,
    caption: input.caption,
    hashtags: input.hashtags,
    scheduleAt: input.scheduleAt ?? null,
  };

  const jobId = inTauri ? await invoke<string>("publish_submit", { request }) : crypto.randomUUID();
  const job: PublishJob = {
    id: jobId,
    title: input.title || "Untitled post",
    createdAt: Date.now(),
    platforms: Object.fromEntries(
      input.platforms.map((p) => [p, { platform: p, stage: "queued" as Stage, progress: 0, message: "Waiting for a slot" }]),
    ),
  };
  addJob(job);
  if (!inTauri) simulate(jobId, input);
  return jobId;
}

export async function cancel(jobId: string) {
  if (inTauri) return invoke<boolean>("publish_cancel", { jobId });
  cancelled.add(jobId);
  return true;
}

// ---- Browser preview: same event stream the Rust queue produces -------------

const cancelled = new Set<string>();
const SPEED: Record<PlatformId, number> = { youtube: 0.018, tiktok: 0.03, instagram: 0.024, facebook: 0.02, x: 0.035 };

function simulate(jobId: string, input: PublishInput) {
  const emit = (e: Omit<ProgressEvent, "jobId">) => useAppStore.getState().applyProgress({ jobId, ...e });
  input.platforms.forEach((platform, i) => {
    if (input.scheduleAt) {
      emit({ platform, stage: "scheduled", progress: 0, message: `Scheduled for ${new Date(input.scheduleAt).toLocaleString()}` });
      return;
    }
    let p = 0;
    const tick = () => {
      if (cancelled.has(jobId)) return emit({ platform, stage: "cancelled", progress: p, message: "Cancelled" });
      p = Math.min(1, p + SPEED[platform] * (0.6 + Math.random() * 0.8));
      if (p < 0.35) emit({ platform, stage: "processing", progress: p, message: `Encoding ${Math.round((p / 0.35) * 100)}%` });
      else if (p < 0.98) emit({ platform, stage: "uploading", progress: p, message: `Uploading ${Math.round(((p - 0.35) / 0.63) * 100)}%` });
      if (p >= 1) {
        emit({ platform, stage: "finalizing", progress: 0.98, message: "Platform is processing the video" });
        setTimeout(() => emit({ platform, stage: "published", progress: 1, message: "Published", postUrl: "#" }), 700);
        return;
      }
      setTimeout(tick, 140);
    };
    setTimeout(tick, 300 + i * 450);
  });
}

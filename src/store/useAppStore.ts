import { create } from "zustand";
import type {
  Account,
  AiSuggestion,
  FitStrategy,
  PlatformId,
  ProgressEvent,
  PublishJob,
  ScheduledPost,
  VideoAsset,
  ViewId,
} from "@/types";
import { SEED_ACCOUNTS, SEED_SCHEDULE } from "@/services/mockData";

interface Draft {
  video: VideoAsset | null;
  platforms: PlatformId[];
  shortForm: boolean;
  strategy: Record<PlatformId, FitStrategy>;
  title: string;
  caption: string;
  hashtags: string[];
}

interface AppState {
  view: ViewId;
  setView: (v: ViewId) => void;

  accounts: Account[];
  setAccounts: (a: Account[]) => void;
  patchAccount: (p: PlatformId, patch: Partial<Account>) => void;

  draft: Draft;
  setVideo: (v: VideoAsset | null) => void;
  togglePlatform: (p: PlatformId) => void;
  setShortForm: (v: boolean) => void;
  setStrategy: (p: PlatformId, s: FitStrategy) => void;
  setCopy: (patch: Partial<Pick<Draft, "title" | "caption" | "hashtags">>) => void;
  applySuggestion: (s: AiSuggestion, titleIndex?: number) => void;
  resetDraft: () => void;

  jobs: PublishJob[];
  addJob: (job: PublishJob) => void;
  applyProgress: (e: ProgressEvent) => void;
  dismissJob: (id: string) => void;

  schedule: ScheduledPost[];
  addScheduled: (p: ScheduledPost) => void;
  moveScheduled: (id: string, at: string) => void;
}

const emptyDraft = (): Draft => ({
  video: null,
  platforms: ["youtube", "tiktok", "instagram"],
  shortForm: true,
  strategy: { youtube: "auto", tiktok: "auto", instagram: "auto", facebook: "auto", x: "auto" },
  title: "",
  caption: "",
  hashtags: [],
});

export const useAppStore = create<AppState>((set) => ({
  view: "publisher",
  setView: (view) => set({ view }),

  accounts: SEED_ACCOUNTS,
  setAccounts: (accounts) => set({ accounts }),
  patchAccount: (p, patch) =>
    set((s) => ({ accounts: s.accounts.map((a) => (a.platform === p ? { ...a, ...patch } : a)) })),

  draft: emptyDraft(),
  setVideo: (video) => set((s) => ({ draft: { ...s.draft, video } })),
  togglePlatform: (p) =>
    set((s) => {
      const has = s.draft.platforms.includes(p);
      return { draft: { ...s.draft, platforms: has ? s.draft.platforms.filter((x) => x !== p) : [...s.draft.platforms, p] } };
    }),
  setShortForm: (shortForm) => set((s) => ({ draft: { ...s.draft, shortForm } })),
  setStrategy: (p, strat) => set((s) => ({ draft: { ...s.draft, strategy: { ...s.draft.strategy, [p]: strat } } })),
  setCopy: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  applySuggestion: (sug, titleIndex = 0) =>
    set((s) => ({
      draft: { ...s.draft, title: sug.titles[titleIndex] ?? s.draft.title, caption: sug.caption, hashtags: sug.hashtags },
    })),
  resetDraft: () => set({ draft: emptyDraft() }),

  jobs: [],
  addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),
  applyProgress: (e) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id !== e.jobId
          ? j
          : {
              ...j,
              platforms: {
                ...j.platforms,
                [e.platform]: {
                  platform: e.platform,
                  stage: e.stage,
                  progress: e.progress,
                  message: e.message,
                  postUrl: e.postUrl ?? undefined,
                },
              },
            },
      ),
    })),
  dismissJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

  schedule: SEED_SCHEDULE,
  addScheduled: (p) => set((s) => ({ schedule: [...s.schedule, p] })),
  moveScheduled: (id, at) => set((s) => ({ schedule: s.schedule.map((p) => (p.id === id ? { ...p, at } : p)) })),
}));

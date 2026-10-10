import type { PlatformId } from "@/types";

export interface PlatformSpec {
  id: PlatformId;
  name: string;
  color: string;
  /** Format this platform gets for short-form posts. */
  short: { w: number; h: number; label: string; maxS: number };
  long?: { w: number; h: number; label: string; maxS: number };
  captionLimit: number;
  /** Local-time hours with historically strong reach (seed for the recommender). */
  peakHours: number[];
  peakDays: number[]; // 0 = Sunday
}

export const PLATFORMS: Record<PlatformId, PlatformSpec> = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    color: "#FF3B3B",
    short: { w: 1080, h: 1920, label: "Shorts 9:16", maxS: 180 },
    long: { w: 1920, h: 1080, label: "Video 16:9", maxS: 43200 },
    captionLimit: 5000,
    peakHours: [12, 15, 17, 20],
    peakDays: [4, 5, 6],
  },
  tiktok: {
    id: "tiktok",
    name: "TikTok",
    color: "#25F4EE",
    short: { w: 1080, h: 1920, label: "9:16", maxS: 600 },
    captionLimit: 2200,
    peakHours: [7, 12, 19, 22],
    peakDays: [2, 4, 5],
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    color: "#E1306C",
    short: { w: 1080, h: 1920, label: "Reels 9:16", maxS: 900 },
    captionLimit: 2200,
    peakHours: [9, 11, 13, 19],
    peakDays: [1, 3, 5],
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    short: { w: 1080, h: 1920, label: "Reels 9:16", maxS: 90 },
    long: { w: 1920, h: 1080, label: "Video 16:9", maxS: 14400 },
    captionLimit: 63206,
    peakHours: [9, 13, 15],
    peakDays: [2, 3, 4],
  },
  x: {
    id: "x",
    name: "X",
    color: "#D7DBE6",
    short: { w: 1280, h: 720, label: "16:9", maxS: 140 },
    captionLimit: 280,
    peakHours: [8, 12, 17],
    peakDays: [1, 2, 3],
  },
};

export const PLATFORM_ORDER: PlatformId[] = ["youtube", "tiktok", "instagram", "facebook", "x"];

export function targetFor(id: PlatformId, shortForm: boolean) {
  const spec = PLATFORMS[id];
  return !shortForm && spec.long ? spec.long : spec.short;
}

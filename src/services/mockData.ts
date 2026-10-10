import type { Account, PlatformId, ScheduledPost } from "@/types";

export const SEED_ACCOUNTS: Account[] = [
  { platform: "youtube", handle: "@lumenlabs", displayName: "Lumen Labs", followers: 248_300, connected: true, needsReauth: false, configured: true },
  { platform: "tiktok", handle: "@lumen.labs", displayName: "Lumen Labs", followers: 1_204_000, connected: true, needsReauth: false, configured: true },
  { platform: "instagram", handle: "@lumenlabs", displayName: "Lumen Labs", followers: 412_900, connected: true, needsReauth: false, configured: true },
  { platform: "facebook", handle: "Lumen Labs", displayName: "Lumen Labs", followers: 86_400, connected: true, needsReauth: true, configured: true },
  { platform: "x", handle: "@lumenlabs", displayName: "Lumen Labs", followers: 0, connected: false, needsReauth: false, configured: false },
];

function at(dayOffset: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const SEED_SCHEDULE: ScheduledPost[] = [
  { id: "s1", title: "Desk setup tour, part 2", platforms: ["youtube", "instagram"], at: at(1, 17) },
  { id: "s2", title: "60-second color grade", platforms: ["tiktok", "instagram"], at: at(2, 19) },
  { id: "s3", title: "Q&A: lenses under $300", platforms: ["youtube"], at: at(4, 12) },
  { id: "s4", title: "Studio lighting myth", platforms: ["tiktok", "x"], at: at(6, 12) },
];

/** 30 days of per-platform views/engagement for the analytics charts. */
export function seriesFor(days = 30) {
  const base: Record<PlatformId, number> = { youtube: 42_000, tiktok: 120_000, instagram: 55_000, facebook: 14_000, x: 6_000 };
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const wave = 1 + 0.35 * Math.sin(i / 3.2) + i / days / 2;
    const row: Record<string, number | string> = { date: d.toLocaleDateString("en", { month: "short", day: "numeric" }) };
    (Object.keys(base) as PlatformId[]).forEach((p, k) => {
      row[p] = Math.round(base[p] * wave * (0.85 + ((i * 7 + k * 13) % 10) / 33));
    });
    return row;
  });
}

export interface InboxMessage {
  id: string;
  platform: PlatformId;
  kind: "comment" | "dm";
  author: string;
  text: string;
  on?: string;
  minutesAgo: number;
  unread: boolean;
}

export const SEED_INBOX: InboxMessage[] = [
  { id: "m1", platform: "tiktok", kind: "comment", author: "@framebyframe", text: "What LUT is this?? the skin tones are perfect", on: "60-second color grade", minutesAgo: 4, unread: true },
  { id: "m2", platform: "youtube", kind: "comment", author: "Priya Raman", text: "Part 2 when? Need to see the cable management.", on: "Desk setup tour", minutesAgo: 18, unread: true },
  { id: "m3", platform: "instagram", kind: "dm", author: "@northlight.studio", text: "Hey! Would you be open to a paid collab next month?", minutesAgo: 42, unread: true },
  { id: "m4", platform: "facebook", kind: "comment", author: "Marco Bellini", text: "Shared this with my photography group 🙌", on: "Studio lighting myth", minutesAgo: 95, unread: false },
  { id: "m5", platform: "x", kind: "comment", author: "@gearhead_jo", text: "Counterpoint: the 35mm is the better first lens.", on: "Lenses under $300", minutesAgo: 160, unread: false },
  { id: "m6", platform: "youtube", kind: "comment", author: "Sam Okafor", text: "This channel deserves way more subs.", on: "Desk setup tour", minutesAgo: 240, unread: false },
];

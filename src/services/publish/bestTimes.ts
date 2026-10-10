import { PLATFORMS } from "@/config/platforms";
import type { PlatformId, ScheduledPost } from "@/types";

export interface Slot {
  at: Date;
  score: number;
  reasons: string[];
}

/**
 * Ranks the next 7 days of hourly slots for the selected platforms.
 * Score = peak-hour fit + peak-day fit, minus a penalty for crowding an
 * already-scheduled post. Seeds come from platform specs; swap in per-account
 * audience-activity data from the analytics APIs when available.
 */
export function recommendSlots(platforms: PlatformId[], existing: ScheduledPost[], now = new Date(), count = 3): Slot[] {
  if (platforms.length === 0) return [];
  const taken = existing.map((p) => new Date(p.at).getTime());
  const slots: Slot[] = [];

  for (let h = 2; h < 24 * 7; h++) {
    const at = new Date(now);
    at.setMinutes(0, 0, 0);
    at.setHours(at.getHours() + h);
    const hour = at.getHours();
    const day = at.getDay();
    const reasons: string[] = [];
    let score = 0;

    for (const p of platforms) {
      const spec = PLATFORMS[p];
      const near = Math.min(...spec.peakHours.map((ph) => Math.abs(ph - hour)));
      score += near === 0 ? 1 : near === 1 ? 0.5 : 0;
      if (spec.peakDays.includes(day)) score += 0.4;
      if (near === 0) reasons.push(`${spec.name} peak hour`);
    }
    score /= platforms.length;
    const crowded = taken.some((t) => Math.abs(t - at.getTime()) < 3 * 3600_000);
    if (crowded) score -= 0.6;
    if (score > 0) slots.push({ at, score, reasons: crowded ? [...reasons, "near another post"] : reasons });
  }

  // Best first, but keep picks at least 12h apart so suggestions differ.
  const picked: Slot[] = [];
  for (const s of slots.sort((a, b) => b.score - a.score)) {
    if (picked.every((p) => Math.abs(p.at.getTime() - s.at.getTime()) >= 12 * 3600_000)) picked.push(s);
    if (picked.length === count) break;
  }
  return picked;
}

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAppStore } from "@/store/useAppStore";
import { recommendSlots } from "@/services/publish/bestTimes";
import { PLATFORM_ORDER } from "@/config/platforms";
import { cn } from "@/lib/utils";

function startOfWeek(d: Date) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export function Calendar() {
  const { schedule, moveScheduled } = useAppStore();
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekOffset]);

  const best = useMemo(() => recommendSlots(PLATFORM_ORDER, schedule, new Date(), 5), [schedule]);
  const today = new Date();

  function drop(day: Date) {
    if (!dragging) return;
    const post = schedule.find((p) => p.id === dragging);
    if (!post) return;
    const old = new Date(post.at);
    const next = new Date(day);
    next.setHours(old.getHours(), old.getMinutes());
    moveScheduled(post.id, next.toISOString());
    setDragging(null);
    setHoverDay(null);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="mt-1 text-sm text-ink-mute">Drag a post to another day to move it. Times stay the same.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekOffset((w) => w - 1)} className="rounded-lg border border-line p-2 hover:bg-white/5" aria-label="Previous week">
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => setWeekOffset(0)} className="h-[34px] rounded-lg border border-line px-3 text-xs hover:bg-white/5">
            Today
          </button>
          <button onClick={() => setWeekOffset((w) => w + 1)} className="rounded-lg border border-line p-2 hover:bg-white/5" aria-label="Next week">
            <ChevronRight size={15} />
          </button>
        </div>
      </header>

      <GlassPanel accent className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-3 py-2 text-xs text-ink-mute">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = day.toDateString();
            const posts = schedule.filter((p) => sameDay(new Date(p.at), day)).sort((a, b) => a.at.localeCompare(b.at));
            const suggestion = best.find((s) => sameDay(s.at, day));
            const isPast = day < new Date(today.toDateString());
            return (
              <div
                key={key}
                onDragOver={(e) => {
                  if (isPast) return;
                  e.preventDefault();
                  setHoverDay(key);
                }}
                onDragLeave={() => setHoverDay((h) => (h === key ? null : h))}
                onDrop={() => drop(day)}
                className={cn(
                  "min-h-[150px] border-b border-r border-line p-2 transition-colors [&:nth-child(7n)]:border-r-0",
                  isPast && "bg-black/20",
                  hoverDay === key && "bg-ion/10",
                )}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "num grid h-6 min-w-6 place-items-center rounded-md px-1 text-xs",
                      sameDay(day, today) ? "bg-ion text-white" : isPast ? "text-ink-mute/60" : "text-ink-soft",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {suggestion && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-aurora" title={suggestion.reasons.join(", ")}>
                      <Sparkles size={10} />
                      {suggestion.at.toLocaleTimeString("en", { hour: "numeric" })}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5">
                  {posts.map((p) => (
                    <motion.div
                      key={p.id}
                      layout
                      layoutId={p.id}
                      draggable
                      onDragStart={() => setDragging(p.id)}
                      onDragEnd={() => setDragging(null)}
                      className={cn(
                        "cursor-grab rounded-lg border border-ion/25 bg-ion/10 px-2 py-1.5 active:cursor-grabbing",
                        dragging === p.id && "opacity-40",
                      )}
                    >
                      <p className="num text-[10px] text-ion">{new Date(p.at).toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}</p>
                      <p className="line-clamp-2 text-[11.5px] leading-snug text-ink">{p.title}</p>
                      <div className="mt-1 flex gap-1">
                        {p.platforms.map((id) => (
                          <PlatformIcon key={id} id={id} size={11} />
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </GlassPanel>
      <p className="flex items-center gap-1.5 text-xs text-ink-mute">
        <Sparkles size={12} className="text-aurora" /> Suggested times are when most of your connected audiences are active.
      </p>
    </div>
  );
}

import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Rocket, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/useAppStore";
import { submit } from "@/services/publish/pipeline";
import { recommendSlots } from "@/services/publish/bestTimes";
import { cn } from "@/lib/utils";

export function PublishActions() {
  const { draft, accounts, addScheduled, resetDraft } = useAppStore();
  const [open, setOpen] = useState(false);

  const blocked = draft.platforms.filter((p) => {
    const a = accounts.find((x) => x.platform === p);
    return !a?.connected || a.needsReauth;
  });
  const reason = !draft.video
    ? "Add a video to publish"
    : draft.platforms.length === 0
      ? "Pick at least one platform"
      : blocked.length
        ? `Reconnect ${blocked.join(", ")} first`
        : null;

  async function publish(scheduleAt?: string) {
    await submit({
      videoPath: draft.video?.path,
      platforms: draft.platforms,
      shortForm: draft.shortForm,
      strategy: draft.strategy,
      title: draft.title,
      caption: draft.caption,
      hashtags: draft.hashtags,
      scheduleAt,
    });
    if (scheduleAt) {
      addScheduled({ id: crypto.randomUUID(), title: draft.title || draft.video?.name || "Untitled", platforms: draft.platforms, at: scheduleAt });
      resetDraft();
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Button variant="primary" size="lg" disabled={!!reason} onClick={() => publish()}>
          <Rocket size={16} />
          Publish now
        </Button>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <Button size="lg" disabled={!!reason}>
              <CalendarClock size={16} />
              Schedule
            </Button>
          </Dialog.Trigger>
          <ScheduleDialog open={open} onConfirm={(iso) => (publish(iso), setOpen(false))} />
        </Dialog.Root>
      </div>
      <p className={cn("h-4 text-center text-[11px]", reason ? "text-ink-mute" : "text-transparent")}>{reason ?? "."}</p>
    </div>
  );
}

function ScheduleDialog({ open, onConfirm }: { open: boolean; onConfirm: (iso: string) => void }) {
  const { draft, schedule } = useAppStore();
  const slots = useMemo(() => recommendSlots(draft.platforms, schedule), [draft.platforms, schedule]);
  const [custom, setCustom] = useState("");
  const [pick, setPick] = useState(0);

  const chosen = custom ? new Date(custom) : slots[pick]?.at;

  return (
    <AnimatePresence>
      {open && (
        <Dialog.Portal forceMount>
          <Dialog.Overlay asChild>
            <motion.div className="fixed inset-0 z-40 bg-void/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          </Dialog.Overlay>
          <Dialog.Content asChild>
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="glass-strong hairline-top fixed left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6"
            >
              <div className="flex items-start justify-between">
                <div>
                  <Dialog.Title className="text-base font-semibold">Schedule post</Dialog.Title>
                  <Dialog.Description className="mt-1 text-xs text-ink-mute">
                    Suggested from when your selected audiences are most active.
                  </Dialog.Description>
                </div>
                <Dialog.Close className="rounded-lg p-1.5 text-ink-mute hover:bg-white/5" aria-label="Close">
                  <X size={16} />
                </Dialog.Close>
              </div>

              <div className="mt-5 space-y-2">
                {slots.map((s, i) => (
                  <button
                    key={s.at.toISOString()}
                    onClick={() => (setPick(i), setCustom(""))}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                      !custom && pick === i ? "border-ion/50 bg-ion/10" : "border-line hover:border-ion/30",
                    )}
                  >
                    <span>
                      <span className="block text-sm">
                        {s.at.toLocaleDateString("en", { weekday: "long" })}, {s.at.toLocaleTimeString("en", { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-mute">{s.reasons.slice(0, 2).join(", ") || "Good overall fit"}</span>
                    </span>
                    {i === 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-aurora/15 px-2 py-0.5 text-[11px] text-aurora">
                        <Sparkles size={11} /> Best
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <label className="mt-4 block text-xs text-ink-soft" htmlFor="custom-time">
                Or pick a time
              </label>
              <input
                id="custom-time"
                type="datetime-local"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-line bg-black/30 px-3 text-sm text-ink outline-none [color-scheme:dark] focus:border-ion/50"
              />

              <Button variant="primary" className="mt-5 w-full" disabled={!chosen} onClick={() => chosen && onConfirm(chosen.toISOString())}>
                <CalendarClock size={15} />
                Schedule for {chosen ? chosen.toLocaleString("en", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "…"}
              </Button>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      )}
    </AnimatePresence>
  );
}

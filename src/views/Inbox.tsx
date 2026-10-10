import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, Send } from "lucide-react";
import { useState } from "react";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PLATFORM_ORDER, PLATFORMS } from "@/config/platforms";
import { SEED_INBOX, type InboxMessage } from "@/services/mockData";
import { cn } from "@/lib/utils";
import type { PlatformId } from "@/types";

function ago(min: number) {
  return min < 60 ? `${min}m` : `${Math.round(min / 60)}h`;
}

export function Inbox() {
  const [filter, setFilter] = useState<PlatformId | "all">("all");
  const [messages, setMessages] = useState(SEED_INBOX);
  const [selected, setSelected] = useState<string>(SEED_INBOX[0].id);
  const [replies, setReplies] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState("");

  const list = messages.filter((m) => filter === "all" || m.platform === filter);
  const current = messages.find((m) => m.id === selected);

  function open(m: InboxMessage) {
    setSelected(m.id);
    setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, unread: false } : x)));
  }

  function send() {
    if (!draft.trim() || !current) return;
    setReplies((r) => ({ ...r, [current.id]: [...(r[current.id] ?? []), draft.trim()] }));
    setDraft("");
  }

  return (
    <div className="flex h-full flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-ink-mute">Comments and messages from every channel, in one place.</p>
      </header>
      <div className="flex gap-1.5">
        {(["all", ...PLATFORM_ORDER] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs",
              filter === p ? "border-ion/40 bg-ion/10 text-ink" : "border-line text-ink-mute hover:text-ink-soft",
            )}
          >
            {p !== "all" && <PlatformIcon id={p} size={13} />}
            {p === "all" ? "All" : PLATFORMS[p].name}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[380px_1fr] gap-5">
        <GlassPanel className="overflow-y-auto">
          {list.map((m) => (
            <button
              key={m.id}
              onClick={() => open(m)}
              className={cn(
                "flex w-full gap-3 border-b border-line px-4 py-3.5 text-left transition-colors",
                selected === m.id ? "bg-ion/[0.08]" : "hover:bg-white/[0.02]",
              )}
            >
              <PlatformIcon id={m.platform} size={18} className="mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn("truncate text-sm", m.unread ? "font-semibold text-ink" : "text-ink-soft")}>{m.author}</p>
                  <span className="num shrink-0 text-[11px] text-ink-mute">{ago(m.minutesAgo)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-ink-mute">{m.text}</p>
              </div>
              {m.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-ion shadow-glow" />}
            </button>
          ))}
        </GlassPanel>

        <GlassPanel className="flex flex-col">
          <AnimatePresence mode="wait">
            {current ? (
              <motion.div key={current.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col">
                <div className="border-b border-line px-5 py-4">
                  <p className="font-medium">{current.author}</p>
                  <p className="text-xs text-ink-mute">
                    {current.kind === "dm" ? "Direct message" : `Comment on “${current.on}”`} · {PLATFORMS[current.platform].name}
                  </p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-5">
                  <div className="max-w-[75%] rounded-2xl rounded-tl-md border border-line bg-white/[0.03] px-4 py-2.5 text-sm">{current.text}</div>
                  {(replies[current.id] ?? []).map((r, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="ml-auto max-w-[75%] rounded-2xl rounded-tr-md bg-ion/20 px-4 py-2.5 text-sm"
                    >
                      {r}
                    </motion.div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-line p-3">
                  <label htmlFor="reply" className="sr-only">
                    Reply
                  </label>
                  <input
                    id="reply"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder={`Reply on ${PLATFORMS[current.platform].name}`}
                    className="h-10 flex-1 rounded-xl border border-line bg-black/20 px-3.5 text-sm outline-none focus:border-ion/50"
                  />
                  <Button variant="primary" onClick={send} disabled={!draft.trim()}>
                    <Send size={14} /> Reply
                  </Button>
                </div>
              </motion.div>
            ) : (
              <div className="grid flex-1 place-items-center text-sm text-ink-mute">
                <MessageSquare size={20} />
              </div>
            )}
          </AnimatePresence>
        </GlassPanel>
      </div>
    </div>
  );
}

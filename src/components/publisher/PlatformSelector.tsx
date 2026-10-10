import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { PLATFORM_ORDER, PLATFORMS, targetFor } from "@/config/platforms";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function PlatformSelector() {
  const { draft, togglePlatform, setShortForm, accounts } = useAppStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-soft">Publish to</p>
        <div className="flex rounded-lg border border-line bg-white/[0.02] p-0.5 text-xs" role="radiogroup" aria-label="Video length">
          {[
            { v: true, label: "Short-form" },
            { v: false, label: "Long-form" },
          ].map((o) => (
            <button
              key={o.label}
              role="radio"
              aria-checked={draft.shortForm === o.v}
              onClick={() => setShortForm(o.v)}
              className={cn("relative rounded-md px-3 py-1", draft.shortForm === o.v ? "text-ink" : "text-ink-mute")}
            >
              {draft.shortForm === o.v && (
                <motion.span layoutId="len-pill" className="absolute inset-0 rounded-md bg-ion/20" />
              )}
              <span className="relative">{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PLATFORM_ORDER.map((id) => {
          const spec = PLATFORMS[id];
          const on = draft.platforms.includes(id);
          const acct = accounts.find((a) => a.platform === id);
          const usable = acct?.connected && !acct.needsReauth;
          const t = targetFor(id, draft.shortForm);
          return (
            <motion.button
              key={id}
              whileTap={{ scale: 0.96 }}
              onClick={() => togglePlatform(id)}
              aria-pressed={on}
              className={cn(
                "relative flex h-12 items-center gap-2.5 rounded-xl border pl-3 pr-3.5 text-left transition-colors",
                on ? "bg-white/[0.04]" : "border-line bg-transparent hover:bg-white/[0.02]",
              )}
              style={on ? { borderColor: `${spec.color}66`, boxShadow: `0 0 22px -8px ${spec.color}` } : undefined}
            >
              <PlatformIcon id={id} size={18} mono={!on} className={on ? "" : "text-ink-mute"} />
              <span className="leading-tight">
                <span className={cn("block text-[13px]", on ? "text-ink" : "text-ink-soft")}>{spec.name}</span>
                <span className="num block text-[10.5px] text-ink-mute">
                  {usable ? t.label : acct?.connected ? "Reconnect first" : "Not connected"}
                </span>
              </span>
              {on && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="ml-1 grid h-4 w-4 place-items-center rounded-full"
                  style={{ background: spec.color }}
                >
                  <Check size={10} strokeWidth={3} className="text-base" />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

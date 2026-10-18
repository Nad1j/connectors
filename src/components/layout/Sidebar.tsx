import { motion } from "framer-motion";
import { BarChart3, CalendarDays, Inbox, LayoutDashboard, Link2, Send, Settings } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/types";
import appIcon from "@/assets/app-icon.svg";

const NAV: { id: ViewId; label: string; icon: typeof Send; badge?: number }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "publisher", label: "Publisher", icon: Send },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "inbox", label: "Inbox", icon: Inbox, badge: 3 },
  { id: "accounts", label: "Accounts", icon: Link2 },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const { view, setView, jobs } = useAppStore();
  const active = jobs.filter((j) =>
    Object.values(j.platforms).some((p) => ["queued", "processing", "uploading", "finalizing"].includes(p.stage)),
  ).length;

  return (
    <aside className="flex w-[232px] shrink-0 flex-col border-r border-line bg-base/70 px-3 py-5 backdrop-blur-xl">
      <div className="flex items-center gap-2.5 px-3 pb-7">
        <img src={appIcon} width={30} height={30} alt="" className="-my-1" />
        <span className="text-[17px] font-semibold tracking-tight">
          Connect<span className="bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">ors</span>
        </span>
      </div>

      <nav className="flex flex-col gap-0.5" aria-label="Main">
        {NAV.map(({ id, label, icon: Icon, badge }) => {
          const isActive = view === id;
          return (
            <button
              key={id}
              onClick={() => setView(id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors",
                isActive ? "text-ink" : "text-ink-mute hover:bg-white/[0.03] hover:text-ink-soft",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl border border-ion/30 bg-ion/[0.09] shadow-[inset_0_0_20px_rgba(108,140,255,.12)]"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              {isActive && (
                <motion.span layoutId="nav-tick" className="absolute -left-3 h-5 w-[3px] rounded-r-full bg-ion shadow-glow" />
              )}
              <Icon size={17} className="relative" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="relative">{label}</span>
              {id === "publisher" && active > 0 && (
                <span className="num relative ml-auto rounded-md bg-aurora/15 px-1.5 text-[11px] text-aurora">{active}</span>
              )}
              {badge && id !== "publisher" && (
                <span className="num relative ml-auto rounded-md bg-flare/15 px-1.5 text-[11px] text-flare">{badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto rounded-xl border border-line bg-white/[0.02] p-3">
        <p className="text-xs text-ink-soft">Storage for renders</p>
        <div className="mt-2 h-1 rounded-full bg-white/[0.06]">
          <div className="h-full w-[38%] rounded-full bg-ion" />
        </div>
        <p className="num mt-1.5 text-[11px] text-ink-mute">7.6 / 20 GB</p>
      </div>
    </aside>
  );
}

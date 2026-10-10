import { motion } from "framer-motion";
import { BarChart3, CalendarDays, Inbox, LayoutDashboard, Link2, Send, Settings } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import type { ViewId } from "@/types";

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
        <Logo />
        <span className="text-[17px] font-semibold tracking-tight">Connectors</span>
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

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6C8CFF" />
          <stop offset="1" stopColor="#3EE6C4" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="4.5" fill="url(#lg)" />
      {[0, 72, 144, 216, 288].map((deg) => {
        const r = (deg * Math.PI) / 180;
        const x = 16 + Math.cos(r) * 11.5;
        const y = 16 + Math.sin(r) * 11.5;
        return (
          <g key={deg}>
            <line x1="16" y1="16" x2={x} y2={y} stroke="url(#lg)" strokeWidth="1.6" opacity=".6" />
            <circle cx={x} cy={y} r="2.6" fill="#0A1020" stroke="url(#lg)" strokeWidth="1.6" />
          </g>
        );
      })}
    </svg>
  );
}

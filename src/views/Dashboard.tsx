import { ArrowUpRight, CalendarClock } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { Button } from "@/components/ui/Button";
import { GlassPanel, PanelHeader } from "@/components/ui/GlassPanel";
import { PLATFORM_ORDER, PLATFORMS } from "@/config/platforms";
import { useAppStore } from "@/store/useAppStore";
import { SEED_INBOX, seriesFor } from "@/services/mockData";
import { compact } from "@/lib/utils";
import { Kpi } from "./Analytics";

export function Dashboard() {
  const { schedule, accounts, setView } = useAppStore();
  const data = useMemo(() => seriesFor(14), []);
  const upcoming = [...schedule].sort((a, b) => a.at.localeCompare(b.at)).slice(0, 4);
  const audience = accounts.filter((a) => a.connected).reduce((n, a) => n + a.followers, 0);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good evening</h1>
          <p className="mt-1 text-sm text-ink-mute">
            {upcoming.length} posts scheduled this week · {SEED_INBOX.filter((m) => m.unread).length} unread messages
          </p>
        </div>
        <Button variant="primary" onClick={() => setView("publisher")}>
          New post
        </Button>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Audience" value={compact(audience)} delta="+2.4%" />
        <Kpi label="Views, 14 days" value="3.4M" delta="+18.2%" />
        <Kpi label="Engagement rate" value="7.2%" delta="+0.6 pts" />
        <Kpi label="Posts published" value="23" delta="+5" />
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-5">
        <GlassPanel accent className="pb-4">
          <PanelHeader title="Views, last 14 days" />
          <div className="grid grid-cols-5 gap-3 px-5 pt-4">
            {PLATFORM_ORDER.map((p) => (
              <div key={p} className="rounded-xl border border-line bg-black/20 p-3">
                <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                  <PlatformIcon id={p} size={13} /> {PLATFORMS[p].name}
                </div>
                <p className="num mt-2 text-lg">{compact(data.reduce((n, r) => n + (r[p] as number), 0))}</p>
                <div className="mt-2 h-10">
                  <ResponsiveContainer>
                    <AreaChart data={data}>
                      <Area type="monotone" dataKey={p} stroke={PLATFORMS[p].color} strokeWidth={1.5} fill={PLATFORMS[p].color} fillOpacity={0.12} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel className="pb-3">
          <PanelHeader
            title="Up next"
            right={
              <button onClick={() => setView("calendar")} className="inline-flex items-center gap-1 text-xs text-ink-mute hover:text-ink">
                Calendar <ArrowUpRight size={12} />
              </button>
            }
          />
          <ul className="mt-3">
            {upcoming.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-t border-line px-5 py-3">
                <CalendarClock size={15} className="text-ion" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{p.title}</p>
                  <p className="num text-[11px] text-ink-mute">
                    {new Date(p.at).toLocaleString("en", { weekday: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex gap-1">
                  {p.platforms.map((id) => (
                    <PlatformIcon key={id} id={id} size={14} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { GlassPanel, PanelHeader } from "@/components/ui/GlassPanel";
import { PLATFORM_ORDER, PLATFORMS } from "@/config/platforms";
import { seriesFor } from "@/services/mockData";
import { compact, cn } from "@/lib/utils";
import type { PlatformId } from "@/types";

const ENGAGEMENT: Record<PlatformId, { likes: number; shares: number; comments: number; rate: number }> = {
  youtube: { likes: 92_400, shares: 8_100, comments: 6_300, rate: 6.1 },
  tiktok: { likes: 412_000, shares: 61_000, comments: 18_200, rate: 9.8 },
  instagram: { likes: 138_000, shares: 12_400, comments: 7_900, rate: 7.4 },
  facebook: { likes: 21_300, shares: 4_800, comments: 2_100, rate: 3.9 },
  x: { likes: 6_200, shares: 1_900, comments: 640, rate: 2.7 },
};

const tooltipStyle = {
  background: "rgba(15,23,41,.95)",
  border: "1px solid rgba(148,170,255,.15)",
  borderRadius: 12,
  fontSize: 12,
  fontFamily: "JetBrains Mono",
};

export function Analytics() {
  const [range, setRange] = useState(30);
  const data = useMemo(() => seriesFor(range), [range]);
  const totals = useMemo(() => {
    const t = Object.fromEntries(PLATFORM_ORDER.map((p) => [p, 0])) as Record<PlatformId, number>;
    data.forEach((row) => PLATFORM_ORDER.forEach((p) => (t[p] += row[p] as number)));
    return t;
  }, [data]);
  const totalViews = Object.values(totals).reduce((a, b) => a + b, 0);
  const totalLikes = Object.values(ENGAGEMENT).reduce((a, e) => a + e.likes, 0);
  const totalShares = Object.values(ENGAGEMENT).reduce((a, e) => a + e.shares, 0);

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-ink-mute">All connected channels, combined.</p>
        </div>
        <div className="flex rounded-lg border border-line p-0.5 text-xs">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setRange(d)} className={cn("rounded-md px-3 py-1", range === d ? "bg-ion/20 text-ink" : "text-ink-mute")}>
              {d} days
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Kpi label="Views" value={compact(totalViews)} delta="+18.2%" />
        <Kpi label="Engagement rate" value="7.2%" delta="+0.6 pts" />
        <Kpi label="Likes" value={compact(totalLikes)} delta="+11.4%" />
        <Kpi label="Shares" value={compact(totalShares)} delta="+23.9%" />
      </div>

      <GlassPanel accent className="pb-4">
        <PanelHeader title="Views by platform" />
        <div className="h-[300px] px-3 pt-4">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 4 }}>
              <defs>
                {PLATFORM_ORDER.map((p) => (
                  <linearGradient key={p} id={`g-${p}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PLATFORMS[p].color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={PLATFORMS[p].color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="rgba(148,170,255,.07)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#66718F", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tickFormatter={compact} tick={{ fill: "#66718F", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v, k) => [compact(Number(v)), PLATFORMS[k as PlatformId].name]} />
              {PLATFORM_ORDER.map((p) => (
                <Area key={p} type="monotone" dataKey={p} stackId="1" stroke={PLATFORMS[p].color} strokeWidth={1.5} fill={`url(#g-${p})`} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassPanel>

      <div className="grid grid-cols-[1.3fr_1fr] gap-5">
        <GlassPanel className="pb-2">
          <PanelHeader title="By platform" />
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-ink-mute">
                <th className="px-5 py-2 font-normal">Platform</th>
                <th className="py-2 text-right font-normal">Views</th>
                <th className="py-2 text-right font-normal">Likes</th>
                <th className="py-2 text-right font-normal">Shares</th>
                <th className="px-5 py-2 text-right font-normal">Eng. rate</th>
              </tr>
            </thead>
            <tbody className="num">
              {PLATFORM_ORDER.map((p) => (
                <tr key={p} className="border-t border-line">
                  <td className="flex items-center gap-2 px-5 py-2.5 font-sans">
                    <PlatformIcon id={p} size={15} /> {PLATFORMS[p].name}
                  </td>
                  <td className="text-right">{compact(totals[p])}</td>
                  <td className="text-right">{compact(ENGAGEMENT[p].likes)}</td>
                  <td className="text-right">{compact(ENGAGEMENT[p].shares)}</td>
                  <td className="px-5 text-right">{ENGAGEMENT[p].rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassPanel>
        <GlassPanel className="pb-4">
          <PanelHeader title="Engagement rate" />
          <div className="h-[230px] px-3 pt-4">
            <ResponsiveContainer>
              <BarChart data={PLATFORM_ORDER.map((p) => ({ p, rate: ENGAGEMENT[p].rate }))} margin={{ right: 12 }}>
                <CartesianGrid stroke="rgba(148,170,255,.07)" vertical={false} />
                <XAxis dataKey="p" tickFormatter={(p) => PLATFORMS[p as PlatformId].name} tick={{ fill: "#66718F", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis unit="%" tick={{ fill: "#66718F", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(108,140,255,.06)" }} formatter={(v) => [`${v}%`, "Engagement"]} />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} fill="#6C8CFF" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

export function Kpi({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <GlassPanel className="p-4">
      <p className="text-xs text-ink-mute">{label}</p>
      <p className="num mt-2 text-2xl text-ink">{value}</p>
      <p className="num mt-1 text-[11px] text-aurora">{delta} vs previous period</p>
    </GlassPanel>
  );
}

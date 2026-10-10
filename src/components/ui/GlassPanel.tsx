import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  /** Draws the ion→aurora hairline along the top edge. */
  accent?: boolean;
}

export function GlassPanel({ strong, accent, className, ...rest }: Props) {
  return <div className={cn(strong ? "glass-strong" : "glass", accent && "hairline-top", "rounded-2xl", className)} {...rest} />;
}

export function PanelHeader({ title, hint, right }: { title: string; hint?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pt-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

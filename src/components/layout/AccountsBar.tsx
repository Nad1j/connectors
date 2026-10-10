import { RotateCw } from "lucide-react";
import { useState } from "react";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { PLATFORMS } from "@/config/platforms";
import { useAppStore } from "@/store/useAppStore";
import { compact, cn } from "@/lib/utils";
import * as oauth from "@/services/auth/oauthService";
import type { Account } from "@/types";

/** Persistent strip of connected channels with live status and one-click re-auth. */
export function AccountsBar() {
  const accounts = useAppStore((s) => s.accounts);
  const reach = accounts.filter((a) => a.connected).reduce((n, a) => n + a.followers, 0);

  return (
    <div className="flex items-center gap-3 border-b border-line bg-base/50 px-6 py-3 backdrop-blur-xl">
      <div className="mr-2 min-w-[120px]">
        <p className="label">Combined audience</p>
        <p className="num text-lg font-medium text-ink">{compact(reach)}</p>
      </div>
      <div className="flex flex-1 items-center gap-2 overflow-x-auto">
        {accounts.map((a) => (
          <AccountChip key={a.platform} account={a} />
        ))}
      </div>
    </div>
  );
}

function AccountChip({ account: a }: { account: Account }) {
  const patch = useAppStore((s) => s.patchAccount);
  const [busy, setBusy] = useState(false);
  const state = !a.connected ? "off" : a.needsReauth ? "warn" : "on";

  async function reauth() {
    setBusy(true);
    try {
      await oauth.connect(a.platform);
      patch(a.platform, { connected: true, needsReauth: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center gap-2.5 rounded-xl border pl-2.5 pr-2 transition-colors",
        state === "on" && "border-line bg-white/[0.025]",
        state === "warn" && "border-amber/30 bg-amber/[0.05]",
        state === "off" && "border-dashed border-line bg-transparent opacity-70",
      )}
    >
      <div className="relative">
        <PlatformIcon id={a.platform} size={20} />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-base",
            state === "on" && "bg-aurora shadow-glow-teal",
            state === "warn" && "bg-amber",
            state === "off" && "bg-ink-mute",
          )}
        />
      </div>
      <div className="leading-tight">
        <p className="text-xs text-ink">{PLATFORMS[a.platform].name}</p>
        <p className="num text-[11px] text-ink-mute">
          {state === "off" ? "Not connected" : state === "warn" ? "Sign-in expired" : `${compact(a.followers)} followers`}
        </p>
      </div>
      {state !== "on" && (
        <button
          onClick={reauth}
          disabled={busy}
          className="ml-1 inline-flex h-7 items-center gap-1 rounded-lg bg-white/5 px-2 text-[11px] text-ink-soft hover:bg-ion/15 hover:text-ink"
          aria-label={`${state === "off" ? "Connect" : "Reconnect"} ${PLATFORMS[a.platform].name}`}
        >
          <RotateCw size={12} className={busy ? "animate-spin" : ""} />
          {state === "off" ? "Connect" : "Reconnect"}
        </button>
      )}
    </div>
  );
}

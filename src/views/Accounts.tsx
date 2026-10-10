import { motion } from "framer-motion";
import { KeyRound, Link2, LogOut, RotateCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PLATFORMS } from "@/config/platforms";
import { useAppStore } from "@/store/useAppStore";
import * as oauth from "@/services/auth/oauthService";
import { compact } from "@/lib/utils";
import type { Account } from "@/types";

export function Accounts() {
  const accounts = useAppStore((s) => s.accounts);
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-mute">
          Sign-in happens in your browser. Access tokens are kept in your system keychain and never leave this device.
        </p>
      </header>
      <div className="grid grid-cols-2 gap-4">
        {accounts.map((a, i) => (
          <motion.div key={a.platform} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <AccountCard account={a} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function AccountCard({ account: a }: { account: Account }) {
  const patch = useAppStore((s) => s.patchAccount);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const spec = PLATFORMS[a.platform];
  const oauthReady = oauth.OAUTH_READY.includes(a.platform);

  async function act(kind: "connect" | "refresh" | "disconnect") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "connect") {
        await oauth.connect(a.platform);
        patch(a.platform, { connected: true, needsReauth: false });
      } else if (kind === "refresh") {
        await oauth.refresh(a.platform);
        patch(a.platform, { needsReauth: false });
      } else {
        await oauth.disconnect(a.platform);
        patch(a.platform, { connected: false, needsReauth: false });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <GlassPanel className="p-5" style={a.connected ? { borderColor: `${spec.color}30` } : undefined}>
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-black/30">
          <PlatformIcon id={a.platform} size={24} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{spec.name}</p>
          <p className="text-xs text-ink-mute">{a.connected ? a.handle : oauthReady ? "Not connected" : "Sign-in coming in a later build"}</p>
        </div>
        {a.connected && (
          <div className="text-right">
            <p className="num text-lg">{compact(a.followers)}</p>
            <p className="text-[11px] text-ink-mute">followers</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px]">
        {a.connected && !a.needsReauth && (
          <span className="inline-flex items-center gap-1 rounded-md bg-aurora/10 px-2 py-1 text-aurora">
            <ShieldCheck size={12} /> Token valid
          </span>
        )}
        {a.needsReauth && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber/10 px-2 py-1 text-amber">
            <KeyRound size={12} /> Sign-in expired
          </span>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        {!a.connected ? (
          <Button variant="primary" size="sm" disabled={!!busy} onClick={() => act("connect")}>
            <Link2 size={13} /> {busy ? "Waiting for browser…" : `Connect ${spec.name}`}
          </Button>
        ) : (
          <>
            <Button size="sm" disabled={!!busy} onClick={() => act(a.needsReauth ? "connect" : "refresh")}>
              <RotateCw size={13} className={busy ? "animate-spin" : ""} /> {a.needsReauth ? "Reconnect" : "Refresh token"}
            </Button>
            <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => act("disconnect")}>
              <LogOut size={13} /> Disconnect
            </Button>
          </>
        )}
      </div>
      {error && <p className="mt-3 text-xs text-flare">{error}</p>}
    </GlassPanel>
  );
}

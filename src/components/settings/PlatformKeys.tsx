import { CheckCircle2, FileUp, KeyRound, Trash2, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassPanel, PanelHeader } from "@/components/ui/GlassPanel";
import { PlatformIcon } from "@/components/icons/PlatformIcon";
import { PLATFORMS } from "@/config/platforms";
import { useAppStore } from "@/store/useAppStore";
import * as keys from "@/services/settings/keysService";
import type { KeySource, PlatformKeysStatus } from "@/services/settings/keysService";
import type { PlatformId } from "@/types";

const SOURCE: Record<KeySource, string> = {
  env: "from .env",
  settings: "saved in keychain",
  builtin: "built into this app",
};

const ID_LABEL: Partial<Record<PlatformId, string>> = { youtube: "Client ID", tiktok: "Client key" };

/** OAuth client credentials per platform, stored in the OS keychain. */
export function PlatformKeys() {
  const patchAccount = useAppStore((s) => s.patchAccount);
  const [rows, setRows] = useState<PlatformKeysStatus[]>([]);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const next = await keys.status();
    setRows(next);
    for (const r of next) patchAccount(r.platform, { configured: !!(r.clientIdSource && r.clientSecretSource) });
  }

  useEffect(() => {
    refresh();
  }, []);

  async function onImport(file: File | undefined) {
    if (!file) return;
    try {
      const done = await keys.importFile(file);
      setNote({ ok: true, text: `Imported keys for ${done.map((p) => PLATFORMS[p].name).join(" and ")}.` });
      await refresh();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <GlassPanel className="pb-5">
      <PanelHeader
        title="Platform keys"
        hint="OAuth client ID and secret for each platform. Stored in the system keychain; never shown again or written to logs."
        right={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import keys file"
              onChange={(e) => onImport(e.target.files?.[0])}
            />
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <FileUp size={13} /> Import keys
            </Button>
          </>
        }
      />
      {note && (
        <p role="status" className={`mt-3 px-5 text-xs ${note.ok ? "text-aurora" : "text-flare"}`}>
          {note.text}
        </p>
      )}
      <div className="mt-4 space-y-3 px-5">
        {rows.map((r) => (
          <KeyRow key={r.platform} status={r} onChanged={refresh} />
        ))}
      </div>
    </GlassPanel>
  );
}

function KeyRow({ status: r, onChanged }: { status: PlatformKeysStatus; onChanged: () => Promise<void> }) {
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const ready = !!(r.clientIdSource && r.clientSecretSource);
  const spec = PLATFORMS[r.platform];
  const idLabel = ID_LABEL[r.platform] ?? "Client ID";

  async function save() {
    await keys.save({ platform: r.platform, clientId, clientSecret: secret });
    setClientId("");
    setSecret("");
    await onChanged();
  }

  async function clear() {
    await keys.clear(r.platform);
    await onChanged();
  }

  const field = "h-9 min-w-0 flex-1 rounded-xl border border-line bg-black/20 px-3 font-mono text-xs outline-none focus:border-ion/50";

  return (
    <div className="rounded-xl border border-line p-3.5">
      <div className="flex items-center gap-2 text-sm">
        <PlatformIcon id={r.platform} size={16} />
        <span className="font-medium">{spec.name}</span>
        <span className="ml-auto flex items-center gap-1.5 text-xs">
          {ready ? <CheckCircle2 size={14} className="text-aurora" /> : <XCircle size={14} className="text-flare" />}
          <span className={ready ? "text-aurora" : "text-ink-mute"}>{ready ? "Ready to connect" : "Missing keys"}</span>
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink-mute">
        {idLabel}: {r.clientIdSource ? SOURCE[r.clientIdSource] : "not set"} · Client secret:{" "}
        {r.clientSecretSource ? SOURCE[r.clientSecretSource] : "not set"}
      </p>
      <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor={`${r.platform}-id`}>
          {spec.name} {idLabel}
        </label>
        <input
          id={`${r.platform}-id`}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={r.clientIdSource ? `New ${idLabel.toLowerCase()} (optional)` : idLabel}
          autoComplete="off"
          spellCheck={false}
          className={field}
        />
        <label className="sr-only" htmlFor={`${r.platform}-secret`}>
          {spec.name} client secret
        </label>
        <input
          id={`${r.platform}-secret`}
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder={r.clientSecretSource ? "New secret (optional)" : "Client secret"}
          autoComplete="off"
          className={field}
        />
        <Button size="sm" variant="primary" onClick={save} disabled={!clientId.trim() && !secret.trim()}>
          <KeyRound size={13} /> Save
        </Button>
        {(r.clientIdSource === "settings" || r.clientSecretSource === "settings") && (
          <Button size="sm" onClick={clear} aria-label={`Remove saved ${spec.name} keys`}>
            <Trash2 size={13} />
          </Button>
        )}
      </div>
    </div>
  );
}

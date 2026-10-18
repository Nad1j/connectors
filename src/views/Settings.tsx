import { CheckCircle2, KeyRound, RefreshCw, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassPanel, PanelHeader } from "@/components/ui/GlassPanel";
import { inTauri, invoke } from "@/lib/tauri";
import appIcon from "@/assets/app-icon.svg";
import { useAppStore } from "@/store/useAppStore";
import { checkEngine } from "@/services/media/videoService";
import { cn } from "@/lib/utils";
import type { ExportQuality } from "@/types";

const QUALITIES: { id: ExportQuality; label: string; hint: string }[] = [
  { id: "low", label: "Low", hint: "Smallest files, fastest uploads" },
  { id: "medium", label: "Medium", hint: "8 Mb/s at 1080p, 5 Mb/s at 720p" },
  { id: "high", label: "High", hint: "1.5× bitrate for detailed footage" },
];

const SOURCE_LABEL = { bundled: "Bundled with Connectors", env: "From FFMPEG_PATH", path: "From system PATH" } as const;

export function Settings() {
  const { engine, setEngine, exportQuality, setExportQuality } = useAppStore();
  const [checking, setChecking] = useState(false);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  async function recheck() {
    setChecking(true);
    setEngine(await checkEngine());
    setChecking(false);
  }

  useEffect(() => {
    recheck();
  }, []);

  async function saveKey() {
    if (inTauri) await invoke("settings_save_secret", { name: "anthropic_api_key", value: key.trim() });
    setKey("");
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <GlassPanel className="pb-5">
        <PanelHeader title="Copy assistant" hint="Your Anthropic API key is stored in the system keychain, not in app files." />
        <div className="mt-4 flex gap-2 px-5">
          <label htmlFor="api-key" className="sr-only">
            Anthropic API key
          </label>
          <input
            id="api-key"
            type="password"
            value={key}
            onChange={(e) => (setKey(e.target.value), setSaved(false))}
            placeholder="sk-ant-…"
            className="h-10 flex-1 rounded-xl border border-line bg-black/20 px-3.5 font-mono text-sm outline-none focus:border-ion/50"
          />
          <Button variant="primary" onClick={saveKey} disabled={!key.trim()}>
            <KeyRound size={14} /> Save key
          </Button>
        </div>
        {saved && <p className="mt-2 px-5 text-xs text-aurora">Saved to keychain.</p>}
      </GlassPanel>

      <GlassPanel className="pb-5">
        <PanelHeader
          title="Video engine"
          hint="FFmpeg adapts each upload to the platform's frame, length and file size limits."
          right={
            inTauri && (
              <Button size="sm" onClick={recheck} disabled={checking}>
                <RefreshCw size={13} className={cn(checking && "animate-spin")} /> Check again
              </Button>
            )
          }
        />
        <div className="mt-4 space-y-2 px-5 text-sm">
          {!inTauri ? (
            <span className="text-ink-mute">Status is checked in the desktop app.</span>
          ) : !engine ? (
            <span className="text-ink-mute">Checking…</span>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {engine.ready ? (
                  <CheckCircle2 size={16} className="text-aurora" />
                ) : (
                  <XCircle size={16} className="text-flare" />
                )}
                <span>{engine.ready ? "Ready: H.264 (OpenH264) and AAC available" : "Not ready. Publishing is disabled."}</span>
              </div>
              {engine.problem && (
                <p role="alert" className="rounded-xl border border-flare/30 bg-flare/10 px-3.5 py-2.5 text-xs text-flare">
                  {engine.problem}
                </p>
              )}
              <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-ink-mute">Source</dt>
                <dd>{SOURCE_LABEL[engine.source]}</dd>
                <dt className="text-ink-mute">Version</dt>
                <dd className="num">{engine.version ?? "unknown"}</dd>
                <dt className="text-ink-mute">Path</dt>
                <dd className="truncate font-mono text-[11px] text-ink-soft" title={engine.path}>
                  {engine.path}
                </dd>
              </dl>
            </>
          )}
        </div>
      </GlassPanel>

      <GlassPanel className="pb-5">
        <PanelHeader
          title="Export quality"
          hint="Bitrate for re-encoded videos. Long videos are lowered automatically to stay under each platform's size limit."
        />
        <div role="radiogroup" aria-label="Export quality" className="mt-4 grid grid-cols-3 gap-2 px-5">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              role="radio"
              aria-checked={exportQuality === q.id}
              onClick={() => setExportQuality(q.id)}
              className={cn(
                "rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                exportQuality === q.id ? "border-ion/50 bg-ion/10" : "border-line hover:border-ion/30",
              )}
            >
              <span className="block text-sm">{q.label}</span>
              <span className="mt-0.5 block text-[11px] text-ink-mute">{q.hint}</span>
            </button>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="flex items-center gap-5 p-5">
        <img src={appIcon} width={72} height={72} alt="" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Connect<span className="bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">ors</span>
          </h2>
          <p className="text-xs uppercase tracking-[0.2em] text-ink-mute">One video · every platform</p>
          <p className="num mt-2 text-sm text-ink-soft">Version {__APP_VERSION__}</p>
        </div>
      </GlassPanel>
    </div>
  );
}

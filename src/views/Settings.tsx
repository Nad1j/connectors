import { CheckCircle2, KeyRound, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { GlassPanel, PanelHeader } from "@/components/ui/GlassPanel";
import { inTauri, invoke } from "@/lib/tauri";

export function Settings() {
  const [ffmpeg, setFfmpeg] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (inTauri) invoke<boolean>("media_ffmpeg_available").then(setFfmpeg);
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
        <PanelHeader title="Video engine" hint="FFmpeg adapts each upload to the platform's frame and length limits." />
        <div className="mt-4 flex items-center gap-2 px-5 text-sm">
          {ffmpeg === null ? (
            <span className="text-ink-mute">Status is checked in the desktop app.</span>
          ) : ffmpeg ? (
            <>
              <CheckCircle2 size={16} className="text-aurora" /> FFmpeg found
            </>
          ) : (
            <>
              <XCircle size={16} className="text-flare" /> FFmpeg not found. Install it or set FFMPEG_PATH, then restart.
            </>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

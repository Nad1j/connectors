import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { generateCopy } from "@/services/ai/captionService";
import { cn } from "@/lib/utils";
import type { AiSuggestion } from "@/types";

const TONES = ["Casual", "Bold", "Explainer", "Playful"];

export function AIAssistant() {
  const { draft, applySuggestion } = useAppStore();
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiSuggestion | null>(null);

  async function run() {
    if (!brief.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await generateCopy(brief, draft.platforms, tone);
      setResult(r);
      applySuggestion(r, 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-black/20 focus-within:border-ion/50 focus-within:shadow-glow">
        <label htmlFor="ai-brief" className="sr-only">
          Describe the video
        </label>
        <textarea
          id="ai-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && run()}
          placeholder="What happens in the video? e.g. Color grading a sunset clip in 60 seconds with one LUT"
          rows={3}
          className="w-full resize-none bg-transparent px-3.5 pt-3 text-sm text-ink outline-none placeholder:text-ink-mute"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex flex-wrap gap-0.5">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={cn(
                  "rounded-md px-1.5 py-1 text-[11px] transition-colors",
                  tone === t ? "bg-ion/20 text-ink" : "text-ink-mute hover:text-ink-soft",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={run}
            disabled={busy || !brief.trim()}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-r from-ion to-aurora/80 px-3 text-xs font-medium text-white disabled:opacity-40"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            Write copy
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-flare">{error}</p>}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-1.5 overflow-hidden">
            <p className="text-[11px] text-ink-mute">Title options</p>
            {result.titles.map((t, i) => (
              <button
                key={t}
                onClick={() => applySuggestion(result, i)}
                className={cn(
                  "block w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  draft.title === t ? "border-ion/50 bg-ion/10 text-ink" : "border-line text-ink-soft hover:border-ion/30",
                )}
              >
                {t}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

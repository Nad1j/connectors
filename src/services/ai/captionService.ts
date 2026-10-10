import { inTauri, invoke } from "@/lib/tauri";
import type { AiSuggestion, PlatformId } from "@/types";

/** The LLM call runs in Rust so API keys stay in the OS keychain. */
export async function generateCopy(brief: string, platforms: PlatformId[], tone?: string): Promise<AiSuggestion> {
  if (inTauri) return invoke<AiSuggestion>("ai_generate", { request: { brief, platforms, tone } });

  await new Promise((r) => setTimeout(r, 900));
  const topic = brief.split(/\W+/).find((w) => w.length > 3)?.toLowerCase() ?? "this";
  return {
    titles: [
      `I tried ${topic} for 30 days — here's what changed`,
      `The ${topic} mistake almost everyone makes`,
      `${topic[0].toUpperCase()}${topic.slice(1)} in 60 seconds`,
    ],
    caption: `${brief.trim()}\n\nSave this for later and tell me in the comments what you'd try first.`,
    hashtags: [topic, "creator", "filmmaking", "behindthescenes", "howto", "tutorial", "fyp", "contentcreator"],
    source: "preview",
  };
}

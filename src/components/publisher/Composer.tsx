import { X } from "lucide-react";
import { useState } from "react";
import { PLATFORMS } from "@/config/platforms";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function Composer() {
  const { draft, setCopy } = useAppStore();
  const [tag, setTag] = useState("");
  const fullLength = (draft.caption + " " + draft.hashtags.map((h) => `#${h}`).join(" ")).trim().length;
  const tightest = draft.platforms
    .map((p) => PLATFORMS[p])
    .sort((a, b) => a.captionLimit - b.captionLimit)[0];
  const over = tightest && fullLength > tightest.captionLimit;

  function addTag() {
    const t = tag.trim().replace(/^#/, "").toLowerCase();
    if (t && !draft.hashtags.includes(t)) setCopy({ hashtags: [...draft.hashtags, t] });
    setTag("");
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="title" className="mb-1.5 block text-xs text-ink-soft">
          Title
        </label>
        <input
          id="title"
          value={draft.title}
          onChange={(e) => setCopy({ title: e.target.value })}
          placeholder="Hook viewers in the first few words"
          className="h-10 w-full rounded-xl border border-line bg-black/20 px-3.5 text-sm outline-none placeholder:text-ink-mute focus:border-ion/50"
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <label htmlFor="caption" className="text-xs text-ink-soft">
            Caption
          </label>
          {tightest && (
            <span className={cn("num text-[11px]", over ? "text-flare" : "text-ink-mute")}>
              {fullLength} / {tightest.captionLimit} {tightest.name}
            </span>
          )}
        </div>
        <textarea
          id="caption"
          value={draft.caption}
          onChange={(e) => setCopy({ caption: e.target.value })}
          rows={4}
          placeholder="Write once. Long captions are shortened automatically where a platform's limit is lower."
          className="w-full resize-none rounded-xl border border-line bg-black/20 px-3.5 py-2.5 text-sm leading-relaxed outline-none placeholder:text-ink-mute focus:border-ion/50"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-black/20 p-2">
        {draft.hashtags.map((h) => (
          <span key={h} className="inline-flex items-center gap-1 rounded-md bg-ion/10 py-0.5 pl-2 pr-1 text-xs text-ion">
            #{h}
            <button
              onClick={() => setCopy({ hashtags: draft.hashtags.filter((x) => x !== h) })}
              className="rounded p-0.5 hover:bg-ion/20"
              aria-label={`Remove #${h}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === " ") {
              e.preventDefault();
              addTag();
            }
          }}
          onBlur={addTag}
          aria-label="Add hashtag"
          placeholder={draft.hashtags.length ? "" : "Add hashtags"}
          className="min-w-[90px] flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-ink-mute"
        />
      </div>
    </div>
  );
}

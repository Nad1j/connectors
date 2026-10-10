import type { PlatformId } from "@/types";
import { PLATFORMS } from "@/config/platforms";

interface Props {
  id: PlatformId;
  size?: number;
  mono?: boolean;
  className?: string;
}

/** Simplified brand glyphs (Lucide no longer ships brand marks). */
export function PlatformIcon({ id, size = 18, mono = false, className }: Props) {
  const c = mono ? "currentColor" : PLATFORMS[id].color;
  const common = { width: size, height: size, viewBox: "0 0 24 24", className, "aria-hidden": true } as const;
  switch (id) {
    case "youtube":
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="4.5" fill={c} />
          <path d="M10 9.2v5.6l4.8-2.8z" fill="#0A1020" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path
            d="M14.5 3h2.6c.3 2 1.6 3.4 3.6 3.6v2.7c-1.4 0-2.7-.4-3.7-1.1v6.3a5.4 5.4 0 1 1-5.4-5.4c.3 0 .6 0 .9.1v2.8a2.6 2.6 0 1 0 2 2.5z"
            fill={c}
          />
        </svg>
      );
    case "instagram":
      return (
        <svg {...common} fill="none" stroke={c} strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="5.5" />
          <circle cx="12" cy="12" r="4.2" />
          <circle cx="17.4" cy="6.6" r="1.1" fill={c} stroke="none" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill={c} />
          <path d="M13.2 20v-6.2h2.1l.4-2.5h-2.5V9.7c0-.7.3-1.3 1.4-1.3h1.2V6.2s-1-.2-2-.2c-2 0-3.3 1.2-3.3 3.4v1.9H8.3v2.5h2.2V20z" fill="#0A1020" />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path d="M4 4h4.6l3.9 5.4L17.2 4H20l-6.2 7.1L20.5 20h-4.6l-4.2-5.8L6.6 20H3.8l6.6-7.6z" fill={c} />
        </svg>
      );
  }
}

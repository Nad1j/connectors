import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const SEEN_KEY = "connectors.introSeen";
const DURATION_MS = 1700;

/** Node centers of the five platforms in branding/app-icon.svg (512 viewBox). */
const NODES: [number, number][] = [
  [256, 106],
  [398.66, 209.65],
  [344.17, 377.35],
  [167.83, 377.35],
  [113.34, 209.65],
];

function readSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* storage unavailable: the intro may show again, which is harmless */
  }
}

/**
 * First-launch logo intro: the hub appears, then the five platform nodes light
 * up one by one. Under 2 s, skippable with a click or any key, and skipped
 * entirely when the OS asks for reduced motion.
 */
export function IntroSplash() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(() => !readSeen());

  useEffect(() => {
    if (!show) return;
    if (reduced) {
      markSeen();
      setShow(false);
      return;
    }
    const done = () => (markSeen(), setShow(false));
    const timer = window.setTimeout(done, DURATION_MS);
    window.addEventListener("keydown", done);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", done);
    };
  }, [show, reduced]);

  return (
    <AnimatePresence>
      {show && !reduced && (
        <motion.div
          className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-brand-bg"
          onClick={() => (markSeen(), setShow(false))}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          role="presentation"
        >
          <div className="flex flex-col items-center gap-6">
            <svg width="168" height="168" viewBox="0 0 512 512" aria-label="Connectors">
              <defs>
                <linearGradient id="intro-neon" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#38BDF8" />
                  <stop offset="1" stopColor="#34D399" />
                </linearGradient>
                <filter id="intro-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="9" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx="256" cy="256" r="150" fill="none" stroke="url(#intro-neon)" strokeOpacity="0.22" strokeWidth="3" />
              {NODES.map(([x, y], i) => {
                const delay = 0.35 + i * 0.16;
                return (
                  <g key={i}>
                    <motion.line
                      x1="256" y1="256" x2={x} y2={y}
                      stroke="url(#intro-neon)" strokeWidth="7" strokeLinecap="round" filter="url(#intro-glow)"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay, duration: 0.22 }}
                    />
                    <motion.g
                      initial={{ opacity: 0.12, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: delay + 0.15, duration: 0.25 }}
                      style={{ transformOrigin: `${x}px ${y}px` }}
                    >
                      <circle cx={x} cy={y} r="26" fill="url(#intro-neon)" filter="url(#intro-glow)" />
                      <circle cx={x} cy={y} r="11" fill="#0B1020" />
                    </motion.g>
                  </g>
                );
              })}
              <motion.g
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                style={{ transformOrigin: "256px 256px" }}
              >
                <circle cx="256" cy="256" r="62" fill="url(#intro-neon)" filter="url(#intro-glow)" />
                <circle cx="256" cy="256" r="62" fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="3" />
                <path d="M240 226 L240 286 L292 256 Z" fill="#0B1020" />
              </motion.g>
            </svg>
            <motion.span
              className="text-2xl font-semibold tracking-tight text-ink"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.1, duration: 0.3 }}
            >
              Connect<span className="bg-gradient-to-r from-brand-blue to-brand-green bg-clip-text text-transparent">ors</span>
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

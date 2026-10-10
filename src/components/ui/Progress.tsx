import { motion } from "framer-motion";

export function ProgressBar({ value, color = "#6C8CFF", done }: { value: number; color?: string; done?: boolean }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: done ? "#3EE6C4" : color, boxShadow: `0 0 12px ${done ? "#3EE6C4" : color}` }}
        initial={false}
        animate={{ width: `${Math.max(2, value * 100)}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 24 }}
      />
    </div>
  );
}

import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-ion to-ion-deep text-white shadow-glow hover:brightness-110 disabled:opacity-40 disabled:shadow-none",
  outline: "border border-line bg-white/[0.03] text-ink hover:border-ion/50 hover:bg-ion/10 disabled:opacity-40",
  ghost: "text-ink-soft hover:bg-white/5 hover:text-ink disabled:opacity-40",
  danger: "border border-flare/30 text-flare hover:bg-flare/10",
};

interface Props extends HTMLMotionProps<"button"> {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
}

// forwardRef so Radix `asChild` triggers can attach their ref.
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "outline", size = "md", className, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[filter,background-color,border-color,color] disabled:cursor-not-allowed",
        size === "sm" && "h-8 px-3 text-xs",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-5 text-[15px]",
        styles[variant],
        className,
      )}
      {...rest}
    />
  );
});

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      colors: {
        void: "#070B16",
        base: "#0A1020",
        panel: "#0F1729",
        line: "rgba(148, 170, 255, 0.10)",
        ink: { DEFAULT: "#E6EBFF", soft: "#A3AECF", mute: "#66718F" },
        ion: { DEFAULT: "#6C8CFF", deep: "#4B67E0" },
        aurora: "#3EE6C4",
        flare: "#FF6B8B",
        amber: "#FFC163",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(108,140,255,.35), 0 0 24px -4px rgba(108,140,255,.45)",
        "glow-teal": "0 0 0 1px rgba(62,230,196,.35), 0 0 24px -6px rgba(62,230,196,.5)",
        glass: "inset 0 1px 0 rgba(255,255,255,.04), 0 20px 40px -24px rgba(0,0,0,.8)",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(148,170,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148,170,255,.045) 1px, transparent 1px)",
      },
    },
  },
  plugins: [],
};

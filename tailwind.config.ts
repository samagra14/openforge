import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "of-primary": "#1a1a1e",
        "of-secondary": "#222226",
        "of-tertiary": "#2a2a2e",
        "of-input": "#2e2e33",
        "of-border": "#333338",
        "of-text": "#e8e8ec",
        "of-text-secondary": "#8e8e93",
        "of-text-tertiary": "#5e5e63",
        "of-accent": "#f5a623",
        "of-accent-dim": "#c4841d",
        "of-success": "#34c759",
        "of-error": "#ff453a",
        "of-user-msg": "#2a2a30",
        "of-code": "#1e1e22",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "sans-serif"],
        mono: ["SF Mono", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": "11px",
      },
    },
  },
  plugins: [],
} satisfies Config;

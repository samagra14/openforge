import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "of-primary": "var(--bg-primary)",
        "of-secondary": "var(--bg-secondary)",
        "of-tertiary": "var(--bg-tertiary)",
        "of-input": "var(--bg-input)",
        "of-elevated": "var(--bg-elevated)",
        "of-border": "var(--border)",
        "of-border-strong": "var(--border-strong)",
        "of-text": "var(--text-primary)",
        "of-text-secondary": "var(--text-secondary)",
        "of-text-tertiary": "var(--text-tertiary)",
        "of-accent": "var(--accent)",
        "of-accent-hover": "var(--accent-hover)",
        "of-accent-dim": "var(--accent-dim)",
        "of-success": "var(--success)",
        "of-error": "var(--error)",
        "of-user-msg": "var(--user-msg-bg)",
        "of-code": "var(--code-bg)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Text", "SF Pro Display", "system-ui", "sans-serif"],
        mono: ["SF Mono", "Menlo", "Monaco", "monospace"],
      },
      fontSize: {
        "2xs": "11px",
      },
      boxShadow: {
        "of-xs": "var(--shadow-xs)",
        "of-sm": "var(--shadow-sm)",
        "of-md": "var(--shadow-md)",
        "of-lg": "var(--shadow-lg)",
      },
    },
  },
  plugins: [],
} satisfies Config;

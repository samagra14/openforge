import { useState, useEffect, useCallback } from "react";

const SLASH_COMMANDS = [
  { command: "/compact", description: "Clear conversation history but keep a summary in context. Optional: /compact [instructions for summarization]" },
  { command: "/clear", description: "Clear conversation context and start fresh" },
  { command: "/restart", description: "Restart the Claude session completely" },
  { command: "/help", description: "Get help with available commands" },
  { command: "/init", description: "Initialize project with a CLAUDE.md file" },
  { command: "/review", description: "Review code changes in the current workspace" },
  { command: "/bug", description: "Report a bug or issue" },
] as const;

interface Props {
  filter: string;
  onSelect: (command: string) => void;
  onDismiss: () => void;
}

export function SlashCommandMenu({ filter, onSelect, onDismiss }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = SLASH_COMMANDS.filter((cmd) =>
    cmd.command.startsWith(filter.toLowerCase())
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (filtered.length === 0) return;

      if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const item = filtered[selectedIndex];
        if (item) onSelect(item.command);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
      }
    },
    [filtered, selectedIndex, onSelect, onDismiss]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);

  if (filtered.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 rounded-xl overflow-hidden z-50 animate-fade-in-scale"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.command}
          onClick={() => onSelect(cmd.command)}
          onMouseEnter={() => setSelectedIndex(i)}
          className="w-full text-left flex items-start gap-3 px-4 py-2.5 transition-colors"
          style={{
            background: i === selectedIndex ? "var(--bg-tertiary)" : "transparent",
          }}
        >
          <span
            className="font-mono font-medium flex-shrink-0"
            style={{ color: "var(--accent)", fontSize: 13 }}
          >
            {cmd.command}
          </span>
          <span
            className="text-xs leading-relaxed"
            style={{ color: "var(--text-tertiary)", paddingTop: 1 }}
          >
            {cmd.description}
          </span>
        </button>
      ))}
    </div>
  );
}

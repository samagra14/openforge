import { useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { useChatSearch } from "./ChatSearchContext";
import { useUIStore } from "../../stores/ui";

export function ChatSearchBar() {
  const { query, setQuery, currentMatchIndex, totalMatches, goToNext, goToPrevious } =
    useChatSearch();
  const setChatSearchOpen = useUIStore((s) => s.setChatSearchOpen);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setChatSearchOpen(false);
      setQuery("");
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevious();
      } else {
        goToNext();
      }
    }
    // Cmd+G / Cmd+Shift+G
    if (e.metaKey && e.key === "g") {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevious();
      } else {
        goToNext();
      }
    }
  };

  return (
    <div
      className="absolute top-2 right-4 z-30 flex items-center gap-2 px-3 py-2 rounded-xl animate-fade-in-scale"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search messages..."
        className="bg-transparent outline-none text-sm"
        style={{
          color: "var(--text-primary)",
          width: 180,
        }}
      />

      {query && (
        <span
          className="text-xs font-mono flex-shrink-0"
          style={{ color: "var(--text-tertiary)" }}
        >
          {totalMatches > 0
            ? `${currentMatchIndex + 1} of ${totalMatches}`
            : "0 results"}
        </span>
      )}

      <div className="flex items-center gap-0.5">
        <button
          onClick={goToPrevious}
          disabled={totalMatches === 0}
          className="p-1 rounded hover-bg transition-colors disabled:opacity-30"
          title="Previous (⇧Enter)"
        >
          <ChevronUp size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
        <button
          onClick={goToNext}
          disabled={totalMatches === 0}
          className="p-1 rounded hover-bg transition-colors disabled:opacity-30"
          title="Next (Enter)"
        >
          <ChevronDown size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
        <button
          onClick={() => {
            setChatSearchOpen(false);
            setQuery("");
          }}
          className="p-1 rounded hover-bg transition-colors"
          title="Close (Esc)"
        >
          <X size={14} style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>
    </div>
  );
}

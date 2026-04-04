import { useEffect, useId, useMemo, useRef } from "react";
import { useChatSearchOptional } from "./ChatSearchContext";

interface Props {
  text: string;
}

/**
 * Renders text with search query matches highlighted.
 * Integrates with ChatSearchContext for match counting and navigation.
 */
export function HighlightText({ text }: Props) {
  const ctx = useChatSearchOptional();
  const instanceId = useId();
  const activeRef = useRef<HTMLElement | null>(null);

  const query = ctx?.query ?? "";

  // Split text into segments by search query (case-insensitive)
  const { segments, matchCount } = useMemo(() => {
    if (!query.trim()) {
      return { segments: [{ text, isMatch: false }], matchCount: 0 };
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const lowerQuery = escaped.toLowerCase();

    // Use string split to avoid regex.test() lastIndex bugs
    const parts: { text: string; isMatch: boolean }[] = [];
    let remaining = text;
    let count = 0;

    while (remaining.length > 0) {
      const lowerRemaining = remaining.toLowerCase();
      const idx = lowerRemaining.indexOf(lowerQuery);
      if (idx === -1) {
        parts.push({ text: remaining, isMatch: false });
        break;
      }
      if (idx > 0) {
        parts.push({ text: remaining.slice(0, idx), isMatch: false });
      }
      parts.push({ text: remaining.slice(idx, idx + query.length), isMatch: true });
      count++;
      remaining = remaining.slice(idx + query.length);
    }

    return { segments: parts, matchCount: count };
  }, [text, query]);

  // Register/unregister match count with context
  useEffect(() => {
    if (!ctx) return;
    ctx.registerMatches(instanceId, matchCount);
    return () => ctx.unregisterMatches(instanceId);
  }, [ctx, instanceId, matchCount]);

  // Scroll active match into view
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [ctx?.currentMatchIndex]);

  if (!query.trim()) {
    return <>{text}</>;
  }

  let matchIdx = 0;

  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.isMatch) {
          return <span key={i}>{seg.text}</span>;
        }

        const globalIdx = ctx?.getGlobalIndex(instanceId, matchIdx) ?? -1;
        const isActive = globalIdx === ctx?.currentMatchIndex;
        matchIdx++;

        return (
          <mark
            key={i}
            ref={isActive ? (el) => { activeRef.current = el; } : undefined}
            className={isActive ? "search-highlight-active" : "search-highlight"}
          >
            {seg.text}
          </mark>
        );
      })}
    </>
  );
}

interface Props {
  segments: [text: string, isHighlight: boolean][] | null;
  className?: string;
}

/**
 * Renders text with fuzzy-matched characters highlighted.
 * Handles null/empty segments gracefully.
 */
export function HighlightMatch({ segments, className }: Props) {
  if (!segments || segments.length === 0) {
    return null;
  }

  return (
    <span className={className}>
      {segments.map(([text, isHighlight], i) =>
        isHighlight ? (
          <mark
            key={i}
            style={{
              background: "var(--accent-subtle)",
              color: "var(--accent)",
              borderRadius: 2,
              padding: "0 1px",
            }}
          >
            {text}
          </mark>
        ) : (
          <span key={i}>{text}</span>
        )
      )}
    </span>
  );
}

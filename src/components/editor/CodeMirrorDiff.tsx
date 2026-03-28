import { useEffect, useRef, useState } from "react";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { MergeView } from "@codemirror/merge";
import { unifiedMergeView } from "@codemirror/merge";
import { getLanguageExtension } from "./languageExtension";
import { forgeTheme, isDarkMode } from "./editorTheme";
import { commands } from "../../lib/tauri";

interface Props {
  workspaceId: string;
  filePath: string;
}

type DiffMode = "side-by-side" | "unified";

function countDiffStats(original: string, modified: string): { added: number; removed: number } {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  // Simple heuristic: count line differences
  const origSet = new Set(origLines);
  const modSet = new Set(modLines);
  let added = 0;
  let removed = 0;
  for (const line of modLines) {
    if (!origSet.has(line)) added++;
  }
  for (const line of origLines) {
    if (!modSet.has(line)) removed++;
  }
  return { added, removed };
}

export function CodeMirrorDiff({ workspaceId, filePath }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const unifiedViewRef = useRef<EditorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<DiffMode>("side-by-side");
  const [stats, setStats] = useState<{ added: number; removed: number } | null>(null);
  const contentRef = useRef<{ original: string; modified: string } | null>(null);

  // Fetch content
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      commands.readFileAtRef(workspaceId, filePath),
      commands.readFile(workspaceId, filePath),
    ])
      .then(([original, modified]) => {
        if (cancelled) return;
        contentRef.current = { original, modified };
        setStats(countDiffStats(original, modified));
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(String(e));
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, filePath]);

  // Render editor when content loaded or mode changes
  useEffect(() => {
    if (loading || !contentRef.current || !containerRef.current) return;

    const { original, modified } = contentRef.current;

    // Cleanup previous
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
      mergeViewRef.current = null;
    }
    if (unifiedViewRef.current) {
      unifiedViewRef.current.destroy();
      unifiedViewRef.current = null;
    }

    // Clear container
    containerRef.current.innerHTML = "";

    const langExt = getLanguageExtension(filePath, modified);
    const darkExt = isDarkMode() ? [EditorView.theme({}, { dark: true })] : [];
    const baseExtensions = [
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      lineNumbers(),
      ...forgeTheme,
      ...darkExt,
      ...(langExt ? [langExt] : []),
    ];

    if (mode === "side-by-side") {
      mergeViewRef.current = new MergeView({
        a: {
          doc: original,
          extensions: baseExtensions,
        },
        b: {
          doc: modified,
          extensions: baseExtensions,
        },
        parent: containerRef.current,
      });
    } else {
      // Unified view
      const mergeCompartment = new Compartment();
      const extensions = [
        ...baseExtensions,
        mergeCompartment.of(
          unifiedMergeView({
            original,
            mergeControls: false,
          })
        ),
      ];

      unifiedViewRef.current = new EditorView({
        doc: modified,
        extensions,
        parent: containerRef.current,
      });
    }

    return () => {
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }
      if (unifiedViewRef.current) {
        unifiedViewRef.current.destroy();
        unifiedViewRef.current = null;
      }
    };
  }, [loading, mode, filePath]);

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-sm" style={{ color: "var(--error)" }}>
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 text-xs"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "var(--bg-secondary)",
        }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: "var(--text-primary)" }}>{filePath}</span>
          {stats && (
            <span className="flex items-center gap-2">
              <span style={{ color: "var(--success)" }}>+{stats.added}</span>
              <span style={{ color: "var(--error)" }}>-{stats.removed}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("side-by-side")}
            className="px-2 py-1 rounded text-xs transition-colors"
            style={{
              background: mode === "side-by-side" ? "var(--bg-tertiary)" : "transparent",
              color: mode === "side-by-side" ? "var(--text-primary)" : "var(--text-tertiary)",
            }}
          >
            Side by side
          </button>
          <button
            onClick={() => setMode("unified")}
            className="px-2 py-1 rounded text-xs transition-colors"
            style={{
              background: mode === "unified" ? "var(--bg-tertiary)" : "transparent",
              color: mode === "unified" ? "var(--text-primary)" : "var(--text-tertiary)",
            }}
          >
            Unified
          </button>
        </div>
      </div>

      {/* Editor container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{
          opacity: loading ? 0 : 1,
          background: "var(--code-bg)",
        }}
      />

      {loading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            Loading diff...
          </p>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { EditorView, lineNumbers } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { getLanguageExtension } from "./languageExtension";
import { forgeTheme, isDarkMode } from "./editorTheme";
import { commands } from "../../lib/tauri";

interface Props {
  workspaceId: string;
  filePath: string;
}

export function CodeMirrorEditor({ workspaceId, filePath }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    commands
      .readFile(workspaceId, filePath)
      .then((content) => {
        if (cancelled || !containerRef.current) return;

        // Destroy previous view
        if (viewRef.current) {
          viewRef.current.destroy();
          viewRef.current = null;
        }

        const extensions = [
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
          lineNumbers(),
          ...forgeTheme,
          ...(isDarkMode() ? [EditorView.theme({}, { dark: true })] : []),
        ];

        const langExt = getLanguageExtension(filePath, content);
        if (langExt) extensions.push(langExt);

        const state = EditorState.create({ doc: content, extensions });
        viewRef.current = new EditorView({
          state,
          parent: containerRef.current,
        });

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
      if (viewRef.current) {
        viewRef.current.destroy();
        viewRef.current = null;
      }
    };
  }, [workspaceId, filePath]);

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
      {/* File path header */}
      <div
        className="flex items-center px-4 py-2 text-xs"
        style={{
          borderBottom: "1px solid var(--border)",
          color: "var(--text-tertiary)",
          background: "var(--bg-secondary)",
        }}
      >
        <span style={{ color: "var(--text-primary)" }}>{filePath}</span>
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
            Loading...
          </p>
        </div>
      )}
    </div>
  );
}

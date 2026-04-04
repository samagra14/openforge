import { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";
import { useTabStore } from "../../stores/tabs";
import { createFuzzySearcher } from "../../lib/fuzzySearch";
import { HighlightMatch } from "./HighlightMatch";
import { FileTypeIcon } from "../common/FileTypeIcon";
import { commands } from "../../lib/tauri";

interface Props {
  query: string;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  onClose: () => void;
}

export function FilePickerContent({ query, selectedIndex, setSelectedIndex, onClose }: Props) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [files, setFiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    commands
      .listFilesFlat(activeWorkspaceId)
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeWorkspaceId]);

  const searcher = useMemo(
    () => createFuzzySearcher(files, [(f) => f.split("/").pop() ?? f, (f) => f]),
    [files]
  );

  const results = useMemo(() => {
    if (!query.trim()) {
      return files.slice(0, 50).map((f) => ({
        path: f,
        highlights: [[f.split("/").pop() ?? f, false]] as [string, boolean][],
      }));
    }
    return searcher.search(query, 50).map((r) => ({
      path: r.item,
      highlights: r.highlights,
    }));
  }, [query, files, searcher]);

  const handleSelect = useCallback(
    (path: string) => {
      if (!activeWorkspaceId) return;
      useTabStore.getState().openFileTab(activeWorkspaceId, path);
      onClose();
    },
    [activeWorkspaceId, onClose]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
      } else if (e.key === "Enter" && results.length > 0 && selectedIndex < results.length) {
        e.preventDefault();
        const path = results[selectedIndex]?.path;
        if (path) handleSelect(path);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [results, selectedIndex, setSelectedIndex, handleSelect]);

  if (!activeWorkspaceId) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        No active workspace. Open a workspace first.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 size={20} className="animate-spin" style={{ color: "var(--text-tertiary)" }} />
      </div>
    );
  }

  if (results.length === 0 && query.trim()) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        No files found.
      </div>
    );
  }

  return (
    <>
      {results.map((result, i) => {
        const fileName = result.path.split("/").pop() ?? result.path;
        const dir = result.path.includes("/")
          ? result.path.slice(0, result.path.lastIndexOf("/"))
          : "";

        return (
          <div
            key={result.path}
            onClick={() => handleSelect(result.path)}
            onMouseEnter={() => setSelectedIndex(i)}
            className="command-palette-item"
            style={{ background: i === selectedIndex ? "var(--bg-tertiary)" : "transparent" }}
          >
            <FileTypeIcon filename={fileName} size={16} />
            <span className="font-medium truncate" style={{ color: "var(--text-primary)", fontSize: 13 }}>
              <HighlightMatch segments={result.highlights} />
            </span>
            {dir && (
              <span className="text-xs truncate ml-2" style={{ color: "var(--text-tertiary)" }}>
                {dir}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

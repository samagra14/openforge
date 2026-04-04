import { useMemo, useEffect, useCallback } from "react";
import { LayoutGrid, Archive } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";
import { createFuzzySearcher } from "../../lib/fuzzySearch";
import { HighlightMatch } from "./HighlightMatch";

interface Props {
  query: string;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  onClose: () => void;
}

interface WorkspaceItem {
  id: string;
  cityName: string;
  repoName: string;
  branchName: string;
  taskDescription: string;
  status: string;
  index: number;
}

export function WorkspaceSearchContent({ query, selectedIndex, setSelectedIndex, onClose }: Props) {
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const repos = useWorkspaceStore((s) => s.repos);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  const repoMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of repos) m.set(r.id, r.name);
    return m;
  }, [repos]);

  const items: WorkspaceItem[] = useMemo(() => {
    const active = workspaces.filter((w) => w.status === "active");
    const archived = workspaces.filter((w) => w.status === "archived");
    return [...active, ...archived].map((ws, i) => ({
      id: ws.id,
      cityName: ws.city_name,
      repoName: repoMap.get(ws.repo_id) ?? "",
      branchName: ws.branch_name,
      taskDescription: ws.task_description ?? "",
      status: ws.status,
      index: i,
    }));
  }, [workspaces, repoMap]);

  const searcher = useMemo(
    () => createFuzzySearcher(items, [(i) => i.cityName, (i) => i.taskDescription, (i) => i.branchName, (i) => i.repoName]),
    [items]
  );

  const results = useMemo(() => {
    if (!query.trim()) {
      return items.slice(0, 30).map((item) => ({
        item,
        highlights: [[item.cityName, false]] as [string, boolean][],
      }));
    }
    return searcher.search(query, 30).map((r) => ({
      item: r.item,
      highlights: r.highlights,
    }));
  }, [query, items, searcher]);

  const handleSelect = useCallback(
    (id: string) => {
      setActiveWorkspace(id);
      onClose();
    },
    [setActiveWorkspace, onClose]
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
        const id = results[selectedIndex]?.item?.id;
        if (id) handleSelect(id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [results, selectedIndex, setSelectedIndex, handleSelect]);

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        No workspaces found. Press ⌘N to create one.
      </div>
    );
  }

  if (results.length === 0 && query.trim()) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        No matching workspaces.
      </div>
    );
  }

  return (
    <>
      {results.map(({ item, highlights }, i) => {
        const isArchived = item.status === "archived";

        return (
          <div
            key={item.id}
            onClick={() => handleSelect(item.id)}
            onMouseEnter={() => setSelectedIndex(i)}
            className="command-palette-item"
            style={{
              background: i === selectedIndex ? "var(--bg-tertiary)" : "transparent",
              opacity: isArchived ? 0.5 : 1,
            }}
          >
            {isArchived ? (
              <Archive size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            ) : (
              <LayoutGrid size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            )}
            <span className="font-medium truncate" style={{ color: "var(--text-primary)", fontSize: 13 }}>
              <HighlightMatch segments={highlights} />
            </span>
            <span className="text-xs truncate" style={{ color: "var(--text-tertiary)", maxWidth: 100 }}>
              {item.repoName}
            </span>
            <span className="text-xs font-mono truncate" style={{ color: "var(--text-tertiary)", maxWidth: 140 }}>
              {item.branchName}
            </span>
            {isArchived && (
              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}>
                archived
              </span>
            )}
            {!isArchived && item.index < 9 && (
              <span className="text-xs font-mono ml-auto flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
                ⌘{item.index + 1}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

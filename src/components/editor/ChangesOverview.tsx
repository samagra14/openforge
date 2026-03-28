import { useEffect, useState } from "react";
import { commands, type DiffEntry } from "../../lib/tauri";
import { useTabStore } from "../../stores/tabs";
import { FileTypeIcon } from "../common/FileTypeIcon";

interface Props {
  workspaceId: string;
}

export function ChangesOverview({ workspaceId }: Props) {
  const [entries, setEntries] = useState<DiffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
  } | null>(null);

  const openDiffTab = useTabStore((s) => s.openDiffTab);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      commands.getDiff(workspaceId),
      commands.getWorkspaceStatus(workspaceId),
    ])
      .then(([diffEntries, status]) => {
        setEntries(diffEntries);
        setStats({
          filesChanged: status.files_changed,
          linesAdded: status.lines_added,
          linesRemoved: status.lines_removed,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="p-6 text-sm" style={{ color: "var(--text-tertiary)" }}>
        Loading changes...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
          No changes detected.
        </p>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const letter = status[0].toUpperCase();
    const color =
      status === "added"
        ? "var(--success)"
        : status === "deleted"
          ? "var(--error)"
          : "var(--accent)";
    return (
      <span className="text-xs font-mono font-semibold" style={{ color }}>
        {letter}
      </span>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Stats header */}
      {stats && (
        <div
          className="flex items-center gap-4 px-6 py-3 text-sm"
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          <span style={{ color: "var(--text-secondary)" }}>
            {stats.filesChanged} file{stats.filesChanged !== 1 ? "s" : ""} changed
          </span>
          <span style={{ color: "var(--success)" }}>+{stats.linesAdded}</span>
          <span style={{ color: "var(--error)" }}>-{stats.linesRemoved}</span>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-y-auto py-1">
        {entries.map((entry) => (
          <button
            key={entry.path}
            onClick={() => openDiffTab(workspaceId, entry.path)}
            className="w-full flex items-center gap-3 px-6 py-2.5 text-sm hover-bg transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <FileTypeIcon
              filename={entry.path.split("/").pop() ?? entry.path}
              size={14}
            />
            <span
              className="truncate flex-1 text-left"
              style={{ letterSpacing: "-0.01em" }}
            >
              {entry.path}
            </span>
            {statusBadge(entry.status)}
          </button>
        ))}
      </div>
    </div>
  );
}

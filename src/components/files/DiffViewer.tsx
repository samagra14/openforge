import { useEffect, useState } from "react";
import { commands, type DiffEntry } from "../../lib/tauri";
import { FileTypeIcon } from "../common/FileTypeIcon";
import { useTabStore } from "../../stores/tabs";

interface Props {
  workspaceId: string;
}

export function DiffViewer({ workspaceId }: Props) {
  const [entries, setEntries] = useState<DiffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const openDiffTab = useTabStore((s) => s.openDiffTab);
  const openChangesOverviewTab = useTabStore((s) => s.openChangesOverviewTab);

  useEffect(() => {
    setLoading(true);
    commands
      .getDiff(workspaceId)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--text-tertiary)" }}>
        Loading changes...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-5 text-center">
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
          No changes detected.
        </p>
      </div>
    );
  }

  const fileIcon = (path: string) => {
    const filename = path.split("/").pop() ?? path;
    return <FileTypeIcon filename={filename} size={14} />;
  };

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
    <div className="py-1">
      {/* View All button */}
      <button
        onClick={() => openChangesOverviewTab(workspaceId)}
        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs hover-bg transition-colors"
        style={{ color: "var(--accent)" }}
      >
        View all changes ({entries.length} file{entries.length !== 1 ? "s" : ""})
      </button>

      {entries.map((entry) => (
        <button
          key={entry.path}
          onClick={() => openDiffTab(workspaceId, entry.path)}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover-bg transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          {fileIcon(entry.path)}
          <span className="truncate flex-1 text-left" style={{ letterSpacing: "-0.01em" }}>
            {entry.path}
          </span>
          {statusBadge(entry.status)}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import { FilePlus, FileEdit, FileX } from "lucide-react";
import { commands, type DiffEntry } from "../../lib/tauri";

interface Props {
  workspaceId: string;
}

export function DiffViewer({ workspaceId }: Props) {
  const [entries, setEntries] = useState<DiffEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    commands
      .getDiff(workspaceId)
      .then(setEntries)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const handleClick = async (path: string) => {
    setSelectedPath(path);
    try {
      const diff = await commands.getFileDiff(workspaceId, path);
      setDiffContent(diff);
    } catch (e) {
      setDiffContent(`Error loading diff: ${e}`);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--text-tertiary)" }}>
        Loading changes...
      </div>
    );
  }

  if (selectedPath && diffContent !== null) {
    return (
      <div className="h-full flex flex-col">
        <div
          className="flex items-center gap-2 px-4 py-2.5 text-xs"
          style={{
            borderBottom: "1px solid var(--border)",
            color: "var(--text-tertiary)",
          }}
        >
          <button
            onClick={() => {
              setSelectedPath(null);
              setDiffContent(null);
            }}
            className="hover-bg px-1.5 py-0.5 rounded-md transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            Changes
          </button>
          <span style={{ opacity: 0.35 }}>/</span>
          <span style={{ color: "var(--text-primary)" }}>{selectedPath}</span>
        </div>

        <pre
          className="flex-1 overflow-auto p-4 leading-relaxed"
          style={{
            background: "var(--code-bg)",
            fontFamily: '"SF Mono", "Menlo", monospace',
            fontSize: 13,
          }}
        >
          {diffContent.split("\n").map((line, i) => {
            let color = "var(--text-primary)";
            let bg = "transparent";
            if (line.startsWith("+")) {
              color = "var(--success)";
              bg = "var(--success-subtle)";
            } else if (line.startsWith("-")) {
              color = "var(--error)";
              bg = "var(--error-subtle)";
            } else if (line.startsWith("@@")) {
              color = "var(--accent)";
            }

            return (
              <div key={i} style={{ color, background: bg }}>
                {line}
              </div>
            );
          })}
        </pre>
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

  const statusIcon = (status: string) => {
    switch (status) {
      case "added":
        return <FilePlus size={14} style={{ color: "var(--success)" }} />;
      case "deleted":
        return <FileX size={14} style={{ color: "var(--error)" }} />;
      default:
        return <FileEdit size={14} style={{ color: "var(--accent)" }} />;
    }
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
      {entries.map((entry) => (
        <button
          key={entry.path}
          onClick={() => handleClick(entry.path)}
          className="w-full flex items-center gap-2.5 px-4 py-2 text-sm hover-bg transition-colors"
          style={{
            color:
              entry.path === selectedPath
                ? "var(--text-primary)"
                : "var(--text-secondary)",
          }}
        >
          {statusIcon(entry.status)}
          <span className="truncate flex-1 text-left" style={{ letterSpacing: "-0.01em" }}>
            {entry.path}
          </span>
          {statusBadge(entry.status)}
        </button>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { commands, type FileEntry } from "../../lib/tauri";
import { FileTypeIcon } from "../common/FileTypeIcon";
import { useTabStore } from "../../stores/tabs";

interface Props {
  workspaceId: string;
}

export function FileTree({ workspaceId }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const openFileTab = useTabStore((s) => s.openFileTab);

  useEffect(() => {
    setLoading(true);
    commands
      .listFiles(workspaceId)
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const handleFileClick = (path: string) => {
    openFileTab(workspaceId, path);
  };

  if (loading) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--text-tertiary)" }}>
        Loading files...
      </div>
    );
  }

  return (
    <div className="py-1">
      {files.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          onFileClick={handleFileClick}
        />
      ))}
    </div>
  );
}

function FileTreeNode({
  entry,
  depth,
  onFileClick,
}: {
  entry: FileEntry;
  depth: number;
  onFileClick: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => {
          if (entry.is_dir) {
            setExpanded(!expanded);
          } else {
            onFileClick(entry.path);
          }
        }}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover-bg transition-colors"
        style={{
          paddingLeft: 10 + depth * 18,
          color: "var(--text-secondary)",
        }}
      >
        {entry.is_dir ? (
          <>
            {expanded ? (
              <ChevronDown size={13} style={{ color: "var(--text-tertiary)" }} />
            ) : (
              <ChevronRight size={13} style={{ color: "var(--text-tertiary)" }} />
            )}
            {expanded ? (
              <FolderOpen size={14} style={{ color: "var(--text-secondary)" }} />
            ) : (
              <Folder size={14} style={{ color: "var(--text-secondary)" }} />
            )}
          </>
        ) : (
          <>
            <span className="w-3.5" />
            <FileTypeIcon filename={entry.name} size={14} />
          </>
        )}
        <span className="truncate" style={{ letterSpacing: "-0.01em" }}>
          {entry.name}
        </span>
      </button>

      {expanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

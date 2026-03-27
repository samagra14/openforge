import { useEffect, useState } from "react";
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { commands, type FileEntry } from "../../lib/tauri";

interface Props {
  workspaceId: string;
}

export function FileTree({ workspaceId }: Props) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    commands
      .listFiles(workspaceId)
      .then(setFiles)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const handleFileClick = async (path: string) => {
    setSelectedFile(path);
    try {
      const content = await commands.readFile(workspaceId, path);
      setFileContent(content);
    } catch (e) {
      setFileContent(`Error reading file: ${e}`);
    }
  };

  if (loading) {
    return (
      <div className="p-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
        Loading files...
      </div>
    );
  }

  if (selectedFile && fileContent !== null) {
    return (
      <div className="h-full flex flex-col">
        {/* Breadcrumb */}
        <div
          className="flex items-center gap-1 px-3 py-1.5 text-2xs"
          style={{
            borderBottom: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <button
            onClick={() => {
              setSelectedFile(null);
              setFileContent(null);
            }}
            className="hover:underline"
          >
            Files
          </button>
          <span>/</span>
          <span style={{ color: "var(--text-primary)" }}>{selectedFile}</span>
        </div>

        {/* File content */}
        <pre
          className="flex-1 overflow-auto p-3 text-xs leading-relaxed"
          style={{
            background: "var(--code-bg)",
            fontFamily: '"SF Mono", "Menlo", monospace',
            fontSize: 12,
          }}
        >
          {fileContent}
        </pre>
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
        className="w-full flex items-center gap-1.5 px-2 py-0.5 text-xs hover:bg-white/5"
        style={{
          paddingLeft: 8 + depth * 16,
          color: "var(--text-secondary)",
        }}
      >
        {entry.is_dir ? (
          <>
            {expanded ? (
              <ChevronDown size={12} style={{ color: "var(--text-tertiary)" }} />
            ) : (
              <ChevronRight size={12} style={{ color: "var(--text-tertiary)" }} />
            )}
            {expanded ? (
              <FolderOpen size={14} style={{ color: "var(--accent-dim)" }} />
            ) : (
              <Folder size={14} style={{ color: "var(--accent-dim)" }} />
            )}
          </>
        ) : (
          <>
            <span className="w-3" />
            <File size={14} style={{ color: "var(--text-tertiary)" }} />
          </>
        )}
        <span className="truncate">{entry.name}</span>
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

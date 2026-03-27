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
      <div className="p-4 text-sm" style={{ color: "var(--text-tertiary)" }}>
        Loading files...
      </div>
    );
  }

  if (selectedFile && fileContent !== null) {
    return (
      <div className="h-full flex flex-col">
        {/* Breadcrumb */}
        <div
          className="flex items-center gap-2 px-4 py-2.5 text-xs"
          style={{
            borderBottom: "1px solid var(--border)",
            color: "var(--text-tertiary)",
          }}
        >
          <button
            onClick={() => {
              setSelectedFile(null);
              setFileContent(null);
            }}
            className="hover-bg px-1.5 py-0.5 rounded-md transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            Files
          </button>
          <span style={{ opacity: 0.35 }}>/</span>
          <span style={{ color: "var(--text-primary)" }}>{selectedFile}</span>
        </div>

        {/* File content */}
        <pre
          className="flex-1 overflow-auto p-4 leading-relaxed"
          style={{
            background: "var(--code-bg)",
            fontFamily: '"SF Mono", "Menlo", monospace',
            fontSize: 13,
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
            <File size={14} style={{ color: "var(--text-tertiary)" }} />
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

import {
  Anvil,
  Settings,
  Plus,
  FolderOpen,
  FolderPlus,
} from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";
import { useUIStore } from "../../stores/ui";
import { RepoList } from "../workspace/RepoList";
import { addRepoViaDialog } from "../../lib/addRepo";

export function Sidebar() {
  const repos = useWorkspaceStore((s) => s.repos);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setNewWorkspaceOpen = useUIStore((s) => s.setNewWorkspaceOpen);

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Header with drag region */}
      <div
        className="flex items-center gap-2 px-4 pt-8 pb-3"
        data-tauri-drag-region
      >
        <Anvil size={18} style={{ color: "var(--accent)" }} />
        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
          OpenForge
        </span>
      </div>

      {/* Workspaces section */}
      <div className="flex-1 overflow-y-auto px-2">
        <div className="flex items-center justify-between px-2 py-2">
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--text-tertiary)" }}
          >
            Workspaces
          </span>
          <button
            onClick={() => setNewWorkspaceOpen(true)}
            className="p-1 rounded hover:bg-white/5"
            title="New Workspace (⌘N)"
          >
            <Plus size={14} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        {repos.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <FolderOpen
              size={32}
              className="mx-auto mb-2"
              style={{ color: "var(--text-tertiary)" }}
            />
            <p className="text-xs mb-3" style={{ color: "var(--text-tertiary)" }}>
              No repositories added yet.
            </p>
            <button
              onClick={addRepoViaDialog}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs mx-auto hover:bg-white/5"
              style={{
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              <FolderPlus size={14} />
              Add repository...
            </button>
          </div>
        ) : (
          <RepoList />
        )}
      </div>

      {/* Bottom actions */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded hover:bg-white/5"
          title="Settings (⌘,)"
        >
          <Settings size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>
    </div>
  );
}

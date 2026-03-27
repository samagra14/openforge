import {
  Settings,
  Plus,
  FolderOpen,
  FolderPlus,
  Sun,
  Moon,
} from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";
import { useUIStore } from "../../stores/ui";
import { RepoList } from "../workspace/RepoList";
import { addRepoViaDialog } from "../../lib/addRepo";
import { useTheme } from "../../hooks/useTheme";

export function Sidebar() {
  const repos = useWorkspaceStore((s) => s.repos);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setNewWorkspaceOpen = useUIStore((s) => s.setNewWorkspaceOpen);
  const { theme, toggle } = useTheme();

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--bg-secondary)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Drag region spacer for traffic lights */}
      <div className="pt-10" data-tauri-drag-region />

      {/* Workspaces section */}
      <div className="flex-1 overflow-y-auto px-2.5">
        <div className="flex items-center justify-between px-2.5 py-3">
          <span className="section-label">Workspaces</span>
          <button
            onClick={() => setNewWorkspaceOpen(true)}
            className="p-1.5 rounded-lg hover-bg transition-colors"
            title="New Workspace (⌘N)"
          >
            <Plus size={14} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        {repos.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <FolderOpen
              size={32}
              className="mx-auto mb-4"
              style={{ color: "var(--text-tertiary)", opacity: 0.6 }}
            />
            <p
              className="text-sm mb-5"
              style={{ color: "var(--text-tertiary)", lineHeight: 1.5 }}
            >
              No repositories added yet.
            </p>
            <button
              onClick={addRepoViaDialog}
              className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm mx-auto hover-bg transition-colors"
              style={{
                color: "var(--text-primary)",
                border: "1px solid var(--border-strong)",
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
        className="flex items-center gap-1.5 px-4 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover-bg transition-colors"
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? (
            <Sun size={16} style={{ color: "var(--text-secondary)" }} />
          ) : (
            <Moon size={16} style={{ color: "var(--text-secondary)" }} />
          )}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg hover-bg transition-colors"
          title="Settings (⌘,)"
        >
          <Settings size={16} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>
    </div>
  );
}

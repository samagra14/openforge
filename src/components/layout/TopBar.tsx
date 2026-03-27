import {
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Globe,
  ExternalLink,
} from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";

export function TopBar() {
  const repos = useWorkspaceStore((s) => s.repos);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const activeRepo = repos.find((r) => r.id === activeWorkspace?.repo_id);

  return (
    <div
      className="flex items-center justify-between px-4"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        height: 44,
      }}
      data-tauri-drag-region
    >
      <div className="flex items-center gap-3">
        {/* Nav arrows */}
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded-lg hover-bg transition-colors" disabled>
            <ChevronLeft size={16} style={{ color: "var(--text-tertiary)" }} />
          </button>
          <button className="p-1.5 rounded-lg hover-bg transition-colors" disabled>
            <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        {/* Repo info */}
        {activeRepo && (
          <div className="flex items-center gap-2.5">
            <GitBranch size={14} style={{ color: "var(--text-tertiary)" }} />
            <span
              className="text-sm font-medium"
              style={{ color: "var(--text-secondary)", letterSpacing: "-0.01em" }}
            >
              {activeRepo.name}
            </span>
            {activeWorkspace && (
              <>
                <span style={{ color: "var(--text-tertiary)", opacity: 0.4 }}>/</span>
                <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {activeWorkspace.branch_name}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* City name */}
        {activeWorkspace && (
          <div className="flex items-center gap-2">
            <Globe size={13} style={{ color: "var(--text-tertiary)", opacity: 0.6 }} />
            <span
              className="font-mono"
              style={{ color: "var(--text-tertiary)", fontSize: 12 }}
            >
              /{activeWorkspace.city_name}
            </span>
          </div>
        )}

        {/* Create PR button */}
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover-bg"
          style={{
            color: "var(--text-primary)",
            border: "1px solid var(--border-strong)",
          }}
          title="Create PR (⌘⇧P)"
        >
          <ExternalLink size={12} />
          Create PR
        </button>
      </div>
    </div>
  );
}

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
      className="flex items-center justify-between px-4 h-10"
      style={{
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
      }}
      data-tauri-drag-region
    >
      <div className="flex items-center gap-3">
        {/* Nav arrows */}
        <div className="flex items-center gap-0.5">
          <button className="p-1 rounded hover:bg-white/5" disabled>
            <ChevronLeft size={16} style={{ color: "var(--text-tertiary)" }} />
          </button>
          <button className="p-1 rounded hover:bg-white/5" disabled>
            <ChevronRight size={16} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        {/* Repo info */}
        {activeRepo && (
          <div className="flex items-center gap-2">
            <GitBranch size={14} style={{ color: "var(--text-secondary)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {activeRepo.name}
            </span>
            {activeWorkspace && (
              <>
                <span style={{ color: "var(--text-tertiary)" }}>/</span>
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
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
          <div className="flex items-center gap-1.5">
            <Globe size={13} style={{ color: "var(--text-tertiary)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              /{activeWorkspace.city_name}
            </span>
          </div>
        )}

        {/* Create PR button */}
        <button
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
          style={{
            background: "var(--bg-tertiary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
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

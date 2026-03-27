import { useEffect } from "react";
import { useWorkspaceStore } from "../../stores/workspace";
import { commands } from "../../lib/tauri";
import { addRepoViaDialog } from "../../lib/addRepo";
import { WorkspaceList } from "./WorkspaceList";
import { FolderPlus } from "lucide-react";

export function RepoList() {
  const repos = useWorkspaceStore((s) => s.repos);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const activeRepoId = useWorkspaceStore((s) => s.activeRepoId);
  const setActiveRepo = useWorkspaceStore((s) => s.setActiveRepo);

  // Load workspaces for all repos
  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      const all = await Promise.all(
        repos.map((r) => commands.listWorkspaces(r.id).catch(() => []))
      );
      if (!cancelled) setWorkspaces(all.flat());
    };
    if (repos.length > 0) loadAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos.length]);

  return (
    <div className="space-y-1">
      {repos.map((repo) => {
        const repoWorkspaces = workspaces.filter(
          (w) => w.repo_id === repo.id && w.status === "active"
        );
        const isExpanded = activeRepoId === repo.id;
        const letter = repo.name.split("/").pop()?.[0]?.toUpperCase() ?? "?";

        return (
          <div key={repo.id}>
            <button
              onClick={() => setActiveRepo(isExpanded ? null : repo.id)}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm hover-bg transition-colors"
              style={{
                color: "var(--text-primary)",
              }}
            >
              <span
                className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{
                  background: "var(--border-strong)",
                  color: "var(--text-primary)",
                  letterSpacing: "0.02em",
                }}
              >
                {letter}
              </span>
              <span className="truncate" style={{ letterSpacing: "-0.01em" }}>
                {repo.name}
              </span>
            </button>

            {isExpanded && (
              <div className="ml-2">
                <WorkspaceList workspaces={repoWorkspaces} />
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addRepoViaDialog}
        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm hover-bg mt-2 transition-colors"
        style={{ color: "var(--text-tertiary)" }}
      >
        <FolderPlus size={14} />
        Add repository...
      </button>
    </div>
  );
}

import { useEffect } from "react";
import { useWorkspaceStore } from "../../stores/workspace";
import { commands } from "../../lib/tauri";
import { addRepoViaDialog } from "../../lib/addRepo";
import { WorkspaceList } from "./WorkspaceList";
import { FolderPlus } from "lucide-react";

const AVATAR_COLORS = [
  "#e06c75", "#e5c07b", "#98c379", "#56b6c2", "#61afef",
  "#c678dd", "#d19a66", "#be5046", "#7ec8e3", "#f5a623",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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
        const color = getAvatarColor(repo.name);

        return (
          <div key={repo.id}>
            <button
              onClick={() => setActiveRepo(isExpanded ? null : repo.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-white/5"
              style={{
                color: "var(--text-primary)",
              }}
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-2xs font-bold flex-shrink-0"
                style={{ background: color, color: "#fff" }}
              >
                {letter}
              </span>
              <span className="truncate">{repo.name}</span>
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
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-white/5 mt-2"
        style={{ color: "var(--text-secondary)" }}
      >
        <FolderPlus size={14} />
        Add repository...
      </button>
    </div>
  );
}

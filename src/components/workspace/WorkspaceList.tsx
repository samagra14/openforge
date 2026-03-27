import { useWorkspaceStore, type Workspace } from "../../stores/workspace";

interface Props {
  workspaces: Workspace[];
}

export function WorkspaceList({ workspaces }: Props) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  if (workspaces.length === 0) {
    return (
      <p
        className="text-xs px-4 py-3"
        style={{ color: "var(--text-tertiary)" }}
      >
        No active workspaces
      </p>
    );
  }

  return (
    <div className="space-y-0.5 py-1">
      {workspaces.map((ws, index) => {
        const isActive = ws.id === activeWorkspaceId;

        return (
          <button
            key={ws.id}
            onClick={() => setActiveWorkspace(ws.id)}
            className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm hover-bg transition-colors"
            style={{
              background: isActive ? "var(--bg-tertiary)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <span
              className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 font-mono"
              style={{
                background: isActive ? "var(--border-strong)" : "var(--bg-input)",
                color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              {index + 1}
            </span>
            <div className="text-left truncate">
              <span
                className="block truncate"
                style={{
                  fontWeight: isActive ? 500 : 400,
                  letterSpacing: "-0.01em",
                }}
              >
                {ws.city_name}
              </span>
              {ws.task_description && (
                <span
                  className="block text-xs truncate mt-0.5"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {ws.task_description}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

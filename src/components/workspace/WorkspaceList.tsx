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
        className="text-2xs px-4 py-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        No active workspaces
      </p>
    );
  }

  return (
    <div className="space-y-0.5 py-1">
      {workspaces.map((ws, index) => (
        <button
          key={ws.id}
          onClick={() => setActiveWorkspace(ws.id)}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-white/5"
          style={{
            background:
              ws.id === activeWorkspaceId ? "var(--bg-tertiary)" : "transparent",
            color:
              ws.id === activeWorkspaceId
                ? "var(--text-primary)"
                : "var(--text-secondary)",
          }}
        >
          <span
            className="w-4 h-4 rounded flex items-center justify-center text-2xs flex-shrink-0"
            style={{
              background: "var(--bg-input)",
              color: "var(--text-tertiary)",
            }}
          >
            {index + 1}
          </span>
          <div className="text-left truncate">
            <span className="block truncate">{ws.city_name}</span>
            {ws.task_description && (
              <span
                className="block text-2xs truncate"
                style={{ color: "var(--text-tertiary)" }}
              >
                {ws.task_description}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

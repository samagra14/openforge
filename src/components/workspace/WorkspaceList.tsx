import { useState, useRef, useCallback } from "react";
import { useWorkspaceStore, type Workspace } from "../../stores/workspace";
import { commands } from "../../lib/tauri";
import { WorkspaceHoverCard } from "./WorkspaceHoverCard";

interface Props {
  workspaces: Workspace[];
}

export function WorkspaceList({ workspaces }: Props) {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showCard = useCallback((id: string, el: HTMLElement) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    hoverTimerRef.current = setTimeout(() => {
      setHoveredId(id);
      setAnchorRect(el.getBoundingClientRect());
    }, 400);
  }, []);

  const hideCard = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    leaveTimerRef.current = setTimeout(() => {
      setHoveredId(null);
      setAnchorRect(null);
    }, 200);
  }, []);

  const handleArchive = useCallback(
    async (ws: Workspace) => {
      try {
        await commands.archiveWorkspace(ws.id);
        removeWorkspace(ws.id);
        setHoveredId(null);
      } catch (e) {
        console.error("Failed to archive:", e);
      }
    },
    [removeWorkspace]
  );

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

  const hoveredWorkspace = workspaces.find((ws) => ws.id === hoveredId);

  return (
    <div className="space-y-0.5 py-1">
      {workspaces.map((ws, index) => {
        const isActive = ws.id === activeWorkspaceId;

        return (
          <button
            key={ws.id}
            onClick={() => setActiveWorkspace(ws.id)}
            onMouseEnter={(e) => showCard(ws.id, e.currentTarget)}
            onMouseLeave={hideCard}
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

      {hoveredWorkspace && (
        <WorkspaceHoverCard
          workspace={hoveredWorkspace}
          anchorRect={anchorRect}
          onArchive={() => handleArchive(hoveredWorkspace)}
          onContinue={() => {
            setActiveWorkspace(hoveredWorkspace.id);
            setHoveredId(null);
          }}
          onMouseEnter={() => {
            if (leaveTimerRef.current) {
              clearTimeout(leaveTimerRef.current);
              leaveTimerRef.current = null;
            }
          }}
          onMouseLeave={hideCard}
        />
      )}
    </div>
  );
}

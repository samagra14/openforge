import { useCallback, useEffect, useRef } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { MainPanel } from "./components/layout/MainPanel";
import { RightPanel } from "./components/layout/RightPanel";
import { NewWorkspace } from "./components/workspace/NewWorkspace";
import { useUIStore } from "./stores/ui";
import { useWorkspaceStore } from "./stores/workspace";
import { useSessionStore } from "./stores/session";
import { useAgent } from "./hooks/useAgent";
import { commands } from "./lib/tauri";

export default function App() {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const setNewWorkspaceOpen = useUIStore((s) => s.setNewWorkspaceOpen);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setRepos = useWorkspaceStore((s) => s.setRepos);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  useAgent(activeSessionId);

  const dragging = useRef<"left" | "right" | null>(null);

  // Load repos on mount
  useEffect(() => {
    commands.listRepos().then(setRepos).catch(console.error);
  }, [setRepos]);

  // Handle resize dragging
  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging.current === "left") {
        setSidebarWidth(e.clientX);
      } else if (dragging.current === "right") {
        setRightPanelWidth(window.innerWidth - e.clientX);
      }
    },
    [setSidebarWidth, setRightPanelWidth]
  );

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && !e.shiftKey) {
        if (e.key === "n") {
          e.preventDefault();
          setNewWorkspaceOpen(true);
        }
        if (e.key === "t") {
          e.preventDefault();
          if (activeWorkspaceId) {
            commands.createSession(activeWorkspaceId, "sonnet").then((session) => {
              addSession(session);
              setActiveSession(session.id);
            }).catch(console.error);
          }
        }
        if (e.key === "l") {
          e.preventDefault();
          document.querySelector<HTMLTextAreaElement>("#chat-input")?.focus();
        }
        if (e.key >= "1" && e.key <= "9") {
          e.preventDefault();
          const idx = parseInt(e.key) - 1;
          const active = workspaces.filter((w) => w.status === "active");
          if (idx < active.length) {
            setActiveWorkspace(active[idx].id);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [workspaces, setActiveWorkspace, setNewWorkspaceOpen, activeWorkspaceId, addSession, setActiveSession]);

  const startDrag = (side: "left" | "right") => {
    dragging.current = side;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      className="h-screen flex"
      style={{ background: "var(--bg-primary)" }}
    >
      <div style={{ width: sidebarWidth, flexShrink: 0 }}>
        <Sidebar />
      </div>

      <div
        className="resize-handle"
        onMouseDown={() => startDrag("left")}
      />

      <div className="flex-1 min-w-0">
        <MainPanel />
      </div>

      <div
        className="resize-handle"
        onMouseDown={() => startDrag("right")}
      />

      <div style={{ width: rightPanelWidth, flexShrink: 0 }}>
        <RightPanel />
      </div>

      <NewWorkspace />
    </div>
  );
}

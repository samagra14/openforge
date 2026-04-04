import { useCallback, useEffect, useRef } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { MainPanel } from "./components/layout/MainPanel";
import { RightPanel } from "./components/layout/RightPanel";
import { NewWorkspace } from "./components/workspace/NewWorkspace";
import { CommandPalette } from "./components/command/CommandPalette";
import { useUIStore } from "./stores/ui";
import { useWorkspaceStore } from "./stores/workspace";
import { useSessionStore } from "./stores/session";
import { useTabStore } from "./stores/tabs";
import { useAgent } from "./hooks/useAgent";
import { useShortcut } from "./hooks/useShortcut";
import { registerShortcut } from "./lib/shortcuts";
import { commands } from "./lib/tauri";

export default function App() {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const rightPanelWidth = useUIStore((s) => s.rightPanelWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setRightPanelWidth = useUIStore((s) => s.setRightPanelWidth);
  const setNewWorkspaceOpen = useUIStore((s) => s.setNewWorkspaceOpen);
  const setCommandPaletteOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setChatSearchOpen = useUIStore((s) => s.setChatSearchOpen);
  const setRepos = useWorkspaceStore((s) => s.setRepos);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  useAgent(activeSessionId);

  const dragging = useRef<"left" | "right" | null>(null);

  // Load repos on mount
  useEffect(() => {
    commands.listRepos().then(setRepos).catch(console.error);
  }, [setRepos]);

  // Load sessions from DB when switching workspaces
  useEffect(() => {
    if (!activeWorkspaceId) return;
    let cancelled = false;
    commands.listSessions(activeWorkspaceId).then((dbSessions) => {
      if (cancelled) return;
      const { sessions: current } = useSessionStore.getState();
      const others = current.filter((s) => s.workspace_id !== activeWorkspaceId);
      useSessionStore.getState().setSessions([...others, ...dbSessions]);
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [activeWorkspaceId]);

  // Auto-create chat tabs for existing sessions when switching workspaces
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const { tabs, openChatTab } = useTabStore.getState();
    const existingTabs = tabs[activeWorkspaceId] ?? [];
    if (existingTabs.length > 0) return;

    const workspaceSessions = sessions.filter(
      (s) => s.workspace_id === activeWorkspaceId
    );
    for (const session of workspaceSessions) {
      openChatTab(activeWorkspaceId, session.id, session.title);
    }
  }, [activeWorkspaceId, sessions]);

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

  // --- Keyboard shortcuts (via registry) ---

  useShortcut("new-workspace", { key: "n", meta: true }, () => {
    setNewWorkspaceOpen(true);
  }, { label: "New Workspace" });

  useShortcut("new-chat", { key: "t", meta: true }, () => {
    const wsId = useWorkspaceStore.getState().activeWorkspaceId;
    if (wsId) {
      commands.createSession(wsId, "sonnet").then((session) => {
        useSessionStore.getState().addSession(session);
        useSessionStore.getState().setActiveSession(session.id);
        useTabStore.getState().openChatTab(wsId, session.id, session.title);
      }).catch(console.error);
    }
  }, { label: "New Chat" });

  useShortcut("close-tab", { key: "w", meta: true }, () => {
    const wsId = useWorkspaceStore.getState().activeWorkspaceId;
    const tabId = wsId ? useTabStore.getState().activeTabId[wsId] ?? null : null;
    if (wsId && tabId) {
      useTabStore.getState().closeTab(wsId, tabId);
    }
  }, { label: "Close Tab" });

  useShortcut("focus-input", { key: "l", meta: true }, () => {
    document.querySelector<HTMLTextAreaElement>("#chat-input")?.focus();
  }, { label: "Focus Chat Input" });

  useShortcut("command-palette", { key: "k", meta: true }, () => {
    setCommandPaletteOpen(true, "commands");
  }, { label: "Command Palette" });

  useShortcut("file-picker", { key: "p", meta: true }, () => {
    setCommandPaletteOpen(true, "files");
  }, { label: "Quick Open File" });

  useShortcut("workspace-search", { key: "f", meta: true, shift: true }, () => {
    setCommandPaletteOpen(true, "workspaces");
  }, { label: "Search Workspaces" });

  useShortcut("chat-search", { key: "f", meta: true }, () => {
    setChatSearchOpen(true);
  }, { label: "Search in Chat" });

  // Workspace number shortcuts (Cmd+1 through Cmd+9) — registered via effect to avoid hooks-in-loop
  useEffect(() => {
    const unregisters: (() => void)[] = [];
    for (let i = 1; i <= 9; i++) {
      unregisters.push(
        registerShortcut({
          id: `switch-workspace-${i}`,
          label: `Switch to Workspace ${i}`,
          keys: { key: String(i), meta: true },
          handler: () => {
            const active = useWorkspaceStore.getState().workspaces.filter((w: any) => w.status === "active");
            if (i - 1 < active.length) {
              useWorkspaceStore.getState().setActiveWorkspace(active[i - 1].id);
            }
          },
        })
      );
    }
    return () => unregisters.forEach((fn) => fn());
  }, []);

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
      <CommandPalette />
    </div>
  );
}

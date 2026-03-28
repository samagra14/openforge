import { MessageSquare, GitCompare, Plus, X } from "lucide-react";
import { TopBar } from "./TopBar";
import { ChatView } from "../chat/ChatView";
import { ChatInput } from "../chat/ChatInput";
import { CodeMirrorEditor } from "../editor/CodeMirrorEditor";
import { CodeMirrorDiff } from "../editor/CodeMirrorDiff";
import { ChangesOverview } from "../editor/ChangesOverview";
import { FileTypeIcon } from "../common/FileTypeIcon";
import { useSessionStore } from "../../stores/session";
import { useWorkspaceStore } from "../../stores/workspace";
import { useTabStore, type Tab } from "../../stores/tabs";
import { commands } from "../../lib/tauri";

const EMPTY_TABS: Tab[] = [];

function TabIcon({ tab }: { tab: Tab }) {
  switch (tab.type) {
    case "chat":
      return <MessageSquare size={13} />;
    case "file": {
      const filename = tab.filePath.split("/").pop() ?? tab.filePath;
      return <FileTypeIcon filename={filename} size={13} />;
    }
    case "diff": {
      const filename = tab.filePath.split("/").pop() ?? tab.filePath;
      return <FileTypeIcon filename={filename} size={13} />;
    }
    case "changes-overview":
      return <GitCompare size={13} />;
  }
}

export function MainPanel() {
  const sessions = useSessionStore((s) => s.sessions);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const addSession = useSessionStore((s) => s.addSession);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const tabs = useTabStore((s) =>
    activeWorkspaceId ? s.tabs[activeWorkspaceId] ?? EMPTY_TABS : EMPTY_TABS
  );
  const activeTabId = useTabStore((s) =>
    activeWorkspaceId ? s.activeTabId[activeWorkspaceId] ?? null : null
  );
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const closeTab = useTabStore((s) => s.closeTab);
  const openChatTab = useTabStore((s) => s.openChatTab);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;

  // Sync: when active tab is a chat tab, keep session store in sync
  const activeSession =
    activeTab?.type === "chat"
      ? sessions.find((s) => s.id === activeTab.sessionId) ?? null
      : null;

  const handleNewChat = async () => {
    if (!activeWorkspaceId) return;
    try {
      const session = await commands.createSession(activeWorkspaceId, "sonnet");
      addSession(session);
      setActiveSession(session.id);
      openChatTab(activeWorkspaceId, session.id, session.title);
    } catch (e) {
      console.error("Failed to create session:", e);
    }
  };

  const handleTabClick = (tab: Tab) => {
    if (!activeWorkspaceId) return;
    setActiveTab(activeWorkspaceId, tab.id);
    // Keep session store in sync for chat tabs
    if (tab.type === "chat") {
      setActiveSession(tab.sessionId);
    }
  };

  const handleTabClose = (e: React.MouseEvent, tab: Tab) => {
    e.stopPropagation();
    if (!activeWorkspaceId) return;
    closeTab(activeWorkspaceId, tab.id);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <TopBar />

      {/* Tab bar */}
      <div
        className="flex items-center gap-0 px-2"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          minHeight: 40,
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-t relative transition-colors group shrink-0"
            style={{
              maxWidth: 200,
              background:
                tab.id === activeTabId
                  ? "var(--bg-primary)"
                  : "transparent",
              color:
                tab.id === activeTabId
                  ? "var(--text-primary)"
                  : "var(--text-tertiary)",
              fontWeight: tab.id === activeTabId ? 500 : 400,
              borderBottom:
                tab.id === activeTabId
                  ? "1px solid var(--bg-primary)"
                  : "none",
              marginBottom: -1,
              letterSpacing: "-0.01em",
            }}
          >
            <TabIcon tab={tab} />
            <span className="truncate max-w-[140px]">{tab.label}</span>
            <X
              size={12}
              onClick={(e) => handleTabClose(e, tab)}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: "var(--text-tertiary)" }}
            />
          </button>
        ))}
        <button
          onClick={handleNewChat}
          className="p-2 rounded-lg hover-bg ml-1 transition-colors"
          title="New Chat (⌘T)"
        >
          <Plus size={14} style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {activeTab ? (
          <>
            {activeTab.type === "chat" && activeSession && (
              <>
                <div className="flex-1 overflow-y-auto">
                  <ChatView sessionId={activeSession.id} />
                </div>
                <ChatInput sessionId={activeSession.id} />
              </>
            )}
            {activeTab.type === "file" && (
              <CodeMirrorEditor
                workspaceId={activeTab.workspaceId}
                filePath={activeTab.filePath}
              />
            )}
            {activeTab.type === "diff" && (
              <CodeMirrorDiff
                workspaceId={activeTab.workspaceId}
                filePath={activeTab.filePath}
              />
            )}
            {activeTab.type === "changes-overview" && (
              <ChangesOverview workspaceId={activeTab.workspaceId} />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p
              className="text-sm"
              style={{ color: "var(--text-tertiary)", letterSpacing: "-0.01em" }}
            >
              {activeWorkspaceId
                ? "No active tab. Press ⌘T to start a chat."
                : "Select a workspace to get started."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

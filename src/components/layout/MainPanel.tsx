import { Plus, X } from "lucide-react";
import { TopBar } from "./TopBar";
import { ChatView } from "../chat/ChatView";
import { ChatInput } from "../chat/ChatInput";
import { useSessionStore } from "../../stores/session";
import { useWorkspaceStore } from "../../stores/workspace";
import { commands } from "../../lib/tauri";

export function MainPanel() {
  const sessions = useSessionStore((s) => s.sessions);
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);
  const addSession = useSessionStore((s) => s.addSession);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const workspaceSessions = sessions.filter(
    (s) => s.workspace_id === activeWorkspaceId
  );

  // Derive the active session: use activeSessionId if it belongs to this workspace,
  // otherwise fall back to the first session for this workspace.
  // No useEffect needed - pure derivation.
  const activeSession =
    workspaceSessions.find((s) => s.id === activeSessionId) ??
    workspaceSessions[0] ??
    null;

  const handleNewChat = async () => {
    if (!activeWorkspaceId) return;
    try {
      const session = await commands.createSession(activeWorkspaceId, "sonnet");
      addSession(session);
      setActiveSession(session.id);
    } catch (e) {
      console.error("Failed to create session:", e);
    }
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
          minHeight: 36,
        }}
      >
        {workspaceSessions.map((session) => (
          <button
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t relative"
            style={{
              background:
                session.id === activeSession?.id
                  ? "var(--bg-primary)"
                  : "transparent",
              color:
                session.id === activeSession?.id
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              borderBottom:
                session.id === activeSession?.id
                  ? "1px solid var(--bg-primary)"
                  : "none",
              marginBottom: -1,
            }}
          >
            <span className="truncate max-w-[120px]">{session.title}</span>
            <X
              size={12}
              className="opacity-0 hover:opacity-100"
              style={{ color: "var(--text-tertiary)" }}
            />
          </button>
        ))}
        <button
          onClick={handleNewChat}
          className="p-1.5 rounded hover:bg-white/5 ml-1"
          title="New Chat (⌘T)"
        >
          <Plus size={14} style={{ color: "var(--text-secondary)" }} />
        </button>
      </div>

      {/* Chat content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {activeSession ? (
          <>
            <div className="flex-1 overflow-y-auto">
              <ChatView sessionId={activeSession.id} />
            </div>
            <ChatInput sessionId={activeSession.id} />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p style={{ color: "var(--text-tertiary)" }}>
              {activeWorkspaceId
                ? "No active chat. Press ⌘T to start one."
                : "Select a workspace to get started."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

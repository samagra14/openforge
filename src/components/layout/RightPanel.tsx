import { useState } from "react";
import {
  Files,
  GitCompare,
  MessageSquare,
  Play,
  Terminal,
  Wrench,
} from "lucide-react";
import { useUIStore } from "../../stores/ui";
import { useWorkspaceStore } from "../../stores/workspace";
import { FileTree } from "../files/FileTree";
import { DiffViewer } from "../files/DiffViewer";
import { TerminalPanel } from "../terminal/TerminalPanel";

export function RightPanel() {
  const activeRightTab = useUIStore((s) => s.activeRightTab);
  const setActiveRightTab = useUIStore((s) => s.setActiveRightTab);
  const rightBottomTab = useUIStore((s) => s.rightBottomTab);
  const setRightBottomTab = useUIStore((s) => s.setRightBottomTab);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const [bottomHeight] = useState(250);

  const topTabs = [
    { id: "files" as const, label: "All files", icon: Files, badge: 0 },
    { id: "changes" as const, label: "Changes", icon: GitCompare, badge: 0 },
    { id: "review" as const, label: "Review", icon: MessageSquare, badge: 0 },
  ];

  const bottomTabs = [
    { id: "setup" as const, label: "Setup", icon: Wrench },
    { id: "run" as const, label: "Run", icon: Play },
    { id: "terminal" as const, label: "Terminal", icon: Terminal },
  ];

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: "var(--bg-secondary)",
        borderLeft: "1px solid var(--border)",
      }}
    >
      {/* Top tab bar */}
      <div
        className="flex items-center gap-0 px-1 pt-8"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        {topTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveRightTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs"
            style={{
              color:
                activeRightTab === tab.id
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              borderBottom:
                activeRightTab === tab.id
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
            }}
          >
            <tab.icon size={13} />
            {tab.label}
            {"badge" in tab && tab.badge > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-2xs"
                style={{
                  background: "var(--accent)",
                  color: "var(--bg-primary)",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Top content */}
      <div className="flex-1 overflow-y-auto">
        {activeWorkspaceId ? (
          <>
            {activeRightTab === "files" && (
              <FileTree workspaceId={activeWorkspaceId} />
            )}
            {activeRightTab === "changes" && (
              <DiffViewer workspaceId={activeWorkspaceId} />
            )}
            {activeRightTab === "review" && (
              <div className="p-4">
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  Review mode coming in v0.2
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="p-4 text-center">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Select a workspace to browse files.
            </p>
          </div>
        )}
      </div>

      {/* Bottom pane divider */}
      <div
        className="resize-handle"
        style={{
          height: 6,
          width: "100%",
          cursor: "row-resize",
        }}
      />

      {/* Bottom tab bar */}
      <div
        className="flex items-center gap-0 px-1"
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {bottomTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setRightBottomTab(tab.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs"
            style={{
              color:
                rightBottomTab === tab.id
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
              borderBottom:
                rightBottomTab === tab.id
                  ? "2px solid var(--accent)"
                  : "2px solid transparent",
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Bottom content */}
      <div style={{ height: bottomHeight }} className="overflow-hidden">
        {rightBottomTab === "run" && (
          <div className="p-4 flex flex-col items-center justify-center h-full">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded font-medium text-xs"
              style={{
                background: "var(--accent)",
                color: "var(--bg-primary)",
              }}
            >
              <Play size={14} />
              Run workspace ⌘R
            </button>
            <p
              className="mt-3 text-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              Test your changes here.
            </p>
          </div>
        )}
        {rightBottomTab === "terminal" && activeWorkspaceId && (
          <TerminalPanel workspaceId={activeWorkspaceId} />
        )}
        {rightBottomTab === "setup" && (
          <div className="p-4">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
              Configure setup script in repo settings.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

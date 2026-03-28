import { useEffect, useState } from "react";
import { GitBranch, Archive } from "lucide-react";
import { commands, type WorkspaceStatusInfo } from "../../lib/tauri";
import type { Workspace } from "../../stores/workspace";

interface Props {
  workspace: Workspace;
  anchorRect: DOMRect | null;
  onArchive: () => void;
  onContinue: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function formatTimeAgo(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "running"
      ? "var(--accent)"
      : status === "idle"
        ? "var(--success)"
        : "var(--text-tertiary)";

  return (
    <span
      className={status === "running" ? "animate-pulse-dot" : ""}
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

function statusLabel(status: string): string {
  if (status === "running") return "In progress";
  if (status === "idle") return "Done";
  return "New";
}

export function WorkspaceHoverCard({
  workspace,
  anchorRect,
  onArchive,
  onContinue,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const [status, setStatus] = useState<WorkspaceStatusInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    commands
      .getWorkspaceStatus(workspace.id)
      .then((s) => {
        if (!cancelled) setStatus(s);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [workspace.id]);

  if (!anchorRect) return null;

  // Position to the right of the anchor
  const top = anchorRect.top;
  const left = anchorRect.right + 8;

  const title =
    workspace.task_description ||
    workspace.city_name.charAt(0).toUpperCase() +
      workspace.city_name.slice(1).replace(/-/g, " ");

  const timeAgo = status?.last_activity
    ? formatTimeAgo(status.last_activity)
    : formatTimeAgo(workspace.created_at);

  const sessionStatus = status?.session_status ?? "new";

  return (
    <div
      className="fixed z-[100] animate-fade-in"
      style={{
        top,
        left,
        minWidth: 280,
        maxWidth: 340,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Title */}
        <p
          className="text-sm font-medium truncate mb-1.5"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
        >
          {title}
        </p>

        {/* Status line */}
        <div
          className="flex items-center gap-1.5 text-xs mb-2.5"
          style={{ color: "var(--text-secondary)" }}
        >
          <StatusDot status={sessionStatus} />
          <span>{statusLabel(sessionStatus)}</span>
          <span style={{ color: "var(--text-tertiary)" }}>&middot;</span>
          <span>{workspace.city_name}</span>
          <span style={{ color: "var(--text-tertiary)" }}>&middot;</span>
          <span style={{ color: "var(--text-tertiary)" }}>{timeAgo}</span>
        </div>

        {/* Description */}
        {workspace.task_description && (
          <p
            className="text-xs mb-3 line-clamp-2"
            style={{ color: "var(--text-tertiary)", lineHeight: 1.5 }}
          >
            {workspace.task_description}
          </p>
        )}

        {/* Bottom row: diff stats + actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Diff stats */}
            {status && (status.lines_added > 0 || status.lines_removed > 0) ? (
              <span
                className="text-xs font-mono"
                style={{ color: "var(--text-secondary)" }}
              >
                <span style={{ color: "var(--success)" }}>
                  +{status.lines_added}
                </span>{" "}
                <span style={{ color: "var(--error)" }}>
                  -{status.lines_removed}
                </span>
              </span>
            ) : (
              <span
                className="text-xs"
                style={{ color: "var(--text-tertiary)" }}
              >
                No changes
              </span>
            )}

            {/* Branch name */}
            <span
              className="flex items-center gap-1 text-xs"
              style={{ color: "var(--text-tertiary)" }}
            >
              <GitBranch size={11} />
              <span className="truncate" style={{ maxWidth: 100 }}>
                {workspace.branch_name.replace("agent/", "")}
              </span>
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onContinue();
              }}
              className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors hover-bg"
              style={{
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              Continue
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onArchive();
              }}
              className="p-1 rounded-md transition-colors hover-bg"
              title="Archive workspace"
            >
              <Archive size={13} style={{ color: "var(--text-tertiary)" }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

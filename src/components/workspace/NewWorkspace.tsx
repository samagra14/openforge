import { useState } from "react";
import { X } from "lucide-react";
import { useWorkspaceStore } from "../../stores/workspace";
import { useUIStore } from "../../stores/ui";
import { useSessionStore } from "../../stores/session";
import { commands } from "../../lib/tauri";

export function NewWorkspace() {
  const repos = useWorkspaceStore((s) => s.repos);
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
  const setActiveRepo = useWorkspaceStore((s) => s.setActiveRepo);
  const newWorkspaceOpen = useUIStore((s) => s.newWorkspaceOpen);
  const setNewWorkspaceOpen = useUIStore((s) => s.setNewWorkspaceOpen);
  const addSession = useSessionStore((s) => s.addSession);
  const setActiveSession = useSessionStore((s) => s.setActiveSession);

  const [selectedRepoId, setSelectedRepoId] = useState("");
  const [task, setTask] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  if (!newWorkspaceOpen) return null;

  // Compute the effective repo id: use selectedRepoId if set, otherwise default to first repo
  const effectiveRepoId = selectedRepoId || (repos.length > 0 ? repos[0].id : "");

  const handleCreate = async () => {
    if (!effectiveRepoId) return;
    setCreating(true);
    setError("");
    try {
      const ws = await commands.createWorkspace(effectiveRepoId, task || undefined);
      addWorkspace(ws);
      setActiveWorkspace(ws.id);
      setActiveRepo(ws.repo_id);

      // Auto-create a chat session for the new workspace
      try {
        const session = await commands.createSession(ws.id, "sonnet");
        addSession(session);
        setActiveSession(session.id);
      } catch (sessionErr) {
        console.error("Failed to create initial session:", sessionErr);
      }

      setNewWorkspaceOpen(false);
      setTask("");
      setSelectedRepoId("");
    } catch (e) {
      console.error("Failed to create workspace:", e);
      setError(String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setNewWorkspaceOpen(false);
      }}
    >
      <div
        className="w-96 rounded-lg p-5"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">New Workspace</h2>
          <button
            onClick={() => setNewWorkspaceOpen(false)}
            className="p-1 rounded hover:bg-white/5"
          >
            <X size={16} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Repository
            </label>
            <select
              value={effectiveRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="w-full px-3 py-1.5 rounded text-xs outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              className="block text-xs mb-1"
              style={{ color: "var(--text-secondary)" }}
            >
              Task description (optional)
            </label>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g., Add navigation icons"
              className="w-full px-3 py-1.5 rounded text-xs outline-none"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>

          {error && (
            <p className="text-xs px-2 py-1.5 rounded" style={{ color: "#e06c75", background: "rgba(224,108,117,0.1)" }}>
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setNewWorkspaceOpen(false)}
              className="px-3 py-1.5 rounded text-xs"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!effectiveRepoId || creating}
              className="px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50"
              style={{
                background: "var(--accent)",
                color: "var(--bg-primary)",
              }}
            >
              {creating ? "Creating..." : "Create Workspace"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

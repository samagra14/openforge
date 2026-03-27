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
      style={{ background: "var(--overlay)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setNewWorkspaceOpen(false);
      }}
    >
      <div
        className="w-[440px] rounded-2xl p-7 animate-fade-in-scale"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            className="font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.02em", fontSize: 16 }}
          >
            New Workspace
          </h2>
          <button
            onClick={() => setNewWorkspaceOpen(false)}
            className="p-1.5 rounded-lg hover-bg transition-colors"
          >
            <X size={16} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="section-label block mb-2.5">
              Repository
            </label>
            <select
              value={effectiveRepoId}
              onChange={(e) => setSelectedRepoId(e.target.value)}
              className="premium-input w-full"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="section-label block mb-2.5">
              Task description
              <span style={{ color: "var(--text-tertiary)", fontWeight: 400, textTransform: "none", letterSpacing: "normal" }}>
                {" "}(optional)
              </span>
            </label>
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g., Add navigation icons"
              className="premium-input w-full"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>

          {error && (
            <p
              className="text-sm px-4 py-3 rounded-xl"
              style={{
                color: "var(--error)",
                background: "var(--error-subtle)",
                border: "1px solid rgba(184, 100, 94, 0.2)",
              }}
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-3">
            <button
              onClick={() => setNewWorkspaceOpen(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors hover-bg"
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
              className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-40 transition-all"
              style={{
                background: "var(--text-primary)",
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

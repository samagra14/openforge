import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Repo, Workspace } from "../stores/workspace";
import type { Session, Message } from "../stores/session";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[];
}

export interface DiffEntry {
  path: string;
  status: string;
}

export interface AgentMessagePayload {
  session_id: string;
  message_id: string;
  role: string;
  content: string;
  tool_calls: Array<{
    name: string;
    input: Record<string, unknown>;
    output?: string;
    status: string;
  }>;
}

export interface AgentCompletePayload {
  session_id: string;
  cost_usd: number;
  duration_ms: number;
  claude_session_id?: string;
}

export interface AgentStatusPayload {
  session_id: string;
  status: string;
}

export interface TerminalDataPayload {
  terminal_id: string;
  data: string;
}

export interface ScriptOutputPayload {
  workspace_id: string;
  script_type: string;
  data: string;
}

export interface ScriptExitPayload {
  workspace_id: string;
  script_type: string;
  exit_code: number;
}

export interface WorkspaceStatusInfo {
  session_status: "running" | "idle" | "new";
  lines_added: number;
  lines_removed: number;
  files_changed: number;
  last_activity: string | null;
}

// --- Commands ---

// NOTE: Tauri 2 defaults to rename_all = "camelCase" for command params.
// Rust snake_case params are auto-converted to camelCase on the JS side.
export const commands = {
  addRepo: (path: string) => invoke<Repo>("add_repo", { path }),
  listRepos: () => invoke<Repo[]>("list_repos"),
  updateRepoScripts: (
    id: string,
    setup?: string,
    run?: string,
    archive?: string
  ) => invoke("update_repo_scripts", { id, setup, run, archive }),

  createWorkspace: (repoId: string, task?: string) =>
    invoke<Workspace>("create_workspace", { repoId, task }),
  listWorkspaces: (repoId: string) =>
    invoke<Workspace[]>("list_workspaces", { repoId }),
  archiveWorkspace: (id: string) => invoke("archive_workspace", { id }),
  restoreWorkspace: (id: string) => invoke("restore_workspace", { id }),
  getWorkspaceStatus: (workspaceId: string) =>
    invoke<WorkspaceStatusInfo>("get_workspace_status", { workspaceId }),

  createSession: (workspaceId: string, model: string) =>
    invoke<Session>("create_session", { workspaceId, model }),
  sendMessage: (sessionId: string, content: string) =>
    invoke("send_message", { sessionId, content }),
  stopAgent: (sessionId: string) => invoke("stop_agent", { sessionId }),
  getMessages: (sessionId: string) =>
    invoke<Message[]>("get_messages", { sessionId }),

  listFiles: (workspaceId: string) =>
    invoke<FileEntry[]>("list_files", { workspaceId }),
  readFile: (workspaceId: string, path: string) =>
    invoke<string>("read_file", { workspaceId, path }),
  getDiff: (workspaceId: string) =>
    invoke<DiffEntry[]>("get_diff", { workspaceId }),
  getFileDiff: (workspaceId: string, path: string) =>
    invoke<string>("get_file_diff", { workspaceId, path }),
  readFileAtRef: (workspaceId: string, path: string) =>
    invoke<string>("read_file_at_ref", { workspaceId, path }),

  revertToCheckpoint: (messageId: string) =>
    invoke("revert_to_checkpoint", { messageId }),

  runScript: (workspaceId: string, scriptType: string) =>
    invoke("run_script", { workspaceId, scriptType }),

  createTerminal: (workspaceId: string) =>
    invoke<string>("create_terminal", { workspaceId }),
  writeTerminal: (terminalId: string, data: string) =>
    invoke("write_terminal", { terminalId, data }),
  resizeTerminal: (terminalId: string, rows: number, cols: number) =>
    invoke("resize_terminal", { terminalId, rows, cols }),
  closeTerminal: (terminalId: string) =>
    invoke("close_terminal", { terminalId }),
};

// --- Events ---

export const events = {
  onAgentMessage: (handler: (payload: AgentMessagePayload) => void): Promise<UnlistenFn> =>
    listen<AgentMessagePayload>("agent:message", (e) => handler(e.payload)),
  onAgentStatus: (handler: (payload: AgentStatusPayload) => void): Promise<UnlistenFn> =>
    listen<AgentStatusPayload>("agent:status", (e) => handler(e.payload)),
  onAgentComplete: (handler: (payload: AgentCompletePayload) => void): Promise<UnlistenFn> =>
    listen<AgentCompletePayload>("agent:complete", (e) => handler(e.payload)),
  onTerminalData: (handler: (payload: TerminalDataPayload) => void): Promise<UnlistenFn> =>
    listen<TerminalDataPayload>("terminal:data", (e) => handler(e.payload)),
  onScriptOutput: (handler: (payload: ScriptOutputPayload) => void): Promise<UnlistenFn> =>
    listen<ScriptOutputPayload>("script:output", (e) => handler(e.payload)),
  onScriptExit: (handler: (payload: ScriptExitPayload) => void): Promise<UnlistenFn> =>
    listen<ScriptExitPayload>("script:exit", (e) => handler(e.payload)),
};

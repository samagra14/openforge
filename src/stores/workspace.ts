import { create } from "zustand";

export interface Repo {
  id: string;
  name: string;
  path: string;
  default_branch: string;
  setup_script?: string;
  run_script?: string;
  archive_script?: string;
}

export interface Workspace {
  id: string;
  repo_id: string;
  city_name: string;
  worktree_path: string;
  branch_name: string;
  task_description?: string;
  status: "active" | "archived";
  created_at: string;
}

interface WorkspaceStore {
  repos: Repo[];
  workspaces: Workspace[];
  activeRepoId: string | null;
  activeWorkspaceId: string | null;
  setActiveRepo: (id: string | null) => void;
  setActiveWorkspace: (id: string | null) => void;
  addRepo: (repo: Repo) => void;
  setRepos: (repos: Repo[]) => void;
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (workspace: Workspace) => void;
  removeWorkspace: (id: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  repos: [],
  workspaces: [],
  activeRepoId: null,
  activeWorkspaceId: null,
  setActiveRepo: (id) => set({ activeRepoId: id }),
  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
  addRepo: (repo) => set((s) => ({ repos: [...s.repos, repo] })),
  setRepos: (repos) => set({ repos }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (workspace) =>
    set((s) => ({ workspaces: [...s.workspaces, workspace] })),
  removeWorkspace: (id) =>
    set((s) => ({ workspaces: s.workspaces.filter((w) => w.id !== id) })),
}));

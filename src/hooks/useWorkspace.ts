import { useCallback } from "react";
import { commands } from "../lib/tauri";
import { useWorkspaceStore } from "../stores/workspace";

export function useWorkspace() {
  const addWorkspace = useWorkspaceStore((s) => s.addWorkspace);
  const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setRepos = useWorkspaceStore((s) => s.setRepos);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  const loadRepos = useCallback(async () => {
    const repos = await commands.listRepos();
    setRepos(repos);
    return repos;
  }, [setRepos]);

  const loadWorkspaces = useCallback(
    async (repoId: string) => {
      const workspaces = await commands.listWorkspaces(repoId);
      setWorkspaces(workspaces);
      return workspaces;
    },
    [setWorkspaces]
  );

  const createWorkspace = useCallback(
    async (repoId: string, task?: string) => {
      const ws = await commands.createWorkspace(repoId, task);
      addWorkspace(ws);
      setActiveWorkspace(ws.id);
      return ws;
    },
    [addWorkspace, setActiveWorkspace]
  );

  const archiveWorkspace = useCallback(
    async (id: string) => {
      await commands.archiveWorkspace(id);
      removeWorkspace(id);
    },
    [removeWorkspace]
  );

  return {
    loadRepos,
    loadWorkspaces,
    createWorkspace,
    archiveWorkspace,
  };
}

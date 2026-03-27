import { open } from "@tauri-apps/plugin-dialog";
import { commands } from "./tauri";
import { useWorkspaceStore } from "../stores/workspace";

export async function addRepoViaDialog() {
  try {
    const selected = await open({ directory: true, multiple: false });
    if (selected) {
      const repo = await commands.addRepo(selected as string);
      useWorkspaceStore.getState().addRepo(repo);
    }
  } catch (e) {
    console.error("Failed to add repo:", e);
    // Fallback: prompt for path manually
    const path = window.prompt("Enter the full path to a git repository:");
    if (path) {
      try {
        const repo = await commands.addRepo(path);
        useWorkspaceStore.getState().addRepo(repo);
      } catch (e2) {
        console.error("Failed to add repo:", e2);
        alert(`Failed to add repo: ${e2}`);
      }
    }
  }
}

import { create } from "zustand";

type RightTab = "files" | "changes" | "review";
type RightBottomTab = "setup" | "run" | "terminal";
type CommandPaletteMode = "commands" | "files" | "workspaces";

interface UIStore {
  sidebarWidth: number;
  rightPanelWidth: number;
  activeRightTab: RightTab;
  rightBottomTab: RightBottomTab;
  commandPaletteOpen: boolean;
  commandPaletteMode: CommandPaletteMode;
  chatSearchOpen: boolean;
  settingsOpen: boolean;
  newWorkspaceOpen: boolean;
  setSidebarWidth: (w: number) => void;
  setRightPanelWidth: (w: number) => void;
  setActiveRightTab: (tab: RightTab) => void;
  setRightBottomTab: (tab: RightBottomTab) => void;
  setCommandPaletteOpen: (open: boolean, mode?: CommandPaletteMode) => void;
  setChatSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setNewWorkspaceOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarWidth: 240,
  rightPanelWidth: 320,
  activeRightTab: "files",
  rightBottomTab: "run",
  commandPaletteOpen: false,
  commandPaletteMode: "commands",
  chatSearchOpen: false,
  settingsOpen: false,
  newWorkspaceOpen: false,
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(180, Math.min(400, w)) }),
  setRightPanelWidth: (w) =>
    set({ rightPanelWidth: Math.max(240, Math.min(500, w)) }),
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  setRightBottomTab: (tab) => set({ rightBottomTab: tab }),
  setCommandPaletteOpen: (open, mode) =>
    set({
      commandPaletteOpen: open,
      ...(mode ? { commandPaletteMode: mode } : open ? { commandPaletteMode: "commands" } : {}),
    }),
  setChatSearchOpen: (open) => set({ chatSearchOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setNewWorkspaceOpen: (open) => set({ newWorkspaceOpen: open }),
}));

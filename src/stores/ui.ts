import { create } from "zustand";

type RightTab = "files" | "changes" | "review";
type RightBottomTab = "setup" | "run" | "terminal";

interface UIStore {
  sidebarWidth: number;
  rightPanelWidth: number;
  activeRightTab: RightTab;
  rightBottomTab: RightBottomTab;
  commandPaletteOpen: boolean;
  settingsOpen: boolean;
  newWorkspaceOpen: boolean;
  setSidebarWidth: (w: number) => void;
  setRightPanelWidth: (w: number) => void;
  setActiveRightTab: (tab: RightTab) => void;
  setRightBottomTab: (tab: RightBottomTab) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setNewWorkspaceOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarWidth: 240,
  rightPanelWidth: 320,
  activeRightTab: "files",
  rightBottomTab: "run",
  commandPaletteOpen: false,
  settingsOpen: false,
  newWorkspaceOpen: false,
  setSidebarWidth: (w) => set({ sidebarWidth: Math.max(180, Math.min(400, w)) }),
  setRightPanelWidth: (w) =>
    set({ rightPanelWidth: Math.max(240, Math.min(500, w)) }),
  setActiveRightTab: (tab) => set({ activeRightTab: tab }),
  setRightBottomTab: (tab) => set({ rightBottomTab: tab }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setNewWorkspaceOpen: (open) => set({ newWorkspaceOpen: open }),
}));

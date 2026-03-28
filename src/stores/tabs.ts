import { create } from "zustand";

export type TabType = "chat" | "file" | "diff" | "changes-overview";

interface BaseTab {
  id: string;
  type: TabType;
  label: string;
}

export interface ChatTab extends BaseTab {
  type: "chat";
  sessionId: string;
}

export interface FileTab extends BaseTab {
  type: "file";
  workspaceId: string;
  filePath: string;
}

export interface DiffTab extends BaseTab {
  type: "diff";
  workspaceId: string;
  filePath: string;
}

export interface ChangesOverviewTab extends BaseTab {
  type: "changes-overview";
  workspaceId: string;
}

export type Tab = ChatTab | FileTab | DiffTab | ChangesOverviewTab;

interface TabStore {
  // tabs keyed by workspaceId
  tabs: Record<string, Tab[]>;
  // active tab id keyed by workspaceId
  activeTabId: Record<string, string | null>;

  openChatTab: (workspaceId: string, sessionId: string, title: string) => void;
  openFileTab: (workspaceId: string, filePath: string) => void;
  openDiffTab: (workspaceId: string, filePath: string) => void;
  openChangesOverviewTab: (workspaceId: string) => void;
  closeTab: (workspaceId: string, tabId: string) => void;
  setActiveTab: (workspaceId: string, tabId: string) => void;
  getWorkspaceTabs: (workspaceId: string) => Tab[];
  getActiveTab: (workspaceId: string) => Tab | null;
}

function fileNameFromPath(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: {},
  activeTabId: {},

  openChatTab: (workspaceId, sessionId, title) => {
    const state = get();
    const existing = (state.tabs[workspaceId] ?? []).find(
      (t) => t.id === sessionId
    );
    if (existing) {
      set({ activeTabId: { ...state.activeTabId, [workspaceId]: sessionId } });
      return;
    }
    const tab: ChatTab = {
      id: sessionId,
      type: "chat",
      label: title,
      sessionId,
    };
    set({
      tabs: {
        ...state.tabs,
        [workspaceId]: [...(state.tabs[workspaceId] ?? []), tab],
      },
      activeTabId: { ...state.activeTabId, [workspaceId]: sessionId },
    });
  },

  openFileTab: (workspaceId, filePath) => {
    const state = get();
    const tabId = `file:${workspaceId}:${filePath}`;
    const existing = (state.tabs[workspaceId] ?? []).find(
      (t) => t.id === tabId
    );
    if (existing) {
      set({ activeTabId: { ...state.activeTabId, [workspaceId]: tabId } });
      return;
    }
    const tab: FileTab = {
      id: tabId,
      type: "file",
      label: fileNameFromPath(filePath),
      workspaceId,
      filePath,
    };
    set({
      tabs: {
        ...state.tabs,
        [workspaceId]: [...(state.tabs[workspaceId] ?? []), tab],
      },
      activeTabId: { ...state.activeTabId, [workspaceId]: tabId },
    });
  },

  openDiffTab: (workspaceId, filePath) => {
    const state = get();
    const tabId = `diff:${workspaceId}:${filePath}`;
    const existing = (state.tabs[workspaceId] ?? []).find(
      (t) => t.id === tabId
    );
    if (existing) {
      set({ activeTabId: { ...state.activeTabId, [workspaceId]: tabId } });
      return;
    }
    const tab: DiffTab = {
      id: tabId,
      type: "diff",
      label: fileNameFromPath(filePath),
      workspaceId,
      filePath,
    };
    set({
      tabs: {
        ...state.tabs,
        [workspaceId]: [...(state.tabs[workspaceId] ?? []), tab],
      },
      activeTabId: { ...state.activeTabId, [workspaceId]: tabId },
    });
  },

  openChangesOverviewTab: (workspaceId) => {
    const state = get();
    const tabId = `changes:${workspaceId}`;
    const existing = (state.tabs[workspaceId] ?? []).find(
      (t) => t.id === tabId
    );
    if (existing) {
      set({ activeTabId: { ...state.activeTabId, [workspaceId]: tabId } });
      return;
    }
    const tab: ChangesOverviewTab = {
      id: tabId,
      type: "changes-overview",
      label: "Changes",
      workspaceId,
    };
    set({
      tabs: {
        ...state.tabs,
        [workspaceId]: [...(state.tabs[workspaceId] ?? []), tab],
      },
      activeTabId: { ...state.activeTabId, [workspaceId]: tabId },
    });
  },

  closeTab: (workspaceId, tabId) => {
    const state = get();
    const currentTabs = state.tabs[workspaceId] ?? [];
    const idx = currentTabs.findIndex((t) => t.id === tabId);
    if (idx < 0) return;

    const newTabs = currentTabs.filter((t) => t.id !== tabId);
    let newActiveId = state.activeTabId[workspaceId];

    if (newActiveId === tabId) {
      // Activate adjacent tab: prefer previous, then next, then null
      if (newTabs.length === 0) {
        newActiveId = null;
      } else if (idx > 0) {
        newActiveId = newTabs[idx - 1].id;
      } else {
        newActiveId = newTabs[0].id;
      }
    }

    set({
      tabs: { ...state.tabs, [workspaceId]: newTabs },
      activeTabId: { ...state.activeTabId, [workspaceId]: newActiveId },
    });
  },

  setActiveTab: (workspaceId, tabId) => {
    set((state) => ({
      activeTabId: { ...state.activeTabId, [workspaceId]: tabId },
    }));
  },

  getWorkspaceTabs: (workspaceId) => {
    return get().tabs[workspaceId] ?? [];
  },

  getActiveTab: (workspaceId) => {
    const state = get();
    const activeId = state.activeTabId[workspaceId];
    if (!activeId) return null;
    return (state.tabs[workspaceId] ?? []).find((t) => t.id === activeId) ?? null;
  },
}));

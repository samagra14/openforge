import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Plus,
  MessageSquarePlus,
  Settings,
  Search,
  FolderOpen,
  Cpu,
  LayoutGrid,
} from "lucide-react";
import { useUIStore } from "../../stores/ui";
import { useWorkspaceStore } from "../../stores/workspace";
import { useSessionStore } from "../../stores/session";
import { useTabStore } from "../../stores/tabs";
import { createFuzzySearcher } from "../../lib/fuzzySearch";
import { HighlightMatch } from "./HighlightMatch";
import { FilePickerContent } from "./FilePickerContent";
import { WorkspaceSearchContent } from "./WorkspaceSearchContent";
import { commands } from "../../lib/tauri";

export function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const mode = useUIStore((s) => s.commandPaletteMode);
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen);
  const setNewWorkspaceOpen = useUIStore((s) => s.setNewWorkspaceOpen);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const repos = useWorkspaceStore((s) => s.repos);
  const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset query and selection when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, mode]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center"
      style={{ background: "var(--overlay)", paddingTop: "20vh" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className="w-[560px] h-fit max-h-[60vh] rounded-2xl overflow-hidden flex flex-col animate-fade-in-scale"
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <Search size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={
              mode === "files"
                ? "Search files by name..."
                : mode === "workspaces"
                  ? "Search workspaces..."
                  : "Type a command..."
            }
            className="flex-1 bg-transparent outline-none"
            style={{
              color: "var(--text-primary)",
              fontSize: 15,
              letterSpacing: "-0.01em",
              caretColor: "var(--accent)",
            }}
          />
          {mode !== "commands" && (
            <button
              onClick={() => setOpen(true, "commands")}
              className="text-xs px-2 py-1 rounded-md hover-bg"
              style={{ color: "var(--text-tertiary)" }}
            >
              Back
            </button>
          )}
        </div>

        <div
          className="overflow-y-auto px-2 py-2"
          style={{ maxHeight: "calc(60vh - 60px)" }}
        >
          {mode === "commands" && (
            <CommandsContent
              query={query}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
              workspaces={workspaces}
              repos={repos}
              onSelect={close}
              onSwitchWorkspace={(id) => {
                setActiveWorkspace(id);
                close();
              }}
              onNewWorkspace={() => {
                close();
                setNewWorkspaceOpen(true);
              }}
              onNewChat={() => {
                const wsId = useWorkspaceStore.getState().activeWorkspaceId;
                if (wsId) {
                  commands.createSession(wsId, "sonnet").then((session) => {
                    useSessionStore.getState().addSession(session);
                    useSessionStore.getState().setActiveSession(session.id);
                    useTabStore.getState().openChatTab(wsId, session.id, session.title);
                  }).catch(console.error);
                }
                close();
              }}
              onOpenSettings={() => {
                close();
                setSettingsOpen(true);
              }}
              onOpenFiles={() => {
                setOpen(true, "files");
                setQuery("");
                setSelectedIndex(0);
              }}
              onSearchWorkspaces={() => {
                setOpen(true, "workspaces");
                setQuery("");
                setSelectedIndex(0);
              }}
            />
          )}
          {mode === "files" && (
            <FilePickerContent
              query={query}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
              onClose={close}
            />
          )}
          {mode === "workspaces" && (
            <WorkspaceSearchContent
              query={query}
              selectedIndex={selectedIndex}
              setSelectedIndex={setSelectedIndex}
              onClose={close}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- Commands mode content ---

interface CommandItemDef {
  id: string;
  label: string;
  group: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  shortcut?: string;
  secondary?: string;
  onSelect: () => void;
}

function CommandsContent({
  query,
  selectedIndex,
  setSelectedIndex,
  workspaces,
  repos,
  onSelect,
  onSwitchWorkspace,
  onNewWorkspace,
  onNewChat,
  onOpenSettings,
  onOpenFiles,
  onSearchWorkspaces,
}: {
  query: string;
  selectedIndex: number;
  setSelectedIndex: (i: number) => void;
  workspaces: { id: string; city_name: string; repo_id: string; status: string }[];
  repos: { id: string; name: string }[];
  onSelect: () => void;
  onSwitchWorkspace: (id: string) => void;
  onNewWorkspace: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onOpenFiles: () => void;
  onSearchWorkspaces: () => void;
}) {
  const activeWorkspaces = workspaces.filter((w) => w.status === "active");
  const repoMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of repos) m.set(r.id, r.name);
    return m;
  }, [repos]);

  const items: CommandItemDef[] = useMemo(() => {
    const result: CommandItemDef[] = [];

    result.push({ id: "new-workspace", label: "New Workspace", group: "Actions", icon: Plus, shortcut: "⌘N", onSelect: onNewWorkspace });
    result.push({ id: "new-chat", label: "New Chat", group: "Actions", icon: MessageSquarePlus, shortcut: "⌘T", onSelect: onNewChat });
    result.push({ id: "open-file", label: "Open File...", group: "Actions", icon: FolderOpen, shortcut: "⌘P", onSelect: onOpenFiles });
    result.push({ id: "search-workspaces", label: "Search Workspaces...", group: "Actions", icon: LayoutGrid, shortcut: "⌘⇧F", onSelect: onSearchWorkspaces });
    result.push({ id: "open-settings", label: "Settings", group: "Actions", icon: Settings, onSelect: onOpenSettings });

    for (let i = 0; i < activeWorkspaces.length; i++) {
      const ws = activeWorkspaces[i];
      const repoName = repoMap.get(ws.repo_id) ?? "";
      result.push({
        id: `switch-ws-${ws.id}`,
        label: ws.city_name,
        group: "Workspaces",
        icon: LayoutGrid,
        secondary: repoName,
        shortcut: i < 9 ? `⌘${i + 1}` : undefined,
        onSelect: () => onSwitchWorkspace(ws.id),
      });
    }

    result.push({ id: "model-sonnet", label: "Switch to Sonnet 4.6", group: "Model", icon: Cpu, onSelect: onSelect });
    result.push({ id: "model-opus", label: "Switch to Opus 4.6", group: "Model", icon: Cpu, onSelect: onSelect });
    result.push({ id: "model-haiku", label: "Switch to Haiku 4.5", group: "Model", icon: Cpu, onSelect: onSelect });

    return result;
  }, [activeWorkspaces, repoMap, onNewWorkspace, onNewChat, onOpenFiles, onSearchWorkspaces, onOpenSettings, onSwitchWorkspace, onSelect]);

  const searcher = useMemo(
    () => createFuzzySearcher(items, [(i) => i.label, (i) => i.secondary ?? ""]),
    [items]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items.map((item) => ({ item, highlights: null as [string, boolean][] | null }));
    return searcher.search(query, 20).map((r) => ({ item: r.item, highlights: r.highlights }));
  }, [query, items, searcher]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex(Math.min(selectedIndex + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(Math.max(selectedIndex - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0 && selectedIndex < filtered.length) {
        e.preventDefault();
        filtered[selectedIndex]?.item?.onSelect();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [filtered, selectedIndex, setSelectedIndex]);

  // Group by group name
  const grouped = useMemo(() => {
    const groups: { name: string; items: typeof filtered }[] = [];
    const groupMap = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const list = groupMap.get(entry.item.group) ?? [];
      list.push(entry);
      groupMap.set(entry.item.group, list);
    }
    for (const [name, items] of groupMap) {
      groups.push({ name, items });
    }
    return groups;
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
        No results found.
      </div>
    );
  }

  let flatIdx = 0;

  return (
    <>
      {grouped.map((group) => (
        <div key={group.name} className="command-palette-group">
          <div
            className="px-3 py-2 text-[11px] font-semibold uppercase"
            style={{ color: "var(--text-tertiary)", letterSpacing: "0.08em" }}
          >
            {group.name}
          </div>
          {group.items.map((entry) => {
            const idx = flatIdx++;
            const isSelected = idx === selectedIndex;
            const Icon = entry.item.icon;

            return (
              <div
                key={entry.item.id}
                onClick={entry.item.onSelect}
                onMouseEnter={() => setSelectedIndex(idx)}
                className="command-palette-item"
                style={{
                  background: isSelected ? "var(--bg-tertiary)" : "transparent",
                }}
              >
                <Icon size={16} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                  {entry.highlights ? (
                    <HighlightMatch segments={entry.highlights} />
                  ) : (
                    entry.item.label
                  )}
                </span>
                {entry.item.secondary && (
                  <span className="text-xs truncate" style={{ color: "var(--text-tertiary)", maxWidth: 120 }}>
                    {entry.item.secondary}
                  </span>
                )}
                {entry.item.shortcut && (
                  <span className="text-xs font-mono ml-2 flex-shrink-0" style={{ color: "var(--text-tertiary)", letterSpacing: "0.02em" }}>
                    {entry.item.shortcut}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

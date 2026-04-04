import { create } from "zustand";

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "running" | "done" | "error";
  sub_tool_calls?: ToolCall[];
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  tool_calls?: ToolCall[];
  subagent_count?: number;
  duration_ms?: number;
  checkpoint_ref?: string;
  timestamp: string;
}

export interface Session {
  id: string;
  workspace_id: string;
  title: string;
  model: string;
  status: "idle" | "running" | "waiting" | "error";
  claude_session_id?: string;
  token_count: number;
  cost_usd: number;
  created_at: string;
}

interface SessionStore {
  sessions: Session[];
  messages: Record<string, Message[]>;
  activeSessionId: string | null;
  messagesLoaded: Set<string>;
  setActiveSession: (id: string | null) => void;
  addSession: (session: Session) => void;
  setSessions: (sessions: Session[]) => void;
  updateSessionStatus: (id: string, status: Session["status"]) => void;
  updateSessionCost: (id: string, cost: number, tokens: number) => void;
  updateSessionClaudeId: (id: string, claudeId: string) => void;
  markMessagesLoaded: (sessionId: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  upsertMessage: (sessionId: string, message: Message) => void;
  setMessages: (sessionId: string, messages: Message[]) => void;
  updateMessage: (
    sessionId: string,
    messageId: string,
    updates: Partial<Message>
  ) => void;
  updateLastAssistantMessage: (
    sessionId: string,
    updates: Partial<Message>
  ) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  sessions: [],
  messages: {},
  activeSessionId: null,
  messagesLoaded: new Set<string>(),
  setActiveSession: (id) => set({ activeSessionId: id }),
  addSession: (session) =>
    set((s) => ({ sessions: [...s.sessions, session] })),
  setSessions: (sessions) => set({ sessions }),
  updateSessionStatus: (id, status) =>
    set((s) => ({
      sessions: s.sessions.map((session) =>
        session.id === id ? { ...session, status } : session
      ),
    })),
  updateSessionCost: (id, cost_usd, token_count) =>
    set((s) => ({
      sessions: s.sessions.map((session) =>
        session.id === id ? { ...session, cost_usd, token_count } : session
      ),
    })),
  updateSessionClaudeId: (id, claudeId) =>
    set((s) => ({
      sessions: s.sessions.map((session) =>
        session.id === id
          ? { ...session, claude_session_id: claudeId }
          : session
      ),
    })),
  markMessagesLoaded: (sessionId) =>
    set((s) => {
      const next = new Set(s.messagesLoaded);
      next.add(sessionId);
      return { messagesLoaded: next };
    }),
  addMessage: (sessionId, message) =>
    set((s) => {
      const existing = s.messages[sessionId] ?? [];
      // Guard against duplicates: if a message with this ID already exists, skip
      if (existing.some((m) => m.id === message.id)) {
        return s;
      }
      return {
        messages: {
          ...s.messages,
          [sessionId]: [...existing, message],
        },
      };
    }),
  upsertMessage: (sessionId, message) =>
    set((s) => {
      const existing = s.messages[sessionId] ?? [];
      const idx = existing.findIndex((m) => m.id === message.id);
      if (idx >= 0) {
        // Update in place
        const updated = [...existing];
        updated[idx] = { ...existing[idx], ...message };
        return {
          messages: { ...s.messages, [sessionId]: updated },
        };
      }
      // Add new
      return {
        messages: {
          ...s.messages,
          [sessionId]: [...existing, message],
        },
      };
    }),
  setMessages: (sessionId, messages) =>
    set((s) => ({
      messages: { ...s.messages, [sessionId]: messages },
    })),
  updateMessage: (sessionId, messageId, updates) =>
    set((s) => ({
      messages: {
        ...s.messages,
        [sessionId]: (s.messages[sessionId] ?? []).map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        ),
      },
    })),
  updateLastAssistantMessage: (sessionId, updates) =>
    set((s) => {
      const msgs = s.messages[sessionId] ?? [];
      // Find last assistant message and update it
      let lastIdx = -1;
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") { lastIdx = i; break; }
      }
      if (lastIdx < 0) return s;
      const updated = [...msgs];
      updated[lastIdx] = { ...updated[lastIdx], ...updates };
      return { messages: { ...s.messages, [sessionId]: updated } };
    }),
}));

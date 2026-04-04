import { useEffect, useRef } from "react";
import { useSessionStore } from "../../stores/session";
import { useUIStore } from "../../stores/ui";
import type { Message, ToolCall } from "../../stores/session";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { SystemMessage } from "./SystemMessage";
import { ChatSearchProvider } from "./ChatSearchContext";
import { ChatSearchBar } from "./ChatSearchBar";
import { commands } from "../../lib/tauri";

interface Props {
  sessionId: string;
}

// Stable empty array to avoid creating new references on every render
const EMPTY_MESSAGES: Message[] = [];

export function ChatView({ sessionId }: Props) {
  const rawMessages = useSessionStore((s) => s.messages[sessionId]);
  const messages = rawMessages ?? EMPTY_MESSAGES;
  const messagesLoaded = useSessionStore((s) => s.messagesLoaded.has(sessionId));
  const chatSearchOpen = useUIStore((s) => s.chatSearchOpen);

  // Lazy-load messages from Claude's JSONL when opening a persisted session
  useEffect(() => {
    if (messagesLoaded) return;
    if (messages.length > 0) return; // Already have messages from streaming

    let cancelled = false;
    console.log(`[ChatView] Loading history for session ${sessionId}, messagesLoaded=${messagesLoaded}, messages.length=${messages.length}`);
    commands.loadSessionHistory(sessionId).then((history) => {
      if (cancelled) return;
      console.log(`[ChatView] Got ${history.length} messages from backend for session ${sessionId}`, history.slice(0, 2));
      if (history.length === 0) {
        useSessionStore.getState().markMessagesLoaded(sessionId);
        return;
      }

      const parsed: Message[] = history.map((msg) => {
        let toolCalls: ToolCall[] | undefined;
        // tool_calls comes as a JSON string from the backend history loader
        const rawToolCalls = (msg as unknown as { tool_calls?: string }).tool_calls;
        if (rawToolCalls) {
          try {
            const tcArray = JSON.parse(rawToolCalls) as Array<{
              name: string;
              input: Record<string, unknown>;
              output?: string;
              sub_tool_calls?: Array<{
                name: string;
                input: Record<string, unknown>;
                output?: string;
              }>;
            }>;
            toolCalls = tcArray.map((tc) => ({
              name: tc.name,
              input: tc.input,
              output: tc.output,
              status: "done" as const,
              sub_tool_calls: tc.sub_tool_calls?.map((stc) => ({
                name: stc.name,
                input: stc.input,
                output: stc.output,
                status: "done" as const,
              })),
            }));
          } catch {
            // Ignore parse errors for tool_calls
          }
        }

        return {
          id: msg.id,
          session_id: sessionId,
          role: msg.role,
          content: msg.content,
          tool_calls: toolCalls,
          timestamp: msg.timestamp,
        };
      });

      useSessionStore.getState().setMessages(sessionId, parsed);
      useSessionStore.getState().markMessagesLoaded(sessionId);
    }).catch(console.error);

    return () => { cancelled = true; };
  }, [sessionId, messagesLoaded, messages.length]);

  const session = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === sessionId)
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const messageCount = messages.length;
  const lastMessageContent = messages[messages.length - 1]?.content.length ?? 0;

  // Track whether user is near the bottom of the scroll container
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const threshold = 150;
      isNearBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll only if user is near the bottom
  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageCount, lastMessageContent]);

  if (messages.length === 0 && session?.status !== "running") {
    return (
      <div className="flex-1 flex flex-col items-center justify-end pb-6 h-full">
        <div className="text-center px-8 mb-3">
          <p
            className="text-lg font-semibold mb-2"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.03em" }}
          >
            What are you building?
          </p>
          <p
            className="text-sm"
            style={{ color: "var(--text-tertiary)", lineHeight: 1.6 }}
          >
            Ask Claude to make changes, explore code, or help you build something.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ChatSearchProvider>
      <div className="relative h-full">
        {chatSearchOpen && <ChatSearchBar />}
        <div ref={scrollRef} className="overflow-y-auto h-full">
          <div className="max-w-3xl mx-auto py-8 px-6 space-y-7">
            {messages.map((msg) =>
              msg.role === "system" ? (
                <SystemMessage key={msg.id} message={msg} />
              ) : msg.role === "user" ? (
                <UserMessage key={msg.id} message={msg} />
              ) : (
                <AssistantMessage key={msg.id} message={msg} />
              )
            )}

            {session?.status === "running" && (
              <div className="flex items-center gap-3 py-4">
                <span
                  className="w-2.5 h-2.5 rounded-full animate-pulse-dot"
                  style={{ background: "var(--accent)" }}
                />
                <span
                  className="text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Claude is working...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ChatSearchProvider>
  );
}

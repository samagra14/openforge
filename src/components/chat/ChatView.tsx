import { useEffect, useRef } from "react";
import { useSessionStore } from "../../stores/session";
import type { Message } from "../../stores/session";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { Loader2 } from "lucide-react";

interface Props {
  sessionId: string;
}

// Stable empty array to avoid creating new references on every render
const EMPTY_MESSAGES: Message[] = [];

export function ChatView({ sessionId }: Props) {
  // Select messages for this session. The selector returns undefined
  // when no messages exist yet; we fall back outside the selector so
  // we don't create a new array reference inside Zustand's shallow
  // equality check.
  const rawMessages = useSessionStore((s) => s.messages[sessionId]);
  const messages = rawMessages ?? EMPTY_MESSAGES;

  const session = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === sessionId)
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Memoize message count so auto-scroll only fires when a new message
  // is added (not on every content update of an existing message).
  const messageCount = messages.length;
  const lastMessageContent = messages[messages.length - 1]?.content.length ?? 0;

  // Auto-scroll to bottom on new messages or content growth
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messageCount, lastMessageContent]);

  if (messages.length === 0 && session?.status !== "running") {
    return (
      <div className="flex-1 flex flex-col items-center justify-end pb-4 h-full">
        <div className="text-center px-8 mb-2">
          <p
            className="text-sm font-medium mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            Start a conversation
          </p>
          <p className="text-2xs" style={{ color: "var(--text-tertiary)" }}>
            Ask Claude to make changes, explore code, or help you build something.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="overflow-y-auto h-full">
      <div className="max-w-3xl mx-auto py-4 px-6 space-y-4">
        {messages.map((msg) =>
          msg.role === "user" ? (
            <UserMessage key={msg.id} message={msg} />
          ) : (
            <AssistantMessage key={msg.id} message={msg} />
          )
        )}

        {session?.status === "running" && (
          <div className="flex items-center gap-2 py-2">
            <Loader2
              size={14}
              className="animate-spin"
              style={{ color: "var(--accent)" }}
            />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Claude is working...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

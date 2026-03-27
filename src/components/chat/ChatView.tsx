import { useEffect, useRef } from "react";
import { useSessionStore } from "../../stores/session";
import type { Message } from "../../stores/session";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";

interface Props {
  sessionId: string;
}

// Stable empty array to avoid creating new references on every render
const EMPTY_MESSAGES: Message[] = [];

export function ChatView({ sessionId }: Props) {
  const rawMessages = useSessionStore((s) => s.messages[sessionId]);
  const messages = rawMessages ?? EMPTY_MESSAGES;

  const session = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === sessionId)
  );
  const scrollRef = useRef<HTMLDivElement>(null);

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
    <div ref={scrollRef} className="overflow-y-auto h-full">
      <div className="max-w-3xl mx-auto py-8 px-6 space-y-7">
        {messages.map((msg) =>
          msg.role === "user" ? (
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
  );
}

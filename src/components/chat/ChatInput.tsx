import { useRef, useState, useCallback } from "react";
import {
  ArrowUp,
  Loader2,
  Square,
  Brain,
  ChevronDown,
  ThumbsDown,
  Plus,
} from "lucide-react";
import { useSessionStore } from "../../stores/session";
import { commands } from "../../lib/tauri";

interface Props {
  sessionId: string;
}

export function ChatInput({ sessionId }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [model, setModel] = useState("sonnet");
  const [thinking, setThinking] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const session = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === sessionId)
  );
  const addMessage = useSessionStore((s) => s.addMessage);
  const isRunning = session?.status === "running";
  const disabled = isRunning || sending;

  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    setSending(true);

    addMessage(sessionId, {
      id: crypto.randomUUID(),
      session_id: sessionId,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    });

    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await commands.sendMessage(sessionId, trimmed);
    } catch (e) {
      console.error("Failed to send message:", e);
    } finally {
      setSending(false);
    }
  }, [value, disabled, sessionId, addMessage]);

  const handleStop = useCallback(async () => {
    try {
      await commands.stopAgent(sessionId);
    } catch (e) {
      console.error("Failed to stop agent:", e);
    }
  }, [sessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const hasText = value.trim().length > 0;

  const modelLabel =
    model === "opus"
      ? "Opus 4.6"
      : model === "haiku"
        ? "Haiku 4.5"
        : "Sonnet 4.6";

  return (
    <div className="max-w-3xl mx-auto w-full px-6 pb-3">
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "var(--bg-tertiary)",
          border: `1px solid ${hasText ? "var(--text-tertiary)" : "var(--border)"}`,
          transition: "border-color 0.15s",
        }}
      >
        {/* Input row */}
        <div className="flex items-end px-4 pt-3 pb-2">
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isRunning
                ? "Claude is working..."
                : "Ask to make changes, @mention files, run /commands"
            }
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent outline-none text-sm"
            style={{
              color: "var(--text-primary)",
              maxHeight: 200,
              lineHeight: 1.5,
            }}
          />

          {isRunning ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 ml-2 p-1 rounded-md hover:bg-white/10 transition-colors"
              title="Stop (Esc)"
            >
              <Square size={16} fill="var(--error)" style={{ color: "var(--error)" }} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!hasText || sending}
              className="flex-shrink-0 ml-2 w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-20 transition-all"
              style={{
                background: hasText ? "var(--text-secondary)" : "transparent",
              }}
              title="Send (Enter)"
            >
              {sending ? (
                <Loader2
                  size={14}
                  className="animate-spin"
                  style={{ color: "var(--bg-primary)" }}
                />
              ) : (
                <ArrowUp
                  size={14}
                  style={{
                    color: hasText ? "var(--bg-primary)" : "var(--text-tertiary)",
                  }}
                />
              )}
            </button>
          )}
        </div>

        {/* Bottom toolbar inside the input card */}
        <div className="flex items-center justify-between px-3 pb-2">
          <div className="flex items-center gap-1">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-2xs hover:bg-white/5 transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--success)" }}
                />
                {modelLabel}
                <ChevronDown size={10} style={{ color: "var(--text-tertiary)" }} />
              </button>

              {showModelMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowModelMenu(false)}
                  />
                  <div
                    className="absolute bottom-full left-0 mb-1 rounded-md shadow-lg py-1 min-w-[140px] z-50"
                    style={{
                      background: "var(--bg-secondary)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {["sonnet", "opus", "haiku"].map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setModel(m);
                          setShowModelMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-2xs hover:bg-white/5 flex items-center gap-2"
                        style={{
                          color:
                            m === model
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                        }}
                      >
                        {m === "opus"
                          ? "Opus 4.6"
                          : m === "haiku"
                            ? "Haiku 4.5"
                            : "Sonnet 4.6"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Feedback */}
            <button
              className="p-1 rounded hover:bg-white/5 transition-colors"
              title="Give feedback"
            >
              <ThumbsDown size={12} style={{ color: "var(--text-tertiary)" }} />
            </button>

            {/* Thinking toggle */}
            <button
              onClick={() => setThinking(!thinking)}
              className="flex items-center gap-1 px-2 py-1 rounded text-2xs transition-colors hover:bg-white/5"
              style={{
                color: thinking ? "var(--accent)" : "var(--text-tertiary)",
              }}
            >
              <Brain size={12} />
              Thinking
            </button>
          </div>

          {/* Right side */}
          <button
            className="p-1 rounded hover:bg-white/5 transition-colors"
            title="New Chat (⌘T)"
          >
            <Plus size={14} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

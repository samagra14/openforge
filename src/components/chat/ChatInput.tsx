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
import { SlashCommandMenu } from "./SlashCommandMenu";
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
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const session = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === sessionId)
  );
  const addMessage = useSessionStore((s) => s.addMessage);
  const isRunning = session?.status === "running";
  const disabled = isRunning || sending;

  // Detect slash command mode: starts with "/" and no spaces yet
  const handleSend = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    setSending(true);

    // Handle /restart specially — clears session, inserts system message
    if (trimmed === "/restart") {
      addMessage(sessionId, {
        id: crypto.randomUUID(),
        session_id: sessionId,
        role: "system",
        content: "Session restarted",
        timestamp: new Date().toISOString(),
      });
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      try {
        await commands.restartSession(sessionId);
      } catch (e) {
        console.error("Failed to restart session:", e);
      } finally {
        setSending(false);
      }
      return;
    }

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
    // Let SlashCommandMenu handle these keys when visible — prevent textarea defaults
    if (showSlashMenu && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Tab" || e.key === "Enter")) {
      e.preventDefault();
      return; // SlashCommandMenu's capture-phase listener will handle these
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && showSlashMenu) {
      e.preventDefault();
      setShowSlashMenu(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Show/hide slash command menu
    const isSlash = newValue.startsWith("/") && !newValue.includes(" ");
    setShowSlashMenu(isSlash && newValue.length > 0);

    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  const handleSlashSelect = (command: string) => {
    setValue(command);
    setShowSlashMenu(false);
    // Auto-send the slash command
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const hasText = value.trim().length > 0;

  const modelLabel =
    model === "opus"
      ? "Opus 4.6"
      : model === "haiku"
        ? "Haiku 4.5"
        : "Sonnet 4.6";

  return (
    <div className="max-w-3xl mx-auto w-full px-6 pb-5">
      <div className="relative">
        {/* Slash command autocomplete — outside overflow-hidden container */}
        {showSlashMenu && (
          <SlashCommandMenu
            filter={value}
            onSelect={handleSlashSelect}
            onDismiss={() => setShowSlashMenu(false)}
          />
        )}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--bg-tertiary)",
          border: `1px solid ${hasText ? "var(--border-strong)" : "var(--border)"}`,
          boxShadow: hasText ? "var(--shadow-md)" : "var(--shadow-xs)",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
      >

        {/* Input row */}
        <div className="flex items-end px-5 pt-4 pb-3">
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
            className="flex-1 resize-none bg-transparent outline-none"
            style={{
              color: "var(--text-primary)",
              maxHeight: 200,
              lineHeight: 1.6,
              letterSpacing: "-0.01em",
              fontSize: 14,
            }}
          />

          {isRunning ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 ml-3 p-2 rounded-lg hover-bg transition-colors"
              title="Stop (Esc)"
            >
              <Square size={15} fill="var(--error)" style={{ color: "var(--error)" }} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!hasText || sending}
              className="flex-shrink-0 ml-3 w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-15 transition-all"
              style={{
                background: hasText ? "var(--text-primary)" : "transparent",
                border: hasText ? "none" : "1px solid var(--border)",
              }}
              title="Send (Enter)"
            >
              {sending ? (
                <Loader2
                  size={15}
                  className="animate-spin"
                  style={{ color: "var(--bg-primary)" }}
                />
              ) : (
                <ArrowUp
                  size={15}
                  style={{
                    color: hasText ? "var(--bg-primary)" : "var(--text-tertiary)",
                  }}
                />
              )}
            </button>
          )}
        </div>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-1">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover-bg transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: "var(--success)" }}
                />
                {modelLabel}
                <ChevronDown size={11} style={{ color: "var(--text-tertiary)" }} />
              </button>

              {showModelMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowModelMenu(false)}
                  />
                  <div
                    className="absolute bottom-full left-0 mb-1.5 rounded-xl py-2 min-w-[160px] z-50 animate-fade-in-scale"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-strong)",
                      boxShadow: "var(--shadow-lg)",
                    }}
                  >
                    {["sonnet", "opus", "haiku"].map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setModel(m);
                          setShowModelMenu(false);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover-bg flex items-center gap-2 transition-colors"
                        style={{
                          color:
                            m === model
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                          fontWeight: m === model ? 500 : 400,
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
              className="p-1.5 rounded-lg hover-bg transition-colors"
              title="Give feedback"
            >
              <ThumbsDown size={13} style={{ color: "var(--text-tertiary)" }} />
            </button>

            {/* Thinking toggle */}
            <button
              onClick={() => setThinking(!thinking)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover-bg"
              style={{
                color: thinking ? "var(--accent)" : "var(--text-tertiary)",
              }}
            >
              <Brain size={13} />
              Thinking
            </button>
          </div>

          {/* Right side */}
          <button
            className="p-1.5 rounded-lg hover-bg transition-colors"
            title="New Chat (⌘T)"
          >
            <Plus size={15} style={{ color: "var(--text-tertiary)" }} />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

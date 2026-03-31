import { useRef, useState, useCallback, useEffect } from "react";
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
import { commands, type AgentProviderInfo } from "../../lib/tauri";

interface Props {
  sessionId: string;
}

/** Compact display names for providers */
const PROVIDER_ICONS: Record<string, string> = {
  "claude-code": "C",
  gemini: "G",
  codex: "Cx",
  aider: "A",
  goose: "Go",
  copilot: "Cp",
  cline: "Cl",
  opencode: "OC",
  amp: "Am",
  warp: "W",
  "qwen-code": "Q",
  crush: "Cr",
  augment: "Au",
  kilo: "K",
  kiro: "Ki",
  droid: "Dr",
  "go-code": "GC",
  chaterm: "Ch",
};

export function ChatInput({ sessionId }: Props) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [providers, setProviders] = useState<AgentProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("claude-code");
  const [model, setModel] = useState("sonnet");
  const [thinking, setThinking] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const session = useSessionStore((s) =>
    s.sessions.find((sess) => sess.id === sessionId)
  );
  const addMessage = useSessionStore((s) => s.addMessage);
  const isRunning = session?.status === "running";
  const disabled = isRunning || sending;

  // Load providers on mount
  useEffect(() => {
    commands.listProviders().then((p) => {
      setProviders(p);
    }).catch(console.error);
  }, []);

  // Sync provider/model from session
  useEffect(() => {
    if (session) {
      setSelectedProvider(session.agent_provider || "claude-code");
      setModel(session.model);
    }
  }, [session?.agent_provider, session?.model]);

  const currentProvider = providers.find((p) => p.id === selectedProvider);
  const currentModels = currentProvider?.models ?? [];

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
    currentModels.find((m) => m.id === model)?.name ?? model;
  const providerLabel = currentProvider?.name ?? selectedProvider;
  const providerIcon = PROVIDER_ICONS[selectedProvider] ?? "?";

  return (
    <div className="max-w-3xl mx-auto w-full px-6 pb-5">
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
                ? `${providerLabel} is working...`
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
            {/* Provider selector */}
            <div className="relative">
              <button
                onClick={() => setShowProviderMenu(!showProviderMenu)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover-bg transition-colors"
                style={{ color: "var(--text-secondary)" }}
              >
                <span
                  className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {providerIcon}
                </span>
                {providerLabel}
                <ChevronDown size={11} style={{ color: "var(--text-tertiary)" }} />
              </button>

              {showProviderMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowProviderMenu(false)}
                  />
                  <div
                    className="absolute bottom-full left-0 mb-1.5 rounded-xl py-2 min-w-[220px] max-h-[320px] overflow-y-auto z-50 animate-fade-in-scale"
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-strong)",
                      boxShadow: "var(--shadow-lg)",
                    }}
                  >
                    {providers.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProvider(p.id);
                          setModel(p.default_model);
                          setShowProviderMenu(false);
                          commands.updateSessionProvider(sessionId, p.id, p.default_model).catch(console.error);
                        }}
                        className="w-full text-left px-4 py-2 text-xs hover-bg flex items-center gap-2.5 transition-colors"
                        style={{
                          color:
                            p.id === selectedProvider
                              ? "var(--text-primary)"
                              : "var(--text-secondary)",
                          fontWeight: p.id === selectedProvider ? 500 : 400,
                        }}
                      >
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{
                            background:
                              p.id === selectedProvider
                                ? "var(--accent)"
                                : "var(--bg-tertiary)",
                            color:
                              p.id === selectedProvider
                                ? "white"
                                : "var(--text-tertiary)",
                          }}
                        >
                          {PROVIDER_ICONS[p.id] ?? "?"}
                        </span>
                        {p.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Model selector */}
            {currentModels.length > 1 && (
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
                      className="absolute bottom-full left-0 mb-1.5 rounded-xl py-2 min-w-[180px] z-50 animate-fade-in-scale"
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-strong)",
                        boxShadow: "var(--shadow-lg)",
                      }}
                    >
                      {currentModels.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setModel(m.id);
                            setShowModelMenu(false);
                            commands.updateSessionProvider(sessionId, selectedProvider, m.id).catch(console.error);
                          }}
                          className="w-full text-left px-4 py-2 text-xs hover-bg flex items-center gap-2 transition-colors"
                          style={{
                            color:
                              m.id === model
                                ? "var(--text-primary)"
                                : "var(--text-secondary)",
                            fontWeight: m.id === model ? 500 : 400,
                          }}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Feedback */}
            <button
              className="p-1.5 rounded-lg hover-bg transition-colors"
              title="Give feedback"
            >
              <ThumbsDown size={13} style={{ color: "var(--text-tertiary)" }} />
            </button>

            {/* Thinking toggle (Claude Code only) */}
            {selectedProvider === "claude-code" && (
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
            )}
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
  );
}

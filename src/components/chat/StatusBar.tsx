import { Brain, ChevronDown, Plus, ThumbsDown } from "lucide-react";
import type { Session } from "../../stores/session";
import { useState, useEffect } from "react";
import { commands, type AgentProviderInfo } from "../../lib/tauri";

interface Props {
  session: Session;
}

export function StatusBar({ session }: Props) {
  const [providers, setProviders] = useState<AgentProviderInfo[]>([]);
  const [thinking, setThinking] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);

  useEffect(() => {
    commands.listProviders().then(setProviders).catch(console.error);
  }, []);

  const currentProvider = providers.find((p) => p.id === session.agent_provider);
  const providerName = currentProvider?.name ?? session.agent_provider;
  const currentModel = currentProvider?.models.find((m) => m.id === session.model);
  const modelLabel = currentModel?.name ?? session.model;

  return (
    <div
      className="flex items-center justify-between px-6 py-1.5"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Provider + Model label */}
        <div className="relative">
          <button
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium transition-colors hover:bg-white/5"
            style={{
              color: "var(--text-secondary)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "var(--success)" }}
            />
            {providerName} / {modelLabel}
            <ChevronDown size={10} style={{ color: "var(--text-tertiary)" }} />
          </button>

          {showModelMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowModelMenu(false)}
              />
              <div
                className="absolute bottom-full left-0 mb-1 rounded-md shadow-lg py-1 min-w-[160px] z-50"
                style={{
                  background: "var(--bg-tertiary)",
                  border: "1px solid var(--border)",
                }}
              >
                {currentProvider?.models.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      commands
                        .updateSessionProvider(session.id, session.agent_provider, m.id)
                        .catch(console.error);
                      setShowModelMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-2xs hover:bg-white/5 flex items-center gap-2"
                    style={{
                      color:
                        m.id === session.model
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                    }}
                  >
                    {m.id === session.model && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                    )}
                    {m.name}
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
          <ThumbsDown size={13} style={{ color: "var(--text-tertiary)" }} />
        </button>

        {/* Thinking toggle (Claude Code only) */}
        {session.agent_provider === "claude-code" && (
          <button
            onClick={() => setThinking(!thinking)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-2xs font-medium transition-colors"
            style={{
              background: thinking
                ? "rgba(245, 166, 35, 0.15)"
                : "transparent",
              color: thinking ? "var(--accent)" : "var(--text-tertiary)",
            }}
          >
            <Brain size={12} />
            Thinking
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Cost */}
        {session.cost_usd > 0 && (
          <span
            className="text-2xs font-mono"
            style={{ color: "var(--text-tertiary)" }}
          >
            ${session.cost_usd.toFixed(3)}
          </span>
        )}

        {/* New chat */}
        <button
          className="p-1 rounded hover:bg-white/5 transition-colors"
          title="New Chat (⌘T)"
        >
          <Plus size={14} style={{ color: "var(--text-tertiary)" }} />
        </button>
      </div>
    </div>
  );
}

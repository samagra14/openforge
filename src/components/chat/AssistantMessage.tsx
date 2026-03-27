import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, ToolCall } from "../../stores/session";
import {
  Brain,
  ChevronRight,
  ChevronDown,
  Check,
  Loader2,
  AlertCircle,
  Copy,
  ClipboardCheck,
  GitBranch,
  Bot,
} from "lucide-react";

interface Props {
  message: Message;
}

/** Extract <thinking>...</thinking> blocks from content */
function parseThinking(content: string): {
  thinking: string[];
  text: string;
} {
  const thinkingBlocks: string[] = [];
  const text = content.replace(
    /<thinking>([\s\S]*?)<\/thinking>/g,
    (_, t) => {
      thinkingBlocks.push(t.trim());
      return "";
    }
  );
  return { thinking: thinkingBlocks, text: text.trim() };
}

/** Format a tool call's first argument into a short summary */
function toolSummary(tc: ToolCall): string {
  if (!tc.input || typeof tc.input !== "object") return "";
  const val = tc.input as Record<string, unknown>;

  // Common patterns
  if (val.command) return String(val.command).slice(0, 80);
  if (val.file_path) return String(val.file_path);
  if (val.pattern) return String(val.pattern);
  if (val.query) return String(val.query).slice(0, 60);
  if (val.prompt) return String(val.prompt).slice(0, 60);
  if (val.description) return String(val.description).slice(0, 60);
  if (val.path) return String(val.path);
  if (val.content) return String(val.content).slice(0, 60);

  // Fallback: show first string value
  const firstVal = Object.values(val).find((v) => typeof v === "string");
  return firstVal ? String(firstVal).slice(0, 60) : "";
}

/** Format duration from ms */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m, ${secs}s`;
}

/** Detect if a tool call is an Agent (subagent) call */
function isAgentCall(tc: ToolCall): boolean {
  return tc.name === "Agent" || tc.name === "Task" || tc.name === "TaskCreate";
}

/** Get file path from tool call if it's a file operation */
function getFileBadge(tc: ToolCall): string | null {
  if (!tc.input || typeof tc.input !== "object") return null;
  const val = tc.input as Record<string, unknown>;
  if (
    (tc.name === "Edit" || tc.name === "Write" || tc.name === "Read") &&
    val.file_path
  ) {
    const fp = String(val.file_path);
    return fp.split("/").pop() ?? fp;
  }
  return null;
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="mb-3 rounded"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs"
        style={{ color: "var(--text-tertiary)" }}
      >
        <Brain size={13} style={{ color: "var(--text-tertiary)" }} />
        <span>Thinking</span>
        <span className="ml-auto">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
      </button>
      {expanded && (
        <div
          className="px-3 pb-3 text-xs"
          style={{ color: "var(--text-tertiary)", lineHeight: 1.6 }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

function ToolCallItem({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const isAgent = isAgentCall(tc);
  const summary = toolSummary(tc);

  const statusIcon = () => {
    switch (tc.status) {
      case "running":
        return (
          <Loader2
            size={12}
            className="animate-spin"
            style={{ color: "var(--accent)" }}
          />
        );
      case "done":
        return <Check size={12} style={{ color: "var(--success)" }} />;
      case "error":
        return <AlertCircle size={12} style={{ color: "var(--error)" }} />;
    }
  };

  return (
    <div
      className="rounded"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--border)",
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs"
        style={{ color: "var(--text-secondary)" }}
      >
        {statusIcon()}
        {isAgent ? (
          <Bot size={13} style={{ color: "var(--accent)" }} />
        ) : null}
        <span
          className="font-medium"
          style={{ color: isAgent ? "var(--accent)" : "var(--text-primary)" }}
        >
          {isAgent ? "Agent" : tc.name}
        </span>
        <span
          className="truncate text-left flex-1 font-mono"
          style={{ color: "var(--text-tertiary)", fontSize: 11 }}
        >
          {summary}
        </span>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>

      {expanded && tc.output && (
        <div
          className="px-3 pb-2 overflow-auto"
          style={{ maxHeight: 200 }}
        >
          <pre
            className="text-2xs font-mono whitespace-pre-wrap"
            style={{ color: "var(--text-tertiary)", lineHeight: 1.4 }}
          >
            {tc.output.slice(0, 2000)}
          </pre>
        </div>
      )}
    </div>
  );
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
}: Props) {
  const [copied, setCopied] = useState(false);

  const { thinking, text } = parseThinking(message.content);

  // Collect file badges from tool calls
  const fileBadges: { name: string; adds: number; dels: number }[] = [];
  if (message.tool_calls) {
    const fileSet = new Set<string>();
    for (const tc of message.tool_calls) {
      const f = getFileBadge(tc);
      if (f && !fileSet.has(f)) {
        fileSet.add(f);
        // Rough heuristic: Edit/Write = modified
        fileBadges.push({
          name: f,
          adds: tc.name === "Write" ? 1 : tc.name === "Edit" ? 1 : 0,
          dels: tc.name === "Edit" ? 1 : 0,
        });
      }
    }
  }

  const toolCalls = message.tool_calls ?? [];
  const agentCalls = toolCalls.filter(isAgentCall);
  const regularCalls = toolCalls.filter((tc) => !isAgentCall(tc));

  const handleCopy = () => {
    navigator.clipboard.writeText(text || message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="py-2">
      {/* Thinking blocks */}
      {thinking.map((t, i) => (
        <ThinkingBlock key={i} text={t} />
      ))}

      {/* Main text content */}
      {text && (
        <div className="prose-sm" style={{ lineHeight: 1.6 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      )}

      {/* Agent calls - shown prominently */}
      {agentCalls.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {agentCalls.map((tc, i) => (
            <ToolCallItem key={i} tc={tc} />
          ))}
        </div>
      )}

      {/* Regular tool calls */}
      {regularCalls.length > 0 && (
        <div className="mt-3 space-y-1">
          {regularCalls.map((tc, i) => (
            <ToolCallItem key={i} tc={tc} />
          ))}
        </div>
      )}

      {/* Footer: duration, actions, file badges */}
      {(message.duration_ms || fileBadges.length > 0 || toolCalls.length > 0) && (
        <div className="flex items-center gap-2 mt-3 flex-wrap" style={{ color: "var(--text-tertiary)" }}>
          {/* Duration */}
          {message.duration_ms ? (
            <span className="text-2xs">{formatDuration(message.duration_ms)}</span>
          ) : null}

          {/* Separator */}
          {message.duration_ms && (text || fileBadges.length > 0) && (
            <span className="text-2xs">·</span>
          )}

          {/* Copy */}
          {text && (
            <button
              onClick={handleCopy}
              className="p-0.5 rounded hover:bg-white/5"
              title="Copy response"
            >
              {copied ? (
                <ClipboardCheck size={13} style={{ color: "var(--success)" }} />
              ) : (
                <Copy size={13} />
              )}
            </button>
          )}

          {/* Git icon */}
          {fileBadges.length > 0 && (
            <>
              <GitBranch size={13} />
              <span className="text-2xs">·</span>
            </>
          )}

          {/* File change badges - Conductor style */}
          {fileBadges.map((f) => (
            <span
              key={f.name}
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-2xs font-mono"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--border)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: "var(--accent)" }}
              />
              <span style={{ color: "var(--text-secondary)" }}>{f.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
});

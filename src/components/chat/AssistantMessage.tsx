import { memo, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, ToolCall } from "../../stores/session";
import { HighlightText } from "./HighlightText";
import {
  ChevronRight,
  ChevronDown,
  Copy,
  ClipboardCheck,
  Bot,
  FileText,
  Terminal as TerminalIcon,
  Search,
  Pencil,
  FilePlus2,
  FolderSearch,
} from "lucide-react";
import { FileTypeIcon } from "../common/FileTypeIcon";

/** Wrap string children with HighlightText for search highlighting */
function wrapTextChildren(children: React.ReactNode): React.ReactNode {
  if (!children) return children;
  if (typeof children === "string") {
    return <HighlightText text={children} />;
  }
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? <HighlightText key={i} text={child} /> : child
    );
  }
  return children;
}

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

/** Get a short filename from a path */
function shortName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Build a human-readable description + optional file badge for a tool call */
function toolDisplay(tc: ToolCall): { label: string; badge: string | null; icon: typeof FileText; isFile: boolean } {
  const val = (tc.input && typeof tc.input === "object" ? tc.input : {}) as Record<string, unknown>;

  switch (tc.name) {
    case "Read":
      return {
        label: "Read",
        badge: val.file_path ? shortName(String(val.file_path)) : null,
        icon: FileText,
        isFile: true,
      };
    case "Edit":
      return {
        label: "Edit",
        badge: val.file_path ? shortName(String(val.file_path)) : null,
        icon: Pencil,
        isFile: true,
      };
    case "Write":
      return {
        label: "Write",
        badge: val.file_path ? shortName(String(val.file_path)) : null,
        icon: FilePlus2,
        isFile: true,
      };
    case "Bash":
      return {
        label: "Run",
        badge: val.command ? String(val.command).slice(0, 50) : null,
        icon: TerminalIcon,
        isFile: false,
      };
    case "Grep":
      return {
        label: "Search",
        badge: val.pattern ? String(val.pattern).slice(0, 40) : null,
        icon: Search,
        isFile: false,
      };
    case "Glob":
      return {
        label: "Find",
        badge: val.pattern ? String(val.pattern).slice(0, 40) : null,
        icon: FolderSearch,
        isFile: false,
      };
    default: {
      // Generic fallback
      const firstStr = Object.values(val).find((v) => typeof v === "string");
      return {
        label: tc.name,
        badge: firstStr ? String(firstStr).slice(0, 50) : null,
        icon: FileText,
        isFile: false,
      };
    }
  }
}

/** Format duration from ms */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

/** Detect if a tool call is an Agent (subagent) call */
function isAgentCall(tc: ToolCall): boolean {
  return tc.name === "Agent" || tc.name === "Task" || tc.name === "TaskCreate";
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === "done"
      ? "var(--success)"
      : status === "error"
        ? "var(--error)"
        : "var(--accent)";

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${status === "running" ? "animate-pulse-dot" : ""}`}
      style={{ background: color }}
    />
  );
}

function ThinkingBlock({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="thinking-block mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-5 py-3"
      >
        <span
          className="section-label"
          style={{
            color: "var(--accent)",
            fontStyle: "italic",
            letterSpacing: "0.06em",
          }}
        >
          Reasoning
        </span>
        <span className="ml-auto" style={{ color: "var(--text-tertiary)" }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {expanded && (
        <div
          className="px-5 pb-4 text-sm"
          style={{ color: "var(--text-secondary)", lineHeight: 1.75 }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

/** Flat inline row for regular tool calls (Read, Edit, Write, Bash, etc.) */
function InlineToolCall({ tc }: { tc: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const { label, badge, icon: Icon, isFile } = toolDisplay(tc);
  const isBash = tc.name === "Bash";

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 py-1.5 w-full hover-bg rounded-lg px-2.5 -mx-2.5 transition-colors cursor-pointer"
      >
        <StatusDot status={tc.status} />
        {isFile && badge ? (
          <FileTypeIcon filename={badge} size={14} />
        ) : (
          <Icon size={14} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
        )}
        <span
          className="text-[13px] font-medium flex-shrink-0"
          style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
        >
          {label}
        </span>
        {badge && (
          isBash ? (
            <span
              className="truncate text-left flex-1 font-mono"
              style={{ color: "var(--text-tertiary)", fontSize: 12 }}
            >
              {badge}
            </span>
          ) : (
            <span className="file-badge">
              {badge}
            </span>
          )
        )}
        <span className="ml-auto flex-shrink-0" style={{ color: "var(--text-tertiary)" }}>
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </span>
      </button>

      {expanded && (
        <div
          className="ml-7 pl-4 py-2.5 overflow-auto"
          style={{
            borderLeft: "1.5px solid var(--border-strong)",
            maxHeight: 280,
          }}
        >
          {tc.output ? (
            <pre
              className="font-mono whitespace-pre-wrap"
              style={{
                color: "var(--text-secondary)",
                lineHeight: 1.65,
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: 12,
              }}
            >
              {tc.output.slice(0, 2000)}
            </pre>
          ) : (
            <span
              className="text-xs italic"
              style={{ color: "var(--text-tertiary)" }}
            >
              {tc.status === "running" ? "Executing\u2026" : "No output"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** Card treatment for Agent calls */
function AgentToolCall({ tc }: { tc: ToolCall }) {
  const isRunning = tc.status === "running";
  const hasContent = (tc.sub_tool_calls?.length ?? 0) > 0 || !!tc.output;
  const [expanded, setExpanded] = useState(isRunning || hasContent);
  const val = (tc.input && typeof tc.input === "object" ? tc.input : {}) as Record<string, unknown>;
  const description = val.description
    ? String(val.description).slice(0, 60)
    : val.prompt
      ? String(val.prompt).slice(0, 60)
      : "";

  const subCalls = tc.sub_tool_calls ?? [];

  return (
    <div className="tool-card tool-card-agent">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-3 w-full px-4 py-3 text-[13px] cursor-pointer"
      >
        <StatusDot status={tc.status} />
        <Bot size={15} style={{ color: "var(--accent)" }} />
        <span
          className="font-medium"
          style={{ color: "var(--accent)", letterSpacing: "-0.01em" }}
        >
          Agent
        </span>
        <span
          className="truncate text-left flex-1"
          style={{ color: "var(--text-secondary)", fontSize: 13 }}
        >
          {description}
        </span>
        <span style={{ color: "var(--text-tertiary)" }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {expanded && (
        <>
          <div
            className="mx-4"
            style={{ borderTop: "1px solid var(--border-strong)" }}
          />

          {/* Sub-agent tool calls */}
          {subCalls.length > 0 && (
            <div className="px-4 pt-2 pb-1 space-y-0.5">
              {subCalls.map((stc, i) => (
                <InlineToolCall key={i} tc={stc} />
              ))}
            </div>
          )}

          {/* Agent final output */}
          <div className="px-4 py-3.5 overflow-auto" style={{ maxHeight: 400 }}>
            {tc.output ? (
              <div
                className="assistant-prose"
                style={{ lineHeight: 1.7, fontSize: 12.5 }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {tc.output.slice(0, 4000)}
                </ReactMarkdown>
              </div>
            ) : (
              <span
                className="text-xs italic"
                style={{ color: "var(--text-tertiary)" }}
              >
                {tc.status === "running" ? "Executing\u2026" : "No output"}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export const AssistantMessage = memo(function AssistantMessage({
  message,
}: Props) {
  const [copied, setCopied] = useState(false);

  const { thinking, text } = parseThinking(message.content);

  const toolCalls = message.tool_calls ?? [];

  // Agent calls get card treatment; their sub_tool_calls are nested by the backend.
  const agentCalls = toolCalls.filter(isAgentCall);
  const regularCalls = toolCalls.filter((tc) => !isAgentCall(tc));

  // Custom ReactMarkdown components to enable search highlighting in text nodes
  const markdownComponents = useMemo(
    () => ({
      // Override text-bearing elements to wrap string children in HighlightText
      p: ({ children, ...props }: any) => (
        <p {...props}>{wrapTextChildren(children)}</p>
      ),
      li: ({ children, ...props }: any) => (
        <li {...props}>{wrapTextChildren(children)}</li>
      ),
      strong: ({ children, ...props }: any) => (
        <strong {...props}>{wrapTextChildren(children)}</strong>
      ),
      em: ({ children, ...props }: any) => (
        <em {...props}>{wrapTextChildren(children)}</em>
      ),
      td: ({ children, ...props }: any) => (
        <td {...props}>{wrapTextChildren(children)}</td>
      ),
      th: ({ children, ...props }: any) => (
        <th {...props}>{wrapTextChildren(children)}</th>
      ),
    }),
    []
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(text || message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="py-1">
      {/* Thinking blocks */}
      {thinking.map((t, i) => (
        <ThinkingBlock key={i} text={t} />
      ))}

      {/* Main text content */}
      {text && (
        <div className="assistant-prose" style={{ lineHeight: 1.85, fontSize: 14.5 }}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {text}
          </ReactMarkdown>
        </div>
      )}

      {/* Agent calls — card treatment */}
      {agentCalls.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {agentCalls.map((tc, i) => (
            <AgentToolCall key={i} tc={tc} />
          ))}
        </div>
      )}

      {/* Regular tool calls — flat inline rows */}
      {regularCalls.length > 0 && (
        <div className="mt-4 space-y-0.5">
          {regularCalls.map((tc, i) => (
            <InlineToolCall key={i} tc={tc} />
          ))}
        </div>
      )}

      {/* Footer: duration + copy */}
      {(message.duration_ms || text) && (
        <div
          className="flex items-center gap-3 mt-5"
          style={{ color: "var(--text-tertiary)" }}
        >
          {message.duration_ms ? (
            <span className="text-xs font-mono" style={{ letterSpacing: "0.02em" }}>
              {formatDuration(message.duration_ms)}
            </span>
          ) : null}

          {text && (
            <button
              onClick={handleCopy}
              className="p-1 rounded-md hover-bg transition-colors"
              title="Copy response"
            >
              {copied ? (
                <ClipboardCheck size={14} style={{ color: "var(--success)" }} />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

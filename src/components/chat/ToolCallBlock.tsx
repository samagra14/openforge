import { useState } from "react";
import { ChevronRight, ChevronDown, Check, Loader2, AlertCircle } from "lucide-react";
import type { ToolCall } from "../../stores/session";

interface Props {
  toolCalls: ToolCall[];
}

export function ToolCallBlock({ toolCalls }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusIcon = (status: ToolCall["status"]) => {
    switch (status) {
      case "running":
        return <Loader2 size={11} className="animate-spin" style={{ color: "var(--accent)" }} />;
      case "done":
        return <Check size={11} style={{ color: "var(--success)" }} />;
      case "error":
        return <AlertCircle size={11} style={{ color: "var(--error)" }} />;
    }
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-2xs hover:bg-white/5 px-2 py-1 rounded"
        style={{ color: "var(--text-secondary)" }}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
      </button>

      {expanded && (
        <div
          className="mt-1 ml-4 space-y-1 rounded p-2"
          style={{ background: "var(--code-bg)", border: "1px solid var(--border)" }}
        >
          {toolCalls.map((tc, i) => (
            <div key={i} className="flex items-start gap-2 text-2xs font-mono">
              {statusIcon(tc.status)}
              <span style={{ color: "var(--accent)" }}>{tc.name}</span>
              <span
                className="truncate"
                style={{ color: "var(--text-tertiary)" }}
              >
                {typeof tc.input === "object"
                  ? JSON.stringify(tc.input).slice(0, 80)
                  : String(tc.input)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

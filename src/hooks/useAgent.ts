import { useEffect, useRef, useCallback } from "react";
import { events, commands } from "../lib/tauri";
import type { AgentToolCallPayload } from "../lib/tauri";
import { useSessionStore } from "../stores/session";
import type { Message, ToolCall } from "../stores/session";

/** Recursively map streaming tool call payload to store ToolCall */
function mapToolCall(tc: AgentToolCallPayload): ToolCall {
  return {
    name: tc.name,
    input: tc.input,
    output: tc.output,
    status: tc.status as "running" | "done" | "error",
    sub_tool_calls: tc.sub_tool_calls?.map(mapToolCall),
  };
}

/**
 * Subscribes to Tauri events for a given session and upserts messages
 * into the Zustand store. Uses requestAnimationFrame to batch rapid
 * streaming updates (cumulative snapshots arrive many times per second)
 * so the frontend renders at most once per frame (~60fps).
 */
export function useAgent(sessionId: string | null) {
  // Grab stable action references from the store.
  const upsertMessage = useSessionStore((s) => s.upsertMessage);
  const updateSessionStatus = useSessionStore((s) => s.updateSessionStatus);
  const updateSessionCost = useSessionStore((s) => s.updateSessionCost);
  const updateSessionClaudeId = useSessionStore((s) => s.updateSessionClaudeId);
  const updateLastAssistantMessage = useSessionStore((s) => s.updateLastAssistantMessage);
  const markMessagesLoaded = useSessionStore((s) => s.markMessagesLoaded);

  // We store the sessionId in a ref so event handlers always see the
  // latest value without needing to re-subscribe.
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  // --- rAF-based throttle for streaming message updates ---
  // Buffer the latest payload per message_id. Since each assistant event
  // is a cumulative snapshot, only the latest one for a given id matters.
  const pendingMessages = useRef<Map<string, Message>>(new Map());
  const rafId = useRef<number>(0);

  const flushMessages = useCallback(() => {
    const pending = pendingMessages.current;
    for (const [, msg] of pending) {
      upsertMessage(msg.session_id, msg);
    }
    pending.clear();
    rafId.current = 0;
  }, [upsertMessage]);

  const scheduleMessageUpdate = useCallback(
    (msg: Message) => {
      pendingMessages.current.set(msg.id, msg);
      if (!rafId.current) {
        rafId.current = requestAnimationFrame(flushMessages);
      }
    },
    [flushMessages]
  );

  useEffect(() => {
    if (!sessionId) return;

    let disposed = false;
    const unlistenFns: Array<() => void> = [];

    const setup = async () => {
      // Set up agent:message listener
      const unlistenMessage = await events.onAgentMessage((payload) => {
        if (disposed) return;
        if (payload.session_id !== sessionIdRef.current) return;

        scheduleMessageUpdate({
          id: payload.message_id,
          session_id: payload.session_id,
          role: payload.role as "user" | "assistant",
          content: payload.content,
          tool_calls: payload.tool_calls.map(mapToolCall),
          timestamp: new Date().toISOString(),
        });
      });
      if (disposed) {
        unlistenMessage();
        return;
      }
      unlistenFns.push(unlistenMessage);

      // Set up agent:status listener
      const unlistenStatus = await events.onAgentStatus((payload) => {
        if (disposed) return;
        if (payload.session_id !== sessionIdRef.current) return;
        updateSessionStatus(
          payload.session_id,
          payload.status as "idle" | "running" | "waiting" | "error"
        );
      });
      if (disposed) {
        unlistenStatus();
        return;
      }
      unlistenFns.push(unlistenStatus);

      // Set up agent:complete listener
      const unlistenComplete = await events.onAgentComplete((payload) => {
        if (disposed) return;
        if (payload.session_id !== sessionIdRef.current) return;

        // Flush any pending message updates before marking complete,
        // so the final content is visible.
        if (pendingMessages.current.size > 0) {
          if (rafId.current) {
            cancelAnimationFrame(rafId.current);
            rafId.current = 0;
          }
          flushMessages();
        }

        updateSessionStatus(payload.session_id, "idle");
        updateSessionCost(payload.session_id, payload.cost_usd, 0);
        // Mark messages as loaded so ChatView doesn't try to load from JSONL
        markMessagesLoaded(payload.session_id);
        // Store duration on the last assistant message for the footer
        if (payload.duration_ms) {
          updateLastAssistantMessage(payload.session_id, {
            duration_ms: payload.duration_ms,
          });
        }
        if (payload.claude_session_id) {
          updateSessionClaudeId(
            payload.session_id,
            payload.claude_session_id
          );
        }

        // Reload history from JSONL to enrich Agent cards with sub_tool_calls
        // (sub-agent data is only in the subagent JSONL files, not in the stream)
        commands.loadSessionHistory(payload.session_id).then((history) => {
          if (disposed || history.length === 0) return;
          const parsed: Message[] = history.map((msg) => {
            let toolCalls: ToolCall[] | undefined;
            const rawTC = (msg as unknown as { tool_calls?: string }).tool_calls;
            if (rawTC) {
              try {
                const arr = JSON.parse(rawTC) as Array<{
                  name: string;
                  input: Record<string, unknown>;
                  output?: string;
                  sub_tool_calls?: Array<{
                    name: string;
                    input: Record<string, unknown>;
                    output?: string;
                  }>;
                }>;
                toolCalls = arr.map((tc) => ({
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
              } catch { /* ignore */ }
            }
            return {
              id: msg.id,
              session_id: payload.session_id,
              role: msg.role as "user" | "assistant",
              content: msg.content,
              tool_calls: toolCalls,
              timestamp: msg.timestamp,
            };
          });
          useSessionStore.getState().setMessages(payload.session_id, parsed);
        }).catch(() => { /* non-critical */ });
      });
      if (disposed) {
        unlistenComplete();
        return;
      }
      unlistenFns.push(unlistenComplete);

      // Set up agent:error listener — handles expired sessions
      const unlistenError = await events.onAgentError((payload) => {
        if (disposed) return;
        if (payload.session_id !== sessionIdRef.current) return;

        if (payload.error_type === "session_expired") {
          // Clear the stale claude_session_id so next message starts fresh
          commands.clearSessionClaudeId(payload.session_id).catch(console.error);
          updateSessionClaudeId(payload.session_id, "");
          updateSessionStatus(payload.session_id, "error");
        }
      });
      if (disposed) {
        unlistenError();
        return;
      }
      unlistenFns.push(unlistenError);
    };

    setup();

    return () => {
      disposed = true;
      // Cancel any pending rAF and flush remaining messages
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
      // Flush any remaining buffered messages so nothing is lost
      if (pendingMessages.current.size > 0) {
        flushMessages();
      }
      // Unlisten any listeners that have been set up so far
      for (const unlisten of unlistenFns) {
        unlisten();
      }
    };
  }, [
    sessionId,
    scheduleMessageUpdate,
    flushMessages,
    updateSessionStatus,
    updateSessionCost,
    updateSessionClaudeId,
    updateLastAssistantMessage,
    markMessagesLoaded,
  ]);
}

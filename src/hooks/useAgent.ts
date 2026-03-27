import { useEffect, useRef } from "react";
import { events } from "../lib/tauri";
import { useSessionStore } from "../stores/session";

/**
 * Subscribes to Tauri events for a given session and upserts messages
 * into the Zustand store. Handles React StrictMode double-mounts and
 * async listener setup with a disposed flag to prevent stale handlers.
 */
export function useAgent(sessionId: string | null) {
  // Grab stable action references from the store.
  // Zustand v5 create() returns stable function references, so these
  // will not change between renders and won't cause effect re-runs.
  const upsertMessage = useSessionStore((s) => s.upsertMessage);
  const updateSessionStatus = useSessionStore((s) => s.updateSessionStatus);
  const updateSessionCost = useSessionStore((s) => s.updateSessionCost);
  const updateSessionClaudeId = useSessionStore((s) => s.updateSessionClaudeId);
  const updateLastAssistantMessage = useSessionStore((s) => s.updateLastAssistantMessage);

  // We store the sessionId in a ref so event handlers always see the
  // latest value without needing to re-subscribe.
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    if (!sessionId) return;

    let disposed = false;
    const unlistenFns: Array<() => void> = [];

    const setup = async () => {
      // Set up agent:message listener
      const unlistenMessage = await events.onAgentMessage((payload) => {
        if (disposed) return;
        if (payload.session_id !== sessionIdRef.current) return;

        upsertMessage(payload.session_id, {
          id: payload.message_id,
          session_id: payload.session_id,
          role: payload.role as "user" | "assistant",
          content: payload.content,
          tool_calls: payload.tool_calls.map((tc) => ({
            ...tc,
            status: tc.status as "running" | "done" | "error",
          })),
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
        updateSessionStatus(payload.session_id, "idle");
        updateSessionCost(payload.session_id, payload.cost_usd, 0);
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
      });
      if (disposed) {
        unlistenComplete();
        return;
      }
      unlistenFns.push(unlistenComplete);
    };

    setup();

    return () => {
      disposed = true;
      // Unlisten any listeners that have been set up so far
      for (const unlisten of unlistenFns) {
        unlisten();
      }
    };
  }, [
    sessionId,
    upsertMessage,
    updateSessionStatus,
    updateSessionCost,
    updateSessionClaudeId,
    updateLastAssistantMessage,
  ]);
}

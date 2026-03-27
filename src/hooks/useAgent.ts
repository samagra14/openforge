import { useEffect, useRef, useCallback } from "react";
import { events } from "../lib/tauri";
import { useSessionStore } from "../stores/session";
import type { Message } from "../stores/session";

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
  ]);
}

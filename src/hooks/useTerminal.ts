import { useEffect, useRef, useState, useCallback } from "react";
import { commands, events } from "../lib/tauri";

export function useTerminal(workspaceId: string | null) {
  const [terminalId, setTerminalId] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  // Track the active terminal ID in a ref so `write` and `resize`
  // always have the current value without re-creating callbacks.
  const terminalIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    let disposed = false;
    let createdTerminalId: string | null = null;
    let unlistenFn: (() => void) | null = null;

    const init = async () => {
      try {
        const id = await commands.createTerminal(workspaceId);
        createdTerminalId = id;

        if (disposed) {
          // Component unmounted while we were awaiting; clean up
          commands.closeTerminal(id).catch(() => {});
          return;
        }

        setTerminalId(id);
        terminalIdRef.current = id;

        const unlisten = await events.onTerminalData((payload) => {
          if (disposed) return;
          if (payload.terminal_id === id) {
            setOutput((prev) => prev + payload.data);
          }
        });

        if (disposed) {
          unlisten();
          commands.closeTerminal(id).catch(() => {});
          return;
        }

        unlistenFn = unlisten;
      } catch (e) {
        if (!disposed) {
          console.error("Failed to create terminal:", e);
          setOutput(`Failed to create terminal: ${e}\n`);
        }
      }
    };

    init();

    return () => {
      disposed = true;
      unlistenFn?.();
      if (createdTerminalId) {
        commands.closeTerminal(createdTerminalId).catch(() => {});
      }
      setTerminalId(null);
      terminalIdRef.current = null;
      setOutput("");
    };
  }, [workspaceId]);

  const write = useCallback(async (data: string) => {
    const id = terminalIdRef.current;
    if (!id) return;
    await commands.writeTerminal(id, data);
  }, []);

  const resize = useCallback(async (rows: number, cols: number) => {
    const id = terminalIdRef.current;
    if (!id) return;
    await commands.resizeTerminal(id, rows, cols);
  }, []);

  return { terminalId, output, write, resize };
}

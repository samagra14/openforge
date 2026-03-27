import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { commands, events } from "../../lib/tauri";

interface Props {
  workspaceId: string;
}

export function TerminalPanel({ workspaceId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current || !workspaceId) return;

    let disposed = false;
    let terminalId: string | null = null;
    let unlistenFn: (() => void) | null = null;

    // Create xterm instance
    const term = new Terminal({
      theme: {
        background: "#1e1e22",
        foreground: "#e8e8ec",
        cursor: "#f5a623",
        cursorAccent: "#1e1e22",
        selectionBackground: "rgba(245, 166, 35, 0.3)",
        black: "#1a1a1e",
        red: "#ff453a",
        green: "#34c759",
        yellow: "#f5a623",
        blue: "#61afef",
        magenta: "#c678dd",
        cyan: "#56b6c2",
        white: "#e8e8ec",
        brightBlack: "#5e5e63",
        brightRed: "#ff6961",
        brightGreen: "#98c379",
        brightYellow: "#e5c07b",
        brightBlue: "#7ec8e3",
        brightMagenta: "#d19a66",
        brightCyan: "#56b6c2",
        brightWhite: "#ffffff",
      },
      fontFamily: '"SF Mono", "Menlo", "Monaco", "Courier New", monospace',
      fontSize: 13,
      lineHeight: 1.3,
      cursorBlink: true,
      cursorStyle: "bar",
      scrollback: 5000,
      allowTransparency: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    termRef.current = term;
    fitRef.current = fitAddon;

    term.open(containerRef.current);

    // Small delay to let the container size settle before fitting
    requestAnimationFrame(() => {
      if (!disposed) {
        fitAddon.fit();
      }
    });

    // Handle user input -> send to PTY
    const onDataDispose = term.onData((data) => {
      if (terminalId) {
        commands.writeTerminal(terminalId, data).catch(console.error);
      }
    });

    // Handle resize -> send to PTY
    const onResizeDispose = term.onResize(({ rows, cols }) => {
      if (terminalId) {
        commands.resizeTerminal(terminalId, rows, cols).catch(console.error);
      }
    });

    // Create backend PTY and wire up events
    const init = async () => {
      try {
        const id = await commands.createTerminal(workspaceId);
        if (disposed) {
          commands.closeTerminal(id).catch(() => {});
          return;
        }
        terminalId = id;

        // Send initial size to backend
        commands
          .resizeTerminal(id, term.rows, term.cols)
          .catch(console.error);

        // Listen for PTY output -> write to xterm
        const unlisten = await events.onTerminalData((payload) => {
          if (disposed) return;
          if (payload.terminal_id === id) {
            term.write(payload.data);
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
          term.write(`\r\n\x1b[31mFailed to create terminal: ${e}\x1b[0m\r\n`);
        }
      }
    };

    init();

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      if (!disposed && fitRef.current) {
        fitRef.current.fit();
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      onDataDispose.dispose();
      onResizeDispose.dispose();
      unlistenFn?.();
      if (terminalId) {
        commands.closeTerminal(terminalId).catch(() => {});
      }
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, [workspaceId]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: "#1e1e22" }}
    />
  );
}

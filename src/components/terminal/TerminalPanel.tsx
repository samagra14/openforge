import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { commands, events } from "../../lib/tauri";
import { useTheme } from "../../hooks/useTheme";

interface Props {
  workspaceId: string;
}

const DARK_THEME = {
  background: "#0c0c0d",
  foreground: "#e8e6e1",
  cursor: "#c4b398",
  cursorAccent: "#0c0c0d",
  selectionBackground: "rgba(196, 179, 152, 0.2)",
  black: "#0c0c0d",
  red: "#c47a73",
  green: "#7da383",
  yellow: "#c4b398",
  blue: "#8a9bb3",
  magenta: "#a68bb3",
  cyan: "#7da3a3",
  white: "#e8e6e1",
  brightBlack: "#54524e",
  brightRed: "#d48a83",
  brightGreen: "#8db393",
  brightYellow: "#d4c3a8",
  brightBlue: "#9aabC3",
  brightMagenta: "#b69bc3",
  brightCyan: "#8db3b3",
  brightWhite: "#f5f3ee",
};

const LIGHT_THEME = {
  background: "#f4f3ef",
  foreground: "#1a1916",
  cursor: "#9c8b6e",
  cursorAccent: "#f4f3ef",
  selectionBackground: "rgba(156, 139, 110, 0.2)",
  black: "#1a1916",
  red: "#b8645e",
  green: "#5f8a66",
  yellow: "#9c8b6e",
  blue: "#5a7a8f",
  magenta: "#8a6b8f",
  cyan: "#5a8a8a",
  white: "#f4f3ef",
  brightBlack: "#a09d97",
  brightRed: "#c8746e",
  brightGreen: "#6f9a76",
  brightYellow: "#ac9b7e",
  brightBlue: "#6a8a9f",
  brightMagenta: "#9a7b9f",
  brightCyan: "#6a9a9a",
  brightWhite: "#faf9f6",
};

export function TerminalPanel({ workspaceId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    if (!containerRef.current || !workspaceId) return;

    let disposed = false;
    let terminalId: string | null = null;
    let unlistenFn: (() => void) | null = null;

    const termTheme = theme === "dark" ? DARK_THEME : LIGHT_THEME;

    const term = new Terminal({
      theme: termTheme,
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

    requestAnimationFrame(() => {
      if (!disposed) {
        fitAddon.fit();
      }
    });

    const onDataDispose = term.onData((data) => {
      if (terminalId) {
        commands.writeTerminal(terminalId, data).catch(console.error);
      }
    });

    const onResizeDispose = term.onResize(({ rows, cols }) => {
      if (terminalId) {
        commands.resizeTerminal(terminalId, rows, cols).catch(console.error);
      }
    });

    const init = async () => {
      try {
        const id = await commands.createTerminal(workspaceId);
        if (disposed) {
          commands.closeTerminal(id).catch(() => {});
          return;
        }
        terminalId = id;

        commands
          .resizeTerminal(id, term.rows, term.cols)
          .catch(console.error);

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
  }, [workspaceId, theme]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ background: theme === "dark" ? "#0c0c0d" : "#f4f3ef" }}
    />
  );
}

import { useEffect, useRef } from "react";
import { registerShortcut, type ShortcutKeys } from "../lib/shortcuts";

/**
 * React hook to register a keyboard shortcut with automatic cleanup.
 * The handler is stored in a ref to avoid re-registration on every render.
 */
export function useShortcut(
  id: string,
  keys: ShortcutKeys,
  handler: () => void,
  options?: {
    label?: string;
    enabled?: () => boolean;
  }
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const enabledRef = useRef(options?.enabled);
  enabledRef.current = options?.enabled;

  useEffect(() => {
    const unregister = registerShortcut({
      id,
      label: options?.label ?? id,
      keys,
      handler: () => handlerRef.current(),
      enabled: enabledRef.current ? () => enabledRef.current!() : undefined,
    });
    return unregister;
    // Re-register only when the shortcut identity changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, keys.key, keys.meta, keys.shift, keys.alt]);
}

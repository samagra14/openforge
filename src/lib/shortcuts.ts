/**
 * Keyboard shortcut registry module.
 *
 * Plain TypeScript module (not a store or context) — shortcuts are side-effects
 * that don't need to trigger React re-renders. The single global keydown listener
 * dispatches to registered handlers.
 */

export interface ShortcutKeys {
  key: string; // e.g. "k", "p", "f", "1"
  meta?: boolean; // Cmd on macOS
  shift?: boolean;
  alt?: boolean;
}

export interface Shortcut {
  id: string;
  label: string;
  keys: ShortcutKeys;
  handler: () => void;
  /** When provided, shortcut only fires if this returns true */
  enabled?: () => boolean;
}

const registry = new Map<string, Shortcut>();

/** Build a normalized lookup key from modifier flags + key */
function buildKey(keys: ShortcutKeys): string {
  const parts: string[] = [];
  if (keys.meta) parts.push("meta");
  if (keys.shift) parts.push("shift");
  if (keys.alt) parts.push("alt");
  parts.push(keys.key.toLowerCase());
  return parts.join("+");
}

/** Build a lookup key from a keyboard event */
function eventKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("meta");
  if (e.shiftKey) parts.push("shift");
  if (e.altKey) parts.push("alt");
  parts.push(e.key.toLowerCase());
  return parts.join("+");
}

/**
 * Register a keyboard shortcut. Returns an unregister function.
 */
export function registerShortcut(shortcut: Shortcut): () => void {
  registry.set(shortcut.id, shortcut);
  return () => {
    registry.delete(shortcut.id);
  };
}

/**
 * Get all currently registered shortcuts (for command palette listing).
 */
export function getRegisteredShortcuts(): Shortcut[] {
  return Array.from(registry.values());
}

/**
 * Format shortcut keys for display, e.g. "⌘K", "⌘⇧F"
 */
export function formatShortcut(keys: ShortcutKeys): string {
  const parts: string[] = [];
  if (keys.meta) parts.push("⌘");
  if (keys.shift) parts.push("⇧");
  if (keys.alt) parts.push("⌥");
  parts.push(keys.key.toUpperCase());
  return parts.join("");
}

// --- Global keydown listener ---

function handleKeyDown(e: KeyboardEvent) {
  const ek = eventKey(e);

  // Find all shortcuts matching this key combo
  for (const shortcut of registry.values()) {
    const sk = buildKey(shortcut.keys);
    if (sk === ek) {
      // Check enabled guard
      if (shortcut.enabled && !shortcut.enabled()) continue;

      e.preventDefault();
      shortcut.handler();
      return; // First match wins
    }
  }
}

// Attach the single global listener on module load
if (typeof window !== "undefined") {
  window.addEventListener("keydown", handleKeyDown);
}

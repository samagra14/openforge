import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Custom CodeMirror theme matching OpenForge's luxury monochrome palette.
 * Uses CSS variables so it adapts to light/dark mode automatically.
 */
export const forgeEditorTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: '"SF Mono", "Menlo", "Consolas", monospace',
    lineHeight: "1.65",
  },
  ".cm-content": {
    padding: "12px 0",
    caretColor: "var(--accent)",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--accent)",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--accent-subtle) !important",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--hover)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-tertiary)",
    border: "none",
    borderRight: "1px solid var(--border)",
    paddingRight: "4px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--hover)",
    color: "var(--text-secondary)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 16px",
    minWidth: "3em",
    fontSize: "12px",
  },
  ".cm-foldGutter": {
    width: "14px",
  },
  // Merge/diff view styles
  ".cm-mergeView": {
    height: "100%",
  },
  ".cm-mergeViewEditors": {
    height: "100%",
  },
  ".cm-mergeViewEditor": {
    height: "100%",
  },
  ".cm-merge-a .cm-changedLine, .cm-deletedChunk": {
    backgroundColor: "rgba(196, 122, 115, 0.15) !important",
  },
  ".cm-merge-b .cm-changedLine": {
    backgroundColor: "rgba(125, 163, 131, 0.15) !important",
  },
  ".cm-deletedChunk": {
    backgroundColor: "rgba(196, 122, 115, 0.12) !important",
    borderLeft: "2px solid rgba(196, 122, 115, 0.5)",
  },
  ".cm-changedLine": {
    backgroundColor: "rgba(196, 179, 152, 0.1) !important",
  },
  // Diff gap/separator between panels
  ".cm-mergeViewGap": {
    backgroundColor: "var(--bg-secondary)",
    borderLeft: "1px solid var(--border)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    boxShadow: "var(--shadow-md)",
  },
  ".cm-panels": {
    backgroundColor: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--accent-subtle)",
    outline: "1px solid var(--accent-dim)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "var(--accent-subtle)",
    outline: "1.5px solid var(--accent)",
  },
});

/**
 * Light theme — warm, muted syntax highlighting.
 * Earthy tones, warm greys, champagne accents on light backgrounds.
 */
const forgeSyntaxLight = syntaxHighlighting(
  HighlightStyle.define(
    [
      // Comments — soft, receding
      { tag: tags.comment, color: "#a8a49c", fontStyle: "italic" },
      { tag: tags.lineComment, color: "#a8a49c", fontStyle: "italic" },
      { tag: tags.blockComment, color: "#a8a49c", fontStyle: "italic" },

      // Keywords & control flow — rich warm brown
      { tag: tags.keyword, color: "#8b6834", fontWeight: "500" },
      { tag: tags.controlKeyword, color: "#8b6834", fontWeight: "600" },
      { tag: tags.moduleKeyword, color: "#8b6834", fontWeight: "500" },
      { tag: tags.operatorKeyword, color: "#8b6834", fontWeight: "500" },

      // Functions — deep forest green
      { tag: tags.definition(tags.variableName), color: "#3d7a5f" },
      { tag: tags.definition(tags.propertyName), color: "#3d7a5f" },
      { tag: tags.function(tags.variableName), color: "#3d7a5f" },
      { tag: tags.function(tags.definition(tags.variableName)), color: "#3d7a5f" },

      // Variables & properties
      { tag: tags.variableName, color: "#2d2a26" },
      { tag: tags.propertyName, color: "#5c564d" },

      // Types & classes — warm copper
      { tag: tags.typeName, color: "#a67936" },
      { tag: tags.className, color: "#a67936" },
      { tag: tags.namespace, color: "#a67936" },
      { tag: tags.macroName, color: "#a67936" },

      // Strings — rich terracotta
      { tag: tags.string, color: "#b05a3a" },
      { tag: tags.special(tags.string), color: "#b05a3a" },
      { tag: tags.character, color: "#b05a3a" },

      // Numbers & booleans — slate blue
      { tag: tags.number, color: "#5a7b96" },
      { tag: tags.integer, color: "#5a7b96" },
      { tag: tags.float, color: "#5a7b96" },
      { tag: tags.bool, color: "#5a7b96" },

      // Operators & punctuation
      { tag: tags.operator, color: "#7a756c" },
      { tag: tags.punctuation, color: "#9a958d" },
      { tag: tags.bracket, color: "#7a756c" },
      { tag: tags.separator, color: "#9a958d" },

      // Tags (HTML/JSX)
      { tag: tags.tagName, color: "#8b6834", fontWeight: "500" },
      { tag: tags.attributeName, color: "#3d7a5f" },
      { tag: tags.attributeValue, color: "#b05a3a" },

      // Regex
      { tag: tags.regexp, color: "#b05a3a" },

      // Meta, annotations
      { tag: tags.meta, color: "#a67936" },
      { tag: tags.annotation, color: "#a67936" },

      // Headings (markdown)
      { tag: tags.heading, color: "#2d2a26", fontWeight: "600" },
      { tag: tags.heading1, color: "#2d2a26", fontWeight: "700", fontSize: "1.15em" },
      { tag: tags.heading2, color: "#2d2a26", fontWeight: "600", fontSize: "1.08em" },

      // Links
      { tag: tags.link, color: "#8b6834", textDecoration: "underline" },
      { tag: tags.url, color: "#8b6834" },

      // Strong/emphasis
      { tag: tags.strong, fontWeight: "600" },
      { tag: tags.emphasis, fontStyle: "italic" },

      // Invalid
      { tag: tags.invalid, color: "#c44d3d", textDecoration: "underline wavy" },
    ],
    { themeType: "light" }
  )
);

/**
 * Dark theme — luminous, warm syntax highlighting on dark backgrounds.
 * Champagne golds, warm greens, soft corals — luxury after dark.
 */
const forgeSyntaxDark = syntaxHighlighting(
  HighlightStyle.define(
    [
      // Comments — muted, receding
      { tag: tags.comment, color: "#6a6862", fontStyle: "italic" },
      { tag: tags.lineComment, color: "#6a6862", fontStyle: "italic" },
      { tag: tags.blockComment, color: "#6a6862", fontStyle: "italic" },

      // Keywords & control flow — warm champagne gold
      { tag: tags.keyword, color: "#d4a96a", fontWeight: "500" },
      { tag: tags.controlKeyword, color: "#d4a96a", fontWeight: "600" },
      { tag: tags.moduleKeyword, color: "#d4a96a", fontWeight: "500" },
      { tag: tags.operatorKeyword, color: "#d4a96a", fontWeight: "500" },

      // Functions — sage green
      { tag: tags.definition(tags.variableName), color: "#7db88a" },
      { tag: tags.definition(tags.propertyName), color: "#7db88a" },
      { tag: tags.function(tags.variableName), color: "#7db88a" },
      { tag: tags.function(tags.definition(tags.variableName)), color: "#7db88a" },

      // Variables & properties — warm cream / warm grey
      { tag: tags.variableName, color: "#d5d2cc" },
      { tag: tags.propertyName, color: "#b0ada6" },

      // Types & classes — soft amber
      { tag: tags.typeName, color: "#e0b06e" },
      { tag: tags.className, color: "#e0b06e" },
      { tag: tags.namespace, color: "#e0b06e" },
      { tag: tags.macroName, color: "#e0b06e" },

      // Strings — warm coral
      { tag: tags.string, color: "#d98c7b" },
      { tag: tags.special(tags.string), color: "#d98c7b" },
      { tag: tags.character, color: "#d98c7b" },

      // Numbers & booleans — muted periwinkle
      { tag: tags.number, color: "#8ab4d0" },
      { tag: tags.integer, color: "#8ab4d0" },
      { tag: tags.float, color: "#8ab4d0" },
      { tag: tags.bool, color: "#8ab4d0" },

      // Operators & punctuation — warm grey
      { tag: tags.operator, color: "#908c85" },
      { tag: tags.punctuation, color: "#706d68" },
      { tag: tags.bracket, color: "#908c85" },
      { tag: tags.separator, color: "#706d68" },

      // Tags (HTML/JSX)
      { tag: tags.tagName, color: "#d4a96a", fontWeight: "500" },
      { tag: tags.attributeName, color: "#7db88a" },
      { tag: tags.attributeValue, color: "#d98c7b" },

      // Regex
      { tag: tags.regexp, color: "#d98c7b" },

      // Meta, annotations
      { tag: tags.meta, color: "#e0b06e" },
      { tag: tags.annotation, color: "#e0b06e" },

      // Headings (markdown)
      { tag: tags.heading, color: "#e8e6e1", fontWeight: "600" },
      { tag: tags.heading1, color: "#e8e6e1", fontWeight: "700", fontSize: "1.15em" },
      { tag: tags.heading2, color: "#e8e6e1", fontWeight: "600", fontSize: "1.08em" },

      // Links
      { tag: tags.link, color: "#d4a96a", textDecoration: "underline" },
      { tag: tags.url, color: "#d4a96a" },

      // Strong/emphasis
      { tag: tags.strong, fontWeight: "600" },
      { tag: tags.emphasis, fontStyle: "italic" },

      // Invalid
      { tag: tags.invalid, color: "#e06b5f", textDecoration: "underline wavy" },
    ],
    { themeType: "dark" }
  )
);

export function isDarkMode(): boolean {
  return document.documentElement.classList.contains("dark");
}

/** Combined theme + syntax highlighting — includes both light and dark */
export const forgeTheme = [forgeEditorTheme, forgeSyntaxLight, forgeSyntaxDark];

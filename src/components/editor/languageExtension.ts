import type { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";

// Modern tree-sitter based languages
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { php } from "@codemirror/lang-php";
import { xml } from "@codemirror/lang-xml";
import { sql } from "@codemirror/lang-sql";
import { go } from "@codemirror/lang-go";
import { sass } from "@codemirror/lang-sass";
import { less } from "@codemirror/lang-less";

// Legacy stream-parser languages
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { toml } from "@codemirror/legacy-modes/mode/toml";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { swift } from "@codemirror/legacy-modes/mode/swift";
import { perl } from "@codemirror/legacy-modes/mode/perl";
import { lua } from "@codemirror/legacy-modes/mode/lua";
import { haskell } from "@codemirror/legacy-modes/mode/haskell";
import { clojure } from "@codemirror/legacy-modes/mode/clojure";
import { erlang } from "@codemirror/legacy-modes/mode/erlang";
import { groovy } from "@codemirror/legacy-modes/mode/groovy";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { r } from "@codemirror/legacy-modes/mode/r";
import { protobuf } from "@codemirror/legacy-modes/mode/protobuf";
import { nginx } from "@codemirror/legacy-modes/mode/nginx";
import { diff } from "@codemirror/legacy-modes/mode/diff";
import { properties } from "@codemirror/legacy-modes/mode/properties";
import { julia } from "@codemirror/legacy-modes/mode/julia";
import { elm } from "@codemirror/legacy-modes/mode/elm";
import { coffeeScript } from "@codemirror/legacy-modes/mode/coffeescript";

type LangFactory = () => Extension;

const extensionMap: Record<string, LangFactory> = {
  // JavaScript / TypeScript
  ".ts": () => javascript({ typescript: true }),
  ".tsx": () => javascript({ typescript: true, jsx: true }),
  ".js": () => javascript(),
  ".jsx": () => javascript({ jsx: true }),
  ".mjs": () => javascript(),
  ".cjs": () => javascript(),

  // Web
  ".html": () => html(),
  ".htm": () => html(),
  ".vue": () => html(),
  ".svelte": () => html(),
  ".css": () => css(),
  ".scss": () => sass(),
  ".sass": () => sass({ indented: true }),
  ".less": () => less(),
  ".xml": () => xml(),
  ".svg": () => xml(),
  ".xsl": () => xml(),

  // Data formats
  ".json": () => json(),
  ".jsonc": () => json(),
  ".json5": () => json(),
  ".yaml": () => yaml(),
  ".yml": () => yaml(),
  ".toml": () => StreamLanguage.define(toml),
  ".ini": () => StreamLanguage.define(properties),
  ".env": () => StreamLanguage.define(properties),
  ".properties": () => StreamLanguage.define(properties),

  // Systems languages
  ".py": () => python(),
  ".pyw": () => python(),
  ".rs": () => rust(),
  ".go": () => go(),
  ".c": () => cpp(),
  ".h": () => cpp(),
  ".cpp": () => cpp(),
  ".cc": () => cpp(),
  ".cxx": () => cpp(),
  ".hpp": () => cpp(),
  ".hxx": () => cpp(),
  ".java": () => java(),
  ".kt": () => java(), // Kotlin is close enough
  ".swift": () => StreamLanguage.define(swift),

  // Scripting
  ".rb": () => StreamLanguage.define(ruby),
  ".erb": () => StreamLanguage.define(ruby),
  ".gemspec": () => StreamLanguage.define(ruby),
  ".php": () => php(),
  ".pl": () => StreamLanguage.define(perl),
  ".pm": () => StreamLanguage.define(perl),
  ".lua": () => StreamLanguage.define(lua),
  ".r": () => StreamLanguage.define(r),
  ".R": () => StreamLanguage.define(r),
  ".jl": () => StreamLanguage.define(julia),
  ".coffee": () => StreamLanguage.define(coffeeScript),

  // Shell
  ".sh": () => StreamLanguage.define(shell),
  ".bash": () => StreamLanguage.define(shell),
  ".zsh": () => StreamLanguage.define(shell),
  ".fish": () => StreamLanguage.define(shell),
  ".ps1": () => StreamLanguage.define(powerShell),
  ".psm1": () => StreamLanguage.define(powerShell),

  // Functional
  ".hs": () => StreamLanguage.define(haskell),
  ".lhs": () => StreamLanguage.define(haskell),
  ".clj": () => StreamLanguage.define(clojure),
  ".cljs": () => StreamLanguage.define(clojure),
  ".cljc": () => StreamLanguage.define(clojure),
  ".erl": () => StreamLanguage.define(erlang),
  ".elm": () => StreamLanguage.define(elm),

  // JVM
  ".groovy": () => StreamLanguage.define(groovy),
  ".gradle": () => StreamLanguage.define(groovy),

  // Database
  ".sql": () => sql(),

  // Docs
  ".md": () => markdown(),
  ".mdx": () => markdown(),

  // DevOps / Config
  ".proto": () => StreamLanguage.define(protobuf),
  ".diff": () => StreamLanguage.define(diff),
  ".patch": () => StreamLanguage.define(diff),
  ".nginx": () => StreamLanguage.define(nginx),
  ".conf": () => StreamLanguage.define(nginx),
};

// Files matched by exact name (no extension)
const filenameMap: Record<string, LangFactory> = {
  "Dockerfile": () => StreamLanguage.define(dockerFile),
  "Makefile": () => StreamLanguage.define(shell),
  "Gemfile": () => StreamLanguage.define(ruby),
  "Rakefile": () => StreamLanguage.define(ruby),
  "Vagrantfile": () => StreamLanguage.define(ruby),
  ".gitignore": () => StreamLanguage.define(properties),
  ".dockerignore": () => StreamLanguage.define(properties),
  ".editorconfig": () => StreamLanguage.define(properties),
  ".bashrc": () => StreamLanguage.define(shell),
  ".zshrc": () => StreamLanguage.define(shell),
  ".bash_profile": () => StreamLanguage.define(shell),
  ".profile": () => StreamLanguage.define(shell),
};

// Shebang patterns for extensionless files
const shebangMap: [RegExp, LangFactory][] = [
  [/^#!.*\b(bash|sh|zsh)\b/, () => StreamLanguage.define(shell)],
  [/^#!.*\bpython/, () => python()],
  [/^#!.*\bruby\b/, () => StreamLanguage.define(ruby)],
  [/^#!.*\bperl\b/, () => StreamLanguage.define(perl)],
  [/^#!.*\bnode\b/, () => javascript()],
  [/^#!.*\blua\b/, () => StreamLanguage.define(lua)],
];

export function getLanguageExtension(filePath: string, content?: string): Extension | null {
  // Check exact filename first
  const filename = filePath.split("/").pop() ?? filePath;
  const nameFactory = filenameMap[filename];
  if (nameFactory) return nameFactory();

  // Then check extension
  const lastDot = filename.lastIndexOf(".");
  if (lastDot >= 0) {
    const ext = filename.slice(lastDot).toLowerCase();
    const extFactory = extensionMap[ext];
    if (extFactory) return extFactory();
  }

  // Fall back to shebang detection for extensionless files
  if (content) {
    const firstLine = content.slice(0, content.indexOf("\n")).trim();
    for (const [re, factory] of shebangMap) {
      if (re.test(firstLine)) return factory();
    }
  }

  return null;
}

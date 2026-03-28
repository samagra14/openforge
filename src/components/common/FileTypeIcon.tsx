import type { CSSProperties } from "react";
import {
  SiTypescript,
  SiJavascript,
  SiReact,
  SiRust,
  SiPython,
  SiCss,
  SiHtml5,
  SiGit,
  SiDocker,
  SiNpm,
  SiYaml,
  SiToml,
  SiSwift,
  SiGo,
  SiSvg,
} from "react-icons/si";
import {
  VscJson,
  VscMarkdown,
  VscTerminalBash,
  VscLock,
  VscSettingsGear,
  VscFile,
  VscFileMedia,
  VscDatabase,
  VscLaw,
} from "react-icons/vsc";

interface FileTypeIconProps {
  filename: string;
  size?: number;
  style?: CSSProperties;
  className?: string;
}

interface IconDef {
  icon: React.ComponentType<{ size?: number; style?: CSSProperties; className?: string }>;
  color: string;
}

/** Map exact filenames to icons */
const filenameMap: Record<string, IconDef> = {
  ".gitignore": { icon: SiGit, color: "#e84d31" },
  ".gitkeep": { icon: SiGit, color: "#e84d31" },
  ".gitattributes": { icon: SiGit, color: "#e84d31" },
  ".gitmodules": { icon: SiGit, color: "#e84d31" },
  "dockerfile": { icon: SiDocker, color: "#2496ed" },
  "docker-compose.yml": { icon: SiDocker, color: "#2496ed" },
  "docker-compose.yaml": { icon: SiDocker, color: "#2496ed" },
  "package.json": { icon: SiNpm, color: "#cb3837" },
  "package-lock.json": { icon: SiNpm, color: "#cb3837" },
  "cargo.toml": { icon: SiRust, color: "#ce422b" },
  "cargo.lock": { icon: SiRust, color: "#ce422b" },
  "tsconfig.json": { icon: SiTypescript, color: "#3178c6" },
  "license": { icon: VscLaw, color: "#d4aa00" },
  "license.md": { icon: VscLaw, color: "#d4aa00" },
  "license.txt": { icon: VscLaw, color: "#d4aa00" },
};

/** Map file extensions to icons */
const extensionMap: Record<string, IconDef> = {
  // TypeScript / JavaScript
  ts: { icon: SiTypescript, color: "#3178c6" },
  tsx: { icon: SiReact, color: "#61dafb" },
  js: { icon: SiJavascript, color: "#f7df1e" },
  jsx: { icon: SiReact, color: "#61dafb" },
  mjs: { icon: SiJavascript, color: "#f7df1e" },
  cjs: { icon: SiJavascript, color: "#f7df1e" },

  // Rust
  rs: { icon: SiRust, color: "#ce422b" },

  // Python
  py: { icon: SiPython, color: "#3776ab" },
  pyi: { icon: SiPython, color: "#3776ab" },
  pyx: { icon: SiPython, color: "#3776ab" },

  // Web
  css: { icon: SiCss, color: "#1572b6" },
  scss: { icon: SiCss, color: "#cd6799" },
  sass: { icon: SiCss, color: "#cd6799" },
  less: { icon: SiCss, color: "#1d365d" },
  html: { icon: SiHtml5, color: "#e34f26" },
  htm: { icon: SiHtml5, color: "#e34f26" },
  svg: { icon: SiSvg, color: "#ffb13b" },

  // Data / Config
  json: { icon: VscJson, color: "#cbcb41" },
  jsonc: { icon: VscJson, color: "#cbcb41" },
  yaml: { icon: SiYaml, color: "#cb171e" },
  yml: { icon: SiYaml, color: "#cb171e" },
  toml: { icon: SiToml, color: "#9c4121" },
  xml: { icon: VscFile, color: "#e37933" },
  csv: { icon: VscFile, color: "#89b854" },

  // Markdown / Text
  md: { icon: VscMarkdown, color: "#519aba" },
  mdx: { icon: VscMarkdown, color: "#519aba" },
  txt: { icon: VscFile, color: "#89898a" },

  // Shell
  sh: { icon: VscTerminalBash, color: "#89e051" },
  bash: { icon: VscTerminalBash, color: "#89e051" },
  zsh: { icon: VscTerminalBash, color: "#89e051" },
  fish: { icon: VscTerminalBash, color: "#89e051" },

  // Other languages
  swift: { icon: SiSwift, color: "#f05138" },
  go: { icon: SiGo, color: "#00add8" },
  sql: { icon: VscDatabase, color: "#dad8d8" },

  // Images
  png: { icon: VscFileMedia, color: "#a074c4" },
  jpg: { icon: VscFileMedia, color: "#a074c4" },
  jpeg: { icon: VscFileMedia, color: "#a074c4" },
  gif: { icon: VscFileMedia, color: "#a074c4" },
  webp: { icon: VscFileMedia, color: "#a074c4" },
  ico: { icon: VscFileMedia, color: "#a074c4" },
  icns: { icon: VscFileMedia, color: "#a074c4" },

  // Lock files
  lock: { icon: VscLock, color: "#89898a" },

  // Config
  env: { icon: VscSettingsGear, color: "#ecd53f" },
  ini: { icon: VscSettingsGear, color: "#89898a" },
  conf: { icon: VscSettingsGear, color: "#89898a" },
  config: { icon: VscSettingsGear, color: "#89898a" },
};

function getIconDef(filename: string): IconDef {
  const lower = filename.toLowerCase();

  // Check exact filename match first
  const byName = filenameMap[lower];
  if (byName) return byName;

  // Check extension
  const dotIndex = lower.lastIndexOf(".");
  if (dotIndex !== -1) {
    const ext = lower.slice(dotIndex + 1);
    const byExt = extensionMap[ext];
    if (byExt) return byExt;
  }

  // Default
  return { icon: VscFile, color: "var(--text-tertiary)" };
}

export function FileTypeIcon({ filename, size = 14, style, className }: FileTypeIconProps) {
  const { icon: Icon, color } = getIconDef(filename);
  return <Icon size={size} style={{ color, flexShrink: 0, ...style }} className={className} />;
}

/** Get just the color for a given filename (useful for status-overlay scenarios) */
export function getFileTypeColor(filename: string): string {
  return getIconDef(filename).color;
}

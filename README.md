<div align="center">

# OpenForge

**Orchestrate parallel Claude Code agents in isolated git worktrees.**

A native macOS app for running multiple AI coding agents simultaneously — each in its own branch, its own directory, its own context.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)](https://github.com/anthropics/openforge/releases)
[![Tauri 2](https://img.shields.io/badge/Tauri-2.x-FFC131?logo=tauri&logoColor=white)](https://v2.tauri.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-2021-DEA584?logo=rust&logoColor=white)](https://www.rust-lang.org)

<br />

<!-- Replace with an actual screenshot when available -->
<img src="docs/screenshot-placeholder.png" alt="OpenForge Screenshot" width="800" />

<br />

[Download](https://github.com/anthropics/openforge/releases) · [Documentation](https://anthropics.github.io/openforge) · [Report Bug](https://github.com/anthropics/openforge/issues) · [Request Feature](https://github.com/anthropics/openforge/issues)

</div>

<br />

## The Problem

Working with AI coding agents one task at a time is slow. You describe a feature, wait for it, review it, describe the next one, wait again. Meanwhile, your codebase has ten things that need attention.

## The Solution

OpenForge lets you run as many Claude Code agents as you want, **in parallel**, each in its own [git worktree](https://git-scm.com/docs/git-worktree). One agent fixes a bug while another adds a feature while a third writes tests — all at the same time, all in isolated branches, all visible in a single window.

<br />

---

<br />

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Tech Stack](#tech-stack)
- [Configuration](#configuration)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [CI/CD](#cicd)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

<br />

## Features

<table>
<tr>
<td width="50%" valign="top">

### Parallel Workspaces

Spin up multiple agents working on different tasks simultaneously. Each workspace gets its own git worktree and branch — agents never step on each other.

</td>
<td width="50%" valign="top">

### Real-time Streaming Chat

Claude Code responses stream in real time — thinking blocks, markdown, and every tool call (Read, Write, Edit, Bash, Grep, Glob) rendered live at 60fps.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Git Checkpoints

Every message creates a git checkpoint. One-click revert rolls the entire worktree back to any previous state. Experiment fearlessly.

</td>
<td width="50%" valign="top">

### Integrated Diff Viewer

See every file changed vs. the base branch with color-coded unified diffs. Review agent work without leaving the app.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Built-in Terminal

A full PTY-backed terminal runs in each worktree directory. Run commands, inspect output, debug — all inside OpenForge.

</td>
<td width="50%" valign="top">

### File Explorer

Browse the complete worktree file tree with syntax-highlighted preview for JavaScript, TypeScript, Python, Rust, JSON, HTML, CSS, and Markdown.

</td>
</tr>
</table>

<br />

## Quick Start

### Prerequisites

| Requirement | Version | Install |
|:------------|:--------|:--------|
| macOS | Apple Silicon or Intel | — |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Rust | Stable | [rustup.rs](https://rustup.rs) |
| Git | 2.20+ | `xcode-select --install` |
| Claude Code | Latest | `npm install -g @anthropic-ai/claude-code` |

### Install & Run

```bash
# Clone the repository
git clone https://github.com/anthropics/openforge.git
cd openforge

# Install frontend dependencies
npm install

# Start the app in development mode
npm run tauri dev
```

### Build for Production

```bash
npm run tauri build
```

The DMG will be at `src-tauri/target/release/bundle/dmg/`.

<br />

## How It Works

```
  Add a repo          Create a workspace        Chat with Claude         Review & ship
 ┌───────────┐       ┌──────────────────┐       ┌──────────────────┐    ┌──────────────┐
 │ Select any │──────▶│ Auto-creates git │──────▶│ Agents run in    │───▶│ Diff viewer  │
 │ local git  │       │ worktree + branch│       │ isolated worktree│    │ File explorer│
 │ repository │       │ Named after a    │       │ Stream responses │    │ Terminal     │
 │            │       │ random city      │       │ in real time     │    │ Checkpoints  │
 └───────────┘       └──────────────────┘       └──────────────────┘    └──────────────┘
```

### 1. Add a Repo

Select any local git repository using the native macOS file picker. OpenForge validates it, reads the remote name and default branch, and stores it locally.

### 2. Create a Workspace

Press **Cmd+N** and pick a repo. OpenForge:

1. Generates a random city name (e.g., `montevideo`, `rio-de-janeiro`) from a built-in list of 200+ world cities
2. Creates a git worktree at `~/openforge/workspaces/<repo>/<city>/`
3. Branches off the default branch as `agent/<task-slug>`
4. Runs the repo's setup script if one is configured (e.g., `npm install`)
5. Records the workspace in the local database

### 3. Chat with Claude

Type a prompt and send. OpenForge spawns the Claude CLI:

```bash
claude -p --output-format stream-json --model <model> "<prompt>"
```

The NDJSON stream is parsed line-by-line with `requestAnimationFrame` batching for smooth rendering. Follow-up messages use `--resume --session-id <id>` to maintain full conversation context. Each workspace supports multiple chat sessions as tabs.

### 4. Review Changes

The right panel gives you three views:

| Tab | What it shows |
|:----|:--------------|
| **Changes** | Files modified vs. base branch with unified diffs |
| **All Files** | Complete worktree file tree with syntax-highlighted preview |
| **Terminal** | PTY shell running in the worktree directory |

### 5. Checkpoint & Revert

Before each user message, OpenForge creates a git ref at `refs/openforge-checkpoints/<message_id>`. Click the **Revert** button on any user message to roll the worktree back to that exact state — all subsequent changes and messages are removed.

<br />

## Architecture

OpenForge follows a three-layer architecture:

```
┌──────────────────────────────────────────────────────────────────┐
│                        React Frontend                            │
│                                                                  │
│   React 19 · TypeScript · Zustand · Tailwind CSS                 │
│   xterm.js · CodeMirror 6 · Lucide React · react-markdown        │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                       Tauri IPC Bridge                            │
│                                                                  │
│   Commands ───── frontend → backend (invoke)                      │
│   Events   ───── backend → frontend (streaming)                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                        Rust Backend                               │
│                                                                  │
│   Agent process mgmt · PTY terminals · Git worktree lifecycle     │
│   SQLite persistence · Checkpoint system · Script execution       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

<details>
<summary><strong>Frontend modules</strong></summary>

| Directory | Purpose |
|:----------|:--------|
| `components/chat/` | Chat UI — message rendering, tool call visualization, status bar |
| `components/layout/` | Three-panel IDE layout — sidebar, main panel, right panel |
| `components/workspace/` | Repo list, workspace list, new workspace modal |
| `components/files/` | File tree browser and diff viewer |
| `components/terminal/` | xterm.js terminal connected to PTY via Tauri events |
| `stores/` | Zustand stores — workspace state, session/message state, UI state |
| `hooks/` | Custom hooks — agent event listener (rAF batching), terminal lifecycle, theme toggle |
| `lib/` | Tauri IPC command/event wrappers, city name list, repo utilities |

</details>

<details>
<summary><strong>Backend modules</strong></summary>

| Module | Purpose |
|:-------|:--------|
| `agent/manager.rs` | Spawn `claude` CLI processes, manage agent lifecycle, stream output |
| `agent/parser.rs` | Parse NDJSON stream events from Claude's stdout |
| `agent/types.rs` | Type definitions for stream events and assistant messages |
| `terminal/pty.rs` | PTY creation, resize, read/write via `portable-pty` |
| `worktree/manager.rs` | `git worktree add` / `remove`, branch management |
| `worktree/checkpoint.rs` | Create and revert git ref checkpoints |
| `worktree/diff.rs` | `git diff`, changed file listing, recursive file tree |
| `db/schema.rs` | SQLite table definitions and initialization |
| `db/queries.rs` | CRUD operations for repos, workspaces, sessions, messages |
| `script/runner.rs` | Execute user-configured setup/run/archive scripts |
| `state.rs` | Shared app state (DB connection, agent manager, terminal manager) |
| `lib.rs` | Tauri command handler registration |

</details>

<details>
<summary><strong>Database schema</strong></summary>

SQLite at `~/openforge/data/openforge.db`:

| Table | Key Columns |
|:------|:------------|
| `repos` | id, name, path, default_branch, setup_script, run_script, archive_script |
| `workspaces` | id, repo_id, city_name, worktree_path, branch_name, task_description, status |
| `sessions` | id, workspace_id, title, model, status, claude_session_id, token_count, cost_usd |
| `messages` | id, session_id, role, content, tool_calls (JSON), checkpoint_ref, duration_ms |

All tables use UUID primary keys. Indexed on foreign keys for fast lookups.

</details>

<br />

## Project Structure

```
openforge/
├── src/                        # React + TypeScript frontend
│   ├── components/
│   │   ├── chat/               #   Chat UI (messages, tool calls, input)
│   │   ├── layout/             #   Three-panel IDE layout
│   │   ├── workspace/          #   Repo & workspace management
│   │   ├── files/              #   File tree + diff viewer
│   │   └── terminal/           #   xterm.js terminal
│   ├── stores/                 #   Zustand state (workspace, session, ui)
│   ├── hooks/                  #   useAgent, useTerminal, useTheme
│   ├── lib/                    #   Tauri IPC, city names, utilities
│   ├── styles/                 #   Global CSS with light/dark themes
│   ├── App.tsx                 #   Root layout + keyboard shortcuts
│   └── main.tsx                #   Entry point
│
├── src-tauri/                  # Rust backend (Tauri 2)
│   ├── src/
│   │   ├── agent/              #   Claude CLI spawning + NDJSON parsing
│   │   ├── terminal/           #   PTY management (portable-pty)
│   │   ├── worktree/           #   Git worktrees, checkpoints, diffs
│   │   ├── db/                 #   SQLite schema + queries
│   │   ├── script/             #   Setup/run/archive script execution
│   │   ├── lib.rs              #   Tauri command definitions
│   │   ├── main.rs             #   App entry point
│   │   └── state.rs            #   Shared application state
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
│
├── docs/                       # GitHub Pages site
├── .github/workflows/          # CI: build-release + deploy-pages
├── CLAUDE.md                   # AI agent instructions
├── LICENSE                     # MIT
└── package.json
```

<br />

## Tech Stack

| Layer | Technology | Role |
|:------|:-----------|:-----|
| Desktop framework | [Tauri 2](https://v2.tauri.app) | Native macOS app shell, IPC bridge |
| Backend | [Rust](https://www.rust-lang.org) (2021 edition) | Process management, git ops, SQLite |
| Frontend | [React 19](https://react.dev) | Component-based UI |
| Language | [TypeScript 5](https://www.typescriptlang.org) | Type-safe frontend code |
| Build tool | [Vite 6](https://vite.dev) | Fast HMR, bundling |
| State | [Zustand 5](https://zustand.docs.pmnd.rs) | Lightweight state management |
| Styling | [Tailwind CSS 3](https://tailwindcss.com) | Utility-first CSS |
| Terminal | [xterm.js 5](https://xtermjs.org) | Terminal emulation in the browser |
| Code viewer | [CodeMirror 6](https://codemirror.net) | Syntax highlighting, diffs |
| Database | [SQLite](https://sqlite.org) via [rusqlite](https://github.com/rusqlite/rusqlite) | Local persistence |
| PTY | [portable-pty](https://docs.rs/portable-pty) | Cross-platform pseudo-terminal |
| Icons | [Lucide](https://lucide.dev) | Clean, consistent icon set |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm | Rich message rendering |

<br />

## Configuration

### Per-repo Scripts

Each repo supports three optional lifecycle scripts, configurable through the UI:

| Script | When it runs | Example |
|:-------|:-------------|:--------|
| **Setup** | After creating a new worktree | `npm install && npm run build` |
| **Run** | To start the project in a workspace | `npm run dev` |
| **Archive** | Before archiving a workspace | `docker compose down` |

### Data Locations

| What | Path |
|:-----|:-----|
| Database | `~/openforge/data/openforge.db` |
| Worktrees | `~/openforge/workspaces/<repo-slug>/<city>/` |
| Checkpoint refs | `refs/openforge-checkpoints/<message-id>` |

<br />

## Keyboard Shortcuts

| Shortcut | Action |
|:---------|:-------|
| <kbd>Cmd</kbd> + <kbd>N</kbd> | New workspace |
| <kbd>Cmd</kbd> + <kbd>T</kbd> | New chat tab |
| <kbd>Cmd</kbd> + <kbd>L</kbd> | Focus chat input |
| <kbd>Cmd</kbd> + <kbd>1</kbd> through <kbd>9</kbd> | Switch workspace by position |

<br />

## CI/CD

### Build & Release

Triggered by pushing a `v*` tag or manual dispatch. Builds DMGs for both architectures, then publishes them as a GitHub Release.

| Target | Architecture |
|:-------|:-------------|
| `aarch64-apple-darwin` | Apple Silicon (M1/M2/M3/M4) |
| `x86_64-apple-darwin` | Intel |

### GitHub Pages

The `docs/` directory is automatically deployed to GitHub Pages on push to `main`.

<br />

## Contributing

Contributions are welcome! Whether it's bug fixes, new features, documentation, or feedback — we appreciate it all.

### Getting Started

1. **Fork** the repository
2. **Clone** your fork and install dependencies:
   ```bash
   git clone https://github.com/<your-username>/openforge.git
   cd openforge && npm install
   ```
3. **Create a branch** for your change:
   ```bash
   git checkout -b my-feature
   ```
4. **Develop** with hot reload:
   ```bash
   npm run tauri dev
   ```
5. **Verify** your changes compile:
   ```bash
   npm run build                    # Frontend
   cd src-tauri && cargo check      # Backend
   ```
6. **Open a pull request** against `main`

### Development Tips

- `npm run tauri dev` gives you hot reload on the frontend and automatic Rust recompilation
- The Vite dev server runs on `localhost:5173`
- Inspect the SQLite database at `~/openforge/data/openforge.db` with any SQLite client
- Tauri commands are defined in `src-tauri/src/lib.rs` and invoked from `src/lib/tauri.ts`
- The frontend uses CSS custom properties for theming — see `src/styles/globals.css`

<br />

## Roadmap

We're just getting started. Here's what's planned:

- [ ] **Linux & Windows support** — Expand beyond macOS
- [ ] **Agent-to-agent communication** — Let workspaces share context
- [ ] **Workspace templates** — Preconfigured setups for common project types
- [ ] **Plugin system** — Extend OpenForge with custom tools and integrations
- [ ] **Cost tracking dashboard** — Visualize token usage and costs across sessions
- [ ] **Multi-user collaboration** — Shared workspaces for teams

Have an idea? [Open an issue](https://github.com/anthropics/openforge/issues) — we'd love to hear it.

<br />

## License

MIT License — see [LICENSE](./LICENSE) for details.

Made with Rust, React, and a lot of coffee.

<div align="center">
<br />

If you find OpenForge useful, consider giving it a star. It helps others discover the project.

<a href="https://github.com/anthropics/openforge">
  <img src="https://img.shields.io/github/stars/anthropics/openforge?style=social" alt="GitHub Stars" />
</a>

</div>

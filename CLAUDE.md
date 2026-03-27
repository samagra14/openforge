# OpenForge — CLAUDE.md

## What is this project?

OpenForge is an open-source macOS desktop application that orchestrates parallel Claude Code agents across isolated git worktrees. It is a free, open-source alternative to Conductor (conductor.build).

The tech stack is: Tauri 2.x (Rust backend) + React 19 + TypeScript + Vite (frontend). macOS only for v0.1. MIT licensed.

## Architecture overview

Three-layer architecture:
1. **Rust backend** (src-tauri/): Process management (PTY via portable-pty), git worktree lifecycle, checkpoint system, SQLite state, script execution
2. **React frontend** (src/): Three-panel IDE layout, chat UI, terminal rendering (xterm.js), file viewer/diff (CodeMirror), Zustand state management
3. **Tauri IPC bridge**: Commands (frontend calls backend) and Events (backend pushes to frontend)

## Core workflows

### 1. Repo management
- User adds a local git repo by selecting a folder
- Backend validates it's a git repo, reads name/remote/default branch
- Stored in SQLite, displayed in left sidebar with colored letter avatar

### 2. Workspace lifecycle
- **Create**: User hits ⌘N, selects a repo, optionally enters task description
  - Backend generates a random city name (from a built-in list of ~200 world cities)
  - Runs `git worktree add ~/openforge/workspaces/<repo-slug>/<city> -b agent/<task-slug> <default-branch>`
  - Runs setup script if configured for this repo
  - Creates workspace record in SQLite
- **Switch**: ⌘+1 through ⌘+9 switch to workspace by sidebar position
- **Archive**: Context menu or ⌘⇧A
- **Restore**: From archived workspaces view

### 3. Chat with Claude Code agents
- Each workspace can have multiple chat sessions (tabs in center panel)
- Spawns: `claude -p --output-format stream-json --model <model> "<prompt>"`
- Parse NDJSON from stdout line-by-line
- Multi-turn: use `--resume --session-id <id>` for follow-up messages

### 4. Diff viewer
- Right panel "Changes" tab shows files changed vs base branch
- Computed via `git diff <base-branch>..HEAD --name-status`

### 5. File tree
- Right panel "All files" tab shows worktree file structure
- Click to view file content with CodeMirror

### 6. Checkpoint system
- Before sending each user message, create a checkpoint as git refs at refs/openforge-checkpoints/<message_id>
- Revert button on user messages

### 7. Terminal panel
- Right panel "Terminal" tab provides a raw shell in the workspace directory
- Uses xterm.js connected to a PTY via Tauri IPC

## Key paths
- Workspace paths: `~/openforge/workspaces/<repo-slug>/<city>/`
- SQLite path: `~/openforge/data/openforge.db`
- Checkpoint refs: `refs/openforge-checkpoints/<message-id>`

## Build commands
```bash
npm install          # Install frontend dependencies
npm run dev          # Start Vite dev server
npm run tauri dev    # Start Tauri dev (Rust + frontend)
npm run tauri build  # Production build
```

## Git operations
- Shell out to `git` CLI (not libgit2) for reliability
- City names: lowercase-hyphenated (rio-de-janeiro)

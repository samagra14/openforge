use rusqlite::{Connection, Result};

pub fn initialize(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS repos (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL UNIQUE,
            default_branch TEXT NOT NULL DEFAULT 'main',
            setup_script TEXT,
            run_script TEXT,
            archive_script TEXT
        );

        CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            repo_id TEXT NOT NULL REFERENCES repos(id),
            city_name TEXT NOT NULL,
            worktree_path TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            task_description TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id),
            title TEXT NOT NULL DEFAULT 'New Chat',
            model TEXT NOT NULL DEFAULT 'sonnet',
            agent_provider TEXT NOT NULL DEFAULT 'claude-code',
            status TEXT NOT NULL DEFAULT 'idle',
            claude_session_id TEXT,
            token_count INTEGER NOT NULL DEFAULT 0,
            cost_usd REAL NOT NULL DEFAULT 0.0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            role TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            tool_calls TEXT,
            subagent_count INTEGER DEFAULT 0,
            duration_ms INTEGER,
            checkpoint_ref TEXT,
            timestamp TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_workspaces_repo ON workspaces(repo_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
        ",
    )?;

    // Migration: add agent_provider column to sessions if it doesn't exist
    // (for databases created before multi-agent support)
    let has_column: bool = conn
        .prepare("SELECT agent_provider FROM sessions LIMIT 0")
        .is_ok();
    if !has_column {
        conn.execute_batch(
            "ALTER TABLE sessions ADD COLUMN agent_provider TEXT NOT NULL DEFAULT 'claude-code';",
        )?;
    }

    Ok(())
}

use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Repo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub default_branch: String,
    pub setup_script: Option<String>,
    pub run_script: Option<String>,
    pub archive_script: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub repo_id: String,
    pub city_name: String,
    pub worktree_path: String,
    pub branch_name: String,
    pub task_description: Option<String>,
    pub status: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub model: String,
    pub status: String,
    pub claude_session_id: Option<String>,
    pub token_count: i64,
    pub cost_usd: f64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub tool_calls: Option<String>,
    pub subagent_count: Option<i64>,
    pub duration_ms: Option<i64>,
    pub checkpoint_ref: Option<String>,
    pub timestamp: String,
}

// --- Repo CRUD ---

pub fn insert_repo(conn: &Connection, repo: &Repo) -> Result<()> {
    conn.execute(
        "INSERT INTO repos (id, name, path, default_branch, setup_script, run_script, archive_script) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![repo.id, repo.name, repo.path, repo.default_branch, repo.setup_script, repo.run_script, repo.archive_script],
    )?;
    Ok(())
}

pub fn list_repos(conn: &Connection) -> Result<Vec<Repo>> {
    let mut stmt = conn.prepare("SELECT id, name, path, default_branch, setup_script, run_script, archive_script FROM repos")?;
    let rows = stmt.query_map([], |row| {
        Ok(Repo {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            default_branch: row.get(3)?,
            setup_script: row.get(4)?,
            run_script: row.get(5)?,
            archive_script: row.get(6)?,
        })
    })?;
    rows.collect()
}

pub fn update_repo_scripts(
    conn: &Connection,
    id: &str,
    setup: Option<&str>,
    run: Option<&str>,
    archive: Option<&str>,
) -> Result<()> {
    conn.execute(
        "UPDATE repos SET setup_script = ?1, run_script = ?2, archive_script = ?3 WHERE id = ?4",
        params![setup, run, archive, id],
    )?;
    Ok(())
}

// --- Workspace CRUD ---

pub fn insert_workspace(conn: &Connection, ws: &Workspace) -> Result<()> {
    conn.execute(
        "INSERT INTO workspaces (id, repo_id, city_name, worktree_path, branch_name, task_description, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![ws.id, ws.repo_id, ws.city_name, ws.worktree_path, ws.branch_name, ws.task_description, ws.status, ws.created_at],
    )?;
    Ok(())
}

pub fn list_workspaces(conn: &Connection, repo_id: &str) -> Result<Vec<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id, repo_id, city_name, worktree_path, branch_name, task_description, status, created_at FROM workspaces WHERE repo_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map(params![repo_id], |row| {
        Ok(Workspace {
            id: row.get(0)?,
            repo_id: row.get(1)?,
            city_name: row.get(2)?,
            worktree_path: row.get(3)?,
            branch_name: row.get(4)?,
            task_description: row.get(5)?,
            status: row.get(6)?,
            created_at: row.get(7)?,
        })
    })?;
    rows.collect()
}

pub fn update_workspace_status(conn: &Connection, id: &str, status: &str) -> Result<()> {
    conn.execute(
        "UPDATE workspaces SET status = ?1 WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

pub fn get_workspace(conn: &Connection, id: &str) -> Result<Workspace> {
    conn.query_row(
        "SELECT id, repo_id, city_name, worktree_path, branch_name, task_description, status, created_at FROM workspaces WHERE id = ?1",
        params![id],
        |row| {
            Ok(Workspace {
                id: row.get(0)?,
                repo_id: row.get(1)?,
                city_name: row.get(2)?,
                worktree_path: row.get(3)?,
                branch_name: row.get(4)?,
                task_description: row.get(5)?,
                status: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
}

pub fn get_repo(conn: &Connection, id: &str) -> Result<Repo> {
    conn.query_row(
        "SELECT id, name, path, default_branch, setup_script, run_script, archive_script FROM repos WHERE id = ?1",
        params![id],
        |row| {
            Ok(Repo {
                id: row.get(0)?,
                name: row.get(1)?,
                path: row.get(2)?,
                default_branch: row.get(3)?,
                setup_script: row.get(4)?,
                run_script: row.get(5)?,
                archive_script: row.get(6)?,
            })
        },
    )
}

// --- Session CRUD ---

pub fn insert_session(conn: &Connection, session: &Session) -> Result<()> {
    conn.execute(
        "INSERT INTO sessions (id, workspace_id, title, model, status, claude_session_id, token_count, cost_usd, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![session.id, session.workspace_id, session.title, session.model, session.status, session.claude_session_id, session.token_count, session.cost_usd, session.created_at],
    )?;
    Ok(())
}

pub fn list_sessions(conn: &Connection, workspace_id: &str) -> Result<Vec<Session>> {
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, title, model, status, claude_session_id, token_count, cost_usd, created_at FROM sessions WHERE workspace_id = ?1 ORDER BY created_at",
    )?;
    let rows = stmt.query_map(params![workspace_id], |row| {
        Ok(Session {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            title: row.get(2)?,
            model: row.get(3)?,
            status: row.get(4)?,
            claude_session_id: row.get(5)?,
            token_count: row.get(6)?,
            cost_usd: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?;
    rows.collect()
}

pub fn update_session_status(conn: &Connection, id: &str, status: &str) -> Result<()> {
    conn.execute(
        "UPDATE sessions SET status = ?1 WHERE id = ?2",
        params![status, id],
    )?;
    Ok(())
}

pub fn update_session_claude_id(conn: &Connection, id: &str, claude_session_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE sessions SET claude_session_id = ?1 WHERE id = ?2",
        params![claude_session_id, id],
    )?;
    Ok(())
}

pub fn update_session_cost(conn: &Connection, id: &str, cost_usd: f64, token_count: i64) -> Result<()> {
    conn.execute(
        "UPDATE sessions SET cost_usd = ?1, token_count = ?2 WHERE id = ?3",
        params![cost_usd, token_count, id],
    )?;
    Ok(())
}

// --- Message CRUD ---

pub fn insert_message(conn: &Connection, msg: &Message) -> Result<()> {
    conn.execute(
        "INSERT INTO messages (id, session_id, role, content, tool_calls, subagent_count, duration_ms, checkpoint_ref, timestamp) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![msg.id, msg.session_id, msg.role, msg.content, msg.tool_calls, msg.subagent_count, msg.duration_ms, msg.checkpoint_ref, msg.timestamp],
    )?;
    Ok(())
}

pub fn list_messages(conn: &Connection, session_id: &str) -> Result<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, role, content, tool_calls, subagent_count, duration_ms, checkpoint_ref, timestamp FROM messages WHERE session_id = ?1 ORDER BY timestamp",
    )?;
    let rows = stmt.query_map(params![session_id], |row| {
        Ok(Message {
            id: row.get(0)?,
            session_id: row.get(1)?,
            role: row.get(2)?,
            content: row.get(3)?,
            tool_calls: row.get(4)?,
            subagent_count: row.get(5)?,
            duration_ms: row.get(6)?,
            checkpoint_ref: row.get(7)?,
            timestamp: row.get(8)?,
        })
    })?;
    rows.collect()
}

pub fn get_workspace_last_activity(conn: &Connection, workspace_id: &str) -> Result<Option<String>> {
    let mut stmt = conn.prepare(
        "SELECT MAX(m.timestamp) FROM messages m
         INNER JOIN sessions s ON m.session_id = s.id
         WHERE s.workspace_id = ?1",
    )?;
    stmt.query_row(params![workspace_id], |row| row.get(0))
}

pub fn delete_messages_after(conn: &Connection, session_id: &str, timestamp: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM messages WHERE session_id = ?1 AND timestamp > ?2",
        params![session_id, timestamp],
    )?;
    Ok(())
}

/// Reset any sessions stuck in "running" status (e.g. after a crash).
pub fn reset_running_sessions(conn: &Connection) -> Result<usize> {
    conn.execute(
        "UPDATE sessions SET status = 'idle' WHERE status = 'running'",
        [],
    )
}

/// Clear the claude_session_id for a session (e.g. when the session has expired).
pub fn clear_session_claude_id(conn: &Connection, id: &str) -> Result<()> {
    conn.execute(
        "UPDATE sessions SET claude_session_id = NULL WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

mod agent;
mod db;
mod script;
mod state;
mod terminal;
mod worktree;

use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, State};

use crate::agent::manager::AgentManager;
use crate::db::queries;
use crate::state::AppState;
use crate::terminal::pty::TerminalManager;
use crate::worktree::diff::{DiffEntry, FileEntry};

// --- Repo commands ---

#[tauri::command]
fn add_repo(state: State<AppState>, path: String) -> Result<queries::Repo, String> {
    // Validate it's a git repo
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .current_dir(&path)
        .output()
        .map_err(|e| format!("Not a git repo: {e}"))?;

    if !output.status.success() {
        return Err("Not a valid git repository".to_string());
    }

    // Get repo name from remote or directory name
    let name = get_repo_name(&path);
    let default_branch = get_default_branch(&path);

    let repo = queries::Repo {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        path: path.clone(),
        default_branch,
        setup_script: None,
        run_script: None,
        archive_script: None,
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    queries::insert_repo(&db, &repo).map_err(|e| e.to_string())?;

    Ok(repo)
}

#[tauri::command]
fn list_repos(state: State<AppState>) -> Result<Vec<queries::Repo>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    queries::list_repos(&db).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_repo_scripts(
    state: State<AppState>,
    id: String,
    setup: Option<String>,
    run: Option<String>,
    archive: Option<String>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    queries::update_repo_scripts(
        &db,
        &id,
        setup.as_deref(),
        run.as_deref(),
        archive.as_deref(),
    )
    .map_err(|e| e.to_string())
}

// --- Workspace commands ---

#[tauri::command]
fn create_workspace(
    state: State<AppState>,
    repo_id: String,
    task: Option<String>,
) -> Result<queries::Workspace, String> {
    eprintln!("[OpenForge] create_workspace called with repo_id={repo_id}, task={task:?}");
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let repo = queries::get_repo(&db, &repo_id).map_err(|e| {
        eprintln!("[OpenForge] get_repo failed: {e}");
        e.to_string()
    })?;

    // Get existing city names for this repo
    let existing = queries::list_workspaces(&db, &repo_id).map_err(|e| e.to_string())?;
    let used_cities: Vec<String> = existing.iter().map(|w| w.city_name.clone()).collect();

    // Pick a random city name
    let city = pick_city_name(&used_cities);

    // Build branch name from task or city
    let branch_slug = task
        .as_ref()
        .map(|t| slugify(t))
        .unwrap_or_else(|| city.clone());
    let branch_name = format!("agent/{branch_slug}");

    // Build repo slug from name
    let repo_slug = repo.name.replace('/', "-").to_lowercase();
    let wt_path = worktree::manager::worktree_path(&repo_slug, &city);

    // Create worktree
    eprintln!("[OpenForge] Creating worktree at {wt_path}, branch={branch_name}, base={}", repo.default_branch);
    worktree::manager::create_worktree(&repo.path, &wt_path, &branch_name, &repo.default_branch).map_err(|e| {
        eprintln!("[OpenForge] create_worktree failed: {e}");
        e
    })?;
    eprintln!("[OpenForge] Worktree created successfully");

    let now = chrono_now();
    let workspace = queries::Workspace {
        id: uuid::Uuid::new_v4().to_string(),
        repo_id,
        city_name: city,
        worktree_path: wt_path,
        branch_name,
        task_description: task,
        status: "active".to_string(),
        created_at: now,
    };

    queries::insert_workspace(&db, &workspace).map_err(|e| e.to_string())?;

    Ok(workspace)
}

#[tauri::command]
fn list_workspaces(
    state: State<AppState>,
    repo_id: String,
) -> Result<Vec<queries::Workspace>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    queries::list_workspaces(&db, &repo_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn archive_workspace(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ws = queries::get_workspace(&db, &id).map_err(|e| e.to_string())?;
    let repo = queries::get_repo(&db, &ws.repo_id).map_err(|e| e.to_string())?;

    // Stop any running agents for this workspace's sessions
    drop(db); // Release lock before locking agent_manager

    // Remove worktree
    worktree::manager::remove_worktree(&repo.path, &ws.worktree_path)?;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    queries::update_workspace_status(&db, &id, "archived").map_err(|e| e.to_string())
}

#[tauri::command]
fn restore_workspace(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ws = queries::get_workspace(&db, &id).map_err(|e| e.to_string())?;
    let repo = queries::get_repo(&db, &ws.repo_id).map_err(|e| e.to_string())?;

    // Re-create worktree from existing branch
    let parent = std::path::PathBuf::from(&ws.worktree_path)
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or("Invalid path")?;
    std::fs::create_dir_all(&parent).map_err(|e| e.to_string())?;

    let output = std::process::Command::new("git")
        .args(["worktree", "add", &ws.worktree_path, &ws.branch_name])
        .current_dir(&repo.path)
        .output()
        .map_err(|e| format!("Failed to restore worktree: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to restore: {stderr}"));
    }

    queries::update_workspace_status(&db, &id, "active").map_err(|e| e.to_string())
}

// --- Session commands ---

#[tauri::command]
fn create_session(
    state: State<AppState>,
    workspace_id: String,
    model: String,
) -> Result<queries::Session, String> {
    let session = queries::Session {
        id: uuid::Uuid::new_v4().to_string(),
        workspace_id,
        title: "New Chat".to_string(),
        model,
        status: "idle".to_string(),
        claude_session_id: None,
        token_count: 0,
        cost_usd: 0.0,
        created_at: chrono_now(),
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    queries::insert_session(&db, &session).map_err(|e| e.to_string())?;

    Ok(session)
}

#[tauri::command]
fn send_message(
    state: State<AppState>,
    app_handle: AppHandle,
    session_id: String,
    content: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Get session info
    let session = {
        let mut stmt = db
            .prepare("SELECT id, workspace_id, title, model, status, claude_session_id, token_count, cost_usd, created_at FROM sessions WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row(rusqlite::params![session_id], |row| {
            Ok(queries::Session {
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
        })
        .map_err(|e| e.to_string())?
    };

    let ws = queries::get_workspace(&db, &session.workspace_id).map_err(|e| e.to_string())?;

    // Save user message
    let msg_id = uuid::Uuid::new_v4().to_string();

    // Create checkpoint before sending
    let checkpoint_ref = worktree::checkpoint::create_checkpoint(&ws.worktree_path, &msg_id).ok();

    let user_msg = queries::Message {
        id: msg_id,
        session_id: session_id.clone(),
        role: "user".to_string(),
        content: content.clone(),
        tool_calls: None,
        subagent_count: None,
        duration_ms: None,
        checkpoint_ref,
        timestamp: chrono_now(),
    };
    queries::insert_message(&db, &user_msg).map_err(|e| e.to_string())?;

    // Update session status
    queries::update_session_status(&db, &session_id, "running").map_err(|e| e.to_string())?;

    drop(db); // Release db lock before spawning agent

    // Spawn agent
    let mut am = state.agent_manager.lock().map_err(|e| e.to_string())?;
    am.spawn_agent(
        session_id,
        ws.worktree_path,
        session.model,
        content,
        session.claude_session_id,
        app_handle,
    )?;

    Ok(())
}

#[tauri::command]
fn stop_agent(state: State<AppState>, session_id: String) -> Result<(), String> {
    let mut am = state.agent_manager.lock().map_err(|e| e.to_string())?;
    am.stop_agent(&session_id)?;

    let db = state.db.lock().map_err(|e| e.to_string())?;
    queries::update_session_status(&db, &session_id, "idle").map_err(|e| e.to_string())
}

#[tauri::command]
fn get_messages(
    state: State<AppState>,
    session_id: String,
) -> Result<Vec<queries::Message>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    queries::list_messages(&db, &session_id).map_err(|e| e.to_string())
}

// --- File commands ---

#[tauri::command]
fn list_files(state: State<AppState>, workspace_id: String) -> Result<Vec<FileEntry>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ws = queries::get_workspace(&db, &workspace_id).map_err(|e| e.to_string())?;
    worktree::diff::list_files_recursive(&ws.worktree_path)
}

#[tauri::command]
fn read_file(
    state: State<AppState>,
    workspace_id: String,
    path: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ws = queries::get_workspace(&db, &workspace_id).map_err(|e| e.to_string())?;

    let full_path = format!("{}/{}", ws.worktree_path, path);
    std::fs::read_to_string(&full_path).map_err(|e| format!("Failed to read file: {e}"))
}

#[tauri::command]
fn get_diff(state: State<AppState>, workspace_id: String) -> Result<Vec<DiffEntry>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ws = queries::get_workspace(&db, &workspace_id).map_err(|e| e.to_string())?;
    let repo = queries::get_repo(&db, &ws.repo_id).map_err(|e| e.to_string())?;
    worktree::diff::get_changed_files(&ws.worktree_path, &repo.default_branch)
}

#[tauri::command]
fn get_file_diff(
    state: State<AppState>,
    workspace_id: String,
    path: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ws = queries::get_workspace(&db, &workspace_id).map_err(|e| e.to_string())?;
    let repo = queries::get_repo(&db, &ws.repo_id).map_err(|e| e.to_string())?;
    worktree::diff::get_file_diff(&ws.worktree_path, &repo.default_branch, &path)
}

// --- Checkpoint commands ---

#[tauri::command]
fn revert_to_checkpoint(
    state: State<AppState>,
    message_id: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Find the message to get its workspace
    let msg = {
        let mut stmt = db
            .prepare("SELECT id, session_id, role, content, tool_calls, subagent_count, duration_ms, checkpoint_ref, timestamp FROM messages WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row(rusqlite::params![message_id], |row| {
            Ok(queries::Message {
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
        })
        .map_err(|e| e.to_string())?
    };

    // Get workspace path from session
    let session = {
        let mut stmt = db
            .prepare("SELECT workspace_id FROM sessions WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row(rusqlite::params![msg.session_id], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|e| e.to_string())?
    };

    let ws = queries::get_workspace(&db, &session).map_err(|e| e.to_string())?;

    // Revert checkpoint
    worktree::checkpoint::revert_checkpoint(&ws.worktree_path, &message_id)?;

    // Delete messages after this one
    queries::delete_messages_after(&db, &msg.session_id, &msg.timestamp)
        .map_err(|e| e.to_string())
}

// --- Script commands ---

#[tauri::command]
fn run_script(
    state: State<AppState>,
    app_handle: AppHandle,
    workspace_id: String,
    script_type: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ws = queries::get_workspace(&db, &workspace_id).map_err(|e| e.to_string())?;
    let repo = queries::get_repo(&db, &ws.repo_id).map_err(|e| e.to_string())?;

    let script_content = match script_type.as_str() {
        "setup" => repo.setup_script,
        "run" => repo.run_script,
        "archive" => repo.archive_script,
        _ => return Err("Invalid script type".to_string()),
    };

    let script_content = script_content.ok_or("No script configured for this type")?;

    script::runner::run_script(
        workspace_id,
        ws.worktree_path,
        repo.path,
        script_content,
        script_type,
        app_handle,
    )
}

// --- Terminal commands ---

#[tauri::command]
fn create_terminal(
    state: State<AppState>,
    app_handle: AppHandle,
    workspace_id: String,
) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ws = queries::get_workspace(&db, &workspace_id).map_err(|e| e.to_string())?;
    drop(db);

    let terminal_id = uuid::Uuid::new_v4().to_string();
    let mut tm = state.terminal_manager.lock().map_err(|e| e.to_string())?;
    tm.create_terminal(terminal_id.clone(), ws.worktree_path, app_handle)?;

    Ok(terminal_id)
}

#[tauri::command]
fn write_terminal(
    state: State<AppState>,
    terminal_id: String,
    data: String,
) -> Result<(), String> {
    let tm = state.terminal_manager.lock().map_err(|e| e.to_string())?;
    tm.write_terminal(&terminal_id, data)
}

#[tauri::command]
fn resize_terminal(
    state: State<AppState>,
    terminal_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let mut tm = state.terminal_manager.lock().map_err(|e| e.to_string())?;
    tm.resize_terminal(&terminal_id, rows, cols)
}

#[tauri::command]
fn close_terminal(state: State<AppState>, terminal_id: String) -> Result<(), String> {
    let mut tm = state.terminal_manager.lock().map_err(|e| e.to_string())?;
    tm.close_terminal(&terminal_id)
}

// --- Helpers ---

fn get_repo_name(path: &str) -> String {
    let output = std::process::Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(path)
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            let url = String::from_utf8_lossy(&output.stdout).trim().to_string();
            // Parse "git@github.com:owner/repo.git" or "https://github.com/owner/repo.git"
            if let Some(name) = parse_repo_name_from_url(&url) {
                return name;
            }
        }
    }

    // Fallback to directory name
    std::path::PathBuf::from(path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

fn parse_repo_name_from_url(url: &str) -> Option<String> {
    let url = url.trim_end_matches(".git");

    if url.contains(':') && url.starts_with("git@") {
        // git@github.com:owner/repo
        let parts: Vec<&str> = url.split(':').collect();
        return parts.get(1).map(|s| s.to_string());
    }

    // https://github.com/owner/repo
    let parts: Vec<&str> = url.split('/').collect();
    if parts.len() >= 2 {
        let owner = parts[parts.len() - 2];
        let repo = parts[parts.len() - 1];
        return Some(format!("{owner}/{repo}"));
    }

    None
}

fn get_default_branch(path: &str) -> String {
    let output = std::process::Command::new("git")
        .args(["symbolic-ref", "refs/remotes/origin/HEAD", "--short"])
        .current_dir(path)
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return branch.replace("origin/", "");
        }
    }

    // Fallback
    "main".to_string()
}

fn pick_city_name(exclude: &[String]) -> String {
    use rand::seq::SliceRandom;
    let cities = cities_list();
    let available: Vec<&&str> = cities.iter().filter(|c| !exclude.contains(&c.to_string())).collect();
    let mut rng = rand::thread_rng();
    available
        .choose(&mut rng)
        .map(|c| c.to_string())
        .unwrap_or_else(|| format!("workspace-{}", uuid::Uuid::new_v4().to_string()[..8].to_string()))
}

fn slugify(s: &str) -> String {
    let slug: String = s
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<&str>>()
        .join("-");
    let end = slug.len().min(50);
    slug[..end].to_string()
}

fn chrono_now() -> String {
    // Simple ISO 8601 timestamp without chrono dependency
    let output = std::process::Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output();

    if let Ok(output) = output {
        if output.status.success() {
            return String::from_utf8_lossy(&output.stdout).trim().to_string();
        }
    }

    "1970-01-01T00:00:00Z".to_string()
}

fn cities_list() -> Vec<&'static str> {
    vec![
        "tokyo", "mumbai", "lagos", "rio-de-janeiro", "paris", "new-york", "seoul",
        "istanbul", "cairo", "buenos-aires", "nairobi", "bangkok", "toronto", "sydney",
        "berlin", "dubai", "singapore", "jakarta", "moscow", "lima", "bogota", "delhi",
        "chennai", "bangalore", "hyderabad", "kolkata", "pune", "ahmedabad", "jaipur",
        "lucknow", "london", "madrid", "rome", "amsterdam", "prague", "vienna", "zurich",
        "oslo", "stockholm", "helsinki", "copenhagen", "dublin", "lisbon", "athens",
        "warsaw", "budapest", "bucharest", "sofia", "belgrade", "zagreb", "bratislava",
        "taipei", "hong-kong", "shanghai", "beijing", "guangzhou", "shenzhen", "osaka",
        "kyoto", "nagoya", "sapporo", "hanoi", "ho-chi-minh", "manila", "kuala-lumpur",
        "yangon", "dhaka", "karachi", "lahore", "islamabad", "tehran", "baghdad",
        "riyadh", "doha", "muscat", "amman", "beirut", "jerusalem", "tel-aviv",
        "cape-town", "johannesburg", "casablanca", "tunis", "algiers", "accra", "dakar",
        "addis-ababa", "kampala", "dar-es-salaam", "maputo", "lusaka", "harare",
        "mexico-city", "guadalajara", "monterrey", "havana", "san-jose", "panama-city",
        "quito", "santiago", "montevideo", "asuncion", "la-paz", "caracas", "medellin",
        "vancouver", "montreal", "calgary", "ottawa", "chicago", "san-francisco",
        "los-angeles", "seattle", "austin", "denver", "miami", "boston", "portland",
        "detroit", "atlanta", "phoenix", "houston", "dallas", "philadelphia",
        "minneapolis", "nashville", "new-orleans", "salt-lake-city", "pittsburgh",
        "auckland", "wellington", "melbourne", "brisbane", "perth", "honolulu",
        "reykjavik", "tallinn", "riga", "vilnius", "tbilisi", "yerevan", "baku",
        "tashkent", "almaty", "ulaanbaatar", "kathmandu", "colombo", "kochi",
        "goa", "varanasi", "indore", "surat", "nagpur", "bhopal", "chandigarh",
        "coimbatore", "mysore", "thiruvananthapuram", "vizag", "patna", "ranchi",
        "raipur", "guwahati", "imphal", "shimla", "dehradun", "rishikesh",
        "udaipur", "jodhpur", "agra", "kanpur", "allahabad", "amritsar",
        "florence", "barcelona", "munich", "hamburg", "lyon", "marseille",
        "milan", "naples", "porto", "seville", "malaga", "edinburgh", "glasgow",
        "manchester", "birmingham", "brussels", "antwerp", "rotterdam", "gothenburg",
        "bergen", "krakow", "gdansk", "split", "dubrovnik", "santorini",
    ]
}

// --- App setup ---

pub fn run() {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let data_dir = format!("{home}/openforge/data");
    std::fs::create_dir_all(&data_dir).expect("Failed to create data directory");

    let db_path = format!("{data_dir}/openforge.db");
    let conn = Connection::open(&db_path).expect("Failed to open database");
    db::schema::initialize(&conn).expect("Failed to initialize database schema");

    let app_state = AppState {
        db: Mutex::new(conn),
        agent_manager: Mutex::new(AgentManager::new()),
        terminal_manager: Mutex::new(TerminalManager::new()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            add_repo,
            list_repos,
            update_repo_scripts,
            create_workspace,
            list_workspaces,
            archive_workspace,
            restore_workspace,
            create_session,
            send_message,
            stop_agent,
            get_messages,
            list_files,
            read_file,
            get_diff,
            get_file_diff,
            revert_to_checkpoint,
            run_script,
            create_terminal,
            write_terminal,
            resize_terminal,
            close_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

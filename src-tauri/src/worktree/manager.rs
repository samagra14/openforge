use std::path::PathBuf;
use std::process::Command;

/// Fetch latest changes from origin.
pub fn fetch_origin(repo_path: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["fetch", "origin"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git fetch: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("[OpenForge] git fetch origin warning: {stderr}");
        // Non-fatal: continue even if fetch fails (e.g., offline)
    }

    Ok(())
}

/// Create a new git worktree for a workspace.
/// When `fetch_first` is true, fetches from origin and bases the worktree
/// on `origin/<base_branch>` for the latest upstream state.
pub fn create_worktree(
    repo_path: &str,
    worktree_path: &str,
    branch_name: &str,
    base_branch: &str,
    fetch_first: bool,
) -> Result<(), String> {
    // Ensure parent directory exists
    let parent = PathBuf::from(worktree_path)
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or("Invalid worktree path")?;
    std::fs::create_dir_all(&parent).map_err(|e| format!("Failed to create directory: {e}"))?;

    // Determine the start point for the new branch
    let start_point = if fetch_first {
        fetch_origin(repo_path)?;
        format!("origin/{base_branch}")
    } else {
        base_branch.to_string()
    };

    let output = Command::new("git")
        .args([
            "worktree",
            "add",
            worktree_path,
            "-b",
            branch_name,
            &start_point,
        ])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git worktree add: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree add failed: {stderr}"));
    }

    Ok(())
}

/// Remove a git worktree.
pub fn remove_worktree(repo_path: &str, worktree_path: &str) -> Result<(), String> {
    let output = Command::new("git")
        .args(["worktree", "remove", worktree_path, "--force"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to run git worktree remove: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree remove failed: {stderr}"));
    }

    Ok(())
}

/// Get the openforge workspace base directory.
pub fn workspace_base_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home).join("openforge").join("workspaces")
}

/// Build the full worktree path for a workspace.
pub fn worktree_path(repo_slug: &str, workspace_name: &str) -> String {
    workspace_base_dir()
        .join(repo_slug)
        .join(workspace_name)
        .to_string_lossy()
        .to_string()
}

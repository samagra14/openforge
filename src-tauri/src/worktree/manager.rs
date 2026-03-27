use std::path::PathBuf;
use std::process::Command;

/// Create a new git worktree for a workspace.
pub fn create_worktree(
    repo_path: &str,
    worktree_path: &str,
    branch_name: &str,
    base_branch: &str,
) -> Result<(), String> {
    // Ensure parent directory exists
    let parent = PathBuf::from(worktree_path)
        .parent()
        .map(|p| p.to_path_buf())
        .ok_or("Invalid worktree path")?;
    std::fs::create_dir_all(&parent).map_err(|e| format!("Failed to create directory: {e}"))?;

    let output = Command::new("git")
        .args([
            "worktree",
            "add",
            worktree_path,
            "-b",
            branch_name,
            base_branch,
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
pub fn worktree_path(repo_slug: &str, city_name: &str) -> String {
    workspace_base_dir()
        .join(repo_slug)
        .join(city_name)
        .to_string_lossy()
        .to_string()
}

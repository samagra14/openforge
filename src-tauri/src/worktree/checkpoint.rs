use std::process::Command;

/// Create a checkpoint before a user message is sent to Claude.
/// Stores HEAD, index, and worktree state as git refs.
pub fn create_checkpoint(worktree_path: &str, message_id: &str) -> Result<String, String> {
    // 1. Capture HEAD
    let _head_sha = git_cmd(worktree_path, &["rev-parse", "HEAD"])?;

    // 2. Capture current index as a tree
    let index_tree = git_cmd(worktree_path, &["write-tree"])?;

    // 3. Capture full worktree state (including untracked files) using a temp index
    let temp_index = format!("/tmp/openforge-checkpoint-{message_id}");
    std::fs::copy(
        format!("{worktree_path}/.git/index"),
        &temp_index,
    )
    .ok(); // May not exist for worktrees, that's fine

    let worktree_tree = {
        // Add all files to temp index
        let _ = Command::new("git")
            .args(["add", "-A"])
            .current_dir(worktree_path)
            .env("GIT_INDEX_FILE", &temp_index)
            .output();

        let output = Command::new("git")
            .args(["write-tree"])
            .current_dir(worktree_path)
            .env("GIT_INDEX_FILE", &temp_index)
            .output()
            .map_err(|e| format!("Failed to write-tree: {e}"))?;

        let _ = std::fs::remove_file(&temp_index);

        if !output.status.success() {
            // Fallback to regular index tree
            index_tree.clone()
        } else {
            String::from_utf8_lossy(&output.stdout).trim().to_string()
        }
    };

    // 4. Create a checkpoint commit
    let commit_msg = format!("openforge checkpoint {message_id}");
    let commit_sha = git_cmd(
        worktree_path,
        &["commit-tree", &worktree_tree, "-m", &commit_msg],
    )?;

    // 5. Store as a ref
    let ref_name = format!("refs/openforge-checkpoints/{message_id}");
    git_cmd(worktree_path, &["update-ref", &ref_name, &commit_sha])?;

    Ok(ref_name)
}

/// Revert to a checkpoint.
pub fn revert_checkpoint(worktree_path: &str, message_id: &str) -> Result<(), String> {
    let ref_name = format!("refs/openforge-checkpoints/{message_id}");

    // Get the tree from the checkpoint commit
    let tree_sha = git_cmd(worktree_path, &["rev-parse", &format!("{ref_name}^{{tree}}")])?;

    // Reset worktree to the checkpoint tree
    git_cmd(worktree_path, &["read-tree", &tree_sha])?;
    git_cmd(worktree_path, &["checkout-index", "-a", "-f"])?;

    // Clean untracked files
    git_cmd(worktree_path, &["clean", "-fd"])?;

    Ok(())
}

fn git_cmd(cwd: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run git {}: {e}", args.join(" ")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git {} failed: {stderr}", args.join(" ")));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

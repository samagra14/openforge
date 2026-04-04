use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffEntry {
    pub path: String,
    pub status: String, // "added", "modified", "deleted", "renamed"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffStats {
    pub files_changed: i64,
    pub lines_added: i64,
    pub lines_removed: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

/// Get list of changed files compared to the base branch.
pub fn get_changed_files(worktree_path: &str, base_branch: &str) -> Result<Vec<DiffEntry>, String> {
    let output = Command::new("git")
        .args(["diff", &format!("{base_branch}..HEAD"), "--name-status"])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    if !output.status.success() {
        // May fail if no commits yet; return empty
        return Ok(Vec::new());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let entries = stdout
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 2 {
                let status = match parts[0].chars().next() {
                    Some('A') => "added",
                    Some('M') => "modified",
                    Some('D') => "deleted",
                    Some('R') => "renamed",
                    _ => "modified",
                };
                Some(DiffEntry {
                    path: parts[1].to_string(),
                    status: status.to_string(),
                })
            } else {
                None
            }
        })
        .collect();

    Ok(entries)
}

/// Get unified diff for a specific file.
pub fn get_file_diff(worktree_path: &str, base_branch: &str, file_path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["diff", &format!("{base_branch}..HEAD"), "--", file_path])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Get diff stats (files changed, lines added/removed) compared to the base branch.
pub fn get_diff_stats(worktree_path: &str, base_branch: &str) -> Result<DiffStats, String> {
    let output = Command::new("git")
        .args(["diff", &format!("{base_branch}..HEAD"), "--shortstat"])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| format!("Failed to run git diff --shortstat: {e}"))?;

    if !output.status.success() {
        return Ok(DiffStats {
            files_changed: 0,
            lines_added: 0,
            lines_removed: 0,
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    // Parse: " 5 files changed, 189 insertions(+), 22 deletions(-)"
    let mut files = 0i64;
    let mut added = 0i64;
    let mut removed = 0i64;

    for part in stdout.split(',') {
        let part = part.trim();
        if part.contains("file") {
            if let Some(n) = part.split_whitespace().next().and_then(|s| s.parse::<i64>().ok()) {
                files = n;
            }
        } else if part.contains("insertion") {
            if let Some(n) = part.split_whitespace().next().and_then(|s| s.parse::<i64>().ok()) {
                added = n;
            }
        } else if part.contains("deletion") {
            if let Some(n) = part.split_whitespace().next().and_then(|s| s.parse::<i64>().ok()) {
                removed = n;
            }
        }
    }

    Ok(DiffStats {
        files_changed: files,
        lines_added: added,
        lines_removed: removed,
    })
}

/// Read a file's content at a specific git ref (e.g., base branch).
/// Uses `git show <ref>:<path>` to retrieve the content.
pub fn read_file_at_ref(worktree_path: &str, git_ref: &str, file_path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["show", &format!("{git_ref}:{file_path}")])
        .current_dir(worktree_path)
        .output()
        .map_err(|e| format!("Failed to run git show: {e}"))?;

    if !output.status.success() {
        // File doesn't exist at this ref (newly added file)
        return Ok(String::new());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// List all files as a flat list of relative paths, respecting .gitignore.
/// More efficient than list_files_recursive for search — no tree building.
pub fn list_files_flat(dir_path: &str) -> Result<Vec<String>, String> {
    let output = Command::new("git")
        .args(["ls-files", "--cached", "--others", "--exclude-standard"])
        .current_dir(dir_path)
        .output()
        .map_err(|e| format!("Failed to list files: {e}"))?;

    if !output.status.success() {
        return Err("git ls-files failed".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.lines().map(|l| l.to_string()).collect())
}

/// Recursively list files in a directory, respecting .gitignore.
pub fn list_files_recursive(dir_path: &str) -> Result<Vec<FileEntry>, String> {
    let output = Command::new("git")
        .args(["ls-files", "--cached", "--others", "--exclude-standard"])
        .current_dir(dir_path)
        .output()
        .map_err(|e| format!("Failed to list files: {e}"))?;

    if !output.status.success() {
        // Fallback to basic listing
        return list_dir(dir_path, "");
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let files: Vec<&str> = stdout.lines().collect();

    // Build tree from flat file list (use empty base so paths are relative)
    build_file_tree(&files, "")
}

fn join_path(base: &str, name: &str) -> String {
    if base.is_empty() {
        name.to_string()
    } else {
        format!("{base}/{name}")
    }
}

fn build_file_tree(files: &[&str], base_path: &str) -> Result<Vec<FileEntry>, String> {
    use std::collections::BTreeMap;

    let mut tree: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut standalone_files: Vec<String> = Vec::new();

    for file in files {
        if let Some((dir, rest)) = file.split_once('/') {
            tree.entry(dir.to_string())
                .or_default()
                .push(rest.to_string());
        } else {
            standalone_files.push(file.to_string());
        }
    }

    let mut entries = Vec::new();

    // Directories first
    for (dir_name, sub_files) in &tree {
        let sub_refs: Vec<&str> = sub_files.iter().map(|s| s.as_str()).collect();
        let dir_path = join_path(base_path, dir_name);
        let children = build_file_tree(&sub_refs, &dir_path)?;
        entries.push(FileEntry {
            name: dir_name.clone(),
            path: dir_path,
            is_dir: true,
            children: Some(children),
        });
    }

    // Then files
    for file_name in &standalone_files {
        entries.push(FileEntry {
            name: file_name.clone(),
            path: join_path(base_path, file_name),
            is_dir: false,
            children: None,
        });
    }

    Ok(entries)
}

fn list_dir(dir_path: &str, prefix: &str) -> Result<Vec<FileEntry>, String> {
    let mut entries = Vec::new();
    let read_dir =
        std::fs::read_dir(dir_path).map_err(|e| format!("Failed to read dir: {e}"))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files and common ignores
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }

        let path = if prefix.is_empty() {
            name.clone()
        } else {
            format!("{prefix}/{name}")
        };

        let is_dir = entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false);

        entries.push(FileEntry {
            name,
            path,
            is_dir,
            children: None, // Populated on demand
        });
    }

    entries.sort_by(|a, b| {
        // Directories first, then alphabetical
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });

    Ok(entries)
}

use std::io::BufRead;
use std::process::{Command, Stdio};
use std::thread;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptOutputEvent {
    pub workspace_id: String,
    pub script_type: String,
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptExitEvent {
    pub workspace_id: String,
    pub script_type: String,
    pub exit_code: i32,
}

/// Run a shell script in the workspace directory.
pub fn run_script(
    workspace_id: String,
    workspace_path: String,
    repo_path: String,
    script: String,
    script_type: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let mut child = Command::new(&shell)
        .args(["-c", &script])
        .current_dir(&workspace_path)
        .env("OPENFORGE_WORKSPACE_PATH", &workspace_path)
        .env("OPENFORGE_REPO_PATH", &repo_path)
        .env(
            "OPENFORGE_ROOT",
            std::env::var("HOME")
                .unwrap_or_default()
                .to_string()
                + "/openforge",
        )
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to run script: {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let wid = workspace_id.clone();
    let st = script_type.clone();
    let handle = app_handle.clone();

    thread::spawn(move || {
        // Read stdout
        if let Some(stdout) = stdout {
            let reader = std::io::BufReader::new(stdout);
            for line in reader.lines().flatten() {
                let _ = handle.emit(
                    "script:output",
                    ScriptOutputEvent {
                        workspace_id: wid.clone(),
                        script_type: st.clone(),
                        data: line + "\n",
                    },
                );
            }
        }

        // Read stderr
        if let Some(stderr) = stderr {
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let _ = handle.emit(
                    "script:output",
                    ScriptOutputEvent {
                        workspace_id: wid.clone(),
                        script_type: st.clone(),
                        data: line + "\n",
                    },
                );
            }
        }

        let exit_code = child.wait().map(|s| s.code().unwrap_or(-1)).unwrap_or(-1);
        let _ = app_handle.emit(
            "script:exit",
            ScriptExitEvent {
                workspace_id: workspace_id.clone(),
                script_type: script_type.clone(),
                exit_code,
            },
        );
    });

    Ok(())
}

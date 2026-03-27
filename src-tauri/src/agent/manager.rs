use std::collections::HashMap;
use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;

use tauri::{AppHandle, Emitter};

use super::parser::parse_stream_line;
use super::types::*;

pub struct AgentProcess {
    child: Option<Child>,
    kill_tx: Option<mpsc::Sender<()>>,
}

pub struct AgentManager {
    processes: HashMap<String, AgentProcess>,
}

impl AgentManager {
    pub fn new() -> Self {
        Self {
            processes: HashMap::new(),
        }
    }

    pub fn spawn_agent(
        &mut self,
        session_id: String,
        worktree_path: String,
        model: String,
        prompt: String,
        resume_session_id: Option<String>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // If there's already a running agent for this session, stop it first
        if self.processes.contains_key(&session_id) {
            eprintln!("[openforge] Stopping existing agent for session {session_id}");
            let _ = self.stop_agent(&session_id);
        }

        let mut args = vec![
            "-p".to_string(),
            "--verbose".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--model".to_string(),
            model,
        ];

        if let Some(ref claude_sid) = resume_session_id {
            args.push("--resume".to_string());
            args.push("--session-id".to_string());
            args.push(claude_sid.clone());
        }

        args.push(prompt.clone());

        eprintln!(
            "[openforge] Spawning claude in {worktree_path} with args: {}",
            args.join(" ")
        );

        let mut child = Command::new("claude")
            .args(&args)
            .current_dir(&worktree_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn claude: {e}"))?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
        let (kill_tx, kill_rx) = mpsc::channel::<()>();

        let sid = session_id.clone();
        let handle = app_handle.clone();

        // Emit running status
        let _ = app_handle.emit(
            "agent:status",
            AgentStatusEvent {
                session_id: sid.clone(),
                status: "running".to_string(),
            },
        );

        // Spawn stderr reader thread (for debug logging only)
        let sid_stderr = sid.clone();
        thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(l) => eprintln!("[openforge][claude stderr][{sid_stderr}] {l}"),
                    Err(_) => break,
                }
            }
        });

        // Spawn stdout reader thread — this is the main NDJSON parsing loop
        thread::spawn(move || {
            let reader = std::io::BufReader::new(stdout);

            // Track tool call results keyed by tool_use_id.
            // We use this to attach tool outputs when we receive tool_result events.
            let mut tool_outputs: HashMap<String, (Option<String>, bool)> = HashMap::new();

            // The latest message_id from the assistant. Since each "assistant"
            // event is a *cumulative snapshot* of the same message, all lines
            // with the same message.id should map to a single frontend message.
            let mut current_message_id: Option<String> = None;
            let mut current_content = String::new();
            let mut current_tool_calls: Vec<ToolCallInfo> = Vec::new();

            for line_result in reader.lines() {
                // Check for kill signal (non-blocking)
                if kill_rx.try_recv().is_ok() {
                    eprintln!("[openforge] Kill signal received for session {sid}");
                    break;
                }

                let line = match line_result {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("[openforge] Error reading stdout: {e}");
                        break;
                    }
                };

                let event = match parse_stream_line(&line) {
                    Some(e) => e,
                    None => continue,
                };

                match event {
                    StreamEvent::Assistant { message } => {
                        // Each assistant event is a CUMULATIVE SNAPSHOT.
                        // The content array contains the full content so far,
                        // not a delta. We must REPLACE, not append.

                        let msg_id = message.id.clone();

                        // If message id changed, we're in a new turn (multi-turn
                        // conversations). Reset state for the new message.
                        if current_message_id.as_deref() != Some(&msg_id) {
                            current_message_id = Some(msg_id.clone());
                            current_content.clear();
                            current_tool_calls.clear();
                        }

                        // Extract content from the snapshot — replace entirely
                        let mut text_parts: Vec<String> = Vec::new();
                        let mut tool_calls_snapshot: Vec<ToolCallInfo> = Vec::new();

                        for block in &message.content {
                            match block {
                                ContentBlock::Text { text } => {
                                    text_parts.push(text.clone());
                                }
                                ContentBlock::Thinking { thinking, .. } => {
                                    // Include thinking in a distinct format
                                    // so the frontend can render it differently
                                    text_parts.push(format!("<thinking>{thinking}</thinking>"));
                                }
                                ContentBlock::ToolUse { id, name, input, .. } => {
                                    // Check if we already have an output for this tool_use_id
                                    let (output, is_error) = tool_outputs
                                        .get(id)
                                        .cloned()
                                        .unwrap_or((None, false));

                                    let status = if output.is_some() {
                                        if is_error {
                                            "error".to_string()
                                        } else {
                                            "done".to_string()
                                        }
                                    } else {
                                        "running".to_string()
                                    };

                                    tool_calls_snapshot.push(ToolCallInfo {
                                        name: name.clone(),
                                        input: input.clone(),
                                        output,
                                        status,
                                        tool_use_id: Some(id.clone()),
                                    });
                                }
                            }
                        }

                        current_content = text_parts.join("");
                        current_tool_calls = tool_calls_snapshot;

                        // Emit the latest snapshot to the frontend.
                        // The frontend uses message_id to upsert: if the id
                        // was seen before, it updates in place; otherwise it
                        // adds a new message.
                        let _ = handle.emit(
                            "agent:message",
                            AgentMessageEvent {
                                session_id: sid.clone(),
                                message_id: msg_id,
                                role: "assistant".to_string(),
                                content: current_content.clone(),
                                tool_calls: current_tool_calls.clone(),
                            },
                        );
                    }

                    StreamEvent::User { message: user_msg } => {
                        // User events contain tool results — store them and
                        // update current_tool_calls so the frontend sees outputs.
                        for block in &user_msg.content {
                            match block {
                                UserContentBlock::ToolResult {
                                    tool_use_id,
                                    content,
                                    is_error,
                                } => {
                                    let output_str = match content {
                                        Some(serde_json::Value::String(s)) => Some(s.clone()),
                                        Some(v) => Some(v.to_string()),
                                        None => None,
                                    };
                                    tool_outputs.insert(
                                        tool_use_id.clone(),
                                        (output_str.clone(), *is_error),
                                    );

                                    // Update the in-memory tool calls with the result
                                    for tc in &mut current_tool_calls {
                                        if tc.tool_use_id.as_deref() == Some(tool_use_id) {
                                            tc.output = output_str.clone();
                                            tc.status = if *is_error {
                                                "error".to_string()
                                            } else {
                                                "done".to_string()
                                            };
                                        }
                                    }
                                }
                            }
                        }

                        // Emit updated tool call state to frontend
                        if let Some(ref msg_id) = current_message_id {
                            let _ = handle.emit(
                                "agent:message",
                                AgentMessageEvent {
                                    session_id: sid.clone(),
                                    message_id: msg_id.clone(),
                                    role: "assistant".to_string(),
                                    content: current_content.clone(),
                                    tool_calls: current_tool_calls.clone(),
                                },
                            );
                        }
                    }

                    StreamEvent::ToolResult {
                        tool_use_id,
                        content,
                        is_error,
                    } => {
                        // Store the tool output for future assistant snapshots.
                        let output_str = match &content {
                            Some(serde_json::Value::String(s)) => Some(s.clone()),
                            Some(v) => Some(v.to_string()),
                            None => None,
                        };

                        tool_outputs.insert(
                            tool_use_id.clone(),
                            (output_str.clone(), is_error),
                        );

                        // Update current_tool_calls in place so the emitted
                        // event reflects the actual output and status.
                        for tc in &mut current_tool_calls {
                            if tc.tool_use_id.as_deref() == Some(&tool_use_id) {
                                tc.output = output_str.clone();
                                tc.status = if is_error {
                                    "error".to_string()
                                } else {
                                    "done".to_string()
                                };
                            }
                        }

                        // Emit immediate update with corrected tool call state.
                        if let Some(ref msg_id) = current_message_id {
                            let _ = handle.emit(
                                "agent:message",
                                AgentMessageEvent {
                                    session_id: sid.clone(),
                                    message_id: msg_id.clone(),
                                    role: "assistant".to_string(),
                                    content: current_content.clone(),
                                    tool_calls: current_tool_calls.clone(),
                                },
                            );
                        }
                    }

                    StreamEvent::Result {
                        cost_usd,
                        total_cost_usd,
                        duration_ms,
                        session_id: claude_sid,
                        ..
                    } => {
                        let final_cost = total_cost_usd.or(cost_usd).unwrap_or(0.0);
                        eprintln!(
                            "[openforge] Agent complete for session {sid}: \
                             cost=${final_cost:.4}, duration={}ms, claude_session_id={claude_sid:?}",
                            duration_ms.unwrap_or(0),
                        );

                        let _ = handle.emit(
                            "agent:complete",
                            AgentCompleteEvent {
                                session_id: sid.clone(),
                                cost_usd: final_cost,
                                duration_ms: duration_ms.unwrap_or(0),
                                claude_session_id: claude_sid,
                            },
                        );
                    }
                }
            }

            // Stream ended — emit idle status
            eprintln!("[openforge] Agent stream ended for session {sid}");
            let _ = handle.emit(
                "agent:status",
                AgentStatusEvent {
                    session_id: sid.clone(),
                    status: "idle".to_string(),
                },
            );
        });

        self.processes.insert(
            session_id,
            AgentProcess {
                child: Some(child),
                kill_tx: Some(kill_tx),
            },
        );

        Ok(())
    }

    pub fn stop_agent(&mut self, session_id: &str) -> Result<(), String> {
        if let Some(mut process) = self.processes.remove(session_id) {
            // Send kill signal to the reader thread
            if let Some(tx) = process.kill_tx.take() {
                let _ = tx.send(());
            }
            // Kill the child process
            if let Some(ref mut child) = process.child {
                eprintln!("[openforge] Killing claude process for session {session_id}");
                let _ = child.kill();
                // Wait to avoid zombie processes
                let _ = child.wait();
            }
            Ok(())
        } else {
            Err("No agent process found for session".to_string())
        }
    }

    pub fn cleanup_all(&mut self) {
        let ids: Vec<String> = self.processes.keys().cloned().collect();
        for id in ids {
            let _ = self.stop_agent(&id);
        }
    }
}

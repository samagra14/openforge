use std::collections::HashMap;
use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;

use rusqlite::Connection;
use tauri::{AppHandle, Emitter};

use crate::db::queries;

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
        db: Arc<Mutex<Connection>>,
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

        // Spawn stderr reader thread — detects session errors
        let sid_stderr = sid.clone();
        let handle_stderr = app_handle.clone();
        let is_resume = resume_session_id.is_some();
        thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            let mut has_session_error = false;
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        eprintln!("[openforge][claude stderr][{sid_stderr}] {l}");
                        // Detect expired/invalid session errors
                        if is_resume
                            && (l.contains("Session not found")
                                || l.contains("session")
                                    && (l.contains("expired") || l.contains("invalid")))
                        {
                            has_session_error = true;
                        }
                    }
                    Err(_) => break,
                }
            }
            if has_session_error {
                let _ = handle_stderr.emit(
                    "agent:error",
                    AgentErrorEvent {
                        session_id: sid_stderr.clone(),
                        error: "Claude session expired or not found. Starting fresh conversation.".to_string(),
                        error_type: "session_expired".to_string(),
                    },
                );
            }
        });

        // Spawn stdout reader thread — this is the main NDJSON parsing loop
        thread::spawn(move || {
            let reader = std::io::BufReader::new(stdout);

            // Track tool call results keyed by tool_use_id.
            let mut tool_outputs: HashMap<String, (Option<String>, bool)> = HashMap::new();

            // The latest message_id from the parent assistant.
            let mut current_message_id: Option<String> = None;
            let mut current_content = String::new();
            let mut current_tool_calls: Vec<ToolCallInfo> = Vec::new();

            // Sub-agent tool calls, keyed by parent_tool_use_id.
            // Each entry is a Vec of tool calls made by the sub-agent.
            let mut subagent_tool_calls: HashMap<String, Vec<ToolCallInfo>> = HashMap::new();
            let mut subagent_tool_outputs: HashMap<String, (Option<String>, bool)> = HashMap::new();

            // Capture Result event data for DB persistence after stream ends
            let mut result_claude_sid: Option<String> = None;
            let mut result_cost: f64 = 0.0;
            let mut _result_duration: u64 = 0;

            // Helper: rebuild current_tool_calls with sub_tool_calls attached
            let attach_subagent_calls = |
                tool_calls: &[ToolCallInfo],
                subagent_calls: &HashMap<String, Vec<ToolCallInfo>>,
            | -> Vec<ToolCallInfo> {
                tool_calls.iter().map(|tc| {
                    if let Some(ref tool_id) = tc.tool_use_id {
                        if let Some(sub_calls) = subagent_calls.get(tool_id) {
                            let mut tc = tc.clone();
                            tc.sub_tool_calls = Some(sub_calls.clone());
                            return tc;
                        }
                    }
                    tc.clone()
                }).collect()
            };

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
                    StreamEvent::Assistant { message, parent_tool_use_id } => {
                        if let Some(ref parent_id) = parent_tool_use_id {
                            // ── Sub-agent event ──
                            // Extract tool_use blocks and add to subagent tracking.
                            let entry = subagent_tool_calls.entry(parent_id.clone()).or_default();

                            for block in &message.content {
                                if let ContentBlock::ToolUse { id, name, input, .. } = block {
                                    let (output, is_error) = subagent_tool_outputs
                                        .get(id)
                                        .cloned()
                                        .unwrap_or((None, false));

                                    let status = if output.is_some() {
                                        if is_error { "error" } else { "done" }
                                    } else {
                                        "running"
                                    };

                                    // Upsert: update if exists, add if not
                                    if let Some(existing) = entry.iter_mut().find(|t| t.tool_use_id.as_deref() == Some(id)) {
                                        existing.output = output;
                                        existing.status = status.to_string();
                                    } else {
                                        entry.push(ToolCallInfo {
                                            name: name.clone(),
                                            input: input.clone(),
                                            output,
                                            status: status.to_string(),
                                            tool_use_id: Some(id.clone()),
                                            sub_tool_calls: None,
                                        });
                                    }
                                }
                            }

                            // Re-emit the parent message with updated sub_tool_calls
                            if let Some(ref msg_id) = current_message_id {
                                let enriched = attach_subagent_calls(&current_tool_calls, &subagent_tool_calls);
                                let _ = handle.emit(
                                    "agent:message",
                                    AgentMessageEvent {
                                        session_id: sid.clone(),
                                        message_id: msg_id.clone(),
                                        role: "assistant".to_string(),
                                        content: current_content.clone(),
                                        tool_calls: enriched,
                                    },
                                );
                            }
                        } else {
                            // ── Parent assistant event (cumulative snapshot) ──
                            let msg_id = message.id.clone();

                            if current_message_id.as_deref() != Some(&msg_id) {
                                current_message_id = Some(msg_id.clone());
                                current_content.clear();
                                current_tool_calls.clear();
                                // Don't clear subagent_tool_calls — they persist across turns
                            }

                            let mut text_parts: Vec<String> = Vec::new();
                            let mut tool_calls_snapshot: Vec<ToolCallInfo> = Vec::new();

                            for block in &message.content {
                                match block {
                                    ContentBlock::Text { text } => {
                                        text_parts.push(text.clone());
                                    }
                                    ContentBlock::Thinking { thinking, .. } => {
                                        text_parts.push(format!("<thinking>{thinking}</thinking>"));
                                    }
                                    ContentBlock::ToolUse { id, name, input, .. } => {
                                        let (output, is_error) = tool_outputs
                                            .get(id)
                                            .cloned()
                                            .unwrap_or((None, false));

                                        let status = if output.is_some() {
                                            if is_error { "error".to_string() } else { "done".to_string() }
                                        } else {
                                            "running".to_string()
                                        };

                                        tool_calls_snapshot.push(ToolCallInfo {
                                            name: name.clone(),
                                            input: input.clone(),
                                            output,
                                            status,
                                            tool_use_id: Some(id.clone()),
                                            sub_tool_calls: None,
                                        });
                                    }
                                }
                            }

                            current_content = text_parts.join("");
                            current_tool_calls = tool_calls_snapshot;

                            let enriched = attach_subagent_calls(&current_tool_calls, &subagent_tool_calls);
                            let _ = handle.emit(
                                "agent:message",
                                AgentMessageEvent {
                                    session_id: sid.clone(),
                                    message_id: msg_id,
                                    role: "assistant".to_string(),
                                    content: current_content.clone(),
                                    tool_calls: enriched,
                                },
                            );
                        }
                    }

                    StreamEvent::User { message: user_msg, parent_tool_use_id } => {
                        // Parse content blocks from the raw JSON value
                        let blocks = user_msg.content.as_array().cloned().unwrap_or_default();

                        for block in &blocks {
                            let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                            if block_type != "tool_result" {
                                continue;
                            }

                            let tool_use_id = block.get("tool_use_id").and_then(|v| v.as_str()).unwrap_or("");
                            if tool_use_id.is_empty() {
                                continue;
                            }

                            let output_str = match block.get("content") {
                                Some(serde_json::Value::String(s)) => Some(s.clone()),
                                Some(v) if !v.is_null() => Some(v.to_string()),
                                _ => None,
                            };
                            let is_error = block.get("is_error").and_then(|v| v.as_bool()).unwrap_or(false);

                            if parent_tool_use_id.is_some() {
                                // Sub-agent tool result — update subagent tracking
                                subagent_tool_outputs.insert(
                                    tool_use_id.to_string(),
                                    (output_str.clone(), is_error),
                                );

                                // Update in-place in subagent_tool_calls
                                for (_parent_id, calls) in subagent_tool_calls.iter_mut() {
                                    for tc in calls.iter_mut() {
                                        if tc.tool_use_id.as_deref() == Some(tool_use_id) {
                                            tc.output = output_str.clone();
                                            tc.status = if is_error { "error".to_string() } else { "done".to_string() };
                                        }
                                    }
                                }
                            } else {
                                // Parent tool result
                                tool_outputs.insert(
                                    tool_use_id.to_string(),
                                    (output_str.clone(), is_error),
                                );

                                for tc in current_tool_calls.iter_mut() {
                                    if tc.tool_use_id.as_deref() == Some(tool_use_id) {
                                        tc.output = output_str.clone();
                                        tc.status = if is_error { "error".to_string() } else { "done".to_string() };
                                    }
                                }
                            }
                        }

                        // Emit updated state
                        if let Some(ref msg_id) = current_message_id {
                            let enriched = attach_subagent_calls(&current_tool_calls, &subagent_tool_calls);
                            let _ = handle.emit(
                                "agent:message",
                                AgentMessageEvent {
                                    session_id: sid.clone(),
                                    message_id: msg_id.clone(),
                                    role: "assistant".to_string(),
                                    content: current_content.clone(),
                                    tool_calls: enriched,
                                },
                            );
                        }
                    }

                    StreamEvent::ToolResult {
                        tool_use_id,
                        content,
                        is_error,
                        parent_tool_use_id,
                    } => {
                        let output_str = match &content {
                            Some(serde_json::Value::String(s)) => Some(s.clone()),
                            Some(v) => Some(v.to_string()),
                            None => None,
                        };

                        if parent_tool_use_id.is_some() {
                            // Sub-agent tool result
                            subagent_tool_outputs.insert(
                                tool_use_id.clone(),
                                (output_str.clone(), is_error),
                            );
                            for (_parent_id, calls) in subagent_tool_calls.iter_mut() {
                                for tc in calls.iter_mut() {
                                    if tc.tool_use_id.as_deref() == Some(&tool_use_id) {
                                        tc.output = output_str.clone();
                                        tc.status = if is_error { "error".to_string() } else { "done".to_string() };
                                    }
                                }
                            }
                        } else {
                            // Parent tool result
                            tool_outputs.insert(
                                tool_use_id.clone(),
                                (output_str.clone(), is_error),
                            );
                            for tc in current_tool_calls.iter_mut() {
                                if tc.tool_use_id.as_deref() == Some(&tool_use_id) {
                                    tc.output = output_str.clone();
                                    tc.status = if is_error { "error".to_string() } else { "done".to_string() };
                                }
                            }
                        }

                        // Emit updated state
                        if let Some(ref msg_id) = current_message_id {
                            let enriched = attach_subagent_calls(&current_tool_calls, &subagent_tool_calls);
                            let _ = handle.emit(
                                "agent:message",
                                AgentMessageEvent {
                                    session_id: sid.clone(),
                                    message_id: msg_id.clone(),
                                    role: "assistant".to_string(),
                                    content: current_content.clone(),
                                    tool_calls: enriched,
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
                        let dur = duration_ms.unwrap_or(0);
                        eprintln!(
                            "[openforge] Agent complete for session {sid}: \
                             cost=${final_cost:.4}, duration={dur}ms, claude_session_id={claude_sid:?}",
                        );

                        // Capture for DB persistence after stream ends
                        result_claude_sid = claude_sid.clone();
                        result_cost = final_cost;
                        _result_duration = dur;

                        let _ = handle.emit(
                            "agent:complete",
                            AgentCompleteEvent {
                                session_id: sid.clone(),
                                cost_usd: final_cost,
                                duration_ms: dur,
                                claude_session_id: claude_sid,
                            },
                        );
                    }
                }
            }

            // Stream ended — persist session metadata to DB
            eprintln!("[openforge] Agent stream ended for session {sid}");
            if let Ok(conn) = db.lock() {
                if let Some(ref claude_sid) = result_claude_sid {
                    if let Err(e) = queries::update_session_claude_id(&conn, &sid, claude_sid) {
                        eprintln!("[openforge] Failed to persist claude_session_id: {e}");
                    }
                }
                if result_cost > 0.0 {
                    if let Err(e) = queries::update_session_cost(&conn, &sid, result_cost, 0) {
                        eprintln!("[openforge] Failed to persist session cost: {e}");
                    }
                }
                if let Err(e) = queries::update_session_status(&conn, &sid, "idle") {
                    eprintln!("[openforge] Failed to update session status: {e}");
                }
            } else {
                eprintln!("[openforge] Failed to lock DB for session persistence");
            }

            // Emit idle status to frontend
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

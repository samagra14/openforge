use std::collections::HashMap;
use std::io::BufRead;
use std::process::{Child, Command, Stdio};
use std::sync::mpsc;
use std::thread;

use tauri::{AppHandle, Emitter};

use super::parsers::{self, ParsedEvent};
use super::provider;
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
        provider_id: String,
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

        let command = provider::get_command(&provider_id);

        let args = provider::build_args(
            &provider_id,
            &model,
            &prompt,
            resume_session_id.as_deref(),
        );

        eprintln!(
            "[openforge] Spawning {command} ({provider_id}) in {worktree_path} with args: {}",
            args.join(" ")
        );

        let mut child = Command::new(command)
            .args(&args)
            .current_dir(&worktree_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to spawn {command}: {e}"))?;

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
        let provider_id_stderr = provider_id.clone();
        thread::spawn(move || {
            let reader = std::io::BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(l) => eprintln!("[openforge][{provider_id_stderr} stderr][{sid_stderr}] {l}"),
                    Err(_) => break,
                }
            }
        });

        // Spawn unified stdout reader with provider-specific parser
        self.spawn_reader(sid, handle, stdout, kill_rx, &provider_id);

        self.processes.insert(
            session_id,
            AgentProcess {
                child: Some(child),
                kill_tx: Some(kill_tx),
            },
        );

        Ok(())
    }

    /// Unified reader that uses the provider-specific parser to process stdout.
    ///
    /// All agents go through this single reader loop. The `AgentParser` trait
    /// implementation handles the differences between output formats (Claude's
    /// NDJSON, Gemini's stream-json, Codex's JSONL, plain text, etc.).
    fn spawn_reader(
        &self,
        sid: String,
        handle: AppHandle,
        stdout: std::process::ChildStdout,
        kill_rx: mpsc::Receiver<()>,
        provider_id: &str,
    ) {
        let mut parser = parsers::create_parser(provider_id);
        let provider_id_owned = provider_id.to_string();

        thread::spawn(move || {
            let reader = std::io::BufReader::new(stdout);
            let start = std::time::Instant::now();
            let mut got_complete = false;

            for line_result in reader.lines() {
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

                let events = parser.parse_line(&line);
                for event in events {
                    match event {
                        ParsedEvent::Message {
                            message_id,
                            content,
                            tool_calls,
                        } => {
                            let _ = handle.emit(
                                "agent:message",
                                AgentMessageEvent {
                                    session_id: sid.clone(),
                                    message_id,
                                    role: "assistant".to_string(),
                                    content,
                                    tool_calls,
                                },
                            );
                        }
                        ParsedEvent::Complete {
                            cost_usd,
                            duration_ms,
                            session_id,
                        } => {
                            got_complete = true;
                            let final_duration = if duration_ms > 0 {
                                duration_ms
                            } else {
                                start.elapsed().as_millis() as u64
                            };

                            eprintln!(
                                "[openforge] Agent complete for session {sid} ({provider_id_owned}): \
                                 cost=${cost_usd:.4}, duration={final_duration}ms"
                            );

                            let _ = handle.emit(
                                "agent:complete",
                                AgentCompleteEvent {
                                    session_id: sid.clone(),
                                    cost_usd,
                                    duration_ms: final_duration,
                                    claude_session_id: session_id,
                                },
                            );
                        }
                    }
                }
            }

            // Let the parser emit any final events
            let final_events = parser.finish();
            for event in final_events {
                match event {
                    ParsedEvent::Message {
                        message_id,
                        content,
                        tool_calls,
                    } => {
                        let _ = handle.emit(
                            "agent:message",
                            AgentMessageEvent {
                                session_id: sid.clone(),
                                message_id,
                                role: "assistant".to_string(),
                                content,
                                tool_calls,
                            },
                        );
                    }
                    ParsedEvent::Complete {
                        cost_usd,
                        duration_ms,
                        session_id,
                    } => {
                        got_complete = true;
                        let _ = handle.emit(
                            "agent:complete",
                            AgentCompleteEvent {
                                session_id: sid.clone(),
                                cost_usd,
                                duration_ms,
                                claude_session_id: session_id,
                            },
                        );
                    }
                }
            }

            // If the parser didn't emit a complete event, emit one with elapsed time
            if !got_complete {
                let duration = start.elapsed().as_millis() as u64;
                eprintln!(
                    "[openforge] Agent complete for session {sid} ({provider_id_owned}): duration={duration}ms"
                );
                let _ = handle.emit(
                    "agent:complete",
                    AgentCompleteEvent {
                        session_id: sid.clone(),
                        cost_usd: 0.0,
                        duration_ms: duration,
                        claude_session_id: None,
                    },
                );
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
    }

    pub fn stop_agent(&mut self, session_id: &str) -> Result<(), String> {
        if let Some(mut process) = self.processes.remove(session_id) {
            // Send kill signal to the reader thread
            if let Some(tx) = process.kill_tx.take() {
                let _ = tx.send(());
            }
            // Kill the child process
            if let Some(ref mut child) = process.child {
                eprintln!("[openforge] Killing agent process for session {session_id}");
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

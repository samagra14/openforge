use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// A message parsed from Claude Code's session JSONL file, ready for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    pub tool_calls: Option<String>, // JSON-serialized
    pub timestamp: String,
}

/// Encode a working directory path the way Claude Code does for its project directories.
///
/// Claude replaces `/` and `.` with `-`. The leading `/` naturally becomes the initial `-`.
/// e.g. `/Users/foo/my.project/bar` → `-Users-foo-my-project-bar`
fn encode_cwd(worktree_path: &str) -> String {
    worktree_path.replace('/', "-").replace('.', "-")
}

/// Build the path to Claude Code's JSONL session file.
///
/// Claude stores sessions at:
///   ~/.claude/projects/{encoded_cwd}/{session_id}.jsonl
pub fn session_file_path(worktree_path: &str, claude_session_id: &str) -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join(".claude")
        .join("projects")
        .join(encode_cwd(worktree_path))
        .join(format!("{claude_session_id}.jsonl"))
}

/// Build the path to Claude Code's project directory for a given worktree.
fn project_dir_path(worktree_path: &str) -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    PathBuf::from(home)
        .join(".claude")
        .join("projects")
        .join(encode_cwd(worktree_path))
}

/// Discover the Claude session ID for a session by matching the first user message.
///
/// When `claude_session_id` is not stored in the DB (e.g. for sessions created before
/// the persistence feature), this scans Claude's JSONL files in the project directory
/// and matches by comparing the first user message content.
pub fn discover_session_id(worktree_path: &str, first_message_content: &str) -> Option<String> {
    let project_dir = project_dir_path(worktree_path);
    if !project_dir.is_dir() {
        return None;
    }

    let entries = std::fs::read_dir(&project_dir).ok()?;
    let needle = first_message_content.trim();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }

        // Read lines until we find the first "user" type message with text content
        let file = match File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let reader = BufReader::new(file);

        for line in reader.lines().flatten() {
            let obj: serde_json::Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let event_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
            if event_type != "user" {
                continue;
            }

            // Extract text content from the user message
            let content = obj.get("message").and_then(|m| m.get("content"));
            let text = content.and_then(|c| c.as_str()).map(|s| s.to_string());

            if let Some(text) = text {
                if text.trim() == needle {
                    return path
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .map(|s| s.to_string());
                }
            }
            // Only check the first user message per file
            break;
        }
    }

    None
}

/// Check if a user message's text content is an internal Claude Code command/system message
/// (e.g. /compact output, local-command caveats, system reminders) rather than
/// a real user-typed message.
fn is_internal_command_text(text: &str) -> bool {
    let trimmed = text.trim();
    // Messages containing these XML tags are internal Claude Code machinery
    trimmed.contains("<command-name>")
        || trimmed.contains("<local-command-caveat>")
        || trimmed.contains("<local-command-stdout>")
        || trimmed.contains("<command-message>")
        || trimmed.contains("<command-args>")
        || trimmed.contains("<system-reminder>")
        || trimmed.contains("<system-instruction>")
        || trimmed.contains("<system_instruction>")
}

/// Extract text content from a tool_result's content field.
///
/// Content can be:
///   - a plain string: `"some text"`
///   - an array of content blocks: `[{"type":"text","text":"..."},...]`
///   - null / missing
fn extract_tool_result_content(content: Option<&serde_json::Value>) -> String {
    match content {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Array(arr)) => {
            let mut parts: Vec<String> = Vec::new();
            for block in arr {
                if let Some(text) = block.get("text").and_then(|v| v.as_str()) {
                    parts.push(text.to_string());
                }
            }
            parts.join("\n")
        }
        _ => String::new(),
    }
}

/// Intermediate representation for accumulating assistant message blocks.
struct AssistantAccum {
    text_parts: Vec<String>,
    tool_calls: Vec<serde_json::Value>,
    timestamp: String,
}

/// Load sub-agent tool calls from the subagents directory.
///
/// Returns a map of description → Vec<tool_call> for matching against parent Agent calls.
fn load_subagent_tool_calls(
    worktree_path: &str,
    claude_session_id: &str,
) -> HashMap<String, Vec<serde_json::Value>> {
    let session_path = session_file_path(worktree_path, claude_session_id);
    let subagents_dir = session_path
        .parent()
        .unwrap_or(session_path.as_path())
        .join(claude_session_id)
        .join("subagents");

    let mut result: HashMap<String, Vec<serde_json::Value>> = HashMap::new();

    let entries = match std::fs::read_dir(&subagents_dir) {
        Ok(e) => e,
        Err(_) => return result,
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }

        // Read meta.json for this sub-agent
        let meta_path = path.with_extension("meta.json");
        let description = match std::fs::read_to_string(&meta_path) {
            Ok(meta_str) => {
                let meta: serde_json::Value = match serde_json::from_str(&meta_str) {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                meta.get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string()
            }
            Err(_) => continue,
        };

        if description.is_empty() {
            continue;
        }

        // Parse the sub-agent's JSONL to extract tool calls
        let file = match File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let reader = BufReader::new(file);

        let mut tool_calls: Vec<serde_json::Value> = Vec::new();
        let mut sub_tool_outputs: HashMap<String, String> = HashMap::new();

        for line in reader.lines().flatten() {
            let obj: serde_json::Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let event_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");

            match event_type {
                "user" => {
                    // Collect tool_result outputs
                    let content = obj.get("message").and_then(|m| m.get("content"));
                    if let Some(arr) = content.and_then(|c| c.as_array()) {
                        for block in arr {
                            if block.get("type").and_then(|v| v.as_str()) == Some("tool_result") {
                                if let Some(tool_use_id) = block.get("tool_use_id").and_then(|v| v.as_str()) {
                                    let output = extract_tool_result_content(block.get("content"));
                                    sub_tool_outputs.insert(tool_use_id.to_string(), output);
                                }
                            }
                        }
                    }
                }
                "assistant" => {
                    let content = obj.get("message").and_then(|m| m.get("content"));
                    if let Some(blocks) = content.and_then(|c| c.as_array()) {
                        for block in blocks {
                            if block.get("type").and_then(|v| v.as_str()) == Some("tool_use") {
                                let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                                let input = block.get("input").cloned().unwrap_or(serde_json::Value::Null);
                                let id = block.get("id").and_then(|v| v.as_str()).unwrap_or("");
                                tool_calls.push(serde_json::json!({
                                    "name": name,
                                    "input": input,
                                    "output": null,
                                    "status": "done",
                                    "tool_use_id": id,
                                }));
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        // Patch outputs into tool calls
        for tc in tool_calls.iter_mut() {
            if tc.get("output").map_or(false, |v| v.is_null()) {
                if let Some(tool_use_id) = tc.get("tool_use_id").and_then(|v| v.as_str()) {
                    if let Some(output) = sub_tool_outputs.get(tool_use_id) {
                        tc["output"] = serde_json::Value::String(output.clone());
                    }
                }
            }
        }

        result.insert(description, tool_calls);
    }

    result
}

/// Load conversation history from a Claude Code session JSONL file.
///
/// Claude Code's JSONL format uses **incremental** events: each line for the same
/// assistant `message.id` contains a single new content block (thinking, text, or
/// tool_use). This parser accumulates all blocks per message.id and collects
/// tool_result outputs to attach back to their corresponding tool_use entries.
pub fn load_history(worktree_path: &str, claude_session_id: &str) -> Result<Vec<HistoryMessage>, String> {
    let path = session_file_path(worktree_path, claude_session_id);

    let file = File::open(&path).map_err(|e| {
        format!("Could not open session file {}: {e}", path.display())
    })?;
    let reader = BufReader::new(file);

    // Ordered list of (role, key) entries preserving the conversation order.
    // key is either the uuid (for user messages) or the message.id (for assistant turns).
    let mut order: Vec<(String, String)> = Vec::new();

    // User messages keyed by uuid
    let mut user_messages: HashMap<String, HistoryMessage> = HashMap::new();

    // Assistant turns keyed by message.id — blocks are accumulated across events
    let mut assistant_turns: HashMap<String, AssistantAccum> = HashMap::new();

    // Tool results keyed by tool_use_id
    let mut tool_outputs: HashMap<String, String> = HashMap::new();

    for line_result in reader.lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(_) => continue,
        };

        let obj: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let event_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let timestamp = obj.get("timestamp").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let uuid = obj.get("uuid").and_then(|v| v.as_str()).unwrap_or("").to_string();

        match event_type {
            "user" => {
                let message = match obj.get("message") {
                    Some(m) => m,
                    None => continue,
                };
                let content = &message["content"];

                if let Some(text) = content.as_str() {
                    if !text.is_empty() && !is_internal_command_text(text) {
                        order.push(("user".into(), uuid.clone()));
                        user_messages.insert(uuid.clone(), HistoryMessage {
                            id: uuid,
                            role: "user".to_string(),
                            content: text.to_string(),
                            tool_calls: None,
                            timestamp,
                        });
                    }
                } else if let Some(arr) = content.as_array() {
                    let mut text_parts: Vec<String> = Vec::new();
                    for block in arr {
                        let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                        match block_type {
                            "text" => {
                                if let Some(t) = block.get("text").and_then(|v| v.as_str()) {
                                    text_parts.push(t.to_string());
                                }
                            }
                            "tool_result" => {
                                if let Some(tool_use_id) = block.get("tool_use_id").and_then(|v| v.as_str()) {
                                    let output = extract_tool_result_content(block.get("content"));
                                    tool_outputs.insert(tool_use_id.to_string(), output);
                                }
                            }
                            _ => {}
                        }
                    }
                    let joined = text_parts.join("\n");
                    if !joined.is_empty() && !is_internal_command_text(&joined) {
                        order.push(("user".into(), uuid.clone()));
                        user_messages.insert(uuid.clone(), HistoryMessage {
                            id: uuid,
                            role: "user".to_string(),
                            content: joined,
                            tool_calls: None,
                            timestamp,
                        });
                    }
                }
            }
            "assistant" => {
                let message = match obj.get("message") {
                    Some(m) => m,
                    None => continue,
                };

                let msg_id = message.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                let key = if msg_id.is_empty() { uuid.clone() } else { msg_id };

                let content_blocks = match message.get("content").and_then(|v| v.as_array()) {
                    Some(arr) => arr,
                    None => continue,
                };

                let accum = assistant_turns.entry(key.clone()).or_insert_with(|| {
                    // First time seeing this message.id — add to ordering
                    order.push(("assistant".into(), key.clone()));
                    AssistantAccum {
                        text_parts: Vec::new(),
                        tool_calls: Vec::new(),
                        timestamp: timestamp.clone(),
                    }
                });

                // Accumulate new blocks from this incremental event
                for block in content_blocks {
                    let block_type = block.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    match block_type {
                        "text" => {
                            if let Some(t) = block.get("text").and_then(|v| v.as_str()) {
                                accum.text_parts.push(t.to_string());
                            }
                        }
                        "thinking" => {
                            // Skip thinking blocks — they're internal reasoning
                        }
                        "tool_use" => {
                            let name = block.get("name").and_then(|v| v.as_str()).unwrap_or("unknown");
                            let input = block.get("input").cloned().unwrap_or(serde_json::Value::Null);
                            let id = block.get("id").and_then(|v| v.as_str()).unwrap_or("");
                            accum.tool_calls.push(serde_json::json!({
                                "name": name,
                                "input": input,
                                "output": null,
                                "status": "done",
                                "tool_use_id": id,
                            }));
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }

    // Load sub-agent tool calls for Agent tool_use entries
    let subagent_data = load_subagent_tool_calls(worktree_path, claude_session_id);

    // Build final messages in conversation order, patching tool outputs
    let mut messages: Vec<HistoryMessage> = Vec::new();

    for (role, key) in &order {
        match role.as_str() {
            "user" => {
                if let Some(msg) = user_messages.remove(key) {
                    messages.push(msg);
                }
            }
            "assistant" => {
                if let Some(accum) = assistant_turns.remove(key) {
                    // Patch tool outputs and attach sub-agent data
                    let mut tool_calls = accum.tool_calls;
                    for tc in tool_calls.iter_mut() {
                        if tc.get("output").map_or(false, |v| v.is_null()) {
                            if let Some(tool_use_id) = tc.get("tool_use_id").and_then(|v| v.as_str()) {
                                if let Some(output) = tool_outputs.get(tool_use_id) {
                                    tc["output"] = serde_json::Value::String(output.clone());
                                }
                            }
                        }

                        // Attach sub-agent tool calls for Agent tool_use entries
                        if tc.get("name").and_then(|v| v.as_str()) == Some("Agent") {
                            let description = tc.get("input")
                                .and_then(|i| i.get("description"))
                                .and_then(|d| d.as_str())
                                .unwrap_or("");
                            if let Some(sub_calls) = subagent_data.get(description) {
                                tc["sub_tool_calls"] = serde_json::Value::Array(sub_calls.clone());
                            }
                        }
                    }

                    let content = accum.text_parts.join("\n\n");
                    let tool_calls_json = if tool_calls.is_empty() {
                        None
                    } else {
                        Some(serde_json::to_string(&tool_calls).unwrap_or_default())
                    };

                    messages.push(HistoryMessage {
                        id: key.clone(),
                        role: "assistant".to_string(),
                        content,
                        tool_calls: tool_calls_json,
                        timestamp: accum.timestamp,
                    });
                }
            }
            _ => {}
        }
    }

    Ok(messages)
}

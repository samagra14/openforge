//! Parser for OpenAI Codex CLI's `--json` JSONL output.
//!
//! Codex CLI (`codex exec --json`) streams newline-delimited JSON events
//! following the OpenAI Responses API format:
//!
//!   {"type":"message.output_text.delta","delta":"partial text..."}
//!   {"type":"message.output_text.done","text":"full text"}
//!   {"type":"response.function_call_arguments.delta","name":"shell","call_id":"...","delta":"partial args"}
//!   {"type":"response.function_call_arguments.done","name":"shell","call_id":"...","arguments":"{...}"}
//!   {"type":"response.output_item.done","item":{"type":"function_call_output","call_id":"...","output":"..."}}
//!   {"type":"response.completed","response":{"usage":{"input_tokens":N,"output_tokens":N}}}

use serde::Deserialize;
use std::collections::HashMap;

use super::{AgentParser, ParsedEvent};
use crate::agent::types::ToolCallInfo;

// ── Codex JSONL event (flexible deserialization) ───────────────

#[derive(Debug, Deserialize)]
struct CodexEvent {
    #[serde(rename = "type")]
    event_type: String,

    // Text events
    #[serde(default)]
    delta: Option<serde_json::Value>,
    #[serde(default)]
    text: Option<String>,

    // Function call events
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    call_id: Option<String>,
    #[serde(default)]
    arguments: Option<String>,

    // Output item events
    #[serde(default)]
    item: Option<CodexItem>,

    // Completion events
    #[serde(default)]
    response: Option<CodexResponse>,
}

#[derive(Debug, Deserialize)]
struct CodexItem {
    #[serde(rename = "type")]
    item_type: Option<String>,
    #[serde(default)]
    call_id: Option<String>,
    #[serde(default)]
    output: Option<String>,
    #[serde(default)]
    content: Option<Vec<CodexContentPart>>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CodexContentPart {
    #[serde(rename = "type")]
    part_type: Option<String>,
    #[serde(default)]
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CodexResponse {
    #[serde(default)]
    usage: Option<CodexUsage>,
}

#[derive(Debug, Deserialize)]
struct CodexUsage {
    #[serde(default)]
    input_tokens: Option<u64>,
    #[serde(default)]
    output_tokens: Option<u64>,
    #[serde(default)]
    total_tokens: Option<u64>,
}

// ── Parser state ───────────────────────────────────────────────

pub struct CodexParser {
    message_id: String,
    content: String,
    tool_calls: Vec<ToolCallInfo>,
    /// call_id → index in tool_calls
    call_index: HashMap<String, usize>,
    /// Accumulates partial function call arguments
    partial_args: HashMap<String, String>,
}

impl CodexParser {
    pub fn new() -> Self {
        Self {
            message_id: uuid::Uuid::new_v4().to_string(),
            content: String::new(),
            tool_calls: Vec::new(),
            call_index: HashMap::new(),
            partial_args: HashMap::new(),
        }
    }

    fn emit_snapshot(&self) -> ParsedEvent {
        ParsedEvent::Message {
            message_id: self.message_id.clone(),
            content: self.content.clone(),
            tool_calls: self.tool_calls.clone(),
        }
    }
}

impl AgentParser for CodexParser {
    fn parse_line(&mut self, line: &str) -> Vec<ParsedEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() || !trimmed.starts_with('{') {
            return vec![];
        }

        let event: CodexEvent = match serde_json::from_str(trimmed) {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[openforge][codex] Failed to parse: {e}");
                if !self.content.is_empty() {
                    self.content.push('\n');
                }
                self.content.push_str(trimmed);
                return vec![self.emit_snapshot()];
            }
        };

        let t = event.event_type.as_str();

        match t {
            // ── Text streaming ──
            "message.output_text.delta" => {
                if let Some(serde_json::Value::String(delta)) = &event.delta {
                    self.content.push_str(delta);
                }
                vec![self.emit_snapshot()]
            }
            "message.output_text.done" => {
                if let Some(text) = &event.text {
                    self.content = text.clone();
                }
                vec![self.emit_snapshot()]
            }

            // ── Function call streaming ──
            "response.function_call_arguments.delta" => {
                if let Some(call_id) = &event.call_id {
                    let entry = self.partial_args.entry(call_id.clone()).or_default();
                    if let Some(serde_json::Value::String(delta)) = &event.delta {
                        entry.push_str(delta);
                    }

                    // Create or update the tool call entry
                    if !self.call_index.contains_key(call_id) {
                        let idx = self.tool_calls.len();
                        self.call_index.insert(call_id.clone(), idx);
                        self.tool_calls.push(ToolCallInfo {
                            name: event.name.unwrap_or_else(|| "function".to_string()),
                            input: serde_json::Value::Object(serde_json::Map::new()),
                            output: None,
                            status: "running".to_string(),
                            tool_use_id: Some(call_id.clone()),
                        });
                    }
                }
                vec![self.emit_snapshot()]
            }
            "response.function_call_arguments.done" => {
                if let Some(call_id) = &event.call_id {
                    let parsed_args: serde_json::Value = event
                        .arguments
                        .as_ref()
                        .and_then(|a| serde_json::from_str(a).ok())
                        .unwrap_or(serde_json::Value::Null);

                    if let Some(&idx) = self.call_index.get(call_id) {
                        if let Some(tc) = self.tool_calls.get_mut(idx) {
                            tc.input = parsed_args;
                            if let Some(name) = &event.name {
                                tc.name = name.clone();
                            }
                        }
                    } else {
                        let idx = self.tool_calls.len();
                        self.call_index.insert(call_id.clone(), idx);
                        self.tool_calls.push(ToolCallInfo {
                            name: event.name.unwrap_or_else(|| "function".to_string()),
                            input: parsed_args,
                            output: None,
                            status: "running".to_string(),
                            tool_use_id: Some(call_id.clone()),
                        });
                    }
                    self.partial_args.remove(call_id);
                }
                vec![self.emit_snapshot()]
            }

            // ── Output items (function results, messages) ──
            "response.output_item.done" => {
                if let Some(item) = &event.item {
                    match item.item_type.as_deref() {
                        Some("function_call_output") => {
                            if let Some(call_id) = &item.call_id {
                                if let Some(&idx) = self.call_index.get(call_id) {
                                    if let Some(tc) = self.tool_calls.get_mut(idx) {
                                        tc.output = item.output.clone();
                                        tc.status = "done".to_string();
                                    }
                                }
                            }
                        }
                        Some("function_call") => {
                            if let Some(call_id) = &item.call_id {
                                let parsed_args: serde_json::Value = item
                                    .arguments
                                    .as_ref()
                                    .and_then(|a| serde_json::from_str(a).ok())
                                    .unwrap_or(serde_json::Value::Null);

                                if let Some(&idx) = self.call_index.get(call_id) {
                                    if let Some(tc) = self.tool_calls.get_mut(idx) {
                                        tc.input = parsed_args;
                                        if let Some(name) = &item.name {
                                            tc.name = name.clone();
                                        }
                                    }
                                } else {
                                    let idx = self.tool_calls.len();
                                    self.call_index.insert(call_id.clone(), idx);
                                    self.tool_calls.push(ToolCallInfo {
                                        name: item
                                            .name
                                            .clone()
                                            .unwrap_or_else(|| "function".to_string()),
                                        input: parsed_args,
                                        output: None,
                                        status: "running".to_string(),
                                        tool_use_id: Some(call_id.clone()),
                                    });
                                }
                            }
                        }
                        Some("message") => {
                            if let Some(content_parts) = &item.content {
                                for part in content_parts {
                                    if part.part_type.as_deref() == Some("output_text") {
                                        if let Some(text) = &part.text {
                                            self.content = text.clone();
                                        }
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
                vec![self.emit_snapshot()]
            }

            // ── Completion ──
            "response.completed" => {
                let mut events = vec![self.emit_snapshot()];
                events.push(ParsedEvent::Complete {
                    cost_usd: 0.0, // Codex doesn't report cost in stream
                    duration_ms: 0,
                    session_id: None,
                });
                events
            }

            // Ignore unknown event types
            _ => {
                eprintln!("[openforge][codex] Skipping event type: {t}");
                vec![]
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_delta() {
        let mut parser = CodexParser::new();
        let events =
            parser.parse_line(r#"{"type":"message.output_text.delta","delta":"Hello "}"#);
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message { content, .. } => assert_eq!(content, "Hello "),
            _ => panic!("Expected Message"),
        }

        let events =
            parser.parse_line(r#"{"type":"message.output_text.delta","delta":"world!"}"#);
        match &events[0] {
            ParsedEvent::Message { content, .. } => assert_eq!(content, "Hello world!"),
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_function_call_flow() {
        let mut parser = CodexParser::new();

        // Function call start
        parser.parse_line(
            r#"{"type":"response.function_call_arguments.delta","name":"shell","call_id":"call_1","delta":"{\"command\":"}"#,
        );
        parser.parse_line(
            r#"{"type":"response.function_call_arguments.done","name":"shell","call_id":"call_1","arguments":"{\"command\":\"ls\"}"}"#,
        );

        // Function output
        let events = parser.parse_line(
            r#"{"type":"response.output_item.done","item":{"type":"function_call_output","call_id":"call_1","output":"file1.rs\nfile2.rs"}}"#,
        );

        match &events[0] {
            ParsedEvent::Message { tool_calls, .. } => {
                assert_eq!(tool_calls.len(), 1);
                assert_eq!(tool_calls[0].name, "shell");
                assert_eq!(tool_calls[0].status, "done");
                assert_eq!(
                    tool_calls[0].output.as_deref(),
                    Some("file1.rs\nfile2.rs")
                );
            }
            _ => panic!("Expected Message"),
        }
    }
}

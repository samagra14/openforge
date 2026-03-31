//! Parser for Goose's `--output-format stream-json` NDJSON format.
//!
//! Goose (Block/Square) outputs streaming JSON events:
//!
//!   {"type":"message","role":"assistant","content":"partial text..."}
//!   {"type":"tool_use","id":"...","name":"developer__shell","input":{"command":"ls"}}
//!   {"type":"tool_result","id":"...","content":"output...","is_error":false}
//!   {"type":"finish","usage":{"input_tokens":N,"output_tokens":N},"cost":N}

use serde::Deserialize;
use std::collections::HashMap;

use super::{AgentParser, ParsedEvent};
use crate::agent::types::ToolCallInfo;

// ── Goose event types ──────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GooseEvent {
    #[serde(rename = "type")]
    event_type: String,

    // Message fields
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    content: Option<serde_json::Value>,

    // Tool use fields
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    input: Option<serde_json::Value>,

    // Tool result fields
    #[serde(default)]
    is_error: Option<bool>,

    // Completion fields
    #[serde(default)]
    usage: Option<GooseUsage>,
    #[serde(default)]
    cost: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct GooseUsage {
    #[serde(default)]
    input_tokens: Option<u64>,
    #[serde(default)]
    output_tokens: Option<u64>,
}

// ── Parser state ───────────────────────────────────────────────

pub struct GooseParser {
    message_id: String,
    content: String,
    tool_calls: Vec<ToolCallInfo>,
    /// tool_use_id → index in tool_calls
    call_index: HashMap<String, usize>,
    call_counter: u32,
}

impl GooseParser {
    pub fn new() -> Self {
        Self {
            message_id: uuid::Uuid::new_v4().to_string(),
            content: String::new(),
            tool_calls: Vec::new(),
            call_index: HashMap::new(),
            call_counter: 0,
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

impl AgentParser for GooseParser {
    fn parse_line(&mut self, line: &str) -> Vec<ParsedEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() || !trimmed.starts_with('{') {
            return vec![];
        }

        let event: GooseEvent = match serde_json::from_str(trimmed) {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[openforge][goose] Failed to parse: {e}");
                if !self.content.is_empty() {
                    self.content.push('\n');
                }
                self.content.push_str(trimmed);
                return vec![self.emit_snapshot()];
            }
        };

        match event.event_type.as_str() {
            "message" => {
                if event.role.as_deref() == Some("assistant") {
                    match &event.content {
                        Some(serde_json::Value::String(s)) => {
                            self.content = s.clone();
                        }
                        Some(serde_json::Value::Array(parts)) => {
                            // Content may be an array of blocks
                            let mut text = String::new();
                            for part in parts {
                                if let Some(t) = part.get("text").and_then(|v| v.as_str()) {
                                    text.push_str(t);
                                }
                            }
                            if !text.is_empty() {
                                self.content = text;
                            }
                        }
                        _ => {}
                    }
                }
                vec![self.emit_snapshot()]
            }

            "tool_use" => {
                self.call_counter += 1;
                let call_id = event
                    .id
                    .clone()
                    .unwrap_or_else(|| format!("goose_call_{}", self.call_counter));

                let idx = self.tool_calls.len();
                self.call_index.insert(call_id.clone(), idx);

                self.tool_calls.push(ToolCallInfo {
                    name: event.name.unwrap_or_else(|| "tool".to_string()),
                    input: event.input.unwrap_or(serde_json::Value::Null),
                    output: None,
                    status: "running".to_string(),
                    tool_use_id: Some(call_id),
                });
                vec![self.emit_snapshot()]
            }

            "tool_result" => {
                if let Some(call_id) = &event.id {
                    if let Some(&idx) = self.call_index.get(call_id) {
                        if let Some(tc) = self.tool_calls.get_mut(idx) {
                            tc.output = event.content.map(|v| match v {
                                serde_json::Value::String(s) => s,
                                other => other.to_string(),
                            });
                            tc.status = if event.is_error.unwrap_or(false) {
                                "error".to_string()
                            } else {
                                "done".to_string()
                            };
                        }
                    }
                }
                vec![self.emit_snapshot()]
            }

            "finish" | "done" | "complete" => {
                let mut events = vec![self.emit_snapshot()];
                events.push(ParsedEvent::Complete {
                    cost_usd: event.cost.unwrap_or(0.0),
                    duration_ms: 0,
                    session_id: None,
                });
                events
            }

            _ => {
                eprintln!(
                    "[openforge][goose] Skipping event type: {}",
                    event.event_type
                );
                vec![]
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_event() {
        let mut parser = GooseParser::new();
        let events = parser
            .parse_line(r#"{"type":"message","role":"assistant","content":"Hello from Goose"}"#);
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message { content, .. } => assert_eq!(content, "Hello from Goose"),
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_tool_flow() {
        let mut parser = GooseParser::new();

        parser.parse_line(
            r#"{"type":"tool_use","id":"t1","name":"developer__shell","input":{"command":"ls"}}"#,
        );

        let events = parser.parse_line(
            r#"{"type":"tool_result","id":"t1","content":"main.rs\nlib.rs","is_error":false}"#,
        );
        match &events[0] {
            ParsedEvent::Message { tool_calls, .. } => {
                assert_eq!(tool_calls.len(), 1);
                assert_eq!(tool_calls[0].name, "developer__shell");
                assert_eq!(tool_calls[0].status, "done");
            }
            _ => panic!("Expected Message"),
        }
    }
}

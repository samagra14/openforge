//! Generic JSON parser for agents with structured output but less-documented formats.
//!
//! Used for: GitHub Copilot, Kilo, Augment, OpenCode, Kiro, Cline, GO-CODE.
//!
//! This parser heuristically extracts text content and tool calls from any
//! JSON structure by looking for common field naming patterns across agent CLIs.
//! It gracefully falls back to treating lines as plain text when JSON parsing fails.

use std::collections::HashMap;

use super::{AgentParser, ParsedEvent};
use crate::agent::types::ToolCallInfo;

pub struct GenericJsonParser {
    message_id: String,
    content: String,
    tool_calls: Vec<ToolCallInfo>,
    /// Flexible index: any string key (id, call_id, name) → index in tool_calls
    call_index: HashMap<String, usize>,
    call_counter: u32,
}

impl GenericJsonParser {
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

    /// Try to extract text content from a JSON value.
    fn extract_text(obj: &serde_json::Value) -> Option<String> {
        // Direct string fields commonly used for content
        for key in &[
            "content", "text", "message", "response", "output", "delta",
            "result", "data",
        ] {
            match obj.get(key) {
                Some(serde_json::Value::String(s)) if !s.is_empty() => {
                    return Some(s.clone());
                }
                Some(serde_json::Value::Array(arr)) => {
                    // Array of content blocks (common pattern)
                    let mut text = String::new();
                    for item in arr {
                        if let Some(t) = item.get("text").and_then(|v| v.as_str()) {
                            text.push_str(t);
                        }
                    }
                    if !text.is_empty() {
                        return Some(text);
                    }
                }
                _ => {}
            }
        }

        // Nested: obj.data.text, obj.message.content, obj.params.content
        for wrapper in &["data", "message", "params"] {
            if let Some(inner) = obj.get(wrapper) {
                if let Some(text) = Self::extract_text(inner) {
                    return Some(text);
                }
            }
        }

        None
    }

    /// Try to detect if this JSON event represents a tool call.
    fn extract_tool_call(obj: &serde_json::Value) -> Option<(String, String, serde_json::Value)> {
        let event_type = obj
            .get("type")
            .or_else(|| obj.get("method"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let is_tool = event_type.contains("tool_use")
            || event_type.contains("tool_call")
            || event_type.contains("function_call")
            || event_type.contains("functionCall")
            || event_type == "action";

        if !is_tool {
            return None;
        }

        // Extract from either top-level or nested in data/params/item
        let source = obj
            .get("data")
            .or_else(|| obj.get("params"))
            .or_else(|| obj.get("item"))
            .unwrap_or(obj);

        let name = source
            .get("name")
            .or_else(|| source.get("function"))
            .and_then(|v| v.as_str())
            .unwrap_or("tool")
            .to_string();

        let id = source
            .get("id")
            .or_else(|| source.get("call_id"))
            .or_else(|| source.get("tool_use_id"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let input = source
            .get("input")
            .or_else(|| source.get("args"))
            .cloned()
            .or_else(|| {
                // "arguments" might be a JSON-encoded string
                source.get("arguments").and_then(|v| match v {
                    serde_json::Value::String(s) => {
                        serde_json::from_str::<serde_json::Value>(s).ok()
                    }
                    other => Some(other.clone()),
                })
            })
            .unwrap_or(serde_json::Value::Null);

        Some((id, name, input))
    }

    /// Try to detect if this JSON event represents a tool result.
    fn extract_tool_result(obj: &serde_json::Value) -> Option<(String, String, bool)> {
        let event_type = obj
            .get("type")
            .or_else(|| obj.get("method"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let is_result = event_type.contains("tool_result")
            || event_type.contains("function_response")
            || event_type.contains("functionResponse")
            || event_type.contains("function_call_output");

        if !is_result {
            return None;
        }

        let source = obj
            .get("data")
            .or_else(|| obj.get("params"))
            .or_else(|| obj.get("item"))
            .unwrap_or(obj);

        let id = source
            .get("id")
            .or_else(|| source.get("call_id"))
            .or_else(|| source.get("tool_use_id"))
            .or_else(|| source.get("name")) // fallback to name matching
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let output = source
            .get("output")
            .or_else(|| source.get("content"))
            .or_else(|| source.get("response"))
            .or_else(|| source.get("result"))
            .map(|v| match v {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            })
            .unwrap_or_default();

        let is_error = source
            .get("is_error")
            .or_else(|| source.get("error"))
            .and_then(|v| v.as_bool())
            .unwrap_or(false);

        Some((id, output, is_error))
    }

    /// Check if this event signals completion.
    fn is_completion(obj: &serde_json::Value) -> Option<f64> {
        let event_type = obj
            .get("type")
            .or_else(|| obj.get("method"))
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let is_done = event_type.contains("result")
            || event_type.contains("finish")
            || event_type.contains("done")
            || event_type.contains("complete")
            || event_type.contains("end");

        // Don't match tool_result as completion
        if event_type.contains("tool") || event_type.contains("function") {
            return None;
        }

        if !is_done {
            return None;
        }

        let cost = obj
            .get("cost")
            .or_else(|| obj.get("cost_usd"))
            .or_else(|| obj.get("total_cost_usd"))
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);

        Some(cost)
    }
}

impl AgentParser for GenericJsonParser {
    fn parse_line(&mut self, line: &str) -> Vec<ParsedEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            return vec![];
        }

        // Try to parse as JSON
        if !trimmed.starts_with('{') && !trimmed.starts_with('[') {
            // Not JSON — treat as plain text
            if !self.content.is_empty() {
                self.content.push('\n');
            }
            self.content.push_str(trimmed);
            return vec![self.emit_snapshot()];
        }

        let obj: serde_json::Value = match serde_json::from_str(trimmed) {
            Ok(v) => v,
            Err(_) => {
                // Invalid JSON — treat as plain text
                if !self.content.is_empty() {
                    self.content.push('\n');
                }
                self.content.push_str(trimmed);
                return vec![self.emit_snapshot()];
            }
        };

        // Check for completion first
        if let Some(cost) = Self::is_completion(&obj) {
            return vec![
                self.emit_snapshot(),
                ParsedEvent::Complete {
                    cost_usd: cost,
                    duration_ms: 0,
                    session_id: None,
                },
            ];
        }

        // Check for tool result
        if let Some((id, output, is_error)) = Self::extract_tool_result(&obj) {
            if let Some(&idx) = self.call_index.get(&id) {
                if let Some(tc) = self.tool_calls.get_mut(idx) {
                    tc.output = Some(output);
                    tc.status = if is_error {
                        "error".to_string()
                    } else {
                        "done".to_string()
                    };
                }
            }
            return vec![self.emit_snapshot()];
        }

        // Check for tool call
        if let Some((id, name, input)) = Self::extract_tool_call(&obj) {
            self.call_counter += 1;
            let call_id = if id.is_empty() {
                format!("generic_call_{}", self.call_counter)
            } else {
                id
            };

            let idx = self.tool_calls.len();
            self.call_index.insert(call_id.clone(), idx);
            // Also index by name
            self.call_index.insert(name.clone(), idx);

            self.tool_calls.push(ToolCallInfo {
                name,
                input,
                output: None,
                status: "running".to_string(),
                tool_use_id: Some(call_id),
            });
            return vec![self.emit_snapshot()];
        }

        // Try to extract text content
        if let Some(text) = Self::extract_text(&obj) {
            // Determine if this is cumulative (replace) or incremental (append)
            // Heuristic: if the event type contains "delta" or "partial", append
            let event_type = obj
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if event_type.contains("delta") || event_type.contains("partial") {
                self.content.push_str(&text);
            } else {
                self.content = text;
            }
            return vec![self.emit_snapshot()];
        }

        // Nothing we could extract — skip silently
        eprintln!(
            "[openforge][generic] Skipping unrecognized JSON event: {}",
            &trimmed[..trimmed.len().min(200)]
        );
        vec![]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_text_extraction() {
        let mut parser = GenericJsonParser::new();
        let events = parser
            .parse_line(r#"{"type":"message","content":"Hello from agent"}"#);
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message { content, .. } => assert_eq!(content, "Hello from agent"),
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_tool_call_extraction() {
        let mut parser = GenericJsonParser::new();

        // Tool call
        parser.parse_line(
            r#"{"type":"tool_call","id":"tc1","name":"read_file","input":{"path":"main.rs"}}"#,
        );

        // Tool result
        let events = parser.parse_line(
            r#"{"type":"tool_result","id":"tc1","output":"fn main() {}","is_error":false}"#,
        );
        match &events[0] {
            ParsedEvent::Message { tool_calls, .. } => {
                assert_eq!(tool_calls.len(), 1);
                assert_eq!(tool_calls[0].name, "read_file");
                assert_eq!(tool_calls[0].status, "done");
            }
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_plain_text_fallback() {
        let mut parser = GenericJsonParser::new();
        let events = parser.parse_line("This is not JSON");
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message { content, .. } => assert_eq!(content, "This is not JSON"),
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_nested_content() {
        let mut parser = GenericJsonParser::new();
        let events = parser.parse_line(
            r#"{"type":"response","data":{"text":"Nested content here"}}"#,
        );
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message { content, .. } => {
                assert_eq!(content, "Nested content here");
            }
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_completion_detection() {
        let mut parser = GenericJsonParser::new();
        let events = parser.parse_line(r#"{"type":"finish","cost":0.01}"#);
        assert_eq!(events.len(), 2);
        match &events[1] {
            ParsedEvent::Complete { cost_usd, .. } => {
                assert!((cost_usd - 0.01).abs() < f64::EPSILON);
            }
            _ => panic!("Expected Complete"),
        }
    }
}

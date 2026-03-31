//! Parser for Gemini CLI's `--output-format stream-json` NDJSON format.
//!
//! Gemini CLI (google-gemini/gemini-cli) outputs newline-delimited JSON events:
//!
//!   {"type":"partialResponse","data":{"text":"..."}}
//!   {"type":"functionCall","data":{"name":"readFile","args":{"path":"..."}}}
//!   {"type":"functionResponse","data":{"name":"readFile","response":"..."}}
//!   {"type":"response","data":{"text":"...","tokenCount":{"input":N,"output":N},"cost":N}}
//!   {"type":"error","data":{"message":"..."}}

use serde::Deserialize;
use std::collections::HashMap;

use super::{AgentParser, ParsedEvent};
use crate::agent::types::ToolCallInfo;

// ── Gemini NDJSON event types ──────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "data")]
enum GeminiEvent {
    #[serde(rename = "partialResponse")]
    PartialResponse(GeminiPartialResponse),

    #[serde(rename = "functionCall")]
    FunctionCall(GeminiFunctionCall),

    #[serde(rename = "functionResponse")]
    FunctionResponse(GeminiFunctionResponse),

    #[serde(rename = "response")]
    Response(GeminiResponse),

    #[serde(rename = "error")]
    Error(GeminiError),
}

#[derive(Debug, Deserialize)]
struct GeminiPartialResponse {
    text: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiFunctionCall {
    #[serde(default)]
    id: Option<String>,
    name: String,
    #[serde(default)]
    args: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct GeminiFunctionResponse {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    response: Option<serde_json::Value>,
    #[serde(default)]
    is_error: bool,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    text: Option<String>,
    #[serde(rename = "tokenCount")]
    token_count: Option<GeminiTokenCount>,
    cost: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct GeminiTokenCount {
    input: Option<u64>,
    output: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct GeminiError {
    message: Option<String>,
}

// ── Parser state ───────────────────────────────────────────────

pub struct GeminiParser {
    message_id: String,
    content: String,
    tool_calls: Vec<ToolCallInfo>,
    /// Map from tool call id/name → index in tool_calls
    tool_call_index: HashMap<String, usize>,
    call_counter: u32,
}

impl GeminiParser {
    pub fn new() -> Self {
        Self {
            message_id: uuid::Uuid::new_v4().to_string(),
            content: String::new(),
            tool_calls: Vec::new(),
            tool_call_index: HashMap::new(),
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

impl AgentParser for GeminiParser {
    fn parse_line(&mut self, line: &str) -> Vec<ParsedEvent> {
        let trimmed = line.trim();
        if trimmed.is_empty() || !trimmed.starts_with('{') {
            return vec![];
        }

        let event: GeminiEvent = match serde_json::from_str(trimmed) {
            Ok(e) => e,
            Err(e) => {
                eprintln!("[openforge][gemini] Failed to parse: {e}");
                // Treat as plain text
                if !self.content.is_empty() {
                    self.content.push('\n');
                }
                self.content.push_str(trimmed);
                return vec![self.emit_snapshot()];
            }
        };

        match event {
            GeminiEvent::PartialResponse(pr) => {
                if let Some(text) = pr.text {
                    self.content = text;
                }
                vec![self.emit_snapshot()]
            }

            GeminiEvent::FunctionCall(fc) => {
                self.call_counter += 1;
                let call_id = fc
                    .id
                    .clone()
                    .unwrap_or_else(|| format!("gemini_call_{}", self.call_counter));

                let idx = self.tool_calls.len();
                self.tool_call_index.insert(call_id.clone(), idx);

                // Also index by name for functionResponse matching
                if let Some(ref id) = fc.id {
                    self.tool_call_index.insert(id.clone(), idx);
                }
                self.tool_call_index.insert(fc.name.clone(), idx);

                self.tool_calls.push(ToolCallInfo {
                    name: fc.name,
                    input: fc.args,
                    output: None,
                    status: "running".to_string(),
                    tool_use_id: Some(call_id),
                });
                vec![self.emit_snapshot()]
            }

            GeminiEvent::FunctionResponse(fr) => {
                let key = fr
                    .id
                    .as_ref()
                    .or(fr.name.as_ref())
                    .cloned()
                    .unwrap_or_default();

                if let Some(&idx) = self.tool_call_index.get(&key) {
                    if let Some(tc) = self.tool_calls.get_mut(idx) {
                        tc.output = fr.response.map(|v| match v {
                            serde_json::Value::String(s) => s,
                            other => other.to_string(),
                        });
                        tc.status = if fr.is_error {
                            "error".to_string()
                        } else {
                            "done".to_string()
                        };
                    }
                }
                vec![self.emit_snapshot()]
            }

            GeminiEvent::Response(resp) => {
                if let Some(text) = resp.text {
                    self.content = text;
                }

                let mut events = vec![self.emit_snapshot()];

                // Emit completion if we have cost/token info
                events.push(ParsedEvent::Complete {
                    cost_usd: resp.cost.unwrap_or(0.0),
                    duration_ms: 0, // Gemini doesn't report duration in the stream
                    session_id: None,
                });

                events
            }

            GeminiEvent::Error(err) => {
                let msg = err.message.unwrap_or_else(|| "Unknown error".to_string());
                if !self.content.is_empty() {
                    self.content.push('\n');
                }
                self.content.push_str(&format!("\n**Error:** {msg}"));
                vec![self.emit_snapshot()]
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_partial_response() {
        let mut parser = GeminiParser::new();
        let events = parser.parse_line(r#"{"type":"partialResponse","data":{"text":"Hello"}}"#);
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message { content, .. } => assert_eq!(content, "Hello"),
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_function_call_and_response() {
        let mut parser = GeminiParser::new();

        // Function call
        let events =
            parser.parse_line(r#"{"type":"functionCall","data":{"name":"readFile","args":{"path":"main.rs"}}}"#);
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message { tool_calls, .. } => {
                assert_eq!(tool_calls.len(), 1);
                assert_eq!(tool_calls[0].name, "readFile");
                assert_eq!(tool_calls[0].status, "running");
            }
            _ => panic!("Expected Message"),
        }

        // Function response
        let events =
            parser.parse_line(r#"{"type":"functionResponse","data":{"name":"readFile","response":"fn main() {}","is_error":false}}"#);
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message { tool_calls, .. } => {
                assert_eq!(tool_calls.len(), 1);
                assert_eq!(tool_calls[0].status, "done");
                assert_eq!(tool_calls[0].output.as_deref(), Some("fn main() {}"));
            }
            _ => panic!("Expected Message"),
        }
    }

    #[test]
    fn test_response_with_cost() {
        let mut parser = GeminiParser::new();
        let events = parser.parse_line(
            r#"{"type":"response","data":{"text":"Done!","tokenCount":{"input":100,"output":50},"cost":0.003}}"#,
        );
        assert_eq!(events.len(), 2);
        match &events[1] {
            ParsedEvent::Complete { cost_usd, .. } => {
                assert!((cost_usd - 0.003).abs() < f64::EPSILON);
            }
            _ => panic!("Expected Complete"),
        }
    }
}

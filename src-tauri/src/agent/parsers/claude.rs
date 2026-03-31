//! Parser for Claude Code's `--output-format stream-json` NDJSON format.
//!
//! Also used for Amp (`--stream-json`) which is documented as
//! Claude Code-compatible.
//!
//! Each line is a JSON object with a "type" field:
//!   - "assistant"   — cumulative message snapshot (text, thinking, tool_use blocks)
//!   - "user"        — contains tool_result blocks
//!   - "tool_result" — standalone tool result
//!   - "result"      — completion event with cost/duration/session_id

use std::collections::HashMap;

use super::{AgentParser, ParsedEvent};
use crate::agent::parser::parse_stream_line;
use crate::agent::types::*;

pub struct ClaudeParser {
    tool_outputs: HashMap<String, (Option<String>, bool)>,
    current_message_id: Option<String>,
    current_content: String,
    current_tool_calls: Vec<ToolCallInfo>,
    /// Persisted thinking blocks keyed by index in the content array.
    /// Claude's cumulative snapshots may later send empty thinking blocks
    /// once the model moves past them; we preserve the last non-empty text.
    persisted_thinking: HashMap<usize, String>,
}

impl ClaudeParser {
    pub fn new() -> Self {
        Self {
            tool_outputs: HashMap::new(),
            current_message_id: None,
            current_content: String::new(),
            current_tool_calls: Vec::new(),
            persisted_thinking: HashMap::new(),
        }
    }
}

impl AgentParser for ClaudeParser {
    fn parse_line(&mut self, line: &str) -> Vec<ParsedEvent> {
        let event = match parse_stream_line(line) {
            Some(e) => e,
            None => return vec![],
        };

        match event {
            StreamEvent::Assistant { message } => {
                let msg_id = message.id.clone();

                if self.current_message_id.as_deref() != Some(&msg_id) {
                    self.current_message_id = Some(msg_id.clone());
                    self.current_content.clear();
                    self.current_tool_calls.clear();
                    self.persisted_thinking.clear();
                }

                let mut text_parts: Vec<String> = Vec::new();
                let mut tool_calls_snapshot: Vec<ToolCallInfo> = Vec::new();

                for (idx, block) in message.content.iter().enumerate() {
                    match block {
                        ContentBlock::Text { text } => {
                            text_parts.push(text.clone());
                        }
                        ContentBlock::Thinking { thinking, .. } => {
                            // Persist non-empty thinking content. Later cumulative
                            // snapshots may send empty/redacted thinking blocks;
                            // we always use the last non-empty version we saw.
                            if !thinking.trim().is_empty() {
                                self.persisted_thinking.insert(idx, thinking.clone());
                            }
                            if let Some(saved) = self.persisted_thinking.get(&idx) {
                                text_parts.push(format!("<thinking>{saved}</thinking>"));
                            }
                        }
                        ContentBlock::ToolUse { id, name, input, .. } => {
                            let (output, is_error) = self
                                .tool_outputs
                                .get(id)
                                .cloned()
                                .unwrap_or((None, false));

                            let status = if output.is_some() {
                                if is_error { "error" } else { "done" }
                            } else {
                                "running"
                            };

                            tool_calls_snapshot.push(ToolCallInfo {
                                name: name.clone(),
                                input: input.clone(),
                                output,
                                status: status.to_string(),
                                tool_use_id: Some(id.clone()),
                            });
                        }
                    }
                }

                self.current_content = text_parts.join("");
                self.current_tool_calls = tool_calls_snapshot;

                vec![ParsedEvent::Message {
                    message_id: msg_id,
                    content: self.current_content.clone(),
                    tool_calls: self.current_tool_calls.clone(),
                }]
            }

            StreamEvent::User { message: user_msg } => {
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
                            self.tool_outputs
                                .insert(tool_use_id.clone(), (output_str.clone(), *is_error));

                            for tc in self.current_tool_calls.iter_mut() {
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

                if let Some(ref msg_id) = self.current_message_id {
                    vec![ParsedEvent::Message {
                        message_id: msg_id.clone(),
                        content: self.current_content.clone(),
                        tool_calls: self.current_tool_calls.clone(),
                    }]
                } else {
                    vec![]
                }
            }

            StreamEvent::ToolResult {
                tool_use_id,
                content,
                is_error,
            } => {
                let output_str = match &content {
                    Some(serde_json::Value::String(s)) => Some(s.clone()),
                    Some(v) => Some(v.to_string()),
                    None => None,
                };

                self.tool_outputs
                    .insert(tool_use_id.clone(), (output_str.clone(), is_error));

                for tc in self.current_tool_calls.iter_mut() {
                    if tc.tool_use_id.as_deref() == Some(&tool_use_id) {
                        tc.output = output_str.clone();
                        tc.status = if is_error {
                            "error".to_string()
                        } else {
                            "done".to_string()
                        };
                    }
                }

                if let Some(ref msg_id) = self.current_message_id {
                    vec![ParsedEvent::Message {
                        message_id: msg_id.clone(),
                        content: self.current_content.clone(),
                        tool_calls: self.current_tool_calls.clone(),
                    }]
                } else {
                    vec![]
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
                vec![ParsedEvent::Complete {
                    cost_usd: final_cost,
                    duration_ms: duration_ms.unwrap_or(0),
                    session_id: claude_sid,
                }]
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_claude_parser_assistant_event() {
        let mut parser = ClaudeParser::new();
        let line = r#"{"type":"assistant","message":{"id":"msg_01","role":"assistant","content":[{"type":"text","text":"Hello world"}],"model":"claude-sonnet-4-20250514","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":5}}}"#;

        let events = parser.parse_line(line);
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Message {
                message_id,
                content,
                tool_calls,
            } => {
                assert_eq!(message_id, "msg_01");
                assert_eq!(content, "Hello world");
                assert!(tool_calls.is_empty());
            }
            _ => panic!("Expected Message event"),
        }
    }

    #[test]
    fn test_claude_parser_result_event() {
        let mut parser = ClaudeParser::new();
        let line = r#"{"type":"result","result":"Done","session_id":"sess_01","cost_usd":0.001,"total_cost_usd":0.005,"duration_ms":2000,"num_turns":1}"#;

        let events = parser.parse_line(line);
        assert_eq!(events.len(), 1);
        match &events[0] {
            ParsedEvent::Complete {
                cost_usd,
                duration_ms,
                session_id,
            } => {
                assert!((cost_usd - 0.005).abs() < f64::EPSILON);
                assert_eq!(*duration_ms, 2000);
                assert_eq!(session_id.as_deref(), Some("sess_01"));
            }
            _ => panic!("Expected Complete event"),
        }
    }

    #[test]
    fn test_thinking_persists_when_later_snapshot_empties_it() {
        let mut parser = ClaudeParser::new();

        // First snapshot: thinking block has content
        let line1 = r#"{"type":"assistant","message":{"id":"msg_01","role":"assistant","content":[{"type":"thinking","thinking":"Let me analyze this..."},{"type":"text","text":"Working on it"}],"model":"claude-sonnet-4-20250514","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":5}}}"#;
        let events = parser.parse_line(line1);
        match &events[0] {
            ParsedEvent::Message { content, .. } => {
                assert!(content.contains("<thinking>Let me analyze this...</thinking>"));
                assert!(content.contains("Working on it"));
            }
            _ => panic!("Expected Message"),
        }

        // Second snapshot: thinking block is now empty (redacted), text updated
        let line2 = r#"{"type":"assistant","message":{"id":"msg_01","role":"assistant","content":[{"type":"thinking","thinking":""},{"type":"text","text":"Here is the result"}],"model":"claude-sonnet-4-20250514","stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":20}}}"#;
        let events = parser.parse_line(line2);
        match &events[0] {
            ParsedEvent::Message { content, .. } => {
                // Thinking should be preserved from the first snapshot
                assert!(
                    content.contains("<thinking>Let me analyze this...</thinking>"),
                    "Thinking block should persist. Got: {content}"
                );
                assert!(content.contains("Here is the result"));
            }
            _ => panic!("Expected Message"),
        }
    }
}

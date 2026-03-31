//! Plain text parser for agents without structured JSON output.
//!
//! Used for: Aider, Chaterm, Crush, Warp, Qwen Code, Droid.
//!
//! Simply accumulates stdout line-by-line into a growing markdown string.

use super::{AgentParser, ParsedEvent};

pub struct PlainTextParser {
    message_id: String,
    content: String,
}

impl PlainTextParser {
    pub fn new() -> Self {
        Self {
            message_id: uuid::Uuid::new_v4().to_string(),
            content: String::new(),
        }
    }
}

impl AgentParser for PlainTextParser {
    fn parse_line(&mut self, line: &str) -> Vec<ParsedEvent> {
        if !self.content.is_empty() {
            self.content.push('\n');
        }
        self.content.push_str(line);

        vec![ParsedEvent::Message {
            message_id: self.message_id.clone(),
            content: self.content.clone(),
            tool_calls: vec![],
        }]
    }
}

//! Agent-specific parsers for structured CLI output.
//!
//! Each coding agent CLI has its own output format. This module provides
//! a common `AgentParser` trait and per-provider implementations that
//! convert agent-specific JSON/text into our common event types.

pub mod claude;
pub mod codex;
pub mod gemini;
pub mod generic_json;
pub mod goose;
pub mod plain_text;

use super::types::ToolCallInfo;

/// A parsed event from an agent's stdout.
#[derive(Debug, Clone)]
pub enum ParsedEvent {
    /// Update (or create) the current assistant message.
    /// Each emission is a cumulative snapshot — the frontend replaces the
    /// previous state for this message_id.
    Message {
        message_id: String,
        content: String,
        tool_calls: Vec<ToolCallInfo>,
    },
    /// The agent run is complete.
    Complete {
        cost_usd: f64,
        duration_ms: u64,
        session_id: Option<String>,
    },
}

/// Trait implemented by every agent-specific parser.
///
/// The reader loop in `manager.rs` calls `parse_line` for each line of
/// stdout, and `finish` when the stream ends.
pub trait AgentParser: Send {
    /// Parse a single line of stdout. May return zero or more events.
    fn parse_line(&mut self, line: &str) -> Vec<ParsedEvent>;

    /// Called when the stdout stream ends. Allows emitting final events
    /// (e.g. a completion event derived from accumulated state).
    fn finish(&mut self) -> Vec<ParsedEvent> {
        vec![]
    }
}

/// Create the appropriate parser for a given provider.
pub fn create_parser(provider_id: &str) -> Box<dyn AgentParser> {
    match provider_id {
        "claude-code" | "amp" => Box::new(claude::ClaudeParser::new()),
        "gemini" => Box::new(gemini::GeminiParser::new()),
        "codex" => Box::new(codex::CodexParser::new()),
        "goose" => Box::new(goose::GooseParser::new()),
        // Agents with JSON output but less-documented formats
        "copilot" | "kilo" | "augment" | "opencode" | "kiro" | "cline" | "go-code" => {
            Box::new(generic_json::GenericJsonParser::new())
        }
        // Plain text fallback
        _ => Box::new(plain_text::PlainTextParser::new()),
    }
}

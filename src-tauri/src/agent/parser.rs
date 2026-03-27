use super::types::StreamEvent;

/// Parse a single NDJSON line from Claude Code's `--output-format stream-json`.
///
/// Returns `None` for blank lines or lines with event types we don't handle
/// (e.g. "system", "ping", etc.). Unrecognised types are logged but not fatal.
pub fn parse_stream_line(line: &str) -> Option<StreamEvent> {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Fast-reject lines that aren't JSON objects
    if !trimmed.starts_with('{') {
        eprintln!("[openforge] Ignoring non-JSON line: {}", &trimmed[..trimmed.len().min(120)]);
        return None;
    }

    match serde_json::from_str::<StreamEvent>(trimmed) {
        Ok(event) => Some(event),
        Err(e) => {
            // Could be an event type we don't model (e.g. "system"). Check if it
            // at least has a "type" field so we can log it helpfully.
            if let Ok(obj) = serde_json::from_str::<serde_json::Value>(trimmed) {
                let event_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("unknown");
                eprintln!(
                    "[openforge] Skipping unhandled stream event type={event_type}: {e}"
                );
            } else {
                eprintln!("[openforge] Failed to parse NDJSON line: {e}");
                eprintln!("[openforge] Line was: {}", &trimmed[..trimmed.len().min(200)]);
            }
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_assistant_event() {
        let line = r#"{"type":"assistant","message":{"id":"msg_01","role":"assistant","content":[{"type":"text","text":"Hello"}],"model":"claude-sonnet-4-20250514","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}"#;
        let event = parse_stream_line(line).unwrap();
        match event {
            StreamEvent::Assistant { message } => {
                assert_eq!(message.id, "msg_01");
                assert_eq!(message.content.len(), 1);
            }
            _ => panic!("Expected Assistant event"),
        }
    }

    #[test]
    fn test_parse_result_event() {
        let line = r#"{"type":"result","result":"Done","session_id":"sess_01","cost_usd":0.001,"duration_ms":1234,"num_turns":1}"#;
        let event = parse_stream_line(line).unwrap();
        match event {
            StreamEvent::Result { session_id, cost_usd, duration_ms, .. } => {
                assert_eq!(session_id.unwrap(), "sess_01");
                assert!((cost_usd.unwrap() - 0.001).abs() < f64::EPSILON);
                assert_eq!(duration_ms.unwrap(), 1234);
            }
            _ => panic!("Expected Result event"),
        }
    }

    #[test]
    fn test_parse_tool_result_event() {
        let line = r#"{"type":"tool_result","tool_use_id":"toolu_01","content":"file contents","is_error":false}"#;
        let event = parse_stream_line(line).unwrap();
        match event {
            StreamEvent::ToolResult { tool_use_id, is_error, .. } => {
                assert_eq!(tool_use_id, "toolu_01");
                assert!(!is_error);
            }
            _ => panic!("Expected ToolResult event"),
        }
    }

    #[test]
    fn test_blank_lines_ignored() {
        assert!(parse_stream_line("").is_none());
        assert!(parse_stream_line("  \n").is_none());
    }

    #[test]
    fn test_unknown_type_returns_none() {
        let line = r#"{"type":"system","message":"init"}"#;
        assert!(parse_stream_line(line).is_none());
    }
}

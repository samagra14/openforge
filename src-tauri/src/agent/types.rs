use serde::{Deserialize, Serialize};

/// Top-level NDJSON events from `claude -p --output-format stream-json`.
///
/// Each line is one of:
///   {"type":"assistant","message":{...}}       – cumulative snapshot of assistant message
///   {"type":"tool_result","content":"...","tool_use_id":"...","is_error":false}
///   {"type":"result","result":"...","session_id":"...","cost_usd":0.001,...}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    #[serde(rename = "assistant")]
    Assistant { message: AssistantMessage },

    /// Tool results come as `{"type":"user","message":{"role":"user","content":[{"type":"tool_result",...}]}}`
    #[serde(rename = "user")]
    User { message: UserMessage },

    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        content: Option<serde_json::Value>,
        #[serde(default)]
        is_error: bool,
    },

    #[serde(rename = "result")]
    Result {
        subtype: Option<String>,
        result: Option<String>,
        cost_usd: Option<f64>,
        total_cost_usd: Option<f64>,
        duration_ms: Option<u64>,
        duration_api_ms: Option<u64>,
        num_turns: Option<u64>,
        session_id: Option<String>,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
}

/// The assistant message object inside an "assistant" event.
/// This is a cumulative snapshot — each event replaces (not appends to) the
/// previous content for the same message id.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    pub id: String,
    pub role: String,
    pub content: Vec<ContentBlock>,
    pub model: Option<String>,
    pub stop_reason: Option<String>,
    pub stop_sequence: Option<serde_json::Value>,
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
}

/// The user message object inside a "user" event (contains tool results).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessage {
    pub role: String,
    pub content: Vec<UserContentBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum UserContentBlock {
    #[serde(rename = "tool_result")]
    ToolResult {
        tool_use_id: String,
        content: Option<serde_json::Value>,
        #[serde(default)]
        is_error: bool,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentBlock {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "thinking")]
    Thinking {
        thinking: String,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    #[serde(rename = "tool_use")]
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
}

// ------------------------------------------------------------------
// Events emitted to the frontend via Tauri event bus
// ------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessageEvent {
    pub session_id: String,
    pub message_id: String,
    pub role: String,
    pub content: String,
    pub tool_calls: Vec<ToolCallInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallInfo {
    pub name: String,
    pub input: serde_json::Value,
    pub output: Option<String>,
    pub status: String, // "running" | "done" | "error"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_use_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatusEvent {
    pub session_id: String,
    pub status: String, // "running" | "idle"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCompleteEvent {
    pub session_id: String,
    pub cost_usd: f64,
    pub duration_ms: u64,
    pub claude_session_id: Option<String>,
}

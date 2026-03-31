use serde::{Deserialize, Serialize};

/// An agent provider defines how to spawn and communicate with a specific
/// coding agent CLI tool.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProvider {
    /// Unique identifier (e.g., "claude-code", "gemini", "codex")
    pub id: String,
    /// Display name (e.g., "Claude Code", "Gemini CLI")
    pub name: String,
    /// CLI command to invoke (e.g., "claude", "gemini", "codex")
    pub command: String,
    /// How stdout is parsed
    pub output_format: OutputFormat,
    /// Whether this provider supports session resume
    pub supports_resume: bool,
    /// Available models for this provider
    pub models: Vec<ModelOption>,
    /// Default model id
    pub default_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum OutputFormat {
    /// Claude Code's NDJSON stream-json format (structured tool calls, thinking, cost)
    #[serde(rename = "stream-json")]
    StreamJson,
    /// Structured JSON output with tool calls (Gemini, Codex, Goose, etc.)
    #[serde(rename = "structured-json")]
    StructuredJson,
    /// Plain text output on stdout (Aider, Chaterm, etc.)
    #[serde(rename = "plain-text")]
    PlainText,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelOption {
    pub id: String,
    pub name: String,
}

/// Build the argument list to spawn this provider's CLI.
///
/// Each provider has its own CLI interface. This function returns the full
/// argument vector for the given prompt, model, and optional resume session.
pub fn build_args(
    provider_id: &str,
    model: &str,
    prompt: &str,
    resume_session_id: Option<&str>,
) -> Vec<String> {
    match provider_id {
        // ── Claude Code ────────────────────────────────────────
        "claude-code" => {
            let mut args = vec![
                "-p".to_string(),
                "--verbose".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
                "--model".to_string(),
                model.to_string(),
            ];
            if let Some(sid) = resume_session_id {
                args.push("--resume".to_string());
                args.push("--session-id".to_string());
                args.push(sid.to_string());
            }
            args.push(prompt.to_string());
            args
        }

        // ── Gemini CLI ─────────────────────────────────────────
        // gemini -p --output-format stream-json [--model <model>] "<prompt>"
        "gemini" => {
            let mut args = vec![
                "-p".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push(prompt.to_string());
            args
        }

        // ── Codex CLI (OpenAI) ─────────────────────────────────
        // codex exec --json [--model <model>] "<prompt>"
        "codex" => {
            let mut args = vec![
                "exec".to_string(),
                "--json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push(prompt.to_string());
            args
        }

        // ── Aider (plain text — no JSON mode) ──────────────────
        // aider --yes --no-git [--model <model>] --message "<prompt>"
        "aider" => {
            let mut args = vec![
                "--yes".to_string(),
                "--no-git".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--message".to_string());
            args.push(prompt.to_string());
            args
        }

        // ── Goose (Block/Square) ───────────────────────────────
        // goose run --output-format stream-json [--model <model>] --text "<prompt>"
        "goose" => {
            let mut args = vec![
                "run".to_string(),
                "--output-format".to_string(),
                "stream-json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--text".to_string());
            args.push(prompt.to_string());
            args
        }

        // ── GitHub Copilot CLI ─────────────────────────────────
        // gh copilot agent --output-format=json "<prompt>"
        "copilot" => {
            vec![
                "copilot".to_string(),
                "agent".to_string(),
                "--output-format=json".to_string(),
                prompt.to_string(),
            ]
        }

        // ── Cline CLI ──────────────────────────────────────────
        // cline --json [--model <model>] --message "<prompt>"
        "cline" => {
            let mut args = vec!["--json".to_string()];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--message".to_string());
            args.push(prompt.to_string());
            args
        }

        // ── OpenCode ───────────────────────────────────────────
        // opencode -p -f json [--model <model>] "<prompt>"
        "opencode" => {
            let mut args = vec![
                "-p".to_string(),
                "-f".to_string(),
                "json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push(prompt.to_string());
            args
        }

        // ── Amp (Sourcegraph) ──────────────────────────────────
        // amp --execute --stream-json [--model <model>] "<prompt>"
        "amp" => {
            let mut args = vec![
                "--execute".to_string(),
                "--stream-json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push(prompt.to_string());
            args
        }

        // ── Warp (plain text) ──────────────────────────────────
        // warp-cli ai "<prompt>"
        "warp" => {
            vec!["ai".to_string(), prompt.to_string()]
        }

        // ── Qwen Code (plain text) ────────────────────────────
        // qwen-code [--model <model>] --message "<prompt>"
        "qwen-code" => {
            let mut args = vec![];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--message".to_string());
            args.push(prompt.to_string());
            args
        }

        // ── Crush (plain text) ─────────────────────────────────
        // crush [--model <model>] "<prompt>"
        "crush" => {
            let mut args = vec![];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push(prompt.to_string());
            args
        }

        // ── Augment Code ───────────────────────────────────────
        // augment --print --output_format json [--model <model>] --message "<prompt>"
        "augment" => {
            let mut args = vec![
                "--print".to_string(),
                "--output_format".to_string(),
                "json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--message".to_string());
            args.push(prompt.to_string());
            args
        }

        // ── Kilo ───────────────────────────────────────────────
        // kilo run --json [--model <model>] --message "<prompt>"
        "kilo" => {
            let mut args = vec![
                "run".to_string(),
                "--json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--message".to_string());
            args.push(prompt.to_string());
            args
        }

        // ── Kiro (AWS) ────────────────────────────────────────
        // kiro chat --format json [--model <model>] --message "<prompt>"
        "kiro" => {
            let mut args = vec![
                "chat".to_string(),
                "--format".to_string(),
                "json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--message".to_string());
            args.push(prompt.to_string());
            args
        }

        // ── Droid (plain text) ─────────────────────────────────
        // droid [--model <model>] --message "<prompt>"
        "droid" => {
            let mut args = vec![];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--message".to_string());
            args.push(prompt.to_string());
            args
        }

        // ── GO-CODE ────────────────────────────────────────────
        // go-code -p -f json [--model <model>] "<prompt>"
        "go-code" => {
            let mut args = vec![
                "-p".to_string(),
                "-f".to_string(),
                "json".to_string(),
            ];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push(prompt.to_string());
            args
        }

        // ── Chaterm (plain text) ───────────────────────────────
        // chaterm [--model <model>] --message "<prompt>"
        "chaterm" => {
            let mut args = vec![];
            if model != "default" {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            args.push("--message".to_string());
            args.push(prompt.to_string());
            args
        }

        // Fallback for unknown providers: just pass prompt as arg
        _ => {
            vec![prompt.to_string()]
        }
    }
}

/// Get the command to invoke for a provider. Most use their own binary,
/// but some (like GitHub Copilot) use a host command (gh).
pub fn get_command(provider_id: &str) -> &str {
    match provider_id {
        "claude-code" => "claude",
        "gemini" => "gemini",
        "codex" => "codex",
        "aider" => "aider",
        "goose" => "goose",
        "copilot" => "gh",
        "cline" => "cline",
        "opencode" => "opencode",
        "amp" => "amp",
        "warp" => "warp-cli",
        "qwen-code" => "qwen-code",
        "crush" => "crush",
        "augment" => "augment",
        "kilo" => "kilo",
        "kiro" => "kiro",
        "droid" => "droid",
        "go-code" => "go-code",
        "chaterm" => "chaterm",
        _ => provider_id,
    }
}

/// Return all supported agent providers.
pub fn all_providers() -> Vec<AgentProvider> {
    vec![
        AgentProvider {
            id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            command: "claude".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_resume: true,
            default_model: "sonnet".to_string(),
            models: vec![
                ModelOption { id: "sonnet".to_string(), name: "Sonnet 4.6".to_string() },
                ModelOption { id: "opus".to_string(), name: "Opus 4.6".to_string() },
                ModelOption { id: "haiku".to_string(), name: "Haiku 4.5".to_string() },
            ],
        },
        AgentProvider {
            id: "gemini".to_string(),
            name: "Gemini CLI".to_string(),
            command: "gemini".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
                ModelOption { id: "gemini-2.5-pro".to_string(), name: "Gemini 2.5 Pro".to_string() },
                ModelOption { id: "gemini-2.5-flash".to_string(), name: "Gemini 2.5 Flash".to_string() },
            ],
        },
        AgentProvider {
            id: "codex".to_string(),
            name: "Codex CLI".to_string(),
            command: "codex".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
                ModelOption { id: "o4-mini".to_string(), name: "o4-mini".to_string() },
                ModelOption { id: "o3".to_string(), name: "o3".to_string() },
            ],
        },
        AgentProvider {
            id: "aider".to_string(),
            name: "Aider".to_string(),
            command: "aider".to_string(),
            output_format: OutputFormat::PlainText,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
                ModelOption { id: "gpt-4o".to_string(), name: "GPT-4o".to_string() },
                ModelOption { id: "claude-sonnet-4-20250514".to_string(), name: "Claude Sonnet".to_string() },
                ModelOption { id: "deepseek/deepseek-chat".to_string(), name: "DeepSeek".to_string() },
            ],
        },
        AgentProvider {
            id: "goose".to_string(),
            name: "Goose".to_string(),
            command: "goose".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "copilot".to_string(),
            name: "GitHub Copilot CLI".to_string(),
            command: "gh".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "cline".to_string(),
            name: "Cline CLI".to_string(),
            command: "cline".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "opencode".to_string(),
            name: "OpenCode".to_string(),
            command: "opencode".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "amp".to_string(),
            name: "Amp".to_string(),
            command: "amp".to_string(),
            output_format: OutputFormat::StreamJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "warp".to_string(),
            name: "Warp".to_string(),
            command: "warp-cli".to_string(),
            output_format: OutputFormat::PlainText,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "qwen-code".to_string(),
            name: "Qwen Code".to_string(),
            command: "qwen-code".to_string(),
            output_format: OutputFormat::PlainText,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
                ModelOption { id: "qwen3-coder".to_string(), name: "Qwen3 Coder".to_string() },
            ],
        },
        AgentProvider {
            id: "crush".to_string(),
            name: "Crush".to_string(),
            command: "crush".to_string(),
            output_format: OutputFormat::PlainText,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "augment".to_string(),
            name: "Augment Code".to_string(),
            command: "augment".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "kilo".to_string(),
            name: "Kilo".to_string(),
            command: "kilo".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "kiro".to_string(),
            name: "Kiro".to_string(),
            command: "kiro".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "droid".to_string(),
            name: "Droid".to_string(),
            command: "droid".to_string(),
            output_format: OutputFormat::PlainText,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "go-code".to_string(),
            name: "GO-CODE".to_string(),
            command: "go-code".to_string(),
            output_format: OutputFormat::StructuredJson,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
        AgentProvider {
            id: "chaterm".to_string(),
            name: "Chaterm".to_string(),
            command: "chaterm".to_string(),
            output_format: OutputFormat::PlainText,
            supports_resume: false,
            default_model: "default".to_string(),
            models: vec![
                ModelOption { id: "default".to_string(), name: "Default".to_string() },
            ],
        },
    ]
}

/// Look up a provider by ID. Falls back to Claude Code if not found.
pub fn get_provider(id: &str) -> AgentProvider {
    all_providers()
        .into_iter()
        .find(|p| p.id == id)
        .unwrap_or_else(|| {
            // Default to Claude Code
            all_providers().into_iter().next().unwrap()
        })
}

/// Get the output format for a provider.
pub fn get_output_format(provider_id: &str) -> OutputFormat {
    get_provider(provider_id).output_format
}

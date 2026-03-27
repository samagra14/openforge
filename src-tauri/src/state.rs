use std::sync::Mutex;

use rusqlite::Connection;

use crate::agent::manager::AgentManager;
use crate::terminal::pty::TerminalManager;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub agent_manager: Mutex<AgentManager>,
    pub terminal_manager: Mutex<TerminalManager>,
}

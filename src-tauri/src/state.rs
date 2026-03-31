use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::agent::manager::AgentManager;
use crate::terminal::pty::TerminalManager;

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub agent_manager: Mutex<AgentManager>,
    pub terminal_manager: Mutex<TerminalManager>,
}

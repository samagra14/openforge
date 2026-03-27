use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::mpsc;
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalDataEvent {
    pub terminal_id: String,
    pub data: String,
}

struct TerminalInstance {
    master: Option<Box<dyn MasterPty + Send>>,
    writer_tx: Option<mpsc::Sender<WriterMsg>>,
}

enum WriterMsg {
    Data(String),
    Close,
}

pub struct TerminalManager {
    terminals: HashMap<String, TerminalInstance>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: HashMap::new(),
        }
    }

    pub fn create_terminal(
        &mut self,
        terminal_id: String,
        workspace_path: String,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let pty_system = native_pty_system();

        // Create PTY with default size
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to open PTY: {e}"))?;

        // Determine shell
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

        let mut cmd = CommandBuilder::new(&shell);
        cmd.arg("-l");
        cmd.cwd(&workspace_path);
        cmd.env("TERM", "xterm-256color");

        // Spawn the shell in the slave PTY
        let _child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn shell: {e}"))?;

        // We intentionally drop the slave side — the master owns the PTY now
        drop(pair.slave);

        // Get a reader from the master for reading PTY output
        let mut reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to clone PTY reader: {e}"))?;

        // Get a writer for sending input to the PTY
        let mut writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

        let (writer_tx, writer_rx) = mpsc::channel::<WriterMsg>();

        // Background thread: read PTY output and emit to frontend
        let tid = terminal_id.clone();
        let handle = app_handle.clone();
        thread::spawn(move || {
            let mut buf = [0u8; 4096];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        let data = String::from_utf8_lossy(&buf[..n]).to_string();
                        let _ = handle.emit(
                            "terminal:data",
                            TerminalDataEvent {
                                terminal_id: tid.clone(),
                                data,
                            },
                        );
                    }
                    Err(e) => {
                        eprintln!("[openforge] PTY read error for {tid}: {e}");
                        break;
                    }
                }
            }
            eprintln!("[openforge] PTY reader thread exited for {tid}");
        });

        // Background thread: write input from frontend to PTY + handle resize
        // We keep the master around for resize operations.
        let tid2 = terminal_id.clone();
        thread::spawn(move || {
            while let Ok(msg) = writer_rx.recv() {
                match msg {
                    WriterMsg::Data(data) => {
                        if writer.write_all(data.as_bytes()).is_err() {
                            break;
                        }
                        let _ = writer.flush();
                    }
                    WriterMsg::Close => break,
                }
            }
            eprintln!("[openforge] PTY writer thread exited for {tid2}");
        });

        self.terminals.insert(
            terminal_id,
            TerminalInstance {
                master: Some(pair.master),
                writer_tx: Some(writer_tx),
            },
        );

        Ok(())
    }

    pub fn write_terminal(&self, terminal_id: &str, data: String) -> Result<(), String> {
        let terminal = self
            .terminals
            .get(terminal_id)
            .ok_or("Terminal not found")?;
        if let Some(ref tx) = terminal.writer_tx {
            tx.send(WriterMsg::Data(data))
                .map_err(|e| format!("Failed to write to terminal: {e}"))?;
        }
        Ok(())
    }

    pub fn resize_terminal(
        &mut self,
        terminal_id: &str,
        rows: u16,
        cols: u16,
    ) -> Result<(), String> {
        let terminal = self
            .terminals
            .get_mut(terminal_id)
            .ok_or("Terminal not found")?;
        if let Some(ref master) = terminal.master {
            master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {e}"))?;
        }
        Ok(())
    }

    pub fn close_terminal(&mut self, terminal_id: &str) -> Result<(), String> {
        if let Some(mut terminal) = self.terminals.remove(terminal_id) {
            // Send close message to writer thread
            if let Some(tx) = terminal.writer_tx.take() {
                let _ = tx.send(WriterMsg::Close);
            }
            // Drop the master to close the PTY
            terminal.master.take();
            eprintln!("[openforge] Terminal {terminal_id} closed");
        }
        Ok(())
    }

    pub fn cleanup_all(&mut self) {
        let ids: Vec<String> = self.terminals.keys().cloned().collect();
        for id in ids {
            let _ = self.close_terminal(&id);
        }
    }
}

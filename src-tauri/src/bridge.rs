use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Runtime};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use tauri::async_runtime;
use tokio::sync::{mpsc, oneshot};
use tracing::{error, info, warn};

const BRIDGE_BIN: &str = "haulpave-bridge";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SidecarStatus {
    Running,
    Crashed,
    Restarting,
}

#[derive(Debug, thiserror::Error)]
pub enum BridgeError {
    #[error("sidecar process exited unexpectedly")]
    ProcessGone,
    #[error("haul-pave error [{code}]: {message}")]
    Remote { code: String, message: String },
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Serialize)]
struct Request<'a> {
    id: u64,
    method: &'a str,
    params: &'a Value,
}

#[derive(Deserialize)]
struct Response {
    id: u64,
    #[serde(default)]
    result: Option<Value>,
    #[serde(default)]
    error: Option<RemoteError>,
    #[serde(default)]
    stub: bool,
    #[serde(default)]
    stub_message: Option<String>,
}

#[derive(Deserialize, Debug)]
struct RemoteError {
    code: String,
    message: String,
    #[serde(default)]
    #[allow(dead_code)]
    trace: Option<String>,
}

/// What the call returns on the happy / stub path. Real failures bubble up as `BridgeError`.
#[derive(Debug, Serialize)]
pub struct CallOk {
    pub data: Value,
    pub stub: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stub_message: Option<String>,
}

type PendingTx = oneshot::Sender<std::result::Result<CallOk, RemoteError>>;
type PendingMap = Arc<Mutex<HashMap<u64, PendingTx>>>;
// Slot holds the current write channel; None when sidecar is not running.
type WriteTxSlot = Arc<Mutex<Option<mpsc::Sender<Vec<u8>>>>>;

pub struct BridgeClient {
    next_id: AtomicU64,
    pending: PendingMap,
    write_tx: WriteTxSlot,
    pub status: Arc<Mutex<SidecarStatus>>,
    // Monotonically increasing; each start_sidecar call increments it.
    // Reader tasks check the generation before overwriting shared state on
    // Terminated so that a stale reader from a previous incarnation cannot
    // clobber a freshly restarted sidecar.
    generation: Arc<AtomicU64>,
}

impl BridgeClient {
    pub fn spawn<R: Runtime>(app: &AppHandle<R>) -> Result<Self> {
        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));
        let write_tx: WriteTxSlot = Arc::new(Mutex::new(None));
        let status = Arc::new(Mutex::new(SidecarStatus::Running));
        let generation = Arc::new(AtomicU64::new(0));

        let client = BridgeClient {
            next_id: AtomicU64::new(1),
            pending: Arc::clone(&pending),
            write_tx: Arc::clone(&write_tx),
            status: Arc::clone(&status),
            generation: Arc::clone(&generation),
        };

        start_sidecar(app, &pending, &write_tx, &status, &generation)?;

        Ok(client)
    }

    pub fn restart<R: Runtime>(&self, app: &AppHandle<R>) -> Result<()> {
        *self.status.lock().unwrap() = SidecarStatus::Restarting;
        // Clear the write slot so in-flight calls fail fast.
        *self.write_tx.lock().unwrap() = None;
        drain_pending(&self.pending);
        start_sidecar(app, &self.pending, &self.write_tx, &self.status, &self.generation)
    }

    /// Gracefully kill the sidecar process without restarting.
    /// Called before app exit or updater install to release the executable lock.
    pub fn kill(&self) {
        info!("killing haulpave bridge sidecar");
        *self.status.lock().unwrap() = SidecarStatus::Crashed;
        // Dropping the write_tx sender closes the channel, causing the writer
        // task to exit its loop and call child_owned.kill().
        *self.write_tx.lock().unwrap() = None;
        drain_pending(&self.pending);
    }

    pub async fn call(
        &self,
        method: &str,
        params: Value,
    ) -> std::result::Result<CallOk, BridgeError> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (tx, rx) = oneshot::channel();
        {
            let mut guard = self.pending.lock().unwrap();
            guard.insert(id, tx);
        }

        // Snapshot the current sender before any await point.
        let maybe_tx = self.write_tx.lock().unwrap().clone();
        let write_tx = match maybe_tx {
            Some(t) => t,
            None => {
                self.pending.lock().unwrap().remove(&id);
                return Err(BridgeError::ProcessGone);
            }
        };

        let mut payload = serde_json::to_vec(&Request {
            id,
            method,
            params: &params,
        })?;
        payload.push(b'\n');
        write_tx
            .send(payload)
            .await
            .map_err(|_| BridgeError::ProcessGone)?;

        match rx.await {
            Ok(Ok(ok)) => Ok(ok),
            Ok(Err(err)) => Err(BridgeError::Remote {
                code: err.code,
                message: err.message,
            }),
            Err(_) => Err(BridgeError::ProcessGone),
        }
    }
}

fn drain_pending(pending: &PendingMap) {
    let drained: Vec<_> = pending.lock().unwrap().drain().collect();
    for (_id, tx) in drained {
        let _ = tx.send(Err(RemoteError {
            code: "ProcessGone".into(),
            message: "sidecar terminated".into(),
            trace: None,
        }));
    }
}

fn start_sidecar<R: Runtime>(
    app: &AppHandle<R>,
    pending: &PendingMap,
    write_tx: &WriteTxSlot,
    status: &Arc<Mutex<SidecarStatus>>,
    generation: &Arc<AtomicU64>,
) -> Result<()> {
    let sidecar = app
        .shell()
        .sidecar(BRIDGE_BIN)
        .with_context(|| format!("locating sidecar binary `{BRIDGE_BIN}`"))?;

    let (mut event_rx, child) = sidecar
        .spawn()
        .with_context(|| format!("spawning sidecar `{BRIDGE_BIN}`"))?;

    info!("spawned haulpave bridge sidecar");

    // Bump generation so stale reader tasks from a previous incarnation know to
    // ignore the Terminated event they may still receive.
    let gen = generation.fetch_add(1, Ordering::SeqCst) + 1;

    let (new_write_tx, mut write_rx) = mpsc::channel::<Vec<u8>>(32);
    *write_tx.lock().unwrap() = Some(new_write_tx);
    *status.lock().unwrap() = SidecarStatus::Running;

    // Writer task: owns CommandChild; exits when write_rx closes (sender dropped).
    let mut child_owned: CommandChild = child;
    async_runtime::spawn(async move {
        while let Some(buf) = write_rx.recv().await {
            if let Err(e) = child_owned.write(&buf) {
                error!("failed writing to sidecar stdin: {e:?}");
                break;
            }
        }
        let _ = child_owned.kill();
    });

    // Reader task: parses stdout JSON lines; updates shared state on Terminated.
    let pending_for_reader = Arc::clone(pending);
    let write_tx_for_reader = Arc::clone(write_tx);
    let status_for_reader = Arc::clone(status);
    let generation_for_reader = Arc::clone(generation);
    async_runtime::spawn(async move {
        while let Some(event) = event_rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    match serde_json::from_slice::<Response>(&line) {
                        Ok(resp) => {
                            let waiter = {
                                let mut guard = pending_for_reader.lock().unwrap();
                                guard.remove(&resp.id)
                            };
                            if let Some(tx) = waiter {
                                let outcome = if let Some(err) = resp.error {
                                    Err(err)
                                } else {
                                    Ok(CallOk {
                                        data: resp.result.unwrap_or(Value::Null),
                                        stub: resp.stub,
                                        stub_message: resp.stub_message,
                                    })
                                };
                                let _ = tx.send(outcome);
                            } else {
                                warn!("orphan response id={}", resp.id);
                            }
                        }
                        Err(e) => {
                            warn!(
                                "failed to parse sidecar stdout: {e}; raw={}",
                                String::from_utf8_lossy(&line)
                            );
                        }
                    }
                }
                CommandEvent::Stderr(line) => {
                    warn!("[bridge stderr] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(e) => {
                    error!("[bridge error] {e}");
                }
                CommandEvent::Terminated(payload) => {
                    error!(
                        "haulpave bridge terminated (code={:?}, signal={:?})",
                        payload.code, payload.signal
                    );
                    // Only update shared state if we are still the current generation.
                    // A restart() call bumps the generation before spawning a new
                    // sidecar, so a stale reader seeing the old process's Terminated
                    // event will find gen != current and leave the new state alone.
                    if generation_for_reader.load(Ordering::SeqCst) == gen {
                        *write_tx_for_reader.lock().unwrap() = None;
                        *status_for_reader.lock().unwrap() = SidecarStatus::Crashed;
                        drain_pending(&pending_for_reader);
                    }
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

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

/// What the call returns on the happy / stub path. Real failures bubble up as
/// `BridgeError`.
#[derive(Debug, Serialize)]
pub struct CallOk {
    pub data: Value,
    pub stub: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stub_message: Option<String>,
}

type PendingTx = oneshot::Sender<std::result::Result<CallOk, RemoteError>>;
type PendingMap = Arc<Mutex<HashMap<u64, PendingTx>>>;

pub struct BridgeClient {
    next_id: AtomicU64,
    pending: PendingMap,
    write_tx: mpsc::Sender<Vec<u8>>,
}

impl BridgeClient {
    pub fn spawn<R: Runtime>(app: &AppHandle<R>) -> Result<Self> {
        let sidecar = app
            .shell()
            .sidecar(BRIDGE_BIN)
            .with_context(|| format!("locating sidecar binary `{BRIDGE_BIN}`"))?;

        let (mut event_rx, child) = sidecar
            .spawn()
            .with_context(|| format!("spawning sidecar `{BRIDGE_BIN}`"))?;

        info!("spawned haulpave bridge sidecar");

        let pending: PendingMap = Arc::new(Mutex::new(HashMap::new()));
        let (write_tx, mut write_rx) = mpsc::channel::<Vec<u8>>(32);

        // Writer task: drain write_rx, push bytes into sidecar stdin.
        // We move the CommandChild into this task; it owns the handle.
        let mut child_owned: CommandChild = child;
        async_runtime::spawn(async move {
            while let Some(buf) = write_rx.recv().await {
                if let Err(e) = child_owned.write(&buf) {
                    error!("failed writing to sidecar stdin: {e:?}");
                    break;
                }
            }
            // Channel closed -> drop child to terminate sidecar.
            let _ = child_owned.kill();
        });

        // Reader task: parse stdout JSON lines, route to pending oneshot senders.
        let pending_for_reader = Arc::clone(&pending);
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
                                    "failed to parse sidecar stdout line: {e}; raw={}",
                                    String::from_utf8_lossy(&line)
                                );
                            }
                        }
                    }
                    CommandEvent::Stderr(line) => {
                        warn!("[bridge stderr] {}", String::from_utf8_lossy(&line));
                    }
                    CommandEvent::Error(e) => {
                        error!("[bridge error event] {e}");
                    }
                    CommandEvent::Terminated(payload) => {
                        error!(
                            "haulpave bridge terminated (code={:?}, signal={:?})",
                            payload.code, payload.signal
                        );
                        // Fail any in-flight requests.
                        let drained: Vec<_> = {
                            let mut guard = pending_for_reader.lock().unwrap();
                            guard.drain().collect()
                        };
                        for (_id, tx) in drained {
                            let _ = tx.send(Err(RemoteError {
                                code: "ProcessGone".into(),
                                message: "sidecar terminated".into(),
                                trace: None,
                            }));
                        }
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(BridgeClient {
            next_id: AtomicU64::new(1),
            pending,
            write_tx,
        })
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
        let mut payload = serde_json::to_vec(&Request {
            id,
            method,
            params: &params,
        })?;
        payload.push(b'\n');
        self.write_tx
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

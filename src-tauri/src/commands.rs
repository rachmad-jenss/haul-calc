use std::sync::Arc;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::State;

use crate::bridge::{BridgeClient, BridgeError, CallOk, SidecarStatus};

#[derive(Serialize)]
pub struct CallError {
    pub code: String,
    pub message: String,
}

impl From<BridgeError> for CallError {
    fn from(err: BridgeError) -> Self {
        match err {
            BridgeError::Remote { code, message } => CallError { code, message },
            BridgeError::ProcessGone => CallError {
                code: "ProcessGone".into(),
                message: "haul-pave sidecar is not running".into(),
            },
            other => CallError {
                code: "Internal".into(),
                message: other.to_string(),
            },
        }
    }
}

#[derive(Serialize)]
pub struct CallEnvelope {
    pub data: Value,
    pub stub: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stub_message: Option<String>,
}

impl From<CallOk> for CallEnvelope {
    fn from(ok: CallOk) -> Self {
        CallEnvelope {
            data: ok.data,
            stub: ok.stub,
            stub_message: ok.stub_message,
        }
    }
}

#[tauri::command]
pub async fn haul_pave_call(
    method: String,
    params: Option<Value>,
    state: State<'_, Arc<BridgeClient>>,
) -> Result<CallEnvelope, CallError> {
    let ok = state
        .call(&method, params.unwrap_or(json!({})))
        .await
        .map_err(CallError::from)?;
    Ok(ok.into())
}

#[tauri::command]
pub fn get_sidecar_status(state: State<'_, Arc<BridgeClient>>) -> SidecarStatus {
    state.status.lock().unwrap().clone()
}

#[tauri::command]
pub fn restart_sidecar(
    state: State<'_, Arc<BridgeClient>>,
    app: tauri::AppHandle,
) -> Result<(), CallError> {
    state.restart(&app).map_err(|e| CallError {
        code: "RestartFailed".into(),
        message: e.to_string(),
    })
}

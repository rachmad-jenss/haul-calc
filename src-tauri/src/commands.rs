use std::sync::Arc;

use serde::Serialize;
use serde_json::{json, Value};
use tauri::State;

use crate::bridge::{BridgeClient, BridgeError, CallOk};

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

/// Wire format the frontend sees: `data` plus stub metadata.
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
pub async fn health_check(
    state: State<'_, Arc<BridgeClient>>,
) -> Result<CallEnvelope, CallError> {
    let ok = state
        .call("health_check", json!({}))
        .await
        .map_err(CallError::from)?;
    Ok(ok.into())
}

#[tauri::command]
pub async fn get_lib_version(
    state: State<'_, Arc<BridgeClient>>,
) -> Result<CallEnvelope, CallError> {
    let ok = state
        .call("get_version", json!({}))
        .await
        .map_err(CallError::from)?;
    Ok(ok.into())
}

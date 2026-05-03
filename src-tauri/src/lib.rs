mod bridge;
mod commands;

use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::EnvFilter;

use crate::bridge::BridgeClient;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let client = Arc::new(BridgeClient::spawn(&handle)?);
            app.manage(client);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::haul_pave_call,
            commands::health_check,
            commands::get_lib_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

mod bridge;
mod commands;

use std::sync::Arc;
use tauri::{Emitter, Manager};
use tracing_subscriber::EnvFilter;

use crate::bridge::BridgeClient;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    fn is_hcalc(arg: &str) -> bool {
        use std::path::Path;
        !arg.starts_with('-')
            && Path::new(arg)
                .extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| e.eq_ignore_ascii_case("hcalc"))
    }

    // Capture a .hcalc file path from the CLI args (e.g. double-click in File Explorer).
    // Must be read before Builder::default() so the slot is set before any window loads.
    commands::set_pending_file_path(std::env::args().skip(1).find(|a| is_hcalc(a)));

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Second instance launched — buffer path and notify frontend.
            if let Some(path) = args.into_iter().skip(1).find(|a| is_hcalc(a)) {
                commands::set_pending_file_path(Some(path));
                let _ = app.emit("file-open", ());
            }
            // Bring the existing window to the foreground.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
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
            commands::get_sidecar_status,
            commands::restart_sidecar,
            commands::take_pending_file_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

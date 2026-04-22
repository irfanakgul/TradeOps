use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

struct BackendState(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendState(Mutex::new(None)))
        .setup(|app| {
            let result = app.shell().sidecar("tradeops_backend");

            match result {
                Ok(command) => {
                    let spawn_result = command.spawn();

                    match spawn_result {
                        Ok((_rx, child)) => {
                            let state = app.state::<BackendState>();
                            *state.0.lock().unwrap() = Some(child);
                        }
                        Err(err) => {
                            eprintln!("Failed to spawn bundled backend: {err}");
                        }
                    }
                }
                Err(err) => {
                    eprintln!("Failed to resolve bundled backend sidecar: {err}");
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
                let state = app.state::<BackendState>();

                let child_opt = {
                    let mut guard = state.0.lock().unwrap();
                    guard.take()
                };

                if let Some(child) = child_opt {
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
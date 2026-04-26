use std::process::Command;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

struct BackendState(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

fn kill_existing_backends() {
    // Kill any leftover tradeops_backend / tradeops_server processes from a
    // previous run so the new instance can bind to port 8000.
    let _ = Command::new("/usr/bin/pkill")
        .args(["-9", "-f", "tradeops_backend"])
        .output();
    let _ = Command::new("/usr/bin/pkill")
        .args(["-9", "-f", "tradeops_server"])
        .output();
    // Give the OS a moment to release the port
    thread::sleep(Duration::from_millis(400));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendState(Mutex::new(None)))
        .setup(|app| {
            kill_existing_backends();

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

                // Belt-and-suspenders: also reap any backends still alive so
                // a re-launch isn't blocked by a zombie holding port 8000.
                kill_existing_backends();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

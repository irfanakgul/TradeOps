use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::process::{Command, Stdio};
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

    // Belt-and-suspenders: also kill anything else still holding port 8000
    // (e.g. a stale dev `uvicorn --reload` left over from a previous session).
    // Uses the standard combo: lsof -ti :8000 | xargs kill -9
    let _ = Command::new("/bin/sh")
        .arg("-c")
        .arg("/usr/sbin/lsof -ti :8000 | xargs -r kill -9 2>/dev/null || true")
        .output();

    // Give the OS a moment to release the port
    thread::sleep(Duration::from_millis(500));
}

/// Download a DMG from `url` and run a detached helper script that:
///   1. Waits for this app to fully quit
///   2. Mounts the new DMG
///   3. Replaces /Applications/TradeOps.app
///   4. Strips the quarantine attribute
///   5. Re-launches the new app
///
/// On success, the calling JS should immediately quit the app so the helper
/// can take over.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn marker_path() -> std::path::PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
    let mut p = std::path::PathBuf::from(home);
    p.push("Library");
    p.push("Application Support");
    p.push("TradeOps");
    let _ = std::fs::create_dir_all(&p);
    p.push("update_in_progress.flag");
    p
}

/// Write a flag file so the next app launch knows it just finished updating
/// (used by the splash to show a richer "update completing" UI).
#[tauri::command]
fn mark_update_in_progress() {
    let _ = std::fs::write(marker_path(), b"1");
}

/// Returns true (and removes the file) if the previous launch wrote the flag.
#[tauri::command]
fn consume_update_marker() -> bool {
    let p = marker_path();
    if p.exists() {
        let _ = std::fs::remove_file(&p);
        return true;
    }
    false
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle, url: String) -> Result<String, String> {
    if url.trim().is_empty() {
        return Err("download_url is empty".into());
    }

    let dmg_path = "/tmp/tradeops_update.dmg";
    let script_path = "/tmp/tradeops_update.sh";
    let log_path = "/tmp/tradeops_update.log";

    // Clean any leftovers from a previous attempt
    let _ = fs::remove_file(dmg_path);
    let _ = fs::remove_file(script_path);

    // 1. Download the DMG (foreground — we want to know if it failed)
    let dl = Command::new("/usr/bin/curl")
        .args(["-L", "--fail", "--silent", "--show-error", "-o", dmg_path, &url])
        .output()
        .map_err(|e| format!("curl spawn failed: {e}"))?;

    if !dl.status.success() {
        let stderr = String::from_utf8_lossy(&dl.stderr);
        return Err(format!("download failed: {stderr}"));
    }

    let meta = fs::metadata(dmg_path).map_err(|e| format!("dmg missing: {e}"))?;
    if meta.len() < 1024 * 1024 {
        return Err(format!("downloaded file too small ({} bytes)", meta.len()));
    }

    // 2. Write the helper script (runs detached after we quit)
    let mountpoint = "/Volumes/TradeOpsUpdate";
    let script = format!(
        r#"#!/bin/bash
exec >"{log}" 2>&1
set -x

# Wait for the running app to fully quit
sleep 2
for i in $(seq 1 30); do
  if ! pgrep -f "TradeOps.app/Contents/MacOS/app" > /dev/null; then
    break
  fi
  sleep 1
done

# Make sure no leftover backends hold port 8000
/usr/bin/pkill -9 -f tradeops_backend || true
/usr/bin/pkill -9 -f tradeops_server || true

# Detach a previous mount if present
hdiutil detach "{mountpoint}" -force >/dev/null 2>&1 || true

# Mount the new DMG
hdiutil attach -nobrowse -noautoopen -mountpoint "{mountpoint}" "{dmg}" || exit 11

if [ ! -d "{mountpoint}/TradeOps.app" ]; then
  echo "TradeOps.app not found inside DMG"
  hdiutil detach "{mountpoint}" -force >/dev/null 2>&1 || true
  exit 12
fi

# Replace the installed app
rm -rf /Applications/TradeOps.app
cp -R "{mountpoint}/TradeOps.app" /Applications/TradeOps.app

# Strip quarantine so launch-services doesn't block it
xattr -cr /Applications/TradeOps.app

# Unmount and clean
hdiutil detach "{mountpoint}" -force >/dev/null 2>&1 || true
rm -f "{dmg}"

# Re-launch the new version
/usr/bin/open /Applications/TradeOps.app

# Self-delete the helper
rm -f "{script}"
"#,
        log = log_path,
        mountpoint = mountpoint,
        dmg = dmg_path,
        script = script_path,
    );

    fs::write(script_path, script).map_err(|e| format!("script write failed: {e}"))?;

    // chmod +x
    fs::set_permissions(script_path, fs::Permissions::from_mode(0o755))
        .map_err(|e| format!("chmod failed: {e}"))?;

    // 3. Spawn the helper detached so it survives the parent quit
    Command::new("/bin/bash")
        .arg(script_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| format!("helper spawn failed: {e}"))?;

    // 4. Schedule our own exit on a background thread so this command can
    //    return cleanly to JS first.
    let app_clone = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(800));
        app_clone.exit(0);
    });

    Ok("update helper started — app will quit and re-launch".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![install_update, quit_app, mark_update_in_progress, consume_update_marker])
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

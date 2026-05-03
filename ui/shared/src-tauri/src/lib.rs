use std::fs;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

struct BackendState(Mutex<Option<tauri_plugin_shell::process::CommandChild>>);

// ──────────────────────────────────────────────────────────────────────────
// Process / port cleanup (called before spawning the sidecar so a stale
// previous-run instance doesn't keep hold of port 8000)
// ──────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
fn kill_existing_backends() {
    let _ = Command::new("/usr/bin/pkill")
        .args(["-9", "-f", "tradeops_backend"])
        .output();
    let _ = Command::new("/usr/bin/pkill")
        .args(["-9", "-f", "tradeops_server"])
        .output();
    let _ = Command::new("/bin/sh")
        .arg("-c")
        .arg("/usr/sbin/lsof -ti :8000 | xargs -r kill -9 2>/dev/null || true")
        .output();
    thread::sleep(Duration::from_millis(500));
}

#[cfg(target_os = "windows")]
fn kill_existing_backends() {
    // taskkill matches by image name; /F = force, /T = include child processes
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "tradeops_backend.exe", "/T"])
        .output();
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "tradeops_server.exe", "/T"])
        .output();
    thread::sleep(Duration::from_millis(500));
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn kill_existing_backends() {
    // Linux / other — same approach as macOS
    let _ = Command::new("pkill").args(["-9", "-f", "tradeops_backend"]).output();
    let _ = Command::new("pkill").args(["-9", "-f", "tradeops_server"]).output();
    thread::sleep(Duration::from_millis(500));
}

// ──────────────────────────────────────────────────────────────────────────
// Persistent app-support directory (per-user, survives across launches)
// ──────────────────────────────────────────────────────────────────────────

fn app_support_dir() -> std::path::PathBuf {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let mut p = std::path::PathBuf::from(home);
        p.push("Library");
        p.push("Application Support");
        p.push("TradeOps");
        let _ = std::fs::create_dir_all(&p);
        return p;
    }

    #[cfg(target_os = "windows")]
    {
        let base = std::env::var("APPDATA").unwrap_or_else(|_| {
            std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Temp".into())
        });
        let mut p = std::path::PathBuf::from(base);
        p.push("TradeOps");
        let _ = std::fs::create_dir_all(&p);
        return p;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".into());
        let mut p = std::path::PathBuf::from(home);
        p.push(".tradeops");
        let _ = std::fs::create_dir_all(&p);
        return p;
    }
}

// ──────────────────────────────────────────────────────────────────────────
// Tauri commands — generic
// ──────────────────────────────────────────────────────────────────────────

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

fn marker_path() -> std::path::PathBuf {
    let mut p = app_support_dir();
    p.push("update_in_progress.flag");
    p
}

#[tauri::command]
fn mark_update_in_progress() {
    let _ = std::fs::write(marker_path(), b"1");
}

#[tauri::command]
fn consume_update_marker() -> bool {
    let p = marker_path();
    if p.exists() {
        let _ = std::fs::remove_file(&p);
        return true;
    }
    false
}

// ──────────────────────────────────────────────────────────────────────────
// install_update — platform-specific helpers
// ──────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
async fn run_install_update(app: tauri::AppHandle, url: String) -> Result<String, String> {
    if url.trim().is_empty() {
        return Err("download_url is empty".into());
    }

    let dmg_path = "/tmp/tradeops_update.dmg";
    let script_path = "/tmp/tradeops_update.sh";
    let log_path = "/tmp/tradeops_update.log";

    let _ = fs::remove_file(dmg_path);
    let _ = fs::remove_file(script_path);

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

    let mountpoint = "/Volumes/TradeOpsUpdate";
    let script = format!(
        r#"#!/bin/bash
exec >"{log}" 2>&1
set -x

sleep 2
for i in $(seq 1 30); do
  if ! pgrep -f "TradeOps.app/Contents/MacOS/app" > /dev/null; then
    break
  fi
  sleep 1
done

/usr/bin/pkill -9 -f tradeops_backend || true
/usr/bin/pkill -9 -f tradeops_server || true

hdiutil detach "{mountpoint}" -force >/dev/null 2>&1 || true
hdiutil attach -nobrowse -noautoopen -mountpoint "{mountpoint}" "{dmg}" || exit 11

if [ ! -d "{mountpoint}/TradeOps.app" ]; then
  echo "TradeOps.app not found inside DMG"
  hdiutil detach "{mountpoint}" -force >/dev/null 2>&1 || true
  exit 12
fi

rm -rf /Applications/TradeOps.app
cp -R "{mountpoint}/TradeOps.app" /Applications/TradeOps.app
xattr -cr /Applications/TradeOps.app
hdiutil detach "{mountpoint}" -force >/dev/null 2>&1 || true
rm -f "{dmg}"

/usr/bin/open /Applications/TradeOps.app
rm -f "{script}"
"#,
        log = log_path,
        mountpoint = mountpoint,
        dmg = dmg_path,
        script = script_path,
    );

    fs::write(script_path, script).map_err(|e| format!("script write failed: {e}"))?;
    fs::set_permissions(script_path, fs::Permissions::from_mode(0o755))
        .map_err(|e| format!("chmod failed: {e}"))?;

    Command::new("/bin/bash")
        .arg(script_path)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| format!("helper spawn failed: {e}"))?;

    let app_clone = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(800));
        app_clone.exit(0);
    });

    Ok("update helper started — app will quit and re-launch".into())
}

#[cfg(target_os = "windows")]
async fn run_install_update(app: tauri::AppHandle, url: String) -> Result<String, String> {
    use std::path::PathBuf;

    if url.trim().is_empty() {
        return Err("download_url is empty".into());
    }

    let temp_dir = std::env::var("TEMP").unwrap_or_else(|_| "C:\\Windows\\Temp".into());
    let installer_path = PathBuf::from(&temp_dir).join("tradeops_update.exe");
    let helper_path = PathBuf::from(&temp_dir).join("tradeops_update.bat");
    let log_path = PathBuf::from(&temp_dir).join("tradeops_update.log");

    let _ = fs::remove_file(&installer_path);
    let _ = fs::remove_file(&helper_path);

    // Download with PowerShell (no curl dependency on older Windows)
    let ps_cmd = format!(
        "$ProgressPreference='SilentlyContinue'; Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
        url.replace('\'', "''"),
        installer_path.display()
    );
    let dl = Command::new("powershell")
        .args(["-NoProfile", "-Command", &ps_cmd])
        .output()
        .map_err(|e| format!("powershell spawn failed: {e}"))?;
    if !dl.status.success() {
        let err = String::from_utf8_lossy(&dl.stderr);
        return Err(format!("download failed: {err}"));
    }

    let meta = fs::metadata(&installer_path).map_err(|e| format!("installer missing: {e}"))?;
    if meta.len() < 1024 * 1024 {
        return Err(format!("downloaded file too small ({} bytes)", meta.len()));
    }

    // NSIS / MSI installers both accept /S (silent) — try /S first
    let script = format!(
        r#"@echo off
> "{log}" 2>&1 (
  echo waiting for app to quit...
  timeout /t 3 >nul
  taskkill /F /IM TradeOps.exe /T 2>nul
  taskkill /F /IM tradeops_backend.exe /T 2>nul
  taskkill /F /IM tradeops_server.exe /T 2>nul
  timeout /t 2 >nul

  echo running installer...
  "{installer}" /S
  if errorlevel 1 (
    echo silent install failed, trying msiexec...
    msiexec /i "{installer}" /qn
  )

  echo relaunching...
  start "" "%LOCALAPPDATA%\TradeOps\TradeOps.exe"
  if errorlevel 1 start "" "%PROGRAMFILES%\TradeOps\TradeOps.exe"

  del /q "{installer}"
  del /q "%~f0"
)
"#,
        log = log_path.display(),
        installer = installer_path.display(),
    );

    fs::write(&helper_path, script).map_err(|e| format!("helper write failed: {e}"))?;

    Command::new("cmd")
        .args(["/c", "start", "/B", "", helper_path.to_str().unwrap_or("")])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .stdin(Stdio::null())
        .spawn()
        .map_err(|e| format!("helper spawn failed: {e}"))?;

    let app_clone = app.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(800));
        app_clone.exit(0);
    });

    Ok("update helper started — app will quit and re-launch".into())
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
async fn run_install_update(_app: tauri::AppHandle, _url: String) -> Result<String, String> {
    Err("in-app update is not implemented on this platform".into())
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle, url: String) -> Result<String, String> {
    run_install_update(app, url).await
}

// ──────────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(BackendState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            install_update,
            quit_app,
            mark_update_in_progress,
            consume_update_marker,
        ])
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

                kill_existing_backends();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

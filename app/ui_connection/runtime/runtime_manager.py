from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any

from config.settings import load_settings


class RuntimeManager:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._logs: deque[str] = deque(maxlen=5000)

        self._server_process: subprocess.Popen | None = None
        self._server_reader_thread: threading.Thread | None = None
        self._server_monitor_thread: threading.Thread | None = None

        self._server_status = "stopped"
        self._server_requested = False
        self._server_restart_count = 0
        self._server_retry_limit = 5

        self._tws_process: subprocess.Popen | None = None
        self._tws_status = "stopped"

        self._stop_monitor = False

        self._settings = load_settings()
        self._base_dir = Path(__file__).resolve().parents[2]
        self._main_py_path = self._base_dir / "main.py"
        self._tws_app_path = Path(getattr(self._settings, "TWS_APP_PATH", "") or "")

        self._start_monitor_thread()

    # ---------------------------------------------------------
    # Internal helpers
    # ---------------------------------------------------------

    def _reload_settings(self) -> None:
        self._settings = load_settings()
        self._tws_app_path = Path(getattr(self._settings, "TWS_APP_PATH", "") or "")

    def _log(self, message: str) -> None:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}] {message}"
        with self._lock:
            self._logs.append(line)
        print(line, flush=True)

    def _start_monitor_thread(self) -> None:
        if self._server_monitor_thread and self._server_monitor_thread.is_alive():
            return

        self._server_monitor_thread = threading.Thread(
            target=self._monitor_server_loop,
            daemon=True,
        )
        self._server_monitor_thread.start()

    def _monitor_server_loop(self) -> None:
        while not self._stop_monitor:
            time.sleep(2)

            with self._lock:
                proc = self._server_process
                server_requested = self._server_requested
                restart_count = self._server_restart_count
                retry_limit = self._server_retry_limit

            if not proc:
                continue

            return_code = proc.poll()
            if return_code is None:
                continue

            with self._lock:
                self._server_process = None
                self._server_reader_thread = None

            if server_requested and restart_count < retry_limit:
                with self._lock:
                    self._server_restart_count += 1
                    retry_index = self._server_restart_count
                    self._server_status = "starting"

                self._log(
                    f"Server process stopped unexpectedly. Restart attempt {retry_index}/{retry_limit}."
                )
                try:
                    self._launch_server_process()
                except Exception as exc:
                    self._log(f"Server restart failed: {exc}")
            else:
                with self._lock:
                    self._server_status = "stopped"
                    if self._server_restart_count >= self._server_retry_limit:
                        self._server_requested = False

                if server_requested and restart_count >= retry_limit:
                    self._log(
                        "Server retry limit reached. Automatic restart has been stopped."
                    )
                else:
                    self._log("Server process stopped.")

    def _read_server_output(self, process: subprocess.Popen) -> None:
        if not process.stdout:
            return

        try:
            for line in iter(process.stdout.readline, ""):
                if not line:
                    break
                stripped = line.rstrip()
                if stripped:
                    self._log(stripped)
        except Exception as exc:
            self._log(f"Server log reader stopped: {exc}")

    def _launch_server_process(self) -> None:
        if not self._main_py_path.exists():
            raise FileNotFoundError(f"main.py not found: {self._main_py_path}")

        command = [sys.executable, str(self._main_py_path)]

        env = os.environ.copy()

        process = subprocess.Popen(
            command,
            cwd=str(self._base_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            universal_newlines=True,
            env=env,
            preexec_fn=os.setsid if sys.platform != "win32" else None,
        )

        with self._lock:
            self._server_process = process
            self._server_status = "running"

        self._server_reader_thread = threading.Thread(
            target=self._read_server_output,
            args=(process,),
            daemon=True,
        )
        self._server_reader_thread.start()

        self._log(f"Server process started. PID={process.pid}")

    def _quit_macos_app_by_name(self, app_name: str) -> None:
        applescript = f'tell application "{app_name}" to quit'
        subprocess.run(
            ["osascript", "-e", applescript],
            capture_output=True,
            text=True,
            check=False,
        )

    def _is_tws_alive(self) -> bool:
        with self._lock:
            proc = self._tws_process

        if proc and proc.poll() is None:
            return True

        app_name = self._tws_app_path.stem if self._tws_app_path else "Trader Workstation"
        result = subprocess.run(
            ["pgrep", "-f", app_name],
            capture_output=True,
            text=True,
            check=False,
        )
        return result.returncode == 0

    # ---------------------------------------------------------
    # Public runtime controls
    # ---------------------------------------------------------

    def start_tws(self) -> dict[str, Any]:
        self._reload_settings()

        if not self._tws_app_path.exists():
            raise FileNotFoundError(f"TWS app not found: {self._tws_app_path}")

        if self._is_tws_alive():
            with self._lock:
                self._tws_status = "running"
            self._log("TWS is already running.")
            return {"success": True, "message": "TWS already running."}

        if sys.platform == "darwin":
            process = subprocess.Popen(
                ["open", str(self._tws_app_path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        else:
            process = subprocess.Popen(
                [str(self._tws_app_path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )

        with self._lock:
            self._tws_process = process
            self._tws_status = "running"

        self._log(f"TWS launch command sent. PATH={self._tws_app_path}")
        return {"success": True, "message": "TWS started."}

    def stop_tws(self) -> dict[str, Any]:
        self._reload_settings()

        app_name = self._tws_app_path.stem if self._tws_app_path else "Trader Workstation"

        if sys.platform == "darwin":
            self._quit_macos_app_by_name(app_name)

        with self._lock:
            proc = self._tws_process

        if proc and proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=10)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

        with self._lock:
            self._tws_process = None
            self._tws_status = "stopped"

        self._log("TWS stop command sent.")
        return {"success": True, "message": "TWS stopped."}

    def restart_tws(self) -> dict[str, Any]:
        self._log("Restarting TWS...")
        self.stop_tws()
        time.sleep(1)
        return self.start_tws()

    def start_server(self) -> dict[str, Any]:
        self._reload_settings()

        with self._lock:
            if self._server_process and self._server_process.poll() is None:
                self._server_status = "running"
                self._log("Server is already running.")
                return {"success": True, "message": "Server already running."}

            self._server_requested = True
            self._server_restart_count = 0
            self._server_status = "starting"

        self._log("Starting server process...")
        self._launch_server_process()

        return {"success": True, "message": "Server started."}

    def stop_server(self) -> dict[str, Any]:
        with self._lock:
            self._server_requested = False
            proc = self._server_process

        if proc and proc.poll() is None:
            try:
                if sys.platform != "win32":
                    os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                else:
                    proc.terminate()
            except Exception:
                try:
                    proc.terminate()
                except Exception:
                    pass

            try:
                proc.wait(timeout=10)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

        with self._lock:
            self._server_process = None
            self._server_reader_thread = None
            self._server_status = "stopped"

        self._log("Server stopped.")
        return {"success": True, "message": "Server stopped."}

    def restart_server(self) -> dict[str, Any]:
        self._log("Restarting server...")
        self.stop_server()
        time.sleep(1)
        return self.start_server()

    def stop_all(self) -> dict[str, Any]:
        self._log("Stopping all runtime processes...")
        try:
            self.stop_server()
        except Exception as exc:
            self._log(f"Server stop failed during stop_all: {exc}")

        try:
            self.stop_tws()
        except Exception as exc:
            self._log(f"TWS stop failed during stop_all: {exc}")

        return {"success": True, "message": "All processes stopped."}

    def clear_logs(self) -> dict[str, Any]:
        with self._lock:
            self._logs.clear()
        self._log("Runtime log console cleared.")
        return {"success": True}

    def runtime_test(self) -> dict[str, Any]:
        self._reload_settings()

        result = {
            "success": True,
            "tws_path_exists": self._tws_app_path.exists(),
            "main_path_exists": self._main_py_path.exists(),
            "tws_path": str(self._tws_app_path),
            "main_py_path": str(self._main_py_path),
        }

        self._log(
            "Runtime test completed. "
            f"TWS_PATH_EXISTS={result['tws_path_exists']} | "
            f"MAIN_PATH_EXISTS={result['main_path_exists']}"
        )
        return result

    # ---------------------------------------------------------
    # Data for API
    # ---------------------------------------------------------

    def get_logs(self, limit: int = 500) -> list[str]:
        with self._lock:
            if limit <= 0:
                return list(self._logs)
            return list(self._logs)[-limit:]

    def get_status(self) -> dict[str, Any]:
        self._reload_settings()

        with self._lock:
            server_pid = (
                self._server_process.pid
                if self._server_process and self._server_process.poll() is None
                else None
            )

            if self._server_process and self._server_process.poll() is None:
                server_status = self._server_status
            else:
                server_status = "stopped" if self._server_status != "starting" else "starting"

            if self._is_tws_alive():
                self._tws_status = "running"
            else:
                self._tws_status = "stopped"

            return {
                "server_status": server_status,
                "server_pid": server_pid,
                "server_requested": self._server_requested,
                "server_restart_count": self._server_restart_count,
                "server_retry_limit": self._server_retry_limit,
                "tws_status": self._tws_status,
                "ibkr_mode": getattr(self._settings, "IBKR_MODE", "PAPER"),
                "app_timezone": getattr(self._settings, "APP_TIMEZONE", ""),
                "ibkr_port": str(getattr(self._settings, "IBKR_PORT", "")),
                "tws_path_exists": self._tws_app_path.exists(),
                "main_path_exists": self._main_py_path.exists(),
                "app_version": getattr(self._settings, "APP_VERSION", ""),
            }


runtime_manager = RuntimeManager()
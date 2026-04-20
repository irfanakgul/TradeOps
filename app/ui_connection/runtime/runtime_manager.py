from __future__ import annotations

import os
import sys
import time
import threading
import subprocess
from collections import deque
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from service.ui_log_helper import ui_log


class RuntimeManager:
    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._logs: deque[str] = deque(maxlen=2000)

        self._app_dir = Path(__file__).resolve().parents[2]
        self._env_path = self._app_dir / ".env_local"
        load_dotenv(self._env_path, override=True)

        self._main_py_path = self._app_dir / "main.py"
        self._tws_app_path = Path(os.getenv("TWS_APP_PATH", "").strip()).expanduser()

        self._server_process: subprocess.Popen[str] | None = None
        self._server_requested = False
        self._server_restart_count = 0
        self._server_retry_limit = 5
        self._watchdog_started = False
        self._reader_thread: threading.Thread | None = None

        self._append_log("RUNTIME", "Runtime manager initialized")
        self._start_watchdog()

    def _reload_env(self) -> None:
        load_dotenv(self._env_path, override=True)
        self._tws_app_path = Path(os.getenv("TWS_APP_PATH", "").strip()).expanduser()

    def _append_log(self, category: str, message: str) -> None:
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}][{category}] {message}"
        self._logs.append(line)
        ui_log(category, message)

    def clear_logs(self) -> dict[str, Any]:
        with self._lock:
            self._logs.clear()
            self._append_log("RUNTIME", "Log console cleared.")
            return {"success": True}

    def _is_tws_running(self) -> bool:
        try:
            result = subprocess.run(
                ["pgrep", "-f", "Trader Workstation"],
                capture_output=True,
                text=True,
                check=False,
            )
            return result.returncode == 0
        except Exception:
            return False

    def _server_is_running(self) -> bool:
        return self._server_process is not None and self._server_process.poll() is None

    def _read_server_output(self, process: subprocess.Popen[str]) -> None:
        try:
            if process.stdout is None:
                return

            for line in process.stdout:
                cleaned = line.rstrip()
                if cleaned:
                    self._logs.append(cleaned)
        except Exception as exc:
            self._append_log("SERVER", f"Log reader error: {exc}")

    def _spawn_server_locked(self) -> None:
        if self._server_is_running():
            return

        if not self._main_py_path.exists():
            raise FileNotFoundError(f"main.py not found: {self._main_py_path}")

        env = os.environ.copy()

        self._server_process = subprocess.Popen(
            [sys.executable, "-u", str(self._main_py_path)],
            cwd=str(self._app_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            text=True,
            bufsize=1,
            universal_newlines=True,
            env=env,
        )

        self._append_log(
            "SERVER",
            f"Server process start requested | PID={self._server_process.pid}",
        )

        self._reader_thread = threading.Thread(
            target=self._read_server_output,
            args=(self._server_process,),
            daemon=True,
        )
        self._reader_thread.start()

        time.sleep(1.2)

        if self._server_process.poll() is not None:
            exit_code = self._server_process.returncode
            self._server_process = None
            raise RuntimeError(f"Server exited immediately | EXIT_CODE={exit_code}")

    def _start_watchdog(self) -> None:
        if self._watchdog_started:
            return

        self._watchdog_started = True

        def watchdog_loop() -> None:
            while True:
                time.sleep(2)

                with self._lock:
                    if not self._server_requested:
                        continue

                    if self._server_restart_count >= self._server_retry_limit:
                        self._append_log(
                            "WATCHDOG",
                            f"Retry limit reached ({self._server_retry_limit}). Automatic restart stopped.",
                        )
                        self._server_requested = False
                        continue

                    if self._server_process is None:
                        try:
                            self._append_log("WATCHDOG", "Server missing. Restarting.")
                            self._spawn_server_locked()
                            self._server_restart_count += 1
                        except Exception as exc:
                            self._server_restart_count += 1
                            self._append_log("WATCHDOG", f"Restart failed: {exc}")
                        continue

                    exit_code = self._server_process.poll()
                    if exit_code is not None:
                        self._append_log(
                            "WATCHDOG",
                            f"Server stopped unexpectedly | EXIT_CODE={exit_code} | Restarting.",
                        )
                        self._server_process = None
                        try:
                            self._spawn_server_locked()
                            self._server_restart_count += 1
                        except Exception as exc:
                            self._server_restart_count += 1
                            self._append_log("WATCHDOG", f"Restart failed: {exc}")

        thread = threading.Thread(target=watchdog_loop, daemon=True)
        thread.start()

    def start_tws(self) -> dict[str, Any]:
        with self._lock:
            self._reload_env()

            if self._is_tws_running():
                self._append_log("TWS", "TWS is already running.")
                return self.get_status()

            if not self._tws_app_path.exists():
                raise FileNotFoundError(f"TWS app path not found: {self._tws_app_path}")

            subprocess.run(
                ["open", str(self._tws_app_path)],
                capture_output=True,
                text=True,
                check=False,
            )

            time.sleep(2)

            if not self._is_tws_running():
                raise RuntimeError("TWS did not start. Verify TWS_APP_PATH and macOS permissions.")

            self._append_log("TWS", "TWS started successfully.")
            return self.get_status()

    def stop_tws(self) -> dict[str, Any]:
        with self._lock:
            if not self._is_tws_running():
                self._append_log("TWS", "TWS already stopped.")
                return self.get_status()

            subprocess.run(
                ["osascript", "-e", 'tell application "Trader Workstation" to quit'],
                capture_output=True,
                text=True,
                check=False,
            )

            time.sleep(2)

            if self._is_tws_running():
                subprocess.run(
                    ["pkill", "-f", "Trader Workstation"],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                time.sleep(1)

            if self._is_tws_running():
                raise RuntimeError("TWS could not be stopped.")

            self._append_log("TWS", "TWS stopped successfully.")
            return self.get_status()

    def restart_tws(self) -> dict[str, Any]:
        with self._lock:
            self.stop_tws()
            time.sleep(1)
            return self.start_tws()

    def start_server(self) -> dict[str, Any]:
        with self._lock:
            if self._server_is_running():
                self._append_log("SERVER", "Server is already running.")
                return self.get_status()

            self._server_requested = True
            self._server_restart_count = 0
            self._spawn_server_locked()
            self._append_log("SERVER", "Server started successfully.")
            return self.get_status()

    def stop_server(self) -> dict[str, Any]:
        with self._lock:
            self._server_requested = False

            if not self._server_is_running():
                self._append_log("SERVER", "Server already stopped.")
                self._server_process = None
                return self.get_status()

            assert self._server_process is not None
            self._append_log("SERVER", "Stop requested.")
            self._server_process.terminate()

            try:
                self._server_process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._append_log("SERVER", "Terminate timeout. Killing process.")
                self._server_process.kill()
                self._server_process.wait(timeout=5)

            self._append_log("SERVER", "Server stopped successfully.")
            self._server_process = None
            return self.get_status()

    def restart_server(self) -> dict[str, Any]:
        with self._lock:
            self.stop_server()
            time.sleep(1)
            return self.start_server()

    def stop_all(self) -> dict[str, Any]:
        with self._lock:
            self._server_requested = False

        try:
            self.stop_server()
        except Exception as exc:
            self._append_log("RUNTIME", f"Stop server warning: {exc}")

        try:
            self.stop_tws()
        except Exception as exc:
            self._append_log("RUNTIME", f"Stop TWS warning: {exc}")

        self._append_log("RUNTIME", "All runtime processes were stopped.")
        return self.get_status()

    def runtime_test(self) -> dict[str, Any]:
        with self._lock:
            self._reload_env()

            tws_exists = self._tws_app_path.exists()
            main_exists = self._main_py_path.exists()

            self._append_log(
                "TEST",
                f"Runtime test completed | TWS path exists={tws_exists} | main.py exists={main_exists}",
            )

            return {
                "success": True,
                "tws_path_exists": tws_exists,
                "main_path_exists": main_exists,
                "tws_running": self._is_tws_running(),
                "server_running": self._server_is_running(),
                "ibkr_mode": os.getenv("IBKR_MODE", "UNKNOWN"),
                "app_timezone": os.getenv("APP_TIMEZONE", "-"),
                "ibkr_port": os.getenv("IBKR_PORT", "-"),
            }

    def verify_lock_password(self, password: str) -> bool:
        self._reload_env()
        expected = os.getenv("APP_LOCK_PASSWORD", "").strip()
        return password.strip() == expected

    def get_logs(self, limit: int = 400) -> list[str]:
        with self._lock:
            data = list(self._logs)
            return data[-limit:]

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            self._reload_env()

            server_running = self._server_is_running()
            tws_running = self._is_tws_running()

            server_status = (
                "running"
                if server_running
                else ("starting" if self._server_requested else "stopped")
            )

            return {
                "server_status": server_status,
                "server_pid": self._server_process.pid if self._server_process and server_running else None,
                "server_requested": self._server_requested,
                "server_restart_count": self._server_restart_count,
                "server_retry_limit": self._server_retry_limit,
                "tws_status": "running" if tws_running else "stopped",
                "ibkr_mode": os.getenv("IBKR_MODE", "UNKNOWN"),
                "app_timezone": os.getenv("APP_TIMEZONE", "-"),
                "ibkr_port": os.getenv("IBKR_PORT", "-"),
                "tws_path_exists": self._tws_app_path.exists(),
                "main_path_exists": self._main_py_path.exists(),
            }


runtime_manager = RuntimeManager()
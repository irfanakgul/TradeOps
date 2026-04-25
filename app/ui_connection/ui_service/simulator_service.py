from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from ui_connection.ui_repository.simulator_repository import (
    fetch_sim_actual_wallet,
    fetch_sim_wallet_history,
)
from ui_connection.ui_service.ui_users_service import resolve_effective_username


class SimulatorError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _app_dir() -> Path:
    return Path(__file__).resolve().parents[2]


def run_sim_wallet_update_pipeline(language: str = "en") -> dict:
    app_dir = _app_dir()

    result = subprocess.run(
        [sys.executable, "-m", "pipeline.run_sim_update_manual"],
        cwd=str(app_dir),
        capture_output=True,
        text=True,
        timeout=180,
    )

    output = f"{result.stdout or ''}\n{result.stderr or ''}"

    if result.returncode != 0:
        if (
            "ConnectionRefusedError" in output
            or "Connect call failed" in output
            or "API connection failed" in output
            or "Make sure API port" in output
        ):
            from config.settings import load_settings

            settings = load_settings()
            sim_mode = getattr(settings, "SIM_IBKR_MODE", getattr(settings, "IBKR_MODE", "PAPER"))
            sim_port = getattr(settings, "SIM_IBKR_PORT", getattr(settings, "IBKR_PORT", "-"))

            if language == "tr":
                message = (
                    f"TWS bağlantısı kurulamadı. Lütfen TWS uygulamasını başlatın, "
                    f"login olun ve API bağlantısının açık olduğundan emin olun. "
                    f"Aktif simulator trade modu: {sim_mode}. Port: {sim_port}."
                )
            else:
                message = (
                    f"TWS connection could not be established. Please start the TWS application, "
                    f"log in, and make sure the API connection is enabled. "
                    f"Active simulator trade mode: {sim_mode}. Port: {sim_port}."
                )

            raise SimulatorError(message, 400)

        raise SimulatorError(
            f"Simulator wallet update failed: {output}",
            500,
        )

    return {
        "success": True,
        "stdout": result.stdout,
    }

def get_simulator_wallet_overview(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None,
) -> dict:
    effective_username = resolve_effective_username(
        requesting_username=requesting_username,
        requesting_user_type=requesting_user_type,
        selected_username=selected_username,
    )

    latest_rows = fetch_sim_actual_wallet(effective_username)
    history_rows = fetch_sim_wallet_history(effective_username)

    latest_by_mode = {
        "PAPER": None,
        "LIVE": None,
    }

    for row in latest_rows:
        mode = str(row.get("ibkr_mode") or "").upper()
        if mode in latest_by_mode and latest_by_mode[mode] is None:
            latest_by_mode[mode] = row

    return {
        "username": effective_username,
        "latest": latest_by_mode,
        "history": history_rows,
    }


def update_and_get_simulator_wallet_overview(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None,
    language: str = "en",
) -> dict:
    pipeline_result = run_sim_wallet_update_pipeline(language=language)

    data = get_simulator_wallet_overview(
        requesting_username=requesting_username,
        requesting_user_type=requesting_user_type,
        selected_username=selected_username,
    )

    return {
        **data,
        "pipeline_result": pipeline_result,
    }
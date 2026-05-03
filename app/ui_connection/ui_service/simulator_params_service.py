from __future__ import annotations

from ui_connection.ui_repository.simulator_params_repository import (
    read_simulator_params,
    update_simulator_params,
)


class SimulatorParamsError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def get_simulator_params() -> dict:
    return {
        "success": True,
        "params": read_simulator_params(),
    }


def save_simulator_params(payload: dict) -> dict:
    params = payload.get("params") or {}

    mode = str(params.get("SIM_IBKR_MODE", "")).upper()
    if mode not in {"PAPER", "LIVE"}:
        raise SimulatorParamsError("SIM_IBKR_MODE must be PAPER or LIVE.", 400)

    try:
        port = int(params.get("SIM_IBKR_PORT"))
        client_id = int(params.get("SIM_IBKR_CLIENT_ID"))
    except Exception as exc:
        raise SimulatorParamsError("Port and Client ID must be integer.", 400) from exc

    if port <= 0:
        raise SimulatorParamsError("SIM_IBKR_PORT must be greater than 0.", 400)

    if client_id <= 0:
        raise SimulatorParamsError("SIM_IBKR_CLIENT_ID must be greater than 0.", 400)

    update_simulator_params(
        {
            "SIM_IBKR_MODE": mode,
            "SIM_IBKR_HOST": str(params.get("SIM_IBKR_HOST", "")).strip() or "127.0.0.1",
            "SIM_IBKR_PORT": str(port),
            "SIM_IBKR_CLIENT_ID": str(client_id),
        }
    )

    return {
        "success": True,
        "message": "Simulator parameters saved successfully.",
        "params": read_simulator_params(),
    }
"""
Simulator IBKR connection parameters.

Backed by user.open_parameters via parameter_service. Preserves the original
function names so existing callers continue to work.
"""

from __future__ import annotations

from ui_connection.ui_service.parameter_service import (
    get_param,
    read_local_cache,
    update_user_params_bulk,
    refresh_cache_for_user,
)


SIM_PARAM_KEYS = [
    "SIM_IBKR_MODE",
    "SIM_IBKR_HOST",
    "SIM_IBKR_PORT",
    "SIM_IBKR_CLIENT_ID",
]


def read_simulator_params() -> dict:
    return {
        "SIM_IBKR_MODE": get_param("SIM_IBKR_MODE") or "PAPER",
        "SIM_IBKR_HOST": get_param("SIM_IBKR_HOST") or "127.0.0.1",
        "SIM_IBKR_PORT": get_param("SIM_IBKR_PORT") or "7497",
        "SIM_IBKR_CLIENT_ID": get_param("SIM_IBKR_CLIENT_ID") or "1",
    }


def update_simulator_params(params: dict) -> None:
    cache = read_local_cache()
    username = cache.get("username") or ""
    if not username:
        return

    current = read_simulator_params()
    updates = {
        key: str(params.get(key, current.get(key, ""))).strip()
        for key in SIM_PARAM_KEYS
    }
    update_user_params_bulk(username, updates)
    refresh_cache_for_user(username)

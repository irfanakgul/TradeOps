"""
DB-backed configuration access used by the Trade Configurations page.

Historically this module read/wrote .env_local, config.env and exchanges.yaml
files directly. Those files have been replaced by user.open_parameters in DB.
This module preserves the old function names so existing callers work unchanged.
"""

from __future__ import annotations

import json

from sqlalchemy import text

from config.parameter_catalog import (
    EXCHANGE_DEFAULTS,
    SCALAR_PARAMETERS,
    exchange_param_key,
)
from ui_connection.ui_repository.engine import get_ui_engine
from ui_connection.ui_service.parameter_service import (
    refresh_cache_for_user,
    update_user_param,
    update_user_params_bulk,
    update_exchange_config,
)


# ---------------------------------------------------------------------------
# What "current user" means
# ---------------------------------------------------------------------------
# The legacy file-based functions had no notion of a user — they just read
# global files. We need a username for DB access. The cache (refreshed at
# login) records who is currently active.

def _current_username() -> str:
    from ui_connection.ui_service.parameter_service import read_local_cache
    cache = read_local_cache()
    return cache.get("username") or ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _fetch_user_param_map(username: str) -> dict[str, str]:
    """Single DB roundtrip to materialize all params for a user as { key: value }."""
    if not username:
        return {}
    query = text("""
        SELECT param_key, param_value
        FROM "user".open_parameters
        WHERE username = :username
    """)
    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()
    return {r["param_key"]: (r["param_value"] or "") for r in rows}


def _split_scalar_and_exchange(values: dict[str, str]) -> tuple[dict[str, str], list[dict]]:
    scalars: dict[str, str] = {}
    exchanges: list[dict] = []
    for key, value in values.items():
        if key.startswith("EXCHANGE_CONFIG__"):
            try:
                exchanges.append(json.loads(value))
            except (ValueError, TypeError):
                continue
        else:
            scalars[key] = value
    return scalars, exchanges


# ---------------------------------------------------------------------------
# Read API (used by trade_config_service to render the form)
# ---------------------------------------------------------------------------

def read_env_local() -> dict[str, str]:
    """All scalar params (covers what the .env_local section of the form uses)."""
    username = _current_username()
    raw = _fetch_user_param_map(username)
    scalars, _ = _split_scalar_and_exchange(raw)

    # Auto-derive IBKR_PORT from IBKR_MODE for backward compatibility
    ibkr_mode = (scalars.get("IBKR_MODE", "PAPER") or "PAPER").strip().upper()
    scalars["IBKR_MODE"] = ibkr_mode
    scalars["IBKR_PORT"] = "7496" if ibkr_mode == "LIVE" else "7497"

    # Fall back to catalog defaults for any missing keys
    for p in SCALAR_PARAMETERS:
        scalars.setdefault(p.key, p.default)

    return scalars


def read_config_env() -> dict[str, str]:
    """Same data source as read_env_local — the form schema separates fields by
    `file_group`, but the underlying storage is unified."""
    return read_env_local()


def read_exchange_yaml() -> list[dict]:
    """All exchange configs as a list of dicts (same shape as legacy YAML file)."""
    username = _current_username()
    raw = _fetch_user_param_map(username)
    _, exchanges = _split_scalar_and_exchange(raw)
    if exchanges:
        return exchanges
    # Fall back to catalog defaults so consumers always have data
    return [dict(ex) for ex in EXCHANGE_DEFAULTS]


# ---------------------------------------------------------------------------
# Write API
# ---------------------------------------------------------------------------

def write_env_local(updates: dict[str, str]) -> dict[str, str]:
    username = _current_username()
    if not username:
        return read_env_local()

    # Coerce IBKR_MODE/IBKR_PORT to keep them in sync
    if "IBKR_MODE" in updates:
        mode = updates["IBKR_MODE"].strip().upper()
        updates = {**updates, "IBKR_MODE": mode, "IBKR_PORT": "7496" if mode == "LIVE" else "7497"}

    update_user_params_bulk(username, updates)
    refresh_cache_for_user(username)
    return read_env_local()


def write_config_env(updates: dict[str, str]) -> dict[str, str]:
    username = _current_username()
    if not username:
        return read_config_env()
    update_user_params_bulk(username, updates)
    refresh_cache_for_user(username)
    return read_config_env()


def write_exchange_yaml(rows: list[dict]) -> list[dict]:
    username = _current_username()
    if not username:
        return read_exchange_yaml()
    for ex in rows:
        code = ex.get("EXCHANGE")
        if not code:
            continue
        update_exchange_config(username, code, ex)
    refresh_cache_for_user(username)
    return read_exchange_yaml()

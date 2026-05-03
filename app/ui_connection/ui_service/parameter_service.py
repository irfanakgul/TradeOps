"""
Parameter service: bridges DB-backed user.open_parameters with a local JSON
cache used by the runtime (settings.py and friends).

Flow:
  - Login success → refresh_cache_for_user(username) → snapshot DB into local JSON
  - settings.py / config_file_service → read_local_cache()
  - User edits in Trade Configurations → save → DB upsert → refresh cache
  - Register → seed_defaults_for_user(username) using catalog defaults
  - "Reset to defaults" button → reset_user_to_defaults(username) + refresh cache
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

from config.parameter_catalog import (
    EXCHANGE_DEFAULTS,
    EXCHANGE_PARAM_KEY_PREFIX,
    SCALAR_PARAMETERS,
    all_default_rows,
    exchange_code_from_key,
    exchange_param_key,
    is_exchange_param,
)
from ui_connection.ui_repository.parameter_repository import (
    fetch_all_for_user,
    insert_defaults_for_user,
    reset_to_defaults,
    upsert_many,
    upsert_param,
)


_LOCK = threading.RLock()


# ---------------------------------------------------------------------------
# Cache file location
# ---------------------------------------------------------------------------

def _persistent_dir() -> Path:
    target = Path.home() / "Library" / "Application Support" / "TradeOps"
    target.mkdir(parents=True, exist_ok=True)
    return target


def _cache_path() -> Path:
    return _persistent_dir() / "parameters_cache.json"


# ---------------------------------------------------------------------------
# Catalog helpers
# ---------------------------------------------------------------------------

def _catalog_defaults_dict() -> dict[str, str]:
    """{ param_key: param_default_value } from the static catalog."""
    out: dict[str, str] = {}
    for p in SCALAR_PARAMETERS:
        out[p.key] = p.default
    for ex in EXCHANGE_DEFAULTS:
        out[exchange_param_key(ex["EXCHANGE"])] = json.dumps(ex, sort_keys=False)
    return out


# ---------------------------------------------------------------------------
# Cache I/O
# ---------------------------------------------------------------------------

def _empty_cache() -> dict:
    return {"username": None, "params": {}}


def read_local_cache() -> dict:
    path = _cache_path()
    if not path.exists():
        return _empty_cache()
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return _empty_cache()


def write_local_cache(data: dict) -> None:
    with _LOCK:
        path = _cache_path()
        tmp = path.with_suffix(".json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, sort_keys=False, ensure_ascii=False)
        os.replace(tmp, path)


def get_param(key: str, default: str | None = None) -> str | None:
    """
    Fast read for runtime callers. Returns:
      1. Cached value (from logged-in user)
      2. Catalog default
      3. The supplied default
    """
    cache = read_local_cache()

    # USERNAME is a special top-level field on the cache (set at login).
    if key == "USERNAME":
        u = cache.get("username")
        if u:
            return u

    val = cache.get("params", {}).get(key)
    if val is not None and val != "":
        return val
    catalog = _catalog_defaults_dict()
    if key in catalog and catalog[key] != "":
        return catalog[key]
    return default


def get_param_int(key: str, default: int | None = None) -> int | None:
    raw = get_param(key, None)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return int(str(raw).strip())
    except (ValueError, TypeError):
        return default


def get_param_float(key: str, default: float | None = None) -> float | None:
    raw = get_param(key, None)
    if raw is None or str(raw).strip() == "":
        return default
    try:
        return float(str(raw).strip())
    except (ValueError, TypeError):
        return default


def get_param_bool(key: str, default: bool = False) -> bool:
    raw = get_param(key, None)
    if raw is None:
        return default
    return str(raw).strip().lower() in {"1", "true", "yes", "y", "on"}


def get_param_list(key: str, sep: str = ",", default: list[str] | None = None) -> list[str]:
    raw = get_param(key, None)
    if not raw:
        return default or []
    return [item.strip().upper() for item in str(raw).split(sep) if item.strip()]


def get_exchange_configs() -> list[dict]:
    """
    Materialize all exchange JSON-rows from cache into a list of dicts (same
    shape as the original exchanges.yaml content).
    """
    cache = read_local_cache()
    params = cache.get("params", {}) or {}
    out: list[dict] = []
    for key, raw in params.items():
        if not is_exchange_param(key):
            continue
        try:
            out.append(json.loads(raw))
        except (ValueError, TypeError):
            continue
    if not out:
        # Fall back to catalog defaults so the runtime never sees an empty list
        out = [dict(ex) for ex in EXCHANGE_DEFAULTS]
    return out


# ---------------------------------------------------------------------------
# Sync DB → cache
# ---------------------------------------------------------------------------

def refresh_cache_for_user(username: str) -> dict:
    """Pull user's params from DB, write them to local cache, return the cache."""
    rows = fetch_all_for_user(username)
    params: dict[str, str] = {}
    for r in rows:
        if r.get("param_value") is not None:
            params[r["param_key"]] = r["param_value"]

    cache = {"username": username, "params": params}
    write_local_cache(cache)
    return cache


# ---------------------------------------------------------------------------
# Register hook: seed all defaults for a new user
# ---------------------------------------------------------------------------

def seed_defaults_for_user(username: str) -> int:
    rows = all_default_rows()
    return insert_defaults_for_user(username, rows)


# ---------------------------------------------------------------------------
# Update single / many params (called from Trade Config save)
# ---------------------------------------------------------------------------

def update_user_param(username: str, key: str, value: str) -> None:
    upsert_param(
        username=username,
        param_key=key,
        param_value=value,
    )


def update_user_params_bulk(username: str, kv: dict[str, str]) -> int:
    rows = [{"param_key": k, "param_value": v} for k, v in kv.items()]
    return upsert_many(username, rows)


def update_exchange_config(username: str, exchange_code: str, config: dict) -> None:
    upsert_param(
        username=username,
        param_key=exchange_param_key(exchange_code),
        param_value=json.dumps(config, sort_keys=False),
    )


# ---------------------------------------------------------------------------
# Reset to defaults (Trade Config "Reset Parameters" button)
# ---------------------------------------------------------------------------

def reset_user_to_defaults(username: str) -> int:
    """Set every value back to its param_default. Returns row count."""
    # Make sure user has all current catalog defaults seeded first
    seed_defaults_for_user(username)
    n = reset_to_defaults(username)
    refresh_cache_for_user(username)
    return n


__all__ = [
    "EXCHANGE_PARAM_KEY_PREFIX",
    "exchange_code_from_key",
    "exchange_param_key",
    "get_exchange_configs",
    "get_param",
    "get_param_bool",
    "get_param_float",
    "get_param_int",
    "get_param_list",
    "is_exchange_param",
    "read_local_cache",
    "refresh_cache_for_user",
    "reset_user_to_defaults",
    "seed_defaults_for_user",
    "update_exchange_config",
    "update_user_param",
    "update_user_params_bulk",
    "write_local_cache",
]

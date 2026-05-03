"""
Trade Configurations service.

All reads/writes go through DB (user.open_parameters) via parameter_service.
The form schema (TRADE_CONFIG_SCHEMA) tells the UI which fields are editable
and how to render them.
"""

from __future__ import annotations

from copy import deepcopy

from ui_connection.ui_repository.trade_config_repository import (
    insert_trade_config_log,
)
from ui_connection.ui_service.config_file_service import (
    read_config_env,
    read_env_local,
    read_exchange_yaml,
    write_config_env,
    write_env_local,
    write_exchange_yaml,
)
from ui_connection.ui_service.parameter_service import (
    refresh_cache_for_user,
    reset_user_to_defaults,
    seed_defaults_for_user,
)
from ui_connection.ui_service.trade_config_schema import TRADE_CONFIG_SCHEMA
from ui_connection.ui_service.ui_users_service import resolve_effective_username


class TradeConfigError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


# -------------------------
# TYPE HELPERS
# -------------------------

def _as_string(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _cast_value_by_type(raw_value, value_type: str):
    if value_type == "int":
        return int(str(raw_value).strip())
    if value_type == "float":
        return float(str(raw_value).strip())
    if value_type == "bool":
        return str(raw_value).strip().lower() in {"1", "true", "yes", "on"}
    return str(raw_value).strip()


def _field_meta_map(file_group: str) -> dict[str, dict]:
    return {item["key"]: item for item in TRADE_CONFIG_SCHEMA[file_group]["fields"]}


# -------------------------
# BUILD SECTIONS (DB-backed)
# -------------------------

def _build_env_local_section(values: dict[str, str]) -> dict:
    fields = []
    for meta in TRADE_CONFIG_SCHEMA["env_local"]["fields"]:
        fields.append({
            "key": meta["key"],
            "label": meta["label"],
            "description": meta["description"],
            "type": meta["type"],
            "editable": meta["editable"],
            "value": values.get(meta["key"], ""),
        })
    return {
        "file_group": "env_local",
        "title": TRADE_CONFIG_SCHEMA["env_local"]["title"],
        "fields": fields,
    }


def _build_config_env_section(values: dict[str, str]) -> dict:
    fields = []
    for meta in TRADE_CONFIG_SCHEMA["config_env"]["fields"]:
        fields.append({
            "key": meta["key"],
            "label": meta["label"],
            "description": meta["description"],
            "type": meta["type"],
            "editable": meta["editable"],
            "value": values.get(meta["key"], ""),
        })
    return {
        "file_group": "config_env",
        "title": TRADE_CONFIG_SCHEMA["config_env"]["title"],
        "fields": fields,
    }


def _build_exchange_yaml_section(exchanges: list[dict]) -> dict:
    rows = []
    for exchange in exchanges:
        row_fields = []
        for meta in TRADE_CONFIG_SCHEMA["exchange_yaml"]["fields"]:
            row_fields.append({
                "key": meta["key"],
                "label": meta["label"],
                "description": meta["description"],
                "type": meta["type"],
                "editable": meta["editable"],
                "value": exchange.get(meta["key"], ""),
            })
        rows.append({
            "exchange_code": exchange.get("EXCHANGE"),
            "fields": row_fields,
        })
    return {
        "file_group": "exchange_yaml",
        "title": TRADE_CONFIG_SCHEMA["exchange_yaml"]["title"],
        "rows": rows,
    }


# -------------------------
# MAIN GET
# -------------------------

def _ensure_user_seeded(username: str) -> None:
    """Make sure this user has all catalog defaults available in DB."""
    if not username:
        return
    seed_defaults_for_user(username)  # ON CONFLICT DO NOTHING — cheap idempotent


def get_trade_configurations(requesting_username, requesting_user_type, selected_username):
    effective_username = resolve_effective_username(
        requesting_username, requesting_user_type, selected_username,
    )
    _ensure_user_seeded(effective_username)

    # Live DB read (do NOT use the cache — Trade Config page must show ground truth)
    refresh_cache_for_user(effective_username)
    env_values = read_env_local()
    cfg_values = read_config_env()
    exchanges = read_exchange_yaml()

    return {
        "username": effective_username,
        "sections": [
            _build_env_local_section(env_values),
            _build_config_env_section(cfg_values),
            _build_exchange_yaml_section(exchanges),
        ],
    }


# -------------------------
# SAVE (writes to DB, refreshes cache)
# -------------------------

def save_trade_configurations(requesting_username, requesting_user_type, selected_username, payload):
    effective_username = resolve_effective_username(
        requesting_username, requesting_user_type, selected_username,
    )
    _ensure_user_seeded(effective_username)

    sections = payload.get("sections", [])

    # Snapshot current state for change-log diff
    current_env = read_env_local()
    current_cfg = read_config_env()
    current_exchanges = read_exchange_yaml()
    yaml_updates = deepcopy(current_exchanges)

    env_updates: dict[str, str] = {}
    cfg_updates: dict[str, str] = {}

    for section in sections:
        fg = section.get("file_group")

        if fg == "env_local":
            meta_map = _field_meta_map("env_local")
            for field in section.get("fields", []):
                key = field["key"]
                meta = meta_map.get(key)
                if not meta or not meta["editable"]:
                    continue
                value = _cast_value_by_type(field["value"], meta["type"])
                old = current_env.get(key, "")
                env_updates[key] = _as_string(value)
                if _as_string(old) != _as_string(value):
                    insert_trade_config_log(
                        effective_username, fg, key, None,
                        _as_string(old), _as_string(value), "MANUAL_EDIT",
                    )

        elif fg == "config_env":
            meta_map = _field_meta_map("config_env")
            for field in section.get("fields", []):
                key = field["key"]
                meta = meta_map.get(key)
                if not meta or not meta["editable"]:
                    continue
                value = _cast_value_by_type(field["value"], meta["type"])
                old = current_cfg.get(key, "")
                cfg_updates[key] = _as_string(value)
                if _as_string(old) != _as_string(value):
                    insert_trade_config_log(
                        effective_username, fg, key, None,
                        _as_string(old), _as_string(value), "MANUAL_EDIT",
                    )

        elif fg == "exchange_yaml":
            meta_map = _field_meta_map("exchange_yaml")
            for row in section.get("rows", []):
                exch = row["exchange_code"]
                target = next((x for x in yaml_updates if x["EXCHANGE"] == exch), None)
                if not target:
                    continue
                for field in row["fields"]:
                    key = field["key"]
                    meta = meta_map.get(key)
                    if not meta or not meta["editable"]:
                        continue
                    value = _cast_value_by_type(field["value"], meta["type"])
                    old = target.get(key)
                    target[key] = value
                    if _as_string(old) != _as_string(value):
                        insert_trade_config_log(
                            effective_username, fg, key, exch,
                            _as_string(old), _as_string(value), "MANUAL_EDIT",
                        )

    # Persist + refresh cache
    if env_updates:
        write_env_local(env_updates)
    if cfg_updates:
        write_config_env(cfg_updates)
    write_exchange_yaml(yaml_updates)

    refresh_cache_for_user(effective_username)

    return {
        "success": True,
        **get_trade_configurations(effective_username, "CLIENT", effective_username),
    }


# -------------------------
# RESET TO DEFAULTS
# -------------------------

def reset_trade_configurations_to_default(requesting_username, requesting_user_type, selected_username):
    effective_username = resolve_effective_username(
        requesting_username, requesting_user_type, selected_username,
    )

    n = reset_user_to_defaults(effective_username)
    insert_trade_config_log(
        effective_username, "ALL", "RESET", None,
        "(prev)", f"{n} params restored to defaults", "RESET_DEFAULT",
    )

    return {
        "success": True,
        "reset_count": n,
        **get_trade_configurations(effective_username, "CLIENT", effective_username),
    }


# -------------------------
# LOGIN SYNC (called from login_service after successful auth)
# -------------------------

def sync_default_parameters_on_login(username: str):
    """
    On login, make sure the user's params are seeded in DB and the local cache
    reflects this user's current values. Called after successful authentication.
    """
    if not username:
        return None
    _ensure_user_seeded(username)
    refresh_cache_for_user(username)
    return {"message": "User parameters synced to local cache."}

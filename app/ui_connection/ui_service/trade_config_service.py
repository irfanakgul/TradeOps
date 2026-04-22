from __future__ import annotations

from copy import deepcopy

from ui_connection.ui_repository.trade_config_repository import (
    fetch_default_parameters,
    fetch_user_default_flag,
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
# BUILD SECTIONS
# -------------------------

def _build_env_local_section() -> dict:
    values = read_env_local()
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


def _build_config_env_section() -> dict:
    values = read_config_env()
    fields = []

    for meta in TRADE_CONFIG_SCHEMA["config_env"]["fields"]:
        value = values.get(meta["key"], "")

        fields.append({
            "key": meta["key"],
            "label": meta["label"],
            "description": meta["description"],
            "type": meta["type"],
            "editable": meta["editable"],
            "value": value,
        })

    return {
        "file_group": "config_env",
        "title": TRADE_CONFIG_SCHEMA["config_env"]["title"],
        "fields": fields,
    }


def _build_exchange_yaml_section() -> dict:
    exchanges = read_exchange_yaml()
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

def get_trade_configurations(requesting_username, requesting_user_type, selected_username):
    effective_username = resolve_effective_username(
        requesting_username,
        requesting_user_type,
        selected_username,
    )

    return {
        "username": effective_username,
        "sections": [
            _build_env_local_section(),
            _build_config_env_section(),
            _build_exchange_yaml_section(),
        ],
    }


# -------------------------
# SAVE
# -------------------------

def save_trade_configurations(requesting_username, requesting_user_type, selected_username, payload):
    effective_username = resolve_effective_username(
        requesting_username,
        requesting_user_type,
        selected_username,
    )

    sections = payload.get("sections", [])

    current_env = read_env_local()
    current_cfg = read_config_env()
    current_yaml = read_exchange_yaml()

    env_updates = {}
    cfg_updates = {}
    yaml_updates = deepcopy(current_yaml)

    for section in sections:
        fg = section.get("file_group")

        # ENV LOCAL
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
                        _as_string(old), _as_string(value), "MANUAL_EDIT"
                    )

        # CONFIG ENV
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
                        _as_string(old), _as_string(value), "MANUAL_EDIT"
                    )

        # YAML
        elif fg == "exchange_yaml":
            meta_map = _field_meta_map("exchange_yaml")

            for row in section.get("rows", []):
                exch = row["exchange_code"]

                target = next(
                    (x for x in yaml_updates if x["EXCHANGE"] == exch),
                    None,
                )
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
                            _as_string(old), _as_string(value), "MANUAL_EDIT"
                        )

    if env_updates:
        write_env_local(env_updates)

    if cfg_updates:
        write_config_env(cfg_updates)

    write_exchange_yaml(yaml_updates)

    return {
        "success": True,
        **get_trade_configurations(effective_username, "CLIENT", effective_username),
    }


# -------------------------
# RESET DEFAULT
# -------------------------

def reset_trade_configurations_to_default(requesting_username, requesting_user_type, selected_username):
    effective_username = resolve_effective_username(
        requesting_username,
        requesting_user_type,
        selected_username,
    )

    defaults = fetch_default_parameters(effective_username)

    env_updates = {}
    cfg_updates = {}
    yaml_updates = deepcopy(read_exchange_yaml())

    for row in defaults:
        fg = row["file_group"]
        key = row["parameter_key"]
        exch = row["exchange_code"]
        value = _cast_value_by_type(row["parameter_value"], row["value_type"])

        if fg == "env_local":
            env_updates[key] = _as_string(value)

        elif fg == "config_env":
            cfg_updates[key] = _as_string(value)

        elif fg == "exchange_yaml":
            target = next((x for x in yaml_updates if x["EXCHANGE"] == exch), None)
            if target:
                target[key] = value

        insert_trade_config_log(
            effective_username, fg, key, exch,
            "(reset)", _as_string(value), "RESET_DEFAULT"
        )

    if env_updates:
        write_env_local(env_updates)

    if cfg_updates:
        write_config_env(cfg_updates)

    write_exchange_yaml(yaml_updates)

    return {
        "success": True,
        **get_trade_configurations(effective_username, "CLIENT", effective_username),
    }


# -------------------------
# LOGIN SYNC
# -------------------------

def sync_default_parameters_on_login(username: str):
    if not fetch_user_default_flag(username):
        return None

    defaults = fetch_default_parameters(username)

    env_updates = {}
    cfg_updates = {}
    yaml_updates = deepcopy(read_exchange_yaml())

    for row in defaults:
        fg = row["file_group"]
        key = row["parameter_key"]
        exch = row["exchange_code"]
        value = _cast_value_by_type(row["parameter_value"], row["value_type"])

        if fg == "env_local":
            env_updates[key] = _as_string(value)

        elif fg == "config_env":
            cfg_updates[key] = _as_string(value)

        elif fg == "exchange_yaml":
            target = next((x for x in yaml_updates if x["EXCHANGE"] == exch), None)
            if target:
                target[key] = value

        insert_trade_config_log(
            username, fg, key, exch,
            "(login-sync)", _as_string(value), "LOGIN_DEFAULT_SYNC"
        )

    if env_updates:
        write_env_local(env_updates)

    if cfg_updates:
        write_config_env(cfg_updates)

    write_exchange_yaml(yaml_updates)

    return {
        "message": "Default parameters applied from server."
    }
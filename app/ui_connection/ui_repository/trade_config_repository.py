from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_user_default_flag(username: str) -> bool:
    query = text("""
        SELECT "IS_DEFAULT_PARAMS"
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE "USERNAME" = :username
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"username": username}).fetchone()

    return bool(row[0]) if row else False


def fetch_default_parameters(username: str) -> list[dict]:
    query = text("""
        SELECT
            username,
            file_group,
            exchange_code,
            parameter_key,
            parameter_value,
            value_type,
            updated_at
        FROM "user".default_parameters
        WHERE username = :username
        ORDER BY file_group, exchange_code NULLS FIRST, parameter_key
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()

    return [dict(row) for row in rows]


def insert_trade_config_log(
    username: str,
    file_group: str,
    parameter_key: str,
    exchange_code: str | None,
    old_value: str,
    new_value: str,
    change_source: str,
) -> None:
    query = text("""
        INSERT INTO live.app_logs (
            username,
            event_type,
            event_status,
            message,
            details_json,
            created_at
        )
        VALUES (
            :username,
            'TRADE_CONFIG_CHANGE',
            'SUCCESS',
            :message,
            CAST(:details_json AS jsonb),
            NOW()
        )
    """)

    import json

    details = {
        "file_group": file_group,
        "parameter_key": parameter_key,
        "exchange_code": exchange_code,
        "old_value": old_value,
        "new_value": new_value,
        "change_source": change_source,
    }

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(
            query,
            {
                "username": username,
                "message": f"Trade config changed: {file_group}.{parameter_key}",
                "details_json": json.dumps(details),
            },
        )
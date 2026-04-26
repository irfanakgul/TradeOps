"""
Database access layer for "user".open_parameters.

One row per (username, param_key). Exchange configurations are stored as JSON
strings under composite keys (see config.parameter_catalog).
"""

from __future__ import annotations

from typing import Sequence

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_all_for_user(username: str) -> list[dict]:
    query = text("""
        SELECT
            username,
            param_key,
            param_value,
            param_default,
            param_location,
            param_desc,
            last_updated_at
        FROM "user".open_parameters
        WHERE username = :username
        ORDER BY param_key
    """)
    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()
    return [dict(r) for r in rows]


def fetch_value(username: str, param_key: str) -> str | None:
    query = text("""
        SELECT param_value FROM "user".open_parameters
        WHERE username = :username AND param_key = :param_key
        LIMIT 1
    """)
    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"username": username, "param_key": param_key}).fetchone()
    return row[0] if row else None


def upsert_param(
    *,
    username: str,
    param_key: str,
    param_value: str,
    param_default: str | None = None,
    param_location: str | None = None,
    param_desc: str | None = None,
) -> None:
    """Insert or update a single parameter. param_default is only set on insert."""
    query = text("""
        INSERT INTO "user".open_parameters
            (username, param_key, param_value, param_default, param_location, param_desc, last_updated_at)
        VALUES
            (:username, :param_key, :param_value, :param_default, :param_location, :param_desc, NOW())
        ON CONFLICT (username, param_key) DO UPDATE SET
            param_value = EXCLUDED.param_value,
            param_location = COALESCE(EXCLUDED.param_location, "user".open_parameters.param_location),
            param_desc = COALESCE(EXCLUDED.param_desc, "user".open_parameters.param_desc),
            last_updated_at = NOW()
    """)
    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {
            "username": username,
            "param_key": param_key,
            "param_value": param_value,
            "param_default": param_default,
            "param_location": param_location,
            "param_desc": param_desc,
        })


def upsert_many(username: str, rows: Sequence[dict]) -> int:
    """Bulk upsert. Each row must contain param_key/param_value/param_default/param_location/param_desc."""
    if not rows:
        return 0
    query = text("""
        INSERT INTO "user".open_parameters
            (username, param_key, param_value, param_default, param_location, param_desc, last_updated_at)
        VALUES
            (:username, :param_key, :param_value, :param_default, :param_location, :param_desc, NOW())
        ON CONFLICT (username, param_key) DO UPDATE SET
            param_value = EXCLUDED.param_value,
            param_default = COALESCE("user".open_parameters.param_default, EXCLUDED.param_default),
            param_location = COALESCE(EXCLUDED.param_location, "user".open_parameters.param_location),
            param_desc = COALESCE(EXCLUDED.param_desc, "user".open_parameters.param_desc),
            last_updated_at = NOW()
    """)
    engine = get_ui_engine()
    with engine.begin() as conn:
        for r in rows:
            conn.execute(query, {
                "username": username,
                "param_key": r["param_key"],
                "param_value": r["param_value"],
                "param_default": r.get("param_default"),
                "param_location": r.get("param_location"),
                "param_desc": r.get("param_desc"),
            })
    return len(rows)


def insert_defaults_for_user(username: str, default_rows: Sequence[dict]) -> int:
    """
    Seed defaults for a brand-new user. Skips rows that already exist.
    param_default and param_value both initialized to the default value.
    """
    query = text("""
        INSERT INTO "user".open_parameters
            (username, param_key, param_value, param_default, param_location, param_desc, last_updated_at)
        VALUES
            (:username, :param_key, :param_value, :param_default, :param_location, :param_desc, NOW())
        ON CONFLICT (username, param_key) DO NOTHING
    """)
    engine = get_ui_engine()
    with engine.begin() as conn:
        for r in default_rows:
            conn.execute(query, {
                "username": username,
                "param_key": r["param_key"],
                "param_value": r["param_value"],
                "param_default": r["param_default"],
                "param_location": r.get("param_location"),
                "param_desc": r.get("param_desc"),
            })
    return len(default_rows)


def reset_to_defaults(username: str) -> int:
    """Set every param_value back to its param_default for this user."""
    query = text("""
        UPDATE "user".open_parameters
        SET param_value = param_default,
            last_updated_at = NOW()
        WHERE username = :username
    """)
    engine = get_ui_engine()
    with engine.begin() as conn:
        result = conn.execute(query, {"username": username})
    return result.rowcount or 0

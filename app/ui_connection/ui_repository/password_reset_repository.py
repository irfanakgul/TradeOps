from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def get_user_for_password_reset(email: str) -> dict | None:
    query = text("""
        SELECT
            "ID",
            "USERNAME",
            "EMAIL",
            "IS_ACTIVE",
            "DEVICE_ID"
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE LOWER("EMAIL") = LOWER(:email)
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"email": email}).mappings().first()
        return dict(row) if row else None


def save_password_reset_token(user_id: int, token: str, expires_at) -> None:
    query = text("""
        UPDATE "user"."REGISTERED_USER_DETAILS"
        SET
            "PASSWORD_RESET_TOKEN" = :token,
            "PASSWORD_RESET_EXPIRES_AT" = :expires_at,
            "UPDATED_AT" = CURRENT_TIMESTAMP
        WHERE "ID" = :user_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(
            query,
            {
                "user_id": user_id,
                "token": token,
                "expires_at": expires_at,
            },
        )


def get_user_by_reset_token(token: str) -> dict | None:
    query = text("""
        SELECT
            "ID",
            "USERNAME",
            "EMAIL",
            "PASSWORD_RESET_TOKEN",
            "PASSWORD_RESET_EXPIRES_AT"
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE "PASSWORD_RESET_TOKEN" = :token
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"token": token}).mappings().first()
        return dict(row) if row else None


def update_password_and_clear_reset(user_id: int, password_hash: str) -> None:
    query = text("""
        UPDATE "user"."REGISTERED_USER_DETAILS"
        SET
            "PASSWORD_HASH" = :password_hash,
            "PASSWORD_RESET_TOKEN" = NULL,
            "PASSWORD_RESET_EXPIRES_AT" = NULL,
            "FAILED_LOGIN_COUNT" = 0,
            "UPDATED_AT" = CURRENT_TIMESTAMP
        WHERE "ID" = :user_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(
            query,
            {
                "user_id": user_id,
                "password_hash": password_hash,
            },
        )
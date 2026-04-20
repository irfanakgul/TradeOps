from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def get_user_by_email(email: str) -> dict | None:
    query = text("""
        SELECT
            "ID",
            "USERNAME",
            "EMAIL",
            "PASSWORD_HASH",
            "DEVICE_ID",
            "IS_ACTIVE",
            "STATUS_REASON",
            "USER_TYPE",
            "FAILED_LOGIN_COUNT"
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE LOWER("EMAIL") = LOWER(:email)
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"email": email}).mappings().first()
        return dict(row) if row else None


def reset_failed_login_count(user_id: int) -> None:
    query = text("""
        UPDATE "user"."REGISTERED_USER_DETAILS"
        SET
            "FAILED_LOGIN_COUNT" = 0,
            "UPDATED_AT" = CURRENT_TIMESTAMP
        WHERE "ID" = :user_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"user_id": user_id})


def increment_failed_login_count(user_id: int) -> int:
    query = text("""
        UPDATE "user"."REGISTERED_USER_DETAILS"
        SET
            "FAILED_LOGIN_COUNT" = COALESCE("FAILED_LOGIN_COUNT", 0) + 1,
            "UPDATED_AT" = CURRENT_TIMESTAMP
        WHERE "ID" = :user_id
        RETURNING "FAILED_LOGIN_COUNT"
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        row = conn.execute(query, {"user_id": user_id}).first()

    if row is None:
        raise ValueError("Failed to increment login count.")

    return int(row[0])


def deactivate_user(user_id: int, status_reason: str) -> None:
    query = text("""
        UPDATE "user"."REGISTERED_USER_DETAILS"
        SET
            "IS_ACTIVE" = 'DEACTIVE',
            "STATUS_REASON" = :status_reason,
            "UPDATED_AT" = CURRENT_TIMESTAMP
        WHERE "ID" = :user_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"user_id": user_id, "status_reason": status_reason})


def update_last_login(user_id: int) -> None:
    query = text("""
        UPDATE "user"."REGISTERED_USER_DETAILS"
        SET
            "LAST_LOGIN_AT" = CURRENT_TIMESTAMP,
            "UPDATED_AT" = CURRENT_TIMESTAMP
        WHERE "ID" = :user_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"user_id": user_id})


def insert_login_log(
    username: str | None,
    email: str | None,
    device_id: str | None,
    event_type: str,
    success: bool,
    failure_reason: str | None = None,
    responsibility_approved: bool | None = None,
) -> None:
    query = text("""
        INSERT INTO "user"."LOGIN_LOGS" (
            "USERNAME",
            "EMAIL",
            "DEVICE_ID",
            "EVENT_TYPE",
            "SUCCESS",
            "FAILURE_REASON",
            "RESPONSIBILITY_APPROVED"
        )
        VALUES (
            :username,
            :email,
            :device_id,
            :event_type,
            :success,
            :failure_reason,
            :responsibility_approved
        )
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(
            query,
            {
                "username": username,
                "email": email,
                "device_id": device_id,
                "event_type": event_type,
                "success": success,
                "failure_reason": failure_reason,
                "responsibility_approved": responsibility_approved,
            },
        )
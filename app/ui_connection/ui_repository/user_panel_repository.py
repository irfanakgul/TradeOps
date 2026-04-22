from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def get_registered_user_by_username(username: str) -> dict | None:
    query = text("""
        SELECT
            "ID",
            "USERNAME",
            "EMAIL",
            "PASSWORD_HASH",
            "FIRST_NAME",
            "LAST_NAME",
            "DATE_OF_BIRTH",
            "MOBILE_PHONE",
            "APP_LOCK_PASSWORD",
            "USER_TYPE"
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE "USERNAME" = :username
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"username": username}).mappings().first()

    return dict(row) if row else None


def update_registered_user_profile(
    user_id: int,
    username: str,
    email: str,
    first_name: str,
    last_name: str,
    date_of_birth,
    mobile_phone: str,
    password_hash: str | None,
    app_lock_password: str | None,
) -> None:
    query = text("""
        UPDATE "user"."REGISTERED_USER_DETAILS"
        SET
            "USERNAME" = :username,
            "EMAIL" = :email,
            "FIRST_NAME" = :first_name,
            "LAST_NAME" = :last_name,
            "DATE_OF_BIRTH" = :date_of_birth,
            "MOBILE_PHONE" = :mobile_phone,
            "PASSWORD_HASH" = COALESCE(:password_hash, "PASSWORD_HASH"),
            "APP_LOCK_PASSWORD" = COALESCE(:app_lock_password, "APP_LOCK_PASSWORD"),
            "UPDATED_AT" = NOW()
        WHERE "ID" = :user_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(
            query,
            {
                "user_id": user_id,
                "username": username,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "date_of_birth": date_of_birth,
                "mobile_phone": mobile_phone,
                "password_hash": password_hash,
                "app_lock_password": app_lock_password,
            },
        )


def delete_registered_user(user_id: int) -> None:
    query = text("""
        DELETE FROM "user"."REGISTERED_USER_DETAILS"
        WHERE "ID" = :user_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"user_id": user_id})


def username_exists(username: str, exclude_user_id: int | None = None) -> bool:
    query = text("""
        SELECT 1
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE "USERNAME" = :username
          AND (:exclude_user_id IS NULL OR "ID" <> :exclude_user_id)
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(
            query,
            {"username": username, "exclude_user_id": exclude_user_id},
        ).fetchone()

    return row is not None


def email_exists(email: str, exclude_user_id: int | None = None) -> bool:
    query = text("""
        SELECT 1
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE "EMAIL" = :email
          AND (:exclude_user_id IS NULL OR "ID" <> :exclude_user_id)
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(
            query,
            {"email": email, "exclude_user_id": exclude_user_id},
        ).fetchone()

    return row is not None


def mark_user_related_trade_tables_deleted(username: str) -> None:
    table_names = [
        "live.user_actual_wallet",
        "live.user_ibkr_wallet_details",
        "live.user_open_position_details",
        "live.user_order_details",
        "live.user_position_runtime",
        "live.buy_limits",
        "live.user_trade_log",
        "live.app_logs",
        "live.user_symbols_all",
    ]

    engine = get_ui_engine()

    with engine.begin() as conn:
        for table_name in table_names:
            updated = False

            # önce lowercase username dene
            try:
                conn.execute(
                    text(f"""
                        UPDATE {table_name}
                        SET is_active = 'deleted_account'
                        WHERE username = :username
                    """),
                    {"username": username},
                )
                updated = True
            except Exception:
                updated = False

            # olmazsa uppercase USERNAME dene
            if not updated:
                try:
                    conn.execute(
                        text(f'''
                            UPDATE {table_name}
                            SET is_active = 'deleted_account'
                            WHERE "USERNAME" = :username
                        '''),
                        {"username": username},
                    )
                    updated = True
                except Exception:
                    updated = False

            # ikisi de olmadıysa sessiz geç
            if not updated:
                continue
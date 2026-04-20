from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def username_exists(username: str) -> bool:
    query = text("""
        SELECT 1
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE UPPER("USERNAME") = UPPER(:username)
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"username": username}).first()
        return row is not None


def email_exists(email: str) -> bool:
    query = text("""
        SELECT 1
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE LOWER("EMAIL") = LOWER(:email)
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"email": email}).first()
        return row is not None


def insert_registered_user(data: dict[str, Any]) -> dict[str, Any]:
    query = text("""
        INSERT INTO "user"."REGISTERED_USER_DETAILS" (
            "USERNAME",
            "EMAIL",
            "PASSWORD_HASH",
            "FIRST_NAME",
            "LAST_NAME",
            "DATE_OF_BIRTH",
            "COUNTRY",
            "MOBILE_PHONE",
            "GENDER",
            "EXCHANGE_EXPERIENCE",
            "ESTIMATED_START_BUDGET",
            "RESPONSIBILITY_APPROVED",
            "DEVICE_ID",
            "IS_ACTIVE",
            "USER_TYPE"
        )
        VALUES (
            :username,
            :email,
            :password_hash,
            :first_name,
            :last_name,
            :date_of_birth,
            :country,
            :mobile_phone,
            :gender,
            :exchange_experience,
            :estimated_start_budget,
            :responsibility_approved,
            :device_id,
            :is_active,
            :user_type
        )
        RETURNING
            "ID",
            "USERNAME",
            "EMAIL",
            "DEVICE_ID",
            "IS_ACTIVE",
            "USER_TYPE",
            "CREATED_AT"
    """)

    params = {
        "username": data["username"],
        "email": data["email"],
        "password_hash": data["password_hash"],
        "first_name": data["first_name"],
        "last_name": data["last_name"],
        "date_of_birth": data["date_of_birth"],
        "country": data["country"],
        "mobile_phone": data["mobile_phone"],
        "gender": data["gender"],
        "exchange_experience": data["exchange_experience"],
        "estimated_start_budget": data["estimated_start_budget"],
        "responsibility_approved": data["responsibility_approved"],
        "device_id": data["device_id"],
        "is_active": "NEW_USER",
        "user_type": "CLIENT",
    }

    engine = get_ui_engine()
    with engine.begin() as conn:
        row = conn.execute(query, params).first()

    if row is None:
        raise ValueError("User insert failed. No row returned.")

    return {
        "id": row[0],
        "username": row[1],
        "email": row[2],
        "device_id": row[3],
        "is_active": row[4],
        "user_type": row[5],
        "created_at": row[6].isoformat() if row[6] else None,
    }
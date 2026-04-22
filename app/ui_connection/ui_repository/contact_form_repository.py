from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def insert_contact_form(
    username: str | None,
    device_id: str | None,
    email: str,
    first_name: str | None,
    last_name: str | None,
    mobile_phone: str | None,
    subject: str,
    message: str,
) -> None:
    query = text("""
        INSERT INTO "user".contact_form (
            username,
            device_id,
            email,
            first_name,
            last_name,
            mobile_phone,
            subject,
            message,
            status,
            created_at
        )
        VALUES (
            :username,
            :device_id,
            :email,
            :first_name,
            :last_name,
            :mobile_phone,
            :subject,
            :message,
            'NEW',
            NOW()
        )
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(
            query,
            {
                "username": username,
                "device_id": device_id,
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "mobile_phone": mobile_phone,
                "subject": subject,
                "message": message,
            },
        )
from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_all_registered_usernames() -> list[str]:
    query = text("""
        SELECT "USERNAME"
        FROM "user"."REGISTERED_USER_DETAILS"
        ORDER BY "USERNAME" ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query).fetchall()

    return [row[0] for row in rows if row[0]]
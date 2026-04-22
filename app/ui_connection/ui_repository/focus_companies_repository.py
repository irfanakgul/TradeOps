from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_focus_companies(username: str) -> list[dict]:
    query = text("""
        SELECT
            "USERNAME",
            "SYMBOL",
            "EXCHANGE",
            "COUNTRY",
            "USER_IN_SCOPE",
            "SECTOR",
            "COMPANY_NAME"
        FROM live.user_symbols_all
        WHERE "USERNAME" = :username
        ORDER BY "EXCHANGE" ASC, "SYMBOL" ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()

    return [dict(row) for row in rows]


def fetch_exchange_summary(username: str) -> list[dict]:
    query = text("""
        SELECT
            "EXCHANGE",
            COUNT(*) AS total_count,
            SUM(CASE WHEN "USER_IN_SCOPE" = true THEN 1 ELSE 0 END) AS in_scope_count
        FROM live.user_symbols_all
        WHERE "USERNAME" = :username
        GROUP BY "EXCHANGE"
        ORDER BY "EXCHANGE" ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()

    return [dict(row) for row in rows]


def bulk_update_user_in_scope(changes: list[dict]) -> None:
    query = text("""
        UPDATE live.user_symbols_all
        SET "USER_IN_SCOPE" = :user_in_scope
        WHERE
            "USERNAME" = :username
            AND "SYMBOL" = :symbol
            AND "EXCHANGE" = :exchange
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        for row in changes:
            conn.execute(
                query,
                {
                    "username": row["username"],
                    "symbol": row["symbol"],
                    "exchange": row["exchange"],
                    "user_in_scope": row["user_in_scope"],
                },
            )
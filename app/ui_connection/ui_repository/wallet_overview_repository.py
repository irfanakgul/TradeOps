from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_wallet_overview_rows(
    username: str,
    ibkr_mode: str,
    days: int,
) -> list[dict]:
    query = text("""
        WITH ranked_daily AS (
            SELECT
                username,
                ibkr_mode,
                fetched_at,
                available_funds,
                net_liquidation,
                total_cash_value,
                gross_position_value,
                ROW_NUMBER() OVER (
                    PARTITION BY DATE(fetched_at)
                    ORDER BY fetched_at DESC
                ) AS rn
            FROM live.user_ibkr_wallet_details
            WHERE username = :username
              AND ibkr_mode = :ibkr_mode
              AND fetched_at >= NOW() - (:days || ' days')::interval
        )
        SELECT
            username,
            ibkr_mode,
            fetched_at,
            available_funds,
            net_liquidation,
            total_cash_value,
            gross_position_value
        FROM ranked_daily
        WHERE rn = 1
        ORDER BY fetched_at ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            query,
            {
                "username": username,
                "ibkr_mode": ibkr_mode,
                "days": days,
            },
        ).mappings().all()

    return [dict(row) for row in rows]


def fetch_wallet_latest_row(username: str, ibkr_mode: str) -> dict | None:
    query = text("""
        SELECT
            username,
            ibkr_mode,
            fetched_at,
            available_funds,
            net_liquidation,
            total_cash_value,
            gross_position_value
        FROM live.user_ibkr_wallet_details
        WHERE username = :username
          AND ibkr_mode = :ibkr_mode
        ORDER BY fetched_at DESC
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(
            query,
            {
                "username": username,
                "ibkr_mode": ibkr_mode,
            },
        ).mappings().first()

    return dict(row) if row else None
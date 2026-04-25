from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_sim_actual_wallet(username: str) -> list[dict]:
    query = text("""
        SELECT
            username,
            ibkr_mode,
            fetched_at,
            available_funds,
            net_liquidation,
            total_cash_value,
            gross_position_value
        FROM test.sim_actual_wallet
        WHERE username = :username
        ORDER BY fetched_at DESC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()

    return [dict(row) for row in rows]


def fetch_sim_wallet_history(username: str) -> list[dict]:
    query = text("""
        SELECT
            username,
            ibkr_mode,
            fetched_at,
            available_funds,
            net_liquidation,
            total_cash_value,
            gross_position_value
        FROM test.sim_actual_wallet
        WHERE username = :username
        ORDER BY fetched_at ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()

    return [dict(row) for row in rows]
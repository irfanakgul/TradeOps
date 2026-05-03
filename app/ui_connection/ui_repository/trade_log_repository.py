from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_sim_open_positions(username: str, ibkr_mode: str) -> list[dict]:
    query = text("""
        SELECT
            exchange,
            symbol,
            currency,
            buy_quantity,
            buy_price,
            buy_time,
            buy_exec_id,
            buy_order_id,
            exit_type,
            exit_quantity,
            exit_price,
            exit_time,
            profit_amount,
            profit_pct,
            fetched_at
        FROM test.sim_open_positions
        WHERE username = :username
          AND ibkr_mode = :ibkr_mode
        ORDER BY buy_time DESC NULLS LAST
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username, "ibkr_mode": ibkr_mode}).mappings().all()

    return [dict(row) for row in rows]


def update_sim_position_after_sell(
    *,
    username: str,
    ibkr_mode: str,
    symbol: str,
    buy_exec_id: str | None,
    exit_price: float,
    exit_time: datetime,
    profit_pct: float,
    profit_amount: float | None,
    exit_quantity: float,
) -> int:
    engine = get_ui_engine()

    if buy_exec_id:
        sql = text("""
            UPDATE test.sim_open_positions
            SET
                exit_type     = 'MARKET_SELL',
                exit_quantity = :exit_quantity,
                exit_price    = :exit_price,
                exit_time     = :exit_time,
                profit_pct    = :profit_pct,
                profit_amount = :profit_amount,
                fetched_at    = :now
            WHERE username  = :username
              AND ibkr_mode = :ibkr_mode
              AND symbol    = :symbol
              AND buy_exec_id = :buy_exec_id
        """)
        params: dict[str, Any] = {
            "username": username,
            "ibkr_mode": ibkr_mode,
            "symbol": symbol,
            "buy_exec_id": buy_exec_id,
            "exit_quantity": exit_quantity,
            "exit_price": exit_price,
            "exit_time": exit_time,
            "profit_pct": profit_pct,
            "profit_amount": profit_amount,
            "now": datetime.now(timezone.utc),
        }
    else:
        sql = text("""
            UPDATE test.sim_open_positions
            SET
                exit_type     = 'MARKET_SELL',
                exit_quantity = :exit_quantity,
                exit_price    = :exit_price,
                exit_time     = :exit_time,
                profit_pct    = :profit_pct,
                profit_amount = :profit_amount,
                fetched_at    = :now
            WHERE username  = :username
              AND ibkr_mode = :ibkr_mode
              AND symbol    = :symbol
              AND exit_price IS NULL
        """)
        params = {
            "username": username,
            "ibkr_mode": ibkr_mode,
            "symbol": symbol,
            "exit_quantity": exit_quantity,
            "exit_price": exit_price,
            "exit_time": exit_time,
            "profit_pct": profit_pct,
            "profit_amount": profit_amount,
            "now": datetime.now(timezone.utc),
        }

    with engine.begin() as conn:
        result = conn.execute(sql, params)
        return result.rowcount

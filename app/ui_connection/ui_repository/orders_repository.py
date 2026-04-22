from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_latest_buy_limits(username: str, ibkr_mode: str) -> list[dict]:
    query = text("""
        WITH ranked_limits AS (
            SELECT
                username,
                ibkr_mode,
                exchange,
                updated_at,
                total_max_open_positions,
                max_daily_trade_count,
                exchange_max_open_positions,
                current_open_position_count,
                remaining_open_position_slots,
                today_buy_count_used,
                today_buy_count_remaining,
                allocated_budget_pct,
                allocated_budget_amount,
                available_funds,
                planned_buy_count,
                ROW_NUMBER() OVER (
                    PARTITION BY exchange
                    ORDER BY updated_at DESC
                ) AS rn
            FROM live.buy_limits
            WHERE username = :username
              AND ibkr_mode = :ibkr_mode
        )
        SELECT
            username,
            ibkr_mode,
            exchange,
            updated_at,
            total_max_open_positions,
            max_daily_trade_count,
            exchange_max_open_positions,
            current_open_position_count,
            remaining_open_position_slots,
            today_buy_count_used,
            today_buy_count_remaining,
            allocated_budget_pct,
            allocated_budget_amount,
            available_funds,
            planned_buy_count
        FROM ranked_limits
        WHERE rn = 1
        ORDER BY exchange ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            query,
            {
                "username": username,
                "ibkr_mode": ibkr_mode,
            },
        ).mappings().all()

    return [dict(row) for row in rows]


def fetch_latest_combined_positions(username: str, ibkr_mode: str) -> list[dict]:
    query = text("""
        WITH runtime_latest AS (
            SELECT
                username,
                exchange,
                symbol,
                ibkr_mode,
                is_open,
                entry_date,
                last_price,
                holding_days_used,
                remaining_holding_days,
                last_updated_at,
                ROW_NUMBER() OVER (
                    PARTITION BY exchange, symbol, ibkr_mode
                    ORDER BY last_updated_at DESC
                ) AS rn
            FROM live.user_position_runtime
            WHERE username = :username
              AND ibkr_mode = :ibkr_mode
        ),
        detail_latest AS (
            SELECT
                username,
                exchange,
                symbol,
                ibkr_mode,
                currency,
                position_qty,
                avg_cost,
                market_price,
                fetched_at,
                ROW_NUMBER() OVER (
                    PARTITION BY exchange, symbol, ibkr_mode
                    ORDER BY fetched_at DESC
                ) AS rn
            FROM live.user_open_position_details
            WHERE username = :username
              AND ibkr_mode = :ibkr_mode
        )
        SELECT
            COALESCE(r.exchange, d.exchange) AS exchange,
            COALESCE(r.symbol, d.symbol) AS symbol,
            COALESCE(r.ibkr_mode, d.ibkr_mode) AS ibkr_mode,
            r.is_open,
            r.entry_date,
            r.last_price,
            r.holding_days_used,
            r.remaining_holding_days,
            d.currency,
            d.position_qty,
            d.avg_cost,
            d.market_price,
            GREATEST(
                COALESCE(r.last_updated_at, TIMESTAMP '1970-01-01'),
                COALESCE(d.fetched_at, TIMESTAMP '1970-01-01')
            ) AS updated_at
        FROM (SELECT * FROM runtime_latest WHERE rn = 1) r
        FULL OUTER JOIN (SELECT * FROM detail_latest WHERE rn = 1) d
          ON r.exchange = d.exchange
         AND r.symbol = d.symbol
         AND r.ibkr_mode = d.ibkr_mode
        ORDER BY
            COALESCE(r.exchange, d.exchange) ASC,
            COALESCE(r.symbol, d.symbol) ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(
            query,
            {
                "username": username,
                "ibkr_mode": ibkr_mode,
            },
        ).mappings().all()

    return [dict(row) for row in rows]
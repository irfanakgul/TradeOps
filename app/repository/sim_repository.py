from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.engine import Engine


def _json_default(value: Any) -> Any:
    if isinstance(value, (datetime,)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value)


def _to_jsonb(value: Any) -> str:
    return json.dumps(value or {}, default=_json_default)


def truncate_sim_open_positions(
    engine: Engine,
    *,
    username: str,
    ibkr_mode: str,
) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("""
                DELETE FROM test.sim_open_positions
                WHERE username = :username
                  AND ibkr_mode = :ibkr_mode
            """),
            {"username": username, "ibkr_mode": ibkr_mode},
        )


def truncate_sim_actual_wallet(
    engine: Engine,
    *,
    username: str,
    ibkr_mode: str,
) -> None:
    with engine.begin() as conn:
        conn.execute(
            text("""
                DELETE FROM test.sim_actual_wallet
                WHERE username = :username
                  AND ibkr_mode = :ibkr_mode
            """),
            {"username": username, "ibkr_mode": ibkr_mode},
        )


def insert_sim_open_positions(
    engine: Engine,
    *,
    rows: list[dict[str, Any]],
) -> None:
    if not rows:
        return

    sql = text("""
        INSERT INTO test.sim_open_positions (
            username,
            ibkr_mode,
            exchange,
            symbol,
            currency,
            action_type,
            buy_quantity,
            buy_price,
            buy_time,
            buy_order_id,
            buy_exec_id,
            exit_type,
            exit_quantity,
            exit_price,
            exit_time,
            commission,
            profit_amount,
            profit_pct,
            trade_source,
            source_match_status,
            raw_json,
            fetched_at
        )
        VALUES (
            :username,
            :ibkr_mode,
            :exchange,
            :symbol,
            :currency,
            :action_type,
            :buy_quantity,
            :buy_price,
            :buy_time,
            :buy_order_id,
            :buy_exec_id,
            :exit_type,
            :exit_quantity,
            :exit_price,
            :exit_time,
            :commission,
            :profit_amount,
            :profit_pct,
            :trade_source,
            :source_match_status,
            CAST(:raw_json AS jsonb),
            :fetched_at
        )
    """)

    payload = []
    now = datetime.now(timezone.utc)

    for row in rows:
        item = dict(row)
        item.setdefault("fetched_at", now)
        item["raw_json"] = _to_jsonb(item.get("raw_json"))
        payload.append(item)

    with engine.begin() as conn:
        conn.execute(sql, payload)


def insert_sim_trade_logs(
    engine: Engine,
    *,
    rows: list[dict[str, Any]],
) -> None:
    if not rows:
        return

    sql = text("""
        INSERT INTO test.sim_log_trade_logs (
            username,
            ibkr_mode,
            exchange,
            symbol,
            currency,
            action_type,
            quantity,
            price,
            trade_time,
            buy_quantity,
            buy_price,
            buy_time,
            exit_type,
            exit_quantity,
            exit_price,
            exit_time,
            commission,
            profit_amount,
            profit_pct,
            order_id,
            exec_id,
            trade_source,
            source_match_status,
            raw_json,
            pipeline_name,
            fetched_at
        )
        VALUES (
            :username,
            :ibkr_mode,
            :exchange,
            :symbol,
            :currency,
            :action_type,
            :quantity,
            :price,
            :trade_time,
            :buy_quantity,
            :buy_price,
            :buy_time,
            :exit_type,
            :exit_quantity,
            :exit_price,
            :exit_time,
            :commission,
            :profit_amount,
            :profit_pct,
            :order_id,
            :exec_id,
            :trade_source,
            :source_match_status,
            CAST(:raw_json AS jsonb),
            :pipeline_name,
            :fetched_at
        )
        ON CONFLICT (username, ibkr_mode, exec_id)
        WHERE exec_id IS NOT NULL
        DO NOTHING
    """)

    payload = []
    now = datetime.now(timezone.utc)

    for row in rows:
        item = dict(row)
        item.setdefault("pipeline_name", "sim_update_pipeline")
        item.setdefault("fetched_at", now)
        item["raw_json"] = _to_jsonb(item.get("raw_json"))
        payload.append(item)

    with engine.begin() as conn:
        conn.execute(sql, payload)


def insert_sim_actual_wallet(
    engine: Engine,
    *,
    row: dict[str, Any],
) -> None:
    sql = text("""
        INSERT INTO test.sim_actual_wallet (
            username,
            ibkr_mode,
            account_id,
            available_funds,
            net_liquidation,
            total_cash_value,
            settled_cash,
            buying_power,
            excess_liquidity,
            gross_position_value,
            cash_balance_base,
            cash_balance_eur,
            cash_balance_usd,
            open_position_count,
            open_symbols,
            raw_account_summary_json,
            fetched_at
        )
        VALUES (
            :username,
            :ibkr_mode,
            :account_id,
            :available_funds,
            :net_liquidation,
            :total_cash_value,
            :settled_cash,
            :buying_power,
            :excess_liquidity,
            :gross_position_value,
            :cash_balance_base,
            :cash_balance_eur,
            :cash_balance_usd,
            :open_position_count,
            :open_symbols,
            CAST(:raw_account_summary_json AS jsonb),
            :fetched_at
        )
    """)

    payload = dict(row)
    payload.setdefault("fetched_at", datetime.now(timezone.utc))
    payload["raw_account_summary_json"] = _to_jsonb(
        payload.get("raw_account_summary_json")
    )

    with engine.begin() as conn:
        conn.execute(sql, payload)


def insert_sim_wallet_log(
    engine: Engine,
    *,
    row: dict[str, Any],
) -> None:
    sql = text("""
        INSERT INTO test.sim_log_wallet_details (
            username,
            ibkr_mode,
            account_id,
            available_funds,
            net_liquidation,
            total_cash_value,
            settled_cash,
            buying_power,
            excess_liquidity,
            gross_position_value,
            cash_balance_base,
            cash_balance_eur,
            cash_balance_usd,
            open_position_count,
            open_symbols,
            raw_account_summary_json,
            pipeline_name,
            fetched_at
        )
        VALUES (
            :username,
            :ibkr_mode,
            :account_id,
            :available_funds,
            :net_liquidation,
            :total_cash_value,
            :settled_cash,
            :buying_power,
            :excess_liquidity,
            :gross_position_value,
            :cash_balance_base,
            :cash_balance_eur,
            :cash_balance_usd,
            :open_position_count,
            :open_symbols,
            CAST(:raw_account_summary_json AS jsonb),
            :pipeline_name,
            :fetched_at
        )
    """)

    payload = dict(row)
    payload.setdefault("pipeline_name", "sim_update_pipeline")
    payload.setdefault("fetched_at", datetime.now(timezone.utc))
    payload["raw_account_summary_json"] = _to_jsonb(
        payload.get("raw_account_summary_json")
    )

    with engine.begin() as conn:
        conn.execute(sql, payload)


def fetch_known_system_trades(
    engine: Engine,
    *,
    username: str,
    ibkr_mode: str,
) -> list[dict[str, Any]]:
    """
    Şimdilik sistemin kendi yazdığı sim_log_trade_logs içinden eşleştiriyoruz.
    Buy/Sell pipeline gelince onların order_id / exec_id logları da buraya düşecek.
    """
    sql = text("""
        SELECT
            order_id,
            exec_id,
            symbol,
            exchange,
            action_type,
            trade_time
        FROM test.sim_log_trade_logs
        WHERE username = :username
          AND ibkr_mode = :ibkr_mode
          AND trade_source = 'SYSTEM'
    """)

    with engine.begin() as conn:
        result = conn.execute(
            sql,
            {"username": username, "ibkr_mode": ibkr_mode},
        )
        return [dict(row._mapping) for row in result]
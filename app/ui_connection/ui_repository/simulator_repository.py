from __future__ import annotations

import json
from datetime import datetime, timezone

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


def fetch_sim_available_funds(username: str) -> dict:
    query = text("""
        SELECT DISTINCT ON (ibkr_mode)
            ibkr_mode,
            available_funds
        FROM test.sim_actual_wallet
        WHERE username = :username
        ORDER BY ibkr_mode, fetched_at DESC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()

    result: dict = {"PAPER": None, "LIVE": None}
    for row in rows:
        mode = str(row["ibkr_mode"]).upper()
        if mode in result:
            val = row["available_funds"]
            result[mode] = float(val) if val is not None else None
    return result


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


def insert_ui_sim_trade_log(row: dict) -> None:
    sql = text("""
        INSERT INTO test.sim_log_trade_logs (
            username, ibkr_mode, exchange, symbol, currency,
            action_type, quantity, price, trade_time,
            buy_quantity, buy_price, buy_time,
            exit_type, exit_quantity,
            order_id, exec_id,
            trade_source, source_match_status,
            raw_json, pipeline_name, fetched_at
        )
        VALUES (
            :username, :ibkr_mode, :exchange, :symbol, :currency,
            :action_type, :quantity, :price, :trade_time,
            :buy_quantity, :buy_price, :buy_time,
            :exit_type, :exit_quantity,
            :order_id, :exec_id,
            :trade_source, :source_match_status,
            CAST(:raw_json AS jsonb), :pipeline_name, :fetched_at
        )
        ON CONFLICT (username, ibkr_mode, exec_id)
        WHERE exec_id IS NOT NULL
        DO NOTHING
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(sql, {
            **row,
            "raw_json": json.dumps(row.get("raw_json") or {}),
            "fetched_at": row.get("fetched_at") or datetime.now(timezone.utc),
        })
from __future__ import annotations

from datetime import datetime, timezone

from service.sim_ibkr_buy_service import EXCHANGE_CURRENCY_MAP, execute_sim_buy
from ui_connection.ui_repository.buy_signals_repository import (
    fetch_all_signal_dates,
    fetch_buy_signals,
    fetch_distinct_exchanges,
    fetch_latest_signal_date,
)
from ui_connection.ui_repository.simulator_repository import insert_ui_sim_trade_log


class SimBuyError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def get_buy_signals(date_filter: str | None = None) -> dict:
    latest_date = fetch_latest_signal_date()
    exchanges = fetch_distinct_exchanges()
    all_dates = fetch_all_signal_dates()
    signals = fetch_buy_signals(date_filter=date_filter)

    return {
        "latest_date": latest_date,
        "all_dates": all_dates,
        "exchanges": exchanges,
        "signals": signals,
    }


def run_sim_buy(payload: dict) -> dict:
    symbol = str(payload.get("symbol", "")).strip().upper()
    exchange = str(payload.get("exchange", "")).strip().upper()
    exit_type = str(payload.get("exit_type", "")).strip().lower()
    qty = int(payload.get("qty", 1))

    if not symbol:
        raise SimBuyError("Symbol is required.", 400)
    if not exchange:
        raise SimBuyError("Exchange is required.", 400)
    if qty <= 0:
        raise SimBuyError("Quantity must be greater than 0.", 400)

    exit_params: dict = {}

    if exit_type == "limit":
        target_price = payload.get("target_price")
        if target_price is None:
            raise SimBuyError("target_price required for limit exit.", 400)
        exit_params["limit_price"] = float(target_price)

    elif exit_type == "stop":
        stop_price = payload.get("stop_price")
        if stop_price is None:
            raise SimBuyError("stop_price required for stop exit.", 400)
        exit_params["stop_price"] = float(stop_price)

    elif exit_type == "stop_limit":
        stop_price = payload.get("stop_price")
        limit_price = payload.get("limit_price")
        if stop_price is None or limit_price is None:
            raise SimBuyError("stop_price and limit_price required for stop_limit exit.", 400)
        exit_params["stop_price"] = float(stop_price)
        exit_params["limit_price"] = float(limit_price)

    elif exit_type == "market_if_touched":
        trigger_price = payload.get("trigger_price")
        if trigger_price is None:
            raise SimBuyError("trigger_price required for market_if_touched exit.", 400)
        exit_params["trigger_price"] = float(trigger_price)

    elif exit_type == "trailing_stop_amount":
        trail_amount = payload.get("trail_amount")
        if trail_amount is None:
            raise SimBuyError("trail_amount required for trailing_stop_amount exit.", 400)
        exit_params["trail_amount"] = float(trail_amount)

    elif exit_type == "trailing_stop_percentage":
        trailing_percent = payload.get("trailing_percent")
        if trailing_percent is None:
            raise SimBuyError("trailing_percent required for trailing_stop_percentage exit.", 400)
        pct = float(trailing_percent)
        if pct < 1 or pct > 100:
            raise SimBuyError("trailing_percent must be between 1 and 100.", 400)
        exit_params["trailing_percent"] = pct

    result = execute_sim_buy(
        symbol=symbol,
        exchange=exchange,
        exit_type=exit_type,
        qty=qty,
        **exit_params,
    )

    if result.ok:
        try:
            currency = EXCHANGE_CURRENCY_MAP.get(exchange.strip().upper(), "USD")
            insert_ui_sim_trade_log({
                "username": payload.get("username", ""),
                "ibkr_mode": result.ibkr_mode or "PAPER",
                "exchange": exchange,
                "symbol": result.symbol or symbol,
                "currency": currency,
                "action_type": "BUY",
                "quantity": result.buy_shares,
                "price": result.buy_price,
                "trade_time": result.buy_time,
                "buy_quantity": result.buy_shares,
                "buy_price": result.buy_price,
                "buy_time": result.buy_time,
                "exit_type": result.exit_type,
                "exit_quantity": result.buy_shares,
                "order_id": result.order_id,
                "exec_id": result.exec_id,
                "trade_source": "UI_SIM_BUY",
                "source_match_status": "PENDING",
                "raw_json": {
                    "buy_avg_price": result.buy_avg_price,
                    "exit_order_status": result.exit_order_status,
                    "exit_order_type": result.exit_order_type,
                    "exit_detail": result.exit_detail,
                    "exit_params": exit_params,
                },
                "pipeline_name": "ui_sim_buy",
                "fetched_at": datetime.now(timezone.utc),
            })
        except Exception:
            pass

    return {
        "ok": result.ok,
        "message": result.message,
        "symbol": result.symbol,
        "buy_time": result.buy_time,
        "buy_shares": result.buy_shares,
        "buy_price": result.buy_price,
        "buy_avg_price": result.buy_avg_price,
        "exit_type": result.exit_type,
        "exit_order_status": result.exit_order_status,
        "exit_order_type": result.exit_order_type,
        "exit_detail": result.exit_detail,
        "buy_status": result.buy_status,
        "buy_log": result.buy_log,
        "exec_id": result.exec_id,
        "order_id": result.order_id,
    }

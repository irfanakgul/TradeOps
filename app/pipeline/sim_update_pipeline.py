from __future__ import annotations

import asyncio
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from ib_insync import IB

from config.settings import AppSettings
from repository.db import create_db_engine
from repository.sim_repository import (
    fetch_known_system_trades,
    insert_sim_actual_wallet,
    insert_sim_open_positions,
    insert_sim_trade_logs,
    insert_sim_wallet_log,
    truncate_sim_actual_wallet,
    truncate_sim_open_positions,
)


@dataclass(frozen=True)
class SimUpdateResult:
    username: str
    ibkr_mode: str
    open_position_count: int
    trade_log_count: int
    wallet_updated: bool


def _as_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except Exception:
        return None


def _safe_exchange(value: Any) -> str:
    if not value:
        return "UNKNOWN"
    return str(value).upper()


def _safe_symbol(value: Any) -> str:
    if not value:
        return "UNKNOWN"
    return str(value).upper()


def _normalize_action(side: str | None) -> str:
    if side == "BOT":
        return "BUY"
    if side == "SLD":
        return "SELL"
    return str(side or "UNKNOWN").upper()


def _is_system_trade(
    *,
    execution_row: dict[str, Any],
    known_system_trades: list[dict[str, Any]],
) -> tuple[str, str]:
    exec_id = execution_row.get("exec_id")
    order_id = execution_row.get("order_id")
    symbol = execution_row.get("symbol")
    action_type = execution_row.get("action_type")

    for known in known_system_trades:
        if exec_id and known.get("exec_id") == exec_id:
            return "SYSTEM", "MATCHED_BY_EXEC_ID"

        if order_id and known.get("order_id") == order_id:
            return "SYSTEM", "MATCHED_BY_ORDER_ID"

        if (
            symbol
            and known.get("symbol") == symbol
            and action_type
            and known.get("action_type") == action_type
        ):
            return "SYSTEM", "MATCHED_BY_SYMBOL_ACTION"

    return "MANUAL", "NO_SYSTEM_MATCH"


async def _connect_ibkr(settings: AppSettings) -> IB:
    ib = IB()

    await ib.connectAsync(
        settings.SIM_IBKR_HOST,
        int(settings.SIM_IBKR_PORT),
        clientId=int(settings.SIM_IBKR_CLIENT_ID),
        timeout=20,
    )

    return ib


async def _get_all_ibkr_fills(ib: IB) -> list[dict[str, Any]]:
    fills = await ib.reqExecutionsAsync()
    rows: list[dict[str, Any]] = []

    for fill in fills:
        contract = fill.contract
        execution = fill.execution
        commission_report = fill.commissionReport

        action_type = _normalize_action(execution.side)
        commission = 0.0

        if commission_report and commission_report.commission is not None:
            commission = float(commission_report.commission)

        rows.append(
            {
                "time": fill.time,
                "symbol": _safe_symbol(contract.symbol),
                "exchange": _safe_exchange(execution.exchange or contract.exchange),
                "side": execution.side,
                "action_type": action_type,
                "shares": float(execution.shares or 0),
                "price": float(execution.price or 0),
                "commission": commission,
                "currency": contract.currency,
                "exec_id": execution.execId,
                "order_id": execution.orderId,
                "raw": {
                    "contract": {
                        "symbol": contract.symbol,
                        "secType": contract.secType,
                        "exchange": contract.exchange,
                        "primaryExchange": getattr(contract, "primaryExchange", None),
                        "currency": contract.currency,
                        "conId": contract.conId,
                    },
                    "execution": {
                        "execId": execution.execId,
                        "orderId": execution.orderId,
                        "side": execution.side,
                        "shares": float(execution.shares or 0),
                        "price": float(execution.price or 0),
                        "exchange": execution.exchange,
                        "acctNumber": execution.acctNumber,
                    },
                    "commissionReport": {
                        "commission": commission,
                        "currency": (
                            commission_report.currency
                            if commission_report
                            else None
                        ),
                        "realizedPNL": (
                            commission_report.realizedPNL
                            if commission_report
                            else None
                        ),
                    },
                },
            }
        )

    rows.sort(key=lambda item: item["time"] or datetime.min.replace(tzinfo=timezone.utc))
    return rows


def _calculate_fifo(
    *,
    execution_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    lots: dict[str, deque[dict[str, Any]]] = defaultdict(deque)
    realized_rows: list[dict[str, Any]] = []
    open_rows: list[dict[str, Any]] = []

    for row in execution_rows:
        symbol = row["symbol"]
        qty = float(row["shares"] or 0)
        price = float(row["price"] or 0)
        commission = float(row["commission"] or 0)
        action_type = row["action_type"]

        if action_type == "BUY":
            lots[symbol].append(
                {
                    "symbol": symbol,
                    "exchange": row["exchange"],
                    "currency": row.get("currency"),
                    "qty": qty,
                    "price": price,
                    "time": row["time"],
                    "commission": commission,
                    "order_id": row.get("order_id"),
                    "exec_id": row.get("exec_id"),
                    "raw": row.get("raw"),
                }
            )

        elif action_type == "SELL":
            sell_qty = qty

            while sell_qty > 0 and lots[symbol]:
                lot = lots[symbol][0]
                matched_qty = min(sell_qty, float(lot["qty"]))

                buy_price = float(lot["price"])
                sell_price = price

                buy_commission_part = (
                    float(lot.get("commission") or 0)
                    * matched_qty
                    / max(float(lot.get("qty") or matched_qty), matched_qty)
                )
                sell_commission_part = (
                    commission * matched_qty / max(qty, matched_qty)
                )
                total_commission = buy_commission_part + sell_commission_part

                gross_profit = (sell_price - buy_price) * matched_qty
                net_profit = gross_profit - total_commission

                cost_basis = (buy_price * matched_qty) + buy_commission_part
                profit_pct = (
                    (net_profit / cost_basis) * 100
                    if cost_basis
                    else None
                )

                realized_rows.append(
                    {
                        "symbol": symbol,
                        "exchange": row["exchange"],
                        "currency": row.get("currency"),
                        "qty": matched_qty,
                        "buy_price": buy_price,
                        "buy_time": lot["time"],
                        "buy_order_id": lot.get("order_id"),
                        "buy_exec_id": lot.get("exec_id"),
                        "sell_price": sell_price,
                        "sell_time": row["time"],
                        "sell_order_id": row.get("order_id"),
                        "sell_exec_id": row.get("exec_id"),
                        "commission": total_commission,
                        "profit_amount": net_profit,
                        "profit_pct": profit_pct,
                        "raw": {
                            "buy_raw": lot.get("raw"),
                            "sell_raw": row.get("raw"),
                        },
                    }
                )

                lot["qty"] = float(lot["qty"]) - matched_qty
                sell_qty -= matched_qty

                if lot["qty"] <= 0:
                    lots[symbol].popleft()

    for symbol, queue in lots.items():
        for lot in queue:
            open_rows.append(
                {
                    "symbol": symbol,
                    "exchange": lot["exchange"],
                    "currency": lot.get("currency"),
                    "qty": float(lot["qty"]),
                    "buy_price": float(lot["price"]),
                    "buy_time": lot["time"],
                    "buy_order_id": lot.get("order_id"),
                    "buy_exec_id": lot.get("exec_id"),
                    "commission": float(lot.get("commission") or 0),
                    "raw": lot.get("raw"),
                }
            )

    return realized_rows, open_rows


async def _get_wallet_summary(
    ib: IB,
    *,
    username: str,
    ibkr_mode: str,
    open_rows: list[dict[str, Any]],
) -> dict[str, Any]:
    account_values = await ib.accountSummaryAsync()

    raw_rows = []
    values: dict[str, dict[str, Any]] = {}

    account_id = None

    for item in account_values:
        account_id = account_id or item.account

        raw = {
            "account": item.account,
            "tag": item.tag,
            "value": item.value,
            "currency": item.currency,
        }
        raw_rows.append(raw)

        key = item.tag
        currency = item.currency or "BASE"
        values.setdefault(key, {})[currency] = item.value

    def get_tag(tag: str, currency: str | None = None) -> float | None:
        bucket = values.get(tag, {})
        if currency:
            return _as_float(bucket.get(currency))
        if "BASE" in bucket:
            return _as_float(bucket.get("BASE"))
        for value in bucket.values():
            parsed = _as_float(value)
            if parsed is not None:
                return parsed
        return None

    open_symbols = sorted({row["symbol"] for row in open_rows})

    return {
        "username": username,
        "ibkr_mode": ibkr_mode,
        "account_id": account_id,
        "available_funds": get_tag("AvailableFunds"),
        "net_liquidation": get_tag("NetLiquidation"),
        "total_cash_value": get_tag("TotalCashValue"),
        "settled_cash": get_tag("SettledCash"),
        "buying_power": get_tag("BuyingPower"),
        "excess_liquidity": get_tag("ExcessLiquidity"),
        "gross_position_value": get_tag("GrossPositionValue"),
        "cash_balance_base": get_tag("CashBalance"),
        "cash_balance_eur": get_tag("CashBalance", "EUR"),
        "cash_balance_usd": get_tag("CashBalance", "USD"),
        "open_position_count": len(open_rows),
        "open_symbols": ",".join(open_symbols),
        "raw_account_summary_json": raw_rows,
        "fetched_at": datetime.now(timezone.utc),
    }


def _build_trade_log_rows(
    *,
    username: str,
    ibkr_mode: str,
    execution_rows: list[dict[str, Any]],
    realized_rows: list[dict[str, Any]],
    known_system_trades: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    realized_by_sell_exec_id = {
        row.get("sell_exec_id"): row
        for row in realized_rows
        if row.get("sell_exec_id")
    }

    for execution in execution_rows:
        trade_source, match_status = _is_system_trade(
            execution_row=execution,
            known_system_trades=known_system_trades,
        )

        action_type = execution["action_type"]
        realized = realized_by_sell_exec_id.get(execution.get("exec_id"))

        rows.append(
            {
                "username": username,
                "ibkr_mode": ibkr_mode,
                "exchange": execution["exchange"],
                "symbol": execution["symbol"],
                "currency": execution.get("currency"),
                "action_type": action_type,
                "quantity": execution["shares"],
                "price": execution["price"],
                "trade_time": execution["time"],
                "buy_quantity": (
                    realized.get("qty") if realized else (
                        execution["shares"] if action_type == "BUY" else None
                    )
                ),
                "buy_price": (
                    realized.get("buy_price") if realized else (
                        execution["price"] if action_type == "BUY" else None
                    )
                ),
                "buy_time": (
                    realized.get("buy_time") if realized else (
                        execution["time"] if action_type == "BUY" else None
                    )
                ),
                "exit_type": "SELL" if action_type == "SELL" else None,
                "exit_quantity": realized.get("qty") if realized else None,
                "exit_price": realized.get("sell_price") if realized else None,
                "exit_time": realized.get("sell_time") if realized else None,
                "commission": (
                    realized.get("commission")
                    if realized
                    else execution.get("commission")
                ),
                "profit_amount": realized.get("profit_amount") if realized else None,
                "profit_pct": realized.get("profit_pct") if realized else None,
                "order_id": execution.get("order_id"),
                "exec_id": execution.get("exec_id"),
                "trade_source": trade_source,
                "source_match_status": match_status,
                "raw_json": execution.get("raw"),
                "fetched_at": datetime.now(timezone.utc),
            }
        )

    return rows


def _build_open_position_rows(
    *,
    username: str,
    ibkr_mode: str,
    open_rows: list[dict[str, Any]],
    known_system_trades: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for item in open_rows:
        execution_like = {
            "exec_id": item.get("buy_exec_id"),
            "order_id": item.get("buy_order_id"),
            "symbol": item.get("symbol"),
            "action_type": "BUY",
        }

        trade_source, match_status = _is_system_trade(
            execution_row=execution_like,
            known_system_trades=known_system_trades,
        )

        rows.append(
            {
                "username": username,
                "ibkr_mode": ibkr_mode,
                "exchange": item["exchange"],
                "symbol": item["symbol"],
                "currency": item.get("currency"),
                "action_type": "BUY",
                "buy_quantity": item["qty"],
                "buy_price": item["buy_price"],
                "buy_time": item["buy_time"],
                "buy_order_id": item.get("buy_order_id"),
                "buy_exec_id": item.get("buy_exec_id"),
                "exit_type": None,
                "exit_quantity": None,
                "exit_price": None,
                "exit_time": None,
                "commission": item.get("commission"),
                "profit_amount": None,
                "profit_pct": None,
                "trade_source": trade_source,
                "source_match_status": match_status,
                "raw_json": item.get("raw"),
                "fetched_at": datetime.now(timezone.utc),
            }
        )

    return rows


async def run_sim_update_pipeline_async(
    *,
    username: str,
    settings: AppSettings,
) -> SimUpdateResult:
    ibkr_mode = str(settings.SIM_IBKR_MODE).upper()
    engine = create_db_engine(settings)

    ib = await _connect_ibkr(settings)

    try:
        known_system_trades = fetch_known_system_trades(
            engine,
            username=username,
            ibkr_mode=ibkr_mode,
        )

        execution_rows = await _get_all_ibkr_fills(ib)
        realized_rows, open_rows = _calculate_fifo(execution_rows=execution_rows)

        wallet_row = await _get_wallet_summary(
            ib,
            username=username,
            ibkr_mode=ibkr_mode,
            open_rows=open_rows,
        )

        trade_log_rows = _build_trade_log_rows(
            username=username,
            ibkr_mode=ibkr_mode,
            execution_rows=execution_rows,
            realized_rows=realized_rows,
            known_system_trades=known_system_trades,
        )

        open_position_rows = _build_open_position_rows(
            username=username,
            ibkr_mode=ibkr_mode,
            open_rows=open_rows,
            known_system_trades=known_system_trades,
        )

        truncate_sim_open_positions(
            engine,
            username=username,
            ibkr_mode=ibkr_mode,
        )
        truncate_sim_actual_wallet(
            engine,
            username=username,
            ibkr_mode=ibkr_mode,
        )

        insert_sim_open_positions(engine, rows=open_position_rows)
        insert_sim_trade_logs(engine, rows=trade_log_rows)

        insert_sim_actual_wallet(engine, row=wallet_row)
        insert_sim_wallet_log(engine, row=wallet_row)

        return SimUpdateResult(
            username=username,
            ibkr_mode=ibkr_mode,
            open_position_count=len(open_position_rows),
            trade_log_count=len(trade_log_rows),
            wallet_updated=True,
        )

    finally:
        if ib.isConnected():
            ib.disconnect()


def run_sim_update_pipeline(
    *,
    username: str,
    settings: AppSettings,
) -> SimUpdateResult:
    return asyncio.run(
        run_sim_update_pipeline_async(
            username=username,
            settings=settings,
        )
    )
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from ui_connection.ui_repository.orders_repository import (
    fetch_latest_buy_limits,
    fetch_latest_combined_positions,
)
from ui_connection.ui_service.ui_users_service import resolve_effective_username


class OrdersOverviewError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _to_float(value):
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _to_int(value):
    if value is None:
        return None
    return int(value)


def _to_date_str(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _to_datetime_str(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _format_limit_row(row: dict) -> dict:
    return {
        "exchange": row["exchange"],
        "updated_at": _to_datetime_str(row["updated_at"]),
        "total_max_open_positions": _to_int(row["total_max_open_positions"]),
        "max_daily_trade_count": _to_int(row["max_daily_trade_count"]),
        "exchange_max_open_positions": _to_int(row["exchange_max_open_positions"]),
        "current_open_position_count": _to_int(row["current_open_position_count"]),
        "remaining_open_position_slots": _to_int(row["remaining_open_position_slots"]),
        "today_buy_count_used": _to_int(row["today_buy_count_used"]),
        "today_buy_count_remaining": _to_int(row["today_buy_count_remaining"]),
        "allocated_budget_pct": _to_float(row["allocated_budget_pct"]),
        "allocated_budget_amount": _to_float(row["allocated_budget_amount"]),
        "available_funds": _to_float(row["available_funds"]),
        "planned_buy_count": _to_int(row["planned_buy_count"]),
    }


def _format_position_row(row: dict) -> dict:
    return {
        "exchange": row["exchange"],
        "symbol": row["symbol"],
        "ibkr_mode": row["ibkr_mode"],
        "is_open": row["is_open"],
        "entry_date": _to_date_str(row["entry_date"]),
        "last_price": _to_float(row["last_price"]),
        "holding_days_used": _to_int(row["holding_days_used"]),
        "remaining_holding_days": _to_int(row["remaining_holding_days"]),
        "currency": row["currency"],
        "position_qty": _to_float(row["position_qty"]),
        "avg_cost": _to_float(row["avg_cost"]),
        "market_price": _to_float(row["market_price"]),
        "updated_at": _to_datetime_str(row["updated_at"]),
    }


def get_orders_overview(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None,
    ibkr_mode: str,
) -> dict:
    effective_username = resolve_effective_username(
        requesting_username=requesting_username,
        requesting_user_type=requesting_user_type,
        selected_username=selected_username,
    )

    safe_mode = (ibkr_mode or "").strip().upper()
    if safe_mode not in {"LIVE", "PAPER"}:
        raise OrdersOverviewError("Invalid IBKR mode.", 400)

    limits_raw = fetch_latest_buy_limits(
        username=effective_username,
        ibkr_mode=safe_mode,
    )
    positions_raw = fetch_latest_combined_positions(
        username=effective_username,
        ibkr_mode=safe_mode,
    )

    limits = [_format_limit_row(row) for row in limits_raw]
    positions = [_format_position_row(row) for row in positions_raw]

    latest_limit_update = max(
    [row["updated_at"] for row in limits if row["updated_at"]],
    default=None,
)

    latest_position_update = max(
        [row["updated_at"] for row in positions if row["updated_at"]],
        default=None,
    )

    overall_updated_at = max(
        [value for value in [latest_limit_update, latest_position_update] if value],
        default=None,
    )

    return {
        "username": effective_username,
        "ibkr_mode": safe_mode,
        "updated_at": overall_updated_at,
        "buy_limits": limits,
        "positions": positions,
    }
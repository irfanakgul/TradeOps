from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from ui_connection.ui_repository.wallet_overview_repository import (
    fetch_wallet_latest_row,
    fetch_wallet_overview_rows,
)


class WalletOverviewError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _to_float(value) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


def _format_row(row: dict) -> dict:
    return {
        "username": row["username"],
        "ibkr_mode": row["ibkr_mode"],
        "fetched_at": row["fetched_at"].isoformat() if row["fetched_at"] else None,
        "available_funds": _to_float(row["available_funds"]),
        "net_liquidation": _to_float(row["net_liquidation"]),
        "total_cash_value": _to_float(row["total_cash_value"]),
        "gross_position_value": _to_float(row["gross_position_value"]),
    }


def _performance_block(rows: list[dict], days_label: str) -> dict:
    if len(rows) < 2:
        return {
            "label": days_label,
            "start_value": None,
            "end_value": None,
            "diff_value": None,
            "diff_pct": None,
        }

    start_value = rows[0]["net_liquidation"]
    end_value = rows[-1]["net_liquidation"]
    diff_value = end_value - start_value

    diff_pct = None
    if start_value != 0:
        diff_pct = (diff_value / start_value) * 100

    return {
        "label": days_label,
        "start_value": start_value,
        "end_value": end_value,
        "diff_value": diff_value,
        "diff_pct": diff_pct,
    }


def get_wallet_overview(username: str, ibkr_mode: str, chart_days: int) -> dict:
    if not username.strip():
        raise WalletOverviewError("Username is required.", 400)

    safe_mode = ibkr_mode.upper().strip()
    if safe_mode not in {"LIVE", "PAPER"}:
        raise WalletOverviewError("Invalid IBKR mode.", 400)

    latest_row_raw = fetch_wallet_latest_row(username=username, ibkr_mode=safe_mode)
    latest_row = _format_row(latest_row_raw) if latest_row_raw else None

    chart_rows_raw = fetch_wallet_overview_rows(
        username=username,
        ibkr_mode=safe_mode,
        days=chart_days,
    )
    chart_rows = [_format_row(row) for row in chart_rows_raw]

    all_ranges = {
        "all_time": 3650,
        "six_months": 180,
        "three_months": 90,
        "one_month": 30,
        "two_weeks": 14,
        "one_week": 7,
    }

    performance = {}
    for label, days in all_ranges.items():
        rows_raw = fetch_wallet_overview_rows(
            username=username,
            ibkr_mode=safe_mode,
            days=days,
        )
        rows = [_format_row(row) for row in rows_raw]
        performance[label] = _performance_block(rows, label)

    return {
        "actual": latest_row,
        "chart_rows": chart_rows,
        "performance": performance,
    }
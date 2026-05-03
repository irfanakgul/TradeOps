"""
Exchange configuration loader.

Pulls live exchange configs from user.open_parameters via parameter_service.
The original YAML file has been retired — defaults live in parameter_catalog.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List


@dataclass
class ExchangeConfig:
    EXCHANGE: str
    ENABLED: bool
    BUY_PREPARE_TIME: str
    SIGNAL_TIME: str
    EOD_RECONCILE_TIME: str
    FORCED_SELL_TIME: str
    MAX_OPEN_POSITIONS: int
    STOP_LOSS_PCT: float
    BUDGET_PCT: float
    MAX_HOLDING_DAY: int
    FORCED_SELL_MODE: str
    CURRENCY: str


def _to_dataclass(item: dict) -> ExchangeConfig:
    return ExchangeConfig(
        EXCHANGE=str(item["EXCHANGE"]),
        ENABLED=bool(item.get("ENABLED", True)),
        BUY_PREPARE_TIME=str(item.get("BUY_PREPARE_TIME", "")),
        SIGNAL_TIME=str(item.get("SIGNAL_TIME", "")),
        EOD_RECONCILE_TIME=str(item.get("EOD_RECONCILE_TIME", "")),
        FORCED_SELL_TIME=str(item.get("FORCED_SELL_TIME", "")),
        MAX_OPEN_POSITIONS=int(item.get("MAX_OPEN_POSITIONS", 0)),
        STOP_LOSS_PCT=float(item.get("STOP_LOSS_PCT", 0)),
        BUDGET_PCT=float(item.get("BUDGET_PCT", 0)),
        MAX_HOLDING_DAY=int(item.get("MAX_HOLDING_DAY", 0)),
        FORCED_SELL_MODE=str(item.get("FORCED_SELL_MODE", "FIXED")).upper(),
        CURRENCY=str(item.get("CURRENCY", "")),
    )


def load_exchange_configs() -> List[ExchangeConfig]:
    # Lazy import keeps this module dependency-light at boot
    from ui_connection.ui_service.parameter_service import get_exchange_configs

    raw_list = get_exchange_configs()
    return [_to_dataclass(item) for item in raw_list]


def get_enabled_exchanges() -> List[ExchangeConfig]:
    return [exchange for exchange in load_exchange_configs() if exchange.ENABLED]


def get_exchange_config(exchange_code: str) -> ExchangeConfig:
    normalized = exchange_code.strip().upper()
    for exchange in load_exchange_configs():
        if exchange.EXCHANGE.strip().upper() == normalized:
            return exchange
    raise ValueError(f"Exchange config not found: {exchange_code}")

"""
Settings facade.

Reads:
  - System credentials (DB, SMTP) from os.environ (loaded by system_config_loader)
  - All other parameters from the local parameter cache (refreshed at login)

Public surface (`AppSettings`, `load_settings`) is preserved for legacy callers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Optional

from ui_connection.ui_service.parameter_service import (
    get_param,
    get_param_bool,
    get_param_float,
    get_param_int,
    get_param_list,
)


def _env(name: str, default: str = "") -> str:
    return os.getenv(name) or default


@dataclass
class AppSettings:
    USERNAME: str
    EMAIL: str
    DEVICE_ID: Optional[str]
    APP_TIMEZONE: str
    APP_VERSION: str
    TWS_APP_PATH: str

    IBKR_MODE: str
    IBKR_HOST: str
    IBKR_PORT: int
    IBKR_CLIENT_ID: int

    DB_HOST: str
    DB_PORT: int
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str

    TELEGRAM_BOT_TOKEN: Optional[str]
    TELEGRAM_CHAT_ID: Optional[str]

    TOTAL_MAX_OPEN_POSITIONS: int
    MAX_DAILY_TRADE_COUNT: int
    EXIT_MODE: str

    ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME: str
    ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME: str
    ACCOUNT_SNAPSHOT_EOD_TIME: str

    ACCOUNT_SNAPSHOT_ENABLED: bool
    END_OF_DAY_RECONCILE_ENABLED: bool
    FORCED_SELL_ENABLED: bool
    TELEGRAM_ENABLED: bool
    MAIL_ENABLED: bool

    EXCHANGE_PRIORITY: List[str]

    RUN_ON_SCHEDULE: bool
    MANUAL_TRIGGER_PIPELINES: List[str]

    SIM_IBKR_MODE: str
    SIM_IBKR_HOST: str
    SIM_IBKR_PORT: int
    SIM_IBKR_CLIENT_ID: int


def load_settings() -> AppSettings:
    """
    Build an AppSettings snapshot from:
      - system_config.env (DB credentials)
      - local parameter cache (everything else)

    Cache content is established by parameter_service.refresh_cache_for_user()
    at login time. Before login, catalog defaults are used as a fallback.
    """
    return AppSettings(
        # User identity is owned by the cache (set at login)
        USERNAME=get_param("USERNAME") or "",
        EMAIL=get_param("EMAIL") or "",
        DEVICE_ID=get_param("DEVICE_ID"),
        APP_TIMEZONE=get_param("APP_TIMEZONE") or "Europe/Amsterdam",
        APP_VERSION=get_param("APP_VERSION") or "1.1.0",
        TWS_APP_PATH=get_param("TWS_APP_PATH") or "",

        IBKR_MODE=get_param("IBKR_MODE") or "PAPER",
        IBKR_HOST=get_param("IBKR_HOST") or "127.0.0.1",
        IBKR_PORT=get_param_int("IBKR_PORT", default=7497) or 7497,
        IBKR_CLIENT_ID=get_param_int("IBKR_CLIENT_ID", default=1) or 1,

        # System credentials — environment only
        DB_HOST=_env("DB_HOST"),
        DB_PORT=int(_env("DB_PORT", "5432")),
        DB_NAME=_env("DB_NAME"),
        DB_USER=_env("DB_USER"),
        DB_PASSWORD=_env("DB_PASSWORD"),

        TELEGRAM_BOT_TOKEN=get_param("TELEGRAM_BOT_TOKEN"),
        TELEGRAM_CHAT_ID=get_param("TELEGRAM_CHAT_ID"),

        TOTAL_MAX_OPEN_POSITIONS=get_param_int("TOTAL_MAX_OPEN_POSITIONS", default=8) or 8,
        MAX_DAILY_TRADE_COUNT=get_param_int("MAX_DAILY_TRADE_COUNT", default=2) or 2,
        EXIT_MODE=get_param("EXIT_MODE") or "TARGET_PRICE",

        ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME=get_param("ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME") or "11:00",
        ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME=get_param("ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME") or "18:00",
        ACCOUNT_SNAPSHOT_EOD_TIME=get_param("ACCOUNT_SNAPSHOT_EOD_TIME") or "23:30",

        ACCOUNT_SNAPSHOT_ENABLED=get_param_bool("ACCOUNT_SNAPSHOT_ENABLED", default=True),
        END_OF_DAY_RECONCILE_ENABLED=get_param_bool("END_OF_DAY_RECONCILE_ENABLED", default=True),
        FORCED_SELL_ENABLED=get_param_bool("FORCED_SELL_ENABLED", default=True),
        TELEGRAM_ENABLED=get_param_bool("TELEGRAM_ENABLED", default=False),
        MAIL_ENABLED=get_param_bool("MAIL_ENABLED", default=False),

        EXCHANGE_PRIORITY=get_param_list("EXCHANGE_PRIORITY", default=[]),

        RUN_ON_SCHEDULE=get_param_bool("RUN_ON_SCHEDULE", default=False),
        MANUAL_TRIGGER_PIPELINES=get_param_list("MANUAL_TRIGGER_PIPELINES", default=[]),

        SIM_IBKR_MODE=get_param("SIM_IBKR_MODE") or "PAPER",
        SIM_IBKR_HOST=get_param("SIM_IBKR_HOST") or "127.0.0.1",
        SIM_IBKR_PORT=get_param_int("SIM_IBKR_PORT", default=7497) or 7497,
        SIM_IBKR_CLIENT_ID=get_param_int("SIM_IBKR_CLIENT_ID", default=1) or 1,
    )

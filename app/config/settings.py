from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_LOCAL_PATH = BASE_DIR / ".env_local"
CONFIG_ENV_PATH = BASE_DIR / "config.env"


def _load_env_files() -> None:
    # override=False: never overwrite vars already set by the entry point
    if CONFIG_ENV_PATH.exists():
        load_dotenv(CONFIG_ENV_PATH, override=False)

    if ENV_LOCAL_PATH.exists():
        load_dotenv(ENV_LOCAL_PATH, override=False)


def _get_env(name: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    value = os.getenv(name, default)
    if required and (value is None or str(value).strip() == ""):
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _get_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _get_int(name: str, default: Optional[int] = None, required: bool = False) -> Optional[int]:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        if required and default is None:
            raise ValueError(f"Missing required integer environment variable: {name}")
        return default

    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be integer, got: {value}") from exc


def _get_list(name: str, default: Optional[List[str]] = None) -> List[str]:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default or []
    return [item.strip().upper() for item in value.split(",") if item.strip()]


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
    _load_env_files()

    settings = AppSettings(
        USERNAME=_get_env("USERNAME", default="") or "",
        EMAIL=_get_env("EMAIL", default="") or "",
        DEVICE_ID=_get_env("DEVICE_ID", default=None),
        APP_TIMEZONE=_get_env("APP_TIMEZONE", default="Europe/Amsterdam") or "Europe/Amsterdam",
        APP_VERSION=_get_env("APP_VERSION", default="1.0.0") or "1.0.0",
        TWS_APP_PATH=_get_env("TWS_APP_PATH", default="") or "",

        IBKR_MODE=_get_env("IBKR_MODE", default="PAPER") or "PAPER",
        IBKR_HOST=_get_env("IBKR_HOST", default="127.0.0.1") or "127.0.0.1",
        IBKR_PORT=_get_int("IBKR_PORT", default=7497) or 7497,
        IBKR_CLIENT_ID=_get_int("IBKR_CLIENT_ID", default=1) or 1,

        DB_HOST=_get_env("DB_HOST", default="95.216.148.216") or "95.216.148.216",
        DB_PORT=_get_int("DB_PORT", default=5432) or 5432,
        DB_NAME=_get_env("DB_NAME", default="trade_app") or "trade_app",
        DB_USER=_get_env("DB_USER", default="irfan_admin") or "irfan_admin",
        DB_PASSWORD=_get_env("DB_PASSWORD", default="TradeAPP_IA_2026@@") or "TradeAPP_IA_2026@@",

        TELEGRAM_BOT_TOKEN=_get_env("TELEGRAM_BOT_TOKEN", default=None),
        TELEGRAM_CHAT_ID=_get_env("TELEGRAM_CHAT_ID", default=None),

        TOTAL_MAX_OPEN_POSITIONS=_get_int("TOTAL_MAX_OPEN_POSITIONS", default=0) or 0,
        MAX_DAILY_TRADE_COUNT=_get_int("MAX_DAILY_TRADE_COUNT", default=0) or 0,
        EXIT_MODE=_get_env("EXIT_MODE", default="TARGET_PRICE") or "TARGET_PRICE",

        ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME=_get_env(
            "ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME", default="11:00") or "11:00",
        ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME=_get_env(
            "ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME", default="18:00") or "18:00",
        ACCOUNT_SNAPSHOT_EOD_TIME=_get_env(
            "ACCOUNT_SNAPSHOT_EOD_TIME", default="23:30") or "23:30",

        ACCOUNT_SNAPSHOT_ENABLED=_get_bool("ACCOUNT_SNAPSHOT_ENABLED", default=True),
        END_OF_DAY_RECONCILE_ENABLED=_get_bool("END_OF_DAY_RECONCILE_ENABLED", default=True),
        FORCED_SELL_ENABLED=_get_bool("FORCED_SELL_ENABLED", default=True),
        TELEGRAM_ENABLED=_get_bool("TELEGRAM_ENABLED", default=False),
        MAIL_ENABLED=_get_bool("MAIL_ENABLED", default=False),

        EXCHANGE_PRIORITY=_get_list("EXCHANGE_PRIORITY", default=[]),

        RUN_ON_SCHEDULE=_get_bool("RUN_ON_SCHEDULE", default=False),
        MANUAL_TRIGGER_PIPELINES=_get_list("MANUAL_TRIGGER_PIPELINES", default=[]),

        SIM_IBKR_MODE=_get_env("SIM_IBKR_MODE", default="PAPER") or "PAPER",
        SIM_IBKR_HOST=_get_env("SIM_IBKR_HOST", default="127.0.0.1") or "127.0.0.1",
        SIM_IBKR_PORT=_get_int("SIM_IBKR_PORT", default=7497) or 7497,
        SIM_IBKR_CLIENT_ID=_get_int("SIM_IBKR_CLIENT_ID", default=1) or 1,
    )

    # Only validate if core config is present
    if settings.DB_HOST and settings.USERNAME:
        _validate_settings(settings)

    return settings


def _validate_settings(settings: AppSettings) -> None:
    allowed_exit_modes = {"TARGET_PRICE", "INCREMENTAL"}
    if settings.EXIT_MODE not in allowed_exit_modes:
        raise ValueError(
            f"EXIT_MODE must be one of {allowed_exit_modes}, got: {settings.EXIT_MODE}"
        )

    allowed_ibkr_modes = {"PAPER", "LIVE"}
    if settings.IBKR_MODE not in allowed_ibkr_modes:
        raise ValueError(
            f"IBKR_MODE must be one of {allowed_ibkr_modes}, got: {settings.IBKR_MODE}"
        )

    if settings.TOTAL_MAX_OPEN_POSITIONS <= 0:
        raise ValueError("TOTAL_MAX_OPEN_POSITIONS must be > 0")

    if settings.MAX_DAILY_TRADE_COUNT <= 0:
        raise ValueError("MAX_DAILY_TRADE_COUNT must be > 0")

    if not settings.APP_TIMEZONE.strip():
        raise ValueError("APP_TIMEZONE cannot be empty")

    if not settings.APP_VERSION.strip():
        raise ValueError("APP_VERSION cannot be empty")

    if settings.SIM_IBKR_MODE not in {"PAPER", "LIVE"}:
        raise ValueError(
            f"SIM_IBKR_MODE must be one of PAPER/LIVE, got: {settings.SIM_IBKR_MODE}"
        )

    for name in [
        "ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME",
        "ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME",
        "ACCOUNT_SNAPSHOT_EOD_TIME",
    ]:
        value = getattr(settings, name)
        if ":" not in value:
            raise ValueError(f"{name} must be in HH:MM format")

    allowed_manual_pipelines = {
        "ACCOUNT_SNAPSHOT_POST_EU_BUY",
        "ACCOUNT_SNAPSHOT_POST_EU_CLOSE",
        "ACCOUNT_SNAPSHOT_EOD",
        "BUY_PREPARE",
        "BUY_EXECUTION",
        "FORCED_SELL",
        "END_OF_DAY_RECONCILE",
    }

    invalid = [
        x for x in settings.MANUAL_TRIGGER_PIPELINES
        if x not in allowed_manual_pipelines
    ]
    if invalid:
        raise ValueError(
            f"Invalid MANUAL_TRIGGER_PIPELINES values: {invalid}. "
            f"Allowed: {sorted(allowed_manual_pipelines)}"
        )
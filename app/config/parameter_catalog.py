"""
Single source of truth for all user-facing parameters.

Defaults defined here are seeded into "user".open_parameters when a new user
registers. They are also used as fallbacks when the local cache is empty.

System-level credentials (DB, SMTP) live in system_config.env, NOT here.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ParamDef:
    key: str
    default: str
    location: str
    desc: str


# ---------------------------------------------------------------------------
# Scalar parameters (one row per key in user.open_parameters)
# ---------------------------------------------------------------------------
SCALAR_PARAMETERS: list[ParamDef] = [
    # Application
    ParamDef("APP_TIMEZONE",      "Europe/Amsterdam", ".env_local", "Application timezone"),
    ParamDef("APP_VERSION",       "1.1.0",            ".env_local", "Application version"),
    ParamDef("TWS_APP_PATH",      "",                 ".env_local", "Full path to Trader Workstation.app on this machine. Auto-detected when blank."),
    ParamDef("APP_LOCK_PASSWORD", "",                 ".env_local", "Optional app lock password"),

    # IBKR (live)
    ParamDef("IBKR_MODE",         "PAPER",      ".env_local", "Trading mode: PAPER or LIVE"),
    ParamDef("IBKR_HOST",         "127.0.0.1",  ".env_local", "IBKR API host"),
    ParamDef("IBKR_PORT",         "7497",       ".env_local", "IBKR API port (PAPER=7497, LIVE=7496)"),
    ParamDef("IBKR_CLIENT_ID",    "1",          ".env_local", "IBKR client ID"),

    # IBKR (sim)
    ParamDef("SIM_IBKR_MODE",      "PAPER",     ".env_local", "Simulator IBKR mode"),
    ParamDef("SIM_IBKR_HOST",      "127.0.0.1", ".env_local", "Simulator IBKR host"),
    ParamDef("SIM_IBKR_PORT",      "7497",      ".env_local", "Simulator IBKR port"),
    ParamDef("SIM_IBKR_CLIENT_ID", "1",         ".env_local", "Simulator IBKR client ID"),

    # Notifications
    ParamDef("TELEGRAM_BOT_TOKEN", "", ".env_local", "Telegram bot token"),
    ParamDef("TELEGRAM_CHAT_ID",   "", ".env_local", "Telegram chat ID"),
    ParamDef("TELEGRAM_ENABLED",   "false", "config.env", "Enable Telegram notifications"),
    ParamDef("MAIL_ENABLED",       "false", "config.env", "Enable e-mail notifications"),

    # Trade execution limits
    ParamDef("TOTAL_MAX_OPEN_POSITIONS", "8",            "config.env", "Global max open positions"),
    ParamDef("MAX_DAILY_TRADE_COUNT",    "2",            "config.env", "Max trades executed per day"),
    ParamDef("EXIT_MODE",                "TARGET_PRICE", "config.env", "Exit logic mode: TARGET_PRICE or INCREMENTAL"),
    ParamDef("STOP_LOSS_PCT",            "2.0",          "config.env", "Global stop-loss percentage"),

    # Pipelines / scheduling
    ParamDef("ACCOUNT_SNAPSHOT_ENABLED",      "true",            "config.env", "Enable account snapshot pipeline"),
    ParamDef("END_OF_DAY_RECONCILE_ENABLED",  "true",            "config.env", "Enable end-of-day reconcile pipeline"),
    ParamDef("FORCED_SELL_ENABLED",           "true",            "config.env", "Enable forced-sell pipeline"),
    ParamDef("RUN_ON_SCHEDULE",               "true",            "config.env", "Run pipelines on schedule"),
    ParamDef("MANUAL_TRIGGER_PIPELINES",      "FORCED_SELL",     "config.env", "Pipelines that can be triggered manually"),
    ParamDef("EXCHANGE_PRIORITY",             "NASDAQ,NYSE,AEB", "config.env", "Exchange priority order"),

    ParamDef("ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME",   "11:00", "config.env", "Snapshot time after EU buy"),
    ParamDef("ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME", "18:00", "config.env", "Snapshot time after EU close"),
    ParamDef("ACCOUNT_SNAPSHOT_EOD_TIME",           "23:30", "config.env", "End-of-day snapshot time"),
]


# ---------------------------------------------------------------------------
# Exchange-scoped parameters (one row per exchange, value is JSON)
# Stored in user.open_parameters with key = "EXCHANGE_CONFIG__<CODE>"
# ---------------------------------------------------------------------------
EXCHANGE_DEFAULTS: list[dict[str, Any]] = [
    {
        "EXCHANGE": "AEB",
        "ENABLED": True,
        "BUY_PREPARE_TIME": "09:40",
        "SIGNAL_TIME": "09:46",
        "EOD_RECONCILE_TIME": "18:40",
        "FORCED_SELL_MODE": "FIXED",
        "FORCED_SELL_TIME": "17:00",
        "MAX_OPEN_POSITIONS": 1,
        "MAX_HOLDING_DAY": 7,
        "STOP_LOSS_PCT": 3.0,
        "BUDGET_PCT": 0.3,
        "CURRENCY": "EUR",
    },
    {
        "EXCHANGE": "NASDAQ",
        "ENABLED": True,
        "BUY_PREPARE_TIME": "15:40",
        "SIGNAL_TIME": "15:47",
        "EOD_RECONCILE_TIME": "23:55",
        "FORCED_SELL_MODE": "FIXED",
        "FORCED_SELL_TIME": "20:30",
        "MAX_OPEN_POSITIONS": 2,
        "MAX_HOLDING_DAY": 7,
        "STOP_LOSS_PCT": 2.0,
        "BUDGET_PCT": 0.4,
        "CURRENCY": "USD",
    },
    {
        "EXCHANGE": "NYSE",
        "ENABLED": True,
        "BUY_PREPARE_TIME": "15:40",
        "SIGNAL_TIME": "15:47",
        "EOD_RECONCILE_TIME": "23:55",
        "FORCED_SELL_MODE": "FIXED",
        "FORCED_SELL_TIME": "20:30",
        "MAX_OPEN_POSITIONS": 2,
        "MAX_HOLDING_DAY": 7,
        "STOP_LOSS_PCT": 2.0,
        "BUDGET_PCT": 0.3,
        "CURRENCY": "USD",
    },
]

EXCHANGE_PARAM_KEY_PREFIX = "EXCHANGE_CONFIG__"


def exchange_param_key(exchange_code: str) -> str:
    return f"{EXCHANGE_PARAM_KEY_PREFIX}{exchange_code.strip().upper()}"


def all_default_rows() -> list[dict[str, str]]:
    """Return all parameter rows that should be seeded for a new user."""
    import json

    rows: list[dict[str, str]] = []

    for p in SCALAR_PARAMETERS:
        rows.append({
            "param_key":      p.key,
            "param_value":    p.default,
            "param_default":  p.default,
            "param_location": p.location,
            "param_desc":     p.desc,
        })

    for ex in EXCHANGE_DEFAULTS:
        code = ex["EXCHANGE"]
        json_value = json.dumps(ex, sort_keys=False)
        rows.append({
            "param_key":      exchange_param_key(code),
            "param_value":    json_value,
            "param_default":  json_value,
            "param_location": "exchanges.yaml",
            "param_desc":     f"Exchange configuration for {code}",
        })

    return rows


def is_exchange_param(key: str) -> bool:
    return key.startswith(EXCHANGE_PARAM_KEY_PREFIX)


def exchange_code_from_key(key: str) -> str:
    return key[len(EXCHANGE_PARAM_KEY_PREFIX):]

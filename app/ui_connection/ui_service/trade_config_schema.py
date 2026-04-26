from __future__ import annotations

TRADE_CONFIG_SCHEMA = {
    "env_local": {
        "title": "Application Settings",
        "fields": [
            {
                "key": "APP_TIMEZONE",
                "label": "App Timezone",
                "description": "Application timezone.",
                "type": "string",
                "editable": True,
            },
            {
                "key": "IBKR_MODE",
                "label": "IBKR Mode",
                "description": "Trading mode. PAPER or LIVE.",
                "type": "select",
                "options": ["PAPER", "LIVE"],
                "editable": True,
            },
            {
                "key": "IBKR_PORT",
                "label": "IBKR Port",
                "description": "Auto-derived from IBKR Mode. PAPER=7497, LIVE=7496.",
                "type": "int",
                "editable": False,
            },
            {
                "key": "APP_LOCK_PASSWORD",
                "label": "App Lock Password",
                "description": "Read-only here. Update from Settings later.",
                "type": "string",
                "editable": False,
            },
            {
                "key": "TWS_APP_PATH",
                "label": "TWS App Path",
                "description": "Full path to Trader Workstation.app on this machine. Auto-detected if left blank.",
                "type": "string",
                "editable": True,
            },
        ],
    },
    "config_env": {
        "title": "Core Trade Settings",
        "fields": [
            {"key": "TOTAL_MAX_OPEN_POSITIONS", "label": "Total Max Open Positions", "description": "Global max open positions.", "type": "int", "editable": True},
            {"key": "MAX_DAILY_TRADE_COUNT", "label": "Max Daily Trade Count", "description": "Daily max trade count.", "type": "int", "editable": True},
            {"key": "EXIT_MODE", "label": "Exit Mode", "description": "Current exit logic.", "type": "string", "editable": True},
            {"key": "STOP_LOSS_PCT", "label": "Stop Loss %", "description": "Global stop loss percentage.", "type": "float", "editable": True},

            {"key": "ACCOUNT_SNAPSHOT_ENABLED", "label": "Account Snapshot Enabled", "description": "Read-only system switch.", "type": "bool", "editable": False},
            {"key": "END_OF_DAY_RECONCILE_ENABLED", "label": "End Of Day Reconcile Enabled", "description": "Read-only system switch.", "type": "bool", "editable": False},
            {"key": "FORCED_SELL_ENABLED", "label": "Forced Sell Enabled", "description": "Read-only system switch.", "type": "bool", "editable": False},
            {"key": "TELEGRAM_ENABLED", "label": "Telegram Enabled", "description": "Read-only notification switch.", "type": "bool", "editable": False},
            {"key": "MAIL_ENABLED", "label": "Mail Enabled", "description": "Read-only notification switch.", "type": "bool", "editable": False},

            {"key": "EXCHANGE_PRIORITY", "label": "Exchange Priority", "description": "Execution priority order.", "type": "string", "editable": True},
            {"key": "RUN_ON_SCHEDULE", "label": "Run On Schedule", "description": "Read-only scheduler mode.", "type": "bool", "editable": False},
            {"key": "MANUAL_TRIGGER_PIPELINES", "label": "Manual Trigger Pipelines", "description": "Read-only manual pipeline config.", "type": "string", "editable": False},

            {"key": "ACCOUNT_SNAPSHOT_POST_EU_BUY_TIME", "label": "Snapshot Post EU Buy Time", "description": "Account snapshot time.", "type": "time", "editable": True},
            {"key": "ACCOUNT_SNAPSHOT_POST_EU_CLOSE_TIME", "label": "Snapshot Post EU Close Time", "description": "Account snapshot time.", "type": "time", "editable": True},
            {"key": "ACCOUNT_SNAPSHOT_EOD_TIME", "label": "Snapshot EOD Time", "description": "Account snapshot time.", "type": "time", "editable": True},
        ],
    },
    "exchange_yaml": {
        "title": "Exchange Configurations",
        "fields": [
            {"key": "EXCHANGE", "label": "Exchange", "description": "Exchange code.", "type": "string", "editable": False},
            {"key": "ENABLED", "label": "Enabled", "description": "Exchange enabled flag.", "type": "bool", "editable": False},
            {"key": "BUY_PREPARE_TIME", "label": "Buy Prepare Time", "description": "Read-only schedule time.", "type": "time", "editable": False},
            {"key": "SIGNAL_TIME", "label": "Signal Time", "description": "Read-only schedule time.", "type": "time", "editable": False},
            {"key": "EOD_RECONCILE_TIME", "label": "EOD Reconcile Time", "description": "Read-only schedule time.", "type": "time", "editable": False},
            {"key": "FORCED_SELL_MODE", "label": "Forced Sell Mode", "description": "Forced sell strategy mode.", "type": "string", "editable": True},
            {"key": "FORCED_SELL_TIME", "label": "Forced Sell Time", "description": "Read-only schedule time.", "type": "time", "editable": False},
            {"key": "MAX_OPEN_POSITIONS", "label": "Max Open Positions", "description": "Exchange max open positions.", "type": "int", "editable": True},
            {"key": "MAX_HOLDING_DAY", "label": "Max Holding Day", "description": "Maximum holding day.", "type": "int", "editable": True},
            {"key": "STOP_LOSS_PCT", "label": "Stop Loss %", "description": "Exchange stop loss percentage.", "type": "float", "editable": True},
            {"key": "BUDGET_PCT", "label": "Budget %", "description": "Exchange budget allocation.", "type": "float", "editable": True},
            {"key": "CURRENCY", "label": "Currency", "description": "Exchange currency.", "type": "string", "editable": False},
        ],
    },
}
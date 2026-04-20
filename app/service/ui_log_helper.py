from __future__ import annotations

from datetime import datetime


def ui_log(category: str, message: str) -> None:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[UI_LOG][{timestamp}][{category}] {message}", flush=True)


## sample: how to use instead of print

# from service.ui_log_helper import ui_log

# ui_log("BOOT", "Application boot started")
# ui_log("DB", "Database connection established")
# ui_log("IBKR", "TWS connection verified")
# ui_log("SCHEDULER", "Scheduler loop active")
# ui_log("PIPELINE", "BUY_PREPARE triggered")
# ui_log("ERROR", "Unexpected exception in reconcile job")
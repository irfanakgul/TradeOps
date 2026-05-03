"""
Backend (FastAPI) entry point.

Loads only system_config.env (DB + SMTP credentials). All user-facing
parameters live in DB and are pulled into a local cache after login.
"""

import os
import sys
from pathlib import Path

from uvicorn import run

from config.system_config_loader import load_system_config


load_system_config()


def _working_dir() -> Path:
    target = Path.home() / "Library" / "Application Support" / "TradeOps"
    target.mkdir(parents=True, exist_ok=True)
    return target


os.chdir(_working_dir())


if __name__ == "__main__":
    run(
        "ui_connection.ui_api.main_api:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
    )

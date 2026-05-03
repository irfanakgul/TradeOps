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


# Force stdout/stderr to UTF-8 on Windows. Without this, any print() that
# contains non-ASCII (emoji, Türkçe karakter, etc.) raises:
#   UnicodeEncodeError: 'charmap' codec can't encode character ...
# which propagates as a 500 error from anywhere a print is reached.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")


load_system_config()


def _working_dir() -> Path:
    from config.paths import app_support_dir
    return app_support_dir()


os.chdir(_working_dir())


if __name__ == "__main__":
    run(
        "ui_connection.ui_api.main_api:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
    )

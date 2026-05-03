"""
Trading server entry point.

Loads only system_config.env (DB + SMTP credentials). All user-facing
parameters come from the local cache (refreshed at login time by the backend).
"""

import os
import sys
from pathlib import Path

from config.system_config_loader import load_system_config

from main import main


load_system_config()


def _working_dir() -> Path:
    target = Path.home() / "Library" / "Application Support" / "TradeOps"
    target.mkdir(parents=True, exist_ok=True)
    return target


os.chdir(_working_dir())


if __name__ == "__main__":
    main()

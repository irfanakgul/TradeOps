"""
Trading server entry point.

Loads only system_config.env (DB + SMTP credentials). All user-facing
parameters come from the local cache (refreshed at login time by the backend).
"""

import os
from pathlib import Path

from config.system_config_loader import load_system_config

from main import main


load_system_config()


def _working_dir() -> Path:
    from config.paths import app_support_dir
    return app_support_dir()


os.chdir(_working_dir())


if __name__ == "__main__":
    main()

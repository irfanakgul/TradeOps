from __future__ import annotations

from sqlalchemy.engine import Engine

from config.settings import load_settings
from repository.db import create_db_engine

_ENGINE: Engine | None = None


def get_ui_engine() -> Engine:
    global _ENGINE

    if _ENGINE is None:
        settings = load_settings()
        _ENGINE = create_db_engine(settings)

    return _ENGINE
"""
Lazy-initialized SQLAlchemy engine for UI/DB access.

Reads DB credentials directly from environment variables (loaded earlier from
system_config.env) — does NOT depend on config.settings, which would create a
circular import (settings → parameter_service → engine).
"""

from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.engine.url import URL


_ENGINE: Engine | None = None


def _build_url() -> URL:
    return URL.create(
        drivername="postgresql+psycopg2",
        username=os.getenv("DB_USER", ""),
        password=os.getenv("DB_PASSWORD", ""),
        host=os.getenv("DB_HOST", ""),
        port=int(os.getenv("DB_PORT") or "5432"),
        database=os.getenv("DB_NAME", ""),
    )


def get_ui_engine() -> Engine:
    global _ENGINE
    if _ENGINE is None:
        _ENGINE = create_engine(_build_url(), pool_pre_ping=True, future=True)
    return _ENGINE

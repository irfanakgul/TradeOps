"""
Loads system_config.env (DB + SMTP credentials) directly into os.environ.

The file is bundled inside the PyInstaller binary so users never see it.
This module is imported by entry-point scripts before any other module that
needs DB/SMTP access.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _candidate_paths() -> list[Path]:
    paths: list[Path] = []

    if getattr(sys, "frozen", False):
        meipass = Path(getattr(sys, "_MEIPASS", "."))
        paths.append(meipass / "system_config.env")
        # Allow override from app support dir (cross-platform)
        try:
            from config.paths import app_support_dir
            paths.append(app_support_dir() / "system_config.env")
        except Exception:
            pass
    else:
        # Dev: alongside this module's repo root
        here = Path(__file__).resolve().parent
        paths.append(here.parent / "system_config.env")
        paths.append(here.parent.parent / "system_config.env")

    return paths


def load_system_config() -> None:
    for path in _candidate_paths():
        if not path.exists():
            continue
        with open(path, encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip()
                if key and key not in os.environ:
                    os.environ[key] = value
        return

"""
Cross-platform persistent app-support directory.

  macOS   → ~/Library/Application Support/TradeOps
  Windows → %APPDATA%\\TradeOps  (e.g. C:\\Users\\<user>\\AppData\\Roaming\\TradeOps)
  Linux   → ~/.tradeops
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def app_support_dir() -> Path:
    if sys.platform == "darwin":
        target = Path.home() / "Library" / "Application Support" / "TradeOps"
    elif sys.platform == "win32":
        base = os.environ.get("APPDATA") or os.environ.get("USERPROFILE") or str(Path.home())
        target = Path(base) / "TradeOps"
    else:
        target = Path.home() / ".tradeops"

    target.mkdir(parents=True, exist_ok=True)
    return target

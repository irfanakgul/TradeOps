"""
Session hand-off helpers used by the in-app updater.

Before the app quits for an update, the frontend POSTs the current user object
here. After the new app boots, the frontend GETs it back and clears the file.

Stored as a one-shot file in the app support dir. If older than 5 minutes it
is treated as expired and ignored.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path


_FILENAME = "pending_login.json"
_TTL_SECONDS = 300  # 5 minutes


def _path() -> Path:
    target = Path.home() / "Library" / "Application Support" / "TradeOps"
    target.mkdir(parents=True, exist_ok=True)
    return target / _FILENAME


def save_pending_login(user: dict) -> None:
    payload = {"user": user, "saved_at": time.time()}
    p = _path()
    tmp = p.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    os.replace(tmp, p)


def consume_pending_login() -> dict | None:
    """Return the saved user object once, then delete the file. None if absent or stale."""
    p = _path()
    if not p.exists():
        return None
    try:
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
    except (ValueError, OSError):
        try:
            p.unlink()
        except OSError:
            pass
        return None

    saved_at = float(data.get("saved_at") or 0)
    user = data.get("user")

    # Always delete after one read — never reuse
    try:
        p.unlink()
    except OSError:
        pass

    if not user:
        return None
    if (time.time() - saved_at) > _TTL_SECONDS:
        return None
    return user

"""
Manages background DMG build jobs spawned from the admin Releases page.

Only one build runs at a time. Status is reported via /tmp/tradeops_build.log
(written by build_dmg.py) plus an in-memory dict tracking the current job.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import threading
import time
from pathlib import Path


def _resolve_repo_root() -> Path:
    """
    Find the dev's source-code repo. Tries env override first, then falls
    back to Desktop/TradeOps. The build button is only useful on the dev
    machine — installed-app users will just see "build script not found".
    """
    env = os.environ.get("TRADEOPS_REPO_ROOT")
    if env and Path(env).exists():
        return Path(env)

    candidates = [
        Path.home() / "Desktop" / "TradeOps",
        # Dev fallback — when running from source directly
        Path(__file__).resolve().parents[3],
    ]
    for c in candidates:
        if (c / "app" / "build_dmg.py").exists():
            return c
    return candidates[0]


REPO_ROOT = _resolve_repo_root()
BUILD_SCRIPT = REPO_ROOT / "app" / "build_dmg.py"
VENV_PYTHON = REPO_ROOT / ".venv" / "bin" / "python"
LOG_PATH = Path("/tmp/tradeops_build.log")


_state: dict = {
    "running": False,
    "platform": None,
    "started_at": None,
    "finished_at": None,
    "exit_code": None,
    "output_path": None,
}
_lock = threading.RLock()


def _set(**kwargs) -> None:
    with _lock:
        _state.update(kwargs)


def _detect_output_path(log: str) -> str | None:
    """Pull the final '✓ DONE: /Users/.../TradeOps_X.Y.Z.dmg' path out of the log."""
    m = re.search(r"✓ DONE:\s+(\S+\.dmg)", log)
    return m.group(1) if m else None


def _run_subprocess(target: str) -> None:
    if not BUILD_SCRIPT.exists():
        _set(running=False, exit_code=99, finished_at=time.time())
        return

    python = str(VENV_PYTHON) if VENV_PYTHON.exists() else sys.executable

    # macOS GUI apps inherit a stripped PATH that often misses /opt/homebrew/bin
    # and /usr/local/bin where npx, hdiutil, xattr live. Augment so the build
    # script can call them.
    env = os.environ.copy()
    extra = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
    existing = env.get("PATH", "").split(":")
    for p in reversed(extra):
        if p not in existing:
            existing.insert(0, p)
    env["PATH"] = ":".join(existing)

    proc = subprocess.Popen(
        [python, str(BUILD_SCRIPT), target],
        cwd=str(REPO_ROOT),
        stdout=subprocess.DEVNULL,   # build_dmg.py writes its own log
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
        env=env,
        start_new_session=True,      # survive parent death
    )
    rc = proc.wait()

    log = ""
    if LOG_PATH.exists():
        try:
            log = LOG_PATH.read_text(encoding="utf-8")
        except OSError:
            log = ""

    _set(
        running=False,
        finished_at=time.time(),
        exit_code=rc,
        output_path=_detect_output_path(log),
    )


def start_build(platform: str, requesting_user_type: str) -> dict:
    if requesting_user_type != "ADMIN":
        return {"ok": False, "message": "Admin only"}

    if platform not in {"apple-silicon", "intel", "windows"}:
        return {"ok": False, "message": f"Unknown platform: {platform}"}

    if platform != "apple-silicon":
        return {"ok": False, "message": f"{platform} build not yet supported"}

    with _lock:
        if _state["running"]:
            return {"ok": False, "message": "A build is already in progress"}

        _state.update({
            "running": True,
            "platform": platform,
            "started_at": time.time(),
            "finished_at": None,
            "exit_code": None,
            "output_path": None,
        })

    # Truncate log so the UI starts fresh
    try:
        LOG_PATH.write_text("", encoding="utf-8")
    except OSError:
        pass

    threading.Thread(target=_run_subprocess, args=(platform,), daemon=True).start()
    return {"ok": True, "platform": platform, "started_at": _state["started_at"]}


def get_status(tail_bytes: int = 16_000) -> dict:
    with _lock:
        state = dict(_state)

    log_text = ""
    if LOG_PATH.exists():
        try:
            size = LOG_PATH.stat().st_size
            with open(LOG_PATH, "rb") as f:
                if size > tail_bytes:
                    f.seek(-tail_bytes, os.SEEK_END)
                log_text = f.read().decode("utf-8", errors="replace")
        except OSError:
            pass

    output = state.get("output_path") or _detect_output_path(log_text)

    return {
        "running": state["running"],
        "platform": state["platform"],
        "started_at": state["started_at"],
        "finished_at": state["finished_at"],
        "exit_code": state["exit_code"],
        "output_path": output,
        "log_tail": log_text,
    }

"""
Release service — version checking and admin release management.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from ui_connection.ui_repository.release_repository import (
    delete_release,
    fetch_all_releases,
    fetch_latest_active_release,
    fetch_version_distribution,
    fetch_users_by_version,
    insert_release,
    update_release,
    update_user_app_version,
)


class ReleaseError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _serialize(row: dict | None) -> dict | None:
    if not row:
        return None
    out = dict(row)
    for key in ("published_at", "last_seen", "LAST_VERSION_CHECK_AT", "LAST_LOGIN_AT"):
        v = out.get(key)
        if isinstance(v, datetime):
            out[key] = v.isoformat()
    return out


def _parse_version(v: str) -> tuple[int, ...]:
    """Best-effort semver parse. '1.10.2' → (1, 10, 2)."""
    if not v:
        return (0,)
    parts: list[int] = []
    for chunk in str(v).strip().lstrip("v").split("."):
        digits = "".join(c for c in chunk if c.isdigit())
        if not digits:
            break
        parts.append(int(digits))
    return tuple(parts) or (0,)


def is_newer(candidate: str, baseline: str) -> bool:
    return _parse_version(candidate) > _parse_version(baseline)


# ---------------------------------------------------------------------------
# Public: version check (called by every client on startup)
# ---------------------------------------------------------------------------

def check_for_update(current_version: str, username: str | None = None) -> dict:
    """
    Returns the latest active release plus a `needs_update` flag.
    Side effect: records this client's current version on the user row.
    """
    # Track which users are on which version
    if username:
        try:
            update_user_app_version(username, current_version or "unknown")
        except Exception:
            pass  # never block the client over telemetry

    latest = fetch_latest_active_release()
    if not latest:
        return {
            "current_version": current_version,
            "latest_version": None,
            "needs_update": False,
            "release": None,
        }

    needs_update = is_newer(latest["version"], current_version or "0.0.0")

    return {
        "current_version": current_version,
        "latest_version": latest["version"],
        "needs_update": needs_update,
        "release": _serialize(latest),
    }


# ---------------------------------------------------------------------------
# Admin endpoints
# ---------------------------------------------------------------------------

def admin_list_releases(requesting_user_type: str) -> list[dict]:
    if requesting_user_type != "ADMIN":
        raise ReleaseError("Admin only", status_code=403)
    return [_serialize(r) for r in fetch_all_releases() if r]


def admin_create_release(payload: dict, requesting_username: str, requesting_user_type: str) -> dict:
    if requesting_user_type != "ADMIN":
        raise ReleaseError("Admin only", status_code=403)

    version = (payload.get("version") or "").strip().lstrip("v")
    download_url = (payload.get("download_url") or "").strip()
    if not version:
        raise ReleaseError("version is required")
    if not download_url:
        raise ReleaseError("download_url is required")

    record = insert_release({
        "version": version,
        "download_url": download_url,
        "release_notes_tr": payload.get("release_notes_tr") or "",
        "release_notes_en": payload.get("release_notes_en") or "",
        "is_mandatory": bool(payload.get("is_mandatory", False)),
        "min_version": (payload.get("min_version") or None) or None,
        "sha256": (payload.get("sha256") or None) or None,
        "published_by": requesting_username,
        "is_active": bool(payload.get("is_active", True)),
    })
    return _serialize(record)


def admin_update_release(release_id: int, payload: dict, requesting_user_type: str) -> dict:
    if requesting_user_type != "ADMIN":
        raise ReleaseError("Admin only", status_code=403)

    allowed: dict[str, Any] = {}
    for key in ("version", "download_url", "release_notes_tr", "release_notes_en",
                "is_mandatory", "min_version", "sha256", "is_active"):
        if key in payload:
            allowed[key] = payload[key]

    record = update_release(release_id, allowed)
    if record is None:
        raise ReleaseError("Release not found", status_code=404)
    return _serialize(record)


def admin_delete_release(release_id: int, requesting_user_type: str) -> dict:
    if requesting_user_type != "ADMIN":
        raise ReleaseError("Admin only", status_code=403)
    n = delete_release(release_id)
    return {"deleted": n}


def admin_version_distribution(requesting_user_type: str) -> dict:
    if requesting_user_type != "ADMIN":
        raise ReleaseError("Admin only", status_code=403)
    rows = fetch_version_distribution()
    return {"versions": [_serialize(r) for r in rows]}


def admin_users_on_version(version: str, requesting_user_type: str) -> dict:
    if requesting_user_type != "ADMIN":
        raise ReleaseError("Admin only", status_code=403)
    rows = fetch_users_by_version(version)
    return {"version": version, "users": [_serialize(r) for r in rows]}

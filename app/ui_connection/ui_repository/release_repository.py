"""
Release tracking — DB access for live.app_releases and per-user version tracking.
"""

from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_latest_active_release() -> dict | None:
    query = text("""
        SELECT id, version, download_url, release_notes_tr, release_notes_en,
               is_mandatory, min_version, sha256, published_at, published_by, is_active
        FROM live.app_releases
        WHERE is_active = TRUE
        ORDER BY published_at DESC
        LIMIT 1
    """)
    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query).mappings().first()
    return dict(row) if row else None


def fetch_all_releases() -> list[dict]:
    query = text("""
        SELECT id, version, download_url, release_notes_tr, release_notes_en,
               is_mandatory, min_version, sha256, published_at, published_by, is_active
        FROM live.app_releases
        ORDER BY published_at DESC
    """)
    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()
    return [dict(r) for r in rows]


def insert_release(payload: dict) -> dict:
    query = text("""
        INSERT INTO live.app_releases
            (version, download_url, release_notes_tr, release_notes_en,
             is_mandatory, min_version, sha256, published_by, is_active)
        VALUES
            (:version, :download_url, :release_notes_tr, :release_notes_en,
             :is_mandatory, :min_version, :sha256, :published_by, :is_active)
        RETURNING id, version, download_url, release_notes_tr, release_notes_en,
                  is_mandatory, min_version, sha256, published_at, published_by, is_active
    """)
    engine = get_ui_engine()
    with engine.begin() as conn:
        row = conn.execute(query, {
            "version": payload["version"],
            "download_url": payload["download_url"],
            "release_notes_tr": payload.get("release_notes_tr") or "",
            "release_notes_en": payload.get("release_notes_en") or "",
            "is_mandatory": bool(payload.get("is_mandatory", False)),
            "min_version": payload.get("min_version"),
            "sha256": payload.get("sha256"),
            "published_by": payload.get("published_by") or "",
            "is_active": bool(payload.get("is_active", True)),
        }).mappings().first()
    return dict(row) if row else {}


def update_release(release_id: int, payload: dict) -> dict | None:
    fields = []
    params: dict = {"release_id": release_id}
    for col in ("version", "download_url", "release_notes_tr", "release_notes_en",
                "is_mandatory", "min_version", "sha256", "is_active"):
        if col in payload:
            fields.append(f"{col} = :{col}")
            params[col] = payload[col]
    if not fields:
        return None
    query = text(f"""
        UPDATE live.app_releases
        SET {', '.join(fields)}
        WHERE id = :release_id
        RETURNING id, version, download_url, release_notes_tr, release_notes_en,
                  is_mandatory, min_version, sha256, published_at, published_by, is_active
    """)
    engine = get_ui_engine()
    with engine.begin() as conn:
        row = conn.execute(query, params).mappings().first()
    return dict(row) if row else None


def delete_release(release_id: int) -> int:
    query = text("DELETE FROM live.app_releases WHERE id = :release_id")
    engine = get_ui_engine()
    with engine.begin() as conn:
        result = conn.execute(query, {"release_id": release_id})
    return result.rowcount or 0


def update_user_app_version(username: str, version: str) -> None:
    query = text("""
        UPDATE "user"."REGISTERED_USER_DETAILS"
        SET "CURRENT_APP_VERSION" = :version,
            "LAST_VERSION_CHECK_AT" = NOW()
        WHERE "USERNAME" = :username
    """)
    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"version": version, "username": username})


def fetch_version_distribution() -> list[dict]:
    """Counts of users per app version, for the admin dashboard."""
    query = text("""
        SELECT
            COALESCE("CURRENT_APP_VERSION", 'unknown') AS version,
            COUNT(*) AS user_count,
            MAX("LAST_VERSION_CHECK_AT") AS last_seen
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE "IS_ACTIVE" = 'ACTIVE'
        GROUP BY "CURRENT_APP_VERSION"
        ORDER BY user_count DESC
    """)
    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()
    return [dict(r) for r in rows]


def fetch_users_by_version(version: str) -> list[dict]:
    query = text("""
        SELECT "USERNAME", "EMAIL", "CURRENT_APP_VERSION", "LAST_VERSION_CHECK_AT", "LAST_LOGIN_AT"
        FROM "user"."REGISTERED_USER_DETAILS"
        WHERE COALESCE("CURRENT_APP_VERSION", 'unknown') = :version
          AND "IS_ACTIVE" = 'ACTIVE'
        ORDER BY "LAST_VERSION_CHECK_AT" DESC NULLS LAST
    """)
    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"version": version}).mappings().all()
    return [dict(r) for r in rows]

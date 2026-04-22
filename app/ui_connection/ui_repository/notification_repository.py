from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_users_by_target(target_type: str, target_value: str | None = None) -> list[dict]:
    if target_type == "ALL_USERS":
        query = text("""
            SELECT
                "USERNAME",
                "EMAIL",
                "USER_TYPE",
                "COUNTRY"
            FROM "user"."REGISTERED_USER_DETAILS"
            WHERE "IS_ACTIVE" <> 'DEACTIVE'
            ORDER BY "USERNAME" ASC
        """)
        params = {}
    elif target_type == "ALL_CLIENTS":
        query = text("""
            SELECT
                "USERNAME",
                "EMAIL",
                "USER_TYPE",
                "COUNTRY"
            FROM "user"."REGISTERED_USER_DETAILS"
            WHERE "USER_TYPE" = 'CLIENT'
              AND "IS_ACTIVE" <> 'DEACTIVE'
            ORDER BY "USERNAME" ASC
        """)
        params = {}
    elif target_type == "EMAIL":
        query = text("""
            SELECT
                "USERNAME",
                "EMAIL",
                "USER_TYPE",
                "COUNTRY"
            FROM "user"."REGISTERED_USER_DETAILS"
            WHERE "EMAIL" = :target_value
              AND "IS_ACTIVE" <> 'DEACTIVE'
            ORDER BY "USERNAME" ASC
        """)
        params = {"target_value": target_value}
    elif target_type == "USERNAME":
        query = text("""
            SELECT
                "USERNAME",
                "EMAIL",
                "USER_TYPE",
                "COUNTRY"
            FROM "user"."REGISTERED_USER_DETAILS"
            WHERE "USERNAME" = :target_value
              AND "IS_ACTIVE" <> 'DEACTIVE'
            ORDER BY "USERNAME" ASC
        """)
        params = {"target_value": target_value}
    elif target_type == "COUNTRY":
        query = text("""
            SELECT
                "USERNAME",
                "EMAIL",
                "USER_TYPE",
                "COUNTRY"
            FROM "user"."REGISTERED_USER_DETAILS"
            WHERE "COUNTRY" = :target_value
              AND "IS_ACTIVE" <> 'DEACTIVE'
            ORDER BY "USERNAME" ASC
        """)
        params = {"target_value": target_value}
    elif target_type == "USER_TYPE":
        query = text("""
            SELECT
                "USERNAME",
                "EMAIL",
                "USER_TYPE",
                "COUNTRY"
            FROM "user"."REGISTERED_USER_DETAILS"
            WHERE "USER_TYPE" = :target_value
              AND "IS_ACTIVE" <> 'DEACTIVE'
            ORDER BY "USERNAME" ASC
        """)
        params = {"target_value": target_value}
    else:
        raise ValueError(f"Unsupported target_type: {target_type}")

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, params).mappings().all()
    return [dict(row) for row in rows]


def create_notification(
    title: str,
    message: str,
    attachment_name: str | None,
    attachment_path: str | None,
    created_by: str,
    targets: list[dict],
    users: list[dict],
) -> int:
    insert_notification_query = text("""
        INSERT INTO "user".notifications (
            title,
            message,
            attachment_name,
            attachment_path,
            created_by,
            created_at,
            is_active
        )
        VALUES (
            :title,
            :message,
            :attachment_name,
            :attachment_path,
            :created_by,
            NOW(),
            'active'
        )
        RETURNING id
    """)

    insert_target_query = text("""
        INSERT INTO "user".notification_targets (
            notification_id,
            target_type,
            target_value
        )
        VALUES (
            :notification_id,
            :target_type,
            :target_value
        )
    """)

    insert_user_notification_query = text("""
        INSERT INTO "user".user_notifications (
            notification_id,
            username,
            email,
            status,
            is_popup_pending,
            delivered_at
        )
        VALUES (
            :notification_id,
            :username,
            :email,
            'UNREAD',
            TRUE,
            NOW()
        )
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        notification_id = conn.execute(
            insert_notification_query,
            {
                "title": title,
                "message": message,
                "attachment_name": attachment_name,
                "attachment_path": attachment_path,
                "created_by": created_by,
            },
        ).scalar_one()

        for target in targets:
            conn.execute(
                insert_target_query,
                {
                    "notification_id": notification_id,
                    "target_type": target["target_type"],
                    "target_value": target.get("target_value"),
                },
            )

        for user in users:
            conn.execute(
                insert_user_notification_query,
                {
                    "notification_id": notification_id,
                    "username": user["USERNAME"],
                    "email": user.get("EMAIL"),
                },
            )

    return int(notification_id)


def fetch_admin_notifications() -> list[dict]:
    query = text("""
        SELECT
            n.id,
            n.title,
            n.message,
            n.attachment_name,
            n.created_by,
            n.created_at,
            COUNT(un1.id) AS recipient_count,
            SUM(CASE WHEN un1.status = 'UNREAD' THEN 1 ELSE 0 END) AS unread_count,
            STRING_AGG(
                CASE
                    WHEN nt.target_type = 'ALL_CLIENTS' THEN 'ALL_CLIENTS'
                    WHEN nt.target_type = 'ALL_USERS' THEN 'ALL_USERS'
                    WHEN nt.target_type = 'EMAIL' THEN 'EMAIL'
                    WHEN nt.target_type = 'USERNAME' THEN 'USERNAME'
                    WHEN nt.target_type = 'COUNTRY' THEN 'COUNTRY:' || COALESCE(nt.target_value, '')
                    WHEN nt.target_type = 'USER_TYPE' THEN 'TYPE:' || COALESCE(nt.target_value, '')
                    ELSE nt.target_type
                END,
                ', '
            ) AS target_summary
        FROM "user".notifications n
        LEFT JOIN "user".user_notifications un1
            ON un1.notification_id = n.id
        LEFT JOIN "user".notification_targets nt
            ON nt.notification_id = n.id
        WHERE n.is_active = 'active'
        GROUP BY n.id, n.title, n.message, n.attachment_name, n.created_by, n.created_at
        ORDER BY n.created_at DESC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()

    return [dict(row) for row in rows]


def fetch_user_notifications(username: str) -> list[dict]:
    query = text("""
        SELECT
            un1.id AS user_notification_id,
            un1.notification_id,
            un1.username,
            un1.email,
            un1.status,
            un1.is_popup_pending,
            un1.delivered_at,
            un1.read_at,
            un1.dismissed_at,
            un1.deleted_at,
            n.title,
            n.message,
            n.attachment_name,
            n.attachment_path,
            n.created_by,
            n.created_at
        FROM "user".user_notifications un1
        JOIN "user".notifications n
            ON n.id = un1.notification_id
        WHERE un1.username = :username
          AND (un1.status <> 'DELETED')
          AND n.is_active = 'active'
        ORDER BY n.created_at DESC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"username": username}).mappings().all()

    return [dict(row) for row in rows]


def fetch_unread_count(username: str) -> int:
    query = text("""
        SELECT COUNT(*) AS unread_count
        FROM "user".user_notifications
        WHERE username = :username
          AND status = 'UNREAD'
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        count = conn.execute(query, {"username": username}).scalar_one()

    return int(count or 0)


def fetch_pending_popup(username: str) -> dict | None:
    query = text("""
        SELECT
            un1.id AS user_notification_id,
            un1.notification_id,
            un1.username,
            un1.email,
            un1.status,
            un1.is_popup_pending,
            un1.delivered_at,
            n.title,
            n.message,
            n.attachment_name,
            n.attachment_path,
            n.created_by,
            n.created_at
        FROM "user".user_notifications un1
        JOIN "user".notifications n
            ON n.id = un1.notification_id
        WHERE un1.username = :username
          AND un1.status = 'UNREAD'
          AND un1.is_popup_pending = TRUE
          AND n.is_active = 'active'
        ORDER BY n.created_at DESC
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query, {"username": username}).mappings().first()

    return dict(row) if row else None


def dismiss_popup(user_notification_id: int) -> None:
    query = text("""
        UPDATE "user".user_notifications
        SET
            is_popup_pending = FALSE,
            dismissed_at = NOW()
        WHERE id = :user_notification_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"user_notification_id": user_notification_id})


def mark_notification_as_read(user_notification_id: int) -> None:
    query = text("""
        UPDATE "user".user_notifications
        SET
            status = 'READ',
            is_popup_pending = FALSE,
            read_at = NOW()
        WHERE id = :user_notification_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"user_notification_id": user_notification_id})


def mark_notification_as_unread(user_notification_id: int) -> None:
    query = text("""
        UPDATE "user".user_notifications
        SET
            status = 'UNREAD',
            read_at = NULL
        WHERE id = :user_notification_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"user_notification_id": user_notification_id})


def delete_user_notification(user_notification_id: int) -> None:
    query = text("""
        UPDATE "user".user_notifications
        SET
            status = 'DELETED',
            deleted_at = NOW(),
            is_popup_pending = FALSE
        WHERE id = :user_notification_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"user_notification_id": user_notification_id})

def fetch_admin_notification_detail(notification_id: int) -> dict | None:
    query = text("""
        SELECT
            n.id,
            n.title,
            n.message,
            n.attachment_name,
            n.attachment_path,
            n.created_by,
            n.created_at
        FROM "user".notifications n
        WHERE n.id = :notification_id
          AND n.is_active = 'active'
        LIMIT 1
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
      row = conn.execute(query, {"notification_id": notification_id}).mappings().first()

    return dict(row) if row else None


def fetch_admin_notification_targets(notification_id: int) -> list[dict]:
    query = text("""
        SELECT
            target_type,
            target_value
        FROM "user".notification_targets
        WHERE notification_id = :notification_id
        ORDER BY id ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"notification_id": notification_id}).mappings().all()

    return [dict(row) for row in rows]


def fetch_admin_notification_recipients(notification_id: int) -> list[dict]:
    query = text("""
        SELECT
            username,
            email,
            status,
            delivered_at,
            read_at
        FROM "user".user_notifications
        WHERE notification_id = :notification_id
          AND status <> 'DELETED'
        ORDER BY username ASC
    """)

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, {"notification_id": notification_id}).mappings().all()

    return [dict(row) for row in rows]

def delete_notification(notification_id: int) -> None:
    query = text("""
        UPDATE "user".notifications
        SET is_active = 'deleted'
        WHERE id = :notification_id
    """)

    engine = get_ui_engine()
    with engine.begin() as conn:
        conn.execute(query, {"notification_id": notification_id})
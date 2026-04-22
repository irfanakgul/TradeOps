from __future__ import annotations

from collections import OrderedDict

from ui_connection.ui_repository.notification_repository import (
    create_notification,
    delete_user_notification,
    dismiss_popup,
    fetch_admin_notification_detail,
    fetch_admin_notification_recipients,
    fetch_admin_notification_targets,
    fetch_admin_notifications,
    fetch_pending_popup,
    fetch_unread_count,
    fetch_user_notifications,
    fetch_users_by_target,
    mark_notification_as_read,
    mark_notification_as_unread,
)


class NotificationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _dedupe_users(users: list[dict]) -> list[dict]:
    seen = OrderedDict()
    for user in users:
        key = user["USERNAME"]
        if key not in seen:
            seen[key] = user
    return list(seen.values())


def send_notification(payload: dict) -> dict:
    title = (payload.get("title") or "").strip()
    message = (payload.get("message") or "").strip()
    created_by = (payload.get("created_by") or "").strip()
    targets = payload.get("targets") or []
    attachment_name = payload.get("attachment_name")
    attachment_path = payload.get("attachment_path")

    if not title:
        raise NotificationError("Title is required.", 400)

    if not message:
        raise NotificationError("Message is required.", 400)

    if not created_by:
        raise NotificationError("created_by is required.", 400)

    if not targets:
        raise NotificationError("At least one target is required.", 400)

    collected_users: list[dict] = []
    normalized_targets: list[dict] = []

    for target in targets:
        target_type = (target.get("target_type") or "").strip().upper()
        target_value = target.get("target_value")
        if isinstance(target_value, str):
            target_value = target_value.strip()

        users = fetch_users_by_target(target_type, target_value)
        normalized_targets.append(
            {
                "target_type": target_type,
                "target_value": target_value,
            }
        )
        collected_users.extend(users)

    users = _dedupe_users(collected_users)

    if not users:
        raise NotificationError("No target users found.", 400)

    notification_id = create_notification(
        title=title,
        message=message,
        attachment_name=attachment_name,
        attachment_path=attachment_path,
        created_by=created_by,
        targets=normalized_targets,
        users=users,
    )

    return {
        "success": True,
        "notification_id": notification_id,
        "recipient_count": len(users),
        "message": "Notification sent successfully.",
    }


def get_admin_notifications() -> dict:
    return {
        "rows": fetch_admin_notifications(),
    }


def get_user_notifications(username: str) -> dict:
    return {
        "rows": fetch_user_notifications(username),
        "unread_count": fetch_unread_count(username),
    }


def get_user_notification_badge(username: str) -> dict:
    return {
        "unread_count": fetch_unread_count(username),
    }


def get_pending_popup(username: str) -> dict:
    return {
        "notification": fetch_pending_popup(username),
    }


def dismiss_user_popup(user_notification_id: int) -> dict:
    dismiss_popup(user_notification_id)
    return {"success": True}


def read_user_notification(user_notification_id: int) -> dict:
    mark_notification_as_read(user_notification_id)
    return {"success": True}


def unread_user_notification(user_notification_id: int) -> dict:
    mark_notification_as_unread(user_notification_id)
    return {"success": True}


def delete_notification_for_user(user_notification_id: int) -> dict:
    delete_user_notification(user_notification_id)
    return {"success": True}

def get_admin_notification_detail(notification_id: int) -> dict:
    detail = fetch_admin_notification_detail(notification_id)
    if not detail:
        raise NotificationError("Notification not found.", 404)

    targets = fetch_admin_notification_targets(notification_id)
    recipients = fetch_admin_notification_recipients(notification_id)

    return {
        "detail": detail,
        "targets": targets,
        "recipients": recipients,
    }

def delete_admin_notification(notification_id: int) -> dict:
    delete_notification(notification_id)
    return {"success": True}
from __future__ import annotations

from ui_connection.ui_repository.ui_users_repository import fetch_all_registered_usernames


class UIUsersError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def get_visible_usernames(requesting_username: str, requesting_user_type: str) -> dict:
    safe_username = (requesting_username or "").strip()
    safe_user_type = (requesting_user_type or "").strip().upper()

    if not safe_username:
        raise UIUsersError("Requesting username is required.", 400)

    if safe_user_type == "ADMIN":
        users = fetch_all_registered_usernames()

        if safe_username not in users:
            users = [safe_username] + users

        return {
            "users": users,
            "selected_username": safe_username,
            "can_select_all": True,
        }

    return {
        "users": [safe_username],
        "selected_username": safe_username,
        "can_select_all": False,
    }


def resolve_effective_username(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None,
) -> str:
    safe_requesting_username = (requesting_username or "").strip()
    safe_user_type = (requesting_user_type or "").strip().upper()
    safe_selected_username = (selected_username or "").strip()

    if not safe_requesting_username:
        raise UIUsersError("Requesting username is required.", 400)

    if safe_user_type == "ADMIN":
        return safe_selected_username or safe_requesting_username

    return safe_requesting_username
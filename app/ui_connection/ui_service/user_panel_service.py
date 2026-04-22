from __future__ import annotations

import base64
import hashlib
import os

from ui_connection.ui_repository.user_panel_repository import (
    delete_registered_user,
    email_exists,
    get_registered_user_by_username,
    mark_user_related_trade_tables_deleted,
    update_registered_user_profile,
    username_exists,
)
from ui_connection.ui_repository.trade_config_repository import insert_trade_config_log
from service.email_service import send_email, build_bilingual_body


class UserPanelError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


MAIL_TEXTS = {
    "profile_update_summary_en": (
        "Hello {username},\n\n"
        "Your TradeOPS profile information has been updated.\n\n"
        "Changed fields:\n"
        "{changes}\n\n"
        "If you did not make this change, please reply to this email and inform us immediately."
    ),
    "profile_update_summary_tr": (
        "Merhaba {username},\n\n"
        "TradeOPS profil bilgileriniz güncellendi.\n\n"
        "Değişen alanlar:\n"
        "{changes}\n\n"
        "Bu değişikliği siz yapmadıysanız lütfen bu e-postayı yanıtlayarak hemen bize bilgi verin."
    ),
    "old_email_changed_notice_en": (
        "Hello {username},\n\n"
        "Your TradeOPS login email address has been changed.\n\n"
        "Old email: {old_email}\n"
        "New email: {new_email}\n\n"
        "You must now use your new email address to log in.\n\n"
        "If you did not make this change, please reply to this email and inform us immediately."
    ),
    "old_email_changed_notice_tr": (
        "Merhaba {username},\n\n"
        "TradeOPS giriş e-posta adresiniz değiştirildi.\n\n"
        "Eski e-posta: {old_email}\n"
        "Yeni e-posta: {new_email}\n\n"
        "Bundan sonra giriş yapmak için yeni e-posta adresinizi kullanmanız gerekmektedir.\n\n"
        "Bu değişikliği siz yapmadıysanız lütfen bu e-postayı yanıtlayarak hemen bize bilgi verin."
    ),
}


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = 120000
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return (
        "pbkdf2_sha256"
        f"${iterations}"
        f"${base64.b64encode(salt).decode('utf-8')}"
        f"${base64.b64encode(derived_key).decode('utf-8')}"
    )


def _verify_password(stored_hash: str, password: str) -> bool:
    try:
        algorithm, iterations_str, salt_b64, hash_b64 = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False

        iterations = int(iterations_str)
        salt = base64.b64decode(salt_b64.encode("utf-8"))
        expected_hash = base64.b64decode(hash_b64.encode("utf-8"))

        derived_key = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            iterations,
        )

        return derived_key == expected_hash
    except Exception:
        return False


def _build_change_lines_en(changes: list[tuple[str, str, str]]) -> str:
    return "\n".join([f"- {label}: {old} -> {new}" for label, old, new in changes])


def _build_change_lines_tr(changes: list[tuple[str, str, str]]) -> str:
    return "\n".join([f"- {label}: {old} -> {new}" for label, old, new in changes])


def get_user_panel_data(username: str) -> dict:
    user = get_registered_user_by_username(username)
    if not user:
        raise UserPanelError("User not found.", 404)

    return {
        "username": user["USERNAME"],
        "email": user["EMAIL"],
        "first_name": user["FIRST_NAME"],
        "last_name": user["LAST_NAME"],
        "date_of_birth": (
            user["DATE_OF_BIRTH"].isoformat() if user["DATE_OF_BIRTH"] else None
        ),
        "mobile_phone": user["MOBILE_PHONE"],
        "app_lock_password": user["APP_LOCK_PASSWORD"] or "",
        "user_type": user["USER_TYPE"],
    }


def update_user_panel_data(username: str, payload: dict) -> dict:
    user = get_registered_user_by_username(username)
    if not user:
        raise UserPanelError("User not found.", 404)

    new_username = (payload.get("username") or "").strip()
    new_email = (payload.get("email") or "").strip().lower()
    new_first_name = (payload.get("first_name") or "").strip()
    new_last_name = (payload.get("last_name") or "").strip()
    new_date_of_birth = payload.get("date_of_birth")
    new_mobile_phone = (payload.get("mobile_phone") or "").strip()
    new_password = payload.get("password") or ""
    new_password_repeat = payload.get("password_repeat") or ""
    new_app_lock_password = (payload.get("app_lock_password") or "").strip()

    if not new_username:
        raise UserPanelError("Username is required.", 400)
    if not new_email:
        raise UserPanelError("Email is required.", 400)
    if not new_first_name:
        raise UserPanelError("First name is required.", 400)
    if not new_last_name:
        raise UserPanelError("Last name is required.", 400)
    if not new_date_of_birth:
        raise UserPanelError("Date of birth is required.", 400)
    if not new_mobile_phone:
        raise UserPanelError("Mobile phone is required.", 400)

    if username_exists(new_username, exclude_user_id=user["ID"]):
        raise UserPanelError("Username already exists.", 409)

    if email_exists(new_email, exclude_user_id=user["ID"]):
        raise UserPanelError("Email already exists.", 409)

    password_hash = None
    if new_password or new_password_repeat:
        if new_password != new_password_repeat:
            raise UserPanelError("Passwords do not match.", 400)
        if len(new_password) < 8:
            raise UserPanelError("Password must be at least 8 characters.", 400)
        password_hash = _hash_password(new_password)

    app_lock_password = None
    if new_app_lock_password:
        if not new_app_lock_password.isdigit() or len(new_app_lock_password) != 4:
            raise UserPanelError("App lock password must be 4-digit numeric.", 400)
        app_lock_password = new_app_lock_password

    old_email = user["EMAIL"]
    old_username = user["USERNAME"]

    old_values = {
        "USERNAME": user["USERNAME"],
        "EMAIL": user["EMAIL"],
        "FIRST_NAME": user["FIRST_NAME"],
        "LAST_NAME": user["LAST_NAME"],
        "DATE_OF_BIRTH": user["DATE_OF_BIRTH"].isoformat() if user["DATE_OF_BIRTH"] else "",
        "MOBILE_PHONE": user["MOBILE_PHONE"],
        "APP_LOCK_PASSWORD": user["APP_LOCK_PASSWORD"] or "",
    }

    update_registered_user_profile(
        user_id=user["ID"],
        username=new_username,
        email=new_email,
        first_name=new_first_name,
        last_name=new_last_name,
        date_of_birth=new_date_of_birth,
        mobile_phone=new_mobile_phone,
        password_hash=password_hash,
        app_lock_password=app_lock_password,
    )

    new_values = {
        "USERNAME": new_username,
        "EMAIL": new_email,
        "FIRST_NAME": new_first_name,
        "LAST_NAME": new_last_name,
        "DATE_OF_BIRTH": new_date_of_birth,
        "MOBILE_PHONE": new_mobile_phone,
        "APP_LOCK_PASSWORD": app_lock_password if app_lock_password is not None else old_values["APP_LOCK_PASSWORD"],
    }

    changed_fields_for_mail: list[tuple[str, str, str]] = []

    label_map_en = {
        "USERNAME": "Username",
        "EMAIL": "Email",
        "FIRST_NAME": "First Name",
        "LAST_NAME": "Last Name",
        "DATE_OF_BIRTH": "Date of Birth",
        "MOBILE_PHONE": "Mobile Phone",
        "APP_LOCK_PASSWORD": "App Lock Password",
        "PASSWORD_HASH": "Password",
    }

    label_map_tr = {
        "USERNAME": "Kullanıcı Adı",
        "EMAIL": "E-posta",
        "FIRST_NAME": "Ad",
        "LAST_NAME": "Soyad",
        "DATE_OF_BIRTH": "Doğum Tarihi",
        "MOBILE_PHONE": "Telefon",
        "APP_LOCK_PASSWORD": "App Lock Şifresi",
        "PASSWORD_HASH": "Şifre",
    }

    for key, old_value in old_values.items():
        new_value = new_values[key]
        if str(old_value) != str(new_value):
            insert_trade_config_log(
                username=new_username,
                file_group="user_panel",
                parameter_key=key,
                exchange_code=None,
                old_value=str(old_value),
                new_value=str(new_value),
                change_source="USER_PROFILE_EDIT",
            )

            safe_old = "****" if key == "APP_LOCK_PASSWORD" else str(old_value)
            safe_new = "****" if key == "APP_LOCK_PASSWORD" else str(new_value)

            changed_fields_for_mail.append(
                (
                    f"{label_map_en[key]} / {label_map_tr[key]}",
                    safe_old,
                    safe_new,
                )
            )

    if password_hash:
        insert_trade_config_log(
            username=new_username,
            file_group="user_panel",
            parameter_key="PASSWORD_HASH",
            exchange_code=None,
            old_value="(hidden)",
            new_value="(updated)",
            change_source="USER_PROFILE_EDIT",
        )
        changed_fields_for_mail.append(
            ("Password / Şifre", "********", "********")
        )

    if changed_fields_for_mail:
        send_email(
            to_email=new_email,
            subject="TradeOPS Profile Update Notification",
            title="Profile Information Updated",
            body=build_bilingual_body(
                english_text=MAIL_TEXTS["profile_update_summary_en"].format(
                    username=new_username,
                    changes=_build_change_lines_en(changed_fields_for_mail),
                ),
                turkish_text=MAIL_TEXTS["profile_update_summary_tr"].format(
                    username=new_username,
                    changes=_build_change_lines_tr(changed_fields_for_mail),
                ),
            ),
        )

    if old_email != new_email:
        send_email(
            to_email=old_email,
            subject="TradeOPS Email Change Notice",
            title="Your Login Email Was Changed",
            body=build_bilingual_body(
                english_text=MAIL_TEXTS["old_email_changed_notice_en"].format(
                    username=new_username,
                    old_email=old_email,
                    new_email=new_email,
                ),
                turkish_text=MAIL_TEXTS["old_email_changed_notice_tr"].format(
                    username=new_username,
                    old_email=old_email,
                    new_email=new_email,
                ),
            ),
        )

    return {
        "success": True,
        "message": "User profile updated successfully.",
        "user": get_user_panel_data(new_username),
    }


def verify_app_lock_password(username: str, password: str) -> bool:
    user = get_registered_user_by_username(username)

    print("[LOCK DEBUG] username from request:", repr(username))
    print("[LOCK DEBUG] password from request:", repr(password))

    if not user:
        print("[LOCK DEBUG] user not found")
        return False

    stored = (user["APP_LOCK_PASSWORD"] or "").strip()

    print("[LOCK DEBUG] db row username:", repr(user["USERNAME"]))
    print("[LOCK DEBUG] db app lock password:", repr(stored))
    print("[LOCK DEBUG] compare result:", stored == password.strip())

    return stored == password.strip()


def delete_user_account(username: str, password: str) -> dict:
    user = get_registered_user_by_username(username)
    if not user:
        raise UserPanelError("User not found.", 404)

    if not _verify_password(user["PASSWORD_HASH"], password):
        raise UserPanelError("Password is incorrect.", 401)

    insert_trade_config_log(
        username=username,
        file_group="user_panel",
        parameter_key="ACCOUNT_DELETE",
        exchange_code=None,
        old_value="active",
        new_value="deleted",
        change_source="USER_SELF_DELETE",
    )

    mark_user_related_trade_tables_deleted(username)
    delete_registered_user(user["ID"])

    return {
        "success": True,
        "message": "User account deleted successfully.",
    }
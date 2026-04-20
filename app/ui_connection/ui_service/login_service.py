from __future__ import annotations

import base64
import hashlib
from datetime import datetime
from service.email_service import send_email, build_bilingual_body
from config.device import get_runtime_device_id
from ui_connection.ui_repository.login_repository import (
    deactivate_user,
    get_user_by_email,
    increment_failed_login_count,
    insert_login_log,
    reset_failed_login_count,
    update_last_login,
)

MESSAGES = {
    "tr": {
        "email_required": "E-posta zorunludur.",
        "password_required": "Şifre zorunludur.",
        "agreement_required": "Giriş için sorumluluk sözleşmesini onaylamanız gerekir.",
        "invalid_credentials": "E-posta veya şifre hatalı.",
        "last_chance": "Son şansınız. Bir sonraki hatalı girişte hesabınız pasif hale getirilecektir.",
        "device_mismatch": "Cihazınızın değiştiğini tespit ettik. Lütfen iletişim formunu doldurun.",
        "inactive_new_user": "Hesabınız henüz onaylanmamış.",
        "inactive_deactive": "Hesabınız pasif duruma alınmıştır.",
        "login_success": "Giriş başarılı.",
        "login_mail_subject": "TradeOPS Giriş Bildirimi",
        "login_mail_title": "Hesabınıza Giriş Yapıldı",
        "login_mail_body": (
            "Merhaba {username},\n\n"
            "TradeOPS hesabınıza giriş yapıldı.\n\n"
            "Tarih/Saat: {event_time}\n"
            "Device ID: {device_id}\n\n"
            "Eğer bu giriş size ait değilse lütfen bu e-postayı yanıtlayarak bize bilgi verin."
        )
    },
    "en": {
        "email_required": "Email is required.",
        "password_required": "Password is required.",
        "agreement_required": "You must approve the responsibility agreement to continue.",
        "invalid_credentials": "Email or password is incorrect.",
        "last_chance": "This is your last chance. One more incorrect attempt will deactivate your account.",
        "device_mismatch": "We detected that your device has changed. Please complete the contact form.",
        "inactive_new_user": "Your account has not been approved yet.",
        "inactive_deactive": "Your account has been deactivated.",
        "login_success": "Login successful.",
        "login_mail_subject": "TradeOPS Login Notification",
        "login_mail_title": "A Login Was Detected on Your Account",
        "login_mail_body": (
            "Hello {username},\n\n"
            "A login to your TradeOPS account was detected.\n\n"
            "Date/Time: {event_time}\n"
            "Device ID: {device_id}\n\n"
            "If this login was not made by you, please reply to this email and let us know."
        )
    },
}

MAIL_TEXTS = {
    "login_notice_en": (
        "Hello {username},\n\n"
        "A login to your TradeOPS account was detected.\n\n"
        "Date/Time: {event_time}\n"
        "Device ID: {device_id}\n\n"
        "If this login was not made by you, please reply to this email and let us know."
    ),
    "login_notice_tr": (
        "Merhaba {username},\n\n"
        "TradeOPS hesabınıza giriş yapıldı.\n\n"
        "Tarih/Saat: {event_time}\n"
        "Device ID: {device_id}\n\n"
        "Eğer bu giriş size ait değilse lütfen bu e-postayı yanıtlayarak bize bilgi verin."
    ),
}


class LoginError(Exception):
    def __init__(
        self,
        message: str,
        field: str | None = None,
        status_code: int = 400,
        redirect_to: str | None = None,
        warning: str | None = None,
    ):
        super().__init__(message)
        self.message = message
        self.field = field
        self.status_code = status_code
        self.redirect_to = redirect_to
        self.warning = warning


def msg(lang: str, key: str) -> str:
    safe_lang = "tr" if lang == "tr" else "en"
    return MESSAGES[safe_lang][key]


def verify_password(stored_hash: str, password: str) -> bool:
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


def login_user(payload: dict) -> dict:
    lang = "tr" if payload.get("language") == "tr" else "en"

    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    responsibility_approved = bool(payload.get("responsibilityApproved"))

    if not email:
        raise LoginError(msg(lang, "email_required"), "email")

    if not password:
        raise LoginError(msg(lang, "password_required"), "password")

    if not responsibility_approved:
        raise LoginError(msg(lang, "agreement_required"), "responsibilityApproved")

    user = get_user_by_email(email)

    current_device_id = get_runtime_device_id()

    if not user:
        insert_login_log(
            username=None,
            email=email,
            device_id=current_device_id,
            event_type="LOGIN_FAILED",
            success=False,
            failure_reason="INVALID_EMAIL_OR_PASSWORD",
            responsibility_approved=responsibility_approved,
        )
        raise LoginError(msg(lang, "invalid_credentials"), "password", status_code=401)

    username = user["USERNAME"]
    registered_device_id = user["DEVICE_ID"]
    user_id = user["ID"]
    is_active = user["IS_ACTIVE"]

    if is_active == "NEW_USER":
        insert_login_log(
            username=username,
            email=email,
            device_id=current_device_id,
            event_type="LOGIN_FAILED",
            success=False,
            failure_reason="ACCOUNT_NOT_APPROVED",
            responsibility_approved=responsibility_approved,
        )
        raise LoginError(msg(lang, "inactive_new_user"), status_code=403)

    if is_active == "DEACTIVE":
        insert_login_log(
            username=username,
            email=email,
            device_id=current_device_id,
            event_type="LOGIN_FAILED",
            success=False,
            failure_reason="ACCOUNT_DEACTIVE",
            responsibility_approved=responsibility_approved,
        )
        raise LoginError(msg(lang, "inactive_deactive"), status_code=403)

    if registered_device_id != current_device_id:
        deactivate_user(user_id, "DEVICE_ID_MISMATCHED")

        insert_login_log(
            username=username,
            email=email,
            device_id=current_device_id,
            event_type="LOGIN_DEVICE_MISMATCH",
            success=False,
            failure_reason="DEVICE_ID_MISMATCHED",
            responsibility_approved=responsibility_approved,
        )

        raise LoginError(
            msg(lang, "device_mismatch"),
            status_code=403,
            redirect_to="/contact",
        )

    if not verify_password(user["PASSWORD_HASH"], password):
        failed_count = increment_failed_login_count(user_id)

        if failed_count >= 5:
            deactivate_user(user_id, "MULTIPLE_INCORRECT_ENTRY")

            insert_login_log(
                username=username,
                email=email,
                device_id=current_device_id,
                event_type="LOGIN_FAILED",
                success=False,
                failure_reason="MULTIPLE_INCORRECT_ENTRY",
                responsibility_approved=responsibility_approved,
            )

            raise LoginError(msg(lang, "inactive_deactive"), status_code=403)

        warning = msg(lang, "last_chance") if failed_count == 4 else None

        insert_login_log(
            username=username,
            email=email,
            device_id=current_device_id,
            event_type="LOGIN_FAILED",
            success=False,
            failure_reason="INVALID_EMAIL_OR_PASSWORD",
            responsibility_approved=responsibility_approved,
        )

        raise LoginError(
            msg(lang, "invalid_credentials"),
            field="password",
            status_code=401,
            warning=warning,
        )

    reset_failed_login_count(user_id)
    update_last_login(user_id)

    insert_login_log(
        username=username,
        email=email,
        device_id=current_device_id,
        event_type="LOGIN_SUCCESS",
        success=True,
        failure_reason=None,
        responsibility_approved=responsibility_approved,
    )
    event_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    send_email(
        to_email=email,
        subject=msg(lang, "login_mail_subject"),
        title=msg(lang, "login_mail_title"),
        body=build_bilingual_body(
            english_text=MAIL_TEXTS["login_notice_en"].format(
                username=username,
                event_time=event_time,
                device_id=current_device_id,
            ),
            turkish_text=MAIL_TEXTS["login_notice_tr"].format(
                username=username,
                event_time=event_time,
                device_id=current_device_id,
            ),
        ),
    )

    return {
        "success": True,
        "message": msg(lang, "login_success"),
        "user": {
            "username": username,
            "email": email,
            "device_id": current_device_id,
            "user_type": user["USER_TYPE"],
        },
    }
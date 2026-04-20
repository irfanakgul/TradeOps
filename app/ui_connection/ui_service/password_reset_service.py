from __future__ import annotations

import base64
import hashlib
import os
import re
import secrets
from datetime import datetime, timedelta
from service.email_service import send_email, build_bilingual_body

from ui_connection.ui_repository.login_repository import insert_login_log
from ui_connection.ui_repository.password_reset_repository import (
    get_user_by_reset_token,
    get_user_for_password_reset,
    save_password_reset_token,
    update_password_and_clear_reset,
)

PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$")


MESSAGES = {
    "tr": {
        "email_required": "E-posta zorunludur.",
        "email_not_found": "Bu e-posta ile kayıtlı kullanıcı bulunamadı.",
        "reset_request_success": "Şifre sıfırlama maili gönderildi.",
        "reset_mail_subject": "TradeOPS Şifre Sıfırlama",
        "reset_mail_title": "Şifre Sıfırlama Talebi",
        "reset_mail_body": (
            "Merhaba {username},\n\n"
            "TradeOPS hesabınız için bir şifre sıfırlama talebi alındı.\n\n"
            "Aşağıdaki bağlantıyı kullanarak yeni şifre belirleyebilirsiniz.\n\n"
            "Bu talep size ait değilse bu e-postayı dikkate almayın."
        ),
        "token_required": "Reset token zorunludur.",
        "password_required": "Yeni şifre zorunludur.",
        "password_match": "Şifre alanları aynı olmalıdır.",
        "password_rule": "Şifre en az 6 karakter olmalı ve büyük harf, küçük harf, sayı içermelidir.",
        "invalid_or_expired_token": "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş.",
        "reset_success": "Şifreniz başarıyla güncellendi.",
    },
    "en": {
        "email_required": "Email is required.",
        "email_not_found": "No registered user found for this email.",
        "reset_request_success": "Password reset email has been sent.",
        "reset_mail_subject": "TradeOPS Password Reset",
        "reset_mail_title": "Password Reset Request",
        "reset_mail_body": (
            "Hello {username},\n\n"
            "A password reset request was received for your TradeOPS account.\n\n"
            "Use the link below to set a new password.\n\n"
            "If this request was not made by you, please ignore this email."
        ),
        "token_required": "Reset token is required.",
        "password_required": "New password is required.",
        "password_match": "Password fields must match.",
        "password_rule": "Password must contain uppercase, lowercase, number and be at least 6 characters.",
        "invalid_or_expired_token": "Password reset link is invalid or expired.",
        "reset_success": "Your password has been updated successfully.",
    },
}

MAIL_TEXTS = {
    "reset_request_en": (
        "Hello {username},\n\n"
        "A password reset request was received for your TradeOPS account.\n\n"
        "Use the link below to set a new password.\n\n"
        "If this request was not made by you, please ignore this email."
    ),
    "reset_request_tr": (
        "Merhaba {username},\n\n"
        "TradeOPS hesabınız için bir şifre sıfırlama talebi alındı.\n\n"
        "Aşağıdaki bağlantıyı kullanarak yeni şifre belirleyebilirsiniz.\n\n"
        "Bu talep size ait değilse bu e-postayı dikkate almayın."
    ),
}

class PasswordResetError(Exception):
    def __init__(self, message: str, field: str | None = None, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.field = field
        self.status_code = status_code


def msg(lang: str, key: str) -> str:
    safe_lang = "tr" if lang == "tr" else "en"
    return MESSAGES[safe_lang][key]


def _hash_password(password: str) -> str:
    salt = os.urandom(16)
    iterations = 200_000
    derived_key = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        iterations,
    )
    salt_b64 = base64.b64encode(salt).decode("utf-8")
    hash_b64 = base64.b64encode(derived_key).decode("utf-8")
    return f"pbkdf2_sha256${iterations}${salt_b64}${hash_b64}"


def request_password_reset(payload: dict) -> dict:
    lang = "tr" if payload.get("language") == "tr" else "en"
    email = (payload.get("email") or "").strip().lower()

    if not email:
        raise PasswordResetError(msg(lang, "email_required"), "email")

    user = get_user_for_password_reset(email)
    if not user:
        raise PasswordResetError(msg(lang, "email_not_found"), "email", status_code=404)

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(minutes=30)
    save_password_reset_token(user["ID"], token, expires_at)

    reset_link = f"http://localhost:5173/reset-password?token={token}"

    send_email(
        to_email=email,
        subject=msg(lang, "reset_mail_subject"),
        title=msg(lang, "reset_mail_title"),
        body=build_bilingual_body(
            english_text=MAIL_TEXTS["reset_request_en"].format(
                username=user["USERNAME"]
            ),
            turkish_text=MAIL_TEXTS["reset_request_tr"].format(
                username=user["USERNAME"]
            ),
        ),
        action_link=reset_link,
    )

    insert_login_log(
        username=user["USERNAME"],
        email=email,
        device_id=user["DEVICE_ID"],
        event_type="PASSWORD_RESET_REQUEST",
        success=True,
        failure_reason=None,
        responsibility_approved=None,
    )

    return {
        "success": True,
        "message": msg(lang, "reset_request_success"),
    }


def confirm_password_reset(payload: dict) -> dict:
    lang = "tr" if payload.get("language") == "tr" else "en"
    token = (payload.get("token") or "").strip()
    password = payload.get("password") or ""
    password_repeat = payload.get("passwordRepeat") or ""

    if not token:
        raise PasswordResetError(msg(lang, "token_required"), "token")

    if not password:
        raise PasswordResetError(msg(lang, "password_required"), "password")

    if not PASSWORD_REGEX.match(password):
        raise PasswordResetError(msg(lang, "password_rule"), "password")

    if password != password_repeat:
        raise PasswordResetError(msg(lang, "password_match"), "passwordRepeat")

    user = get_user_by_reset_token(token)
    if not user:
        raise PasswordResetError(msg(lang, "invalid_or_expired_token"), status_code=400)

    expires_at = user["PASSWORD_RESET_EXPIRES_AT"]
    if expires_at is None or expires_at < datetime.now():
        raise PasswordResetError(msg(lang, "invalid_or_expired_token"), status_code=400)

    password_hash = _hash_password(password)
    update_password_and_clear_reset(user["ID"], password_hash)

    insert_login_log(
        username=user["USERNAME"],
        email=user["EMAIL"],
        device_id=None,
        event_type="PASSWORD_RESET_SUCCESS",
        success=True,
        failure_reason=None,
        responsibility_approved=None,
    )

    return {
        "success": True,
        "message": msg(lang, "reset_success"),
    }
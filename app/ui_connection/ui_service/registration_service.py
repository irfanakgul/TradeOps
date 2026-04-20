from __future__ import annotations

import base64
import hashlib
import os
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from config.device import get_runtime_device_id
from service.email_service import send_email, build_bilingual_body

from ui_connection.ui_repository.registered_user_repository import (
    email_exists,
    insert_registered_user,
    username_exists,
)

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PASSWORD_REGEX = re.compile(r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$")

BASE_DIR = Path(__file__).resolve().parents[3]
AGREEMENT_PDF_PATH = BASE_DIR / "ui" / "assets" / "pdf" / "initial_agreement.pdf"

MESSAGES = {
    "tr": {
        "username_required": "Kullanıcı adı zorunludur.",
        "username_min": "Kullanıcı adı en az 3 karakter olmalıdır.",
        "email_required": "E-posta zorunludur.",
        "email_invalid": "Geçerli bir e-posta adresi girin.",
        "email_match": "E-posta alanları aynı olmalıdır.",
        "first_name_required": "Ad zorunludur.",
        "last_name_required": "Soyad zorunludur.",
        "dob_required": "Doğum tarihi zorunludur.",
        "dob_invalid": "Doğum tarihi formatı geçersiz.",
        "under_18": "18 yaşından küçük kullanıcılar kayıt olamaz.",
        "country_required": "Ülke bilgisi zorunludur.",
        "mobile_required": "Cep telefonu zorunludur.",
        "gender_invalid": "Geçersiz cinsiyet seçimi.",
        "experience_invalid": "Geçersiz tecrübe seçimi.",
        "budget_numeric": "Tahmini başlangıç bütçesi sayısal olmalıdır.",
        "budget_positive": "Tahmini başlangıç bütçesi 0'dan büyük olmalıdır.",
        "password_required": "Şifre zorunludur.",
        "password_rule": "Şifre en az 6 karakter olmalı ve büyük harf, küçük harf, sayı içermelidir.",
        "password_match": "Şifre alanları aynı olmalıdır.",
        "agreement_required": "Sorumluluk sözleşmesi onaylanmalıdır.",
        "username_taken": "Bu kullanıcı adı zaten alınmış.",
        "email_taken": "Bu e-posta adresi zaten kayıtlı.",
        "register_success": "Kayıt başarıyla tamamlandı. Hesabınız onay bekliyor.",
        "mail_subject_1": "TradeOPS Kayıt Talebiniz Alındı",
        "mail_title_1": "TradeOPS Kayıt Bildirimi",
        "mail_body_1": (
            "Merhaba {first_name},\n\n"
            "Kayıt talebiniz başarıyla alınmıştır.\n"
            "Kullanıcı adınız: {username}\n"
            "Durum: NEW_USER\n\n"
            "Hesabınız onaylandıktan sonra giriş yapabileceksiniz."
        ),
        "mail_subject_2": "TradeOPS Sorumluluk Sözleşmesi Kopyası",
        "mail_title_2": "Sorumluluk Sözleşmesi Bilgilendirmesi",
        "mail_body_2": (
            "TradeOPS uygulamasına kayıt olarak sorumluluk sözleşmesi metnini kabul etmiş olursunuz.\n\n"
            "Kayıt sırasında onayladığınız ilk sözleşme metni bu e-postaya PDF eki olarak eklenmiştir.\n\n"
            "Bu e-posta, sözleşme kabul bilgilendirmesi amacıyla gönderilmiştir."
        ),
    },
    "en": {
        "username_required": "Username is required.",
        "username_min": "Username must be at least 3 characters.",
        "email_required": "Email is required.",
        "email_invalid": "Enter a valid email address.",
        "email_match": "Email addresses do not match.",
        "first_name_required": "First name is required.",
        "last_name_required": "Last name is required.",
        "dob_required": "Date of birth is required.",
        "dob_invalid": "Invalid date of birth format.",
        "under_18": "Users under 18 are not allowed.",
        "country_required": "Country is required.",
        "mobile_required": "Mobile phone is required.",
        "gender_invalid": "Invalid gender selection.",
        "experience_invalid": "Invalid experience selection.",
        "budget_numeric": "Estimated budget must be numeric.",
        "budget_positive": "Estimated budget must be greater than 0.",
        "password_required": "Password is required.",
        "password_rule": "Password must contain uppercase, lowercase, number and be at least 6 characters.",
        "password_match": "Passwords do not match.",
        "agreement_required": "Responsibility agreement must be approved.",
        "username_taken": "This username is already taken.",
        "email_taken": "This email is already registered.",
        "register_success": "Registration completed successfully. Your account is pending approval.",
        "mail_subject_1": "TradeOPS Registration Received",
        "mail_title_1": "TradeOPS Registration",
        "mail_body_1": (
            "Hello {first_name},\n\n"
            "Your registration has been received successfully.\n"
            "Username: {username}\n"
            "Status: NEW_USER\n\n"
            "Your account will become available after approval."
        ),
        "mail_subject_2": "TradeOPS Responsibility Agreement Copy",
        "mail_title_2": "Responsibility Agreement Information",
        "mail_body_2": (
            "By registering for the TradeOPS application, you accept the responsibility agreement text.\n\n"
            "The initial agreement text you approved during registration is attached to this email as a PDF.\n\n"
            "This email serves as an informational copy of that agreement acceptance."
        ),
    },
}

MAIL_TEXTS = {
    "register_received_en": (
        "Hello {first_name},\n\n"
        "Your registration has been received successfully.\n"
        "Username: {username}\n"
        "Status: NEW_USER\n\n"
        "Your account will become available after approval."
    ),
    "register_received_tr": (
        "Merhaba {first_name},\n\n"
        "Kayıt talebiniz başarıyla alınmıştır.\n"
        "Kullanıcı adınız: {username}\n"
        "Durum: NEW_USER\n\n"
        "Hesabınız onaylandıktan sonra giriş yapabileceksiniz."
    ),
    "agreement_copy_en": (
        "By registering for the TradeOPS application, you accept the responsibility agreement text.\n\n"
        "The initial agreement text you approved during registration is attached to this email as a PDF.\n\n"
        "This email serves as an informational copy of that agreement acceptance."
    ),
    "agreement_copy_tr": (
        "TradeOPS uygulamasına kayıt olarak sorumluluk sözleşmesi metnini kabul etmiş olursunuz.\n\n"
        "Kayıt sırasında onayladığınız ilk sözleşme metni bu e-postaya PDF eki olarak eklenmiştir.\n\n"
        "Bu e-posta, sözleşme kabul bilgilendirmesi amacıyla gönderilmiştir."
    ),
}

class RegistrationError(Exception):
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


def _parse_date_of_birth(value: str, lang: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise RegistrationError(msg(lang, "dob_invalid"), "dateOfBirth") from exc


def _is_adult(date_of_birth: date) -> bool:
    today = date.today()
    age = today.year - date_of_birth.year
    if (today.month, today.day) < (date_of_birth.month, date_of_birth.day):
        age -= 1
    return age >= 18


def register_user(payload: dict) -> dict:
    lang = "tr" if payload.get("language") == "tr" else "en"

    username = (payload.get("username") or "").strip()
    email = (payload.get("email") or "").strip().lower()
    email_repeat = (payload.get("emailRepeat") or "").strip().lower()
    first_name = (payload.get("firstName") or "").strip()
    last_name = (payload.get("lastName") or "").strip()
    date_of_birth_raw = (payload.get("dateOfBirth") or "").strip()
    country = (payload.get("country") or "").strip()
    mobile_phone = (payload.get("mobilePhone") or "").strip()
    gender = (payload.get("gender") or "").strip()
    experience = (payload.get("experience") or "").strip()
    estimated_budget_raw = str(payload.get("estimatedBudget") or "").strip()
    password = payload.get("password") or ""
    password_repeat = payload.get("passwordRepeat") or ""
    responsibility_approved = bool(payload.get("responsibilityApproved"))

    if not username:
        raise RegistrationError(msg(lang, "username_required"), "username")
    if len(username) < 3:
        raise RegistrationError(msg(lang, "username_min"), "username")

    if not email:
        raise RegistrationError(msg(lang, "email_required"), "email")
    if not EMAIL_REGEX.match(email):
        raise RegistrationError(msg(lang, "email_invalid"), "email")

    if email != email_repeat:
        raise RegistrationError(msg(lang, "email_match"), "emailRepeat")

    if not first_name:
        raise RegistrationError(msg(lang, "first_name_required"), "firstName")

    if not last_name:
        raise RegistrationError(msg(lang, "last_name_required"), "lastName")

    if not date_of_birth_raw:
        raise RegistrationError(msg(lang, "dob_required"), "dateOfBirth")

    date_of_birth = _parse_date_of_birth(date_of_birth_raw, lang)
    if not _is_adult(date_of_birth):
        raise RegistrationError(msg(lang, "under_18"), "dateOfBirth")

    if not country:
        raise RegistrationError(msg(lang, "country_required"), "country")

    if not mobile_phone:
        raise RegistrationError(msg(lang, "mobile_required"), "mobilePhone")

    allowed_genders = {"MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"}
    if gender not in allowed_genders:
        raise RegistrationError(msg(lang, "gender_invalid"), "gender")

    allowed_experience = {"BEGINNER", "INTERMEDIATE", "GOOD", "VERY_GOOD"}
    if experience not in allowed_experience:
        raise RegistrationError(msg(lang, "experience_invalid"), "experience")

    try:
        estimated_budget = Decimal(estimated_budget_raw)
    except (InvalidOperation, ValueError) as exc:
        raise RegistrationError(msg(lang, "budget_numeric"), "estimatedBudget") from exc

    if estimated_budget <= 0:
        raise RegistrationError(msg(lang, "budget_positive"), "estimatedBudget")

    if not password:
        raise RegistrationError(msg(lang, "password_required"), "password")

    if not PASSWORD_REGEX.match(password):
        raise RegistrationError(msg(lang, "password_rule"), "password")

    if password != password_repeat:
        raise RegistrationError(msg(lang, "password_match"), "passwordRepeat")

    if not responsibility_approved:
        raise RegistrationError(msg(lang, "agreement_required"), "responsibilityApproved")

    if username_exists(username):
        raise RegistrationError(msg(lang, "username_taken"), "username", status_code=409)

    if email_exists(email):
        raise RegistrationError(msg(lang, "email_taken"), "email", status_code=409)

    device_id = get_runtime_device_id()
    password_hash = _hash_password(password)

    created_user = insert_registered_user(
        {
            "username": username,
            "email": email,
            "password_hash": password_hash,
            "first_name": first_name,
            "last_name": last_name,
            "date_of_birth": date_of_birth,
            "country": country,
            "mobile_phone": mobile_phone,
            "gender": gender,
            "exchange_experience": experience,
            "estimated_start_budget": estimated_budget,
            "responsibility_approved": True,
            "device_id": device_id,
        }
    )

    send_email(
        to_email=email,
        subject=msg(lang, "mail_subject_1"),
        title=msg(lang, "mail_title_1"),
        body=build_bilingual_body(
            english_text=MAIL_TEXTS["register_received_en"].format(
                first_name=first_name,
                username=username,
            ),
            turkish_text=MAIL_TEXTS["register_received_tr"].format(
                first_name=first_name,
                username=username,
            ),
        ),
    )

    send_email(
        to_email=email,
        subject=msg(lang, "mail_subject_2"),
        title=msg(lang, "mail_title_2"),
        body=build_bilingual_body(
            english_text=MAIL_TEXTS["agreement_copy_en"],
            turkish_text=MAIL_TEXTS["agreement_copy_tr"],
        ),
        attachment_paths=[AGREEMENT_PDF_PATH],
    )

    return {
        "success": True,
        "message": msg(lang, "register_success"),
        "user": created_user,
    }
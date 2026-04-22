from __future__ import annotations

from config.device import get_runtime_device_id
from service.email_service import send_email, build_bilingual_body
from ui_connection.ui_repository.contact_form_repository import insert_contact_form


CONTACT_SUBJECTS = {
    "TWS_ERROR": {
        "tr": "TWS ile ilgili hata alıyorum",
        "en": "I am having an issue with TWS",
    },
    "SERVER_ERROR": {
        "tr": "SERVER ile ilgili hata alıyorum",
        "en": "I am having an issue with the SERVER",
    },
    "LOGIN_ISSUE": {
        "tr": "Giriş yapmakda sorun yaşıyorum",
        "en": "I am having trouble logging in",
    },
    "REGISTER_ISSUE": {
        "tr": "Üye olmakda sorun yaşıyorum",
        "en": "I am having trouble registering",
    },
    "FORGOT_PASSWORD": {
        "tr": "Şifremi unuttum",
        "en": "I forgot my password",
    },
    "FORGOT_EMAIL": {
        "tr": "Mailimi unuttum",
        "en": "I forgot my email",
    },
    "FORGOT_USERNAME": {
        "tr": "Kullanıcı adımı unuttum",
        "en": "I forgot my username",
    },
    "DELETE_MY_DATA": {
        "tr": "Bilgilerimin silinmesini istiyorum",
        "en": "I want my data to be deleted",
    },
    "APP_SUGGESTION": {
        "tr": "Uygulama ile ilgili önerim var",
        "en": "I have a suggestion about the application",
    },
    "BUSINESS_COLLAB": {
        "tr": "İş birliğinde bulunmak istiyorum",
        "en": "I would like to collaborate",
    },
    "GENERAL_QUESTION": {
        "tr": "Genel sorum var",
        "en": "I have a general question",
    },
    "COMPLAINT": {
        "tr": "Şikayetim var",
        "en": "I have a complaint",
    },
    "OTHER": {
        "tr": "Diğer",
        "en": "Other",
    },
}


class ContactFormError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def get_contact_subject_options() -> list[dict]:
    return [
        {
            "value": key,
            "label_tr": value["tr"],
            "label_en": value["en"],
        }
        for key, value in CONTACT_SUBJECTS.items()
    ]


def submit_contact_form(payload: dict) -> dict:
    username = (payload.get("username") or "").strip() or None
    email = (payload.get("email") or "").strip().lower()
    first_name = (payload.get("first_name") or "").strip() or None
    last_name = (payload.get("last_name") or "").strip() or None
    mobile_phone = (payload.get("mobile_phone") or "").strip() or None
    subject = (payload.get("subject") or "").strip()
    message = (payload.get("message") or "").strip()
    language = "tr" if payload.get("language") == "tr" else "en"

    if not email:
        raise ContactFormError("Email is required.", 400)

    if not subject or subject not in CONTACT_SUBJECTS:
        raise ContactFormError("Subject is required.", 400)

    if not message:
        raise ContactFormError("Message is required.", 400)

    device_id = get_runtime_device_id(username or "guest_user")

    insert_contact_form(
        username=username,
        device_id=device_id,
        email=email,
        first_name=first_name,
        last_name=last_name,
        mobile_phone=mobile_phone,
        subject=subject,
        message=message,
    )

    subject_tr = CONTACT_SUBJECTS[subject]["tr"]
    subject_en = CONTACT_SUBJECTS[subject]["en"]

    preview_body_en = (
        f"Hello,\n\n"
        f"Your contact form has been received successfully.\n\n"
        f"Subject: {subject_en}\n"
        f"Message Summary:\n{message}\n\n"
        f"We will review your message as soon as possible."
    )

    preview_body_tr = (
        f"Merhaba,\n\n"
        f"İletişim formunuz başarıyla alınmıştır.\n\n"
        f"Konu: {subject_tr}\n"
        f"Mesaj Özeti:\n{message}\n\n"
        f"Mesajınızı en kısa sürede değerlendireceğiz."
    )

    send_email(
        to_email=email,
        subject="TradeOPS Contact Form Copy",
        title="Contact Form Submitted",
        body=build_bilingual_body(
            english_text=preview_body_en,
            turkish_text=preview_body_tr,
        ),
    )

    return {
        "success": True,
        "message": (
            "Formunuz başarıyla gönderildi."
            if language == "tr"
            else "Your form has been submitted successfully."
        ),
    }
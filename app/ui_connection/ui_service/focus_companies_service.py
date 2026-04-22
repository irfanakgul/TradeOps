from __future__ import annotations

from ui_connection.ui_repository.focus_companies_repository import (
    bulk_update_user_in_scope,
    fetch_exchange_summary,
    fetch_focus_companies,
)
from ui_connection.ui_service.config_file_service import read_exchange_yaml
from ui_connection.ui_service.ui_users_service import resolve_effective_username


class FocusCompaniesError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code

EXCHANGE_ALIAS_MAP = {
    "AEB": "EURONEXT",
    "EURONEXT": "EURONEXT",
    "NASDAQ": "NASDAQ",
    "NYSE": "NYSE",
}

DISPLAY_EXCHANGE_MAP = {
    "EURONEXT": "EURONEXT/AEB",
    "NASDAQ": "NASDAQ",
    "NYSE": "NYSE",
}

def _normalize_exchange(exchange: str) -> str:
    value = str(exchange or "").strip().upper()
    return EXCHANGE_ALIAS_MAP.get(value, value)


def _display_exchange(exchange: str) -> str:
    normalized = _normalize_exchange(exchange)
    return DISPLAY_EXCHANGE_MAP.get(normalized, normalized)



def _get_allowed_exchanges_from_yaml() -> list[str]:
    exchanges = read_exchange_yaml()
    normalized = []

    for item in exchanges:
        raw_exchange = str(item.get("EXCHANGE", "")).strip().upper()
        if raw_exchange:
            normalized.append(_normalize_exchange(raw_exchange))

    return sorted(list(set(normalized)))


def get_focus_companies_data(
    requesting_username: str,
    requesting_user_type: str,
    selected_username: str | None = None,
) -> dict:
    effective_username = resolve_effective_username(
        requesting_username=requesting_username,
        requesting_user_type=requesting_user_type,
        selected_username=selected_username,
    )

    rows = fetch_focus_companies(effective_username)
    exchange_summary = fetch_exchange_summary(effective_username)

    all_exchanges = sorted(
    list({_normalize_exchange(str(row["EXCHANGE"])) for row in rows if row.get("EXCHANGE")})
)
    allowed_exchanges = _get_allowed_exchanges_from_yaml()

    return {
        "username": effective_username,
        "all_exchanges": all_exchanges,
        "allowed_exchanges": allowed_exchanges,
        "exchange_summary": exchange_summary,
        "rows": rows,
        "display_exchange_map": {
            exchange: _display_exchange(exchange)
            for exchange in all_exchanges
         },
    }


def save_focus_companies(changes: list[dict]) -> dict:
    if not changes:
        return {
            "success": True,
            "updated": 0,
            "message": "No changes to save.",
        }

    for row in changes:
        if "username" not in row or "symbol" not in row or "exchange" not in row:
            raise FocusCompaniesError("Invalid change payload.", 400)

        if "user_in_scope" not in row:
            raise FocusCompaniesError("Missing user_in_scope value.", 400)

    bulk_update_user_in_scope(changes)

    return {
        "success": True,
        "updated": len(changes),
        "message": "Focus companies updated successfully.",
    }
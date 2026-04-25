from __future__ import annotations

from sqlalchemy import text

from ui_connection.ui_repository.engine import get_ui_engine


def fetch_latest_signal_date() -> str | None:
    query = text('SELECT MAX("DATE") AS latest_date FROM live.daily_buy_signals_all')
    engine = get_ui_engine()
    with engine.connect() as conn:
        row = conn.execute(query).mappings().first()
    if row and row["latest_date"]:
        return str(row["latest_date"])
    return None


def fetch_buy_signals(date_filter: str | None = None) -> list[dict]:
    if date_filter:
        query = text("""
            SELECT
                "EXCHANGE",
                "SYMBOL",
                "DATE",
                "TRIAGE_SCORE",
                "TARGET_PRICE",
                "SIGNAL"
            FROM live.daily_buy_signals_all
            WHERE "DATE" = :date_filter
            ORDER BY "TRIAGE_SCORE" DESC
        """)
        params: dict = {"date_filter": date_filter}
    else:
        query = text("""
            SELECT
                "EXCHANGE",
                "SYMBOL",
                "DATE",
                "TRIAGE_SCORE",
                "TARGET_PRICE",
                "SIGNAL"
            FROM live.daily_buy_signals_all
            ORDER BY "DATE" DESC, "TRIAGE_SCORE" DESC
        """)
        params = {}

    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query, params).mappings().all()

    def _to_float(value: object) -> float | None:
        if value is None:
            return None
        try:
            return float(str(value).replace(",", "."))
        except (ValueError, TypeError):
            return None

    return [
        {
            "exchange": row["EXCHANGE"],
            "symbol": row["SYMBOL"],
            "date": str(row["DATE"]) if row["DATE"] else None,
            "score": _to_float(row["TRIAGE_SCORE"]),
            "target_price": _to_float(row["TARGET_PRICE"]),
            "signal": row["SIGNAL"],
        }
        for row in rows
    ]


def fetch_distinct_exchanges() -> list[str]:
    query = text("""
        SELECT DISTINCT "EXCHANGE"
        FROM live.daily_buy_signals_all
        ORDER BY "EXCHANGE"
    """)
    engine = get_ui_engine()
    with engine.connect() as conn:
        rows = conn.execute(query).mappings().all()
    return [str(row["EXCHANGE"]) for row in rows]

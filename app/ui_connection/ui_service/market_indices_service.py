from __future__ import annotations

import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import certifi


# Each entry: (display_label, [(symbol, exchange), ...] tried in order until one works)
INDICES: list[tuple[str, list[tuple[str, str]]]] = [
    ("BIST 100", [("XU100", "BIST"), ("XU100", "TVC")]),
    ("AEX",      [("AEX", "EURONEXT"), ("AEX", "TVC")]),
    ("NASDAQ",   [("IXIC", "NASDAQ"), ("IXIC", "TVC"), ("NDX", "NASDAQ")]),
    ("NYSE",     [("NYA", "NYSE"), ("NYA", "TVC"), ("DJI", "DJ")]),
]

_CACHE: dict[str, object] = {"data": None, "ts": 0.0}
_CACHE_TTL = 60.0  # seconds


def _fetch_one(label: str, candidates: list[tuple[str, str]]) -> dict:
    try:
        from tvDatafeed import TvDatafeed, Interval

        logging.getLogger("tvDatafeed").setLevel(logging.CRITICAL)
        os.environ["SSL_CERT_FILE"] = certifi.where()
        os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

        tv = TvDatafeed()

        last_reason = "no data"
        for symbol, exchange in candidates:
            try:
                df = tv.get_hist(
                    symbol=symbol,
                    exchange=exchange,
                    interval=Interval.in_daily,
                    n_bars=2,
                )
            except Exception as inner:  # noqa: BLE001
                last_reason = f"{exchange}:{symbol} -> {inner}"
                continue

            if df is None or df.empty or len(df) < 2:
                last_reason = f"{exchange}:{symbol} -> no data"
                continue

            prev_close = float(df["close"].iloc[-2])
            last_close = float(df["close"].iloc[-1])
            if prev_close <= 0:
                last_reason = f"{exchange}:{symbol} -> invalid prev close"
                continue

            change_pct = (last_close - prev_close) / prev_close * 100
            return {
                "label": label,
                "ok": True,
                "last": round(last_close, 2),
                "change_pct": round(change_pct, 2),
                "source": f"{exchange}:{symbol}",
            }

        return {"label": label, "ok": False, "reason": last_reason}
    except Exception as exc:  # noqa: BLE001
        return {"label": label, "ok": False, "reason": str(exc)}


def get_market_indices() -> dict:
    now = time.time()
    cached = _CACHE.get("data")
    cached_ts = float(_CACHE.get("ts") or 0.0)
    if cached is not None and (now - cached_ts) < _CACHE_TTL:
        return {"indices": cached, "cached": True, "age_sec": int(now - cached_ts)}

    results: list[dict] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futs = {
            pool.submit(_fetch_one, label, candidates): label
            for (label, candidates) in INDICES
        }
        for fut in as_completed(futs):
            results.append(fut.result())

    # Preserve original order by label
    order = {label: i for i, (label, _) in enumerate(INDICES)}
    results.sort(key=lambda r: order.get(r.get("label", ""), 99))

    _CACHE["data"] = results
    _CACHE["ts"] = now

    return {"indices": results, "cached": False, "age_sec": 0}

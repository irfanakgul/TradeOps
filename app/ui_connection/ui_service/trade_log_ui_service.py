from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

from ib_insync import IB, MarketOrder

from config.settings import load_settings
from ui_connection.ui_repository.trade_log_repository import (
    fetch_sim_open_positions,
    update_sim_position_after_sell,
)


class TradeLogError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def get_sim_trade_mode() -> str:
    settings = load_settings()
    return str(getattr(settings, "SIM_IBKR_MODE", "PAPER")).upper()


def fetch_trade_log_positions(username: str, ibkr_mode: str) -> list[dict]:
    rows = fetch_sim_open_positions(username, ibkr_mode)
    result = []
    for row in rows:
        item = dict(row)
        for key in ("buy_time", "exit_time", "fetched_at"):
            val = item.get(key)
            if isinstance(val, datetime):
                item[key] = val.isoformat()
        result.append(item)
    return result


def get_actual_price(symbol: str, exchange: str) -> dict:
    try:
        import os
        import certifi
        from tvDatafeed import TvDatafeed, Interval

        logging.getLogger("tvDatafeed").setLevel(logging.CRITICAL)
        os.environ["SSL_CERT_FILE"] = certifi.where()
        os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()

        tv_exchange = _map_exchange_for_tv(exchange)
        tv = TvDatafeed()

        df = tv.get_hist(
            symbol=symbol.upper(),
            exchange=tv_exchange,
            interval=Interval.in_1_minute,
            n_bars=10,
        )

        if df is None or df.empty:
            return {"ok": False, "reason": f"{symbol} için {exchange} borsasında fiyat verisi bulunamadı"}

        last_price = float(df["close"].iloc[-1])
        last_ts = df.index[-1]
        price_date = last_ts.isoformat() if hasattr(last_ts, "isoformat") else str(last_ts)

        return {
            "ok": True,
            "price": round(last_price, 4),
            "price_date": price_date,
        }

    except Exception as exc:
        return {"ok": False, "reason": str(exc)}


def _map_exchange_for_tv(exchange: str) -> str:
    mapping = {
        "AEB": "EURONEXT",
        "EURONEXT": "EURONEXT",
        "XETRA": "XETRA",
        "LSE": "LSE",
        "NASDAQ": "NASDAQ",
        "NYSE": "NYSE",
        "ARCA": "NYSE",
        "AMEX": "AMEX",
        "TSX": "TSX",
        "BVME": "MIL",
    }
    return mapping.get(exchange.strip().upper(), exchange.strip().upper())


async def _execute_sell_async(
    symbol: str,
    exchange: str,
    currency: str,
    settings: Any,
) -> dict:
    ib = IB()
    await ib.connectAsync(
        settings.SIM_IBKR_HOST,
        int(settings.SIM_IBKR_PORT),
        clientId=int(settings.SIM_IBKR_CLIENT_ID) + 20,
        timeout=20,
    )

    try:
        symbol_upper = symbol.upper()

        # Açık tüm SELL emirlerini iptal et
        open_trades = ib.openTrades()
        for t in open_trades:
            try:
                if (
                    t.contract.symbol == symbol_upper
                    and t.order.action == "SELL"
                    and t.orderStatus.status not in {"Filled", "Cancelled", "Inactive"}
                ):
                    ib.cancelOrder(t.order)
                    await asyncio.sleep(0.5)
            except Exception:
                pass

        # Açık pozisyonu bul
        positions = ib.positions()
        pos = next(
            (p for p in positions if p.contract.symbol == symbol_upper and float(p.position) > 0),
            None,
        )

        if pos is None:
            return {"ok": False, "reason": f"{symbol_upper} için açık long pozisyon bulunamadı"}

        qty = float(pos.position)
        contract = pos.contract

        # BUY fill'lerden ağırlıklı ortalama alış fiyatı
        fills = await ib.reqExecutionsAsync()
        buy_fills = [
            f for f in fills
            if f.contract.symbol == symbol_upper and f.execution.side in ("BOT", "BUY")
        ]

        if not buy_fills:
            return {"ok": False, "reason": f"{symbol_upper} için BUY execution bulunamadı"}

        total_qty = sum(float(f.execution.shares) for f in buy_fills)
        total_amount = sum(float(f.execution.shares) * float(f.execution.price) for f in buy_fills)
        buy_price = total_amount / total_qty if total_qty > 0 else None

        # Market sell
        sell_order = MarketOrder("SELL", qty)
        sell_order.tif = "DAY"
        sell_order.transmit = True

        trade = ib.placeOrder(contract, sell_order)

        start = time.time()
        while not trade.isDone() and time.time() - start < 30:
            await asyncio.sleep(0.5)

        if not trade.fills:
            log_messages = [
                {
                    "time": str(x.time),
                    "status": x.status,
                    "message": x.message,
                    "errorCode": x.errorCode,
                }
                for x in trade.log
            ]

            reason = f"Sell fill gelmedi. Status: {trade.orderStatus.status}"
            for log_entry in trade.log:
                msg_lower = (log_entry.message or "").lower()
                if any(kw in msg_lower for kw in ("market", "outside", "closed", "rth")):
                    reason = f"Piyasa kapalı olabilir: {log_entry.message}"
                    break
                if log_entry.errorCode and log_entry.errorCode not in (0, None):
                    reason = f"IBKR hata kodu {log_entry.errorCode}: {log_entry.message}"
                    break

            return {
                "ok": False,
                "reason": reason,
                "status": trade.orderStatus.status,
                "log": log_messages,
            }

        last_fill = trade.fills[-1]
        sell_price = float(last_fill.execution.price)
        sell_time_raw = last_fill.time
        filled_qty = float(last_fill.execution.shares)

        if hasattr(sell_time_raw, "tzinfo") and sell_time_raw.tzinfo is None:
            sell_time_raw = sell_time_raw.replace(tzinfo=timezone.utc)

        sell_time_str = (
            sell_time_raw.isoformat() if hasattr(sell_time_raw, "isoformat") else str(sell_time_raw)
        )

        pct_change = ((sell_price - buy_price) / buy_price) * 100.0 if buy_price else 0.0

        return {
            "ok": True,
            "symbol": symbol_upper,
            "qty": filled_qty,
            "buy_price": round(buy_price, 4) if buy_price else None,
            "sell_price": round(sell_price, 4),
            "sell_time": sell_time_str,
            "sell_time_dt": sell_time_raw,
            "pct_change": round(pct_change, 4),
            "status": trade.orderStatus.status,
        }

    finally:
        if ib.isConnected():
            ib.disconnect()


def execute_sell(
    *,
    symbol: str,
    exchange: str,
    currency: str,
    username: str,
    ibkr_mode: str,
    buy_exec_id: str | None = None,
    buy_price_from_db: float | None = None,
) -> dict:
    settings = load_settings()

    try:
        result = asyncio.run(
            _execute_sell_async(symbol, exchange, currency, settings)
        )
    except Exception as exc:
        return {"ok": False, "reason": f"IBKR bağlantı hatası: {str(exc)}"}

    if result["ok"]:
        sell_price = result["sell_price"]
        sell_time_dt = result.get("sell_time_dt") or datetime.now(timezone.utc)
        filled_qty = result["qty"]
        buy_price = result.get("buy_price") or buy_price_from_db

        profit_pct = result["pct_change"]
        profit_amount = (sell_price - buy_price) * filled_qty if buy_price else None

        try:
            update_sim_position_after_sell(
                username=username,
                ibkr_mode=ibkr_mode,
                symbol=symbol.upper(),
                buy_exec_id=buy_exec_id,
                exit_price=sell_price,
                exit_time=sell_time_dt,
                profit_pct=profit_pct,
                profit_amount=profit_amount,
                exit_quantity=filled_qty,
            )
        except Exception as db_exc:
            result["db_update_warning"] = f"DB güncelleme uyarısı: {str(db_exc)}"

        # sell_time_dt JSON serileştirilebilir değil, kaldır
        result.pop("sell_time_dt", None)

    return result

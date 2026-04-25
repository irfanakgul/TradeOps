from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime
from datetime import time as dtime
from typing import Optional
from zoneinfo import ZoneInfo

from ib_insync import IB, MarketOrder, Order, Stock

from config.settings import load_settings


_MARKET_HOURS: dict[str, tuple[str, dtime, dtime]] = {
    "NASDAQ":   ("America/New_York",    dtime(9, 30),  dtime(16, 0)),
    "NYSE":     ("America/New_York",    dtime(9, 30),  dtime(16, 0)),
    "ARCA":     ("America/New_York",    dtime(9, 30),  dtime(16, 0)),
    "BATS":     ("America/New_York",    dtime(9, 30),  dtime(16, 0)),
    "AMEX":     ("America/New_York",    dtime(9, 30),  dtime(16, 0)),
    "EURONEXT": ("Europe/Amsterdam",    dtime(9, 0),   dtime(17, 30)),
    "AEB":      ("Europe/Amsterdam",    dtime(9, 0),   dtime(17, 30)),
    "XETRA":    ("Europe/Berlin",       dtime(9, 0),   dtime(17, 30)),
    "LSE":      ("Europe/London",       dtime(8, 0),   dtime(16, 30)),
}


def _check_market_open(exchange: str) -> tuple[bool, str]:
    normalized = exchange.strip().upper()
    entry = _MARKET_HOURS.get(normalized)

    if entry is None:
        return True, ""

    tz_name, open_t, close_t = entry
    now = datetime.now(ZoneInfo(tz_name))

    if now.weekday() >= 5:
        day = "Saturday" if now.weekday() == 5 else "Sunday"
        return False, (
            f"Market is closed — it's {day}. "
            f"({exchange}, {tz_name})"
        )

    current = now.time().replace(tzinfo=None)

    if current < open_t:
        return False, (
            f"Market not open yet. Opens at {open_t.strftime('%H:%M')} "
            f"({tz_name}). Current time: {now.strftime('%H:%M')}."
        )

    if current >= close_t:
        return False, (
            f"Market is closed. Closed at {close_t.strftime('%H:%M')} "
            f"({tz_name}). Current time: {now.strftime('%H:%M')}."
        )

    return True, ""


EXCHANGE_CURRENCY_MAP: dict[str, str] = {
    "NASDAQ": "USD",
    "NYSE": "USD",
    "ARCA": "USD",
    "BATS": "USD",
    "AMEX": "USD",
    "EURONEXT": "EUR",
    "AEB": "EUR",
    "XETRA": "EUR",
    "LSE": "GBP",
    "TSE": "JPY",
}

EXIT_ORDER_TYPES: dict[str, dict] = {
    "market": {
        "orderType": "MKT",
        "required": [],
    },
    "limit": {
        "orderType": "LMT",
        "required": ["limit_price"],
    },
    "stop": {
        "orderType": "STP",
        "required": ["stop_price"],
    },
    "stop_limit": {
        "orderType": "STP LMT",
        "required": ["stop_price", "limit_price"],
    },
    "market_if_touched": {
        "orderType": "MIT",
        "required": ["trigger_price"],
    },
    "trailing_stop_amount": {
        "orderType": "TRAIL",
        "required": ["trail_amount"],
    },
    "trailing_stop_percentage": {
        "orderType": "TRAIL",
        "required": ["trailing_percent"],
    },
    "market_on_close": {
        "orderType": "MOC",
        "required": [],
    },
    "market_on_open": {
        "orderType": "MKT",
        "required": [],
        "forced_tif": "OPG",
    },
}


@dataclass
class SimBuyResult:
    ok: bool
    message: str
    symbol: Optional[str] = None
    buy_time: Optional[str] = None
    buy_shares: Optional[float] = None
    buy_price: Optional[float] = None
    buy_avg_price: Optional[float] = None
    exit_type: Optional[str] = None
    exit_order_status: Optional[str] = None
    exit_order_type: Optional[str] = None
    exit_detail: dict = field(default_factory=dict)
    buy_status: Optional[str] = None
    buy_log: list = field(default_factory=list)
    exec_id: Optional[str] = None
    order_id: Optional[int] = None
    ibkr_mode: Optional[str] = None


def _map_exchange(exchange: str) -> str:
    normalized = exchange.strip().upper()
    if normalized == "EURONEXT":
        return "AEB"
    return normalized


def _get_currency(exchange: str) -> str:
    normalized = exchange.strip().upper()
    return EXCHANGE_CURRENCY_MAP.get(normalized, "USD")


def _build_exit_order(exit_type: str, qty: float, **params) -> Order:
    spec = EXIT_ORDER_TYPES[exit_type]

    missing = [p for p in spec["required"] if p not in params]
    if missing:
        raise ValueError(f"{exit_type} için eksik parametre: {missing}")

    o = Order()
    o.action = "SELL"
    o.orderType = spec["orderType"]
    o.totalQuantity = qty
    o.transmit = True

    if "forced_tif" in spec:
        o.tif = spec["forced_tif"]
    else:
        o.tif = params.get("tif", "DAY")

    if exit_type == "limit":
        o.lmtPrice = float(params["limit_price"])

    elif exit_type == "stop":
        o.auxPrice = float(params["stop_price"])

    elif exit_type == "stop_limit":
        o.auxPrice = float(params["stop_price"])
        o.lmtPrice = float(params["limit_price"])

    elif exit_type == "market_if_touched":
        o.auxPrice = float(params["trigger_price"])

    elif exit_type == "trailing_stop_amount":
        o.auxPrice = float(params["trail_amount"])
        if "trail_stop_price" in params:
            o.trailStopPrice = float(params["trail_stop_price"])

    elif exit_type == "trailing_stop_percentage":
        o.trailingPercent = float(params["trailing_percent"])
        if "trail_stop_price" in params:
            o.trailStopPrice = float(params["trail_stop_price"])

    return o


def execute_sim_buy(
    symbol: str,
    exchange: str,
    exit_type: str,
    qty: int,
    **exit_params,
) -> SimBuyResult:
    if exit_type not in EXIT_ORDER_TYPES:
        return SimBuyResult(
            ok=False,
            message=f"Geçersiz exit_type: {exit_type}. Geçerli: {list(EXIT_ORDER_TYPES.keys())}",
        )

    market_open, market_msg = _check_market_open(exchange)
    if not market_open:
        return SimBuyResult(
            ok=False,
            message=f"Market kapalı, emir gönderilmedi. {market_msg}",
        )

    settings = load_settings()
    ibkr_exchange = _map_exchange(exchange)
    currency = _get_currency(exchange)

    # ib_insync needs an event loop in the current thread
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError("closed")
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    ib = IB()
    try:
        ib.connect(
            host=settings.SIM_IBKR_HOST,
            port=settings.SIM_IBKR_PORT,
            clientId=settings.SIM_IBKR_CLIENT_ID,
            readonly=False,
            timeout=10,
        )

        contract = Stock(symbol, ibkr_exchange, currency)
        ib.qualifyContracts(contract)

        buy_order = MarketOrder("BUY", qty)
        buy_order.tif = "DAY"
        buy_order.transmit = True

        buy_trade = ib.placeOrder(contract, buy_order)

        start = time.time()
        while not buy_trade.isDone() and time.time() - start < 30:
            ib.sleep(0.5)

        if not buy_trade.fills:
            return SimBuyResult(
                ok=False,
                message="Buy fill gelmedi. TWS bağlantısını ve market saatlerini kontrol edin.",
                buy_status=getattr(buy_trade.orderStatus, "status", None),
                buy_log=[
                    {
                        "time": str(x.time),
                        "status": x.status,
                        "message": x.message,
                        "errorCode": x.errorCode,
                    }
                    for x in buy_trade.log
                ],
            )

        last_fill = buy_trade.fills[-1]
        buy_time = str(last_fill.time)
        buy_symbol = last_fill.contract.symbol
        buy_shares = float(last_fill.execution.shares)
        buy_price = float(last_fill.execution.price)
        buy_avg_price = float(last_fill.execution.avgPrice)

        exec_id = str(last_fill.execution.execId) if last_fill.execution.execId else None
        order_id: Optional[int] = None
        if buy_trade.order and buy_trade.order.orderId:
            try:
                order_id = int(buy_trade.order.orderId)
            except (ValueError, TypeError):
                pass

        exit_order = _build_exit_order(exit_type=exit_type, qty=buy_shares, **exit_params)
        exit_trade = ib.placeOrder(contract, exit_order)

        ib.sleep(1.0)

        exit_order_status = getattr(exit_trade.orderStatus, "status", None)
        exit_order_type = getattr(exit_trade.order, "orderType", None)

        exit_detail: dict = {}
        if exit_type == "trailing_stop_amount":
            exit_detail["trail_amount"] = exit_params.get("trail_amount")
        elif exit_type == "trailing_stop_percentage":
            exit_detail["trailing_percent"] = exit_params.get("trailing_percent")
        elif exit_type == "stop":
            exit_detail["stop_price"] = exit_params.get("stop_price")
        elif exit_type == "stop_limit":
            exit_detail["stop_price"] = exit_params.get("stop_price")
            exit_detail["limit_price"] = exit_params.get("limit_price")
        elif exit_type == "limit":
            exit_detail["limit_price"] = exit_params.get("limit_price")
        elif exit_type == "market_if_touched":
            exit_detail["trigger_price"] = exit_params.get("trigger_price")

        return SimBuyResult(
            ok=True,
            message=f"Buy başarılı. Exit order durumu: {exit_order_status}",
            symbol=buy_symbol,
            buy_time=buy_time,
            buy_shares=buy_shares,
            buy_price=buy_price,
            buy_avg_price=buy_avg_price,
            exit_type=exit_type,
            exit_order_status=exit_order_status,
            exit_order_type=exit_order_type,
            exit_detail=exit_detail,
            exec_id=exec_id,
            order_id=order_id,
            ibkr_mode=settings.SIM_IBKR_MODE,
        )

    except Exception as exc:
        return SimBuyResult(
            ok=False,
            message=f"Buy işlemi başarısız: {exc}",
        )

    finally:
        try:
            ib.disconnect()
        except Exception:
            pass

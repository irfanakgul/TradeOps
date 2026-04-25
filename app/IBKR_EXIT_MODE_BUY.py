
from ib_insync import *
import asyncio
import random

# ------------------------------------------------------------
# EXIT TYPE MAPPING
# ------------------------------------------------------------
EXIT_ORDER_TYPES = {
    # Hemen piyasadan çık
    "market": {
        "orderType": "MKT",
        "required": [],
        "optional": ["tif", "outsideRth"]
    },

    # Belirli fiyattan ya da daha iyisinden çık
    "limit": {
        "orderType": "LMT",
        "required": ["limit_price"],
        "optional": ["tif", "outsideRth"]
    },

    # Fiyat stop seviyesine gelirse market satış
    "stop": {
        "orderType": "STP",
        "required": ["stop_price"],
        "optional": ["tif", "outsideRth"]
    },

    # Fiyat stop seviyesine gelirse limit satış
    "stop_limit": {
        "orderType": "STP LMT",
        "required": ["stop_price", "limit_price"],
        "optional": ["tif", "outsideRth"]
    },

    # Fiyat belirli seviyeye değerse market satış
    "market_if_touched": {
        "orderType": "MIT",
        "required": ["trigger_price"],
        "optional": ["tif", "outsideRth"]
    },

    # Trailing stop - sabit tutar ile
    "trailing_stop_amount": {
        "orderType": "TRAIL",
        "required": ["trail_amount"],
        "optional": ["trail_stop_price", "tif", "outsideRth"]
    },

    # Trailing stop - yüzde ile
    "trailing_stop_percent": {
        "orderType": "TRAIL",
        "required": ["trailing_percent"],
        "optional": ["trail_stop_price", "tif", "outsideRth"]
    },

    # Kapanışta marketten çık
    "market_on_close": {
        "orderType": "MOC",
        "required": [],
        "optional": []
    },

    # Açılışta marketten çık
    "market_on_open": {
        "orderType": "MKT",
        "required": [],
        "optional": ["outsideRth"],
        "forced_tif": "OPG"
    },
}


# ------------------------------------------------------------
# EXIT ORDER BUILDER
# ------------------------------------------------------------
def build_exit_order(exit_type: str, qty: float, **params) -> Order:
    if exit_type not in EXIT_ORDER_TYPES:
        raise ValueError(
            f"Geçersiz exit_type: {exit_type}. "
            f"Geçerli tipler: {list(EXIT_ORDER_TYPES.keys())}"
        )

    spec = EXIT_ORDER_TYPES[exit_type]

    missing = [p for p in spec["required"] if p not in params]
    if missing:
        raise ValueError(
            f"{exit_type} için eksik parametre(ler): {missing}"
        )

    o = Order()
    o.action = "SELL"
    o.orderType = spec["orderType"]
    o.totalQuantity = qty
    o.transmit = True

    if "forced_tif" in spec:
        o.tif = spec["forced_tif"]
    else:
        o.tif = params.get("tif", "DAY")

    if "outsideRth" in params:
        o.outsideRth = params["outsideRth"]

    if exit_type == "market":
        pass

    elif exit_type == "limit":
        o.lmtPrice = float(params["limit_price"])

    elif exit_type == "stop":
        # IBKR'de stop trigger fiyatı auxPrice ile verilir
        o.auxPrice = float(params["stop_price"])

    elif exit_type == "stop_limit":
        o.auxPrice = float(params["stop_price"])
        o.lmtPrice = float(params["limit_price"])

    elif exit_type == "market_if_touched":
        # IBKR'de MIT trigger fiyatı auxPrice ile verilir
        o.auxPrice = float(params["trigger_price"])

    elif exit_type == "trailing_stop_amount":
        # IBKR'de TRAIL order için sabit trailing amount auxPrice ile verilir
        o.auxPrice = float(params["trail_amount"])
        if "trail_stop_price" in params:
            o.trailStopPrice = float(params["trail_stop_price"])

    elif exit_type == "trailing_stop_percent":
        o.trailingPercent = float(params["trailing_percent"])
        if "trail_stop_price" in params:
            o.trailStopPrice = float(params["trail_stop_price"])

    elif exit_type == "market_on_close":
        pass

    elif exit_type == "market_on_open":
        pass

    return o


# ------------------------------------------------------------
# BUY WITH EXIT
# ------------------------------------------------------------
async def buy_with_exit(ib: IB, symbol: str, qty: int, exit_type: str, **exit_params):
    """
    Market BUY yapar, fill geldikten sonra seçilen exit order'ı gönderir.
    """

    contract = Stock(symbol, 'SMART', 'USD')
    contract = (await ib.qualifyContractsAsync(contract))[0]

    # 1) MARKET BUY
    buy_order = MarketOrder('BUY', qty)
    buy_order.tif = 'DAY'
    buy_order.transmit = True

    buy_trade = ib.placeOrder(contract, buy_order)

    while not buy_trade.isDone():
        await asyncio.sleep(0.5)

    if not buy_trade.fills:
        return {
            "ok": False,
            "reason": "Buy fill gelmedi",
            "buy_status": buy_trade.orderStatus.status,
            "buy_log": [
                {
                    "time": str(x.time),
                    "status": x.status,
                    "message": x.message,
                    "errorCode": x.errorCode
                }
                for x in buy_trade.log
            ]
        }

    last_fill = buy_trade.fills[-1]
    buy_time = str(last_fill.time)
    buy_symbol = last_fill.contract.symbol
    buy_shares = last_fill.execution.shares
    buy_price = last_fill.execution.price
    buy_avg_price = last_fill.execution.avgPrice

    # 2) EXIT ORDER
    exit_order = build_exit_order(
        exit_type=exit_type,
        qty=buy_shares,
        **exit_params
    )

    exit_trade = ib.placeOrder(contract, exit_order)

    await asyncio.sleep(1.0)

    # rapor için exit detayları
    exit_detail = {}
    if exit_type == "trailing_stop_amount":
        exit_detail["trail_amount"] = exit_params.get("trail_amount")
        exit_detail["trail_stop_price"] = exit_params.get("trail_stop_price")

    elif exit_type == "trailing_stop_percent":
        exit_detail["trailing_percent"] = exit_params.get("trailing_percent")
        exit_detail["trail_stop_price"] = exit_params.get("trail_stop_price")

    elif exit_type == "stop":
        exit_detail["stop_price"] = exit_params.get("stop_price")

    elif exit_type == "stop_limit":
        exit_detail["stop_price"] = exit_params.get("stop_price")
        exit_detail["limit_price"] = exit_params.get("limit_price")

    elif exit_type == "limit":
        exit_detail["limit_price"] = exit_params.get("limit_price")

    elif exit_type == "market_if_touched":
        exit_detail["trigger_price"] = exit_params.get("trigger_price")

    return {
        "ok": True,
        "symbol": buy_symbol,
        "buy_time": buy_time,
        "buy_shares": buy_shares,
        "buy_price": buy_price,
        "buy_avg_price": buy_avg_price,
        "exit_type": exit_type,
        "exit_order_status": exit_trade.orderStatus.status,
        "exit_order_type": exit_trade.order.orderType,
        "exit_detail": exit_detail
    }


result = await buy_with_exit(
    ib,
    symbol='MSFT',
    qty=1,
    exit_type='trailing_stop_amount',
    trail_amount=5.0
)

print(result)
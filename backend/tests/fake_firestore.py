"""In-memory stand-in for app.services.firestore_service used by router tests."""
import copy
import itertools
import types

_ids = itertools.count(1)
STATE = {}


def reset():
    STATE.clear()
    STATE.update({"transactions": {}, "securities": {}, "prices": {}, "externalAssets": {},
                  "liabilities": {}, "dailySnapshots": {}, "rebalance": {}, "system": {}})


def _store(user_id, name):
    return STATE[name].setdefault(user_id, {})


def get_transactions(user_id, user_type):
    return [{"id": k, **v} for k, v in _store(user_id, "transactions").items()]


def add_transactions_bulk(user_id, user_type, transactions):
    for tx in transactions:
        doc_id = tx.get("id") or f"tx{next(_ids)}"
        _store(user_id, "transactions")[doc_id] = {k: v for k, v in tx.items() if k != "id"}
    return len(transactions)


def get_securities(user_id, user_type):
    return [{"id": k, **v} for k, v in _store(user_id, "securities").items()]


def save_security(user_id, user_type, ticker, data):
    current = _store(user_id, "securities").get(ticker, {})
    _store(user_id, "securities")[ticker] = {**current, **copy.deepcopy(data), "ticker": ticker}


def delete_security(user_id, user_type, ticker):
    _store(user_id, "securities").pop(ticker, None)
    _store(user_id, "prices").pop(ticker, None)


def get_security_prices(user_id, user_type, ticker=None):
    prices = _store(user_id, "prices")
    if ticker:
        return {ticker: dict(prices.get(ticker, {}))}
    return {t: dict(p) for t, p in prices.items()}


def merge_security_prices(user_id, user_type, ticker, prices):
    _store(user_id, "prices").setdefault(ticker, {}).update(prices)
    return len(prices)


def replace_security_prices(user_id, user_type, ticker, prices):
    _store(user_id, "prices")[ticker] = dict(prices)
    return len(prices)


def delete_security_price(user_id, user_type, ticker, date_str):
    return _store(user_id, "prices").get(ticker, {}).pop(date_str, None) is not None


def upsert_documents(user_id, user_type, collection_name, docs, id_key="id"):
    target = _store(user_id, collection_name)
    for doc in docs:
        doc_id = str(doc.get(id_key) or f"{collection_name}{next(_ids)}")
        target[doc_id] = {k: v for k, v in doc.items() if k != "id"}
    return len(docs)


def save_rebalance_targets(user_id, user_type, targets):
    STATE["rebalance"][user_id] = dict(targets)


def get_rebalance_targets(user_id, user_type):
    return dict(STATE["rebalance"].get(user_id, {}))


def export_user_workspace(user_id, user_type):
    def dump(name):
        return [{"id": k, **v} for k, v in _store(user_id, name).items()]
    return {
        "transactions": dump("transactions"),
        "securities": dump("securities"),
        "securityPrices": get_security_prices(user_id, user_type),
        "externalAssets": dump("externalAssets"),
        "liabilities": dump("liabilities"),
        "snapshots": dump("dailySnapshots"),
        "settings": {"rebalanceTargets": get_rebalance_targets(user_id, user_type)},
    }


def get_supported_tickers():
    return {"stocks": [], "crypto": [], "funds": []}


def get_global_settings():
    return {}


def as_module():
    module = types.ModuleType("app.services.firestore_service")
    for name, value in globals().items():
        if callable(value) and not name.startswith("_") and name not in ("as_module",):
            setattr(module, name, value)
    return module


reset()

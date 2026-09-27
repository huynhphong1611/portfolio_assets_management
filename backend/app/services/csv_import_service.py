"""
CSV import — user-owned data, Portfolio Performance style
("File → Import → CSV files": transactions or historical quotes).

Transactions: header names are matched loosely (Vietnamese with or without
accents, or English), so both the legacy Google-Form sheet export and this
app's own "Xuất CSV" file can be imported. Every row is validated with the
same schema as the API (TransactionCreate); invalid rows are reported with
their line number and never written.

Prices: date + close (one security), date + ticker + close (long format)
or date + one column per ticker (wide format).
"""
import csv
import io
import re
from typing import Optional

from pydantic import ValidationError

from app.models.schemas import TransactionCreate
from app.utils.parsing import (
    detect_number_format, normalize_text, parse_date_any, parse_number,
    to_iso_date, to_vn_datetime,
)

TICKER_RE = re.compile(r"^[A-Za-z0-9À-ỹ\-_]{1,20}$")

TX_ALIASES = {
    "date": ["ngay gio", "dau thoi gian", "ngay giao dich", "thoi gian", "ngay", "date", "datetime", "time"],
    "transactionType": ["loai giao dich", "loai gd", "giao dich", "transaction type", "type"],
    "assetClass": ["loai tai san", "tai san", "nhom tai san", "asset class", "asset"],
    "ticker": ["ma", "ma ck", "ma chung khoan", "ma tai san", "ticker", "symbol"],
    "quantity": ["so luong", "sl", "quantity", "qty", "shares"],
    "unitPrice": ["don gia", "gia khop", "unit price", "price"],
    "currency": ["loai tien", "tien te", "currency"],
    "exchangeRate": ["ty gia", "exchange rate", "fx rate"],
    "costBasisValue": ["gia tri ban theo gia von", "cost basis"],
    "totalVND": ["thanh tien", "tong tien", "so tien", "gia tri", "amount", "total", "value"],
    "pnlVND": ["lai lo vnd", "pnl vnd"],
    "pnlPercent": ["lai lo %", "pnl %"],
    "storage": ["noi luu tru", "noi luu ky", "tai khoan", "storage", "broker", "account"],
    "notes": ["ghi chu", "mo ta", "notes", "note", "memo", "description"],
}

TYPE_ALIASES = {
    "nap tien": "Nạp tiền", "nap": "Nạp tiền", "deposit": "Nạp tiền",
    "rut tien": "Rút tiền", "rut": "Rút tiền", "removal": "Rút tiền", "withdrawal": "Rút tiền", "withdraw": "Rút tiền",
    "mua": "Mua", "buy": "Mua", "purchase": "Mua",
    "ban": "Bán", "sell": "Bán", "sale": "Bán",
    "co tuc": "Cổ tức", "lai": "Cổ tức", "lai tien gui": "Cổ tức", "coupon": "Cổ tức",
    "dividend": "Cổ tức", "dividends": "Cổ tức", "interest": "Cổ tức",
}

ASSET_ALIASES = {
    "tien mat vnd": "Tiền mặt VNĐ", "tien mat": "Tiền mặt VNĐ", "vnd": "Tiền mặt VNĐ", "cash": "Tiền mặt VNĐ",
    "tien mat usd": "Tiền mặt USD", "tien mat usd usdt": "Tiền mặt USD", "usd": "Tiền mặt USD", "usdt": "Tiền mặt USD", "stablecoin": "Tiền mặt USD",
    "trai phieu": "Trái phiếu", "trai phieu ccq tp": "Trái phiếu", "bond": "Trái phiếu", "bonds": "Trái phiếu",
    "co phieu": "Cổ phiếu", "co phieu ccq cp": "Cổ phiếu", "stock": "Cổ phiếu", "stocks": "Cổ phiếu", "etf": "Cổ phiếu",
    "tai san ma hoa": "Tài sản mã hóa", "tien ma hoa": "Tài sản mã hóa", "crypto": "Tài sản mã hóa",
    "vang": "Vàng", "vang dau tu": "Vàng", "gold": "Vàng",
}

CURRENCY_ALIASES = {"vnd": "VNĐ", "usdt": "USDT", "usdc": "USDC", "usd": "USD"}

PRICE_DATE_ALIASES = ["ngay", "date", "ngay gio", "thoi gian", "time", "datum"]
PRICE_TICKER_ALIASES = ["ma", "ma ck", "ticker", "symbol"]
PRICE_CLOSE_ALIASES = ["gia dong cua", "close", "gia", "quote", "price", "nav", "gia ban", "sell", "schlusskurs", "schluss", "adj close"]

MAX_ERRORS = 200
PREVIEW_ROWS = 50


# ── CSV reading ──

def read_rows(content: str) -> list[list[str]]:
    """Parse CSV text (',' ';' or tab separated, quoted fields may span lines)."""
    text = (content or "").lstrip("﻿")
    sample = "\n".join(text.splitlines()[:10])
    counts = {d: sample.count(d) for d in (",", ";", "\t")}
    delimiter = max(counts, key=counts.get) if any(counts.values()) else ","
    rows = []
    for row in csv.reader(io.StringIO(text), delimiter=delimiter):
        cells = [c.strip() for c in row]
        if any(cells):
            rows.append(cells)
    return rows


def _match_headers(header: list[str], aliases: dict) -> dict:
    """Return {field: column_index} using exact or prefix alias matches (longest alias wins)."""
    candidates = []
    for idx, cell in enumerate(header):
        h = normalize_text(cell)
        if not h:
            continue
        for field, names in aliases.items():
            for name in names:
                if h == name:
                    candidates.append((2, len(name), field, idx))
                elif h.startswith(name + " "):
                    candidates.append((1, len(name), field, idx))
    candidates.sort(reverse=True)
    mapping, used_cols = {}, set()
    for _, _, field, idx in candidates:
        if field not in mapping and idx not in used_cols:
            mapping[field] = idx
            used_cols.add(idx)
    return mapping


def _find_header(rows: list[list[str]], aliases: dict, required: set, min_fields: int = 3):
    for i, row in enumerate(rows[:20]):
        mapping = _match_headers(row, aliases)
        if required <= set(mapping) and len(mapping) >= min_fields:
            return i, mapping
    return None, None


# ── Transactions ──

def _cell(row, mapping, field):
    idx = mapping.get(field)
    return row[idx].strip() if idx is not None and idx < len(row) else ""


def _normalize_type(raw: str) -> Optional[str]:
    return TYPE_ALIASES.get(normalize_text(raw))


def _normalize_asset(raw: str) -> Optional[str]:
    return ASSET_ALIASES.get(normalize_text(raw))


def _build_transaction(row, mapping, fmt) -> dict:
    """Turn one CSV row into a TransactionCreate-compatible dict; raise ValueError with a readable message."""
    raw_date = _cell(row, mapping, "date")
    dt = parse_date_any(raw_date)
    if dt is None:
        raise ValueError(f"Ngày không hợp lệ: '{raw_date}'")

    raw_type = _cell(row, mapping, "transactionType")
    tx_type = _normalize_type(raw_type)
    if not tx_type:
        raise ValueError(f"Loại giao dịch không hợp lệ: '{raw_type}' (dùng Nạp tiền, Rút tiền, Mua, Bán, Cổ tức)")

    ticker = re.sub(r"\s+", "", _cell(row, mapping, "ticker")).upper()
    raw_asset = _cell(row, mapping, "assetClass")
    asset = _normalize_asset(raw_asset) if raw_asset else None
    if raw_asset and not asset:
        raise ValueError(f"Loại tài sản không hợp lệ: '{raw_asset}'")

    quantity = parse_number(_cell(row, mapping, "quantity"), fmt)
    unit_price = parse_number(_cell(row, mapping, "unitPrice"), fmt)
    rate = parse_number(_cell(row, mapping, "exchangeRate"), fmt) or 1.0
    total = parse_number(_cell(row, mapping, "totalVND"), fmt)
    currency = CURRENCY_ALIASES.get(normalize_text(_cell(row, mapping, "currency")), "VNĐ")

    tx = {
        "date": to_vn_datetime(dt),
        "transactionType": tx_type,
        "storage": _cell(row, mapping, "storage"),
        "notes": _cell(row, mapping, "notes"),
        "pnlVND": parse_number(_cell(row, mapping, "pnlVND"), fmt) or 0,
        "pnlPercent": parse_number(_cell(row, mapping, "pnlPercent"), fmt) or 0,
        "costBasisValue": parse_number(_cell(row, mapping, "costBasisValue"), fmt) or 0,
    }

    if tx_type in ("Nạp tiền", "Rút tiền"):
        amount = abs(total) if total else abs((quantity or 0) * (unit_price or 1) * rate)
        if amount <= 0:
            raise ValueError("Thiếu số tiền nạp/rút")
        tx.update({"assetClass": "Tiền mặt VNĐ", "ticker": "" if ticker in ("", "VNĐ", "VND") else ticker,
                   "quantity": amount, "unitPrice": 1, "currency": "VNĐ", "exchangeRate": 1, "totalVND": amount})
        return tx

    if tx_type == "Cổ tức":
        amount = abs(total) if total else abs((quantity or 0) * (unit_price or 0) * rate)
        if amount <= 0:
            raise ValueError("Thiếu số tiền cổ tức/lãi")
        shares = abs(quantity) if quantity and total else 1.0
        tx.update({"assetClass": asset or ("Cổ phiếu" if ticker else "Tiền mặt VNĐ"),
                   "ticker": "" if ticker in ("VNĐ", "VND") else ticker,
                   "quantity": shares, "unitPrice": amount / shares, "currency": "VNĐ",
                   "exchangeRate": 1, "totalVND": amount})
        return tx

    # Mua / Bán
    if not ticker:
        raise ValueError("Thiếu mã tài sản")
    if not asset:
        raise ValueError("Thiếu loại tài sản")
    qty = abs(quantity or 0)
    if qty <= 0:
        raise ValueError("Số lượng phải lớn hơn 0")
    if total is None and unit_price is None:
        raise ValueError("Thiếu đơn giá hoặc thành tiền")
    if unit_price is None:
        unit_price = abs(total) / qty / (rate or 1)
    amount = abs(total) if total is not None else qty * abs(unit_price) * rate
    tx.update({"assetClass": asset, "ticker": ticker,
               "quantity": -qty if tx_type == "Bán" else qty,
               "unitPrice": abs(unit_price), "currency": currency, "exchangeRate": rate, "totalVND": amount})
    return tx


def transaction_key(tx: dict) -> tuple:
    """Identity used to skip duplicates (same moment, type, ticker, quantity and amount)."""
    return (
        str(tx.get("date", ""))[:16],
        tx.get("transactionType", ""),
        (tx.get("ticker") or "").upper(),
        round(abs(float(tx.get("quantity") or 0)), 6),
        round(abs(float(tx.get("totalVND") or 0))),
    )


def parse_transactions_csv(content: str, number_format: str = "auto", existing: Optional[list] = None) -> dict:
    rows = read_rows(content)
    if not rows:
        return {"error": "File trống"}
    header_idx, mapping = _find_header(rows, TX_ALIASES, {"date", "transactionType"})
    if header_idx is None:
        return {"error": "Không tìm thấy dòng tiêu đề (cần ít nhất cột Ngày và Loại giao dịch)"}

    data_rows = rows[header_idx + 1:]
    numeric_fields = ("quantity", "unitPrice", "exchangeRate", "totalVND")
    fmt = number_format if number_format in ("vi", "en") else detect_number_format(
        _cell(r, mapping, f) for r in data_rows for f in numeric_fields)

    seen = {transaction_key(t) for t in (existing or [])}
    valid, errors, duplicates = [], [], []
    for offset, row in enumerate(data_rows):
        line = header_idx + offset + 2  # 1-based, header counted
        try:
            tx = TransactionCreate(**_build_transaction(row, mapping, fmt)).model_dump()
        except ValidationError as e:
            first = e.errors()[0]
            field = ".".join(str(x) for x in first.get("loc", []))
            errors.append({"line": line, "message": f"{field}: {first.get('msg')}"})
            continue
        except ValueError as e:
            errors.append({"line": line, "message": str(e)})
            continue
        key = transaction_key(tx)
        if key in seen:
            duplicates.append(line)
            continue
        seen.add(key)
        valid.append({"line": line, **tx})

    header = rows[header_idx]
    return {
        "numberFormat": fmt,
        "columns": {field: header[idx] for field, idx in mapping.items()},
        "total": len(data_rows),
        "valid": valid,
        "errors": errors[:MAX_ERRORS],
        "errorCount": len(errors),
        "duplicates": duplicates,
    }


# ── Prices ──

def _header_index(header, aliases) -> Optional[int]:
    best = None
    for idx, cell in enumerate(header):
        h = normalize_text(cell)
        for rank, name in enumerate(aliases):
            if h == name or h.startswith(name + " "):
                score = (0 if h == name else 1, rank)
                if best is None or score < best[0]:
                    best = (score, idx)
    return best[1] if best else None


def parse_prices_csv(content: str, ticker: Optional[str] = None, number_format: str = "auto") -> dict:
    rows = read_rows(content)
    if not rows:
        return {"error": "File trống"}
    ticker = (ticker or "").strip().upper() or None
    if ticker and not TICKER_RE.match(ticker):
        return {"error": "Mã chứng khoán không hợp lệ"}

    has_header = parse_date_any(rows[0][0]) is None
    if has_header:
        header, data_rows, first_line = rows[0], rows[1:], 2
        date_col = _header_index(header, PRICE_DATE_ALIASES)
        if date_col is None:
            return {"error": "Không tìm thấy cột Ngày"}
        ticker_col = _header_index(header, PRICE_TICKER_ALIASES)
        close_col = _header_index(header, PRICE_CLOSE_ALIASES)
    else:
        header, data_rows, first_line = None, rows, 1
        date_col, ticker_col, close_col = 0, None, 1 if len(rows[0]) >= 2 else None
        if close_col is None:
            return {"error": "Cần ít nhất 2 cột: ngày và giá"}

    if ticker_col is not None and close_col is not None:
        layout = "long"
        columns = {}
    elif close_col is not None:
        layout = "single"
        if not ticker:
            return {"error": "File chỉ có một cột giá: hãy chọn mã chứng khoán cần nhập"}
        columns = {close_col: ticker}
    else:
        layout = "wide"
        columns = {}
        for idx, cell in enumerate(header):
            if idx == date_col:
                continue
            name = re.sub(r"\s+", "", cell).upper()
            if TICKER_RE.match(name):
                columns[idx] = name
        if not columns:
            return {"error": "Không nhận ra cột giá nào"}

    value_cols = [close_col] if layout == "long" else list(columns)
    fmt = number_format if number_format in ("vi", "en") else detect_number_format(
        r[c] for r in data_rows for c in value_cols if c < len(r))

    prices, errors = {}, []
    for offset, row in enumerate(data_rows):
        line = first_line + offset
        dt = parse_date_any(row[date_col]) if date_col < len(row) else None
        if dt is None:
            errors.append({"line": line, "message": f"Ngày không hợp lệ: '{row[date_col] if date_col < len(row) else ''}'"})
            continue
        iso = to_iso_date(dt)
        if layout == "long":
            t = re.sub(r"\s+", "", row[ticker_col]).upper() if ticker_col < len(row) else ""
            if not TICKER_RE.match(t):
                errors.append({"line": line, "message": f"Mã không hợp lệ: '{t}'"})
                continue
            targets = [(close_col, t)]
        else:
            targets = list(columns.items())
        for col, t in targets:
            raw = row[col] if col < len(row) else ""
            if raw == "":
                continue
            value = parse_number(raw, fmt)
            if value is None or value <= 0:
                errors.append({"line": line, "message": f"Giá không hợp lệ cho {t}: '{raw}'"})
                continue
            prices.setdefault(t, {})[iso] = value

    summary = {
        t: {"count": len(p), "first": min(p), "last": max(p), "lastPrice": p[max(p)]}
        for t, p in prices.items()
    }
    return {
        "layout": layout,
        "numberFormat": fmt,
        "prices": prices,
        "tickers": summary,
        "errors": errors[:MAX_ERRORS],
        "errorCount": len(errors),
    }
